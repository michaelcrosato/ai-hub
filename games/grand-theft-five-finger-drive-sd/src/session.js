(() => {
const G=Drive,E=G.E;
G.Session=class {
 constructor(app,{seed=516,mission='meter',demo=false,restore=null,free=false,yard=false}={}) {
  this.app=app;this.game=app.game;this.seed=seed;this.rng=new G.RNG(seed);this.trafficRng=new G.RNG(seed^0xabc123);this.demo=demo;this.free=free;this.yard=yard;this.tick=0;this.time=0;this.events=new G.Events();this.maps=G.buildMaps();this.spatial=new G.Spatial();this.crew=[];this.actors=[];this.cars=[];this.props=[];this.lifts=[{id:'gantry-lift',x:96,z:16,w:32,h:5,vx:0,vz:14,oneway:true},{id:'cargo',x:450,z:16,w:24,h:28,vx:25,vz:0,oneway:false,motion:'horizontal'}];this.reservations={};this.tracks=[];this.control='mara';this.flags={};this.money=250;this.rewards=[];this.trace=[];this.dialogue=null;this.notification=null;this.progress=0;this.approach='quiet';this.route='canal';this.outcome=null;this.outcomeTime=0;this.interaction=null;this.weaponIndex=0;this.cameraDisabled=0;this.alert={heat:0,mode:'patrol',last:null,timer:0,evidence:null,reason:''};this.metrics={shots:0,hits:0,crashes:0,crimes:0,switches:0,views:{iso:0,topdown:0,side:0},recoveries:0,botActions:0};
  this.definition=G.content.missions[mission];if(!this.definition)throw Error('Unknown mission '+mission);G.validateMission(this.definition);
  this.save=new G.Save(demo?new G.MemoryStore():app.storage);this.bullets={city:new E.Bullets(this.game,{max:128,sparks:false}),records:new E.Bullets(this.game,{max:128,sparks:false}),gantry:new E.Bullets(this.game,{max:128,plane:'side',sparks:false})};
  for(const [i,d]of G.content.crew.entries()){const a=this.makeActor(d.id,(this.definition.start?.x??338)+i*20,(this.definition.start?.y??380)+i*12,'crew',d.color);a.data=d;a.weapon=['pistol','auto','shotgun'][i];a.task='follow';a.abilityCD=0;a.abilityTime=0;a.rig=new E.Humanoid({size:d.id==='teo'?1.18:1.25,build:d.id==='kit'?'bulky':'heroic',weapon:'gun',outfit:'shirt',colors:{cloth:d.color,skin:d.skin,hair:d.hair,pants:'#34464e',boots:'#28363b'}});this.crew.push(a);}
  this.spawnCar('getaway','sport',690,440,0,{parked:true});this.spawnCar('van','van',735,490,0,{parked:true});this.spawnCar('spare','compact',430,400,0,{parked:true});
  const lanes=G.content.traffic.starts;
  for(let i=0;i<11;i++){const p=lanes[i];this.spawnCar('traffic'+i,['compact','taxi','van','sport'][i%4],p[0],p[1],i<4?0:i<6?Math.PI/2:i<9?Math.PI:-Math.PI/2,{traffic:true,lane:0,way:i<4?0:i<6?1:i<9?2:3});}
  for(let i=0;i<24;i++){const x=[320,800,960,1440,1600,2240][i%6],y=[330,690,930,1470][Math.floor(i/6)];const a=this.makeActor('ped'+i,x,y,'civilian',['#a0b2b0','#e5ac7e','#bb88a0','#d3b66b','#6e95ad','#bbbc8a'][i%6]);a.home={x,y};a.goal={x:x+48,y:y+70};a.report=0;}
  {const a=this.actors.find(a=>a.id==='ped0'),v=this.cars.find(v=>v.id==='spare');v.occupants[0]=a.id;a.vehicle=v.id;a.seat=0;a.x=v.x;a.y=v.y;}
  for(let i=0;i<8;i++){const a=this.makeActor('guard'+i,i<5?1660+i*38:320+(i-5)*32,i<5?566:150,i<5?'guard':'guard','#597d77',i<5?'city':'records');a.weapon=i%2?'pistol':'auto';a.home={x:a.x,y:a.y};a.facing=Math.PI/2;}
  for(let i=0;i<6;i++){const a=this.makeActor('police'+i,2100+i*12,810,'police','#607eab');a.home={x:a.x,y:a.y};a.enabled=i<2;a.weapon='pistol';}
  for(let i=0;i<2;i++){const v=this.cars.find(c=>c.id==='traffic'+(9+i)),a=this.actors.find(a=>a.id==='police'+i);Object.assign(v,{type:'police',color:'#e5ded0',x:2142,y:850+i*75,facing:Math.PI/2,traffic:false,police:true,hp:160,maxHP:160,patrolPoint:0});v.occupants[0]=a.id;a.vehicle=v.id;a.seat=0;a.x=v.x;a.y=v.y;}
  this.makeProps();this.solidProps=this.props.filter(p=>p.solid);this.events.on('noise.emitted',e=>this.hearCrime(e));this.events.on('damage.applied',e=>{if(e.target.startsWith('crew'))return;});
  if(restore)this.restore(restore);if(this.yard)this.setupYard(!!restore);
  this.spatial.rebuild([...this.actors,...this.cars]);this.bot=new G.Director(this);
  this.say(this.definition.stages[0].line||'MARA: The city is open. Find your own way.');
 }
 get controlled(){return this.crew.find(a=>a.id===this.control)||this.crew[0];}
 get stage(){return this.definition.stages[this.progress];}
 get map(){return this.maps[this.controlled.zone];}
 makeActor(id,x,y,team,color,zone='city'){
  const a=new E.Mover({x,y,z:0,r:5,walk:60,run:92,sprintSpeed:128,sneak:40,climbMax:24,gravity:700});
  Object.assign(a,{id,zone,team,color,hp:team==='crew'?120:team==='civilian'?60:70,maxHP:team==='crew'?120:70,enabled:true,weapon:'pistol',ammo:{pistol:12,auto:24,shotgun:6},reserve:{pistol:72,auto:120,shotgun:36},reload:0,cooldown:0,vehicle:null,seat:null,task:'patrol',down:0,dead:false,cover:false,abilityCD:0,abilityTime:0,nav:null,navAge:0,aiAge:0,aimAt:null,suspicion:0});
  a.rig=new E.Humanoid({size:1.12,build:'heroic',weapon:team==='civilian'?null:'gun',outfit:'shirt',colors:{cloth:color,pants:'#354a56',skin:['#e2af82','#a76d50','#c68b68'][this.actors.length%3],hair:'#46382e'}});this.actors.push(a);return a;
 }
 spawnCar(id,type,x,y,facing,extra={}){const d=G.content.vehicles[type],v={id,type,x,y,z:0,facing,speed:0,vx:0,vy:0,hp:d.hp,maxHP:d.hp,color:d.color,zone:'city',radius:d.length*.6,occupants:Array(d.seats).fill(null),reservation:{},...extra};this.cars.push(v);return v;}
 makeProps(){
  for(const p of G.content.places)this.props.push({id:'sign',x:p.x,y:p.y-36,label:p.name,zone:'city'});
  for(let x=320;x<2300;x+=144){this.props.push({id:'palm',x,y:1700,zone:'city'});this.props.push({id:'streetLamp',x,y:700,zone:'city'});this.props.push({id:'bollard',x,y:1480,zone:'city'});}
  for(let i=0;i<20;i++){this.props.push({id:G.content.props[i%G.content.props.length],x:920+(i%5)*32,y:900+Math.floor(i/5)*32,zone:'city'});}
  for(let x=330;x<760;x+=64)this.props.push({id:'meter',x,y:330,zone:'city'});
  for(const [x,y]of [[1648,655],[1680,655],[1816,650],[1850,650]])this.props.push({id:'crate',x,y,zone:'city',solid:true});
  for(const [id,x,y]of [['terminal',416,64],['camera',470,50],['aircon',56,64],['chair',416,96],['table',380,240]])this.props.push({id,x,y,zone:'records'});
 }
 say(text,duration=5){if(!text)return;this.dialogue={text,start:this.time,duration,until:this.time+duration};this.app.sound?.('radio');}
 note(text,duration=3){this.notification={text,until:this.time+duration};}
 sound(id){if(!this.demo||this.app.audioUnlocked)this.app.sound?.(id);}
 queryClear(a,b,{ignore=null,radius=0}={}){if(a.zone!==b.zone)return false;const map=this.maps[a.zone];if(a.zone==='gantry')return true;if(!map.ray(a,b,{eye:18,target:18}).clear)return false;for(const c of this.cars){if(c.id===ignore||a.vehicle===c.id||b.vehicle===c.id)continue;if(G.segmentCircle(a,b,c,G.content.vehicles[c.type].width*.45+radius)!==null)return false;}return true;}
 freePoint(x,y,zone='city',radius=5,ignore=null){const map=this.maps[zone];if(zone==='gantry')return !map.solidAt(x,y);if(!map.standable(x,y,0,radius))return false;for(const c of this.spatial.near(x,y,radius+30,zone)){if(!c.type)continue;if(zone!=='city'||c.id===ignore)continue;if(G.carPoint(c,x,y,radius))return false;}for(const p of (this.solidProps||[]))if(p.solid&&p.zone===zone&&Math.hypot(p.x-x,p.y-y)<radius+10)return false;return true;}
 navAction(actor,target,source='companion',radius=5){
  const a=G.emptyAction(source);if(actor.zone!==target.zone&&target.zone)return a;
  actor.navAge=(actor.navAge||0)+(actor.team==='civilian'?1/30:G.STEP);
  if(!actor.nav||!actor.navTarget||G.dist(actor.navTarget,target)>48||actor.navAge>2){const map=this.maps[actor.zone], queries={w:map.w,h:map.h,T:map.T,standable:(x,y,z,r)=>this.freePoint(x,y,actor.zone,r+2,target.id)};actor.nav=G.path(queries,actor,target,radius,radius>10?32:16);actor.navTarget={x:target.x,y:target.y,z:target.z||0,zone:target.zone,id:target.id};actor.navAge=0;}
  while(actor.nav.length&&G.dist(actor,actor.nav[0])<6)actor.nav.shift();
  const p=actor.nav[0]||target,dx=p.x-actor.x,dy=p.y-actor.y,d=Math.hypot(dx,dy);if(d>2)a.move=[dx/d,dy/d];a.held.sprint=true;return a;
 }
 switchTo(id){const a=this.crew.find(c=>c.id===id);if(!a||a.dead||a.down||id===this.control)return false;this.control=id;this.interaction=null;this.metrics.switches++;this.events.emit('crew.switched',{id});this.app.zoneChanged();this.sound('switch');return true;}
 portal(actor,zone,anchor){
  if(actor.vehicle||actor.down)return false;const before=actor.zone;actor.zone=zone;Object.assign(actor,{x:anchor.x,y:anchor.y||0,z:anchor.z||0,vx:0,vy:0,vz:0,action:null,nav:null});
  if(zone==='gantry')actor.platform=new E.Platformer({x:anchor.x,z:anchor.z||16,run:100,jump:350});else actor.platform=null;
  this.interaction=null;this.events.emit('zone.entered',{actor:actor.id,from:before,to:zone});if(actor===this.controlled){if(zone==='records')this.flags.recordsVisited=true;if(zone==='gantry')this.flags.gantryVisited=true;this.app.zoneChanged();}return true;
 }
 damage(target,amount,source,kind='bullet'){
  if(target.dead||target.down||target.hp<=0||target.invulnerable>0)return;
  if(target.type){target.hp=Math.max(0,target.hp-amount);target.lastDamageSource=source?.id;this.events.emit('damage.applied',{target:target.id,amount,source:source?.id||'world',kind});return;}
  if(source&&source!==target&&source.team===target.team)return;
  if(['collision','fall','explosion'].includes(kind))target.invulnerable=.25;
  if(source?.team==='crew'&&target.team==='civilian'){this.flags.civilianHarm=(this.flags.civilianHarm||0)+1;this.crime(source,2,'Civilian harmed');}
  if(target.team==='crew'&&this.app.assist)amount*=.55;
  if(target.cover&&kind==='bullet')amount*=.25;const steady=target.id==='kit'&&target.abilityTime>0;if(steady)amount*=.85;target.stagger=steady?0:.12;
  if(target===this.controlled)this.interaction=null;else target.interaction=null;const absorbed=Math.min(target.armor||0,amount*.6);target.armor=Math.max(0,(target.armor||0)-absorbed);amount-=absorbed;target.hp=Math.max(0,target.hp-amount);target.hit=.2;target.lastHurt=this.time;this.events.emit('damage.applied',{target:target.id,amount,source:source?.id||'world',kind});
  if(target===this.controlled){this.sound('hurt');if(!this.demo&&!this.game.reduceMotion)this.game.shake(2*(this.game.settings.sdShake??1));}
  if(target.hp===0){if(target.team==='crew'){target.down=45;target.task='down';this.events.emit('actor.downed',{id:target.id});this.say('KIT: Crew down. Get close and hold INTERACT to help.');}else{target.dead=true;this.metrics.hits++;}}
 }
 checkpoint(){if(this.demo)return;this.lastCheckpoint=this.serialize();this.save.write(this.lastCheckpoint);this.events.emit('checkpoint.requested',{progress:this.progress});this.note(this.save.error||'CHECKPOINT SAVED');}
 serialize(){
  const fields=['id','x','y','z','zone','facing','hp','armor','weapon','ammo','reserve','reload','vehicle','seat','task','down','dead','abilityCD','abilityTime','enabled','suspicion','target','witness','panic','flee','goal','home','cooldown','lastHurt','cover','crouch','sprintToggle','revive','nav','navTarget','navAge','vx','vy','vz','platform','stagger','invulnerable'];
  return {gameVersion:G.VERSION,contentVersion:1,engineRevision:'cfa866aa45474868350cad1a7fc015e612f9305f',seed:this.seed,mission:this.definition.id,progress:this.progress,flags:G.copy(this.flags),control:this.control,time:this.time,money:this.money,rewards:[...this.rewards],approach:this.approach,route:this.route,cameraDisabled:this.cameraDisabled,alert:G.copy(this.alert),crew:this.crew.map(a=>Object.fromEntries(fields.map(k=>[k,G.copy(a[k]??null)]))),actors:this.actors.map(a=>Object.fromEntries(fields.map(k=>[k,G.copy(a[k]??null)]))),cars:this.cars.map(c=>G.copy({...c,reservation:{}})),rng:this.rng.state,trafficRng:this.trafficRng.state,metrics:G.copy(this.metrics),free:this.free,yard:this.yard,lifts:G.copy(this.lifts),tick:this.tick,weaponIndex:this.weaponIndex,trace:G.copy(this.trace),bullets:Object.fromEntries(Object.entries(this.bullets).map(([k,b])=>[k,G.copy(b.list)]))};
 }
 restore(p){
  if(p.mission!==this.definition.id)throw Error('Checkpoint mission mismatch');
  for(const k of ['progress','flags','control','time','money','rewards','approach','route','cameraDisabled','alert','metrics','free','yard','lifts','tick','weaponIndex','trace'])if(p[k]!==undefined)this[k]=G.copy(p[k]);
  this.rng.state=p.rng;this.trafficRng.state=p.trafficRng;
  for(const a of this.actors){const v=(p.actors||p.crew).find(c=>c.id===a.id);if(v){Object.assign(a,G.copy(v));a.target=null;a.interaction=null;a.interactLatch=null;if(a.zone==='gantry'){const state=v.platform;a.platform=new E.Platformer({x:a.x,z:a.z,run:100,jump:350});if(state){Object.assign(a.platform,G.copy(state));a.platform.ground=this.lifts.find(l=>l.id===state.ground?.id)||null;}}}}
  this.cars=G.copy(p.cars);for(const b of Object.values(this.bullets))b.clear();this.applyGates();this.lastCheckpoint=G.copy(p);
 }
 applyGates(){if(this.flags.gate){this.maps.city.fill(101,38,1,2,0);this.maps.city.fill(108,43,2,1,0);}}
 fail(reason){if(this.outcome)return;this.outcome='failed';this.outcomeTime=this.time;this.note(reason,30);this.events.emit('mission.failed',{reason});this.app.result?.(false,reason);}
 complete(){if(this.outcome)return;const transaction=`${this.definition.id}:${this.seed}`;if(!this.rewards.includes(transaction)){this.money+=this.definition.reward;this.rewards.push(transaction);this.events.emit('reward.committed',{id:transaction,value:this.definition.reward});}this.outcome='success';this.outcomeTime=this.time;this.flags.complete=true;this.checkpoint();this.sound('success');this.app.result?.(true);}
 step(dt,action){
  if(!(dt>0))return;this.tick++;this.time+=dt;this.metrics.views[this.controlled.zone==='city'?'iso':this.controlled.zone==='records'?'topdown':'side']+=dt;
  if(this.outcome){if(this.demo&&this.time-this.outcomeTime>8)this.app.nextDemo();return;}
  this.tracks=this.tracks.filter(t=>(t.life-=dt)>0).slice(-160);
  for(const lift of this.lifts){if(lift.motion==='horizontal'){if(lift.x>568)lift.vx=-25;if(lift.x<424)lift.vx=25;lift.x+=lift.vx*dt;continue;}if(lift.z>=58)lift.vz=-14;if(lift.z<=16)lift.vz=14;lift.z+=lift.vz*dt;}
  this.cameraDisabled=Math.max(0,this.cameraDisabled-dt);
  if(this.interaction&&this.interaction.actor!==this.control)this.interaction=null;
  this.spatial.rebuild([...this.cars,...this.actors.filter(a=>!a.dead)]);
  G.updateVehicles(this,dt,action);G.updateActors(this,dt,action);G.updateCombat(this,dt);G.updateCity(this,dt);G.updateMission(this,dt);this.events.flush();
  if(this.dialogue?.until<this.time)this.dialogue=null;if(this.notification?.until<this.time)this.notification=null;
  const c=this.controlled;if(c.dead||c.down){const alive=this.crew.find(a=>!a.dead&&!a.down);if(alive)this.switchTo(alive.id);else this.fail('CREW DOWN — Retry the last checkpoint.');}
  if(this.crew.some(a=>a.dead))this.fail('CREW LOST — Retry the last checkpoint.');
  for(const a of this.actors){if(!a.enabled)continue;if(a.vehicle){const v=this.cars.find(v=>v.id===a.vehicle);if(v){a.x=v.x;a.y=v.y;a.z=0;}}if(!this.game.headless)G.animateActor(this,a,dt);a.hit=Math.max(0,(a.hit||0)-dt);}
  this.game.particles.list.splice(400);this.app.updateCamera();
 }
 dispose(){this.events.dispose();for(const b of Object.values(this.bullets))b.clear();this.interaction=null;this.game.particles.list.length=0;}
 snapshot(){return {seed:this.seed,tick:this.tick,scene:this.app.mode,mission:this.definition.id,stage:this.stage?.id||'complete',progress:this.progress,view:this.controlled.zone,control:this.control,crew:this.crew.map(a=>({id:a.id,x:+a.x.toFixed(2),y:+a.y.toFixed(2),z:+a.z.toFixed(2),zone:a.zone,hp:+a.hp.toFixed(1),vehicle:a.vehicle,seat:a.seat,task:a.task,down:a.down})),heat:this.alert.heat,police:this.alert.mode,flags:{...this.flags},outcome:this.outcome,cars:this.cars.length,actors:this.actors.length,bullets:Object.values(this.bullets).reduce((n,b)=>n+b.list.length,0),money:this.money,metrics:G.copy(this.metrics),trace:this.trace.slice(-20)};}
};
})();
