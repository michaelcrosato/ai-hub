// levels.js: the maps. Each level is a grid of 2.8 m cells (floor height, area, hazard,
// ramps), collision boxes, torch positions and one static mesh built with the original
// helpers (pillars, arches, plaques, crates, braziers). Pure JavaScript: no DOM, no three.js.

import { Geo, clamp, makeRng, modelMatrix } from './geo.js';

export const C = 2.8, NX = 35, NZ = 45;
export const wx = (i) => (i - 17) * C;
export const wz = (j) => (j - 30) * C;
const HALF_PI = Math.PI / 2;

/** Floor hazards: atlas tile, glow, damage per tick and tick length. */
export const HAZARDS = {
  acid: { tile: 5, glow: 0.35, damage: 8, every: 0.5, warn: 'TOXIC WASTE · GET TO THE BRIDGE', map: '#445528' },
  lava: { tile: 10, glow: 0.9, damage: 14, every: 0.4, warn: 'MOLTEN SLAG · GET OUT', map: '#6c3a1e' },
};

export function buildLevel(def) {
  const grid = Array.from({ length: NZ }, () => Array(NX).fill(null));
  const solids = [], torches = [], g = new Geo();
  const rnd = makeRng(def.seed);

  const cellOf = (x, z) => {
    const row = grid[Math.floor(z / C + 30.5)];
    return row ? row[Math.floor(x / C + 17.5)] || null : null;
  };
  const cellAt = (x, z) => {
    const i = Math.floor(x / C + 17.5), j = Math.floor(z / C + 30.5);
    return { cell: grid[j]?.[i] || null, i, j };
  };
  const floorAt = (x, z) => {
    const a = cellOf(x, z);
    if (!a) return -20;
    const r = a.ramp;
    if (r) return r.h0 + (r.h1 - r.h0) * clamp((r.dir * ((r.axis === 'x' ? x : z) - r.o)) / r.len, 0, 1);
    return a.h;
  };

  // ---- layout helpers
  const carve = (x1, x2, z1, z2, h, area, extra) => {
    for (let j = z1; j <= z2; j++) for (let i = x1; i <= x2; i++) grid[j][i] = { h, area, kind: 'floor', ...extra };
  };
  const ramp = (x1, x2, z1, z2, r) => {
    for (let j = z1; j <= z2; j++) for (let i = x1; i <= x2; i++) grid[j][i].ramp = r;
  };
  const set = (i, j, props) => Object.assign(grid[j][i], props);
  const clear = (i, j) => (grid[j][i] = null);

  // ---- the original building helpers
  const solid = (x, y, z, w, h, d, kind = 'prop') => {
    const b = { x1: x - w / 2, x2: x + w / 2, y1: y - h / 2, y2: y + h / 2, z1: z - d / 2, z2: z + d / 2, kind };
    solids.push(b);
    return b;
  };
  const block = (x, y, z, w, h, d, t = 0, col = [1, 1, 1], collision = true) => {
    g.box(x, y, z, w, h, d, t, col);
    if (collision) solid(x, y, z, w, h, d);
  };
  const pillar = (x, z, h = 8, floor = 0, r = 0.65) => {
    block(x, floor + 0.18, z, r * 2.6, 0.36, r * 2.6, 0, [0.8, 0.85, 0.72]);
    block(x, floor + h / 2, z, r * 1.6, h, r * 1.6, 0, [0.86, 0.9, 0.78]);
    g.cylinder(x, floor + h - 0.3, z, r * 1.5, 0.6, 2, [0.7, 0.73, 0.59], 8);
    solid(x, floor + h / 2, z, r * 1.65, h, r * 1.65);
    g.box(x, floor + 2.6, z, r * 1.85, 0.3, r * 1.85, 2, [0.65, 0.65, 0.5]);
  };
  const arch = (x, y, z, width, height, depth = 0.8, rot = 0, tile = 0) => {
    const old = g.transform;
    g.transform = modelMatrix(x, y, z, rot, 0, 0, 1, new Float32Array(16));
    const r = width / 2, thick = 0.65, base = height - r;
    g.box(-r - thick / 2, base / 2, 0, thick, base, depth, tile, [0.9, 0.94, 0.8]);
    g.box(r + thick / 2, base / 2, 0, thick, base, depth, tile, [0.9, 0.94, 0.8]);
    for (let i = 0; i < 13; i++) {
      const a = (i / 13) * Math.PI, b = ((i + 1) / 13) * Math.PI;
      const p = (ang, rr, zz) => [Math.cos(ang) * rr, base + Math.sin(ang) * rr, zz];
      const n = [0.83 + (i % 3) * 0.045, 0.86 + (i % 3) * 0.045, 0.72 + (i % 3) * 0.04];
      g.quad(p(a, r, -depth / 2), p(b, r, -depth / 2), p(b, r + thick, -depth / 2), p(a, r + thick, -depth / 2), tile, n);
      g.quad(p(b, r, depth / 2), p(a, r, depth / 2), p(a, r + thick, depth / 2), p(b, r + thick, depth / 2), tile, n);
      g.quad(p(a, r, depth / 2), p(b, r, depth / 2), p(b, r, -depth / 2), p(a, r, -depth / 2), tile, n);
    }
    g.transform = old;
  };
  /** A light source with no fixture (lava pots, glowing machinery). */
  const lamp = (x, y, z) => torches.push([x, y, z]);
  const torch = (x, y, z, type = 'torch') => {
    torches.push([x, y, z]);
    if (type === 'brazier') {
      g.cylinder(x, y - 1.0, z, 0.42, 0.5, 0, [0.8, 0.8, 0.65], 8, 0.3);
      g.cylinder(x, y - 0.57, z, 0.12, 0.6, 2, [0.6, 0.6, 0.48], 8);
      g.cylinder(x, y - 0.24, z, 0.23, 0.3, 2, [0.7, 0.7, 0.6], 8, 0.44);
      g.cylinder(x, y - 0.06, z, 0.39, 0.06, 10, [1, 1, 0.65], 8, 0.39, 1.0);
    } else {
      g.cylinder(x, y - 0.43, z, 0.1, 0.78, 3, [0.6, 0.64, 0.47], 6);
      g.cylinder(x, y - 0.12, z, 0.16, 0.17, 2, [0.8, 0.8, 0.65], 8);
    }
  };
  const crate = (x, z, size = 1.35, h = 0) => {
    const y = floorAt(x, z) + size / 2 + h;
    block(x, y, z, size, size, size, 3, [0.95, 0.98, 0.79]);
    for (const a of [-1, 1]) g.box(x + a * size * 0.4, y, z, size * 0.07, size + 0.025, size + 0.03, 2, [0.7, 0.69, 0.5]);
    g.box(x, y, z, size + 0.04, 0.14, size + 0.04, 2, [0.64, 0.66, 0.5]);
  };
  /** A framed sign or rune. The face is mapped top-down so lettering reads upright (the original drew it upside down). */
  const plaque = (x, y, z, t = 4, rot = 0, w = 1.6, h = 2) => {
    const old = g.transform;
    g.transform = modelMatrix(x, y, z, rot, 0, 0, 1, new Float32Array(16));
    g.box(0, 0, 0, w + 0.25, h + 0.25, 0.15, 2, [0.75, 0.77, 0.62]);
    uprightQuad(g, [-w / 2, -h / 2, 0.09], [w / 2, -h / 2, 0.09], [w / 2, h / 2, 0.09], [-w / 2, h / 2, 0.09], t, [1, 1, 1], 0.15);
    g.transform = old;
  };

  const api = { g, grid, rnd, carve, ramp, set, clear, solid, block, pillar, arch, torch, lamp, crate, plaque, floorAt, cellOf };
  def.layout(api);

  // ---- floors with ramps and hazards; walls only at the outside edge of a room
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const c = grid[j][i];
      if (!c) continue;
      const style = def.style(c);
      const hz = HAZARDS[c.kind];
      const x = wx(i), z = wz(j), a = x - C / 2, b = x + C / 2, f = z - C / 2, e = z + C / 2;
      const h = (px, pz) => (c.ramp ? floorAt(px + (px === b ? -0.0001 : 0.0001), pz + (pz === e ? -0.0001 : 0.0001)) : c.h);
      const tile = hz ? hz.tile : c.kind === 'bridge' ? 2 : style.tile;
      g.quad([a, h(a, e), e], [b, h(b, e), e], [b, h(b, f), f], [a, h(a, f), f], tile, [1, 1, 1], hz ? hz.glow : 0, 1, 1);
      if (c.kind === 'bridge') {
        g.box(x, c.h - 0.27, z, C, 0.48, C, 2, [0.8, 0.82, 0.65]);
        for (const s of [-1, 1]) g.box(x + s * C * 0.48, c.h + 0.16, z, 0.15, 0.3, C, 2, [0.7, 0.75, 0.59]);
      }
      const centerH = floorAt(x, z);
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (grid[j + dj]?.[i + di]) continue;
        const wallH = style.wall;
        const xx = x + (di * C) / 2, zz = z + (dj * C) / 2, ww = di ? 0.55 : C + 0.1, dd = dj ? 0.55 : C + 0.1;
        block(xx, centerH + wallH / 2 - 0.1, zz, ww, wallH + 0.4, dd, 0, [0.93, 0.97, 0.82]);
        g.box(xx, centerH + 0.23, zz, ww + 0.2, 0.46, dd + 0.2, 0, [0.72, 0.78, 0.62]);
        g.box(xx, centerH + wallH - 0.4, zz, ww + 0.27, 0.32, dd + 0.27, 2, [0.7, 0.73, 0.59]);
        g.box(xx, centerH + wallH + 0.25, zz, di ? 0.8 : 1.05, 0.6, dj ? 0.8 : 1.05, 0, [0.85, 0.89, 0.74]);
      }
    }
  }
  def.decorate(api);

  // ---- broad phase: each solid is listed in every cell its footprint touches (one spare cell
  // of margin all round, so boxes reaching past the grid land in the edge buckets). Movement,
  // support and short rays test a handful of boxes instead of all ~330, 120 times a second.
  const GW = NX + 2, GH = NZ + 2;
  const buckets = Array.from({ length: GW * GH }, () => []);
  const gi = (x) => Math.floor(x / C + 17.5) + 1, gj = (z) => Math.floor(z / C + 30.5) + 1;
  const ci = (v, n) => (v < 0 ? 0 : v >= n ? n - 1 : v);
  solids.forEach((b, k) => {
    b.id = k;
    for (let j = ci(gj(b.z1), GH); j <= ci(gj(b.z2), GH); j++) for (let i = ci(gi(b.x1), GW); i <= ci(gi(b.x2), GW); i++) buckets[j * GW + i].push(b);
  });
  const stamp = new Uint32Array(solids.length);
  const near = [];
  let mark = 0;
  /** Every solid whose footprint may overlap [x1, x2] × [z1, z2]. Returns one reused array: don't nest calls. */
  const solidsIn = (x1, z1, x2, z2) => {
    near.length = 0;
    if (++mark > 0xfffffff0) {
      stamp.fill(0);
      mark = 1;
    }
    const i0 = ci(gi(x1), GW), i1 = ci(gi(x2), GW), j0 = ci(gj(z1), GH), j1 = ci(gj(z2), GH);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const list = buckets[j * GW + i];
        for (let n = 0; n < list.length; n++) {
          const b = list[n];
          if (stamp[b.id] !== mark) {
            stamp[b.id] = mark;
            near.push(b);
          }
        }
      }
    }
    return near;
  };

  return { def, index: def.index, grid, solids, solidsIn, torches, geo: g, cellOf, cellAt, floorAt };
}

/** A quad whose texture v runs top-down (signs and runes), with the same winding and normal as quad(). */
export function uprightQuad(g, a, b, c, d, tile, col, glow) {
  g.tri(a, b, c, tile, col, glow, [[0, 1], [1, 1], [1, 0]]);
  g.tri(a, c, d, tile, col, glow, [[0, 1], [1, 0], [0, 0]]);
}

// ============================================================================================
// E1M1 · THE BREACHWORKS (the original map, unchanged)
// ============================================================================================
const E1M1 = {
  index: 0,
  id: 'E1M1',
  name: 'THE BREACHWORKS',
  title: 'The Breachworks',
  line: 'EPISODE 01 · MAP 01',
  // The original generator's state after drawing the texture atlas, so the far silhouettes match.
  seed: 1933904057,
  start: { x: 0, z: wz(40), yaw: 0, area: 'THE APPROACH' },
  menuCam: { x: -7.6, y: 4.5, z: 14.8, tx: 1.8, ty: 5.8, tz: -27.5 },
  switchPos: [wx(29), 2.4, wz(21)],
  portal: { x: 0, y: 5.4, z: wz(3.5) },
  secrets: 2,
  bestKey: 'earthquake-best-',
  card: '03 WEAPONS · 02 SECRETS · 01 WAY OUT',
  labels: [['WEST CRYPT', 5.5, 34.5], ['FOUNDRY', 29.5, 34.5]],
  text: {
    key: 'BRASS KEY',
    keyGot: 'YOU GOT THE BRASS KEY',
    keyHint: 'Find the brass key in the west crypt.',
    power: 'POWER',
    swName: 'REACTOR',
    swHint: 'Activate the reactor in the east foundry.',
    swPrompt: 'ACTIVATE REACTOR',
    swOn: 'REACTOR ONLINE',
    gateHint: 'Use the brass key at the north gate.',
    returnHint: 'Return to the north gate.',
    gatePrompt: 'OPEN NORTH GATE',
    gateOpen: 'THE NORTH GATE OPENS',
    gateNeedsKey: 'THE GATE NEEDS THE BRASS KEY',
    gateNoPower: 'NO POWER · ACTIVATE THE FOUNDRY REACTOR',
    keyRequired: 'BRASS KEY REQUIRED',
    powerRequired: 'REACTOR POWER REQUIRED',
    boss: 'THE GATE WARDEN',
    bossHint: 'Defeat the Gate Warden.',
    bossDown: 'THE WARDEN FALLS\nThe rift is open.',
    exitHint: 'Enter the rift at the north end of the hall.',
    winTitle: 'You made it through.',
    winText: 'The Warden is down. The rift is yours.',
    manual: 'Find the brass key in the west crypt. Start the reactor in the east foundry. Open the north gate, defeat its Warden, and enter the rift.',
  },
  doors: [
    { id: 'gate', x: 0, z: wz(19.5), base: 2.4, rot: 0, blocks: [[16, 19], [17, 19], [18, 19]] },
    { id: 'secret0', secret: 0, x: wx(10.5), z: wz(36), base: 0, rot: HALF_PI, blocks: [[10, 36]] },
    { id: 'secret1', secret: 1, x: wx(30), z: wz(19.5), base: 2.4, rot: 0, blocks: [[30, 19]] },
  ],
  items: [
    ['key', 5, 21, { y: 1.16 }], ['nailgun', 5, 24], ['rocketgun', 29, 21.8, { x: wx(29) + 1.5 }],
    ['health', 16, 39], ['shells', 18, 39], ['armor', 13, 34], ['shells', 21, 33], ['health', 22, 24], ['shells', 12, 25],
    ['health', 3, 27], ['shells', 7, 24], ['health', 7, 31], ['nails', 3, 22], ['shells', 5, 20],
    ['armor', 29, 27], ['nails', 26.8, 25], ['rockets', 31, 31, { y: 5.2 }], ['health', 28, 32], ['rockets', 30, 22], ['nails', 30, 20],
    ['health', 15, 19], ['shells', 19, 19], ['nails', 14, 15], ['rockets', 20, 15], ['health', 11, 11], ['health', 23, 11], ['rockets', 17, 8], ['armor', 17, 17],
    ['mega', 5, 36], ['quad', 7, 36], ['rockets', 29, 18], ['armor', 31, 18, { amount: 100 }], ['nails', 30, 17],
  ],
  enemies: [
    ['guard', 15, 34], ['guard', 20, 33], ['fiend', 13, 27], ['guard', 21, 26], ['guard', 17, 25], ['fiend', 22, 35], ['guard', 7, 27], ['fiend', 3, 30],
    ['guard', 3, 24], ['ogre', 5, 22], ['guard', 7, 20], ['guard', 27, 26], ['ogre', 29, 24], ['fiend', 30, 30], ['guard', 31, 21], ['guard', 27, 20],
    ['guard', 13, 17], ['guard', 21, 17], ['fiend', 16, 14], ['fiend', 19, 12], ['ogre', 12, 10], ['ogre', 22, 10], ['guard', 15, 8], ['boss', 17, 10],
  ],
  layout(a) {
    a.carve(11, 23, 23, 37, 0, 'THE CANAL');
    a.carve(15, 19, 38, 42, 0, 'THE APPROACH');
    a.carve(2, 8, 20, 33, 0, 'WEST CRYPT');
    a.carve(9, 10, 25, 27, 0, 'WEST PASSAGE');
    a.carve(26, 32, 20, 33, 2.4, 'THE FOUNDRY');
    a.carve(24, 25, 25, 27, 0, 'EAST RAMP');
    a.ramp(24, 25, 25, 27, { axis: 'x', o: wx(23.5), dir: 1, len: C * 2, h0: 0, h1: 2.4 });
    a.carve(10, 24, 7, 19, 2.4, 'THE GATE HALL');
    a.carve(16, 18, 20, 22, 0, 'THE ASCENT');
    a.ramp(16, 18, 20, 22, { axis: 'z', o: wz(22.5), dir: -1, len: C * 3, h0: 0, h1: 2.4 });
    a.carve(14, 20, 2, 6, 2.4, 'THE RIFT');
    a.carve(16, 18, 6, 7, 2.4, 'THE RIFT');
    a.carve(4, 8, 35, 37, 0, 'THE FORGOTTEN CACHE', { secret: 0 });
    a.carve(9, 10, 36, 36, 0, 'THE FORGOTTEN CACHE', { secret: 0 });
    a.carve(29, 31, 17, 19, 2.4, 'THE SEALED ARMORY', { secret: 1 });
    a.clear(29, 19);
    a.clear(31, 19);
    for (let j = 29; j <= 31; j++) for (let i = 11; i <= 23; i++) a.set(i, j, i === 17 ? { kind: 'bridge', h: 0.15 } : { kind: 'acid', h: -0.65 });
  },
  style(c) {
    const a = c.area;
    return {
      wall: a.includes('CRYPT') ? 6.4 : a.includes('CACHE') || a.includes('ARMORY') ? 4.8 : a.includes('FOUNDRY') ? 8.8 : a === 'THE GATE HALL' ? 11 : 9.2,
      tile: a.includes('FOUNDRY') || a === 'EAST RAMP' ? 2 : 1,
    };
  },
  decorate(a) {
    const { g, block, solid, pillar, arch, torch, crate, plaque, rnd } = a;
    // Covered rooms contrast with the open canal and ruined gate hall.
    block(wx(5), 6.45, (wz(20) + wz(33)) / 2, C * 7, 0.35, C * 14, 0, [0.57, 0.58, 0.47]);
    block(wx(29), 11.17, (wz(20) + wz(33)) / 2, C * 7, 0.35, C * 14, 2, [0.57, 0.61, 0.49]);
    block(0, 9.15, wz(40), C * 5, 0.3, C * 5, 0, [0.63, 0.65, 0.51]);
    block(wx(6), 4.85, wz(36), C * 5, 0.3, C * 3, 0, [0.55, 0.6, 0.46]);
    block(wx(30), 7.25, wz(18), C * 3, 0.3, C * 3, 2, [0.62, 0.67, 0.51]);
    // Canal bulkheads, a steel bridge, and drain pipes.
    for (const z of [wz(28.5), wz(31.5)]) for (const x of [-10.5, 10.5]) g.box(x, -0.23, z, 18, 0.8, 0.28, 0, [0.6, 0.68, 0.48]);
    for (const x of [-17.7, 17.7]) {
      for (const z of [-2.2, 2.2]) {
        g.cylinder(x, 1.1, z, 0.57, 1.6, 2, [0.6, 0.68, 0.49], 12, 0.57, 0, 'x');
        g.cylinder(x + (x < 0 ? 0.82 : -0.82), 1.1, z, 0.43, 0.06, 13, [0.28, 0.36, 0.22], 12, 0.43, 0, 'x');
      }
    }
    for (const x of [-1.5, 1.5]) for (const z of [-4.5, 4.5]) g.box(x, 0.55, z, 0.24, 1.1, 0.24, 2, [0.66, 0.7, 0.52]);
    // The gatehouse: thick arches, two tall towers and hanging cloth.
    arch(0, 0, wz(37.5), C * 5, 8.6, 1.2);
    arch(0, 2.4, wz(19.5), C * 3, 7.7, 1.2);
    for (const side of [-1, 1]) {
      const x = side * 8.9, z = -29.8;
      block(x, 7.1, z, 5.1, 14.2, 4.4, 0, [0.81, 0.87, 0.72], false);
      g.box(x, 12.5, z, 5.7, 0.55, 5, 2, [0.55, 0.65, 0.48]);
      g.box(x, 15, z, 5.8, 0.6, 5.2, 0, [0.8, 0.84, 0.68]);
      for (let k = -2; k <= 2; k++) g.box(x + k * 1.17, 15.8, z + 2.4, 0.65, 1.4, 0.75, 0, [0.8, 0.83, 0.69]);
      g.box(x, 8.8, z + 2.27, 1.15, 3.3, 0.09, 13, [0.27, 0.3, 0.23]);
      g.box(x, 8.8, z + 2.34, 0.22, 3.3, 0.1, 2, [0.7, 0.7, 0.55]);
      g.box(x, 8.7, z + 2.35, 1.15, 0.22, 0.1, 2, [0.7, 0.7, 0.55]);
      plaque(x, 5.1, z + 2.37, 14, 0, 2.3, 4.3);
      torch(x, 2.7, z + 3, 'brazier');
    }
    plaque(0, 11.3, -29.7, 4, 0, 2.8, 3.4);
    for (const x of [-15, 15]) {
      for (const z of [-15, 12]) {
        pillar(x, z, 8.2, 0, 0.7);
        torch(x + (x < 0 ? 0.85 : -0.85), 3.4, z);
      }
    }
    // Side passages have clear signs. The west crypt holds the brass key.
    arch(wx(10.5), 0, wz(26), C * 3, 5.6, 0.8, HALF_PI);
    arch(wx(23.5), 0, wz(26), C * 3, 5.6, 0.8, HALF_PI);
    plaque(wx(10.5) + 0.32, 5.9, wz(26), 16, HALF_PI, 4.2, 1.2);
    plaque(wx(23.5) - 0.32, 5.9, wz(26), 17, -HALF_PI, 4.2, 1.2);
    for (const j of [23, 28, 32]) {
      for (const i of [3, 7]) {
        pillar(wx(i), wz(j), 5.4, 0, 0.45);
        torch(wx(i) + (i === 3 ? 0.65 : -0.65), 2.8, wz(j));
      }
    }
    for (const j of [22, 26, 30]) g.box(wx(5), 5.9, wz(j), 18.2, 0.75, 0.7, 0, [0.65, 0.71, 0.53]);
    // Crypt sarcophagi provide cover, with a brass-key altar in the far bay.
    for (const j of [25, 29, 32]) {
      block(wx(5), 0.55, wz(j), 2, 1.1, 2.8, 0, [0.76, 0.8, 0.6]);
      g.box(wx(5), 1.18, wz(j), 2.3, 0.24, 3.1, 0, [0.8, 0.82, 0.66]);
    }
    g.cylinder(wx(5), 0.3, wz(21), 1.5, 0.6, 0, [0.79, 0.81, 0.6], 8);
    g.cylinder(wx(5), 0.75, wz(21), 1, 0.35, 2, [0.83, 0.79, 0.52], 8);
    torch(wx(3), 1.8, wz(21), 'brazier');
    torch(wx(7), 1.8, wz(21), 'brazier');
    plaque(wx(5), 3.5, wz(19.5) + 0.3, 4, 0, 2.3, 2.5);
    // Foundry floor, vats, machinery, a raised catwalk and climbable steps.
    for (const j of [23, 29]) {
      for (const i of [27, 31]) {
        const x = wx(i), z = wz(j);
        g.cylinder(x, 4, z, 1.25, 3.2, 2, [0.59, 0.64, 0.49], 12);
        solid(x, 4, z, 2.1, 3.2, 2.1);
        g.cylinder(x, 5.65, z, 1.3, 0.16, 2, [0.85, 0.85, 0.64], 12);
        g.cylinder(x, 5.77, z, 1.12, 0.08, 10, [1, 0.85, 0.7], 12, 1.12, 0.8);
        torch(x, 6, z, 'brazier');
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = wx(29) + i * 0.45, z = wz(31);
      g.box(x, 2.4 + (i + 1) * 0.15, z, 0.48, (i + 1) * 0.3, 2.2, 2, [0.83, 0.89, 0.67]);
      solid(x, 2.4 + (i + 1) * 0.15, z, 0.48, (i + 1) * 0.3, 2.2, 'step');
    }
    block(wx(31), 4.65, wz(31), 4.6, 0.3, 2.2, 2, [0.8, 0.83, 0.64]);
    for (const i of [26, 32]) g.cylinder(wx(i), 8, wz(26), 0.26, 30, 2, [0.65, 0.68, 0.52], 8, 0.26, 0, 'z');
    plaque(wx(29), 5, wz(19.5) + 0.32, 18, 0, 3.5, 1.2);
    torch(wx(26), 4.5, wz(20));
    torch(wx(32), 4.5, wz(20));
    // Gate hall columns and vaulted ribs. The player can circle the final enemy.
    for (const j of [9, 13, 17]) {
      for (const i of [12, 22]) {
        pillar(wx(i), wz(j), 10, 2.4, 0.72);
        torch(wx(i) + (i < 17 ? 1 : -1), 5.2, wz(j));
      }
      arch(0, 6, wz(j), C * 9, 8.0, 0.7);
    }
    for (const x of [-8, 8]) {
      plaque(x, 8, wz(6.5) + 0.31, 14, 0, 2.4, 5.6);
      torch(x, 4.1, wz(8), 'brazier');
    }
    arch(0, 2.4, wz(6.5), C * 5, 8.4, 1.1);
    plaque(0, 12.2, wz(6.5) + 0.2, 4, 0, 2.8, 3.5);
    // Portal dais and a ring in the final chamber.
    g.cylinder(0, 2.55, wz(4), 3, 0.3, 0, [0.78, 0.87, 0.68], 16);
    g.cylinder(0, 2.8, wz(4), 2.5, 0.2, 2, [0.64, 0.78, 0.66], 16);
    g.torus(0, 5.4, wz(3.5), 2.25, 0.32, 2, [0.85, 0.88, 0.67]);
    g.torus(0, 5.4, wz(3.5) + 0.1, 1.94, 0.055, 12, [0.7, 1, 0.9], 1.8);
    for (const s of [-1, 1]) {
      g.box(s * 2.4, 4.2, wz(3.5), 0.8, 3.6, 1, 0, [0.77, 0.85, 0.69]);
      torch(s * 3.9, 4.3, wz(4), 'brazier');
    }
    torch(wx(6), 2.4, wz(35), 'brazier');
    // Small props break up flat surfaces and provide combat cover.
    for (const c of [[wx(13), wz(35), 1.45], [wx(21), wz(35), 1.7], [wx(20), wz(24), 1.4], [wx(13), wz(26), 1.25], [wx(28), wz(27), 1.5], [wx(30), wz(32), 1.3], [wx(7), wz(32), 1.3], [wx(11), wz(16), 1.6], [wx(23), wz(10), 1.5]]) crate(...c);
    crate(wx(13), wz(35), 1.1, 1.45);
    // Far silhouettes frame the open sky, without any image files.
    for (const side of [-1, 1]) {
      for (let j = 0; j < 14; j++) {
        const x = side * (55 + rnd.range(0, 18)), z = -85 + j * 11, y = rnd.range(2, 8), r = rnd.range(7, 14);
        g.cylinder(x, y, z, r, rnd.range(18, 30), 0, [0.24, 0.35, 0.25], 5, 0);
      }
    }
  },
};

// ============================================================================================
// E1M2 · THE SMELTERY (new): through the rift, the furnaces that fed the Breachworks.
// Lava instead of acid, a covered ossuary with the iron key, the bellows up on the east
// side, the Hexers (blinking casters with homing hexes) and the Smelter King.
// ============================================================================================
const E1M2 = {
  index: 1,
  id: 'E1M2',
  name: 'THE SMELTERY',
  title: 'The Smeltery',
  line: 'EPISODE 01 · MAP 02',
  seed: 52981,
  start: { x: 0, z: wz(40.5), yaw: 0, area: 'THE LANDING' },
  menuCam: { x: -6.5, y: 4.2, z: wz(31.6), tx: 2, ty: 6.2, tz: wz(18.5) },
  switchPos: [wx(31), 2.4, wz(16)],
  portal: { x: 0, y: 5.4, z: wz(2.5) },
  secrets: 2,
  bestKey: 'earthquake-best-e1m2-',
  card: 'NEW FOE: HEXERS · 02 SECRETS · 01 WAY OUT',
  labels: [['OSSUARY', 4, 26], ['BELLOWS', 31, 34], ['CRUCIBLE', 17, 20.2]],
  text: {
    key: 'IRON KEY',
    keyGot: 'YOU GOT THE IRON KEY',
    keyHint: 'Find the iron key in the west ossuary.',
    power: 'HEAT',
    swName: 'BELLOWS',
    swHint: 'Start the bellows in the east smelter.',
    swPrompt: 'START THE BELLOWS',
    swOn: 'BELLOWS ROARING',
    gateHint: 'Use the iron key at the crucible gate.',
    returnHint: 'Return to the crucible gate.',
    gatePrompt: 'OPEN CRUCIBLE GATE',
    gateOpen: 'THE CRUCIBLE GATE OPENS',
    gateNeedsKey: 'THE GATE NEEDS THE IRON KEY',
    gateNoPower: 'NO HEAT · START THE BELLOWS',
    keyRequired: 'IRON KEY REQUIRED',
    powerRequired: 'BELLOWS HEAT REQUIRED',
    boss: 'THE SMELTER KING',
    bossHint: 'Defeat the Smelter King.',
    bossDown: 'THE KING IS SLAG\nThe last rift is open.',
    exitHint: 'Enter the rift beyond the crucible.',
    winTitle: 'The furnaces are cold.',
    winText: 'The Smelter King is slag. The breach closes behind you.',
    manual: 'Find the iron key in the west ossuary. Start the bellows in the east smelter. Open the crucible gate, defeat the Smelter King, and enter the last rift. Hexers blink away when hurt and throw hexes that follow you: break line of sight or outrun them.',
  },
  doors: [
    { id: 'gate', x: 0, z: wz(18.5), base: 2.4, rot: 0, blocks: [[16, 18], [17, 18], [18, 18]] },
    { id: 'secret0', secret: 0, x: wx(20.5), z: wz(39), base: 0, rot: -HALF_PI, blocks: [[21, 39]] },
    { id: 'secret1', secret: 1, x: wx(30), z: wz(13.5), base: 2.4, rot: 0, blocks: [[30, 13]] },
  ],
  items: [
    // The landing and the slag yard.
    ['health', 15, 39], ['shells', 19, 39], ['armor', 17, 35],
    // The cistern.
    ['nailgun', 10, 31], ['shells', 24, 31], ['nails', 13, 32], ['health', 24, 28], ['rockets', 10, 28],
    ['health', 24, 23], ['nails', 10, 24], ['shells', 20, 22], ['armor', 14, 22],
    // The ossuary and its iron key.
    ['key', 4, 11, { y: 1.16 }], ['health', 2, 23], ['shells', 6, 19], ['nails', 2, 15], ['armor', 6, 12], ['health', 6, 22],
    // The bellows, with the rocket launcher up on the catwalk.
    ['rocketgun', 31.3, 31, { y: 5.2 }], ['rockets', 30.4, 31, { y: 5.2 }], ['health', 30.5, 25], ['shells', 33, 24], ['nails', 33, 18],
    ['rockets', 28, 21], ['health', 29, 15], ['shells', 32, 15],
    // The crucible.
    ['health', 14, 17], ['health', 20, 17], ['shells', 10, 6], ['nails', 24, 6], ['rockets', 17, 16], ['armor', 17, 6], ['rockets', 10, 15], ['health', 24, 15],
    // Secrets: the cinder vault and the quench cellar.
    ['mega', 23, 40], ['rockets', 24, 39], ['shells', 24, 41], ['quad', 30, 11], ['armor', 31, 11, { amount: 100 }], ['rockets', 32, 11],
  ],
  enemies: [
    ['guard', 16, 34], ['guard', 18, 34],
    ['guard', 12, 30], ['fiend', 21, 31], ['guard', 20, 29], ['hexer', 14, 28], ['ogre', 13, 24], ['guard', 11, 25], ['fiend', 22, 24],
    ['hexer', 4, 21], ['fiend', 3, 17], ['guard', 6, 15], ['hexer', 3, 13], ['guard', 5, 23],
    ['guard', 29, 29], ['guard', 33, 27], ['ogre', 30, 23], ['hexer', 32, 19], ['fiend', 29, 17], ['guard', 32, 30],
    ['boss2', 17, 8], ['ogre', 12, 16], ['ogre', 22, 16], ['hexer', 10, 11], ['hexer', 24, 11], ['fiend', 15, 13], ['fiend', 19, 13], ['guard', 15, 6], ['guard', 19, 6],
  ],
  layout(a) {
    a.carve(14, 20, 37, 42, 0, 'THE LANDING');
    a.carve(15, 19, 33, 36, 0, 'THE SLAG YARD');
    a.carve(9, 25, 22, 32, 0, 'THE CISTERN');
    a.carve(8, 8, 22, 24, 0, 'THE WEST CULVERT');
    a.carve(1, 7, 10, 24, 0, 'THE OSSUARY');
    a.carve(26, 27, 28, 30, 0, 'THE EAST RAMP');
    a.ramp(26, 27, 28, 30, { axis: 'x', o: wx(25.5), dir: 1, len: C * 2, h0: 0, h1: 2.4 });
    a.carve(28, 33, 14, 32, 2.4, 'THE BELLOWS');
    a.carve(16, 18, 19, 21, 0, 'THE ASCENT');
    a.ramp(16, 18, 19, 21, { axis: 'z', o: wz(21.5), dir: -1, len: C * 3, h0: 0, h1: 2.4 });
    a.carve(9, 25, 5, 18, 2.4, 'THE CRUCIBLE');
    a.carve(15, 19, 1, 4, 2.4, 'THE LAST RIFT');
    a.carve(22, 25, 38, 41, 0, 'THE CINDER VAULT', { secret: 0 });
    a.carve(21, 21, 39, 39, 0, 'THE CINDER VAULT', { secret: 0 });
    a.carve(29, 32, 10, 13, 2.4, 'THE QUENCH CELLAR', { secret: 1 });
    a.clear(29, 13);
    a.clear(31, 13);
    a.clear(32, 13);
    // A slag trench across the cistern with two bridges, and two lava pools in the crucible.
    for (let j = 26; j <= 27; j++) for (let i = 9; i <= 25; i++) a.set(i, j, i === 12 || i === 22 ? { kind: 'bridge', h: 0.15 } : { kind: 'lava', h: -0.65 });
    for (let j = 9; j <= 14; j++) for (const i of [11, 12, 13, 21, 22, 23]) a.set(i, j, { kind: 'lava', h: 2.4 - 0.65 });
  },
  style(c) {
    const a = c.area;
    return {
      wall: a === 'THE OSSUARY' ? 6.4 : a.includes('VAULT') || a.includes('CELLAR') ? 4.8 : a === 'THE BELLOWS' ? 8.8 : a === 'THE CRUCIBLE' ? 11 : 9.2,
      tile: a === 'THE BELLOWS' || a === 'THE EAST RAMP' || a.includes('CELLAR') || a === 'THE CRUCIBLE' ? 2 : 1,
    };
  },
  decorate(a) {
    const { g, block, solid, pillar, arch, torch, lamp, crate, plaque, rnd } = a;
    // Roofs over the ossuary, the bellows and both secret rooms.
    block(wx(4), 6.45, (wz(10) + wz(24)) / 2, C * 7, 0.35, C * 15, 0, [0.57, 0.58, 0.47]);
    block(wx(30.5), 11.17, (wz(14) + wz(32)) / 2, C * 6, 0.35, C * 19, 2, [0.57, 0.61, 0.49]);
    block(wx(23.5), 4.85, wz(39.5), C * 4, 0.3, C * 4, 0, [0.55, 0.6, 0.46]);
    block(wx(30.5), 7.25, wz(11.5), C * 4, 0.3, C * 4, 2, [0.62, 0.67, 0.51]);

    // The landing: the dimmed rift you came through, under a broken lintel.
    g.torus(0, 4.6, wz(42) + 0.95, 2.0, 0.28, 2, [0.8, 0.84, 0.66]);
    g.torus(0, 4.6, wz(42) + 0.88, 1.72, 0.05, 12, [0.7, 1, 0.9], 0.8);
    g.disc(0, 4.6, wz(42) + 0.9, 1.7, 24, 6, [0.32, 0.5, 0.42], 0.25);
    for (const s of [-1, 1]) {
      g.box(s * 2.25, 2.7, wz(42) + 1.0, 0.7, 5.4, 0.8, 0, [0.77, 0.85, 0.69]);
      torch(s * 4.6, 1.25, wz(41.2), 'brazier');
    }
    arch(0, 0, wz(36.5), C * 5, 8.6, 1.2);
    plaque(0, 8.4, wz(36.5) + 0.62, 23, 0, 3.6, 1.3);
    for (const x of [wx(14), wx(20)]) torch(x + (x < 0 ? 0.7 : -0.7), 3.2, wz(38.5));
    // The slag yard: stacked crates and slag carts.
    crate(wx(15), wz(33.6), 1.4);
    crate(wx(19), wz(35.5), 1.3);
    crate(wx(19), wz(35.5), 1.0, 1.3);
    for (const x of [wx(15) - 0.2, wx(19) + 0.2]) {
      g.box(x, 0.65, wz(34.8), 1.3, 0.7, 1.7, 8, [0.85, 0.7, 0.55]);
      g.box(x, 1.02, wz(34.8), 1.15, 0.06, 1.55, 10, [1, 0.8, 0.6], 0.7);
      for (const dz of [-0.6, 0.6]) g.cylinder(x, 0.22, wz(34.8) + dz, 0.22, 1.5, 13, [0.7, 0.7, 0.6], 8, 0.22, 0, 'x');
    }
    // Low carts are hip-high: solid, so they are cover rather than decoration.
    solid(wx(15) - 0.2, 0.55, wz(34.8), 1.3, 1.1, 1.7);
    solid(wx(19) + 0.2, 0.55, wz(34.8), 1.3, 1.1, 1.7);

    // The cistern: columns, a slag trench with two bridges, pipes pouring slag, a smelt pot.
    for (const [i, j] of [[11, 23], [23, 23], [11, 31], [23, 31]]) {
      pillar(wx(i), wz(j), 8.2, 0, 0.7);
      torch(wx(i) + (i < 17 ? 0.85 : -0.85), 3.4, wz(j));
    }
    for (const z of [wz(25.5), wz(27.5)]) {
      for (const [x, w] of [[-19.6, 8.4], [0, 25.2], [19.6, 8.4]]) g.box(x, -0.23, z, w, 0.8, 0.28, 0, [0.62, 0.6, 0.48]);
    }
    for (const x of [-23.25, 23.25]) {
      for (const z of [wz(26), wz(27)]) {
        g.cylinder(x, 1.0, z, 0.5, 1.4, 2, [0.6, 0.64, 0.49], 12, 0.5, 0, 'x');
        g.cylinder(x + (x < 0 ? 0.72 : -0.72), 1.0, z, 0.38, 0.06, 10, [1, 0.75, 0.55], 12, 0.38, 0.9, 'x');
      }
    }
    {
      const x = wx(17), z = wz(30);
      g.cylinder(x, 1.15, z, 1.35, 2.3, 8, [0.75, 0.62, 0.5], 14, 1.6);
      g.cylinder(x, 2.33, z, 1.7, 0.12, 2, [0.85, 0.85, 0.64], 14);
      g.cylinder(x, 2.36, z, 1.45, 0.08, 10, [1, 0.85, 0.7], 14, 1.45, 0.9);
      solid(x, 1.15, z, 2.7, 2.3, 2.7);
      for (const s of [-1, 1]) g.cylinder(x + s * 1.2, 6.2, z, 0.07, 7.6, 2, [0.6, 0.6, 0.5], 5);
      lamp(x, 3.0, z);
    }
    crate(wx(10), wz(29.5), 1.4);
    crate(wx(24), wz(29.8), 1.5);
    crate(wx(24.2), wz(24.5), 1.3);
    crate(wx(10), wz(22.2), 1.2);
    crate(wx(10), wz(22.2), 0.9, 1.2);
    // Passages: the culvert to the ossuary, the ramp to the bellows, both signed.
    arch(wx(8.5), 0, wz(23), C * 3, 5.6, 0.8, HALF_PI);
    plaque(wx(8.5) + 0.32, 5.9, wz(23), 20, HALF_PI, 4.2, 1.2);
    arch(wx(25.5), 0, wz(29), C * 3, 5.6, 0.8, HALF_PI);
    plaque(wx(25.5) - 0.32, 5.9, wz(29), 21, -HALF_PI, 4.2, 1.2);

    // The gatehouse: two pylons and the crucible sign over the gate.
    arch(0, 2.4, wz(18.5), C * 3, 7.7, 1.2);
    plaque(0, 11.2, wz(18.5) + 0.75, 22, 0, 4.0, 1.3);
    for (const side of [-1, 1]) {
      const x = side * 6.35, z = wz(20);
      block(x, 7.0, z, 3.6, 14, 7.5, 0, [0.81, 0.87, 0.72], false);
      g.box(x, 12.4, z, 4.1, 0.5, 8, 2, [0.55, 0.62, 0.48]);
      for (let k = -2; k <= 2; k++) g.box(x, 14.4, z + k * 1.55, 1.0, 1.2, 0.7, 0, [0.8, 0.83, 0.69]);
      g.box(x, 8.5, z + 3.78, 1.15, 3.3, 0.09, 13, [0.32, 0.22, 0.18]);
      plaque(x, 5.2, z + 3.8, 14, 0, 2.0, 3.6);
      torch(x - side * 2.35, 1.25, wz(22.6), 'brazier');
    }

    // The ossuary: low vault, bone niches, sarcophagi and the iron-key altar.
    for (const j of [13, 17, 21]) {
      for (const i of [2, 6]) {
        pillar(wx(i), wz(j), 5.4, 0, 0.45);
        torch(wx(i) + (i === 2 ? 0.65 : -0.65), 2.8, wz(j));
      }
    }
    for (const j of [12, 16, 20]) g.box(wx(4), 5.9, wz(j), 18.2, 0.75, 0.7, 0, [0.65, 0.71, 0.53]);
    for (const j of [15, 19]) {
      block(wx(4), 0.55, wz(j), 2, 1.1, 2.8, 0, [0.76, 0.8, 0.6]);
      g.box(wx(4), 1.18, wz(j), 2.3, 0.24, 3.1, 0, [0.8, 0.82, 0.66]);
    }
    g.cylinder(wx(4), 0.3, wz(11), 1.5, 0.6, 0, [0.79, 0.81, 0.6], 8);
    g.cylinder(wx(4), 0.75, wz(11), 1, 0.35, 2, [0.83, 0.79, 0.52], 8);
    torch(wx(2), 1.25, wz(11), 'brazier');
    torch(wx(6), 1.25, wz(11), 'brazier');
    plaque(wx(4), 3.5, wz(9.5) + 0.3, 4, 0, 2.3, 2.5);
    // Skull piles along the walls (decoration only).
    for (const [i, j] of [[1, 14], [1, 18], [7, 15], [7, 19], [1, 22], [3, 24]]) {
      const x = wx(i) + (i === 1 ? -0.7 : i === 7 ? 0.7 : 0), z = wz(j) + (j === 24 ? 0.7 : 0);
      for (let k = 0; k < 4; k++) g.sphere(x + ((k % 2) - 0.5) * 0.36, 0.17 + (k > 1 ? 0.28 : 0), z + (k === 3 ? 0.18 : -0.1), 0.17, 15, [0.95, 0.92, 0.78]);
    }

    // The bellows: vats with molten tops, the valve, overhead pipes and a catwalk.
    for (const j of [20, 26]) {
      for (const i of [29, 32]) {
        const x = wx(i), z = wz(j);
        g.cylinder(x, 4, z, 1.25, 3.2, 8, [0.8, 0.66, 0.55], 12);
        solid(x, 4, z, 2.1, 3.2, 2.1);
        g.cylinder(x, 5.65, z, 1.3, 0.16, 2, [0.85, 0.85, 0.64], 12);
        g.cylinder(x, 5.77, z, 1.12, 0.08, 10, [1, 0.85, 0.7], 12, 1.12, 0.9);
        for (const s of [-1, 1]) g.box(x + s * 1.05, 6.6, z, 0.18, 1.7, 0.18, 2, [0.7, 0.7, 0.55]);
        torch(x, 6, z, 'brazier');
      }
    }
    for (let i = 0; i < 8; i++) {
      const x = wx(29) + i * 0.45, z = wz(31);
      g.box(x, 2.4 + (i + 1) * 0.15, z, 0.48, (i + 1) * 0.3, 2.2, 2, [0.83, 0.89, 0.67]);
      solid(x, 2.4 + (i + 1) * 0.15, z, 0.48, (i + 1) * 0.3, 2.2, 'step');
    }
    block(wx(31), 4.65, wz(31), 4.6, 0.3, 2.2, 2, [0.8, 0.83, 0.64]);
    for (const i of [28.6, 32.6]) g.cylinder(wx(i), 8.4, wz(23), 0.26, 50, 2, [0.65, 0.68, 0.52], 8, 0.26, 0, 'z');
    // The valve sign sits beside the quench-cellar slab, clear of it when the slab rises.
    plaque(wx(31.6), 5.4, wz(13.5) + 0.32, 24, 0, 3.0, 1.2);
    torch(wx(28), 4.6, wz(14.2));
    torch(wx(33), 4.6, wz(14.2));
    torch(wx(28), 4.6, wz(32));
    torch(wx(33), 4.6, wz(32));
    crate(wx(33), wz(22.2), 1.4);
    crate(wx(28), wz(17.4), 1.3);

    // The crucible: columns, rims around the lava pools, the great crucible and the last rift.
    for (const [i, j] of [[10, 7], [24, 7], [10, 17], [24, 17]]) {
      pillar(wx(i), wz(j), 10, 2.4, 0.72);
      torch(wx(i) + (i < 17 ? 1 : -1), 5.2, wz(j));
    }
    for (const x0 of [wx(12), wx(22)]) {
      for (const z of [wz(8.5), wz(14.5)]) g.box(x0, 2.17, z, C * 3 + 0.28, 0.8, 0.28, 0, [0.62, 0.6, 0.48]);
      for (const dx of [-1, 1]) g.box(x0 + dx * C * 1.5, 2.17, wz(11.5), 0.28, 0.8, C * 6, 0, [0.62, 0.6, 0.48]);
      lamp(x0, 2.6, wz(11.5));
    }
    {
      const x = 0, z = wz(12);
      g.cylinder(x, 3.8, z, 1.9, 2.8, 8, [0.72, 0.6, 0.5], 14, 2.3);
      g.cylinder(x, 5.22, z, 2.38, 0.14, 2, [0.85, 0.85, 0.64], 14);
      g.cylinder(x, 5.25, z, 2.15, 0.08, 10, [1, 0.85, 0.7], 14, 2.15, 0.95);
      solid(x, 3.8, z, 3.5, 2.8, 3.5);
      for (const s of [-1, 1]) g.cylinder(x + s * 2.0, 9.6, z, 0.09, 8.6, 2, [0.6, 0.6, 0.5], 5);
      lamp(x, 6.0, z);
    }
    for (const x of [-8, 8]) {
      plaque(x, 8, wz(4.5) + 0.31, 14, 0, 2.4, 5.6);
      torch(x, 3.65, wz(6), 'brazier');
    }
    arch(0, 2.4, wz(4.5), C * 5, 8.4, 1.1);
    g.cylinder(0, 2.55, wz(3), 3, 0.3, 0, [0.78, 0.87, 0.68], 16);
    g.cylinder(0, 2.8, wz(3), 2.5, 0.2, 2, [0.64, 0.78, 0.66], 16);
    g.torus(0, 5.4, wz(2.5), 2.25, 0.32, 2, [0.85, 0.88, 0.67]);
    g.torus(0, 5.4, wz(2.5) + 0.1, 1.94, 0.055, 12, [0.7, 1, 0.9], 1.8);
    for (const s of [-1, 1]) {
      g.box(s * 2.4, 4.2, wz(2.5), 0.8, 3.6, 1, 0, [0.77, 0.85, 0.69]);
      torch(s * 3.9, 3.65, wz(3), 'brazier');
    }

    // Secret rooms: braziers so they read as rewards when they open.
    torch(wx(24.6), 1.25, wz(38.4), 'brazier');
    torch(wx(31.6), 3.65, wz(10.4), 'brazier');
    // Far silhouettes frame the open sky.
    for (const side of [-1, 1]) {
      for (let j = 0; j < 14; j++) {
        const x = side * (55 + rnd.range(0, 18)), z = -88 + j * 11, y = rnd.range(2, 8), r = rnd.range(7, 14);
        g.cylinder(x, y, z, r, rnd.range(18, 30), 0, [0.3, 0.27, 0.22], 5, 0);
      }
    }
  },
};

export const LEVELS = [E1M1, E1M2];
