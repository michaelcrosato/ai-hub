(() => {
const G=Drive;
G.Session.prototype.crime=function(actor,level,reason){this.metrics.crimes++;this.events.emit('noise.emitted',{x:actor.x,y:actor.y,zone:actor.zone,actor:actor.id,level,reason});};
G.Session.prototype.hearCrime=function(e){
 if(!e.level)return;const actor=this.actors.find(a=>a.id===e.actor);if(actor&&actor.team!=='crew')return;
 const pos={x:e.x,y:e.y,z:0,zone:e.zone};
 for(const witness of this.actors){if(witness.dead||!witness.enabled||witness.team==='crew'||witness.zone!==e.zone||G.dist(witness,pos)>220)continue;
  if(witness.team==='civilian'){witness.panic=8;const dx=witness.x-e.x,dy=witness.y-e.y,n=Math.hypot(dx,dy)||1;witness.flee={x:witness.x+dx/n*90,y:witness.y+dy/n*90,zone:witness.zone};}
  if(!this.queryClear(witness,pos))continue;
  witness.witness={at:this.time+1.6,event:{...e},actor:e.actor};if(witness.team!=='civilian'){witness.suspicion=1;witness.target=pos;}
 }
};
G.raiseHeat=(s,level,location,reason)=>{
 const old=s.alert.heat;s.alert.heat=G.clamp(Math.max(old,level),0,4);s.alert.mode='pursue';s.alert.timer=0;s.alert.last={x:location.x,y:location.y,zone:location.zone};s.alert.reason=reason;
 const c=s.cars.find(c=>c.id===s.controlled.vehicle);s.alert.evidence=c?{vehicle:c.id,color:c.color}:{actor:s.control};
 if(s.alert.heat!==old){s.events.emit('heat.changed',{heat:s.alert.heat,reason});s.say('DISPATCH: '+reason+'. Search the last known area.',4);s.sound('siren');}
 for(const [i,a]of s.actors.filter(a=>a.team==='police').entries())a.enabled=i<Math.max(2,s.alert.heat+1);
};
G.canRecognize=(s,c,observer)=>{if(!c.vehicle||G.dist(c,observer)<45)return true;const car=s.cars.find(v=>v.id===c.vehicle),e=s.alert.evidence;return !e||!!e.actor||(e.vehicle===car.id&&e.color===car.color);};
G.updateCity=(s,dt)=>{
 for(const a of s.actors){if(!a.witness)continue;const w=a.witness,actor=s.actors.find(c=>c.id===w.actor),pos=actor||{...w.event,z:0};
  if(a.dead||pos.zone!==a.zone||!s.queryClear(a,pos)||G.dist(a,pos)>240){a.witness=null;continue;}
  if(s.time>=w.at){G.raiseHeat(s,w.event.level,{x:pos.x,y:pos.y,zone:pos.zone},w.event.reason);s.events.emit('witness.reported',{id:a.id,actor:pos.id});a.witness=null;}
 }
 const c=s.controlled,alert=s.alert;
 // A camera is a witness with a physical cone, not a global crime sensor.
 if(c.zone==='records'&&s.cameraDisabled<=0&&!s.flags.ledger&&c.x>260&&c.y<160&&s.maps.records.sight({x:470,y:50,z:25},c)){s.cameraSeen=(s.cameraSeen||0)+dt;if(s.cameraSeen>2)G.raiseHeat(s,2,c,'Records camera identified the crew');}else s.cameraSeen=0;
 if(alert.heat>0){
  const seen=s.actors.some(a=>a.enabled&&!a.dead&&(a.team==='guard'||a.team==='police')&&a.zone===c.zone&&G.canRecognize(s,c,a)&&G.dist(a,c)<210&&s.queryClear(a,c)&&(!c.crouch||G.dist(a,c)<85));
  if(seen){const v=s.cars.find(v=>v.id===c.vehicle);alert.evidence=v?{vehicle:v.id,color:v.color}:{actor:c.id};alert.last={x:c.x,y:c.y,zone:c.zone};alert.timer=0;alert.mode='pursue';}
  else {alert.timer+=dt;alert.mode=alert.timer<3?'investigate':'search';if(alert.timer>14){alert.heat--;alert.timer=6;alert.mode=alert.heat?'search':'disengage';s.events.emit('heat.changed',{heat:alert.heat,reason:'Search area clear'});if(!alert.heat){s.note('HEAT CLEAR — You lost them');s.sound('clear');for(const a of s.actors.filter(a=>a.team==='police')){a.target=null;a.suspicion=0;}}}}
  if(c.hp<25&&!c.vehicle&&s.actors.some(a=>a.team==='police'&&!a.dead&&a.enabled&&a.zone===c.zone&&G.dist(a,c)<12)){s.arrest=(s.arrest||0)+dt;if(s.arrest>2)s.fail('BUSTED — Retry the last checkpoint.');}else s.arrest=0;
  if(alert.heat>=3&&!s.flags.roadblock){s.flags.roadblock=true;const cars=s.cars.filter(c=>c.traffic).slice(-2);cars.forEach((v,i)=>{Object.assign(v,{traffic:false,type:'police',color:'#e5ded0',x:1490+i*42,y:1342,facing:0,speed:0,vx:0,vy:0});});s.note('ROADBLOCK AHEAD — Canal Road remains open');}
 }
};
})();
