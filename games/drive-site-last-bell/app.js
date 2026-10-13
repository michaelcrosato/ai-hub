import {Bout,DIFFICULTIES,LESSONS} from './combat.js';
import {Ring} from './ring.js';
import {GPUFilter} from './gpu-filter.js';
import {GameDisplay} from './game-display.js';
import {TouchControls} from './touch-controls.js';

const $=id=>document.getElementById(id),E=window.My3D2dge;
const VERSION='1.1.0';
const defaults={difficulty:'contender',coach:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,showTouch:false,mode:'off',colorLevels:8,outlineStrength:.45,pixelSize:4,dithering:.15,shake:.5,flash:.4,volume:.65,music:true,mute:false};
const ranges={colorLevels:[3,24],outlineStrength:[0,1.5],pixelSize:[2,12],dithering:[0,1],shake:[0,1],flash:[0,1],volume:[0,1]};
const settings={...defaults};let storageOK=true,records={};
try {
  const saved=JSON.parse(localStorage.getItem('last-bell.settings.v1')||'{}');
  for(const k of Object.keys(defaults)){
    if(typeof defaults[k]==='boolean'&&typeof saved[k]==='boolean')settings[k]=saved[k];
    else if(ranges[k]&&Number.isFinite(saved[k]))settings[k]=Math.max(ranges[k][0],Math.min(ranges[k][1],saved[k]));
  }
  if(DIFFICULTIES[saved.difficulty])settings.difficulty=saved.difficulty;
  if(['off','cel','pixel'].includes(saved.mode))settings.mode=saved.mode;
  const savedRecords=JSON.parse(localStorage.getItem('last-bell.records.v1')||'{}');
  for(const [key,row] of Object.entries(savedRecords))if(/^(club|contender|champion)\.(coach|solo)$/.test(key)&&row&&Number.isFinite(row.time)&&row.time>=0&&Number.isFinite(row.score)&&row.score>=0)records[key]=row;
}catch(_){storageOK=false;}
function persist(){try{localStorage.setItem('last-bell.settings.v1',JSON.stringify(settings));}catch(_){storageOK=false;}}
function timeText(seconds,decimal=false){seconds=Math.max(0,seconds);const min=Math.floor(seconds/60),sec=decimal?(seconds%60).toFixed(2).padStart(5,'0'):Math.floor(seconds%60).toString().padStart(2,'0');return `${min}:${sec}`;}
const show=(id,on)=>$(id).classList.toggle('hidden',!on);
const text=(id,value)=>{const e=$(id);const v=String(value);if(e.textContent!==v)e.textContent=v;};
let filter,ring,bout,modal=null,pauseBeforeModal=false,assetsReady=false,lastUI=0,lastMode='',lastPadDirection=null,newRecord=false,newTimeRecord=false,newScoreRecord=false,lastCount=0;
let display,touch,lastObservedPaused=false;
const mobileLessons=[
  "1 / 4 · Wait for the flash. Tap SLIP RIGHT.",
  "2 / 4 · Slip right. Then tap a BODY punch.",
  "3 / 4 · Watch the wide sweep. Tap DUCK.",
  "4 / 4 · Slip left. Then tap BREAK PUNCH."
];
const inputMap={
  up:['ArrowUp','KeyW','Pad12'],down:['ArrowDown','KeyS','Pad13'],
  left:['KeyA','ArrowLeft','Pad14','Touchleft'],right:['KeyD','ArrowRight','Pad15','Touchright'],
  duck:['KeyS','ArrowDown','Pad13','Touchduck'],
  leftHead:['KeyJ','Pad2','TouchleftHead'],rightHead:['KeyK','Pad3','TouchrightHead'],
  leftBody:['KeyU','Pad0','TouchleftBody'],rightBody:['KeyI','Pad1','TouchrightBody'],
  guard:['Space','Pad6','Touchguard'],recover:['Space','Pad6','TouchRecover'],
  special:['KeyL','Pad5','Touchspecial'],start:['Enter','NumpadEnter','Pad9'],pause:['Escape','KeyP','Pad9'],
  confirm:['Enter'],cancel:['Escape']
};
const game=new E.Game({canvas:'screen',res:[1280,720],smoothFit:true,maxDpr:1.5,view:'overhead',views:['overhead'],input:inputMap,bg:'#0b181c',postPresent:()=>{if(filter)filter.render({...settings,pixelSize:settings.pixelSize*game.screen.dpr});}});
game.cam.smooth=0;game.focus(640,360);game.pauseOverlay=false;
ring=new Ring(game,settings);filter=new GPUFilter($('filterCanvas'),game.screen.canvas);
filter.onStatus=({status,reason})=>{
  const message={idle:'Select a filter to check WebGPU support.',loading:'Starting WebGPU…',ready:'WebGPU active. Adjust the image below.',unavailable:'WebGPU is unavailable here. Original image active.',lost:'Graphics device changed. Original image active. Select a filter to retry.',error:'The filter could not run. Original image active.',destroyed:'Original image active.'}[status]||reason;
  text('gpuStatus',message);$('gpuStatus').classList.toggle('active',status==='ready');
};

class Sound {
  constructor(){this.started=false;this.phase=0;this.audio=game.audio;
    this.audio.define('lbPunch',[{wave:'noise',freq:1400,to:350,dur:.10,vol:.13},{wave:'sine',freq:100,to:45,dur:.11,vol:.25}]);
    this.audio.define('lbCounter',[{wave:'noise',freq:1750,to:500,dur:.105,vol:.20},{wave:'sine',freq:145,to:48,dur:.14,vol:.40},{wave:'triangle',freq:740,to:370,dur:.10,vol:.08}]);
    this.audio.define('lbBreak',[{wave:'noise',freq:1800,to:90,dur:.34,vol:.30},{wave:'sine',freq:125,to:35,dur:.4,vol:.52},{wave:'triangle',freq:440,to:110,dur:.15,vol:.11}]);
    this.audio.define('lbBell',[{wave:'sine',freq:880,to:874,dur:1.3,vol:.27},{wave:'sine',freq:1396,to:1382,dur:.9,vol:.09},{wave:'triangle',freq:2200,dur:.6,vol:.045}]);
    this.audio.define('lbSlip',[{wave:'noise',freq:1200,to:2600,dur:.16,vol:.07},{wave:'sine',freq:620,to:870,dur:.10,vol:.08}]);
    this.audio.define('lbGuard',[{wave:'noise',freq:600,to:200,dur:.12,vol:.19},{wave:'sine',freq:90,to:55,dur:.09,vol:.19}]);
    this.apply();
  }
  apply(){this.audio.setVolume(settings.volume);this.audio.mute(settings.mute);this.audio.musicVolume=.23;this.audio.sfxVolume=.83;this.audio._levels();if(this.musicEnabled!==settings.music){this.musicEnabled=settings.music;if(!settings.music)this.audio.music(null);else if(this.started&&bout&&!['title','result','trainingDone'].includes(bout.mode))this.music(this.phase||1);}}
  start(){this.started=true;this.audio.sfx('confirm',{vol:.25});this.music(1);}
  music(phase){this.phase=phase;if(!settings.music||!this.started)return;
    this.audio.music({bpm:phase===3?122:phase===2?113:104,steps:4,tracks:[
      {wave:'sine',vol:.32,notes:'D2 . D2 . . D2 A2 . | C2 . C2 . . C2 G2 . | Bb1 . Bb1 . . Bb1 F2 . | A1 . A1 . C2 . A1 .'},
      {wave:'triangle',vol:.10,notes:'D4 - . . A4 . F4 . | C4 - . . G4 . E4 . | Bb3 - . . F4 . D4 . | A3 . E4 . C4 . A3 .'},
      {wave:'drums',vol:.18,notes:phase===3?'k h h h s h k h | k h h k s h h o':'k . h . s . h . | k . h k s . h .'}
    ]});
  }
  event(e){
    if(e.type==='punch')this.audio.sfx('whoosh',{vol:.2,pitch:e.special?.6:1.25});
    if(e.type==='hit')this.audio.sfx(e.special?'lbBreak':e.counter?'lbCounter':'lbPunch');
    if(e.type==='hurt')this.audio.sfx('lbBreak',{vol:.55,pitch:.78});
    if(e.type==='block'||e.type==='guarded')this.audio.sfx('lbGuard',{vol:e.type==='guarded'?.4:.8});
    if(e.type==='evade')this.audio.sfx('lbSlip',{pitch:e.perfect?1.25:1,vol:e.perfect?1:.6});
    if(e.type==='bell'||e.type==='opponentDown')this.audio.sfx('lbBell',{pitch:e.type==='bell'?1:.82});
    if(e.type==='telegraph')this.audio.sfx({wave:'sine',freq:e.move.pose===1?340:e.move.pose===2?400:280,dur:.06,vol:.025});
    if(e.type==='focusReady')this.audio.sfx('charge',{vol:.35,pitch:1.4});
    if(e.type==='stagger')this.audio.sfx('powerup',{vol:.35,pitch:.8});
    if(e.type==='phase')this.music(e.phase);
    if(e.type==='lessonComplete')this.audio.sfx('coin',{vol:.3,pitch:1.4});
    if(e.type==='playerDown')this.audio.sfx('die',{vol:.4,pitch:.65});
    if(e.type==='rise')this.audio.sfx('heal',{vol:.25});
    if(e.type==='result'){this.audio.music(null);this.audio.sfx(e.result.won?'lbBell':'die',{vol:.6});if(e.result.won&&settings.music)this.audio.music({bpm:93,steps:4,tracks:[{wave:'triangle',vol:.2,notes:'D4 . F4 . A4 - . . | C5 . A4 . D5 - - . | . . . . . . . . | . . . . . . . .'}]});}
  }
}
const sound=new Sound();
function announce(value){text('announcer',value);}
function onEvent(e){
  ring.effect(e);sound.event(e);
  if(e.type==='hit'){game.freeze(e.special?.065:.032);game.shake(e.special?7:e.counter?3:1.5);}
  if(e.type==='hurt'){game.freeze(.06);game.shake(6);}
  if(e.type==='guarded')game.freeze(.013);
  if(e.type==='opponentDown'||e.type==='playerDown'){clearInput();game.shake(7);lastCount=0;}
  if(e.type==='reset'){newRecord=false;newTimeRecord=false;newScoreRecord=false;lastCount=0;}
  if(e.type==='mode'){lastUI=-100;}
  if(e.type==='result'){saveRecord(e.result);renderResult(e.result);announce(e.result.won?`You win by ${e.result.method}. Rank ${e.result.rank}.`:`Rook wins by ${e.result.method}.`);}
  if(e.type==='lessonComplete')announce('Lesson complete.');
  if(e.type==='phase')announce(`Phase ${e.phase}. ${e.phase===2?'Watch for two punches.':'Read the three-punch Last Shift.'}`);
}
bout=new Bout({difficulty:settings.difficulty,coach:settings.coach,onEvent});

function resizeGameViewport(){
  const rect=$('gameShell').getBoundingClientRect();
  if(rect.width<1||rect.height<1)return;
  const portrait=rect.height>rect.width;
  const width=portrait?720:Math.round(720*rect.width/rect.height);
  const height=portrait?Math.round(720*rect.height/rect.width):720;
  if(game.screen.W!==width||game.screen.H!==height)game.screen.setOptions({res:[width,height]});
  else game.screen.resize();
  game.focus(width/2,height/2);
  lastUI=-100;
}
function syncDisplayUI(){
  const active=display.active;
  const label=active?'Exit game mode':'Full screen';
  text('fullscreenLabel',active?'Exit':'Full screen');
  text('fullscreenIcon',active?'↙':'⛶');
  $('fullscreenButton').setAttribute('aria-label',active?'Exit game mode':'Enter full screen');
  $('fullscreenButton').title=label;
  text('menuDisplayButton',active?'Exit game mode':'Enter game mode');
  text('displayNote',display.native?'Full screen is on. Use Exit to leave game mode.':active?'Game mode is on. This browser keeps its own screen controls.':'Game mode fills the screen. You can play in either direction.');
  lastUI=-100;
}
display=new GameDisplay({
  onResize:()=>{resizeGameViewport();syncDisplayUI();},
  onModeChange:()=>syncDisplayUI(),
  onSuspend:({reason})=>{autoPause();clearInput();if(reason==='orientation')announce('View changed. Resume when you are ready.');},
  isPlaying:()=>!game.paused&&!modal&&!['title','result','trainingDone'].includes(bout.mode)
});

function clearInput(){touch?.clear();game.input.clear();lastPadDirection=null;}
function startBout(training=false){
  if(!assetsReady)return;if((display.compact||settings.showTouch)&&!display.active)void display.enter();if(modal)closeModal();game.paused=false;clearInput();bout.difficulty=settings.difficulty;bout.coach=settings.coach;bout.start(training);sound.start();$('screen').focus({preventScroll:true});lastUI=-100;
}
function title(){if(modal)closeModal();game.paused=false;clearInput();bout.mode='title';bout.modeTime=0;bout.punch=null;bout.playerAction=null;bout.notice='';bout.noticeTime=0;bout.combo=0;game.audio.music(null);lastUI=-100;announce('Last Bell. Enter the ring or learn the rhythm.');$('startButton').focus({preventScroll:true});}
function setPaused(paused){if(['title','result','trainingDone'].includes(bout.mode))return false;game.paused=!!paused;clearInput();lastUI=-100;if(paused)announce('Bout paused.');else $('screen').focus({preventScroll:true});return true;}
function openModal(id){
  if(modal)closeModal();pauseBeforeModal=game.paused;game.paused=true;clearInput();modal=$(id);modal.showModal();lastUI=-100;
}
function closeModal(){if(!modal)return;modal.close();modal=null;game.paused=pauseBeforeModal;clearInput();lastUI=-100;if(!game.paused&&bout.mode!=='title')$('screen').focus({preventScroll:true});}

function saveRecord(result){
  if(!result.won||bout.training)return;
  const key=`${result.difficulty}.${result.coach?'coach':'solo'}`,old=records[key];newTimeRecord=!old||result.time<old.time;newScoreRecord=!old||result.score>old.score;newRecord=newTimeRecord||newScoreRecord;
  records[key]={time:Math.min(old?.time??Infinity,result.time),score:Math.max(old?.score??0,result.score),rank:!old||result.score>=old.score?result.rank:old.rank,date:new Date().toISOString()};
  try{localStorage.setItem('last-bell.records.v1',JSON.stringify(records));}catch(_){storageOK=false;}
  updateRecordHint();
}
function updateRecordHint(){const row=records[`${settings.difficulty}.${settings.coach?'coach':'solo'}`];text('recordHint',row?timeText(row.time,true):'');}
function renderResult(r){
  $('resultTitle').innerHTML=r.won?'YOUR<br>NIGHT.':'BACK TO<br>THE GYM.';
  text('resultEyebrow',r.won?(newRecord?'NEW PERSONAL RECORD':'THE FOUNDRY / BOUT COMPLETE'):'THE FOUNDRY / LESSON LEARNED');
  text('resultMessage',r.won?`${r.method==='KO'?'A Break punch. A clean knockout.':'Three knockdowns. The ring is yours.'} ${DIFFICULTIES[r.difficulty].label}${r.coach?' · Coach cues':' · No cues'}.`:r.method==='TIME'?'The final bell went to Rook. Turn clean slips into fast counters.':bout.lastError||'Read the cue. Wait for the opening. Come back stronger.');
  text('resultRank',r.rank);text('resultMethod',r.method==='TIME'?'TIME EXPIRED':`${r.method} · ${r.won?'YOU WIN':'ROOK WINS'}`);
  const rows=[['BOUT TIME',timeText(r.time,true),newTimeRecord&&r.won?'PERSONAL BEST':'ACTIVE FIGHT TIME'],['SCORE',r.score.toLocaleString(),newScoreRecord&&r.won?'PERSONAL BEST':'CLEAN WORK COUNTS'],['ACCURACY',`${Math.round(r.accuracy*100)}%`,`${r.stats.landed} / ${r.stats.thrown} PUNCHES`],['COUNTERS',r.stats.counters,`${r.stats.perfect} PERFECT SLIPS`],['BEST COMBO',`${r.bestCombo} HITS`,`${r.playerDowns} KNOCKDOWNS TAKEN`]];
  $('resultStats').replaceChildren(...rows.map(([label,value,note])=>{const d=document.createElement('div'),s=document.createElement('span'),b=document.createElement('strong'),n=document.createElement('small');s.textContent=label;b.textContent=value;n.textContent=note;d.append(s,b,n);return d;}));
}
function renderRecords(){
  const host=$('recordsContent');host.replaceChildren();let n=0;
  for(const [key,label]of Object.entries(DIFFICULTIES))for(const cues of ['coach','solo']){const record=records[`${key}.${cues}`];if(!record)continue;n++;const row=document.createElement('div');row.className='records-row';const name=document.createElement('div');name.textContent=label.label;const small=document.createElement('small');small.textContent=cues==='coach'?'Coach cues':'No cues';name.append(small);const score=document.createElement('div');score.textContent=`${record.score.toLocaleString()} points`;const rank=document.createElement('small');rank.textContent=`Rank ${['S','A','B','C'].includes(record.rank)?record.rank:'—'}`;score.append(rank);const time=document.createElement('strong');time.textContent=timeText(record.time,true);row.append(name,score,time);host.append(row);}
  if(!n){const empty=document.createElement('p');empty.className='records-empty';empty.textContent='Your name goes on the board after your first win.';host.append(empty);}
}

function renderUI(){
  $('gameShell').dataset.state=JSON.stringify({...bout.snapshot(),worldTime:bout.worldTime,modeTime:bout.modeTime,enemyTime:bout.enemy.time,enemyDuration:bout.enemy.duration,paused:game.paused,assetsReady,filter:{mode:settings.mode,status:filter.status,ready:filter.ready},fps:game.fps,renderMs:Number(game.stats.renderMs.toFixed(2)),engineErrors:game.errors.length,display:{active:display.active,native:display.native,portrait:display.portrait,compact:display.compact,width:game.screen.W,height:game.screen.H},touch:touch?.snapshot(),guard:bout.guard,playerAction:bout.playerAction?.kind||null});
  const mode=bout.mode,isTitle=mode==='title',isResult=mode==='result',isDone=mode==='trainingDone',active=!isTitle&&!isResult&&!isDone,paused=game.paused&&!modal&&active;
  const touchUI=settings.showTouch||display.compact;
  document.body.dataset.bout=mode;
  document.body.dataset.padVisible=String(active&&!paused&&!modal&&!['playerDown','opponentDown'].includes(mode));
  document.body.classList.toggle('fight-active',active);
  document.body.classList.toggle('touch-active',touchUI);
  document.body.classList.toggle('ui-paused',!!game.paused||!!modal);
  document.body.classList.toggle('is-training',bout.training&&mode==='fight');
  $('touchControls').inert=!!game.paused||!!modal||mode!=='fight';
  text('playerName',touchUI?'YOU':'ARI FLINT');text('enemyName',touchUI?'ROOK':'ROOK CALDER');
  text('recoverButton',touchUI?'HOLD TO RISE':'HOLD SPACE TO RISE');
  display.setPlaying(active&&!game.paused&&!modal);
  show('titlePanel',isTitle);show('opponentCard',isTitle);show('ringLocation',isTitle);show('hud',active);show('pauseButton',active&&!paused&&!modal);show('pausePanel',paused);
  show('resultPanel',isResult);show('trainingDone',isDone);show('trainingPanel',bout.training&&mode==='fight'&&!paused&&!modal);
  show('lessonMobile',bout.training&&mode==='fight'&&!paused&&!modal&&touchUI);
  show('recoveryPanel',mode==='playerDown'&&bout.playerDowns<3&&!paused);
  const currentKey=`${settings.difficulty}.${settings.coach?'coach':'solo'}`;
  text('titleDifficulty',DIFFICULTIES[settings.difficulty].label.toUpperCase());
  text('footerStatus',!storageOK?'RECORDS ARE AVAILABLE FOR THIS SESSION':game.input.padIndex!==null?'GAMEPAD CONNECTED':isTitle?'A LITTLE NERVE. A LITTLE TIMING.':bout.training?'TRAINING / NO DAMAGE':`${DIFFICULTIES[bout.difficulty].label.toUpperCase()} / ${bout.coach?'COACH CUES':'NO CUES'}`);
  text('inputStatus',game.input.padIndex!==null?'GAMEPAD CONNECTED':'KEYBOARD + GAMEPAD');
  if(!active){show('cue',false);show('centerMessage',false);$('combatNotice').classList.remove('show');return;}
  const hp=bout.playerHP/100,ehp=bout.enemyHP/bout.enemyMaxHP;
  for(const[id,pct]of [['playerHealth',hp],['enemyHealth',ehp]]){const host=$(id);host.style.setProperty('--value',pct);host.querySelector('.health-fill').style.transform=`scaleX(${pct})`;host.querySelector('.health-ghost').style.transform=`scaleX(${pct})`;host.setAttribute('aria-valuenow',String(Math.round(pct*100)));}
  const dots=n=>Array.from({length:3},(_,i)=>i<n?'●':'○').join(' ');
  text('playerDownDots',dots(bout.playerDowns));text('enemyDownDots',dots(bout.enemyDowns));
  $('playerDownDots').setAttribute('aria-label',`${bout.playerDowns} player knockdowns`);$('enemyDownDots').setAttribute('aria-label',`${bout.enemyDowns} opponent knockdowns`);
  text('clock',bout.training?'∞':timeText(Math.ceil(bout.time)));text('roundLabel',bout.training?'TRAINING':'ROUND 01');text('phaseLabel',bout.training?`LESSON ${Math.min(4,bout.lesson+1)} / 4`:`PHASE ${bout.phase} / 3`);
  $('clock').parentElement.classList.toggle('urgent',bout.time<30&&!bout.training);
  $('focusFill').style.transform=`scaleX(${bout.focus/100})`;$('breakFill').style.transform=`scaleX(${bout.breakMeter/100})`;
  text('focusLabel',bout.focus>=100?'READY':`${Math.floor(bout.focus)}%`);text('breakLabel',`${Math.floor(bout.breakMeter)}%`);text('touchFocus',bout.focus>=100?'READY':`${Math.floor(bout.focus)}%`);
  const specialButton=document.querySelector('.special-touch');
  specialButton.classList.toggle('ready',bout.focus>=100);
  specialButton.style.setProperty('--focus',bout.focus/100);
  specialButton.setAttribute('aria-disabled',String(bout.focus<100));
  specialButton.setAttribute('aria-label',bout.focus>=100?'Break punch ready':'Break punch. Fill Focus to use.');
  const e=bout.enemy,telegraph=mode==='fight'&&e.state==='telegraph',opening=mode==='fight'&&((e.state==='recover'&&e.opening)||e.state==='stagger');
  const cues=settings.coach||bout.training;
  show('cue',!paused&&((telegraph&&cues)||opening));
  if(telegraph){
    const progress=Math.min(1,e.time/e.duration),ready=e.duration-e.time<=.31;
    $('cue').classList.toggle('ready',ready);$('cue').classList.remove('open');
    text('cueStep',bout.sequence.length>1?`${bout.phase===3&&bout.sequence.length===3?'THE LAST SHIFT':'COMBINATION'} · ${bout.sequenceIndex+1}/${bout.sequence.length}`:'READ THE PUNCH');
    text('cueName',e.move.name);
    const direction=e.move.defense==='duck'?'DUCK':e.move.defense==='either'?'SLIP EITHER WAY':`SLIP ${e.move.defense.toUpperCase()}`;
    text('cueAction',touchUI?direction:`${direction} · ${e.move.key}`);text('cueTiming',ready?'MOVE NOW':e.move.feint&&progress<.6?'WAIT THROUGH THE FEINT':'WAIT FOR THE FLASH');$('cueFill').style.transform=`scaleX(${progress})`;
  }else if(opening){
    $('cue').classList.add('open');$('cue').classList.remove('ready');text('cueStep',e.state==='stagger'?'RHYTHM BROKEN':'YOUR OPENING');text('cueName',e.state==='stagger'?'MAKE IT COUNT':`${e.openTarget.toUpperCase()} OPEN`);
    text('cueAction',touchUI?(bout.focus>=100?'BREAK PUNCH':e.openTarget==='body'?'BODY PUNCH':'HEAD PUNCH'):(bout.focus>=100?'BREAK PUNCH · L':e.openTarget==='body'?'BODY · U / I':'HEAD · J / K'));
    text('cueTiming',bout.focus>=100?'FULL FOCUS':'COUNTER NOW');$('cueFill').style.transform=`scaleX(${Math.max(0,1-e.time/e.duration)})`;
  }
  document.querySelectorAll('#touchControls [data-action]').forEach(button=>{
    const a=button.dataset.action;
    const defend=telegraph&&cues&&e.duration-e.time<=.31&&(e.move.defense===a||(e.move.defense==='either'&&['left','right'].includes(a)));
    const attack=opening&&(bout.focus>=100?a==='special':a.toLowerCase().endsWith(e.openTarget));
    button.classList.toggle('hint',!paused&&!modal&&(defend||attack));
  });
  $('combatNotice').classList.toggle('show',bout.noticeTime>0&&mode==='fight'&&!paused);text('combatNotice',bout.notice);
  if(bout.training&&mode==='fight'){
    const l=LESSONS[bout.lesson];if(l){text('lessonTitle',l.title);text('lessonText',bout.lessonPassed?'Good work. Get ready for the next lesson.':l.text);text('lessonGoal',l.goal);text('lessonMobileText',bout.lessonPassed?'Good work. Next lesson…':mobileLessons[bout.lesson]);$('lessonDots').innerHTML=LESSONS.map((_,i)=>`<i class="${i<bout.lesson?'done':i===bout.lesson?'current':''}"></i>`).join('');}
  }
  let center=null;
  if(mode==='intro')center=bout.modeTime<1.7?['TONIGHT / THE FOUNDRY','ROOK CALDER','“The Timekeeper”']:bout.modeTime<2.8?[bout.training?'TRAINING / NO DAMAGE':'ONE ROUND / THREE MINUTES','READY?','Watch the hands. Wait for your moment.']:['','FIGHT',''];
  if(mode==='phase')center=bout.phase===2?['PHASE 02','A CHANGE OF PACE','Watch the full combination. Then counter.']:['PHASE 03','THE LAST SHIFT','Slip right. Slip left. Duck the sweep.'];
  if(mode==='opponentDown'){
    if(bout.enemyDowns>=3)center=bout.knockout?['STAY DOWN',`${Math.min(10,1+Math.floor(bout.modeTime*1.6))}`,'THE COUNT IS ON']:['THREE KNOCKDOWNS','TKO','The Foundry has a new name.'];
    else center=bout.modeTime<.85?['KNOCKDOWN',`${bout.enemyDowns} / 3`,'Make every opening count.']:['THE COUNT',`${Math.min(6,1+Math.floor(bout.modeTime*1.2))}`,bout.modeTime>3.2?'Rook is getting back up.':''];
  }
  if(mode==='playerDown'&&bout.playerDowns>=3)center=['THREE KNOCKDOWNS','TKO','Rook keeps the ring.'];
  show('centerMessage',!!center&&!paused);if(center){text('centerEyebrow',center[0]);text('centerTitle',center[1]);text('centerText',center[2]);}
  if(mode==='playerDown'&&bout.playerDowns<3){const count=Math.min(10,1+Math.floor(bout.modeTime));text('recoveryCount',count);$('recoveryFill').style.transform=`scaleX(${bout.downProgress})`;if(count!==lastCount){lastCount=count;sound.audio.sfx('blip',{vol:.25,pitch:.6+count*.04});}}
}

function update(dt){
  const input=game.input;
  game.scene.pausable=!['title','result','trainingDone'].includes(bout.mode);
  if(modal)return;
  if(bout.mode==='title'){if(input.pressed('start'))startBout(false);bout.update(dt);return;}
  if(bout.mode==='result'){if(input.pressed('start'))startBout(false);bout.update(dt);return;}
  if(bout.mode==='trainingDone'){if(input.pressed('start'))startBout(false);bout.update(dt);return;}
  if(bout.mode==='fight'){
    bout.guard=input.down('guard')&&!bout.punch&&!bout.playerAction&&bout.playerHurt<=0;
    for(const name of ['left','right','duck'])if(input.pressed(name))bout.action(name);
    const [px,py]=input.padMove;
    const dir=py>.55?'duck':px<-.55?'left':px>.55?'right':null;
    if(dir&&dir!==lastPadDirection)bout.action(dir);lastPadDirection=dir;
    for(const name of ['special','leftHead','rightHead','leftBody','rightBody'])if(input.buffered(name,.13)&&bout.action(name,{target:bout.enemy.openTarget})){input.consume(name);break;}
  }
  bout.update(dt,{guard:input.down('guard'),recover:input.down('recover')});
}
function draw(r){if(game.paused!==lastObservedPaused){lastObservedPaused=game.paused;clearInput();lastUI=-100;}r.overlay(g=>ring.draw(g,bout));if(game.real-lastUI>.025||lastMode!==bout.mode){lastUI=game.real;lastMode=bout.mode;renderUI();}}
game.start({scene:'main',scenes:{main:{pausable:false,update,draw}}});

function applySettings(){
  for(const k of Object.keys(defaults)){
    const control=$(k);if(!control)continue;
    if(control.type==='checkbox')control.checked=settings[k];else control.value=settings[k];
  }
  for(const k of Object.keys(ranges))if($(k+'Value'))text(k+'Value',k==='colorLevels'?Math.round(settings[k]):k==='pixelSize'?`${Math.round(settings[k])} px`:`${Math.round(settings[k]*100)}%`);
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===settings.mode)));
  document.body.classList.toggle('show-touch',settings.showTouch);game.reduceMotion=settings.reducedMotion;sound.apply();
  $('soundButton').setAttribute('aria-label',settings.mute?'Unmute sound':'Mute sound');$('soundButton').title=settings.mute?'Unmute sound':'Mute sound';text('soundIcon',settings.mute?'♩':'♪');$('soundButton').style.opacity=settings.mute?'.45':'1';
  if(settings.coach&&bout.mode!=='title')bout.coach=true;
  text('soundLabel',settings.mute?'Unmute sound':'Mute sound');updateRecordHint();lastUI=-100;display.refresh();
}
for(const k of Object.keys(defaults)){
  const control=$(k);if(!control)continue;
  control.addEventListener(control.type==='range'?'input':'change',()=>{settings[k]=control.type==='checkbox'?control.checked:control.type==='range'?Number(control.value):control.value;persist();applySettings();});
}
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',async()=>{
  settings.mode=button.dataset.filter;persist();applySettings();
  if(settings.mode==='off'){filter.render({mode:'off'});text('gpuStatus','Original image active.');$('gpuStatus').classList.remove('active');}
  else await filter.init();
}));
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b===button;b.setAttribute('aria-selected',String(selected));show(b.dataset.tab,selected);});}));
document.querySelectorAll('.tab-list').forEach(list=>list.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const tabs=[...list.querySelectorAll('[role=tab]')];let i=tabs.indexOf(document.activeElement);i=event.key==='Home'?0:event.key==='End'?tabs.length-1:(i+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[i].click();tabs[i].focus();}));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModal));
document.querySelectorAll('dialog').forEach(d=>{d.addEventListener('cancel',e=>{e.preventDefault();closeModal();});d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});});
$('startButton').onclick=()=>startBout(false);$('trainingButton').onclick=()=>startBout(true);$('trainingBoutButton').onclick=()=>startBout(false);$('repeatTraining').onclick=()=>startBout(true);$('skipTraining').onclick=()=>startBout(false);$('skipTrainingMobile').onclick=()=>startBout(false);
$('menuButton').onclick=()=>openModal('gameMenuDialog');$('helpButton').onclick=()=>openModal('helpDialog');$('settingsButton').onclick=()=>openModal('settingsDialog');$('creditsButton').onclick=()=>openModal('creditsDialog');$('recordsButton').onclick=()=>{renderRecords();openModal('recordsDialog');};
$('helpTraining').onclick=()=>startBout(true);$('pauseButton').onclick=()=>setPaused(true);$('resumeButton').onclick=()=>setPaused(false);$('pauseSettings').onclick=()=>openModal('settingsDialog');$('restartButton').onclick=()=>startBout(bout.training);$('quitButton').onclick=title;$('rematchButton').onclick=()=>startBout(false);$('resultTitleButton').onclick=title;
$('soundButton').onclick=()=>{settings.mute=!settings.mute;persist();applySettings();if(!settings.mute)sound.audio.sfx('select',{vol:.25});};
$('fullscreenButton').onclick=()=>{void display.toggle();};
$('menuDisplayButton').onclick=()=>{closeModal();void display.toggle();};
$('resetSettings').onclick=()=>{Object.assign(settings,defaults);persist();applySettings();filter.render({mode:'off'});text('gpuStatus','Original image active.');};

touch=new TouchControls({
  input:game.input,
  canPress:action=>!game.paused&&!modal&&(action==='recover'?bout.mode==='playerDown'&&bout.playerDowns<3:bout.mode==='fight'),
  onGesture:()=>{if(!sound.started){sound.started=true;game.audio.sfx('select',{vol:0});}}
});
document.querySelectorAll('#touchControls [data-action]').forEach(button=>touch.bind(button,'Touch'+button.dataset.action,button.dataset.action));
touch.bind($('recoverButton'),'TouchRecover','recover');
function autoPause(){if(bout&&!['title','result','trainingDone'].includes(bout.mode)){game.paused=true;if(modal)pauseBeforeModal=true;clearInput();lastUI=-100;}}
addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
new ResizeObserver(()=>resizeGameViewport()).observe($('gameShell'));
if(new URLSearchParams(location.search).get('game')==='1'||matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches)void display.enter({native:false});

applySettings();syncDisplayUI();resizeGameViewport();renderUI();
$('startButton').disabled=true;$('trainingButton').disabled=true;
ring.load().then(()=>{assetsReady=true;$('startButton').disabled=false;$('trainingButton').disabled=false;if(settings.mode!=='off')filter.init();}).catch(error=>{show('loadError',true);text('loadError','The ring art could not load. Reload this page to try again. '+error.message);console.error(error);});

// Read-only state supports test harnesses and assistive tools. No gameplay shortcut is exposed.
window.lastBell=Object.freeze({version:VERSION,snapshot:()=>({...bout.snapshot(),paused:game.paused,assetsReady,filter:{mode:settings.mode,status:filter.status,ready:filter.ready},engineErrors:game.errors.length})});
if(new URLSearchParams(location.search).has('qa')){window.__lastBellQA={game,bout,ring,filter,settings,display,touch,startBout,setPaused,applySettings};import('./qa-harness.js');}
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch(_){/* Optional API. */}};
  register({name:'get_last_bell_bout',title:'Read Last Bell bout',description:'Read the current bout, health, phase, and display-filter status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(input&&Object.keys(input).length)throw new Error('No input fields are accepted.');return window.lastBell.snapshot();}});
  register({name:'set_last_bell_pause',title:'Pause or resume Last Bell',description:'Pause or resume the active bout using the game pause control.',inputSchema:{type:'object',properties:{paused:{type:'boolean'}},required:['paused'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.paused!=='boolean'||Object.keys(input).some(k=>k!=='paused'))throw new Error('Provide only paused as a boolean.');if(modal)throw new Error('Close the open game dialog first.');if(!setPaused(input.paused))throw new Error('There is no active bout.');renderUI();return{paused:game.paused,mode:bout.mode};}});
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
