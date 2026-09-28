/** Exact grid traversal. Return the first occupied voxel, not a mesh triangle. */
export function raycastVoxels(world, origin, direction, maxDistance = 80) {
  const length = Math.hypot(...direction), s = world.voxelSize;
  if (!Number.isFinite(length) || length < 1e-10 || maxDistance < 0) return null;
  const dir = direction.map(v => v / length), cell = origin.map(v => Math.floor(v / s));
  const step = dir.map(Math.sign), delta = dir.map(v => v === 0 ? Infinity : s / Math.abs(v));
  const next = dir.map((v, d) => v === 0 ? Infinity : ((cell[d] + (v > 0 ? 1 : 0)) * s - origin[d]) / v);
  let distance = 0, normal = [0, 0, 0];
  const maxSteps = Math.ceil(maxDistance / s * 3) + 6;
  for (let iteration = 0; iteration < maxSteps && distance <= maxDistance; iteration++) {
    const material = world.get(...cell);
    if (material) return { cell: cell.slice(), normal, material, distance, point: origin.map((v, d) => v + dir[d] * distance) };
    const axis = next[0] <= next[1] && next[0] <= next[2] ? 0 : next[1] <= next[2] ? 1 : 2;
    distance = next[axis]; cell[axis] += step[axis]; next[axis] += delta[axis];
    normal = [0, 0, 0]; normal[axis] = -step[axis];
  }
  return null;
}
