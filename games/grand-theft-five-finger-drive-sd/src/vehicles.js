(() => {
const G=Drive;
const trig=c=>{if(c._angle!==c.facing){c._angle=c.facing;c._cos=Math.cos(c.facing);c._sin=Math.sin(c.facing);}return [c._cos,c._sin];};
G.carPoint=(c,x,y,r=0)=>{const d=G.content.vehicles[c.type],dx=x-c.x,dy=y-c.y,co=trig(c)[0],si=c._sin,u=dx*co+dy*si,v=-dx*si+dy*co;return Math.abs(u)<d.length/2+r&&Math.abs(v)<d.width/2+r;};
G.carSegment=(c,a,b,r=0)=>{const d=G.content.vehicles[c.type],co=trig(c)[0],si=c._sin,local=p=>{const x=p.x-c.x,y=p.y-c.y;return{x:x*co+y*si,y:-x*si+y*co};};return G.segmentBox2D(local(a),local(b),{x:-d.length/2-r,y:-d.width/2-r,w:d.length+2*r,h:d.width+2*r});};
G.carCircles=c=>{const d=G.content.vehicles[c.type],co=trig(c)[0],si=c._sin,off=(d.length-d.width)/2;return [-off,0,off].map(t=>({x:c.x+co*t,y:c.y+si*t,r:d.width/2}));};
G.carClear=(s,c,x=c.x,y=c.y,facing=c.facing)=>{
 const q={...c,x,y,facing},points=G.carCircles(q);
 for(const p of points){if(!s.maps.city.standable(p.x,p.y,0,p.r,2))return false;for(const other of s.spatial.near(p.x,p.y,p.r+32)){if(other.id===c.id)continue;if(!other.type){if(other.team==='crew'&&!other.vehicle&&!other.dead&&other.z<12&&G.dist(p,other)<p.r+other.r)return false;continue;}for(const op of G.carCircles(other))if(Math.hypot(p.x-op.x,p.y-op.y)<p.r+op.r-.3)return false;}for(const prop of s.solidProps)if(prop.solid&&prop.zone==='city'&&G.dist(p,prop)<p.r+10)return false;}return true;
};
G.enterCar=(s,a,c)=>{
 if(a.vehicle||a.down||a.dead||a.zone!=='city'||c.hp<=0||Math.abs(c.speed)>18||G.dist(a,c)>45)return false;
 const occupant=s.actors.find(x=>x.id===c.occupants[0]),taking=occupant&&occupant.team!=='crew';if(taking&&!G.exitCar(s,occupant)){s.note('Driver door blocked');return false;}if(taking){occupant.panic=10;occupant.flee={x:occupant.x-90,y:occupant.y+60,zone:'city'};}
 const seat=taking?0:c.occupants.indexOf(null);if(seat<0){s.note('All seats occupied');return false;}
 if(c.reservation[seat]&&c.reservation[seat]!==a.id)return false;c.reservation[seat]=a.id;
 // Acquisition and seating commit in one simulation phase.
 if(c.traffic||taking){c.traffic=false;c.parked=true;s.crime(a,1,'Vehicle taken');}
 c.occupants[seat]=a.id;a.vehicle=c.id;a.seat=seat;a.nav=null;delete c.reservation[seat];s.events.emit('vehicle.entered',{actor:a.id,vehicle:c.id,seat});s.sound('door');return true;
};
G.exitCar=(s,a)=>{
 const c=s.cars.find(v=>v.id===a.vehicle);if(!c)return false;if(Math.abs(c.speed)>30){s.note('Brake before leaving the car');return false;}
 const d=G.content.vehicles[c.type],co=trig(c)[0],si=c._sin,sign=a.seat%2?-1:1;
 for(const [forward,side]of [[a.seat<2?6:-8,sign*(d.width/2+10)],[6,-sign*(d.width/2+10)],[-d.length/2-12,0],[d.length/2+12,0]]){
  const x=c.x+co*forward-si*side,y=c.y+si*forward+co*side;
  if(!s.freePoint(x,y,'city',5,c.id)||s.crew.some(o=>o!==a&&!o.vehicle&&o.zone==='city'&&Math.hypot(o.x-x,o.y-y)<10))continue;
  c.occupants[a.seat]=null;Object.assign(a,{vehicle:null,seat:null,x,y,z:0,vx:0,vy:0,nav:null});s.events.emit('vehicle.exited',{actor:a.id,vehicle:c.id});s.sound('door');return true;
 }s.note('Door blocked. Move the car to a clear space.');return false;
};
G.driveTo=(s,c,target,source='companion')=>{
 const a=G.emptyAction(source);c.navAge=(c.navAge||0)+G.STEP;
 c.aiWatch=(c.aiWatch||0)+G.STEP;if(c.aiWatch>1){const moved=c.aiPosition?G.dist(c,c.aiPosition):99;c.aiBlocked=moved<4?(c.aiBlocked||0)+1:0;c.aiPosition={x:c.x,y:c.y};c.aiWatch=0;if(c.aiBlocked>=2){c.recoverFor=1.8;c.aiBlocked=0;c.nav=null;}}
 if(c.recoverFor>0){c.recoverFor-=G.STEP;a.brake=1;a.reverse=true;a.steer=0;return a;}
 if(!c.nav||!c.navTarget||G.dist(c.navTarget,target)>64||c.navAge>4){c.nav=G.path(s.maps.city,c,target,32,32);c.navTarget={...target};c.navAge=0;}
 while(c.nav.length&&G.dist(c,c.nav[0])<36)c.nav.shift();
 const p=c.nav[0]||target,dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy),turn=G.angle(Math.atan2(dy,dx)-c.facing);
 a.steer=G.clamp(turn*1.6,-1,1);const near=G.dist(c,target)<50;
 const cruise=source==='police'?75:source==='demo'&&s.stage?.kind==='escape'?155:95;a.throttle=near?0:Math.abs(turn)>1.2?.12:.45;a.brake=near&&Math.abs(c.speed)>4?1:Math.abs(c.speed)>(Math.abs(turn)>.4?40:cruise)? .7:0;
 if(Math.abs(turn)>2.0&&!near){a.throttle=0;a.brake=1;a.reverse=true;a.steer=-G.clamp(G.angle(turn-Math.sign(turn)*Math.PI)*1.6,-1,1);}
  if(c.stuck>1.2){a.throttle=0;a.brake=1;a.reverse=true;a.steer=0;if(c.stuck>2.4){c.stuck=0;c.nav=null;}}
 return a;
};
G.updateVehicles=(s,baseDt,player)=>{
 for(const c of s.cars){const ambient=c.traffic;if(ambient&&s.tick%4!==0)continue;const dt=baseDt*(ambient?4:1);if(!c.traffic&&!c.occupants[0]&&Math.abs(c.speed)<.01&&Math.hypot(c.vx,c.vy)<.01&&(c.hp>0||c.exploded))continue;const d=G.content.vehicles[c.type];let a=G.emptyAction('traffic'),driver=s.actors.find(a=>a.id===c.occupants[0]);
  if(driver===s.controlled)a=player;
  else if(c.police&&driver&&driver.enabled){const patrol=G.content.traffic.patrol,last=s.alert.heat&&s.alert.last?.zone==='city'?s.alert.last:null;const target=last||patrol[c.patrolPoint||0];a=G.driveTo(s,c,target,'police');if(!last&&G.dist(c,target)<55)c.patrolPoint=((c.patrolPoint||0)+1)%4;if(last&&s.controlled.zone==='city'&&!s.controlled.vehicle&&G.dist(c,s.controlled)<65&&Math.abs(c.speed)<20)G.exitCar(s,driver);}
  else if(driver&&driver.team!=='civilian'){if(driver.task==='hold'){a.brake=1;}else if(s.controlled.vehicle===c.id&&s.controlled.seat!==0){a=G.driveTo(s,c,G.content.points[s.stage?.target]||G.content.points.pickup);}else if(s.controlled.zone==='city'&&G.dist(c,s.controlled)>100){a=G.driveTo(s,c,{x:s.controlled.x,y:s.controlled.y});}else a.brake=1;}
  else if(c.traffic){
   const route=G.content.traffic.route;c.way=c.way??0;if(G.dist(c,route[c.way])<45)c.way=(c.way+1)%4;
   const target=route[c.way],turn=G.angle(Math.atan2(target.y-c.y,target.x-c.x)-c.facing);a.steer=G.clamp(turn*1.5,-1,1);a.throttle=Math.abs(turn)>.7?.2:.45;
   const signalPhase=Math.floor(s.time/G.content.traffic.signals.period)%2,vertical=Math.abs(Math.sin(c.facing))>.7,nearIntersection=G.content.traffic.signals.x.some(x=>Math.abs(c.x-x)<65)&&G.content.traffic.signals.y.some(y=>Math.abs(c.y-y)<65);
   const ahead={x:c.x+Math.cos(c.facing)*60,y:c.y+Math.sin(c.facing)*60};const queue=s.cars.some(o=>o!==c&&G.dist(o,ahead)<40);
   if((nearIntersection&&(vertical?signalPhase===0:signalPhase===1))||queue){a.throttle=0;a.brake=1;c.wait=(c.wait||0)+dt;}else c.wait=0;
   if(c.wait>12){c.way=(c.way+1)%4;c.wait=0;a.brake=0;a.throttle=.15;}
   if(c.stuck>2){a.brake=1;a.throttle=0;a.steer=-1;if(c.stuck>4){c.way=(c.way+1)%4;c.stuck=0;}}
  }else a.brake=1;
  if(c.hp<=0){a.throttle=0;a.brake=1;}
  const old={x:c.x,y:c.y,facing:c.facing},speed=c.speed,hand=!!a.held.jump,grip=driver?.abilityTime>0&&driver.id==='mara'?d.grip*1.6:d.grip;
  let force=a.throttle*d.accel;
  if(a.brake>0)force-=c.speed>8?240*a.brake:(a.source==='physical'||a.reverse||c.stuck>1.2)?90*a.brake:Math.sign(c.speed)*Math.min(Math.abs(c.speed)/dt,240*a.brake);
  if(!a.throttle&&!a.brake)force-=Math.sign(c.speed)*Math.min(Math.abs(c.speed)/dt,24);
  c.speed=G.clamp(c.speed+force*dt,-65,d.speed*(c.hp<d.hp*.3?.65:1));
  c.tireCD=Math.max(0,(c.tireCD||0)-dt);if(hand&&Math.abs(c.speed)>40){if(!c.tireCD){s.sound('tire');c.tireCD=.3;}if(s.tick%6===0)s.tracks.push({x:c.x,y:c.y,facing:c.facing,life:8});}if(hand)c.speed*=Math.exp(-dt*1.5);
  c.braking=a.brake>.1;c.steering=a.steer;
  const turn=a.steer*G.clamp(Math.abs(c.speed)/65,.12,1)*2.3*(c.speed<0?-1:1)*(hand?1.4:1)*dt;
  const facing=G.angle(c.facing+turn),tx=Math.cos(facing)*c.speed,ty=Math.sin(facing)*c.speed,k=1-Math.exp(-(hand?1.6:grip)*dt);
  c.vx+=(tx-c.vx)*k;c.vy+=(ty-c.vy)*k;const steps=Math.max(1,Math.ceil(Math.hypot(c.vx,c.vy)*dt/3));let collision=false;
  for(let n=0;n<steps;n++){const x=c.x+c.vx*dt/steps,y=c.y+c.vy*dt/steps;if(G.carClear(s,c,x,y,facing)){c.x=x;c.y=y;c.facing=facing;}else{collision=true;break;}}
  if(collision){c.stuck=(c.stuck||0)+dt;if(Math.abs(speed)>48&&(c.crashCD||0)<=0){const hit=Math.min(45,Math.abs(speed)*.12);s.damage(c,hit,driver,'collision');s.metrics.crashes++;s.sound('crash');s.events.emit('noise.emitted',{x:c.x,y:c.y,zone:'city',actor:driver?.id,level:1,reason:'Traffic collision'});c.crashCD=.5;}c.speed*=.5;c.vx*=.3;c.vy*=.3;}else if(G.dist(c,old)>.05)c.stuck=0;
  c.crashCD=Math.max(0,(c.crashCD||0)-dt);
  if(Math.abs(c.speed)>35)for(const actor of s.spatial.near(c.x,c.y,35)){if(actor.type||actor.vehicle||actor.dead||actor.zone!=='city')continue;if(G.carPoint(c,actor.x,actor.y,actor.r)){s.damage(actor,Math.abs(c.speed)*.12,driver,'collision');const dx=actor.x-c.x,dy=actor.y-c.y,n=Math.hypot(dx,dy)||1;const nx=actor.x+dx/n*8,ny=actor.y+dy/n*8;if(s.freePoint(nx,ny,'city',5,c.id)){actor.x=nx;actor.y=ny;}c.speed*=.8;}}
  if(driver&&a.pressed.reload){s.sound('horn');s.events.emit('noise.emitted',{x:c.x,y:c.y,zone:'city',actor:driver.id,level:0,reason:'Horn'});}
  if(c.hp<=0&&!c.exploded){c.speed=c.vx=c.vy=0;c.exploded=true;for(const target of s.actors)if(!target.vehicle&&target.zone==='city'&&G.dist(target,c)<54)s.damage(target,24*(1-G.dist(target,c)/64),s.actors.find(a=>a.id===c.lastDamageSource),'explosion');s.sound('crash');s.events.emit('noise.emitted',{x:c.x,y:c.y,zone:'city',actor:c.lastDamageSource,level:3,reason:'Vehicle explosion'});}
  if(c.hp<=0&&c.occupants.some(Boolean)){for(const id of [...c.occupants]){const actor=s.actors.find(a=>a.id===id);if(actor)G.exitCar(s,actor);}s.note('Engine lost. Find another vehicle.');}
 }
};
})();
