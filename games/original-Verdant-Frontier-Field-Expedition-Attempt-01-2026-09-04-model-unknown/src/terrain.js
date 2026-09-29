import * as THREE from 'three/webgpu';
import { WORLD } from './config.js';
import { createTerrainKernel, createChunkData } from './procedural.js';

export class TerrainSystem {
  constructor(scene, material, bus) {
    this.scene = scene; this.material = material; this.bus = bus;
    this.kernel = createTerrainKernel(WORLD.seed);
    this.chunks = new Map(); this.queue = []; this.pending = new Map(); this.desired = new Set();
    this.last = new THREE.Vector2(Infinity, Infinity); this.probe = new THREE.Vector2(); this.lastDistance = 0; this.serial = 0;
    this.worker = null; this.workerURL = null; this.jobs = 0; this.error = null;
    try {
      // The kernel is pure, so its source runs unchanged in a worker built from a blob.
      const code = `const createTerrainKernel=${createTerrainKernel.toString()};const createChunkData=${createChunkData.toString()};const k=createTerrainKernel(${WORLD.seed});self.onmessage=e=>{const {id,spec}=e.data;try{const data=createChunkData(k,spec);self.postMessage({id,spec,data},[data.positions.buffer,data.colors.buffer,data.indices.buffer]);}catch(error){self.postMessage({id,spec,error:String(error)})}};`;
      this.workerURL = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      this.worker = new Worker(this.workerURL);
      this.worker.onmessage = e => this.receive(e.data);
      this.worker.onerror = () => this.fallback();
    } catch { this.fallback(); }
  }
  fallback() {
    if (this.worker) this.worker.terminate(); this.worker = null;
    if (this.workerURL) URL.revokeObjectURL(this.workerURL); this.workerURL = null;
    for (const spec of this.pending.values()) if (this.desired.has(spec.key)) this.queue.push(spec);
    this.pending.clear(); this.jobs = 0;
  }
  plan(position, distance, force = false) {
    this.probe.set(position.x, position.z);
    if (!force && this.last.distanceToSquared(this.probe) < 96 ** 2 && distance === this.lastDistance) return;
    this.last.copy(this.probe); this.lastDistance = distance;
    const leaves = [];
    const visit = (x, z, size) => {
      const dx = Math.max(x - position.x, 0, position.x - x - size);
      const dz = Math.max(z - position.z, 0, position.z - z - size);
      const d = Math.hypot(dx, dz);
      if (d > distance) return;
      if (size > 256 && d < size * 1.45) {
        const h = size / 2;
        visit(x, z, h); visit(x + h, z, h); visit(x, z + h, h); visit(x + h, z + h, h);
      } else {
        const key = `${x},${z},${size}`;
        leaves.push({ x, z, size, key, segments: 32, distance: d });
      }
    };
    for (let z = -16384; z < 16384; z += 8192) for (let x = -16384; x < 16384; x += 8192) visit(x, z, 8192);
    leaves.sort((a, b) => a.distance - b.distance || a.size - b.size);
    this.desired = new Set(leaves.map(c => c.key));
    const pendingKeys = new Set([...this.pending.values()].map(c => c.key));
    this.queue = leaves.filter(c => !this.chunks.has(c.key) && !pendingKeys.has(c.key));
    this.cleanup();
  }
  cleanup() {
    // Keep the old LOD until every replacement patch is ready. This avoids holes.
    if (this.queue.length !== 0 || this.pending.size !== 0) return;
    for (const [key, mesh] of this.chunks) {
      if (!this.desired.has(key)) { this.scene.remove(mesh); mesh.geometry.dispose(); this.chunks.delete(key); }
    }
  }
  receive({ id, spec, data, error }) {
    this.pending.delete(id); this.jobs = Math.max(0, this.jobs - 1);
    if (error) {
      // Retry the patch on the main thread instead of leaving a permanent hole.
      this.error = error;
      if (spec && this.desired.has(spec.key) && !this.chunks.has(spec.key)) {
        try { data = createChunkData(this.kernel, spec); }
        catch { this.bus.emit('notice', 'Terrain loading failed. Use Return to station to reload this area.'); return; }
      } else return;
    }
    if (this.desired.has(spec.key) && !this.chunks.has(spec.key)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1)); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.material); mesh.position.set(spec.x, 0, spec.z);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.terrain = true;
      mesh.name = `Terrain ${spec.key}`; this.chunks.set(spec.key, mesh); this.scene.add(mesh);
    }
    this.cleanup();
  }
  update(position, distance) {
    this.plan(position, distance);
    if (this.worker) {
      while (this.jobs < 2 && this.queue.length) { const spec = this.queue.shift(), id = ++this.serial; this.pending.set(id, spec); this.jobs++; this.worker.postMessage({ id, spec }); }
    } else if (this.queue.length) {
      const spec = this.queue.shift(), id = ++this.serial; this.receive({ id, spec, data: createChunkData(this.kernel, spec) });
    }
    this.cleanup();
  }
  get ready() { return this.chunks.size > 12; }
  get progress() { const n = this.chunks.size; return n / Math.max(1, n + this.queue.length + this.pending.size); }
  get height() { return this.kernel.ground; }
  dispose() { this.fallback(); for (const mesh of this.chunks.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); } this.chunks.clear(); }
}
