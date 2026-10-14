/* Cinder Choir: campaign, exploration and battle presentation.
 * Core-loop seed: dist/handoff/game/game.js. Battle timing reference:
 * upstream src/starter/40-rpg.js. The bundled engine is unchanged. */
(() => {
'use strict';
const E=My3D2dge, CC=globalThis.CC, R=CC.RPG, D=CC.DATA, W=CC.WORLD, OW=CC.OVERWORLD, AD=CC.Adventure, px=E.px;
const clone=x=>JSON.parse(JSON.stringify(x));
const INPUT={...E.Input.DEFAULT,interact:['KeyE','Space','Pad0'],world:['KeyM','Pad8'],localmap:['KeyL'],company:['KeyC','Pad2'],pack:['KeyI'],journal:['KeyJ','Pad3'],vehicle:['KeyV','Pad4'],confirm:['Enter','Space','KeyE','KeyZ','Pad0'],dash:['ShiftLeft','ShiftRight','Pad5']};
const game=new E.Game({canvas:'screen',id:'cinder-choir-v1',res:[480,288],view:'threequarter',views:['threequarter'],input:INPUT,corner:false,fullscreen:'button',menu:{quit:'title',controls:{attack:false,jump:false,skill:false,dash:'Run',interact:'Talk and interact',world:'World chart',localmap:'Mission map',company:'Company',pack:'Pack',journal:'Journal',vehicle:'Board, fly, or land'},items:[['Save game',()=>requestPanel('save')],['Company',()=>requestPanel('party')],['World chart',()=>requestPanel('chart')]],settings:[{key:'battleMode',label:'Battle mode',options:['Wait','Active'],value:'Wait'},{key:'battleSpeed',label:'Battle speed',options:['Normal','Fast'],value:'Normal'},{key:'battleHints',label:'Show enemy weaknesses',value:true}]}});
// The canvas is the full window. Its logical size follows the window's aspect.
// Keep square pixels and cover the last fractional pixel at the bottom/right.
// Headless campaign tests retain the original 480 x 288 view unless requested.
const viewport={responsive:false,cssWidth:480,cssHeight:288,top:0,bottom:0,left:0,right:0};
let viewportFixture=null,resizingViewport=false;
function fitViewport(){
 const s=game.screen,rc=viewportFixture||s.canvas?.getBoundingClientRect();
 if(!rc||resizingViewport||!(rc.width>0&&rc.height>0))return;
 const width=rc.width,height=rc.height,dpr=viewportFixture?.dpr||s.dpr||1,short=Math.min(width,height),axis=short<600?240:360;
 const scale=short*dpr/axis,res=width<height?[axis,Math.ceil(axis*height/width-1e-8)]:[Math.ceil(axis*width/height-1e-8),axis];
 viewport.responsive=true;viewport.cssWidth=width;viewport.cssHeight=height;
 const changed=s.W!==res[0]||s.H!==res[1];
 resizingViewport=true;
 try{if(changed)s.setOptions({res});s.S=scale;s.OX=0;s.OY=0;}
 finally{resizingViewport=false;}
 // Lighting.render checks only pixel count. A rotation can keep that count but
 // change the image row width. Recreate its buffers through the public API.
 if(changed&&!game.headless){const old=game.lights,next=new E.Lighting(game);for(const key of ['enabled','ambient','dark','levels','glow','glowAt','darkness','tint','screen'])if(key in old)next[key]=old[key];game.lights=next;}
 layoutScene();
}
function clearViewport(){
 const exploration=['field','overworld'].includes(game.sceneName),k=Math.min(game.W,game.H)/Math.min(viewport.cssWidth,viewport.cssHeight);
 const top=Math.min(game.H*(exploration?.6:.35),viewport.top*k),bottom=Math.min(game.H,Math.max(top+(exploration?40:70),game.H-Math.min(game.H*.7,viewport.bottom*k)));
 const left=Math.min(game.W*.7,viewport.left*k),right=Math.min(game.W,Math.max(left+90,game.W-Math.min(game.W*.7,viewport.right*k)));
 return {top,bottom,height:bottom-top,left,right,width:right-left};
}
function setViewportInsets(insets={}){
 let changed=false;for(const key of ['top','bottom','left','right']){const n=Math.max(0,Number(insets[key])||0);if(viewport[key]!==n){viewport[key]=n;changed=true;}}
 if(changed)layoutScene();
 return viewportInfo();
}
function viewportInfo(){return{...viewport,width:game.W,height:game.H,clear:clearViewport(),zoom:game.zoom||1};}
function layoutScene(){
 if(!viewport.responsive||!game.sceneName)return;
 if(['battle','result','defeat'].includes(game.sceneName)){layoutBattle();return;}
 if(game.zoom!==1)game.setZoom(1);
 const clear=clearViewport();game.cam.offset=[(clear.left+clear.right-game.W)/2,(clear.top+clear.bottom-game.H)/2];game.cam.snap=true;
 if(game.sceneName==='field'&&hero)game.focus(hero.x,hero.y,13);
 if(game.sceneName==='overworld'&&traveller){game.setZoom(state.overworld.vehicle==='airship'?.8:1);game.focus(traveller.x,traveller.y,13);}
}
game.screen.listeners.push(fitViewport);
if(!game.headless){
 game.settings.define({...game.settings.spec('scale'),value:'fill'});fitViewport();
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>game.screen.resize()).observe(document.getElementById('viewport'));
 if(typeof visualViewport!=='undefined')visualViewport.addEventListener('resize',()=>game.screen.resize());
}
const SAVE='cinder-choir:campaign:v1:';
const talk=new E.Dialog(game,{speed:57,lines:4,bg:'#142a3b',border:'#b1b8a1',nameColor:'#e9cc8e',voice:null});
const listeners=new Set(), portraitRigs=Object.fromEntries(Object.keys(R.heroes).map(id=>[id,W.rig(id,1.1)]));
const places=Object.fromEntries(D.places.map(p=>[p.id,p]));
for(const q of [...D.chapters,...D.quests,...(D.missions||[])])q.objective=AD.definition(q)?.objective||q.objective;
let state=R.newGame(),world=null,hero=null,rigs=[],trail=[],near=null,modal=null,log=[],started=false;
let battle=null,battleField=null,visuals={},animation=null,commandMenu=null,targetMenu=null,selectedCommand=null,commandGroup='actions',auto=false,autoTimer=0;
let encounter=null,checkpoint=null,lastRewards=null,resultWait=0,uiClock=0,musicName=null,dialogQueue=[],dialogDone=null,sceneClock=0,tracked=null,returnParty=null;
let overworld=null,traveller=null,travellerRig=null,worldSaveClock=0;
let fieldChallenge=null,escortRig=null,escortRoute=[],escortClock=0,fieldSaveClock=0,localTargetIndex=0,localRouteCache=null,saveOnFieldEntry=false;
state.location=D.chapters[0].place;
const titleMenu=new E.Menu(game,['BEGIN JOURNEY','CONTINUE'],{onPick:i=>i===0?(CC.UI?requestPanel('difficulty'):startNew('normal')):loadLatest()});
const resultMenu=new E.Menu(game,['CONTINUE'],{onPick:()=>continueResult()});
const defeatMenu=new E.Menu(game,['RETRY BATTLE','RETURN TO WAYSTONE'],{onPick:i=>i===0?retryBattle():returnToCamp()});
const msg=(text,toast=false)=>{if(text){log.push(String(text));if(log.length>12)log.shift();if(toast)CC.UI?.toast(text);}notify();};
function notify(){for(const fn of listeners)fn();}
function music(name){if(musicName!==name){musicName=name;game.audio.music(W.songs[name]||W.songs.field);}}
function requestPanel(name,data){if(!started&& !['help','about','difficulty','save'].includes(name))return;if(game.paused)game.resume();CC.UI?.open(name,data);}
function allow(o){
 if(o===undefined||o===null)return true;if(Array.isArray(o))return o.every(allow);
 if(typeof o==='number')return state.chapter>=o;
 if(o==='act2')return state.act===2;
 return !!state.flags[o];
}
function unlocked(p){return p&& (p.id===state.location||allow(p.unlock)) && (state.act===2||p.unlock!=='airship');}
function available(){return (state.available||Object.keys(state.roster)).filter(id=>state.roster[id]);}
function missions(){return D.missions||[];}
function allTasks(){return [...D.chapters,...D.quests,...missions()];}
function taskAvailable(q){
 q=AD.quest(q);if(!q||state.flags[q.id]||!allow(q.requires)||!unlocked(places[q.place]))return false;
 const chapter=D.chapters.findIndex(x=>x.id===q.id);
 if(chapter>=0)return state.act===1&&state.chapter===chapter;
 if(D.quests.includes(q)&&state.act!==2)return false;
 if(q.postgame&&!state.flags.victory)return false;
 return !q.act||q.act===state.act||(q.catchup&&state.act===2);
}
function missionStatus(q){
 q=AD.quest(q);const status=AD.status(state,q),available=taskAvailable(q);
 return {...status,available,ready:available,targets:q?.place===state.location?AD.targets(state,q,world):[]};
}
function activeTask(){
 const id=tracked||state.tracked,chosen=allTasks().find(q=>q.id===id&&taskAvailable(q));if(chosen)return chosen;
 if(state.act===1)return D.chapters[state.chapter]||missions().find(taskAvailable)||null;
 const pending=D.quests.filter(taskAvailable);
 return pending.find(q=>q.place===state.location)||pending.find(q=>!q.finalBranch&&q.id!=='finale')||pending[0]||missions().find(taskAvailable)||null;
}
function tasksHere(){return allTasks().filter(q=>q.place===state.location&&taskAvailable(q));}
function localTask(){const chosen=activeTask();return chosen?.place===state.location?chosen:tasksHere().find(q=>AD.progress(state,q).started)||tasksHere()[0]||null;}
function refreshMissionObjects(){
 if(!world)return;world.objects=world.objects.filter(o=>o.type!=='mission');
 const q=localTask();if(q)world.objects.push(...AD.targets(state,q,world));
 for(const o of world.objects)if(o.type==='mission'&&['talk','rescue','escort'].includes(o.kind)&&!o.escorting)o.rig=W.missionRig(o,world);
 near=null;localTargetIndex=0;
}
function mountFieldObjects(){
 for(const o of world.objects)if(o.type==='enemy'){o.monster=W.makeMonster(o.formation[0]);o.body=new E.Body({x:o.x,y:o.y,r:4.4});}
 refreshMissionObjects();escortRig=null;escortRoute=[];escortClock=0;
}
function syncFieldContent(){
 if(!world)return;const previous=world,p=world.place;world=W.build(p,state.act,state);
 // Story and prop changes keep the existing public map and its baked floor.
 if(world.signature===previous.signature&&world.act===previous.act)world.map=previous.map;
 mountFieldObjects();
}
function localMapInfo(){
 const q=localTask(),status=q?missionStatus(q):null;
 let targets=status?.started?status.targets:world?.objects.filter(o=>o.type==='goal')||[];
 if(status?.escort&&hero&&E.dist(hero,status.escort)>180)targets=targets.map(o=>({...o,...status.escort,label:'Rejoin the group',regroup:true}));
 const target=targets[Math.min(localTargetIndex,Math.max(0,targets.length-1))]||null;
 const key=target&&hero?[Math.floor(hero.x/16),Math.floor(hero.y/16),target.id,Math.floor(target.x/16),Math.floor(target.y/16)].join(':'):'';
 if(localRouteCache?.world!==world||localRouteCache?.key!==key)localRouteCache={world,key,route:target?AD.path(world,hero,target):[]};
 const route=localRouteCache.route;
 return {world,hero:hero?{x:hero.x,y:hero.y}:null,task:q,status,targets,target,route,rooms:world?.rooms||[],gates:world?.gates||[],room:AD.roomAt(world,hero),evidence:status?.evidence||[],outcomes:world?.effects||[]};
}
function focusLocalTarget(index=0){localTargetIndex=Math.max(0,Number(index)||0);notify();return localMapInfo();}
function localRecords(){
 const records=[];
 for(const p of D.places)for(const act of [1,2]){
  if(act>state.act)continue;
  const atlas=CC.Atlas.build(p,act,state);
  for(const o of atlas.landmarks){const key=p.id+':lore:'+o.id+'@'+act;if(state.adventure.discoveries.includes(key))records.push({...o,text:state.adventure.recordTexts[key]||o.text,place:p.name,act});}
 }
 return records;
}
function fixState(s){
 s.available ||=Object.keys(s.roster);s.positions ||= {};s.visited ||= [];s.quests ||= [];s.chests ||= [];s.cleared ||= [];s.flags ||= {};s.log ||= [];
 if(!places[s.location])s.location=D.chapters[0].place;
 if(s.act===2&&!s.available.length)s.available=['iona'];
 s.missionProgress ||= {events:{},choices:{}};s.missionProgress.events ||= {};s.missionProgress.choices ||= {};
 s.overworld ||= {active:false,act:s.act,x:0,y:0,vehicle:'foot',discovered:[],opened:[],cleared:[],landmarks:[],waypoint:null,safeSpot:null};
 for(const key of ['discovered','opened','cleared','landmarks'])s.overworld[key] ||= [];
 s.overworld.discovered=[...new Set([...s.overworld.discovered,...s.visited,s.location])];
 if(s.overworld.act!==s.act){s.overworld.active=false;s.overworld.act=s.act;s.overworld.vehicle='foot';s.overworld.x=s.overworld.y=0;s.overworld.safeSpot=null;}
 AD.ensure(s);CC.Frontier?.ensure(s);CC.Undertide?.ensure(s);CC.Journey?.ensure(s);return s;
}
function validJourney(s){
 const record=x=>x&&typeof x==='object'&&!Array.isArray(x),strings=x=>Array.isArray(x)&&x.length<=2000&&x.every(v=>typeof v==='string'&&v.length<180),point=x=>record(x)&&Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.x>=0&&x.y>=0&&x.x<2816&&x.y<2304;
 if(s.missionProgress!==undefined){const m=s.missionProgress;if(!record(m)||!record(m.events)||!record(m.choices)||Object.keys(m.events).length>2000||Object.values(m.events).some(v=>v!==0&&v!==1))return false;
  for(const [id,i]of Object.entries(m.choices)){const q=missions().find(q=>q.id===id);if(!q?.decision||!Number.isInteger(i)||i<0||i>=q.decision.options.length)return false;}
 }
 if(s.overworld!==undefined){const o=s.overworld;if(!point(o)||typeof o.active!=='boolean'||![1,2].includes(o.act)||!['foot','boat','airship'].includes(o.vehicle))return false;
  if(['discovered','opened','cleared','landmarks'].some(k=>!strings(o[k])))return false;
  if(o.waypoint!==null&&!places[o.waypoint])return false;
  if(o.safeSpot!==null&&(!point(o.safeSpot)||(o.safeSpot.act!==undefined&&![1,2].includes(o.safeSpot.act))))return false;
 }
 return true;
}
function validate(s){
 if(!R.validateSave(s)||!validJourney(s)||!AD.validate(s)||![1,2].includes(s.act)||!Number.isInteger(s.chapter)||s.chapter<0||s.chapter>D.chapters.length||!places[s.location])return false;
 if(s.available&&(!Array.isArray(s.available)||new Set(s.available).size!==s.available.length||s.available.some(id=>!s.roster[id])||s.party.some(id=>!s.available.includes(id))))return false;
 if(s.teams){if(!Array.isArray(s.teams)||s.teams.length!==3||s.teams.some(a=>!Array.isArray(a)||a.length<2||a.length>4||a.some(id=>!s.roster[id]||!s.available.includes(id))))return false;const ids=s.teams.flat();if(new Set(ids).size!==ids.length)return false;}
 return true;
}
function snapshotSave(){
 if(hero&&world&&game.sceneName==='field')state.positions[state.location]={x:hero.x,y:hero.y};
 if(traveller&&game.sceneName==='overworld')syncTraveller();
 state.log=log.slice(-8);state.savedAt=new Date().toISOString();return clone(state);
}
function save(slot='auto',quiet=false){
 if(!started)return {ok:false,reason:'Start a journey first.'};
 if(['battle','defeat','result'].includes(game.sceneName)&&slot!=='checkpoint')return {ok:false,reason:'Finish the battle before you save.'};
 const s=snapshotSave();if(!validate(s))return {ok:false,reason:'The save could not be checked.'};
 const ok=E.store.set(SAVE+slot,s);if(!quiet)msg(ok?'Journey saved.':'Storage is blocked. Use Export save to keep this journey.',true);notify();return {ok};
}
function readSlot(slot){const s=E.store.get(SAVE+slot,null);return validate(s)?s:null;}
function latest(){return ['auto','1','2','3','recovery'].map(readSlot).filter(Boolean).sort((a,b)=>(b.savedAt||'').localeCompare(a.savedAt||''))[0]||null;}
function load(s){
 if(!validate(s))return {ok:false,reason:'This save is not valid for Cinder Choir.'};
 state=fixState(clone(s));started=true;modal=null;fieldChallenge=null;battle=null;animation=null;encounter=null;dialogQueue=[];talk.close();log=state.log||[];tracked=state.tracked;hero=null;world=null;
 const restoreWorld=state.overworld.active;overworld=null;traveller=null;game.resume();enterPlace(state.location,true);if(restoreWorld)enterOverworld({restore:true});
 const unfinishedEnding=(state.flags.finale||state.flags.victory)&&!state.flags.credits;if(unfinishedEnding)beginEnding();
 game.go(unfinishedEnding?'ending':restoreWorld?'overworld':'field',null,{fade:0});msg('Journey restored.');return {ok:true};
}
function loadLatest(){const s=latest();if(s)return load(s);msg('There is no saved journey yet.',true);return {ok:false};}
function startNew(difficulty='normal'){
 const previous=latest();if(previous)E.store.set(SAVE+'recovery',previous);
 state=fixState(R.newGame(difficulty));state.location=D.chapters[0].place;state.available=Object.keys(state.roster);state.positions={};state.visited=[];state.tracked=null;state.startedAt=new Date().toISOString();
 overworld=null;traveller=null;started=true;modal=null;fieldChallenge=null;log=[];tracked=null;auto=false;battle=null;animation=null;encounter=null;hero=null;world=null;talk.close();game.resume();
 enterPlace(state.location,true);game.go('field',null,{fade:0});msg('Read the field briefing at the gold beacon. Press L for the mission map.');msg('The green waystone restores HP and MP at no cost.');save('auto',true);notify();
}
function savePosition(){if(hero&&world)state.positions[world.place.id]={x:hero.x,y:hero.y};}
function branchFor(id){return D.quests.filter(q=>q.finalBranch).findIndex(q=>q.place===id);}
function setTeams(teams){
 const all=teams.flat();if(teams.length!==3||teams.some(t=>t.length<2||t.length>4)||new Set(all).size!==all.length||all.some(id=>!available().includes(id)))return {ok:false,reason:'Use three teams. Put two to four different companions in each team.'};
 state.teams=clone(teams);state.mainParty=state.party.slice();save('auto',true);return {ok:true};
}
function enterPlace(id,force=false){
 if(talk.open){msg('Finish this conversation before you travel.',true);return false;}
 const p=places[id];if(!p)return false;if(!force&&!unlocked(p)){msg('This route is still closed.',true);return false;}
 const bi=branchFor(id);
 if(bi>=0&&!state.teams){if(available().length<6){msg('Find at least six companions before the final assault.',true);return false;}requestPanel('teams',{destination:id});return false;}
 savePosition();state.location=id;if(!state.visited.includes(id))state.visited.push(id);
 state.overworld.active=false;if(!state.overworld.discovered.includes(id))state.overworld.discovered.push(id);
 if(bi>=0){state.mainParty ||= state.party.slice();R.setParty(state,state.teams[bi]);}
 else if(state.mainParty){const ids=state.mainParty.filter(h=>available().includes(h));if(ids.length)R.setParty(state,ids);}
 const fieldPlace={...p};
 AD.ensure(state);world=W.build(fieldPlace,state.act,state);const saved=force&&state.positions[id],spawn=saved&&world.map.standable(saved.x,saved.y,0,5)&&AD.path(world,world.spawn,saved).length?saved:world.spawn;
 hero=new E.Body({...spawn,r:4.4});hero.facing=-Math.PI/2;
 rigs=state.party.map(h=>W.rig(h,1.07));trail=Array.from({length:100},(_,i)=>{const x=hero.x+Math.min(i*.9,60);return{x:world.map.standable(x,hero.y,0,4.4)?x:hero.x,y:hero.y,facing:hero.facing};});near=null;
 mountFieldObjects();fieldChallenge=null;fieldSaveClock=0;
 sceneClock=0;modal=null;game.go('field',{id});musicName=null;notify();return true;
}
function travel(id){if(!started||talk.open||['battle','result','defeat'].includes(game.sceneName))return false;modal=null;talk.close();return enterPlace(id);}
function startTalk(entries,done){
 dialogQueue=(entries||[]).map(e=>typeof e==='string'?{speaker:'',text:e}:e).filter(e=>!e.when||allow(e.when));dialogDone=done||null;nextTalk();
}
function nextTalk(){
 const entry=dialogQueue.shift();
 if(!entry){talk.close();const fn=dialogDone;dialogDone=null;if(fn)fn();notify();return;}
 const speaker=entry.speaker||entry.name||'',name=R.heroes[speaker]?.name||speaker;
 talk.say(entry.text||'',{name:name||undefined,portrait:portraitRigs[speaker]||null,portraitSize:45,onDone:nextTalk});
 msg((name?name+': ':'')+(entry.text||''));notify();
}
function scenarioStatus(q){return missionStatus(q);}
function runMissionChoice(q,proceed){
 if(!q.decision||Number.isInteger(state.missionProgress.choices[q.id])){proceed();return;}
 const d=q.decision;talk.say(d.prompt,{name:R.heroes[d.speaker]?.name||d.speaker||'A CHOICE',choices:d.options.map(o=>o.label),onChoice:i=>{
  if(!d.options[i]||Number.isInteger(state.missionProgress.choices[q.id]))return;
  state.missionProgress.choices[q.id]=i;const option=d.options[i];if(option.flag)state.flags[option.flag]=true;
  reward(option.reward);if(option.reward?.xp)R.grantXP(state,option.reward.xp);save('auto',true);
  game.after(0,()=>startTalk(option.lines,proceed));
 }});notify();
}
function fieldMusic(){return localTask()?.reward?.bond?'bond':world?.place.music||(state.act===2?'ruin':world?.place.kind==='town'?'town':world?.place.kind==='wild'?'field':'dungeon');}
function beginMission(q){
 q=AD.quest(q);if(!q||q.place!==state.location||!taskAvailable(q)||game.sceneName!=='field'||talk.open)return false;
 tracked=q.id;state.tracked=q.id;fieldChallenge=null;
 const first=AD.start(state,q),def=AD.definition(q);refreshMissionObjects();music(fieldMusic());save('auto',true);
 if(first){
  const entries=q.catchup&&state.act===2?[{speaker:'Narrator',text:'The company reopens an unfinished case from the old roads.'},...def.briefing]:def.briefing;
  startTalk(entries,()=>{refreshMissionObjects();save('auto',true);msg(AD.status(state,q).step?.title||'Return to the field desk.',true);});
 }else if(AD.status(state,q).finished)finishMission(q);
 else{msg(AD.status(state,q).step.description,true);notify();}
 return true;
}
function activateTask(q){return beginMission(q);}
function finishMission(q){
 if(!q||state.flags[q.id]||!AD.status(state,q).finished)return false;
 const proceed=()=>runMissionChoice(q,()=>completeTask(q));
 if(!q.battle&&(!q.decision||!Number.isInteger(state.missionProgress.choices[q.id])))startTalk(AD.definition(q).climax||q.before,proceed);else proceed();
 return true;
}
function completeStage(q,lines){
 const status=AD.status(state,q),step=status.step;if(!step)return false;
 // A chosen plan must exist before the final field action applies its result.
 if(!q.battle&&q.decision&&status.index===status.total-1&&!Number.isInteger(state.missionProgress.choices[q.id])){
  startTalk(AD.definition(q).climax||q.before,()=>runMissionChoice(q,()=>completeStage(q,lines)));return true;
 }
 if(!AD.completeStep(state,q))return false;
 if(step.opensGate&&q.finalBranch){state.flags[q.place+':relay:0']=true;state.flags[q.place+':relay:1']=true;}
 fieldChallenge=null;syncFieldContent();save('auto',true);game.audio.sfx(step.opensGate?'secret':'pickup');
 if(step.visual)game.particles.glints(hero.x,hero.y,12,15,'#a7dfbd');
 startTalk(lines||step.lines||[],()=>{
  if(AD.status(state,q).finished)finishMission(q);
  else{refreshMissionObjects();save('auto',true);msg(AD.status(state,q).step.title,true);}
 });return true;
}
function currentChallenge(){
 if(!fieldChallenge)return null;
 const c={...fieldChallenge};
 c.draft=AD.draft(state,c.missionId);
 if(c.kind==='circuit'){const b=CC.UndertidePuzzles.get(c.board);c.layout={id:b.id,w:b.w,h:b.h,masks:b.masks.slice(),source:b.source,receivers:b.receivers.slice(),alarms:b.alarms.slice(),initial:b.initial.slice()};c.draft=AD.draft(state,c.missionId);}
 return c;
}
function setChallengeDraft(answer){
 const c=fieldChallenge;if(!c||game.sceneName!=='field')return {ok:false,reason:'Open a field challenge first.'};
 const q=AD.quest(c.missionId);if(AD.status(state,q).step?.id!==c.stageId||!AD.setDraft(state,q,answer))return {ok:false,reason:'This field setting is not valid.'};
 save('auto',true);return {ok:true,draft:answer.slice(),...(c.kind==='circuit'?{status:CC.UndertidePuzzles.inspect(c.board,answer)}:{})};
}
function submitChallenge(answer){
 const c=fieldChallenge;if(!c)return {ok:false,reason:'There is no open field challenge.'};
 const q=AD.quest(c.missionId),step=AD.status(state,q).step;
 if(!step||step.id!==c.stageId||game.sceneName!=='field')return {ok:false,reason:'This field step has changed.'};
 if(!AD.checkAnswer(step,answer)){
  game.audio.sfx('bump');const reason=step.challenge.failure||'Check the local clue and try again.';msg(reason,true);return {ok:false,reason};
 }
 fieldChallenge=null;CC.UI?.close();modal=null;
 AD.recordPlan(state,q,answer);
 const entries=[...(step.challenge.success?[{speaker:'Field notes',text:step.challenge.success}]:[]),...(step.lines||[])];
 completeStage(q,entries);return {ok:true};
}
function actMission(targetIndex=0){
 const q=localTask();if(!q||game.sceneName!=='field'||talk.open||modal)return false;
 const status=missionStatus(q),step=status.step,target=status.targets.find(o=>o.targetIndex===targetIndex);
 if(!status.started||!step||!target||E.dist(hero,target)>27){msg('Move to the marked field target first.',true);return false;}
 if(status.escort){msg('Wait here for the group to reach you.',true);return true;}
 if(['puzzle','sequence','tune','sort','allocate','circuit'].includes(step.kind)){
  fieldChallenge={...step.challenge,kind:step.kind,title:step.title,description:step.description,missionId:q.id,stageId:step.id};
  if(CC.UI)requestPanel('challenge');notify();return true;
 }
 if(step.kind==='battle'){
  if(q.finalBranch){const branches=D.quests.filter(x=>x.finalBranch),i=branches.findIndex(x=>x.id===q.id),other=branches[(i+2)%branches.length];
   if(!state.flags[other.place+':relay:0']){startTalk([{speaker:'Company signal',text:'The return signal is missing. Open the route in '+places[other.place].name+', then return here. Your work on this path is saved.'}]);return false;}
  }
  const spec=step.battle||q.battle,def=AD.definition(q),lastBattle=!def.steps.slice(status.index+1).some(s=>s.kind==='battle');
  if(!spec?.enemies?.length){msg('This encounter has no formation.',true);return false;}
  const begin=()=>startBattle(spec,{taskId:q.id,stageId:step.id,quest:state.act===2,final:q.id==='finale'});
  startTalk(step.before||(lastBattle?def.climax||q.before:step.lines),()=>lastBattle?runMissionChoice(q,begin):begin());return true;
 }
 if(step.kind==='escort'){
  const p=AD.progress(state,q);p.escort={x:target.x,y:target.y};escortRig=W.missionRig(target,world);escortRoute=[];escortClock=0;
  refreshMissionObjects();save('auto',true);
  startTalk(step.startLines||[{speaker:'Company',text:step.description+' Stay with the group as you move. The escort marker shows the safe destination.'}]);return true;
 }
 const entries=step.targets?.[targetIndex]?.lines||step.lines||[];
 if(step.targets?.length){
  const p=AD.progress(state,q);if(p.targets.includes(targetIndex)||(step.kind==='trail'&&targetIndex!==p.targets.length))return false;p.targets.push(targetIndex);
  if(p.targets.length<step.targets.length){refreshMissionObjects();save('auto',true);startTalk(entries);notify();return true;}
 }
 return completeStage(q,step.targets?.length?[...entries,...(step.lines||[])]:entries);
}
function updateEscort(dt){
 const q=localTask();if(!q)return;const status=AD.status(state,q),p=AD.progress(state,q),follower=p.escort;if(!follower)return;
 const destination=world.anchors[status.step.to];if(!destination)return;
 escortRig ||= W.missionRig({speaker:status.step.lines?.[0]?.speaker,kind:'escort'},world);
 const distance=E.dist(hero,follower);escortClock-=dt;
 if(distance>12&&distance<200){
  if(escortClock<=0||!escortRoute.length){escortRoute=AD.path(world,follower,hero);escortClock=.3;}
  while(escortRoute.length&&E.dist(follower,escortRoute[0])<3)escortRoute.shift();
  const next=escortRoute[0]||hero,dx=next.x-follower.x,dy=next.y-follower.y,d=Math.hypot(dx,dy),move=Math.min(d,94*dt),n=Math.max(1,Math.ceil(move/3));
  for(let i=0;i<n&&d;i++){
   const x=follower.x+dx/d*move/n,y=follower.y+dy/d*move/n;
   if(world.map.standable(x,y,0,4.4)){follower.x=x;follower.y=y;}
  }
 }
 escortRig.update(dt,{x:follower.x,y:follower.y,z:0,vx:distance>12?35:0,vy:0,facing:Math.atan2(hero.y-follower.y,hero.x-follower.x)});
 if(E.dist(hero,destination)<25&&E.dist(follower,destination)<29)completeStage(q);
}
function reward(data){
 if(!data)return;
 if(data.gold)state.gold+=data.gold;
 if(data.item)state.bag[data.item]=(state.bag[data.item]||0)+(data.count||1);
 if(data.gear)state.bag[data.gear]=(state.bag[data.gear]||0)+1;
 if(data.echo&&!state.echoes.includes(data.echo)){state.echoes.push(data.echo);msg('Echo found: '+R.echoes[data.echo].name+'. Equip it from Company.',true);}
 if(data.flag)state.flags[data.flag]=true;
 if(data.recruit){R.recruit(state,data.recruit);if(!state.available.includes(data.recruit))state.available.push(data.recruit);if(!state.party.includes(data.recruit)&&state.party.length<4)state.party.push(data.recruit);msg(R.heroes[data.recruit].name+' joins the company.',true);}
}
function completeTask(q){
 if(state.flags[q.id])return;
 AD.finish(state,q);state.flags[q.id]=true;if(!state.quests.includes(q.id))state.quests.push(q.id);
 const trial=places[q.place]?.trial;if(trial==='relay')for(let i=0;i<2;i++)state.flags[q.place+':relay:'+i]=true;
 if(trial==='rescue')for(let i=0;i<3;i++)state.flags[q.place+':rescue:'+i]=true;if(trial==='bells')state.flags[q.place+':bells']=true;
 reward(q.reward);
 const frontierReward=CC.Frontier?.onMissionComplete(state,q);
 if(frontierReward?.message)msg(frontierReward.message,true);
 const amount=q.reward?.xp||(state.act===1?60+state.chapter*35:200+(q.battle?.level||12)*30);R.grantXP(state,amount);
 if(D.chapters.some(c=>c.id===q.id))state.chapter=Math.min(D.chapters.length,state.chapter+1);
 tracked=null;state.tracked=null;
 // Clear after a chapter so backtracking does not repeat its set encounters.
 for(const o of world?.objects||[])if(o.type==='enemy'&&!state.cleared.includes(o.key))state.cleared.push(o.key);
 startTalk(AD.definition(q).conclusion||q.after,()=>{
  if(q.collapse){game.go('collapse');return;}
  if(q.id==='finale'){beginEnding();return;}
  const loc=state.location;enterPlace(loc,true);save('auto',true);msg(q.title+' — complete.',true);
 });
}
function frontierAction(action,...args){
 if(!started||talk.open||!['field','overworld'].includes(game.sceneName))return {ok:false,reason:'Return to the field before using the workshop.'};
 const res=CC.Frontier[action](state,...args);
 if(res.ok){save('auto',true);game.audio.sfx(action==='craft'?'pickup':'coin');notify();}
 return res;
}
function workshopInfo(){
 const F=CC.Frontier;
 return {materials:Object.values(F.materials).map(m=>({...m,owned:state.frontier?.materials[m.id]||0})),recipes:Object.values(F.recipes).map(r=>({...r,...F.recipeStatus(state,r.id)})),bonds:Object.values(F.bonds).map(b=>({...b,unlocked:!!state.frontier?.bonds[b.hero]||!!state.flags[b.flag]}))};
}
function trialInfo(){return Object.keys(CC.Undertide.trials).map(id=>CC.Undertide.trialStatus(state,id));}
function journeyReady(){return started&&!talk.open&&!fieldChallenge&&[null,'menu','party','pack','preparation','recovery','trials'].includes(modal)&&['field','overworld'].includes(game.sceneName);}
function journeyOptions(){return {partyLocked:game.sceneName==='field'&&branchFor(state.location)>=0};}
function journeyAction(action,...args){
 if(!journeyReady())return {ok:false,reason:'Return to the field to prepare the company.'};
 const res=CC.Journey[action](state,...args);
 if(res.ok){
  if(action==='applyLoadout'){const panel=modal;state.mainParty=state.party.slice();if(game.sceneName==='overworld')travellerRig=W.rig(state.party[0],.65);else enterPlace(state.location,true);modal=panel;game.input.clear();}
  save('auto',true);game.audio.sfx('pickup');notify();
 }
 return res;
}
function loadoutInfo(){return CC.Journey.ensure(state).loadouts.map((saved,slot)=>({slot,saved,preview:CC.Journey.loadoutPreview(state,slot,journeyOptions())}));}
function previewLoadout(slot){return journeyReady()?CC.Journey.loadoutPreview(state,slot,journeyOptions()):{ok:false,reason:'Return to the field to prepare the company.'};}
function recoveryPreview(options={}){return journeyReady()?CC.Journey.recoveryPreview(state,options):{ok:false,reason:'Return to the field to use recovery items.'};}
function startTrial(id,options={}){
 if(!journeyReady())return {ok:false,reason:'Return to the field to start a trial.'};
 const info=CC.Undertide.trialStatus(state,id);
 if(!info.practiceReady)return {ok:false,reason:info.reason||'Finish this trial story in Drift Court to open practice.'};
 const isWorld=game.sceneName==='overworld';if(isWorld)syncTraveller();
 startBattle(CC.Undertide.trialSpec(id,true,{matchedLevel:options.matchedLevel===true}),{practice:true,overworld:isWorld,theme:'undertide'});return {ok:true};
}
function collapse(){
 state.act=2;state.flags.act2=true;state.overworld.active=false;state.overworld.act=2;state.overworld.vehicle='foot';state.overworld.safeSpot=null;overworld=null;traveller=null;state.available=['iona'];state.party=['iona'];state.mainParty=null;state.teams=null;
 for(const[id,h]of Object.entries(state.roster))if(id!=='iona')h.echo=null;
 R.healParty(state);state.resonance=0;state.positions={};const q=D.quests.find(q=>q.id==='q_airship');state.location=q?.place||'cinderstrand';tracked='q_airship';state.tracked=tracked;
 enterPlace(state.location,true);startTalk([{speaker:'iona',text:'The towers are gone. The voices are not.'},{speaker:'iona',text:'I can still hear them across the water. I will find everyone I can.'}],()=>save('auto',true));
}
function interact(obj=near){
 if(game.sceneName==='overworld')return interactOverworld(obj);
 if(!obj||modal||talk.open||game.sceneName!=='field')return false;
 if(obj.type==='mission')return actMission(obj.targetIndex);
 if(obj.type==='local-lore'){const key=obj.key+'@'+state.act,text=typeof obj.text==='string'?obj.text:obj.text?.[state.act-1]||obj.description||'';if(!state.adventure.discoveries.includes(key))state.adventure.discoveries.push(key);state.adventure.recordTexts[key]=text;startTalk([{speaker:obj.label,text}],()=>save('auto',true));return true;}
 if(obj.type==='exit')return enterOverworld();
 if(obj.type==='camp'){R.healParty(state);save('auto',true);game.audio.sfx('heal');game.particles.glints(hero.x,hero.y,12,20,'#8ce2c7');msg('The waystone restores the company. Your journey is saved.',true);return true;}
 if(obj.type==='shop'){requestPanel('shop',{tier:world.place.shop||0});return true;}
 if(obj.type==='npc'){
  state.missionProgress.events['npc:'+state.location+':'+obj.npc.name]=1;
  let lines=obj.npc.lines||world.place.ambient||[];
  for(const v of obj.npc.afterLines||[])if(allow(v.requires))lines=v.lines;
  for(const [flag,variant]of Object.entries(obj.npc.after||{}))if(allow(flag))lines=variant;
  startTalk(lines.map(s=>typeof s==='string'?{speaker:obj.npc.hero||obj.npc.name,text:s}:s),()=>save('auto',true));return true;
 }
 if(obj.type==='chest'){
  if(state.chests.includes(obj.key)){msg('The chest is empty.',true);return true;}
  state.chests.push(obj.key);reward(obj.reward);const parts=[];if(obj.reward.gold)parts.push(obj.reward.gold+' gold');if(obj.reward.item)parts.push((obj.reward.count||1)+' '+(R.items[obj.reward.item]?.name||obj.reward.item));if(obj.reward.gear)parts.push(R.equipment[obj.reward.gear]?.name);if(obj.reward.echo)parts.push(R.echoes[obj.reward.echo]?.name+' Echo');
  game.audio.sfx('pickup');game.particles.glints(obj.x,obj.y,8,10,'#efda9c');msg('Found '+parts.filter(Boolean).join(' and ')+'.',true);save('auto',true);return true;
 }
 if(obj.type==='goal'){
  const tasks=tasksHere();if(!tasks.length){startTalk([{speaker:world.place.name,text:world.place.description},...(world.place.ambient||[]).map(text=>({speaker:'Field notes',text}))]);return true;}
  if(tasks.length>1&&CC.UI){requestPanel('objectives',{tasks});return true;}return activateTask(tasks.find(q=>q.id===(tracked||state.tracked))||tasks[0]);
 }
 if(obj.type==='enemy'){startBattle({enemies:obj.formation,level:world.place.level,boss:false},{key:obj.key});return true;}
 return false;
}

function startBattle(spec,context={}){
 modal=null;talk.close();dialogQueue=[];save('checkpoint',true);checkpoint=clone(state);encounter={...context,spec:clone(spec)};
 battle=R.createBattle(state,spec);battleField=W.battleField(context.theme||(world?.place.undertide?'undertide':world?.place.theme)||'ruins');visuals={};animation=null;selectedCommand=null;commandMenu=null;targetMenu=null;commandGroup='actions';resultWait=0;autoTimer=0;
 battle.heroes.forEach((a,i)=>{visuals[a.id]={x:325+(i%2)*18,y:50+i*44,z:0,baseX:325+(i%2)*18,baseY:50+i*44,rig:W.rig(a.id,1.12),attack:new E.Attack(({iona:'cast',brann:'overhead',sable:'thrust',oren:'throw',mira:'cast',tern:'roundhouse',vale:'cast',rook:'bash',nera:'thrust',pax:'cast'})[a.id]),hurt:0,hero:true};});
 battle.enemies.forEach((a,i)=>{const boss=!!a.boss,m=W.makeMonster(a.baseId,boss);visuals[a.id]={x:128+(i%2)*39,y:battle.enemies.length===1?121:55+i*64,z:0,baseX:128+(i%2)*39,baseY:battle.enemies.length===1?121:55+i*64,monster:m,rig:m.rig,attack:new E.Attack(boss?'overhead':'claw'),hurt:0,hero:false};});
 game.go('battle');musicName=null;notify();return battle;
}
function layoutBattle(){
 if(!battle)return;
 const clear=clearViewport(),zoom=Math.max(.5,Math.min(1,(clear.width-16)/390,clear.height/175));
 if(game.zoom!==zoom)game.setZoom(zoom);
 const stageWidth=Math.min(480,clear.width-24),cx=(clear.left+clear.right)/2,cy=(clear.top+clear.bottom)/2;
 game.cam.offset=[cx-game.W/2,cy-game.H/2];game.cam.snap=true;game.focus(224,126,0);
 const center=game.view.p(224,126,0),feet=clear.top+clear.height*.65;
 const position=(a,sx,sy)=>{const v=visuals[a.id],p=game.view.toGround(center[0]+sx-cx,center[1]+sy-cy);if(!v||!p)return;v.baseX=v.x=p[0];v.baseY=v.y=p[1];};
 battle.heroes.forEach((a,i)=>position(a,cx+stageWidth*.29+(i%2?13:-13)*zoom,feet+(i-(battle.heroes.length-1)/2)*30*zoom));
 battle.enemies.forEach((a,i)=>position(a,cx-stageWidth*.29+(i%2?8:-4)*zoom,feet-5*zoom+(i-(battle.enemies.length-1)/2)*50*zoom));
}
function groupCommands(){return battle?.ready?R.commands(battle,battle.ready).filter(c=>c.group===commandGroup):[];}
function commandGroups(){return ['actions','spells','summons','bonds','support','items'];}
function buildCommandMenu(){
 if(!battle?.ready){commandMenu=null;return;}
 const commands=groupCommands();commandMenu=new E.Menu(game,commands.map(c=>({label:c.label||c.name,id:c.id,disabled:!c.enabled})),{onPick:(_,item)=>chooseCommand(item.id)});
}
function setCommandGroup(group){commandGroup=group;selectedCommand=null;targetMenu=null;buildCommandMenu();notify();}
function targetsFor(c){
 if(!battle)return [];
 if(c.target==='enemy')return battle.enemies.filter(a=>a.alive);
 if(c.target==='ally')return battle.heroes.filter(a=>a.alive);
 if(c.target==='deadAlly')return battle.heroes.filter(a=>!a.alive);
 return [];
}
function chooseCommand(id){
 if(!battle?.ready||animation||battle.result)return false;
 const c=R.commands(battle,battle.ready).find(c=>c.id===id);if(!c?.enabled){msg(c?.disabledReason||c?.reason||'That command is not ready.',true);return false;}
 selectedCommand=c;const targets=targetsFor(c);
 if(['enemy','ally','deadAlly'].includes(c.target)){
  if(!targets.length){selectedCommand=null;msg('There is no valid target.',true);return false;}
  targetMenu=new E.Menu(game,targets.map(t=>({label:t.name,id:t.id})),{onPick:(_,item)=>perform(id,item.id),onCancel:cancelTarget});notify();return true;
 }
 return perform(id,c.target==='self'?battle.ready:undefined);
}
function cancelTarget(){selectedCommand=null;targetMenu=null;notify();}
function perform(command,target){
 if(!battle?.ready||animation||battle.result)return false;
 const source=battle.ready,c=R.commands(battle,source).find(x=>x.id===command),res=R.act(battle,source,command,target);
 if(!res.ok){msg(res.reason,true);return false;}
 selectedCommand=null;targetMenu=null;commandMenu=null;
 animateEvents(battle.events.splice(0),source,c);notify();return true;
}
function animateEvents(events,source=null,c=null){
 if(!events.length)return;
 const cast=events.find(e=>e.type==='cast');
 if(!c&&cast)c=R.skills[cast.command]||{id:cast.command,kind:cast.element==='physical'?'physical':'magic',element:cast.element};
 if(!cast&&!events.some(e=>['hit','heal','revive','status','ko'].includes(e.type))){for(const e of events)if(e.text)msg(e.text);return;}
 source ||=events.find(e=>e.source)?.source;const vis=visuals[source];
 if(vis){const move=c?.kind==='physical'?(source==='tern'?'roundhouse':source==='sable'?'thrust':source==='brann'?'overhead':'bash'):c?.kind==='steal'?'thrust':'cast';vis.attack=new E.Attack(move);vis.attack.start();}
 if(c?.partner&&visuals[c.partner]){const partner=visuals[c.partner];partner.attack=new E.Attack(c.kind==='physical'?'thrust':'cast');partner.attack.start();}
 const support=events.find(e=>e.type==='support');
 animation={t:0,dur:support?1.15:c?.bond?1.1:c?.id==='chorus'?1.3:c?.kind==='summon'?1.15:.72,events,source,command:c,hit:false};
 if(support&&R.heroes[support.hero]){const lead=visuals[source]||Object.values(visuals).find(v=>v.hero);animation.support={id:support.hero,rig:W.rig(support.hero,1.1),x:lead.baseX+28,y:lead.baseY-18,attack:new E.Attack(c?.kind==='physical'?'thrust':'cast')};animation.support.attack.start();}
}
function hitEvents(anim){
 const textRows=new Map(),statusLabels=new Map();
 const textZ=id=>{const row=textRows.get(id)||0;textRows.set(id,row+1);return 32+row*12;};
 for(const e of anim.events){
  if(e.text)msg(e.text);const v=visuals[e.target];if(!v)continue;
  const col=({fire:'#f6a66c',ice:'#9fd6ed',lightning:'#eadb88',water:'#7ec9e3',earth:'#c3aa81',wind:'#a7d5b6',light:'#f4e6ab',dark:'#b096d3',sound:'#c8b3df'})[e.element]||'#ebe3c7';
  if(e.type==='hit'||e.type==='damage'){
   v.hurt=.32;v.rig.kick?.(.32);game.hitFx(v.x,v.y,15,{power:.45,damage:e.value||e.amount||0,textScale:1,textZ:textZ(e.target)});
   game.particles.glints(v.x,v.y,20,8,col);game.shake(1.2);
  }else if(e.type==='heal'||e.type==='revive'){
   game.particles.glints(v.x,v.y,18,15,'#90dfbb');game.particles.text(v.x,v.y,textZ(e.target),'+'+(e.value||e.amount||''),'#aaf0c7',{scale:1});game.audio.sfx('heal');
  }else if(e.type==='status'){const labels=statusLabels.get(e.target)||new Set();if(e.status)labels.add(e.status);statusLabels.set(e.target,labels);}
  else if(e.type==='break'){game.particles.ring(v.x,v.y,12,34,'#99dfcb',.65);game.particles.text(v.x,v.y,textZ(e.target),'BREAK','#b4f2d7',{scale:1});game.shake(1.7);}
  else if(e.type==='phase'){game.particles.glints(v.x,v.y,20,24,'#eab5d0');game.particles.text(v.x,v.y,textZ(e.target),'PHASE '+(e.value||''),'#eacbe3',{scale:1});}
 }
 for(const[id,labels]of statusLabels){const v=visuals[id];if(labels.size)game.particles.text(v.x,v.y,textZ(id),[...labels].join(' / '),'#dbc8a4',{scale:1});}
 if(anim.command?.kind==='summon'||anim.command?.id==='chorus'){
  game.particles.ring(225,110,20,160,'#d9d2a7',.9);game.particles.glints(225,110,35,40,'#afdccd');game.audio.sfx('powerup');
 }else game.audio.sfx(anim.command?.kind==='physical'?'swing':'charge',{vol:.3});
}
function updateBattleVisuals(dt){
 if(animation){animation.t+=dt;if(!animation.hit&&animation.t>=animation.dur*.36){animation.hit=true;hitEvents(animation);}if(animation.t>=animation.dur)animation=null;}
 if(animation?.support){const s=animation.support;s.attack.update(dt);s.rig.update(dt,{x:s.x,y:s.y,z:0,facing:Math.PI,attack:s.attack.state,expr:'smile'});}
 for(const a of battle.actors){
  const v=visuals[a.id];if(!v)continue;v.hurt=Math.max(0,v.hurt-dt);v.attack.update(dt);
  let stride=0;
  if((animation?.source===a.id||animation?.command?.partner===a.id)&&['physical','steal'].includes(animation.command?.kind)){const u=animation.t/animation.dur;stride=Math.sin(Math.min(1,u)*Math.PI)*45;}
  v.x=v.baseX+(a.enemy?stride:-stride);v.y=v.baseY;
  if(v.monster?.type==='blob')v.rig.update(dt,{squash:v.hurt?.1:0,look:[1,0],flap:.65,walk:animation?.source===a.id?.6:0,squint:!a.alive?1:0});
  else v.rig.update(dt,{x:v.x,y:v.y,z:0,vx:stride?30:0,vy:0,facing:a.enemy?0:Math.PI,attack:v.attack.state,hurt:v.hurt>0,pose:!a.alive?'down':battle.result==='victory'&&!a.enemy?'cheer':a.status.guard?'block':undefined,expr:v.hurt?'wince':battle.result==='victory'?'smile':undefined});
 }
}
function finishBattle(){
 lastRewards=R.settleBattle(state,battle);
 if(battle.trialId){lastRewards.trial=CC.Undertide.recordTrial(state,battle);if(lastRewards.trial.message)msg(lastRewards.trial.message,true);}
 if(battle.result==='defeat'&&!battle.practice){game.go('defeat');music('ruin');return;}
 if(battle.result==='victory'&&encounter?.key){const cleared=encounter.overworld?state.overworld.cleared:state.cleared;if(!cleared.includes(encounter.key))cleared.push(encounter.key);}
 resultWait=0;game.go('result');game.audio.sfx(battle.result==='victory'?'oneup':'warp');notify();
}
function continueResult(){
 if(game.sceneName!=='result')return;
 const info=encounter,q=info?.taskId?(D.chapters.find(x=>x.id===info.taskId)||D.quests.find(x=>x.id===info.taskId)||missions().find(x=>x.id===info.taskId)):null;
 const wasVictory=battle.result==='victory';battle=null;animation=null;encounter=null;saveOnFieldEntry=true;
 if(q&&wasVictory){enterPlace(state.location,true);game.go('field',null,{fade:0});if(info.stageId){const step=AD.status(state,q).step;if(step?.id===info.stageId)completeStage(q);else if(AD.status(state,q).finished)finishMission(q);}else completeTask(q);}else{if(info?.overworld)enterOverworld({restore:true});else enterPlace(state.location,true);}
 notify();
}
function retryBattle(){
 if(!checkpoint||!encounter||!battle?.result)return;
 const info=clone(encounter);
 // Practice settlement leaves the campaign intact and may grant its first prize.
 // Keep that state when retrying; restoring the old checkpoint would erase it.
 if(battle.practice){startBattle(info.spec,info);return;}
 if(game.sceneName!=='defeat')return;
 const trialRecords=clone(state.undertide);state=fixState(clone(checkpoint));state.undertide=trialRecords;R.healParty(state);startBattle(info.spec,info);
}
function returnToCamp(){
 if(!['defeat','result'].includes(game.sceneName))return;
 if(battle?.practice){continueResult();return;}
 saveOnFieldEntry=true;
 const wasWorld=encounter?.overworld,trialRecords=clone(state.undertide);if(checkpoint)state=fixState(clone(checkpoint));state.undertide=trialRecords;R.healParty(state);battle=null;animation=null;encounter=null;
 const safe=state.overworld.safeSpot;
 if(wasWorld&&safe&&(!safe.act||safe.act===state.act)){Object.assign(state.overworld,{x:safe.x,y:safe.y,vehicle:'foot'});enterOverworld({restore:true});}
 else{state.positions[state.location]=world.spawn;enterPlace(state.location,true);}
}
function saveAfterFieldEntry(){if(saveOnFieldEntry){saveOnFieldEntry=false;save('auto',true);}}
function beginEnding(){
 state.flags.victory=true;state.overworld.active=false;state.finishedAt ||= new Date().toISOString();game.go('ending');music('ending');
 const epilogue=()=>startTalk(D.ending[state.ending]||[],()=>{state.flags.credits=true;save('auto',true);CC.UI?.open('ending');});
 if(state.ending){epilogue();return;}
 startTalk(D.ending.intro,()=>talk.say('The stored voices wait for your answer.',{name:'THE LAST CHOICE',portrait:portraitRigs.iona,choices:['Build a shared choir','Release every voice'],onChoice:i=>{
  state.ending=i===0?'restore':'release';game.after(0,epilogue);
 }}));
}
function returnAfterEnding(){modal=null;battle=null;encounter=null;enterPlace('cinderstrand',true);save('auto',true);}

// World travel uses the same terrain for movement, navigation, and the chart.
function getOverworld(){
 if(!overworld||overworld.act!==state.act){
  overworld=OW.build(state.act,D.places);
  for(const o of overworld.objects)if(o.type==='enemy')o.monster=W.makeMonster(o.formation[0]);
 }
 return overworld;
}
function syncTraveller(){if(traveller)Object.assign(state.overworld,{x:traveller.x,y:traveller.y,act:state.act,vehicle:traveller.vehicle||state.overworld.vehicle});}
function enterOverworld({restore=false}={}){
 if(!started||talk.open||['battle','result','defeat','collapse'].includes(game.sceneName)&&battle)return false;
 if(game.sceneName==='overworld'&&traveller&&state.overworld.active){modal=null;return true;}
 savePosition();const map=getOverworld(),o=state.overworld;
 let spawn=restore&&o.act===state.act&&map.canStand(o.x,o.y,o.vehicle,3)?{x:o.x,y:o.y}:null;
 if(!spawn){spawn=map.spawnFor(state.location);o.vehicle='foot';}
 if(o.vehicle==='airship'&&!state.flags.airship){spawn=map.spawnFor(state.location);o.vehicle='foot';}
 if(o.vehicle==='boat'&&!boatUnlocked()){spawn=map.spawnFor(state.location);o.vehicle='foot';}
 traveller=new E.Body({...spawn,z:0,r:3});traveller.facing=-Math.PI/2;traveller.vehicle=o.vehicle;traveller.moving=false;
 travellerRig=W.rig(state.party[0],.65);o.active=true;o.act=state.act;syncTraveller();
 near=null;modal=null;talk.close();sceneClock=0;worldSaveClock=0;game.go('overworld');musicName=null;discoverNearby();notify();return true;
}
function boatUnlocked(){return state.chapter>=5||!!state.flags.ferry_pass||state.act===2;}
function navigate(id){
 if(!started||talk.open||!unlocked(places[id])||!['field','overworld','ending'].includes(game.sceneName))return false;
 state.overworld.waypoint=id;modal=null;
 if(game.sceneName!=='overworld'&&!enterOverworld())return false;
 msg('Course set for '+places[id].name+'. Follow the gold marker.',true);save('auto',true);return true;
}
function canFastTravel(id){return !!(started&&unlocked(places[id])&&state.visited.includes(id));}
function fastTravel(id){
 if(talk.open||!canFastTravel(id)||!['field','overworld','ending'].includes(game.sceneName))return false;
 modal=null;talk.close();const ok=enterPlace(id);if(ok){state.overworld.waypoint=null;save('auto',true);}return ok;
}
function setVehicle(kind){
 if(game.sceneName!=='overworld'||modal||talk.open||!traveller)return {ok:false,reason:'Use transport while you explore the overworld.'};
 const o=state.overworld,map=getOverworld();if(kind===o.vehicle)return {ok:true};
 let point=null;
 if(kind==='airship'){
  if(!state.flags.airship)return {ok:false,reason:'Restore the airship at Cinder Strand in Act II.'};
  point={x:traveller.x,y:traveller.y};
 }else if(kind==='boat'){
  if(!boatUnlocked())return {ok:false,reason:'Complete The Missing Verse in Lantern Ward to unlock the ferry.'};
  if(o.vehicle==='airship')return {ok:false,reason:'Land before you board a boat.'};
  point=map.boardAt(traveller.x,traveller.y);if(!point)return {ok:false,reason:'Stand beside a dock to board the boat.'};
 }else if(kind==='foot'){
  point=o.vehicle==='airship'?map.landingAt(traveller.x,traveller.y):map.disembarkAt(traveller.x,traveller.y);
  if(!point)return {ok:false,reason:o.vehicle==='airship'?'Fly above open land to land.':'Sail close to a shore or dock to leave the boat.'};
 }else return {ok:false,reason:'Choose Walk, Sail, or Fly.'};
 traveller.x=point.x;traveller.y=point.y;traveller.vx=traveller.vy=0;traveller.vehicle=kind;o.vehicle=kind;sceneClock=0;syncTraveller();layoutScene();
 msg(kind==='airship'?'Airship aloft. Fly across the sea and mountains.':kind==='boat'?'Boat boarded. Follow the coast or cross the open sea.':'Back on solid ground.',true);save('auto',true);notify();return {ok:true};
}
function transportOptions(){
 const o=state.overworld||{},map=started?getOverworld():null,p=traveller||o;
 return [
  {id:'foot',label:o.vehicle==='foot'?'Walk':'Land',enabled:o.vehicle==='foot'||!!(o.vehicle==='airship'?map?.landingAt(p.x,p.y):map?.disembarkAt(p.x,p.y)),reason:'Reach open land or a shore.'},
  {id:'boat',label:'Sail',enabled:o.vehicle==='boat'||boatUnlocked()&&o.vehicle==='foot'&&!!map?.boardAt(p.x,p.y),reason:boatUnlocked()?'Board at a dock.':'Unlock the ferry in the first act.'},
  {id:'airship',label:'Fly',enabled:!!state.flags.airship,reason:'Restore the airship in the second act.'}
 ];
}
function overworldInfo(){
 const map=getOverworld(),o=state.overworld||{},p=traveller&&o.active?traveller:map.spawnFor(state.location),region=map.regionAt(p.x,p.y),target=map.byId[o.waypoint];
 return {name:region.name,region,vehicle:o.vehicle||'foot',target:target||null,distance:target?Math.round(E.dist(p,target)/map.tileSize):0,discovered:o.discovered?.length||0,total:map.locations.length};
}
function landmarkRecords(){return [1,2].flatMap(act=>OW.landmarkRecords(act)).filter(o=>state.overworld.landmarks.includes(o.key));}
function discoverNearby(){
 if(!traveller)return;
 for(const p of getOverworld().locations)if(E.dist(traveller,p)<78&&!state.overworld.discovered.includes(p.id)){
  state.overworld.discovered.push(p.id);msg('Discovered '+p.name+'.',true);
 }
}
function interactOverworld(obj=near){
 if(!obj||modal||talk.open||!traveller||game.sceneName!=='overworld')return false;
 const o=state.overworld;
 if(obj.type==='location'){
  if(o.vehicle==='airship'){msg('Land before you enter '+obj.name+'.',true);return false;}
  if(o.vehicle==='boat'){msg('Leave the boat at a shore or dock first.',true);return false;}
  if(!unlocked(places[obj.id])){msg('This settlement will open as the story moves forward.',true);return false;}
  const ok=enterPlace(obj.id);if(ok){if(o.waypoint===obj.id)o.waypoint=null;save('auto',true);}return ok;
 }
 if(obj.type==='dock'){
  const result=setVehicle(o.vehicle==='boat'?'foot':'boat');if(!result.ok)msg(result.reason,true);return result.ok;
 }
 if(o.vehicle!=='foot'){msg('Land or leave the boat to explore this site.',true);return false;}
 if(obj.type==='camp'){
  R.healParty(state);o.safeSpot={x:obj.x,y:obj.y,act:state.act};game.audio.sfx('heal');save('auto',true);msg(obj.name+': the company is restored and your journey is saved.',true);return true;
 }
 if(obj.type==='chest'){
  if(o.opened.includes(obj.key)){msg('These supplies are already collected.',true);return true;}
  o.opened.push(obj.key);reward(obj.reward);if(obj.reward?.xp)R.grantXP(state,obj.reward.xp);game.audio.sfx('pickup');save('auto',true);
  const data=obj.reward,parts=[data.gold?data.gold+' gold':null,data.item?(data.count||1)+' '+(R.items[data.item]?.name||data.item):null,data.gear?R.equipment[data.gear]?.name:null];msg('Supply cache: '+parts.filter(Boolean).join(' and ')+'.',true);return true;
 }
 if(obj.type==='landmark'){
  if(!o.landmarks.includes(obj.key)){o.landmarks.push(obj.key);reward(obj.reward);if(obj.reward?.xp)R.grantXP(state,obj.reward.xp);save('auto',true);}
  startTalk([{speaker:obj.title,text:obj.text}],()=>save('auto',true));return true;
 }
 if(obj.type==='enemy'&&!o.cleared.includes(obj.key)){startBattle({enemies:obj.formation,level:obj.level,boss:false},{key:obj.key,overworld:true,theme:obj.theme});return true;}
 return false;
}
function overworldUpdate(dt){
 uiClock+=dt;if(uiClock>=.1){uiClock=0;notify();}
 if(modal)return;state.playTime+=dt;sceneClock+=dt;
 if(talk.open){talk.update(dt);return;}
 if(game.input.pressed('world')){requestPanel('chart');return;}if(game.input.pressed('localmap')){requestPanel(game.sceneName==='field'?'localmap':'chart');return;}if(game.input.pressed('company')){requestPanel('party');return;}if(game.input.pressed('pack')){requestPanel('pack');return;}if(game.input.pressed('journal')){requestPanel('journal');return;}
 if(game.input.pressed('vehicle')){const result=setVehicle(state.overworld.vehicle==='foot'?(state.flags.airship?'airship':'boat'):'foot');if(!result.ok)msg(result.reason,true);return;}
 const map=getOverworld(),o=state.overworld,[mx,my]=game.input.move(),[dx,dy]=game.view.screenDirToGround(mx,my),speed=({foot:112,boat:186,airship:280})[o.vehicle]*(game.input.down('dash')?1.45:1);
 traveller.vx=dx*speed;traveller.vy=dy*speed;if(dx||dy)traveller.facing=Math.atan2(dy,dx);
 const steps=Math.max(1,Math.ceil(speed*dt/3)),sx=dx*speed*dt/steps,sy=dy*speed*dt/steps,oldX=traveller.x,oldY=traveller.y;
 for(let i=0;i<steps;i++){if(map.canStand(traveller.x+sx,traveller.y,o.vehicle,3))traveller.x+=sx;if(map.canStand(traveller.x,traveller.y+sy,o.vehicle,3))traveller.y+=sy;}
 traveller.moving=Math.hypot(traveller.x-oldX,traveller.y-oldY)>.01;syncTraveller();game.focus(traveller.x,traveller.y,13);
 travellerRig.update(dt,{x:traveller.x,y:traveller.y,z:0,vx:traveller.moving?traveller.vx:0,vy:traveller.moving?traveller.vy:0,facing:traveller.facing});discoverNearby();
 for(const e of map.objects){
  if(e.type!=='enemy'||o.cleared.includes(e.key)||E.dist(traveller,e)>400)continue;
  e.phase+=dt*.45;const x=e.base.x+Math.sin(e.phase)*7,y=e.base.y+Math.cos(e.phase)*5;if(map.canStand(x,y,'foot',3)){e.x=x;e.y=y;}
  if(e.monster.type==='blob')e.monster.rig.update(dt,{walk:.4,flap:.4,look:[Math.cos(e.phase),0]});else e.monster.rig.update(dt,{x:e.x,y:e.y,z:0,vx:6,vy:0,facing:Math.atan2(traveller.y-e.y,traveller.x-e.x)});
  if(o.vehicle==='foot'&&sceneClock>2&&E.dist(traveller,e)<10){interactOverworld(e);return;}
 }
 const candidates=[...map.locations.map(p=>({...p,type:'location',label:'Enter '+p.name})),...map.objects.filter(p=>p.type!=='enemy'&&(p.type!=='chest'||!o.opened.includes(p.key))).map(p=>p.type==='dock'?{...p,label:o.vehicle==='boat'?'Leave boat':'Board boat'}:p)];
 near=candidates.map(p=>[p,E.dist(traveller,p)]).filter(([p,d])=>d<(p.type==='location'?28:25)).sort((a,b)=>a[1]-b[1])[0]?.[0]||null;
 if(game.input.pressed('interact')||game.input.pressed('confirm'))interactOverworld();
 worldSaveClock+=dt;if(worldSaveClock>=20&&game.sceneName==='overworld'){worldSaveClock=0;save('auto',true);}
}
function drawOverworld(r){
 if(!overworld||!traveller)return;
 const k=Math.min(r.W,r.H)/Math.min(viewport.cssWidth,viewport.cssHeight),short=viewport.responsive&&viewport.cssHeight<=540&&viewport.cssWidth/viewport.cssHeight>=1.2,compact=viewport.responsive&&viewport.cssWidth<=720&&!short;
 const scale=short?.4:compact?.5:.65,mw=overworld.width*scale,mh=overworld.height*scale,x=r.W-mw-8-(viewport.responsive&&!compact&&!(short&&viewport.cssWidth<=540)?225*k:0),y=viewport.responsive?clearViewport().top+7:10;
 game.lights.enabled=true;game.lights.ambient=state.act===2?.78:.88;OW.draw(r,overworld,state,game.time,traveller,{labelExclusions:[{x:x-3,y:y-3,w:mw+6,h:mh+6}]});
 for(const o of overworld.objects)if(o.type==='enemy'&&!state.overworld.cleared.includes(o.key)&&r.visible(o.x,o.y,0,40,40,50)){
  r.shadow(o.x,o.y,6,.22);r.actor(o.x,o.y,0,(g,x,y)=>W.drawMonster(g,x,y,r.view,o.monster,game.time));
 }
 if(state.overworld.vehicle==='foot'){r.shadow(traveller.x,traveller.y,4,.25);r.actor(traveller.x,traveller.y,0,(g,x,y)=>travellerRig.draw(g,x,y,r.view),{xray:{color:'#d6e3c7',outline:'#f5ebcb'}});}
 const target=overworld.byId[state.overworld.waypoint];
 if(target){r.marker(target.x,target.y,42,{color:'#efcf87',offscreen:true});r.groundRing(target.x,target.y,21,'#e6cf92',.6);}
 if(near&&!talk.open){r.groundRing(near.x,near.y,11,'#f0d6a0',.45);if(near.type!=='location')r.textAt(near.x,near.y,32,(near.label||near.type).toUpperCase(),'#f0dfb5',{font:'tiny'});}
 r.overlay(g=>{
  E.ui.box(g,x-3,y-3,mw+6,mh+6,{bg:'#152a36',border:'#78918c',alpha:.88});
  for(let yy=0;yy<overworld.height;yy+=2)for(let xx=0;xx<overworld.width;xx+=2)px.rect(g,x+xx*scale,y+yy*scale,Math.ceil(scale*2),Math.ceil(scale*2),overworld.palette[overworld.rows[yy][xx]]);
  for(const p of overworld.locations)if(state.overworld.discovered.includes(p.id))px.rect(g,x+p.cx*scale,y+p.cy*scale,2,2,p.id===state.overworld.waypoint?'#f8d188':'#b7cec0');
  px.rect(g,x+traveller.x/16*scale-1,y+traveller.y/16*scale-1,3,3,'#fff0cf');
  if(game.headless){const info=overworldInfo();E.font.text(g,info.name,12,r.H-28,'#ecdec0',{font:'tiny'});E.font.text(g,info.vehicle.toUpperCase()+(info.target?'  /  '+info.target.name+'  '+info.distance+' tiles':''),12,r.H-16,'#bfcfba',{font:'tiny'});}
 });if(!CC.UI?.dialogue)talk.draw(r);
}

function fieldUpdate(dt){
 uiClock+=dt;if(uiClock>=.1){uiClock=0;notify();}
 if(modal)return;state.playTime+=dt;sceneClock+=dt;
 if(talk.open){talk.update(dt);for(const rig of rigs)rig.update(dt,{x:hero.x,y:hero.y,z:0,vx:0,vy:0,facing:hero.facing});return;}
 if(game.input.pressed('world')){requestPanel('chart');return;}if(game.input.pressed('localmap')){requestPanel(game.sceneName==='field'?'localmap':'chart');return;}if(game.input.pressed('company')){requestPanel('party');return;}if(game.input.pressed('pack')){requestPanel('pack');return;}if(game.input.pressed('journal')){requestPanel('journal');return;}
 const [mx,my]=game.input.move(),[dx,dy]=game.view.screenDirToGround(mx,my),speed=game.input.down('dash')?104:72;
 hero.vx=dx*speed;hero.vy=dy*speed;if(dx||dy)hero.facing=Math.atan2(dy,dx);hero.update(dt,world.map);game.focus(hero.x,hero.y,13);
 if(dx||dy){trail.unshift({x:hero.x,y:hero.y,facing:hero.facing});if(trail.length>100)trail.pop();}
 rigs.forEach((rig,i)=>{const p=i?trail[Math.min(trail.length-1,i*20)]:hero;W.clearMotion(rig);rig.update(dt,{x:p.x,y:p.y,z:0,vx:dx*speed,vy:dy*speed,facing:p.facing});});
 for(const o of world.objects){
  if(o.type==='npc'||o.type==='rescue'||o.type==='mission'&&o.rig){
   if(o.rig)W.updateResident(o,dt,game.time,hero,world,{reduceMotion:game.reduceMotion});
  }
  if(o.type==='enemy'&&!state.cleared.includes(o.key)){
   o.phase+=dt*.6;const nx=o.base.x+Math.sin(o.phase)*9,ny=o.base.y+Math.cos(o.phase)*5;if(world.map.standable(nx,ny,0,4.4)){o.x=nx;o.y=ny;}
   if(o.monster.type==='blob')o.monster.rig.update(dt,{walk:.5,flap:.4,look:[Math.cos(o.phase),0]});
   else o.monster.rig.update(dt,{x:o.x,y:o.y,z:0,vx:8,vy:0,facing:Math.atan2(hero.y-o.y,hero.x-o.x)});
   if(sceneClock>1.1&&E.dist(hero,o)<11){startBattle({enemies:o.formation,level:world.place.level,boss:false},{key:o.key});return;}
  }
 }
 updateEscort(dt);if(talk.open||game.sceneName!=='field')return;
 fieldSaveClock+=dt;if(fieldSaveClock>=10){fieldSaveClock=0;save('auto',true);}
 const list=world.objects.filter(o=>o.type!=='enemy'&&(o.type!=='rescue'||!state.flags[o.key])&&(o.type!=='chest'||!state.chests.includes(o.key)));
 near=list.map(o=>[o,E.dist(hero,o)]).filter(x=>x[1]<25).sort((a,b)=>a[1]-b[1])[0]?.[0]||null;
 if(game.input.pressed('interact')||game.input.pressed('confirm'))interact();
}
function drawField(r){
 game.lights.enabled=true;game.lights.ambient=state.act===2?.7:.8;
 if(!world)return;W.drawPlace(r,world,state,game.time);
 const navigation=localMapInfo();
 if(navigation.target&&!talk.open){
  W.drawNavigationMarker(r,navigation.target,game.time,clearViewport());
  for(const point of navigation.route.slice(1,10))r.groundRing(point.x,point.y,1.7,'#d9dba6',.48);
 }
 for(const o of world.objects){
  if(o.type==='enemy'){
   if(state.cleared.includes(o.key))continue;r.shadow(o.x,o.y,8,.25);r.actor(o.x,o.y,0,(g,x,y)=>W.drawMonster(g,x,y,r.view,o.monster,game.time));
   r.queue(o.x,o.y,35,g=>{const p=r.w(o.x,o.y,32);px.poly(g,[[p[0],p[1]-2],[p[0]+2,p[1]],[p[0],p[1]+2],[p[0]-2,p[1]]],'#e7a085');});
  }else if(o.type==='npc'||o.type==='rescue'||o.type==='mission'&&o.rig){
   if(o.type==='rescue'&&state.flags[o.key])continue;r.shadow(o.x,o.y,6,.23);r.actor(o.x,o.y,0,(g,x,y)=>o.rig.draw(g,x,y,r.view));
  }
 }
 rigs.forEach((rig,i)=>{const p=i?trail[Math.min(trail.length-1,i*20)]:hero;r.shadow(p.x,p.y,6,.27);r.actor(p.x,p.y,0,(g,x,y)=>rig.draw(g,x,y,r.view),{xray:{color:'#c7dfc7',outline:'#eff0d1'}});});
 const escort=navigation.status?.escort;
 if(escort&&escortRig){r.shadow(escort.x,escort.y,6,.23);r.actor(escort.x,escort.y,0,(g,x,y)=>escortRig.draw(g,x,y,r.view),{xray:{color:'#cbdcb7',outline:'#f2deb5'}});r.textAt(escort.x,escort.y,35,'FOLLOWING','#aad2b0',{font:'tiny'});}
 if(near&&!talk.open){r.textAt(near.x,near.y,near.rig?66:54,near.type==='goal'?'STORY':near.label.toUpperCase(),near.type==='mission'?W.markerStyle(near).color:'#f2d9a6');r.groundRing(near.x,near.y,9,'#f0d6a0',.35);}
 r.overlay(g=>{
  // Match the field HUD's two CSS breakpoints. Wide views reserve the right
  // 225 CSS pixels for party status; compact portrait puts that status below.
  const k=Math.min(r.W,r.H)/Math.min(viewport.cssWidth,viewport.cssHeight),short=viewport.responsive&&viewport.cssHeight<=540&&viewport.cssWidth/viewport.cssHeight>=1.2,compact=viewport.responsive&&viewport.cssWidth<=720&&!short;
  const s=(short?46:72)/world.width,mw=world.width*s,mh=world.height*s,x=r.W-mw-8-(viewport.responsive&&!compact&&!(short&&viewport.cssWidth<=540)?225*k:0),y=viewport.responsive?clearViewport().top+7:r.H-mh-8;
  E.ui.box(g,x-3,y-3,mw+6,mh+6,{bg:'#112333',border:'#5b7477',alpha:.85});
  world.rows.forEach((row,yy)=>row.forEach((c,xx)=>{const color=c==='#'||c==='H'?'#354d59':c==='~'?'#203e52':c==='G'?'#d99d76':'#687876';px.rect(g,x+xx*s,y+yy*s,Math.ceil(s),Math.ceil(s),color);}));
  for(const o of world.objects){const color=o.type==='mission'?'#ffd692':o.type==='goal'?'#e4c18b':o.type==='camp'?'#82d2b6':o.type==='enemy'&&!state.cleared.includes(o.key)?'#bd8078':null;if(color)px.rect(g,x+o.x/16*s-1,y+o.y/16*s-1,2,2,color);}
  px.rect(g,x+hero.x/16*s-1,y+hero.y/16*s-1,3,3,'#f5efe2');
  if(game.headless){E.font.text(g,world.place.name,12,12,'#efe2bf',{shadow:'#142331'});const task=localTask();E.font.text(g,task?(AD.status(state,task).started?AD.status(state,task).step?.title||'Conclude the mission.':'Read the field briefing.'):'Explore the world.',12,25,'#d0d8c7',{wrap:Math.min(325,r.W-24)});}
 });if(!CC.UI?.dialogue)talk.draw(r);
}
function battleDraw(r){
 if(!battle||!battleField)return;W.drawBattle(r,battleField,game.time);
 const targets=selectedCommand?targetsFor(selectedCommand):[],selected=targetMenu?targets[targetMenu.i]?.id:null;
 for(const a of battle.actors){
  const v=visuals[a.id];if(!v)continue;if(!a.alive&&a.enemy)continue;
  r.shadow(v.x,v.y,a.boss?18:9,.3);
  r.actor(v.x,v.y,v.z,(g,x,y)=>v.monster?W.drawMonster(g,x,y,r.view,v.monster,game.time,!!a.boss):v.rig.draw(g,x,y,r.view),{flash:v.hurt?'#f5e8ca':undefined,flashMix:.5,alpha:!a.alive?.4:1});
  if(v.hero)v.rig.drawSmear(r);
  if(a.enemy){r.overlay(g=>{const p=r.w(v.x,v.y,0),small=viewport.responsive&&r.W<330;E.font.text(g,a.name,p[0],p[1]+7,'#e5dbbc',{align:'center',shadow:'#152336',font:small?'tiny':undefined});E.ui.bar(g,p[0]-24,p[1]+17,48,3,a.hp/a.maxHp,'#c08f7e');if(game.settings.battleHints&&a.weak?.length)E.font.text(g,a.weak.join('/'),p[0],p[1]+23,'#9ac8cf',{align:'center',font:'tiny'});});}
  if(selected===a.id||!a.enemy&&battle.ready===a.id){r.overlay(g=>{const p=r.w(v.x,v.y,a.boss?72:47);px.poly(g,[[p[0]-5,p[1]-6],[p[0]+5,p[1]-6],[p[0],p[1]]],'#f3d394');});}
 }
 if(animation?.command?.bond){
  const src=visuals[animation.source],partner=visuals[animation.command.partner];
  if(src&&partner)r.overlay(g=>{const a=r.w(src.x,src.y,25),b=r.w(partner.x,partner.y,25),u=Math.sin(Math.min(1,animation.t/animation.dur)*Math.PI);px.line(g,a[0],a[1],b[0],b[1],'#afdcd1');for(let i=0;i<5;i++){const f=(i/5+animation.t*.8)%1;px.disc(g,E.lerp(a[0],b[0],f),E.lerp(a[1],b[1],f),2+u,'#f1d59e');}});
 }
 if(animation?.support){
  const s=animation.support,u=animation.t/animation.dur,alpha=Math.min(1,u*6,(1-u)*6);
  r.actor(s.x,s.y,0,(g,x,y)=>s.rig.draw(g,x,y,r.view),{alpha});
  r.overlay(g=>{const p=r.w(s.x,s.y,49);E.font.text(g,R.heroes[s.id].name+' · SUPPORT',p[0],p[1],'#a9e5d8',{align:'center',font:'tiny'});});
 }
 if(animation?.command&&['magic','summon','chorus'].includes(animation.command.kind)){
  const u=animation.t/animation.dur,src=visuals[animation.source];if(src)for(const a of battle.enemies.filter(a=>a.alive||u<.7)){const dst=visuals[a.id];if(dst)r.queue(dst.x,dst.y,20,g=>{const aa=r.w(src.x,src.y,22),bb=r.w(dst.x,dst.y,22),x=E.lerp(aa[0],bb[0],Math.min(1,u*2)),y=E.lerp(aa[1],bb[1],Math.min(1,u*2))-Math.sin(u*Math.PI)*25;px.ddisc(g,x,y,9,'#a8d9da',.5);px.disc(g,x,y,3,'#eae3b4');},{emissive:true});}
 }
 if(!CC.UI?.enemyIntent)r.overlay(g=>{
  const intents=battle.enemies.filter(a=>a.alive).map(a=>a.name+': '+(a.intent?.label||a.intent?.name||'Attack')).join('  /  ');
  E.ui.box(g,7,r.H-23,r.W-14,18,{bg:'#102538',border:'#496071',alpha:.88});E.font.text(g,intents.slice(0,Math.floor((r.W-26)/4)),13,r.H-17,'#c4d2cc',{font:'tiny'});
  if(game.headless&&battle.ready)E.font.text(g,R.heroes[battle.ready].name+' is ready.',12,14,'#ead2a1');
 });
}
function drawBattleCard(r,defeated=false){
 r.overlay(g=>{
  const clear=viewport.responsive?clearViewport():{top:0,bottom:r.H,height:r.H,left:0,right:r.W,width:r.W},cx=(clear.left+clear.right)/2;
  const w=Math.min(300,clear.width-24),h=Math.min(defeated?114:99,Math.max(76,clear.height-10)),x=cx-w/2,y=clear.top+(clear.height-h)/2;
  const title=defeated?'NOT THE LAST NOTE':battle.result==='fled'?'SAFE PASSAGE':'VOICES RISE',scale=Math.max(1,Math.min(2,Math.floor((w-22)/E.font.width(title))));
  E.ui.box(g,x,y,w,h,{bg:defeated?'#252637':'#152d40',border:defeated?'#ba8e85':'#c9b785'});
  E.font.title(g,title,cx,y+11,{scale,align:'center',colors:defeated?['#e5cabb','#a391aa']:['#f0dbad','#b2beac']});
  if(defeated){
   if(h>94)E.font.text(g,'The waystone remembers this company.',cx,y+40,'#cfbfc4',{align:'center',font:w<240?'tiny':undefined});
   E.font.text(g,(defeatMenu.i===0?'▸ ':'  ')+'RETRY BATTLE',cx,y+h-44,'#edcd9a',{align:'center'});
   E.font.text(g,(defeatMenu.i===1?'▸ ':'  ')+'RETURN TO WAYSTONE',cx,y+h-24,'#cfcbc4',{align:'center'});
  }else{
   E.font.text(g,lastRewards.trial?.ok?lastRewards.trial.medal.toUpperCase()+' · '+lastRewards.trial.met+'/'+lastRewards.trial.total+' GOALS':(lastRewards.xp||0)+' XP   '+(lastRewards.gold||0)+' GOLD   '+(lastRewards.ap||0)+' AP',cx,y+h*.5,'#d7e4d6',{align:'center'});
   E.font.text(g,'PRESS ENTER TO CONTINUE',cx,y+h-22,'#c3c5ab',{align:'center',font:w<240?'tiny':undefined});
  }
 });
}
const scenes={
 title:{pausable:false,view:'threequarter',enter(){musicName=null;modal=null;layoutScene();},update(dt){sceneClock+=dt;titleMenu.items[1]={label:'CONTINUE',disabled:!latest()};if(!modal)titleMenu.update(dt);uiClock+=dt;if(uiClock>.2){uiClock=0;notify();}},draw(r){W.drawTitle(r,game.time);if(game.headless)r.overlay(g=>{const scale=Math.max(1,Math.min(4,Math.floor((r.W-24)/E.font.width('CINDER CHOIR'))));E.font.title(g,'CINDER CHOIR',r.W/2,r.H*.22,{scale,align:'center',colors:['#fff0c5','#bdad88','#7d958f'],depth:2});E.font.text(g,'Every city has a voice. One of them is yours.',r.W/2,r.H*.4,'#d0dbce',{align:'center',wrap:r.W-32});E.ui.box(g,(r.W-156)/2,r.H*.7,156,28,{bg:'#203c4e',border:'#c0ad83'});E.font.text(g,'BEGIN YOUR JOURNEY',r.W/2,r.H*.7+10,'#edd8a8',{align:'center'});});}},
 field:{pausable:true,view:'threequarter',touch:[],propSize:1.1,enter(){game.cam.bounds=v=>{const b=world.map.bounds(v);if(!viewport.responsive)return b;const clear=clearViewport();return{...b,x0:b.x0-clear.left,x1:b.x1+game.W-clear.right,y0:b.y0-clear.top,y1:b.y1+game.H-clear.bottom};};game.cam.snap=true;game.cam.smooth=.12;game.focus(hero.x,hero.y,13);layoutScene();music(fieldMusic());saveAfterFieldEntry();notify();},update:fieldUpdate,draw:drawField},
 overworld:{pausable:true,view:'threequarter',touch:[],propSize:.65,enter(){game.cam.bounds=v=>{const b=overworld.map.bounds(v);if(!viewport.responsive)return b;const clear=clearViewport();return{...b,x0:b.x0-clear.left,x1:b.x1+game.W-clear.right,y0:b.y0-clear.top,y1:b.y1+game.H-clear.bottom};};game.cam.snap=true;game.cam.smooth=.12;game.focus(traveller.x,traveller.y,13);layoutScene();music(state.overworld.vehicle==='airship'?'field':state.act===2?'ruin':'field');saveAfterFieldEntry();notify();},update:overworldUpdate,draw:drawOverworld},
 battle:{pausable:true,view:'brawler',touch:[],enter(){game.cam.bounds=null;game.cam.snap=true;game.cam.smooth=0;game.focus(224,126,14);layoutScene();music(world?.place.undertide||battle.trialId?'depthbattle':battle.boss?'boss':'battle');notify();},update(dt){
  if(modal)return;state.playTime+=dt;updateBattleVisuals(dt);if(!animation){if(battle.result){resultWait+=dt;if(resultWait>.5){finishBattle();return;}}else{
   const before=battle.ready;R.updateBattle(battle,dt,{wait:game.settings.battleMode!=='Active',speed:game.settings.battleSpeed==='Fast'?1.8:1});
   const events=battle.events.splice(0);if(events.length)animateEvents(events);
   if(battle.ready!==before){selectedCommand=null;targetMenu=null;}
   if(battle.ready!==before||!commandMenu)buildCommandMenu();
   if(battle.ready&&!animation){if(auto){autoTimer+=dt;if(autoTimer>.25){autoTimer=0;const choice=R.autoChoice(battle,battle.ready);if(choice)perform(choice.command,choice.target);}}else{if(!targetMenu){const dir=(game.input.pressed('right')?1:0)-(game.input.pressed('left')?1:0);if(dir){const groups=commandGroups();setCommandGroup(groups[(groups.indexOf(commandGroup)+dir+groups.length)%groups.length]);}}if(targetMenu)targetMenu.update(dt);else commandMenu?.update(dt);}}
  }}uiClock+=dt;if(uiClock>.08){uiClock=0;notify();}},draw:battleDraw},
 result:{pausable:true,view:'brawler',enter(){resultMenu.i=0;layoutScene();notify();},update(dt){updateBattleVisuals(dt);if(!modal)resultMenu.update(dt);},draw(r){battleDraw(r);drawBattleCard(r);}},
 defeat:{pausable:true,view:'brawler',enter(){defeatMenu.i=0;layoutScene();notify();},update(dt){if(!modal)defeatMenu.update(dt);},draw(r){battleDraw(r);drawBattleCard(r,true);}},
 collapse:{pausable:false,view:'threequarter',enter(){sceneClock=0;layoutScene();music('ruin');notify();},update(dt){sceneClock+=dt;if(sceneClock>9||sceneClock>1&&game.input.pressed('confirm'))collapse();},draw(r){W.drawTitle(r,game.time,2);r.overlay(g=>{const cx=r.W/2,w=r.W-32,scale=Math.max(1,Math.min(3,Math.floor(w/E.font.width('THE GREAT SILENCE'))));px.blend(g,.67,'normal',()=>px.rect(g,0,0,r.W,r.H,'#152237'));E.font.title(g,'THE GREAT SILENCE',cx,r.H*.3,{scale,align:'center',colors:['#ead2ba','#929faf']});E.font.text(g,'The towers fall. The stored voices scatter.',cx,r.H*.49,'#c9d1ca',{align:'center',wrap:w});E.font.text(g,'Six months later, a bell rings on an empty shore.',cx,r.H*.61,'#c9d1ca',{align:'center',wrap:w});E.font.text(g,'ACT II  /  THE UNWRITTEN WORLD',cx,r.H*.78,'#c4b78e',{align:'center',wrap:w});});}},
 ending:{pausable:true,view:'threequarter',enter(){sceneClock=0;layoutScene();music('ending');notify();},update(dt){sceneClock+=dt;if(talk.open)talk.update(dt);if(!modal&&state.flags.credits&&game.input.pressed('confirm'))requestPanel('ending');uiClock+=dt;if(uiClock>.1){uiClock=0;notify();}},draw(r){W.drawTitle(r,game.time,2);r.overlay(g=>{const ids=available(),columns=Math.min(ids.length,Math.max(3,Math.floor((r.W-30)/45))),rows=Math.ceil(ids.length/columns),step=Math.min(45,(r.W-30)/columns),base=viewport.responsive?clearViewport().bottom-15:r.H-19;for(const[id,i]of ids.map((id,i)=>[id,i])){const rig=portraitRigs[id],row=Math.floor(i/columns),count=Math.min(columns,ids.length-row*columns);rig.update(0.01,{x:0,y:0,z:0,facing:Math.PI/2,pose:'cheer'});rig.draw(g,r.W/2+(i%columns-(count-1)/2)*step,base-(rows-row-1)*56,E.VIEWS.threequarter);}if(!talk.open){const scale=Math.max(1,Math.min(4,Math.floor((r.W-24)/E.font.width('CINDER CHOIR'))));E.font.title(g,'CINDER CHOIR',r.W/2,r.H*.19,{scale,align:'center',colors:['#f4e4bc','#a6b8aa']});E.font.text(g,'THE END',r.W/2,r.H*.38,'#ecddb9',{align:'center',scale:2});E.font.text(g,'Every voice had a place in the song.',r.W/2,r.H*.5,'#c9d7d1',{align:'center',wrap:r.W-30});}});if(!CC.UI?.dialogue)talk.draw(r);}}
};
const app={game,places,workshopInfo,trialInfo,startTrial,craft:id=>frontierAction('craft',id),buyMaterial:(id,count=1)=>frontierAction('buyMaterial',id,count),salvage:(id,count=1)=>frontierAction('salvage',id,count),salvageYield:(id,count=1)=>CC.Frontier.salvageYield(state,id,count),subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},get state(){return state;},get world(){return world;},get hero(){return hero;},get overworld(){return getOverworld();},get traveller(){return traveller;},get battle(){return battle;},get talk(){return talk;},get near(){return near;},get started(){return started;},get logs(){return log;},get modal(){return modal;},get auto(){return auto;},get rewards(){return lastRewards;},get selectedCommand(){return selectedCommand;},get commandGroup(){return commandGroup;},get commandIndex(){return commandMenu?.i||0;},get targetIndex(){return targetMenu?.i||0;},get titleIndex(){return titleMenu.i;},get portraitRigs(){return portraitRigs;},get encounter(){return encounter;},get animation(){return animation;},get result(){return battle?.result;},get viewport(){return viewportInfo();},setViewportInsets,
 loadoutInfo,previewLoadout,recoveryPreview,saveLoadout:(slot,name)=>journeyAction('saveLoadout',slot,name),removeLoadout:slot=>journeyAction('removeLoadout',slot),applyLoadout:(slot,token)=>journeyAction('applyLoadout',slot,token,journeyOptions()),recover:(options,token)=>journeyAction('recover',options,token),
 setModal(name){modal=name;game.input.clear();game.audio.duck(!!name);notify();},setTrack(id){tracked=id;state.tracked=id;refreshMissionObjects();save('auto',true);notify();},available,activeTask,tasksHere,localTask,allTasks,allow,unlocked,missions,taskAvailable,missionStatus,scenarioStatus,beginMission,actMission,currentChallenge,setChallengeDraft,submitChallenge,localMapInfo,focusLocalTarget,cancelChallenge(){fieldChallenge=null;},enterOverworld,navigate,canFastTravel,fastTravel,setVehicle,transportOptions,overworldInfo,landmarkRecords,localRecords,missionPlans:q=>AD.plans(state,q),startNew,enterPlace,travel,interact,activateTask,save,readSlot,latest,load,loadLatest,validate,snapshotSave,setTeams,chooseCommand,setCommandGroup,commandGroups,groupCommands,targetsFor,perform,cancelTarget,startBattle,continueResult,retryBattle,returnToCamp,returnAfterEnding,
 toggleAuto(){auto=!auto;notify();return auto;},nextDialogue(){game.input.tap('confirm');},chooseDialogue(index){if(!talk.open||talk.typing||talk.i!==talk.pages.length-1||!talk.choices||!Number.isInteger(index)||index<0||index>=talk.choices.length)return false;talk.choice=index;game.input.tap('confirm');return true;},note:msg,
 heal(){R.healParty(state);notify();},setParty(ids){if(talk.open)return {ok:false,reason:'Finish this conversation before you change the company.'};if(branchFor(state.location)>=0)return{ok:false,reason:'Set your teams on the world chart before you enter a final path.'};if(ids.some(id=>!available().includes(id)))return{ok:false,reason:'This companion is still missing.'};const res=R.setParty(state,ids);if(res.ok){state.mainParty=ids.slice();if(game.sceneName==='overworld')travellerRig=W.rig(ids[0],.65);else enterPlace(state.location,true);save('auto',true);}return res;},
 equip(id,slot,item){const res=R.equip(state,id,slot,item);if(res.ok){save('auto',true);notify();}return res;},useItem(id,target){const res=R.useItem(state,id,target);if(res.ok){save('auto',true);game.audio.sfx('heal');notify();}return res;},buy(id,n){const res=R.buy(state,id,n);if(res.ok){save('auto',true);game.audio.sfx('coin');notify();}return res;},sell(id,n){const res=R.sell(state,id,n);if(res.ok){save('auto',true);notify();}return res;},
 toTitle(){modal=null;talk.close();game.resume();game.go('title');notify();},
 debug:{
  resizeViewport(width,height,insets={},dpr=1){viewportFixture={width,height,dpr};fitViewport();setViewportInsets(insets);return viewportInfo();},
  battleLayout(){return battle?battle.actors.map(a=>{const v=visuals[a.id],p=game.view.p(v.baseX,v.baseY,0);return{id:a.id,enemy:a.enemy,boss:a.boss,x:p[0]-game.cam.x,y:p[1]-game.cam.y};}):[];},
  snapshot:()=>({scene:game.sceneName,act:state.act,chapter:state.chapter,location:state.location,party:state.party.slice(),available:available(),hero:hero?[hero.x,hero.y]:null,task:activeTask()?.id,talk:talk.open,battle:battle?{ready:battle.ready,result:battle.result,enemies:battle.enemies.map(a=>({id:a.id,hp:a.hp})),heroes:battle.heroes.map(a=>({id:a.id,hp:a.hp}))}:null,completed:state.quests.slice(),errors:game.errors.map(e=>e.message)}),
  teleportOverworld(x,y){if(!traveller||!getOverworld().canStand(x,y,state.overworld.vehicle,3))return false;traveller.x=x;traveller.y=y;traveller.vx=traveller.vy=0;syncTraveller();return true;},
  teleport(x,y){if(hero){hero.x=x;hero.y=y;hero.vx=hero.vy=0;}},
  interactObject(type,index=0){const o=world?.objects.filter(o=>o.type===type)[index];return o?interact(o):false;},
  skipDialogue(){let n=0;while(talk.open&&n++<800){game.input.tap('confirm');game.advance(.03);}return !talk.open;},
  prepareRender(name){
   if(name==='title'){game.go('title',null,{fade:0});game.advance(.05);return;}
   startNew('normal');game.advance(.3);
   if(name==='world'){game.advance(1);return;}
   if(name==='overworld'){enterOverworld();game.advance(.2);return;}
   for(const id of ['sable','mira']){R.recruit(state,id);if(!state.available.includes(id))state.available.push(id);}R.setParty(state,['iona','brann','sable','mira']);R.grantXP(state,1000);R.healParty(state);
   startBattle({enemies:['gatewarden','brassmite'],level:4,boss:true});game.advance(.8);
  }
 }
};
CC.app=app;game.debug=app.debug;game.stateHash=()=>[state.act,state.chapter,state.overworld?.active?state.overworld.vehicle+':'+Math.round(traveller?.x||0)+','+Math.round(traveller?.y||0):state.location,state.party.join(','),Math.round(hero?.x||0),Math.round(hero?.y||0),battle?.turns||0,battle?.result||''];
game.start({scenes,scene:'title',boot:{title:'CINDER CHOIR',version:'6.0.0',steps:[['Tuning the Echoes',()=>{if(!R||!D||!W||!OW||!AD||!CC.Atlas||!CC.Scenarios||!CC.Frontier||!CC.TerrainView||!CC.Undertide||!CC.UndertidePuzzles||!CC.Journey||!CC.Workboard||!D.living)throw new Error('A game module is missing.');}],['Opening the world chart',()=>{if(D.places.length!==52||allTasks().length!==122||allTasks().some(q=>!AD.definition(q)?.steps?.length))throw new Error('Campaign content is incomplete.');}]],messages:['Lighting the waystones','Gathering the scattered voices']}});
})();
