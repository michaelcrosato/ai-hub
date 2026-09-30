import * as THREE from 'three/webgpu';
import { RAPIER } from '../engine/PhysicsWorld.js';
import { AIR_UNIT_WAVE } from './waves.js';
const DOWN=new THREE.Vector3(0,-1,0),PATROL_TILT=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.25);
const _v=new THREE.Vector3(),_w=new THREE.Vector3(),_target=new THREE.Vector3(),_q=new THREE.Quaternion();
/** The lab roof covers the terrace from z 3.6 inward; the searchlight cannot reach under it. */
const ROOF_EDGE=3.4;
/**
 * Air One, the police helicopter (new in this version). Before wave 3 it circles the street as
 * scenery, exactly as it always did. From wave 3 it comes in low over the road and its
 * searchlight hunts the player on the terrace: while the beam is on you, officers aim faster
 * and hit more often. Break the lamp under its nose to blind it for the rest of the wave. The
 * crew is never a target: only the lamp has a collider.
 */
export class AirUnit {
  constructor(game,art,effects,scope,callbacks={}){
    this.game=game;this.art=art;this.effects=effects;this.callbacks=callbacks;this.heli=art.heli;
    this.time=0;this.mode='patrol';this.arrive=0;this.lampMax=60;this.lampHp=this.lampMax;this.lampsBroken=0;
    this.spot=new THREE.Vector3(0,6.2,-3);this.spotted=false;this.presence=0;this.colliderOn=false;
    this.lampLocal=new THREE.Vector3(0,-.98,-1.75);
    // Its own lamp material, so switching the lamp off is a uniform change (no new pipeline).
    this.lampMaterial=new THREE.MeshStandardMaterial({color:'#fff4d8',emissive:'#fff4d8',emissiveIntensity:2.5,roughness:.3});
    art.heliLamp.material=this.lampMaterial;
    const physics=game.runtime.physics;this.physics=physics;
    this.body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,-100,0));
    this.collider=physics.world.createCollider(RAPIER.ColliderDesc.ball(.55),this.body);this.collider.setEnabled(false);
    physics.owners.set(this.collider.handle,'air-unit');
    scope.own(()=>this.dispose());
  }
  get hunting(){return this.mode==='hunt'&&this.arrive<=0;}
  get lampAlive(){return this.lampHp>0;}
  lampWorld(target){this.heli.updateMatrixWorld(true);return this.heli.localToWorld(target.copy(this.lampLocal));}
  setLamp(on){
    this.lampHp=on?this.lampMax:0;
    this.lampMaterial.color.set(on?'#fff4d8':'#26323a');this.lampMaterial.emissiveIntensity=on?2.5:0;
    this.art.heliLampGlow.visible=on;
  }
  /** A response wave begins (also called when a checkpoint restores an active wave). */
  beginWave(wave,restored=false){
    if(wave<AIR_UNIT_WAVE){this.mode='patrol';return;}
    this.mode='hunt';this.arrive=restored?2:7;this.setLamp(true);
    this.spot.set(this.heli.position.x,6.2,-3);
    if(!restored)this.callbacks.inbound?.();
  }
  /** The line is clear: Air One pulls back to its orbit until the next wave. */
  endWave(){if(this.mode==='hunt')this.mode='leave';}
  hit(hit,damage,point){
    if(!hit||hit.collider.handle!==this.collider.handle||!this.hunting||!this.lampAlive)return false;
    this.lampHp=Math.max(0,this.lampHp-damage);this.effects.impact(point,'glass');
    if(this.lampHp===0){
      this.setLamp(false);this.lampsBroken++;this.mode='leave';this.spotted=false;
      for(let i=0;i<14;i++)this.effects.particle(point,_v.set((Math.random()-.5)*5,-1-Math.random()*3,(Math.random()-.5)*5),'#e8f4ff',.05+Math.random()*.06,1.2,'glass');
      this.callbacks.blinded?.();
    }
    return true;
  }
  /** Fixed step: where the beam points, and whether it has found the player. */
  step(dt,player){
    if(this.mode==='hunt'&&this.arrive>0)this.arrive=Math.max(0,this.arrive-dt);
    const active=this.hunting&&this.lampAlive;
    if(active!==this.colliderOn){this.colliderOn=active;this.collider.setEnabled(active);}
    if(!active){this.spotted=false;return;}
    const outside=player.z<ROOF_EDGE;
    // Searching under the roof edge when the player is inside; trailing the player at 4.2 m/s
    // otherwise, slower than a sprint, so moving out of the pool works.
    _target.set(player.x,6.2,outside?player.z:1.2);
    _v.subVectors(_target,this.spot);const d=_v.length();
    if(d>1e-4)this.spot.addScaledVector(_v,Math.min(1,4.2*dt/d));
    this.spotted=outside&&Math.hypot(player.x-this.spot.x,player.z-this.spot.z)<2.4;
  }
  /** Per frame: flight path, beam, and the pool of light. dt is 0 while paused. */
  render(dt){
    this.time+=dt;const t=this.time,h=this.heli,hunt=this.mode==='hunt';
    if(hunt){
      const px=this.game.player.current.x;
      _target.set(Math.max(-18,Math.min(18,px*.5+Math.sin(t*.21)*6)),21+Math.sin(t*.37)*.8,-21+Math.cos(t*.19)*2.5);
    }else _target.set(Math.sin(t*.09)*24,25+Math.sin(t*.16)*1.5,-40+Math.cos(t*.09)*8);
    const rate=hunt?.7:this.mode==='leave'?.5:4;
    h.position.lerp(_target,1-Math.exp(-rate*dt));
    if(this.mode==='leave'&&h.position.distanceTo(_target)<3)this.mode='patrol';
    const player=this.game.player.current;
    const yaw=hunt?Math.atan2(h.position.x-player.x,h.position.z-player.z):Math.cos(t*.09)*.38;
    let diff=yaw-h.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));h.rotation.y+=diff*(1-Math.exp(-(hunt?1.6:4)*dt));
    this.presence+=((hunt?1:0)-this.presence)*(1-Math.exp(-.8*dt));
    const pivot=this.art.beamPivot,beam=this.art.beam,pool=this.art.searchPool;
    h.updateMatrixWorld(true);
    if(this.hunting&&this.lampAlive){
      pivot.getWorldPosition(_w);_v.subVectors(this.spot,_w);const len=Math.max(1,_v.length());_v.multiplyScalar(1/len);
      _v.applyQuaternion(_q.copy(h.quaternion).invert());pivot.quaternion.setFromUnitVectors(DOWN,_v);
      beam.position.y=-len/2;beam.scale.set(len*.17,len,len*.17);beam.material.opacity=.06;
      pool.position.set(this.spot.x,6.235,this.spot.z);pool.scale.set(5.2,5.2,1);pool.material.opacity=.34;
      this.body.setNextKinematicTranslation(this.lampWorld(_w));
    }else{
      pivot.quaternion.copy(PATROL_TILT);beam.position.y=-11;beam.scale.set(5.5,22,5.5);beam.material.opacity=this.lampAlive?.035:0;
      pool.position.set(h.position.x+5,.054,h.position.z-1);pool.scale.set(13,13,1);pool.material.opacity=this.lampAlive?.23:0;
    }
  }
  dispose(){
    this.physics.owners.delete(this.collider.handle);
    if(this.body.isValid())this.physics.world.removeRigidBody(this.body);
    this.lampMaterial.dispose();
  }
}
