/**
 * Obsidian Expanse — a survey probe on a streamed frontier.
 *
 * Runs on the shared kit: three.js r186 (WebGPU with a WebGL2 fallback)
 * through kit/boot.js, every control through kit.input actions (keyboard and
 * mouse, gamepad, touch), bloom through kit/post.js and sized particles
 * through kit/points.js. Movement and collision stay hand-written (a height
 * field plus simple circle and box colliders), as in the original.
 *
 * Directive 01 (the original game): synchronise the three signal spires,
 * open and enter the Null Vault. Directive 02 (added): fabricate relay kits
 * from harvested material and raise relays at five frontier survey sites.
 * After that the frontier stays open: log settlements and regions.
 */

import * as THREE from 'three/webgpu';
import { color, sin, time, uv, float, smoothstep } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { fixedStep } from 'kit/physics.js';
import {
  World,
  CHUNK,
  BEACONS,
  RELAY_SITES,
  SENTINELS,
  SETTLEMENTS,
  BIOME_LABELS,
  ITEMS,
  heightAt,
  biomeAt,
  chunkIndex,
  clampToWorld,
  nearestSettlement,
  headingLabel,
  formatDistance,
  rng,
  hash2,
  sanitizeInventory,
  canAdd,
  pushCircle,
} from './world.js';
import { Sound } from './audio.js';
import { createUI, promptFor, clock } from './ui.js';

/* ------------------------------------------------------------- constants */

const SAVE_KEY = 'obsidian-expanse-save-v3';
const BEST_KEY = 'obsidian-expanse-best-v1';
const LEGACY_INVENTORY = 'obsidian-expanse-inventory-v2';
const LEGACY_DEPLETED = 'obsidian-expanse-depleted-v2';
const START = Object.freeze({ x: 0, z: 134 });
const PLAYER_RADIUS = 0.45;

const MOVE = {
  walkSpeed: 10.5,
  sprintSpeed: 18,
  crouchSpeed: 4.2,
  acceleration: 38,
  deceleration: 48,
  gravity: 21,
  jumpImpulse: 7.6,
  standingEyeHeight: 1.82,
  crouchedEyeHeight: 1.12,
  eyeResponse: 13,
};

const RECIPES = [
  { id: 'kit', name: 'RELAY KIT', desc: 'A deployable uplink for one frontier survey site.', cost: { 'crystal-shard': 2, stone: 3, timber: 2, fiber: 1 }, max: RELAY_SITES.length },
  { id: 'capacitor', name: 'CAPACITOR CELL', desc: '+25 probe energy for sprinting and the extraction beam.', cost: { 'crystal-shard': 3, stone: 5 }, max: 2 },
  { id: 'emitter', name: 'FOCUSED EMITTER', desc: 'The beam extracts a third faster and drains 30% less energy.', cost: { 'crystal-shard': 3, timber: 4, fiber: 2 }, max: 1 },
  { id: 'scanner', name: 'DEEP SCANNER', desc: 'Scans recharge faster and mark the nearest resource signatures.', cost: { 'crystal-shard': 4, stone: 2, fiber: 3 }, max: 1 },
];

const ITEM_COLORS = { 'crystal-shard': 0x78e9ff, stone: 0xff9366, timber: 0x7ee0a8, fiber: 0xe8e08a };
const NODE_LABELS = { rock: 'MINERAL OUTCROP', tree: 'GLASSWOOD GROWTH', reed: 'FIBER REEDS', pickup: 'LOOSE CRYSTAL SHARD' };
const NODE_ACTIONS = { rock: 'EXTRACT', tree: 'CUT', reed: 'GATHER', pickup: 'COLLECT' };
const DONE_WORDS = { rock: 'EXTRACTION COMPLETE', tree: 'CUT COMPLETE', reed: 'GATHERED', pickup: 'COLLECTED' };

/* --------------------------------------------------------------- storage */

const storage = (() => {
  try {
    const s = window.localStorage;
    s.setItem('__oe__', '1');
    s.removeItem('__oe__');
    return s;
  } catch {
    return null;
  }
})();
const readJSON = (key) => {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJSON = (key, value) => {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: progress lasts for this visit */
  }
};
const readSession = (key) => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

function freshState() {
  return {
    v: 3,
    x: START.x,
    z: START.z,
    yaw: 0,
    pitch: -0.055,
    energy: 100,
    inventory: sanitizeInventory(),
    depleted: [],
    active: [],
    vaultEntered: false,
    relays: [],
    kits: 0,
    upgrades: { capacitor: 0, emitter: 0, scanner: 0 },
    settlements: [],
    biomes: [],
    stats: { time: 0, distance: 0, scans: 0, harvested: 0, collected: 0 },
    basinTime: null,
    chartTime: null,
  };
}

function loadState() {
  const raw = readJSON(SAVE_KEY);
  if (!raw || raw.v !== 3) return null;
  const s = freshState();
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  s.x = num(raw.x, START.x);
  s.z = num(raw.z, START.z);
  s.yaw = num(raw.yaw, 0);
  s.pitch = Math.max(-1.45, Math.min(1.42, num(raw.pitch, -0.055)));
  s.energy = Math.max(0, num(raw.energy, 100));
  s.inventory = sanitizeInventory(raw.inventory);
  s.depleted = list(raw.depleted);
  s.active = list(raw.active).filter((id) => BEACONS.some((b) => b.id === id));
  s.vaultEntered = !!raw.vaultEntered && s.active.length === BEACONS.length;
  s.relays = list(raw.relays).filter((id) => RELAY_SITES.some((r) => r.id === id));
  s.kits = Math.max(0, Math.floor(num(raw.kits, 0)));
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = Math.max(0, Math.floor(num(raw.upgrades?.[k], 0)));
  s.settlements = list(raw.settlements);
  s.biomes = list(raw.biomes);
  for (const k of Object.keys(s.stats)) s.stats[k] = Math.max(0, num(raw.stats?.[k], 0));
  s.basinTime = raw.basinTime == null ? null : num(raw.basinTime, null);
  s.chartTime = raw.chartTime == null ? null : num(raw.chartTime, null);
  return s;
}

let state = loadState();
let hasSave = !!state;
if (!state) {
  // Carry over a survey from the previous build's session storage, if this tab has one.
  state = freshState();
  try {
    state.inventory = sanitizeInventory(JSON.parse(readSession(LEGACY_INVENTORY) || '{}'));
    const old = JSON.parse(readSession(LEGACY_DEPLETED) || '[]');
    if (Array.isArray(old)) state.depleted = old.filter((x) => typeof x === 'string');
  } catch {
    /* nothing to carry */
  }
}
const best = readJSON(BEST_KEY) || {};

/* ------------------------------------------------------------------ boot */

const ui = createUI({ action: onAction, fabricate: onFabricate });
let ready = false;

const kit = await boot({
  title: 'Obsidian Expanse',
  canvas: document.getElementById('game-canvas'),
  mount: document.getElementById('shell'),
  gear: 'none',
  accent: '#78e9ff',
  background: '#03060a',
  touch: { top: 'right', topOffset: 58, hint: false },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
    beam: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'Beam' },
    interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
    scan: { keys: ['KeyQ'], gamepad: ['Y'], touch: 'Scan' },
    sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'], touch: 'Sprint' },
    crouch: { keys: ['ControlLeft', 'ControlRight', 'KeyC'], gamepad: ['B'], touch: { label: 'Crouch', slot: 'top' } },
    fab: { keys: ['KeyF'], gamepad: ['Back'] },
    confirm: { keys: ['Enter', 'NumpadEnter'] },
    back: { gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  },
});
const { input } = kit;
const renderer = kit.renderer;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.23;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
kit.touch?.suspend(true, 'game');
kit.loading.progress(0.65, 'Streaming world cells…');

const sound = new Sound();
// Silence the probe while the kit's settings panel pauses the loop or the tab is hidden
// (the drone and wind would otherwise keep playing in a background tab).
const audioHold = { kit: false, hidden: false };
const syncAudio = () => sound.setSuspended(audioHold.kit || audioHold.hidden);
kit.onPause((paused) => {
  audioHold.kit = paused;
  syncAudio();
});
document.addEventListener('visibilitychange', () => {
  audioHold.hidden = document.hidden;
  syncAudio();
});
const unlockAudio = () => sound.unlock();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
addEventListener('touchend', unlockAudio, true);

/* ----------------------------------------------------------------- scene */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050a);
scene.fog = new THREE.FogExp2(0x070b13, 0.0064);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(67, 1, 0.08, 5000));
camera.rotation.order = 'YXZ';
scene.add(camera);

scene.add(new THREE.HemisphereLight(0x678bc2, 0x100b16, 1.7));
const sun = new THREE.DirectionalLight(0xb8d7ff, 3.6);
sun.position.set(-72, 118, 44);
sun.castShadow = true;
// Sized once at load, not on every quality change: this shadow renders on demand
// (autoUpdate off), and in r186 resizing such a map leaves the scene sampling the
// destroyed old texture on WebGPU. A new quality's shadow size applies on the next load.
sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 390 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.00035;
// The key light only re-renders its shadow when the streamed cells change.
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
scene.add(sun, sun.target);

const softDot = () => float(1).sub(smoothstep(0.18, 0.5, uv().sub(0.5).length()));

// Sky dome, stars and the eclipsed moon ride along with the camera.
const skyAnchor = new THREE.Group();
scene.add(skyAnchor);
{
  const geo = new THREE.SphereGeometry(720, 32, 20);
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const top = new THREE.Color(0x02030a);
  const horizon = new THREE.Color(0x291733);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k += 1) {
    const m = THREE.MathUtils.clamp((p.getY(k) / 720 + 0.15) / 0.95, 0, 1);
    c.copy(horizon).lerp(top, m);
    cols[k * 3] = c.r;
    cols[k * 3 + 1] = c.g;
    cols[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  dome.name = 'POLARIZED_SKY';
  dome.renderOrder = -2;
  skyAnchor.add(dome);

  const r = rng(1197888);
  const count = 2600;
  const pos = new Float32Array(count * 3);
  for (let k = 0; k < count; k += 1) {
    const m = 590 + r() * 70;
    const b = r() * Math.PI * 2;
    const y = Math.acos(THREE.MathUtils.lerp(0.08, 0.95, r()));
    pos[k * 3] = Math.sin(y) * Math.cos(b) * m;
    pos[k * 3 + 1] = Math.cos(y) * m;
    pos[k * 3 + 2] = Math.sin(y) * Math.sin(b) * m;
  }
  // Opaque and drawn right after the dome, so the dome never paints over them.
  const stars = createPoints({
    positions: pos,
    size: 1.6,
    sizeAttenuation: false,
    material: { color: new THREE.Color(0xbddaff).multiplyScalar(0.82), fog: false, transparent: false, depthWrite: false },
  });
  stars.object.renderOrder = -1;
  skyAnchor.add(stars.object);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(23, 48, 32), new THREE.MeshBasicMaterial({ color: 0x090912, fog: false }));
  moon.position.set(-250, 245, -520);
  skyAnchor.add(moon);
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(25, 34, 96),
    new THREE.MeshBasicMaterial({ color: 0xb76aff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  halo.position.copy(moon.position);
  halo.lookAt(0, 0, 0);
  skyAnchor.add(halo);
}

/* ------------------------------------------------------------- landmarks */

/** Static colliders as flat [x, z, radius] triples, and walkable platforms. */
const staticCircles = [];
const platforms = [];

const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: 0.86, roughness: 0.22 });
const beaconVisuals = new Map();
{
  const baseGeo = new THREE.CylinderGeometry(5.2, 7.4, 2, 8);
  const columnGeo = new THREE.CylinderGeometry(0.62, 2.2, 17, 5);
  const coreGeo = new THREE.OctahedronGeometry(1.7, 1);
  const beamGeo = new THREE.CylinderGeometry(0.5, 3.8, 112, 24, 1, true);
  const ringGeos = [0, 1, 2].map((k) => new THREE.TorusGeometry(3.2 + k * 1.1, 0.1 + k * 0.035, 8, 72));
  for (const b of BEACONS) {
    const a = heightAt(b.x, b.z);
    const g = new THREE.Group();
    g.position.set(b.x, a, b.z);
    const glow = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 5.5, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, darkMetal);
    base.position.y = 1;
    base.receiveShadow = true;
    base.castShadow = true;
    const column = new THREE.Mesh(columnGeo, darkMetal);
    column.position.y = 10;
    column.castShadow = true;
    const core = new THREE.Mesh(coreGeo, glow);
    core.position.y = 18.3;
    const rings = [];
    for (let k = 0; k < 3; k += 1) {
      const ring = new THREE.Mesh(ringGeos[k], glow);
      ring.position.y = 18.3;
      ring.rotation.set(k * 0.72, 0.3 + k * 0.8, k * 0.38);
      rings.push(ring);
      g.add(ring);
    }
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: b.color, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 72;
    const light = new THREE.PointLight(b.color, 7, 62, 1.5);
    light.position.y = 18;
    g.add(base, column, core, beam, light);
    scene.add(g);
    beaconVisuals.set(b.id, { beam, core, group: g, light, rings });
    staticCircles.push(b.x, b.z, 2.4);
    platforms.push({ x: b.x, z: b.z, top: a + 2, inner: 5.2, outer: 7.4 });
  }
}

const sentinels = [];
{
  const metal = new THREE.MeshStandardMaterial({ color: 0x0b0e16, metalness: 0.78, roughness: 0.29 });
  const pylonGeo = new THREE.CylinderGeometry(1.1, 3.4, 14, 6);
  const eyeGeo = new THREE.SphereGeometry(0.72, 20, 12);
  const ringGeo = new THREE.RingGeometry(7.4, 7.55, 64);
  for (const s of SENTINELS) {
    const y = heightAt(s.x, s.z);
    const g = new THREE.Group();
    g.position.set(s.x, y, s.z);
    const pylon = new THREE.Mesh(pylonGeo, metal);
    pylon.position.y = 7;
    pylon.castShadow = true;
    const eye = new THREE.Mesh(eyeGeo, new THREE.MeshStandardMaterial({ color: s.color, emissive: s.color, emissiveIntensity: 7 }));
    eye.position.set(0, 13.2, 0.6);
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.2;
    g.add(pylon, eye, ring);
    g.name = 'SENTINEL';
    scene.add(g);
    sentinels.push({ ring, phase: hash2(Math.round(s.x), Math.round(s.z)) / 4294967295 });
    staticCircles.push(s.x, s.z, 3.5);
  }
}

{
  const arcMat = new THREE.MeshStandardMaterial({ color: 0x0c121c, metalness: 0.82, roughness: 0.25 });
  const arcGeo = new THREE.TorusGeometry(11, 0.65, 10, 60, Math.PI);
  for (let t = 0; t < 7; t += 1) {
    const s = (t / 7) * Math.PI * 2;
    const r = 125 + (t % 2) * 18;
    const arc = new THREE.Mesh(arcGeo, arcMat);
    arc.position.set(Math.cos(s) * r, heightAt(Math.cos(s) * r, Math.sin(s) * r) + 8, Math.sin(s) * r);
    arc.rotation.set(Math.PI / 2, -s, 0);
    arc.castShadow = true;
    scene.add(arc);
  }
}

// The Null Vault.
const vaultY = heightAt(0, 0);
const vaultRings = [];
let vaultCore;
let vaultColumn;
{
  const g = new THREE.Group();
  g.position.y = vaultY;
  const metal = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.19, metalness: 0.92 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(15, 21, 4, 12), metal);
  base.position.y = 0.6;
  base.receiveShadow = true;
  base.castShadow = true;
  g.add(base);
  for (let o = 0; o < 8; o += 1) {
    const l = (o / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 17 + (o % 2) * 5, 2.4), metal);
    pillar.position.set(Math.cos(l) * 11, 8.5, Math.sin(l) * 11);
    pillar.rotation.y = -l;
    pillar.rotation.z = (o % 2 ? 1 : -1) * 0.17;
    pillar.castShadow = true;
    g.add(pillar);
    staticCircles.push(Math.cos(l) * 11, Math.sin(l) * 11, 1.7);
  }
  const coreMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.12, metalness: 0.2 });
  coreMat.colorNode = color(0x24154c);
  coreMat.emissiveNode = color(0x9d6cff).mul(sin(time.mul(1.7)).mul(0.45).add(1.65));
  vaultCore = new THREE.Mesh(new THREE.IcosahedronGeometry(3.8, 3), coreMat);
  vaultCore.position.y = 15;
  vaultCore.visible = false;
  g.add(vaultCore);
  for (let o = 0; o < 4; o += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7 + o * 1.7, 0.15, 10, 96), coreMat);
    ring.position.y = 15;
    ring.rotation.set(o * 0.62, o * 0.83, o * 0.44);
    vaultRings.push(ring);
    g.add(ring);
  }
  // Raised once the vault has been entered: a violet column visible across the basin.
  vaultColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 7, 420, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9d6cff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
  );
  vaultColumn.position.y = 210;
  vaultColumn.visible = false;
  g.add(vaultColumn);
  scene.add(g);
  platforms.push({ x: 0, z: 0, top: vaultY + 2.6, inner: 15, outer: 21 });
}

// Directive 02 survey sites.
const relays = [];
{
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c131c, metalness: 0.8, roughness: 0.3 });
  const coreDim = new THREE.MeshStandardMaterial({ color: 0x1a2a33, emissive: 0x0d3440, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.4 });
  const coreLit = new THREE.MeshStandardMaterial({ color: 0x81edff, emissive: 0x26bddd, emissiveIntensity: 5.5, roughness: 0.18, metalness: 0.35 });
  const baseGeo = new THREE.CylinderGeometry(3.2, 3.8, 0.6, 10);
  const pylonGeo = new THREE.CylinderGeometry(0.35, 0.9, 7, 6);
  const coreGeo = new THREE.OctahedronGeometry(0.8, 0);
  const ringGeo = new THREE.RingGeometry(4.6, 4.75, 48);
  const beamGeo = new THREE.CylinderGeometry(0.35, 2.4, 160, 16, 1, true);
  RELAY_SITES.forEach((site, i) => {
    const y = heightAt(site.x, site.z);
    const g = new THREE.Group();
    g.position.set(site.x, y, site.z);
    g.name = `RELAY_${site.id.toUpperCase()}`;
    const base = new THREE.Mesh(baseGeo, metal);
    base.position.y = 0.3;
    base.receiveShadow = true;
    const pylon = new THREE.Mesh(pylonGeo, metal);
    pylon.position.y = 4.1;
    pylon.castShadow = true;
    const core = new THREE.Mesh(coreGeo, coreDim);
    core.position.y = 8.4;
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0x78e9ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.72;
    ring.visible = false;
    const beam = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: 0x78e9ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    beam.position.y = 80;
    beam.visible = false;
    g.add(base, pylon, core, ring, beam);
    scene.add(g);
    relays.push({ site, group: g, core, ring, beam, coreDim, coreLit, phase: i * 1.3, status: '' });
    staticCircles.push(site.x, site.z, 1.0);
    platforms.push({ x: site.x, z: site.z, top: y + 0.6, inner: 3.2, outer: 3.8 });
  });
}

/* --------------------------------------------------------------- effects */

const scanRing = new THREE.Mesh(
  new THREE.RingGeometry(0.96, 1, 128),
  new THREE.MeshBasicMaterial({ color: 0x6be8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
);
scanRing.rotation.x = -Math.PI / 2;
scanRing.visible = false;
scene.add(scanRing);

// The extraction beam: a tapered additive ray from the probe to what it is cutting.
const BEAM_START = new THREE.Vector3(0.14, -0.14, -0.3);
const beamMat = new THREE.MeshBasicMaterial({ color: 0x8ff5ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false });
const beamGeo = new THREE.CylinderGeometry(0.05, 0.0025, 1, 6, 1, true);
const beam = new THREE.Mesh(beamGeo, beamMat);
beam.visible = false;
beam.renderOrder = 999;
beam.frustumCulled = false;
camera.add(beam);

const DUST_MAX = 6200;
const dust = (() => {
  const r = rng(11884811);
  const pos = new Float32Array(DUST_MAX * 3);
  const col = new Float32Array(DUST_MAX * 3);
  const c = new THREE.Color();
  for (let k = 0; k < DUST_MAX; k += 1) {
    const a = 12 + r() * 185;
    const o = r() * Math.PI * 2;
    pos[k * 3] = Math.cos(o) * a;
    pos[k * 3 + 1] = 0.8 + r() * 42;
    pos[k * 3 + 2] = Math.sin(o) * a;
    c.setHSL(0.5 + r() * 0.22, 0.55, 0.52 + r() * 0.24);
    col[k * 3] = c.r;
    col[k * 3 + 1] = c.g;
    col[k * 3 + 2] = c.b;
  }
  const pts = createPoints({
    positions: pos,
    colors: col,
    size: 0.13,
    sizeAttenuation: true,
    material: { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false },
  });
  pts.material.opacityNode = softDot().mul(0.58);
  scene.add(pts.object);
  return pts;
})();

const SPARK_MAX = 120;
const spark = {
  pos: new Float32Array(SPARK_MAX * 3),
  vel: new Float32Array(SPARK_MAX * 3),
  life: new Float32Array(SPARK_MAX),
  max: new Float32Array(SPARK_MAX),
  base: new Float32Array(SPARK_MAX * 3),
  alive: 0,
  shown: 0,
};
const sparks = createPoints({
  positions: new Float32Array(SPARK_MAX * 3),
  colors: new Float32Array(SPARK_MAX * 3),
  size: 0.09,
  sizeAttenuation: true,
  material: { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false },
});
sparks.material.opacityNode = softDot();
sparks.setCount(0);
scene.add(sparks.object);

// Deep-scanner markers over resource nodes.
const markers = [];
{
  const geo = new THREE.CylinderGeometry(0.12, 0.7, 34, 10, 1, true);
  for (let k = 0; k < 5; k += 1) {
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x78e9ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false })
    );
    mesh.visible = false;
    scene.add(mesh);
    markers.push({ mesh, life: 0 });
  }
}

/* ----------------------------------------------------------------- world */

const world = new World(scene, new Set(state.depleted));

/** Full-detail cells out to 2 rings on high and ultra (1 below), plus a low-detail horizon ring. */
function applyTier() {
  const tier = kit.tier;
  const fullRings = tier.drawDistance >= 1 ? 2 : 1;
  world.setRadius(fullRings, fullRings + (tier.drawDistance > 1 ? 2 : 1));
  dust.setCount(kit.detail(2400));
}
kit.onQuality(() => {
  applyTier();
  updateStreaming();
  sun.shadow.needsUpdate = true;
});

function updateStreaming() {
  if (!world.update(camera.position.x, camera.position.z)) return;
  const tx = chunkIndex(camera.position.x) * CHUNK;
  const tz = chunkIndex(camera.position.z) * CHUNK;
  const ty = heightAt(tx, tz);
  sun.target.position.set(tx, ty, tz);
  sun.position.set(tx - 72, ty + 118, tz + 44);
  sun.target.updateMatrixWorld();
  sun.shadow.needsUpdate = true;
}

/** Terrain height, raised onto spire, vault and relay platforms. */
function groundAt(x, z) {
  const h = heightAt(x, z);
  let g = h;
  for (const p of platforms) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d >= p.outer) continue;
    const k = d <= p.inner ? 1 : (p.outer - d) / (p.outer - p.inner);
    const top = h + (p.top - h) * k;
    if (top > g) g = top;
  }
  return g;
}

/* ------------------------------------------------------------ game state */

let mode = 'briefing';
let hasBegun = false;
let yaw = state.yaw;
let pitch = state.pitch;
let briefYaw = state.yaw;
let energy = state.energy;
let energyMax = 100;
let harvestInterval = 0.3;
let beamDrain = 19;
let scanMax = 3.4;
let scanCooldown = 0;
let scanAge = 99;
let harvestCooldown = 0;
let beamActive = false;
let beamSounding = false;
let jumpQueued = false;
let sprintLatch = false;
let crouchLatch = false;
let simTime = 0;
let groundY = 0;
let stepOffset = 0;
let lastBob = 0;
let movementMode = 'WALK';
let saveTimer = 0;
let hudTimer = 1;
let logTimer = 0;
let drawCalls = 0;
let near = null; // one of NEAR_SPOTS / NEAR_VAULT: { kind: 'beacon' | 'vault' | 'relay', ref }
const NEAR_VAULT = Object.freeze({ kind: 'vault', ref: null });
const NEAR_SPOTS = new Map([...BEACONS.map((b) => [b, Object.freeze({ kind: 'beacon', ref: b })]), ...RELAY_SITES.map((r) => [r, Object.freeze({ kind: 'relay', ref: r })])]);
let target = null; // resource node under the reticle
let useShown = null;
let navDir = 0;
let navHold = 0;
let lockedBefore = false;
const screenStack = [];

const active = new Set(state.active);
const deployed = new Set(state.relays);
const logged = new Set(state.settlements);
const visited = new Set(state.biomes);

const mv = { vx: 0, vz: 0, vy: 0, air: 0, grounded: true, crouched: false, eye: MOVE.standingEyeHeight, landed: 0 };
const moved = { dx: 0, dz: 0, moving: false, sprinting: false };
const moveInput = { forward: 0, right: 0, sprint: false, crouch: false, jump: false };
const tmpP = { x: 0, z: 0 };
const lookDir = new THREE.Vector3();
const camLocal = new THREE.Vector3();
const beamDir = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpColor = new THREE.Color();
const stepper = fixedStep(60, 5);

const vaultOpen = () => active.size === BEACONS.length;
const networkOnline = () => state.vaultEntered;
const chartDone = () => deployed.size === RELAY_SITES.length;

function applyUpgrades() {
  energyMax = 100 + 25 * Math.min(2, state.upgrades.capacitor);
  harvestInterval = state.upgrades.emitter ? 0.2 : 0.3;
  beamDrain = state.upgrades.emitter ? 13 : 19;
  scanMax = state.upgrades.scanner ? 2.2 : 3.4;
  energy = Math.min(energy, energyMax);
}

function resetMovement() {
  mv.vx = mv.vz = mv.vy = mv.air = 0;
  mv.grounded = true;
  mv.crouched = false;
  mv.eye = MOVE.standingEyeHeight;
  stepOffset = 0;
  jumpQueued = false;
  sprintLatch = false;
  crouchLatch = false;
}

function teleport(x, z) {
  tmpP.x = x;
  tmpP.z = z;
  clampToWorld(tmpP);
  camera.position.x = tmpP.x;
  camera.position.z = tmpP.z;
  resetMovement();
  groundY = groundAt(tmpP.x, tmpP.z);
  camera.position.y = groundY + mv.eye;
  updateStreaming();
  world.flush();
  sun.shadow.needsUpdate = true;
}

/** Bring spires, vault and relays in line with the saved state. */
function syncLandmarks() {
  for (const [id, v] of beaconVisuals) v.light.intensity = active.has(id) ? 18 : 7;
  vaultCore.visible = vaultOpen();
  vaultColumn.visible = state.vaultEntered;
  for (const r of relays) {
    const status = deployed.has(r.site.id) ? 'deployed' : networkOnline() ? 'online' : 'dormant';
    if (status === r.status) continue;
    r.status = status;
    r.core.material = status === 'deployed' ? r.coreLit : r.coreDim;
    r.ring.visible = status !== 'dormant';
    r.beam.visible = status !== 'dormant';
    r.beam.material.color.setHex(status === 'deployed' ? 0x9ff6ff : 0x78e9ff);
  }
}

/**
 * The next thing worth walking to: drives the compass marker and the scan read-out.
 * Called every frame by the compass, so it fills one reused object (valid until the next call).
 */
const targetInfo = { label: '', x: 0, z: 0, d: 0, id: '' };
const setTarget = (label, x, z, d, id) => {
  targetInfo.label = label;
  targetInfo.x = x;
  targetInfo.z = z;
  targetInfo.d = d;
  targetInfo.id = id;
  return targetInfo;
};
function currentTarget() {
  const x = camera.position.x;
  const z = camera.position.z;
  let bestT = null;
  let bestD = Infinity;
  if (!vaultOpen()) {
    for (const b of BEACONS) {
      if (active.has(b.id)) continue;
      const d = Math.hypot(b.x - x, b.z - z);
      if (d < bestD) {
        bestD = d;
        bestT = b;
      }
    }
    return bestT ? setTarget(bestT.label, bestT.x, bestT.z, bestD, bestT.id) : null;
  }
  if (!state.vaultEntered) return setTarget('NULL VAULT', 0, 0, Math.hypot(x, z), 'vault');
  if (!chartDone()) {
    for (const r of RELAY_SITES) {
      if (deployed.has(r.id)) continue;
      const d = Math.hypot(r.x - x, r.z - z);
      if (d < bestD) {
        bestD = d;
        bestT = r;
      }
    }
    return bestT ? setTarget(bestT.siteLabel, bestT.x, bestT.z, bestD, bestT.id) : null;
  }
  for (const s of SETTLEMENTS) {
    if (logged.has(s.id)) continue;
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < bestD) {
      bestD = d;
      bestT = s;
    }
  }
  return bestT ? setTarget(bestT.name, bestT.x, bestT.z, bestD, bestT.id) : null;
}

/* ---------------------------------------------------------------- saving */

function persist() {
  saveTimer = 0;
  if (!hasBegun) return;
  state.x = camera.position.x;
  state.z = camera.position.z;
  state.yaw = yaw;
  state.pitch = pitch;
  state.energy = energy;
  state.active = [...active];
  state.relays = [...deployed];
  state.settlements = [...logged];
  state.biomes = [...visited];
  state.depleted = [...world.depleted];
  writeJSON(SAVE_KEY, state);
  hasSave = true;
}
const saveSoon = () => (saveTimer = Math.max(saveTimer, 9));
addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});

function recordBest(key, seconds) {
  const prev = best[key];
  const isBest = !(prev > 0) || seconds < prev;
  if (isBest) {
    best[key] = seconds;
    writeJSON(BEST_KEY, best);
  }
  return isBest;
}

/* ----------------------------------------------------------- interaction */

function toast(message, tone = 'cyan') {
  ui.toast(message, tone);
}

function activate(id) {
  if (active.has(id)) return;
  const b = BEACONS.find((x) => x.id === id);
  if (!b) return;
  active.add(id);
  syncLandmarks();
  sound.pulse(920, 1.2);
  input.rumble(0.7, 320);
  toast(`${id.toUpperCase()} SPIRE SYNCHRONIZED`, b.tone);
  if (vaultOpen()) {
    toast('NULL VAULT ACCESS GRANTED', 'violet');
    sound.chord(82, 3.6);
    ui.flash('violet');
    input.rumble(0.9, 600);
  }
  persist();
}

function enterVault() {
  state.vaultEntered = true;
  state.basinTime = state.stats.time;
  const isBest = recordBest('basin', state.basinTime);
  syncLandmarks();
  ui.flash('violet');
  sound.chord(65, 4.5);
  input.rumble(1, 700);
  persist();
  ui.renderResults({
    kicker: 'DIRECTIVE 01 COMPLETE',
    title: 'BASIN SYNCHRONIZED',
    textLine: 'The Null Vault is open and five frontier survey sites have woken. Fabricate relay kits from harvested material and raise a relay at each site.',
    stats: [
      { label: 'SURVEY TIME', value: clock(state.basinTime) },
      { label: isBest ? 'NEW BEST' : 'BEST TIME', value: clock(best.basin), best: isBest },
      { label: 'DISTANCE', value: formatDistance(state.stats.distance) },
      { label: 'SCANS', value: String(state.stats.scans) },
      { label: 'NODES HARVESTED', value: String(state.stats.harvested + state.stats.collected) },
    ],
  });
  openMenu('results');
}

function deployRelay(site) {
  if (deployed.has(site.id)) return;
  if (state.kits <= 0) {
    sound.deny();
    toast(`RELAY KIT REQUIRED // FABRICATE [${promptFor('fab', input.source)}]`, 'amber');
    return;
  }
  state.kits -= 1;
  deployed.add(site.id);
  syncLandmarks();
  sound.relay();
  ui.flash('cyan');
  input.rumble(0.8, 400);
  toast(`${site.label} RELAY ONLINE // ${deployed.size} / ${RELAY_SITES.length}`, 'cyan');
  if (chartDone()) {
    state.chartTime = state.stats.time;
    const isBest = recordBest('chart', state.chartTime);
    persist();
    sound.chord(98, 4.5);
    ui.renderResults({
      kicker: 'DIRECTIVE 02 COMPLETE',
      title: 'EXPANSE CHARTED',
      textLine: 'The relay network carries the basin signal to the frontier. The world is yours to survey: log the settlements along the old trade roads.',
      stats: [
        { label: 'TOTAL TIME', value: clock(state.chartTime) },
        { label: isBest ? 'NEW BEST' : 'BEST TIME', value: clock(best.chart), best: isBest },
        { label: 'DISTANCE', value: formatDistance(state.stats.distance) },
        { label: 'SCANS', value: String(state.stats.scans) },
        { label: 'SETTLEMENTS', value: `${logged.size} / ${SETTLEMENTS.length}` },
      ],
    });
    openMenu('results');
    return;
  }
  persist();
}

function commitGain(item, qty, kind) {
  if (!canAdd(state.inventory, item, qty)) {
    toast('FIELD STORAGE FULL', 'amber');
    return;
  }
  state.inventory[item] += qty;
  if (kind === 'pickup') state.stats.collected += 1;
  else state.stats.harvested += 1;
  ui.bump(item);
  toast(`+${qty} ${ITEMS[item].long} // ${DONE_WORDS[kind]}`, kind === 'rock' ? 'amber' : 'cyan');
  saveSoon();
}

function interact() {
  if (near?.kind === 'beacon') {
    activate(near.ref.id);
    return;
  }
  if (near?.kind === 'vault') {
    if (vaultOpen() && !state.vaultEntered) {
      enterVault();
      return;
    }
    const left = BEACONS.length - active.size;
    toast(vaultOpen() ? 'THE EXPANSE REMEMBERS YOU' : `VAULT SEALED // ${left} SIGNAL${left === 1 ? '' : 'S'} REQUIRED`, 'violet');
    return;
  }
  if (near?.kind === 'relay') {
    deployRelay(near.ref);
    return;
  }
  if (target?.kind === 'pickup') {
    if (!canAdd(state.inventory, target.item, target.yield)) {
      toast('FIELD STORAGE FULL', 'amber');
      return;
    }
    const res = world.damage(target.id);
    if (res?.depleted) {
      sound.collect();
      input.rumble(0.25, 60);
      emitSparks(res.pos, ITEM_COLORS[res.item], 10);
      commitGain(res.item, res.quantity, res.kind);
      target = null;
    }
    return;
  }
  if (target) toast(`HOLD [${promptFor('beam', input.source)}] TO ${NODE_ACTIONS[target.kind]}`, 'cyan');
}

function scan() {
  if (scanCooldown > 0) return;
  scanCooldown = scanMax;
  scanAge = 0;
  scanRing.position.set(camera.position.x, groundY + 0.25, camera.position.z);
  scanRing.scale.setScalar(1);
  scanRing.visible = true;
  sound.pulse(720, 0.75);
  state.stats.scans += 1;
  const t = currentTarget();
  let message = t ? `${t.label} // ${formatDistance(t.d)}` : 'NO UNSTABLE SIGNALS';
  if (state.upgrades.scanner) {
    const found = world.nearestNodes(camera.position.x, camera.position.z, markers.length, 160);
    found.forEach((node, k) => {
      const m = markers[k];
      m.mesh.position.set(node.pos.x, node.pos.y + 16, node.pos.z);
      m.mesh.material.color.setHex(ITEM_COLORS[node.item]);
      m.mesh.visible = true;
      m.life = 8;
    });
    if (found.length) message += ` · ${found.length} SIGNATURE${found.length === 1 ? '' : 'S'} MARKED`;
  }
  toast(message, 'cyan');
}

function onFabricate(id) {
  if (!ready) return;
  const r = RECIPES.find((x) => x.id === id);
  if (!r) return;
  const level = id === 'kit' ? state.kits + deployed.size : state.upgrades[id];
  if (level >= r.max) {
    sound.deny();
    toast(id === 'kit' ? 'EVERY SURVEY SITE IS COVERED' : 'ALREADY INSTALLED', 'amber');
    return;
  }
  for (const [item, qty] of Object.entries(r.cost)) {
    if (state.inventory[item] < qty) {
      sound.deny();
      toast(`INSUFFICIENT ${ITEMS[item].long}`, 'amber');
      return;
    }
  }
  for (const [item, qty] of Object.entries(r.cost)) state.inventory[item] -= qty;
  if (id === 'kit') state.kits += 1;
  else state.upgrades[id] += 1;
  if (id === 'capacitor') energy += 25;
  applyUpgrades();
  sound.fabricate();
  input.rumble(0.3, 90);
  toast(`${r.name} FABRICATED`, 'cyan');
  persist();
  renderFab();
}

/* --------------------------------------------------------------- effects */

function emitSparks(p, hex, n) {
  tmpColor.setHex(hex);
  for (let k = 0; k < n && spark.alive < SPARK_MAX; k += 1) {
    const i = spark.alive++;
    spark.pos[i * 3] = p.x;
    spark.pos[i * 3 + 1] = p.y;
    spark.pos[i * 3 + 2] = p.z;
    const a = Math.random() * Math.PI * 2;
    const out = 1 + Math.random() * 3;
    spark.vel[i * 3] = Math.cos(a) * out;
    spark.vel[i * 3 + 1] = 2 + Math.random() * 4;
    spark.vel[i * 3 + 2] = Math.sin(a) * out;
    spark.life[i] = spark.max[i] = 0.45 + Math.random() * 0.5;
    spark.base[i * 3] = tmpColor.r * 2;
    spark.base[i * 3 + 1] = tmpColor.g * 2;
    spark.base[i * 3 + 2] = tmpColor.b * 2;
  }
}

function updateSparks(dt) {
  let n = spark.alive;
  if (!n && !spark.shown) return;
  const P = sparks.positions.array;
  const C = sparks.colors.array;
  for (let i = 0; i < n; ) {
    spark.life[i] -= dt;
    if (spark.life[i] <= 0) {
      n -= 1;
      if (i !== n) {
        for (let c = 0; c < 3; c += 1) {
          spark.pos[i * 3 + c] = spark.pos[n * 3 + c];
          spark.vel[i * 3 + c] = spark.vel[n * 3 + c];
          spark.base[i * 3 + c] = spark.base[n * 3 + c];
        }
        spark.life[i] = spark.life[n];
        spark.max[i] = spark.max[n];
      }
      continue;
    }
    spark.vel[i * 3 + 1] -= 9.8 * dt;
    for (let c = 0; c < 3; c += 1) {
      spark.pos[i * 3 + c] += spark.vel[i * 3 + c] * dt;
      P[i * 3 + c] = spark.pos[i * 3 + c];
    }
    const f = spark.life[i] / spark.max[i];
    for (let c = 0; c < 3; c += 1) C[i * 3 + c] = spark.base[i * 3 + c] * f;
    i += 1;
  }
  spark.alive = n;
  spark.shown = n;
  sparks.setCount(n);
  sparks.positions.needsUpdate = true;
  sparks.colors.needsUpdate = true;
}

/* ------------------------------------------------------------ simulation */

function moveStep(inp, dt) {
  const a = Math.max(0, Math.min(dt, 0.05));
  const len = Math.hypot(inp.forward, inp.right);
  const moving = len > 0.001;
  const crouch = inp.crouch && mv.grounded && !inp.jump;
  const sprint = inp.sprint && inp.forward > 0 && mv.grounded && !crouch && energy > 4;
  const speed = crouch ? MOVE.crouchSpeed : sprint ? MOVE.sprintSpeed : MOVE.walkSpeed;
  const f = moving ? inp.forward / Math.max(1, len) : 0;
  const r = moving ? inp.right / Math.max(1, len) : 0;
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const tx = (-s * f + c * r) * speed;
  const tz = (-c * f - s * r) * speed;
  const accel = (moving ? MOVE.acceleration : MOVE.deceleration) * a;
  const ddx = tx - mv.vx;
  const ddz = tz - mv.vz;
  const dist = Math.hypot(ddx, ddz);
  const k = dist > accel && dist > 0 ? accel / dist : 1;
  mv.vx += ddx * k;
  mv.vz += ddz * k;
  mv.landed = 0;
  if (inp.jump && mv.grounded) {
    mv.grounded = false;
    mv.vy = MOVE.jumpImpulse;
    sound.jump();
  }
  if (!mv.grounded) {
    mv.vy -= MOVE.gravity * a;
    mv.air += mv.vy * a;
    if (mv.air <= 0) {
      mv.landed = -mv.vy;
      mv.air = 0;
      mv.vy = 0;
      mv.grounded = true;
    }
  }
  mv.crouched = crouch;
  const eyeTarget = crouch ? MOVE.crouchedEyeHeight : MOVE.standingEyeHeight;
  mv.eye += (eyeTarget - mv.eye) * Math.min(1, MOVE.eyeResponse * a);
  moved.dx = mv.vx * a;
  moved.dz = mv.vz * a;
  moved.moving = moving;
  moved.sprinting = sprint;
}

function fixedUpdate(h) {
  simTime += h;
  scanCooldown = Math.max(0, scanCooldown - h);
  scanAge += h;
  harvestCooldown = Math.max(0, harvestCooldown - h);

  moveInput.jump = jumpQueued;
  jumpQueued = false;
  moveStep(moveInput, h);

  const px = camera.position.x;
  const pz = camera.position.z;
  tmpP.x = px + moved.dx;
  tmpP.z = pz + moved.dz;
  clampToWorld(tmpP);
  for (let pass = 0; pass < 2; pass += 1) {
    world.collide(tmpP, PLAYER_RADIUS);
    for (let k = 0; k < staticCircles.length; k += 3) pushCircle(tmpP, staticCircles[k], staticCircles[k + 1], staticCircles[k + 2] + PLAYER_RADIUS);
  }
  camera.position.x = tmpP.x;
  camera.position.z = tmpP.z;
  state.stats.distance += Math.hypot(tmpP.x - px, tmpP.z - pz);

  if (moved.sprinting) energy = Math.max(0, energy - 12 * h);
  else if (!beamActive) energy = Math.min(energyMax, energy + 8 * h);
  if (beamActive) {
    energy = Math.max(0, energy - beamDrain * h);
    if (energy <= 0) beamActive = false;
  }
  movementMode = mv.grounded ? (mv.crouched ? 'CROUCH' : moved.sprinting ? 'SPRINT' : 'WALK') : 'AIR';

  // Follow the ground; fall off ledges, glide up steps.
  const g = groundAt(tmpP.x, tmpP.z);
  const dg = g - groundY;
  if (mv.grounded) {
    if (dg < -0.6) {
      mv.grounded = false;
      mv.air = -dg;
      mv.vy = 0;
    } else if (dg > 0.35) {
      stepOffset -= dg;
    }
  } else {
    mv.air -= dg;
    if (mv.air <= 0) {
      mv.landed = Math.max(mv.landed, -mv.vy);
      mv.air = 0;
      mv.vy = 0;
      mv.grounded = true;
    }
  }
  groundY = g;
  if (mv.landed > 6) {
    sound.land(mv.landed);
    input.rumble(Math.min(0.6, mv.landed * 0.05), 90);
    stepOffset -= Math.min(0.35, mv.landed * 0.025);
  }
  stepOffset *= Math.exp(-14 * h);
  const rate = moved.sprinting ? 13 : mv.crouched ? 6.5 : 9;
  const bobRaw = Math.sin(simTime * rate);
  const walking = moved.moving && mv.grounded;
  const bob = walking ? bobRaw * (mv.crouched ? 0.018 : 0.035) : 0;
  if (walking && Math.sign(bobRaw) !== Math.sign(lastBob) && !mv.crouched) sound.step(moved.sprinting);
  lastBob = bobRaw;
  camera.position.y = g + mv.eye + mv.air + bob + stepOffset;

  updateStreaming();

  // What is the probe next to or looking at?
  near = null;
  target = null;
  const cx = camera.position.x;
  const cz = camera.position.z;
  for (const b of BEACONS) {
    if (!active.has(b.id) && Math.hypot(cx - b.x, cz - b.z) < 9.5) near = NEAR_SPOTS.get(b);
  }
  if (Math.hypot(cx, cz) < 18) near = NEAR_VAULT;
  if (!near && networkOnline()) {
    for (const r of RELAY_SITES) {
      if (!deployed.has(r.id) && Math.hypot(cx - r.x, cz - r.z) < 8) near = NEAR_SPOTS.get(r);
    }
  }
  if (!near) {
    camera.getWorldDirection(lookDir);
    target = world.findTarget(camera.position, lookDir);
  }

  if (beamActive && harvestCooldown <= 0 && target && target.kind !== 'pickup') {
    if (target.hitPoints === 1 && !canAdd(state.inventory, target.item, target.yield)) {
      beamActive = false;
      toast('FIELD STORAGE FULL', 'amber');
    } else {
      const res = world.damage(target.id);
      harvestCooldown = harvestInterval;
      if (res) {
        sound.hit(res.kind);
        input.rumble(0.15, 40);
        emitSparks(res.pos, ITEM_COLORS[res.item], 5);
        if (res.depleted) {
          sound.depleted(res.kind);
          input.rumble(0.45, 140);
          emitSparks(res.pos, ITEM_COLORS[res.item], 16);
          commitGain(res.item, res.quantity, res.kind);
          target = null;
        }
      }
    }
  }
}

/* --------------------------------------------------------------- visuals */

function updateVisuals(dt, t) {
  if (!hasBegun) {
    yaw = briefYaw + Math.sin(t * 0.13) * 0.075;
    camera.position.y = groundAt(camera.position.x, camera.position.z) + 1.82 + Math.sin(t * 0.35) * 0.035;
  }
  camera.rotation.set(pitch, yaw, 0);
  const fovTarget = 67 + (moved.sprinting && hasBegun && mode === 'play' && !ui.screen ? 4 : 0);
  if (Math.abs(camera.fov - fovTarget) > 0.02) {
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 6);
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  skyAnchor.position.copy(camera.position);
  dust.object.position.set(camera.position.x, camera.position.y - 10, camera.position.z);
  dust.object.rotation.y = t * 0.008;

  if (scanRing.visible) {
    const k = scanAge / 1.45;
    scanRing.scale.setScalar(1 + k * 74);
    scanRing.material.opacity = Math.max(0, 0.92 - k);
    if (k >= 1) scanRing.visible = false;
  }

  for (const [id, v] of beaconVisuals) {
    const on = active.has(id);
    v.core.rotation.y += dt * (on ? 1.1 : 0.22);
    v.core.scale.setScalar(1 + Math.sin(t * 2.4 + v.group.position.x) * (on ? 0.11 : 0.035));
    v.rings.forEach((o, l) => {
      o.rotation.y += dt * (0.12 + l * 0.08) * (on ? 3 : 1);
      o.rotation.x += dt * 0.025 * (l % 2 ? -1 : 1);
    });
    v.beam.material.opacity = on ? 0.13 + Math.sin(t * 1.7) * 0.025 : 0.045;
  }
  const open = vaultOpen();
  vaultRings.forEach((ring, r) => {
    const a = open ? 0.18 + r * 0.08 : 0.016;
    ring.rotation.y += dt * a * (r % 2 ? -1 : 1);
    ring.rotation.z += dt * a * 0.35;
  });
  if (vaultColumn.visible) vaultColumn.material.opacity = 0.08 + Math.sin(t * 0.9) * 0.025;
  for (const s of sentinels) {
    const o = (t * 0.34 + s.phase) % 1;
    s.ring.scale.setScalar(0.7 + o * 1.8);
    s.ring.material.opacity = (1 - o) * 0.36;
  }
  for (const r of relays) {
    if (r.status === 'dormant') continue;
    const lit = r.status === 'deployed';
    r.core.rotation.y += dt * (lit ? 1.6 : 0.4);
    r.ring.material.opacity = lit ? 0.34 : 0.16 + Math.sin(t * 2.2 + r.phase) * 0.12;
    r.beam.material.opacity = lit ? 0.15 + Math.sin(t * 1.4 + r.phase) * 0.03 : 0.05 + Math.sin(t * 2 + r.phase) * 0.02;
  }
  for (const m of markers) {
    if (m.life <= 0) continue;
    m.life -= dt;
    m.mesh.material.opacity = Math.min(1, m.life / 1.5) * 0.3;
    if (m.life <= 0) m.mesh.visible = false;
  }

  if (beamActive) {
    beam.visible = true;
    beamMat.opacity = 0.68 + Math.sin(t * 57) * 0.16;
    if (target && target.kind !== 'pickup') camera.worldToLocal(camLocal.copy(target.pos));
    else camLocal.set(0, 0, -115);
    beamDir.subVectors(camLocal, BEAM_START);
    const len = Math.max(0.5, beamDir.length());
    beamDir.multiplyScalar(1 / len);
    beam.position.copy(BEAM_START).addScaledVector(beamDir, len / 2);
    beam.quaternion.setFromUnitVectors(UP, beamDir);
    beam.scale.set(1, len, 1);
  } else {
    beam.visible = false;
  }
  if (beamActive !== beamSounding) {
    beamSounding = beamActive;
    sound.beam(beamActive);
  }

  // The original's distant flare lighting up the basin now and then.
  if (Math.sin(t * 0.31) > 0.997) sun.intensity = 7.4;
  else sun.intensity += (3.6 - sun.intensity) * (1 - Math.exp(-dt * 4.8));

  world.animate(t);
  updateSparks(dt);
}

/* ------------------------------------------------------------------- hud */

const R = ui.refs;

function updateCompass() {
  const heading = ((-THREE.MathUtils.radToDeg(yaw) % 360) + 360) % 360;
  ui.text(R.compassLabel, headingLabel(heading));
  ui.text(R.compassDeg, `${String(Math.round(heading) % 360).padStart(3, '0')}°`);
  ui.style(R.compassTicks, '--tick-shift', `${((-(heading % 15) / 15) * 20).toFixed(1)}px`);
  const t = mode === 'play' ? currentTarget() : null;
  ui.show(R.compassTarget, !!t);
  if (t) {
    const bearing = THREE.MathUtils.radToDeg(Math.atan2(t.x - camera.position.x, -(t.z - camera.position.z)));
    let rel = (((bearing - heading) % 360) + 540) % 360 - 180;
    const edge = Math.abs(rel) > 90;
    rel = Math.max(-90, Math.min(90, rel));
    ui.style(R.compassTarget, '--target-x', `${((rel / 90) * 46).toFixed(1)}%`);
    ui.cls(R.compassTarget, 'is-edge', edge);
  }
}

function updateHud() {
  const src = input.source;
  ui.setSource(src);
  const x = camera.position.x;
  const z = camera.position.z;
  const tgt = currentTarget();

  ui.text(R.backend, kit.backendLabel.toUpperCase());
  ui.text(R.fps, `${window.__kit?.fps || 0} FPS`);
  ui.text(R.tier, kit.tier.name.toUpperCase());

  // Directive panel.
  if (!state.vaultEntered) {
    const open = vaultOpen();
    ui.text(R.protocol, 'NULL SIGNAL');
    ui.text(R.objIndex, '01');
    ui.text(R.objKicker, 'PRIMARY DIRECTIVE');
    ui.text(R.objTitle, open ? 'ENTER THE NULL VAULT' : 'SYNCHRONIZE THE BASIN');
    ui.text(R.objText, open ? 'The central aperture is responding.' : 'Stabilize all three signal spires.');
    ui.setRows('beacons', BEACONS.length);
    BEACONS.forEach((b, i) => {
      const on = active.has(b.id);
      const isT = !on && tgt?.id === b.id;
      ui.setRow(i, b.id.toUpperCase(), on ? 'SYNCHRONIZED' : isT ? formatDistance(tgt.d) : b.frequency, on, isT);
    });
    ui.show(R.objKits, false);
  } else if (!chartDone()) {
    ui.text(R.protocol, 'FRONTIER CHART');
    ui.text(R.objIndex, '02');
    ui.text(R.objKicker, 'SECONDARY DIRECTIVE');
    ui.text(R.objTitle, 'CHART THE FRONTIER');
    ui.text(R.objText, 'Fabricate relay kits and raise a relay at each survey site.');
    ui.setRows('relays', RELAY_SITES.length);
    RELAY_SITES.forEach((r, i) => {
      const on = deployed.has(r.id);
      const isT = !on && tgt?.id === r.id;
      ui.setRow(i, r.label, on ? 'RELAY ONLINE' : isT ? formatDistance(tgt.d) : 'AWAITING RELAY', on, isT);
    });
    ui.show(R.objKits, true);
    const fabKey = promptFor('fab', src);
    ui.text(R.objKits, `RELAY KITS ${state.kits} · FABRICATE [${fabKey}] · ${deployed.size} / ${RELAY_SITES.length} ONLINE`);
  } else {
    ui.text(R.protocol, 'OPEN SURVEY');
    ui.text(R.objIndex, '03');
    ui.text(R.objKicker, 'OPEN SURVEY');
    ui.text(R.objTitle, 'SURVEY THE WORLD');
    ui.text(R.objText, `Log the frontier's settlements. ${logged.size} / ${SETTLEMENTS.length} logged, ${visited.size} / ${Object.keys(BIOME_LABELS).length} regions charted.`);
    ui.setRows('settlement', tgt ? 1 : 0);
    if (tgt) ui.setRow(0, tgt.label, formatDistance(tgt.d), false, true);
    ui.show(R.objKits, false);
  }

  // Telemetry.
  const biome = biomeAt(x, z);
  const ns = nearestSettlement(x, z);
  ui.text(R.region, BIOME_LABELS[biome]);
  ui.text(R.settlement, `${ns.settlement.name} · ${formatDistance(ns.distance)}`);
  ui.text(R.pos, `${x.toFixed(0)} / ${z.toFixed(0)}`);
  ui.text(R.cells, `${String(world.chunks.size).padStart(2, '0')} / ${String(drawCalls).padStart(3, '0')}`);
  const missionCount = state.vaultEntered ? `${deployed.size} / ${RELAY_SITES.length}` : `${active.size} / ${BEACONS.length}`;
  ui.text(R.stance, `${movementMode} · ${missionCount}`);
  ui.text(R.time, clock(state.stats.time));

  ui.setInventory(state.inventory, state.kits, state.vaultEntered || state.kits > 0);

  // Reticle and prompt.
  const hot = !!near || !!target;
  ui.cls(R.reticle, 'reticle-hot', hot);
  ui.cls(R.reticle, 'reticle-hit', beamActive && !!target && target.kind !== 'pickup');
  ui.show(R.prompt, hot);
  let warn = false;
  if (near?.kind === 'beacon') {
    ui.text(R.promptKey, promptFor('use', src));
    ui.text(R.promptLabel, `${near.ref.id.toUpperCase()} SPIRE`);
    ui.text(R.promptAction, 'SYNCHRONIZE');
  } else if (near?.kind === 'vault') {
    ui.text(R.promptKey, promptFor('use', src));
    ui.text(R.promptLabel, 'NULL INTERFACE');
    ui.text(R.promptAction, vaultOpen() && !state.vaultEntered ? 'ENTER THE VAULT' : 'INTERFACE');
  } else if (near?.kind === 'relay') {
    warn = state.kits <= 0;
    ui.text(R.promptKey, promptFor('use', src));
    ui.text(R.promptLabel, `${near.ref.label} · ${state.kits} KIT${state.kits === 1 ? '' : 'S'}`);
    ui.text(R.promptAction, warn ? 'RELAY KIT NEEDED' : 'DEPLOY RELAY');
  } else if (target) {
    const pickup = target.kind === 'pickup';
    ui.text(R.promptKey, promptFor(pickup ? 'use' : 'beam', src));
    ui.text(R.promptLabel, NODE_LABELS[target.kind]);
    const progress = 1 - target.hitPoints / target.maxHitPoints;
    ui.text(R.promptAction, pickup ? 'COLLECT' : `${NODE_ACTIONS[target.kind]}${progress > 0 ? ` · ${Math.round(progress * 100)}%` : ''}`);
  }
  ui.cls(R.prompt, 'is-warn', warn);
  const showUse = !!near || target?.kind === 'pickup';
  if (showUse !== useShown) {
    useShown = showUse;
    kit.touch?.setShown('interact', showUse);
  }

  // Systems.
  const ready = scanCooldown <= 0.05;
  ui.text(R.scanState, ready ? 'READY' : `${scanCooldown.toFixed(1)}S`);
  ui.style(R.scanBar, 'width', `${ready ? 100 : Math.round(Math.max(0, (1 - scanCooldown / scanMax) * 100))}%`);
  const pct = Math.round((energy / energyMax) * 100);
  ui.text(R.energyValue, `${pct}%`);
  ui.style(R.energyRing, '--energy', `${Math.round(pct * 3.6)}deg`);
  ui.cls(R.energy, 'is-low', pct < 20);
}

/** Log settlements and regions as the probe reaches them. */
function updateSurveyLog() {
  const x = camera.position.x;
  const z = camera.position.z;
  const biome = biomeAt(x, z);
  if (!visited.has(biome)) {
    visited.add(biome);
    if (visited.size > 1) toast(`REGION CHARTED // ${BIOME_LABELS[biome]}`, 'violet');
    saveSoon();
  }
  const ns = nearestSettlement(x, z);
  if (ns.distance < ns.settlement.radius && !logged.has(ns.settlement.id)) {
    logged.add(ns.settlement.id);
    toast(`SETTLEMENT LOGGED // ${ns.settlement.name}`, 'violet');
    sound.collect();
    saveSoon();
  }
}

/* ----------------------------------------------------------------- menus */

let menuOpenedAt = 0;

function showMenu(name) {
  ui.showScreen(name);
  navDir = 0;
  navHold = 0;
  menuOpenedAt = performance.now();
}

/** Open a screen: from play it pauses; over another screen it stacks (Back returns). */
function openMenu(name) {
  if (!ui.screen) {
    screenStack.length = 0;
    input.unlockPointer();
    kit.touch?.suspend(true, 'game');
    sound.setDucked(true);
    beamActive = false;
    ui.setPhase('paused');
  } else {
    screenStack.push(ui.screen);
  }
  showMenu(name);
}

function backMenu() {
  const prev = screenStack.pop();
  if (prev) showMenu(prev);
  else if (mode === 'play') resumePlay(false);
}

/**
 * Close every screen and continue. `lock` asks for mouse capture, which
 * browsers only grant inside a click or key handler, so the DOM buttons pass
 * true and controller/keyboard shortcuts leave it to the next canvas click.
 */
function resumePlay(lock) {
  screenStack.length = 0;
  showMenu(null);
  ui.setPhase('running');
  kit.touch?.suspend(false, 'game');
  sound.setDucked(false);
  input.settle();
  if (lock && input.source === 'keyboard') input.lockPointer();
  persist();
}

function startPlay(lock) {
  mode = 'play';
  hasBegun = true;
  sound.unlock();
  ui.showHud(true);
  hudTimer = 1;
  resumePlay(lock);
}

function renderFab() {
  ui.renderFab({
    inventory: state.inventory,
    kits: state.kits,
    levels: { kit: state.kits + deployed.size, ...state.upgrades },
    note: networkOnline()
      ? `Relay network online · ${deployed.size} / ${RELAY_SITES.length} sites raised.`
      : 'Relay sites wake when the Null Vault is entered. Kits can be built ahead.',
    recipes: RECIPES,
  });
}

function renderLog() {
  const x = camera.position.x;
  const z = camera.position.z;
  const sections = [];
  sections.push({
    title: 'DIRECTIVES',
    items: [
      { name: '01 · SYNCHRONIZE THE BASIN', text: `${active.size} / ${BEACONS.length} spires${state.basinTime != null ? ` · done at ${clock(state.basinTime)}` : ''}`, done: state.vaultEntered },
      { name: '02 · CHART THE FRONTIER', text: `${deployed.size} / ${RELAY_SITES.length} relays${state.chartTime != null ? ` · done at ${clock(state.chartTime)}` : ''}`, done: chartDone(), unknown: !state.vaultEntered },
      { name: '03 · SURVEY THE WORLD', text: `${logged.size} / ${SETTLEMENTS.length} settlements logged`, done: logged.size === SETTLEMENTS.length, unknown: !chartDone() },
    ],
  });
  sections.push({
    title: 'RELAY SITES',
    items: RELAY_SITES.map((r) => ({
      name: r.label,
      text: deployed.has(r.id) ? 'Relay online' : networkOnline() ? `Awaiting relay · ${formatDistance(Math.hypot(r.x - x, r.z - z))}` : 'Dormant until the vault is entered',
      done: deployed.has(r.id),
      unknown: !networkOnline(),
    })),
  });
  const settlementItems = SETTLEMENTS.filter((s) => logged.has(s.id)).map((s) => ({ name: s.name, text: `${s.tier.toUpperCase()} · ${s.industry}. ${s.reason}`, done: true }));
  const next = [...SETTLEMENTS].filter((s) => !logged.has(s.id)).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
  if (next) settlementItems.push({ name: `NEAREST UNCHARTED · ${next.name}`, text: `${formatDistance(Math.hypot(next.x - x, next.z - z))} away · ${SETTLEMENTS.length - logged.size} still uncharted`, unknown: true });
  sections.push({ title: `SETTLEMENTS · ${logged.size} / ${SETTLEMENTS.length}`, items: settlementItems });
  sections.push({
    title: `REGIONS · ${visited.size} / ${Object.keys(BIOME_LABELS).length}`,
    items: Object.entries(BIOME_LABELS).map(([id, label]) => ({ name: visited.has(id) ? label : 'UNCHARTED REGION', done: visited.has(id), unknown: !visited.has(id) })),
  });
  sections.push({
    title: 'RECORDS',
    items: [
      { name: 'BEST BASIN TIME', text: best.basin > 0 ? clock(best.basin) : '—' },
      { name: 'BEST CHART TIME', text: best.chart > 0 ? clock(best.chart) : '—' },
      { name: 'SURVEY TIME', text: clock(state.stats.time) },
      { name: 'DISTANCE', text: formatDistance(state.stats.distance) },
      { name: 'SCANS', text: String(state.stats.scans) },
      { name: 'NODES HARVESTED', text: String(state.stats.harvested + state.stats.collected) },
      { name: 'EQUIPMENT', text: `Capacitor ${state.upgrades.capacitor}/2 · Emitter ${state.upgrades.emitter ? 'on' : 'off'} · Deep scanner ${state.upgrades.scanner ? 'on' : 'off'}` },
    ],
  });
  ui.renderLog(sections);
}

function newSurvey() {
  state = freshState();
  active.clear();
  deployed.clear();
  logged.clear();
  visited.clear();
  energy = 100;
  applyUpgrades();
  yaw = 0;
  pitch = -0.055;
  briefYaw = 0;
  beamActive = false;
  scanCooldown = 0;
  near = null;
  target = null;
  world.reset(new Set());
  syncLandmarks();
  teleport(START.x, START.z);
  writeJSON(SAVE_KEY, state);
}

function onAction(action) {
  if (!ready) return;
  sound.ui();
  switch (action) {
    case 'continue':
      startPlay(true);
      break;
    case 'start':
      if (hasSave) openMenu('confirm');
      else startPlay(true);
      break;
    case 'controls':
      ui.renderHelp(input.source);
      openMenu('help');
      break;
    case 'resume':
      resumePlay(true);
      break;
    case 'fab':
      renderFab();
      openMenu('fab');
      break;
    case 'log':
      renderLog();
      openMenu('log');
      break;
    case 'settings':
      kit.menu.open();
      break;
    case 'recall':
      teleport(START.x, START.z);
      toast('RECALLED TO INSERTION POINT', 'cyan');
      resumePlay(true);
      break;
    case 'new':
      openMenu('confirm');
      break;
    case 'back':
      backMenu();
      break;
    case 'confirm-new':
      newSurvey();
      hasSave = false;
      ui.setBriefing(briefingInfo());
      if (mode === 'briefing') startPlay(true);
      else resumePlay(true);
      toast('NEW SURVEY // INSERTION CONFIRMED', 'cyan');
      break;
    default:
      break;
  }
}

function menuNav(dt) {
  const screen = ui.screen;
  if (!screen || screen === 'error') return;
  // A key that closed pointer lock can land a frame after the menu it opened.
  const settled = performance.now() - menuOpenedAt > 250;
  if (settled && screen === 'fab' && input.pressed('fab')) {
    backMenu();
    return;
  }
  if (settled && (input.pressed('pause') || input.pressed('back'))) {
    if (screen === 'briefing') return;
    if (screen === 'pause' || screen === 'results') {
      if (mode === 'play') resumePlay(false);
      return;
    }
    backMenu();
    return;
  }
  const v = input.vector('move');
  if (screen === 'log' && Math.abs(v.y) > 0.2) ui.scrollLog(-v.y * dt * 700);
  const dir = v.y > 0.55 ? -1 : v.y < -0.55 ? 1 : 0;
  if (dir !== 0) {
    if (dir !== navDir) {
      ui.moveFocus(dir);
      navHold = 0.38;
    } else {
      navHold -= dt;
      if (navHold <= 0) {
        ui.moveFocus(dir);
        navHold = 0.14;
      }
    }
  }
  navDir = dir;
  if (input.pressed('jump') || input.pressed('confirm')) ui.activateFocus();
}

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === kit.canvas;
  if (!locked && lockedBefore && mode === 'play' && !ui.screen) openMenu('pause');
  lockedBefore = locked;
});
// Mouse capture has to be asked for inside the click itself (Firefox and Safari refuse it
// from the game loop), so a click on the view during play captures the cursor here.
kit.canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && mode === 'play' && !ui.screen && !input.pointerLocked) input.lockPointer();
});

function playInput() {
  const lk = input.look('look');
  yaw -= lk.x * 0.75;
  pitch = THREE.MathUtils.clamp(pitch - lk.y * 0.7, -1.45, 1.42);
  const mvv = input.vector('move');
  moveInput.forward = mvv.y;
  moveInput.right = mvv.x;
  if (input.pressed('jump')) {
    jumpQueued = true;
    crouchLatch = false;
  }
  const src = input.source;
  if (input.pressed('sprint') && src !== 'keyboard') sprintLatch = !sprintLatch;
  if (src === 'keyboard' || mvv.y <= 0.1 || energy < 1) sprintLatch = false;
  moveInput.sprint = input.down('sprint') || sprintLatch;
  if (src === 'touch') {
    if (input.pressed('crouch')) crouchLatch = !crouchLatch;
  } else {
    crouchLatch = false;
  }
  moveInput.crouch = (src !== 'touch' && input.down('crouch')) || crouchLatch;

  if (input.pressed('beam') && energy > 1) beamActive = true;
  if (!input.down('beam')) beamActive = false;
  if (input.pressed('interact')) {
    interact();
    if (ui.screen) return; // the vault or the last relay opened a results screen
  }
  if (input.pressed('scan')) scan();
  if (input.pressed('fab')) {
    renderFab();
    openMenu('fab');
    return;
  }
  if (input.pressed('pause')) openMenu('pause');
}

function briefingInfo() {
  const parts = [];
  if (best.basin > 0) parts.push(`BEST BASIN ${clock(best.basin)}`);
  if (best.chart > 0) parts.push(`BEST CHART ${clock(best.chart)}`);
  return {
    hasSave,
    render: `${kit.backendLabel.toUpperCase()} / ${kit.tier.name.toUpperCase()}`,
    best: parts.join(' · '),
  };
}

/* ------------------------------------------------------------------ start */

/**
 * Compile shaders up front, including things that only appear later (the vault core
 * and column, lit relay cores, scan ring, beam, scanner markers), so the moment the
 * vault opens or the first relay goes up does not stall on a pipeline build.
 */
async function prewarm() {
  const hidden = [vaultCore, vaultColumn, scanRing, beam, ...markers.map((m) => m.mesh), ...relays.flatMap((r) => [r.ring, r.beam])];
  const was = hidden.map((o) => o.visible);
  for (const o of hidden) o.visible = true;
  const r0 = relays[0];
  const core0 = r0.core.material;
  r0.core.material = core0 === r0.coreLit ? r0.coreDim : r0.coreLit;
  camera.rotation.set(pitch, yaw, 0);
  camera.updateMatrixWorld();
  try {
    await kit.renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('[obsidian] shader pre-warm skipped:', err?.message || err);
  }
  hidden.forEach((o, k) => (o.visible = was[k]));
  r0.core.material = core0;
}

let post;
try {
  applyUpgrades();
  applyTier();
  syncLandmarks();
  camera.position.set(state.x, 0, state.z);
  teleport(state.x, state.z);
  kit.loading.progress(0.9, 'Tuning the TSL pipeline…');
  await prewarm();
  post = createPost(kit, scene, camera, { bloom: { strength: 0.34, radius: 0.42, threshold: 0.72 } });
} catch (err) {
  console.error(err);
  // The kit's loading card sits above everything; clear it so the error screen shows.
  kit.loading.done();
  ui.showError(`The survey world could not be built: ${err?.message || err}`);
  throw err;
}

ui.setSource(input.source);
input.onSourceChange((src) => {
  ui.setSource(src);
  if (ui.screen === 'help') ui.renderHelp(src);
});
ui.setBriefing(briefingInfo());
ui.showScreen('briefing');
ready = true;

window.__OBSIDIAN_QA__ = {
  teleport: (x, z) => teleport(x, z),
  activate: (id) => activate(id),
  grant: (item, qty = 10) => {
    if (ITEMS[item]) state.inventory[item] = Math.min(ITEMS[item].stackLimit, state.inventory[item] + qty);
  },
  snapshot: () => ({
    mode,
    screen: ui.screen,
    x: camera.position.x,
    z: camera.position.z,
    active: [...active],
    vaultEntered: state.vaultEntered,
    relays: [...deployed],
    kits: state.kits,
    inventory: { ...state.inventory },
    energy,
    chunks: world.chunks.size,
    drawCalls,
  }),
};

kit.start((dt, t) => {
  const playing = mode === 'play' && !ui.screen;
  if (playing) {
    playInput();
    if (mode === 'play' && !ui.screen) {
      stepper.advance(dt, fixedUpdate);
      state.stats.time += dt;
      saveTimer += dt;
      if (saveTimer >= 10) persist();
      logTimer += dt;
      if (logTimer >= 0.3) {
        logTimer = 0;
        updateSurveyLog();
      }
    }
  } else {
    menuNav(dt);
    moved.sprinting = false;
  }
  updateVisuals(dt, t);
  if (world.pending && world.pump(playing ? 3 : 8) > 0) sun.shadow.needsUpdate = true;
  if (hasBegun) {
    hudTimer += dt;
    if (hudTimer >= 0.1) {
      hudTimer = 0;
      updateHud();
    }
    updateCompass();
  }
  renderer.info.reset();
  post.render();
  drawCalls = renderer.info.render.drawCalls;
});
