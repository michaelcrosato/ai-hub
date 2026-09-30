/**
 * The Fall Protocol — a first-person gravity heist in a turning hotel.
 * Original game code and procedural art (MIT, see index.html).
 *
 * Runs on the shared 3D stack: three.js r186 (WebGPURenderer with the WebGL2
 * fallback) through kit/boot.js, and every input goes through kit.input
 * actions (keyboard and mouse, gamepad, touch). Physics stays hand-written:
 * sphere bodies against axis-aligned boxes in a gravity field that turns with
 * the van on the dream level above.
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createAudio } from './audio.js';
import { primaryOf, neighbour, adjust, press, markFocus, createRepeater } from './nav.js';

/* ================================================================ helpers */

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ZAXIS = V(0, 0, 1);
const YAXIS = V(0, 1, 0);
const XAXIS = V(1, 0, 0);

/** Write DOM text and styles only when they change (the HUD refreshes ~11 times a second). */
const setText = (node, text) => {
  if (node && node.__text !== text) {
    node.__text = text;
    node.textContent = text;
  }
};
const setStyle = (node, prop, value) => {
  const key = `__style_${prop}`;
  if (node && node[key] !== value) {
    node[key] = value;
    node.style[prop] = value;
  }
};

const STORE = 'fall-protocol-save-v1';
const SETTINGS = 'fall-protocol-settings-v1';
const RECORD = 'fall-protocol-record-v1';
const storage = {
  get(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch {
      return false;
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* private mode */
    }
  },
};

const DIFFICULTIES = ['story', 'operative', 'expert'];
const DIFF_LABEL = { story: 'STORY', operative: 'OPERATIVE', expert: 'EXPERT' };
const options = Object.assign({ volume: 0.45, fov: 76, reduceMotion: false, timingAssist: false, difficulty: 'operative' }, storage.get(SETTINGS) || {});
options.volume = clamp(Number(options.volume) || 0, 0, 1);
options.fov = clamp(Number(options.fov) || 76, 60, 95);
options.reduceMotion = !!options.reduceMotion;
options.timingAssist = !!options.timingAssist;
if (!DIFFICULTIES.includes(options.difficulty)) options.difficulty = 'operative';
// Look speed and graphics quality now live in the kit's shared settings panel.
delete options.sensitivity;
delete options.quality;
const saveOptions = () => storage.set(SETTINGS, options);

let seed = 528;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

/* ================================================================ input */

// Standard bindings (lib/kit/README.md §4). Strike is this game's main verb, so it gets the big touch button.
const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
  strike: { keys: ['KeyF', 'KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Hit' },
  brace: { keys: ['KeyR', 'KeyK'], mouse: [2], gamepad: ['LT', 'B'], touch: 'Brace' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  shove: { keys: ['KeyQ'], gamepad: ['RB'], touch: 'Shove' },
  interact: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Use' },
  // Zero gravity only: the touch button is hidden while the hotel still has a floor.
  lower: { keys: ['ControlLeft', 'ControlRight', 'KeyC'], gamepad: ['LB'], touch: 'Down' },
  run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  plan: { keys: ['Tab', 'KeyM'], gamepad: ['Back'], touch: { label: 'Plan', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};

/** Button prompts for the device in hand (kit.input.source). */
const GLYPHS = {
  keyboard: { move: 'W A S D', look: 'MOUSE', run: 'SHIFT', jump: 'SPACE', rise: 'SPACE', lower: 'CTRL', strike: 'F / LMB', brace: 'RMB / R', shove: 'Q', interact: 'E', plan: 'TAB', pause: 'ESC / P', confirm: 'SPACE' },
  gamepad: { move: 'L STICK', look: 'R STICK', run: 'L3', jump: 'A', rise: 'A', lower: 'LB', strike: 'RT / X', brace: 'LT / B', shove: 'RB', interact: 'Y', plan: 'BACK', pause: 'START', confirm: 'A' },
  touch: { move: 'LEFT THUMB', look: 'DRAG', run: 'PUSH THE STICK FULLY', jump: 'JUMP', rise: 'UP', lower: 'DOWN', strike: 'HIT', brace: 'BRACE', shove: 'SHOVE', interact: 'USE', plan: 'PLAN', pause: 'II', confirm: 'TAP' },
};

/* ================================================================ boot */

const kit = await boot({
  title: 'The Fall Protocol',
  gear: 'none', // the masthead and the pause menu open the kit's settings panel (F9 too)
  accent: '#e9b88c',
  background: '#10201e',
  touch: { top: 'left', topOffset: 58 },
  input: ACTIONS,
});
const { input, renderer } = kit;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.canvas.setAttribute('aria-label', 'First-person game view');

const audio = createAudio({ volume: options.volume });

const g = (name) => (GLYPHS[input.source] || GLYPHS.keyboard)[name] || name.toUpperCase();
const virtual = new Set(); // test API: actions held by a script
let virtualMove = null;
const actDown = (name) => input.down(name) || virtual.has(name);
const pressed = (name) => input.pressed(name);
/** Mouse look was tuned at 0.0025 rad/px × 0.65; the kit's 1× look speed is 0.0024 rad/px. */
const LOOK_SCALE = 0.68;

/* ================================================================ state */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2421);
scene.fog = new THREE.FogExp2(0x233229, 0.019);
const world = new THREE.Group();
scene.add(world);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(options.fov, 1, 0.045, 110));
scene.add(camera);

let hands, handL, handR, playerLamp, guideLine;
let mode = 'title';
let session;
let checkpointData = null;
let clockTime = 0;
let uiTick = 0;
let pauseReturn = 'playing';
let manualReturn = 'title';
let menuGuard = 0;
let gravityAngle = 0, viewRoll = 0, gravityStrength = 1, lastWarning = -1, activeEvent = null;
let trauma = 0, damageOpacity = 0, hitOpacity = 0, attackAnim = 0, shoveAnim = 0, braceAge = 99, attackCooldown = 0, stepDistance = 0;
let subtitleTime = 0, toastTime = 0, centerTime = 0, interactProgress = 0, interactTarget = null, sync = null;
let useLatch = false, sprintToggle = false, jumpBuffer = 0;
let suiteDoor, liftLeft, liftRight, suiteBlock, liftBlock, liftOpen = 0, suiteOpen = 0, unitVisual, brakeVisual, kitVisual, testWeight;
const colliders = [];
const debris = [];
const enemies = [];
const crew = [];
const notes = [];
const radioLog = [];
const breadcrumbs = [];
const materials = new Map();
const staticMeshes = [];
const geoBox = new THREE.BoxGeometry(1, 1, 1);
const player = { p: V(0, 0.78, 7.5), v: V(), r: 0.76, grounded: false, health: 100, stamina: 100, yaw: 0, pitch: 0, impactCooldown: 0 };

// Scratch objects, so the per-frame code allocates nothing.
const gravityUp = V(0, 1, 0);
const _fwd = V(), _right = V(), _wish = V(), _tan = V(), _d = V(), _q = V(), _n = V();
const _lcDir = V(), _lcHit = V(), _strikeDir = V(), _prior = V(), _desired = V(), _pull = V();
const _aim = V(), _toTarget = V(), _from = V(), _anchor = V();
const _ray = new THREE.Ray();
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _dummy = new THREE.Object3D();

const vanEvents = [
  { duration: 10, label: 'IN PURSUIT', detail: 'ROAD CONTACT', angle: 0, warning: 'HARD LEFT AHEAD', quote: 'Turn coming. Hold on.' },
  { duration: 9, label: 'HARD LEFT', detail: 'LATERAL FORCE', angle: -Math.PI / 2, warning: 'ROLLOVER AHEAD', quote: 'We are rolling. Get a grip.' },
  { duration: 10, label: 'VAN ROLLING', detail: 'INVERTED', angle: -Math.PI, warning: 'ROAD CONTACT AHEAD', quote: 'Coming back onto the wheels.' },
  { duration: 10, label: 'BACK ON WHEELS', detail: 'ROAD CONTACT', angle: 0, warning: 'HARD RIGHT AHEAD', quote: 'Hard right. Brace now.' },
  { duration: 9, label: 'HARD RIGHT', detail: 'LATERAL FORCE', angle: Math.PI / 2, warning: 'BARRIER AHEAD', quote: 'There is a barrier. Hold tight.' },
  { duration: 10, label: 'HIT THE BARRIER', detail: 'ROAD CONTACT', angle: 0, warning: 'HARD LEFT AHEAD', quote: 'They are still behind us. Turning again.' },
];
const difficulty = {
  story: { damage: 0.4, enemySpeed: 1.7, telegraph: 1.0, hp: 72, window: 0.23 },
  operative: { damage: 0.7, enemySpeed: 2.1, telegraph: 0.83, hp: 90, window: 0.16 },
  expert: { damage: 1.05, enemySpeed: 2.65, telegraph: 0.63, hp: 112, window: 0.115 },
};

/** The zero-gravity ambush: hotel security arrives once the team is on the line. */
const SECURITY_COUNT = 2;
const SUITE_DOOR_HALL = V(3.1, 1.9, -24);
const SUITE_DOOR_ROOM = V(5.3, 1.9, -24);

/** Memory fragments: the first two are the original pair, three more hide along the route. */
const NOTE_LINES = [
  'A dream can change the room. It cannot change the mission.',
  'The kick must reach each level at the same moment.',
  'Count the doors. A real hallway never repeats itself this neatly.',
  'Luggage packs the past. Leave behind what you cannot carry.',
  'When the fall stops, build a new one. Force is only ever borrowed.',
];

const BADGES = ['SAFE PASSAGE', 'ADAPTED TO GRAVITY', 'PERFECT BLOCK', 'PERFECT SYNC', 'CLEAR MEMORY', 'UNTOUCHABLE', 'LINE HELD'];

/**
 * Endurance, a side operation from the title screen: the hall fight with no end. Stopped
 * projections re-form after a moment at a spawn point away from Arthur, and every third
 * one stopped starts a harder wave (faster, tougher, shorter warnings). Longest time held
 * is kept per difficulty.
 */
const ENDURANCE_SPAWNS = [V(-0.7, 0.85, -5.5), V(1.3, 0.85, -16.5), V(-0.7, 0.85, -27.5), V(0.9, 0.85, -37.5), V(-0.9, 0.85, 3.5)];
const enduranceDiff = { damage: 0, enemySpeed: 0, telegraph: 0, hp: 0, window: 0 };
let enduranceKey = '', enduranceWave = -1; // the difficulty and wave enduranceDiff was built for
let lastRun = 'story'; // what "play again" on the results screen starts

/** The fight numbers in force: the difficulty's own, scaled up by the wave in endurance. */
function combatDiff() {
  const base = difficulty[session.difficulty] || difficulty.operative;
  if (!session.endurance) return base;
  if (enduranceKey !== session.difficulty || enduranceWave !== session.wave) {
    enduranceKey = session.difficulty;
    enduranceWave = session.wave;
    const w = Math.max(0, session.wave - 1);
    enduranceDiff.damage = base.damage * Math.min(1.6, 1 + 0.06 * w);
    enduranceDiff.enemySpeed = base.enemySpeed * Math.min(1.45, 1 + 0.07 * w);
    enduranceDiff.telegraph = base.telegraph * Math.max(0.62, 1 - 0.05 * w);
    enduranceDiff.hp = Math.round(base.hp * Math.min(1.8, 1 + 0.1 * w));
    enduranceDiff.window = base.window;
  }
  return enduranceDiff;
}

/* ================================================================ HUD elements */

const el = {
  hud: $('hud'),
  masthead: $('masthead'),
  chapter: $('chapter-label'),
  objective: $('objective'),
  sub: $('sub-objective'),
  progress: [...document.querySelectorAll('#objective-progress i')],
  healthValue: $('health-value'),
  healthBar: $('health-bar'),
  staminaBar: $('stamina-bar'),
  movement: $('movement-mode'),
  teamCounter: $('team-counter'),
  pips: [...document.querySelectorAll('.team-pips>div')],
  equipment: $('equipment-state'),
  vanEvent: $('van-event'),
  vanMode: $('van-mode'),
  gravityValue: $('gravity-value'),
  gravityArrow: $('gravity-arrow'),
  vanHud: $('van-hud'),
  vanWarning: $('van-warning'),
  vanView: $('van-view'),
  interaction: $('interaction'),
  interactionKey: $('interaction-key'),
  interactionTitle: $('interaction-title'),
  interactionDetail: $('interaction-detail'),
  interactionFill: document.querySelector('#interaction-track i'),
  crosshair: $('crosshair'),
  targetMarker: $('target-marker'),
  enemyTag: $('enemy-tag'),
  subtitle: $('subtitle'),
  toast: $('toast'),
  center: $('center-message'),
  damageFlash: $('damage-flash'),
  hitMarker: $('hit-marker'),
  whiteout: $('whiteout'),
  controlStrip: $('control-strip'),
  syncScreen: $('sync-screen'),
};
const vanCtx = el.vanView.getContext('2d');

/* ================================================================ lights */

// The game was written for three.js r140's legacy light units: ambient, hemisphere and
// directional intensities gain a factor of π in r186. r140 point and spot lights faded as
// (1 − d/range)^decay; r186 uses an inverse-power falloff, so each light gets the decay and
// gain that match the old curve over the 2–8 m the hotel lights actually reach.
const LEGACY = Math.PI;
function hotelLight(color, intensity, range, decay, gain) {
  return new THREE.PointLight(color, intensity * LEGACY * gain, range, decay);
}

scene.add(new THREE.HemisphereLight(0xdce2b7, 0x524536, 0.46 * LEGACY));
scene.add(new THREE.AmbientLight(0xc8c6a0, 0.13 * LEGACY));
{
  const fill = new THREE.DirectionalLight(0xc5dac1, 0.32 * LEGACY);
  fill.position.set(-3, 4, 8);
  scene.add(fill);
  const warm = new THREE.DirectionalLight(0xe6ba8c, 0.28 * LEGACY);
  warm.position.set(4, 3, -20);
  scene.add(warm);
}
// The lamp Arthur carries: legacy (1 − d/19)^1 matches decay 0.5 at 1.6× over 3–8 m.
playerLamp = new THREE.SpotLight(0xffdfab, 0.5 * LEGACY * 1.6, 19, 0.95, 0.75, 0.5);
playerLamp.position.set(0, 3, 6);
playerLamp.target.position.set(0, 0, -5);
playerLamp.castShadow = true;
kit.shadow(playerLamp, 1024);
playerLamp.shadow.bias = -0.0002;
playerLamp.shadow.normalBias = 0.03;
playerLamp.shadow.radius = 2;
scene.add(playerLamp, playerLamp.target);

/* ================================================================ builders */

function mat(color, roughness = 0.84, metalness = 0, emissive = 0) {
  const key = `${color}|${roughness}|${metalness}|${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity: emissive ? 1 : 0, flatShading: true });
    materials.set(key, m);
  }
  return m;
}
function mesh(geometry, material, x = 0, y = 0, z = 0, parent = world, staticFlag = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  if (parent === world && staticFlag) staticMeshes.push(m);
  return m;
}
function box(w, h, d, x, y, z, material, parent = world, solid = false) {
  const m = mesh(geoBox, material, x, y, z, parent);
  m.scale.set(w, h, d);
  if (solid) addCollider(x, y, z, w, h, d);
  return m;
}
function cyl(rt, rb, h, n, x, y, z, material, parent = world) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, n), material, x, y, z, parent);
}
function addCollider(x, y, z, w, h, d) {
  const min = V(x - w / 2, y - h / 2, z - d / 2);
  const max = V(x + w / 2, y + h / 2, z + d / 2);
  // The Box3 shares min/max, so sight-line tests need no per-call allocation.
  const c = { min, max, box: new THREE.Box3(min, max), enabled: true };
  colliders.push(c);
  return c;
}
function label(text, w, h, x, y, z, rot = 0, color = '#dfc79c', bg = '#203b34', size = 40, parent = world) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.round((512 * h) / w);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px Arial`;
  text.split('\n').forEach((line, i, lines) => ctx.fillText(line, 256, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.4));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const m = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }), x, y, z, parent);
  m.rotation.y = rot;
  return m;
}

/** Bake a list of meshes into one non-indexed geometry, each through matrixOf(mesh). */
const _bakeP = V(), _bakeN = V(), _bakeNM = new THREE.Matrix3();
function bakeGeometry(list, matrixOf) {
  let total = 0;
  for (const m of list) total += m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const m of list) {
    const geo = m.geometry;
    const pa = geo.attributes.position;
    const na = geo.attributes.normal;
    const ua = geo.attributes.uv;
    const ix = geo.index;
    const matrix = matrixOf(m);
    _bakeNM.getNormalMatrix(matrix);
    const count = ix ? ix.count : pa.count;
    for (let i = 0; i < count; i++) {
      const j = ix ? ix.getX(i) : i;
      _bakeP.fromBufferAttribute(pa, j).applyMatrix4(matrix);
      _bakeN.fromBufferAttribute(na, j).applyMatrix3(_bakeNM).normalize();
      pos[o * 3] = _bakeP.x;
      pos[o * 3 + 1] = _bakeP.y;
      pos[o * 3 + 2] = _bakeP.z;
      nor[o * 3] = _bakeN.x;
      nor[o * 3 + 1] = _bakeN.y;
      nor[o * 3 + 2] = _bakeN.z;
      if (ua) {
        uv[o * 2] = ua.getX(j);
        uv[o * 2 + 1] = ua.getY(j);
      }
      o++;
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}
const disposeUnshared = (m) => {
  if (m.geometry !== geoBox) m.geometry.dispose();
};

/** Merge the whole static hotel into one mesh per material. */
function mergeStatics() {
  world.updateMatrixWorld(true);
  const buckets = new Map();
  for (const m of staticMeshes) {
    let list = buckets.get(m.material);
    if (!list) buckets.set(m.material, (list = []));
    list.push(m);
  }
  for (const [material, list] of buckets) {
    const combined = new THREE.Mesh(bakeGeometry(list, (m) => m.matrixWorld), material);
    combined.castShadow = true;
    combined.receiveShadow = true;
    for (const m of list) {
      world.remove(m);
      disposeUnshared(m);
    }
    world.add(combined);
  }
  staticMeshes.length = 0;
}

/**
 * Merge the rigid parts of a moving group (a figure's head, a hand, a suitcase) that share
 * a material, recursively. Sub-groups stay separate, so limbs still animate.
 */
function mergeChildren(group) {
  const buckets = new Map();
  for (const child of group.children) {
    if (!child.isMesh || child.isInstancedMesh || child.userData.keep) continue;
    let list = buckets.get(child.material);
    if (!list) buckets.set(child.material, (list = []));
    list.push(child);
  }
  for (const [material, list] of buckets) {
    if (list.length < 2) continue;
    for (const m of list) m.updateMatrix();
    const merged = new THREE.Mesh(bakeGeometry(list, (m) => m.matrix), material);
    merged.castShadow = true;
    merged.receiveShadow = true;
    for (const m of list) {
      group.remove(m);
      disposeUnshared(m);
    }
    group.add(merged);
  }
  for (const child of group.children) if (child.isGroup) mergeChildren(child);
}

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#793e31';
  x.fillRect(0, 0, 256, 256);
  for (let yy = -64; yy < 320; yy += 64) {
    for (let xx = -64; xx < 320; xx += 64) {
      x.strokeStyle = '#b78a5c';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(xx, yy - 28);
      x.lineTo(xx + 28, yy);
      x.lineTo(xx, yy + 28);
      x.lineTo(xx - 28, yy);
      x.closePath();
      x.stroke();
      x.fillStyle = '#402e27';
      x.fillRect(xx - 4, yy - 4, 8, 8);
      x.strokeStyle = '#8b5841';
      x.strokeRect(xx - 15, yy - 15, 30, 30);
    }
  }
  for (let i = 0; i < 10000; i++) {
    x.fillStyle = `rgba(30,16,10,${random() * 0.07})`;
    x.fillRect(random() * 256, random() * 256, 1, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 28);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ================================================================ the hotel */

function buildHotel() {
  const cream = mat(0xc4b69a), plaster = mat(0xd4c6a6), dark = mat(0x183b35), trim = mat(0x26473d), gold = mat(0xb68b4d, 0.4, 0.55), wood = mat(0x594234), tile = mat(0xa59c84), black = mat(0x111c1c), warm = mat(0xe9c58b, 0.65, 0, 0xa57032);
  box(8, 0.36, 56, 0, -0.18, -16, tile, world, true);
  box(8, 0.35, 56, 0, 4.98, -16, plaster, world, true);
  box(0.34, 5.15, 56, -4.17, 2.4, -16, cream, world, true);
  box(0.34, 5.15, 34.2, 4.17, 2.4, -5.1, cream, world, true);
  box(0.34, 5.15, 18.2, 4.17, 2.4, -34.9, cream, world, true);
  box(0.35, 1.22, 3.6, 4.17, 4.25, -24, cream, world, true);
  box(8, 5.2, 0.3, 0, 2.4, 12.12, dark, world, true);
  const carpetMat = new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 1 });
  box(4.65, 0.034, 56, 0, 0.019, -16, carpetMat);
  [-1, 1].forEach((side) => {
    box(0.07, 0.05, 56, side * 2.39, 0.038, -16, gold);
    box(0.13, 0.035, 56, side * 2.54, 0.02, -16, wood);
    for (let z = 10; z > -44; z -= 2) box(1.31, 0.025, 0.016, side * 3.3, 0.018, z, wood);
    for (let z = 10; z > -44; z -= 4) {
      if (side === 1 && z === -22) continue;
      box(0.09, 1.17, 3.87, side * 3.985, 0.61, z - 1, trim);
      box(0.16, 0.07, 3.98, side * 3.94, 1.24, z - 1, gold);
      box(0.17, 0.12, 3.98, side * 3.94, 0.08, z - 1, wood);
      box(0.055, 0.055, 3.8, side * 3.9, 0.31, z - 1, gold);
      for (let zz = z - 2.8; zz < z + 1; zz += 0.98) box(0.065, 0.78, 0.045, side * 3.91, 0.75, zz, gold);
      box(0.13, 3.45, 0.1, side * 3.94, 2.95, z - 3, wood);
      box(0.2, 0.18, 4, side * 3.89, 4.54, z - 1, trim);
      box(0.13, 0.045, 4, side * 3.82, 4.42, z - 1, gold);
    }
  });
  for (let z = 9; z > -44; z -= 4) {
    box(8, 0.16, 0.11, 0, 4.78, z, trim);
    box(6.5, 0.035, 0.045, 0, 4.65, z - 0.12, gold);
    for (let x = -3.2; x < 3.3; x += 0.8) cyl(0.047, 0.047, 0.025, 8, x, 4.74, z + 0.23, gold);
  }
  function door(side, z, num) {
    const x = side * 3.935;
    box(0.15, 3.25, 1.74, x, 1.65, z, wood);
    box(0.07, 3.01, 1.51, x - side * 0.1, 1.61, z, dark);
    [-0.74, 0.74].forEach((dz) => box(0.11, 3.31, 0.06, x - side * 0.13, 1.65, z + dz, gold));
    box(0.11, 0.07, 1.55, x - side * 0.13, 3.28, z, gold);
    [0.82, 2.08].forEach((y) => {
      box(0.045, 0.91, 1.18, x - side * 0.16, y, z, trim);
      box(0.05, 0.027, 1.17, x - side * 0.19, y - 0.43, z, gold);
    });
    const knob = cyl(0.048, 0.048, 0.16, 8, x - side * 0.23, 1.28, z - 0.46, gold);
    knob.rotation.z = Math.PI / 2;
    label(num, 0.41, 0.2, x - side * 0.14, 2.8, z, side === 1 ? -Math.PI / 2 : Math.PI / 2, '#dec594', '#193d34', 87);
  }
  [5, -3, -11, -19, -27, -35].forEach((z, i) => {
    door(-1, z, String(521 + i * 2));
    if (z !== -27 && z !== -19) door(1, z, String(522 + i * 2));
  });
  function lamp(side, z) {
    const x = side * 3.72;
    box(0.12, 0.58, 0.23, x, 2.67, z, gold);
    box(0.4, 0.045, 0.045, x - side * 0.14, 2.43, z, gold);
    cyl(0.19, 0.26, 0.4, 6, x - side * 0.3, 2.77, z, warm);
    cyl(0.12, 0.12, 0.05, 8, x - side * 0.3, 3, z, gold);
    // Legacy decay 1.7 over 10 m ≈ decay 0.9 at 1.4× in r186 units.
    const light = hotelLight(0xffcc8a, 0.84, 10, 0.9, 1.4);
    light.position.set(x - side * 0.55, 2.87, z);
    world.add(light);
  }
  [1, -7, -15, -31, -39].forEach((z) => {
    lamp(1, z);
    lamp(-1, z);
  });
  lamp(-1, -23);
  // Suite entrance: a real opening, not a teleport.
  box(0.18, 3.65, 0.15, 3.88, 1.84, -22.12, gold);
  box(0.18, 3.65, 0.15, 3.88, 1.84, -25.88, gold);
  box(0.18, 0.16, 3.9, 3.88, 3.62, -24, gold);
  label('528', 0.67, 0.35, 3.81, 3.96, -24, -Math.PI / 2, '#dcd7b8', '#283d33', 125);
  suiteDoor = new THREE.Group();
  world.add(suiteDoor);
  box(0.22, 3.5, 3.6, 4.01, 1.75, -24, dark, suiteDoor);
  box(0.05, 2.95, 3.04, 3.87, 1.78, -24, trim, suiteDoor);
  label('PRIVATE SUITE', 1.8, 0.23, 3.81, 2.4, -24, -Math.PI / 2, '#dcd7b8', '#26473d', 49, suiteDoor);
  suiteBlock = addCollider(4.01, 1.75, -24, 0.3, 3.5, 3.6);
  // The sleeping room.
  box(10, 0.34, 15, 9, -0.17, -25.5, wood, world, true);
  box(10, 0.3, 15, 9, 4.98, -25.5, plaster, world, true);
  box(0.3, 5.1, 15, 14.14, 2.45, -25.5, dark, world, true);
  box(10, 5.1, 0.3, 9, 2.45, -17.86, cream, world, true);
  box(10, 5.1, 0.3, 9, 2.45, -33.14, cream, world, true);
  box(8.6, 0.045, 11, 9, 0.025, -26, mat(0x5c7560));
  for (let x = 5; x < 14; x += 1) box(0.028, 0.03, 15, x, 0.025, -25.5, mat(0x806448));
  for (let z = -20; z > -33; z -= 4) {
    box(0.04, 3.0, 2.6, 13.96, 2.8, z, mat(0x567d78, 0.5, 0.3));
    box(0.05, 0.055, 2.7, 13.92, 1.3, z, gold);
    box(0.05, 0.055, 2.7, 13.92, 4.3, z, gold);
    box(0.07, 3.2, 0.06, 13.89, 2.8, z, gold);
    box(0.08, 0.06, 2.7, 13.88, 2.8, z, gold);
  }
  label('THE MERIDIAN', 3.6, 0.75, 9, 3.7, -32.94, 0, '#c4aa79', '#c4b69a', 49);
  label('S U I T E   5 2 8', 2.0, 0.25, 9, 3.1, -32.92, 0, '#596851', '#c4b69a', 45);
  const beds = [[7, -22.3], [11, -22.3], [7, -28.8], [11, -28.8]];
  beds.forEach(([x, z], i) => {
    box(2.0, 0.42, 3.35, x, 0.28, z, wood);
    box(1.95, 0.2, 3.15, x, 0.6, z, mat(0xc7c9ad));
    box(1.86, 0.1, 2.1, x, 0.75, z + 0.42, mat(i % 2 ? 0x50695a : 0x7c5d46));
    box(1.9, 1.0, 0.18, x, 0.86, z - 1.6, dark);
    box(1.2, 0.17, 0.57, x, 0.79, z - 1.05, mat(0xede4cb));
  });
  // Legacy decay 1.3 over 18 m ≈ decay 0.6 at 1.65×.
  const suiteLight = hotelLight(0xffdca5, 1.4, 18, 0.6, 1.65);
  suiteLight.position.set(9, 3.9, -26);
  world.add(suiteLight);
  box(4, 0.035, 1.1, 9, 4.66, -26, warm);
  // Equipment table and a small no-gravity test device.
  box(1.0, 0.08, 1.45, 5.15, 0.98, -31, wood);
  box(0.14, 0.96, 0.14, 4.79, 0.48, -30.5, gold);
  box(0.14, 0.96, 0.14, 5.5, 0.48, -31.5, gold);
  box(0.72, 0.28, 0.62, 5.15, 1.16, -31, black);
  box(0.6, 0.035, 0.43, 5.15, 1.32, -31, mat(0x7fae94, 0.6, 0, 0x294c3e));
  label('DROP TEST', 0.69, 0.18, 5.15, 1.2, -30.675, 0, '#98d1b2', '#152c27', 86);
  // The test weight rests on the plate until Arthur runs the drop test; without gravity it just drifts away.
  testWeight = createDebris('weight', V(5.15, 1.371, -31.02), gold, 0.06);
  // Service lift and its working doors.
  box(1, 4.8, 0.3, -3.5, 2.4, -42.1, dark, world, true);
  box(1, 4.8, 0.3, 3.5, 2.4, -42.1, dark, world, true);
  box(6, 1.2, 0.3, 0, 4.23, -42.1, dark, world, true);
  box(6, 0.36, 7, 0, -0.18, -45.5, black, world, true);
  box(6, 0.3, 7, 0, 4.98, -45.5, black, world, true);
  box(0.25, 5.1, 7, -3.13, 2.4, -45.5, trim, world, true);
  box(0.25, 5.1, 7, 3.13, 2.4, -45.5, trim, world, true);
  box(6, 5.1, 0.25, 0, 2.4, -49.1, trim, world, true);
  for (let x = -2.6; x < 3; x += 0.55) box(0.07, 0.022, 7, x, 0.015, -45.5, gold);
  [-1, 1].forEach((s) => {
    box(0.12, 3.8, 0.18, s * 3.01, 1.92, -41.9, gold);
    box(0.08, 0.12, 6, s * 2.94, 1.1, -45.5, gold);
    box(0.025, 2.3, 5.7, s * 2.98, 2.4, -45.5, mat(0x7e7860, 0.44, 0.65));
  });
  box(6.2, 0.11, 0.19, 0, 3.8, -41.9, gold);
  label('SERVICE  /  LIFT', 3.4, 0.38, 0, 4.28, -41.87, 0, '#d6d2b2', '#193b33', 48);
  liftLeft = new THREE.Group();
  liftRight = new THREE.Group();
  world.add(liftLeft, liftRight);
  box(2.96, 3.62, 0.14, -1.5, 1.83, -42, gold, liftLeft);
  box(2.96, 3.62, 0.14, 1.5, 1.83, -42, gold, liftRight);
  box(2.8, 3.35, 0.035, -1.5, 1.83, -41.9, mat(0x767362, 0.4, 0.65), liftLeft);
  box(2.8, 3.35, 0.035, 1.5, 1.83, -41.9, mat(0x767362, 0.4, 0.65), liftRight);
  liftBlock = addCollider(0, 1.85, -42, 6, 3.7, 0.26);
  box(0.36, 0.65, 0.11, 3.58, 1.67, -41.91, black);
  box(0.15, 0.15, 0.035, 3.58, 1.72, -41.83, warm);
  label('KICK CONTROL', 2.2, 0.38, 0, 2.71, -48.94, 0, '#b5d7bf', '#18372f', 65);
  box(1.4, 0.9, 0.2, 0, 1.96, -48.91, black);
  box(1.08, 0.48, 0.026, 0, 2.07, -48.785, mat(0x95b9a2, 0.5, 0, 0x355849));
  label('AWAITING TEAM', 1.02, 0.19, 0, 2.06, -48.765, 0, '#c0dfc9', '#274f40', 49);
  kitVisual = new THREE.Group();
  kitVisual.position.set(2.5, 1.25, -43.3);
  world.add(kitVisual);
  box(0.55, 0.52, 0.3, 0, 0, 0, mat(0xb8784f), kitVisual);
  box(0.42, 0.07, 0.04, 0, 0.18, 0.17, mat(0xe4c795), kitVisual);
  box(0.08, 0.4, 0.32, 0, 0, 0, black, kitVisual);
  label('IMPULSE', 0.48, 0.14, 0, -0.07, 0.163, 0, '#e5d6b3', '#54493a', 93, kitVisual);
  box(0.6, 0.08, 0.36, 2.5, 0.94, -43.3, gold);
  box(0.7, 0.9, 0.3, 2.74, 2.55, -46.1, black);
  unitVisual = new THREE.Group();
  unitVisual.position.set(2.7, 2.6, -46.1);
  world.add(unitVisual);
  box(0.25, 0.64, 0.43, 0, 0, 0, mat(0xc36e48), unitVisual);
  box(0.28, 0.35, 0.22, -0.15, 0, 0, mat(0x779781, 0.5, 0, 0x436147), unitVisual);
  unitVisual.visible = false;
  box(0.24, 0.64, 0.42, -2.82, 2.4, -46.2, black);
  brakeVisual = box(0.18, 0.42, 0.11, -2.62, 2.5, -46.1, gold, world);
  staticMeshes.splice(staticMeshes.indexOf(brakeVisual), 1);
  label('DRIVE', 0.8, 0.25, 2.92, 3.3, -46.1, -Math.PI / 2, '#ead4b1', '#4a5548', 95);
  label('BRAKE', 0.8, 0.25, -2.98, 3.1, -46.1, Math.PI / 2, '#ead4b1', '#4a5548', 95);
  // Legacy decay 1.5 over 11 m ≈ decay 0.8 at 1.4×.
  const liftLight = hotelLight(0xdce7bb, 1.3, 11, 0.8, 1.4);
  liftLight.position.set(0, 4.2, -45.8);
  world.add(liftLight);
  box(4.8, 0.08, 0.55, 0, 4.75, -45.7, warm);
  // Structural details make a familiar, built space.
  function artwork(side, z) {
    const x = side * 3.88;
    box(0.08, 1.75, 1.3, x, 2.62, z, gold);
    box(0.1, 1.61, 1.16, x - side * 0.03, 2.62, z, mat(0x263f37));
    box(0.11, 0.49, 0.93, x - side * 0.08, 2.11, z, mat(0x8d6d4c));
    const art = box(0.12, 0.7, 0.7, x - side * 0.085, 2.71, z, mat(0xd1b178));
    art.rotation.x = 0.45;
    box(0.13, 0.06, 0.94, x - side * 0.09, 2.51, z, mat(0x20382f));
  }
  [-7, -15, -31].forEach((z) => artwork(-1, z + 2));
  artwork(1, -9);
  function table(x, z) {
    box(0.72, 0.11, 1.25, x, 0.8, z, wood);
    [-1, 1].forEach((s) => box(0.075, 0.77, 0.075, x + s * 0.26, 0.38, z + s * 0.43, gold));
    cyl(0.17, 0.11, 0.4, 6, x, 1.06, z, mat(0xa88661));
    for (let i = 0; i < 4; i++) {
      const leaf = mesh(new THREE.ConeGeometry(0.14, 0.52, 4), mat(i % 2 ? 0x466547 : 0x657e52), x + (random() - 0.5) * 0.3, 1.46 + random() * 0.2, z + (random() - 0.5) * 0.3);
      leaf.rotation.z = (random() - 0.5) * 1.2;
    }
  }
  table(3.1, 2.6);
  table(-3.12, -9.2);
  table(3.1, -33.8);
  // A luggage cart is fixed; loose bags and papers are physical objects.
  [2.4, 3.1].forEach((x) => {
    box(0.055, 1.8, 0.06, x, 0.9, -12.0, gold);
    box(0.055, 1.8, 0.06, x, 0.9, -13.2, gold);
  });
  box(0.82, 0.08, 1.4, 2.75, 0.21, -12.6, wood);
  box(0.8, 0.05, 1.4, 2.75, 1.84, -12.6, gold);
  [-12.1, -13.1].forEach((z) => {
    const w = cyl(0.12, 0.12, 0.09, 8, 2.75, 0.12, z, black);
    w.rotation.z = Math.PI / 2;
  });
  createDebris('case', V(2.75, 0.75, -12.6), mat(0x9f7650), 0.39);
  createDebris('case', V(-2.8, 0.49, -1.5), mat(0x283a34), 0.42);
  createDebris('case', V(2.95, 0.42, -34.5), mat(0x5e4637), 0.35);
  for (let i = 0; i < 10; i++) createDebris('paper', V((random() - 0.5) * 5, 0.06, -5 - random() * 32), mat(i % 2 ? 0xc9bc98 : 0xd9d4b4), 0.1);
  // Memory fragments: the hall table and the suite (the original pair), then the first
  // table by the start, the top of the luggage cart and the table by the lift.
  const spots = [[-3.08, 0.94, -9.2], [12.7, 1.15, -31.7], [3.1, 0.92, 3.02], [2.75, 1.92, -12.95], [3.1, 0.92, -33.42]];
  spots.forEach(([x, y, z], id) => {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    world.add(group);
    box(0.23, 0.1, 0.35, 0, 0, 0, mat(0x152525), group);
    box(0.17, 0.026, 0.17, 0, 0.065, 0, mat(0xe6b978, 0.7, 0, 0x805329), group);
    notes.push({ mesh: group, found: false, p: group.position.clone(), id });
  });
  mergeStatics();
}

function createDebris(type, p, material, r) {
  const group = new THREE.Group();
  world.add(group);
  group.position.copy(p);
  if (type === 'case') {
    box(r * 1.5, r * 1.8, r * 0.9, 0, 0, 0, material, group);
    box(r * 0.64, 0.05, 0.07, 0, r * 0.97, 0, mat(0xbba175), group);
    [-1, 1].forEach((s) => box(0.04, r * 1.85, r * 0.93, s * r * 0.46, 0, 0, mat(0x3a3730), group));
    for (let i = -1; i <= 1; i++) box(0.04, r * 1.35, 0.02, i * r * 0.34, 0, r * 0.46, mat(0x695641), group);
  } else if (type === 'weight') {
    box(r * 1.5, r * 1.1, r * 1.5, 0, 0, 0, material, group);
    box(r * 0.5, r * 0.7, r * 0.5, 0, r * 0.85, 0, material, group);
    box(r * 1.56, r * 0.18, r * 1.56, 0, -r * 0.2, 0, mat(0x111c1c), group);
  } else {
    box(0.28, 0.012, 0.4, 0, 0, 0, material, group);
    box(0.18, 0.003, 0.015, 0, 0.008, 0.07, mat(0x7b826b), group);
  }
  mergeChildren(group);
  const d = { mesh: group, p: p.clone(), v: V(), r, spawn: p.clone(), spin: V(random() - 0.5, random() - 0.5, random() - 0.5), type, grounded: false, impactCooldown: 0, held: type === 'weight' };
  debris.push(d);
  return d;
}

/** A toy-like figure built from blocks. `accent` adds the armbands and badge hotel security wears. */
function createFigure(suit = 0x273833, skin = 0xc9a16d, sleeping = false, accent = 0) {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);
  const cloth = mat(suit), skinMat = mat(skin), shoe = mat(0x18231f), shirt = mat(0xd7cfb2), hair = mat(0x312d26), tie = mat(sleeping ? 0x9b7650 : 0x6d4234);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, -0.25, 0);
    root.add(leg);
    box(0.29, 0.57, 0.32, 0, -0.28, 0, cloth, leg);
    box(0.31, 0.15, 0.43, 0, -0.6, 0.044, shoe, leg);
    legs.push(leg);
  }
  const body = mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.69, 4), cloth, 0, 0.1, 0, torso, false);
  body.rotation.y = Math.PI / 4;
  body.scale.z = 0.68;
  box(0.25, 0.41, 0.022, 0, 0.21, 0.254, shirt, torso);
  box(0.065, 0.34, 0.033, 0, 0.16, 0.273, tie, torso);
  const t = box(0.18, 0.38, 0.045, -0.18, 0.19, 0.238, cloth, torso);
  t.rotation.z = -0.22;
  const t2 = box(0.18, 0.38, 0.045, 0.18, 0.19, 0.238, cloth, torso);
  t2.rotation.z = 0.22;
  box(0.05, 0.05, 0.026, 0.1, -0.06, 0.26, mat(0xba9769), torso);
  const head = new THREE.Group();
  head.position.set(0, 0.68, 0);
  torso.add(head);
  cyl(0.243, 0.243, 0.43, 10, 0, 0, 0, skinMat, head);
  cyl(0.09, 0.09, 0.065, 8, 0, 0.245, 0, skinMat, head);
  cyl(0.25, 0.255, 0.11, 10, 0, 0.19, 0, hair, head);
  box(0.32, 0.17, 0.21, 0, 0.125, -0.15, hair, head);
  for (const s of [-1, 1]) {
    box(0.044, sleeping ? 0.012 : 0.037, 0.016, s * 0.085, 0.022, 0.237, shoe, head);
    if (!sleeping) {
      const brow = box(0.069, 0.016, 0.018, s * 0.085, 0.079, 0.235, hair, head);
      brow.rotation.z = s * 0.12;
    }
  }
  box(0.08, 0.014, 0.018, 0, -0.105, 0.238, mat(0x725744), head);
  box(0.045, 0.055, 0.045, 0, -0.038, 0.237, skinMat, head);
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.42, 0.35, 0);
    torso.add(arm);
    box(0.22, 0.47, 0.25, side * 0.02, -0.22, 0, cloth, arm);
    box(0.23, 0.055, 0.25, side * 0.02, -0.46, 0, shirt, arm);
    if (accent) box(0.235, 0.075, 0.265, side * 0.02, -0.08, 0, mat(accent), arm);
    const hand = mesh(new THREE.TorusGeometry(0.088, 0.042, 5, 9, Math.PI * 1.65), skinMat, side * 0.02, -0.58, 0.015, arm, false);
    hand.rotation.y = Math.PI / 2;
    hand.rotation.z = 0.4;
    arms.push(arm);
  }
  if (accent) box(0.07, 0.09, 0.02, -0.13, 0.3, 0.262, mat(accent, 0.5, 0.3), torso);
  // Studs at the shoulders keep the figure built from toy-like pieces.
  for (const s of [-1, 1]) {
    const pin = cyl(0.08, 0.08, 0.04, 8, s * 0.45, 0.36, 0, cloth, torso);
    pin.rotation.z = Math.PI / 2;
  }
  mergeChildren(root);
  root.userData = { head, torso, arms, legs };
  return root;
}

const outlineGeo = new THREE.TorusGeometry(0.58, 0.018, 4, 32);
function makeEnemy(kind, index, spawn, figure) {
  const outline = new THREE.Mesh(outlineGeo, new THREE.MeshBasicMaterial({ color: kind === 'security' ? 0xf0b070 : 0xe99e78, transparent: true, opacity: 0.7, depthTest: false }));
  outline.position.y = 0.27;
  outline.visible = false;
  figure.add(outline);
  figure.position.copy(spawn);
  figure.visible = kind === 'hall' && index === 0;
  world.add(figure);
  const e = {
    kind,
    index,
    mesh: figure,
    p: spawn.clone(),
    v: V(),
    r: 0.78,
    hp: 90,
    maxHp: 90,
    state: 'idle',
    timer: 0,
    cooldown: 1 + index * 0.45,
    impactCooldown: 0,
    grounded: false,
    roll: 0,
    heading: 0,
    outline,
    activated: kind === 'hall' && index === 0,
    downTime: 0,
    respawnAt: Infinity,
    spawn: spawn.clone(),
  };
  enemies.push(e);
  return e;
}

function buildPeople() {
  // Three hostile projections hold the hall (indices 0-2, saved in this order).
  for (let i = 0; i < 3; i++) {
    const figure = createFigure([0x26312b, 0x3c3d32, 0x243a33][i], [0xc6a06b, 0xb58d5e, 0xc9aa7d][i]);
    makeEnemy('hall', i, V(i === 1 ? 1.3 : -0.7, 0.85, -5.5 - i * 11), figure);
  }
  const spawn = [V(7, 1.95, -22.3), V(11, 2.2, -22.3), V(7, 2.55, -28.8), V(11, 1.95, -28.8)];
  const tetherMat = new THREE.LineBasicMaterial({ color: 0xbdd1a2, transparent: true, opacity: 0.73 });
  ['Cobb', 'Ariadne', 'Eames', 'Saito'].forEach((name, i) => {
    const figure = createFigure([0x3a4b46, 0x8c775e, 0x796c50, 0x4c5550][i], [0xc6a579, 0xe0ba86, 0xb8996b, 0xb08c63][i], true);
    figure.rotation.set(Math.PI / 2, 0, i % 2 ? 0.2 : -0.2);
    figure.position.copy(spawn[i]);
    world.add(figure);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), tetherMat);
    line.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    line.frustumCulled = false;
    line.visible = false;
    world.add(line);
    crew.push({ name, mesh: figure, p: spawn[i].clone(), spawn: spawn[i], v: V(), r: 0.39, status: 'sleeping', phase: i * 1.4, line, stuck: 0 });
  });
  // Hotel security (indices 3-4): arrives in zero gravity once the team is on the line.
  [V(-0.4, 2.3, -39.2), V(0.6, 2.3, 4.5)].forEach((p, i) => {
    makeEnemy('security', i, p, createFigure(0x1c2a31, [0xb7916a, 0xc4a075][i], false, 0xcf7a4b));
  });

  hands = new THREE.Group();
  camera.add(hands);
  handL = new THREE.Group();
  handR = new THREE.Group();
  hands.add(handL, handR);
  for (const [i, hand] of [handL, handR].entries()) {
    const s = i === 0 ? -1 : 1;
    hand.position.set(s * 0.35, -0.48, -0.66);
    hand.scale.setScalar(0.77);
    box(0.18, 0.43, 0.22, 0, -0.09, 0.09, mat(0x25342e), hand);
    box(0.19, 0.065, 0.23, 0, 0.13, 0.037, mat(0xe2d5b3), hand);
    box(0.21, 0.2, 0.24, 0, 0.27, -0.006, mat(0xc8a16c), hand);
    box(0.07, 0.14, 0.14, -s * 0.125, 0.25, 0.016, mat(0xc8a16c), hand);
    for (let n = 0; n < 3; n++) box(0.045, 0.026, 0.04, (n - 1) * 0.057, 0.365, -0.072, mat(0xdbb980), hand);
    hand.rotation.x = 0.29;
    hand.rotation.z = -s * 0.13;
  }
  box(0.21, 0.08, 0.24, 0, 0.06, 0.04, mat(0x352f27), handL);
  box(0.12, 0.09, 0.025, 0, 0.068, 0.18, mat(0xb89a65, 0.5, 0.55), handL);
  box(0.09, 0.065, 0.008, 0, 0.07, 0.199, mat(0x244039, 0.6, 0, 0x29493b), handL);
  mergeChildren(handL);
  mergeChildren(handR);
  hands.visible = false;
  guideLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(), V()]), new THREE.LineBasicMaterial({ color: 0xc6bb91, transparent: true, opacity: 0.47 }));
  guideLine.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  guideLine.frustumCulled = false;
  guideLine.visible = false;
  scene.add(guideLine);
}

/* ================================================================ sparks */

// One instanced draw for every hit spark (the old code built a mesh and a material per spark).
const SPARK_MAX = 64;
const sparkColors = [new THREE.Color(0xd9ceac), new THREE.Color(0xe7bc87)];
const sparkMesh = new THREE.InstancedMesh(geoBox, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false }), SPARK_MAX);
sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
for (let i = 0; i < SPARK_MAX; i++) sparkMesh.setColorAt(i, sparkColors[i % 2]);
sparkMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
sparkMesh.frustumCulled = false;
sparkMesh.count = 0;
const sparks = [];
function emit(p, n = 4) {
  for (let i = 0; i < n; i++) {
    if (sparks.length >= SPARK_MAX) break;
    const life = 0.25 + random() * 0.3;
    sparks.push({ p: p.clone(), v: V((random() - 0.5) * 2, (random() - 0.5) * 2, (random() - 0.5) * 2), life, size: 0.035 + random() * 0.035, color: i % 2 ? 1 : 0 });
  }
}
function updateSparks(dt) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life -= dt;
    if (s.life <= 0) sparks.splice(i, 1);
    else s.p.addScaledVector(s.v, dt);
  }
  for (let i = 0; i < sparks.length; i++) {
    const s = sparks[i];
    _dummy.position.copy(s.p);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(s.size * Math.min(1, s.life * 2));
    _dummy.updateMatrix();
    sparkMesh.setMatrixAt(i, _dummy.matrix);
    sparkMesh.setColorAt(i, sparkColors[s.color]);
  }
  sparkMesh.count = sparks.length;
  if (sparks.length) {
    sparkMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceColor.needsUpdate = true;
  }
}

/* ================================================================ session */

function freshSession() {
  return {
    version: 2,
    phase: 'combat',
    time: 0,
    phaseTime: 0,
    difficulty: options.difficulty,
    kills: 0,
    blocks: 0,
    hits: 0,
    impacts: 0,
    shoves: 0,
    adapted: false,
    syncMisses: 0,
    notes: 0,
    discovered: false,
    tested: false,
    liftUnlocked: false,
    kit: false,
    unit: false,
    brake: false,
    fullTetherSaved: false,
    enteredLift: false,
    checkpoint: 'Hallway',
    ending: 0,
    lastVan: -1,
    ambush: false,
    ambushClear: false,
    securityDown: 0,
    ambushHits: 0,
    endurance: false,
    wave: 0,
  };
}

function resetActors() {
  player.p.set(0, 0.78, 7.5);
  player.v.set(0, 0, 0);
  player.yaw = 0;
  player.pitch = 0;
  player.health = 100;
  player.stamina = 100;
  player.impactCooldown = 0;
  gravityAngle = 0;
  viewRoll = 0;
  gravityStrength = 1;
  lastWarning = -1;
  activeEvent = null;
  attackAnim = 0;
  attackCooldown = 0;
  shoveAnim = 0;
  trauma = 0;
  damageOpacity = 0;
  hitOpacity = 0;
  braceAge = 99;
  interactProgress = 0;
  interactTarget = null;
  useLatch = false;
  sprintToggle = false;
  jumpBuffer = 0;
  liftOpen = 0;
  suiteOpen = 0;
  liftLeft.position.x = 0;
  liftRight.position.x = 0;
  suiteDoor.position.z = 0;
  suiteBlock.enabled = true;
  liftBlock.enabled = true;
  unitVisual.visible = false;
  kitVisual.visible = true;
  brakeVisual.rotation.x = 0;
  breadcrumbs.length = 0;
  radioLog.length = 0;
  sparks.length = 0;
  sparkMesh.count = 0;
  sync = null;
  const d = difficulty[session.difficulty] || difficulty.operative;
  enemies.forEach((e, i) => {
    e.p.copy(e.spawn);
    e.v.set(0, 0, 0);
    e.mesh.position.copy(e.p);
    e.mesh.quaternion.identity();
    e.maxHp = e.kind === 'security' ? Math.round(d.hp * 0.72) : d.hp;
    e.hp = e.maxHp;
    e.r = 0.78;
    e.state = 'idle';
    e.cooldown = 1 + i * 0.4;
    e.timer = 0;
    e.roll = 0;
    e.heading = 0;
    e.impactCooldown = 0;
    e.activated = e.kind === 'hall' && e.index === 0;
    e.mesh.visible = e.activated;
    e.outline.visible = false;
    e.downTime = 0;
    e.respawnAt = Infinity;
  });
  crew.forEach((c) => {
    c.p.copy(c.spawn);
    c.p.y = 1.02;
    c.v.set(0, 0, 0);
    c.stuck = 0;
    c.mesh.position.copy(c.p);
    c.mesh.rotation.set(Math.PI / 2, 0, 0);
    c.status = 'sleeping';
    c.line.visible = false;
  });
  debris.forEach((d2) => {
    d2.p.copy(d2.spawn);
    d2.v.set(0, 0, 0);
    d2.held = d2.type === 'weight';
    d2.mesh.position.copy(d2.p);
    d2.mesh.rotation.set(0, 0, 0);
  });
  notes.forEach((n) => {
    n.found = false;
    n.mesh.visible = true;
  });
  document.querySelectorAll('.sync-locks i').forEach((n) => n.classList.remove('done'));
  el.syncScreen.classList.add('hidden');
  setStyle(el.whiteout, 'opacity', '0');
}

function startNew() {
  session = freshSession();
  const chosen = $('difficulty').value;
  session.difficulty = difficulty[chosen] ? chosen : 'operative';
  options.difficulty = session.difficulty;
  saveOptions();
  resetActors();
  lastRun = 'story';
  setMode('playing');
  audio.init();
  capturePointer();
  saveCheckpoint('Hallway');
  say('ARTHUR', 'Four sleepers. One shared kick. Keep the hall clear.', 6);
  banner('01 / HOLD THE HALL', 'Stay with the plan.', 'Stop the projections. Your team is in suite 528.', 5);
  toast(`${g('move')} to move. ${g('strike')} to strike. Hold ${g('brace')} to brace.`, 7);
}

/** Endurance: the hall fight on its own, with no checkpoints and no end but Arthur's. */
function startEndurance(key = options.difficulty) {
  session = freshSession();
  session.difficulty = difficulty[key] ? key : 'operative';
  session.endurance = true;
  session.wave = 1;
  session.checkpoint = 'Endurance';
  options.difficulty = session.difficulty;
  saveOptions();
  resetActors();
  lastRun = 'endurance';
  setMode('playing');
  audio.init();
  capturePointer();
  say('ARTHUR', 'No team to carry this time. Just the hall, and whatever it sends.', 6);
  banner('ENDURANCE / WAVE 01', 'Hold the hall.', 'Every third projection stopped brings a harder wave.', 5);
  toast(`${g('strike')} to strike. Hold ${g('brace')} to brace. ${g('shove')} throws them into walls.`, 7);
}

function openEndurance() {
  $('endurance-difficulty').value = options.difficulty;
  updateEnduranceBest();
  setMode('endurance');
}

function updateEnduranceBest() {
  const key = $('endurance-difficulty').value;
  const rec = readRecord().endurance[key];
  setText($('endurance-best'), rec ? `BEST ON ${DIFF_LABEL[key]}  ${formatTime(rec.time)}  /  WAVE ${String(rec.wave).padStart(2, '0')}` : '');
}

/** Endurance ends when Arthur falls (or the player ends the run from the pause menu). */
function finishEndurance(quit = false) {
  if (mode === 'ended') return;
  setMode('ended');
  lastRun = 'endurance';
  sync = null;
  setStyle(el.whiteout, 'opacity', '0');
  const key = session.difficulty, t = session.time, wave = session.wave, kills = session.kills;
  $('end-eyebrow').textContent = `ENDURANCE / ${DIFF_LABEL[key]}`;
  $('end-title').textContent = quit ? 'Run ended.' : 'The hall fell.';
  $('end-description').textContent = `You held the hall for ${formatTime(t)} and reached wave ${wave}.`;
  $('end-screen').querySelector('.end-symbol').textContent = '∞';
  $('end-retry').classList.add('hidden');
  $('end-replay').innerHTML = 'HOLD THE HALL AGAIN <span>→</span>';
  $('result-stats').innerHTML = `<div><b>${formatTime(t)}</b><span>TIME HELD</span></div><div><b>${String(wave).padStart(2, '0')}</b><span>WAVE REACHED</span></div><div><b>${kills}</b><span>PROJECTIONS STOPPED</span></div>`;
  const badges = [];
  if (session.blocks > 0) badges.push(`${session.blocks} PERFECT BLOCK${session.blocks > 1 ? 'S' : ''}`);
  if (session.adapted) badges.push('ADAPTED TO GRAVITY');
  if (kills > 0 && session.hits === 0) badges.push('UNTOUCHABLE');
  $('result-badges').innerHTML = badges.map((b) => `<span>${b}</span>`).join('');
  const record = readRecord();
  const prev = record.endurance[key];
  const isNew = t >= 5 && (!prev || t > prev.time);
  if (isNew) record.endurance[key] = { time: t, wave, kills };
  const recordEl = $('result-record');
  recordEl.classList.toggle('new', isNew);
  recordEl.textContent = isNew
    ? prev
      ? `NEW BEST ON ${DIFF_LABEL[key]} / WAS ${formatTime(prev.time)}`
      : `FIRST RUN ON ${DIFF_LABEL[key]}`
    : prev
      ? `BEST ON ${DIFF_LABEL[key]} / ${formatTime(prev.time)} / WAVE ${String(prev.wave).padStart(2, '0')}`
      : '';
  storage.set(RECORD, record);
  audio.tone(90, 0.9, 0.13, 'sine', 30);
  input.rumble(0.7, 300);
}

const MENU_SCREENS = { title: 'title-screen', brief: 'brief-screen', endurance: 'endurance-screen', paused: 'pause-screen', manual: 'manual-screen', plan: 'plan-screen', ended: 'end-screen' };

function setMode(next) {
  mode = next;
  for (const id of Object.values(MENU_SCREENS)) $(id).classList.add('hidden');
  const screenId = MENU_SCREENS[next];
  const screen = screenId ? $(screenId) : null;
  screen?.classList.remove('hidden');
  const inGame = ['playing', 'paused', 'plan', 'ended', 'sync'].includes(next) || (next === 'manual' && manualReturn !== 'title');
  el.hud.classList.toggle('hidden', !inGame || next === 'ended');
  document.body.classList.toggle('in-game', inGame);
  hands.visible = inGame && next !== 'ended';
  el.masthead.classList.toggle('hidden', next === 'ended');
  el.syncScreen.classList.toggle('hidden', next !== 'sync');
  // The kit's stick and buttons only show while Arthur is on his feet.
  kit.touch?.suspend(next !== 'playing', 'game');
  if (next !== 'playing' && next !== 'sync') releasePointer();
  setStyle(el.damageFlash, 'opacity', next === 'playing' ? damageOpacity.toFixed(2) : '0');
  audio.setDrone(next === 'playing' || next === 'sync');
  // Whatever closed the last screen must not also act on this one.
  input.settle();
  menuGuard = performance.now() + 180;
  if (screen && input.source === 'gamepad') markFocus(primaryOf(screen));
  else if (!screen && document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  refreshPrompts();
}

let hadLock = false;
function capturePointer() {
  // Mouse look needs pointer lock; controllers and touch look without it.
  if (input.source !== 'keyboard' || document.pointerLockElement === kit.canvas) return;
  const canvas = kit.canvas;
  try {
    const p = canvas.requestPointerLock?.({ unadjustedMovement: true });
    p?.catch?.(() => {
      try {
        canvas.requestPointerLock?.()?.catch?.(() => {});
      } catch {
        /* a click on the view tries again */
      }
    });
  } catch {
    /* not allowed right now; a click on the view tries again */
  }
}
function releasePointer() {
  try {
    if (document.pointerLockElement) document.exitPointerLock();
  } catch {
    /* already released */
  }
}

function pause() {
  if (mode !== 'playing' && mode !== 'sync') return;
  pauseReturn = mode === 'sync' ? 'sync' : 'playing';
  if (sync) sync.paused = true;
  // An endurance run has no checkpoint to restart or save, so the two buttons say what they do there.
  setText($('load-checkpoint'), session.endurance ? 'RESTART RUN' : 'RESTART CHECKPOINT');
  setText($('quit-title'), session.endurance ? 'END RUN / SEE RESULTS' : 'SAVE & RETURN TO TITLE');
  setText($('save-note'), session.endurance ? 'Endurance keeps your longest hold on each difficulty.' : 'Progress is saved at mission checkpoints and when you return to the title.');
  setMode('paused');
}
function resume() {
  if (pauseReturn === 'sync' && sync) {
    setMode('sync');
    sync.paused = false;
  } else {
    setMode('playing');
    capturePointer();
  }
  audio.init();
}
function closePlan() {
  setMode('playing');
  capturePointer();
}
function cancelSync() {
  if (mode !== 'sync') return;
  sync = null;
  setMode('playing');
  capturePointer();
  toast('KICK CONTROL DISCONNECTED', 3);
}

function saveCheckpoint(name) {
  if (session.endurance) return; // endurance runs keep no checkpoints, and never touch the mission save
  session.checkpoint = name;
  const data = {
    version: 2,
    session: JSON.parse(JSON.stringify(session)),
    player: { p: player.p.toArray(), yaw: player.yaw, pitch: player.pitch, health: player.health },
    crew: crew.map((c) => ({ status: c.status, p: c.p.toArray() })),
    enemies: enemies.map((e) => ({ hp: e.hp, p: e.p.toArray() })),
    notes: notes.map((n) => n.found),
  };
  checkpointData = data;
  storage.set(STORE, data);
  if (mode === 'playing') toast(`CHECKPOINT / ${name.toUpperCase()}`, 3);
}
function validSave(d) {
  const point = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);
  return !!(
    d &&
    (d.version === 1 || d.version === 2) &&
    d.session &&
    ['combat', 'rescue', 'rig'].includes(d.session.phase) &&
    difficulty[d.session.difficulty] &&
    d.player &&
    point(d.player.p) &&
    Number.isFinite(d.player.health) &&
    Array.isArray(d.crew) &&
    d.crew.length === 4 &&
    d.crew.every((c) => c && point(c.p) && ['sleeping', 'linked', 'secured'].includes(c.status)) &&
    Array.isArray(d.enemies) &&
    d.enemies.length >= 3 &&
    d.enemies.length <= enemies.length &&
    d.enemies.every((e) => e && point(e.p) && Number.isFinite(e.hp))
  );
}
function loadCheckpoint() {
  const d = validSave(checkpointData) ? checkpointData : storage.get(STORE);
  if (!validSave(d)) {
    startNew();
    return;
  }
  session = Object.assign(freshSession(), JSON.parse(JSON.stringify(d.session)));
  session.version = 2;
  session.endurance = false;
  lastRun = 'story';
  resetActors();
  player.p.fromArray(d.player.p);
  player.p.x = clamp(player.p.x, -3.2, 13);
  player.p.y = clamp(player.p.y, 0.78, 4);
  player.p.z = clamp(player.p.z, -48, 11);
  player.yaw = Number(d.player.yaw) || 0;
  player.pitch = clamp(Number(d.player.pitch) || 0, -1.3, 1.3);
  player.health = Math.max(65, Number(d.player.health) || 100);
  enemies.forEach((e, i) => {
    const saved = d.enemies[i];
    if (saved) {
      e.hp = Math.min(e.maxHp, Number(saved.hp) || 0);
      e.p.fromArray(saved.p);
    }
    // Hall projections arrive on a timer; security only once the ambush has begun.
    e.activated = e.kind === 'hall' ? e.index === 0 || session.time > (e.index === 1 ? 10 : 21) : !!session.ambush;
    if (e.hp <= 0) {
      e.state = 'down';
      e.r = 0.4;
      e.downTime = 3;
    } else if (e.activated) e.state = 'chase';
    e.mesh.position.copy(e.p);
    e.mesh.visible = e.activated || e.hp <= 0;
  });
  crew.forEach((c, i) => {
    c.status = ['sleeping', 'linked', 'secured'].includes(d.crew[i].status) ? d.crew[i].status : 'sleeping';
    c.p.fromArray(d.crew[i].p);
    c.mesh.position.copy(c.p);
  });
  notes.forEach((n, i) => {
    n.found = !!d.notes?.[i];
    n.mesh.visible = !n.found;
  });
  session.notes = notes.filter((n) => n.found).length;
  if (session.phase !== 'combat') {
    gravityStrength = 0;
    gravityAngle = viewRoll = 0;
    suiteOpen = 1;
    suiteBlock.enabled = false;
    suiteDoor.position.z = -3.8;
  }
  if (session.liftUnlocked) {
    liftOpen = 1;
    liftBlock.enabled = false;
    liftLeft.position.x = -2.86;
    liftRight.position.x = 2.86;
  }
  unitVisual.visible = !!session.unit;
  kitVisual.visible = !session.kit;
  if (session.tested) {
    testWeight.held = false;
    testWeight.v.set(0, 0.2, 0);
  }
  brakeVisual.rotation.x = session.brake ? Math.PI / 2 : 0;
  checkpointData = d;
  subtitleTime = 0;
  setMode('playing');
  capturePointer();
  audio.init();
  say('ARTHUR', 'Back to the plan. Keep the team together.', 4);
  toast(`CHECKPOINT RESTORED / ${String(session.checkpoint).toUpperCase()}`, 4);
  updateHUD();
}

function readRecord() {
  const r = storage.get(RECORD) || {};
  const endurance = {};
  if (r.endurance && typeof r.endurance === 'object') {
    for (const k of DIFFICULTIES) {
      const e = r.endurance[k];
      if (e && Number.isFinite(e.time) && e.time > 0) endurance[k] = { time: e.time, wave: Math.max(1, e.wave | 0), kills: Math.max(0, e.kills | 0) };
    }
  }
  return {
    best: Number.isFinite(r.best) && r.best > 0 ? r.best : undefined,
    runs: Math.max(0, r.runs | 0),
    byDiff: r.byDiff && typeof r.byDiff === 'object' ? r.byDiff : {},
    badges: Array.isArray(r.badges) ? r.badges.filter((b) => BADGES.includes(b)) : [],
    endurance,
  };
}
function updateTitleRecord() {
  $('continue-game').classList.toggle('hidden', !validSave(storage.get(STORE)));
  const r = readRecord();
  const lines = [];
  if (r.best) lines.push(`BEST EXTRACTION  ${formatTime(r.best)}  /  ${r.runs} COMPLETE`);
  if (r.badges.length) lines.push(`COMMENDATIONS  ${r.badges.length} / ${BADGES.length}`);
  let hold = null;
  for (const k of DIFFICULTIES) if (r.endurance[k] && (!hold || r.endurance[k].time > hold.time)) hold = r.endurance[k];
  if (hold) lines.push(`LONGEST HOLD  ${formatTime(hold.time)}  /  WAVE ${String(hold.wave).padStart(2, '0')}`);
  $('best-record').innerHTML = lines.join('<br>');
}
function updateBriefBest() {
  const r = readRecord();
  const key = $('difficulty').value;
  const rec = r.byDiff[key];
  setText($('brief-best'), rec && rec.best > 0 ? `BEST ON ${DIFF_LABEL[key]}  ${formatTime(rec.best)}  /  ${rec.runs | 0} COMPLETE` : '');
}
/** A clean hotel behind the title and briefing screens. */
function resetWorld() {
  session = freshSession();
  resetActors();
  setStyle(el.whiteout, 'opacity', '0');
  centerTime = subtitleTime = 0;
}
function returnTitle() {
  setMode('title');
  resetWorld();
  updateTitleRecord();
}
/** "Save & return": keep the exact spot, not just the last checkpoint. */
function saveAndQuit() {
  if (session && !session.endurance && ['combat', 'rescue', 'rig'].includes(session.phase) && player.health > 0) saveCheckpoint(session.checkpoint);
  returnTitle();
}

function say(speaker, text, duration = 5) {
  el.subtitle.querySelector('b').textContent = speaker;
  el.subtitle.querySelector('span').textContent = text;
  el.subtitle.classList.add('show');
  subtitleTime = duration;
  radioLog.push({ speaker, text });
  if (radioLog.length > 9) radioLog.shift();
  if (speaker === 'YUSUF') audio.tone(450, 0.08, 0.06, 'sine');
}
function toast(text, duration = 3) {
  el.toast.textContent = text;
  el.toast.classList.add('show');
  toastTime = duration;
}
function banner(kicker, title, detail, duration = 4) {
  $('center-kicker').textContent = kicker;
  $('center-title').textContent = title;
  $('center-detail').textContent = detail;
  el.center.classList.add('show');
  centerTime = duration;
}
function formatTime(t) {
  return `${Math.floor(t / 60).toString().padStart(2, '0')}:${Math.floor(t % 60).toString().padStart(2, '0')}`;
}

/* ================================================================ physics */

/** "Up" for the hotel right now (the van's roll turns it). Shared vector: read, never modify. */
function gUp() {
  return gravityUp.set(-Math.sin(gravityAngle), Math.cos(gravityAngle), 0);
}

function sphereCollision(body, c, bounce) {
  if (!c.enabled) return 0;
  const p = body.p, r = body.r;
  if (p.x + r < c.min.x || p.x - r > c.max.x || p.y + r < c.min.y || p.y - r > c.max.y || p.z + r < c.min.z || p.z - r > c.max.z) return 0;
  _q.set(clamp(p.x, c.min.x, c.max.x), clamp(p.y, c.min.y, c.max.y), clamp(p.z, c.min.z, c.max.z));
  _n.subVectors(p, _q);
  const len = _n.length();
  let penetration = r - len;
  if (len > r) return 0;
  if (len < 0.00001) {
    // The centre is inside the box: leave through the nearest face.
    let d = p.x - c.min.x;
    _n.set(-1, 0, 0);
    if (c.max.x - p.x < d) {
      d = c.max.x - p.x;
      _n.set(1, 0, 0);
    }
    if (p.y - c.min.y < d) {
      d = p.y - c.min.y;
      _n.set(0, -1, 0);
    }
    if (c.max.y - p.y < d) {
      d = c.max.y - p.y;
      _n.set(0, 1, 0);
    }
    if (p.z - c.min.z < d) {
      d = p.z - c.min.z;
      _n.set(0, 0, -1);
    }
    if (c.max.z - p.z < d) {
      d = c.max.z - p.z;
      _n.set(0, 0, 1);
    }
    penetration = r + d;
  } else _n.multiplyScalar(1 / len);
  p.addScaledVector(_n, penetration + 0.00005);
  const speed = body.v.dot(_n);
  if (speed < 0) body.v.addScaledVector(_n, -speed * (1 + bounce));
  if (_n.dot(gUp()) > 0.55) body.grounded = true;
  return Math.max(0, -speed);
}

function stepPhysics(body, dt, bounce = 0, kind = 'prop') {
  body.grounded = false;
  body.impactCooldown = Math.max(0, (body.impactCooldown || 0) - dt);
  body.v.x += Math.sin(gravityAngle) * 11.7 * gravityStrength * dt;
  body.v.y -= Math.cos(gravityAngle) * 11.7 * gravityStrength * dt;
  const steps = 2, h = dt / steps;
  let impact = 0;
  for (let k = 0; k < steps; k++) {
    body.p.addScaledVector(body.v, h);
    for (const c of colliders) impact = Math.max(impact, sphereCollision(body, c, bounce));
  }
  if (impact > 7.4 && body.impactCooldown === 0) {
    body.impactCooldown = 0.8;
    if (kind === 'player') {
      if (isBracing()) {
        audio.noise(0.14, 0.15, 260);
        toast('BRACED / IMPACT ABSORBED', 1.1);
        input.rumble(0.25, 90);
      } else {
        session.impacts++;
        hurt(clamp((impact - 5.5) * 1.8, 3, 12), 'impact');
      }
      trauma = Math.max(trauma, isBracing() ? 0.11 : 0.3);
      audio.noise(0.22, 0.2, 360);
    } else if (kind === 'enemy' && body.hp > 0) {
      body.hp -= clamp((impact - 5) * 4, 8, 35);
      body.state = 'stagger';
      body.timer = 1.0;
      emit(body.p, 4);
      if (body.hp <= 0) downEnemy(body, true);
    }
  }
  body.p.x = clamp(body.p.x, -4.0, 14.0);
  body.p.y = clamp(body.p.y, -1, 5.5);
  body.p.z = clamp(body.p.z, -49, 12);
}

function isBracing() {
  return actDown('brace') && player.stamina > 3;
}

function hurt(amount, kind = 'hit') {
  if (mode !== 'playing' || player.health <= 0) return;
  const diff = combatDiff();
  player.health = Math.max(0, player.health - amount * diff.damage);
  damageOpacity = 0.6;
  trauma = Math.max(trauma, kind === 'hit' ? 0.4 : 0.24);
  if (kind === 'hit') {
    session.hits++;
    if (session.ambush && !session.ambushClear) session.ambushHits++;
  }
  audio.hit();
  input.rumble(kind === 'hit' ? 0.6 : 0.4, kind === 'hit' ? 180 : 140);
  if (player.health <= 0) finish(false);
}

/** Is the straight line from a to b free of walls? */
function lineClear(a, b) {
  _lcDir.subVectors(b, a);
  const length = _lcDir.length();
  if (length < 0.001) return true;
  _ray.origin.copy(a);
  _ray.direction.copy(_lcDir).multiplyScalar(1 / length);
  for (const c of colliders) {
    if (!c.enabled || c.box.containsPoint(a)) continue;
    if (_ray.intersectBox(c.box, _lcHit) && _lcHit.distanceTo(a) < length - 0.18) return false;
  }
  return true;
}

/* ================================================================ Arthur */

function updatePlayer(dt) {
  const bracing = isBracing();
  braceAge = bracing ? (braceAge === 99 ? 0 : braceAge + dt) : 99;
  if (session.phase !== 'kick') {
    const lk = input.look('look');
    player.yaw -= lk.x * LOOK_SCALE;
    player.pitch = clamp(player.pitch - lk.y * LOOK_SCALE, -1.35, 1.35);
  }
  const up = gUp();
  _fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
  _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const mv = virtualMove || input.vector('move');
  const mx = mv.x, mz = mv.y;
  const length = Math.hypot(mx, mz);
  // Keyboard holds Shift to run; a controller clicks the left stick once; on touch, push the stick all the way.
  if (pressed('run') && input.source === 'gamepad') sprintToggle = !sprintToggle;
  if (length < 0.2) sprintToggle = false;
  const touchSprint = input.source === 'touch' && length > 0.95;
  let linked = 0;
  for (const c of crew) if (c.status === 'linked') linked++;
  const running = (actDown('run') || sprintToggle || touchSprint) && length > 0.2 && player.stamina > 8 && !bracing;
  // A jump pressed just before landing still counts.
  jumpBuffer = pressed('jump') ? 0.16 : Math.max(0, jumpBuffer - dt);
  if (gravityStrength > 0.12) {
    _fwd.addScaledVector(up, -_fwd.dot(up));
    _right.addScaledVector(up, -_right.dot(up));
    _fwd.normalize();
    _right.normalize();
    const speed = bracing ? 1.15 : running ? 5.3 : 3.4;
    _wish.copy(_fwd).multiplyScalar(mz * speed).addScaledVector(_right, mx * speed);
    const normal = player.v.dot(up);
    _tan.copy(player.v).addScaledVector(up, -normal);
    _tan.lerp(_wish, 1 - Math.exp(-(player.grounded ? 11 : 1.65) * dt));
    player.v.copy(_tan).addScaledVector(up, normal);
    if (jumpBuffer > 0 && player.grounded && player.stamina > 12) {
      player.v.addScaledVector(up, 4.6);
      player.stamina -= 10;
      jumpBuffer = 0;
      audio.noise(0.08, 0.13, 350);
    }
  } else {
    const rise = (actDown('jump') ? 1 : 0) - (actDown('lower') ? 1 : 0);
    _wish.copy(_fwd).multiplyScalar(mz).addScaledVector(_right, mx).addScaledVector(YAXIS, rise);
    if (_wish.length() > 1) _wish.normalize();
    player.v.addScaledVector(_wish, ((running ? 5.3 : 3.6) * dt) / (1 + linked * 0.11));
    player.v.multiplyScalar(Math.exp(-(bracing ? 6.5 : 0.63) * dt));
    const max = running ? 5.1 : 3.5;
    if (player.v.length() > max) player.v.setLength(max);
  }
  if (running) player.stamina = Math.max(0, player.stamina - 17 * dt);
  else if (bracing) player.stamina = Math.max(0, player.stamina - 2.0 * dt);
  else player.stamina = Math.min(100, player.stamina + 19 * dt);
  _pull.copy(player.p);
  stepPhysics(player, dt, 0, 'player');
  const distance = player.p.distanceTo(_pull);
  if (player.grounded && gravityStrength > 0.4) {
    stepDistance += distance;
    if (stepDistance > 0.98) {
      stepDistance = 0;
      audio.step();
    }
  }
  // Slow recovery in the hall when no active projection is close.
  if (session.phase === 'combat' && player.health > 0 && player.health < 100 && session.time % 1 < dt) {
    let safe = true;
    for (const e of enemies) if (e.activated && e.hp > 0 && e.p.distanceTo(player.p) <= 8) safe = false;
    if (safe) player.health = Math.min(100, player.health + 1);
  }
  if (gravityStrength < 0.15 && (!breadcrumbs.length || breadcrumbs[breadcrumbs.length - 1].distanceTo(player.p) > 0.23)) {
    breadcrumbs.push(player.p.clone());
    if (breadcrumbs.length > 280) breadcrumbs.shift();
  }
}

function attack(shove = false) {
  if (mode !== 'playing' || session.phase === 'kick' || attackCooldown > 0 || player.stamina < (shove ? 22 : 6)) return;
  attackCooldown = shove ? 0.8 : 0.42;
  player.stamina -= shove ? 22 : 6;
  if (shove) shoveAnim = 1;
  else attackAnim = 1;
  audio.noise(0.08, 0.16, 1500);
  _aim.set(0, 0, -1).applyQuaternion(camera.quaternion);
  let target = null, best = 3.0;
  for (const e of enemies) {
    if (e.hp <= 0 || !e.activated) continue;
    _d.subVectors(e.p, player.p);
    const dist = _d.length();
    if (dist < best && _aim.dot(_d.normalize()) > (dist < 1.35 ? -0.05 : 0.28) && lineClear(player.p, e.p)) {
      best = dist;
      target = e;
    }
  }
  if (!target) return;
  _d.subVectors(target.p, player.p).normalize();
  target.hp -= shove ? 16 : 32;
  target.v.addScaledVector(_d, shove ? 10 : 4.4);
  target.v.addScaledVector(gUp(), shove ? 1.6 : 0.65);
  target.state = 'stagger';
  target.timer = shove ? 1.0 : 0.39;
  target.cooldown = shove ? 1.1 : 0.7;
  hitOpacity = 1;
  trauma = Math.max(trauma, 0.1);
  audio.hit();
  input.rumble(shove ? 0.35 : 0.25, shove ? 110 : 70);
  _pull.copy(target.p).addScaledVector(gUp(), 0.25);
  emit(_pull, shove ? 8 : 4);
  if (shove) session.shoves++;
  if (target.hp <= 0) downEnemy(target, Math.abs(Math.sin(gravityAngle)) > 0.55 || Math.cos(gravityAngle) < 0);
}

/* ================================================================ projections */

function securityLive() {
  for (const e of enemies) if (e.kind === 'security' && e.activated && e.hp > 0) return true;
  return false;
}
const fighting = () => session.phase === 'combat' || securityLive();

function downEnemy(e, adapted = false) {
  if (e.state === 'down') return;
  e.hp = 0;
  e.state = 'down';
  e.r = 0.4;
  e.downTime = 0;
  e.outline.visible = false;
  e.v.addScaledVector(gUp(), 1.1);
  audio.tone(160, 0.25, 0.12, 'triangle', 55);
  input.rumble(0.4, 140);
  if (e.kind === 'security') {
    session.securityDown++;
    toast(`SECURITY STOPPED / ${session.securityDown} OF ${SECURITY_COUNT}`, 2.5);
    if (session.securityDown >= SECURITY_COUNT && !session.ambushClear) {
      session.ambushClear = true;
      say('ARTHUR', 'The hall is clear. Keep the team moving.', 5);
      if (!session.ambushHits) toast('LINE HELD / NOT A SCRATCH', 3);
    }
    return;
  }
  session.kills++;
  if (adapted) session.adapted = true;
  if (session.endurance) {
    // The projection re-forms elsewhere after a pause that shrinks as the waves climb.
    e.respawnAt = session.time + Math.max(2.2, 5.5 - session.wave * 0.4);
    toast(`PROJECTION STOPPED / ${session.kills}`, 2);
    if (session.kills % 3 === 0) nextWave();
    return;
  }
  toast(`PROJECTION STOPPED / ${session.kills} OF 3`, 2.5);
  if (session.kills === 3 && session.phase === 'combat') {
    session.phase = 'rescue';
    session.phaseTime = 0;
    player.health = Math.max(player.health, 70);
    say('YUSUF', 'The bridge is gone. We are going over.', 5);
    banner('02 / BRING THEM HOME', 'The plan has changed.', 'Reach suite 528. Keep the sleepers together.', 5);
    saveCheckpoint('The bridge');
  }
}

/** Endurance: every third projection stopped. A breather for Arthur, a harder hall after it. */
function nextWave() {
  session.wave++;
  player.health = Math.min(100, player.health + 20);
  player.stamina = 100;
  banner(`ENDURANCE / WAVE ${String(session.wave).padStart(2, '0')}`, 'They adapt.', 'Faster projections. Shorter warnings. Hold the hall.', 3.5);
  audio.success();
  input.rumble(0.3, 160);
}

/** Endurance: a stopped projection re-forms on the current floor, away from Arthur. */
function respawnProjection(e) {
  emit(e.p, 6); // the old body dissolves
  // A random spawn point more than 9 m away (reservoir pick), else the farthest one.
  let pick = null, seen = 0, far = ENDURANCE_SPAWNS[0], farDist = -1;
  for (const s of ENDURANCE_SPAWNS) {
    const d = s.distanceTo(player.p);
    if (d > farDist) {
      farDist = d;
      far = s;
    }
    if (d > 9 && random() * ++seen < 1) pick = s;
  }
  pick = pick || far;
  // Stand it on whichever surface is "down" right now, so it does not fall across the hall.
  const up = gUp();
  const half = Math.abs(up.x) > Math.abs(up.y) ? 3.9 : 2.45;
  e.p.set(pick.x * (1 - Math.abs(up.x)) - up.x * (half - 0.85), 2.45 - up.y * (half - 0.85), pick.z);
  const diff = combatDiff();
  e.v.set(0, 0, 0);
  e.maxHp = diff.hp;
  e.hp = e.maxHp;
  e.r = 0.78;
  e.state = 'chase';
  e.timer = 0;
  e.cooldown = 1.2;
  e.roll = gravityAngle;
  e.heading = 0;
  e.impactCooldown = 1;
  e.activated = true;
  e.downTime = 0;
  e.respawnAt = Infinity;
  e.outline.visible = false;
  e.mesh.quaternion.identity();
  e.mesh.position.copy(e.p);
  e.mesh.visible = true;
  emit(e.p, 8);
  audio.noise(0.3, 0.12, 900);
  toast('PROJECTION / REINFORCEMENT IN THE HALL', 2.2);
}

/** An attack that lands at the end of a wind-up: a late brace is a perfect block. */
function resolveStrike(e, damage) {
  _strikeDir.subVectors(player.p, e.p).normalize();
  if (isBracing()) {
    if (braceAge < 0.46) {
      e.state = 'stagger';
      e.timer = 1.35;
      e.v.addScaledVector(_strikeDir, -3);
      session.blocks++;
      toast('PERFECT BLOCK / STRIKE NOW', 1.3);
      audio.tone(660, 0.12, 0.17, 'triangle', 380);
      emit(e.p, 5);
      input.rumble(0.5, 110);
    } else {
      hurt(3);
      player.v.addScaledVector(_strikeDir, 0.8);
      audio.noise(0.1, 0.12, 350);
    }
    player.stamina = Math.max(0, player.stamina - 12);
  } else {
    hurt(damage);
    player.v.addScaledVector(_strikeDir, 3.6);
    trauma = 0.4;
  }
}

/** Where a security projection should head: straight for Arthur, or through the suite door first. */
function portalTarget(p) {
  const inRoom = (q) => q.x > 4.17;
  if (inRoom(p) === inRoom(player.p) || lineClear(p, player.p)) return player.p;
  const near = inRoom(p) ? SUITE_DOOR_ROOM : SUITE_DOOR_HALL;
  if (p.distanceTo(near) > 0.9) return near;
  return inRoom(p) ? SUITE_DOOR_HALL : SUITE_DOOR_ROOM;
}

function hallAI(e, dist, dt, up, diff) {
  if (e.state === 'stagger') {
    e.timer -= dt;
    e.v.multiplyScalar(Math.exp(-1.7 * dt));
    if (e.timer <= 0) e.state = 'chase';
  } else if (e.state === 'windup') {
    e.timer -= dt;
    e.v.addScaledVector(up, -e.v.dot(up) * 0.02);
    if (e.timer <= 0) {
      e.state = 'recover';
      e.timer = 0.55;
      e.cooldown = 1.4;
      if (dist < 2.8 && lineClear(e.p, player.p)) resolveStrike(e, 16);
    }
  } else if (e.state === 'recover') {
    e.timer -= dt;
    if (e.timer <= 0) e.state = 'chase';
  } else {
    e.state = 'chase';
    _d.subVectors(player.p, e.p);
    _d.addScaledVector(up, -_d.dot(up));
    if (_d.length() > 0.01) _d.normalize();
    const normal = e.v.dot(up);
    _tan.copy(e.v).addScaledVector(up, -normal);
    _tan.lerp(_d.multiplyScalar(dist < 1.75 ? 0.2 : diff.enemySpeed), 1 - Math.exp(-(e.grounded ? 6 : 1.3) * dt));
    e.v.copy(_tan).addScaledVector(up, normal);
    if (dist < 2.25 && e.cooldown <= 0) {
      e.state = 'windup';
      e.timer = diff.telegraph;
      audio.noise(0.065, 0.055, 2000);
    }
  }
  stepPhysics(e, dt, 0.03, 'enemy');
}

/** Hotel security in zero gravity: they thrust toward Arthur, drift, and bounce off the walls. */
function securityAI(e, dist, dt, diff) {
  if (e.state === 'stagger') {
    e.timer -= dt;
    e.v.multiplyScalar(Math.exp(-0.9 * dt));
    if (e.timer <= 0) e.state = 'chase';
  } else if (e.state === 'windup') {
    e.timer -= dt;
    e.v.multiplyScalar(Math.exp(-2.5 * dt));
    if (e.timer <= 0) {
      e.state = 'recover';
      e.timer = 0.6;
      e.cooldown = 1.6;
      if (dist < 2.6 && lineClear(e.p, player.p)) resolveStrike(e, 12);
    }
  } else if (e.state === 'recover') {
    e.timer -= dt;
    e.v.multiplyScalar(Math.exp(-1.2 * dt));
    if (e.timer <= 0) e.state = 'chase';
  } else {
    e.state = 'chase';
    const speed = diff.enemySpeed * 1.1;
    _d.subVectors(portalTarget(e.p), e.p);
    const len = _d.length();
    if (len > 0.01) _d.multiplyScalar(1 / len);
    if (dist > 1.6) e.v.addScaledVector(_d, speed * 1.6 * dt);
    e.v.multiplyScalar(Math.exp(-0.7 * dt));
    if (e.v.length() > speed) e.v.setLength(speed);
    if (dist < 2.1 && e.cooldown <= 0 && lineClear(e.p, player.p)) {
      e.state = 'windup';
      e.timer = diff.telegraph * 1.1;
      audio.noise(0.065, 0.055, 2000);
    }
  }
  stepPhysics(e, dt, 0.25, 'enemy');
}

function updateEnemies(dt) {
  const up = gUp();
  const diff = combatDiff();
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    e.cooldown = Math.max(0, e.cooldown - dt);
    if (session.endurance && e.kind === 'hall' && e.hp <= 0 && session.time >= e.respawnAt) respawnProjection(e);
    if (e.kind === 'hall' && !e.activated && session.phase === 'combat' && session.time > (e.index === 1 ? 10 : 21)) {
      e.activated = true;
      toast('PROJECTION / REINFORCEMENT IN THE HALL', 3);
    }
    e.mesh.visible = e.activated || e.hp <= 0;
    // Not here yet: no physics, so gravity shifts cannot hurt a projection nobody has seen.
    if (!e.activated && e.hp > 0) continue;
    const dist = e.p.distanceTo(player.p);
    const live = e.hp > 0 && (e.kind === 'hall' ? session.phase === 'combat' : session.phase === 'rescue' || session.phase === 'rig');
    if (live) {
      if (e.kind === 'hall') hallAI(e, dist, dt, up, diff);
      else securityAI(e, dist, dt, diff);
      e.roll += wrap(gravityAngle - e.roll) * (1 - Math.exp(-3 * dt));
      _d.subVectors(player.p, e.p).applyAxisAngle(ZAXIS, -e.roll);
      e.heading += wrap(Math.atan2(_d.x, _d.z) - e.heading) * (1 - Math.exp(-4 * dt));
      e.mesh.quaternion.setFromAxisAngle(ZAXIS, e.roll).multiply(_quatB.setFromAxisAngle(YAXIS, e.heading));
      const arms = e.mesh.userData.arms, legs = e.mesh.userData.legs;
      const walk = e.kind === 'security' ? Math.sin(session.time * 3 + i) * 0.25 : e.v.length() > 1 ? Math.sin(session.time * 7.5 + i) * 0.3 : 0;
      legs[0].rotation.x = walk;
      legs[1].rotation.x = -walk;
      const punch = e.state === 'windup' ? -1.5 : e.state === 'recover' ? -2.0 : e.state === 'stagger' ? 0.6 : -0.6;
      arms[0].rotation.x = damp(arms[0].rotation.x, -0.8, 8, dt);
      arms[1].rotation.x = damp(arms[1].rotation.x, punch, 10, dt);
      e.outline.visible = e.state === 'windup';
      e.outline.material.opacity = 0.35 + Math.sin(session.time * 18) * 0.25;
      if (e.outline.visible) e.outline.lookAt(camera.position);
      if (dist < 1.02) {
        _d.subVectors(e.p, player.p).normalize();
        e.p.addScaledVector(_d, dt * 0.8);
        player.p.addScaledVector(_d, -dt * 0.8);
      }
    } else {
      e.downTime += dt;
      e.v.multiplyScalar(Math.exp(-0.34 * dt));
      stepPhysics(e, dt, 0.14);
      _quatA.setFromAxisAngle(ZAXIS, gravityAngle).multiply(_quatB.setFromAxisAngle(XAXIS, Math.PI / 2));
      e.mesh.quaternion.slerp(_quatA, 1 - Math.exp(-2.4 * dt));
      const arms = e.mesh.userData.arms, legs = e.mesh.userData.legs;
      arms[0].rotation.x = damp(arms[0].rotation.x, -0.4, 3, dt);
      arms[1].rotation.x = damp(arms[1].rotation.x, 0.4, 3, dt);
      legs[0].rotation.x = damp(legs[0].rotation.x, 0, 3, dt);
      legs[1].rotation.x = damp(legs[1].rotation.x, 0, 3, dt);
    }
    e.mesh.position.copy(e.p);
  }
}

function startAmbush() {
  session.ambush = true;
  session.ambushHits = 0;
  for (const e of enemies) {
    if (e.kind !== 'security') continue;
    e.activated = true;
    e.p.copy(e.spawn);
    e.v.set(0, 0, 0);
    e.hp = e.maxHp;
    e.r = 0.78;
    e.state = 'chase';
    e.cooldown = 1.6;
    e.mesh.visible = true;
    e.mesh.position.copy(e.p);
    emit(e.p, 8);
  }
  audio.alarm();
  input.rumble(0.3, 220);
  say('YUSUF', 'Their security found the safety line. Two of them, coming down the hall.', 6);
  banner('SECURITY IN THE HALL', 'They know we are here.', 'Strikes push them away. A wall stops them.', 4.5);
  saveCheckpoint('Security in the hall');
}

function updateProps(dt) {
  for (const d of debris) {
    if (d.held) continue;
    d.v.multiplyScalar(Math.exp(-0.13 * dt));
    stepPhysics(d, dt, d.type === 'paper' ? 0.15 : 0.25);
    d.mesh.position.copy(d.p);
    const moving = d.v.length();
    if (moving > 0.2 || gravityStrength < 0.1) {
      const k = dt * (0.2 + moving * 0.28);
      d.mesh.rotation.x += d.spin.x * k;
      d.mesh.rotation.y += d.spin.y * k;
      d.mesh.rotation.z += d.spin.z * k;
    }
  }
  updateSparks(dt);
}

/* ================================================================ gravity and the van */

function updateGravity(dt) {
  if (session.phase === 'combat') {
    let time = session.time % 58, index = 0;
    while (index < vanEvents.length - 1 && time >= vanEvents[index].duration) {
      time -= vanEvents[index].duration;
      index++;
    }
    const e = vanEvents[index];
    activeEvent = e;
    if (index !== session.lastVan) {
      session.lastVan = index;
      lastWarning = -1;
      if (session.time > 1) {
        audio.noise(0.5, 0.24, 150);
        trauma = 0.12;
        toast(`${e.label} / GRAVITY SHIFT`, 2.7);
        input.rumble(0.35, 260);
      }
    }
    const remaining = e.duration - time;
    if (remaining < 2.6 && lastWarning !== index) {
      lastWarning = index;
      say('YUSUF', e.quote, 3);
      audio.tone(490, 0.15, 0.1);
    }
    setText(el.vanWarning, remaining < 2.6 ? `${e.warning} / ${Math.ceil(remaining)}` : '');
    el.vanHud.classList.toggle('warning', remaining < 2.6);
    gravityAngle += wrap(e.angle - gravityAngle) * (1 - Math.exp(-1.2 * dt));
    gravityStrength = damp(gravityStrength, 1, 2, dt);
  } else {
    const was = gravityStrength;
    gravityAngle += wrap(-gravityAngle) * (1 - Math.exp(-1.1 * dt));
    gravityStrength = damp(gravityStrength, 0, 0.7, dt);
    activeEvent = FREE_FALL;
    el.vanHud.classList.remove('warning');
    setText(el.vanWarning, 'DREAM TIME / EXTENDED');
    if (was > 0.18 && gravityStrength <= 0.18) {
      say('ARTHUR', 'No gravity. A drop will not wake them. I need another kick.', 7);
      banner('LEVEL ABOVE / FREE FALL', 'There is no down.', `Use the safety line to move. ${g('rise')} rises. ${g('lower')} descends.`, 5);
      toast(`${g('brace')} applies the line brake.`, 5);
    }
  }
  if (session.phase !== 'combat') {
    suiteOpen = damp(suiteOpen, 1, 2, dt);
    suiteDoor.position.z = -3.8 * suiteOpen;
    suiteBlock.enabled = suiteOpen < 0.72;
  }
  liftOpen = damp(liftOpen, session.liftUnlocked ? 1 : 0, 2.5, dt);
  liftLeft.position.x = -2.86 * liftOpen;
  liftRight.position.x = 2.86 * liftOpen;
  liftBlock.enabled = liftOpen < 0.88;
}
const FREE_FALL = { label: 'VAN IN FREE FALL', detail: 'NO ROAD CONTACT', angle: 0 };

/* ================================================================ the sleeping team */

function pathPoint(distance, out) {
  if (breadcrumbs.length === 0) return out.copy(player.p);
  let total = 0, last = player.p;
  for (let i = breadcrumbs.length - 1; i >= 0; i--) {
    const p = breadcrumbs[i], segment = p.distanceTo(last);
    if (total + segment >= distance && segment > 0.001) return out.copy(last).lerp(p, (distance - total) / segment);
    total += segment;
    last = p;
  }
  return out.copy(last);
}

function updateCrew(dt) {
  let linkedIndex = 0;
  _prior.copy(player.p);
  _prior.y -= 0.15;
  for (let i = 0; i < crew.length; i++) {
    const c = crew[i];
    if (c.status === 'sleeping') {
      if (session.phase !== 'combat') {
        c.p.y = damp(c.p.y, c.spawn.y + Math.sin(session.time * 0.47 + c.phase) * 0.12, 0.6, dt);
        c.p.x = c.spawn.x + Math.sin(session.time * 0.19 + c.phase) * 0.16;
        c.p.z = c.spawn.z + Math.cos(session.time * 0.2 + c.phase) * 0.16;
        c.mesh.rotation.z = Math.sin(session.time * 0.35 + c.phase) * 0.17;
        c.mesh.rotation.y = Math.sin(session.time * 0.23 + c.phase) * 0.1;
      }
    } else if (c.status === 'linked') {
      linkedIndex++;
      pathPoint(1.35 * linkedIndex, _desired);
      _desired.y = clamp(_desired.y + 0.16 + Math.sin(session.time + i) * 0.035, 0.6, 4.1);
      _pull.subVectors(_desired, c.p);
      c.v.addScaledVector(_pull, 7.5 * dt);
      c.v.multiplyScalar(Math.exp(-4.6 * dt));
      c.p.addScaledVector(c.v, dt);
      for (const col of colliders) sphereCollision(c, col, 0.02);
      const gap = c.p.distanceTo(_desired);
      if (gap > 12) c.p.lerp(_desired, 0.025);
      // A sleeper caught on a door frame drifts free instead of holding the team back.
      c.stuck = gap > 4 ? c.stuck + dt : 0;
      if (c.stuck > 1.5) c.p.lerp(_desired, 1 - Math.exp(-1.6 * dt));
      c.mesh.rotation.x = damp(c.mesh.rotation.x, Math.PI / 2, 2, dt);
      c.mesh.rotation.z = Math.sin(session.time * 0.55 + i) * 0.14;
      c.mesh.rotation.y = damp(c.mesh.rotation.y, 0, 2, dt);
      const positions = c.line.geometry.attributes.position;
      positions.setXYZ(0, _prior.x, _prior.y, _prior.z);
      positions.setXYZ(1, c.p.x, c.p.y, c.p.z);
      positions.needsUpdate = true;
      _prior.copy(c.p);
    } else if (c.status === 'secured') {
      _desired.set(-1.8 + i * 1.2, 1.38, -44.85);
      c.p.lerp(_desired, 1 - Math.exp(-2.6 * dt));
      c.mesh.rotation.x = damp(c.mesh.rotation.x, Math.PI / 2, 3, dt);
      c.mesh.rotation.y = damp(c.mesh.rotation.y, 0, 3, dt);
      c.mesh.rotation.z = damp(c.mesh.rotation.z, 0, 3, dt);
      const a = c.line.geometry.attributes.position;
      a.setXYZ(0, c.p.x, 0.16, -44.85);
      a.setXYZ(1, c.p.x, c.p.y, -44.85);
      a.needsUpdate = true;
    }
    c.line.visible = c.status !== 'sleeping';
    c.mesh.position.copy(c.p);
  }
  if (session.phase === 'rescue' && player.p.x > 5.0 && !session.discovered) {
    session.discovered = true;
    say('ARTHUR', 'Still asleep. Link their harnesses, then bring them to the lift.', 6);
    toast(`Hold ${g('interact')} near each sleeper to link a harness.`, 5);
  }
  let onLine = 0;
  for (const c of crew) if (c.status !== 'sleeping') onLine++;
  if (onLine === crew.length && !session.fullTetherSaved) {
    session.fullTetherSaved = true;
    say('ARTHUR', 'All four linked. The service lift is at the end of the hall.', 5);
    saveCheckpoint('Team linked');
  }
  if (session.phase === 'rescue' && !session.ambush && onLine >= 2 && mode === 'playing') startAmbush();
  if (session.phase === 'rescue' && player.p.z < -43 && !session.enteredLift) {
    session.enteredLift = true;
    say('ARTHUR', 'This will work. Secure the harnesses to the lift.', 5);
  }
}

/* ================================================================ interaction */

const LIFT_SECURE_POINT = V(0, 1.55, -44.2);
const DROP_TEST_POINT = V(5.15, 1.32, -31);
const LIFT_RELEASE_POINT = V(2.5, 1.7, -41.7);
const RIG_POINTS = { kit: V(2.5, 1.25, -43.3), unit: V(2.72, 2.6, -46.1), brake: V(-2.65, 2.5, -46.1), console: V(0, 2, -48.7) };

/**
 * Everything Arthur can hold the use button on. The objects are built once (after the
 * hotel and the people exist) and targets() only picks which apply, so the per-frame
 * interaction check allocates nothing. Crew targets point at the sleepers' live positions.
 */
let T = null;
const _targets = [];
function buildTargets() {
  T = {
    crew: crew.map((c, i) => ({ id: `crew${i}`, p: c.p, range: 2.85, time: 0.85, title: `Link ${c.name}`, detail: 'HOLD / ATTACH SAFETY LINE', type: 'crew', i })),
    test: { id: 'test', p: DROP_TEST_POINT, range: 2.7, time: 0.85, title: 'Test a drop kick', detail: 'HOLD / TEST THE ORIGINAL PLAN', type: 'test' },
    lift: { id: 'lift', p: LIFT_RELEASE_POINT, range: 3.1, time: 0.7, title: 'Open the service lift', detail: 'HOLD / MANUAL RELEASE', type: 'lift' },
    secure: { id: 'secure', p: LIFT_SECURE_POINT, range: 3.2, time: 1.2, title: 'Secure the linked team', detail: 'HOLD / LOCK HARNESS ANCHORS', type: 'secure' },
    kit: { id: 'kit', p: RIG_POINTS.kit, range: 2.8, time: 0.8, title: 'Collect the impulse unit', detail: 'HOLD / LIFT EMERGENCY KIT', type: 'kit' },
    unit: { id: 'unit', p: RIG_POINTS.unit, range: 2.7, time: 1.45, title: 'Fit the impulse unit', detail: 'HOLD / CONNECT TO THE LIFT DRIVE', type: 'unit' },
    brake: { id: 'brake', p: RIG_POINTS.brake, range: 2.8, time: 1.1, title: 'Release the brake', detail: 'HOLD / ISOLATE THE LIFT', type: 'brake' },
    console: { id: 'console', p: RIG_POINTS.console, range: 3.0, time: 0.8, title: 'Synchronize the kick', detail: 'HOLD / CONNECT TO LEVEL ABOVE', type: 'console' },
    notes: notes.map((n) => ({ id: `note${n.id}`, p: n.p, range: 2.1, time: 0.55, title: 'Read a memory fragment', detail: 'HOLD / OPTIONAL INTEL', type: 'note', i: n.id })),
  };
}
function targets() {
  const list = _targets;
  list.length = 0;
  if (session.phase === 'combat' || session.endurance) return list;
  if (session.phase === 'rescue') {
    for (let i = 0; i < crew.length; i++) if (crew[i].status === 'sleeping') list.push(T.crew[i]);
  }
  if (!session.tested && player.p.x > 4) list.push(T.test);
  if (!session.liftUnlocked) list.push(T.lift);
  if (session.liftUnlocked && player.p.z < -42.8) {
    let anyLinked = false;
    for (const c of crew) if (c.status === 'linked') anyLinked = true;
    if (anyLinked) list.push(T.secure);
  }
  if (session.phase === 'rig') {
    if (!session.kit) list.push(T.kit);
    else if (!session.unit) list.push(T.unit);
    else if (!session.brake) list.push(T.brake);
    else list.push(T.console);
  }
  for (let i = 0; i < notes.length; i++) if (!notes[i].found) list.push(T.notes[i]);
  return list;
}

function nearestTarget() {
  let best = null, bestScore = Infinity;
  _aim.set(0, 0, -1).applyQuaternion(camera.quaternion);
  for (const t of targets()) {
    _toTarget.subVectors(t.p, camera.position);
    const distance = _toTarget.length();
    if (distance >= t.range) continue;
    const dot = distance > 1e-6 ? _aim.dot(_toTarget.multiplyScalar(1 / distance)) : 1;
    if (dot > (distance < 1.25 ? -0.2 : 0.24) && lineClear(camera.position, t.p)) {
      const score = distance * (1.2 - dot * 0.5);
      if (score < bestScore) {
        best = t;
        bestScore = score;
      }
    }
  }
  return best;
}

function updateInteraction(dt) {
  const t = nearestTarget();
  if (!t || !interactTarget || t.id !== interactTarget.id) interactProgress = 0;
  interactTarget = t;
  const holding = actDown('interact');
  // After an action completes, the button has to be let go before the next one starts.
  if (!holding) useLatch = false;
  if (t && holding && !useLatch) {
    interactProgress += dt;
    if (interactProgress >= t.time) {
      activate(t);
      interactProgress = 0;
      useLatch = true;
      interactTarget = null;
      audio.click();
      input.rumble(0.2, 60);
    }
  } else interactProgress = 0;
  setStyle(el.interactionFill, 'width', `${t ? Math.min(100, (interactProgress / t.time) * 100).toFixed(1) : 0}%`);
}

function activate(t) {
  if (t.type === 'crew') {
    const c = crew[t.i];
    c.status = 'linked';
    c.v.set(0, 0, 0);
    c.stuck = 0;
    if (!breadcrumbs.length) breadcrumbs.push(player.p.clone());
    audio.tone(660, 0.13, 0.1);
    toast(`${c.name.toUpperCase()} / HARNESS LINKED`, 2.5);
  } else if (t.type === 'test') {
    session.tested = true;
    say('ARTHUR', 'No fall. No kick. The lift can supply the force instead.', 6);
    // The weight is released and should drop onto the plate. It floats away instead.
    testWeight.held = false;
    testWeight.v.set(0.05, 0.42, 0.12);
    audio.tone(300, 0.5, 0.08, 'sine', 180);
    toast('DROP TEST FAILED / GRAVITY REQUIRED', 4);
  } else if (t.type === 'lift') {
    session.liftUnlocked = true;
    audio.noise(0.45, 0.16, 350);
    audio.tone(440, 0.3, 0.12);
    toast('SERVICE LIFT / MANUAL ACCESS', 3);
  } else if (t.type === 'secure') {
    if (crew.some((c) => c.status === 'linked' && c.p.distanceTo(LIFT_SECURE_POINT) > 8.5)) {
      toast('WAIT FOR THE TEAM / KEEP THE LINE CLEAR', 3);
      return;
    }
    const n = crew.filter((c) => c.status === 'linked').length;
    crew.forEach((c) => {
      if (c.status === 'linked') {
        c.status = 'secured';
        c.v.set(0, 0, 0);
      }
    });
    audio.success();
    toast(`${n} HARNESSES SECURED`, 3);
    if (crew.every((c) => c.status === 'secured')) {
      session.phase = 'rig';
      session.phaseTime = 0;
      say('ARTHUR', 'The lift becomes the kick. Fit the impulse unit, then release the brake.', 7);
      banner('03 / MAKE THE KICK', 'Create the fall.', 'Prepare the lift. Match the signal from above.', 5);
      saveCheckpoint('Team secured');
    }
  } else if (t.type === 'kit') {
    session.kit = true;
    kitVisual.visible = false;
    toast('IMPULSE UNIT / READY TO FIT', 3);
    audio.tone(740, 0.12, 0.1);
  } else if (t.type === 'unit') {
    session.unit = true;
    unitVisual.visible = true;
    audio.success();
    saveCheckpoint('Impulse unit fitted');
    say('ARTHUR', 'Drive connected. Release the brake on the opposite wall.', 5);
  } else if (t.type === 'brake') {
    session.brake = true;
    brakeVisual.rotation.x = Math.PI / 2;
    audio.noise(0.35, 0.25, 420);
    saveCheckpoint('Ready for the kick');
    say('YUSUF', 'Listen for the signal. We have to wake together.', 5);
  } else if (t.type === 'console') beginSync();
  else if (t.type === 'note') {
    notes[t.i].found = true;
    notes[t.i].mesh.visible = false;
    session.notes++;
    audio.tone(770, 0.3, 0.08);
    say('MEMORY FRAGMENT', NOTE_LINES[t.i] || NOTE_LINES[0], 6);
    toast(`MEMORY ${session.notes} / ${notes.length}`, 3);
  }
  updateHUD();
}

/* ================================================================ the kick */

function syncKey() {
  return input.source === 'touch' ? 'TAP' : g('confirm');
}
function beginSync() {
  if (!session.unit || !session.brake || !crew.every((c) => c.status === 'secured')) return;
  // The timing panel stops the world, so hotel security has to be dealt with first.
  if (securityLive()) {
    toast('SECURITY STILL ON THE LINE / STOP THEM FIRST', 3);
    say('YUSUF', 'Not with security on the line. Stop them, then we go.', 4);
    return;
  }
  sync = { stage: 'align', time: 0, pulse: 0, locks: 0, cooldown: 0, timer: 12, lastSecond: 13, paused: false };
  setMode('sync');
  releasePointer();
  player.v.set(0, 0, 0);
  $('sync-feedback').textContent = 'Four sleepers. One shared kick.';
  $('cancel-sync').classList.remove('hidden');
  updateSyncUI();
  audio.click();
}
function syncWindow() {
  return options.timingAssist ? 0.31 : difficulty[session.difficulty].window;
}
function kickWindow() {
  return options.timingAssist ? 3.5 : 2.1;
}
function tapSync() {
  if (mode !== 'sync' || !sync || sync.paused || sync.cooldown > 0) return;
  sync.cooldown = 0.28;
  if (sync.stage === 'align') {
    if (Math.abs(sync.pulse - 0.5) <= syncWindow() / 2) {
      sync.locks++;
      audio.tone(530 + sync.locks * 160, 0.3, 0.16, 'sine');
      input.rumble(0.2, 60);
      $('sync-feedback').textContent = `SIGNAL ${sync.locks} / 3 LOCKED`;
      sync.time = 0;
      sync.pulse = 0;
      sync.cooldown = 0.4;
      if (sync.locks === 3) {
        sync.stage = 'countdown';
        sync.timer = 12;
        sync.lastSecond = 13;
        say('YUSUF', 'Signal locked. Wait for it. We all go together.', 6);
        $('sync-feedback').textContent = 'WAIT FOR THE GREEN ZONE';
        audio.success();
      }
    } else {
      session.syncMisses++;
      audio.tone(130, 0.23, 0.13, 'triangle', 65);
      $('sync-feedback').textContent = 'OUT OF PHASE / TRY THE NEXT PASS';
    }
  } else if (sync.stage === 'countdown') {
    if (sync.timer <= kickWindow() && sync.timer > 0) triggerKick();
    else {
      session.syncMisses++;
      audio.tone(180, 0.2, 0.1, 'triangle', 85);
      $('sync-feedback').textContent = 'TOO EARLY / WAIT FOR THE GREEN ZONE';
      sync.cooldown = 0.7;
    }
  }
  updateSyncUI();
}
function updateSync(dt) {
  if (!sync || sync.paused) return;
  sync.cooldown = Math.max(0, sync.cooldown - dt);
  if (sync.stage === 'align') {
    sync.time += dt;
    sync.pulse = (sync.time / (2.6 - sync.locks * 0.23)) % 1;
  } else if (sync.stage === 'countdown') {
    sync.timer -= dt;
    sync.pulse = 1 - sync.timer / 12;
    const sec = Math.ceil(sync.timer);
    if (sec !== sync.lastSecond) {
      sync.lastSecond = sec;
      audio.tone(sec <= 3 ? 890 : 490, 0.13, 0.1, 'sine');
      if (sec === 3) say('YUSUF', 'Now. Take the kick.', 3);
    }
    if (sync.timer <= 0) {
      session.syncMisses++;
      finish(false, 'The signal passed. The team fell out of sync.');
    }
  }
  updateSyncUI();
}
function updateSyncUI() {
  if (!sync) return;
  const count = sync.stage === 'countdown';
  setText($('sync-title'), count ? 'Wait for the kick.' : 'Match the signal.');
  const key = syncKey();
  setText(
    $('sync-instruction'),
    count
      ? 'Trigger the lift when the countdown reaches the bright zone.'
      : input.source === 'touch'
        ? 'Tap the button when the marker is in the bright zone.'
        : `Press ${key} when the marker is in the bright zone.`
  );
  setText($('sync-readout'), count ? 'IMPACT IN' : 'SYNC');
  setText($('sync-number'), count ? Math.max(0, sync.timer).toFixed(1) : String(Math.min(3, sync.locks + 1)).padStart(2, '0'));
  setText($('sync-unit'), count ? 'SEC' : '/ 03');
  setText($('sync-label'), count ? 'TRIGGER KICK' : 'MATCH SIGNAL');
  setText($('sync-key'), key);
  const windowSize = count ? kickWindow() / 12 : syncWindow();
  setStyle($('sync-zone'), 'left', `${((count ? 1 - windowSize : 0.5 - windowSize / 2) * 100).toFixed(2)}%`);
  setStyle($('sync-zone'), 'width', `${(windowSize * 100).toFixed(2)}%`);
  setStyle($('sync-needle'), 'left', `${clamp(sync.pulse * 100, 0, 100).toFixed(2)}%`);
  document.querySelectorAll('.sync-locks i').forEach((n, i) => n.classList.toggle('done', i < sync.locks));
  const open = count && sync.timer <= kickWindow();
  if (open) setText($('sync-feedback'), input.source === 'touch' ? 'KICK WINDOW OPEN / TAP NOW' : `KICK WINDOW OPEN / PRESS ${key}`);
  setStyle($('sync-number'), 'color', open ? 'var(--mint)' : 'var(--paper)');
}
function triggerKick() {
  sync = null;
  session.phase = 'kick';
  session.ending = 0;
  setMode('playing');
  player.v.set(0, 0, 0);
  player.p.set(0, 1.9, -46.1);
  player.pitch = 0.04;
  player.yaw = 0;
  trauma = 1;
  say('ARTHUR', 'Together.', 2.5);
  banner('KICK INITIATED', 'Hold on.', '', 2.5);
  audio.noise(1.0, 0.7, 650);
  audio.tone(42, 1.8, 0.32, 'sawtooth', 170);
  input.rumble(1, 900);
  releasePointer();
}

function finish(win, reason = 'The projections reached you. Your team still needs you.') {
  if (mode === 'ended') return;
  if (session.endurance) {
    finishEndurance(false);
    return;
  }
  lastRun = 'story';
  setMode('ended');
  sync = null;
  el.syncScreen.classList.add('hidden');
  setStyle(el.whiteout, 'opacity', '0');
  $('end-eyebrow').textContent = win ? 'EXTRACTION COMPLETE / LEVEL 02' : 'DREAM CONNECTION LOST';
  $('end-title').textContent = win ? 'One level closer.' : 'The dream broke.';
  if (win) $('end-description').innerHTML = 'The plan broke. You did not.<br>All four sleepers made the kick.';
  else $('end-description').textContent = reason;
  $('end-screen').querySelector('.end-symbol').textContent = win ? '↗' : '×';
  $('end-retry').classList.toggle('hidden', win);
  $('end-replay').innerHTML = win ? 'ENTER ANOTHER DREAM <span>→</span>' : 'START A NEW MISSION <span>→</span>';
  const count = crew.filter((c) => c.status === 'secured').length;
  const met = 3 + (session.ambush ? SECURITY_COUNT : 0);
  $('result-stats').innerHTML = `<div><b>${formatTime(session.time)}</b><span>MISSION TIME</span></div><div><b>${win ? 4 : count} / 4</b><span>TEAM SECURED</span></div><div><b>${session.kills + session.securityDown} / ${met}</b><span>THREATS STOPPED</span></div>`;

  const earned = [];
  if (win) earned.push(['SAFE PASSAGE', 'SAFE PASSAGE']);
  if (session.adapted) earned.push(['ADAPTED TO GRAVITY', 'ADAPTED TO GRAVITY']);
  if (session.blocks > 0) earned.push(['PERFECT BLOCK', `${session.blocks} PERFECT BLOCK${session.blocks > 1 ? 'S' : ''}`]);
  if (win && session.syncMisses === 0) earned.push(['PERFECT SYNC', 'PERFECT SYNC']);
  if (session.notes >= notes.length) earned.push(['CLEAR MEMORY', 'CLEAR MEMORY']);
  if (win && session.hits === 0) earned.push(['UNTOUCHABLE', 'UNTOUCHABLE']);
  if (session.ambushClear && session.ambushHits === 0) earned.push(['LINE HELD', 'LINE HELD']);

  const record = readRecord();
  const had = new Set(record.badges);
  $('result-badges').innerHTML = earned.map(([key, text]) => `<span class="${had.has(key) ? '' : 'new'}">${text}${had.has(key) ? '' : ' / NEW'}</span>`).join('');
  for (const [key] of earned) had.add(key);
  record.badges = BADGES.filter((b) => had.has(b));

  const diffKey = session.difficulty;
  const prev = record.byDiff[diffKey] || {};
  const prevBest = Number.isFinite(prev.best) && prev.best > 0 ? prev.best : 0;
  const recordEl = $('result-record');
  recordEl.classList.remove('new');
  recordEl.textContent = '';
  if (win) {
    session.phase = 'complete';
    const isNew = !prevBest || session.time < prevBest;
    record.byDiff[diffKey] = { best: isNew ? session.time : prevBest, runs: (prev.runs | 0) + 1 };
    record.best = Math.min(record.best || Infinity, session.time);
    record.runs += 1;
    recordEl.classList.toggle('new', isNew);
    recordEl.textContent = isNew
      ? prevBest
        ? `NEW BEST ON ${DIFF_LABEL[diffKey]} / WAS ${formatTime(prevBest)}`
        : `FIRST EXTRACTION ON ${DIFF_LABEL[diffKey]}`
      : `BEST ON ${DIFF_LABEL[diffKey]} / ${formatTime(prevBest)}`;
    storage.remove(STORE);
    audio.success();
  } else {
    if (prevBest) recordEl.textContent = `BEST ON ${DIFF_LABEL[diffKey]} / ${formatTime(prevBest)}`;
    audio.tone(90, 0.9, 0.13, 'sine', 30);
  }
  storage.set(RECORD, record);
}

/* ================================================================ HUD */

function missionGoal() {
  if (session.phase === 'combat' || securityLive()) {
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (e.hp <= 0 || !e.activated) continue;
      const d = e.p.distanceTo(player.p);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best ? { p: best.p.clone().addScaledVector(gUp(), 1.1), label: best.kind === 'security' ? 'SECURITY' : 'PROJECTION' } : null;
  }
  if (session.phase === 'rescue') {
    const sleeping = crew.filter((c) => c.status === 'sleeping');
    if (sleeping.length) {
      if (player.p.x < 4.6) return { p: V(3.75, 2, -24), label: 'SUITE 528' };
      const c = sleeping.sort((a, b) => a.p.distanceTo(player.p) - b.p.distanceTo(player.p))[0];
      return { p: c.p.clone(), label: c.name.toUpperCase() };
    }
    if (player.p.x > 4.7) return { p: V(3.6, 1.8, -24), label: 'RETURN TO THE HALL' };
    return session.liftUnlocked ? { p: V(0, 1.7, -44.1), label: 'SECURE THE TEAM' } : { p: V(2.5, 1.7, -41.6), label: 'SERVICE LIFT' };
  }
  if (session.phase === 'rig') {
    const t = targets().find((x) => ['kit', 'unit', 'brake', 'console'].includes(x.type));
    return t ? { p: t.p.clone(), label: { kit: 'IMPULSE UNIT', unit: 'LIFT DRIVE', brake: 'BRAKE RELEASE', console: 'KICK CONTROL' }[t.type] } : null;
  }
  return null;
}

function projectUI(node, p, edge = false) {
  _toTarget.subVectors(p, camera.position);
  _aim.set(0, 0, -1).applyQuaternion(camera.quaternion);
  const front = _toTarget.dot(_aim) > 0;
  const q = _toTarget.copy(p).project(camera);
  let x = (q.x * 0.5 + 0.5) * innerWidth, y = (-q.y * 0.5 + 0.5) * innerHeight;
  if (!front || q.z > 1) {
    if (!edge) {
      node.classList.add('hidden');
      return false;
    }
    x = innerWidth * 0.5;
    y = innerHeight * 0.72;
  } else if (edge) {
    x = clamp(x, 85, innerWidth - 85);
    y = clamp(y, innerHeight * 0.31, innerHeight * 0.72);
  } else if (x < 15 || x > innerWidth - 15 || y < 30 || y > innerHeight - 70) {
    node.classList.add('hidden');
    return false;
  }
  node.classList.remove('hidden');
  node.style.left = `${x.toFixed(1)}px`;
  node.style.top = `${y.toFixed(1)}px`;
  return front;
}

let stripKey = '';
function renderControlStrip() {
  const zero = gravityStrength < 0.15;
  const key = `${input.source}${zero ? 'z' : 'n'}`;
  if (key === stripKey) return;
  stripKey = key;
  const items = zero
    ? [['move', 'LINE MOVE'], ['rise,lower', 'RISE / LOWER'], ['brace', 'BRAKE'], ['interact', 'HOLD TO USE'], ['plan', 'PLAN'], ['pause', 'PAUSE']]
    : [['move', 'MOVE'], ['strike', 'STRIKE'], ['brace', 'BRACE'], ['shove', 'SHOVE'], ['plan', 'PLAN'], ['pause', 'PAUSE']];
  el.controlStrip.innerHTML = items.map(([a, text]) => `<span><kbd>${a.split(',').map(g).join(' / ')}</kbd> ${text}</span>`).join('');
}

/** Every key hint on the page follows the device in hand: keyboard, controller or touch. */
function refreshPrompts() {
  for (const k of document.querySelectorAll('[data-g]')) setText(k, k.dataset.g.split(',').map(g).join(' / '));
  setText(el.interactionKey, g('interact'));
  setText($('sync-key'), syncKey());
  stripKey = '';
  renderControlStrip();
  if (sync) updateSyncUI();
}

function updateHUD() {
  if (!session) return;
  const phase = session.phase;
  let linked = 0, secured = 0;
  for (const c of crew) {
    if (c.status === 'linked') linked++;
    else if (c.status === 'secured') secured++;
  }
  const found = linked + secured;
  const hunted = securityLive() && (phase === 'rescue' || phase === 'rig');
  let chapter, objective, sub;
  if (phase === 'combat' && session.endurance) {
    chapter = `ENDURANCE / WAVE ${String(session.wave).padStart(2, '0')}`;
    objective = 'Hold the hall.';
    sub = `${session.kills} projection${session.kills === 1 ? '' : 's'} stopped. ${formatTime(session.time)} held.`;
  } else if (phase === 'combat') {
    chapter = '01 / HOLD THE HALL';
    objective = 'Protect the sleeping team.';
    const left = 3 - session.kills;
    sub = `${left} hostile projection${left === 1 ? '' : 's'} remain. Use the walls.`;
  } else if (hunted) {
    chapter = phase === 'rig' ? '03 / MAKE THE KICK' : '02 / BRING THEM HOME';
    objective = 'Stop the hotel security.';
    const left = SECURITY_COUNT - session.securityDown;
    sub = `${left} security projection${left === 1 ? '' : 's'} left. Strikes push them. A wall stops them.`;
  } else if (phase === 'rescue') {
    chapter = '02 / BRING THEM HOME';
    if (found < 4) {
      objective = session.discovered ? 'Link the sleeping team.' : 'Reach suite 528.';
      sub = session.discovered ? `${found} / 4 harnesses linked. Hold ${g('interact')} near each sleeper.` : 'The door is open. The mission is not over.';
    } else {
      objective = 'Bring everyone to the lift.';
      sub = player.p.x > 4.7 ? 'Leave the suite. Turn right in the hall.' : session.liftUnlocked ? `Enter the lift. Hold ${g('interact')} to secure the harnesses.` : 'Go to the end of the hall. Open the service lift.';
    }
  } else if (phase === 'rig') {
    chapter = '03 / MAKE THE KICK';
    objective = !session.kit ? 'Collect the impulse unit.' : !session.unit ? 'Give the lift a kick.' : !session.brake ? 'Release the lift brake.' : 'Match the signal from above.';
    sub = !session.kit ? 'The emergency kit is just inside the lift.' : !session.unit ? 'Fit the unit to the drive on the right wall.' : !session.brake ? 'Use the handle on the opposite wall.' : 'Use the rear control panel to synchronize.';
  } else {
    chapter = '04 / WAKE TOGETHER';
    objective = 'One team. One kick.';
    sub = 'Wait for the signal from the level above.';
  }
  setText(el.chapter, chapter);
  setText(el.objective, objective);
  setText(el.sub, sub);
  const progress = phase === 'combat' ? (session.endurance ? session.kills % 3 : session.kills) : phase === 'rescue' ? found : session.brake ? 4 : session.unit ? 3 : session.kit ? 2 : 1;
  el.progress.forEach((n, i) => n.classList.toggle('done', i < progress));
  el.progress[3].classList.toggle('hidden', !!session.endurance); // a wave is three projections
  setText(el.healthValue, String(Math.ceil(player.health)).padStart(3, '0'));
  setStyle(el.healthBar, 'width', `${player.health.toFixed(1)}%`);
  setStyle(el.healthBar, 'background', player.health < 30 ? 'var(--red)' : '#c5d4bc');
  setStyle(el.staminaBar, 'width', `${player.stamina.toFixed(1)}%`);
  setText(el.movement, gravityStrength < 0.15 ? (isBracing() ? '■ LINE BRAKE' : '↔ SAFETY LINE') : isBracing() ? '■ BRACED' : player.grounded ? '● SURFACE CONTACT' : '↓ FALLING');
  setText(el.teamCounter, `${secured} / 4`);
  el.pips.forEach((node, i) => {
    node.classList.toggle('linked', crew[i].status === 'linked');
    node.classList.toggle('secured', crew[i].status === 'secured');
  });
  setText(el.equipment, secured === 4 ? 'ALL HARNESSES SECURED' : linked ? `${linked} LINKED / ${secured} SECURED` : 'NO TEAM LINKED');
  const e = activeEvent || vanEvents[0];
  setText(el.vanEvent, phase === 'kick' ? 'WATER IMPACT' : e.label);
  setText(el.vanMode, e.detail);
  setText(el.gravityValue, `${(gravityStrength < 0.03 ? 0 : gravityStrength).toFixed(2)} G`);
  setStyle(el.gravityArrow, 'transform', `rotate(${((-gravityAngle * 180) / Math.PI).toFixed(1)}deg)`);
  setStyle(el.gravityArrow, 'opacity', gravityStrength < 0.1 ? '0.25' : '1');
  const t = interactTarget;
  el.interaction.classList.toggle('hidden', !t || mode !== 'playing');
  el.crosshair.classList.toggle('target', !!t);
  if (t) {
    setText(el.interactionTitle, t.title);
    setText(el.interactionDetail, t.detail);
  }
  const goal = missionGoal();
  if (goal && mode === 'playing' && !t) {
    const dist = goal.p.distanceTo(player.p);
    if ((phase === 'combat' || hunted) && dist < 6) el.targetMarker.classList.add('hidden');
    else {
      const front = projectUI(el.targetMarker, goal.p, true);
      setText(el.targetMarker.querySelector('b'), front ? goal.label : `TURN / ${goal.label}`);
      setText(el.targetMarker.querySelector('small'), `${Math.round(dist)} M`);
    }
  } else el.targetMarker.classList.add('hidden');
  let near = null, nearDist = 13;
  for (const en of enemies) {
    if (en.hp <= 0 || !en.activated) continue;
    const d = en.p.distanceTo(player.p);
    if (d < nearDist) {
      nearDist = d;
      near = en;
    }
  }
  if (near && mode === 'playing') {
    _desired.copy(near.p).addScaledVector(gUp(), 1.38);
    projectUI(el.enemyTag, _desired);
    setStyle(el.enemyTag.querySelector('i'), 'width', `${clamp((near.hp / near.maxHp) * 100, 0, 100).toFixed(1)}%`);
    setText(el.enemyTag.querySelector('span'), near.state === 'windup' ? 'ATTACK INCOMING / BRACE' : near.kind === 'security' ? 'SECURITY PROJECTION' : 'HOSTILE PROJECTION');
  } else el.enemyTag.classList.add('hidden');
  renderControlStrip();
  drawVan();
}

function drawVan() {
  const ctx = vanCtx, w = el.vanView.width, h = el.vanView.height, t = session?.time || clockTime;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#142522';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#89b69a12';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 25) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const falling = session && session.phase !== 'combat';
  ctx.fillStyle = '#20372d';
  for (let i = 0; i < 9; i++) {
    const x = (((i * 73 - t * (falling ? 3 : 35)) % 650) + 650) % 650 - 75, height = 25 + ((i * 29) % 50);
    ctx.fillRect(x, 130 - height, 43, height);
    ctx.fillStyle = '#80a28a23';
    ctx.fillRect(x + 8, 136 - height, 5, 8);
    ctx.fillRect(x + 23, 150 - height, 5, 8);
    ctx.fillStyle = '#20372d';
  }
  ctx.fillStyle = '#0e1b1b';
  ctx.fillRect(0, 137, w, 55);
  ctx.strokeStyle = '#81ac9163';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 138);
  ctx.lineTo(falling ? 105 : w, 138);
  if (falling) {
    ctx.moveTo(400, 138);
    ctx.lineTo(500, 138);
  }
  ctx.stroke();
  ctx.strokeStyle = '#bcbd8844';
  ctx.setLineDash([24, 25]);
  ctx.lineDashOffset = t * 40;
  ctx.beginPath();
  ctx.moveTo(0, 158);
  ctx.lineTo(falling ? 105 : w, 158);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(255, falling ? 92 + Math.sin(t * 0.9) * 7 : 110 + Math.sin(t * 12) * 0.9);
  ctx.rotate(falling ? 0.17 + Math.sin(t * 0.25) * 0.13 : -gravityAngle * 0.76);
  ctx.fillStyle = '#0a1716';
  ctx.beginPath();
  ctx.ellipse(4, 27, 66, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b927c';
  ctx.beginPath();
  ctx.moveTo(-60, -25);
  ctx.lineTo(27, -25);
  ctx.lineTo(53, -7);
  ctx.lineTo(60, 16);
  ctx.lineTo(-60, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9aba92';
  ctx.beginPath();
  ctx.moveTo(-61, -25);
  ctx.lineTo(-48, -33);
  ctx.lineTo(30, -33);
  ctx.lineTo(27, -25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#32594e';
  ctx.beginPath();
  ctx.moveTo(29, -25);
  ctx.lineTo(40, -29);
  ctx.lineTo(63, -9);
  ctx.lineTo(53, -7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8d7a9';
  ctx.beginPath();
  ctx.moveTo(8, -20);
  ctx.lineTo(25, -20);
  ctx.lineTo(42, -8);
  ctx.lineTo(8, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#a4c0a0';
  ctx.fillRect(-49, -20, 23, 15);
  ctx.fillRect(-22, -20, 22, 15);
  ctx.fillStyle = '#435e4b';
  ctx.fillRect(-60, 7, 116, 5);
  ctx.fillStyle = '#e5ce95';
  ctx.fillRect(51, -1, 7, 7);
  ctx.fillStyle = '#ba8664';
  ctx.fillRect(-62, 0, 4, 8);
  [-38, 36].forEach((x) => {
    ctx.fillStyle = '#0c1c1b';
    ctx.beginPath();
    ctx.arc(x, 16, 12, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#85a28a';
    ctx.beginPath();
    ctx.arc(x, 16, 5, 0, 7);
    ctx.fill();
  });
  ctx.restore();
  if (falling) {
    ctx.strokeStyle = '#d8bd8490';
    ctx.beginPath();
    ctx.moveTo(343, 61);
    ctx.lineTo(343, 121);
    ctx.lineTo(337, 114);
    ctx.moveTo(343, 121);
    ctx.lineTo(349, 114);
    ctx.stroke();
    ctx.fillStyle = '#d8bd84';
    ctx.font = '12px monospace';
    ctx.fillText('FREE FALL', 361, 93);
  } else {
    ctx.strokeStyle = '#b4c59755';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(101 - i * 10, 79 + i * 15);
      ctx.lineTo(153 - i * 10, 79 + i * 15);
      ctx.stroke();
    }
  }
  ctx.font = '10px monospace';
  ctx.fillStyle = '#82a48c';
  ctx.fillText('VAN / UPLINK 01', 14, 20);
  ctx.fillStyle = '#bcbd86';
  ctx.fillText(falling ? 'AIRBORNE' : 'LIVE', w - 75, 20);
  ctx.strokeStyle = '#d0d8ad55';
  ctx.strokeRect(7, 7, w - 14, h - 14);
}

function showPlan() {
  if (mode !== 'playing' || session.phase === 'kick') return;
  setMode('plan');
  drawMap();
  const secured = crew.filter((c) => c.status === 'secured').length;
  const linked = crew.filter((c) => c.status !== 'sleeping').length;
  let items;
  if (session.endurance) {
    const best = readRecord().endurance[session.difficulty];
    const toGo = 3 - (session.kills % 3);
    items = [
      ['Hold the hall', false, `${formatTime(session.time)} held / ${session.kills} stopped`],
      [`Reach wave ${session.wave + 1}`, false, `${toGo} more projection${toGo === 1 ? '' : 's'} to stop`],
      ['Beat your longest hold', !!best && session.time > best.time, best ? `${formatTime(best.time)} on ${DIFF_LABEL[session.difficulty]}` : 'No run recorded on this difficulty yet'],
    ];
  } else {
    items = [
      ['Hold the hall', session.kills === 3, `${session.kills} / 3 threats stopped`],
      ['Find the sleeping team', session.discovered, 'Suite 528'],
      ['Link the harnesses', linked === 4, `${linked} / 4 linked`],
    ];
    if (session.ambush) items.push(['Stop hotel security', session.ambushClear, `${session.securityDown} / ${SECURITY_COUNT} stopped`]);
    items.push(['Secure the team', secured === 4, `${secured} / 4 in the lift`], ['Prepare the lift', session.unit && session.brake, 'Impulse unit + brake release'], ['Match the kick', false, 'Rear control panel']);
  }
  let active = false;
  $('plan-checklist').innerHTML = items
    .map(([name, done, sub], i) => {
      const current = !done && !active;
      if (current) active = true;
      return `<div class="${done ? 'done' : current ? 'active' : ''}"><b>${done ? '✓' : String(i + 1).padStart(2, '0')}</b><span>${name}<small>${sub}</small></span></div>`;
    })
    .join('');
  const log = $('radio-log');
  log.textContent = '';
  for (const r of radioLog.slice(-3)) {
    const row = document.createElement('div');
    const who = document.createElement('b');
    who.textContent = r.speaker;
    row.append(who, r.text);
    log.append(row);
  }
}

function drawMap() {
  const c = $('map-view'), x = c.getContext('2d');
  x.fillStyle = '#0d2422';
  x.fillRect(0, 0, c.width, c.height);
  x.strokeStyle = '#8bc2a718';
  x.lineWidth = 1;
  for (let n = 0; n < 650; n += 25) {
    x.beginPath();
    x.moveTo(n, 0);
    x.lineTo(n, 350);
    x.stroke();
  }
  for (let n = 0; n < 350; n += 25) {
    x.beginPath();
    x.moveTo(0, n);
    x.lineTo(650, n);
    x.stroke();
  }
  const p = (wx, wz) => ({ x: 50 + (12 - wz) * 8.6, y: 268 - (wx + 4) * 13 });
  x.strokeStyle = '#94b996';
  x.fillStyle = '#27483b';
  x.lineWidth = 2;
  x.fillRect(50, 164, 482, 104);
  x.strokeRect(50, 164, 482, 104);
  x.fillRect(308, 34, 129, 132);
  x.strokeRect(308, 34, 129, 132);
  x.fillRect(514, 177, 67, 78);
  x.strokeRect(514, 177, 67, 78);
  x.fillStyle = '#172e29';
  for (let i = 0; i < 6; i++) {
    x.fillRect(80 + i * 68, 274, 30, 19);
    if (i !== 4) x.fillRect(80 + i * 68, 139, 30, 19);
  }
  x.fillStyle = '#e2c092';
  x.font = '13px monospace';
  x.fillText('SUITE 528', 325, 63);
  x.font = '11px monospace';
  x.fillText('SERVICE', 521, 308);
  x.fillText('LIFT', 535, 324);
  x.fillStyle = '#aac3a0';
  x.fillText('THE MERIDIAN / LEVEL 02', 28, 24);
  x.font = '9px monospace';
  x.fillText(`MEMORY FRAGMENTS  ${session.notes} / ${notes.length}`, 27, 328);
  crew.forEach((cr) => {
    const q = p(cr.p.x, cr.p.z);
    x.fillStyle = cr.status === 'secured' ? '#ace2b6' : cr.status === 'linked' ? '#e3b783' : '#93ac92';
    x.fillRect(q.x - 4, q.y - 4, 8, 8);
  });
  enemies.forEach((e) => {
    if (e.hp <= 0 || !e.activated) return;
    const q = p(e.p.x, e.p.z);
    x.fillStyle = e.kind === 'security' ? '#e0a060' : '#c77756';
    x.beginPath();
    x.arc(q.x, q.y, 4, 0, 7);
    x.fill();
  });
  const q = p(player.p.x, player.p.z);
  x.save();
  x.translate(q.x, q.y);
  x.rotate(-player.yaw);
  x.fillStyle = '#f0e1b8';
  x.beginPath();
  x.moveTo(8, 0);
  x.lineTo(-5, -5);
  x.lineTo(-3, 0);
  x.lineTo(-5, 5);
  x.closePath();
  x.fill();
  x.restore();
  x.strokeStyle = '#f0e1b869';
  x.beginPath();
  x.arc(q.x, q.y, 11, 0, 7);
  x.stroke();
}

/* ================================================================ camera */

function updateCamera(dt, title = false) {
  if (title) {
    camera.fov = 67;
    camera.position.set(1.56 + Math.sin(clockTime * 0.16) * 0.035, 1.74 + Math.sin(clockTime * 0.3) * 0.016, 8.25);
    camera.up.set(0, 1, 0);
    camera.lookAt(-1.5, 1.7, -16.5);
    camera.rotateZ(-0.015);
    hands.visible = false;
  } else {
    camera.fov = damp(camera.fov, options.fov, 5, dt);
    viewRoll += wrap((gravityStrength < 0.1 ? 0 : gravityAngle) - viewRoll) * (1 - Math.exp(-(options.reduceMotion ? 1.8 : 3.3) * dt));
    _euler.set(player.pitch, player.yaw, 0, 'YXZ');
    camera.quaternion.setFromAxisAngle(ZAXIS, viewRoll).multiply(_quatA.setFromEuler(_euler));
    const up = gUp();
    camera.position.copy(player.p).addScaledVector(up, 0.58);
    const speed = player.v.length();
    const bob = options.reduceMotion ? 0 : player.grounded && gravityStrength > 0.4 ? Math.sin(session.time * speed * 2.1) * Math.min(0.018, speed * 0.004) : Math.sin(session.time * 0.8) * 0.005;
    camera.position.addScaledVector(up, bob);
    if (!options.reduceMotion && trauma > 0) {
      camera.rotateX(Math.sin(clockTime * 59) * trauma * 0.021);
      camera.rotateZ(Math.cos(clockTime * 51) * trauma * 0.025);
    }
    const jab = attackAnim > 0 ? Math.sin((1 - attackAnim) * Math.PI) : 0;
    const shove = shoveAnim > 0 ? Math.sin((1 - shoveAnim) * Math.PI) : 0;
    const brace = isBracing() ? 1 : 0;
    handR.position.set(0.35 - jab * 0.17, -0.48 + jab * 0.18 + brace * 0.18 + shove * 0.1, -0.66 - jab * 0.36 - shove * 0.24);
    handL.position.set(-0.35 + brace * 0.09, -0.48 + brace * 0.2 + shove * 0.1, -0.66 - shove * 0.24);
    handR.rotation.x = 0.29 - jab * 0.7 - brace * 0.4;
    handL.rotation.x = 0.29 - brace * 0.7;
    hands.position.y = options.reduceMotion ? 0 : bob * 0.5;
    hands.rotation.z = options.reduceMotion ? 0 : Math.sin(session.time * 1.3) * 0.006;
  }
  guideLine.visible = !title && gravityStrength < 0.15 && mode !== 'ended';
  if (guideLine.visible) {
    _from.set(-0.38, -0.17, -0.62).applyQuaternion(camera.quaternion).add(camera.position);
    _anchor.set(player.p.x > 0 ? 3.86 : -3.86, 1.27, player.p.z - 2.5);
    if (player.p.x > 4.0) _anchor.set(13.82, 1.8, clamp(player.p.z - 2, -32, -19));
    if (player.p.z < -42.5) _anchor.set(-2.96, 1.15, player.p.z - 0.9);
    const a = guideLine.geometry.attributes.position;
    a.setXYZ(0, _from.x, _from.y, _from.z);
    a.setXYZ(1, _anchor.x, _anchor.y, _anchor.z);
    a.needsUpdate = true;
  }
  camera.updateProjectionMatrix();
  playerLamp.position.copy(camera.position);
  playerLamp.position.y += 1.3;
  playerLamp.position.z += 0.7;
  playerLamp.target.position.set(0, 0, -8).applyQuaternion(camera.quaternion).add(camera.position);
}

/* ================================================================ the loop */

function update(dt) {
  session.time += dt;
  session.phaseTime += dt;
  attackCooldown = Math.max(0, attackCooldown - dt);
  attackAnim = Math.max(0, attackAnim - dt * 3.4);
  shoveAnim = Math.max(0, shoveAnim - dt * 2.2);
  trauma = damp(trauma, 0, 4, dt);
  damageOpacity = damp(damageOpacity, 0, 3, dt);
  hitOpacity = damp(hitOpacity, 0, 8, dt);
  if (session.phase === 'kick') {
    session.ending += dt;
    trauma = 0.7;
    player.p.y = 1.18 + Math.sin(session.ending * 5) * 0.17;
    setStyle(el.whiteout, 'opacity', clamp((session.ending - 1.1) / 1.2, 0, 1).toFixed(3));
    if (session.ending > 2.65) finish(true);
    updateCamera(dt);
    return;
  }
  updateGravity(dt);
  updatePlayer(dt);
  if (mode !== 'playing') return;
  updateEnemies(dt);
  if (mode !== 'playing') return; // a strike just ended the mission
  updateProps(dt);
  updateCrew(dt);
  updateCamera(dt);
  updateInteraction(dt);
  if (mode !== 'playing') return;
  if (pressed('shove')) attack(true);
  if (actDown('strike')) attack();
  audio.pulse(dt, fighting());
}

function updateMessages(dt) {
  subtitleTime -= dt;
  toastTime -= dt;
  centerTime -= dt;
  if (subtitleTime <= 0) el.subtitle.classList.remove('show');
  if (toastTime <= 0) el.toast.classList.remove('show');
  if (centerTime <= 0) el.center.classList.remove('show');
  setStyle(el.damageFlash, 'opacity', damageOpacity.toFixed(2));
  setStyle(el.hitMarker, 'opacity', hitOpacity.toFixed(2));
}

/** Gameplay-level buttons that leave play: pause and the mission plan. */
function playInput() {
  if (pressed('pause')) {
    pause();
    return true;
  }
  if (pressed('plan') && session.phase !== 'kick') {
    showPlan();
    return true;
  }
  // A click on the view (re)captures the mouse for look.
  if (input.pointer.justDown && input.pointer.type === 'mouse' && !input.pointerLocked && session.phase !== 'kick') capturePointer();
  return false;
}

function syncInput() {
  if (pressed('pause')) {
    pause();
    return;
  }
  if (pressed('back')) {
    cancelSync();
    return;
  }
  if (pressed('jump') || pressed('interact') || pressed('strike') || pressed('confirm')) tapSync();
}

/** Controller / keyboard navigation for the game's own screens. */
const navRepeat = createRepeater();
function menuBack() {
  if (mode === 'brief' || mode === 'endurance') returnTitle();
  else if (mode === 'paused') resume();
  else if (mode === 'manual') setMode(manualReturn);
  else if (mode === 'plan') closePlan();
}
function menuInput(dt) {
  const id = MENU_SCREENS[mode];
  if (!id) return;
  const scope = $(id);
  const active = scope.contains(document.activeElement) ? document.activeElement : null;
  const dir = navRepeat(input.vector('move'), dt);
  if (dir) {
    if (!active) markFocus(primaryOf(scope));
    else if (!(dir[0] && adjust(active, dir[0]))) {
      const next = neighbour(scope, active, dir[0], dir[1]);
      if (next) markFocus(next);
    }
  }
  if (performance.now() < menuGuard) return;
  if (pressed('confirm')) {
    if (active) press(active);
    else primaryOf(scope)?.click();
  } else if (pressed('back') || pressed('pause') || (mode === 'plan' && pressed('plan'))) menuBack();
}

function titleIdle(dt) {
  updateCamera(dt, true);
  enemies.forEach((e, i) => {
    e.mesh.position.copy(e.p);
    e.mesh.userData.arms[0].rotation.x = -0.55 + Math.sin(clockTime * 0.8 + i) * 0.05;
    e.mesh.userData.arms[1].rotation.x = -0.65;
  });
}

/** Show only the touch buttons that mean something right now. */
let touchKey = '';
function updateTouchControls() {
  const t = kit.touch;
  if (!t || !t.visible || !session) return;
  const zero = gravityStrength < 0.15;
  const fight = fighting();
  const key = `${zero ? 1 : 0}${fight ? 1 : 0}${interactTarget ? 1 : 0}`;
  if (key === touchKey) return;
  touchKey = key;
  t.setShown('strike', !zero || fight);
  t.setShown('shove', !zero);
  t.setShown('lower', zero);
  t.setShown('interact', !!interactTarget);
  t.setLabel('brace', zero ? 'Brake' : 'Brace');
  t.setLabel('jump', zero ? 'Up' : 'Jump');
}

function frame(rawDt) {
  const dt = Math.min(0.04, Math.max(0.001, rawDt));
  clockTime += dt;
  if (mode === 'playing') {
    if (!playInput()) {
      update(dt);
      updateMessages(dt);
    }
  } else if (mode === 'sync') {
    syncInput();
    if (mode === 'sync') {
      session.time += dt;
      updateSync(dt);
      updateMessages(dt);
      updateCrew(dt);
    }
  } else {
    menuInput(dt);
    if (mode === 'title' || mode === 'brief' || mode === 'endurance' || (mode === 'manual' && manualReturn === 'title')) titleIdle(dt);
  }
  uiTick += dt;
  if (uiTick > 0.09) {
    uiTick = 0;
    if (mode === 'playing' || mode === 'sync') updateHUD();
  }
  updateTouchControls();
  renderer.render(scene, camera);
}

/* ================================================================ interface wiring */

function bindUI() {
  $('new-game').onclick = () => {
    audio.init();
    audio.click();
    $('difficulty').value = options.difficulty;
    updateBriefBest();
    setMode('brief');
  };
  $('begin-mission').onclick = startNew;
  $('continue-game').onclick = () => {
    checkpointData = storage.get(STORE);
    loadCheckpoint();
  };
  $('manual-button').onclick = () => {
    manualReturn = 'title';
    setMode('manual');
    audio.click();
  };
  $('pause-manual').onclick = () => {
    manualReturn = 'paused';
    setMode('manual');
  };
  $('close-manual').onclick = () => setMode(manualReturn);
  $('resume-game').onclick = resume;
  $('load-checkpoint').onclick = () => (session.endurance ? startEndurance(session.difficulty) : loadCheckpoint());
  $('end-retry').onclick = loadCheckpoint;
  $('quit-title').onclick = () => (session.endurance ? finishEndurance(true) : saveAndQuit());
  $('end-replay').onclick = () => {
    resetWorld();
    if (lastRun === 'endurance') {
      openEndurance();
      return;
    }
    $('difficulty').value = options.difficulty;
    updateBriefBest();
    setMode('brief');
  };
  $('endurance-button').onclick = () => {
    audio.init();
    audio.click();
    openEndurance();
  };
  $('begin-endurance').onclick = () => startEndurance($('endurance-difficulty').value);
  $('endurance-difficulty').onchange = () => {
    if (difficulty[$('endurance-difficulty').value]) options.difficulty = $('endurance-difficulty').value;
    saveOptions();
    updateEnduranceBest();
  };
  document.querySelectorAll('.back-title').forEach((b) => (b.onclick = returnTitle));
  $('close-plan').onclick = closePlan;
  // The timing panel reacts on touch-down (a click lands ~100 ms later); keyboard clicks still work.
  const tap = $('sync-tap');
  tap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tapSync();
  });
  tap.addEventListener('click', (e) => {
    if (e.detail === 0) tapSync();
  });
  $('cancel-sync').onclick = cancelSync;
  $('brand-home').onclick = (e) => {
    e.preventDefault();
    if (mode === 'playing' || mode === 'sync') pause();
  };
  $('sound-button').onclick = () => {
    audio.init();
    audio.setMuted(!audio.muted);
    $('sound-button').classList.toggle('off', audio.muted);
    $('sound-button').setAttribute('aria-label', audio.muted ? 'Turn sound on' : 'Turn sound off');
  };
  $('settings-button').onclick = () => kit.menu.open();
  $('pause-settings').onclick = () => kit.menu.open();
  $('fullscreen-button').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Full screen is not available in this browser.', 4);
    }
  };
  const volume = $('volume');
  volume.value = Math.round(options.volume * 100);
  $('volume-output').textContent = `${volume.value}%`;
  volume.oninput = () => {
    options.volume = Number(volume.value) / 100;
    $('volume-output').textContent = `${volume.value}%`;
    audio.setVolume(options.volume);
    saveOptions();
  };
  const fov = $('fov');
  fov.value = Math.round(options.fov);
  $('fov-output').textContent = `${fov.value}°`;
  fov.oninput = () => {
    options.fov = Number(fov.value);
    $('fov-output').textContent = `${fov.value}°`;
    saveOptions();
  };
  for (const [id, key] of [['reduce-motion', 'reduceMotion'], ['timing-assist', 'timingAssist']]) {
    $(id).checked = options[key];
    $(id).onchange = () => {
      options[key] = $(id).checked;
      saveOptions();
    };
  }
  $('difficulty').value = options.difficulty;
  $('difficulty').onchange = () => {
    if (difficulty[$('difficulty').value]) options.difficulty = $('difficulty').value;
    saveOptions();
    updateBriefBest();
  };

  window.addEventListener('blur', () => {
    if (mode === 'playing' || mode === 'sync') pause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (mode === 'playing' || mode === 'sync')) pause();
  });
  // Losing the mouse (Esc, alt-tab, the settings panel) pauses the mission.
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === kit.canvas;
    if (!locked && hadLock && mode === 'playing' && session.phase !== 'kick') pause();
    hadLock = locked;
  });
  // The kit leaves keys on form fields to the browser; let Esc still leave a menu from a slider.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape' || !e.target?.matches?.('input, select')) return;
    e.target.blur();
    if (performance.now() > menuGuard) menuBack();
  });
  // Browsers only start audio after a gesture: any key, click or tap will do.
  for (const type of ['pointerdown', 'pointerup', 'click', 'keydown']) window.addEventListener(type, () => audio.init(), true);
  kit.onPause((paused) => audio.suspend(paused));
  input.onSourceChange(() => refreshPrompts());
}

/* ================================================================ test hooks (?test=1) */

function installTestAPI() {
  window.__fallTest = {
    state: () => ({
      mode,
      session: JSON.parse(JSON.stringify(session)),
      player: { p: player.p.toArray(), v: player.v.toArray(), health: player.health, stamina: player.stamina, grounded: player.grounded, yaw: player.yaw, pitch: player.pitch },
      gravity: { angle: gravityAngle, strength: gravityStrength },
      enemies: enemies.map((e) => ({ kind: e.kind, p: e.p.toArray(), hp: e.hp, state: e.state, active: e.activated })),
      crew: crew.map((c) => ({ p: c.p.toArray(), status: c.status })),
      target: interactTarget?.id,
      sync: sync ? { ...sync } : null,
      render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, backend: kit.backend },
    }),
    start: (d = 'operative') => {
      $('difficulty').value = d;
      startNew();
    },
    endurance: (d = 'operative') => startEndurance(d),
    advance: (n = 1, dt = 1 / 60) => {
      for (let i = 0; i < n; i++) {
        if (mode === 'playing') {
          update(dt);
          updateMessages(dt);
        } else if (mode === 'sync') {
          session.time += dt;
          updateSync(dt);
          updateMessages(dt);
          updateCrew(dt);
        }
      }
      updateHUD();
    },
    teleport: (x, y, z, yaw = 0, pitch = 0) => {
      player.p.set(x, y, z);
      player.v.set(0, 0, 0);
      player.yaw = yaw;
      player.pitch = pitch;
      updateCamera(0.02);
      updateHUD();
    },
    hold: (action, on = true) => (on ? virtual.add(action) : virtual.delete(action)),
    move: (x = 0, y = 0) => {
      virtualMove = x || y ? { x, y } : null;
    },
    attack,
    defeatAll: () => enemies.forEach((e) => (e.kind === 'hall' || e.activated) && downEnemy(e, true)),
    activate: (id) => {
      const t = targets().find((x) => x.id === id);
      if (t) {
        activate(t);
        return true;
      }
      return false;
    },
    tap: tapSync,
    load: loadCheckpoint,
    pause,
    resume,
    showPlan,
    options,
    aim: (i) => {
      const e = enemies[i];
      const d = e.p.clone().addScaledVector(gUp(), 0.15).sub(camera.position).applyAxisAngle(ZAXIS, -viewRoll);
      player.yaw = Math.atan2(-d.x, -d.z);
      player.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    },
    steer: (x, y, z) => {
      const d = V(x, y, z).sub(player.p);
      player.yaw = Math.atan2(-d.x, -d.z);
      player.pitch = 0;
      virtualMove = d.length() > 0.5 ? { x: 0, y: 1 } : null;
      if (d.y > 0.3) virtual.add('jump');
      else virtual.delete('jump');
      if (d.y < -0.3) virtual.add('lower');
      else virtual.delete('lower');
    },
    positions: () => ({ colliders: colliders.length, staticMeshes: world.children.length }),
    render: () => renderer.render(scene, camera),
  };
}

/* ================================================================ start */

kit.loading.progress(0.7, 'Building the Meridian…');
buildHotel();
buildPeople();
buildTargets();
scene.add(sparkMesh);
session = freshSession();
resetActors();
updateCamera(0, true);
bindUI();

// Compile every material now, including the ones that only appear later (security, sparks,
// the harness lines), so the first fight and the zero-gravity ambush do not stutter.
kit.loading.progress(0.85, 'Preparing the dream…');
{
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });
  sparkMesh.count = 1;
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('[fall-protocol] pre-compile skipped:', err);
  }
  sparkMesh.count = 0;
  for (const o of hidden) o.visible = false;
}

updateTitleRecord();
setMode('title');
if (new URLSearchParams(location.search).get('test') === '1') installTestAPI();
kit.start(frame);
