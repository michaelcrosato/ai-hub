/* STATIC VEIL — original cosmetic weather / vent effects, pinned Three r181.
 * Pure visual layer. All inputs are copied; no game/body/collision references.
 * Coordinates: METRES, x east / y south / z UP. Root owns fog, lighting, bloom.
 *
 * const fx = await createCityEffects({renderer,scene,seed:'MERIDIAN-09'});
 * fx.update(dt, {anchor:{x,y,z},supportZ:floorMetres,outdoors:true,
 *   rain:.7,embers:true,wind:{x:.7,y:.2},emitters:[{x,y,z,intensity:1}, ...]});
 * Call update BEFORE renderer.render / postprocessing.render.
 * fx.setPaused(bool); fx.setReducedMotion(bool); fx.setEnabled(bool);
 * fx.dispose(); // releases owned geometry, node materials and compute nodes.
 *
 * WebGPU: fixed 1/60s storage-buffer simulation, at most 3 steps/update.
 * WebGLBackend: smaller analytic TSL vertex particles, NEVER renderer.compute.
 * Root must disable/hide this group while rendering depth-only/filter masks.
 * Same depth buffer as buildings: depthTest=true, depthWrite=false.
 * Rain has no gameplay collision. supportZ is a cosmetic floor; indoors hide.
 *
 * Primary API evidence (exact tag, not current dev documentation):
 * https://github.com/mrdoob/three.js/blob/r181/examples/webgpu_compute_particles.html
 * https://github.com/mrdoob/three.js/blob/r181/src/nodes/accessors/Arrays.js
 * https://github.com/mrdoob/three.js/blob/r181/src/materials/nodes/SpriteNodeMaterial.js
 */
import * as THREE from 'three/webgpu';
import {
  Fn, If, uniform, uniformArray, float, uint, vec2, vec3, vec4,
  uv, hash, instanceIndex, instancedArray, smoothstep, atan, cameraViewMatrix, mrt
} from 'three/tsl';

const FIXED = 1 / 60, MAX_STEPS = 3, MAX_EMITTERS = 8, TAU = Math.PI * 2;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
function seedHash(s) { let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0; }

export async function createCityEffects({renderer,scene,seed='MERIDIAN-09',quality='balanced',enabled=true,reducedMotion=false,subjectMask=0,compute=true}={}) {
  if(!renderer||!scene)throw new TypeError('createCityEffects requires renderer and scene.');
  if(THREE.REVISION!=='181')throw new Error('city-fx requires pinned Three.js r181.');
  await renderer.init();
  const gpu=renderer.backend?.isWebGPUBackend===true&&compute!==false;
  const q=quality==='low'?0:quality==='high'?2:1;
  const rainCount=(gpu?[2048,8192,16384]:[512,1536,2048])[q];
  const sparkCount=(gpu?[128,512,512]:[64,128,192])[q];
  const group=new THREE.Group();group.name='Meridian cosmetic effects';group.visible=false;
  group.userData.cosmetic=true;group.userData.excludeFromFilterMask=true;scene.add(group);
  const clock=uniform(0),step=uniform(FIXED),anchor=uniform(new THREE.Vector3());
  const shift=uniform(new THREE.Vector3()),wind=uniform(new THREE.Vector2(.7,.2));
  const bottom=uniform(0),rainAlpha=uniform(.7),source=uniformArray(Array.from({length:MAX_EMITTERS},()=>new THREE.Vector4(0,0,-10000,0)),'vec4');
  const extent=56,half=extent/2,top=48,seedNode=uint(seedHash(seed)),id=instanceIndex.add(seedNode);
  const r0=hash(id),r1=hash(id.add(101)),r2=hash(id.add(503)),r3=hash(id.add(997));
  const fallSpeed=r3.mul(8).add(19),life=r3.mul(.9).add(1.1),angle=r1.mul(TAU);
  const launch=vec3(angle.cos().mul(r2.mul(1.3).add(.25)),angle.sin().mul(r2.mul(1.3).add(.25)),r0.mul(2.1).add(2.7));
  const emitter=source.element(instanceIndex.mod(MAX_EMITTERS));
  const resources=[],computeNodes=[],ownedAttributes=[];
  let rainPosition,sparkPosition,sparkAge,sparkLife;
  let initialized=false,paused=false,disposed=false,outdoors=true,active=!!enabled,reduced=!!reducedMotion;
  let accumulator=0,ticks=0,dispatches=0,lastAnchor=new THREE.Vector3(),hasAnchor=false;

  if(gpu){
    const drops=instancedArray(rainCount,'vec3');
    const sparks=instancedArray(sparkCount,'vec4'),velocity=instancedArray(sparkCount,'vec4');
    ownedAttributes.push(drops.value,sparks.value,velocity.value);
    const initRain=Fn(()=>{
      drops.element(instanceIndex).assign(vec3(r0.mul(extent).sub(half),r1.mul(extent).sub(half),bottom.add(r2.mul(float(top).sub(bottom)))));
    })().compute(rainCount).setName('Meridian rain init');
    const initSparks=Fn(()=>{
      const p=sparks.element(instanceIndex),v=velocity.element(instanceIndex),age=r2.mul(life);
      p.xyz.assign(emitter.xyz.add(launch.mul(age)).add(vec3(0,0,age.mul(age).mul(-1.2))));
      p.w.assign(age);v.xyz.assign(launch.add(vec3(0,0,age.mul(-2.4))));v.w.assign(life);
    })().compute(sparkCount).setName('Meridian ember init');
    const rainStep=Fn(()=>{
      const p=drops.element(instanceIndex);p.subAssign(shift);
      p.x.assign(p.x.add(wind.x.mul(step)).add(half).div(extent).fract().mul(extent).sub(half));
      p.y.assign(p.y.add(wind.y.mul(step)).add(half).div(extent).fract().mul(extent).sub(half));
      p.z.subAssign(fallSpeed.mul(step));
      If(p.z.lessThan(bottom),()=>{p.z.assign(float(top).sub(hash(id.add(uint(clock.mul(60)))).mul(2)));});
      If(p.z.greaterThan(top),()=>{p.z.assign(bottom.add(r2.mul(float(top).sub(bottom))));});
    })().compute(rainCount).setName('Meridian rain simulate');
    const sparkStep=Fn(()=>{
      const p=sparks.element(instanceIndex),v=velocity.element(instanceIndex);
      v.xy.addAssign(vec2(wind.x,wind.y).mul(step).mul(.12));v.z.subAssign(step.mul(2.4));
      p.xyz.addAssign(v.xyz.mul(step));p.w.addAssign(step);
      If(p.w.greaterThanEqual(v.w).or(p.z.lessThan(emitter.z.sub(.12))),()=>{
        p.xyz.assign(emitter.xyz.add(vec3(r0.sub(.5).mul(.35),r1.sub(.5).mul(.35),.08)));
        p.w.assign(0);v.xyz.assign(launch);v.w.assign(life);
      });
    })().compute(sparkCount).setName('Meridian ember simulate');
    rainPosition=drops.toAttribute().add(anchor);
    const p=sparks.toAttribute(),v=velocity.toAttribute();
    sparkPosition=p.xyz;sparkAge=p.w;sparkLife=v.w;
    computeNodes.push(initRain,initSparks,rainStep,sparkStep);
  }else{
    // Analytic vertex motion uses immutable per-instance hashes and the paused clock.
    const span=float(top).sub(bottom);
    rainPosition=vec3(r0.add(clock.mul(wind.x).div(extent)).fract().mul(extent).sub(half),r1.add(clock.mul(wind.y).div(extent)).fract().mul(extent).sub(half),float(top).sub(r2.add(clock.mul(fallSpeed).div(span)).fract().mul(span))).add(anchor);
    sparkAge=clock.div(life).add(r2).fract().mul(life);sparkLife=life;
    sparkPosition=emitter.xyz.add(launch.mul(sparkAge)).add(vec3(wind.x,wind.y,0).mul(sparkAge.mul(sparkAge).mul(.06))).add(vec3(0,0,sparkAge.mul(sparkAge).mul(-1.2)));
  }
  function sprite(name,count,material){
    const object=new THREE.Sprite(material);object.name=name;object.count=count;object.frustumCulled=false;
    // Sprite's default geometry is shared; clone before owning/disposal.
    object.geometry=object.geometry.clone();object.userData.cosmetic=true;object.userData.excludeFromFilterMask=true;
    group.add(object);resources.push(object);return object;
  }
  const streak=uv().sub(.5);
  const rainMaterial=new THREE.SpriteNodeMaterial({transparent:true,depthTest:true,depthWrite:false,blending:THREE.NormalBlending,toneMapped:false,alphaTest:.008});
  rainMaterial.positionNode=rainPosition;
  const projectedGravity=cameraViewMatrix.mul(vec4(wind.x,wind.y,-24,0)).xy;
  rainMaterial.scaleNode=vec2(.022,r3.mul(.25).add(.48).mul(projectedGravity.length().div(24).clamp(.08,1)));
  rainMaterial.rotationNode=atan(projectedGravity.y,projectedGravity.x).sub(Math.PI/2);
  rainMaterial.colorNode=vec3(.49,.76,.85);
  rainMaterial.opacityNode=float(1).sub(smoothstep(.05,.5,streak.x.abs())).mul(float(1).sub(smoothstep(.22,.5,streak.y.abs()))).mul(rainAlpha).mul(.28);
  // Alpha on EVERY MRT prevents invisible billboard corners overwriting masks.
  // Keep output inherited from the root pass; particles supply its extra targets.
  rainMaterial.mrtNode=mrt({normal:vec4(0,0,1,rainMaterial.opacityNode),fx:vec4(clamp(finite(subjectMask),0,1),0,0,rainMaterial.opacityNode),emissive:vec4(rainMaterial.colorNode.mul(.03),rainMaterial.opacityNode)});
  const rain=sprite('Meridian depth-tested rain',rainCount,rainMaterial);
  const sparkMaterial=new THREE.SpriteNodeMaterial({transparent:true,depthTest:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,alphaTest:.008});
  sparkMaterial.positionNode=sparkPosition;sparkMaterial.scaleNode=vec2(r0.mul(.035).add(.035));
  sparkMaterial.colorNode=vec3(1,r1.mul(.35).add(.42),.12).mul(2.4);
  const ageRatio=sparkAge.div(sparkLife).clamp(0,1);
  sparkMaterial.opacityNode=float(1).sub(smoothstep(.1,.5,uv().sub(.5).length())).mul(float(1).sub(ageRatio)).mul(emitter.w).mul(.9);
  sparkMaterial.mrtNode=mrt({normal:vec4(0,0,1,sparkMaterial.opacityNode),fx:vec4(clamp(finite(subjectMask),0,1),0,0,sparkMaterial.opacityNode),emissive:vec4(sparkMaterial.colorNode,sparkMaterial.opacityNode)});
  const embers=sprite('Meridian vent embers',sparkCount,sparkMaterial);

  function stats(){return Object.freeze({backend:gpu?'compute':'analytic',quality,phase:ticks*FIXED,steps:ticks,dispatches,rain:rainCount,embers:sparkCount,visible:group.visible,paused,enabled:active,reducedMotion:reduced,disposed});}
  function visibility(){group.visible=!disposed&&active&&!reduced&&outdoors;}
  function update(dt,state={}){
    if(disposed)return stats();
    outdoors=state.outdoors!==false&&state.interior!==true;visibility();
    embers.visible=state.embers!==false;
    if(paused||!group.visible)return stats();
    const p=state.anchor||{},ax=finite(p.x),ay=finite(p.y),az=finite(p.z);
    if(!hasAnchor){lastAnchor.set(ax,ay,az);hasAnchor=true;}
    // Copy inputs; never retain mutable engine vectors, emitter objects or arrays.
    anchor.value.set(ax,ay,az);shift.value.set(ax-lastAnchor.x,ay-lastAnchor.y,az-lastAnchor.z);
    bottom.value=clamp(finite(state.supportZ,az)-az+.035,-8,top-2);
    rainAlpha.value=clamp(finite(state.rain,.7),0,1);rain.visible=rainAlpha.value>.001;
    wind.value.set(clamp(finite(state.wind?.x,.7),-12,12),clamp(finite(state.wind?.y,.2),-12,12));
    const emitters=embers.visible&&Array.isArray(state.emitters)?state.emitters:[];
    for(let i=0;i<MAX_EMITTERS;i++){const e=emitters[i];source.array[i].set(finite(e?.x),finite(e?.y),finite(e?.z,-10000),e?clamp(finite(e.intensity,1),0,1):0);}
    if(gpu&&!initialized){renderer.compute(computeNodes.slice(0,2));dispatches+=2;initialized=true;lastAnchor.copy(anchor.value);shift.value.set(0,0,0);}
    accumulator=Math.min(accumulator+clamp(finite(dt),0,MAX_STEPS*FIXED),MAX_STEPS*FIXED);
    let steps=0;
    while(accumulator+1e-8>=FIXED&&steps<MAX_STEPS){
      accumulator=Math.max(0,accumulator-FIXED);ticks++;clock.value=ticks*FIXED;
      if(gpu){const nodes=embers.visible?computeNodes.slice(2):[computeNodes[2]];renderer.compute(nodes);dispatches+=nodes.length;}
      shift.value.set(0,0,0);lastAnchor.copy(anchor.value);steps++;
    }
    return stats();
  }
  function dispose(){
    if(disposed)return;disposed=true;group.visible=false;group.removeFromParent();
    for(const node of computeNodes)node.dispose();
    for(const object of resources){object.geometry.dispose();object.material.dispose();group.remove(object);}
    // r181 has no public storage-attribute disposal API. Geometry normally frees
    // these render attributes, but compute can run before the first render.
    // Pinned, guarded cache deletion handles that case and is idempotent after
    // geometry.dispose(); never call backend.destroyAttribute without its cache.
    for(const attribute of ownedAttributes)renderer._attributes?.delete?.(attribute);
    resources.length=0;computeNodes.length=0;ownedAttributes.length=0;
  }
  return Object.freeze({group,update,stats,dispose,
    setPaused(value){paused=!!value;return stats();},
    setReducedMotion(value){reduced=!!value;visibility();return stats();},
    setEnabled(value){active=!!value;visibility();return stats();}
  });
}

export const CITY_FX_REVISION='181';
