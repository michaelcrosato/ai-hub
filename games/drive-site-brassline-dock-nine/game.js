/* BRASSLINE · Scene, input, audio, menus, records, and engine integration. */
(function () {
  'use strict';
  const E = My3D2dge, C = BrasslineCombat;
  const $ = id => document.getElementById(id);
  const defaults = { difficulty: 'contender', touch: 'auto', hints: true, reducedMotion: !!matchMedia('(prefers-reduced-motion: reduce)').matches, music: 35, sfx: 70, filter: 'off', mix: 85, levels: 7, edge: 55, pixel: 3, saturation: 105 };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const loadedSettings = E.store.get('brassline:settings:v1', {});
  const settings = { ...defaults };
  for (const key of Object.keys(defaults)) if (typeof loadedSettings[key] === typeof defaults[key]) settings[key] = loadedSettings[key];
  if (!['auto','on','off'].includes(settings.touch)) settings.touch = 'auto';
  if (!C.LEVELS[settings.difficulty]) settings.difficulty = 'contender';
  if (!['off', 'cel', 'pixel', 'hybrid'].includes(settings.filter)) settings.filter = 'off';
  for (const [key, lo, hi] of [['music',0,100],['sfx',0,100],['mix',0,100],['levels',3,16],['edge',0,100],['pixel',1,8],['saturation',50,150]]) settings[key] = clamp(Number.isFinite(settings[key]) ? settings[key] : defaults[key], lo, hi);
  let records = E.store.get('brassline:records:v1', {});
  if (!records || typeof records !== 'object' || Array.isArray(records)) records = {};
  let touchMode = false, gameMode = true, touchControls, resizeFrame = 0, previousOrientation = null, lastSize = '', toastTimer = 0, wakeLock = null, wakeWanted = false, wakePending = false, hadNativeFullscreen = false, lastNativeExit = -Infinity;
  let ready = false, onTitle = true, bout, activeDialog = null, lastCue = '', padDirection = '', uiTick = 0, resultShown = false;
  const map = {
    bodyLeft: ['KeyJ', 'KeyZ', 'Pad2', 'TouchBodyLeft'], bodyRight: ['KeyK', 'KeyX', 'Pad0', 'TouchBodyRight'],
    headLeft: ['KeyU', 'Pad3', 'TouchHeadLeft'], headRight: ['KeyI', 'Pad1', 'TouchHeadRight'],
    left: ['KeyA', 'ArrowLeft', 'Pad14', 'TouchLeft'], right: ['KeyD', 'ArrowRight', 'Pad15', 'TouchRight'],
    down: ['KeyS', 'ArrowDown', 'Pad13', 'TouchDuck'], up: ['KeyW', 'ArrowUp', 'Pad12'],
    guard: ['ShiftLeft', 'ShiftRight', 'Pad4', 'TouchGuard'], power: ['Space', 'KeyL', 'Pad5', 'TouchPower'],
    rise: ['Space', 'KeyJ', 'KeyK', 'Pad0', 'Pad2', 'TouchRise'], start: ['Enter', 'NumpadEnter', 'Pad9'], pause: ['Escape', 'KeyP', 'Pad9']
  };
  const game = new E.Game({ canvas: 'screen', res: [960,540], view: 'overhead', views: ['overhead'], smoothFit: true, step: 1/120, input: map, bg: '#10212c' });
  game.cam.smooth = 0; game.pauseOverlay = false; game.reduceMotion = settings.reducedMotion;
  const renderer = new BrasslineRenderer(game);
  const filter = new BrasslineFilter($('screen'), $('gpu-screen'), $('gpu-status'));
  game.screen.onPresent = (canvas, w, h) => filter.present(canvas, w, h);
  const nodeText = (id, text) => { const n = $(id), value = String(text); if (n && n.textContent !== value) n.textContent = value; };
  const show = (id, visible) => { const n = $(id); if (n.hidden === visible) n.hidden = !visible; };
  const width = (id, value) => { const n = $(id), v = Math.round(clamp(value, 0, 100)) + '%'; if (n.style.width !== v) n.style.width = v; };
  const formatTime = seconds => { const n = Math.max(0, Math.ceil(seconds)); return Math.floor(n/60) + ':' + String(n%60).padStart(2,'0'); };
  const preciseTime = seconds => { const m = Math.floor(seconds/60), s = (seconds % 60).toFixed(2).padStart(5,'0'); return m + ':' + s; };
  const announce = text => nodeText('announcer', text);

  function soundSetup() {
    game.audio.define('ringBell', [{ wave:'sine',freq:820,to:808,dur:1.6,vol:.32 }, { wave:'sine',freq:1213,dur:1.1,vol:.17 }, { wave:'sine',freq:1798,dur:.75,vol:.09 }, { wave:'noise',freq:4200,dur:.025,vol:.12 }]);
    game.audio.define('leather', [{wave:'noise',freq:1500,to:350,dur:.085,vol:.32},{wave:'sine',freq:95,to:45,dur:.13,vol:.48}]);
    game.audio.define('guardHit', [{wave:'noise',freq:800,to:180,dur:.09,vol:.23},{wave:'triangle',freq:145,to:80,dur:.08,vol:.23}]);
    game.audio.define('breakHit', [{wave:'noise',freq:1800,to:220,dur:.19,vol:.38},{wave:'sine',freq:80,to:28,dur:.3,vol:.6},{wave:'triangle',freq:370,to:100,dur:.075,vol:.18}]);
    game.audio.define('cleanDodge', [{wave:'noise',freq:3000,to:6500,dur:.12,vol:.06},{wave:'sine',freq:660,to:880,dur:.09,vol:.10}]);
    game.audio.define('perfectDodge', [{wave:'sine',freq:880,dur:.18,vol:.18},{wave:'sine',freq:1320,dur:.22,vol:.1,delay:.04}]);
    game.audio.define('crowd', {wave:'noise',freq:700,to:1100,dur:1.2,vol:.09,attack:.1});
    game.audio.define('footstep', {wave:'noise',freq:250,to:150,dur:.1,vol:.11});
    game.audio.define('tellNote', {wave:'sine',freq:270,to:235,dur:.16,vol:.08});
    game.audio.define('powerReady', [{wave:'triangle',freq:440,dur:.15,vol:.13},{wave:'triangle',freq:660,dur:.2,vol:.1,delay:.08},{wave:'sine',freq:880,dur:.3,vol:.1,delay:.16}]);
  }
  const SONG = { bpm:104, steps:4, tracks:[
    {wave:'triangle',vol:.16,notes:'D2 . . D3 . . A2 . D2 . F2 . G2 . A2 . | Bb1 . . Bb2 . . F2 . Bb1 . C2 . A1 . C2 .'},
    {wave:'sine',vol:.12,notes:'D4 - . . F4 - . . A4 - . G4 F4 - . . | D4 - . . F4 - . . Bb4 - . A4 G4 - . .'},
    {wave:'pulse',vol:.025,notes:'. . A4 . . . F4 . . . D5 . . . C5 . | . . Bb4 . . . A4 . . . G4 . F4 . E4 .'},
    {wave:'drums',vol:.34,notes:'k . h . s . h h k . h . s . h . | k . h . s . h . k k h . s . h h'}
  ]};
  const WIN_SONG = {bpm:115,steps:3,loop:false,tracks:[{wave:'triangle',vol:.18,notes:'D4 F4 A4 D5 - - C5 A4 G4 F4 - - A4 C5 D5 - - -'},{wave:'sine',vol:.22,notes:'D2 - - F2 - - C2 - - G2 - - D2 - - - - -'}]};
  soundSetup();
  function mixAudio() { game.audio.musicVolume = settings.music / 100; game.audio.sfxVolume = settings.sfx / 100; game.audio.setVolume(.8); }
  mixAudio();
  function saveSettings() { E.store.set('brassline:settings:v1', settings); }
  function focusRing() { $('screen').focus({preventScroll:true}); }
  function clearInput() { touchControls?.clear(); game.input.clear(); padDirection = ''; document.querySelectorAll('[data-code].held').forEach(b=>b.classList.remove('held')); }
  function closeDialogs() {
    for (const d of document.querySelectorAll('dialog[open]')) d.close();
    activeDialog = null; game.uiPaused = false; game.input.disabled = false; clearInput(); updateWakeLock();
  }
  function openDialog(id) {
    if (activeDialog === id) return;
    closeDialogs(); activeDialog = id; game.uiPaused = true; clearInput();
    $(id).showModal(); updateWakeLock(); announce($(id).querySelector('h2')?.textContent || 'Game menu');
  }
  for (const d of document.querySelectorAll('dialog')) {
    d.addEventListener('close', () => { if (activeDialog === d.id) { activeDialog = null; game.uiPaused = false; clearInput(); updateWakeLock(); if (!onTitle) focusRing(); } });
    d.addEventListener('cancel', e => {
      if (['results-dialog','trained-dialog'].includes(d.id)) { e.preventDefault(); return; }
      e.preventDefault(); d.close();
    });
  }
  function begin(practice = false) {
    if (!ready) return;
    void enterGameMode(false);
    closeDialogs(); game.audio.sfx('confirm', {vol:.6}); game.audio.music(SONG); clearInput();
    game.go('ring', {practice}, {fade:.12}); focusRing();
  }
  function goTitle() { closeDialogs(); game.audio.music(null); clearInput(); game.go('title', null, {fade:.15}); }
  function togglePause() { if (activeDialog === 'pause-dialog') { closeDialogs(); focusRing(); } else if (!onTitle && !activeDialog && !['win','lose','trained'].includes(bout.state)) openDialog('pause-dialog'); }

  const scenes = {
    title: {
      enter() { onTitle = true; resultShown = false; bout = new C.Bout({Attack:E.Attack,difficulty:settings.difficulty}); clearInput(); syncUI(); },
      update() { game.focus(game.W/2,game.H/2); if (ready && !activeDialog && game.input.pressed('start')) begin(false); },
      draw(r) { drawScene(r); }
    },
    ring: {
      enter(data) { onTitle = false; resultShown = false; lastCue = ''; bout = new C.Bout({Attack:E.Attack,difficulty:settings.difficulty,practice:data.practice}); clearInput(); processEvents(); syncUI(); announce(data.practice ? 'Corner session. Five short lessons.' : 'The bout begins. Rook Voss. Phase one.'); },
      update(dt) {
        game.focus(game.W/2,game.H/2);
        if (activeDialog) {
          if(activeDialog==='pause-dialog' && game.input.pressed('pause')) {closeDialogs();focusRing();}
          else if(['results-dialog','trained-dialog'].includes(activeDialog) && (game.input.pressed('start')||game.input.pressed('bodyRight')))begin(false);
          else if(!['results-dialog','trained-dialog'].includes(activeDialog)&&game.input.pressed('headRight'))closeDialogs();
          return;
        }
        if (game.input.buffered('pause',.13)) { game.input.consume('pause'); togglePause(); return; }
        const inp = game.input;
        if (bout.live) {
          const move = inp.move();
          let stick = Math.abs(inp.padMove[0]) > .55 ? (inp.padMove[0] < 0 ? 'left':'right') : inp.padMove[1] > .55 ? 'duck' : '';
          if (Math.hypot(inp.padMove[0], inp.padMove[1]) < .28) padDirection = '';
          if (stick && stick !== padDirection) { bout.dodge(stick); padDirection = stick; }
          for (const [action, direction] of [['left','left'],['right','right'],['down','duck']]) if (inp.buffered(action,.10) && bout.dodge(direction)) inp.consume(action);
          const high = inp.down('up') || inp.padMove[1] < -.5;
          for (const [action, hand, target, power] of [['power','right',high?'head':'body',true],['headLeft','left','head',false],['headRight','right','head',false],['bodyLeft','left',high?'head':'body',false],['bodyRight','right',high?'head':'body',false]]) {
            if (inp.buffered(action,.12) && bout.punch(hand,target,power)) { inp.consume(action); break; }
          }
        }
        const oldPower = bout.player.power;
        bout.update(dt,{guard:inp.down('guard'),rise:inp.down('rise')});
        if (oldPower < 100 && bout.player.power >= 100) game.audio.sfx('powerReady');
        processEvents(); uiTick += dt; if (uiTick > 1/30) { uiTick = 0; syncUI(); }
      },
      draw(r) { drawScene(r); }
    }
  };
  function drawScene(r) {
    // Low depth puts the art under the engine's own hit particles.
    r.queue(0,0,0,g=>renderer.draw(g,bout,onTitle,settings),{bias:-1000000});
  }
  function processEvents() {
    for (const e of bout.drainEvents()) {
      renderer.event(e,bout);
      if (e.type === 'bell') game.audio.sfx('ringBell');
      else if (e.type === 'swing') game.audio.sfx('whoosh',{vol:e.power?.3:.17,pitch:e.power?.8:1.15});
      else if (e.type === 'hit') {
        game.hitFx(game.W*.5+(e.hand==='left'?-13:13),renderer.targetY(e.target),0,{power:e.power?1.7:e.counter?1.35:.55,sound:false,color:e.counter?'#a5e7d0':'#ecc487'});
        game.audio.sfx(e.power?'breakHit':'leather',{pitch:e.target==='head'?1.1:.9});
        if (e.counter) game.audio.sfx('perfectDodge',{vol:.8});
      } else if (e.type === 'blocked') { game.audio.sfx('guardHit',{vol:.7}); game.freeze(.022); }
      else if (e.type === 'evade') { game.audio.sfx(e.perfect?'perfectDodge':'cleanDodge'); }
      else if (e.type === 'hurt') { game.audio.sfx(e.blocked?'guardHit':'leather',{pitch:.72}); if(!e.blocked) { game.shake(4); game.freeze(.07); } }
      else if (e.type === 'dodgeStart') game.audio.sfx('whoosh',{vol:.11,pitch:.85});
      else if (e.type === 'tell') game.audio.sfx('tellNote',{pitch:e.key==='sweep'?.75:1});
      else if (e.type === 'stagger') { game.audio.sfx('powerReady'); game.audio.sfx('crowd'); }
      else if (e.type === 'knockdown') { clearInput(); game.audio.sfx('breakHit',{pitch:.6}); game.audio.sfx('crowd'); game.shake(6); game.freeze(.1); announce(e.who==='player'?(touchMode?'You are down. Hold the rise button.':'You are down. Hold Space to rise.'):'Rook is down.'); }
      else if (e.type === 'rise') game.audio.sfx('ringBell',{vol:.55});
      else if (e.type === 'lesson') { game.audio.sfx('powerReady',{vol:.5}); if(bout.state==='trained') { game.audio.music(null); openDialog('trained-dialog'); } }
      else if (e.type === 'result' && !resultShown) { resultShown = true; presentResult(e.result); }
      else if (e.type === 'state') syncUI();
    }
  }
  function drawDowns(id, downs) {
    const node = $(id); if(node.dataset.count === String(downs)) return; node.dataset.count = String(downs);
    node.innerHTML = Array.from({length:3},(_,i)=>'<i class="'+(i<downs?'used':'')+'"></i>').join('');
    node.setAttribute('aria-label',downs+' of 3 knockdowns');
  }
  function syncUI() {
    show('title-screen',onTitle); show('hud',!onTitle); show('ring-footer',!onTitle); show('pause-button',!onTitle);
    if ($('touch-controls').hidden !== onTitle) { $('touch-controls').hidden = onTitle; queueResize(); }
    $('touch-controls').style.visibility = bout.state === 'playerDown' ? 'hidden' : '';
    for (const button of $('touch-controls').querySelectorAll('button')) button.disabled = !bout.live;
    document.body.classList.toggle('bout-live', !onTitle && bout.live);
    updateWakeLock();
    const state = bout.state, live = !onTitle && bout.live;
    width('player-health',bout.player.hp); width('opponent-health',bout.opponent.hp / bout.opponent.maxHp*100); width('energy-fill',bout.player.breath); width('stagger-fill',bout.opponent.stagger);
    drawDowns('player-downs',bout.player.downs); drawDowns('opponent-downs',bout.opponent.downs);
    nodeText('clock',bout.practice?'∞':formatTime(bout.remaining)); nodeText('bout-label',bout.practice?'TRAINING':'DOCK NINE'); nodeText('phase-label',bout.practice?'CORNER SESSION':'PHASE '+(bout.phase+1)+' / 3');
    document.querySelector('.clock-block').classList.toggle('low-time',!bout.practice&&bout.remaining<30);
    const powerReady = bout.player.power>=100; width('power-fill',bout.player.power); nodeText('power-label',powerReady?'READY':Math.floor(bout.player.power)+'%');
    nodeText('power-hint',powerReady?(touchMode?'Tap BREAK':'SPACE · Throw a Break punch'):'Clean hits build power'); document.querySelector('.power-area').classList.toggle('power-ready',powerReady);
    document.querySelector('.touch-power').classList.toggle('ready',powerReady); nodeText('touch-power-value',powerReady?'READY':Math.floor(bout.player.power)+'%'); width('touch-power-fill',bout.player.power);
    nodeText('combo-number',bout.player.combo>1?bout.player.combo+'×':''); nodeText('combo-label',bout.player.combo>1?'COMBO':'');
    const cue = bout.cue; show('cue',live&&settings.hints&&!!cue&&!(bout.practice&&bout.lesson<2));
    if(cue) { nodeText('cue-name',cue.title); nodeText('cue-action',cue.text); $('cue').dataset.kind=cue.kind; width('cue-progress',cue.progress*100); if(cue.title!==lastCue) { lastCue=cue.title; if(cue.kind==='wind'&&settings.hints) announce(cue.title+'. '+cue.text); } }
    nodeText('combat-callout',live&&bout.messageTime>0?bout.message:'');
    const intro = !onTitle && ['intro','phaseIntro'].includes(state); show('phase-intro',intro);
    if(intro) {
      const phase = bout.phase; nodeText('intro-eyebrow',state==='intro'?'DOCK NINE · THE NIGHT SHIFT':'KNOCKDOWN '+phase+' · THE FIGHT CHANGES');
      nodeText('intro-title',bout.stateTime>2.1?'HANDS UP.':['READ THE RHYTHM','CHANGE THE TEMPO','THE NIGHT EXPRESS'][phase]);
      nodeText('intro-copy',['Rook leads with a left hook. Dodge right.','He will throw more than one. Wait for the last.','Watch for the false start. Finish what you came for.'][phase]);
    }
    const counting=!onTitle&&['opponentDown','playerDown'].includes(state); show('count-panel',counting);
    if(counting){ const playerDown=state==='playerDown',final=playerDown?bout.player.downs>=3:bout.opponent.downs>=3;
      nodeText('count-heading',final?'TECHNICAL KNOCKOUT':playerDown?'YOU CAN STILL RISE':'ROOK IS DOWN');nodeText('count-number',final?'TKO':bout.count||1);
      nodeText('count-instruction',final?(playerDown?'The referee stops the bout.':'The night belongs to you.'):playerDown?'Hold to get back on your feet.':'Take a breath. This is not over.');
      show('rise-track',playerDown&&!final);show('rise-button',playerDown&&!final);width('rise-fill',bout.rise*100);
    }
    show('lesson-card',live&&bout.practice);
    if(bout.practice&&C.LESSONS[bout.lesson]) {
      const l=C.LESSONS[bout.lesson];
      const touchText=['Tap L BODY or R BODY to land a body punch.','Tap L HEAD or R HEAD to hit above his guard.','When his left glove comes forward, tap RIGHT.','When both gloves rise, tap DUCK.','Your power is full. Tap BREAK to break his guard.'];
      nodeText('lesson-index','CORNER SESSION · '+(bout.lesson+1)+' / 5');nodeText('lesson-title',l.title);nodeText('lesson-text',touchMode?touchText[bout.lesson]:l.text);
    }
    $('stage').classList.toggle('is-playing',!onTitle); $('stage').classList.toggle('is-training',bout.practice&&!onTitle);
  }
  function presentResult(result) {
    game.audio.music(result.won?WIN_SONG:null); game.audio.sfx(result.won?'ringBell':'die',{vol:.6});
    let isRecord=false;
    if(result.won) {
      const old=records[result.difficulty]; isRecord=!old||result.score>old.score;
      records[result.difficulty]={score:Math.max(old?.score||0,result.score),time:Math.min(old?.time||Infinity,result.time),grade:!old||'SABC'.indexOf(result.grade)<'SABC'.indexOf(old.grade)?result.grade:old.grade,wins:(old?.wins||0)+1};
      E.store.set('brassline:records:v1',records);
    }
    nodeText('result-eyebrow',result.won?'DOCK NINE HAS A NEW CHAMPION':'THE NIGHT IS NOT OVER');
    nodeText('result-title',result.won?'The night is yours.':result.method==='TIME'?'The bell got there first.':'Back to the corner.');
    nodeText('result-grade',result.grade); nodeText('result-subtitle',(result.won?'Victory':'Defeat')+' by '+(result.method==='TIME'?'time limit':result.method)+' · '+C.LEVELS[result.difficulty].label+' · '+preciseTime(result.time));
    nodeText('result-score',result.score.toLocaleString()); show('record-badge',isRecord);
    $('result-stats').innerHTML=[['Accuracy',result.accuracy+'%'],['Perfect dodges',result.perfects],['Counters',result.counters],['Best combo',result.bestCombo+'×']].map(([label,value])=>'<div><strong>'+value+'</strong><span>'+label+'</span></div>').join('');
    nodeText('result-note',result.won?(result.grade==='S'?'A precise finish. Try Champion for tighter timing.':'A clean dodge earns power. A timed counter opens his guard. Can you take fewer hits?'):(result.blocked>result.landed?'Too many punches found his guard. Change targets and wait for the whole combination.':'Tap your dodge just before contact. Guard against hooks when you need a safer answer.'));
    openDialog('results-dialog'); announce(result.won?'Victory by technical knockout. Score '+result.score:'Defeat. You can start another bout.');
  }
  function showRecords() {
    const rows=Object.entries(C.LEVELS).map(([key,value])=>{const r=records[key];return '<tr><td>'+value.label+'</td><td>'+(r?Number(r.score).toLocaleString():'—')+'</td><td>'+(r?preciseTime(r.time):'—')+'</td><td>'+(r?r.grade:'—')+'</td></tr>';}).join('');
    $('records-content').innerHTML=Object.keys(records).length?'<table class="records-table"><thead><tr><th>Difficulty</th><th>Best score</th><th>Best time</th><th>Rank</th></tr></thead><tbody>'+rows+'</tbody></table>':'<div class="empty-records">The board is clear.<br>Win your first bout to put your name on it.</div>';
    openDialog('records-dialog');
  }
  function applySettings(setFilter=false) {
    game.reduceMotion=settings.reducedMotion; mixAudio();
    filter.settings={mix:settings.mix/100,levels:settings.levels,edge:settings.edge/100,pixel:settings.pixel,saturation:settings.saturation/100};
    $('touch-layout').value=settings.touch;
    $('difficulty').value=settings.difficulty;$('coach-hints').checked=settings.hints;$('reduce-motion').checked=settings.reducedMotion;$('filter-mode').value=settings.filter;
    for(const [id,key,out,suffix] of [['music-volume','music','music-value','%'],['sfx-volume','sfx','sfx-value','%'],['filter-mix','mix','mix-value','%'],['color-levels','levels','levels-value',''],['edge-strength','edge','edge-value','%'],['pixel-size','pixel','pixel-value',' px'],['saturation','saturation','saturation-value','%']]){ $(id).value=settings[key];nodeText(out,settings[key]+suffix); }
    $('filter-controls').style.opacity=settings.filter==='off'?'.55':'1';
    if(setFilter) void filter.setMode(settings.filter);
    saveSettings(); queueResize(); if(bout)syncUI();
  }
  function isNativeFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function modeMessage(text) {
    clearTimeout(toastTimer); nodeText('mode-toast', text); show('mode-toast', true);
    toastTimer = setTimeout(() => show('mode-toast', false), 3600);
  }
  function setGameMode(value) {
    gameMode = value; document.body.classList.toggle('game-mode', value);
    document.documentElement.classList.toggle('game-mode-page', value);
    clearInput(); queueResize(); updateWakeLock();
  }
  async function enterGameMode(message = true) {
    setGameMode(true);
    const root = document.documentElement;
    if (!isNativeFullscreen()) {
      try {
        if (root.requestFullscreen && document.fullscreenEnabled) await root.requestFullscreen({navigationUI:'hide'});
        else if (root.webkitRequestFullscreen) await root.webkitRequestFullscreen();
      } catch { /* The complete in-page game mode remains available. */ }
    }
    $('stage').dataset.fullscreen = isNativeFullscreen() ? 'native' : 'viewport';
    if (message) modeMessage(isNativeFullscreen() ? 'Full screen is on.' : 'Game mode is on.');
    focusRing(); queueResize();
  }
  async function exitGameMode() {
    if (!onTitle && !activeDialog && !['win','lose','trained'].includes(bout.state)) openDialog('pause-dialog');
    setGameMode(false);
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.webkitFullscreenElement) await document.webkitExitFullscreen();
    } catch {}
    queueResize();
  }
  function fullscreenChanged() {
    const native = isNativeFullscreen();
    if (hadNativeFullscreen && !native) lastNativeExit = performance.now();
    if (hadNativeFullscreen && !native && !onTitle && !activeDialog && !['win','lose','trained'].includes(bout.state)) openDialog('pause-dialog');
    hadNativeFullscreen = native; $('stage').dataset.fullscreen = native ? 'native' : 'viewport'; clearInput(); queueResize();
    $('game-fullscreen').setAttribute('aria-label', native ? 'Full screen is on' : 'Enter full screen');
  }
  async function updateWakeLock() {
    const wanted = gameMode && !onTitle && !activeDialog && !document.hidden && bout && !['win','lose','trained'].includes(bout.state);
    if (!!wanted === wakeWanted) return;
    wakeWanted = !!wanted;
    if (!wanted) { const lock = wakeLock; wakeLock = null; if (lock) try { await lock.release(); } catch {} return; }
    if (!navigator.wakeLock || wakePending) return;
    wakePending = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wakeWanted) await lock.release();
      else { wakeLock = lock; lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; }); }
    } catch {} finally { wakePending = false; }
  }
  function queueResize() { if (!resizeFrame) resizeFrame = requestAnimationFrame(resize); }
  function resize() {
    resizeFrame = 0;
    touchMode = settings.touch === 'on' || (settings.touch === 'auto' && (matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth <= 760));
    document.body.classList.toggle('touch-mode', touchMode);
    $('stage').scrollTop = 0; $('stage').scrollLeft = 0;
    const rect = $('stage').getBoundingClientRect(); if (rect.width < 1 || rect.height < 1) return;
    const portrait = rect.height > rect.width;
    const res = portrait ? [540,Math.round(540*rect.height/rect.width)] : [Math.round(540*rect.width/rect.height),540];
    $('stage').dataset.resolution = res.join('x');
    const key = [rect.width,rect.height,window.devicePixelRatio,res[0],res[1]].join(':');
    if (key !== lastSize) { game.screen.setOptions({res}); lastSize = key; }
    game.focus(game.W/2,game.H/2);
    const deck = $('touch-controls').getBoundingClientRect();
    renderer.viewport = {portrait,touch:touchMode,playTop:portrait?($('stage').querySelector('.game-toolbar').getBoundingClientRect().bottom-rect.top+18)/rect.height*res[1]:0,playBottom:portrait && touchMode && !onTitle ? Math.max(res[1]*.52,(deck.top-rect.top-14)/rect.height*res[1]) : res[1]};
    if (previousOrientation !== null && portrait !== previousOrientation) {
      clearInput();
      if (!onTitle && !activeDialog && !['win','lose','trained'].includes(bout.state)) { openDialog('pause-dialog'); modeMessage('Layout changed. Resume when you are ready.'); }
    }
    previousOrientation = portrait;
    if (bout) syncUI();
  }
  new ResizeObserver(queueResize).observe($('stage'));
  window.addEventListener('resize', queueResize);
  window.visualViewport?.addEventListener('resize', queueResize);
  matchMedia('(any-pointer: coarse)').addEventListener('change', queueResize);
  document.documentElement.classList.add('game-mode-page');
  $('start-button').addEventListener('click',()=>begin(false));$('practice-button').addEventListener('click',()=>begin(true));
  $('home-link').addEventListener('click',e=>{e.preventDefault();if(onTitle)return;if(!activeDialog)togglePause();});
  $('guide-button').addEventListener('click',()=>openDialog('guide-dialog'));$('settings-button').addEventListener('click',()=>{applySettings(false);openDialog('settings-dialog');});$('records-button').addEventListener('click',showRecords);
  $('game-guide').addEventListener('click',()=>openDialog('guide-dialog'));
  $('game-records').addEventListener('click',showRecords);
  for (const id of ['game-settings','pause-settings']) $(id).addEventListener('click',()=>{applySettings(false);openDialog('settings-dialog');});
  $('touch-layout').addEventListener('change',e=>{settings.touch=e.target.value;clearInput();applySettings();});
  $('pause-button').addEventListener('click',togglePause);$('resume-button').addEventListener('click',()=>{closeDialogs();focusRing();});
  for(const id of ['restart-button','rematch-button','trained-start','skip-practice'])$(id).addEventListener('click',()=>begin(false));
  for(const id of ['quit-button','result-title-button','trained-title'])$(id).addEventListener('click',goTitle);
  $('guide-practice').addEventListener('click',()=>begin(true));
  $('difficulty').addEventListener('change',e=>{settings.difficulty=e.target.value;saveSettings();});
  $('coach-hints').addEventListener('change',e=>{settings.hints=e.target.checked;applySettings();});$('reduce-motion').addEventListener('change',e=>{settings.reducedMotion=e.target.checked;applySettings();});
  $('filter-mode').addEventListener('change',e=>{settings.filter=e.target.value;applySettings(true);});
  for(const [id,key] of [['music-volume','music'],['sfx-volume','sfx'],['filter-mix','mix'],['color-levels','levels'],['edge-strength','edge'],['pixel-size','pixel'],['saturation','saturation']])$(id).addEventListener('input',e=>{settings[key]=+e.target.value;applySettings();});
  $('reset-settings').addEventListener('click',()=>{Object.assign(settings,defaults);applySettings(true);});
  for (const id of ['fullscreen-button','game-fullscreen','menu-fullscreen']) $(id).addEventListener('click',()=>void enterGameMode());
  $('exit-game-mode').addEventListener('click',()=>void exitGameMode());
  document.addEventListener('fullscreenchange',fullscreenChanged);
  document.addEventListener('webkitfullscreenchange',fullscreenChanged);
  document.addEventListener('keydown',e=>{if(e.code==='Escape' && performance.now()-lastNativeExit<200){e.preventDefault();e.stopPropagation();return;}if(e.code==='Escape'||e.code==='KeyP'){if(e.repeat){e.preventDefault();e.stopPropagation();return;}if(activeDialog==='pause-dialog'){e.preventDefault();e.stopPropagation();closeDialogs();focusRing();}else if(!activeDialog&&!onTitle){e.preventDefault();e.stopPropagation();togglePause();}}});
  document.addEventListener('visibilitychange',()=>{clearInput();updateWakeLock();if(document.hidden&&!onTitle&&!activeDialog&&!['win','lose','trained'].includes(bout.state))openDialog('pause-dialog');});
  window.addEventListener('blur',()=>{clearInput();if(!onTitle&&!activeDialog&&!['win','lose','trained'].includes(bout.state))openDialog('pause-dialog');});
  touchControls = new BrasslineTouch(document.querySelectorAll('[data-code]'), game.input, () => !activeDialog && !onTitle);
  window.addEventListener('pagehide',()=>{clearInput();wakeWanted=false;if(wakeLock)void wakeLock.release().catch(()=>{});});
  game.start({scene:'title',scenes});resize();applySettings(false);
  renderer.load().then(()=>{ready=true;$('start-button').disabled=false;$('practice-button').disabled=false;nodeText('start-label','Enter the ring');if(settings.filter!=='off')void filter.setMode(settings.filter);}).catch(()=>{show('load-error',true);announce('The ring could not load. Reload the page to try again.');});
  // A read-only status API is useful for QA and agent access. Actions use the visible controls.
  window.Brassline = Object.freeze({version:'1.1.0',snapshot:()=>({ready,onTitle,display:{gameMode,nativeFullscreen:isNativeFullscreen(),touch:touchMode,width:game.W,height:game.H,orientation:game.H>game.W?'portrait':'landscape'},paused:!!activeDialog,scene:game.sceneName,...bout.snapshot(),graphics:filter.snapshot(),engine:{name:'my-3D2dge Agent Edition',version:'0.8.1 + Brassline',fps:game.fps,errors:game.errors.length}}),start:practice=>begin(!!practice)});
  if(document.modelContext?.registerTool){
    const lifecycle=new AbortController();
    const tools=[{name:'get_brassline_bout',title:'Read the boxing bout',description:'Read the current match state and graphics status.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:input=>{if(input&&Object.keys(input).length)throw new Error('No arguments are accepted.');return window.Brassline.snapshot();}},
      {name:'start_brassline_bout',title:'Start a boxing bout',description:'Start a fresh match or the five-lesson corner session. Replaces any active bout.',inputSchema:{type:'object',properties:{practice:{type:'boolean'}},required:['practice'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||typeof input.practice!=='boolean'||Object.keys(input).some(k=>k!=='practice'))throw new Error('practice must be true or false.');if(!ready)throw new Error('The art is still loading.');begin(input.practice);await new Promise(resolve=>setTimeout(resolve,300));return window.Brassline.snapshot();}}];
    for(const tool of tools)try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
    addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
