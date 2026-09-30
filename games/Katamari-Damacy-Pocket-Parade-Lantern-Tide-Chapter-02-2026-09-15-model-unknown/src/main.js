// Pocket Parade: Lantern Tide — Chapter 02. Roll up a whole night market.
// Original art, music and game logic; drawn by three.js through the shared kit.
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { TAU, PI, clamp, lerp, V, Q, writeTRS, eulerInto, setSeed, rnd, between, Builder, beam } from './geometry.js';
import { P, ORDER, MESH, initModels, thumbFor } from './models.js';
import { Sound } from './audio.js';
import { createRenderLayer, LAYER_NO_REFLECT, POINT_LIGHTS } from './render.js';

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- save
const SAVE_KEY = 'pocket-parade-lantern-tide-v2';
const save = {
  best: 0, items: 0, won: false, sound: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  found: {}, bestGoalTime: 0, encoreBest: 0, encoreWon: false, dragon: false,
};
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (_) { /* a fresh night */ }
if (!save.found || typeof save.found !== 'object') save.found = {};
let reduced = !!save.reduced;
let saveDirty = false;
function store() {
  saveDirty = false;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (_) { /* private mode: keep playing */ }
}
function flushSave() { if (saveDirty) store(); }

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'Pocket Parade: Lantern Tide',
  canvas: $('world'),
  gear: 'none', // the title, pause and photo screens have a GRAPHICS button that opens the kit settings
  accent: '#f5aeaa',
  background: '#182c46',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['A', 'RT'], touch: 'Boost' },
    turnBack: { keys: ['Space'], gamepad: ['Y'], touch: '↻' },
    turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    zoomPad: { type: 'axis', gamepad: { pos: 'RB', neg: 'LB' } },
    launch: { keys: ['Enter', 'NumpadEnter'], gamepad: ['X'], touch: 'Parade' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    photo: { keys: ['KeyF'], gamepad: ['Back'] },
    mute: { keys: ['KeyM'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
const input = kit.input;
const canvas = kit.canvas;
kit.loading.progress(0.62, 'Lighting the little lanterns…');

// ---------------------------------------------------------------- world constants
const WATER_Y = -0.18, MOON = V.norm([-0.48, 0.83, -0.3]);
const START_RADIUS = 0.9, GOAL_CM = 120, MISSION_SECONDS = 300;
const ENCORE_RADIUS = 3.0, ENCORE_SECONDS = 270, DRAGON_CM = 135;
const STAGES = [
  { at: 30, main: 'The night is getting bigger.', sub: 'Fans, masks, and fish now stick.' },
  { at: 50, main: 'Take the whole picnic.', sub: 'Baskets and paper lanterns now stick.' },
  { at: 75, main: 'Make way for the parade.', sub: 'Drums, rabbits, and stools now stick.' },
  { at: 100, main: 'Small is very big.', sub: 'The garden lights now stick. Find the third wish.' },
];
const QI = [0, 0, 0, 1];

const R = createRenderLayer(kit, { waterY: WATER_Y, moonDir: MOON });
const scene = R.scene;

// ---------------------------------------------------------------- state
let state = 'title', lastState = 'title', collectionReturn = 'title', photoReturn = 'playing', realTime = 0;
let runMode = 'mission', freeMode = false, encore = false;
let player = { x: -15, z: 25, r: START_RADIUS, vr: START_RADIUS, volume: START_RADIUS ** 3, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.identity(), face: [0, -1], boost: 1, boostLock: false, stun: 0 };
let startVolume = START_RADIUS ** 3;
let remaining = MISSION_SECONDS, gameTime = 0, goalMet = false, goalTime = 0, peakCm = 18, wishes = new Set(), largest = null, categoryCounts = {};
let combo = 0, comboTimer = 0, pickupTimer = 0, toastTimer = 0, bumpCooldown = 0, blockedItem = null, blockedTimer = 0;
let camYaw = 0, camYawTarget = 0, camZoom = 1, camLift = 1, walkPhase = 0, celebrateTime = 0, ascend = 0;
let resultSuccess = false, record = false, timeRecord = false, encoreRecord = false, nextStage = 0, trailTimer = 0;
let boosting = false, lastBoost = false, shake = 0, lastSecond = -1, captureNext = false, boostGlow = 0;
let particles = [], floats = [], lastFxTone = -1, uiClock = 0, frameCount = 0, rumbleClock = 0;
let newFinds = 0, dragonCaught = false, dragonReadyShown = false, toastShown = false, pickupShown = false;
const freshIds = new Set();
let eye = [10, 9, 14], look = [0, 1, 0];
const camTarget = [0, 0, 0], camWanted = [0, 0, 0];
const hintState = { shown: false, text: '', x: -1, y: -1 };

// World data
const obstacles = [], envMeshes = [], staticModels = [], hangingLanterns = [], lanternLights = [];
const petals = [], fireflies = [], skyLanterns = [], windmills = [];
let items = [], attachments = [], previewAttachments = [], fireworks = [], waterRipples = [];
let lastFirework = -10, festivalTime = 0, waterWake = 0;

function obstacle(x, z, w, d, lo, hi) { obstacles.push({ x, z, w, d, lo, hi }); }
function bridgeHeight(x) { return Math.max(0, Math.sin(clamp((x - 4) / 16, 0, 1) * PI) * 1.4); }
function inRamp(x, z) { return x > 4 && x < 20 && (Math.abs(z - 8) < 3.1 || Math.abs(z + 15) < 3.1); }
function inWater(x, z) { return x > 7 && x < 17 && z > -29 && z < 29 && !inRamp(x, z); }
function terrain(x, z) { if (inRamp(x, z)) return bridgeHeight(x) + 0.025; if (inWater(x, z)) return -0.46; return 0; }

// ---------------------------------------------------------------- the island
function initRoom() {
  let b = new Builder();
  const ground = new Builder();
  setSeed(19337);
  const paving = R.canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#b6b0ad'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = ['#dbd5ca', '#c9c8c0', '#c8bebb', '#e1d4c6'][(x + y * 3) % 4]; c.fillRect(x * 64 + 2, y * 64 + 2, 59, 59);
      c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(x * 64 + 3, y * 64 + 3, 58, 1);
      for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(62,60,67,.04)'; c.fillRect(x * 64 + rnd() * 60, y * 64 + rnd() * 60, 2, 1); }
    }
  });
  const wood = R.canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = '#d4bca1'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { c.strokeStyle = `rgba(69,58,76,${0.02 + rnd() * 0.07})`; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(80, y + 4, 180, y - 2, 256, y + 1); c.stroke(); }
    for (let y = 0; y < h; y += 32) { c.fillStyle = '#987d78'; c.fillRect(0, y, w, 2); }
  });
  const floor = (x1, z1, x2, z2, c) => ground.quad([x1, 0, z2], [x2, 0, z2], [x2, 0, z1], [x1, 0, z1], c, [0, 1, 0], [[0, 0], [(x2 - x1) / 5, 0], [(x2 - x1) / 5, (z2 - z1) / 5], [0, (z2 - z1) / 5]]);
  floor(-38, -34, 7, 34, '#b4aaba'); floor(17, -34, 38, 34, '#a9bfc0'); floor(7, 29, 17, 34, '#a9b6be'); floor(7, -34, 17, -29, '#a9b6be');
  envMeshes.push(ground.build({ tex: paving, roughness: 0.3, metalness: 0.12, noShadow: true }));
  b.box('#354966', [0, -1.6, 0], [79, 1.4, 71]); b.box('#42627a', [12, -0.91, 0], [10, 0.15, 59]);
  for (const x of [6.83, 17.17]) b.box('#89999f', [x, 0.1, 0], [0.35, 0.25, 58]);
  const water = new Builder();
  water.quad([7, WATER_Y, 29], [17, WATER_Y, 29], [17, WATER_Y, -29], [7, WATER_Y, -29], '#4dc4c6', [0, 1, 0]);
  envMeshes.push(water.build({ water: true, roughness: 0.16, noShadow: true }));
  // Tiny luminous stepping stones along the market avenue.
  for (const x of [-22, -4]) for (let z = -27; z < 30; z += 2.0) b.box('#aa9aab', [x, 0.024, z], [0.16, 0.04, 1.72]);
  for (const z of [8, -15]) {
    for (let i = 0; i < 28; i++) {
      const x = 4 + (i + 0.5) * 16 / 28, y = bridgeHeight(x), slope = (bridgeHeight(x + 0.05) - bridgeHeight(x - 0.05)) / 0.1;
      b.box(i % 2 ? '#bb9191' : '#d0a895', [x, y - 0.1, z], [0.57, 0.2, 6.15], [0, 0, Math.atan(slope)]);
      for (const side of [-1, 1]) {
        if (i % 4 === 0) b.box('#cf888e', [x, y + 0.59, z + side * 3.19], [0.18, 1.32, 0.18]);
        if (i < 27) beam(b, '#bc7b8c', [x, y + 0.91, z + side * 3.19], [x + 16 / 28, bridgeHeight(x + 16 / 28) + 0.91, z + side * 3.19], 0.055);
      }
    }
  }
  // A wood picnic deck and a fan-shaped path, both flush with the floor.
  const deck = new Builder();
  deck.quad([-31, 0.05, -18], [2, 0.05, -18], [2, 0.05, -31], [-31, 0.05, -31], '#c1a89b', [0, 1, 0], [[0, 0], [7, 0], [7, 4], [0, 4]]);
  envMeshes.push(deck.build({ tex: wood, roughness: 0.39, noShadow: true }));
  for (let z = -31; z <= -18; z += 0.85) b.box('#806d80', [-14.5, 0.059, z], [33, 0.012, 0.025]);
  // Festival stalls. Tall counters leave an open, clear main route.
  const sign = (text, sub, x, y, z, w, c) => {
    const tx = R.canvasTexture(512, 160, (ctx, W, H) => {
      ctx.fillStyle = c; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#fae5b2'; ctx.lineWidth = 5; ctx.strokeRect(9, 9, W - 18, H - 18);
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff3d4';
      ctx.font = '900 62px Trebuchet MS,Arial'; ctx.fillText(text, W / 2, 80);
      ctx.font = 'bold 20px Trebuchet MS,Arial'; ctx.fillText(sub, W / 2, 127);
    });
    const q = new Builder();
    q.quad([x - w / 2, y - 0.75, z], [x + w / 2, y - 0.75, z], [x + w / 2, y + 0.75, z], [x - w / 2, y + 0.75, z], '#fff', [0, 0, 1]);
    envMeshes.push(q.build({ tex: tx, emission: 0.18 }));
  };
  const stall = (x, z, palette, label, sub) => {
    b.box('#725b72', [x, 1.43, z], [8.0, 2.8, 4.2]).box('#d7ac8d', [x, 2.94, z + 0.1], [8.4, 0.22, 4.5]);
    for (const xx of [-3.82, 3.82]) for (const zz of [-1.9, 1.9]) b.box('#b98c7f', [x + xx, 3.65, z + zz], [0.22, 7.3, 0.22]);
    for (let i = 0; i < 12; i++) {
      const cx = x - 4.4 + i * 0.8;
      b.box(i % 2 ? palette : '#f5d9b2', [cx, 7.34, z], [0.81, 0.16, 6.7], [-0.14, 0, 0]).box(i % 2 ? palette : '#f5d9b2', [cx, 6.67, z + 3.3], [0.81, 0.75, 0.1]);
    }
    b.box('#634967', [x, 1.45, z + 2.12], [6.9, 1.7, 0.11]);
    sign(label, sub, x, 5.1, z + 2.03, 6.2, palette);
    obstacle(x, z, 8.2, 4.4, 0, 3.05); obstacle(x, z, 9.1, 6.7, 6.4, 7.6);
    for (const xx of [-2.5, 2.5]) hangingLanterns.push({ x: x + xx, y: 4.5, z: z + 3.35, s: 0.65, phase: rnd() * TAU });
    lanternLights.push({ p: [x, 4.2, z + 3.2], c: [5.5, 2.3, 1.0], r: 12, key: 0 });
    const p = P[label === 'DANGO' ? 'dango' : label === 'MOON SODA' ? 'can' : 'fishbag'];
    for (let i = 0; i < 5; i++) staticModels.push({ def: p.mesh, x: x - 2.7 + i * 1.3, y: 3.06 + p.height / 2, z: z + 1.2, q: Q.euler(0, 0.15, 0), s: 1 });
  };
  stall(-25, -26, '#ac607e', 'DANGO', 'THREE LITTLE MOONS'); stall(-11, -26, '#568d9a', 'MOON SODA', 'OPEN UNTIL THE STARS');
  // A low lantern stage in the garden. The front edge is an easy ramp.
  for (let x = 20; x < 35; x += 0.9) b.box('#b2aaa8', [x, 0.14, -25], [0.84, 0.28, 7.4]);
  // The moon gate frames the eastern garden, without closing the canal.
  for (const x of [22, 33]) { b.cyl('#ca808f', [x, 4.9, -20], 0.39, 0.5, 9.8, [], 8).cyl('#53627a', [x, 0.55, -20], 0.62, 0.72, 1.1, [], 8); obstacle(x, -20, 1.0, 1.0, 0, 10.2); }
  b.box('#ca8195', [27.5, 8.3, -20], [13.5, 0.42, 0.45]); b.box('#e8a78f', [27.5, 9.75, -20], [15.7, 0.38, 0.78]);
  for (const x of [-1, 1]) b.box('#e3a6a2', [27.5 + x * 7.3, 10.08, -20], [2.4, 0.4, 0.78], [0, 0, x * 0.18]);
  b.box('#664b73', [27.5, 8.95, -19.7], [1.48, 1.6, 0.2]); b.star('#efd59b', [27.5, 8.97, -19.55], 0.75);
  sign('LANTERN TIDE', 'MAKE A LITTLE LIGHT', 27.5, 5.75, -28.85, 8.4, '#626c94');
  // Rounded hedges, stone path, and a miniature pond garden.
  for (let z = -16; z < 27; z += 4) b.cyl('#b9c9b7', [27 + Math.sin(z * 0.17) * 2, 0.035, z], 1.35, 1.4, 0.07, [], 9);
  for (let i = 0; i < 15; i++) { const a = i * 0.65, x = 28 + Math.cos(a) * 5.5, z = 16 + Math.sin(a) * 4.3; b.sphere(i % 2 ? '#729c9b' : '#94b9a8', [x, 0.18, z], [0.65, 0.28, 0.5]); }
  // Paper banners around the island. The open front keeps the camera clear.
  for (let x = -36; x < 37; x += 4.5) {
    b.box('#536881', [x, 1.6, -33], [0.14, 3.2, 0.14]);
    beam(b, '#b9a6a2', [x, 2.6, -33], [x + 4.5, 2.6, -33], 0.027);
    if (x < 32) b.cyl(x % 2 ? '#e997aa' : '#dfc085', [x + 2.2, 2.26, -33], 0.48, 0.48, 0.025, [PI / 2, 0, 0], 3);
  }
  // A hand-made entry board anchors the first view from the player.
  b.box('#6c667c', [-21, 2.0, 23], [0.14, 4, 0.15]).box('#6c667c', [-15, 2.0, 23], [0.14, 4, 0.15]);
  sign('SMALL IS BIG', 'FOLLOW THE LITTLE LIGHTS', -18, 3.28, 23, 6.7, '#758192');
  envMeshes.push(b.build({ roughness: 0.52 }));
  // Cherry trees use reusable clusters and real shadow silhouettes.
  const trunk = new Builder();
  trunk.cyl('#80758a', [0, 3.1, 0], 0.18, 0.53, 6.2, [], 8);
  for (let i = 0; i < 5; i++) { const a = i * 2.4; beam(trunk, '#837388', [0, 3.4 + i * 0.3, 0], [Math.sin(a) * 2.2, 6.4 + (i % 2) * 0.8, Math.cos(a) * 2], 0.14); }
  const tm = trunk.build();
  const flowers = new Builder();
  for (let i = 0; i < 22; i++) { const a = i * 2.39996, r = 1.0 + (i % 4) * 0.77; flowers.sphere(['#e8abc6', '#f3c0d1', '#c890b7', '#d798c0'][i % 4], [Math.cos(a) * r, 6.6 + Math.sin(i * 0.9) * 0.85, Math.sin(a) * r * 0.83], [1.5, 1.04, 1.4]); }
  const fm = flowers.build({ roughness: 0.91, emission: 0.055 });
  for (const [x, z, s] of [[-35, 20, 1.1], [-34, 0, 1.14], [-34, -17, 0.95], [33, 26, 1.0], [33, 0, 1.06], [36, -29, 1.18], [22, -31, 0.88], [-3, -33, 1.04]]) {
    const q = Q.euler(0, rnd() * 6, 0);
    staticModels.push({ def: tm, x, y: 0, z, q, s }, { def: fm, x, y: 0, z, q, s });
    obstacle(x, z, 0.9 * s, 0.9 * s, 0, 6 * s);
    lanternLights.push({ p: [x, 2.8, z], c: [1.1, 1.7, 2.5], r: 7, key: 0 });
  }
  // Catenary strings, hanging light, and a few windmills.
  const wires = new Builder();
  for (const [z, y] of [[18, 12.5], [-3, 13], [-21, 14]]) {
    for (const x of [-34, 34]) wires.cyl('#6d758d', [x, y / 2 + 0.3, z], 0.08, 0.16, y + 0.6, [], 7);
    for (let i = 0; i < 46; i++) {
      const x = -34 + i * 68 / 46, x2 = -34 + (i + 1) * 68 / 46, yy = y - 2.4 * (1 - (x / 34) ** 2), yy2 = y - 2.4 * (1 - (x2 / 34) ** 2);
      beam(wires, '#7f8296', [x, yy, z], [x2, yy2, z], 0.018);
    }
    for (let i = 0; i < 14; i++) {
      const x = -31 + i * 62 / 13, yy = y - 2.4 * (1 - (x / 34) ** 2);
      beam(wires, '#a09aa6', [x, yy, z], [x, yy - 0.62, z], 0.018);
      hangingLanterns.push({ x, y: yy - 1.3, z, s: i % 3 === 0 ? 1 : 0.75, phase: rnd() * TAU });
      lanternLights.push({ p: [x, yy - 1.7, z], c: i % 3 === 1 ? [3.9, 1.45, 2.2] : [5.0, 2.8, 1.12], r: 13, key: 0 });
    }
  }
  for (const [x, z] of [[-6, 15], [3, -8], [23, 19]]) { wires.cyl('#958191', [x, 2.1, z], 0.038, 0.07, 4.2, [], 7); windmills.push({ x, z, phase: rnd() * TAU }); }
  envMeshes.push(wires.build());
  for (let i = 0; i < 115; i++) petals.push({ x: between(-38, 38), z: between(-33, 33), y: between(0.3, 14), p: rnd() * TAU, s: between(0.7, 1.8) });
  for (let i = 0; i < 62; i++) fireflies.push({ x: between(3, 36), z: between(-31, 30), y: between(0.5, 3.2), p: rnd() * TAU });
  for (let i = 0; i < 14; i++) skyLanterns.push({ x: between(-45, 42), z: between(-62, -20), y: between(15, 30), p: rnd() * TAU, s: between(0.6, 1.3) });
}

// ---------------------------------------------------------------- items
function clearSpot(x, z, rad = 0.4) {
  if (x < -36 + rad || x > 36 - rad || z < -31.5 + rad || z > 31.5 - rad) return false;
  if (x > 5.9 - rad && x < 18.1 + rad && z > -30 && z < 30) return false;
  if (Math.hypot(x + 15, z - 25) < 1.7 + rad) return false;
  for (const o of obstacles) { if (o.lo > 1) continue; if (Math.abs(x - o.x) < o.w / 2 + rad && Math.abs(z - o.z) < o.d / 2 + rad) return false; }
  return true;
}
const tq = [0, 0, 0, 1];
function composeItem(it) {
  eulerInto(tq, 0, it.yaw, 0);
  writeTRS(it.m, 0, it.x, it.y, it.z, tq[0], tq[1], tq[2], tq[3]);
}
function spawn(id, x, z, base = 0, opts = {}) {
  const p = P[id];
  const it = { p, x, z, base, y: base + p.height / 2 + 0.025, yaw: between(-PI, PI), collected: false, need: p.need, volume: p.volume, cooldown: 0, phase: rnd() * TAU, ...opts };
  it.m = new Float32Array(16);
  it.baseYaw = it.yaw;
  composeItem(it);
  items.push(it);
  return it;
}
function placeRandom(id, n, zone) {
  const p = P[id];
  for (let i = 0; i < n; i++) {
    let x = 0, z = 0, ok = false;
    for (let k = 0; k < 180; k++) {
      if (zone) { x = between(zone.x1, zone.x2); z = between(zone.z1, zone.z2); } else { x = between(-34, 34); z = between(-30, 31); }
      if (!clearSpot(x, z, p.radius * 0.85)) continue;
      if ([[-29, 8, 30], [12, -15, 65], [28, 15, 100]].some((w) => p.need > w[2] && Math.hypot(x - w[0], z - w[1]) < w[2] / 20 * 0.9 + p.radius * 0.65 + 0.6)) continue;
      if (p.need > 25 && x > -18 && x < -11 && z > 9) continue;
      if (items.some((it) => !it.base && Math.hypot(x - it.x, z - it.z) < (p.radius + it.p.radius) * 0.74)) continue;
      ok = true;
      break;
    }
    if (ok) spawn(id, x, z);
  }
}
function buildItems() {
  items = [];
  setSeed(29022);
  waterRipples = [];
  fireworks = [];
  lastFirework = -10;
  const south = { x1: -30, x2: 3, z1: 3, z2: 31 }, west = { x1: -32, x2: 4, z1: -19, z2: 26 }, north = { x1: -32, x2: 4, z1: -19, z2: 4 }, east = { x1: 19, x2: 35, z1: -28, z2: 29 };
  // A broad double trail ensures that the first minute is a clear size ladder.
  for (let i = 0; i < 25; i++) {
    const z = 23.3 - i * 0.64, x = -15 + Math.sin(i * 0.37) * 1.05;
    spawn(['dango', 'mochi', 'rice', 'candy', 'coin'][i % 5], x, z, 0, { yaw: i * 0.6 });
    if (i % 2 === 0) spawn(i % 4 ? 'cookie' : 'mochi', x - 1.0, z - 0.25);
  }
  for (let i = 0; i < 12; i++) { const x = -14 + i * 1.2; spawn(i < 5 ? 'fishcake' : i < 9 ? 'bento' : 'lantern', x, 6 + Math.sin(i * 0.7) * 1.2, 0, { yaw: i * 0.24 }); }
  for (const [id, n] of [['mochi', 24], ['dango', 24], ['rice', 18], ['candy', 14], ['coin', 10], ['fishcake', 17], ['berry', 10], ['sushi', 10], ['cookie', 15], ['fan', 12], ['fishbag', 14], ['mask', 12], ['pinwheel', 10], ['orange', 10], ['block0', 8], ['block1', 8], ['die', 10], ['can', 11], ['duck', 10], ['mug', 8], ['ball', 8]]) placeRandom(id, n, south);
  for (const [id, n] of [['lantern', 30], ['bento', 20], ['melon', 18], ['basket', 14], ['luckycat', 13], ['drum', 10], ['stool', 7], ['bunny', 10], ['shrub', 8], ['parasol', 7], ['teddy', 10], ['teapot', 8], ['carton', 8], ['robot', 6], ['plant', 7], ['pillow', 7], ['book', 9], ['slipper', 6], ['biscuits', 8]]) placeRandom(id, n, west);
  for (const [id, n] of [['luckycat', 8], ['drum', 7], ['bunny', 6], ['stool', 6], ['shrub', 5], ['parasol', 4], ['frog', 4], ['cooler', 5], ['lampstand', 4], ['bench', 3], ['cart', 2]]) placeRandom(id, n, north);
  for (const [id, n] of [['basket', 6], ['lantern', 7], ['luckycat', 7], ['drum', 7], ['bunny', 5], ['shrub', 6], ['frog', 5], ['cooler', 5], ['lampstand', 6], ['bench', 4], ['cart', 3], ['parasol', 6], ['melon', 7], ['stool', 6]]) placeRandom(id, n, east);
  for (const [z, ids] of [[8, ['lantern', 'basket', 'bento', 'luckycat', 'lantern']], [-15, ['lantern', 'basket', 'dango', 'drum', 'lantern']]]) for (let i = 0; i < 5; i++) { const x = 5 + i * 3.5; spawn(ids[i], x, z, bridgeHeight(x) + 0.04, { yaw: 0 }); }
  spawn('wish', -29, 8, 0, { wish: 0, need: 30, volume: 1.4 });
  spawn('wish', 12, -15, bridgeHeight(12) + 0.04, { wish: 1, need: 65, volume: 8 });
  spawn('wish', 28, 15, 0, { wish: 2, need: 100, volume: 18 });
  spawn('dragon', 28, -27.8, 0, { need: DRAGON_CM, yaw: 0, dance: true });
  spawn('cat', -23, -12, 0, { hazard: true, need: 55, home: [-23, -12], yaw: 0.4 });
  spawn('bunny', 25, 19, 0, { moving: true, home: [25, 19], yaw: 0 });
  spawn('bunny', -9, 0, 0, { moving: true, home: [-9, 0], yaw: 0 });
  // New for this pass (placed last, so the original layout above stays exactly the same):
  // paper lanterns drifting down the canal, and a few more little things around the island.
  for (let i = 0; i < 12; i++) {
    const lane = 8.4 + (i % 4) * 2.4 + between(-0.3, 0.3), z = 27 - i * 4.6 + between(-0.8, 0.8);
    spawn('lanternboat', lane, z, WATER_Y - 0.1, { float: true, lane, flow: between(0.8, 1.2) });
  }
  for (const [id, n] of [['crane', 14], ['yoyo', 10], ['kendama', 8]]) placeRandom(id, n, south);
  for (const [id, n] of [['kendama', 4], ['shavedice', 12]]) placeRandom(id, n, west);
  placeRandom('koi', 3, north);
  placeRandom('koi', 3, east);
  for (const [id, n] of [['button', 6], ['pencil', 6], ['eraser', 6], ['spool', 6], ['block2', 6], ['car', 6], ['plate', 5]]) placeRandom(id, n, south);
  placeRandom('clock', 5, west);
  indexItems();
  return items.length;
}

// ---------------------------------------------------------------- the three.js scene
let batchesReady = false;
const ballGroup = new THREE.Group();
scene.add(ballGroup);
let ballObj = null, avatar = null, avBody = null, avHead = null;
const avArms = [], avLegs = [];
let stringBatch, skyBatch, windBatch, petalBatch, fireflyBatch, markerBatch, itemShadowBatch, playerShadowBatch;
const sparkBatches = [];
let petalCount = 115, fireflyCount = 62;
const playerLight = { p: [0, 0, 0], c: [0.65, 1.7, 1.45], r: 6, key: 0 };
const lightCandidates = [];

function indexItems() {
  if (!batchesReady) return;
  for (const id of ORDER) { P[id].list.length = 0; P[id].dirty = true; }
  for (const it of items) it.p.list.push(it);
}

function createSceneObjects() {
  for (const def of envMeshes) R.mesh(def);
  // Static props (stall displays, cherry trees): one instanced draw per model.
  const groups = new Map();
  for (const s of staticModels) { if (!groups.has(s.def)) groups.set(s.def, []); groups.get(s.def).push(s); }
  for (const [def, list] of groups) {
    const bt = R.batch(def, list.length);
    bt.begin();
    for (const s of list) bt.push(s.x, s.y, s.z, s.q, s.s);
    bt.end();
  }
  // Every item model draws twice: lying in the world, and stuck to the ball.
  const counts = {};
  for (const it of items) counts[it.p.id] = (counts[it.p.id] || 0) + 1;
  for (const id of ORDER) {
    const p = P[id], cap = (counts[id] || 0) + 26;
    p.world = R.batch(p.mesh, cap);
    p.held = R.batch(p.mesh, cap, ballGroup);
    p.list = [];
    p.heldList = [];
    p.dirty = true;
  }
  batchesReady = true;
  indexItems();
  ballObj = R.mesh(MESH.ball, ballGroup);
  avatar = new THREE.Group();
  scene.add(avatar);
  avBody = R.mesh(MESH.avatarBody, avatar);
  avHead = R.mesh(MESH.avatarHead, avatar);
  for (let k = 0; k < 2; k++) { avArms.push(R.mesh(MESH.avatarArm, avatar)); avLegs.push(R.mesh(MESH.avatarLeg, avatar)); }
  for (const o of [avBody, avHead, ...avArms, ...avLegs]) o.rotation.order = 'YXZ';
  stringBatch = R.batch(MESH.stringLantern, hangingLanterns.length);
  skyBatch = R.batch(MESH.skyLantern, skyLanterns.length);
  windBatch = R.batch(MESH.windmill, windmills.length);
  petalBatch = R.batch(MESH.petal, petals.length, scene, { layer: LAYER_NO_REFLECT });
  fireflyBatch = R.batch(MESH.firefly, fireflies.length, scene, { layer: LAYER_NO_REFLECT });
  for (const def of MESH.sparks) sparkBatches.push(R.batch(def, 460));
  // The objective rings under the moon wishes (and the dragon in the encore).
  const mk = new Builder();
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * TAU, d = (i + 1) / 40 * TAU;
    mk.quad([Math.cos(a), 0, Math.sin(a)], [Math.cos(d), 0, Math.sin(d)], [Math.cos(d) * 0.91, 0, Math.sin(d) * 0.91], [Math.cos(a) * 0.91, 0, Math.sin(a) * 0.91], [0.98, 0.78, 0.48, 0.75], [0, 1, 0]);
  }
  markerBatch = R.batch(mk.build({ emission: 1.7, transparent: true, unlit: true, doubleSided: true, noShadow: true }), 8);
  // Soft contact shadows under items and the ball.
  const shadowTex = R.canvasTexture(96, 96, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,.6)'); g.addColorStop(0.38, 'rgba(255,255,255,.26)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const blob = (alpha) => new Builder().quad([-1, 0, 1], [1, 0, 1], [1, 0, -1], [-1, 0, -1], [0.024, 0.045, 0.082, alpha], [0, 1, 0]).build({ tex: shadowTex, transparent: true, unlit: true, doubleSided: true, noShadow: true });
  itemShadowBatch = R.batch(blob(0.22), items.length + 16, scene, { layer: LAYER_NO_REFLECT });
  playerShadowBatch = R.batch(blob(0.31), 1, scene, { layer: LAYER_NO_REFLECT });
  applyDetail();
}
function applyDetail() {
  petalCount = Math.min(petals.length, kit.detail(petals.length));
  fireflyCount = Math.min(fireflies.length, kit.detail(fireflies.length));
}

// ---------------------------------------------------------------- the ball and what it carries
const tmp3 = [0, 0, 0];
let heldVr = -1;
function heldPosition(a, vr, out) {
  const end = vr * 0.94;
  if (a.start && a.age < 0.18) {
    let t = clamp(a.age / 0.18, 0, 1);
    t = 1 - (1 - t) ** 3;
    out[0] = lerp(a.start[0], a.dir[0] * end, t); out[1] = lerp(a.start[1], a.dir[1] * end, t); out[2] = lerp(a.start[2], a.dir[2] * end, t);
  } else {
    out[0] = a.dir[0] * end; out[1] = a.dir[1] * end; out[2] = a.dir[2] * end;
  }
  return out;
}
function heldList() { return state === 'title' ? previewAttachments : attachments; }
function writeHeld(a) {
  const b = a.p.held;
  if (a.slot >= b.capacity) return;
  a.settled = !a.start || a.age >= 0.18;
  heldPosition(a, player.vr, tmp3);
  const s = a.scale || 1;
  writeTRS(b.array, a.slot * 16, tmp3[0], tmp3[1], tmp3[2], a.rot[0], a.rot[1], a.rot[2], a.rot[3], s, s, s);
}
function rebuildHeld() {
  if (!batchesReady) return;
  for (const id of ORDER) P[id].heldList.length = 0;
  for (const a of heldList()) { a.slot = a.p.heldList.length; a.p.heldList.push(a); }
  for (const id of ORDER) {
    const p = P[id], b = p.held;
    for (const a of p.heldList) writeHeld(a);
    b.n = Math.min(p.heldList.length, b.capacity);
    b.end();
  }
  heldVr = player.vr;
}
function addHeld(a) {
  const p = a.p, b = p.held;
  a.slot = p.heldList.length;
  p.heldList.push(a);
  if (a.slot < b.capacity) { writeHeld(a); b.n = a.slot + 1; b.end(); }
}
function updateHeld() {
  const resize = Math.abs(player.vr - heldVr) > 0.0005;
  for (const a of heldList()) {
    if (!resize && a.settled) continue;
    const b = a.p.held;
    if (a.slot >= b.capacity) continue;
    a.settled = !a.start || a.age >= 0.18;
    heldPosition(a, player.vr, tmp3);
    const o = a.slot * 16;
    b.array[o + 12] = tmp3[0]; b.array[o + 13] = tmp3[1]; b.array[o + 14] = tmp3[2];
    b.touch();
  }
  if (resize) heldVr = player.vr;
}
function playerCenter() { return [player.x, player.floor + player.vr + ascend, player.z]; }

// ---------------------------------------------------------------- game flow
function modeCopy() {
  if (encore) return { title: 'CATCH THE PAPER DRAGON', text: `${DRAGON_CM} cm`, from: 'Grow to →' };
  return { title: 'LIGHT UP THE NIGHT', text: `${GOAL_CM} cm`, from: 'Little things →' };
}
function start(kind = 'mission') {
  Sound.init();
  runMode = kind;
  freeMode = kind === 'free';
  encore = kind === 'encore';
  state = 'playing';
  $('photoUI').classList.remove('show');
  remaining = encore ? ENCORE_SECONDS : MISSION_SECONDS;
  gameTime = 0; lastFxTone = -1; lastSecond = -1; goalMet = false; goalTime = 0;
  const r0 = encore ? ENCORE_RADIUS : START_RADIUS;
  startVolume = r0 ** 3;
  peakCm = r0 * 20; wishes = new Set(); largest = null; categoryCounts = {};
  combo = 0; comboTimer = 0; pickupTimer = 0; toastTimer = 0; bumpCooldown = 0; blockedItem = null; blockedTimer = 0; trailTimer = 0; ascend = 0;
  nextStage = STAGES.findIndex((s) => s.at > r0 * 20);
  if (nextStage < 0) nextStage = STAGES.length;
  particles = []; floats = []; attachments = []; previewAttachments = [];
  newFinds = 0; freshIds.clear(); dragonCaught = false; dragonReadyShown = false; boosting = false; record = false; timeRecord = false; encoreRecord = false;
  buildItems();
  player = { x: -15, z: encore ? 27.5 : 25, r: r0, vr: r0, volume: startVolume, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.identity(), face: [0, -1], boost: 1, boostLock: false, stun: 0 };
  rebuildHeld();
  camYaw = camYawTarget = 0.02; camLift = camZoom = 1;
  eye = [-14.8, 6.4 + (encore ? 4 : 0), 34.4 + (encore ? 4 : 0)]; look = [-15, 0.8, 23.6];
  $('menu').classList.add('gone');
  $('hud').classList.add('on');
  for (const s of document.querySelectorAll('.shade')) s.classList.remove('show');
  $('pickup').classList.remove('show');
  pickupShown = false;
  $('sendStar').classList.remove('show');
  const copy = modeCopy();
  $('goalTitle').textContent = copy.title; $('goalText').textContent = copy.text; $('goalFrom').textContent = copy.from;
  $('obstacleHint').style.display = 'none';
  hintState.shown = false;
  if (encore) notify('Encore: the dragon parade.', `Grow to ${DRAGON_CM} cm and roll up the paper dragon by the moon gate. 4:30 on the clock.`, 5);
  else notify(freeMode ? 'The night is yours.' : 'Welcome to Lantern Tide.', freeMode ? 'No timer. Follow the dango trail.' : 'Reach 120 cm in 5 minutes. Follow the dango trail.', 4.7);
  updateHUD();
  canvas.focus({ preventScroll: true });
  if (!reduced) canvas.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 550 });
  Sound.effect('start');
  input.settle();
  syncTouch();
}
function notify(title, sub = '', duration = 3.2) {
  const t = $('toast');
  t.textContent = title;
  if (sub) { const small = document.createElement('small'); small.textContent = sub; t.append(small); }
  t.classList.add('show');
  toastShown = true;
  toastTimer = duration;
}
function hideToast() { $('toast').classList.remove('show'); toastShown = false; }
function collect(it) {
  if (it.collected || it.cooldown > 0) return;
  const inv = Q.inv(player.q), worldCenter = [player.x, player.floor + player.r, player.z];
  const rel = V.sub([it.x, it.y, it.z], worldCenter), local = Q.rot(inv, rel);
  let dir = V.norm(local);
  if (V.len(local) < 0.02) dir = [0, 0, 1];
  combo = comboTimer > 0 ? combo + 1 : 1;
  comboTimer = 2.8;
  const gain = it.volume * 0.44 * (1 + Math.min(combo, 12) * 0.01);
  it.collected = true;
  it.p.dirty = true;
  const a = { item: it, p: it.p, dir, rot: Q.mul(inv, Q.euler(0, it.yaw, 0)), start: local, age: 0, gain, scale: 1, slot: 0 };
  attachments.push(a);
  addHeld(a);
  player.volume += gain;
  player.r = Math.cbrt(player.volume);
  peakCm = Math.max(peakCm, player.r * 20);
  categoryCounts[it.p.group] = (categoryCounts[it.p.group] || 0) + 1;
  if (!largest || it.need > largest.need) largest = it;
  const id = it.p.id;
  if (!save.found[id]) { newFinds++; freshIds.add(id); }
  save.found[id] = (save.found[id] || 0) + 1;
  saveDirty = true;
  const special = it.wish !== undefined, dragon = id === 'dragon';
  if (special) {
    wishes.add(it.wish);
    launchFirework(it.x, it.z - 5, true);
    Sound.effect('wish');
    input.rumble(0.5, 180);
    notify('A moon wish!', `${wishes.size} of 3 found. A new light in the sky.`, 3.2);
  } else if (dragon) {
    dragonCaught = true;
    save.dragon = true;
    launchFirework(it.x - 6, it.z - 6, true); launchFirework(it.x + 6, it.z - 8, true); launchFirework(it.x, it.z - 12, true);
    Sound.effect('dragon');
    input.rumble(0.9, 420);
    notify('The paper dragon joins the parade!', encore ? 'The encore is yours.' : 'The whole night market is rolling with you now.', 4);
  } else if (gameTime - lastFxTone > 0.06) {
    Sound.pickup(combo);
    lastFxTone = gameTime;
    if (gameTime - rumbleClock > 0.12) { rumbleClock = gameTime; input.rumble(Math.min(0.35, 0.08 + it.need * 0.002), 35); }
  }
  const col = it.p.group === 'snacks' ? '#efd16b' : it.p.group === 'toys' ? '#e8a5ba' : '#b8d59e';
  burst([it.x, it.y, it.z], col, special || dragon ? 24 : 7, 1);
  if (combo < 3 || combo % 4 === 0) floatText(it.p.name, [it.x, it.y + 0.3, it.z], special ? '#e3ab54' : '#fff6dc');
  $('pickupImg').src = thumbFor(it.p);
  $('pickupName').textContent = it.p.name;
  $('pickupNote').textContent = it.p.note;
  $('pickup').classList.add('show');
  pickupShown = true;
  pickupTimer = 4.2;
  if (!reduced) $('sizeBadge').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.055)' }, { transform: 'scale(1)' }], { duration: 250 });
  const cm = player.r * 20;
  let goalNow = false;
  if (!encore && cm >= GOAL_CM && !goalMet) { meetGoal(); goalNow = true; }
  // Stages advance together, so a big catch that skips one never shows a stale message later.
  let st = null;
  while (nextStage < STAGES.length && cm >= STAGES[nextStage].at) st = STAGES[nextStage++];
  if (st && !goalNow) { if (!special && !dragon) notify(st.main, st.sub, 3); Sound.effect('grow'); }
  if (encore && !dragonCaught && !dragonReadyShown && cm >= DRAGON_CM) {
    dragonReadyShown = true;
    notify('Big enough for the dragon!', 'It dances by the moon gate, in the lantern garden.', 3.8);
    Sound.effect('grow');
  }
  if (dragon && encore) finish(true);
}
function dropSpotBlocked(x, z, rad) {
  for (const o of obstacles) { if (o.lo > 1) continue; if (Math.abs(x - o.x) < o.w / 2 + rad && Math.abs(z - o.z) < o.d / 2 + rad) return true; }
  return false;
}
/** Where a knocked-off item lands: behind the ball, but never inside a stall, gate post or tree. */
function dropSpot(angle, dist, rad) {
  for (let k = 0; k < 9; k++) {
    const a = angle + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.5;
    const x = clamp(player.x + Math.sin(a) * dist, -35.5, 35.5), z = clamp(player.z + Math.cos(a) * dist, -31.5, 31.5);
    if (!dropSpotBlocked(x, z, rad)) return [x, z];
  }
  return [clamp(player.x, -35.5, 35.5), clamp(player.z, -31.5, 31.5)];
}
function knockOff(amount = 1) {
  let lost = 0;
  for (let i = attachments.length - 1; i >= 0 && lost < amount; i--) {
    const a = attachments[i], it = a.item;
    if (it.wish !== undefined || it.p.id === 'dragon') continue;
    attachments.splice(i, 1);
    player.volume = Math.max(startVolume, player.volume - a.gain);
    it.collected = false;
    it.p.dirty = true;
    const angle = Math.atan2(player.face[0], player.face[1]) + PI + between(-0.9, 0.9), d = player.r + it.p.radius + 1.1;
    const spot = dropSpot(angle, d, it.p.radius * 0.8);
    it.x = spot[0]; it.z = spot[1];
    it.base = terrain(it.x, it.z);
    it.float = it.p.id === 'lanternboat' && inWater(it.x, it.z);
    if (it.float) { it.base = WATER_Y - 0.1; it.lane = clamp(it.x, 7.7, 16.3); }
    // Wanderers keep wandering where they fell instead of jumping back home.
    if (it.home) it.home = [it.x, it.z];
    it.y = it.base + it.p.height / 2 + 0.025;
    it.cooldown = 1.5;
    it.yaw = between(-PI, PI);
    composeItem(it);
    categoryCounts[it.p.group] = Math.max(0, (categoryCounts[it.p.group] || 0) - 1);
    lost++;
  }
  player.r = Math.cbrt(player.volume);
  combo = 0; comboTimer = 0;
  if (lost) {
    rebuildHeld();
    input.rumble(0.7, 220);
    notify('A little bump.', `${lost === 1 ? 'One thing fell' : lost + ' things fell'} off. Roll back to get ${lost === 1 ? 'it' : 'them'}.`, 2.8);
  }
}
function impact(it, speed) {
  if (bumpCooldown > 0) return;
  bumpCooldown = 0.9;
  player.stun = 0.12;
  if (!reduced) shake = Math.min(0.13, speed * 0.012);
  Sound.effect('bump');
  input.rumble(Math.min(0.6, 0.2 + speed * 0.05), 110);
  if (it) {
    blockedItem = it; blockedTimer = 1.7;
    if (it.hazard && speed > 1.6) knockOff(3);
    else if (boosting && speed > 5.0) knockOff(1);
  } else if (boosting && speed > 5.7 && attachments.length > 3) knockOff(1);
}
function pushFromBox(o) {
  const r = player.r * 0.88;
  if (player.floor + player.r * 2 < o.lo + 0.03 || player.floor + 0.1 > o.hi) return false;
  const px = clamp(player.x, o.x - o.w / 2, o.x + o.w / 2), pz = clamp(player.z, o.z - o.d / 2, o.z + o.d / 2);
  const dx = player.x - px, dz = player.z - pz, dist = Math.hypot(dx, dz);
  let nx, nz;
  if (dist >= r) return false;
  if (dist < 0.0001) {
    const sides = [{ v: player.x - (o.x - o.w / 2), nx: -1, nz: 0 }, { v: o.x + o.w / 2 - player.x, nx: 1, nz: 0 }, { v: player.z - (o.z - o.d / 2), nx: 0, nz: -1 }, { v: o.z + o.d / 2 - player.z, nx: 0, nz: 1 }].sort((a, b) => a.v - b.v);
    nx = sides[0].nx; nz = sides[0].nz;
    player.x += nx * (r + sides[0].v + 0.003);
    player.z += nz * (r + sides[0].v + 0.003);
  } else {
    nx = dx / dist; nz = dz / dist;
    player.x += nx * (r - dist + 0.003);
    player.z += nz * (r - dist + 0.003);
  }
  const dot = player.vx * nx + player.vz * nz;
  if (dot < 0) { player.vx -= nx * dot * 1.08; player.vz -= nz * dot * 1.08; if (-dot > 1.5) impact(null, -dot); }
  return true;
}
const ctl = { x: 0, y: 0, boost: false };
function readControls() {
  const v = input.vector('move');
  ctl.x = v.x; ctl.y = v.y; ctl.boost = input.down('boost');
  return ctl;
}
function updateGame(dt, c) {
  gameTime += dt;
  if (!freeMode) remaining -= dt;
  bumpCooldown = Math.max(0, bumpCooldown - dt); blockedTimer -= dt; player.stun = Math.max(0, player.stun - dt);
  comboTimer -= dt; trailTimer -= dt;
  const ix = c.x, iz = c.y, len = Math.hypot(ix, iz);
  if (!c.boost || player.boost > 0.65) player.boostLock = false;
  boosting = c.boost && !player.boostLock && len > 0.1 && player.boost > 0.025 && player.stun <= 0;
  if (boosting) { player.boost = Math.max(0, player.boost - dt * 0.3); if (player.boost === 0) player.boostLock = true; }
  else player.boost = Math.min(1, player.boost + dt * 0.22);
  const maxSpeed = (4.25 + player.r * 0.88) * (boosting ? 1.78 : 1) * (inWater(player.x, player.z) ? (player.r > 3 ? 0.88 : 0.66) : 1);
  const sn = Math.sin(camYaw), cs = Math.cos(camYaw);
  let vx = (ix * cs - iz * sn) * maxSpeed, vz = (-ix * sn - iz * cs) * maxSpeed;
  if (player.stun > 0) { vx = 0; vz = 0; }
  const k = 1 - Math.exp(-dt * (len > 0.1 ? 5.8 : 7.8));
  player.vx = lerp(player.vx, vx, k);
  player.vz = lerp(player.vz, vz, k);
  const oldX = player.x, oldZ = player.z, speed = Math.hypot(player.vx, player.vz);
  let nx = oldX + player.vx * dt, nz = oldZ + player.vz * dt, ground = terrain(nx, nz);
  const step = 0.16 + player.r * 0.31;
  if (ground > player.floor + step && player.vy <= 0) {
    const gx = terrain(nx, oldZ), gz = terrain(oldX, nz);
    if (gx <= player.floor + step) nz = oldZ; else if (gz <= player.floor + step) nx = oldX; else { nx = oldX; nz = oldZ; }
    ground = terrain(nx, nz);
  }
  player.x = clamp(nx, -37.5 + player.r * 0.82, 37.5 - player.r * 0.82);
  player.z = clamp(nz, -33.5 + player.r * 0.82, 33.5 - player.r * 0.82);
  if ((player.x !== nx || player.z !== nz) && speed > 3) impact(null, speed);
  if (ground >= player.floor - 0.12 && ground <= player.floor + step + 0.05) { player.floor = ground; player.vy = 0; }
  else { player.vy -= 12 * dt; player.floor += player.vy * dt; if (player.floor < ground) { player.floor = ground; player.vy = 0; } }
  for (const o of obstacles) pushFromBox(o);
  for (const it of items) {
    if (it.collected) continue;
    it.cooldown = Math.max(0, it.cooldown - dt);
    if (it.hazard) {
      const a = gameTime * 0.27 + it.phase, px = it.x, pz = it.z;
      it.x = it.home[0] + Math.sin(a) * 1.25; it.z = it.home[1] + Math.cos(a * 0.72) * 0.74;
      it.yaw = Math.atan2(it.x - px, it.z - pz);
      it.y = it.base + it.p.height / 2 + 0.045 + Math.abs(Math.sin(gameTime * 1.2)) * 0.035;
      composeItem(it); it.p.dirty = true;
    } else if (it.moving) {
      const a = gameTime * 0.52 + it.phase, px = it.x, pz = it.z;
      it.x = it.home[0] + Math.sin(a) * 1.12; it.z = it.home[1] + Math.cos(a) * 0.62;
      it.yaw = Math.atan2(it.x - px, it.z - pz) + PI / 2;
      composeItem(it); it.p.dirty = true;
    }
    const dy = Math.abs(player.floor + player.r - it.y);
    if (dy > player.r + it.p.height * 0.49 + 0.1) continue;
    const dx = player.x - it.x, dz = player.z - it.z, d = Math.hypot(dx, dz), pick = player.r * 1.03 + it.p.radius * 0.66;
    if (d > pick + 0.15) continue;
    if (player.r * 20 + 0.015 >= it.need) { if (d < pick && it.cooldown <= 0) collect(it); }
    else {
      const contact = player.r * 0.89 + it.p.radius * 0.64;
      if (d < contact) {
        const ax = d > 0.001 ? dx / d : 1, az = d > 0.001 ? dz / d : 0;
        player.x += ax * (contact - d + 0.004);
        player.z += az * (contact - d + 0.004);
        const dot = player.vx * ax + player.vz * az;
        if (dot < 0) { player.vx -= ax * dot * 1.12; player.vz -= az * dot * 1.12; if (-dot > 0.85) impact(it, -dot); }
        blockedItem = it; blockedTimer = 1.0;
      }
    }
  }
  const dx = player.x - oldX, dz = player.z - oldZ, travel = Math.hypot(dx, dz);
  if (travel > 0.00001) {
    const axis = [dz / travel, 0, -dx / travel];
    player.q = Q.norm(Q.mul(Q.axis(axis, travel / Math.max(player.r, 0.4)), player.q));
    const flen = Math.hypot(player.vx, player.vz);
    if (flen > 0.15) {
      const t = 1 - Math.exp(-dt * 12), fx = lerp(player.face[0], player.vx / flen, t), fz = lerp(player.face[1], player.vz / flen, t), l = Math.hypot(fx, fz) || 1;
      player.face = [fx / l, fz / l];
    }
    walkPhase += Math.min(travel, dt * 10) * 7.5;
  }
  player.vr = lerp(player.vr, player.r, 1 - Math.exp(-dt * 9));
  for (const a of attachments) a.age += dt;
  if (boosting && trailTimer <= 0) { trailTimer = 0.065; burst([player.x - player.face[0] * player.r, player.floor + 0.2, player.z - player.face[1] * player.r], '#efdbc1', reduced ? 1 : 3, 0.35); }
  peakCm = Math.max(peakCm, player.r * 20);
  if (!freeMode && remaining <= 0) { remaining = 0; finish(encore ? false : goalMet); }
}
/** Items that move on their own, in every state but the paused ones: wishes bob, the dragon dances, lanterns drift. */
function animateItems(dt) {
  for (const it of items) {
    if (it.collected) continue;
    if (it.wish !== undefined) {
      it.y = it.base + it.p.height / 2 + 0.2 + Math.sin(realTime * 2.5 + it.phase) * 0.06;
      it.yaw += dt * 0.35;
    } else if (it.dance) {
      it.y = it.base + it.p.height / 2 + 0.025 + Math.abs(Math.sin(realTime * 1.8 + it.phase)) * 0.12;
      it.yaw = it.baseYaw + Math.sin(realTime * 0.7 + it.phase) * 0.25;
    } else if (it.float) {
      it.z -= dt * 0.5 * (it.flow || 1);
      if (it.z < -27.5) it.z = 27.5;
      it.x = it.lane + Math.sin(realTime * 0.35 + it.phase) * 0.45;
      const sink = Math.max(0, Math.abs(it.z) - 25) * 0.25;
      it.y = it.base + it.p.height / 2 + 0.025 + Math.sin(realTime * 1.7 + it.phase) * 0.035 - sink;
      it.yaw += dt * 0.12;
    } else continue;
    composeItem(it);
    it.p.dirty = true;
  }
}

function meetGoal() {
  goalMet = true;
  goalTime = gameTime;
  showGoalReady();
  const how = input.source === 'gamepad' ? 'Press X.' : input.source === 'touch' ? 'Tap PARADE.' : 'Press Enter.';
  notify('Light up the night!', `Keep rolling, or launch the parade. ${how}`, 5);
  burst(playerCenter(), '#f3d776', 45, 2);
  launchFirework(player.x - 7, player.z - 9, true);
  launchFirework(player.x + 8, player.z - 14, true);
  Sound.effect('goal');
  input.rumble(0.8, 300);
  syncTouch();
}
function commitRecord() {
  record = peakCm > save.best + 0.04;
  if (record) save.best = peakCm;
  save.items = Math.max(save.items || 0, attachments.length);
  save.won = save.won || goalMet;
  timeRecord = false;
  if (!encore && goalMet && goalTime > 0 && (!save.bestGoalTime || goalTime < save.bestGoalTime - 0.05)) { timeRecord = true; save.bestGoalTime = goalTime; }
  encoreRecord = false;
  if (encore && dragonCaught) {
    save.encoreWon = true;
    if (!save.encoreBest || gameTime < save.encoreBest - 0.05) { encoreRecord = true; save.encoreBest = gameTime; }
  }
  store();
  applyPrefs();
}
function finish(success) {
  if (state !== 'playing') return;
  resultSuccess = !!success;
  state = 'celebrate';
  celebrateTime = 0; ascend = 0; boosting = false;
  player.vx = player.vz = 0;
  input.settle();
  $('hud').classList.remove('on');
  hideToast();
  commitRecord();
  if (resultSuccess) { burst(playerCenter(), '#f5d47a', 85, 2.2); Sound.effect('win'); input.rumble(0.8, 320); }
  else Sound.effect('end');
  syncTouch();
}
const fmt = (s) => { const t = Math.max(0, Math.round(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function showResults() {
  state = 'result';
  const categories = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]), cat = categories[0];
  const names = { snacks: 'The Midnight Picnic', toys: 'The Moonlight Menagerie', home: 'The Floating Garden', bits: 'The Paper Moon', wishes: 'The Little Wish', festival: 'The Lantern Parade' };
  let copy;
  if (encore) {
    $('resultTitle').textContent = resultSuccess ? 'The dragon joins the parade.' : 'The dragon danced on.';
    $('resultTag').textContent = 'ENCORE · THE DRAGON PARADE';
    $('starName').textContent = resultSuccess ? 'The Paper Moon Dragon' : 'The dragon will wait for one more roll.';
    $('newRecord').textContent = resultSuccess
      ? (encoreRecord ? 'A BRAND-NEW FASTEST CATCH' : `FASTEST CATCH  ${fmt(save.encoreBest)}`)
      : (save.encoreBest ? `FASTEST CATCH  ${fmt(save.encoreBest)}` : 'THE DRAGON IS STILL DANCING');
    copy = resultSuccess ? `Caught in ${fmt(gameTime)}, at ${peakCm.toFixed(1)} cm. The whole market rolls with you.` : `You reached ${peakCm.toFixed(1)} cm. The dragon needs ${DRAGON_CM} cm. Try again, or keep rolling with no timer.`;
  } else {
    $('resultTitle').textContent = resultSuccess ? 'The night is yours.' : 'One more moon.';
    $('resultTag').textContent = resultSuccess ? 'A PARADE FOR THE MOON' : 'EVERY BIG THING STARTS SMALL';
    $('starName').textContent = resultSuccess ? (dragonCaught ? 'The Dragon Parade' : wishes.size === 3 ? 'The Three-Lantern Sky' : names[cat] || 'The Little Everything') : 'The sky can wait for one more roll.';
    let line = record ? 'A BRAND-NEW LITTLE BEST' : `YOUR LITTLE BEST  ${save.best.toFixed(1)} CM`;
    if (goalMet && goalTime > 0) line += timeRecord ? `  ·  READY IN ${fmt(goalTime)}, A NEW RECORD` : `  ·  READY IN ${fmt(goalTime)}`;
    $('newRecord').textContent = line;
    copy = resultSuccess
      ? (wishes.size === 3 ? 'All three wishes found. The whole festival lights the sky.' : `Biggest catch: ${largest ? largest.p.name.toLowerCase() : 'a little dream'}. A whole world of little things.`)
      : `You reached ${peakCm.toFixed(1)} cm. Try again, or keep rolling with no timer.`;
  }
  if (newFinds) copy += ` ${newFinds} new little thing${newFinds === 1 ? '' : 's'} for your collection.`;
  if (!encore && resultSuccess && save.won && !save.encoreWon) copy += ' The encore is open: the dragon parade.';
  $('resultCopy').textContent = copy;
  $('resultSize').textContent = peakCm.toFixed(1);
  $('resultItems').textContent = attachments.length;
  $('resultWishes').textContent = wishes.size + ' / 3';
  $('againBtn').firstChild.textContent = encore ? 'Another encore ' : 'Another little adventure ';
  $('encoreResultBtn').hidden = encore || !save.won;
  $('results').classList.add('show');
  $('againBtn').focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function showGoalReady() {
  $('goalTitle').textContent = 'THE PARADE IS READY';
  $('goalText').textContent = '120 cm ✓';
  $('goalFrom').textContent = 'Keep growing, or…';
  $('sendStar').classList.add('show');
}
function continueRoll() {
  const fromEncore = encore;
  state = 'playing';
  runMode = 'free'; freeMode = true; encore = false; ascend = 0;
  $('results').classList.remove('show');
  $('hud').classList.add('on');
  // After an encore the ball is usually past 120 cm already: the parade is simply ready,
  // without a second goal fanfare on the next pickup (and no goal time, so no false record).
  if (fromEncore && !goalMet && player.r * 20 >= GOAL_CM) { goalMet = true; goalTime = 0; showGoalReady(); }
  if (!goalMet) { const copy = modeCopy(); $('goalTitle').textContent = copy.title; $('goalText').textContent = copy.text; $('goalFrom').textContent = copy.from; }
  notify('There’s always a little more.', dragonCaught ? 'No timer. The whole market is yours.' : 'No timer. Find 3 moon wishes. Reach 135 cm for the paper dragon.', 4);
  updateHUD();
  Sound.init();
  canvas.focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  boosting = false;
  flushSave();
  $('pauseScreen').classList.add('show');
  $('resumeBtn').focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  $('pauseScreen').classList.remove('show');
  Sound.init();
  canvas.focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function openHelp() {
  if (state === 'celebrate' || state === 'help' || state === 'collection') return;
  lastState = state;
  state = 'help';
  boosting = false;
  $('pauseScreen').classList.remove('show');
  $('helpScreen').classList.add('show');
  $('helpDone').focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function closeHelp() {
  if (state !== 'help') return;
  $('helpScreen').classList.remove('show');
  state = lastState;
  if (state === 'paused') { $('pauseScreen').classList.add('show'); $('resumeBtn').focus({ preventScroll: true }); }
  else if (state === 'title') $('startBtn').focus({ preventScroll: true });
  else canvas.focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function home() {
  if (state !== 'title' && attachments.length) commitRecord();
  preview();
  $('startBtn').focus({ preventScroll: true });
}

// ---------------------------------------------------------------- collection
let thumbQueue = [];
function renderCollection() {
  const grid = $('collectionGrid');
  grid.textContent = '';
  thumbQueue = [];
  let found = 0;
  for (const id of ORDER) {
    const p = P[id], n = save.found[id] || 0;
    if (n) found++;
    const card = document.createElement('div');
    card.className = 'thing' + (n ? '' : ' unknown') + (freshIds.has(id) ? ' fresh' : '');
    const img = document.createElement('img');
    img.alt = '';
    img.width = img.height = 62;
    if (p.thumb) img.src = p.thumb; else thumbQueue.push([img, p]);
    const name = document.createElement('b');
    name.textContent = n ? p.name : '???';
    const small = document.createElement('small');
    small.textContent = `${p.need} CM`;
    card.append(img, name, small);
    if (n) { const c = document.createElement('span'); c.className = 'count'; c.textContent = '×' + n; card.append(c); }
    grid.append(card);
  }
  $('collectionCount').textContent = `${found} / ${ORDER.length} little things found`;
  const fill = () => {
    for (let k = 0; k < 4 && thumbQueue.length; k++) { const [img, p] = thumbQueue.shift(); img.src = thumbFor(p); }
    if (thumbQueue.length) setTimeout(fill, 16);
  };
  fill();
}
function openCollection() {
  if (state === 'celebrate' || state === 'collection' || state === 'help') return;
  collectionReturn = state;
  state = 'collection';
  boosting = false;
  $('pauseScreen').classList.remove('show');
  renderCollection();
  $('collectionScreen').classList.add('show');
  $('collectionGrid').scrollTop = 0;
  $('collectionDone').focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
function closeCollection() {
  if (state !== 'collection') return;
  $('collectionScreen').classList.remove('show');
  state = collectionReturn;
  if (state === 'paused') { $('pauseScreen').classList.add('show'); $('resumeBtn').focus({ preventScroll: true }); }
  else if (state === 'title') { $('collectionBtn').focus({ preventScroll: true }); updateTitle(); }
  else canvas.focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
/** Draw the item portraits in the background, a few at a time, so first pickups never stutter. */
function warmThumbs() {
  let i = 0;
  const step = () => {
    const t0 = performance.now();
    while (i < ORDER.length && performance.now() - t0 < 6) thumbFor(P[ORDER[i++]]);
    if (i < ORDER.length) setTimeout(step, 50);
  };
  setTimeout(step, 1200);
}

// ---------------------------------------------------------------- festival life
function launchFirework(x, z, large = false) {
  const y = between(14, 20), n = large ? 64 : 42, col = Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const yy = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - yy * yy), a = i * 2.39996, s = large ? 5.9 : 4.2;
    fireworks.push({ p: [x, y, z], v: [Math.cos(a) * rr * s, yy * s, Math.sin(a) * rr * s], life: between(1.6, 2.6), max: 2.6, c: col, s: between(0.065, 0.12) });
  }
  if (fireworks.length > 450) fireworks.splice(0, fireworks.length - 450);
}
function frozen() { return state === 'paused' || state === 'help' || state === 'photo' || state === 'collection'; }
function updateFestival(dt) {
  if (frozen()) return;
  festivalTime += dt;
  for (const p of petals) {
    p.y -= dt * (0.3 + p.s * 0.18);
    p.x += dt * (0.32 + Math.sin(festivalTime * 0.3 + p.p) * 0.2);
    p.z += Math.sin(festivalTime * 0.5 + p.p) * dt * 0.13;
    if (p.y < 0) { p.y = 13; p.x = between(-37, 37); p.z = between(-33, 33); }
    if (p.x > 39) p.x = -39;
  }
  if ((state === 'title' || state === 'celebrate' || goalMet) && festivalTime - lastFirework > (state === 'celebrate' ? 1.0 : 8.5)) {
    lastFirework = festivalTime;
    launchFirework(between(-25, 27), between(-36, -24), state === 'celebrate');
  }
  for (let i = fireworks.length - 1; i >= 0; i--) {
    const p = fireworks[i];
    p.life -= dt;
    if (p.life <= 0) { fireworks[i] = fireworks[fireworks.length - 1]; fireworks.pop(); continue; }
    p.v[1] -= dt * 1.8;
    const drag = Math.exp(-dt * 0.4);
    for (let j = 0; j < 3; j++) { p.p[j] += p.v[j] * dt; p.v[j] *= drag; }
  }
  waterWake -= dt;
  if (state === 'playing' && inWater(player.x, player.z) && Math.hypot(player.vx, player.vz) > 0.6 && waterWake < 0) {
    waterWake = 0.2;
    waterRipples.unshift({ x: player.x, z: player.z, t: realTime, s: Math.min(1.5, player.r * 0.6) });
    waterRipples.length = Math.min(6, waterRipples.length);
  }
  if (state === 'playing' && boosting && !reduced && frameCount % 3 === 0) {
    const c = playerCenter();
    fireworks.push({ p: [c[0] - player.face[0] * player.r, c[1] - player.r * 0.4, c[2] - player.face[1] * player.r], v: [between(-0.5, 0.5), 0.6, between(-0.5, 0.5)], life: 0.4, max: 0.4, c: 2, s: 0.09 + player.r * 0.015 });
  }
}

// ---------------------------------------------------------------- per-frame scene sync
function syncItems() {
  for (const id of ORDER) {
    const p = P[id];
    if (!p.dirty) continue;
    p.dirty = false;
    const b = p.world;
    b.begin();
    for (const it of p.list) if (!it.collected) b.pushMatrix(it.m);
    b.end();
  }
}
function addLightCandidate(l) {
  l.key = Math.hypot(l.p[0] - look[0], l.p[1] - look[1], l.p[2] - look[2]) - l.r * 0.15;
  lightCandidates.push(l);
}
function selectLights() {
  lightCandidates.length = 0;
  for (const l of lanternLights) addLightCandidate(l);
  playerLight.p[0] = player.x; playerLight.p[1] = player.floor + player.r + 0.6; playerLight.p[2] = player.z; playerLight.r = 6 + player.r * 0.4;
  addLightCandidate(playerLight);
  // The floating lanterns glow on the canal while they drift.
  for (const it of items) {
    if (!it.float || it.collected) continue;
    if (!it.light) it.light = { p: [0, 0, 0], c: [2.6, 1.3, 0.55], r: 5, key: 0 };
    it.light.p[0] = it.x; it.light.p[1] = it.y + 0.2; it.light.p[2] = it.z;
    addLightCandidate(it.light);
  }
  for (let i = 0; i < POINT_LIGHTS; i++) {
    let best = -1, bk = Infinity;
    for (let j = i; j < lightCandidates.length; j++) if (lightCandidates[j].key < bk) { bk = lightCandidates[j].key; best = j; }
    if (best < 0) { R.clearPointLight(i); continue; }
    const t = lightCandidates[i]; lightCandidates[i] = lightCandidates[best]; lightCandidates[best] = t;
    const l = lightCandidates[i];
    R.setPointLight(i, l.p, l.c, l.r);
  }
}
function syncScene(dt) {
  const ft = festivalTime;
  stringBatch.begin();
  for (const l of hangingLanterns) { const a = Math.sin(ft * 0.8 + l.phase) * 0.075; eulerInto(tq, 0, 0, a); stringBatch.push(l.x + Math.sin(a) * 0.4, l.y, l.z, tq, l.s); }
  stringBatch.end();
  skyBatch.begin();
  for (const l of skyLanterns) { eulerInto(tq, 0.02, Math.sin(l.p) * 0.3, 0.04); skyBatch.push(l.x + Math.sin(ft * 0.08 + l.p) * 1.3, l.y + Math.sin(ft * 0.13 + l.p) * 1.0, l.z, tq, l.s); }
  skyBatch.end();
  windBatch.begin();
  for (const l of windmills) { eulerInto(tq, 0, 0, ft * 0.9 + l.phase); windBatch.push(l.x, 4.3, l.z, tq, 1); }
  windBatch.end();
  petalBatch.begin();
  for (let i = 0; i < petalCount; i++) { const p = petals[i]; eulerInto(tq, ft * 0.7 + p.p, p.p, ft * 0.5); petalBatch.push(p.x + Math.sin(ft + p.p) * 0.2, p.y, p.z, tq, p.s); }
  petalBatch.end();
  fireflyBatch.begin();
  for (let i = 0; i < fireflyCount; i++) {
    const p = fireflies[i], pulse = 0.4 + 0.6 * Math.max(0, Math.sin(ft * 1.5 + p.p));
    fireflyBatch.push(p.x + Math.sin(ft * 0.52 + p.p) * 1.1, p.y + Math.sin(ft * 0.87 + p.p) * 0.4, p.z + Math.cos(ft * 0.37 + p.p) * 0.75, QI, pulse);
  }
  fireflyBatch.end();
  for (const b of sparkBatches) b.begin();
  for (const p of fireworks) { const s = p.s * clamp(p.life * 2, 0, 1); sparkBatches[p.c].push(p.p[0], p.p[1], p.p[2], QI, s); }
  for (const b of sparkBatches) b.end();
  syncItems();
  markerBatch.begin();
  for (const it of items) {
    if (it.collected) continue;
    if (it.wish !== undefined) { const pulse = 1 + Math.sin(realTime * 2 + it.phase) * 0.12; markerBatch.push(it.x, it.base + 0.105, it.z, QI, 0.7 * pulse, 1, 0.7 * pulse); }
    else if (it.dance && (encore || goalMet) && state !== 'title') { const pulse = 1 + Math.sin(realTime * 2 + it.phase) * 0.08; markerBatch.push(it.x, it.base + 0.105, it.z, QI, 4.3 * pulse, 1, 4.3 * pulse); }
  }
  markerBatch.end();
  itemShadowBatch.begin();
  for (const it of items) {
    if (it.collected || it.float) continue;
    const dx = it.x - player.x, dz = it.z - player.z;
    if (dx * dx + dz * dz > 900) continue;
    const r = it.p.radius;
    itemShadowBatch.push(it.x, it.base + 0.035, it.z, QI, r * 1.13, 1, r * 0.89);
  }
  itemShadowBatch.end();
  playerShadowBatch.begin();
  playerShadowBatch.push(player.x, player.floor + 0.07, player.z, QI, player.r * 1.15, 1, player.r);
  playerShadowBatch.end();
  // The seed ball, what it carries, and the little pusher.
  ballGroup.position.set(player.x, player.floor + player.vr + ascend, player.z);
  ballGroup.quaternion.set(player.q[0], player.q[1], player.q[2], player.q[3]);
  ballObj.scale.setScalar(player.vr);
  updateHeld();
  const distance = player.vr + 0.37, fx = player.face[0], fz = player.face[1], yaw = Math.atan2(fx, fz);
  const avScale = (state === 'title' ? 0.91 : 0.63) + player.vr * 0.027;
  avatar.position.set(player.x - fx * distance, player.floor + 0.03, player.z - fz * distance);
  avatar.rotation.set(0, yaw, 0);
  avatar.scale.setScalar(avScale);
  const walking = state === 'playing' ? Math.min(1, Math.hypot(player.vx, player.vz)) : 0;
  const bob = walking ? Math.abs(Math.sin(walkPhase)) * 0.045 : Math.sin(realTime * 2.2) * 0.015;
  avBody.position.set(0, bob, 0); avBody.rotation.set(walking * 0.07, 0, 0);
  avHead.position.set(0, 0.94 + bob, 0); avHead.rotation.set(0, Math.sin(realTime) * 0.025, 0);
  for (let k = 0; k < 2; k++) {
    const sign = k ? 1 : -1;
    avArms[k].position.set(sign * 0.275, 0.58 + bob, 0.045);
    avArms[k].rotation.set(-1.17 + Math.sin(walkPhase + sign) * 0.08 * walking, 0, -sign * 0.2);
    const stride = Math.sin(walkPhase + (sign < 0 ? 0 : PI)) * 0.62 * walking;
    avLegs[k].position.set(sign * 0.125, 0.295, 0.025);
    avLegs[k].rotation.set(stride, 0, 0);
  }
  // Moon shadow box, the lanterns nearest the view, the canal wake, the camera.
  const radius = state === 'title' ? 56 : clamp(23 + player.r * 2.5, 25, 45);
  R.placeMoon(state === 'title' ? -1 : player.x, state === 'title' ? 0 : player.z, radius);
  selectLights();
  for (let i = 0; i < 6; i++) { const r = waterRipples[i]; if (r) R.setRipple(i, r.x, r.z, r.t, r.s); else R.setRipple(i, 0, 0, -100, 0); }
  boostGlow = lerp(boostGlow, boosting ? 1 : 0, 1 - Math.exp(-dt * 8));
  R.uBoost.value = boostGlow;
  R.uPhoto.value = state === 'photo' ? 1 : 0;
  R.view(eye, look, realTime);
}

// ---------------------------------------------------------------- camera
function updateCamera(dt) {
  if (state === 'title') {
    const a = Math.sin(realTime * 0.06);
    eye[0] = 35 + a * 1.6; eye[1] = 24.5 + Math.sin(realTime * 0.07) * 0.4; eye[2] = 47.5;
    look[0] = -2; look[1] = 3.5; look[2] = -5;
    return;
  }
  camYaw = lerp(camYaw, camYawTarget, reduced ? 1 : 1 - Math.exp(-dt * 8));
  const r = player.vr, d = (6.7 + r * 3.0) * camZoom, h = (4.5 + r * 2.1) * camLift, s = Math.sin(camYaw), c = Math.cos(camYaw), ahead = 1 + r * 0.32;
  camTarget[0] = player.x - s * ahead; camTarget[1] = player.floor + r * 0.86 + ascend; camTarget[2] = player.z - c * ahead;
  camWanted[0] = clamp(player.x + s * d, -44, 44); camWanted[1] = player.floor + h + ascend * 0.8; camWanted[2] = clamp(player.z + c * d, -39, 45);
  // Lift the camera above a roof or post when it crosses the sight line.
  for (const o of obstacles) {
    if (o.hi < 1.8) continue;
    for (const t of [0.35, 0.55, 0.75, 0.95]) {
      const x = lerp(camTarget[0], camWanted[0], t), y = lerp(camTarget[1], camWanted[1], t), z = lerp(camTarget[2], camWanted[2], t);
      if (Math.abs(x - o.x) < o.w / 2 + 0.35 && Math.abs(z - o.z) < o.d / 2 + 0.35 && y > o.lo - 0.25 && y < o.hi + 0.3) {
        camWanted[1] = Math.max(camWanted[1], camTarget[1] + (o.hi + 0.55 - camTarget[1]) / t);
        break;
      }
    }
  }
  const f = reduced ? 1 : 1 - Math.exp(-dt * 7);
  for (let i = 0; i < 3; i++) { eye[i] = lerp(eye[i], camWanted[i], f); look[i] = lerp(look[i], camTarget[i], f); }
  if (shake > 0 && !reduced) {
    eye[0] += Math.sin(realTime * 63) * shake;
    eye[1] += Math.cos(realTime * 57) * shake * 0.5;
    shake = Math.max(0, shake - dt * 0.7);
  }
}
function turnAround() { camYawTarget += PI; Sound.effect('start'); }
// Camera turn per unit the kit reports: mouse drag, touch drag and the right stick keep the original speeds.
const LOOK_GAIN = { keyboard: [2.5, 1.04], touch: [1.09, 0.45], gamepad: [0.65, 0.35] };
function applyLook(dt) {
  const lk = input.look('look'), g = LOOK_GAIN[input.source] || LOOK_GAIN.keyboard;
  camYawTarget -= lk.x * g[0];
  camLift = clamp(camLift + lk.y * g[1], 0.62, 1.75);
  const turn = input.value('turn');
  if (turn) camYawTarget -= turn * dt * (state === 'photo' ? 1.2 : 1.7);
  const z = input.zoom();
  if (z) camZoom = clamp(camZoom - z * 0.1, 0.55, 2.0);
  const zp = input.value('zoomPad');
  if (zp) camZoom = clamp(camZoom - zp * dt * 0.9, 0.55, 2.0);
}

// ---------------------------------------------------------------- menus and input
const MENU_ROOTS = { title: 'menu', paused: 'pauseScreen', help: 'helpScreen', result: 'results', collection: 'collectionScreen', photo: 'photoUI' };
let navPrev = 0;
function menuButtons(root) { return [...root.querySelectorAll('button')].filter((b) => !b.hidden && !b.disabled && b.offsetParent !== null); }
function menuNavigate(root) {
  const v = input.vector('move'), horizontal = Math.abs(v.x) > Math.abs(v.y);
  const dir = horizontal ? (v.x > 0.5 ? 1 : v.x < -0.5 ? -1 : 0) : (v.y < -0.5 ? 1 : v.y > 0.5 ? -1 : 0);
  if (dir && dir !== navPrev) {
    const list = menuButtons(root);
    if (list.length) {
      let i = list.indexOf(document.activeElement);
      if (i < 0) {
        // Nothing focused yet: land on the screen's main button (Let's roll, Keep rolling…) first.
        const main = list.findIndex((b) => b.classList.contains('primary'));
        i = main >= 0 ? main : dir > 0 ? 0 : list.length - 1;
      } else i = (i + dir + list.length) % list.length;
      list[i].focus({ preventScroll: false, focusVisible: true });
      Sound.effect('select');
    }
  }
  navPrev = dir;
}
function menuConfirm(root, fallback) {
  const a = document.activeElement;
  if (a && a.tagName === 'BUTTON' && root.contains(a) && !a.disabled && a.offsetParent !== null) a.click();
  else fallback();
}
function handleInput(dt) {
  if (input.pressed('mute')) toggleSound();
  if (state === 'playing') {
    if (input.pressed('pause')) { pause(); return; }
    if (input.pressed('photo')) { togglePhoto(); return; }
    if (input.pressed('launch') && goalMet && !encore) { finish(true); return; }
    applyLook(dt);
    if (input.pressed('turnBack')) turnAround();
    return;
  }
  if (state === 'photo') {
    applyLook(dt);
    if (input.pressed('photo') || input.pressed('pause') || input.pressed('back')) { togglePhoto(); return; }
    if (input.pressed('confirm')) menuConfirm($('photoUI'), capturePhoto);
    return;
  }
  const rootId = MENU_ROOTS[state];
  if (!rootId) return;
  const root = $(rootId);
  const ok = input.pressed('confirm'), back = input.pressed('back') || input.pressed('pause');
  if (state === 'collection') {
    const v = input.vector('move');
    if (Math.abs(v.y) > 0.2) $('collectionGrid').scrollTop -= v.y * dt * 700;
    if (ok || back) closeCollection();
    return;
  }
  menuNavigate(root);
  if (state === 'title') {
    if (ok || (input.pressed('pause') && input.source === 'gamepad')) menuConfirm(root, () => start('mission'));
  } else if (state === 'paused') {
    if (ok) menuConfirm(root, resume); else if (back) resume();
  } else if (state === 'help') {
    if (ok) menuConfirm(root, closeHelp); else if (back) closeHelp();
  } else if (state === 'result') {
    if (ok) menuConfirm(root, () => start(encore ? 'encore' : 'mission'));
  }
}
function syncTouch() {
  kit.touch?.suspend(state !== 'playing', 'game');
  // On phones the stick zone covers the HUD's launch button: a PARADE button appears by the thumb instead.
  kit.touch?.setShown('launch', state === 'playing' && goalMet && !encore);
}
function capturePhoto() { captureNext = true; }
function togglePhoto() {
  if (state === 'playing') {
    photoReturn = state;
    state = 'photo';
    boosting = false;
    $('hud').classList.remove('on');
    $('photoUI').classList.add('show');
  } else if (state === 'photo') {
    state = photoReturn;
    $('photoUI').classList.remove('show');
    $('hud').classList.add('on');
  }
  canvas.focus({ preventScroll: true });
  input.settle();
  syncTouch();
}
async function toggleFullscreen() {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  catch (_) { notify('Full screen is not available.', 'Use the full-screen control in your browser.'); }
}

// ---------------------------------------------------------------- prompts that follow the device
const PROMPTS = {
  keyboard: {
    hint: [['WASD', 'Roll'], ['SHIFT', 'Boost'], ['Q E', 'Look', 'look-hint'], ['SPACE', 'Turn', 'turn-hint'], ['ESC', 'Pause']],
    foot: [['W A S D', 'ROLL'], ['SHIFT', 'BOOST'], ['F', 'PHOTO']],
    table: [['WASD / ↑↓←→', 'Roll'], ['SHIFT', 'Hold to boost'], ['Q / E', 'Turn the camera'], ['SPACE', 'Look behind you'], ['DRAG', 'Look around'], ['ESC / P', 'Pause']],
    device: '<b>F</b>: photo mode. Mouse wheel: zoom. <b>M</b>: sound. <b>Enter</b>: launch the parade.',
    send: ' · ENTER',
    photo: 'DRAG TO ORBIT &nbsp; / &nbsp; SCROLL TO ZOOM',
  },
  gamepad: {
    hint: [['L', 'Roll'], ['A', 'Boost'], ['R', 'Look', 'look-hint'], ['Y', 'Turn', 'turn-hint'], ['START', 'Pause']],
    foot: [['L STICK', 'ROLL'], ['A', 'BOOST'], ['BACK', 'PHOTO']],
    table: [['LEFT STICK', 'Roll'], ['A / RT', 'Hold to boost'], ['RIGHT STICK', 'Look around'], ['Y', 'Look behind you'], ['LB / RB', 'Zoom'], ['START', 'Pause']],
    device: '<b>X</b>: launch the parade. <b>BACK</b>: photo mode. D-pad and <b>A</b> work every menu, <b>B</b> goes back.',
    send: ' · X',
    photo: 'RIGHT STICK TO ORBIT &nbsp; / &nbsp; LB RB TO ZOOM &nbsp; / &nbsp; A TO SAVE',
  },
  touch: {
    hint: [['STICK', 'Roll'], ['BOOST', 'Boost'], ['DRAG', 'Look'], ['↻', 'Turn'], ['II', 'Pause']],
    foot: [['STICK', 'ROLL'], ['BOOST', 'HOLD'], ['📷', 'PHOTO']],
    table: [['LEFT THUMB', 'Roll with the stick'], ['BOOST', 'Hold to boost'], ['DRAG', 'Look around'], ['↻', 'Look behind you'], ['PINCH', 'Zoom'], ['II', 'Pause (top right)']],
    device: 'Tap <b>PARADE</b> to launch the parade when it appears. The camera button opens photo mode.',
    send: '',
    photo: 'DRAG TO ORBIT &nbsp; / &nbsp; PINCH TO ZOOM',
  },
};
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
let mapHidden = false;
function updatePrompts() {
  const src = PROMPTS[input.source] ? input.source : 'keyboard', pr = PROMPTS[src];
  document.body.classList.toggle('touch-active', src === 'touch');
  // Chrome hides the focus ring after a programmatic focus once the mouse was used; a pad always needs it.
  document.body.classList.toggle('pad-nav', src === 'gamepad');
  mapHidden = src === 'touch';
  $('controlHint').innerHTML = pr.hint.map(([k, t, cls]) => `<span${cls ? ` class="${cls}"` : ''}><b class="key">${esc(k)}</b> ${esc(t)}</span>`).join('');
  $('footKeys').innerHTML = pr.foot.map(([k, t]) => `<span class="foot-key"><b class="key">${esc(k)}</b> ${esc(t)}</span>`).join('');
  $('keyTable').innerHTML = pr.table.map(([k, t]) => `<div><b class="key">${esc(k)}</b> ${esc(t)}</div>`).join('');
  $('helpDevice').innerHTML = pr.device;
  $('sendKey').textContent = pr.send;
  $('photoHint').innerHTML = pr.photo;
}

// ---------------------------------------------------------------- HUD
const hudCache = new Map();
const els = {};
const el = (id) => els[id] || (els[id] = $(id));
function setText(id, v) { if (hudCache.get(id) !== v) { hudCache.set(id, v); el(id).textContent = v; } }
function setStyle(id, prop, v) { const k = id + ':' + prop; if (hudCache.get(k) !== v) { hudCache.set(k, v); el(id).style[prop] = v; } }
function setClass(id, cls, on) { const k = id + '.' + cls; if (hudCache.get(k) !== on) { hudCache.set(k, on); el(id).classList.toggle(cls, on); } }
function zoneName() {
  if (inWater(player.x, player.z)) return 'The shallow canal';
  if (inRamp(player.x, player.z)) return 'The moon bridge';
  if (player.x > 17) return 'The lantern garden';
  if (player.z < -10) return 'The night market';
  return 'Sweet street';
}
function updateHUD() {
  const cm = player.r * 20;
  setText('sizeWhole', String(Math.floor(cm)));
  setText('sizeMM', Math.floor((cm - Math.floor(cm)) * 10 + 0.00001) + ' mm');
  const from = encore ? ENCORE_RADIUS * 20 : 18, to = encore ? DRAGON_CM : GOAL_CM;
  setStyle('progressFill', 'width', clamp((cm - from) / (to - from) * 100, 0, 100).toFixed(1) + '%');
  setStyle('boostFill', 'width', (player.boost * 100).toFixed(1) + '%');
  const t = Math.max(0, Math.ceil(remaining));
  setText('timeLeft', freeMode ? '∞' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  setClass('timerBox', 'urgent', !freeMode && remaining < 30);
  setText('itemCount', String(attachments.length));
  setText('wishCount', `${wishes.size} / 3`);
  for (let i = 0; i < 3; i++) setClass('wish' + i, 'found', wishes.has(i));
  setStyle('chain', 'opacity', combo >= 4 && comboTimer > 0 ? '1' : '0');
  setText('chain', (combo >= 12 ? 'A WHOLE NIGHT PARADE' : 'MOONLIGHT CHAIN') + ' ×' + combo);
  setText('zoneName', zoneName());
  drawMap();
}
const mapCtx = $('map').getContext('2d');
let mapBase = null;
const mapXY = (x, z) => [(x + 38) / 76 * 250, (z + 34) / 68 * 206];
function drawMapBase() {
  const cv = document.createElement('canvas');
  cv.width = 250; cv.height = 206;
  const c = cv.getContext('2d');
  c.fillStyle = '#2c405a'; c.fillRect(0, 0, 250, 206);
  const rect = (x, z, sw, sd, col) => { const p = mapXY(x - sw / 2, z - sd / 2); c.fillStyle = col; c.fillRect(p[0], p[1], sw / 76 * 250, sd / 68 * 206); };
  rect(12, 0, 10, 58, '#58a7b0'); rect(12, 8, 16, 6.3, '#e1b190'); rect(12, -15, 16, 6.3, '#e1b190'); rect(-14.5, -25, 33, 13, '#736783'); rect(27.5, -25, 14, 7, '#788488');
  for (const o of obstacles) { if (o.hi < 3 || o.lo > 1) continue; rect(o.x, o.z, o.w, o.d, '#8c7b95'); }
  mapBase = cv;
}
function mapStar(c, x, y, outer, inner, fill) {
  c.fillStyle = fill; c.strokeStyle = '#513f60'; c.lineWidth = 1; c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? inner : outer; c[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath(); c.fill(); c.stroke();
}
function drawMap() {
  if (mapHidden || state === 'title') return;
  const c = mapCtx;
  if (!mapBase) drawMapBase();
  c.drawImage(mapBase, 0, 0);
  const cm = player.r * 20;
  for (const it of items) {
    if (it.collected || it.wish !== undefined || it.dance) continue;
    const p = mapXY(it.x, it.z);
    c.fillStyle = it.need <= cm ? '#acd8bc' : '#597183';
    c.beginPath(); c.arc(p[0], p[1], it.need > 65 ? 2.1 : 1.15, 0, TAU); c.fill();
  }
  for (const it of items) {
    if (it.collected) continue;
    if (it.wish !== undefined) { const p = mapXY(it.x, it.z); mapStar(c, p[0], p[1], 6.5, 3, '#ffd490'); }
    else if (it.dance) { const p = mapXY(it.x, it.z); mapStar(c, p[0], p[1], (encore || goalMet) ? 8 : 5, (encore || goalMet) ? 3.6 : 2.4, (encore || goalMet) ? '#f5aeaa' : '#8fcfc0'); }
  }
  const p = mapXY(player.x, player.z), a = camYaw;
  c.fillStyle = 'rgba(192,237,220,.25)'; c.beginPath(); c.moveTo(p[0], p[1]);
  c.lineTo(p[0] - Math.sin(a - 0.5) * 24, p[1] - Math.cos(a - 0.5) * 24); c.lineTo(p[0] - Math.sin(a + 0.5) * 24, p[1] - Math.cos(a + 0.5) * 24); c.closePath(); c.fill();
  c.fillStyle = '#ffacac'; c.strokeStyle = '#fff0d2'; c.lineWidth = 2.4; c.beginPath(); c.arc(p[0], p[1], 4.8, 0, TAU); c.fill(); c.stroke();
}
function setupFlower() {
  const s = $('sizeFlower'), parts = [];
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, x = 72 + Math.cos(a) * 51, y = 72 + Math.sin(a) * 51; parts.push(`<circle cx="${x}" cy="${y}" r="17.5" fill="#eeb191"/>`); }
  parts.push('<circle cx="72" cy="72" r="57" fill="#e1eaa8"/><circle cx="72" cy="72" r="48.7" fill="#fff6db" stroke="#416b54" stroke-width="1.4"/><circle cx="72" cy="72" r="53" fill="none" stroke="#7ca484" stroke-width="2" stroke-dasharray="2 8"/>');
  s.innerHTML = parts.join('');
}
function applyPrefs() {
  document.body.classList.toggle('reduced', reduced);
  $('motionBtn').classList.toggle('on', reduced);
  for (const b of document.querySelectorAll('.sound-toggle')) {
    b.classList.toggle('on', save.sound);
    const use = b.querySelector('use');
    if (use) use.setAttribute('href', save.sound ? '#sound' : '#mute');
    const word = b.querySelector('.sound-word');
    if (word) word.textContent = save.sound ? 'SOUND ON' : 'SOUND OFF';
    b.setAttribute('aria-label', save.sound ? 'Turn sound off' : 'Turn sound on');
  }
  if (save.best > 0) $('bestLabel').textContent = `YOUR LITTLE BEST  ${save.best.toFixed(1)} CM` + (save.bestGoalTime ? `  ·  READY IN ${fmt(save.bestGoalTime)}` : '');
  Sound.setMuted(!save.sound);
}
function updateTitle() {
  const eb = $('encoreBtn');
  eb.disabled = !save.won;
  eb.textContent = save.won ? `✦ Encore · the dragon parade${save.encoreBest ? '  ' + fmt(save.encoreBest) : ''}` : '✦ Encore · win one night to unlock';
  let found = 0;
  for (const id of ORDER) if (save.found[id]) found++;
  $('collectionBtn').textContent = `Little things ${found} / ${ORDER.length}`;
}
function updateQualityLabel() {
  for (const b of document.querySelectorAll('.quality-toggle')) b.textContent = 'GRAPHICS · ' + kit.tier.name.toUpperCase();
}
function toggleSound() { save.sound = !save.sound; Sound.init(); store(); applyPrefs(); }
function preview() {
  state = 'title';
  runMode = 'mission'; freeMode = false; encore = false; goalMet = false; boosting = false;
  $('hud').classList.remove('on');
  $('menu').classList.remove('gone');
  $('photoUI').classList.remove('show');
  for (const s of document.querySelectorAll('.shade')) s.classList.remove('show');
  buildItems();
  attachments = []; previewAttachments = []; particles = []; floats = []; ascend = 0;
  player = { ...player, x: 2, z: 16, r: 2.1, vr: 2.1, volume: 2.1 ** 3, floor: 0, vy: 0, vx: 0, vz: 0, q: Q.euler(0.3, 0.4, 0.25), face: [-0.86, -0.51], boost: 1, stun: 0 };
  const types = ['lantern', 'dango', 'luckycat', 'rice', 'melon', 'fan', 'duck', 'fishbag', 'pinwheel', 'mochi', 'mask', 'sushi', 'can', 'basket', 'block0', 'fishcake', 'drum', 'bento', 'lantern', 'mochi', 'orange', 'fishbag'];
  for (let i = 0; i < types.length; i++) {
    const y = 1 - (i + 0.5) / types.length * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    previewAttachments.push({ p: P[types[i]], dir: [Math.cos(a) * r, y, Math.sin(a) * r], rot: Q.euler(between(-2, 2), between(-2, 2), between(-2, 2)), start: null, age: 2, scale: 0.94, slot: 0 });
  }
  rebuildHeld();
  updateCamera(1);
  updateHUD();
  applyPrefs();
  updateQualityLabel();
  updateTitle();
  input.settle();
  syncTouch();
}

// ---------------------------------------------------------------- 2D overlay: sparkles and names
const fx = $('fx'), fxctx = fx.getContext('2d');
let cw = kit.size.width, ch = kit.size.height, fxDpr = 1;
const proj = { x: 0, y: 0, w: 0, visible: false };
const project = (p) => R.project(p[0], p[1], p[2], proj);
function burst(pos, color, n = 8, power = 1) {
  if (reduced) n = Math.ceil(n / 3);
  n = Math.min(n, 240 - particles.length);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * TAU;
    particles.push({ p: pos.slice(), v: [Math.cos(angle) * (1 + Math.random() * 2) * power, (1.4 + Math.random() * 3) * power, Math.sin(angle) * (1 + Math.random() * 2) * power], life: 0.45 + Math.random() * 0.45, max: 1, color, size: 2 + Math.random() * 3, star: i % 3 === 0 });
  }
}
function floatText(text, pos, color) { if (reduced || floats.length > 10) return; floats.push({ text, p: pos.slice(), life: 1.1, color }); }
function setHint(show, text, x, y) {
  const h = $('obstacleHint');
  if (!show) { if (hintState.shown) { h.style.display = 'none'; hintState.shown = false; } return; }
  if (!hintState.shown) { h.style.display = 'block'; hintState.shown = true; }
  if (hintState.text !== text) { h.textContent = text; hintState.text = text; }
  if (Math.abs(hintState.x - x) > 0.5 || Math.abs(hintState.y - y) > 0.5) { h.style.left = x + 'px'; h.style.top = y + 'px'; hintState.x = x; hintState.y = y; }
}
function drawFX(dt) {
  fxctx.setTransform(fxDpr, 0, 0, fxDpr, 0, 0);
  fxctx.clearRect(0, 0, cw, ch);
  if (state === 'photo') { setHint(false); return; }
  const still = frozen();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (!still) { p.life -= dt; for (let j = 0; j < 3; j++) p.p[j] += p.v[j] * dt; p.v[1] -= 4 * dt; }
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    const s = project(p.p);
    if (!s || !s.visible) continue;
    const r = clamp(50 / s.w, 1.2, 3) * p.size;
    fxctx.globalAlpha = Math.min(1, p.life * 2);
    fxctx.fillStyle = p.color;
    fxctx.save();
    fxctx.translate(s.x, s.y);
    fxctx.rotate(p.life * 2);
    fxctx.beginPath();
    if (p.star) { fxctx.moveTo(0, -r * 1.5); fxctx.lineTo(r * 0.36, -r * 0.3); fxctx.lineTo(r * 1.3, 0); fxctx.lineTo(r * 0.3, r * 0.3); fxctx.lineTo(0, r * 1.5); fxctx.lineTo(-r * 0.3, r * 0.3); fxctx.lineTo(-r * 1.3, 0); fxctx.lineTo(-r * 0.3, -r * 0.3); }
    else fxctx.rect(-r / 2, -r / 2, r, r);
    fxctx.fill();
    fxctx.restore();
  }
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    if (!still) { f.life -= dt; f.p[1] += dt * 0.7; }
    if (f.life <= 0) { floats.splice(i, 1); continue; }
    const p = project(f.p);
    if (!p || !p.visible) continue;
    fxctx.globalAlpha = clamp(f.life * 2, 0, 1);
    fxctx.font = `900 ${cw < 750 ? 12 : 14}px Trebuchet MS,Arial`;
    fxctx.textAlign = 'center'; fxctx.lineWidth = 3; fxctx.lineJoin = 'round'; fxctx.strokeStyle = '#385a48';
    fxctx.strokeText(f.text, p.x, p.y);
    fxctx.fillStyle = f.color;
    fxctx.fillText(f.text, p.x, p.y);
  }
  if (state === 'playing' || state === 'title') {
    for (const it of items) {
      if (it.collected || it.wish === undefined) continue;
      const p = project([it.x, it.y + it.p.height * 0.55, it.z]);
      if (!p || !p.visible) continue;
      const a = realTime * 2 + it.phase, s = 4 + Math.sin(a) * 2;
      fxctx.globalAlpha = 0.65 + Math.sin(a) * 0.25;
      fxctx.strokeStyle = '#fff4c4'; fxctx.lineWidth = 2;
      fxctx.beginPath(); fxctx.moveTo(p.x - s, p.y); fxctx.lineTo(p.x + s, p.y); fxctx.moveTo(p.x, p.y - s); fxctx.lineTo(p.x, p.y + s); fxctx.stroke();
    }
  }
  fxctx.globalAlpha = 1;
  if (state === 'playing' && blockedItem && blockedTimer > 0 && !blockedItem.collected) {
    const it = blockedItem, p = project([it.x, it.y + it.p.height * 0.6, it.z]);
    if (p && p.visible) setHint(true, `${it.need} cm to pick up`, p.x, p.y - 10);
    else setHint(false);
  } else setHint(false);
}

// ---------------------------------------------------------------- the frame
function frame(dt) {
  realTime += dt;
  handleInput(dt);
  if (state === 'playing') {
    const c = readControls();
    const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < steps && state === 'playing'; i++) updateGame(dt / steps, c);
    if (boosting && !lastBoost) Sound.effect('boost');
    lastBoost = boosting;
  } else if (state === 'title') {
    player.q = Q.norm(Q.mul(Q.axis([0, 1, 0], dt * 0.14), player.q));
  } else if (state === 'celebrate') {
    celebrateTime += dt;
    ascend = resultSuccess ? Math.min(2.5, celebrateTime * 1.25) : 0;
    player.q = Q.norm(Q.mul(Q.axis([0, 1, 0], dt * 0.65), player.q));
    player.vr = lerp(player.vr, player.r, 1 - Math.exp(-dt * 9));
    for (const a of attachments) a.age += dt;
    if (celebrateTime > 1.7) showResults();
  } else if (state === 'result') {
    player.q = Q.norm(Q.mul(Q.axis([0, 1, 0], dt * 0.22), player.q));
  }
  if (!frozen()) {
    animateItems(dt);
    toastTimer -= dt;
    pickupTimer -= dt;
  }
  if (toastShown && toastTimer <= 0) hideToast();
  if (pickupShown && pickupTimer <= 0) { $('pickup').classList.remove('show'); pickupShown = false; }
  updateFestival(dt);
  updateCamera(dt);
  syncScene(dt);
  R.render();
  if (captureNext) {
    captureNext = false;
    Sound.effect('shutter');
    canvas.toBlob((blob) => {
      if (!blob) { notify('The photo could not be saved.', 'Try again, or use a screenshot.'); return; }
      const a = document.createElement('a'), u = URL.createObjectURL(blob);
      a.href = u; a.download = 'lantern-tide-photo.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1500);
    }, 'image/png');
  }
  drawFX(dt);
  uiClock += dt;
  if (uiClock > 0.09) {
    uiClock = 0;
    updateHUD();
    const sec = Math.ceil(remaining);
    if (state === 'playing' && !freeMode && sec <= 10 && sec > 0 && sec !== lastSecond) Sound.effect('tick');
    lastSecond = sec;
  }
  frameCount++;
}

// ---------------------------------------------------------------- wiring
function wireUI() {
  for (const b of document.querySelectorAll('.sound-toggle')) b.addEventListener('click', toggleSound);
  $('startBtn').onclick = () => start('mission');
  $('freeBtn').onclick = () => start('free');
  $('encoreBtn').onclick = () => { if (save.won) start('encore'); };
  $('collectionBtn').onclick = openCollection;
  $('helpMenu').onclick = openHelp;
  $('helpGame').onclick = openHelp;
  $('pauseHelp').onclick = openHelp;
  $('pauseCollection').onclick = openCollection;
  $('closeHelp').onclick = closeHelp;
  $('helpDone').onclick = closeHelp;
  $('closeCollection').onclick = closeCollection;
  $('collectionDone').onclick = closeCollection;
  $('pauseBtn').onclick = pause;
  $('resumeBtn').onclick = resume;
  $('restartBtn').onclick = () => start(runMode);
  $('quitBtn').onclick = home;
  $('againBtn').onclick = () => start(encore ? 'encore' : 'mission');
  $('continueBtn').onclick = continueRoll;
  $('encoreResultBtn').onclick = () => start('encore');
  $('resultHome').onclick = home;
  $('sendStar').onclick = () => finish(true);
  $('motionBtn').onclick = () => { reduced = !reduced; save.reduced = reduced; store(); applyPrefs(); };
  for (const b of document.querySelectorAll('.quality-toggle')) b.onclick = () => kit.menu.open();
  $('photoBtn').onclick = togglePhoto;
  $('photoBack').onclick = togglePhoto;
  $('photoCapture').onclick = capturePhoto;
  $('fullBtn').onclick = toggleFullscreen;
  $('photoFull').onclick = toggleFullscreen;
  // Keep Tab inside an open dialog.
  addEventListener('keydown', (e) => {
    if (e.code !== 'Tab') return;
    const dialog = document.querySelector('.shade.show');
    if (!dialog) return;
    const buttons = menuButtons(dialog), first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Sound starts on the first touch, click or key anywhere (a gamepad press is not a gesture).
  const unlock = () => Sound.init();
  addEventListener('pointerdown', unlock, { passive: true });
  addEventListener('keydown', unlock);
  addEventListener('blur', () => { if (state === 'playing') pause(); flushSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (state === 'playing') pause(); flushSave(); } });
  addEventListener('pagehide', flushSave);
  input.onSourceChange(updatePrompts);
  kit.onPause((p) => Sound.hold(p));
  kit.onQuality(() => { updateQualityLabel(); applyDetail(); });
  kit.onResize((w, h) => {
    cw = w; ch = h;
    fxDpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = Math.round(w * fxDpr);
    fx.height = Math.round(h * fxDpr);
    R.camera.aspect = w / h;
    R.camera.fov = h > w ? 62 : 54;
    R.camera.updateProjectionMatrix();
  });
}

initModels();
initRoom();
buildItems();
createSceneObjects();
setupFlower();
wireUI();
updatePrompts();
Sound.muted = !save.sound;
Sound.shouldPlay = () => state === 'playing' || state === 'title';
preview();
syncScene(0);
kit.loading.progress(0.9, 'Warming up the lanterns…');
try { await kit.renderer.compileAsync(scene, R.camera); } catch (_) { /* compiles on first draw instead */ }
kit.start(frame);
warmThumbs();

// Test hooks are off in the normal game. They are available only with #test.
if (location.hash === '#test') {
  window.ParadeTest = {
    snapshot: () => ({ state, mode: runMode, cm: player.r * 20, peak: peakCm, x: player.x, z: player.z, floor: player.floor, remaining, free: freeMode, encore, goal: goalMet, held: attachments.length, total: items.length, wishes: [...wishes], dragon: dragonCaught, backend: kit.backend, tier: kit.tier.name, fireworks: fireworks.length, petals: petalCount, shadow: R.moon.shadow.mapSize.x, boost: player.boost, audioState: Sound.ctx?.state, eye: eye.slice(), look: look.slice(), found: Object.keys(save.found).length, items: items.filter((it) => !it.collected).map((it) => ({ id: it.p.id, x: it.x, z: it.z, y: it.y, base: it.base, need: it.need, wish: it.wish })) }),
    start, encore: () => start('encore'),
    teleport: (x, z, y = 0) => { player.x = x; player.z = z; player.floor = y; player.vx = player.vz = player.vy = 0; },
    size: (cm) => { player.r = player.vr = cm / 20; player.volume = player.r ** 3; peakCm = Math.max(peakCm, cm); if (cm >= GOAL_CM && !goalMet && !encore) meetGoal(); rebuildHeld(); },
    time: (t) => { remaining = t; },
    finish: () => finish(encore ? dragonCaught : goalMet),
    collectAvailable: () => { const it = items.find((i) => !i.collected && i.need <= player.r * 20); if (it) { collect(it); return it.p.id; } return null; },
    camera: (yaw, lift = 1, zoom = 1) => { camYaw = camYawTarget = yaw; camLift = lift; camZoom = zoom; },
    pause, resume, home, photo: togglePhoto, collection: openCollection,
    firework: () => launchFirework(player.x, player.z - 5, true),
    collectAt: (x, z) => { const it = items.find((i) => !i.collected && Math.abs(i.x - x) < 0.01 && Math.abs(i.z - z) < 0.01); if (it) { collect(it); return true; } return false; },
  };
}
