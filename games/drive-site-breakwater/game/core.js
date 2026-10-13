/* BREAKWATER — Original mission and flight simulation. MIT. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angleDiff=(a,b)=>((b-a+Math.PI*3)%(Math.PI*2))-Math.PI;
const BASE={x:240,y:940}, RELAY={x:795,y:310}, MODULE={x:293,y:918};
const LIMITS={width:1320,height:1180};
const STAGES=[
 {title:'Silence the radar',detail:'Destroy the coastal radar. Its signal increases enemy range.',short:'RADAR RELAY',x:460,y:490},
 {title:'Bring the engineers home',detail:'Hold E above the four dock engineers. Deliver them to the rescue pad.',short:'DOCK RESCUE',x:751,y:804},
 {title:'Restore the flood control',detail:'Collect the control module at base. Lower it onto the inland station.',short:'CONTROL STATION',x:795,y:310},
 {title:'Stop the command crawler',detail:'Destroy both weapon mounts. Then attack the exposed power unit.',short:'COMMAND CRAWLER',x:1070,y:280},
 {title:'Complete the extraction',detail:'Recover the last technician. Return to base and hold E to land.',short:'FINAL EXTRACTION',x:1100,y:230},
 {title:'Operation complete',detail:'The crew is safe. The flood barrier is back online.',short:'ALL CLEAR',x:240,y:940}
];
const WEAPONS=[
 {id:'cannon',label:'CANNON',damage:9,interval:.105,speed:440,life:.8,max:600,radius:0},
 {id:'rocket',label:'ROCKET',damage:58,interval:.5,speed:280,life:1.2,max:24,radius:30},
 {id:'missile',label:'GUIDED',damage:130,interval:.95,speed:230,life:2.2,max:6,radius:34}
];
const ISLANDS=[
 [[60,955],[92,838],[180,764],[330,784],[423,881],[406,1046],[311,1110],[149,1089],[74,1032]],
 [[281,405],[336,276],[510,166],[697,184],[824,230],[953,352],[891,471],[989,557],[1025,739],[929,860],[832,925],[689,915],[580,773],[415,772],[315,611]],
 [[885,172],[979,91],[1131,102],[1263,227],[1232,376],[1159,477],[985,419],[914,320]],
 [[46,436],[87,348],[187,328],[266,399],[255,520],[178,565],[71,543]],
 [[1030,848],[1116,788],[1212,846],[1244,955],[1181,1026],[1056,977]]
];
const ROADS=[[[195,1005],[240,940],[322,884]],[[430,685],[460,490],[515,340],[680,287],[795,310],[869,389]],[[458,584],[610,633],[741,735],[781,843]],[[609,633],[759,559],[920,595]],[[1000,391],[1070,280],[1140,211]]];
function pointInPolygon(x,y,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))inside=!inside;}return inside;}
function landAt(x,y){return ISLANDS.some(p=>pointInPolygon(x,y,p));}
function segmentCircle(ax,ay,bx,by,x,y,r){const dx=bx-ax,dy=by-ay,d=dx*dx+dy*dy,t=d?clamp(((x-ax)*dx+(y-ay)*dy)/d,0,1):0;return (ax+dx*t-x)**2+(ay+dy*t-y)**2<=r*r;}
const ENEMY_DEFS=[
 ['radar','radar',460,490,200],['coast-gun','gun',395,573,115],['radar-sam','sam',534,454,155],
 ['dock-gun','gun',665,769,125],['dock-truck','patrol',814,704,170],['dock-sam','sam',886,834,150],
 ['west-gun','gun',211,431,115],['relay-sam','sam',735,416,150],['relay-gun','gun',858,333,125],
 ['yard-truck','patrol',934,568,170],['patrol-boat','boat',578,1002,140],['east-gun','gun',1114,451,140],
 ['north-sam','sam',1190,257,160],['tank-a','tank',591,617,45],['tank-b','tank',610,619,45],
 ['boss-left','bossMount',1043,283,210],['boss-right','bossMount',1097,283,210],['boss-core','bossCore',1070,280,440]
];
function makeEnemies(){return ENEMY_DEFS.map((d,i)=>({id:d[0],kind:d[1],x:d[2],y:d[3],homeX:d[2],homeY:d[3],hp:d[4],maxHp:d[4],r:d[1]==='bossCore'?25:d[1]==='radar'?23:d[1]==='bossMount'?14:d[1]==='tank'?11:15,z:d[1]==='radar'?21:12,face:-Math.PI*.5,cooldown:.8+(i%5)*.25,wind:0,flash:0,dead:false,active:!d[0].startsWith('boss'),moveTime:i}));}
function makeCrew(){return [{id:'engineer-1',x:734,y:811,role:'engineer'},{id:'engineer-2',x:750,y:801,role:'engineer'},{id:'engineer-3',x:768,y:805,role:'engineer'},{id:'engineer-4',x:758,y:822,role:'engineer'},{id:'worker-1',x:139,y:467,role:'optional'},{id:'worker-2',x:157,y:477,role:'optional'},{id:'technician',x:1100,y:230,role:'final'}].map(c=>({...c,state:'waiting',z:0}));}
class Mission{
 constructor(options={}){
  this.assist=!!options.assist;this.status='ready';this.stage=0;this.time=0;
  this.player={...BASE,z:43,vx:0,vy:0,face:-Math.PI*.5,hp:this.assist?220:160,maxHp:this.assist?220:160,fuel:100,ammo:[600,24,6],weapon:0,cooldown:0,flare:0,flareActive:0,hit:0,passengers:[],module:false,winch:0,winchTarget:null,landed:false};
  this.enemies=makeEnemies();this.crew=makeCrew();this.projectiles=[];
  this.supplies=[{id:'yard-ammo',type:'ammo',x:574,y:657,used:false},{id:'yard-fuel',type:'fuel',x:549,y:656,used:false},{id:'east-cache',type:'all',x:972,y:527,used:false},{id:'west-repair',type:'repair',x:176,y:500,used:false}];
  this.score=0;this.kills=0;this.delivered=0;this.engineers=0;this.optional=0;this.finalDelivered=false;this.radar=true;this.moduleReady=false;this.relayOnline=false;this.bossTime=180;this.bossPhase=0;this.serviceTime=0;this.checkpoint=null;this.losses=0;this.reason='';this.waypoint=null;this.events=[];
  this.message('CONTROL','Echo Seven, clear the radar. Keep moving when you fire.');
 }
 emit(type,data={}){this.events.push({type,...data});}
 message(who,text){this.emit('radio',{who,text});}
 start(){this.status='playing';this.emit('start');}
 target(){
  if(this.stage===2&&!this.player.module)return {...MODULE,short:'COLLECT CONTROL MODULE'};
  if(this.stage===4&&this.crew.find(c=>c.role==='final').state!=='waiting')return {...BASE,short:'RETURN TO BASE'};
  if(this.stage===1){const c=this.crew.find(c=>c.role==='engineer'&&c.state==='waiting');if(c&&this.player.passengers.length<6)return {...c,short:'DOCK RESCUE'};return {...BASE,short:'DELIVER ENGINEERS'};}
  return STAGES[this.stage];
 }
 interaction(){
  const p=this.player;
  if(distance(p,BASE)<38)return {id:'base',...BASE,label:this.stage===4&&p.passengers.includes('technician')?'LAND AND COMPLETE EXTRACTION':p.passengers.length?'DELIVER CREW / RESUPPLY':'LAND / RESUPPLY',seconds:1.8};
  if(this.stage===2&&!p.module&&distance(p,MODULE)<25)return {id:'module',...MODULE,label:'LIFT CONTROL MODULE',seconds:2.3};
  if(this.stage===2&&p.module&&distance(p,RELAY)<30)return {id:'relay',...RELAY,label:'LOWER CONTROL MODULE',seconds:3};
  const crew=this.crew.filter(c=>c.state==='waiting'&&(c.role==='optional'||c.role==='engineer'&&this.stage>=1||c.role==='final'&&this.stage>=4)&&distance(p,c)<28).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  if(crew)return {id:crew.id,x:crew.x,y:crew.y,label:p.passengers.length>=6?'CABIN FULL — RETURN TO BASE':'WINCH '+(crew.role==='engineer'?'ENGINEER':crew.role==='final'?'TECHNICIAN':'WORKER'),seconds:this.assist?1.1:1.55,blocked:p.passengers.length>=6};
  const sup=this.supplies.find(s=>!s.used&&distance(p,s)<26);if(sup)return {id:sup.id,x:sup.x,y:sup.y,label:'LIFT '+sup.type.toUpperCase()+' SUPPLIES',seconds:1.3};return null;
 }
 setStage(n){
  if(n<=this.stage)return;this.stage=n;this.score+=1000;this.emit('objective',{stage:n});
  const messages={1:'Radar is down. Recover the four engineers at the dock. Hold E above each rescue marker.',2:'Engineers are safe. Lift the control module beside the pad. Take it to the inland station.',3:'Flood control is online. Destroy the command crawler before it destroys the controls.',4:'Crawler stopped. One technician remains on the north platform. Recover them and return to base.'};
  if(messages[n])this.message('CONTROL',messages[n]);
  if(n===2){this.moduleReady=true;this.saveCheckpoint();}
  if(n===3){this.enemies.filter(e=>e.id.startsWith('boss')).forEach(e=>e.active=true);this.bossPhase=1;this.bossTime=180;this.saveCheckpoint();}
  if(n===4)this.saveCheckpoint();
 }
 saveCheckpoint(){this.checkpoint=this.snapshot();this.emit('checkpoint');}
 snapshot(){const keys=['stage','time','player','enemies','crew','supplies','score','kills','delivered','engineers','optional','finalDelivered','radar','moduleReady','relayOnline','bossTime','bossPhase','assist','losses'];const s={version:1};for(const k of keys)s[k]=JSON.parse(JSON.stringify(this[k]));return s;}
 restore(snap,{countLoss=true}={}){
  if(!snap||snap.version!==1)return false;const saved=JSON.parse(JSON.stringify(snap)),losses=Math.max(this.losses,saved.losses||0)+(countLoss?1:0);for(const k of Object.keys(saved))if(k!=='version')this[k]=saved[k];
  const p=this.player;p.hp=p.maxHp;p.fuel=100;p.ammo=[600,24,6];p.vx=p.vy=0;p.cooldown=0;p.flare=0;p.winch=0;p.winchTarget=null;p.hit=0;p.x=BASE.x;p.y=BASE.y;p.z=43;p.landed=false;
  this.projectiles=[];this.events=[];this.status='playing';this.losses=losses;this.reason='';this.checkpoint={...snap,losses};this.serviceTime=0;if(this.stage===3)this.bossTime=180;
  this.message('CONTROL','Checkpoint restored. Your aircraft is ready at base.');this.emit('restored');return true;
 }
 fail(reason){if(this.status!=='playing')return;this.status='failed';this.reason=reason;this.emit('failure',{reason});}
 finish(){if(this.status!=='playing')return;this.status='success';this.stage=5;this.player.landed=true;this.score+=2000+this.optional*600+Math.max(0,Math.round((900-this.time)*3));this.emit('success');}
 doInteraction(item){
  const p=this.player;
  if(item.id==='base'){
   let n=0;for(const id of p.passengers){const c=this.crew.find(q=>q.id===id);c.state='safe';this.delivered++;n++;this.score+=450;if(c.role==='engineer')this.engineers++;if(c.role==='optional')this.optional++;if(c.role==='final')this.finalDelivered=true;}
   p.passengers=[];p.hp=clamp(p.hp+n*30,0,p.maxHp);p.landed=true;
   if(n){this.emit('delivered',{count:n});this.message('RESCUE PAD',n+' crew delivered. Repair and supply crews are ready.');}
   if(this.stage===1&&this.engineers===4)this.setStage(2);
   if(this.stage===4&&this.finalDelivered){this.finish();return;}this.serviceTime=5;
  }else if(item.id==='module'){p.module=true;this.emit('pickup',{x:p.x,y:p.y,kind:'module'});this.message('CONTROL','Module secure. Flight speed is reduced under load.');}
  else if(item.id==='relay'){p.module=false;this.relayOnline=true;this.setStage(3);this.emit('relay',{x:RELAY.x,y:RELAY.y});}
  else{const c=this.crew.find(q=>q.id===item.id);if(c){c.state='aboard';p.passengers.push(c.id);this.emit('pickup',{x:c.x,y:c.y,kind:'crew'});this.score+=100;}
   else{const s=this.supplies.find(q=>q.id===item.id);if(s&&!s.used){s.used=true;if(s.type==='fuel'||s.type==='all')p.fuel=100;if(s.type==='ammo'||s.type==='all')p.ammo=[600,24,6];if(s.type==='repair'||s.type==='all')p.hp=Math.min(p.maxHp,p.hp+90);this.emit('supply',{kind:s.type});}}}
 }
 fire(input){
  const p=this.player,w=WEAPONS[p.weapon];if(p.cooldown>0||p.landed||p.winch>0)return;
  if(p.ammo[p.weapon]<1){p.cooldown=.4;this.emit('empty');return;}
  let target=input.targetId?this.enemies.find(e=>e.id===input.targetId&&!e.dead&&e.active):null;
  if(w.id==='missile'&&!target)target=this.enemies.filter(e=>!e.dead&&e.active&&e.kind!=='tank'&&distance(e,p)<330).sort((a,b)=>Math.abs(angleDiff(p.face,Math.atan2(a.y-p.y,a.x-p.x)))-Math.abs(angleDiff(p.face,Math.atan2(b.y-p.y,b.x-p.x))))[0];
  const tx=target?target.x:input.aimX??p.x+Math.cos(p.face)*280,ty=target?target.y:input.aimY??p.y+Math.sin(p.face)*280,a=Math.atan2(ty-p.y,tx-p.x),d=Math.hypot(tx-p.x,ty-p.y),muzzle=25;
  p.ammo[p.weapon]--;p.cooldown=w.interval;
  this.projectiles.push({x:p.x+Math.cos(a)*muzzle,y:p.y+Math.sin(a)*muzzle,z:p.z+1,vx:Math.cos(a)*w.speed,vy:Math.sin(a)*w.speed,vz:((target?target.z:6)-p.z)/Math.max(.08,(d-muzzle)/w.speed),life:w.life,team:'player',kind:w.id,damage:w.damage,r:w.id==='cannon'?2:4,blast:w.radius,aimTargetId:target?.id||null,targetId:w.id==='missile'&&target?target.id:null});
  this.emit('shot',{weapon:p.weapon,x:p.x,y:p.y,z:p.z,a});
 }
 damageEnemy(e,amount,kind){
  if(e.dead||!e.active)return;
  if(e.kind==='bossCore'&&this.enemies.some(q=>q.kind==='bossMount'&&!q.dead)){this.emit('shield',{x:e.x,y:e.y,z:e.z});return;}
  e.hp-=amount;e.flash=.1;this.emit('impact',{x:e.x,y:e.y,z:e.z,large:kind!=='cannon'});if(e.hp>0)return;
  e.hp=0;e.dead=true;this.kills++;this.score+=e.kind==='bossCore'?1500:e.kind==='bossMount'?700:e.kind==='radar'?500:e.kind==='tank'?50:200;this.emit('explosion',{x:e.x,y:e.y,z:8,size:e.kind==='bossCore'?3:e.kind==='tank'?1.5:1});
  if(e.id==='radar'){this.radar=false;this.setStage(1);}
  if(e.kind==='tank')for(const q of this.enemies)if(q!==e&&!q.dead&&q.active&&distance(e,q)<54)this.damageEnemy(q,65,'rocket');
  if(e.kind==='bossMount'&&!this.enemies.some(q=>q.kind==='bossMount'&&!q.dead)){this.bossPhase=2;this.message('CONTROL','Both mounts are down. The orange power unit is exposed.');this.emit('phase');}
  if(e.kind==='bossCore'){this.bossPhase=3;this.setStage(4);this._clearEnemyShots=true;this.projectiles=this.projectiles.filter(b=>b.team==='player');}
 }
 damagePlayer(amount){const p=this.player;if(this.status!=='playing'||p.landed||p.hit>.2)return;p.hp-=amount*(this.assist?.55:1);p.hit=.35;p.winch=Math.max(0,p.winch-.22);this.emit('hit',{x:p.x,y:p.y,z:p.z});if(p.hp<=0){p.hp=0;this.fail('Aircraft lost. Enemy fire destroyed the airframe.');}}
 enemyShot(e,a,homing=false){const p=this.player,sp=homing?108:e.kind==='bossCore'?145:178,d=Math.max(10,distance(e,p));this.projectiles.push({x:e.x+Math.cos(a)*16,y:e.y+Math.sin(a)*16,z:e.z+5,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,vz:(p.z-e.z-5)/(d/sp),life:homing?3.6:2.3,team:'enemy',kind:homing?'homing':'tracer',damage:homing?22:e.kind.startsWith('boss')?13:9,r:4,homing});this.emit('enemyShot',{x:e.x,y:e.y,z:e.z,homing});}
 updateEnemies(dt){
  const p=this.player;
  for(const e of this.enemies){e.flash=Math.max(0,e.flash-dt);if(e.dead||!e.active||e.kind==='radar'||e.kind==='tank')continue;e.moveTime+=dt;
   if(e.kind==='patrol'){e.x=e.homeX+Math.sin(e.moveTime*.35)*34;e.y=e.homeY+Math.cos(e.moveTime*.35)*17;}
   if(e.kind==='boat'){e.x=e.homeX+Math.sin(e.moveTime*.17)*90;e.y=e.homeY+Math.cos(e.moveTime*.17)*32;}
   if(e.kind.startsWith('boss')){const off=e.id==='boss-left'?-27:e.id==='boss-right'?27:0;e.x=1070+off+Math.sin(this.time*.12)*38;e.y=280+Math.cos(this.time*.12)*14;}
   const d=distance(e,p),range=(e.kind.startsWith('boss')?330:e.kind==='sam'?250:220)*(this.radar&&e.x>300?1.2:1);e.cooldown-=dt;
   if(d>range||p.landed){e.wind=0;continue;}const desired=Math.atan2(p.y-e.y,p.x-e.x);e.face+=clamp(angleDiff(e.face,desired),-dt*2.6,dt*2.6);
   if(e.cooldown<=0){if(!e.wind){e.wind=.8;e.aimA=desired;this.emit('telegraph',{id:e.id});}else{e.wind-=dt;if(e.wind<=dt){
    if(e.kind==='bossCore'){const n=this.bossPhase===2?5:3;for(let i=0;i<n;i++)this.enemyShot(e,e.aimA+(i-(n-1)/2)*.15);}else this.enemyShot(e,e.aimA,e.kind==='sam'||e.kind==='bossMount');
    e.wind=0;e.cooldown=(e.kind==='sam'?3:e.kind==='bossMount'?3.4:e.kind==='bossCore'?this.bossPhase===2?1.8:3:1.4)*(this.radar?.85:1);
   }}}
  }
 }
 updateProjectiles(dt){
  const p=this.player,survivors=[];
  for(const b of this.projectiles){b.life-=dt;if(b.life<=0)continue;
   if(b.targetId){const e=this.enemies.find(q=>q.id===b.targetId&&!q.dead);if(e){const sp=Math.hypot(b.vx,b.vy),a=Math.atan2(b.vy,b.vx),ta=Math.atan2(e.y-b.y,e.x-b.x),na=a+clamp(angleDiff(a,ta),-dt*5,dt*5);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;b.vz=(e.z-b.z)/Math.max(.06,distance(b,e)/sp);}}
   if(b.homing&&p.flareActive<=0){const sp=Math.hypot(b.vx,b.vy),a=Math.atan2(b.vy,b.vx),ta=Math.atan2(p.y-b.y,p.x-b.x),na=a+clamp(angleDiff(a,ta),-dt*1.1,dt*1.1);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;b.vz=(p.z-b.z)/Math.max(.1,distance(b,p)/sp);}else if(b.homing&&p.flareActive>0){b.homing=false;b.life=Math.min(b.life,.35);}
   const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;let hit=false;
   if(b.team==='player'){const candidates=this.enemies.filter(e=>!e.dead&&e.active&&!(e.kind==='bossCore'&&this.bossPhase===1&&['boss-left','boss-right'].includes(b.aimTargetId))&&segmentCircle(ox,oy,b.x,b.y,e.x,e.y,e.r+b.r)).sort((a,c)=>distance({x:ox,y:oy},a)-distance({x:ox,y:oy},c));
    if(candidates.length){const e=candidates[0];this.damageEnemy(e,b.damage,b.kind);if(b.blast)for(const q of this.enemies)if(q!==e&&!q.dead&&q.active&&distance(q,e)<b.blast+q.r)this.damageEnemy(q,b.damage*.45,b.kind);hit=true;}
   }else if(segmentCircle(ox,oy,b.x,b.y,p.x,p.y,13+b.r)&&Math.abs(b.z-p.z)<35){this.damagePlayer(b.damage);hit=true;}
   if(!hit&&b.x>0&&b.y>0&&b.x<LIMITS.width&&b.y<LIMITS.height&&b.z>-15)survivors.push(b);
  }this.projectiles=this._clearEnemyShots?survivors.filter(b=>b.team==='player'):survivors;this._clearEnemyShots=false;
 }
 update(dt,input={}){
  if(this.status!=='playing')return;dt=clamp(dt,0,.05);this.time+=dt;const p=this.player;
  p.cooldown=Math.max(0,p.cooldown-dt);p.hit=Math.max(0,p.hit-dt);p.flare=Math.max(0,p.flare-dt);p.flareActive=Math.max(0,p.flareActive-dt);
  if(input.weapon!==undefined)p.weapon=clamp(input.weapon,0,2);
  if(input.flare&&p.flare<=0&&!p.landed){p.flare=7;p.flareActive=2;this.emit('flare',{x:p.x,y:p.y,z:p.z});}
  let dx=input.moveX||0,dy=input.moveY||0;const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}const moving=Math.hypot(dx,dy)>.05;
  if(moving&&p.landed){p.landed=false;this.serviceTime=0;this.emit('takeoff');}
  const speed=(p.module?74:input.boost?150:108)*(input.interact?.16:1),k=1-Math.exp(-dt*(input.interact?10:5));p.vx+=(dx*speed-p.vx)*k;p.vy+=(dy*speed-p.vy)*k;
  p.x=clamp(p.x+p.vx*dt,25,LIMITS.width-25);p.y=clamp(p.y+p.vy*dt,25,LIMITS.height-25);p.z+=((p.landed?9:input.interact?31:43)-p.z)*(1-Math.exp(-dt*4));
  if(input.aimX!==undefined){const a=Math.atan2(input.aimY-p.y,input.aimX-p.x);p.face+=clamp(angleDiff(p.face,a),-dt*8,dt*8);}else if(moving){const a=Math.atan2(p.vy,p.vx);p.face+=clamp(angleDiff(p.face,a),-dt*5,dt*5);}
  if(!p.landed){p.fuel=Math.max(0,p.fuel-dt*(this.assist?.12:.23)*(input.boost?1.5:1));if(p.fuel<=0)this.fail('Fuel exhausted. Return to base or collect a fuel pack before the tank is empty.');}
  if(input.fire)this.fire(input);
  const item=this.interaction();if(input.interact&&item&&!item.blocked&&Math.hypot(p.vx,p.vy)<26){if(p.winchTarget!==item.id){p.winchTarget=item.id;p.winch=0;}p.winch+=dt/item.seconds;if(p.winch>=1){this.doInteraction(item);p.winch=0;p.winchTarget=null;}}else{p.winch=Math.max(0,p.winch-dt*2);if(!p.winch)p.winchTarget=null;}
  if(p.landed&&this.serviceTime>0){this.serviceTime=Math.max(0,this.serviceTime-dt);p.hp=Math.min(p.maxHp,p.hp+dt*p.maxHp/4);p.fuel=Math.min(100,p.fuel+dt*25);for(let i=0;i<3;i++)p.ammo[i]=Math.min(WEAPONS[i].max,p.ammo[i]+dt*WEAPONS[i].max/4);}
  this.updateEnemies(dt);this.updateProjectiles(dt);
  if(this.stage===3){this.bossTime-=dt;if(this.bossTime<=0)this.fail('The command crawler destroyed the flood controls. Stop it before the timer expires.');}
  if(p.fuel<22&&!this.lowFuel){this.lowFuel=true;this.message('ECHO SEVEN','Fuel below 22 percent. Plan a supply stop.');}if(p.fuel>30)this.lowFuel=false;
 }
 result(){return {score:this.score,time:this.time,rescued:this.delivered,total:7,losses:this.losses,kills:this.kills,rank:this.losses===0&&this.optional===2?'S':this.losses===0?'A':this.losses<=2?'B':'C',assist:this.assist};}
}
root.BWCore={Mission,BASE,RELAY,MODULE,LIMITS,STAGES,WEAPONS,ISLANDS,ROADS,landAt,pointInPolygon,segmentCircle,clamp,distance};
})(globalThis);
