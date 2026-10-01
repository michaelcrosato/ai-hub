import * as THREE from 'three/webgpu';
import { pass, uniform, positionLocal, vec3, sin, color, mix, smoothstep, screenUV, renderOutput } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { createInstanced, bakeInstances } from 'kit/instancing.js';
import { SIZE, HEIGHT, TEAM } from './sim.js';

const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const half=SIZE/2;
const hash=(x,z,seed=0)=>{const n=Math.sin(x*127.1+z*311.7+seed*.003)*43758.5453;return n-Math.floor(n);};
/**
 * What each kit quality tier asks of this world. The look (bloom, vignette,
 * shadows, fog, clouds) stays on everywhere; the tiers scale bloom size, tree
 * and particle counts, and ambient occlusion (desktop tiers, as before).
 */
const TIER_LOOK={
  low:{bloom:.12,bloomScale:.5,ao:false,aoSamples:0},
  medium:{bloom:.12,bloomScale:.5,ao:false,aoSamples:0},
  high:{bloom:.18,bloomScale:.8,ao:true,aoSamples:8},
  ultra:{bloom:.23,bloomScale:1,ao:true,aoSamples:16}
};
const TREES=200, PARTICLES=260;
// Terrain colours, parsed once.
const C_SCAR=new THREE.Color('#6a6759'), C_SWAMP=new THREE.Color('#65795b'), C_SAND=new THREE.Color('#c4ba8d');
const C_SNOW=new THREE.Color('#e3e6d1'), C_ROCK=new THREE.Color('#a3ada0');
function roofGeometry(){
  const g=new THREE.BufferGeometry();
  const v=[-.5,0,-.5, .5,0,-.5, 0,.5,-.5, -.5,0,.5, 0,.5,.5, .5,0,.5,
    -.5,0,-.5, 0,.5,-.5, 0,.5,.5, -.5,0,-.5, 0,.5,.5, -.5,0,.5,
    .5,0,-.5, .5,0,.5, 0,.5,.5, .5,0,-.5, 0,.5,.5, 0,.5,-.5,
    -.5,0,-.5, -.5,0,.5, .5,0,.5, -.5,0,-.5, .5,0,.5, .5,0,-.5];
  // Point the roof faces outwards. All dimensions are set by instance transforms.
  for(let i=0;i<v.length;i+=9)for(let k=0;k<3;k++){const temp=v[i+3+k];v[i+3+k]=v[i+6+k];v[i+6+k]=temp;}
  g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;
}
/**
 * A batch of boxes, cones or roofs rebuilt as the world changes. Every batch
 * comes from kit/instancing.js, so they all share one set of shaders instead
 * of compiling their own (r186 keys InstancedMesh shaders by mesh).
 */
class Batch {
  constructor(parent,geometry,material,max=3000,shadow=true){
    this.mesh=createInstanced(geometry,material,max);this.mesh.count=0;
    this.mesh.castShadow=shadow;this.mesh.receiveShadow=true;this.mesh.frustumCulled=false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);parent.add(this.mesh);
    this.dummy=new THREE.Object3D();this.max=max;
  }
  reset(){this.mesh.count=0;}
  add(x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0){
    const i=this.mesh.count;if(i>=this.max)return;
    const d=this.dummy;d.position.set(x,y,z);d.rotation.set(rx,ry,0);d.scale.set(sx,sy,sz);d.updateMatrix();
    this.mesh.setMatrixAt(i,d.matrix);this.mesh.count++;
  }
  /** Upload only the instances in use: walkers and particles refill their batches every frame. */
  finish(){
    const m=this.mesh.instanceMatrix,n=this.mesh.count;if(!n)return;
    m.clearUpdateRanges();m.addUpdateRange(0,n*16);m.needsUpdate=true;
  }
}
/** Instances placed once and never moved: built, then baked into one plain mesh. */
function bakedBatch(geometry,material,list){
  const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,list.length));
  const d=new THREE.Object3D();
  list.forEach(([x,y,z,sx,sy,sz],i)=>{d.position.set(x,y,z);d.rotation.set(0,0,0);d.scale.set(sx,sy,sz);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});
  mesh.count=list.length;
  return bakeInstances(mesh);
}
export class WorldView {
  constructor(kit,world){
    this.kit=kit;this.renderer=kit.renderer;this.world=world;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#68968f');
    this.scene.fog=new THREE.FogExp2('#8caba0',.010);
    this.camera=new THREE.OrthographicCamera(-30,30,22,-22,.1,200);
    this.target=new THREE.Vector3(0,1,0);this.yaw=.66;this.pitch=.86;this.viewSize=43;this.desiredSize=43;
    this.desiredYaw=this.yaw;this.desiredPitch=this.pitch;
    // The free band between the top and bottom HUD, in CSS pixels from the top; the island centres in it.
    this.band={top:0,bottom:0};this.bandNdc=0;this.shake=0;this.shakeOffset=new THREE.Vector3();
    this.clockNode=uniform(0);
    this.terrainVersion=-1;this.townVersion=-1;this.gridShown=false;this.decorDirty=false;
    this.particles=[];this.particleCount=0;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.projected=new THREE.Vector3();
    this.pickTargets=[];this.figure={x:0,y:0,z:0,size:1,angle:0,ca:1,sa:0};
    this.geometry={box:new THREE.BoxGeometry(1,1,1),cone:new THREE.ConeGeometry(.5,1,4),stud:new THREE.CylinderGeometry(.1,.105,.045,8),
      rock:new THREE.DodecahedronGeometry(.5,0),roof:roofGeometry(),ring:new THREE.TorusGeometry(.45,.025,5,32)};
    this.mats={};
    const mat=(key,c,opts={})=>this.mats[key]=new THREE.MeshStandardMaterial({color:c,roughness:.76,metalness:.02,...opts});
    mat('grass','#ffffff',{vertexColors:true,roughness:.85});mat('stud','#a3c47b');
    mat('trunk','#8b7051');mat('pine','#52785b');mat('oak','#759f69');mat('rock','#a8b2a4');
    mat('foundation','#c5bc9c');mat('walls','#e5ddbb');mat('darkWall','#a5ab98');mat('door','#435c56');
    mat('roof0','#689fa1');mat('roof1','#c97861');mat('flag0',TEAM[0].color,{emissive:TEAM[0].color,emissiveIntensity:.12});
    mat('flag1',TEAM[1].color,{emissive:TEAM[1].color,emissiveIntensity:.12});
    mat('gold','#f5d490',{metalness:.5,roughness:.35,emissive:'#e9b66b',emissiveIntensity:.18});
    mat('crop','#c7b774');mat('soil','#aa9465');mat('skin','#ecdbb2');mat('boots','#425d56');mat('armor','#b7cbc2',{metalness:.65,roughness:.34});
    this.mats.foam=new THREE.MeshBasicMaterial({color:'#c4ded1',transparent:true,opacity:.56,depthWrite:false,side:THREE.DoubleSide});
    this.mats.cursor=new THREE.MeshBasicMaterial({color:'#e2f4b2',transparent:true,opacity:.9,depthTest:false});
    this.mats.particle=new THREE.MeshStandardMaterial({color:'#fff4c5',emissive:'#f8d989',emissiveIntensity:.7,roughness:.8});
    this.staticRoot=new THREE.Group();this.townRoot=new THREE.Group();this.unitRoot=new THREE.Group();
    this.scene.add(this.staticRoot,this.townRoot,this.unitRoot);
    this.setupRenderer();this.setupLighting();this.setupWater();this.setupBatches();this.setupMarkers();this.setupTerrain();
    this.applyTier(kit.tier);
    kit.onQuality(tier=>this.applyTier(tier));
    this.updateCamera(1);this.sync();
  }
  setupRenderer(){
    const r=this.renderer;
    r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.18;
    r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;
    this.backend=this.kit.backendLabel;
  }
  setupLighting(){
    this.hemi=new THREE.HemisphereLight('#e7f0d6','#5c7163',2.1);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight('#ffebba',3.8);this.sun.position.set(-24,36,18);this.sun.castShadow=true;
    const s=this.sun.shadow;s.camera.left=-29;s.camera.right=29;
    s.camera.top=29;s.camera.bottom=-29;s.camera.near=1;s.camera.far=100;s.normalBias=.035;s.bias=-.0002;s.radius=2.5;
    // 2048 at high, scaled for the tier and kept sized when the player changes quality.
    this.kit.shadow(this.sun,2048);
    this.scene.add(this.sun);
    const fill=new THREE.DirectionalLight('#9dbfc1',.5);fill.position.set(24,14,-24);this.scene.add(fill);
  }
  setupWater(){
    const water=new THREE.MeshStandardNodeMaterial({roughness:.36,metalness:.22});
    const wave=sin(positionLocal.x.mul(.68).add(this.clockNode.mul(.45))).mul(.016)
      .add(sin(positionLocal.z.mul(.54).sub(this.clockNode.mul(.31))).mul(.014));
    water.positionNode=positionLocal.add(vec3(0,wave,0));
    const t=sin(positionLocal.x.mul(.18).add(positionLocal.z.mul(.21)).add(this.clockNode.mul(.035))).mul(.5).add(.5);
    water.colorNode=mix(color('#4c8884'),color('#82afa0'),t.mul(.52));
    const geo=new THREE.PlaneGeometry(180,180,90,90);geo.rotateX(-Math.PI/2);
    this.water=new THREE.Mesh(geo,water);this.water.position.y=this.world.sea*HEIGHT-.012;this.water.receiveShadow=true;this.scene.add(this.water);
    const lines=[];
    for(let i=0;i<90;i++)lines.push([hash(i,1)*100-50,.022,hash(i,2)*100-50,.3+hash(i,8)*1.4,.012,.018]);
    this.waterLines=bakedBatch(this.geometry.box,new THREE.MeshBasicMaterial({color:'#c4ded2',transparent:true,opacity:.17,depthWrite:false}),lines);
    this.waterLines.castShadow=false;this.waterLines.receiveShadow=false;this.scene.add(this.waterLines);
  }
  setupBatches(){
    const batch=(root,g,m,max=2000,shadow=true)=>new Batch(root,this.geometry[g],this.mats[m],max,shadow);
    this.decor={
      studs:batch(this.staticRoot,'stud','stud',2500,false),
      trunks:batch(this.staticRoot,'box','trunk',500),
      pines:batch(this.staticRoot,'cone','pine',1500),
      oaks:batch(this.staticRoot,'box','oak',1000),
      rocks:batch(this.staticRoot,'rock','rock',500),
      soil:batch(this.staticRoot,'box','soil',1400,false),
      crop:batch(this.staticRoot,'box','crop',5000,false)
    };
    this.buildings={};
    for(const m of ['foundation','walls','darkWall','door','roof0','roof1','flag0','flag1','gold']) {
      this.buildings[m]=batch(this.townRoot,'box',m,6000);
    }
    for(let team=0;team<2;team++){
      this.buildings['gable'+team]=batch(this.townRoot,'roof','roof'+team,800);
      this.buildings['spire'+team]=batch(this.townRoot,'cone','roof'+team,1600);
    }
    this.people={};
    for(const m of ['flag0','flag1','skin','boots','armor','gold'])this.people[m]=batch(this.unitRoot,'box',m,2200,true);
    this.particleBatch=new Batch(this.scene,this.geometry.box,this.mats.particle,500,false);
  }
  setupMarkers(){
    this.cursor=new THREE.Group();this.scene.add(this.cursor);this.cursor.visible=false;
    for(let side=0;side<4;side++){
      const m=new THREE.Mesh(this.geometry.box,this.mats.cursor);m.scale.set(side%2?.04:1.04,.022,side%2?1.04:.04);
      m.position.set(side===1?.5:side===3?-.5:0,0,side===0?-.5:side===2?.5:0);this.cursor.add(m);
    }
    this.cursor.renderOrder=50;
    this.magnetMeshes=[];
    for(let team=0;team<2;team++){
      const g=new THREE.Group();
      const pole=new THREE.Mesh(this.geometry.box,this.mats.gold);pole.scale.set(.065,1.2,.065);pole.position.y=.6;g.add(pole);
      const flag=new THREE.Mesh(this.geometry.box,this.mats['flag'+team]);flag.scale.set(.47,.31,.035);flag.position.set(.23,1.04,0);g.add(flag);
      const ring=new THREE.Mesh(this.geometry.ring,new THREE.MeshBasicMaterial({color:TEAM[team].color,transparent:true,opacity:.7}));
      ring.rotation.x=-Math.PI/2;ring.position.y=.035;g.add(ring);this.scene.add(g);this.magnetMeshes.push(g);
    }
    const cloudMat=new THREE.MeshStandardMaterial({color:'#e7ecda',transparent:true,opacity:.30,depthWrite:false,roughness:1});
    const clouds=[];
    for(let i=0;i<9;i++)for(let j=0;j<4;j++){
      const a=i/9*Math.PI*2,r=27+hash(i,j)*5;
      clouds.push([Math.cos(a)*r+j*1.4,9+hash(i,3)*4,Math.sin(a)*r,3.4,1.2+hash(i,j),2.2]);
    }
    this.clouds=bakedBatch(this.geometry.rock,cloudMat,clouds);
    this.clouds.castShadow=false;this.clouds.receiveShadow=false;this.scene.add(this.clouds);
  }
  /** One terrain mesh whose buffers are sized for the whole map once and refilled on every change. */
  setupTerrain(){
    const verts=SIZE*SIZE*36;
    this.tPos=new THREE.BufferAttribute(new Float32Array(verts*3),3).setUsage(THREE.DynamicDrawUsage);
    this.tNor=new THREE.BufferAttribute(new Float32Array(verts*3),3).setUsage(THREE.DynamicDrawUsage);
    this.tCol=new THREE.BufferAttribute(new Float32Array(verts*3),3).setUsage(THREE.DynamicDrawUsage);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',this.tPos);geo.setAttribute('normal',this.tNor);geo.setAttribute('color',this.tCol);
    geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,3,0),Math.hypot(half,half,6)+1);
    geo.boundingBox=new THREE.Box3(new THREE.Vector3(-half,-1,-half),new THREE.Vector3(half,8,half));
    this.terrain=new THREE.Mesh(geo,this.mats.grass);this.terrain.receiveShadow=true;this.terrain.castShadow=true;this.scene.add(this.terrain);
    this.pickTargets=[this.terrain,this.water];
    this.scratch={outer:[new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3)],
      inner:[new Float32Array(3),new Float32Array(3),new Float32Array(3),new Float32Array(3)],centre:new Float32Array(3),col:new THREE.Color()};
  }
  /** The render pipeline: scene, ambient occlusion (high and ultra), bloom, a soft vignette, FXAA where there is no MSAA. */
  buildPost(tier){
    const look=TIER_LOOK[tier.name]||TIER_LOOK.high;
    if(!this.pipeline){
      this.pipeline=new THREE.RenderPipeline(this.renderer);
      this.scenePass=pass(this.scene,this.camera);
      this.sceneColor=this.scenePass.getTextureNode('output');
      this.bloomNode=bloom(this.sceneColor,look.bloom,.35,.9);
      this.edge=smoothstep(.28,.8,screenUV.sub(.5).length()).mul(.075).oneMinus();
    }
    this.bloomNode.strength.value=look.bloom;
    this.bloomNode.setResolutionScale(look.bloomScale);
    let output=this.sceneColor;
    if(look.ao){
      if(!this.aoNode){
        // GTAO gathers from depth, which WebGPU cannot do on a multisampled texture: its own single-sampled depth pass.
        this.aoPass=pass(this.scene,this.camera,{samples:0});
        this.aoPass.overrideMaterial=new THREE.MeshBasicNodeMaterial({color:0x000000,fog:false});
        this.aoPass.transparent=false;
        this.aoNode=ao(this.aoPass.getTextureNode('depth'),null,this.camera);
        this.aoNode.resolutionScale=.5;this.aoNode.radius.value=.7;this.aoNode.thickness.value=.7;this.aoNode.scale.value=.8;
        this.aoShade=this.aoNode.getTextureNode().r.mul(.5).add(.5);
      }
      this.aoNode.samples.value=look.aoSamples;
      output=output.mul(this.aoShade);
    }
    output=output.add(this.bloomNode).mul(this.edge);
    const useFxaa=!tier.msaa&&tier.name!=='low';
    // FXAA works on display colour: tone map first, then skip the pipeline's own transform.
    this.pipeline.outputColorTransform=!useFxaa;
    this.pipeline.outputNode=useFxaa?fxaa(renderOutput(output)):output;
    this.pipeline.needsUpdate=true;
    this.effects=true;
  }
  applyTier(tier){
    this.tier=tier;
    this.maxTrees=Math.round(TREES*tier.detail);
    this.maxParticles=Math.min(500,Math.round(PARTICLES*tier.detail));
    // Tiny walkers cast shadows except on the lowest tier (a mesh flag, safe to change at runtime).
    for(const b of Object.values(this.people))b.mesh.castShadow=tier.name!=='low';
    try{this.buildPost(tier);}catch(e){console.warn('Effect setup:',e);this.effects=false;}
    this.decorDirty=true;
  }
  setWorld(w){this.world=w;this.terrainVersion=-1;this.townVersion=-1;this.particles.length=0;this.particleCount=0;this.resetCamera();this.sync();}
  /** The free band between the HUD panels, so the island sits in the part of the screen the player can see. */
  setBand(top,bottom){this.band.top=top;this.band.bottom=bottom;}
  fitSize(){
    const H=Math.max(1,this.kit.size.height),W=Math.max(1,this.kit.size.width),bandH=Math.max(140,this.band.bottom-this.band.top||H);
    return clamp(Math.max(43,26*H/bandH,44*H/W),40,76);
  }
  resetCamera(){this.target.set(0,1,0);this.desiredYaw=.66;this.desiredPitch=.86;this.desiredSize=this.fitSize();}
  focus(x,z){this.target.x=clamp(x-half,-half,half);this.target.z=clamp(z-half,-half,half);this.target.y=Math.max(1,this.world.heightAt(x,z));}
  zoom(factor){this.desiredSize=clamp(this.desiredSize*factor,6,76);}
  rotate(dx,dy=0){this.desiredYaw-=dx*.006;this.desiredPitch=clamp(this.desiredPitch+dy*.004,.43,1.40);}
  turn(dYaw,dPitch=0){this.desiredYaw+=dYaw;this.desiredPitch=clamp(this.desiredPitch+dPitch,.43,1.40);}
  /** Bring the yaw back within one turn of the start view, so a reset never spins the camera round and round. */
  normalizeYaw(){
    const wrap=a=>a-Math.round((a-.66)/(Math.PI*2))*Math.PI*2;
    const shift=wrap(this.yaw)-this.yaw;this.yaw+=shift;this.desiredYaw+=shift;
  }
  pan(dx,dy){
    const scale=this.viewSize/Math.max(1,this.kit.size.height),cy=Math.cos(this.yaw),sy=Math.sin(this.yaw);
    this.target.x=clamp(this.target.x-dx*scale*cy-dy*scale*sy/Math.sin(this.pitch),-half-5,half+5);
    this.target.z=clamp(this.target.z+dx*scale*sy-dy*scale*cy/Math.sin(this.pitch),-half-5,half+5);
  }
  addShake(amount){this.shake=Math.min(1.2,this.shake+amount);}
  /** NDC height of the band centre: where the camera target appears, and where the gamepad reticle sits. */
  centreNdcY(){return this.bandNdc;}
  updateCamera(dt){
    const a=1-Math.exp(-dt*12);this.yaw+=(this.desiredYaw-this.yaw)*a;this.pitch+=(this.desiredPitch-this.pitch)*a;
    this.viewSize+=(this.desiredSize-this.viewSize)*a;
    const W=this.kit.size.width||1200,H=this.kit.size.height||800,aspect=W/H,h=this.viewSize/2;
    const bandNdc=this.band.bottom>this.band.top?clamp(1-(this.band.top+this.band.bottom)/H,-.6,.6):0;
    this.bandNdc+=(bandNdc-this.bandNdc)*a;
    const shift=-this.bandNdc*h;
    this.camera.left=-h*aspect;this.camera.right=h*aspect;this.camera.top=h+shift;this.camera.bottom=-h+shift;
    this.shake=Math.max(0,this.shake-dt*1.6);
    const s=this.shake*this.shake*.35;
    this.shakeOffset.set((Math.random()-.5)*s,(Math.random()-.5)*s*.5,(Math.random()-.5)*s);
    this.camera.position.set(this.target.x+Math.sin(this.yaw)*Math.cos(this.pitch)*70,this.target.y+Math.sin(this.pitch)*70,this.target.z+Math.cos(this.yaw)*Math.cos(this.pitch)*70);
    this.camera.lookAt(this.target);this.camera.position.add(this.shakeOffset);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
  }
  /** The world point under a position in normalised device coordinates (-1..1, y up). */
  pick(nx,ny){
    this.pointer.set(nx,ny);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const hits=this.raycaster.intersectObjects(this.pickTargets,false);
    for(const hit of hits){const x=hit.point.x+half,z=hit.point.z+half;if(x>=0&&z>=0&&x<SIZE&&z<SIZE)return {x,z,y:hit.point.y};}
    return null;
  }
  setCursor(p,tool='raise'){
    this.cursor.visible=!!p;if(!p)return;
    const x=Math.floor(p.x)+.5,z=Math.floor(p.z)+.5;
    this.cursor.position.set(x-half,Math.max(this.world.heightAt(x,z),this.world.sea*HEIGHT)+.09,z-half);
    const scale=['quake','volcano'].includes(tool)?5:tool==='swamp'||tool==='level'?3:1;
    this.cursor.scale.set(scale,1,scale);
    this.mats.cursor.color.set(['swamp','quake','volcano'].includes(tool)?'#ffc096':'#e2f4b2');
  }
  terrainColor(x,z,h,out){
    const w=this.world,i=w.ci(x,z),n=hash(x,z,w.seed);
    if(w.scars[i]>0)return out.copy(C_SCAR).multiplyScalar(.8+n*.24);
    if(w.swamp[i]>0)return out.copy(C_SWAMP).multiplyScalar(.73+n*.22);
    if(h<1.2)return out.copy(C_SAND).multiplyScalar(.92+n*.1);
    if(h>7)return out.copy(C_SNOW).multiplyScalar(.94+n*.06);
    if(h>5.3)return out.copy(C_ROCK).multiplyScalar(.85+n*.18);
    // Ashen Reach keeps the palette but its grass is dry and pale.
    if(w.scenario==='ashen')return out.setHSL(.15+n*.03,.17+n*.06,.45+Math.min(h,4)*.016+n*.05);
    return out.setHSL(.226+n*.025,.27+n*.07,.46+Math.min(h,4)*.018+n*.05);
  }
  rebuildTerrain(){
    const w=this.world,P=this.tPos.array,N=this.tNor.array,C=this.tCol.array,{outer,inner,centre,col}=this.scratch;let v=0;
    const set=(o,x,y,z)=>{o[0]=x-half;o[1]=y;o[2]=z-half;};
    // Flat-shaded triangles; the normal is (c - b) × (a - b), as computeVertexNormals gives.
    const put=(p,nx,ny,nz,r,g,bl)=>{const o=v*3;P[o]=p[0];P[o+1]=p[1];P[o+2]=p[2];N[o]=nx;N[o+1]=ny;N[o+2]=nz;C[o]=r;C[o+1]=g;C[o+2]=bl;v++;};
    const tri=(a,b,c,r,g,bl)=>{
      const ux=c[0]-b[0],uy=c[1]-b[1],uz=c[2]-b[2],vx=a[0]-b[0],vy=a[1]-b[1],vz=a[2]-b[2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
      put(a,nx,ny,nz,r,g,bl);put(b,nx,ny,nz,r,g,bl);put(c,nx,ny,nz,r,g,bl);
    };
    const e=.032;
    for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
      const h0=w.vertex(x,z),h1=w.vertex(x+1,z),h2=w.vertex(x+1,z+1),h3=w.vertex(x,z+1);
      if(Math.max(h0,h1,h2,h3)<w.sea-.6)continue;
      const avg=(h0+h1+h2+h3)/4;this.terrainColor(x,z,avg,col);
      set(outer[0],x,h0*HEIGHT-.045,z);set(outer[1],x+1,h1*HEIGHT-.045,z);set(outer[2],x+1,h2*HEIGHT-.045,z+1);set(outer[3],x,h3*HEIGHT-.045,z+1);
      set(inner[0],x+e,w.heightAt(x+e,z+e),z+e);set(inner[1],x+1-e,w.heightAt(x+1-e,z+e),z+e);
      set(inner[2],x+1-e,w.heightAt(x+1-e,z+1-e),z+1-e);set(inner[3],x+e,w.heightAt(x+e,z+1-e),z+1-e);
      set(centre,x+.5,avg*HEIGHT,z+.5);
      for(let j=0;j<4;j++){
        const k=(j+1)%4,f=j%2?.98:1.02;
        tri(inner[k],inner[j],centre,col.r*f,col.g*f,col.b*f);
        tri(outer[k],outer[j],inner[j],col.r*.86,col.g*.86,col.b*.86);tri(outer[k],inner[j],inner[k],col.r*.86,col.g*.86,col.b*.86);
      }
    }
    const geo=this.terrain.geometry;geo.setDrawRange(0,v);
    for(const a of [this.tPos,this.tNor,this.tCol]){a.clearUpdateRanges();a.addUpdateRange(0,v*3);a.needsUpdate=true;}
    this.water.position.y=w.sea*HEIGHT-.012;
    this.waterLines.position.y=w.sea*HEIGHT;
    this.buildShore();this.buildGrid();this.decorDirty=true;
  }
  buildShore(){
    const p=[],w=this.world,y=w.sea*HEIGHT+.022;
    for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
      const h=w.corners(x,z),coords=[[x,z],[x+1,z],[x+1,z+1],[x,z+1]],cross=[];
      for(let e=0;e<4;e++){
        const n=(e+1)%4;if((h[e]>w.sea)===(h[n]>w.sea))continue;
        const t=(w.sea-h[e])/(h[n]-h[e]);cross.push([coords[e][0]+(coords[n][0]-coords[e][0])*t-half,coords[e][1]+(coords[n][1]-coords[e][1])*t-half]);
      }
      for(let j=0;j+1<cross.length;j+=2){
        const [a,b]=[cross[j],cross[j+1]],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1,nx=-dz/len*.07,nz=dx/len*.07;
        p.push(a[0]-nx,y,a[1]-nz,b[0]+nx,y,b[1]+nz,b[0]-nx,y,b[1]-nz,a[0]-nx,y,a[1]-nz,a[0]+nx,y,a[1]+nz,b[0]+nx,y,b[1]+nz);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();
    if(this.shore){this.shore.geometry.dispose();this.shore.geometry=g;}else{this.shore=new THREE.Mesh(g,this.mats.foam);this.scene.add(this.shore);}
  }
  buildGrid(){
    const arr=[],w=this.world;
    for(let z=0;z<=SIZE;z++)for(let x=0;x<=SIZE;x++){
      const y=Math.max(w.vertex(x,z)*HEIGHT,w.sea*HEIGHT)+.022;
      if(x<SIZE)arr.push(x-half,y,z-half,x+1-half,Math.max(w.vertex(x+1,z)*HEIGHT,w.sea*HEIGHT)+.022,z-half);
      if(z<SIZE)arr.push(x-half,y,z-half,x-half,Math.max(w.vertex(x,z+1)*HEIGHT,w.sea*HEIGHT)+.022,z+1-half);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    if(this.grid){this.grid.geometry.dispose();this.grid.geometry=geo;}
    else{this.grid=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#d4e5b6',transparent:true,opacity:.3,depthWrite:false}));this.scene.add(this.grid);}
    this.grid.visible=this.gridShown;
  }
  toggleGrid(){this.gridShown=!this.gridShown;if(this.grid)this.grid.visible=this.gridShown;return this.gridShown;}
  rebuildDecor(){
    const w=this.world,d=this.decor;for(const b of Object.values(d))b.reset();let trees=0;
    for(let z=1;z<SIZE-1;z++)for(let x=1;x<SIZE-1;x++){
      const flat=w.flat(x,z),h=w.cellHeight(x,z),n=hash(x,z,w.seed),y=w.heightAt(x+.5,z+.5);
      if(h<=w.sea+.4||w.scars[w.ci(x,z)]>0||w.swamp[w.ci(x,z)]>0)continue;
      const near=w.towns.find(t=>Math.abs(t.x-x)<=2&&Math.abs(t.z-z)<=2);
      if(near){
        const occupied=w.towns.some(t=>t.x===x&&t.z===z);
        if(flat&&!occupied&&w.vertex(x,z)===w.vertex(near.x,near.z)){
          d.soil.add(x+.5-half,y+.015,z+.5-half,.76,.025,.76);
          for(let line=0;line<4;line++)d.crop.add(x+.23+line*.18-half,y+.06,z+.5-half,.045,.09,.64);
        }
      }else if(h<5.2&&n>.61&&trees<this.maxTrees){
        const tx=x+.28+hash(z,x)*.44-half,tz=z+.28+hash(x,3*z)*.44-half;
        const size=.65+hash(x+2,z)*.65;d.trunks.add(tx,y+.28*size,tz,.13*size,.56*size,.13*size);
        if(n>.79){
          d.pines.add(tx,y+.68*size,tz,.7*size,.7*size,.7*size,Math.PI/4);
          d.pines.add(tx,y+.99*size,tz,.54*size,.65*size,.54*size,Math.PI/4);
          d.pines.add(tx,y+1.24*size,tz,.34*size,.5*size,.34*size,Math.PI/4);
        }else{
          d.oaks.add(tx,y+.72*size,tz,.62*size,.60*size,.60*size,0);
          d.oaks.add(tx+.19*size,y+.91*size,tz-.07,.45*size,.36*size,.45*size,0);
          d.oaks.add(tx-.19*size,y+.69*size,tz+.12,.4*size,.33*size,.40*size,0);
        }
        trees++;
      }else if(h>4.4&&n>.53){d.rocks.add(x+.5-half,y+.13,z+.5-half,.33+n*.40,.25+n*.34,.30+n*.35,n*6);}
      if(flat&&!near&&h<5.5){
        d.studs.add(x+.32-half,y+.025,z+.32-half);d.studs.add(x+.68-half,y+.025,z+.68-half);
      }
    }
    for(const b of Object.values(d))b.finish();
  }
  rebuildTowns(){
    const b=this.buildings,w=this.world;for(const batch of Object.values(b))batch.reset();
    for(const t of w.towns){
      const x=t.x+.5-half,z=t.z+.5-half,y=w.vertex(t.x,t.z)*HEIGHT,tier=t.tier,team=t.team;
      const add=(m,dx,dy,dz,sx,sy,sz,ry=0)=>b[m].add(x+dx,y+dy,z+dz,sx,sy,sz,ry);
      add('foundation',0,.045,0,.91,.09,.91);
      if(tier<=2){
        const h=tier===1?.32:.48;
        add('walls',0,h/2+.09,0,.62,h,.58);
        add('gable'+team,0,h+.09,0,.82,.61,.79,team?Math.PI/2:0);
        add('door',0,.2,.299,.13,.23,.02);
        if(tier===2){add('door',-.20,.40,.301,.095,.105,.025);add('darkWall',.23,.62,-.14,.13,.34,.13);}
      }else if(tier===3){
        add('walls',-.12,.39,0,.54,.61,.64);
        add('gable'+team,-.12,.69,0,.73,.53,.81);
        add('walls',.24,.53,-.10,.29,.90,.37);
        add('spire'+team,.24,1.13,-.10,.50,.39,.52,Math.PI/4);
        add('door',-.12,.25,.327,.14,.30,.02);add('door',.245,.76,.093,.10,.19,.018);
        add('door',-.31,.48,.326,.07,.12,.02);
      }else{
        add('walls',0,.38,0,.78,.63,.76);
        add('roof'+team,0,.72,0,.69,.09,.66);
        for(const dx of [-.34,.34])for(const dz of [-.34,.34]){
          add('walls',dx,.48,dz,.23,.80,.23);
          add('spire'+team,dx,1.0,dz,.38,.33,.38,Math.PI/4);
          add('door',dx,.64,dz+.125,.045,.13,.015);
        }
        for(let i=0;i<4;i++){add('walls',-.22+i*.15,.84,.39,.095,.18,.12);add('walls',-.22+i*.15,.84,-.39,.095,.18,.12);}
        add('door',0,.26,.387,.17,.31,.025);
        add('walls',0,.82,-.06,.28,.65,.29);add('spire'+team,0,1.27,-.06,.49,.37,.49,Math.PI/4);
      }
      const flagY=tier===4?1.55:tier===3?1.33:.98;
      add('gold',.14,flagY,-.09,.024,.40,.024);add('flag'+team,.245,flagY+.1,-.09,.23,.14,.025);
    }
    for(const batch of Object.values(b))batch.finish();
    this.decorDirty=true;
  }
  /** Walkers, eased between the last two simulation steps (alpha 0..1). */
  updatePeople(time,alpha){
    const w=this.world,b=this.people,f=this.figure;for(const batch of Object.values(b))batch.reset();
    for(const u of w.units){
      const size=u.knight?1.28:u.leader?1.08:1;
      const ux=u.px===undefined?u.x:u.px+(u.x-u.px)*alpha,uz=u.pz===undefined?u.z:u.pz+(u.z-u.pz)*alpha;
      f.x=ux-half;f.z=uz-half;f.y=w.heightAt(ux,uz)+.025;f.size=size;f.angle=u.facing;f.ca=Math.cos(u.facing);f.sa=Math.sin(u.facing);
      const swing=u.path.length&&u.attack===0?Math.sin(time*11+u.id)*.055:0,team=u.team;
      this.part('boots',-.054,.085+swing,0,.075,.17,.095);this.part('boots',.054,.085-swing,0,.075,.17,.095);
      this.part(u.knight?'armor':team?'flag1':'flag0',0,.265,0,.205,.22,.14);
      this.part('skin',0,.438,0,.162,.162,.15);
      this.part(team?'flag1':'flag0',0,.524,0,.175,.045,.17);
      this.part('skin',-.14,.25-swing,0,.065,.15,.065);this.part('skin',.14,.25+swing,0,.065,.15,.065);
      if(u.leader){this.part('gold',0,.565,0,.195,.06,.19);this.part('gold',0,.63,0,.04,.10,.04);}
      if(u.knight){this.part('armor',0,.51,0,.19,.1,.18);this.part('gold',.15,.29,.07,.045,.44,.045);this.part(team?'flag1':'flag0',-.18,.30,.06,.08,.24,.22);}
    }
    for(const batch of Object.values(b))batch.finish();
  }
  /** One box of the current walker, turned to face where it walks. */
  part(m,dx,dy,dz,sx,sy,sz){
    const f=this.figure,s=f.size,wx=dx*f.ca+dz*f.sa,wz=-dx*f.sa+dz*f.ca;
    this.people[m].add(f.x+wx*s,f.y+dy*s,f.z+wz*s,sx*s,sy*s,sz*s,f.angle);
  }
  emit(event){
    const x=event.x-half,z=event.z-half;
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const y=this.world.heightAt(event.x,event.z)+.1;
    const power=event.type==='power',strong=power&&['quake','volcano','armageddon','flood'].includes(event.tool);
    const count=strong?75:power?17:event.type==='town'||event.type==='upgrade'?14:event.type==='clash'?3:8;
    const list=this.particles;
    for(let i=0;i<count&&this.particleCount<this.maxParticles;i++){
      const a=Math.random()*Math.PI*2,speed=(strong?1.7:.6)+Math.random()*(strong?3:1);
      let p=list[this.particleCount];if(!p)p=list[this.particleCount]={};
      p.x=x;p.y=y;p.z=z;p.vx=Math.cos(a)*speed;p.vz=Math.sin(a)*speed;p.vy=1.1+Math.random()*(strong?4:1.5);
      p.life=1;p.decay=.5+Math.random()*.8;p.size=strong?.10:event.type==='clash'?.04:.055;
      this.particleCount++;
    }
    if(strong)this.addShake(event.tool==='armageddon'?1.1:event.tool==='flood'?.35:.75);
    if(event.type==='power'&&event.team===0)this.setCursor({x:event.x,z:event.z},event.tool);
  }
  updateParticles(dt){
    this.particleBatch.reset();const list=this.particles,sea=this.world.sea*HEIGHT;let n=0;
    // Compact in place: no per-frame arrays.
    for(let i=0;i<this.particleCount;i++){
      const p=list[i];
      p.life-=dt*p.decay;if(p.life<=0)continue;
      p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;p.vy-=3.8*dt;
      if(p.y<sea)continue;
      const s=p.size*Math.min(p.life*2,1);this.particleBatch.add(p.x,p.y,p.z,s,s,s,p.life*4);
      if(n!==i){list[i]=list[n];list[n]=p;}
      n++;
    }
    this.particleCount=n;this.particleBatch.finish();
  }
  sync(){
    if(this.terrainVersion!==this.world.terrainVersion){this.rebuildTerrain();this.terrainVersion=this.world.terrainVersion;}
    if(this.townVersion!==this.world.townVersion){this.rebuildTowns();this.townVersion=this.world.townVersion;}
    if(this.decorDirty){this.decorDirty=false;this.rebuildDecor();}
    for(let team=0;team<2;team++){
      const p=this.world.magnets[team],g=this.magnetMeshes[team];g.position.set(p.x-half,this.world.heightAt(p.x,p.z)+.025,p.z-half);
      g.visible=!this.world.armageddon;
    }
  }
  render(dt,time,alpha=1){
    this.clockNode.value=time;this.updateCamera(dt);this.sync();this.updatePeople(this.world.time,alpha);this.updateParticles(dt);
    for(let i=0;i<this.magnetMeshes.length;i++)this.magnetMeshes[i].children[2].scale.setScalar(1+Math.sin(time*2+i)*.07);
    if(this.pipeline&&this.effects){
      try{this.pipeline.render();return;}
      catch(error){console.warn('Extra effects disabled:',error);this.effects=false;}
    }
    this.renderer.render(this.scene,this.camera);
  }
  /** Screen position (NDC) of a point above the land; the vector is reused. */
  project(x,z){return this.projected.set(x-half,this.world.heightAt(x,z)+.8,z-half).project(this.camera);}
  stats(){
    const info=this.renderer.info.render;
    return {backend:this.backend,tier:this.tier?.name,effects:!!this.effects,ao:!!(this.effects&&TIER_LOOK[this.tier?.name]?.ao),drawCalls:info.drawCalls??info.calls??0,triangles:info.triangles??0};
  }
}
