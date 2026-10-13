/* Emberwake: The Silent Bell — game controller, story, interface, and original score. */
(function(){
'use strict';
const E=My3D2dge,A=window.EW,$=id=>document.getElementById(id);
const clone=o=>JSON.parse(JSON.stringify(o));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const show=(id,on=true)=>$(id).classList.toggle('hidden',!on);
const button=(text,act,cls='',disabled=false,extra='')=>'<button data-action="'+act+'" class="'+cls+'" '+(disabled?'disabled ':'')+extra+'>'+text+'</button>';
const KEY='emberwake-v1',PREF='emberwake-options-v1';
let preferences=E.store.get(PREF,{});
const defaultSettings={difficulty:'standard',volume:.6,music:.32,motion:!(matchMedia('(prefers-reduced-motion: reduce)').matches),textSpeed:1,sound:false};
const newState=()=>({version:1,room:'quay',x:92,y:278,flags:{},memories:[],inventory:{kits:3},party:{mira:{hp:210,max:210,ep:32,maxEp:32},oren:{hp:190,max:190,ep:38,maxEp:38}},gear:{hp:600,fuel:100},module:'balanced',elapsed:0,stats:{battles:0,turns:0,finishers:0,breaks:0,retries:0},settings:{...defaultSettings,...preferences},ending:null});
function validSave(s){
 if(!s||s.version!==1||!A.rooms[s.room]||!s.party?.mira||!s.party?.oren||!Array.isArray(s.memories)||!s.inventory||!s.flags||!s.stats||!s.gear)return null;
 const d=newState();
 for(const id of ['mira','oren'])for(const k of ['hp','max','ep','maxEp'])if(!Number.isFinite(s.party[id][k])||s.party[id][k]<0||s.party[id][k]>1000)return null;
 if(!Number.isFinite(s.x)||!Number.isFinite(s.y)||!Number.isFinite(s.elapsed)||s.elapsed<0||s.elapsed>1e7)return null;
 const room=A.rooms[s.room];if(!A.floorAt(room,s.x,s.y)||A.blocked(room,s.x,s.y,4)){s.x=room.start[0];s.y=room.start[1];}
 const out={...d,...s};out.settings={...defaultSettings,...s.settings,...preferences};out.settings.difficulty=['story','standard'].includes(out.settings.difficulty)?out.settings.difficulty:'standard';
 out.memories=s.memories.filter(m=>['quay','hall','hangar'].includes(m));out.inventory.kits=E.clamp(Number(s.inventory.kits)||0,0,30);
 out.module=['balanced','aegis','coil'].includes(s.module)?s.module:'balanced';out.ending=['release','keep'].includes(s.ending)?s.ending:null;
 out.gear.fuel=E.clamp(Number(s.gear.fuel)||0,0,100);out.gear.hp=E.clamp(Number(s.gear.hp)||600,1,680);
 for(const key of Object.keys(d.stats))out.stats[key]=E.clamp(Number(s.stats[key])||0,0,1e6);
 return out;
}
let saved=validSave(E.store.get(KEY,null)),state=saved?clone(saved):newState();
let mode='title',modalOpen=false,modalClose=null,modalClosable=true,dialog=null,near=null,battle=null,battleUnits={},battleEvents=[],currentEvent=null,eventTime=0,battleBusy=false,displayHP={},beforeBattle=null,battleKind='',battleReturn=null,animMessage='',animSub='',fx=[],uiTime=0,stepTime=0,lastControlTime=0,toastTimer=0,chapterTimer=0,transition=false,guideTab='mission',cameFromTitle=false,sequenceIntent=[];
let battleFinished=false,saveWarning=false;
let moveTarget=null,pointerJump=false,blockedTime=0,telemetryTime=0;
const portraitRigs={mira:A.makeHuman('mira'),oren:A.makeHuman('oren'),tala:A.makeHuman('tala'),warden:A.makeHuman('warden'),cantor:A.makeHuman('cantor')};
const hero=A.makeUnit('mira',92,278),companion=A.makeUnit('oren',68,292),tala=A.makeUnit('tala',101,161);
hero.vz=0;hero.lastSafe=[92,278];hero.z=0;
const morrow=new A.Mech('morrow'),cantor=new A.Mech('cantor'),fieldWarden=A.makeUnit('warden',322,181);
const coarse=matchMedia('(pointer: coarse)').matches;
const portrait=()=>innerWidth<=700&&innerHeight>innerWidth;
const game=new E.Game({canvas:$('screen'),res:portrait()?[480,620]:[768,432],fit:'contain',view:new E.View('ember-field','Emberwake',45,32,1.7,1),bg:'#112c37',input:{
 up:['KeyW','ArrowUp','Pad12'],down:['KeyS','ArrowDown','Pad13'],left:['KeyA','ArrowLeft','Pad14'],right:['KeyD','ArrowRight','Pad15'],
 jump:['Space','Pad1'],interact:['KeyE','Pad0'],turnLeft:['KeyQ','Pad4'],turnRight:['KeyR','Pad5'],run:['ShiftLeft','ShiftRight']
}});
game.pauseOverlay=false;game.cam.smooth=.21;
const I=game.input;
function setSettings(){
 game.reduceMotion=!state.settings.motion;game.audio.setVolume(Number(state.settings.volume)||0);
 game.audio.musicVolume=Number(state.settings.music)||0;game.audio.mute(!state.settings.sound);game.audio._levels();
 $('sound-button').textContent=state.settings.sound?'Sound on':'Sound off';
 $('sound-button').setAttribute('aria-pressed',String(state.settings.sound));
}
const score={
 field:{bpm:74,steps:2,tracks:[
  {wave:'sine',vol:.14,notes:'D5 - - - A4 - F5 - | E5 - - - D5 - - - | A4 - C5 - D5 - E5 - | F5 - - - E5 - - - | D5 - A4 - C5 - D5 - | G5 - - - F5 - E5 - | D5 - - - C5 - A4 - | G4 - - - A4 - - -'},
  {wave:'triangle',vol:.075,notes:'D3 - A3 - F4 - A3 - | D3 - A3 - E4 - A3 - | C3 - G3 - E4 - G3 - | C3 - G3 - D4 - G3 - | Bb2 - F3 - D4 - F3 - | Bb2 - F3 - C4 - F3 - | G2 - D3 - A3 - D3 - | A2 - E3 - G3 - E3 -'},
  {wave:'sine',vol:.065,notes:'D2 - - - - - - - | D2 - - - - - - - | C2 - - - - - - - | C2 - - - - - - - | Bb1 - - - - - - - | Bb1 - - - - - - - | G1 - - - - - - - | A1 - - - - - - -'}]},
 battle:{bpm:122,steps:4,tracks:[
  {wave:'triangle',vol:.12,notes:'D3 . D3 A3 . D4 A3 . F3 . A3 . E3 . C4 . | D3 . D3 A3 . D4 A3 . G3 . A3 . C4 . A3 . | Bb2 . F3 . Bb3 . F3 . C3 . G3 . C4 . G3 . | A2 . E3 . A3 . E3 . C#4 . A3 . E3 . A2 .'},
  {wave:'sine',vol:.17,notes:'D5 - . D5 F5 - E5 - D5 - A4 - C5 - E5 - | F5 - - . E5 - D5 - G5 - F5 - E5 - C5 - | D5 - F5 - Bb5 - A5 - G5 - E5 - D5 - C5 - | C#5 - E5 - A5 - - - G5 - E5 - C#5 - - -'},
  {wave:'drums',vol:.085,notes:'k . h . . . h . s . h . k . h . | k . h . k . h h s . h . . h h .'}]},
 boss:{bpm:106,steps:4,tracks:[
  {wave:'triangle',vol:.13,notes:'D2 . D3 D2 . A2 . D3 . D2 . F3 E3 . D3 . | D2 . D3 D2 . A2 . D3 . C3 . Bb2 A2 . G2 . | Bb1 . Bb2 . F2 . Bb2 . C2 . C3 . G2 . C3 . | A1 . A2 . E2 . A2 . C#3 . E3 . A3 . E3 .'},
  {wave:'sine',vol:.13,notes:'D4 - - - F4 - A4 - D5 - - - C5 - A4 - | Bb4 - - - A4 - G4 - F4 - E4 - D4 - - - | F4 - - - Bb4 - - - G4 - - - C5 - - - | E4 - - - A4 - - - C#5 - - - A4 - - -'},
  {wave:'drums',vol:.11,notes:'k . . h . h k . s . . h k . h . | k . h . k . h . s . h h k . h .'}]},
 end:{bpm:68,steps:2,tracks:[
  {wave:'sine',vol:.17,notes:'D5 - F5 - A5 - - - | G5 - F5 - E5 - D5 - | C5 - E5 - G5 - - - | F5 - E5 - D5 - - - | Bb4 - D5 - F5 - - - | G5 - A5 - D6 - - - | C6 - A5 - G5 - F5 - | E5 - - - D5 - - -'},
  {wave:'triangle',vol:.08,notes:'D3 - A3 - F4 - A3 - | D3 - A3 - F4 - A3 - | C3 - G3 - E4 - G3 - | C3 - G3 - E4 - G3 - | Bb2 - F3 - D4 - F3 - | Bb2 - F3 - D4 - F3 - | G2 - D3 - Bb3 - D3 - | D3 - A3 - D4 - - -'}]}
};
game.audio.define('bell',[{wave:'sine',freq:293.66,dur:2.1,vol:.3},{wave:'sine',freq:587.33,dur:1.7,vol:.12},{wave:'triangle',freq:880.1,dur:1.2,vol:.065}]);
game.audio.define('engine',[{wave:'noise',freq:160,to:90,dur:1.1,vol:.25,filter:'lowpass'},{wave:'sine',freq:54,to:78,dur:1.2,vol:.25}]);
game.audio.define('memory',[{wave:'sine',freq:587.33,arp:[0,7,12,14],step:.13,dur:1.2,vol:.25},{wave:'sine',freq:293.66,dur:1.3,vol:.15}]);
setSettings();
function music(name){game.audio.music(score[name]);}
function toast(text,seconds=2.7){$('toast').textContent=text;show('toast');clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),seconds*1000);}
function chapter(title,subtitle){
 $('chapter').innerHTML='<h2>'+title+'</h2><p>'+subtitle+'</p>';show('chapter');clearTimeout(chapterTimer);chapterTimer=setTimeout(()=>show('chapter',false),3100);
}
function saveGame(notice=true){
 if(mode==='field'){state.x=hero.lastSafe[0];state.y=hero.lastSafe[1];}
 const ok=E.store.set(KEY,state);
 if(ok){saved=clone(state);$('saved-note').textContent='Checkpoint saved';setTimeout(()=>$('saved-note').textContent='',3200);if(notice)toast('Checkpoint saved on this device.');}
 else if(!saveWarning){saveWarning=true;toast('This browser cannot save. You can still finish this session.',5);}
 return ok;
}
function savePreferences(){preferences=clone(state.settings);E.store.set(PREF,preferences);setSettings();}
function refreshTitle(){
 $('title').innerHTML='<div class="title-copy"><span class="title-sigil">◇</span><div class="eyebrow">Chapter one</div><h1>EMBERWAKE</h1><div class="title-sub">THE SILENT BELL</div><p class="intro">The city has lost its water.<br>The bell has kept its voices.</p><div class="title-buttons">'+(saved?button(saved.ending?'View your ending':'Continue journey','continue','primary')+button('New journey','new','quiet'):button('Begin journey','new','primary'))+button('World Forge · create & explore','world-forge','quiet')+'</div><p class="title-note">Explore the station. Master a sequence. Wake the machine.</p></div><div class="title-bottom"><span>AN ORIGINAL ROLE-PLAYING ADVENTURE</span><span>One complete chapter<br>Keyboard · Mouse · Touch</span></div>';
}
function changeMode(next){mode=next;moveTarget=null;pointerJump=false;show('title',next==='title');show('hud',next==='field');show('battle',next==='battle');show('touch',next==='field'&&coarse);show('interact',false);}
function fieldView(){
 game.setView(new E.View('ember-field','Emberwake',45,32,state.room==='causeway'?(portrait()?.95:1.3):portrait()?1.5:1.7,1));
 game.yaw=0;game._applyView();game.cam.offset=[0,state.room==='causeway'?45:25];game.cam.snap=true;
}
function placeParty(x,y){
 moveTarget=null;pointerJump=false;blockedTime=0;
 hero.x=x;hero.y=y;hero.z=0;hero.vz=0;hero.vx=hero.vy=0;hero.lastSafe=[x,y];hero.facing=-Math.PI/4;
 companion.x=x-16;companion.y=y+14;companion.z=0;companion.vx=companion.vy=0;
 if(!A.floorAt(A.rooms[state.room],companion.x,companion.y)){companion.x=x;companion.y=y;}
}
function beginNew(){
 if(saved){
  openModal('<div class="modal-heading"><h2>Start a new journey?</h2>'+closeButton()+'</div><p>Your current local checkpoint will be replaced when the new journey starts.</p><div class="modal-actions">'+button('Start new journey','confirm-new','primary')+button('Keep current journey','close','quiet')+'</div>');
 }else confirmNew();
}
function confirmNew(){
 const options=clone(state.settings);closeModal(false);state=newState();dials=[3,2,0];state.settings=options;if(preferences.sound===undefined)state.settings.sound=true;placeParty(92,278);setSettings();music('field');startField(false);
 say([
  ['mira','The canals were full yesterday. Now the whole city is waiting for one drop.'],
  ['oren','The Silent Bell controls the water. Its keepers closed the station at dawn.'],
  ['mira','Then we open it.'],
  ['oren','Stay close, Mira. The bell stores voices. Some of them can still answer.']
 ],()=>{state.flags.intro=true;saveGame(false);chapter('Pilgrim Quay','THE LAST WATER ROAD');showMovementBrief();});
}
function continueGame(){
 if(!saved)return;state=clone(saved);state.settings={...state.settings,...preferences};placeParty(state.x,state.y);setSettings();music(state.ending?'end':'field');
 if(state.ending){changeMode('field');fieldView();showEnding(state.ending,false);}else{startField(false);if(state.flags.boss)endingChoice();else toast('Journey restored from your local checkpoint.');}
}
function startField(save=true){
 changeMode('field');fieldView();battle=null;battleBusy=false;currentEvent=null;fx=[];renderHUD();updateLocation();if(save)saveGame(false);$('screen').focus({preventScroll:true});
}
function updateLocation(){
 $('location-label').textContent=A.rooms[state.room].name+' · '+(state.room==='causeway'?'Morrow online':'Mira & Oren');
 $('controls-label').textContent=state.room==='causeway'?'WASD Move · E Use · Q / R Camera':'WASD Move · Space Jump · E Use · Q / R Camera';
}
function switchRoom(id,spawn){
 if(transition)return;transition=true;show('interact',false);$('fade').classList.add('on');
 setTimeout(()=>{
  state.room=id;const p=spawn||A.rooms[id].start;placeParty(p[0],p[1]);startField(false);saveGame(false);music('field');
  chapter(A.rooms[id].name,A.rooms[id].subtitle);$('fade').classList.remove('on');transition=false;
  if(id==='hall'&&!state.flags.hallIntro){state.flags.hallIntro=true;say([['oren','The water has power. The relay has none. We must turn the three seals.'],['mira','Someone left these guards here. They did not want the relay repaired.']],()=>saveGame(false));}
  if(id==='hangar'&&!state.flags.hangarIntro){state.flags.hangarIntro=true;say([['mira','That machine... I have seen it in my dreams.'],['oren','Morrow. A rescue frame from before the city had walls. Its core is still warm.'],['mira','It was waiting.']],()=>saveGame(false));}
  if(id==='causeway'&&!state.flags.gearIntro){state.flags.gearIntro=true;say([['oren','The fuel cell is charged. Use normal attacks to build Drive. At level two, use Dawn Break.'],['mira','And if the core gets too hot?'],['oren','Brace. It cools the core, restores fuel, and protects us. Watch the Cantor before you strike.']],()=>{saveGame(false);showGearBrief();});}
 },240);
}
function closeButton(){return '<button class="close-button" data-action="close" aria-label="Close window">×</button>';}
function openModal(html,onClose=null,closable=true){
 moveTarget=null;pointerJump=false;
 modalOpen=true;modalClose=onClose;modalClosable=closable;I.clear();
 $('modal').innerHTML='<div class="modal-card">'+html+'</div>';show('modal');
 const first=$('modal').querySelector('button:not([disabled])');if(first)setTimeout(()=>first.focus({preventScroll:true}),0);
}
function closeModal(run=true){
 if(!modalOpen)return;modalOpen=false;show('modal',false);I.clear();const cb=modalClose;modalClose=null;modalClosable=true;
 $('screen').focus({preventScroll:true});if(run&&cb)cb();
}
function portraitInto(canvas,who,size=88){
 const rig=portraitRigs[who]||portraitRigs.mira,ctx=canvas.getContext('2d');canvas.width=size;canvas.height=size;ctx.imageSmoothingEnabled=false;
 rig.drawPortrait(ctx,0,0,size,{frame:false,zoom:size*.07,headY:.38,turn:.3,weapon:false});
}
function updatePortraits(){
 document.querySelectorAll('canvas[data-portrait]').forEach(c=>portraitInto(c,c.dataset.portrait,Number(c.dataset.size)||70));
}
function say(lines,done){
 moveTarget=null;pointerJump=false;
 const prev=mode;dialog={lines,index:0,shown:0,done,prev};mode='dialogue';show('hud',false);show('touch',false);show('interact',false);show('dialogue');I.clear();renderDialog();
}
function renderDialog(){
 const [who,text]=dialog.lines[dialog.index],name={mira:'Mira Venn',oren:'Oren Vale',tala:'Tala · water runner',warden:'Station record',cantor:'The Cantor',bell:'The Silent Bell'}[who]||who;
 $('dialogue').innerHTML='<div class="dialog-box"><div class="dialog-portrait"><canvas data-portrait="'+(who==='bell'?'cantor':who)+'" data-size="112"></canvas></div><div class="dialog-body"><div class="dialog-name">'+name+'</div><div id="dialog-text" class="dialog-text"></div><div class="dialog-foot"><span>'+String(dialog.index+1).padStart(2,'0')+' / '+String(dialog.lines.length).padStart(2,'0')+' &nbsp; '+button('Skip scene','skip-dialogue','quiet')+'</span>'+button('Continue <kbd>E</kbd>','next-dialogue','quiet')+'</div></div></div>';
 updatePortraits();dialog.shown=state.settings.textSpeed===0?text.length:0;renderDialogText();
}
function renderDialogText(){if(dialog)$('dialog-text').textContent=dialog.lines[dialog.index][1].slice(0,Math.floor(dialog.shown));}
function nextDialogue(){
 if(!dialog)return;const text=dialog.lines[dialog.index][1];
 if(dialog.shown<text.length){dialog.shown=text.length;renderDialogText();return;}
 dialog.index++;if(dialog.index>=dialog.lines.length)endDialogue();else{game.audio.sfx('select',{vol:.45});renderDialog();}
}
function endDialogue(){
 if(!dialog)return;const d=dialog;dialog=null;show('dialogue',false);changeMode(d.prev==='dialogue'?'field':d.prev);I.clear();
 if(mode==='field')renderHUD();if(d.done)d.done();
}
function showMovementBrief(){
 openModal('<div class="modal-heading"><h2>The last water road</h2>'+closeButton()+'</div><div class="modal-grid"><div><div class="eyebrow">Your task</div><p class="lead">Reach the relay inside the station. Find why the water stopped.</p><p>The gold line on the floor leads through the station. Walk near people or objects to see an action prompt.</p></div><div>'+[['Move','WASD, arrow keys, or click the ground'],['Jump','Space + a direction, or double-click the ground'],['Run','Hold Shift'],['Talk or use','E'],['Turn camera','Q / R'],['Field guide','Esc']].map(x=>'<div class="guide-row"><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>').join('')+'</div></div><div class="modal-actions">'+button('Explore the quay','close','primary')+'</div>',null);
}
function showHumanBrief(kind){
 openModal('<div class="modal-heading"><h2>'+(kind==='quay'?'Build your attack':'Choose your target')+'</h2>'+closeButton()+'</div><div class="modal-grid"><div><p class="lead">'+(kind==='quay'?'Each turn gives you six action points.':'The Warden has armor. The Drone has range.')+'</p><p>Jab costs 1 AP. Palm costs 2. Kick costs 3. Choose <strong>1, 2, 3</strong>, then press Strike to use Bellbreaker.</p><p>Unused AP become Reserve, up to 3. They add to your next turn. Use the sequence guide to compare finishing moves.</p></div><div><h3>Read the enemy</h3><p>The gold text shows its next action. Guard before a heavy attack. Guard also restores EP.</p><p>Break the enemy guard with strikes. Oren can heal both characters with Quiet Current. Field kits can revive a fallen ally.</p></div></div><div class="modal-actions">'+button('Ready','close','primary')+'</div>',null);
}
function showGearBrief(){
 openModal('<div class="modal-heading"><h2>A different kind of strength</h2>'+closeButton()+'</div><div class="modal-grid"><div><p class="lead">Morrow uses fuel, heat, and Drive.</p><p>Iron Reach and Resonance Lance build Drive. At level 2 or 3, use Dawn Break. It returns Drive to zero.</p><p>Boost adds damage and fuel cost. It also adds heat. You cannot attack at 85 heat or more.</p></div><div><h3>Brace before Bellfall</h3><p>Brace restores fuel, removes heat, and reduces the next attack. You can always Brace, even with no fuel.</p><p>Two repair cells restore 215 integrity each. The Cantor shows its next attack above the battle.</p></div></div><div class="modal-actions">'+button('Pilot Morrow','close','primary')+'</div>',null);
}
function objective(){
 if(state.ending)return ['A new morning','The Silent Bell is free.','Chapter complete'];
 if(state.room==='quay')return state.flags.quayBattle?['Reach the Relay Hall','Use the east station gate.','01 · Enter the station']:['Cross Pilgrim Quay','Jump the channel. Face the Ash Warden.','01 · The last water road'];
 if(state.room==='hall')return state.flags.relay?['Reach Morrow Dock','The east door now has power.','02 · Power restored']:['Restore the relay','Clear the hall. Align the three seals.','02 · A choir without a voice'];
 if(state.room==='hangar')return ['Wake Morrow','Inspect the frame near its feet.','03 · The machine remembers'];
 return ['Silence the Cantor','Cross the causeway in Morrow.','04 · Let the bell speak'];
}
function renderHUD(){
 const o=objective();$('hud').innerHTML='<div class="objective"><div class="eyebrow">'+o[2]+'</div><strong>'+o[0]+'</strong><p>'+o[1]+'</p></div><div class="minimap"><canvas id="map-canvas" width="120" height="84"></canvas><span>'+['QUAY','RELAY HALL','MORROW DOCK','CAUSEWAY'][Object.keys(A.rooms).indexOf(state.room)]+'</span></div><div class="party-strip">'+(state.room==='causeway'?'<div class="party-chip"><div class="vital"><strong>Morrow</strong><div class="bar"><i style="width:'+state.gear.hp/(state.module==='aegis'?680:600)*100+'%"></i></div><small>'+Math.round(state.gear.hp)+' integrity · '+Math.floor(state.gear.fuel)+' fuel</small></div></div>':['mira','oren'].map(id=>'<div class="party-chip"><canvas data-portrait="'+id+'" data-size="46"></canvas><div class="vital"><strong>'+ (id==='mira'?'Mira':'Oren')+'</strong><div class="bar"><i style="width:'+state.party[id].hp/state.party[id].max*100+'%"></i></div><small>'+state.party[id].hp+' / '+state.party[id].max+' HP</small></div></div>').join(''))+'</div><div class="field-hints"><span><kbd>WASD</kbd> Move</span>'+(state.room==='causeway'?'':'<span><kbd>Space</kbd> Jump</span>')+'<span><kbd>Click</kbd> Walk'+(state.room==='causeway'?'':' · double-click jump')+'</span><span><kbd>Q R</kbd> Camera</span><span><kbd>Esc</kbd> Guide</span></div>';
 updatePortraits();drawMap();
}
function drawMap(){
 const c=$('map-canvas');if(!c)return;const g=c.getContext('2d'),room=A.rooms[state.room],s=Math.min(108/room.w,73/room.h),ox=(120-room.w*s)/2,oy=(84-room.h*s)/2;
 g.clearRect(0,0,120,84);g.fillStyle='#15313b';
 for(const b of room.floor)g.fillRect(ox+b[0]*s,oy+b[1]*s,(b[2]-b[0])*s,(b[3]-b[1])*s);
 g.fillStyle='#55777a';for(const b of room.water)g.fillRect(ox+b[0]*s,oy+b[1]*s,(b[2]-b[0])*s,(b[3]-b[1])*s);
 g.fillStyle='#071921';for(const b of room.gaps)g.fillRect(ox+b[0]*s,oy+b[1]*s,(b[2]-b[0])*s,(b[3]-b[1])*s);
 g.fillStyle='#b79960';for(const e of room.exits)g.fillRect(ox+e.x*s-2,oy+e.y*s-2,4,4);
 for(const p of interactables())if(p.type==='memory'){g.fillStyle='#69bdb1';g.fillRect(ox+p.x*s-1,oy+p.y*s-1,2,2);}
 g.fillStyle='#f3dd9d';g.fillRect(Math.round(ox+hero.x*s)-2,Math.round(oy+hero.y*s)-2,4,4);
}
function interactables(){
 const list=[],f=state.flags,add=(id,x,y,label,type='use',range=30)=>list.push({id,x,y,label,type,range});
 if(state.room==='quay'){
  add('tala',101,161,'Talk to Tala','talk');add('rest',74,255,'Rest at the water shrine');
  if(!state.memories.includes('quay'))add('memory-quay',83,98,'Read the lost voice','memory',23);
  if(!f.quayCache)add('cache-quay',331,281,'Open the supply chest');
  if(!f.quayBattle)add('battle-quay',322,181,'Face the Ash Warden','battle',31);
  add('exit-hall',427,107,f.quayBattle?'Enter the Relay Hall':'Inspect the sealed gate');
 }
 if(state.room==='hall'){
  add('plaque',92,117,'Read the seal record');add('relay',357,132,f.relay?'Inspect the restored relay':'Align the three seals');
  if(!state.memories.includes('hall'))add('memory-hall',461,83,'Read the lost voice','memory',23);
  if(!f.hallCache)add('cache-hall',75,201,'Open the supply chest');
  if(!f.hallBattle)add('battle-hall',184,216,'Face the station guards','battle',31);
  add('exit-hangar',472,203,f.relay?'Enter Morrow Dock':'Inspect the sealed door');add('back-quay',55,335,'Return to Pilgrim Quay');
 }
 if(state.room==='hangar'){
  add('module',147,156,'Tune Morrow');add('pilot',371,264,'Inspect Morrow','pilot',45);
  if(!state.memories.includes('hangar'))add('memory-hangar',284,111,'Read the lost voice','memory',24);
  if(!f.hangarCache)add('cache-hangar',199,310,'Open the supply chest');
  add('back-hall',47,341,'Return to the Relay Hall');
 }
 if(state.room==='causeway'){
  add('refuel',146,180,'Use the charge station','use',50);
  if(!f.boss)add('battle-gear',465,249,'Face the Cantor','battle',92);
 }
 return list;
}
const memories={
 quay:{title:'01 · The first water',speaker:'tala',text:'My mother said the river had no owner. Then the keepers gave every cup a price. I saved this voice so I would not forget.'},
 hall:{title:'02 · The cost of silence',speaker:'warden',text:'Station order: take one memory from each household. Convert the stored voices to power. Report the loss as a water tax.'},
 hangar:{title:'03 · A promise in metal',speaker:'mira',text:'If I forget, let the machine remember. Open the water. Give the voices back. My name is Mira Venn.'}
};
function takeMemory(id){
 if(state.memories.includes(id))return;state.memories.push(id);game.audio.sfx('memory');const m=memories[id];
 say([[m.speaker,m.text],['oren',state.memories.length===3?'Three records. Your voice is part of this machine, Mira. Someone tried to keep your promise.':'A memory record. We can read it again in the field guide.']],()=>{saveGame(false);toast('Voice recovered · '+state.memories.length+' / 3');renderHUD();});
}
function rest(){
 for(const p of Object.values(state.party)){p.hp=p.max;p.ep=p.maxEp;}game.audio.sfx('heal');saveGame(false);renderHUD();toast('Both characters restored. Checkpoint saved.');
}
function interact(id){
 if(mode!=='field'||modalOpen||transition)return false;
 const item=id?interactables().find(p=>p.id===id):near;
 if(!item||Math.hypot(hero.x-item.x,hero.y-item.y)>item.range+3){if(id)toast('Move closer to use that object.');return false;}
 I.clear();game.audio.sfx('confirm',{vol:.5});
 if(item.id.startsWith('memory-')){takeMemory(item.id.split('-')[1]);return true;}
 if(item.id.startsWith('cache-')){
  const k=item.id.split('-')[1];state.flags[k+'Cache']=true;state.inventory.kits+=2;game.audio.sfx('pickup');saveGame(false);toast('Found 2 field kits. Total: '+state.inventory.kits);return true;
 }
 if(item.id.startsWith('battle-')){beginBattle(item.id.slice(7));return true;}
 const actions={
  tala:()=>say([['tala','My sister is on the lower road. There is no water there. Please bring it back.'],['mira','I will find a way.'],['tala','The channel is broken. Keep moving when you jump. The shrine can restore your strength.']],()=>{state.flags.tala=true;saveGame(false);}),
  rest,
  'exit-hall':()=>state.flags.quayBattle?switchRoom('hall'):say([['oren','The Warden holds the gate seal. We must stop it first.']]),
  plaque:()=>{state.flags.plaque=true;say([['warden','Seal record. Dawn faces east. The river faces west. The crown faces south.'],['oren','East, west, south. Set each seal to its named direction.']],()=>saveGame(false));},
  relay:()=>state.flags.hallBattle?openPuzzle():say([['oren','The guards still control this relay. Clear the hall first.']]),
  'exit-hangar':()=>state.flags.relay?switchRoom('hangar'):say([['oren','The door needs power. Use the three-seal relay beside the north wall.']]),
  'back-quay':()=>switchRoom('quay',[419,122]),
  'back-hall':()=>switchRoom('hall',[455,204]),
  module:openModule,
  pilot:inspectMorrow,
  refuel:()=>{state.gear.fuel=100;state.gear.hp=state.module==='aegis'?680:600;game.audio.sfx('engine');renderHUD();saveGame(false);toast('Morrow restored. Charge complete.');}
 };
 if(actions[item.id])actions[item.id]();return true;
}
let dials=[3,2,0];
function openPuzzle(){
 if(state.flags.relay){say([['oren','The relay is stable. The east door has power.']]);return;}
 renderPuzzle();
}
function renderPuzzle(){
 const names=['Dawn','River','Crown'],dirs=['North','East','South','West'],correct=[1,3,2],done=dials.every((n,i)=>n===correct[i]);
 openModal('<div class="modal-heading"><h2>The three-seal relay</h2>'+closeButton()+'</div><div class="eyebrow">Station power · '+(done?'Aligned':'No signal')+'</div><p class="lead">Dawn faces east. The river faces west. The crown faces south.</p><p>Turn each seal. Each press turns it one quarter clockwise.</p><div class="puzzle-dials">'+dials.map((n,i)=>'<button class="dial" data-action="dial" data-index="'+i+'" aria-label="Turn '+names[i]+' seal. It now faces '+dirs[n]+'."><strong>'+names[i].toUpperCase()+'</strong><span class="dial-icon" style="transform:rotate('+n*90+'deg)">↑</span><span class="dial-state">'+dirs[n]+(n===correct[i]?' · aligned':'')+'</span></button>').join('')+'</div><div class="puzzle-line">'+(done?'All three seals are aligned. Power can reach the dock.':'The three seals must follow the record. North is up on each seal.')+'</div><div class="modal-actions">'+button('Restore power','solve-puzzle','primary',!done)+button('Leave relay','close','quiet')+'</div>');
}
function solvePuzzle(){
 if(!dials.every((n,i)=>n===[1,3,2][i]))return;closeModal(false);state.flags.relay=true;game.audio.sfx('bell');game.shake(2);
 say([['mira','The water is moving. But the lower canals are still dry.'],['oren','The Cantor has closed the final gate. Morrow can reach it.'],['bell','Mira Venn. Promise retained. Pilot signal accepted.'],['mira','How does it know my name?']],()=>{saveGame(false);renderHUD();chapter('Power restored','THE WAY TO MORROW IS OPEN');});
}
function openModule(){
 const opts=[['balanced','Balanced core','600 integrity. Standard fuel recovery.'],['aegis','Aegis lining','680 integrity. More room for error.'],['coil','Resonance coil','600 integrity. +16 attack power. Brace restores 40 fuel.']];
 openModal('<div class="modal-heading"><h2>Tune Morrow</h2>'+closeButton()+'</div><p class="lead">Choose one module for the causeway.</p><p>The dock restores the machine when you fit a module. You can change this choice before you depart.</p><div class="notes-list">'+opts.map(o=>button('<strong>'+o[1]+'</strong><small>'+o[2]+(state.module===o[0]?' · fitted':'')+'</small>','fit-module',state.module===o[0]?'primary choice-card':'choice-card',false,'data-module="'+o[0]+'"')).join('')+'</div><div class="modal-actions">'+button('Return to dock','close','quiet')+'</div>');
}
function fitModule(id){
 if(!['balanced','aegis','coil'].includes(id))return;state.module=id;state.gear.hp=id==='aegis'?680:600;state.gear.fuel=100;game.audio.sfx('engine');saveGame(false);openModule();
}
function inspectMorrow(){
 if(!state.flags.inspected){
  state.flags.inspected=true;say([
   ['bell','Pilot record found. Mira Venn. Water road rescue service.'],
   ['mira','I have never been here.'],
   ['oren','The keepers took memories to power the bell. Perhaps they took yours first.'],
   ['mira','This is my voice. I told the machine to open the water.'],
   ['oren','Then we finish what you started.']
  ],()=>{saveGame(false);offerPilot();});
 }else offerPilot();
}
function offerPilot(){
 openModal('<div class="modal-heading"><h2>Morrow is ready</h2>'+closeButton()+'</div><p class="lead">The Cantor guards the final water gate. Morrow can cross the exposed causeway.</p><p>Module: <strong>'+({balanced:'Balanced core',aegis:'Aegis lining',coil:'Resonance coil'}[state.module])+'</strong>. Integrity and fuel will be restored before departure.</p><p>The causeway is the final part of this chapter. Explore the dock now if you want to find all three lost voices.</p><div class="modal-actions">'+button('Pilot Morrow','depart','primary')+button('Keep exploring','close','quiet')+'</div>');
}
function depart(){
 closeModal(false);state.flags.piloted=true;state.gear={hp:state.module==='aegis'?680:600,fuel:100};game.audio.sfx('engine');switchRoom('causeway');
}
function beginBattle(kind){
 if(mode!=='field'||modalOpen||battleBusy)return;
 saveGame(false);beforeBattle=clone(state);battleReturn={room:state.room,x:hero.x,y:hero.y};battleKind=kind;
 setupBattle(kind);
 if(kind==='gear')say([['cantor','The city gave its past for water. The contract must stand.'],['mira','You took more than voices. You took the choice to refuse.'],['oren','Morrow is ready. Watch the next attack, Mira.']],()=>{});
 else showHumanBrief(kind);
}
function setupBattle(kind){
 battle=new A.Battle(kind,state);battleFinished=false;battleBusy=false;battleEvents=[];currentEvent=null;animMessage='';animSub='';fx=[];displayHP={};battleUnits={};
 for(const p of [...battle.party,...battle.enemies])displayHP[p.id]=p.hp;
 if(kind==='gear'){
  battleUnits.morrow={id:'morrow',x:-85,y:28,z:0,home:[-85,28],facing:0,mech:new A.Mech('morrow'),hurt:0,dead:false,guardPose:false};
  battleUnits.cantor={id:'cantor',x:103,y:10,z:0,home:[103,10],facing:Math.PI,mech:new A.Mech('cantor'),hurt:0,dead:false,guardPose:false};
 }else{
  const placements={mira:[-74,13],oren:[-51,70],warden:[93,21],drone:[83,-39]};
  for(const p of [...battle.party,...battle.enemies]){
   const loc=placements[p.id];const unit=A.makeUnit(p.id,loc[0],loc[1]);unit.home=loc;unit.facing=p.id==='mira'||p.id==='oren'?0:Math.PI;unit.dead=p.hp<=0;unit.guardPose=false;battleUnits[p.id]=unit;
  }
 }
 changeMode('battle');game.yaw=0;
 game.setView(new E.View('ember-battle','Combat',kind==='gear'?14:20,kind==='gear'?27:29,kind==='gear'?(portrait()?1.13:1.72):(portrait()?1.5:2.3),1));
 game.cam.offset=[0,portrait()?-58:-39];game.cam.snap=true;game.focus(17,6,kind==='gear'?36:23);
 $('location-label').textContent=kind==='gear'?'Crown Causeway · Morrow / The Cantor':A.rooms[state.room].name+' · Close combat';
 $('controls-label').textContent=kind==='gear'?'Read the intent · Build Drive · Brace before Bellfall':'1 2 3 Build sequence · Enter Strike · T Target · G Guard';
 music(kind==='gear'?'boss':'battle');renderBattle();$('screen').focus({preventScroll:true});
}
function renderBattle(){
 if(!battle)return;
 const b=battle,gear=b.kind==='gear',a=b.actor,p=b.party[0],target=b.enemies[b.target],intents=b.intent,active=currentEvent?.from||a.id;
 const enemies=b.enemies.map((e,i)=>{
  if((displayHP[e.id]||0)<=0)return '';
  const intent=(battleBusy?sequenceIntent:intents).find(v=>v.id===e.id)||b.enemyIntent(e);
  return '<button class="enemy-card '+(b.target===i?'active':'')+'" data-action="target" data-index="'+i+'" '+(battleBusy?'disabled':'')+' aria-label="Target '+e.name+'"><strong>'+e.name+'</strong><div class="bar red"><i style="width:'+((displayHP[e.id]??e.hp)/e.max*100)+'%"></i></div><small>'+Math.max(0,displayHP[e.id]??e.hp)+' / '+e.max+' HP · '+(e.stagger?'BROKEN':'Guard '+e.poise+'/'+e.maxPoise)+'</small><div class="intent">NEXT · '+intent.name+'</div></button>';
 }).join('');
 let command='';
 if(battleBusy){
  command='<div class="command-panel busy-panel"><div class="eyebrow">'+(gear?'Machine combat':'Sequence in motion')+'</div><strong>'+escape(animMessage||'Resolving the turn')+'</strong><p>'+escape(animSub||(gear?'Watch the core. Every strike uses fuel.':'Your next turn begins when the actions finish.'))+'</p>'+button('Skip animation','skip-animation','quiet')+'</div>';
 }else if(!gear){
  const remain=b.ap-b.spent,combo=b.combo;
  command='<div class="command-panel"><div class="command-header"><strong>'+a.name+' · choose your sequence</strong><span>'+remain+' / '+b.ap+' AP <span class="ap-dots">'+Array.from({length:b.ap},(_,i)=>'<i class="'+(i<remain?'full':'')+'"></i>').join('')+'</span></span></div><div class="sequence-row"><span class="sequence">'+(b.seq.length?b.seq.map(n=>'<span class="stroke">'+n+'</span>').join(''):'<span class="muted">No strikes yet</span>')+'</span><span class="combo-preview">'+escape(b.preview())+'</span></div><div class="attack-row">'+button('<b>1</b> &nbsp; Jab<small>1 AP · quick strike</small>','stroke','',remain<1,'data-value="1"')+button('<b>2</b> &nbsp; Palm<small>2 AP · strong strike</small>','stroke','',remain<2,'data-value="2"')+button('<b>3</b> &nbsp; Kick<small>3 AP · heavy strike</small>','stroke','',remain<3,'data-value="3"')+button('Strike <small>'+(combo?combo.name:'Execute sequence')+'</small>','attack','primary execute',!b.seq.length)+'</div><div class="utility-row">'+button('Undo','undo','',!b.seq.length)+button('Guard <span class="muted">+8 EP</span>','guard')+button(a.id==='oren'?'Quiet Current · 12 EP':'Ember Pulse · 12 EP','skill','',a.ep<12)+button('Field kit · '+b.inventory.kits,'item','',b.inventory.kits<=0||b.party.every(p=>p.hp>=p.max))+button('Sequences','sequences','combo-list')+'</div></div>';
 }else{
  const boostCost=b.boost?10:0,canAttack=b.heat<85;
  command='<div class="command-panel"><div class="command-header"><strong>Morrow · pilot command</strong><span>Drive <span class="ap-dots">'+[0,1,2].map(i=>'<i class="'+(i<b.drive?'full':'')+'"></i>').join('')+'</span> '+b.drive+'/3</span></div><div class="gear-gauge"><div><small><span>FUEL</span><span>'+Math.floor(b.fuel)+' / 100</span></small><div class="bar"><i style="width:'+b.fuel+'%"></i></div></div><div><small><span>CORE HEAT</span><span>'+b.heat+' / 100'+(b.heat>=85?' · VENT':'')+'</span></small><div class="bar '+(b.heat>=70?'red':'gold')+'"><i style="width:'+b.heat+'%"></i></div></div></div><div class="attack-row">'+button('Iron Reach<small>'+(18+boostCost)+' fuel · +1 Drive</small>','gear-strike','',b.fuel<18+boostCost||!canAttack)+button('Resonance Lance<small>'+(26+boostCost)+' fuel · breaks guard</small>','gear-lance','',b.fuel<26+boostCost||!canAttack)+button('Dawn Break<small>'+(30+boostCost)+' fuel · Drive 2 or 3</small>','gear-finish','primary',b.drive<2||b.fuel<30+boostCost||!canAttack)+button('Brace<small>Restore fuel · cool core</small>','gear-charge','')+'</div><div class="utility-row">'+button('Boost '+(b.boost?'ON · +50% damage':'OFF')+' · +heat','gear-boost',b.boost?'gold':'')+button('Repair cell · '+b.repairs,'gear-repair','',!b.repairs||p.hp>=p.max)+button('Machine guide','gear-guide','combo-list')+'</div></div>';
 }
 const members=b.party.map(p=>'<div class="battle-member '+(p.id===active?'active':'')+'">'+(gear?'':'<canvas data-portrait="'+p.id+'" data-size="54"></canvas>')+'<div class="vital"><strong>'+p.name+(displayHP[p.id]<=0?' · fallen':'')+'</strong><div class="bar"><i style="width:'+Math.max(0,displayHP[p.id])/p.max*100+'%"></i></div><small>'+Math.max(0,displayHP[p.id])+' / '+p.max+(gear?' integrity':' HP &nbsp; · &nbsp; '+p.ep+' / '+p.maxEp+' EP')+'</small></div></div>').join('');
 $('battle').innerHTML='<div class="battle-top"><div class="battle-round"><strong>'+(gear?'Morrow / Cantor':'Close combat')+'</strong>ROUND '+String(b.round).padStart(2,'0')+(gear?' · PHASE '+b.phase:'')+'</div><div class="enemy-row">'+enemies+'</div></div><div class="battle-message" id="battle-message">'+(animMessage?'<h2>'+escape(animMessage)+'</h2><p>'+escape(animSub)+'</p>':'')+'</div><div class="battle-bottom"><div class="battle-party">'+members+'</div>'+command+'</div>';
 updatePortraits();
}
function command(cmd){
 if(!battle||mode!=='battle'||battleBusy||modalOpen)return {ok:false,reason:'Wait until your turn is ready.'};
 sequenceIntent=clone(battle.intent);
 const r=battle.command(cmd);
 if(!r.ok){toast(r.reason);game.audio.sfx('cancel');return r;}
 if(r.free){game.audio.sfx('select');renderBattle();return r;}
 battleBusy=true;battleEvents=r.events.slice();currentEvent=null;animMessage='';animSub='';
 for(const p of Object.values(battleUnits)){p.attack=null;p.pose=null;}
 nextBattleEvent();return {ok:true};
}
function queueStrike(n){
 if(mode!=='battle'||battleBusy||modalOpen||!battle)return false;
 if(battle.queue(n)){game.audio.sfx('select',{pitch:n===1?1.1:n===2?.95:.8,vol:.65});renderBattle();return true;}
 game.audio.sfx('cancel',{vol:.4});return false;
}
function undoStrike(){if(battle&&!battleBusy&&battle.undo()){game.audio.sfx('cancel',{vol:.5});renderBattle();}}
function skipBattleAnimation(){
 if(mode!=='battle'||!battle||!battleBusy||modalOpen)return;
 // The rule model has already resolved this turn. Commit only its final visual
 // state. Rewards and required decisions still pass through the normal handler.
 for(const p of [...battle.party,...battle.enemies]){displayHP[p.id]=p.hp;const u=battleUnits[p.id];if(u){u.dead=p.hp<=0;u.guardPose=!!p.guard;u.hurt=0;}}
 battleEvents=[];currentEvent=null;battleBusy=false;animMessage=animSub='';fx=[];game.hitstop=0;game.shakeAmt=0;game._flash=null;
 resetUnitPositions();renderBattle();if(battle.result)finishBattleEvents();
}
function eventDuration(e){
 if(e.type==='hit')return e.gear?(e.finisher?1.4:1.02):(e.finisher?.74:.53);
 return {sequence:.68,cast:.72,heal:.65,guard:.76,charge:.8,break:.42,stagger:.65,down:.58,phase:1.65,victory:.8,defeat:.8,restore:.35}[e.type]||.4;
}
function resetUnitPositions(){
 for(const u of Object.values(battleUnits)){u.x=u.home[0];u.y=u.home[1];u.z=0;u.attack=null;u.pose=u.dead?'die':u.guardPose?'guard':null;}
}
function nextBattleEvent(){
 resetUnitPositions();eventTime=0;currentEvent=battleEvents.shift()||null;
 if(!currentEvent){battleBusy=false;animMessage=animSub='';renderBattle();if(battle.result)finishBattleEvents();return;}
 const e=currentEvent; e.duration=eventDuration(e);e.applied=false;
 const from=battleUnits[e.from],to=battleUnits[e.to];
 animMessage=e.name||'';animSub='';
 if(e.type==='sequence'){animSub=(e.from==='morrow'?'MORROW':e.from?.toUpperCase()||'')+(e.seq?' · '+e.seq.join(' — '):' · DRIVE RELEASE');game.audio.sfx('whoosh');}
 if(e.type==='hit'&&from){
  from.guardPose=false;from.pose=e.ether?'cast':null;from.attack=new E.Attack(e.move||'cross',{wind:e.duration*.27,active:e.duration*.24,recover:e.duration*.49});from.attack.start();
  animMessage=e.finisher?e.name:'';animSub=e.finisher?'FINISHING MOVE':'';
 }
 if(e.type==='cast'&&from){from.pose='cast';game.audio.sfx('charge',{vol:.4});}
 if(e.type==='guard'&&from){from.guardPose=true;from.pose='guard';game.audio.sfx(battle.kind==='gear'?'engine':'bump',{vol:.6});animSub=battle.kind==='gear'?'DAMAGE REDUCED · FUEL RESTORED':'DAMAGE REDUCED · EP RESTORED';}
 if(e.type==='charge'&&from){from.pose='cast';game.audio.sfx('charge');animSub='A HEAVY ATTACK WILL FOLLOW';}
 if(e.type==='break'){animSub=battle.kind==='gear'?'NEXT ACTION LOST':'NEXT ACTION WEAKENED';if(to)game.particles.text(to.x,to.y,55,'BREAK','#f1cf8a',{scale:1});game.audio.sfx('bump');}
 if(e.type==='stagger'&&from){from.pose='kneel';animSub='GUARD RECOVERED';}
 if(e.type==='down'&&to){to.dead=true;to.pose='die';if(battle.kind==='gear')game.audio.sfx('boom',{vol:.65});}
 if(e.type==='phase'){game.audio.sfx('bell');game.shake(3);animSub=e.subtitle||'';}
 if(e.type==='victory'){for(const p of battle.party){const u=battleUnits[p.id];if(u&&!u.dead)u.pose='cheer';}game.audio.sfx('powerup',{vol:.55});animSub='ENCOUNTER COMPLETE';}
 if(e.type==='defeat'){game.audio.sfx('die',{vol:.55});animSub='YOUR CHECKPOINT IS SAFE';}
 renderBattle();
}
function applyBattleEvent(e){
 e.applied=true;const from=battleUnits[e.from],to=battleUnits[e.to];
 if(e.type==='hit'&&to){
  displayHP[e.to]=e.hp;to.hurt=.35;
  const z=battle.kind==='gear'?56:20,power=e.finisher?(battle.kind==='gear'?2.3:1.8):e.heavy?1.6:battle.kind==='gear'?1.45:.85;
  game.hitFx(to.x,to.y,z,{power,damage:e.amount,color:e.ether?'#8be2d0':'#f6c182',sound:e.ether?'laser':e.gear?'boom':e.heavy?'kick':'punch',textScale:battle.kind==='gear'?2:1,textZ:28});
  if(e.ether&&from)fx.push({type:'beam',x1:from.x,y1:from.y,z1:z+3,x2:to.x,y2:to.y,z2:z,life:.35,max:.35});
  if(e.finisher){fx.push({type:'slash',x:to.x,y:to.y,z,life:.3,max:.3});}
 }
 if(e.type==='heal'&&to){displayHP[e.to]=e.hp;to.dead=false;to.pose=null;game.audio.sfx('heal');game.particles.text(to.x,to.y,35,'+'+e.amount,'#a0e5c7',{scale:battle.kind==='gear'?2:1});fx.push({type:'heal',x:to.x,y:to.y,z:15,life:.8,max:.8});}
 if(e.type==='restore'&&to){game.particles.text(to.x,to.y,36,e.name,'#a0e5c7');game.audio.sfx('heal',{vol:.5});}
 renderBattle();
}
function updateBattle(dt){
 if(!battle)return;
 if(currentEvent&&!modalOpen){
  eventTime+=dt*(state.settings.fastBattle?1.35:1);
  const e=currentEvent,u=E.clamp(eventTime/e.duration,0,1),from=battleUnits[e.from],to=battleUnits[e.to];
  if(e.type==='hit'&&from&&to&&!e.ether&&e.from!==e.to){
   const d=Math.hypot(to.home[0]-from.home[0],to.home[1]-from.home[1])||1,travel=Math.max(0,d-(battle.kind==='gear'?68:29));
   const q=u<.3?E.ease.outCubic(u/.3):u>.72?1-E.ease.inOut((u-.72)/.28):1;
   from.x=from.home[0]+(to.home[0]-from.home[0])/d*travel*q;
   from.y=from.home[1]+(to.home[1]-from.home[1])/d*travel*q;
   from.facing=Math.atan2(to.y-from.y,to.x-from.x);
  }
  if(!e.applied&&u>=.43)applyBattleEvent(e);
  if(eventTime>=e.duration){if(!e.applied)applyBattleEvent(e);nextBattleEvent();}
 }
 for(const u of Object.values(battleUnits)){
  u.hurt=Math.max(0,(u.hurt||0)-dt);if(u.attack)u.attack.update(dt);
  const isFrom=currentEvent?.from===u.id,progress=currentEvent?E.clamp(eventTime/currentEvent.duration,0,1):0;
  if(u.mech){
   let pose=u.dead?'hurt':u.guardPose?'guard':'idle';
   if(isFrom&&currentEvent?.type==='hit')pose=currentEvent.ether?'cast':'attack';
   if(isFrom&&['cast','charge'].includes(currentEvent?.type))pose='cast';
   u.mech.update(dt,{facing:u.facing,pose,action:progress,hit:u.hurt});
  }else u.rig.update(dt,{...u,attack:u.attack?.state,pose:u.dead?'die':u.pose,stance:u.dead?null:'guard',hurt:u.hurt>0});
 }
 for(const p of fx)p.life-=dt;fx=fx.filter(p=>p.life>0);
}
function finishBattleEvents(){
 if(battleFinished)return;battleFinished=true;
 if(battle.result==='defeat'){
  openModal('<div class="result"><div class="eyebrow">Signal lost</div><h2>The promise remains.</h2><p class="result-text">Return to the start of this encounter. Your checkpoint keeps your supplies and progress.</p><p>'+(battle.kind==='gear'?'Build Drive with normal attacks. Use Dawn Break. Brace before Bellfall.':'Use named sequences for more damage. Guard before Iron fall. Oren and field kits can revive a fallen ally.')+'</p><div class="modal-actions">'+button('Retry encounter','retry','primary')+button('Retry in Story mode','retry-story','quiet')+'</div></div>',null,false);return;
 }
 state.stats.battles++;state.stats.turns+=battle.turns;state.stats.finishers+=battle.finishes;state.stats.breaks+=battle.breaks;state.inventory=clone(battle.inventory);
 if(battle.kind==='human'){
  for(const p of battle.party){const gain=battleKind==='quay'?12:0;state.party[p.id]={hp:Math.min(p.max+gain,Math.max(1,p.hp)+28),max:p.max+gain,ep:Math.min(p.maxEp,p.ep+6),maxEp:p.maxEp};}
  state.flags[battleKind+'Battle']=true;
  openModal('<div class="result"><div class="eyebrow">Encounter complete</div><h2>The way is clear.</h2><p class="result-text">'+(battleKind==='quay'?'The gate seal falls silent. The Relay Hall is open.':'The relay guards fall. The seals are within reach.')+'</p><div class="result-stats"><div class="result-stat"><strong>'+battle.turns+'</strong><span>PARTY TURNS</span></div><div class="result-stat"><strong>'+battle.finishes+'</strong><span>FINISHING MOVES</span></div><div class="result-stat"><strong>'+battle.breaks+'</strong><span>GUARD BREAKS</span></div></div><p>'+(battleKind==='quay'?'Dawn Thread learned: 1 · 1 · 2 · 2. Both characters gain 12 maximum HP.':'Mira and Oren recover some HP and EP.')+'</p><div class="modal-actions">'+button('Continue journey','after-battle','primary')+'</div></div>',null,false);
 }else{
  state.gear.hp=battle.party[0].hp;state.gear.fuel=battle.fuel;state.flags.boss=true;
  endBattleToField();music('end');
  say([['cantor','Without the stored voices, the bell cannot return to its old order.'],['mira','Then it will learn a new one.'],['oren','Morrow can keep the water moving. The archive is in your hands.'],['mira',state.memories.length===3?'I know the promise I made. Now I choose how to keep it.':'Some of my past is still missing. This choice belongs to me.']],endingChoice);
 }
}
function endBattleToField(){
 if(!battleReturn)return;
 const p=battleReturn;state.room=p.room;placeParty(p.x,p.y);beforeBattle=null;startField(false);saveGame(false);music(state.flags.boss?'end':'field');
}
function afterBattle(){
 closeModal(false);const kind=battleKind;endBattleToField();
 if(kind==='quay')say([['oren','You found a new rhythm. Dawn Thread uses two quick strikes, then two palms.'],['mira','One more way through. Let us find the relay.']],()=>{renderHUD();saveGame(false);});
 else{renderHUD();toast('The guards are cleared. Align the relay to open the dock.');}
}
function retry(story=false){
 const tries=(state.stats.retries||0)+1,currentSettings=clone(state.settings);
 closeModal(false);state=clone(beforeBattle);state.stats.retries=tries;state.settings=currentSettings;if(story)state.settings.difficulty='story';savePreferences();
 beforeBattle=clone(state);setupBattle(battleKind);
}
function endingChoice(){
 openModal('<div class="modal-heading"><h2>The voices are yours to free.</h2></div><p class="lead">Morrow can hold the water gate open. The bell no longer needs to keep the city in silence.</p><p>Choose what becomes of the stored memories. Both choices restore the water.</p><div class="modal-actions">'+button('<strong>Release the voices</strong><small>Return each memory to its owner. The bell will never use them again.</small>','ending-release','choice-card')+button('<strong>Keep an open archive</strong><small>Protect the records. Let every person hear, claim, or remove their own voice.</small>','ending-keep','choice-card')+'</div>',null,false);
}
function chooseEnding(which){
 closeModal(false);state.ending=which;saveGame(false);game.audio.sfx('bell');
 say(which==='release'?[
  ['mira','No more contracts made in silence. Give them back. All of them.'],
  ['bell','Ownership released. Water road open.'],
  ['oren','Listen. The voices are going home.'],
  ['mira','Then let us go home too.']
 ]:[
  ['mira','Keep the records. Open the doors. Each voice belongs to the person who lived it.'],
  ['bell','Archive unlocked. Water road open.'],
  ['oren','A place to remember. No keeper at the gate.'],
  ['mira','And no price for a cup of water.']
 ],()=>showEnding(which,true));
}
function showEnding(which,save=true){
 state.ending=which;changeMode('field');state.room='causeway';fieldView();placeParty(310,284);music('end');renderHUD();updateLocation();if(save)saveGame(false);
 const mins=Math.max(1,Math.round(state.elapsed/60));
 openModal('<div class="result"><div class="eyebrow">Chapter one · complete</div><h2>'+(which==='release'?'A river of voices.':'A door left open.')+'</h2><p class="result-text">'+(which==='release'?'The memories return to the people below. For the first time in years, the Silent Bell has nothing to hold.':'The archive belongs to the city. Its doors stay open. For the first time, memory is a choice.')+'</p><p>Water reaches the lower road. Mira keeps her promise. Morrow walks toward the morning.</p><div class="result-stats"><div class="result-stat"><strong>'+state.memories.length+' / 3</strong><span>LOST VOICES</span></div><div class="result-stat"><strong>'+state.stats.finishers+'</strong><span>FINISHING MOVES</span></div><div class="result-stat"><strong>'+mins+' min</strong><span>ACTIVE PLAY</span></div></div><p>'+(state.memories.length===3?'All three voices found. Mira remembers the promise she made.':'Some voices remain in the station. A new journey can recover them.')+'</p><div class="modal-actions">'+button('Stay on the causeway','close','primary')+button('Field records','ending-records','quiet')+button('Title screen','title','quiet')+'</div><div class="rule"></div><p class="small">EMBERWAKE · THE SILENT BELL<br>Built on my-3D2dge. Original story, art, rigs, and score.</p></div>',null,true);
}
function openGuide(tab='mission'){
 guideTab=tab;
 const tabs=[['mission','Mission'],['sequences','Sequences'],['records','Records'],['options','Options']];
 let content='';
 if(tab==='mission'){
  const o=objective(),steps=[['Enter the station',state.flags.quayBattle],['Restore the relay',state.flags.relay],['Wake Morrow',state.flags.piloted],['Open the water road',state.flags.boss]];
  content='<div class="modal-grid"><div><div class="eyebrow">Current objective</div><p class="lead">'+o[0]+'.</p><p>'+o[1]+'</p><div class="notes-list">'+steps.map((s,i)=>'<div class="guide-row"><strong>'+String(i+1).padStart(2,'0')+' · '+s[0]+'</strong><span class="'+(s[1]?'teal':'muted')+'">'+(s[1]?'Complete':'Pending')+'</span></div>').join('')+'</div></div><div><h3>Party supplies</h3><p><strong>'+state.inventory.kits+' field kits</strong><br>Restore 100 HP to the character with the lowest health ratio. A kit can revive a fallen ally.</p>'+button('Use a field kit','field-kit','quiet',mode!=='field'||!state.inventory.kits||Object.values(state.party).every(p=>p.hp>=p.max))+'<div class="rule"></div><p>Lost voices: '+state.memories.length+' / 3<br>Active play: '+Math.floor(state.elapsed/60)+' min<br>Module: '+({balanced:'Balanced core',aegis:'Aegis lining',coil:'Resonance coil'}[state.module])+'</p></div></div>';
 }else if(tab==='sequences'){
  content='<p>Jab = 1 AP. Palm = 2 AP. Kick = 3 AP. Press the numbers in order, then use Strike. Reserve adds up to 3 AP to your next turn.</p><table class="combo-table"><thead><tr><th>FINISH</th><th>SEQUENCE</th><th>AP</th><th>EFFECT</th></tr></thead><tbody>'+A.combos.map(c=>'<tr class="'+(c.unlock&&!state.flags.quayBattle?'locked':'')+'"><td>'+c.name+'</td><td>'+c.seq.split('').join(' · ')+'</td><td>'+c.seq.split('').reduce((s,n)=>s+Number(n),0)+'</td><td>'+((c.unlock&&!state.flags.quayBattle)?'Learn after the Quay Warden.':c.id==='dawn'?'+54 finisher damage. Break +3.':c.effect)+'</td></tr>').join('')+'</tbody></table><div class="rule"></div><div class="modal-grid"><div><h3>Guard and EP</h3><p>Guard reduces damage by 64%. It also restores 8 EP and gives 3 Reserve. Mira uses Ember Pulse. Oren uses Quiet Current to restore 48 HP to both allies, including a fallen ally.</p></div><div><h3>Break and Drive</h3><p>A broken human enemy receives more damage and its next attack is weaker. A broken machine loses its next action.</p><p>Morrow builds Drive with normal attacks. Dawn Break uses all Drive. Level 3 deals more damage than level 2.</p></div></div>';
 }else if(tab==='records'){
  content='<p>The station kept these voices. Recovered records remain in your local checkpoint.</p><div class="notes-list">'+Object.entries(memories).map(([id,m])=>'<div class="note-entry"><h3>'+m.title+'</h3><p>'+(state.memories.includes(id)?m.text:'Not yet recovered. Search '+A.rooms[id].name+'.')+'</p></div>').join('')+'</div><div class="rule"></div><p><strong>Credits</strong><br>Foundation: my-3D2dge v0.14.0 by Michael Crosato, supplied for this project. Original world, combat, mechanical rigs, story, music, and title art created for Emberwake. The title artwork uses generated imagery. Game art and animation use procedural pixel geometry.</p><p><strong>Reference study</strong><br>Xenogears (PS1): instruction manual, RPGClassics guide, and Xeno Series Wiki. Emberwake uses original names, characters, setting, music, and assets.</p><p><a href="downloads/emberwake-source.zip" download>Download the game source</a></p>';
 }else{
  content='<div class="setting"><div><strong>Difficulty</strong><p>Story mode reduces incoming damage. It keeps all encounters.</p></div><select id="difficulty-select" aria-label="Difficulty"><option value="standard" '+(state.settings.difficulty==='standard'?'selected':'')+'>Standard</option><option value="story" '+(state.settings.difficulty==='story'?'selected':'')+'>Story</option></select></div><div class="setting"><div><strong>Sound</strong><p>Original music and synthesized effects.</p></div><input id="sound-check" type="checkbox" aria-label="Enable sound" '+(state.settings.sound?'checked':'')+'></div><div class="setting"><strong>Master volume</strong><input id="volume-range" type="range" min="0" max="100" value="'+Math.round(state.settings.volume*100)+'" aria-label="Master volume"></div><div class="setting"><strong>Music volume</strong><input id="music-range" type="range" min="0" max="75" value="'+Math.round(state.settings.music*100)+'" aria-label="Music volume"></div><div class="setting"><div><strong>Screen movement</strong><p>Turn off screen shake and reduce flashes.</p></div><input id="motion-check" type="checkbox" aria-label="Enable screen movement" '+(state.settings.motion?'checked':'')+'></div><div class="setting"><div><strong>Instant dialogue</strong><p>Show each line in full.</p></div><input id="text-check" type="checkbox" aria-label="Show dialogue instantly" '+(state.settings.textSpeed===0?'checked':'')+'></div><div class="setting"><div><strong>Fast battle animation</strong><p>Play battle actions at 1.35 times normal speed.</p></div><input id="speed-check" type="checkbox" aria-label="Fast battle animation" '+(state.settings.fastBattle?'checked':'')+'></div><div class="rule"></div><p><strong>Controls</strong><br>WASD / arrows: move. Click ground: walk. Double-click: jump. Space: jump. Shift: run. E or action prompt: use. Q / R: camera. Esc: field guide.<br>Combat: 1 / 2 / 3: strikes. Enter: execute. Backspace: undo. T: target. G: guard. V: skill or Boost. I: field kit or repair.<br>Machine: 1: Iron Reach. 2: Lance. 3: Dawn Break. 4: Brace.</p><p>Progress is saved on this device after each major event. Saves do not move between browsers or devices.</p>';
 }
 openModal('<div class="modal-heading"><h2>Field guide</h2>'+closeButton()+'</div><nav class="tabs" aria-label="Field guide sections">'+tabs.map(t=>button(t[1],'guide-tab',tab===t[0]?'active':'',false,'data-tab="'+t[0]+'"')).join('')+'</nav>'+content+'<div class="modal-actions">'+button(mode==='title'?'Return to title':'Return to game','close','primary')+button('Save checkpoint','save','quiet',mode!=='field')+button('Title screen','ask-title','quiet',mode==='title')+((mode==='title'||mode==='field')?button('World Forge','world-forge','quiet'):'')+(state.ending?button('View ending','view-ending','quiet'):'')+'</div>');
 if(tab==='options')bindOptions();
}
function bindOptions(){
 const change=()=>{
  state.settings.difficulty=$('difficulty-select').value;state.settings.sound=$('sound-check').checked;state.settings.volume=Number($('volume-range').value)/100;state.settings.music=Number($('music-range').value)/100;state.settings.motion=$('motion-check').checked;state.settings.textSpeed=$('text-check').checked?0:1;state.settings.fastBattle=$('speed-check').checked;
  if(battle)battle.difficulty=state.settings.difficulty;savePreferences();
 };
 for(const id of ['difficulty-select','sound-check','volume-range','music-range','motion-check','text-check','speed-check'])$(id).addEventListener('input',change);
}
function fieldKit(){
 if(mode!=='field'||!state.inventory.kits)return;
 const p=Object.values(state.party).reduce((a,b)=>a.hp/a.max<b.hp/b.max?a:b);
 if(p.hp===p.max)return;const heal=Math.min(100,p.max-p.hp);p.hp+=heal;state.inventory.kits--;game.audio.sfx('heal');saveGame(false);renderHUD();openGuide('mission');toast('Restored '+heal+' HP.');
}
function goTitle(){
 closeModal(false);if(mode==='field')saveGame(false);dialog=null;show('dialogue',false);battle=null;battleBusy=false;currentEvent=null;fx=[];show('chapter',false);
 saved=validSave(E.store.get(KEY,null));changeMode('title');refreshTitle();$('location-label').textContent='An original role-playing adventure';$('controls-label').textContent='Keyboard · Mouse · Touch';music('field');
}
function askTitle(){
 openModal('<div class="modal-heading"><h2>Return to the title?</h2>'+closeButton()+'</div><p>'+(mode==='battle'?'This encounter will restart from its checkpoint when you return. Your supplies and earlier progress are safe.':'Your latest checkpoint will remain on this device.')+'</p><div class="modal-actions">'+button('Return to title','title','primary')+button('Keep playing','close','quiet')+'</div>');
}
const actions={
 new:beginNew,'confirm-new':confirmNew,continue:continueGame,close:()=>closeModal(),'next-dialogue':nextDialogue,'skip-dialogue':endDialogue,
 'guide-tab':b=>openGuide(b.dataset.tab),sequences:()=>openGuide('sequences'),'gear-guide':showGearBrief,
 stroke:b=>queueStrike(Number(b.dataset.value)),attack:()=>command('attack'),guard:()=>command('guard'),skill:()=>command('skill'),item:()=>command('item'),undo:undoStrike,
 target:b=>{if(battle&&!battleBusy&&battle.select(Number(b.dataset.index))){game.audio.sfx('select');renderBattle();}},'skip-animation':skipBattleAnimation,
 'gear-strike':()=>command('strike'),'gear-lance':()=>command('lance'),'gear-finish':()=>command('finish'),'gear-charge':()=>command('charge'),'gear-boost':()=>command('boost'),'gear-repair':()=>command('repair'),
 dial:b=>{dials[Number(b.dataset.index)]=(dials[Number(b.dataset.index)]+1)%4;game.audio.sfx('select');renderPuzzle();},
 'solve-puzzle':solvePuzzle,'fit-module':b=>fitModule(b.dataset.module),depart,'after-battle':afterBattle,retry:()=>retry(false),'retry-story':()=>retry(true),
 'ending-release':()=>chooseEnding('release'),'ending-keep':()=>chooseEnding('keep'),'ending-records':()=>openGuide('records'),'view-ending':()=>showEnding(state.ending,false),
 'field-kit':fieldKit,save:()=>saveGame(),title:goTitle,'ask-title':askTitle,'world-forge':()=>{if(mode==='field')saveGame(false);location.href='world.html';}
};
document.addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b||b.disabled)return;const action=actions[b.dataset.action];if(action)action(b);
});
$('menu-button').onclick=()=>{if(modalOpen){if(modalClosable)closeModal();}else openGuide(mode==='title'?'options':'mission');};
$('sound-button').onclick=()=>{state.settings.sound=!state.settings.sound;savePreferences();if(!game.audio.song)music(mode==='battle'?(battle?.kind==='gear'?'boss':'battle'):state.ending?'end':'field');};
document.querySelector('.wordmark').onclick=e=>{e.preventDefault();if(modalOpen&&!modalClosable)return;if(mode!=='title')askTitle();};
for(const b of document.querySelectorAll('[data-move]'))b.dataset.act=b.dataset.move;
I.bindButtons($('touch'));
$('touch-use').onclick=()=>interact();
$('interact').onclick=()=>{if(mode==='field'&&!modalOpen&&near)interact();};
$('screen').addEventListener('click',e=>{
 if(mode!=='field'||modalOpen||transition||e.button!==0||coarse)return;
 const s=game.screen.clientToScreen(e.clientX,e.clientY),p=game.view.toGround(s[0],s[1]),room=A.rooms[state.room];
 if(!p||!A.floorAt(room,p[0],p[1])||A.blocked(room,p[0],p[1],state.room==='causeway'?13:6))return;
 moveTarget=p;blockedTime=0;if(e.detail>1&&state.room!=='causeway')pointerJump=true;$('screen').focus({preventScroll:true});
});
$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();I.press('Act:jump');});
for(const ev of ['pointerup','pointercancel'])$('touch-jump').addEventListener(ev,()=>I.release('Act:jump'));
$('touch-turn').onclick=()=>{if(mode==='field'&&!modalOpen){game.rotateView(90);game.audio.sfx('select',{vol:.3});}};
document.addEventListener('keydown',e=>{
 const tag=e.target?.tagName,typing=['INPUT','SELECT','TEXTAREA'].includes(tag);
 if(e.code==='Escape'){e.preventDefault();if(modalOpen){if(modalClosable)closeModal();}else openGuide(mode==='title'?'options':'mission');return;}
 if(modalOpen){
  if(e.code==='Tab'){
   const nodes=[...$('modal').querySelectorAll('button:not([disabled]),input,select,a[href]')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  if(e.code==='Space'&&tag==='BUTTON'){e.preventDefault();e.target.click();}return;
 }
 if(typing)return;
 if(e.code==='Enter'){
  if(tag==='BUTTON'||tag==='A')return;e.preventDefault();if(mode==='title'){saved?continueGame():beginNew();}else if(mode==='dialogue')nextDialogue();else if(mode==='battle')command(battle.kind==='gear'?'strike':'attack');return;
 }
 if(mode==='battle'&&!battleBusy){
  if(['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();const n=Number(e.code.slice(-1));battle.kind==='gear'?command(['','strike','lance','finish'][n]):queueStrike(n);}
  if(e.code==='Digit4'&&battle.kind==='gear'){e.preventDefault();command('charge');}
  if(e.code==='Backspace'){e.preventDefault();undoStrike();}
  if(e.code==='KeyG'){e.preventDefault();command(battle.kind==='gear'?'charge':'guard');}
  if(e.code==='KeyV'){e.preventDefault();command(battle.kind==='gear'?'boost':'skill');}
  if(e.code==='KeyI'){e.preventDefault();command(battle.kind==='gear'?'repair':'item');}
  if(e.code==='KeyT'){e.preventDefault();for(let n=1;n<=battle.enemies.length;n++){if(battle.select((battle.target+n)%battle.enemies.length))break;}renderBattle();}
 }
});
addEventListener('resize',()=>{
 game.screen.setOptions({res:portrait()?[480,620]:[768,432]});
 if(mode==='field'||mode==='dialogue')fieldView();
 else if(mode==='battle'&&battle){
  game.setView(new E.View('ember-battle','Combat',battle.kind==='gear'?14:20,battle.kind==='gear'?27:29,battle.kind==='gear'?(portrait()?1.13:1.72):(portrait()?1.5:2.3),1));
  game.cam.offset=[0,portrait()?-58:-39];game.cam.snap=true;
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode!=='title'&&!modalOpen)openGuide('mission');});
function updateField(dt){
 const room=A.rooms[state.room],gear=state.room==='causeway',screenMove=I.move(),speed=gear?64:I.down('run')?105:74;
 let dir=game.view.screenDirToGround(screenMove[0],screenMove[1]);
 if(Math.hypot(...screenMove)>.1)moveTarget=null;
 else if(moveTarget){const dx=moveTarget[0]-hero.x,dy=moveTarget[1]-hero.y,d=Math.hypot(dx,dy);if(d<3){moveTarget=null;dir=[0,0];}else dir=[dx/d,dy/d];}
 const moving=Math.hypot(...dir)>.1;
 hero.vx=dir[0]*speed;hero.vy=dir[1]*speed;
 if(moving)hero.facing=E.lerpAng(hero.facing,Math.atan2(dir[1],dir[0]),Math.min(1,dt*16));
 if(!gear&&(I.pressed('jump')||pointerJump)&&hero.z<=.1&&A.floorAt(room,hero.x,hero.y)){
  hero.vz=115;hero.z=.1;game.audio.sfx('jump',{vol:.38});state.flags.jumped=true;
 }
 pointerJump=false;
 const dx=hero.vx*dt,dy=hero.vy*dt,can=(x,y)=>!A.blocked(room,x,y,gear?13:6)&&(hero.z>.1||A.floorAt(room,x,y));
 if(can(hero.x+dx,hero.y))hero.x+=dx;else hero.vx=0;
 if(can(hero.x,hero.y+dy))hero.y+=dy;else hero.vy=0;
 if(moveTarget&&Math.hypot(hero.vx,hero.vy)<speed*.2){blockedTime+=dt;if(blockedTime>.2){moveTarget=null;blockedTime=0;}}else blockedTime=0;
 if(hero.z>0||hero.vz>0){
  hero.vz-=310*dt;hero.z+=hero.vz*dt;
  if(hero.z<=0){
   if(A.floorAt(room,hero.x,hero.y)&&!A.blocked(room,hero.x,hero.y,4)){hero.z=0;hero.vz=0;game.audio.sfx('land',{vol:.3});}
   else{const safe=hero.lastSafe;placeParty(safe[0],safe[1]);game.audio.sfx('cancel',{vol:.4});toast('Back on safe ground. Keep moving through the jump.');}
  }
 }else if(A.floorAt(room,hero.x,hero.y))hero.lastSafe=[hero.x,hero.y];
 if(!gear&&moving&&hero.z===0){
  stepTime+=dt;if(stepTime>.24){stepTime=0;game.audio.sfx('step',{vol:.3});}
 }
 if(gear&&moving&&!state.ending){const previousFuel=Math.floor(state.gear.fuel);state.gear.fuel=Math.max(0,state.gear.fuel-Math.hypot(dx,dy)*.008);if(Math.floor(state.gear.fuel)!==previousFuel)renderHUD();}
 if(!gear){
  const d=Math.hypot(hero.x-companion.x,hero.y-companion.y),followSpeed=d>45?Math.min(125,d*3):d>24?speed*.84:0;
  companion.vx=d>1?(hero.x-companion.x)/d*followSpeed:0;companion.vy=d>1?(hero.y-companion.y)/d*followSpeed:0;
  companion.x+=companion.vx*dt;companion.y+=companion.vy*dt;
  if(d>100){companion.x=hero.x-12;companion.y=hero.y+12;}
  if(d>24)companion.facing=Math.atan2(hero.y-companion.y,hero.x-companion.x);
  companion.z=hero.z>0?hero.z*.72:0;
  hero.rig.update(dt,{...hero,air:hero.z>1});companion.rig.update(dt,{...companion,air:companion.z>1});
 }
 morrow.update(dt,{walk:gear&&moving,facing:gear?hero.facing:2.8});cantor.update(dt,{facing:Math.PI});
 tala.rig.update(dt,{...tala,facing:Math.atan2(hero.y-tala.y,hero.x-tala.x),pose:'hips'});
 fieldWarden.x=state.room==='quay'?322:184;fieldWarden.y=state.room==='quay'?181:216;fieldWarden.rig.update(dt,{...fieldWarden,facing:Math.atan2(hero.y-fieldWarden.y,hero.x-fieldWarden.x),stance:'guard'});
 if(I.pressed('turnLeft')){game.rotateView(-90);game.audio.sfx('select',{vol:.3});}
 if(I.pressed('turnRight')){game.rotateView(90);game.audio.sfx('select',{vol:.3});}
 game.focus(hero.x,hero.y,gear?42:16);
 const items=interactables().map(p=>({...p,d:Math.hypot(p.x-hero.x,p.y-hero.y)})).sort((a,b)=>a.d-b.d);
 near=items.find(p=>p.d<p.range)||null;
 if(near&&hero.z<1){$('interact').innerHTML='<kbd>E</kbd>'+near.label;show('interact');}
 else{show('interact',false);if(!gear&&moving&&hero.z===0&&((!hero.vx&&!hero.vy)||room.gaps.some(b=>hero.x>b[0]-13&&hero.x<b[2]+13))){$('interact').innerHTML='<kbd>Space</kbd>Jump while you move across the channel';show('interact');}}
 if(I.pressed('interact')&&near&&hero.z<1)interact();
 const encounter=items.find(p=>p.type==='battle'&&p.d<p.range*.67);if(encounter&&hero.z<1&&!state.ending)beginBattle(encounter.id.slice(7));
 uiTime+=dt;if(uiTime>.15){uiTime=0;drawMap();}
}
function update(dt){
 telemetryTime+=dt;if(telemetryTime>.2){telemetryTime=0;$('screen').dataset.state=JSON.stringify(publicState());}
 if(mode!=='title'&&!modalOpen&&!transition&&!state.ending)state.elapsed+=dt;
 if(modalOpen||transition)return;
 if(mode==='field')updateField(dt);
 else if(mode==='dialogue'){
  if(dialog){
   const prev=Math.floor(dialog.shown);dialog.shown=Math.min(dialog.lines[dialog.index][1].length,dialog.shown+dt*42*(state.settings.textSpeed||999));if(Math.floor(dialog.shown)!==prev)renderDialogText();
   if(I.pressed('interact'))nextDialogue();
  }
  morrow.update(dt,{facing:2.8});cantor.update(dt,{facing:Math.PI});
  for(const r of Object.values(portraitRigs))r.update(dt,{facing:0});
 }else if(mode==='battle')updateBattle(dt);
}
function drawEffects(r){
 for(const f of fx){
  const alpha=Math.min(1,f.life/f.max);
  r.overlay(g=>{
   if(f.type==='beam'){
    const p=r.w(f.x1,f.y1,f.z1),q=r.w(f.x2,f.y2,f.z2);
    E.px.blend(g,alpha*.65,'add',()=>{E.px.line(g,p[0],p[1],q[0],q[1],'#5bcaba',12*alpha);E.px.line(g,p[0],p[1],q[0],q[1],'#fff0c7',3*alpha);});
   }else if(f.type==='slash'){
    const p=r.w(f.x,f.y,f.z),k=1-alpha;E.px.blend(g,alpha*.7,'add',()=>{E.px.line(g,p[0]-54,p[1]+32,p[0]+57,p[1]-33,'#ffd899',3+8*k);E.px.line(g,p[0]-22,p[1]-43,p[0]+22,p[1]+43,'#fff2cf',2);});
   }else{
    const p=r.w(f.x,f.y,f.z+(1-alpha)*35);r.glowDisc(g,p[0],p[1],25*alpha,'#7adcbd',.3);
   }
  });
 }
}
function draw(r){
 if(mode==='title'){A.drawBackdrop(r,'quay',game.time);return;}
 if(battle&&(mode==='battle'||(mode==='dialogue'&&dialog?.prev==='battle'))){
  A.drawBattleFloor(r,battle.kind,game.time);
  if(!battleBusy&&battle.enemies[battle.target]?.hp>0){const t=battleUnits[battle.enemies[battle.target].id];r.groundRing(t.x,t.y,battle.kind==='gear'?32:15,'#e4c28a',.6);}
  for(const u of Object.values(battleUnits)){
   if(u.mech){if(!u.dead||currentEvent?.type==='down')u.mech.draw(r,u.x,u.y,u.z);}
   else if(u.id==='drone'){if(!u.dead)A.drawDrone(r,u);}
   else A.drawHuman(r,u);
  }
  drawEffects(r);return;
 }
 A.drawRoom(r,state.room,state);
 if(moveTarget&&mode==='field')r.groundRing(moveTarget[0],moveTarget[1],4,'#f0cf89',.8);
 if(state.room==='quay'){
  A.drawHuman(r,tala);if(!state.flags.quayBattle){A.drawHuman(r,fieldWarden);A.drawMarker(r,322,181,'#e4a170','WARDEN');}
 }
 if(state.room==='hall'&&!state.flags.hallBattle){A.drawHuman(r,fieldWarden);A.drawDrone(r,{x:194,y:176});A.drawMarker(r,184,216,'#e4a170','GUARDS');}
 if(state.room==='hangar')morrow.draw(r,403,225,0,1.15);
 if(state.room==='causeway'){
  morrow.draw(r,hero.x,hero.y,0,1);if(!state.flags.boss)cantor.draw(r,480,245,0,1.18);
 }else{A.drawHuman(r,companion);A.drawHuman(r,hero);}
}
// Agent tools use the same public game actions as the visible controls.
function publicState(){
 return {mode,paused:modalOpen,room:A.rooms[state.room].name,position:{x:Math.round(hero.x),y:Math.round(hero.y)},objective:objective()[0],memories:state.memories.length,checkpoint:!!saved,ending:state.ending,
  interactions:interactables().filter(p=>Math.hypot(p.x-hero.x,p.y-hero.y)<=p.range).map(p=>({id:p.id,label:p.label})),battle:battle?battle.summary():null,
  performance:{fps:game.fps,renderMs:Math.round(game.stats.renderMs*10)/10,updateMs:Math.round(game.stats.updateMs*10)/10},errors:game.errors.slice()};
}
A.app={getState:publicState,interact,openGuide,command,queueStrike,undoStrike};
if(document.modelContext?.registerTool){
 const abort=new AbortController();
 const tools=[
  {name:'read_emberwake_state',title:'Read Emberwake state',description:'Read the current room, objective, nearby actions, and battle state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:async()=>publicState()},
  {name:'stage_emberwake_sequence',title:'Stage a combat sequence',description:'Replace the current human attack sequence. This does not execute the attack.',inputSchema:{type:'object',properties:{strikes:{type:'array',items:{type:'integer',enum:[1,2,3]},minItems:1,maxItems:9}},required:['strikes'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{
   if(!input||Object.keys(input).some(k=>k!=='strikes')||!Array.isArray(input.strikes)||!input.strikes.length||input.strikes.length>9||input.strikes.some(n=>![1,2,3].includes(n)))throw new Error('Strikes must contain 1, 2, or 3.');
   if(mode!=='battle'||battleBusy||modalOpen||battle.kind!=='human')throw new Error('A human combat turn must be ready.');
   if(input.strikes.reduce((s,n)=>s+n,0)>battle.ap)throw new Error('The sequence exceeds your AP.');
   battle.seq=[];for(const n of input.strikes)battle.queue(n);renderBattle();return {sequence:battle.seq.slice(),preview:battle.preview()};
  }},
  {name:'open_emberwake_guide',title:'Open the field guide',description:'Pause play and open one section of the field guide.',inputSchema:{type:'object',properties:{section:{type:'string',enum:['mission','sequences','records','options']}},required:['section'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{
   if(!input||Object.keys(input).some(k=>k!=='section')||!['mission','sequences','records','options'].includes(input.section))throw new Error('Choose a valid guide section.');
   if(modalOpen&&!modalClosable)throw new Error('Complete the current decision first.');openGuide(input.section);return {section:input.section,paused:true};
  }}
 ];
 for(const t of tools)try{Promise.resolve(document.modelContext.registerTool(t,{signal:abort.signal})).catch(()=>{});}catch(e){}
 addEventListener('pagehide',()=>abort.abort(),{once:true});
}
window.addEventListener('error',e=>{
 if(!document.querySelector('.boot-error')){const d=document.createElement('div');d.className='boot-error';d.textContent='The game could not complete an action. Reload the page to return to your checkpoint. '+(e.message||'');$('stage').appendChild(d);}
});
refreshTitle();game.start({update,draw});
})();
