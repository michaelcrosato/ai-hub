// BRICKYARD BLITZ — the game shell: lobby, playbook, HUD, menus and the match loop.
// Rules (rules.js) and the play simulation (simulation.js) are the original game's;
// this file wires them to the shared kit: kit.renderer, kit.input actions (keyboard,
// gamepad, touch), the kit loop and Rapier 0.20 for the players and the ball.
import { boot } from 'kit/boot.js';
import { DEFAULT_SETTINGS, clamp, emptyInput, other } from './model.js';
import { TEAMS, PLAYS, DEFENSES, depthCharts, lineup } from './data.js';
import { Rules } from './rules.js';
import { Simulation } from './simulation.js';
import { RapierPhysics } from './physics.js';
import { StadiumRenderer } from './render.js';
import { AudioEngine } from './audio.js';
import { MenuNav } from './nav.js';
import { CHALLENGES, applyChallenge, challengeOver, loadProgress, saveResult } from './challenges.js';

const STEP = 1 / 60;
const READY = ['huddle', 'kickoff', 'try'];
/** Modals that must be answered (no close button, Escape / B do nothing). */
const LOCKED_MODALS = ['coin', 'receive', 'final', 'intermission', 'challenge-result'];
const QUARTERS = ['', '1ST QUARTER', '2ND QUARTER', '3RD QUARTER', '4TH QUARTER'];
const PASS_ACTIONS = ['pass1', 'pass2', 'pass3', 'pass4', 'pass5'];
const PASS_PLAYS = PLAYS.filter(p => p.kind === 'pass');
const RUN_PLAYS = PLAYS.filter(p => p.kind === 'run');
const playById = (id) => PLAYS.find(p => p.id === id);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Every control is a kit action; the standard bindings plus the five receivers. */
const ACTIONS = {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    // The first touch button is the big one.
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Hurdle' },
    hit: { keys: ['KeyE', 'KeyJ'], gamepad: ['X'], touch: 'Hit' },
    turbo: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RT'], touch: 'Turbo' },
    switch: { keys: ['KeyQ'], gamepad: ['LB'], touch: 'Switch' },
    lateral: { keys: ['KeyR'], gamepad: ['RS'], touch: 'Pitch' },
    away: { keys: ['KeyX'], gamepad: ['LS'], touch: 'Away' },
    // Receivers 1–5 (touch players tap the badge over the receiver instead).
    pass1: { keys: ['Digit1', 'Numpad1'], gamepad: ['B'] },
    pass2: { keys: ['Digit2', 'Numpad2'], gamepad: ['Y'] },
    pass3: { keys: ['Digit3', 'Numpad3'], gamepad: ['RB'] },
    pass4: { keys: ['Digit4', 'Numpad4'], gamepad: ['LB'] },
    pass5: { keys: ['Digit5', 'Numpad5'], gamepad: ['LT'] },
    timeout: { keys: ['KeyT'], gamepad: ['Back'] },
    // Huddle: onside kick / kick-or-go-for-two toggle.
    option: { keys: ['KeyF'], gamepad: ['Y'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    // The game's own menus.
    ok: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
};

/** Button prompts for the device in use (kit.input.source). */
const PROMPTS = {
    keyboard: { move: 'WASD', turbo: 'SHIFT', snap: 'SPACE', hurdle: 'SPACE', hit: 'E', switch: 'Q', lateral: 'R', away: 'X', timeout: 'T', pause: 'ESC', pass: ['1', '2', '3', '4', '5'], passAll: '1–5', option: 'F', browse: '← → PLAYS · ↑ ↓ TABS', defenses: '← → DEFENSES' },
    gamepad: { move: 'L-STICK', turbo: 'RT', snap: 'A', hurdle: 'A', hit: 'X', switch: 'LB', lateral: 'R3', away: 'L3', timeout: 'VIEW', pause: 'START', pass: ['B', 'Y', 'RB', 'LB', 'LT'], passAll: 'B Y RB LB LT', option: 'Y', browse: '◀ ▶ PLAYS · ▲ ▼ TABS', defenses: '◀ ▶ DEFENSES' },
    touch: { move: 'STICK', turbo: 'TURBO', snap: '', hurdle: 'HURDLE', hit: 'HIT', switch: 'SWITCH', lateral: 'PITCH', away: 'AWAY', timeout: 'PAUSE MENU', pause: 'II', pass: ['1', '2', '3', '4', '5'], passAll: 'TAP A BADGE', option: 'TAP', browse: '', defenses: '' },
};
const HELP = {
    keyboard: {
        play: [['W A S D', 'Move (arrow keys too)'], ['SHIFT', 'Hold to use turbo'], ['SPACE', 'Snap / hurdle'], ['E', 'Stiff-arm / diving tackle'], ['Q', 'Switch defender'], ['R', 'Backward lateral']],
        game: [['1|2|3|4|5', 'Throw to a receiver'], ['X', 'Throw away / fair catch'], ['T', 'Take a timeout'], ['ESC', 'Pause / resume'], ['SPACE', 'Lock kick power / aim'], ['← →|↑ ↓', 'Browse plays / playbook tabs'], ['F', 'Onside kick / kick-or-go-for-two'], ['CLICK', 'Select plays / receivers']],
    },
    gamepad: {
        play: [['L-STICK', 'Move (D-pad too)'], ['RT', 'Hold to use turbo'], ['A', 'Snap / hurdle'], ['X', 'Stiff-arm / diving tackle'], ['LB', 'Switch defender'], ['R3', 'Backward lateral']],
        game: [['B|Y|RB|LB|LT', 'Throw to receivers 1–5'], ['L3', 'Throw away / fair catch'], ['VIEW', 'Take a timeout'], ['START', 'Pause / resume'], ['A', 'Lock kick power / aim'], ['◀ ▶|▲ ▼', 'Browse plays / playbook tabs'], ['Y', 'Onside kick / kick-or-go-for-two'], ['A|B', 'Menus: choose / back']],
    },
    touch: {
        play: [['STICK', 'Drag on the left half to move'], ['TURBO', 'Hold to use turbo'], ['HURDLE', 'Jump a tackler'], ['HIT', 'Stiff-arm / dive'], ['SWITCH', 'Switch defender'], ['PITCH', 'Backward lateral']],
        game: [['1–5', 'Tap a receiver badge to throw'], ['AWAY', 'Throw away / fair catch'], ['II', 'Pause (top right)'], ['SNAP', 'Tap the snap button'], ['CARDS', 'Tap a play to call it'], ['MENU', 'Timeouts from the pause menu']],
    },
};

const $ = (selector) => document.querySelector(selector);
const icons = { sound: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>', mute: '<path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>', settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m10 2-1 3-3 1-3-1-2 4 3 2v3l-2 2 2 4 3-1 3 1 1 2h4l1-3 3-1 2 1 2-4-3-2v-3l2-2-2-4-3 1-3-1-1-3Z"/>', fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>', pause: '<path d="M8 5v14M16 5v14"/>', replay: '<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/>', close: '<path d="m6 6 12 12M18 6 6 18"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3c-1 .5-1 1-1 2m0 3v.1"/>' };
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.help}</svg>`;
function safeLoad(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
    }
    catch {
        return fallback;
    }
}
function store(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* Private browsing / quota: the match still works. */ }
}
function sanitize(s) {
    s.team = s.team === 1 ? 1 : 0;
    s.quarterSeconds = [180, 300, 900].includes(s.quarterSeconds) ? s.quarterSeconds : 180;
    if (!['rookie', 'pro', 'allstar'].includes(s.difficulty))
        s.difficulty = 'pro';
    if (!['broadcast', 'close'].includes(s.camera))
        s.camera = 'broadcast';
    if (!['screen', 'team'].includes(s.controls))
        s.controls = 'screen';
    s.sound = s.sound !== false;
    s.postseason = !!s.postseason;
    s.reducedMotion = !!s.reducedMotion;
    return s;
}

let settings = sanitize({ ...DEFAULT_SETTINGS, ...safeLoad('bb-settings', {}) });
const savedDepth = safeLoad('bb-depth', null);
if (Array.isArray(savedDepth) && savedDepth.length === 2) {
    depthCharts[0] = { ...savedDepth[0] };
    depthCharts[1] = { ...savedDepth[1] };
}

let playing = false, paused = false, modalPage = '', bookTab = 'PASS', bookPage = 0;
let deadAge = 0, readyAge = 0, lastPhase = 'coin', lastSerial = -1, noticeAge = 0, lastBook = '', acc = 0, uiAge = 0;
let coinWinner = 0, rosterTeam = 0, rosterFilter = 'ALL', rosterSlot = 'AUTO', lastRecord = null;
let meterStage = 'idle', meterAge = 0, meterPower = .8, meterValue = .5, onside = false;
let replaying = false, replayTime = 0, replaySpeed = .5, replayPaused = false, replayData = [];
let toastTimer = 0, challenge = null, finalRecorded = false, touchKey = '', promptSource = '';
let worldTop = 76, worldH = 600;

const app = $('#app');
app.innerHTML = `
  <header class="topbar"><button class="brand" data-action="home" aria-label="Brickyard Blitz home"><i class="bolt"></i><span class="wordmark display">BRICKYARD<small>BLITZ</small></span></button>
    <nav class="nav" aria-label="Main navigation"><button class="active" data-action="play">PLAY</button><button data-action="rosters">ROSTERS</button><button data-action="help">HOW TO PLAY</button></nav>
    <div class="bar-right"><span class="tiny-status"><i class="status-dot"></i><span id="renderer-badge">3D</span></span><button class="icon-button" data-action="sound" id="sound-button" aria-label="Toggle sound">${icon(settings.sound ? 'sound' : 'mute')}</button><button class="icon-button" data-action="settings" aria-label="Settings">${icon('settings')}</button><button class="icon-button" data-action="fullscreen" aria-label="Toggle fullscreen">${icon('fullscreen')}</button></div>
  </header>
  <main id="world" aria-label="The Brickyard stadium"><div class="world-vignette"></div></main><div class="world-shade"></div>
  <section class="lobby" id="lobby" aria-label="Choose your team">
    <div class="stadium-tag"><i class="status-dot"></i> THE BRICKYARD <b>LIVE</b></div>
    <div class="hero"><div class="season-tag">11 ON 11. ALL-OUT ARCADE FOOTBALL.</div><h1 class="display">BIG HITS.<br><em>BIGGER<br>ENERGY.</em></h1><p>Light up the field. Break a few ankles.<br>Make every play a highlight.</p>
      <div class="team-label">PICK YOUR SIDE <small>PLAYER 1 VS. CPU</small></div><div class="team-select">${TEAMS.map(t => `<button class="team-card ${settings.team === t.id ? 'active' : ''}" data-action="team" data-id="${t.id}" aria-pressed="${settings.team === t.id}"><span class="team-icon">${t.id === 0 ? 'ϟ' : '❄'}</span><span><small>${t.city}</small><strong class="display">${t.name}</strong></span></button>`).join('')}</div>
      <button class="primary" data-action="start"><span>PLAY · KICK OFF</span><span class="arrow">↗</span></button>
      <div class="hero-foot"><span><kbd>WASD</kbd> + KEYBOARD</span><span>◉ GAMEPAD READY</span><span id="record-line" class="record-line"></span></div>
      <div class="hero-extra"><button class="secondary" data-action="challenges">ϟ CLUTCH CHALLENGES <b id="challenge-count"></b></button><button id="resume-save" class="secondary" data-action="resume-save" hidden>↻ CONTINUE SAVED GAME</button></div>
    </div>
    <div class="stadium-caption"><h3 class="display">WELCOME TO THE YARD.</h3><p>ONE STADIUM. ZERO QUIET MOMENTS.</p></div>
    <div class="lobby-strip"><div class="strip-item"><span class="strip-icon">ϟ</span><span><strong>BUILT FOR BIG PLAYS</strong><small>Turbo runs. Monster hits. Pure arcade.</small></span></div><div class="strip-item"><span class="strip-icon">▦</span><span><strong>53 PLAYERS. EACH SIDE.</strong><small>Your roster. Your game plan.</small></span></div><div class="strip-item"><span class="strip-icon">◷</span><span><strong>GO THE FULL FOUR</strong><small>Quick quarters or the full 15.</small></span></div><span class="strip-right">ORIGINAL TEAMS <span class="slash">/</span> UNOFFICIAL FOOTBALL</span></div>
  </section>
  <section id="game-ui" hidden aria-label="Game interface">
    <div class="game-label">THE BRICKYARD<b id="game-label-mode">ALL-OUT FOOTBALL</b></div><div class="game-tools"><button class="icon-button" data-action="pause" aria-label="Pause game">${icon('pause')}</button><button class="icon-button" data-action="replay" aria-label="Instant replay">${icon('replay')}</button></div>
    <div class="scoreboard" id="scoreboard" aria-label="Scoreboard"><div class="score-top">${scoreTeam(0)}<div class="score-mid"><small id="quarter-label">1ST QUARTER</small><strong class="mono" id="game-clock">03:00</strong></div>${scoreTeam(1)}</div><div class="score-bottom"><strong id="down-text" class="down-text">KICKOFF</strong><span id="field-position">INF 35</span><span class="playclock" id="play-clock">:25</span></div></div>
    <div id="field-tip" class="field-tip"></div><div id="banner" class="banner" hidden aria-live="polite"><h2 class="display"></h2><p></p></div>
    <div id="targets"></div><div id="playbook" class="playbook"></div>
    <div class="player-card" id="player-card"><small id="player-role">YOU CONTROL · QUARTERBACK</small><h3 class="display" id="player-name"></h3><div class="turbo-row">ϟ TURBO<div class="turbo-track"><i id="turbo-fill"></i></div><kbd id="turbo-key">SHIFT</kbd></div></div>
    <div class="minimap"><canvas id="minimap" width="212" height="320" aria-label="Field radar"></canvas></div>
    <div class="live-controls" id="live-controls"></div>
  </section>
  <div id="replay-ui" hidden><div class="replay-badge">● INSTANT REPLAY</div><div class="replay-controls"><button class="secondary" data-action="replay-toggle">Ⅱ / ▶</button><input type="range" id="replay-scrub" min="0" max="1000" value="0" aria-label="Replay position"><button class="secondary" data-action="replay-speed" id="replay-speed">0.5×</button><button class="secondary" data-action="replay-exit">BACK TO GAME</button></div></div>
  <div class="modal-backdrop" id="modal-backdrop" hidden><section id="modal" class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"></section></div>
  <div id="toast" class="toast" hidden role="status"></div>`;
function scoreTeam(id) { const t = TEAMS[id]; return `<div class="score-team ${id ? 'away' : ''}" id="score-team-${id}"><i class="possession"></i><span class="team-symbol display">${id ? '❄' : 'ϟ'}</span><span class="score-name"><small>${t.city}</small><strong class="display">${t.name}</strong><span class="timeouts" id="timeouts-${id}"><i class="on"></i><i class="on"></i><i class="on"></i></span></span><strong id="score-${id}" class="score-number display">0</strong></div>`; }

const el = {
    topbar: $('.topbar'), lobby: $('#lobby'), gameUi: $('#game-ui'), world: $('#world'), vignette: $('.world-vignette'),
    backdrop: $('#modal-backdrop'), modal: $('#modal'), toast: $('#toast'), start: $('[data-action="start"]'),
    score: [$('#score-0'), $('#score-1')], scoreTeam: [$('#score-team-0'), $('#score-team-1')], timeouts: [$('#timeouts-0'), $('#timeouts-1')],
    clock: $('#game-clock'), quarter: $('#quarter-label'), down: $('#down-text'), field: $('#field-position'), playClock: $('#play-clock'),
    playerName: $('#player-name'), playerRole: $('#player-role'), turbo: $('#turbo-fill'), turboKey: $('#turbo-key'),
    tip: $('#field-tip'), banner: $('#banner'), bannerH: $('#banner h2'), bannerP: $('#banner p'), targets: $('#targets'),
    playbook: $('#playbook'), liveControls: $('#live-controls'), radar: $('#minimap'), replayUi: $('#replay-ui'),
    scrub: $('#replay-scrub'), replaySpeed: $('#replay-speed'), resume: $('#resume-save'), record: $('#record-line'),
    challengeCount: $('#challenge-count'), modeLabel: $('#game-label-mode'), badge: $('#renderer-badge'), sound: $('#sound-button'),
};
const radarCtx = el.radar.getContext('2d');

const kit = await boot({
    title: 'BRICKYARD BLITZ',
    physics: true,
    mount: el.world,
    gear: 'none', // the game's Settings screen has a Graphics & display button (F9 works too)
    accent: '#ffdc6b',
    background: '#111e2b',
    // alpha: the sky, sun and vignette are CSS behind the canvas. antialias on every tier: the scene is
    // a few unlit draw calls, and the original's crisp anti-aliased brick edges are part of its look.
    renderer: { alpha: true, antialias: true },
    input: ACTIONS,
});
kit.loading.progress(0.75, 'Building the Brickyard…');

const physics = new RapierPhysics(kit.RAPIER);
let rules = new Rules({ ...settings });
rules.s.ball = 50;
let sim = newSim(rules);
const audio = new AudioEngine();
audio.enabled = settings.sound;
const nav = new MenuNav(kit.input);
const renderer = new StadiumRenderer(kit);
el.badge.textContent = renderer.kind;

const pend = emptyInput();
const stepInput = emptyInput();
const targetPoint = { x: 0, y: 5.2, z: 0 };

function newSim(r) {
    const s = new Simulation(r, physics);
    s.maxParticles = kit.detail(240);
    return s;
}
const P = () => PROMPTS[kit.input.source] || PROMPTS.keyboard;

function setText(node, text) {
    if (node.__text !== text) {
        node.__text = text;
        node.textContent = text;
    }
}
function setHidden(node, hidden) {
    if (node.hidden !== hidden)
        node.hidden = hidden;
}
function clock(n) { const t = Math.max(0, Math.ceil(n)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
function showToast(text) { setText(el.toast, text); el.toast.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.hidden = true, 3300); }
function persistSettings() {
    document.documentElement.classList.toggle('reduced-motion', settings.reducedMotion);
    store('bb-settings', settings);
    audio.enabled = settings.sound;
    el.sound.innerHTML = icon(settings.sound ? 'sound' : 'mute');
    el.sound.setAttribute('aria-label', settings.sound ? 'Mute sound' : 'Enable sound');
}

// ---- modals
function modal(title, kicker, body, wide = false, closable = true) {
    paused = playing;
    kit.input.settle();
    el.backdrop.hidden = false;
    const m = el.modal;
    m.classList.toggle('wide', wide);
    m.innerHTML = `<div class="modal-head"><div><span class="eyebrow">${kicker}</span><h2 class="display" id="modal-title">${title}</h2></div>${closable ? `<button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button>` : ''}</div><div class="modal-body">${body}</div>`;
    m.scrollTop = 0;
    // Focus the main choice (not the close button), so A / Enter does the obvious thing.
    requestAnimationFrame(() => defaultButton()?.focus({ preventScroll: true }));
}
function defaultButton() {
    const m = el.modal;
    return m.querySelector('[data-autofocus]:not(:disabled)') || m.querySelector('.primary:not(:disabled)') || m.querySelector('.modal-body button:not(:disabled)') || m.querySelector('button:not(:disabled)');
}
function closeModal() {
    // A finished challenge has nothing left to play: closing its last menu returns to the lobby.
    if (challenge?.done && playing) {
        leave();
        return;
    }
    el.backdrop.hidden = true;
    modalPage = '';
    paused = false;
    kit.input.settle();
    lastBook = '';
}
function currentTeam() { return TEAMS[settings.team].name; }

function showHelp(tab = kit.input.source in HELP ? kit.input.source : 'keyboard') {
    modalPage = 'help';
    const row = (keys, label) => `<div class="control-row"><span>${label}</span><span class="keys">${keys.split('|').map(k => `<kbd>${k}</kbd>`).join('')}</span></div>`;
    const set = HELP[tab];
    const tabs = [['keyboard', 'KEYBOARD'], ['gamepad', 'GAMEPAD'], ['touch', 'TOUCH']].map(([id, name]) => `<button class="tab ${tab === id ? 'active' : ''}" data-action="help-tab" data-tab="${id}">${name}</button>`).join('');
    modal('MAKE SOME HIGHLIGHTS.', 'THE PLAYBOOK · CONTROLS', `<p class="intro">Pick a play, snap the ball, and take control of the player with the yellow ring. You play offense <em>and</em> defense. The rest of your team has your back.</p><div class="tabs help-tabs">${tabs}</div><div class="help-grid"><div class="help-section"><h3>MOVE & MAKE PLAYS</h3>${set.play.map(([k, l]) => row(k, l)).join('')}</div><div class="help-section"><h3>RUN THE GAME</h3>${set.game.map(([k, l]) => row(k, l)).join('')}</div></div><div class="help-note"><strong>THE BASICS</strong><br>Gain 10 yards in four downs. Touchdown: 6. Field goal: 3. Safety: 2. After a touchdown, kick for 1 or run a play for 2. Change ends each quarter; kick off to the other side after halftime. A tie goes to overtime.<br><br><strong>PASS SMART.</strong> Your quarterback must stay behind the blue line to throw. The yellow badges over your receivers show which button throws to whom. The yellow field line is your first-down target. Up on the stick moves your player up the screen; left and right move across the field, not along the screen diagonal. Prefer the original team-relative steering? Switch it in Settings.<br><br><strong>CLUTCH CHALLENGES.</strong> Four late-game situations from the lobby: win the drive, win the challenge.</div><p style="font-size:10px">Original fictional teams and athletes. Not an NFL-licensed product. Core NFL-style rules with arcade collision, catching, and officiating abstractions.</p><button class="primary" data-action="close-modal" style="width:100%;margin-top:18px">LET’S PLAY <span>↗</span></button>`);
}

function showSettings() {
    modalPage = 'settings';
    modal('TUNE YOUR GAME.', 'SETTINGS', `
  <div class="settings-row"><label for="quarter-setting">Quarter length<small>${playing ? 'Applies to your next game.' : 'Arcade pace or regulation-length quarters.'}</small></label><select id="quarter-setting" data-setting="quarterSeconds"><option value="180" ${settings.quarterSeconds === 180 ? 'selected' : ''}>3 minutes · arcade</option><option value="300" ${settings.quarterSeconds === 300 ? 'selected' : ''}>5 minutes · extended</option><option value="900" ${settings.quarterSeconds === 900 ? 'selected' : ''}>15 minutes · regulation</option></select></div>
  <div class="settings-row"><label for="difficulty-setting">CPU difficulty<small>Reaction time, pressure, and passing decisions.</small></label><select id="difficulty-setting" data-setting="difficulty">${['rookie', 'pro', 'allstar'].map(v => `<option value="${v}" ${settings.difficulty === v ? 'selected' : ''}>${v === 'allstar' ? 'All-star' : v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div>
  <div class="settings-row"><label for="camera-setting">Camera<small>Broadcast framing or a closer look.</small></label><select id="camera-setting" data-setting="camera"><option value="broadcast" ${settings.camera === 'broadcast' ? 'selected' : ''}>Broadcast</option><option value="close" ${settings.camera === 'close' ? 'selected' : ''}>Closer to the action</option></select></div>
  <div class="settings-row"><label for="controls-setting">Stick direction<small>Screen: up is always up the screen. Team: up is toward the end zone your side attacks (the original steering).</small></label><select id="controls-setting" data-setting="controls"><option value="screen" ${settings.controls === 'screen' ? 'selected' : ''}>Screen</option><option value="team" ${settings.controls === 'team' ? 'selected' : ''}>Team</option></select></div>
  <div class="settings-row"><label for="postseason-setting">Postseason overtime<small>No ties. Keep playing until there’s a winner.<br>${playing ? 'Applies to your next game.' : ''}</small></label><input id="postseason-setting" type="checkbox" data-setting="postseason" ${settings.postseason ? 'checked' : ''}></div>
  <div class="settings-row"><label for="sound-setting">Arcade audio<small>Original synthesized hits, whistles, fanfares and crowd.</small></label><input id="sound-setting" type="checkbox" data-setting="sound" ${settings.sound ? 'checked' : ''}></div>
  <div class="settings-row"><label for="motion-setting">Reduced motion<small>Disables camera shake and screen animations.</small></label><input id="motion-setting" type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}></div>
  <div class="settings-row"><label>Graphics & display<small>Quality, resolution, frame rate, touch controls and vibration.</small></label><button class="secondary" data-action="graphics">OPEN</button></div>
  <div class="renderer-info"><strong>RENDERER:</strong> ${renderer.kind} &nbsp; <strong>PHYSICS:</strong> ${physics.kind}<br>three.js r186 · Rapier 0.20 · quality: ${kit.tier.name}</div>
  <button class="primary" data-action="close-modal" style="width:100%;margin-top:20px">BACK TO THE YARD <span>↗</span></button>`);
}

function showPause() {
    if (!playing)
        return;
    if (replaying) {
        stopReplay();
        return;
    }
    modalPage = 'pause';
    const s = rules.s, t = settings.team;
    const canTimeout = s.timeouts[t] > 0 && READY.includes(s.phase);
    const extra = challenge
        ? `<button data-action="challenge-retry">↻ RETRY CHALLENGE<small>${challenge.def.name}</small></button><button data-action="challenges">ϟ ALL CHALLENGES<small>Pick another situation.</small></button>`
        : `<button data-action="rosters">♟ TEAM ROSTERS<small>Manage the depth chart.</small></button><button data-action="challenge">⚑ CHALLENGE THE SPOT<small>${s.challenges[t]} challenges · ${s.timeouts[t]} timeouts</small></button>`;
    modal('TAKE A BREATHER.', 'GAME PAUSED', `<p class="intro">${TEAMS[0].name} ${s.score[0]} — ${s.score[1]} ${TEAMS[1].name} &nbsp; · &nbsp; ${s.quarter > 4 ? 'OT' : 'Q' + s.quarter} ${clock(s.clock)}</p><button class="primary" data-action="close-modal" style="width:100%;margin-bottom:16px">BACK TO THE ACTION <span>▶</span></button><div class="pause-grid"><button data-action="replay" ${sim.lastReplay.length ? '' : 'disabled'}>↻ INSTANT REPLAY<small>Relive the previous play.</small></button><button data-action="stats">▦ BOX SCORE<small>Stats and play-by-play.</small></button><button data-action="timeout" ${canTimeout ? '' : 'disabled'}>◷ TAKE A TIMEOUT<small>${s.timeouts[t]} left · stops the clock before the snap.</small></button><button data-action="help">? HOW TO PLAY<small>Controls for keyboard, gamepad and touch.</small></button>${extra}<button data-action="settings">⚙ SETTINGS<small>Camera, difficulty, audio, graphics.</small></button><button data-action="exit">↗ LEAVE THE FIELD<small>${challenge ? 'Back to the lobby.' : 'Completed plays are autosaved.'}</small></button></div>`);
}

function showCoin() {
    modalPage = 'coin';
    modal('CALL IT IN THE AIR.', 'OPENING COIN TOSS', `<p class="intro">You’re the ${currentTeam()}. Win the toss to choose whether to receive the opening kickoff or kick it away.</p><div class="coin-display"><div class="coin display">ϟ</div><div class="coin display">B</div></div><div class="modal-actions"><button class="primary" data-action="coin" data-side="heads">CHOOSE HEADS <span>ϟ</span></button><button class="secondary" data-action="coin" data-side="tails">CHOOSE TAILS <span>B</span></button></div>`, false, false);
}

function toss(side) {
    const result = Math.random() < .5 ? 'heads' : 'tails';
    coinWinner = result === side ? settings.team : other(settings.team);
    audio.play('click');
    modalPage = 'receive';
    if (coinWinner === settings.team)
        modal(`${result.toUpperCase()}! YOU WIN.`, 'COIN TOSS', `<p class="intro">Start with the ball, or put your defense on the field. The team that doesn’t receive now receives after halftime.</p><div class="option-grid"><button class="option-button display" data-autofocus data-action="receive" data-id="${settings.team}">TAKE THE BALL<small>Receive the opening kickoff. Set the tone.</small></button><button class="option-button display" data-action="receive" data-id="${other(settings.team)}">KICK IT AWAY<small>Send your defense out. Bring the heat.</small></button></div>`, false, false);
    else
        modal(`${result.toUpperCase()}. THEY WIN.`, 'COIN TOSS', `<p>${TEAMS[coinWinner].name} elects to receive. Your kicking unit is up first. Lock your kick’s power, then lock its accuracy.</p><button class="primary" data-action="receive" data-id="${coinWinner}" style="width:100%;margin-top:22px">LET’S KICK IT OFF <span>↗</span></button>`, false, false);
}

function enterGameUI() {
    app.classList.add('ingame');
    el.lobby.hidden = true;
    el.gameUi.hidden = false;
    setText(el.modeLabel, challenge ? challenge.def.name : 'ALL-OUT FOOTBALL');
    audio.setInGame(true);
}

function resetMatchState() {
    playing = true;
    paused = false;
    replaying = false;
    el.replayUi.hidden = true;
    lastPhase = 'coin';
    readyAge = 0;
    deadAge = 0;
    lastBook = '';
    lastSerial = -1;
    finalRecorded = false;
    acc = 0;
    clearPend();
}

function begin(receiver) {
    challenge = null;
    rules = new Rules({ ...settings });
    sim = newSim(rules);
    rules.start(receiver);
    sim.prepare();
    resetMatchState();
    closeModal();
    enterGameUI();
    audio.play('horn');
    onReady();
    saveGame();
}

function onReady() {
    readyAge = 0;
    meterStage = 'idle';
    meterAge = 0;
    onside = false;
    const s = rules.s;
    if (s.phase === 'try') {
        rules.chooseTry('pat');
        sim.play = playById('fieldgoal');
        bookTab = 'SPECIAL';
    }
    else if (s.phase === 'huddle') {
        if (s.possession !== settings.team)
            sim.play = cpuPlay(s);
        else if (['punt', 'fieldgoal', 'kneel', 'spike'].includes(sim.play.kind)) {
            sim.play = PLAYS[0];
            bookTab = 'PASS';
            bookPage = 0;
        }
    }
    sim.prepare();
    lastBook = '';
}

/** The CPU's play call. Late in a game it now goes for it on fourth down when only a touchdown helps. */
function cpuPlay(s) {
    const remaining = 100 - s.ball;
    const deficit = s.score[other(s.possession)] - s.score[s.possession];
    const late = s.quarter >= 4 && s.clock < 60 && deficit > 0;
    if (s.down === 4 && !s.tryMode) {
        if (s.quarter >= 4 && s.clock < 150 && deficit > 3)
            return rules.toGo > 3 || Math.random() < .6 ? pick(PASS_PLAYS) : pick(RUN_PLAYS);
        return remaining <= 38 ? playById('fieldgoal') : late ? playById('verticals') : playById('punt');
    }
    if (s.quarter >= 4 && s.clock < 60 && deficit < 0 && s.clock < 40 * (4 - s.down))
        return playById('kneel');
    return Math.random() < .45 ? pick(RUN_PLAYS) : pick(PASS_PLAYS);
}

function saveGame() {
    if (!playing || challenge || rules.s.phase === 'live' || rules.s.phase === 'final')
        return;
    store('bb-save', { version: 1, settings: rules.settings, state: rules.s, play: sim.play.id, depthCharts });
    el.resume.hidden = false;
}

function resumeSave() {
    const saved = safeLoad('bb-save', null);
    if (!saved || saved.version !== 1 || !saved.state || !Number.isFinite(saved.state.clock) || !['dead', 'huddle', 'kickoff', 'try', 'halftime', 'overtime'].includes(saved.state.phase)) {
        showToast('No resumable game was found.');
        return;
    }
    challenge = null;
    settings = sanitize({ ...DEFAULT_SETTINGS, ...saved.settings });
    persistSettings();
    rules = new Rules({ ...settings });
    rules.s = saved.state;
    depthCharts[0] = { ...saved.depthCharts?.[0] };
    depthCharts[1] = { ...saved.depthCharts?.[1] };
    sim = newSim(rules);
    sim.play = playById(saved.play) || PLAYS[0];
    resetMatchState();
    if (rules.s.phase === 'dead')
        rules.continue();
    onReady();
    closeModal();
    enterGameUI();
    audio.play('horn');
}

function leave() {
    saveGame();
    playing = false;
    paused = false;
    replaying = false;
    challenge = null;
    closeModal();
    app.classList.remove('ingame', 'live');
    el.lobby.hidden = false;
    el.gameUi.hidden = true;
    el.replayUi.hidden = true;
    rules.s.phase = 'coin';
    rules.s.ball = 50;
    rules.s.possession = 0;
    rules.s.quarter = 1;
    sim.play = PLAYS[0];
    sim.prepare();
    lastBook = '';
    audio.setInGame(false);
    refreshLobby();
}

function markTeam() {
    document.querySelectorAll('.team-card').forEach((c, i) => {
        c.classList.toggle('active', i === settings.team);
        c.setAttribute('aria-pressed', String(i === settings.team));
    });
}
function refreshLobby() {
    markTeam();
    el.resume.hidden = !safeLoad('bb-save', null);
    const rec = safeLoad('bb-record', null);
    setText(el.record, rec ? `◆ RECORD ${rec.w}–${rec.l}–${rec.t}` : '');
    const progress = loadProgress();
    setText(el.challengeCount, `${CHALLENGES.filter(c => progress[c.id]?.wins).length}/${CHALLENGES.length}`);
}

// ---- playbook
function routeDiagram(play) {
    const starts = [[-21, 0], [21, 0], [-13, -1.5], [8, -1.5], [-3, -8]];
    const project = (x, z) => `${(90 + x * 2.7).toFixed(1)},${(65 - z * 1.45).toFixed(1)}`;
    let content = '<path d="M9 19h162M9 40h162M9 63h162" stroke="#aec9bf" stroke-opacity=".13"/><path d="M9 65h162" stroke="#7fcdc7" stroke-width="1" stroke-opacity=".5"/>';
    if (play.kind === 'pass')
        for (let i = 0; i < play.routes.length; i++) {
            const [sx, sz] = starts[i];
            const points = [project(sx, sz), ...play.routes[i].map(p => project(clamp(sx + p.x, -27, 27), clamp(sz + p.z, 0, 36)))];
            content += `<polyline points="${points.join(' ')}" fill="none" stroke="${i < 3 ? '#ffdd76' : '#9dc5b7'}" stroke-width="${i === 0 ? 2 : 1.4}" stroke-linejoin="round"/><circle cx="${90 + sx * 2.7}" cy="${65 - sz * 1.45}" r="2.7" fill="#f4e4b4"/>`;
        }
    else if (play.kind === 'run') {
        const lane = play.runLane || 0;
        if (play.fakeLane !== undefined)
            content += `<path d="M82 77 82 64 L${90 + play.fakeLane * 2.4} 57" fill="none" stroke="#9dc5b7" stroke-width="2" stroke-dasharray="4 3"/><path d="M${90 + play.fakeLane * 2.4} 57 Q${90 + lane * 3} 50 ${90 + lane * 3} 25" fill="none" stroke="#ffdd76" stroke-width="3"/>`;
        else
            content += `<path d="M82 77 82 62 Q${90 + lane * 3} 54 ${90 + lane * 3} 25" fill="none" stroke="#ffdd76" stroke-width="3"/>`;
        content += `<path d="m${84 + lane * 3} 33 6-9 6 9" fill="none" stroke="#ffdd76" stroke-width="2"/>`;
    }
    else
        content += `<path d="M90 77Q${play.kind === 'punt' ? 130 : 90} 32 90 17" fill="none" stroke="#ffdd76" stroke-width="2" stroke-dasharray="5 4"/>${play.kind === 'fieldgoal' ? '<path d="M75 7v15h30V7M90 22v9" stroke="#ffe387" stroke-width="2" fill="none"/>' : ''}`;
    for (let x = 73; x <= 109; x += 9)
        content += `<rect x="${x}" y="63" width="5" height="5" rx="1" fill="#dde6cd"/>`;
    return `<svg viewBox="0 0 180 90" aria-hidden="true">${content}</svg>`;
}
function defenseDiagram(id) { return `<svg viewBox="0 0 180 90" aria-hidden="true"><path d="M9 20h162M9 42h162M9 67h162" stroke="#aed4cd" opacity=".15"/>${id === 'zone' ? '<ellipse cx="48" cy="27" rx="32" ry="16" fill="#36dce8" opacity=".13" stroke="#36dce8"/><ellipse cx="130" cy="27" rx="32" ry="16" fill="#36dce8" opacity=".13" stroke="#36dce8"/>' : ''}${[27, 58, 90, 122, 153].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 45 : 34}" r="3" fill="#68d9da"/><path d="M${x} ${i % 2 ? 45 : 34} ${id === 'blitz' ? `L90 76` : `l${i % 2 ? 8 : -5} -17`}" stroke="#ffdd76" stroke-width="1.5" ${id === 'man' ? 'stroke-dasharray="4 3"' : ''}/>`).join('')}${[70, 83, 96, 109].map(x => `<rect x="${x}" y="65" width="5" height="5" fill="#ffdd76"/>`).join('')}</svg>`; }
function isKickChoice() { return rules.s.phase === 'kickoff' || sim.play.kind === 'punt' || sim.play.kind === 'fieldgoal' || rules.s.tryMode === 'pat'; }
/** Playbook tabs: a two-point try has no special-teams page (a field goal there scored two points). */
function bookTabs() { return rules.s.tryMode === 'two' ? ['PASS', 'RUN'] : ['PASS', 'RUN', 'SPECIAL']; }
function bookList() {
    const s = rules.s;
    return PLAYS.filter(p => p.family === bookTab && (!s.tryMode || !['punt', 'spike', 'kneel', 'fieldgoal'].includes(p.kind)));
}

function renderBook() {
    const s = rules.s;
    const ready = READY.includes(s.phase);
    const human = s.possession === settings.team;
    setHidden(el.playbook, !ready || replaying);
    setHidden(el.liveControls, ready || replaying || s.phase === 'dead');
    const key = [s.phase, s.possession, bookTab, bookPage, sim.play.id, sim.defense, s.tryMode, meterStage, onside, replaying, kit.input.source].join('|');
    if (key === lastBook)
        return;
    lastBook = key;
    if (!ready || replaying)
        return;
    if (!bookTabs().includes(bookTab))
        bookTab = 'PASS';
    const p = P();
    const kbd = (k) => (k ? `<kbd>${k}</kbd>` : '');
    const tryTabs = s.phase === 'try' && human ? `<div class="try-tabs"><button class="${s.tryMode === 'pat' ? 'active' : ''}" data-action="try" data-mode="pat">KICK FOR 1</button><button class="${s.tryMode === 'two' ? 'active' : ''}" data-action="try" data-mode="two">GO FOR 2 ${kbd(p.option !== 'TAP' ? p.option : '')}</button></div>` : '';
    let html = tryTabs;
    if (human && isKickChoice()) {
        const kind = s.phase === 'kickoff' ? (onside ? 'ONSIDE KICK' : 'KICKOFF') : s.tryMode === 'pat' ? 'EXTRA POINT' : sim.play.kind === 'punt' ? 'SKY HAMMER' : 'FIELD GOAL';
        html += `<div class="book-heading"><span class="eyebrow"><b>ϟ</b> SPECIAL TEAMS</span><span class="small">TWO LOCKS. ONE BIG KICK.</span></div><div class="kick-content"><div class="kick-meta"><h3 class="display">${kind}</h3><p>${s.phase === 'kickoff' ? 'Land between their 20 and goal line. Max power can be a touchback.' : sim.play.kind === 'punt' ? 'Hang it high. Let your coverage get there.' : `${Math.round(117 - s.ball)} yards to split the posts.`}</p></div><div class="meter-wrap"><div class="meter-label"><span>${meterStage === 'accuracy' ? '02 / ACCURACY' : '01 / POWER'}</span><b>${meterStage === 'idle' ? 'READY' : meterStage === 'power' ? 'LOCK THE POWER' : 'HIT THE CENTER'}</b></div><div class="meter ${meterStage === 'accuracy' ? '' : 'power'}"><i id="meter-needle" class="meter-needle"></i></div><button class="snap-button" data-action="snap" style="width:100%">${meterStage === 'idle' ? 'START YOUR KICK' : meterStage === 'power' ? 'LOCK POWER' : 'KICK IT!'} ${kbd(p.snap)}</button></div></div><div class="book-bottom"><span class="play-description">${s.phase === 'kickoff' ? 'A direct end-zone touchback places the ball at the 35.' : 'Lock more power for longer kicks. Center accuracy clears the uprights.'}</span>${s.phase === 'kickoff' ? `<button class="tab ${onside ? 'active' : ''}" data-action="onside">${onside ? '✓ ' : ''}DECLARE ONSIDE ${kbd(p.option !== 'TAP' ? p.option : '')}</button>` : s.phase !== 'try' ? '<button class="tab" data-action="back-plays">CHANGE PLAY</button>' : ''}</div>`;
    }
    else if (!human) {
        html += `<div class="book-heading"><span class="eyebrow"><b>↓</b> ${s.phase === 'kickoff' ? 'GET READY TO RETURN' : 'CALL YOUR DEFENSE'}</span><span class="small">${p.defenses && s.phase !== 'kickoff' ? p.defenses + ' <b>·</b> ' : ''}CPU WILL SNAP AUTOMATICALLY</span></div><div class="play-cards">${DEFENSES.map(d => `<button class="play-card ${sim.defense === d.id ? 'active' : ''}" data-action="defense" data-id="${d.id}">${defenseDiagram(d.id)}<span class="card-tag">${d.tag}</span><strong class="display">${d.name}</strong>${sim.defense === d.id ? '<i class="selected-mark">✓</i>' : ''}</button>`).join('')}</div><div class="book-bottom"><span class="play-description">${s.phase === 'kickoff' ? `Track the kick, then turn upfield. ${p.away} signals a fair catch.` : DEFENSES.find(d => d.id === sim.defense)?.description}</span><button class="snap-button" data-action="snap">${s.phase === 'kickoff' ? 'BRING IT ON' : 'DEFENSE READY'} ${kbd(p.snap)}</button></div>`;
    }
    else {
        const all = bookList();
        const count = Math.max(1, Math.ceil(all.length / 3));
        bookPage %= count;
        const list = all.slice(bookPage * 3, bookPage * 3 + 3);
        html += `<div class="book-heading"><span class="eyebrow"><b>↑</b> CALL YOUR PLAY</span><span class="small">${p.browse ? p.browse + ' <b>·</b> ' : ''}${rules.downText} <b>·</b> ${TEAMS[s.possession].short} OFFENSE</span></div><div class="tabs">${bookTabs().map(t => `<button class="tab ${bookTab === t ? 'active' : ''}" data-action="tab" data-tab="${t}">${t}</button>`).join('')}<button class="page-button" data-action="page" ${count <= 1 ? 'disabled' : ''}>${bookPage + 1} / ${count} &nbsp; →</button></div><div class="play-cards">${list.map(pl => `<button class="play-card ${sim.play.id === pl.id ? 'active' : ''}" data-action="select-play" data-id="${pl.id}" title="${pl.description}">${routeDiagram(pl)}<span class="card-tag">${pl.tag}</span><strong class="display">${pl.name}</strong>${sim.play.id === pl.id ? '<i class="selected-mark">✓</i>' : ''}</button>`).join('')}</div><div class="book-bottom"><span class="play-description">${sim.play.description}</span><button class="snap-button" data-action="snap">SNAP THE BALL ${kbd(p.snap)}</button></div>`;
    }
    el.playbook.innerHTML = html;
    el.needle = el.playbook.querySelector('#meter-needle');
}

function selectPlay(play) {
    if (!play || rules.s.phase === 'live')
        return;
    sim.selectPlay(play);
    meterStage = 'idle';
    lastBook = '';
    renderBook();
}

function chooseTry(mode) {
    rules.chooseTry(mode);
    sim.play = rules.s.tryMode === 'pat' ? playById('fieldgoal') : PLAYS[0];
    bookTab = 'PASS';
    bookPage = 0;
    meterStage = 'idle';
    sim.prepare();
    lastBook = '';
    renderBook();
}

function toggleOnside() {
    if (meterStage !== 'idle') {
        showToast('The kick has started. Finish the meter first.');
        return;
    }
    onside = !onside;
    lastBook = '';
    renderBook();
}

/** D-pad / stick / arrows in the huddle: ◀ ▶ browse plays (or defenses), ▲ ▼ switch tabs. */
function huddleNav(now) {
    const s = rules.s;
    const dir = nav.direction(now);
    if (!READY.includes(s.phase) || meterStage !== 'idle')
        return;
    const human = s.possession === settings.team;
    if (kit.input.pressed('option') && human) {
        if (s.phase === 'kickoff')
            toggleOnside();
        else if (s.phase === 'try')
            chooseTry(s.tryMode === 'pat' ? 'two' : 'pat');
    }
    if (!dir)
        return;
    if (!human) {
        if (dir === 'left' || dir === 'right') {
            const i = DEFENSES.findIndex(d => d.id === sim.defense);
            sim.defense = DEFENSES[(i + (dir === 'right' ? 1 : -1) + DEFENSES.length) % DEFENSES.length].id;
            audio.play('click');
            lastBook = '';
            renderBook();
        }
        return;
    }
    if (s.phase === 'kickoff' || s.tryMode === 'pat')
        return;
    audio.play('click');
    if (dir === 'up' || dir === 'down') {
        const tabs = bookTabs();
        const i = Math.max(0, tabs.indexOf(bookTab));
        bookTab = tabs[(i + (dir === 'down' ? 1 : -1) + tabs.length) % tabs.length];
        bookPage = 0;
        selectPlay(bookList()[0]);
        return;
    }
    const list = bookList();
    if (!list.length)
        return;
    let i = list.indexOf(sim.play);
    i = i < 0 ? 0 : (i + (dir === 'right' ? 1 : -1) + list.length) % list.length;
    bookPage = Math.floor(i / 3);
    selectPlay(list[i]);
}

function snapAction() {
    if (!playing || paused || replaying || !READY.includes(rules.s.phase))
        return;
    if (rules.s.possession !== settings.team) {
        readyAge = 10;
        return;
    }
    if (isKickChoice()) {
        if (meterStage === 'idle') {
            meterStage = 'power';
            meterAge = 0;
            meterValue = 0;
        }
        else if (meterStage === 'power') {
            meterPower = meterValue;
            meterStage = 'accuracy';
            meterAge = 0;
            audio.play('click');
        }
        else {
            sim.launchKick(meterPower, (meterValue - .5) * 2, onside);
            meterStage = 'idle';
        }
        lastBook = '';
        renderBook();
    }
    else
        sim.snap();
}

// ---- stats, intermission, final, record
function statsBody(includeJournal = true) {
    const [a, b] = rules.s.stats;
    const rows = [['Total yards', Math.round(a.yards), Math.round(b.yards)], ['Passing yards', Math.round(a.passing), Math.round(b.passing)], ['Rushing yards', Math.round(a.rushing), Math.round(b.rushing)], ['Completions / attempts', `${a.completions} / ${a.attempts}`, `${b.completions} / ${b.attempts}`], ['First downs', a.firstDowns, b.firstDowns], ['Turnovers', a.turnovers, b.turnovers], ['Sacks', a.sacks, b.sacks], ['Offensive plays', a.plays, b.plays], ['Time of possession', clock(a.possession), clock(b.possession)], ['Penalties / yards', `${a.penalties} / ${Math.round(a.penaltyYards)}`, `${b.penalties} / ${Math.round(b.penaltyYards)}`]];
    return `<div class="stat-head"><strong class="display" style="color:var(--orange)">INF ${rules.s.score[0]}</strong><small>${rules.s.quarter > 4 ? 'OVERTIME' : 'QUARTER ' + rules.s.quarter} · ${clock(rules.s.clock)}</small><strong class="display" style="color:var(--cyan)">${rules.s.score[1]} ICE</strong></div><table class="stats-grid" aria-label="Game statistics"><tbody>${rows.map(([label, x, y]) => `<tr><td>${x}</td><td>${label}</td><td>${y}</td></tr>`).join('')}</tbody></table>${includeJournal ? `<div class="journal" aria-label="Play by play">${rules.s.journal.slice().reverse().map(j => `<div><b>${j.quarter > 4 ? 'OT' : 'Q' + j.quarter} ${clock(j.clock)}</b><strong>${j.title}</strong> · ${j.detail}</div>`).join('') || '<p>The highlight reel starts at kickoff.</p>'}</div>` : ''}`;
}
function showStats() { modalPage = 'stats'; modal('THE NUMBERS DON’T LIE.', 'BOX SCORE', statsBody()); }
function showIntermission() {
    const half = rules.s.phase === 'halftime';
    modalPage = 'intermission';
    audio.play('horn');
    modal(half ? 'HALFTIME. RELOAD.' : 'OVERTIME. ALL IN.', half ? 'TWO QUARTERS DOWN' : 'WE NEED MORE FOOTBALL', `${statsBody(false)}<p>${half ? 'Switch ends and get back out there. ' + TEAMS[other(rules.s.firstReceiver)].name + ' receives the second-half kickoff.' : rules.settings.postseason ? 'Both teams get a possession. Fifteen-minute overtime periods continue until there is a winner.' : 'Both teams get a possession, subject to the 10-minute overtime clock. A tie at the end of the period remains a tie.'}</p><button class="primary" data-action="next-period" style="width:100%;margin-top:18px">${half ? 'START THE SECOND HALF' : 'START OVERTIME'} <span>↗</span></button>`, false, false);
}
function recordResult(score) {
    const rec = { w: 0, l: 0, t: 0, streak: 0, best: 0, ...safeLoad('bb-record', {}) };
    const mine = score[settings.team], theirs = score[other(settings.team)];
    if (mine > theirs) {
        rec.w++;
        rec.streak = Math.max(0, rec.streak) + 1;
        rec.best = Math.max(rec.best, mine - theirs);
    }
    else if (mine < theirs) {
        rec.l++;
        rec.streak = Math.min(0, rec.streak) - 1;
    }
    else {
        rec.t++;
        rec.streak = 0;
    }
    store('bb-record', rec);
    return rec;
}
function showFinal() {
    modalPage = 'final';
    const score = rules.s.score, tie = score[0] === score[1], win = score[0] > score[1] ? 0 : 1;
    audio.play('score');
    try {
        localStorage.removeItem('bb-save');
    }
    catch { /* optional storage */ }
    if (!finalRecorded) {
        finalRecorded = true;
        store('bb-last-result', { score, stats: rules.s.stats, date: new Date().toISOString() });
        lastRecord = recordResult(score);
    }
    const rec = lastRecord || { w: 0, l: 0, t: 0, streak: 0, best: 0 };
    const streak = rec.streak > 1 ? ` · ${rec.streak} STRAIGHT WINS` : rec.streak < -1 ? ` · ${-rec.streak} STRAIGHT LOSSES` : '';
    const mine = score[settings.team], theirs = score[other(settings.team)];
    modal('THAT’S THE BALLGAME.', 'FINAL WHISTLE', `<div class="final-kicker">MOTOR CITY INFERNO &nbsp; VS &nbsp; NORTH COAST FROSTBITE</div><div class="final-score display"><span>${score[0]}</span> <span style="color:#657e8b;font-size:.6em">—</span> <span>${score[1]}</span></div><h3 class="winner display">${tie ? 'WHAT A BATTLE. A TIE.' : TEAMS[win].name + ' TAKES THE YARD!'}</h3><p class="final-record">${mine > theirs ? 'YOU WIN' : mine < theirs ? 'YOU LOSE' : 'ALL SQUARE'} · YOUR RECORD ${rec.w}–${rec.l}–${rec.t}${streak}${rec.best ? ` · BIGGEST WIN +${rec.best}` : ''}</p>${statsBody(false)}<div class="modal-actions"><button class="primary" data-action="rematch">PLAY AGAIN <span>↻</span></button><button class="secondary" data-action="exit">BACK TO THE YARD</button></div>`, false, false);
}

// ---- Clutch Challenges
function showChallenges() {
    modalPage = 'challenges';
    const progress = loadProgress();
    const cards = CHALLENGES.map((c, i) => {
        const r = progress[c.id];
        const status = r?.wins ? `✓ BEATEN · ${r.wins}/${r.tries}` : r?.tries ? `NOT YET · ${r.tries} ${r.tries === 1 ? 'TRY' : 'TRIES'}` : 'NEW';
        return `<button class="option-button challenge-card ${r?.wins ? 'beaten' : ''}" ${i === 0 ? 'data-autofocus' : ''} data-action="challenge-start" data-id="${c.id}"><span class="challenge-tag">${c.tag} · ${status}</span><span class="display">${c.name}</span><small>${c.brief}<br><b>${c.goal}</b></small></button>`;
    }).join('');
    modal('CRUNCH TIME.', 'CLUTCH CHALLENGES', `<p class="intro">Four late-game moments with the clock, score and spot already set. You’re the ${currentTeam()}. Win the drive and the challenge is yours.</p><div class="option-grid challenge-grid">${cards}</div>`, true);
}

function startChallenge(id) {
    const def = CHALLENGES.find(c => c.id === id);
    if (!def)
        return;
    rules = new Rules({ ...settings });
    sim = newSim(rules);
    applyChallenge(rules, def, settings.team);
    challenge = { def, possession: rules.s.possession, done: false };
    sim.play = PLAYS[0];
    bookTab = 'PASS';
    bookPage = 0;
    resetMatchState();
    closeModal();
    enterGameUI();
    audio.play('horn');
    onReady();
}

function finishChallenge() {
    if (!challenge || challenge.done)
        return;
    challenge.done = true;
    const s = rules.s, mine = s.score[settings.team], theirs = s.score[other(settings.team)];
    const won = mine > theirs;
    const r = saveResult(challenge.def.id, won);
    audio.play(won ? 'score' : 'fail');
    if (won) {
        audio.cheer(1);
        renderer.cheerFor(1);
    }
    kit.input.rumble(won ? .5 : .3, won ? 300 : 160);
    const i = CHALLENGES.indexOf(challenge.def), next = CHALLENGES[(i + 1) % CHALLENGES.length];
    modalPage = 'challenge-result';
    modal(won ? 'CLUTCH!' : 'NOT THIS TIME.', `CLUTCH CHALLENGE · ${challenge.def.name}`, `<div class="final-score display"><span>${s.score[0]}</span> <span style="color:#657e8b;font-size:.6em">—</span> <span>${s.score[1]}</span></div><h3 class="winner display">${won ? 'CHALLENGE COMPLETE' : 'CHALLENGE FAILED'}</h3><p class="final-record">${challenge.def.goal} · ${r.wins} OF ${r.tries} WON</p><div class="modal-actions"><button class="${won ? 'secondary' : 'primary'}" data-action="challenge-retry">TRY AGAIN <span>↻</span></button><button class="${won ? 'primary' : 'secondary'}" data-action="challenge-start" data-id="${next.id}">PLAY NEXT: ${next.name}</button></div><div class="modal-actions"><button class="secondary" data-action="challenges">ALL CHALLENGES</button><button class="secondary" data-action="exit">BACK TO THE YARD</button></div>`, false, false);
}

// ---- rosters
const slotPositions = { QB: 'QB', RB: 'RB', WR1: 'WR', WR2: 'WR', WR3: 'WR', TE: 'TE', LT: 'OT', LG: 'OG', C: 'C', RG: 'OG', RT: 'OT', LE: 'DE', DT1: 'DT', DT2: 'DT', RE: 'DE', LB1: 'LB', MLB: 'LB', LB2: 'LB', CB1: 'CB', CB2: 'CB', FS: 'S', SS: 'S', K: 'K', P: 'P', LS: 'LS', FB: 'FB' };
function showRosters() {
    modalPage = 'rosters';
    const team = TEAMS[rosterTeam];
    const starters = [...lineup(rosterTeam, true), ...lineup(rosterTeam, false)];
    const roster = team.roster.filter(p => rosterFilter === 'ALL' || p.position === rosterFilter);
    const available = Object.keys(slotPositions);
    const positions = [...new Set(team.roster.map(p => p.position))];
    modal('MEET YOUR PLAYMAKERS.', 'TWO TEAMS · 106 ORIGINAL ATHLETES', `<div class="roster-toolbar">${TEAMS.map(t => `<button class="tab ${rosterTeam === t.id ? 'active' : ''}" data-action="roster-team" data-id="${t.id}">${t.name}</button>`).join('')}<select aria-label="Filter roster by position" id="roster-filter"><option value="ALL">All positions</option>${positions.map(p => `<option value="${p}" ${rosterFilter === p ? 'selected' : ''}>${p}</option>`).join('')}</select><select aria-label="Depth chart slot" id="roster-slot"><option value="AUTO">Auto depth slot</option>${available.map(p => `<option value="${p}" ${rosterSlot === p ? 'selected' : ''}>Set ${p}</option>`).join('')}</select></div><div class="roster-count"><strong style="color:${team.color}">${team.city} ${team.name}</strong> · 53 players · ${team.slogan}<br><span style="font-size:10px;color:#8fa6af;line-height:2">Promote a player to update the depth chart. Changes take effect on the next formation. FB / LS are reserve specialist depth slots.</span></div><table class="roster-table"><thead><tr><th>#</th><th>PLAYER</th><th>POS</th><th>SPD</th><th class="power-col">PWR</th><th class="skill-col">SKL</th><th>OVR</th><th>DEPTH CHART</th></tr></thead><tbody>${roster.map(p => { const active = starters.find(a => a.player.id === p.id); const specialist = ['K', 'P', 'LS', 'FB'].includes(p.position) && (depthCharts[rosterTeam][p.position] ?? team.roster.find(a => a.position === p.position)?.id) === p.id; return `<tr><td class="number">${p.number}</td><td><strong>${p.name}</strong></td><td>${p.position}</td><td>${p.speed}</td><td class="power-col">${p.power}</td><td class="skill-col">${p.skill}</td><td class="rating">${p.overall}</td><td>${active || specialist ? `<span class="starter">${active?.role || p.position} · 1ST</span>` : `<button data-action="promote" data-id="${p.id}">PROMOTE ↑</button>`}</td></tr>`; }).join('')}</tbody></table>`, true);
}
function promote(id) {
    const team = TEAMS[rosterTeam], player = team.roster.find(p => p.id === id);
    if (!player)
        return;
    const slot = rosterSlot === 'AUTO' ? Object.keys(slotPositions).find(k => slotPositions[k] === player.position) : rosterSlot;
    if (!slot || slotPositions[slot] !== player.position) {
        showToast('Choose a depth slot matching this player’s position.');
        return;
    }
    const starting = [...lineup(rosterTeam, true), ...lineup(rosterTeam, false)], previous = starting.find(p => p.role === slot), already = starting.find(p => p.player.id === id);
    if (already && previous)
        depthCharts[rosterTeam][already.role] = previous.player.id;
    depthCharts[rosterTeam][slot] = id;
    store('bb-depth', depthCharts);
    showRosters();
    showToast(`${player.name} promoted to ${slot}.`);
    if (playing && READY.includes(rules.s.phase))
        sim.prepare();
}

// ---- instant replay
function startReplay() {
    if (!sim.lastReplay.length) {
        showToast('Finish a play to unlock instant replay.');
        return;
    }
    closeModal();
    replaying = true;
    replayTime = 0;
    replayPaused = false;
    replaySpeed = .5;
    replayData = sim.lastReplay;
    el.replayUi.hidden = false;
    el.playbook.hidden = true;
    el.banner.hidden = true;
    el.targets.innerHTML = '';
    el.targets.__key = '';
    el.liveControls.hidden = true;
    el.replaySpeed.textContent = '0.5×';
    lastBook = '';
}
function stopReplay() { replaying = false; el.replayUi.hidden = true; lastBook = ''; kit.input.settle(); }
function cycleReplaySpeed() {
    replaySpeed = replaySpeed === .5 ? 1 : replaySpeed === 1 ? .25 : .5;
    el.replaySpeed.textContent = replaySpeed + '×';
}
function replayNav(now) {
    const I = kit.input;
    if (I.pressed('back')) {
        stopReplay();
        return;
    }
    if (I.pressed('ok') || I.pressed('jump'))
        replayPaused = !replayPaused;
    const dir = nav.direction(now);
    if (dir === 'left' || dir === 'right') {
        replayPaused = true;
        replayTime = Math.max(0, replayTime + (dir === 'right' ? .2 : -.2));
    }
    else if (dir === 'up' || dir === 'down')
        cycleReplaySpeed();
}

// ---- HUD
function tipText(s, a) {
    const p = P();
    if (s.phase !== 'live')
        return 'BLUE = LINE OF SCRIMMAGE  /  YELLOW = FIRST DOWN';
    if (sim.ball.mode === 'kick')
        return `${p.away} · FAIR CATCH  /  TRACK THE BALL`;
    if (a.hasBall)
        return sim.passed || sim.play.kind === 'run' || a.team !== sim.startTeam
            ? `${p.move} · RUN   ${p.turbo} · TURBO   ${p.hit} · STIFF-ARM`
            : `${p.passAll} · PASS   ${p.away} · THROW AWAY   ${p.turbo} · SCRAMBLE`;
    return `${p.switch} · SWITCH DEFENDER   ${p.hit} · DIVING TACKLE`;
}

/** Prompts that follow the device in use. */
function refreshPrompts() {
    promptSource = kit.input.source;
    const p = P();
    const k = (s) => `<kbd>${s}</kbd>`;
    el.liveControls.innerHTML = promptSource === 'gamepad'
        ? `<span>${k('L')} MOVE</span><span>${k('B Y RB LB LT')} PASS</span><span>${k('X')} BIG HIT</span><span>${k('A')} HURDLE</span><span>${k('LB')} SWITCH</span><span>${k('RT')} TURBO</span>`
        : `<span>${k('WASD')} MOVE</span><span>${k('1')}–${k('5')} PASS</span><span>${k('E')} BIG HIT</span><span>${k('SPACE')} HURDLE</span><span>${k('Q')} SWITCH</span>`;
    setText(el.turboKey, p.turbo);
    el.targets.__key = '';
    lastBook = '';
    el.tip.__text = undefined;
}

function updateHud(dt) {
    if (!playing)
        return;
    const s = rules.s;
    for (const t of TEAMS) {
        setText(el.score[t.id], String(s.score[t.id]));
        el.scoreTeam[t.id].classList.toggle('has-possession', s.possession === t.id);
        const to = el.timeouts[t.id];
        if (to.__n !== s.timeouts[t.id]) {
            to.__n = s.timeouts[t.id];
            to.innerHTML = [0, 1, 2].map(i => `<i class="${i < s.timeouts[t.id] ? 'on' : ''}"></i>`).join('');
        }
    }
    setText(el.clock, clock(s.clock));
    setText(el.quarter, s.quarter > 4 ? 'OVERTIME ' + Math.max(1, s.overtimePeriod) : QUARTERS[s.quarter] || '');
    setText(el.down, s.phase === 'kickoff' ? 'KICKOFF' : s.tryMode ? s.tryMode === 'pat' ? 'EXTRA POINT' : 'TWO-POINT TRY' : rules.downText);
    setText(el.field, s.ball <= 50 ? `${TEAMS[s.possession].short} ${Math.round(s.ball)}` : `${TEAMS[other(s.possession)].short} ${Math.round(100 - s.ball)}`);
    setText(el.playClock, s.phase === 'live' ? '● LIVE' : ':' + String(Math.ceil(s.playClock)).padStart(2, '0'));
    el.playClock.classList.toggle('warning', s.playClock < 10 && s.phase !== 'live');
    const a = sim.actor(sim.controlled);
    if (el.playerName.__id !== a.player.id) {
        el.playerName.__id = a.player.id;
        el.playerName.innerHTML = `<span>${a.player.number}</span>${a.player.name.toUpperCase()}`;
    }
    setText(el.playerRole, `YOU CONTROL · ${a.role}`);
    const width = Math.round(a.stamina) + '%';
    if (el.turbo.__w !== width) {
        el.turbo.__w = width;
        el.turbo.style.width = width;
    }
    app.classList.toggle('live', s.phase === 'live');
    setHidden(el.tip, replaying || s.phase === 'dead');
    setText(el.tip, tipText(s, a));
    renderBook();
    if (s.noticeSerial !== lastSerial) {
        lastSerial = s.noticeSerial;
        noticeAge = 0;
        setText(el.bannerH, s.message);
        setText(el.bannerP, s.detail);
    }
    const duration = s.phase === 'live' ? .75 : s.phase === 'dead' ? 2.25 : 2.2;
    setHidden(el.banner, replaying || noticeAge > duration || !s.message || paused || ['coin', 'halftime', 'final', 'overtime'].includes(s.phase));
    noticeAge += dt;
    drawRadar();
}

function updateTargets() {
    const s = rules.s, host = el.targets;
    const visible = playing && !replaying && !paused && el.backdrop.hidden && s.possession === settings.team && sim.play.kind === 'pass' && !sim.passed && !sim.kickPlay && ['huddle', 'live', 'try'].includes(s.phase);
    if (!visible) {
        if (host.childElementCount) {
            host.innerHTML = '';
            host.__key = '';
        }
        return;
    }
    const rec = sim.receivers();
    const labels = P().pass;
    const key = `${rec.length}|${kit.input.source}`;
    if (host.__key !== key) {
        host.__key = key;
        host.innerHTML = rec.map((a, i) => `<button class="target-label" data-action="pass" data-n="${i}" aria-label="Pass to ${a.player.name}">${labels[i]}</button>`).join('');
    }
    for (let i = 0; i < rec.length; i++) {
        const a = rec[i];
        targetPoint.x = a.x;
        targetPoint.z = a.z;
        const p = renderer.project(targetPoint), b = host.children[i];
        setHidden(b, p.y < 30 || p.y > worldH - 30);
        b.style.left = p.x.toFixed(1) + 'px';
        b.style.top = (p.y + worldTop).toFixed(1) + 'px';
    }
}

function drawRadar() {
    if (!el.radar.offsetWidth)
        return; // hidden on small screens and touch layouts
    const c = radarCtx, s = rules.s;
    c.fillStyle = '#245345';
    c.fillRect(0, 0, 212, 320);
    c.fillStyle = '#ff642d88';
    c.fillRect(0, 294, 212, 26);
    c.fillStyle = '#36dce888';
    c.fillRect(0, 0, 212, 26);
    c.strokeStyle = '#b8d5ae40';
    c.lineWidth = 1;
    c.beginPath();
    for (let j = 0; j <= 10; j++) {
        const y = 26 + j * 26.7;
        c.moveTo(0, y);
        c.lineTo(212, y);
    }
    c.stroke();
    const d = sim.direction;
    const mx = (x) => 106 - x * 3.8 * d, my = (z) => 160 - z * 2.67 * d;
    if (s.phase !== 'kickoff') {
        c.strokeStyle = '#ffdf71';
        c.lineWidth = 2;
        const target = my((s.target - 50) * d);
        c.beginPath();
        c.moveTo(0, target);
        c.lineTo(212, target);
        c.stroke();
    }
    for (const a of sim.actors) {
        c.fillStyle = a.team === 0 ? '#ff895d' : '#7febef';
        c.beginPath();
        c.arc(mx(a.x), my(a.z), a.id === sim.controlled ? 5 : 3, 0, Math.PI * 2);
        c.fill();
        if (a.id === sim.controlled) {
            c.strokeStyle = '#fff1a5';
            c.lineWidth = 2;
            c.stroke();
        }
    }
    c.fillStyle = '#fff7e0';
    c.fillRect(mx(sim.ball.x) - 2, my(sim.ball.z) - 3, 4, 6);
}

/** The kit's touch buttons follow the play: only what you can do right now is shown. */
function touchContext() {
    const t = kit.touch;
    if (!t)
        return;
    const s = rules.s;
    const live = playing && !paused && !replaying && el.backdrop.hidden && s.phase === 'live';
    const key = !live ? 'off'
        : sim.userHasBall ? (sim.userCanPass && sim.play.kind === 'pass' ? 'qb' : 'carry')
            : sim.kickPlay && sim.ball.mode === 'kick' && sim.startTeam !== settings.team ? 'return'
                : 'chase';
    if (key === touchKey)
        return;
    touchKey = key;
    t.suspend(key === 'off', 'game');
    if (key === 'off')
        return;
    t.setShown('jump', key === 'qb' || key === 'carry');
    t.setShown('hit', key !== 'return');
    t.setShown('turbo', true);
    t.setShown('switch', key === 'chase');
    t.setShown('lateral', key === 'carry');
    t.setShown('away', key === 'qb' || key === 'return');
    t.setLabel('hit', key === 'chase' ? 'Dive' : 'Stiff-arm');
    t.setLabel('away', key === 'return' ? 'Fair catch' : 'Throw away');
}

// ---- input → simulation
function clearPend() {
    pend.action = pend.jump = pend.snap = pend.switch = pend.lateral = pend.throwaway = pend.timeout = false;
    pend.pass = -1;
}
/** Presses are kept until a 60 Hz step uses them, so a tap on a 144 Hz frame without a step is never lost. */
function gather() {
    const I = kit.input;
    if (I.pressed('hit'))
        pend.action = true;
    if (I.pressed('jump'))
        pend.jump = pend.snap = true;
    if (I.pressed('switch'))
        pend.switch = true;
    if (I.pressed('lateral'))
        pend.lateral = true;
    if (I.pressed('away'))
        pend.throwaway = true;
    if (I.pressed('timeout'))
        pend.timeout = true;
    for (let n = 0; n < 5; n++)
        if (I.pressed(PASS_ACTIONS[n]))
            pend.pass = n;
}
function takeInput(first) {
    const si = stepInput, mv = kit.input.vector('move');
    si.x = mv.x;
    si.z = mv.y;
    si.turbo = kit.input.down('turbo');
    si.pause = false;
    if (first) {
        si.action = pend.action;
        si.jump = pend.jump;
        si.snap = pend.snap;
        si.switch = pend.switch;
        si.lateral = pend.lateral;
        si.throwaway = pend.throwaway;
        si.timeout = pend.timeout;
        si.pass = pend.pass;
        clearPend();
    }
    else {
        si.action = si.jump = si.snap = si.switch = si.lateral = si.throwaway = si.timeout = false;
        si.pass = -1;
    }
    return si;
}

function handleEvent(e) {
    const user = settings.team;
    switch (e.type) {
        case 'hit':
            audio.play(e.big ? 'bighit' : 'hit');
            audio.cheer(e.big ? .4 : .18);
            renderer.cheerFor(e.big ? .35 : .12);
            if (e.user)
                kit.input.rumble(e.big ? .75 : .45, e.big ? 200 : 120);
            break;
        case 'score':
            audio.play('score');
            audio.cheer(1);
            renderer.cheerFor(1);
            if (rules.s.possession === user)
                kit.input.rumble(.5, 350);
            break;
        case 'turnover':
            audio.play('turnover');
            audio.cheer(.7);
            renderer.cheerFor(.7);
            kit.input.rumble(.6, 220);
            break;
        case 'catch':
            audio.play('catch');
            if (sim.actor(sim.carrier).team === user)
                kit.input.rumble(.2, 60);
            break;
        default:
            audio.play(e.type);
    }
}

function handlePause() {
    if (replaying) {
        stopReplay();
        return;
    }
    if (!el.backdrop.hidden) {
        if (!LOCKED_MODALS.includes(modalPage))
            closeModal();
        return;
    }
    if (playing)
        showPause();
}

function step(dt, input) {
    if (!playing) {
        sim.time += dt;
        sim.updateParticles(dt);
        return;
    }
    if (paused || replaying || challenge?.done)
        return;
    const phase0 = rules.s.phase;
    if (['halftime', 'overtime', 'final'].includes(phase0)) {
        if (challenge)
            finishChallenge();
        else if (phase0 === 'final') {
            if (modalPage !== 'final')
                showFinal();
        }
        else if (!modalPage)
            showIntermission();
        return;
    }
    const before = phase0;
    if (input.timeout) {
        if (rules.timeout(settings.team)) {
            showToast('Timeout charged. Game clock stopped.');
            saveGame();
        }
        else
            showToast('A timeout can only be taken before the snap, with timeouts remaining.');
    }
    if (READY.includes(before)) {
        readyAge += dt;
        if (input.snap)
            snapAction();
        if (meterStage !== 'idle') {
            meterAge += dt;
            meterValue = meterStage === 'power' ? (1 - Math.cos(meterAge * 3.1)) / 2 : (Math.sin(meterAge * 4.7) + 1) / 2;
        }
        if (rules.s.possession !== settings.team && readyAge > 3.1) {
            if (isKickChoice())
                sim.launchKick(rules.s.phase === 'kickoff' ? .52 : sim.play.kind === 'punt' ? .78 : .88, Math.random() * .22 - .11);
            else
                sim.snap();
        }
    }
    rules.tick(dt);
    // A dead-ball enforcement can preserve the same phase but change the formation's spot.
    if (READY.includes(rules.s.phase) && Math.abs(rules.s.ball - rules.s.snapBall) > .0001) {
        sim.prepare();
        meterStage = 'idle';
        lastBook = '';
    }
    if (before !== 'live') {
        input.snap = false;
        input.jump = false;
        input.pass = -1;
    }
    sim.update(dt, input);
    if (sim.events.length) {
        for (const e of sim.events)
            handleEvent(e);
        sim.events.length = 0;
    }
    if (rules.s.phase !== lastPhase) {
        const phase = rules.s.phase;
        deadAge = 0;
        lastBook = '';
        lastPhase = phase;
        if (READY.includes(phase)) {
            onReady();
            saveGame();
        }
        if (phase === 'dead') {
            saveGame();
            if (rules.s.message === 'MOVE THE CHAINS') {
                audio.play('firstdown');
                audio.cheer(.3);
                renderer.cheerFor(.25);
            }
        }
        if (['final', 'halftime', 'overtime'].includes(phase)) {
            if (challenge) {
                finishChallenge();
                return;
            }
            if (phase === 'final')
                showFinal();
            else
                showIntermission();
        }
    }
    if (rules.s.phase === 'dead') {
        deadAge += dt;
        if (deadAge > 2.5) {
            if (challenge && challengeOver(rules.s, challenge.possession)) {
                finishChallenge();
                return;
            }
            rules.continue();
            if (READY.includes(rules.s.phase))
                onReady();
            lastPhase = rules.s.phase;
            lastBook = '';
            saveGame();
        }
    }
}

function frame(dt, now) {
    const I = kit.input;
    if (I.source !== promptSource)
        refreshPrompts();
    if (I.pressed('pause'))
        handlePause();
    else if (!el.backdrop.hidden) {
        const r = nav.update([el.modal], now, '.primary');
        if (r.back && !LOCKED_MODALS.includes(modalPage))
            closeModal();
        else if (r.ok) {
            const main = defaultButton();
            if (main)
                nav.focus(main);
        }
    }
    else if (!playing) {
        const roots = [el.topbar, el.lobby];
        const r = nav.update(roots, now, '[data-action="start"]');
        if (r.ok || (I.pressed('jump') && !nav.current(roots))) {
            audio.unlock();
            el.start.click();
        }
    }
    else if (replaying)
        replayNav(now);
    else {
        gather();
        huddleNav(now);
    }

    acc = Math.min(acc + dt, 5 * STEP);
    let first = true;
    while (acc >= STEP) {
        step(STEP, takeInput(first));
        acc -= STEP;
        first = false;
    }

    let f;
    if (replaying && replayData.length) {
        if (!replayPaused)
            replayTime += dt * replaySpeed;
        const duration = replayData.length / 30;
        if (replayTime >= duration)
            replayTime = 0;
        f = replayData[Math.min(replayData.length - 1, Math.floor(replayTime * 30))];
        f.routes = false;
        f.shake = 0;
        const v = String(Math.round(replayTime / duration * 1000));
        if (el.scrub.value !== v)
            el.scrub.value = v;
    }
    else
        f = sim.view(!playing);
    if (settings.reducedMotion)
        f.shake = 0;
    renderer.render(f, dt);
    updateTargets();
    touchContext();
    if (meterStage !== 'idle' && el.needle) {
        const left = (meterValue * 100).toFixed(1) + '%';
        if (el.needle.__left !== left) {
            el.needle.__left = left;
            el.needle.style.left = left;
        }
    }
    uiAge += dt;
    if (uiAge >= .08) {
        updateHud(uiAge);
        uiAge = 0;
    }
}

// ---- DOM events. All interface commands use real game state; there are no dead-end buttons.
document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled)
        return;
    const action = button.dataset.action;
    audio.unlock();
    audio.play('click');
    if (action === 'team' && !playing) {
        settings.team = Number(button.dataset.id);
        persistSettings();
        markTeam();
    }
    else if (action === 'start' || action === 'rematch') {
        if (action === 'rematch')
            leave();
        showCoin();
    }
    else if (action === 'coin')
        toss(button.dataset.side);
    else if (action === 'receive')
        begin(Number(button.dataset.id));
    else if (action === 'play') {
        // The PLAY tab is the field itself: back to the action (or the lobby).
        if (!el.backdrop.hidden && !LOCKED_MODALS.includes(modalPage))
            closeModal();
    }
    else if (action === 'home') {
        if (playing)
            showPause();
        else if (!LOCKED_MODALS.includes(modalPage))
            closeModal();
    }
    else if (action === 'rosters') {
        rosterTeam = settings.team;
        showRosters();
    }
    else if (action === 'roster-team') {
        rosterTeam = Number(button.dataset.id);
        showRosters();
    }
    else if (action === 'promote')
        promote(Number(button.dataset.id));
    else if (action === 'help')
        showHelp();
    else if (action === 'help-tab')
        showHelp(button.dataset.tab);
    else if (action === 'settings')
        showSettings();
    else if (action === 'graphics')
        kit.menu.open();
    else if (action === 'pause')
        showPause();
    else if (action === 'stats')
        showStats();
    else if (action === 'close-modal')
        closeModal();
    else if (action === 'sound') {
        settings.sound = !settings.sound;
        persistSettings();
    }
    else if (action === 'fullscreen') {
        const promise = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
        void promise?.catch(() => showToast('Fullscreen is unavailable in this browser.'));
    }
    else if (action === 'snap')
        snapAction();
    else if (action === 'tab') {
        bookTab = button.dataset.tab;
        bookPage = 0;
        lastBook = '';
        renderBook();
    }
    else if (action === 'page') {
        bookPage++;
        lastBook = '';
        renderBook();
    }
    else if (action === 'select-play')
        selectPlay(playById(button.dataset.id));
    else if (action === 'defense') {
        sim.defense = button.dataset.id;
        lastBook = '';
        renderBook();
    }
    else if (action === 'back-plays') {
        bookTab = 'PASS';
        bookPage = 0;
        selectPlay(PLAYS[0]);
    }
    else if (action === 'onside')
        toggleOnside();
    else if (action === 'try')
        chooseTry(button.dataset.mode);
    else if (action === 'pass')
        pend.pass = Number(button.dataset.n);
    else if (action === 'timeout') {
        if (rules.timeout(settings.team)) {
            closeModal();
            showToast('Timeout charged. Game clock stopped.');
            saveGame();
        }
        else
            showToast('A timeout can only be taken before the snap, with timeouts remaining.');
    }
    else if (action === 'challenge') {
        const good = rules.challenge(settings.team);
        if (good) {
            closeModal();
            showToast('The spot is confirmed. Challenge lost; one timeout charged.');
            saveGame();
        }
        else
            showToast('Challenge unavailable: live play, automatic review, late half, or no timeout remaining.');
    }
    else if (action === 'challenges')
        showChallenges();
    else if (action === 'challenge-start')
        startChallenge(button.dataset.id);
    else if (action === 'challenge-retry') {
        if (challenge)
            startChallenge(challenge.def.id);
    }
    else if (action === 'next-period') {
        rules.continue();
        closeModal();
        onReady();
        lastPhase = rules.s.phase;
        saveGame();
    }
    else if (action === 'exit')
        leave();
    else if (action === 'resume-save')
        resumeSave();
    else if (action === 'replay')
        startReplay();
    else if (action === 'replay-exit')
        stopReplay();
    else if (action === 'replay-toggle')
        replayPaused = !replayPaused;
    else if (action === 'replay-speed')
        cycleReplaySpeed();
});
document.addEventListener('change', event => {
    const e = event.target;
    if (e.dataset.setting) {
        const key = e.dataset.setting;
        const value = e instanceof HTMLInputElement && e.type === 'checkbox' ? e.checked : key === 'quarterSeconds' ? Number(e.value) : e.value;
        settings[key] = value;
        if (!['quarterSeconds', 'postseason'].includes(key))
            rules.settings[key] = value;
        persistSettings();
    }
    else if (e.id === 'roster-filter') {
        rosterFilter = e.value;
        showRosters();
    }
    else if (e.id === 'roster-slot') {
        rosterSlot = e.value;
        showRosters();
    }
});
el.scrub.addEventListener('input', e => { replayTime = Number(e.target.value) / 1000 * (replayData.length / 30); });
document.addEventListener('keydown', e => {
    if (e.code === 'Tab' && !el.backdrop.hidden) {
        const list = Array.from(el.modal.querySelectorAll('button:not(:disabled),select,input,[tabindex="0"]'));
        const firstEl = list[0], lastEl = list.at(-1);
        if (e.shiftKey && document.activeElement === firstEl) {
            e.preventDefault();
            lastEl?.focus();
        }
        else if (!e.shiftKey && document.activeElement === lastEl) {
            e.preventDefault();
            firstEl?.focus();
        }
    }
});
// Sound starts with the first gesture of any kind (Safari and Chrome need one), not only clicks.
for (const type of ['pointerdown', 'keydown', 'touchend'])
    addEventListener(type, () => audio.unlock(), { capture: true, passive: true });
kit.input.onSourceChange((src) => {
    if (src === 'gamepad')
        audio.unlock();
});
kit.onPause((on) => audio.setPaused(on || document.hidden));
kit.onQuality(() => { sim.maxParticles = kit.detail(240); });
kit.onResize((w, h) => {
    worldTop = el.world.getBoundingClientRect().top;
    worldH = h;
    el.vignette.style.background = `radial-gradient(circle ${Math.round(w * 0.72)}px at 52% 47%, rgba(10,28,42,0) ${Math.round(w * 0.23)}px, rgba(10,28,42,.4) ${Math.round(w * 0.72)}px)`;
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden && playing && !paused && !replaying)
        showPause();
    acc = 0;
    audio.setPaused(document.hidden || kit.paused);
});
addEventListener('pagehide', () => saveGame());

// Test harness only exists with ?debug=1. It is not part of ordinary gameplay.
if (new URLSearchParams(location.search).has('debug'))
    window.__BLITZ__ = {
        get rules() { return rules; }, get sim() { return sim; }, get renderer() { return renderer; }, get paused() { return paused; }, get playing() { return playing; },
        begin, startChallenge, step: (dt, input = emptyInput()) => step(dt, input),
        scenario: (values) => { if (!playing)
            begin(0); closeModal(); Object.assign(rules.s, values); if (READY.includes(rules.s.phase))
            onReady(); lastPhase = rules.s.phase; lastBook = ''; updateHud(.1); },
        snapshot: () => ({ phase: rules.s.phase, score: rules.s.score, ball: rules.s.ball, down: rules.s.down, quarter: rules.s.quarter, clock: rules.s.clock, actors: sim.actors.length, backend: renderer.kind, physics: physics.kind, paused })
    };

persistSettings();
refreshLobby();
refreshPrompts();
kit.loading.progress(0.9, 'Warming up…');
await renderer.warm(sim.view(true));
kit.start(frame);
