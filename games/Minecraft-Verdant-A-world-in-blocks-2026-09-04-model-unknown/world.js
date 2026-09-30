// The terrain function, the block props on it, and the chunk streamer.

import * as THREE from 'three/webgpu';
import { CONFIG, BIOMES, hash2, valueNoise, fbm, rngAt, lerp, clamp, chunkKey, keyX, keyZ } from './config.js';

const CHUNK = CONFIG.chunkSize;
const TAU = Math.PI * 2;
const ease = (t) => t * t * (3 - 2 * t);
const inCaveMouth = (x, z) => Math.abs(x + 265) < 30 && z > -215 && z < -125;

/**
 * The Sunstone Ring: standing stones in a clearing at the southern edge of
 * Whispering Woods. The ground under it is levelled, no trees grow inside,
 * and ponds keep away, so it stands the same way on every seed.
 */
export const RING = Object.freeze({ x: -430, z: 470, radius: 18, clearing: 44 });
const inRingClearing = (x, z) => Math.hypot(x - RING.x, z - RING.z) < RING.clearing;

/** Terrain colours, converted once (they are linear, like vertex colours). */
const BIOME_COLORS = Object.fromEntries(Object.entries(BIOMES).map(([key, b]) => [key, new THREE.Color(b.color)]));
const SNOW = new THREE.Color(15199973);
const ROCK = new THREE.Color(9936787);
const MUD = new THREE.Color(6386764);
const SAND = new THREE.Color(13022595);
const CROP_A = new THREE.Color(10463557);
const CROP_B = new THREE.Color(11906389);
const MEADOW = new THREE.Color(BIOMES.plains.color);

/** The standing stones of the ring, in world space (seeded heights; same layout on every seed). */
function ringStones(world) {
  const r = rngAt(3, 7, world.seed + 404);
  const stones = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.13;
    const x = RING.x + Math.cos(a) * RING.radius;
    const z = RING.z + Math.sin(a) * RING.radius;
    const h = 6 + Math.floor(r() * 3) * 1.5;
    // One stone has fallen and lies along the ring's edge.
    if (i === 7) stones.push({ x, z, w: 7, d: 2.4, h: 2, fallen: true });
    else stones.push({ x, z, w: 2.4, d: 2.4, h, fallen: false });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.52;
    stones.push({ x: RING.x + Math.cos(a) * 9, z: RING.z + Math.sin(a) * 9, w: 1.8, d: 1.8, h: 3 + r() * 1.2, fallen: false });
  }
  return stones;
}

/**
 * Tree and building footprints of one chunk, computed without building meshes,
 * so walking and path finding work before (or beyond) the drawn chunks.
 */
function chunkColliders(world, cx, cz) {
  const out = [];
  for (let i = 0; i < CHUNK; i += 12) {
    for (let j = 0; j < CHUNK; j += 12) {
      const r = rngAt(cx * 8 + i / 12, cz * 8 + j / 12, world.seed + 918);
      const x = cx * CHUNK + i + 4 + r() * 6;
      const z = cz * CHUNK + j + 4 + r() * 6;
      const s = world.sample(x, z);
      if (s.wet || s.groundY > 160 || inCaveMouth(x, z) || inRingClearing(x, z)) continue;
      if (r() < BIOMES[s.biome].density && s.biome !== 'city') out.push({ x, z, w: 2, d: 2 });
    }
  }
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const x = 238 + i * 30;
      const z = -313 + j * 30;
      if (Math.floor(x / CHUNK) !== cx || Math.floor(z / CHUNK) !== cz || i === 3 || j === 3) continue;
      const r = rngAt(i, j, world.seed + 52);
      out.push({ x, z, w: 17 + r() * 6, d: 17 + r() * 5 });
    }
  }
  if (cx === Math.floor(234 / CHUNK) && cz === Math.floor(-66 / CHUNK)) out.push({ x: 234, z: -66, w: 20, d: 25 });
  if (cx === Math.floor(-265 / CHUNK) && cz === Math.floor(-170 / CHUNK)) {
    out.push({ x: -282, z: -170, w: 10, d: 70 }, { x: -248, z: -170, w: 10, d: 70 });
  }
  ringColliders(world, cx, cz, out);
  return out;
}

/** Footprints of the ring's stones and altar that fall in chunk (cx, cz). */
function ringColliders(world, cx, cz, out) {
  const here = (x, z) => Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz;
  for (const s of ringStones(world)) if (here(s.x, s.z)) out.push({ x: s.x, z: s.z, w: s.w, d: s.d });
  if (here(RING.x, RING.z)) out.push({ x: RING.x, z: RING.z, w: 6, d: 4 });
}

export class World {
  constructor(seed = CONFIG.seed) {
    this.seed = seed;
    this.colliders = new Map();
    this.pondCache = new Map();
    this.heights = new Map();
    this.ringY = null;
  }

  /** A new seed: every cache belongs to the old terrain. */
  reset(seed) {
    this.seed = seed;
    this.colliders.clear();
    this.pondCache.clear();
    this.heights.clear();
    this.ringY = null;
  }

  riverX(z) {
    return -45 + Math.sin(z / 185) * 74 + Math.sin(z / 74) * 15;
  }

  biome(x, z) {
    if (x > 220 && x < 440 && z > -330 && z < -110) return 'city';
    if (x > 200 && x < 465 && z >= -110 && z < 220) return 'farmland';
    if (z < -440) return 'mountain';
    if (x < -520) return 'canyon';
    if (z > 600) return 'tropical';
    if (x > 480 && z > 20) return 'swamp';
    if (x < -190 || valueNoise(x / 190, z / 190, this.seed + 33) > 0.67) return 'forest';
    return 'plains';
  }

  /** Height of the levelled ground the Sunstone Ring stands on: a little above the land around it. */
  ringTop() {
    if (this.ringY === null) this.ringY = Math.floor((20 + fbm(RING.x / 180, RING.z / 180, this.seed) * 44) / 2) * 2 + 2;
    return this.ringY;
  }

  pondAt(x, z) {
    const px = Math.floor(x / 480);
    const pz = Math.floor(z / 480);
    const key = (px + 32768) * 65536 + (pz + 32768);
    let pond = this.pondCache.get(key);
    if (pond !== undefined) return pond;
    const cx = px * 480 + 200 + hash2(px, pz, this.seed + 221) * 100;
    const cz = pz * 480 + 200 + hash2(px, pz, this.seed + 227) * 100;
    const b = this.biome(cx, cz);
    if (
      ['city', 'farmland', 'canyon', 'swamp'].includes(b) ||
      Math.abs(cx - this.riverX(cz)) < 170 ||
      (Math.abs(cx + 265) < 150 && Math.abs(cz + 170) < 150) ||
      Math.hypot(cx - RING.x, cz - RING.z) < 220
    ) {
      pond = null;
    } else {
      let level = 20 + fbm(cx / 180, cz / 180, this.seed) * 44;
      if (cz < -390) {
        const k = clamp((-cz - 390) / 210, 0, 1);
        level += ease(k) * (50 + Math.pow(fbm(cx / 260, cz / 220, this.seed + 9), 2) * 260);
      }
      pond = { x: cx, z: cz, level: Math.floor((level - 7) / 2) * 2, radius: 22 + hash2(px, pz, this.seed + 231) * 9 };
    }
    this.pondCache.set(key, pond);
    return pond;
  }

  waterLevel(x, z) {
    const pond = this.pondAt(x, z);
    if (pond && Math.hypot(x - pond.x, z - pond.z) < pond.radius + 35) return pond.level;
    return z < -300 && Math.abs(x - this.riverX(z)) < 45 ? 44 : 12;
  }

  height(x, z) {
    const biome = this.biome(x, z);
    const base = fbm(x / 180, z / 180, this.seed);
    let h = 20 + base * 44;
    if (z < -390) {
      const k = clamp((-z - 390) / 210, 0, 1);
      h += ease(k) * (50 + Math.pow(fbm(x / 260, z / 220, this.seed + 9), 2) * 260);
    }
    if (biome === 'canyon') {
      const band = Math.abs(Math.sin(z / 160 + Math.sin(x / 240)));
      let mesa = 18 + Math.floor(base * 5) * 10 + Math.pow(band, 0.5) * 62;
      if (band < 0.19) mesa = 10 + base * 8;
      h = lerp(h, mesa, clamp((-x - 520) / 75, 0, 1));
    }
    if (biome === 'swamp') h = lerp(h, 10 + valueNoise(x / 80, z / 80, this.seed) * 10, clamp(Math.min(x - 480, z - 20) / 70, 0, 1));
    if (biome === 'tropical') h = lerp(h, 17 + base * 42, clamp((z - 600) / 60, 0, 1));
    const riverDist = Math.abs(x - this.riverX(z));
    const riverY = z < -300 && riverDist < 45 ? 44 : 12;
    if (z < -300 && riverDist < 80) h = Math.max(h, 48);
    h = lerp(riverY - 6, h, ease(clamp((riverDist - 16) / 38, 0, 1)));
    const lake = Math.hypot((x - 115) / 1.35, z - 125);
    if (lake < 88) h = lerp(5, h, clamp((lake - 66) / 22, 0, 1));
    const city = clamp(Math.min(x - 200, 460 - x, z + 350, -90 - z) / 24, 0, 1);
    if (city > 0) h = lerp(h, 32, ease(city));
    if (biome === 'farmland') {
      const f = clamp(Math.min(x - 200, 465 - x, z + 110, 220 - z) / 32, 0, 1);
      h = lerp(h, 30 + Math.floor(base * 3) * 2, ease(f));
    }
    const cave = Math.max(0, Math.abs(x + 265) - 22, -205 - z, z + 132);
    if (cave < 56) h = lerp(30, h, ease(cave / 56));
    const ring = Math.hypot(x - RING.x, z - RING.z);
    if (ring < 80) h = lerp(this.ringTop(), h, ease(clamp((ring - 36) / 44, 0, 1)));
    const pond = this.pondAt(x, z);
    if (pond) {
      const d = Math.hypot(x - pond.x, z - pond.z);
      const r = pond.radius;
      if (d < r) h = pond.level - 4;
      else if (d < r + 35) h = pond.level - 4 + 12 * ease((d - r) / 35);
      else if (d < r + 105) h = lerp(pond.level + 8, h, ease((d - r - 35) / 70));
    }
    return Math.floor(h / CONFIG.stepHeight) * CONFIG.stepHeight;
  }

  /** Ground height of the 4 m cell (cx, cz), cached: path finding and walking ask for the same cells over and over. */
  cellHeight(cx, cz) {
    const key = (cx + 1048576) * 2097152 + (cz + 1048576);
    let h = this.heights.get(key);
    if (h === undefined) {
      if (this.heights.size > 300000) this.heights.clear();
      h = this.height(cx * 4 + 2, cz * 4 + 2);
      this.heights.set(key, h);
    }
    return h;
  }

  groundAt(x, z) {
    return this.cellHeight(Math.floor(x / 4), Math.floor(z / 4));
  }

  sample(x, z) {
    const groundY = this.groundAt(x, z);
    const waterY = this.waterLevel(x, z);
    return { groundY, waterY, wet: groundY < waterY - 0.2, biome: this.biome(x, z) };
  }

  collidersFor(cx, cz) {
    const key = chunkKey(cx, cz);
    let list = this.colliders.get(key);
    if (!list) {
      list = chunkColliders(this, cx, cz);
      this.colliders.set(key, list);
    }
    return list;
  }

  isWalkable(x, z, fromY = null, radius = 0.7) {
    const groundY = this.groundAt(x, z);
    if (groundY < this.waterLevel(x, z) - 0.2) return false;
    if (fromY !== null && Math.abs(groundY - fromY) > 4.1) return false;
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const c of this.collidersFor(cx + i, cz + j)) {
          if (x > c.x - c.w / 2 - radius && x < c.x + c.w / 2 + radius && z > c.z - c.d / 2 - radius && z < c.z + c.d / 2 + radius) return false;
        }
      }
    }
    return true;
  }

  /** Terrain colour at a point, written into `target` (linear, like vertex colours). */
  color(x, z, y, target) {
    const biome = this.biome(x, z);
    const jitter = hash2(Math.floor(x / 4), Math.floor(z / 4), this.seed);
    let c = BIOME_COLORS[biome];
    if (y > 135) c = y > 170 ? SNOW : ROCK;
    if (y < this.waterLevel(x, z) + 3) c = biome === 'swamp' ? MUD : SAND;
    if (biome === 'farmland') c = Math.floor(x / 20) % 2 === 0 ? CROP_A : CROP_B;
    // The ring's clearing is open meadow inside the dark forest floor.
    if (Math.hypot(x - RING.x, z - RING.z) < 32) c = MEADOW;
    return target.copy(c).multiplyScalar(0.92 + jitter * 0.15);
  }
}

/* ------------------------------------------------------------ terrain mesh */

const _top = new THREE.Color();
const _side = new THREE.Color();

/**
 * One chunk of stepped terrain. Faces between two columns of the same or a
 * higher neighbour are hidden, so only chunk borders keep their skirts (they
 * cover seams against a neighbour drawn at another level of detail).
 */
export function buildTerrain(world, cx, cz, step, material) {
  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  const cells = CHUNK / step;
  const span = cells + 2;
  // Heights of every cell plus a one-cell border, read once instead of five times per cell.
  const heights = new Float32Array(span * span);
  for (let i = 0; i < span; i++) {
    for (let j = 0; j < span; j++) heights[i * span + j] = world.height(x0 + (i - 1) * step + step / 2, z0 + (j - 1) * step + step / 2);
  }
  const maxVerts = cells * cells * 30;
  const pos = new Float32Array(maxVerts * 3);
  const nor = new Float32Array(maxVerts * 3);
  const col = new Float32Array(maxVerts * 3);
  let v = 0;
  const vert = (x, y, z, nx, ny, nz, c) => {
    const k = v * 3;
    pos[k] = x;
    pos[k + 1] = y;
    pos[k + 2] = z;
    nor[k] = nx;
    nor[k + 1] = ny;
    nor[k + 2] = nz;
    col[k] = c.r;
    col[k + 1] = c.g;
    col[k + 2] = c.b;
    v++;
  };
  // Corners a b c d as the triangles a-b-c and a-c-d.
  const quad = (ax, ay, az, bx, by, bz, qx, qy, qz, dx, dy, dz, nx, ny, nz, c) => {
    vert(ax, ay, az, nx, ny, nz, c);
    vert(bx, by, bz, nx, ny, nz, c);
    vert(qx, qy, qz, nx, ny, nz, c);
    vert(ax, ay, az, nx, ny, nz, c);
    vert(qx, qy, qz, nx, ny, nz, c);
    vert(dx, dy, dz, nx, ny, nz, c);
  };
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const f = x0 + i * step;
      const p = z0 + j * step;
      const n = step;
      const y = heights[(i + 1) * span + (j + 1)];
      world.color(f, p, y, _top);
      quad(f, y, p, f, y, p + n, f + n, y, p + n, f + n, y, p, 0, 1, 0, _top);
      _side.copy(_top).multiplyScalar(0.81);
      const west = heights[i * span + (j + 1)];
      const east = heights[(i + 2) * span + (j + 1)];
      const north = heights[(i + 1) * span + j];
      const south = heights[(i + 1) * span + (j + 2)];
      if (i === 0 || west < y) {
        const s = Math.min(west, y - 2);
        quad(f, s, p, f, s, p + n, f, y, p + n, f, y, p, -1, 0, 0, _side);
      }
      if (i === cells - 1 || east < y) {
        const s = Math.min(east, y - 2);
        quad(f + n, s, p + n, f + n, s, p, f + n, y, p, f + n, y, p + n, 1, 0, 0, _side);
      }
      if (j === 0 || north < y) {
        const s = Math.min(north, y - 2);
        quad(f + n, s, p, f, s, p, f, y, p, f + n, y, p, 0, 0, -1, _side);
      }
      if (j === cells - 1 || south < y) {
        const s = Math.min(south, y - 2);
        quad(f, s, p + n, f + n, s, p + n, f + n, y, p + n, f, y, p + n, 0, 0, 1, _side);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, v * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, v * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(col.slice(0, v * 3), 3));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ------------------------------------------------------------ block batches */

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Free a mesh's GPU buffers. The geometry goes first: on the WebGPU backend
 * the instance buffers of an InstancedMesh are released with its geometry,
 * which is why every batch owns its (tiny) box geometry instead of sharing one.
 */
export function disposeMesh(mesh) {
  if (!mesh?.isMesh) return;
  mesh.geometry.dispose();
  if (mesh.isInstancedMesh) mesh.dispose();
}

/** Axis-aligned coloured boxes, drawn as one InstancedMesh. */
export class BoxBatch {
  constructor() {
    this.items = [];
  }

  add(x, y, z, w, h, d, color) {
    this.items.push(x, y, z, w, h, d, color);
  }

  get count() {
    return this.items.length / 7;
  }

  mesh(material) {
    const n = this.count;
    if (!n) return null;
    const it = this.items;
    const mesh = new THREE.InstancedMesh(UNIT_BOX.clone(), material, n);
    for (let i = 0; i < n; i++) {
      const k = i * 7;
      _pos.set(it[k], it[k + 1], it[k + 2]);
      _scale.set(it[k + 3], it[k + 4], it[k + 5]);
      _matrix.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _matrix);
      mesh.setColorAt(i, _color.set(it[k + 6]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    return mesh;
  }
}

function addTree(b, x, y, z, kind, rand, detailed) {
  const trunk = 10 + rand() * 12;
  if (kind === 'cactus') {
    b.add(x, y + 5, z, 2, 10, 2, 5536329);
    b.add(x + 2, y + 5, z, 3, 2, 2, 5536329);
    b.add(x + 3, y + 7, z, 2, 4, 2, 6523223);
    return;
  }
  b.add(x, y + trunk / 2, z, 2, trunk, 2, kind === 'birch' ? 14013880 : 6639676);
  if (kind === 'palm') {
    b.add(x + 1, y + trunk, z, 3, 3, 3, 7887933);
    for (const [h, u] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      b.add(x + h * 4, y + trunk + 1, z + u * 4, h ? 9 : 3, 2, u ? 9 : 3, 3769940);
      b.add(x + h * 8, y + trunk - 1, z + u * 8, h ? 5 : 3, 2, u ? 5 : 3, 5019735);
    }
    return;
  }
  if (kind === 'pine') {
    const greens = [3235395, 3697735, 4488268, 5671761];
    for (let h = 0; h < 4; h++) {
      const w = 12 - h * 2.5;
      b.add(x, y + trunk - 7 + h * 4, z, w, 4.2, w, greens[h]);
    }
    return;
  }
  const c = kind === 'birch' ? [8234057, 9614933, 11060071] : kind === 'willow' ? [5732435, 6917209, 8034917] : [5079359, 6526022, 7971661];
  b.add(x, y + trunk - 2, z, 13, 7, 12, c[0]);
  b.add(x - 2, y + trunk + 3, z + 1, 10, 5, 10, c[1]);
  b.add(x + 3, y + trunk, z - 3, 8, 6, 8, c[2]);
  if (detailed) {
    b.add(x - 5, y + trunk - 5, z + 4, 5, 4, 6, c[0]);
    b.add(x + 1, y + trunk + 6, z, 6, 2, 6, c[2]);
  }
  if (kind === 'willow') {
    for (let h = 0; h < 4; h++) b.add(x + (h < 2 ? -6 : 6), y + trunk - 6, z + (h % 2 ? -4 : 4), 2, 10, 3, c[1]);
  }
}

function addHouse(b, x, y, z, w, d, h, rand, colliders) {
  const wall = [14931117, 14605252, 13088918, 14271649][Math.floor(rand() * 4)];
  const roof = [10051397, 9068880, 5665912, 6844509][Math.floor(rand() * 4)];
  b.add(x, y + 0.8, z, w + 2, 1.6, d + 2, 9212290);
  b.add(x, y + h / 2 + 1, z, w, h, d, wall);
  for (let u = 0; u < 4; u++) b.add(x, y + h + 1 + u * 1.5, z, w + 3 - u * 2, 1.5, d + 3, roof);
  b.add(x - w * 0.25, y + h + 6, z - 2, 2.5, 5, 2.5, 9469289);
  b.add(x, y + 3, z + d / 2 + 0.08, 2.8, 6, 0.3, 6904393);
  const rows = Math.max(1, Math.floor(h / 8));
  for (const side of [-1, 1]) {
    for (let c = 0; c < 2; c++) {
      for (let r = 0; r < rows; r++) {
        const wx = x + (c ? 1 : -1) * w * 0.27;
        const wy = y + 5 + r * 7;
        b.add(wx, wy, z + side * (d / 2 + 0.1), 3.2, 3.5, 0.4, 5664624);
        b.add(wx, wy, z + side * (d / 2 + 0.35), 0.3, 3.6, 0.3, wall);
        b.add(wx, wy - 1.9, z + side * (d / 2 + 0.4), 3.8, 0.5, 0.8, 8682338);
      }
    }
  }
  colliders.push({ x, z, w: w + 1, d: d + 1 });
}

/** The Sunstone Ring's stones, altar, path and flowers that fall in chunk (cx, cz). */
function addRing(b, world, cx, cz, step, colliders) {
  const here = (x, z) => Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz;
  const y = world.ringTop();
  const greys = [9475461, 10527889, 8949372];
  const stones = ringStones(world);
  stones.forEach((s, i) => {
    if (!here(s.x, s.z)) return;
    const grey = greys[i % 3];
    if (s.fallen) {
      b.add(s.x, y + s.h / 2, s.z, s.w, s.h, s.d, grey);
      b.add(s.x + 1.2, y + s.h + 0.2, s.z, 3.2, 0.4, 1.8, 5143875);
    } else {
      b.add(s.x, y + s.h / 2, s.z, s.w, s.h, s.d, grey);
      // Moss on the crown, and a weathered notch on the tall stones.
      b.add(s.x, y + s.h + 0.2, s.z, s.w * 0.8, 0.4, s.d * 0.8, 5143875);
      if (s.h >= 7.5) b.add(s.x, y + s.h * 0.62, s.z, s.w + 0.3, 0.5, s.d + 0.3, 8029304);
    }
    colliders.push({ x: s.x, z: s.z, w: s.w, d: s.d });
  });
  if (here(RING.x, RING.z)) {
    // The altar; the sunstone on top is a separate, glowing mesh owned by the game.
    b.add(RING.x, y + 0.6, RING.z, 6, 1.2, 4, 9475461);
    b.add(RING.x, y + 1.5, RING.z, 4.6, 0.6, 2.8, 10527889);
    b.add(RING.x, y + 2.1, RING.z, 2.2, 0.6, 2.2, 8029304);
    colliders.push({ x: RING.x, z: RING.z, w: 6, d: 4 });
  }
  // A ring of flat paving stones between the inner and outer stones.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    const x = RING.x + Math.cos(a) * 13.5;
    const z = RING.z + Math.sin(a) * 13.5;
    if (here(x, z)) b.add(x, y + 0.13, z, 2.6, 0.26, 2.6, 11971985);
  }
  if (step !== 4) return;
  const r = rngAt(11, 5, world.seed + 405);
  const petals = [15783808, 14143724, 15723461, 13421670];
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU;
    const d = 22 + r() * 16;
    const x = RING.x + Math.cos(a) * d;
    const z = RING.z + Math.sin(a) * d;
    if (!here(x, z)) continue;
    const gy = world.groundAt(x, z);
    b.add(x, gy + 0.7, z, 0.35, 1.4, 0.35, 6325319);
    b.add(x, gy + 1.5, z, 0.8, 0.55, 0.8, petals[i % petals.length]);
  }
}

/** Trees, rocks, flowers, the city, the farms, the cave and the ring of one chunk. */
export function buildProps(world, cx, cz, step, material) {
  const b = new BoxBatch();
  const colliders = [];
  const chunkRand = rngAt(cx, cz, world.seed);
  for (let i = 0; i < CHUNK; i += 12) {
    for (let j = 0; j < CHUNK; j += 12) {
      const r = rngAt(cx * 8 + i / 12, cz * 8 + j / 12, world.seed + 918);
      const x = cx * CHUNK + i + 4 + r() * 6;
      const z = cz * CHUNK + j + 4 + r() * 6;
      const s = world.sample(x, z);
      if (s.wet || s.groundY > 160 || inCaveMouth(x, z) || inRingClearing(x, z)) continue;
      const info = BIOMES[s.biome];
      const gy = s.groundY;
      if (r() < info.density && s.biome !== 'city') {
        const kind = s.biome === 'plains' || s.biome === 'forest' ? ['oak', 'pine', 'birch'][Math.floor(r() * 3)] : info.tree;
        colliders.push({ x, z, w: 2, d: 2 });
        if (step <= 12 || hash2(Math.floor(x), Math.floor(z), 18) > 0.55) addTree(b, x, gy, z, kind, r, step === 4);
      } else if (step === 4 && s.biome !== 'city') {
        const g = r();
        if (g < 0.19) {
          b.add(x, gy + 1.6, z, 3 + r() * 3, 3, 3, 9475461);
          b.add(x + 1, gy + 3, z, 2, 1, 2, 10527889);
        } else if (g < 0.45) {
          b.add(x, gy + 1, z, 3, 2, 3, s.biome === 'canyon' ? 9800530 : 5143875);
          if (r() < 0.3) b.add(x, gy + 2.1, z, 1, 0.6, 1, 12413041);
        } else if (g < 0.74) {
          const petals = [15783808, 14143724, 15723461];
          for (let m = 0; m < 3; m++) {
            const fx = x + r() * 3;
            const fz = z + r() * 3;
            b.add(fx, gy + 0.7, fz, 0.35, 1.4, 0.35, 6325319);
            b.add(fx, gy + 1.5, fz, 0.8, 0.55, 0.8, petals[m]);
          }
        } else if (g < 0.82) {
          b.add(x, gy + 0.7, z, 0.5, 1.4, 0.5, 12957594);
          b.add(x, gy + 1.4, z, 1.5, 0.6, 1.5, 11630422);
        }
      }
      if (s.biome === 'swamp' && step < 13) for (let g = 0; g < 3; g++) b.add(x + g, gy + 2, z, 0.5, 4, 0.5, 10132064);
    }
  }
  // Alderhaven: a 7 × 7 grid of plots with a cross of streets and a square in the middle.
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const x = 238 + i * 30;
      const z = -313 + j * 30;
      if (Math.floor(x / CHUNK) !== cx || Math.floor(z / CHUNK) !== cz) continue;
      const r = rngAt(i, j, world.seed + 52);
      if (i === 3 || j === 3) {
        b.add(x, 32.13, z, 28, 0.26, 28, 11971985);
        if (i === 3 && j === 3) {
          b.add(x, 33, z, 12, 2, 12, 11909542);
          b.add(x, 35, z, 9, 2, 9, 6727332);
          b.add(x, 38, z, 2, 6, 2, 13224634);
        } else if (j % 2 === 0) {
          b.add(x - 10, 36, z, 1, 8, 1, 5857876);
          b.add(x - 10, 40, z, 3, 2, 3, 15455898);
        }
      } else {
        addHouse(b, x, 32, z, 16 + r() * 6, 16 + r() * 5, 9 + Math.floor(r() * 3) * 7, r, colliders);
      }
    }
  }
  // Golden Fields: a farmhouse and crop rows between fences.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const x = 234 + i * 52;
      const z = -66 + j * 66;
      if (Math.floor(x / CHUNK) !== cx || Math.floor(z / CHUNK) !== cz) continue;
      const y = world.groundAt(x, z);
      if (i === 0 && j === 0) {
        addHouse(b, x, y, z, 19, 24, 11, chunkRand, colliders);
        continue;
      }
      for (let p = 0; p < 7; p++) {
        b.add(x - 17 + p * 5, y + 0.25, z, 2.8, 0.5, 42, 7561538);
        for (let q = 0; q < 10; q++) b.add(x - 17 + p * 5, y + 1.5, z - 19 + q * 4, 1.8, 2.5, 1.8, j % 2 ? 12956509 : 8756039);
      }
      for (const side of [-1, 1]) b.add(x + side * 22, y + 2, z, 1, 4, 46, 10192481);
    }
  }
  // Hollowstone Cave: two stone walls and a roof over the tunnel.
  if (cx === Math.floor(-265 / CHUNK) && cz === Math.floor(-170 / CHUNK)) {
    for (let c = 0; c < 6; c++) {
      const z = -198 + c * 11;
      b.add(-282, 38, z, 10, 16, 12, 7897720);
      b.add(-248, 38, z, 10, 16, 12, 8554878);
      b.add(-265, 48, z, 44, 6, 12, 8029304);
    }
    b.add(-265, 52, -170, 38, 2, 70, 5800008);
    colliders.push({ x: -282, z: -170, w: 10, d: 70 }, { x: -248, z: -170, w: 10, d: 70 });
    b.add(-275, 32, -150, 2, 4, 2, 7576725);
    b.add(-256, 33, -185, 3, 6, 3, 9282976);
  }
  addRing(b, world, cx, cz, step, colliders);
  world.colliders.set(chunkKey(cx, cz), colliders);
  return b.mesh(material);
}

/* ------------------------------------------------------------ chunk streaming */

const freeze = (object) => {
  object.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.updateMatrix();
  });
};

export class ChunkManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunks = new Map();
    this.queue = [];
    this.center = '';
    this.radius = CONFIG.viewRadii.balanced;
    this.terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    this.propMaterial = new THREE.MeshStandardMaterial({ roughness: 0.92 });
    this.waterMaterial = new THREE.MeshStandardMaterial({ color: 5545372, roughness: 0.25, metalness: 0.28, transparent: true, opacity: 0.88 });
  }

  setViewDistance(key) {
    this.radius = CONFIG.viewRadii[key] ?? CONFIG.viewRadii.balanced;
    this.center = '';
  }

  /** Queue the chunks the view needs around `pos`, nearest first, and drop the rest. */
  refresh(pos) {
    const cx = Math.floor(pos.x / CHUNK);
    const cz = Math.floor(pos.z / CHUNK);
    const id = `${cx},${cz},${this.radius}`;
    if (id === this.center) return;
    this.center = id;
    const R = this.radius;
    const wanted = new Set();
    const jobs = [];
    for (let i = -R; i <= R; i++) {
      for (let j = -R; j <= R; j++) {
        const dist = Math.hypot(i, j);
        if (dist > R) continue;
        const x = cx + i;
        const z = cz + j;
        const key = chunkKey(x, z);
        const step = dist < 3.5 ? 4 : dist < 7 ? 12 : 24;
        wanted.add(key);
        const have = this.chunks.get(key);
        if (!have || have.step !== step) jobs.push({ x, z, key, step, dist });
      }
    }
    for (const [key, chunk] of this.chunks) if (!wanted.has(key)) this.remove(key, chunk);
    for (const key of this.world.colliders.keys()) {
      if (Math.hypot(keyX(key) - cx, keyZ(key) - cz) > R + 5) this.world.colliders.delete(key);
    }
    this.queue = jobs.sort((a, b) => a.dist - b.dist);
  }

  remove(key, chunk) {
    this.scene.remove(chunk.group);
    chunk.group.traverse(disposeMesh);
    this.world.colliders.delete(key);
    this.chunks.delete(key);
  }

  /** Build queued chunks for about `budgetMs` (at least one). */
  tick(budgetMs = 8) {
    const start = performance.now();
    let built = 0;
    while (this.queue.length && (performance.now() - start < budgetMs || built === 0)) {
      this.create(this.queue.shift());
      built++;
    }
  }

  create({ x, z, key, step }) {
    const old = this.chunks.get(key);
    if (old) this.remove(key, old);
    const group = new THREE.Group();
    group.add(buildTerrain(this.world, x, z, step, this.terrainMaterial));
    const props = buildProps(this.world, x, z, step, this.propMaterial);
    if (props) group.add(props);
    const water = new BoxBatch();
    for (let i = 0; i < CHUNK; i += step) {
      for (let j = 0; j < CHUNK; j += step) {
        const wx = x * CHUNK + i + step / 2;
        const wz = z * CHUNK + j + step / 2;
        const ground = this.world.height(wx, wz);
        const level = this.world.waterLevel(wx, wz);
        if (ground < level) water.add(wx, level - 0.3, wz, step, 0.6, step, 16777215);
      }
    }
    const waterMesh = water.mesh(this.waterMaterial);
    if (waterMesh) {
      // Water neither casts nor needs its own shadow pass (it is see-through).
      waterMesh.castShadow = false;
      group.add(waterMesh);
    }
    freeze(group);
    this.chunks.set(key, { group, step });
    this.scene.add(group);
  }

  clear() {
    for (const [key, chunk] of [...this.chunks]) this.remove(key, chunk);
    this.queue = [];
    this.center = '';
  }

  dispose() {
    this.clear();
    this.terrainMaterial.dispose();
    this.propMaterial.dispose();
    this.waterMaterial.dispose();
  }
}
