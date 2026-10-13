/* Nacre free play. Jobs and builds are data modules. This adapter applies them
 * to the real my-3d2dge character, collision, animation, and city systems. */
(function(root){
'use strict';
const E=root.My3D2dge,U=20,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const point=a=>({x:a.x/U,y:a.y/U,z:(a.z||0)/U});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const sameFloor=(a,b)=>Math.abs((a.z||0)-(b.z||0))<18;
const saveEnemy=(e,p)=>({id:e.id,targetId:e.targetId,hp:e.hp,x:e.x/U,y:e.y/U,aware:e.aware,memory:e.memory,stun:e.stun,cool:e.cool,facing:e.facing,attack:e.attack.phase?{phase:e.attack.phase,t:e.attack.t,hit:e.attack.hit.has(p)}:null});
function segmentRect(a,b,r){
 let lo=0,hi=1;
 for(const [p,d,min,max] of [[a.x,b.x-a.x,r.x,r.x+r.w],[a.y,b.y-a.y,r.y,r.y+r.d]]){
  if(Math.abs(d)<1e-9){if(p<min||p>max)return false;continue;}
  let t0=(min-p)/d,t1=(max-p)/d;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;
 }return hi>0.01&&lo<.99;
}
class Freeplay extends root.NacreCityExplorer.Explorer{
 constructor(canvas,city,profile,jobs,world={},hooks={}){
  super(canvas,city,hooks);this.showScaleRuler=false;this.profile=profile;this.jobs=jobs;this.enemies=new Map();this.targetActors=new Map();this.effects=[];this.smoke=[];this.targets=[];this.heat=0;this.hold=0;this.holdKey=null;this.autoInteract=null;this.interactLatch=false;this.targetClock=0;this.saveClock=0;this.playSeconds=0;this.safeTime=0;this.danger=world.danger||1;this.foundDistricts=new Set(world.foundDistricts||[]);this.savedEnemies=new Map((world.enemies||[]).map(e=>[e.id,e]));this.choiceSent=false;
  this.worldClock=world.clock||0;this.buildStats=profile.stats();
  Object.assign(this.player,{role:'player',id:'mara',hp:world.hp??this.buildStats.hpMax,dead:false,hurt:0,parry:0,parryCool:0,dodge:0,dodgeCool:0,invincible:0,smokeCool:0,counter:0,flow:0,fallStart:0,attack:new E.Attack('thrust',{wind:.11,active:.14,recover:.33,hitAt:.16,blade:1,reach:10,z0:17,z1:18,a0:.4,a1:-.25})});
  const cool=world.cooldowns||{};Object.assign(this.player,{smokeCool:cool.smoke||0,dodgeCool:cool.dodge||0,parryCool:cool.parry||0,invincible:cool.invincible||0,counter:cool.counter||0,flow:cool.flow||0,attackLock:cool.attack||0});this.smoke=(world.smoke||[]).map(s=>({...s,x:s.x*U,y:s.y*U,z:s.z*U,r:s.r*U}));
  this.game.input.use({up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],sprint:['ShiftLeft','ShiftRight','Pad6'],jump:['Space','Pad0'],crouch:['KeyC','Pad1'],interact:['KeyE','Pad2'],attack:['KeyF','Mouse0','Pad7'],parry:['KeyR','Mouse2','Pad5'],dodge:['KeyV','Pad11'],smoke:['KeyX','Pad4'],pause:['Escape','Pad9'],map:['KeyM','Pad8'],jobs:['KeyJ'],build:['KeyK'],gear:['KeyI']});
  this.enter(city.districts[4]);if(world.position)this.place(world.position);this.player.crouch=world.crouch||false;this.player.facing=world.facing??this.player.facing;this.currentDistrict=city.districtAt(this.player.x/U,this.player.y/U);this.refreshStats();this.refreshTargets();this.notifyState();
  if(this.player.hp<=0){this.player.dead=true;this.paused=true;queueMicrotask(()=>this.hooks.onDeath?.());}
 }
 notice(title,detail=''){this.hooks.onNotice?.(title,detail);}
 refreshStats(){if(!this.profile)return;this.buildStats=this.profile.stats();this.player.hp=clamp(this.player.hp,0,this.buildStats.hpMax);this.player.attack.spec.recover=Math.max(.06,this.buildStats.attackCooldown-.25);const item=this.profile.data.inventory.find(i=>i.id===this.profile.data.equipment.weapon),coat=this.profile.data.inventory.find(i=>i.id===this.profile.data.equipment.coat);this.player.rig.o.bladeLen=item?.uniqueId==='tidebreaker'?13:item?.uniqueId==='whisper-needle'?5:8;const cloth=coat?.uniqueId==='smokeweave'?'#51465f':coat?.rarity==='magic'?'#2c6060':'#29445f';this.player.rig.C.cloth=cloth;this.player.rig.C.cape=cloth;this.notifyState();}
 safe(){return !this.player.dead&&this.heat<1&&!this.parkour.state&&this.player.onGround;}
 position(){return point(this.player);}
 tracked(){return this.jobs?.activeJobs().find(j=>j.id===this.jobs.trackedId)||null;}
 goal(){const j=this.tracked();return j?j.stages[j.stageIndex].target:null;}
 flushPlayTime(){if(this.playSeconds>0){this.profile.event('play',{seconds:Math.min(3600,this.playSeconds)});this.playSeconds=0;}}
 snapshot(){
  this.flushPlayTime();let p=this.position();if(!this.city.isWalkable(p.x,p.y,.275,p.z))p={x:this.player._safeX/U,y:this.player._safeY/U,z:0};
  const enemies=[...this.savedEnemies.values()];for(const e of this.enemies.values()){const at=enemies.findIndex(v=>v.id===e.id);if(at>=0)enemies.splice(at,1);if(!e.dead)enemies.push(saveEnemy(e,this.player));}
  enemies.sort((a,b)=>distance(a,p)-distance(b,p));
  const a=this.player.attack,phases=['wind','active','recover'],left=a.phase?phases.slice(phases.indexOf(a.phase)).reduce((n,k)=>n+a.spec[k],-a.t):0;
  return {schema:'nacre-freeplay',version:1,build:'0.4.0',cityLayout:this.city.spec.layout||'legacy',citySeed:String(this.city.spec.seed),profile:this.profile.exportSave(),jobs:this.jobs.exportSave(),world:{position:p,hp:this.player.hp,clock:this.worldClock,danger:this.danger,crouch:this.player.crouch,facing:this.player.facing,foundDistricts:[...this.foundDistricts],enemies:enemies.slice(0,40),cooldowns:{smoke:this.player.smokeCool,dodge:this.player.dodgeCool,parry:this.player.parryCool,invincible:this.player.invincible,counter:this.player.counter,flow:this.player.flow,attack:Math.max(left,this.player.attackLock)},smoke:this.smoke.map(s=>({x:s.x/U,y:s.y/U,z:s.z/U,r:s.r/U,t:s.t,life:s.life}))}};
 }
 changed(){this.saveClock=0;this.hooks.onSave?.(this.snapshot());this.notifyState();}
 applyResults(result){
  if(!result)return;let changed=false;
  for(const r of result.rewards||[]){const out=this.profile.reward({xp:r.xp,gold:r.gold,seed:r.id,danger:r.danger,source:r.source,loot:r.loot});if(!out.ok){this.notice('Reward error',out.reason);continue;}changed=true;this.refreshStats();if(out.levelsGained){this.player.hp=this.buildStats.hpMax;this.audio.event('win');}
   const found=out.loot.map(v=>v.added?v.item.name:v.convertedMaterials+' materials').join(', ');
   this.notice(out.levelsGained?'Level '+out.level+' reached':'Reward earned','+'+out.xp+' XP · '+out.gold+' coins'+(found?' · '+found:''));
   this.hooks.onReward?.(out);
  }
  for(const f of result.failed||[]){this.profile.event('job_failed',{id:f.id,reason:f.reason});this.notice('Job failed',f.reason);changed=true;}
  if(result.updates?.length){this.autoInteract=null;this.hold=0;this.holdKey=null;this.route=null;this.auto=false;this.targetClock=0;changed=true;}
  if(changed){this.refreshTargets();this.changed();}
 }
 accept(offerId){if(!this.safe())return {ok:false,reason:'Leave the threat before you take a job.'};const out=this.jobs.accept(offerId);if(out.ok){this.jobs.track(out.job.id);this.profile.event('job_accepted',{id:out.job.id,danger:out.job.danger});this.refreshTargets();this.changed();}return out;}
 abandon(id){this.applyResults(this.jobs.abandon(id));}
 setDanger(value){if(!this.safe())return {ok:false,reason:'Leave the threat before you change danger.'};this.danger=clamp(Math.round(value),1,5);this.changed();return {ok:true};}
 buildAction(method,id){if(!this.safe())return {ok:false,reason:'Leave the threat and stand on solid ground first.'};const out=this.profile[method](id);if(out.ok){this.refreshStats();this.changed();}return out;}
 track(id){this.jobs.track(id);this.auto=false;this.route=null;this.changed();}
 walkToGoal(target=this.goal()){
  if(!target)return {ok:false,reason:'Track a job or select a nearby event first.'};if(!this.safe())return {ok:false,reason:'Leave the threat before you follow a route.'};if(this.player.z>1)return {ok:false,reason:'Return to the street to follow a route.'};
  if(this.auto){this.auto=false;this.notifyState();return {ok:true};}
  const r=this.city.route(this.position(),target);if(!r.ok)return r;this.route={...r,index:1,complete:false,progress:0};this.auto=true;this.player.crouch=false;this.routeTarget=target.id;this.game.input.clear();this.notifyState();return {ok:true};
 }
 travel(districtId){
  if(!this.safe())return {ok:false,reason:'Leave the threat before you take a carriage.'};if(this.jobs.activeJobs().length)return {ok:false,reason:'Finish or abandon active jobs before you take a carriage.'};const d=this.city.districts.find(v=>v.id===districtId);if(!d)return {ok:false,reason:'Unknown district.'};if(d.id===this.currentDistrict?.id)return {ok:false,reason:'You are already in this district.'};if(this.profile.data.gold<15)return {ok:false,reason:'A carriage trip costs 15 coins.'};this.profile.data.gold-=15;this.profile.event('travel',{districtId,cost:15});this.place(d.arrival);this.currentDistrict=d;this.heat=0;this.refreshTargets();this.changed();return {ok:true};
 }
 refreshTargets(){
  if(!this.jobs)return;this.targets=this.jobs.getTargets(this.position(),110,this.profile.level(),this.danger);const keep=new Set(this.targets.map(t=>t.id));
  for(const [id,a] of this.targetActors)if(!keep.has(id))this.targetActors.delete(id);
  for(const t of this.targets){
   if(t.type==='kill')for(const id of t.enemyIds){if(this.enemies.has(id))continue;const serial=Number(id.split(':e').at(-1))||0,angle=serial*2.4,off=t.enemyTotal>1?.8:0;let p={x:t.x+Math.cos(angle)*off,y:t.y+Math.sin(angle)*off};if(!this.city.isWalkable(p.x,p.y,.275,0))p=t;const saved=this.savedEnemies.get(id);if(saved&&this.city.isWalkable(saved.x,saved.y,.275,0))p=saved;
    const e=new E.Body({x:p.x*U,y:p.y*U,z:0,r:5.5,gravity:450,step:5,onGround:true}),maxHp=48+(t.enemyLevel-1)*3+t.danger*8;
    Object.assign(e,{id,role:'guard',targetId:t.id,origin:{x:t.x,y:t.y,z:0},maxHp,hp:clamp(saved?.hp??maxHp,1,maxHp),level:t.enemyLevel,danger:t.danger,facing:saved?.facing??(hash(id)%628)/100,aware:saved?.aware||0,memory:saved?.memory||0,dead:false,hurt:0,stun:saved?.stun||0,path:null,navTimer:0,cool:saved?.cool??serial*.5,attack:new E.Attack('slash',{wind:.65,active:.16,recover:.92,range:35,hitAt:.1}),_safeX:p.x*U,_safeY:p.y*U});if(saved?.attack){e.attack.phase=saved.attack.phase;e.attack.t=saved.attack.t;if(saved.attack.hit)e.attack.hit.add(this.player);}const outfit=E.NacreCharacters.options('guard',id);outfit.colors.cloth=t.enemyKind==='lookout'?'#854c43':'#793c35';outfit.colors.plate='#947a65';outfit.colors.trim='#d5a477';e.rig=new E.NacreRig(outfit);E.NacreMotion.attach(e.rig,{role:'guard',id});this.enemies.set(id,e);this.savedEnemies.delete(id);
   }else if(['courier','recipient','merchant','captive'].includes(t.kind)&&!this.targetActors.has(t.id)){const rig=new E.NacreRig(E.NacreCharacters.options('civilian',t.id,'#b59457'));E.NacreMotion.attach(rig,{role:'civilian',id:t.id});this.targetActors.set(t.id,{id:t.id,role:'civilian',rig,x:t.x*U,y:t.y*U,z:0,vx:0,vy:0,facing:1.6,onGround:true});}
  }
  for(const [id,e] of this.enemies){if(e.dead){if((e.deadAt||0)+8<this.worldClock)this.enemies.delete(id);continue;}if(!keep.has(e.targetId)&&e.memory<=0){if(distance(point(e),this.position())>130){this.savedEnemies.set(id,saveEnemy(e,this.player));this.enemies.delete(id);}else if(!this.jobs.getTargets(e.origin,1,this.profile.level(),this.danger).some(t=>t.id===e.targetId)){this.enemies.delete(id);this.savedEnemies.delete(id);}}}
  if(this.savedEnemies.size>40){const far=[...this.savedEnemies.values()].sort((a,b)=>distance(a,this.position())-distance(b,this.position()));this.savedEnemies=new Map(far.slice(0,40).map(e=>[e.id,e]));}
 }
 visibleBetween(a,b){
  const A=point(a),B=point(b);if(this.inSmoke(a)||this.inSmoke(b))return false;const q=this.city.query({x:Math.min(A.x,B.x)-.1,y:Math.min(A.y,B.y)-.1,w:Math.abs(A.x-B.x)+.2,d:Math.abs(A.y-B.y)+.2});
  return !q.buildings.some(r=>r.h>Math.min(A.z,B.z)+1&&segmentRect(A,B,r));
 }
 inSmoke(a){return this.smoke.some(s=>sameFloor(a,s)&&distance(a,s)<s.r);}
 nearestEnemy(range=55){let out=null,best=range;for(const e of this.enemies.values())if(!e.dead&&sameFloor(this.player,e)&&distance(this.player,e)<best){out=e;best=distance(this.player,e);}return out;}
 strike(){
  const p=this.player;if(p.dead||p.attackLock>0||p.attack.busy||p.parry>0||p.dodge>0||this.parkour.state)return false;const e=this.nearestEnemy(55);if(e)p.facing=Math.atan2(e.y-p.y,e.x-p.x);p.quietStrike=!!e&&p.crouch&&e.aware<80; p.counterStrike=p.counter>0;p.counter=0;p.hitCount=0;p.attack.start();this.auto=false;this.audio.event('blade');return true;
 }
 parry(){const p=this.player;if(p.parryCool>0||p.dead||this.parkour.state)return false;p.parry=this.buildStats.parryWindow;p.parryCool=.65;p.attack.cancel();const e=this.nearestEnemy(65);if(e)p.facing=Math.atan2(e.y-p.y,e.x-p.x);return true;}
 dodge(dx=0,dy=0){const p=this.player;if(p.dodgeCool>0||p.dead||!p.onGround||this.parkour.state)return false;const moving=Math.hypot(dx,dy)>.05;p.dodgeDir=moving?[dx,dy]:[-Math.cos(p.facing),-Math.sin(p.facing)];p.dodge=.32;p.invincible=.36;p.dodgeCool=this.buildStats.dodgeCooldown;p.crouch=false;p.attack.cancel();this.auto=false;this.profile.event('dodge');if(this.buildStats.keystone==='flow'){p.hp=Math.min(this.buildStats.hpMax,p.hp+this.buildStats.hpMax*.08);p.flow=5;}this.audio.event('jump');return true;}
 useSmoke(){const p=this.player;if(p.smokeCool>0||p.dead||this.parkour.state)return false;p.smokeCool=this.buildStats.smokeCooldown;this.smoke.push({x:p.x,y:p.y,z:p.z,r:3.5*U,t:this.buildStats.smokeDuration,life:this.buildStats.smokeDuration});for(const e of this.enemies.values())if(!e.dead&&sameFloor(p,e)&&distance(p,e)<4*U){e.stun=.6;e.aware=Math.min(e.aware,60);e.memory=1.5;}this.profile.event('smoke',{duration:this.buildStats.smokeDuration});this.audio.event('smoke');this.notice('Smoke screen','Break sight. Move away from the crew.');return true;}
 hitEnemy(e){
  const p=this.player,s=this.buildStats;if(e.dead)return;const cleave=p.counterStrike&&(s.keystone==='iron'||s.itemEffects.includes('counterCleave'));if(p.hitCount>0&&!cleave)return;p.hitCount++;
  const critical=(hash(e.id+':'+this.worldClock.toFixed(4)+':'+this.profile.data.rewardSerial)%10000)/10000<s.critChance;
  const damage=s.damage*(p.quietStrike?4*s.stealthMul:1)*(p.counterStrike?s.counterMul:1)*(critical?s.critMultiplier:1);e.hp=Math.max(0,e.hp-damage);e.hurt=.3;e.stun=p.counterStrike?1.2:.34;e.aware=100;e.memory=5;e.attack.cancel();this.effect(e,critical?'#f0dd96':'#e2af81',Math.round(damage)+(critical?'!':''));this.audio.event('blade');
  if(e.hp<=0)this.finishEnemy(e,p.quietStrike);else if(p.quietStrike)this.notice('Target survived','The crew has seen you. Parry, dodge, or use smoke.');
 }
 finishEnemy(e,quiet){if(e.dead)return;e.dead=true;e.hp=0;e.deadAt=this.worldClock;e.aware=0;e.memory=0;e.vx=e.vy=0;e.attack.cancel();this.savedEnemies.delete(e.id);this.profile.event('kill',{quiet,enemyId:e.id});this.applyResults(this.jobs.handle({type:'kill',targetId:e.targetId,enemyId:e.id,position:e.origin}));if(!quiet)for(const g of this.enemies.values())if(!g.dead&&distance(g,e)<9*U){g.aware=100;g.memory=5;}this.changed();}
 hurt(amount){const p=this.player;if(p.invincible>0||p.dead)return;p.hp=Math.max(0,p.hp-amount*(1-this.buildStats.damageReduction));p.invincible=.5;p.hurt=.3;this.hold=0;this.autoInteract=null;this.safeTime=0;this.audio.event('hurt');this.game.shake(2);this.effect(p,'#e98f76','−'+Math.round(amount*(1-this.buildStats.damageReduction)));if(p.hp<=0){p.dead=true;p.attack.cancel();this.auto=false;this.profile.event('death');this.applyResults(this.jobs.failActive('Mara was defeated.'));const lost=Math.min(25,Math.floor(this.profile.data.gold*.1));this.profile.data.gold-=lost;this.deathCost=lost;this.pause(true);this.changed();this.hooks.onDeath?.();}}
 recover(){if(!this.player.dead)return;this.enemies.clear();this.savedEnemies.clear();this.smoke=[];this.heat=0;const d=this.currentDistrict||this.city.districts[4];this.place(d.arrival);Object.assign(this.player,{hp:this.buildStats.hpMax,dead:false,hurt:0,invincible:2,parry:0,dodge:0,counter:0,smokeCool:0,dodgeCool:0});this.refreshTargets();this.pause(false);this.changed();}
 effect(a,color,text=''){this.effects.push({x:a.x,y:a.y,z:a.z+24,color,text,t:.7,life:.7});if(this.effects.length>35)this.effects.shift();}
 updateEnemies(dt){
  const p=this.player;let threat=0;
  for(const e of this.enemies.values()){
   if(e.dead)continue;for(const k of ['hurt','stun','memory','navTimer','cool'])e[k]=Math.max(0,e[k]-dt);const d=distance(p,e),sight=d<12*U&&this.visibleBetween(e,p),facing=Math.abs(E.angDiff(e.facing,Math.atan2(p.y-e.y,p.x-e.x)))<1.15;const sees=sight&&(facing||d<1.7*U)&&Math.abs(p.z-e.z)<3*U;
   if(sees){e.aware=Math.min(100,e.aware+dt*75*this.buildStats.detectMul*(p.crouch?.35:1)*(d<3*U?1.5:1));if(e.aware>=100)e.memory=5;}else e.aware=Math.max(0,e.aware-dt*(this.inSmoke(p)?48:18));
   const chase=e.memory>0&&e.aware>35;threat=Math.max(threat,e.aware);if(chase&&this.auto){this.auto=false;this.notice('Crew alerted','Use F to attack, R to parry, V to dodge, or X for smoke.');}
   let dx=0,dy=0;
   if(chase&&e.stun<=0){e.facing=E.approachAng(e.facing,Math.atan2(p.y-e.y,p.x-e.x),dt*6);if(d<35&&sameFloor(p,e)&&sight){if(!e.attack.busy&&e.cool<=0){e.attack.start();e.cool=1.85;}}
    else if(p.z<1&&d>27){if(sight){dx=(p.x-e.x)/d;dy=(p.y-e.y)/d;}else{if(e.navTimer<=0){const route=this.city.route(point(e),point(p));e.path=route.ok?{points:route.points,index:1}:null;e.navTimer=1.2;}const target=e.path?.points[e.path.index];if(target){const tx=target.x*U-e.x,ty=target.y*U-e.y,l=Math.hypot(tx,ty);if(l<8)e.path.index++;else{dx=tx/l;dy=ty/l;}}}}
   }else if(e.memory<=0&&!e.attack.busy&&distance(point(e),e.origin)>1){const q={x:e.origin.x*U,y:e.origin.y*U,z:0},l=distance(e,q);if(this.visibleBetween(e,q)){dx=(q.x-e.x)/l;dy=(q.y-e.y)/l;}}
   const speed=(e.attack.busy||e.stun>0)?0:44+e.danger*2;e.vx=dx*speed;e.vy=dy*speed;if(!chase&&(dx||dy))e.facing=Math.atan2(dy,dx);if(this.world.land(e.x,e.y)){e._safeX=e.x;e._safeY=e.y;}e.update(dt,this.world);e.attack.update(dt);
   e.attack.hits([p],v=>!v.dead&&sameFloor(e,v)&&distance(e,v)<38&&this.visibleBetween(e,v),()=>{if(p.parry>0){e.stun=1.8;e.attack.cancel();e.hurt=.25;p.counter=2;this.profile.event('parry');if(this.buildStats.keystone==='iron')p.hp=Math.min(this.buildStats.hpMax,p.hp+this.buildStats.hpMax*.08);this.effect(p,'#91ddd5','PARRY');this.audio.event('parry');this.notice('Parry','Press F now for a counterattack.');}else this.hurt(10+e.level*.5+e.danger*2);});
  }
  this.heat=threat;this.safeTime=threat<1?this.safeTime+dt:0;if(this.safeTime>10&&!p.dead&&p.hp<this.buildStats.hpMax)p.hp=Math.min(this.buildStats.hpMax,p.hp+dt*4);
 }
 context(){
  if(!this.targets||this.player.dead)return null;const p=this.position();let nearest=null,best=3;
  for(const t of this.targets){const d=distance(t,p);if(t.type!=='kill'&&d<=best&&Math.abs(p.z-t.z)<.75){nearest=t;best=d;}}
  return nearest;
 }
 startInteraction(){const t=this.context();if(!t)return {ok:false,reason:'Move within 3 metres of the marker.'};if(this.heat>=80)return {ok:false,reason:'Lose the crew before you do this work.'};this.autoInteract=t.id;this.interactLatch=false;return {ok:true};}
 updateInteraction(dt,manual){
  const t=this.context(),input=this.game.input;if(!input.down('interact'))this.interactLatch=false;const held=input.down('interact')&&!this.interactLatch||t&&this.autoInteract===t.id;
  if(!t||!held||manual||this.heat>=80||this.player.attack.busy){this.hold=0;this.holdKey=null;if(manual||!t)this.autoInteract=null;return;}
  if(this.holdKey!==t.id){this.hold=0;this.holdKey=t.id;}const time=Math.max(.1,t.holdSeconds*this.buildStats.interactMul*(this.player.flow>0?.6:1));this.hold+=dt/time;
  if(this.hold>=1){this.autoInteract=null;this.interactLatch=true;this.hold=0;this.player.flow=0;this.audio.event('clue');this.applyResults(this.jobs.handle({type:t.type,targetId:t.id,position:this.position(),safe:this.heat<1}));}
 }
 update(dt){
  if(!this.profile||!this.active)return;const input=this.game.input;
  for(const panel of ['jobs','build','gear','map'])if(input.pressed(panel)){this.hooks.onPanel?.(panel);return;}
  if(input.pressed('pause')){this.hooks.onPanel?.('pause');return;}if(this.paused||this.player.dead)return;
  this.worldClock+=dt;this.playSeconds+=dt;this.saveClock+=dt;this.uiClock-=dt;this.rosterClock-=dt;this.targetClock-=dt;
  const p=this.player,oldX=p.x,oldY=p.y;for(const k of ['hurt','parry','parryCool','dodge','dodgeCool','invincible','smokeCool','counter','flow','attackLock'])p[k]=Math.max(0,p[k]-dt);
  for(const s of this.smoke)s.t-=dt;this.smoke=this.smoke.filter(s=>s.t>0);for(const e of this.effects)e.t-=dt;this.effects=this.effects.filter(e=>e.t>0);
  let [ax,ay]=input.move(),[dx,dy]=this.game.view.screenDirToGround(ax,ay);const manual=Math.hypot(dx,dy)>.05;if(manual)this.auto=false;
  if(input.pressed('crouch')){p.crouch=!p.crouch;this.auto=false;}if(input.pressed('attack'))this.strike();if(input.pressed('parry'))this.parry();if(input.pressed('dodge'))this.dodge(dx,dy);if(input.pressed('smoke'))this.useSmoke();
  if(input.pressed('jump')&&!this.parkour.state){this.auto=false;const climb=this.world.nearClimb(p,p.facing);if(climb){this.parkour.climb(climb);p.facing=climb.angle;p.crouch=false;this.audio.event('climb');}else if(p.onGround){p.fallStart=p.z;p.jump(185);this.audio.event('jump');}}
  let speed=(p.crouch?32*this.buildStats.crouchMul:input.down('sprint')?107:54)*this.buildStats.moveMul;if(p.attack.busy||p.parry>0)speed*=.35;
  if(this.buildStats.keystone==='ghost'&&this.inSmoke(p))speed*=1.35;
  if(this.auto&&this.route){let t=this.route.points[this.route.index];while(t&&distance({x:p.x/U,y:p.y/U},t)<.035&&this.route.index<this.route.points.length-1)t=this.route.points[++this.route.index];if(t){const tx=t.x*U-p.x,ty=t.y*U-p.y,len=Math.hypot(tx,ty);dx=len?tx/len:0;dy=len?ty/len:0;speed=Math.min(54*this.buildStats.moveMul,len/dt);if(len<.2){this.auto=false;this.route.complete=true;}}}
  if(this.parkour.state)this.parkour.update(dt);else{
   if(p.dodge>0){p.vx=p.dodgeDir[0]*155*this.buildStats.moveMul;p.vy=p.dodgeDir[1]*155*this.buildStats.moveMul;}else if(this.auto){p.vx=dx*speed;p.vy=dy*speed;}else{p.vx=E.approach(p.vx,dx*speed,dt*680);p.vy=E.approach(p.vy,dy*speed,dt*680);}
   if(Math.hypot(dx,dy)>.05&&!p.attack.busy&&p.parry<=0)p.facing=E.approachAng(p.facing,Math.atan2(dy,dx),dt*12);
   if(p.onGround&&p.z<1&&this.world.land(p.x,p.y)){p._safeX=p.x;p._safeY=p.y;}p.update(dt,this.world);if(p.landed){this.audio.event('land');p.rig.kick(-1.5);if(p.fallStart-p.z>6*U)this.hurt((p.fallStart-p.z)/U*3);p.fallStart=p.z;}
  }
  const moved=Math.hypot(p.x-oldX,p.y-oldY)/U;this.instantSpeed=moved/dt;if(moved>.00001){this.distanceM+=moved;this.movingTime+=dt;this.stepDistance+=moved;if(p.onGround&&this.stepDistance>.75){this.stepDistance=0;this.audio.event('step');}}
  p.attack.update(dt);p.attack.hits([...this.enemies.values()],e=>!e.dead&&sameFloor(p,e)&&distance(p,e)<38&&Math.abs(E.angDiff(p.facing,Math.atan2(e.y-p.y,e.x-p.x)))<1.5&&(this.visibleBetween(p,e)||this.inSmoke(p)&&distance(p,e)<26),e=>this.hitEnemy(e));
  this.updateEnemies(dt);this.updateInteraction(dt,manual);this.applyResults(this.jobs.tick(dt,this.position()));
  for(const t of this.targets)if(t.type==='escape'&&this.heat<1)this.applyResults(this.jobs.handle({type:'escape',targetId:t.id,position:this.position(),safe:true}));
  this.game.focus(p.x,p.y,p.z+20);const district=this.city.districtAt(p.x/U,p.y/U);if(district?.id!==this.currentDistrict?.id){this.currentDistrict=district;this.hooks.onDistrict?.(district);}
  if(district&&!this.foundDistricts.has(district.id)){this.foundDistricts.add(district.id);this.profile.event('district',{id:district.id});this.notice(district.name,'New streets. New work. Open Jobs to see local offers.');this.changed();}
  if(this.rosterClock<=0){this.rosterClock=.8;this.updateRoster();}this.moveNpcs();if(this.targetClock<=0){this.targetClock=.6;this.refreshTargets();}
  if(this.saveClock>=10)this.changed();if(this.uiClock<=0){this.uiClock=.12;this.notifyState();}
 }
 rigState(a,dt){const out=super.rigState(a,dt),p=a===this.player;return {...out,dead:!!a.dead,hurt:a.hurt>0,stun:a.stun||0,attack:a.attack?.state||null,pose:a.dead?'die':p&&a.parry>0?'block':out.pose,stance:a.aware>=80||p&&this.heat>80?'ready':null,parry:p?a.parry||0:0,dodge:p?a.dodge||0:0,alert:a.aware>35||p&&this.heat>35,interaction:p&&this.hold>0?'work':null,hold:p?this.hold||0:0};}
 draw(r){
  const dt=this.paused?0:Math.min(.05,Math.max(0,this.game.real-this.lastRender));super.draw(r);if(!this.profile||!this.active)return;
  for(const t of this.targets)if(t.type!=='kill'&&!this.targetActors.has(t.id)){const sign=t.type==='visit'||t.type==='escape';this.art.prop(r,{id:'work:'+t.id,x:t.x-.4,y:t.y-.4,w:.8,d:.8,h:sign?1.65:t.kind==='purse'?.2:.65,z:0,kind:sign?'signpost':t.kind==='contraband'?'barrels':'crate',districtId:this.city.districtAt(t.x,t.y)?.id||'grand-exchange',seed:hash(t.id)});}
  for(const a of [...this.targetActors.values(),...this.enemies.values()]){a.rig.update(dt,this.rigState(a,dt));if(!r.visible(a.x,a.y,a.z,110,150,150))continue;r.shadow(a.x,a.y,6,.27,'#213e42',a.z);r.actor(a.x,a.y,a.z,(g,x,y)=>a.rig.draw(g,x,y,r.view),{bias:this.world.actorBias(r.view,a,this.drawData?.buildings),outline:false});}
  r.overlay(g=>{
   g.save();
   for(const s of this.smoke){const [x,y]=r.w(s.x,s.y,s.z+12);g.globalAlpha=Math.min(.5,s.t)*.5;g.fillStyle='#91b4ac';for(let i=0;i<7;i++){const a=i*2.4+this.worldClock*.3;g.beginPath();g.ellipse(x+Math.cos(a)*35,y+Math.sin(a)*17,40,25,0,0,Math.PI*2);g.fill();}}g.globalAlpha=1;
   for(const t of this.targets){const [x,y]=r.w(t.x*U,t.y*U,44);if(x<0||x>r.W||y<0||y>r.H)continue;const active=t.jobId===this.jobs.trackedId,color=t.type==='kill'?'#ee977e':t.opportunityId?'#8ee0cb':'#e7cb8b';g.strokeStyle='#183a3e';g.fillStyle=color;g.lineWidth=2;g.beginPath();g.moveTo(x,y-7);g.lineTo(x+6,y);g.lineTo(x,y+7);g.lineTo(x-6,y);g.closePath();g.fill();g.stroke();if(active||distance(t,this.position())<10){g.font='12px Georgia';g.textAlign='center';g.strokeStyle='#142d32';g.lineWidth=4;g.strokeText(t.label,x,y-13);g.fillText(t.label,x,y-13);}}
   for(const e of this.enemies.values()){if(e.dead)continue;const [x,y]=r.w(e.x,e.y,e.z+40);if(x<0||x>r.W||y<0||y>r.H)continue;g.fillStyle='#173438';g.fillRect(x-17,y-2,34,4);g.fillStyle=e.aware>=80?'#e48b70':'#d3b776';g.fillRect(x-17,y-2,34*e.hp/e.maxHp,4);if(e.attack.busy&&e.attack.state?.phase==='wind'){g.font='bold 20px Georgia';g.textAlign='center';g.fillStyle='#ffaf88';g.fillText('!',x,y-10);}else if(e.aware>1&&e.aware<100){g.fillStyle='#f3d386';g.fillRect(x-17,y+4,34*e.aware/100,2);}}
   for(const e of this.effects){const [x,y]=r.w(e.x,e.y,e.z+(1-e.t/e.life)*17);g.globalAlpha=e.t/e.life;g.font='bold 15px Georgia';g.textAlign='center';g.strokeStyle='#173338';g.lineWidth=3;g.strokeText(e.text,x,y);g.fillStyle=e.color;g.fillText(e.text,x,y);}g.restore();g._c=null;
  });
 }
 state(){const base=super.state();if(!this.profile)return base;const p=this.player,j=this.tracked(),t=j?.stages[j.stageIndex],context=this.context();return {...base,level:this.profile.level(),xp:this.profile.data.xp,xpToNext:this.profile.xpToNext(),points:this.profile.availablePoints(),hp:p.hp,hpMax:this.buildStats.hpMax,gold:this.profile.data.gold,materials:this.profile.data.materials,heat:this.heat,danger:this.danger,dead:p.dead,stats:this.buildStats,tracked:j?{id:j.id,title:j.title,text:t.text,target:t.target,distanceM:distance(t.target,this.position()),remaining:j.remaining,stage:j.stageIndex+1,total:j.stages.length}:null,context:context?{...context,progress:this.hold,blocked:this.heat>=80}:null,cooldowns:{dodge:p.dodgeCool,smoke:p.smokeCool,parry:p.parryCool},enemies:[...this.enemies.values()].filter(e=>!e.dead).map(e=>({id:e.id,targetId:e.targetId,hp:e.hp,maxHp:e.maxHp,aware:e.aware,x:e.x/U,y:e.y/U,attack:e.attack.state?.phase||null})),jobsActive:this.jobs.activeJobs().length,starterAvailable:this.profile.data.stats.jobsCompleted>0&&!this.profile.data.starterClaimed,playSeconds:this.profile.data.stats.playSeconds+this.playSeconds};}
}
root.NacreFreeplayGame={Freeplay,segmentRect};
})(typeof window!=='undefined'?window:globalThis);
