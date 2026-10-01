/**
 * world.js — the island and everything on it, as Geo data (no DOM, no
 * three.js). The trail, jungle, ruins and chasms come from the original
 * createWorld(), now driven by a level description (levels.js) so a second
 * trail can reuse the same builders. Level 1 consumes the random sequence in
 * the original order, so Temple Tumble grows exactly as it always has.
 *
 * World units are metres. Forward progress is -Z (a trail position s sits at z = -s).
 */

import { Geo, G, rgb, TAU, rand, range, setSeed, BOX, BALL, CONE, CYL, LEAF, staticBox, staticRock } from './geo.js';

export const C = {
  sand: 0xd4a66a, sandLight: 0xe5bd7a, earth: 0x865338, leaf: 0x357b42, lime: 0x86ad49, dark: 0x153b32,
  stone: 0x778b6c, stoneLight: 0xa1af80, wood: 0x805637, orange: 0xf18829, cream: 0xffdda1, shoe: 0xc9493c,
  shorts: 0x3c648c, teal: 0x4cbcaf,
};

/* ------------------------------------------------------------ scenery builders */

function addPlant(g, x, s, scale = 1, type = 0) {
  const p = [x, 0.02, -s], a = range(0, TAU);
  if (type === 1) {
    for (let j = 0; j < 9; j++) {
      const ang = a + (j * TAU) / 9, sc = scale * range(0.7, 1.2);
      g.add(LEAF, p, [-0.32, ang, 0], [sc * 0.7, sc * 1.8, sc * 1.4], rgb(j % 2 ? 0x2f7b42 : 0x7ba645));
      for (let k = 0; k < 4; k++) {
        const d = 0.3 + k * 0.25, px = x - Math.sin(ang) * d * sc, pz = -s - Math.cos(ang) * d * sc;
        g.add(LEAF, [px, 0.3 * sc, pz], [0.1, ang + (k % 2 ? 0.7 : -0.7), 0], [sc * 0.35, sc * 0.6, sc * 0.6], rgb(0x4e913d));
      }
    }
  } else {
    for (let j = 0; j < 7; j++)
      g.add(LEAF, p, [-0.5 - range(0, 0.45), a + (j * TAU) / 7, range(-0.3, 0.3)], [scale * range(0.7, 1.1), scale * 1.4, scale * range(0.8, 1.5)], rgb(j % 2 ? 0x488d43 : 0x81a84b));
  }
  if (rand() < 0.23) {
    g.add(CONE, [x, scale * 0.9, -s], [0, 0, 0], [0.18, 0.7, 0.18], rgb(0xe96942));
    g.add(CONE, [x + 0.18, scale * 0.7, -s + 0.12], [0, 0, 0.3], [0.15, 0.6, 0.15], rgb(0xffb556));
  }
}

function palm(g, x, s, height = 9) {
  const lean = range(-1.6, 1.6), zlean = range(-0.7, 0.7), n = 9;
  for (let j = 0; j < n; j++) {
    const f = (j + 0.5) / n, r = 0.5 - f * 0.23;
    g.add(G.cone(r * 1.04, r * 0.97, height / n, 7), [x + lean * f * f, height * f, -s + zlean * f * f], [0, 0, -lean / height], [1, 1, 1], rgb(j % 2 ? 0x876447 : 0x735039));
  }
  const top = [x + lean, height, -s + zlean], offset = range(0, TAU);
  for (let j = 0; j < 9; j++) {
    const a = offset + (j * TAU) / 9;
    g.add(LEAF, top, [0.18 + rand() * 0.18, a, range(-0.12, 0.12)], [1.4, 1.3, 3.4], rgb(j % 3 === 0 ? 0x85a948 : j % 3 === 1 ? 0x357342 : 0x4e903e));
    for (let k = 1; k <= 4; k++) {
      const d = k * 0.72;
      for (const side of [-1, 1])
        g.add(LEAF, [top[0] - Math.sin(a) * d, top[1] + 0.45 - Math.pow(d / 4, 2) * 0.8, top[2] - Math.cos(a) * d], [0.25, a + side * 0.77, 0], [0.75, 0.65, 1.0 - k * 0.09], rgb(k % 2 ? 0x4d8840 : 0x729d41));
    }
  }
  for (let j = 0; j < 3; j++) g.add(BALL, [top[0] + Math.cos(j * 2) * 0.4, top[1] - 0.2, top[2] + Math.sin(j * 2) * 0.4], [0, 0, 0], [0.28, 0.32, 0.28], rgb(0x6b492e));
}

function broadTree(g, x, s, h = 10) {
  const lean = range(-0.4, 0.4);
  g.add(G.cone(0.75, 0.36, h, 7), [x, h / 2, -s], [0, 0, lean * 0.15], [1, 1, 1], rgb(0x655344));
  for (let j = 0; j < 4; j++) {
    const a = j * 1.57 + lean;
    g.add(G.cone(0.22, 0.04, 3, 5), [x + Math.cos(a) * 1.3, 1, -s + Math.sin(a) * 1.3], [Math.sin(a) * 1.1, 0, Math.cos(a) * 1.1], [1, 1, 1], rgb(0x655344));
  }
  for (let j = 0; j < 5; j++) staticRock(g, [x + Math.cos(j * 1.3) * 2, h + range(-0.5, 1.8), -s + Math.sin(j * 1.3) * 2], [3.0, 2.0, 2.8], j % 2 ? 0x2d6540 : 0x417945);
  for (let j = 0; j < 3; j++) {
    const vx = x + range(-2, 2), vz = -s + range(-2, 2);
    g.add(CYL, [vx, h - 2.5, vz], [0, 0, range(-0.1, 0.1)], [0.045, 5, 0.045], rgb(0x477742));
  }
}

export function totem(g, x, s, h = 4) {
  staticBox(g, [x, 0.2, -s], [1.8, 0.4, 1.7], 0x576c55);
  staticBox(g, [x, h / 2 + 0.4, -s], [1.15, h, 1.0], 0x718571);
  staticBox(g, [x, h + 0.45, -s], [1.6, 0.32, 1.4], 0x9ca77c);
  for (let i = 0; i < 2; i++) {
    const y = 1.3 + i * 1.5;
    staticBox(g, [x, y, -s + 0.54], [0.8, 0.18, 0.12], 0x283f37);
    for (const a of [-1, 1]) {
      staticBox(g, [x + a * 0.28, y + 0.42, -s + 0.56], [0.28, 0.28, 0.14], 0x2c4740, [0, 0, a * 0.2]);
      staticBox(g, [x + a * 0.28, y + 0.47, -s + 0.65], [0.1, 0.1, 0.025], 0xe8b04a);
    }
    staticRock(g, [x, y + 0.17, -s + 0.66], [0.19, 0.23, 0.17], 0xa9ad82);
  }
  for (let j = 0; j < 5; j++) g.add(LEAF, [x, 0.7 + h, -s], [-0.7, (j * TAU) / 5, 0], [0.7, 1, 0.7], rgb(0x759747));
}

/** A stone arch over the trail. Its roof is a separate Geo so it can fade when the camera passes under it. */
function arch(g, roofs, s, wide = 5.5, x0 = 0) {
  for (const x of [-wide, wide]) {
    for (let j = 0; j < 5; j++) staticBox(g, [x0 + x, j * 0.85 + 0.42, -s], [1.6, 0.78, 1.8], j % 2 ? 0x768975 : 0x87947b, [0, (j % 2) * 0.015, 0]);
    staticBox(g, [x0 + x, 4.5, -s], [2.1, 0.5, 2.1], C.stoneLight);
    addPlant(g, x0 + x, s, 1.3);
  }
  const roof = new Geo(2048);
  staticBox(roof, [x0, 5.1, -s], [wide * 2 + 2, 0.85, 2.2], 0x829271);
  for (let i = -4; i < 5; i++) staticBox(roof, [x0 + i * 1.1, 5.1, -s + 1.12], [0.55, 0.4, 0.05], 0x4e6859);
  staticRock(roof, [x0, 5.9, -s], [1.5, 0.6, 1.2], C.stoneLight);
  roofs.push({ geo: roof, s });
  totem(g, x0 - wide, s + 0.6, 3);
  totem(g, x0 + wide, s + 0.6, 3);
}

/** The stepped temple at the end of a trail, behind the guardian (S = the guardian's position). */
function temple(g, S, sun = false) {
  for (let j = 0; j < 5; j++) staticBox(g, [0, j * 0.72, -(S + 22) - j * 0.6], [16 - j * 1.4, 0.75, 10 - j * 0.5], j % 2 ? 0x607967 : 0x7d8d72);
  for (const side of [-1, 1]) {
    totem(g, side * 4.1, S + 12, 5.5);
    for (let j = 0; j < 6; j++) staticBox(g, [side * 6.1, j * 0.65, -(S + 18)], [2.6, 0.61, 3], 0x7f9279);
  }
  staticBox(g, [0, 5.3, -(S + 18)], [13, 1.15, 3], 0x839977);
  staticBox(g, [0, 6.1, -(S + 18)], [9, 0.55, 2.6], 0xa2ae83);
  totem(g, 0, S + 19, 5.7);
  if (sun) {
    // The Sun Altar: a carved sun wheel over the lintel.
    staticBox(g, [0, 7.0, -(S + 18.4)], [2.6, 1.4, 1.2], 0x8c9879);
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU;
      staticBox(g, [Math.cos(a) * 2.1, 9.2 + Math.sin(a) * 2.1, -(S + 19.2)], [0.5, 0.5, 0.4], 0x9ca77c, [0, 0, a]);
    }
  }
}

/* ------------------------------------------------------------------- the level */

/**
 * Build a level's scenery.
 * @returns {{ chunks: {geo:Geo, start:number, grain:boolean, always?:boolean}[], roofs: {geo:Geo, s:number}[],
 *             platforms: object[], glow: Geo|null }}
 */
export function buildWorld(L) {
  setSeed(L.seed);
  const { center, halfWidth } = L;
  const inPit = (s) => L.pits.find((p) => s > p.a && s < p.b);
  const off = (s) => (L.rel ? center(s) : 0);
  const chunks = [], roofs = [], platforms = [];
  const walls = new Set(L.walls || []);
  const paveFrom = L.paveFrom ?? 122;
  const palmFirst = L.palmFirst ?? 48;
  const palmChance = L.palmChance ?? 0.6;

  for (let a = -16; a < L.length + 24; a += 12) {
    const g = new Geo(8192), end = a + 12;
    // Raised, uneven trail and visible cut earth.
    for (let s = a; s < end; s += 1.5) {
      const mid = s + 0.75, c = center(mid), w = halfWidth(mid), q = inPit(mid);
      if (!q) {
        staticBox(g, [c, -1.9, -mid], [w * 2, 3.65, 1.53], 0x7f573a);
        staticBox(g, [c, -0.35, -mid], [w * 2 + 0.1, 0.6, 1.53], 0xb68950);
        for (let x = -w; x < w - 0.01; x += 1.3) {
          const x2 = Math.min(x + 1.3, w);
          let co = rgb(mid < paveFrom + 2 ? (rand() > 0.5 ? 0xd3aa71 : 0xd6ad74) : rand() > 0.5 ? 0xc5aa79 : 0xbaa278);
          const tint = range(0.975, 1.025);
          co = co.map((v) => v * tint);
          g.quad([c + x, -0.015, -s], [c + x2, -0.015, -s], [c + x2, -0.015, -s - 1.5], [c + x, -0.015, -s - 1.5], co);
        }
        if (mid > paveFrom && rand() < 0.85) {
          for (let j = -2; j <= 2; j++) staticRock(g, [c + j * 1.22 + range(-0.12, 0.12), 0.012, -mid], [range(0.43, 0.57), 0.04, range(0.43, 0.62)], rand() > 0.5 ? 0x9c9c77 : 0xb5ae86);
        } else {
          for (let j = 0; j < 3; j++) {
            const x = c + range(-w, w);
            staticRock(g, [x, 0.013, -mid + range(-0.6, 0.6)], [range(0.12, 0.26), 0.016, range(0.1, 0.3)], rand() > 0.5 ? 0xe2be8a : 0xbf945f);
          }
        }
        for (const side of [-1, 1]) {
          const x = c + side * (w + range(0.05, 0.27));
          staticRock(g, [x, -0.05, -mid], [range(0.3, 0.55), range(0.25, 0.5), range(0.5, 0.8)], mid < paveFrom + 2 ? 0x87905e : 0x889573);
          if (rand() < 0.6) addPlant(g, x + side * 0.3, mid, range(0.35, 0.7));
        }
      } else {
        for (const side of [-1, 1]) {
          staticRock(g, [c + side * (w + 0.75), -1.4, -mid], [0.9, 2.2, 1.1], 0x537c63);
          addPlant(g, c + side * (w + 0.8), mid, 0.7);
        }
      }
      // Deep jungle floor gives a full world instead of a floating road.
      for (const side of [-1, 1]) {
        staticBox(g, [c + side * 12, -2.4, -mid], [15, 2, 1.55], 0x284d38);
        if (rand() < 0.52) staticRock(g, [c + side * range(5, 15), range(-0.6, 1), -mid], [range(1, 3), range(1, 3), range(1, 2.5)], rand() > 0.5 ? 0x427454 : 0x3d624c);
      }
    }
    for (let s = a; s < end; s += 3.1) {
      for (const side of [-1, 1]) {
        const x = center(s) + side * range(4.5, 7.1);
        addPlant(g, x, s, range(0.9, 1.8), rand() > 0.5 ? 1 : 0);
        if (rand() < 0.6) staticRock(g, [x + side * 1.4, 0.3, -s], [range(0.7, 1.5), range(0.7, 2), range(0.8, 1.6)], 0x78885f);
      }
    }
    for (let s = a + 1; s < end; s += 6) {
      for (const side of [-1, 1]) {
        const x = center(s) + side * range(6.3, 9);
        if (s < palmFirst || rand() < palmChance) palm(g, x, s, range(7.5, 11.5));
        else broadTree(g, x, s, range(8.5, 13));
        if (rand() < 0.6) broadTree(g, side * range(12, 18), s + 2, range(11, 17));
        staticRock(g, [side * range(10, 13), range(3.2, 6.5), -s - 2], [range(3.5, 4.5), range(2.4, 3.6), 4.2], rand() > 0.5 ? 0x397647 : 0x2d6542);
      }
    }
    if (walls.has(a)) {
      for (const side of [-1, 1]) {
        const x = off(a + 7) + side * 6.0;
        staticBox(g, [x, 1.25, -a - 7], [2, 2.5, 5], 0x617761);
        for (let j = 0; j < 3; j++) staticBox(g, [x + side * 0.1, 2.8 + j * 0.5, -a - 6], [1.3 - j * 0.2, 0.4, 3.7 - j * 0.7], 0x8c9879);
        totem(g, off(a + 4) + side * 4.7, a + 4, 3.3);
      }
    }
    chunks.push({ geo: g, start: a, grain: true });
  }

  // Water in each chasm. The surface is below the trail.
  for (const pit of L.pits) {
    const s = (pit.a + pit.b) / 2, g = new Geo(2048), ox = off(s);
    staticBox(g, [ox, -3.6, -s], [10, 0.3, pit.b - pit.a + 0.15], 0x389b94);
    for (let j = 0; j < 22; j++) {
      const x = ox + range(-4.8, 4.8), z = -range(pit.a, pit.b);
      staticBox(g, [x, -3.4, z], [range(0.15, 0.8), 0.01, 0.06], j % 2 ? 0xa5dfb5 : 0x65c6ac);
    }
    for (const edge of [pit.a, pit.b]) for (let j = 0; j < 8; j++) staticRock(g, [off(edge) - 3.7 + j * 1.05, -0.2, -edge], [0.6, 0.25, 0.3], 0xb7ac78);
    chunks.push({ geo: g, start: pit.a, grain: false });
    if (pit.bridge) {
      const bx = pit.bridgeX ?? 2;
      const b = new Geo(2048);
      for (let z = pit.a; z <= pit.b; z += 0.45) staticBox(b, [center(z) + bx, 0.02, -z], [2.05, 0.15, 0.37], rand() > 0.5 ? 0x9b7648 : 0xb48c55);
      for (const side of [-1, 1]) {
        staticBox(b, [ox + bx + side * 1.15, 0.7, -s], [0.075, 0.075, pit.b - pit.a + 2], 0x6f533b);
        for (const z of [pit.a - 0.5, pit.b + 0.5]) staticBox(b, [off(z) + bx + side * 1.15, 0.48, -z], [0.15, 1.1, 0.15], C.wood);
      }
      chunks.push({ geo: b, start: pit.a, grain: false });
    }
    if (pit.island) {
      const [i0, i1] = pit.island, im = (i0 + i1) / 2, len = i1 - i0;
      const b = new Geo(256);
      staticBox(b, [center(s), -1.8, -im], [3, 3.8, len], C.earth);
      staticBox(b, [center(s), 0.02, -im], [3.1, 0.18, len + 0.15], C.stoneLight);
      chunks.push({ geo: b, start: pit.a, grain: false });
    }
    if (pit.moving) {
      for (const spec of pit.moving) {
        const b = new Geo(256);
        staticBox(b, [0, -0.2, 0], [2.6, 0.6, 2.65], C.stone);
        staticBox(b, [0, 0.14, 0], [2.7, 0.1, 2.7], C.stoneLight);
        for (let j = -1; j <= 1; j++) staticBox(b, [j * 0.75, 0.205, 0], [0.52, 0.01, 1.9], 0x6c8868);
        const s0 = spec.s ?? s;
        const x0 = spec.x0 ?? off(s0);
        platforms.push({ geo: b, pit, s0, x0, ax: spec.ax ?? 1.55, as: spec.as ?? 0, speed: spec.speed ?? 1.1, phase: spec.phase ?? 0, x: x0, s: s0, y: 0.2, prevX: x0, prevS: s0 });
      }
    }
  }

  // Landmarks: totems, arches and the temple, a real silhouette at the end of the path.
  const ruins = new Geo(65536);
  L.landmarks({ g: ruins, roofs, totem: (x, s, h) => totem(ruins, x, s, h), arch: (s, wide, x0) => arch(ruins, roofs, s, wide, x0), temple: (S, sun) => temple(ruins, S, sun), off });
  chunks.push({ geo: ruins, start: L.boss.s - 42, grain: false, always: true });

  // Lanterns along the trail at dusk: posts in the lit scenery, glowing heads in an unlit batch.
  let glow = null;
  if (L.lanterns) {
    glow = new Geo(4096);
    const posts = new Geo(4096);
    let flip = 1;
    for (let s = L.lanterns.from; s < L.lanterns.to; s += L.lanterns.step) {
      if (inPit(s) || inPit(s - 1) || inPit(s + 1)) continue;
      flip = -flip;
      const x = center(s) + flip * (halfWidth(s) + 0.55);
      staticBox(posts, [x, 0.8, -s], [0.16, 1.6, 0.16], 0x6f533b);
      staticBox(posts, [x, 1.86, -s], [0.46, 0.08, 0.46], 0x4e3b2a);
      staticBox(glow, [x, 1.62, -s], [0.32, 0.4, 0.32], 0xffc66b);
    }
    if (L.lanterns.sun) {
      const S = L.boss.s;
      const disc = G.disc(40, 0xffb36b);
      glow.add(disc, [0, 9.2, -(S + 19.6)], [Math.PI / 2, 0, 0], [1.55, 1, 1.55]);
      glow.add(G.ring(0.8, 1, 40, 0xffe2a0), [0, 9.2, -(S + 19.5)], [Math.PI / 2, 0, 0], [1.75, 1, 1.75]);
    }
    chunks.push({ geo: posts, start: L.boss.s - 42, grain: false, always: true });
  }

  return { chunks, roofs, platforms, glow, inPit };
}

/* ------------------------------------------------------------ props and characters */

export function makeFruit() {
  const g = new Geo(512);
  g.add(BALL, [0, 0, 0], [0, 0, -0.25], [0.22, 0.27, 0.22], rgb(0xffb731));
  g.add(BALL, [-0.07, 0.015, 0.05], [0, 0, 0], [0.15, 0.23, 0.18], rgb(0xf57a29));
  g.add(CYL, [0, 0.3, 0], [0, 0, -0.25], [0.028, 0.15, 0.028], rgb(0x665232));
  g.add(LEAF, [0, 0.34, 0], [0.2, -0.5, 1.2], [0.28, 0.26, 0.3], rgb(0x7eb443));
  return g;
}

export function makeShard() {
  const g = new Geo(64);
  const pts = [[0, 0.6, 0], [0.28, 0, 0], [0, 0, 0.28], [-0.28, 0, 0], [0, 0, -0.28], [0, -0.55, 0]];
  for (let i = 0; i < 4; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % 4);
    g.tri(pts[0], pts[a], pts[b], i % 2 ? 0x79ead7 : 0x3dc3ba);
    g.tri(pts[5], pts[b], pts[a], i % 2 ? 0xa7f3ce : 0x69cdd5);
  }
  return g;
}

/**
 * The rascal, as one Geo per moving part (body, two arms, two legs, tail),
 * each in the part's own space, exactly where the original placed every piece.
 */
export function makeHero() {
  const body = new Geo(8192);
  const parts = { body, armL: null, armR: null, legL: null, legR: null, tail: null, pivots: {} };
  const sphere = (target, col, p, s) => target.add(G.ball(9, 6, col), p, [0, 0, 0], s);
  sphere(body, C.orange, [0, 1.35, 0], [0.51, 0.69, 0.36]);
  sphere(body, C.cream, [0, 1.36, -0.29], [0.32, 0.44, 0.1]);
  sphere(body, C.orange, [0, 2.02, -0.08], [0.56, 0.58, 0.47]);
  sphere(body, C.cream, [0, 1.85, -0.5], [0.42, 0.25, 0.36]);
  sphere(body, 0x2c3130, [0, 1.99, -0.83], [0.16, 0.13, 0.13]);
  for (const side of [-1, 1]) {
    body.add(G.cone(1, 0, 1, 4, C.orange), [side * 0.39, 2.64, 0], [0, 0, -side * 0.28], [0.26, 0.88, 0.25]);
    body.add(G.cone(1, 0, 1, 3, 0xc36038), [side * 0.4, 2.65, -0.13], [0, 0, -side * 0.28], [0.13, 0.6, 0.065]);
    sphere(body, 0xfff4cd, [side * 0.22, 2.22, -0.49], [0.18, 0.235, 0.085]);
    sphere(body, 0x284346, [side * 0.205, 2.21, -0.564], [0.081, 0.125, 0.032]);
    sphere(body, 0x162d2d, [side * 0.196, 2.205, -0.59], [0.042, 0.084, 0.014]);
    sphere(body, 0xffffff, [side * 0.184, 2.255, -0.603], [0.021, 0.03, 0.011]);
    body.add(G.box(0x91452c), [side * 0.23, 2.465, -0.47], [0, 0, side * 0.22], [0.35, 0.1, 0.12]);

    const arm = new Geo(1024);
    sphere(arm, C.orange, [side * 0.11, -0.28, 0], [0.19, 0.39, 0.19]);
    sphere(arm, 0x78412c, [side * 0.15, -0.62, -0.05], [0.24, 0.25, 0.23]);
    parts[side < 0 ? 'armL' : 'armR'] = arm;
    parts.pivots[side < 0 ? 'armL' : 'armR'] = [side * 0.46, 1.55, 0];

    const leg = new Geo(1536);
    sphere(leg, C.shorts, [0, -0.17, 0], [0.235, 0.31, 0.24]);
    sphere(leg, C.orange, [0, -0.47, 0], [0.135, 0.25, 0.13]);
    sphere(leg, C.shoe, [0, -0.68, -0.14], [0.26, 0.19, 0.4]);
    leg.add(G.box(0xf3dcaf), [0, -0.81, -0.12], [0, 0, 0], [0.5, 0.095, 0.7]);
    leg.add(G.box(0xf7e4c3), [0, -0.565, -0.24], [0.18, 0, 0], [0.3, 0.055, 0.18]);
    parts[side < 0 ? 'legL' : 'legR'] = leg;
    parts.pivots[side < 0 ? 'legL' : 'legR'] = [side * 0.25, 0.84, 0];
  }
  body.add(G.box(C.shorts), [0, 0.88, 0], [0, 0, 0], [0.78, 0.31, 0.58]);
  body.add(G.cone(0.38, 0.35, 0.16, 8, C.teal), [0, 1.74, -0.01], [0, 0, 0], [1, 1, 1]);
  body.tri([-0.1, 1.7, 0.23], [0.2, 1.68, 0.27], [0.3, 1.15, 0.5], C.teal); // scarf
  for (let j = 0; j < 3; j++) body.add(G.cone(1, 0, 1, 4, 0xc65c2b), [-0.16 + j * 0.15, 2.58 + j * 0.06, 0.05], [0.55, 0, -0.15], [0.16, 0.36, 0.2]);
  const tail = new Geo(1536);
  for (let j = 0; j < 5; j++) sphere(tail, j % 2 ? 0x753e2c : C.orange, [Math.sin(j * 0.35) * 0.33, -0.05 + j * 0.11, 0.15 + j * 0.21], [0.15 - j * 0.009, 0.17 - j * 0.01, 0.24 - j * 0.01]);
  parts.tail = tail;
  parts.pivots.tail = [0, 1.0, 0.27];
  // A readable grin on the menu pose.
  body.add(G.box(0x8a4029), [0, 1.755, -0.748], [0, 0, 0], [0.39, 0.038, 0.017]);
  body.add(G.box(0xfff1cc), [0, 1.77, -0.76], [0, 0, 0], [0.29, 0.055, 0.025]);
  return parts;
}

/** A beach crab: body plus two claws (each in its pivot's space). */
export function makeCrab() {
  const g = new Geo(4096);
  g.add(BALL, [0, 0.44, 0], [0, 0, 0], [0.58, 0.31, 0.43], rgb(0xbc543c));
  g.add(BALL, [0, 0.6, -0.03], [0, 0, 0], [0.39, 0.11, 0.3], rgb(0xe48b4a));
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      g.add(CYL, [side * 0.55, 0.22, -0.28 + j * 0.25], [0, 0, side * 0.85], [0.06, 0.5, 0.06], rgb(0xc87545));
      g.add(CYL, [side * 0.77, 0.11, -0.3 + j * 0.27], [0, 0, side * 1.2], [0.055, 0.35, 0.055], rgb(0xe2914e));
    }
    g.add(CYL, [side * 0.24, 0.8, 0.23], [0, 0, -side * 0.15], [0.045, 0.4, 0.045], rgb(0xcd7747));
    g.add(BALL, [side * 0.27, 1.01, 0.23], [0, 0, 0], [0.14, 0.15, 0.13], rgb(0xffe2aa));
    g.add(BALL, [side * 0.27, 1.02, 0.335], [0, 0, 0], [0.065, 0.075, 0.038], rgb(0x172f2c));
  }
  const claws = [];
  for (const side of [-1, 1]) {
    const c = new Geo(512);
    c.add(G.ball(6, 4, 0xc64e36), [0, 0, 0], [0, 0, side * 0.4], [0.27, 0.25, 0.26]);
    c.add(G.cone(1, 0, 1, 4, 0xf7c376), [side * 0.1, 0.22, 0], [0, 0, -side * 0.3], [0.1, 0.3, 0.14]);
    claws.push({ geo: c, pivot: [side * 0.73, 0.42, 0.34] });
  }
  return { body: g, claws };
}

/** New for Sunset Scramble: a hopping toad that leaps over the trail. */
export function makeHopper() {
  const g = new Geo(4096);
  g.add(BALL, [0, 0.42, 0], [0, 0, 0], [0.56, 0.4, 0.5], rgb(0x4f8f3c));
  g.add(BALL, [0, 0.36, 0.14], [0, 0, 0], [0.42, 0.28, 0.4], rgb(0xd8d38a));
  g.add(BALL, [0, 0.62, -0.05], [0, 0, 0], [0.4, 0.18, 0.36], rgb(0x6fae4a));
  for (let j = 0; j < 3; j++) g.add(BALL, [(j - 1) * 0.2, 0.7, -0.16 + j * 0.05], [0, 0, 0], [0.08, 0.035, 0.08], rgb(0xe0a24a));
  for (const side of [-1, 1]) {
    g.add(BALL, [side * 0.24, 0.8, 0.16], [0, 0, 0], [0.15, 0.15, 0.14], rgb(0xfff0c0));
    g.add(BALL, [side * 0.25, 0.81, 0.29], [0, 0, 0], [0.07, 0.08, 0.04], rgb(0x1c2a22));
    g.add(BALL, [side * 0.45, 0.2, -0.15], [0, 0, 0], [0.22, 0.16, 0.34], rgb(0x417a33));
    g.add(BOX, [side * 0.48, 0.04, 0.06], [0, 0, 0], [0.22, 0.06, 0.34], rgb(0xe08a3a));
    g.add(CYL, [side * 0.3, 0.16, 0.3], [0, 0, side * 0.3], [0.06, 0.3, 0.06], rgb(0x417a33));
  }
  g.add(BOX, [0, 0.4, 0.49], [0, 0, 0], [0.34, 0.03, 0.03], rgb(0x23382a));
  return g;
}

const STONE_PAL = { body: 0x68816c, head: 0x8ba47c, mouth: 0x233e35, teeth: 0xd8cba1, nose: 0xaab88a, brow: 0x294b3c, feet: 0x465f52, ears: 0x526e56, leafA: 0x4e9060, leafB: 0x90b655, arm: 0x7a9170, fist: 0x8ba47a, eye: 0xffc159 };

/** The temple guardian: core (body) + eyes (unlit) + two arms in their pivots' space. */
export function makeBoss(palette = null) {
  const P = { ...STONE_PAL, ...(palette || {}) };
  const g = new Geo(8192);
  staticBox(g, [0, 1.2, 0], [2, 2.15, 1.4], P.body);
  staticRock(g, [0, 2.9, 0], [1.38, 1.3, 1.03], P.head);
  staticBox(g, [0, 2.42, 0.92], [1.6, 0.34, 0.18], P.mouth);
  for (const x of [-0.52, 0, 0.52]) staticBox(g, [x, 2.55, 1.04], [0.26, 0.23, 0.08], P.teeth);
  staticRock(g, [0, 2.95, 1.0], [0.29, 0.39, 0.25], P.nose);
  for (const side of [-1, 1]) {
    staticBox(g, [side * 0.58, 3.39, 0.85], [0.63, 0.32, 0.25], P.brow, [0, 0, side * 0.13]);
    staticBox(g, [side * 0.65, 0.19, 0.15], [0.87, 0.38, 1.4], P.feet);
    staticBox(g, [side * 0.66, 3.75, 0.55], [0.85, 0.22, 0.5], P.ears, [0, 0, -side * 0.12]);
  }
  for (let j = 0; j < 7; j++) g.add(LEAF, [0, 3.9, 0], [-0.4, (j * TAU) / 7, 0], [1.1, 1.3, 1.2], rgb(j % 2 ? P.leafA : P.leafB));
  const eyes = new Geo(128);
  for (const side of [-1, 1]) eyes.add(G.box(P.eye), [side * 0.57, 3.39, 1.001], [0, 0, side * 0.13], [0.32, 0.14, 0.04]);
  const arms = [];
  for (const side of [-1, 1]) {
    const a = new Geo(1024);
    a.add(G.ball(6, 4, P.arm), [side * 0.38, -0.52, 0], [0, 0, side * 0.25], [0.5, 0.75, 0.58]);
    a.add(G.box(P.fist), [side * 0.58, -1.21, 0.13], [0, 0, side * 0.2], [1, 0.75, 1.0]);
    arms.push({ geo: a, pivot: [side * 1.3, 2.45, 0] });
  }
  return { core: g, eyes, arms };
}

export function makeCharm() {
  const g = new Geo(512);
  staticBox(g, [0, 0, 0], [0.38, 0.55, 0.14], 0x399b81);
  for (const x of [-0.11, 0.11]) staticBox(g, [x, 0.04, 0.095], [0.08, 0.12, 0.04], 0xffe2a3);
  for (let j = 0; j < 3; j++) g.add(LEAF, [0, 0.26, 0], [-0.9, (j - 1) * 0.8, 0], [0.29, 0.7, 0.4], rgb(j === 1 ? 0xffc466 : 0x7cbd66));
  return g;
}

export function makeGate() {
  const g = new Geo(256);
  for (let j = 0; j < 3; j++) staticBox(g, [0, 0.55 + j * 0.72, 0], [6, 0.45, 0.42], j % 2 ? 0xb58a51 : 0x936a45);
  for (const x of [-2.7, 2.7]) staticBox(g, [x, 1.3, 0], [0.44, 2.8, 0.6], 0x725f43);
  return g;
}

export function makeLog() {
  const g = new Geo(1024);
  g.add(G.cone(0.43, 0.43, 2.7, 9, 0x805638), [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1]);
  for (const x of [-1, -0.35, 0.35, 1])
    for (let j = 0; j < 4; j++) {
      const a = (j * TAU) / 4;
      g.add(CONE, [x, Math.cos(a) * 0.52, Math.sin(a) * 0.52], [a, 0, 0], [0.14, 0.42, 0.14], rgb(0xe4c99a));
    }
  return g;
}

