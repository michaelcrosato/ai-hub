// terrain.js — the streaming world: a quadtree of tiles around the player, built
// by a pool of module workers and swapped in a whole ring at a time so level-of-
// detail changes never leave holes.
import * as THREE from 'three/webgpu';
import { CONFIG } from './config.js';
import { generateTile } from './worldgen.js';

/** Quadtree LOD planner. Roots stay on a fixed world grid at all coordinates. */
export function planTiles(x, z, view) {
  const leaves = [], root = CONFIG.rootTile, R = view.distance;
  function visit(tx, tz, size) {
    const dx = Math.max(tx - x, 0, x - (tx + size)), dz = Math.max(tz - z, 0, z - (tz + size));
    const distance = Math.hypot(dx, dz); if (distance > R) return;
    if (size > CONFIG.baseTile && distance < size * view.split) { const h = size / 2; visit(tx, tz, h); visit(tx + h, tz, h); visit(tx, tz + h, h); visit(tx + h, tz + h, h); }
    else leaves.push({ x: tx, z: tz, size, distance, vegetation: distance < view.vegetation && size <= 2048 });
  }
  for (let rz = Math.floor((z - R) / root); rz <= Math.floor((z + R) / root); rz++) for (let rx = Math.floor((x - R) / root); rx <= Math.floor((x + R) / root); rx++) visit(rx * root, rz * root, root);
  return leaves.sort((a, b) => a.distance - b.distance || a.size - b.size);
}

/** Choose the nearest grid origin so a rebase cannot repeat at a grid corner. */
export function renderOriginFor(x, z) {
  const grid = CONFIG.rebaseDistance;
  return { x: Math.round(x / grid) * grid, z: Math.round(z / grid) * grid };
}

/**
 * The low-poly prop shapes (as non-indexed positions) and their base colours in
 * linear RGB. Workers bake them into each tile, so the forest needs no
 * per-tile instanced batches (which would each compile their own shaders).
 */
export function buildTemplates() {
  const flat = (g) => {
    const geo = g.index ? g.toNonIndexed() : g;
    const out = new Float32Array(geo.attributes.position.array);
    g.dispose(); if (geo !== g) geo.dispose();
    return out;
  };
  const linear = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
  return {
    shapes: {
      trunk: flat(new THREE.CylinderGeometry(0.42, 0.92, 9, 5)),
      cone: flat(new THREE.ConeGeometry(5.7, 17, 6)),
      leaf: flat(new THREE.IcosahedronGeometry(6.5, 0)),
      rock: flat(new THREE.IcosahedronGeometry(2.6, 0)),
      reed: flat(new THREE.ConeGeometry(1.3, 3.4, 4)),
    },
    colors: { bark: linear(0x665140), pine: linear(0x49764d), leaf: linear(0x799457), stone: linear(0x93978a), reed: linear(0x879453) },
  };
}

class WorkerPool {
  constructor(count, templates) {
    this.queue = []; this.slots = []; this.callbacks = new Map(); this.nextID = 1; this.disposed = false; this.local = false; this.templates = templates;
    try {
      if (typeof Worker === 'undefined') throw new Error('Workers are unavailable.');
      for (let i = 0; i < count; i++) {
        const worker = new Worker(new URL('./tile-worker.js', import.meta.url), { type: 'module' });
        const slot = { worker, busy: false, id: 0, timer: 0 };
        worker.onmessage = (e) => {
          const cb = this.callbacks.get(e.data.task); this.callbacks.delete(e.data.task);
          slot.busy = false; clearTimeout(slot.timer);
          if (cb) { if (e.data.error) cb.reject(new Error(e.data.error)); else cb.resolve(e.data.data); }
          this.pump();
        };
        worker.onerror = (e) => { e.preventDefault?.(); this.fallback(); };
        worker.postMessage({ templates });
        this.slots.push(slot);
      }
    } catch (error) { this.local = true; console.warn('Terrain uses the main-thread fallback.', error.message); }
  }
  run(job) {
    if (this.disposed) return Promise.reject(new Error('Worker pool has been disposed.'));
    return new Promise((resolve, reject) => { const task = this.nextID++; this.callbacks.set(task, { resolve, reject, job }); this.queue.push({ task, job }); this.pump(); });
  }
  pump() {
    if (this.disposed) return;
    if (this.local) {
      if (this.localBusy || !this.queue.length) return; this.localBusy = true;
      const item = this.queue.shift();
      setTimeout(() => {
        const cb = this.callbacks.get(item.task); this.callbacks.delete(item.task);
        try { if (cb) cb.resolve(generateTile(item.job, this.templates)); } catch (e) { if (cb) cb.reject(e); }
        this.localBusy = false; this.pump();
      }, 0);
      return;
    }
    for (const slot of this.slots) {
      if (slot.busy || !this.queue.length) continue;
      const item = this.queue.shift(); slot.busy = true; slot.id = item.task;
      slot.timer = setTimeout(() => this.fallback(), 18000); slot.worker.postMessage(item);
    }
  }
  fallback() {
    if (this.local || this.disposed) return; this.local = true;
    console.warn('Terrain worker stopped. Switching to the main-thread fallback.');
    for (const slot of this.slots) {
      slot.worker.terminate(); clearTimeout(slot.timer);
      if (slot.busy && this.callbacks.has(slot.id)) this.queue.unshift({ task: slot.id, job: this.callbacks.get(slot.id).job });
    }
    this.slots.length = 0; this.pump();
  }
  cancelQueued(predicate) {
    this.queue = this.queue.filter((item) => {
      if (!predicate(item.job)) return true;
      const cb = this.callbacks.get(item.task); this.callbacks.delete(item.task); if (cb) cb.resolve(null); return false;
    });
  }
  dispose() {
    this.disposed = true; for (const slot of this.slots) { slot.worker.terminate(); clearTimeout(slot.timer); }
    for (const cb of this.callbacks.values()) cb.resolve(null); this.callbacks.clear(); this.queue.length = 0;
  }
}

const SIZES = [256, 512, 1024, 2048, 4096];
const SOLID_KINDS = ['pines', 'trees', 'dead', 'rocks'];

export class TerrainSystem {
  constructor(scene, generator, view, events) {
    this.scene = scene; this.generator = generator; this.view = view; this.events = events; this.origin = { x: 0, z: 0 }; this.revision = 0;
    this.tiles = new Map(); this.wanted = new Map(); this.pending = new Set(); this.results = []; this.epoch = 0; this.initial = true;
    // One material for every tile: terrain and the plants on it are vertex-coloured.
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
    this.material.name = 'terrain';
    this.pool = new WorkerPool(Math.min(3, Math.max(1, (navigator.hardwareConcurrency || 4) - 2)), buildTemplates());
    this.lastX = Infinity; this.lastZ = Infinity; this.failures = 0; this.objects = 0;
    this.budget = { count: 12, ms: 10 };
  }
  key(t) { return `${t.x}:${t.z}:${t.size}:${t.vegetation ? 1 : 0}`; }
  setOrigin(x, z) { this.origin = { x, z }; for (const tile of this.tiles.values()) tile.mesh.position.set(tile.x - x, 0, tile.z - z); }
  setView(view) { this.view = view; this.reset(this.generator); }
  reset(generator) {
    this.generator = generator; this.epoch++; this.revision++;
    this.pool.cancelQueued(() => true); this.pending.clear(); this.wanted.clear(); this.results.length = 0;
    for (const tile of this.tiles.values()) this.disposeTile(tile); this.tiles.clear(); this.initial = true; this.lastX = Infinity; this.lastZ = Infinity;
  }
  plan(x, z, force = false) {
    if (!force && Math.hypot(x - this.lastX, z - this.lastZ) < 105) return;
    this.lastX = x; this.lastZ = z; this.wanted.clear(); const epoch = this.epoch;
    const leaves = planTiles(x, z, this.view);
    for (const t of leaves) this.wanted.set(this.key(t), t);
    this.pool.cancelQueued((job) => !this.wanted.has(job.id) || job.epoch !== this.epoch);
    for (const t of leaves) {
      const id = this.key(t); if (this.tiles.has(id) || this.pending.has(id)) continue;
      this.pending.add(id);
      this.pool.run({ ...t, id, epoch, seed: this.generator.seedText, segments: t.size <= 512 ? 24 : 16, density: this.view.density }).then((data) => {
        if (epoch !== this.epoch) return;
        if (data && this.wanted.has(id)) this.results.push(data); else this.pending.delete(id);
      }).catch((error) => {
        if (epoch !== this.epoch) return;
        this.pending.delete(id); this.failures++; console.error('Terrain tile failed.', error);
        this.events.emit('error', { message: 'A terrain tile failed to load. It will be retried.' }); this.lastX = Infinity;
      });
    }
    this.commitIfReady();
  }
  attach(data) {
    if (this.tiles.has(data.id)) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    const b = data.bounds;
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(b[0], b[1], b[2]), new THREE.Vector3(b[3], b[4], b[5]));
    geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = 'tile';
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.position.set(data.x - this.origin.x, 0, data.z - this.origin.z);
    mesh.visible = this.initial;
    const tile = { id: data.id, x: data.x, z: data.z, size: data.size, minH: data.minH, objects: data.objects, mesh, geometry, step: data.size / (data.size <= 512 ? 24 : 16) };
    for (const k of SOLID_KINDS) tile[k] = data[k];
    this.tiles.set(data.id, tile); this.objects += data.objects; this.scene.add(mesh);
    this.events.emit('tile:loaded', { x: data.x, z: data.z, size: data.size });
  }
  commitIfReady() {
    if (!this.wanted.size) return;
    for (const id of this.wanted.keys()) if (!this.tiles.has(id)) return;
    for (const [id, tile] of this.tiles) { if (this.wanted.has(id)) tile.mesh.visible = true; else { this.disposeTile(tile); this.tiles.delete(id); } }
    this.initial = false; this.revision++;
  }
  /** Attach finished tiles within a small per-frame budget (bigger behind the title screen). */
  update() {
    const start = performance.now(); let count = 0;
    while (this.results.length && count < this.budget.count && performance.now() - start < this.budget.ms) {
      const data = this.results.shift(); this.pending.delete(data.id);
      if (this.wanted.has(data.id)) { this.attach(data); count++; }
    }
    if (count) { this.revision++; this.commitIfReady(); }
  }
  get progress() { let n = 0; for (const id of this.wanted.keys()) if (this.tiles.has(id)) n++; return this.wanted.size ? n / this.wanted.size : 0; }
  get readyNear() { let n = 0, total = 0; for (const [id, t] of this.wanted) { if (t.distance < 500) { total++; if (this.tiles.has(id)) n++; } } return total > 0 && n === total; }
  get stats() { return { tiles: this.tiles.size, target: this.wanted.size, pending: this.pending.size, objects: this.objects, workers: this.pool.local ? 'fallback' : this.pool.slots.length }; }
  disposeTile(tile) {
    this.scene.remove(tile.mesh); tile.geometry.dispose(); this.objects -= tile.objects;
    this.events.emit('tile:unloaded', { x: tile.x, z: tile.z, size: tile.size });
  }
  /** The visible tile under a point, finest first (a few map lookups, not a scan). */
  tileAt(x, z) {
    for (const size of SIZES) {
      const tx = Math.floor(x / size) * size, tz = Math.floor(z / size) * size;
      for (const veg of [1, 0]) {
        const tile = this.tiles.get(`${tx}:${tz}:${size}:${veg}`);
        if (tile && tile.mesh.visible) return tile;
      }
    }
    return null;
  }
  /** Ray-free ground contact against the exact active terrain grid. */
  groundHeight(x, z) {
    const tile = this.tileAt(x, z);
    return tile ? this.generator.groundHeight(x, z, tile.step) : this.generator.groundHeight(x, z);
  }
  /** Cylinder contacts for nearby solid trunks and rocks. No far-world physics cost. */
  resolveCollision(x, z, y) {
    let px = x, pz = z;
    for (const tile of this.tiles.values()) {
      if (!tile.mesh.visible || tile.size > 1024 || x < tile.x - 12 || x > tile.x + tile.size + 12 || z < tile.z - 12 || z > tile.z + tile.size + 12) continue;
      for (const type of SOLID_KINDS) {
        const list = tile[type], isRock = type === 'rocks';
        for (let i = 0; i < list.length; i += 6) {
          const ox = tile.x + list[i], oz = tile.z + list[i + 2], scale = list[i + 3], radius = (isRock ? 3 : 0.85) * scale + 0.48;
          if (y > list[i + 1] + (isRock ? 4 : 12) * scale || y < list[i + 1] - 2) continue;
          const dx = px - ox, dz = pz - oz, d2 = dx * dx + dz * dz;
          if (d2 < radius * radius) { const d = Math.sqrt(d2) || 0.001; px = ox + (dx || 0.001) / d * radius; pz = oz + dz / d * radius; }
        }
      }
    }
    return { x: px, z: pz };
  }
  dispose() { this.pool.dispose(); for (const tile of this.tiles.values()) this.disposeTile(tile); this.tiles.clear(); this.material.dispose(); }
}

