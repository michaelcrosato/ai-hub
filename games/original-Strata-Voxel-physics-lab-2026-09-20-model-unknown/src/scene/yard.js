import { MAT } from '../voxel/palette.js';
import { VOXEL_SIZE } from '../engine/config.js';

/**
 * The demolition yard: one wide paved slab with purpose-built test pieces.
 * Everything uses the garden palette and the same 12.5 cm grid. Only the two lowest
 * courses of the slab are anchors, so every structure stands by attachment alone.
 * Cell units throughout; y = 0 is the paving surface.
 */
export function* buildYard(world) {
  const { ANCHOR, LIMESTONE, BASALT, SANDSTONE, MOSS, LEAF, PALE_LEAF, WOOD, COPPER, GLOW, FLOWER } = MAT;
  const s = VOXEL_SIZE, lightCells = [], lights = [];
  const fill = (min, max, material) => world.fill(min, max, material);
  /** A glow block that counts as one lamp; the light hangs just off the given face. */
  const lamp = (min, max, offset = [0, 0.3, 0]) => {
    fill(min, max, GLOW);
    const cell = min.map((v, d) => Math.floor((v + max[d] - 1) / 2));
    lightCells.push(cell);
    lights.push(cell.map((v, d) => (v + 0.5) * s + offset[d]));
  };

  // 1. The slab: a rounded 25 × 20 m pad, basalt core, paving with a 2 m basalt grid.
  const RX = 100, RZ = 80;
  for (let z = -RZ; z <= RZ; z++) {
    for (let x = -RX; x <= RX; x++) {
      const shape = (Math.abs(x) / RX) ** 6 + (Math.abs(z) / RZ) ** 6;
      if (shape > 1) continue;
      const rim = shape > 0.82, top = rim ? -1 : 0;
      for (let y = -8; y <= top; y++) {
        let material = y <= -7 ? ANCHOR : y < -2 ? BASALT : y < top ? SANDSTONE : LIMESTONE;
        if (y === top) material = rim ? MOSS : (x % 16 === 0 || z % 16 === 0) ? BASALT : LIMESTONE;
        world.set(x, y, z, material);
      }
    }
    if ((z + RZ) % 16 === 15) yield { phase: 'slab' };
  }

  // 2. Stack tower: alternating courses, open windows, a copper crown and a lamp on top.
  const T = { x0: -68, x1: -52, z0: -52, z1: -36 };
  fill([T.x0 - 3, 1, T.z0 - 3], [T.x1 + 3, 3, T.z1 + 3], LIMESTONE);
  const courses = [LIMESTONE, SANDSTONE, BASALT];
  for (let c = 0; c < 11; c++) {
    const y0 = 3 + c * 8;
    fill([T.x0, y0, T.z0], [T.x1, y0 + 8, T.z1], courses[c % 3]);
  }
  fill([T.x0 + 2, 3, T.z0 + 2], [T.x1 - 2, 91, T.z1 - 2], 0);
  for (let c = 1; c < 11; c += 2) {
    const y0 = 3 + c * 8;
    fill([T.x0 + 6, y0 + 2, T.z0], [T.x1 - 6, y0 + 6, T.z1], 0);
    fill([T.x0, y0 + 2, T.z0 + 6], [T.x1, y0 + 6, T.z1 - 6], 0);
  }
  fill([T.x0 + 6, 3, T.z1 - 2], [T.x1 - 6, 15, T.z1], 0);
  fill([T.x0 - 1, 91, T.z0 - 1], [T.x1 + 1, 94, T.z1 + 1], COPPER);
  lamp([T.x0 + 6, 94, T.z0 + 6], [T.x1 - 6, 98, T.z1 - 6]);
  yield { phase: 'tower' };

  // 3. Span bridge: two basalt piers carry a thin deck with railings and a deck lamp.
  const B = { x0: 8, x1: 88, z0: -50, z1: -38 };
  fill([B.x0, 1, B.z0], [B.x0 + 8, 40, B.z1], BASALT);
  fill([B.x1 - 8, 1, B.z0], [B.x1, 40, B.z1], BASALT);
  fill([B.x0, 40, B.z0 + 2], [B.x1, 43, B.z1 - 2], LIMESTONE);
  fill([B.x0, 43, B.z0 + 2], [B.x1, 46, B.z0 + 3], SANDSTONE);
  fill([B.x0, 43, B.z1 - 3], [B.x1, 46, B.z1 - 2], SANDSTONE);
  for (let x = B.x0 + 16; x < B.x1 - 8; x += 16) fill([x, 34, B.z0 + 2], [x + 2, 40, B.z1 - 2], WOOD);
  lamp([46, 43, -46], [50, 47, -42]);
  yield { phase: 'bridge' };

  // 4. Copper wall: alternating copper and limestone panels with two sconces on its face.
  fill([-66, 1, 34], [2, 3, 42], SANDSTONE);
  for (let x = -64; x < 0; x += 8) fill([x, 3, 36], [x + 8, 40, 40], (x / 8) % 2 ? COPPER : LIMESTONE);
  fill([-65, 40, 35], [1, 43, 41], SANDSTONE);
  lamp([-52, 28, 40], [-49, 31, 42], [0, 0, 0.3]);
  lamp([-16, 28, 40], [-13, 31, 42], [0, 0, 0.3]);
  yield { phase: 'wall' };

  // 5. Column grove: nine slender columns under one heavy lintel slab.
  for (const x of [32, 48, 64]) for (const z of [28, 44, 60]) {
    fill([x - 3, 1, z - 3], [x + 3, 3, z + 3], LIMESTONE);
    fill([x - 2, 3, z - 2], [x + 2, 48, z + 2], LIMESTONE);
  }
  fill([26, 48, 22], [70, 52, 66], SANDSTONE);
  lamp([46, 52, 42], [50, 56, 46]);
  yield { phase: 'grove' };

  // 6. Lamp posts along the central walk.
  for (const x of [-72, -36, 0, 36, 72]) {
    fill([x - 2, 1, -2], [x + 3, 3, 3], BASALT);
    fill([x - 1, 3, -1], [x + 2, 20, 2], COPPER);
    lamp([x - 2, 20, -2], [x + 3, 24, 3]);
  }
  yield { phase: 'posts' };

  // 7. A reflecting pool and two corner trees, so the yard still belongs to the gardens.
  fill([-20, -3, 56], [20, 1, 76], BASALT);
  fill([-17, -2, 59], [17, 1, 73], 0);
  const tree = (cx, cz, height, canopy) => {
    fill([cx - 2, 1, cz - 2], [cx + 2, height, cz + 2], WOOD);
    for (const [dx, cy, dz, rx, ry, rz] of [[-5, height - 2, 0, 8, 5, 7], [5, height + 1, 1, 9, 6, 8], [0, height + 5, -1, 7, 4, 7]]) {
      for (let z = -rz; z <= rz; z++) for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const qx = Math.floor(x / 2) * 2, qy = Math.floor(y / 2) * 2, qz = Math.floor(z / 2) * 2;
        if ((qx / rx) ** 2 + (qy / ry) ** 2 + (qz / rz) ** 2 < 1) world.set(cx + dx + x, cy + y, cz + dz + z, canopy);
      }
    }
  };
  tree(-86, 62, 28, LEAF); tree(86, -62, 24, PALE_LEAF);
  for (const [x, z] of [[-80, 70], [-92, 54], [80, -70], [92, -54], [-84, 50]]) { world.set(x, 1, z, FLOWER); world.set(x + 1, 1, z, PALE_LEAF); }
  yield { phase: 'pool' };

  const landmarks = [
    { name: 'Yard centre', focus: [0, 1.65, 0] },
    { name: 'Stack tower', focus: [-7.5, 4.5, -5.5] },
    { name: 'Span bridge', focus: [6, 3.5, -5.5] },
    { name: 'Copper wall', focus: [-4, 2.5, 6.2] },
    { name: 'Column grove', focus: [6, 3.5, 5.5] },
    { name: 'Reflecting pool', focus: [0, 1, 8.25] },
  ];
  return { pools: [{ x: 0, y: -0.16, z: 66 * s, width: 34 * s, depth: 14 * s }], lightCells, lights, landmarks,
    detail: `5 test structures · ${lightCells.length} lamps` };
}
