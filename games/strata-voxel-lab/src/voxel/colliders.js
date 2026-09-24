import { paddedSampler } from './mesher.js';
import { index3 } from './world.js';

/** Exact, non-overlapping box cover. This never fills a hole with a hull. */
export function mergeColliders({ data, dims, preserveMaterials = true }) {
  const [nx, ny, nz] = dims, sample = paddedSampler(data, dims), used = new Uint8Array(nx * ny * nz), boxes = [];
  function matches(x, y, z, material) {
    if (used[index3(x, y, z, nx, ny)]) return false;
    const m = sample(x, y, z); return m !== 0 && (!preserveMaterials || m === material);
  }
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const material = sample(x, y, z); if (!material || used[index3(x, y, z, nx, ny)]) continue;
    let w = 1, h = 1, depth = 1;
    while (x + w < nx && matches(x + w, y, z, material)) w++;
    growY: while (y + h < ny) {
      for (let dx = 0; dx < w; dx++) if (!matches(x + dx, y + h, z, material)) break growY;
      h++;
    }
    growZ: while (z + depth < nz) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++)
        if (!matches(x + dx, y + dy, z + depth, material)) break growZ;
      depth++;
    }
    for (let dz = 0; dz < depth; dz++) for (let dy = 0; dy < h; dy++)
      used.fill(1, index3(x, y + dy, z + dz, nx, ny), index3(x + w, y + dy, z + dz, nx, ny));
    boxes.push({ x, y, z, w, h, d: depth, material });
  }
  return boxes;
}
