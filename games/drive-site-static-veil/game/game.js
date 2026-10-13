/* STATIC VEIL / The Ninth Relay. Original game. Foundation: my-3D2dge 0.8.1. */
(function(){
 'use strict';
 const E=My3D2dge,px=E.px,$=id=>document.getElementById(id),A=VeilArt;
 const SAVE='static-veil-checkpoint-v1',PREF='static-veil-settings-v1';
 const prefs=Object.assign({muted:false,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,assist:false},E.store.get(PREF,{}));
 const game=new E.Game({canvas:$('screen'),view:'iso',minW:580,minH:330,maxW:900,maxH:560,bg:'#07101b',input:{
  ...E.Input.DEFAULT,attack:['Mouse0'],interact:['KeyE'],scan:['KeyQ'],crouch:['KeyC','ControlLeft'],dash:['Space'],
  reload:['KeyR'],heal:['KeyF'],hack1:['Digit1'],hack2:['Digit2'],hack3:['Digit3'],journal:['KeyJ'],map:['KeyM'],pause:['Escape']
 }});
 game.pauseOverlay=false;game.input.touchEnabled=false;game.reduceMotion=prefs.reduced;
 // Dark materials and local glow geometry provide the night palette. The CPU
 // full-screen light filter is optional and too costly for this larger level.
 game.lights.enabled=false;
 game.audio.setVolume(.48);game.audio.musicVolume=.35;game.audio.mute(prefs.muted);
 document.body.classList.toggle('reduced',prefs.reduced);
 const perfBox=document.createElement('output');perfBox.id='performance';perfBox.hidden=true;perfBox.style.cssText='position:fixed;z-index:90;left:30px;top:91px;padding:9px 12px;background:#071722;color:#dfff6e;border:1px solid #527b79;font:11px monospace;pointer-events:none';document.body.append(perfBox);
 let perfStart=performance.now(),perfFrames=0,perfRender=0,perfUpdate=0;
 function recordFrame(){perfFrames++;perfRender+=game.stats.renderMs||0;perfUpdate+=game.stats.updateMs||0;const now=performance.now();if(now-perfStart>=1500){perfBox.textContent=`FRAME DELIVERY ${(perfFrames*1000/(now-perfStart)).toFixed(1)} FPS · DRAW ${(perfRender/perfFrames).toFixed(1)} MS · UPDATE ${(perfUpdate/perfFrames).toFixed(1)} MS · F3`;perfStart=now;perfFrames=perfRender=perfUpdate=0;}}
 const defs={
  coil:[{wave:'sawtooth',freq:780,to:130,dur:.07,vol:.09},{wave:'noise',freq:80,dur:.035,vol:.07}],
  enemycoil:[{wave:'square',freq:340,to:90,dur:.095,vol:.05}],
  upload:[{wave:'sine',freq:550,to:1400,dur:.32,vol:.08},{wave:'triangle',freq:220,to:700,dur:.2,vol:.035}],
  link:[{wave:'sine',freq:860,to:430,dur:.15,vol:.06}],
  deny:{wave:'square',freq:120,to:75,dur:.12,vol:.06},
  reload:{wave:'noise',freq:1100,dur:.14,vol:.055},
  heal:{wave:'sine',freq:330,to:990,dur:.42,vol:.085},
  alert:[{wave:'sawtooth',freq:250,to:550,dur:.22,vol:.07}],
  step:{wave:'noise',freq:130,dur:.035,vol:.018},
  dash:[{wave:'noise',freq:1300,to:190,dur:.14,vol:.055}],
  down:{wave:'triangle',freq:180,to:40,dur:.2,vol:.11},
  gate:[{wave:'noise',freq:90,dur:.6,vol:.07},{wave:'sawtooth',freq:45,to:30,dur:.55,vol:.03}],
  secret:{wave:'sine',freq:720,to:1100,dur:.28,vol:.08},
  broadcast:[{wave:'sawtooth',freq:100,to:900,dur:.65,vol:.07},{wave:'sine',freq:200,to:1100,dur:.8,vol:.04}]
 };
 for(const[k,v]of Object.entries(defs))game.audio.define(k,v);
 const music={bpm:88,steps:2,tracks:[
  {wave:'triangle',vol:.10,gate:.85,notes:'D2 - . D2 . - A1 . | D2 - . F2 . - C2 . | Bb1 - . Bb1 . - F2 . | C2 - . C2 . - A1 .'},
  {wave:'sine',vol:.055,gate:.45,notes:'D4 . . A4 . . F4 . | E4 . . . . C4 . . | D4 . . A4 . . F4 . | C5 . . . A4 . . .'},
  {wave:'drums',vol:.052,notes:'k . h . . . h . | k . h . s . h . | k . h . . . h . | k . h . s . h h'}
 ]};
 let moveGoal=null,moveNav=null;
 let L,map,player,rig,shots,enemies=[],cameras=[],civilians=[],objects=[],decor=[];
 let mode='menu',stage=0,loadout='ghost',scan=false,hackTarget=null,aimTarget=null,near=null,upload=null,choice=null;
 let alert=0,trace=0,pingTime=0,hurt=0,fireWait=0,reloading=0,healWait=0,dashWait=0,dashing=0,dashVector=[0,0],invincible=0;
 let time=0,elapsed=0,stepWait=0,hudWait=0,commsLeft=0,toastLeft=0,checkpointName='Dock arrival',entered=false,upgrade=null;
 let lastFacing=-Math.PI/2,lastMove=[0,-1],stats,log=[],readShards=[],flags={},grace=0,modalKind='',best=null;
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),wpos=(x,y)=>VeilLevel.at(x,y);
 const dstr=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
 function note(message){log.push({time:dstr(elapsed),text:message});if(log.length>40)log.shift();}
 function toast(text,seconds=3.5){$('toast').textContent=text;$('toast').classList.add('on');toastLeft=seconds;}
 function comm(text,name='MARA / DISTRICT CONTACT',duration=7){$('comms-name').textContent=name;$('comms-text').textContent=text;$('comms').hidden=false;commsLeft=duration;}
 function objective(){
  if(stage===0)return['Meet Mara at the dock.','Reach the marked intercom. Press E to connect.'];
  if(stage===1)return['Enter the relay.','Use the freight gate, service door, or north duct.'];
  if(stage===2)return['Recover the memory archive.','Find the archive. The security console opens its door.'];
  if(stage===3)return['Reach the extraction skiff.','Return to the south dock. Press E at the skiff.'];
  return['Contract complete.','The district will remember your choice.'];
 }
 function makeEnemy(s){
  const pos=s.x!==undefined?s:wpos(...s.patrol[0]);
  const b=new E.Body({x:pos.x,y:pos.y,r:4.7});
  Object.assign(b,{id:s.id,kind:'guard',team:'enemy',name:s.name,maxHp:s.hp,hp:s.hp,elite:!!s.elite,patrol:s.patrol.map(p=>wpos(...p)),pi:1,
   facing:Math.atan2(wpos(...s.patrol[1]).y-pos.y,wpos(...s.patrol[1]).x-pos.x),state:'patrol',suspicion:0,blind:0,stun:0,fire:1.2,wind:0,lost:0,dead:false,deadTime:0,hurt:0,wait:0,seenBody:false,last:{x:pos.x,y:pos.y}});
  b.nav=new E.VersionedFlowField(map);b.rig=new E.Humanoid({build:s.elite?'bulky':'heroic',size:.9,weapon:'gun',hair:'buzz',outfit:'jacket',sleeves:'long',armor:true,eyeGlow:'#ff9271',colors:{skin:'#9e928e',hair:'#16202c',cloth:s.elite?'#5e586c':'#485362',pants:'#202d3f',boot:'#121e2c',metal:'#8d9bac',trim:'#ff9b74',glove:'#223344'}});
  return b;
 }
 function resetWorld(){
  L=VeilLevel.build(E);map=L.map;moveNav=new E.VersionedFlowField(map);moveGoal=null;objects=L.objects;decor=L.decor;cameras=L.cameras.map(c=>Object.assign(c,{team:'enemy',off:0,dead:false,suspicion:0,hp:36}));
  enemies=L.guardSpecs.map(makeEnemy);
  civilians=L.civilians.map(c=>Object.assign(c,{rig:new E.Humanoid({build:'heroic',weapon:null,outfit:'coat',hair:'short',size:.83,colors:{cloth:c.color,pants:'#253544',skin:'#b59280',hair:'#242933',trim:'#b6b3a0'}})}));
  player=new E.Body({...L.spawn,r:4.5,team:'player'});player.maxHp=loadout==='striker'?125:100;player.hp=player.maxHp;player.maxRam=loadout==='breach'?12:10;player.ram=player.maxRam;player.ammo=12;player.crouch=false;player.facing=lastFacing;
  rig=new E.Humanoid({build:'heroic',size:1,weapon:'gun',outfit:'coat',sleeves:'long',hair:{style:'ponytail',color:'#cad8d6',length:8},colors:{skin:'#bd9c8e',hair:'#c7d8d2',cloth:'#36586a',coat:'#36586a',pants:'#152b3d',boot:'#17242e',glove:'#233d4c',trim:'#68f0d0',metal:'#b7d6db'},eyeGlow:'#68f0d0'});
  shots=new E.SweptBullets(game,{max:90});game.follow(player,{z:16,lead:0});game.cam.smooth=.16;game.cam.offset=[0,-15];
  game.setZoom(1.16);game.cam.bounds=null;
 }
 function resetState(){
  stage=0;time=0;elapsed=0;choice=null;scan=false;hackTarget=null;aimTarget=null;near=null;upload=null;alert=trace=pingTime=hurt=fireWait=reloading=healWait=dashWait=dashing=0;invincible=0;grace=0;entered=false;upgrade=null;readShards=[];flags={};log=[];
  stats={shots:0,hits:0,kills:0,nonlethal:0,hacks:0,alarms:0,damage:0};checkpointName='Dock arrival';
 }
 function start(continuing=false){
  const saved=continuing?E.store.get(SAVE):null;
  resetState();if(saved&&saved.version===1)loadout=saved.loadout||'ghost';resetWorld();
  if(saved&&saved.version===1)restore(saved);
  mode='play';game.paused=false;game.timeScale=1;game.input.clear();fireWait=.3;
  $('menu').hidden=true;$('hud').hidden=false;$('modal').hidden=true;$('screen').focus();
  game.audio.music(music);game.audio.sfx('link');
  if(!saved){note('Arrived at the Lower Waterfront.');comm('You made it. My intercom is beside the dock. Move with W A S D. Press E when you are close.');saveCheckpoint('Dock arrival',false);}
  else{toast('CHECKPOINT / '+checkpointName);comm('Link restored. Your contract is still active.');}
  updateHud();
 }
 function saveCheckpoint(name,notify=true){
  checkpointName=name;
  const saved={version:1,name,loadout,stage,elapsed,choice,entered,upgrade,readShards:[...readShards],flags:{...flags},stats:{...stats},log:[...log],
   player:{x:player.x,y:player.y,hp:Math.max(40,player.hp),maxHp:player.maxHp,ram:Math.max(4,player.ram),maxRam:player.maxRam,ammo:12},
   open:Object.keys(L.doors).filter(k=>L.doors[k].every(([x,y])=>map.cell(x,y)===0)),
   enemies:enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,name:e.name,elite:e.elite,patrol:e.patrol.map(p=>[Math.floor(p.x/16),Math.floor(p.y/16)]),dead:e.dead,facing:e.facing,pi:e.pi})),cameras:cameras.map(c=>({id:c.id,off:c.off,dead:c.dead,hp:c.hp})),used:objects.filter(o=>o.used).map(o=>o.id)};
  const ok=E.store.set(SAVE,saved);$('continue-game').hidden=!ok;
  if(notify)toast(ok?'CHECKPOINT / '+name:'Checkpoint could not save on this device.');
 }
 function restore(s){
  checkpointName=s.name;stage=s.stage;elapsed=s.elapsed||0;choice=s.choice;entered=s.entered;upgrade=s.upgrade;readShards=s.readShards||[];flags=s.flags||{};stats={...stats,...s.stats};log=s.log||[];
  Object.assign(player,s.player);player.hp=E.clamp(player.hp,1,player.maxHp);player.ram=E.clamp(player.ram,0,player.maxRam);player.ammo=12;
  for(const k of s.open||[])openDoor(k,false);
  for(const v of s.enemies||[]){let e=enemies.find(e=>e.id===v.id);if(!e&&v.patrol){e=makeEnemy({...v,hp:v.maxHp||78});enemies.push(e);}if(e){const {patrol,...saved}=v;Object.assign(e,saved);if(patrol)e.patrol=patrol.map(p=>wpos(...p));e.state=e.dead?'dead':'patrol';}}
  for(const c of cameras){const v=s.cameras?.find(v=>v.id===c.id);if(v)Object.assign(c,v);}
  for(const id of s.used||[]){const o=objects.find(o=>o.id===id);if(o)o.used=true;}
  grace=stage===3&&choice==='seal'?99999:6;invincible=2;game.cam.snap=true;
 }
 function openDoor(id,sound=true){
  if(!L.doors[id])return;for(const[x,y]of L.doors[id])map.set(x,y,0);
  const o=objects.find(o=>o.id===id);if(o){o.used=true;o.active=false;}
  if(sound){game.audio.sfx('gate');game.particles.sparks((L.doors[id][0][0]+.5)*16,(L.doors[id][0][1]+.5)*16,15,12,null,{color:'#68f0d0'});}
 }
 function isOpen(id){return L.doors[id]?.every(([x,y])=>map.cell(x,y)===0);}
 function showModal(kicker,title,html,buttons,kind='info'){
  modalKind=kind;moveGoal=null;game.paused=true;game.timeScale=1;scan=false;upload=null;game.input.clear();$('hack-panel').hidden=true;
  $('modal-kicker').textContent=kicker;$('modal-title').textContent=title;$('modal-content').innerHTML=html;$('modal-actions').replaceChildren();
  for(const b of buttons){const el=document.createElement('button');el.textContent=b.label;if(b.detail){const sm=document.createElement('small');sm.textContent=b.detail;el.append(sm);}el.addEventListener('click',b.action);$('modal-actions').append(el);}
  $('modal').hidden=false;requestAnimationFrame(()=>$('modal-actions').querySelector('button')?.focus());
 }
 function closeModal(){
  $('modal').hidden=true;modalKind='';game.paused=mode!=='play';game.timeScale=1;game.input.clear();fireWait=.25;$('screen').focus();
 }
 function pause(){if(mode!=='play')return;if(!$('modal').hidden){if(modalKind!=='choice'&&modalKind!=='dead'&&modalKind!=='end')closeModal();return;}
  showModal('LINK SUSPENDED','Take a breath.',`<p>${objective()[0]}</p><p>Current checkpoint: <strong>${checkpointName}</strong><br>Mission time: ${dstr(elapsed)}</p>`,[
   {label:'RESUME MISSION',action:closeModal},{label:'CONTROLS & SETTINGS',action:help},{label:'RESTART CHECKPOINT',action:()=>start(true)},{label:'RETURN TO TITLE',action:toTitle}
  ],'pause');
 }
 function toTitle(){closeModal();mode='menu';game.paused=false;game.timeScale=1;$('hud').hidden=true;$('menu').hidden=false;game.input.clear();game.audio.stopMusic();$('new-game').focus();}
 function help(){
  const controls=[['W A S D','Move'],['MOUSE','Aim'],['RIGHT CLICK','Move to a point'],['CLICK','Fire'],['E','Interact / silent takedown'],['Q','Toggle scanner / slow time'],['1 / 2 / 3','Use the selected hack'],['C / CTRL','Toggle crouch'],['SPACE','Dash'],['R','Reload'],['F','Restore 45 health'],['M / J','Map / journal'],['ESC','Pause / close panel']];
  showModal('FIELD MANUAL','Know your tools.',`<div class="key-table">${controls.map(([k,v])=>`<div><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div><p>Crouch behind low cover. Stay outside guard view cones. Approach a guard from behind and press E for a silent takedown. In scan mode, aim near a guard or device. Use 1, 2, or 3 to upload a hack.</p><div class="settings-list"><label>Mute sound<input id="set-mute" type="checkbox" ${prefs.muted?'checked':''}></label><label>Reduce motion and screen effects<input id="set-reduced" type="checkbox" ${prefs.reduced?'checked':''}></label><label>Assist mode: take less damage<input id="set-assist" type="checkbox" ${prefs.assist?'checked':''}></label></div>`,[{label:mode==='menu'?'BACK TO TITLE':mode==='dead'?'BACK TO CHECKPOINT OPTIONS':'RETURN TO MISSION',action:()=>mode==='dead'?deathPanel():closeModal()}],'help');
  $('set-mute').onchange=e=>{prefs.muted=e.target.checked;game.audio.mute(prefs.muted);E.store.set(PREF,prefs);};
  $('set-reduced').onchange=e=>{prefs.reduced=e.target.checked;game.reduceMotion=prefs.reduced;document.body.classList.toggle('reduced',prefs.reduced);E.store.set(PREF,prefs);};
  $('set-assist').onchange=e=>{prefs.assist=e.target.checked;E.store.set(PREF,prefs);};
 }
 function journal(){if(mode!=='play')return;showModal('CONTRACT / 09','The record so far.',`<p>${objective()[0]} ${objective()[1]}</p><p>Memory fragments: ${readShards.length} / 3<br>Field implant: ${upgrade?upgrade==='echo'?'Echo step':'Fast cycle':'None installed'}</p>${log.slice(-12).reverse().map(v=>`<p class="log-entry"><time>${v.time}</time>${v.text}</p>`).join('')}`,[{label:'RETURN TO MISSION',action:closeModal}],'journal');}
 function showMap(){if(mode!=='play')return;showModal('MERIDIAN / LOWER WATERFRONT','Find your own way.',`<canvas class="big-map" id="large-map" width="672" height="420" aria-label="Full mission map"></canvas><div class="route-list"><div><b>01 / FREIGHT GATE</b>Direct route. Force the gate. Expect guards.</div><div><b>02 / SERVICE LINE</b>Follow the west walkway. Use the junction to open the service door.</div><div><b>03 / NORTH DUCT</b>Follow the walkway around the station. Crouch at the north vent.</div></div>`,[{label:'RETURN TO MISSION',action:closeModal}],'map');drawMap($('large-map'),true);}
 function takeContract(){
  showModal('MARA / ENCRYPTED CONTRACT','Borrowed lives.',`<p>Orison owns this district’s memory storage. Miss one payment, and it can lock away your past.</p><blockquote>“The Ninth Relay holds our archive. Bring it back. Check the record before you send it. We do not know what else they stored.”</blockquote><p>Take any route. The freight gate is guarded. The west service line controls a side door. An old duct reaches the archive from the north.</p>`,[{label:'TAKE THE CONTRACT',detail:'Recover the archive and return to the dock.',action:()=>{closeModal();stage=1;objects.find(o=>o.id==='contact').used=true;note('Accepted Mara’s contract. Three entry routes are available.');saveCheckpoint('Contract accepted');comm('Your scanner shows guard view cones and network devices. Press Q. Use C to crouch. The district needs you alive.');}}],'contract');
 }
 function finalChoice(){
  showModal('ARCHIVE / 8,412 RESIDENTS','Who owns the truth?',`<p>The archive contains the district’s memories and proof of Orison’s seizure orders. Its public index also contains every resident’s identity.</p><blockquote>“Release it, and everyone will see what they did. Seal the index, and our people stay private. I cannot make that choice for them.”</blockquote><p>A public release will trigger a security response. A sealed transfer will remove the public evidence and issue a valid exit pass.</p>`,[
   {label:'RELEASE THE RECORD',detail:'Return the memories and publish the evidence. Resident identities become public. Expect a hostile extraction.',action:()=>resolveChoice('release')},
   {label:'SEAL THE RECORD',detail:'Return the memories in private. Protect resident identities. The public case against Orison loses its evidence.',action:()=>resolveChoice('seal')}
  ],'choice');
 }
 function resolveChoice(which){
  if(stage>=3)return;choice=which;stage=3;objects.find(o=>o.id==='core').used=true;
  Object.keys(L.doors).forEach(k=>openDoor(k,false));cameras.forEach(c=>c.off=99999);player.ram=player.maxRam;player.hp=Math.min(player.maxHp,player.hp+30);invincible=5;grace=which==='seal'?99999:4;
  closeModal();game.audio.sfx('broadcast');game.flash(which==='seal'?'#68f0d0':'#dfff6e',.24,.28);
  if(which==='release'){
   enemies.push(makeEnemy({id:'r1',name:'Response officer',patrol:[[32,29],[28,29]],hp:78}),makeEnemy({id:'r2',name:'Response officer',patrol:[[25,22],[30,22]],hp:78}));
   raiseAlarm(player,220);comm('The archive is public. The blackout bought you a few seconds. A response team is in the yard. Get to the skiff.',undefined,9);note('Released the archive. Public evidence and resident identities are online.');
  }else{alert=trace=0;enemies.forEach(e=>{e.state='patrol';e.suspicion=0;e.wind=0;});comm('The private copy is secure. Your exit pass is valid. The names are safe. Orison’s public record is still clean.',undefined,9);note('Sealed the archive. Private memories restored; the public evidence is gone.');}
  saveCheckpoint(which==='release'?'Archive released':'Archive sealed');updateHud();
 }
 function complete(){
  if(stage!==3)return;stage=4;mode='end';scan=false;game.timeScale=1;game.audio.sfx('secret');game.audio.stopMusic();E.store.remove(SAVE);$('continue-game').hidden=true;
  const title=choice==='release'?'The city heard you.':'Some things stay ours.';
  const ending=choice==='release'?'The district’s memories are free. Orison’s seizure orders are public. So are the names of 8,412 residents. The city has proof. Its people now need protection.':'The residents have their memories again. Their names stay private. The public evidence is gone, and Orison can deny what happened. The district keeps its past. The city keeps its doubt.';
  const style=stats.kills===0?(stats.alarms===0?'GHOST SIGNAL':'QUIET HANDS'):stats.hacks>stats.kills?'SIGNAL BREAKER':'DIRECT ACTION';
  const values=[[dstr(elapsed),'MISSION TIME'],[style,'APPROACH'],[stats.alarms,'ALARMS'],[stats.kills,'LETHAL'],[stats.nonlethal,'NONLETHAL'],[readShards.length+' / 3','FRAGMENTS']];
  best={completed:true,ending:choice,time:elapsed,...stats,fragments:readShards.length};E.store.set('static-veil-last-result',best);
  showModal('CONTRACT COMPLETE / '+(choice==='release'?'PUBLIC RECORD':'SEALED RECORD'),title,`<p>${ending}</p><div class="debrief-stats">${values.map(([v,k])=>`<div><b style="${String(v).length>8?'font-size:15px;padding-top:9px;min-height:32px':''}">${v}</b><span>${k}</span></div>`).join('')}</div><p>Archive delivered. Extraction complete.</p>`,[{label:'PLAY AGAIN',detail:'Try another route, rig, or ending.',action:()=>start(false)},{label:'RETURN TO TITLE',action:toTitle}],'end');
 }
 function die(){
  if(mode!=='play')return;mode='dead';scan=false;game.audio.sfx('down');deathPanel();
 }
 function deathPanel(){
  showModal('LINK LOST','Your signal went dark.',`<p>Orison still holds the relay. Your last checkpoint is ready.</p><p><strong>${checkpointName}</strong></p>`,[{label:'RESTART CHECKPOINT',action:()=>start(true)},{label:'CONTROLS & SETTINGS',action:help},{label:'RETURN TO TITLE',action:toTitle}],'dead');
 }
 function interact(){
  if(mode!=='play'||game.paused)return;near=findInteraction();if(!near){toast('Move closer to a device or a guard.');return;}
  scan=false;game.timeScale=1;
  if(near.kind==='guard'){neutralize(near,false);game.audio.sfx('down');rig.kick(-3);toast('SILENT TAKEDOWN');player.ram=Math.min(player.maxRam,player.ram+2);return;}
  const o=near;
  if(o.kind==='contact'){takeContract();return;}
  if(stage===0){toast('Connect to Mara’s intercom first.');return;}
  if(o.id==='front'){
   openDoor('front');o.used=true;raiseAlarm(o,100);note('Forced the freight gate.');toast('FREIGHT GATE OPEN / GUARDS ALERTED');return;
  }
  if(o.id==='service'){toast('Use the service junction on the west walkway.');return;}
  if(o.kind==='junction'){
   showModal('SERVICE JUNCTION / LOCAL ACCESS','Bridge the signal.',`<p>The door circuit has three live channels. The service label shows the required order:</p><h3>GROUND → LINK → POWER</h3><p>Choose the correct bridge. A wrong bridge causes a short local alarm. You can try again.</p>`,[
    {label:'GROUND / LINK / POWER',detail:'Connect the return path before the live feed.',action:()=>{closeModal();o.used=true;openDoor('service');cameras[0].off=99999;note('Bridged the service circuit. Side door open.');toast('SERVICE LINE OPEN / YARD CAMERA OFF');game.audio.sfx('upload');}},
    {label:'POWER / LINK / GROUND',detail:'Connect the live feed first.',action:()=>{closeModal();game.audio.sfx('deny');trace=Math.min(100,trace+28);raiseAlarm(o,65);toast('CIRCUIT FAULT / TRY THE SERVICE LABEL');}},
    {label:'LEAVE THE JUNCTION',action:closeModal}
   ],'junction');return;
  }
  if(o.kind==='vent'){
   if(!player.crouch){toast('Press C to crouch before you enter the duct.');return;}
   openDoor('vent',false);Object.assign(player,wpos(36,10));stage=2;entered=true;game.cam.snap=true;game.flash('#0a1725',.45,.9);invincible=2;note('Entered through the north maintenance duct.');toast('ARCHIVE / MAINTENANCE ACCESS');saveCheckpoint('North duct');return;
  }
  if(o.kind==='security'){o.used=true;openDoor('vault');cameras.forEach(c=>c.off=99999);note('Disabled the cameras and opened the archive.');toast('ARCHIVE UNLOCKED / CAMERAS OFF');comm('You have control of the station. The archive is in the room to the east.');saveCheckpoint('Archive unlocked');return;}
  if(o.kind==='core'){finalChoice();return;}
  if(o.kind==='extract'){if(stage===3)complete();else toast('The skiff is ready. Recover the archive first.');return;}
  if(o.kind==='shard'){
   if(!readShards.includes(o.id))readShards.push(o.id);o.used=true;player.ram=Math.min(player.maxRam,player.ram+3);game.audio.sfx('secret');note('Read '+o.name.toLowerCase()+'.');
   const lines=o.text.split('\n');showModal('MEMORY FRAGMENT / '+readShards.length+' OF 3',o.name,`<h3>${lines[0]}</h3><p>${lines[1]}</p><p>Recovered 3 RAM.</p>`,[{label:'CLOSE FRAGMENT',action:closeModal}],'fragment');return;
  }
  if(o.kind==='upgrade'){
   showModal('UNLICENSED IMPLANT / ONE SLOT','Make the hardware yours.',`<p>The bench has enough power for one implant. Both changes last for this mission.</p>`,[
    {label:'ECHO STEP',detail:'Each dash jams guards within 45 units for 3 seconds. Use it to cross watched ground.',action:()=>installUpgrade('echo',o)},
    {label:'FAST CYCLE',detail:'Reload in 0.65 seconds. Each shot deals 6 more damage. Use it to hold a firing position.',action:()=>installUpgrade('cycle',o)},
    {label:'LEAVE THE BENCH',action:closeModal}
   ],'upgrade');return;
  }
  if(o.kind==='battery'){scan=true;game.timeScale=.23;hackTarget=o;toast('Press 2 to overload the transformer.');}
 }
 function installUpgrade(id,o){upgrade=id;o.used=true;player.hp=player.maxHp;closeModal();game.audio.sfx('heal');game.flash('#68f0d0',.2,.2);note('Installed '+(id==='echo'?'Echo step':'Fast cycle')+'.');toast('IMPLANT INSTALLED / '+(id==='echo'?'ECHO STEP':'FAST CYCLE'));saveCheckpoint('Field implant installed',false);}
 function findInteraction(){
  let found=null,range=32;
  for(const e of enemies){if(e.dead||dist(e,player)>20)continue;const behind=Math.abs(E.angDiff(e.facing,Math.atan2(player.y-e.y,player.x-e.x)))>1.65;
   if((behind&&e.state!=='combat')||e.blind>0||e.stun>0){if(E.clearSight(map,{...player,z:15},{...e,z:15})){found=e;range=dist(e,player);}}
  }
  for(const o of objects){if(o.used)continue;if(stage===0&&o.kind!=='contact')continue;if(stage<3&&o.kind==='extract'&&stage>0)continue;if(stage>=3&&['core','security','junction','vent','door','contact'].includes(o.kind))continue;
   const d=dist(o,player),radius=o.kind==='core'?39:30;
   if(d<Math.min(range,radius)&&E.clearSight(map,{...player,z:30},{...o,z:30})){found=o;range=d;}
  }
  return found;
 }
 function sight(a,b,range=145,cone=.62){if(dist(a,b)>range)return false;if(Math.abs(E.angDiff(a.facing,Math.atan2(b.y-a.y,b.x-a.x)))>cone)return false;return E.clearSight(map,{x:a.x,y:a.y,z:a.kind==='camera'?41:26},{x:b.x,y:b.y,z:b.crouch?12:25});}
 function raiseAlarm(source,radius=150){
  if(grace>10)return;let changed=false;
  for(const e of enemies){if(e.dead||dist(e,source)>radius)continue;if(e.state!=='combat')changed=true;e.state='combat';e.suspicion=1;e.last={x:source.x,y:source.y};e.lost=0;}
  if(changed){if(alert<=0)stats.alarms++;alert=10;game.audio.sfx('alert');}trace=Math.min(100,trace+10);
 }
 function noise(pos,radius){for(const e of enemies){if(e.dead||e.state==='combat'||dist(e,pos)>radius)continue;e.state='search';e.last={x:pos.x,y:pos.y};e.lost=0;e.wait=0;e.suspicion=Math.max(e.suspicion,.28);}}
 function neutralize(e,lethal){
  if(e.dead)return;e.dead=true;e.hp=0;e.state='dead';e.deadTime=0;e.wind=0;e.vx=e.vy=0;e.lethal=lethal;
  if(lethal)stats.kills++;else stats.nonlethal++;game.particles.sparks(e.x,e.y,22,5,null,{color:lethal?'#ffb684':'#68f0d0'});
  note((lethal?'Eliminated ':'Disabled ')+e.name.toLowerCase()+'.');
 }
 function damage(b,t){
  if(t===player){if(invincible>0||dashing>0)return;const dmg=b.dmg*(prefs.assist?.55:1);player.hp=Math.max(0,player.hp-dmg);stats.damage+=dmg;hurt=.24;invincible=.28;game.shake(1.3);game.audio.sfx('hit');if(upload){upload=null;toast('UPLOAD INTERRUPTED');}if(player.hp<=0)die();return;}
  stats.hits++;t.hp-=b.dmg;t.hurt=.18;game.particles.text(t.x,t.y,36,Math.round(b.dmg),'#e2f6e9',{bounce:true});game.particles.sparks(t.x,t.y,20,4,null,{color:'#baffdf'});
  if(t.kind==='camera'){if(t.hp<=0){t.dead=true;t.off=99999;toast('CAMERA DISABLED');}noise(t,65);return;}
  if(t.hp<=0){neutralize(t,true);game.audio.sfx('down');game.freeze(.025);}else{raiseAlarm(t,85);t.stun=.13;}
 }
 function getTarget(list,radius=32,range=270){
  const m=game.input.mouseScreen();if(!m)return null;let pick=null,dmin=radius;
  for(const o of list){if(o.dead||o.used||dist(o,player)>range)continue;const p=game.view.p(o.x,o.y,o.kind==='camera'?37:o.kind==='guard'?23:22);const d=Math.hypot(m[0]-p[0],m[1]-p[1]);if(d<dmin){pick=o;dmin=d;}}
  return pick;
 }
 function fire(){
  if(fireWait>0||reloading>0||scan||mode!=='play')return;
  if(player.ammo<=0){reload();return;}
  const target=aimTarget;const tip=rig.tip();const start={x:tip[0],y:tip[1],z:Math.max(player.crouch?14:23,tip[2])};
  if(!E.clearSight(map,{...player,z:start.z},start)){game.audio.sfx('deny');return;}
  const ground=game.mouseGround(),tx=target?target.x:ground?ground[0]:player.x+Math.cos(lastFacing)*300,ty=target?target.y:ground?ground[1]:player.y+Math.sin(lastFacing)*300;
  const a=Math.atan2(ty-start.y,tx-start.x),d=Math.max(1,Math.hypot(tx-start.x,ty-start.y));
  shots.fire({x:start.x,y:start.y,z:start.z,vx:Math.cos(a)*310,vy:Math.sin(a)*310,vz:target?((target.kind==='camera'?39:21)-start.z)/d*310:0,r:2,dmg:(loadout==='striker'?33:25)+(upgrade==='cycle'?6:0),life:1.4,team:'player',color:'#98ffe0',onWall:b=>noise(b,42)});
  player.ammo--;stats.shots++;fireWait=.205;rig.kick(-2);game.audio.sfx('coil');game.shake(.38);noise(player,loadout==='ghost'?30:50);game.particles.sparks(start.x,start.y,start.z,3,a,{color:'#caffcb'});
 }
 function reload(){if(reloading>0||player.ammo===12)return;reloading=upgrade==='cycle'?.65:1.25;game.audio.sfx('reload');}
 function heal(){if(healWait>0){toast('RESTORE READY IN '+Math.ceil(healWait)+' S');return;}if(player.hp>=player.maxHp){toast('VITALS ARE FULL');return;}player.hp=Math.min(player.maxHp,player.hp+45);healWait=20;game.audio.sfx('heal');game.particles.text(player.x,player.y,35,'+45','#68f0d0');toast('VITALS RESTORED');}
 function dash(){if(dashWait>0||dashing>0)return;dashVector=lastMove[0]||lastMove[1]?lastMove:[Math.cos(lastFacing),Math.sin(lastFacing)];dashing=.16;dashWait=3.2;invincible=.2;game.audio.sfx('dash');if(upgrade==='echo')for(const e of enemies)if(!e.dead&&dist(e,player)<45)e.blind=Math.max(3,e.blind);}
 function toggleScan(){if(mode!=='play'||game.paused)return;scan=!scan;game.timeScale=scan?.23:1;if(scan){game.audio.sfx('link');pingTime=Math.max(pingTime,2);}else upload=null;updateHud();}
 function hack(kind){
  if(!scan||mode!=='play'||upload)return;const costs={jam:3,overload:5,ping:2},cost=costs[kind];if(!cost)return;
  if(player.ram<cost){toast('NOT ENOUGH RAM');game.audio.sfx('deny');return;}
  const target=hackTarget;
  if(kind!=='ping'&&(!target||target.dead||target.used)){toast('AIM NEAR A GUARD OR DEVICE');return;}
  if(kind!=='ping'&&(dist(player,target)>220||!E.clearSight(map,{...player,z:30},{...target,z:target.kind==='camera'?41:30}))){toast('NO CLEAR NETWORK LINK');game.audio.sfx('deny');return;}
  player.ram-=cost;upload={kind,target,remaining:loadout==='breach'?.55:.95,total:loadout==='breach'?.55:.95};game.audio.sfx('link');
 }
 function finishHack(h){
  stats.hacks++;game.audio.sfx('upload');const o=h.target;pingTime=Math.max(pingTime,7);
  if(h.kind==='ping'){pingTime=15;toast('NETWORK REVEALED / 15 S');return;}
  if(!o||o.dead)return;
  if(h.kind==='jam'){
   if(o.kind==='guard'){o.blind=9;o.wind=0;toast('OPTICS JAMMED / 9 S');}
   else if(o.kind==='camera'){o.off=15;toast('CAMERA JAMMED / 15 S');}
   else{noise(o,110);toast('DEVICE SIGNAL / PATROL DISTRACTED');}
  }else{
   trace=Math.min(100,trace+24);
   if(o.kind==='guard'){o.hp-=80;o.stun=2;o.wind=0;if(o.hp<=0)neutralize(o,false);else{o.blind=3;noise(o,70);}toast('NEURAL OVERLOAD');}
   else if(o.kind==='camera'){o.dead=true;o.off=99999;toast('CAMERA DISABLED');}
   else if(o.id==='battery'){o.used=true;o.active=false;cameras[0].off=99999;for(const e of enemies){if(!e.dead&&dist(e,o)<80){e.hp-=90;e.stun=5;e.blind=5;if(e.hp<=0)neutralize(e,false);}}game.particles.explosion(o.x,o.y,15,1,{debris:['#68f0d0','#294658'],flash:false});game.shake(2);noise(o,160);toast('GRID OVERLOAD / YARD CAMERA OFF');}
   else if(o.id==='junction'||o.id==='service'){openDoor('service');objects.find(p=>p.id==='junction').used=true;cameras[0].off=99999;toast('SERVICE DOOR OPEN');}
   else if(o.id==='front'){openDoor('front');toast('FREIGHT GATE OPEN');}
   else if(o.id==='security'){o.used=true;openDoor('vault');cameras.forEach(c=>c.off=99999);toast('ARCHIVE UNLOCKED / CAMERAS OFF');}
  }
  game.particles.sparks(o.x,o.y,25,12,null,{color:'#68f0d0'});
  if(trace>=100){trace=0;raiseAlarm(player,260);toast('TRACE COMPLETE / LOCATION EXPOSED');}
 }
 function updateEnemy(e,dt){
  e.hurt=Math.max(0,e.hurt-dt);e.blind=Math.max(0,e.blind-dt);e.stun=Math.max(0,e.stun-dt);e.fire=Math.max(0,e.fire-dt);e.vx=e.vy=0;
  if(e.dead){e.deadTime+=dt;e.rig.update(dt,{...e,pose:'die',point:false});return;}
  const see=grace<=0&&e.blind<=0&&e.stun<=0&&stage>0&&sight(e,player,e.elite?157:140,e.state==='combat'?1.4:.64);
  if(see){
   e.lost=0;e.last={x:player.x,y:player.y};e.suspicion=Math.min(1,e.suspicion+dt*(player.crouch?(loadout==='ghost'?.38:.54):.95)*(dist(e,player)<40?2.5:1));
   if(e.suspicion>=1&&e.state!=='combat')raiseAlarm(e,75);
   if(e.state==='patrol'&&e.suspicion>.1)e.state='suspicious';
  }else{e.lost+=dt;e.suspicion=Math.max(0,e.suspicion-dt*.20);if(e.state==='suspicious'&&e.suspicion<=0)e.state='patrol';}
  let target=null,speed=0;
  if(e.blind>0||e.stun>0){e.wind=0;}
  else if(e.state==='combat'){
   if(e.lost>5){e.state='search';e.suspicion=.35;e.wind=0;}
   else{
    e.facing=E.lerpAng(e.facing,Math.atan2(e.last.y-e.y,e.last.x-e.x),Math.min(1,dt*9));
    const clear=E.clearSight(map,{...e,z:26},{...player,z:player.crouch?12:23});
    if(dist(e,player)>90||!clear){target=e.last;speed=42;}
    if(clear&&dist(e,player)<190&&e.fire<=0&&grace<=0){
     if(e.wind<=0)e.wind=.56;
     else{e.wind-=dt;if(e.wind<=dt){
      const tip=e.rig.tip(),d=Math.max(1,dist(e,player)),ang=Math.atan2(player.y-e.y,player.x-e.x)+(Math.random()-.5)*.08;
      shots.fire({x:tip[0],y:tip[1],z:26,vx:Math.cos(ang)*145,vy:Math.sin(ang)*145,vz:((player.crouch?13:22)-26)/d*145,r:1.8,dmg:e.elite?13:10,team:'enemy',color:'#ff9576',life:1.8});e.fire=e.elite?1.35:1.85;e.wind=0;e.rig.kick(-2);game.audio.sfx('enemycoil');
     }}
    }else e.wind=0;
   }
  }else if(e.state==='search'){
   if(dist(e,e.last)>10){target=e.last;speed=30;}else{e.facing+=dt*.8;if(e.lost>7)e.state='patrol';}
  }else if(e.state==='suspicious'){e.facing=E.lerpAng(e.facing,Math.atan2(player.y-e.y,player.x-e.x),dt*2);}
  else{
   target=e.patrol[e.pi];speed=21;
   if(dist(e,target)<7){e.wait+=dt;speed=0;if(e.wait>.8){e.pi=(e.pi+1)%e.patrol.length;e.wait=0;}}
   if(stage>0&&grace<=0&&!e.seenBody){const body=enemies.find(v=>v.dead&&dist(e,v)<65&&sight(e,v,70,.9));if(body){e.seenBody=true;e.state='search';e.last={x:body.x,y:body.y};e.lost=0;note(e.name+' found a disabled guard.');}}
  }
  if(target&&speed>0){e.nav.update(target.x,target.y);const d=e.nav.dir(e.x,e.y,target.x,target.y);e.vx=d[0]*speed;e.vy=d[1]*speed;if(e.state!=='combat')e.facing=E.lerpAng(e.facing,Math.atan2(d[1],d[0]),Math.min(1,dt*4));e.update(dt,map);}
  if(dist(e,player)<9&&e.stun<=0){const a=Math.atan2(e.y-player.y,e.x-player.x);e.x=player.x+Math.cos(a)*9;e.y=player.y+Math.sin(a)*9;map.collide(e);}
  e.rig.update(dt,{...e,point:e.state==='combat',pose:e.stun>0?'kneel':e.blind>0?'guard':null,stance:e.state==='combat'?'ready':null,hurt:e.hurt>0});
 }
 function update(dt){
  const realDt=dt/Math.max(.01,game.timeScale);time+=dt;
  if(mode==='menu'){for(const c of civilians)c.rig.update(dt,{...c});return;}
  if(mode!=='play')return;elapsed+=realDt;
  for(const k of ['x','y'])if(!Number.isFinite(player[k]))Object.assign(player,L.spawn);
  fireWait=Math.max(0,fireWait-dt);hurt=Math.max(0,hurt-dt);invincible=Math.max(0,invincible-dt);grace=Math.max(0,grace-dt);healWait=Math.max(0,healWait-dt);dashWait=Math.max(0,dashWait-dt);dashing=Math.max(0,dashing-dt);pingTime=Math.max(0,pingTime-dt);alert=Math.max(0,alert-dt);trace=Math.max(0,trace-dt*1.5);
  player.ram=Math.min(player.maxRam,player.ram+dt*(loadout==='breach'?.70:.48));
  if(reloading>0){reloading-=dt;if(reloading<=0){player.ammo=12;game.audio.sfx('reload');}}
  if(upload){upload.remaining-=realDt;if(upload.remaining<=0){const h=upload;upload=null;finishHack(h);}}
  toastLeft-=realDt;if(toastLeft<=0)$('toast').classList.remove('on');commsLeft-=realDt;if(commsLeft<=0)$('comms').hidden=true;
  const input=game.input;
  if(input.pressed('map')){showMap();return;}if(input.pressed('journal')){journal();return;}
  if(input.pressed('scan'))toggleScan();if(input.pressed('crouch'))player.crouch=!player.crouch;
  if(input.pressed('reload'))reload();if(input.pressed('heal'))heal();if(input.pressed('dash'))dash();
  if(input.pressed('hack1'))hack('jam');if(input.pressed('hack2'))hack('overload');if(input.pressed('hack3'))hack('ping');
  if(input.pressed('interact')){interact();if(game.paused)return;}
  const [sx,sy]=input.move();let [dx,dy]=game.view.screenDirToGround(sx,sy);if(dx||dy)moveGoal=null;else if(moveGoal){if(dist(player,moveGoal)<5)moveGoal=null;else{moveNav.update(moveGoal.x,moveGoal.y);[dx,dy]=moveNav.dir(player.x,player.y,moveGoal.x,moveGoal.y);}}if(dx||dy)lastMove=[dx,dy];
  const speed=player.crouch?35:68;player.vx=dashing>0?dashVector[0]*255:dx*speed;player.vy=dashing>0?dashVector[1]*255:dy*speed;player.update(dt,map);
  aimTarget=getTarget([...enemies,...cameras],30,360);
  if(input.lastDevice!=='keyboard'&&!input.mouse.active){const targets=enemies.filter(e=>!e.dead&&dist(e,player)<150&&E.clearSight(map,{...player,z:25},{...e,z:23}));aimTarget=targets.sort((a,b)=>dist(a,player)-dist(b,player))[0]||null;}
  const mouse=game.mouseGround();if(aimTarget)lastFacing=Math.atan2(aimTarget.y-player.y,aimTarget.x-player.x);else if(mouse)lastFacing=Math.atan2(mouse[1]-player.y,mouse[0]-player.x);else if(dx||dy)lastFacing=Math.atan2(dy,dx);player.facing=lastFacing;
  rig.update(dt,{...player,facing:lastFacing,point:!reloading,stance:'ready',pose:reloading?'kneel':player.crouch?'crouch':upload?'cast':null,hurt:hurt>0,dash:dashing>0});
  if(input.down('attack'))fire();
  stepWait-=dt;if((dx||dy)&&stepWait<=0&&!player.crouch){game.audio.sfx('step');stepWait=.3;}
  for(const e of enemies)updateEnemy(e,dt);
  for(const c of cameras){c.off=Math.max(0,c.off-dt);c.facing=c.base+Math.sin(time*.4+c.x)*.65;c.active=!c.dead&&c.off<=0;c.hostile=c.active;
   if(c.active&&stage>0&&grace<=0&&sight(c,player,150,.58)){c.suspicion=Math.min(1,c.suspicion+dt*(player.crouch?.5:.8));if(c.suspicion>=1){raiseAlarm(player,190);c.suspicion=0;}}else c.suspicion=Math.max(0,c.suspicion-dt*.35);
  }
  shots.updateSwept(dt,map,[player,...enemies,...cameras],damage);
  for(const c of civilians)c.rig.update(dt,{...c,pose:alert>0?'crouch':c.pose});
  if(stage===1&&player.x>18.7*16&&player.x<42*16&&player.y<19.5*16&&player.y>6.5*16){stage=2;if(!entered){entered=true;note('Entered the Ninth Relay.');saveCheckpoint('Inside the relay');comm('The core is behind the inner door. The security console can open it. Check the archive before you send it.');}}
  if(stage>0&&!flags.market&&player.y<30*16){flags.market=true;comm('There is an implant bench by the market. One slot. Pick the tool that suits your route.');}
  if(stage>0&&!flags.duct&&player.y<6*16){flags.duct=true;comm('You found the old maintenance path. The duct is on the north wall. Crouch before you enter.');}
  if(stage>0&&!flags.scanHint&&enemies.some(e=>!e.dead&&dist(player,e)<130)){flags.scanHint=true;toast('Q / SCAN · 1 / JAM · 2 / OVERLOAD · 3 / PING',7);}
  if(stage===3&&choice==='seal'&&input.down('attack')){grace=0;toast('EXIT PASS REVOKED / WEAPON DISCHARGE');note('Exit pass revoked after weapon fire.');}
  near=findInteraction();if(scan){const candidates=[...enemies,...cameras,...objects.filter(o=>['battery','junction','door','security'].includes(o.kind)&&!o.used)];const t=getTarget(candidates,65,220);if(t)hackTarget=t;else if(hackTarget&&(hackTarget.dead||hackTarget.used||dist(hackTarget,player)>230))hackTarget=null;}
  hudWait-=realDt;if(hudWait<=0){updateHud();hudWait=.075;}
 }
 function drawVision(r,e,isCamera=false){
  if(e.dead||e.off>0||e.blind>0||e.stun>0)return;
  const length=isCamera?150:(e.elite?157:140),half=isCamera?.58:.64;const points=[r.w(e.x,e.y,1)];
  for(let i=0;i<=18;i++){const a=e.facing-half+2*half*i/18;let reach=length;for(let d=5;d<length;d+=5)if(map.heightAt(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d)>(player.crouch?12:25)){reach=d;break;}points.push(r.w(e.x+Math.cos(a)*reach,e.y+Math.sin(a)*reach,1));}
  r.decal(()=>px.polyDither(r.tgt,points,e.suspicion>.15?'#ff7b5d':isCamera?'#ebc777':'#629c9d',scan?.13:.045,r.ix,r.iy));
 }
 function drawMap(canvas,large=false){
  if(!canvas||!map)return;const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height,s=Math.min((w-14)/L.W,(h-14)/L.H),ox=(w-L.W*s)/2,oy=(h-L.H*s)/2;
  g.fillStyle='#07111b';g.fillRect(0,0,w,h);
  for(let y=0;y<L.H;y++)for(let x=0;x<L.W;x++){const i=y*L.W+x;if(map.blocked[i])continue;g.fillStyle=map.cells[i]?'#47616e':map.floorTags[i]==='interior'?'#213a49':'#172f3c';g.fillRect(ox+x*s,oy+y*s,Math.ceil(s),Math.ceil(s));}
  const dot=(o,c,size)=>{g.fillStyle=c;g.fillRect(ox+o.x/16*s-size/2,oy+o.y/16*s-size/2,size,size);};
  if(large||scan||pingTime>0){enemies.filter(e=>!e.dead).forEach(e=>dot(e,e.state==='combat'?'#ff795d':'#b27468',large?6:3));cameras.filter(c=>!c.dead&&c.off<=0).forEach(c=>dot(c,'#ffb46c',large?5:2));}
  const target=objects.find(o=>o.id===(stage===0?'contact':stage===3?'extract':'core'));if(target)dot(target,'#dfff6e',large?9:4);
  if(large){for(const id of ['junction','vent','front']){const o=objects.find(o=>o.id===id);dot(o,'#68f0d0',7);}g.font='12px ui-monospace,monospace';g.fillStyle='#8eb8c5';g.fillText('NORTH DUCT',ox+27*s,oy+1*s);g.fillText('SERVICE',ox+1*s,oy+12*s);g.fillText('FREIGHT YARD',ox+26*s,oy+30*s);g.fillText('DOCK / EXTRACTION',ox+1*s,oy+39*s);}
  dot(player,'#7affdf',large?9:4);const pxm=ox+player.x/16*s,pym=oy+player.y/16*s;g.strokeStyle='#7affdf';g.lineWidth=large?2:1;g.beginPath();g.moveTo(pxm,pym);g.lineTo(pxm+Math.cos(lastFacing)*(large?13:6),pym+Math.sin(lastFacing)*(large?13:6));g.stroke();
 }
 function updateHud(){
  if(!player)return;const ob=objective();$('objective').textContent=ob[0];$('objective-detail').textContent=ob[1];
  const zone=player.y<6*16?'NORTH MAINTENANCE':player.x>33*16&&player.y<17*16?'MEMORY ARCHIVE':player.x>18*16&&player.y<20*16?'NINTH RELAY':player.x>18*16?'FREIGHT YARD':player.y<18*16?'SERVICE LINE':player.y<31*16?'LOW TIDE MARKET':'LOWER WATERFRONT';$('zone-name').textContent=zone;
  $('state-label').textContent=stage===3&&choice==='seal'&&grace>0?'EXIT PASS VALID':alert>0?'HOSTILE SIGNAL':scan?'SCANNER ACTIVE':player.crouch?'LOW PROFILE':'SIGNAL CLEAR';$('state-label').style.color=alert>0?'#ff765e':'#68f0d0';
  $('health-number').textContent=Math.ceil(player.hp)+' / '+player.maxHp;$('health-fill').style.width=(player.hp/player.maxHp*100)+'%';$('health-fill').style.background=player.hp<35?'#ff765e':'#68f0d0';
  $('ram-number').textContent=Math.floor(player.ram)+' / '+player.maxRam;const pips=$('ram-pips');if(pips.children.length!==player.maxRam)pips.innerHTML='<i></i>'.repeat(player.maxRam);[...pips.children].forEach((p,i)=>p.style.opacity=E.clamp(player.ram-i,.12,1));
  $('ammo').textContent=reloading>0?'--':String(player.ammo).padStart(2,'0');$('weapon-state').textContent=reloading>0?'RELOADING / '+Math.max(0,reloading).toFixed(1)+' S':player.ammo===0?'EMPTY / PRESS R':upgrade==='cycle'?'FAST CYCLE · READY':'SUPPRESSED · READY';
  $('scan-button').classList.toggle('active',scan);$('crouch-button').classList.toggle('active',player.crouch);$('dash-cool').style.width=(1-dashWait/3.2)*100+'%';$('heal-cool').style.width=(1-healWait/20)*100+'%';$('dash-button').title=dashWait>0?'Dash ready in '+Math.ceil(dashWait)+' s':'Dash (Space)';$('heal-button').title=healWait>0?'Restore ready in '+Math.ceil(healWait)+' s':'Restore health (F)';
  const suspicion=Math.max(0,...enemies.map(e=>e.dead?0:e.suspicion),...cameras.map(c=>c.off>0?0:c.suspicion));$('alert-meter').hidden=suspicion<.06&&trace<5&&alert<=0;$('alert-label').textContent=alert>0?'COMBAT':suspicion>.1?'DETECTION':'TRACE';$('alert-fill').style.width=(alert>0?100:Math.max(suspicion*100,trace))+'%';
  $('interaction').hidden=!near||scan||!$('modal').hidden;if(near){$('interaction-title').textContent=near.kind==='guard'?'Silent takedown':near.name;$('interaction-desc').textContent=near.kind==='guard'?'Disable guard. Recover 2 RAM.':near.desc;}
  $('hack-panel').hidden=!scan;$('hack-target').textContent=hackTarget?hackTarget.name.toUpperCase():'NO TARGET';$('hack-description').textContent=hackTarget?hackTarget.kind==='guard'?'Neural link · '+Math.ceil(hackTarget.hp)+' HP · '+(hackTarget.blind>0?'OPTICS OFF':hackTarget.state.toUpperCase()):hackTarget.desc:'Aim near a guard or device. Ping works without a target.';
  $('hack-progress').textContent=upload?'UPLOADING '+Math.round((1-upload.remaining/upload.total)*100)+'%':trace>5?'NETWORK TRACE / '+Math.round(trace)+'%':'TIME DILATION / 23%';
  document.querySelectorAll('[data-hack]').forEach(b=>{const costs={jam:3,overload:5,ping:2};b.disabled=!!upload||player.ram<costs[b.dataset.hack]||(b.dataset.hack!=='ping'&&!hackTarget);});drawMap($('minimap'));
 }
 function draw(r){
  recordFrame();
  if(!map)return;
  map.drawFloor(r);
  // Floor circuits, route markings, dock and extraction platform.
  r.decal(()=>{
   const line=(x1,y1,x2,y2,c,w=1)=>{const a=r.w(x1,y1,1),b=r.w(x2,y2,1);px.line(r.tgt,a[0],a[1],b[0],b[1],c,w);};
   line(5*16,4*16,40*16,4*16,'#347c79');line(5*16,4*16,5*16,30*16,'#347c79');line(5*16,15.5*16,18*16,15.5*16,'#4d8c7d');
   line(19*16,21*16,42*16,21*16,'#849960');line(19*16,32*16,41*16,32*16,'#777857');
   r.groundRing(objects[7].x,objects[7].y,25,'#a2cc79',.65);r.groundRing(objects[7].x,objects[7].y,27,'#638365',.5);
   const a=r.w(30.5*16,28*16,1);E.font.text(r.tgt,'09',a[0],a[1],'#687559',{scale:3,align:'center',outline:false});
   for(const e of enemies)if(e.dead)r.groundDisc(e.x,e.y,9,e.lethal?'#482f3c':'#223e45',.55);
  });
  for(const e of enemies)if((scan||e.suspicion>.02||dist(e,player)<170)&&stage>0)drawVision(r,e);
  for(const c of cameras)if((scan||dist(c,player)<200)&&stage>0)drawVision(r,c,true);
  map.queueWalls(r);
  game.lights.add(player.x,player.y,18,90,.40,{color:scan?'#5dedc6':'#67b1cc'});
  A.drawDecor(r,decor,time);
  for(const o of objects){A.drawProp(r,{...o,active:!o.used,reducedMotion:prefs.reduced},time);if(o.kind==='shard'&&!o.used){r.decal(()=>r.groundRing(o.x,o.y,7,'#b0bbff',.5));}}
  for(const c of cameras)A.drawProp(r,{...c,orientation:Math.floor(c.facing/(Math.PI/2)),active:!c.dead&&c.off<=0},time);
  for(const c of civilians){r.shadow(c.x,c.y,6,.3);r.actor(c.x,c.y,0,(g,x,y)=>c.rig.draw(g,x,y,r.view),{outline:false,rim:false});}
  for(const e of enemies){
   const visible=scan||pingTime>0||dist(e,player)<260;
   r.shadow(e.x,e.y,e.dead?9:6,.4);r.actor(e.x,e.y,0,(g,x,y)=>e.rig.draw(g,x,y,r.view),{outline:e.elite?'#7a655f':false,rim:false,flash:e.hurt>0?'#ddfff6':null,xray:visible&&!e.dead&&(scan||pingTime>0)?{color:'#ff9278',outline:'#07121c'}:null});
   if(!e.dead&&(e.suspicion>.04||scan||e===aimTarget||e.blind>0))r.overlay(g=>{
    const p=r.w(e.x,e.y,42);if(p[0]<0||p[0]>r.W||p[1]<0||p[1]>r.H)return;
    const color=e.blind>0?'#68f0d0':e.state==='combat'?'#ff795d':'#f3be7d';
    if(scan||e===aimTarget){px.rect(g,p[0]-12,p[1]+3,24,2,'#273e4a');px.rect(g,p[0]-12,p[1]+3,24*Math.max(0,e.hp/e.maxHp),2,color);}
    E.font.text(g,e.blind>0?'JAMMED':e.state==='combat'?'!':e.suspicion>.1?'?':e.elite?'WARDEN':'LINK',p[0],p[1]-7,color,{align:'center',outline:'#07121c'});
   });
   if(e.wind>0)r.decal(()=>{const a=r.w(e.x,e.y,1),b=r.w(player.x,player.y,1);px.blend(r.tgt,.45,'normal',()=>px.line(r.tgt,a[0],a[1],b[0],b[1],'#ff9b73'));});
  }
  r.shadow(player.x,player.y,7,.45);r.actor(player.x,player.y,player.z,(g,x,y)=>rig.draw(g,x,y,r.view),{outline:true,outlineColor:'#082027',rim:false,flash:hurt>0?'#ffdfd0':null,ghost:dashing>0,xray:{color:'#68f0d0',outline:'#07121c'}});
  r.decal(()=>r.groundRing(player.x,player.y,7.5,'#68f0d0',.55));if(moveGoal)r.decal(()=>r.groundRing(moveGoal.x,moveGoal.y,4,'#c4eee1',.45));shots.draw(r);
  if(stage===0){const o=objects.find(o=>o.id==='contact');A.waypoint(r,o.x,o.y,'CONNECT / E',time,{color:'#dfff6e',z:30});}
  if(stage===1){const o=objects.find(o=>o.id==='front');A.waypoint(r,o.x,o.y,'RELAY',time,{color:'#dfff6e',z:32});}
  if(stage===2){const o=objects.find(o=>o.id==='core');A.waypoint(r,o.x,o.y,'ARCHIVE',time,{color:'#dfff6e',z:70});}
  if(stage===3){const o=objects.find(o=>o.id==='extract');A.waypoint(r,o.x,o.y,'EXTRACT / E',time,{color:'#dfff6e',z:28});}
  if(scan&&hackTarget)r.overlay(g=>{
   const p=r.w(hackTarget.x,hackTarget.y,25);const color='#68f0d0';for(const[a,b]of [[-1,-1],[1,-1],[-1,1],[1,1]]){px.line(g,p[0]+a*17,p[1]+b*20,p[0]+a*10,p[1]+b*20,color);px.line(g,p[0]+a*17,p[1]+b*20,p[0]+a*17,p[1]+b*13,color);}
   if(upload){const q=r.w(player.x,player.y,24);px.blend(g,.55,'normal',()=>px.line(g,q[0],q[1],p[0],p[1],color));}
  });
  A.rain(r,time,prefs.reduced);
  r.overlay(g=>{
   if(scan)px.blend(g,.07,'normal',()=>px.rect(g,0,0,r.W,r.H,'#4eeacb'));
   if(hurt>0&&!prefs.reduced){px.blend(g,hurt*.7,'normal',()=>px.rect(g,0,0,r.W,r.H,'#ff574e'));}
   if(mode==='play'){
    const target=stage===0?objects[0]:stage===3?objects.find(o=>o.id==='extract'):objects.find(o=>o.id==='core');const p=r.w(target.x,target.y,20),x=E.clamp(p[0],22,r.W-22),y=E.clamp(p[1],40,r.H-62);
    if(p[0]!==x||p[1]!==y){px.poly(g,[[x,y-4],[x+4,y],[x,y+4],[x-4,y]],'#dfff6e');E.font.text(g,Math.round(dist(player,target)/16)+'M',x,y+7,'#dfff6e',{align:'center',outline:'#07121c'});}
   }
  });
 }
 function snapshot(){return{mode,paused:game.paused,stage,interaction:near?.id||null,hackTarget:hackTarget?.id||null,objective:objective()[0],position:{x:Math.round(player.x),y:Math.round(player.y)},health:Math.round(player.hp),ram:Math.round(player.ram*10)/10,ammo:player.ammo,scan,loadout,upgrade,choice,checkpoint:checkpointName,elapsed:Math.round(elapsed),doors:Object.fromEntries(Object.keys(L.doors).map(k=>[k,isOpen(k)])),stats:{...stats},enemies:enemies.map(e=>({id:e.id,hp:e.hp,state:e.state,blind:Math.round(e.blind),x:Math.round(e.x),y:Math.round(e.y)})),cameras:cameras.map(c=>({id:c.id,hp:c.hp,off:c.off>0,dead:c.dead})),errors:game.errors.map(e=>String(e)),fps:game.fps};}
 // Public, read-only diagnostics are useful when reporting a problem.
 window.StaticVeil={version:'1.0.0',snapshot};
 let webContext=document.modelContext||navigator.modelContext;try{webContext=window.parent.document.modelContext||window.parent.navigator.modelContext||webContext;}catch(_){}
 if(webContext?.registerTool){
  const lifetime=new AbortController();addEventListener('pagehide',()=>lifetime.abort(),{once:true});
  for(const tool of [
   {name:'read_mission_status',title:'Read mission status',description:'Read the current Static Veil objective, resources, checkpoint, and completion state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');return snapshot();}},
   {name:'pause_mission',title:'Pause mission',description:'Pause the running Static Veil mission and show its pause panel.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');if(mode!=='play')throw new Error('No mission is running.');if($('modal').hidden)pause();return{paused:game.paused,objective:objective()[0]};}},
   {name:'move_player',title:'Move player',description:'Hold the normal movement controls for 0.05 to 2 seconds. Directions are screen directions, like W A S D. Collision, detection, damage, and mission rules remain active.',inputSchema:{type:'object',properties:{horizontal:{type:'integer',minimum:-1,maximum:1},vertical:{type:'integer',minimum:-1,maximum:1},seconds:{type:'number',minimum:.05,maximum:2}},required:['horizontal','vertical','seconds'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(v){if(!v||Object.keys(v).some(k=>!['horizontal','vertical','seconds'].includes(k))||![-1,0,1].includes(v.horizontal)||![-1,0,1].includes(v.vertical)||!Number.isFinite(v.seconds)||v.seconds<.05||v.seconds>2)throw new Error('Use directions -1, 0, or 1 and a duration from 0.05 to 2 seconds.');if(mode!=='play'||game.paused)throw new Error('Resume the mission before moving.');const keys=[];if(v.horizontal)keys.push(v.horizontal>0?'KeyD':'KeyA');if(v.vertical)keys.push(v.vertical>0?'KeyS':'KeyW');keys.forEach(k=>game.input.press(k));try{await new Promise(resolve=>setTimeout(resolve,v.seconds*1000));}finally{keys.forEach(k=>game.input.release(k));}return snapshot();}},
   {name:'use_player_tool',title:'Use player tool',description:'Use an existing player action. For a hack or shot, target_id selects a guard, camera, or device in range. The action uses the same costs, sight checks, and cooldowns as the game controls. It never moves or grants items.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['interact','scan','crouch','dash','heal','reload','jam','overload','ping','fire']},target_id:{type:'string'}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},async execute(v){if(!v||Object.keys(v).some(k=>!['action','target_id'].includes(k))||!['interact','scan','crouch','dash','heal','reload','jam','overload','ping','fire'].includes(v.action))throw new Error('Unknown player action.');if(mode!=='play'||game.paused)throw new Error('Resume the mission before using a tool.');if(v.target_id){const target=[...enemies,...cameras,...objects].find(o=>o.id===v.target_id);if(!target||target.dead||dist(target,player)>360)throw new Error('Target is unavailable or out of range.');const p=game.view.p(target.x,target.y,target.kind==='camera'?37:23);const rect=game.screen.canvas.getBoundingClientRect();game.input.mouse.cx=rect.left+(p[0]-game.screen.ix)*game.screen.S/game.screen.dpr+game.screen.OX/game.screen.dpr;game.input.mouse.cy=rect.top+(p[1]-game.screen.iy)*game.screen.S/game.screen.dpr+game.screen.OY/game.screen.dpr;game.input.mouse.active=true;hackTarget=target;aimTarget=target;lastFacing=Math.atan2(target.y-player.y,target.x-player.x);rig.update(.001,{...player,facing:lastFacing,point:true});}if(v.action==='interact')interact();else if(v.action==='scan')toggleScan();else if(v.action==='crouch')player.crouch=!player.crouch;else if(v.action==='dash')dash();else if(v.action==='heal')heal();else if(v.action==='reload')reload();else if(v.action==='fire')fire();else hack(v.action);await new Promise(resolve=>requestAnimationFrame(resolve));return snapshot();}}
  ])try{Promise.resolve(webContext.registerTool(tool,{signal:lifetime.signal})).catch(()=>{});}catch(_){}
 }
 $('screen').addEventListener('pointerdown',e=>{if(e.button!==2||mode!=='play'||game.paused)return;const p=game.mouseGround();if(!p)return;const [cx,cy]=map.toCell(...p);if(map.walkable(cx,cy)){moveGoal={x:p[0],y:p[1]};}else{let nearest=null,best=Infinity;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(!map.walkable(cx+dx,cy+dy))continue;const q=wpos(cx+dx,cy+dy),d=Math.hypot(q.x-p[0],q.y-p[1]);if(d<best){best=d;nearest=q;}}moveGoal=nearest;}});
 document.querySelectorAll('[data-rig]').forEach(b=>b.onclick=()=>{loadout=b.dataset.rig;document.querySelectorAll('[data-rig]').forEach(el=>el.classList.toggle('selected',el===b));game.audio.sfx('link');});
 $('new-game').onclick=()=>start(false);$('continue-game').onclick=()=>start(true);$('menu-help').onclick=help;$('pause-button').onclick=pause;$('map-button').onclick=showMap;
 $('scan-button').onclick=toggleScan;$('dash-button').onclick=()=>{if(!game.paused)dash();};$('heal-button').onclick=()=>{if(!game.paused)heal();};$('crouch-button').onclick=()=>{if(!game.paused)player.crouch=!player.crouch;};
 document.querySelectorAll('[data-hack]').forEach(b=>b.onclick=()=>hack(b.dataset.hack));
 document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();game.input.press(b.dataset.key);b.setPointerCapture(e.pointerId);};b.onpointerup=b.onpointercancel=()=>game.input.release(b.dataset.key);});
 $('touch-fire').onpointerdown=e=>{e.preventDefault();game.input.mouse.active=false;game.input.lastDevice='touch';game.input.press('Mouse0');};$('touch-fire').onpointerup=$('touch-fire').onpointercancel=()=>game.input.release('Mouse0');$('touch-use').onclick=interact;
 document.addEventListener('keydown',e=>{
  if(e.code==='F3'){e.preventDefault();perfBox.hidden=!perfBox.hidden;}
  if(e.code==='Escape'){e.preventDefault();if(mode==='play')pause();else if(!$('modal').hidden&&modalKind==='help'){if(mode==='dead')deathPanel();else closeModal();}}
  if(e.code==='Enter'&&mode==='menu'&&$('modal').hidden&&e.target.tagName!=='BUTTON'){e.preventDefault();start(false);}
  if(e.key==='Tab'&&!$('modal').hidden){const all=[...$('modal').querySelectorAll('button,input')].filter(el=>!el.disabled);const first=all[0],last=all[all.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play'&&$('modal').hidden)pause();});
 resetState();resetWorld();$('continue-game').hidden=!E.store.get(SAVE);rig.update(.01,{...player,facing:lastFacing,point:true});game.start({update,draw,pausable:false});
})();
