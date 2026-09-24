import { CHUNK_SIZE, VOXEL_SIZE, LIMITS } from '../engine/config.js';
export const keyOf = (x, y, z) => `${x},${y},${z}`;
export const parseKey = key => key.split(',').map(Number);
export const index3 = (x, y, z, nx, ny) => x + nx * (y + ny * z);

/** Sparse storage. A chunk has 4096 material bytes, not 4096 objects. */
export class VoxelWorld {
  constructor(chunkSize = CHUNK_SIZE, voxelSize = VOXEL_SIZE) {
    this.chunkSize = chunkSize; this.voxelSize = voxelSize;
    this.chunks = new Map(); this.dirty = new Set(); this.count = 0; this.revision = 0;
  }
  get(x, y, z) {
    const n = this.chunkSize, cx = Math.floor(x / n), cy = Math.floor(y / n), cz = Math.floor(z / n);
    const c = this.chunks.get(keyOf(cx, cy, cz));
    return c ? c.data[index3(x - cx * n, y - cy * n, z - cz * n, n, n)] : 0;
  }
  set(x, y, z, value) {
    if (![x, y, z, value].every(Number.isInteger) || value < 0 || value > 255) throw new RangeError('Invalid voxel.');
    const n = this.chunkSize, cx = Math.floor(x / n), cy = Math.floor(y / n), cz = Math.floor(z / n);
    const lx = x - cx * n, ly = y - cy * n, lz = z - cz * n, key = keyOf(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      if (value === 0) return false;
      chunk = { data: new Uint8Array(n ** 3), count: 0, version: 0 };
      this.chunks.set(key, chunk);
    }
    const i = index3(lx, ly, lz, n, n), old = chunk.data[i];
    if (old === value) return false;
    const change = Number(value !== 0) - Number(old !== 0);
    chunk.data[i] = value; chunk.count += change; this.count += change; this.revision++;
    // Include edge and corner neighbours: their vertex AO reads a one-cell halo.
    const xs = [0], ys = [0], zs = [0];
    if (lx === 0) xs.push(-1); if (lx === n - 1) xs.push(1);
    if (ly === 0) ys.push(-1); if (ly === n - 1) ys.push(1);
    if (lz === 0) zs.push(-1); if (lz === n - 1) zs.push(1);
    for (const dz of zs) for (const dy of ys) for (const dx of xs) {
      const k = keyOf(cx + dx, cy + dy, cz + dz), c = this.chunks.get(k);
      if (c) { c.version++; this.dirty.add(k); }
    }
    return true;
  }
  fill(min, max, material) {
    for (let z = min[2]; z < max[2]; z++) for (let y = min[1]; y < max[1]; y++)
      for (let x = min[0]; x < max[0]; x++) this.set(x, y, z, material);
  }
  snapshotChunk(key) {
    const n = this.chunkSize, origin = parseKey(key).map(v => v * n), p = n + 2;
    const data = new Uint8Array(p ** 3);
    for (let z = -1; z <= n; z++) for (let y = -1; y <= n; y++) for (let x = -1; x <= n; x++)
      data[index3(x + 1, y + 1, z + 1, p, p)] = this.get(origin[0] + x, origin[1] + y, origin[2] + z);
    return { key, origin, dims: [n, n, n], data, version: this.chunks.get(key)?.version ?? 0, size: this.voxelSize };
  }
  /** Independent copies for worker transfer. Live world buffers stay attached. */
  snapshotSparse() {
    return { chunkSize: this.chunkSize, revision: this.revision,
      chunks: [...this.chunks.entries()].filter(([, chunk]) => chunk.count > 0)
        .map(([key, chunk]) => ({ coord: parseKey(key), data: chunk.data.slice() })) };
  }
  /** Bounded dense copy for topology work. The worker owns the transferred copy. */
  snapshotDense() {
    const occupied = [...this.chunks.entries()].filter(([, c]) => c.count > 0);
    if (!occupied.length) return { data: new Uint8Array(), dims: [0, 0, 0], origin: [0, 0, 0], revision: this.revision };
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], n = this.chunkSize;
    for (const [key] of occupied) parseKey(key).forEach((v, d) => { min[d] = Math.min(min[d], v * n); max[d] = Math.max(max[d], (v + 1) * n); });
    const dims = max.map((v, d) => v - min[d]), volume = dims[0] * dims[1] * dims[2];
    if (volume > LIMITS.maxDenseCells) throw new RangeError('Loaded area exceeds the topology budget.');
    const data = new Uint8Array(volume);
    for (const [key, chunk] of occupied) {
      const o = parseKey(key).map((v, d) => v * n - min[d]);
      for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) {
        const from = index3(0, y, z, n, n), to = index3(o[0], o[1] + y, o[2] + z, dims[0], dims[1]);
        data.set(chunk.data.subarray(from, from + n), to);
      }
    }
    return { data, dims, origin: min, revision: this.revision };
  }
}
