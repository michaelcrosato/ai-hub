import { MAT } from '../voxel/palette.js';
// A seeded scene makes changes and timing comparisons repeatable.
export function randomSeed(seed = 8271) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function createGarden(world) {
  const { ANCHOR, LIMESTONE, BASALT, SANDSTONE, MOSS, LEAF, WOOD, COPPER, GLOW, FLOWER, PALE_LEAF } = MAT;
  const random = randomSeed();
  // Terraced rock island. Only the lowest two courses are fixed anchors.
  for (let z = -52; z <= 52; z++) for (let x = -68; x <= 68; x++) {
    const shape = Math.pow(Math.abs(x) / 68, 5) + Math.pow(Math.abs(z) / 52, 5);
    const edge = shape + Math.sin(x * 0.22) * 0.022 + Math.cos(z * 0.28) * 0.024;
    if (edge > 1) continue;
    const top = edge > 0.87 ? -3 : edge > 0.71 ? -1 : 0;
    const bottom = -14 + Math.floor(edge * 7);
    for (let y = bottom; y <= top; y++) {
      const material = y <= bottom + 1 ? ANCHOR : y < -8 ? BASALT : y < -4 ? SANDSTONE : y === top ? MOSS : LIMESTONE;
      world.set(x, y, z, material);
    }
  }
  // Main court, shallow steps, and a narrow water garden to the right.
  world.fill([-38, 1, -26], [30, 3, 23], LIMESTONE);
  world.fill([-33, 1, 23], [23, 2, 28], LIMESTONE);
  world.fill([-17, 1, 28], [7, 2, 42], LIMESTONE);
  world.fill([19, -2, -8], [51, 2, 26], BASALT);
  world.fill([22, -1, -5], [48, 3, 23], MAT.AIR);
  // A circular arch cut on the voxel grid, not a smooth polygon proxy.
  for (let z = -16; z < -10; z++) for (let y = 3; y <= 46; y++) for (let x = -22; x <= 16; x++) {
    const xx = x + 3, yy = y - 27, radius = Math.hypot(xx, yy);
    const column = y < 27 && Math.abs(xx) >= 11 && Math.abs(xx) <= 17;
    const arch = y >= 27 && radius >= 11 && radius <= 17;
    if (column || arch) world.set(x, y, z, LIMESTONE);
  }
  for (const x of [-20, 8]) {
    world.fill([x - 2, 3, -18], [x + 10, 6, -8], LIMESTONE);
    world.fill([x, 25, -17], [x + 8, 27, -9], SANDSTONE);
  }
  // Low wall and two broken columns. These make useful fracture tests.
  world.fill([-37, 3, -25], [-33, 17, 14], LIMESTONE);
  world.fill([-38, 17, -26], [-32, 19, 15], SANDSTONE);
  for (const [x, z, height] of [[-28, 9, 29], [10, 8, 16], [28, -28, 23]]) {
    world.fill([x - 5, 1, z - 5], [x + 5, 4, z + 5], LIMESTONE);
    world.fill([x - 3, 4, z - 3], [x + 3, height, z + 3], LIMESTONE);
    world.fill([x - 4, height - 3, z - 4], [x + 4, height, z + 4], SANDSTONE);
  }
  // Inlaid copper and warm emitters. Emission is not an automatic light source.
  world.fill([-12, 3, 9], [2, 4, 19], BASALT);
  world.fill([-9, 4, 12], [-1, 5, 17], COPPER);
  world.fill([-7, 5, 13], [-3, 10, 16], GLOW);
  for (const x of [-30, 15]) {
    world.fill([x, 3, 20], [x + 3, 6, 23], COPPER);
    world.fill([x, 6, 20], [x + 3, 7, 23], GLOW);
  }
  function tree(cx, cz, height, material) {
    world.fill([cx - 2, 0, cz - 2], [cx + 2, height, cz + 2], WOOD);
    world.fill([cx - 9, height - 8, cz - 1], [cx + 9, height - 5, cz + 2], WOOD);
    const clouds = [[-8, height - 3, 0, 10, 6, 9], [6, height, 1, 12, 7, 10], [-1, height + 6, -2, 10, 5, 9]];
    for (const [dx, cy, dz, rx, ry, rz] of clouds) {
      // Quantised two-cell contours give a calm silhouette and preserve the fine grid.
      for (let z = -rz; z <= rz; z++) for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const qx = Math.floor(x / 2) * 2, qy = Math.floor(y / 2) * 2, qz = Math.floor(z / 2) * 2;
        if ((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2 < 1) world.set(cx + dx + x, cy + y, cz + dz + z, material);
      }
    }
  }
  tree(-46, -24, 32, LEAF); tree(41, -29, 26, PALE_LEAF);
  // Ground cover. Each plant touches the ground through its stem.
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(random() * 119 - 59), z = Math.floor(random() * 87 - 43);
    if (x > -39 && x < 52 && z > -28 && z < 43) continue;
    let y = 3; while (y > -5 && !world.get(x, y - 1, z)) y--;
    if (y <= -5) continue;
    world.set(x, y, z, MOSS); world.set(x, y + 1, z, i % 4 === 0 ? FLOWER : PALE_LEAF);
    if (i % 3 === 0) world.set(x + 1, y + 1, z, PALE_LEAF);
  }
  return { pool: { x: 4.375, y: -0.065, z: 1.125, width: 3.25, depth: 3.5 },
    focus: [-0.5, 1.65, -0.4], lightCells: [[-5, 7, 14], [-29, 6, 21], [16, 6, 21]], lights: [[-0.65, 1.25, 1.8], [-3.55, 0.9, 2.7], [2.0, 0.9, 2.7]] };
}
