/**
 * world.js — streams the procedural ground around the player: a square window
 * of 64 m chunks (terrain, rocks, conifers) plus one horizon ring that reaches
 * the draw distance. Chunks are generated in a module worker so walking never
 * hitches; if the worker cannot start, the same builders run on the main
 * thread a couple of chunks per frame.
 */
import * as THREE from 'three/webgpu';
import { CHUNK_SIZE, TerrainField, buildChunkTerrain, buildChunkProps, buildDistantTerrain } from './terrain.js';
import { WORLD } from './data.js';

const MAX_RADIUS = 12;
const key = (x, z) => `${x},${z}`;

function geometryFrom(mesh) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  if (mesh.colors) geometry.setAttribute('color', new THREE.BufferAttribute(mesh.colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export class WorldStreamer {
  constructor(scene, field, materials, { seed, seaLevel }) {
    this.field = field;
    this.materials = materials;
    this.root = new THREE.Group();
    this.root.name = 'Procedural World';
    scene.add(this.root);
    this.chunks = new Map(); // key -> { x, z, group|null, requested }
    this.queue = []; // chunk requests not yet sent (sorted nearest first)
    this.ready = []; // worker results waiting to be turned into meshes
    this.inFlight = 0;
    this.distant = null;
    this.distantSeq = 0;
    this.distantReady = null;
    this.currentX = NaN;
    this.currentZ = NaN;
    this.radius = 2;
    this.budget = WORLD.chunksBuiltPerFrame;
    this.radiusChanged = true;
    this.horizon = WORLD.distantTerrainRadius;
    this.destroyed = false;
    this.readyWaiters = [];
    this.lastWorkerMessage = 0;
    this.distantPending = null;
    this.worker = null;
    this.startWorker({ seed, seaLevel });
  }

  get viewRadius() {
    return this.radius;
  }
  get loadedChunkCount() {
    let n = 0;
    for (const c of this.chunks.values()) if (c.group) n += 1;
    return n;
  }
  get pendingChunkCount() {
    return this.chunks.size - this.loadedChunkCount;
  }
  get buildBudget() {
    return this.budget;
  }
  get drawDistance() {
    return this.horizon;
  }
  get usingWorker() {
    return !!this.worker;
  }

  startWorker(options) {
    try {
      const worker = new Worker(new URL('./terrain-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event) => this.onWorkerMessage(event.data);
      worker.onerror = (event) => {
        event.preventDefault?.();
        this.failWorker(event.message || 'worker error');
      };
      worker.postMessage({ type: 'init', options });
      this.worker = worker;
    } catch (err) {
      console.warn('[stillpoint] terrain worker unavailable, building on the main thread:', err);
      this.worker = null;
    }
  }

  failWorker(reason) {
    if (!this.worker) return;
    console.warn('[stillpoint] terrain worker stopped, building on the main thread:', reason);
    this.worker.terminate();
    this.worker = null;
    this.inFlight = 0;
    // Everything that was waiting on the worker goes back in the local queue.
    for (const chunk of this.chunks.values()) {
      if (!chunk.group && chunk.requested) {
        chunk.requested = false;
        this.queue.push(chunk);
      }
    }
    this.sortQueue();
    this.distantSeq += 1;
    this.requestDistant();
  }

  setViewRadius(radius) {
    if (!Number.isFinite(radius)) throw new RangeError('World view radius must be a finite number of chunks.');
    const r = Math.floor(radius);
    if (r < 0 || r > MAX_RADIUS) throw new RangeError(`World view radius must be between 0 and ${MAX_RADIUS} chunks.`);
    if (r !== this.radius) {
      this.radius = r;
      this.radiusChanged = true;
    }
  }

  setBuildBudget(budget) {
    if (!Number.isFinite(budget) || budget < 1) throw new RangeError('World chunk build budget must be at least one.');
    this.budget = Math.min(16, Math.floor(budget));
  }

  setHorizon(metres) {
    const h = Math.max(600, Math.round(metres));
    if (h !== this.horizon) {
      this.horizon = h;
      this.radiusChanged = true;
    }
  }

  /** Call every frame with the player position. */
  streamAround(position, budget = this.budget) {
    if (this.destroyed || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
    const cx = Math.floor(position.x / CHUNK_SIZE);
    const cz = Math.floor(position.z / CHUNK_SIZE);
    if (this.radiusChanged || cx !== this.currentX || cz !== this.currentZ) this.plan(cx, cz);
    this.pump(budget);
  }

  /** Stream with a larger budget, e.g. right after a teleport. */
  warmStart(position, budget = 9) {
    this.streamAround(position, Math.max(1, Math.min(25, Math.floor(budget))));
  }

  reloadAround(position, budget = 25) {
    if (this.destroyed) return;
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.queue.length = 0;
    this.ready.length = 0;
    this.disposeDistant();
    this.distantReady = null;
    this.currentX = NaN;
    this.currentZ = NaN;
    this.radiusChanged = true;
    this.warmStart(position, budget);
  }

  /** Resolves once the chunks within one ring of the player and the horizon are built (or on timeout). */
  whenReady(timeoutMs = 10000) {
    return new Promise((resolve) => {
      const waiter = { resolve, done: false };
      this.readyWaiters.push(waiter);
      setTimeout(() => {
        if (!waiter.done) {
          waiter.done = true;
          resolve(false);
        }
      }, timeoutMs);
      this.checkReady();
    });
  }

  checkReady() {
    if (!this.readyWaiters.length || !Number.isFinite(this.currentX)) return;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const chunk = this.chunks.get(key(this.currentX + dx, this.currentZ + dz));
        if (chunk && !chunk.group) return;
      }
    }
    if (!this.distant) return;
    for (const w of this.readyWaiters) {
      if (!w.done) {
        w.done = true;
        w.resolve(true);
      }
    }
    this.readyWaiters.length = 0;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.worker?.terminate();
    this.worker = null;
    for (const chunk of this.chunks.values()) this.disposeChunk(chunk);
    this.chunks.clear();
    this.disposeDistant();
    this.root.removeFromParent();
  }

  /* ------------------------------------------------------------- planning */

  plan(cx, cz) {
    const wanted = new Set();
    for (let dz = -this.radius; dz <= this.radius; dz += 1) {
      for (let dx = -this.radius; dx <= this.radius; dx += 1) {
        const x = cx + dx;
        const z = cz + dz;
        const k = key(x, z);
        wanted.add(k);
        if (!this.chunks.has(k)) this.chunks.set(k, { key: k, x, z, group: null, requested: false });
      }
    }
    for (const [k, chunk] of this.chunks) {
      if (!wanted.has(k)) {
        this.disposeChunk(chunk);
        this.chunks.delete(k);
      }
    }
    this.currentX = cx;
    this.currentZ = cz;
    this.radiusChanged = false;
    this.queue = [...this.chunks.values()].filter((c) => !c.group && !c.requested);
    this.sortQueue();
    this.ready = this.ready.filter((r) => this.chunks.has(r.key));
    this.distantSeq += 1;
    this.requestDistant();
  }

  sortQueue() {
    const cx = this.currentX;
    const cz = this.currentZ;
    this.queue.sort((a, b) => (a.x - cx) ** 2 + (a.z - cz) ** 2 - ((b.x - cx) ** 2 + (b.z - cz) ** 2) || a.z - b.z || a.x - b.x);
  }

  requestDistant() {
    if (!Number.isFinite(this.currentX) || !Number.isFinite(this.currentZ)) return;
    const centerX = (this.currentX + 0.5) * CHUNK_SIZE;
    const centerZ = (this.currentZ + 0.5) * CHUNK_SIZE;
    const inner = (this.radius + 0.5) * CHUNK_SIZE;
    const outer = Math.max(inner + 256, this.horizon);
    const seq = this.distantSeq;
    const request = { type: 'distant', seq, centerX, centerZ, inner: Math.max(64, inner), outer };
    if (this.worker) this.worker.postMessage(request);
    else this.distantPending = request;
  }

  /** Send requests, apply finished results; `budget` chunks per frame. */
  pump(budget) {
    let applied = 0;
    while (this.ready.length && applied < budget) {
      if (this.applyChunk(this.ready.shift())) applied += 1;
    }
    if (this.worker) {
      const now = performance.now();
      if (this.inFlight > 0 && now - this.lastWorkerMessage > 8000) {
        this.failWorker('no answer for 8 s');
      } else {
        const maxInFlight = Math.max(2, budget * 2);
        while (this.inFlight < maxInFlight && this.queue.length) {
          const chunk = this.queue.shift();
          if (chunk.group || chunk.requested || this.chunks.get(chunk.key) !== chunk) continue;
          if (this.inFlight === 0) this.lastWorkerMessage = now;
          chunk.requested = true;
          this.inFlight += 1;
          this.worker.postMessage({ type: 'chunk', key: chunk.key, x: chunk.x, z: chunk.z });
        }
      }
    }
    if (!this.worker) {
      while (this.queue.length && applied < budget) {
        const chunk = this.queue.shift();
        if (chunk.group || this.chunks.get(chunk.key) !== chunk) continue;
        const props = buildChunkProps(this.field, chunk.x, chunk.z);
        this.applyChunk({ key: chunk.key, x: chunk.x, z: chunk.z, terrain: buildChunkTerrain(this.field, chunk.x, chunk.z), rocks: props.rocks, foliage: props.foliage });
        applied += 1;
      }
      if (this.distantPending) {
        const r = this.distantPending;
        this.distantPending = null;
        this.applyDistant({ seq: r.seq, centerX: r.centerX, centerZ: r.centerZ, mesh: buildDistantTerrain(this.field, r.centerX, r.centerZ, r.inner, r.outer) });
      }
    }
    if (this.distantReady) {
      const r = this.distantReady;
      this.distantReady = null;
      this.applyDistant(r);
    }
    this.checkReady();
  }

  onWorkerMessage(msg) {
    if (this.destroyed || !msg) return;
    this.lastWorkerMessage = performance.now();
    if (msg.type === 'chunk') {
      this.inFlight = Math.max(0, this.inFlight - 1);
      const chunk = this.chunks.get(msg.key);
      if (!chunk || chunk.group) return;
      this.ready.push(msg);
    } else if (msg.type === 'distant') {
      if (msg.seq === this.distantSeq) this.distantReady = msg;
    } else if (msg.type === 'error') {
      console.warn('[stillpoint] terrain worker error:', msg.message);
      if (msg.request === 'chunk') {
        this.inFlight = Math.max(0, this.inFlight - 1);
        const chunk = this.chunks.get(msg.key);
        if (chunk) chunk.requested = false;
      }
    }
  }

  /* ---------------------------------------------------------------- meshes */

  applyChunk(result) {
    const chunk = this.chunks.get(result.key);
    if (!chunk || chunk.group || !result.terrain) return false;
    const group = new THREE.Group();
    group.name = `Chunk ${result.x},${result.z}`;
    group.position.set(result.x * CHUNK_SIZE, 0, result.z * CHUNK_SIZE);
    const add = (mesh, material) => {
      if (!mesh) return;
      const m = new THREE.Mesh(geometryFrom(mesh), material);
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
    };
    add(result.terrain, this.materials.terrain);
    add(result.rocks, this.materials.rock);
    add(result.foliage, this.materials.foliage);
    group.updateMatrix();
    group.matrixAutoUpdate = false;
    this.root.add(group);
    chunk.group = group;
    chunk.requested = false;
    return true;
  }

  applyDistant(result) {
    if (result.seq !== this.distantSeq || !result.mesh) return;
    const mesh = new THREE.Mesh(geometryFrom(result.mesh), this.materials.terrain);
    mesh.name = 'Distant terrain / horizon';
    mesh.position.set(result.centerX, 0, result.centerZ);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.root.add(mesh);
    this.disposeDistant();
    this.distant = mesh;
  }

  disposeChunk(chunk) {
    if (!chunk.group) return;
    chunk.group.removeFromParent();
    chunk.group.traverse((o) => o.geometry?.dispose());
    chunk.group = null;
  }

  disposeDistant() {
    if (!this.distant) return;
    this.distant.removeFromParent();
    this.distant.geometry.dispose();
    this.distant = null;
  }
}

export function createTerrainField() {
  return new TerrainField({ seed: WORLD.seed, seaLevel: WORLD.seaLevel });
}
