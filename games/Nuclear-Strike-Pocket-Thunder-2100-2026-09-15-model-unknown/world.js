/* Pocket Thunder 2100 — the atoll, its props and every model, built from the
   game's own toy primitives (bevelled boxes, cylinders, low spheres, rings). */

import {
  Node, triangle, quad, geometry, multiply, model, identity, boxGeo, cylGeo, coneGeo, sphereGeo, ringGeo, planeGeo, leafGeo,
  TAU, PI, hypot, sub,
} from './render.js';

/* ---------------------------------------------------------------- randomness and colour */

let seed = 73119;
/** Seeded, so the atoll is the same island every time. */
export function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const rnd = (a, b) => a + (b - a) * rand();

const colorCache = new Map();
/** '#rrggbb' → linear [r, g, b] (the original's gamma 2.2 decode). */
export function color(hex) {
  if (Array.isArray(hex)) return hex;
  let c = colorCache.get(hex);
  if (c) return c;
  let s = String(hex).replace('#', '');
  if (s.length === 3)
    s = s
      .split('')
      .map((ch) => ch + ch)
      .join('');
  const n = parseInt(s, 16);
  c = [Math.pow(((n >> 16) & 255) / 255, 2.2), Math.pow(((n >> 8) & 255) / 255, 2.2), Math.pow((n & 255) / 255, 2.2)];
  colorCache.set(hex, c);
  return c;
}

export const C = {
  navy: '#233f4a',
  navy2: '#365460',
  dark: '#172d33',
  cream: '#ece7cb',
  yellow: '#eeba49',
  orange: '#d97d48',
  red: '#db6758',
  cyan: '#81e7da',
  glass: '#52b8c0',
  grass: '#71937d',
  green: '#446e5c',
  palm: '#517b59',
  sand: '#cdb78c',
  rock: '#78897a',
  road: '#74847b',
  steel: '#718b88',
  white: '#eee9d7',
};

/* ---------------------------------------------------------------- node helpers */

export const group = (p, x = 0, y = 0, z = 0) => new Node(p, x, y, z);
export function mesh(p, g, x, y, z, sx, sy, sz, col, alpha = 1, emission = 0) {
  const n = new Node(p, x, y, z);
  n.geo = g;
  n.sx = sx;
  n.sy = sy;
  n.sz = sz;
  n.col = color(col);
  n.alpha = alpha;
  n.emission = emission;
  return n;
}
export const box = (p, x, y, z, w, h, d, c, ry = 0) => {
  const n = mesh(p, boxGeo, x, y, z, w, h, d, c);
  n.ry = ry;
  return n;
};
export const cyl = (p, x, y, z, r, h, c) => mesh(p, cylGeo, x, y, z, r, h, r, c);
export const sphere = (p, x, y, z, r, c, alpha = 1, em = 0) => mesh(p, sphereGeo, x, y, z, r, r, r, c, alpha, em);
export const ring = (p, x, y, z, r, c, alpha = 1, em = 0) => {
  const n = mesh(p, ringGeo, x, y, z, r, 1, r, c, alpha, em);
  n.cast = false;
  return n;
};
export function beam(p, a, b, thick, col) {
  const d = sub(b, a);
  const len = hypot(d[0], d[1], d[2]);
  const n = box(p, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, thick, len, thick, col);
  n.rz = -Math.atan2(d[0], d[1]);
  n.rx = Math.atan2(d[2], hypot(d[0], d[1]));
  return n;
}
export function stud(p, x, y, z, col, r = 0.29) {
  return cyl(p, x, y, z, r, 0.15, col);
}

/* ---------------------------------------------------------------- the atoll */

// Four hand-built islands, with an open route between every objective.
export const BASE = { x: -49, z: 36, name: 'BASE', num: 'H' };
export const islands = [
  { center: [-45, 22], poly: [[-77, 41], [-75, 24], [-68, 18], [-71, 3], [-60, -15], [-43, -20], [-32, -11], [-31, 3], [-17, 8], [-16, 27], [-25, 33], [-26, 48], [-39, 58], [-61, 57]] },
  { center: [10, -14], poly: [[-16, 7], [-16, -11], [-9, -18], [-13, -31], [-4, -45], [12, -50], [30, -43], [38, -28], [34, -11], [40, 0], [28, 18], [14, 20], [6, 11], [-6, 16]] },
  { center: [61, -38], poly: [[42, -17], [39, -32], [47, -46], [45, -58], [53, -72], [68, -72], [79, -60], [82, -44], [73, -33], [80, -19], [69, -7], [54, -9]] },
  { center: [14, -74], poly: [[-13, -64], [-12, -79], [-4, -87], [13, -92], [34, -86], [41, -77], [37, -60], [24, -55], [7, -59], [-2, -58]] },
];
export const BRIDGES = [
  [[-19, 16], [-9, 12]],
  [[33, -26], [45, -31]],
  [[15, -45], [17, -61]],
];

export function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function onLand(x, z) {
  for (const i of islands) if (inPoly(x, z, i.poly)) return true;
  return false;
}
export function landHeight(x, z) {
  return onLand(x, z) ? 2.15 : 0.02;
}

function triangulate(poly) {
  const ids = poly.map((_, i) => i);
  const out = [];
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) ids.reverse();
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (ids.length > 3 && guard++ < 1000) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length], b = ids[j], c = ids[(j + 1) % ids.length];
      if (cr(poly[a], poly[b], poly[c]) < 0.00001) continue;
      let has = false;
      for (const k of ids) {
        if (k === a || k === b || k === c) continue;
        const p = poly[k];
        if (cr(poly[a], poly[b], p) >= 0 && cr(poly[b], poly[c], p) >= 0 && cr(poly[c], poly[a], p) >= 0) {
          has = true;
          break;
        }
      }
      if (!has) {
        out.push([a, b, c]);
        ids.splice(j, 1);
        found = true;
        break;
      }
    }
    if (!found) break;
  }
  if (ids.length === 3) out.push([...ids]);
  return out;
}

/** Build every static prop, hand it to the view (instanced, uploaded once). */
export function buildWorld(view) {
  const staticRoot = group();

  function slab(island, scale, bottom, top, col) {
    const poly = island.poly.map((p) => [island.center[0] + (p[0] - island.center[0]) * scale, island.center[1] + (p[1] - island.center[1]) * scale]);
    const d = [];
    for (const tri of triangulate(poly)) {
      const p = tri.map((i) => [poly[i][0], top, poly[i][1]]);
      triangle(d, p[0], p[2], p[1], rnd(0.97, 1.025));
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      quad(d, [a[0], top, a[1]], [b[0], top, b[1]], [b[0], bottom, b[1]], [a[0], bottom, a[1]], 0.87);
    }
    view.addSurface(d, color(col), 1);
  }
  function shore(island, s1, s2, y, col, alpha) {
    const p = island.poly, c = island.center, d = [];
    const f = (a, s) => [c[0] + (a[0] - c[0]) * s, y, c[1] + (a[1] - c[1]) * s];
    for (let i = 0; i < p.length; i++) quad(d, f(p[i], s1), f(p[i], s2), f(p[(i + 1) % p.length], s2), f(p[(i + 1) % p.length], s1));
    view.addSurface(d, color(col), alpha);
  }
  for (const island of islands) {
    shore(island, 1.055, 1.24, -0.07, '#69a99d', 0.48);
    shore(island, 1.04, 1.066, 0.01, '#ced7b9', 0.6);
    slab(island, 1.053, -2, 0.8, C.sand);
    slab(island, 1.007, 0.65, 1.68, '#9f9d77');
    slab(island, 0.986, 1.6, 2.15, C.grass);
  }

  function palm(x, z, size = 1, angle = 0) {
    const p = group(staticRoot, x, 2.13, z);
    p.ry = angle;
    p.sx = p.sy = p.sz = size;
    const bend = rnd(-0.7, 0.7);
    for (let i = 0; i < 4; i++) {
      const trunk = cyl(p, (bend * i) / 4, 0.7 + i * 1.15, 0, 0.28 - i * 0.033, 1.4, i % 2 ? '#9e9a71' : '#b2a77d');
      trunk.rz = -bend * 0.2;
    }
    sphere(p, bend, 4.9, 0, 0.4, C.green);
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(p, leafGeo, bend, 5.08, 0, rnd(3.4, 4.6), 2.7, rnd(3.3, 4), i % 2 ? '#557e50' : '#6c975b');
      leaf.ry = angle + (i * TAU) / 6;
      leaf.rx = rnd(-0.15, 0.15);
    }
    for (let j = 0; j < 3; j++) sphere(p, bend + Math.cos(j * 2) * 0.24, 4.72, Math.sin(j * 2) * 0.24, 0.2, '#87734b');
  }
  function rock(x, z, s = 1) {
    const r = sphere(staticRoot, x, 2.05, z, s, C.rock);
    r.sy = s * 0.7;
    r.sz = s * 1.3;
    r.ry = rnd(0, TAU);
  }
  function building(x, z, w, d, h, roof = C.cream) {
    const b = group(staticRoot, x, 2.15, z);
    box(b, 0, 0.3, 0, w + 0.5, 0.6, d + 0.5, C.rock);
    box(b, 0, h / 2 + 0.45, 0, w, h, d, roof);
    box(b, 0, h + 0.6, 0, w + 0.35, 0.35, d + 0.35, roof);
    for (let k = -w / 2 + 1; k < w / 2 - 0.3; k += 1.5) {
      box(b, k, h * 0.58, d / 2 + 0.018, 0.86, h * 0.32, 0.08, C.navy);
      box(b, k, h * 0.58, -d / 2 - 0.018, 0.86, h * 0.32, 0.08, C.navy);
    }
    box(b, w / 2 + 0.03, 1.2, 0, 0.1, 1.7, 1.3, C.navy2);
    for (let sx = -w / 2 + 0.7; sx < w / 2 - 0.5; sx += 1.15)
      for (let sz = -d / 2 + 0.7; sz < d / 2 - 0.5; sz += 1.15) stud(b, sx, h + 0.85, sz, roof, 0.28);
    box(b, -w * 0.2, h + 1.1, 0, 1.8, 0.7, 1.5, C.steel);
    for (let i = 0; i < 4; i++) box(b, -w * 0.2 - 0.5 + i * 0.33, h + 1.46, 0, 0.13, 0.06, 1.1, C.dark);
    return b;
  }
  function barrier(x, z, len, ry = 0) {
    const p = group(staticRoot, x, 2.15, z);
    p.ry = ry;
    box(p, 0, 0.6, 0, len, 1.2, 0.55, C.cream);
    for (let a = -len / 2 + 0.6; a < len / 2; a += 1.35) box(p, a, 0.65, -0.29, 0.45, 0.75, 0.04, C.orange, -0.16);
  }
  function road(a, b, w = 4) {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = hypot(dx, dz);
    const r = group(staticRoot, (a[0] + b[0]) / 2, 2.175, (a[1] + b[1]) / 2);
    r.ry = Math.atan2(dx, dz);
    const p = mesh(r, planeGeo, 0, 0, 0, w, 1, len, '#7f8b7e');
    p.cast = false;
    for (let z = -len / 2 + 1; z < len / 2; z += 4.5) {
      const l = mesh(r, planeGeo, 0, 0.012, z, 0.14, 1, 1.7, '#c3c4a6');
      l.cast = false;
    }
  }
  function bridge(a, b) {
    const p = group(staticRoot, (a[0] + b[0]) / 2, 2.15, (a[1] + b[1]) / 2);
    const len = hypot(b[0] - a[0], b[1] - a[1]);
    p.ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
    box(p, 0, -0.1, 0, 5, 0.6, len, C.steel);
    for (const x of [-2.45, 2.45]) {
      box(p, x, 1, 0, 0.2, 0.25, len, C.cream);
      for (let z = -len / 2; z <= len / 2; z += 3) {
        box(p, x, 0.5, z, 0.25, 1.6, 0.3, C.orange);
        box(p, x, -1.5, z, 0.6, 3, 0.8, C.rock);
      }
    }
    for (let z = -len / 2; z < len / 2; z += 2) box(p, 0, 0.24, z, 4.4, 0.06, 0.08, C.dark);
  }
  road([-49, 36], [-31, 16], 5);
  road([-49, 32], [-53, -8], 3.8);
  road([-28, 16], [-17, 16], 5);
  road([-9, 12], [23, 4], 4.3);
  road([8, -28], [23, 4], 4.3);
  road([13, -26], [35, -26], 4.4);
  road([46, -31], [62, -49], 4.4);
  road([8, -28], [16, -45], 4.4);
  for (const [a, b] of BRIDGES) bridge(a, b);

  // Forward operating base, with a fully serviced landing pad.
  const pad = group(staticRoot, BASE.x, 2.16, BASE.z);
  box(pad, 0, 0.18, 0, 13, 0.35, 13, C.navy2);
  box(pad, 0, 0.4, 0, 11.6, 0.08, 11.6, C.navy);
  ring(pad, 0, 0.45, 0, 4.6, C.cream);
  box(pad, -1.28, 0.46, 0, 0.6, 0.04, 4.4, C.cream);
  box(pad, 1.28, 0.46, 0, 0.6, 0.04, 4.4, C.cream);
  box(pad, 0, 0.46, 0, 2.6, 0.04, 0.58, C.cream);
  for (const x of [-5.5, 5.5])
    for (const z of [-5.5, 5.5]) {
      box(pad, x, 0.46, z, 1.4, 0.06, 0.5, C.yellow);
      const light = sphere(pad, x, 0.75, z, 0.19, C.cyan, 1, 1.3);
      light.cast = false;
    }
  building(-63, 38, 8, 7, 3.5, C.cream);
  building(-55, 50, 11, 6, 2.4, C.navy2);
  const antenna = group(staticRoot, -62, 2.2, 38);
  box(antenna, 0, 5, 0, 0.18, 10, 0.18, C.cream);
  sphere(staticRoot, -62, 12.3, 38, 0.22, C.red, 1, 1); // slender base radio mast
  for (let i = 0; i < 4; i++) crateVisual(staticRoot, -63 + i * 2.3, 2.2, 47, i % 2 ? C.green : C.yellow);
  barrier(-57, 29, 7);
  barrier(-42, 45, 7);
  barrier(-37, 36, 6, PI / 2);
  // Solar plant, modular homes, a dock and tank farm.
  building(-60, 8, 8, 5, 3.4);
  building(-50, 16, 6, 4, 2.7, C.navy2);
  building(-35, -6, 5, 6, 4.2, C.cream);
  building(0, -8, 8, 6, 4, C.cream);
  building(14, -5, 5, 7, 3, C.navy2);
  building(3, -38, 8, 5, 2.7, C.cream);
  building(29, -31, 6, 5, 3.8, C.cream);
  building(54, -17, 8, 5, 3.2);
  building(71, -58, 6, 9, 3, C.navy2);
  building(-1, -73, 6, 7, 4, C.cream);
  building(30, -82, 6, 5, 3.2, C.navy2);
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 3; i++) {
      const p = group(staticRoot, -6 + i * 4.6, 3.1, -19 + j * 4);
      box(p, 0, 0, 0, 3.5, 0.2, 2.5, C.dark).rx = -0.2;
      for (let k = -1; k <= 1; k++) box(p, k, 0.12, 0, 0.04, 0.03, 2.3, '#639cba').rx = -0.2;
      box(p, 0, -0.5, 0, 0.25, 1.4, 0.25, C.steel);
    }
  for (let i = 0; i < 3; i++) {
    cyl(staticRoot, 43 + i * 4.5, 4.2, -57, 1.8, 4, C.cream);
    cyl(staticRoot, 43 + i * 4.5, 6.25, -57, 1.85, 0.18, C.steel);
    cyl(staticRoot, 43 + i * 4.5, 4.2, -57, 1.82, 0.55, C.orange);
  }
  const dock = group(staticRoot, -67, 1.2, 59);
  box(dock, 0, 0, 0, 5, 1.2, 20, C.rock);
  for (let i = -8; i <= 8; i += 4) {
    box(dock, -2.2, -1.3, i, 0.6, 3, 0.6, C.navy);
    box(dock, 2.2, -1.3, i, 0.6, 3, 0.6, C.navy);
    box(dock, 0, 0.66, i, 4.4, 0.1, 0.11, C.cream);
  }
  function boat(x, z, scale = 1, friendly = true) {
    const b = group(staticRoot, x, 0.55, z);
    b.sx = b.sy = b.sz = scale;
    b.ry = -0.18;
    box(b, 0, 0.6, 0, 3.9, 1.8, 10, C.navy);
    box(b, 0, 1.6, 0.2, 3.5, 0.45, 8.4, C.cream);
    box(b, 0, 2.6, -1.8, 2.2, 2, 2.6, C.cream);
    box(b, 0, 2.8, -0.42, 1.8, 0.7, 0.08, C.glass);
    box(b, 0, 4, -2, 0.15, 1.7, 0.15, C.cream);
    box(b, 0, 1.9, 2, 2, 0.22, 2, friendly ? C.yellow : C.red);
  }
  boat(-74, 60, 1.2);
  boat(-25, 66, 0.85);
  boat(81, -4, 0.8, false);
  const reserves = [
    [-49, 36, 13], [-63, 38, 9], [-55, 50, 8], [-30, 14, 9], [-51, -7, 8], [8, -26, 10], [26, 4, 8], [61, -48, 10], [16, -74, 13], [-60, 8, 7],
    [-50, 16, 6], [-35, -6, 6], [0, -8, 7], [14, -5, 6], [3, -38, 6], [29, -31, 6], [54, -17, 7], [71, -58, 8], [-1, -73, 7], [30, -82, 6], [-5, -18, 12],
  ];
  for (let i = 0; i < 360; i++) {
    const x = rnd(-81, 82);
    const z = rnd(-94, 61);
    if (!onLand(x, z)) continue;
    if (reserves.some((r) => hypot(x - r[0], z - r[1]) < r[2])) continue;
    if (i % 3 !== 0) palm(x, z, rnd(0.75, 1.4), rnd(0, TAU));
    else {
      rock(x, z, rnd(0.8, 1.9));
      if (i % 6 === 0) rock(x + 1.4, z + 0.7, 0.6);
    }
  }
  for (const island of islands)
    for (let i = 0; i < island.poly.length; i++) {
      const a = island.poly[i], c = island.center;
      const x = c[0] + (a[0] - c[0]) * 0.95, z = c[1] + (a[1] - c[1]) * 0.95;
      if (i % 2 === 0) rock(x, z, rnd(1, 2.2));
    }
  // Small light poles supply scale cues.
  for (const [x, z] of [[-36, 27], [-27, 21], [2, 9], [23, -17], [51, -32], [14, -60], [-60, 26]]) {
    box(staticRoot, x, 4.2, z, 0.16, 4.1, 0.16, C.navy);
    box(staticRoot, x, 6.3, z, 1.2, 0.18, 0.7, C.cream);
    box(staticRoot, x, 6.18, z, 1, 0.04, 0.5, C.yellow).emission = 0.9;
  }

  // Freeze: world matrices computed once, then uploaded as static instances.
  const nodes = [];
  const visit = (n, parent) => {
    multiply(parent, model(n), n.world);
    if (n.geo) nodes.push(n);
    for (const c of n.children) visit(c, n.world);
  };
  visit(staticRoot, identity());
  view.buildStatic(nodes);
  view.buildSurfaces();
  return nodes.length;
}

export function crateVisual(parent, x, y, z, col) {
  const b = group(parent, x, y, z);
  box(b, 0, 0.6, 0, 1.9, 1.2, 1.6, col);
  for (const s of [-1, 1]) {
    box(b, s * 0.65, 0.61, 0, 0.16, 1.24, 1.65, C.cream);
    stud(b, s * 0.53, 1.29, -0.3, col, 0.18);
    stud(b, s * 0.53, 1.29, 0.3, col, 0.18);
  }
  return b;
}

/* ---------------------------------------------------------------- the helicopter */

// A bevelled toy-scale fuselage, real moving rotors, independent weapons.
export function makeHelicopter() {
  const root = group();
  const body = group(root);
  const d = [];
  const sections = [
    [-2.35, 0.66, -0.5, 0.43],
    [-1.25, 1.17, -0.64, 0.92],
    [1.15, 1.02, -0.55, 0.68],
    [2.35, 0.39, -0.34, 0.1],
  ];
  // Wound outward (the original hull was inside out and only showed because culling was off).
  const face = (a, b, c, e) => quad(d, e, c, b, a);
  for (let i = 0; i < sections.length - 1; i++) {
    const [z, w, b, t] = sections[i];
    const [z2, w2, b2, t2] = sections[i + 1];
    face([-w, b, z], [-w2, b2, z2], [w2, b2, z2], [w, b, z]);
    face([-w, t, z], [w, t, z], [w2, t2, z2], [-w2, t2, z2]);
    face([-w, b, z], [-w, t, z], [-w2, t2, z2], [-w2, b2, z2]);
    face([w, b, z], [w2, b2, z2], [w2, t2, z2], [w, t, z]);
  }
  {
    const [z, w, b, t] = sections[0];
    face([-w, b, z], [w, b, z], [w, t, z], [-w, t, z]);
  }
  {
    const [z, w, b, t] = sections[sections.length - 1];
    face([-w, b, z], [-w, t, z], [w, t, z], [w, b, z]);
  }
  mesh(body, geometry(d, 'hull'), 0, 0, 0, 1, 1, 1, C.navy2);
  box(body, 0, -0.1, 0.5, 2.14, 0.82, 2.6, C.cream);
  box(body, 0, 0.25, 0.9, 2.06, 0.45, 2.6, C.navy2);
  const canopy = box(body, 0, 0.65, 1.02, 1.8, 0.78, 2.12, C.glass);
  canopy.rx = -0.18;
  canopy.rough = 0.15;
  box(body, 0, 0.93, 1.15, 0.11, 0.13, 2.14, C.navy);
  for (const side of [-1, 1]) {
    box(body, side * 0.9, 0.68, 1.05, 0.11, 0.11, 2.1, C.navy).rx = -0.18;
    box(body, side * 1.12, 0.2, -0.47, 0.19, 0.82, 1.25, C.yellow);
    box(body, side * 1.63, -0.08, -0.35, 2.8, 0.22, 1.25, C.navy);
    box(body, side * 2.78, 0.02, -0.32, 0.25, 0.19, 1.23, C.yellow);
    const pod = cyl(body, side * 2.08, -0.41, -0.16, 0.39, 2.2, C.navy2);
    pod.rx = PI / 2;
    for (let j = 0; j < 3; j++) {
      const muzzle = cyl(body, side * 2.08 + (j - 1) * 0.22, -0.42, 0.97, 0.079, 0.08, C.dark);
      muzzle.rx = PI / 2;
    }
    box(body, side * 0.73, 1.13, -1.31, 0.72, 0.58, 1.7, C.cream);
    box(body, side * 0.73, 1.16, -2.19, 0.53, 0.37, 0.16, C.dark);
    box(body, side * 0.73, 1.15, -2.3, 0.34, 0.22, 0.06, C.orange).emission = 0.8;
    box(body, side * 1.15, -1.15, 0.0, 0.16, 0.16, 3.7, C.navy);
    beam(body, [side * 0.83, -0.45, -0.8], [side * 1.15, -1.1, -0.8], 0.11, C.steel);
    beam(body, [side * 0.85, -0.45, 1], [side * 1.15, -1.1, 1], 0.11, C.steel);
    sphere(body, side * 2.94, 0.14, -0.35, 0.105, side > 0 ? C.red : C.cyan, 1, 1.8);
  }
  box(body, 0, 0.06, -3.38, 0.64, 0.61, 3.85, C.navy2).rx = -0.06;
  box(body, 0, 0.38, -5.28, 3.13, 0.14, 0.63, C.cream);
  box(body, 0, 0.89, -5.34, 0.25, 1.58, 1.24, C.navy2).rx = -0.27;
  box(body, 0, 1.57, -5.39, 0.29, 0.34, 0.8, C.yellow);
  cyl(body, 0, 1.75, -0.42, 0.18, 1, C.steel);
  cyl(body, 0, 2.2, -0.42, 0.5, 0.18, C.navy);
  const rotor = group(body, 0, 2.34, -0.42);
  for (let i = 0; i < 4; i++) {
    const blade = group(rotor);
    blade.ry = (i * PI) / 2;
    box(blade, 0, 0, 2.93, 0.36, 0.07, 5.8, C.dark);
    box(blade, 0, 0.012, 5.67, 0.4, 0.073, 0.47, C.yellow);
  }
  const rotorBlur = ring(body, 0, 2.33, -0.42, 5.9, C.cream, 0.1);
  const tailRotor = group(body, 0.27, 0.86, -5.5);
  tailRotor.rz = PI / 2;
  for (let i = 0; i < 2; i++) {
    const p = box(tailRotor, 0, 0, 0, 0.12, 0.09, 1.9, C.dark);
    p.ry = (i * PI) / 2;
  }
  box(body, 0, -0.77, 1.44, 0.48, 0.3, 1.05, C.navy);
  const gun = box(body, 0, -0.8, 2.13, 0.18, 0.18, 1.07, C.dark);
  stud(body, -0.6, 0.64, -0.9, C.cream, 0.19);
  stud(body, 0.6, 0.64, -0.9, C.cream, 0.19);
  return { root, body, rotor, tailRotor, rotorBlur, gun };
}

/* ---------------------------------------------------------------- actors */

/** Dress an enemy's root/head nodes; returns its hit height, radius and any shield nodes. */
export function enemyModel(type, root, head) {
  const out = { y: 3.5, radius: 1.75, shield: null, shieldRing: null };
  if (type === 'relay') {
    box(root, 0, 0.3, 0, 6.5, 0.6, 5.5, C.navy);
    box(root, 0, 1.8, 0, 3, 3, 2.6, C.cream);
    box(root, 0, 2, 1.34, 2.2, 0.62, 0.06, C.red);
    for (const x of [-1.8, 1.8]) for (const z of [-1.45, 1.45]) beam(root, [x, 0.5, z], [x * 0.6, 6, z * 0.6], 0.29, C.steel);
    box(root, 0, 5.8, 0, 4.3, 0.43, 3.4, C.cream);
    head.y = 6.4;
    box(head, 0, 0.5, 0, 4.8, 2.4, 0.43, C.navy2);
    for (let x = -1.8; x <= 1.8; x += 0.72) box(head, x, 0.5, 0.24, 0.13, 2.2, 0.06, C.cyan).emission = 0.45;
    box(head, 0, 1.9, 0, 0.14, 1.25, 0.14, C.cream);
    sphere(head, 0, 2.6, 0, 0.2, C.red, 1, 1.5);
    out.y = 6;
    out.radius = 3;
  } else if (type === 'boss') {
    box(root, 0, 1.7, 0, 7.5, 2.9, 11.6, C.navy);
    for (const s of [-1, 1]) {
      box(root, s * 3.7, 0.8, 0, 1.45, 1.8, 11.7, C.dark);
      for (let z = -4.5; z <= 4.5; z += 1.8) {
        const wheel = cyl(root, s * 4.44, 0.95, z, 0.68, 0.18, C.steel);
        wheel.rz = PI / 2;
      }
      box(root, s * 2.6, 3.3, 0, 1.6, 0.6, 9, C.cream);
      box(root, s * 2.6, 3.7, 3.6, 1.7, 0.16, 0.7, C.orange);
      box(root, s * 2.6, 3.7, -3.6, 1.7, 0.16, 0.7, C.orange);
    }
    box(root, 0, 3.45, 3.8, 3.2, 1.1, 3, C.navy2);
    box(root, 0, 3.6, 5.35, 2.7, 0.45, 0.08, C.red).emission = 0.4;
    cyl(root, 0, 4.15, -1.5, 1.85, 3.2, C.cream);
    cyl(root, 0, 5.76, -1.5, 1.72, 0.12, C.dark);
    cyl(root, 0, 6.7, -1.5, 0.87, 3.2, C.cream);
    mesh(root, coneGeo, 0, 8.7, -1.5, 0.88, 1.4, 0.88, C.red);
    cyl(root, 0, 6.3, -1.5, 0.89, 0.38, C.orange);
    head.y = 4.4;
    head.z = 3.3;
    box(head, 0, 0.2, 0, 1.5, 0.8, 1.8, C.steel);
    box(head, 0, 0.22, 1.5, 0.34, 0.27, 2, C.dark);
    out.shield = sphere(root, 0, 2.5, -0.7, 7.7, C.cyan, 0.13, 0.5);
    out.shield.sy = 6.5;
    out.shield.sz = 8.6;
    out.shield.cast = false;
    out.shieldRing = ring(root, 0, 0.06, 0, 8.4, C.cyan, 0.6, 0.4);
    out.y = 5.5;
    out.radius = 5;
  } else if (type === 'drone') {
    root.y = 10;
    box(root, 0, 0, 0, 1.4, 0.55, 1.8, C.navy);
    for (const s of [-1, 1]) {
      box(root, s * 1.2, 0, 0, 1.5, 0.13, 0.24, C.red);
      ring(root, s * 1.6, 0.15, 0, 0.7, C.dark);
    }
    sphere(root, 0, 0.06, 1, 0.23, C.red, 1, 1);
    out.y = 10;
    out.radius = 1.3;
  } else if (type === 'boat' || type === 'mboat') {
    // Hostile patrol craft: the harbour boats' hull in navy and red, a gun or a missile rack.
    const missile = type === 'mboat';
    root.y = -0.05;
    box(root, 0, 0.55, 0, 3.1, 1.4, 8.2, C.navy);
    box(root, 0, 1.3, 0.3, 2.8, 0.3, 6.9, C.dark);
    box(root, 0, 1.33, 3.3, 2.1, 0.12, 1.1, C.red);
    box(root, 0, 2.05, -1.6, 1.9, 1.4, 2.3, missile ? C.navy2 : C.cream);
    box(root, 0, 2.3, -0.43, 1.6, 0.42, 0.08, C.glass);
    box(root, 0, 3.4, -2.1, 0.12, 1.5, 0.12, C.cream);
    sphere(root, 0, 4.2, -2.1, 0.17, C.red, 1, 1.4);
    for (const s of [-1, 1]) box(root, s * 1.57, 0.9, 0, 0.08, 0.3, 6.4, C.red);
    head.y = 1.6;
    head.z = 1.7;
    if (missile) {
      box(head, 0, 0.2, 0, 1.5, 0.4, 1.4, C.steel);
      for (const x of [-0.42, 0.42]) {
        const tube = box(head, x, 0.62, 0.1, 0.5, 0.5, 1.9, C.cream);
        tube.rx = -0.3;
        box(head, x, 0.4, 1.04, 0.32, 0.3, 0.1, C.red);
      }
    } else {
      box(head, 0, 0.25, 0, 1.2, 0.55, 1.2, C.steel);
      box(head, 0, 0.35, 0.95, 0.2, 0.2, 1.5, C.dark);
      box(head, 0, 0.55, -0.1, 0.5, 0.18, 0.5, C.red).emission = 0.6;
    }
    out.y = 2.2;
    out.radius = 2.6;
  } else if (type === 'tank') {
    for (const s of [-1, 1]) {
      box(root, s * 1.65, 0.6, 0, 0.7, 1.2, 4.8, C.dark);
      for (let z = -1.7; z <= 1.7; z += 0.85) {
        const w = cyl(root, s * 2.01, 0.6, z, 0.39, 0.1, C.steel);
        w.rz = PI / 2;
      }
    }
    box(root, 0, 1.1, 0, 3.3, 1.25, 4.4, C.navy2);
    box(root, 0, 1.84, -1.1, 2.7, 0.16, 0.8, C.red);
    head.y = 2;
    box(head, 0, 0.35, 0, 2.2, 0.9, 2.6, C.navy);
    box(head, 0, 0.45, 2, 0.3, 0.3, 2.6, C.steel);
    out.radius = 2.5;
    out.y = 4;
  } else if (type === 'sam') {
    box(root, 0, 0.4, 0, 3.7, 0.8, 3.6, C.navy);
    head.y = 1.4;
    for (const x of [-0.7, 0.7])
      for (const y of [0, 0.8]) {
        const p = box(head, x, y, 0.1, 0.64, 0.65, 3.1, C.cream);
        p.rx = -0.35;
        box(head, x, y - 0.5, 1.43, 0.41, 0.39, 0.16, C.red);
      }
    box(head, 0, -0.4, 0, 2.8, 0.4, 2.4, C.steel);
    out.y = 4;
    out.radius = 2.1;
  } else {
    cyl(root, 0, 0.35, 0, 1.6, 0.7, C.steel);
    box(root, 0, 1.35, 0, 1.6, 2, 1.6, C.navy);
    head.y = 2.25;
    box(head, 0, 0.15, 0, 2.15, 0.85, 1.85, C.cream);
    for (const x of [-0.55, 0.55]) box(head, x, 0.35, 1.25, 0.22, 0.23, 1.75, C.dark);
    box(head, 0, 0.6, 0.99, 0.44, 0.3, 0.06, C.red).emission = 0.8;
    out.y = 4.4;
    out.radius = 1.75;
  }
  return out;
}

export function human(parent, x, z, i) {
  const h = group(parent, x, 0, z);
  box(h, 0, 0.86, 0, 0.65, 0.76, 0.44, C.cyan);
  box(h, 0, 0.9, 0.245, 0.17, 0.5, 0.04, C.cream);
  box(h, 0, 1.51, 0, 0.47, 0.47, 0.47, '#dbb999');
  cyl(h, 0, 1.78, 0, 0.34, 0.19, C.yellow);
  box(h, 0, 1.52, 0.25, 0.33, 0.12, 0.04, C.dark);
  const hands = [box(h, -0.49, 0.8, 0, 0.21, 0.21, 0.21, '#dbb999'), box(h, 0.49, 1.14, 0, 0.21, 0.21, 0.21, '#dbb999')];
  const feet = [box(h, -0.2, 0.18, 0.05, 0.26, 0.2, 0.4, C.navy), box(h, 0.2, 0.18, 0.05, 0.26, 0.2, 0.4, C.navy)];
  return { root: h, hands, feet, index: i };
}
