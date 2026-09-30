import * as THREE from 'three/webgpu';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { VEHICLE_TYPES, vehiclePartSpecs, partState, damagePart, driveState, cleanPartSave } from './vehicle-parts.js';
const V=()=>new THREE.Vector3(),Q=()=>new THREE.Quaternion();
const METAL=new Set(['panel','frame','door','grille','engine','radiator','armor','rim','wheel','trim']);
/** Component collision, hinged doors, damage, and bounded rigid-body debris for this episode. */
export class DestructibleFleet {
  constructor(game,art,effects,scope,callbacks={}){
    this.game=game;this.art=art;this.effects=effects;this.callbacks=callbacks;this.physics=game.runtime.physics;
    this.cars=new Map();this.partsByCollider=new Map();this.debris=[];this.time=0;this.maxDebris=128;this.partBreaks=0;
    this.tireGeometry=new THREE.TorusGeometry(.75,.25,7,24);this.tireGeometry.rotateX(Math.PI/2);
    this.glassMaterial=new THREE.MeshStandardMaterial({color:'#709bad',metalness:.16,roughness:.16,transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false});
    this.dentMaterial=new THREE.LineBasicMaterial({color:'#0b151e'});
    this.crackMaterial=new THREE.LineBasicMaterial({color:'#cfe9ed',transparent:true,opacity:.9,depthWrite:false});
    this.shardGeometry=new THREE.BufferGeometry();this.shardGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.4,0,.5,-.2,0,0,.6,.02],3));this.shardGeometry.computeVertexNormals();
    this.textures=[];this.decals=new Map();scope.own(()=>this.dispose());
  }
  get remaining(){let n=0;for(const v of this.cars.values())if(!v.disabled)n++;return n;}
  decal(text){
    if(this.decals.has(text))return this.decals.get(text);
    const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
    x.fillStyle='#e1e9e8';x.fillRect(0,0,512,128);x.strokeStyle='#153149';x.lineWidth=5;x.strokeRect(4,4,504,120);
    x.fillStyle='#163249';x.font='bold 74px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,69,490);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;this.textures.push(tex);
    const mat=new THREE.MeshStandardMaterial({map:tex,roughness:.55,metalness:.1,side:THREE.DoubleSide});this.decals.set(text,mat);return mat;
  }
  add(spec,saved=null,existing=null){
    const info=VEHICLE_TYPES[spec.type??'patrol'],definitions=vehiclePartSpecs(spec.type??'patrol');
    let entity=existing;
    if(entity){for(const c of entity.colliders){this.physics.owners.delete(c.handle);this.physics.world.removeCollider(c,true);}entity.colliders.length=0;entity.root.clear();}
    else{
      const root=new THREE.Group();root.name=spec.id;this.game.view.entities.add(root);
      const data={id:spec.id,name:info.label,prefab:'patrol',position:[...spec.position],rotation:[0,spec.yaw,0],scale:[1,1,1],components:[]};
      entity=this.physics.create(data,{body:'kinematic',visuals:[],colliders:[]},root);
    }
    entity.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);
    const v={...spec,type:spec.type??'patrol',info,entity,parts:new Map(),disabled:false,hull:240*info.armor*(spec.strength??1),maxHull:240*info.armor*(spec.strength??1),resources:new Set(),geometries:new Set(),lights:[],pools:[],age:0,arriving:!existing&&!saved,arrival:-(spec.arrivalDelay??0),parked:!!existing||!!saved,position:[...spec.position],target:new THREE.Vector3(...spec.position),baseYaw:spec.yaw*Math.PI/180,drive:{flat:0,lost:0,speed:1},leak:0};
    this.cars.set(v.id,v);
    if(v.arriving){v.start=new THREE.Vector3(spec.position[0]<0?-36:36,0,spec.position[2]);v.entity.body.setTranslation(v.start,true);v.position=v.start.toArray();}
    v.entity.root.position.fromArray(v.position);v.entity.root.rotation.set(0,v.baseYaw,0);v.entity.root.updateMatrixWorld(true);
    for(const s of definitions){
      const group=new THREE.Group();group.position.fromArray(s.pos);group.rotation.set(...s.rot);
      const parent=s.parent?v.parts.get(s.parent).group:entity.root;parent.add(group);
      let material=s.kind==='glass'?this.glassMaterial:this.art.mat(s.color,s.kind==='tire'?.0:METAL.has(s.kind)?.5:.12,s.kind==='tire'?.92:s.kind==='lamp'?.22:.5,s.emissive??0);
      const geometry=s.shape==='tire'?this.tireGeometry:s.shape==='ring'?this.art.geometries.get('ring'):s.shape==='cylinder'?this.art.geometries.get('cylinder'):this.art.geometries.get('box');
      const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;
      if(s.shape==='cylinder')mesh.scale.set(s.size[0]/2,s.size[1],s.size[2]/2);
      else if(s.shape==='tire')mesh.scale.set(s.size[0]/2,s.size[1]*2,s.size[2]/2);
      else if(s.shape==='ring'){mesh.scale.set(s.size[0]/2,s.size[2]/2,s.size[1]*3);mesh.rotation.x=Math.PI/2;}
      else mesh.scale.fromArray(s.size);
      if(s.offset)mesh.position.fromArray(s.offset);group.add(mesh);
      const part={vehicle:v,spec:s,state:partState(s),group,mesh,colliders:[],body:entity.body,children:[],angle:0,targetAngle:0,marks:[],gone:false,debris:null};
      v.parts.set(s.id,part);mesh.userData.partId=s.id;mesh.userData.vehicleId=v.id;
      if(s.parent)v.parts.get(s.parent).children.push(part);
      if(s.kind==='door'){part.angle=v.parked?s.open:0;part.targetAngle=part.angle;group.rotation.y=part.angle;
        this.art.box(group,[-s.side*.048,0,s.offset[2]],[.06,.43,s.size[2]*.94],'#253e4d',.1,.8);
        const label=new THREE.Mesh(this.art.geometries.get('plane'),this.decal(v.type==='armored'?'RESPONSE':v.type==='van'?'TACTICAL':'POLICE'));
        label.position.set(s.side*.052,.04,s.offset[2]);label.rotation.y=s.side*Math.PI/2;label.scale.set(s.size[2]*.86,.22,1);group.add(label);
      }
      if(s.kind==='rim'){
        for(let n=0;n<5;n++){const a=n*Math.PI*2/5;this.art.mesh(group,'cylinder',[Math.cos(a)*.14,-s.pos[1]+(s.pos[1]>0?1:-1)*.156,Math.sin(a)*.14],[.035,.025,.035],this.art.mat('#c8d2d3',.8,.25));}
      }
      if(s.id==='engine')for(let k=0;k<6;k++)this.art.box(group,[(k-2.5)*.14,.28,0],[.075,.05,s.size[2]*.85],'#a2aeb4',.75,.32);
      if(s.id==='radiator')for(let k=0;k<9;k++)this.art.box(group,[(k-4)*s.size[0]/10,0,-.075],[.02,s.size[1]*.88,.02],'#8b9da5',.8,.35);
      if(s.beacon){const glow=this.art.glow(group,[0,0,0],s.color,1.25,.65);v.lights.push({part,glow,phase:Number(s.id.split('-')[1])});}
    }
    entity.root.updateMatrixWorld(true);
    for(const p of v.parts.values())this.makeColliders(p,entity.body);
    for(const side of [-1,1]){const pool=this.art.pool(entity.root,[side*1.1,.045,.2],side<0?'#ff283f':'#237fff',6,9,.18);v.pools.push(pool);}
    if(saved)this.restoreVehicle(v,saved);
    this.setEntityPose(entity,new THREE.Vector3(...v.position),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,v.baseYaw,0)),true);
    return v;
  }
  setEntityPose(e,pos,rot,immediate=false){
    if(immediate){e.body.setTranslation(pos,true);e.body.setRotation(rot,true);e.current.copy(pos);e.previous.copy(pos);e.currentRotation.copy(rot);e.previousRotation.copy(rot);e.root.position.copy(pos);e.root.quaternion.copy(rot);}
    e.body.setNextKinematicTranslation(pos);e.body.setNextKinematicRotation(rot);
  }
  relative(part,body,offset=[0,0,0],extraRot=null){
    part.group.updateWorldMatrix(true,false);const p=new THREE.Vector3(...offset);part.group.localToWorld(p);
    const q=part.group.getWorldQuaternion(Q());if(extraRot)q.multiply(extraRot);
    const bp=body.translation(),bq=body.rotation(),inv=new THREE.Quaternion(bq.x,bq.y,bq.z,bq.w).invert();
    p.sub(new THREE.Vector3(bp.x,bp.y,bp.z)).applyQuaternion(inv);q.premultiply(inv);return {p,q};
  }
  makeColliders(part,body){
    if(part.gone)return;const s=part.spec;part.body=body;
    const add=(desc,offset=s.offset??[0,0,0],extraRot=null)=>{
      const pose=this.relative(part,body,offset,extraRot);desc.setTranslation(pose.p.x,pose.p.y,pose.p.z).setRotation(pose.q).setFriction(s.kind==='tire'?1.3:.65).setRestitution(s.kind==='glass'?.2:.12).setDensity(s.kind==='glass'?1:s.kind==='tire'?3:6);
      const collider=this.physics.world.createCollider(desc,body);part.colliders.push({collider,offset,extraRot});this.partsByCollider.set(collider.handle,part);this.physics.owners.set(collider.handle,part.vehicle.id);
    };
    if(s.shape==='tire'){
      for(let i=0;i<8;i++){const a=i*Math.PI/4,r=s.radius*.76;add(RAPIER.ColliderDesc.cuboid(s.radius*.24,s.size[1]/2,s.radius*.33),[Math.cos(a)*r,0,Math.sin(a)*r],new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-a));}
    }else if(s.shape==='cylinder')add(RAPIER.ColliderDesc.cylinder(s.size[1]/2,Math.max(s.size[0],s.size[2])/2));
    else add(RAPIER.ColliderDesc.cuboid(...s.size.map(n=>Math.max(.008,n/2))));
  }
  removeColliders(part){for(const {collider:c} of part.colliders){this.partsByCollider.delete(c.handle);this.physics.owners.delete(c.handle);if(c.isValid())this.physics.world.removeCollider(c,true);}part.colliders.length=0;}
  updateColliders(part){
    for(const {collider,offset,extraRot} of part.colliders){const t=this.relative(part,part.body,offset,extraRot);collider.setTranslationWrtParent(t.p);collider.setRotationWrtParent(t.q);}
    for(const child of part.children)if(!child.gone&&!child.debris)this.updateColliders(child);
  }
  descendants(part){const all=[part];for(const c of part.children)if(!c.debris&&!c.gone)all.push(...this.descendants(c));return all;}
  partFor(hit){return hit?this.partsByCollider.get(hit.collider.handle):null;}
  hit(hit,damage,point,direction){
    const part=this.partFor(hit);if(!part||part.gone)return false;
    const v=part.vehicle,s=part.spec,wasAttached=!part.debris;
    this.effects.impact(point,s.kind==='glass'?'glass':s.kind==='tire'?'rubber':'metal');
    this.callbacks.suppress?.(point,v.id);
    if(part.body.isDynamic())part.body.applyImpulseAtPoint(new THREE.Vector3().copy(direction).multiplyScalar(.8),point,true);
    if(part.state.hp<=0)return true;
    const result=damagePart(part.state,damage,s.kind);
    if(!part.debris&&METAL.has(s.kind))v.hull=Math.max(0,v.hull-damage*(s.kind==='engine'?1:s.kind==='frame'||s.kind==='armor'?.8:.22));
    this.damageVisual(part,point,direction);
    if(s.kind==='door'&&part.state.hp/part.state.max<.65)part.targetAngle=s.side*1.48;
    if(s.kind==='tire')this.flattenTire(part);
    if(result.broken){this.breakPart(part,point,direction);this.partBreaks++;this.callbacks.broken?.(part);}
    if(s.kind==='rim'&&result.broken&&wasAttached){const wheel=v.parts.get(s.parent);wheel.state.hp=0;this.breakPart(wheel,point,direction);}
    v.drive=driveState(v.parts);
    if(!v.disabled&&(v.drive.immobile||v.hull<=0))this.disable(v);
    return true;
  }
  damageVisual(part,point,direction){
    const s=part.spec;if(s.kind==='tire')return;
    if(!part.ownMaterial){const m=part.mesh.material.clone();part.vehicle.resources.add(m);part.mesh.material=m;part.ownMaterial=true;}
    const ratio=part.state.hp/part.state.max;
    if(s.kind==='glass'){part.mesh.material.opacity=.42+(1-ratio)*.36;this.addMark(part,point,true);return;}
    part.mesh.material.color.set(s.color).multiplyScalar(.55+.45*ratio);part.mesh.material.roughness=.5+(1-ratio)*.45;
    if(METAL.has(s.kind)&&s.shape==='box'&&Math.max(...s.size)>.4){
      if(!part.ownGeometry){const g=new THREE.BoxGeometry(1,1,1,5,4,5);part.vehicle.geometries.add(g);part.mesh.geometry=g;part.ownGeometry=true;}
      part.mesh.updateWorldMatrix(true,false);const p=part.mesh.worldToLocal(point.clone()),d=direction.clone().applyQuaternion(part.mesh.getWorldQuaternion(Q()).invert()).normalize(),a=part.mesh.geometry.attributes.position;
      for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),dist=Math.hypot(x-p.x,y-p.y,z-p.z);if(dist<.48){const dent=(.48-dist)*.065;a.setXYZ(i,Math.max(-.7,Math.min(.7,x+d.x*dent)),Math.max(-.7,Math.min(.7,y+d.y*dent)),Math.max(-.7,Math.min(.7,z+d.z*dent)));}}
      a.needsUpdate=true;part.mesh.geometry.computeVertexNormals();part.mesh.geometry.computeBoundingSphere();
    }
    this.addMark(part,point,false);
  }
  addMark(part,point,glass){
    if(part.marks.length>=4){const old=part.marks.shift();old.removeFromParent();old.geometry.dispose();part.vehicle.geometries.delete(old.geometry);}
    const s=part.spec,pos=part.group.worldToLocal(point.clone()),offset=new THREE.Vector3(...(s.offset??[0,0,0]));
    const axis=s.size.indexOf(Math.min(...s.size)),axes=[0,1,2].filter(a=>a!==axis),base=pos.toArray();
    base[axis]=offset.getComponent(axis)+(pos.getComponent(axis)-offset.getComponent(axis)>=0?1:-1)*(s.size[axis]/2+.004);
    const vertices=[];
    for(let i=0;i<(glass?7:5);i++){
      const a=i*Math.PI*2/(glass?7:5),length=glass?.09+(i%3)*.075:.025+(i%2)*.012,p=[...base],q=[...base];
      q[axes[0]]+=Math.cos(a)*length;q[axes[1]]+=Math.sin(a)*length;
      for(const k of axes)q[k]=Math.max(offset.getComponent(k)-s.size[k]/2,Math.min(offset.getComponent(k)+s.size[k]/2,q[k]));
      vertices.push(...p,...q);
      if(glass){const mid=p.map((n,j)=>(n+q[j])*.5),tip=[...q];tip[axes[0]]+=.045;vertices.push(...mid,...tip);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));part.vehicle.geometries.add(geometry);
    const line=new THREE.LineSegments(geometry,glass?this.crackMaterial:this.dentMaterial);line.renderOrder=3;part.group.add(line);part.marks.push(line);
  }
  flattenTire(p){
    if(p.flat)return;p.flat=true;
    const g=this.tireGeometry.clone();p.vehicle.geometries.add(g);p.mesh.geometry=g;
    const a=g.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i);if(x<-.38)a.setX(i,-.38+(x+.38)*.42);}a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    for(let i=0;i<5;i++)this.effects.particle(p.group.getWorldPosition(V()),new THREE.Vector3((Math.random()-.5)*2,1,(Math.random()-.5)*2),'#202b32',.04,.5,'rubber');
  }
  breakPart(part,point,direction,restored=false){
    if(part.gone||part.state.detached)return;
    if(part.spec.kind==='glass'||part.spec.kind==='lamp'||part.spec.kind==='tire'){
      if(!restored){
        const count=part.spec.kind==='glass'?16:7;
        for(let i=0;i<count;i++)this.effects.particle(point,new THREE.Vector3(direction.x*2+(Math.random()-.5)*4,1+Math.random()*4,direction.z*2+(Math.random()-.5)*4),part.spec.kind==='tire'?'#222e35':part.spec.color,.04+Math.random()*.08,.8+Math.random(),'glass');
        if(part.spec.kind==='glass')for(let i=0;i<3;i++)this.fragment(part.vehicle,point,direction,'glass');
        if(part.spec.kind==='lamp')this.callbacks.sound?.('glass');else if(part.spec.kind==='tire')this.callbacks.sound?.('tire');else this.callbacks.sound?.('glass');
      }
      this.removeColliders(part);part.group.visible=false;part.gone=true;
      return;
    }
    if(restored){this.hideAssembly(part);return;}
    this.detach(part,direction,point);
  }
  hideAssembly(p){for(const c of this.descendants(p)){this.removeColliders(c);c.gone=true;}p.group.visible=false;p.state.detached=true;}
  detach(part,direction,point){
    const all=this.descendants(part),oldDebris=part.debris;
    part.group.updateWorldMatrix(true,true);const pos=part.group.getWorldPosition(V()),quat=part.group.getWorldQuaternion(Q());
    for(const p of all)this.removeColliders(p);
    this.game.view.scene.attach(part.group);part.group.position.copy(pos);part.group.quaternion.copy(quat);part.group.updateMatrixWorld(true);
    const body=this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setRotation(quat).setLinearDamping(.15).setAngularDamping(.28).setCcdEnabled(true));
    const debris={body,group:part.group,parts:all,vehicle:part.vehicle,life:32,kind:part.spec.kind};
    for(const p of all){p.debris=debris;this.makeColliders(p,body);}
    if(oldDebris)oldDebris.parts=oldDebris.parts.filter(p=>!all.includes(p));
    part.state.detached=true;part.state.stage='detached';
    const outward=part.group.getWorldPosition(V()).sub(part.vehicle.entity.root.position);outward.y=0;outward.normalize();
    body.setLinvel({x:direction.x*1.7+outward.x*2.4,y:1.6+Math.random()*1.7,z:direction.z*1.7+outward.z*2.4},true);
    body.setAngvel({x:(Math.random()-.5)*4,y:(Math.random()-.5)*3,z:part.spec.kind==='wheel'?(part.spec.side??1)*5:(Math.random()-.5)*4},true);
    this.debris.push(debris);this.trimDebris();this.callbacks.sound?.('metal');
  }
  fragment(vehicle,point,direction,kind){
    const mesh=new THREE.Mesh(this.shardGeometry,this.glassMaterial);mesh.scale.set(.1+Math.random()*.24,.15+Math.random()*.24,1);mesh.position.copy(point);this.game.view.scene.add(mesh);
    const body=this.physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(point.x,point.y,point.z).setCcdEnabled(true).setLinearDamping(.2));
    this.physics.world.createCollider(RAPIER.ColliderDesc.ball(.055).setDensity(.2).setRestitution(.3),body);
    body.setLinvel({x:direction.x*2+(Math.random()-.5)*4,y:2+Math.random()*3,z:direction.z*2+(Math.random()-.5)*4},true);body.setAngvel({x:4,y:3,z:2},true);
    this.debris.push({body,group:mesh,parts:[],vehicle,life:8,kind});this.trimDebris();
  }
  trimDebris(){while(this.debris.length>this.maxDebris)this.removeDebris(this.debris[0]);}
  removeDebris(d){
    for(const p of d.parts){this.removeColliders(p);p.gone=true;p.group.visible=false;}
    d.group.removeFromParent();if(d.body.isValid())this.physics.world.removeRigidBody(d.body);
    const i=this.debris.indexOf(d);if(i>=0)this.debris.splice(i,1);
  }
  disable(v,restored=false){
    if(v.disabled)return;v.disabled=true;v.hull=0;v.arriving=false;v.parked=true;
    this.callbacks.disabled?.(v,restored);
  }
  openDoor(v,side){const d=v.parts.get(`door-${side<0?'l':'r'}f`);if(d&&!d.gone&&!d.debris)d.targetAngle=side*1.15;return d;}
  coverPoint(v,side){
    if(!v.parked)return null;
    const d=this.openDoor(v,side);if(!d||d.gone||d.debris)return null;
    v.entity.root.updateMatrixWorld(true);const center=d.group.localToWorld(new THREE.Vector3(0,0,d.spec.size[2]*.64));
    // The position is behind this particular door from the balcony, not a static car offset.
    const player=this.game.player.body.translation(),away=new THREE.Vector3(center.x-player.x,0,center.z-player.z).normalize();
    center.addScaledVector(away,.58);center.y=0;return {part:d,position:center};
  }
  step(dt){
    this.time+=dt;
    for(const d of [...this.debris]){d.life-=dt;if(d.life<=0||d.body.translation().y< -5)this.removeDebris(d);}
    for(const v of this.cars.values()){
      v.age+=dt;let moved=false;
      if(v.arriving&&!v.disabled){
        v.arrival+=dt;if(v.arrival>=0){
          const p=v.entity.body.translation(),current=new THREE.Vector3(p.x,p.y,p.z),delta=v.target.clone().sub(current),distance=delta.length();
          const speed=(v.type==='interceptor'?7:5.3)*(v.drive.speed??1);current.addScaledVector(delta.normalize(),Math.min(distance,speed*dt));
          const yaw=distance>2?(current.x<v.target.x?-Math.PI/2:Math.PI/2):v.baseYaw;
          this.setEntityPose(v.entity,current,new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0)));v.position=current.toArray();moved=true;
          if(distance<.12){v.arriving=false;v.parked=true;v.baseYaw=v.yaw*Math.PI/180;this.callbacks.parked?.(v);}
        }
      }
      if(v.parked){
        const low=-Math.min(.22,(v.drive.flat??0)*.045+(v.drive.lost??0)*.09),bodyPos=v.entity.body.translation();
        const pos=new THREE.Vector3(bodyPos.x,low,bodyPos.z),q=new THREE.Quaternion().setFromEuler(new THREE.Euler((v.drive.lost??0)*.018,v.baseYaw,(v.drive.flat??0)*.012));
        this.setEntityPose(v.entity,pos,q);v.position=pos.toArray();
      }
      // Render roots are interpolated later. Use the current physics pose for door colliders.
      const b=v.entity.body.translation(),q=v.entity.body.rotation();v.entity.root.position.set(b.x,b.y,b.z);v.entity.root.quaternion.set(q.x,q.y,q.z,q.w);v.entity.root.updateMatrixWorld(true);
      for(const p of v.parts.values()){
        if(p.spec.kind==='door'&&!p.gone&&!p.debris){
          if(v.parked&&p.targetAngle===0&&p.spec.open)p.targetAngle=p.spec.open;
          const diff=p.targetAngle-p.angle;if(Math.abs(diff)>.001){p.angle+=diff*Math.min(1,dt*3);p.group.rotation.y=p.angle;this.updateColliders(p);}
        }
        if(p.spec.kind==='wheel'&&!p.gone&&!p.debris&&moved){p.mesh.rotation.y+=dt*9;for(const c of p.children)c.mesh.rotation.y+=dt*9;}
      }
      const radiator=v.parts.get('radiator'),engine=v.parts.get('engine');
      if(!v.disabled&&radiator.state.hp<=0&&engine.state.hp>0){
        v.leak+=dt;if(v.leak>=.5){v.leak=0;engine.state.hp=Math.max(0,engine.state.hp-3);this.effects.particle(engine.group.getWorldPosition(V()),new THREE.Vector3(.1,1.3,0),'#a3bbc3',.28,1.7,'smoke');if(engine.state.hp===0){engine.state.stage='broken';this.breakPart(engine,engine.group.getWorldPosition(V()),new THREE.Vector3(0,1,0));this.disable(v);}}
      }
    }
  }
  render(){
    for(const d of this.debris){const p=d.body.translation(),q=d.body.rotation();d.group.position.set(p.x,p.y,p.z);d.group.quaternion.set(q.x,q.y,q.z,q.w);}
    for(const v of this.cars.values()){
      const battery=v.parts.get('battery'),powered=battery.state.hp>0&&!battery.gone;let r=0,b=0;
      for(const l of v.lights){
        const p=l.part,live=powered&&p.state.hp>0&&!p.gone&&!p.debris&&p.group.parent?.visible!==false;
        const pulse=Math.sin(this.time*12+l.phase*.68)>0;l.glow.visible=live;l.glow.material.opacity=live?(pulse?.78:.025):0;
        if(live&&pulse){if(p.spec.beacon==='red')r++;else b++;}
      }
      if(v.pools[0])v.pools[0].material.opacity=r*.055;if(v.pools[1])v.pools[1].material.opacity=b*.055;
    }
  }
  snapshot(){return [...this.cars.values()].map(v=>({id:v.id,disabled:v.disabled,hull:v.hull/v.maxHull,parts:[...v.parts.values()].flatMap((p,i)=>p.state.hp<p.state.max||p.state.detached?[[i,p.state.hp/p.state.max,p.state.detached?1:0]]:[])}));}
  restoreVehicle(v,saved){
    const parts=[...v.parts.values()],rows=cleanPartSave(saved.parts,parts.map(p=>p.spec));
    for(const [i,ratio] of rows){const p=parts[i];p.state.hp=p.state.max*ratio;p.state.hits=ratio<1?1:0;p.state.stage=ratio===0?'broken':ratio<1?'damaged':'intact';}
    for(const [i,ratio,detached] of rows){const p=parts[i];if(p.gone)continue;if(detached||ratio===0)this.breakPart(p,p.group.getWorldPosition(V()),new THREE.Vector3(0,0,1),true);else{if(p.spec.kind==='tire')this.flattenTire(p);else this.damageVisual(p,p.group.getWorldPosition(V()),new THREE.Vector3(0,0,-1));}}
    v.hull=Number.isFinite(saved.hull)?Math.max(0,Math.min(1,saved.hull))*v.maxHull:v.maxHull;v.drive=driveState(v.parts);
    if(saved.disabled||v.hull===0||v.drive.immobile)this.disable(v,true);
  }
  clear(){
    for(const d of [...this.debris])this.removeDebris(d);
    for(const v of this.cars.values()){
      for(const p of v.parts.values())this.removeColliders(p);
      for(const l of v.lights)this.art.release(l.glow.material);
      for(const pool of v.pools)this.art.release(pool.material);
      v.entity.root.removeFromParent();this.physics.entities.delete(v.id);if(v.entity.body.isValid())this.physics.world.removeRigidBody(v.entity.body);
      for(const g of v.geometries)g.dispose();for(const m of v.resources)m.dispose();
    }
    this.cars.clear();this.partsByCollider.clear();
  }
  dispose(){this.clear();this.tireGeometry.dispose();this.shardGeometry.dispose();this.glassMaterial.dispose();this.crackMaterial.dispose();this.dentMaterial.dispose();for(const t of this.textures)t.dispose();for(const m of this.decals.values())m.dispose();}
}
