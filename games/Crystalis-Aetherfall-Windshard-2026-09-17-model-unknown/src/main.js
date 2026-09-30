import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { BALANCE, DIFFICULTY, DIFFICULTY_ORDER, levelFromXp, maxHpFor, attackFor, damageAfterArmor } from './balance.js';
import { unlockAudio, sfx, setAmbience, suspendAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'),
  start: $('start-screen'), startBtn: $('start-btn'), continueBtn: $('continue-btn'), difficultyBtn: $('difficulty-btn'),
  titleSettingsBtn: $('title-settings-btn'), startRecord: $('start-record'), startHelp: $('start-help'),
  pause: $('pause-screen'), pauseStatus: $('pause-status'), resumeBtn: $('resume-btn'), settingsBtn: $('settings-btn'),
  quitBtn: $('quit-btn'), pauseHelp: $('pause-help'), pauseInfo: $('pause-info'),
  end: $('end-screen'), endSummary: $('end-summary'), endRecord: $('end-record'), exploreBtn: $('explore-btn'),
  restartBtn: $('restart-btn'), endTitleBtn: $('end-title-btn'),
  death: $('death-screen'), deathTitle: $('death-title'), retryBtn: $('retry-btn'), deathTitleBtn: $('death-title-btn'),
  objectiveCard: $('objective'), objective: $('objective-text'), sideText: $('side-text'),
  hpFill: $('hp-fill'), hpText: $('hp-text'), xpFill: $('xp-fill'), xpText: $('xp-text'),
  levelText: $('level-text'), gearText: $('gear-text'), gearCard: document.querySelector('.gear-card'),
  toast: $('toast'), prompt: $('prompt'), bossHud: $('boss-hud'), bossFill: $('boss-fill'), pauseBtn: $('pause-btn'),
};

// ---------------------------------------------------------------- storage
const SAVE_KEY = 'aetherfall.windshard.save.v1';
const PREFS_KEY = 'aetherfall.windshard.prefs.v1';
const RECORDS_KEY = 'aetherfall.windshard.records.v1';
const store = {
  read(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or storage full: play on without saving */
    }
  },
};
const prefs = { difficulty: 'normal', ...(store.read(PREFS_KEY) || {}) };
if (!DIFFICULTY[prefs.difficulty]) prefs.difficulty = 'normal';
const diff = () => DIFFICULTY[prefs.difficulty];

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'Aetherfall: Windshard',
  gear: 'none', // the title and pause menus carry a Settings button (and F9 still opens it)
  accent: '#77f0c5',
  background: '#0b1513',
  touch: { top: 'right', topOffset: 96 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    attack: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['A', 'X', 'RT'], touch: 'Blade' },
    dash: { keys: ['ShiftLeft', 'ShiftRight', 'KeyK'], mouse: [2], gamepad: ['B', 'LT'], touch: 'Dash' },
    interact: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Act' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const { input } = kit;
// Button names for prompts follow the device in use.
const attackName = () => (input.source === 'gamepad' ? 'A' : input.source === 'touch' ? 'BLADE' : 'SPACE');
const interactName = () => (input.source === 'gamepad' ? 'Y' : input.source === 'touch' ? 'ACT' : 'E');
const renderer = kit.renderer;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.touch?.setShown('interact', false);
kit.loading.progress(0.7, 'Building Aetherfall Ridge…');

// ---------------------------------------------------------------- palette, materials, geometry
const C = {
  sand: 0xd8b77b, sand2: 0xc89a5c, grass: 0x4f8b61, grass2: 0x356c4c, cliff: 0x8d4f37,
  cliffDark: 0x613827, wood: 0x6d452d, woodLight: 0xae7744, stone: 0x6f766f, darkStone: 0x39403b,
  water: 0x3a96a9, wind: 0x79f3c8, hero: 0x6955a8, hero2: 0xd8c16e,
  enemy: 0x7ba66a, enemy2: 0xb9d880, boss: 0x7b6d8f, bossGlow: 0xc69cff,
  tempest: 0xd9c7ff, heal: 0x8fe07a, hurt: 0xff785f,
};

const mats = {};
function mat(name, color, opts = {}) {
  if (mats[name]) return mats[name];
  const m = new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0.05,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1, emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0, depthWrite: opts.depthWrite ?? true,
  });
  mats[name] = m;
  return m;
}
const geos = new Map();
function geo(key, make) {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
function mesh(geometry, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

// ---------------------------------------------------------------- world state
const colliders = [];
const interactables = [];
const enemies = [];
const projectiles = [];
const effects = [];
const shrines = [];
const bells = [];
let boss = null;
let bossRig = null;
let windmillBlades = null;
let caveSeal = null;
let runeWall = null;
let vault = null;
let objectiveMarker = null;
let keeper = null;
let coreChest = null;
let armorChest = null;
let grass = null;
let grassUsed = 0;
let player;

const START_POS = new THREE.Vector3(-15, 0, 33);
const FIELD_TARGET = new THREE.Vector3(8, 0, 3);
const CONSOLE_POS = new THREE.Vector3(17.3, 0, 4.3);
const ARENA_POS = new THREE.Vector3(48, 0, -25);
const BELL_NOTES = [523.25, 659.25, 783.99];

const freshState = () => ({
  quest: 0, sparks: 0, xp: 0, level: 1, swordTier: 1, armorTier: 0,
  maxHp: maxHpFor(1), hp: maxHpFor(1),
  attackHeld: false, attackHold: 0, chargeCued: false, attackCooldown: 0, buffered: null, bufferTimer: 0,
  dashCooldown: 0, dashTimer: 0, invuln: 0, hurtBlink: 0, kbT: 0, kbx: 0, kbz: 0, kills: 0,
  coreClaimed: false, millOn: false, runeBroken: false, bossDefeated: false,
  hollowFound: false, bellsEver: [false, false, false], vaultOpen: false, ringClaimed: false,
  checkpoint: 'village', playTime: 0, runDifficulty: prefs.difficulty, completed: false,
});
const state = freshState();

const cameraState = { zoom: 1, targetZoom: 1, shake: 0 };
let mode = 'title'; // title | play | pause | dying | death | victory | end
let modeTimer = 0;
let gameTime = 0;
let realTime = 0;
let hitStop = 0;
let dirty = true;

// ---------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x85b8a3);
scene.fog = new THREE.FogExp2(0x8db5a5, 0.0125);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(48, 1, 0.1, 180));
camera.position.set(-15, 17, 48);

const hemi = new THREE.HemisphereLight(0xcdf4ea, 0x63442e, 1.7);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b0, 3.6);
sun.castShadow = true;
// The shadow box follows the hero (texel-snapped), so it stays sharp everywhere on the map,
// the boss arena included, instead of one fixed box that the east of the map fell outside.
const SHADOW_EXTENT = 32;
Object.assign(sun.shadow.camera, { left: -SHADOW_EXTENT, right: SHADOW_EXTENT, top: SHADOW_EXTENT, bottom: -SHADOW_EXTENT, near: 1, far: 110 });
sun.shadow.bias = -0.0008;
sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(-18, 28, 20).normalize();
const SUN_X = new THREE.Vector3(0, 1, 0).cross(SUN_DIR).normalize();
const SUN_Y = SUN_DIR.clone().cross(SUN_X);

// Repeated props (cliffs, trees, stones) are drawn as instanced batches: one draw per kind.
const batches = new Map();
const _obj = new THREE.Object3D();
function batch(key, geometry, material, cast = true, receive = true) {
  let b = batches.get(key);
  if (!b) {
    b = { geometry, material, cast, receive, list: [] };
    batches.set(key, b);
  }
  return b;
}
function place(b, x, y, z, sx, sy, sz, ry = 0) {
  _obj.position.set(x, y, z);
  _obj.rotation.set(0, ry, 0);
  _obj.scale.set(sx, sy, sz);
  _obj.updateMatrix();
  b.list.push(_obj.matrix.clone());
}
function flushBatches() {
  for (const b of batches.values()) {
    if (!b.list.length) continue;
    const m = new THREE.InstancedMesh(b.geometry, b.material, b.list.length);
    b.list.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    m.computeBoundingSphere();
    scene.add(m);
  }
  batches.clear();
}

function addRectCollider(x, z, w, d, tag = 'wall') {
  const c = { type: 'rect', x, z, w, d, tag, active: true };
  colliders.push(c);
  return c;
}
function addCircleCollider(x, z, r, tag = 'rock') {
  const c = { type: 'circle', x, z, r, tag, active: true };
  colliders.push(c);
  return c;
}
function addBox(x, z, w, d, h, material, y = h / 2, collidable = true) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  scene.add(m);
  if (collidable) m.userData.collider = addRectCollider(x, z, w, d);
  return m;
}

function flatPatch(geometry, material, x, y, z, rotZ = 0) {
  const m = mesh(geometry, material, x, y, z, false, true);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = rotZ;
  scene.add(m);
  return m;
}

function addCliffLine(points) {
  const unit = geo('dodeca1', () => new THREE.DodecahedronGeometry(1, 0));
  const rockB = batch('cliffRock', unit, mat('cliff', C.cliff));
  const capB = batch('cliffCap', unit, mat('cliffDark', C.cliffDark));
  for (const [x, z, s = 1] of points) {
    place(rockB, x, 1.3 * s, z, 2.1 * s * 1.2, 2.1 * s * 0.8, 2.1 * s * 0.9, (x * 1.7 + z * 0.8) % 2.4);
    place(capB, x + 0.15, 2.0 * s, z - 0.1, 1.55 * s * 1.15, 1.55 * s * 0.65, 1.55 * s * 0.88);
    addCircleCollider(x, z, 1.55 * s, 'cliff');
  }
}

function addTree(x, z, s = 1, old = false) {
  const trunk = batch('trunk', geo('trunk', () => new THREE.CylinderGeometry(0.23, 0.34, 1.5, 6)), mat('wood', C.wood));
  const crownGeo = geo('crown', () => new THREE.IcosahedronGeometry(0.95, 1));
  const crown2Geo = geo('crown2', () => new THREE.IcosahedronGeometry(0.68, 1));
  const crown = old ? batch('crownOld', crownGeo, mat('hollowLeaf', 0x3f5f4c)) : batch('crown', crownGeo, mat('grassDark', C.grass2));
  const crown2 = old ? batch('crown2Old', crown2Geo, mat('hollowLeaf2', 0x5b7c5c)) : batch('crown2', crown2Geo, mat('grass', C.grass));
  place(trunk, x, 0.75 * s, z, s, s, s);
  place(crown, x, 1.85 * s, z, s, 0.9 * s, s);
  place(crown2, x + 0.35 * s, 2.25 * s, z + 0.05 * s, s, s, s);
  addCircleCollider(x, z, 0.55 * s, 'tree');
}

function addSign(x, z, rotation, text) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotation;
  g.add(mesh(geo('signPost', () => new THREE.BoxGeometry(0.16, 1.25, 0.16)), mat('wood', C.wood), 0, 0.62, 0));
  g.add(mesh(geo('signBoard', () => new THREE.BoxGeometry(1.25, 0.58, 0.14)), mat('woodLight', C.woodLight), 0, 1.25, 0));
  scene.add(g);
  addCircleCollider(x, z, 0.35, 'sign');
  interactables.push({ type: 'sign', position: g.position, radius: 2.1, prompt: 'Read sign', action: () => toast(text, 2800) });
}

function addHouse(x, z, scale = 1, roofColor = 0x965d3d) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  g.add(mesh(geo('houseBase', () => new THREE.BoxGeometry(5, 2.4, 4)), mat('plaster', 0xdcc99b), 0, 1.2, 0));
  const roof = mesh(geo('houseRoof', () => new THREE.ConeGeometry(3.6, 1.8, 4)), mat(`roof${roofColor}`, roofColor, { roughness: 0.9 }), 0, 3.0, 0);
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  g.add(mesh(geo('houseDoor', () => new THREE.BoxGeometry(1.15, 1.65, 0.15)), mat('door', 0x5d3927), 0, 0.85, 2.06));
  g.add(mesh(geo('lamp', () => new THREE.OctahedronGeometry(0.18, 0)), mat('lamp', 0xffc875, { emissive: 0xffa739, emissiveIntensity: 2.3 }), 1.25, 1.45, 2.18));
  scene.add(g);
  addRectCollider(x, z, 5 * scale, 4 * scale, 'house');
}

function addBridge(x, z, w = 4, d = 7) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const plank = new THREE.BoxGeometry(w, 0.22, 1.15);
  for (let i = -2; i <= 2; i++) g.add(mesh(plank, mat('bridge', C.woodLight), 0, 0.25, i * 1.25));
  const rail = new THREE.BoxGeometry(0.16, 0.85, d);
  const post = new THREE.BoxGeometry(0.14, 1.05, 0.14);
  for (const sx of [-w / 2 + 0.18, w / 2 - 0.18]) {
    g.add(mesh(rail, mat('rail', C.wood), sx, 0.75, 0));
    for (let p = -2; p <= 2; p++) g.add(mesh(post, mat('rail', C.wood), sx, 0.58, p * 1.4));
  }
  scene.add(g);
}

function addStairs(x, z, rot = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(3.1, 0.18 + i * 0.12, 0.95), mat('stone', C.stone), 0, 0.09 + i * 0.06, -1.35 + i * 0.82));
  scene.add(g);
}

function createNPC(x, z, coatColor, hatColor) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.5, 1.15, 6), mat('npcCoat', coatColor, { roughness: 0.85 }), 0, 0.9, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.31, 1), mat('skin', 0xc48c68), 0, 1.62, 0));
  g.add(mesh(new THREE.ConeGeometry(0.5, 0.55, 6), mat('npcHat', hatColor, { roughness: 0.8 }), 0, 1.98, 0));
  scene.add(g);
  return g;
}

function createChest(x, z, glowColor) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(mesh(geo('chestBase', () => new THREE.BoxGeometry(1.15, 0.65, 0.85)), mat('chest', 0x704723), 0, 0.36, 0));
  const lid = mesh(geo('chestLid', () => new THREE.BoxGeometry(1.18, 0.35, 0.88)), mat('chestLid', 0x9a6a35), 0, 0.8, -0.05);
  g.add(lid);
  g.add(mesh(geo('chestLock', () => new THREE.BoxGeometry(0.2, 0.3, 0.12)), mat(`lock${glowColor}`, glowColor, { emissive: glowColor, emissiveIntensity: 1.8, roughness: 0.82 }), 0, 0.58, 0.48));
  g.userData = { opened: false, lid };
  scene.add(g);
  addCircleCollider(x, z, 0.6, 'chest');
  return g;
}
function setChestOpen(chest, opened) {
  chest.userData.opened = opened;
  chest.userData.lid.rotation.x = opened ? -0.85 : 0;
  chest.userData.lid.position.y = opened ? 1.05 : 0.8;
}

function addCrystal(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const c = mesh(geo('crystal', () => new THREE.OctahedronGeometry(0.38, 0)), mat('windCrystal', C.wind, { emissive: C.wind, emissiveIntensity: 2.5, roughness: 0.24 }), 0, 0.78, 0);
  c.scale.y = 1.8;
  g.add(c);
  g.add(mesh(geo('crystalBase', () => new THREE.CylinderGeometry(0.45, 0.62, 0.35, 6)), mat('darkStone', C.darkStone), 0, 0.18, 0));
  scene.add(g);
  addCircleCollider(x, z, 0.38, 'crystal');
}

function addShrine(id, name, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(mesh(geo('shrinePlinth', () => new THREE.CylinderGeometry(0.8, 1.0, 0.45, 8)), mat('stone', C.stone), 0, 0.22, 0));
  g.add(mesh(geo('shrinePillar', () => new THREE.BoxGeometry(0.42, 1.3, 0.42)), mat('darkStone', C.darkStone), 0, 1.1, 0));
  const crystal = mesh(geo('shrineCrystal', () => new THREE.OctahedronGeometry(0.3, 0)), mat('shrineCrystal', C.wind, { emissive: C.wind, emissiveIntensity: 2.2, roughness: 0.25 }), 0, 2.2, 0, false, false);
  crystal.scale.y = 1.5;
  g.add(crystal);
  scene.add(g);
  addCircleCollider(x, z, 0.8, 'shrine');
  const shrine = { id, name, position: g.position, crystal, spawn: new THREE.Vector3(x, 0, z + 1.9) };
  shrines.push(shrine);
  interactables.push({ type: 'shrine', position: g.position, radius: 2.3, prompt: `Rest at the ${name}`, action: () => restAtShrine(shrine) });
}

function addWindbell(i, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.add(mesh(geo('bellSlab', () => new THREE.CylinderGeometry(1.25, 1.4, 0.22, 8)), mat('stone', C.stone), 0, 0.11, 0, false, true));
  const post = geo('bellPost', () => new THREE.BoxGeometry(0.24, 2.7, 0.24));
  g.add(mesh(post, mat('wood', C.wood), -1, 1.35, 0));
  g.add(mesh(post, mat('wood', C.wood), 1, 1.35, 0));
  g.add(mesh(geo('bellBar', () => new THREE.BoxGeometry(2.4, 0.22, 0.26)), mat('wood', C.wood), 0, 2.72, 0));
  const swing = new THREE.Group();
  swing.position.y = 2.6;
  g.add(swing);
  const bronze = mat('bellBronze', 0xb8894a, { metalness: 0.55, roughness: 0.38 });
  swing.add(mesh(geo('bellBody', () => new THREE.CylinderGeometry(0.3, 0.62, 0.85, 8)), bronze, 0, -0.55, 0));
  const lip = mesh(geo('bellLip', () => new THREE.TorusGeometry(0.6, 0.06, 4, 10)), bronze, 0, -0.97, 0);
  lip.rotation.x = Math.PI / 2;
  swing.add(lip);
  // Each bell's clapper crystal has its own material so its glow can show how long it keeps humming.
  const crystalMat = new THREE.MeshStandardMaterial({ color: C.wind, emissive: C.wind, emissiveIntensity: 0.25, flatShading: true, roughness: 0.3 });
  const crystal = mesh(geo('bellCrystal', () => new THREE.OctahedronGeometry(0.17, 0)), crystalMat, 0, -1.15, 0, false, false);
  crystal.scale.y = 1.6;
  swing.add(crystal);
  scene.add(g);
  addRectCollider(x, z, 2.5, 0.6, 'bell');
  const bell = { i, group: g, swing, crystal, crystalMat, position: g.position, rungUntil: 0, amp: 0 };
  bells.push(bell);
  interactables.push({ type: 'bell', position: g.position, radius: 2.3, prompt: 'Strike the windbell', action: () => strikeBell(bell) });
}

function addVault(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const stone = mat('vaultStone', 0x8a8f86);
  g.add(mesh(new THREE.CylinderGeometry(3.2, 3.5, 0.32, 10), stone, 0, 0.16, 0, false, true));
  const pillar = new THREE.BoxGeometry(0.55, 2.8, 0.55);
  const cap = new THREE.BoxGeometry(0.8, 0.26, 0.8);
  for (const [px, pz] of [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]]) {
    g.add(mesh(pillar, stone, px, 1.4, pz));
    g.add(mesh(cap, mat('darkStone', C.darkStone), px, 2.9, pz));
    addCircleCollider(x + px, z + pz, 0.45, 'vaultPillar');
  }
  const halo = mesh(new THREE.TorusGeometry(2.55, 0.12, 4, 20), mat('vaultGlow', C.tempest, { emissive: 0xb58cff, emissiveIntensity: 1.6, roughness: 0.3 }), 0, 3.05, 0, false, false);
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  scene.add(g);
  const chest = createChest(x, z, C.tempest);
  const seal = mesh(new THREE.SphereGeometry(2.1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('vaultSeal', C.wind, { transparent: true, opacity: 0.3, emissive: C.wind, emissiveIntensity: 0.8, roughness: 0.2, depthWrite: false }), x, 0.02, z, false, false);
  seal.userData.baseY = seal.position.y;
  scene.add(seal);
  const sealCollider = addCircleCollider(x, z, 2.1, 'vaultSeal');
  vault = { position: g.position, chest, seal, sealCollider, halo };
  interactables.push({ type: 'vault', position: g.position, radius: 3.3, prompt: 'Open the Hollow vault', action: vaultAction });
}

function createHero() {
  const g = new THREE.Group();
  const cloak = mat('hero', C.hero, { roughness: 0.7 });
  const trim = mat('heroTrim', C.hero2, { metalness: 0.35, roughness: 0.42 });
  const bootMat = mat('boot', 0x352923);
  // The blade glows brighter while charging: it has its own material so nothing else flickers with it.
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x9affdd, emissive: C.wind, emissiveIntensity: 2.4, roughness: 0.3, flatShading: true });
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.56, 1.15, 6), cloak, 0, 1, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.34, 1), mat('skin', 0xc48c68), 0, 1.78, 0));
  const hood = mesh(new THREE.ConeGeometry(0.43, 0.48, 6), mat('hair', 0x2e253c), 0, 2.1, 0.05);
  hood.rotation.x = 0.08;
  g.add(hood);
  const armL = mesh(new THREE.BoxGeometry(0.24, 0.68, 0.24), cloak, -0.48, 1.08, 0);
  armL.rotation.z = -0.18;
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.48;
  armR.rotation.z = 0.18;
  g.add(armR);
  const legL = mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), bootMat, -0.2, 0.38, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  g.add(legR);
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.5, 1.12, 0);
  swordPivot.rotation.z = -0.42;
  g.add(swordPivot);
  swordPivot.add(mesh(new THREE.BoxGeometry(0.12, 1.25, 0.14), trim, 0, 0.6, 0));
  const blade = mesh(new THREE.BoxGeometry(0.08, 0.95, 0.1), bladeMat, 0, 1.18, 0);
  swordPivot.add(blade);
  const shield = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 8), mat('shield', 0x506b72, { metalness: 0.45, roughness: 0.4 }), -0.48, 1.06, 0.1);
  shield.rotation.z = Math.PI / 2;
  g.add(shield);
  g.userData = { swordPivot, blade, bladeMat, legL, legR, walk: 0, attackAnim: 0, facing: new THREE.Vector3(0, 0, -1) };
  g.position.copy(START_POS);
  scene.add(g);
  return g;
}

function createObjectiveMarker() {
  const g = new THREE.Group();
  const m = mat('marker', C.wind, { emissive: C.wind, emissiveIntensity: 2 });
  const ring = mesh(new THREE.TorusGeometry(0.55, 0.08, 6, 18), m, 0, 0.12, 0, false, false);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const arrow = mesh(new THREE.ConeGeometry(0.22, 0.55, 5), m, 0, 2.5, 0, false, false);
  arrow.rotation.x = Math.PI;
  g.add(arrow);
  scene.add(g);
  return g;
}

function addGrass() {
  // Allocate for the densest tier; the quality setting picks how many draw.
  const max = Math.round(300 * 1.25);
  const inst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.55, 3), mat('grassBlade', 0x6ca268), max);
  inst.castShadow = false;
  inst.receiveShadow = false;
  let used = 0;
  const near = (x, z, px, pz, r) => Math.hypot(x - px, z - pz) < r;
  for (let i = 0; i < max * 4 && used < max; i++) {
    const hollow = i % 3 === 2;
    const x = hollow ? -34 + Math.random() * 61 : -34 + Math.random() * 92;
    const z = hollow ? -36 + Math.random() * 23 : -8 + Math.random() * 54;
    if (!hollow && (Math.abs(z - 17) < 4.2 || Math.abs(x - 7) < 7 || Math.hypot(x - 21, z - 4) < 9 || (x > 31 && z < -6))) continue;
    if (hollow && (near(x, z, -26, -31.5, 4.2) || bells.some((b) => near(x, z, b.position.x, b.position.z, 1.8)))) continue;
    _obj.position.set(x, 0.28, z);
    _obj.rotation.set(0, Math.random() * Math.PI * 2, 0);
    _obj.scale.setScalar(0.6 + Math.random() * 0.9);
    _obj.updateMatrix();
    inst.setMatrixAt(used++, _obj.matrix);
  }
  grassUsed = used;
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  scene.add(inst);
  grass = inst;
  applyGrassDetail();
}
function applyGrassDetail() {
  if (grass) grass.count = Math.min(grassUsed, kit.detail(300));
}

function buildHollow() {
  // THE HOLLOW: the empty basin north of the field, now a terraced ruin with three windbells,
  // a sealed vault and burrowing foes. Built from the same pieces as the rest of the ridge.
  const floor = flatPatch(new THREE.CircleGeometry(1, 40), mat('hollowGround', 0x4b6553), -8, 0.03, -24.5);
  floor.scale.set(21, 12.5, 1);
  flatPatch(new THREE.RingGeometry(6, 7.3, 40), mat('terraceBand', 0x5d7461), -8, 0.045, -25);
  flatPatch(new THREE.RingGeometry(9.8, 11.2, 48), mat('terraceBand2', 0x566b5a), -8, 0.04, -25);
  const stoneB = batch('terraceStone', geo('box1', () => new THREE.BoxGeometry(1, 1, 1)), mat('terraceStone', 0x7c8577), false, true);
  for (const [r, n] of [[7.3, 20], [11.2, 30]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (Math.sin(a) > 0.93) continue; // leave the south side open toward the entrance
      place(stoneB, -8 + Math.cos(a) * r, 0.13, -25 + Math.sin(a) * r, 1.15, 0.26, 0.55, -a + Math.PI / 2);
    }
  }
  const pillarB = batch('pillar', geo('pillar', () => new THREE.CylinderGeometry(0.42, 0.5, 1, 7)), mat('stone', C.stone));
  for (const [x, z, h] of [[-15, -19, 2.4], [1, -19, 1.5], [-1, -32, 2.9], [-17, -32, 1.1]]) {
    place(pillarB, x, h / 2, z, 1, h, 1);
    addCircleCollider(x, z, 0.55, 'pillar');
  }
  addCliffLine([
    [-34, -37.4, 1.1], [-29, -37.9, 1.0], [-24, -37.2, 1.15], [-19, -37.8, 1.0], [-14, -37.3, 1.1], [-9, -37.9, 1.05],
    [-4, -37.4, 1.15], [1, -37.8, 1.0], [6, -37.3, 1.1], [11, -37.9, 1.05], [16, -37.4, 1.1], [21, -37.8, 1.0], [26, -37.3, 1.1],
    [-36.6, -32, 1.05], [-36.4, -27, 1.1], [-36.7, -22, 1.0], [-36.3, -17, 1.1], [-36.6, -12, 1.0], [-36.4, -7, 1.05],
    [29.3, -18, 0.95], [29.5, -23, 1.0], [29.2, -28, 1.05], [29.4, -33, 1.0],
  ]);
  for (const [x, z, s] of [[-31, -14, 1], [-33, -27, 1.1], [-15, -35.5, 0.9], [2, -35.5, 1.05], [22, -33, 0.95], [20, -15, 0.9], [24, -22, 0.85]]) addTree(x, z, s, true);
  addCrystal(-8, -25);
  addCrystal(8, -35);
  addWindbell(0, -27, -20);
  addWindbell(1, -8, -33.5);
  addWindbell(2, 15, -24);
  addVault(-26, -31.5);
  addSign(-5, -6.5, 0, 'THE HOLLOW ↑  •  Old windbells sleep among the terraces');
}

function createWorld() {
  // Ground: wide enough that the boss arena's east edge no longer shows the sky colour past the map.
  flatPatch(new THREE.PlaneGeometry(130, 100, 1, 1), mat('ground', C.grass), 10, -0.02, 4);
  flatPatch(new THREE.PlaneGeometry(35, 27), mat('sand', C.sand), -13, 0.015, 31);
  flatPatch(new THREE.PlaneGeometry(13, 55), mat('sand2', C.sand2), 7, 0.025, 9, 0.08);
  flatPatch(new THREE.CircleGeometry(10, 24), mat('sand', C.sand), 20, 0.03, 4);
  flatPatch(new THREE.PlaneGeometry(34, 12), mat('sand', C.sand), 37, 0.035, -12, -0.11);
  flatPatch(new THREE.CircleGeometry(13.3, 24), mat('darkGround', 0x596c5b), 48, 0.04, -25);

  // River and a strongly readable bridge route.
  flatPatch(new THREE.PlaneGeometry(86, 5.2), mat('water', C.water, { roughness: 0.22, transparent: true, opacity: 0.88 }), 0, 0.06, 17, -0.09);
  addBridge(7.5, 16.5, 4.2, 7.5);
  addRectCollider(-28, 17, 67, 4.2, 'water');
  addRectCollider(28, 17, 33, 4.2, 'water');

  addHouse(-19, 32, 0.92);
  addHouse(-9, 36, 0.82, 0x775044);
  addHouse(-24, 24, 0.76, 0xa16e43);
  addSign(-2, 27, 0, 'GALE MILL →  •  Shrine path ←');
  addSign(12, 10, Math.PI * 0.5, 'Mill yard →  •  Zephyr Grotto beyond the ridge  •  The Hollow lies north');
  addStairs(7, 22, 0);

  for (const [x, z, s] of [[-31, 35, 1.2], [-29, 28, 0.9], [-3, 38, 1.0], [1, 31, 0.8], [-16, 15, 0.85], [-8, 11, 0.9], [-14, 4, 0.85], [16, 21, 0.92], [28, 16, 0.84], [31, 6, 0.9]]) addTree(x, z, s);

  addCliffLine([
    [-34, 5, 1.15], [-31, 1, 1], [-27, -2, 1.1], [-22, -5, 0.95], [-17, -8, 1], [-12, -10, 0.92],
    [4, -9, 0.9], [9, -10, 0.92], [14, -10, 0.9], [19, -9, 0.92], [24, -8, 1], [29, -7, 1.1],
    [32, -3, 1], [34, 2, 1], [35, 8, 1.1], [35, 13, 1.1],
    [30, 31, 1.1], [25, 35, 1.05], [20, 39, 1.1], [12, 42, 1.15], [4, 44, 1.2], [-5, 46, 1.1], [-16, 47, 1.05], [-27, 45, 1.15], [-35, 40, 1.1],
    [33, -15, 1], [35, -19, 1], [37, -22, 0.95], [39, -31, 1], [44, -36, 1.05], [50, -38, 1], [57, -35, 1.1], [60, -29, 1.05], [61, -22, 1], [59, -15, 1.05], [55, -11, 1], [50, -10, 0.95],
  ]);

  // Mill tower and animated rotor.
  const mill = new THREE.Group();
  mill.position.set(21, 0, 4);
  mill.add(mesh(new THREE.CylinderGeometry(2.7, 3.2, 6.1, 8), mat('millStone', 0xd7d3bf), 0, 3.05, 0));
  mill.add(mesh(new THREE.ConeGeometry(3.35, 2.2, 8), mat('millRoof', 0x436f6c), 0, 7.15, 0));
  mill.add(mesh(new THREE.BoxGeometry(1.5, 2.15, 0.18), mat('door', 0x523324), 0, 1.08, 3.14));
  windmillBlades = new THREE.Group();
  windmillBlades.position.set(0, 5.25, 3.18);
  mill.add(windmillBlades);
  const spar = new THREE.BoxGeometry(0.22, 3.3, 0.18);
  const sail = new THREE.BoxGeometry(1.02, 1.8, 0.12);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(mesh(spar, mat('bladeWood', 0x8a6038), 0, 1.55, 0));
    arm.add(mesh(sail, mat('sail', 0xebe1bf), 0.42, 2.3, 0.03));
    windmillBlades.add(arm);
  }
  scene.add(mill);
  addCircleCollider(21, 4, 2.7, 'mill');

  keeper = createNPC(14, 7, 0x4c6d7e, 0xcdbd82);
  interactables.push({ type: 'keeper', position: keeper.position, radius: 2.4, prompt: 'Speak to Nilo', action: keeperAction });

  const consoleMesh = addBox(17.3, 4.3, 1.1, 1.0, 1.3, mat('console', 0x525d55), 0.65, true);
  scene.add(mesh(new THREE.OctahedronGeometry(0.28, 0), mat('consoleCrystal', C.wind, { emissive: C.wind, emissiveIntensity: 2 }), 17.3, 1.45, 4.3));
  interactables.push({ type: 'millConsole', position: consoleMesh.position, radius: 2.2, prompt: 'Use rotor sparks', action: millAction });

  // Cave seal that drops once the mill starts.
  caveSeal = addBox(31.2, -8.4, 1.1, 13.0, 4.5, mat('seal', 0x47645c, { emissive: 0x2f8068, emissiveIntensity: 0.6 }), 2.25, true);
  caveSeal.userData.baseY = caveSeal.position.y;
  // Terrain-backed partition colliders keep the ridge gate meaningful while leaving a generous opening once the seal drops.
  addRectCollider(31.2, 23.5, 1.2, 51.0, 'ridgeNorth');
  addRectCollider(31.2, -27.0, 1.2, 24.0, 'ridgeSouth');

  coreChest = createChest(37.2, -12.5, C.wind);
  interactables.push({ type: 'coreChest', position: coreChest.position, radius: 2.25, prompt: 'Open wind reliquary', action: coreAction });
  armorChest = createChest(-20.5, -2.2, 0x7ad5ff);
  interactables.push({ type: 'armorChest', position: armorChest.position, radius: 2.25, prompt: 'Open ridge cache', action: armorAction });

  // Breakable rune wall inside the grotto.
  runeWall = addBox(42.2, -17.5, 17.0, 1.15, 4.0, mat('runeWall', 0x59645e, { emissive: 0x5a4f91, emissiveIntensity: 0.55 }), 2, true);
  runeWall.userData.baseY = runeWall.position.y;
  runeWall.userData.runes = [];
  addRectCollider(32.45, -17.5, 2.5, 1.4, 'runeBankWest');
  addRectCollider(56.35, -17.5, 11.3, 1.4, 'runeBankEast');
  const runeGeo = new THREE.TorusGeometry(0.34, 0.08, 4, 8);
  for (const x of [40.4, 42.2, 44]) {
    const r = mesh(runeGeo, mat('rune', C.bossGlow, { emissive: C.bossGlow, emissiveIntensity: 2.1 }), x, 2.15, -16.88);
    r.rotation.x = Math.PI / 2;
    r.userData.baseY = r.position.y;
    scene.add(r);
    runeWall.userData.runes.push(r);
  }

  // Arena stones create a readable circle without hard-closing the player in.
  const arenaB = batch('arenaRock', geo('dodeca1', () => new THREE.DodecahedronGeometry(1, 0)), mat('arenaRock', C.darkStone));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const x = 48 + Math.cos(a) * 13.8;
    const z = -25 + Math.sin(a) * 13.8;
    const s = 1.05 + (i % 3) * 0.12;
    place(arenaB, x, 0.7, z, s, s, s);
    addCircleCollider(x, z, 0.8, 'arena');
  }

  for (const [x, z] of [[24, 10], [29, -4], [39, -10], [48, -31], [54, -21]]) addCrystal(x, z);

  addShrine('village', 'Village Shrine', -12, 28.5);
  addShrine('mill', 'Mill Shrine', 25.5, 0.5);
  addShrine('grotto', 'Grotto Shrine', 44.5, -12.5);

  buildHollow();
  addGrass();
  flushBatches();

  player = createHero();
  objectiveMarker = createObjectiveMarker();

  let id = 0;
  for (const [type, x, z] of [
    ['raider', -6, 8], ['raider', 3, 7], ['raider', 11, 1], ['raider', 20, -2],
    ['spitter', -14, 1], ['spitter', 25, -3], ['raider', 7, -5],
    ['burrower', -18, -16], ['burrower', -4, -22], ['burrower', 6, -31], ['burrower', -19, -27], ['burrower', 10, -17],
    ['spitter', -9, -29],
  ]) spawnEnemy(type, x, z, id++);

  bossRig = buildBossRig();
}

// ---------------------------------------------------------------- enemies
function spawnEnemy(type, x, z, id) {
  const def = BALANCE[type];
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = new THREE.Group();
  g.add(body);
  let mound = null;
  if (type === 'raider') {
    const b = mesh(geo('raiderBody', () => new THREE.IcosahedronGeometry(0.62, 1)), mat('enemy', C.enemy), 0, 0.72, 0);
    b.scale.y = 0.85;
    body.add(b);
    const horn = geo('raiderHorn', () => new THREE.ConeGeometry(0.28, 0.45, 5));
    body.add(mesh(horn, mat('enemy2', C.enemy2), -0.25, 1.15, 0.05));
    body.add(mesh(horn, mat('enemy2', C.enemy2), 0.25, 1.15, 0.05));
  } else if (type === 'spitter') {
    body.add(mesh(geo('spitterBody', () => new THREE.DodecahedronGeometry(0.55, 0)), mat('spitter', 0x8f6f66), 0, 0.7, 0));
    const spike = geo('spike', () => new THREE.ConeGeometry(0.11, 0.45, 4));
    for (let i = 0; i < 5; i++) {
      const s = mesh(spike, mat('spike', 0xd6ad72), Math.cos((i / 5) * Math.PI * 2) * 0.35, 1.0, Math.sin((i / 5) * Math.PI * 2) * 0.35);
      s.rotation.z = (i / 5) * Math.PI * 2;
      body.add(s);
    }
  } else {
    // Burrower: a drill-headed digger. Only the moving dirt mound shows while it is under.
    body.add(mesh(geo('burrowerHead', () => new THREE.ConeGeometry(0.5, 1.1, 6)), mat('burrower', 0x9a7a55), 0, 0.62, 0));
    const tooth = geo('burrowerTooth', () => new THREE.ConeGeometry(0.1, 0.34, 4));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const t = mesh(tooth, mat('burrowerTooth', 0xe8d8a8), Math.cos(a) * 0.46, 0.22, Math.sin(a) * 0.46);
      t.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      body.add(t);
    }
    const eye = geo('burrowerEye', () => new THREE.OctahedronGeometry(0.08, 0));
    const eyeMat = mat('burrowerEye', 0xffb579, { emissive: 0xff7f50, emissiveIntensity: 1.8 });
    body.add(mesh(eye, eyeMat, -0.16, 0.62, 0.36, false, false));
    body.add(mesh(eye, eyeMat, 0.16, 0.62, 0.36, false, false));
    mound = mesh(geo('dodeca1', () => new THREE.DodecahedronGeometry(1, 0)), mat('mound', C.sand2), 0, 0.08, 0, false, true);
    mound.scale.set(0.8, 0.28, 0.8);
    g.add(mound);
  }
  scene.add(g);
  const e = {
    id, type, mesh: g, body, mound, hp: 0, maxHp: def.hp, damage: def.damage, xp: def.xp, speed: def.speed,
    attackRange: def.attackRange, cooldown: 0, dead: false, hitFlash: 0, home: new THREE.Vector3(x, 0, z),
    respawnAt: 0, kbT: 0, kbx: 0, kbz: 0, bstate: 'under', phaseT: 0,
  };
  enemies.push(e);
  reviveEnemy(e);
  return e;
}

function reviveEnemy(e) {
  e.dead = false;
  e.maxHp = Math.round(BALANCE[e.type].hp * diff().hp);
  e.hp = e.maxHp;
  e.cooldown = Math.random() * 0.5;
  e.hitFlash = 0;
  e.kbT = 0;
  e.mesh.visible = true;
  e.mesh.position.copy(e.home);
  e.body.scale.setScalar(1);
  if (e.type === 'burrower') setBurrowState(e, 'under');
}

function setBurrowState(e, s) {
  e.bstate = s;
  if (s === 'under') {
    e.body.visible = false;
    e.body.position.y = -1.2;
    e.mound.visible = true;
    e.phaseT = 0;
  } else if (s === 'rise') {
    e.phaseT = 0.5;
  } else if (s === 'up') {
    e.body.visible = true;
    e.phaseT = 1.7;
  } else if (s === 'dig') {
    e.phaseT = 0.45;
  }
}
const canBeHit = (e) => !e.dead && (e.type !== 'burrower' || e.bstate === 'up' || e.bstate === 'dig');

function buildBossRig() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const rockMat = mat('boss', C.boss, { roughness: 0.72 });
  const glowMat = mat('bossEye', C.bossGlow, { emissive: C.bossGlow, emissiveIntensity: 2.3, roughness: 0.3 });
  body.add(mesh(new THREE.DodecahedronGeometry(1.25, 0), rockMat, 0, 1.55, 0));
  const limbGeo = new THREE.DodecahedronGeometry(0.72, 0);
  for (let i = 0; i < 4; i++) {
    const limb = mesh(limbGeo, rockMat, Math.cos((i * Math.PI) / 2) * 1.15, 1.25, Math.sin((i * Math.PI) / 2) * 1.15);
    limb.scale.set(0.85, 1.2, 0.85);
    body.add(limb);
  }
  body.add(mesh(new THREE.OctahedronGeometry(0.38, 0), glowMat, 0, 1.72, 0.92));
  const crown = mesh(new THREE.TorusGeometry(1.35, 0.12, 5, 10), glowMat, 0, 2.6, 0);
  crown.rotation.x = Math.PI / 2;
  body.add(crown);
  g.visible = false;
  scene.add(g);
  return { group: g, body, glowMat };
}

function spawnBoss() {
  if (boss || state.bossDefeated) return;
  const g = bossRig.group;
  g.position.copy(ARENA_POS);
  g.rotation.set(0, 0, 0);
  g.visible = true;
  bossRig.body.scale.setScalar(1);
  bossRig.body.position.set(0, 0, 0);
  const hp = Math.round(BALANCE.boss.hp * diff().hp);
  boss = {
    type: 'boss', mesh: g, body: bossRig.body, hp, maxHp: hp, damage: BALANCE.boss.touchDamage, speed: BALANCE.boss.speed,
    attackRange: 1.8, cooldown: 1.2, dead: false, phase: 0, enraged: false, gustTimer: 2.5, chargeTimer: 4.2, hitFlash: 0,
    windup: 0, lungeT: 0, lungeDir: new THREE.Vector3(), kbT: 0, home: ARENA_POS,
  };
  enemies.push(boss);
  ui.bossHud.classList.remove('hidden');
  updateHud();
  toast('STONE GALE AWAKENS', 1800);
  cameraState.shake = 0.4;
  sfx('boss');
  input.rumble(0.6, 300);
}

function despawnBoss() {
  if (!boss) return;
  const i = enemies.indexOf(boss);
  if (i >= 0) enemies.splice(i, 1);
  bossRig.group.visible = false;
  boss = null;
  ui.bossHud.classList.add('hidden');
}

// ---------------------------------------------------------------- pools (no allocations per shot or hit)
const SHOT = {
  player: { geo: () => geo('orb', () => new THREE.IcosahedronGeometry(0.34, 1)), mat: () => mat('windShot', 0x9affdd, { emissive: C.wind, emissiveIntensity: 2.4, roughness: 0.3 }) },
  enemy: { geo: () => geo('spit', () => new THREE.IcosahedronGeometry(0.22, 0)), mat: () => mat('enemyShot', 0xffb579, { emissive: 0xff7f50, emissiveIntensity: 2 }) },
  gust: { geo: () => geo('gust', () => new THREE.OctahedronGeometry(0.26, 0)), mat: () => mat('bossGlow', C.bossGlow, { emissive: C.bossGlow, emissiveIntensity: 2.3 }) },
};
const shotPool = { player: [], enemy: [], gust: [] };
function acquireShot(kind) {
  let m = shotPool[kind].pop();
  if (!m) {
    m = new THREE.Mesh(SHOT[kind].geo(), SHOT[kind].mat());
    m.castShadow = false;
    m.receiveShadow = false;
    scene.add(m);
  }
  m.visible = true;
  m.scale.setScalar(1);
  return m;
}
function fireShot(kind, owner, x, y, z, dx, dz, speed, life, damage, radius, scale = 1) {
  const m = acquireShot(kind);
  m.position.set(x, y, z);
  m.scale.setScalar(scale);
  projectiles.push({ kind, owner, mesh: m, vx: dx * speed, vz: dz * speed, life, damage, radius });
}
function releaseShot(i) {
  const p = projectiles[i];
  p.mesh.visible = false;
  shotPool[p.kind].push(p.mesh);
  projectiles.splice(i, 1);
}
function clearShots() {
  for (let i = projectiles.length - 1; i >= 0; i--) releaseShot(i);
}

const BURST_COLORS = [C.wind, C.hurt, C.sand2, C.heal, C.tempest];
const burstMats = new Map();
function burstMat(color) {
  let m = burstMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    burstMats.set(color, m);
  }
  return m;
}
const burstPool = [];
const bursts = [];
function popEffect(pos, color, count = 5, spread = 1) {
  const n = kit.detail(count, 2);
  const m = burstMat(color);
  for (let i = 0; i < n; i++) {
    let p = burstPool.pop();
    if (!p) {
      p = { mesh: new THREE.Mesh(geo('tetra', () => new THREE.TetrahedronGeometry(0.11, 0)), m), vx: 0, vy: 0, vz: 0, t: 0, life: 0.45 };
      p.mesh.castShadow = false;
      p.mesh.receiveShadow = false;
      scene.add(p.mesh);
    }
    p.mesh.material = m;
    p.mesh.visible = true;
    p.mesh.position.set(pos.x, 1.0, pos.z);
    p.mesh.scale.setScalar(1);
    p.vx = (Math.random() - 0.5) * 4 * spread;
    p.vy = 2 + Math.random() * 2;
    p.vz = (Math.random() - 0.5) * 4 * spread;
    p.t = 0;
    bursts.push(p);
  }
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const p = bursts[i];
    p.t += dt;
    const k = p.t / p.life;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.vy -= dt * 6;
    p.mesh.rotation.x += dt * 9;
    p.mesh.scale.setScalar(Math.max(0.01, 1 - k));
    if (k >= 1) {
      p.mesh.visible = false;
      burstPool.push(p);
      bursts.splice(i, 1);
    }
  }
}

// Expanding rings (bells, charged hits) and the spark / leaf pickups share small pools too.
const pulsePool = [];
function ringPulse(pos, color = C.wind, size = 3) {
  let m = pulsePool.pop();
  if (!m) {
    m = mesh(geo('pulse', () => new THREE.TorusGeometry(1, 0.07, 4, 32)), mat('pulse', C.wind, { emissive: C.wind, emissiveIntensity: 2.2 }), 0, 0, 0, false, false);
    m.rotation.x = Math.PI / 2;
    scene.add(m);
  }
  m.material = color === C.tempest ? mat('pulseTempest', C.tempest, { emissive: 0xb58cff, emissiveIntensity: 2.2 }) : mat('pulse', C.wind, { emissive: C.wind, emissiveIntensity: 2.2 });
  m.visible = true;
  m.position.set(pos.x, 0.25, pos.z);
  m.scale.setScalar(0.3);
  effects.push({ type: 'pulse', obj: m, t: 0, duration: 0.55, size });
}
const sparkPool = [];
function popPickup(pos) {
  let m = sparkPool.pop();
  if (!m) {
    m = mesh(geo('spark', () => new THREE.OctahedronGeometry(0.27, 0)), mat('sparkOrb', C.wind, { emissive: C.wind, emissiveIntensity: 2.6 }), 0, 0, 0, false, false);
    scene.add(m);
  }
  m.visible = true;
  m.position.set(pos.x, 1, pos.z);
  m.scale.setScalar(1);
  effects.push({ type: 'pickup', obj: m, t: 0, duration: 0.9 });
  sfx('pickup');
}
const leaves = [];
const leafPool = [];
function dropLeaf(pos) {
  let m = leafPool.pop();
  if (!m) {
    m = mesh(geo('leaf', () => new THREE.OctahedronGeometry(0.24, 0)), mat('leaf', C.heal, { emissive: 0x4fc85a, emissiveIntensity: 1.3, roughness: 0.5 }), 0, 0, 0, true, false);
    m.scale.set(1, 0.45, 1.5);
    scene.add(m);
  }
  m.visible = true;
  m.position.set(pos.x, 0.6, pos.z);
  leaves.push({ mesh: m, t: 0, life: 16 });
}
function clearLeaves() {
  for (const l of leaves) {
    l.mesh.visible = false;
    leafPool.push(l.mesh);
  }
  leaves.length = 0;
}
function updateLeaves(dt) {
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.t += dt;
    l.mesh.rotation.y += dt * 2.4;
    l.mesh.position.y = 0.6 + Math.sin(l.t * 3) * 0.12;
    // Blink during the last three seconds so the player sees it is about to go.
    l.mesh.visible = l.life - l.t > 3 || Math.floor(l.t * 8) % 2 === 0;
    // Picked up by walking over it, but only when it would heal: at full life it waits.
    const near = state.hp < state.maxHp && Math.hypot(player.position.x - l.mesh.position.x, player.position.z - l.mesh.position.z) < 1.2;
    if (near || l.t >= l.life) {
      if (near) {
        const before = state.hp;
        state.hp = Math.min(state.maxHp, state.hp + BALANCE.healDrop);
        popEffect(l.mesh.position, C.heal, 6, 0.6);
        sfx('heal');
        toast(`WIND-LEAF · +${Math.round(state.hp - before)} LIFE`, 900);
        updateHud();
      }
      l.mesh.visible = false;
      leafPool.push(l.mesh);
      leaves.splice(i, 1);
    }
  }
}

function animateOut(obj, duration) {
  effects.push({ type: 'fadeScale', obj, t: 0, duration, startY: obj.userData.baseY ?? obj.position.y });
}
function restoreObject(obj) {
  for (let i = effects.length - 1; i >= 0; i--) if (effects[i].obj === obj) effects.splice(i, 1);
  obj.visible = true;
  obj.scale.setScalar(1);
  if (obj.userData.baseY !== undefined) obj.position.y = obj.userData.baseY;
}
function updateEffects(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    const p = Math.min(1, e.t / e.duration);
    if (e.type === 'fadeScale') {
      e.obj.scale.setScalar(Math.max(0.001, 1 - p));
      e.obj.position.y = e.startY - p * 1.3;
    } else if (e.type === 'pickup') {
      e.obj.position.y = 1 + p * 2.5;
      e.obj.rotation.y += dt * 8;
      e.obj.scale.setScalar(1 - p * 0.4);
    } else if (e.type === 'pulse') {
      e.obj.scale.set(0.3 + p * e.size, 0.3 + p * e.size, Math.max(0.05, 1 - p));
    }
    if (p >= 1) {
      e.obj.visible = false;
      if (e.type === 'pickup') sparkPool.push(e.obj);
      else if (e.type === 'pulse') pulsePool.push(e.obj);
      effects.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------- quest actions
function keeperAction() {
  if (state.quest === 0) {
    state.quest = state.sparks >= 3 ? 2 : 1;
    toast(state.sparks >= 3 ? 'Nilo: “You already found all three sparks. Feed them into the mill.”' : 'Nilo: “Three rotor sparks were stolen by ridge raiders.”', 3000);
    updateObjective();
    saveGame();
  } else if (state.quest === 1) toast(`Nilo: “Bring ${Math.max(0, 3 - state.sparks)} more rotor spark${3 - state.sparks === 1 ? '' : 's'}.”`, 2100);
  else if (state.quest === 2) toast('Nilo: “Feed the sparks into the mill console.”', 2100);
  else if (!state.ringClaimed && state.quest >= 4) toast('Nilo: “North of the field lies the Hollow. Its three windbells only open the old vault when they sing together.”', 3600);
  else toast('Nilo: “The old current is moving again.”', 1800);
}

function millAction() {
  if (state.quest < 1) {
    toast('The mill console is dormant.', 1500);
    return;
  }
  if (state.sparks < 3) {
    toast(`The rotor needs ${3 - state.sparks} more spark${3 - state.sparks === 1 ? '' : 's'}.`, 1800);
    return;
  }
  if (state.millOn) {
    toast('The gale mill is already running.', 1400);
    return;
  }
  state.millOn = true;
  state.quest = 3;
  caveSeal.userData.collider.active = false;
  animateOut(caveSeal, 1.1);
  toast('GALE MILL RESTORED · GROTTO SEAL OPENED', 2600);
  updateObjective();
  sfx('chime');
  input.rumble(0.4, 220);
  saveGame();
}

function coreAction() {
  if (!state.millOn) {
    toast('A windless lock holds the reliquary.', 1600);
    return;
  }
  if (state.coreClaimed) {
    toast('The reliquary is empty.', 1200);
    return;
  }
  setChestOpen(coreChest, true);
  state.coreClaimed = true;
  state.swordTier = 2;
  addXp(BALANCE.coreXp);
  state.quest = 4;
  updateObjective();
  updateHud();
  toast(`WIND CORE ACQUIRED · HOLD ${attackName()}, THEN RELEASE`, 3000);
  sfx('upgrade');
  ringPulse(coreChest.position, C.wind, 3);
  saveGame();
}

function armorAction() {
  if (armorChest.userData.opened) {
    toast('The ridge cache is empty.', 1200);
    return;
  }
  setChestOpen(armorChest, true);
  state.armorTier = 1;
  updateHud();
  toast('RIDGE GUARD EQUIPPED · DAMAGE −16%', 2300);
  sfx('upgrade');
  saveGame();
}

function vaultAction() {
  if (!state.vaultOpen) {
    toast('A wind seal hums over the vault. Ring all three windbells so they sing together.', 3000);
    return;
  }
  if (state.ringClaimed) {
    toast('The Hollow vault is empty.', 1200);
    return;
  }
  setChestOpen(vault.chest, true);
  state.ringClaimed = true;
  addXp(BALANCE.vaultXp);
  updateHud();
  updateSideText(true);
  toast('TEMPEST RING · CHARGED SHOTS SPLIT INTO THREE', 3000);
  sfx('upgrade');
  ringPulse(vault.position, C.tempest, 4);
  saveGame();
}

function strikeBell(bell) {
  bell.amp = Math.max(bell.amp, state.swordTier < 2 ? 0.14 : 0.55);
  if (state.swordTier < 2) {
    sfx('dull');
    toast('The windbell only clanks. It answers to wind — the Wind Core waits beyond Gale Mill.', 2800);
    return;
  }
  sfx('bell', BELL_NOTES[bell.i]);
  ringPulse(bell.position, C.wind, 3.4);
  input.rumble(0.25, 90);
  if (state.vaultOpen) return;
  const wasSilent = bell.rungUntil <= gameTime;
  bell.rungUntil = gameTime + BALANCE.bellWindow * diff().bell;
  if (!state.bellsEver[bell.i]) {
    state.bellsEver[bell.i] = true;
    addXp(BALANCE.bellXp);
  }
  let humming = 0;
  for (const b of bells) if (b.rungUntil > gameTime) humming++;
  if (humming >= 3) openVault();
  else if (wasSilent) toast(`WINDBELL ${humming}/3 SINGING · RING THE OTHERS BEFORE IT FADES`, 2200);
  updateSideText(true);
}

function openVault() {
  state.vaultOpen = true;
  vault.sealCollider.active = false;
  animateOut(vault.seal, 1.2);
  toast('THE THREE BELLS SING · THE HOLLOW VAULT OPENS', 2800);
  sfx('vault');
  cameraState.shake = 0.25;
  input.rumble(0.5, 260);
  updateSideText(true);
  saveGame();
}

function restAtShrine(shrine) {
  attune(shrine, true);
  state.hp = state.maxHp;
  updateHud();
  popEffect(player.position, C.heal, 7, 0.6);
  sfx('heal');
  toast(`${shrine.name.toUpperCase()} · LIFE RESTORED · PROGRESS SAVED`, 2200);
  saveGame();
}

function attune(shrine, quiet = false) {
  if (state.checkpoint === shrine.id) return;
  state.checkpoint = shrine.id;
  if (!quiet) {
    toast(`${shrine.name.toUpperCase()} ATTUNED · YOU WILL RETURN HERE`, 2000);
    sfx('chime');
  }
  ringPulse(shrine.position, C.wind, 2.4);
  saveGame();
}

const shrineById = (id) => shrines.find((s) => s.id === id) || shrines[0];

// ---------------------------------------------------------------- HUD

function objectiveText() {
  return (
    [
      'Reach Gale Mill · speak to Keeper Nilo',
      `Recover rotor sparks from raiders · ${state.sparks}/3`,
      'Restart Gale Mill at the console',
      'Enter Zephyr Grotto · claim the Wind Core',
      `Hold ${attackName()} to charge · shatter the rune wall`,
      'Defeat the Stone Gale',
      'Wind restored · explore the ridge',
    ][state.quest] || 'Explore the ridge'
  );
}
let lastObjective = '';
function updateObjective() {
  const text = objectiveText();
  if (text === lastObjective) return;
  lastObjective = text;
  ui.objective.textContent = text;
  layoutTouchTop();
}

let lastSide = null;
let sideNextAt = 0;
function sideTextValue() {
  if (!state.hollowFound || state.ringClaimed) return '';
  if (state.vaultOpen) return 'The Hollow · the vault stands open';
  if (state.swordTier < 2) return 'The Hollow · the windbells want wind';
  let humming = 0;
  let left = Infinity;
  for (const b of bells) {
    const r = b.rungUntil - gameTime;
    if (r > 0) {
      humming++;
      left = Math.min(left, r);
    }
  }
  if (!humming) return 'The Hollow · ring all three windbells together';
  return `The Hollow · windbells ${humming}/3 · ${Math.ceil(left)}s`;
}
function updateSideText(force = false) {
  if (!force && realTime < sideNextAt) return;
  sideNextAt = realTime + 0.25;
  const text = sideTextValue();
  if (text === lastSide) return;
  lastSide = text;
  ui.sideText.textContent = text;
  ui.sideText.classList.toggle('hidden', !text);
  layoutTouchTop();
}

function addXp(amount) {
  const old = state.level;
  state.xp += amount;
  state.level = levelFromXp(state.xp);
  if (state.level > old) {
    const oldMax = state.maxHp;
    state.maxHp = maxHpFor(state.level);
    state.hp = Math.min(state.maxHp, state.hp + (state.maxHp - oldMax) + 12);
    toast(`LEVEL ${state.level} · LIFE AND ATTACK UP`, 2200);
    sfx('level');
    ringPulse(player.position, C.wind, 2.6);
  }
  updateHud();
}

function gearLabel() {
  return `Windshard ${state.swordTier === 2 ? 'II' : 'I'} · ${state.armorTier ? 'Ridge Guard' : 'Traveler Wrap'}${state.ringClaimed ? ' · Tempest Ring' : ''}`;
}
function updateHud() {
  state.maxHp = maxHpFor(state.level);
  const next = state.level >= BALANCE.maxLevel ? state.xp : BALANCE.xpThresholds[state.level];
  const prev = BALANCE.xpThresholds[state.level - 1] || 0;
  ui.levelText.textContent = `LV ${state.level}`;
  ui.hpText.textContent = `${Math.max(0, Math.ceil(state.hp))} / ${state.maxHp}`;
  ui.hpFill.style.width = `${Math.max(0, (state.hp / state.maxHp) * 100)}%`;
  const xpPct = state.level >= BALANCE.maxLevel ? 100 : Math.max(0, Math.min(100, ((state.xp - prev) / (next - prev)) * 100));
  ui.xpFill.style.width = `${xpPct}%`;
  ui.xpText.textContent = state.level >= BALANCE.maxLevel ? `${state.xp} / MAX` : `${state.xp} / ${next}`;
  ui.gearText.textContent = gearLabel();
  if (boss && !boss.dead) ui.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
}

let toastTimer = 0;
function toast(text, duration = 1800) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), duration);
}

// Keep the touch pause pill just under the top-right HUD card, whatever its height.
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none';
document.body.append(safeProbe);
function layoutTouchTop() {
  if (!kit.touch || ui.hud.classList.contains('hidden')) return;
  const a = ui.objectiveCard.getBoundingClientRect();
  const b = ui.gearCard.getBoundingClientRect();
  const right = kit.size.width * 0.55;
  let bottom = 0;
  if (a.height && a.right > right) bottom = Math.max(bottom, a.bottom);
  if (b.height && b.right > right) bottom = Math.max(bottom, b.bottom);
  const safe = safeProbe.getBoundingClientRect().height;
  kit.touch.placeTop('right', Math.max(10, Math.round(bottom + 8 - safe)));
}

let lastPrompt = '';
let promptShown = false;
function nearestInteractable() {
  let best = null;
  let bestD = Infinity;
  for (const it of interactables) {
    const d = Math.hypot(player.position.x - it.position.x, player.position.z - it.position.z);
    if (d < it.radius && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  return best;
}
function updatePrompt() {
  const best = mode === 'play' ? nearestInteractable() : null;
  const text = best ? `${interactName()} · ${best.prompt}` : '';
  if (text !== lastPrompt) {
    lastPrompt = text;
    if (text) ui.prompt.textContent = text;
    ui.prompt.classList.toggle('show', !!text);
  }
  if (!!best !== promptShown) {
    promptShown = !!best;
    kit.touch?.setShown('interact', promptShown);
  }
}

// ---------------------------------------------------------------- combat
let runeHintAt = 0;
function meleeAttack() {
  state.attackCooldown = BALANCE.player.meleeCooldown;
  player.userData.attackAnim = 0.24;
  sfx('slash');
  const facing = player.userData.facing;
  const dmg = attackFor(state.level, state.swordTier);
  let hit = false;
  for (const e of enemies) {
    if (!canBeHit(e)) continue;
    const dx = e.mesh.position.x - player.position.x;
    const dz = e.mesh.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > BALANCE.player.meleeRange + (e === boss ? 0.6 : 0)) continue;
    const dot = (dx * facing.x + dz * facing.z) / (dist || 1);
    if (dot > 0.05) {
      damageEnemy(e, e === boss ? Math.max(1, Math.round(dmg * 0.55)) : dmg, dx / (dist || 1), dz / (dist || 1));
      hit = true;
    }
  }
  for (const b of bells) {
    const dx = b.position.x - player.position.x;
    const dz = b.position.z - player.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < BALANCE.player.meleeRange + 0.7 && (dx * facing.x + dz * facing.z) / (dist || 1) > 0.05) strikeBell(b);
  }
  if (hit) {
    hitStop = Math.max(hitStop, 0.045);
    input.rumble(0.22, 60);
  }
  // The rune wall shrugs off steel: point the player at the charged shot.
  if (state.quest === 4 && !state.runeBroken && Math.abs(player.position.z - runeWall.position.z) < 3.2 && Math.abs(player.position.x - runeWall.position.x) < 9.5 && gameTime > runeHintAt) {
    runeHintAt = gameTime + 6;
    toast(`The runes drink the blade's edge. Hold ${attackName()} to charge a wind shot.`, 2600);
  }
}

function chargedAttack() {
  state.attackCooldown = 0.52;
  player.userData.attackAnim = 0.32;
  const f = player.userData.facing;
  const dmg = Math.round(attackFor(state.level, state.swordTier) * BALANCE.player.chargedMultiplier);
  const x = player.position.x + f.x * 1.1;
  const z = player.position.z + f.z * 1.1;
  fireShot('player', 'player', x, 1.0, z, f.x, f.z, 12.8, 1.25, dmg, 0.75);
  if (state.ringClaimed) {
    // Tempest Ring: two side shots at a fixed spread, each dealing a share of the main shot.
    const side = Math.max(1, Math.round(dmg * BALANCE.player.tempestSide));
    for (const a of [-0.26, 0.26]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      fireShot('player', 'player', x, 1.0, z, f.x * c - f.z * s, f.x * s + f.z * c, 12.2, 1.1, side, 0.55, 0.72);
    }
  }
  sfx('charge');
  cameraState.shake = Math.max(cameraState.shake, 0.08);
  input.rumble(0.35, 90);
}

function damageEnemy(e, amount, kx = 0, kz = 0) {
  if (e.dead) return;
  e.hp -= amount;
  e.hitFlash = 0.14;
  if (e !== boss) {
    e.kbT = 0.12;
    e.kbx = kx * 7;
    e.kbz = kz * 7;
  }
  popEffect(e.mesh.position, C.wind);
  sfx('hit');
  if (e === boss) cameraState.shake = Math.max(cameraState.shake, 0.09);
  if (e.hp <= 0) killEnemy(e);
  updateHud();
}

function killEnemy(e) {
  e.dead = true;
  e.mesh.visible = false;
  state.kills++;
  if (e === boss) {
    state.bossDefeated = true;
    state.quest = 6;
    addXp(BALANCE.boss.xp);
    ui.bossHud.classList.add('hidden');
    popEffect(e.mesh.position, C.tempest, 14, 2);
    ringPulse(e.mesh.position, C.tempest, 6);
    cameraState.shake = 0.5;
    hitStop = 0.12;
    input.rumble(0.8, 420);
    sfx('break');
    updateObjective();
    completeRun();
    return;
  }
  e.respawnAt = gameTime + BALANCE.respawnSeconds;
  addXp(e.xp);
  input.rumble(0.3, 80);
  if (e.type === 'raider' && state.sparks < 3) {
    state.sparks++;
    popPickup(e.mesh.position);
    toast(state.quest === 0 ? `STRANGE ROTOR SPARK ${state.sparks}/3` : `ROTOR SPARK ${state.sparks}/3`, 1200);
    if (state.quest === 1 && state.sparks >= 3) {
      state.quest = 2;
      toast('ROTOR SET COMPLETE · RETURN TO THE MILL', 2300);
    }
    updateObjective();
    saveGame();
  } else if (Math.random() < (e.type === 'burrower' ? 0.5 : 0.3)) {
    dropLeaf(e.mesh.position);
  }
}

function hurtPlayer(raw, source) {
  if (state.invuln > 0 || mode !== 'play') return;
  const dmg = damageAfterArmor(raw * diff().damage, state.armorTier);
  state.hp -= dmg;
  state.invuln = BALANCE.player.invulnAfterHit;
  state.hurtBlink = BALANCE.player.invulnAfterHit;
  cameraState.shake = Math.max(cameraState.shake, 0.22);
  popEffect(player.position, C.hurt);
  sfx('hurt');
  input.rumble(0.55, 150);
  if (source) {
    const dx = player.position.x - source.x;
    const dz = player.position.z - source.z;
    const d = Math.hypot(dx, dz) || 1;
    state.kbT = 0.1;
    state.kbx = (dx / d) * 8;
    state.kbz = (dz / d) * 8;
  }
  updateHud();
  if (state.hp <= 0) die();
}

function enemyShot(e, dx, dz, dist) {
  fireShot('enemy', 'enemy', e.mesh.position.x, 0.9, e.mesh.position.z, dx / (dist || 1), dz / (dist || 1), 6.4, 2.0, e.damage, 0.42);
  sfx('spit');
}

function bossGust(e) {
  const count = e.phase ? 10 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (e.phase ? 0.23 : 0) + (e.gustTurn || 0);
    fireShot('gust', 'enemy', e.mesh.position.x, 1.1, e.mesh.position.z, Math.cos(a), Math.sin(a), e.phase ? 7.4 : 6.2, 2.2, BALANCE.boss.gustDamage, 0.42);
  }
  // Each volley turns a little, so a safe lane never stays in one spot.
  e.gustTurn = ((e.gustTurn || 0) + 0.19) % (Math.PI * 2);
  sfx('gust');
}

function breakRuneWall() {
  if (state.runeBroken) return;
  state.runeBroken = true;
  state.quest = 5;
  runeWall.userData.collider.active = false;
  animateOut(runeWall, 0.8);
  for (const r of runeWall.userData.runes) animateOut(r, 0.6);
  toast('RUNE WALL SHATTERED · SOMETHING STIRS AHEAD', 2500);
  cameraState.shake = 0.28;
  sfx('break');
  input.rumble(0.6, 260);
  popEffect(runeWall.position, C.bossGlow, 12, 2.4);
  updateObjective();
  saveGame();
}

// ---------------------------------------------------------------- simulation
const fi = { mx: 0, mz: 0, attackPressed: false, attackDown: false, dashBuffer: 0, interact: false };
function readInput() {
  const mv = input.vector('move');
  fi.mx = mv.x;
  fi.mz = -mv.y;
  if (input.pressed('attack')) fi.attackPressed = true;
  fi.attackDown = input.down('attack');
  if (input.pressed('dash')) fi.dashBuffer = 0.12;
  if (input.pressed('interact')) fi.interact = true;
}

function doAttack(kind) {
  if (kind === 'charged') chargedAttack();
  else meleeAttack();
}

function updatePlayer(dt) {
  const P = BALANCE.player;
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.dashCooldown = Math.max(0, state.dashCooldown - dt);
  state.invuln = Math.max(0, state.invuln - dt);
  state.hurtBlink = Math.max(0, state.hurtBlink - dt);
  fi.dashBuffer = Math.max(0, fi.dashBuffer - dt);

  // Attack: press starts the hold, release swings (or fires the charged wind shot).
  if (fi.attackPressed) {
    fi.attackPressed = false;
    if (!state.attackHeld) {
      state.attackHeld = true;
      state.attackHold = 0;
      state.chargeCued = false;
    }
  }
  if (state.attackHeld) {
    state.attackHold += dt;
    if (state.swordTier >= 2 && !state.chargeCued && state.attackHold >= P.chargeSeconds) {
      state.chargeCued = true;
      sfx('ready');
      input.rumble(0.2, 50);
    }
    if (!fi.attackDown) {
      state.attackHeld = false;
      const kind = state.swordTier >= 2 && state.attackHold >= P.chargeSeconds ? 'charged' : 'melee';
      state.attackHold = 0;
      // A release during the cooldown is buffered briefly instead of being dropped.
      if (state.attackCooldown > 0) {
        state.buffered = kind;
        state.bufferTimer = 0.2;
      } else doAttack(kind);
    }
  }
  if (state.buffered) {
    state.bufferTimer -= dt;
    if (state.attackCooldown <= 0) {
      doAttack(state.buffered);
      state.buffered = null;
    } else if (state.bufferTimer <= 0) state.buffered = null;
  }

  let x = fi.mx;
  let z = fi.mz;
  const len = Math.hypot(x, z);
  if (len > 1) {
    x /= len;
    z /= len;
  }
  const moving = Math.hypot(x, z) > 0.08;
  if (moving) {
    player.userData.facing.set(x, 0, z).normalize();
    player.rotation.y = Math.atan2(x, z);
    player.userData.walk += dt * 10;
  }
  if (fi.dashBuffer > 0 && state.dashCooldown <= 0 && state.dashTimer <= 0) {
    fi.dashBuffer = 0;
    state.dashTimer = P.dashDuration;
    state.dashCooldown = P.dashCooldown;
    state.invuln = Math.max(state.invuln, 0.27);
    sfx('dash');
    popEffect(player.position, C.wind, 3, 0.5);
  }
  let speed = P.speed;
  if (state.dashTimer > 0) {
    state.dashTimer -= dt;
    speed = P.dashSpeed;
    x = player.userData.facing.x;
    z = player.userData.facing.z;
  }
  const slow = state.attackHeld ? 0.78 : 1;
  let mx = x * speed * slow * dt;
  let mz = z * speed * slow * dt;
  if (state.kbT > 0) {
    state.kbT -= dt;
    mx += state.kbx * dt;
    mz += state.kbz * dt;
  }
  moveEntity(player, mx, mz, 0.48);
  player.position.y = Math.abs(Math.sin(player.userData.walk)) * 0.04;
  const swing = moving ? Math.sin(player.userData.walk) * 0.5 : 0;
  player.userData.legL.rotation.x = swing;
  player.userData.legR.rotation.x = -swing;

  const blade = player.userData.blade;
  if (state.attackHeld && state.swordTier >= 2) {
    const p = Math.min(1, state.attackHold / P.chargeSeconds);
    blade.scale.setScalar(1 + p * 0.25);
    player.userData.bladeMat.emissiveIntensity = 2.4 + p * 3.2 + (p >= 1 ? Math.sin(gameTime * 30) * 0.8 : 0);
  } else {
    blade.scale.setScalar(1);
    player.userData.bladeMat.emissiveIntensity = 2.4;
  }
  if (player.userData.attackAnim > 0) {
    player.userData.attackAnim -= dt;
    const t = 1 - player.userData.attackAnim / 0.32;
    player.userData.swordPivot.rotation.z = -0.4 + Math.sin(t * Math.PI) * 1.8;
  } else player.userData.swordPivot.rotation.z = -0.42;

  if (fi.interact) {
    fi.interact = false;
    const best = nearestInteractable();
    if (best) best.action();
  }

  // Shrines attune as the hero passes; the Hollow announces itself once.
  for (const s of shrines) {
    if (state.checkpoint !== s.id && Math.hypot(player.position.x - s.position.x, player.position.z - s.position.z) < 3.2) attune(s);
  }
  if (!state.hollowFound && player.position.z < -12.5 && player.position.x < 29) {
    state.hollowFound = true;
    toast('THE HOLLOW · THREE OLD WINDBELLS SLEEP HERE', 2600);
    updateSideText(true);
    saveGame();
  }
}

function moveEntity(obj, dx, dz, radius) {
  const tryX = obj.position.x + dx;
  if (!collides(tryX, obj.position.z, radius)) obj.position.x = tryX;
  const tryZ = obj.position.z + dz;
  if (!collides(obj.position.x, tryZ, radius)) obj.position.z = tryZ;
  obj.position.x = Math.max(-38, Math.min(62, obj.position.x));
  obj.position.z = Math.max(-39, Math.min(49, obj.position.z));
}

function collides(x, z, r) {
  for (const c of colliders) {
    if (!c.active) continue;
    if (c.type === 'circle') {
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = r + c.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    } else {
      const nx = Math.max(c.x - c.w / 2, Math.min(x, c.x + c.w / 2));
      const nz = Math.max(c.z - c.d / 2, Math.min(z, c.z + c.d / 2));
      if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
    }
  }
  return false;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.dead) {
      if (e !== boss && gameTime >= e.respawnAt && Math.hypot(player.position.x - e.home.x, player.position.z - e.home.z) > 24) {
        reviveEnemy(e);
        e.mesh.visible = true;
      }
      continue;
    }
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.body.scale.setScalar(1 + e.hitFlash * 1.5);
    if (e.kbT > 0) {
      e.kbT -= dt;
      moveEntity(e.mesh, e.kbx * dt, e.kbz * dt, e === boss ? 1.05 : 0.48);
    }
    const dx = player.position.x - e.mesh.position.x;
    const dz = player.position.z - e.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (e === boss) {
      updateBoss(e, dt, dx, dz, dist);
      continue;
    }
    if (e.type === 'burrower') {
      updateBurrower(e, dt, dx, dz, dist);
      continue;
    }
    if (dist < 9.5 && dist > e.attackRange * 0.92) {
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      moveEntity(e.mesh, nx * e.speed * dt, nz * e.speed * dt, 0.48);
      e.mesh.rotation.y = Math.atan2(nx, nz);
    } else if (dist >= 9.5) {
      // Out of reach: drift back to its post, so the field stays readable.
      const hx = e.home.x - e.mesh.position.x;
      const hz = e.home.z - e.mesh.position.z;
      const hd = Math.hypot(hx, hz);
      if (hd > 0.6) moveEntity(e.mesh, (hx / hd) * e.speed * 0.45 * dt, (hz / hd) * e.speed * 0.45 * dt, 0.48);
    }
    if (e.type === 'raider' && dist < e.attackRange && e.cooldown <= 0) {
      e.cooldown = BALANCE.raider.cooldown;
      hurtPlayer(e.damage, e.mesh.position);
    }
    if (e.type === 'spitter' && dist < e.attackRange && dist > 2 && e.cooldown <= 0) {
      e.cooldown = BALANCE.spitter.cooldown;
      enemyShot(e, dx, dz, dist);
    }
    e.mesh.position.y = Math.sin(gameTime * 4 + e.home.x) * 0.06;
  }
  if (state.quest >= 5 && !boss && !state.bossDefeated && player.position.x > 43 && player.position.z < -18) spawnBoss();
}

function updateBurrower(e, dt, dx, dz, dist) {
  const def = BALANCE.burrower;
  e.phaseT -= dt;
  if (e.bstate === 'under') {
    const chase = dist < 11;
    const tx = chase ? player.position.x : e.home.x;
    const tz = chase ? player.position.z : e.home.z;
    const ddx = tx - e.mesh.position.x;
    const ddz = tz - e.mesh.position.z;
    const dd = Math.hypot(ddx, ddz);
    if (dd > (chase ? 1.4 : 0.5)) moveEntity(e.mesh, (ddx / dd) * def.speed * (chase ? 1 : 0.5) * dt, (ddz / dd) * def.speed * (chase ? 1 : 0.5) * dt, 0.45);
    e.mound.rotation.y += dt * 5;
    e.mound.scale.y = 0.28 + Math.sin(gameTime * 14 + e.id) * 0.04;
    if (chase && dist < 2.4 && e.cooldown <= 0) {
      setBurrowState(e, 'rise');
      sfx('burrow');
    }
  } else if (e.bstate === 'rise') {
    // Telegraph: the mound shakes before the bite, so a dash gets clear.
    e.mound.position.x = Math.sin(gameTime * 55) * 0.08;
    e.mound.scale.y = 0.34 + Math.sin(gameTime * 40) * 0.06;
    if (e.phaseT <= 0) {
      e.mound.position.x = 0;
      setBurrowState(e, 'up');
      e.mesh.rotation.y = Math.atan2(dx, dz);
      sfx('surface');
      popEffect(e.mesh.position, C.sand2, 6, 1.2);
      if (dist < def.attackRange) hurtPlayer(e.damage, e.mesh.position);
      e.cooldown = def.cooldown;
    }
  } else if (e.bstate === 'up') {
    e.body.position.y += (0 - e.body.position.y) * Math.min(1, dt * 14);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    if (dist < def.attackRange && e.cooldown <= 0) {
      e.cooldown = def.cooldown;
      hurtPlayer(e.damage, e.mesh.position);
    }
    if (e.phaseT <= 0) {
      setBurrowState(e, 'dig');
      sfx('burrow');
    }
  } else if (e.bstate === 'dig') {
    e.body.position.y = -1.2 * (1 - Math.max(0, e.phaseT) / 0.45);
    if (e.phaseT <= 0) {
      setBurrowState(e, 'under');
      e.cooldown = 1.1;
    }
  }
}

function bossTouch(e, dist) {
  if (dist < 2.3 && e.cooldown <= 0) {
    e.cooldown = e.phase ? 0.86 : 1.15;
    hurtPlayer(BALANCE.boss.touchDamage, e.mesh.position);
    cameraState.shake = 0.18;
  }
}

function updateBoss(e, dt, dx, dz, dist) {
  e.gustTimer -= dt;
  e.chargeTimer -= dt;
  e.phase = e.hp / e.maxHp < 0.5 ? 1 : 0;
  if (e.phase && !e.enraged) {
    e.enraged = true;
    toast('THE STONE GALE CRACKS · ITS WIND QUICKENS', 2000);
    cameraState.shake = 0.3;
    sfx('boss');
  }
  bossRig.glowMat.emissiveIntensity = 2.3 + (e.windup > 0 ? 2.5 : 0) + (e.phase ? 0.6 : 0);
  if (e.lungeT > 0) {
    e.lungeT -= dt;
    moveEntity(e.mesh, e.lungeDir.x * 20 * dt, e.lungeDir.z * 20 * dt, 1.05);
    bossTouch(e, dist);
  } else if (e.windup > 0) {
    // Wind-up: the Stone Gale shudders and commits to a line the player can step out of.
    e.windup -= dt;
    e.body.position.x = Math.sin(gameTime * 60) * 0.1;
    if (e.windup <= 0) {
      e.body.position.x = 0;
      e.lungeT = 0.36;
      sfx('lunge');
      cameraState.shake = Math.max(cameraState.shake, 0.08);
    }
  } else {
    if (dist > 2.3) {
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      const sp = e.speed * (e.phase ? 1.15 : 1) * dt;
      moveEntity(e.mesh, nx * sp, nz * sp, 1.05);
      e.mesh.rotation.y = Math.atan2(nx, nz);
    } else bossTouch(e, dist);
    if (e.gustTimer <= 0) {
      e.gustTimer = e.phase ? 1.55 : 2.15;
      bossGust(e);
    }
    if (e.chargeTimer <= 0) {
      e.chargeTimer = e.phase ? 3.0 : 4.3;
      e.windup = 0.45;
      e.lungeDir.set(dx, 0, dz);
      if (e.lungeDir.lengthSq() < 1e-4) e.lungeDir.set(0, 0, 1);
      e.lungeDir.normalize();
    }
  }
  e.mesh.rotation.y += dt * 0.35;
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    const pos = p.mesh.position;
    pos.x += p.vx * dt;
    pos.z += p.vz * dt;
    p.mesh.rotation.x += dt * 5;
    p.mesh.rotation.y += dt * 7;
    let remove = p.life <= 0;
    // The whole rune wall answers the charged shot, not only its middle.
    if (p.owner === 'player' && !remove && state.quest === 4 && runeWall.userData.collider.active && Math.abs(pos.x - runeWall.position.x) < 8.9 && Math.abs(pos.z - runeWall.position.z) < 1.35) {
      breakRuneWall();
      remove = true;
    }
    if (p.owner === 'player' && !remove) {
      for (const b of bells) {
        if (Math.hypot(pos.x - b.position.x, pos.z - b.position.z) < 1.5) {
          strikeBell(b);
          remove = true;
          break;
        }
      }
    }
    if (!remove && collides(pos.x, pos.z, p.radius * 0.6)) remove = true;
    if (p.owner === 'player') {
      if (!remove) {
        for (const e of enemies) {
          if (!canBeHit(e)) continue;
          const reach = p.radius + (e === boss ? 1.2 : 0.6);
          const ex = pos.x - e.mesh.position.x;
          const ez = pos.z - e.mesh.position.z;
          if (ex * ex + ez * ez < reach * reach) {
            const d = Math.hypot(p.vx, p.vz) || 1;
            damageEnemy(e, p.damage, p.vx / d, p.vz / d);
            ringPulse(pos, C.wind, 1.6);
            hitStop = Math.max(hitStop, 0.06);
            remove = true;
            break;
          }
        }
      }
    } else if (!remove) {
      const px = pos.x - player.position.x;
      const pz = pos.z - player.position.z;
      const reach = p.radius + 0.48;
      if (px * px + pz * pz < reach * reach) {
        hurtPlayer(p.damage, pos);
        remove = true;
      }
    }
    if (remove) releaseShot(i);
  }
}

function simulate(dt) {
  gameTime += dt;
  if (!state.bossDefeated) state.playTime += dt;
  updatePlayer(dt);
  if (mode !== 'play') return;
  updateEnemies(dt);
  updateProjectiles(dt);
  updateLeaves(dt);
}

// ---------------------------------------------------------------- world animation (runs on the title too)
function updateWorld(dt) {
  windmillBlades.rotation.z += dt * (state.millOn ? 2.25 : 0.08);
  if (objectiveMarker) {
    const target = objectivePosition();
    objectiveMarker.position.set(target.x, 0.05, target.z);
    objectiveMarker.children[1].position.y = 2.5 + Math.sin(realTime * 5) * 0.22;
    objectiveMarker.rotation.y += dt * 0.8;
    objectiveMarker.visible = state.quest < 6 && mode !== 'title';
  }
  for (const s of shrines) {
    const active = s.id === state.checkpoint;
    s.crystal.rotation.y += dt * (active ? 2.4 : 0.6);
    s.crystal.position.y = 2.2 + Math.sin(realTime * 2 + s.position.x) * 0.1;
  }
  for (const b of bells) {
    b.amp *= Math.exp(-dt * 1.6);
    b.swing.rotation.z = Math.sin(realTime * 8 + b.i) * b.amp;
    const left = b.rungUntil - gameTime;
    let glow = 0.25;
    if (state.vaultOpen) glow = 1.8;
    else if (left > 0) {
      glow = 1.1 + 2.2 * Math.min(1, left / (BALANCE.bellWindow * diff().bell));
      if (left < 5) glow *= 0.6 + 0.4 * Math.abs(Math.sin(realTime * 6));
    }
    b.crystalMat.emissiveIntensity = glow;
  }
  if (vault) vault.halo.rotation.z += dt * (state.vaultOpen ? 0.9 : 0.2);
  // Blink after a hit (a dash's brief invulnerability needs no warning, so it does not blink).
  player.visible = !(state.hurtBlink > 0 && Math.floor(realTime * 16) % 2 === 0);
}

function objectivePosition() {
  if (state.quest === 0) return keeper.position;
  if (state.quest === 1) return FIELD_TARGET;
  if (state.quest === 2) return CONSOLE_POS;
  if (state.quest === 3) return coreChest.position;
  if (state.quest === 4) return runeWall.position;
  if (state.quest === 5) return ARENA_POS;
  return player.position;
}

// ---------------------------------------------------------------- camera and sun
const camDesired = new THREE.Vector3();
const lookAhead = new THREE.Vector3();
const _sunC = new THREE.Vector3();
function updateCamera(dt, snap = false) {
  cameraState.targetZoom = Math.max(0.68, Math.min(1.55, cameraState.targetZoom));
  cameraState.zoom += (cameraState.targetZoom - cameraState.zoom) * (snap ? 1 : 1 - Math.pow(0.001, dt));
  const aspect = kit.size.width / kit.size.height;
  const bias = aspect < 0.8 ? 1.18 : 1;
  const offY = 15.5 * cameraState.zoom * bias;
  const offZ = 13 * cameraState.zoom * bias;
  // A little look-ahead toward where the hero is heading.
  const moving = mode === 'play' && Math.hypot(fi.mx, fi.mz) > 0.1;
  const f = player.userData.facing;
  const ax = moving ? f.x * 1.4 : 0;
  const az = moving ? f.z * 1.1 : 0;
  const lk = snap ? 1 : 1 - Math.pow(0.05, dt);
  lookAhead.x += (ax - lookAhead.x) * lk;
  lookAhead.z += (az - lookAhead.z) * lk;
  let cx = player.position.x;
  let cz = player.position.z;
  if (mode === 'title') {
    // The title screen drifts slowly over the village.
    cx += Math.sin(realTime * 0.12) * 3.5;
    cz += Math.cos(realTime * 0.09) * 1.5;
  }
  camDesired.set(cx + lookAhead.x, offY, cz + offZ + lookAhead.z);
  if (snap) camera.position.copy(camDesired);
  else camera.position.lerp(camDesired, 1 - Math.pow(0.00008, dt));
  if (cameraState.shake > 0) {
    cameraState.shake = Math.max(0, cameraState.shake - dt * 1.8);
    camera.position.x += (Math.random() - 0.5) * cameraState.shake;
    camera.position.z += (Math.random() - 0.5) * cameraState.shake;
  }
  camera.lookAt(cx + lookAhead.x, 0, cz - 2.0 + lookAhead.z);
}
function updateSun() {
  // Follow the hero, snapped to whole shadow texels so edges do not crawl as the light moves.
  const texel = (SHADOW_EXTENT * 2) / sun.shadow.mapSize.x;
  _sunC.set(player.position.x + lookAhead.x, 0, player.position.z - 4);
  const a = Math.round(_sunC.dot(SUN_X) / texel) * texel;
  const b = Math.round(_sunC.dot(SUN_Y) / texel) * texel;
  const c = _sunC.dot(SUN_DIR);
  _sunC.copy(SUN_X).multiplyScalar(a).addScaledVector(SUN_Y, b).addScaledVector(SUN_DIR, c);
  sun.target.position.copy(_sunC);
  sun.position.copy(_sunC).addScaledVector(SUN_DIR, 45);
}

// ---------------------------------------------------------------- run flow, save, records
const SAVE_FIELDS = ['quest', 'sparks', 'xp', 'swordTier', 'armorTier', 'kills', 'coreClaimed', 'millOn', 'runeBroken', 'bossDefeated', 'hollowFound', 'bellsEver', 'vaultOpen', 'ringClaimed', 'checkpoint', 'playTime', 'runDifficulty', 'completed'];
function saveGame() {
  if (mode === 'title') return;
  const out = { v: 1 };
  for (const k of SAVE_FIELDS) out[k] = state[k];
  store.write(SAVE_KEY, out);
}
function readSave() {
  const s = store.read(SAVE_KEY);
  if (!s || s.v !== 1) return null;
  return s;
}
function applySave(s) {
  const f = freshState();
  const num = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : d);
  const bool = (v) => v === true;
  f.quest = Math.round(num(s.quest, 0, 6, 0));
  f.sparks = Math.round(num(s.sparks, 0, 3, 0));
  f.xp = Math.round(num(s.xp, 0, 99999, 0));
  f.kills = Math.round(num(s.kills, 0, 1e6, 0));
  f.playTime = num(s.playTime, 0, 1e7, 0);
  f.armorTier = s.armorTier ? 1 : 0;
  f.millOn = bool(s.millOn) || f.quest >= 3;
  f.coreClaimed = bool(s.coreClaimed) || f.quest >= 4;
  f.runeBroken = bool(s.runeBroken) || f.quest >= 5;
  f.bossDefeated = bool(s.bossDefeated) || f.quest >= 6;
  f.swordTier = f.coreClaimed ? 2 : 1;
  f.hollowFound = bool(s.hollowFound);
  f.bellsEver = [0, 1, 2].map((i) => !!(Array.isArray(s.bellsEver) && s.bellsEver[i]));
  f.vaultOpen = bool(s.vaultOpen);
  f.ringClaimed = bool(s.ringClaimed) && f.vaultOpen;
  f.completed = bool(s.completed) || f.bossDefeated;
  f.runDifficulty = DIFFICULTY[s.runDifficulty] ? s.runDifficulty : prefs.difficulty;
  f.checkpoint = shrines.some((sh) => sh.id === s.checkpoint) ? s.checkpoint : 'village';
  if (f.checkpoint === 'grotto' && !f.millOn) f.checkpoint = 'mill';
  f.level = levelFromXp(f.xp);
  f.maxHp = maxHpFor(f.level);
  f.hp = f.maxHp;
  Object.assign(state, f);
}

function applyProgress() {
  // Put every changeable piece of the world in the state the save describes.
  clearShots();
  clearLeaves();
  for (const p of bursts) {
    p.mesh.visible = false;
    burstPool.push(p);
  }
  bursts.length = 0;
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.type === 'pickup' || e.type === 'pulse') {
      e.obj.visible = false;
      (e.type === 'pickup' ? sparkPool : pulsePool).push(e.obj);
      effects.splice(i, 1);
    }
  }
  restoreObject(caveSeal);
  caveSeal.visible = !state.millOn;
  caveSeal.userData.collider.active = !state.millOn;
  restoreObject(runeWall);
  runeWall.visible = !state.runeBroken;
  runeWall.userData.collider.active = !state.runeBroken;
  for (const r of runeWall.userData.runes) {
    restoreObject(r);
    r.visible = !state.runeBroken;
  }
  restoreObject(vault.seal);
  vault.seal.visible = !state.vaultOpen;
  vault.sealCollider.active = !state.vaultOpen;
  setChestOpen(coreChest, state.coreClaimed);
  setChestOpen(armorChest, state.armorTier > 0);
  setChestOpen(vault.chest, state.ringClaimed);
  for (const b of bells) {
    b.rungUntil = 0;
    b.amp = 0;
  }
  despawnBoss();
  for (const e of enemies) reviveEnemy(e);
  hitStop = 0;
  runeHintAt = 0;
  fi.attackPressed = false;
  fi.interact = false;
  fi.dashBuffer = 0;
  lastObjective = '';
  lastSide = null;
  updateObjective();
  updateHud();
}

function placeHero(pos) {
  player.position.set(pos.x, 0, pos.z);
  player.rotation.set(0, Math.PI, 0);
  player.userData.facing.set(0, 0, -1);
  player.userData.attackAnim = 0;
  player.visible = true;
  lookAhead.set(0, 0, 0);
  updateCamera(0, true);
  dirty = true;
}

function beginPlay(message) {
  unlockAudio();
  showScreen('play');
  setAmbience(0.6);
  layoutTouchTop();
  updateSideText(true);
  if (message) toast(message, 2400);
}

function newGame() {
  Object.assign(state, freshState());
  state.runDifficulty = prefs.difficulty;
  gameTime = 0;
  applyProgress();
  placeHero(START_POS);
  mode = 'play';
  saveGame();
  beginPlay('FOLLOW THE WIND MARKER TO GALE MILL');
}

function continueGame() {
  const s = readSave();
  if (!s) return newGame();
  applySave(s);
  // A run continued on an easier setting records on that setting.
  if (DIFFICULTY_ORDER.indexOf(prefs.difficulty) < DIFFICULTY_ORDER.indexOf(state.runDifficulty)) state.runDifficulty = prefs.difficulty;
  gameTime = 0;
  applyProgress();
  const shrine = shrineById(state.checkpoint);
  placeHero(shrine.spawn);
  mode = 'play';
  beginPlay(`WELCOME BACK · ${shrine.name.toUpperCase()}`);
}

function respawn() {
  const shrine = shrineById(state.checkpoint);
  // Progress, items and experience stay. The fight resets: foes return to their posts, a live boss sleeps again.
  clearShots();
  clearLeaves();
  despawnBoss();
  for (const e of enemies) if (!e.dead) reviveEnemy(e);
  state.hp = state.maxHp;
  state.invuln = 1.4;
  state.hurtBlink = 1.4;
  state.attackHeld = false;
  state.buffered = null;
  state.dashTimer = 0;
  state.kbT = 0;
  player.rotation.z = 0;
  placeHero(shrine.spawn);
  updateHud();
  mode = 'play';
  beginPlay(`RETURNED TO THE ${shrine.name.toUpperCase()}`);
  saveGame();
}

function die() {
  state.hp = 0;
  updateHud();
  mode = 'dying';
  modeTimer = 0.9;
  state.attackHeld = false;
  sfx('break');
  input.rumble(0.7, 320);
  showScreen('dying');
}

function formatTime(secs) {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function readRecords() {
  const r = store.read(RECORDS_KEY);
  return r && typeof r === 'object' ? r : {};
}

function completeRun() {
  mode = 'victory';
  modeTimer = 1.6;
  const secs = Math.max(1, state.playTime);
  const firstClear = !state.completed;
  state.completed = true;
  const records = readRecords();
  const key = state.runDifficulty;
  const rec = records[key] && typeof records[key] === 'object' ? records[key] : { best: 0, clears: 0 };
  let newBest = false;
  if (firstClear) {
    rec.clears = (rec.clears || 0) + 1;
    if (!rec.best || secs < rec.best) {
      rec.best = secs;
      newBest = true;
    }
    records[key] = rec;
    store.write(RECORDS_KEY, records);
  }
  ui.endSummary.textContent = `Clear time ${formatTime(secs)} · Level ${state.level} · ${state.kills} foes · ${gearLabel()}.`;
  const clears = rec.clears || 1;
  ui.endRecord.textContent = `${DIFFICULTY[key].label} · ${newBest ? 'NEW BEST TIME' : `BEST ${formatTime(rec.best || secs)}`} · ${clears} CLEAR${clears === 1 ? '' : 'S'}${state.ringClaimed ? '' : ' · THE HOLLOW STILL HIDES A PRIZE'}`;
  saveGame();
  showScreen('victory');
}

// ---------------------------------------------------------------- menus
const screens = { title: ui.start, pause: ui.pause, end: ui.end, death: ui.death };
let menuFocus = 0;
let navDir = 0;
let navRepeatAt = 0;
let menuList = [];

// The visible buttons of the open screen, gathered when it opens (not every frame).
function refreshMenuList() {
  const el = screens[mode];
  menuList = el ? [...el.querySelectorAll('button')].filter((b) => !b.classList.contains('hidden') && b.offsetParent !== null) : [];
  if (menuFocus >= menuList.length) menuFocus = 0;
}
function paintFocus(list = menuList) {
  const show = input.source !== 'touch';
  list.forEach((b, j) => b.classList.toggle('is-focus', show && j === menuFocus));
}
function setFocus(i, list = menuList) {
  if (!list.length) return;
  menuFocus = ((i % list.length) + list.length) % list.length;
  paintFocus(list);
  try {
    list[menuFocus].focus({ preventScroll: true });
  } catch {
    /* ignore */
  }
}
for (const el of Object.values(screens)) {
  el.addEventListener('focusin', (e) => {
    const i = menuList.indexOf(e.target);
    if (i >= 0 && i !== menuFocus) {
      menuFocus = i;
      paintFocus();
    }
  });
}

function showScreen(name) {
  mode = name;
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
  const menu = !!screens[name];
  kit.touch?.suspend(name !== 'play', 'screen');
  ui.hud.classList.toggle('hidden', name === 'title' || name === 'end' || name === 'death');
  refreshMenuList();
  if (menu) {
    navDir = 0;
    setFocus(0);
  } else if (document.activeElement && document.activeElement !== document.body) {
    document.activeElement.blur();
  }
  if (name !== 'play') {
    ui.prompt.classList.remove('show');
    lastPrompt = '';
  }
  input.settle();
  setAmbience(name === 'play' ? (player.position.z < -12.5 ? 0.85 : 0.6) : name === 'pause' ? 0.15 : 0.35);
  dirty = true;
}

function menuInput() {
  const list = menuList;
  if (!list.length) return;
  const mv = input.vector('move');
  const dir = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : 0;
  if (dir && (dir !== navDir || realTime >= navRepeatAt)) {
    setFocus(menuFocus + dir, list);
    navRepeatAt = realTime + (dir !== navDir ? 0.36 : 0.14);
    sfx('menu');
  }
  navDir = dir;
  if (input.pressed('confirm') || input.pressed('attack')) {
    list[menuFocus]?.click();
    return;
  }
  if (mode === 'pause' && (input.pressed('pause') || input.pressed('back'))) resumeGame();
}

const HELP = {
  keyboard: [['Move', 'WASD / Arrows'], ['Blade', 'Space · J · Click — hold to charge (Wind Core)'], ['Dash', 'Shift · K · Right-click'], ['Act', 'E'], ['Zoom', 'Wheel · + / −'], ['Pause', 'Esc · P']],
  gamepad: [['Move', 'Left stick / D-pad'], ['Blade', 'A · X · RT — hold to charge (Wind Core)'], ['Dash', 'B · LT'], ['Act', 'Y'], ['Zoom', 'LB / RB'], ['Pause', 'Start']],
  touch: [['Move', 'Left thumb'], ['Blade', 'BLADE — hold to charge (Wind Core)'], ['Dash', 'DASH'], ['Act', 'ACT (shows when near)'], ['Zoom', 'Pinch'], ['Pause', 'II']],
};
const helpFor = () => HELP[input.source] || HELP.keyboard;
function refreshHelp() {
  ui.startHelp.textContent = helpFor().map(([a, b]) => `${a}: ${b}`).join(' · ');
  ui.pauseHelp.textContent = '';
  for (const [a, b] of helpFor()) {
    const li = document.createElement('li');
    const k = document.createElement('b');
    k.textContent = a;
    const v = document.createElement('span');
    v.textContent = b;
    li.append(k, v);
    ui.pauseHelp.append(li);
  }
}

function refreshTitle() {
  const save = readSave();
  const resumable = !!save;
  ui.continueBtn.classList.toggle('hidden', !resumable);
  if (resumable) {
    const q = Math.round(Number(save.quest) || 0);
    ui.continueBtn.textContent = q >= 6 ? 'CONTINUE · EXPLORE THE RIDGE' : `CONTINUE · ${formatTime(Number(save.playTime) || 0)}`;
  }
  ui.startBtn.textContent = resumable ? 'NEW PATH' : 'BEGIN PATH';
  ui.startBtn.classList.toggle('ghost-btn', resumable);
  ui.startBtn.classList.toggle('primary-btn', !resumable);
  ui.difficultyBtn.textContent = `DIFFICULTY · ${diff().label}`;
  const rec = readRecords()[prefs.difficulty];
  ui.startRecord.classList.toggle('hidden', !(rec && rec.best));
  if (rec && rec.best) {
    const n = rec.clears || 1;
    ui.startRecord.textContent = `${diff().label} · BEST CLEAR ${formatTime(rec.best)} · ${n} CLEAR${n === 1 ? '' : 'S'}`;
  }
  refreshHelp();
  if (mode === 'title') refreshMenuList();
}

function openPause() {
  if (mode !== 'play') return;
  state.attackHeld = false;
  ui.pauseStatus.textContent = `${objectiveText()} · ${formatTime(state.playTime)} · LV ${state.level} · ${diff().label}`;
  ui.pauseInfo.textContent = `${kit.backendLabel} · three.js r${THREE.REVISION} · ${kit.tier.name} quality`;
  refreshHelp();
  showScreen('pause');
}
function resumeGame() {
  if (mode !== 'pause') return;
  unlockAudio();
  showScreen('play');
  layoutTouchTop();
}
function goTitle() {
  saveGame();
  showScreen('title');
  refreshTitle();
  setFocus(0);
}

ui.startBtn.addEventListener('click', () => {
  unlockAudio();
  newGame();
});
ui.continueBtn.addEventListener('click', () => {
  unlockAudio();
  continueGame();
});
ui.difficultyBtn.addEventListener('click', () => {
  const i = DIFFICULTY_ORDER.indexOf(prefs.difficulty);
  prefs.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
  store.write(PREFS_KEY, prefs);
  refreshTitle();
  sfx('menu');
});
ui.titleSettingsBtn.addEventListener('click', () => kit.menu.open());
ui.settingsBtn.addEventListener('click', () => kit.menu.open());
ui.resumeBtn.addEventListener('click', resumeGame);
ui.quitBtn.addEventListener('click', goTitle);
ui.pauseBtn.addEventListener('click', openPause);
ui.retryBtn.addEventListener('click', respawn);
ui.deathTitleBtn.addEventListener('click', goTitle);
ui.exploreBtn.addEventListener('click', () => {
  beginPlay(state.ringClaimed ? 'THE RIDGE IS YOURS TO WANDER' : 'THE RIDGE IS YOURS · THE HOLLOW STILL HUMS TO THE NORTH');
});
ui.restartBtn.addEventListener('click', newGame);
ui.endTitleBtn.addEventListener('click', goTitle);

// Audio starts on the first gesture of any kind; pause audio with the kit's settings panel and hidden tabs.
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });
kit.onPause((p) => suspendAudio(p || document.hidden));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'play') openPause();
    saveGame();
    suspendAudio(true);
  } else if (!kit.paused) suspendAudio(false);
});
input.onSourceChange(() => {
  refreshHelp();
  lastObjective = '';
  updateObjective();
  lastPrompt = '';
  if (screens[mode]) paintFocus();
});
kit.onResize(() => {
  dirty = true;
  layoutTouchTop();
});

// ---------------------------------------------------------------- build, warm up, run
createWorld();
updateObjective();
updateHud();
placeHero(START_POS);

const post = createPost(kit, scene, camera, { bloom: { strength: 0.22, radius: 0.18, threshold: 1.15 } });
// Resize the shadow map a few frames after a quality change (createPost rebuilds its chain first).
let shadowWait = 0;
kit.onQuality(() => {
  shadowWait = 3;
  dirty = true;
  applyGrassDetail();
});

kit.loading.progress(0.85, 'Warming up the wind…');
{
  // Compile what only appears later (shots, sparks, leaves, pulses, the boss) in view of the
  // first camera, so the first swing, hit or boss entrance does not stutter on shader builds.
  const warm = [];
  const at = (m) => {
    m.visible = true;
    m.position.set(player.position.x + (warm.length % 7) - 3, 1, player.position.z - 3 - Math.floor(warm.length / 7));
    warm.push(m);
  };
  for (const kind of Object.keys(SHOT)) {
    const m = acquireShot(kind);
    at(m);
    shotPool[kind].push(m);
  }
  for (const c of BURST_COLORS) {
    const m = new THREE.Mesh(geo('tetra', () => new THREE.TetrahedronGeometry(0.11, 0)), burstMat(c));
    m.castShadow = false;
    m.receiveShadow = false;
    scene.add(m);
    at(m);
    burstPool.push({ mesh: m, vx: 0, vy: 0, vz: 0, t: 0, life: 0.45 });
  }
  ringPulse(player.position, C.wind);
  ringPulse(player.position, C.tempest);
  popPickup(player.position);
  dropLeaf(player.position);
  for (const e of effects) {
    at(e.obj);
    (e.type === 'pickup' ? sparkPool : pulsePool).push(e.obj);
  }
  effects.length = 0;
  for (const l of leaves) {
    at(l.mesh);
    leafPool.push(l.mesh);
  }
  leaves.length = 0;
  at(bossRig.group);
  bossRig.group.position.y = 0;
  try {
    const sp = post.scenePass;
    if (Number.isFinite(renderer.samples)) sp.renderTarget.samples = renderer.samples;
    await sp.compileAsync(renderer);
  } catch (err) {
    console.warn('compileAsync:', err);
  }
  for (const m of warm) m.visible = false;
}

showScreen('title');
refreshTitle();
setFocus(0);

const STEP = 1 / 60;
let acc = 0;
let lastPR = 0;
kit.start((dt) => {
  realTime += dt;
  if (mode === 'play') {
    if (input.pressed('pause')) openPause();
    else {
      readInput();
      const z = input.zoom();
      if (z) cameraState.targetZoom -= z * 0.08;
      const pad = (input.down('zoomOut') ? 1 : 0) - (input.down('zoomIn') ? 1 : 0);
      if (pad) cameraState.targetZoom += pad * dt * 0.9;
      if (hitStop > 0) hitStop = Math.max(0, hitStop - dt);
      else {
        acc += dt;
        let loops = 0;
        while (acc >= STEP && loops < 6 && mode === 'play') {
          simulate(STEP);
          acc -= STEP;
          loops++;
        }
        if (loops >= 6 || mode !== 'play') acc = 0;
      }
      updatePrompt();
      updateSideText();
      if (mode === 'play') setAmbience(player.position.z < -12.5 ? 0.85 : 0.6);
    }
  } else if (mode === 'dying' || mode === 'victory') {
    modeTimer -= dt;
    if (mode === 'dying') player.rotation.z = Math.min(1.35, player.rotation.z + dt * 3);
    if (modeTimer <= 0) {
      if (mode === 'dying') {
        ui.deathTitle.textContent = `RETURN TO THE ${shrineById(state.checkpoint).name.toUpperCase()}`;
        showScreen('death');
      } else showScreen('end');
    }
  } else if (screens[mode]) {
    menuInput();
  }
  const live = mode === 'play' || mode === 'dying' || mode === 'victory' || mode === 'title';
  if (live) {
    updateWorld(dt);
    updateEffects(dt);
    updateBursts(dt);
  }
  updateCamera(dt);
  updateSun();
  if (shadowWait > 0 && --shadowWait === 0) {
    sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
    dirty = true;
  }
  const pr = renderer.getPixelRatio();
  if (pr !== lastPR) {
    lastPR = pr;
    dirty = true;
  }
  // Pause, death and results screens hold a still frame: draw only when something changed.
  if (live || dirty) {
    post.render();
    dirty = false;
  }
});
// Test/debug surface. It is intentionally small and does not change normal play.
window.__AETHERFALL__ = {
  getState: () => ({ ...state, mode, backend: kit.backend }),
  teleport: (x, z) => player?.position.set(x, 0, z),
  damageBoss: (n = 50) => boss && damageEnemy(boss, n),
};
