/**
 * world.js — the streamed city and its collision field.
 *
 * Vesper is an 11×11 grid of 64 m blocks generated from the world seed. The
 * 5×5 blocks around the player are live; each one bakes into two meshes (lit
 * and glowing) so a block costs two draws. Buildings register axis-aligned
 * boxes with the hand-written collision field that the player, enemies and
 * bullets use (no physics engine is needed for this).
 */

import * as THREE from 'three/webgpu';
import { LANDMARKS, ENEMIES, districtAt } from './content.js';
import { Rng, clamp } from './sim.js';
import { MeshBuilder } from './gfx.js';

/* ------------------------------------------------------------------ collisions */

function rayBox(origin, dir, box) {
  const ix = Math.abs(dir.x) < 1e-6 ? Infinity : 1 / dir.x;
  const iz = Math.abs(dir.z) < 1e-6 ? Infinity : 1 / dir.z;
  let near = Math.min((box.minX - origin.x) * ix, (box.maxX - origin.x) * ix);
  let far = Math.max((box.minX - origin.x) * ix, (box.maxX - origin.x) * ix);
  near = Math.max(near, Math.min((box.minZ - origin.z) * iz, (box.maxZ - origin.z) * iz));
  far = Math.min(far, Math.max((box.minZ - origin.z) * iz, (box.maxZ - origin.z) * iz));
  return far < Math.max(near, 0) ? null : Math.max(near, 0);
}

/** Ray against a sphere: distance along the ray, or null. */
export function raySphere(origin, dir, center, radius) {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const h = b * b - c;
  if (h < 0) return null;
  const t0 = -b - Math.sqrt(h);
  const t1 = -b + Math.sqrt(h);
  return t0 >= 0 ? t0 : t1 >= 0 ? t1 : null;
}

export class Collisions {
  obstacles = new Map();
  add(box) {
    this.obstacles.set(box.id, box);
  }
  remove(id) {
    this.obstacles.delete(id);
  }
  removePrefix(prefix) {
    for (const id of this.obstacles.keys()) if (id.startsWith(prefix)) this.obstacles.delete(id);
  }
  /** Slide a circle (x/z) by `delta`, one axis at a time, against every box. */
  resolveCircle(from, delta, radius) {
    let x = clamp(from.x + delta.x, -340, 340);
    let z = from.z;
    for (const b of this.obstacles.values())
      if (this.overlaps(x, z, radius, b)) x = from.x <= b.minX - radius ? b.minX - radius : from.x >= b.maxX + radius ? b.maxX + radius : from.x;
    z = clamp(from.z + delta.z, -340, 340);
    for (const b of this.obstacles.values())
      if (this.overlaps(x, z, radius, b)) z = from.z <= b.minZ - radius ? b.minZ - radius : from.z >= b.maxZ + radius ? b.maxZ + radius : from.z;
    return { x, y: from.y + delta.y, z };
  }
  /** Nearest building hit along a ray, or null. */
  raycast(origin, dir, maxDistance) {
    let best = null;
    for (const b of this.obstacles.values()) {
      if ((b.maxY !== undefined && origin.y > b.maxY) || (b.minY !== undefined && origin.y < b.minY)) continue;
      const t = rayBox(origin, dir, b);
      if (t === null || t > maxDistance) continue;
      best = best === null ? t : Math.min(best, t);
    }
    return best;
  }
  get count() {
    return this.obstacles.size;
  }
  overlaps(x, z, radius, b) {
    const dx = x - clamp(x, b.minX, b.maxX);
    const dz = z - clamp(z, b.minZ, b.maxZ);
    return dx * dx + dz * dz < radius * radius;
  }
}

/* ------------------------------------------------------------------ city streaming */

const HALF_CELL = 32;
const CELL = 64;
const GRID_LIMIT = 5;
const LANDMARK_CLEARANCE = 7.5;
const whiteoutCore = LANDMARKS.find(({ id }) => id === 'whiteout-core');
// Keep buildings off landmarks, the spawn point and the Whiteout arena.
const KEEP_CLEAR = [
  ...LANDMARKS.map(({ position }) => ({ x: position.x, z: position.z, radius: LANDMARK_CLEARANCE })),
  { x: 0, z: 8, radius: 8 },
  ...(whiteoutCore ? [{ x: whiteoutCore.position.x - 10, z: whiteoutCore.position.z + 10, radius: 9 }] : []),
];
function blocked(minX, maxX, minZ, maxZ) {
  return KEEP_CLEAR.some((c) => {
    const x = Math.max(minX, Math.min(c.x, maxX));
    const z = Math.max(minZ, Math.min(c.z, maxZ));
    return (c.x - x) ** 2 + (c.z - z) ** 2 < c.radius ** 2;
  });
}

const lit = (color, emissive, emissiveIntensity) =>
  emissive === undefined
    ? { color, metalness: 0.4, gloss: 0.68 }
    : { color, emissive, ...(emissiveIntensity === undefined ? {} : { emissiveIntensity }), metalness: 0.4, gloss: 0.68 };

export class City {
  active = new Map();
  queue = [];
  centerX = NaN;
  centerZ = NaN;

  /**
   * @param {object} deps  { scene, baked: {lit, unlit}, collisions, simulation, lights, sink, radius }
   *   sink: { spawnEnemy(def, id, position, cellId), spawnLandmark(def, cellId), removeCell(cellId) }
   */
  constructor({ scene, baked, collisions, simulation, lights, sink, radius = 2 }) {
    this.scene = scene;
    this.baked = baked;
    this.collisions = collisions;
    this.simulation = simulation;
    this.lights = lights;
    this.sink = sink;
    this.radius = radius;
  }

  update(position) {
    const cx = this.toCell(position.x);
    const cz = this.toCell(position.z);
    if (cx !== this.centerX || cz !== this.centerZ) {
      this.centerX = cx;
      this.centerZ = cz;
      this.rebuildQueue();
      this.unloadDistant();
    }
    for (let i = 0; i < 2; i++) {
      const next = this.queue.shift();
      if (!next) break;
      this.loadCell(next.x, next.z);
    }
  }

  /** Load everything around a point now (first frame, teleports). */
  fill(position) {
    this.update(position);
    while (this.queue.length) {
      const next = this.queue.shift();
      this.loadCell(next.x, next.z);
    }
  }

  destroy() {
    for (const cell of this.active.values()) this.unload(cell);
    this.active.clear();
    this.queue = [];
  }

  get activeCellCount() {
    return this.active.size;
  }

  rebuildQueue() {
    const list = [];
    for (let dz = -this.radius; dz <= this.radius; dz++)
      for (let dx = -this.radius; dx <= this.radius; dx++) {
        const x = this.centerX + dx;
        const z = this.centerZ + dz;
        if (Math.abs(x) > GRID_LIMIT || Math.abs(z) > GRID_LIMIT) continue;
        if (!this.active.has(this.cellId(x, z))) list.push({ x, z, distance: dx * dx + dz * dz });
      }
    list.sort((a, b) => a.distance - b.distance);
    this.queue = list.map(({ x, z }) => ({ x, z }));
  }

  unloadDistant() {
    for (const [id, cell] of this.active) {
      if (Math.abs(cell.x - this.centerX) <= this.radius + 1 && Math.abs(cell.z - this.centerZ) <= this.radius + 1) continue;
      this.unload(cell);
      this.active.delete(id);
    }
  }

  unload(cell) {
    this.sink.removeCell(cell.id);
    this.collisions.removePrefix(`${cell.id}:`);
    for (const l of cell.lights) this.lights.remove(l);
    for (const m of cell.meshes) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
  }

  loadCell(x, z) {
    const id = this.cellId(x, z);
    if (this.active.has(id)) return;
    const district = districtAt(x * CELL, z * CELL);
    const rng = new Rng(`${this.simulation.state.worldSeed}:${id}`);
    const solid = new MeshBuilder(true);
    const glow = new MeshBuilder(false);
    const cell = { id, x, z, meshes: [], lights: [] };

    this.createGround(solid, glow, district.color, district.secondary, rng);
    this.createBuildings(solid, glow, id, x, z, district.color, district.secondary, district.threat, rng);
    this.createStreetProps(solid, cell, x, z, district.color, district.secondary, rng);

    const origin = new THREE.Vector3(x * CELL, 0, z * CELL);
    const addMesh = (builder, material, shadows) => {
      const geometry = builder.build();
      if (!geometry) return;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(origin);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      cell.meshes.push(mesh);
    };
    addMesh(solid, this.baked.lit, true);
    addMesh(glow, this.baked.unlit, false);

    this.spawnCellContent(id, x, z, district.threat, rng);
    this.active.set(id, cell);
  }

  createGround(solid, glow, color, secondary, rng) {
    solid.add('box', [0, -0.12, 0], [64, 0.2, 64], null, lit('#090c18'));
    const road = { color: '#111726', metalness: 0.65, gloss: 0.82 };
    solid.add('box', [0, 0, 0], [64, 0.06, 10], null, road);
    solid.add('box', [0, 0, 0], [10, 0.06, 64], null, road);
    const strip = { color, emissive: color, emissiveIntensity: 5 };
    for (const o of [-2.7, 2.7]) {
      glow.add('box', [0, 0.045, o], [62, 0.025, 0.055], null, strip);
      glow.add('box', [o, 0.045, 0], [0.055, 0.025, 62], null, strip);
    }
    if (rng.chance(0.35)) solid.add('cylinder', [0, 0.08, 0], [3.6, 0.04, 3.6], [0, rng.integer(0, 3) * 45, 0], lit(secondary, secondary, 6));
  }

  createBuildings(solid, glow, cellId, cx, cz, color, secondary, threat, rng) {
    const corners = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (let i = 0; i < corners.length; i++) {
      const [sx, sz] = corners[i];
      const width = rng.range(15, 20);
      const depth = rng.range(15, 20);
      const height = rng.range(9 + threat * 2, 24 + threat * 6);
      const lx = sx * rng.range(16.5, 19);
      const lz = sz * rng.range(16.5, 19);
      const body = rng.chance(0.45) ? '#101526' : '#171528';
      const wx = cx * CELL + lx;
      const wz = cz * CELL + lz;
      const minX = wx - width / 2 - 0.15;
      const maxX = wx + width / 2 + 0.15;
      const minZ = wz - depth / 2 - 0.15;
      const maxZ = wz + depth / 2 + 0.15;
      if (blocked(minX, maxX, minZ, maxZ)) continue;
      solid.add('box', [lx, height / 2, lz], [width, height, depth], null, lit(body));
      this.collisions.add({ id: `${cellId}:building:${i}`, minX, maxX, minZ, maxZ, minY: 0, maxY: height });

      const neon = rng.chance(0.5) ? color : secondary;
      solid.add(
        'box',
        [lx - sx * (width / 2 + 0.015), height * rng.range(0.45, 0.78), lz],
        [0.045, rng.range(2, 5), depth * 0.62],
        null,
        lit(neon, neon, rng.range(3.5, 7))
      );
      if (rng.chance(0.7)) {
        const shape = rng.chance(0.5) ? 'cone' : 'cylinder';
        solid.add(shape, [lx, height + 0.8, lz], [rng.range(0.6, 1.6), rng.range(1, 3), rng.range(0.6, 1.6)], null, lit('#202640', neon, 3));
      }
      const windows = { color: neon, emissive: neon, emissiveIntensity: rng.range(2, 5) };
      const strips = Math.min(4, Math.max(1, Math.floor(height / 7)));
      for (let k = 0; k < strips; k++) glow.add('box', [lx, 3.5 + k * 5.5, lz - sz * (depth / 2 + 0.025)], [width * 0.55, 0.16, 0.035], null, windows);
    }
  }

  createStreetProps(solid, cell, cx, cz, color, secondary, rng) {
    for (let i = 0; i < 8; i++) {
      const alongX = i < 4;
      const side = i % 2 === 0 ? -1 : 1;
      const t = rng.range(-26, 26);
      const x = alongX ? t : side * 6.1;
      const z = alongX ? side * 6.1 : t;
      const tint = rng.chance(0.5) ? color : secondary;
      solid.add('cylinder', [x, 0.52, z], [0.16, 1.05, 0.16], null, lit('#22283a', tint, 6));
    }
    if (rng.chance(0.28)) {
      const hue = rng.chance(0.5) ? color : secondary;
      const position = new THREE.Vector3(cx * CELL + rng.range(-6, 6), 3.2, cz * CELL + rng.range(-6, 6));
      cell.lights.push(this.lights.add({ position, color: hue, intensity: 2.4, range: 20 }));
    }
  }

  spawnCellContent(cellId, cx, cz, threat, rng) {
    const ox = cx * CELL;
    const oz = cz * CELL;
    for (const landmark of LANDMARKS) {
      if (this.toCell(landmark.position.x) !== cx || this.toCell(landmark.position.z) !== cz) continue;
      this.sink.spawnLandmark(landmark, cellId);
      if (landmark.kind === 'core' && this.simulation.state.flags.whiteoutDefeated !== true) {
        const boss = ENEMIES.find((e) => e.id === 'whiteout-engine');
        if (boss) this.sink.spawnEnemy(boss, 'boss:whiteout', new THREE.Vector3(landmark.position.x - 10, 2.6, landmark.position.z + 10), cellId);
      }
    }
    if (Math.hypot(ox, oz) < 70) return;
    const district = districtAt(ox, oz);
    const pressure = this.simulation.state.districts[district.id];
    const danger = threat + pressure.heat / 35 + Math.max(0, 45 - pressure.security) / 40;
    const count = rng.integer(+(danger > 2.4), Math.min(4, 1 + Math.ceil(danger / 2)));
    for (let i = 0; i < count; i++) {
      const pool = ENEMIES.filter((e) => e.id !== 'whiteout-engine' && (threat >= 3 || e.id !== 'choir-mask'));
      const def = rng.pick(pool);
      const alongX = rng.chance(0.5);
      const dx = alongX ? rng.range(-25, 25) : rng.range(-4, 4);
      const dz = alongX ? rng.range(-4, 4) : rng.range(-25, 25);
      this.sink.spawnEnemy(def, `${cellId}:enemy:${i}`, new THREE.Vector3(ox + dx, 1.2, oz + dz), cellId);
    }
  }

  toCell(v) {
    return Math.floor((v + HALF_CELL) / CELL);
  }

  cellId(x, z) {
    return `cell:${x}:${z}`;
  }
}
