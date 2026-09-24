import { Mesh } from 'three/webgpu';
import { parseKey } from '../voxel/world.js';
import { makeGeometry } from './geometry.js';
import { LIMITS } from './config.js';

export class ChunkRenderer {
  constructor(world, scene, material, physics, worker) {
    Object.assign(this, { world, scene, material, physics, worker });
    this.meshes = new Map(); this.quads = new Map(); this.building = false;
  }
  async rebuild(onProgress = () => {}) {
    if (this.building) throw new Error('Concurrent chunk rebuild is not allowed.');
    this.building = true;
    try {
      while (this.world.dirty.size) {
        const keys = [...this.world.dirty]; this.world.dirty.clear();
        // Only one batch is queued. Large areas cannot hold thousands of pending snapshots.
        for (let offset = 0; offset < keys.length; offset += LIMITS.meshBatch) {
          const batch = keys.slice(offset, offset + LIMITS.meshBatch);
          const results = await Promise.all(batch.map(key => this.worker.run('mesh', this.world.snapshotChunk(key))));
          // The caller keeps physics paused until all affected chunks are committed.
          for (const result of results) {
            if (this.world.chunks.get(result.key)?.version !== result.version) { this.world.dirty.add(result.key); continue; }
            const origin = parseKey(result.key).map(value => value * this.world.chunkSize * this.world.voxelSize);
            const old = this.meshes.get(result.key);
            if (old) { this.scene.remove(old); old.geometry.dispose(); this.meshes.delete(result.key); }
            this.physics.replaceStatic(result.key, result.boxes, origin, this.world.voxelSize);
            this.quads.set(result.key, result.geometry.quads);
            if (result.geometry.indices.length) {
              const mesh = new Mesh(makeGeometry(result.geometry), this.material);
              mesh.position.fromArray(origin); mesh.castShadow = true; mesh.receiveShadow = true;
              mesh.matrixAutoUpdate = false; mesh.updateMatrix(); mesh.name = `voxel-chunk:${result.key}`;
              this.scene.add(mesh); this.meshes.set(result.key, mesh);
            }
          }
          onProgress(Math.min(1, (offset + batch.length) / keys.length));
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    } finally { this.building = false; }
  }
  get triangles() { return [...this.quads.values()].reduce((sum, value) => sum + value * 2, 0); }
  dispose() {
    for (const mesh of this.meshes.values()) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    this.meshes.clear(); this.quads.clear(); this.physics.clearStatic();
  }
}
