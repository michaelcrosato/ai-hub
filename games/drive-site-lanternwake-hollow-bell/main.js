/* Lanternwake application: presentation, menus, saving and engine integration. */
(function () {
  'use strict';
  const E=My3D2dge, {World,SEAL_DEFS}=LanternCore;
  const $=id=>document.getElementById(id);
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=id=>'<svg aria-hidden="true"><use href="#i-'+id+'"/></svg>';
  const SAVE='lanternwake-hollow-v1', SETTINGS='lanternwake-settings-v1';
  const defaultSettings={sound:true,volume:.55,reduceMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,autoAttack:false,zoom:1,difficulty:'standard'};
  const settings={...defaultSettings,...E.store.get(SETTINGS,{})};
  let saveData=E.store.get(SAVE,null), world, screen='title', returnScreen='title', dialog=null, cutscene=null;
  let toastTime=0,areaTime=0,saveTime=0,hudClock=0,autoSaveClock=0,touchTipTime=0,endingShown=false,sessionStarted=false,contextKey='';
  const game=new E.Game({canvas:$('screen'),view:new E.View('lanternwake','Lanternwake',0,55,1.25,1.4),
    minH:310,minW:520,maxW:8192,maxH:8192,portrait:{minW:210,minH:330,maxW:8192,maxH:8192},
    bg:'#0c292e',input:LanternControls.bindings,step:1/120});
  game.pauseOverlay=false;game.cam.smooth=.16;game.reduceMotion=!!settings.reduceMotion;
  game.setZoom(clamp(Number(settings.zoom)||1,.7,1.45));
  const art=new LanternArt(game),audio=new LanternAudio(game);
  audio.setVolume(settings.volume);audio.setEnabled(settings.sound);
  const controls=new LanternControls(game,{
    onZoom:ratio=>{if(screen==='play'){settings.zoom=clamp(settings.zoom*ratio,.7,1.45);game.setZoom(settings.zoom);$('setting-zoom').value=Math.round(settings.zoom*100);}},
    onDevice:device=>{if($('device-caption'))$('device-caption').textContent=device==='gamepad'?'CONTROLLER CONNECTED':device==='touch'?'TOUCH · PINCH TO ZOOM':'KEYBOARD · CONTROLLER · TOUCH';updateDeviceHints(device);},
    onGameMode:active=>{$('fullscreen-button').setAttribute('aria-label',active?'Leave game mode':'Enter game mode');$('settings-game-mode').innerHTML=icon('expand')+(active?'Leave game mode':'Enter game mode');}
  });
  const panelIds={title:'title-screen',pause:'pause-panel',guide:'guide-panel',settings:'settings-panel',map:'map-panel',dialog:'dialog-panel',restore:'restore-panel',defeated:'defeated-panel',ending:'ending-panel',new:'new-panel'};
  const modalScreens=new Set(['title','pause','guide','settings','map','dialog','restore','defeated','new']);
  const AREAS={village:{name:'Bellwether Hollow',sub:'A place to come home to'},garden:{name:'The West Garden',sub:'Where the first echoes sleep'},grove:{name:'Mothwood',sub:'A small light in the leaves'},ruins:{name:'The Rain Archive',sub:'Stone remembers the river'},bell:{name:'The Bell Court',sub:'Listen to the silence'}};
  function titleWorld() {
    const w=new World();w.restored=new Set(SEAL_DEFS.map(s=>s.id));w.flags={bridgeBuilt:true,millRunning:true};w.completed=true;w.defeatedBoss=true;w.mode='title';
    w.seals.forEach(s=>{s.state='restored';s.remaining=0;});w.shrines.forEach(s=>s.active=true);w.hero.x=330;w.hero.y=877;w.hero.facing=-1.8;w.rebuildMap();return w;
  }
  function setScreen(next) {
    screen=next;
    for(const [name,id] of Object.entries(panelIds))$(id).hidden=name!==next||(name==='ending'&&!endingShown);
    $('hud').hidden=next==='title'||next==='new'||(next==='settings'||next==='guide')&&returnScreen==='title';
    $('menu-backdrop').hidden=!['pause','guide','settings','map','defeated','new'].includes(next)&&!(next==='ending'&&endingShown);
    if(next!=='play'){world.hero.vx=world.hero.vy=0;world.hero.attack=null;}
    world.mode=next==='play'?'playing':next;
    const panel=modalScreens.has(next)?$(panelIds[next]):next==='ending'&&endingShown?$('ending-panel'):null;
    controls.setModal(panel,{onCancel:cancelScreen});
    controls.clear();
    if(next==='map')updateMap();
    if(next==='settings')updateSettings();
    if(next==='guide')setControlTab(controls.device==='mouse'?'keyboard':controls.device);
    if(next==='play'){hudClock=1;game.cam.smooth=settings.reduceMotion?.01:.16;}
  }
  function cancelScreen() {
    if(screen==='dialog'){nextDialog();return;}
    if(screen==='restore'){endRestore();return;}
    if(screen==='guide'||screen==='settings'){setScreen(returnScreen);return;}
    if(screen==='map'||screen==='pause'){setScreen('play');return;}
    if(screen==='new'){setScreen('title');return;}
    if(screen==='ending'&&endingShown)explore();
  }
  function begin(newGame) {
    audio.unlock();if(controls.device==='touch')controls.enterGameMode();
    world=new World({difficulty:settings.difficulty});sessionStarted=true;endingShown=false;cutscene=null;
    if(!newGame&&saveData&&world.load(saveData)){settings.difficulty=world.difficulty;setScreen('play');showToast('The light kept your place','Welcome back to Bellwether Hollow.');}
    else {setScreen('play');world.startNew();processEvents();}
    game.cam.offset=null;game.cam.snap=true;game.setZoom(settings.zoom);touchTipTime=controls.device==='touch'?12:0;audio.setScene(world.completed?'ending':'village');updateHUD();
  }
  function showTitle() {
    if(sessionStarted)saveProgress();saveData=E.store.get(SAVE,null);
    world=titleWorld();sessionStarted=false;dialog=cutscene=null;endingShown=false;audio.setScene('village');
    $('continue-button').hidden=!saveData;
    $('begin-button').className=saveData?'text-button':'button primary';
    $('begin-button').innerHTML=saveData?'Begin a new journey':'Begin the journey'+icon('arrow');
    $('save-caption').textContent=saveData?saveData.completed?'The Hollow Bell is awake. Your village is waiting.':(saveData.restored?.length||0)+' of 8 echoes home · Saved on this device':'One complete chapter. Your progress saves as you play.';
    game.setZoom(matchMedia('(max-width: 699px)').matches?1.05:1.12);game.cam.snap=true;setScreen('title');
  }
  function saveProgress() {
    if(!sessionStarted||!world)return;
    saveData=world.snapshot();const ok=E.store.set(SAVE,saveData);saveTime=2.5;
    $('save-indicator').textContent=ok?'✦ Saved':'Save unavailable';
    if(!ok&&!saveProgress.warned){showToast('This browser could not save','Keep this tab open. Browser storage may be blocked.');saveProgress.warned=true;}
  }
  function saveSettings(){E.store.set(SETTINGS,settings);}
  function showToast(title,text,seconds=4){$('toast-title').textContent=title;$('toast-text').textContent=text;toastTime=seconds;$('toast').hidden=false;}
  function showArea(area){const a=AREAS[area]||AREAS.village;$('area-card').querySelector('h2').textContent=a.name;$('area-card').querySelector('span').textContent='';$('area-card').hidden=false;areaTime=2.8;}
  function openDialog(e) {
    dialog={...e,index:0};$('dialog-name').textContent=e.name;$('dialog-subtitle').textContent=e.subtitle||'';
    $('dialog-portrait').innerHTML=icon(e.name.toLowerCase().includes('willow')?'leaf':e.name.includes('Warden')?'spark':'bell');
    setScreen('dialog');renderDialog();
  }
  function renderDialog(){if(!dialog)return;$('dialog-text').textContent=dialog.lines[dialog.index];$('dialog-page').textContent=Array.from({length:dialog.lines.length},(_,i)=>i===dialog.index?'◆':'◇').join(' ');$('dialog-next').innerHTML=(dialog.index===dialog.lines.length-1?'Return to the hollow':'Continue')+icon('arrow');}
  function nextDialog(){if(!dialog)return;audio.sfx('select');dialog.index++;if(dialog.index>=dialog.lines.length){dialog=null;setScreen('play');}else renderDialog();}
  function beginRestore(e) {
    cutscene={time:0,target:e.target||[world.hero.x,world.hero.y],duration:settings.reduceMotion?3.3:4.6,returning:false};
    $('restore-name').textContent=e.name;$('restore-reward').textContent=e.reward;$('restore-detail').textContent=e.detail;
    world.effect('magic',e.target[0],e.target[1],{life:4,radius:100,color:'#c8efb1'});setScreen('restore');
  }
  function endRestore(){cutscene=null;setScreen('play');game.cam.snap=!!settings.reduceMotion;}
  function processEvents() {
    const events=world.events.splice(0);
    for(const e of events){
      if(e.type==='sfx')audio.sfx(e.name);
      else if(e.type==='impact')game.shake(e.strength);
      else if(e.type==='save')saveProgress();
      else if(e.type==='dialog')openDialog(e);
      else if(e.type==='restored')beginRestore(e);
      else if(e.type==='toast')showToast(e.title,e.text);
      else if(e.type==='area')showArea(e.area);
      else if(e.type==='encounter'){showToast(e.label,'A finite seal · '+e.total+' shadows hold this echo.',2.4);audio.sfx('seal');}
      else if(e.type==='sealReady'){showToast('The hush breaks','Step onto the glowing seal to bring its echo home.',3.4);audio.sfx('checkpoint');}
      else if(e.type==='gate'){world.effect('magic',e.target[0],e.target[1],{life:3,radius:90});audio.sfx('restore');}
      else if(e.type==='bossStart'){audio.setScene('boss');game.cam.snap=false;}
      else if(e.type==='bossDefeated'){showToast('The Warden is silent','Return to the bell and give the hollow its voice.',6);audio.setScene('ending');game.shake(4);}
      else if(e.type==='defeated'){setScreen('defeated');audio.sfx('bell');}
      else if(e.type==='travel'){game.cam.snap=true;audio.sfx('checkpoint');showArea(world.area);}
      else if(e.type==='complete')startEnding();
    }
  }
  function startEnding(){endingShown=false;cutscene=null;setScreen('ending');audio.setScene('ending');audio.sfx('bell');world.effect('magic',352,166,{life:4,radius:160});saveProgress();}
  function showEnding(){endingShown=true;world.hero.x=330;world.hero.y=883;world.hero.facing=1.57;world.hero.pose='cheer';game.cam.snap=false;const mins=Math.floor(world.playTime/60),secs=Math.floor(world.playTime%60);$('ending-stats').innerHTML='<div><strong>8 / 8</strong><small>ECHOES HOME</small></div><div><strong>'+world.seeds.filter(s=>s.found).length+' / 3</strong><small>MEMORY SEEDS</small></div><div><strong>'+mins+':'+String(secs).padStart(2,'0')+'</strong><small>JOURNEY TIME</small></div>';setScreen('ending');}
  function explore(){world.exploreEnding();endingShown=false;setScreen('play');game.cam.snap=true;audio.setScene('ending');showToast('Welcome home','Speak to Sella and the villagers. There is time to listen.',5);processEvents();}
  function updateDeviceHints(device) {
    if(!$('keyboard-hints'))return;
    if(device==='gamepad')$('keyboard-hints').innerHTML='<span><kbd>LEFT STICK</kbd> Move</span><span><kbd>×</kbd> Blade</span><span><kbd>○</kbd> Dash</span><span id="magic-hint"><kbd>□</kbd> Mothlight</span>';
    else $('keyboard-hints').innerHTML='<span><kbd>W A S D</kbd> Move</span><span><kbd>J</kbd> Blade</span><span><kbd>SPACE</kbd> Dash</span><span id="magic-hint"><kbd>L</kbd> Mothlight</span>';
  }
  function updateHUD() {
    const h=world.hero,o=world.objective(),a=AREAS[world.area]||AREAS.village;
    let hearts='';for(let i=0;i<h.maxHp/2;i++)hearts+='<svg class="'+(h.hp>=i*2+2?'full':h.hp>i*2?'half':'empty')+'" aria-hidden="true"><use href="#i-heart"/></svg>';
    if($('hearts').innerHTML!==hearts)$('hearts').innerHTML=hearts;
    $('hearts').setAttribute('aria-label','Health '+h.hp+' of '+h.maxHp);
    $('hero-rank').textContent=['','I','II','III'][h.level];
    $('light-pips').innerHTML=Array.from({length:3},(_,i)=>'<span class="light-pip"><i style="height:'+clamp((h.light-i)*100,0,100)+'%"></i></span>').join('');
    $('light-meter').classList.toggle('locked',!world.restored.has('moth'));$('light-meter').setAttribute('aria-label',world.restored.has('moth')?'Mothlight '+Math.floor(h.light)+' of 3 charges':'Mothlight is not yet restored');
    $('restored-count').innerHTML=world.restored.size+' <i>/ 8</i>';$('area-name').textContent=a.name.toUpperCase();$('objective-title').textContent=o.title;$('objective-detail').textContent=o.text;
    updateContext();
    $('touch-magic').hidden=!world.restored.has('moth');$('touch-magic').disabled=h.light<1;
    $('touch-dash').style.opacity=h.dashCooldown>0?'.45':'1';
    if($('magic-hint'))$('magic-hint').hidden=!world.restored.has('moth');
    const boss=world.boss&&!world.boss.dead?world.boss:null;$('boss-hud').hidden=!boss;
    if(boss){$('boss-fill').style.width=(boss.hp/boss.maxHp*100)+'%';$('boss-state').textContent=boss.state==='recover'?'Its light fades. Strike now.':boss.state==='wind'?(boss.pattern===0?'A ring is forming.':boss.pattern===1?'A volley is forming.':'Move away from the marked path.'):'Toll '+['','I','II','III'][boss.phase];}
    $('sound-button').classList.toggle('muted',!settings.sound);$('sound-button').setAttribute('aria-label',settings.sound?'Mute sound':'Enable sound');
  }
  function updateContext() {
    const context=screen==='play'&&!world.combat?world.context():null;
    const key=context?context.kind+'|'+context.label+'|'+controls.device:'';
    if(key===contextKey)return;contextKey=key;
    controls.setContextAvailable(!!context);$('context-prompt').hidden=!context;
    if(context){$('context-prompt').querySelector('span').textContent=context.label;$('context-prompt').querySelector('kbd').textContent=controls.device==='gamepad'?'△':'E';$('touch-interact').querySelector('span').textContent=context.label;}
  }
  function updateMap() {
    $('map-progress').textContent=world.restored.size+' of 8 echoes home';
    $('echo-list').innerHTML=world.seals.map((s,i)=>'<div class="echo-entry '+(s.state==='restored'?'restored':'')+'"><i>'+(s.state==='restored'?'✓':i+1)+'</i><div><strong>'+esc(s.name)+'</strong><small>'+(s.state==='restored'?'HOME':s.state==='ready'?'READY TO RETURN':s.state==='active'?s.remaining+' SHADOWS REMAIN':'HELD IN THE HUSH')+'</small></div></div>').join('');
    $('seed-count').textContent=world.seeds.filter(s=>s.found).length+' / 3 memory seeds';
    $('travel-list').innerHTML=world.shrines.filter(s=>s.active).map(s=>'<button data-travel="'+s.id+'" '+(world.combat?'disabled':'')+'>'+esc(s.name)+'</button>').join('');
    $('travel-note').textContent=world.combat?'Finish the encounter before you travel.':'Travel restores your health. Completed echoes stay home.';
    const o=world.objective();$('map-objective').textContent=o.title;$('map-detail').textContent=o.text;
    const c=$('world-map'),g=c.getContext('2d'),scale=9,ox=40,oy=24;
    g.clearRect(0,0,c.width,c.height);g.fillStyle='#0b252b';g.fillRect(0,0,c.width,c.height);
    const colors={'#':'#3c5954',',':'#28493c','.':'#6c7760',':':'#405957','~':'#0b252b','=':'#bca16d','G':'#494354'};
    for(let y=0;y<world.height;y++)for(let x=0;x<world.width;x++){const tile=world.tiles[y][x];if(tile==='~')continue;g.fillStyle=colors[tile]||'#223e36';g.fillRect(ox+x*scale,oy+y*scale,scale,scale);}
    const point=(x,y)=>[ox+x/16*scale,oy+y/16*scale];
    const label=(text,x,y)=>{g.font='500 11px system-ui';g.textAlign='center';g.fillStyle='#c2cfad';g.shadowColor='#092329';g.shadowBlur=5;g.fillText(text,...point(x,y));g.shadowBlur=0;};
    label('WEST GARDEN',294,466);label('BELLWETHER HOLLOW',332,966);label('MOTHWOOD',935,924);label('RAIN ARCHIVE',990,148);label('BELL COURT',350,130);
    for(const s of world.seals){const [x,y]=point(s.x,s.y);g.fillStyle=s.state==='restored'?'#9eccaa':s.state==='ready'?'#f2d28c':'#bc8ea6';g.beginPath();g.moveTo(x,y-6);g.lineTo(x+6,y);g.lineTo(x,y+6);g.lineTo(x-6,y);g.closePath();g.fill();}
    for(const s of world.shrines)if(s.active){const [x,y]=point(s.x,s.y);g.strokeStyle='#8de3c4';g.lineWidth=2;g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.stroke();}
    for(const s of world.seeds)if(s.found||world.restored.has('rook')){const [x,y]=point(s.x,s.y);g.fillStyle=s.found?'#a6c28c':'#e4d592';g.fillRect(x-2,y-2,4,4);}
    if(!world.completed){const [x,y]=point(o.x,o.y);g.strokeStyle='#eac98f';g.lineWidth=1.5;g.setLineDash([3,3]);g.beginPath();g.arc(x,y,13,0,Math.PI*2);g.stroke();g.setLineDash([]);}
    const [hx,hy]=point(world.hero.x,world.hero.y);g.fillStyle='#fff0c2';g.strokeStyle='#102724';g.lineWidth=2;g.beginPath();g.moveTo(hx,hy-8);g.lineTo(hx+6,hy+6);g.lineTo(hx,hy+3);g.lineTo(hx-6,hy+6);g.closePath();g.fill();g.stroke();
  }
  const CONTROL_CONTENT={
    keyboard:{rows:[['Move','WASD / Arrow keys'],['Blade','J / Z / Left click'],['Dash','Space / K / X'],['Mothlight','L / C / Right click'],['Speak / Use','E / Enter'],['Keep facing','Hold Shift'],['Map / Travel','M / Tab'],['Pause','Esc / P']],note:'Hold the blade button to chain attacks. With a mouse, attack toward the cursor. Use the wheel to change the view.'},
    gamepad:{rows:[['Move','Left stick / D-pad'],['Blade','× Cross'],['Dash','○ Circle / R1'],['Mothlight','□ Square / R2'],['Speak / Use','△ Triangle'],['Aim / Keep facing','Right stick / L1'],['Map / Pause','Touchpad / Options'],['Menus','D-pad · × Select · ○ Back']],note:'Connect your DualSense by USB or Bluetooth, then press a button. Controls use the browser’s standard gamepad mapping. Use the menu zoom setting to change the view.'},
    touch:{rows:[['Move','Drag anywhere on the world'],['Blade','Automatic near a shadow'],['Dash','Tap the arrow button'],['Mothlight','Tap the light button'],['Speak / Use','Tap the nearby action'],['Change view','Pinch with two fingers'],['Map / Pause','Top-right buttons'],['Full screen','Enter game mode']],note:'There is no fixed joystick. Start your thumb where it is comfortable. Move with one finger and use an ability with another. Two fingers on the world change the view. System gestures remain available.'}
  };
  function setControlTab(device){const tab=CONTROL_CONTENT[device]?device:'keyboard';document.querySelectorAll('[data-control-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.controlTab===tab)));const content=CONTROL_CONTENT[tab];$('controls-table').innerHTML=content.rows.map(([a,b])=>'<div class="control-row"><span>'+a+'</span><span>'+b+'</span></div>').join('');$('control-note').textContent=content.note;}
  function updateSettings(){
    $('setting-sound').checked=settings.sound;$('setting-volume').value=Math.round(settings.volume*100);$('setting-motion').checked=settings.reduceMotion;$('setting-auto').checked=settings.autoAttack;$('setting-zoom').value=Math.round(settings.zoom*100);
    $('difficulty-gentle').classList.toggle('selected',settings.difficulty==='gentle');$('difficulty-standard').classList.toggle('selected',settings.difficulty==='standard');document.documentElement.classList.toggle('reduce-motion',settings.reduceMotion);
  }
  function openSecondary(next){returnScreen=screen==='title'?'title':'pause';setScreen(next);audio.sfx('select');}
  function setDifficulty(value){settings.difficulty=value;if(sessionStarted){world.difficulty=value;saveProgress();}saveSettings();updateSettings();}
  function toggleGameMode(){audio.unlock();return controls.gameMode?controls.leaveGameMode():controls.enterGameMode();}
  $('begin-button').onclick=()=>{if(saveData)setScreen('new');else begin(true);};
  $('continue-button').onclick=()=>begin(false);$('confirm-new').onclick=()=>begin(true);$('cancel-new').onclick=()=>setScreen('title');
  $('guide-title').onclick=()=>openSecondary('guide');$('settings-title').onclick=()=>openSecondary('settings');
  $('pause-button').onclick=()=>{if(screen==='play'){setScreen('pause');audio.sfx('pause');}};
  $('map-button').onclick=()=>{if(screen==='play'){setScreen('map');audio.sfx('select');}};
  $('fullscreen-button').onclick=toggleGameMode;$('settings-game-mode').onclick=toggleGameMode;
  $('sound-button').onclick=()=>{settings.sound=!settings.sound;audio.setEnabled(settings.sound);if(settings.sound)audio.unlock();saveSettings();updateHUD();};
  $('resume-button').onclick=()=>setScreen('play');$('pause-map').onclick=()=>setScreen('map');$('pause-guide').onclick=()=>openSecondary('guide');$('pause-settings').onclick=()=>openSecondary('settings');
  $('title-button').onclick=showTitle;$('ending-title').onclick=showTitle;$('dialog-next').onclick=nextDialog;$('restore-next').onclick=endRestore;
  $('retry-button').onclick=()=>{world.resume();setScreen('play');game.cam.snap=true;showToast('Every echo is still home','The unfinished encounter is ready for another attempt.',4);};
  $('retry-gentle').onclick=()=>{setDifficulty('gentle');$('retry-button').click();};$('explore-button').onclick=explore;
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=cancelScreen);
  document.querySelectorAll('[data-control-tab]').forEach(b=>b.onclick=()=>setControlTab(b.dataset.controlTab));
  $('travel-list').onclick=e=>{const b=e.target.closest('[data-travel]');if(!b||b.disabled)return;if(world.travel(b.dataset.travel)){setScreen('play');processEvents();}};
  $('setting-sound').onchange=e=>{settings.sound=e.target.checked;audio.setEnabled(settings.sound);if(settings.sound)audio.unlock();saveSettings();};
  $('setting-volume').oninput=e=>{settings.volume=Number(e.target.value)/100;audio.setVolume(settings.volume);saveSettings();};
  $('setting-motion').onchange=e=>{settings.reduceMotion=e.target.checked;game.reduceMotion=settings.reduceMotion;document.documentElement.classList.toggle('reduce-motion',settings.reduceMotion);saveSettings();};
  $('setting-auto').onchange=e=>{settings.autoAttack=e.target.checked;saveSettings();};
  $('setting-zoom').oninput=e=>{settings.zoom=Number(e.target.value)/100;game.setZoom(settings.zoom);saveSettings();};
  $('difficulty-gentle').onclick=()=>setDifficulty('gentle');$('difficulty-standard').onclick=()=>setDifficulty('standard');
  addEventListener('blur',()=>{if(screen==='play')setScreen('pause');saveProgress();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(screen==='play')setScreen('pause');saveProgress();}});
  addEventListener('pagehide',()=>{saveProgress();saveSettings();});
  game.onError=(error,where)=>{$('error-text').textContent='A '+where+' error occurred: '+error.message+'. Your last saved restoration is safe.';$('error-panel').hidden=false;};

  function camera(dt) {
    const portrait=game.screen.portrait,h=world.hero;
    if(screen==='title'||screen==='new'||((screen==='guide'||screen==='settings')&&returnScreen==='title')) {
      const small=window.innerWidth<700;
      game.cam.offset=small?[30,-game.H*.28]:[game.W*.235,12];game.focus(335+(settings.reduceMotion?0:Math.sin(world.time*.13)*8),846,7);return;
    }
    game.cam.offset=portrait?[0,-10]:[0,8];
    if(screen==='restore'&&cutscene&&!settings.reduceMotion&&cutscene.time>.45&&cutscene.time<cutscene.duration-.7){game.focus(cutscene.target[0],cutscene.target[1],14);game.cam.smooth=.36;return;}
    if(screen==='ending') {game.focus(endingShown?330:352,endingShown?850:188,15);game.cam.smooth=settings.reduceMotion?.01:.55;game.cam.offset=endingShown?[game.W*.19,0]:null;return;}
    if(world.boss&&!world.boss.dead){game.focus(h.x*.64+world.boss.x*.36,h.y*.64+world.boss.y*.36,11);}
    else game.focus(h.x+h.vx*.16,h.y+h.vy*.13,10);
  }
  function drawObjective(r) {
    if(screen!=='play'||world.completed||world.combat)return;
    const o=world.objective(),h=world.hero,d=Math.hypot(o.x-h.x,o.y-h.y);if(d<66)return;
    const target=r.w(o.x,o.y,0),margin=29,top=window.innerWidth<700?112/(game.screen.S/game.screen.dpr):70;
    const inside=target[0]>margin&&target[0]<r.W-margin&&target[1]>top&&target[1]<r.H-margin;
    if(inside)return;
    r.overlay(g=>{const center=r.w(h.x,h.y,7),dx=target[0]-center[0],dy=target[1]-center[1],angle=Math.atan2(dy,dx),s=Math.min((r.W/2-margin)/Math.max(1,Math.abs(dx)),(r.H/2-margin)/Math.max(1,Math.abs(dy)));let x=clamp(center[0]+dx*s,margin,r.W-margin),y=clamp(center[1]+dy*s,top,r.H-margin-12);
      E.px.ell(g,x,y,8,8,'#102c2f');const points=[[x+Math.cos(angle)*5,y+Math.sin(angle)*5],[x+Math.cos(angle+2.4)*4,y+Math.sin(angle+2.4)*4],[x+Math.cos(angle-2.4)*4,y+Math.sin(angle-2.4)*4]];E.px.poly(g,points,'#dfc389');});
  }
  showTitle();updateSettings();
  game.start({
    pausable:false,
    update(dt){
      const input=controls.update(dt);
      if(input.pause){if(screen==='play'){setScreen('pause');audio.sfx('pause');}else cancelScreen();}
      if(input.map){if(screen==='play'||screen==='pause')setScreen('map');else if(screen==='map')setScreen('play');}
      const ground=game.view.screenDirToGround(...input.move);input.move=ground;
      if(input.aimType==='direction')input.aim=game.view.screenDirToGround(...input.aim);
      input.autoAttack=controls.device==='touch'||settings.autoAttack;
      world.update(dt,screen==='play'?input:{});processEvents();updateContext();
      if(screen==='restore'&&cutscene){cutscene.time+=dt;if(cutscene.time>=cutscene.duration)endRestore();}
      if(screen==='ending'&&!endingShown&&world.endingTime>3.2)showEnding();
      art.update(dt,world);camera(dt);
      const scene=world.completed||world.defeatedBoss?'ending':world.boss&&!world.boss.dead?'boss':world.area==='village'?'village':world.area==='ruins'||world.area==='bell'?'ruins':'garden';
      audio.setScene(sessionStarted?scene:'village');audio.update(dt,{combat:world.combat,paused:!['play','title','ending','restore'].includes(screen),restored:world.restored.size,totalSeals:8});
      hudClock+=dt;if(hudClock>.12){hudClock=0;if(screen!=='title')updateHUD();}
      autoSaveClock+=dt;if(autoSaveClock>12){autoSaveClock=0;if(screen==='play')saveProgress();}
      toastTime=Math.max(0,toastTime-dt);areaTime=Math.max(0,areaTime-dt);saveTime=Math.max(0,saveTime-dt);touchTipTime=Math.max(0,touchTipTime-dt);
      $('toast').hidden=toastTime<=0||!['play'].includes(screen);$('area-card').hidden=areaTime<=0||screen!=='play';$('save-indicator').classList.toggle('visible',saveTime>0);$('touch-tip').hidden=screen!=='play'||touchTipTime<=0||controls.device!=='touch';
    },
    draw(r){art.draw(r,world);drawObjective(r);}
  });
  // The engine and model remain inspectable for development and accessibility tooling.
  window.Lanternwake={engine:game,controls,audio,art,get world(){return world;},get screen(){return screen;},get settings(){return {...settings};},version:'1.0.0'};
  if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
