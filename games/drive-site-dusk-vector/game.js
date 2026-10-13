/* DUSK VECTOR — original game code. Built on my-3D2dge Agent Edition v0.8.1. */
(() => {
'use strict';
const E = My3D2dge, W = 640, H = 360, P = E.px;
const $ = id => document.getElementById(id);
const C = {ink:'#101e2b',deep:'#0b1722',cream:'#f6e8ce',muted:'#adc4c9',orange:'#ff8256',mint:'#87dfcc',red:'#ff5061',shot:'#ffe486'};
const TEST = new URLSearchParams(location.search).has('test');
const PILOTS = [
 {name:'RIN VALE',call:'SPARROW',trait:'Needs fewer cannon power-ups',xp:4,ammo:1,recover:3.2},
 {name:'SOL REYES',call:'SUNSET',trait:'Extra special ammunition',xp:6,ammo:1.35,recover:3.2},
 {name:'IVO MARR',call:'ANCHOR',trait:'Recovery time reduced to 2 sec',xp:6,ammo:1,recover:2}
];
const PLANES = [
 {id:'kestrel',name:'VT-7 KESTREL',role:'Balanced interceptor',price:0,hp:100,speed:204,rate:.112,dmg:3.1,armor:1},
 {id:'needle',name:'VS-4 NEEDLE',role:'Fast / focused cannon',price:900,hp:80,speed:248,rate:.091,dmg:3.2,armor:1},
 {id:'manta',name:'HB-9 MANTA',role:'Armored / downward fire',price:1200,hp:125,speed:174,rate:.13,dmg:3.6,armor:.9}
];
const WEAPONS = [
 {id:'seeker',name:'SEEKER RACK',desc:'Guided anti-air missiles',price:900,ammo:12,icon:'≋',short:'SEEKER'},
 {id:'bomb',name:'GROUND LANCE',desc:'Falling armor-breaker',price:700,ammo:10,icon:'↘',short:'LANCE'},
 {id:'pulse',name:'CLEAR PULSE',desc:'Clears bullets / area damage',price:1200,ammo:2,icon:'◎',short:'PULSE'}
];
const MODES = {cadet:{damage:.55,bullet:.8,rate:1.2,score:.8},standard:{damage:1,bullet:1,rate:1,score:1},ace:{damage:1.18,bullet:1.18,rate:.8,score:1.25}};
const input = {...E.Input.SHMUP,fire:[...E.Input.SHMUP.fire,'TouchFire'],cycle:['KeyC','KeyE','Pad2','Pad5'],focus:['ShiftLeft','ShiftRight','Pad4'],mute:['KeyM']};
const game = new E.Game({canvas:'screen',res:[W,H],fit:true,view:'overhead',views:['overhead'],input,bg:C.ink});
game.cam.smooth = 0; game.focus(W/2,H/2); game.pauseOverlay = false;
game.particles.max = 460;
const sprites = DuskArt.createSprites(E);
let settings = {...{sound:false,volume:35,scan:true,reduced:game.reduceMotion,auto:matchMedia('(pointer:coarse)').matches},...E.store.get('dusk-vector-settings',{})};
let best = E.store.get('dusk-vector-best',{});
let chosen = {pilot:0,plane:0,weapons:[true,true,false],difficulty:'standard'};
let run = null, checkpoint = null, retryCount = 0, touch = {x:0,y:0,id:null}, titleTime = 0, lastUiMode = '', settingsOpen = false, resumeAfterSettings = false, lastPaused = false;
const panels = ['titlePanel','hangarPanel','pausePanel','resultPanel','settingsPanel'];
const money = n => Math.round(n).toLocaleString('en-US');
const clamp = E.clamp, lerp = E.lerp;
function showPanel(id) { for(const p of panels) $(p).hidden = p !== id; $('touchControls').hidden = !(id === null && game.sceneName === 'flight' && matchMedia('(pointer:coarse)').matches); }
function announce(msg) { $('announcer').textContent = msg; }
function funds() { return 3200 - PLANES[chosen.plane].price - WEAPONS.reduce((n,w,i)=>n+(chosen.weapons[i]?w.price:0),0); }
function saveSettings() { E.store.set('dusk-vector-settings',settings); }
function applySettings() {
 game.audio.mute(!settings.sound); game.audio.setVolume(settings.volume/100); game.audio.musicVolume = .34; game.audio.sfxVolume = .7; game.audio._levels();
 game.reduceMotion = settings.reduced; document.querySelector('.scanlines').style.display = settings.scan?'':'none';
 $('soundBtn').textContent = settings.sound?'SOUND ON':'SOUND OFF'; $('soundBtn').setAttribute('aria-pressed',String(settings.sound));
 $('motionSetting').checked=settings.reduced; $('scanSetting').checked=settings.scan; $('autoSetting').checked=settings.auto; $('autofire').checked=settings.auto; $('volumeSetting').value=settings.volume;
}
const MUSIC = {
 sortie:{bpm:138,steps:4,tracks:[
  {wave:'pulse',vol:.12,notes:'A4 . E5 . A5 - G5 E5 | D5 . E5 . G5 - E5 . | F5 . E5 . D5 - C5 D5 | E5 - . E5 A4 . C5 E5 | A5 . G5 E5 D5 . E5 . | G5 - E5 . D5 . C5 A4 | F4 . A4 C5 D5 . F5 . | E5 - - . E5 D5 C5 E5'},
  {wave:'triangle',vol:.24,notes:'A2 . A2 E3 A2 . G3 E3 | G2 . G2 D3 G2 . B2 D3 | F2 . F2 C3 F2 . A2 C3 | E2 . E2 B2 E2 . G2 B2'},
  {wave:'drums',vol:.19,notes:'k . h . s . h h | k . h k s . h .'}
 ]},
 boss:{bpm:152,steps:4,tracks:[
  {wave:'saw',vol:.1,notes:'E4 . E4 G4 Bb4 . A4 G4 | E4 . D4 E4 G4 - . . | C5 . Bb4 A4 G4 . E4 . | D4 E4 G4 A4 Bb4 - A4 G4'},
  {wave:'triangle',vol:.25,notes:'E2 . E2 . E3 . E2 E2 | D2 . D2 . D3 . D2 . | C2 . C2 . C3 . C2 C2 | B1 . B1 . B2 . D2 .'},
  {wave:'drums',vol:.22,notes:'k . h k s h k h | k h k . s h h h'}
 ]}
};
function clickSound() {game.audio.sfx('select',{vol:.12});}
function drawPreview(canvas,sprite) {
 canvas.width=120; canvas.height=44; const g=canvas.getContext('2d'); g.imageSmoothingEnabled=false;
 const scale=1.6;g.drawImage(sprite.cv,(120-sprite.w*scale)/2,(44-sprite.h*scale)/2,sprite.w*scale,sprite.h*scale);
}
function renderHangar() {
 const active=document.activeElement;
 const focusKey=active?.dataset?.pilot!==undefined?['pilot',active.dataset.pilot]:active?.dataset?.plane!==undefined?['plane',active.dataset.plane]:active?.dataset?.weapon!==undefined?['weapon',active.dataset.weapon]:null;
 $('budgetValue').textContent=money(funds());
 $('pilotChoices').innerHTML=PILOTS.map((p,i)=>`<button class="choice pilot-choice ${chosen.pilot===i?'selected':''}" data-pilot="${i}" aria-pressed="${chosen.pilot===i}"><canvas id="portrait${i}" width="48" height="48" aria-hidden="true"></canvas><span><strong>${p.name}</strong><small>${p.trait}</small></span></button>`).join('');
 $('aircraftChoices').innerHTML=PLANES.map((p,i)=>`<button class="choice aircraft-choice ${chosen.plane===i?'selected':''}" data-plane="${i}" aria-pressed="${chosen.plane===i}"><canvas id="plane${i}" aria-hidden="true"></canvas><strong>${p.name}</strong><small>${p.role}</small><span class="choice-bottom"><span>${p.hp} HULL</span><b>${p.price?'$'+money(p.price):'INCLUDED'}</b></span></button>`).join('');
 $('weaponChoices').innerHTML=WEAPONS.map((w,i)=>`<button class="choice weapon-choice ${chosen.weapons[i]?'selected':''}" data-weapon="${i}" aria-pressed="${chosen.weapons[i]}"><span class="weapon-icon" aria-hidden="true">${w.icon}</span><strong>${w.name}</strong><small>${w.desc}</small><span class="choice-bottom"><span>×${Math.ceil(w.ammo*PILOTS[chosen.pilot].ammo)}</span><b>$${money(w.price)}</b></span></button>`).join('');
 PILOTS.forEach((p,i)=>DuskArt.drawPortrait($('portrait'+i).getContext('2d'),0,0,48,i));
 PLANES.forEach((p,i)=>drawPreview($('plane'+i),sprites[p.id]));
 document.querySelectorAll('[data-pilot]').forEach(b=>b.addEventListener('click',()=>selectPilot(Number(b.dataset.pilot))));
 document.querySelectorAll('[data-plane]').forEach(b=>b.addEventListener('click',()=>selectPlane(Number(b.dataset.plane))));
 document.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>toggleWeapon(Number(b.dataset.weapon))));
 $('difficulty').value=chosen.difficulty;
 if(focusKey)document.querySelector(`[data-${focusKey[0]}="${focusKey[1]}"]`)?.focus({preventScroll:true});
}
function selectPilot(i) {if(!PILOTS[i])return false;chosen.pilot=i;clickSound();renderHangar();return true;}
function selectPlane(i) {if(!PLANES[i])return false; const available=funds()+PLANES[chosen.plane].price; if(available<PLANES[i].price){$('shopNotice').textContent='Insufficient funds. Remove a special weapon to lease this aircraft.';game.audio.sfx('cancel');return false;}chosen.plane=i;$('shopNotice').textContent=PLANES[i].role+'. Main cannon and full hull included.';clickSound();renderHangar();return true;}
function toggleWeapon(i) {if(!WEAPONS[i])return false;if(!chosen.weapons[i]&&funds()<WEAPONS[i].price){$('shopNotice').textContent='Insufficient funds. Remove another item or use the Kestrel.';game.audio.sfx('cancel');return false;}chosen.weapons[i]=!chosen.weapons[i];$('shopNotice').textContent=WEAPONS[i].name+(chosen.weapons[i]?' loaded.':' removed. Funds returned.');clickSound();renderHangar();return true;}
function goHangar() {settingsOpen=false;game.audio.music(null);game.go('hangar',null,{fade:.14});}
function goTitle() {settingsOpen=false;game.audio.music(null);game.go('title',null,{fade:.14});}
function launch(fromCheckpoint=false) {
 if(!fromCheckpoint){checkpoint=null;retryCount=0;}
 settingsOpen=false; game.input.clear(); touch.x=touch.y=0;
 game.go('flight',{fromCheckpoint},{fade:.18}); $('screen').focus({preventScroll:true});
}
function checkpointSave(time,label) {
 if(!run||run.outcome)return;
 checkpoint={time,label,xp:run.xp,power:run.power,ammo:[...run.ammo],score:run.score,kills:run.kills,spawned:run.spawned,credits:run.credits,shots:run.shots,hits:run.hits,damageTaken:run.damageTaken,groupId:run.groupId,bestCombo:run.bestCombo};
 run.checkpointLabel=label; toast('CHECKPOINT / '+label,3,C.mint);announce('Checkpoint reached: '+label);
}
function makeRun(fromCheckpoint) {
 const p=PLANES[chosen.plane],cp=fromCheckpoint?checkpoint:null;
 const r={t:cp?cp.time:0,stage:cp?(cp.time>=150?3:1):0,scroll:cp?cp.time*43:0,score:cp?cp.score:0,kills:cp?cp.kills:0,spawned:cp?cp.spawned:0,credits:cp?cp.credits:0,shots:cp?cp.shots:0,hits:cp?cp.hits:0,damageTaken:cp?cp.damageTaken:0,
  plane:p,pilot:PILOTS[chosen.pilot],difficulty:MODES[chosen.difficulty],hp:p.hp,maxHp:p.hp,xp:cp?cp.xp:0,power:cp?cp.power:1,
  ammo:cp?cp.ammo.map((n,i)=>chosen.weapons[i]?Math.max(n,Math.ceil(WEAPONS[i].ammo*.4)):0):WEAPONS.map((w,i)=>chosen.weapons[i]?Math.ceil(w.ammo*PILOTS[chosen.pilot].ammo):0),
  player:{x:92,y:177,r:6,vx:0,vy:0,bank:0},invuln:2.4,recovery:0,shotTimer:0,specialTimer:0,smokeTimer:0,
  enemies:[],pickups:[],warnings:[],groups:{},groupId:cp?cp.groupId:0,bullets:new E.Bullets(game,{max:440,sparks:false}),specials:[],rings:[],events:[],eventIndex:0,
  radio:null,toast:null,boss:null,outcome:null,endTimer:0,selected:chosen.weapons.findIndex(Boolean),combo:0,comboTime:0,bestCombo:cp?cp.bestCombo:0,checkpointLabel:cp?cp.label:'COASTAL APPROACH',rng:E.rng(1989),beams:[],stageBanner:4,checkpointRetry:!!cp};
 r.events=buildTimeline();while(r.eventIndex<r.events.length&&r.events[r.eventIndex].at<r.t-.001)r.eventIndex++;
 if(r.selected<0)r.selected=0;return r;
}
function buildTimeline() {
 const events=[];const at=(t,fn)=>events.push({at:t,fn});
 at(1,()=>radio('CONTROL','The carrier is blocking the sea lane. Clear a path.',0,5));
 at(3,()=>formation('fighter',5,100,0));
 at(9,()=>formation('fighter',5,232,1));
 at(15,()=>formation('dart',6,140,2));
 at(22,()=>{formation('fighter',4,85,0);spawnEnemy('turret',{x:W+20,y:305});});
 at(28,()=>{formation('drone',3,178,1);supply(520,120,'power');});
 at(34,()=>formation('dart',6,223,3));
 at(40,()=>{spawnEnemy('turret',{x:W+20,y:302});formation('fighter',4,130,1);});
 at(46,()=>{supply(W+15,160,'repair');supply(W+72,220,'ammo');});
 at(50,()=>{run.stage=1;run.stageBanner=3.5;checkpointSave(50,'REFINERY');radio('CONTROL','Refinery batteries ahead. Fly above them to use the Ground Lance.',0,6);});
 at(52,()=>{spawnEnemy('turret',{x:W+20,y:306});spawnEnemy('turret',{x:W+155,y:306});formation('fighter',5,100,0);});
 at(59,()=>{formation('dart',5,160,2);spawnEnemy('drone',{x:W+80,y:244});});
 at(66,()=>{spawnEnemy('turret',{x:W+15,y:305});formation('fighter',5,196,1);});
 at(73,()=>{toast('HEAVY ESCORT INBOUND',3,C.orange);warning(160,'HEAVY ESCORT',2.5);});
 at(76,()=>{spawnEnemy('gunship',{x:W+75,y:155});radio('RIN','Heavy escort. Watch for the spread from its nose.',0,4);});
 at(84,()=>formation('dart',4,85,0));
 at(92,()=>{spawnEnemy('turret',{x:W+30,y:305});formation('fighter',4,240,1);});
 at(102,()=>{formation('drone',4,110,2);supply(W+10,210,'power');});
 at(112,()=>{run.stage=2;run.stageBanner=3.2;radio('CONTROL','You are through the refinery. Carrier detected ahead.',0,5);});
 at(115,()=>{formation('fighter',5,98,0);spawnEnemy('turret',{x:W+30,y:305});});
 at(122,()=>{formation('dart',6,220,1);spawnEnemy('drone',{x:W+30,y:150});});
 at(130,()=>{formation('fighter',5,142,2);spawnEnemy('turret',{x:W+70,y:305});});
 at(138,()=>formation('dart',5,198,3));
 at(144,()=>{supply(590,115,'repair');supply(625,182,'ammo');supply(665,244,'power');radio('CONTROL','Supply drop. Take what you need. This is the final approach.',0,5);});
 at(150,()=>{run.stage=3;run.bullets.clear('enemy');run.enemies=[];checkpointSave(150,'CARRIER');toast('WARNING / BLOCKADE CARRIER',4,C.red);game.audio.sfx('charge',{pitch:.6,vol:.3});});
 at(154,()=>spawnBoss());
 return events.sort((a,b)=>a.at-b.at);
}
function formation(type,n,y,pattern=0) {
 const id=++run.groupId;run.groups[id]={left:n,total:n,kills:0};
 for(let i=0;i<n;i++)spawnEnemy(type,{x:W+30+i*43,y:y+Math.sin(i*.8)*22,baseY:y,offset:i*.72,pattern,group:id,marked:i===n-1});
}
function spawnEnemy(type,o={}) {
 const spec={fighter:{hp:8,r:14,speed:105,score:140},dart:{hp:5,r:10,speed:142,score:110},drone:{hp:14,r:11,speed:68,score:210},turret:{hp:27,r:17,speed:43,score:280},gunship:{hp:235,r:31,speed:55,score:1800}}[type];
 const e={type,...spec,x:W+40,y:160,baseY:o.y||160,t:0,fire:1.9+(run.rng()*.9),flash:0,dead:false,pattern:0,offset:0,marked:false,...o};e.maxHp=e.hp;
 run.enemies.push(e);run.spawned++;return e;
}
function supply(x,y,type) {run.pickups.push({x,y,baseY:y,type,t:0,r:14,dead:false});}
function warning(y,label,duration=1.2) {run.warnings.push({y,label,t:duration,total:duration});}
function toast(text,time=2,color=C.cream) {if(run)run.toast={text,t:time,max:time,color};}
function radio(name,text,pilot=0,time=5) {run.radio={name,text,pilot,t:time,max:time};announce(name+': '+text);}
function explosion(x,y,size=1,major=false) {
 game.particles.explosion(x,y,0,size,{freeze:major,flash:major&&!settings.reduced,shake:major?3:.45,sound:false});
 game.audio.sfx(major?'boom':'explode',{vol:major?.28:.1,pitch:major?.7:1.2});
}
function awardKill(e) {
 if(e.dead)return;e.dead=true;run.kills++;run.combo++;run.comboTime=3.4;run.bestCombo=Math.max(run.bestCombo,run.combo);
 const reward=Math.round(e.score*(1+Math.min(run.combo,20)*.025)*run.difficulty.score);run.score+=reward;run.credits+=Math.round(e.score*.3);
 explosion(e.x,e.y,e.type==='gunship'?2.2:e.type==='turret'?1.1:.7,e.type==='gunship');
 if(e.type==='gunship'){supply(e.x-5,e.y-28,'repair');supply(e.x+18,e.y+30,'power');toast('HEAVY ESCORT DOWN +1800',3,C.mint);}
 else if(e.marked)supply(e.x,e.y,'power');
 if(e.group){const group=run.groups[e.group];if(group){group.kills++;group.left--;if(group.kills===group.total){run.score+=350;supply(e.x+20,e.y,'power');toast('FORMATION CLEAR +350',1.8,C.mint);}}}
}
function damageEnemy(e,amount,shot) {
 if(e.dead)return;
 if(e.bossPart){damageBossPart(e,amount);return;}
 e.hp-=amount;e.flash=.07;if(shot){run.hits++;game.particles.sparks(shot.x,shot.y,0,2,Math.PI,{color:C.cream});}
 if(e.hp<=0)awardKill(e);
}
function damagePlayer(amount,collision=false) {
 if(!run||run.outcome||run.invuln>0)return false;
 const multiplier=run.recovery>0?2:1;const damage=amount*run.difficulty.damage*run.plane.armor*multiplier;
 run.hp=Math.max(0,run.hp-damage);run.damageTaken+=damage;run.invuln=1.15;run.recovery=run.pilot.recover;run.combo=0;run.comboTime=0;
 game.shake(3);if(!settings.reduced)game.flash(C.red,.1,.35);game.freeze(.045);game.audio.sfx('hurt',{vol:.24,pitch:.8});
 game.particles.sparks(run.player.x,run.player.y,0,12,Math.PI,{color:C.orange});
 toast(multiplier>1?'CRITICAL HIT / FIND CLEAR SPACE':'DAMAGE / STABILIZE',2,C.orange);
 if(run.hp<=0)endMission(false);return true;
}
function cycleWeapon() {
 if(!run)return;const owned=WEAPONS.map((w,i)=>chosen.weapons[i]?i:-1).filter(i=>i>=0);
 if(!owned.length){toast('NO SPECIAL WEAPON LOADED',1.8);return;}
 run.selected=owned[(owned.indexOf(run.selected)+1)%owned.length];clickSound();toast(WEAPONS[run.selected].name,1.2,C.mint);
}
function fireMain(dt) {
 run.shotTimer-=dt;const p=run.player,focus=game.input.down('focus');
 if(!(settings.auto||game.input.down('fire'))||run.shotTimer>0)return;
 run.shotTimer=run.plane.rate;
 const count=run.power>=3?3:run.power>=2?2:1;const spread=chosen.plane===1?9:15;
 for(let i=0;i<count;i++){
  const offset=(i-(count-1)/2)*5;const angle=(i-(count-1)/2)*(focus?.012:chosen.plane===1?.019:.03);
  run.bullets.fire({x:p.x+25,y:p.y+offset,vx:550,vy:angle*550,r:2.2,dmg:run.plane.dmg*(run.power===4?1.25:1),color:C.mint,core:'#efffd8',life:1.25,team:'player'});run.shots++;
 }
 if(chosen.plane===2){run.bullets.fire({x:p.x+10,y:p.y+9,vx:270,vy:215,r:2,dmg:3.8,life:1.2,color:C.mint,team:'player'});run.shots++;}
 if(run.power===4&&chosen.plane!==2){run.bullets.fire({x:p.x+20,y:p.y,vx:500,vy:50,r:1.5,dmg:2.2,life:1.2,color:C.mint,team:'player'});run.shots++;}
 if(Math.floor(run.t*10)%2===0)game.audio.sfx('shoot',{pitch:1.45,vol:.035});
}
function useSpecial() {
 if(!run||run.outcome||run.specialTimer>0)return false;
 const i=run.selected;if(!chosen.weapons[i]||run.ammo[i]<=0){toast('NO AMMUNITION / PRESS C TO SWITCH',1.7,C.orange);game.audio.sfx('cancel',{vol:.1});run.specialTimer=.3;return false;}
 run.ammo[i]--;run.specialTimer=i===2?1:.35;const p=run.player;
 if(i===0){
  for(let n=0;n<3;n++)run.specials.push({type:'seeker',x:p.x+10,y:p.y+(n-1)*9,vx:175,vy:(n-1)*70,t:0,life:4,turn:4.2,r:4,damage:18,dead:false,target:null});
  game.audio.sfx('laser',{pitch:.65,vol:.2});
 } else if(i===1){
  run.specials.push({type:'bomb',x:p.x+8,y:p.y+12,vx:145,vy:70,t:0,life:4,r:5,damage:80,dead:false});game.audio.sfx('whoosh',{pitch:.65,vol:.16});
 } else {
  run.bullets.clear('enemy');run.beams=[];run.invuln=Math.max(run.invuln,1.2);run.recovery=Math.max(0,run.recovery-.8);
  for(const e of [...targets()])if(e.x>0&&e.x<W+25)damageEnemy(e,e.bossPart?50:100);
  run.rings.push({x:p.x,y:p.y,t:0,max:.7,r:W,color:C.mint});game.shake(4);game.freeze(.055);game.audio.sfx('boom',{pitch:1.3,vol:.25});toast('CLEAR PULSE',1,C.mint);
 }
 return true;
}
function targets() {return [...run.enemies.filter(e=>!e.dead),...(run.boss?run.boss.parts.filter(p=>!p.dead&&!p.locked):[])];}
function updateSpecials(dt) {
 for(const s of run.specials){
  s.t+=dt;if(s.t>s.life||s.x>W+100||s.x<-70){s.dead=true;continue;}
  if(s.type==='seeker'){
   if(!s.target||s.target.dead||s.target.locked){s.target=targets().filter(e=>e.x>s.x-100&&e.x<W+70).sort((a,b)=>(Math.hypot(a.x-s.x,a.y-s.y)+(a.type==='turret'?90:0))-(Math.hypot(b.x-s.x,b.y-s.y)+(b.type==='turret'?90:0)))[0]||null;}
   if(s.target){const a=Math.atan2(s.target.y-s.y,s.target.x-s.x);s.vx=lerp(s.vx,Math.cos(a)*285,Math.min(1,dt*5));s.vy=lerp(s.vy,Math.sin(a)*285,Math.min(1,dt*5));}else{s.vx=E.approach(s.vx,300,250*dt);s.vy*=Math.exp(-dt*2);}
  }else s.vy+=230*dt;
  s.x+=s.vx*dt;s.y+=s.vy*dt;
  if(Math.floor(s.t*25)!==Math.floor((s.t-dt)*25))game.particles.add({kind:'smoke',x:s.x-4,y:s.y,z:0,vx:-35,size:2,max:.3,color:'#cbd0b8',dark:'#52677a'});
  for(const e of targets()){if(Math.hypot(s.x-e.x,s.y-e.y)<e.r+s.r){if(s.type==='bomb')detonateBomb(s);else{damageEnemy(e,s.damage);explosion(s.x,s.y,.5);s.dead=true;}break;}}
  if(!s.dead&&s.y>=310){if(s.type==='bomb')detonateBomb(s);else s.dead=true;}
 }
 E.prune(run.specials,s=>s.dead);
}
function detonateBomb(s) {
 s.dead=true;explosion(s.x,Math.min(s.y,310),1.55);run.rings.push({x:s.x,y:Math.min(s.y,310),t:0,max:.45,r:62,color:C.orange});
 for(const e of targets())if(Math.hypot(e.x-s.x,e.y-s.y)<e.r+62)damageEnemy(e,s.damage);
 for(const b of run.bullets.list)if(b.team==='enemy'&&Math.hypot(b.x-s.x,b.y-s.y)<70)b.dead=true;
}
function enemyFire(e,kind='aim') {
 if(e.x<45||e.x>W-18||e.y<45||e.y>320)return;
 const p=run.player;let angle=Math.atan2(p.y-e.y,p.x-e.x),speed=(kind==='fan'?102:124)*run.difficulty.bullet;
 if(e.type==='turret'&&p.x>e.x-16)return;
 if(kind==='fan')run.bullets.burst({x:e.x-e.r,y:e.y,r:3.5,dmg:13,life:7,team:'enemy',color:C.shot,core:'#fff9ce'},E.pattern.spread(angle,5,.9,speed));
 else if(e.type==='drone')run.bullets.burst({x:e.x-10,y:e.y,r:3.3,dmg:12,life:7,team:'enemy',color:C.shot},E.pattern.spread(angle,3,.32,speed));
 else run.bullets.fire({x:e.x-e.r*.5,y:e.y-2,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:3.4,dmg:e.type==='turret'?16:13,life:7,team:'enemy',color:C.shot,core:'#fff8cf'});
 e.muzzle=.12;
}
function updateEnemies(dt) {
 for(const e of run.enemies){
  if(e.dead)continue;e.t+=dt;e.flash=Math.max(0,e.flash-dt);e.muzzle=Math.max(0,(e.muzzle||0)-dt);
  if(e.type==='gunship'){
   e.x=E.approach(e.x,e.t<25?460:-100,e.speed*dt);e.y=e.baseY+Math.sin(e.t*.7)*58;
  }else{e.x-=e.speed*dt;if(e.type!=='turret')e.y=e.baseY+Math.sin(e.t*(e.type==='dart'?2.3:1.6)+e.offset)*(e.type==='drone'?58:e.type==='dart'?44:22);}
  e.fire-=dt;
  if(e.fire<=0){enemyFire(e,e.type==='gunship'?'fan':'aim');e.fire=(e.type==='gunship'?1.25:e.type==='turret'?2.1:2.8)*run.difficulty.rate;}
  if(e.x<-75||e.t>38){e.dead=true;if(e.group&&run.groups[e.group])run.groups[e.group].left--;}
  if(!run.outcome&&Math.hypot(e.x-run.player.x,e.y-run.player.y)<e.r+run.player.r-2)damagePlayer(27,true);
 }
 E.prune(run.enemies,e=>e.dead);
}
function updatePickups(dt) {
 for(const q of run.pickups){q.t+=dt;q.x-=32*dt;q.y=q.baseY+Math.sin(q.t*2.5)*7;
  const d=Math.hypot(q.x-run.player.x,q.y-run.player.y);
  if(d<45){q.x=lerp(q.x,run.player.x,dt*5);q.baseY=lerp(q.baseY,run.player.y,dt*5);}
  if(d<23){q.dead=true;game.audio.sfx('pickup',{vol:.15,pitch:1.15});
   if(q.type==='power'){run.xp+=2;while(run.power<4&&run.xp>=run.pilot.xp){run.xp-=run.pilot.xp;run.power++;toast('CANNON LEVEL '+run.power,2.5,C.mint);game.audio.sfx('powerup',{vol:.16});}if(run.power===4){run.xp=0;run.score+=250;}}
   if(q.type==='repair'){run.hp=Math.min(run.maxHp,run.hp+30);run.recovery=0;toast('HULL REPAIR +30',2,C.mint);}
   if(q.type==='ammo'){WEAPONS.forEach((w,i)=>{if(chosen.weapons[i])run.ammo[i]=Math.min(Math.ceil(w.ammo*run.pilot.ammo),run.ammo[i]+Math.max(1,Math.ceil(w.ammo*.3)));});toast('SPECIAL AMMUNITION REPLENISHED',2,C.mint);}
  }
  if(q.x<-35)q.dead=true;
 }E.prune(run.pickups,q=>q.dead);
}
function spawnBoss() {
 if(run.boss)return;
 run.boss={x:W+125,y:180,t:0,phase:1,fire:2.5,beamTimer:5.2,charge:0,beamY:0,entry:true,dead:false,parts:[
  {id:'upper',name:'UPPER BATTERY',dx:-60,dy:-26,x:0,y:0,r:18,hp:420,maxHp:420,bossPart:true,dead:false,locked:false,flash:0},
  {id:'lower',name:'LOWER BATTERY',dx:-60,dy:26,x:0,y:0,r:18,hp:420,maxHp:420,bossPart:true,dead:false,locked:false,flash:0},
  {id:'core',name:'REACTOR',dx:-12,dy:0,x:0,y:0,r:21,hp:1600,maxHp:1600,bossPart:true,dead:false,locked:true,flash:0}
 ]};
 game.audio.music(MUSIC.boss);radio('CONTROL','Break both forward batteries. Their destruction will expose the reactor.',0,6);
}
function damageBossPart(part,amount) {
 if(part.dead||part.locked||!run.boss||run.boss.dead)return;
 part.hp-=amount;part.flash=.09;
 if(part.hp<=0){part.hp=0;part.dead=true;explosion(part.x,part.y,1.9,true);run.score+=part.id==='core'?6000:1500;
  if(part.id==='core'){run.boss.dead=true;run.boss.phase=3;run.bullets.clear('enemy');run.beams=[];endMission(true);}
  else{toast(part.name+' DESTROYED',2,C.mint);if(run.boss.parts.filter(p=>p.id!=='core').every(p=>p.dead)){
   const core=run.boss.parts[2];core.locked=false;run.boss.phase=2;run.boss.fire=1.4;run.boss.beamTimer=.8;run.boss.charge=0;run.beams=[];run.bullets.clear('enemy');run.invuln=Math.max(run.invuln,1);run.hp=Math.min(run.maxHp,run.hp+15);toast('REACTOR EXPOSED',3,C.orange);radio('CONTROL','The reactor is open. Watch the beam warning and finish it.',0,4);
  }}
 }
}
function updateBoss(dt) {
 const b=run.boss;if(!b)return;b.t+=dt;
 if(b.dead){b.y+=dt*6;if(Math.floor(b.t*9)!==Math.floor((b.t-dt)*9))explosion(b.x+(run.rng()-.5)*170,b.y+(run.rng()-.5)*90,.9);return;}
 b.x=E.approach(b.x,505,65*dt);b.entry=b.x>520;b.y=181+Math.sin(b.t*.54)*48;
 for(const p of b.parts){p.x=b.x+p.dx;p.y=b.y+p.dy;p.flash=Math.max(0,p.flash-dt);}
 if(b.entry)return;
 b.fire-=dt;b.beamTimer-=dt;
 if(b.fire<=0){
  if(b.phase===1){for(const part of b.parts.filter(p=>!p.dead&&p.id!=='core')){const a=Math.atan2(run.player.y-part.y,run.player.x-part.x);run.bullets.burst({x:part.x-17,y:part.y,r:3.5,dmg:14,life:7,team:'enemy',color:C.shot},E.pattern.spread(a,3,.29,123*run.difficulty.bullet));}b.fire=1.7*run.difficulty.rate;}
  else {const core=b.parts[2];run.bullets.burst({x:core.x-20,y:core.y,r:3.5,dmg:15,life:7,team:'enemy',color:C.shot},E.pattern.spread(Math.PI,7,1.35,116*run.difficulty.bullet));b.fire=1.45*run.difficulty.rate;}
 }
 if(b.beamTimer<=0&&b.charge<=0){b.charge=1.4;b.beamY=run.player.y;b.beamTimer=b.phase===1?6.6:4.8;game.audio.sfx('charge',{pitch:.6,vol:.12});}
 if(b.charge>0){b.charge-=dt;if(b.charge<=0){run.beams.push({x:b.x-82,y:b.beamY,t:0,max:.55,width:12});game.audio.sfx('laser',{pitch:.4,vol:.25});}}
 for(const beam of run.beams){beam.t+=dt;if(beam.t<beam.max&&run.player.x<beam.x&&Math.abs(run.player.y-beam.y)<beam.width/2+run.player.r)damagePlayer(25);}
 E.prune(run.beams,x=>x.t>x.max);
 if(run.player.x>b.x-84&&run.player.x<b.x+85&&Math.abs(run.player.y-b.y)<43)damagePlayer(30,true);
}
function endMission(win) {
 if(run.outcome)return;run.outcome=win?'victory':'defeat';run.endTimer=win?4.5:1.8;run.bullets.clear('enemy');
 if(win){run.score+=Math.round(run.hp*18)+run.ammo.reduce((a,b)=>a+b,0)*45;toast('BLOCKADE BROKEN',5,C.mint);game.audio.music(null);game.audio.sfx('powerup',{vol:.3,pitch:.8});}
 else {explosion(run.player.x,run.player.y,2.4,true);game.audio.music(null);announce('Aircraft lost. Retry from your checkpoint.');}
}
function showResult() {
 const win=run.outcome==='victory',rank=win?(retryCount?'C':run.damageTaken<25&&run.kills>=70?'S':run.damageTaken<75&&run.kills>=50?'A':run.damageTaken<160?'B':'C'):'—';
 if(win){const key=chosen.difficulty;if(!best[key]||run.score>best[key].score){best[key]={score:run.score,rank};E.store.set('dusk-vector-best',best);}}
 $('resultEyebrow').textContent=win?'OPERATION COMPLETE':'AIRCRAFT LOST';$('resultTitle').textContent=win?'Sea lane open.':'Flight ended.';$('resultRank').textContent=rank;
 $('resultText').textContent=win?'The blockade carrier is down. Civilian ships can pass the Glass Coast. Return to base.':checkpoint?'The recovery team has your position. Resume from '+checkpoint.label.toLowerCase()+' with a repaired aircraft.':'The recovery team has your position. Your loadout is ready for another attempt.';
 const duration=Math.floor(run.t/60)+':'+String(Math.floor(run.t%60)).padStart(2,'0');
 $('resultStats').innerHTML=`<div><span>MISSION SCORE</span><strong>${money(run.score)}</strong></div><div><span>TARGETS DESTROYED</span><strong>${run.kills} / ${run.spawned}</strong></div><div><span>FLIGHT TIME</span><strong>${duration}</strong></div><div><span>HULL REMAINING</span><strong>${Math.round(run.hp/run.maxHp*100)}%</strong></div><div><span>BEST COMBO</span><strong>${run.bestCombo}</strong></div><div><span>MODE / RETRIES</span><strong style="font-size:16px">${chosen.difficulty.toUpperCase()} / ${retryCount}</strong></div>`;
 $('continueBtn').textContent=win?'FLY AGAIN':checkpoint?'RETRY CHECKPOINT':'RETRY MISSION';
 $('resultHint').textContent=win?`Best ${chosen.difficulty} score: ${money(best[chosen.difficulty].score)}. Saved on this device.${retryCount?' Checkpoint retries limit the grade to C.':''}`:'Tip: after a hit, avoid new fire until STABILIZING ends. A Clear Pulse creates space.';
 showPanel('resultPanel');$('continueBtn').focus({preventScroll:true});announce(win?'Mission complete. Rank '+rank+'.':'Mission failed. Retry is available.');
}
function updateFlight(dt) {
 if(settingsOpen)return;
 if(run.outcome){run.endTimer-=dt;run.scroll+=dt*25;updateBoss(dt);if(run.outcome==='victory')run.player.x+=dt*72;if(run.endTimer<=0){game.go('result',null,{fade:.18});}return;}
 run.t+=dt;run.scroll+=dt*43;run.invuln=Math.max(0,run.invuln-dt);run.specialTimer=Math.max(0,run.specialTimer-dt);run.stageBanner=Math.max(0,run.stageBanner-dt);
 if(run.recovery>0){run.recovery=Math.max(0,run.recovery-dt);if(run.recovery===0){toast('AIRCRAFT STABLE',1.4,C.mint);game.audio.sfx('heal',{vol:.09});}}
 if(run.radio){run.radio.t-=dt;if(run.radio.t<=0)run.radio=null;}
 if(run.toast){run.toast.t-=dt;if(run.toast.t<=0)run.toast=null;}
 run.comboTime-=dt;if(run.comboTime<=0)run.combo=0;
 const move=game.input.move(),dx=touch.id!==null?touch.x:move[0],dy=touch.id!==null?touch.y:move[1];
 const speed=run.plane.speed*(game.input.down('focus')?.47:1),p=run.player;
 p.vx=dx*speed;p.vy=dy*speed;p.x=clamp(p.x+p.vx*dt,32,W-40);p.y=clamp(p.y+p.vy*dt,58,300);p.bank=lerp(p.bank,dy,Math.min(1,dt*10));
 while(run.eventIndex<run.events.length&&run.events[run.eventIndex].at<=run.t){run.events[run.eventIndex++].fn();}
 fireMain(dt);
 if(game.input.buffered('bomb',.2)){game.input.consume('bomb');useSpecial();}
 if(game.input.buffered('cycle',.2)){game.input.consume('cycle');cycleWeapon();}
 updateEnemies(dt);updateBoss(dt);updateSpecials(dt);updatePickups(dt);
 run.bullets.update(dt);run.bullets.hit(targets(),(b,e)=>damageEnemy(e,b.dmg,b),'player');
 run.bullets.hit([p],b=>damagePlayer(b.dmg),'enemy');
 E.prune(run.bullets.list,b=>b.x<-40||b.x>W+90||b.y<30||b.y>H+10);
 for(const q of run.warnings)q.t-=dt;E.prune(run.warnings,q=>q.t<=0);
 for(const q of run.rings)q.t+=dt;E.prune(run.rings,q=>q.t>=q.max);
 run.smokeTimer-=dt;if(run.hp<run.maxHp*.4&&run.smokeTimer<=0){run.smokeTimer=.09;game.particles.smoke(p.x-23,p.y+4,0,1,{vx:-50,size:3,max:.7});}
}
// Original scene art. Layers use the engine's pixel primitives and cached sprites.
const bgSeed=E.rng(4112);
const clouds=Array.from({length:15},()=>({x:bgSeed()*900,y:35+bgSeed()*120,w:35+bgSeed()*95,h:5+bgSeed()*12,depth:.15+bgSeed()*.2}));
const hills=Array.from({length:32},(_,i)=>({x:i*65,h:22+bgSeed()*67,w:70+bgSeed()*80}));
const facilities=Array.from({length:30},(_,i)=>({x:i*104,h:30+bgSeed()*95,w:37+bgSeed()*40,kind:i%4}));
function text(g,str,x,y,color=C.cream,opts={}) {E.font.text(g,str,x,y,color,{outline:false,...opts});}
function background(r,scroll=0,stage=0) {
 const g=r.g; // renderer context is exposed as g in this edition
 const ctx=g||game.screen.ctx;
 const bands=['#23354e','#39415b','#4c4966','#645272','#875e77','#b0717e','#d28a86','#e2a18a','#ebba93'];
 bands.forEach((color,i)=>P.rect(ctx,0,i*25,W,26,color));
 // Flat stepped sun, lightly cut by cloud bands.
 P.disc(ctx,478,113,47,'#f2c496');P.rect(ctx,430,113,96,4,'#d98e85');P.rect(ctx,429,125,99,3,'#d98e85');P.rect(ctx,435,139,87,4,'#d98e85');
 for(const c of clouds){const x=((c.x-scroll*c.depth)%(W+180)+(W+180))%(W+180)-90;P.rect(ctx,x,c.y,c.w,c.h,'#a67984');P.rect(ctx,x+12,c.y-3,c.w*.5,4,'#bd8b8c');P.rect(ctx,x-14,c.y+4,c.w+26,3,'#a67984');}
 for(const h of hills){const x=((h.x-scroll*.14)%(W+180)+(W+180))%(W+180)-100;P.poly(ctx,[[x,225],[x+h.w*.38,211-h.h],[x+h.w*.7,225-h.h*.45],[x+h.w,225]],'#655874');P.poly(ctx,[[x+h.w*.38,211-h.h],[x+h.w*.43,223],[x+h.w,225]],'#574e6c');}
 P.rect(ctx,0,224,W,136,'#52717d');P.rect(ctx,0,225,W,8,'#ba9290');P.rect(ctx,0,235,W,12,'#6e8590');P.rect(ctx,0,270,W,90,'#385967');
 for(let i=0;i<65;i++){const y=232+(i*31%126),x=((i*91-scroll*(.28+(y-230)/120))%(W+110)+(W+110))%(W+110)-55;const col=i%3===0?'#bb9b8f':i%3===1?'#63818a':'#4b6f7b';P.rect(ctx,x,y,8+(i*19%52),i%4===0?2:1,col);}
 for(let i=0;i<16;i++){const y=230+i*7,x=478-Math.sin(i*9.7)*32-i*1.5;P.rect(ctx,x-scroll*.04%24,y,18+i*2,2,i<8?'#d1a58b':'#a18c83');}
 const coast=stage===0?clamp((scroll/43-22)/28,0,1):1;
 if(coast>0){
  for(const f of facilities){const x=((f.x-scroll*.44)%(W+210)+(W+210))%(W+210)-105;if(x>W||x+f.w<0)continue;
   const base=300,top=base-f.h*coast;P.rect(ctx,x,top,f.w,f.h*coast,'#324351');P.rect(ctx,x+3,top+4,f.w-6,4,'#746875');
   if(f.kind===0){P.rect(ctx,x+7,top-26*coast,9,27*coast,'#34414f');P.rect(ctx,x+7,top-27*coast,9,3,'#ba837c');P.line(ctx,x+f.w-9,top-15,x+f.w-9,top,'#5f626c',2);}
   if(f.kind===1){P.ell(ctx,x+f.w/2,top,f.w/2,7,'#65616b');P.rect(ctx,x+3,top,f.w-6,f.h*coast,'#49505e');P.rect(ctx,x+7,top+5,4,f.h*coast-5,'#647079');}
   for(let a=0;a<Math.floor(f.w/9);a++)for(let b=0;b<2;b++)P.rect(ctx,x+5+a*9,top+13+b*15,3,4,(a+b+f.kind)%3===0?'#d8a178':'#77817c');
   P.line(ctx,x,base-8,x+f.w,base-8,'#778182',1);
  }
  // Silhouetted cranes and a slow foreground breakwater.
  for(let i=0;i<4;i++){const x=((i*244-scroll*.62)%(W+250)+(W+250))%(W+250)-120;P.rect(ctx,x,225,6,88,'#223a49');P.line(ctx,x+3,226,x+55,251,'#203849',3);P.line(ctx,x-25,250,x+55,250,'#223a49',4);P.line(ctx,x+49,251,x+49,282,'#223a49');P.line(ctx,x+3,251,x+3,291,'#5a626a');}
  P.rect(ctx,0,317,W,43,'#19323e');P.rect(ctx,0,317,W,4,'#7f847e');P.rect(ctx,0,324,W,5,'#3c535c');
  for(let i=0;i<20;i++){const x=((i*43-scroll)%(W+43)+(W+43))%(W+43);P.rect(ctx,x,323,28,2,'#8a8877');P.rect(ctx,x+4,339,17,7,'#304956');}
 }else {P.rect(ctx,0,334,W,26,'#244753');}
}
function spriteDraw(g,sprite,x,y,scale=1,flip=false,flash=false) {
 const cv=flip?sprite.fl:sprite.cv;g.save();g.imageSmoothingEnabled=false;if(flash)g.globalAlpha=.65;
 g.drawImage(cv,Math.round(x-sprite.w*scale/2),Math.round(y-sprite.h*scale/2),Math.round(sprite.w*scale),Math.round(sprite.h*scale));g.restore();g._c=null;
}
function drawAircraft(g,id,x,y,t,bank=0,scale=1,enemy=false,flash=false) {
 const s=sprites[id],flicker=Math.floor(t*24)%3,tail=enemy?x+s.w*scale/2-6:x-s.w*scale/2+6;
 const len=(8+flicker*3)*scale,dir=enemy?1:-1;
 P.poly(g,[[tail,y-3*scale],[tail+dir*len,y],[tail,y+3*scale]],'#e17d65');P.line(g,tail,y,tail+dir*len*.65,y,'#ffe5a5',2*scale);
 g.save();g.translate(Math.round(x),Math.round(y));if(Math.abs(bank)>.05)g.scale(1,1-Math.abs(bank)*.12);spriteDraw(g,s,0,bank*2,scale,false,flash);g.restore();g._c=null;
}
function drawFlight(r) {
 background(r,run.scroll,run.stage);const ctx=game.screen.ctx;
 // Ground shadows reinforce altitude without changing the collision plane.
 for(const e of run.enemies)if(e.type!=='turret')P.ell(ctx,e.x-18,315,e.r*.7,2,'#213744');
 if(!run.outcome||run.outcome==='victory')P.ell(ctx,run.player.x-25,317,21,2,'#233744');
 for(const e of run.enemies){r.queue(e.x,e.y,0,g=>{
  const [x,y]=r.w(e.x,e.y,0);
  if(e.type==='turret'){spriteDraw(g,sprites.turret,x,y);if(e.muzzle>0)P.disc(g,x-6,y-14,4,C.cream);}
  else drawAircraft(g,e.type,x,y,run.t,Math.cos(e.t*1.6)*.5,1,true,e.flash>0);
  if(e.marked){P.poly(g,[[x,y-20],[x+3,y-17],[x,y-14],[x-3,y-17]],C.mint);}
  if(e.type==='gunship'){P.rect(g,x-29,y-27,58,3,'#182b3b');P.rect(g,x-29,y-27,58*e.hp/e.maxHp,3,C.orange);}
 },{bias:.2});}
 if(run.boss){const b=run.boss;r.queue(b.x,b.y,0,g=>{const [x,y]=r.w(b.x,b.y,0);DuskArt.drawBossHull(g,x,y,b.t,b.phase);
  for(const part of b.parts){const px=x+part.dx,py=y+part.dy;if(part.dead){P.disc(g,px,py,13,'#101c29');P.poly(g,[[px-8,py-8],[px+6,py-4],[px+10,py+6],[px-5,py+10]],'#4a3c3c');if(Math.floor(b.t*8)%2)P.disc(g,px-3,py+2,3,'#eb8d4e');continue;}
   if(part.id==='core'){P.disc(g,px,py,part.locked?15:18,'#122330');P.disc(g,px,py,part.locked?9:13,part.locked?'#71858a':part.flash>0?C.cream:C.orange);P.disc(g,px,py,part.locked?4:7,part.locked?'#243c4b':'#fff1ab');if(part.locked){P.rect(g,px-13,py-2,26,4,'#536473');}}
   else {P.rect(g,px-18,py-12,31,24,'#101e2b');P.rect(g,px-16,py-10,27,18,part.flash>0?C.cream:'#798b8b');P.rect(g,px-28,py-5,26,9,'#203845');P.rect(g,px-27,py-4,23,3,C.orange);P.disc(g,px+6,py,5,C.orange);}
   if(!part.locked){P.rect(g,px-17,py+22,34,2,'#172c3a');P.rect(g,px-17,py+22,34*part.hp/part.maxHp,2,C.orange);}
  }
 },{bias:.3});
  if(b.charge>0)r.overlay(g=>{const flash=settings.reduced||Math.floor(b.charge*12)%2;P.rect(g,0,b.beamY-8,b.x-85,16,flash?'#e973573b':'#ffad7130');P.line(g,0,b.beamY,b.x-83,b.beamY,flash?C.orange:'#8f665d');for(let i=0;i<12;i++)P.rect(g,i*47+Math.floor(b.t*25)%47,b.beamY-2,15,4,C.orange);text(g,'BEAM / MOVE',12,b.beamY-15,C.cream);});
 }
 for(const beam of run.beams)r.overlay(g=>{P.rect(g,0,beam.y-9,beam.x,18,C.red);P.rect(g,0,beam.y-5,beam.x,10,C.orange);P.rect(g,0,beam.y-2,beam.x,4,C.cream);});
 for(const q of run.pickups)r.queue(q.x,q.y,0,g=>{const[x,y]=r.w(q.x,q.y,0),color=q.type==='power'?C.mint:q.type==='repair'?'#aaf08a':C.orange;
  P.poly(g,[[x,y-12],[x+12,y],[x,y+12],[x-12,y]],'#112936');P.poly(g,[[x,y-10],[x+10,y],[x,y+10],[x-10,y]],color);P.rect(g,x-5,y-5,11,11,'#15323c');text(g,q.type==='power'?'P':q.type==='repair'?'+':'A',x,y-3,color,{align:'center'});
 },{bias:.7});
 for(const s of run.specials)r.queue(s.x,s.y,0,g=>{const[x,y]=r.w(s.x,s.y,0);P.line(g,x-7,y,x+5,y,s.type==='bomb'?C.orange:C.cream,s.type==='bomb'?5:3);P.rect(g,x-5,y-4,4,8,'#688e98');P.dot(g,x+6,y,C.cream);},{bias:.6});
 run.bullets.draw(r);
 if(run.outcome!=='defeat')r.queue(run.player.x,run.player.y,0,g=>{const [x,y]=r.w(run.player.x,run.player.y,0);if(run.invuln>0&&Math.floor(game.real*14)%2===0){g.save();g.globalAlpha=.48;}drawAircraft(g,run.plane.id,x,y,run.t,run.player.bank,1,false);if(run.invuln>0&&Math.floor(game.real*14)%2===0)g.restore();
  if(game.input.down('focus')||run.recovery>0){P.disc(g,x,y,6,'#152838');P.disc(g,x,y,3,C.cream);P.dot(g,x,y,C.orange);}
 },{bias:1});
 for(const ring of run.rings)r.overlay(g=>{const rad=ring.r*(ring.t/ring.max),alpha=1-ring.t/ring.max;g.save();g.globalAlpha=alpha*.8;for(let i=0;i<90;i++){const a=i/90*Math.PI*2;P.rect(g,ring.x+Math.cos(a)*rad,ring.y+Math.sin(a)*rad,3,3,ring.color);}g.restore();g._c=null;});
 r.overlay(drawHud);
 const paused=game.paused;if(paused!==lastPaused){lastPaused=paused;if(!settingsOpen)showPanel(paused?'pausePanel':null);if(paused){$('resumeBtn').focus({preventScroll:true});announce('Mission paused.');}else $('screen').focus({preventScroll:true});}
}
function drawHud(g) {
 P.rect(g,0,0,W,39,'#101e2bed');P.rect(g,0,38,W,1,'#78908a');P.rect(g,0,341,W,19,'#101e2bed');
 const p=run.player;text(g,run.pilot.call,10,7,C.mint);text(g,'HULL',10,23,'#b1c4c4');
 for(let i=0;i<20;i++)P.rect(g,40+i*4,23,3,7,i<Math.ceil(run.hp/run.maxHp*20)?run.hp/run.maxHp<.3?C.orange:C.mint:'#334950');
 text(g,String(Math.ceil(run.hp)),125,23,C.cream);text(g,'CANNON '+run.power,169,8,C.cream);
 P.rect(g,169,23,65,4,'#334950');P.rect(g,169,23,65*(run.power===4?1:run.xp/run.pilot.xp),4,C.mint);
 text(g,'SCORE',275,8,C.muted);text(g,String(Math.round(run.score)).padStart(7,'0'),275,22,C.cream);
 text(g,'SPECIAL',393,8,C.muted);const wi=run.selected;const owns=chosen.weapons[wi];text(g,owns?WEAPONS[wi].short+'  '+String(run.ammo[wi]).padStart(2,'0'):'NONE',393,22,owns&&run.ammo[wi]>0?C.orange:C.muted);
 const time=Math.floor(run.t/60)+':'+String(Math.floor(run.t%60)).padStart(2,'0');text(g,time,624,8,C.cream,{align:'right'});text(g,chosen.difficulty.toUpperCase(),624,22,C.muted,{align:'right'});
 const progress=run.boss?.dead ? 1 : run.boss?.phase===2 ? .88 : run.boss?.phase===1 ? .76 : Math.min(.72,run.t/154*.72);
 P.rect(g,145,348,277,3,'#39505b');P.rect(g,145,348,277*progress,3,C.mint);
 [0,.25,.53,.76,1].forEach(q=>P.rect(g,145+277*q,346,2,7,'#7d969b'));
 text(g,['01 / OPEN WATER','02 / REFINERY','03 / BREAKWATER','04 / CARRIER'][run.stage],9,347,C.muted);
 text(g,'C : '+(WEAPONS.some((w,i)=>chosen.weapons[i])?'CHANGE WEAPON':'NO SPECIAL'),627,347,C.muted,{align:'right'});
 if(run.recovery>0){const w=132,x=clamp(p.x-w/2,8,W-w-8),y=Math.min(306,p.y+25);P.rect(g,x,y,w,17,'#142530');text(g,'STABILIZING '+run.recovery.toFixed(1),x+4,y+3,C.orange);P.rect(g,x+4,y+12,(w-8)*(1-run.recovery/run.pilot.recover),2,C.orange);}
 if(run.combo>=3)text(g,run.combo+' CHAIN',10,49,C.orange);
 for(const q of run.warnings){if(Math.floor(q.t*6)%2){P.poly(g,[[W-16,q.y-7],[W-5,q.y],[W-16,q.y+7]],C.orange);text(g,q.label,W-22,q.y-3,C.orange,{align:'right'});}}
 if(run.toast){const a=run.toast;const y=run.boss?70:55;text(g,a.text,W/2,y,a.color,{align:'center',shadow:C.ink});}
 if(run.boss&&!run.boss.dead){const b=run.boss,hp=b.parts.reduce((v,p)=>v+p.hp,0),max=b.parts.reduce((v,p)=>v+p.maxHp,0);P.rect(g,176,46,288,16,'#101e2bdd');text(g,b.phase===1?'BREAKWATER / TWO BATTERIES':'BREAKWATER / EXPOSED REACTOR',320,48,C.cream,{align:'center'});P.rect(g,177,59,286,3,'#414755');P.rect(g,177,59,286*hp/max,3,C.orange);}
 if(run.stageBanner>0&&run.t>2){const labels=['GLASS COAST','REFINERY RUN','THE BREAKWATER','CARRIER'];const alpha=Math.min(1,run.stageBanner,.8);g.save();g.globalAlpha=alpha;text(g,labels[run.stage],W/2,122,C.cream,{align:'center',scale:2,shadow:'#172b3a'});g.restore();g._c=null;}
 if(run.radio){const q=run.radio;P.rect(g,11,281,360,48,'#0f2634e8');P.rect(g,11,281,2,48,C.mint);DuskArt.drawPortrait(g,20,288,32,q.pilot);text(g,q.name,62,287,C.mint);E.font.text(g,q.text,62,298,C.cream,{outline:false,wrap:298});}
 if(run.t<9&&!run.outcome){P.rect(g,110,239,364,18,'#142b3de8');text(g,'MOVE: WASD   HOLD SPACE: FIRE   X: SPECIAL',292,245,C.cream,{align:'center'});}
 if(run.t>9&&run.t<14&&!run.outcome){P.rect(g,110,239,364,18,'#142b3de8');text(g,'COLLECT P TO UPGRADE YOUR CANNON',292,245,C.mint,{align:'center'});}
}
const scenes = {
 title:{enter(){showPanel('titlePanel');document.body.classList.remove('playing');$('footerNote').textContent='HOLD THE LINE. FIND YOUR WAY HOME.';lastUiMode='title';},update(dt){titleTime+=dt;if(game.input.pressed('start'))goHangar();},draw(r){background(r,titleTime*11,1);r.overlay(g=>{const x=443,y=169+Math.sin(titleTime*.6)*4;drawAircraft(g,'kestrel',x,y,titleTime,-.3,3.3);drawAircraft(g,'needle',562,98+Math.sin(titleTime*.7)*3,titleTime,0,.75);P.line(g,410,216,563,216,'#adbbb6');P.line(g,410,216,410,222,'#adbbb6');text(g,'VT-7 / KESTREL',414,224,'#dce0c8');});}},
 hangar:{enter(){showPanel('hangarPanel');renderHangar();document.body.classList.remove('playing');lastUiMode='hangar';announce('Prepare your pilot, aircraft, and weapons.');},update(dt){titleTime+=dt;if(game.input.pressed('start'))launch();},draw(r){background(r,titleTime*4,1);}},
 flight:{pausable:true,enter(data){run=makeRun(data?.fromCheckpoint);game.focus(W/2,H/2);showPanel(null);lastPaused=false;lastUiMode='flight';document.body.classList.add('playing');$('footerNote').textContent='FLIGHT ACTIVE / '+run.plane.name;game.audio.music(run.t>=150?MUSIC.boss:MUSIC.sortie);$('screen').focus({preventScroll:true});},update:updateFlight,draw:drawFlight},
 result:{enter(){game.audio.music(run.outcome==='victory'?'victory':null);showResult();document.body.classList.remove('playing');lastUiMode='result';},update(dt){if(game.input.pressed('start')){if(run.outcome==='defeat'&&checkpoint){retryCount++;launch(true);}else launch();}},draw(r){background(r,run.scroll,run.stage);if(run.boss)r.overlay(g=>DuskArt.drawBossHull(g,505,205,run.boss.t,3));}}
};
// Native UI controls share these same actions with input and the test interface.
$('beginBtn').addEventListener('click',goHangar);$('backTitleBtn').addEventListener('click',goTitle);$('launchBtn').addEventListener('click',()=>launch());
$('brand').addEventListener('click',e=>{e.preventDefault();if(game.sceneName==='flight'){game.paused=true;showPanel('pausePanel');}else goTitle();});
$('resumeBtn').addEventListener('click',()=>{game.paused=false;lastPaused=false;showPanel(null);game.input.clear();$('screen').focus({preventScroll:true});});
$('retryPauseBtn').addEventListener('click',()=>launch());$('hangarPauseBtn').addEventListener('click',goHangar);
$('continueBtn').addEventListener('click',()=>{if(run?.outcome==='defeat'&&checkpoint){retryCount++;launch(true);}else launch();});$('resultHangarBtn').addEventListener('click',goHangar);
$('difficulty').addEventListener('change',e=>{chosen.difficulty=e.target.value;});$('autofire').addEventListener('change',e=>{settings.auto=e.target.checked;applySettings();saveSettings();});
$('soundBtn').addEventListener('click',()=>{settings.sound=!settings.sound;applySettings();saveSettings();if(settings.sound){game.audio._init();game.audio.sfx('confirm',{vol:.15});}});
function openSettings(){resumeAfterSettings=game.sceneName==='flight'&&!game.paused;settingsOpen=true;if(game.sceneName==='flight')game.paused=true;showPanel('settingsPanel');applySettings();$('closeSettingsBtn').focus({preventScroll:true});}
function closeSettings(){settingsOpen=false;if(resumeAfterSettings){game.paused=false;lastPaused=false;}showPanel(game.sceneName==='flight'?(game.paused?'pausePanel':null):game.sceneName==='hangar'?'hangarPanel':game.sceneName==='result'?'resultPanel':'titlePanel');if(game.sceneName==='flight'&&!game.paused)$('screen').focus({preventScroll:true});}
$('settingsBtn').addEventListener('click',openSettings);$('closeSettingsBtn').addEventListener('click',closeSettings);
for(const [id,key] of [['motionSetting','reduced'],['scanSetting','scan'],['autoSetting','auto']])$(id).addEventListener('change',e=>{settings[key]=e.target.checked;applySettings();saveSettings();});
$('volumeSetting').addEventListener('input',e=>{settings.volume=Number(e.target.value);applySettings();saveSettings();});
$('fullBtn').addEventListener('click',()=>{const el=$('app');if(document.fullscreenElement)document.exitFullscreen?.();else el.requestFullscreen?.().catch(()=>{});});
function autoPause(){if(game.sceneName==='flight'&&!run?.outcome&&!game.paused){game.paused=true;game.input.clear();touch.x=touch.y=0;touch.id=null;}}
addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
document.addEventListener('keydown',e=>{if(e.code==='Escape'&&settingsOpen){e.preventDefault();e.stopPropagation();closeSettings();}else if(e.code==='Escape'&&game.sceneName==='flight'&&game.paused&&e.target.tagName==='BUTTON'){e.preventDefault();game.paused=false;lastPaused=false;showPanel(null);game.input.clear();$('screen').focus({preventScroll:true});}if(e.code==='KeyM'&&e.target.tagName!=='INPUT'){settings.sound=!settings.sound;applySettings();saveSettings();}});
const stick=$('stickZone');function moveStick(e){if(e.pointerId!==touch.id)return;const rc=stick.getBoundingClientRect(),rad=rc.width/2,dx=e.clientX-rc.left-rad,dy=e.clientY-rc.top-rad,len=Math.hypot(dx,dy),max=rad*.6,k=len>max?max/len:1;touch.x=dx*k/max;touch.y=dy*k/max;$('stickThumb').style.transform=`translate(${dx*k*.65}px,${dy*k*.65}px)`;}
stick.addEventListener('pointerdown',e=>{e.preventDefault();touch.id=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});stick.addEventListener('pointermove',moveStick);
function releaseStick(e){if(e.pointerId===touch.id){touch.id=null;touch.x=touch.y=0;$('stickThumb').style.transform='';}}
stick.addEventListener('pointerup',releaseStick);stick.addEventListener('pointercancel',releaseStick);
$('touchSpecial').addEventListener('pointerdown',e=>{e.preventDefault();if(!game.paused)useSpecial();});$('touchSwitch').addEventListener('pointerdown',e=>{e.preventDefault();if(!game.paused)cycleWeapon();});$('touchPause').addEventListener('click',()=>{game.paused=true;});
$('touchFire').addEventListener('pointerdown',e=>{e.preventDefault();$('touchFire').setPointerCapture(e.pointerId);if(!game.paused)game.input.press('TouchFire');});
for(const event of ['pointerup','pointercancel'])$('touchFire').addEventListener(event,()=>game.input.release('TouchFire'));
applySettings();game.start({scene:'title',scenes});
function state(){return {scene:game.sceneName,paused:game.paused,chosen:JSON.parse(JSON.stringify(chosen)),funds:funds(),settings:{...settings},retryCount,checkpoint:checkpoint?{...checkpoint}:null,run:run?{time:run.t,stage:run.stage,hp:run.hp,maxHp:run.maxHp,recovery:run.recovery,invuln:run.invuln,power:run.power,xp:run.xp,ammo:[...run.ammo],selected:run.selected,score:run.score,kills:run.kills,spawned:run.spawned,shots:run.shots,hits:run.hits,player:{...run.player},enemies:run.enemies.map(e=>({type:e.type,x:e.x,y:e.y,hp:e.hp})),bullets:run.bullets.list.length,boss:run.boss?{phase:run.boss.phase,dead:run.boss.dead,x:run.boss.x,y:run.boss.y,parts:run.boss.parts.map(p=>({...p}))}:null,outcome:run.outcome}:null,errors:[...game.errors]};}
if(TEST)window.DuskDebug={game,getState:state,actions:{goHangar,goTitle,launch,selectPilot,selectPlane,toggleWeapon,useSpecial,cycleWeapon,damagePlayer,spawnBoss,damageBossPart,openSettings,closeSettings},step(seconds){for(let t=0;t<seconds-1e-8;t+=1/120)game._step(1/120);game._frame();return state();},getRun:()=>run,setDifficulty(v){if(!MODES[v])throw new Error('Invalid difficulty');chosen.difficulty=v;},setAuto(v){settings.auto=!!v;},press(c){game.input.press(c);},release(c){game.input.release(c);}};
// Optional browser agent tools read the same state. They do not expose test commands.
if(document.modelContext?.registerTool){const lifecycle=new AbortController();const register=t=>Promise.resolve(document.modelContext.registerTool(t,{signal:lifecycle.signal})).catch(()=>{});
 register({name:'read_flight_status',description:'Read the current Dusk Vector menu or mission status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>state()});
 register({name:'prepare_flight',description:'Open the Dusk Vector preparation screen. This leaves any current mission.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute:()=>{goHangar();return {status:'opening flight preparation'};}});
 addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
})();
