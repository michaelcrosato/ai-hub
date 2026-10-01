/**
 * render.js — Dustshot's 3D view on the shared kit: three.js r186 through
 * kit.renderer (WebGPU, with the WebGL2 fallback), the kit's post chain for
 * the faint bloom, and kit/points.js for the drifting dust.
 *
 * Nothing is created or disposed during play:
 *   - each stage's scenery is merged into one mesh per material (both stages
 *     are built at load and toggled), with every shop sign in one texture atlas;
 *   - characters, crates and pickups are merged templates, cloned once and
 *     recycled per kind;
 *   - bullets, dynamite, rings and sparks are instanced pools (kit.instanced,
 *     so they share shaders).
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';
import { STAGES } from './sim.js';

const PALETTE = {
  dust: 0x9b5b33,
  dustDark: 0x784025,
  sand: 0xd6a15d,
  wood: 0x704027,
  woodLight: 0x9a653a,
  woodDark: 0x4c2a1c,
  cream: 0xe7c987,
  blue: 0x2e6981,
  red: 0x9d382d,
  green: 0x536a3a,
  ink: 0x251d19,
  brass: 0xe7b84f,
  sky: 0x9ec0c2,
  // Red Mesa Pass
  mesaSand: 0xb4643a,
  mesaTrack: 0x8e4528,
  mesaRut: 0xd08a55,
  rock: 0xa4472b,
  rockDark: 0x6f2f21,
  rockBand: 0xc9784a,
  rockFar: 0xc58a68,
  iron: 0x3b3431,
  ore: 0xc9a14a,
  canvas: 0xe2d2ad,
};

/** Per-stage light and air. Only uniforms change between them, so a stage switch compiles nothing. */
const THEMES = {
  town: { sky: 0x9ec0c2, fog: 0.0125, sun: 0xffd6a0, sunI: 3.2, hemiSky: 0xffe6b6, hemiGround: 0x593a32, hemiI: 2.1, dust: 0xe2bb80 },
  canyon: { sky: 0xd9a37f, fog: 0.0115, sun: 0xffc48c, sunI: 3.1, hemiSky: 0xffdcb4, hemiGround: 0x6a2c22, hemiI: 2.0, dust: 0xeaa874 },
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const _ndc = new THREE.Vector2();

/* ------------------------------------------------------------------ geometry helpers */

const geoCache = new Map();
const cached = (key, make) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};
const boxGeo = (w, h, d) => cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (rt, rb, h, n) => cached(`c${rt}|${rb}|${h}|${n}`, () => new THREE.CylinderGeometry(rt, rb, h, n));
const rockGeo = () => cached('dodeca', () => new THREE.DodecahedronGeometry(1, 0));

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cylinder(rt, rb, h, sides, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cylGeo(rt, rb, h, sides), mat);
  m.position.set(x, y, z);
  return m;
}
function stone(mat, x, y, z, sx, sy, sz, ry = 0) {
  const m = new THREE.Mesh(rockGeo(), mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.rotation.y = ry;
  return m;
}

/** Small deterministic random source, so the scenery is the same on every load. */
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Send only the instances in use to the GPU. kit.instanced allocates past the
 * uniform limit (about 1000 slots) so the pools share one shader; uploading the
 * whole buffer every frame would move ~64 KB per pool for a handful of sparks.
 */
function upload(attribute, count, itemSize) {
  if (count <= 0) return;
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, count * itemSize);
  attribute.needsUpdate = true;
}

const KEEP_ATTRIBUTES = ['position', 'normal', 'uv'];

/**
 * One mesh per material for everything under `root` (in root's space). The
 * parts are throwaway build objects; only the merged meshes reach the GPU.
 */
function mergeByMaterial(root, { cast = true, receive = true } = {}) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP_ATTRIBUTES.includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    g.clearGroups();
    g.applyMatrix4(_m.multiplyMatrices(inverse, o.matrixWorld));
    const list = buckets.get(o.material);
    if (list) list.push(g);
    else buckets.set(o.material, [g]);
  });
  const out = new THREE.Group();
  for (const [material, list] of buckets) {
    const merged = mergeGeometries(list, false);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    out.add(mesh);
  }
  return out;
}

/* ------------------------------------------------------------------ materials and signs */

function createMaterials() {
  const std = (color, roughness = 0.88, metalness = 0.0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const glow = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
  return {
    dust: std(PALETTE.dust, 1), dustDark: std(PALETTE.dustDark, 1), sand: std(PALETTE.sand, 1),
    wood: std(PALETTE.wood, 0.94), woodLight: std(PALETTE.woodLight, 0.93), woodDark: std(PALETTE.woodDark, 0.98),
    cream: std(PALETTE.cream, 0.9), blue: std(PALETTE.blue, 0.82), red: std(PALETTE.red, 0.88), green: std(PALETTE.green, 0.92), ink: std(PALETTE.ink, 0.84),
    brass: std(PALETTE.brass, 0.42, 0.35), white: std(0xf4e7ca, 0.88), black: std(0x1f1b1a, 0.86),
    horse: std(0x7e4a2e, 0.96), horseDark: std(0x37251d, 0.96),
    window: std(0x8ec0c0, 0.35, 0.05),
    poster: std(0xe9ce96, 0.98), pickupGreen: std(0x67a867, 0.85), pickupBlue: std(0x5e94c7, 0.78),
    mesaSand: std(PALETTE.mesaSand, 1), mesaTrack: std(PALETTE.mesaTrack, 1), mesaRut: std(PALETTE.mesaRut, 1),
    rock: std(PALETTE.rock, 0.96), rockDark: std(PALETTE.rockDark, 0.97), rockBand: std(PALETTE.rockBand, 0.95), rockFar: std(PALETTE.rockFar, 1),
    iron: std(PALETTE.iron, 0.55, 0.45), ore: std(PALETTE.ore, 0.5, 0.3), canvas: std(PALETTE.canvas, 0.95), mineDark: std(0x120d0b, 1),
    dynamite: new THREE.MeshStandardMaterial({ color: 0xc23a26, roughness: 0.6, emissive: 0x3a0a05 }),
    // Tracers sit a little above 1.0 so the scene's faint bloom catches them.
    bulletPlayer: glow(0xffda64, 1.5), bulletEnemy: glow(0xff5f44, 1.5),
    flash: new THREE.MeshBasicMaterial({ color: 0xfff1cf }),
  };
}

const SIGNS = [
  ['SHERIFF'], ['GENERAL'], ['SALOON', '#7b2f27'], ['BANK'], ['HOTEL'], ['STABLE'], ['GUNSMITH'], ['CAFE'],
  ['FREIGHT'], ['LIVERY'], ['STOCKADE'], ['TRADING POST', '#6d3a22'], ['BONANZA MINE', '#3c2a22'], ['CALLOWAY CLAIM', '#7b2f27'],
];

/** Every painted sign in one canvas texture, so all signs draw with one material. */
function createSignAtlas() {
  const COLS = 2, W = 512, H = 160;
  const rows = Math.ceil(SIGNS.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = W * COLS;
  canvas.height = H * rows;
  const ctx = canvas.getContext('2d');
  const slots = new Map();
  SIGNS.forEach(([text, bg = '#4a3024', fg = '#f3dba2'], i) => {
    const x = (i % COLS) * W, y = Math.floor(i / COLS) * H;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = '#2a1b16';
    ctx.lineWidth = 18;
    ctx.strokeRect(x + 9, y + 9, W - 18, H - 18);
    let size = 62;
    ctx.font = `700 ${size}px Georgia, serif`;
    while (ctx.measureText(text).width > W - 64 && size > 28) ctx.font = `700 ${(size -= 2)}px Georgia, serif`;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + W / 2, y + H / 2 + 2);
    slots.set(text, { u0: x / canvas.width, u1: (x + W) / canvas.width, v0: 1 - (y + H) / canvas.height, v1: 1 - y / canvas.height });
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: tex });
  return {
    material,
    make(text, w = 3.5, h = 1.08) {
      const s = slots.get(text);
      const g = new THREE.PlaneGeometry(w, h);
      const uv = g.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, s.u0 + uv.getX(i) * (s.u1 - s.u0), s.v0 + uv.getY(i) * (s.v1 - s.v0));
      return new THREE.Mesh(g, material);
    },
  };
}

/* ------------------------------------------------------------------ shared props */

function makeFence(mats, x, z, alongZ = true, length = 4.6) {
  const g = new THREE.Group();
  const steps = Math.max(2, Math.floor(length / 1.1));
  for (let i = 0; i <= steps; i++) {
    const p = (i / steps - 0.5) * length;
    g.add(box(0.16, 1.4, 0.16, mats.woodDark, alongZ ? 0 : p, 0.7, alongZ ? p : 0));
  }
  for (const y of [0.55, 1.05]) g.add(box(alongZ ? 0.14 : length, 0.12, alongZ ? length : 0.14, mats.wood, 0, y, 0));
  g.position.set(x, 0, z);
  return g;
}

function makeTrough(mats, x, z) {
  const g = new THREE.Group();
  g.add(box(2.8, 0.55, 1.3, mats.wood, 0, 0.3, 0));
  g.add(box(2.35, 0.08, 0.86, mats.blue, 0, 0.59, 0));
  g.position.set(x, 0, z);
  return g;
}

function makeBarrelCluster(mats, x, z) {
  const g = new THREE.Group();
  for (const [dx, dz] of [[-0.55, 0], [0.55, 0], [0, 0.72]]) {
    g.add(cylinder(0.48, 0.48, 1.15, 10, mats.wood, dx, 0.58, dz));
    g.add(cylinder(0.5, 0.5, 0.08, 10, mats.ink, dx, 0.33, dz));
    g.add(cylinder(0.5, 0.5, 0.08, 10, mats.ink, dx, 0.83, dz));
  }
  g.position.set(x, 0, z);
  return g;
}

/** A stack of crates filling a 'crates' collider (it used to be an invisible wall). */
function makeCrateStack(mats, c) {
  const g = new THREE.Group();
  const alongX = c.w >= c.d;
  const long = alongX ? c.w : c.d;
  const n = Math.max(1, Math.round(long / 1.2));
  const size = Math.min(1.15, (long / n) * 0.96);
  for (let i = 0; i < n; i++) {
    const p = (i - (n - 1) / 2) * (long / n);
    const x = alongX ? p : 0, z = alongX ? 0 : p;
    g.add(box(size, size, size, mats.woodLight, x, size / 2, z));
    g.add(box(size + 0.04, 0.1, 0.1, mats.woodDark, x, size * 0.55, z + (alongX ? size / 2 : 0)));
  }
  // One more crate on top, over the first one.
  const first = (-(n - 1) / 2) * (long / n);
  g.add(box(size * 0.92, size * 0.85, size * 0.92, mats.wood, alongX ? first : 0, size * 1.42, alongX ? 0 : first));
  g.position.set(c.x, 0, c.z);
  return g;
}

function makeCactus(mats) {
  const g = new THREE.Group();
  g.add(cylinder(0.28, 0.34, 2.6, 7, mats.green, 0, 1.3, 0));
  const arm1 = cylinder(0.18, 0.2, 1.1, 7, mats.green, 0.55, 1.55, 0);
  arm1.rotation.z = Math.PI / 2;
  g.add(arm1);
  g.add(cylinder(0.18, 0.22, 0.9, 7, mats.green, 1.0, 1.95, 0));
  const arm2 = cylinder(0.16, 0.19, 0.85, 7, mats.green, -0.5, 1.1, 0);
  arm2.rotation.z = Math.PI / 2;
  g.add(arm2);
  return g;
}

/** The boss gate: posts go into the static scenery, the two doors swing. */
function makeGatePosts(mats, z) {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    g.add(box(0.5, 3.4, 0.5, mats.woodDark, sx * 7.3, 1.7, z));
    g.add(box(0.7, 0.2, 0.7, mats.wood, sx * 7.3, 3.45, z));
  }
  return g;
}

function makeGateDoor(mats, dir, z) {
  const raw = new THREE.Group();
  for (let i = 0; i < 9; i++) raw.add(box(0.7, 2.6 + (i % 2) * 0.25, 0.2, mats.wood, dir * (0.4 + i * 0.75), 1.35 + (i % 2) * 0.12, 0));
  raw.add(box(6.8, 0.22, 0.26, mats.woodDark, dir * 3.5, 0.75, 0.02));
  raw.add(box(6.8, 0.22, 0.26, mats.woodDark, dir * 3.5, 2.05, 0.02));
  const brace = box(6.9, 0.18, 0.24, mats.woodDark, dir * 3.5, 1.4, 0.03);
  brace.rotation.z = dir * 0.17;
  raw.add(brace);
  if (dir > 0) {
    // The warrant this gate waits for, nailed to the door.
    raw.add(box(0.82, 1.0, 0.05, mats.poster, dir * 5.6, 1.55, 0.15));
    raw.add(box(0.36, 0.3, 0.06, mats.ink, dir * 5.6, 1.62, 0.16));
  }
  const door = mergeByMaterial(raw);
  door.position.set(-dir * 7.05, 0, z);
  return door;
}

/* ------------------------------------------------------------------ Cinder Creek */

function makeBuilding(mats, signs, side, z, name, facadeMat) {
  const g = new THREE.Group();
  const x = side * 13.1;
  const width = 7.2 + (name.length % 3) * 0.6;
  const depth = 8.2;
  const h = 5.2 + (name.length % 2) * 1.0;
  g.add(box(width, h, depth, facadeMat, x, h / 2, z));
  const frontX = x - side * (width / 2 + 0.07);
  g.add(box(0.34, h + 1.6, width + 0.4, facadeMat, frontX, h / 2 + 0.5, z));

  const porchX = x - side * (width / 2 + 1.1);
  g.add(box(2.4, 0.3, width + 0.8, mats.wood, porchX, 0.34, z));
  for (const dz of [-width / 2 + 0.5, width / 2 - 0.5]) g.add(box(0.16, 2.55, 0.16, mats.woodDark, porchX, 1.55, z + dz));
  g.add(box(2.45, 0.18, width + 1.0, mats.woodDark, porchX, 2.78, z));

  // Low stairs and railings make the street read as a navigable 3D space.
  for (let i = 0; i < 3; i++) g.add(box(0.64 + i * 0.35, 0.16, 1.9, mats.woodLight, porchX - side * (1.32 + i * 0.29), 0.08 + i * 0.12, z));
  for (const rz of [-1.2, 1.2]) {
    g.add(box(0.12, 1.0, 0.12, mats.woodDark, porchX - side * 1.18, 0.84, z + rz));
    g.add(box(1.5, 0.1, 0.1, mats.woodDark, porchX - side * 0.4, 1.1, z + rz));
  }

  const sign = signs.make(name);
  sign.position.set(frontX - side * 0.19, h + 0.4, z);
  sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
  g.add(sign);

  g.add(box(0.16, 2.5, 1.25, mats.woodDark, frontX - side * 0.19, 1.55, z));
  for (const wz of [-2.0, 2.0]) g.add(box(0.12, 1.4, 1.25, mats.window, frontX - side * 0.2, 2.2, z + wz));
  return g;
}

function buildTown(mats, signs, stage) {
  const root = new THREE.Group();
  const rand = seeded(0x51a7);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 170), mats.dust);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -30);
  root.add(ground);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(12, 166), mats.dustDark);
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, -0.07, -30);
  root.add(track);
  for (let z = 36; z > -105; z -= 8) {
    root.add(box(0.16, 0.015, 5.5, mats.sand, -2.8, 0, z));
    root.add(box(0.16, 0.015, 5.5, mats.sand, 2.8, 0, z));
  }

  const buildings = [
    [-1, 29, 'SHERIFF', mats.blue], [1, 22, 'GENERAL', mats.cream], [-1, 11, 'SALOON', mats.red], [1, 2, 'BANK', mats.woodLight],
    [-1, -10, 'HOTEL', mats.cream], [1, -22, 'STABLE', mats.green], [1, -35, 'GUNSMITH', mats.woodLight], [1, -47, 'CAFE', mats.blue],
    [-1, -61, 'FREIGHT', mats.red], [1, -73, 'LIVERY', mats.cream], [-1, -83, 'STOCKADE', mats.woodDark],
  ];
  for (const [side, z, name, mat] of buildings) root.add(makeBuilding(mats, signs, side, z, name, mat));

  for (const c of stage.colliders) {
    if (c.kind === 'trough') root.add(makeTrough(mats, c.x, c.z));
    else if (c.kind === 'fence') root.add(makeFence(mats, c.x, c.z, c.d > c.w));
    else if (c.kind === 'barrels') root.add(makeBarrelCluster(mats, c.x, c.z));
    else if (c.kind === 'crates') root.add(makeCrateStack(mats, c));
  }
  root.add(makeFence(mats, -7.8, -91.2, true, 8));
  root.add(makeFence(mats, 7.8, -91.2, true, 8));
  root.add(makeGatePosts(mats, stage.world.bossGateZ));

  const waterTower = new THREE.Group();
  const tank = cylinder(2.1, 2.1, 2.6, 10, mats.woodDark, 0, 7.1, 0);
  tank.rotation.z = Math.PI / 2;
  waterTower.add(tank);
  for (const sx of [-1.35, 1.35]) for (const sz of [-1.0, 1.0]) waterTower.add(box(0.28, 6, 0.28, mats.wood, sx, 3, sz));
  waterTower.position.set(12.5, 0, -42);
  root.add(waterTower);

  for (let z = 34; z > -96; z -= 14) {
    const side = Math.floor((z + 100) / 14) % 2 ? -1 : 1;
    const cactus = makeCactus(mats);
    cactus.position.set(side * (11.5 + rand() * 3), 0, z + rand() * 4);
    root.add(cactus);
  }
  return root;
}

/* ------------------------------------------------------------------ Red Mesa Pass */

function makeMinecart(mats, c) {
  const g = new THREE.Group();
  const alongZ = c.d > c.w;
  const L = Math.max(c.w, c.d) * 0.92, W = Math.min(c.w, c.d) * 0.92;
  const sx = alongZ ? W : L, sz = alongZ ? L : W;
  g.add(box(sx, 0.78, sz, mats.iron, 0, 0.78, 0));
  g.add(box(sx + 0.08, 0.1, sz + 0.08, mats.woodDark, 0, 1.18, 0));
  for (const [ox, oz] of [[-0.2, -0.3], [0.18, 0.25], [0, 0.6], [-0.1, -0.75]]) g.add(stone(mats.ore, ox * sx, 1.2, oz * sz, 0.32, 0.26, 0.32, ox * 3));
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const wheel = cylinder(0.24, 0.24, 0.12, 10, mats.ink, alongZ ? a * (sx / 2 + 0.02) : b * sx * 0.32, 0.26, alongZ ? b * sz * 0.32 : a * (sz / 2 + 0.02));
    wheel.rotation.z = alongZ ? Math.PI / 2 : 0;
    wheel.rotation.x = alongZ ? 0 : Math.PI / 2;
    g.add(wheel);
  }
  g.position.set(c.x, 0, c.z);
  return g;
}

function makeBrokenWagon(mats, c) {
  const g = new THREE.Group();
  const bed = box(c.w * 0.95, 0.24, c.d * 0.92, mats.wood, 0, 0.55, 0);
  bed.rotation.z = 0.12;
  g.add(bed);
  for (const sz of [-1, 1]) {
    const side = box(c.w * 0.95, 0.42, 0.08, mats.woodLight, 0, 0.82, sz * c.d * 0.44);
    side.rotation.z = 0.12;
    g.add(side);
  }
  const cover = box(c.w * 0.6, 0.12, c.d * 1.0, mats.canvas, -0.25, 1.35, 0);
  cover.rotation.z = 0.32;
  g.add(cover);
  const wheel = cylinder(0.55, 0.55, 0.1, 12, mats.woodDark, c.w * 0.32, 0.55, c.d * 0.52);
  wheel.rotation.x = Math.PI / 2;
  g.add(wheel);
  const fallen = cylinder(0.55, 0.55, 0.1, 12, mats.woodDark, -c.w * 0.62, 0.05, c.d * 0.2);
  g.add(fallen);
  g.position.set(c.x, 0, c.z);
  return g;
}

function makeBoulder(mats, c, rand) {
  const g = new THREE.Group();
  g.add(stone(mats.rock, 0, 0.55, 0, c.w * 0.55, 1.0 + rand() * 0.35, c.d * 0.55, rand() * 6));
  g.add(stone(mats.rockDark, c.w * 0.32, 0.25, c.d * 0.3, 0.42, 0.36, 0.42, rand() * 6));
  g.position.set(c.x, 0, c.z);
  return g;
}

function makeTradingPost(mats, signs, shop) {
  const g = new THREE.Group();
  const x = -9.4;
  g.add(box(2.6, 2.8, 5.6, mats.woodLight, x - 0.9, 1.4, shop.z));
  g.add(box(0.9, 1.05, 4.2, mats.wood, -7.65, 0.53, shop.z));
  g.add(box(1.05, 0.1, 4.4, mats.woodDark, -7.65, 1.08, shop.z));
  for (const dz of [-2.6, 2.6]) g.add(box(0.16, 3.1, 0.16, mats.woodDark, -7.2, 1.55, shop.z + dz));
  // Striped awning over the counter.
  for (let i = 0; i < 6; i++) {
    const stripe = box(2.4, 0.08, 0.95, i % 2 ? mats.cream : mats.red, -8.2, 3.05, shop.z - 2.4 + i * 0.96);
    stripe.rotation.z = -0.28;
    g.add(stripe);
  }
  for (const [dx, dz] of [[-7.55, shop.z + 3.1], [-7.9, shop.z + 3.8]]) g.add(cylinder(0.42, 0.42, 1.0, 10, mats.wood, dx, 0.5, dz));
  g.add(box(0.3, 0.6, 0.4, mats.ore, -7.6, 1.38, shop.z - 1.0));
  g.add(box(0.5, 0.35, 0.35, mats.brass, -7.55, 1.3, shop.z + 0.9));
  const sign = signs.make('TRADING POST');
  sign.position.set(-7.05, 3.85, shop.z);
  sign.rotation.y = Math.PI / 2;
  g.add(sign);
  return g;
}

function buildCanyon(mats, signs, stage) {
  const root = new THREE.Group();
  const rand = seeded(0x3e5a);
  const w = stage.world;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 170), mats.mesaSand);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.08, -30);
  root.add(ground);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(13, 166), mats.mesaTrack);
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, -0.07, -30);
  root.add(track);
  for (let z = 36; z > -105; z -= 8) {
    root.add(box(0.16, 0.015, 5.5, mats.mesaRut, -2.5, 0, z));
    root.add(box(0.16, 0.015, 5.5, mats.mesaRut, 2.9, 0, z + 3));
  }

  // Canyon walls: stacked red-rock slabs with a pale band, boulders at their feet.
  for (const side of [-1, 1]) {
    for (let z = 46; z > -116; z -= 5.5) {
      const x0 = side * (10.0 + rand() * 1.4);
      const h = 4 + rand() * 5;
      const wd = 3.4 + rand() * 2.6;
      const dp = 5.2 + rand() * 2.2;
      const mat = rand() < 0.5 ? mats.rock : mats.rockDark;
      root.add(box(wd, h, dp, mat, x0 + side * wd / 2, h / 2, z));
      root.add(box(wd + 0.12, 0.45, dp + 0.12, mats.rockBand, x0 + side * wd / 2, h * 0.64, z));
      const h2 = h + 2 + rand() * 4.5;
      root.add(box(wd * 0.6, h2, dp * 0.72, mats.rock, x0 + side * (wd * 0.72 + 0.8), h2 / 2, z + (rand() - 0.5) * 2));
      if (rand() < 0.55) root.add(stone(mats.rockDark, x0 - side * 0.3, 0.35, z + (rand() - 0.5) * 3, 0.9 + rand() * 0.6, 0.6 + rand() * 0.4, 0.9 + rand() * 0.6, rand() * 6));
    }
  }
  // Far mesas on the horizon at both sides.
  for (const side of [-1, 1]) {
    for (let z = 40; z > -130; z -= 21) {
      const wd = 9 + rand() * 7, h = 9 + rand() * 7, dp = 13 + rand() * 7;
      const x = side * (25 + rand() * 7);
      root.add(box(wd, h, dp, mats.rockFar, x, h / 2, z));
      root.add(box(wd + 0.3, 0.8, dp + 0.3, mats.rockBand, x, h - 0.8, z));
    }
  }

  // The ore railway along the east edge of the trail.
  const railFrom = 24, railTo = -62;
  for (const dx of [-0.42, 0.42]) root.add(box(0.1, 0.1, railFrom - railTo, mats.iron, 5.6 + dx, 0.06, (railFrom + railTo) / 2));
  for (let z = railFrom; z > railTo; z -= 0.95) root.add(box(1.3, 0.07, 0.24, mats.woodDark, 5.6, 0.0, z));

  for (const c of stage.colliders) {
    if (c.kind === 'boulder') root.add(makeBoulder(mats, c, rand));
    else if (c.kind === 'minecart') root.add(makeMinecart(mats, c));
    else if (c.kind === 'wagon') root.add(makeBrokenWagon(mats, c));
    else if (c.kind === 'crates') root.add(makeCrateStack(mats, c));
    else if (c.kind === 'fence') root.add(makeFence(mats, c.x, c.z, c.d > c.w));
  }

  root.add(makeTradingPost(mats, signs, w.shop));

  // The Bonanza mine mouth in the west wall.
  const mineZ = -60;
  root.add(box(0.6, 3.6, 4.4, mats.mineDark, -9.75, 1.8, mineZ));
  root.add(box(0.4, 3.9, 0.4, mats.woodDark, -9.3, 1.95, mineZ - 2.1));
  root.add(box(0.4, 3.9, 0.4, mats.woodDark, -9.3, 1.95, mineZ + 2.1));
  root.add(box(0.5, 0.45, 4.9, mats.woodDark, -9.3, 3.95, mineZ));
  const mineSign = signs.make('BONANZA MINE', 3.2, 1.0);
  mineSign.position.set(-9.0, 4.75, mineZ);
  mineSign.rotation.y = Math.PI / 2;
  root.add(mineSign);
  for (let i = 0; i < 3; i++) root.add(box(1.0, 0.07, 0.24, mats.woodDark, -8.4 + i * 0.05, 0.0, mineZ - 0.9 + i * 0.9));

  // Cacti and boulders in the gap between the trail and the walls.
  for (let z = 32; z > -96; z -= 11) {
    const side = rand() < 0.5 ? -1 : 1;
    if (rand() < 0.6) {
      const cactus = makeCactus(mats);
      cactus.position.set(side * (8.4 + rand() * 1.2), 0, z + rand() * 4);
      cactus.rotation.y = rand() * 6;
      root.add(cactus);
    } else {
      root.add(stone(mats.rock, side * (8.6 + rand()), 0.4, z, 0.8 + rand() * 0.5, 0.55, 0.8, rand() * 6));
    }
  }

  // Iron Mae's claim: the gate, side fences, an arch and her tents.
  root.add(makeGatePosts(mats, w.bossGateZ));
  root.add(makeFence(mats, -7.8, -92.2, true, 10));
  root.add(makeFence(mats, 7.8, -92.2, true, 10));
  // The arch stands just past the end of the trail, out of the way of the fight.
  for (const sx of [-1, 1]) root.add(box(0.5, 5.2, 0.5, mats.woodDark, sx * 6.2, 2.6, -105));
  root.add(box(13.0, 0.5, 0.6, mats.woodDark, 0, 5.1, -105));
  const claim = signs.make('CALLOWAY CLAIM', 4.2, 1.3);
  claim.position.set(0, 5.95, -104.68);
  root.add(claim);
  for (const [tx, tz] of [[-10.5, -95], [10.8, -98]]) {
    const tent = new THREE.Mesh(cached('tent', () => new THREE.ConeGeometry(2.2, 2.8, 4)), mats.canvas);
    tent.position.set(tx, 1.4, tz);
    tent.rotation.y = Math.PI / 4;
    root.add(tent);
  }
  return root;
}

/* ------------------------------------------------------------------ characters, crates, pickups */

function rawCowboy(mats, role) {
  const g = new THREE.Group();
  let shirt = mats.blue, hat = mats.cream, pants = mats.ink, accent = mats.red;
  if (role === 'grunt') { shirt = mats.green; hat = mats.woodLight; accent = mats.ink; }
  if (role === 'rifle') { shirt = mats.red; hat = mats.woodDark; accent = mats.cream; }
  if (role === 'boss') { shirt = mats.black; hat = mats.black; accent = mats.red; }
  if (role === 'dynamiter') { shirt = mats.sand; hat = mats.red; accent = mats.ink; pants = mats.woodDark; }
  if (role === 'mae') { shirt = mats.red; hat = mats.cream; accent = mats.brass; pants = mats.woodDark; }

  g.add(box(0.84, 1.05, 0.55, shirt, 0, 1.18, 0));
  g.add(box(0.75, 0.52, 0.52, pants, 0, 0.42, 0));
  g.add(cylinder(0.3, 0.33, 0.5, 8, mats.cream, 0, 1.95, 0));
  g.add(cylinder(0.58, 0.58, 0.1, 10, hat, 0, 2.23, 0));
  g.add(cylinder(0.35, 0.39, 0.44, 8, hat, 0, 2.46, 0));
  g.add(box(0.92, 0.14, 0.6, accent, 0, 1.52, 0.03));
  for (const sx of [-1, 1]) {
    const arm = box(0.18, 0.68, 0.18, shirt, sx * 0.52, 1.24, -0.05);
    arm.rotation.z = sx * -0.23;
    g.add(arm);
    if (role !== 'mae') g.add(box(0.11, 0.11, 0.78, mats.brass, sx * 0.62, 1.03, -0.55));
  }
  if (role === 'boss') {
    const badge = cylinder(0.14, 0.14, 0.05, 6, mats.brass, 0.22, 1.35, -0.3);
    badge.rotation.x = Math.PI / 2;
    g.add(badge);
  }
  if (role === 'dynamiter') {
    for (const dx of [-0.2, 0, 0.2]) g.add(cylinder(0.07, 0.07, 0.5, 6, mats.dynamite, dx, 1.2, -0.32));
    g.add(box(0.6, 0.08, 0.06, mats.ink, 0, 1.2, -0.36));
  }
  return g;
}

function scaled(group, s) {
  const outer = new THREE.Group();
  group.scale.setScalar(s);
  outer.add(group);
  return outer;
}

function rawRider(mats) {
  const g = new THREE.Group();
  g.add(box(0.92, 0.92, 1.72, mats.horse, 0, 0.88, 0));
  g.add(box(0.52, 0.65, 0.68, mats.horse, 0, 1.25, -1.0));
  for (const sx of [-0.32, 0.32]) for (const sz of [-0.55, 0.55]) g.add(box(0.16, 0.95, 0.16, mats.horseDark, sx, 0.37, sz));
  const rider = rawCowboy(mats, 'grunt');
  rider.scale.setScalar(0.78);
  rider.position.set(0, 1.25, 0.18);
  g.add(rider);
  return g;
}

function rawMaeWagon(mats) {
  const g = new THREE.Group();
  g.add(box(2.5, 0.42, 2.3, mats.wood, 0, 0.82, 0));
  g.add(box(2.6, 0.5, 0.1, mats.woodLight, 0, 1.2, 1.12));
  g.add(box(0.1, 0.5, 2.3, mats.woodLight, -1.25, 1.2, 0));
  g.add(box(0.1, 0.5, 2.3, mats.woodLight, 1.25, 1.2, 0));
  g.add(box(2.7, 0.14, 0.5, mats.iron, 0, 1.05, -1.25));
  for (const sx of [-1, 1]) for (const sz of [-0.75, 0.75]) {
    const wheel = cylinder(0.55, 0.55, 0.12, 12, mats.woodDark, sx * 1.33, 0.55, sz);
    wheel.rotation.z = Math.PI / 2;
    g.add(wheel);
    const hub = cylinder(0.14, 0.14, 0.16, 8, mats.iron, sx * 1.36, 0.55, sz);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
  }
  return g;
}

function rawMaeTurret(mats) {
  const g = new THREE.Group();
  g.add(cylinder(0.32, 0.42, 0.5, 8, mats.iron, 0, 1.3, -0.35));
  const housing = cylinder(0.26, 0.26, 0.7, 8, mats.iron, 0, 1.72, -0.75);
  housing.rotation.x = Math.PI / 2;
  g.add(housing);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const barrel = cylinder(0.05, 0.05, 1.25, 6, mats.brass, Math.cos(a) * 0.15, 1.72 + Math.sin(a) * 0.15, -1.6);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
  }
  const muzzle = cylinder(0.2, 0.2, 0.1, 8, mats.iron, 0, 1.72, -2.2);
  muzzle.rotation.x = Math.PI / 2;
  g.add(muzzle);
  const mae = rawCowboy(mats, 'mae');
  mae.position.set(0, 1.03, 0.45);
  g.add(mae);
  return g;
}

function rawCrate(mats, poster) {
  const g = new THREE.Group();
  g.add(box(1.25, 1.25, 1.25, mats.woodLight, 0, 0.63, 0));
  g.add(box(1.32, 0.12, 0.12, mats.woodDark, 0, 0.72, 0.64));
  g.add(box(0.12, 1.32, 0.12, mats.woodDark, 0, 0.72, 0.64));
  g.add(box(1.32, 0.12, 0.12, mats.woodDark, 0, 0.72, -0.64));
  if (poster) {
    const glint = cylinder(0.08, 0.08, 1.5, 6, mats.brass, 0, 1.65, 0);
    glint.scale.x = 0.28;
    g.add(glint);
  }
  return g;
}

function rawKeg(mats) {
  const g = new THREE.Group();
  g.add(cylinder(0.42, 0.42, 0.95, 10, mats.red, 0, 0.48, 0));
  g.add(cylinder(0.44, 0.44, 0.07, 10, mats.ink, 0, 0.18, 0));
  g.add(cylinder(0.44, 0.44, 0.07, 10, mats.ink, 0, 0.78, 0));
  g.add(box(0.4, 0.24, 0.05, mats.cream, 0, 0.5, 0.42));
  g.add(box(0.4, 0.24, 0.05, mats.cream, 0, 0.5, -0.42));
  g.add(cylinder(0.03, 0.03, 0.3, 4, mats.ink, 0.1, 1.08, 0));
  return g;
}

function rawPickup(mats, kind) {
  const g = new THREE.Group();
  if (kind === 'poster') {
    g.add(box(0.72, 0.9, 0.06, mats.poster, 0, 0.5, 0));
    g.add(box(0.18, 0.22, 0.07, mats.ink, 0, 0.58, -0.04));
  } else if (kind === 'coin') {
    const c = cylinder(0.35, 0.35, 0.08, 10, mats.brass, 0, 0.36, 0);
    c.rotation.z = Math.PI / 2;
    g.add(c);
  } else if (kind === 'medkit') {
    g.add(box(0.62, 0.48, 0.46, mats.cream, 0, 0.28, 0));
    g.add(box(0.18, 0.5, 0.5, mats.red, 0, 0.29, -0.03));
    g.add(box(0.5, 0.18, 0.5, mats.red, 0, 0.29, -0.03));
  } else if (kind === 'boots') {
    g.add(box(0.24, 0.48, 0.48, mats.woodDark, -0.18, 0.28, 0));
    g.add(box(0.24, 0.48, 0.48, mats.woodDark, 0.18, 0.28, 0));
  } else if (kind === 'silver') {
    g.add(cylinder(0.35, 0.35, 0.16, 6, mats.pickupBlue, 0, 0.3, 0));
    g.add(cylinder(0.12, 0.12, 0.42, 6, mats.brass, 0, 0.46, 0));
  } else if (kind === 'star') {
    const badge = cylinder(0.4, 0.4, 0.07, 5, mats.brass, 0, 0.45, 0);
    badge.rotation.x = Math.PI / 2;
    g.add(badge);
    const core = cylinder(0.16, 0.16, 0.09, 10, mats.ink, 0, 0.45, 0);
    core.rotation.x = Math.PI / 2;
    g.add(core);
  } else if (kind === 'bandolier') {
    const belt = new THREE.Mesh(cached('belt', () => new THREE.TorusGeometry(0.32, 0.07, 6, 16)), mats.woodDark);
    belt.position.y = 0.45;
    g.add(belt);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const shell = cylinder(0.045, 0.045, 0.2, 6, mats.brass, Math.cos(a) * 0.32, 0.45 + Math.sin(a) * 0.32, 0.06);
      shell.rotation.x = Math.PI / 2;
      g.add(shell);
    }
  } else {
    g.add(new THREE.Mesh(cached('octa', () => new THREE.OctahedronGeometry(0.35)), mats.pickupGreen));
  }
  return g;
}

function addHealthBar(group, mats, y, width) {
  const bar = new THREE.Group();
  bar.name = 'hpBar';
  bar.position.y = y;
  bar.add(new THREE.Mesh(boxGeo(width, 0.12, 0.12), mats.ink));
  const fillWidth = width - 0.08;
  const fillGeo = new THREE.BoxGeometry(fillWidth, 0.08, 0.14);
  fillGeo.translate(fillWidth / 2, 0, 0);
  const fill = new THREE.Mesh(fillGeo, mats.red);
  fill.name = 'hpFill';
  fill.position.set(-fillWidth / 2, 0, 0.02);
  bar.add(fill);
  group.add(bar);
}

function buildTemplates(mats) {
  const t = {};
  for (const role of ['player', 'grunt', 'rifle', 'dynamiter']) t[role] = mergeByMaterial(rawCowboy(mats, role));
  t.boss = mergeByMaterial(scaled(rawCowboy(mats, 'boss'), 1.18));
  addHealthBar(t.boss, mats, 3.62, 1.7);
  t.rider = mergeByMaterial(rawRider(mats));
  t.mae = new THREE.Group();
  t.mae.add(mergeByMaterial(rawMaeWagon(mats)));
  const turret = mergeByMaterial(rawMaeTurret(mats));
  turret.name = 'turret';
  t.mae.add(turret);
  addHealthBar(t.mae, mats, 4.1, 2.4);
  t.posterCrate = mergeByMaterial(rawCrate(mats, true));
  t.lootCrate = mergeByMaterial(rawCrate(mats, false));
  t.keg = mergeByMaterial(rawKeg(mats));
  for (const kind of ['poster', 'coin', 'medkit', 'boots', 'silver', 'star', 'bandolier']) t[kind] = mergeByMaterial(rawPickup(mats, kind));
  return t;
}

const CHARACTER = new Set(['player', 'grunt', 'rifle', 'dynamiter', 'boss', 'rider', 'mae']);
const PICKUP = new Set(['poster', 'coin', 'medkit', 'boots', 'silver', 'star', 'bandolier']);

/* ------------------------------------------------------------------ effects */

// Particle looks: speed (sideways), up (min, max), size, life (min, max), gravity.
const FX = {
  muzzle: [1.4, 0.4, 1.4, 0.05, 0.07, 0.16, 2],
  hit: [4.8, 1.8, 6.0, 0.055, 0.3, 0.75, 8.6],
  big: [5.6, 2.2, 7.0, 0.09, 0.4, 0.9, 8.6],
  fire: [6.5, 2.0, 7.5, 0.12, 0.22, 0.55, 4],
  smoke: [2.2, 1.0, 2.6, 0.2, 0.6, 1.1, -0.8],
  spark: [0.9, 0.6, 1.6, 0.035, 0.1, 0.22, 1],
  sparkle: [2.0, 1.4, 3.4, 0.06, 0.4, 0.8, 2.2],
  puff: [1.8, 0.3, 1.0, 0.14, 0.35, 0.6, -0.4],
};
const PARTICLE_CAP = 720;
const RING_CAP = 48;

/* ------------------------------------------------------------------ the view */

export async function createRenderSystem(kit, { onProgress } = {}) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.FogExp2(PALETTE.sky, 0.0125);

  const camera = new THREE.PerspectiveCamera(49, 1, 0.1, 220);
  camera.position.set(0, 26, STAGES[0].world.startZ + 20);
  kit.onResize((w, h) => {
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.72 ? 58 : camera.aspect < 1 ? 54 : 49;
    camera.updateProjectionMatrix();
  });

  const hemi = new THREE.HemisphereLight(0xffe6b6, 0x593a32, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6a0, 3.2);
  sun.position.set(-18, 34, 26);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 30, bottom: -30, near: 4, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const mats = createMaterials();
  const signs = createSignAtlas();

  onProgress?.(0.72, 'Building Cinder Creek…');
  const stageRoots = [];
  const gates = [];
  for (const [i, stage] of STAGES.entries()) {
    if (i === 1) onProgress?.(0.8, 'Building Red Mesa Pass…');
    const raw = stage.theme === 'canyon' ? buildCanyon(mats, signs, stage) : buildTown(mats, signs, stage);
    const root = mergeByMaterial(raw);
    const gate = { left: makeGateDoor(mats, 1, stage.world.bossGateZ), right: makeGateDoor(mats, -1, stage.world.bossGateZ), open: 0 };
    root.add(gate.left, gate.right);
    root.visible = i === 0;
    scene.add(root);
    stageRoots.push(root);
    gates.push(gate);
  }

  const shopRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.45, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.6, depthWrite: false })
  );
  shopRing.renderOrder = 1;
  scene.add(shopRing);

  onProgress?.(0.86, 'Saddling the outlaws…');
  const templates = buildTemplates(mats);
  const entityRoot = new THREE.Group();
  scene.add(entityRoot);

  // Instanced pools (they move every frame, so kit.instanced: one shared shader for all of them).
  const pool = (geometry, material, cap, colors = false) => {
    const mesh = kit.instanced(geometry, material, cap);
    mesh.count = 0;
    mesh.frustumCulled = false;
    if (colors) mesh.setColorAt(0, _c.setRGB(1, 1, 1));
    scene.add(mesh);
    return mesh;
  };
  const bulletGeo = new THREE.CapsuleGeometry(0.07, 0.25, 2, 5).rotateX(Math.PI / 2);
  const playerBullets = pool(bulletGeo, mats.bulletPlayer, 200);
  const enemyBullets = pool(bulletGeo, mats.bulletEnemy, 260);
  const sticks = pool(new THREE.BoxGeometry(0.12, 0.12, 0.46), mats.dynamite, 40);
  sticks.castShadow = true;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const rings = pool(new THREE.RingGeometry(0.84, 1, 36).rotateX(-Math.PI / 2), ringMat, RING_CAP, true);
  rings.renderOrder = 2;
  const sparks = pool(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), PARTICLE_CAP, true);

  // Drifting dust: sized points (WebGPU would draw THREE.Points at 1 px).
  const DUST_MAX = 200;
  const dustPos = new Float32Array(DUST_MAX * 3);
  const dustRand = seeded(0xd057);
  for (let i = 0; i < DUST_MAX; i++) {
    dustPos[i * 3] = (dustRand() - 0.5) * 34;
    dustPos[i * 3 + 1] = 0.1 + dustRand() * 4.2;
    dustPos[i * 3 + 2] = (dustRand() - 0.5) * 62;
  }
  const dust = createPoints({ positions: dustPos, size: 0.1, sizeAttenuation: true, material: { color: 0xe2bb80, transparent: true, opacity: 0.36, depthWrite: false } });
  scene.add(dust.object);
  const dustCount = () => Math.min(DUST_MAX, kit.detail(150));
  dust.setCount(dustCount());
  kit.onQuality(() => dust.setCount(dustCount()));

  const post = createPost(kit, scene, camera, { bloom: { strength: 0.16, radius: 0.16, threshold: 1.05 } });

  /* ---------------- entity visuals */

  const visuals = new Map();
  const free = new Map();
  let stamp = 0;

  function acquire(kind) {
    const list = free.get(kind);
    if (list && list.length) {
      const rec = list.pop();
      rec.obj.visible = true;
      return rec;
    }
    const obj = templates[kind].clone();
    const meshes = [];
    obj.traverse((o) => {
      if (o.isMesh && o.name !== 'hpFill' && o.parent?.name !== 'hpBar') meshes.push(o);
    });
    const rec = {
      kind, obj, meshes, base: meshes.map((m) => m.material),
      turret: obj.getObjectByName('turret') || null,
      hpBar: obj.getObjectByName('hpBar') || null,
      hpFill: obj.getObjectByName('hpFill') || null,
      flash: 0, flashing: false, punch: 0, walk: 0, lastX: 0, lastZ: 0, stamp: 0,
    };
    entityRoot.add(obj);
    return rec;
  }

  function release(rec) {
    rec.obj.visible = false;
    setFlash(rec, false);
    rec.flash = 0;
    rec.punch = 0;
    rec.obj.scale.setScalar(1);
    rec.obj.rotation.set(0, 0, 0);
    let list = free.get(rec.kind);
    if (!list) free.set(rec.kind, (list = []));
    list.push(rec);
  }

  function setFlash(rec, on) {
    if (rec.flashing === on) return;
    rec.flashing = on;
    for (let i = 0; i < rec.meshes.length; i++) rec.meshes[i].material = on ? mats.flash : rec.base[i];
  }

  function sync(e, kind, state, dt, t) {
    let rec = visuals.get(e.id);
    if (rec && rec.kind !== kind) {
      release(rec);
      rec = null;
    }
    if (!rec) {
      rec = acquire(kind);
      visuals.set(e.id, rec);
      rec.lastX = e.x;
      rec.lastZ = e.z;
    }
    rec.stamp = stamp;
    const o = rec.obj;
    let y = 0;
    let tilt = 0;
    if (CHARACTER.has(kind)) {
      y = kind === 'rider' ? 0.05 : kind === 'mae' ? 0 : 0.02;
      const moved = dt > 0 ? Math.hypot(e.x - rec.lastX, e.z - rec.lastZ) / dt : 0;
      if (moved > 0.25) {
        rec.walk += dt * (kind === 'rider' ? 13 : 11);
        y += Math.abs(Math.sin(rec.walk)) * (kind === 'rider' ? 0.12 : 0.07);
        tilt = Math.sin(rec.walk) * (kind === 'mae' ? 0.015 : 0.06);
      }
      // The models face -z: turn them by half a circle so guns point at the target.
      const face = kind === 'player' ? Math.atan2(e.aimX, e.aimZ) + Math.PI : Math.atan2(state.player.x - e.x, state.player.z - e.z) + Math.PI;
      if (rec.turret) {
        o.rotation.set(0, 0, tilt);
        rec.turret.rotation.y = face;
      } else {
        o.rotation.set(0, face, tilt);
      }
      if (rec.hpFill) {
        rec.hpFill.scale.x = Math.max(0.03, e.hp / e.maxHp);
        rec.hpBar.rotation.y = -o.rotation.y;
      }
    } else if (PICKUP.has(kind)) {
      y = 0.1 + Math.sin(state.time * 4 + e.id) * 0.16 + 0.34;
      o.rotation.y = state.time * 1.9 + e.id;
    }
    rec.lastX = e.x;
    rec.lastZ = e.z;
    o.position.set(e.x, y, e.z);

    if (rec.flash > 0) rec.flash -= dt;
    setFlash(rec, rec.flash > 0);
    if (rec.punch > 0.001) {
      rec.punch *= Math.exp(-dt * 14);
      o.scale.setScalar(1 + rec.punch * 0.14);
    } else if (rec.punch !== 0) {
      rec.punch = 0;
      o.scale.setScalar(1);
    }
    o.visible = true;
    return rec;
  }

  function syncVisuals(state, dt, t) {
    stamp++;
    const p = state.player;
    const prec = sync(p, 'player', state, dt, t);
    // Blink while the player is briefly invulnerable after a hit.
    if (p.invuln > 0 && state.status === 'playing') prec.obj.visible = Math.floor(t * 22) % 2 === 0;
    for (const e of state.enemies) sync(e, e.kind, state, dt, t);
    for (const q of state.pickups) sync(q, q.kind, state, dt, t);
    for (const d of state.destructibles) if (d.alive) sync(d, d.kind, state, dt, t);
    for (const [id, rec] of visuals) {
      if (rec.stamp !== stamp) {
        release(rec);
        visuals.delete(id);
      }
    }
  }

  function hitFeedback(id, flash = 0.07, punch = 1) {
    const rec = visuals.get(id);
    if (!rec) return;
    rec.flash = Math.max(rec.flash, flash);
    rec.punch = Math.max(rec.punch, punch);
  }

  /* ---------------- particles */

  const P = {
    n: 0,
    x: new Float32Array(PARTICLE_CAP), y: new Float32Array(PARTICLE_CAP), z: new Float32Array(PARTICLE_CAP),
    vx: new Float32Array(PARTICLE_CAP), vy: new Float32Array(PARTICLE_CAP), vz: new Float32Array(PARTICLE_CAP),
    life: new Float32Array(PARTICLE_CAP), max: new Float32Array(PARTICLE_CAP), size: new Float32Array(PARTICLE_CAP),
    grav: new Float32Array(PARTICLE_CAP), r: new Float32Array(PARTICLE_CAP), g: new Float32Array(PARTICLE_CAP), b: new Float32Array(PARTICLE_CAP),
  };
  const FIELDS = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'life', 'max', 'size', 'grav', 'r', 'g', 'b'].map((f) => P[f]);

  function burst(x, y, z, count, hex, fx) {
    const [speed, upMin, upMax, size, lifeMin, lifeMax, grav] = fx;
    _c.setHex(hex);
    const n = Math.max(1, Math.round(count * kit.tier.detail));
    for (let k = 0; k < n && P.n < PARTICLE_CAP; k++) {
      const i = P.n++;
      P.x[i] = x; P.y[i] = y + Math.random() * 0.3; P.z[i] = z;
      P.vx[i] = (Math.random() - 0.5) * speed;
      P.vz[i] = (Math.random() - 0.5) * speed;
      P.vy[i] = upMin + Math.random() * (upMax - upMin);
      P.max[i] = P.life[i] = lifeMin + Math.random() * (lifeMax - lifeMin);
      P.size[i] = size * (0.75 + Math.random() * 0.5);
      P.grav[i] = grav;
      P.r[i] = _c.r; P.g[i] = _c.g; P.b[i] = _c.b;
    }
  }

  function updateParticles(dt) {
    for (let i = 0; i < P.n; ) {
      P.life[i] -= dt;
      if (P.life[i] <= 0) {
        const last = --P.n;
        if (i !== last) for (let k = 0; k < FIELDS.length; k++) FIELDS[k][i] = FIELDS[k][last];
        continue;
      }
      P.vy[i] -= P.grav[i] * dt;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      P.z[i] += P.vz[i] * dt;
      if (P.y[i] < 0.03) {
        P.y[i] = 0.03;
        P.vy[i] *= -0.3;
        P.vx[i] *= 0.6;
        P.vz[i] *= 0.6;
      }
      i++;
    }
    const colors = sparks.instanceColor.array;
    for (let i = 0; i < P.n; i++) {
      const s = P.size[i] * (0.3 + 0.7 * (P.life[i] / P.max[i]));
      _m.makeScale(s, s, s).setPosition(P.x[i], P.y[i], P.z[i]);
      sparks.setMatrixAt(i, _m);
      colors[i * 3] = P.r[i];
      colors[i * 3 + 1] = P.g[i];
      colors[i * 3 + 2] = P.b[i];
    }
    sparks.count = P.n;
    upload(sparks.instanceMatrix, P.n, 16);
    upload(sparks.instanceColor, P.n, 3);
  }

  /* ---------------- rings (shockwaves) and pooled projectiles */

  const shocks = [];
  function shock(x, z, radius, hex, dur = 0.38) {
    if (shocks.length >= 16) shocks.shift();
    shocks.push({ x, z, radius, hex, t: 0, dur });
  }

  let ringCount = 0;
  function pushRing(x, y, z, scale, hex, k) {
    if (ringCount >= RING_CAP) return;
    _m.makeScale(scale, 1, scale).setPosition(x, y, z);
    rings.setMatrixAt(ringCount, _m);
    _c.setHex(hex).multiplyScalar(k);
    const rc = rings.instanceColor.array;
    rc[ringCount * 3] = _c.r;
    rc[ringCount * 3 + 1] = _c.g;
    rc[ringCount * 3 + 2] = _c.b;
    ringCount++;
  }

  function updatePools(state, dt, t) {
    let np = 0, ne = 0;
    for (const b of state.bullets) {
      _m.makeRotationY(Math.atan2(b.dx, b.dz)).setPosition(b.x, 0.82, b.z);
      if (b.owner === 'player') {
        if (np < 200) playerBullets.setMatrixAt(np++, _m);
      } else if (ne < 260) enemyBullets.setMatrixAt(ne++, _m);
    }
    playerBullets.count = np;
    enemyBullets.count = ne;
    upload(playerBullets.instanceMatrix, np, 16);
    upload(enemyBullets.instanceMatrix, ne, 16);

    let ns = 0;
    ringCount = 0;
    for (const b of state.bombs) {
      const f = Math.min(1, b.t / b.dur);
      if (ns < 40) {
        _e.set(t * 9 + b.id, t * 4, 0);
        _q.setFromEuler(_e);
        _m.compose(_v.set(b.x, 0.9 + Math.sin(Math.PI * f) * 3.4, b.z), _q, _s.set(1, 1, 1));
        sticks.setMatrixAt(ns++, _m);
        if (dt > 0 && Math.random() < 0.6) burst(b.x, 1.0 + Math.sin(Math.PI * f) * 3.4, b.z, 1, 0xffd27a, FX.spark);
      }
      // The landing mark tightens as the fuse runs down.
      const pulse = 0.65 + 0.35 * Math.sin(t * 18);
      pushRing(b.tx, 0.05, b.tz, b.radius * (1.35 - 0.35 * f), 0xff4a2a, (0.35 + 0.65 * f) * pulse);
      pushRing(b.tx, 0.05, b.tz, b.radius * 0.35 * f + 0.05, 0xff7a3a, 0.6 * f);
    }
    for (let i = shocks.length - 1; i >= 0; i--) {
      const s = shocks[i];
      s.t += dt;
      if (s.t >= s.dur) {
        shocks.splice(i, 1);
        continue;
      }
      const f = s.t / s.dur;
      pushRing(s.x, 0.06, s.z, s.radius * (0.35 + 0.9 * f), s.hex, 1 - f);
    }
    sticks.count = ns;
    upload(sticks.instanceMatrix, ns, 16);
    rings.count = ringCount;
    upload(rings.instanceMatrix, ringCount, 16);
    upload(rings.instanceColor, ringCount, 3);
  }

  /* ---------------- events */

  let shake = 0;
  function handleEvents(state, events) {
    const p = state.player;
    for (const ev of events) {
      switch (ev.type) {
        case 'playerShot':
          burst(p.x + ev.ax * 0.9, 1.0, p.z + ev.az * 0.9, 3, 0xf4d08b, FX.muzzle);
          break;
        case 'enemyShot':
        case 'bossShot':
          burst(ev.x, 1.0, ev.z, ev.gatling ? 3 : 2, 0xff8a4a, FX.muzzle);
          if (ev.type === 'bossShot') shake = Math.max(shake, ev.gatling ? 0.06 : 0.12);
          break;
        case 'bossWindup':
          burst(ev.x, 1.7, ev.z + 1.4, 5, 0xffd27a, FX.spark);
          break;
        case 'hit':
          burst(ev.x, 0.7, ev.z, 3, 0xf4d08b, FX.hit);
          hitFeedback(ev.id, ev.boss ? 0.05 : 0.08, ev.boss ? 0.4 : 1);
          break;
        case 'woodHit':
          burst(ev.x, 0.7, ev.z, 3, 0xb97943, FX.hit);
          hitFeedback(ev.id, 0.05, 0.6);
          break;
        case 'crateBreak':
          burst(ev.x, 0.7, ev.z, 12, 0xb97943, FX.hit);
          break;
        case 'enemyDown':
          burst(ev.x, 0.7, ev.z, 8, 0xf4d08b, FX.hit);
          burst(ev.x, 0.4, ev.z, 3, 0xc9a07a, FX.puff);
          break;
        case 'bossDown':
          burst(ev.x, 1.2, ev.z, 26, 0xffc85a, FX.big);
          burst(ev.x, 0.6, ev.z, 10, 0x9a8a7a, FX.smoke);
          shock(ev.x, ev.z, 4, 0xffc85a, 0.6);
          shake = Math.max(shake, 0.7);
          break;
        case 'playerHit':
          shake = Math.max(shake, 0.42);
          hitFeedback(0, 0.06, 0.5);
          break;
        case 'bossIntro':
        case 'bossEnrage':
          shake = Math.max(shake, 0.5);
          break;
        case 'explosion': {
          burst(ev.x, 0.5, ev.z, 18, 0xffa040, FX.fire);
          burst(ev.x, 0.6, ev.z, 8, 0xffe08a, FX.big);
          burst(ev.x, 0.4, ev.z, 10, 0x6d5a4e, FX.smoke);
          shock(ev.x, ev.z, ev.radius, 0xffb060);
          const d = Math.hypot(ev.x - p.x, ev.z - p.z);
          shake = Math.max(shake, d < 6 ? 0.55 : d < 14 ? 0.3 : 0.12);
          break;
        }
        case 'dynamiteThrow':
          burst(ev.x, 1.3, ev.z, 2, 0xffd27a, FX.spark);
          break;
        case 'riderCharge':
          burst(ev.x, 0.2, ev.z, 5, 0xc9a07a, FX.puff);
          break;
        case 'posterFound':
          burst(ev.x, 0.8, ev.z, 16, 0xffe29a, FX.sparkle);
          shock(ev.x, ev.z, 1.8, 0xffd27a, 0.5);
          break;
        case 'pickup':
        case 'equipment':
          burst(ev.x, 0.6, ev.z, ev.type === 'equipment' ? 12 : 6, ev.kind === 'medkit' ? 0xff8a7a : 0xffe29a, FX.sparkle);
          break;
        default:
          break;
      }
    }
  }

  /* ---------------- camera, gate, dust */

  const look = new THREE.Vector3(0, 0.3, STAGES[0].world.startZ - 7);
  const desired = new THREE.Vector3();
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
  const raycaster = new THREE.Raycaster();
  const hitPoint = new THREE.Vector3();
  let cameraZoom = 1;

  function updateCamera(state, dt, t) {
    const w = state.world;
    const p = state.player;
    const portraitLift = camera.aspect < 0.8 ? 4.8 : 0;
    if (state.status === 'briefing') {
      // Title screen: a slow ride up and down the street.
      const span = w.startZ - w.bossGateZ - 14;
      const z = w.startZ - 10 - (0.5 - 0.5 * Math.cos(t * 0.05)) * span;
      look.set(Math.sin(t * 0.13) * 1.5, 0.3, z);
      desired.set(Math.sin(t * 0.09) * 3, 29 + portraitLift, z + 21 + portraitLift * 0.55);
    } else {
      const aimLeadX = p.aimX * 1.2;
      const aimLeadZ = p.aimZ * 2.1;
      const bossMode = state.bossSpawned && !state.bossDefeated;
      const targetZ = bossMode ? Math.min(p.z - 4, w.bossGateZ - 2) : p.z - 7.2 + aimLeadZ;
      look.set(p.x * 0.18 + aimLeadX, 0.3, targetZ);
      desired.set(look.x * 0.42, (25.5 + portraitLift) / cameraZoom, look.z + (18.5 + portraitLift * 0.55) / cameraZoom);
    }
    camera.position.lerp(desired, 1 - Math.exp(-dt * 6.5));
    if (shake > 0.001 && dt > 0) {
      const s = shake * 0.32;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s * 0.35;
      shake *= Math.exp(-dt * 8.5);
    }
    camera.lookAt(look);
    sun.position.set(-18, 34, look.z + 30);
    sun.target.position.set(0, 0, look.z);
  }

  function updateGate(state, dt) {
    const gate = gates[state.stageIndex];
    const target = state.posterFound && !state.bossSpawned && state.status !== 'briefing' ? 1 : 0;
    gate.open += (target - gate.open) * (1 - Math.exp(-dt * (target ? 2.2 : 7)));
    gate.left.rotation.y = gate.open * 1.45;
    gate.right.rotation.y = -gate.open * 1.45;
  }

  function updateDust(dt) {
    const arr = dust.positions.array;
    const n = dust.object.count;
    for (let i = 0; i < n; i++) {
      let x = arr[i * 3] + dt * 0.55;
      let z = arr[i * 3 + 2] + dt * 0.2;
      if (x > 17) x -= 34;
      if (z > 31) z -= 62;
      arr[i * 3] = x;
      arr[i * 3 + 2] = z;
    }
    dust.positions.needsUpdate = true;
    dust.object.position.set(0, 0, look.z - 12);
  }

  /* ---------------- stage switching and lifecycle */

  let currentStage = -1;
  function setStage(index) {
    if (index === currentStage) return;
    currentStage = index;
    const theme = THEMES[STAGES[index].theme];
    stageRoots.forEach((root, i) => (root.visible = i === index));
    scene.background.setHex(theme.sky);
    scene.fog.color.setHex(theme.sky);
    scene.fog.density = theme.fog;
    hemi.color.setHex(theme.hemiSky);
    hemi.groundColor.setHex(theme.hemiGround);
    hemi.intensity = theme.hemiI;
    sun.color.setHex(theme.sun);
    sun.intensity = theme.sunI;
    dust.material.color.setHex(theme.dust);
  }
  setStage(0);

  /** Forget every entity visual and effect (a new mission reuses entity ids). */
  function reset() {
    for (const rec of visuals.values()) release(rec);
    visuals.clear();
    P.n = 0;
    shocks.length = 0;
    shake = 0;
    for (const g of gates) g.open = 0;
  }

  function render(state, dt, events, t) {
    setStage(state.stageIndex);
    handleEvents(state, events);
    syncVisuals(state, dt, t);
    updatePools(state, dt, t);
    updateParticles(dt);
    updateGate(state, dt);
    updateCamera(state, dt, t);
    updateDust(dt);
    const shopLive = state.status === 'playing' && !state.bossSpawned;
    shopRing.visible = shopLive;
    if (shopLive) {
      shopRing.position.set(state.world.shop.x, 0.04, state.world.shop.z);
      shopRing.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
    }
    post.render();
  }

  /** The point on the aim plane (bullet height) under normalised device coordinates. */
  function groundPoint(nx, ny) {
    raycaster.setFromCamera(_ndc.set(nx, ny), camera);
    return raycaster.ray.intersectPlane(aimPlane, hitPoint);
  }

  /* ---------------- warm-up: compile every material before the first frame needs it */

  async function warmUp() {
    const warm = new THREE.Group();
    const kinds = Object.keys(templates);
    kinds.forEach((kind, i) => {
      const a = templates[kind].clone();
      a.position.set((i % 6) * 2 - 5, 0, STAGES[0].world.startZ - 6 - Math.floor(i / 6) * 2);
      warm.add(a);
      const b = templates[kind].clone();
      b.traverse((o) => {
        if (o.isMesh) o.material = mats.flash;
      });
      b.position.set(a.position.x + 1, 0, a.position.z - 1);
      warm.add(b);
    });
    scene.add(warm);
    for (const root of stageRoots) root.visible = true;
    _m.makeTranslation(0, 1, STAGES[0].world.startZ - 8);
    for (const mesh of [playerBullets, enemyBullets, sticks, rings, sparks]) {
      mesh.setMatrixAt(0, _m);
      mesh.count = 1;
    }
    camera.position.set(0, 26, STAGES[0].world.startZ + 12);
    camera.lookAt(0, 0, STAGES[0].world.startZ - 8);
    camera.updateMatrixWorld();
    try {
      await renderer.compileAsync(scene, camera);
    } catch (err) {
      console.warn('Shader warm-up skipped:', err);
    }
    scene.remove(warm);
    for (const mesh of [playerBullets, enemyBullets, sticks, rings, sparks]) mesh.count = 0;
    currentStage = -1;
    setStage(0);
  }
  onProgress?.(0.92, 'Warming the shaders…');
  await warmUp();

  return {
    render,
    reset,
    groundPoint,
    setZoom(v) {
      cameraZoom = Math.max(0.74, Math.min(1.33, v));
    },
    getZoom() {
      return cameraZoom;
    },
    scene,
    camera,
  };
}
