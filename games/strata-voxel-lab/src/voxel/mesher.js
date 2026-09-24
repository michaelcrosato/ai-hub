import { PALETTE } from './palette.js';
import { index3 } from './world.js';

export function paddedSampler(data, dims) {
  const px = dims[0] + 2, py = dims[1] + 2;
  return (x, y, z) => data[index3(x + 1, y + 1, z + 1, px, py)] || 0;
}
export function padVolume(data, dims) {
  const [nx, ny, nz] = dims, out = new Uint8Array((nx + 2) * (ny + 2) * (nz + 2));
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++)
    out.set(data.subarray(index3(0, y, z, nx, ny), index3(0, y, z, nx, ny) + nx), index3(1, y + 1, z + 1, nx + 2, ny + 2));
  return out;
}

/** Greedy surface meshing. Non-uniform AO faces stay as single cells. */
export function meshVolume({ data, dims, size = 0.125 }) {
  const sample = paddedSampler(data, dims), positions = [], normals = [], colors = [], ao = [], surfaces = [], indices = [];
  const p = [0, 0, 0]; let quads = 0;
  function cornerAO(cell, d, u, v, sign) {
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
      const q = cell.slice(); q[d] += sign; q[u] += a;
      const side1 = !!sample(...q); q[u] -= a; q[v] += b;
      const side2 = !!sample(...q); q[u] += a;
      const corner = !!sample(...q);
      return side1 && side2 ? 0 : 3 - Number(side1) - Number(side2) - Number(corner);
    });
  }
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3, width = dims[u], height = dims[v];
    for (const sign of [-1, 1]) for (let slice = 0; slice < dims[d]; slice++) {
      const mask = new Uint32Array(width * height);
      for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
        p[d] = slice; p[u] = i; p[v] = j;
        const material = sample(...p); if (!material) continue;
        p[d] += sign; const adjacent = sample(...p); p[d] -= sign;
        if (adjacent) continue;
        const a = cornerAO(p, d, u, v, sign);
        mask[i + width * j] = material | ((a[0] | a[1] << 2 | a[2] << 4 | a[3] << 6) << 8);
      }
      for (let j = 0; j < height; j++) for (let i = 0; i < width;) {
        const token = mask[i + width * j]; if (!token) { i++; continue; }
        const material = token & 255, packed = token >> 8, a = [packed & 3, packed >> 2 & 3, packed >> 4 & 3, packed >> 6 & 3];
        let w = 1, h = 1;
        if (a.every(value => value === a[0])) {
          while (i + w < width && mask[i + w + width * j] === token) w++;
          outer: while (j + h < height) {
            for (let k = 0; k < w; k++) if (mask[i + k + width * (j + h)] !== token) break outer;
            h++;
          }
        }
        const first = positions.length / 3, palette = PALETTE[material] || PALETTE[2];
        for (const [corner, [du, dv]] of [[0, [0, 0]], [1, [w, 0]], [2, [w, h]], [3, [0, h]]]) {
          const xyz = [0, 0, 0], normal = [0, 0, 0];
          xyz[d] = slice + (sign > 0 ? 1 : 0); xyz[u] = i + du; xyz[v] = j + dv; normal[d] = sign;
          positions.push(...xyz.map(value => value * size)); normals.push(...normal); colors.push(...palette.color);
          ao.push(0.4 + a[corner] * 0.2); surfaces.push(palette.roughness, palette.metalness, palette.emission);
        }
        const triangle = a[0] + a[2] > a[1] + a[3] ? [0, 1, 3, 1, 2, 3] : [0, 1, 2, 0, 2, 3];
        if (sign < 0) { [triangle[1], triangle[2]] = [triangle[2], triangle[1]]; [triangle[4], triangle[5]] = [triangle[5], triangle[4]]; }
        indices.push(...triangle.map(k => first + k)); quads++;
        for (let y = 0; y < h; y++) mask.fill(0, i + width * (j + y), i + w + width * (j + y));
        i += w;
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), colors: new Float32Array(colors),
    ao: new Float32Array(ao), surfaces: new Float32Array(surfaces), indices: new Uint32Array(indices), quads };
}
