/* AFTERFRAME: The Last Broadcast
 * Original game systems on my-3D2dge Agent Edition 0.11.0.
 * World units: x right, z up. One tile = 16 units. All timing is in seconds.
 */
(() => {
'use strict';
const E=My3D2dge,A=AFArt,$=id=>document.getElementById(id),clamp=E.clamp;
const SAVE='afterframe.checkpoint.v1',BEST='afterframe.best.v1',PREFS='afterframe.settings.v1';
const DEFAULTS={mode:'none',gpu:true,levels:6,edge:.65,pixel:4,mix:.8,volume:.55,difficulty:'standard',reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,reducedFlashes:false,touch:matchMedia('(pointer: coarse)').matches,holdAttack:false};
let settings={...DEFAULTS,...E.store.get(PREFS,{})};
const input={...E.Input.PLATFORMER,jump:['Space','KeyZ','Pad0'],attack:['KeyJ','KeyX','Pad2'],kick:['KeyK','Pad3'],dash:['KeyL','ShiftLeft','ShiftRight','Pad1'],slow:['KeyQ','Pad6'],rush:['KeyE','Pad7'],focus:['KeyR','Pad5']};
const view=new E.View('afterframe','Cinematic side view',0,0,2.7);
const game=new E.Game({canvas:'screen',res:[1280,720],view,input,bg:'#081d2a',smoothDrawing:true});
game.pauseOverlay=false;game.cam.smooth=.16;game.audio.setVolume(settings.volume);
const originalFlash=game.flash.bind(game);game.flash=(color,seconds,strength=1)=>{if(!settings.reducedFlashes)originalFlash(color,seconds,strength*.55);};
game.reduceMotion=settings.reducedMotion;
const PUNCHES=['jab','cross','uppercut'].map((name,i)=>new E.Attack(name,{wind:[.05,.065,.095][i],active:[.095,.105,.12][i],recover:[.16,.2,.25][i],hitAt:0}));
const combo=new E.Combo(PUNCHES,{window:.48});
const kick=new E.Attack('roundhouse',{wind:.095,active:.13,recover:.24,hitAt:0});
const upper=new E.Attack('uppercut',{wind:.08,active:.14,recover:.24,hitAt:0});
const airKick=new E.Attack('flyingkick',{wind:.055,active:.16,recover:.19,hitAt:0});
const dive=new E.Attack('axekick',{wind:.06,active:.24,recover:.22,hitAt:0});
let state=null,hero=null,sceneUI='title',introTime=0;
let runDifficulty='standard',hurtScale=1,foeScale=1;
const events=[];
const emit=(name,detail={})=>{events.push({at:state?.elapsed||0,name,...detail});if(events.length>450)events.shift();document.dispatchEvent(new CustomEvent('afterframe:'+name,{detail}));};
const enemyData={sentry:{hp:28,w:14,h:36,speed:44,wind:.68},skater:{hp:24,w:13,h:34,speed:76,wind:.48},shield:{hp:46,w:21,h:40,speed:31,wind:.9},gunner:{hp:24,w:14,h:36,speed:28,wind:.95},drone:{hp:20,w:23,h:23,speed:24,wind:.95}};
const enemySpecs=[
 {id:'roof-a',kind:'sentry',x:404,z:48,arena:0},
 {id:'roof-b',kind:'sentry',x:527,z:48,arena:0},
 {id:'roof-c',kind:'gunner',x:609,z:48,arena:0},
 {id:'coil-a',kind:'sentry',x:1147,z:48,area:1},
 {id:'coil-b',kind:'gunner',x:1478,z:48,area:1},
 {id:'turbine-a',kind:'gunner',x:1930,z:48,area:2},
 {id:'turbine-b',kind:'drone',x:2050,z:132,area:2},
 {id:'mix-a',kind:'skater',x:2740,z:48,arena:1},
 {id:'mix-b',kind:'shield',x:2840,z:48,arena:1},
 {id:'mix-c',kind:'gunner',x:2968,z:48,arena:1},
 {id:'mix-d',kind:'skater',x:2910,z:48,arena:1},
 {id:'mix-e',kind:'drone',x:2810,z:132,arena:1}
];
function effect(kind,x,z,extra={}){if(state.effects.length>140)state.effects.shift();state.effects.push({kind,x,z,age:0,life:.45,color:A.C.amber,radius:23,...extra});}
function spark(x,z,color=A.C.amber,count=9){for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,sp=25+Math.random()*80;effect('spark',x,z,{color,life:.2+Math.random()*.25,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp});}}
function word(str,x,z,color=A.C.amber,size=8){effect('text',x,z,{text:str,color,size,life:.75});}
function notify(title,text,tag='FIELD NOTE',time=4.5){if(!state)return;state.toast={title,text,tag,until:state.clock+time};}
function say(text,speaker='RIN',time=5.5){if(!state)return;state.dialogue={text,speaker,until:state.clock+time};}
function sfx(name,opts){game.audio.sfx(name,opts);}
function setupMusic(){
 game.audio.musicVolume=.34;
 game.audio.define('tempo',{wave:'sine',freq:330,to:110,dur:.35,vol:.22});
 game.audio.define('counter',{wave:'triangle',freq:660,to:1320,dur:.3,vol:.28,arp:[0,7,12],step:.055});
 game.audio.define('break',{wave:'noise',freq:1800,to:90,dur:.3,vol:.4});
 game.audio.define('reflect',{wave:'triangle',freq:1100,to:550,dur:.19,vol:.3});
 game.audio.define('pulse',{wave:'sine',freq:70,to:35,dur:.19,vol:.44});
}
const music={
 rooftop:{bpm:108,steps:4,tracks:[{wave:'triangle',vol:.3,notes:'D2 . D2 . . D3 . C3 | D2 . F2 . . A2 . C3 | Bb1 . Bb1 . . F2 . A2 | C2 . C2 . . G2 . C3'},{wave:'pulse',vol:.08,notes:'. . A4 . D5 . . A4 | . . F5 . E5 . . D5 | . . A4 . C5 . . A4 | . . G4 . A4 . . C5'},{wave:'drums',vol:.16,notes:'k . h . s . h h | k . h k s . h . | k . h . s . h h | k . h k s . h .'}]},
 boss:{bpm:132,steps:4,tracks:[{wave:'saw',vol:.14,notes:'D2 . D3 D2 . D2 A2 . | D2 . D3 D2 . F2 C3 . | Bb1 . Bb2 Bb1 . Bb1 F2 . | C2 . C3 C2 . A1 C2 .'},{wave:'triangle',vol:.16,notes:'D4 . A4 . F4 . E4 . | D4 . C5 . A4 . G4 . | F4 . A4 . C5 . A4 . | E4 . G4 . Bb4 . C5 .'},{wave:'drums',vol:.22,notes:'k h h k s h h . | k h k h s h h h | k h h k s h h . | k h k h s h h h'}]},
 victory:{bpm:95,steps:4,tracks:[{wave:'triangle',vol:.25,notes:'D4 . F4 . A4 . D5 - | . . C5 . A4 . F4 - | Bb4 . A4 . G4 . F4 . | E4 . G4 . A4 - D5 -'},{wave:'sine',vol:.2,notes:'D3 - - - A2 - - - | F3 - - - C3 - - - | Bb2 - - - F3 - - - | C3 - - - D3 - - -'}]}
};
function createLevel(){
 const rows=Array.from({length:20},()=>'.'.repeat(254));
 const map=new E.PlatformMap({rows,legend:{},types:{1:{kind:'solid',style:'plain',side:'#142c39'},2:{kind:'oneway',style:'plain',side:'#354f59'}},edges:'solid'});
 const platforms=[{x:0,z:48,w:992},{x:1088,z:48,w:1344},{x:2528,z:48,w:1536},
  {x:784,z:96,w:80,upper:true,depth:20},{x:880,z:144,w:128,upper:true,depth:20},
  {x:1136,z:112,w:96,upper:true,depth:20},{x:1840,z:96,w:80,upper:true,depth:20},{x:1952,z:144,w:128,upper:true,depth:20},
  {x:2368,z:96,w:64,upper:true,depth:20},{x:2464,z:144,w:144,upper:true,depth:20},{x:3072,z:112,w:80,upper:true,depth:20}];
 for(const p of platforms){const z=p.z/16-1;for(let x=p.x/16;x<(p.x+p.w)/16;x++){if(p.upper)map.set(x,z,2);else for(let y=0;y<=z;y++)map.set(x,y,1);}}
 return {map,platforms};
}
function createEnemy(spec){const d=enemyData[spec.kind];return {...d,...spec,maxHp:Math.round(d.hp*foeScale),hp:Math.round(d.hp*foeScale),vx:0,vz:0,facing:-1,onGround:false,state:'idle',timer:.35+Math.random()*.4,hit:0,exposed:0,stun:0,guard:spec.kind==='shield'?2:0,dead:false,deathAge:0,anim:Math.random()*4,baseZ:spec.z,rig:spec.kind==='drone'?null:A.makeRig(spec.kind),attackHit:false,launchHits:new Set()};}
function emptyState(){
 const {map,platforms}=createLevel();
 return {map,platforms,settings,clock:0,elapsed:0,score:0,combo:0,comboLeft:0,bestCombo:0,counters:0,reflections:0,damage:0,deaths:0,kills:0,power:'none',powerLock:0,tempo:100,maxTempo:100,upgrade:null,upgradePending:false,
  enemies:enemySpecs.map(createEnemy),projectiles:[],effects:[],trails:[],trailClock:0,shockwaves:[],cleared:[],checkpoint:0,checkpointData:null,activeArena:null,boss:null,bossStarted:false,bossDead:false,endTimer:0,
  coil:{x:1225,charge:0},rushGate:{x:1350,open:false},turbines:[{x:1664,z:90,r:38,angle:0},{x:1776,z:90,r:38,angle:1}],wall:{x:2152,w:24,h:155,hp:3,broken:false},
  arenas:[{id:0,x0:260,x1:690,trigger:302,name:'ROOFTOP STATIC',done:false,active:false},{id:1,x0:2650,x1:3024,trigger:2690,name:'SIGNAL INTERCEPT',done:false,active:false}],
  collectibles:[{id:'signal-1',kind:'signal',x:938,z:162,collected:false},{id:'signal-2',kind:'signal',x:2007,z:162,collected:false},{id:'signal-3',kind:'signal',x:2548,z:165,collected:false},
   {id:'cell-1',kind:'tempo',x:834,z:112,collected:false},{id:'cell-2',kind:'tempo',x:1170,z:130,collected:false},{id:'cell-3',kind:'heal',x:1540,z:65,collected:false},{id:'cell-4',kind:'heal',x:2270,z:64,collected:false},{id:'cell-5',kind:'heal',x:3080,z:65,collected:false}],
  props:[{kind:'rail',x:20,w:160},{kind:'sign',x:158,text:'NOVA / 09',sub:'UNAUTHORISED SIGNAL'},{kind:'vent',x:713},{kind:'antenna',x:800},{kind:'rail',x:1110,w:200},{kind:'sign',x:1540,text:'INDUCTION',sub:'KEEP THE CURRENT MOVING'},{kind:'vent',x:1850},{kind:'antenna',x:2220},{kind:'sign',x:2320,text:'PIRATE RADIO',sub:'YOU ARE NOT ALONE'},{kind:'rail',x:2570,w:100},{kind:'antenna',x:3120},{kind:'sign',x:3216,text:'RELAY NINE',sub:'CENTRAL TRANSMISSION'},{kind:'rail',x:3860,w:180}],
  seen:{},lastMove:'',variety:[],lastSafe:{x:120,z:48},toast:null,dialogue:null,section:'ROOFTOP APPROACH',objective:'Reach Relay Nine',sectionNumber:'01'};
}
function start(resume=false,resumeData=null){
 runDifficulty=settings.difficulty;hurtScale=runDifficulty==='story'?.7:runDifficulty==='expert'?1.28:1;foeScale=runDifficulty==='story'?.8:runDifficulty==='expert'?1.2:1;
 const saved=resumeData||(resume?E.store.get(SAVE,null):null);
 state=emptyState();hero=new E.Platformer({x:110,z:48,w:13,h:38,run:127,accel:1000,decel:1400,airAccel:840,jump:300,gravity:760,fallGravity:1070,maxFall:360,airJumps:1,dash:250,dashTime:.19});
 Object.assign(hero,{kind:'hero',rig:A.makeRig('hero'),hp:runDifficulty==='story'?10:runDifficulty==='expert'?6:8,maxHp:runDifficulty==='story'?10:runDifficulty==='expert'?6:8,hurt:0,hit:0,dodgeTime:9,perfect:false,moveType:'idle',attack:null,floor:48,dead:false});
 if(saved&&saved.version===1){
  Object.assign(state,{score:saved.score||0,elapsed:saved.elapsed||0,bestCombo:saved.bestCombo||0,counters:saved.counters||0,reflections:saved.reflections||0,kills:saved.kills||0,damage:saved.damage||0,deaths:saved.deaths||0,checkpoint:saved.checkpoint||0,upgrade:saved.upgrade||null});
  if(state.upgrade==='cell')state.maxTempo=130;if(state.upgrade==='heart')hero.maxHp+=2;hero.hp=hero.maxHp;state.tempo=state.maxTempo;
  hero.x=saved.x||110;hero.z=48;state.lastSafe={x:hero.x,z:48};state.cleared=saved.cleared||[];
  state.rushGate.open=!!saved.rushOpen;state.coil.charge=state.rushGate.open?100:0;state.wall.broken=!!saved.wallBroken;
  for(const a of state.arenas){a.done=state.cleared.includes(a.id);}
  for(const e of state.enemies){if((e.arena!==undefined&&state.cleared.includes(e.arena))||(e.area!==undefined&&e.area<state.checkpoint)){e.dead=true;e.deathAge=1;}}
  for(const c of state.collectibles)c.collected=(saved.collected||[]).includes(c.id);
  state.checkpointData={...saved};
 }
 game.particles.ground=(x,y,z)=>state.map.groundBelow(x,z);combo.cancel();for(const a of[kick,upper,airKick,dive])a.cancel();game.input.clear();game.go('play',null,{fade:.16});setupMusic();game.audio.music(music.rooftop);emit('start',{resume:!!saved,difficulty:runDifficulty});
}
function saveCheckpoint(index,x,silent=false){
 state.checkpoint=index;state.checkpointData={version:1,checkpoint:index,x,cleared:[...state.cleared],rushOpen:state.rushGate.open,wallBroken:state.wall.broken,upgrade:state.upgrade,collected:state.collectibles.filter(c=>c.collected).map(c=>c.id),score:state.score,elapsed:state.elapsed,bestCombo:state.bestCombo,counters:state.counters,reflections:state.reflections,kills:state.kills,damage:state.damage,deaths:state.deaths};
 E.store.set(SAVE,state.checkpointData);emit('checkpoint',{index,x});if(!silent){hero.hp=Math.min(hero.maxHp,hero.hp+2);state.tempo=state.maxTempo;notify('Signal secured','Health restored. This section is saved.','CHECKPOINT',2.8);sfx('powerup',{vol:.4});effect('ring',hero.x,hero.z+17,{radius:34,color:A.C.teal,life:.6});}
}
function retry(){const cp=state?.checkpointData;const deaths=(state?.deaths||0)+1;if(cp){E.store.set(SAVE,{...cp,deaths});start(true,{...cp,deaths});}else{start(false);state.deaths=deaths;}emit('retry');}
function title(){game.input.clear();game.go('title',null,{fade:.18});game.audio.music(null);}
function award(points,move){
 state.combo++;state.comboLeft=3.25;state.bestCombo=Math.max(state.bestCombo,state.combo);
 if(move&&state.lastMove!==move){state.variety.push(move);state.variety=[...new Set(state.variety)].slice(-6);}state.lastMove=move;
 const mult=Math.min(4,1+Math.floor(state.combo/6)*.25+state.variety.length*.1);state.score+=Math.round(points*mult);
}
function hitFx(x,z,power=1,color=A.C.amber){
 game.hitFx(x,0,z,{power,color,sound:false});spark(x,z,color,power>1?12:7);effect('ring',x,z,{radius:power>1?24:14,color,life:.24});sfx(power>1.2?'kick':'punch',{pitch:.85+Math.random()*.2,vol:.7});
}
function kill(e){
 if(e.dead)return;e.dead=true;e.hp=0;e.deathAge=0;e.vx=e.facing*25;e.vz=80;state.kills++;state.score+=e.kind==='boss'?2500:e.kind==='shield'?240:140;
 spark(e.x,e.z+e.h*.5,A.C.amber,16);game.particles.bits(e.x,0,e.z+20,7,['#e79956','#487986','#b6d0b4']);sfx('explode',{vol:.25,pitch:1.6});state.tempo=Math.min(state.maxTempo,state.tempo+13);emit('kill',{kind:e.kind,id:e.id});
 if(e.kind==='boss'){state.bossDead=true;state.endTimer=3.2;game.audio.music(null);game.freeze(.14);game.shake(6);game.flash('#fff2d2',.25,.5);say('Hear that? That is a city finding its voice.','RIN',7);emit('boss_defeated');}
}
function takeDamage(amount,sourceX,type='hit'){
 if(hero.hurt>0||hero.dashing>0||state.bossDead)return false;
 const damage=runDifficulty==='story'?1:amount;hero.hp-=damage;hero.hurt=1.05;hero.hit=.2;hero.knock(hero.x<sourceX?-1:1,115,type==='pit'?0:145,.22);hero.rig.kick(-.5);state.damage+=damage;state.combo=0;state.comboLeft=0;state.variety=[];state.power='none';combo.cancel();for(const a of[kick,upper,airKick,dive])a.cancel();
 game.shake(3);game.flash('#ed4c57',.15,.35);sfx('hurt',{vol:.55});spark(hero.x,hero.z+19,A.C.red,8);emit('damage',{amount:damage,type});
 if(hero.hp<=0){hero.hp=0;hero.dead=true;state.power='none';game.go('dead',null,{fade:.18});sfx('die',{vol:.35});}
 return true;
}
function openCore(seconds){const b=state.boss;if(!b||b.dead)return;b.exposed=Math.max(b.exposed,seconds);b.guard=3;if(b.state==='wind'||b.state==='dash'||b.state==='fire'){b.state='recover';b.timer=seconds*.75;b.vx=0;}word('CORE OPEN',b.x,b.z+99,A.C.amber,8);}
function perfectDodge(e){
 if(hero.perfect)return;hero.perfect=true;state.counters++;state.tempo=Math.min(state.maxTempo,state.tempo+18+(state.upgrade==='counter'?20:0));award(110,'dodge');e.exposed=2.9;e.state='recover';e.timer=1.15;e.vx=0;if(e.kind==='boss')openCore(2.8);
 effect('ring',hero.x,hero.z+20,{color:A.C.teal,radius:44,life:.42});word('PERFECT CUT',hero.x,hero.z+57,A.C.teal,9);game.freeze(.065);sfx('counter');emit('perfect_dodge',{enemy:e.id||'warden'});
}
function deal(e,damage,kind){
 if(e.dead)return;const power=state.power,focused=power==='focus',opening=e.exposed>0;
 if(e.kind==='shield'&&e.guard>0&&!opening){
  if(focused){e.guard--;hitFx(e.x,e.z+23,1.1,A.C.purple);word(e.guard?'ARMOUR CRACK':'GUARD BREAK',e.x,e.z+48,A.C.purple,7);if(e.guard===0){e.exposed=3.1;e.state='recover';e.timer=1;sfx('break',{vol:.55});emit('guard_break',{id:e.id});}}else{spark(e.x,e.z+23,A.C.teal,4);sfx('bump',{vol:.35});if(!state.seen.shield){notify('Break their guard','Hold R for Focus. Then strike the shield.');state.seen.shield=true;}}
  return;
 }
 if(e.kind==='boss'&&!opening){
  if(focused){e.guard--;hitFx(e.x,e.z+48,1,A.C.purple);if(e.guard<=0)openCore(2.2);}else{spark(e.x,e.z+48,A.C.teal,3);sfx('bump',{vol:.22});}
  return;
 }
 let dmg=damage*(focused?1.7:1)*(opening?1.4:1);
 if(power==='rush')dmg*=.85;
 e.hp-=dmg;e.hit=.17;e.stun=e.kind==='boss'?0:focused?.29:.2;
 const color=focused?A.C.purple:power==='slow'?A.C.teal:A.C.amber;
 hitFx(e.x,e.z+(e.kind==='boss'?47:22),focused?1.5:kind.includes('kick')?1.1:.8,color);
 award(e.kind==='boss'?70:30,power+':'+kind);state.tempo=Math.min(state.maxTempo,state.tempo+(power==='none'?3:0));
 if(e.kind!=='boss'){
  e.vx=hero.facing*(focused?175:kind==='uppercut'?95:85);e.state='stun';e.timer=e.stun;
  if(kind==='uppercut'||kind==='divekick'||(power==='slow'&&opening)){e.vz=kind==='divekick'?90:200;e.flying=.85;e.launchHits.clear();}
 }
 if(e.hp<=0)kill(e);emit('hit',{enemy:e.id||'warden',move:kind,power,damage:Math.round(dmg)});
}
function updatePower(dt){
 const inp=game.input;state.powerLock=Math.max(0,state.powerLock-dt);
 let p=state.powerLock>0?'none':inp.down('focus')?'focus':inp.down('slow')?'slow':inp.down('rush')?'rush':'none';
 if(p!=='none'&&state.tempo<=0)p='none';
 if(p!==state.power&&p!=='none'){sfx('tempo',{pitch:p==='slow'?.7:p==='rush'?1.5:1});effect('ring',hero.x,hero.z+22,{radius:40,life:.38,color:p==='slow'?A.C.teal:p==='rush'?A.C.orange:A.C.purple});emit('power',{power:p});}
 state.power=p;
 if(p==='none')state.tempo=Math.min(state.maxTempo,state.tempo+20*dt);else{state.tempo=Math.max(0,state.tempo-({slow:16,rush:23,focus:27}[p])*dt);if(state.tempo===0){state.powerLock=1.1;state.power='none';notify('Tempo depleted','Release the powers to recharge. Movement stays available.','TEMPO',2.5);emit('tempo_depleted');}}
}
function startAttack(type){
 const special=kick.busy||upper.busy||airKick.busy||dive.busy;
 if(hero.dashing>0||hero.stun>0)return false;
 if(type==='punch'&&!special){if(!combo.press())return false;hero.moveType=combo.step===2?'uppercut':combo.step===1?'cross':'jab';hero.attack=combo;return true;}
 if(special)return false;if(combo.busy&&combo.current.phase!=='recover')return false;combo.cancel();
 const a={kick,uppercut:upper,airkick:airKick,divekick:dive}[type];if(!a||!a.start())return false;hero.moveType=type;hero.attack=a;
 if(type==='divekick'){hero.vz=-330;hero.vx=hero.facing*100;hero.stun=.17;}if(type==='uppercut'&&!hero.onGround)hero.vz=120;
 return true;
}
function updateHero(dt){
 const inp=game.input;hero.hurt=Math.max(0,hero.hurt-dt);hero.hit=Math.max(0,hero.hit-dt);hero.dodgeTime+=dt;
 let active=hero.attack&&hero.attack.busy;
 if(inp.buffered('dash',.13)&&hero._dashCD<=0&&hero.stun<=0){
  combo.cancel();for(const a of[kick,upper,airKick,dive])a.cancel();hero.attack=null;hero.moveType='dodge';hero.perfect=false;hero.dodgeTime=0;
  const dx=inp.move()[0];if(Math.abs(dx)>.2)hero.facing=Math.sign(dx);
  for(const e of [...state.enemies,state.boss].filter(Boolean)){if(!e.dead&&e.kind!=='boss'&&e.state==='wind'&&e.timer<.3&&Math.abs(e.x-hero.x)<(e.kind==='boss'?110:75))perfectDodge(e);}
  sfx('whoosh',{pitch:.9,vol:.35});active=false;
 }
 if(inp.buffered('attack',.18)||(settings.holdAttack&&inp.down('attack'))){const type=inp.down('up')?'uppercut':'punch';if(startAttack(type))inp.consume('attack');}
 if(inp.buffered('kick',.18)){const type=!hero.onGround?(inp.down('down')?'divekick':'airkick'):'kick';if(startAttack(type))inp.consume('kick');}
 active=hero.attack&&hero.attack.busy;
 const moving=inp.move()[0];const attacking=active&&hero.attack.state?.phase!=='recover';
 hero.run=127*(state.power==='rush'?1.75:state.power==='focus'?.68:1)*(attacking?.36:1);
 hero.h=inp.down('down')&&hero.onGround&&!active?22:38;
 const proxy={map:inp.map,move:()=>[moving,0],down:a=>inp.down(a),buffered:(a,w)=>inp.buffered(a,w),consume:a=>inp.consume(a)};
 hero.update(dt,state.map,proxy,[]);
 if(hero.jumped){sfx(hero._airJ===0?'jump2':'jump',{vol:.32,pitch:.9});hero.rig.kick(.35);effect('ring',hero.x,hero.z+2,{flat:true,radius:15,color:A.C.paper,life:.25});}
 if(hero.landed){hero.rig.kick(-.5);effect('ring',hero.x,hero.z+1,{flat:true,radius:20,color:'#718f98',life:.28});sfx('land',{vol:.19});if(hero.moveType==='divekick'&&dive.busy){for(const e of state.enemies)if(!e.dead&&Math.abs(e.x-hero.x)<35&&Math.abs(e.z-hero.z)<24)deal(e,7,'divekick');dive.cancel();}}
 const rate=state.power==='rush'?1.9:state.power==='focus'?.92:1;
 let attackPhase=null;for(const a of[combo,kick,upper,airKick,dive]){const phase=a.update(dt*rate);if(a===hero.attack)attackPhase=phase;}
 if(attackPhase==='active'){
  sfx(hero.moveType.includes('kick')?'swing':'whoosh',{pitch:state.power==='rush'?1.3:1,vol:.28});effect('slash',hero.x+hero.facing*7,hero.z+23,{radius:hero.moveType.includes('kick')?33:25,face:hero.facing,color:state.power==='focus'?A.C.purple:state.power==='slow'?A.C.teal:A.C.amber,life:.16});
 }
 if(hero.attack?.active){
  const move=hero.moveType,isKick=move.includes('kick'),reach=isKick?38:move==='uppercut'?27:30;
  const box={x:hero.x+hero.facing*(reach*.5+4),z:hero.z+(move==='uppercut'?9:4),w:reach+8,h:move==='uppercut'?57:isKick?35:32};
  hero.attack.hits(state.enemies.concat(state.boss?[state.boss]:[]),e=>E.overlapBox(box,e),e=>deal(e,isKick?8:move==='uppercut'?8:5,move));
  // An enemy bolt is a hit target only during Slow. Reflection changes ownership.
  if(state.power==='slow')hero.attack.hits(state.projectiles,b=>b.team!=='hero'&&E.overlapBox(box,{x:b.x,z:b.z-3,w:10,h:6}),b=>{b.team='hero';b.vx=hero.facing*350;b.vz=0;b.life=3;state.reflections++;state.tempo=Math.min(state.maxTempo,state.tempo+9);award(100,'reflect');spark(b.x,b.z,A.C.teal,8);word('RETURN TO SENDER',hero.x,hero.z+53,A.C.teal,7);sfx('reflect');game.freeze(.04);emit('reflect');});
  if(state.power==='focus'&&!state.wall.broken&&E.overlapBox(box,{x:state.wall.x,z:48,w:24,h:155}))hero.attack.hits([state.wall],()=>true,w=>{w.hp--;hitFx(w.x,hero.z+22,1.45,A.C.purple);if(w.hp<=0){w.broken=true;sfx('break');spark(w.x,100,A.C.purple,22);notify('The way is clear','Focus breaks armour and cracked structures.','FOCUS',2.5);state.score+=350;emit('wall_broken');}});
 }
 if(hero.attack&&!hero.attack.busy)hero.attack=null;
 // Collision gates are tall, reversible gameplay locks, independent of artwork.
 let minX=16,maxX=4040;
 for(const ar of state.arenas){if(!ar.done){maxX=Math.min(maxX,ar.x1-14);if(ar.active)minX=Math.max(minX,ar.x0+13);break;}}
 if(!state.rushGate.open)maxX=Math.min(maxX,state.rushGate.x-17);
 if(!state.wall.broken)maxX=Math.min(maxX,state.wall.x-21);
 if(state.bossStarted&&!state.bossDead){minX=Math.max(minX,3210);maxX=Math.min(maxX,3890);}
 const oldX=hero.x;hero.x=clamp(hero.x,minX,maxX);if(oldX!==hero.x)hero.vx=0;
 if(hero.onGround&&hero.z>=48&&hero.z<52){const ground1=state.map.groundBelow(hero.x-20,hero.z+1),ground2=state.map.groundBelow(hero.x+20,hero.z+1);if(ground1===48&&ground2===48)state.lastSafe={x:hero.x,z:48};}
 if(hero.z<-36){takeDamage(1,hero.x,'pit');if(!hero.dead){hero.x=state.lastSafe.x;hero.z=state.lastSafe.z+5;hero.vx=0;hero.vz=0;hero.hurt=.8;hero.stun=0;game.cam.snap=true;effect('ring',hero.x,hero.z+10,{radius:30,color:A.C.red,life:.5});}}
 hero.floor=state.map.groundBelow(hero.x,hero.z+2)??48;
 const pose=hero.hp<=0?'die':hero.h<30?'crouch':undefined;
 hero.rig.update(dt,{...hero.rigState({attack:hero.attack?.state,pose,stance:'guard',hurt:hero.hit>.08}),facing:hero.facing>0?.18:Math.PI-.18});
}
function shoot(e,speed=150,aim=true){
 const x=e.x+e.facing*(e.kind==='boss'?29:15),z=e.z+(e.kind==='boss'?54:e.kind==='drone'?-13:27);
 const dx=hero.x-x,dz=hero.z+20-z,len=Math.hypot(dx,dz)||1;
 state.projectiles.push({x,z,vx:aim?dx/len*speed:e.facing*speed,vz:aim?dz/len*speed:0,team:'foe',life:5,r:3,damage:e.kind==='boss'?2:1,from:e.id||'warden'});
 sfx('shoot',{vol:.24,pitch:e.kind==='boss'?.65:1.2});effect('ring',x,z,{radius:10,color:A.C.amber,life:.12});
}
function updateEnemy(e,dt,realDt){
 e.anim+=dt;e.hit=Math.max(0,e.hit-realDt);if(e.dead){e.deathAge+=realDt;return;}
 const arena=e.arena!==undefined?state.arenas[e.arena]:null;
 if(arena&&!arena.active)return;if(Math.abs(e.x-hero.x)>540)return;
 e.exposed=Math.max(0,e.exposed-dt);e.stun=Math.max(0,e.stun-dt);e.timer-=dt;
 if(e.kind==='drone'){
  e.z=E.lerp(e.z,e.baseZ+Math.sin(e.anim*1.7)*11,Math.min(1,dt*5));e.vz=0;
 }else{e.vz-=850*dt;}
 const dx=hero.x-e.x,distance=Math.abs(dx),dz=Math.abs(hero.z-e.z);
 if(e.state==='idle'){
  e.facing=dx>0?1:-1;
  if(e.kind==='gunner'||e.kind==='drone'){
   e.vx=distance<77?-e.facing*e.speed:distance>205?e.facing*e.speed:0;
   if(e.timer<=0&&distance<320){e.state='wind';e.timer=e.wind/hurtScale;e.vx=0;e.attackHit=false;}
  }else{
   e.vx=distance>32?e.facing*e.speed:0;
   if(e.timer<=0&&distance<52&&dz<40){e.state='wind';e.timer=e.wind/hurtScale;e.vx=0;e.attackHit=false;e.attackHeight=e.kind==='skater'?'low':'high';}
  }
 }else if(e.state==='wind'){
  e.vx=0;if(e.timer<=0){e.state='strike';e.timer=e.kind==='gunner'||e.kind==='drone'?.13:.17;e.attackHit=false;if(e.kind==='gunner'||e.kind==='drone')shoot(e,e.kind==='drone'?135:160);else e.vx=e.facing*(e.kind==='skater'?160:88);}
 }else if(e.state==='strike'){
  if(!['gunner','drone'].includes(e.kind)){
   const box={x:e.x+e.facing*20,z:e.z+(e.attackHeight==='high'?22:0),w:38,h:e.attackHeight==='high'?19:18};
   if(!e.attackHit&&E.overlapBox(box,hero)){
    if(hero.dashing>0&&hero.dodgeTime<.22){perfectDodge(e);e.attackHit=true;}
    else e.attackHit=takeDamage(1,e.x);
   }
  }
  if(e.timer<=0){
   if(!e.attackHit&&hero.h<30&&distance<70&&e.attackHeight==='high'){e.exposed=2.4;state.tempo=Math.min(state.maxTempo,state.tempo+8);word('DUCK COUNTER',hero.x,hero.z+44,A.C.teal,7);emit('duck_counter');}
   e.state='recover';e.timer=.65/hurtScale;e.vx=0;
  }
 }else if(e.state==='recover'){
  e.vx=E.approach(e.vx,0,dt*400);if(e.timer<=0){e.state='idle';e.timer=.28;}
 }else if(e.state==='stun'){
  e.vx=E.approach(e.vx,0,dt*220);if(e.timer<=0){e.state='recover';e.timer=.3;}
 }
 if(e.kind==='drone')e.x+=e.vx*dt;else state.map.move(e,dt);
 if(arena){e.x=clamp(e.x,arena.x0+20,arena.x1-20);}else e.x=clamp(e.x,16,4032);
 if(e.z<-45)kill(e);
 if(e.flying>0){e.flying-=dt;for(const other of state.enemies){if(other!==e&&!other.dead&&!e.launchHits.has(other)&&E.overlapBox(e,other)){e.launchHits.add(other);other.hp-=6;other.hit=.14;other.vx=hero.facing*95;other.state='stun';other.timer=.25;hitFx(other.x,other.z+20,.65,A.C.teal);award(60,'ricochet');if(other.hp<=0)kill(other);emit('enemy_ricochet');}}}
 e.floor=state.map.groundBelow(e.x,e.z+2)??48;
 if(e.rig)e.rig.update(dt,{x:e.x,y:0,z:e.z,vx:e.vx,vy:0,vz:e.vz,facing:e.facing>0?.18:Math.PI-.18,air:!e.onGround,stance:'guard',pose:e.state==='wind'?'guard':undefined,hurt:e.hit>.05,point:e.kind==='gunner',attack:e.state==='strike'?{spec:E.MOVES[e.kind==='skater'?'sweep':'cross'],phase:'active',u:.7}:null});
}
function makeBoss(){return {id:'relay-warden',kind:'boss',x:3630,z:48,w:65,h:99,hp:Math.round(180*foeScale),maxHp:Math.round(180*foeScale),vx:0,vz:0,facing:-1,anim:0,hit:0,exposed:0,guard:3,state:'intro',action:'volley',timer:2.8,cycle:0,shots:0,dead:false,deathAge:0,phase:1,floor:48};}
function updateBoss(b,dt,realDt){
 b.anim+=dt;b.hit=Math.max(0,b.hit-realDt);if(b.dead){b.deathAge+=realDt;return;}
 b.timer-=dt;b.exposed=Math.max(0,b.exposed-dt);
 if(b.hp<=b.maxHp*.5&&b.phase===1){b.phase=2;b.state='intro';b.timer=1.6;b.vx=0;b.z=48;b.exposed=0;b.guard=3;sfx('boom',{vol:.4});effect('ring',b.x,b.z+48,{radius:110,color:A.C.red,life:.85});notify('Signal overload','The Warden now links faster attacks. Watch each warning.','PHASE 02',3);emit('boss_phase',{phase:2});}
 if(b.state==='intro'){if(b.timer<=0){b.state='idle';b.timer=.3;}}
 else if(b.state==='idle'){
  b.vx=0;if(b.timer<=0){b.action=['volley','slam','dash'][b.cycle%3];b.cycle++;b.state='wind';b.timer=(b.action==='volley'?.9:b.action==='slam'?1.05:.9)/(b.phase===2?1.12:1)/hurtScale;b.facing=hero.x>b.x?1:-1;b.targetX=clamp(hero.x,3280,3830);sfx('charge',{vol:.25,pitch:.6});}
 }else if(b.state==='wind'){
  if(b.timer<=0){
   if(b.action==='volley'){b.state='fire';b.shots=b.phase===2?5:3;b.timer=0;}
   else if(b.action==='slam'){b.state='leap';b.timer=.48;b.startX=b.x;}
   else{b.state='dash';b.timer=1.3;b.vx=b.facing*(b.phase===2?315:265);}
  }
 }else if(b.state==='fire'){
  if(b.timer<=0){b.facing=hero.x>b.x?1:-1;shoot(b,b.phase===2?200:175,true);b.shots--;b.timer=b.phase===2?.22:.32;if(b.shots<=0){b.state='recover';b.timer=1.9;b.exposed=2.1;b.guard=3;}}
 }else if(b.state==='leap'){
  const u=clamp(1-b.timer/.48,0,1);b.x=E.lerp(b.startX,b.targetX,E.ease.inOut(u));b.z=48+Math.sin(u*Math.PI)*45;
  if(b.timer<=0){b.x=b.targetX;b.z=48;b.state='recover';b.timer=2.25;b.exposed=2.5;b.guard=3;game.shake(6);sfx('boom',{vol:.6,pitch:.65});effect('ring',b.x,51,{radius:85,color:A.C.amber,flat:true,life:.6});spark(b.x,53,A.C.amber,18);if(Math.abs(hero.x-b.x)<57&&hero.z<65)takeDamage(2,b.x);for(let d of[-1,1])state.shockwaves.push({x:b.x+d*40,z:49,vx:d*(b.phase===2?175:140),life:2.7,hit:false});}
 }else if(b.state==='dash'){
  b.x+=b.vx*dt;if(Math.abs(hero.x-b.x)<44&&hero.z<b.z+64){if(hero.dashing>0)perfectDodge(b);else takeDamage(2,b.x);}
  if(b.timer<=0||b.x<3260||b.x>3820){b.x=clamp(b.x,3260,3820);b.state='recover';b.vx=0;b.timer=1.8;b.exposed=2;b.guard=3;}
 }else if(b.state==='recover'){
  b.vx=0;if(b.timer<=0){b.state='idle';b.timer=.4;b.exposed=Math.max(.15,b.exposed);}
 }
}
function updateBullets(dt,realDt){
 for(const b of state.projectiles){
  b.life-=realDt;const step=b.team==='hero'?realDt:dt;b.x+=b.vx*step;b.z+=b.vz*step;
  if(b.team==='foe'){
   if(E.overlapBox({x:b.x,z:b.z-3,w:7,h:6},hero)){if(hero.dashing>0){b.life=0;word('EVADE',hero.x,hero.z+45,A.C.teal,6);}else if(takeDamage(b.damage||1,b.x))b.life=0;}
  }else{
   for(const e of [...state.enemies,state.boss].filter(Boolean))if(!e.dead&&E.overlapBox({x:b.x,z:b.z-4,w:10,h:8},e)){
    if(e.kind==='boss'){openCore(2.8);e.hp-=24;award(260,'boss-reflect');}else{e.hp-=24;e.exposed=2.2;e.state='stun';e.timer=.6;award(110,'bolt-hit');}
    e.hit=.2;hitFx(b.x,b.z,1.45,A.C.teal);if(e.hp<=0)kill(e);b.life=0;break;
   }
  }
  if(state.map.solidAt(b.x,b.z)||b.x<0||b.x>4100||b.z<-10)b.life=0;
 }
 E.prune(state.projectiles,b=>b.life<=0);
 for(const w of state.shockwaves){w.x+=w.vx*dt;w.life-=dt;if(!w.hit&&Math.abs(hero.x-w.x)<16&&hero.z<63){w.hit=takeDamage(1,w.x);}if(w.x<3200||w.x>3900)w.life=0;}
 E.prune(state.shockwaves,w=>w.life<=0);
}
function updateWorld(dt,enemyDt){
 const x=hero.x;
 for(const a of state.arenas){
  if(!a.done&&!a.active&&x>a.trigger){a.active=true;state.activeArena=a.id;notify(a.name,'Clear the patrol to open the signal gate.','INTERCEPT',2.4);emit('arena_start',{id:a.id});}
  if(a.active&&!a.done&&state.enemies.filter(e=>e.arena===a.id).every(e=>e.dead)){
   a.done=true;a.active=false;state.activeArena=null;state.cleared.push(a.id);state.score+=500;notify('Channel clear','The next section is open.','INTERCEPT COMPLETE',2.5);sfx('door',{vol:.4});emit('arena_clear',{id:a.id});
  }
 }
 if(!state.rushGate.open&&Math.abs(x-state.coil.x)<40&&hero.z<86){
  if(state.power==='rush'){state.coil.charge=Math.min(100,state.coil.charge+48*dt);if(Math.random()<dt*30)spark(state.coil.x,74,A.C.orange,1);}
  if(state.coil.charge>=100){state.rushGate.open=true;state.score+=350;notify('Induction gate open','Rush turns motion into power.','RUSH',3);sfx('door');effect('ring',state.coil.x,75,{radius:55,color:A.C.teal,life:.6});emit('rush_gate_open');}
 }
 for(const t of state.turbines){t.angle+=enemyDt*7;if(state.power!=='slow'&&Math.abs(x-t.x)<27&&hero.z<119&&hero.z+hero.h>t.z-t.r){takeDamage(1,t.x);}}
 for(const c of state.collectibles){if(!c.collected&&Math.abs(hero.x-c.x)<15&&c.z>hero.z-4&&c.z<hero.z+hero.h+8){c.collected=true;effect('ring',c.x,c.z,{radius:23,color:c.kind==='signal'?A.C.amber:A.C.teal,life:.45});sfx(c.kind==='signal'?'secret':'pickup',{vol:.5});if(c.kind==='signal'){state.score+=750;const number=state.collectibles.filter(o=>o.kind==='signal'&&o.collected).length;notify('Lost signal '+number+' / 3',['“If you hear this, keep going.”','“There are still lights in the old city.”','“One voice is enough to start.”'][number-1],'PIRATE ARCHIVE',4);emit('signal',{id:c.id});}else if(c.kind==='heal'){hero.hp=Math.min(hero.maxHp,hero.hp+2);word('+2 HEALTH',c.x,c.z+15,A.C.teal,6);}else{state.tempo=Math.min(state.maxTempo,state.tempo+28);word('+28 TEMPO',c.x,c.z+15,A.C.teal,6);}}}
 if(x>738&&state.checkpoint<1&&state.arenas[0].done)saveCheckpoint(1,753);
 if(x>1555&&state.checkpoint<2&&state.rushGate.open)saveCheckpoint(2,1558);
 if(x>2260&&state.checkpoint<3&&state.wall.broken){saveCheckpoint(3,2280);if(!state.upgrade){state.upgradePending=true;game.paused=true;game.input.clear();emit('upgrade_ready');}}
 if(x>3070&&state.checkpoint<4&&state.arenas[1].done)saveCheckpoint(4,3090);
 if(x>3270&&!state.bossStarted){state.bossStarted=true;state.boss=makeBoss();game.audio.music(music.boss);notify('Relay Warden','Return its bolts. Dodge the sweep. Strike the open core.','TRANSMISSION GUARD',4.8);say('That thing is sitting on the broadcast switch.','RIN',5);emit('boss_start');}
 const thresholds=[
  [155,'basics','Move. Jump. Make contact.','A / D to move. Space to jump. J to punch.','FIRST STEPS'],
  [314,'dodge','Read the attack mark','Dodge with L when the mark flashes. Then counter.','COMBAT'],
  [790,'double','There is another way up','Press Space again in the air. Find the lost signal above.','UPPER PATH'],
  [1175,'rush','Turn motion into power','Stand by the coil. Hold E to charge the gate.','RUSH'],
  [1583,'slow','Take the danger out of time','Hold Q to slow the blades. Walk through while Slow is active.','SLOW'],
  [1880,'reflect','Send their signal back','Hold Q. Punch a yellow bolt with J to return it.','REFLECTION'],
  [2100,'focus','Some things need impact','Hold R for Focus. Strike the cracked wall three times.','FOCUS'],
  [2630,'mixed','One power will not solve every fight','Break shields with Focus. Return bolts with Slow.','SIGNAL CAUSEWAY']
 ];
 for(const [at,key,title,txt,tag]of thresholds)if(x>at&&!state.seen[key]&&x<at+120){state.seen[key]=true;notify(title,txt,tag,4.8);}
 if(state.bossStarted){state.section='RELAY CROWN';state.sectionNumber='05';state.objective=state.bossDead?'Restore the city signal':'Defeat the Relay Warden';}
 else if(x>2300){state.section='SIGNAL CAUSEWAY';state.sectionNumber='04';state.objective=state.arenas[1].done?'Reach the relay crown':'Clear the signal intercept';}
 else if(x>1550){state.section='TURBINE HALL';state.sectionNumber='03';state.objective=state.wall.broken?'Reach the pirate relay':'Cross the blades. Break the sealed wall.';}
 else if(x>750){state.section='INDUCTION SPAN';state.sectionNumber='02';state.objective=state.rushGate.open?'Cross to the turbine hall':'Charge the induction gate with Rush';}
 else{state.section='ROOFTOP APPROACH';state.sectionNumber='01';state.objective=state.arenas[0].done?'Follow the upper signal path':'Clear the rooftop patrol';}
}
function chooseUpgrade(which){
 if(!state?.upgradePending||!['cell','counter','heart'].includes(which))return;
 state.upgrade=which;state.upgradePending=false;if(which==='cell'){state.maxTempo+=30;state.tempo=state.maxTempo;}if(which==='heart'){hero.maxHp+=2;hero.hp=hero.maxHp;}game.paused=false;game.input.clear();saveCheckpoint(3,2280,true);sfx('powerup');notify('Signal tuned',{cell:'Your Tempo reserve is now 130.',counter:'Perfect dodges restore 38 Tempo.',heart:'Two new health cells. Ready for the Warden.'}[which],'UPGRADE',3);emit('upgrade',{which});
}
function update(dt){
 if(!state||!hero||state.upgradePending)return;
 state.clock+=dt;state.elapsed+=dt;
 if(state.bossDead){
  state.boss.deathAge+=dt;state.endTimer-=dt;state.power='none';
  hero.vx=0;hero.vz=Math.max(-360,hero.vz-1070*dt);state.map.move(hero,dt);
  hero.floor=state.map.groundBelow(hero.x,hero.z+2)??48;
  hero.rig.update(dt,{x:hero.x,y:0,z:hero.z,vx:0,vy:0,vz:hero.vz,facing:hero.facing>0?.18:Math.PI-.18,pose:hero.onGround?'cheer':'fall'});
  view.set(0,0,E.lerp(view.scale,2.7,Math.min(1,dt*6)));game.focus(clamp(hero.x+hero.facing*45,3370,3750),0,118);
  if(state.endTimer<=0){win();return;}updateEffects(dt);return;
 }
 updatePower(dt);updateHero(dt);if(hero.dead)return;
 const worldDt=dt*(state.power==='slow'?.22:1);
 updateWorld(dt,worldDt);
 for(const e of state.enemies)updateEnemy(e,worldDt,dt);
 if(state.boss)updateBoss(state.boss,worldDt,dt);
 updateBullets(worldDt,dt);updateEffects(dt);
 if(state.comboLeft>0){state.comboLeft-=dt;if(state.comboLeft<=0){state.combo=0;state.variety=[];state.lastMove='';}}
 const zoomTarget=state.power==='focus'?2.98:2.7;view.set(0,0,E.lerp(view.scale,zoomTarget,Math.min(1,dt*6)));
 let targetX=hero.x+hero.facing*43;
 if(state.activeArena!==null){const a=state.arenas[state.activeArena];targetX=clamp(targetX,a.x0+110,a.x1-90);}
 if(state.bossStarted)targetX=clamp(hero.x+hero.facing*45,3370,3750);
 targetX=clamp(targetX,218,3840);const targetZ=hero.z>115?hero.z+60:118;
 game.focus(targetX,0,targetZ);
}
function updateEffects(dt){
 for(const e of state.effects){e.age+=dt;if(e.vx)e.x+=e.vx*dt;if(e.vz){e.z+=e.vz*dt;e.vz-=120*dt;}}
 E.prune(state.effects,e=>e.age>=e.life);
 state.trailClock+=dt;if(!settings.reducedMotion&&(state.power==='rush'||hero.dashing>0)&&state.trailClock>.045){state.trailClock=0;state.trails.push({x:hero.x,z:hero.z,age:0});}
 for(const t of state.trails)t.age+=dt;E.prune(state.trails,t=>t.age>.24);
}
function draw(r){
 if(!state)return;A.background(r,state);A.scenery(r,state);
 for(const a of state.arenas){A.gate(r,a.x1,a.done,A.C.red,a.active?'INTERCEPT':'SIGNAL LOCK');if(a.active)A.gate(r,a.x0,false,A.C.red,'');}
 A.coil(r,state.coil,state);A.gate(r,state.rushGate.x,state.rushGate.open,A.C.orange,'INDUCTION');
 for(const t of state.turbines)A.turbine(r,t,state);A.wall(r,state.wall);
 for(const c of state.collectibles)A.collectible(r,c,state);
 for(const t of state.trails)A.actor(r,{...hero,x:t.x,z:t.z},{alpha:(1-t.age/.24)*.2,tint:state.power==='rush'?A.C.orange:A.C.teal,bias:-.1});
 for(const e of state.enemies)if(!e.dead||e.deathAge<.6){A.shadow(r,e);A.actor(r,e);A.warning(r,e);}
 if(state.boss){A.shadow(r,state.boss);A.actor(r,state.boss);A.bossTelegraph(r,state.boss,state);}
 A.shadow(r,hero);A.actor(r,hero,{alpha:hero.hurt>0&&(Math.floor(state.clock*16)%2===0)?.52:1});
 for(const b of state.projectiles)A.projectile(r,b);
 for(const w of state.shockwaves)A.withWorld(r.ctx,r,w.x,w.z,()=>{A.glow(r.ctx,0,-6,22,A.C.orange,.4);A.path(r.ctx,[[-9,0],[-3,-12],[1,-18],[4,-6],[10,0]],A.C.amber,A.C.ink,.7);});
 r.overlay(g=>{for(const e of state.effects)A.effect(r,e);if(state.power!=='none'){g.save();g.globalAlpha=settings.reducedFlashes?.018:.045;g.fillStyle=state.power==='slow'?A.C.teal:state.power==='rush'?A.C.orange:A.C.purple;g.fillRect(0,0,r.W,r.H);g.restore();E.px.reset(g);}});
 if(API.onFrame)API.onFrame();
}
function win(){
 const signals=state.collectibles.filter(c=>c.kind==='signal'&&c.collected).length;
 const timeBonus=Math.max(0,Math.round(1500-state.elapsed*2)),cleanBonus=Math.max(0,1000-state.damage*75);state.score+=timeBonus+cleanBonus;
 const skill=state.score+state.counters*100+signals*350-state.deaths*250;
 state.rank=skill>=10500?'S':skill>=7800?'A':skill>=5200?'B':'C';
 state.summary={score:state.score,rank:state.rank,time:state.elapsed,bestCombo:state.bestCombo,counters:state.counters,reflections:state.reflections,signals,deaths:state.deaths,damage:state.damage,difficulty:runDifficulty,upgrade:state.upgrade};
 const bests=E.store.get(BEST,{}),old=bests[runDifficulty];state.newBest=!old||old.score<state.score;if(state.newBest){bests[runDifficulty]=state.summary;E.store.set(BEST,bests);}
 E.store.set(SAVE,null);game.go('win',null,{fade:.4});game.audio.music(music.victory);emit('win',state.summary);
}
function pause(on){if(game.sceneName!=='play'||state?.upgradePending)return;game.paused=on===undefined?!game.paused:on;game.input.clear();if(API.onFrame)API.onFrame();}
function applySettings(next){settings={...settings,...next};if(state)state.settings=settings;game.reduceMotion=settings.reducedMotion;game.audio.setVolume(settings.volume);picture.set(settings);E.store.set(PREFS,settings);emit('settings');}
const API=window.AFGame={game,view,get state(){return state;},get hero(){return hero;},get settings(){return settings;},get scene(){return game.sceneName;},get defaultSettings(){return {...DEFAULTS};},get picture(){return picture;},get events(){return [...events];},get currentDifficulty(){return runDifficulty;},start,retry,title,pause,chooseUpgrade,applySettings,hasSave:()=>!!E.store.get(SAVE,null),onFrame:null,notify,
 diagnostics(){return {scene:game.sceneName,paused:game.paused,engine:E.version,edition:E.edition,errors:game.errors.map(e=>e.message),hero:hero?{x:hero.x,z:hero.z,hp:hero.hp,maxHp:hero.maxHp,airJumps:hero._airJ,dashing:hero.dashing,move:hero.moveType}:null,run:state?{checkpoint:state.checkpoint,score:state.score,tempo:state.tempo,maxTempo:state.maxTempo,power:state.power,combo:state.combo,cleared:state.cleared,rushOpen:state.rushGate.open,coil:state.coil.charge,wallBroken:state.wall.broken,signals:state.collectibles.filter(c=>c.kind==='signal'&&c.collected).length,enemies:state.enemies.filter(e=>!e.dead).map(e=>({id:e.id,kind:e.kind,x:e.x,z:e.z,hp:e.hp,state:e.state,timer:e.timer,exposed:e.exposed})),boss:state.boss?{hp:state.boss.hp,maxHp:state.boss.maxHp,phase:state.boss.phase,state:state.boss.state,action:state.boss.action,exposed:state.boss.exposed,x:state.boss.x}:null,summary:state.summary||null}:null,picture:{backend:picture.backend,status:picture.status,options:picture.options},renderMs:game.stats.renderMs,updateMs:game.stats.updateMs,particles:game.particles.list.length};}
};
const picture=new AfterframePicture(game,status=>{const el=$('gpuStatus');if(el)el.textContent=status;});
picture.set(settings);
const scenes={
 title:{enter(){sceneUI='title';state=null;hero=null;game.paused=false;game.input.clear();view.set(0,0,2.7);if(API.onFrame)API.onFrame();},update(dt){introTime+=dt;if(!document.querySelector('dialog[open]')&&game.input.pressed('start'))start(false);},draw(r){r.sky(['#102d38','#081824']);if(API.onFrame)API.onFrame();}},
 play:{pausable:true,enter(){sceneUI='play';game.cam.snap=true;game.focus(Math.max(218,hero.x+40),0,118);if(state.checkpoint===0){notify('One city. One last signal.','Reach Relay Nine. Stop the Warden. Let the city speak.','EPISODE 01',4.5);say('The tower cut every channel. I only need one.','RIN',5);saveCheckpoint(0,110,true);}else{notify('Back on the air','Your checkpoint is restored.','SIGNAL RESTORED',2.5);}if(state.checkpoint===3&&!state.upgrade){state.upgradePending=true;game.paused=true;}if(API.onFrame)API.onFrame();},update,draw},
 dead:{enter(){sceneUI='dead';hero.deathAge=0;game.paused=false;game.audio.music(null);if(API.onFrame)API.onFrame();},update(dt){state.clock+=dt;hero.deathAge+=dt;hero.rig.update(dt,{x:hero.x,y:0,z:hero.z,pose:'die',facing:hero.facing>0?0:Math.PI});if(game.input.pressed('start')||game.input.pressed('confirm'))retry();},draw},
 win:{enter(){sceneUI='win';game.paused=false;game.input.clear();if(API.onFrame)API.onFrame();},update(){if(game.input.pressed('start'))start(false);},draw}
};
game.start({scene:'title',scenes});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.sceneName==='play'&&!game.paused)pause(true);});
window.addEventListener('blur',()=>{if(game.sceneName==='play'&&!game.paused&&!document.querySelector('dialog[open]'))pause(true);});
})();
