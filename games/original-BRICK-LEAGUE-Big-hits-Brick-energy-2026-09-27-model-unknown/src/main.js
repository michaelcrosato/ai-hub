import { boot } from 'kit/boot.js';
import { FieldRenderer } from './render.js';
import { ArcadeGame, DEFAULT_OPTIONS, MODES, DERBY_OUTS, DERBY_BONUS_FT } from './game.js';
import { ArcadeAudio } from './audio.js';
import { TEAMS, getPlayer, slugger } from './teams.js';
import { clamp } from './math.js';
import { MenuNav } from './nav.js';

// ---- DOM helpers ---------------------------------------------------------

const cache = new Map();
/** A persistent HUD element (cached). Modal contents are rebuilt, so they use byId. */
const $ = (id) => {
  let el = cache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (!el) throw new Error(`Missing UI element ${id}`);
    cache.set(id, el);
  }
  return el;
};
const byId = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** HUD writes only when the value changes. */
function setText(el, value) {
  const s = String(value);
  if (el._text !== s) {
    el._text = s;
    el.textContent = s;
  }
}
function setHTML(el, html) {
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}
/** Style writes only when the value changes (compared with what was written, since the browser normalises '50.0%' to '50%'). */
function setStyle(el, prop, value) {
  const key = `_style_${prop}`;
  if (el[key] !== value) {
    el[key] = value;
    el.style[prop] = value;
  }
}
const setVisible = (id, value) => $(id).classList.toggle('hidden', !value);

const icons = {
  bolt: `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 2 38 20 20 38 2 20Z" fill="#fff1cd"/><path d="m23 8-13 15h10l-3 10 14-19H21Z" fill="#173b3c"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/><path d="m16 9 6 6m0-6-6 6"/></svg>`,
  pause: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><rect x="7" y="3" width="4" height="6" rx="1" fill="#f5f1e5"/><rect x="14" y="9" width="4" height="6" rx="1" fill="#f5f1e5"/><rect x="8" y="15" width="4" height="6" rx="1" fill="#f5f1e5"/></svg>`,
  sun: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="18" cy="18" r="7"/><path d="M18 1v5m0 24v5M1 18h5m24 0h5M6 6l4 4m16 16 4 4M6 30l4-4M26 10l4-4"/></svg>`,
};

// ---- the page ------------------------------------------------------------

$('app').innerHTML = `
<header class="topbar" id="topbar">
 <div class="nav-left"><button class="brand" id="brand-home" aria-label="Brick League main menu"><span class="brand-symbol">${icons.bolt}</span><span class="brand-word"><span>BRICK</span><span>LEAGUE.</span></span></button><div class="edition">BIG HITS. BRICK ENERGY.<br>THE ARCADE BASEBALL CLUB</div></div>
 <nav class="nav-right" aria-label="Game navigation"><span class="tiny-pill">SEASON 01</span><button class="nav-link roster-link" id="rosters-nav">The teams</button><button class="nav-link" id="controls-nav">How to play</button><button class="icon-button" id="sound-nav" aria-label="Turn sound off">${icons.sound}</button><button class="icon-button" id="settings-nav" aria-label="Game settings">${icons.settings}</button><button class="icon-button hidden" id="pause-nav" aria-label="Pause game">${icons.pause}</button></nav>
</header>
<main class="stage" id="stage" aria-label="Sunset Park baseball game">
 <canvas id="field" aria-label="3D block-built baseball stadium. Use the controls below to play."></canvas><div class="vignette"></div>
 <section class="hero" id="hero"><div class="eyebrow"><span class="status-dot"></span> NOT YOUR AVERAGE BALL GAME.</div><h1>BIG HITS.<br>BRICK<br><span class="orange">ENERGY.</span></h1><p>Little bricks. Major league energy.<br>Step up, swing big, and send it<br>straight into the cheap seats.</p><span class="hero-sticker">100% ARCADE. ZERO SMALL BALL. ↗</span></section>
 <div class="venue" id="venue">${icons.sun}<div><strong>SUNSET PARK</strong><small>BLUE SKIES. BIG FLIES.</small></div></div>
 <div class="field-caption" id="field-caption"><b>WELCOME TO THE BLOCK.</b><br>ONE BALLPARK. TWO RIVALS. NO SMALL HITS.</div>
 <section class="menu-dock" id="menu-dock" aria-label="Start a game"><div class="pick-side"><span class="eyebrow">01 / PICK YOUR SIDE</span><div class="teams">
 <button class="team-button" id="team-away" aria-pressed="false"><span class="team-logo comet-logo">✦</span><span class="team-text"><small>METRO CITY</small><strong>COMETS</strong></span><span class="check">✓</span></button><span class="versus">VS</span>
 <button class="team-button selected" id="team-home" aria-pressed="true"><span class="team-logo slugger-logo">ϟ</span><span class="team-text"><small>SUNSET CITY</small><strong>SLUGGERS</strong></span><span class="check">✓</span></button></div></div>
 <div class="dock-divider"></div><div class="play-area"><div class="mode-info"><span class="eyebrow">02 / YOUR GAME</span><button class="mode-switch" id="menu-mode" aria-label="Change game mode">EXHIBITION</button><small id="menu-rules">9 INNINGS · ROOKIE · VS CPU</small><button class="text-button" id="game-setup">Customize game ↗</button></div><div class="play-buttons"><button class="primary" id="play-ball">PLAY BALL <span class="arrow">↗</span></button><button class="resume hidden" id="resume-game">↻ RESUME YOUR GAME</button></div></div></section>
 <div class="game-info hidden" id="game-info"><span class="eyebrow" id="status-label">YOU’RE ON THE MOUND</span><strong id="status-name">ACE RIVERA</strong><small id="status-detail">SUNSET PARK • 9 INNINGS</small></div>
 <section class="scorebug hidden" id="scorebug" aria-label="Scoreboard"><div class="game-tag" id="game-tag">EXHIBITION • SUNSET PARK</div>
 <div class="score-team" id="score-away-team"><span class="team-logo comet-logo">✦</span><span class="name">MET</span><span class="score" id="away-score">0</span></div>
 <div class="inning-box"><div class="inning-label" id="inning-label">▲ TOP 1</div><div class="count-label" id="count-label">0–0</div></div>
 <div class="score-team" id="score-home-team"><span class="team-logo slugger-logo">ϟ</span><span class="name">SUN</span><span class="score" id="home-score">0</span></div>
 <div class="base-area"><div class="diamond" aria-label="Baserunners"><span class="base first" id="base-1"></span><span class="base second" id="base-2"></span><span class="base third" id="base-3"></span><span class="base home"></span></div><div class="outs"><small>OUTS</small><div class="out-dots"><span class="out-dot" id="out-1"></span><span class="out-dot" id="out-2"></span><span class="out-dot" id="out-3"></span></div></div></div></section>
 <div class="floating-call" id="callout" role="status" aria-live="polite"><div class="call-title" id="call-title"></div><div class="call-subtitle" id="call-subtitle"></div></div>
 <div class="replay-badge hidden" id="replay-badge">● INSTANT REPLAY</div>
 <div class="pitch-ball-label hidden" id="ball-label">BALL</div>
 <section class="game-dock hidden" id="game-dock" aria-label="Game controls">
 <div class="hud-panel batter-panel"><div class="batter-eyebrow"><span id="player-role">ON THE MOUND</span><span id="player-hand">RHP</span></div><div class="player-info"><span class="player-number" id="player-number">1</span><div><div class="player-name" id="player-name">ACE RIVERA</div><div class="player-nick mono" id="player-nick">“THE HEAT”</div></div></div><div class="player-ratings" id="player-ratings"></div></div>
 <div class="hud-panel" id="middle-panel">
 <div id="batting-controls"><div class="timing-header">TIME IT. CRUSH IT.<span id="timing-readout">WAIT FOR THE PITCH</span></div><div class="timing-track"><span class="good-window" id="good-window"></span><span class="perfect-line"></span><span class="timing-marker" id="timing-marker"></span></div><div class="timing-labels"><span>EARLY</span><span>LET IT TRAVEL →</span><span>SWEET SPOT</span></div><div class="timing-tip"><span><span class="key" data-prompt="main">SPACE</span> <span id="swing-tip">Swing at the orange line</span></span><span class="aim-hints"><span class="key" data-prompt="loft">↑↓</span> Loft · <span class="key" data-prompt="spray">←→</span> Aim</span></div></div>
 <div id="pitching-controls" class="hidden"><div class="timing-header">PAINT THE CORNERS.<span class="key pad-hint" data-prompt="cycle"></span><span id="pitch-clock">20s PITCH CLOCK</span></div><div class="pitch-layout"><div class="pitch-zone" id="pitch-zone" role="application" aria-label="Pitch target. Click to aim; arrow keys also work."><span class="aim-cross" id="aim-cross"></span></div><div class="pitch-options"><button class="pitch-option selected" data-pitch="0"><span class="key" data-prompt="n1">1</span> HEAT</button><button class="pitch-option" data-pitch="1"><span class="key" data-prompt="n2">2</span> CURVE</button><button class="pitch-option" data-pitch="2"><span class="key" data-prompt="n3">3</span> CHANGE</button><button class="pitch-option" data-pitch="3"><span class="key" data-prompt="n4">4</span> SLIDER</button></div></div></div>
 <div id="fielding-controls" class="hidden"><div class="timing-header">MAKE THE PLAY.<span id="assist-label">AUTO-FIELD ON</span></div><div class="field-controls"><button class="throw-button selected" data-throw="1"><span class="key" data-prompt="n1">1</span> FIRST</button><button class="throw-button" data-throw="2"><span class="key" data-prompt="n2">2</span> SECOND</button><button class="throw-button" data-throw="3"><span class="key" data-prompt="n3">3</span> THIRD</button><button class="throw-button" data-throw="4"><span class="key" data-prompt="n4">4</span> HOME</button></div><div class="timing-tip"><span><span class="key" data-prompt="aim">WASD</span> Run · <span class="key" data-prompt="switch">TAB</span> Switch</span><span><span class="key" data-prompt="alt">SHIFT</span> Dive <span class="key pad-hint" data-prompt="cycle"></span></span></div></div>
 <div class="sub-controls" id="sub-controls">
  <button class="small-action" id="bunt-button">B · BUNT</button><button class="small-action" id="advance-button">E · STEAL</button><button class="small-action" id="hold-button">Q · HOLD</button>
  <button class="small-action" id="walk-button">I · WALK</button><button class="small-action" id="pickoff-button">K · PICKOFF</button>
  <button class="small-action" id="switch-button">TAB · SWITCH</button><button class="small-action" id="dive-button">SHIFT · DIVE</button>
 </div>
 </div>
 <div class="action-panel"><button class="swing-button" id="main-action"><span id="action-text">PITCH</span><span class="key" data-prompt="main">SPACE</span></button><button class="power-button" id="power-action" aria-label="Activate Brick Breaker when charged"><span class="power-fill" id="power-fill" style="width:40%"></span><span><span class="key" data-prompt="special">X</span> <span id="power-text">BRICK BREAKER · 40%</span></span></button></div>
 </section>
 <div class="footer-line"><span id="footer-help">BUILT DIFFERENT. PLAY LOUD.</span><span id="engine-status">STARTING THE ENGINE</span></div>
</main>
<dialog id="modal" aria-labelledby="modal-title"><div class="modal-head"><div><small id="modal-eyebrow">BRICK LEAGUE CLUBHOUSE</small><h2 id="modal-title">HOW TO PLAY</h2></div><button class="close-button" id="close-modal" aria-label="Close dialog">×</button></div><div class="modal-body" id="modal-body"></div></dialog>
<div id="notification" class="notification hidden" role="alert"></div>
`;

// ---- state ---------------------------------------------------------------

const game = new ArcadeGame();
const audio = new ArcadeAudio();
const dialog = $('modal');
let kit = null;
let view = null;
let nav = null;
let opts = { ...DEFAULT_OPTIONS };
let save = null;
let modalWasPaused = false;
let lastPhase = game.phase;
let activeModal = '';
let modalParent = '';
let rosterSide = 1;
let callTimeout = 0;
let noticeTimeout = 0;
const RECORD_KEY = 'brick-league-records';
const records = { wins: 0, losses: 0, practiceBest: 0, derbyTitles: 0, derbyBest: 0, derbyLongest: 0 };

try {
  const pref = JSON.parse(localStorage.getItem('brick-league-preferences') || 'null');
  if (pref && typeof pref === 'object') opts = { ...opts, ...pref };
  const raw = JSON.parse(localStorage.getItem('brick-league-save') || 'null');
  if (raw?.version === 1) save = raw;
  const rec = JSON.parse(localStorage.getItem(RECORD_KEY) || 'null');
  if (rec && typeof rec === 'object') for (const k of Object.keys(records)) if (Number.isFinite(rec[k]) && rec[k] >= 0) records[k] = Math.floor(rec[k]);
} catch {
  /* Private browsing and corrupt saves do not prevent play. */
}
if (![0, 1].includes(opts.team)) opts.team = 1;
if (![3, 6, 9].includes(opts.innings)) opts.innings = 9;
if (!['rookie', 'pro', 'legend'].includes(opts.difficulty)) opts.difficulty = 'rookie';
if (!MODES.includes(opts.mode)) opts.mode = 'arcade';
for (const k of ['assist', 'sound', 'reducedMotion', 'ghostRunner']) opts[k] = !!opts[k];
audio.enabled = opts.sound;

function storePreferences() {
  try {
    localStorage.setItem('brick-league-preferences', JSON.stringify(opts));
  } catch {
    /* Storage can be disabled. */
  }
}
function storeRecords() {
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(records));
  } catch {
    /* Storage can be disabled. */
  }
}

// ---- prompts follow the last device used ----------------------------------

const PROMPTS = {
  main: ['SPACE', 'A'], alt: ['SHIFT', 'B'], special: ['X', 'RT'], bunt: ['B', 'X'], advance: ['E', 'Y'], hold: ['Q', 'LT'], switch: ['TAB', 'X'],
  walk: ['I', 'VIEW'], pickoff: ['K', 'Y'], replay: ['R', 'R3'], pause: ['ESC', 'START'], aim: ['WASD', 'L-STICK'], loft: ['↑↓', 'L ↕'], spray: ['←→', 'L ↔'],
  n1: ['1', ''], n2: ['2', ''], n3: ['3', ''], n4: ['4', ''], cycle: ['', 'LB/RB'],
};
const source = () => kit?.input.source || 'keyboard';
/** The key or button for an action on the current device ('' on touch: the button is on screen). */
function prompt(name) {
  const src = source();
  if (src === 'touch') return '';
  return PROMPTS[name]?.[src === 'gamepad' ? 1 : 0] ?? '';
}
const withPrompt = (name, text) => (prompt(name) ? `${prompt(name)} · ${text}` : text);
function applyPrompts() {
  document.documentElement.dataset.input = source();
  requestAnimationFrame(() => placePills());
  for (const el of document.querySelectorAll('[data-prompt]')) setText(el, prompt(el.dataset.prompt));
  renderHUD();
  if (dialog.open && activeModal === 'controls') renderControls();
}

// ---- menu ----------------------------------------------------------------

function notice(text) {
  const el = $('notification');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => el.classList.add('hidden'), 3800);
}
function modeName(o) {
  return o.mode === 'practice' ? 'BATTING PRACTICE' : o.mode === 'spectator' ? 'CPU SHOWDOWN' : o.mode === 'derby' ? 'HOME RUN DERBY' : o.innings === 3 ? 'ARCADE BLITZ' : 'EXHIBITION';
}
function selectTeam(side) {
  opts.team = side;
  storePreferences();
  renderMenu();
  audio.play('ui');
}
function cycleMode() {
  opts.mode = MODES[(MODES.indexOf(opts.mode) + 1) % MODES.length];
  storePreferences();
  renderMenu();
  audio.play('ui');
}
function renderMenu() {
  for (const [id, side] of [['team-away', 0], ['team-home', 1]]) {
    $(id).classList.toggle('selected', opts.team === side);
    $(id).setAttribute('aria-pressed', String(opts.team === side));
  }
  setHTML($('menu-mode'), `${modeName(opts)} <span class="swap" aria-hidden="true">⇄</span>`);
  const diff = opts.difficulty.toUpperCase();
  let rules;
  if (opts.mode === 'practice') rules = `ENDLESS SWINGS · ${diff}${records.practiceBest ? ` · BEST ${records.practiceBest} FT` : ''}`;
  else if (opts.mode === 'derby') rules = `3 ROUNDS · ${DERBY_OUTS} OUTS · ${diff}${records.derbyTitles ? ` · ${records.derbyTitles} TITLE${records.derbyTitles === 1 ? '' : 'S'}` : ''}`;
  else if (opts.mode === 'spectator') rules = `${opts.innings} INNINGS · CPU VS CPU`;
  else rules = `${opts.innings} INNINGS · ${diff} · VS CPU${records.wins + records.losses ? ` · ${records.wins}–${records.losses}` : ''}`;
  setText($('menu-rules'), rules);
  setText($('play-ball').firstChild, opts.mode === 'derby' ? 'START DERBY ' : opts.mode === 'practice' ? 'PLAY PRACTICE ' : opts.mode === 'spectator' ? 'PLAY SHOWDOWN ' : 'PLAY BALL ');
  $('resume-game').classList.toggle('hidden', !save || save.rules.finished);
  setHTML($('sound-nav'), audio.enabled ? icons.sound : icons.mute);
  $('sound-nav').setAttribute('aria-label', audio.enabled ? 'Turn sound off' : 'Turn sound on');
}

function startMatch(options) {
  audio.unlock();
  document.activeElement?.blur?.();
  game.particleScale = kit ? kit.tier.detail : 1;
  game.start({ ...options });
  audio.setEnabled(opts.sound);
  lastPhase = game.phase;
  renderHUD();
}
const startGame = () => startMatch(opts);

// ---- the HUD -------------------------------------------------------------

const touchState = new Map();
/** Kit touch buttons: change a label or visibility only when it differs. */
function touchButton(name, label, shown) {
  const t = kit?.touch;
  if (!t) return;
  const prev = touchState.get(name) || {};
  if (label !== undefined && prev.label !== label) t.setLabel(name, label);
  if (shown !== undefined && prev.shown !== shown) t.setShown(name, shown);
  touchState.set(name, { label: label ?? prev.label, shown: shown ?? prev.shown });
}
let touchSuspended = null;
function syncTouch() {
  const t = kit?.touch;
  if (!t) return;
  const playing = game.inPlay && !dialog.open && game.options.mode !== 'spectator';
  if (touchSuspended !== !playing) {
    touchSuspended = !playing;
    t.suspend(!playing, 'game');
  }
  if (!playing) return;
  const heat = Math.floor(game.heat[game.options.team]);
  const live = game.phase === 'live';
  touchButton('main', game.fielding ? 'Dive' : game.batting ? 'Swing' : 'Pitch');
  touchButton('alt', 'Power', game.batting && !live);
  touchButton('special', game.powerArmed ? 'Armed' : heat >= 100 ? 'Heat!' : `Heat ${heat}%`, !live);
  touchButton('switch', undefined, game.fielding);
  touchButton('replay', undefined, game.replay || (!!game.replayStored.length && (game.phase === 'ready' || game.phase === 'result')));
}
function placePills() {
  if (!kit?.touch) return;
  const bug = $('scorebug');
  const top = $('topbar').getBoundingClientRect().bottom;
  const r = bug.classList.contains('hidden') ? null : bug.getBoundingClientRect();
  kit.touch.placeTop('right', Math.round(r && r.right > innerWidth - 170 ? r.bottom + 8 : top + 8));
}

function footerHelp() {
  const pad = source() === 'gamepad';
  if (game.options.mode === 'practice' || game.derbyMode) return pad ? 'A SWING · B POWER SWING · L-STICK LOFT & AIM · RT SPECIAL · R3 REPLAY' : 'SPACE SWING · SHIFT POWER SWING · ↑↓ LOFT · X SPECIAL · R REPLAY';
  return pad ? 'START PAUSE · R3 REPLAY · X SWITCH · VIEW WALK · Y PICKOFF · LB/RB PITCH OR BASE' : 'ESC PAUSE · R REPLAY · TAB SWITCH · I WALK · K PICKOFF';
}

function renderHUD() {
  const reduced = game.phase === 'attract' ? opts.reducedMotion : game.options.reducedMotion;
  document.documentElement.classList.toggle('reduced-motion', reduced);
  const menu = game.phase === 'attract';
  for (const id of ['hero', 'menu-dock', 'field-caption']) setVisible(id, menu);
  for (const id of ['scorebug', 'game-dock', 'game-info', 'pause-nav']) setVisible(id, !menu);
  $('venue').classList.toggle('game-venue', !menu);
  setVisible('replay-badge', game.replay);
  syncTouch();
  if (menu) {
    setText($('footer-help'), 'BUILT DIFFERENT. PLAY LOUD.');
    $('callout').classList.remove('visible');
    lastPhase = game.phase;
    return;
  }
  const s = game.rules.state;
  const scores = game.rules.score;
  const derby = game.derbyMode ? game.derby : null;
  const batting = game.batting;
  const live = game.phase === 'live';
  const fielding = game.fielding;
  const p = batting ? game.rules.batter : game.rules.pitcher;
  const team = game.options.team;
  const heat = game.heat[team];
  const special = TEAMS[team].special;
  const spectator = game.options.mode === 'spectator';

  $('scorebug').classList.toggle('derby', !!derby);
  if (derby) {
    const mine = String(derby.hr);
    const theirs = String(game.derbyTarget);
    setText($('away-score'), team === 0 ? mine : theirs);
    setText($('home-score'), team === 1 ? mine : theirs);
    setText($('inning-label'), s.finished || game.phase === 'finished' ? 'FINAL' : `ROUND ${derby.round + 1}`);
    setText($('count-label'), `${derby.outs}/${derby.outLimit}`);
    $('score-away-team').classList.toggle('active', team === 0);
    $('score-home-team').classList.toggle('active', team === 1);
  } else {
    setText($('away-score'), scores[0]);
    setText($('home-score'), scores[1]);
    setText($('inning-label'), s.finished ? 'FINAL' : `${s.half === 0 ? '▲ TOP' : '▼ BOT'} ${s.inning}`);
    setText($('count-label'), `${s.balls}–${s.strikes}`);
    $('score-away-team').classList.toggle('active', s.half === 0);
    $('score-home-team').classList.toggle('active', s.half === 1);
    for (let i = 0; i < 3; i++) {
      const b = $(`base-${i + 1}`);
      b.classList.toggle('occupied', !!s.bases[i]);
      const label = `${['First', 'Second', 'Third'][i]} base: ${s.bases[i]?.player.name || 'empty'}`;
      if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
      $(`out-${i + 1}`).classList.toggle('on', i < s.outs);
    }
  }
  setText($('game-tag'), derby ? `HOME RUN DERBY • ROUND ${derby.round + 1} OF ${derby.targets.length}` : game.options.mode === 'practice' ? `PRACTICE • ${game.practice.hits} HITS • ${game.practice.hr} HR` : spectator ? 'CPU SHOWDOWN • LIVE' : `${game.options.innings === 3 ? 'ARCADE BLITZ' : 'EXHIBITION'} • ${game.options.innings} INNINGS`);
  setText($('status-label'), game.status);
  setText($('status-name'), batting || !live ? `${game.rules.batter.name.toUpperCase()} AT BAT` : 'GET IT BACK TO THE INFIELD');
  let detail;
  if (derby) detail = `BEAT ${game.derbyTarget} • ${game.derbyRival.name.toUpperCase()}${derby.swingoff ? ' • SWING-OFF' : ''}${derby.longest ? ` • LONGEST ${derby.longest} FT` : ''}`;
  else if (game.options.mode === 'practice') detail = `BEST BOMB: ${game.practice.best} FT${records.practiceBest > game.practice.best ? ` • ALL-TIME ${records.practiceBest} FT` : ''}${game.lastDistance && game.phase === 'result' ? ` • LAST ${game.lastDistance} FT` : ''}`;
  else detail = game.stealArmed ? 'RUNNERS GOING ON THE PITCH' : game.streak[team] >= 3 ? 'ϟ YOUR TEAM IS ON FIRE!' : `${s.bases.filter(Boolean).length} ON BASE • ${TEAMS[team].name}`;
  setText($('status-detail'), detail);
  if (game.options.mode === 'practice' && game.practice.best > records.practiceBest) {
    records.practiceBest = game.practice.best;
    storeRecords();
  }

  setText($('player-role'), batting ? 'AT BAT' : 'ON THE MOUND');
  setText($('player-hand'), batting ? `${p.hand} BAT · ${p.position}` : `${p.hand}HP · ${game.rules.pitcherStats.pitches} PITCHES`);
  setText($('player-number'), p.number);
  setText($('player-name'), p.name);
  setText($('player-nick'), `“${p.nickname}”`);
  setStyle($('player-number'), 'background', TEAMS[batting ? game.rules.offense : game.rules.defense].color);
  setHTML($('player-ratings'), batting ? `CON <b>${p.contact}</b> POW <b>${p.power}</b> SPD <b>${p.speed}</b>` : `ARM <b>${p.arm}</b> FIELD <b>${p.field}</b> ENERGY <b>${Math.round(clamp(100 - game.rules.pitcherStats.pitches * 0.65, 25, 100))}%</b>`);

  setVisible('batting-controls', batting);
  setVisible('pitching-controls', !batting && !live);
  setVisible('fielding-controls', !batting && live);
  // One row of situational buttons: at the plate, on the mound, or in the field.
  const runners = batting && !derby;
  const mound = game.humanPitching && !live;
  setVisible('bunt-button', runners && !live);
  setVisible('advance-button', runners);
  setVisible('hold-button', runners);
  setVisible('walk-button', mound);
  setVisible('pickoff-button', mound);
  setVisible('switch-button', fielding);
  setVisible('dive-button', fielding);
  setVisible('sub-controls', runners || mound || fielding);
  setText($('bunt-button'), withPrompt('bunt', 'BUNT'));
  setText($('advance-button'), withPrompt('advance', live ? 'SEND RUNNERS' : game.stealArmed ? 'STEAL ARMED' : 'STEAL'));
  setStyle($('advance-button'), 'background', game.stealArmed ? '#ffc954' : '');
  setText($('hold-button'), withPrompt('hold', 'HOLD'));
  setText($('walk-button'), withPrompt('walk', 'WALK'));
  setText($('pickoff-button'), withPrompt('pickoff', 'PICKOFF'));
  setText($('switch-button'), withPrompt('switch', 'SWITCH'));
  setText($('dive-button'), withPrompt('alt', 'DIVE'));
  setText($('swing-tip'), derby ? 'Swing at the orange line · aim the gold arc high' : 'Swing at the orange line');

  setText($('assist-label'), game.options.assist ? 'AUTO-FIELD ON' : 'MANUAL FIELDING');
  setText($('action-text'), spectator ? 'WATCHING' : live ? (batting ? 'ADVANCE' : 'DIVE') : batting ? 'SWING' : 'PITCH');
  const idle = spectator || game.phase === 'result' || game.phase === 'finished' || (batting && game.phase === 'ready') || (game.phase === 'pitch' && game.swingAt !== null) || (live && derby !== null);
  if ($('main-action').disabled !== idle) $('main-action').disabled = idle;
  setStyle($('power-fill'), 'width', `${heat}%`);
  setText($('power-text'), game.powerArmed ? `${special} ARMED` : heat >= 100 ? `${special} READY!` : `${special} · ${Math.floor(heat)}%`);
  $('power-action').classList.toggle('ready', heat >= 100);
  $('power-action').classList.toggle('armed', game.powerArmed);
  const pitchText = game.golden ? `GOLDEN BALL · ${game.pitchVelocity} MPH` : `${game.pitchVelocity} MPH · ${game.pitchType}`;
  setText($('timing-readout'), game.phase === 'pitch' ? (game.swingAt !== null ? 'SWING COMMITTED' : pitchText) : live ? 'BALL IN PLAY' : game.phase === 'result' ? game.lastPlay : 'WAIT FOR THE PITCH');
  setText($('pitch-clock'), game.phase === 'pitch' ? pitchText : game.phase === 'ready' ? `${Math.max(0, Math.ceil(20 - game.phaseTime))}s PITCH CLOCK` : '20s PITCH CLOCK');
  // The yellow band is the real contact window for this pitch and level (it was fixed at 77–100%).
  const win = game.swingWindow;
  setStyle($('good-window'), 'left', `${(win.from * 100).toFixed(1)}%`);
  setStyle($('good-window'), 'width', `${((win.to - win.from) * 100).toFixed(1)}%`);
  setStyle($('aim-cross'), 'left', `${(((game.aim.x + 1.85) / 3.7) * 100).toFixed(1)}%`);
  setStyle($('aim-cross'), 'top', `${(((3.8 - game.aim.y) / 3.5) * 100).toFixed(1)}%`);
  for (const b of pitchButtons) b.classList.toggle('selected', ['HEAT', 'CURVE', 'CHANGE', 'SLIDER'][Number(b.dataset.pitch)] === game.pitchType);
  for (const b of throwButtons) b.classList.toggle('selected', Number(b.dataset.throw) === game.throwBase);
  setText($('footer-help'), footerHelp());
  if (game.phase === 'finished' && lastPhase !== 'finished' && !dialog.open) openModal(finalModal());
  lastPhase = game.phase;
}
const pitchButtons = [...document.querySelectorAll('[data-pitch]')];
const throwButtons = [...document.querySelectorAll('[data-throw]')];

function callout(title, subtitle, kind) {
  const el = $('callout');
  $('call-title').textContent = title;
  $('call-subtitle').textContent = subtitle;
  el.className = `floating-call ${kind}`;
  void el.offsetWidth;
  el.classList.add('visible');
  clearTimeout(callTimeout);
  callTimeout = setTimeout(() => el.classList.remove('visible'), kind === 'homer' || kind === 'win' ? 2800 : 1600);
}

// ---- game feel: sounds, crowd, rumble, camera bump ------------------------

game.onChange = renderHUD;
game.onEvent = (event) => callout(event.title, event.subtitle, event.kind);
game.onSound = (name) => {
  audio.play(name);
  const rumble = (s, ms) => kit?.input.rumble(s, ms);
  if (name === 'hit') {
    view?.roar(0.35);
    rumble(0.45, 90);
  } else if (name === 'power') {
    view?.bump(0.6);
    rumble(0.8, 220);
  } else if (name === 'homer') {
    view?.roar(1);
    view?.bump(0.9);
    rumble(1, 450);
  } else if (name === 'win') {
    view?.roar(1);
    rumble(0.7, 500);
  } else if (name === 'out') rumble(0.25, 90);
};
game.onSave = (data) => {
  save = data;
  try {
    localStorage.setItem('brick-league-save', JSON.stringify(data));
  } catch {
    /* Game remains playable without local storage. */
  }
};
game.onFinish = (g) => {
  if (g.derbyMode) {
    const d = g.derby;
    if (d.champion) records.derbyTitles++;
    records.derbyBest = Math.max(records.derbyBest, d.homers);
    records.derbyLongest = Math.max(records.derbyLongest, d.longest);
  } else if (g.options.mode === 'arcade') {
    if (g.rules.state.winner === g.options.team) records.wins++;
    else records.losses++;
  }
  storeRecords();
};

// ---- modals --------------------------------------------------------------

const finalModal = () => (game.derbyMode ? 'derby' : 'final');
function openModal(type, parent = '') {
  if (!dialog.open) {
    modalWasPaused = game.paused;
    game.paused = true;
    dialog.showModal();
  }
  if (kit) kit.input.enabled = false; // the dialog takes the keyboard natively (Tab, Enter, Escape)
  activeModal = type;
  modalParent = parent;
  $('modal-eyebrow').textContent = 'BRICK LEAGUE CLUBHOUSE';
  if (type === 'controls') renderControls();
  else if (type === 'settings') renderSettings();
  else if (type === 'rosters') renderRosters();
  else if (type === 'scorecard') renderScorecard();
  else if (type === 'final') renderFinal();
  else if (type === 'derby') renderDerby();
  else renderPause();
  byId('modal-body').scrollTop = 0;
  if (source() === 'gamepad') nav?.enter([dialog], '#modal-body .primary');
  syncTouch();
}
function closeModal() {
  if (dialog.open) dialog.close();
}
/** Gamepad B: back to the menu that opened this one, or out. */
function modalBack() {
  if (modalParent && !(game.phase === 'finished' && modalParent === 'pause')) openModal(modalParent);
  else closeModal();
}
dialog.addEventListener('close', () => {
  game.paused = modalWasPaused;
  activeModal = '';
  modalParent = '';
  // Closing hands focus back to the button that opened the dialog; in play that button
  // would take the next Space (swing) and open the dialog again.
  if (game.inPlay && document.activeElement?.closest?.('.topbar, .game-dock')) document.activeElement.blur();
  if (kit) {
    kit.input.enabled = true;
    kit.input.settle();
  }
  renderHUD();
});
dialog.addEventListener('click', (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal();
  }
});

function controlsTable() {
  const src = source();
  const rows = [
    ['Swing / pitch', 'main', 'SWING or PITCH, or tap the field'],
    ['Power swing · dive', 'alt', 'POWER · DIVE'],
    ['Aim · loft · run', 'aim', 'Stick (thumb on the left)'],
    ['Bunt', 'bunt', 'BUNT'],
    ['Steal · send runners', 'advance', 'STEAL · SEND RUNNERS'],
    ['Hold runners', 'hold', 'HOLD'],
    ['Pitch type · throw to base', ['1 2 3 4', 'LB / RB'], 'Pitch and base buttons'],
    ['Switch fielder', 'switch', 'SWITCH'],
    ['Intentional walk · pickoff', ['I · K', 'VIEW · Y'], 'WALK · PICKOFF'],
    [`${TEAMS[game.inPlay ? game.options.team : opts.team].special}`, 'special', 'HEAT'],
    ['Instant replay', 'replay', 'REPLAY'],
    ['Pause', 'pause', 'II · pause button'],
  ];
  const chips = (list) => list.split(' · ').map((k) => `<span class="key">${esc(k)}</span>`).join(' ');
  const col = (name) => (name === src ? ' class="active-col"' : '');
  return `<table class="controls-table"><thead><tr><th>ACTION</th><th${col('keyboard')}>KEYBOARD</th><th${col('gamepad')}>GAMEPAD</th><th${col('touch')}>TOUCH</th></tr></thead><tbody>${rows
    .map(([what, action, touch]) => {
      const [k, g] = Array.isArray(action) ? action : [PROMPTS[action][0], PROMPTS[action][1]];
      return `<tr><td>${esc(what)}</td><td${col('keyboard')}>${chips(k)}</td><td${col('gamepad')}>${chips(g)}</td><td${col('touch')}>${esc(touch)}</td></tr>`;
    })
    .join('')}</tbody></table>`;
}
function renderControls() {
  $('modal-title').textContent = 'SMALL BRICKS. BIG PLAYS.';
  $('modal-body').innerHTML = `<p class="modal-intro">Pick your team and play both sides of the ball against the CPU. New here? Choose <b>Batting Practice</b>, then try a three-inning <b>Arcade Blitz</b> or the <b>Home Run Derby</b>. Fielding is assisted by default, but you can take over at any moment. Keyboard, gamepad and touch all work; the highlighted column is what you are using now.</p>
 ${controlsTable()}
 <div class="section-title">AT THE PLATE</div><div class="control-row"><strong>SWING</strong><span>Swing when the timing marker reaches the orange line. Taking pitches matters: four balls earn a walk. A late or early swing can miss or go foul. A power swing hits harder with a smaller contact window; a foul bunt with two strikes is a strikeout.</span></div>
 <div class="control-row"><strong>AIM &amp; LOFT</strong><span>While batting, up/down adjusts launch angle and left/right aims the hit; the gold dotted arc at the plate shows where a perfectly timed swing sends it. Early swings pull the ball, late ones push it. While pitching, aim the pitch (or click the zone). While fielding, move your selected defender (the stick moves him the way it points on screen).</span></div>
 <div class="control-row"><strong>RUNNERS</strong><span>Steal arms a steal before contact, or sends runners for extra bases on a hit. Hold keeps them put. Aggressive baserunning can turn a hit into a tag out.</span></div>
 <div class="section-title">ON THE MOUND &amp; IN THE FIELD</div>
 <div class="control-row"><strong>PITCH &amp; THROW</strong><span>Before pitching: fastball, curve, changeup, slider. After contact: throw to first, second, third, or home. Pitch within 20 seconds. Manage a tired pitcher from The Teams → Bullpen.</span></div>
 <div class="control-row"><strong>${esc(TEAMS[game.inPlay ? game.options.team : opts.team].special)}</strong><span>Hits and outs charge your team’s meter. At 100%, arm it for an explosive hit or a supercharged pitch. Three consecutive hits put your team on fire.</span></div>
 <div class="control-row"><strong>REPLAY · PAUSE</strong><span>Replay the last ball in play from the TV camera, or pause for the scorecard, rosters, settings, and rules. Games autosave after every resolved play.</span></div>
 <div class="section-title">HOME RUN DERBY</div><p class="modal-intro">Three rounds against the rival club’s biggest bats. Each rival posts a number; you get ${DERBY_OUTS} outs to beat it, and every swing that stays in the park is an out (taking a pitch is free). Every fifth pitch is a <b>golden ball</b> that counts double, and a ${DERBY_BONUS_FT}-foot moonshot gives an out back. Tie after your outs? Swing-off: three more outs, next homer wins.</p>
 <div class="section-title">THE HOUSE RULES</div><p class="modal-intro">Three outs per half inning. A nine-player batting order with a universal designated hitter. Choose 3, 6, or 9 innings; tied games continue into extra innings. Home leads after the final top half? Game over. Home takes the lead in the final bottom half? Walk-off. Optional automatic runner on second in extras. Substituted players cannot re-enter.</p>
 <p class="modal-intro">Fair/foul territory, foul catches, force outs, double plays, steals, tag outs, sacrifice flies, home runs and ground-rule doubles are handled automatically. This is an arcade ruleset: umpiring and tag-up decisions are automatic; injuries, weather delays, replay challenges and administrative league penalties are not simulated.</p>
 <div class="modal-footer"><small>F9 opens graphics &amp; display settings.</small><button class="primary" data-modal-action="close">GOT IT. LET’S PLAY ↗</button></div>`;
}
function renderSettings() {
  const active = game.inPlay;
  const current = active ? game.options : opts;
  $('modal-title').textContent = 'MAKE IT YOUR GAME.';
  const select = (id, label, values, chosen, disabled = false) => `<div class="field"><label for="${id}">${label}</label><select id="${id}" ${disabled ? 'disabled' : ''}>${values.map(([v, n]) => `<option value="${v}" ${v === chosen ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  $('modal-body').innerHTML = `<p class="modal-intro">${active ? 'Your match is paused. Audio, fielding assistance, and motion settings can be changed now.' : 'A classic rivalry. Your house rules. Pick the pace and bring the noise.'}</p><div class="settings-grid">
 ${select('setting-mode', 'GAME MODE', [['arcade', 'Exhibition — you vs. CPU'], ['derby', 'Home Run Derby — three rounds, go deep'], ['practice', 'Batting practice — endless swings'], ['spectator', 'CPU showdown — watch a full game']], current.mode, active)}
 ${select('setting-innings', 'GAME LENGTH', [['3', '3 innings — Arcade Blitz'], ['6', '6 innings — Quick Match'], ['9', '9 innings — The Full Nine']], String(current.innings), active)}
 ${select('setting-difficulty', 'DIFFICULTY', [['rookie', 'Rookie — generous timing'], ['pro', 'Pro — faster pitches'], ['legend', 'Legend — bring your A-game']], current.difficulty, active)}
 ${select('setting-team', 'YOUR SIDE', [['0', 'Metro City Comets — away'], ['1', 'Sunset City Sluggers — home']], String(current.team), active)}</div>
 <label class="toggle-row">Assisted fielding <input type="checkbox" id="setting-assist" ${current.assist ? 'checked' : ''}></label>
 <label class="toggle-row">Arcade sound, crowd &amp; menu music <input type="checkbox" id="setting-sound" ${audio.enabled ? 'checked' : ''}></label>
 <label class="toggle-row">Reduced motion (no shake, confetti or bouncing crowd) <input type="checkbox" id="setting-motion" ${current.reducedMotion ? 'checked' : ''}></label>
 <label class="toggle-row">Automatic runner on second in extra innings <input type="checkbox" id="setting-ghost" ${current.ghostRunner ? 'checked' : ''} ${active ? 'disabled' : ''}></label>
 <div class="modal-footer"><button class="text-button" data-modal-action="graphics">Graphics &amp; display (F9) ↗</button><button class="primary" data-modal-action="apply-settings">SAVE SETTINGS ↗</button></div>`;
}
function applySettings() {
  const previous = game.options;
  const active = game.inPlay;
  const get = (id) => byId(id).value;
  const check = (id) => byId(id).checked;
  const next = { team: Number(get('setting-team')), mode: get('setting-mode'), innings: Number(get('setting-innings')), difficulty: get('setting-difficulty'), assist: check('setting-assist'), sound: check('setting-sound'), reducedMotion: check('setting-motion'), ghostRunner: check('setting-ghost') };
  opts = { ...next };
  if (active) game.options = { ...previous, assist: next.assist, sound: next.sound, reducedMotion: next.reducedMotion };
  storePreferences();
  audio.setEnabled(opts.sound);
  renderMenu();
  renderHUD();
  if (modalParent === 'pause') openModal('pause');
  else closeModal();
}
function renderRosters() {
  const side = rosterSide;
  const team = TEAMS[side];
  const state = game.rules.state.teams[side];
  const active = game.phase !== 'attract' && !game.derbyMode;
  const manageable = active && side === game.options.team && game.phase === 'ready' && !game.rules.state.finished && game.options.mode === 'arcade';
  $('modal-title').textContent = `${team.city} ${team.name}`;
  $('modal-eyebrow').textContent = '26 PLAYERS. ONE COMMON GOAL.';
  const tableRow = (p, group) => {
    const available = !state.used.includes(p.id) && !state.lineup.includes(p.id) && state.pitcher !== p.id;
    const action = group === 'LINEUP' ? 'IN LINEUP' : state.pitcher === p.id ? 'ON MOUND' : state.used.includes(p.id) ? 'USED' : manageable && available ? `<button class="sub-button" data-sub="${p.id}">${p.position === 'P' ? 'BRING IN' : 'SUB IN'}</button>` : 'READY';
    return `<tr><td><span class="roster-num">${p.number}</span></td><td><span class="roster-name">${esc(p.name)}</span><span class="roster-nick">${p.nickname}</span></td><td>${p.position}</td><td>${p.power}</td><td>${p.contact}</td><td>${p.speed}</td><td>${action}</td></tr>`;
  };
  const lineup = active ? state.lineup.map((id) => getPlayer(side, id)) : team.roster.slice(0, 9);
  const rest = team.roster.filter((p) => !lineup.some((q) => q.id === p.id));
  $('modal-body').innerHTML = `<div class="tab-bar"><button class="tab ${side === 0 ? 'active' : ''}" data-roster="0">✦ COMETS</button><button class="tab ${side === 1 ? 'active' : ''}" data-roster="1">ϟ SLUGGERS</button></div><p class="modal-intro">${team.motto} Nine in the batting order, five reserve hitters, and a twelve-pitcher staff. Derby slugger: <b>${esc(slugger(side).name)}</b>. ${manageable ? 'Choose a batting-order slot before using SUB IN. Bullpen changes preserve the designated hitter.' : active ? 'Substitutions are available for your team between pitches.' : 'The designated hitter bats in place of the pitcher.'}</p>
 ${manageable ? `<div class="sub-controls-modal"><label for="lineup-slot">REPLACE LINEUP SLOT</label><select id="lineup-slot">${state.lineup.map((id, i) => `<option value="${i}">${i + 1} · ${esc(getPlayer(side, id).name)}</option>`).join('')}</select></div>` : ''}
 <table class="roster-table"><thead><tr><th>#</th><th>PLAYER</th><th>POS</th><th>POW</th><th>CON</th><th>SPD</th><th>STATUS</th></tr></thead><tbody><tr class="roster-group"><td colspan="7">THE STARTING NINE</td></tr>${lineup.map((p) => tableRow(p, 'LINEUP')).join('')}<tr class="roster-group"><td colspan="7">THE BENCH</td></tr>${rest.filter((p) => p.position !== 'P').map((p) => tableRow(p, 'BENCH')).join('')}<tr class="roster-group"><td colspan="7">THE BULLPEN</td></tr>${rest.filter((p) => p.position === 'P').map((p) => tableRow(p, 'PITCHER')).join('')}</tbody></table>`;
}
function scoreTable() {
  const s = game.rules.state;
  const count = Math.max(s.scheduledInnings, s.inning);
  const headings = Array.from({ length: count }, (_, i) => i + 1);
  return `<div class="linescore-wrap"><table class="linescore"><thead><tr><th>TEAM</th>${headings.map((i) => `<th>${i}</th>`).join('')}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${TEAMS.map((t, side) => `<tr><td>${t.short}</td>${headings.map((_, i) => `<td>${s.teams[side].runs[i] ?? '–'}</td>`).join('')}<td class="total">${game.rules.score[side]}</td><td>${s.teams[side].hits}</td><td>${s.teams[side].errors}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderScorecard() {
  $('modal-title').textContent = 'THE BOX SCORE.';
  $('modal-eyebrow').textContent = `SUNSET PARK • ${game.rules.state.finished ? 'FINAL' : `${game.rules.state.half === 0 ? 'TOP' : 'BOTTOM'} OF ${game.rules.state.inning}`}`;
  const batters = TEAMS.flatMap((team, side) => team.roster.map((p) => ({ p, side, stats: game.rules.state.teams[side].stats[p.id] }))).filter((x) => x.stats.ab + x.stats.bb + x.stats.runs > 0);
  $('modal-body').innerHTML = `${scoreTable()}<div class="section-title">AT THE PLATE</div><table class="roster-table"><thead><tr><th>PLAYER</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>HR</th><th>BB</th></tr></thead><tbody>${batters.map(({ p, stats: s }) => `<tr><td class="roster-name">${esc(p.name)}</td><td>${s.ab}</td><td>${s.hits}</td><td>${s.runs}</td><td>${s.rbi}</td><td>${s.hr}</td><td>${s.bb}</td></tr>`).join('') || '<tr><td colspan="7">A fresh scorecard. Make your mark.</td></tr>'}</tbody></table><div class="section-title">PLAY BY PLAY</div><div class="playlog">${[...game.rules.state.playLog].reverse().slice(0, 35).map((log) => `<div>${esc(log)}</div>`).join('')}</div><div class="modal-footer"><small>Stats are tracked for every player.</small><button class="primary" data-modal-action="${modalParent ? 'back' : 'close'}">${modalParent === 'final' ? 'BACK TO THE RESULTS ↗' : 'BACK TO THE GAME ↗'}</button></div>`;
}
function renderFinal() {
  const winner = game.rules.state.winner ?? 1;
  const team = TEAMS[winner];
  const mvp = team.roster.map((p) => ({ p, s: game.rules.state.teams[winner].stats[p.id] })).sort((a, b) => b.s.rbi * 3 + b.s.hr * 4 + b.s.hits + b.s.sb - (a.s.rbi * 3 + a.s.hr * 4 + a.s.hits + a.s.sb))[0];
  const record = game.options.mode === 'arcade' && records.wins + records.losses ? `<p class="final-record">YOUR RECORD AT SUNSET PARK: <b>${records.wins}–${records.losses}</b></p>` : '';
  $('modal-title').textContent = 'THAT’S A BALL GAME.';
  $('modal-eyebrow').textContent = 'ANOTHER ONE FOR THE HIGHLIGHT REEL';
  $('modal-body').innerHTML = `<div class="final-hero"><div class="team-logo ${winner ? 'slugger-logo' : 'comet-logo'}">${team.symbol}</div><h3>${team.name}<br>TAKE THE WIN.</h3><div class="final-score">MET ${game.rules.score[0]} — ${game.rules.score[1]} SUN</div>${record}</div><div class="mvp"><span class="eyebrow">PLAYER OF THE GAME</span><p><b>${esc(mvp.p.name.toUpperCase())}</b> · ${mvp.s.hits} H · ${mvp.s.rbi} RBI · ${mvp.s.hr} HR</p></div><div style="margin-top:22px">${scoreTable()}</div><div class="modal-footer"><button class="text-button" data-modal-action="menu">RETURN TO CLUBHOUSE</button><button class="text-button" data-modal-action="scorecard">BOX SCORE</button><button class="primary" data-modal-action="rematch">RUN IT BACK ↗</button></div>`;
}
function renderDerby() {
  const d = game.derby;
  const side = game.options.team;
  const team = TEAMS[side];
  const hitter = getPlayer(side, d.hitter);
  const rows = d.targets
    .map((target, i) => {
      const rival = getPlayer(1 - side, d.rivals[i]);
      const r = d.results[i];
      return `<tr><td>${i + 1}</td><td><span class="roster-name">${esc(rival.name)}</span><span class="roster-nick">POW ${rival.power}</span></td><td>${target}</td><td>${r ? r.hr : '–'}</td><td>${r ? (r.won ? '<b>WON</b>' : 'LOST') : '–'}</td></tr>`;
    })
    .join('');
  $('modal-title').textContent = d.champion ? 'DERBY CHAMPION.' : 'THAT’S THE DERBY.';
  $('modal-eyebrow').textContent = 'HOME RUN DERBY • SUNSET PARK';
  $('modal-body').innerHTML = `<div class="final-hero"><div class="team-logo ${side ? 'slugger-logo' : 'comet-logo'}">${team.symbol}</div><h3>${esc(hitter.name.toUpperCase())}<br>${d.champion ? 'TAKES THE CROWN.' : `FALLS IN ROUND ${d.round + 1}.`}</h3><div class="final-score">${d.homers} HR · LONGEST ${d.longest} FT · ${d.total.toLocaleString('en-US')} FT TOTAL</div><p class="final-record">DERBY TITLES <b>${records.derbyTitles}</b> · MOST HR <b>${records.derbyBest}</b> · LONGEST EVER <b>${records.derbyLongest} FT</b></p></div><table class="roster-table"><thead><tr><th>RD</th><th>RIVAL</th><th>TARGET</th><th>YOU</th><th>RESULT</th></tr></thead><tbody>${rows}</tbody></table><div class="modal-footer"><button class="text-button" data-modal-action="menu">RETURN TO CLUBHOUSE</button><button class="primary" data-modal-action="rematch">RUN IT BACK ↗</button></div>`;
}
function renderPause() {
  $('modal-title').textContent = 'TAKE A BREATHER.';
  $('modal-eyebrow').textContent = game.options.mode === 'arcade' ? 'TIME OUT • YOUR GAME IS SAVED' : 'TIME OUT';
  $('modal-body').innerHTML = `<div class="pause-menu"><button class="primary" data-modal-action="close">BACK TO THE BALLPARK ↗</button>${game.derbyMode ? '' : '<button data-modal-action="scorecard">THE BOX SCORE</button><button data-modal-action="rosters">LINEUP &amp; BULLPEN</button>'}<button data-modal-action="settings">GAME SETTINGS</button><button data-modal-action="graphics">GRAPHICS &amp; DISPLAY</button><button data-modal-action="controls">CONTROLS &amp; RULES</button><button data-modal-action="menu">${game.options.mode === 'arcade' ? 'SAVE &amp; RETURN TO MENU' : 'RETURN TO MENU'}</button></div>`;
}
/** Pause in play, the results card once the game is over. */
function openPause() {
  if (game.phase === 'finished') openModal(finalModal());
  else if (game.inPlay) openModal('pause');
}

$('modal-body').addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (!button) return;
  audio.play('ui');
  const a = button.dataset.modalAction;
  if (a) {
    if (a === 'close') closeModal();
    else if (a === 'apply-settings') applySettings();
    else if (a === 'graphics') kit?.menu.open();
    else if (a === 'menu') {
      game.save();
      closeModal();
      game.menu();
      renderMenu();
    } else if (a === 'rematch') {
      closeModal();
      startMatch(game.options);
    } else if (a === 'back') modalBack();
    else openModal(a, activeModal === 'pause' || activeModal === 'final' ? activeModal : '');
  }
  if (button.dataset.roster !== undefined) {
    rosterSide = Number(button.dataset.roster);
    renderRosters();
  }
  if (button.dataset.sub) {
    try {
      const p = getPlayer(rosterSide, button.dataset.sub);
      if (p.position === 'P') game.rules.changePitcher(rosterSide, p.id);
      else game.rules.substitute(rosterSide, Number(byId('lineup-slot').value), p.id);
      game.refreshPlayers();
      game.save();
      renderRosters();
      renderHUD();
      notice(`${p.name} is in the game.`);
    } catch (err) {
      notice(err instanceof Error ? err.message : 'Could not make substitution.');
    }
  }
});

// ---- buttons -------------------------------------------------------------

$('close-modal').onclick = closeModal;
$('team-away').onclick = () => selectTeam(0);
$('team-home').onclick = () => selectTeam(1);
$('menu-mode').onclick = cycleMode;
$('play-ball').onclick = startGame;
$('resume-game').onclick = () => {
  if (!save) return;
  try {
    audio.unlock();
    document.activeElement?.blur?.();
    game.particleScale = kit ? kit.tier.detail : 1;
    game.restore(save);
    opts = { ...game.options };
    lastPhase = game.phase;
    renderHUD();
  } catch {
    notice('The saved game could not be restored. Start a new game.');
    save = null;
    renderMenu();
  }
};
$('brand-home').onclick = openPause;
$('settings-nav').onclick = () => openModal('settings');
$('game-setup').onclick = () => openModal('settings');
$('controls-nav').onclick = () => openModal('controls');
$('rosters-nav').onclick = () => {
  rosterSide = game.phase === 'attract' ? opts.team : game.options.team;
  openModal('rosters');
};
$('pause-nav').onclick = openPause;
$('sound-nav').onclick = () => {
  audio.setEnabled(!audio.enabled);
  opts.sound = audio.enabled;
  game.options.sound = audio.enabled;
  storePreferences();
  renderMenu();
  audio.play('ui');
};
$('main-action').onclick = () => {
  audio.unlock();
  if (game.phase === 'live') game.action(game.batting ? 'advance' : 'dive');
  else game.action('main');
};
$('power-action').onclick = () => game.action('power');
$('bunt-button').onclick = () => game.action('bunt');
$('advance-button').onclick = () => game.action('advance');
$('hold-button').onclick = () => game.action('hold');
$('walk-button').onclick = () => game.action('walk');
$('pickoff-button').onclick = () => game.action('pickoff');
$('switch-button').onclick = () => game.action('switch');
$('dive-button').onclick = () => game.action('dive');
for (const b of pitchButtons)
  b.onclick = () => {
    game.selectPitch(Number(b.dataset.pitch));
    audio.play('ui');
  };
for (const b of throwButtons) b.onclick = () => game.action(`throw${b.dataset.throw}`);
$('pitch-zone').addEventListener('pointerdown', (e) => {
  if (game.phase !== 'ready') return;
  const rect = $('pitch-zone').getBoundingClientRect();
  game.aim.x = clamp(((e.clientX - rect.left) / rect.width) * 3.7 - 1.85, -1.85, 1.85);
  game.aim.y = clamp(3.8 - ((e.clientY - rect.top) / rect.height) * 3.5, 0.3, 3.8);
  renderHUD();
});

// Sound can only start from a gesture: the first key, click or tap anywhere unlocks it.
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
addEventListener('blur', () => {
  if (game.inPlay && !dialog.open) openModal('pause');
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.save();
    if (game.inPlay && !dialog.open) openModal('pause');
  }
});
addEventListener('pagehide', () => game.save());

// ---- input: kit actions --------------------------------------------------

const ACTIONS = {
  main: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'], touch: 'Swing' },
  alt: { keys: ['ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['B'], touch: 'Power' },
  special: { keys: ['KeyX'], gamepad: ['RT'], touch: 'Heat' },
  switch: { keys: [], gamepad: ['X'], touch: 'Switch' },
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  bunt: { keys: ['KeyB'], gamepad: ['X'] },
  advance: { keys: ['KeyE'], gamepad: ['Y'] },
  hold: { keys: ['KeyQ'], gamepad: ['LT'] },
  pickoff: { keys: ['KeyK'], gamepad: ['Y'] },
  walk: { keys: ['KeyI'], gamepad: ['Back'] },
  prev: { gamepad: ['LB'] },
  next: { gamepad: ['RB'] },
  n1: { keys: ['Digit1', 'Numpad1'] },
  n2: { keys: ['Digit2', 'Numpad2'] },
  n3: { keys: ['Digit3', 'Numpad3'] },
  n4: { keys: ['Digit4', 'Numpad4'] },
  replay: { keys: ['KeyR'], gamepad: ['RS'], touch: { label: 'Replay', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
};
let tabMapped = false;
/** Tab switches fielders during play; in menus it stays the browser's focus key. */
function mapTab(on) {
  if (on === tabMapped || !kit) return;
  tabMapped = on;
  kit.input.define({ switch: { ...ACTIONS.switch, keys: on ? ['Tab'] : [] } });
}

function handleInput(t) {
  const input = kit.input;
  game.move.x = 0;
  game.move.y = 0;
  mapTab(game.inPlay && !dialog.open);
  if (dialog.open) {
    const r = nav.update([dialog], t, '#modal-body .primary');
    if (r.back) modalBack();
    else if (r.pause && activeModal === 'pause') closeModal();
    return;
  }
  if (game.phase === 'attract') {
    const r = nav.update([$('menu-dock'), $('topbar')], t, '#play-ball');
    if (r.confirm) startGame();
    else if (r.back && document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    return;
  }
  if (input.pressed('pause')) {
    audio.unlock();
    openPause();
    return;
  }
  if (game.phase === 'finished') {
    if (input.pressed('main')) openPause();
    return;
  }
  if (input.pressed('replay')) game.action('replay');
  if (game.options.mode === 'spectator') return;
  const mv = input.vector('move');
  game.move.x = mv.x;
  game.move.y = mv.y;
  if (input.pressed('main')) {
    audio.unlock();
    game.action(game.fielding ? 'dive' : 'main');
  }
  if (input.pressed('alt')) game.action(game.phase === 'live' ? 'dive' : 'powerSwing');
  if (input.pressed('special')) game.action('power');
  if (input.pressed('bunt')) game.action('bunt');
  if (input.pressed('advance')) game.action('advance');
  if (input.pressed('hold')) game.action('hold');
  if (input.pressed('switch')) game.action('switch');
  if (input.pressed('walk')) game.action('walk');
  if (input.pressed('pickoff')) game.action('pickoff');
  for (let n = 1; n <= 4; n++)
    if (input.pressed(`n${n}`)) {
      if (game.phase === 'live') game.action(`throw${n}`);
      else game.selectPitch(n - 1);
    }
  for (const [name, step] of [['prev', -1], ['next', 1]])
    if (input.pressed(name)) {
      if (game.phase === 'live') game.cycleThrow(step);
      else if (game.humanPitching) {
        game.cyclePitch(step);
        audio.play('ui');
      }
    }
  // Click or tap the field to swing, as before.
  if (input.pointer.justDown && game.phase === 'pitch' && game.batting) game.action('main');
}

// ---- per-frame HUD bits ---------------------------------------------------

let markerLeft = '';
let labelShown = false;
function frameHUD() {
  const left = `${(game.pitchProgress * 100).toFixed(1)}%`;
  if (left !== markerLeft) {
    markerLeft = left;
    $('timing-marker').style.left = left;
  }
  const showBall = !!game.ball && game.phase === 'pitch' && !game.replay;
  const label = $('ball-label');
  if (showBall !== labelShown) {
    labelShown = showBall;
    setVisible('ball-label', showBall);
  }
  if (showBall) {
    const p = view.project(game.ball);
    label.style.transform = `translate(${Math.round(p.x + 10)}px, ${Math.round(p.y - 22)}px)`;
    setText(label, game.golden ? 'GOLDEN BALL' : 'BALL');
    label.classList.toggle('golden', game.golden);
  }
}

// ---- start ---------------------------------------------------------------

renderMenu();
renderHUD();

kit = await boot({
  title: 'BRICK LEAGUE',
  canvas: $('field'),
  mount: $('stage'),
  gear: 'none',
  accent: '#fa6938',
  background: '#163a3c',
  touch: { top: 'right', topOffset: 90, theme: 'light' },
  input: ACTIONS,
});
nav = new MenuNav(kit.input);
// A dialog opened while the park was loading keeps the keyboard (Escape, Tab) to itself.
if (dialog.open) kit.input.enabled = false;
view = new FieldRenderer(kit);
game.particleScale = kit.tier.detail;
kit.onQuality((tier) => (game.particleScale = tier.detail));
kit.onResize((w, h) => {
  view.resize(w, h);
  placePills();
});
kit.onPause((paused) => audio.setPaused(paused));
kit.input.onSourceChange(applyPrompts);
applyPrompts();

// Keep the touch buttons above the dock in portrait: the dock's height as a CSS variable.
const dock = $('game-dock');
const measureDock = () => {
  if (dock.classList.contains('hidden')) return;
  document.documentElement.style.setProperty('--dock-h', `${dock.offsetHeight}px`);
  placePills();
};
if (typeof ResizeObserver === 'function') new ResizeObserver(measureDock).observe(dock);
addEventListener('resize', measureDock);

setText($('engine-status'), `${kit.backendLabel.toUpperCase()} · THREE.JS R186 / BALL PHYSICS 120 HZ · ORIGINAL BLOCK-BUILT ASSETS`);
// Exposed for reproducible, state-inspectable browser tests; no network services are used.
Object.assign(window, { __BRICK_LEAGUE__: { game, get graphics() { return view; }, openModal, kit } });

kit.start((dt, t) => {
  handleInput(t);
  game.update(dt);
  audio.update(game.time, game.phase === 'attract');
  audio.crowd(game.inPlay && audio.enabled ? (dialog.open ? 0.02 : 0.05 + view.cheerLevel * 0.5) : 0);
  const reduced = game.phase === 'attract' ? opts.reducedMotion : game.options.reducedMotion;
  view.render(game.frame(), dt, t, { replay: game.replay, attract: game.phase === 'attract', reduced });
  frameHUD();
});
