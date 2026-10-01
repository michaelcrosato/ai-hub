/* NARIO 63 — Boulder Bop Hill, on the shared 3D stack.
 *
 * Rendering: three.js r186 (WebGPU, WebGL2 fallback) through kit/boot.js and
 * kit/post.js. The original's one hand-written shader is reproduced with
 * colour management off: Lambert under an ambient term of 0.63 and a sun of
 * 0.37 (both × π, since three's Lambert divides by π), the grass ripple,
 * cliff checker and dirt speckle as a TSL colour node, the radial
 * smoothstep(95, 230) fog as scene.fogNode, and the animated creek sparkle as
 * an emissive node. Every triangle still draws from both sides and is lit
 * with its stored normal, as before. New: a soft static sun shadow from the
 * hill, trees and bridge.
 *
 * Actors are drawn the way the original batched them: every part of every
 * hero, coin, crate and king is one instance in a per-shape kit.instanced
 * batch, rewritten each frame with no allocations.
 *
 * Input runs through kit.input actions (keyboard/mouse, gamepad, touch), the
 * game's own menus included.
 */

import * as THREE from 'three/webgpu';
import {
  attribute, color as tColor, dot, float, floor, fog, fract, instancedBufferAttribute, mix as tMix, normalViewGeometry,
  positionView, positionWorld, positionWorldDirection, select, sin, smoothstep, step, uniform, vec2, vec3, vec4,
} from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { AudioEngine } from './audio.js';
import {
  TAU, clamp, mix, hypot, range, color, C, M, SHAPES, island, cannon, PIP, SIGNS, ROLLO_BASE, BLUE_SWITCH, BLUE_COINS,
  route, track, trackInfo, groundBase, buildScenery,
} from './world.js';

// The original wrote its colours straight to the screen: no sRGB conversion anywhere.
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);
const MUSIC_URL = new URL('../music.mp3', import.meta.url).href;
const SAVE_KEY = 'nario63-save-v2';
const OLD_SAVE_KEY = 'nario63-save-v1';
const STAR_IDS = ['king', 'red', 'sky', 'race', 'hundred'];
const STAR_TOTAL = STAR_IDS.length;
const STEP = 1 / 120;
const BLUE_TIME = 12;
const RACE_SECONDS = 17.5;
const SIDES = [-1, 1];

/* ---------------------------------------------------------------------- boot */

const kit = await boot({
  title: 'Nario 63 — Boulder Bop Hill',
  accent: '#ffdc55',
  background: '#4f95c4',
  gear: 'none', // the top bar and the pause menu open the settings
  touch: { top: 'right', topOffset: 70 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
    attack: { keys: ['KeyX', 'KeyJ'], gamepad: ['X', 'B'], touch: 'Punch' },
    pound: { keys: ['ShiftLeft', 'ShiftRight', 'KeyC', 'KeyK'], gamepad: ['LT', 'RT'], touch: 'Pound' },
    turn: { type: 'axis', keys: { pos: ['KeyQ'], neg: ['KeyE'] } },
    zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RB', neg: 'LB' } },
    flag: { keys: ['KeyR'], gamepad: ['Back'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    mute: { keys: ['KeyM'] },
  },
});
const { input } = kit;
const renderer = kit.renderer;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.canvas.setAttribute('aria-label', 'Nario 63 3D game');
kit.loading.progress(0.7, 'Raising the hill…');

/* ------------------------------------------------------- scene, sky, lights */

const scene = new THREE.Scene();
scene.fogNode = fog(tColor(new THREE.Color(0.64, 0.84, 0.9)), smoothstep(float(95), float(230), positionView.length()));
// The sky the page's CSS gradient used to paint behind a transparent canvas.
{
  const up = positionWorldDirection.y;
  const low = tMix(tColor(0xe2f8e3), tColor(0xa2def1), smoothstep(float(-0.06), float(0.16), up));
  scene.backgroundNode = tMix(low, tColor(0x75bce9), smoothstep(float(0.16), float(0.6), up));
}

const camera = new THREE.PerspectiveCamera(60, 1, 0.12, 260);

// shade = 0.63 + 0.37·max(n·L, 0), the original's lighting.
const SUN_DIR = new THREE.Vector3(-0.45, 0.85, 0.35).normalize();
const UP_SHADE = 0.63 + 0.37 * SUN_DIR.y; // a flat, upward face (blob shadows, warning rings)
scene.add(new THREE.AmbientLight(0xffffff, 0.63 * Math.PI));
const sun = new THREE.DirectionalLight(0xffffff, 0.37 * Math.PI);
sun.target.position.set(0, 4, -3);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 120);
sun.castShadow = true;
// Only the static hill casts, so the map renders once. It is sized once at load (an
// on-demand shadow must keep its size); a quality change applies on the next visit.
sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
sun.shadow.autoUpdate = false;
sun.shadow.needsUpdate = true;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.06;
sun.shadow.radius = 2.5;
{
  // Fit the shadow box to the playfield as the sun sees it.
  const probe = new THREE.OrthographicCamera();
  probe.position.copy(sun.position);
  probe.lookAt(sun.target.position);
  probe.updateMatrixWorld();
  const v = new THREE.Vector3();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const x of [-56, 56]) for (const y of [-15, 31]) for (const z of [-65, 59]) {
    v.set(x, y, z).applyMatrix4(probe.matrixWorldInverse);
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
  }
  Object.assign(sun.shadow.camera, { left: x0, right: x1, bottom: y0, top: y1, near: Math.max(0.5, -z1 - 2), far: -z0 + 2 });
  sun.shadow.camera.updateProjectionMatrix();
}
scene.add(sun, sun.target);

const post = createPost(kit, scene, camera);

/* ----------------------------------------------------------------- materials */

const DS = THREE.DoubleSide; // the old renderer never culled faces
/** Lambert lit with the stored normal on both sides, like the original shader. */
function lit(params = {}) {
  const m = new THREE.MeshLambertNodeMaterial({ side: DS, ...params });
  m.normalNode = normalViewGeometry;
  return m;
}

// The hill: vertex colours times the original's per-surface patterns.
const terrainMat = lit({ vertexColors: true });
terrainMat.name = 'terrain';
{
  const s = attribute('terrainKind', 'float');
  const p = positionWorld;
  const ripple = sin(p.x.mul(7.7).add(p.z.mul(3.1))).mul(sin(p.z.mul(9.4).sub(p.x.mul(4.1)))).mul(0.026).add(0.98);
  const cells = floor(p.x.mul(0.55)).add(floor(p.z.mul(0.55))).add(floor(p.y.mul(0.7)));
  const checker = cells.sub(floor(cells.mul(0.5)).mul(2)); // GLSL mod(cells, 2), negatives included
  const cliff = checker.mul(0.13).add(0.89);
  const speck = step(0.84, fract(sin(dot(floor(p.xz.mul(5)), vec2(12.9898, 78.233))).mul(43758.5453)));
  const dirt = float(1).sub(speck.mul(0.065));
  const k = select(s.lessThan(0.5), float(1), select(s.lessThan(1.5), ripple, select(s.lessThan(2.5), cliff, dirt)));
  terrainMat.colorNode = vec4(vec3(k), 1);
}

// The creek: see-through, with the moving glints added after lighting.
const uClock = uniform(0);
const waterMat = lit({ color: 0x52b8c5, transparent: true, opacity: 0.86, depthWrite: false });
waterMat.name = 'water';
{
  const p = positionWorld;
  const w = sin(p.x.mul(1.8).add(uClock.mul(1.4))).mul(sin(p.z.mul(2.8).sub(uClock.mul(0.9))));
  waterMat.emissiveNode = vec3(0.08, 0.09, 0.09).mul(smoothstep(float(0.55), float(0.85), w));
}

const actorMat = lit();
actorMat.name = 'actors';
const particleMat = lit({ transparent: true });
particleMat.name = 'particles';
const blobMat = new THREE.MeshBasicNodeMaterial({ side: DS, transparent: true, depthWrite: false });
blobMat.name = 'blob shadows';

/* ------------------------------------------------------------------ geometry */

const geos = {};
for (const [name, arr] of Object.entries(SHAPES)) {
  const n = arr.length / 6, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = arr[i * 6]; pos[i * 3 + 1] = arr[i * 6 + 1]; pos[i * 3 + 2] = arr[i * 6 + 2];
    nor[i * 3] = arr[i * 6 + 3]; nor[i * 3 + 1] = arr[i * 6 + 4]; nor[i * 3 + 2] = arr[i * 6 + 5];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  geos[name] = g;
}

const scenery = buildScenery();
const { colliders, checkpoints } = scenery;
function staticMesh(a, material, shadows) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  if (material.vertexColors) {
    g.setAttribute('color', new THREE.BufferAttribute(a.color, 3));
    g.setAttribute('terrainKind', new THREE.BufferAttribute(a.surface, 1));
  }
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = mesh.receiveShadow = shadows;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
  return mesh;
}
staticMesh(scenery.world, terrainMat, true).name = 'hill';
staticMesh(scenery.backdrop, terrainMat, false).name = 'horizon';
const creek = staticMesh(scenery.water, waterMat, false);
creek.name = 'creek';
creek.renderOrder = 1; // see-through passes in the original's order: water, then sparks, then blob shadows

/* -------------------------------------------------------------- actor batches
 * One instanced batch per shape. Drawing a part writes its matrix and colour
 * into the next slot; flush() uploads only the used range. An empty batch keeps
 * one collapsed instance so its pipeline stays compiled (no hitch later).
 */
function makeBatch(shape, material, capacity, withAlpha = false) {
  const mesh = kit.instanced(geos[shape], material, capacity);
  const total = mesh.instanceMatrix.count;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3).fill(1), 3);
  mesh.frustumCulled = false;
  mesh.receiveShadow = !withAlpha || material === particleMat;
  mesh.name = `${material.name}: ${shape}`;
  mesh.count = 1;
  const b = { mesh, cap: total, n: 0, m: mesh.instanceMatrix.array, c: mesh.instanceColor.array, alpha: null, a: null };
  if (withAlpha) {
    b.alpha = new THREE.InstancedBufferAttribute(new Float32Array(total).fill(1), 1);
    b.a = b.alpha.array;
    material.opacityNode = instancedBufferAttribute(b.alpha);
  }
  scene.add(mesh);
  return b;
}
const batches = {};
for (const [shape, cap] of [['box', 1400], ['ball', 700], ['cyl', 700], ['rock', 80], ['cone', 16], ['star', 80], ['flag', 8], ['disc', 16]]) batches[shape] = makeBatch(shape, actorMat, cap);
const particleBatch = makeBatch('box', particleMat, 700, true);
const blobBatch = makeBatch('disc', blobMat, 64, true);
particleBatch.mesh.renderOrder = 2;
blobBatch.mesh.renderOrder = 3;
const allBatches = [...Object.values(batches), particleBatch, blobBatch];
// A speck far under the hill: what an empty batch draws (a zero scale would divide normals by zero).
const PARKED = new Float32Array([1e-4, 0, 0, 0, 0, 1e-4, 0, 0, 0, 0, 1e-4, 0, 0, -1000, 0, 1]);

const _t = new Float32Array(16), _m = new Float32Array(16);
const mA = M.id(), mB = M.id();
function put(b, m, col, alpha) {
  if (b.n >= b.cap) return;
  b.m.set(m, b.n * 16);
  const k = b.n * 3;
  b.c[k] = col[0]; b.c[k + 1] = col[1]; b.c[k + 2] = col[2];
  if (b.a) b.a[b.n] = alpha;
  b.n++;
}
function draw(shape, m, col) {
  put(batches[shape], m, col, 1);
}
function part(shape, parent, col, x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  M.trs(_t, x, y, z, rx, ry, rz, sx, sy, sz);
  M.mul(_m, parent, _t);
  put(batches[shape], _m, col, 1);
}
function flush(b) {
  let n = b.n;
  if (n === 0) {
    b.m.set(PARKED, 0);
    if (b.a) b.a[0] = 0;
    n = 1;
  }
  b.mesh.count = n;
  const im = b.mesh.instanceMatrix, ic = b.mesh.instanceColor;
  im.clearUpdateRanges(); im.addUpdateRange(0, n * 16); im.needsUpdate = true;
  ic.clearUpdateRanges(); ic.addUpdateRange(0, n * 3); ic.needsUpdate = true;
  if (b.alpha) {
    b.alpha.clearUpdateRanges(); b.alpha.addUpdateRange(0, n); b.alpha.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------- colours */

const COL = {
  boot: color('#6e4531'), shirt: color('#dd5b43'), sleeve: color('#df5b43'), hair: color('#744c36'), mouth: color('#a26044'),
  cap: color('#f47b38'), brim: color('#e05b30'), scarf: color('#6dbcca'), scarfTail: color('#63aab9'),
  coinRedIn: color('#ff9272'), coinGoldIn: color('#ffe58a'), coinRedMark: color('#ffe0b6'), coinGoldMark: color('#fff6b5'),
  blue: color('#4f8fe6'), blueIn: color('#9cc8ff'), blueMark: color('#e6f2ff'),
  crateGold: color('#f3bd3b'), crateWood: color('#bd8750'), trimGold: color('#ffda65'), trimWood: color('#e2b777'),
  goombaFoot: color('#72503a'), goombaBody: color('#c48b42'), goombaHead: color('#e8b55b'),
  bossFoot: color('#e6ae4e'), bossHurt: C.cream, bossDizzy: color('#9a91a2'), bossWind: color('#a86569'), bossBody: color('#656779'), bossJaw: color('#777989'),
  pip: color('#478e9b'), pipFoot: color('#e4784b'), pipPack: color('#8c754b'),
  boulder: color('#606e74'), crateBits: color('#cc8f50'), steam: color('#d5f7ee'), dust: color('#e6d4a4'), cannonPuff: color('#ebdfb8'), bossDust: color('#8c86a4'),
  rollo: color('#8d9aa3'), rolloHurt: color('#a8b4bc'), switchBase: color('#2f5f9a'), switchCap: color('#5aa0ea'),
  blob: color('#244f3a').map((v) => v * UP_SHADE), warn: color('#f3a07d').map((v) => v * UP_SHADE),
};

/* ---------------------------------------------------------------- game state */

const coinList = [], crates = [], enemies = [], starsList = [], particles = [], floaters = [];
let boulders = [];
let baseCoinCount = 0;
const boss = {};
const hero = {};
const rollo = { x: ROLLO_BASE.x, z: ROLLO_BASE.z, y: 0, t: 0, yaw: 0, hop: 0, phase: 0, state: 'base' };
const race = { state: 'off', count: 0, lastCount: 0, time: 0 };
const sw = { x: BLUE_SWITCH.x, z: BLUE_SWITCH.z, pressed: false, timer: 0, reset: 0, lastTick: 0 };
const prefs = { retro: false, muted: false, music: true };
const P = { jump: false, attack: false, pound: false, flag: false };
const ui = { boss: null, bossTip: '', race: false, blue: '', damage: -1 };
let cameraYaw = 0, cameraPitch = 0.3, cameraDistance = 12.8;
const camPos = new THREE.Vector3(-8, 6, 55), camAt = new THREE.Vector3(-8, 2.3, 42);
let audio = null;

const freshState = () => ({
  mode: 'title', time: 0, coins: 0, red: 0, stars: [], falls: 0, checkpoint: 0, banner: 0, toast: 0, shake: 0, damage: 0,
  respawn: 0, winDelay: 0, dialogue: [], dialogueIndex: 0, dialogueDone: null, returnMode: 'title', bossNotice: false,
  skyNotice: false, hundredOut: false, saveClock: 0,
});
const state = { ...freshState(), started: false, clock: 0 };

let saved = { stars: [], best: null, run: null, retro: false, music: true };
try {
  const s2 = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (s2 && Array.isArray(s2.stars)) saved = { ...saved, ...s2 };
  else {
    const s1 = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null');
    if (s1 && Array.isArray(s1.stars)) saved.stars = s1.stars;
  }
} catch {
  /* private mode or a broken save: start fresh */
}
saved.stars = saved.stars.filter((id) => STAR_IDS.includes(id));
prefs.retro = !!saved.retro;
prefs.music = saved.music !== false;

function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable */
  }
}
function saveStars() {
  saved.stars = [...new Set([...saved.stars, ...state.stars])];
  persist();
}
function saveRun() {
  if (!state.started) return;
  saved.run = snapshot();
  saveStars();
}

/* ------------------------------------------------------------ level contents */

function ground(x, z, feet = 100, boxes = true) {
  let g = groundBase(x, z);
  if (hypot(x - island.x, z - island.z) < island.r && feet > island.y - 0.55) g = { h: island.y, type: 1, road: true };
  if (boxes) {
    for (const c of crates) {
      if (!c.dead && Math.abs(x - c.x) < c.size / 2 + 0.2 && Math.abs(z - c.z) < c.size / 2 + 0.2 && feet >= c.y + c.size - 0.5 && c.y + c.size > g.h) g = { h: c.y + c.size, type: 0, road: true };
    }
    const top = sw.pressed ? 0.22 : 0.34;
    if (Math.abs(x - sw.x) < 0.78 && Math.abs(z - sw.z) < 0.78 && feet >= top - 0.5 && top > g.h) g = { h: top, type: 0, road: true };
  }
  return g;
}

function addCoin(x, z, y = null, kind = 'gold') {
  if (y === null) y = groundBase(x, z).h + 1.15;
  const c = { x, y, z, red: kind === 'red', blue: kind === 'blue', hidden: kind === 'blue', got: false, phase: Math.random() * TAU };
  coinList.push(c);
  return c;
}

function populate() {
  coinList.length = crates.length = enemies.length = starsList.length = particles.length = 0;
  for (const f of floaters) f.el.remove();
  floaters.length = 0;
  for (let z = 37; z >= 12; z -= 3.3) addCoin(-8, z, groundBase(-8, z).h + 1.1);
  for (let t = 0.02; t < 0.97; t += 0.028) {
    const p = route(t);
    addCoin(p.x, p.z, p.y + 1.1);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    addCoin(24 + Math.sin(a) * 3, 12 + Math.cos(a) * 3);
  }
  for (let i = 0; i < 7; i++) addCoin(-15 - i * 2.6, 8 + Math.sin(i) * 1.1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    addCoin(-21 + Math.sin(a) * 2, 36 + Math.cos(a) * 2);
  }
  for (const p of [[-21, 36], [-8, 21], [24, 12], [-34, 10]]) addCoin(p[0], p[1], null, 'red');
  for (const t of [0.26, 0.57, 0.84]) {
    const p = route(t);
    addCoin(p.x + Math.sin(p.a) * 1.2, p.z + Math.cos(p.a) * 1.2, p.y + 1.25, 'red');
  }
  addCoin(-34, -15, island.y + 1.1, 'red');
  for (const [x, z] of BLUE_COINS) addCoin(x, z, groundBase(x, z).h + 1.15, 'blue');
  baseCoinCount = coinList.length;
  for (const p of [[-2, 34], [-0.1, 34], [15, 14], [-25, 4], [-34, -11]]) {
    const gold = p[1] === -11;
    crates.push({ x: p[0], z: p[1], y: gold ? island.y : 0, size: gold ? 1.6 : 1.5, gold, dead: false });
  }
  for (const p of [[-2, 31], [4, 16], [21, 16], [-19, 7], [-26, 32], [31, 32]]) {
    enemies.push({ x: p[0], z: p[1], y: groundBase(p[0], p[1]).h, sx: p[0], sz: p[1], yaw: Math.random() * TAU, phase: Math.random() * TAU, dead: false, squash: 0 });
  }
  boulders = [{ t: 0.88 }, { t: 0.6 }, { t: 0.32 }];
  for (const b of boulders) placeBoulder(b);
  Object.assign(boss, { x: 8, z: -20, y: 22, hp: 3, state: 'idle', time: 1, yaw: 0, dx: 0, dz: 0, active: false, hurt: 0, dead: false });
  Object.assign(hero, { x: -8, y: 0, z: 42, vx: 0, vy: 0, vz: 0, yaw: Math.PI, grounded: true, health: 8, inv: 0, combo: 0, landTime: -10, lastJump: -10, jumpBuffer: 0, coyote: 0, pound: 0, diving: false, attack: 0, shot: 0, scaleY: 1, step: 0 });
  for (const f of checkpoints) f.active = false;
  Object.assign(rollo, { x: ROLLO_BASE.x, z: ROLLO_BASE.z, y: groundBase(ROLLO_BASE.x, ROLLO_BASE.z).h, t: 0, hop: 0, state: 'base' });
  Object.assign(race, { state: 'off', count: 0, lastCount: 0, time: 0 });
  Object.assign(sw, { pressed: false, timer: 0, reset: 0, lastTick: 0 });
}
function placeBoulder(b) {
  const p = route(b.t);
  b.x = p.x;
  b.z = p.z;
  b.y = p.y + 0.8;
}

const ROLLO_SUMMIT = { x: 5.2, z: -15.6 };
function rolloToSummit() {
  Object.assign(rollo, { state: 'summit', x: ROLLO_SUMMIT.x, z: ROLLO_SUMMIT.z, y: 22, hop: 0 });
}
function rolloToBase() {
  Object.assign(rollo, { state: 'base', x: ROLLO_BASE.x, z: ROLLO_BASE.z, y: groundBase(ROLLO_BASE.x, ROLLO_BASE.z).h, hop: 0, t: 0 });
}

/* --------------------------------------------------------------- save / load */

const bits = (arr, f) => arr.map((x) => (f(x) ? '1' : '0')).join('');
const r2 = (v) => Math.round(v * 100) / 100;
function snapshot() {
  return {
    v: 2,
    stars: [...state.stars], coins: state.coins, red: state.red, time: Math.round(state.time * 10) / 10, falls: state.falls,
    got: bits(coinList.slice(0, baseCoinCount), (c) => c.got),
    extra: coinList.slice(baseCoinCount).filter((c) => !c.got).map((c) => [r2(c.x), r2(c.y), r2(c.z)]),
    crates: bits(crates, (c) => c.dead), enemies: bits(enemies, (e) => e.dead),
    boss: { hp: boss.hp, dead: boss.dead }, cp: state.checkpoint, flags: bits(checkpoints, (f) => f.active),
    out: starsList.map((s) => [s.id, r2(s.x), r2(s.y), r2(s.z)]), hundredOut: state.hundredOut, rollo: rollo.state === 'summit',
  };
}
function applySnapshot(s) {
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  state.stars = (Array.isArray(s.stars) ? s.stars : []).filter((id, i, a) => STAR_IDS.includes(id) && a.indexOf(id) === i);
  state.coins = Math.max(0, num(s.coins));
  state.red = clamp(num(s.red), 0, 8);
  state.time = Math.max(0, num(s.time));
  state.falls = Math.max(0, num(s.falls));
  const got = String(s.got || '');
  for (let i = 0; i < baseCoinCount && i < got.length; i++) coinList[i].got = got[i] === '1';
  for (const e of Array.isArray(s.extra) ? s.extra.slice(0, 80) : []) if (Array.isArray(e) && e.every(Number.isFinite)) addCoin(e[0], e[2], e[1]);
  crates.forEach((c, i) => (c.dead = String(s.crates || '')[i] === '1'));
  enemies.forEach((e, i) => (e.dead = String(s.enemies || '')[i] === '1'));
  if (s.boss) {
    boss.dead = !!s.boss.dead;
    boss.hp = boss.dead ? 0 : clamp(num(s.boss.hp, 3), 1, 3);
  }
  checkpoints.forEach((f, i) => (f.active = String(s.flags || '')[i] === '1'));
  state.checkpoint = clamp(num(s.cp) | 0, 0, checkpoints.length - 1);
  checkpoints[state.checkpoint].active = true;
  for (const o of Array.isArray(s.out) ? s.out : []) {
    if (Array.isArray(o) && STAR_IDS.includes(o[0]) && !state.stars.includes(o[0]) && !starsList.some((x) => x.id === o[0])) starsList.push({ id: o[0], x: num(o[1]), y: num(o[2]), z: num(o[3]), phase: 0 });
  }
  state.hundredOut = !!s.hundredOut || state.stars.includes('hundred') || starsList.some((x) => x.id === 'hundred');
  if (coinList.every((c) => !c.blue || c.got)) sw.pressed = true; // every blue coin banked: the switch stays down
  if (s.rollo || state.stars.includes('race')) rolloToSummit();
  if (boss.dead) state.bossNotice = true;
}

/* ------------------------------------------------------------------- prompts */

const PROMPTS = {
  keyboard: { move: 'W A S D', jump: 'SPACE', attack: 'X', pound: 'SHIFT', long: 'SHIFT + SPACE', camera: 'Q E', orbit: 'DRAG', zoom: 'WHEEL', flag: 'R', pause: 'ESC', go: 'ENTER' },
  gamepad: { move: 'L STICK', jump: 'A', attack: 'X', pound: 'LT', long: 'LT + A', camera: 'R STICK', orbit: 'R STICK', zoom: 'LB RB', flag: 'BACK', pause: 'START', go: 'A' },
  touch: { move: 'STICK', jump: 'JUMP', attack: 'PUNCH', pound: 'POUND', long: 'POUND + JUMP', camera: 'DRAG', orbit: 'DRAG', zoom: 'PINCH', flag: 'MENU', pause: 'II', go: 'TAP' },
};
const src = () => (PROMPTS[input.source] ? input.source : 'keyboard');
const key = (a) => `<kbd>${PROMPTS[src()][a]}</kbd>`;
function renderPrompts() {
  const k = PROMPTS[src()];
  $('control-strip').innerHTML = `<span>${key('move')} Move</span><span>${key('jump')} Jump</span><span>${key('attack')} Attack</span><span>${key('pound')} Crouch / pound</span><span>${key('camera')} Camera</span>`;
  $('pause-controls').innerHTML = `<span>${key('move')} Move</span><span>${key('jump')} Jump</span><span>${key('attack')} Punch / dive / use</span><span>${key('pound')} Crouch / air pound</span><span>${key('long')} Long jump</span><span>${key('camera')} Turn camera</span><span>${key('zoom')} Zoom camera</span><span>${key('flag')} Return to flag</span>`;
  $('help-note').textContent = `Use ${k.move} and ${k.jump}. ${k.attack} attacks or uses nearby objects. ${k.pound} crouches on the ground and pounds in the air. ${k.long} makes a long jump while running. ${k.orbit} turns the camera. Keyboard, gamepad and touch all work.`;
  $('start-sub').textContent = input.source === 'gamepad' ? 'Press A to start · Sound starts with play' : input.source === 'touch' ? 'Tap to start · Sound starts with play' : 'Press Enter to start · Sound starts with play';
  $('dialogue-more').textContent = input.source === 'gamepad' ? 'A TO CONTINUE ▸' : input.source === 'touch' ? 'TAP TO CONTINUE ▸' : 'SPACE / X / ENTER TO CONTINUE ▸';
  contextualHint();
}
input.onSourceChange(renderPrompts);

/* ------------------------------------------------------------- audio & sound */

function unlock() {
  try {
    if (!audio) {
      audio = new AudioEngine(MUSIC_URL);
      audio.onError = toast;
    }
    audio.resume();
  } catch {
    /* no Web Audio here */
  }
}
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => state.started && unlock(), { passive: true });
const sfx = (n, e = 0) => audio && audio.fx(n, e);
/** Push mute, music and pause state to the mixer (every frame, and when the tab hides: no frames run then). */
function syncAudio() {
  if (audio) audio.update({ started: state.started, muted: prefs.muted, music: prefs.music, quiet: state.mode === 'pause' || state.mode === 'help' });
}
kit.onPause((paused) => {
  if (!audio) return;
  if (paused) audio.suspend();
  else if (state.started) audio.resume();
});

/* ------------------------------------------------------------------- UI bits */

const redDots = [];
{
  const el = $('red-count');
  for (let i = 0; i < 8; i++) {
    const d = document.createElement('span');
    d.className = 'red-dot';
    el.append(d);
    redDots.push(d);
  }
  const s = document.createElement('small');
  s.textContent = 'RED COINS';
  el.append(s);
}
function setMode(m) {
  state.mode = m;
  kit.touch?.suspend(m !== 'play', 'game');
}
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  state.toast = 3.2;
}
function banner(k, t, s, duration = 4.5) {
  $('banner-kicker').textContent = k;
  $('banner-title').textContent = t;
  $('banner-sub').textContent = s;
  $('goal-banner').classList.add('show');
  state.banner = duration;
}
function hud() {
  $('coins').textContent = String(state.coins).padStart(2, '0');
  $('stars').textContent = state.stars.length;
  $('power').dataset.hp = hero.health;
  $('power').style.background = `conic-gradient(${hero.health > 3 ? '#63b962' : '#e6694c'} ${(hero.health / 8) * 100}%,#cfd5b9 0)`;
  redDots.forEach((el, i) => el.classList.toggle('on', i < state.red));
  $('boss-health').style.width = (boss.hp / 3) * 100 + '%';
}
function nextGoal() {
  const s = state.stars;
  if (!s.includes('king')) return 'Follow the dirt path to the Pebble King.';
  if (!s.includes('race')) return 'Rollo waits at the foot of the summit path.';
  if (!s.includes('sky')) return 'The west-side cannon points to a sky island.';
  if (!s.includes('red')) return 'Find all eight red coins for another star.';
  if (!s.includes('hundred')) return 'Reach 100 coins. The blue switch by the creek helps.';
  return 'Every star found. Explore all you like.';
}
function missionText() {
  $('mission-text').textContent = state.stars.length >= STAR_TOTAL ? 'All five stars found. Nice work!' : !state.stars.includes('king') ? 'Follow the path. Beat the king.' : nextGoal();
}
function timeText(t) {
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
}
function titleSave() {
  const spans = $('save-stars').querySelectorAll('span');
  spans.forEach((s, i) => s.classList.toggle('got', i < saved.stars.length));
  const n = saved.stars.length;
  $('save-stars').querySelector('small').textContent = n ? (n >= STAR_TOTAL && saved.best ? `ALL STARS · BEST ${timeText(saved.best)}` : `${n} / ${STAR_TOTAL} STARS FOUND`) : 'FIVE STARS TO FIND';
  const run = saved.run;
  $('start-label').textContent = run ? `CONTINUE · ${(run.stars || []).length} / ${STAR_TOTAL} ★` : 'PLAY — LET’S GO!';
  $('new-run-btn').classList.toggle('hidden', !run);
}
function setBossHud(on) {
  if (ui.boss === on) return;
  ui.boss = on;
  $('boss-hud').classList.toggle('hidden', !on);
}
function setBossTip(text) {
  if (ui.bossTip === text) return;
  ui.bossTip = text;
  $('boss-tip').textContent = text;
}

/* ---------------------------------------------------------------- menus & nav */

const menuRoots = { title: $('title'), pause: $('pause'), help: $('help'), victory: $('victory') };
const shown = (b) => !b.disabled && b.getClientRects().length > 0;
/** A menu's buttons in focus order; the title also reaches the top bar (guide, settings, sound). */
const visibleButtons = (root) => {
  const list = [...root.querySelectorAll('button')];
  if (root === menuRoots.title) list.push($('info-btn'), $('settings-btn'), $('sound-btn'));
  return list.filter(shown);
};
function focusMenu(root) {
  const first = visibleButtons(root)[0];
  if (first) first.focus({ preventScroll: true });
}
function clearFocus() {
  const el = document.activeElement;
  if (el && el !== document.body && el.blur) el.blur();
}
function moveFocus(root, dir) {
  const list = visibleButtons(root);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const next = i < 0 ? list[0] : list[(i + dir + list.length) % list.length];
  next.focus({ preventScroll: true });
  for (const b of document.querySelectorAll('.nav-focus')) b.classList.remove('nav-focus');
  next.classList.add('nav-focus');
  sfx('click');
}
document.addEventListener('focusout', (e) => e.target?.classList?.remove('nav-focus'));
const nav = { dir: 0, held: 0 };
function menuInput(dt) {
  const root = menuRoots[state.mode];
  if (!root) return;
  const v = input.vector('move');
  const dir = v.y > 0.5 || v.x < -0.5 ? -1 : v.y < -0.5 || v.x > 0.5 ? 1 : 0;
  if (dir !== nav.dir) {
    nav.dir = dir;
    nav.held = 0;
    if (dir) moveFocus(root, dir);
  } else if (dir) {
    nav.held += dt;
    if (nav.held > 0.38) {
      nav.held -= 0.14;
      moveFocus(root, dir);
    }
  }
  // Start on a controller also starts from the title (Esc does not).
  const padStart = state.mode === 'title' && input.source === 'gamepad' && input.pressed('pause');
  if (input.pressed('confirm') || padStart) {
    const list = visibleButtons(root);
    const target = list.includes(document.activeElement) ? document.activeElement : list[0];
    target?.click();
  } else if (input.pressed('back') || input.pressed('pause')) {
    if (state.mode === 'pause') resumeGame();
    else if (state.mode === 'help') closeHelp();
    else if (state.mode === 'victory') continueGame();
  }
}

/* ------------------------------------------------------------- flow & modes */

function beginRun(snap) {
  populate();
  Object.assign(state, freshState());
  state.started = true;
  accum = 0;
  if (snap) {
    try {
      applySnapshot(snap);
    } catch {
      populate();
      Object.assign(state, freshState());
      state.started = true;
      snap = null;
    }
  }
  for (const id of ['title', 'pause', 'victory', 'help', 'dialogue']) $(id).classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('info-btn').classList.add('hidden');
  $('settings-btn').classList.add('hidden');
  $('pause-btn').classList.remove('hidden');
  document.body.classList.add('playing');
  $('fade').style.opacity = '0';
  clearFocus();
  setMode('play');
  unlock();
  clearPressed();
  input.settle();
  if (snap) {
    finishRespawn(true);
    banner('WELCOME BACK', `${state.stars.length} of ${STAR_TOTAL} stars so far`, nextGoal(), 5);
  } else {
    camPos.set(-8, 6, 55);
    camAt.set(-8, 2.3, 42);
    cameraYaw = 0;
    cameraPitch = 0.3;
    checkpoints[0].active = true;
    banner('YOUR FIRST STAR', 'King of the hill', 'Follow the coins to the summit.', 6);
  }
  ui.boss = null;
  setBossHud(false);
  sfx('flag');
  hud();
  missionText();
  minimap();
  contextualHint();
  saveRun();
}
function startFromTitle() {
  if (state.mode !== 'title') return;
  beginRun(saved.run || null);
}
function newRunFromTitle() {
  if (state.mode !== 'title') return;
  saved.run = null;
  persist();
  beginRun(null);
}
function pauseGame() {
  if (state.mode !== 'play') return;
  setMode('pause');
  $('pause').classList.remove('hidden');
  renderPrompts();
  focusMenu($('pause'));
  sfx('click');
  saveRun();
}
function resumeGame() {
  if (state.mode !== 'pause') return;
  setMode('play');
  $('pause').classList.add('hidden');
  clearFocus();
  clearPressed();
  input.settle();
  unlock();
  sfx('click');
}
function continueGame() {
  if (state.mode !== 'victory') return;
  setMode('play');
  $('victory').classList.add('hidden');
  clearFocus();
  clearPressed();
  input.settle();
  state.winDelay = 0;
  hero.inv = 2;
  sfx('click');
  const left = STAR_TOTAL - state.stars.length;
  if (!left) banner('COURSE COMPLETE', 'Every star. Every bit of trouble.', 'Explore the hill, or start a new run from the pause menu.', 6);
  else banner('BACK TO THE ADVENTURE', `${left} more ${left === 1 ? 'star' : 'stars'} to find`, nextGoal(), 5);
}
function restartRun() {
  if (state.mode !== 'pause' && state.mode !== 'victory') return;
  beginRun(null);
}
function toggleSound() {
  unlock();
  prefs.muted = !prefs.muted;
  $('sound-waves').setAttribute('d', prefs.muted ? 'M16 9l6 6m0-6-6 6' : 'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14');
  $('sound-btn').title = prefs.muted ? 'Sound off (M)' : 'Sound on (M)';
  toast(prefs.muted ? 'Sound off' : 'Sound on');
}
function openHelp() {
  if (state.mode === 'help') return;
  state.returnMode = state.mode;
  setMode('help');
  renderPrompts();
  $('help').classList.remove('hidden');
  focusMenu($('help'));
}
function closeHelp() {
  if (state.mode !== 'help') return;
  setMode(state.returnMode);
  $('help').classList.add('hidden');
  const back = menuRoots[state.mode];
  if (back) focusMenu(back);
  else clearFocus();
  input.settle();
}
function dialogue(name, pages, onDone = null) {
  setMode('dialogue');
  state.dialogue = pages;
  state.dialogueIndex = 0;
  state.dialogueDone = onDone;
  $('dialogue-name').textContent = name;
  $('dialogue-text').textContent = pages[0];
  $('dialogue').classList.remove('hidden');
  sfx('click');
}
function nextDialogue() {
  if (state.mode !== 'dialogue') return;
  state.dialogueIndex++;
  sfx('click');
  if (state.dialogueIndex >= state.dialogue.length) {
    setMode('play');
    $('dialogue').classList.add('hidden');
    clearFocus();
    clearPressed();
    input.settle();
    const done = state.dialogueDone;
    state.dialogueDone = null;
    done?.();
  } else $('dialogue-text').textContent = state.dialogue[state.dialogueIndex];
}
function applyRetro() {
  document.body.classList.toggle('retro', prefs.retro);
  kit.setPixelHeight(prefs.retro ? Math.round(Math.min(400, (640 * kit.size.height) / Math.max(1, kit.size.width))) : 0);
  $('retro-btn').textContent = 'PICTURE: ' + (prefs.retro ? 'RETRO' : 'CLEAN');
}
function applyMusic() {
  $('music-btn').textContent = 'MUSIC: ' + (prefs.music ? 'ON' : 'OFF');
}

$('start-btn').onclick = startFromTitle;
$('new-run-btn').onclick = newRunFromTitle;
$('resume-btn').onclick = resumeGame;
$('pause-btn').onclick = () => (state.mode === 'play' ? pauseGame() : state.mode === 'pause' ? resumeGame() : null);
$('restart-btn').onclick = restartRun;
$('win-restart-btn').onclick = restartRun;
$('continue-btn').onclick = continueGame;
$('sound-btn').onclick = toggleSound;
$('info-btn').onclick = openHelp;
$('pause-guide').onclick = openHelp;
$('help-close').onclick = closeHelp;
$('dialogue-next').onclick = nextDialogue;
$('settings-btn').onclick = () => kit.menu.open();
$('pause-settings').onclick = () => kit.menu.open();
$('flag-btn').onclick = () => {
  if (state.mode !== 'pause') return;
  resumeGame();
  respawn(false);
};
$('retro-btn').onclick = () => {
  prefs.retro = !prefs.retro;
  saved.retro = prefs.retro;
  persist();
  applyRetro();
  sfx('click');
};
$('music-btn').onclick = () => {
  prefs.music = !prefs.music;
  saved.music = prefs.music;
  persist();
  applyMusic();
  unlock();
  sfx('click');
};
$('full-btn').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast('Use your browser’s full-screen control.');
  }
};
addEventListener('blur', () => state.mode === 'play' && pauseGame());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state.mode === 'play') pauseGame();
    saveRun();
  }
  syncAudio();
});
addEventListener('pagehide', saveRun);

/* ------------------------------------------------------------ effects & fx */

function popup(text, x, y, z, col) {
  const el = document.createElement('div');
  el.className = 'float-label';
  el.textContent = text;
  if (col) el.style.color = col;
  $('float-text').appendChild(el);
  floaters.push({ el, x, y, z, life: 1.2 });
}
function burst(x, y, z, col, n = 12, power = 4) {
  const count = n > 1 ? kit.detail(n) : n;
  for (let i = 0; i < count && particles.length < 650; i++) {
    particles.push({ x, y, z, vx: range(-power, power), vy: range(2, power * 1.7), vz: range(-power, power), life: range(0.35, 0.85), size: range(0.07, 0.18), col, rot: Math.random() * TAU });
  }
}
function spawnStar(id, x, y, z) {
  if (state.stars.includes(id) || starsList.some((s) => s.id === id)) return;
  starsList.push({ id, x, y, z, phase: 0 });
  burst(x, y, z, C.gold, 25, 5);
  sfx('flag');
}
const STAR_INFO = {
  king: ['King of the hill!', 'One less grumpy king. One more star.'],
  red: ['Seeing red!', 'Eight red coins. One very good detour.'],
  sky: ['A little air time!', 'A big leap of faith. A bright reward.'],
  race: ['Rollo’s rematch!', 'First to the summit. Rollo is still catching his breath.'],
  hundred: ['A hundred coins!', 'Every coin counts. Every single one.'],
};
function getStar(s) {
  if (state.stars.includes(s.id)) return;
  state.stars.push(s.id);
  starsList.splice(starsList.indexOf(s), 1);
  setMode('winanim');
  state.winDelay = 2.1;
  hero.vx = hero.vz = 0;
  hero.vy = 0;
  hero.health = 8;
  hero.diving = false;
  hero.pound = 0;
  sfx('star');
  input.rumble(0.5, 300);
  burst(hero.x, hero.y + 2, hero.z, C.gold, 45, 7);
  hud();
  const [title, desc] = STAR_INFO[s.id];
  $('win-title').textContent = title;
  $('win-desc').textContent = desc;
  const all = state.stars.length >= STAR_TOTAL;
  $('win-kicker').textContent = all ? 'ALL FIVE. ALL YOURS.' : 'THAT’S A SHINY ONE.';
  $('stat-stars').innerHTML = `${state.stars.length} / ${STAR_TOTAL}<small>STARS</small>`;
  $('stat-coins').innerHTML = `${state.coins}<small>COINS</small>`;
  $('stat-time').innerHTML = `${timeText(state.time)}<small>TIME</small>`;
  if (all) {
    if (!saved.best || state.time < saved.best) saved.best = state.time;
    $('win-desc').textContent = 'You found every star on Boulder Bop Hill. Nice work!';
  }
  $('stat-best').classList.toggle('hidden', !(all && saved.best));
  if (saved.best) $('stat-best').innerHTML = `${timeText(saved.best)}<small>BEST</small>`;
  missionText();
  saveRun();
}
function hurt(amount, dx = 0, dz = 1) {
  if (hero.inv > 0 || state.mode !== 'play') return;
  hero.health = Math.max(0, hero.health - amount);
  hero.inv = 2;
  hero.vx = dx * 9;
  hero.vz = dz * 9;
  hero.vy = 8;
  hero.grounded = false;
  hero.diving = false;
  hero.pound = 0;
  state.shake = 0.3;
  state.damage = 0.6;
  sfx('hurt');
  input.rumble(0.6, 180);
  hud();
  if (hero.health <= 0) respawn(true);
}
function respawn(dead = false) {
  if (state.respawn > 0) return;
  state.respawn = 0.65;
  state.falls++;
  hero.health = dead ? 8 : Math.max(1, hero.health - 2);
  if (dead) state.coins = Math.max(0, state.coins - 5);
  $('fade').style.opacity = '1';
  sfx('hurt');
  if (race.state !== 'off') cancelRace();
}
// Where each flag puts the hero back (the first one used to drop him inside Pip).
const FLAG_SPOTS = [[-11.5, 40], [8, 12], [8, -14]];
function finishRespawn(silent = false) {
  const f = checkpoints[state.checkpoint], spot = FLAG_SPOTS[state.checkpoint];
  hero.x = spot[0];
  hero.z = spot[1];
  hero.y = ground(hero.x, hero.z, f.y + 2).h;
  hero.vx = hero.vy = hero.vz = 0;
  hero.grounded = true;
  hero.inv = silent ? 1 : 3;
  hero.pound = 0;
  hero.diving = false;
  hero.shot = 0;
  hero.yaw = Math.PI;
  cameraYaw = 0;
  cameraPitch = 0.3;
  camPos.set(hero.x, hero.y + 8, hero.z + 13);
  camAt.set(hero.x, hero.y + 1.5, hero.z);
  $('fade').style.opacity = '0';
  if (!silent) toast('Back at the flag. Keep going!');
  hud();
}
function collect(c) {
  c.got = true;
  state.coins += c.blue ? 5 : c.red ? 2 : 1;
  hero.health = Math.min(8, hero.health + (c.blue ? 5 : 1));
  if (c.red) {
    state.red++;
    sfx('red', state.red);
    popup(`${state.red} / 8`, c.x, c.y + 1, c.z, '#ff9b78');
    if (state.red === 8) {
      spawnStar('red', 20, 2, 34);
      banner('EIGHT RED COINS', 'A star at the stone ring!', 'Return to the red stone ring near the start.', 6);
    }
  } else if (c.blue) {
    sfx('blue');
    popup('+5', c.x, c.y + 1, c.z, '#cfe4ff');
    if (coinList.every((o) => !o.blue || o.got)) {
      endBlue(true);
      banner('EVERY BLUE COIN', 'Thirty coins richer.', 'The switch stays down.', 3.5);
    }
  } else sfx('coin');
  burst(c.x, c.y, c.z, c.blue ? COL.blue : c.red ? C.red : C.gold, 5, 2);
  if (state.coins >= 100 && !state.hundredOut && !state.stars.includes('hundred')) {
    state.hundredOut = true;
    const g = ground(hero.x, hero.z, hero.y);
    spawnStar('hundred', hero.x, (g.h > -90 ? g.h : hero.y) + 3, hero.z);
    sfx('hundred');
    banner('ONE HUNDRED COINS!', 'A star appears!', 'Jump up and grab it.', 4.5);
  }
  hud();
}
function breakCrate(c) {
  if (c.dead) return;
  c.dead = true;
  burst(c.x, c.y + 0.7, c.z, c.gold ? C.gold : C.wood, 20, 5);
  sfx('break');
  input.rumble(0.3, 70);
  if (c.gold) {
    spawnStar('sky', c.x, c.y + 2, c.z);
    banner('NICE LANDING', 'A little air time', 'Grab the star!', 3);
  } else for (let i = 0; i < 3; i++) addCoin(c.x + Math.sin((i / 3) * TAU) * 0.9, c.z + Math.cos((i / 3) * TAU) * 0.9, c.y + 1.2);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  e.squash = 0.35;
  burst(e.x, e.y + 0.6, e.z, COL.crateBits, 8, 3);
  addCoin(e.x, e.z, e.y + 1.2);
  sfx('attack');
  input.rumble(0.25, 60);
  popup('BOP!', e.x, e.y + 1.7, e.z);
}
function launchCannon() {
  const duration = 1.5;
  hero.x = cannon.x;
  hero.z = cannon.z - 0.8;
  hero.y = 3.1;
  hero.vx = (island.x - hero.x) / duration;
  hero.vz = (island.z - hero.z) / duration;
  hero.vy = (island.y + 0.12 - hero.y + 17 * duration * duration) / duration;
  hero.grounded = false;
  hero.shot = duration;
  hero.pound = 0;
  hero.diving = false;
  hero.inv = duration;
  cameraYaw = 0;
  cameraPitch = 0.46;
  state.shake = 0.4;
  burst(cannon.x, 2, cannon.z - 0.9, COL.cannonPuff, 25, 6);
  sfx('cannon');
  input.rumble(0.8, 320);
  const k = PROMPTS[src()];
  banner('SPECIAL DELIVERY', 'Next stop: the sky.', `Ground-pound the gold box. ${k.jump}, then ${k.pound}.`, 5);
}

/* -------------------------------------------------------------- talk & use */

function interact() {
  const h = hero;
  if (hypot(h.x - PIP.x, h.z - PIP.z) < 3.4 && h.y < 3) {
    const pages = [
      'Hey, new kid! The Pebble King is making a real mess up there. Follow the gold coins to his hill.',
      'When he charges, move out of the way. Once he is dizzy, jump above him and ground-pound. Three hits will do it.',
      'For a longer jump, run, hold crouch, then jump. The west-side cannon is good for a much longer jump!',
    ];
    if (boss.dead && rollo.state !== 'summit') pages.push('Oh, and my pal Rollo hangs out at the bottom of the summit path. He never stops talking about races.');
    if (!sw.pressed && !coinList.some((c) => c.blue && c.got)) pages.push('See the blue switch by the creek? Pound it and run. Blue coins are worth five!');
    dialogue('PIP · LOCAL GUIDE', pages);
    return true;
  }
  if (hypot(h.x - cannon.x, h.z - cannon.z) < 3.4 && h.y < 3) {
    launchCannon();
    return true;
  }
  if (hypot(h.x - SIGNS[0].x, h.z - SIGNS[0].z) < 2.8 && h.y < 3) {
    const k = PROMPTS[src()];
    dialogue('TRAIL SIGN · THE BASICS', [
      `${k.move} moves you. Hold ${k.jump} to jump higher. Jump just after landing for a double jump, then do it again for a triple!`,
      `${k.attack} punches on the ground and dives in the air. ${k.pound} crouches on the ground and pounds in the air. Hold ${k.pound} while running, then jump for a long jump.`,
      `${k.orbit === k.camera ? k.camera : `${k.orbit}, or ${k.camera},`} turns the camera. ${k.flag} returns you to your last flag.`,
    ]);
    return true;
  }
  if (hypot(h.x - SIGNS[1].x, h.z - SIGNS[1].z) < 2.8 && h.y < 3) {
    dialogue('TRAIL SIGN · SUMMIT PATH', [
      'The dirt path goes all the way to the summit. The rocks roll down. You go up. Try not to meet in the middle.',
      'Touch a yellow flag to save your place. Coins restore your power. The grass on the mountain is too steep to run up.',
    ]);
    return true;
  }
  if (hypot(h.x - SIGNS[2].x, h.z - SIGNS[2].z) < 2.8 && h.y < 3) {
    dialogue('TRAIL SIGN · WEST CANNON', ['Hop in the cannon and hold on to your cap. It already knows the way to the sky island.']);
    return true;
  }
  if (hypot(h.x - rollo.x, h.z - rollo.z) < 2.8 && Math.abs(h.y - rollo.y) < 2 && rollo.state !== 'race') {
    talkRollo();
    return true;
  }
  return false;
}
function talkRollo() {
  const name = 'ROLLO · PEBBLE PAL';
  if (rollo.state === 'summit') dialogue(name, ['Good race! Next time I am taking the shortcut.', 'There is no shortcut. Do not tell anyone.']);
  else if (!boss.dead) dialogue(name, ['Hi! I’m Rollo. That grumpy king up there keeps rolling rocks at everyone.', 'Bop him off the hill, then come back. I’ll race you to the top!']);
  else dialogue(name, ['The king’s gone! Finally, the path is ours.', 'Race you to the summit! First one inside the stone ring wins.', 'I’m pretty quick on a hill. Ready?'], beginCountdown);
}

/* -------------------------------------------------------- the summit race (new) */

function heroProgress() {
  const q = trackInfo(hero.x, hero.z);
  if (q.r < 7.2 && hero.y > 21) return 1;
  return q.r < 25.6 ? clamp((25 - q.r) / 17.8, 0, 1) : 0;
}
function beginCountdown() {
  race.state = 'count';
  race.count = 3;
  race.lastCount = 0;
  rollo.state = 'race';
  rollo.t = 0.012;
  rollo.hop = 0;
  hero.x = 8.6;
  hero.z = 8.2;
  hero.y = ground(hero.x, hero.z, 2).h;
  hero.vx = hero.vy = hero.vz = 0;
  hero.grounded = true;
  hero.yaw = Math.PI / 2;
  hero.diving = false;
  hero.pound = 0;
  cameraYaw = -Math.PI / 2;
  cameraPitch = 0.3;
  updateRollo(0);
  ui.race = null;
}
function updateRace(dt) {
  if (race.state === 'count') {
    race.count -= dt;
    const n = Math.ceil(race.count);
    if (n !== race.lastCount && n > 0) {
      race.lastCount = n;
      banner('GET READY', String(n), 'Race Rollo to the stone ring on the summit.', 1.1);
      sfx('count', 0);
    }
    if (race.count <= 0) {
      race.state = 'run';
      race.time = 0;
      banner('GO!', 'Race to the summit!', 'Stay on the path. Dodge the boulders.', 1.6);
      sfx('count', 1);
      input.rumble(0.4, 120);
    }
    return;
  }
  if (race.state !== 'run') return;
  race.time += dt;
  const you = heroProgress();
  // Rollo eases off a little when he is far ahead, so a rough start can still be won.
  const rate = (1 / RACE_SECONDS) * (rollo.t - you > 0.12 ? 0.85 : 1);
  rollo.t = Math.min(1, rollo.t + rate * dt);
  if (hypot(hero.x - 8, hero.z + 18) < 7.2 && hero.y > 21.5) winRace();
  else if (rollo.t >= 1) loseRace();
}
function winRace() {
  race.state = 'off';
  rolloToSummit();
  spawnStar('race', 8, 24, -14.5);
  banner('YOU WIN!', 'Faster than a rolling stone.', `${timeText(race.time)} to the top. Grab the star!`, 4);
  input.rumble(0.6, 200);
  dialogue('ROLLO · PEBBLE PAL', ['Whoa! You’re quick. That star is all yours.']);
}
function loseRace() {
  race.state = 'off';
  rolloToBase();
  sfx('lose');
  dialogue('ROLLO · PEBBLE PAL', ['Ha! Too slow, pal.', 'Meet me at the bottom of the path for a rematch.']);
}
function cancelRace() {
  race.state = 'off';
  rolloToBase();
  toast('Race called off. Rollo is waiting at the bottom.');
}
function updateRollo(dt) {
  const running = rollo.state === 'race' && race.state === 'run';
  rollo.phase += dt * (running ? 11 : 2.2);
  if (rollo.hop > 0) rollo.hop = Math.max(0, rollo.hop - dt);
  if (rollo.state === 'race') {
    const p = route(rollo.t);
    rollo.x = p.x - Math.sin(p.a) * 0.9;
    rollo.z = p.z - Math.cos(p.a) * 0.9;
    rollo.y = groundBase(rollo.x, rollo.z).h;
    rollo.yaw = Math.atan2(Math.cos(p.a), -Math.sin(p.a));
    if (running && rollo.hop <= 0) for (const b of boulders) if (hypot(b.x - rollo.x, b.z - rollo.z) < 2.6 && Math.abs(b.y - 0.8 - rollo.y) < 2) rollo.hop = 0.6;
  } else {
    const aim = Math.atan2(hero.x - rollo.x, hero.z - rollo.z);
    rollo.yaw += Math.atan2(Math.sin(aim - rollo.yaw), Math.cos(aim - rollo.yaw)) * Math.min(1, dt * 3);
  }
}

/* ---------------------------------------------------- blue coin switch (new) */

function pressSwitch() {
  sw.pressed = true;
  sw.timer = BLUE_TIME;
  sw.lastTick = BLUE_TIME;
  for (const c of coinList) if (c.blue && !c.got) c.hidden = false;
  sfx('switch');
  input.rumble(0.5, 160);
  state.shake = 0.2;
  burst(sw.x, 0.5, sw.z, COL.blue, 16, 4);
  banner('BLUE COIN SWITCH', 'Quick! Over the bridge!', 'Each blue coin is worth five.', 3);
}
function endBlue(all) {
  sw.timer = 0;
  for (const c of coinList) if (c.blue && !c.got) c.hidden = true;
  if (!all) {
    sw.reset = 1.2;
    toast('The blue coins faded. The switch pops back up.');
  }
}
function updateSwitch(dt) {
  if (sw.timer > 0) {
    sw.timer -= dt;
    const n = Math.ceil(sw.timer);
    if (n !== sw.lastTick && sw.timer > 0) {
      sw.lastTick = n;
      sfx('tick', n <= 3 ? 1 : 0);
    }
    if (sw.timer <= 0) endBlue(false);
  }
  if (sw.reset > 0) {
    sw.reset -= dt;
    if (sw.reset <= 0) sw.pressed = false;
  }
}

/* -------------------------------------------------------------- hero physics */

function doPound() {
  hero.pound = 0.16;
  hero.vy = 3;
  hero.vx *= 0.15;
  hero.vz *= 0.15;
  hero.diving = false;
  hero.shot = 0;
  sfx('attack');
}
function poundLand() {
  state.shake = 0.24;
  sfx('pound');
  input.rumble(0.35, 90);
  burst(hero.x, hero.y + 0.12, hero.z, C.dirt, 16, 4.5);
  for (const e of enemies) if (!e.dead && hypot(e.x - hero.x, e.z - hero.z) < 2.7 && Math.abs(e.y - hero.y) < 2) killEnemy(e);
  for (const c of crates) if (!c.dead && hypot(c.x - hero.x, c.z - hero.z) < 2.2 && Math.abs(c.y + c.size - hero.y) < 2.5) breakCrate(c);
  if (!sw.pressed && hypot(hero.x - sw.x, hero.z - sw.z) < 1.05 && hero.y < 0.8) pressSwitch();
  hero.pound = 0;
  hero.scaleY = 0.55;
}

// Fixed-step character physics. Terrain, airborne side walls and boxes use separate tests.
function updateHero(dt, inp) {
  const h = hero;
  h.inv = Math.max(0, h.inv - dt);
  h.attack = Math.max(0, h.attack - dt);
  h.shot = Math.max(0, h.shot - dt);
  h.jumpBuffer = Math.max(0, h.jumpBuffer - dt);
  h.coyote = h.grounded ? 0.11 : Math.max(0, h.coyote - dt);
  h.scaleY = mix(h.scaleY, 1, Math.min(1, dt * 12));
  if (P.jump) h.jumpBuffer = 0.14;
  if (P.flag) {
    respawn(false);
    return;
  }
  const speed = hypot(h.vx, h.vz);
  if (P.attack) {
    if (h.grounded) {
      if (interact()) return;
      h.attack = 0.3;
      sfx('attack');
      for (const e of enemies) if (!e.dead && hypot(e.x - h.x, e.z - h.z) < 2.65 && Math.abs(e.y - h.y) < 1.8) killEnemy(e);
      for (const c of crates) if (!c.dead && !c.gold && hypot(c.x - h.x, c.z - h.z) < 2.7 && Math.abs(c.y - h.y) < 1.5) breakCrate(c);
    } else if (!h.diving && h.pound <= 0) {
      h.diving = true;
      h.shot = 0;
      h.vx = Math.sin(h.yaw) * 16;
      h.vz = Math.cos(h.yaw) * 16;
      h.vy = Math.max(h.vy, 3.5);
      sfx('attack');
    }
  }
  if (P.pound && !h.grounded && h.pound <= 0) doPound();
  if (h.jumpBuffer > 0 && (h.grounded || h.coyote > 0) && h.pound <= 0) {
    const long = inp.crouch && speed > 3;
    if (long) {
      h.vy = 10.8;
      const dx = inp.amount > 0.1 ? inp.dx : Math.sin(h.yaw), dz = inp.amount > 0.1 ? inp.dz : Math.cos(h.yaw), l = hypot(dx, dz) || 1;
      h.vx = (dx / l) * 17;
      h.vz = (dz / l) * 17;
      h.shot = 0.58;
      h.combo = 0;
      popup('LONG JUMP!', h.x, h.y + 2, h.z);
    } else {
      h.combo = state.clock - h.landTime < 0.28 && speed > 2.6 ? (h.combo + 1) % 3 : 0;
      h.vy = [13.5, 16, 19.6][h.combo];
      if (h.combo) popup(h.combo === 1 ? 'DOUBLE!' : 'TRIPLE!', h.x, h.y + 2, h.z);
      h.shot = 0;
    }
    h.grounded = false;
    h.coyote = 0;
    h.jumpBuffer = 0;
    h.lastJump = state.clock;
    h.diving = false;
    h.scaleY = 1.2;
    sfx('jump', h.combo);
  }
  if (h.grounded) {
    let target = inp.crouch ? 4.2 : 10.5, acc = inp.amount > 0.05 ? 44 : 48;
    if (h.diving) {
      acc = 17;
      target = 0;
      if (speed < 1.5) h.diving = false;
    }
    const tx = inp.dx * target, tz = inp.dz * target, d = hypot(tx - h.vx, tz - h.vz);
    if (d > 0) {
      const k = Math.min(1, (acc * dt) / d);
      h.vx = mix(h.vx, tx, k);
      h.vz = mix(h.vz, tz, k);
    }
    const g = ground(h.x, h.z, h.y);
    if (g.h < -0.7) {
      h.vx *= 1 - dt * 2;
      h.vz *= 1 - dt * 2;
      if (Math.random() < dt * 9) burst(h.x, -0.55, h.z, COL.steam, 2, 1);
    }
  } else if (h.pound > 0) {
    h.pound -= dt;
    if (h.pound <= 0.001) {
      h.pound = 0.001;
      h.vy = -30;
    }
    h.vx *= Math.max(0, 1 - dt * 12);
    h.vz *= Math.max(0, 1 - dt * 12);
  } else if (!h.diving) {
    const acc = h.shot > 0 ? 2.0 : 18.5;
    if (inp.amount > 0.1) {
      h.vx += inp.dx * acc * dt;
      h.vz += inp.dz * acc * dt;
      const max = h.shot > 0 ? 22 : 10.8, l = hypot(h.vx, h.vz);
      if (l > max && h.shot <= 0) {
        h.vx *= max / l;
        h.vz *= max / l;
      }
    } else if (h.shot <= 0) {
      h.vx *= 1 - dt * 0.3;
      h.vz *= 1 - dt * 0.3;
    }
  }
  if (inp.amount > 0.12 && !h.diving && h.pound <= 0) {
    const aim = Math.atan2(inp.dx, inp.dz), delta = Math.atan2(Math.sin(aim - h.yaw), Math.cos(aim - h.yaw));
    h.yaw += delta * Math.min(1, dt * (h.grounded ? 15 : 7));
  }
  const ox = h.x, oz = h.z, oy = h.y;
  let nx = h.x + h.vx * dt, nz = h.z + h.vz * dt;
  let ng = ground(nx, nz, h.y);
  // The mountain grass is too steep to run up: it pushes back outwards.
  if (h.grounded && ng.q && ng.q.r > 7.4 && ng.q.r < 25.4 && !ng.road) {
    const outx = (nx - 8) / ng.q.r, outz = (nz + 18) / ng.q.r, up = h.vx * outx + h.vz * outz;
    if (up < 0) {
      h.vx -= up * outx;
      h.vz -= up * outz;
    }
    h.vx += outx * 14 * dt;
    h.vz += outz * 14 * dt;
    nx = ox + h.vx * dt;
    nz = oz + h.vz * dt;
    ng = ground(nx, nz, h.y);
  }
  if (ng.h > h.y + (h.grounded ? 0.55 : 0.65) && ng.h < 90) {
    nx = ox;
    nz = oz;
    h.vx *= 0.3;
    h.vz *= 0.3;
  }
  h.x = nx;
  h.z = nz;
  for (const c of colliders) {
    if (h.y >= c.top - 0.12 || h.y + 1.8 < c.y) continue;
    const dx = h.x - c.x, dz = h.z - c.z, d = hypot(dx, dz), r = c.r + 0.45;
    if (d < r && d > 0.001) {
      h.x = c.x + (dx / d) * r;
      h.z = c.z + (dz / d) * r;
    }
  }
  for (const c of crates) {
    if (c.dead || h.y >= c.y + c.size - 0.15 || h.y + 1.7 < c.y) continue;
    const dx = h.x - c.x, dz = h.z - c.z, rr = c.size / 2 + 0.42;
    if (Math.abs(dx) < rr && Math.abs(dz) < rr) {
      if (Math.abs(dx) > Math.abs(dz)) h.x = c.x + Math.sign(dx || 0.01) * rr;
      else h.z = c.z + Math.sign(dz || 0.01) * rr;
    }
  }
  ng = ground(h.x, h.z, h.y);
  if (h.grounded && ng.h > h.y - 0.55 && ng.h <= h.y + 0.55) {
    h.y = ng.h;
    h.vy = 0;
  } else {
    if (h.grounded) {
      h.grounded = false;
      h.vy = Math.min(0, h.vy);
    }
    let gravity = 34;
    if (!inp.jump && h.vy > 0 && h.shot <= 0 && h.pound <= 0) gravity = 59;
    h.vy -= gravity * dt;
    h.y += h.vy * dt;
    ng = ground(h.x, h.z, Math.max(oy, h.y));
    if (h.vy <= 0 && h.y <= ng.h && oy >= ng.h - 0.6) {
      const hard = h.vy < -20;
      h.y = ng.h;
      h.vy = 0;
      h.grounded = true;
      h.landTime = state.clock;
      h.scaleY = hard ? 0.68 : 0.85;
      if (h.pound > 0) poundLand();
      else {
        sfx('land');
        if (speed > 5 || hard) burst(h.x, h.y + 0.08, h.z, C.dirt, 5, 1.8);
      }
      h.shot = 0;
    }
  }
  if (h.y < -20 || !Number.isFinite(h.y)) {
    respawn(h.health <= 2);
    return;
  }
  h.step += hypot(h.vx, h.vz) * dt * 0.82;
  if (h.grounded && hypot(h.vx, h.vz) > 7 && Math.random() < dt * 12) burst(h.x - Math.sin(h.yaw) * 0.3, h.y + 0.1, h.z - Math.cos(h.yaw) * 0.3, COL.dust, 1, 0.5);
  for (const c of coinList) if (!c.got && !c.hidden && hypot(h.x - c.x, h.z - c.z) < 1.05 && Math.abs(h.y + 1 - c.y) < 1.5) collect(c);
  for (const s of starsList) {
    if (hypot(h.x - s.x, h.z - s.z) < 1.3 && Math.abs(h.y + 1.05 - s.y) < 1.6) {
      getStar(s);
      break;
    }
  }
  for (let i = 0; i < checkpoints.length; i++) {
    const f = checkpoints[i];
    if (!f.active && hypot(h.x - f.x, h.z - f.z) < 2.5 && Math.abs(h.y - f.y) < 2) {
      f.active = true;
      state.checkpoint = i;
      hero.health = 8;
      sfx('flag');
      toast('Checkpoint! Power restored.');
      burst(f.x, f.y + 2, f.z, C.gold, 14, 3);
      hud();
      saveRun();
    }
  }
  updateEnemies(dt, oy);
  updateBoss(dt, oy);
  if (h.y > 13.5 && hypot(h.x - island.x, h.z - island.z) < 9 && !state.skyNotice) {
    state.skyNotice = true;
    const k = PROMPTS[src()];
    toast(`The gold box needs a ground pound. ${k.jump}, then ${k.pound}.`);
  }
}

function updateEnemies(dt, prevY) {
  for (const e of enemies) {
    if (e.dead) {
      e.squash = Math.max(0, e.squash - dt);
      continue;
    }
    const d = hypot(hero.x - e.x, hero.z - e.z);
    let aim;
    if (d < 8 && Math.abs(hero.y - e.y) < 2.5) aim = Math.atan2(hero.x - e.x, hero.z - e.z);
    else aim = Math.atan2(e.sx + Math.sin(state.clock * 0.6 + e.phase) * 2.6 - e.x, e.sz + Math.cos(state.clock * 0.6 + e.phase) * 2.6 - e.z);
    e.yaw += Math.atan2(Math.sin(aim - e.yaw), Math.cos(aim - e.yaw)) * Math.min(1, dt * 3);
    const nx = e.x + Math.sin(e.yaw) * (d < 8 ? 2.1 : 1.1) * dt, nz = e.z + Math.cos(e.yaw) * (d < 8 ? 2.1 : 1.1) * dt, g = groundBase(nx, nz);
    if (Math.abs(g.h - e.y) < 0.3 && g.h >= 0) {
      e.x = nx;
      e.z = nz;
      e.y = g.h;
    }
    e.phase += dt * 7;
    if (d < 1.15 && Math.abs(hero.y - e.y) < 2.1) {
      if (!hero.grounded && hero.vy < 0 && prevY > e.y + 0.9) {
        killEnemy(e);
        hero.y = Math.max(hero.y, e.y + 1.25);
        hero.vy = hero.pound > 0 ? 8 : 10.2;
        hero.pound = 0;
        hero.grounded = false;
        sfx('jump');
      } else if (hero.attack > 0 || hero.diving) killEnemy(e);
      else if (hero.y < e.y + 1.3) {
        const dd = Math.max(d, 0.1);
        hurt(1, (hero.x - e.x) / dd, (hero.z - e.z) / dd);
      }
    }
  }
}

function updateBoss(dt, prevY) {
  if (boss.dead) return;
  const h = hero, dist = hypot(h.x - 8, h.z + 18);
  boss.active = h.y > 19 && dist < 10;
  setBossHud(boss.active);
  if (!boss.active) return;
  if (!state.bossNotice) {
    state.bossNotice = true;
    banner('SUMMIT SHOWDOWN', 'The Pebble King', 'Dodge his charge. Ground-pound him when he is dizzy.', 5);
  }
  boss.hurt = Math.max(0, boss.hurt - dt);
  boss.time -= dt;
  const dx = h.x - boss.x, dz = h.z - boss.z;
  let d = hypot(dx, dz) || 0.01;
  if (boss.state === 'idle') {
    const aim = Math.atan2(dx, dz);
    boss.yaw += Math.atan2(Math.sin(aim - boss.yaw), Math.cos(aim - boss.yaw)) * Math.min(1, dt * 4);
    if (boss.time <= 0) {
      boss.state = 'windup';
      boss.time = 0.95;
      boss.dx = dx / d;
      boss.dz = dz / d;
      sfx('boss');
    }
  } else if (boss.state === 'windup') {
    if (boss.time <= 0) {
      boss.state = 'charge';
      boss.time = 1.5;
    }
  } else if (boss.state === 'charge') {
    boss.x += boss.dx * 10.6 * dt;
    boss.z += boss.dz * 10.6 * dt;
    const r = hypot(boss.x - 8, boss.z + 18);
    if (r > 5.25 || boss.time <= 0) {
      if (r > 5.25) {
        boss.x = 8 + ((boss.x - 8) / r) * 5.25;
        boss.z = -18 + ((boss.z + 18) / r) * 5.25;
      }
      boss.state = 'dizzy';
      boss.time = 3.4;
      state.shake = 0.15;
      burst(boss.x, 22.2, boss.z, C.dirt, 13, 4);
      sfx('pound');
      input.rumble(0.3, 100);
    }
  } else if (boss.state === 'dizzy') {
    if (boss.time <= 0) {
      boss.state = 'idle';
      boss.time = 1.15;
    }
  } else if (boss.state === 'hit' && boss.time <= 0) {
    boss.state = 'idle';
    boss.time = 1.1;
  }
  const k = PROMPTS[src()];
  setBossTip(boss.state === 'dizzy' ? `DIZZY! ${k.jump} → ${k.pound} to pound.` : boss.state === 'windup' ? 'Here he comes. Move aside!' : boss.state === 'hit' ? 'Good hit!' : 'Dodge the charge!');
  d = hypot(h.x - boss.x, h.z - boss.z);
  if (d < 2.15 && h.y < 25.7 && h.y > 21) {
    if (h.pound > 0 && h.vy < -3 && prevY > 23.25 && h.y < 24.7 && boss.state === 'dizzy' && boss.hurt <= 0) {
      boss.hp--;
      boss.hurt = 1.5;
      boss.state = 'hit';
      boss.time = 1.1;
      h.pound = 0;
      h.vy = 12;
      h.grounded = false;
      h.y = 24.4;
      state.shake = 0.4;
      sfx('break');
      input.rumble(0.85, 240);
      burst(boss.x, 24, boss.z, C.gold, 24, 6);
      popup(`${3 - boss.hp} / 3 — BONK!`, boss.x, 26, boss.z);
      hud();
      if (boss.hp <= 0) {
        boss.dead = true;
        boss.active = false;
        setBossHud(false);
        burst(boss.x, 23.5, boss.z, COL.bossDust, 40, 7);
        spawnStar('king', 8, 24, -18);
        banner('THE KING HAS LEFT THE HILL', 'That crown was too big anyway.', 'Grab your star!', 5);
        missionText();
      }
    } else if (h.y < 23.7 && boss.hurt <= 0) {
      const dd = Math.max(0.1, d);
      if (boss.state !== 'dizzy') hurt(2, (h.x - boss.x) / dd, (h.z - boss.z) / dd);
      else if (h.y < 23.2 && d < 1.9) {
        h.x = boss.x + ((h.x - boss.x) / dd) * 1.9;
        h.z = boss.z + ((h.z - boss.z) / dd) * 1.9;
      }
    } else if (h.vy < 0 && h.y < 24.45 && prevY >= 24.3 && h.pound <= 0) {
      h.vy = 10;
      h.grounded = false;
      popup('WAIT FOR DIZZY!', boss.x, 26, boss.z);
    }
  }
}

function updateRocks(dt) {
  for (const b of boulders) {
    b.t -= dt * 0.052;
    if (b.t < 0.025) b.t = 0.91;
    placeBoulder(b);
    if (state.mode === 'play' && hypot(hero.x - b.x, hero.z - b.z) < 1.25 && Math.abs(hero.y + 0.8 - b.y) < 1.6) {
      const dx = hero.x - b.x, dz = hero.z - b.z, l = hypot(dx, dz) || 1;
      hurt(1, dx / l, dz / l);
    }
  }
}

function contextualHint() {
  const h = hero;
  let text = '';
  if (state.started) {
    if (race.state === 'count') text = 'Get ready…';
    else if (race.state === 'run') text = `Beat Rollo to the summit! ${key('long')} long jumps save time.`;
    else if (sw.timer > 0) text = `Blue coins over the bridge! ${Math.ceil(sw.timer)}s left`;
    else if (hypot(h.x - PIP.x, h.z - PIP.z) < 3.4 && h.y < 3) text = `${key('attack')} Talk to Pip`;
    else if (hypot(h.x - cannon.x, h.z - cannon.z) < 3.4 && h.y < 3) text = `${key('attack')} Hop in the cannon`;
    else if (SIGNS.some((s) => hypot(h.x - s.x, h.z - s.z) < 2.8) && h.y < 3) text = `${key('attack')} Read the sign`;
    else if (hypot(h.x - rollo.x, h.z - rollo.z) < 2.8 && Math.abs(h.y - rollo.y) < 2) text = `${key('attack')} Talk to Rollo`;
    else if (!sw.pressed && hypot(h.x - sw.x, h.z - sw.z) < 4 && h.y < 3) text = `Blue switch: ${key('jump')} jump, then ${key('pound')} pound`;
    else if (hypot(h.x - island.x, h.z - island.z) < 6 && h.y >= 13) text = `Gold box: ${key('jump')} jump, then ${key('pound')} pound`;
    else if (boss.active && !boss.dead) text = `Dodge the charge. When he is dizzy: ${key('jump')} then ${key('pound')}`;
    else if (state.time < 22) text = `${key('move')} Move &nbsp; ${key('jump')} Jump &nbsp; ${key('attack')} Attack`;
    else if (!h.grounded && h.shot <= 0) text = `${key('attack')} Dive &nbsp; ${key('pound')} Ground pound`;
    else if (state.time < 55) text = `Run + ${key('pound')} + ${key('jump')} = long jump`;
    else text = `${key('camera')} camera &nbsp; ${key('pause')} Pause`;
  }
  const el = $('hint');
  if (el.innerHTML !== text) el.innerHTML = text;
}

/* -------------------------------------------------------------------- drawing */

function drawHero() {
  const h = hero, t = state.clock, win = state.mode === 'winanim' || state.mode === 'victory';
  if (h.inv > 0 && Math.floor(t * 13) % 2 && !win) return;
  const walk = h.grounded && !win ? Math.sin(h.step * 1.6) : 0;
  const bob = h.grounded ? Math.abs(Math.sin(h.step * 1.6)) * 0.07 : 0;
  const crouch = state.mode === 'play' && input.down('pound') && h.grounded && !win;
  const pitch = h.diving ? 1.3 : h.pound > 0 ? 0.35 : !h.grounded && h.combo === 2 ? Math.sin((t - h.lastJump) * 7) * 0.6 : 0;
  const mat = M.trs(mA, h.x, h.y + bob + (h.diving ? 0.6 : 0), h.z, pitch, h.yaw, 0, 1, h.scaleY * (crouch ? 0.72 : 1), 1);
  let leg = walk * 0.55, arm = walk * 0.7;
  if (!h.grounded) {
    leg = h.diving ? 0.1 : -0.45;
    arm = -1.6;
  }
  if (h.pound > 0) {
    leg = -1.15;
    arm = -2.6;
  }
  if (win) {
    arm = -2.4;
    leg = 0;
  }
  // Boots and bent trouser legs.
  for (const s of SIDES) {
    M.mul(mB, mat, M.trs(_t, s * 0.235, 0.65, 0, leg * s, 0, 0));
    part('cyl', mB, C.navy, 0, -0.13, 0, 0.185, 0.5, 0.185);
    part('ball', mB, COL.boot, 0, -0.43, 0.12, 0.25, 0.2, 0.36);
  }
  part('ball', mat, COL.shirt, 0, 1.07, 0, 0.46, 0.5, 0.32);
  part('box', mat, C.navy, 0, 0.96, 0.225, 0.59, 0.53, 0.22);
  for (const s of SIDES) {
    part('box', mat, C.navy, s * 0.26, 1.25, 0.25, 0.14, 0.42, 0.09);
    part('ball', mat, C.gold, s * 0.25, 1.22, 0.31, 0.065, 0.065, 0.03);
    M.mul(mB, mat, M.trs(_t, s * 0.48, 1.35, 0, arm * s, 0, s * -0.12));
    part('cyl', mB, COL.sleeve, 0, -0.19, 0, 0.15, 0.43, 0.15);
    part('ball', mB, C.cream, 0, -0.46, 0.025, 0.2, 0.21, 0.2);
    if (h.attack > 0 && s === 1) part('ball', mat, C.cream, 0.44, 1.29, 0.76, 0.24, 0.23, 0.27);
  }
  part('ball', mat, COL.hair, 0, 1.75, -0.05, 0.39, 0.43, 0.34);
  part('ball', mat, C.pink, 0, 1.79, 0.11, 0.38, 0.37, 0.33);
  for (const s of SIDES) part('ball', mat, C.pink, s * 0.38, 1.79, 0.08, 0.095, 0.14, 0.12);
  part('ball', mat, C.pink, 0, 1.75, 0.45, 0.15, 0.13, 0.15);
  for (const s of SIDES) {
    part('ball', mat, C.white, s * 0.14, 1.9, 0.389, 0.085, 0.11, 0.043);
    part('ball', mat, C.black, s * 0.14, 1.895, 0.425, 0.038, 0.063, 0.026);
    part('box', mat, C.black, s * 0.14, 2.02, 0.37, 0.16, 0.035, 0.033, 0, 0, s * -0.12);
  }
  part('box', mat, COL.mouth, 0, 1.605, 0.393, 0.14, 0.028, 0.025);
  part('ball', mat, COL.cap, 0, 2.075, 0.045, 0.46, 0.245, 0.415);
  part('ball', mat, COL.brim, 0, 2.02, 0.395, 0.43, 0.07, 0.34);
  part('disc', mat, C.cream, 0, 2.14, 0.394, 0.137, 0.025, 0.137, Math.PI / 2);
  part('box', mat, C.red, -0.052, 2.14, 0.416, 0.025, 0.115, 0.012);
  part('box', mat, C.red, 0.052, 2.14, 0.416, 0.025, 0.115, 0.012);
  part('box', mat, C.red, 0, 2.14, 0.42, 0.025, 0.135, 0.012, 0, 0, 0.65);
  part('box', mat, COL.scarf, 0, 1.46, 0.32, 0.55, 0.13, 0.09);
  part('box', mat, COL.scarfTail, -0.31, 1.27, -0.28, 0.19, 0.49, 0.065, 0.14, 0, -0.3);
}
function drawCoin(c) {
  const y = c.y + Math.sin(state.clock * 3 + c.phase) * 0.13;
  const m = M.trs(mA, c.x, y, c.z, 0, state.clock * 2.7 + c.phase, 0);
  const col = c.blue ? COL.blue : c.red ? C.red : C.gold;
  part('cyl', m, col, 0, 0, 0, 0.37, 0.105, 0.37, Math.PI / 2);
  part('cyl', m, c.blue ? COL.blueIn : c.red ? COL.coinRedIn : COL.coinGoldIn, 0, 0, 0.06, 0.285, 0.012, 0.285, Math.PI / 2);
  part('box', m, c.blue ? COL.blueMark : c.red ? COL.coinRedMark : COL.coinGoldMark, 0, 0, 0.078, 0.065, 0.37, 0.021);
}
function drawStar(s) {
  const m = M.trs(mA, s.x, s.y + Math.sin(state.clock * 2 + s.phase) * 0.2, s.z, 0, state.clock * 1.8, 0, 0.78, 0.78, 0.78);
  draw('star', m, C.gold);
  part('ball', m, C.black, -0.2, 0.09, 0.25, 0.05, 0.11, 0.03);
  part('ball', m, C.black, 0.2, 0.09, 0.25, 0.05, 0.11, 0.03);
  if (Math.random() < 0.06 && state.mode === 'play') burst(s.x, s.y, s.z, C.gold, 1, 0.6);
}
function drawCrate(c) {
  if (c.dead) return;
  const m = M.trs(mA, c.x, c.y + c.size / 2, c.z), s = c.size;
  part('box', m, c.gold ? COL.crateGold : COL.crateWood, 0, 0, 0, s, s, s);
  const cc = c.gold ? COL.trimGold : COL.trimWood;
  for (const q of SIDES) {
    const x = q * s * 0.43;
    part('box', m, cc, x, 0, s * 0.51, 0.16, s, 0.04);
    part('box', m, cc, x, 0, -s * 0.51, 0.16, s, 0.04);
  }
  for (const q of SIDES) {
    const y = q * s * 0.43;
    part('box', m, cc, 0, y, s * 0.51, s, 0.15, 0.04);
    part('box', m, cc, 0, y, -s * 0.51, s, 0.15, 0.04);
  }
  part('box', m, cc, 0, 0, s * 0.52, s * 1.18, 0.12, 0.04, 0, 0, 0.72);
  part('box', m, cc, 0, s * 0.51, 0, s, 0.05, 0.15);
  if (c.gold) {
    part('box', m, C.cream, 0, 0.16, s * 0.54, 0.15, 0.49, 0.03);
    part('box', m, C.cream, 0, -0.23, s * 0.54, 0.15, 0.14, 0.03);
  }
}
function drawEnemy(e) {
  if (e.dead && e.squash <= 0) return;
  const m = M.trs(mA, e.x, e.y, e.z, 0, e.yaw, 0, 1, e.dead ? 0.18 : 1, 1);
  for (const s of SIDES) part('ball', m, COL.goombaFoot, s * 0.35, 0.16 + Math.sin(e.phase) * s * 0.06, 0.1, 0.28, 0.18, 0.38);
  part('ball', m, COL.goombaBody, 0, 0.7, 0, 0.68, 0.58, 0.57);
  part('ball', m, COL.goombaHead, 0, 1.1, -0.04, 0.46, 0.33, 0.43);
  for (const s of SIDES) {
    part('ball', m, C.cream, s * 0.22, 0.89, 0.5, 0.14, 0.18, 0.085);
    part('ball', m, C.black, s * 0.22, 0.89, 0.574, 0.054, 0.085, 0.035);
    part('box', m, C.black, s * 0.22, 1.085, 0.51, 0.3, 0.045, 0.07, 0, 0, s * -0.23);
  }
  part('box', m, C.cream, 0, 0.54, 0.553, 0.22, 0.055, 0.035);
}
function drawBoss() {
  if (boss.dead) return;
  const t = state.clock, shake = boss.state === 'windup' ? Math.sin(t * 42) * 0.065 : 0;
  const m = M.trs(mA, boss.x + shake, boss.y, boss.z, 0, boss.yaw, 0), dizzy = boss.state === 'dizzy';
  const col = boss.hurt > 0 && Math.floor(t * 16) % 2 ? COL.bossHurt : dizzy ? COL.bossDizzy : boss.state === 'windup' ? COL.bossWind : COL.bossBody;
  for (const s of SIDES) {
    part('ball', m, COL.bossFoot, s * 0.9, 0.32, 0.2, 0.6, 0.35, 0.75);
    part('ball', m, col, s * 1.6, 1.4, 0.04, 0.4, 0.6, 0.46);
  }
  part('rock', m, col, 0, 1.6, 0, 1.6, 1.4, 1.45);
  part('ball', m, COL.bossJaw, 0, 1.32, 1.15, 1.02, 0.8, 0.38);
  for (const s of SIDES) {
    part('ball', m, C.cream, s * 0.5, 2.05, 1.27, 0.3, 0.35, 0.13);
    part('ball', m, C.black, s * 0.5 + (dizzy ? Math.sin(t * 9) * 0.08 : 0), 2.04, 1.38, 0.11, 0.17, 0.05);
    part('box', m, C.black, s * 0.49, 2.44, 1.22, 0.7, 0.13, 0.14, 0, 0, dizzy ? s * 0.2 : -s * 0.28);
  }
  part('box', m, C.cream, 0, 1.05, 1.53, 0.65, 0.14, 0.05);
  part('cyl', m, C.gold, 0, 3.0, 0, 0.9, 0.42, 0.9);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    part('cone', m, C.gold, Math.sin(a) * 0.75, 3.42, Math.cos(a) * 0.75, 0.25, 0.6, 0.25);
    part('ball', m, C.red, Math.sin(a) * 0.75, 3.74, Math.cos(a) * 0.75, 0.11, 0.11, 0.11);
  }
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i / 3) * TAU;
      part('star', m, C.gold, Math.sin(a) * 1.45, 3.9 + Math.sin(a * 2) * 0.15, Math.cos(a) * 1.45, 0.24, 0.24, 0.24, 0, -boss.yaw + a);
    }
  }
  if (boss.state === 'windup') {
    const r = 2.3 + Math.sin(t * 16) * 0.15;
    put(blobBatch, M.trs(_t, boss.x, 22.06, boss.z, 0, 0, 0, r, 0.015, r), COL.warn, 0.55);
  }
}
function drawPip() {
  const t = state.clock, m = M.trs(mA, PIP.x, Math.sin(t * 2) * 0.06, PIP.z, 0, 0.5, 0);
  part('ball', m, COL.pip, 0, 0.7, 0, 0.55, 0.69, 0.46);
  for (const s of SIDES) {
    part('ball', m, COL.pipFoot, s * 0.3, 0.14, 0.13, 0.24, 0.17, 0.32);
    part('ball', m, C.cream, s * 0.2, 0.95, 0.4, 0.12, 0.16, 0.065);
    part('ball', m, C.black, s * 0.2, 0.95, 0.457, 0.045, 0.085, 0.025);
  }
  part('ball', m, C.gold, 0, 1.38, 0, 0.63, 0.095, 0.55);
  part('ball', m, C.gold, 0, 1.52, -0.02, 0.36, 0.22, 0.32);
  part('box', m, C.cream, 0, 0.48, 0.433, 0.18, 0.032, 0.03);
  part('box', m, COL.pipPack, 0, 0.73, -0.45, 0.57, 0.62, 0.3);
}
function drawRollo() {
  const running = rollo.state === 'race' && race.state === 'run';
  const bob = Math.abs(Math.sin(rollo.phase)) * (running ? 0.12 : 0.05);
  const hop = rollo.hop > 0 ? Math.sin((1 - rollo.hop / 0.6) * Math.PI) * 1.5 : 0;
  const m = M.trs(mA, rollo.x, rollo.y + bob + hop, rollo.z, running ? 0.12 : 0, rollo.yaw, 0, 0.95);
  const stride = running ? Math.sin(rollo.phase) : 0;
  for (const s of SIDES) part('ball', m, C.cream, s * 0.3, 0.14 + stride * s * 0.09, 0.08 + stride * s * 0.12, 0.24, 0.16, 0.34);
  part('rock', m, COL.rollo, 0, 0.72, 0, 0.62, 0.6, 0.55);
  part('cyl', m, C.red, 0, 0.98, 0, 0.6, 0.12, 0.56);
  part('box', m, C.red, 0.12, 0.96, -0.62, 0.1, 0.26, 0.05, 0.4, 0, 0.5);
  for (const s of SIDES) {
    part('ball', m, C.cream, s * 0.2, 0.78, 0.5, 0.12, 0.15, 0.07);
    part('ball', m, C.black, s * 0.2, 0.78, 0.565, 0.05, 0.08, 0.03);
    part('box', m, C.black, s * 0.2, 0.93, 0.52, 0.2, 0.04, 0.05, 0, 0, s * 0.2);
  }
  part('box', m, C.cream, 0, 0.55, 0.54, 0.26, 0.05, 0.035, 0, 0, 0.12);
}
function drawSwitch() {
  const m = M.trs(mA, sw.x, 0, sw.z);
  part('box', m, COL.switchBase, 0, 0.09, 0, 1.5, 0.18, 1.5);
  const capH = sw.pressed ? 0.04 : 0.16;
  part('box', m, COL.switchCap, 0, 0.18 + capH / 2, 0, 1.15, capH, 1.15);
  if (!sw.pressed) {
    part('box', m, C.cream, 0, 0.345, -0.08, 0.16, 0.012, 0.46);
    part('box', m, C.cream, 0, 0.345, 0.3, 0.16, 0.012, 0.14);
  }
}
function drawFlags() {
  for (const f of checkpoints) {
    const m = M.trs(mA, f.x, f.y + 3.13, f.z, 0, Math.sin(state.clock * 2) * 0.1, 0);
    part('flag', m, f.active ? C.gold : C.cream, 0, 0, 0, 1, 0.8, 1);
    part('star', m, f.active ? C.cream : C.gold, 0.42, 0.03, 0.02, 0.15, 0.15, 0.1, 0, 0, 0.1);
  }
}
function blob(x, z, y, r, alpha = 0.18) {
  put(blobBatch, M.trs(_t, x, y + 0.035, z, 0, 0, 0, r, 0.012, r * 0.82), COL.blob, alpha);
}

function drawActors() {
  for (const b of allBatches) b.n = 0;
  drawFlags();
  drawPip();
  drawRollo();
  drawSwitch();
  for (const c of crates) drawCrate(c);
  for (const c of coinList) if (!c.got && !c.hidden && hypot(c.x - camPos.x, c.z - camPos.z) < 100) drawCoin(c);
  for (const s of starsList) drawStar(s);
  for (const e of enemies) drawEnemy(e);
  drawBoss();
  for (const b of boulders) draw('rock', M.trs(_t, b.x, b.y, b.z, state.clock * 3, b.t * TAU, 0, 0.83, 0.83, 0.83), COL.boulder);
  drawHero();
  for (const p of particles) put(particleBatch, M.trs(_t, p.x, p.y, p.z, p.rot, p.rot * 2, p.rot, p.size, p.size, p.size), p.col, clamp(p.life * 3, 0, 1));
  // Round contact shadows, as before.
  const hg = ground(hero.x, hero.z, hero.y);
  if (hg.h > -90) blob(hero.x, hero.z, hg.h, 0.63 + Math.max(0, hero.y - hg.h) * 0.025, Math.max(0.06, 0.24 - (hero.y - hg.h) * 0.013));
  for (const e of enemies) if (!e.dead) blob(e.x, e.z, e.y, 0.71, 0.17);
  if (!boss.dead) blob(boss.x, boss.z, 22, 1.85, 0.19);
  for (const b of boulders) blob(b.x, b.z, b.y - 0.8, 0.85, 0.17);
  for (const s of starsList) blob(s.x, s.z, ground(s.x, s.z, s.y).h, 0.6, 0.13);
  blob(rollo.x, rollo.z, rollo.y, 0.62, rollo.hop > 0 ? 0.1 : 0.16);
  for (const b of allBatches) flush(b);
}

/* --------------------------------------------------------------------- camera */

const _desired = new THREE.Vector3(), _target = new THREE.Vector3();
function updateCamera(dt) {
  if (state.mode === 'title' || (state.mode === 'help' && !state.started)) {
    const a = 0.52 + Math.sin(state.clock * 0.08) * 0.055;
    camPos.set(Math.sin(a) * 89, 48, Math.cos(a) * 88 - 10);
    camAt.set(-3, 7, -7);
  } else {
    const win = state.mode === 'winanim' || state.mode === 'victory';
    const yaw = win ? hero.yaw + state.clock * 0.25 : cameraYaw, d = win ? 7.8 : cameraDistance, pitch = win ? 0.32 : cameraPitch;
    _target.set(hero.x, hero.y + 2.3, hero.z);
    _desired.set(hero.x + Math.sin(yaw) * d * Math.cos(pitch), hero.y + 1.4 + Math.sin(pitch) * d, hero.z + Math.cos(yaw) * d * Math.cos(pitch));
    const gh = groundBase(_desired.x, _desired.z).h;
    if (gh > _desired.y - 1.8) _desired.y = gh + 1.8;
    for (let i = 1; i <= 9; i++) {
      const f = i / 10, x = mix(_target.x, _desired.x, f), z = mix(_target.z, _desired.z, f), y = mix(_target.y, _desired.y, f), g = groundBase(x, z);
      if (g.h > y - 0.65 && g.h < 99) _desired.y += (g.h + 0.65 - y) / f;
    }
    camPos.lerp(_desired, 1 - Math.exp(-dt * 7.5));
    camAt.lerp(_target, 1 - Math.exp(-dt * 13));
  }
  const sh = state.shake > 0 ? state.shake * 0.35 : 0;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camAt);
  camera.updateMatrixWorld();
}
function applyLook(dt) {
  const lk = input.look('look');
  const s = input.source;
  // Match the original's feel: 0.006 rad per dragged pixel, 2.4 rad/s on a stick.
  const ky = s === 'gamepad' ? 0.92 : s === 'touch' ? 1.1 : 2.5;
  const kp = s === 'gamepad' ? 0.42 : s === 'touch' ? 0.75 : 1.67;
  cameraYaw -= lk.x * ky;
  cameraPitch = clamp(cameraPitch + lk.y * kp, 0.2, 1.02);
  cameraYaw += input.value('turn') * dt * 1.85;
  cameraDistance = clamp(cameraDistance - input.zoom() * 1.2 - input.value('zoom') * dt * 9, 7, 19);
}

/* -------------------------------------------------------------------- effects */

const _v4 = new THREE.Vector4();
function updateEffects(dt) {
  state.shake = Math.max(0, state.shake - dt);
  state.damage = Math.max(0, state.damage - dt);
  const dmg = Math.round(state.damage * 100) / 100;
  if (dmg !== ui.damage) {
    ui.damage = dmg;
    $('damage').style.opacity = dmg;
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 14 * dt;
    p.rot += dt * 3;
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.life -= dt;
    f.y += dt * 0.9;
    _v4.set(f.x, f.y, f.z, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
    if (_v4.w > 0) {
      f.el.style.left = ((_v4.x / _v4.w) * 0.5 + 0.5) * innerWidth + 'px';
      f.el.style.top = (0.5 - (_v4.y / _v4.w) * 0.5) * innerHeight + 'px';
    }
    f.el.style.opacity = _v4.w > 0 ? Math.min(1, f.life * 3) : 0;
    if (f.life <= 0) {
      f.el.remove();
      floaters.splice(i, 1);
    }
  }
  if (state.toast > 0) {
    state.toast -= dt;
    if (state.toast <= 0) $('toast').classList.remove('show');
  }
  if (state.banner > 0) {
    state.banner -= dt;
    if (state.banner <= 0) $('goal-banner').classList.remove('show');
  }
  // Race and blue-switch HUD.
  const racing = race.state !== 'off';
  if (racing !== ui.race) {
    ui.race = racing;
    $('race-hud').classList.toggle('hidden', !racing);
  }
  if (racing) {
    $('race-you').style.left = heroProgress() * 100 + '%';
    $('race-rollo').style.left = rollo.t * 100 + '%';
  }
  const blue = sw.timer > 0 ? String(Math.ceil(sw.timer)) : '';
  if (blue !== ui.blue) {
    ui.blue = blue;
    $('blue-timer').classList.toggle('hidden', !blue);
    $('blue-time').textContent = blue;
  }
}

/* -------------------------------------------------------------------- minimap */

const mapctx = $('minimap').getContext('2d');
function minimap() {
  const ctx = mapctx, S = 1.7, tx = (x) => 128 + x * S, tz = (z) => 125 + z * S;
  ctx.clearRect(0, 0, 256, 256);
  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 128, 119, 0, TAU);
  ctx.fillStyle = '#d9efc4db';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#80ad67';
  ctx.beginPath();
  ctx.ellipse(128, 120, 94, 103, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#72bec1';
  ctx.fillRect(32, tz(18), 130, 14);
  ctx.fillStyle = '#aa8556';
  ctx.fillRect(tx(-12), tz(14), 14, 27);
  for (const r of [25, 18, 11]) {
    ctx.beginPath();
    ctx.arc(tx(8), tz(-18), r * S, 0, TAU);
    ctx.fillStyle = r === 25 ? '#598854' : r === 18 ? '#689760' : '#86ad6b';
    ctx.fill();
  }
  ctx.beginPath();
  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    if (i === 0) ctx.moveTo(tx(p.x), tz(p.z));
    else ctx.lineTo(tx(p.x), tz(p.z));
  }
  ctx.strokeStyle = '#f4d99b';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(tx(-34), tz(-13), 8, 0, TAU);
  ctx.fillStyle = '#e5d59b';
  ctx.fill();
  ctx.fillStyle = sw.pressed ? '#3c6386' : '#5aa0ea';
  ctx.fillRect(tx(sw.x) - 3, tz(sw.z) - 3, 7, 7);
  for (const c of coinList) {
    if (c.got || !(c.red || (c.blue && !c.hidden))) continue;
    ctx.beginPath();
    ctx.arc(tx(c.x), tz(c.z), 3.3, 0, TAU);
    ctx.fillStyle = c.red ? '#ed6252' : '#4f8fe6';
    ctx.fill();
    ctx.strokeStyle = '#fff2c5';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.font = 'bold 17px Arial';
  ctx.fillStyle = '#ffdf57';
  ctx.textAlign = 'center';
  for (const s of starsList) ctx.fillText('★', tx(s.x), tz(s.z) + 5);
  if (!boss.dead) {
    ctx.beginPath();
    ctx.arc(tx(boss.x), tz(boss.z), 4.5, 0, TAU);
    ctx.fillStyle = '#665a78';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(tx(rollo.x), tz(rollo.z), 3.5, 0, TAU);
  ctx.fillStyle = '#8d9aa3';
  ctx.fill();
  for (const f of checkpoints) {
    ctx.fillStyle = f.active ? '#ffe58c' : '#e1e8d1';
    ctx.fillRect(tx(f.x) - 2, tz(f.z) - 2, 5, 5);
  }
  ctx.save();
  ctx.translate(tx(hero.x), tz(hero.z));
  ctx.rotate(-hero.yaw);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-5, -5);
  ctx.lineTo(0, -2);
  ctx.lineTo(5, -5);
  ctx.closePath();
  ctx.fillStyle = '#fff8dd';
  ctx.fill();
  ctx.strokeStyle = '#304b3a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(128, 128, 119, 0, TAU);
  ctx.strokeStyle = '#fff9e2';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#3c6147';
  ctx.font = 'bold 15px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.fillText('N', 128, 24);
}

/* ---------------------------------------------------------------------- input */

function clearPressed() {
  P.jump = P.attack = P.pound = P.flag = false;
}
function handleInput(dt) {
  if (input.pressed('mute')) toggleSound();
  const m = state.mode;
  if (m === 'play') {
    if (input.pressed('pause')) {
      pauseGame();
      return;
    }
    // Latched until the next physics step uses them (a fast frame may run none).
    if (input.pressed('jump')) P.jump = true;
    if (input.pressed('attack')) P.attack = true;
    if (input.pressed('pound')) P.pound = true;
    if (input.pressed('flag')) P.flag = true;
    return;
  }
  if (m === 'dialogue') {
    if (input.pressed('jump') || input.pressed('attack') || input.pressed('confirm') || input.pressed('pause') || input.pressed('back')) nextDialogue();
    return;
  }
  if (m !== 'winanim') menuInput(dt);
}
const NO_INPUT = { dx: 0, dz: 0, amount: 0, jump: false, crouch: false };
const inp = { dx: 0, dz: 0, amount: 0, jump: false, crouch: false };
function readInput() {
  if (race.state === 'count') return NO_INPUT;
  const mv = input.vector('move');
  const mx = mv.x, mz = mv.y, l = hypot(mx, mz);
  inp.dx = mx * Math.cos(cameraYaw) - mz * Math.sin(cameraYaw);
  inp.dz = -mx * Math.sin(cameraYaw) - mz * Math.cos(cameraYaw);
  inp.amount = Math.min(1, l);
  inp.jump = input.down('jump');
  inp.crouch = input.down('pound');
  return inp;
}

/* ----------------------------------------------------------------------- loop */

let accum = 0, uiTick = 0;
kit.onResize((w, h) => {
  const aspect = w / Math.max(1, h);
  // 60° tall as before; portrait screens open up so the hero has room to the sides.
  const fitWide = (2 * Math.atan(Math.tan((25 * Math.PI) / 180) / aspect) * 180) / Math.PI;
  camera.aspect = aspect;
  camera.fov = clamp(fitWide, 60, 80);
  camera.updateProjectionMatrix();
  if (prefs.retro) applyRetro();
});

function frame(dt) {
  state.clock += dt;
  uClock.value = state.clock;
  handleInput(dt);
  syncAudio();
  if (state.respawn > 0) {
    clearPressed();
    state.respawn -= dt;
    if (state.respawn <= 0) finishRespawn();
  } else if (state.mode === 'play') {
    applyLook(dt);
    const step = readInput();
    state.time += dt;
    state.saveClock += dt;
    if (state.saveClock > 15) {
      state.saveClock = 0;
      saveRun();
    }
    accum += dt;
    let first = true;
    while (accum >= STEP) {
      if (race.state === 'count') clearPressed();
      updateHero(STEP, step);
      updateRocks(STEP);
      updateRace(STEP);
      updateSwitch(STEP);
      updateRollo(STEP);
      accum -= STEP;
      if (first) {
        clearPressed();
        first = false;
      }
      if (state.mode !== 'play' || state.respawn > 0) {
        accum = 0;
        break;
      }
    }
  } else if (state.mode === 'title') {
    updateRocks(dt);
    updateRollo(dt);
    clearPressed();
  } else if (state.mode === 'winanim') {
    state.winDelay -= dt;
    hero.yaw += dt * 1.7;
    if (state.winDelay <= 0) {
      setMode('victory');
      $('victory').classList.remove('hidden');
      focusMenu($('victory'));
    }
  } else {
    accum = 0;
    clearPressed();
    updateRollo(dt);
  }
  updateCamera(dt);
  updateEffects(dt);
  drawActors();
  post.render();
  uiTick += dt;
  if (uiTick > 0.1) {
    uiTick = 0;
    if (state.started) {
      minimap();
      $('timer').textContent = timeText(state.time);
      if (state.mode === 'play') contextualHint();
    }
  }
}

// Read-only status for local testing; normal play never uses it.
window.Nario63 = {
  getState: () => ({
    mode: state.mode, position: { x: hero.x, y: hero.y, z: hero.z }, velocity: { x: hero.vx, y: hero.vy, z: hero.vz }, grounded: hero.grounded,
    coins: state.coins, red: state.red, stars: [...state.stars], health: hero.health, checkpoint: state.checkpoint,
    boss: { hp: boss.hp, state: boss.state, active: boss.active }, race: race.state, rollo: rollo.state, blueSwitch: sw.pressed, time: state.time,
  }),
  getAudioState: () => (audio && audio.ctx ? { context: audio.ctx.state, playing: !audio.musicElement.paused, time: audio.musicElement.currentTime, duration: audio.musicElement.duration, musicEnabled: prefs.music, muted: prefs.muted } : null),
  version: '2.0-kit',
};

populate();
setMode('title');
applyRetro();
applyMusic();
titleSave();
renderPrompts();
hud();
focusMenu($('title'));
kit.start(frame);
