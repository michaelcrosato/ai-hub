import * as THREE from 'three/webgpu';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { OFFICER_TYPES } from './waves.js';
const UP=new THREE.Vector3(0,1,0),_goal=new THREE.Vector3(),_dir=new THREE.Vector3(),_q=new THREE.Quaternion();
const NO_PRESSURE={accuracy:1,damage:1,aim:1};
/** Local cover and withdrawal behavior. No human damage or death state is used. */
export class PoliceLine {
  constructor(game,fleet,art,effects,callbacks={}){
    this.game=game;this.fleet=fleet;this.art=art;this.effects=effects;this.callbacks=callbacks;this.officers=[];this.shields=new Map();this.time=0;
    this.laserMaterial=new THREE.LineBasicMaterial({color:'#ff684f',transparent:true,opacity:.65});
  }
  get vehicles(){return this.fleet.cars;}get remaining(){return this.fleet.remaining;}
  addWave(plan){
    for(const [index,spec] of plan.entries()){
      const v=this.fleet.cars.get(spec.id);
      for(const [j,type] of spec.crew.entries()){
        const id=spec.wave===0?`officer-${spec.label}-${j}`:`officer-${spec.wave}-${index}-${j}`,side=j%2?-1:1;
        let entity=this.game.runtime.physics.entities.get(id);
        const point=this.fleet.coverPoint(v,side)?.position??new THREE.Vector3(v.position[0]+side*2.1,0,v.position[2]-.6);
        if(!entity){
          const root=new THREE.Group();this.game.view.entities.add(root);
          const data={id,name:OFFICER_TYPES[type].label,prefab:'officer',position:point.toArray(),rotation:[0,0,0],scale:[1,1,1],components:[]};
          entity=this.game.runtime.physics.create(data,{body:'kinematic',visuals:[],colliders:[{position:[0,.85,0],size:[.59,1.7,.5]}]},root);
        }
        entity.root.clear();entity.body.setTranslation(point,true);entity.body.setNextKinematicTranslation(point);entity.previous.copy(point);entity.current.copy(point);entity.root.position.copy(point);
        const rig=this.art.person(false);entity.root.add(rig);entity.root.userData.rig=rig;
        const a={id,type,spec:OFFICER_TYPES[type],entity,rig,vehicleId:v.id,side,position:point.clone(),origin:point.clone(),cover:null,state:'cover',cooldown:2+index*.27+j*.6,suppressed:0,retreat:0,peek:0,aim:0,burst:0,burstTime:0,active:v.parked,removed:false,crouched:null,shieldHealth:0,phase:index+j*.6,wave:spec.wave};
        if(type!=='patrol'){
          this.art.box(rig,[0,1.24,.215],[.57,.54,.17],a.spec.color,.25,.65);
          for(const s of [-1,1])this.art.box(rig,[s*.16,1.1,.32],[.12,.2,.09],'#172630',.2,.8);
          this.art.mesh(rig,'sphere',[0,1.99,0],[.22,.17,.21],this.art.mat(a.spec.color,.3,.5));
          this.art.box(rig,[0,1.91,.18],[.34,.07,.05],'#5b747f',.65,.15);
          if(type==='grenadier'){
            // A stubby launcher and a gas mask filter set the grenadier apart at a glance.
            this.art.mesh(rig,'cylinder',[.15,1.17,.52],[.09,.46,.09],this.art.mat('#1b2a24',.55,.45),[Math.PI/2,0,0]);
            this.art.mesh(rig,'cylinder',[0,1.74,.2],[.07,.08,.07],this.art.mat('#39473f',.4,.6),[Math.PI/2,0,0]);
          }else this.art.box(rig,[.15,1.15,.57],[.07,.1,type==='marksman'?.98:.54],'#18232c',.6,.4);
        }
        if(type==='shield'){
          const shield=new THREE.Group();shield.position.set(0,1.08,.49);rig.add(shield);
          this.art.box(shield,[0,0,0],[.78,1.12,.09],'#365260',.5,.4);
          this.art.box(shield,[0,.28,.052],[.47,.16,.015],'#7da6b1',.5,.16);
          this.art.box(shield,[0,-.25,.053],[.5,.08,.012],'#b9cbd0',.2,.7);
          a.shield=shield;a.shieldHealth=95;
          const c=this.game.runtime.physics.world.createCollider(RAPIER.ColliderDesc.cuboid(.39,.56,.05).setTranslation(0,1.08,.49),entity.body);
          a.shieldCollider=c;this.shields.set(c.handle,a);this.game.runtime.physics.owners.set(c.handle,`shield-${id}`);
        }
        if(type==='marksman'){
          const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(6),3));
          a.laser=new THREE.Line(geo,this.laserMaterial);a.laser.visible=false;a.laser.frustumCulled=false;this.art.group.add(a.laser);
        }
        this.crouch(a,false);this.officers.push(a);if(v.disabled)a.retreat=.01;
        this.setActive(a,a.active);
      }
    }
  }
  setActive(a,active){a.active=active;a.entity.root.visible=active;for(const c of a.entity.colliders)c.setEnabled(active&&!a.removed);a.shieldCollider?.setEnabled(active&&!a.removed&&a.shieldHealth>0);}
  parked(v){for(const a of this.officers)if(a.vehicleId===v.id&&!a.removed&&!a.active){const p=this.fleet.coverPoint(v,a.side)?.position;if(p){a.position.copy(p);a.entity.body.setTranslation(p,true);a.entity.body.setNextKinematicTranslation(p);a.entity.current.copy(p);a.entity.previous.copy(p);}this.setActive(a,true);}}
  retreatVehicle(id){for(const a of this.officers)if(a.vehicleId===id){if(!a.active)this.setActive(a,true);a.retreat=Math.max(.01,a.retreat);a.state='withdraw';}}
  suppress(point,vehicleId){
    for(const a of this.officers)if(!a.removed&&a.active&&(a.vehicleId===vehicleId||a.position.distanceTo(point)<4.2)){
      a.suppressed=Math.max(a.suppressed,1.6);a.aim=0;a.burst=0;a.peek=0;if(a.laser)a.laser.visible=false;
    }
  }
  hitShield(hit,damage,point,direction){
    const a=hit?this.shields.get(hit.collider.handle):null;if(!a)return false;
    a.shieldHealth=Math.max(0,a.shieldHealth-damage);this.effects.impact(point,'metal');a.suppressed=1.1;
    if(a.shieldHealth===0){
      this.shields.delete(a.shieldCollider.handle);this.game.runtime.physics.owners.delete(a.shieldCollider.handle);this.game.runtime.physics.world.removeCollider(a.shieldCollider,true);a.shieldCollider=null;a.shield.visible=false;
      for(let i=0;i<10;i++)this.effects.particle(point,new THREE.Vector3(direction.x+(Math.random()-.5)*4,2+Math.random()*3,direction.z+(Math.random()-.5)*4),'#68818c',.08,.8,'metal');
      a.state='relocate';a.cover=null;this.callbacks.notice?.('SHIELD DISABLED / OFFICER SEEKS COVER');
    }
    return true;
  }
  crouch(a,crouched){
    if(a.crouched===crouched)return;a.crouched=crouched;
    const c=a.entity.colliders[0],standing=a.type==='patrol'?2.08:2.18,height=standing-(crouched?.57:0);
    c.setShape(new RAPIER.Cuboid(.3,height/2,.26));c.setTranslationWrtParent({x:0,y:height/2,z:0});
    if(a.shieldCollider)a.shieldCollider.setTranslationWrtParent({x:0,y:crouched?.68:1.08,z:.49});
  }
  coverFor(a){
    let v=this.fleet.cars.get(a.vehicleId),candidate=v&&!v.disabled?this.fleet.coverPoint(v,a.side):null;
    if(candidate)return candidate;
    let nearest=null,distance=Infinity;
    for(const car of this.fleet.cars.values())if(!car.disabled&&car.parked)for(const side of [-1,1]){
      const c=this.fleet.coverPoint(car,side);if(!c)continue;const d=c.position.distanceTo(a.position);if(d<distance){distance=d;nearest=c;}
    }
    return nearest;
  }
  aimRay(a){
    const target=this.game.player.body.translation(),origin=new THREE.Vector3(a.position.x,(a.crouched?.99:1.48),a.position.z);
    const dir=new THREE.Vector3(target.x-origin.x,target.y+1.15-origin.y,target.z-origin.z),distance=dir.length();dir.normalize();
    origin.addScaledVector(dir,.43);
    const ray=new RAPIER.Ray(origin,dir),hit=this.game.runtime.physics.world.castRay(ray,distance+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,a.entity.body);
    return {origin,dir,distance,hit,clear:hit?.collider.handle===this.game.player.collider.handle,target:new THREE.Vector3(target.x,target.y+1.15,target.z)};
  }
  face(a,x,z){a.entity.body.setNextKinematicRotation(_q.setFromAxisAngle(UP,Math.atan2(x,z)));}
  step(dt){
    this.time+=dt;const player=this.game.player.body.translation();
    // Difficulty and the helicopter's searchlight scale return fire (accuracy, damage, marksman aim time).
    const pressure=this.callbacks.pressure?.()??NO_PRESSURE;
    for(const a of this.officers){
      if(a.removed||!a.active)continue;
      a.cooldown-=dt;a.suppressed=Math.max(0,a.suppressed-dt);a.burstTime-=dt;
      const v=this.fleet.cars.get(a.vehicleId);if(v?.disabled)a.retreat=Math.max(.01,a.retreat);
      if(a.retreat>0){
        a.retreat+=dt;a.state='withdraw';this.crouch(a,false);
        _dir.set(a.origin.x<0?-33:33,0,-49).sub(a.position).normalize();a.position.addScaledVector(_dir,a.spec.speed*dt);
        this.face(a,_dir.x,_dir.z);
        a.entity.body.setNextKinematicTranslation(a.position);if(a.laser)a.laser.visible=false;
        if(a.retreat>7){a.removed=true;this.setActive(a,false);}continue;
      }
      a.cover=this.coverFor(a);
      if(a.cover)_goal.copy(a.cover.position);
      else {a.state='relocate';_goal.set(a.origin.x,0,-42);}
      if(a.suppressed>0){a.state='suppressed';a.peek=0;this.crouch(a,true);}
      else if(a.cooldown<=0){a.state=a.type==='marksman'?'aiming':'peek';a.peek+=dt;this.crouch(a,false);_goal.x+=a.side*.79;_goal.z+=.2;}
      else {a.state=a.cover?'cover':'relocate';a.peek=0;this.crouch(a,true);}
      _dir.subVectors(_goal,a.position);const dist=_dir.length();if(dist>1e-6)a.position.addScaledVector(_dir.multiplyScalar(1/dist),Math.min(dist,a.spec.speed*dt));
      a.entity.body.setNextKinematicTranslation(a.position);
      this.face(a,player.x-a.position.x,player.z-a.position.z);
      if(a.laser)a.laser.visible=false;
      if(a.suppressed>0||a.peek<.35)continue;
      const aim=this.aimRay(a);
      if(!aim.clear){a.aim=0;if(a.peek>2.7){a.cooldown=1.3;a.peek=0;}continue;}
      if(a.type==='marksman'&&a.burst===0){
        a.aim+=dt;const p=a.laser.geometry.attributes.position;p.setXYZ(0,aim.origin.x,aim.origin.y,aim.origin.z);p.setXYZ(1,aim.target.x,aim.target.y,aim.target.z);p.needsUpdate=true;a.laser.visible=true;
        if(a.aim<1.8*pressure.aim)continue;
      }
      if(a.burst===0)a.burst=a.spec.burst;
      if(a.burstTime<=0){
        a.burst--;a.burstTime=.16;
        if(a.spec.gas)this.callbacks.gas?.(aim.origin,aim.target);
        else{
          this.callbacks.returnFire?.(aim.origin,aim.target,a.type);
          // Aim pressure rises with waves. The warning beam and cover still permit a response.
          const accuracy=Math.min(1,(a.type==='marksman'?1:.26+Math.min(.27,a.wave*.025))*pressure.accuracy);
          if(Math.random()<accuracy)this.callbacks.damage?.(a.spec.damage*(1+Math.min(.75,a.wave*.045))*pressure.damage,aim.origin);
        }
        if(a.burst===0){a.cooldown=a.spec.interval/Math.min(1.65,1+a.wave*.025)+Math.sin(a.phase+this.time)*.35;a.peek=0;a.aim=0;}
      }
    }
  }
  render(dt){
    for(const a of this.officers){if(a.removed||!a.active)continue;
      const moving=a.retreat>0||a.state==='relocate',targetY=a.crouched?-.57:0;a.rig.position.y+=(targetY-a.rig.position.y)*Math.min(1,dt*13);
      for(const [i,leg] of a.rig.userData.legs.entries())leg.rotation.x=moving?Math.sin(this.time*12+i*Math.PI)*.53:a.crouched?-.4:0;
    }
  }
  clear(){
    const p=this.game.runtime.physics;
    for(const a of this.officers){
      if(a.laser){a.laser.geometry.dispose();a.laser.removeFromParent();}
      for(const c of a.entity.colliders)p.owners.delete(c.handle);
      if(a.shieldCollider)p.owners.delete(a.shieldCollider.handle);
      p.entities.delete(a.id);if(a.entity.body.isValid())p.world.removeRigidBody(a.entity.body);a.entity.root.removeFromParent();
    }
    this.officers.length=0;this.shields.clear();
  }
  dispose(){this.clear();this.laserMaterial.dispose();}
}
