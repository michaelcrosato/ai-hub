/* Bark & Brush — the vale's layout.

   The original built everything from one seeded random sequence, so every tuft,
   rock and tree is generated here in exactly the original order (including the
   calls it made and never used) and lands where it always did. The epilogue
   (the moon gate and terrace) draws from its own sequence so it cannot move
   anything that was already there. */

import { rng, clamp, lerp, TAU } from './art.js';

/** Ground height. The hill and the valley sides are the original's; the terrace past the gate is new. */
export function terrainH(x, z) {
  const hill = clamp((-z - 22) / 17, 0, 1);
  const tt = clamp((-z - 45) / 6, 0, 1);
  const terrace = tt * tt * (3 - 2 * tt);
  return hill * 1.4 + terrace * 0.9 + Math.min(30, Math.max(0, Math.abs(x) - 14)) * 0.15;
}

/** The river's wavy banks: water runs from z = -9 + w to z = -3 + w. */
export const riverW = (x) => Math.sin(x * 0.13) * 0.2;

export const PATCH_COLORS = ['#919e7070', '#c9c79d88', '#a2a77b70', '#7d976260'];

export const PATH_NODES = [[0, 20], [-1, 14], [-4.5, 8], [-3, 3], [0, -2], [0, -10], [2, -13], [6, -17], [4, -22], [-2, -28], [-3.8, -34], [-2, -40], [-2.3, -46], [-2.4, -52]];

/** Gate at (-2, -41): the painted torii is 850×700 drawn 10.5 tall; posts sit at 180 and 630 of 850. */
export const GATE = { x: -2, z: -41, h: 10.5, w: (10.5 * 850) / 700 };
GATE.posts = [180, 630].map((px) => GATE.x + (px / 850 - 0.5) * GATE.w);
GATE.veilX = (GATE.posts[0] + GATE.posts[1]) / 2;
GATE.veilW = GATE.posts[1] - GATE.posts[0] - 0.55;

export function makeMask(id, x, z, big, anim) {
  return { id, kind: 'mask', x, z, homeX: x, homeZ: z, y: terrainH(x, z), big, hp: big ? 6 : 3, maxhp: big ? 6 : 3, state: 'idle', timer: 0, windMax: 1, cd: 1.2 + id * 0.4, hit: 0, dead: false, yaw: 0, dirX: 0, dirZ: 0, wave: 0, struck: false, anim, active: false };
}

export function makeCrow(id, x, z) {
  return { id, kind: 'crow', x, z, y: terrainH(x, z) + 3.2, homeX: x, homeZ: z, big: false, hp: 2, maxhp: 2, state: 'circle', timer: 0, windMax: 1, cd: 2.2 + id * 1.1, hit: 0, dead: false, yaw: 0, ang: id * 2.1, active: false, tx: 0, tz: 0, sx: 0, sy: 0, sz: 0, struck: false, anim: id * 1.7 };
}

export function buildWorld() {
  const rand = rng(4281);
  const rnd = (a, b) => lerp(a, b, rand());
  const pick = (a) => a[Math.floor(rand() * a.length)];

  const groves = [
    [0, -5.8, 5.4, 8.4, 'Reed Grove', 22, 0],
    [1, 7.8, -17, 9.3, 'Bell Grove', 67, 0],
    [2, -3.8, -33, 13.6, 'The Great Willow', 31, 0],
  ].map(([id, x, z, h, name, seed, kind]) => ({ id, x, z, y: terrainH(x, z), h, name, seed, kind, awake: false, bloom: 0 }));

  // The original rolled one (unused) shade per 3×3 ground cell; keep the sequence in step.
  for (let z = -54; z < 28; z += 3) for (let x = -30; x < 30; x += 3) rand();

  const patches = [];
  for (let i = 0; i < 180; i++) {
    const x = rnd(-26, 26);
    const z = rnd(-47, 23);
    if (z > -9 && z < -3) continue;
    const sx = rnd(0.25, 1.7);
    const sz = rnd(0.25, 1.2);
    const pts = [];
    for (let k = 0; k < 7; k++) {
      const a = (k * TAU) / 7;
      const px = x + Math.sin(a) * sx * (0.7 + rand() * 0.3);
      const pz = z + Math.cos(a) * sz * (0.7 + rand() * 0.3);
      pts.push([px, pz]);
    }
    patches.push({ x, z, pts, color: pick(PATCH_COLORS) });
  }

  const pathPieces = [];
  for (let j = 0; j < PATH_NODES.length - 1; j++) {
    const a = PATH_NODES[j];
    const b = PATH_NODES[j + 1];
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const u = (i + 1) / 6;
      const x = lerp(a[0], b[0], t);
      const z = lerp(a[1], b[1], t);
      const xx = lerp(a[0], b[0], u);
      const zz = lerp(a[1], b[1], u);
      if ((z + zz) / 2 < -3 && (z + zz) / 2 > -9) continue;
      let nx = -(zz - z);
      let nz = xx - x;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl;
      nz /= nl;
      const w = 1.25;
      pathPieces.push([
        [x + nx * w, z + nz * w],
        [x - nx * w, z - nz * w],
        [xx - nx * w, zz - nz * w],
        [xx + nx * w, zz + nz * w],
      ]);
    }
  }

  const decor = [];
  const addDecor = (type, x, z, h, index = 0) => decor.push({ type, x, z, y: terrainH(x, z), h, index, phase: rand() * TAU, fade: 1 });
  for (let i = 0; i < 30; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * rnd(14, 24);
    const z = rnd(-48, 21);
    if (z > -11 && z < -1) continue;
    addDecor('tree', x, z, rnd(7, 13), Math.floor(rand() * 3));
  }
  addDecor('tree', 10, 10, 10.5, 0);
  addDecor('tree', -12, 17, 11, 1);
  addDecor('tree', -15, -12, 10, 2);
  addDecor('tree', 12, -30, 12, 0);
  addDecor('gate', GATE.x, GATE.z, GATE.h);
  for (let i = 0; i < 34; i++) {
    const x = rnd(-21, 21);
    const z = rnd(-44, 22);
    if (z > -10 && z < -2) continue;
    if (Math.abs(x) < 4 || groves.some((g) => Math.hypot(x - g.x, z - g.z) < 3)) continue;
    addDecor('rock', x, z, rnd(0.6, 2.2), Math.floor(rand() * 3));
  }
  for (const x of [-3.7, 3.7]) for (const z of [-1.9, -10.3]) addDecor('lantern', x, z, 2.35);
  for (const x of [-9, 1.5]) addDecor('lantern', x, -32, 2.5);
  for (let i = 0; i < 11; i++) {
    const x = (i % 2 ? -1 : 1) * rnd(13, 20);
    const z = rnd(-40, 17);
    addDecor('bamboo', x, z, rnd(5, 9));
  }

  const grass = [];
  for (let i = 0; i < 390; i++) {
    const x = rnd(-23, 23);
    const z = rnd(-45, 23);
    if (z > -9 && z < -3) continue;
    const h = rnd(0.42, 1.25);
    const index = Math.floor(rand() * 3);
    grass.push({ x, z, y: terrainH(x, z), h, index, phase: rand() * TAU });
  }

  const maskDefs = [[0, 4.7, -15.8, false], [1, 10.6, -18.8, false], [2, -3.8, -28.9, true]].map(([id, x, z, big]) => ({ id, x, z, big, anim: rand() * TAU }));

  /* ---------------------------------------------------------------- the epilogue (its own sequence) */
  const r2 = rng(907);
  const rn2 = (a, b) => lerp(a, b, r2());
  const moon = { id: 3, x: -2.3, z: -56, h: 10.8, name: 'The Moon Plum', seed: 88, kind: 2, awake: false, bloom: 0 };
  moon.y = terrainH(moon.x, moon.z);
  groves.push(moon);

  const coldLanterns = [[-6.2, -36.4], [1.8, -36.6], [-7.4, -39.4], [3.0, -39.6]].map(([x, z], id) => ({ id, type: 'cold', x, z, y: terrainH(x, z), h: 2.35, lit: false, glow: 0, phase: 0, fade: 1 }));

  const addNew = (type, x, z, h, index = 0) => decor.push({ type, x, z, y: terrainH(x, z), h, index, phase: r2() * TAU, fade: 1, epilogue: true });
  addNew('lantern', -6.6, -54.2, 2.5);
  addNew('lantern', 2.1, -54.2, 2.5);
  for (let i = 0; i < 4; i++) addNew('tree', (i % 2 ? -1 : 1) * rn2(14, 20), rn2(-60, -50), rn2(8, 12), i % 3);
  for (let i = 0; i < 4; i++) addNew('bamboo', (i % 2 ? -1 : 1) * rn2(11.5, 17), rn2(-60, -46), rn2(6, 9));
  for (let i = 0; i < 14; i++) {
    const x = rn2(-17, 15);
    const z = rn2(-61, -45);
    const h = rn2(0.6, 2);
    const index = Math.floor(r2() * 3);
    if (Math.abs(x - moon.x) < 3.4 || Math.hypot(x - moon.x, z - moon.z) < 5) continue;
    addNew('rock', x, z, h, index);
  }
  for (let i = 0; i < 90; i++) {
    const x = rn2(-18, 16);
    const z = rn2(-61, -44.5);
    const h = rn2(0.42, 1.2);
    const index = Math.floor(r2() * 3);
    grass.push({ x, z, y: terrainH(x, z), h, index, phase: r2() * TAU, epilogue: true });
  }

  const crowDefs = [[0, -7, -50.5], [1, 3, -51], [2, -2, -58.5]];

  return { groves, patches, pathPieces, decor, grass, maskDefs, crowDefs, coldLanterns };
}
