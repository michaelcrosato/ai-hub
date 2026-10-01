// TeaKen arenas. The Ember Temple is the original stage, rebuilt triangle for
// triangle with the same seeded layout. The Jade Terrace is new: a moonlit tea
// plantation on a mountainside, made from the same faceted pieces.

import { TAU, hex, tint, rnd, rand, setSeed } from './geo.js';

/* ------------------------------------------------------------ shared props */

function roof(g, cx, cy, cz, w, d, h, colors = {}) {
  const tile = colors.tile || '#5b665c', under = colors.under || '#273c3c', trim = colors.trim || '#b69d6b';
  const beam = colors.beam || '#c6a77b', ribA = colors.ribA || '#56685e', ribB = colors.ribB || '#627065';
  const rings = [[w * 0.42, d * 0.42, 0], [w * 0.64, d * 0.64, -h * 0.38], [w, d, -h * 0.7], [w * 1.08, d * 1.08, -h * 0.61]];
  for (let i = 0; i < rings.length - 1; i++) {
    const [a, b, y] = rings[i], [c, e, z] = rings[i + 1];
    const P = [[-a, y, -b], [a, y, -b], [a, y, b], [-a, y, b]], Q = [[-c, z, -e], [c, z, -e], [c, z, e], [-c, z, e]];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      g.quad(...[P[j], Q[j], Q[k], P[k]].map((p) => [p[0] + cx, p[1] + cy, p[2] + cz]), i === 2 ? tile : under);
    }
  }
  g.box([cx, cy + 0.1, cz], [w * 0.98, 0.15, 0.14], trim);
  for (const z of [-1, 1]) g.bone([cx - w * 1.08, cy - h * 0.61, cz + z * d * 1.08], [cx + w * 1.08, cy - h * 0.61, cz + z * d * 1.08], 0.045, 0.045, beam, 5);
  for (let i = -9; i <= 9; i++) {
    const x = cx + (i * w) / 10;
    g.bone([x * 0.98, cy - h * 0.2, cz - d * 0.6], [x, cy - h * 0.66, cz - d], 0.013, 0.013, ribA, 4);
    g.bone([x * 0.98, cy - h * 0.2, cz + d * 0.6], [x, cy - h * 0.66, cz + d], 0.013, 0.013, ribB, 4);
  }
}

function lantern(g, x, z, h = 1.85) {
  g.box([x, 0.18, z], [0.65, 0.35, 0.65], '#575c52');
  g.box([x, h / 2, z], [0.22, h, 0.22], '#353c37');
  g.box([x, h - 0.25, z], [0.5, 0.12, 0.5], '#6e6a52');
  g.box([x, h + 0.12, z], [0.4, 0.52, 0.4], '#f2b56a', 0.92);
  for (const a of [-1, 1]) for (const b of [-1, 1]) g.box([x + a * 0.21, h + 0.12, z + b * 0.21], [0.048, 0.61, 0.048], '#342f29');
  g.box([x, h + 0.47, z], [0.73, 0.14, 0.73], '#555646');
  g.sphere([x, h + 0.69, z], [0.46, 0.17, 0.46], '#45534b', 2, 4);
  g.bone([x, h + 0.67, z], [x, h + 0.94, z], 0.07, 0.018, '#bd9c6a', 6);
}

function tree(g, x, z, h, col) {
  const root = [x, 0, z];
  g.bone(root, [x + 0.15, h * 0.68, z], 0.34, 0.16, '#3b3833', 6);
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4, r = rand(1.0, 2.4), p = [x + Math.cos(a) * r, h * 0.72 + rand(-0.2, 1.0), z + Math.sin(a) * r * 0.6];
    g.bone([x + 0.1, h * 0.5, z], p, 0.12, 0.027, '#413934', 5);
    g.sphere(p, [rand(1, 1.6), rand(0.48, 0.87), rand(0.7, 1.3)], tint(hex(col), rand(0.8, 1.12)), 3, 7);
  }
}

/* ------------------------------------------------------------ Ember Temple */

export function buildTemple(g) {
  setSeed(8812);
  g.box([0, -0.45, -2], [30, 0.8, 30], '#555e54');
  // Hundreds of individually coloured stone tiles. The small gaps are real geometry.
  for (let x = -12; x < 12; x++) {
    for (let z = -13; z < 9; z++) {
      const c = tint(hex('#7f8172'), rand(0.78, 1.14));
      g.box([x * 1.2 + 0.6, -0.07 + rand(-0.006, 0.006), z * 1.2 + 0.6], [1.184, 0.1, 1.184], c);
      if (rnd() < 0.07) {
        const xx = x * 1.2 + 0.3, zz = z * 1.2 + 0.4;
        g.tri([xx, 0.001, zz], [xx + 0.55, 0.001, zz + 0.45], [xx + 0.47, 0.001, zz + 0.41], '#4a5148');
      }
    }
  }
  g.ring([0, 0.005, 0], 4.4, 0.035, '#c4aa78');
  g.ring([0, 0.006, 0], 4.31, 0.018, '#5b6558');
  g.ring([0, 0.008, 0], 1.55, 0.025, '#bdac7c');
  g.ring([0, 0.009, 0], 1.65, 0.05, '#575f51');
  for (let i = 0; i < 32; i++) {
    const a = (TAU * i) / 32;
    g.box([Math.cos(a) * 4.15, 0.006, Math.sin(a) * 4.15], [0.06, 0.015, 0.22], '#aa956c', 0, -a);
  }
  // The seal: two angular leaves, set into the floor.
  g.quad([-0.8, 0.012, 0], [0.0, 0.012, -0.8], [0.65, 0.012, -0.12], [0, 0.012, 0.3], '#b29e70');
  g.quad([0.1, 0.013, 0.0], [0.8, 0.013, 0.1], [0.6, 0.013, 0.8], [-0.15, 0.013, 0.5], '#697258');
  for (const z of [-9.3, 9.3]) {
    g.box([0, 0.03, z], [28, 0.2, 0.4], '#b5ab8a');
    g.box([0, 0.05, z - 0.27], [28, 0.12, 0.08], '#535d50');
  }
  for (const x of [-11.8, 11.8]) {
    g.box([x, 0.25, 0], [0.45, 0.5, 19], '#61695b');
    for (let z = -8; z < 10; z += 2) {
      g.box([x, 0.72, z], [0.45, 1.3, 0.4], '#70766a');
      g.sphere([x, 1.47, z], [0.31, 0.2, 0.31], '#96977d', 3, 5);
    }
    g.box([x, 1.1, 0], [0.18, 0.16, 18], '#8d917a');
  }
  // Temple, open doors, golden gong, timber frame, and layered eaves.
  g.map = (p, o) => {
    o[0] = p[0];
    o[1] = p[1] * 0.82;
    o[2] = p[2] - 4.2;
    return o;
  };
  for (let i = 0; i < 5; i++) g.box([0, 0.13 + i * 0.12, -7.4 - i * 0.15], [10.8 - i * 0.37, 0.22, 4.8 - i * 0.1], '#717163');
  g.box([0, 2.05, -8.0], [8.8, 3.25, 1.6], '#53453a');
  g.box([0, 2.1, -7.08], [3.1, 3.0, 0.15], '#171e1c');
  for (const x of [-4.2, -2.5, 2.5, 4.2]) {
    g.box([x, 2.22, -6.9], [0.3, 3.65, 0.3], '#803f32');
    g.box([x, 0.66, -6.9], [0.61, 0.35, 0.59], '#99937b');
    g.box([x, 3.68, -6.9], [0.55, 0.25, 0.55], '#a38a58');
  }
  for (const x of [-3.38, 3.38]) {
    g.box([x, 2.2, -7.04], [1.2, 2.2, 0.1], '#9b7747');
    for (let j = 0; j < 6; j++) g.box([x - 0.47 + j * 0.19, 2.2, -6.97], [0.048, 2.3, 0.075], '#3d3730');
    for (let j = 0; j < 6; j++) g.box([x, 1.31 + j * 0.36, -6.94], [1.25, 0.05, 0.1], '#4b3d30');
  }
  g.box([0, 3.94, -7.0], [9.2, 0.37, 0.46], '#9e4732');
  g.box([0, 3.66, -6.72], [8.8, 0.1, 0.14], '#d1af70');
  g.box([0, 4.37, -7.3], [8.8, 0.5, 2.7], '#5d4938');
  for (const x of [-3, -1, 1, 3]) g.box([x, 4.32, -5.84], [0.17, 0.36, 0.35], '#bd9866');
  roof(g, 0, 5.8, -7.8, 5.15, 2.35, 1.8);
  g.box([0, 5.85, -7.9], [4.2, 1.05, 1.7], '#614b37');
  for (const x of [-1.8, -0.6, 0.6, 1.8]) g.box([x, 5.95, -6.98], [0.13, 0.85, 0.15], '#bc9365');
  roof(g, 0, 7.14, -7.8, 3.1, 1.48, 1.3);
  g.box([0, 4.04, -6.64], [1.54, 0.6, 0.16], '#1c302b');
  g.box([0, 4.04, -6.53], [1.35, 0.45, 0.04], '#c7a66a');
  g.box([0, 4.04, -6.5], [1.2, 0.34, 0.04], '#24392e');
  for (let i = 0; i < 3; i++) g.bone([-0.41 + i * 0.4, 3.96, -6.46], [-0.3 + i * 0.4, 4.15, -6.46], 0.027, 0.027, '#dfc48a', 4);
  g.sphere([0, 2.33, -7.02], [0.81, 0.81, 0.07], '#cdb56e', 4, 16);
  g.sphere([0, 2.33, -6.96], [0.58, 0.58, 0.055], '#ad7d45', 4, 16);
  g.sphere([0, 2.33, -6.88], [0.18, 0.18, 0.1], '#e7c077', 4, 10);
  g.bone([-0.65, 3.45, -7.02], [-0.53, 2.98, -7.02], 0.018, 0.018, '#232b25', 4);
  g.bone([0.65, 3.45, -7.02], [0.53, 2.98, -7.02], 0.018, 0.018, '#232b25', 4);
  // Side gates and warm lanterns.
  g.map = null;
  for (const x of [-8.4, 8.4]) {
    for (const q of [-1, 1]) {
      g.box([x + q * 1.18, 2.0, -4.8], [0.29, 4, 0.32], '#773e30');
      g.box([x + q * 1.18, 0.35, -4.8], [0.62, 0.65, 0.63], '#515c53');
    }
    g.box([x, 3.5, -4.8], [3.3, 0.24, 0.38], '#ad6b42');
    g.box([x, 4.05, -4.8], [3.6, 0.3, 0.62], '#3e4e47');
    g.bone([x - 2, 4.2, -4.8], [x + 2, 4.2, -4.8], 0.1, 0.1, '#ac8557', 5);
    g.box([x, 3.72, -4.8], [0.25, 0.61, 0.35], '#ad704b');
  }
  lantern(g, -5.25, -4.2);
  lantern(g, 5.25, -4.2);
  lantern(g, -8.8, 3.8, 1.7);
  lantern(g, 8.8, 3.8, 1.7);
  for (const x of [-6.1, 6.1]) {
    g.box([x, 0.34, -5.9], [0.9, 0.6, 1.1], '#6c7260');
    g.sphere([x, 0.95, -5.95], [0.39, 0.59, 0.53], '#8d8a6c', 3, 7);
    g.sphere([x, 1.58, -5.75], [0.42, 0.43, 0.38], '#8d8a6c', 3, 6);
    g.box([x, 1.43, -5.4], [0.37, 0.2, 0.31], '#5d6958');
    g.sphere([x, 1.04, -5.51], [0.25, 0.27, 0.31], '#66705e', 3, 5);
  }
  tree(g, -9.1, -6.7, 5.8, '#aa573a');
  tree(g, 9.4, -7.3, 6.9, '#a95a3e');
  tree(g, -13, -3, 7.8, '#833d32');
  tree(g, 13, -5.1, 8, '#a2583a');
  for (let i = 0; i < 32; i++) {
    const x = rand(-24, 24), z = rand(-20, -13), h = rand(4, 9);
    g.bone([x, 0, z], [x + rand(-0.2, 0.2), h, z], 0.08, 0.03, '#42584b', 5);
    if (i % 2 === 0) g.sphere([x, h * 0.8, z], [1.5, 0.72, 0.9], '#3c5148', 3, 5);
  }
  for (let layer = 0; layer < 3; layer++) {
    const z = -32 - layer * 15;
    for (let i = 0; i < 12; i++) {
      const x = -48 + i * 9 + rand(-2, 2), h = rand(4, 14) + layer;
      g.tri([x - 9, -0.8, z], [x + rand(-2, 2), h, z], [x + 10, -0.8, z], layer === 0 ? '#4b5b55' : layer === 1 ? '#625f56' : '#766559');
    }
  }
  // A faceted setting sun. It is intentionally not a texture.
  g.sphere([-14, 10.2, -48], [4.0, 4.0, 0.13], '#efab78', 4, 32, 1);
  // Moss and fallen leaves.
  for (let i = 0; i < 200; i++) {
    const x = rand(-13, 13), z = rand(-10, 9);
    if (Math.abs(x) < 5 && Math.abs(z) < 4 && rnd() < 0.87) continue;
    const s = rand(0.025, 0.085);
    g.tri([x, 0.007, z], [x + s, 0.007, z + s * 0.6], [x - s * 0.5, 0.007, z + s * 1.9], rnd() < 0.5 ? '#b27343' : '#747a55');
  }
}

/* ------------------------------------------------------------ Jade Terrace */

// Points on one side of the deck: 'front' runs along x at +z, 'left'/'right' along z at ∓x.
function at(side, along, y, out) {
  if (side === 'front') return [along, y, out];
  if (side === 'left') return [-out, y, along];
  return [out, y, along];
}
function dims(side, len, h, depth) {
  return side === 'front' ? [len, h, depth] : [depth, h, len];
}

function teaRow(g, side, from, to, y, out, spacing = 0.82) {
  for (let s = from; s <= to; s += spacing) {
    const p = at(side, s + rand(-0.12, 0.12), y + 0.3, out + rand(-0.08, 0.08));
    const shade = rnd();
    g.sphere(p, [rand(0.56, 0.72), rand(0.36, 0.48), rand(0.5, 0.66)], tint(hex(shade < 0.4 ? '#3f6b45' : shade < 0.8 ? '#4d7a4a' : '#5e8a52'), rand(0.85, 1.1)), 3, 6);
  }
}

function paperLantern(g, x, z, armX, armZ) {
  g.box([x, 0.08, z], [0.34, 0.16, 0.34], '#3a3a33');
  g.bone([x, 0, z], [x, 2.75, z], 0.055, 0.045, '#2f2a24', 5);
  const lx = x + armX * 0.42, lz = z + armZ * 0.42;
  g.bone([x, 2.62, z], [lx, 2.62, lz], 0.03, 0.03, '#2f2a24', 4);
  g.bone([lx, 2.62, lz], [lx, 2.42, lz], 0.008, 0.008, '#1d1b18', 3);
  g.sphere([lx, 2.15, lz], [0.21, 0.28, 0.21], '#f0b468', 3, 8, 0.9);
  g.box([lx, 2.42, lz], [0.2, 0.06, 0.2], '#2a2621');
  g.box([lx, 1.88, lz], [0.2, 0.06, 0.2], '#2a2621');
  g.bone([lx, 1.85, lz], [lx, 1.62, lz], 0.03, 0.005, '#b8473a', 4);
  return [lx, 2.15, lz];
}

/** @returns {{lamps: number[][]}} light positions for flames and glow */
export function buildTerrace(g) {
  setSeed(5150);
  const lamps = [];
  // Valley floor far below, so the edge never shows the void.
  g.box([0, -6.3, 0], [150, 0.5, 150], '#1d2823');

  // The deck: long cedar planks with real seams, a fascia, and posts below.
  for (let i = 0; i < 36; i++) {
    const z = -8.6 + 0.24 + i * 0.48;
    g.box([0, -0.06 + rand(-0.004, 0.004), z], [17.2, 0.1, 0.455], tint(hex('#6b5038'), rand(0.82, 1.12)));
    if (rnd() < 0.5) {
      const x = rand(-8, 8);
      g.tri([x, -0.002, z - 0.1], [x + 0.32, -0.002, z + 0.02], [x + 0.05, -0.002, z + 0.12], '#4a3626');
    }
  }
  g.box([0, -0.3, 8.75], [17.7, 0.5, 0.2], '#3e2f22');
  g.box([0, -0.3, -8.75], [17.7, 0.5, 0.2], '#3e2f22');
  g.box([8.75, -0.3, 0], [0.2, 0.5, 17.7], '#3e2f22');
  g.box([-8.75, -0.3, 0], [0.2, 0.5, 17.7], '#3e2f22');
  for (const x of [-8.5, -2.8, 2.8, 8.5]) for (const z of [-8.5, 0, 8.5]) g.bone([x, -0.5, z], [x, -4.6, z], 0.16, 0.18, '#33281d', 6);
  for (const z of [-8.5, 0, 8.5]) g.bone([-8.5, -2.3, z], [8.5, -2.3, z], 0.07, 0.07, '#2d241a', 5);

  // The fighting circle: inlaid brass and jade, with a tea leaf at its heart.
  g.ring([0, 0.001, 0], 4.4, 0.045, '#c9b07a');
  g.ring([0, 0.002, 0], 4.28, 0.02, '#3f5a49');
  g.ring([0, 0.003, 0], 1.55, 0.03, '#c9b07a');
  g.ring([0, 0.004, 0], 1.66, 0.05, '#3f5a49');
  for (let i = 0; i < 32; i++) {
    const a = (TAU * i) / 32;
    g.box([Math.cos(a) * 4.15, 0.004, Math.sin(a) * 4.15], [0.06, 0.012, 0.22], '#a8946a', 0, -a);
  }
  const leafTurn = 0.6, cs = Math.cos(leafTurn), sn = Math.sin(leafTurn);
  g.map = (p, o) => {
    o[0] = p[0] * cs - p[2] * sn;
    o[1] = p[1];
    o[2] = p[0] * sn + p[2] * cs;
    return o;
  };
  for (let k = 0; k < 8; k++) {
    const z0 = -1.05 + k * 0.26, z1 = z0 + 0.26, w0 = Math.sin((Math.PI * k) / 8) * 0.44, w1 = Math.sin((Math.PI * (k + 1)) / 8) * 0.44;
    g.quad([-w0, 0.006, z0], [0, 0.006, z0], [0, 0.006, z1], [-w1, 0.006, z1], '#7c9f74');
    g.quad([0, 0.006, z0], [w0, 0.006, z0], [w1, 0.006, z1], [0, 0.006, z1], '#5f8160');
  }
  g.box([0, 0.008, 0.02], [0.035, 0.006, 1.9], '#d2b46e');
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) g.box([s * 0.14, 0.008, -0.45 + k * 0.42], [0.25, 0.006, 0.025], '#c3a866', 0, s * 0.55);
  g.box([0, 0.008, 1.12], [0.04, 0.006, 0.3], '#8b6a3e');
  g.map = null;

  // Bamboo railing around three sides, open at the back where the steps rise.
  const posts = [];
  for (let i = 0; i <= 8; i++) {
    const s = -8.6 + i * 2.15;
    posts.push(['front', s], ['left', s], ['right', s]);
    if (Math.abs(s) > 1.7) posts.push(['back', s]);
  }
  const placed = new Set();
  for (const [side, s] of posts) {
    const p = side === 'back' ? [s, 0, -8.6] : at(side, s, 0, 8.6);
    const key = `${p[0].toFixed(2)},${p[2].toFixed(2)}`;
    if (placed.has(key)) continue; // corners are shared by two sides
    placed.add(key);
    g.box([p[0], 0.45, p[2]], [0.16, 0.9, 0.16], '#8a7a4c');
    g.sphere([p[0], 0.93, p[2]], [0.11, 0.06, 0.11], '#b19a5e', 2, 5);
  }
  for (const side of ['front', 'left', 'right']) {
    for (const y of [0.78, 0.42]) g.bone(at(side, -8.6, y, 8.6), at(side, 8.6, y, 8.6), 0.035, 0.035, '#a99a5c', 5);
    for (let i = 0; i < 8; i++) {
      const s = -8.6 + (i + 0.5) * 2.15;
      g.sphere(at(side, s, 0.78, 8.6), [0.05, 0.045, 0.05], '#7d7040', 2, 5);
    }
  }
  for (const x0 of [-8.6, 2.15]) for (const y of [0.78, 0.42]) g.bone([x0, y, -8.6], [x0 + 6.45, y, -8.6], 0.035, 0.035, '#a99a5c', 5);

  // Paper lanterns on poles at the corners and halfway along the sides.
  lamps.push(paperLantern(g, -8.25, -8.25, 1, 0), paperLantern(g, 8.25, -8.25, -1, 0));
  lamps.push(paperLantern(g, -8.25, 2.2, 1, 0), paperLantern(g, 8.25, 2.2, -1, 0));
  lamps.push(paperLantern(g, -8.25, 8.25, 1, 0), paperLantern(g, 8.25, 8.25, -1, 0));

  // Terraced tea rows falling away on three sides.
  for (const side of ['front', 'left', 'right']) {
    for (let k = 0; k < 4; k++) {
      const out0 = 8.95 + k * 2.4, out1 = out0 + 2.4, y = -0.95 - k * 1.0, mid = (out0 + out1) / 2;
      const from = side === 'front' ? -out1 : -14.2, to = out1;
      const len = to - from, centre = (from + to) / 2;
      g.box(at(side, centre, y - 2.5, mid), dims(side, len, 5, 2.4), '#4a3a2b');
      g.box(at(side, centre, y - 0.03, mid), dims(side, len, 0.08, 2.38), '#3b4630');
      // Dry-stone riser on the inner edge of each step.
      g.box(at(side, centre, y + 0.48, out0 + 0.08), dims(side, len, 0.98, 0.18), tint(hex('#5f6458'), rand(0.85, 1.05)));
      for (let s = from + 0.6; s < to; s += rand(1.2, 2.2)) {
        g.box(at(side, s, y + rand(0.25, 0.75), out0 + 0.19), dims(side, rand(0.4, 0.8), rand(0.18, 0.3), 0.06), tint(hex('#70766a'), rand(0.8, 1.1)));
      }
      teaRow(g, side, from + 0.4, to - 0.2, y, mid + 0.25);
    }
  }

  // Behind the deck: a gravel yard, stone steps, and the tea pavilion.
  g.box([0, -0.6, -11.55], [17.2, 1.1, 5.9], '#4b4a3c');
  for (let i = 0; i < 70; i++) {
    const x = rand(-8.4, 8.4), z = rand(-14.2, -8.9), s = rand(0.05, 0.13);
    g.tri([x, -0.045, z], [x + s, -0.045, z + s * 0.4], [x + s * 0.3, -0.045, z + s], '#5e5d4c');
  }
  for (let i = 0; i < 3; i++) {
    const top = 0.15 * (i + 1);
    g.box([0, (top - 0.05) / 2, -8.95 - i * 0.3], [3.4 - i * 0.2, top + 0.05, 0.3], '#77786a');
  }
  g.box([0, 0.2, -12.0], [7.6, 0.5, 4.6], '#5d6052');
  g.box([0, 0.47, -12.0], [7.2, 0.06, 4.2], '#6b5038');
  for (const x of [-2.75, 2.75]) {
    for (const z of [-9.8, -13.6]) {
      g.box([x, 2.0, z], [0.3, 3.1, 0.3], '#7a3a2c');
      g.box([x, 0.62, z], [0.5, 0.25, 0.5], '#8f8a74');
    }
    // Hanging scrolls on the front pillars.
    g.box([x, 2.0, -9.62], [0.36, 1.5, 0.03], '#d9cba3');
    g.box([x, 2.0, -9.6], [0.08, 1.2, 0.02], '#2d3a32');
    g.box([x, 2.78, -9.62], [0.44, 0.06, 0.06], '#4a3524');
  }
  g.box([0, 3.6, -9.8], [6.2, 0.26, 0.34], '#9e4732');
  g.box([0, 3.6, -13.6], [6.2, 0.26, 0.34], '#7d3a2b');
  g.box([0, 3.82, -11.7], [6.0, 0.22, 4.2], '#4e3d2e');
  roof(g, 0, 5.15, -11.7, 3.75, 2.75, 1.4, { tile: '#3f5d4e', under: '#22332d', trim: '#c9a65e', beam: '#c6a77b', ribA: '#4c6a5a', ribB: '#557463' });
  g.box([0, 4.15, -9.66], [1.5, 0.48, 0.12], '#1c302b');
  g.box([0, 4.15, -9.58], [1.3, 0.34, 0.04], '#c7a66a');
  for (let i = 0; i < 3; i++) g.bone([-0.4 + i * 0.4, 4.07, -9.54], [-0.29 + i * 0.4, 4.24, -9.54], 0.025, 0.025, '#24392e', 4);
  // The great iron kettle on its table: the tournament's last cup is poured here.
  g.box([0, 0.86, -11.7], [1.7, 0.12, 1.1], '#4a3524');
  for (const x of [-0.7, 0.7]) for (const z of [-11.25, -12.15]) g.box([x, 0.66, z], [0.1, 0.32, 0.1], '#3a291c');
  g.sphere([0, 1.3, -11.7], [0.44, 0.38, 0.44], '#2c302d', 4, 10);
  g.sphere([0, 1.31, -11.7], [0.452, 0.07, 0.452], '#3a403b', 2, 10);
  g.sphere([0, 1.66, -11.7], [0.21, 0.06, 0.21], '#3a3f3a', 2, 8);
  g.sphere([0, 1.74, -11.7], [0.06, 0.05, 0.06], '#c9a65e', 2, 6);
  g.bone([0.36, 1.28, -11.7], [0.68, 1.48, -11.7], 0.075, 0.035, '#2c302d', 6);
  const handle = [];
  for (let i = 0; i <= 6; i++) {
    const a = (Math.PI * i) / 6;
    handle.push([Math.cos(a) * 0.34, 1.52 + Math.sin(a) * 0.36, -11.7]);
  }
  for (let i = 0; i < 6; i++) g.bone(handle[i], handle[i + 1], 0.026, 0.026, '#24282a', 4);
  for (const x of [-0.42, 0.42]) {
    g.box([x, 0.98, -11.45], [0.22, 0.12, 0.22], '#7b6a4c');
    g.sphere([x, 1.06, -11.45], [0.08, 0.05, 0.08], '#d7c79b', 2, 6);
  }

  // Stone lanterns in the yard.
  lantern(g, -5.6, -11.2, 1.6);
  lantern(g, 5.6, -11.2, 1.6);

  // Tea terraces climbing the hill behind the pavilion (kept low, so the moon clears them).
  for (let k = 0; k < 4; k++) {
    const z0 = -14.5 - k * 2.6, y = 0.45 + k * 0.8, mid = z0 - 1.3;
    g.box([0, y - 4, mid], [56, 8, 2.6], '#4a3a2b');
    g.box([0, y - 0.03, mid], [56, 0.08, 2.58], '#3b4630');
    g.box([0, y - 0.55, z0 - 0.06], [56, 1.15, 0.16], tint(hex('#5f6458'), rand(0.85, 1.05)));
    for (let x = -27.4; x < 28; x += 0.82) {
      if (k === 0 && Math.abs(x) < 4.4) continue; // the pavilion sits in front of the first row
      const shade = rnd();
      g.sphere([x + rand(-0.1, 0.1), y + 0.3, mid - 0.2 + rand(-0.08, 0.08)], [rand(0.56, 0.72), rand(0.36, 0.48), rand(0.5, 0.66)], tint(hex(shade < 0.4 ? '#3f6b45' : shade < 0.8 ? '#4d7a4a' : '#5e8a52'), rand(0.85, 1.1)), 3, 6);
    }
  }

  // Bamboo groves at the back corners.
  for (const cx of [-12.2, 12.2]) {
    for (let i = 0; i < 9; i++) {
      const x = cx + rand(-1.6, 1.6), z = -11.5 + rand(-2, 2.4), h = rand(5, 8.5), base = -2.0;
      g.bone([x, base, z], [x + rand(-0.25, 0.25), h, z], 0.075, 0.05, tint(hex('#6d8a4f'), rand(0.85, 1.1)), 5);
      for (let j = 1; j < 5; j++) g.sphere([x, base + (j * (h - base)) / 5, z], [0.085, 0.03, 0.085], '#56703f', 2, 5);
      if (i % 2 === 0) g.sphere([x, h * 0.9, z], [rand(0.9, 1.3), rand(0.4, 0.6), rand(0.7, 1.0)], tint(hex('#4f6e45'), rand(0.85, 1.1)), 3, 6);
    }
  }

  // Mountains all around, dissolving into the valley mist.
  for (let layer = 0; layer < 2; layer++) {
    const R = 52 + layer * 12;
    for (let i = 0; i < 30; i++) {
      const a = (TAU * (i + layer * 0.5)) / 30, a1 = a - 0.16, a2 = a + 0.16, h = rand(6, 15) + layer * 3;
      const ra = R + rand(-3, 3);
      g.tri([Math.cos(a1) * R, -6, Math.sin(a1) * R], [Math.cos(a) * ra, h, Math.sin(a) * ra], [Math.cos(a2) * R, -6, Math.sin(a2) * R], layer === 0 ? '#2c3d47' : '#3b4c5a');
    }
  }

  // The hilltop behind the last row, and a tree line along it, clear of the moon.
  g.box([0, 2.85 - 4, -28.4], [56, 8, 7], '#3e3a2c');
  g.box([0, 2.82, -28.4], [56, 0.08, 6.98], '#33402c');
  g.map = (p, o) => {
    o[0] = p[0];
    o[1] = p[1] + 2.85;
    o[2] = p[2];
    return o;
  };
  for (const [x, h] of [[-22, 6.2], [-15.5, 5.4], [-8.5, 6.6], [23, 5.8], [28, 6.8]]) tree(g, x, -26.6 + rand(-0.6, 0.6), h, '#3c5a44');
  g.map = null;

  // The tea moon and its halo: a glow above 1 keeps them clear of the valley mist.
  g.sphere([14, 6.6, -32.3], [3.5, 3.5, 0.05], '#33465e', 4, 32, 2);
  g.sphere([14, 6.6, -32], [2.5, 2.5, 0.12], '#efe9cf', 4, 32, 2);
  g.sphere([14.6, 7.1, -31.85], [0.55, 0.45, 0.04], '#d8d0b2', 3, 8, 2);
  g.sphere([13.1, 6.0, -31.85], [0.35, 0.3, 0.04], '#d3cbad', 3, 8, 2);

  return { lamps };
}

export const TEMPLE_LAMPS = [[-5.25, 2.02, -4.2], [5.25, 2.02, -4.2]];

/**
 * Stage looks: which arena, the sky gradient (top to bottom), fog, the light
 * that falls on everything that does not glow, and what drifts in the air.
 */
export const STAGES = [
  {
    key: 'dusk', arena: 'temple', name: 'EMBER TEMPLE', sub: 'THE LAST LIGHT',
    sky: ['#262631', '#6e423d', '#cc8a64', '#96876e'], fog: [0.4, 0.34, 0.28], fogNear: 14, fogFar: 62, fogMax: 0.83,
    light: [1, 1, 1], glowFog: 1, glow: 0.157, drift: 'leaves',
  },
  {
    key: 'night', arena: 'temple', name: 'EMBER TEMPLE · NIGHT', sub: 'UNDER THE EMBER MOON',
    sky: ['#07090f', '#171a2c', '#3a2c3a', '#4a4048'], fog: [0.12, 0.12, 0.16], fogNear: 12, fogFar: 58, fogMax: 0.86,
    light: [0.58, 0.62, 0.8], glowFog: 0.3, glow: 0.3, drift: 'leaves',
  },
  {
    key: 'terrace', arena: 'terrace', name: 'JADE TERRACE', sub: 'UNDER THE TEA MOON',
    sky: ['#060a14', '#122036', '#2c4258', '#4d6470'], fog: [0.13, 0.18, 0.24], fogNear: 16, fogFar: 70, fogMax: 0.8,
    light: [0.64, 0.74, 0.92], glowFog: 1, glow: 0.26, drift: 'fireflies',
  },
];
