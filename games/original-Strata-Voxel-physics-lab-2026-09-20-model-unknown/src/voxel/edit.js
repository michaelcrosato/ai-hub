import { PALETTE } from './palette.js';
import { LIMITS } from '../engine/config.js';
import { index3 } from './world.js';

/** Remove only non-anchor cells. Keep their material data for physical debris. */
export function carveSphere(world, point, radius) {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Radius must be positive.');
  const s = world.voxelSize, origin = point.map(v => Math.floor((v - radius) / s));
  const end = point.map(v => Math.floor((v + radius) / s));
  const dims = end.map((v, d) => v - origin[d] + 1), volume = dims[0] * dims[1] * dims[2];
  if (volume > LIMITS.maxEditCells) throw new RangeError('This edit exceeds the cell budget.');
  const data = new Uint8Array(volume); let count = 0;
  for (let z = 0; z < dims[2]; z++) for (let y = 0; y < dims[1]; y++) for (let x = 0; x < dims[0]; x++) {
    const p = [origin[0] + x, origin[1] + y, origin[2] + z], material = world.get(...p);
    if (!material || PALETTE[material]?.anchor) continue;
    if (p.reduce((sum, v, d) => sum + ((v + 0.5) * s - point[d]) ** 2, 0) > radius ** 2) continue;
    data[index3(x, y, z, dims[0], dims[1])] = material; count++; world.set(...p, 0);
  }
  return { origin, dims, data, count };
}
export function removeFragment(world, fragment) {
  const [nx, ny, nz] = fragment.dims;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
    if (fragment.data[index3(x, y, z, nx, ny)]) world.set(fragment.origin[0] + x, fragment.origin[1] + y, fragment.origin[2] + z, 0);
}
