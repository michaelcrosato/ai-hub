import * as THREE from 'three/webgpu';
import { attribute, instancedBufferAttribute } from 'three/tsl';
const PARTICLES=240, TRACERS=30, TRACE_LIFE=.07, CLOUDS=3, PUFFS=14, CANISTERS=3;
const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _e=new THREE.Euler(), _s=new THREE.Vector3(), _c=new THREE.Color(), _v=new THREE.Vector3();
const ZERO=new THREE.Matrix4().makeScale(0,0,0);
/**
 * Bounded pools keep a long burst from allocating unbounded meshes. Sparks, glass, brass, and
 * smoke are one instanced mesh (one draw call, per-instance colour and fade); tracers are one
 * line batch. Tear-gas canisters and clouds (new) are small fixed pools, created up front so
 * the first volley does not compile a new pipeline mid-fight.
 */
export class Effects {
  constructor(art){
    this.art=art;this.group=new THREE.Group();art.group.add(this.group);this.time=0;this.next=0;this.nextTrace=0;this.burns=[];
    // Particles: one InstancedMesh; colour per instance, opacity from an instanced attribute.
    this.alpha=new THREE.InstancedBufferAttribute(new Float32Array(PARTICLES),1);this.alpha.setUsage(THREE.DynamicDrawUsage);
    const pm=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false});pm.opacityNode=instancedBufferAttribute(this.alpha);this.particleMaterial=pm;
    this.particleMesh=new THREE.InstancedMesh(art.geometries.get('box'),pm,PARTICLES);this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;
    this.particles=[];
    for(let i=0;i<PARTICLES;i++){
      this.particleMesh.setMatrixAt(i,ZERO);this.particleMesh.setColorAt(i,_c.set('#ffd097'));
      this.particles.push({index:i,life:0,max:1,position:new THREE.Vector3(),velocity:new THREE.Vector3(),scale:new THREE.Vector3(1,1,1),rx:0,rz:0,gravity:8,kind:'spark'});
    }
    this.particleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);this.group.add(this.particleMesh);this.colorsDirty=false;
    // Tracers: one LineSegments batch with vertex colour and a per-vertex fade.
    const tg=new THREE.BufferGeometry();
    this.tracePos=new THREE.BufferAttribute(new Float32Array(TRACERS*6),3);this.traceColor=new THREE.BufferAttribute(new Float32Array(TRACERS*6),3);this.traceAlpha=new THREE.BufferAttribute(new Float32Array(TRACERS*2),1);
    for(const a of [this.tracePos,this.traceColor,this.traceAlpha])a.setUsage(THREE.DynamicDrawUsage);
    tg.setAttribute('position',this.tracePos);tg.setAttribute('color',this.traceColor);tg.setAttribute('alpha',this.traceAlpha);
    const tm=new THREE.LineBasicNodeMaterial({vertexColors:true,transparent:true,depthWrite:false});tm.opacityNode=attribute('alpha','float');this.traceMaterial=tm;
    this.traceLines=new THREE.LineSegments(tg,tm);this.traceLines.frustumCulled=false;this.group.add(this.traceLines);this.traceLife=new Float32Array(TRACERS);
    // One warm point light represents the active vehicle fires. It exists from the start (dark),
    // so the first disabled car does not change the light count and recompile every material.
    this.fireLight=new THREE.PointLight('#ff9440',0,25,2);this.group.add(this.fireLight);
    // Tear gas: canisters on a ballistic arc, then a slow grey cloud. T-800 optics hide gasGroup (the clouds).
    this.gasGroup=new THREE.Group();this.group.add(this.gasGroup);
    const canisterMat=art.mat('#9aa39a',.5,.5,.1);
    this.canisters=Array.from({length:CANISTERS},()=>{const mesh=art.mesh(this.group,'cylinder',[0,-50,0],[.07,.22,.07],canisterMat);mesh.visible=false;return {mesh,from:new THREE.Vector3(),to:new THREE.Vector3(),t:0,duration:1,active:false,trail:0};});
    this.clouds=Array.from({length:CLOUDS},()=>{
      const material=new THREE.SpriteMaterial({map:art.glowTexture,color:'#b9c4be',transparent:true,opacity:0,depthWrite:false});art.materials.set(art.key('gas'),material);
      const group=new THREE.Group();group.visible=false;this.gasGroup.add(group);
      const puffs=Array.from({length:PUFFS},(_,i)=>{const s=new THREE.Sprite(material);group.add(s);return {sprite:s,angle:i/PUFFS*Math.PI*2+Math.random()*.4,radius:.3+Math.random(),height:.2+Math.random()*1.8,size:2.2+Math.random()*1.8,drift:.2+Math.random()*.35};});
      return {group,material,puffs,center:new THREE.Vector3(),age:0,life:0,active:false};
    });
    this.onGasLanded=null;
    art.scope.own(()=>this.dispose());
  }
  particle(point,velocity,color,size,life,kind='spark'){
    const p=this.particles[this.next++%PARTICLES];
    p.position.copy(point);p.velocity.copy(velocity);p.scale.set(size,size,kind==='brass'?size*3:size);p.rx=p.rz=0;
    p.life=p.max=life;p.gravity=kind==='smoke'?-1:kind==='brass'?15:9;p.kind=kind;
    this.particleMesh.setColorAt(p.index,_c.set(color));this.colorsDirty=true;
    return p;
  }
  tracer(origin,end,color='#ffd7a1'){
    const i=this.nextTrace++%TRACERS;
    this.tracePos.setXYZ(i*2,origin.x,origin.y,origin.z);this.tracePos.setXYZ(i*2+1,end.x,end.y,end.z);
    _c.set(color);this.traceColor.setXYZ(i*2,_c.r,_c.g,_c.b);this.traceColor.setXYZ(i*2+1,_c.r,_c.g,_c.b);
    this.traceAlpha.setX(i*2,.85);this.traceAlpha.setX(i*2+1,.85);this.traceLife[i]=TRACE_LIFE;
    this.tracePos.needsUpdate=this.traceColor.needsUpdate=this.traceAlpha.needsUpdate=true;
  }
  impact(point,kind='concrete'){
    if(!point)return;
    const count=kind==='metal'?8:kind==='glass'?9:4;
    for(let i=0;i<count;i++)this.particle(point,_v.set((Math.random()-.5)*6,1+Math.random()*5,(Math.random()-.5)*6),kind==='metal'?'#ffe1a0':kind==='glass'?'#b6e0ea':kind==='rubber'?'#22313d':'#8fa2ac',.035+Math.random()*.03,.17+Math.random()*.36);
  }
  shot(camera){
    const pos=camera.localToWorld(_s.set(.54,-.27,-.4));
    const vel=_v.set(1.5+Math.random(),1.2+Math.random(),.9).applyQuaternion(camera.quaternion);
    this.particle(pos,vel,'#cbb077',.024,1.3,'brass');
  }
  destroy(v,restored=false){
    const point=new THREE.Vector3(...v.position);point.y=.9;
    const glow=this.art.glow(this.group,[point.x,point.y+.8,point.z],'#ff842a',4.7,.55);
    const pool=this.art.pool(this.group,[point.x,.06,point.z],'#ff6221',10,11,.2);
    this.fireLight.intensity=35;this.fireLight.position.set(point.x,3,point.z);
    this.burns.push({point,glow,pool,timer:0,phase:this.burns.length*1.3});
    if(!restored){
      for(let i=0;i<32;i++)this.particle(point,_v.set((Math.random()-.5)*11,2+Math.random()*11,(Math.random()-.5)*11),i%3?'#ffbd6b':'#3d484c',.07+Math.random()*.13,.5+Math.random()*1.2);
    }
  }
  /** Fire a tear-gas canister from `from`; it lands near `to` and opens a cloud there. */
  canister(from,to){
    const c=this.canisters.find(c=>!c.active);if(!c)return false;
    c.from.copy(from);c.to.copy(to);c.t=0;c.duration=.9+from.distanceTo(to)/40;c.active=true;c.trail=0;c.mesh.visible=true;c.mesh.position.copy(from);
    return true;
  }
  cloud(point){
    let cloud=this.clouds.find(c=>!c.active);
    if(!cloud)cloud=this.clouds.reduce((a,b)=>a.age>b.age?a:b);
    cloud.center.copy(point);cloud.age=0;cloud.life=15;cloud.active=true;cloud.group.visible=true;cloud.group.position.copy(point);
    for(const p of cloud.puffs){p.sprite.position.set(Math.cos(p.angle)*p.radius*.3,p.height*.3,Math.sin(p.angle)*p.radius*.3);p.sprite.scale.setScalar(.4);}
    cloud.material.opacity=0;
  }
  /** 0..1: how thick the gas is at a point (the camera), for the screen haze. */
  gasAt(point){
    let d=0;
    for(const c of this.clouds){
      if(!c.active)continue;
      const grow=Math.min(1,c.age/2.5),fade=Math.min(1,(c.life-c.age)/3),radius=1.2+grow*3.6;
      const dx=point.x-c.center.x,dz=point.z-c.center.z,dy=Math.max(0,Math.abs(point.y-(c.center.y+1))-1.5);
      const dist=Math.hypot(dx,dz,dy),k=Math.max(0,1-dist/radius);
      d=Math.max(d,Math.min(1,k*1.6)*grow*fade);
    }
    return d;
  }
  clearGas(){
    for(const c of this.canisters){c.active=false;c.mesh.visible=false;}
    for(const c of this.clouds){c.active=false;c.group.visible=false;c.material.opacity=0;}
  }
  render(dt){
    this.time+=dt;
    // Tracers fade over TRACE_LIFE seconds.
    let traceDirty=false;
    for(let i=0;i<TRACERS;i++){
      if(this.traceLife[i]<=0)continue;
      this.traceLife[i]-=dt;const a=this.traceLife[i]>0?this.traceLife[i]/TRACE_LIFE*.75:0;
      this.traceAlpha.setX(i*2,a);this.traceAlpha.setX(i*2+1,a);traceDirty=true;
    }
    if(traceDirty)this.traceAlpha.needsUpdate=true;
    // Particles.
    let moved=false;
    for(const p of this.particles){
      if(p.life<=0)continue;moved=true;p.life-=dt;
      if(p.life<=0){this.particleMesh.setMatrixAt(p.index,ZERO);this.alpha.setX(p.index,0);continue;}
      p.velocity.y-=p.gravity*dt;p.position.addScaledVector(p.velocity,dt);
      if(p.kind==='smoke')p.scale.multiplyScalar(1+dt*.55);else {p.rx+=dt*6;p.rz+=dt*4;}
      if(p.position.y<.04&&p.kind!=='smoke'){p.position.y=.04;p.velocity.y=Math.abs(p.velocity.y)*.28;p.velocity.x*=.8;p.velocity.z*=.8;}
      _q.setFromEuler(_e.set(p.rx,0,p.rz));_m.compose(p.position,_q,p.scale);this.particleMesh.setMatrixAt(p.index,_m);this.alpha.setX(p.index,p.life/p.max);
    }
    if(moved){this.particleMesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;}
    if(this.colorsDirty){this.particleMesh.instanceColor.needsUpdate=true;this.colorsDirty=false;}
    // Vehicle fires.
    for(const b of this.burns){
      b.timer-=dt;const f=.75+Math.sin(this.time*17+b.phase)*.14;
      b.glow.scale.set(4.5*f,5.5*f,1);b.glow.material.opacity=.4*f;b.pool.material.opacity=.25*f;
      if(b.timer<=0&&dt>0){
        b.timer=.14;
        const p=_s.copy(b.point).add(_v.set((Math.random()-.5)*1.2,.5,(Math.random()-.5)*2));
        this.particle(p,_v.set(.45,2+Math.random(),.2),'#69727a',.5,3,'smoke');
        this.particle(p,_v.set((Math.random()-.5),2+Math.random()*2,(Math.random()-.5)),'#ff9d40',.2,.65,'flame');
      }
    }
    // Tear-gas canisters: a lobbed arc with a thin smoke trail.
    for(const c of this.canisters){
      if(!c.active)continue;
      c.t+=dt;const k=Math.min(1,c.t/c.duration);
      c.mesh.position.lerpVectors(c.from,c.to,k);c.mesh.position.y+=Math.sin(k*Math.PI)*(2.5+c.from.distanceTo(c.to)*.08);
      c.mesh.rotation.x+=dt*9;c.trail-=dt;
      if(c.trail<=0&&dt>0){c.trail=.05;this.particle(c.mesh.position,_v.set(0,.4,0),'#c9d0cb',.12,.9,'smoke');}
      if(k>=1){c.active=false;c.mesh.visible=false;this.cloud(c.to);this.onGasLanded?.(c.to);}
    }
    // Tear-gas clouds grow, drift, and thin out.
    for(const c of this.clouds){
      if(!c.active)continue;
      c.age+=dt;
      if(c.age>=c.life){c.active=false;c.group.visible=false;c.material.opacity=0;continue;}
      const grow=Math.min(1,c.age/2.5),fade=Math.min(1,(c.life-c.age)/3);
      c.material.opacity=.34*grow*fade;
      for(const p of c.puffs){
        p.angle+=dt*p.drift*.25;const r=(.3+grow*p.radius*3.2);
        p.sprite.position.set(Math.cos(p.angle)*r,p.height*(.4+grow*.8),Math.sin(p.angle)*r);
        p.sprite.scale.setScalar(p.size*(.35+grow*.9));
      }
    }
  }
  clearBurns(){
    for(const b of this.burns){for(const o of [b.glow,b.pool]){o.removeFromParent();this.art.release(o.material);}}
    this.burns.length=0;this.fireLight.intensity=0;
    for(const p of this.particles){if(p.life>0){p.life=0;this.particleMesh.setMatrixAt(p.index,ZERO);this.alpha.setX(p.index,0);}}
    this.particleMesh.instanceMatrix.needsUpdate=true;this.alpha.needsUpdate=true;
    this.clearGas();
  }
  /** Objects that appear later: shown for one compile pass so their pipelines exist before play. */
  prewarm(){
    const list=[this.particleMesh,this.traceLines,...this.canisters.map(c=>c.mesh),...this.clouds.map(c=>c.group)];
    return list;
  }
  dispose(){
    this.traceLines.geometry.dispose();this.traceMaterial.dispose();this.particleMaterial.dispose();this.particleMesh.dispose();this.group.removeFromParent();
  }
}
