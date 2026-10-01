/**
 * Subterra Spark: Vaultbreaker — a top-down rover-and-pilot shooter on the
 * shared 3D kit (three.js r186 WebGPU with WebGL2 fallback, kit input/touch).
 *
 * Drive the Crawler, dismount to breach a vault on foot, bring its part back
 * to the gate and break the boss behind it. Two areas: the Cinder Aquifer
 * (the original mission) and the Ember Foundry.
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createMaterials, createModels, signMaterial, StaticBatch } from './models.js';
import { AREAS, DIFFICULTY, AREA2_LOADOUT, BASE_LOADOUT, MAX_LEVEL, UPGRADES, ENEMY, REPAIR } from './areas.js';
import { createAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const ui = {
  badge: $('#renderer-badge'),
  pauseBtn: $('#pause-btn'),
  brandArea: $('#brand-area'),
  hudLeft: $('#hud-left'),
  healthBar: $('#health-bar'),
  healthText: $('#health-text'),
  boostBar: $('#boost-bar'),
  xpBar: $('#xp-bar'),
  levelText: $('#level-text'),
  objective: $('#objective'),
  miniMode: $('#mini-mode'),
  miniScrap: $('#mini-scrap'),
  miniTime: $('#mini-time'),
  areaText: $('#area-text'),
  modeText: $('#mode-text'),
  scrapText: $('#scrap-text'),
  weaponText: $('#weapon-text'),
  timeText: $('#time-text'),
  prompt: $('#prompt'),
  toast: $('#toast'),
  fade: $('#fade'),
  hurt: $('#hurt'),
  boss: $('#boss'),
  bossName: $('#boss-name'),
  bossFill: $('#boss-fill'),
  start: $('#start-card'),
  pause: $('#pause-card'),
  complete: $('#complete-card'),
  startEyebrow: $('#start-eyebrow'),
  startBlurb: $('#start-blurb'),
  areaBtns: [...document.querySelectorAll('[data-area]')],
  diffBtns: [...document.querySelectorAll('[data-diff]')],
  loadout: $('#loadout-line'),
  best: $('#best-line'),
  controls: $('#controls'),
  continueBtn: $('#continue-button'),
  startBtn: $('#start-button'),
  pauseObjective: $('#pause-objective'),
  pauseControls: $('#pause-controls'),
  resumeBtn: $('#resume-button'),
  retryBtn: $('#retry-button'),
  restartBtn: $('#restart-area-button'),
  settingsBtn: $('#settings-button'),
  startSettingsBtn: $('#start-settings-button'),
  quitBtn: $('#quit-button'),
  completeEyebrow: $('#complete-eyebrow'),
  completeTitle: $('#complete-title'),
  completeSummary: $('#complete-summary'),
  completeGrade: $('#complete-grade'),
  nextBtn: $('#next-area-button'),
  replayBtn: $('#replay-button'),
  titleBtn: $('#title-button'),
};

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'Subterra Spark: Vaultbreaker',
  accent: '#4cecff',
  background: '#061319',
  // The pause menu has a Settings button, so no gear; the touch pills take the top-right corner.
  gear: 'none',
  touch: { top: 'right', topOffset: 10 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    aim: { type: 'vector', gamepad: 'rightStick', touch: 'stick-right' },
    fire: { keys: ['KeyF', 'KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
    boost: { keys: ['Space', 'ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['A', 'LT'], touch: 'Boost' },
    action: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Action' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    view: { keys: ['KeyZ'], gamepad: ['RS'], touch: { label: 'View', slot: 'top' } },
    zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RB', neg: 'LB' } },
    confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const { input, renderer } = kit;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
ui.badge.textContent = `${kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL2'} · R${THREE.REVISION}`;
kit.loading.progress(0.7, 'Flooding the aquifer…');

// ---------------------------------------------------------------- constants and helpers
const OUT_BOUNDS = { minX: -33.2, maxX: 33.2, minZ: -17.2, maxZ: 17.2 };
const IN_BOUNDS = { minX: -9.4, maxX: 9.4, minZ: 71.3, maxZ: 88.7 };
const INTERIOR_SPAWN = { x: 0, z: 86.4 };
const GRADES = ['C', 'B', 'A', 'S'];
const SAVE_KEY = 'subterra-spark.v2';
const ACTION_KEY = { keyboard: 'E', gamepad: 'Y', touch: 'ACTION' };
const CONTROLS = {
  keyboard: [
    ['MOVE', 'WASD / arrows'], ['AIM', 'mouse'], ['FIRE', 'click / F'], ['BOOST', 'Space / Shift'],
    ['ACTION', 'E'], ['ZOOM', 'wheel / + −'], ['VIEW', 'Z'], ['PAUSE', 'Esc / P'],
  ],
  gamepad: [
    ['MOVE', 'left stick / D-pad'], ['AIM', 'right stick'], ['FIRE', 'RT / X'], ['BOOST', 'A / LT'],
    ['ACTION', 'Y'], ['ZOOM', 'LB / RB'], ['VIEW', 'right-stick click'], ['PAUSE', 'Start'],
  ],
  touch: [
    ['MOVE', 'left thumb'], ['AIM', 'right thumb (fires)'], ['FIRE', 'FIRE'], ['BOOST', 'BOOST'],
    ['ACTION', 'ACTION (when lit)'], ['VIEW', 'View pill'], ['PAUSE', 'II pill'], ['TIP', 'Crawler shrugs off lava'],
  ],
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const bestGrade = (a, b) => (!a ? b : GRADES.indexOf(b) > GRADES.indexOf(a) ? b : a);
function mulberry32(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gradeFor(time, deaths, par) {
  if (time <= par && deaths === 0) return 'S';
  if (time <= par * 1.35 && deaths <= 1) return 'A';
  if (time <= par * 2 && deaths <= 3) return 'B';
  return 'C';
}

// Scratch objects: nothing below allocates per frame.
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _c = new THREE.Color();
const _obj = new THREE.Object3D();
const _ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1);
const fwd = new THREE.Vector3(0, 0, -1);
const right = new THREE.Vector3(1, 0, 0);

// ---------------------------------------------------------------- scene, camera, lights
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07161c);
scene.fog = new THREE.FogExp2(0x07161c, 0.021);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(53, 1, 0.1, 180));

const hemi = new THREE.HemisphereLight(0xb9f4ff, 0x17210f, 1.4);
scene.add(hemi);
// The sun follows the action, so the vault interior and the far arena get shadows too.
const sun = new THREE.DirectionalLight(0xffe3b7, 3.5);
const SUN_OFFSET = new THREE.Vector3(-16, 24, -10);
sun.castShadow = true;
kit.shadow(sun, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 80 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
// A fixed set of point lights, re-aimed per area: the light count never changes, so no shader rebuilds.
const pointLights = [];
for (let i = 0; i < 4; i++) {
  const l = new THREE.PointLight(0xffffff, 0, 20, 2);
  scene.add(l);
  pointLights.push(l);
}

const audio = createAudio();
const mat = createMaterials();
const M = createModels(mat);
const G = M.G;

const rover = M.rover();
scene.add(rover);
const pilot = M.pilot();
pilot.visible = false;
scene.add(pilot);

// ---------------------------------------------------------------- pooled bolts, sparks and warning rings
function boltPool(material, capacity) {
  const mesh = kit.instanced(G.oct(1), material, capacity);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  const items = [];
  for (let i = 0; i < capacity; i++) items.push({ x: 0, y: 0, z: 0, vx: 0, vz: 0, life: 0, damage: 0, size: 0.1, radius: 0.2, area: 'external', spin: 0 });
  return { mesh, items, n: 0, capacity, extra: 0 };
}
const roverBolts = boltPool(mat.cyan, 96);
const pilotBolts = boltPool(mat.orange, 64);
const enemyBolts = boltPool(mat.magenta, 160);

const SPARK_CAP = 480;
const sparkMesh = kit.instanced(G.tet(1), mat.spark, SPARK_CAP);
sparkMesh.count = 0;
sparkMesh.frustumCulled = false;
sparkMesh.castShadow = false;
sparkMesh.setColorAt(0, _c.setHex(0xffffff));
scene.add(sparkMesh);
const sparks = { items: [], n: 0 };
for (let i = 0; i < SPARK_CAP; i++) sparks.items.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, rx: 0, ry: 0, r: 1, g: 1, b: 1 });

const rings = [];
for (let i = 0; i < 12; i++) {
  const r = new THREE.Mesh(G.ring(1.45, 1.85, 28), mat.warn);
  r.rotation.x = -Math.PI / 2;
  r.visible = false;
  r.renderOrder = 2;
  scene.add(r);
  rings.push(r);
}
function takeRing(x, z, scale = 1) {
  for (const r of rings) {
    if (r.visible) continue;
    r.visible = true;
    r.position.set(x, 0.09, z);
    r.scale.setScalar(scale);
    return r;
  }
  return null;
}
const SHELL_CAP = 24;
const shells = [];
for (let i = 0; i < SHELL_CAP; i++) shells.push({ on: false, sx: 0, sz: 0, tx: 0, tz: 0, t: 0, dur: 1, dmg: 0, area: 'external', ring: null });

// ---------------------------------------------------------------- saved progress
function loadStore() {
  const base = { difficulty: 'pilot', area: 1, cleared: {}, best: {}, carry: null, run: null };
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const s = { ...base, ...raw, cleared: { ...(raw.cleared || {}) }, best: { ...(raw.best || {}) } };
      if (!DIFFICULTY[s.difficulty]) s.difficulty = 'pilot';
      if (!AREAS[s.area]) s.area = 1;
      if (s.run && (!AREAS[s.run.area] || !s.run.stats)) s.run = null;
      return s;
    }
  } catch {
    /* private window or a damaged save: start clean */
  }
  return base;
}
const store = loadStore();
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(store));
  } catch {
    /* storage blocked: progress lasts for this visit */
  }
}

// ---------------------------------------------------------------- game state
let state = 'title'; // 'title' | 'play' | 'paused' | 'done'
let diff = DIFFICULTY[store.difficulty];
let A = null; // the loaded area
const run = { area: 1, difficulty: 'pilot', startStats: { ...BASE_LOADOUT } };
const player = {
  mode: 'rover', area: 'external', health: 100, maxHealth: 100, boost: 100,
  level: 1, xp: 0, nextXp: 40, scrap: 0, damageMul: 1, weapon: 0,
  invuln: 0, shield: 0, fireCooldown: 0, checkpoint: new THREE.Vector3(-27, 0, 0), deaths: 0,
  speed01: 0, boosting: false, lavaTick: 0, walk: 0,
};
const mission = {
  stage: 0, route: false, item: false, itemSpawned: false, gateOpen: false, interiorSpawned: false,
  wave: 0, waveTimer: 0, exited: false, complete: false, completeTimer: 0, elapsed: 0,
};
const stats = { kills: 0, shots: 0, hits: 0 };
let results = null;
const aimDir = new THREE.Vector3(1, 0, 0);
let aimStickLen = 0;
let mouseAim = false;
// The kit's pointer starts at (0, 0): mouse aim switches on only once the mouse really moves,
// so keyboard-only players keep aim-follows-movement.
let lastPX = 0;
let lastPY = 0;
let camDist = 12.5;
const VIEW_STEPS = [10, 12.5, 15.5];
const camTarget = new THREE.Vector3();
const camBase = new THREE.Vector3();
let shake = 0;
let toastTimer = 0;
let muzzleFlash = 0;
let boostLock = false;
let exhaustTimer = 0;
let currentInteraction = null;
let touchActionShown = null;
let engineLevel = -1;
let clock = 0;
let armorHint = 0;
let hudSecond = -1;

// ---------------------------------------------------------------- area building
function buildArea(def) {
  const root = new THREE.Group();
  root.name = def.name;
  const rt = {
    def, root, merged: [], disposables: [], colliders: [], hazards: [], destructibles: [],
    enemyDefs: [], waves: [], pickupDefs: [], enemies: [], pickups: [],
    door: null, exit: null, exitDoor: null, item: null, arena: null, gate: null, routeWall: null,
    terminal: null, tinker: null, boss: null,
  };
  const batch = new StaticBatch();
  const rand = mulberry32(def.seed);
  const place = (x, y, z, rx, ry, rz, sx, sy, sz) => {
    _obj.position.set(x, y, z);
    _obj.rotation.set(rx, ry, rz);
    _obj.scale.set(sx, sy, sz);
    _obj.updateMatrix();
    return _obj.matrix;
  };
  const B = {
    mat,
    rand,
    light(i, hex, intensity, distance, x, y, z) {
      const l = pointLights[i];
      l.color.setHex(hex);
      l.intensity = intensity;
      l.distance = distance;
      l.position.set(x, y, z);
    },
    box(x, y, z, sx, sy, sz, material, o = {}) {
      batch.add(G.box(), material, place(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, sx, sy, sz), o.cast !== false);
    },
    cyl(x, y, z, r, h, material, sides = 10, o = {}) {
      batch.add(G.cyl(1, 1, sides), material, place(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, r, h, r), o.cast !== false);
    },
    rock(x, z, scale = 1, material = mat.rock) {
      const s = 1.15 * scale;
      const rx = rand() * 0.3;
      const ry = rand() * Math.PI;
      const rz = rand() * 0.25;
      const sy = s * (0.8 + rand() * 0.45);
      const sz = s * (1.05 + rand() * 0.3);
      batch.add(G.ico(), material, place(x, 0.4 * scale, z, rx, ry, rz, s, sy, sz), true);
    },
    water(x, y, z, sx, sy, sz) {
      B.box(x, y, z, sx, sy, sz, mat.water, { cast: false });
    },
    lava(x, z, w, d, area = 'external') {
      B.box(x, -0.06, z, w, 0.2, d, mat.lava, { cast: false });
      rt.hazards.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, area });
    },
    collider(x, z, w, d, area = 'external', o = {}) {
      const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, area, id: o.id || '', blocks: o.blocks !== false, enabled: true };
      rt.colliders.push(c);
      return c;
    },
    edges() {
      B.collider(0, -19, 72, 2);
      B.collider(0, 19, 72, 2);
      B.collider(-35, 0, 2, 40);
      B.collider(35, 0, 2, 40);
    },
    sign(text, x, z, rotY = 0, style) {
      const material = signMaterial(text, style);
      rt.disposables.push(material.map, material);
      const board = new THREE.Mesh(G.plane(3.1, 0.78), material);
      board.position.set(x, 1.7, z);
      board.rotation.y = rotY;
      board.castShadow = true;
      root.add(board);
      B.box(x, 0.8, z, 0.15, 1.6, 0.15, mat.darkMetal, { ry: rotY });
    },
    platform(x, z, postMat, hex) {
      B.cyl(x, -0.25, z, 4.2, 0.55, mat.metal, 14);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        B.cyl(x + Math.cos(a) * 3, 0.25, z + Math.sin(a) * 3, 0.08, 1, postMat, 10, { cast: false });
      }
      B.light(3, hex, 14, 9, x, 1.6, z);
    },
    bunker(x0, z0, f) {
      const Z = (o) => z0 + f * o;
      B.box(x0, 0.65, Z(0), 8.2, 1.3, 5.8, mat.darkMetal);
      B.box(x0, 1.55, Z(0.5), 6.8, 0.8, 4.2, mat.metal);
      for (let i = 0; i < 4; i++) B.box(x0, 0.1 + i * 0.16, Z(-3.4 + i * 0.65), 3.4, 0.18, 0.7, mat.metal);
      B.box(x0 - 1.85, 0.72, Z(-2.3), 0.12, 1.15, 3.5, mat.orange);
      B.box(x0 + 1.85, 0.72, Z(-2.3), 0.12, 1.15, 3.5, mat.orange);
      B.box(x0, 1.1, Z(-1.88), 2.1, 2.1, 0.22, mat.cyan, { cast: false });
      B.collider(x0, Z(0.2), 8.4, 5.4);
      rt.door = { x: x0, z: Z(-2.6) };
      rt.exit = { x: x0, z: Z(-3.6) };
    },
    gateWall(x, fieldMat, rockMat, kind) {
      for (let z = -16; z <= -3.2; z += 2.5) {
        B.rock(x, z, 1.15, rockMat);
        B.collider(x, z, 2.6, 2.8);
      }
      for (let z = 3.2; z <= 16; z += 2.5) {
        B.rock(x, z, 1.15, rockMat);
        B.collider(x, z, 2.6, 2.8);
      }
      const field = new THREE.Mesh(G.plane(5.4, 3.6), fieldMat);
      field.position.set(x, 1.7, 0);
      field.rotation.y = Math.PI / 2;
      root.add(field);
      const wall = { x, field, collider: B.collider(x, 0, 1.1, 5.5, 'external', { id: kind }) };
      if (kind === 'route') rt.routeWall = wall;
      else rt.gate = wall;
    },
    terminal(x, z) {
      const face = z < 0 ? 1 : -1;
      B.box(x, 0.65, z, 1.1, 1.3, 1.1, mat.darkMetal);
      B.collider(x, z, 1.1, 1.1, 'external', { blocks: false });
      const glow = new THREE.Mesh(G.box(0.65, 0.42, 0.08), mat.cyan);
      glow.position.set(x, 1.02, z + face * 0.58);
      root.add(glow);
      rt.terminal = { x, z, glow };
    },
    tinker(x, z) {
      B.box(x, 0.35, z, 2.8, 0.7, 2.8, mat.metal);
      B.cyl(x, 0.95, z, 0.55, 1.2, mat.orange, 8);
      const glow = new THREE.Mesh(G.cyl(0.28, 0.18, 12), mat.cyan);
      glow.position.set(x, 1.65, z);
      glow.rotation.order = 'YXZ';
      glow.rotation.x = Math.PI / 2;
      root.add(glow);
      rt.tinker = { x, z, glow };
    },
    arena(x, z, floorMat, accentMat, postMat) {
      B.cyl(x, -0.34, z, 9.4, 0.62, floorMat, 18, { cast: false });
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        B.cyl(x + Math.cos(a) * 9.2, 0.55, z + Math.sin(a) * 9.2, 0.18, 1.3, i % 2 ? postMat : accentMat, 10, { rz: (rand() - 0.5) * 0.15 });
      }
      rt.arena = { x, z, r: 7.4 };
    },
    room(wallMat, floorMat) {
      B.box(0, -0.55, 80, 21, 1, 19, floorMat, { cast: false });
      B.box(0, 2, 70.6, 21, 4.3, 0.8, wallMat, { cast: false });
      B.box(0, 2, 89.4, 21, 4.3, 0.8, wallMat, { cast: false });
      B.box(-10.1, 2, 80, 0.8, 4.3, 19, wallMat, { cast: false });
      B.box(10.1, 2, 80, 0.8, 4.3, 19, wallMat, { cast: false });
      B.collider(0, 70.5, 22, 1, 'interior');
      B.collider(0, 89.5, 22, 1, 'interior');
      B.collider(-10.2, 80, 1, 20, 'interior');
      B.collider(10.2, 80, 1, 20, 'interior');
      B.box(0, 1.15, 88.8, 2.3, 2.3, 0.25, mat.cyan, { cast: false });
      rt.exitDoor = { x: 0, z: 88.4 };
    },
    pillar(x, z, material) {
      B.cyl(x, 0.8, z, 0.8, 1.6, material);
      B.collider(x, z, 1.7, 1.7, 'interior');
    },
    crystals(x0) {
      const group = M.crystals(rand);
      group.position.set(x0, 0, 0);
      root.add(group);
      rt.destructibles.push({
        id: 'crystals', kind: 'crystals', hp: 58, maxHp: 58, group, x: x0, z: 0, y: 1, alive: true, pop: 0,
        collider: B.collider(x0, 0, 2.8, 5.4, 'external', { id: 'crystals', blocks: false }),
        hit: (px, pz) => Math.abs(px - x0) < 2.1 && Math.abs(pz) < 3.1,
        color: 0xf16bd4, deathColor: 0xff64df,
      });
    },
    pylon(id, x, z) {
      const group = M.pylon();
      group.position.set(x, 0, z);
      root.add(group);
      rt.destructibles.push({
        id, kind: 'pylon', hp: 70, maxHp: 70, group, x, z, y: 1.6, alive: true, pop: 0,
        collider: B.collider(x, z, 1.7, 1.7, 'external', { id, blocks: false }),
        hit: (px, pz) => (px - x) ** 2 + (pz - z) ** 2 < 1.69,
        color: 0xffa040, deathColor: 0xff7a2a,
      });
    },
    enemy(id, x, z, type, area = 'external') {
      rt.enemyDefs.push({ id, x, z, type, area });
    },
    wave(list) {
      rt.waves.push(list);
    },
    pickup(id, x, z, type, amount, area = 'external') {
      rt.pickupDefs.push({ id, x, z, type, amount, area });
    },
    itemAt(x, z) {
      rt.item = { x, z };
    },
  };
  def.build(B);
  rt.merged = batch.build(root);
  scene.add(root);
  return rt;
}

function unloadArea() {
  if (!A) return;
  scene.remove(A.root);
  for (const m of A.merged) m.geometry.dispose();
  for (const d of A.disposables) d.dispose();
  A = null;
  roverBolts.n = pilotBolts.n = enemyBolts.n = 0;
  sparks.n = 0;
  for (const s of shells) s.on = false;
  for (const r of rings) r.visible = false;
}

function applyPalette(p) {
  scene.background.setHex(p.bg);
  scene.fog.color.setHex(p.bg);
  scene.fog.density = p.fog;
  hemi.color.setHex(p.sky);
  hemi.groundColor.setHex(p.ground);
  hemi.intensity = p.hemi;
  sun.color.setHex(p.sun);
  sun.intensity = p.sunI;
}

function applyStats(s) {
  const n = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  player.level = clamp(Math.round(n(s.level, 1)), 1, MAX_LEVEL);
  player.xp = Math.max(0, n(s.xp, 0));
  player.nextXp = Math.max(1, n(s.nextXp, 40));
  player.maxHealth = Math.max(1, n(s.maxHealth, 100));
  player.health = clamp(n(s.health, player.maxHealth), 1, player.maxHealth);
  player.scrap = Math.max(0, Math.round(n(s.scrap, 0)));
  player.damageMul = Math.max(0.5, n(s.damageMul, 1));
  player.weapon = clamp(Math.round(n(s.weapon, 0)), 0, UPGRADES.length);
}
const pickStats = () => ({
  level: player.level, xp: player.xp, nextXp: player.nextXp, maxHealth: player.maxHealth, health: player.health,
  scrap: player.scrap, damageMul: player.damageMul, weapon: player.weapon,
});

function loadArea(id, { loadout = BASE_LOADOUT, restore = null } = {}) {
  unloadArea();
  const def = AREAS[id];
  applyPalette(def.palette);
  for (const l of pointLights) l.intensity = 0;
  A = buildArea(def);
  Object.assign(mission, {
    stage: 0, route: false, item: false, itemSpawned: false, gateOpen: false, interiorSpawned: false,
    wave: 0, waveTimer: 0, exited: false, complete: false, completeTimer: 0, elapsed: 0,
  });
  Object.assign(player, { mode: 'rover', area: 'external', boost: 100, invuln: 0, shield: 1.2, fireCooldown: 0, deaths: 0, speed01: 0, boosting: false });
  applyStats(restore ? restore.stats : loadout);
  stats.kills = stats.shots = stats.hits = 0;
  results = null;
  const cp = def.checkpoints.start;
  player.checkpoint.set(cp[0], 0, cp[1]);

  const dead = new Set(restore?.dead || []);
  const taken = new Set(restore?.taken || []);
  for (const e of A.enemyDefs) if (!dead.has(e.id)) spawnEnemy(e.id, e.x, e.z, e.type, e.area);
  for (const p of A.pickupDefs) if (!taken.has(p.id)) spawnPickup(p.id, p.x, p.z, p.type, p.amount, p.area);
  if (restore) {
    for (const did of restore.destroyed || []) {
      const d = A.destructibles.find((x) => x.id === did);
      if (d) destroyDestructible(d, true);
    }
    const f = restore.flags || {};
    if (f.item) {
      mission.interiorSpawned = mission.itemSpawned = mission.item = true;
      mission.wave = Math.max(0, A.waves.length - 1);
      mission.stage = 3;
    }
    if (f.gateOpen) openGate(true);
    mission.exited = !!f.exited || !!f.item;
    mission.elapsed = Math.max(0, Number(restore.elapsed) || 0);
    player.deaths = Math.max(0, Number(restore.deaths) || 0);
    stats.kills = Number(restore.kills) || 0;
    stats.shots = Number(restore.shots) || 0;
    stats.hits = Number(restore.hits) || 0;
    if (Array.isArray(restore.checkpoint)) player.checkpoint.set(Number(restore.checkpoint[0]) || cp[0], 0, Number(restore.checkpoint[1]) || cp[1]);
  }

  rover.visible = true;
  pilot.visible = false;
  rover.position.copy(player.checkpoint);
  rover.rotation.set(0, Math.PI / 2, 0);
  rover.userData.turret.rotation.y = 0;
  aimDir.set(1, 0, 0);
  hideBossBar();
  setText(ui.areaText, def.code.replace('AREA ', ''));
  setText(ui.brandArea, `VAULTBREAKER · ${def.code}`);
  audio.setAmbient(id);
  refreshObjective();
  snapCamera();
  updateHUD();
}

// ---------------------------------------------------------------- collision and hazards
const boundsFor = (area) => (area === 'interior' ? IN_BOUNDS : OUT_BOUNDS);
function hitCollider(x, z, r, area) {
  for (const c of A.colliders) {
    if (!c.enabled || c.area !== area) continue;
    const dx = x - clamp(x, c.minX, c.maxX);
    const dz = z - clamp(z, c.minZ, c.maxZ);
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}
function shotBlocked(x, z, area) {
  for (const c of A.colliders) {
    if (c.enabled && c.blocks && c.area === area && x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
  }
  return false;
}
function hazardAt(x, z, area) {
  for (const h of A.hazards) if (h.area === area && x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ) return h;
  return null;
}
/** Axis-separated move: slides along walls instead of sticking to them. */
function moveEntity(obj, dx, dz, radius, area, avoidHazard = false) {
  const b = boundsFor(area);
  const p = obj.position;
  const nx = clamp(p.x + dx, b.minX + radius, b.maxX - radius);
  const nz = clamp(p.z + dz, b.minZ + radius, b.maxZ - radius);
  if (!hitCollider(nx, p.z, radius, area) && !(avoidHazard && hazardAt(nx, p.z, area))) p.x = nx;
  if (!hitCollider(p.x, nz, radius, area) && !(avoidHazard && hazardAt(p.x, nz, area))) p.z = nz;
}
const activeObject = () => (player.mode === 'rover' ? rover : pilot);
const activeRadius = () => (player.mode === 'rover' ? 1.15 : 0.44);

// ---------------------------------------------------------------- feedback
function setText(el, v) {
  if (el && el.__v !== v) {
    el.__v = v;
    el.textContent = v;
  }
}
function setWidth(el, pct) {
  const v = Math.round(clamp(pct, 0, 100) * 4) / 4;
  if (el.__w !== v) {
    el.__w = v;
    el.style.width = `${v}%`;
  }
}
function toast(text, seconds = 1.55) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastTimer = seconds;
}
function objective(text) {
  setText(ui.objective, text);
}
function replay(el) {
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation (only on events, never per frame)
  el.classList.add('on');
}
const fadeFlash = () => replay(ui.fade);
const hurtFlash = () => replay(ui.hurt);
const addShake = (v) => (shake = Math.min(1, shake + v));

function burst(x, y, z, hex, count = 7, size = 0.12) {
  _c.setHex(hex);
  const n = Math.max(1, Math.round(count * Math.min(1, kit.tier.detail + 0.25)));
  for (let i = 0; i < n && sparks.n < SPARK_CAP; i++) {
    const p = sparks.items[sparks.n++];
    p.x = x + (Math.random() - 0.5) * 0.5;
    p.y = y + 0.3 + Math.random() * 0.7;
    p.z = z + (Math.random() - 0.5) * 0.5;
    p.vx = (Math.random() - 0.5) * 4;
    p.vy = 1.5 + Math.random() * 3;
    p.vz = (Math.random() - 0.5) * 4;
    p.life = p.max = 0.55 + Math.random() * 0.55;
    p.size = size * (0.7 + Math.random() * 0.8);
    p.rx = Math.random() * 6;
    p.ry = Math.random() * 6;
    p.r = _c.r;
    p.g = _c.g;
    p.b = _c.b;
  }
}
function updateSparks(dt) {
  const items = sparks.items;
  for (let i = sparks.n - 1; i >= 0; i--) {
    const p = items[i];
    p.life -= dt;
    if (p.life <= 0) {
      const last = --sparks.n;
      items[i] = items[last];
      items[last] = p;
      continue;
    }
    p.vy -= 5.5 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rx += dt * 5;
    p.ry += dt * 7;
  }
  for (let i = 0; i < sparks.n; i++) {
    const p = items[i];
    _obj.position.set(p.x, p.y, p.z);
    _obj.rotation.set(p.rx, p.ry, 0);
    _obj.scale.setScalar(p.size * (0.3 + 0.7 * (p.life / p.max)));
    _obj.updateMatrix();
    sparkMesh.setMatrixAt(i, _obj.matrix);
    sparkMesh.setColorAt(i, _c.setRGB(p.r, p.g, p.b));
  }
  sparkMesh.count = sparks.n;
  if (sparks.n) {
    sparkMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- bolts
function spawnBolt(pool, x, y, z, angle, speed, damage, size, life, area, radius = size + 0.15) {
  if (pool.n >= pool.capacity) return;
  const b = pool.items[pool.n++];
  b.x = x;
  b.y = y;
  b.z = z;
  b.vx = Math.sin(angle) * speed;
  b.vz = Math.cos(angle) * speed;
  b.life = life;
  b.damage = damage;
  b.size = size;
  b.radius = radius;
  b.area = area;
  b.spin = Math.random() * 6;
}
function killBolt(pool, i) {
  const last = --pool.n;
  if (i !== last) {
    const t = pool.items[i];
    pool.items[i] = pool.items[last];
    pool.items[last] = t;
  }
}
function drawBolts(pool) {
  const { mesh, items, n } = pool;
  for (let i = 0; i < n; i++) {
    const b = items[i];
    _obj.position.set(b.x, b.y, b.z);
    _obj.rotation.set(b.spin, b.spin * 1.3, 0);
    _obj.scale.setScalar(b.size);
    _obj.updateMatrix();
    mesh.setMatrixAt(i, _obj.matrix);
  }
  // Mortar shells ride in the enemy batch after the straight bolts.
  let k = n;
  if (pool === enemyBolts) {
    for (const s of shells) {
      if (!s.on || k >= pool.capacity) continue;
      const t = Math.min(1, s.t / s.dur);
      _obj.position.set(s.sx + (s.tx - s.sx) * t, 1.2 + Math.sin(t * Math.PI) * 4.6 - t * 1.0, s.sz + (s.tz - s.sz) * t);
      _obj.rotation.set(s.t * 8, s.t * 6, 0);
      _obj.scale.setScalar(0.3);
      _obj.updateMatrix();
      mesh.setMatrixAt(k++, _obj.matrix);
    }
  }
  mesh.count = k;
  if (k) mesh.instanceMatrix.needsUpdate = true;
}
function clearEnemyFire() {
  enemyBolts.n = 0;
  for (const s of shells) {
    if (!s.on) continue;
    s.on = false;
    if (s.ring) s.ring.visible = false;
    s.ring = null;
  }
}

function firePlayer() {
  if (player.fireCooldown > 0) return;
  const rov = player.mode === 'rover';
  player.fireCooldown = rov ? 0.19 : 0.16;
  const pool = rov ? roverBolts : pilotBolts;
  if (rov) rover.userData.muzzle.getWorldPosition(_v);
  else _v.set(pilot.position.x + aimDir.x * 0.65, 1.05, pilot.position.z + aimDir.z * 0.65);
  const size = rov ? 0.18 : 0.12;
  const damage = (rov ? 18 : 11) * player.damageMul * (player.weapon >= 1 ? 1.24 : 1);
  const speed = rov ? 25 : 21;
  const base = Math.atan2(aimDir.x, aimDir.z);
  spawnBolt(pool, _v.x, _v.y, _v.z, base, speed, damage, size, 1.35, player.area);
  stats.shots++;
  if (player.weapon >= 2) {
    spawnBolt(pool, _v.x, _v.y, _v.z, base - 0.17, speed, damage * 0.55, size * 0.8, 1.0, player.area);
    spawnBolt(pool, _v.x, _v.y, _v.z, base + 0.17, speed, damage * 0.55, size * 0.8, 1.0, player.area);
    stats.shots += 2; // accuracy counts bolts, so the splitter can't read over 100%
  }
  muzzleFlash = 0.07;
  audio.beep(rov ? 190 : 310, 0.045, 'square', 0.017, 80);
}

/** 0: flying on, 1: hit a target (counts for accuracy), 2: stopped by a wall or armour. */
function boltHits(b) {
  const area = b.area;
  if (area !== player.area) return 0;
  if (area === 'external') {
    for (const d of A.destructibles) {
      if (d.alive && d.hit(b.x, b.z)) {
        damageDestructible(d, b.damage, b);
        return 1;
      }
    }
  }
  for (const e of A.enemies) {
    if (e.dead || e.area !== area) continue;
    const p = e.group.position;
    const r = e.radius + b.radius;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    if (dx * dx + dz * dz < r * r && Math.abs(b.y - (p.y + 0.6)) < 2.5) {
      damageEnemy(e, b.damage, b);
      return 1;
    }
  }
  const boss = A.boss;
  if (boss && !boss.dead && area === 'external') {
    const res = bossHitTest(boss, b);
    if (res === 1) {
      damageBoss(boss, b.damage, b);
      return 1;
    }
    if (res === 2) {
      burst(b.x, b.y, b.z, 0xffa35b, 2, 0.06);
      audio.beep(900, 0.03, 'square', 0.006, -300);
      return 2;
    }
  }
  if (shotBlocked(b.x, b.z, area)) {
    burst(b.x, b.y - 0.4, b.z, 0x9fdfff, 2, 0.05);
    return 2;
  }
  return 0;
}
function updatePlayerBolts(pool, dt) {
  for (let i = pool.n - 1; i >= 0; i--) {
    const b = pool.items[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.spin += dt * 9;
    let hit = b.life <= 0;
    if (!hit) {
      const res = boltHits(b);
      if (res === 1) stats.hits++;
      hit = res !== 0;
    }
    if (hit) killBolt(pool, i);
  }
}
function updateEnemyBolts(dt) {
  const tgt = activeObject().position;
  const rad = activeRadius();
  for (let i = enemyBolts.n - 1; i >= 0; i--) {
    const b = enemyBolts.items[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.spin += dt * 7;
    let hit = b.life <= 0;
    if (!hit && b.area === player.area) {
      const dx = b.x - tgt.x;
      const dz = b.z - tgt.z;
      const r = rad + b.radius;
      if (dx * dx + dz * dz < r * r) {
        damagePlayer(b.damage);
        hit = true;
      } else if (shotBlocked(b.x, b.z, b.area)) {
        burst(b.x, b.y - 0.4, b.z, 0xe65bc5, 2, 0.05);
        hit = true;
      }
    }
    if (hit) killBolt(enemyBolts, i);
  }
}
function fireEnemy(x, z, area, angle, speed = 10, damage = 11) {
  spawnBolt(enemyBolts, x, 1, z, angle, speed, damage, 0.16, 2.8, area, 0.25);
}

function lobShell(e, tx, tz) {
  const s = shells.find((x) => !x.on);
  if (!s) return;
  const b = boundsFor(e.area);
  s.on = true;
  s.sx = e.group.position.x;
  s.sz = e.group.position.z;
  s.tx = clamp(tx, b.minX, b.maxX);
  s.tz = clamp(tz, b.minZ, b.maxZ);
  s.t = 0;
  s.dur = 1.3;
  s.dmg = 15;
  s.area = e.area;
  s.ring = takeRing(s.tx, s.tz, 0.6);
  audio.beep(95, 0.16, 'square', 0.02, 70);
}
function updateShells(dt) {
  for (const s of shells) {
    if (!s.on) continue;
    s.t += dt;
    const k = s.t / s.dur;
    if (s.ring) s.ring.scale.setScalar(0.6 + 0.4 * Math.min(1, k) + Math.sin(s.t * 18) * 0.04);
    if (k < 1) continue;
    s.on = false;
    if (s.ring) s.ring.visible = false;
    s.ring = null;
    burst(s.tx, 0.1, s.tz, 0xff5a3a, 9, 0.12);
    audio.boom(0.6);
    if (s.area === player.area) {
      const o = activeObject().position;
      const d = Math.hypot(o.x - s.tx, o.z - s.tz);
      if (d < 1.9 + activeRadius() * 0.5) damagePlayer(s.dmg);
      if (d < 7) addShake(0.12);
    }
  }
}

// ---------------------------------------------------------------- enemies
function spawnEnemy(id, x, z, type, area = 'external') {
  const base = ENEMY[type] || ENEMY.skitter;
  const group = M.enemy(type);
  group.position.set(x, 0, z);
  A.root.add(group);
  const hp = base.hp * diff.hp;
  const e = {
    id, type, area, group, hp, maxHp: hp, speed: base.speed, radius: base.radius,
    fireTimer: 0.4 + Math.random() * 1.3, touchTimer: 0, dead: false, state: 'idle', t: 0, pop: 0,
    sx: 0, sz: 0, tx: 0, tz: 0, walk: Math.random() * 6,
  };
  A.enemies.push(e);
  return e;
}

function updateEnemies(dt) {
  const tgt = activeObject().position;
  for (const e of A.enemies) {
    if (e.dead || e.area !== player.area) continue;
    if (e.pop > 0) {
      e.pop = Math.max(0, e.pop - dt * 6);
      e.group.scale.setScalar(1 + e.pop * 0.16);
    }
    if (e.type === 'hopper') updateHopper(e, dt, tgt);
    else if (e.type === 'mortar') updateMortar(e, dt, tgt);
    else updateWalker(e, dt, tgt);
  }
}

function updateWalker(e, dt, tgt) {
  e.fireTimer -= dt;
  e.touchTimer = Math.max(0, e.touchTimer - dt);
  const p = e.group.position;
  const dx = tgt.x - p.x;
  const dz = tgt.z - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= 11.5 || dist < 0.001) return;
  const nx = dx / dist;
  const nz = dz / dist;
  if (e.speed > 0 && dist > 2.3) {
    moveEntity(e.group, nx * e.speed * dt, nz * e.speed * dt, e.radius, e.area, true);
    e.walk += dt * 14;
    p.y = Math.abs(Math.sin(e.walk)) * 0.06;
  }
  e.group.rotation.y = Math.atan2(nx, nz);
  if (e.fireTimer <= 0 && dist < 9.2) {
    e.fireTimer = (e.type === 'turret' ? 1.35 : 1.8 + Math.random() * 0.45) * diff.fire;
    fireEnemy(p.x, p.z, e.area, Math.atan2(nx, nz), 9.5, e.type === 'turret' ? 13 : 10);
    audio.beep(120, 0.04, 'sawtooth', 0.007, 35);
  }
  if (dist < 1.15 + activeRadius() && e.touchTimer <= 0) {
    damagePlayer(9);
    e.touchTimer = 0.8;
  }
}

/** Hopper: walks in, crouches (the tell), then leaps to where the player stood. */
function updateHopper(e, dt, tgt) {
  const p = e.group.position;
  const body = e.group.userData.body;
  e.touchTimer = Math.max(0, e.touchTimer - dt);
  const dx = tgt.x - p.x;
  const dz = tgt.z - p.z;
  const dist = Math.hypot(dx, dz);
  if (e.state === 'leap') {
    e.t += dt;
    const k = Math.min(1, e.t / 0.55);
    const x = e.sx + (e.tx - e.sx) * k;
    const z = e.sz + (e.tz - e.sz) * k;
    if (!hitCollider(x, z, e.radius, e.area)) {
      p.x = x;
      p.z = z;
    } else {
      e.sx = e.tx = p.x;
      e.sz = e.tz = p.z;
    }
    p.y = Math.sin(k * Math.PI) * 1.8;
    if (k >= 1) {
      p.y = 0;
      e.state = 'recover';
      e.t = 0;
      burst(p.x, 0, p.z, 0xb08060, 5, 0.08);
      audio.beep(70, 0.12, 'square', 0.02, -20);
      if (Math.hypot(tgt.x - p.x, tgt.z - p.z) < 1.5 + activeRadius()) damagePlayer(12);
    }
    return;
  }
  if (e.state === 'crouch') {
    e.t += dt;
    body.scale.y = 1 - Math.min(1, e.t / 0.45) * 0.35;
    if (dist > 0.001) e.group.rotation.y = Math.atan2(dx, dz);
    if (e.t >= 0.45) {
      body.scale.y = 1;
      e.state = 'leap';
      e.t = 0;
      e.sx = p.x;
      e.sz = p.z;
      const reach = Math.min(dist, 7);
      const b = boundsFor(e.area);
      e.tx = clamp(p.x + (dx / (dist || 1)) * reach, b.minX + e.radius, b.maxX - e.radius);
      e.tz = clamp(p.z + (dz / (dist || 1)) * reach, b.minZ + e.radius, b.maxZ - e.radius);
      audio.beep(240, 0.14, 'triangle', 0.016, 260);
    }
    return;
  }
  if (e.state === 'recover') {
    e.t += dt;
    if (e.t > 1.5 * diff.fire) e.state = 'idle';
  }
  if (dist >= 12 || dist < 0.001) return;
  const nx = dx / dist;
  const nz = dz / dist;
  e.group.rotation.y = Math.atan2(nx, nz);
  if (e.state === 'idle' && dist < 7.5 && dist > 1.6) {
    e.state = 'crouch';
    e.t = 0;
    return;
  }
  if (dist > 2) {
    moveEntity(e.group, nx * e.speed * dt, nz * e.speed * dt, e.radius, e.area, true);
    e.walk += dt * 10;
    p.y = Math.abs(Math.sin(e.walk)) * 0.1;
  }
  if (dist < 1.1 + activeRadius() && e.touchTimer <= 0) {
    damagePlayer(8);
    e.touchTimer = 0.8;
  }
}

/** Mortar: stationary, lobs a shell at the player's spot; the ring shows where it lands. */
function updateMortar(e, dt, tgt) {
  const p = e.group.position;
  const dx = tgt.x - p.x;
  const dz = tgt.z - p.z;
  const dist = Math.hypot(dx, dz);
  e.fireTimer -= dt;
  if (dist >= 14) return;
  e.group.rotation.y = Math.atan2(dx, dz);
  if (e.fireTimer <= 0 && dist > 2.5) {
    e.fireTimer = 2.7 * diff.fire;
    e.pop = 0.7;
    lobShell(e, tgt.x, tgt.z);
  }
  if (dist < 1.2 + activeRadius()) {
    if (e.touchTimer <= 0) {
      damagePlayer(7);
      e.touchTimer = 0.8;
    }
  }
  e.touchTimer = Math.max(0, e.touchTimer - dt);
}

function damageEnemy(e, amount, b) {
  if (e.dead) return;
  e.hp -= amount;
  e.pop = 1;
  burst(b.x, b.y - 0.3, b.z, 0xff875f, 3, 0.06);
  audio.beep(520, 0.03, 'square', 0.008, -200);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  A.root.remove(e.group);
  const p = e.group.position;
  burst(p.x, p.y, p.z, 0xff8e54, 8, 0.11);
  audio.boom(0.45);
  addShake(0.1);
  input.rumble(0.25, 70);
  stats.kills++;
  const base = ENEMY[e.type] || ENEMY.skitter;
  gainXP(base.xp + (e.area === 'interior' ? 2 : 0));
  player.scrap += base.scrap;
  if (Math.random() < 0.18) spawnPickup(null, p.x, p.z, 'health', 18, e.area);
  if (e.area === 'interior') checkInterior();
}

function gainXP(amount) {
  if (player.level >= MAX_LEVEL) return;
  player.xp += amount;
  while (player.xp >= player.nextXp && player.level < MAX_LEVEL) {
    player.xp -= player.nextXp;
    player.level++;
    player.nextXp = Math.round(player.nextXp * 1.55);
    player.maxHealth += 15;
    player.health = Math.min(player.maxHealth, player.health + 28);
    player.damageMul *= 1.1;
    toast(`LEVEL ${player.level} · HULL +15 · DAMAGE +10%`, 1.8);
    audio.beep(520, 0.22, 'triangle', 0.04, 250);
    const o = activeObject().position;
    burst(o.x, 0.6, o.z, 0xb8ff64, 12, 0.1);
  }
  if (player.level >= MAX_LEVEL) player.xp = 0;
}

// ---------------------------------------------------------------- destructibles and route
function damageDestructible(d, amount, b) {
  d.hp -= amount;
  d.pop = 1;
  burst(b.x, b.y - 0.3, b.z, d.color, 4, 0.07);
  if (d.hp <= 0) destroyDestructible(d, false);
}
function destroyDestructible(d, silent) {
  if (!d.alive) return;
  d.alive = false;
  d.collider.enabled = false;
  A.root.remove(d.group);
  let left = 0;
  for (const x of A.destructibles) if (x.alive) left++;
  if (!silent) {
    burst(d.x, d.y, d.z, d.deathColor, 20, 0.16);
    audio.beep(150, 0.32, 'sawtooth', 0.05, 260);
    audio.boom(1);
    addShake(0.35);
    input.rumble(0.5, 200);
    if (left > 0) {
      toast(`SLAG PYLON DOWN · ${left} LEFT`, 1.6);
      refreshObjective();
    }
  }
  if (left === 0) routeOpen(silent);
}
function routeOpen(silent) {
  if (mission.route) return;
  mission.route = true;
  mission.stage = Math.max(mission.stage, 1);
  if (A.routeWall) {
    A.routeWall.collider.enabled = false;
    A.routeWall.field.visible = false;
  }
  const cp = A.def.checkpoints.route;
  player.checkpoint.set(cp[0], 0, cp[1]);
  if (silent) return;
  if (A.routeWall) burst(A.routeWall.x, 1.4, 0, 0xff7a2a, 16, 0.14);
  refreshObjective();
  toast(A.def.toasts.route, 1.8);
  saveRun();
}

// ---------------------------------------------------------------- vault, item, gate
function enterBunker() {
  player.area = 'interior';
  player.mode = 'pilot';
  pilot.visible = true;
  pilot.position.set(INTERIOR_SPAWN.x, 0, INTERIOR_SPAWN.z);
  pilot.rotation.set(0, Math.PI, 0);
  aimDir.set(0, 0, -1);
  clearEnemyFire();
  mission.stage = Math.max(mission.stage, 2);
  if (!mission.interiorSpawned) spawnWave(0);
  refreshObjective();
  toast(`${A.def.vault} · TOP-DOWN COMBAT`);
  fadeFlash();
  snapCamera();
  audio.beep(160, 0.25, 'triangle', 0.03, -80);
}
function exitBunker() {
  player.area = 'external';
  pilot.position.set(A.exit.x, 0, A.exit.z);
  pilot.rotation.set(0, 0, 0);
  clearEnemyFire();
  if (mission.item) mission.exited = true;
  refreshObjective();
  toast('SURFACE LINK RESTORED');
  fadeFlash();
  snapCamera();
  audio.beep(220, 0.25, 'triangle', 0.03, 120);
}
function spawnWave(i) {
  const list = A.waves[i];
  if (!list) return;
  mission.interiorSpawned = true;
  mission.wave = i;
  for (const [id, x, z, type] of list) {
    spawnEnemy(id, x, z, type, 'interior');
    burst(x, 0.2, z, 0xff5a66, 6, 0.1);
  }
  if (i > 0) {
    toast('SECOND SECURITY WAVE', 1.4);
    audio.beep(110, 0.35, 'sawtooth', 0.035, 120);
  }
}
function checkInterior() {
  if (!mission.interiorSpawned || mission.itemSpawned || mission.waveTimer > 0) return;
  for (const e of A.enemies) if (!e.dead && e.area === 'interior') return;
  if (mission.wave + 1 < A.waves.length) {
    mission.waveTimer = 1.4;
    toast('SECURITY WAVE INBOUND', 1.2);
  } else {
    mission.itemSpawned = true;
    spawnPickup(null, A.item.x, A.item.z, 'item', 1, 'interior');
    refreshObjective();
    toast(`${A.def.vault} SECURITY OFFLINE`);
    audio.beep(330, 0.3, 'triangle', 0.035, 200);
  }
}
function openGate(silent = false) {
  if (mission.gateOpen || !A.gate) return;
  mission.gateOpen = true;
  mission.stage = 4;
  A.gate.collider.enabled = false;
  A.gate.field.visible = false;
  if (A.terminal) A.terminal.glow.material = mat.lime;
  const cp = A.def.checkpoints.gate;
  player.checkpoint.set(cp[0], 0, cp[1]);
  if (silent) return;
  refreshObjective();
  toast(A.def.toasts.gate, 1.8);
  audio.beep(210, 0.4, 'sawtooth', 0.04, 300);
  burst(A.gate.x, 1.4, 0, 0x47eaff, 18, 0.14);
  addShake(0.25);
  input.rumble(0.4, 180);
  saveRun();
}
function buyUpgrade() {
  const next = UPGRADES[player.weapon];
  if (!next) {
    patchHull();
    return;
  }
  if (player.scrap < next.cost) {
    toast(`${next.name} NEEDS ${next.cost} SCRAP · YOU HAVE ${player.scrap}`);
    audio.beep(140, 0.12, 'square', 0.02, -40);
    return;
  }
  player.scrap -= next.cost;
  player.weapon++;
  toast(next.toast, 1.8);
  audio.beep(410, 0.18, 'square', 0.035, 190);
  burst(A.tinker.x, 1.6, A.tinker.z, 0x4cecff, 12, 0.1);
  input.rumble(0.3, 120);
}
function patchHull() {
  if (player.health >= player.maxHealth) {
    toast('TINKER PAD · FULLY FITTED');
    return;
  }
  if (player.scrap < REPAIR.cost) {
    toast(`HULL PATCH NEEDS ${REPAIR.cost} SCRAP · YOU HAVE ${player.scrap}`);
    audio.beep(140, 0.12, 'square', 0.02, -40);
    return;
  }
  player.scrap -= REPAIR.cost;
  const before = player.health;
  player.health = Math.min(player.maxHealth, player.health + REPAIR.amount);
  toast(`HULL PATCHED +${Math.round(player.health - before)}`, 1.4);
  audio.beep(500, 0.14, 'triangle', 0.03, 160);
  burst(A.tinker.x, 1.6, A.tinker.z, 0xb8ff64, 10, 0.09);
  input.rumble(0.2, 80);
}
const weaponName = () => (player.weapon >= 2 ? 'ARC SPLITTER' : player.weapon === 1 ? 'COIL BARREL MK II' : player.mode === 'rover' ? 'SPARK CANNON' : 'PULSE TOOL');

// ---------------------------------------------------------------- pickups
function spawnPickup(id, x, z, type, amount, area = 'external') {
  const group = M.pickup(type);
  group.position.set(x, 0, z);
  A.root.add(group);
  A.pickups.push({ id, group, type, area, amount, t: Math.random() * 6, dead: false });
}
function updatePickups(dt) {
  const o = activeObject().position;
  const rr = activeRadius();
  for (const p of A.pickups) {
    if (p.dead || p.area !== player.area) continue;
    p.t += dt;
    const g = p.group.position;
    p.group.rotation.y += dt * 1.5;
    g.y = Math.sin(p.t * 2.1) * 0.16;
    // Health waits for you while the hull is full.
    if (p.type === 'health' && player.health >= player.maxHealth) continue;
    const dx = o.x - g.x;
    const dz = o.z - g.z;
    const d = Math.hypot(dx, dz);
    if (d < 1.25 + rr) collect(p);
    else if (d < 3.4 && p.type !== 'item') {
      g.x += (dx / d) * dt * 4.5;
      g.z += (dz / d) * dt * 4.5;
    }
  }
}
function collect(p) {
  p.dead = true;
  A.root.remove(p.group);
  audio.beep(600, 0.09, 'triangle', 0.025, 140);
  const g = p.group.position;
  if (p.type === 'scrap') {
    player.scrap += p.amount;
    toast(`SALVAGE +${p.amount}`, 0.8);
    burst(g.x, 0.4, g.z, 0xf17a33, 5, 0.07);
  } else if (p.type === 'health') {
    player.health = Math.min(player.maxHealth, player.health + p.amount);
    toast(`HULL REPAIR +${p.amount}`, 0.8);
    burst(g.x, 0.4, g.z, 0xb8ff64, 5, 0.07);
  } else if (p.type === 'item') {
    mission.item = true;
    mission.stage = 3;
    refreshObjective();
    toast(`${A.def.item} ACQUIRED`, 1.6);
    burst(g.x, 0.7, g.z, 0x4cecff, 14, 0.1);
    input.rumble(0.4, 160);
    const cp = A.def.checkpoints.item;
    player.checkpoint.set(cp[0], 0, cp[1]);
    saveRun();
  }
}

// ---------------------------------------------------------------- bosses
function spawnBoss() {
  const def = A.def;
  const ar = A.arena;
  if (def.boss === 'mole') {
    const hp = 360 * diff.boss;
    const g = M.mole();
    g.position.set(ar.x, 0, ar.z);
    A.root.add(g);
    A.boss = { kind: 'mole', group: g, hp, maxHp: hp, radius: 2.6, fireTimer: 1.4, chargeTimer: 2.8, coreOpen: 0, phase: 1, dead: false, dash: 0, dx: 0, dz: 0, pop: 0 };
  } else {
    const hp = 600 * diff.boss;
    const g = M.worm();
    A.root.add(g);
    A.boss = {
      kind: 'worm', group: g, hp, maxHp: hp, radius: 1.7, phase: 1, dead: false, state: 'under', t: 0, up: 0,
      x: ar.x + 4, z: ar.z, angle: -Math.PI / 2, fireTimer: 1, dust: 0, ring: null, pop: 0,
    };
    poseWorm(A.boss);
  }
  showBossBar(def.bossName);
  toast(`WARNING · ${def.bossName}`, 2.2);
  audio.beep(90, 0.55, 'sawtooth', 0.05, 90);
  addShake(0.3);
}
function clampToArena(p) {
  const ar = A.arena;
  const dx = p.x - ar.x;
  const dz = p.z - ar.z;
  const d = Math.hypot(dx, dz);
  if (d > ar.r) {
    p.x = ar.x + (dx / d) * ar.r;
    p.z = ar.z + (dz / d) * ar.r;
  }
}
function updateBoss(dt) {
  const b = A.boss;
  if (!b || b.dead) return;
  if (b.pop > 0) b.pop = Math.max(0, b.pop - dt * 5);
  if (player.area !== 'external') return;
  if (b.kind === 'mole') updateMole(b, dt, activeObject().position);
  else updateWorm(b, dt, activeObject().position);
}
function updateMole(b, dt, tgt) {
  const ud = b.group.userData;
  const p = b.group.position;
  b.fireTimer -= dt;
  b.chargeTimer -= dt;
  b.coreOpen = Math.max(0, b.coreOpen - dt);
  const phase = b.hp < b.maxHp * 0.48 ? 2 : 1;
  if (phase !== b.phase) {
    b.phase = phase;
    toast('M.O.L.E. OVERDRIVE', 1.4);
    audio.beep(70, 0.6, 'sawtooth', 0.05, 60);
  }
  const p2 = b.phase === 2;
  ud.ring.rotation.z += dt * (p2 ? 3.2 : 1.8);
  ud.core.scale.setScalar((b.coreOpen > 0 ? 1.35 : 1) + Math.sin(clock * 8) * 0.12);
  ud.drill.rotation.y += dt * (b.coreOpen > 0 ? 18 : 6);
  b.group.scale.setScalar(1 + b.pop * 0.03);
  const dx = tgt.x - p.x;
  const dz = tgt.z - p.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const nx = dx / dist;
  const nz = dz / dist;
  b.group.rotation.y = Math.atan2(nx, nz);
  if (b.dash > 0) {
    const step = Math.min(b.dash, dt);
    b.dash -= step;
    p.x += b.dx * step;
    p.z += b.dz * step;
    clampToArena(p);
  }
  if (b.chargeTimer <= 0) {
    // The charge: a short lunge, after which the core stays open.
    b.chargeTimer = p2 ? 2.1 : 3.0;
    b.coreOpen = p2 ? 1.6 : 1.25;
    const reach = Math.min(3.0, dist * 0.28);
    b.dash = 0.25;
    b.dx = (nx * reach) / 0.25;
    b.dz = (nz * reach) / 0.25;
    toast('CORE EXPOSED', 0.8);
    audio.beep(170, 0.18, 'sawtooth', 0.025, 170);
    addShake(0.2);
  }
  if (b.fireTimer <= 0) {
    b.fireTimer = (p2 ? 1.05 : 1.55) * diff.fire;
    const count = p2 ? 7 : 5;
    const base = Math.atan2(nx, nz);
    for (let i = 0; i < count; i++) fireEnemy(p.x, p.z, 'external', base + (i - (count - 1) / 2) * 0.22, p2 ? 11.5 : 9.5, p2 ? 12 : 10);
    audio.beep(120, 0.08, 'sawtooth', 0.02, 40);
  }
  if (dist < 3.1 + activeRadius()) damagePlayer(p2 ? 16 : 13);
}

const wormVulnerable = (w) => w.state === 'up' || (w.state === 'rise' && w.up > 0.6) || (w.state === 'dive' && w.up > 0.5);
function updateWorm(b, dt, tgt) {
  b.t += dt;
  const phase = b.hp < b.maxHp * 0.5 ? 2 : 1;
  if (phase !== b.phase) {
    b.phase = phase;
    toast('BURROWER ENRAGED · DRONES INBOUND', 1.6);
    audio.beep(60, 0.7, 'sawtooth', 0.05, 50);
    const ar = A.arena;
    const away = Math.atan2(ar.x - tgt.x, ar.z - tgt.z);
    for (const s of [-0.9, 0.9]) {
      const x = ar.x + Math.sin(away + s) * 5.5;
      const z = ar.z + Math.cos(away + s) * 5.5;
      spawnEnemy(null, clamp(x, OUT_BOUNDS.minX + 1, OUT_BOUNDS.maxX - 1), clamp(z, OUT_BOUNDS.minZ + 1, OUT_BOUNDS.maxZ - 1), 'hopper', 'external');
      burst(x, 0.3, z, 0xb08060, 10, 0.12);
    }
  }
  const p2 = b.phase === 2;
  const dx = tgt.x - b.x;
  const dz = tgt.z - b.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  if (b.state === 'under') {
    const sp = p2 ? 6.2 : 4.6;
    if (dist > 0.4) {
      b.x += (dx / dist) * sp * dt;
      b.z += (dz / dist) * sp * dt;
      _v.set(b.x, 0, b.z);
      clampToArena(_v);
      b.x = _v.x;
      b.z = _v.z;
    }
    b.dust -= dt;
    if (b.dust <= 0) {
      b.dust = 0.12;
      burst(b.x, 0, b.z, 0x8a6a52, 2, 0.08);
    }
    if (b.t >= (p2 ? 1.9 : 2.6)) {
      b.state = 'rise';
      b.t = 0;
      b.angle = Math.atan2(dx, dz);
      b.ring = takeRing(b.x, b.z, 1.75);
      audio.beep(55, 0.5, 'sawtooth', 0.04, 30);
    }
  } else if (b.state === 'rise') {
    b.up = Math.min(1, b.t / 0.55);
    if (b.ring) b.ring.scale.setScalar(1.75 + Math.sin(b.t * 30) * 0.08);
    if (b.t >= 0.55) {
      b.state = 'up';
      b.t = 0;
      b.up = 1;
      b.fireTimer = 0.7;
      if (b.ring) b.ring.visible = false;
      b.ring = null;
      // Breaching: shockwave plus a ring of bolts.
      if (dist < 3.2 + activeRadius()) damagePlayer(p2 ? 18 : 14);
      const count = p2 ? 14 : 10;
      for (let i = 0; i < count; i++) fireEnemy(b.x, b.z, 'external', (i / count) * Math.PI * 2 + b.angle, 8.5, 10);
      burst(b.x, 0.3, b.z, 0x8a6a52, 16, 0.16);
      burst(b.x, 1, b.z, 0xff7a2a, 10, 0.12);
      audio.boom(1.4);
      addShake(0.5);
      input.rumble(0.6, 260);
    }
  } else if (b.state === 'up') {
    b.angle += wrapAngle(Math.atan2(dx, dz) - b.angle) * Math.min(1, dt * 4);
    b.fireTimer -= dt;
    if (b.fireTimer <= 0) {
      b.fireTimer = (p2 ? 0.75 : 1.0) * diff.fire;
      for (const s of [-0.18, 0, 0.18]) fireEnemy(b.x + Math.sin(b.angle) * 1.2, b.z + Math.cos(b.angle) * 1.2, 'external', b.angle + s, 10.5, 11);
      audio.beep(140, 0.07, 'sawtooth', 0.02, 60);
    }
    if (dist < 2.2 + activeRadius()) damagePlayer(14);
    if (b.t >= (p2 ? 2.3 : 2.8)) {
      b.state = 'dive';
      b.t = 0;
    }
  } else if (b.state === 'dive') {
    b.up = Math.max(0, 1 - b.t / 0.5);
    if (b.t >= 0.5) {
      b.state = 'under';
      b.t = 0;
      b.up = 0;
      burst(b.x, 0.2, b.z, 0x8a6a52, 10, 0.12);
    }
  }
  poseWorm(b);
}
function poseWorm(b) {
  const ud = b.group.userData;
  const headY = -2.8 + b.up * 4.6;
  ud.head.position.set(b.x, headY, b.z);
  ud.head.rotation.y = b.angle;
  ud.head.scale.setScalar(1 + b.pop * 0.06);
  ud.head.visible = headY > -1.9;
  ud.core.scale.setScalar(1 + Math.sin(clock * 9) * 0.14);
  const bx = -Math.sin(b.angle);
  const bz = -Math.cos(b.angle);
  const spread = 0.95 * (0.4 + 0.6 * b.up);
  for (let i = 0; i < ud.segs.length; i++) {
    const k = i + 1;
    const s = ud.segs[i];
    const y = headY - k * 0.7 + Math.sin(clock * 6 + k) * 0.08;
    s.position.set(b.x + bx * k * spread, y, b.z + bz * k * spread);
    s.visible = y > -1.4;
  }
  ud.mound.position.set(b.x, 0, b.z);
  ud.mound.visible = b.state === 'under' || b.state === 'rise';
}
function bossHitTest(boss, b) {
  if (boss.kind === 'mole') {
    const p = boss.group.position;
    const r = boss.radius + b.radius;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    return dx * dx + dz * dz < r * r && Math.abs(b.y - 1.4) < 2.5 ? 1 : 0;
  }
  if (boss.state === 'under') return 0;
  const h = boss.group.userData.head.position;
  const r = boss.radius + b.radius;
  const dx = b.x - h.x;
  const dz = b.z - h.z;
  if (dx * dx + dz * dz > r * r || Math.abs(b.y - h.y) > 2.2) return 0;
  return wormVulnerable(boss) ? 1 : 2;
}
function damageBoss(boss, amount, b) {
  if (boss.dead) return;
  if (boss.kind === 'mole') {
    const armored = boss.coreOpen <= 0;
    amount *= armored ? 0.46 : 1;
    burst(b.x, b.y - 0.3, b.z, armored ? 0xffa35b : 0xff4bc4, armored ? 3 : 6, 0.07);
    if (armored && clock > armorHint) {
      armorHint = clock + 4;
      toast('ARMORED · HIT AFTER ITS CHARGE TO EXPOSE CORE', 1.1);
    }
  } else {
    burst(b.x, b.y - 0.3, b.z, 0xff4bc4, 6, 0.07);
  }
  boss.hp -= amount;
  boss.pop = 1;
  audio.beep(260, 0.03, 'square', 0.01, -120);
  if (boss.hp <= 0) killBoss(boss);
  updateBossBar();
}
function killBoss(boss) {
  boss.dead = true;
  boss.hp = 0;
  const p = boss.kind === 'mole' ? boss.group.position : boss.group.userData.head.position;
  burst(p.x, 1.2, p.z, 0xff5a66, 26, 0.22);
  burst(p.x, 1.6, p.z, 0xffb347, 18, 0.16);
  if (boss.ring) boss.ring.visible = false;
  A.root.remove(boss.group);
  audio.boom(2);
  addShake(1);
  input.rumble(1, 450);
  completeMission();
}
function showBossBar(name) {
  setText(ui.bossName, name);
  ui.boss.hidden = false;
  updateBossBar();
}
function hideBossBar() {
  ui.boss.hidden = true;
}
function updateBossBar() {
  const b = A?.boss;
  if (b) setWidth(ui.bossFill, (Math.max(0, b.hp) / b.maxHp) * 100);
}

// ---------------------------------------------------------------- player
function damagePlayer(amount) {
  if (player.invuln > 0 || player.shield > 0 || mission.complete || state !== 'play') return;
  player.invuln = 0.34;
  player.health -= amount * diff.dmg;
  audio.beep(80, 0.11, 'square', 0.04, -30);
  const o = activeObject().position;
  burst(o.x, o.y, o.z, 0xff4f55, 5, 0.08);
  hurtFlash();
  addShake(0.22);
  input.rumble(0.45, 110);
  if (player.health <= 0) respawnPlayer();
}
function respawnPlayer() {
  player.deaths++;
  const loss = Math.min(player.scrap, diff.loss);
  player.health = player.maxHealth;
  player.boost = 100;
  player.scrap -= loss;
  clearEnemyFire();
  if (player.area === 'interior') {
    player.mode = 'pilot';
    pilot.visible = true;
    pilot.position.set(INTERIOR_SPAWN.x, 0, INTERIOR_SPAWN.z);
  } else {
    player.mode = 'rover';
    pilot.visible = false;
    rover.visible = true;
    rover.position.copy(player.checkpoint);
  }
  player.shield = 1.6;
  player.invuln = 0;
  const boss = A.boss;
  if (boss && !boss.dead) {
    boss.hp = Math.min(boss.maxHp, boss.hp + 50 * diff.boss);
    if (boss.kind === 'worm') {
      boss.state = 'under';
      boss.t = 0;
      boss.up = 0;
      boss.x = A.arena.x + 5;
      boss.z = A.arena.z;
      if (boss.ring) boss.ring.visible = false;
      boss.ring = null;
      poseWorm(boss);
    }
    updateBossBar();
  }
  toast(`RECONSTRUCTED · ${loss} SCRAP LOST`, 1.8);
  audio.beep(300, 0.3, 'triangle', 0.03, 200);
  fadeFlash();
  snapCamera();
  refreshObjective();
}

const DISMOUNT_SPOTS = [[1.55, 0.2], [-1.55, 0.2], [0, -2.1], [0, 2.1], [1.6, -1.6], [-1.6, -1.6]];
function dismount() {
  if (player.mode !== 'rover') return;
  const r = rover.position;
  const ry = rover.rotation.y;
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  let px = r.x;
  let pz = r.z;
  // Step out on the first side that is free: never into a wall, lava or off the map.
  for (const [ox, oz] of DISMOUNT_SPOTS) {
    const x = r.x + ox * c + oz * s;
    const z = r.z - ox * s + oz * c;
    const b = OUT_BOUNDS;
    if (x < b.minX + 0.5 || x > b.maxX - 0.5 || z < b.minZ + 0.5 || z > b.maxZ - 0.5) continue;
    if (hitCollider(x, z, 0.44, 'external') || hazardAt(x, z, 'external')) continue;
    px = x;
    pz = z;
    break;
  }
  player.mode = 'pilot';
  pilot.visible = true;
  pilot.position.set(px, 0, pz);
  pilot.rotation.set(0, ry, 0);
  toast('PILOT MODE');
  audio.beep(260, 0.08, 'triangle', 0.02, -60);
}
function mount() {
  if (player.mode !== 'pilot' || player.area !== 'external') return;
  player.mode = 'rover';
  pilot.visible = false;
  toast('CRAWLER LINKED');
  audio.beep(200, 0.12, 'triangle', 0.025, 120);
}

const INTERACT = {
  exit: { label: () => 'RETURN TO SURFACE', ready: () => true, run: () => exitBunker() },
  dismount: {
    label: () => (A.door && Math.hypot(rover.position.x - A.door.x, rover.position.z - A.door.z) < 4.4 ? 'DISMOUNT FOR VAULT ACCESS' : 'DISMOUNT'),
    ready: () => true,
    run: () => dismount(),
  },
  board: { label: () => 'BOARD CRAWLER', ready: () => true, run: () => mount() },
  door: { label: () => `ENTER ${A.def.vault}`, ready: () => true, run: () => enterBunker() },
  terminal: {
    label: () => (mission.gateOpen ? 'GATE TERMINAL · ONLINE' : mission.item ? `INSTALL ${A.def.item}` : `GATE TERMINAL · ${A.def.itemShort} MISSING`),
    ready: () => mission.item && !mission.gateOpen,
    run: () => openGate(),
  },
  tinker: {
    label: () =>
      UPGRADES[player.weapon]
        ? `${UPGRADES[player.weapon].name} · ${UPGRADES[player.weapon].cost} SCRAP`
        : player.health < player.maxHealth
          ? `PATCH HULL +${REPAIR.amount} · ${REPAIR.cost} SCRAP`
          : 'TINKER PAD · FULLY FITTED',
    ready: () => !!UPGRADES[player.weapon] || player.health < player.maxHealth,
    run: () => buyUpgrade(),
  },
};
/** The one interaction in reach. A real action (door, terminal, pad) wins over re-boarding the Crawler. */
function findInteraction() {
  const o = activeObject().position;
  if (player.area === 'interior') {
    return Math.hypot(o.x - A.exitDoor.x, o.z - A.exitDoor.z) < 2.25 ? INTERACT.exit : null;
  }
  if (player.mode === 'rover') return INTERACT.dismount;
  let best = null;
  let bestD = Infinity;
  const consider = (spot, r, item) => {
    if (!spot) return;
    const d = Math.hypot(o.x - spot.x, o.z - spot.z);
    if (d < r && d < bestD) {
      best = item;
      bestD = d;
    }
  };
  consider(A.door, 2.3, INTERACT.door);
  consider(A.terminal, 2.3, INTERACT.terminal);
  consider(A.tinker, 2.35, INTERACT.tinker);
  if (best && best.ready()) return best;
  if (Math.hypot(o.x - rover.position.x, o.z - rover.position.z) < 2.35) return INTERACT.board;
  return best;
}

function cameraOffset(out, d) {
  if (player.area === 'interior') return out.set(0, d * 1.15, d * 0.38);
  return out.set(-d * 0.72, d * 0.78, d * 0.84);
}
/** Movement is camera-relative; the basis comes from the fixed camera offset, not the shaking camera. */
function updateBasis() {
  cameraOffset(_v2, 1);
  fwd.set(-_v2.x, 0, -_v2.z).normalize();
  right.set(-fwd.z, 0, fwd.x);
}

function updateAim(dt, wx, wz, moving) {
  const st = input.vector('aim');
  aimStickLen = Math.hypot(st.x, st.y);
  const P = input.pointer;
  if (P.type === 'mouse' && (P.x !== lastPX || P.y !== lastPY)) {
    lastPX = P.x;
    lastPY = P.y;
    if (input.source === 'keyboard') mouseAim = true;
  }
  if (input.source !== 'keyboard') mouseAim = false;
  const o = activeObject().position;
  if (aimStickLen > 0.2) {
    aimDir.set(right.x * st.x + fwd.x * st.y, 0, right.z * st.x + fwd.z * st.y).normalize();
  } else if (mouseAim) {
    _ndc.set(P.nx, P.ny);
    raycaster.setFromCamera(_ndc, camera);
    if (raycaster.ray.intersectPlane(aimPlane, _hit)) {
      const ax = _hit.x - o.x;
      const az = _hit.z - o.z;
      if (ax * ax + az * az > 0.01) aimDir.set(ax, 0, az).normalize();
    }
  } else if (moving) {
    // No mouse and no aim stick: aim swings toward where you drive.
    const k = Math.min(1, dt * 10);
    aimDir.x += (wx - aimDir.x) * k;
    aimDir.z += (wz - aimDir.z) * k;
    if (aimDir.lengthSq() < 0.0001) aimDir.set(wx, 0, wz);
    aimDir.normalize();
  }
  const yaw = Math.atan2(aimDir.x, aimDir.z);
  if (player.mode === 'rover') rover.userData.turret.rotation.y = wrapAngle(yaw - rover.rotation.y);
  else pilot.rotation.y = yaw;
}

function updatePlayer(dt) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.shield = Math.max(0, player.shield - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (boostLock && !input.down('boost')) boostLock = false;
  updateBasis();
  const rov = player.mode === 'rover';
  const obj = activeObject();
  const mv = input.vector('move');
  let wx = right.x * mv.x + fwd.x * mv.y;
  let wz = right.z * mv.x + fwd.z * mv.y;
  const len = Math.hypot(wx, wz);
  const moving = len > 0.05;
  if (len > 1) {
    wx /= len;
    wz /= len;
  }
  const boosting = !boostLock && input.down('boost') && player.boost > 2 && moving;
  if (boosting) player.boost = Math.max(0, player.boost - dt * (rov ? 34 : 44));
  else player.boost = Math.min(100, player.boost + dt * 23);
  player.boosting = boosting;
  const speed = (rov ? 6.5 : 4.2) * (boosting ? (rov ? 1.62 : 1.55) : 1);
  player.speed01 = moving ? Math.min(1, len) * (boosting ? 1.6 : 1) : 0;
  if (moving) {
    moveEntity(obj, wx * speed * dt, wz * speed * dt, activeRadius(), player.area);
    const target = Math.atan2(wx, wz);
    obj.rotation.y = wrapAngle(obj.rotation.y + wrapAngle(target - obj.rotation.y) * Math.min(1, dt * (rov ? 7 : 10)));
  }
  if (rov) {
    for (const w of rover.userData.wheels) w.rotation.y += (moving ? speed * Math.min(1, len) : 0) * dt * 2.1;
    if (boosting) {
      exhaustTimer -= dt;
      if (exhaustTimer <= 0) {
        exhaustTimer = 0.05;
        burst(obj.position.x - Math.sin(obj.rotation.y) * 1.6, 0.1, obj.position.z - Math.cos(obj.rotation.y) * 1.6, 0x65f7ff, 1, 0.07);
      }
    }
  } else {
    const ud = pilot.userData;
    if (moving) player.walk += dt * speed * 2.6;
    const swing = moving ? Math.sin(player.walk) * 0.5 : 0;
    ud.legs[0].rotation.x = swing;
    ud.legs[1].rotation.x = -swing;
    ud.body.position.y = moving ? Math.abs(Math.sin(player.walk)) * 0.05 : 0;
  }
  updateAim(dt, wx, wz, moving);
  // Grace after a respawn or an area start: the active body blinks while nothing can hurt it.
  const blinkOff = player.shield > 0 && Math.floor(player.shield * 14) % 2 === 1;
  rover.visible = !(rov && blinkOff);
  pilot.visible = !rov && !blinkOff;
  muzzleFlash = Math.max(0, muzzleFlash - dt);
  rover.userData.muzzle.scale.setScalar(1 + muzzleFlash * 6);
  const autoFire = input.source === 'touch' && aimStickLen > 0.55;
  if (input.down('fire') || autoFire) firePlayer();
  if (input.pressed('action')) {
    const it = currentInteraction;
    if (it && it.ready()) it.run();
  }

  // Lava: the Crawler's treads shrug it off, a pilot on foot burns fast.
  const p = activeObject().position;
  if (player.shield <= 0 && !mission.complete && hazardAt(p.x, p.z, player.area)) {
    player.health -= (player.mode === 'rover' ? 5 : 22) * diff.dmg * dt;
    player.lavaTick -= dt;
    if (player.lavaTick <= 0) {
      player.lavaTick = 0.3;
      audio.sizzle();
      burst(p.x, 0, p.z, 0xff7a2a, 2, 0.07);
      if (player.mode === 'pilot') {
        hurtFlash();
        input.rumble(0.25, 60);
      }
    }
    if (player.health <= 0) respawnPlayer();
  }
}

// ---------------------------------------------------------------- mission flow
function objectiveText() {
  const T = A.def.text;
  if (mission.complete) return T.complete;
  if (mission.gateOpen) return T.gate;
  if (player.area === 'interior') return mission.item ? T.haveItem : mission.itemSpawned ? T.vaultClear : T.inVault;
  if (mission.item) return mission.exited ? T.exited : T.haveItem;
  if (mission.route) return T.route;
  if (T.pylon && A.destructibles.some((d) => !d.alive)) return T.pylon;
  return T.start;
}
function refreshObjective() {
  if (A) objective(objectiveText());
}
function updateMission(dt) {
  if (mission.waveTimer > 0) {
    mission.waveTimer -= dt;
    if (mission.waveTimer <= 0) {
      mission.waveTimer = 0;
      spawnWave(mission.wave + 1);
    }
  }
  if (mission.gateOpen && !A.boss && player.area === 'external' && activeObject().position.x > 18) spawnBoss();
  if (mission.complete && mission.completeTimer > 0) {
    mission.completeTimer -= dt;
    if (mission.completeTimer <= 0) showComplete();
  }
}
function completeMission() {
  if (mission.complete) return;
  mission.complete = true;
  mission.completeTimer = 1.6;
  clearEnemyFire();
  refreshObjective();
  audio.beep(460, 0.5, 'triangle', 0.045, 420);
  const def = A.def;
  const time = mission.elapsed;
  const grade = gradeFor(time, player.deaths, def.par);
  const key = `${def.id}:${diff.id}`;
  const prev = store.best[key];
  const isBest = !prev || time < prev.time;
  store.best[key] = { time: isBest ? time : prev.time, grade: bestGrade(prev?.grade, grade) };
  store.cleared[def.id] = true;
  store.run = null;
  if (def.id === 1) {
    store.carry = { ...pickStats(), health: player.maxHealth };
    store.area = 2;
  }
  persist();
  results = { time, grade, isBest, best: store.best[key] };
}

// ---------------------------------------------------------------- HUD
function updateHUD() {
  setWidth(ui.healthBar, (player.health / player.maxHealth) * 100);
  setText(ui.healthText, String(Math.max(0, Math.ceil(player.health))));
  setWidth(ui.boostBar, player.boost);
  setWidth(ui.xpBar, player.level >= MAX_LEVEL ? 100 : (player.xp / player.nextXp) * 100);
  setText(ui.levelText, `L${player.level}`);
  if (ui.scrapText.__n !== player.scrap) {
    ui.scrapText.__n = player.scrap;
    const scrap = String(player.scrap);
    setText(ui.scrapText, scrap);
    setText(ui.miniScrap, scrap);
  }
  const mode = player.mode === 'rover' ? 'ROVER' : 'PILOT';
  setText(ui.modeText, mode);
  setText(ui.miniMode, mode);
  setText(ui.weaponText, weaponName());
  const sec = Math.floor(mission.elapsed);
  if (sec !== hudSecond) {
    hudSecond = sec;
    const t = fmtTime(sec);
    setText(ui.timeText, t);
    setText(ui.miniTime, t);
  }
  const low = player.health < player.maxHealth * 0.3;
  if (ui.hudLeft.__low !== low) {
    ui.hudLeft.__low = low;
    ui.hudLeft.classList.toggle('low', low);
  }
}
function updatePrompt() {
  const it = currentInteraction;
  let text = '';
  if (it) text = it.ready() ? `${ACTION_KEY[input.source] || 'E'} · ${it.label()}` : it.label();
  setText(ui.prompt, text);
  const show = !!text;
  if (ui.prompt.__show !== show) {
    ui.prompt.__show = show;
    ui.prompt.classList.toggle('show', show);
  }
  const btn = !!it && it.ready();
  if (btn !== touchActionShown) {
    touchActionShown = btn;
    kit.touch?.setShown('action', btn);
  }
}

// ---------------------------------------------------------------- camera
function effectiveDist() {
  const aspect = kit.size.width / Math.max(1, kit.size.height);
  // Narrow portrait screens pull back so the play field stays readable.
  return camDist * (aspect < 1 ? Math.min(1.5, 1 / Math.sqrt(aspect)) : 1);
}
function snapCamera() {
  const o = activeObject().position;
  camTarget.set(o.x, player.mode === 'rover' ? 0.7 : 1, o.z);
  cameraOffset(_v2, effectiveDist());
  camBase.copy(camTarget).add(_v2);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();
}
function updateCamera(dt) {
  const o = activeObject().position;
  _v.set(o.x, player.mode === 'rover' ? 0.7 : 1, o.z);
  camTarget.lerp(_v, 1 - Math.exp(-dt * 9));
  cameraOffset(_v2, effectiveDist());
  _v.copy(camTarget).add(_v2);
  camBase.lerp(_v, 1 - Math.exp(-dt * 7));
  camera.position.copy(camBase);
  if (shake > 0) {
    shake = Math.max(0, shake - dt * 2.4);
    const s = shake * shake * 0.6;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
  camera.lookAt(camTarget);
  camera.updateMatrixWorld();
  // Keep the sun's shadow box on the action, snapped to whole shadow texels so edges don't crawl.
  const step = 52 / sun.shadow.mapSize.x;
  const sx = Math.round(camTarget.x / step) * step;
  const sz = Math.round(camTarget.z / step) * step;
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + SUN_OFFSET.x, SUN_OFFSET.y, sz + SUN_OFFSET.z);
}
function updateZoom(dt) {
  const z = input.zoom();
  if (z) camDist -= z * 0.7;
  const axis = input.value('zoom');
  if (axis) camDist -= axis * dt * 8;
  if (input.pressed('view')) {
    const i = VIEW_STEPS.findIndex((v) => v > camDist + 0.3);
    camDist = VIEW_STEPS[i < 0 ? 0 : i];
    toast(`VIEW ${VIEW_STEPS.indexOf(camDist) + 1}/${VIEW_STEPS.length}`, 0.7);
  }
  camDist = clamp(camDist, 8, 16);
}

/** Idle motion: pylons, the tinker pad, the crystal nest wobble. */
function animateWorld(dt) {
  if (!A) return;
  if (A.tinker) A.tinker.glow.rotation.y += dt * 2;
  for (const d of A.destructibles) {
    if (!d.alive) continue;
    if (d.pop > 0) d.pop = Math.max(0, d.pop - dt * 6);
    d.group.scale.setScalar(1 + d.pop * 0.06);
    if (d.kind === 'pylon') {
      const core = d.group.userData.core;
      core.rotation.y += dt * 2.4;
      core.position.y = 3.15 + Math.sin(clock * 3 + d.x) * 0.12;
    }
  }
  if (A.gate && !mission.gateOpen) A.gate.field.scale.y = 1 + Math.sin(clock * 6) * 0.015;
}

// ---------------------------------------------------------------- saving
function snapshot() {
  return {
    area: A.def.id,
    difficulty: diff.id,
    startStats: run.startStats,
    stats: pickStats(),
    flags: { route: mission.route, item: mission.item, gateOpen: mission.gateOpen, exited: mission.exited },
    destroyed: A.destructibles.filter((d) => !d.alive).map((d) => d.id),
    dead: A.enemies.filter((e) => e.dead && e.id && e.area === 'external').map((e) => e.id),
    taken: A.pickups.filter((p) => p.dead && p.id).map((p) => p.id),
    checkpoint: [player.checkpoint.x, player.checkpoint.z],
    elapsed: mission.elapsed,
    deaths: player.deaths,
    kills: stats.kills,
    shots: stats.shots,
    hits: stats.hits,
  };
}
function saveRun() {
  if (!A || mission.complete) return;
  store.run = snapshot();
  persist();
}

// ---------------------------------------------------------------- menus
const cards = [ui.start, ui.pause, ui.complete];
let modal = null;
let navHeld = '';
let navRepeat = 0;
function showModal(el) {
  for (const m of cards) {
    const on = m === el;
    m.classList.toggle('show', on);
    m.inert = !on;
  }
  modal = el;
  kit.touch?.suspend(!!el, 'modal');
  if (el) {
    const first = [...el.querySelectorAll('[data-autofocus]')].find((b) => !b.hidden) || menuItems()[0];
    focusItem(first);
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
  b.focus({ preventScroll: true });
  b.scrollIntoView?.({ block: 'nearest' });
}
// The kit blurs a button that was clicked (not tabbed to) when Enter or Space arrives, so
// remember which menu item had focus last and confirm that one.
let lastFocus = null;
addEventListener('focusin', (e) => {
  if (e.target instanceof HTMLButtonElement && e.target.closest('.modal')) lastFocus = e.target;
});
function currentItem(items = menuItems()) {
  if (items.includes(document.activeElement)) return document.activeElement;
  if (items.includes(lastFocus)) return lastFocus;
  return items[0] || null;
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
  if (dir === 'left' || dir === 'right') pick = rows[r].items[c + (dir === 'right' ? 1 : -1)];
  else {
    const row = rows[r + (dir === 'down' ? 1 : -1)];
    if (row) pick = row.items.find((b) => b.getAttribute('aria-pressed') === 'true') || row.items[Math.min(c, row.items.length - 1)];
  }
  if (pick) {
    focusItem(pick);
    audio.beep(420, 0.03, 'triangle', 0.012, 40);
  }
}
function menuNav(dt) {
  if (kit.menu.isOpen) return;
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
  // Not 'boost': it includes Shift, and Shift+Tab must not click the focused button.
  if (input.pressed('confirm')) {
    const cur = currentItem();
    // Enter or Space on a choice picked with the mouse means "go", like the gamepad's A on Start.
    if (cur?.classList.contains('choice') && input.source === 'keyboard' && modal === ui.start) ui.startBtn.click();
    else cur?.click();
  } else if (input.pressed('back') || input.pressed('pause')) {
    if (modal === ui.pause) resumeGame();
    else if (modal === ui.complete) goTitle();
  }
}

function renderControls(el) {
  const list = CONTROLS[input.source] || CONTROLS.keyboard;
  el.replaceChildren(
    ...list.map(([k, v]) => {
      const s = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = k;
      s.append(b, ` ${v}`);
      return s;
    })
  );
}
function refreshStart() {
  const def = AREAS[store.area];
  const d = DIFFICULTY[store.difficulty];
  ui.startEyebrow.textContent = `${def.code} · ${def.name}`;
  ui.startBlurb.textContent = def.blurb;
  for (const b of ui.areaBtns) b.setAttribute('aria-pressed', String(Number(b.dataset.area) === store.area));
  for (const b of ui.diffBtns) b.setAttribute('aria-pressed', String(b.dataset.diff === store.difficulty));
  const best = store.best[`${store.area}:${store.difficulty}`];
  ui.best.textContent = best
    ? `BEST · ${def.chip} · ${d.label}: ${fmtTime(best.time)} · GRADE ${best.grade} · PAR ${fmtTime(def.par)}`
    : `${def.chip} · ${d.label} · PAR ${fmtTime(def.par)} · NO RECORD YET`;
  if (store.area === 2) {
    const c = store.carry;
    ui.loadout.textContent = c
      ? `LOADOUT · carried from your Area 01 clear · L${c.level} · ${c.scrap} scrap${c.weapon ? ` · ${UPGRADES[c.weapon - 1].name}` : ''}`
      : 'LOADOUT · standard L3 Crawler (clear Area 01 to carry your own)';
  } else {
    ui.loadout.textContent = 'LOADOUT · fresh Crawler, level 1';
  }
  const r = store.run;
  ui.continueBtn.hidden = !r;
  if (r) ui.continueBtn.textContent = `Continue · ${AREAS[r.area].code} checkpoint · ${DIFFICULTY[r.difficulty]?.label || 'PILOT'}`;
  ui.startBtn.toggleAttribute('data-autofocus', !r);
  ui.continueBtn.toggleAttribute('data-autofocus', !!r);
  renderControls(ui.controls);
}
function previewArea() {
  if (state === 'title' && (!A || A.def.id !== store.area)) loadArea(store.area, { loadout: store.area === 2 ? store.carry || AREA2_LOADOUT : BASE_LOADOUT });
}

function beginArea(id, { loadout, difficulty, restore = null }) {
  audio.unlock();
  diff = DIFFICULTY[difficulty] || DIFFICULTY.pilot;
  run.area = id;
  run.difficulty = diff.id;
  run.startStats = { ...loadout };
  loadArea(id, { loadout, restore });
  state = 'play';
  showModal(null);
  boostLock = true;
  touchActionShown = null;
  toast(restore ? `${A.def.code} · CHECKPOINT RESTORED` : A.def.toasts.intro, 1.8);
  fadeFlash();
  if (!restore) saveRun();
}
function startNew() {
  const id = store.area;
  beginArea(id, { loadout: id === 2 ? store.carry || AREA2_LOADOUT : BASE_LOADOUT, difficulty: store.difficulty });
}
function continueRun() {
  const r = store.run;
  if (!r) {
    startNew();
    return;
  }
  beginArea(r.area, { loadout: r.startStats || BASE_LOADOUT, difficulty: r.difficulty, restore: r });
}
function pauseGame() {
  if (state !== 'play' || mission.complete) return;
  state = 'paused';
  setText(ui.pauseObjective, objectiveText());
  renderControls(ui.pauseControls);
  ui.retryBtn.hidden = !store.run || store.run.area !== A.def.id;
  showModal(ui.pause);
}
function resumeGame() {
  if (state !== 'paused') return;
  state = 'play';
  showModal(null);
  boostLock = true;
}
function goTitle() {
  if (state === 'play' || state === 'paused') saveRun();
  state = 'title';
  hideBossBar();
  ui.prompt.classList.remove('show');
  ui.prompt.__show = false;
  refreshStart();
  previewArea();
  showModal(ui.start);
}
function showComplete() {
  state = 'done';
  const def = A.def;
  const r = results || { time: mission.elapsed, grade: 'C', isBest: false, best: { time: mission.elapsed } };
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  ui.completeEyebrow.textContent = `MISSION COMPLETE · ${def.code}`;
  ui.completeTitle.innerHTML = def.clearTitle;
  ui.completeSummary.textContent =
    `${def.chip} cleared in ${fmtTime(r.time)} on ${diff.label} · Level ${player.level} · ${stats.kills} kills · ${acc}% accuracy · ` +
    `${player.deaths} reconstruction${player.deaths === 1 ? '' : 's'} · ${player.weapon ? `${UPGRADES[player.weapon - 1].name} fitted` : 'stock weapon clear'}.`;
  ui.completeGrade.textContent = `GRADE ${r.grade} · ${r.isBest ? 'NEW BEST TIME' : `BEST ${fmtTime(r.best.time)}`} · PAR ${fmtTime(def.par)}`;
  ui.nextBtn.hidden = def.id !== 1;
  ui.nextBtn.toggleAttribute('data-autofocus', def.id === 1);
  ui.replayBtn.toggleAttribute('data-autofocus', def.id !== 1);
  hideBossBar();
  showModal(ui.complete);
}

function syncAudio() {
  audio.pause(kit.paused || state === 'paused' || document.hidden);
}

ui.startBtn.addEventListener('click', startNew);
ui.continueBtn.addEventListener('click', continueRun);
for (const b of ui.areaBtns) {
  b.addEventListener('click', () => {
    store.area = Number(b.dataset.area);
    persist();
    refreshStart();
    previewArea();
  });
}
for (const b of ui.diffBtns) {
  b.addEventListener('click', () => {
    store.difficulty = b.dataset.diff;
    persist();
    refreshStart();
  });
}
ui.resumeBtn.addEventListener('click', resumeGame);
ui.retryBtn.addEventListener('click', () => {
  if (store.run && store.run.area === A.def.id) continueRun();
  else beginArea(A.def.id, { loadout: run.startStats, difficulty: diff.id });
});
ui.restartBtn.addEventListener('click', () => beginArea(A.def.id, { loadout: run.startStats, difficulty: diff.id }));
ui.settingsBtn.addEventListener('click', () => kit.menu.open());
ui.startSettingsBtn.addEventListener('click', () => kit.menu.open());
ui.quitBtn.addEventListener('click', goTitle);
ui.nextBtn.addEventListener('click', () => beginArea(2, { loadout: store.carry || AREA2_LOADOUT, difficulty: diff.id }));
ui.replayBtn.addEventListener('click', () => beginArea(A.def.id, { loadout: run.startStats, difficulty: diff.id }));
ui.titleBtn.addEventListener('click', goTitle);
ui.pauseBtn.addEventListener('click', () => pauseGame());
input.onSourceChange(() => {
  if (modal === ui.start) renderControls(ui.controls);
  if (modal === ui.pause) renderControls(ui.pauseControls);
});
// Audio may only start from a gesture; the first key, click or tap does it.
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'play') pauseGame();
  syncAudio();
});
kit.onPause(syncAudio);
addEventListener('pagehide', () => {
  if (state === 'play' || state === 'paused') saveRun();
});

// ---------------------------------------------------------------- loop
function frame(dt, t) {
  clock = t;
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }
  if (modal) {
    menuNav(dt);
  } else if (state === 'play') {
    if (input.pressed('pause')) pauseGame();
    else {
      if (!mission.complete) mission.elapsed += dt;
      updatePlayer(dt);
      if (!mission.complete) {
        updateEnemies(dt);
        updateBoss(dt);
      }
      updateShells(dt);
      updatePlayerBolts(roverBolts, dt);
      updatePlayerBolts(pilotBolts, dt);
      updateEnemyBolts(dt);
      updatePickups(dt);
      updateMission(dt);
      currentInteraction = mission.complete ? null : findInteraction();
      updatePrompt();
      updateHUD();
      updateZoom(dt);
    }
  }
  const lvl = state === 'play' && player.mode === 'rover' && !mission.complete ? Math.round(Math.max(0.25, player.speed01) * 20) / 20 : 0;
  const engineKey = lvl + (player.boosting ? 10 : 0);
  if (engineKey !== engineLevel) {
    engineLevel = engineKey;
    audio.setEngine(lvl, player.boosting && lvl > 0);
  }
  animateWorld(dt);
  updateSparks(dt);
  drawBolts(roverBolts);
  drawBolts(pilotBolts);
  drawBolts(enemyBolts);
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- start
loadArea(store.area, { loadout: store.area === 2 ? store.carry || AREA2_LOADOUT : BASE_LOADOUT });
kit.loading.progress(0.85, 'Warming up shaders…');
// Pre-compile everything that appears later (Area 02 materials, bolts, sparks, rings) while the card is up.
{
  const warm = new THREE.Group();
  const forward = camera.getWorldDirection(new THREE.Vector3());
  warm.position.copy(camera.position).addScaledVector(forward, 6);
  let i = 0;
  for (const m of Object.values(mat)) {
    if (m === mat.spark || m === mat.warn) continue;
    const mesh = new THREE.Mesh(G.box(), m);
    mesh.position.set((i % 6) * 0.3 - 0.75, Math.floor(i / 6) * 0.3, 0);
    mesh.scale.setScalar(0.1);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    warm.add(mesh);
    i++;
  }
  scene.add(warm);
  for (const pool of [roverBolts, pilotBolts, enemyBolts]) {
    _obj.position.copy(warm.position);
    _obj.rotation.set(0, 0, 0);
    _obj.scale.setScalar(0.1);
    _obj.updateMatrix();
    pool.mesh.setMatrixAt(0, _obj.matrix);
    pool.mesh.count = 1;
    pool.mesh.instanceMatrix.needsUpdate = true;
  }
  sparkMesh.setMatrixAt(0, _obj.matrix);
  sparkMesh.count = 1;
  sparkMesh.instanceMatrix.needsUpdate = true;
  rings[0].visible = true;
  rings[0].position.copy(warm.position);
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('Shader warm-up skipped:', err);
  }
  scene.remove(warm);
  rings[0].visible = false;
  for (const pool of [roverBolts, pilotBolts, enemyBolts]) pool.mesh.count = 0;
  sparkMesh.count = 0;
}
refreshStart();
showModal(ui.start);
kit.start(frame);
