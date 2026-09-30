/**
 * Hookshift: Iron Canopy — runs on the shared 3D stack: three.js r186
 * (WebGPURenderer, WebGL2 fallback) started by kit/boot.js, TSL bloom from
 * kit/post.js, and every control routed through kit.input actions.
 *
 * Movement and collision are the game's own small kinematic model (no jump,
 * a rope constraint, axis-aligned platforms); no physics engine is needed.
 * Two missions share every system: 01 Iron Canopy (the original) and
 * 02 Storm Spillway (cable-trolley anchors, hover drones, floodwater).
 */
import * as THREE from 'three/webgpu';
import { attribute, color, fract, hash, mix, positionLocal, positionWorld, sin, time, uniform, vec3 } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { BALANCE, MISSIONS } from './data.js';

const $ = (s) => document.querySelector(s);
const ui = {
  health: $('#health'), xpFill: $('#xp-fill'), xpLabel: $('#xp-label'), rank: $('#rank'), gear: $('#gear'),
  objective: $('#objective'), timer: $('#timer'), backend: $('#backend'), brandMission: $('#brand-mission'),
  tutorial: $('#tutorial'), tutorialText: $('#tutorial-text'),
  toast: $('#toast'), checkpoint: $('#checkpoint'), damageFlash: $('#damage-flash'), pauseHud: $('#pause-btn'),
  start: $('#start-card'), pause: $('#pause-card'), complete: $('#complete-card'),
  startBtn: $('#start-btn'), continueBtn: $('#continue-btn'), startSettings: $('#start-settings'), startHint: $('#start-hint'),
  best: $('#best-line'), missionBtns: [...document.querySelectorAll('[data-mission]')], diffBtns: [...document.querySelectorAll('[data-difficulty]')],
  pauseInfo: $('#pause-info'), resumeBtn: $('#resume-btn'), resetBtn: $('#reset-btn'), restartMissionBtn: $('#restart-mission-btn'),
  settingsBtn: $('#settings-btn'), quitBtn: $('#quit-btn'),
  clearEyebrow: $('#clear-eyebrow'), clearName: $('#clear-name'), grade: $('#grade'), clearDiff: $('#clear-diff'),
  newBest: $('#new-best'), bestTime: $('#best-time'), stats: $('#stats'),
  nextBtn: $('#next-btn'), restartBtn: $('#restart-btn'), briefBtn: $('#brief-btn'),
  briefKeys: [...document.querySelectorAll('[data-key]')],
};

const isCoarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const ZOOM_DEFAULT = isCoarse ? 14.3 : 13.4;
const ZOOM_MIN = 10.5;
const ZOOM_MAX = 18.5;
const TOAST_TIME = 1.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const DIFFICULTY = {
  recruit: { label: 'RECRUIT', hp: 2, fire: 1.35, shot: 0.85, range: 0.85 },
  regular: { label: 'REGULAR', hp: 0, fire: 1, shot: 1, range: 1 },
  veteran: { label: 'VETERAN', hp: -1, fire: 0.78, shot: 1.15, range: 1.12 },
};
const GRADE_ORDER = ['C', 'B', 'A', 'S'];

// ---------------------------------------------------------------- saved progress
// One record per browser: last mission and difficulty, best time and grade per
// mission + difficulty, and one checkpoint save to continue from.
const STORE_KEY = 'hookshift-iron-canopy.v2';
const store = { mission: 0, difficulty: 'regular', best: {}, save: null };
try {
  const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
  if (raw && typeof raw === 'object') Object.assign(store, raw);
} catch {
  /* private mode or unreadable data: start fresh */
}
store.mission = MISSIONS[store.mission] ? Number(store.mission) : 0;
if (!DIFFICULTY[store.difficulty]) store.difficulty = 'regular';
if (!store.best || typeof store.best !== 'object') store.best = {};
if (!store.save || typeof store.save !== 'object' || !MISSIONS[store.save.mission]) store.save = null;
function saveStore() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or blocked: progress just is not kept */
  }
}

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'Hookshift: Iron Canopy',
  accent: '#e4ba3b',
  background: '#0a1410',
  // The game's own pause menu has a Settings button, so no gear; the touch pause pill takes the top-right corner.
  gear: 'none',
  touch: { top: 'right', topOffset: 10 },
  input: {
    // x moves and adds swing force, y reels the cable (up = in). Independent axes, as before.
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    grapple: { keys: ['Space', 'KeyK'], gamepad: ['A'], touch: 'Grapple' },
    fire: { keys: ['KeyF', 'KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
    act: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Act' },
    confirm: { keys: ['Enter', 'NumpadEnter'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RB', neg: 'LB' } },
  },
});
const { input, renderer } = kit;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
ui.backend.textContent = `GPU: ${kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2'}`;
kit.loading.progress(0.7, 'Building the canopy…');

// ---------------------------------------------------------------- state
const tempV = new THREE.Vector3();
const tempV2 = new THREE.Vector3();
const tempMid = new THREE.Vector3();
const tempDir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const player = {
  x: 3.5, y: 0, vx: 0, vy: 0, facing: 1, grounded: true,
  hp: BALANCE.playerMaxHp, maxHp: BALANCE.playerMaxHp, xp: 0, rank: 1,
  invuln: 0, fireTimer: 0, grapple: null, grappleRange: BALANCE.grappleBaseRange,
  reelSpeed: BALANCE.reelSpeed, fireCooldown: BALANCE.fireCooldown,
  gear: new Set(), mesh: null, respawnX: 3.5, respawnY: 0, deaths: 0, muzzle: 0,
};

const game = {
  state: 'title', // 'title' | 'play' | 'pause' | 'done'
  difficulty: store.difficulty, elapsed: 0, kills: 0, shots: 0, hits: 0,
  cp: -1, interact: 0, everGrappled: false, tutorialPhase: 0, tutorialHide: 0,
  cameraX: 7, cameraY: 4.8, zoom: ZOOM_DEFAULT, shake: 0, clock: 0, anim: 0, nearConsole: false,
  anchorClock: 0, chirp: 3, flash: 0, lightning: 5, thunder: 0,
};
const bullets = [];
/** The mission being played or previewed. */
let L = null;

// ---------------------------------------------------------------- audio
// All sound is synthesised, so there is nothing to download or decode. The context
// starts on the first key or tap, and stops whenever the kit pauses or the tab hides.
let audioCtx = null;
let master = null;
let noiseBuf = null;
let ambient = null;
let ambientLevel = 0.012;
function initAudio() {
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      master = audioCtx.createGain();
      master.gain.value = 0.9;
      master.connect(audioCtx.destination);
      noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      startAmbient();
    }
    syncAudio();
  } catch {
    /* no audio on this device */
  }
}
function syncAudio() {
  if (!audioCtx) return;
  const run = !kit.paused && !document.hidden;
  if (run && audioCtx.state !== 'running') audioCtx.resume?.()?.catch?.(() => {});
  else if (!run && audioCtx.state === 'running') audioCtx.suspend?.()?.catch?.(() => {});
  if (ambient) {
    const level = game.state === 'play' ? ambientLevel : ambientLevel * 0.35;
    ambient.gain.gain.setTargetAtTime(level, audioCtx.currentTime, 0.25);
  }
}
addEventListener('pointerdown', initAudio, { passive: true });
addEventListener('keydown', initAudio);
kit.onPause(syncAudio);

function startAmbient() {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  ambient = { src, filter, gain };
  applyAmbient();
}
function applyAmbient() {
  if (!ambient || !L) return;
  const storm = L.def.theme === 'storm';
  // Jungle: a thin insect hiss. Storm: steady rain.
  ambient.filter.type = storm ? 'lowpass' : 'bandpass';
  ambient.filter.frequency.value = storm ? 1700 : 3400;
  ambient.filter.Q.value = storm ? 0.4 : 0.9;
  ambientLevel = storm ? 0.05 : 0.012;
  syncAudio();
}

function tone(freq, duration = 0.08, type = 'square', volume = 0.035, endFreq = null, delay = 0) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}
function noise(duration, freq, q = 1, volume = 0.05, type = 'lowpass', delay = 0) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t = audioCtx.currentTime + delay;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuf;
  const f = audioCtx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.2);
  src.stop(t + duration + 0.05);
}
function sfx(name) {
  switch (name) {
    case 'grapple': tone(180, 0.09, 'square', 0.045, 420); tone(620, 0.05, 'triangle', 0.025, 360, 0.07); input.rumble(0.25, 40); break;
    case 'release': tone(420, 0.05, 'triangle', 0.02, 220); break;
    case 'fire': tone(520, 0.055, 'square', 0.025, 170); break;
    case 'tick': tone(940, 0.03, 'square', 0.018, 620); break;
    case 'hit': tone(120, 0.09, 'sawtooth', 0.035, 65); input.rumble(0.8, 180); break;
    case 'kill': tone(180, 0.08, 'square', 0.03, 260); tone(330, 0.1, 'triangle', 0.025, 520, 0.07); noise(0.18, 900, 0.7, 0.03); input.rumble(0.3, 60); break;
    case 'gear': tone(330, 0.09, 'triangle', 0.035, 470); tone(660, 0.15, 'triangle', 0.035, 880, 0.08); input.rumble(0.3, 60); break;
    case 'rank': tone(392, 0.1, 'triangle', 0.035, 523); tone(523, 0.12, 'triangle', 0.035, 659, 0.1); tone(784, 0.2, 'triangle', 0.035, 1046, 0.2); break;
    case 'checkpoint': tone(300, 0.12, 'triangle', 0.035, 450); tone(600, 0.16, 'triangle', 0.04, 840, 0.12); break;
    case 'complete': tone(240, 0.15, 'triangle', 0.04, 360); tone(480, 0.18, 'triangle', 0.04, 720, 0.14); tone(960, 0.25, 'sine', 0.04, 760, 0.3); input.rumble(0.6, 260); break;
    case 'splash': noise(0.5, 1400, 0.6, 0.07); noise(0.25, 3200, 1, 0.03, 'bandpass', 0.05); input.rumble(0.5, 120); break;
    case 'thunder': noise(1.8, 160, 0.5, 0.12); noise(0.6, 420, 0.6, 0.05, 'lowpass', 0.05); input.rumble(0.2, 200); break;
    case 'chirp': {
      const f = 2300 + Math.random() * 1400;
      tone(f, 0.07, 'sine', 0.01, f * 1.35);
      tone(f * 1.1, 0.06, 'sine', 0.008, f * 1.5, 0.1);
      break;
    }
    case 'select': tone(660, 0.035, 'square', 0.014, 880); break;
    default: break;
  }
}

// ---------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x132b20);
scene.fog = new THREE.FogExp2(0x183326, 0.022);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(46, 1, 0.1, 180));
// Narrow (portrait) screens pull the camera back so the level stays readable side to side.
let aspectZoom = 1;
kit.onResize((w, h) => {
  aspectZoom = Math.max(1, Math.pow(1.25 / Math.max(0.2, w / h), 0.7));
});

const hemi = new THREE.HemisphereLight(0xb8e3c0, 0x182219, 1.75);
const SUN_OFFSET = new THREE.Vector3(-16, 28, 18);
const sun = new THREE.DirectionalLight(0xfff1c7, 3.2);
sun.castShadow = true;
kit.shadow(sun, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 25, bottom: -16 });
sun.shadow.bias = -0.0007;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 2;
const fill = new THREE.DirectionalLight(0x7fc8a7, 0.8);
fill.position.set(18, 8, -12);
// One beacon light, moved to whichever spire is showing (a fixed light count keeps pipelines stable).
const beaconLight = new THREE.PointLight(0xff3d2e, 20, 8, 2);
scene.add(hemi, sun, sun.target, fill, beaconLight);

const THEMES = {
  canopy: { bg: 0x132b20, fog: 0x183326, density: 0.022, hemi: [0xb8e3c0, 0x182219, 1.75], sun: [0xfff1c7, 3.2], fill: [0x7fc8a7, 0.8] },
  storm: { bg: 0x15232b, fog: 0x1b2b33, density: 0.026, hemi: [0xa9c4d6, 0x141c22, 1.55], sun: [0xd9e4ff, 2.2], fill: [0x6fa7c8, 0.9] },
};
const skyBase = new THREE.Color(0x132b20);
const skyFlash = new THREE.Color(0xc8dcff);

// The sun follows the camera so shadows reach the whole level, moving in whole
// shadow-map texels so shadow edges do not crawl.
const sunBasis = new THREE.Matrix4().lookAt(SUN_OFFSET, new THREE.Vector3(), UP);
const sunRight = new THREE.Vector3().setFromMatrixColumn(sunBasis, 0);
const sunUp = new THREE.Vector3().setFromMatrixColumn(sunBasis, 1);
const sunBack = new THREE.Vector3().setFromMatrixColumn(sunBasis, 2);
function placeSun(cx) {
  const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const c = tempV.set(cx, 0, 0);
  const r = Math.round(c.dot(sunRight) / texel) * texel;
  const u = Math.round(c.dot(sunUp) / texel) * texel;
  const target = sun.target.position.copy(sunRight).multiplyScalar(r).addScaledVector(sunUp, u).addScaledVector(sunBack, c.dot(sunBack));
  sun.position.copy(target).add(SUN_OFFSET);
}

// ---------------------------------------------------------------- materials and shapes
// Materials and geometries are shared by value, across both missions.
const matCache = new Map();
function material(col, roughness = 0.82, metalness = 0.06, emissive = 0x000000, emissiveIntensity = 0) {
  const key = `${col}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: col, roughness, metalness, flatShading: true, emissive, emissiveIntensity });
    matCache.set(key, m);
  }
  return m;
}
const geoCache = new Map();
function sharedGeo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}
const boxGeo = (w, h, d) => sharedGeo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (a, b, h, s) => sharedGeo(`cyl:${a}:${b}:${h}:${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const coneGeo = (r, h) => sharedGeo(`cone:${r}:${h}`, () => new THREE.ConeGeometry(r, h, 6));
const icoGeo = (r) => sharedGeo(`ico:${r}`, () => new THREE.IcosahedronGeometry(r, 0));
const octGeo = (r) => sharedGeo(`oct:${r}`, () => new THREE.OctahedronGeometry(r, 0));

function addMesh(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, mat, x, y, z, parent) {
  return addMesh(boxGeo(w, h, d), mat, x, y, z, parent);
}
function cyl(rTop, rBot, h, segments, mat, x, y, z, parent) {
  return addMesh(cylGeo(rTop, rBot, h, segments), mat, x, y, z, parent);
}

const M = {
  earth: material(0x43533d, 0.95, 0.0), earthTop: material(0x5e7448, 0.94, 0.0), metal: material(0x56625b, 0.55, 0.5),
  concrete: material(0x62675d, 0.92, 0.05), dark: material(0x1b2420, 0.8, 0.2), hazard: material(0xc6802f, 0.7, 0.15),
  rail: material(0x7a8179, 0.5, 0.6), trunk: material(0x574631, 1, 0), leafA: material(0x1f5a38, 1, 0), leafB: material(0x2b7443, 1, 0),
  rock: material(0x39483e, 0.98, 0), steel: material(0x59635f, 0.48, 0.62), deck: material(0x252e2b, 0.55, 0.5),
  ring: material(0xe7c85b, 0.45, 0.5, 0xb88918, 0.8), ringActive: material(0xe7c85b, 0.45, 0.5, 0xb88918, 2.3),
  guard: material(0x89713a, 0.76, 0.15), turret: material(0x7b3d2d, 0.76, 0.15), enemyDark: material(0x292f28, 0.52, 0.5),
  enemySkin: material(0xa78564, 0.95, 0), droneEye: material(0x5a1410, 0.4, 0.2, 0xff3b24, 2.2),
  pickupBase: material(0x313b35, 0.7, 0.4), cable: material(0x2a302d, 0.6, 0.6), trolley: material(0xc6802f, 0.6, 0.35),
  lampOff: material(0x5a4a1c, 0.5, 0.2, 0xffb133, 0.9), lampOn: material(0x1f5a36, 0.5, 0.2, 0x3cff87, 2.0), gate: material(0x151c1b, 0.7, 0.4),
};

// Floodwater and spill gates for the Storm Spillway, animated in TSL (same on WebGPU and WebGL2).
const waterMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.1 });
{
  const wave = sin(positionWorld.x.mul(0.9).add(time.mul(1.7))).mul(sin(positionWorld.z.mul(1.4).sub(time.mul(1.2))));
  const k = wave.mul(0.5).add(0.5);
  waterMat.colorNode = mix(color(0x163a3e), color(0x2f6e6a), k);
  waterMat.emissiveNode = color(0x0a2626).mul(k.add(0.4));
}
const spillMat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
{
  const streak = fract(positionWorld.y.mul(1.6).add(time.mul(2.4)).add(sin(positionWorld.x.mul(7.0)).mul(0.35)));
  spillMat.colorNode = mix(color(0x9fd6d4), color(0x2b5f63), streak);
  spillMat.opacityNode = streak.mul(0.35).add(0.45);
}

// ---------------------------------------------------------------- level building
function addRail(parent, x1, x2, y, z) {
  const len = Math.max(0.1, x2 - x1);
  const cx = (x1 + x2) / 2;
  box(+len.toFixed(3), 0.09, 0.09, M.rail, cx, y + 1.05, z, parent);
  for (let x = x1; x <= x2 + 0.01; x += 1.7) box(0.08, 1.15, 0.08, M.rail, x, y + 0.55, z, parent);
}

function addSign(level, text, x, y, z, col, w = 3.6, h = 0.9) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101812';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#78887c';
  ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, c.width - 12, c.height - 12);
  ctx.fillStyle = `#${col.toString(16).padStart(6, '0')}`;
  ctx.font = 'bold 58px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = addMesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x, y, z, level.static);
  m.castShadow = false;
}

function buildPlatforms(level) {
  const S = level.static;
  for (const p of level.platforms) {
    const mat = p.kind === 'metal' ? M.metal : p.kind === 'concrete' ? M.concrete : M.earth;
    box(p.w, p.h, 3.4, mat, p.x, p.y, 0, S);
    const top = p.y + p.h / 2;
    if (p.kind === 'earth') box(p.w, 0.18, 3.46, M.earthTop, p.x, top + 0.09, 0, S);
    if (p.kind === 'concrete') box(p.w, 0.14, 0.2, M.hazard, p.x, top - 0.07, 1.62, S);
    if (p.kind === 'metal' && p.y > 2) addRail(S, p.x - p.w / 2 + 0.25, p.x + p.w / 2 - 0.25, top, -1.25);
  }
  // Stairs get bright tread lips for navigation.
  for (const x of level.def.lips) {
    const step = level.platforms.find((p) => Math.abs(p.x - x) < 0.01);
    if (step) box(0.95, 0.12, 3.52, M.hazard, x, step.y + step.h / 2 + 0.06, 0, S);
  }
}

function buildAnchors(level) {
  const S = level.static;
  const waterY = level.def.waterY ?? -2;
  const ring = sharedGeo('ring', () => new THREE.TorusGeometry(0.33, 0.105, 6, 10));
  for (const a of level.anchors) {
    const g = new THREE.Group();
    g.position.set(a.x, a.y, 0);
    level.group.add(g);
    const r = addMesh(ring, M.ring, 0, 0, 0, g);
    r.rotation.x = Math.PI / 2;
    if (a.move) {
      // A trolley that rides a cable strung between two pylons.
      box(0.07, 0.5, 0.07, M.metal, 0, 0.38, 0, g);
      box(0.55, 0.22, 0.3, M.trolley, 0, 0.72, 0, g);
      const x1 = a.baseX - a.move.range - 0.6;
      const x2 = a.baseX + a.move.range + 0.6;
      const cy = a.baseY + 0.86;
      box(+(x2 - x1).toFixed(3), 0.05, 0.05, M.cable, (x1 + x2) / 2, cy, 0, S);
      for (const px of [x1, x2]) {
        box(0.1, 0.1, 1.9, M.metal, px, cy, -0.95, S);
        const ph = +(cy - waterY).toFixed(3);
        cyl(0.14, 0.18, ph, 6, M.metal, px, waterY + ph / 2, -1.9, S);
      }
    } else {
      const bracket = box(0.22, 0.65, 0.3, M.metal, a.x, a.y + 0.45, 0, S);
      bracket.rotation.z = a.id % 2 ? 0.25 : -0.25;
    }
    a.mesh = g;
    a.ring = r;
  }
}

function buildCanopyProps(level) {
  const S = level.static;
  // Layered canopy and jungle props.
  for (let i = 0; i < 30; i++) {
    const x = -5 + i * 4.1 + ((i * 17) % 7) * 0.13;
    const z = -7 - (i % 3) * 2.2;
    const h = 3.8 + (i % 5) * 0.45;
    cyl(0.16, 0.24, h, 6, M.trunk, x, h / 2 - 0.3, z, S);
    addMesh(coneGeo(1.6 + (i % 3) * 0.2, 3.2), i % 2 ? M.leafA : M.leafB, x, h + 0.8, z, S);
  }
  for (let i = 0; i < 24; i++) {
    const x = 2 + ((i * 13) % 103);
    const z = -3.4 + (i % 2) * 6.8;
    const r = 0.35 + (i % 4) * 0.16;
    const rock = addMesh(icoGeo(r), M.rock, x, r * 0.55, z, S);
    rock.scale.y = 0.65;
  }
  // The auxiliary bunker is a cutaway: back wall, two front pillars and a lintel. It used to be
  // a solid block in front of the play plane that hid the low route and the guard inside it.
  box(9.6, 3.55, 0.7, M.concrete, 46, 1.78, -1.45, S);
  box(4.4, 1.7, 0.2, M.dark, 48.2, 0.85, -1.0, S);
  box(0.5, 3.55, 1.6, M.concrete, 41.45, 1.78, 2.2, S);
  box(0.5, 3.55, 1.6, M.concrete, 50.55, 1.78, 2.2, S);
  box(9.6, 0.62, 1.6, M.concrete, 46, 3.24, 2.2, S);
  addSign(level, 'AUX BUNKER', 44.2, 3.24, 3.02, 0xffd858, 2.4, 0.56);
  // The relay sign hangs behind the spire's mid deck now (in front of it, it hid the player).
  addSign(level, 'RELAY 7', 99.1, 5.85, -1.9, 0xffd858);
  for (const x of [41, 45, 49, 53, 69, 73, 77]) cyl(0.13, 0.13, 5.6, 6, M.metal, x, 2.8, 0, S);
  // A few unmistakable rails at dangerous edges.
  addRail(S, 39.2, 42.0, 4.05, 1.45);
  addRail(S, 50.0, 55.4, 6.25, 1.4);
  addRail(S, 68.0, 76.0, 5.25, 1.4);
  addRail(S, 98.0, 100.0, 4.3, 1.4);
}

function buildSpillwayProps(level) {
  const S = level.static;
  const G = level.group;
  const wy = level.def.waterY;
  // Floodwater under the whole valley: every gap is a drop into it.
  const water = new THREE.Mesh(new THREE.PlaneGeometry(190, 26), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(55, wy, -5);
  water.receiveShadow = true;
  G.add(water);
  // Far-bank jungle, thinner and storm-dark.
  for (let i = 0; i < 24; i++) {
    const x = -6 + i * 5.3 + ((i * 11) % 5) * 0.3;
    const z = -8.5 - (i % 3) * 2.4;
    const h = 4.2 + (i % 4) * 0.6;
    cyl(0.16, 0.24, +h.toFixed(2), 6, M.trunk, x, wy + h / 2, z, S);
    addMesh(coneGeo(+(1.5 + (i % 3) * 0.25).toFixed(2), 3.4), i % 2 ? M.leafA : M.leafB, x, wy + h + 1.1, z, S);
  }
  // River rocks.
  for (let i = 0; i < 18; i++) {
    const x = 1 + ((i * 17) % 113);
    const z = i % 2 ? 3.6 : -3.2;
    const r = +(0.4 + (i % 4) * 0.18).toFixed(2);
    const rock = addMesh(icoGeo(r), M.rock, x, wy + r * 0.25, z, S);
    rock.scale.y = 0.6;
  }
  // The dam behind the walkway, pouring through three spill gates.
  box(17, 9.6, 1.4, M.concrete, 53, wy + 4.8, -4.8, S);
  box(17.4, 0.5, 1.8, M.metal, 53, wy + 9.85, -4.8, S);
  const spillGeo = new THREE.PlaneGeometry(2.0, 6.0);
  for (const gx of [47.5, 53, 58.5]) {
    box(2.4, 1.6, 0.3, M.gate, gx, 5.2, -4.0, S);
    const spill = new THREE.Mesh(spillGeo, spillMat);
    spill.position.set(gx, 1.4, -3.8);
    spill.renderOrder = 1;
    G.add(spill);
  }
  addSign(level, 'SPILLWAY 2', 53, 7.1, -4.05, 0xffd858);
  addSign(level, 'FLOODGATE', 104.2, 6.6, -1.9, 0xffd858);
  // Walkway handrail at the back, and legs under the ledge, the gantry and the tower deck.
  addRail(S, 46.2, 59.8, 1.85, -1.25);
  for (const x of [36.9, 40.3]) cyl(0.12, 0.12, 4.35, 6, M.metal, x, 2.175, -1.2, S);
  for (const x of [81.2, 87.8]) cyl(0.13, 0.13, 5.0, 6, M.metal, x, 2.5, -1.1, S);
  for (const x of [106.8, 112.2]) cyl(0.13, 0.13, 4.1, 6, M.metal, x, 2.05, -1.2, S);
  addRail(S, 76.5, 79.5, 0, 1.45);
  addRail(S, 90.5, 93.6, 0, 1.45);
}

function buildEnemy(e, parent) {
  const g = new THREE.Group();
  parent.add(g);
  e.mesh = g;
  if (e.kind === 'turret') {
    box(0.85, 0.55, 0.8, M.enemyDark, 0, 0.28, 0, g);
    g.userData.head = box(0.8, 0.35, 0.62, M.turret, 0, 0.72, 0, g);
    box(0.85, 0.13, 0.15, M.enemyDark, 0.64, 0.76, 0, g);
  } else if (e.kind === 'drone') {
    box(0.72, 0.28, 0.52, M.enemyDark, 0, 0, 0, g);
    box(0.5, 0.18, 0.44, M.turret, 0, -0.2, 0, g);
    box(0.36, 0.08, 0.1, M.enemyDark, 0.42, -0.2, 0, g);
    const eye = box(0.14, 0.12, 0.1, M.droneEye, 0.3, -0.03, 0.24, g);
    eye.castShadow = false;
    const rotor = new THREE.Group();
    rotor.position.y = 0.24;
    g.add(rotor);
    box(1.0, 0.03, 0.09, M.enemyDark, 0, 0, 0, rotor);
    box(0.09, 0.03, 1.0, M.enemyDark, 0, 0, 0, rotor);
    g.userData.rotor = rotor;
  } else {
    box(0.65, 0.75, 0.48, M.guard, 0, 0.72, 0, g);
    box(0.42, 0.35, 0.42, M.enemySkin, 0, 1.31, 0, g);
    box(0.48, 0.14, 0.45, M.enemyDark, 0, 1.52, 0, g);
    g.userData.gun = box(0.62, 0.13, 0.16, M.enemyDark, 0.55, 0.86, 0, g);
  }
}

function buildPickup(p, parent) {
  const group = new THREE.Group();
  group.position.set(p.x, p.y, 0);
  parent.add(group);
  p.mesh = group;
  const col = p.kind === 'med' ? 0x55cc6b : p.id === 'pulse' ? 0xffb54c : 0x4ed8bf;
  const m = addMesh(octGeo(0.34), material(col, 0.35, 0.22, col, 0.9), 0, 0.4, 0, group);
  m.rotation.z = 0.3;
  box(0.55, 0.18, 0.55, M.pickupBase, 0, 0.08, 0, group);
}

function buildSpire(level) {
  const S = level.static;
  const sp = level.def.spire;
  const top = sp.beaconY;
  for (let y = 1; y < top - 0.15; y += 2.2) {
    cyl(0.12, 0.12, 2.4, 6, M.steel, sp.x - 1.15, y, 0, S);
    cyl(0.12, 0.12, 2.4, 6, M.steel, sp.x + 1.15, y, 0, S);
    const cross = box(2.55, 0.09, 0.09, M.steel, sp.x, y + 0.95, 0, S);
    cross.rotation.z = y % 4 > 2 ? 0.28 : -0.28;
  }
  box(2.8, 0.3, 2.2, M.deck, sp.x, sp.y - 0.02, 0, S);
  box(0.8, 1.15, 0.8, M.deck, sp.consoleX, sp.y + 0.57, 0, S);
  // These two change colour at runtime, so each spire owns its materials.
  const consoleMat = new THREE.MeshStandardMaterial({ color: 0x2d9e62, roughness: 0.35, metalness: 0.1, flatShading: true, emissive: 0x3cff87, emissiveIntensity: 1.3 });
  const consoleLight = box(0.42, 0.18, 0.09, consoleMat, sp.consoleX, sp.y + 0.82, 0.45, level.group);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x6d2e28, roughness: 0.55, metalness: 0.3, flatShading: true, emissive: 0xff2f1f, emissiveIntensity: 1.8 });
  const beacon = addMesh(octGeo(0.48), beaconMat, sp.x, top, 0, level.group);
  beacon.castShadow = false;
  level.spire = { beacon, consoleLight, beaconY: top };
}

function buildCheckpoints(level) {
  for (const c of level.def.checkpoints) {
    cyl(0.06, 0.06, 2.4, 6, M.metal, c.x, c.ry + 1.2, -1.25, level.static);
    const lamp = box(0.36, 0.24, 0.36, M.lampOff, c.x, c.ry + 2.5, -1.25, level.group);
    lamp.castShadow = false;
    level.lamps.push(lamp);
  }
}

/** Bake a group of static meshes into one mesh per material (hundreds of draw calls → about fifteen). */
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  for (const m of [...group.children]) {
    if (!m.isMesh) continue;
    const key = `${m.material.uuid}|${m.castShadow}|${m.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material: m.material, cast: m.castShadow, receive: m.receiveShadow, parts: [] });
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    g.applyMatrix4(m.matrixWorld);
    buckets.get(key).parts.push(g);
    if (!m.geometry.userData.shared) m.geometry.dispose();
    group.remove(m);
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.parts, false);
    for (const g of b.parts) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    group.add(mesh);
  }
}

function buildLevel(def, index) {
  const group = new THREE.Group();
  group.name = def.id;
  scene.add(group);
  const S = new THREE.Group();
  group.add(S);
  const level = {
    def, index, group, static: S, lamps: [], spire: null,
    platforms: def.platforms.map((p) => ({ ...p })),
    anchors: def.anchors.map((a, i) => ({ ...a, id: i, baseX: a.x, baseY: a.y, mesh: null, ring: null, active: false })),
    enemies: def.enemies.map((e, i) => ({
      ...e, id: i, startX: e.x, baseY: e.y, cy: e.y, dir: i % 2 ? -1 : 1, hp: 0, maxHp: e.kind === 'turret' ? 3 : 2,
      dead: false, fireTimer: 0, hitT: 0, mesh: null,
    })),
    pickups: def.pickups.map((p, i) => ({ ...p, index: i, taken: false, mesh: null })),
  };
  buildPlatforms(level);
  buildAnchors(level);
  if (def.theme === 'storm') buildSpillwayProps(level);
  else buildCanopyProps(level);
  for (const e of level.enemies) buildEnemy(e, group);
  for (const p of level.pickups) buildPickup(p, group);
  buildSpire(level);
  buildCheckpoints(level);
  mergeStatic(S);
  return level;
}

// ---------------------------------------------------------------- player, rope, markers, effects
function buildPlayer() {
  const g = new THREE.Group();
  scene.add(g);
  player.mesh = g;
  const uniformMat = material(0x2e8356, 0.72, 0.12);
  const armor = material(0x193a30, 0.55, 0.38);
  const skin = material(0xc5a27b, 0.9, 0);
  const gun = material(0x303936, 0.42, 0.65);
  box(0.72, 0.72, 0.52, uniformMat, 0, 0.7, 0, g);
  box(0.82, 0.34, 0.58, armor, 0, 1.02, 0, g);
  box(0.48, 0.38, 0.48, skin, 0, 1.36, 0, g);
  box(0.55, 0.16, 0.53, armor, 0, 1.58, 0, g);
  const legL = box(0.25, 0.65, 0.28, uniformMat, -0.2, 0.18, 0, g);
  const legR = box(0.25, 0.65, 0.28, uniformMat, 0.2, 0.18, 0, g);
  const arm = box(0.22, 0.7, 0.25, armor, 0.48, 0.78, 0, g);
  arm.rotation.z = -0.18;
  const gunMesh = box(0.68, 0.16, 0.18, gun, 0.68, 0.86, 0.02, g);
  gunMesh.rotation.z = 0.03;
  const flash = new THREE.Mesh(boxGeo(0.24, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0xfff0a0 }));
  flash.position.set(1.1, 0.86, 0.02);
  flash.visible = false;
  g.add(flash);
  g.userData.legs = [legL, legR];
  g.userData.flash = flash;
}
buildPlayer();

const ropeMesh = addMesh(new THREE.CylinderGeometry(0.045, 0.045, 1, 6), new THREE.MeshBasicMaterial({ color: 0x78f4d1 }), 0, 0, 0, scene);
ropeMesh.castShadow = false;
ropeMesh.visible = false;

// The ring a grapple press would take: a clear answer to "what will I grab?".
const marker = new THREE.Mesh(
  new THREE.TorusGeometry(0.6, 0.035, 6, 28),
  new THREE.MeshBasicMaterial({ color: 0x7cf1cd, transparent: true, opacity: 0.8, depthWrite: false })
);
marker.renderOrder = 3;
marker.visible = false;
scene.add(marker);

// Bullets come from two pools with one shared box and one material per side.
const bulletGeo = new THREE.BoxGeometry(0.28, 0.09, 0.1);
const bulletMats = { player: material(0xffdf49, 0.3, 0.1, 0xffdf49, 1.4), enemy: material(0xff5338, 0.3, 0.1, 0xff5338, 1.4) };
const bulletPool = { player: [], enemy: [] };
function createBullet(enemy) {
  const side = enemy ? 'enemy' : 'player';
  let m = bulletPool[side].pop();
  if (!m) {
    m = new THREE.Mesh(bulletGeo, bulletMats[side]);
    m.receiveShadow = true;
    m.userData.side = side;
    scene.add(m);
  }
  m.visible = true;
  return m;
}
function releaseBullet(b) {
  if (!b.mesh) return;
  b.mesh.visible = false;
  bulletPool[b.mesh.userData.side].push(b.mesh);
  b.mesh = null;
}
function spawnBullet(x, y, vx, vy, enemy, life) {
  const mesh = createBullet(enemy);
  mesh.position.set(x, y, 0.25);
  mesh.rotation.z = Math.atan2(vy, vx);
  bullets.push({ x, y, vx, vy, enemy, life, mesh });
}
function clearBullets() {
  for (const b of bullets) releaseBullet(b);
  bullets.length = 0;
}

// Sparks: one instanced mesh, a fixed pool, no allocation while playing.
const SPARK_MAX = 96;
const sparkMesh = new THREE.InstancedMesh(boxGeo(0.09, 0.09, 0.09), new THREE.MeshBasicMaterial({ color: 0xffffff }), SPARK_MAX);
sparkMesh.frustumCulled = false;
sparkMesh.castShadow = false;
sparkMesh.receiveShadow = false;
sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
{
  const white = new THREE.Color(0xffffff);
  for (let i = 0; i < SPARK_MAX; i++) sparkMesh.setColorAt(i, white);
  sparkMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
}
sparkMesh.count = 1;
sparkMesh.visible = false;
scene.add(sparkMesh);
const sparks = Array.from({ length: SPARK_MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, color: new THREE.Color() }));
let sparkCursor = 0;
const sparkDummy = new THREE.Object3D();
function burst(x, y, hex, n, speed = 4) {
  const count = Math.max(1, Math.round(n * Math.min(1, kit.tier.detail)));
  for (let i = 0; i < count; i++) {
    const s = sparks[sparkCursor];
    sparkCursor = (sparkCursor + 1) % SPARK_MAX;
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    s.x = x;
    s.y = y;
    s.z = 0.3;
    s.vx = Math.cos(a) * v;
    s.vy = Math.sin(a) * v + speed * 0.3;
    s.vz = (Math.random() - 0.5) * speed * 0.6;
    s.max = s.life = 0.3 + Math.random() * 0.35;
    s.color.setHex(hex);
  }
}
function updateSparks(dt) {
  let n = 0;
  for (const s of sparks) {
    if (s.life <= 0) continue;
    s.life -= dt;
    if (s.life <= 0) continue;
    s.vy -= 14 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.z += s.vz * dt;
    sparkDummy.position.set(s.x, s.y, s.z);
    sparkDummy.scale.setScalar(0.35 + (s.life / s.max) * 0.9);
    sparkDummy.rotation.set(s.life * 9, s.life * 7, 0);
    sparkDummy.updateMatrix();
    sparkMesh.setMatrixAt(n, sparkDummy.matrix);
    sparkMesh.setColorAt(n, s.color);
    n++;
  }
  sparkMesh.visible = n > 0;
  if (n) {
    sparkMesh.count = n;
    sparkMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceColor.needsUpdate = true;
  }
}
function clearSparks() {
  for (const s of sparks) s.life = 0;
  sparkMesh.visible = false;
}

// Rain for the storm: one mesh of streak quads placed and animated entirely in the vertex
// stage, so it costs no CPU per frame. The streak field is anchored in the world and wraps
// around the camera. The tier sets how many streaks draw.
const RAIN_MAX = 900;
const rainCam = uniform(new THREE.Vector2());
const rain = (() => {
  const pos = new Float32Array(RAIN_MAX * 12);
  const seed = new Float32Array(RAIN_MAX * 4);
  const index = new Uint16Array(RAIN_MAX * 6);
  const corners = [-0.012, -0.3, 0.012, -0.3, 0.112, 0.3, 0.088, 0.3];
  for (let i = 0; i < RAIN_MAX; i++) {
    for (let c = 0; c < 4; c++) {
      pos[i * 12 + c * 3] = corners[c * 2];
      pos[i * 12 + c * 3 + 1] = corners[c * 2 + 1];
      seed[i * 4 + c] = i;
    }
    const v = i * 4;
    index.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mat = new THREE.MeshBasicNodeMaterial({ color: 0xa9c0cc, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const s = attribute('seed', 'float');
  const W = 48;
  const H = 30;
  const px = fract(hash(s.mul(4)).sub(rainCam.x.div(W))).mul(W).sub(W / 2).add(rainCam.x);
  const fall = hash(s.mul(4).add(1)).mul(8).add(17).div(H);
  const py = fract(hash(s.mul(4).add(2)).sub(time.mul(fall))).sub(0.5).mul(H).add(rainCam.y);
  const pz = hash(s.mul(4).add(3)).mul(12).sub(7.2);
  mat.positionNode = positionLocal.add(vec3(px, py, pz));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.visible = false;
  scene.add(mesh);
  const setCount = () => geo.setDrawRange(0, Math.min(RAIN_MAX, kit.detail(700)) * 6);
  setCount();
  kit.onQuality(setCount);
  return { mesh };
})();

// ---------------------------------------------------------------- the two missions
const levels = MISSIONS.map((def, i) => buildLevel(def, i));

function applyTheme(theme) {
  const t = THEMES[theme];
  skyBase.setHex(t.bg);
  scene.background.setHex(t.bg);
  scene.fog.color.setHex(t.fog);
  scene.fog.density = t.density;
  hemi.color.setHex(t.hemi[0]);
  hemi.groundColor.setHex(t.hemi[1]);
  hemi.intensity = t.hemi[2];
  sun.color.setHex(t.sun[0]);
  sun.intensity = t.sun[1];
  fill.color.setHex(t.fill[0]);
  fill.intensity = t.fill[1];
  rain.mesh.visible = theme === 'storm';
  game.flash = 0;
  game.lightning = 4 + Math.random() * 4;
}

function setMission(index) {
  const next = levels[index] || levels[0];
  if (L === next) return;
  if (L) {
    detachGrapple();
    L.group.visible = false;
  }
  L = next;
  for (const lv of levels) lv.group.visible = lv === L;
  applyTheme(L.def.theme);
  beaconLight.position.set(L.def.spire.x, L.spire.beaconY - 0.05, 0);
  ui.brandMission.textContent = L.def.name;
  clearBullets();
  clearSparks();
  applyAmbient();
}

// ---------------------------------------------------------------- run flow
function applyStats() {
  const diff = DIFFICULTY[game.difficulty];
  player.grappleRange = BALANCE.grappleBaseRange + (player.rank >= 2 ? BALANCE.grappleRankBonus : 0) + (player.gear.has('grip') ? BALANCE.gripGearBonus : 0);
  player.reelSpeed = BALANCE.reelSpeed + (player.gear.has('reel') ? BALANCE.reelGearBonus : 0);
  player.fireCooldown = player.gear.has('pulse') ? BALANCE.pulseFireCooldown : BALANCE.fireCooldown;
  player.maxHp = Math.max(2, BALANCE.playerMaxHp + diff.hp + (player.rank >= 3 ? 1 : 0));
  player.hp = Math.min(player.hp, player.maxHp);
}

function snapCamera() {
  game.cameraX = clamp(player.x + player.facing * 1.8, 6, L.def.camMaxX);
  game.cameraY = clamp(player.y + 4.2, 4.3, 12.5);
}

function resetRun() {
  const d = L.def;
  Object.assign(player, {
    x: d.start.x, y: d.start.y, vx: 0, vy: 0, facing: 1, grounded: true, xp: 0, rank: 1, invuln: 0, fireTimer: 0,
    grapple: null, respawnX: d.start.x, respawnY: d.start.y, deaths: 0, muzzle: 0,
  });
  player.gear.clear();
  applyStats();
  player.hp = player.maxHp;
  game.anchorClock = 0;
  for (const a of L.anchors) a.active = false;
  animateAnchors(0);
  for (const e of L.enemies) {
    e.x = e.startX;
    e.y = e.cy = e.baseY;
    e.dir = e.id % 2 ? -1 : 1;
    e.hp = e.maxHp;
    e.dead = false;
    e.fireTimer = 0.4 + (e.id % 3) * 0.4;
    e.hitT = 0;
    e.mesh.visible = true;
  }
  for (const p of L.pickups) {
    p.taken = false;
    p.mesh.visible = true;
  }
  for (const lamp of L.lamps) lamp.material = M.lampOff;
  clearBullets();
  clearSparks();
  Object.assign(game, {
    elapsed: 0, kills: 0, shots: 0, hits: 0, cp: -1, interact: 0, everGrappled: false,
    tutorialPhase: 0, tutorialHide: 0, shake: 0, nearConsole: false,
  });
  kit.touch?.setShown('act', false);
  snapCamera();
  const sp = L.spire;
  sp.beacon.material.color.setHex(0x6d2e28);
  sp.beacon.material.emissive.setHex(0xff2f1f);
  sp.consoleLight.material.emissiveIntensity = 1.3;
  beaconLight.color.setHex(0xff3d2e);
  toastQ.length = 0;
  activeToastTimer = 0;
  ui.toast.classList.remove('show');
  checkpointTimer = 0;
  ui.checkpoint.classList.remove('show');
  objectiveText = '';
  hudCache.hp = hudCache.xp = hudCache.rank = hudCache.sec = -1;
  hudCache.gear = '';
  updateObjective(0);
  showTutorial(0);
  updateHUD();
}

function beginPlay() {
  game.state = 'play';
  showModal(null);
  kit.canvas.focus({ preventScroll: true });
}

function deploy() {
  initAudio();
  resetRun();
  beginPlay();
}

function continueRun() {
  const s = store.save;
  if (!s || !MISSIONS[s.mission]) return;
  initAudio();
  game.difficulty = DIFFICULTY[s.difficulty] ? s.difficulty : 'regular';
  store.mission = s.mission;
  saveStore();
  setMission(s.mission);
  resetRun();
  const cps = L.def.checkpoints;
  player.xp = Math.max(0, s.xp | 0);
  player.rank = clamp(s.rank | 0, 1, 3);
  player.deaths = Math.max(0, s.deaths | 0);
  for (const id of Array.isArray(s.gear) ? s.gear : []) if (id === 'grip' || id === 'reel' || id === 'pulse') player.gear.add(id);
  game.kills = Math.max(0, s.kills | 0);
  game.shots = Math.max(0, s.shots | 0);
  game.hits = Math.max(0, s.hits | 0);
  game.elapsed = Math.max(0, +s.elapsed || 0);
  for (const id of Array.isArray(s.dead) ? s.dead : []) {
    const e = L.enemies[id];
    if (e) {
      e.dead = true;
      e.mesh.visible = false;
    }
  }
  for (const i of Array.isArray(s.taken) ? s.taken : []) {
    const p = L.pickups[i];
    if (p) {
      p.taken = true;
      p.mesh.visible = false;
    }
  }
  applyStats();
  player.hp = player.maxHp;
  game.cp = clamp(s.cp | 0, 0, cps.length - 1);
  for (let i = 0; i <= game.cp; i++) L.lamps[i].material = M.lampOn;
  const c = cps[game.cp];
  player.x = player.respawnX = c.rx;
  player.y = player.respawnY = c.ry;
  player.invuln = 1.2;
  snapCamera();
  game.tutorialPhase = 99;
  ui.tutorial.classList.add('hidden');
  updateHUD();
  beginPlay();
  showToast('CHECKPOINT RESTORED');
}

function saveCheckpoint() {
  store.save = {
    mission: L.index, difficulty: game.difficulty, cp: game.cp,
    xp: player.xp, rank: player.rank, gear: [...player.gear], deaths: player.deaths,
    kills: game.kills, shots: game.shots, hits: game.hits, elapsed: Math.round(game.elapsed * 10) / 10,
    dead: L.enemies.filter((e) => e.dead).map((e) => e.id),
    taken: L.pickups.filter((p) => p.taken).map((p) => p.index),
  };
  saveStore();
}

function showTitle() {
  game.state = 'title';
  // A continued run may have used another difficulty: the briefing shows (and DEPLOY uses) the picked one.
  game.difficulty = store.difficulty;
  resetRun();
  refreshStartCard();
  showModal(ui.start);
}

function openPause() {
  if (game.state !== 'play') return;
  game.state = 'pause';
  ui.pauseInfo.textContent = `${L.def.code} ${L.def.name} · ${DIFFICULTY[game.difficulty].label} · ${formatTime(game.elapsed)}`;
  ui.resetBtn.textContent = game.cp >= 0 ? 'BACK TO CHECKPOINT' : 'BACK TO START';
  showModal(ui.pause);
}
function resumePlay() {
  if (game.state !== 'pause') return;
  game.state = 'play';
  showModal(null);
  kit.canvas.focus({ preventScroll: true });
}

function gradeRun(t, deaths, accuracy) {
  const par = L.def.par;
  let score = t <= par ? 3 : t <= par * 1.35 ? 2 : t <= par * 1.8 ? 1 : 0;
  score += deaths === 0 ? 2 : deaths <= 2 ? 1 : 0;
  score += accuracy >= 55 ? 1 : 0;
  return score >= 6 ? 'S' : score >= 4 ? 'A' : score >= 2 ? 'B' : 'C';
}

function completeMission() {
  if (game.state !== 'play') return;
  game.state = 'done';
  detachGrapple();
  const sp = L.spire;
  sp.beacon.material.color.setHex(0x35d86d);
  sp.beacon.material.emissive.setHex(0x35ff78);
  beaconLight.color.setHex(0x4aff87);
  burst(L.def.spire.consoleX, L.def.spire.consoleY + 0.6, 0x7cf1cd, 20, 5);
  sfx('complete');
  setObjective(L.def.doneText);
  game.nearConsole = false;
  kit.touch?.setShown('act', false);

  const t = game.elapsed;
  const accuracy = game.shots ? Math.round((game.hits / game.shots) * 100) : 0;
  const grade = gradeRun(t, player.deaths, accuracy);
  const key = `${L.def.id}:${game.difficulty}`;
  const prev = store.best[key];
  const newBest = !prev || t < prev.time;
  const bestGrade = !prev || GRADE_ORDER.indexOf(grade) > GRADE_ORDER.indexOf(prev.grade) ? grade : prev.grade;
  store.best[key] = { time: newBest ? Math.round(t * 10) / 10 : prev.time, grade: bestGrade };
  if (store.save && store.save.mission === L.index) store.save = null;
  saveStore();

  ui.clearEyebrow.textContent = L.def.clearEyebrow;
  ui.clearName.textContent = L.def.name;
  ui.grade.textContent = grade;
  ui.grade.dataset.grade = grade;
  ui.clearDiff.textContent = `${DIFFICULTY[game.difficulty].label} · PAR ${formatTime(L.def.par)}`;
  ui.newBest.hidden = !newBest;
  ui.bestTime.textContent = newBest ? '' : `BEST ${formatTime(store.best[key].time, true)} · GRADE ${store.best[key].grade}`;
  ui.stats.innerHTML =
    `<div class="stat"><b>${formatTime(t, true)}</b><span>MISSION TIME</span></div>` +
    `<div class="stat"><b>${game.kills}/${L.enemies.length}</b><span>HOSTILES DISABLED</span></div>` +
    `<div class="stat"><b>${accuracy}%</b><span>SHOT ACCURACY</span></div>` +
    `<div class="stat"><b>${player.deaths}</b><span>FIELD RESETS</span></div>`;
  const next = MISSIONS[L.index + 1];
  ui.nextBtn.hidden = !next;
  if (next) ui.nextBtn.textContent = `NEXT: ${next.code} ${next.name}`;
  ui.restartBtn.className = next ? 'secondary' : 'primary';
  setTimeout(() => {
    if (game.state === 'done') showModal(ui.complete);
  }, 700);
}

function formatTime(s, tenths = false) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const base = `${m}:${String(sec).padStart(2, '0')}`;
  return tenths ? `${base}.${Math.floor((s * 10) % 10)}` : base;
}

// ---------------------------------------------------------------- menus
// The three cards (briefing, pause, results) work with mouse, touch, keyboard and gamepad:
// the move action walks the buttons row by row, A / Space / Enter presses, B or Start backs out.
let modal = ui.start;
const cards = [ui.start, ui.pause, ui.complete];
function showModal(el) {
  for (const m of cards) {
    const on = m === el;
    m.classList.toggle('open', on);
    m.inert = !on;
  }
  modal = el;
  kit.touch?.suspend(!!el, 'modal');
  if (el) {
    const first = [...el.querySelectorAll('[data-autofocus]')].find((b) => !b.hidden);
    focusItem(first || menuItems()[0]);
  } else if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  navHeld = '';
  input.settle();
  syncAudio();
}
function menuItems() {
  return modal ? [...modal.querySelectorAll('button')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null) : [];
}
function focusItem(b) {
  if (!b) return;
  for (const n of document.querySelectorAll('#app .is-focus')) n.classList.remove('is-focus');
  b.classList.add('is-focus');
  b.focus({ preventScroll: true });
  b.scrollIntoView?.({ block: 'nearest' });
}
for (const m of cards) {
  m.addEventListener('focusin', (e) => {
    if (!e.target.matches('button')) return;
    for (const n of document.querySelectorAll('#app .is-focus')) if (n !== e.target) n.classList.remove('is-focus');
    e.target.classList.add('is-focus');
  });
}
function currentItem(items = menuItems()) {
  if (items.includes(document.activeElement)) return document.activeElement;
  return items.find((b) => b.classList.contains('is-focus')) || items[0] || null;
}
function moveFocus(dir) {
  const rows = [];
  for (const b of menuItems()) {
    const holder = b.closest('.choice-row, .btn-row') || b;
    const last = rows[rows.length - 1];
    if (last && last.holder === holder) last.items.push(b);
    else rows.push({ holder, items: [b] });
  }
  if (!rows.length) return;
  const cur = currentItem();
  let r = rows.findIndex((row) => row.items.includes(cur));
  if (r < 0) r = 0;
  const c = Math.max(0, rows[r].items.indexOf(cur));
  let pick = null;
  if (dir === 'left' || dir === 'right') {
    pick = rows[r].items[c + (dir === 'right' ? 1 : -1)];
  } else {
    const row = rows[r + (dir === 'down' ? 1 : -1)];
    if (row) pick = row.items.find((b) => b.getAttribute('aria-pressed') === 'true') || row.items[Math.min(c, row.items.length - 1)];
  }
  if (pick) {
    focusItem(pick);
    sfx('select');
  }
}
let navHeld = '';
let navRepeat = 0;
function menuNav(dt) {
  if (!modal || kit.menu.isOpen) return;
  const v = input.vector('move');
  const dir = v.y > 0.55 ? 'up' : v.y < -0.55 ? 'down' : v.x > 0.55 ? 'right' : v.x < -0.55 ? 'left' : '';
  let step = '';
  if (dir !== navHeld) {
    navHeld = dir;
    navRepeat = 0.42;
    step = dir;
  } else if (dir) {
    navRepeat -= dt;
    if (navRepeat <= 0) {
      navRepeat = 0.13;
      step = dir;
    }
  }
  if (step) moveFocus(step);
  if (input.pressed('grapple')) currentItem()?.click();
  else if (input.pressed('confirm')) {
    // Enter only reaches the game when no button holds keyboard focus (say, right after a mouse
    // click on a mission or difficulty): on the briefing it then means DEPLOY, not "pick it again".
    const cur = currentItem();
    (cur?.classList.contains('choice') ? ui.startBtn : cur)?.click();
  } else if ((input.pressed('back') || input.pressed('pause')) && modal === ui.pause) resumePlay();
  else if (input.pressed('back') && modal === ui.complete) showTitle();
}

function refreshStartCard() {
  for (const b of ui.missionBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.mission) === L.index));
  for (const b of ui.diffBtns) b.setAttribute('aria-pressed', String(b.dataset.difficulty === game.difficulty));
  const label = DIFFICULTY[game.difficulty].label;
  const best = store.best[`${L.def.id}:${game.difficulty}`];
  ui.best.textContent = best
    ? `BEST · ${L.def.name} · ${label}: ${formatTime(best.time, true)} · GRADE ${best.grade}`
    : `${L.def.name} · ${label} · PAR ${formatTime(L.def.par)} · NO RECORD YET`;
  const s = store.save;
  ui.continueBtn.hidden = !s;
  if (s) ui.continueBtn.textContent = `CONTINUE · ${MISSIONS[s.mission].code} ${MISSIONS[s.mission].name} · CHECKPOINT ${(s.cp | 0) + 1}`;
}

for (const b of ui.missionBtns) {
  b.addEventListener('click', () => {
    if (game.state !== 'title') return;
    const i = Number(b.dataset.mission);
    if (!MISSIONS[i]) return;
    store.mission = i;
    saveStore();
    setMission(i);
    resetRun();
    refreshStartCard();
    sfx('select');
  });
}
for (const b of ui.diffBtns) {
  b.addEventListener('click', () => {
    if (game.state !== 'title' || !DIFFICULTY[b.dataset.difficulty]) return;
    game.difficulty = store.difficulty = b.dataset.difficulty;
    saveStore();
    resetRun();
    refreshStartCard();
    sfx('select');
  });
}
ui.startBtn.addEventListener('click', () => {
  // Continue restores a different difficulty; a fresh deploy uses the one picked here.
  game.difficulty = store.difficulty;
  deploy();
});
ui.continueBtn.addEventListener('click', continueRun);
ui.startSettings.addEventListener('click', () => kit.menu.open());
ui.resumeBtn.addEventListener('click', resumePlay);
ui.resetBtn.addEventListener('click', () => {
  if (game.state !== 'pause') return;
  respawn();
  resumePlay();
});
ui.restartMissionBtn.addEventListener('click', deploy);
ui.settingsBtn.addEventListener('click', () => kit.menu.open());
ui.quitBtn.addEventListener('click', showTitle);
ui.nextBtn.addEventListener('click', () => {
  const n = L.index + 1;
  if (!MISSIONS[n]) return;
  store.mission = n;
  saveStore();
  setMission(n);
  deploy();
});
ui.restartBtn.addEventListener('click', deploy);
ui.briefBtn.addEventListener('click', showTitle);
ui.pauseHud.addEventListener('click', openPause);
// Leaving the tab mid-mission pauses it.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) openPause();
  syncAudio();
});

// ---------------------------------------------------------------- gameplay
function animateAnchors(dt) {
  game.anchorClock += dt;
  for (const a of L.anchors) {
    if (!a.move) continue;
    a.x = a.baseX + Math.sin(game.anchorClock * a.move.speed + a.move.phase) * a.move.range;
    a.mesh.position.x = a.x;
  }
}

function findAnchor(targetId = null) {
  let best = null;
  let bestScore = Infinity;
  for (const a of L.anchors) {
    if (targetId !== null && a.id !== targetId) continue;
    const dx = a.x - player.x;
    const dy = a.y - (player.y + 1.05);
    const d = Math.hypot(dx, dy);
    if (d > player.grappleRange || dy < -1.0) continue;
    const score = d + (Math.sign(dx) !== player.facing ? 1.2 : 0);
    if (score < bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best;
}
function attach(a) {
  const dx = player.x - a.x;
  const dy = player.y + 1.05 - a.y;
  player.grapple = { id: a.id, length: Math.max(2.0, Math.hypot(dx, dy) * 0.94) };
  a.active = true;
  game.everGrappled = true;
  showToast('GRIP LOCKED', true);
  sfx('grapple');
  burst(a.x, a.y, 0x7cf1cd, 6, 2.5);
}
function toggleGrapple() {
  if (game.state !== 'play') return;
  if (player.grapple) {
    detachGrapple();
    sfx('release');
    return;
  }
  const a = findAnchor();
  if (!a) {
    showToast('OUT OF CABLE RANGE', true);
    return;
  }
  attach(a);
}
/** Clicking or tapping a ring: grab that one (switching straight from another), or let go of it. */
function grappleTo(id) {
  if (game.state !== 'play') return;
  if (player.grapple?.id === id) {
    detachGrapple();
    sfx('release');
    return;
  }
  const a = findAnchor(id);
  if (!a) {
    showToast('OUT OF CABLE RANGE', true);
    return;
  }
  detachGrapple();
  attach(a);
}
function detachGrapple() {
  if (!player.grapple) return;
  const a = L.anchors[player.grapple.id];
  if (a) a.active = false;
  player.grapple = null;
}

function firePlayer() {
  if (player.fireTimer > 0 || game.state !== 'play') return;
  player.fireTimer = player.fireCooldown;
  player.muzzle = 0.05;
  game.shots++;
  sfx('fire');
  spawnBullet(player.x + player.facing * 0.72, player.y + 1.0, player.facing * BALANCE.playerBulletSpeed, 0, false, 2.2);
}

// Clicking a ring grapples straight to it (a mouse click on a ring does not also fire);
// a quick tap on a ring does the same on touch.
let tap = null;
let ringClickHeld = false;
function pointerTargets() {
  const p = input.pointer;
  if (p.justDown) {
    tap = { x: p.x, y: p.y, t: game.clock, type: p.type, pinched: false };
    if (p.type === 'mouse') {
      const id = anchorAtScreen(p.x, p.y, 48);
      if (id !== null) {
        grappleTo(id);
        ringClickHeld = true;
      }
    }
  }
  if (tap && input.zoom()) tap.pinched = true;
  if (p.justUp || !p.down) {
    if (p.justUp && tap && tap.type !== 'mouse' && !tap.pinched && game.clock - tap.t < 0.28 && Math.hypot(p.x - tap.x, p.y - tap.y) < 14) {
      const id = anchorAtScreen(p.x, p.y, 74);
      if (id !== null) grappleTo(id);
    }
    tap = null;
    ringClickHeld = false;
  }
}

function update(dt) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.fireTimer = Math.max(0, player.fireTimer - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
  game.elapsed += dt;
  animateAnchors(dt);
  if (input.pressed('grapple')) toggleGrapple();
  pointerTargets();
  if (input.down('fire') && !ringClickHeld) firePlayer();
  const mv = input.vector('move');
  const mx = mv.x;
  const ry = mv.y;
  if (Math.abs(mx) > 0.1) player.facing = mx > 0 ? 1 : -1;
  const accel = player.grounded ? BALANCE.groundAccel : BALANCE.airAccel;
  if (Math.abs(mx) > 0.06) player.vx += mx * accel * dt;
  else if (player.grounded) player.vx *= Math.pow(0.045, dt);
  player.vx = clamp(player.vx, -BALANCE.maxSpeed, BALANCE.maxSpeed);
  player.vy -= BALANCE.gravity * dt;

  const oldX = player.x;
  const oldY = player.y;
  player.x += player.vx * dt;
  resolveHorizontal(oldX);
  player.y += player.vy * dt;
  player.grounded = false;
  resolveVertical(oldY);

  if (player.grapple) applyGrapple(dt, ry, mx);
  depenetrate();
  if (player.y < L.def.killY) fellOut();
  if (player.x < -1 || player.x > L.def.maxX) {
    player.x = clamp(player.x, -1, L.def.maxX);
    player.vx = 0;
  }

  updateEnemies(dt);
  updateBullets(dt);
  updatePickups(dt);
  updateProgression();
  updateObjective(dt);
  updateTutorial(dt);
  updateAmbience(dt);
  updateVisuals(dt, true);
  updateCamera(dt);
  updateHUD();
}

function resolveHorizontal(oldX) {
  const half = 0.34;
  const bottom = player.y + 0.05;
  const top = player.y + 1.68;
  for (const p of L.platforms) {
    const l = p.x - p.w / 2, r = p.x + p.w / 2, b = p.y - p.h / 2, t = p.y + p.h / 2;
    if (top <= b + 0.04 || bottom >= t - 0.04) continue;
    if (player.x + half > l && player.x - half < r) {
      const step = t - player.y;
      if (player.grounded && step > 0 && step <= BALANCE.stepUp) {
        player.y = t;
        continue;
      }
      if (oldX + half <= l) {
        player.x = l - half - 0.002;
        player.vx = Math.min(0, player.vx);
      } else if (oldX - half >= r) {
        player.x = r + half + 0.002;
        player.vx = Math.max(0, player.vx);
      }
    }
  }
}
function resolveVertical(oldY) {
  const half = 0.31;
  const left = player.x - half;
  const right = player.x + half;
  const height = 1.7;
  for (const p of L.platforms) {
    const l = p.x - p.w / 2, r = p.x + p.w / 2, b = p.y - p.h / 2, t = p.y + p.h / 2;
    if (right <= l + 0.02 || left >= r - 0.02) continue;
    if (player.vy <= 0 && oldY >= t - 0.08 && player.y <= t + 0.02) {
      player.y = t;
      player.vy = 0;
      player.grounded = true;
    } else if (player.vy > 0 && oldY + height <= b + 0.08 && player.y + height >= b - 0.02) {
      player.y = b - height - 0.002;
      player.vy = 0;
    }
  }
}
/**
 * The rope constraint moves the player directly, which could leave them inside a wall or
 * under a ledge with nothing to push them out (stuck until they let go). Push out along
 * the shallowest axis instead.
 */
function depenetrate() {
  const half = 0.31;
  const height = 1.7;
  for (const p of L.platforms) {
    const l = p.x - p.w / 2, r = p.x + p.w / 2, b = p.y - p.h / 2, t = p.y + p.h / 2;
    const pushL = player.x + half - l;
    const pushR = r - (player.x - half);
    const pushD = player.y + height - b;
    const pushU = t - player.y;
    const ox = Math.min(pushL, pushR);
    const oy = Math.min(pushD, pushU);
    if (ox <= 0.001 || oy <= 0.001) continue;
    if (ox < oy) {
      if (pushL < pushR) {
        player.x = l - half - 0.002;
        player.vx = Math.min(0, player.vx);
      } else {
        player.x = r + half + 0.002;
        player.vx = Math.max(0, player.vx);
      }
    } else if (pushU <= pushD) {
      player.y = t;
      player.vy = Math.max(0, player.vy);
      player.grounded = true;
    } else {
      player.y = b - height - 0.002;
      player.vy = Math.min(0, player.vy);
    }
  }
}

function applyGrapple(dt, reel, move) {
  const a = L.anchors[player.grapple.id];
  if (!a) {
    detachGrapple();
    return;
  }
  player.grapple.length -= Math.max(0, reel) * player.reelSpeed * dt;
  player.grapple.length += Math.max(0, -reel) * 2.5 * dt;
  player.grapple.length = clamp(player.grapple.length, 1.8, player.grappleRange);
  player.vx += move * 12 * dt;
  const px = player.x, py = player.y + 1.05, rx = px - a.x, ry = py - a.y, d = Math.hypot(rx, ry) || 0.001;
  if (d > player.grapple.length) {
    const ux = rx / d, uy = ry / d;
    player.x = a.x + ux * player.grapple.length;
    player.y = a.y + uy * player.grapple.length - 1.05;
    const vr = player.vx * ux + player.vy * uy;
    if (vr > 0) {
      player.vx -= vr * ux;
      player.vy -= vr * uy;
    }
    player.vx += move * 5.0 * dt;
    resolveVertical(player.y + 0.05);
  }
  if (Math.hypot(player.x - a.x, player.y + 1.05 - a.y) > player.grappleRange + 1.5) detachGrapple();
}

function fellOut() {
  if (L.def.waterY !== undefined) {
    sfx('splash');
    burst(player.x, L.def.waterY + 0.1, 0x9fd8e0, 16, 6);
  }
  damagePlayer(99);
}

function updateEnemies(dt) {
  const diff = DIFFICULTY[game.difficulty];
  const aggro = 12 * diff.range;
  for (const e of L.enemies) {
    if (e.dead) continue;
    if (e.hitT > 0) e.hitT = Math.max(0, e.hitT - dt);
    if (e.kind === 'drone') {
      updateDrone(e, dt, aggro, diff);
      continue;
    }
    const dx = player.x - e.x, dy = player.y + 0.8 - (e.y + 0.8), dist = Math.hypot(dx, dy);
    if (e.kind === 'guard' && dist > 7.5) {
      e.x += e.dir * 1.05 * dt;
      if (Math.abs(e.x - e.startX) > e.patrol) {
        e.dir *= -1;
        e.x = e.startX + Math.sign(e.x - e.startX) * e.patrol;
      }
    }
    if (dist < aggro && Math.abs(dy) < 5.5) {
      e.dir = dx >= 0 ? 1 : -1;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = BALANCE.enemyFireCooldown * (e.kind === 'turret' ? 0.82 : 1) * diff.fire + (e.id % 3) * 0.08;
        const len = Math.hypot(dx, dy) || 1, speed = BALANCE.enemyBulletSpeed * (e.kind === 'turret' ? 1.1 : 1) * diff.shot;
        spawnBullet(e.x + e.dir * 0.55, e.y + 0.9, (dx / len) * speed, (dy / len) * speed, true, 3.0);
      }
    }
  }
}
/** Drones patrol high, then drop to the player's firing line and hold off to one side. */
function updateDrone(e, dt, aggro, diff) {
  const px = player.x;
  const py = player.y + 1.05;
  const dx = px - e.x;
  const dy = py - e.y;
  const dist = Math.hypot(dx, dy);
  let tx = e.x;
  let ty = e.baseY;
  if (dist < aggro) {
    const side = e.x >= px ? 1 : -1;
    tx = px + side * 3.4;
    ty = py + 0.1;
    e.dir = dx >= 0 ? 1 : -1;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && Math.abs(dy) < 4.5) {
      e.fireTimer = BALANCE.enemyFireCooldown * 1.2 * diff.fire + (e.id % 3) * 0.1;
      const aimY = player.y + 0.9 - (e.y - 0.2);
      const len = Math.hypot(dx, aimY) || 1;
      const speed = BALANCE.enemyBulletSpeed * diff.shot;
      spawnBullet(e.x + e.dir * 0.45, e.y - 0.2, (dx / len) * speed, (aimY / len) * speed, true, 3.0);
    }
  } else {
    tx = e.x + e.dir * 1.1 * dt;
    if (Math.abs(tx - e.startX) > e.patrol) e.dir = tx > e.startX ? -1 : 1;
  }
  tx = clamp(tx, e.startX - e.patrol * 1.6, e.startX + e.patrol * 1.6);
  ty = clamp(ty, e.baseY - 4.2, e.baseY + 1.5);
  e.x += clamp(tx - e.x, -2.2 * dt, 2.2 * dt);
  e.cy += clamp(ty - e.cy, -1.8 * dt, 1.8 * dt);
  e.y = e.cy + Math.sin(game.elapsed * 3 + e.id) * 0.1;
}

function bulletHitsEnemy(b, e) {
  if (e.kind === 'drone') return Math.abs(b.x - e.x) < 0.6 && Math.abs(b.y - e.y) < 0.6;
  return Math.abs(b.x - e.x) < 0.55 && b.y > e.y - 0.1 && b.y < e.y + 1.7;
}
function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.mesh) b.mesh.position.set(b.x, b.y, 0.25);
    let remove = b.life <= 0;
    if (!remove && pointHitsPlatform(b.x, b.y)) {
      remove = true;
      burst(b.x, b.y, b.enemy ? 0xff8a5c : 0xffe58a, 2, 2);
    }
    if (!remove && !b.enemy) {
      for (const e of L.enemies) {
        if (e.dead || !bulletHitsEnemy(b, e)) continue;
        e.hp--;
        e.hitT = 0.14;
        game.hits++;
        remove = true;
        burst(b.x, b.y, 0xffdf49, 4, 3);
        if (e.hp <= 0) killEnemy(e);
        else sfx('tick');
        break;
      }
    } else if (!remove && b.enemy && player.invuln <= 0 && Math.abs(b.x - player.x) < 0.42 && b.y > player.y && b.y < player.y + 1.7) {
      damagePlayer(1, Math.sign(b.vx));
      remove = true;
    }
    if (remove) {
      releaseBullet(b);
      bullets.splice(i, 1);
    }
  }
}
function pointHitsPlatform(x, y) {
  for (const p of L.platforms) if (x > p.x - p.w / 2 && x < p.x + p.w / 2 && y > p.y - p.h / 2 && y < p.y + p.h / 2) return true;
  return false;
}
function killEnemy(e) {
  e.dead = true;
  e.mesh.visible = false;
  player.xp += e.xp;
  game.kills++;
  game.shake = Math.max(game.shake, 0.12);
  burst(e.x, e.kind === 'drone' ? e.y : e.y + 0.8, 0xff8a3d, 14, 5);
  showToast(`+${e.xp} FIELD XP`);
  sfx('kill');
}
function damagePlayer(amount, dir = 0) {
  if (player.invuln > 0 && amount < 90) return;
  player.hp -= amount;
  player.invuln = 1.05;
  player.vx += dir * 3.8;
  player.vy = 4.6;
  game.shake = 0.32;
  detachGrapple();
  sfx('hit');
  burst(player.x, player.y + 1.0, 0xff5338, 6, 3);
  ui.damageFlash.classList.add('show');
  setTimeout(() => ui.damageFlash.classList.remove('show'), 90);
  if (player.hp <= 0) respawn();
}
function respawn() {
  detachGrapple();
  player.deaths++;
  player.hp = player.maxHp;
  player.x = player.respawnX;
  player.y = player.respawnY;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.invuln = 1.6;
  clearBullets();
  showToast('FIELD RESET');
}

function updatePickups(dt) {
  for (const p of L.pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 1.3;
    p.mesh.position.y = p.y + 0.08 * Math.sin(game.elapsed * 3.85 + p.x);
    if (Math.abs(player.x - p.x) < 0.65 && Math.abs(player.y + 0.7 - p.y) < 1.25) {
      p.taken = true;
      p.mesh.visible = false;
      burst(p.x, p.y + 0.4, p.kind === 'med' ? 0x55cc6b : 0x4ed8bf, 10, 3);
      applyPickup(p);
    }
  }
}
function applyPickup(p) {
  if (p.kind === 'med') {
    player.hp = Math.min(player.maxHp, player.hp + 2);
    showToast('FIELD PATCH +2');
    sfx('gear');
    return;
  }
  player.gear.add(p.id);
  applyStats();
  showToast(p.label);
  sfx('gear');
}
function updateProgression() {
  if (player.rank === 1 && player.xp >= BALANCE.rank2XP) {
    player.rank = 2;
    applyStats();
    player.hp = Math.min(player.maxHp, player.hp + 1);
    showToast('RANK 2: CABLE RANGE +1m');
    sfx('rank');
  }
  if (player.rank === 2 && player.xp >= BALANCE.rank3XP) {
    player.rank = 3;
    applyStats();
    player.hp = player.maxHp;
    showToast('RANK 3: VITAL +1');
    sfx('rank');
  }
  const cps = L.def.checkpoints;
  while (game.cp + 1 < cps.length && player.x >= cps[game.cp + 1].x) {
    game.cp++;
    const c = cps[game.cp];
    player.respawnX = c.rx;
    player.respawnY = c.ry;
    L.lamps[game.cp].material = M.lampOn;
    showCheckpoint();
    saveCheckpoint();
  }
}

let objectiveText = '';
function setObjective(text) {
  if (text === objectiveText) return;
  objectiveText = text;
  ui.objective.textContent = text;
}
function updateObjective(dt) {
  const d = L.def;
  const sp = d.spire;
  const dist = Math.hypot(player.x - sp.consoleX, player.y + 0.8 - sp.consoleY);
  if (dist < 1.45 && game.state === 'play' && input.down('act')) {
    game.interact += dt;
    if (game.interact >= BALANCE.interactTime) completeMission();
  } else game.interact = Math.max(0, game.interact - dt * 1.5);
  if (game.state === 'done') return;
  let stage = null;
  for (const o of d.objectives) {
    if (player.x < o.until) {
      stage = o;
      break;
    }
  }
  if (stage) setObjective(stage.text);
  else if (dist > 2.2) setObjective(d.climbText);
  else if (game.interact > 0) setObjective(`${d.actText} ${Math.min(100, Math.floor((game.interact / BALANCE.interactTime) * 10) * 10)}%`);
  else setObjective(d.actText);
  if (dist < 2.2) L.spire.consoleLight.material.emissiveIntensity = 1.3 + game.interact * 2.2;
  // The ACT touch button only shows where it does something.
  const near = dist < 2.2 && game.state === 'play';
  if (near !== game.nearConsole) {
    game.nearConsole = near;
    kit.touch?.setShown('act', near);
  }
}

// ---------------------------------------------------------------- prompts
// Prompts follow the device in use: keyboard and mouse, gamepad or touch.
const TUTORIAL = [
  (s) => (s === 'keyboard' ? 'Move with A / D. There is no jump.' : 'Move with the left stick. There is no jump.'),
  (s) => (s === 'touch' ? 'No jump. Tap a glowing ring or GRAPPLE.' : s === 'gamepad' ? 'No jump. Face a glowing ring and press A.' : 'No jump. Aim for a glowing ring and press SPACE (or click it).'),
  (s) => (s === 'touch' ? 'Swing with the stick. Push it up/down to reel.' : s === 'gamepad' ? 'Swing with the stick. Push it up/down to reel. A releases.' : 'Swing with A/D. Reel with W/S. SPACE releases.'),
  (s) => (s === 'touch' ? 'Use FIRE to clear the patrol. High and low routes both work.' : s === 'gamepad' ? 'Use X or RT to fire. High and low routes both work.' : 'Use F/J or click to fire. High and low routes both work.'),
  () => 'XP upgrades your cable and vitality. Gear caches improve equipment.',
];
const STORM_HINTS = [
  'Floodwater is lethal. Cable trolleys slide along their lines: grip one as it swings near.',
  'Drones drop to your firing line. Shoot them as they close in.',
];
const BRIEF = {
  keyboard: { move: 'A / D', reel: 'W / S', grapple: 'SPACE', fire: 'F / J / CLICK', act: 'E', zoom: 'WHEEL / + −' },
  gamepad: { move: 'L-STICK', reel: 'STICK ↑ ↓', grapple: 'A', fire: 'X / RT', act: 'Y', zoom: 'LB / RB' },
  touch: { move: 'STICK', reel: 'STICK ↑ ↓', grapple: 'BUTTON / RING', fire: 'HOLD FIRE', act: 'HOLD ACT', zoom: 'PINCH' },
};
const HINT = {
  keyboard: 'ARROWS move, ENTER selects. ESC or P pauses. Click a ring to grab it.',
  gamepad: 'A selects, B backs out. START pauses.',
  touch: 'Tap a ring to grab it. The II button pauses.',
};
function tutorialText(phase) {
  if (L.def.theme === 'storm') return STORM_HINTS[phase] || '';
  return TUTORIAL[phase] ? TUTORIAL[phase](input.source) : '';
}
function showTutorial(phase) {
  ui.tutorialText.textContent = tutorialText(phase);
  ui.tutorial.classList.remove('hidden');
}
function refreshPrompts() {
  const src = BRIEF[input.source] ? input.source : 'keyboard';
  for (const el of ui.briefKeys) el.textContent = BRIEF[src][el.dataset.key];
  ui.startHint.textContent = HINT[src];
  if (game.state === 'play' && !ui.tutorial.classList.contains('hidden')) ui.tutorialText.textContent = tutorialText(game.tutorialPhase);
}
input.onSourceChange(refreshPrompts);

function updateTutorial(dt) {
  if (L.def.theme === 'storm') {
    if (game.tutorialPhase === 0 && player.x > 29) {
      showTutorial((game.tutorialPhase = 1));
      game.tutorialHide = 6;
    }
  } else {
    if (game.tutorialPhase === 0 && player.x > 6) showTutorial((game.tutorialPhase = 1));
    if (game.tutorialPhase === 1 && game.everGrappled) showTutorial((game.tutorialPhase = 2));
    if (game.tutorialPhase === 2 && player.x > 23) showTutorial((game.tutorialPhase = 3));
    if (game.tutorialPhase === 3 && game.kills > 0) {
      showTutorial((game.tutorialPhase = 4));
      game.tutorialHide = 5.2;
    }
  }
  if (game.tutorialHide > 0) {
    game.tutorialHide -= dt;
    if (game.tutorialHide <= 0) ui.tutorial.classList.add('hidden');
  }
}

// Toasts queue briefly so a kill, a rank-up and a pickup in the same second are all readable.
// Minor notices (grip locked, out of range) never queue and never cover a major one.
const toastQ = [];
let activeToastTimer = 0;
let toastMinor = false;
let checkpointTimer = 0;
function setToast(text, minor) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  activeToastTimer = TOAST_TIME;
  toastMinor = minor;
}
function showToast(text, minor = false) {
  const showing = activeToastTimer > 0;
  if (showing && ui.toast.textContent === text) {
    activeToastTimer = TOAST_TIME;
    return;
  }
  if (minor) {
    if (!showing || toastMinor) setToast(text, true);
    return;
  }
  if (showing && !toastMinor && activeToastTimer > TOAST_TIME - 0.9) {
    if (toastQ.length < 4 && !toastQ.includes(text)) toastQ.push(text);
    return;
  }
  setToast(text, false);
}
function tickToast(dt) {
  if (activeToastTimer <= 0) return;
  activeToastTimer -= dt;
  if (toastQ.length && activeToastTimer < TOAST_TIME - 0.9) setToast(toastQ.shift(), false);
  else if (activeToastTimer <= 0) ui.toast.classList.remove('show');
}
function showCheckpoint() {
  ui.checkpoint.classList.add('show');
  checkpointTimer = 2.2;
  sfx('checkpoint');
  input.rumble(0.3, 90);
}

// ---------------------------------------------------------------- visuals
function updateAmbience(dt) {
  if (L.def.theme === 'storm') {
    game.lightning -= dt;
    if (game.lightning <= 0) {
      game.lightning = 7 + Math.random() * 9;
      game.flash = 1;
      game.thunder = 0.35 + Math.random() * 0.9;
    }
    if (game.thunder > 0) {
      game.thunder -= dt;
      if (game.thunder <= 0) sfx('thunder');
    }
  } else if (game.state === 'play') {
    game.chirp -= dt;
    if (game.chirp <= 0) {
      game.chirp = 2.5 + Math.random() * 5;
      sfx('chirp');
    }
  }
}

function updateVisuals(dt, live) {
  tickToast(dt);
  if (checkpointTimer > 0) {
    checkpointTimer -= dt;
    if (checkpointTimer <= 0) ui.checkpoint.classList.remove('show');
  }
  if (live) game.anim += dt;
  const pm = player.mesh;
  pm.position.set(player.x, player.y, 0);
  pm.scale.x = player.facing;
  pm.rotation.z = clamp(-player.vx * 0.018, -0.18, 0.18);
  const phase = game.anim * 12 * Math.min(1, Math.abs(player.vx) / 2);
  const legs = pm.userData.legs;
  legs[0].rotation.z = Math.sin(phase) * 0.35;
  legs[1].rotation.z = -Math.sin(phase) * 0.35;
  pm.visible = !(player.invuln > 0 && Math.floor(player.invuln * 14) % 2 === 0);
  pm.userData.flash.visible = player.muzzle > 0;

  for (const a of L.anchors) {
    a.ring.material = a.active ? M.ringActive : M.ring;
    a.ring.scale.setScalar(a.active ? 1.18 : 1);
  }
  for (const e of L.enemies) {
    if (e.dead) continue;
    e.mesh.position.set(e.x, e.y, 0);
    const pop = e.hitT * 1.6;
    e.mesh.scale.set(e.dir * (1 + pop), 1 + pop * 0.5, 1 + pop);
    if (e.kind === 'drone' && live) e.mesh.userData.rotor.rotation.y += dt * 26;
  }
  if (player.grapple) {
    const a = L.anchors[player.grapple.id];
    const from = tempV.set(player.x, player.y + 1.05, 0.06);
    const to = tempV2.set(a.x, a.y, 0.06);
    tempMid.addVectors(from, to).multiplyScalar(0.5);
    tempDir.subVectors(to, from);
    const len = tempDir.length();
    ropeMesh.visible = true;
    ropeMesh.position.copy(tempMid);
    ropeMesh.scale.set(1, len, 1);
    ropeMesh.quaternion.setFromUnitVectors(UP, tempDir.normalize());
  } else ropeMesh.visible = false;

  const target = game.state === 'play' && !player.grapple ? findAnchor() : null;
  marker.visible = !!target;
  if (target) {
    marker.position.set(target.x, target.y, 0.12);
    marker.scale.setScalar(1 + Math.sin(game.clock * 7) * 0.08);
  }

  const beacon = L.spire.beacon;
  beacon.rotation.y += dt * 1.8;
  beacon.rotation.x += dt * 0.55;
  if (live) updateSparks(dt);

  if (game.flash > 0 && live) {
    game.flash = Math.max(0, game.flash - dt * 3.2);
    const f = game.flash > 0.55 ? game.flash : game.flash * (0.6 + 0.4 * Math.sin(game.clock * 60));
    hemi.intensity = THEMES[L.def.theme].hemi[2] + f * 3.2;
    scene.background.copy(skyBase).lerp(skyFlash, f * 0.45);
  }
  if (rain.mesh.visible) rainCam.value.set(camera.position.x, camera.position.y - 2);
}

function updateCamera(dt) {
  const targetX = clamp(player.x + player.facing * 1.8, 6, L.def.camMaxX);
  const targetY = clamp(player.y + 4.2, 4.3, 12.5);
  const k = 1 - Math.exp(-dt * 4.2);
  game.cameraX += (targetX - game.cameraX) * k;
  game.cameraY += (targetY - game.cameraY) * k;
  game.shake = Math.max(0, game.shake - dt);
  const shake = game.shake ? Math.sin(game.clock * 80) * game.shake : 0;
  camera.position.set(game.cameraX + shake, game.cameraY + shake * 0.35, game.zoom * aspectZoom);
  camera.lookAt(game.cameraX + 1.2, game.cameraY - 1.1, 0);
  placeSun(game.cameraX);
}

const hudCache = { hp: -1, xp: -1, rank: -1, gear: '', sec: -1 };
function updateHUD() {
  const hpKey = player.hp * 100 + player.maxHp;
  if (hudCache.hp !== hpKey) {
    hudCache.hp = hpKey;
    ui.health.textContent = '';
    for (let i = 0; i < player.maxHp; i++) {
      const pip = document.createElement('i');
      pip.className = `pip${i >= player.hp ? ' off' : ''}`;
      ui.health.appendChild(pip);
    }
  }
  const next = player.rank === 1 ? BALANCE.rank2XP : BALANCE.rank3XP;
  const prev = player.rank === 1 ? 0 : player.rank === 2 ? BALANCE.rank2XP : BALANCE.rank3XP;
  const xpKey = player.xp * 10 + player.rank;
  if (hudCache.xp !== xpKey) {
    hudCache.xp = xpKey;
    const pct = player.rank >= 3 ? 100 : clamp(((player.xp - prev) / (next - prev)) * 100, 0, 100);
    ui.xpFill.style.width = `${pct}%`;
    ui.xpLabel.textContent = player.rank >= 3 ? `${player.xp} / MAX` : `${player.xp} / ${next}`;
  }
  if (hudCache.rank !== player.rank) {
    hudCache.rank = player.rank;
    ui.rank.textContent = player.rank;
  }
  const gearText = (player.gear.has('grip') ? 'GRIP-2' : 'GRIP-1') + (player.gear.has('reel') ? ' • REEL-2' : '') + (player.gear.has('pulse') ? ' • PULSE' : '');
  if (hudCache.gear !== gearText) {
    hudCache.gear = gearText;
    ui.gear.textContent = gearText;
  }
  const sec = Math.floor(game.elapsed);
  if (hudCache.sec !== sec) {
    hudCache.sec = sec;
    ui.timer.textContent = formatTime(game.elapsed);
  }
}

function anchorAtScreen(px, py, radius) {
  let best = null;
  let bestD = radius;
  const { width, height } = kit.size;
  for (const a of L.anchors) {
    tempV.set(a.x, a.y, 0).project(camera);
    const sx = (tempV.x * 0.5 + 0.5) * width;
    const sy = (-tempV.y * 0.5 + 0.5) * height;
    const d = Math.hypot(sx - px, sy - py);
    if (d < bestD) {
      bestD = d;
      best = a.id;
    }
  }
  return best;
}

// ---------------------------------------------------------------- start
// L is still null here, so setMission always hides the other mission and applies the theme.
setMission(store.mission);
resetRun();
updateCamera(0);
const post = createPost(kit, scene, camera, { bloom: { strength: isCoarse ? 0.22 : 0.3, radius: 0.18, threshold: 0.78 } });

// Compile every pipeline both missions use before the first frame: show everything, turn
// off frustum culling for the pass (compileAsync skips what the camera cannot see), then
// restore. Bullets of both sides also draw off-screen for a few frames, which warms their
// shadow pipelines before the first shot.
kit.loading.progress(0.85, 'Compiling shaders…');
const warm = [createBullet(false), createBullet(true)];
for (const m of warm) {
  m.position.set(0, -500, 0);
  m.frustumCulled = false;
}
{
  const restoreCull = [];
  scene.traverse((o) => {
    if ((o.isMesh || o.isInstancedMesh) && o.frustumCulled) {
      restoreCull.push(o);
      o.frustumCulled = false;
    }
  });
  const shown = [ropeMesh, marker, sparkMesh, rain.mesh, player.mesh.userData.flash, ...levels.map((lv) => lv.group)];
  const was = shown.map((o) => o.visible);
  for (const o of shown) o.visible = true;
  // The lit ring and the green checkpoint lamp only appear mid-run: borrow a mesh for each.
  const ring0 = levels[0].anchors[0].ring;
  const lamp0 = levels[0].lamps[0];
  ring0.material = M.ringActive;
  if (lamp0) lamp0.material = M.lampOn;
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    /* compiling ahead is only an optimisation */
  }
  ring0.material = M.ring;
  if (lamp0) lamp0.material = M.lampOff;
  shown.forEach((o, i) => (o.visible = was[i]));
  for (const o of restoreCull) o.frustumCulled = true;
}
let warmFrames = 3;

refreshStartCard();
refreshPrompts();
showModal(ui.start);

kit.start((rawDt, t) => {
  const dt = Math.min(0.033, Math.max(0.001, rawDt));
  game.clock = t;
  if (warmFrames > 0 && --warmFrames === 0) {
    for (const m of warm) {
      m.frustumCulled = true;
      releaseBullet({ mesh: m });
    }
  }

  const zoom = input.zoom() * 0.15 + input.value('zoom') * dt * 1.6;
  if (zoom) game.zoom = clamp(game.zoom * Math.exp(-zoom), ZOOM_MIN, ZOOM_MAX);

  if (game.state === 'play') {
    if (input.pressed('pause')) openPause();
    else update(dt);
  } else {
    if (modal) menuNav(dt);
    const live = game.state !== 'pause';
    if (live) {
      animateAnchors(dt);
      updateAmbience(dt);
    }
    updateVisuals(dt, live);
    updateCamera(dt);
  }
  post.render();
});
