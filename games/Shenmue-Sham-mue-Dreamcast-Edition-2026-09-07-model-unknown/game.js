/* Sham-mue — Dreamcast Edition. The game itself: the story, the people, the work, the fights
   and the small moments. It runs on the wall's shared 3D stack (three.js r186 WebGPURenderer
   with WebGL2 fallback, started by kit/boot.js). The models live in art.js, the materials and
   lights in gfx.js, the posing in rigs.js and the sound in audio.js.
   New in this edition: the Yard Run (a forklift time trial through nine gates) and evening
   sparring at the loading yard (three rounds, ending with Sho and his shoulder charge). */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { PI, TAU, clamp, mix, dist, angdiff } from './mesh.js';
import { obstacles, buildStatic } from './art.js';
import { loadTextures, createAtmosphere, createLights, staticMeshes, updateAtmosphere } from './gfx.js';
import { Cast, createProps } from './rigs.js';
import { HarbourSound } from './audio.js';

const $ = id => document.getElementById(id);
const show = (id, on = true) => $(id).classList.toggle('hidden', !on);
const textCache = new WeakMap(), styleCache = new Map();
function setText(el, v) { v = String(v); if (textCache.get(el) !== v) { textCache.set(el, v); el.textContent = v; } }
function setStyle(el, prop, v) {
  const k = el.id + '|' + prop;
  if (styleCache.get(k) === v) return;
  styleCache.set(k, v);
  if (prop.startsWith('--')) el.style.setProperty(prop, v); else el.style[prop] = v;
}

/* ------------------------------------------------------------------ input: one action set for keys, pads and touch */

const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  use: { keys: ['KeyE', 'Enter', 'NumpadEnter'], gamepad: ['A'], touch: 'Use' },
  run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['B'], touch: 'Run' },
  punch: { keys: ['KeyJ'], mouse: [0], gamepad: ['X', 'RT'], touch: 'Punch' },
  kick: { keys: ['KeyK'], mouse: [2], gamepad: ['Y'], touch: 'Kick' },
  guard: { keys: ['Space'], gamepad: ['LT'], touch: 'Guard' },
  evade: { keys: ['KeyL'], gamepad: ['B'], touch: 'Evade' },
  brake: { keys: ['Space'], gamepad: ['LT', 'B'], touch: 'Brake' },
  exit: { keys: ['KeyX'], gamepad: ['X'], touch: { label: 'Get out', slot: 'top' } },
  recover: { keys: ['KeyR'], gamepad: ['Y'], touch: { label: 'Reset', slot: 'top' } },
  notebook: { keys: ['KeyN', 'Tab'], gamepad: ['Back'], touch: { label: 'Notebook', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  back: { keys: ['Escape', 'Backspace'], gamepad: ['B'] },
  duck: { keys: ['Space'], gamepad: ['A', 'LT'] },
  camReset: { keys: ['KeyC'], gamepad: ['RS'] },
  closeLook: { keys: ['KeyZ'], gamepad: ['LS'] },
  turnCam: { keys: ['KeyQ'] },
  zoomPad: { type: 'axis', gamepad: { pos: 'RB', neg: 'LB' } },
  help: { keys: ['KeyH'] },
  mute: { keys: ['KeyM'] },
  fullscreen: { keys: ['KeyF'] },
  cleanView: { keys: ['KeyV'] },
  choice1: { keys: ['Digit1', 'Numpad1'] },
  choice2: { keys: ['Digit2', 'Numpad2'] },
  choice3: { keys: ['Digit3', 'Numpad3'] },
  choice4: { keys: ['Digit4', 'Numpad4'] }
};
const PROMPTS = {
  keyboard: { use: 'E', run: 'SHIFT', punch: 'J', kick: 'K', guard: 'SPACE', evade: 'L', brake: 'SPACE', exit: 'X', recover: 'R', notebook: 'N', pause: 'ESC', back: 'ESC', move: 'W A S D', drive: 'W / S', steer: 'A / D', up: 'W', right: 'D', duck: 'SPACE', next: 'E' },
  gamepad: { use: 'A', run: 'B', punch: 'X', kick: 'Y', guard: 'LT', evade: 'B', brake: 'LT', exit: 'X', recover: 'Y', notebook: 'BACK', pause: 'START', back: 'B', move: 'L STICK', drive: 'L STICK ↑↓', steer: 'L STICK ←→', up: '↑', right: '→', duck: 'A', next: 'A' },
  touch: { use: 'USE', run: 'RUN', punch: 'PUNCH', kick: 'KICK', guard: 'GUARD', evade: 'EVADE', brake: 'BRAKE', exit: 'GET OUT', recover: 'RESET', notebook: 'NOTEBOOK', pause: 'II', back: '×', move: 'STICK', drive: 'STICK ↑↓', steer: 'STICK ←→', up: 'TAP', right: 'TAP', duck: 'TAP', next: 'TAP' }
};

/* ------------------------------------------------------------------ options (read before boot: the image size is a boot choice) */

const SAVE_KEY = 'sham-mue.harbour.save.v1', OPT_KEY = 'sham-mue.harbour.options.v2';
const defaults = { quality: 0, shadows: true, guides: true, relaxed: false, tank: false, voices: false, volume: .55, muted: false, weather: true };
let options = { ...defaults };
try { options = { ...defaults, ...JSON.parse(localStorage.getItem(OPT_KEY) || '{}') }; } catch (e) { /* private mode: defaults */ }
options.quality = [0, 1, 2, 3].includes(Number(options.quality)) ? Number(options.quality) : 0;
const IMAGE_LINES = [480, 720, 960, 0], IMAGE_NAMES = ['640 × 480', '960 × 720', '1280 × 960', 'NATIVE'];

const kit = await boot({
  title: 'Sham-mue',
  canvas: $('scene'),
  mount: $('gameViewport'),
  pixelHeight: IMAGE_LINES[options.quality],
  gear: 'none',
  accent: '#d3b679',
  background: '#20383b',
  touch: { top: 'right', topOffset: 10 },
  input: ACTIONS
});
const input = kit.input;
const src = () => (PROMPTS[input.source] ? input.source : 'keyboard');
const K = a => PROMPTS[src()][a];

/* ------------------------------------------------------------------ the world */

// Nine gates: north up the road, round the loading yard, back past (not through) the delivery bay, a loop by the gate, home.
const RUN_GATES = [[-3, -10], [2, -24], [4, -34], [10, -20], [2, -4], [3, 14], [-4, 24], [-8, 12], [-5, 4]];
const RUN_START = { x: -5, z: 1.2, yaw: 0 };
const RUN_PAR = { gold: 52, silver: 64 };
const MEDALS = ['', 'BRONZE', 'SILVER', 'GOLD'], MEDAL_PAY = [0, 80, 150, 300];

const sound = new HarbourSound();
let scene, camera, lights, sky, props, cast, ready = false;
try {
  kit.loading.progress(.12, 'Opening the east gate…');
  await loadTextures(f => kit.loading.progress(.12 + f * .6, 'Unpacking the harbour…'), kit.tier.name === 'low' ? 2 : 4);
  kit.loading.progress(.78, 'Building the quay…');
  scene = new THREE.Scene();
  camera = kit.fitCamera(new THREE.PerspectiveCamera(50, 4 / 3, .08, 550));
  sky = createAtmosphere(scene);
  lights = createLights(scene, kit);
  kit.renderer.shadowMap.enabled = !!options.shadows;
  scene.add(staticMeshes(buildStatic()));
  props = createProps(scene);
  props.buildGates(RUN_GATES, RUN_START);
  cast = new Cast(scene);
} catch (e) { fatal(e); throw e; }

/* ------------------------------------------------------------------ game state */

let appliedLines = IMAGE_LINES[options.quality], appliedShadows = !!options.shadows;
let mode = 'title', started = false, G, player, forklift, crates, npcs = [], enemies = [], interactable = null, fkValid = false;
let worldTime = 0, camYaw = 0, camPitch = .1, camManual = 0, camZoom = 3.6, screenShake = 0, damageAlpha = 0;
const camEye = [10.2, 1.92, 31.5], camTarget = [11.6, 1.42, 27.5];
let dialogue = null, modalState = null, bookPrev = 'title', currentTab = 'leads', transition = null, qte = null, darts = null, sideShift = false, battleWinDelay = 0;
let race = null, spar = null, goUntil = 0;
let navY = 0, navX = 0, navHold = 0, navSync = true, zoomPrev = 0, qteDir = {}, touchSig = '';
let toastUntil = 0, areaUntil = 0, saveUntil = 0, lastAutoSave = 0, lastAction = 0, stepAccum = 0, rainAmount = 0, hudTick = 0;

const actors = {
  mori: { id: 'mori', name: 'Mori', x: 9.4, z: 26.4, yaw: PI, coat: '#426071', pants: '#344e5c', cap: '#344951', hair: '#3b3830', role: 'Gate guard' },
  hana: { id: 'hana', name: 'Hana', x: -19.7, z: 28.3, yaw: PI, coat: '#728077', pants: '#535a51', hair: '#3f302b', role: 'Tea shop owner' },
  daichi: { id: 'daichi', name: 'Daichi', x: -8.5, z: 2, yaw: -.5, coat: '#647a76', pants: '#475960', cap: '#c7ab66', vest: true, hair: '#383d36', role: 'Yard foreman' },
  sailor: { id: 'sailor', name: 'Nobu', x: -26.7, z: 12, yaw: .85, coat: '#b2b8a4', pants: '#476374', cap: '#d8d4bb', hair: '#473b31', role: 'Off-duty sailor' },
  // New: after the fight, Genji stays at the loading yard and runs the evening sparring.
  genji: { id: 'genji', name: 'Genji', x: -4.5, z: -31, yaw: -PI / 2, coat: '#826e5c', pants: '#4c595b', hair: '#363730', role: 'Dock hand', minStage: 6 }
};
const crateOrigins = [{ x: -9, z: -18 }, { x: -5, z: -19 }, { x: -1, z: -18 }];
const toyNames = ['Forklift No. 05', 'Blue freighter', 'Harbour gull', 'Lucky kettle', 'Tiny crane', 'The night cat'];
const leads = [
  ['The east gate', 'Ask the gate guard about the marked crate.'],
  ['Breakwater Tea', 'Speak to Hana at the tea shop.'],
  ['The afternoon shift', 'Find Daichi near the orange forklift.'],
  ['A favour for Daichi', 'Move three crates to the marked bay at Warehouse 03.'],
  ['The freight manifest', 'Read the notice board on Warehouse 03.'],
  ['The loading yard', 'Recover the stolen cargo pass.'],
  ['Warehouse 08', 'Take the cargo pass to Warehouse 08.'],
  ['A quiet harbour', 'The ledger is safe. Stay a little longer.']
];
const HERO = { coat: '#735039', pants: '#486777' };

function freshState() {
  G = { v: 1, stage: 0, cash: 500, clock: 940, elapsed: 0, toys: {}, catFed: false, hasBun: false, drinks: 0, dartsPlayed: 0, bestDarts: 0, battleWon: false, qteWins: 0, sideShifts: 0, runBest: 0, runs: 0, runMedal: 0, sparBest: 0, sparClears: 0, sparMet: false, sideNews: 0 };
  player = { x: 11.5, z: 29.5, y: 0, yaw: 0, hero: true, health: 100, walk: 0, phase: 0, attackTime: 0, attackKind: 'punch', attackHit: false, cool: 0, invuln: 0, evadeCool: 0, hit: 0, combo: 0, comboTime: 0, block: false, dead: false, ...HERO };
  forklift = { x: -5, z: 1.2, yaw: 0, speed: 0, carry: null, bumpT: 0 };
  crates = crateOrigins.map((o, i) => ({ ...o, id: i, delivered: false }));
  npcs = Object.values(actors).map(a => ({ ...a, walk: 0, phase: 0 }));
  npcs.push(
    { id: 'walker1', name: 'Eiji', role: 'Dock worker', x: -3, z: 11, yaw: 0, coat: '#688a8a', pants: '#3b565d', cap: '#b7b5a0', path: [[-3, 11], [-3, -11], [8, -17], [8, 14]], wp: 1, walk: 0, phase: 2 },
    { id: 'walker2', name: 'Ken', role: 'Delivery driver', x: 6, z: 9, yaw: PI, coat: '#877865', pants: '#495a5c', path: [[6, 9], [5, 24], [-5, 24], [-5, 9]], wp: 1, walk: 0, phase: 0 },
    { id: 'walker3', name: 'Aoi', role: 'Port clerk', x: -17, z: 13, yaw: 0, coat: '#698078', pants: '#58564d', hair: '#3c3530', path: [[-17, 13], [-17, -1], [-14, -1], [-14, 13]], wp: 1, walk: 0, phase: 4 }
  );
  enemies = []; sideShift = false; race = null; spar = null; qte = null; darts = null;
  camYaw = 0; camManual = 0; camPitch = .1; camZoom = 3.6;
  set3(camEye, 12, 2.18, 33.1); set3(camTarget, 11.5, 1.22, 29.15);
}
// Genji stands at the loading yard once the fight is over; while anyone is fighting there, he is one of them.
const npcPresent = n => !(n.minStage > G.stage) && !(n.id === 'genji' && (spar || enemies.length > 0));
function set3(a, x, y, z) { a[0] = x; a[1] = y; a[2] = z; }

function readSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!s || s.v !== 1 || !Number.isInteger(s.stage) || s.stage < 0 || s.stage > 7) return null; return s; } catch (e) { return null; }
}
function persistOptions() {
  try { localStorage.setItem(OPT_KEY, JSON.stringify(options)); } catch (e) { /* not saved */ }
  const lines = IMAGE_LINES[options.quality] ?? 480;
  if (lines !== appliedLines) { appliedLines = lines; kit.setPixelHeight(lines); }
  if (!!options.shadows !== appliedShadows) { appliedShadows = !!options.shadows; kit.renderer.shadowMap.enabled = appliedShadows; }
  sound.voice = !!options.voices; sound.setVolume(clamp(Number(options.volume) || 0, 0, 1)); sound.setMute(!!options.muted);
}
function saveGame(silent = false) {
  if (!started || !G) return;
  try {
    // A run in progress parks the forklift at home in the save; a sparring match is not saved.
    const fk = race ? { x: RUN_START.x, z: RUN_START.z, yaw: 0, speed: 0, carry: null } : { ...forklift, speed: 0 };
    const pos = spar ? { x: 1.5, z: -27.3, yaw: player.yaw, health: 100 } : { x: player.x, z: player.z, yaw: player.yaw, health: player.health };
    const state = { ...G, position: pos, forklift: fk, crates: crates.map(c => ({ ...c })), sideShift };
    delete state.saveWarned;
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!silent) { saveUntil = worldTime + 1.8; setStyle($('saveIcon'), 'opacity', '1'); }
  } catch (e) {
    if (!G.saveWarned) { G.saveWarned = true; toast('BROWSER STORAGE', 'This session is not saved', 'Keep this tab open to keep your progress.'); }
  }
}
function num(v, lo, hi, d = 0) { v = Number(v); return Number.isFinite(v) ? clamp(v, lo, hi) : d; }
function loadState(s) {
  freshState();
  for (const k of ['stage', 'cash', 'clock', 'elapsed', 'catFed', 'hasBun', 'drinks', 'dartsPlayed', 'bestDarts', 'battleWon', 'qteWins', 'sideShifts', 'runs', 'sparClears', 'sparMet', 'sideNews']) if (s[k] !== undefined) G[k] = s[k];
  for (const k of ['drinks', 'dartsPlayed', 'bestDarts', 'qteWins', 'sideShifts', 'runs', 'sparClears', 'sideNews']) G[k] = Math.round(num(G[k], 0, 1e6, 0));
  G.catFed = !!G.catFed; G.hasBun = !!G.hasBun; G.battleWon = !!G.battleWon; G.sparMet = !!G.sparMet;
  G.cash = num(G.cash, 0, 99999, 500); G.clock = num(G.clock, 940, 1135, 940); G.elapsed = num(G.elapsed, 0, 1e7, 0);
  G.runBest = num(s.runBest, 0, 3600, 0); G.runMedal = Math.round(num(s.runMedal, 0, 3, 0)); G.sparBest = num(s.sparBest, 0, 36000, 0);
  G.toys = s.toys && typeof s.toys === 'object' ? s.toys : {};
  if (s.position && Number.isFinite(s.position.x) && Number.isFinite(s.position.z)) {
    player.x = clamp(s.position.x, -30, 14.5); player.z = clamp(s.position.z, -39, 34); player.yaw = Number(s.position.yaw) || 0; player.health = clamp(Number(s.position.health) || 100, 1, 100);
  }
  if (s.forklift && Number.isFinite(s.forklift.x) && Number.isFinite(s.forklift.z)) {
    forklift = { ...forklift, x: clamp(s.forklift.x, -29, 14), z: clamp(s.forklift.z, -39, 33), yaw: Number(s.forklift.yaw) || 0, speed: 0 };
    forklift.carry = Number.isInteger(s.forklift.carry) && s.forklift.carry >= 0 && s.forklift.carry < 3 ? s.forklift.carry : null;
  }
  if (Array.isArray(s.crates) && s.crates.length === 3) crates = s.crates.map((c, i) => ({ id: i, x: clamp(Number(c.x) || crateOrigins[i].x, -29, 14), z: clamp(Number(c.z) || crateOrigins[i].z, -39, 33), delivered: !!c.delivered }));
  sideShift = !!s.sideShift;
  // A crate on the forks of a finished job would be stranded; put it back where it came from.
  if (forklift.carry !== null && !(G.stage === 3 || sideShift)) { const c = crates[forklift.carry]; c.x = crateOrigins[c.id].x; c.z = crateOrigins[c.id].z; forklift.carry = null; }
  if (collides(player.x, player.z, .30) || dist(player, forklift) < 1.2) moveToSafe();
  camYaw = player.yaw;
  set3(camEye, player.x + Math.sin(camYaw) * 3.6, 2.12, player.z + Math.cos(camYaw) * 3.6); set3(camTarget, player.x, 1.2, player.z);
}

function startGame(resume = false) {
  sound.init(); sound.stopSpeech();
  const save = resume ? readSave() : null;
  if (save) loadState(save); else freshState();
  started = true;
  setMode('roam');
  show('titleScreen', false); show('ending', false); show('bookOverlay', false); show('modal', false);
  $('areaCard').classList.add('show'); areaUntil = worldTime + 4.8;
  persistOptions(); updateHUD();
  if (save && (G.stage === 3 || sideShift) && crates.every(c => c.delivered)) fadeTo(finishShift);
  else if (save && G.stage === 5) fadeTo(() => battleIntro(true));
  else if (!save) talk([{ n: 'Jun', t: 'Father left one address in his letter. Nagamatsu Harbour.' }, { n: 'Jun', t: 'A red ledger. A crate marked with a blue crane. Someone here must know.' }], () => { areaUntil = worldTime + 3; $('areaCard').classList.add('show'); toast('THE LAST SHIPMENT', 'Start at the east gate', 'Walk to the guard. Press ' + K('use') + ' to speak.'); saveGame(); }, null);
  else toast('AFTERNOON RESUMED', 'Back at the harbour', leads[G.stage][1]);
}
function refreshTitle() {
  const has = !!readSave();
  show('continueBtn', has);
  $('startBtn').className = has ? 'secondary' : 'primary';
  $('startBtn').innerHTML = (has ? 'START A NEW AFTERNOON' : 'BEGIN THE AFTERNOON') + ' <span class="arrow">→</span>';
}
function goTitle() {
  if (race) endYardRun(false, true);
  if (spar) { spar = null; enemies = []; }
  saveGame(true); started = false; qte = null;
  setMode('title');
  show('modal', false); show('bookOverlay', false); show('ending', false); show('dartsOverlay', false); darts = null;
  show('titleScreen'); sound.stopSpeech();
  $('areaCard').classList.remove('show'); refreshTitle(); menuOpened($('titleScreen'));
}
function requestNew() {
  if (readSave()) openModal('A new afternoon', 'NEW GAME', '<p>This starts a new story. It replaces the saved afternoon in this browser.</p>', [{ text: 'Start a new afternoon', fn: () => startGame(false) }, { text: 'Keep my saved game', fn: () => menuOpened($('titleScreen')) }]);
  else startGame(false);
}
function setMode(m) {
  if (m === 'title') { set3(camEye, 10.2, 1.92, 31.5); set3(camTarget, 11.6, 1.42, 27.5); }
  mode = m;
  show('hud', started && !['title', 'ending', 'darts'].includes(m));
  show('dialogue', m === 'dialogue'); show('taskHUD', m === 'forklift'); show('fightHUD', m === 'combat'); show('battleHints', m === 'combat'); show('qteHUD', m === 'qte');
  if (m !== 'combat') { $('enemyWarnings').innerHTML = ''; textCache.set($('enemyWarnings'), ''); }
  if (m !== 'forklift' || !race || race.phase !== 'count') show('countdown', false);
  show('interaction', false); show('waypoint', false);
  const b = document.body.classList;
  b.toggle('playing', ['roam', 'forklift', 'combat'].includes(m)); b.toggle('forklift', m === 'forklift'); b.toggle('combat', m === 'combat');
  b.toggle('title-mode', m === 'title'); b.toggle('cinematic', ['dialogue', 'qte', 'transition'].includes(m));
  $('modeLabel').textContent = m === 'forklift' ? (race ? 'YARD RUN' : 'AFTERNOON SHIFT') : m === 'combat' ? (spar ? 'SPARRING' : 'FREE BATTLE') : 'FREE EXPLORATION';
  if (!['roam', 'forklift', 'combat', 'qte'].includes(m) && player) player.walk = 0;
  if (m !== 'dialogue') sound.stopSpeech();
  if (m === 'qte') qteDir = qteDirs();
  input.settle(); navSync = true; refreshPrompts();
}
function toast(tag, title, text = '') {
  if (mode === 'title') return;
  setText($('toastTag'), tag); setText($('toastTitle'), title); setText($('toastText'), text);
  $('toast').classList.add('show'); toastUntil = worldTime + 4.7;
}
function stageTo(n) { if (n <= G.stage) return; G.stage = n; updateHUD(); sound.sfx('note'); toast('NOTEBOOK UPDATED', leads[n][0], leads[n][1]); saveGame(); }
function fadeTo(fn) { transition = { time: 0, fn, done: false }; setMode('transition'); }

/* ------------------------------------------------------------------ conversations */

function talk(lines, onend = null, focus = null, choices = null) { dialogue = { lines, index: 0, typed: 0, onend, focus, choices, choiceBuilt: false }; setMode('dialogue'); showLine(); }
function showLine() {
  const l = dialogue.lines[dialogue.index];
  dialogue.typed = 0; dialogue.choiceBuilt = false;
  $('speaker').textContent = l.n.toUpperCase(); $('speech').textContent = ''; $('choices').innerHTML = ''; show('dialogueNext');
  sound.speak(l.t, l.n);
  if (dialogue.focus) { const f = dialogue.focus; f.yaw = Math.atan2(f.x - player.x, f.z - player.z); player.yaw = Math.atan2(player.x - f.x, player.z - f.z); }
  sound.sfx('click');
}
function updateDialogue(dt) {
  if (!dialogue) return;
  const l = dialogue.lines[dialogue.index];
  dialogue.typed = Math.min(l.t.length, dialogue.typed + dt * 42);
  setText($('speech'), l.t.slice(0, Math.floor(dialogue.typed)));
  if (dialogue.typed >= l.t.length && dialogue.index === dialogue.lines.length - 1 && dialogue.choices && !dialogue.choiceBuilt) {
    dialogue.choiceBuilt = true; show('dialogueNext', false);
    dialogue.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.innerHTML = '<small>' + (i + 1) + '</small>';
      const span = document.createElement('span'); span.textContent = c.text; b.appendChild(span);
      b.onclick = () => chooseDialogue(i);
      $('choices').appendChild(b);
    });
    navSync = true; menuOpened($('choices'));
  }
}
function advanceTalk() {
  if (!dialogue) return;
  const l = dialogue.lines[dialogue.index];
  if (dialogue.typed < l.t.length) { dialogue.typed = l.t.length; updateDialogue(0); return; }
  if (dialogue.index < dialogue.lines.length - 1) { dialogue.index++; showLine(); } else if (!dialogue.choices) finishTalk();
}
function finishTalk() { const cb = dialogue?.onend; dialogue = null; setMode('roam'); if (cb) cb(); }
function chooseDialogue(i) {
  if (!dialogue || !dialogue.choiceBuilt || !dialogue.choices[i]) return;
  const c = dialogue.choices[i], cb = dialogue.onend;
  dialogue = null; setMode('roam'); sound.sfx('click');
  if (cb) cb(); if (c.fn) c.fn();
}

/* ------------------------------------------------------------------ modal panels, pause */

function openModal(title, kicker, body, buttons, esc = true) {
  const prev = mode === 'modal' ? (modalState?.prev || 'roam') : mode;
  modalState = { prev, esc, buttons };
  setMode('modal');
  $('modalTitle').textContent = title; $('modalKicker').textContent = kicker; $('modalBody').innerHTML = body; $('modalActions').innerHTML = '';
  buttons.forEach((obj, i) => {
    const b = document.createElement('button');
    b.className = i === 0 ? 'primary' : 'secondary'; b.textContent = obj.text;
    b.onclick = () => closeModal(obj.fn);
    $('modalActions').appendChild(b);
  });
  show('modal'); menuOpened($('modal'));
}
function closeModal(fn) {
  const restore = modalState?.prev || 'roam';
  modalState = null; show('modal', false); setMode(restore); sound.sfx('click');
  fn?.();
}
function pauseGame() {
  if (!started || ['title', 'modal', 'book', 'ending', 'transition', 'dialogue', 'darts'].includes(mode)) return;
  saveGame(true);
  const btns = [{ text: 'Return to the harbour', fn: () => {} }];
  if (spar) btns.push({ text: 'Restart the sparring match', fn: () => fadeTo(startSpar) });
  else if (mode === 'combat') btns.push({ text: 'Restart this fight', fn: () => beginBattle() });
  if (race) btns.push({ text: 'Restart the yard run', fn: () => startYardRun() }, { text: 'Leave the yard run', fn: () => endYardRun(true) });
  btns.push({ text: 'Notebook & options', fn: () => openBook('options') }, { text: 'Display & controls', fn: () => kit.menu.open() }, { text: 'Save and return to title', fn: () => goTitle() });
  openModal('Take a moment.', 'PAUSED', '<p>The harbour can wait.</p>', btns);
}

/* ------------------------------------------------------------------ people and places */

function npc(id) { return npcs.find(n => n.id === id); }
function choosePerson(a) {
  if (a.id === 'mori') {
    if (G.stage === 0) talk([{ n: 'Jun', t: 'Excuse me. I am looking for a crate marked with a blue crane.' }, { n: 'Mori', t: 'A blue crane? Ask Hana at Breakwater Tea. The green awning, by the water.' }, { n: 'Jun', t: 'Hana. I see.' }], () => stageTo(1), a);
    else talk([{ n: 'Mori', t: G.stage === 7 ? 'You found what you came for. That is more than most people can say.' : 'No trouble in the yard, all right? What do you need?' }], null, a, [
      { text: 'Where should I go?', fn: () => talk([{ n: 'Mori', t: leads[G.stage][1] }], null, a) },
      { text: 'Tell me about the harbour.', fn: () => talk([{ n: 'Mori', t: 'Thirty years at this gate. I know every ship by its horn.' }, { n: 'Jun', t: 'Does that one have a name?' }, { n: 'Mori', t: 'They all have names, son.' }], null, a) },
      { text: 'That is all. Thank you.', fn: () => {} }]);
  } else if (a.id === 'hana') {
    if (G.stage < 2) talk([{ n: 'Jun', t: 'Do you know about a shipment with a blue crane on the crate?' }, { n: 'Hana', t: 'Kita Shipping. Daichi moved their cargo this morning. He is beside the orange forklift.' }, { n: 'Hana', t: 'Your father used to drink his tea here. Always let it go cold.' }, { n: 'Jun', t: 'You knew him?' }, { n: 'Hana', t: 'A little. Ask Daichi about the red ledger.' }], () => stageTo(2), a);
    else talk([{ n: 'Hana', t: G.stage === 7 ? 'One more cup before you go? Your father would have stayed.' : 'A warm drink helps on a day like this.' }], null, a, [
      { text: 'Tea — ¥80', fn: () => purchase(80, () => { player.health = 100; talk([{ n: 'Hana', t: 'Here. Take your time.' }, { n: 'Jun', t: 'It is good. Thank you.' }], () => { sound.sfx('soda'); G.drinks++; saveGame(); }, a); }) },
      { text: 'A fish bun for the cat — ¥80', fn: () => { if (G.hasBun) { talk([{ n: 'Hana', t: 'You still have the last one in your pocket. The cat is by the bench.' }], null, a); return; } purchase(80, () => { G.hasBun = true; talk([{ n: 'Hana', t: 'For the little cat by the bench? Leave half for him. He has had a long day too.' }], () => { saveGame(); toast('POCKET', 'A warm fish bun', 'Find the cat near the bench by the water.'); }, a); }); } },
      { text: 'The man with the ledger?', fn: () => talk([{ n: 'Hana', t: G.stage < 4 ? 'Daichi is the foreman. Help him with the crates. People talk when the work is done.' : G.stage < 7 ? 'The freight office is on Warehouse 03. The big numbers are hard to miss.' : 'The morning ferry goes to Kobe. You still have some time.' }], null, a) },
      { text: 'I should go.', fn: () => {} }]);
  } else if (a.id === 'daichi') {
    if (G.stage < 2) talk([{ n: 'Daichi', t: 'Looking for cargo? Hana knows who owns what. Ask her at the tea shop.' }], null, a);
    else if (G.stage === 2) talk([{ n: 'Jun', t: 'Hana sent me. Did you see my father\'s red ledger?' }, { n: 'Daichi', t: 'Kita cargo. I remember. Give me a hand, and I will find the manifest.' }, { n: 'Daichi', t: 'Three crates from the yellow pickup area. Put them in the marked bay at Warehouse 03.' }], null, a, [{ text: 'Take the shift.', fn: () => { stageTo(3); shiftIntro(); } }, { text: 'I will come back.', fn: () => {} }]);
    else if (G.stage === 3) talk([{ n: 'Daichi', t: 'Use the orange forklift. ' + K('use') + ' lifts a crate. ' + K('use') + ' again sets it down in the yellow bay at Warehouse 03.' }, { n: 'Daichi', t: 'No rush. If the truck gets stuck, press ' + K('recover') + ' to put it back here.' }], null, a, [{ text: 'Get to work.', fn: () => enterForklift() }, { text: 'Keep walking.', fn: () => {} }]);
    else talk([{ n: 'Daichi', t: G.stage === 7 ? 'Good work today. There is always another shipment.' : 'Your manifest is on the board at Warehouse 03. You earned that look.' }], null, a, [
      { text: sideShift ? 'Back to the shift.' : 'Work another shift.', fn: () => { if (!sideShift) { sideShift = true; crates = crateOrigins.map((o, i) => ({ ...o, id: i, delivered: false })); forklift = { x: -5, z: 1.2, yaw: 0, speed: 0, carry: null, bumpT: 0 }; } shiftIntro(); } },
      { text: 'The Yard Run.', fn: () => yardRunTalk(a) },
      { text: 'Any advice?', fn: () => talk([{ n: 'Daichi', t: 'Keep your feet under you. Block their first strike, then step in.' }, { n: 'Jun', t: 'You mean the forklift?' }, { n: 'Daichi', t: 'No.' }], null, a) },
      { text: 'Thanks for the work.', fn: () => {} }]);
  } else if (a.id === 'sailor') talk([{ n: 'Jun', t: 'Do you work on the ships?' }, { n: 'Nobu', t: 'Not while I am on my break.' }, { n: 'Jun', t: 'I see.' }, { n: 'Nobu', t: 'The blue ship leaves tomorrow. The ledger goes through Warehouse 08. You did not hear that from me.' }], null, a);
  else if (a.id === 'genji') {
    const first = !G.sparMet; G.sparMet = true;
    talk(first
      ? [{ n: 'Genji', t: 'You again. No hard feelings about the yard, all right? We were paid to stand there.' }, { n: 'Jun', t: 'I understand.' }, { n: 'Genji', t: 'You have good hands. After hours we spar here. Three rounds. Sho finishes it, if you last that long.' }]
      : [{ n: 'Genji', t: G.sparClears ? 'The champion of the loading yard. Another round?' : 'Back for Sho? He is warming up behind the crates.' }],
      null, a, [
        { text: 'Spar — three rounds.', fn: () => sparIntro() },
        { text: 'Who was the courier?', fn: () => talk([{ n: 'Genji', t: 'Some kid from the city. Fast legs. He is on the morning ferry too, I heard.' }, { n: 'Jun', t: 'Then I will see him again.' }], null, a) },
        { text: 'Goodbye.', fn: () => {} }]);
  } else {
    const lines = a.id === 'walker1' ? ['The north yard is closed. Keep to the main road.', 'Watch the forks. They are lower than they look.'] : a.id === 'walker2' ? ['A red ledger? Ask the foreman. I only drive.', 'I have been waiting for the same cup of tea since lunch.'] : ['Read the warehouse numbers, not the shipping company names.', 'The sea is quiet today. That is usually a good sign.'];
    talk([{ n: a.name, t: lines[Math.floor(G.elapsed / 90) % lines.length] }], null, a);
  }
}
function purchase(cost, fn) {
  if (G.cash < cost) { sound.sfx('fail'); talk([{ n: 'Jun', t: 'I do not have enough money. I can earn more by moving cargo for Daichi.' }]); return; }
  G.cash -= cost; updateHUD(); sound.sfx('coin'); fn(); saveGame(true);
}

/* ------------------------------------------------------------------ the forklift shift */

function shiftIntro() {
  openModal('An honest afternoon.', 'FORKLIFT SHIFT', '<p>Move the <strong>three marked crates</strong> to the yellow bay at <strong>Warehouse 03</strong>.</p><p>Use <strong>' + K('drive') + '</strong> to drive and <strong>' + K('steer') + '</strong> to steer. Stop near a crate. Press <strong>' + K('use') + '</strong> to lift it. Press <strong>' + K('use') + '</strong> inside the bay to deliver it.</p><div class="modalHint">' + K('brake') + ' / BRAKE &nbsp; · &nbsp; ' + K('exit') + ' / GET OUT &nbsp; · &nbsp; ' + K('recover') + ' / RECOVER<br>No time limit. Take your time.</div>', [{ text: 'Get in the forklift', fn: () => enterForklift() }, { text: 'Look around first', fn: () => {} }]);
}
function enterForklift() {
  if (G.stage !== 3 && !sideShift) { talk([{ n: 'Jun', t: 'I should speak to Daichi before I use his forklift.' }]); return; }
  player.walk = 0; player.y = 0; forklift.speed = 0;
  setMode('forklift'); setPips(3); setText($('taskKicker'), 'AFTERNOON SHIFT / WAREHOUSE 03');
  camYaw = forklift.yaw; camManual = 0; camZoom = 7;
  set3(camEye, forklift.x + Math.sin(camYaw) * 7, 4.1, forklift.z + Math.cos(camYaw) * 7); set3(camTarget, forklift.x, 1.25, forklift.z);
  updateHUD(); toast('AFTERNOON SHIFT', 'Slow and steady', 'Three crates. One yellow bay. ' + K('use') + ' lifts and lowers.');
}
function exitForklift() {
  if (race) { endYardRun(true); return; }
  player.x = forklift.x + Math.cos(forklift.yaw) * 1.65; player.z = forklift.z - Math.sin(forklift.yaw) * 1.65; player.yaw = forklift.yaw; player.y = 0; forklift.speed = 0;
  if (collides(player.x, player.z, .3)) moveToSafe();
  setMode('roam'); camZoom = 3.6; saveGame(true);
}
function recoverForklift() {
  if (race) { startYardRun(); return; }
  if (forklift.carry !== null) { const c = crates[forklift.carry]; c.x = crateOrigins[c.id].x; c.z = crateOrigins[c.id].z; forklift.carry = null; }
  forklift.x = -5; forklift.z = 1.2; forklift.yaw = 0; forklift.speed = 0; camYaw = 0;
  toast('VEHICLE RECOVERED', 'Back beside the foreman', 'Delivered cargo stays delivered.'); sound.sfx('load'); saveGame(true);
}
function frontOfFork() { return { x: forklift.x - Math.sin(forklift.yaw) * 2, z: forklift.z - Math.cos(forklift.yaw) * 2 }; }
function bestCrate() { const p = frontOfFork(); let best = null, dd = 2.25; for (const c of crates) if (!c.delivered && c.id !== forklift.carry) { const d = dist(p, c); if (d < dd) { dd = d; best = c; } } return best; }
function inBay(p) { return p.x > 5.7 && p.x < 12.4 && p.z > -14 && p.z < -6; }
function forkAction() {
  if (race) return;
  if (Math.abs(forklift.speed) > .85) { toast('EASY NOW', 'Stop the forklift first', 'Hold ' + K('brake') + ' to brake.'); return; }
  const front = frontOfFork();
  if (forklift.carry === null) {
    const c = bestCrate();
    if (c) { forklift.carry = c.id; sound.sfx('load'); input.rumble(.25, 80); toast('CARGO LOADED', 'Crate ' + (c.id + 1) + ' / 3', 'Drive to the yellow bay at Warehouse 03.'); }
    else { sound.sfx('click'); toast('NO CARGO IN REACH', 'Move the forks closer', 'Line up the front of the truck with a marked crate.'); }
  } else {
    const c = crates[forklift.carry];
    if (inBay(front) || inBay(forklift)) {
      c.delivered = true; c.x = 8 + (crates.filter(k => k.delivered).length - 1) * 1.5; c.z = -11.2; forklift.carry = null;
      sound.sfx('success'); input.rumble(.3, 100);
      const total = crates.filter(k => k.delivered).length;
      toast('CARGO DELIVERED', total + ' / 3 crates', 'Good work. Keep the bay clear.');
      if (total === 3) { saveGame(true); fadeTo(finishShift); return; }
    } else if (!collides(front.x, front.z, .75)) { c.x = front.x; c.z = front.z; forklift.carry = null; sound.sfx('load'); toast('CARGO SET DOWN', 'Crate left in the yard', 'You can lift it again.'); }
    else toast('NOT ENOUGH ROOM', 'Move clear of the wall', 'The forks need open ground.');
  }
  saveGame(true); updateHUD();
}
function finishShift() {
  forklift.carry = null; forklift.speed = 0; forklift.x = -5; forklift.z = 1.2; forklift.yaw = 0;
  player.x = -6.8; player.z = 4; player.y = 0; player.yaw = .55; camYaw = .5; camZoom = 3.6;
  const side = sideShift; sideShift = false;
  G.cash += side ? 250 : 500; if (side) G.sideShifts++;
  if (!side) stageTo(4);
  setMode('roam');
  talk(side ? [{ n: 'Daichi', t: 'Three crates. Not a scratch. Here is ¥250.' }, { n: 'Jun', t: 'Thank you.' }]
    : [{ n: 'Daichi', t: 'Not bad for a first shift. Here is ¥500.' }, { n: 'Jun', t: 'The red ledger?' }, { n: 'Daichi', t: 'Kita Shipping. Warehouse 08. The freight board on Warehouse 03 has the cargo pass.' }, { n: 'Daichi', t: 'Watch yourself. Someone else asked about that ledger.' }, { n: 'Daichi', t: 'And when this is over, come back. The lads race the forklift round the yard after hours. The Yard Run.' }],
  () => { saveGame(); updateHUD(); if (!side && !(G.sideNews & 1)) { G.sideNews |= 1; toast('SIDE JOB', 'The Yard Run', 'Ask Daichi to time a lap around the quay.'); } }, npc('daichi'));
}

/* ------------------------------------------------------------------ new: the Yard Run */

function yardRunTalk(a) {
  if (sideShift) { talk([{ n: 'Daichi', t: 'Finish the crates first. The run can wait.' }], null, a); return; }
  talk([{ n: 'Daichi', t: 'The Yard Run. Nine gates around the quay, in order, and back to me.' },
    { n: 'Daichi', t: G.runBest ? 'Your best is ' + fmtTime(G.runBest) + '. Under ' + RUN_PAR.gold + ' seconds earns the gold stamp.' : 'Under ' + RUN_PAR.silver + ' seconds earns silver. Under ' + RUN_PAR.gold + ', gold. I pay for new stamps.' }],
  null, a, [{ text: 'Start the run.', fn: () => fadeTo(startYardRun) }, { text: 'Not now.', fn: () => {} }]);
}
function startYardRun() {
  if (forklift.carry !== null) { const c = crates[forklift.carry]; c.x = crateOrigins[c.id].x; c.z = crateOrigins[c.id].z; }
  forklift.x = RUN_START.x; forklift.z = RUN_START.z; forklift.yaw = RUN_START.yaw; forklift.speed = 0; forklift.carry = null; forklift.bumpT = 0;
  race = { phase: 'count', t: 3.4, beep: 4, gate: 0, time: 0 };
  player.walk = 0; player.y = 0; player.x = forklift.x; player.z = forklift.z;
  setMode('forklift'); setPips(RUN_GATES.length); setText($('taskKicker'), 'YARD RUN / NINE GATES');
  camYaw = forklift.yaw; camManual = 0; camZoom = 7;
  set3(camEye, forklift.x + Math.sin(camYaw) * 7, 4.1, forklift.z + Math.cos(camYaw) * 7); set3(camTarget, forklift.x, 1.25, forklift.z);
  show('countdown'); setText($('countdown'), '3'); updateHUD();
}
function finishYardRun() {
  const time = race.time; race.phase = 'done';
  const medal = time < RUN_PAR.gold ? 3 : time < RUN_PAR.silver ? 2 : 1;
  const best = !G.runBest || time < G.runBest; if (best) G.runBest = time;
  G.runs = (G.runs || 0) + 1;
  let pay = 0;
  if (medal > (G.runMedal || 0)) { pay = MEDAL_PAY[medal] - MEDAL_PAY[G.runMedal || 0]; G.runMedal = medal; }
  G.cash += pay;
  sound.sfx('success'); input.rumble(.5, 220); saveGame(true);
  fadeTo(() => {
    endYardRun(false);
    openModal(fmtTime(time) + '.', 'YARD RUN / ' + MEDALS[medal] + ' STAMP',
      '<p>' + (best ? 'A new best time.' : 'Your best: <strong>' + fmtTime(G.runBest) + '</strong>.') + (pay ? ' Daichi counts out <strong>¥' + pay + '</strong>.' : '') + '</p><p>Gold under ' + RUN_PAR.gold + ' seconds. Silver under ' + RUN_PAR.silver + '.</p>',
      [{ text: 'Run it again', fn: () => fadeTo(startYardRun) }, { text: 'Back to the harbour', fn: () => {} }]);
  });
}
function endYardRun(abandon, quiet = false) {
  race = null; show('countdown', false);
  forklift.x = RUN_START.x; forklift.z = RUN_START.z; forklift.yaw = 0; forklift.speed = 0; forklift.carry = null;
  player.x = -6.8; player.z = 4; player.y = 0; player.yaw = .55; camYaw = .5; camZoom = 3.6;
  if (quiet) return;
  setMode('roam');
  if (abandon) toast('YARD RUN', 'Run abandoned', 'Ask Daichi when you want another go.');
  saveGame(true);
}
function updateRace(dt) {
  if (race.phase === 'count') {
    race.t -= dt;
    const n = Math.ceil(race.t);
    if (n < race.beep && n >= 1 && n <= 3) { race.beep = n; sound.sfx('count'); setText($('countdown'), String(n)); show('countdown'); }
    if (race.t <= 0) { race.phase = 'run'; sound.sfx('go'); input.rumble(.3, 90); setText($('countdown'), 'GO'); goUntil = worldTime + .7; }
    return;
  }
  if (race.phase !== 'run') return;
  race.time += dt;
  const g = RUN_GATES[race.gate];
  if (Math.hypot(forklift.x - g[0], forklift.z - g[1]) < 2.8) {
    race.gate++; sound.sfx('gate'); input.rumble(.2, 60);
    if (race.gate >= RUN_GATES.length) finishYardRun();
  }
}

/* ------------------------------------------------------------------ places to examine */

function inspectManifest() {
  if (G.stage < 4) talk([{ n: 'Jun', t: 'Cargo codes. No names. Daichi should know which one I need.' }], null, { x: 14, z: -5.4, yaw: 0 });
  else if (G.stage === 4) talk([{ n: 'Jun', t: 'Kita Shipping. Red ledger. Warehouse 08.' }, { n: 'Jun', t: 'The cargo pass is still here.' }, { n: 'Courier', t: 'Looking for this?' }], () => startChase(), { x: 14, z: -5.4, yaw: 0 });
  else talk([{ n: 'Jun', t: 'Warehouse 08. I have the right address.' }], null, { x: 14, z: -5.4, yaw: 0 });
}
function inspectDoor() {
  if (G.stage < 6) {
    // The fight now follows the line instead of cutting it off before it can be read.
    const fight = G.stage === 5 && !enemies.length;
    talk([{ n: 'Jun', t: G.stage === 5 ? 'Those men have the cargo pass. I need it before I can go inside.' : 'The door is locked. I need the cargo pass from the freight office.' }], fight ? () => battleIntro() : null, { x: 15.7, z: -28 });
  } else if (G.stage === 6) {
    const keeper = { x: 14.8, z: -28, yaw: PI / 2, coat: '#4a6266', pants: '#3c4d50', hair: '#bcb9a0', name: 'Enomoto' };
    talk([{ n: 'Enomoto', t: 'Kisaragi. I knew you would come.' }, { n: 'Jun', t: 'Where is my father?' }, { n: 'Enomoto', t: 'He left this ledger with me. He said you would know what to do.' }, { n: 'Jun', t: 'A ferry ticket. Kobe. Tomorrow at six.' }, { n: 'Enomoto', t: 'His last shipment was not cargo. It was someone who needed to leave.' }, { n: 'Jun', t: 'Then he is alive.' }, { n: 'Enomoto', t: 'Read his letter on the ship. Tonight, go home. You have done enough.' }, { n: 'Jun', t: 'Thank you. I will.' }], () => completeChapter(), keeper);
  } else talk([{ n: 'Jun', t: 'The ledger is safe. The ferry leaves tomorrow. There is still time for tea.' }]);
}
function interact() {
  if (mode === 'forklift') { forkAction(); return; }
  if (mode !== 'roam') return;
  const a = interactable; if (!a) return;
  sound.sfx('click');
  if (a.kind === 'person') choosePerson(a.ref);
  else if (a.id === 'forklift') enterForklift();
  else if (a.id === 'board') inspectManifest();
  else if (a.id === 'door') inspectDoor();
  else if (a.id === 'vending') talk([{ n: 'Jun', t: 'A cold drink. Which one?' }], null, { x: -14.2, z: 24 }, [{ text: 'Sun Pop orange — ¥100', fn: () => buyDrink('The orange soda is cold. That helps.') }, { text: 'Black coffee — ¥100', fn: () => buyDrink('It is bitter. Father liked it this way.') }, { text: 'Barley tea — ¥100', fn: () => buyDrink('A quiet moment by the water.') }, { text: 'Keep my money.', fn: () => {} }]);
  else if (a.id === 'capsule') talk([{ n: 'Jun', t: 'Pocket Port. A capsule toy costs ¥100.' }], null, { x: -11.3, z: 24 }, [{ text: 'Turn the handle — ¥100', fn: () => buyToy() }, { text: 'Not today.', fn: () => {} }]);
  else if (a.id === 'cat') {
    sound.sfx('meow');
    if (G.catFed) talk([{ n: 'Jun', t: 'You look better. Stay out of the rain, all right?' }]);
    else if (G.hasBun) talk([{ n: 'Jun', t: 'Here. Hana said to share.' }], () => { G.catFed = true; G.hasBun = false; saveGame(); sound.sfx('meow'); toast('A SMALL MOMENT', 'A friend at the harbour', 'The little cat will remember you.'); });
    else talk([{ n: 'Jun', t: 'You are hungry. Hana might have something for you.' }]);
  } else if (a.id === 'darts') talk([{ n: 'Jun', t: 'Three darts for ¥50. A score of 60 earns ¥150. A score of 100 earns ¥250.' }], null, { x: -27, z: 20.2 }, [{ text: 'Play — ¥50', fn: () => purchase(50, () => startDarts()) }, { text: 'Not now.', fn: () => {} }]);
  else if (a.id === 'bus') talk([{ n: 'Jun', t: 'The next bus is in fifteen minutes. I could rest here.' }], null, null, [{ text: 'Wait fifteen minutes.', fn: () => { G.clock = Math.min(G.clock + 15, 1125); player.health = 100; toast('A QUIET MOMENT', 'The sea breeze is cold', 'Fifteen minutes pass.'); saveGame(); updateHUD(); } }, { text: 'Keep looking.', fn: () => {} }]);
}
function buyDrink(text) { purchase(100, () => { player.health = 100; G.drinks++; sound.sfx('soda'); talk([{ n: 'Jun', t: text }], () => { toast('A SMALL MOMENT', 'Health restored', 'Some things are worth slowing down for.'); saveGame(); updateHUD(); }); }); }
function toySVG(id, size = 38) {
  const common = 'width="' + size + '" height="' + size + '" viewBox="0 0 60 60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
  const shapes = ['<path d="M8 39V29h19v12H8zm12-10V15h17v25m0-25h5v29h9M22 16v12h14"/><circle cx="14" cy="43" r="5"/><circle cx="31" cy="43" r="5"/>', '<path d="M5 36h50l-8 12H16zM17 34V21h23v14m-13-14V11h8v10M7 52q6-6 12 0t12 0t12 0t12 0"/><path d="M21 26h4m6 0h4"/>', '<path d="M5 26q17-22 25 1q13-22 26-1q-18-8-23 10l9 11-13-5-10 5 5-12Q16 23 5 26z"/>', '<path d="M16 27q-8 22 13 22t13-22H16zm9-3h10M17 33L7 25l3 15 7 2m26-10q16-8 10 6l-9 7M22 20q-9-14 7-13t11 13"/>', '<path d="M12 50h17M16 50l3-37h7l2 37m-8-35L53 7v8H9l11-8v6m30 3v20h-5m-25-7 7 8-9 8m3-26 5 8-7 7"/>', '<path d="M17 33q-4-14 4-19l7 7h6l8-7q10 12 2 22l-5 13H19zm26 7q20 12 11-7"/><path d="M23 29h1m12 0h1m-8 5h4M23 47v-8m12 8v-8"/>'];
  return '<svg ' + common + '>' + shapes[id] + '</svg>';
}
function buyToy() {
  purchase(100, () => {
    const id = Math.floor(Math.random() * 6), isNew = !G.toys[id];
    G.toys[id] = (G.toys[id] || 0) + 1; saveGame(); sound.sfx('success');
    openModal(toyNames[id], isNew ? 'A NEW POCKET PORT TOY' : 'ANOTHER LITTLE TREASURE', '<div style="text-align:center;color:#d9b978;padding:10px">' + toySVG(id, 100) + '</div><p style="text-align:center">' + (isNew ? 'A small piece of the harbour.' : 'You have ' + G.toys[id] + ' of this toy now.') + '</p>', [{ text: 'Put it in my pocket', fn: () => {} }]);
  });
}
function completeChapter() { G.clock = Math.max(G.clock, 1048); stageTo(7); saveGame(); showEnding(); }
function showEnding() {
  setMode('ending'); show('ending'); sound.sfx('success');
  $('endTime').textContent = formatDuration(G.elapsed);
  $('endExtras').textContent = [G.catFed, G.drinks > 0, G.dartsPlayed > 0].filter(Boolean).length + ' / 3';
  menuOpened($('ending'));
}
function formatDuration(s) { s = Math.floor(s); return Math.floor(s / 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0'); }
function fmtTime(s) { const t = Math.max(0, Math.floor(s * 10)), m = Math.floor(t / 600), sec = Math.floor(t / 10) % 60; return m + ':' + String(sec).padStart(2, '0') + '.' + (t % 10); }

/* ------------------------------------------------------------------ the chase */

const chaseSteps = [{ code: 'up', action: 'VAULT', lead: 'OVER THE PALLET' }, { code: 'right', action: 'TURN', lead: 'TAKE THE RIGHT TURN' }, { code: 'duck', action: 'DUCK', lead: 'UNDER THE LOADING BOOM' }];
const chasePath = [[10, -8], [6, -15], [10, -21], [3, -29]];
function startChase() { sound.stopSpeech(); qte = { step: 0, time: 0, phase: 'ready', travel: 0, phaseTime: 0 }; player.x = 10; player.z = -8; player.y = 0; player.walk = 1; player.phase = 0; camYaw = .2; setMode('qte'); paintQTE(); }
function paintQTE() {
  if (!qte) return;
  const s = chaseSteps[Math.min(qte.step, 2)], key = K(s.code);
  setText($('qteKey'), qte.phase === 'ready' ? '…' : qte.phase === 'pass' ? '✓' : key);
  setStyle($('qteKey'), 'fontSize', key.length > 2 && qte.phase === 'prompt' ? '25px' : '57px');
  setText($('qteAction'), qte.phase === 'ready' ? 'GET READY' : qte.phase === 'pass' ? 'GOOD' : s.action);
  setText($('qteLead'), s.lead);
  setText($('qteCount'), String(qte.step + 1).padStart(2, '0') + ' / 03  ·  ' + (src() === 'touch' ? 'TAP THE CIRCLE' : 'PRESS THE SHOWN ' + (src() === 'gamepad' ? 'BUTTON' : 'KEY')));
  setStyle($('qteCircle'), 'borderColor', qte.phase === 'pass' ? '#a9c49a' : '#ded6b7');
}
function qtePress(code) {
  if (!qte || mode !== 'qte' || qte.phase !== 'prompt') return;
  if (code === chaseSteps[qte.step].code) { qte.phase = 'pass'; qte.phaseTime = 0; sound.sfx('qte'); input.rumble(.25, 70); paintQTE(); }
  else failChase('That was the wrong turn.');
}
function failChase(why) {
  player.y = 0; player.walk = 0; qte = null; sound.sfx('fail'); input.rumble(.5, 200); setMode('roam');
  const seq = src() === 'touch' ? 'Tap the circle as soon as each move appears.' : 'Press each ' + (src() === 'gamepad' ? 'button' : 'key') + ' when it appears. The sequence is <strong>' + K('up') + ', ' + K('right') + ', ' + K('duck') + '</strong>. You can also click the large circle.';
  openModal('He slipped away.', 'QUICK TIME EVENT', '<p>' + why + '</p><p>' + seq + '</p><div class="modalHint">Options → Relaxed timing gives you more time.</div>', [{ text: 'Try the chase again', fn: () => startChase() }, { text: 'Return to the freight board', fn: () => { player.x = 12.6; player.z = -5.4; camYaw = -PI / 2; } }], false);
}
function updateChase(dt) {
  if (!qte) return;
  qte.time += dt; qte.phaseTime += dt;
  const max = options.relaxed ? 4.7 : 2.8;
  if (qte.phase === 'ready' && qte.phaseTime > .65) { qte.phase = 'prompt'; qte.phaseTime = 0; sound.sfx('qte'); paintQTE(); }
  if (qte.phase === 'prompt') { setStyle($('qteCircle'), '--progress', (100 * (1 - qte.phaseTime / max)).toFixed(1) + '%'); if (qte.phaseTime > max) { failChase('The courier reached the next alley.'); return; } }
  if (qte.phase === 'pass') {
    setStyle($('qteCircle'), '--progress', '100%');
    if (qte.phaseTime > .65) {
      qte.step++;
      if (qte.step >= 3) { qte = null; player.y = 0; G.qteWins++; stageTo(5); fadeTo(() => battleIntro()); return; }
      qte.phase = 'ready'; qte.phaseTime = 0; paintQTE();
    }
  }
  const fraction = qte.phase === 'pass' ? .72 + qte.phaseTime * .43 : qte.phase === 'ready' ? .12 : qte.phaseTime / max * .5 + .2;
  const goal = (qte.step + clamp(fraction, 0, 1)) / 3;
  qte.travel = mix(qte.travel, goal, Math.min(1, dt * 5));
  const seg = Math.min(2, Math.floor(qte.travel * 3)), r = qte.travel * 3 - seg, a = chasePath[seg], b = chasePath[seg + 1];
  player.x = mix(a[0], b[0], r); player.z = mix(a[1], b[1], r); player.yaw = Math.atan2(a[0] - b[0], a[1] - b[1]); player.walk = 1; player.phase += dt * 11;
  player.y = qte.step === 0 && qte.phase === 'pass' ? Math.sin(qte.phaseTime / .65 * PI) * .78 : 0;
}
const QTE_DIRS = ['up', 'right', 'down', 'left'];
function qteDirs() { const mv = input.vector('move'); return { up: mv.y > .55, down: mv.y < -.55, right: mv.x > .55, left: mv.x < -.55 }; }
function qteInput() {
  // Each direction counts when it goes down, so D still registers while W is held, and a
  // direction held from before the prompt has to be pressed again.
  const now = qteDirs(), fresh = QTE_DIRS.filter(d => now[d] && !qteDir[d]);
  qteDir = now;
  if (fresh.length && qte) { const want = chaseSteps[Math.min(qte.step, 2)].code; qtePress(fresh.includes(want) ? want : fresh[0]); }
  if (input.pressed('duck')) qtePress('duck');
}

/* ------------------------------------------------------------------ fights: the story battle and the new sparring */

const FOES = {
  dock: { name: 'Dock hand', health: 74, coat: '#826e5c', pants: '#4c595b', hair: '#363730', dmg: 13, soft: 10, coolBase: 1.3, cool: .9, side: -.12, x: -2, z: -32.2, phase: 0 },
  lookout: { name: 'Lookout', health: 82, coat: '#536773', pants: '#454e51', hair: '#3d3027', dmg: 16, soft: 10, coolBase: 1.9, cool: 1.8, side: .12, x: 5.2, z: -33, phase: 2 },
  genji: { name: 'Genji', health: 80, coat: '#826e5c', pants: '#4c595b', hair: '#363730', dmg: 13, soft: 9, coolBase: 1.25, cool: 1, side: -.12, x: -2, z: -32.2, phase: 0 },
  taro: { name: 'Taro', health: 86, coat: '#536773', pants: '#454e51', hair: '#3d3027', dmg: 15, soft: 10, coolBase: 1.8, cool: 1.9, side: .12, x: 5.2, z: -33, phase: 2 },
  sho: { name: 'Sho', health: 150, coat: '#5f6b57', pants: '#3a4441', cap: '#9b4a36', hair: '#2f2b26', dmg: 19, soft: 12, coolBase: 1.45, cool: 1.4, side: 0, x: 2, z: -35.5, phase: 1, scale: 1.12, charger: true }
};
const SPAR_ROUNDS = [['genji'], ['genji', 'taro'], ['sho']];
function makeFoe(kind, id) {
  const f = FOES[kind];
  return { id, kind, name: f.name, x: f.x, z: f.z, yaw: PI, health: f.health, maxHealth: f.health, coat: f.coat, pants: f.pants, hair: f.hair, cap: f.cap, scale: f.scale, dmg: f.dmg, soft: f.soft, coolBase: f.coolBase, side: f.side, charger: !!f.charger, walk: 0, phase: f.phase, cool: f.cool, wind: 0, attackTime: 0, attackKind: 'punch', attackHit: false, hit: 0, dead: false, block: false, charge: null, nextCharge: 1.8, retreat: 0 };
}
function makeEnemies() { return [makeFoe('dock', 0), makeFoe('lookout', 1)]; }
function battleIntro(resume = false) {
  setMode('roam'); player.x = 1.5; player.z = -27.3; player.y = 0; player.yaw = .1; enemies = makeEnemies(); camYaw = .08; camZoom = 6.5;
  talk(resume ? [{ n: 'Jun', t: 'They still have the cargo pass. I have to get it back.' }] : [{ n: 'Courier', t: 'You want that pass? Talk to them.' }, { n: 'Dock hand', t: 'The ledger is not yours to take.' }, { n: 'Jun', t: 'It belongs to my father. Step aside.' }],
    () => openModal('Stand your ground.', 'FREE BATTLE', '<p><strong>' + K('punch') + '</strong> punches. <strong>' + K('kick') + '</strong> kicks. Hold <strong>' + K('guard') + '</strong> to guard. Use <strong>' + K('evade') + '</strong> to step back and evade.</p><p>A red warning marks an incoming strike. Guard, then answer with a kick. Three quick punches make a combo.</p><div class="modalHint">' + K('move') + ' / MOVE &nbsp; · &nbsp; ATTACKS FACE THE NEAREST OPPONENT<br>A loss restarts this fight. Your story progress stays safe.</div>', [{ text: 'Ready', fn: () => beginBattle() }], false), enemies[0]);
}
function resetFighter() {
  player.x = 1.5; player.z = -27.3; player.y = 0; player.walk = 0; player.attackTime = 0; player.cool = 0; player.invuln = .4; player.hit = 0; player.evadeCool = 0; player.dead = false; player.combo = 0; player.comboTime = 0; player.block = false; player.yaw = .1;
  camYaw = .08; camZoom = 7.5; camManual = 0; battleWinDelay = 0;
}
function beginBattle() {
  if (spar) { fadeTo(startSpar); return; }
  enemies = makeEnemies(); player.health = 100; resetFighter();
  setMode('combat'); buildEnemyBars(); setText($('fightTitle'), 'FREE BATTLE / THE LOADING YARD'); updateHUD();
}
function sparIntro() {
  openModal('Three rounds.', 'SPARRING / THE LOADING YARD', '<p>Round one: Genji. Round two: Genji and Taro together. Round three: Sho, the crane hand.</p><p>Sho drops his shoulder and charges when a <strong>red ring</strong> shows at his feet. A guard will not stop it. Step aside with <strong>' + K('evade') + '</strong>, then hit him while he stumbles.</p><div class="modalHint">You get your breath back between rounds. A loss ends the match. Nothing else is lost.</div>', [{ text: 'Begin the match', fn: () => fadeTo(startSpar) }, { text: 'Not yet', fn: () => {} }]);
}
function startSpar() { spar = { round: 0, time: 0 }; player.health = 100; setupSparRound(); }
function setupSparRound() {
  enemies = SPAR_ROUNDS[spar.round].map((k, i) => makeFoe(k, i));
  resetFighter(); setMode('combat'); buildEnemyBars();
  setText($('fightTitle'), 'SPARRING / ROUND ' + (spar.round + 1) + ' OF 3'); updateHUD();
  toast('SPARRING', 'Round ' + (spar.round + 1) + ' of 3', enemies.map(e => e.name).join(' and ') + (spar.round === 2 ? '. Watch for the red ring.' : '.'));
  toastUntil = worldTime + 2.6;
}
function finishSpar() {
  const time = spar.time, first = !G.sparClears;
  G.sparClears = (G.sparClears || 0) + 1;
  const best = !G.sparBest || time < G.sparBest; if (best) G.sparBest = time;
  const pay = first ? 300 : 60; G.cash += pay;
  sound.sfx('success'); input.rumble(.5, 220); saveGame(true);
  fadeTo(() => {
    spar = null; enemies = []; player.health = 100; player.attackTime = 0; player.block = false; player.walk = 0; player.x = 1.5; player.z = -27.3; camZoom = 3.6;
    setMode('roam');
    openModal('Three rounds.', 'SPARRING / CLEARED', '<p>Sho sits down on a crate and laughs. ' + (first ? 'Genji hands you the pot: <strong>¥' + pay + '</strong>.' : 'Genji tosses you <strong>¥' + pay + '</strong> for the show.') + '</p><p>Time ' + fmtTime(time) + (best ? ' — a new best.' : ' · best ' + fmtTime(G.sparBest) + '.') + '</p>',
      [{ text: 'Another match', fn: () => fadeTo(startSpar) }, { text: 'Back to the harbour', fn: () => {} }]);
  });
}
function leaveSpar() { spar = null; enemies = []; player.health = 100; player.dead = false; player.walk = 0; player.attackTime = 0; player.block = false; player.x = 1.5; player.z = -27.3; camZoom = 3.6; setMode('roam'); }
function buildEnemyBars() {
  $('enemyBars').innerHTML = enemies.map((e, i) => '<div class="health"><i id="enemyHP' + i + '"></i></div>').join('');
  for (const k of [...styleCache.keys()]) if (k.startsWith('enemyHP')) styleCache.delete(k);
}
function nearestEnemy() { let best = null, d = Infinity; for (const e of enemies) if (e.health > 0) { const dd = dist(e, player); if (dd < d) { best = e; d = dd; } } return best; }
function playerAttack(kind) {
  if (mode !== 'combat' || player.cool > 0 || player.attackTime > 0 || player.dead) return;
  const e = nearestEnemy(); if (!e) return;
  player.yaw = Math.atan2(player.x - e.x, player.z - e.z); player.attackKind = kind;
  player.attackTime = kind === 'kick' ? .56 : .42; player.cool = kind === 'kick' ? .8 : .44; player.attackHit = false; player.block = false;
  if (kind === 'punch') { player.combo = player.comboTime > 0 ? (player.combo % 3) + 1 : 1; player.comboTime = 1.45; } else player.combo = 0;
  sound.sfx('swing');
}
function evade() {
  if (mode !== 'combat' || player.evadeCool > 0 || player.dead) return;
  player.evadeCool = 1.0; player.invuln = .65; player.attackTime = 0; player.walk = 0;
  const e = nearestEnemy();
  if (e) { const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz) || 1; tryMove(player, dx / d * 1.35, dz / d * 1.35, .34, true); }
  sound.sfx('swing'); toast(spar ? 'SPARRING' : 'FREE BATTLE', 'A step out of reach', ''); toastUntil = worldTime + .7;
}
function damageEnemy(e, amount, kick = false) {
  const c = e.charge;
  if (c && c.phase === 'recover') amount *= 1.35; // punish the stumble
  else if (c) amount *= .5;                      // a charging shoulder shrugs off blows
  e.health = Math.max(0, e.health - amount);
  sound.sfx(kick ? 'kick' : 'punch'); screenShake = kick ? .15 : .08; input.rumble(kick ? .45 : .25, kick ? 110 : 70);
  if (!c || c.phase === 'recover') {
    e.hit = .28; e.wind = 0; e.attackTime = 0; e.cool = .55;
    const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz) || 1;
    tryMove(e, dx / d * (kick ? .68 : .28), dz / d * (kick ? .68 : .28), .33, true);
  }
  if (e.health <= 0) { e.dead = true; e.walk = 0; e.charge = null; e.block = false; e.wind = 0; }
}
function damagePlayer(amount, e, charge = false) {
  if (player.invuln > 0 || player.dead) return;
  const block = player.block;
  const actual = block ? Math.ceil(amount * (charge ? .55 : .15)) : amount;
  player.health = Math.max(0, player.health - actual);
  player.hit = block && !charge ? .10 : .32; player.invuln = block ? .12 : .4; damageAlpha = block ? .15 : .55; screenShake = block ? .04 : charge ? .26 : .18;
  sound.sfx(block ? 'block' : charge ? 'thud' : 'punch'); input.rumble(block ? .2 : charge ? .8 : .55, block ? 60 : 160);
  if (!block || charge) { const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz) || 1, k = charge ? 1.1 : .3; tryMove(player, dx / d * k, dz / d * k, .34, true); player.attackTime = 0; }
  if (player.health <= 0) {
    player.dead = true; player.walk = 0; player.block = false;
    if (spar) openModal('Down, but not out.', 'SPARRING / ROUND ' + (spar.round + 1), '<p>' + (spar.round === 2 ? 'Sho offers a hand up. "Step aside when the ring turns red."' : 'Genji laughs. "Guard the first one. Then make them pay."') + '</p><p>A new match starts from round one.</p>', [{ text: 'Try the match again', fn: () => fadeTo(startSpar) }, { text: 'Leave the yard', fn: () => leaveSpar() }], false);
    else openModal('Back on your feet.', 'FREE BATTLE / RETRY', '<p>Guard while the red warning is visible. Then use a kick to make room.</p><p>Your story progress is safe. This restarts only the fight.</p>', [{ text: 'Try the fight again', fn: () => beginBattle() }, { text: 'Save and return to title', fn: () => goTitle() }], false);
  }
}
function updateCharge(e, dt, dx, dz, d) {
  const c = e.charge; c.t -= dt; e.walk = 0;
  if (c.phase === 'wind') {
    e.yaw += angdiff(e.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 9); e.block = true;
    if (c.t <= 0) { c.phase = 'run'; c.t = .62; c.dx = dx / d; c.dz = dz / d; e.block = false; e.yaw = Math.atan2(-c.dx, -c.dz); sound.sfx('swing'); }
  } else if (c.phase === 'run') {
    const step = 7.2 * dt, moved = tryMove(e, c.dx * step, c.dz * step, .34, true);
    e.walk = 1; e.phase += dt * 14;
    if (!c.hit && Math.hypot(player.x - e.x, player.z - e.z) < 1.05) { c.hit = true; damagePlayer(options.relaxed ? 16 : 24, e, true); }
    if (c.t <= 0 || moved < step * .3) { c.phase = 'recover'; c.t = .95; e.hit = .3; sound.sfx('thud'); screenShake = Math.max(screenShake, .06); }
  } else {
    e.hit = Math.max(e.hit, .12);
    if (c.t <= 0) { e.charge = null; e.cool = .6; }
  }
}
function updateBattle(dt) {
  player.cool = Math.max(0, player.cool - dt); player.invuln = Math.max(0, player.invuln - dt); player.evadeCool = Math.max(0, player.evadeCool - dt); player.hit = Math.max(0, player.hit - dt); player.comboTime = Math.max(0, player.comboTime - dt);
  if (spar) spar.time += dt;
  player.block = input.down('guard') && player.attackTime <= 0 && !player.dead;
  if (input.down('punch')) playerAttack('punch'); else if (input.down('kick')) playerAttack('kick');
  updatePlayer(dt, true);
  if (player.attackTime > 0) {
    player.attackTime = Math.max(0, player.attackTime - dt);
    if (!player.attackHit && player.attackTime < .27) {
      player.attackHit = true;
      const e = nearestEnemy(), range = player.attackKind === 'kick' ? 2.7 : 2.12;
      if (e && dist(e, player) < range * (e.scale || 1)) damageEnemy(e, player.attackKind === 'kick' ? 23 : player.combo === 3 ? 23 : 14, player.attackKind === 'kick' || player.combo === 3);
    }
  }
  for (const e of enemies) {
    if (e.health <= 0) continue;
    e.hit = Math.max(0, e.hit - dt); e.cool = Math.max(0, e.cool - dt);
    const dx = player.x - e.x, dz = player.z - e.z, d = Math.hypot(dx, dz) || .01;
    if (e.charge) { updateCharge(e, dt, dx, dz, d); if (mode !== 'combat') return; continue; }
    e.yaw += angdiff(e.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 7); e.walk = 0;
    if (e.charger) e.nextCharge = Math.max(0, e.nextCharge - dt);
    if (e.attackTime > 0) {
      e.attackTime = Math.max(0, e.attackTime - dt);
      if (e.attackTime < .24 && !e.attackHit) { e.attackHit = true; if (d < 2.3 * (e.scale || 1)) { damagePlayer(options.relaxed ? e.soft : e.dmg, e); if (mode !== 'combat') return; } }
    } else if (e.wind > 0) {
      e.wind -= dt;
      if (e.wind <= 0) { e.attackTime = .42; e.attackHit = false; e.cool = e.coolBase; }
    } else if (e.charger && e.nextCharge <= 0 && e.cool <= 0 && player.health > 0) {
      // Sho backs off to get a run-up, then charges (from wherever he is if he gets cornered).
      if (d > 2.4 || e.retreat > 1.2) { e.charge = { phase: 'wind', t: options.relaxed ? 1.3 : .9, hit: false }; e.retreat = 0; e.nextCharge = 5.5; sound.sfx('charge'); }
      else { e.retreat += dt; tryMove(e, -dx / d * 1.6 * dt, -dz / d * 1.6 * dt, .34, true); e.walk = .6; e.phase += dt * 6; }
    } else if (d > 1.65 * (e.scale || 1)) {
      const speed = 1.35, side = e.side;
      let nx = (dx / d + dz / d * side) * speed * dt, nz = (dz / d - dx / d * side) * speed * dt;
      for (const other of enemies) if (other !== e && other.health > 0 && Math.hypot(e.x + nx - other.x, e.z + nz - other.z) < .75) { nx += (e.x - other.x) * dt; nz += (e.z - other.z) * dt; }
      tryMove(e, nx, nz, .34, true); e.walk = .7; e.phase += dt * 6;
    } else if (e.cool <= 0 && player.health > 0) { e.wind = options.relaxed ? 1.05 : .72; e.attackHit = false; }
  }
  if (enemies.every(e => e.health <= 0)) {
    battleWinDelay += dt;
    if (battleWinDelay > 1.3) {
      battleWinDelay = -99;
      if (!spar) finishBattle();
      else if (spar.round < SPAR_ROUNDS.length - 1) { spar.round++; player.health = Math.min(100, player.health + 35); sound.sfx('success'); fadeTo(setupSparRound); }
      else finishSpar();
    }
  }
}
function finishBattle() {
  player.attackTime = 0; player.walk = 0; player.block = false; G.battleWon = true; stageTo(6);
  // The two men get back up to talk (they used to deliver their lines lying on the ground) and then leave.
  for (const e of enemies) { e.dead = false; e.hit = 0; e.walk = 0; e.wind = 0; e.attackTime = 0; }
  setMode('roam'); camZoom = 3.6;
  talk([{ n: 'Dock hand', t: 'All right. Take the pass.' }, { n: 'Jun', t: 'Warehouse 08?' }, { n: 'Dock hand', t: 'The old man is waiting. Just leave us alone.' }, { n: 'Jun', t: 'I see.' }], () => { enemies = []; saveGame(); toast('POCKET', 'Stamped cargo pass', 'The door to Warehouse 08 is open to you.'); }, enemies[0]);
}

/* ------------------------------------------------------------------ darts */

const dartOrder = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
function startDarts() {
  darts = { aimX: 310, aimY: 310, sightX: 310, sightY: 310, throws: [], scores: [], cool: 0, doneWait: 0 };
  setMode('darts'); show('dartsOverlay');
  $('dartScore').textContent = '000'; $('dartStat').textContent = 'THROW 1 OF 3'; $('dartMessage').textContent = 'A steady hand. A little luck.';
  for (let i = 0; i < 3; i++) $('throw' + i).textContent = '—';
  setText($('dartHelp'), src() === 'gamepad' ? 'Aim with the left stick. A throws. B leaves.' : src() === 'touch' ? 'Touch the board to aim and throw.' : 'Move the mouse or use W A S D to aim. Space or a click throws.');
  drawDarts();
}
function dartValue(x, y) {
  const dx = x - 310, dy = y - 310, r = Math.hypot(dx, dy);
  if (r > 225) return { value: 0, name: 'Miss' };
  if (r < 10) return { value: 50, name: 'Bullseye' };
  if (r < 23) return { value: 25, name: 'Outer bull' };
  const a = (Math.atan2(dx, -dy) + PI / 20 + TAU) % TAU, i = Math.floor(a / (TAU / 20)) % 20, n = dartOrder[i], m = r > 209 ? 2 : r >= 128 && r <= 143 ? 3 : 1;
  return { value: n * m, name: (m === 3 ? 'Triple ' : m === 2 ? 'Double ' : '') + n };
}
function throwDart() {
  if (mode !== 'darts' || !darts || darts.cool > 0 || darts.throws.length >= 3) return;
  const v = dartValue(darts.sightX, darts.sightY);
  darts.throws.push({ x: darts.sightX, y: darts.sightY }); darts.scores.push(v.value); darts.cool = .72;
  sound.sfx('dart'); input.rumble(.15, 40);
  $('throw' + (darts.throws.length - 1)).textContent = v.value; $('dartMessage').textContent = v.name.toUpperCase();
  const total = darts.scores.reduce((a, b) => a + b, 0);
  $('dartScore').textContent = String(total).padStart(3, '0');
  $('dartStat').textContent = darts.throws.length < 3 ? 'THROW ' + (darts.throws.length + 1) + ' OF 3' : 'THREE DARTS THROWN';
}
function leaveDarts() { show('dartsOverlay', false); darts = null; setMode('roam'); saveGame(true); }
function finishDarts() {
  const total = darts.scores.reduce((a, b) => a + b, 0), reward = total >= 100 ? 250 : total >= 60 ? 150 : 0;
  G.dartsPlayed++; G.bestDarts = Math.max(G.bestDarts, total); G.cash += reward;
  leaveDarts(); saveGame(); sound.sfx(reward ? 'success' : 'note');
  openModal(total + ' points.', reward ? 'A STEADY HAND' : 'LUCKY DARTS', '<p>' + (reward ? 'Hana puts ¥' + reward + ' on the counter. A good set of throws.' : 'A quiet game. The next one might go better.') + '</p><p>Your best score: <strong>' + G.bestDarts + '</strong>.</p>', [{ text: 'Return to the harbour', fn: () => {} }, { text: 'Play again — ¥50', fn: () => purchase(50, () => startDarts()) }]);
}
function updateDarts(dt) {
  if (!darts) return;
  darts.cool = Math.max(0, darts.cool - dt);
  const axis = input.vector('move');
  darts.aimX = clamp(darts.aimX + axis.x * dt * 180, 45, 575); darts.aimY = clamp(darts.aimY - axis.y * dt * 180, 45, 575);
  darts.sightX = darts.aimX + Math.sin(worldTime * 2.7) * 9 + Math.sin(worldTime * 5.3) * 3; darts.sightY = darts.aimY + Math.cos(worldTime * 2.1) * 9 + Math.sin(worldTime * 4.2) * 3;
  if (darts.throws.length >= 3) { darts.doneWait += dt; if (darts.doneWait > 1.35) finishDarts(); }
}
const dartCtx = $('dartCanvas').getContext('2d');
function drawDarts() {
  if (!darts) return;
  const c = dartCtx;
  c.clearRect(0, 0, 620, 620); c.fillStyle = '#172e30'; c.beginPath(); c.arc(310, 310, 286, 0, TAU); c.fill(); c.strokeStyle = '#b7a77b'; c.lineWidth = 1; c.stroke(); c.beginPath(); c.arc(310, 310, 265, 0, TAU); c.stroke();
  const segment = (a, b, r1, r2, color) => { c.fillStyle = color; c.beginPath(); c.arc(310, 310, r2, a, b); c.arc(310, 310, r1, b, a, true); c.closePath(); c.fill(); c.strokeStyle = '#ddd5ad66'; c.lineWidth = .6; c.stroke(); };
  c.font = '22px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i < 20; i++) {
    const a = -PI / 2 - PI / 20 + i * TAU / 20, b = a + TAU / 20;
    segment(a, b, 23, 225, i % 2 ? '#d6d2b5' : '#2b4240'); segment(a, b, 209, 225, i % 2 ? '#63856e' : '#b65d46'); segment(a, b, 128, 143, i % 2 ? '#63856e' : '#b65d46');
    const ang = -PI / 2 + i * TAU / 20; c.fillStyle = '#e3d9b6'; c.fillText(dartOrder[i], 310 + Math.cos(ang) * 250, 310 + Math.sin(ang) * 250);
  }
  for (const [r, col] of [[23, '#5a8169'], [10, '#b3634d']]) { c.beginPath(); c.arc(310, 310, r, 0, TAU); c.fillStyle = col; c.fill(); c.strokeStyle = '#d7ccaa'; c.lineWidth = 1; c.stroke(); }
  c.fillStyle = '#a6bda9'; c.font = '9px Arial'; c.fillText('BREAKWATER TEA · NAGAMATSU', 310, 606);
  darts.throws.forEach((d, i) => { c.strokeStyle = '#0c2529'; c.lineWidth = 4; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x + 17, d.y - 30); c.stroke(); c.strokeStyle = '#d2c6a1'; c.lineWidth = 2; c.beginPath(); c.moveTo(d.x, d.y); c.lineTo(d.x + 20, d.y - 35); c.stroke(); c.fillStyle = ['#c98054', '#8bacad', '#d0b776'][i]; c.beginPath(); c.moveTo(d.x + 12, d.y - 30); c.lineTo(d.x + 19, d.y - 45); c.lineTo(d.x + 28, d.y - 30); c.lineTo(d.x + 21, d.y - 26); c.fill(); });
  if (darts.throws.length < 3) { const x = darts.sightX, y = darts.sightY; c.strokeStyle = '#f1e6b8'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.moveTo(x - 16, y); c.lineTo(x - 5, y); c.moveTo(x + 5, y); c.lineTo(x + 16, y); c.moveTo(x, y - 16); c.lineTo(x, y - 5); c.moveTo(x, y + 5); c.lineTo(x, y + 16); c.stroke(); }
}

/* ------------------------------------------------------------------ the notebook */

const TABS = ['leads', 'map', 'pocket', 'controls', 'options'];
function openBook(tab = 'leads') {
  if (mode === 'book') { renderBook(tab); return; }
  bookPrev = mode; sound.sfx('click'); setMode('book'); show('bookOverlay'); renderBook(tab); menuOpened($('bookOverlay'));
}
function closeBook() { show('bookOverlay', false); setMode(bookPrev); sound.sfx('click'); if (bookPrev === 'title') menuOpened($('titleScreen')); }
function switchTab(d) { const i = TABS.indexOf(currentTab); renderBook(TABS[(i + d + TABS.length) % TABS.length]); sound.sfx('click'); }
function renderBook(tab) {
  currentTab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  let h = '';
  if (tab === 'leads') {
    const history = [['Father\'s letter', 'A red ledger. A crate marked with a blue crane.'], ['The gate guard', 'Hana at Breakwater Tea knows the shipping companies.'], ['Hana\'s lead', 'Daichi moved the Kita shipment. Find the orange forklift.'], ['The foreman', 'Help Daichi move three crates to Warehouse 03.'], ['A day\'s work', 'The cargo pass is on the freight board at Warehouse 03.'], ['The courier', 'He took the pass. The loading yard is guarded.'], ['The cargo pass', 'Warehouse 08. An old man is waiting.'], ['The last shipment', 'Father is alive. The ferry to Kobe leaves at six.']];
    const list = history.slice(0, G.stage + 1).map((a, i) => '<li class="' + (i === G.stage ? 'current' : 'done') + '">' + a[1] + '</li>').join('');
    const sides = (G.stage >= 4 ? '<br>' + (G.runBest ? '✓ Yard Run: ' + fmtTime(G.runBest) + (G.runMedal ? ' · ' + MEDALS[G.runMedal].toLowerCase() + ' stamp' : '') : 'Daichi times forklift laps: the Yard Run.') : '') + (G.stage >= 6 ? '<br>' + (G.sparClears ? '✓ Sparring cleared ' + G.sparClears + '× · best ' + fmtTime(G.sparBest) : 'Genji spars at the loading yard after hours.') : '');
    h = '<div class="bookColumns"><div><h4>The last shipment</h4><h3>What I know.</h3><ul class="notes">' + list + '</ul></div><div><h4>My next step</h4><h3>' + leads[G.stage][0] + '</h3><p>' + leads[G.stage][1] + '</p><p>' + ['The guard stands just inside the east gate.', 'The tea shop is by the water. Look for its green awning.', 'The work yard is north of the tea shop.', 'The pickup crates have yellow marks. The drop bay is in front of the building marked 03.', 'The board is fixed to the west wall of Warehouse 03, below the blue freight sign.', 'Guard the first strike. Answer with a kick.', 'Follow the road north to the building marked 08.', 'Nothing else is urgent. Have a drink, feed the cat, or try a game of darts.'][G.stage] + '</p><button class="secondary" id="bookMapBtn">OPEN THE HARBOUR MAP</button><div style="margin-top:35px"><h4>Small moments</h4><p>' + (G.catFed ? '✓ The cat has eaten.' : 'The cat by the bench looks hungry.') + '<br>' + (G.drinks ? '✓ A drink by the water.' : 'I could stop for a drink.') + '<br>' + (G.dartsPlayed ? '✓ A game of darts.' : 'Hana has a dartboard by the shop.') + sides + '</p></div></div></div>';
  } else if (tab === 'map') h = '<div class="bookColumns"><div><h4>Nagamatsu / east quay</h4><canvas id="mapCanvas" width="460" height="460" aria-label="Map of the harbour. Your position is red. Your next lead is gold."></canvas><div class="mapLegend">● YOU &nbsp; ◇ NEXT LEAD &nbsp; ↑ NORTH</div></div><div><h4>My next step</h4><h3>' + leads[G.stage][0] + '</h3><p>' + leads[G.stage][1] + '</p><ul class="notes"><li>01 — East gate and tea shop</li><li>03 — Freight board and loading bay</li><li>08 — Old warehouse district</li></ul><p style="margin-top:22px">Keep the sea on your left to go north. The road links all three warehouses.</p><p>There is no time limit. The next lead will still be there.</p></div></div>';
  else if (tab === 'pocket') {
    const item = (icon, title, desc) => '<div class="item"><div class="itemIcon">' + icon + '</div><div><strong>' + title + '</strong><small>' + desc + '</small></div></div>';
    h = '<div class="bookColumns"><div><h4>Things worth keeping</h4><h3>In my pocket.</h3>' + item('¥', '¥' + G.cash.toLocaleString(), 'Daily allowance and work pay.') + item('✉', 'Father\'s letter', 'A harbour address. The ink is faint.') + (G.stage >= 4 ? item('▤', 'Kita cargo record', 'Warehouse 08. One red ledger.') : '') + (G.stage >= 6 ? item('▣', 'Stamped cargo pass', 'Permission to enter Warehouse 08.') : '') + (G.stage >= 7 ? item('▥', 'The red ledger', 'A ferry ticket rests between its pages.') : '') + (G.hasBun ? item('◒', 'A warm fish bun', 'For the cat by the bench.') : '') + (G.runMedal ? item('◈', 'Yard Run card', MEDALS[G.runMedal].toLowerCase() + ' stamp · best ' + fmtTime(G.runBest)) : '') + '</div><div><h4>Pocket Port / capsule toys</h4><h3>A little collection.</h3><p>' + Object.keys(G.toys).filter(k => G.toys[k] > 0).length + ' of 6 figures found. The machine is next to the red vending machine.</p><div class="toyGrid">' + toyNames.map((n, i) => '<div class="toy ' + (!G.toys[i] ? 'missing' : '') + '"><div class="toyArt">' + toySVG(i) + '</div><span>' + (G.toys[i] ? n + ' ×' + G.toys[i] : 'No. 0' + (i + 1)) + '</span></div>').join('') + '</div><p style="margin-top:22px">Best darts score: ' + G.bestDarts + '<br>Extra shifts worked: ' + G.sideShifts + (G.runs ? '<br>Yard Runs finished: ' + G.runs : '') + (G.sparClears ? '<br>Sparring matches won: ' + G.sparClears : '') + '</p></div></div>';
  } else if (tab === 'controls') h = controlsHTML();
  else if (tab === 'options') {
    const setting = (name, detail, id, label) => '<div class="setting"><div>' + name + '<small>' + detail + '</small></div><button id="' + id + '">' + label + '</button></div>';
    h = '<div class="bookColumns"><div><h4>Make yourself at home</h4><h3>Play your way.</h3>' + setting('Movement', 'Camera-relative or classic turning.', 'optTank', options.tank ? 'CLASSIC' : 'CAMERA') + setting('Lead markers', 'Show the next lead in the world.', 'optGuides', options.guides ? 'ON' : 'OFF') + setting('Relaxed timing', 'More time for chase prompts and enemy warnings, softer blows.', 'optRelaxed', options.relaxed ? 'ON' : 'OFF') + setting('Image size', '4:3 view. 640 × 480 is the Dreamcast picture; native uses your screen.', 'optQuality', IMAGE_NAMES[options.quality]) + setting('Shadows', 'Sun shadows for the harbour and its people.', 'optShadows', options.shadows ? 'ON' : 'OFF') + setting('Changing weather', 'Light rain during the afternoon.', 'optWeather', options.weather ? 'ON' : 'CLEAR') + setting('Display & controls', 'Quality, frame rate, touch layout, look speed, vibration.', 'optKit', 'OPEN') + '</div><div><h4>The sound of the port</h4><h3>Listen a little.</h3>' + setting('Sound', 'Music, waves, gulls, and work.', 'optMute', options.muted ? 'MUTED' : 'ON') + '<div class="setting"><div>Volume<small>Original, generated music and sound effects.</small></div><input type="range" id="optVolume" min="0" max="1" step=".05" aria-label="Volume" value="' + options.volume + '"></div>' + setting('Device voices', 'Use an installed English voice, when available.', 'optVoices', options.voices ? 'ON' : 'OFF') + '<div style="margin:20px 0"><button id="optFull" class="secondary">FULL SCREEN</button></div><h4>Sham-mue / credits</h4><p style="font-size:13px">An original harbour adventure inspired by Shenmue on Dreamcast. This is a tribute, not a port. It is not affiliated with SEGA.</p><p style="font-size:13px">Smooth character models, painted character maps, detailed surface maps, and a 640 × 480 game view. All code, art, and sound ship with the game; nothing loads from the network. Press V to hide the game display for a clear view. Visual reference: Shenmue Dreamcast screens at Shenmue Dojo and MobyGames; surface studies from Poly Haven. No game assets were extracted from Shenmue.</p><p style="font-size:12px">Progress saves in this browser. Private browsing or cleared site data can remove that save. Device voices are optional and depend on your system.</p></div></div>';
  }
  $('bookBody').innerHTML = h; $('bookBody').scrollTop = 0;
  setText($('bookFooterText'), tab === 'pocket' ? 'KEEP THE SMALL THINGS.' : tab === 'options' ? 'SHAM-MUE / THE LAST SHIPMENT' : 'LOOK CAREFULLY. ASK AGAIN.');
  setText($('bookCloseHint'), K('back') + ' / CLOSE');
  if (tab === 'leads') $('bookMapBtn').onclick = () => renderBook('map');
  if (tab === 'map') drawMap();
  if (tab === 'options') {
    const bind = (id, key, fn) => { $(id).onclick = () => { options[key] = fn ? fn(options[key]) : !options[key]; sound.init(); persistOptions(); renderBook('options'); sound.sfx('click'); if (document.body.classList.contains('kbd-nav')) $(id)?.focus(); }; };
    bind('optTank', 'tank'); bind('optGuides', 'guides'); bind('optRelaxed', 'relaxed'); bind('optQuality', 'quality', v => (v + 1) % IMAGE_LINES.length); bind('optShadows', 'shadows'); bind('optWeather', 'weather'); bind('optMute', 'muted'); bind('optVoices', 'voices');
    $('optVolume').oninput = e => { options.volume = Number(e.target.value); sound.init(); persistOptions(); };
    $('optVolume').onchange = e => e.target.blur();
    $('optFull').onclick = toggleFullscreen;
    $('optKit').onclick = () => kit.menu.open();
  }
}
function controlsHTML() {
  const row = (k, d) => '<div>' + k + '</div><div>' + d + '</div>', key = s => '<span class="key">' + s + '</span>';
  return '<div class="bookColumns"><div><h4>Keyboard and mouse</h4><h3>Walking the harbour.</h3><div class="controlsGrid">' +
    row(key('W A S D'), 'Move. Arrow keys also work.') + row(key('SHIFT'), 'Run.') + row(key('E'), 'Talk, examine, or use. Enter works too.') + row(key('N'), 'Open this notebook. H opens this page.') +
    row(key('C') + ' ' + key('Q'), 'Camera behind Jun / turn the camera.') + row('DRAG MOUSE', 'Turn the camera. The wheel zooms.') + row(key('Z'), 'Hold to look closely.') + row(key('ESC'), 'Pause or close a page.') +
    row(key('M') + ' ' + key('F') + ' ' + key('V'), 'Mute / full screen / hide the display.') + row(key('W / S') + ' ' + key('A / D'), 'Drive and steer the forklift.') + row(key('SPACE'), 'Brake. In a fight, hold to guard.') +
    row(key('X') + ' ' + key('R'), 'Leave / reset the forklift.') + row(key('J') + ' ' + key('K') + ' ' + key('L'), 'Punch / kick / evade. Left and right click punch and kick.') +
    '</div></div><div><h4>Gamepad</h4><h3>From the sofa.</h3><div class="controlsGrid">' +
    row('L STICK', 'Move, drive, aim darts, choose menu items.') + row('R STICK', 'Turn the camera. LB / RB zoom, R3 resets it.') + row(key('A'), 'Talk, use, confirm, lift and lower.') + row(key('B'), 'Run. Evade in a fight. Back in menus.') +
    row(key('X') + ' ' + key('Y'), 'Punch / kick. In the forklift: get out / reset.') + row(key('LT'), 'Guard. Brake in the forklift.') + row('START', 'Pause. BACK opens the notebook.') +
    '</div><h4 style="margin-top:24px">Touch</h4><p>The stick appears under your left thumb. Drag on the right to look and pinch to zoom. The buttons on the right change with what you are doing. In the chase, tap the circle.</p><p>Quick-time events show the button to press. Relaxed timing is in Options.</p></div></div>';
}
function drawMap() {
  const c = $('mapCanvas').getContext('2d'), w = 460, h = 460;
  const sx = x => (x + 43) / 81 * 410 + 25, sz = z => (z + 44) / 83 * 410 + 25;
  c.clearRect(0, 0, w, h); c.fillStyle = '#bcc6b3'; c.fillRect(0, 0, w, h); c.fillStyle = '#dfd8bb'; c.fillRect(sx(-33), sz(-43), sx(35) - sx(-33), sz(37) - sz(-43));
  c.strokeStyle = '#85958018'; c.lineWidth = 1;
  for (let i = 25; i < 460; i += 25) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 460); c.moveTo(0, i); c.lineTo(460, i); c.stroke(); }
  const rect = (x, z, rw, d, col) => { c.fillStyle = col; c.fillRect(sx(x - rw / 2), sz(z - d / 2), rw / 81 * 410, d / 83 * 410); };
  rect(1, -2, 24, 76, '#cbcbb0'); c.setLineDash([4, 4]); c.strokeStyle = '#8f9b84'; c.beginPath(); c.moveTo(sx(1), sz(-41)); c.lineTo(sx(1), sz(35)); c.stroke(); c.setLineDash([]);
  c.font = 'bold 19px Georgia'; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const [x, z, n, d] of [[25, 24, '01', 20], [25, 0, '03', 22], [25, -28, '08', 24]]) { rect(x, z, 18, d, '#8fa391'); c.fillStyle = '#3d6157'; c.fillText(n, sx(x), sz(z)); }
  rect(-22, 22, 9, 6, '#829986'); rect(6.5, 30.6, 3.4, 3.2, '#94a58e'); for (const z of [-18, -30, -7]) rect(-24, z, 8, 3, '#9da788');
  rect(9, -10, 6, 7, '#baac74'); c.strokeStyle = '#596f5c'; c.strokeRect(sx(6), sz(-13.5), 6 / 81 * 410, 7 / 83 * 410);
  c.fillStyle = '#395b52'; c.font = '10px Arial'; c.fillText('TEA', sx(-22), sz(22)); c.fillText('EAST GATE', sx(0), sz(37) + 14); c.fillText('FREIGHT', sx(8), sz(-2.7));
  c.save(); c.translate(sx(-37), sz(-3)); c.rotate(-PI / 2); c.font = '9px Arial'; c.fillStyle = '#638775'; c.fillText('NAGAMATSU BAY', 0, 0); c.restore();
  c.fillStyle = '#536f5e'; c.fillText('N', 432, 18); c.beginPath(); c.moveTo(432, 24); c.lineTo(427, 37); c.lineTo(437, 37); c.closePath(); c.fill();
  for (const a of npcs.filter(n => ['mori', 'hana', 'daichi', 'genji'].includes(n.id) && npcPresent(n))) { c.fillStyle = '#426c61'; c.beginPath(); c.arc(sx(a.x), sz(a.z), 3, 0, TAU); c.fill(); }
  const tar = currentGoal();
  if (tar && G.stage < 7) { c.save(); c.translate(sx(tar.x), sz(tar.z)); c.rotate(PI / 4); c.fillStyle = '#b78045'; c.fillRect(-4, -4, 8, 8); c.strokeStyle = '#734f35'; c.strokeRect(-4, -4, 8, 8); c.restore(); }
  c.fillStyle = '#a0523f'; c.beginPath(); c.arc(sx(player.x), sz(player.z), 5, 0, TAU); c.fill(); c.strokeStyle = '#f5ead0'; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = '#a0523f'; c.beginPath(); c.moveTo(sx(player.x), sz(player.z)); c.lineTo(sx(player.x - Math.sin(player.yaw) * 2.4), sz(player.z - Math.cos(player.yaw) * 2.4)); c.stroke();
  c.strokeStyle = '#6e826a66'; c.lineWidth = 1; c.strokeRect(4, 4, 452, 452);
}

/* ------------------------------------------------------------------ movement and collision */

function collides(x, z, r = .34, includeCrates = false) {
  if (x - r < -31 || x + r > 33 || z - r < -40.6 || z + r > 34.7) return true;
  for (const o of obstacles) { const dx = Math.max(Math.abs(x - o.x) - o.w / 2, 0), dz = Math.max(Math.abs(z - o.z) - o.d / 2, 0); if (dx * dx + dz * dz < r * r) return true; }
  if (includeCrates) for (const c of crates) if (!c.delivered && c.id !== forklift.carry) { const dx = Math.max(Math.abs(x - c.x) - .68, 0), dz = Math.max(Math.abs(z - c.z) - .68, 0); if (dx * dx + dz * dz < r * r) return true; }
  return false;
}
function tryMove(a, dx, dz, r = .34, battle = false, vehicle = false) {
  const ox = a.x, oz = a.z;
  if (!collides(a.x + dx, a.z, r, !battle)) a.x += dx;
  if (!collides(a.x, a.z + dz, r, !battle)) a.z += dz;
  if (battle) { a.x = clamp(a.x, -9.5, 12.5); a.z = clamp(a.z, -38.5, -21.5); }
  if (a === player && !battle) {
    for (const n of npcs) if (npcPresent(n) && dist(a, n) < .48) { a.x = ox; a.z = oz; break; }
    if (dist(a, forklift) < 1.07) { a.x = ox; a.z = oz; }
  }
  // The forklift no longer drives straight through people: it stops short of them, and so do its forks.
  // Only moves that bring the body or the fork tips closer are refused, so backing away always works.
  if (vehicle) {
    const sx = Math.sin(a.yaw) * 1.9, sz = Math.cos(a.yaw) * 1.9;
    for (const n of npcs) {
      if (!npcPresent(n)) continue;
      const body = Math.hypot(a.x - n.x, a.z - n.z), tip = Math.hypot(a.x - sx - n.x, a.z - sz - n.z);
      if ((body < 1.25 && body < Math.hypot(ox - n.x, oz - n.z)) || (tip < .8 && tip < Math.hypot(ox - sx - n.x, oz - sz - n.z))) { a.x = ox; a.z = oz; break; }
    }
  }
  return Math.hypot(a.x - ox, a.z - oz);
}
function moveToSafe() {
  for (let r = .5; r < 5; r += .5) for (let j = 0; j < 12; j++) { const x = player.x + Math.sin(j / 12 * TAU) * r, z = player.z + Math.cos(j / 12 * TAU) * r; if (!collides(x, z, .35, true) && Math.hypot(x - forklift.x, z - forklift.z) > 1.3) { player.x = x; player.z = z; return; } }
  player.x = 0; player.z = 31;
}
function updatePlayer(dt, battle = false) {
  const a = input.vector('move');
  let mag = Math.hypot(a.x, a.y);
  const running = !battle && input.down('run');
  let speed = battle ? (player.block ? .7 : 2.1) : running ? 3.8 : 1.7;
  let desired = player.yaw, dx = 0, dz = 0;
  if (options.tank && !battle) { player.yaw -= a.x * dt * 1.95; dx = -Math.sin(player.yaw) * a.y; dz = -Math.cos(player.yaw) * a.y; mag = Math.abs(a.y); }
  else {
    dx = a.x * Math.cos(camYaw) - a.y * Math.sin(camYaw); dz = -a.x * Math.sin(camYaw) - a.y * Math.cos(camYaw);
    if (mag > .05) { desired = Math.atan2(-dx, -dz); const diff = angdiff(player.yaw, desired); player.yaw += clamp(diff, -dt * 4.2, dt * 4.2); if (Math.abs(diff) > 1.1) speed *= .57; }
  }
  if (player.attackTime > 0) speed *= .15;
  if (player.dead) speed = 0;
  const moved = tryMove(player, dx * speed * dt, dz * speed * dt, .32, battle);
  player.walk = mix(player.walk, moved > .003 ? (running ? 1 : .65) : 0, Math.min(1, dt * 10));
  if (moved > .003) { player.phase += dt * (running ? 10 : 6.3); stepAccum += moved; if (stepAccum > (running ? .95 : .68)) { stepAccum = 0; sound.sfx('step'); } lastAction = worldTime; }
  player.y = 0;
  if (input.down('turnCam')) { camYaw += dt * 1.4; camManual = worldTime + 3; }
  if (worldTime > camManual) { const follow = options.tank || (worldTime - lastAction > 1.3); if (follow) camYaw += angdiff(camYaw, player.yaw) * Math.min(1, dt * .8); }
}
function updateForklift(dt) {
  if (race && race.phase === 'count') { forklift.speed = 0; player.x = forklift.x; player.z = forklift.z; player.yaw = forklift.yaw; updateRace(dt); return; }
  const a = input.vector('move'), acc = a.y * 3.8;
  if (input.down('brake')) forklift.speed *= Math.exp(-dt * 12);
  else if (Math.abs(a.y) > .05) forklift.speed = clamp(forklift.speed + acc * dt, -1.95, 3.8);
  else forklift.speed *= Math.exp(-dt * 2.1);
  if (Math.abs(forklift.speed) < .02) forklift.speed = 0;
  forklift.yaw -= a.x * dt * (.65 + Math.min(1, Math.abs(forklift.speed) / 2) * .7) * (forklift.speed < -.1 ? -1 : 1);
  const moved = tryMove(forklift, -Math.sin(forklift.yaw) * forklift.speed * dt, -Math.cos(forklift.yaw) * forklift.speed * dt, 1.0, false, true);
  forklift.bumpT = Math.max(0, (forklift.bumpT || 0) - dt);
  if (moved < .004 && Math.abs(forklift.speed) > .6) {
    if (!forklift.bumpT && Math.abs(forklift.speed) > 1.4) { sound.sfx('thud'); input.rumble(.35, 90); screenShake = Math.max(screenShake, .05); forklift.bumpT = .6; }
    forklift.speed *= .4;
  }
  player.x = forklift.x; player.z = forklift.z; player.yaw = forklift.yaw;
  camYaw += angdiff(camYaw, forklift.yaw) * Math.min(1, dt * 2.2);
  if (forklift.carry !== null) { const c = crates[forklift.carry], p = frontOfFork(); c.x = p.x; c.z = p.z; }
  if (race) updateRace(dt);
}
function updateNPCs(dt) {
  const near = mode === 'forklift' ? 2.6 : 1.5;
  for (const n of npcs) {
    if (!n.path) { n.walk = 0; continue; }
    const p = n.path[n.wp], dx = p[0] - n.x, dz = p[1] - n.z, d = Math.hypot(dx, dz);
    if (d < .15) { n.wp = (n.wp + 1) % n.path.length; n.walk = 0; continue; }
    if (dist(n, player) < near) { n.walk = 0; continue; }
    n.x += dx / d * dt * .65; n.z += dz / d * dt * .65; n.yaw += angdiff(n.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 3); n.walk = .52; n.phase += dt * 5.0;
  }
}
function getInteractions() {
  const arr = npcs.filter(npcPresent).map(n => ({ id: n.id, x: n.x, z: n.z, kind: 'person', name: n.name, verb: (n.id === 'genji' ? 'SPAR · ' : 'SPEAK · ') + n.role.toUpperCase(), ref: n, r: 2.5 }));
  arr.push({ id: 'forklift', x: forklift.x, z: forklift.z, name: 'Forklift No. 05', verb: 'DRIVE', r: 2.5 }, { id: 'vending', x: -14.2, z: 25.3, name: 'Sun Pop', verb: 'COLD DRINKS · ¥100', r: 2.05 }, { id: 'capsule', x: -11.3, z: 25.1, name: 'Pocket Port', verb: 'CAPSULE TOYS · ¥100', r: 1.8 }, { id: 'cat', x: -28.4, z: 27.1, name: 'A little cat', verb: G.catFed ? 'SAY HELLO' : G.hasBun ? 'GIVE THE FISH BUN' : 'LOOK CLOSER', r: 2 }, { id: 'darts', x: -28.6, z: 20.2, name: 'Lucky Darts', verb: 'PLAY · ¥50', r: 2.2 }, { id: 'board', x: 14.3, z: -5.4, name: 'Freight manifest', verb: 'EXAMINE', r: 2.5 }, { id: 'door', x: 14.3, z: -28, name: 'Warehouse 08', verb: G.stage >= 6 ? 'KNOCK' : 'EXAMINE', r: 2.8 }, { id: 'bus', x: -6, z: 33, name: 'Bus stop', verb: 'READ THE TIMETABLE', r: 1.8 });
  return arr;
}
function updateInteract() {
  interactable = null; fkValid = false;
  if (mode === 'roam') {
    let dd = Infinity;
    for (const a of getInteractions()) { const d = dist(a, player); if (d < a.r && d < dd) { interactable = a; dd = d; } }
    if (interactable) { setText($('interactVerb'), interactable.verb); setText($('interactName'), interactable.name); show('interaction'); } else show('interaction', false);
  } else if (mode === 'forklift' && !race) {
    const c = bestCrate(); fkValid = forklift.carry !== null || !!c;
    show('interaction', fkValid);
    if (fkValid) { setText($('interactVerb'), 'STOP, THEN PRESS ' + K('use')); setText($('interactName'), forklift.carry !== null ? (inBay(frontOfFork()) || inBay(forklift) ? 'Deliver cargo' : 'Lower cargo') : 'Lift crate ' + (c.id + 1)); }
  } else show('interaction', false);
}
function currentGoal() {
  if (race) { const i = Math.min(race.gate, RUN_GATES.length - 1), g = RUN_GATES[i]; return { x: g[0], z: g[1], y: 3.2, name: i === RUN_GATES.length - 1 ? 'Finish' : 'Gate ' + (i + 1) }; }
  if (G.stage === 3 || sideShift) {
    if (mode === 'forklift') {
      if (forklift.carry !== null) return { x: 9, z: -10, y: 1, name: 'Delivery bay 03' };
      const a = crates.filter(c => !c.delivered && c.id !== forklift.carry).sort((p, q) => dist(p, forklift) - dist(q, forklift))[0];
      return a ? { x: a.x, z: a.z, y: 2, name: 'Crate ' + (a.id + 1) } : null;
    }
    return { x: forklift.x, z: forklift.z, y: 3, name: 'Forklift 05' };
  }
  const goals = [{ x: 2, z: 26.4, name: 'Mori' }, { x: -19.7, z: 28.3, name: 'Hana' }, { x: -8.5, z: 2, name: 'Daichi' }, null, { x: 14.3, z: -5.4, name: 'Freight board' }, { x: 2, z: -30, name: 'Loading yard' }, { x: 14.3, z: -28, name: 'Warehouse 08' }, null];
  return goals[G.stage];
}

/* ------------------------------------------------------------------ HUD */

function setPips(n) { const el = $('deliveryPips'); el.innerHTML = '<i></i>'.repeat(n); el.classList.toggle('many', n > 5); }
function updateHUD() {
  if (!G) return;
  const mins = Math.floor(G.clock), hh = Math.floor(mins / 60) % 24, mm = mins % 60;
  setText($('digital'), String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));
  setStyle($('hourHand'), 'transform', 'rotate(' + ((hh % 12) * 30 + mm * .5) + 'deg)'); setStyle($('minuteHand'), 'transform', 'rotate(' + (mm * 6) + 'deg)');
  setText($('cash'), '¥ ' + G.cash.toLocaleString()); setText($('objective'), leads[G.stage][1]);
  setText($('leadNumber'), G.stage === 7 ? 'CHAPTER COMPLETE' : 'CURRENT LEAD / ' + String(G.stage + 1).padStart(2, '0'));
  setText($('weatherText'), 'DEC 09 · ' + (rainAmount > .2 ? 'LIGHT RAIN' : G.clock > 1050 ? 'EVENING AIR' : 'SEA BREEZE'));
  setText($('locationName'), player.z < -22 ? 'Old Warehouse District' : player.x < -16 && player.z > 15 ? 'Breakwater Tea' : 'Nagamatsu Harbour');
  if (mode === 'forklift') {
    const pips = $('deliveryPips').children;
    if (race) {
      setText($('taskTitle'), race.phase === 'count' ? 'Get ready' : 'Gate ' + Math.min(race.gate + 1, RUN_GATES.length) + ' / ' + RUN_GATES.length + ' · ' + fmtTime(race.time));
      setText($('taskHint'), 'Best ' + (G.runBest ? fmtTime(G.runBest) : '—') + ' · Gold ' + RUN_PAR.gold + ' s · ' + K('recover') + ' restart · ' + K('exit') + ' quit');
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('done', i < race.gate);
    } else {
      const done = crates.filter(c => c.delivered).length;
      setText($('taskTitle'), done + ' / 3 crates delivered');
      setText($('taskHint'), forklift.carry !== null ? 'Cargo loaded · ' + K('use') + ' lower · ' + K('brake') + ' brake · ' + K('exit') + ' get out' : K('drive') + ' drive · ' + K('steer') + ' steer · ' + K('use') + ' lift · ' + K('recover') + ' recover');
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('done', i < done);
    }
  }
  if (mode === 'combat') {
    setStyle($('playerHP'), 'width', player.health + '%');
    enemies.forEach((e, i) => { const el = $('enemyHP' + i); if (el) setStyle(el, 'width', (e.health / e.maxHealth * 100).toFixed(1) + '%'); });
    const alive = enemies.filter(e => e.health > 0);
    setText($('enemyNames'), spar ? (alive.map(e => e.name.toUpperCase()).join(' · ') || 'ROUND WON') : alive.length === 1 ? 'ONE LEFT' : 'TWO DOCK HANDS');
  }
}
function refreshPrompts() {
  setText($('interactKey'), K('use'));
  setText($('notebookKey'), K('notebook'));
  $('dialogueNext').innerHTML = '<span class="key">' + K('next') + '</span> CONTINUE';
  $('battleHints').innerHTML = '<span class="key">' + K('punch') + '</span> PUNCH <span class="key">' + K('kick') + '</span> KICK <span class="key">' + K('evade') + '</span> EVADE <span class="key">' + K('guard') + '</span> GUARD';
  if (qte) paintQTE();
}
const _v = new THREE.Vector3();
function project(x, y, z) {
  _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  if (_v.z > -.1) return null;
  _v.applyMatrix4(camera.projectionMatrix);
  return [_v.x * .5 + .5, .5 - _v.y * .5];
}
function updateWaypoints() {
  const t = currentGoal();
  if (options.guides && t && ['roam', 'forklift'].includes(mode) && !(race && race.phase === 'count')) {
    const d = Math.hypot((mode === 'forklift' ? forklift.x : player.x) - t.x, (mode === 'forklift' ? forklift.z : player.z) - t.z), p = project(t.x, t.y || 2.65, t.z);
    if (p && d > 2.6 && p[0] > .03 && p[0] < .97 && p[1] > .12 && p[1] < .8) {
      show('waypoint'); setStyle($('waypoint'), 'left', (p[0] * 100).toFixed(1) + '%'); setStyle($('waypoint'), 'top', (p[1] * 100).toFixed(1) + '%');
      setText($('waypointText'), t.name + ' · ' + Math.round(d) + ' m');
    } else show('waypoint', false);
  } else show('waypoint', false);
  if (mode === 'combat') {
    let h = '';
    for (const e of enemies) {
      if (e.health <= 0) continue;
      const charge = e.charge && e.charge.phase === 'wind';
      if (e.wind > 0 || charge) { const p = project(e.x, 2.35 * (e.scale || 1), e.z); if (p) h += '<div class="warning' + (charge ? ' charge' : '') + '" style="left:' + (p[0] * 100).toFixed(1) + '%;top:' + (p[1] * 100).toFixed(1) + '%">' + (charge ? 'EVADE' : 'GUARD') + '</div>'; }
    }
    const w = $('enemyWarnings');
    if (textCache.get(w) !== h) { textCache.set(w, h); w.innerHTML = h; }
  }
}

/* ------------------------------------------------------------------ camera */

const OB_H = { warehouse: 10, tea: 3.8, guard: 3.4, container: 5.4 };
function effectiveMode() { if (mode === 'book') return bookPrev; if (mode === 'modal') return modalState?.prev || 'roam'; return mode; }
function cameraCollision(eye, target) {
  const ex = eye[0] - target[0], ey = eye[1] - target[1], ez = eye[2] - target[2];
  for (let j = 1; j <= 24; j++) {
    const t = j / 24, px = target[0] + ex * t, py = target[1] + ey * t, pz = target[2] + ez * t;
    for (const o of obstacles) {
      const h = OB_H[o.id] || 0;
      if (h && py < h && px > o.x - o.w / 2 - .15 && px < o.x + o.w / 2 + .15 && pz > o.z - o.d / 2 - .15 && pz < o.z + o.d / 2 + .15) {
        const k = Math.max(.12, (j - 1) / 24);
        set3(eye, target[0] + ex * k, target[1] + ey * k, target[2] + ez * k); return;
      }
    }
  }
}
const _eye = [0, 0, 0], _tgt = [0, 0, 0];
function closeLooking() { return mode === 'roam' && input.down('closeLook'); }
function updateCamera(dt) {
  const em = effectiveMode();
  if (mode === 'title' || !started) { set3(_eye, 10.2 + Math.sin(worldTime * .045) * .10, 1.92, 31.5); set3(_tgt, 11.6, 1.42, 27.5); }
  else if (mode === 'ending') { set3(_eye, -20 + Math.sin(worldTime * .04) * 1.3, 5.2, 7.5); set3(_tgt, -53, 4, -26); }
  else if (mode === 'dialogue' && dialogue) {
    const focus = dialogue.focus, l = dialogue.lines[dialogue.index];
    if (focus?.name) {
      const speaker = l.n === 'Jun' ? player : focus, other = l.n === 'Jun' ? focus : player;
      let dx = other.x - speaker.x, dz = other.z - speaker.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      set3(_eye, speaker.x + dx * 1.85 + dz * .48, 1.79, speaker.z + dz * 1.85 - dx * .48); set3(_tgt, speaker.x, 1.55, speaker.z);
    } else if (focus) { set3(_eye, focus.x - 3.6, 2.05, focus.z + 1.45); set3(_tgt, focus.x, 1.65, focus.z); }
    else { set3(_eye, player.x - 2.5, 2.15, player.z - 3.2); set3(_tgt, player.x, 1.38, player.z); }
  } else if (em === 'qte' && qte) {
    camYaw += angdiff(camYaw, player.yaw) * Math.min(1, dt * 3);
    set3(_eye, player.x + Math.sin(camYaw) * 5 + .8, 3.1, player.z + Math.cos(camYaw) * 5); set3(_tgt, player.x - Math.sin(camYaw) * 1.5, 1.1, player.z - Math.cos(camYaw) * 1.5);
  } else if (em === 'combat') {
    const e = nearestEnemy(), x = e ? mix(player.x, e.x, .4) : player.x, z = e ? mix(player.z, e.z, .4) : player.z;
    set3(_eye, x + Math.sin(camYaw) * 7.4, 4.8, z + Math.cos(camYaw) * 7.4); set3(_tgt, x, 1.05, z);
  } else if (em === 'forklift') {
    set3(_eye, forklift.x + Math.sin(camYaw) * 7, 4.2 + camPitch * 1.7, forklift.z + Math.cos(camYaw) * 7); set3(_tgt, forklift.x - Math.sin(camYaw) * .8, 1.25, forklift.z - Math.cos(camYaw) * .8);
  } else if (closeLooking()) {
    set3(_eye, player.x - Math.sin(camYaw) * .2, 1.74, player.z - Math.cos(camYaw) * .2); set3(_tgt, player.x - Math.sin(camYaw) * 5, 1.6 - camPitch * 3, player.z - Math.cos(camYaw) * 5);
  } else {
    set3(_eye, player.x + Math.sin(camYaw) * camZoom + Math.cos(camYaw) * .5, 2.12 + camPitch * 1.5, player.z + Math.cos(camYaw) * camZoom - Math.sin(camYaw) * .5);
    set3(_tgt, player.x - Math.sin(camYaw) * .35, 1.22, player.z - Math.cos(camYaw) * .35);
  }
  if (started && !['title', 'ending'].includes(mode) && !closeLooking()) cameraCollision(_eye, _tgt);
  const speed = mode === 'dialogue' ? 4.4 : mode === 'title' ? 1.3 : 7, ke = Math.min(1, dt * speed), kt = Math.min(1, dt * (speed + 1));
  for (let i = 0; i < 3; i++) { camEye[i] = mix(camEye[i], _eye[i], ke); camTarget[i] = mix(camTarget[i], _tgt[i], kt); }
  if (screenShake > 0) { camEye[0] += Math.sin(worldTime * 71) * screenShake; camEye[1] += Math.cos(worldTime * 67) * screenShake * .4; screenShake = Math.max(0, screenShake - dt * .7); }
}
function updateLook(dt) {
  if (!['roam', 'forklift', 'combat'].includes(mode)) return;
  const lk = input.look('look');
  if (lk.x || lk.y) { camYaw -= lk.x * 1.25; camPitch = clamp(camPitch + lk.y * .8, -.4, .8); camManual = worldTime + 4; }
  const z = input.zoom() * .4 + input.value('zoomPad') * dt * 3;
  if (z && (mode === 'roam' || mode === 'combat')) camZoom = clamp(camZoom - z, 3.1, 8.7);
}

/* ------------------------------------------------------------------ the world each frame */

const SEATED = { seated: true };
const driverPose = { hero: true, x: 0, z: 0, yaw: 0, walk: 0, phase: 0, ...HERO };
const titlePose = { hero: true, x: 12, z: 29, yaw: 2.65, walk: 0, y: 0, ...HERO };
const runnerPose = { x: 0, z: 0, yaw: 0, walk: 1, phase: 0, coat: '#965340', pants: '#43545e', hair: '#3b3028' };
function syncWorld() {
  const em = effectiveMode(), t = worldTime;
  props.updateShip(t); props.updateCat(t, !!G.catFed); props.updateFlags(t); props.gulls.update(t);
  props.updateForklift(forklift);
  const marks = (G.stage === 3 || sideShift) && !race;
  crates.forEach((c, i) => {
    const m = props.crates[i]; m.visible = c.id !== forklift.carry; m.position.set(c.x, 0, c.z);
    const mk = props.markers[i]; mk.visible = marks && !c.delivered && c.id !== forklift.carry; if (mk.visible) mk.position.set(c.x, 0, c.z);
  });
  cast.begin();
  for (const n of npcs) if (npcPresent(n)) cast.draw(n.id, n, t, camEye);
  if (mode === 'title') cast.draw('player', titlePose, t, camEye);
  else if (em === 'forklift') { driverPose.x = forklift.x + Math.sin(forklift.yaw) * .27; driverPose.z = forklift.z + Math.cos(forklift.yaw) * .27; driverPose.yaw = forklift.yaw; cast.draw('player', driverPose, t, camEye, SEATED); }
  else if (!closeLooking()) cast.draw('player', player, t, camEye);
  enemies.forEach((e, i) => { if (mode === 'combat' || dist(e, player) < 30) cast.draw('enemy' + i, e, t, camEye); });
  if (mode === 'dialogue' && dialogue?.focus?.name === 'Enomoto') cast.draw('enomoto', dialogue.focus, t, camEye);
  const chase = em === 'qte' && !!qte;
  props.pallet.visible = chase; props.boom.visible = chase && qte.step === 2; props.pass.visible = chase;
  if (chase) {
    const yaw = player.yaw;
    runnerPose.x = player.x - Math.sin(yaw) * 3; runnerPose.z = player.z - Math.cos(yaw) * 3; runnerPose.yaw = yaw; runnerPose.phase = player.phase + .5;
    cast.draw('courier', runnerPose, t, camEye);
    props.pass.position.set(runnerPose.x, 0, runnerPose.z); props.pass.rotation.y = yaw;
  }
  cast.end();
  let ri = 0; props.chargeRing.visible = false;
  if (mode === 'combat') for (const e of enemies) {
    if (e.health <= 0) continue;
    if (e.wind > 0 && ri < props.rings.length) { const r = props.rings[ri++], s = (.65 + Math.sin(t * 15) * .1) / .65; r.visible = true; r.position.set(e.x, .025, e.z); r.scale.set(s, 1, s); }
    if (e.charge && e.charge.phase === 'wind') { const r = props.chargeRing, s = (1.1 + Math.sin(t * 18) * .15) / .65; r.visible = true; r.position.set(e.x, .03, e.z); r.scale.set(s, 1, s); }
  }
  for (; ri < props.rings.length; ri++) props.rings[ri].visible = false;
  props.gates.forEach((g, i) => { g.visible = !!race && i >= race.gate; });
  props.beacon.visible = !!race && race.gate < RUN_GATES.length;
  if (props.beacon.visible) { const g = RUN_GATES[race.gate]; props.beacon.position.set(g[0], 3.7 + Math.sin(t * 3) * .15, g[1]); props.beacon.rotation.y = t * 1.6; }
  sky.position.set(camEye[0], camEye[1], camEye[2]);
  updateAtmosphere(lights, G.clock / 60, rainAmount, t, camTarget[0], camTarget[2]);
  camera.position.set(camEye[0], camEye[1], camEye[2]); camera.lookAt(camTarget[0], camTarget[1], camTarget[2]); camera.updateMatrixWorld();
}

/* ------------------------------------------------------------------ menus with a pad or keys */

function navDir(dt) {
  const mv = input.vector('move');
  const y = mv.y > .55 ? 1 : mv.y < -.55 ? -1 : 0, x = mv.x > .55 ? 1 : mv.x < -.55 ? -1 : 0;
  if (navSync) { navSync = false; navY = y; navX = x; navHold = 0; return { x: 0, y: 0 }; }
  if (y !== navY || x !== navX) { navY = y; navX = x; navHold = 0; return { x, y }; }
  if (x || y) { navHold += dt; if (navHold > .42) { navHold -= .11; return { x, y }; } }
  return { x: 0, y: 0 };
}
const focusables = root => [...root.querySelectorAll('button, input[type=range]')].filter(el => !el.disabled && el.getClientRects().length > 0);
function moveFocus(root, dir) {
  const list = focusables(root); if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  i = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
  list[i].focus(); list[i].scrollIntoView?.({ block: 'nearest' });
  document.body.classList.add('kbd-nav');
}
function activateFocused(root) {
  const a = document.activeElement;
  if (a && a !== document.body && root.contains(a) && a.tagName === 'BUTTON') { a.click(); return true; }
  return false;
}
/** A menu just appeared: a pad player gets the first button focused; everyone else keeps the mouse. */
function menuOpened(root) {
  navSync = true;
  if (input.source === 'gamepad') { const f = focusables(root)[0]; if (f) { f.focus(); document.body.classList.add('kbd-nav'); } }
  else if (document.activeElement && document.activeElement !== document.body && !root.contains(document.activeElement)) document.activeElement.blur?.();
}
function menuKeys(root, nav) {
  if (nav.y) moveFocus(root, -nav.y);
  const a = document.activeElement;
  if (nav.x && a?.type === 'range' && root.contains(a)) { a.value = clamp(Number(a.value) + nav.x * .05, 0, 1); a.dispatchEvent(new Event('input')); }
}

/* ------------------------------------------------------------------ one place for every press */

function handleInput(dt) {
  const nav = navDir(dt);
  if (input.pressed('fullscreen')) toggleFullscreen();
  if (input.pressed('mute')) { sound.init(); options.muted = !options.muted; persistOptions(); if (started) toast('SOUND', options.muted ? 'Muted' : 'Sound on', 'Press M to change.'); if (mode === 'book' && currentTab === 'options') renderBook('options'); }
  if (input.pressed('cleanView') && ['roam', 'forklift'].includes(mode)) document.body.classList.toggle('clean-view');
  switch (mode) {
    case 'title': {
      const root = $('titleScreen');
      menuKeys(root, nav);
      if (input.pressed('use') && !activateFocused(root)) { if (readSave()) startGame(true); else requestNew(); }
      return;
    }
    case 'book': {
      const root = $('bookOverlay');
      if (input.pressed('back') || input.pressed('notebook') || input.pressed('pause')) { closeBook(); return; }
      const zp = input.value('zoomPad'), zs = zp > .5 ? 1 : zp < -.5 ? -1 : 0;
      if (zs && zs !== zoomPrev) switchTab(zs);
      zoomPrev = zs;
      if (nav.x && document.activeElement?.type !== 'range') switchTab(nav.x);
      else menuKeys(root, nav);
      if (input.pressed('use')) activateFocused(root);
      return;
    }
    case 'modal': {
      const root = $('modal');
      if ((input.pressed('back') || input.pressed('pause')) && modalState?.esc) { const p = modalState.prev; modalState = null; show('modal', false); setMode(p); return; }
      menuKeys(root, nav);
      if (input.pressed('use') && !activateFocused(root)) $('modalActions').querySelector('button')?.click();
      return;
    }
    case 'ending': {
      const root = $('ending');
      menuKeys(root, nav);
      if (input.pressed('use') && !activateFocused(root)) $('stayBtn').click();
      return;
    }
    case 'dialogue': {
      if (dialogue?.choiceBuilt) {
        const root = $('choices');
        menuKeys(root, nav);
        for (let i = 1; i <= 4; i++) if (input.pressed('choice' + i)) { chooseDialogue(i - 1); return; }
        // Every choice list ends with the way out, so Back / B / Esc takes it.
        if (input.pressed('back')) { chooseDialogue(dialogue.choices.length - 1); return; }
        if (input.pressed('use')) activateFocused(root);
      } else if (input.pressed('use') || input.pressed('guard') || input.pressed('back')) advanceTalk();
      return;
    }
    case 'transition': return;
    case 'qte': if (input.pressed('pause')) { pauseGame(); return; } qteInput(); return;
    case 'darts':
      if (input.pressed('use') || input.pressed('guard')) throwDart();
      if (input.pressed('back') || input.pressed('pause')) leaveDarts();
      return;
  }
  if (!['roam', 'forklift', 'combat'].includes(mode)) return;
  if (input.pressed('pause')) { pauseGame(); return; }
  if (input.pressed('notebook')) { openBook(); return; }
  if (input.pressed('help')) { openBook('controls'); return; }
  if (input.pressed('camReset')) { camYaw = mode === 'forklift' ? forklift.yaw : player.yaw; camManual = 0; camPitch = .1; }
  if (mode === 'forklift') {
    if (input.pressed('use')) forkAction();
    if (input.pressed('exit')) { exitForklift(); return; }
    if (input.pressed('recover')) recoverForklift();
    return;
  }
  if (mode === 'combat') { if (input.pressed('evade')) evade(); return; }
  if (input.pressed('use')) interact();
}
function toggleFullscreen() {
  try { const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); p?.catch?.(() => { if (started) toast('DISPLAY', 'Full screen is not available', 'The game still works in this window.'); }); } catch (e) { /* not allowed here */ }
}

/* ------------------------------------------------------------------ touch controls follow the situation */

function refreshTouch() {
  const t = kit.touch; if (!t) return;
  const playing = ['roam', 'forklift', 'combat'].includes(mode);
  const useOn = (mode === 'roam' && !!interactable) || (mode === 'forklift' && !race && fkValid);
  const sig = mode + '|' + useOn + '|' + !!race;
  if (sig === touchSig) return;
  touchSig = sig;
  t.suspend(!playing, 'game');
  t.setShown('use', useOn); t.setShown('run', mode === 'roam');
  for (const n of ['punch', 'kick', 'guard', 'evade']) t.setShown(n, mode === 'combat');
  for (const n of ['brake', 'exit', 'recover']) t.setShown(n, mode === 'forklift');
  t.setShown('notebook', mode !== 'combat');
  t.setLabel('exit', race ? 'Quit run' : 'Get out'); t.setLabel('recover', race ? 'Restart' : 'Reset');
}

/* ------------------------------------------------------------------ the loop */

function update(dt) {
  worldTime += dt;
  const active = ['roam', 'forklift', 'combat', 'qte'].includes(mode);
  if (active && started) {
    G.elapsed += dt; G.clock = Math.min(1125, G.clock + dt * .15);
    if (worldTime - lastAutoSave > 25 && ['roam', 'forklift'].includes(mode) && !race) { lastAutoSave = worldTime; saveGame(true); }
  }
  const desiredRain = options.weather && started && G.elapsed > 160 && G.elapsed < 390 ? .7 : 0;
  rainAmount = mix(rainAmount, desiredRain, Math.min(1, dt * .1));
  damageAlpha = Math.max(0, damageAlpha - dt * 1.4);
  if (mode === 'roam') { updatePlayer(dt); updateNPCs(dt); if (G.stage === 5 && player.z < -22 && enemies.length === 0) battleIntro(true); }
  else if (mode === 'forklift') { updateForklift(dt); updateNPCs(dt); }
  else if (mode === 'dialogue') updateDialogue(dt);
  else if (mode === 'combat') updateBattle(dt);
  else if (mode === 'qte') updateChase(dt);
  else if (mode === 'darts') updateDarts(dt);
  if (transition) {
    transition.time += dt;
    setStyle($('fade'), 'opacity', (transition.time < .5 ? transition.time * 2 : Math.max(0, 2 - transition.time * 2)).toFixed(3));
    if (transition.time >= .5 && !transition.done) { transition.done = true; transition.fn(); }
    if (transition && transition.time > 1) { transition = null; setStyle($('fade'), 'opacity', '0'); }
  }
  if (worldTime > toastUntil) $('toast').classList.remove('show');
  if (worldTime > areaUntil) $('areaCard').classList.remove('show');
  if (worldTime > saveUntil) setStyle($('saveIcon'), 'opacity', '0');
  if (goUntil && worldTime > goUntil) { goUntil = 0; show('countdown', false); }
  hudTick += dt;
  if (hudTick > .12) { hudTick = 0; updateHUD(); updateInteract(); }
  sound.update(effectiveMode(), mode === 'forklift' ? forklift.speed : 0, rainAmount);
  updateCamera(dt);
}
function frame(dt) {
  if (!ready) return;
  handleInput(dt);
  updateLook(dt);
  const steps = Math.max(1, Math.ceil(dt / .045));
  for (let i = 0; i < steps; i++) update(dt / steps);
  if (mode === 'combat' || (mode === 'forklift' && race)) updateHUD();
  if (mode === 'darts') drawDarts();
  setStyle($('rainFx'), 'opacity', (rainAmount * .52).toFixed(3));
  setStyle($('damageFlash'), 'opacity', damageAlpha.toFixed(3));
  syncWorld();
  kit.renderer.render(scene, camera);
  updateWaypoints();
  refreshTouch();
}

/* ------------------------------------------------------------------ page wiring */

function bindUI() {
  $('startBtn').onclick = requestNew; $('continueBtn').onclick = () => startGame(true);
  $('titleControls').onclick = () => openBook('controls'); $('titleSettings').onclick = () => openBook('options');
  $('notebookButton').onclick = () => openBook(); $('bookClose').onclick = closeBook;
  document.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { sound.sfx('click'); renderBook(b.dataset.tab); }; });
  $('interaction').onclick = interact; $('dialogueNext').onclick = advanceTalk; $('speech').onclick = advanceTalk;
  $('qteCircle').onclick = () => { if (qte) qtePress(chaseSteps[qte.step].code); };
  $('stayBtn').onclick = () => { show('ending', false); setMode('roam'); player.x = 11.5; player.z = -28; player.yaw = PI / 2; camYaw = PI / 2; camZoom = 3.6; saveGame(); toast('THE AFTERNOON IS YOURS', 'No need to hurry', 'Tea, darts, toys, a forklift lap and one small cat.'); };
  $('endTitleBtn').onclick = goTitle; $('leaveDarts').onclick = leaveDarts;
  const dc = $('dartCanvas');
  dc.addEventListener('pointermove', e => { if (!darts) return; const r = dc.getBoundingClientRect(); darts.aimX = clamp((e.clientX - r.left) / r.width * 620, 30, 590); darts.aimY = clamp((e.clientY - r.top) / r.height * 620, 30, 590); });
  dc.addEventListener('pointerdown', e => { if (!darts) return; e.preventDefault(); const r = dc.getBoundingClientRect(); darts.aimX = (e.clientX - r.left) / r.width * 620; darts.aimY = (e.clientY - r.top) / r.height * 620; darts.sightX = darts.aimX + Math.sin(worldTime * 2.7) * 9; darts.sightY = darts.aimY + Math.cos(worldTime * 2.1) * 9; throwDart(); });
  // Audio starts on the first gesture of any kind (browsers keep it silent until then).
  const unlock = () => sound.init();
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });
  addEventListener('pointerdown', () => document.body.classList.remove('kbd-nav'), { capture: true, passive: true });
  input.onSourceChange(s => { refreshPrompts(); if (mode === 'book' && currentTab === 'controls') renderBook('controls'); if (s === 'gamepad') sound.init(); });
  kit.onPause(p => sound.setPaused(p || document.hidden));
  addEventListener('blur', () => { if (started && ['roam', 'forklift', 'combat', 'qte'].includes(mode)) pauseGame(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saveGame(true); if (started && ['roam', 'forklift', 'combat', 'qte'].includes(mode)) pauseGame(); }
    sound.setPaused(document.hidden || kit.paused);
  });
  addEventListener('beforeunload', () => saveGame(true));
}
function buildWatchTicks() {
  let ticks = '';
  for (let i = 0; i < 60; i++) { if (i % 5 === 0) continue; const a = i / 60 * TAU, x1 = 45 + Math.sin(a) * 35, y1 = 45 - Math.cos(a) * 35, x2 = 45 + Math.sin(a) * 37, y2 = 45 - Math.cos(a) * 37; ticks += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#bbc8b3" stroke-width=".6"/>'; }
  $('watchTicks').innerHTML = ticks;
}
function fatal(e) {
  console.error(e);
  try { kit.loading.done(); } catch (err) { /* card already gone */ }
  show('loading'); show('titleScreen', false); $('loadRing').style.display = 'none';
  $('loadText').textContent = 'The game could not start. ' + (e?.message || e);
}

freshState();
buildWatchTicks();
bindUI();
refreshPrompts();
syncWorld();
try { await kit.renderer.compileAsync(scene, camera); } catch (e) { console.warn('[sham-mue] shader warm-up skipped:', e); }
refreshTitle();
show('titleScreen');
setMode('title');
menuOpened($('titleScreen'));
ready = true;
window.ShamMue = {
  version: '3.0-dreamcast-kit',
  getState: () => ({ mode, stage: G.stage, cash: G.cash, position: { x: player.x, z: player.z, yaw: player.yaw }, health: player.health, clock: G.clock, elapsed: G.elapsed, crates: crates.map(c => ({ ...c })), forklift: { ...forklift }, toys: { ...G.toys }, catFed: G.catFed, dartsPlayed: G.dartsPlayed, runBest: G.runBest, sparClears: G.sparClears, race: race && { ...race }, spar: spar && { ...spar }, backend: kit.backend })
};
kit.start(frame);
