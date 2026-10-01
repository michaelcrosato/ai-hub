import { REVISION } from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { TOUCH_LOOK } from 'kit/input.js';
import { World, STEP, TOOLS, TEAM, MAX_MANA, SIZE, SCENARIOS, CONQUEST, INSTANT_TOOLS } from './sim.js';
import { WorldView } from './view.js';
import { createSound } from './sound.js';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const svgPaths={
  raise:'<path d="m3 18 9-5 9 5-9 4-9-4Z"/><path d="M12 14V2m-4 4 4-4 4 4"/>',
  lower:'<path d="m3 18 9-5 9 5-9 4-9-4Z"/><path d="M12 2v11m-4-4 4 4 4-4"/>',
  level:'<path d="m2 14 10-5 10 5-10 5-10-5Z"/><path d="M3 6h18M5 3v6m14-6v6M3 19l9 4 9-4"/>',
  rally:'<path d="M6 22V3m0 1c4-4 8 4 13 0v10c-5 4-9-4-13 0"/><path d="M3 22h6"/>',
  swamp:'<path d="M3 16c3-4 5 4 8 0s5 4 10 0M3 21c3-4 5 4 8 0s5 4 10 0M7 13V4m0 5-4-3m4 0 3-3m6 10V2m0 6 4-3"/>',
  quake:'<path d="m2 18 5-10 4 6 4-10 7 14H2Z"/><path d="m13 6-3 5 5 3-4 7"/>',
  knight:'<path d="M5 21v-5l6-4-5-1 4-7h6l1 6-3 5 5 6H5Z"/><path d="M11 4V2m3 2V2m-3 6h1"/>',
  volcano:'<path d="m3 21 6-12 6 1 6 11H3Zm6-12 3 3 3-2M9 5 7 2m7 4 1-4m3 6 3-2"/>',
  flood:'<path d="M2 20c4-5 6 4 10 0s6 4 10 0M2 15c4-5 6 4 10 0s6 4 10 0"/><path d="M11 3C7 7 6 9 8 11c2 3 6 2 7-1 1-2-1-5-4-7Z"/>',
  armageddon:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2m-8 2-2 5h4l-2 4"/>',
  mana:'<path d="m12 2 7 10-7 10-7-10 7-10Z"/><path d="m5 12 7 3 7-3M12 2v13"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7"/>',
  sword:'<path d="m4 3 14 12-3 3L3 4l1-1Zm9 16 6-6m-3 3 5 5m-3 1 4-4"/>',
  balance:'<path d="M12 3v18m-5 0h10M3 7h18M5 7l-4 7h8L5 7Zm14 0-4 7h8l-4-7Z"/>',
  sound:'<path d="M4 9h4l5-5v16l-5-5H4V9Zm12-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  soundOff:'<path d="M4 9h4l5-5v16l-5-5H4V9Zm13 0 5 6m0-6-5 6"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 4h.01"/>',
  settings:'<path d="m9 3-1 3-3 1 1 4-2 3 3 3 3-1 3 2 3-2 3-1-1-4 2-3-3-3-3 1-3-3-2 2Z"/><circle cx="12" cy="11" r="3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
  rotate:'<path d="M4 10a8 8 0 1 1 1 8M4 3v7h7"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8l-5-5m13 5 5-5M8 16l-5 5m13-5 5 5"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18m6-18v18M3 9h18M3 15h18"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="m8 4 12 8-12 8V4Z"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" aria-hidden="true">${svgPaths[name]??svgPaths.mana}</svg>`;}
function installIcons(root=document){root.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
installIcons();

// ---------------------------------------------------------------- storage
const STORAGE='first-light.save.v3',PREFS='first-light.preferences.v1',PROGRESS='first-light.progress.v1';
const store={
  get(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}},
  set(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
};
let prefs={sound:false};
{const saved=store.get(PREFS);if(saved&&typeof saved==='object')prefs={...prefs,sound:saved.sound===true};}
function readProgress(){
  const raw=store.get(PROGRESS)||{},out={unlocked:0,conquestBest:{},records:{}};
  if(Number.isInteger(raw.unlocked))out.unlocked=clamp(raw.unlocked,0,CONQUEST.length);
  for(const k of ['conquestBest','records'])if(raw[k]&&typeof raw[k]==='object')for(const [key,v] of Object.entries(raw[k]))if(Number.isFinite(v)&&v>0)out[k][key]=v;
  return out;
}
let progress=readProgress();
const saveProgress=()=>store.set(PROGRESS,progress);
const savePrefs=()=>store.set(PREFS,prefs);

// ---------------------------------------------------------------- state
const sound=createSound();
const TOOL_KEYS=Object.keys(TOOLS);
const shortNames={raise:'Raise',lower:'Lower',level:'Level',rally:'Magnet',swamp:'Swamp',quake:'Quake',knight:'Knight',volcano:'Volcano',flood:'Flood',armageddon:'Armageddon'};
const ORDERS=['settle','gather','fight'];
const HEADLINES={'first-light':'Make room for life.',islands:'Build a way across.',highlands:'Carve out flat land.',ashen:'Heal the land.'};
const toolButtons=new Map();
const textCache=new Map();
const press={active:false,sx:0,sy:0,lx:0,ly:0,moved:false,pinched:false,rotate:false,tool:null,type:'mouse'};
const nav={dir:'',hold:0};
let kit=null,view=null,world=null;
let selected='raise',lastTargeted='raise',speed=1,paused=false,photo=false,hover=null,confirmAction=null,endAction=null;
let onTitle=true,worldStarted=false,restoredOnBoot=false,aimMode=false,conquestPick=0;
let accumulator=0,uiClock=0,mapClock=0,saveClock=0,pickClock=0,hoverX=-1,hoverY=-1,hoverShown=false,mouseCursor=false,lastTakenNotice=-1e9;
let lastNotice='',lastNoticeTime=0;

const fmtTime=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function setText(id,value){value=String(value);if(textCache.get(id)===value)return;textCache.set(id,value);$(id).textContent=value;}
function setStyle(id,prop,value){const key=id+'|'+prop;if(textCache.get(key)===value)return;textCache.set(key,value);$(id).style[prop]=value;}
function worldInfo(w){
  if(w.conquest!==null){const c=CONQUEST[w.conquest];return {number:String(w.conquest+1).padStart(2,'0'),name:c.name,story:c.story};}
  const s=SCENARIOS[w.scenario];return {number:s.number,name:s.name,story:`A ${s.blurb} world with a ${w.difficulty} rival.`};
}

// ---------------------------------------------------------------- powers dock
for(const [key,tool] of Object.entries(TOOLS)){
  const b=document.createElement('button');b.className='power'+(key===selected?' active':'');b.dataset.tool=key;
  b.title=`${tool.name} · ${tool.cost} mana · ${tool.tip}`;b.setAttribute('aria-label',`${tool.name}. ${tool.cost} mana. ${tool.tip}`);b.setAttribute('aria-pressed',String(key===selected));
  b.innerHTML=`<span class="power-key">${tool.key}</span>${icon(key)}<span class="power-name">${shortNames[key]}</span><span class="power-cost">${tool.cost}</span>`;
  b.addEventListener('click',()=>selectTool(key,{trigger:true}));$('power-buttons').append(b);toolButtons.set(key,b);
}
for(const id of ['scenario-select','title-scenario'])for(const [key,s] of Object.entries(SCENARIOS)){
  const o=document.createElement('option');o.value=key;o.textContent=`${s.name} · ${s.blurb}`;$(id).append(o);
}

function notice(text,warn=false){
  const t=performance.now();if(text===lastNotice&&t-lastNoticeTime<1300)return;lastNotice=text;lastNoticeTime=t;
  const node=document.createElement('div');node.className='toast'+(warn?' warn':'');node.textContent=text;
  $('toasts').append(node);while($('toasts').children.length>3)$('toasts').firstChild.remove();setTimeout(()=>node.remove(),4000);
}
function setAudio(enabled,fromLoad=false){
  prefs.sound=!!enabled;sound.setEnabled(prefs.sound,!fromLoad);savePrefs();
  $('sound-toggle').checked=prefs.sound;$('audio-button').innerHTML=icon(prefs.sound?'sound':'soundOff');
  $('audio-button').title=prefs.sound?'Turn sound off':'Turn sound on';$('audio-button').setAttribute('aria-label',$('audio-button').title);
  $('title-sound').textContent=prefs.sound?'Sound: on':'Sound: off';$('title-sound').setAttribute('aria-pressed',String(prefs.sound));
  if(prefs.sound&&!fromLoad)sound.play('select');
}
function rumble(strength,ms){kit?.input.rumble(strength,ms);}
function refreshTools(){
  for(const [tool,btn] of toolButtons){btn.classList.toggle('active',selected===tool);btn.setAttribute('aria-pressed',String(selected===tool));}
  $('active-tool-icon').innerHTML=icon(selected);setText('active-tool-name',TOOLS[selected].name);setText('active-tool-tip',TOOLS[selected].tip);
  if(view)view.setCursor(hover,selected);
}
/**
 * Choose a power. Knight, Flood and Armageddon act at once when clicked or
 * keyed (trigger), and the land power chosen before stays selected, so the
 * next tap on the land does not make another knight or ask about the sea.
 * Cycling with LB / RB only highlights them; A then uses them.
 */
function selectTool(key,{trigger=false}={}){
  if(!TOOLS[key])return;
  if(trigger&&INSTANT_TOOLS.includes(key)){useInstant(key);return;}
  selected=key;if(!INSTANT_TOOLS.includes(key))lastTargeted=key;
  refreshTools();sound.play('select');updateUI();
}
function cycleTool(step){
  const i=TOOL_KEYS.indexOf(selected);selectTool(TOOL_KEYS[(i+step+TOOL_KEYS.length)%TOOL_KEYS.length]);
}
function useInstant(key){
  if(paused||hasDialog()){notice('Continue the world before you use a power.');return;}
  const done=()=>{if(INSTANT_TOOLS.includes(selected)){selected=lastTargeted;refreshTools();}};
  if(key==='knight'){castNow(key,world.magnets[0]);done();}
  else if(key==='flood')confirm('Raise the sea?','The sea will rise by one level. Low land will flood. Both sides can lose homes and followers.',()=>{castNow(key,{x:18,z:18});done();});
  else confirm('Begin Armageddon?','All followers will leave their homes for one final battle. Land powers will stop. This cannot be undone.',()=>{castNow(key,{x:18,z:18});done();});
}
function attemptCast(tool,p){
  if(INSTANT_TOOLS.includes(tool)){useInstant(tool);return;}
  if(!p)return;
  if(paused||hasDialog()){notice('Continue the world before you use a power.');return;}
  castNow(tool,p);
}
function castNow(tool,p){
  const result=world.cast(tool,p.x,p.z,0);
  if(!result.ok){notice(result.message,true);sound.play('warn');}
  else{
    if(tool==='rally')notice('Magnet placed. Select Gather to lead your followers here.');
    if(tool==='knight')notice('A knight now seeks the rival followers.');
    if(tool==='flood')notice('The sea has risen. Protect your low land.',true);
    if(tool==='armageddon')notice('The final battle has begun.');
  }
  processEvents();updateUI();drawMap();
}

// ---------------------------------------------------------------- dialogs and pause
function hasDialog(){return !!document.querySelector('dialog[open]');}
/** The dialog on top: a confirmation sits above settings, help above anything. */
function topDialog(){for(const id of ['confirm-dialog','help-dialog','end-dialog','settings-dialog']){const d=$(id);if(d.open)return d;}return null;}
function syncPause(){
  if(world)world.paused=paused||hasDialog()||onTitle;
  $('pause-label').hidden=onTitle||(!paused&&!hasDialog());
  $('pause-button').innerHTML=icon(paused?'play':'pause');$('pause-button').setAttribute('aria-label',paused?'Continue world':'Pause world');
}
function togglePause(){paused=!paused;syncPause();sound.play('select');}
function openDialog(id){
  if(photo)setPhoto(false);const d=$(id);
  if(id==='help-dialog')renderControls();
  if(id==='settings-dialog'){updateSaveStatus();updateRendererDetails();}
  if(!d.open)d.showModal();syncPause();
}
function closeDialog(d){if(d.open)d.close();syncPause();}
for(const d of document.querySelectorAll('dialog')){
  d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(d)));
  // 'close' arrives a moment after close(): leave an action alone if a new confirmation already opened.
  d.addEventListener('close',()=>{syncPause();if(d.id==='confirm-dialog'&&!d.open)confirmAction=null;kit?.input.settle();});
  d.addEventListener('cancel',()=>{setTimeout(syncPause,0);});
}
function confirm(title,text,action){
  $('confirm-title').textContent=title;$('confirm-text').textContent=text;confirmAction=action;openDialog('confirm-dialog');
}
$('confirm-no').onclick=()=>closeDialog($('confirm-dialog'));
$('confirm-yes').onclick=()=>{const action=confirmAction;confirmAction=null;closeDialog($('confirm-dialog'));action?.();syncPause();};
$('help-button').onclick=()=>openDialog('help-dialog');
$('settings-button').onclick=()=>openDialog('settings-dialog');
$('graphics-button').onclick=()=>kit?.menu.open();
$('audio-button').onclick=()=>setAudio(!prefs.sound);
$('sound-toggle').onchange=e=>setAudio(e.target.checked);
$('tutorial-close').onclick=()=>{$('tutorial').hidden=true;};
$('home-button').onclick=e=>{e.preventDefault();view?.resetCamera();};
$('camera-reset').onclick=()=>view?.resetCamera();$('map-home').onclick=()=>view?.resetCamera();
$('zoom-in').onclick=()=>view?.zoom(.8);$('zoom-out').onclick=()=>view?.zoom(1.25);
$('rotate-left').onclick=()=>view?.turn(Math.PI/4,0);
$('rotate-right').onclick=()=>view?.turn(-Math.PI/4,0);
$('grid-button').onclick=toggleGrid;
$('pause-button').onclick=togglePause;
$('speed-button').onclick=cycleSpeed;
for(const btn of document.querySelectorAll('[data-order]'))btn.onclick=()=>setOrder(btn.dataset.order);
function toggleGrid(){if(view)$('grid-button').setAttribute('aria-pressed',String(view.toggleGrid()));}
function cycleSpeed(){speed=speed===1?2:speed===2?4:1;$('speed-button').textContent=speed+'×';notice(`World speed: ${speed}×`);}
function setOrder(mode){
  if(world.armageddon){notice('All followers must fight in the final battle.');return;}
  world.setMode(0,mode);sound.play('select');updateUI();
}
function setPhoto(value){
  photo=value;document.body.classList.toggle('photo',photo);$('photo-exit').hidden=!photo;
  if(photo){view?.setCursor(null);$('hover-info').hidden=true;hoverShown=false;}
  measureBand();
}
$('photo-button').onclick=()=>setPhoto(true);$('photo-exit').onclick=()=>setPhoto(false);

// ---------------------------------------------------------------- saving
function saveGame(manual=false){
  // A world that was only shown behind the title is not the player's yet.
  if(!worldStarted||!world)return false;
  if(store.set(STORAGE,{savedAt:new Date().toISOString(),world:world.serialize()})){if(manual)notice('World saved in this browser.');updateSaveStatus();return true;}
  if(manual)notice('This browser cannot store a save. Use Export file.',true);return false;
}
function updateSaveStatus(){
  try{const data=JSON.parse(localStorage.getItem(STORAGE)||'null');$('save-status').textContent=data?.savedAt?`Last local save: ${new Date(data.savedAt).toLocaleString()}. A save is made every 30 seconds.`:'No local save yet. A save is made every 30 seconds.';}
  catch{$('save-status').textContent='Local storage is not available. Use Export file to keep your world.';}
}
function hasUnfinishedSave(){const data=store.get(STORAGE);return !!data?.world&&data.world.winner===null;}
/** World name and number in the top bar, the New World fields, and the guide panel's words for this land. */
function applyWorldText(){
  const info=worldInfo(world),plain=world.conquest===null&&world.scenario==='first-light';
  $('world-name').textContent=info.name;$('world-number').textContent=info.number;
  $('scenario-select').value=world.scenario;$('difficulty-select').value=world.difficulty;$('seed-input').value=world.seed;
  $('tutorial-eyebrow').textContent=plain||world.conquest===0?'YOUR FIRST MIRACLE':`WORLD ${info.number} · ${info.name.toUpperCase()}`;
  $('tutorial-title').textContent=HEADLINES[world.scenario];
  if(plain||world.conquest===0)$('tutorial-text').innerHTML='Your followers need flat land.<br>Give them space. They will do the rest.';
  else $('tutorial-text').textContent=info.story;
}
function replaceWorld(w){
  world=w;world.events=[];accumulator=0;saveClock=0;paused=false;
  view.setWorld(world);applyWorldText();
  selected=lastTargeted='raise';refreshTools();
  $('tutorial').hidden=false;syncPause();updateUI();drawMap();
}
function startWorld(w){
  replaceWorld(w);
  for(const d of document.querySelectorAll('dialog[open]'))d.close();
  worldStarted=true;hideTitle();saveGame();
  notice(w.conquest===0?'Shape flat land near Dawn. Your followers will build on their own.':w.conquest!==null?`World ${worldInfo(w).number}: ${CONQUEST[w.conquest].story}`:'A new world awaits your hand.');
}
/** Replacing a world in progress asks first. */
function guardReplace(action){
  if(hasUnfinishedSave())confirm('Begin a new world?','Your saved world will be replaced. Export it first from Settings to keep a copy.',action);
  else action();
}
function startConquest(i){
  const c=CONQUEST[i];if(!c)return;
  guardReplace(()=>startWorld(new World({...c,conquest:i})));
}
$('save-button').onclick=()=>saveGame(true);
$('load-button').onclick=()=>{
  try{const data=JSON.parse(localStorage.getItem(STORAGE)||'null');if(!data?.world){notice('There is no local save yet.',true);return;}
    const restored=World.restore(data.world);
    confirm('Load the saved world?','The current world will be replaced. Export it first to keep another copy.',()=>{replaceWorld(restored);closeDialog($('settings-dialog'));notice('Saved world loaded.');if(restored.winner!==null)showEnd(restored.winner);});
  }catch(e){notice('The save could not be loaded: '+e.message,true);}
};
$('export-button').onclick=()=>{
  const data=JSON.stringify({savedAt:new Date().toISOString(),world:world.serialize()},null,2),url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`first-light-${world.seed}-${Math.floor(world.time)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);notice('Save file exported.');
};
$('import-button').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
  const f=e.target.files?.[0];e.target.value='';if(!f)return;
  if(f.size>2000000){notice('This save file is too large. The limit is 2 MB.',true);return;}
  try{const data=JSON.parse(await f.text()),restored=World.restore(data.world??data);confirm('Load this world?','This file will replace the current world.',()=>{replaceWorld(restored);closeDialog($('settings-dialog'));saveGame();notice('World imported.');if(restored.winner!==null)showEnd(restored.winner);});}
  catch(error){notice('The file could not be loaded: '+error.message,true);}
};
function readSeed(id){
  const raw=Number($(id).value);if(!Number.isInteger(raw)||raw<1||raw>4294967295){notice('Use a whole-number seed from 1 to 4,294,967,295.',true);return null;}
  return raw;
}
$('new-world-button').onclick=()=>{
  const seed=readSeed('seed-input');if(seed===null)return;
  confirm('Begin a new world?','The current world will be replaced. Export it first to keep a copy.',()=>{
    startWorld(new World({seed,scenario:$('scenario-select').value,difficulty:$('difficulty-select').value}));
  });
};
$('title-button').onclick=()=>{closeDialog($('settings-dialog'));saveGame();showTitle();};
$('end-title-button').onclick=()=>{closeDialog($('end-dialog'));showTitle();};
$('end-new').onclick=()=>endAction?.();

// ---------------------------------------------------------------- results
function showEnd(winner){
  const won=winner===0,c=world.conquest,info=worldInfo(world),time=world.time;
  $('end-title').textContent=won?'A new dawn.':winner===1?'The light grows dim.':'A silent world.';
  $('end-text').textContent=won?'Your followers remain. Ember has fallen. The world is yours.':winner===1?'Your last followers are gone. A different world offers a new beginning.':'Neither side has followers left. The land waits for a new beginning.';
  $('end-eyebrow').textContent=c!==null?`WORLD ${info.number} OF ${CONQUEST.length} · ${info.name.toUpperCase()}`:'THE AGE IS COMPLETE';
  $('end-stats').innerHTML=`<span>${fmtTime(time)}<small>TIME</small></span><span>${Math.floor(world.population(0))}<small>FOLLOWERS</small></span><span>${world.edits}<small>LAND CHANGES</small></span><span>${Math.floor(world.kills[0])}<small>RIVALS FALLEN</small></span>`;
  // Best times: one per Long Dawn world, one per custom land and rival.
  let record='';
  if(won){
    const table=c!==null?progress.conquestBest:progress.records,key=c!==null?String(c):`${world.scenario}/${world.difficulty}`;
    const best=table[key];
    if(!best||time<best-.05){table[key]=time;record=best?`A new best time. The last was ${fmtTime(best)}.`:'Your first victory in this world.';}
    else record=`Best time for this world: ${fmtTime(best)}.`;
    if(c!==null)progress.unlocked=Math.max(progress.unlocked,c+1);
    saveProgress();
  }
  $('end-record').hidden=!record;$('end-record').textContent=record;
  const primary=$('end-new');
  if(c!==null&&won&&c+1<CONQUEST.length){
    primary.innerHTML=`Play the next world · ${CONQUEST[c+1].name} <span>↗</span>`;endAction=()=>{closeDialog($('end-dialog'));startConquest(c+1);};
  }else if(c!==null&&won){
    $('end-text').textContent='Every world of the Long Dawn is yours. Ember has no land left to wake in.';
    primary.innerHTML='Return to the title <span>↗</span>';endAction=()=>{closeDialog($('end-dialog'));showTitle();};
  }else if(c!==null){
    primary.innerHTML=`Try ${info.name} again <span>↗</span>`;endAction=()=>{closeDialog($('end-dialog'));startConquest(c);};
  }else{
    primary.innerHTML='Begin another world <span>↗</span>';endAction=()=>{closeDialog($('end-dialog'));$('seed-input').value=(world.seed+7919)>>>0;openDialog('settings-dialog');};
  }
  $('end-title-button').hidden=c!==null&&won&&c+1>=CONQUEST.length;
  openDialog('end-dialog');saveGame();
  sound.play(won?'victory':'defeat');rumble(won?.4:.6,won?300:500);
}
function processEvents(){
  for(const e of world.drainEvents()){
    if(e.type==='power'||e.type==='town'||e.type==='collapse'||e.type==='lost'||e.type==='battle'||e.type==='upgrade'||e.type==='clash')view?.emit(e);
    if(e.type==='town'&&e.team===0)sound.play('town');
    else if(e.type==='upgrade'&&e.team===0)sound.play('upgrade');
    else if(e.type==='collapse'&&e.team===0){sound.play('collapse');rumble(.25,90);}
    else if(e.type==='clash')sound.play('clash');
    else if(e.type==='battle'&&e.lost===0&&e.team===1&&performance.now()-lastTakenNotice>20000){lastTakenNotice=performance.now();notice('Ember has taken one of your homes.',true);}
    else if(e.type==='power'){
      if(e.team===0){sound.play(e.tool);if(['quake','volcano','flood','armageddon'].includes(e.tool))rumble(.6,280);}
      else if(['swamp','quake','volcano','flood','knight'].includes(e.tool)){notice(`Ember used ${TOOLS[e.tool].name.toLowerCase()}.`,true);sound.play('rival');rumble(.35,160);}
    }
    if(e.type==='end')showEnd(e.winner);
  }
}

// ---------------------------------------------------------------- HUD
function updateUI(){
  if(!world)return;
  const a=world.population(0),b=world.population(1);let towns=0;for(const t of world.towns)if(t.team===0)towns++;
  setText('mana-value',Math.floor(world.mana[0]).toLocaleString());setStyle('mana-track-fill','width',`${(world.mana[0]/MAX_MANA*100).toFixed(1)}%`);
  setText('mana-income',`+${world.armageddon?'0.0':world.income(0).toFixed(1)}/s`);
  setText('population-value',Math.ceil(a).toLocaleString());setText('town-value',towns);
  setText('dawn-count',Math.ceil(a).toLocaleString());setText('ember-count',Math.ceil(b).toLocaleString());setStyle('balance-fill','width',`${(a/Math.max(1,a+b)*100).toFixed(1)}%`);
  setText('rival-intent',world.armageddon?'The final battle is under way.':world.mode[1]==='fight'?'The rival god is attacking.':'The rival god is building.');
  setText('age-label','Day '+(Math.floor(world.time/30)+1));
  for(const [tool,btn]of toolButtons){btn.classList.toggle('unaffordable',world.mana[0]<TOOLS[tool].cost||world.armageddon);}
  for(const btn of document.querySelectorAll('[data-order]')){btn.classList.toggle('active',btn.dataset.order===world.mode[0]);btn.setAttribute('aria-pressed',String(btn.dataset.order===world.mode[0]));}
  for(const [id,done]of [['task-land',world.edits>=3],['task-home',towns>=7],['task-mana',world.mana[0]>=350]]){
    const el=$(id);el.classList.toggle('done',done);el.querySelector('b').textContent=done?'✓':'';
  }
  if(view)setText('zoom-label',(43/view.viewSize).toFixed(1)+'×');
}
function updateRendererDetails(){
  if(!view)return;const s=view.stats();
  $('renderer-details').textContent=`Three.js r${REVISION} · ${s.backend} · ${s.tier} quality · ${s.effects?'bloom'+(s.ao?' + ambient occlusion':''):'standard lighting'} · ${s.drawCalls} draw calls · local simulation`;
}
const map=$('minimap'),ctx=map.getContext('2d');
function drawMap(){
  if(!world)return;
  const width=map.width,height=map.height;ctx.fillStyle='#3c615b';ctx.fillRect(0,0,width,height);
  const size=height-16,cell=size/SIZE,left=(width-size)/2,top=8;
  for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
    const h=world.cellHeight(x,z);if(h<=world.sea)continue;
    ctx.fillStyle=world.scars[world.ci(x,z)]>0?'#766857':world.swamp[world.ci(x,z)]>0?'#626543':h>5?'#afb6a0':h<1.5?'#b8ad78':`hsl(${97+h*2},${23+h*2}%,${42+h*3}%)`;
    ctx.fillRect(left+x*cell,top+z*cell,Math.ceil(cell),Math.ceil(cell));
  }
  for(const t of world.towns){ctx.fillStyle=t.team===0?'#e3f6d5':'#df8968';ctx.fillRect(left+(t.x+.15)*cell,top+(t.z+.15)*cell,Math.max(3,cell*.75),Math.max(3,cell*.75));}
  for(const u of world.units){ctx.fillStyle=TEAM[u.team].color;ctx.fillRect(left+u.x*cell-1,top+u.z*cell-1,u.knight?4:2,u.knight?4:2);}
  if(view){
    const x=view.target.x+SIZE/2,z=view.target.z+SIZE/2;
    ctx.strokeStyle='#eff4cdaa';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(left+x*cell,top+z*cell,Math.min(32,view.viewSize*.7),0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f2f5d9';ctx.beginPath();ctx.moveTo(left+x*cell-5,top+z*cell);ctx.lineTo(left+x*cell+5,top+z*cell);ctx.moveTo(left+x*cell,top+z*cell-5);ctx.lineTo(left+x*cell,top+z*cell+5);ctx.stroke();
    setText('map-coords',`${Math.round(x)} / ${Math.round(z)}`);
  }
  // A quiet grid makes the whole-map view easy to read.
  ctx.strokeStyle='#dce8bb16';ctx.lineWidth=.5;
  for(let i=0;i<=SIZE;i+=6){ctx.beginPath();ctx.moveTo(left+i*cell,top);ctx.lineTo(left+i*cell,top+size);ctx.moveTo(left,top+i*cell);ctx.lineTo(left+size,top+i*cell);ctx.stroke();}
}
// The book of worlds is a HUD widget: a click moves the camera there.
map.addEventListener('click',e=>{
  if(!view)return;
  const r=map.getBoundingClientRect(),px=(e.clientX-r.left)/r.width*map.width,py=(e.clientY-r.top)/r.height*map.height;
  const size=map.height-16,left=(map.width-size)/2;view.focus(clamp((px-left)/size*SIZE,0,SIZE),clamp((py-8)/size*SIZE,0,SIZE));drawMap();
});
function updateLabels(){
  const W=kit.size.width,H=kit.size.height;
  for(let team=0;team<2;team++){
    const node=$(team===0?'dawn-label':'ember-label');let t=null;
    for(const town of world.towns)if(town.team===team){t=town;break;}
    if(!t||view.viewSize<15||W<800||onTitle||photo){node.hidden=true;continue;}
    const p=view.project(t.x+.5,t.z+.5);node.hidden=p.z<-1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;
    if(node.hidden)continue;
    setStyle(node.id,'left',Math.round((p.x*.5+.5)*W)+'px');setStyle(node.id,'top',Math.round((-p.y*.5+.5)*H-30)+'px');
  }
}
function hideHover(){if(hoverShown){$('hover-info').hidden=true;hoverShown=false;}}
function hoverInfo(p,cx,cy){
  if(!p||photo||kit.input.source==='touch'||kit.size.width<700){hideHover();return;}
  const x=Math.floor(p.x),z=Math.floor(p.z),t=world.towns.find(t=>t.x===x&&t.z===z),i=world.ci(clamp(x,0,SIZE-1),clamp(z,0,SIZE-1));
  const land=world.cellHeight(x,z)<=world.sea?'Open water':world.scars[i]>0?'Scorched land':world.swamp[i]>0?'Swamp':world.flat(x,z)?'Flat land':'Sloping land';
  const cost=world.cost(selected,p.x,p.z);
  $('hover-info').innerHTML=t?`<b>${TEAM[t.team].name} ${['','hut','house','hall','castle'][t.tier]}</b><span>${Math.ceil(t.pop)} followers · ${world.support(x,z)} clear tiles</span>`:`<b>${land}</b><span>${TOOLS[selected].name} · ${cost} mana${cost>TOOLS[selected].cost?' · beyond reach':''}</span>`;
  $('hover-info').style.left=clamp(cx+19,10,kit.size.width-235)+'px';$('hover-info').style.top=clamp(cy+18,145,kit.size.height-245)+'px';$('hover-info').hidden=false;hoverShown=true;
}
/** Where the HUD leaves the island visible: between the top panels and the power dock. */
function measureBand(){
  if(!view||!kit)return;
  const H=kit.size.height;
  if(photo||onTitle){view.setBand(0,H);return;}
  const top=document.querySelector('.topbar').getBoundingClientRect(),res=document.querySelector('.resources').getBoundingClientRect();
  const dock=document.querySelector('.power-dock').getBoundingClientRect();
  let t=Math.max(top.bottom,res.height?res.bottom:0),b=dock.height?dock.top:H;
  if(b-t<120){t=top.bottom;b=H;}
  view.setBand(t,b);
}

// ---------------------------------------------------------------- title
function refreshTitle(){
  const saved=restoredOnBoot||worldStarted;
  $('title-continue').hidden=!saved;
  if(saved&&world){
    const info=worldInfo(world);
    $('title-continue-info').textContent=`${world.conquest!==null?`World ${info.number} · `:''}${info.name} · Day ${Math.floor(world.time/30)+1}${world.winner!==null?' · complete':''}`;
  }
  const max=Math.min(progress.unlocked,CONQUEST.length-1);
  conquestPick=clamp(conquestPick,0,max);
  const c=CONQUEST[conquestPick],best=progress.conquestBest[conquestPick];
  $('title-conquest-info').textContent=`World ${String(conquestPick+1).padStart(2,'0')} of ${CONQUEST.length} · ${c.name} · ${c.difficulty} rival${best?` · best ${fmtTime(best)}`:''}`;
  $('conquest-story').textContent=progress.unlocked>=CONQUEST.length?`✦ The Long Dawn is complete. ${c.story}`:c.story;
  $('conquest-prev').disabled=conquestPick<=0;$('conquest-next').disabled=conquestPick>=max;
  $('title-conquest').classList.toggle('primary-button',!saved);$('title-conquest').classList.toggle('secondary-button',saved);
}
function showTitle(){
  onTitle=true;setPhoto(false);document.body.classList.add('on-title');$('title').hidden=false;
  conquestPick=Math.min(progress.unlocked,CONQUEST.length-1);
  refreshTitle();syncPause();view?.setCursor(null);hideHover();measureBand();
  requestAnimationFrame(()=>{const first=$('title-continue').hidden?$('title-conquest'):$('title-continue');first.focus({preventScroll:true});});
}
function hideTitle(){
  onTitle=false;document.body.classList.remove('on-title');$('title').hidden=true;$('title-custom-panel').hidden=true;$('title-custom').setAttribute('aria-expanded','false');
  syncPause();measureBand();view?.normalizeYaw();view?.resetCamera();kit?.input.settle();
}
$('title-continue').onclick=()=>{
  worldStarted=true;hideTitle();
  if(world.winner!==null)showEnd(world.winner);else notice('Your world is ready.');
};
$('title-conquest').onclick=()=>startConquest(conquestPick);
$('conquest-prev').onclick=()=>{conquestPick--;refreshTitle();sound.play('select');};
$('conquest-next').onclick=()=>{conquestPick++;refreshTitle();sound.play('select');};
$('title-custom').onclick=()=>{
  const open=$('title-custom-panel').hidden;$('title-custom-panel').hidden=!open;$('title-custom').setAttribute('aria-expanded',String(open));
  if(open){$('title-scenario').value=world.conquest===null?world.scenario:'first-light';$('title-difficulty').value='standard';$('title-seed').value=world.seed||481516;$('title-scenario').focus();}
};
$('title-custom-start').onclick=()=>{
  const seed=readSeed('title-seed');if(seed===null)return;
  guardReplace(()=>startWorld(new World({seed,scenario:$('title-scenario').value,difficulty:$('title-difficulty').value})));
};
$('title-help').onclick=()=>openDialog('help-dialog');
$('title-sound').onclick=()=>setAudio(!prefs.sound);

// ---------------------------------------------------------------- prompts for the device in use
const CONTROLS={
  keyboard:[['Move camera','Drag / WASD / arrow keys'],['Rotate camera','Right-drag / Q, E / rotate buttons'],['Zoom','Wheel / +, −'],['Use a power','Click · keys 1–0 choose · Enter uses it at the centre'],['Quick land tools','Right-click lowers · Shift-click levels'],['Followers','Z settle · X gather · C fight'],['Time and view','Space pause · F speed · H reset · G grid · V hide interface'],['Menu','Esc or P · ? opens this help']],
  gamepad:[['Move camera','Left stick / D-pad'],['Rotate and tilt','Right stick'],['Zoom','LT out · RT in'],['Choose a power','LB / RB'],['Use a power','A at the centre ring'],['Level land','B at the centre ring'],['Followers','X changes the order'],['Time and view','Y pause · R-stick reset · L-stick grid'],['Menu','Start · Back opens this help']],
  touch:[['Move camera','Drag with one finger'],['Zoom','Pinch'],['Rotate camera','Rotate buttons on the right'],['Use a power','Tap a power, then tap the land'],['Followers and time','Buttons under the powers'],['Menu','Settings button, top right']]
};
function renderControls(){
  const rows=CONTROLS[kit?.input.source]||CONTROLS.keyboard;
  $('controls-table').innerHTML=rows.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('');
}
function applySource(src){
  for(const s of ['keyboard','gamepad','touch'])document.body.classList.toggle('src-'+s,s===src);
  if(src==='gamepad')aimMode=true;else if(src==='touch')aimMode=false;
  $('power-status').textContent=src==='gamepad'?'LB / RB choose. A uses it at the ring.':src==='touch'?'Choose a power. Touch the world.':'Keys 1–0 choose. Click the world.';
  $('title-prompt').textContent=src==='gamepad'?'D-pad to choose · A to select · B to go back':src==='touch'?'Tap a choice to begin':'Click a choice · arrow keys and Enter work too';
  if($('help-dialog').open)renderControls();
}

// ---------------------------------------------------------------- menus with keys and gamepad
function focusables(root){
  return [...root.querySelectorAll('button, select, input, a[href]')].filter(el=>!el.disabled&&el.type!=='hidden'&&el.type!=='file'&&!el.hasAttribute('data-nav-skip')&&el.getClientRects().length>0);
}
function adjust(el,d){
  if(el.tagName==='SELECT'){const n=el.options.length;el.selectedIndex=(el.selectedIndex+d+n)%n;}
  else{const min=Number(el.min)||1,max=Number(el.max)||4294967295;el.value=String(clamp((Number(el.value)||min)+d,min,max));}
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function moveFocus(root,dir){
  const items=focusables(root);if(!items.length)return;
  document.body.classList.add('nav-focus');
  const i=items.indexOf(document.activeElement);
  if(i<0){items[0].focus();return;}
  const el=items[i];
  if((dir==='left'||dir==='right')&&(el.tagName==='SELECT'||(el.tagName==='INPUT'&&el.type==='number'))){adjust(el,dir==='right'?1:-1);return;}
  const side=dir==='left'?el.dataset.left:dir==='right'?el.dataset.right:null;
  if(side){const b=$(side);if(b&&!b.disabled)b.click();return;}
  items[(i+(dir==='up'||dir==='left'?-1:1)+items.length)%items.length].focus();
}
function menuRoot(){return topDialog()||(onTitle?$('title'):null);}
function menuBack(root){
  if(root.id==='title'){if(!$('title-custom-panel').hidden){$('title-custom-panel').hidden=true;$('title-custom').setAttribute('aria-expanded','false');$('title-custom').focus();}return;}
  closeDialog(root);
}
function menuNav(root,dt){
  const inp=kit.input,v=inp.vector('pan');let dir='';
  if(Math.abs(v.y)>.5&&Math.abs(v.y)>=Math.abs(v.x))dir=v.y>0?'up':'down';
  else if(Math.abs(v.x)>.5)dir=v.x>0?'right':'left';
  let fire=false;
  if(dir!==nav.dir){nav.dir=dir;nav.hold=0;fire=!!dir;}
  else if(dir){nav.hold+=dt;if(nav.hold>.38){nav.hold-=.12;fire=true;}}
  if(fire)moveFocus(root,dir);
  if(inp.pressed('cast')){
    const el=document.activeElement;
    if(!el||!root.contains(el)||el===root){document.body.classList.add('nav-focus');focusables(root)[0]?.focus();}
    else if(el.tagName==='SELECT')adjust(el,1);
    else if(!(el.tagName==='INPUT'&&el.type==='number'))el.click();
  }
  if(inp.pressed('back'))menuBack(root);
}
function handlePause(){
  if(photo){setPhoto(false);return;}
  const d=topDialog();
  if(d){closeDialog(d);return;}
  if(onTitle){menuBack($('title'));return;}
  openDialog('settings-dialog');
}

// ---------------------------------------------------------------- play input
function aimPoint(){return view.pick(0,view.centreNdcY());}
function cameraInput(dt,inp){
  const mv=inp.vector('pan');
  if(mv.x||mv.y){const s=dt*420;view.pan(-mv.x*s,mv.y*s);}
  const ob=inp.vector('orbit');
  if(ob.x||ob.y)view.turn(-ob.x*dt*1.5,ob.y*dt*.9);
  const zv=inp.value('zoom');if(zv)view.zoom(Math.exp(-zv*dt*1.2));
  const wheel=clamp(inp.zoom(),-3,3);if(wheel)view.zoom(Math.exp(-wheel*(inp.pointer.type==='touch'?.25:.15)));
}
/** Click or tap uses a power; a drag moves (or with the right button, turns) the camera; a pinch never casts. */
function pointerInput(inp){
  const p=inp.pointer;
  if(p.justDown){
    press.active=true;press.sx=press.lx=p.x;press.sy=press.ly=p.y;press.moved=false;press.pinched=false;press.type=p.type;
    press.rotate=inp.down('rightHold')||inp.down('altHold');
    press.tool=inp.down('middleHold')?null:inp.down('shiftHold')?'level':inp.down('rightHold')?'lower':'selected';
    if(p.type!=='touch')aimMode=false;
  }
  if(press.active){
    if(Math.hypot(p.x-press.sx,p.y-press.sy)>(press.type==='touch'?10:5))press.moved=true;
    if(press.type==='touch'&&inp.zoom()!==0)press.pinched=true;
    let dx,dy;
    if(press.type==='touch'){
      // One-finger drag arrives as the kit's look action, in radians: back to pixels (sensitivity and invert-Y undone).
      const lk=inp.look('drag'),s=kit.settings.get(),k=TOUCH_LOOK*(s.lookSensitivity||1);
      dx=lk.x/k;dy=lk.y/k*(s.invertY?-1:1);
    }else{dx=p.x-press.lx;dy=p.y-press.ly;}
    press.lx=p.x;press.ly=p.y;
    if(press.moved&&(dx||dy)){if(press.rotate)view.rotate(dx,dy);else view.pan(dx,dy);view.setCursor(null);hideHover();}
  }
  if(p.justUp&&press.active){
    press.active=false;
    if(!press.moved&&!press.pinched&&!photo&&press.tool){
      const at=view.pick(p.nx,p.ny);hover=at;
      attemptCast(press.tool==='selected'?selected:press.tool,at);
    }
  }
  if(!press.active&&p.type!=='touch'&&p.over){
    if(p.x!==hoverX||p.y!==hoverY){
      hoverX=p.x;hoverY=p.y;aimMode=inp.source==='gamepad';
      if(!aimMode){hover=view.pick(p.nx,p.ny);view.setCursor(photo?null:hover,selected);hoverInfo(hover,p.x,p.y);mouseCursor=true;}
    }
  }else if(!p.over&&!aimMode&&mouseCursor){mouseCursor=false;hover=null;view.setCursor(null);hideHover();}
}
function frameInput(dt){
  const inp=kit.input;
  if(inp.pressed('pause'))handlePause();
  const root=menuRoot();
  if(root){press.active=false;menuNav(root,dt);return;}
  nav.dir='';
  if(inp.pressed('photo'))setPhoto(!photo);
  if(inp.pressed('help')){openDialog('help-dialog');return;}
  cameraInput(dt,inp);
  pointerInput(inp);
  if(inp.pressed('home'))view.resetCamera();
  if(photo)return;
  for(let i=0;i<TOOL_KEYS.length;i++)if(inp.pressed('tool'+i))selectTool(TOOL_KEYS[i],{trigger:true});
  if(inp.pressed('prevTool'))cycleTool(-1);
  if(inp.pressed('nextTool'))cycleTool(1);
  if(inp.pressed('timeToggle'))togglePause();
  if(inp.pressed('speed'))cycleSpeed();
  if(inp.pressed('grid'))toggleGrid();
  for(const mode of ORDERS)if(inp.pressed(mode))setOrder(mode);
  if(inp.pressed('orderNext'))setOrder(ORDERS[(ORDERS.indexOf(world.mode[0])+1)%ORDERS.length]);
  if(inp.pressed('cast')){aimMode=true;attemptCast(selected,aimPoint());}
  if(inp.pressed('back')&&inp.source==='gamepad'){aimMode=true;attemptCast('level',aimPoint());}
}
function updateAim(dt){
  const show=aimMode&&!onTitle&&!photo&&!hasDialog();
  const ret=$('reticle');
  if(ret.hidden===show)ret.hidden=!show;
  if(!show)return;
  const x=Math.round(kit.size.width/2),y=Math.round((1-view.centreNdcY())/2*kit.size.height);
  setStyle('reticle','transform',`translate(${x}px,${y}px)`);
  pickClock+=dt;
  if(pickClock>.08){pickClock=0;hover=aimPoint();view.setCursor(hover,selected);hoverInfo(hover,x,y);}
}
function stepWorld(dt){
  if(world.paused||world.winner!==null)return;
  accumulator+=dt*speed;
  let steps=0;while(accumulator>=STEP&&steps<8){world.tick(STEP);accumulator-=STEP;steps++;}
  // A slow frame must not create an unbounded catch-up loop.
  if(steps>=8)accumulator=Math.min(accumulator,STEP);
}
function frame(dt,t){
  frameInput(dt);
  if(onTitle)view.turn(dt*.06,0);
  stepWorld(dt);
  processEvents();
  view.render(dt,t,clamp(accumulator/STEP,0,1));
  updateAim(dt);
  updateLabels();
  uiClock+=dt;mapClock+=dt;saveClock+=dt;
  if(uiClock>.25){updateUI();uiClock=0;}
  if(mapClock>.5){drawMap();mapClock=0;}
  if(saveClock>30){if(!hasDialog()&&!onTitle)saveGame();saveClock=0;}
}

// ---------------------------------------------------------------- start
const toolActions={};
TOOL_KEYS.forEach((key,i)=>{const d=TOOLS[key].key;toolActions['tool'+i]={keys:[`Digit${d}`,`Numpad${d}`]};});
kit=await boot({
  title:'Populous 1.5 — First Light',
  canvas:$('world'),
  gear:'none', // the game's own settings dialog has a Graphics button that opens the kit panel
  accent:'#d5e5ac',
  background:'#183d34',
  input:{
    // A pointer-driven god game: clicks and taps arrive through kit.input.pointer, one-finger
    // drags through the look action and pinches through zoom(), so touch needs no stick.
    pan:{type:'vector',keys:'wasd+arrows',gamepad:'leftStick+dpad'},
    drag:{type:'look',mouse:'drag',gamepad:[],touch:'drag'},
    orbit:{type:'vector',keys:{up:[],down:[],left:['KeyQ'],right:['KeyE']},gamepad:'rightStick',clamp:false},
    zoom:{type:'axis',keys:{pos:['Equal','NumpadAdd'],neg:['Minus','NumpadSubtract']},gamepad:{pos:'RT',neg:'LT'}},
    cast:{keys:['Enter','NumpadEnter'],gamepad:['A']},
    back:{keys:['Backspace'],gamepad:['B']},
    prevTool:{keys:['BracketLeft'],gamepad:['LB']},
    nextTool:{keys:['BracketRight'],gamepad:['RB']},
    ...toolActions,
    settle:{keys:['KeyZ']},gather:{keys:['KeyX']},fight:{keys:['KeyC']},
    orderNext:{gamepad:['X']},
    timeToggle:{keys:['Space'],gamepad:['Y']},
    speed:{keys:['KeyF']},
    grid:{keys:['KeyG'],gamepad:['LS']},
    home:{keys:['KeyH'],gamepad:['RS']},
    photo:{keys:['KeyV']},
    help:{keys:['Slash','F1'],gamepad:['Back']},
    pause:{keys:['Escape','KeyP'],gamepad:['Start']},
    rightHold:{mouse:[2]},middleHold:{mouse:[1]},
    altHold:{keys:['AltLeft','AltRight']},shiftHold:{keys:['ShiftLeft','ShiftRight']}
  }
});
kit.loading.progress(.7,'Building hills, homes, and quiet seas…');
{
  const saved=store.get(STORAGE);
  if(saved?.world){try{world=World.restore(saved.world);restoredOnBoot=true;}catch(error){console.warn('Stored world could not be restored:',error);}}
  if(!world)world=new World();
}
view=new WorldView(kit,world);
applyWorldText();
$('engine-badge').lastElementChild.textContent=kit.backendLabel.toUpperCase();
kit.onResize(()=>measureBand());
kit.onPause(p=>sound.hold(p||document.hidden));
kit.input.onSourceChange(applySource);applySource(kit.input.source);
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame();sound.hold(document.hidden||kit.paused);});
addEventListener('pagehide',()=>saveGame());
// Browsers start audio only from a gesture: every click, tap and key press may be the first.
for(const type of ['pointerdown','keydown'])addEventListener(type,()=>sound.unlock(),true);
setAudio(prefs.sound,true);updateUI();drawMap();
showTitle();view.resetCamera();
// Read-only access to common state is useful for browser tests and device profiling.
window.firstLight={get world(){return world;},get view(){return view;},get speed(){return speed;},get onTitle(){return onTitle;},save:()=>world.serialize(),get stats(){return view.stats();}};
kit.start(frame);
