// world.js — streams terrain tiles around the player: a small pool of module
// workers builds them, the main thread only uploads geometry and places props.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createInstanced } from 'kit/instancing.js';
import { CONFIG, buildChunk } from './terrain.js';

/**
 * One material for every prop (trees, rocks, reeds, cairn stones): flat-shaded
 * vertex colours, tinted per instance. Shared across worlds, so a new seed does
 * not rebuild its pipeline.
 */
export const propMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, flatShading: true });

/** Terrain: flat-shaded vertex colours, both sides (skirts and the tile edges). */
export const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, side: THREE.DoubleSide });

/** Colour a geometry with one sRGB colour, then scale and move it (for merged low-poly props). */
export function tinted(geometry, color, offset = [0, 0, 0], scale = [1, 1, 1]) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  g.scale(scale[0], scale[1], scale[2]);
  g.translate(offset[0], offset[1], offset[2]);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

export function merged(parts) {
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return g;
}

/** Terrain tiles in workers, with the main thread as a fallback when workers are unavailable. */
class TilePool {
  constructor(field, onFallback = () => {}) {
    this.field = field;
    this.queue = [];
    this.slots = [];
    this.serial = 0;
    this.disposed = false;
    this.busy = false;
    this.fallback = false;
    this.onFallback = onFallback;
    try {
      const url = new URL('./terrain-worker.js', import.meta.url);
      const count = Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 4) - 2));
      for (let i = 0; i < count; i++) {
        const slot = { worker: new Worker(url, { type: 'module' }), task: null, timeout: 0 };
        slot.worker.onmessage = ({ data }) => {
          const task = slot.task;
          if (!task || data.id !== task.id) return;
          clearTimeout(slot.timeout);
          slot.task = null;
          if (data.error) task.reject(new Error(data.error));
          else task.resolve(data.data);
          this.pump();
        };
        // A worker that cannot load (no module workers here) or crashes hands its work to the main thread.
        slot.worker.onerror = () => this.enableFallback();
        slot.worker.onmessageerror = () => this.enableFallback();
        this.slots.push(slot);
      }
    } catch {
      this.enableFallback();
    }
  }

  enableFallback() {
    if (this.disposed || this.fallback) return;
    this.fallback = true;
    for (const slot of this.slots) {
      clearTimeout(slot.timeout);
      slot.worker.terminate();
      if (slot.task) this.queue.unshift(slot.task);
    }
    this.slots = [];
    this.onFallback();
    this.pump();
  }

  run(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ job, resolve, reject, id: ++this.serial });
      this.pump();
    });
  }

  pump() {
    if (this.disposed) return;
    if (this.fallback) {
      if (this.busy || !this.queue.length) return;
      this.busy = true;
      setTimeout(() => {
        this.busy = false;
        if (this.disposed) return;
        const task = this.queue.shift();
        if (task) {
          try {
            task.resolve(buildChunk(this.field, task.job.cx, task.job.cz, task.job.segments, task.job.props));
          } catch (err) {
            task.reject(err);
          }
        }
        this.pump();
      }, 0);
      return;
    }
    for (const slot of this.slots) {
      if (slot.task || !this.queue.length) continue;
      slot.task = this.queue.shift();
      slot.timeout = setTimeout(() => this.enableFallback(), 20000);
      const { cx, cz, segments, props } = slot.task.job;
      slot.worker.postMessage({ id: slot.task.id, seed: this.field.seed, cx, cz, segments, props });
    }
  }

  dispose() {
    this.disposed = true;
    for (const slot of this.slots) {
      clearTimeout(slot.timeout);
      slot.worker.terminate();
      slot.task?.reject(new Error('World disposed'));
    }
    for (const task of this.queue) task.reject(new Error('World disposed'));
    this.queue = [];
    this.slots = [];
  }
}

/** Low-poly props, one InstancedMesh per kind per tile. The geometries are built once. */
class Vegetation {
  constructor() {
    const trunk = () => tinted(new THREE.CylinderGeometry(0.35, 0.65, 7, 5), '#64503a', [0, 3.5, 0]);
    this.geometries = {
      pine: merged([
        trunk(),
        tinted(new THREE.ConeGeometry(4.7, 8.8, 6), '#315c49', [0, 7.1, 0]),
        tinted(new THREE.ConeGeometry(3.7, 8, 6), '#376a51', [0, 10.3, 0]),
        tinted(new THREE.ConeGeometry(2.5, 6.5, 6), '#47775a', [0, 13.4, 0]),
      ]),
      oak: merged([
        trunk(),
        tinted(new THREE.IcosahedronGeometry(5.4, 0), '#6d9146', [0, 8.5, 0], [1.2, 0.85, 1]),
        tinted(new THREE.IcosahedronGeometry(3.6, 0), '#799b50', [3.3, 8, 0]),
        tinted(new THREE.IcosahedronGeometry(4, 0), '#557c3b', [-3, 7.3, 1]),
      ]),
      willow: merged([
        trunk(),
        tinted(new THREE.IcosahedronGeometry(6.5, 1), '#687d41', [0, 7.8, 0], [1.25, 0.65, 1]),
        tinted(new THREE.ConeGeometry(2.2, 5.5, 5).rotateZ(Math.PI), '#566e3d', [4.7, 4.9, 0]),
        tinted(new THREE.ConeGeometry(2.4, 5.6, 5).rotateZ(Math.PI), '#617844', [-4.1, 4.8, 1]),
      ]),
      rock: tinted(new THREE.DodecahedronGeometry(1, 0), '#8d9184', [0, 0.4, 0], [1.2, 0.9, 0.9]),
      reed: merged([
        tinted(new THREE.CylinderGeometry(0.07, 0.12, 3.4, 4), '#807740', [0, 1.7, 0]),
        tinted(new THREE.CylinderGeometry(0.19, 0.19, 0.65, 5), '#705038', [0, 3.25, 0]),
        tinted(new THREE.ConeGeometry(0.4, 2.1, 3), '#747a3c', [0.45, 1.1, 0.2]),
      ]),
      grass: merged([
        tinted(new THREE.ConeGeometry(0.65, 2.3, 3), '#bcc17a', [0, 1.1, 0]),
        tinted(new THREE.ConeGeometry(0.6, 1.6, 3), '#a9b268', [0.5, 0.8, 0.4]),
      ]),
      cactus: merged([
        tinted(new THREE.CylinderGeometry(0.45, 0.6, 6.5, 6), '#78956b', [0, 3.25, 0]),
        tinted(new THREE.CylinderGeometry(0.32, 0.36, 2.3, 5), '#6b875e', [1.4, 4.3, 0]),
        tinted(new THREE.BoxGeometry(1.5, 0.5, 0.5), '#6b875e', [0.65, 3.3, 0]),
      ]),
    };
    this.kinds = Object.keys(this.geometries);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.counts = Object.fromEntries(this.kinds.map((k) => [k, 0]));
  }

  create(items) {
    const group = new THREE.Group();
    const counts = this.counts;
    for (const k of this.kinds) counts[k] = 0;
    for (const item of items) counts[item.kind]++;
    const meshes = {};
    const filled = {};
    for (const k of this.kinds) {
      if (!counts[k]) continue;
      // createInstanced: every chunk's batches share one shader instead of compiling their own (r186).
      const mesh = createInstanced(this.geometries[k], propMaterial, counts[k]);
      mesh.name = k;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshes[k] = mesh;
      filled[k] = 0;
    }
    for (const item of items) {
      const mesh = meshes[item.kind];
      const i = filled[item.kind]++;
      const s = item.scale;
      this.dummy.position.set(item.x, item.y, item.z);
      this.dummy.rotation.set(0, item.rotation, 0);
      this.dummy.scale.set(s, s * (0.92 + item.tint * 0.24), s);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(i, this.dummy.matrix);
      this.color.setRGB(0.8 + item.tint * 0.2, 0.85 + item.tint * 0.15, 0.78 + item.tint * 0.2);
      mesh.setColorAt(i, this.color);
    }
    for (const k of this.kinds) {
      const mesh = meshes[k];
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
    return group;
  }

  dispose() {
    for (const g of Object.values(this.geometries)) g.dispose();
  }
}

/** Shared by every world: the geometries never change with the seed. */
let vegetation = null;

export class World {
  constructor(game) {
    this.game = game;
    this.field = game.field;
    this.tiles = new Map();
    this.pending = new Map();
    this.wanted = new Map();
    this.failed = new Map();
    this.queue = [];
    this.disposed = false;
    this.marker = '';
    this.root = new THREE.Group();
    this.root.name = 'World';
    game.scene.add(this.root);
    vegetation ??= new Vegetation();
    this.vegetation = vegetation;
    this.workers = new TilePool(this.field, () => game.events.emit('notice', 'Terrain uses the main thread on this browser.'));
    this.stats = { tiles: 0, objects: 0, queued: 0 };
  }

  /** Which tiles the view needs, at which detail, nearest first. */
  plan(position, force = false) {
    const size = CONFIG.chunkSize;
    const view = this.game.view;
    const treeDistance = this.game.treeDistance;
    const key = `${Math.floor(position.x / (size / 2))},${Math.floor(position.z / (size / 2))},${view.distance},${treeDistance}`;
    if (!force && key === this.marker) return;
    this.marker = key;
    const pcx = Math.floor(position.x / size);
    const pcz = Math.floor(position.z / size);
    const reach = Math.ceil(view.distance / size);
    const wanted = new Map();
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const distance = Math.hypot((cx + 0.5) * size - position.x, (cz + 0.5) * size - position.z);
        if (distance > view.distance + size * 0.6) continue;
        const segments = distance < size * 2.25 ? 64 : distance < size * 4 ? 32 : distance < size * 7 ? 16 : distance < size * 12 ? 8 : 4;
        const props = distance < treeDistance + size * 0.6;
        const k = `${cx},${cz}`;
        wanted.set(k, { key: k, cx, cz, segments, props, distance, signature: `${segments}:${props}` });
      }
    }
    this.wanted = wanted;
    for (const [k, tile] of this.tiles) {
      if (!wanted.has(k)) {
        this.drop(tile);
        this.tiles.delete(k);
      }
    }
    this.refreshQueue();
  }

  refreshQueue() {
    this.queue = [...this.wanted.values()]
      .filter((t) => this.tiles.get(t.key)?.signature !== t.signature && !this.pending.has(t.key) && (this.failed.get(t.key) || 0) < 2)
      .sort((a, b) => a.distance - b.distance);
  }

  update(position) {
    const origin = this.game.origin;
    this.root.position.set(-origin.x, 0, -origin.z);
    this.plan(position);
    while (this.pending.size < 3 && this.queue.length) {
      const job = this.queue.shift();
      this.pending.set(job.key, job.signature);
      this.workers
        .run(job)
        .then((data) => {
          if (this.disposed || this.wanted.get(job.key)?.signature !== job.signature) return;
          this.place(job, data);
        })
        .catch((err) => {
          if (this.disposed) return;
          this.failed.set(job.key, (this.failed.get(job.key) || 0) + 1);
          this.game.events.emit('error', { system: 'terrain', message: err.message });
        })
        .finally(() => {
          this.pending.delete(job.key);
          if (!this.disposed) this.refreshQueue();
        });
    }
    this.stats.tiles = this.tiles.size;
    this.stats.queued = this.queue.length + this.pending.size;
  }

  place(job, data) {
    const size = CONFIG.chunkSize;
    const old = this.tiles.get(job.key);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    // The bounds come from the worker, so the main thread never walks the vertices.
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(0, data.minY, 0), new THREE.Vector3(size, data.maxY, size));
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(size / 2, (data.minY + data.maxY) / 2, size / 2),
      Math.hypot(size / 2, size / 2, (data.maxY - data.minY) / 2)
    );
    const group = new THREE.Group();
    group.position.set(job.cx * size, 0, job.cz * size);
    const mesh = new THREE.Mesh(geometry, terrainMaterial);
    // The coarsest tiles start 9.2 km out, past anything the cascades can reach (3.3 km of
    // view plus the 4 km light margin): keeping them out of the shadow passes saves culling work.
    mesh.castShadow = job.segments >= 8;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (data.props.length) group.add(this.vegetation.create(data.props));
    this.root.add(group);
    if (old) this.drop(old);
    this.tiles.set(job.key, { ...job, group, geometry, items: data.props });
    this.stats.objects += data.props.length;
    this.game.events.emit('chunk:loaded', { x: job.cx, z: job.cz, group, props: data.props });
  }

  /** True when the 3×3 tiles around a point are loaded at full detail. */
  isReady(position) {
    const size = CONFIG.chunkSize;
    const cx = Math.floor(position.x / size);
    const cz = Math.floor(position.z / size);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) if (this.tiles.get(`${cx + dx},${cz + dz}`)?.segments !== 64) return false;
    }
    return true;
  }

  /** The loaded tiles around a point as a 0..1 fraction (for the loading bar). */
  progress(position) {
    const size = CONFIG.chunkSize;
    const cx = Math.floor(position.x / size);
    const cz = Math.floor(position.z / size);
    let near = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) if (this.tiles.get(`${cx + dx},${cz + dz}`)?.segments === 64) near++;
    }
    const all = this.tiles.size / Math.max(1, this.wanted.size);
    return Math.min(1, (near / 9) * 0.7 + all * 0.3);
  }

  ground(x, z) {
    const tile = this.tiles.get(`${Math.floor(x / CONFIG.chunkSize)},${Math.floor(z / CONFIG.chunkSize)}`);
    return this.field.ground(x, z, CONFIG.chunkSize / (tile?.segments || 64));
  }

  hasGround(x, z) {
    return this.tiles.get(`${Math.floor(x / CONFIG.chunkSize)},${Math.floor(z / CONFIG.chunkSize)}`)?.segments === 64;
  }

  /** Push a walker out of tree trunks and boulders. */
  resolveCollision(p, radius = 0.7) {
    const size = CONFIG.chunkSize;
    const cx = Math.floor(p.x / size);
    const cz = Math.floor(p.z / size);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tile = this.tiles.get(`${cx + dx},${cz + dz}`);
        if (!tile) continue;
        for (const item of tile.items) {
          if (item.kind === 'grass' || item.kind === 'reed') continue;
          const top = item.y + (item.kind === 'rock' ? 1.5 : 6) * item.scale;
          if (p.y - CONFIG.eyeHeight > top || p.y < item.y) continue;
          const ix = tile.cx * size + item.x;
          const iz = tile.cz * size + item.z;
          const r = radius + (item.kind === 'rock' ? 1.1 : 0.62) * item.scale;
          let ox = p.x - ix;
          let oz = p.z - iz;
          let d = Math.hypot(ox, oz);
          if (d >= r) continue;
          if (d < 1e-4) {
            ox = 1;
            oz = 0;
            d = 1;
          }
          p.x = ix + (ox / d) * r;
          p.z = iz + (oz / d) * r;
        }
      }
    }
  }

  drop(tile) {
    this.game.events.emit('chunk:unloaded', { x: tile.cx, z: tile.cz });
    this.root.remove(tile.group);
    tile.geometry.dispose();
    tile.group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
    });
    this.stats.objects -= tile.items.length;
  }

  dispose() {
    this.disposed = true;
    this.workers.dispose();
    for (const tile of this.tiles.values()) this.drop(tile);
    this.tiles.clear();
    this.game.scene.remove(this.root);
  }
}
