/*
 * game.js — Panzer Dragon Saga: The Hollow Sea.
 *
 * The chapter's flight, four-sector battles, story, saves and HUD, now drawn by
 * three.js through the shared kit (WebGPU, WebGL2 as the fallback). Every input
 * arrives as a kit action, so keyboard, controller and touch all play the same
 * game, and every menu can be driven by all three.
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import {
  TAU, clamp, mix, smooth, angleDiff, V, rand, random, material, materialFor, Geo, mesh, node, setMat,
  tubeGeo, worldPoint, disposeTree, G_ROCK, G_PULSE, snapGrid, retroOn, skyColor, skyTime,
} from './engine.js';
import {
  MAT_DEAD, groundHeight, POIS, makeDragon, makeSkimmer, makeSentinel, makeWyrm, buildWorld, buildTrial, TRIAL_MEDALS,
} from './world.js';
import { SagaAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------ saved data */

const SAVE_KEY = 'pds_hollow_sea_save_v1';
const OPT_KEY = 'pds_hollow_sea_options_v1';
const REC_KEY = 'pds_hollow_sea_records_v1';
const readStore = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};
const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

let sessionSave = readStore(SAVE_KEY);
const storedOptions = readStore(OPT_KEY) || {};
const options = {
  retro: storedOptions.retro !== false,
  volume: clamp(Number.isFinite(Number(storedOptions.volume)) ? Number(storedOptions.volume) : 0.58, 0, 1),
  sound: storedOptions.sound !== false,
  difficulty: storedOptions.difficulty === 'veteran' ? 'veteran' : 'explorer',
  motion: typeof storedOptions.motion === 'boolean' ? storedOptions.motion : !matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const RANK_VALUE = { S: 4, A: 3, B: 2, C: 1 };
/** Best result per encounter and the best wind-trial time, kept across journeys. */
function sanitizeRecords(r) {
  const out = { battles: {}, trial: null };
  if (!r || typeof r !== 'object') return out;
  if (r.battles && typeof r.battles === 'object') {
    for (const k of ['0', '1', '2', '3', '4']) {
      const b = r.battles[k];
      if (b && RANK_VALUE[b.rank] && Number.isFinite(b.time)) out.battles[k] = { rank: b.rank, time: b.time };
    }
  }
  if (Number.isFinite(r.trial) && r.trial > 0) out.trial = r.trial;
  return out;
}
const records = sanitizeRecords(readStore(REC_KEY));
const saveRecords = () => writeStore(REC_KEY, records);

/* ------------------------------------------------------------ content */

const FORMS = [
  { name: 'BALANCED', glyph: '◇', time: 2.85, damage: 1, defense: 1, spirit: 1, heal: 1, body: '538a86', wing: 'c29d66', desc: 'A steady balance of power and speed.', stats: 'Gauge: 2.85 s · Damage: ×1.00<br>Damage taken: ×1.00 · Spirit cost: ×1.00' },
  { name: 'STRIKER', glyph: '✧', time: 3.25, damage: 1.42, defense: 1.18, spirit: 1.15, heal: 0.9, body: 'aa634a', wing: 'b98954', desc: 'Strong attacks. A lighter defense.', stats: 'Gauge: 3.25 s · Damage: ×1.42<br>Damage taken: ×1.18 · Spirit cost: ×1.15' },
  { name: 'SWIFT', glyph: '⋔', time: 2.05, damage: 0.8, defense: 1.25, spirit: 1, heal: 0.9, body: '719499', wing: 'a9bf9a', desc: 'Fast gauges. Take care in danger zones.', stats: 'Gauge: 2.05 s · Damage: ×0.80<br>Damage taken: ×1.25 · Spirit cost: ×1.00' },
  { name: 'BASTION', glyph: '▱', time: 3.4, damage: 0.86, defense: 0.58, spirit: 0.72, heal: 1.4, body: '8e9180', wing: 'aaa986', desc: 'Heavy armor. Strong, low-cost healing.', stats: 'Gauge: 3.40 s · Damage: ×0.86<br>Damage taken: ×0.58 · Spirit cost: ×0.72' },
];

/** poi: where the fight is found. phase2: danger patterns once the enemy is below half health. */
const ENCOUNTERS = [
  { poi: 0, name: 'Dune skimmers', kicker: 'MUTATED LIFE / PAIR', model: 'skimmer', hps: [460, 460], damage: 73, interval: 8.7, weak: 2, patterns: [[0, 2], [0, 2], [0, 1]], hint: 'A / D or ◀ ▶: circle the enemy. Green sectors are safe. The gold sector exposes the selected target’s weak point.', attack: 'SAND LANCE', lore: 'Dune skimmer. Its front shell is thick. Circle to the rear for a clear shot. A lock laser can hit both skimmers.' },
  { poi: 1, name: 'Choir sentinel', kicker: 'ANCIENT GUARDIAN / ARMORED', model: 'sentinel', hps: [430, 800, 430], damage: 90, interval: 8.0, weak: 2, patterns: [[0, 1], [2, 3], [0, 2]], hint: 'Laser hits wear down armor. The rider gun does more damage from a gold sector. Tab or LB changes the selected target.', attack: 'RELAY CANNON', lore: 'Choir sentinel. Each node has a different weak side. Select a node to see it. Repeated lasers break its armor.' },
  { poi: 2, name: 'Echo hunters', kicker: 'MUTATED LIFE / PACK', model: 'hunter', hps: [690, 690], damage: 103, interval: 7.6, weak: 2, patterns: [[0, 2], [1, 3], [0, 2]], hint: 'The safe sectors change after each attack. Keep a gauge ready for a tonic. Tempest strikes all live targets.', attack: 'CROSSWIND', lore: 'Echo hunters. They attack opposite sectors, then turn. Watch the radar before each strike. Their rear armor is weak.' },
  { poi: 3, name: 'The Ossuary Warden', kicker: 'GATEKEEPER / PRIME ORGANISM', model: 'boss', hps: [1100, 2100, 1100], damage: 132, interval: 7.7, weak: 2, patterns: [[0, 2], [0, 1, 3], [1, 2, 3]], phase2: [[0, 1, 2], [0, 2, 3], [0, 1, 3]], hint: 'Destroy the three cores. Save three gauges for Tempest. Below half health, the Warden changes its attack pattern.', attack: 'OSSUARY RAY', attack2: 'HOLLOW RAY', lore: 'The Ossuary Warden. Three cores keep its body alive. Its heart is weak at the rear. At half health, the exposed heart moves to the front.' },
  { poi: 8, name: 'The Glass Wyrm', kicker: 'BURROWING LIFE / LIVING GLASS', model: 'wyrm', hps: [640, 900, 540], damage: 98, interval: 7.9, weak: 2, patterns: [[2, 3], [0, 1], [1, 2]], phase2: [[0, 1], [1, 2], [2, 3], [3, 0]], hint: 'Three glass targets: the crown is weak at the front, the sac on the right, the stinger at the rear. Lasers crack the glass. At half health it dives and surfaces facing away.', attack: 'SHARD SPRAY', attack2: 'GLASS RAIN', lore: 'The Glass Wyrm. It grows glass the way a shell grows pearl, and the glass turns a gun. Crack it with lasers or Tempest. Wounded, it dives under the keel and surfaces facing the other way.' },
];
const WYRM = 4;
const DIVE_TIME = 1.6;

/* ------------------------------------------------------------ input actions */

// Touch buttons fill the kit's cluster in this order (first = the big one).
const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
  primary: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'], touch: 'Inspect' },
  signal: { keys: ['Tab'], gamepad: ['LB'], touch: 'Signal' },
  orbitR: { touch: '▶' },
  orbitL: { touch: '◀' },
  boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RT'], touch: 'Boost' },
  tonic: { keys: ['Digit5', 'Numpad5'], gamepad: ['LT'], touch: 'Tonic' },
  gun: { keys: ['Digit1', 'Numpad1'], gamepad: ['X'] },
  laser: { keys: ['Digit2', 'Numpad2'] },
  tempest: { keys: ['Digit3', 'Numpad3'], gamepad: ['Y'] },
  mend: { keys: ['Digit4', 'Numpad4'], gamepad: ['B'] },
  interact: { keys: ['KeyE'], gamepad: ['RS'] },
  form: { keys: ['KeyM'], gamepad: ['RB'] },
  map: { keys: ['KeyJ'], gamepad: ['Back'] },
  guide: { keys: ['KeyH'] },
  fullscreen: { keys: ['KeyF'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};

const PROMPTS = {
  keyboard: {
    gun: '1', laser: '2', tempest: '3', mend: '4', tonic: '5', form: 'M', near: 'E', next: 'ENTER', back: 'ESC', confirm: 'ENTER', signal: 'Tab', map: 'J', tonicKey: '5', boost: 'Shift', lock: 'SPACE', scan: 'E',
    flight: '<span><kbd>W</kbd>FLY</span><span><kbd>A D</kbd>TURN</span><span><kbd>S</kbd>BRAKE</span><span class="optional"><kbd>SHIFT</kbd>BOOST</span><span><kbd>E</kbd>INSPECT</span><span class="optional"><kbd>TAB</kbd>GUIDE</span>',
    battle: '<kbd>A D</kbd>ORBIT &nbsp; <kbd>SPACE</kbd>HOLD TO LOCK &nbsp; <kbd>TAB</kbd>TARGET &nbsp; <kbd>M</kbd>FORM',
  },
  gamepad: {
    gun: 'X', laser: 'A', tempest: 'Y', mend: 'B', tonic: 'LT', form: 'RB', near: 'A', next: 'A', back: 'B', confirm: 'A', signal: 'LB', map: 'View', tonicKey: 'LT', boost: 'RT', lock: 'A', scan: 'R3',
    flight: '<span><kbd>L</kbd>FLY · TURN</span><span><kbd>RT</kbd>BOOST</span><span><kbd>A</kbd>INSPECT</span><span class="optional"><kbd>LB</kbd>GUIDE</span><span class="optional"><kbd>☰</kbd>PAUSE</span>',
    battle: '<kbd>◀ ▶</kbd>ORBIT &nbsp; <kbd>A</kbd>HOLD TO LOCK &nbsp; <kbd>LB</kbd>TARGET &nbsp; <kbd>RB</kbd>FORM',
  },
  touch: {
    gun: '', laser: '', tempest: '', mend: '', tonic: '', form: '', near: '◉', next: 'TAP', back: '', confirm: 'TAP', signal: 'SIGNAL', map: '⌖', tonicKey: 'TONIC', boost: 'BOOST', lock: 'LOCK', scan: 'TAP AGAIN',
    flight: '', battle: '',
  },
};

/* ------------------------------------------------------------ state */

const freshProgress = () => ({ seals: [false, false, false], memories: [], camp: false, complete: false, trial: false, trialGold: false, trialBest: null, wyrm: false });
const freshStats = () => ({ time: 0, battles: 0, dodges: 0, hits: 0, damage: 0, ranks: [], distance: 0 });

let mode = 'title';
let modalFrom = 'title';
let modalPage = 'pause';
let modalStack = [];
let dialogueFrom = 'explore';
let dialogueLines = [];
let dialogueIndex = 0;
let dialogueDone = null;
let player = { p: V(0, 42, 240), yaw: 0, speed: 0, hp: 520, bp: 100, maxHp: 520, tonics: 3, form: 0, level: 1 };
let progress = freshProgress();
let stats = freshStats();
let battle = null;
let battleCheckpoint = null;
let battleGroup = null;
let nearest = null;
let guide = false;
let guideTarget = null;
let guideArrived = false;
let trial = null;
let guideTab = 'keyboard';
let visualTime = 0;
let autoSave = 0;
let uiClock = 0;
let toastTime = 0;
let bannerTime = 0;
let saveTime = 0;
let shakeTime = 0;
let shakePower = 0;
let flashLevel = 0;
let morphTime = 0;
let victoryTimer = 0;
let lockHeld = false;
let lockTime = 0;
let lockCount = 0;
let lockPing = 0;
let orbitLatch = 0;
let frameCount = 0;

const audio = new SagaAudio();
audio.enabled = options.sound;
audio.volume = options.volume;
const unlockAudio = () => {
  if (audio.enabled) audio.init();
};

/* ------------------------------------------------------------ boot */

/** The original's "classic" buffer: 640 lines, at most 720 pixels wide. */
const retroSize = (w, h) => {
  const wi = Math.min(720, Math.round((640 * w) / h));
  return [wi, Math.max(1, Math.round((wi * h) / w))];
};

const kit = await boot({
  title: 'Panzer Dragon Saga · The Hollow Sea',
  canvas: $('world'),
  gear: 'none', // the title and the pause menu carry a Graphics button (F9 also works)
  pixelHeight: options.retro ? retroSize(innerWidth, innerHeight)[1] : 0,
  renderer: { antialias: false }, // the original never anti-aliased: hard low-poly edges
  touch: { hint: false }, // the idle stick ring would sit on the pilot panel
  accent: '#85cbbb',
  background: '#13211f',
  input: ACTIONS,
});
const { input } = kit;
// The old renderer wrote colours straight to the canvas (see engine.js).
kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.loading.progress(0.7, 'Raising the ruins…');
await new Promise((r) => setTimeout(r, 20));

const scene = new THREE.Scene();
scene.backgroundNode = skyColor();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(57, 1, 0.7, 2600));
const world = buildWorld(kit.detail(36, 8));
scene.add(world.root);
const trialView = buildTrial();
world.root.add(trialView.group);
const dragon = makeDragon();
scene.add(dragon.root);
const fxRoot = node();
scene.add(fxRoot);
const shadowGeo = new Geo();
shadowGeo.quad([-1, 0, -1], [-1, 0, 1], [1, 0, 1], [1, 0, -1]);
const shadow = mesh(shadowGeo, material('28362b', 4, 0.28));
shadow.scale.set(12, 1, 8);
scene.add(shadow);

const hudCanvas = $('hudCanvas');
const hudCtx = hudCanvas.getContext('2d');
const radarCtx = $('radar').getContext('2d');

/* ------------------------------------------------------------ DOM helpers */

const el = {};
for (const id of [
  'hpText', 'hpMaxText', 'bpText', 'hpBar', 'bpBar', 'levelLabel', 'morphName', 'morphGlyph', 'morphKey', 'areaKicker', 'areaTitle', 'areaSub',
  'speedText', 'altText', 'compassStrip', 'signalHeading', 'nearPrompt', 'nearName', 'nearAction', 'nearKey', 'flightHint', 'flightControls',
  'battleControls', 'battleHUD', 'battleHint', 'enemyKicker', 'enemyName', 'enemyBar', 'enemyPhase', 'attackWarning', 'gaugeCount', 'chargeState',
  'targetInfo', 'stormCost', 'mendCost', 'tonicCost', 'radarLabel', 'trialHUD', 'toast', 'banner', 'saveNotice', 'flash', 'objective',
  'dialogueKey', 'speaker', 'dialogueText', 'dialogueCount', 'modalPane', 'resultGrade', 'rankLabel', 'resultTitle', 'resultTime', 'resultDodges',
  'resultHits', 'resultRewards', 'resultBest', 'resultFoot', 'endingText', 'endingStats', 'endingExtra', 'continueBtn', 'beginBtn', 'difficultyBtn', 'scanlines',
]) el[id] = $(id);
const bannerParts = { small: el.banner.querySelector('.small'), big: el.banner.querySelector('.big'), under: el.banner.querySelector('.under') };
const sealDots = [...document.querySelectorAll('.sealDot')];
const gaugeEls = [...document.querySelectorAll('.gauge')].map((g) => ({ box: g, fill: g.querySelector('div') }));
const commandButtons = [...document.querySelectorAll('#commands button')];
const commandKeys = [...document.querySelectorAll('#commands .key')];

// HUD writes only when a value changes.
const txt = (e, v) => {
  v = String(v);
  if (e._txt !== v) {
    e._txt = v;
    e.textContent = v;
  }
};
const htm = (e, v) => {
  if (e._htm !== v) {
    e._htm = v;
    e.innerHTML = v;
  }
};
const sty = (e, k, v) => {
  const key = `_s_${k}`;
  if (e[key] !== v) {
    e[key] = v;
    e.style[k] = v;
  }
};
const show = (e, on) => e.classList.toggle('hidden', !on);

/* ------------------------------------------------------------ small rules */

const isBattleView = () =>
  !!battle &&
  (['battle', 'victoryWindup', 'result', 'death'].includes(mode) ||
    (mode === 'modal' && (modalFrom === 'battle' || (modalFrom === 'dialogue' && dialogueFrom === 'battle'))) ||
    (mode === 'dialogue' && dialogueFrom === 'battle'));
const activeForm = () => FORMS[player.form];
const hpTotal = () => (battle ? battle.targets.reduce((s, t) => s + Math.max(0, t.hp), 0) : 0);
const maxHpTotal = () => (battle ? battle.targets.reduce((s, t) => s + t.max, 0) : 0);
const living = () => (battle ? battle.targets.filter((t) => t.hp > 0) : []);
const distPOI = (p) => Math.hypot(player.p.x - p.x, player.p.z - p.z);
const goal = () => POIS[progress.seals.indexOf(false) >= 0 ? progress.seals.indexOf(false) : 3];
const formatTime = (t) => `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
const formatTenths = (t) => `${formatTime(t)}.${Math.floor((t * 10) % 10)}`;
const relativeQ = () => (battle ? (((Math.round(battle.angle / (Math.PI / 2)) - battle.facing) % 4) + 4) % 4 : 0);
const selectedTarget = () => battle?.targets[battle.selected] || null;
const targetWeak = (t) => (battle?.id === 3 && battle.phase === 2 && t.index === 1 ? 0 : t.weak);
const exposed = (t) => relativeQ() === targetWeak(t) && !battle.moving;
const computeMaxHp = () => 520 + (player.level - 1) * 60 + (progress.wyrm ? 80 : 0);
const tonicUsable = () => player.tonics > 0 && player.hp < player.maxHp;
const prompt = () => PROMPTS[input.source] || PROMPTS.keyboard;
const targetPos = (t, out = new THREE.Vector3()) => worldPoint(t.anchor, t.local, out);
const currentSignal = () => (guide && guideTarget !== null ? POIS[guideTarget] : goal());

function isDone(p) {
  switch (p.type) {
    case 'seal': return progress.seals[p.id];
    case 'gate': return progress.complete;
    case 'camp': return progress.camp;
    case 'memory': return progress.memories.includes(p.id);
    case 'trial': return progress.trial;
    case 'lair': return progress.wyrm;
    default: return false;
  }
}
/** Hidden from markers, the radar and the inspect prompt once finished. */
const spent = (p) => (p.type === 'seal' && progress.seals[p.id]) || (p.type === 'memory' && progress.memories.includes(p.id)) || (p.type === 'lair' && progress.wyrm);

/* ------------------------------------------------------------ saving */

function saveOptions() {
  writeStore(OPT_KEY, options);
}
function snapshotSave() {
  const p = battle && mode !== 'explore' ? battle.returnPos : player.p;
  return {
    v: 1,
    player: { x: p.x, y: p.y, z: p.z, yaw: player.yaw, hp: player.hp, bp: player.bp, tonics: player.tonics, form: player.form },
    progress: JSON.parse(JSON.stringify(progress)),
    stats: JSON.parse(JSON.stringify(stats)),
    difficulty: options.difficulty,
  };
}
function validSave(s) {
  return !!(s && s.v === 1 && s.player && Number.isFinite(s.player.x) && Number.isFinite(s.player.z) && s.progress && Array.isArray(s.progress.seals) && s.progress.seals.length === 3);
}
function saveGame(silent = false) {
  sessionSave = snapshotSave();
  const persisted = writeStore(SAVE_KEY, sessionSave);
  if (!silent) {
    el.saveNotice.textContent = persisted ? '◇ CHECKPOINT SAVED' : '◇ CHECKPOINT KEPT FOR THIS SESSION';
    saveTime = 3.1;
    el.saveNotice.style.opacity = '1';
  }
  syncContinue();
}
function syncContinue() {
  const ok = validSave(sessionSave);
  const done = ok && !!sessionSave.progress.complete;
  show(el.continueBtn, ok);
  el.continueBtn.textContent = done ? 'RETURN TO THE HOLLOW SEA' : 'CONTINUE JOURNEY';
  el.beginBtn.className = ok ? 'secondary' : 'primary';
  el.beginBtn.textContent = ok ? 'BEGIN A NEW JOURNEY' : 'BEGIN JOURNEY';
}
function applySave(s) {
  if (!validSave(s)) return false;
  const p = s.player;
  const sp = s.progress;
  progress = {
    seals: sp.seals.map(Boolean),
    memories: Array.isArray(sp.memories) ? [...new Set(sp.memories.filter((x) => x === 5 || x === 6))] : [],
    camp: !!sp.camp,
    complete: !!sp.complete,
    trial: !!sp.trial,
    trialGold: !!sp.trialGold,
    trialBest: Number.isFinite(sp.trialBest) && sp.trialBest > 0 ? sp.trialBest : null,
    wyrm: !!sp.wyrm,
  };
  player.level = 1 + progress.seals.filter(Boolean).length;
  player.maxHp = computeMaxHp();
  player.p.set(clamp(p.x, -570, 570), Number.isFinite(p.y) ? clamp(p.y, 15, 180) : 50, clamp(p.z, -1270, 280));
  player.yaw = Number.isFinite(p.yaw) ? p.yaw : 0;
  player.hp = clamp(Number(p.hp) || player.maxHp, 1, player.maxHp);
  player.bp = clamp(Number(p.bp) || 0, 0, 100);
  player.tonics = clamp(Math.floor(Number(p.tonics) || 0), 0, 99);
  player.form = clamp(Math.floor(Number(p.form) || 0), 0, 3);
  player.speed = 0;
  stats = { ...freshStats(), ...(s.stats && typeof s.stats === 'object' ? s.stats : {}) };
  if (!Array.isArray(stats.ranks)) stats.ranks = [];
  stats.ranks = stats.ranks.filter((r) => RANK_VALUE[r]);
  for (const k of ['time', 'battles', 'dodges', 'hits', 'damage', 'distance']) if (!Number.isFinite(stats[k])) stats[k] = 0;
  options.difficulty = s.difficulty === 'veteran' ? 'veteran' : 'explorer';
  syncOptions();
  applyForm(player.form, false);
  return true;
}
/** Returns whether this run beat the stored record, and the record before it. */
function recordBattle(id, rank, time) {
  const prev = records.battles[id] || null;
  const better = !prev || RANK_VALUE[rank] > RANK_VALUE[prev.rank] || (rank === prev.rank && time < prev.time);
  if (better) {
    records.battles[id] = { rank, time };
    saveRecords();
  }
  return { better, prev, best: records.battles[id] };
}

/* ------------------------------------------------------------ feedback */

function toast(text, color = '') {
  if (mode === 'title') return;
  el.toast.textContent = text;
  el.toast.style.color = color || 'var(--paper)';
  el.toast.style.opacity = '1';
  toastTime = 2.7;
}
function banner(kicker, title, sub = '', duration = 4) {
  bannerParts.small.textContent = kicker;
  bannerParts.big.textContent = title;
  bannerParts.under.textContent = sub;
  el.banner.style.opacity = '1';
  bannerTime = duration;
}
function shake(power = 0.4, time = 0.35) {
  if (!options.motion) return;
  shakePower = Math.max(shakePower, power);
  shakeTime = Math.max(shakeTime, time);
}

/* ------------------------------------------------------------ effects */

const effects = [];
const floatTexts = [];
const burstPool = [];
const BURST_MAX = 32;
const UP = V(0, 1, 0);
const _bd = V();
const _bs = V();
const _bu = V();
const _p0 = V();
const _p1 = V();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _eul = new THREE.Euler(0, 0, 0, 'YXZ');
const _sc = V();

function pulse(pos, color = '83d6bd', size = 20, duration = 1, vertical = false) {
  const m = material(color, 3, 0.8, true);
  const n = mesh(G_PULSE, m);
  n.position.copy(pos);
  if (vertical) n.rotation.x = Math.PI / 2;
  fxRoot.add(n);
  effects.push({ kind: 'pulse', node: n, mat: m, t: 0, max: duration, size });
  return n;
}

/** Debris: one pooled instanced mesh per burst instead of a mesh per shard. */
function burst(pos, color = 'd6bf8a', count = 22, force = 12) {
  let b = burstPool.pop();
  if (!b) {
    const m = material('ffffff', 3, 1, false, true);
    const im = new THREE.InstancedMesh(G_ROCK.buffer(), materialFor(m), BURST_MAX);
    im.userData.mat = m;
    im.frustumCulled = false;
    b = { kind: 'burst', node: im, mat: m, bits: Array.from({ length: BURST_MAX }, () => ({ p: V(), v: V(), s: V(), rx: 0, rz: 0 })), t: 0, max: 1.15, count: 0 };
  }
  b.count = Math.min(BURST_MAX, kit.detail(count, 4));
  b.t = 0;
  b.mat.set(color);
  b.mat.alpha = 1;
  b.node.count = b.count;
  for (let i = 0; i < b.count; i++) {
    const bit = b.bits[i];
    bit.p.copy(pos);
    bit.v.set(random(-1, 1), random(-0.4, 1.1), random(-1, 1)).normalize().multiplyScalar(random(force * 0.2, force));
    bit.s.set(random(0.12, 0.35), random(0.16, 0.6), random(0.12, 0.36));
    bit.rx = 0;
    bit.rz = 0;
  }
  placeBurst(b, 0);
  fxRoot.add(b.node);
  effects.push(b);
}
function placeBurst(b, f) {
  for (let i = 0; i < b.count; i++) {
    const bit = b.bits[i];
    _eul.set(bit.rx, 0, bit.rz, 'YXZ');
    _q.setFromEuler(_eul);
    _sc.copy(bit.s).multiplyScalar(1 - f * 0.75);
    _m4.compose(bit.p, _q, _sc);
    b.node.setMatrixAt(i, _m4);
  }
  b.node.instanceMatrix.needsUpdate = true;
}

function beam(a, b, color = '87e5c3', arc = 0, thick = 0.13, duration = 0.42) {
  _bd.subVectors(b, a).normalize();
  const side = _bs.crossVectors(_bd, UP).normalize().multiplyScalar(random(-4, 4));
  const point = (t, out) => out.copy(a).lerp(b, t).add(_bu.set(0, Math.sin(t * Math.PI) * arc, 0)).addScaledVector(side, Math.sin(t * Math.PI));
  const g = new Geo();
  const steps = 18;
  for (let i = 0; i < steps; i++) {
    const seg = tubeGeo(point(i / steps, _p0), point((i + 1) / steps, _p1), thick, thick * 0.9, 4);
    for (const x of seg.data) g.data.push(x);
  }
  const m = material(color, 3, 0.92, true);
  const n = mesh(g, m);
  fxRoot.add(n);
  effects.push({ kind: 'beam', node: n, mat: m, t: 0, max: duration });
}

function floatText(pos, text, color = '#e6dfc1', big = false) {
  floatTexts.push({ p: pos.clone(), text: String(text), color, t: 0, max: 1.6, big });
}
function retireEffect(e) {
  fxRoot.remove(e.node);
  if (e.kind === 'beam') e.node.geometry.dispose();
  else if (e.kind === 'burst') burstPool.push(e);
}
function clearEffects() {
  for (const e of effects) retireEffect(e);
  effects.length = 0;
  floatTexts.length = 0;
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const f = e.t / e.max;
    if (f >= 1) {
      retireEffect(e);
      effects.splice(i, 1);
      continue;
    }
    if (e.kind === 'pulse') {
      e.node.scale.setScalar(mix(1, e.size, 1 - Math.pow(1 - f, 2)));
      e.mat.alpha = (1 - f) * 0.75;
      e.node.rotation.y += dt * 0.3;
    } else if (e.kind === 'burst') {
      for (let k = 0; k < e.count; k++) {
        const bit = e.bits[k];
        bit.p.addScaledVector(bit.v, dt);
        bit.v.y -= dt * 5.5;
        bit.rx += dt * 2.2;
        bit.rz += dt;
      }
      placeBurst(e, f);
      e.mat.alpha = 1 - f;
    } else e.mat.alpha = Math.pow(1 - f, 0.5) * 0.9;
  }
  for (let i = floatTexts.length - 1; i >= 0; i--) {
    const f = floatTexts[i];
    f.t += dt;
    f.p.y += dt * 3.8;
    if (f.t >= f.max) floatTexts.splice(i, 1);
  }
}

/* ------------------------------------------------------------ view state */

function setMode(m) {
  mode = m;
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
  orbitLatch = 0;
  navReset();
  refreshView();
  input.settle();
  if (input.source === 'gamepad' && (m === 'title' || m === 'result' || m === 'death' || m === 'ending')) navTo(0);
}

function refreshView() {
  const titleView = mode === 'title' || (mode === 'modal' && modalFrom === 'title');
  show($('title'), titleView);
  show($('gameUI'), !titleView);
  show($('dialogue'), mode === 'dialogue' || (mode === 'modal' && modalFrom === 'dialogue'));
  show($('modal'), mode === 'modal');
  show($('result'), mode === 'result');
  show($('ending'), mode === 'ending');
  show($('death'), mode === 'death');
  const bv = isBattleView();
  document.body.classList.toggle('in-battle', bv);
  show(el.battleHUD, bv);
  for (const id of ['flightControls', 'speedPanel', 'compass', 'flightHint']) $(id).classList.toggle('hidden', bv || mode === 'ending');
  el.nearPrompt.classList.add('hidden');
  el.objective.classList.toggle('battleObjective', bv);
  txt(el.areaKicker, bv ? 'TACTICAL ENGAGEMENT' : trial ? 'COURIER’S WIND / TRIAL' : 'FIELD RECORD / 01');
  txt(el.areaTitle, bv ? 'Combat' : 'The Hollow Sea');
  txt(el.areaSub, bv ? 'HOLD POSITION TO CHARGE' : 'AWAKEN THE THREE SEALS');
  show(el.trialHUD, !!trial && !bv);
  for (const b of world.beacons) if (b.poi.type === 'lair') b.glow.visible = !progress.wyrm;
  syncPrompts();
  syncTouch();
  updateUI();
}

/** Button prompts follow the device in use. */
function syncPrompts() {
  const P = prompt();
  for (const k of commandKeys) txt(k, P[k.dataset.k] ?? '');
  txt(el.morphKey, P.form);
  el.morphKey.style.display = P.form ? '' : 'none';
  txt(el.nearKey, P.near);
  txt(el.dialogueKey, P.next);
  htm(el.flightControls, P.flight);
  htm(el.battleControls, P.battle);
  txt(el.resultFoot, `${P.confirm} TO CONTINUE · PROGRESS SAVED`);
}

let touchKey = '';
/** The kit's on-screen controls: flight and battle each get their own set; menus hide them. */
function syncTouch() {
  const t = kit.touch;
  if (!t) return;
  const play = mode === 'explore' || mode === 'battle';
  const bv = mode === 'battle';
  const tonic = play && !bv && tonicUsable();
  const key = `${play}|${bv}|${!!trial}|${tonic}`;
  if (key === touchKey) return;
  touchKey = key;
  t.suspend(!play, 'game');
  t.setShown('move', !bv);
  t.setShown('boost', !bv);
  t.setShown('tonic', tonic);
  t.setShown('orbitL', bv);
  t.setShown('orbitR', bv);
  t.setLabel('primary', bv ? 'Lock' : 'Inspect');
  t.setLabel('signal', bv ? 'Target' : trial ? 'Quit' : 'Signal');
}

/* ------------------------------------------------------------ menus with keys, pad and touch */

let navIndex = -1;
let navEl = null;
let navDir = 0;
let navTimer = 0;

/** The buttons of the screen in front, in the order a controller walks them. */
function navItems() {
  let groups;
  switch (mode) {
    case 'title': groups = ['#title .titleButtons button', '#difficultyBtn', '#title .edition button', '#titleTools button']; break;
    case 'modal': groups = ['#modalPane button:not(.close)']; break;
    case 'dialogue': groups = ['#dialogue button']; break;
    case 'result': groups = ['#result button']; break;
    case 'death': groups = ['#death button']; break;
    case 'ending': groups = ['#ending button']; break;
    default: return [];
  }
  return groups.flatMap((sel) => [...document.querySelectorAll(sel)]).filter((b) => b.offsetParent !== null && !b.disabled);
}
function navReset() {
  if (navEl) navEl.classList.remove('padFocus');
  navEl = null;
  navIndex = -1;
  navDir = 0;
  // A button focused from a menu must not keep swallowing Space once play resumes.
  const a = document.activeElement;
  if (a && a !== document.body && a.tagName === 'BUTTON') a.blur();
}
function navTo(i) {
  const items = navItems();
  if (!items.length) return;
  navIndex = ((i % items.length) + items.length) % items.length;
  if (navEl) navEl.classList.remove('padFocus');
  navEl = items[navIndex];
  navEl.classList.add('padFocus');
  navEl.focus({ preventScroll: true });
  navEl.scrollIntoView?.({ block: 'nearest' });
}
function menuNav(dt) {
  const mv = input.vector('move');
  const want = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  if (!want) {
    navDir = 0;
    return;
  }
  if (want !== navDir) {
    navDir = want;
    navTimer = 0.38;
  } else {
    navTimer -= dt;
    if (navTimer > 0) return;
    navTimer = 0.14;
  }
  audio.sfx('ui');
  if (navIndex < 0 || !navEl || !navEl.isConnected || navEl.offsetParent === null) navTo(0);
  else navTo(navIndex + want);
}
function navClick() {
  if (navEl && navEl.isConnected && navEl.offsetParent !== null) {
    navEl.click();
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ dialogue */

function showDialogue(lines, done, from = null) {
  dialogueFrom = from || mode;
  dialogueLines = lines;
  dialogueIndex = 0;
  dialogueDone = done;
  setMode('dialogue');
  renderDialogue();
  audio.sfx('ui');
}
function renderDialogue() {
  const d = dialogueLines[dialogueIndex];
  el.speaker.textContent = d.speaker || 'NYRA / RIDER';
  el.dialogueText.textContent = d.text;
  el.dialogueCount.textContent = `${String(dialogueIndex + 1).padStart(2, '0')} / ${String(dialogueLines.length).padStart(2, '0')}`;
}
function nextDialogue() {
  if (mode !== 'dialogue') return;
  audio.sfx('ui');
  dialogueIndex++;
  if (dialogueIndex >= dialogueLines.length) {
    const fn = dialogueDone;
    dialogueDone = null;
    setMode(dialogueFrom === 'battle' ? 'battle' : 'explore');
    if (fn) fn();
  } else renderDialogue();
}

/* ------------------------------------------------------------ journeys */

function clearBattle() {
  if (battleGroup) {
    scene.remove(battleGroup);
    disposeTree(battleGroup);
  }
  battleGroup = null;
  battle = null;
  clearEffects();
}
function newGame() {
  unlockAudio();
  clearBattle();
  closeTrial(false);
  player = { p: V(0, groundHeight(0, 240) + 34, 240), yaw: -0.27, speed: 0, hp: 520, bp: 100, maxHp: 520, tonics: 3, form: 0, level: 1 };
  progress = freshProgress();
  stats = freshStats();
  guide = false;
  autoSave = 0;
  applyForm(0, false);
  dragon.root.position.copy(player.p);
  dragon.root.rotation.y = -player.yaw;
  camPos.copy(player.p).add(_tmp.set(0, 13, 34));
  camTarget.copy(player.p).add(_tmp.set(0, 2, -24));
  setMode('explore');
  showDialogue(
    [
      { speaker: 'NYRA / RIDER', text: 'The sea is gone. But the old gate is still listening. Three seals lie beneath this sand.' },
      { speaker: 'NYRA / RIDER', text: 'Find their signals, Vesper. We will give the gate a voice again.' },
    ],
    () => {
      banner('FIELD RECORD / 01', 'THE HOLLOW SEA', `Find the first seal. Press ${prompt().signal} to follow its signal.`, 4.6);
      saveGame();
    },
    'explore'
  );
}
function continueGame() {
  if (!validSave(sessionSave)) {
    toast('No checkpoint is available.');
    return;
  }
  unlockAudio();
  clearBattle();
  closeTrial(false);
  applySave(sessionSave);
  guide = false;
  const g = goal();
  player.yaw = Math.atan2(g.x - player.p.x, -(g.z - player.p.z));
  dragon.root.position.copy(player.p);
  setMode('explore');
  banner('JOURNEY RESUMED', 'THE HOLLOW SEA', progress.complete ? 'Free flight. The gate stands open.' : 'Your last checkpoint is restored.', 3.1);
}
function titleStart() {
  if (validSave(sessionSave)) continueGame();
  else newGame();
}
/** After the ending: back to the sea with everything kept, for the trial, the wyrm and the memories. */
function freeFlight() {
  if (mode !== 'ending') return;
  clearBattle();
  player.p.set(0, groundHeight(0, -960) + 34, -960);
  player.yaw = Math.PI;
  player.speed = 0;
  guide = false;
  setMode('explore');
  banner('THE HOLLOW SEA', 'FREE FLIGHT', 'The courier’s wind and the Sunken Keel still wait.', 4);
  saveGame();
}
function applyForm(index, announce = true) {
  player.form = clamp(index, 0, 3);
  const f = activeForm();
  dragon.hide.set(f.body);
  dragon.wingMat.set(f.wing);
  dragon.body.scale.set(player.form === 3 ? 1.13 : 1, player.form === 3 ? 1.12 : 1, 1);
  if (announce) {
    morphTime = 1;
    audio.sfx('seal');
    pulse(player.p, '9acbaf', 14, 0.8);
    toast(`${f.name} · Gauge ${f.time.toFixed(2)} s · Power ×${f.damage.toFixed(2)}`, 'var(--teal)');
    input.rumble(0.2, 80);
  }
  updateUI();
}

/* ------------------------------------------------------------ battle */

function startBattle(id, retry = false) {
  const data = ENCOUNTERS[id];
  if (!data) return;
  const returnPos = player.p.clone();
  const returnYaw = player.yaw;
  if (!retry) battleCheckpoint = snapshotSave();
  clearBattle();
  closeTrial(false);
  const poi = POIS[data.poi];
  const center = V(poi.x, groundHeight(poi.x, poi.z) + 43, poi.z + (id === 3 ? 95 : 100));
  battleGroup = node();
  battleGroup.position.copy(center);
  scene.add(battleGroup);
  battle = {
    id, data, center, returnPos, returnYaw, actors: [], targets: [], selected: 0, gauges: 1.05, angle: 0, targetAngle: 0, moveStart: 0, moveTime: 0,
    moveDuration: 0.9, moving: false, queued: 0, facing: 0, facingAngle: 0, phase: 1, timer: data.interval + 1.4, attackNo: 0, danger: data.patterns[0].slice(),
    warned: false, time: 0, hits: 0, dodges: 0, damageTaken: 0, cooldown: 0.7, entry: 2.2, finished: false, phaseChanged: false, dive: 0,
  };
  if (data.model === 'skimmer' || data.model === 'hunter') {
    for (let i = 0; i < 2; i++) {
      const model = makeSkimmer(data.model === 'hunter' ? 1 : 0);
      const actor = node();
      actor.position.set(i === 0 ? -9.5 : 9.5, i === 0 ? 1 : -1.5, i === 0 ? -2 : 2);
      actor.add(model.root);
      battleGroup.add(actor);
      battle.actors.push({ node: actor, model, baseY: actor.position.y, seed: i * 1.7 });
      battle.targets.push({ index: i, name: data.model === 'hunter' ? `Echo hunter ${i + 1}` : `Skimmer ${i + 1}`, anchor: model.root, local: V(0, 1.2, 0), hp: data.hps[i], max: data.hps[i], armor: data.model === 'hunter' ? 55 : 30, weak: 2, actor, dead: false });
    }
  } else if (data.model === 'wyrm') {
    const model = makeWyrm();
    const actor = node();
    actor.add(model.root);
    battleGroup.add(actor);
    battle.actors.push({ node: actor, model, baseY: 0, seed: 0 });
    const names = ['Crystal crown', 'Glass sac', 'Stinger'];
    for (let i = 0; i < 3; i++) battle.targets.push({ index: i, name: names[i], anchor: model.nodes[i], local: null, hp: data.hps[i], max: data.hps[i], armor: 70, weak: i, actor, dead: false });
    battle.selected = 0;
  } else {
    const model = makeSentinel(id === 3);
    const actor = node();
    actor.add(model.root);
    battleGroup.add(actor);
    battle.actors.push({ node: actor, model, baseY: 0, seed: 0 });
    const names = id === 3 ? ['Left memory core', 'The hollow heart', 'Right memory core'] : ['Left relay', 'Choir heart', 'Right relay'];
    for (let i = 0; i < 3; i++) battle.targets.push({ index: i, name: names[i], anchor: model.nodes[i], local: null, hp: data.hps[i], max: data.hps[i], armor: id === 3 ? 110 : 90, weak: i === 1 ? 2 : i === 0 ? 3 : 1, actor, dead: false });
    battle.selected = 1;
  }
  player.speed = 0;
  guide = false;
  lockHeld = false;
  player.p.copy(center).add(_tmp.set(0, 0, 34));
  dragon.root.position.copy(player.p);
  dragon.root.rotation.y = 0;
  setMode('battle');
  audio.sfx(id === 3 ? 'roar' : id === WYRM ? 'dive' : 'warn');
  banner(
    id === 3 ? 'THE GATE AWAKENS' : id === WYRM ? 'THE KEEL STIRS' : 'HOSTILE CONTACT',
    data.name.toUpperCase(),
    id === 3 ? 'The last voice belongs to a weapon.' : id === WYRM ? 'Glass breaks. Find the soft places.' : 'Circle. Charge. Strike.',
    3.1
  );
  el.battleHint.textContent = data.hint;
  input.rumble(0.4, 200);
  updateUI();
  saveGame(true);
}

function orbit(direction) {
  if (mode !== 'battle' || !battle || battle.entry > 0.8) return;
  const b = battle;
  if (b.moving) {
    // Buffer a press made late in a move, so quick double taps are not lost.
    if (b.moveTime > b.moveDuration * 0.4) b.queued = direction;
    return;
  }
  b.moving = true;
  b.queued = 0;
  b.moveStart = b.angle;
  b.targetAngle = b.angle + (direction * Math.PI) / 2;
  b.moveTime = 0;
  b.moveDuration = player.form === 2 ? 0.68 : player.form === 3 ? 1.05 : 0.86;
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
  audio.sfx('move');
  updateUI();
}
function changeTarget() {
  if (mode !== 'battle') return;
  const b = battle;
  for (let i = 1; i <= b.targets.length; i++) {
    const n = (b.selected + i) % b.targets.length;
    if (b.targets[n].hp > 0) {
      b.selected = n;
      audio.sfx('ui');
      break;
    }
  }
  updateUI();
}
function actionCost(n) {
  const f = activeForm();
  return { gauge: n === 3 ? 3 : n === 4 ? 2 : 1, bp: n === 3 ? Math.round(26 * f.spirit) : n === 4 ? Math.round(20 * f.spirit) : 0 };
}
function canAct(n) {
  if (mode !== 'battle' || !battle || battle.moving || battle.cooldown > 0 || battle.entry > 0.8) return false;
  const c = actionCost(n);
  return battle.gauges + 1e-6 >= c.gauge && player.bp >= c.bp && (n !== 5 || player.tonics > 0) && ((n !== 4 && n !== 5) || player.hp < player.maxHp);
}
function action(n, forcedLocks = null) {
  unlockAudio();
  n = Number(n);
  if (n === 5 && mode === 'explore') {
    if (player.tonics <= 0) {
      audio.sfx('deny');
      toast('No tonics remain. Rest at the camp.');
      return;
    }
    if (player.hp >= player.maxHp) {
      toast('Vesper is already at full health.');
      return;
    }
    player.tonics--;
    healPlayer(Math.round(player.maxHp * 0.48));
    toast('Tonic used.');
    saveGame();
    return;
  }
  if (mode !== 'battle' || !battle) return;
  const b = battle;
  const cost = actionCost(n);
  if (!canAct(n)) {
    audio.sfx('deny');
    if (b.moving) toast('Finish moving before you attack.');
    else if (b.gauges < cost.gauge) toast(`Wait for ${cost.gauge} full action gauge${cost.gauge > 1 ? 's' : ''}.`);
    else if (player.bp < cost.bp) toast('Not enough spirit. Use the gun or laser.');
    else if (n === 5 && player.tonics < 1) toast('No tonics remain.');
    else if ((n === 4 || n === 5) && player.hp >= player.maxHp) toast('Vesper is already at full health.');
    return;
  }
  const f = activeForm();
  b.gauges = Math.max(0, b.gauges - cost.gauge);
  player.bp = Math.max(0, player.bp - cost.bp);
  b.cooldown = n === 3 ? 1.2 : 0.33;
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
  let t = selectedTarget();
  if (!t || t.hp <= 0) {
    changeTarget();
    t = selectedTarget();
  }
  const source = worldPoint(dragon.root, V(0, 1.1, -6.4));
  if (n === 1) {
    const weak = exposed(t);
    const raw = 96 * f.damage * (weak ? 2.05 : 1) * (t.armor > 0 && !weak ? 0.47 : 1);
    beam(worldPoint(dragon.rider, V(0.55, 0.4, -2)), targetPos(t), 'f4d391', 1.1, 0.1, 0.19);
    audio.sfx('gun');
    hitTarget(t, Math.round(raw), weak, 7);
    shake(0.12, 0.12);
    input.rumble(weak ? 0.35 : 0.2, 70);
  } else if (n === 2) {
    const all = living();
    const num = forcedLocks === null ? all.length : clamp(forcedLocks, 1, all.length);
    all.sort((a, c) => (a.index === t.index ? -1 : c.index === t.index ? 1 : a.index - c.index));
    audio.sfx('laser');
    for (let i = 0; i < num; i++) {
      const trg = all[i];
      const p = targetPos(trg);
      const weak = exposed(trg);
      const raw = 76 * f.damage * (trg.armor > 0 && !weak ? 0.79 : 1);
      beam(source.clone().add(_tmp.set(i * 0.22, 0, 0)), p, '94ebc2', 6 + i * 2.4, 0.15, 0.48);
      beam(source, p, '56a8b3', 9 + i, 0.3, 0.35);
      hitTarget(trg, Math.round(raw), false, 27);
    }
    shake(0.16, 0.2);
    input.rumble(0.3, 120);
  } else if (n === 3) {
    audio.sfx('storm');
    pulse(player.p, 'a7e6ca', 32, 1.45);
    pulse(player.p, 'a7e6ca', 24, 1.3, true);
    for (const trg of living()) {
      const p = targetPos(trg);
      for (let i = 0; i < 3; i++) beam(source, p, i % 2 ? 'bbecd0' : '88c8df', 12 + i * 5, 0.25, 0.95);
      pulse(p, 'b7e9d2', 15, 0.8, true);
      hitTarget(trg, Math.round((268 + (trg.index === t.index ? 90 : 0)) * f.damage), true, 85);
    }
    shake(0.48, 0.8);
    input.rumble(0.7, 380);
    toast('TEMPEST · Armor-piercing strike', 'var(--teal)');
  } else if (n === 4) {
    healPlayer(Math.round(236 * f.heal));
    toast('MEND · Health restored', 'var(--teal)');
  } else if (n === 5) {
    player.tonics--;
    healPlayer(Math.round(player.maxHp * 0.48));
    toast('TONIC · Health restored', 'var(--teal)');
  }
  checkBattleState();
  updateUI();
}
function startLock() {
  if (mode !== 'battle' || !battle) return;
  if (canAct(2)) {
    lockHeld = true;
    lockTime = 0;
    lockCount = 1;
    lockPing = 1;
    audio.sfx('lock');
  } else {
    audio.sfx('deny');
    toast(battle.moving ? 'Finish moving before you lock a target.' : 'Wait for a full action gauge.');
  }
}
function releaseLock() {
  const n = Math.max(1, lockCount);
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
  if (mode === 'battle') action(2, n);
}
function healPlayer(amount) {
  const restored = Math.min(player.maxHp - player.hp, amount);
  player.hp += restored;
  audio.sfx('heal');
  pulse(player.p, '9fdfb5', 12, 1.2);
  pulse(_tmp.copy(player.p).add(_tmp2.set(0, 3, 0)), '9fdfb5', 9, 1.1);
  burst(player.p, 'bce6b8', 20, 6);
  floatText(player.p, `+${restored}`, '#bde0a8', true);
}
function hitTarget(t, damage, weak = false, armorDamage = 0) {
  if (t.hp <= 0) return;
  const p = targetPos(t);
  const armorBefore = t.armor;
  const glass = battle.data.model === 'wyrm';
  damage = Math.min(Math.round(damage), t.hp);
  t.hp = Math.max(0, t.hp - damage);
  t.armor = Math.max(0, t.armor - armorDamage);
  stats.damage += damage;
  floatText(p, weak ? `${damage}  WEAK` : String(damage), weak ? '#f4d290' : '#e6f1d2', weak);
  burst(p, t.armor > 0 ? (glass ? 'bfeee0' : 'd1b482') : '8dd5ba', t.hp <= 0 ? 30 : 9, t.hp <= 0 ? 15 : 7);
  if (armorBefore > 0 && t.armor === 0 && t.hp > 0) {
    audio.sfx(glass ? 'glass' : 'break');
    floatText(p.clone().add(_tmp.set(0, 4, 0)), glass ? 'GLASS CRACKED' : 'SHELL BROKEN', '#a3ddc2');
    pulse(p, '90d9c1', 9, 0.65, true);
  }
  if (t.hp === 0) {
    t.dead = true;
    audio.sfx(glass ? 'glass' : 'break');
    input.rumble(0.45, 160);
    if (battle.data.model === 'skimmer' || battle.data.model === 'hunter') t.actor.visible = false;
    else {
      setMat(t.anchor, MAT_DEAD);
      t.anchor.userData.dead = true;
      t.anchor.scale.setScalar(0.32);
    }
    if (battle.selected === t.index) {
      const next = battle.targets.find((x) => x.hp > 0);
      if (next) battle.selected = next.index;
    }
  }
}
function checkBattleState() {
  const b = battle;
  if (!b || mode !== 'battle') return;
  const hp = hpTotal();
  if (hp <= 0) {
    b.finished = true;
    victoryTimer = 2.5;
    setMode('victoryWindup');
    audio.sfx('win');
    for (const a of b.actors) {
      burst(worldPoint(a.node), 'd4c79d', 32, b.id === 3 ? 30 : 20);
      a.node.visible = false;
    }
    pulse(b.center, 'b2d8be', b.id === 3 ? 75 : 40, 1.9);
    shake(b.id === 3 ? 0.8 : 0.3, 0.65);
    input.rumble(0.6, 420);
    return;
  }
  if (b.phase !== 1 || hp > maxHpTotal() * 0.5) return;
  if (b.id === 3) {
    b.phase = 2;
    b.phaseChanged = true;
    b.timer = Math.max(b.timer, 5.2);
    b.warned = false;
    b.danger = [0, 1, 2];
    b.targets[1].armor = 0;
    audio.sfx('roar');
    banner('MUTATION / PHASE II', 'THE HOLLOW HEART', 'The heart is now weak at the front. Watch the safe sector.', 4.1);
    pulse(b.center, 'e2a575', 46, 1.3, true);
    shake(0.45, 0.7);
    input.rumble(0.6, 400);
    el.battleHint.textContent = 'Phase II: the heart is exposed at the front. Only one sector is safe during each ray attack. Bastion reduces damage and healing cost.';
  } else if (b.id === WYRM) {
    b.phase = 2;
    b.phaseChanged = true;
    b.timer = Math.max(b.timer, 5.2);
    b.warned = false;
    b.facing = (b.facing + 2) % 4;
    b.danger = [0, 1];
    b.dive = DIVE_TIME;
    for (const t of b.targets) if (t.hp > 0) t.armor = 0;
    audio.sfx('dive');
    audio.sfx('glass');
    banner('THE SAND GIVES WAY', 'GLASS RAIN', 'The wyrm dives and surfaces facing away. Its glass is brittle now.', 4.1);
    burst(b.center, 'b3a079', 30, 18);
    pulse(b.center, 'e6b27a', 46, 1.3, true);
    shake(0.45, 0.7);
    input.rumble(0.6, 400);
    el.battleHint.textContent = 'Phase II: the wyrm has turned. Two sectors are safe from each glass rain. Cracked glass takes full damage from every weapon.';
  }
}
function enemyAttack() {
  const b = battle;
  if (!b) return;
  const danger = b.danger.includes(relativeQ());
  const p = player.p.clone();
  const sources = b.targets.filter((t) => t.hp > 0).slice(0, 3);
  if (danger) {
    const base = b.data.damage * (b.phase === 2 ? 1.18 : 1) * (options.difficulty === 'veteran' ? 1.27 : 1);
    const raw = Math.round(base * activeForm().defense * (0.94 + rand() * 0.12));
    player.hp = Math.max(0, player.hp - raw);
    b.hits++;
    b.damageTaken += raw;
    stats.hits++;
    for (const t of sources) beam(targetPos(t), p, b.data.model === 'wyrm' ? 'bfeee0' : 'e7a275', 4, 0.23, 0.54);
    burst(p, 'e8bc8b', 24, 11);
    floatText(p, `−${raw}`, '#f2a987', true);
    audio.sfx('hurt');
    shake(0.57, 0.48);
    flashLevel = 0.21;
    input.rumble(0.85, 280);
    toast('Hit! Move into a green sector.', 'var(--red)');
  } else {
    b.dodges++;
    stats.dodges++;
    const miss = b.center.clone().add(_tmp.set(Math.sin(b.facingAngle) * 55, 0, Math.cos(b.facingAngle) * 55));
    for (const t of sources) beam(targetPos(t), miss, 'd49d70', 5, 0.21, 0.55);
    floatText(p, 'EVADED', '#a6d7be', true);
    audio.sfx('evade');
    input.rumble(0.15, 60);
    if (b.dodges === 1) toast('EVADED · Green sectors are safe', 'var(--teal)');
  }
  if (player.hp <= 0) {
    setMode('death');
    lockHeld = false;
    audio.sfx('roar');
    input.rumble(1, 500);
    return;
  }
  b.attackNo++;
  if (b.id > 0) {
    b.facing = (b.facing + (b.attackNo % 2 ? 1 : 3)) % 4;
    if (b.id === 3 && b.phase === 2) b.facing = (b.facing + 1) % 4;
  }
  const pats = b.phase === 2 && b.data.phase2 ? b.data.phase2 : b.data.patterns;
  b.danger = pats[b.attackNo % pats.length].slice();
  b.timer = b.data.interval * (b.phase === 2 ? 0.82 : 1) * (options.difficulty === 'veteran' ? 0.88 : 1);
  b.warned = false;
  updateUI();
}
function updateBattle(dt) {
  const b = battle;
  if (!b) return;
  b.time += dt;
  b.entry = Math.max(0, b.entry - dt);
  b.cooldown = Math.max(0, b.cooldown - dt);
  if (b.moving) {
    b.moveTime += dt;
    const f = clamp(b.moveTime / b.moveDuration, 0, 1);
    b.angle = mix(b.moveStart, b.targetAngle, smooth(f));
    if (f >= 1) {
      b.moving = false;
      b.angle = b.targetAngle;
      if (b.queued) {
        const d = b.queued;
        b.queued = 0;
        orbit(d);
      }
    }
  } else if (b.entry < 1.1) {
    const prev = Math.floor(b.gauges);
    b.gauges = Math.min(3, b.gauges + dt / activeForm().time);
    if (Math.floor(b.gauges) > prev) {
      audio.sfx('gauge');
      input.rumble(0.1, 40);
    }
  }
  if (b.dive > 0) b.dive = Math.max(0, b.dive - dt);
  b.facingAngle += angleDiff((b.facing * Math.PI) / 2, b.facingAngle) * Math.min(1, dt * 3.4);
  battleGroup.rotation.y = b.facingAngle;
  player.p.set(b.center.x + Math.sin(b.angle) * 34, b.center.y + Math.sin(visualTime * 2.4) * 0.5, b.center.z + Math.cos(b.angle) * 34);
  player.yaw = -b.angle;
  dragon.root.position.copy(player.p);
  dragon.root.rotation.y = b.angle;
  dragon.animate(visualTime, b.moving ? 60 : 22, b.moving ? angleDiff(b.targetAngle, b.moveStart) * -0.15 : 0, player.form, dt);
  const sink = b.dive > 0 ? Math.sin((1 - b.dive / DIVE_TIME) * Math.PI) * 16 : 0;
  for (const a of b.actors) {
    a.node.position.y = a.baseY + Math.sin(visualTime * 1.7 + a.seed) * 0.9 - sink;
    a.model.animate(visualTime + a.seed, b.phase);
  }
  if (lockHeld && !b.moving) {
    lockTime += dt;
    lockCount = clamp(1 + Math.floor(lockTime / 0.38), 1, Math.max(1, living().length));
    if (lockCount > lockPing) {
      lockPing = lockCount;
      audio.sfx('lock');
      input.rumble(0.12, 40);
    }
  }
  if (b.entry <= 0) {
    b.timer -= dt;
    const windup = options.difficulty === 'veteran' ? 2.2 : 3.1;
    if (b.timer <= windup && !b.warned) {
      b.warned = true;
      audio.sfx('warn');
    }
    if (b.timer <= 0) enemyAttack();
  }
}
function finishBattle() {
  const b = battle;
  if (!b) return;
  const rank = b.hits === 0 && b.time < 100 ? 'S' : b.hits <= 2 ? 'A' : b.hits <= 5 ? 'B' : 'C';
  b.rank = rank;
  stats.battles++;
  stats.ranks.push(rank);
  const oldMax = player.maxHp;
  let wyrmFirst = false;
  if (b.id < 3) {
    progress.seals[b.id] = true;
    player.level = 1 + progress.seals.filter(Boolean).length;
  } else if (b.id === 3) progress.complete = true;
  else if (b.id === WYRM) {
    wyrmFirst = !progress.wyrm;
    progress.wyrm = true;
  }
  player.maxHp = computeMaxHp();
  const heal = Math.min(player.maxHp - player.hp, Math.round(player.maxHp * 0.23) + player.maxHp - oldMax);
  const spirit = Math.min(100 - player.bp, 27);
  player.hp += heal;
  player.bp += spirit;
  const tonic = (rank === 'S' || rank === 'A' ? 1 : 0) + (wyrmFirst ? 2 : 0);
  player.tonics += tonic;
  const rec = recordBattle(b.id, rank, b.time);
  setMode('result');
  el.resultGrade.textContent = rank;
  el.rankLabel.textContent = { S: 'FLAWLESS', A: 'EXCELLENT', B: 'WELL FOUGHT', C: 'SURVIVOR' }[rank];
  el.resultTitle.textContent = b.id === 3 ? 'Silence, at last.' : b.id === WYRM ? 'The glass falls quiet.' : `${POIS[b.data.poi].name} recovered.`;
  el.resultTime.textContent = formatTime(b.time);
  el.resultDodges.textContent = b.dodges;
  el.resultHits.textContent = b.hits;
  const gains = `+${heal} HEALTH &nbsp; +${spirit} SPIRIT${tonic ? ` &nbsp; +${tonic} TONIC${tonic > 1 ? 'S' : ''}` : ''}`;
  el.resultRewards.innerHTML =
    b.id < 3
      ? `SEAL ${['I', 'II', 'III'][b.id]} RESTORED &nbsp; · &nbsp; LEVEL ${player.level}<br>${gains}`
      : b.id === WYRM
        ? `WYRM GLASS &nbsp; · &nbsp; +80 MAX HEALTH<br>${gains}`
        : 'WARDEN DEFEATED &nbsp; · &nbsp; ALL VOICES IN HARMONY<br>THE HOLLOW GATE IS OPEN';
  el.resultBest.textContent = rec.better
    ? rec.prev
      ? `NEW RECORD · BEFORE ${rec.prev.rank} · ${formatTime(rec.prev.time)}`
      : 'FIRST CLEAR · RECORD SET'
    : `RECORD · ${rec.best.rank} · ${formatTime(rec.best.time)}`;
  $('result').querySelector('.primary').textContent = b.id === 3 ? 'ENTER THE GATE' : 'CONTINUE FLIGHT';
  saveGame();
}
function resultContinue() {
  if (mode !== 'result' || !battle) return;
  const id = battle.id;
  const ret = battle.returnPos.clone();
  clearBattle();
  if (id === 3) {
    showEnding();
    return;
  }
  player.p.copy(ret);
  player.p.y = groundHeight(ret.x, ret.z) + 34;
  const g = goal();
  player.yaw = Math.atan2(g.x - player.p.x, -(g.z - player.p.z));
  player.speed = 0;
  guide = false;
  setMode('explore');
  audio.sfx('seal');
  const sig = prompt().signal;
  if (id === WYRM) banner('THE KEEL IS STILL', 'GLASS WYRM DEFEATED', 'Wyrm glass hardens Vesper’s hide. Maximum health +80.', 3.6);
  else if (progress.seals.every(Boolean) && !progress.complete) {
    showDialogue([{ speaker: 'NYRA / RIDER', text: 'Three voices. One gate. Whatever is waiting there has heard us.' }], () => banner('ALL SEALS RESTORED', 'THE HOLLOW GATE', `Press ${sig} to follow the last signal.`, 4), 'explore');
  } else banner('SEAL RESTORED', `${progress.seals.filter(Boolean).length} / 3 VOICES`, `Press ${sig} to follow the next signal.`, 3.3);
  saveGame();
}
function showEnding() {
  progress.complete = true;
  player.p.set(0, groundHeight(0, -1030) + 49, -1010);
  player.yaw = 0;
  player.speed = 15;
  setMode('ending');
  audio.sfx('seal');
  el.endingText.textContent =
    progress.memories.length === 2
      ? 'The lost names return to the gate. For the first time in a thousand years, it remembers who it was built to protect. Beyond it, something answers.'
      : 'For the first time in a thousand years, the gate hears a living voice. Beyond it, something answers.';
  const values = stats.ranks.map((x) => RANK_VALUE[x] || 1);
  const av = values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
  const rank = av >= 3.75 ? 'S' : av >= 2.75 ? 'A' : av >= 1.75 ? 'B' : 'C';
  el.endingStats.innerHTML = `<div><strong>${rank}</strong>CHAPTER RANK</div><div><strong>${formatTime(stats.time)}</strong>JOURNEY TIME</div><div><strong>${3 + progress.memories.length} / 5</strong>MEMORIES</div><div><strong>${stats.dodges}</strong>EVASIONS</div>`;
  const wind = progress.trialBest ? `COURIER’S WIND · BEST ${formatTenths(progress.trialBest)}${progress.trialGold ? ' · GOLD' : ''}` : 'THE COURIER’S WIND STILL BLOWS, UNRACED';
  const keel = progress.wyrm ? 'THE GLASS WYRM · DEFEATED' : 'SOMETHING STILL STIRS BENEATH THE SUNKEN KEEL';
  el.endingExtra.innerHTML = `${wind}<br>${keel}`;
  saveGame(true);
  pulse(V(0, groundHeight(0, -1115) + 60, -1115), 'b9d5b1', 70, 4, true);
}
function retryBattle(retreat = false) {
  if (mode !== 'death' || !battle) return;
  const id = battle.id;
  const cp = battleCheckpoint;
  clearBattle();
  if (cp) applySave(cp);
  player.hp = player.maxHp;
  player.bp = 100;
  player.tonics = Math.max(3, player.tonics);
  player.speed = 0;
  setMode('explore');
  if (retreat) {
    player.p.z = Math.min(280, player.p.z + 90);
    toast('Vesper has recovered. Choose your next move.');
    saveGame();
  } else startBattle(id, true);
}
function scanEnemy() {
  if (mode !== 'battle' || !battle) return;
  const t = selectedTarget();
  if (!t) return;
  showDialogue(
    [
      { speaker: 'TARGET DATA / ' + t.name.toUpperCase(), text: battle.data.lore },
      { speaker: 'VESPER / COMBAT LINK', text: `Selected target: ${t.name}. Health: ${t.hp} of ${t.max}. Weak side: ${['front', 'right', 'rear', 'left'][targetWeak(t)]}. ${battle.data.model === 'wyrm' ? 'Glass' : 'Armor'}: ${t.armor > 0 ? 'intact' : 'broken'}.` },
    ],
    () => {},
    'battle'
  );
}
/** Click or tap an enemy to select it; on touch, tap the selected one again for its data. */
function pickTarget(x, y, touch) {
  if (mode !== 'battle' || !battle) return;
  let closest = null;
  let min = touch ? 70 : 55;
  for (const t of living()) {
    const p = project(targetPos(t, _tmp));
    const d = Math.hypot(x - p.x, y - p.y);
    if (p.visible && d < min) {
      min = d;
      closest = t;
    }
  }
  if (!closest) return;
  if (touch && closest.index === battle.selected) {
    scanEnemy();
    return;
  }
  battle.selected = closest.index;
  audio.sfx('lock');
  updateUI();
}

/* ------------------------------------------------------------ the Courier's Wind */

function startTrial() {
  if (mode !== 'explore') return;
  const r = trialView.rings[0];
  trial = { next: 0, time: 0, countdown: 3, shown: 4 };
  guide = false;
  player.speed = 0;
  player.yaw = Math.atan2(r.x - player.p.x, -(r.z - player.p.z));
  trialView.group.visible = true;
  trialView.sync(0, visualTime);
  banner('THE COURIER’S WIND', 'READY', `Twelve rings. Gold under ${TRIAL_MEDALS.gold} s, silver under ${TRIAL_MEDALS.silver} s.`, 2.8);
  audio.sfx('warn');
  refreshView();
}
function updateTrial(dt) {
  const tr = trial;
  if (tr.countdown > 0) {
    tr.countdown -= dt;
    const n = Math.ceil(tr.countdown);
    if (n !== tr.shown) {
      tr.shown = n;
      if (n > 0) audio.sfx('lock');
      else {
        audio.sfx('ring');
        banner('THE COURIER’S WIND', 'GO', '', 1.1);
        input.rumble(0.3, 120);
      }
    }
    return;
  }
  tr.time += dt;
  const r = trialView.rings[tr.next];
  const d = Math.hypot(player.p.x - r.x, player.p.z - r.z);
  if (d < 13 && Math.abs(player.p.y - r.y) < 14) {
    tr.next++;
    audio.sfx('ring');
    input.rumble(0.25, 70);
    pulse(_tmp.set(r.x, r.y, r.z), '9ff3d6', 14, 0.7).rotation.set(Math.PI / 2, r.yaw, 0);
    if (tr.next >= trialView.rings.length) finishTrial();
  } else if (tr.time > 60) endTrial('time');
  else if (d > 420) endTrial('left');
}
function finishTrial() {
  const t = trial.time;
  const medal = t <= TRIAL_MEDALS.gold ? 'GOLD' : t <= TRIAL_MEDALS.silver ? 'SILVER' : 'BRONZE';
  const first = !progress.trial;
  const firstGold = medal === 'GOLD' && !progress.trialGold;
  const prevBest = progress.trialBest;
  const newBest = !prevBest || t < prevBest;
  progress.trial = true;
  if (firstGold) progress.trialGold = true;
  if (newBest) progress.trialBest = t;
  if (!records.trial || t < records.trial) {
    records.trial = t;
    saveRecords();
  }
  const reward = [];
  if (first) {
    player.tonics++;
    reward.push('+1 TONIC');
  }
  if (firstGold) {
    player.tonics++;
    player.bp = Math.min(100, player.bp + 25);
    reward.push('GOLD: +1 TONIC · +25 SPIRIT');
  }
  closeTrial();
  audio.sfx('win');
  input.rumble(0.5, 260);
  pulse(player.p, 'f0d9a0', 30, 1.3);
  const sub = newBest && prevBest ? `NEW BEST · ${formatTenths(prevBest)} BEFORE` : newBest ? 'RECORD SET' : `BEST ${formatTenths(prevBest)}`;
  banner(`COURIER’S WIND · ${medal}`, formatTenths(t), sub, 4.2);
  if (reward.length) toast(`Courier’s Wind · ${reward.join(' · ')}`, 'var(--teal)');
  saveGame();
}
function endTrial(reason) {
  if (!trial) return;
  closeTrial();
  audio.sfx('deny');
  toast(
    reason === 'time'
      ? 'The wind fades. Return to the courier post to try again.'
      : reason === 'left'
        ? 'You left the course. The rings fall silent.'
        : 'Run abandoned. The rings fall silent.'
  );
}
function closeTrial(refresh = true) {
  if (!trial) return;
  trial = null;
  trialView.group.visible = false;
  if (refresh) refreshView();
}

/* ------------------------------------------------------------ flight */

function toggleGuide(id = null) {
  if (mode !== 'explore' || trial) return;
  const next = id === null ? goal().id : id;
  if (guide && guideTarget === next) {
    guide = false;
    toast('Manual flight.');
    return;
  }
  guide = true;
  guideTarget = next;
  guideArrived = false;
  audio.sfx('lock');
  toast(`Following signal: ${POIS[next].name}`, 'var(--teal)');
}
function updateFlight(dt) {
  const mv = input.vector('move');
  const boost = input.down('boost');
  const turn = Math.abs(mv.x) > 0.22 ? mv.x : 0;
  const fly = mv.y > 0.25;
  const brake = mv.y < -0.25;
  if (turn || fly || brake) guide = false;
  let desired = brake ? 0 : boost ? 73 : fly ? 15 + 34 * clamp((mv.y - 0.25) / 0.6, 0, 1) : 15;
  if (trial && trial.countdown > 0) desired = 0;
  if (guide) {
    const p = currentSignal();
    const d = distPOI(p);
    const bearing = Math.atan2(p.x - player.p.x, -(p.z - player.p.z));
    player.yaw += clamp(angleDiff(bearing, player.yaw), -dt * 1.6, dt * 1.6);
    desired = d < 62 ? 0 : Math.min(58, (d - 45) * 1.6);
    if (d < 69 && !guideArrived) {
      guideArrived = true;
      toast(`Signal reached. Press ${prompt().near === '◉' ? 'INSPECT' : prompt().near} to inspect.`, 'var(--teal)');
    }
  } else player.yaw += turn * dt * (boost ? 0.72 : 1.05);
  player.speed = mix(player.speed, desired, 1 - Math.exp(-dt * (brake || desired === 0 ? 5 : 1.8)));
  const move = player.speed * dt;
  player.p.x += Math.sin(player.yaw) * move;
  player.p.z -= Math.cos(player.yaw) * move;
  stats.distance += Math.abs(move);
  const outside = Math.abs(player.p.x) > 575 || player.p.z > 290 || player.p.z < -1275;
  if (outside) {
    const bearing = Math.atan2(-player.p.x, -(-500 - player.p.z));
    player.yaw += angleDiff(bearing, player.yaw) * Math.min(1, dt * 1.8);
    player.p.x = clamp(player.p.x, -592, 592);
    player.p.z = clamp(player.p.z, -1292, 305);
    if (toastTime < 0.2) toast('Strong winds. Turn back toward the ruins.');
    guide = false;
  }
  const height = groundHeight(player.p.x, player.p.z) + 34 + Math.sin(visualTime * 1.3) * 0.7;
  player.p.y = mix(player.p.y, height, 1 - Math.exp(-dt * 2.5));
  dragon.root.position.copy(player.p);
  dragon.root.rotation.y = -player.yaw;
  dragon.animate(visualTime, player.speed, -turn * 0.33, player.form, dt);
  nearest = null;
  let best = 85;
  for (const p of POIS) {
    if (spent(p)) continue;
    const d = distPOI(p);
    if (d < best) {
      best = d;
      nearest = p;
    }
  }
  if (trial) updateTrial(dt);
  autoSave += dt;
  if (autoSave >= 18) {
    autoSave = 0;
    saveGame(true);
  }
}
function interact() {
  if (mode !== 'explore') return;
  if (trial) {
    toast(`Finish the run first. ${prompt().signal} abandons it.`);
    return;
  }
  if (!nearest) {
    pulse(player.p, '8adac2', 34, 1.4);
    audio.sfx('lock');
    toast(`Move within 85 m of a signal. ${prompt().signal} follows the next seal.`);
    return;
  }
  const p = nearest;
  guide = false;
  player.speed = 0;
  audio.sfx('ui');
  if (p.type === 'seal') {
    const lines = [
      { speaker: 'ANCIENT MEMORY / I', text: 'We built a gate to keep the weapons out. Then we gave the gate a weapon of its own.' },
      { speaker: 'ANCIENT MEMORY / II', text: 'The choir fell silent. The guardian kept listening. It no longer knew the difference between a voice and a threat.' },
      { speaker: 'ANCIENT MEMORY / III', text: 'If anyone still lives beyond this sea, remember us. A weapon can learn to protect. A world can learn to begin again.' },
    ];
    const warn = p.id === 0 ? 'Something is moving in the sand. Stay close, Vesper. We will have to fight for this voice.' : p.id === 1 ? 'The relay still has a guardian. Watch its armor. We need to reach the core.' : 'One last voice. Those hunters will not let us take it without a fight.';
    showDialogue([lines[p.id], { speaker: 'NYRA / RIDER', text: warn }], () => startBattle(p.id), 'explore');
  } else if (p.type === 'gate') {
    if (progress.complete) showDialogue([{ speaker: 'NYRA / RIDER', text: 'The gate is open now. Whatever answered us can wait a little longer. There is still sand to cross.' }], () => {}, 'explore');
    else if (!progress.seals.every(Boolean)) showDialogue([{ speaker: 'NYRA / RIDER', text: `The gate is silent. We still need ${progress.seals.filter((x) => !x).length} of the three seals. Follow their blue signals.` }], () => {}, 'explore');
    else showDialogue([{ speaker: 'NYRA / RIDER', text: 'It is not a door. It is a cage.' }, { speaker: 'THE GATE / TRANSLATION INCOMPLETE', text: 'THREE VOICES RECOGNIZED. MEMORY UNSEALED. RELEASE THE WARDEN.' }], () => startBattle(3), 'explore');
  } else if (p.type === 'camp') {
    const first = !progress.camp;
    showDialogue(
      [{ speaker: 'WAYFARER / CAMP', text: first ? 'A dragon, here? I thought the last of your kind had gone with the sea. Rest. There is clean water, and two tonics in that crate.' : 'The shelter is still yours. Rest, and let your dragon recover.' }],
      () => {
        progress.camp = true;
        player.hp = player.maxHp;
        player.bp = 100;
        if (first) player.tonics += 2;
        audio.sfx('heal');
        toast(first ? 'Rested · Health and spirit restored · +2 tonics' : 'Rested · Health and spirit restored', 'var(--teal)');
        saveGame();
      },
      'explore'
    );
  } else if (p.type === 'memory') {
    const text = p.id === 5 ? 'This stone once stood beneath a thousand meters of water. The carved fish have outlived the sea. Someone added a small line: “We were here.”' : 'A row of names covers the broken relay. Not soldiers. Children. The machines were built to keep them safe.';
    showDialogue(
      [{ speaker: 'LOST MEMORY / ' + (p.id === 5 ? 'A DRY TIDE' : 'NAMES IN STONE'), text }, { speaker: 'NYRA / RIDER', text: p.id === 5 ? 'Then someone should remember.' : 'They were not always weapons. Neither are you, Vesper.' }],
      () => {
        if (!progress.memories.includes(p.id)) {
          progress.memories.push(p.id);
          player.tonics++;
          player.bp = Math.min(100, player.bp + 12);
          pulse(V(p.x, p.y + 15, p.z), 'dbbd85', 22, 1.2);
          audio.sfx('seal');
          toast('Memory recovered · +1 tonic · +12 spirit', 'var(--teal)');
          saveGame();
        }
      },
      'explore'
    );
  } else if (p.type === 'trial') {
    const first = !progress.trial;
    showDialogue(
      [
        { speaker: 'COURIER’S POST / WIND CHIMES', text: first ? `Twelve old rings still hang in the wind between this post and the southern ridge. Couriers once raced them with letters for the gate.${records.trial ? ` The chimes still remember a run of ${formatTenths(records.trial)}.` : ''}` : `The chimes remember your best run: ${progress.trialBest ? formatTenths(progress.trialBest) : 'none yet'}.` },
        { speaker: 'NYRA / RIDER', text: first ? `Through every ring, in order. Boost on the straights, ease off in the turns. Under ${TRIAL_MEDALS.gold} seconds, and the post will know your name.` : 'Again? Hold on tight, Vesper.' },
      ],
      () => startTrial(),
      'explore'
    );
  } else if (p.type === 'lair') {
    const early = progress.seals.filter(Boolean).length < 2;
    showDialogue(
      [
        { speaker: 'THE SUNKEN KEEL', text: 'The ribs of something vast rise from the sand. Between them glass grows like frost, and something beneath it breathes.' },
        { speaker: 'NYRA / RIDER', text: early ? 'That is no sentinel. It could crush us, Vesper. Another seal behind us would help. Still... ready?' : 'A glass wyrm. Its hide will turn a gun, but glass cracks. Watch where it surfaces.' },
      ],
      () => startBattle(WYRM),
      'explore'
    );
  }
}

/* ------------------------------------------------------------ modal pages */

function openModal(page = 'pause') {
  if (mode === 'victoryWindup' || mode === 'death' || mode === 'ending' || mode === 'result') return;
  if (mode !== 'modal') {
    modalFrom = mode;
    modalStack = [];
  } else if (page !== modalPage) modalStack.push(modalPage);
  modalPage = page;
  mode = 'modal';
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
  if (page === 'guide') guideTab = input.source;
  refreshView(); // show the modal first, so the controller highlight can land on its buttons
  renderModal();
  audio.sfx('ui');
}
/** Back one page (sub-pages opened from the pause menu return to it), or close. */
function modalBack() {
  if (mode !== 'modal') return;
  if (modalStack.length) {
    modalPage = modalStack.pop();
    renderModal();
    audio.sfx('ui');
    return;
  }
  closeModal();
}
function closeModal() {
  if (mode !== 'modal') return;
  setMode(modalFrom);
  audio.sfx('ui');
}
function pause() {
  if (mode === 'modal') closeModal();
  else if (['explore', 'battle', 'dialogue'].includes(mode)) openModal('pause');
}
function rerenderModal() {
  if (mode !== 'modal') return;
  const keep = navIndex;
  renderModal();
  if (keep >= 0) navTo(keep);
}

function guideHTML() {
  const tabs = [['keyboard', 'KEYBOARD'], ['gamepad', 'CONTROLLER'], ['touch', 'TOUCH']]
    .map(([k, label]) => `<button class="${guideTab === k ? 'on' : ''}" data-do="guideTab" data-tab="${k}">${label}</button>`)
    .join('');
  const line = (keys, text) => `<div class="keyLine">${keys.map((k) => `<kbd>${k}</kbd>`).join(' ')} ${text}</div>`;
  let flight;
  let fight;
  let other;
  if (guideTab === 'gamepad') {
    flight = [line(['L ↑'], 'Fly faster. <kbd>L ↓</kbd> Brake.'), line(['L ← →'], 'Turn. The D-pad works too.'), line(['RT'], 'Boost. Height adjusts to the ground.'), line(['A'], 'Inspect a nearby signal.'), line(['LB'], 'Follow the next seal. Press again to stop.'), line(['VIEW'], 'Map and journal. <kbd>LT</kbd> Tonic. <kbd>RB</kbd> Forms.')].join('');
    fight = [line(['◀ ▶'], 'Move one sector (stick or D-pad).'), line(['X'], 'Gun: one target. Strong at weak points.'), line(['A'], 'Hold to lock, release to fire the laser.'), line(['Y'], 'Tempest. <kbd>B</kbd> Mend. <kbd>LT</kbd> Tonic.'), line(['LB'], 'Next target. <kbd>R3</kbd> Target data.'), line(['RB'], 'Cycle dragon forms.')].join('');
    other = '<b>Other controls:</b> Start pauses. In menus, the D-pad chooses, A confirms and B goes back. Graphics, controller and touch settings are in the pause menu.';
  } else if (guideTab === 'touch') {
    flight = [line(['LEFT SIDE'], 'Drag up to fly, down to brake, sideways to turn.'), line(['BOOST'], 'Hold to boost.'), line(['INSPECT'], 'Wake a nearby signal.'), line(['SIGNAL'], 'Follow the next seal. Tap again to stop.'), line(['TONIC'], 'Appears when Vesper is hurt.'), line(['◇', '⌖', 'Ⅱ'], 'Forms, map and pause, top right.')].join('');
    fight = [line(['◀ ▶'], 'Move one sector around the enemy.'), line(['LOCK'], 'Hold to lock more targets, release to fire.'), line(['TARGET'], 'Next target. Or tap an enemy; tap it again for its data.'), '<div class="keyLine">The command row: gun, laser, Tempest, Mend and tonic.</div>'].join('');
    other = '<b>Touch controls:</b> size, a left-handed layout and vibration are in the graphics settings, reached from the pause menu.';
  } else {
    flight = [line(['W / ↑'], 'Fly faster. <kbd>S / ↓</kbd> Brake.'), line(['A D / ← →'], 'Turn left or right.'), line(['SHIFT'], 'Boost. Height adjusts to the ground.'), line(['E'], 'Inspect a nearby signal.'), line(['TAB'], 'Follow the next seal. Press again to stop.'), line(['J'], 'Map and journal. Click a site to follow it.'), line(['5'], 'Tonic. <kbd>M</kbd> Cycle dragon forms.')].join('');
    fight = [line(['A D / ← →'], 'Move one sector around the enemy.'), line(['1'], 'Gun: one target. Strong at weak points.'), line(['2'], 'Laser: all targets. Wears down armor.'), line(['SPACE'], 'Hold to lock. Release to fire.'), line(['3'], 'Tempest. <kbd>4</kbd> Mend. <kbd>5</kbd> Tonic.'), line(['TAB'], 'Next target. <kbd>E</kbd> Target data.'), line(['M'], 'Cycle dragon forms. Click the form to choose.')].join('');
    other = '<b>Other controls:</b> Esc or P pauses. H opens this guide. F toggles full screen. F9 opens graphics settings. Click an enemy to select it. All actions can also be clicked.';
  }
  return `<div class="micro gold">RIDER’S FIELD GUIDE</div><h2>Learn the old ways.</h2><div class="guideTabs">${tabs}</div><div class="guideGrid"><div><h3>In flight</h3>${flight}<p>Find three blue seals. Defeat their guards. Then open the Hollow Gate. The camp restores health and spirit. Gold diamonds hold optional memories. The courier post runs a timed wind trial, and something waits beneath the Sunken Keel.</p></div><div><h3>In battle</h3>${fight}<p>Green is safe. Red marks the next attack. Gold marks the selected target’s weak side. Gauges stop while you move. Each full gauge pays for one basic action.</p></div></div><p class="guideNote"><b>Gauges and spirit:</b> Tempest uses 3 gauges and spirit. Mend uses 2 gauges and spirit. A tonic uses 1 gauge and 1 item. Bastion reduces incoming damage and spirit cost.</p><p class="guideNote">${other}</p>`;
}

function renderModal() {
  let body = '';
  const P = prompt();
  if (modalPage === 'pause') {
    body = `<div class="micro gold">JOURNEY PAUSED</div><h2>A moment of stillness.</h2><div class="menuRows"><button data-do="resume">▹ &nbsp; RESUME JOURNEY</button><button data-do="map">⌖ &nbsp; FIELD MAP & JOURNAL</button><button data-do="morphMenu">◇ &nbsp; DRAGON FORMS</button><button data-do="guide">? &nbsp; FIELD GUIDE</button><button data-do="settings">♪ &nbsp; SOUND & DISPLAY</button><button data-do="graphics">⚙ &nbsp; GRAPHICS & CONTROLS</button><button data-do="quit">↶ &nbsp; RETURN TO TITLE</button></div><div class="modalFoot">Flight progress saves automatically. An unfinished battle restarts from its entry checkpoint.<br>JOURNEY ${formatTime(stats.time)} &nbsp; · &nbsp; SEALS ${progress.seals.filter(Boolean).length} / 3${trial ? ' &nbsp; · &nbsp; WIND TRIAL IN PROGRESS' : ''}</div>`;
  } else if (modalPage === 'guide') body = guideHTML();
  else if (modalPage === 'settings') {
    body = `<div class="micro gold">SOUND & DISPLAY</div><h2>Set the atmosphere.</h2><div class="setting"><span>Master volume</span><span class="stepper"><button data-do="volDown" aria-label="Lower the volume">−</button><b>${Math.round(options.volume * 100)}%</b><button data-do="volUp" aria-label="Raise the volume">+</button></span></div><div class="setting"><span>Sound and original score</span><button data-do="sound">${options.sound ? 'ON' : 'OFF'}</button></div><div class="setting"><span>Low-resolution display</span><button data-do="retro">${options.retro ? 'CLASSIC · 720 PX' : 'CLEAR · HIGH RES'}</button></div><div class="setting"><span>Camera shake and hit flash</span><button data-do="motion">${options.motion ? 'ON' : 'OFF'}</button></div><div class="setting"><span>Combat difficulty</span><button data-do="difficulty">${options.difficulty.toUpperCase()}</button></div><div class="setting"><span>Graphics, touch and controller</span><button data-do="graphics">OPEN</button></div><div class="setting"><span>Full screen</span><button data-do="fullscreen">TOGGLE</button></div><p class="guideNote">Explorer gives you a longer attack warning and lower incoming damage. Veteran gives you less time to find safety. Sound starts after your first click, tap or key press. The score is generated live.</p>`;
  } else if (modalPage === 'morph') {
    body = `<div class="micro gold">DRAGON MORPHING</div><h2>One bond. Four forms.</h2><div class="formGrid">${FORMS.map((f, i) => `<button class="formCard ${player.form === i ? 'current' : ''}" data-form="${i}"><span class="symbol">${f.glyph}</span><span class="formName">${f.name}</span><span class="formDesc">${f.desc}<br>${f.stats}</span></button>`).join('')}</div><div class="modalFoot">Select a form to return to play. Changing form does not use a gauge.<br>Press ${P.form || 'the ◇ button'} during play to cycle forms without opening this screen.</div>`;
  } else if (modalPage === 'map') {
    const list = POIS.map((p) => {
      const done = isDone(p);
      let note = done ? ' · RECOVERED' : '';
      if (p.type === 'trial') note = progress.trialBest ? ` · BEST ${formatTenths(progress.trialBest)}${progress.trialGold ? ' · GOLD' : ''}` : '';
      if (p.type === 'lair') note = progress.wyrm ? ' · DEFEATED' : ' · DANGER';
      const enc = ENCOUNTERS.findIndex((e) => e.poi === p.id);
      const rec = enc >= 0 ? records.battles[enc] : null;
      if (rec) note += ` · RECORD ${rec.rank} ${formatTime(rec.time)}`;
      const kind = { seal: 'SEAL', gate: 'GATE', camp: 'CAMP', memory: 'MEMORY', trial: 'WIND TRIAL', lair: 'LAIR' }[p.type];
      return `<button class="${done ? 'done' : ''}" data-goal="${p.id}">${done ? '✓' : p.short} &nbsp; ${p.name}<small>${kind} · ${Math.round(distPOI(p))} M${note}</small></button>`;
    }).join('');
    body = `<div class="micro gold">FIELD MAP & JOURNAL</div><h2>The Hollow Sea</h2><div class="journalGrid"><canvas id="mapLarge" width="540" height="660" aria-label="Map of the Hollow Sea"></canvas><div class="journalList">${list}</div></div><div class="modalFoot">Choose a site to follow its signal in flight. You can still turn or brake to take control.<br>${progress.memories.length ? `LOST MEMORIES: ${progress.memories.map((id) => POIS[id].name).join(' · ')}` : 'The two gold sites hold optional memories and extra supplies.'}</div>`;
  } else if (modalPage === 'credits') {
    body = `<div class="micro gold">ABOUT THIS CHAPTER</div><h2>A memory of another age.</h2><p><b>Panzer Dragon Saga: The Hollow Sea</b> is an original, unofficial homage to the flight, atmosphere, and position-based battles of <i>Panzer Dragoon Saga</i> for the Sega Saturn.</p><p>This chapter has an original desert, dragon and rider, creatures, ruins, dialogue, music, and sound effects. It does not contain ripped models, textures, songs, voices, or other Sega game assets. It is not affiliated with or endorsed by Sega.</p><p><b>Inside this chapter:</b> the Hollow engine on three.js (WebGPU, with WebGL2 as a fallback), low-poly 3D models, procedural terrain, a four-sector combat system, three action gauges, five commands, four dragon forms, three seal battles, a two-stage boss, an optional glass wyrm, a timed wind trial, a camp, optional memories, local checkpoints and records, and a live Web Audio score.</p><p class="guideNote">Visual reference: Garil Desert. Combat reference: the three-gauge and quadrant system of Panzer Dragoon Saga. This is a complete small chapter, not a recreation of the full commercial game. A modern browser with WebGPU or WebGL2 is required. No network connection or installation is needed.</p>`;
  }
  const backKey = P.back ? ` &nbsp; <kbd>${P.back}</kbd>` : '';
  el.modalPane.innerHTML = `<button class="close" data-do="resume" title="Close" aria-label="Close">×</button>${body}<div class="modalFoot"><button class="secondary" data-do="back" style="padding:0">← &nbsp; RETURN${backKey}</button></div>`;
  navReset();
  if (modalPage === 'map') drawLargeMap();
  if (input.source === 'gamepad') navTo(0);
}

function quitToTitle() {
  if (mode !== 'modal') return;
  if (battle && battleCheckpoint) {
    const cp = battleCheckpoint;
    clearBattle();
    applySave(cp);
  } else clearBattle();
  closeTrial(false);
  mode = 'explore';
  saveGame(true);
  guide = false;
  setMode('title');
  audio.sfx('ui');
}
function fullscreen() {
  try {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    p?.catch?.(() => toast('Full screen is blocked in this browser view.'));
  } catch {
    toast('Full screen is not available here.');
  }
}
function toggleSound() {
  audio.init();
  audio.toggle();
  options.sound = audio.enabled;
  saveOptions();
  syncOptions();
  if (mode === 'modal' && modalPage === 'settings') rerenderModal();
}
function setVolume(v) {
  options.volume = clamp(Math.round(v * 10) / 10, 0, 1);
  audio.setVolume(options.volume);
  saveOptions();
  audio.sfx('ui');
  rerenderModal();
}
function syncOptions() {
  document.querySelectorAll('.soundToggle').forEach((e) => {
    e.textContent = options.sound ? '♪' : '♫';
    e.style.opacity = options.sound ? '1' : '.4';
    e.setAttribute('aria-label', options.sound ? 'Mute sound' : 'Enable sound');
  });
  el.difficultyBtn.innerHTML = `DIFFICULTY: ${options.difficulty.toUpperCase()} &nbsp; ↔`;
  el.scanlines.style.display = options.retro ? '' : 'none';
}
/** The classic look: the original's buffer size, PS1 vertex snapping and the colour dither. */
function applyRetro() {
  const { width: w, height: h } = kit.size;
  if (options.retro) {
    const [wi, hi] = retroSize(w, h);
    kit.setPixelHeight(hi);
    snapGrid.value.set(wi / 2, hi / 2);
    retroOn.value = 1;
  } else {
    kit.setPixelHeight(0);
    snapGrid.value.set(1e5, 1e5);
    retroOn.value = 0;
  }
  el.scanlines.style.display = options.retro ? '' : 'none';
}

function doCommand(cmd, b) {
  switch (cmd) {
    case 'new': newGame(); break;
    case 'continue': continueGame(); break;
    case 'pause': pause(); break;
    case 'resume': closeModal(); break;
    case 'back': modalBack(); break;
    case 'next': nextDialogue(); break;
    case 'interact': interact(); break;
    case 'guide': openModal('guide'); break;
    case 'guideTab':
      guideTab = PROMPTS[b?.dataset.tab] ? b.dataset.tab : 'keyboard';
      audio.sfx('ui');
      rerenderModal();
      break;
    case 'map': openModal('map'); break;
    case 'settings': openModal('settings'); break;
    case 'graphics': kit.menu.open(); break;
    case 'credits': openModal('credits'); break;
    case 'morphMenu': openModal('morph'); break;
    case 'fullscreen': fullscreen(); break;
    case 'resultContinue': resultContinue(); break;
    case 'retry': retryBattle(); break;
    case 'retreat': retryBattle(true); break;
    case 'replay': newGame(); break;
    case 'freeflight': freeFlight(); break;
    case 'quit': quitToTitle(); break;
    case 'sound': toggleSound(); break;
    case 'volDown': setVolume(options.volume - 0.1); break;
    case 'volUp': setVolume(options.volume + 0.1); break;
    case 'difficulty':
      options.difficulty = options.difficulty === 'explorer' ? 'veteran' : 'explorer';
      saveOptions();
      syncOptions();
      audio.sfx('ui');
      rerenderModal();
      break;
    case 'retro':
      options.retro = !options.retro;
      saveOptions();
      applyRetro();
      syncOptions();
      rerenderModal();
      break;
    case 'motion':
      options.motion = !options.motion;
      saveOptions();
      rerenderModal();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------ HUD */

function updateUI() {
  txt(el.hpText, Math.ceil(player.hp));
  txt(el.hpMaxText, `/ ${player.maxHp}`);
  txt(el.bpText, Math.floor(player.bp));
  sty(el.hpBar, 'width', `${clamp((player.hp / player.maxHp) * 100, 0, 100).toFixed(1)}%`);
  sty(el.hpBar, 'background', player.hp < player.maxHp * 0.25 ? 'var(--red)' : 'var(--teal)');
  sty(el.bpBar, 'width', `${clamp(player.bp, 0, 100).toFixed(1)}%`);
  txt(el.levelLabel, `LV ${String(player.level).padStart(2, '0')}`);
  txt(el.morphName, activeForm().name);
  txt(el.morphGlyph, activeForm().glyph);
  sealDots.forEach((e, i) => e.classList.toggle('done', progress.seals[i]));
  if (trial) {
    const n = trialView.rings.length;
    htm(
      el.trialHUD,
      trial.countdown > 0
        ? `THE COURIER’S WIND · STARTING IN <strong>${Math.max(1, Math.ceil(trial.countdown))}</strong>`
        : `RING <strong>${Math.min(trial.next + 1, n)} / ${n}</strong> TIME <strong>${formatTenths(trial.time)}</strong>${records.trial ? `<span class="best">RECORD ${formatTenths(records.trial)}</span>` : ''}`
    );
  }
  if (mode === 'explore') {
    txt(el.areaSub, progress.complete ? 'FREE FLIGHT · THE GATE IS OPEN' : progress.seals.every(Boolean) ? 'OPEN THE HOLLOW GATE' : `RECOVER THE SEALS · ${progress.seals.filter(Boolean).length} / 3`);
    txt(el.speedText, String(Math.round(player.speed)).padStart(2, '0'));
    txt(el.altText, Math.round(player.p.y - groundHeight(player.p.x, player.p.z)));
    const g = currentSignal();
    const deg = ((((player.yaw * 180) / Math.PI) % 360) + 360) % 360;
    txt(el.compassStrip, `· · ${(Math.round(deg) % 360).toString().padStart(3, '0')}° · ·`);
    txt(el.signalHeading, `${guide ? 'GUIDING' : 'SIGNAL'} · ${g.short} · ${Math.round(distPOI(g))} M`);
    el.nearPrompt.classList.toggle('hidden', !nearest || !!trial);
    if (nearest) {
      txt(el.nearName, nearest.name);
      txt(el.nearAction, { camp: 'REST', gate: progress.complete ? 'LOOK THROUGH THE GATE' : 'OPEN THE GATE', seal: 'WAKE THE SEAL', memory: 'READ THE MEMORY', trial: 'RIDE THE WIND', lair: 'WAKE THE WYRM' }[nearest.type]);
    }
    htm(el.flightHint, flightHint());
  } else el.nearPrompt.classList.add('hidden');
  if (isBattleView()) {
    const b = battle;
    const total = hpTotal();
    const max = maxHpTotal();
    const P = prompt();
    txt(el.enemyKicker, b.data.kicker);
    txt(el.enemyName, b.data.name);
    sty(el.enemyBar, 'width', `${((total / max) * 100).toFixed(1)}%`);
    const phase = b.id === 3 ? `PHASE ${b.phase === 1 ? 'I / ARMORED' : 'II / EXPOSED'} · ` : b.id === WYRM ? `PHASE ${b.phase === 1 ? 'I / GLASSED' : 'II / SURFACED'} · ` : '';
    txt(el.enemyPhase, `${phase}${total} / ${max}`);
    const t = selectedTarget();
    const weak = t && exposed(t);
    const danger = b.danger.includes(relativeQ());
    const windup = options.difficulty === 'veteran' ? 2.2 : 3.1;
    const warning = b.timer <= windup && mode === 'battle';
    sty(el.attackWarning, 'opacity', warning ? '1' : '.72');
    sty(el.attackWarning, 'color', warning ? (danger ? 'var(--red)' : 'var(--teal)') : '#cac4a5');
    const atk = b.phase === 2 && b.data.attack2 ? b.data.attack2 : b.data.attack;
    txt(el.attackWarning, b.entry > 0 ? 'HOLD POSITION · CHARGE YOUR GAUGES' : warning ? `${atk} · ${Math.max(0, b.timer).toFixed(1)} S ${danger ? '— MOVE!' : '— SAFE'}` : `NEXT ATTACK · ${Math.max(0, b.timer).toFixed(1)} S`);
    txt(el.gaugeCount, `${Math.floor(b.gauges)} / 3`);
    gaugeEls.forEach((g, i) => {
      const f = clamp(b.gauges - i, 0, 1);
      sty(g.fill, 'width', `${(f * 100).toFixed(1)}%`);
      g.box.classList.toggle('full', f >= 0.999);
    });
    txt(el.chargeState, b.moving ? 'MOVING · GAUGE CHARGE PAUSED' : lockHeld ? `LOCKING ×${lockCount} · RELEASE ${P.lock} TO FIRE` : b.gauges >= 3 ? 'THREE GAUGES READY · TEMPEST AVAILABLE' : `HOLDING POSITION · ${activeForm().time.toFixed(2)} S PER GAUGE`);
    sty(el.chargeState, 'color', b.moving ? '#d8b387' : '#bbcab2');
    const glass = b.data.model === 'wyrm';
    txt(el.targetInfo, t ? `${t.name.toUpperCase()} · ${t.hp <= 0 ? 'DESTROYED' : weak ? 'WEAK POINT EXPOSED' : t.armor > 0 ? (glass ? 'GLASSED' : 'ARMORED') : glass ? 'GLASS CRACKED' : 'SHELL BROKEN'} · ${P.scan}: SCAN` : '');
    sty(el.targetInfo, 'color', weak ? '#ead092' : '#cfdfbe');
    txt(el.stormCost, `3 GAUGES · ${actionCost(3).bp} SP`);
    txt(el.mendCost, `2 GAUGES · ${actionCost(4).bp} SP`);
    txt(el.tonicCost, `1 GAUGE · ×${player.tonics}`);
    for (const e of commandButtons) {
      const ready = canAct(Number(e.dataset.action));
      e.classList.toggle('unready', !ready);
      const v = String(!ready);
      if (e.getAttribute('aria-disabled') !== v) e.setAttribute('aria-disabled', v);
    }
  }
  syncTouch();
}
function flightHint() {
  const P = prompt();
  if (trial) return trial.countdown > 0 ? 'Hold steady. The wind is gathering.' : `Fly through the bright ring. <b>${P.boost}</b> boosts.<br><b>${P.signal}</b> abandons the run.`;
  if (stats.battles === 0 && !progress.trial) {
    return input.source === 'gamepad'
      ? 'Push the <b>left stick</b> up to fly. Tilt it to turn.<br>Press <b>LB</b> to follow the next signal.'
      : 'Hold <b>W</b> to fly. Use <b>A / D</b> to turn.<br>Press <b>Tab</b> to follow the next signal.';
  }
  if (progress.complete) return `The gate is open. Race the courier’s wind<br>or wake what sleeps in the Sunken Keel.`;
  if (progress.seals.every(Boolean)) return `The three seals are awake.<br>Press <b>${P.signal}</b> to reach the Hollow Gate.`;
  return `Press <b>${P.signal}</b> to follow the next seal.<br><b>${P.map}</b> opens the map. <b>${P.tonicKey}</b> uses a tonic.`;
}

const _proj = { x: 0, y: 0, visible: false, depth: 0 };
const _pv = V();
/** World point → CSS pixels, like the old renderer's project(). Returns a shared object. */
function project(p) {
  _pv.copy(p).applyMatrix4(camera.matrixWorldInverse);
  const w = -_pv.z;
  _pv.applyMatrix4(camera.projectionMatrix);
  _proj.x = (_pv.x * 0.5 + 0.5) * kit.size.width;
  _proj.y = (0.5 - _pv.y * 0.5) * kit.size.height;
  _proj.visible = w > 1 && Math.abs(_pv.x) < 1.2 && Math.abs(_pv.y) < 1.2;
  _proj.depth = w;
  return _proj;
}

const POI_LABEL = { memory: 'LOST MEMORY', camp: 'CAMP', trial: 'WIND TRIAL', lair: 'THE KEEL', gate: 'THE GATE' };
const _hv = V();
function drawReticle(c, x, y, size, color, selected) {
  const len = size * 0.37;
  c.strokeStyle = color;
  c.lineWidth = selected ? 1.6 : 1;
  c.beginPath();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      c.moveTo(x + sx * (size - len), y + sy * size);
      c.lineTo(x + sx * size, y + sy * size);
      c.lineTo(x + sx * size, y + sy * (size - len));
    }
  }
  c.stroke();
  if (selected) {
    c.fillStyle = color;
    c.fillRect(x - 1, y - 1, 2, 2);
  }
}
function drawHUD() {
  const c = hudCtx;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = kit.size.width;
  const H = kit.size.height;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  if (mode === 'explore') {
    const sig = currentSignal();
    for (const p of POIS) {
      if (spent(p)) continue;
      const d = distPOI(p);
      const next = p.id === sig.id && !trial;
      const minor = p.type === 'memory' || p.type === 'camp' || p.type === 'trial' || p.type === 'lair';
      if ((minor && d > 310 && !next) || (d > 760 && !next)) continue;
      const v = project(_hv.set(p.x, p.y + (p.type === 'gate' ? 69 : 33), p.z));
      if (!v.visible || v.x < 24 || v.x > W - 24 || v.y < 85 || v.y > H - 190) continue;
      const x = Math.round(v.x);
      const y = Math.round(v.y);
      const color = p.type === 'lair' ? '#9fe8d4' : minor ? '#dfc18c' : p.id === 3 ? '#e0c491' : '#b2e5c9';
      c.globalAlpha = next ? 1 : clamp(1 - d / 700, 0.4, 0.9);
      c.shadowColor = '#10251e';
      c.shadowBlur = 8;
      c.strokeStyle = color;
      c.lineWidth = next ? 1.6 : 1;
      const r = next ? 9 : 6;
      c.beginPath();
      c.moveTo(x, y - r);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r);
      c.lineTo(x - r, y);
      c.closePath();
      c.stroke();
      c.fillStyle = color;
      c.fillRect(x - 1, y - 1, 2, 2);
      if (next) {
        c.beginPath();
        c.arc(x, y, 18 + Math.sin(visualTime * 2) * 1.6, 0, TAU);
        c.globalAlpha = 0.25;
        c.stroke();
        c.globalAlpha = 1;
      }
      c.beginPath();
      c.moveTo(x, y + r + 4);
      c.lineTo(x, y + r + 15);
      c.stroke();
      c.textAlign = 'center';
      c.font = `${next ? 12 : 10}px ${next ? 'Georgia' : 'monospace'}`;
      c.fillText(next ? p.name.toUpperCase() : POI_LABEL[p.type] || `SEAL ${p.short}`, x, y + r + 31);
      c.font = '9px monospace';
      c.fillText(`${Math.round(d)} m`, x, y + r + 46);
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }
    if (trial) {
      // The next wind ring, and a pointer to it when it is off screen.
      const r = trialView.rings[trial.next];
      const d = Math.hypot(player.p.x - r.x, player.p.z - r.z);
      const v = project(_hv.set(r.x, r.y, r.z));
      c.shadowColor = '#10251e';
      c.shadowBlur = 8;
      c.textAlign = 'center';
      if (v.visible && v.x > 20 && v.x < W - 20 && v.y > 60 && v.y < H - 60) {
        c.strokeStyle = '#c9f7e4';
        c.lineWidth = 1.4;
        c.beginPath();
        c.arc(v.x, v.y, 16 + Math.sin(visualTime * 6) * 2, 0, TAU);
        c.stroke();
        c.fillStyle = '#c9f7e4';
        c.font = '10px monospace';
        c.fillText(`RING ${trial.next + 1} · ${Math.round(d)} m`, v.x, v.y + 34);
      } else if (trial.countdown <= 0) {
        const diff = angleDiff(Math.atan2(r.x - player.p.x, -(r.z - player.p.z)), player.yaw);
        c.fillStyle = '#c9f7e4';
        c.font = '11px monospace';
        c.fillText(`${diff < 0 ? '◁' : '▷'}  RING ${trial.next + 1} · ${Math.round(d)} m`, W * 0.5, H * 0.75);
      }
      c.shadowBlur = 0;
    } else {
      const g = currentSignal();
      const p = project(_hv.set(g.x, g.y + 35, g.z));
      if (!p.visible || p.x < 20 || p.x > W - 20) {
        const bearing = Math.atan2(g.x - player.p.x, -(g.z - player.p.z));
        const diff = angleDiff(bearing, player.yaw);
        c.fillStyle = '#c5dbbc';
        c.textAlign = 'center';
        c.font = '11px monospace';
        c.shadowColor = '#15221f';
        c.shadowBlur = 10;
        c.fillText(`${diff < 0 ? '◁' : '▷'}  SIGNAL ${g.short} · ${Math.round(distPOI(g))} m · ${prompt().signal.toUpperCase()} TO FOLLOW`, W * 0.5, H * 0.75);
        c.shadowBlur = 0;
      }
    }
  }
  if (isBattleView() && mode !== 'result' && mode !== 'death') {
    const b = battle;
    const list = living();
    const sel = selectedTarget();
    list.sort((a, bb) => (a.index === sel?.index ? -1 : bb.index === sel?.index ? 1 : a.index - bb.index));
    for (let i = 0; i < list.length; i++) {
      const t = list[i];
      const p = project(targetPos(t, _hv));
      if (!p.visible) continue;
      const selected = t.index === b.selected;
      const locked = lockHeld && i < lockCount;
      const weak = exposed(t);
      const color = locked ? '#b9f6cd' : weak ? '#f2d190' : selected ? '#d2e4bf' : '#92ad95';
      const size = selected ? 28 : 18;
      const px = p.x;
      const py = p.y;
      c.globalAlpha = selected || locked ? 1 : 0.72;
      c.shadowColor = '#09241d';
      c.shadowBlur = 7;
      drawReticle(c, px, py, size, color, selected);
      if (locked) {
        c.strokeStyle = '#94e6b9';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(px, py, size + 6, visualTime * 1.3, visualTime * 1.3 + TAU * 0.85);
        c.stroke();
      }
      c.textAlign = 'center';
      c.font = selected ? '10px monospace' : '8px monospace';
      c.fillStyle = color;
      c.fillText(locked ? 'LOCKED' : selected ? t.name.toUpperCase() : `0${t.index + 1}`, px, py - size - 10);
      c.fillStyle = '#102b1cc9';
      c.fillRect(px - 24, py + size + 9, 48, 3);
      c.fillStyle = weak ? '#dfc382' : '#a1bc95';
      c.fillRect(px - 24, py + size + 9, (48 * t.hp) / t.max, 3);
      c.shadowBlur = 0;
      c.globalAlpha = 1;
    }
  }
  if (mode !== 'title' && mode !== 'modal') {
    for (const f of floatTexts) {
      const p = project(f.p);
      if (!p.visible) continue;
      c.globalAlpha = Math.min(1, (1 - f.t / f.max) * 2);
      c.font = `${f.big ? 22 : 17}px Georgia`;
      c.textAlign = 'center';
      c.fillStyle = f.color;
      c.shadowColor = '#12251b';
      c.shadowBlur = 8;
      c.fillText(f.text, p.x, p.y);
      c.shadowBlur = 0;
    }
    c.globalAlpha = 1;
  }
  if (mode !== 'title') drawRadar();
}

let radarBg = null;
function drawRadar() {
  const c = radarCtx;
  c.setTransform(2, 0, 0, 2, 0, 0);
  c.clearRect(0, 0, 174, 174);
  c.save();
  c.translate(87, 87);
  if (!radarBg) {
    radarBg = c.createRadialGradient(0, 0, 5, 0, 0, 77);
    radarBg.addColorStop(0, 'rgba(75,82,60,.84)');
    radarBg.addColorStop(1, 'rgba(17,35,31,.91)');
  }
  c.fillStyle = radarBg;
  c.beginPath();
  c.arc(0, 0, 75, 0, TAU);
  c.fill();
  c.strokeStyle = '#c2b38699';
  c.lineWidth = 1;
  c.beginPath();
  c.arc(0, 0, 78, 0, TAU);
  c.stroke();
  c.strokeStyle = '#b9b58d33';
  for (const r of [28, 51, 70]) {
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.stroke();
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU;
    const r = i % 4 ? 74 : 71;
    c.beginPath();
    c.moveTo(Math.sin(a) * r, -Math.cos(a) * r);
    c.lineTo(Math.sin(a) * 77, -Math.cos(a) * 77);
    c.stroke();
  }
  if (isBattleView()) {
    const b = battle;
    const w = selectedTarget();
    const weak = w ? targetWeak(w) : 2;
    for (let i = 0; i < 4; i++) {
      const rel = (((i - b.facing) % 4) + 4) % 4;
      const red = b.danger.includes(rel);
      const a = (i * Math.PI) / 2 - Math.PI / 2 - Math.PI / 4 + 0.035;
      const bb = a + Math.PI / 2 - 0.07;
      c.beginPath();
      c.arc(0, 0, 65, a, bb);
      c.arc(0, 0, 31, bb, a, true);
      c.closePath();
      c.fillStyle = red ? (b.warned ? '#c07854a6' : '#a164476a') : '#77aa8170';
      c.fill();
      if (rel === weak) {
        c.strokeStyle = '#e8c987';
        c.lineWidth = 2.2;
        c.beginPath();
        c.arc(0, 0, 29, a + 0.14, bb - 0.14);
        c.stroke();
      }
    }
    c.lineWidth = 1;
    c.strokeStyle = '#b5c2a77f';
    c.beginPath();
    c.moveTo(-63, 0);
    c.lineTo(63, 0);
    c.moveTo(0, -63);
    c.lineTo(0, 63);
    c.stroke();
    c.save();
    c.rotate(b.facingAngle);
    c.fillStyle = '#d2caa4';
    c.beginPath();
    c.moveTo(0, -22);
    c.lineTo(8, 0);
    c.lineTo(0, -4);
    c.lineTo(-8, 0);
    c.closePath();
    c.fill();
    c.fillStyle = '#a1b097';
    c.beginPath();
    c.arc(0, 4, 5, 0, TAU);
    c.fill();
    c.restore();
    c.save();
    c.translate(Math.sin(b.angle) * 57, -Math.cos(b.angle) * 57);
    c.rotate(b.angle);
    c.shadowColor = '#b4edbf';
    c.shadowBlur = 8;
    c.fillStyle = '#e0eed0';
    c.beginPath();
    c.moveTo(0, 9);
    c.lineTo(-5, -6);
    c.lineTo(0, -3);
    c.lineTo(5, -6);
    c.closePath();
    c.fill();
    c.restore();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#c7c7a4';
    c.font = '8px monospace';
    c.fillText('FRONT', 0, -84);
    c.fillText('REAR', 0, 84);
    c.textBaseline = 'alphabetic';
    const rq = relativeQ();
    const safe = !b.danger.includes(rq);
    txt(el.radarLabel, `${['FRONT', 'RIGHT', 'REAR', 'LEFT'][rq]} · ${b.moving ? 'MOVING' : safe ? 'SAFE' : 'DANGER'}`);
    sty(el.radarLabel, 'color', safe ? 'var(--teal)' : 'var(--red)');
  } else {
    c.strokeStyle = '#a5b39330';
    for (const n of [-48, -24, 0, 24, 48]) {
      const e = Math.sqrt(68 * 68 - n * n);
      c.beginPath();
      c.moveTo(n, -e);
      c.lineTo(n, e);
      c.stroke();
      c.beginPath();
      c.moveTo(-e, n);
      c.lineTo(e, n);
      c.stroke();
    }
    const a = visualTime * 0.3;
    c.strokeStyle = '#afd0a94d';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * 69, Math.sin(a) * 69);
    c.stroke();
    const sigId = currentSignal().id;
    const dot = (x, z, color, s, round = false) => {
      let dx = ((x - player.p.x) / 390) * 64;
      let dy = ((z - player.p.z) / 390) * 64;
      const d = Math.hypot(dx, dy);
      if (d > 66) {
        dx *= 66 / d;
        dy *= 66 / d;
      }
      c.fillStyle = color;
      c.save();
      c.translate(dx, dy);
      if (round) {
        c.beginPath();
        c.arc(0, 0, s, 0, TAU);
        c.fill();
      } else {
        c.rotate(Math.PI / 4);
        c.fillRect(-s, -s, s * 2, s * 2);
      }
      c.restore();
    };
    for (const p of POIS) {
      if (spent(p)) continue;
      const color = p.type === 'lair' ? '#8fe6cf' : p.type === 'memory' || p.type === 'camp' || p.type === 'trial' ? '#d8b97c' : p.id === 3 ? '#d2b888' : '#9fdcc3';
      dot(p.x, p.z, color, p.id === sigId && !trial ? 3.7 : 2.1);
    }
    if (trial) {
      const rings = trialView.rings;
      if (rings[trial.next + 1]) dot(rings[trial.next + 1].x, rings[trial.next + 1].z, '#9ff3d680', 2.2, true);
      dot(rings[trial.next].x, rings[trial.next].z, '#c9f7e4', 3.6, true);
    }
    c.save();
    c.rotate(player.yaw);
    c.fillStyle = '#ece5bc';
    c.beginPath();
    c.moveTo(0, -9);
    c.lineTo(-5, 6);
    c.lineTo(0, 3);
    c.lineTo(5, 6);
    c.closePath();
    c.fill();
    c.restore();
    c.font = '9px monospace';
    c.textAlign = 'center';
    c.fillStyle = '#cdcba8';
    c.fillText('N', 0, -81);
    txt(el.radarLabel, trial ? `WIND TRIAL · RING ${Math.min(trial.next + 1, trialView.rings.length)}` : guide ? 'FOLLOWING SIGNAL' : 'HOLLOW SEA / NORTH ↑');
    sty(el.radarLabel, 'color', trial ? 'var(--teal)' : 'var(--muted)');
  }
  c.restore();
}

function drawLargeMap() {
  const canvas = $('mapLarge');
  if (!canvas) return;
  const c = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#192b25';
  c.fillRect(0, 0, w, h);
  const point = (p) => ({ x: ((p.x + 470) / 940) * (w - 60) + 30, y: ((p.z + 1320) / 1660) * (h - 80) + 45 });
  c.strokeStyle = '#9cb88d22';
  c.lineWidth = 1;
  for (let x = 30; x < w; x += 48) {
    c.beginPath();
    c.moveTo(x, 25);
    c.lineTo(x, h - 25);
    c.stroke();
  }
  for (let y = 35; y < h; y += 48) {
    c.beginPath();
    c.moveTo(20, y);
    c.lineTo(w - 20, y);
    c.stroke();
  }
  c.strokeStyle = '#adbb8944';
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    for (let j = 0; j <= 40; j++) {
      const x = (j / 40) * w;
      const y = h * (0.1 + i * 0.1) + Math.sin(j * 0.22 + i) * 25 + Math.sin(j * 0.55) * 9;
      if (j) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.setLineDash([5, 9]);
  c.strokeStyle = '#b6c49366';
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    const p = point(POIS[i]);
    if (i) c.lineTo(p.x, p.y);
    else c.moveTo(p.x, p.y);
  }
  c.stroke();
  c.setLineDash([]);
  for (const p of POIS) {
    const v = point(p);
    const done = isDone(p);
    c.fillStyle = done ? '#83ac94' : p.type === 'lair' ? '#8fe6cf' : p.type === 'memory' || p.type === 'camp' || p.type === 'trial' ? '#d9b177' : '#a5d6b5';
    c.save();
    c.translate(v.x, v.y);
    c.rotate(Math.PI / 4);
    c.fillRect(-5, -5, 10, 10);
    c.restore();
    c.font = '16px Georgia';
    c.fillText(p.short, v.x + 14, v.y + 5);
    if (p.id === 3) {
      c.strokeStyle = '#d4c190';
      c.beginPath();
      c.arc(v.x, v.y, 17, 0, TAU);
      c.stroke();
    }
  }
  const p = point(player.p);
  c.save();
  c.translate(p.x, p.y);
  c.rotate(player.yaw);
  c.fillStyle = '#f3e1b7';
  c.beginPath();
  c.moveTo(0, -12);
  c.lineTo(-8, 9);
  c.lineTo(0, 5);
  c.lineTo(8, 9);
  c.closePath();
  c.fill();
  c.restore();
  c.font = '15px monospace';
  c.fillStyle = '#bec4a2';
  c.fillText('N ↑', w - 64, 30);
  c.font = '11px monospace';
  c.fillStyle = '#95aa8f';
  c.fillText('HOLLOW SEA / RELAY SURVEY', 23, h - 18);
}

/* ------------------------------------------------------------ camera */

const camPos = V(0, 60, 100);
const camTarget = V(0, 35, 0);
let camFov = 57;
const _desired = V();
const _look = V();
const _f = V();
const _tmp = V();
const _tmp2 = V();

function updateCamera(dt) {
  const desired = _desired;
  const look = _look;
  let fov = 58;
  const titleView = mode === 'title' || (mode === 'modal' && modalFrom === 'title');
  if (titleView) {
    const dx = -70;
    const dz = -40;
    const dy = groundHeight(dx, dz) + 45;
    dragon.root.position.set(dx, dy + Math.sin(visualTime * 0.7) * 1.4, dz);
    dragon.root.rotation.y = -0.33;
    dragon.animate(visualTime, 23, Math.sin(visualTime * 0.3) * 0.07, 0, dt);
    desired.set(dx + 20 + Math.sin(visualTime * 0.065) * 6, dy + 13, dz + 48 + Math.cos(visualTime * 0.065) * 4);
    look.set(dx - 32, dy + 5, dz - 12);
    fov = 53;
    shadow.position.set(dx, groundHeight(dx, dz) + 0.18, dz);
  } else if (isBattleView()) {
    const b = battle;
    const a = b.angle;
    const portrait = kit.size.width / kit.size.height < 0.8;
    const r = (b.id === 3 ? 75 : 66) * (portrait ? 1.12 : 1);
    const side = portrait ? 12 : 25;
    desired.set(b.center.x + Math.sin(a) * r + Math.cos(a) * side, b.center.y + (b.id === 3 ? 26 : 21), b.center.z + Math.cos(a) * r - Math.sin(a) * side);
    look.set(b.center.x + Math.sin(a) * 9, b.center.y + 2, b.center.z + Math.cos(a) * 9);
    fov = portrait ? 70 : b.id === 3 ? 60 : 58;
  } else if (mode === 'ending') {
    dragon.root.position.set(player.p.x + Math.sin(visualTime * 0.2) * 3, player.p.y + Math.sin(visualTime), player.p.z);
    dragon.root.rotation.y = 0;
    dragon.animate(visualTime, 19, 0, player.form, dt);
    desired.set(player.p.x + 28, player.p.y + 11, player.p.z + 42);
    look.set(-8, groundHeight(0, -1115) + 64, -1115);
    fov = 62;
  } else {
    _f.set(Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    desired.copy(player.p).addScaledVector(_f, -(31 + player.speed * 0.09));
    desired.y += 12;
    look.copy(player.p).addScaledVector(_f, 26);
    look.y += 3;
    fov = 58 + player.speed * 0.065;
    if (mode !== 'explore') {
      dragon.root.position.copy(player.p);
      dragon.root.rotation.y = -player.yaw;
      dragon.animate(visualTime, 14, 0, player.form, dt);
    }
  }
  const damp = 1 - Math.exp(-dt * (mode === 'title' ? 2.1 : isBattleView() ? 4.4 : 4));
  camPos.lerp(desired, damp);
  camTarget.lerp(look, damp);
  camFov = mix(camFov, fov - (morphTime > 0 ? Math.sin(morphTime * Math.PI) * 3 : 0), damp);
  if (shakeTime > 0 && options.motion) {
    const power = shakePower * Math.min(1, shakeTime * 3);
    camPos.x += (Math.random() - 0.5) * power;
    camPos.y += (Math.random() - 0.5) * power;
  }
  if (!titleView) {
    shadow.position.set(player.p.x, groundHeight(player.p.x, player.p.z) + 0.32, player.p.z);
    shadow.rotation.y = -player.yaw;
  }
  world.animate(visualTime, dragon.root.position, progress.seals);
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
  if (Math.abs(camera.fov - camFov) > 1e-4) {
    camera.fov = camFov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
}

/* ------------------------------------------------------------ the frame */

function handleInput(dt) {
  const m = mode;
  if (input.pressed('fullscreen')) fullscreen();
  if (input.pressed('guide') && m !== 'modal') {
    openModal('guide');
    return;
  }
  switch (m) {
    case 'title':
      menuNav(dt);
      if (input.pressed('primary')) {
        unlockAudio();
        if (!navClick()) titleStart();
      }
      break;
    case 'dialogue':
      if (input.pressed('pause')) openModal('pause');
      else if (input.pressed('primary') || input.pressed('interact')) nextDialogue();
      break;
    case 'modal':
      menuNav(dt);
      if (input.pressed('pause') || input.pressed('back')) modalBack();
      else if (input.pressed('primary') && !navClick() && modalPage === 'pause') closeModal();
      break;
    case 'result':
      menuNav(dt);
      if (input.pressed('primary') && !navClick()) resultContinue();
      break;
    case 'death':
      menuNav(dt);
      if (input.pressed('primary') && !navClick()) retryBattle();
      break;
    case 'ending':
      menuNav(dt);
      if (input.pressed('primary') && !navClick()) newGame();
      break;
    case 'explore':
      exploreInput();
      break;
    case 'battle':
      battleInput();
      break;
    default:
      break;
  }
}
function exploreInput() {
  if (input.pressed('pause')) return openModal('pause');
  if (input.pressed('map')) return openModal('map');
  if (input.pressed('form')) applyForm((player.form + 1) % FORMS.length);
  if (input.pressed('primary') || input.pressed('interact')) {
    unlockAudio();
    interact();
    return;
  }
  if (input.pressed('signal')) {
    if (trial) endTrial('abandon');
    else toggleGuide();
  }
  if (input.pressed('tonic')) action(5);
}
function battleInput() {
  if (input.pressed('pause')) return openModal('pause');
  if (input.pressed('map')) return openModal('map');
  if (input.pressed('form')) applyForm((player.form + 1) % FORMS.length);
  const mv = input.vector('move');
  const dir = mv.x < -0.5 ? -1 : mv.x > 0.5 ? 1 : 0;
  if (dir && dir !== orbitLatch) orbit(dir);
  orbitLatch = dir;
  if (input.pressed('orbitL')) orbit(-1);
  if (input.pressed('orbitR')) orbit(1);
  if (input.pressed('signal')) changeTarget();
  if (input.pressed('interact')) return scanEnemy();
  if (input.pressed('gun')) action(1);
  if (input.pressed('laser')) action(2);
  if (input.pressed('tempest')) action(3);
  if (input.pressed('mend')) action(4);
  if (input.pressed('tonic')) action(5);
  if (input.pressed('primary')) startLock();
  else if (input.released('primary') && lockHeld) releaseLock();
  const ptr = input.pointer;
  if (ptr.justDown) pickTarget(ptr.x, ptr.y, ptr.type === 'touch');
}

function updateSimulation(dt) {
  visualTime += dt;
  if (mode === 'explore' || mode === 'battle' || mode === 'victoryWindup') stats.time += dt;
  if (mode === 'explore') updateFlight(dt);
  else if (mode === 'battle') updateBattle(dt);
  else if (mode === 'victoryWindup') {
    victoryTimer -= dt;
    dragon.animate(visualTime, 18, 0, player.form, dt);
    if (victoryTimer <= 0) finishBattle();
  }
  updateEffects(dt);
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) el.toast.style.opacity = '0';
  }
  if (bannerTime > 0) {
    bannerTime -= dt;
    if (bannerTime <= 0) el.banner.style.opacity = '0';
  }
  if (saveTime > 0) {
    saveTime -= dt;
    if (saveTime <= 0) el.saveNotice.style.opacity = '0';
  }
  shakeTime = Math.max(0, shakeTime - dt);
  if (shakeTime === 0) shakePower = 0;
  morphTime = Math.max(0, morphTime - dt);
  flashLevel = Math.max(0, flashLevel - dt * 0.55);
  sty(el.flash, 'opacity', options.motion ? flashLevel.toFixed(3) : '0');
  if (trial) trialView.sync(trial.next, visualTime);
  skyTime.value = visualTime;
  updateCamera(dt);
  uiClock += dt;
  if (uiClock > 0.07) {
    uiClock = 0;
    updateUI();
  }
}

function frame(rawDt) {
  const dt = clamp(rawDt, 0.001, 0.08);
  handleInput(dt);
  updateSimulation(dt);
  audio.update(isBattleView() && mode !== 'result', player.speed, mode === 'modal');
  kit.renderer.render(scene, camera);
  drawHUD();
  frameCount++;
}

/* ------------------------------------------------------------ wiring */

document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button');
  if (!b) return;
  unlockAudio();
  if (b.classList.contains('soundToggle')) {
    toggleSound();
    return;
  }
  if (b.dataset.do) {
    doCommand(b.dataset.do, b);
    return;
  }
  if (b.dataset.action) {
    action(Number(b.dataset.action));
    return;
  }
  if (b.dataset.form !== undefined) {
    const id = Number(b.dataset.form);
    closeModal();
    applyForm(id);
    return;
  }
  if (b.dataset.goal !== undefined) {
    const id = Number(b.dataset.goal);
    if (modalFrom !== 'explore') {
      toast(isBattleView() ? 'You can follow a signal after the battle.' : 'You can follow a signal in flight.');
      return;
    }
    if (trial) {
      toast('Finish the courier’s wind first.');
      return;
    }
    closeModal();
    guide = false;
    toggleGuide(id);
  }
});
// A tap or click anywhere on the story panel turns the page (not only its small button).
$('dialogue').addEventListener('click', (e) => {
  if (!e.target.closest?.('button')) nextDialogue();
});
// Sound starts on the first gesture (browsers keep audio locked until then).
addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
addEventListener('keydown', unlockAudio, { capture: true });
addEventListener('blur', () => {
  lockHeld = false;
  lockTime = 0;
  lockCount = 0;
});
document.addEventListener('visibilitychange', () => {
  audio.setHidden(document.hidden);
  if (document.hidden && (mode === 'explore' || mode === 'battle')) openModal('pause');
});
addEventListener('beforeunload', () => {
  if (mode === 'explore') saveGame(true);
});
kit.onPause((p) => audio.setHold(p));
input.onSourceChange((src) => {
  syncPrompts();
  if (mode === 'modal' && modalPage === 'guide' && PROMPTS[src]) {
    guideTab = src;
    rerenderModal();
  }
  if (src === 'gamepad' && navIndex < 0 && ['title', 'modal', 'result', 'death', 'ending'].includes(mode)) navTo(0);
});
const deviceLost = kit.renderer.onDeviceLost;
kit.renderer.onDeviceLost = (info) => {
  if (mode === 'explore') saveGame(true);
  deviceLost.call(kit.renderer, info);
};

kit.onResize((w, h) => {
  applyRetro();
  const dpr = Math.min(2, devicePixelRatio || 1);
  hudCanvas.width = Math.round(w * dpr);
  hudCanvas.height = Math.round(h * dpr);
  refreshView();
});

// Checks and QA hooks (kept from the original chapter).
window.__PDS__ = {
  snapshot: () => ({
    mode,
    modalFrom,
    player: { x: player.p.x, y: player.p.y, z: player.p.z, yaw: player.yaw, hp: player.hp, maxHp: player.maxHp, bp: player.bp, tonics: player.tonics, form: player.form, speed: player.speed },
    progress: JSON.parse(JSON.stringify(progress)),
    stats: { ...stats },
    nearest: nearest?.id ?? null,
    guide,
    trial: trial ? { next: trial.next, time: trial.time, countdown: trial.countdown } : null,
    drawCalls: kit.renderer.info.render.calls,
    backend: kit.backend,
    frameCount,
    audio: { state: audio.ctx?.state || 'not-started', enabled: audio.enabled, nodes: audio.nodes },
    battle: battle
      ? {
          id: battle.id, phase: battle.phase, gauges: battle.gauges, time: battle.time, timer: battle.timer, moving: battle.moving, angle: battle.angle, facing: battle.facing,
          relativeQ: relativeQ(), danger: battle.danger, selected: battle.selected,
          targets: battle.targets.map((t) => ({ hp: t.hp, max: t.max, armor: t.armor, weak: targetWeak(t), exposed: exposed(t) })),
        }
      : null,
  }),
};
if (location.hash === '#qa') {
  window.__PDS__.advance = (seconds) => {
    const enabled = audio.enabled;
    audio.enabled = false;
    for (let i = 0; i < Math.ceil(Math.min(seconds, 120) * 30); i++) updateSimulation(1 / 30);
    audio.enabled = enabled;
    kit.renderer.render(scene, camera);
    drawHUD();
    updateUI();
    return window.__PDS__.snapshot();
  };
  window.__PDS__.warp = (id) => {
    if (mode !== 'explore') throw new Error('Warp is only available in flight.');
    const p = POIS[id];
    player.p.set(p.x, groundHeight(p.x, p.z + 50) + 34, p.z + 50);
    player.yaw = 0;
    player.speed = 0;
    guide = false;
    updateFlight(0);
    return window.__PDS__.snapshot();
  };
  window.__PDS__.resources = (patch) => {
    for (const k of ['hp', 'bp', 'tonics']) if (Number.isFinite(patch[k])) player[k] = patch[k];
    if (battle && Number.isFinite(patch.gauges)) battle.gauges = clamp(patch.gauges, 0, 3);
    updateUI();
    return window.__PDS__.snapshot();
  };
}

syncOptions();
syncContinue();
updateCamera(10);
kit.loading.progress(0.9, 'Waking the dragon…');
try {
  await kit.renderer.compileAsync(scene, camera);
} catch (err) {
  console.warn('[pds] pipeline warm-up skipped:', err?.message || err);
}
kit.start(frame);
