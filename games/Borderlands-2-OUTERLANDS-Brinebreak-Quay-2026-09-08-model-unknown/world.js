// OUTERLANDS: Brinebreak Quay, built from the original procedural recipe.
// Every rand() call happens in the same order as the original single-file game, so the
// terrain tint, cracks, mountains and sign scuffs come out identical. New pieces (extra
// colliders, the bounty board) are appended after the original recipe for that reason.
import { Builder, C, color, clamp, lerp, rand, rnd, pick, TAU, V } from './util.js';

export const ROUTE = [[0, 44], [0, 29], [-9, 15], [4, 0], [11, -19], [3, -36], [5, -57]];

export function routeDist(x, z) {
  let best = 1e9;
  for (let i = 1; i < ROUTE.length; i++) {
    const a = ROUTE[i - 1];
    const b = ROUTE[i];
    const vx = b[0] - a[0];
    const vz = b[1] - a[1];
    const t = clamp(((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz), 0, 1);
    best = Math.min(best, Math.hypot(x - a[0] - t * vx, z - a[1] - t * vz));
  }
  return best;
}

/** The 16×16 value-noise lattice behind the sky clouds. Must run before buildWorld(). */
export function makeSkyGrid() {
  return Array.from({ length: 256 }, () => rand());
}

/** Where the bounty board stands (new side mission). */
export const BOUNTY_BOARD = { x: 9, z: 34 };

export function buildWorld() {
  const colliders = [];
  const barrels = [];
  const relays = [];
  const signs = [];
  const staticB = new Builder(); // buildings, props, cover: cast and receive shadows
  const groundB = new Builder(); // faceted snow and harbour water: receive only
  const rockB = new Builder(); // mountains, glaciers, ice floes
  const detailB = new Builder(); // ink-only detail lines: cracks, cables, brush

  const collider = (x, z, w, d, h = 4, y = 0) => colliders.push({ x, z, w, d, h, y });

  function sign(text, sub, x, y, z, w, h, ry = 0, bg = '#c27543', fg = '#162c30') {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 256);
    g.strokeStyle = fg;
    g.lineWidth = 12;
    g.strokeRect(10, 10, 1004, 236);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.font = `italic 900 ${text.length > 15 ? 70 : 99}px Arial`;
    g.fillText(text, 512, sub ? 140 : 168, 940);
    if (sub) {
      g.font = 'bold 23px Arial';
      g.fillText(sub, 512, 203, 900);
    }
    g.globalAlpha = 0.22;
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rand() > 0.5 ? '#132b31' : '#f6ecd5';
      g.fillRect(rnd(0, 1024), rnd(0, 256), rnd(1, 75), rnd(1, 3));
    }
    signs.push({ canvas: c, x, y, z, w, h, ry });
  }

  function crate(x, z, w = 2, h = 1.7, d = 2, kind = 0) {
    const c = kind ? C.rust : C.steel;
    staticB.box(x, h / 2, z, w, h, d, c);
    staticB.box(x, h + 0.05, z, w + 0.14, 0.12, d + 0.14, C.snow);
    for (const dx of [-w * 0.35, w * 0.35]) staticB.box(x + dx, h / 2, z, w * 0.08, h + 0.06, d + 0.03, C.dark);
    staticB.box(x, h * 0.5, z + d * 0.5 + 0.025, w * 0.7, 0.13, 0.04, C.paper, 0, 0.5);
    collider(x, z, w, d, h);
  }

  function building(x, z, w, d, h, col, roof = 1) {
    staticB.box(x, h / 2, z, w, h, d, col);
    collider(x, z, w, d, h);
    staticB.box(x, h + 0.12, z, w + 0.7, 0.3, d + 0.7, C.dark);
    staticB.box(x, h + 0.34, z, w + 0.95, 0.24, d + 0.8, C.snow);
    for (let i = -w / 2 + 0.55; i < w / 2; i += 0.65) staticB.box(x + i, h * 0.5, z + d / 2 + 0.04, 0.07, h - 0.25, 0.1, col.map((v) => v * 0.78), 0, 0, 0, false);
    for (const side of [-1, 1]) {
      staticB.box(x + (side * w) / 2, h / 2, z, 0.17, h + 0.3, d + 0.15, C.dark);
      for (let dz = -d / 2 + 1; dz < d / 2; dz += 1) staticB.box(x + side * (w / 2 + 0.03), h / 2, z + dz, 0.08, h - 0.2, 0.045, col.map((v) => v * 0.8), 0, 0, 0, false);
    }
    staticB.box(x - w * 0.24, 1.55, z + d / 2 + 0.1, 2, 3.1, 0.15, C.dark);
    staticB.box(x - w * 0.24, 2.9, z + d / 2 + 0.25, 2.4, 0.16, 0.7, C.orange);
    staticB.box(x - w * 0.24 + 0.6, 1.6, z + d / 2 + 0.21, 0.15, 0.15, 0.08, C.yellow);
    for (const dx of [w * 0.06, w * 0.3]) {
      staticB.box(x + dx, h * 0.56, z + d / 2 + 0.11, w * 0.16, 1.4, 0.12, C.ink);
      staticB.box(x + dx, h * 0.56, z + d / 2 + 0.19, w * 0.14, 1.2, 0.05, C.ice);
      staticB.box(x + dx, h * 0.56, z + d / 2 + 0.24, 0.08, 1.2, 0.04, C.dark);
      staticB.box(x + dx, h * 0.56, z + d / 2 + 0.24, w * 0.14, 0.08, 0.04, C.dark);
    }
    if (roof) {
      staticB.box(x - w * 0.22, h + 1, z - d * 0.18, 2, 1.3, 2.8, C.steel);
      staticB.cylinder(x + w * 0.25, h + 2, z - d * 0.25, 0.48, 0.4, 3.7, C.dark, 8);
      staticB.cylinder(x + w * 0.25, h + 3.9, z - d * 0.25, 0.62, 0.62, 0.24, C.rust, 8);
      staticB.box(x + w * 0.23, h + 0.55, z + d * 0.15, 3.3, 0.4, 2, C.snow);
    }
  }

  function cable(a, b, sag = 2) {
    let prev = a;
    for (let i = 1; i <= 18; i++) {
      const t = i / 18;
      const p = V.add(V.mul(a, 1 - t), V.mul(b, t));
      p[1] -= Math.sin(t * Math.PI) * sag;
      detailB.line(prev, p, C.ink);
      prev = p;
    }
  }

  // Faceted ground, with dirt exposed along the route.
  for (let x = -70; x < 70; x += 5)
    for (let z = -80; z < 65; z += 5) {
      const rd = routeDist(x + 2.5, z + 2.5);
      const dirt = color('#b7c8bc');
      const blend = clamp((10 - rd) / 10, 0, 1) * 0.8;
      const base = C.snow.map((v, i) => lerp(v, dirt[i], blend));
      const co = base.map((v) => v * rnd(0.988, 1.01));
      groundB.quad([x, -0.08, z], [x, -0.08, z + 5], [x + 5, -0.08, z + 5], [x + 5, -0.08, z], co);
    }
  // Cut ink-like cracks into the snow and the frozen dock edge.
  for (let i = 0; i < 145; i++) {
    const x = rnd(-43, 43);
    const z = rnd(-60, 48);
    const a = rnd(0, TAU);
    const len = rnd(0.4, 2.6);
    detailB.line([x, -0.055, z], [x + Math.cos(a) * len, -0.055, z + Math.sin(a) * len], color('#789998'));
    if (i % 3 === 0) detailB.line([x + Math.cos(a) * len, -0.055, z + Math.sin(a) * len], [x + Math.cos(a + 0.7) * len * 1.45, -0.055, z + Math.sin(a + 0.7) * len * 1.45], color('#789998'));
  }
  // Distant mountains and razor-edged glaciers enclose the coast.
  for (let i = 0; i < 47; i++) {
    const a = (i * TAU) / 47;
    const r = rnd(105, 148);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r - 10;
    const sz = rnd(15, 29);
    const h = rnd(24, 55);
    rockB.ico(x, h * 0.1 - 6, z, sz, pick([C.deep, color('#73999c'), color('#668f98')]), rnd(0.8, 1.4), h / sz, rnd(0.9, 1.4));
    rockB.ico(x - 1, h * 0.34, z - 1, sz * 0.67, C.snow, rnd(0.9, 1.1), (h / sz) * 0.65, 1);
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 12; i++) {
      const x = side * rnd(49, 62);
      const z = 52 - i * 10;
      const h = rnd(5, 14);
      rockB.ico(x, 1, z, rnd(8, 14), pick([C.ice, C.deep]), 1, h / 9, 1.2, true);
      rockB.ico(x, 3.4, z, rnd(7, 11), C.snow, 1, h / 10, 0.9);
    }
  for (let i = 0; i < 9; i++) {
    const x = -47 + i * 12;
    rockB.ico(x, 1, -72, rnd(8, 12), C.deep, 1, rnd(1, 2), 1.4, true);
    rockB.ico(x, 6, -73, rnd(8, 11), C.snow, 1, 1, 1);
  }
  // Harbor water, huge chunks of blue ice, and a wrecked freighter.
  groundB.box(-74, -1.1, -5, 52, 0.1, 120, color('#447e8b'), 0, 0, 0, false);
  for (let i = 0; i < 28; i++) {
    const x = rnd(-101, -51);
    const z = rnd(-70, 50);
    rockB.ico(x, -0.7, z, rnd(1, 5), C.ice, 1, 0.15, 1.5, true);
  }
  staticB.box(-49, 4, -31, 14, 9, 43, C.rust, -0.12, -0.06);
  staticB.box(-49, 8.9, -31, 14.7, 0.5, 44, C.dark, -0.12, -0.06);
  staticB.box(-49, 9.3, -31, 14.5, 0.25, 43, C.snow, -0.12, -0.06);
  staticB.box(-50, 13, -43, 10, 7, 10, C.paper, -0.12);
  staticB.box(-50, 16.8, -43, 11, 0.5, 11, C.dark, -0.12);
  staticB.box(-50, 17.1, -43, 11, 0.3, 11, C.snow, -0.12);
  for (let i = 0; i < 4; i++) staticB.box(-54 + i * 2.5, 14.4, -37.6, 1.8, 1.5, 0.2, C.deep, -0.12);
  staticB.cylinder(-50, 20, -46, 1.35, 1.15, 9, C.rust, 10);
  staticB.cylinder(-50, 24.6, -46, 1.6, 1.6, 0.7, C.dark, 10);
  staticB.beam([-45, 9, -19], [-45, 27, -19], 0.18, C.dark);
  staticB.beam([-53, 23, -19], [-38, 23, -19], 0.13, C.dark);
  staticB.beam([-45, 26, -19], [-52, 10, -34], 0.04, C.ink);
  staticB.beam([-45, 26, -19], [-42, 9, -7], 0.04, C.ink);
  // Main shanties.
  building(-28, 17, 13, 15, 7.8, C.rust);
  building(26, 29, 14, 14, 7.2, color('#657b76'));
  building(-9, -7, 12, 10, 6.3, color('#92735a'));
  building(30, -14, 13, 16, 9.2, C.rust);
  building(-29, -43, 13, 17, 10, color('#698885'));
  sign('NO REFUNDS', 'AMMO • PARTS • TERRIBLE ADVICE', -28, 6.25, 24.64, 10.5, 2.1, 0, '#e2b54e');
  sign('COLD STORAGE', 'KEEP OUT. STAY OUT.', 26, 5.7, 36.13, 10.4, 2, 0, '#b5c4ad');
  sign('BRINE & SONS', 'WE KEEP WHAT YOU DROP.', 30, 7.2, -5.87, 10.5, 2.1);
  sign('WORK. FREEZE. REPEAT.', 'BRINEBREAK LABOR AUTHORITY', -9, 4.95, -1.86, 10, 1.5, 0, '#c0c8a9');
  // Central gantry. The high silhouette guides the player to the arena.
  for (const x of [-11, 15]) {
    staticB.box(x, 8, -29, 1.5, 16, 2, C.dark);
    staticB.box(x, 1.1, -29, 2.8, 2.2, 3.1, C.orange);
    collider(x, -29, 2.8, 3.1, 16);
    staticB.beam([x - 0.7, 2, -29.9], [x + 0.7, 8, -29.9], 0.12, C.rust);
    staticB.beam([x + 0.7, 8, -29.9], [x - 0.7, 14, -29.9], 0.12, C.rust);
  }
  staticB.box(2, 15, -29, 29, 2.2, 2, C.rust);
  staticB.box(2, 16.25, -29, 29.7, 0.4, 2.7, C.snow);
  sign('BRINEBREAK QUAY', 'WELCOME, REPLACEABLE WORKER.', 2, 14.8, -27.9, 23, 2.35, 0, '#d99b4f');
  for (let x = -10; x < 15; x += 3) staticB.beam([x, 14.1, -28.8], [x + 2.6, 16, -28.8], 0.09, C.dark);
  // Cable pylons and power lines.
  const pylons = [[-17, 28], [15, 7], [-17, -23]];
  for (const [x, z] of pylons) {
    staticB.beam([x, 0, z], [x, 13, z], 0.18, C.dark);
    staticB.box(x, 11.8, z, 4, 0.25, 0.3, C.dark);
    staticB.cylinder(x - 1.5, 12.2, z, 0.15, 0.13, 0.65, C.paper, 6);
    staticB.cylinder(x + 1.5, 12.2, z, 0.15, 0.13, 0.65, C.paper, 6);
  }
  cable([-18.5, 12.5, 28], [13.5, 12.5, 7], 2.5);
  cable([16.5, 12.5, 7], [-15.5, 12.5, -23], 2);
  cable([-18.5, 12.5, -23], [-25, 13, -39], 1);
  // Massive dock crane with suspended container.
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) staticB.beam([33 + dx, 0, -40 + dz], [33 + dx * 0.65, 29, -40 + dz * 0.65], 0.27, C.orange);
  for (let y = 2; y < 29; y += 4) {
    staticB.beam([31.5, y, -38.5], [34.5, y + 4, -38.5], 0.13, C.rust);
    staticB.beam([34.5, y, -41.5], [31.5, y + 4, -41.5], 0.13, C.rust);
    staticB.box(33, y, -40, 3.3, 0.13, 3.3, C.dark);
  }
  staticB.box(33, 29.6, -40, 5, 1.1, 5, C.rust);
  staticB.box(27, 32, -40, 31, 0.45, 2, C.orange, 0, -0.13);
  staticB.box(27, 30, -40, 31, 0.4, 2, C.dark, 0, -0.13);
  for (let x = 12; x < 42; x += 3) staticB.beam([x, 30 + (27 - x) * 0.13, -39], [x + 2.5, 32 + (27 - x - 2.5) * 0.13, -39], 0.1, C.rust);
  staticB.box(35, 27.5, -38, 3, 3, 3, C.paper);
  staticB.box(34.9, 27.8, -36.4, 2.6, 1.5, 0.06, C.deep);
  cable([13, 32, -40], [13, 16, -40], 0);
  staticB.box(13, 14.2, -40, 6, 3.8, 3.4, C.orange);
  for (let i = 0; i < 9; i++) staticB.box(10.4 + i * 0.65, 14.2, -38.25, 0.08, 3.5, 0.08, C.rust);
  staticB.box(13, 16.3, -40, 6.1, 0.25, 3.6, C.snow);
  // Rails, pipes, and heavy equipment.
  for (const x of [20, 24]) staticB.box(x, 0.02, -27, 0.12, 0.12, 58, C.dark);
  for (let z = -52; z < 0; z += 2) staticB.box(22, -0.02, z, 5, 0.13, 0.3, C.steel);
  for (const x of [-37, -34]) staticB.beam([x, 1, -24], [x, 1, -4], 0.55, C.rust, 10);
  for (const [x, z, w, h, d, k] of [[-13, 28, 3, 1.9, 2, 1], [-4, 23, 3, 2, 2, 0], [12, 17, 3, 1.8, 2, 1], [11, 4, 3, 2, 3, 0], [21, -2, 3, 1.6, 2, 1], [-23, -15, 3, 2.4, 3, 0], [-19, -24, 3, 1.8, 2, 1], [0, -23, 4, 2.1, 2, 0], [6, -36, 3, 1.5, 2, 1], [-5, -47, 4, 2, 2, 0], [19, -48, 3, 2, 3, 0], [-22, 1, 2, 2, 2, 0], [37, 3, 3, 1.5, 2, 1]]) crate(x, z, w, h, d, k);
  // Low cover barricades. Bullet rays and movement use the same cover boxes.
  for (const [x, z, w] of [[3, 15, 4], [7, -10, 5], [-7, -29, 4], [0, -41, 4], [14, -52, 4], [-17, 38, 4]]) {
    staticB.box(x, 0.65, z, w, 1.3, 0.65, C.steel, 0, 0);
    staticB.box(x, 1.36, z, w + 0.12, 0.15, 0.8, C.snow);
    collider(x, z, w, 0.65, 1.5);
    for (let dx = -w / 2 + 0.3; dx < w / 2; dx += 0.6) staticB.box(x + dx, 0.65, z + 0.35, 0.19, 0.8, 0.04, C.yellow, 0, -0.5);
  }
  // Wind-torn flags, warning signs, and frozen brush. Flags now have both faces,
  // so they no longer vanish when seen from the other side.
  for (const [x, z] of [[-20, 35], [18, 20], [-20, -29], [25, -53]]) {
    staticB.beam([x, 0, z], [x, 8, z], 0.075, C.dark);
    staticB.tri([x, 7.8, z], [x, 5.5, z], [x + 2.7, 6.3, z + 0.3], C.rust);
    staticB.tri([x, 7.8, z], [x + 2.7, 6.3, z + 0.3], [x, 5.5, z], C.rust);
    staticB.line([x, 5.5, z], [x + 2.7, 6.3, z + 0.3]);
  }
  for (let i = 0; i < 55; i++) {
    const x = rnd(-42, 42);
    const z = rnd(-61, 48);
    if (routeDist(x, z) < 8) continue;
    const h = rnd(0.2, 0.7);
    detailB.line([x, 0, z], [x + 0.15, h, z], C.deep);
    detailB.line([x, 0, z], [x - 0.2, h * 0.7, z + 0.1], C.deep);
    detailB.line([x, 0, z], [x + 0.26, h * 0.6, z - 0.08], C.deep);
  }
  // Relay consoles.
  for (const [i, x, z, label] of [[0, -18, 17, 'DOCK RELAY'], [1, 20, -15, 'YARD RELAY'], [2, -17, -39, 'CRANE RELAY']]) {
    staticB.box(x, 0.2, z, 2.6, 0.4, 2.1, C.dark);
    staticB.box(x, 1.35, z, 1.5, 2.3, 1.05, C.orange);
    staticB.box(x, 2.6, z, 1.9, 0.3, 1.3, C.snow);
    staticB.box(x, 1.8, z + 0.59, 1.15, 0.85, 0.14, C.ink);
    staticB.box(x + 0.48, 1.06, z + 0.64, 0.22, 0.18, 0.1, C.red);
    staticB.box(x - 0.35, 1.07, z + 0.66, 0.4, 0.11, 0.15, C.paper);
    collider(x, z, 1.5, 1.05, 2.7);
    relays.push({ i, x, z, label, on: false });
    sign('POWER ' + (i + 1), 'RESTORE POWER', x, 1.84, z + 0.675, 1, 0.52, 0, '#223d43', '#f8c544');
  }
  // The final lockbox and extraction mast.
  staticB.box(4, 0.25, -54, 4, 0.5, 3, C.dark);
  staticB.box(4, 0.95, -54, 3.1, 1, 1.9, C.orange);
  staticB.box(4, 1.55, -54, 3.4, 0.3, 2.1, C.dark);
  staticB.box(4, 1.04, -52.98, 0.4, 0.55, 0.08, C.yellow);
  for (const x of [2.7, 5.3]) staticB.box(x, 1, -52.99, 0.18, 0.7, 0.07, C.paper);
  collider(4, -54, 3.3, 2, 1.7);
  staticB.beam([3, 0, -61], [3, 11, -61], 0.1, C.steel);
  staticB.box(3, 8.4, -61, 1.4, 2, 0.5, C.orange);
  staticB.ring(3, 0, -59, 3, C.blue);
  sign('OUTBOUND', 'ONE WAY. NO COMPLAINTS.', 3, 6.6, -60.7, 5, 1.2, 0, '#9db9b3');
  // Supply lockers are distinct from combat cover.
  const supplySpots = [{ x: -23, z: 28, open: false, next: 0 }, { x: 33, z: 17, open: false, next: 0 }, { x: -20, z: -18, open: false, next: 0 }, { x: 23, z: -35, open: false, next: 0 }];
  for (const s of supplySpots) {
    staticB.box(s.x, 0.7, s.z, 1.9, 1.4, 1.3, C.dark);
    staticB.box(s.x, 0.8, s.z + 0.7, 1.7, 1.1, 0.09, color('#7aa798'));
    staticB.box(s.x, 1.3, s.z, 2, 0.18, 1.5, C.snow);
    staticB.box(s.x, 0.83, s.z + 0.77, 0.5, 0.15, 0.05, C.paper);
    staticB.box(s.x, 0.83, s.z + 0.78, 0.15, 0.5, 0.05, C.paper);
    collider(s.x, s.z, 1.9, 1.3, 1.4);
  }
  for (const [x, z] of [[-8, 28], [12, 10], [-20, 7], [16, -18], [-19, -31], [11, -42], [-2, -52], [34, 7]]) barrels.push({ x, z, hp: 35, dead: false });

  // ---- Added after the original recipe (no effect on its seeded layout).
  // Solid poles and pipes: the player and enemies used to walk straight through them.
  for (const [x, z] of pylons) collider(x, z, 0.45, 0.45, 13);
  for (const dx of [-1.6, 1.6]) for (const dz of [-1.6, 1.6]) collider(33 + dx, -40 + dz, 0.7, 0.7, 29);
  for (const x of [-37, -34]) collider(x, -14, 1.1, 20, 1.55);

  // The bounty board by the landing (side mission: WANTED — KNUCKLES BRINE).
  const bb = BOUNTY_BOARD;
  for (const dx of [-1.7, 1.7]) staticB.box(bb.x + dx, 1.5, bb.z, 0.2, 3, 0.2, C.dark);
  staticB.box(bb.x, 2.15, bb.z, 3.6, 1.7, 0.14, color('#7a5a3c'));
  staticB.box(bb.x, 3.08, bb.z + 0.08, 4, 0.14, 0.7, C.dark);
  staticB.box(bb.x, 3.2, bb.z + 0.08, 4.1, 0.12, 0.72, C.snow);
  staticB.box(bb.x - 1.1, 1.05, bb.z + 0.09, 0.5, 0.36, 0.04, C.paper, 0, 0.12);
  staticB.box(bb.x + 1.2, 1.1, bb.z + 0.09, 0.42, 0.3, 0.04, C.paper, 0, -0.1);
  collider(bb.x, bb.z, 3.8, 0.5, 3.3);
  sign('WANTED', 'KNUCKLES BRINE · $400 · ALIVE OR LESS', bb.x, 2.2, bb.z + 0.08, 3.2, 0.8, 0, '#e6dcb8', '#5b1d14');

  return { staticB, groundB, rockB, detailB, colliders, barrels, relays, supplySpots, signs };
}
