(() => {
const G=Drive;
G.companionAction=(s,a)=>{
 const c=s.controlled,act=G.emptyAction('companion');if(a.down||a.dead)return act;
 if(a.task==='operate'&&a.id==='teo'){const p=a.zone==='records'&&s.flags.recordsVisited&&!s.flags.ledger?{x:416,y:64,zone:'records'}:a.zone==='city'&&!s.flags.gate?G.content.points.service:null;if(p){if(G.dist(a,p)>24)return s.navAction(a,p);act.held.interact=true;}return act;}
 const wounded=s.crew.find(b=>b!==a&&b.down&&b.zone===a.zone);
 if(wounded){if(G.dist(a,wounded)<22){wounded.down=Math.max(0,wounded.down);wounded.revive=(wounded.revive||0)+G.STEP;if(wounded.revive>3){wounded.hp=60;wounded.down=0;wounded.task='follow';wounded.revive=0;wounded.invulnerable=1.5;s.sound('heal');}}else return s.navAction(a,wounded);return act;}
 if(a.zone==='records'&&c.zone==='city'&&!['hold','operate'].includes(a.task)){const p={x:80,y:336,zone:'records'};if(G.dist(a,p)>24)return s.navAction(a,p);act.held.interact=true;return act;}
 if(a.vehicle){const car=s.cars.find(v=>v.id===a.vehicle);if(!c.vehicle&&c.zone==='city'&&car&&Math.abs(car.speed)<20&&G.dist(a,c)<80)G.exitCar(s,a);return act;}
 if(c.vehicle&&a.zone==='city'){const car=s.cars.find(v=>v.id===c.vehicle);if(car&&Math.abs(car.speed)<20){if(G.dist(a,car)<42)G.enterCar(s,a,car);else return s.navAction(a,car);}return act;}
 const threat=s.actors.filter(o=>(o.team==='guard'||o.team==='police')&&o.enabled&&!o.dead&&o.zone===a.zone&&o.suspicion>.3&&G.dist(a,o)<180&&s.queryClear(a,o)).sort((a1,b)=>G.dist(a,a1)-G.dist(a,b))[0];
 if(threat){const regroup=c.zone===a.zone&&G.dist(a,c)>160&&!['hold','defend','operate'].includes(a.task),intent=regroup?s.navAction(a,{x:c.x,y:c.y,zone:c.zone}):act;if(a.id==='kit'&&a.abilityCD===0)intent.pressed.ability=true;const d=G.dist(a,threat);intent.aim=[(threat.x-a.x)/d,(threat.y-a.y)/d];intent.held.fire=true;if(a.ammo[a.weapon]===0)intent.pressed.reload=true;return intent;}
 if(a.task==='hold'||a.task==='defend'||a.task==='operate')return act;
 if(c.zone===a.zone){if(G.dist(a,c)>38)return s.navAction(a,{x:c.x+(a.id==='kit'?20:-20),y:c.y+28,zone:c.zone});}
 else if(a.zone==='city'&&c.zone!=='city'){const p=G.content.points.pickup;if(G.dist(a,p)>40)return s.navAction(a,p);a.task=a.id==='mara'?'drive':'defend';}
 return act;
};
G.enemyAction=(s,a)=>{
 const act=G.emptyAction(a.team),near=s.crew.filter(c=>!c.dead&&!c.down&&c.zone===a.zone).sort((x,y)=>G.dist(a,x)-G.dist(a,y))[0];
 const range=a.team==='police'?230:155,visible=near&&(a.team!=='police'||G.canRecognize(s,near,a))&&G.dist(a,near)<range&&s.queryClear(a,near)&&(a.team==='police'||a.suspicion>.6||Math.cos(Math.atan2(near.y-a.y,near.x-a.x)-a.facing)>.35)&&(!near.crouch||G.dist(a,near)<range*.55);
 if(visible&&(s.alert.heat>0||s.flags.gate||near.zone==='records')){a.suspicion=Math.min(1,a.suspicion+G.STEP*1.5);a.target={x:near.x,y:near.y,zone:near.zone};}
 else a.suspicion=Math.max(0,a.suspicion-G.STEP*.08);
 if(visible&&a.suspicion>.6){const d=G.dist(a,near);act.aim=[(near.x-a.x)/(d||1),(near.y-a.y)/(d||1)];if(d<170){act.held.fire=true;if(a.ammo[a.weapon]===0)act.pressed.reload=true;}else return s.navAction(a,near,a.team);}
 else if(a.target&&a.suspicion>0)return s.navAction(a,a.target,a.team);
 else if(a.team==='police'&&s.alert.last&&s.alert.heat>0&&s.alert.last.zone===a.zone){return s.navAction(a,s.alert.last,a.team);}
 else if(G.dist(a,a.home)>15)return s.navAction(a,{...a.home,zone:a.zone},a.team);
 return act;
};
G.updateActors=(s,baseDt,player)=>{
 for(const a of s.actors){if(!a.enabled||a.dead)continue;const ambient=a.team==='civilian';if(ambient&&s.tick%4!==0)continue;const dt=baseDt*(ambient?4:1);
  a.stagger=Math.max(0,(a.stagger||0)-dt);a.invulnerable=Math.max(0,(a.invulnerable||0)-dt);
  a.abilityCD=Math.max(0,a.abilityCD-dt);a.abilityTime=Math.max(0,a.abilityTime-dt);
  if(a.down){a.down-=dt;if(a.down<=0){a.down=0;a.dead=true;}continue;}
  let act=a===s.controlled?player:a.team==='crew'?G.companionAction(s,a):(a.team==='guard'||a.team==='police')?G.enemyAction(s,a):G.emptyAction('traffic');
  if(a.team==='civilian'){
   if(a.panic){a.panic=Math.max(0,a.panic-dt);act=s.navAction(a,a.flee||a.home,'traffic');}
   else {if(G.dist(a,a.goal)<12){a.goal=G.dist(a,a.home)<15?{x:a.home.x+48,y:a.home.y+70}:a.home;}act=s.navAction(a,a.goal,'traffic');act.held.sprint=false;}
  }
  a.cooldown=Math.max(0,a.cooldown-dt);
  if(a.reload>0){a.reload-=dt;if(a.reload<=0){const w=G.content.weapons[a.weapon],n=Math.min(w.mag-a.ammo[a.weapon],a.reserve[a.weapon]);a.ammo[a.weapon]+=n;a.reserve[a.weapon]-=n;}}
  if(act.pressed.ability&&a.team==='crew'&&a.abilityCD===0){a.abilityCD=25;a.abilityTime=6;if(a.id==='teo'){s.cameraDisabled=20;s.flags.gate=true;s.applyGates();s.note('CIRCUIT CUT — cameras offline for 20 seconds');}else s.note(a.data.ability.toUpperCase());s.sound('skill');}
  if(s.app.game.settings.sdSprintToggle!==false){if(act.pressed.sprint)a.sprintToggle=!a.sprintToggle;}else a.sprintToggle=!!act.held.sprint;if(s.app.game.settings.sdCrouchToggle!==false){if(act.pressed.crouch)a.crouch=!a.crouch;}else a.crouch=!!act.held.crouch;
  if(act.pressed.jump&&!a.vehicle)s.sound('jump');
  if(act.pressed.cover){s.sound('cover');if(a.cover)a.cover=false;else{const p=s.props.find(p=>p.solid&&p.zone===a.zone&&G.dist(a,p)<32);const closeWall=[0,1,2,3].some(i=>s.maps[a.zone]?.solidAt?.(a.x+Math.cos(i*Math.PI/2)*12,a.y+Math.sin(i*Math.PI/2)*12));if(p||closeWall){a.cover=true;s.note('IN COVER — aim and fire, or dodge to leave');}else s.note('Move beside a wall or crate to take cover');}}
  if(act.pressed.dodge){a.cover=false;if(!a.vehicle&&a.zone!=='gantry'){a.dodge(act.move.some(Boolean)?act.move:a.facing);a.invulnerable=.18;}}
  if(a===s.controlled&&act.pressed.previous)s.weaponIndex=(s.weaponIndex+2)%3;if(a===s.controlled&&act.pressed.next)s.weaponIndex=(s.weaponIndex+1)%3;if(a===s.controlled)a.weapon=['pistol','auto','shotgun'][s.weaponIndex];
  if(act.pressed.reload&&(!a.vehicle||a.seat>0)&&a.reload<=0&&a.reserve[a.weapon]>0&&a.ammo[a.weapon]<G.content.weapons[a.weapon].mag){a.reload=G.content.weapons[a.weapon].reload;s.sound('reload');}
  if(a.team==='crew'){const owner=a===s.controlled?s:a;if(a===s.controlled&&act.pressed.map)s.app.showMap();if(act.held.interact||act.pressed.interact)G.interact(s,a,act,dt);else{if(owner.interaction?.actor===a.id)owner.interaction=null;if(owner.interactLatch===a.id)owner.interactLatch=null;}}
  if(a.vehicle){if(a.seat>0)G.tryFire(s,a,act);continue;}
  if(a.zone==='gantry'){
   const p=a.platform;p.update(dt,s.maps.gantry,{x:act.move[0],up:act.move[1]>.25,down:act.move[1]<-.25,jump:!!act.held.jump,jumpPressed:!!act.pressed.jump},s.lifts);Object.assign(a,{x:p.x,y:0,z:p.z,vx:p.vx,vy:0,vz:p.vz,facing:p.facing>0?0:Math.PI});
   if(p.z<0||s.maps.gantry.kindAt(p.x,p.z+1)==='hazard'){s.damage(a,18,null,'fall');p.x=48;p.z=16;p.vx=p.vz=0;s.note('Safety line caught you. Try the upper gantry.');}
  }else{
   for(const v of s.spatial.near(a.x,a.y,30,a.zone)){if(!v.type||!G.carPoint(v,a.x,a.y,5))continue;const d=G.content.vehicles[v.type],co=Math.cos(v.facing),si=Math.sin(v.facing),dx=a.x-v.x,dy=a.y-v.y,u=dx*co+dy*si,w=-dx*si+dy*co,px=d.length/2+5-Math.abs(u),py=d.width/2+5-Math.abs(w);const nx=a.x+(px<py?co*Math.sign(u||1)*(px+.1):-si*Math.sign(w||1)*(py+.1)),ny=a.y+(px<py?si*Math.sign(u||1)*(px+.1):co*Math.sign(w||1)*(py+.1));if(s.freePoint(nx,ny,a.zone,5,v.id)){a.x=nx;a.y=ny;}}
   const old={x:a.x,y:a.y},move=a.cover||a.stagger>0?act.move.map(x=>x*.25):act.move;
   a.update(dt,s.maps[a.zone],{move,sprint:!!act.held.sprint||a.sprintToggle,crouch:a.crouch||a.cover,jumpPressed:!!act.pressed.jump});
   if(!s.freePoint(a.x,a.y,a.zone,5,a.vehicle)&&a.z<4){if(s.freePoint(old.x,a.y,a.zone,5,a.vehicle)){a.x=old.x;a.vx=0;}else if(s.freePoint(a.x,old.y,a.zone,5,a.vehicle)){a.y=old.y;a.vy=0;}else{a.x=old.x;a.y=old.y;a.vx=0;a.vy=0;}a.navAge+=.02;}
   if(a.hurt)s.damage(a,10,null,'fall');if(a.inHazard){a.respawn();s.damage(a,20,null,'fall');}
  }
  if(Math.hypot(...act.aim)>.1){a.facing=Math.atan2(act.aim[1],act.aim[0]);a.aimAt=act.aim;}else a.aimAt=null;
  G.tryFire(s,a,act);
 }
};
G.tryFire=(s,a,act)=>{
 if(!act.held.fire||a.cooldown>0||a.reload>0||a.down||a.dead)return;
 const weapon=G.content.weapons[a.weapon];if(a.ammo[a.weapon]<=0){if(a===s.controlled)s.note('EMPTY — Reload');return;}
 const close=s.actors.find(b=>b.team!==a.team&&b.team!=='civilian'&&!b.dead&&b.zone===a.zone&&G.dist(a,b)<19);
 if(close&&!act.held.aim){s.damage(close,30,a,'melee');a.cooldown=.5;s.sound('melee');return;}
 a.ammo[a.weapon]--;a.cooldown=weapon.rate*(a.team==='crew'?1:5);s.metrics.shots++;a.lastShotAt=s.time;s.sound('shot');
 const spread=weapon.spread*(a.abilityTime>0&&a.id==='kit'?.25:1),base=a.facing;
 for(let i=0;i<weapon.pellets;i++){if(Object.values(s.bullets).reduce((n,b)=>n+b.list.length,0)>=G.content.caps.bullets)break;const ang=base+(s.rng.next()-.5)*(a.team==='crew'?spread:spread+.22),vx=Math.cos(ang)*650,vy=Math.sin(ang)*650;s.bullets[a.zone].fire({x:a.x+Math.cos(ang)*9,y:a.y+Math.sin(ang)*9,z:a.z+15,vx,vy:a.zone==='gantry'?0:vy,vz:a.zone==='gantry'?vy:0,r:1,dmg:weapon.damage,life:weapon.range/650,team:a.team,data:{actor:a.id},color:a.team==='crew'?'#ffe1a1':'#ff977e'});}
 s.events.emit('noise.emitted',{x:a.x,y:a.y,zone:a.zone,actor:a.id,level:2,reason:'Gunfire reported'});
};
G.updateCombat=(s,dt)=>{
 for(const [zone,bullets]of Object.entries(s.bullets)){
  for(const b of bullets.list){const from={x:b.x,y:b.y,z:b.z},to={x:b.x+b.vx*dt,y:b.y+b.vy*dt,z:b.z+b.vz*dt};let hit=null,at=1;
   if(zone!=='gantry'){const ray=s.maps[zone].ray(from,to);if(!ray.clear){at=ray.t;hit='wall';}}
   else if(s.maps.gantry.solidAt(to.x,to.z)){hit='wall';at=0;}
   if(zone==='gantry')for(const l of s.lifts){const t=G.segmentBox2D({x:from.x,y:from.z},{x:to.x,y:to.z},{x:l.x-l.w/2,y:l.z,w:l.w,h:l.h});if(t!==null&&t<=at){hit='lift';at=t;}}
   for(const a of s.spatial.near(b.x,b.y,24,zone)){if(a.type||a.dead||a.vehicle||a.id===b.data.actor||a.team===b.team||(b.team==='guard'&&a.team==='police')||(b.team==='police'&&a.team==='guard'))continue;
    if(zone!=='gantry'&&(b.z<a.z||b.z>a.z+28))continue;
    const t=G.segmentCircle(zone==='gantry'?{x:from.x,y:from.z}:from,zone==='gantry'?{x:to.x,y:to.z}:to,zone==='gantry'?{x:a.x,y:a.z+13}:a,6);if(t!==null&&t<=at){at=t;hit=a;}
   }
   if(zone==='city')for(const c of s.cars){if(c.occupants.includes(b.data.actor)||b.z<0||b.z>32)continue;const t=G.carSegment(c,from,to,b.r);if(t!==null&&t<=at){at=t;hit=c;}}
   if(hit){b.dead=true;if(typeof hit==='object'){s.damage(hit,b.dmg*(hit.type?.4:1),s.actors.find(a=>a.id===b.data.actor));}if(!s.game.headless)s.game.particles.sparks(from.x,from.y,from.z,2,null,{color:'#ffbf75'});}
  }bullets.update(dt);
 }
};
})();
