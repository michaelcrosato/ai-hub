/* IRONHOLD — low-poly geometry: a small triangle builder, the structure and unit
   models, and the two battlefields. Pure data in typed arrays, no three.js.
   Every model is the original's, built with the same calls; flat normals and
   vertex colours give the faceted look. Colours above 1.0 glow. */

import { HALF, rng } from './sim.js';

const colourCache = new Map();
/** '#rrggbb' | 0xrrggbb | [r, g, b] → [r, g, b] (cached, so do not mutate the result). */
export function color(c) {
  if (Array.isArray(c)) return c;
  let v = colourCache.get(c);
  if (!v) {
    const n = typeof c === 'number' ? c : parseInt(String(c).replace('#', ''), 16);
    v = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    colourCache.set(c, v);
  }
  return v;
}
export const shade = (c, f) => color(c).map((v) => v * f);

const trigCache = new Map();
/** sin/cos of i/n·2π for i = 0..n, cached per n (rings are drawn every frame). */
function trig(n) {
  let t = trigCache.get(n);
  if (!t) {
    t = new Float32Array((n + 1) * 2);
    for (let i = 0; i <= n; i++) {
      t[i * 2] = Math.sin((i / n) * Math.PI * 2);
      t[i * 2 + 1] = Math.cos((i / n) * Math.PI * 2);
    }
    trigCache.set(n, t);
  }
  return t;
}

const corners = new Float32Array(24);
const octaUnder = [0, 0, 0]; // scratch: the darker lower half of an octahedron
const BOX_FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]];

export class Geo {
  /** cap: vertices. A fixed Geo drops triangles when full instead of growing (per-frame buffers). */
  constructor(cap = 4096, fixed = false) {
    this.cap = cap;
    this.fixed = fixed;
    this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.nor = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
  }
  reset() {
    this.n = 0;
    return this;
  }
  room(k) {
    if (this.n + k <= this.cap) return true;
    if (this.fixed) return false;
    let cap = this.cap * 2;
    while (cap < this.n + k) cap *= 2;
    for (const key of ['pos', 'nor', 'col']) {
      const a = new Float32Array(cap * 3);
      a.set(this[key]);
      this[key] = a;
    }
    this.cap = cap;
    return true;
  }
  /** One flat-shaded triangle; co is [r, g, b]. */
  tri9(ax, ay, az, bx, by, bz, cx, cy, cz, co) {
    if (!this.room(3)) return this;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const P = this.pos, N = this.nor, C = this.col, r = co[0], g = co[1], b = co[2];
    let o = this.n * 3;
    P[o] = ax; P[o + 1] = ay; P[o + 2] = az;
    P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz;
    P[o + 6] = cx; P[o + 7] = cy; P[o + 8] = cz;
    for (let k = 0; k < 3; k++, o += 3) {
      N[o] = nx; N[o + 1] = ny; N[o + 2] = nz;
      C[o] = r; C[o + 1] = g; C[o + 2] = b;
    }
    this.n += 3;
    return this;
  }
  tri(a, b, c, co) {
    return this.tri9(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], color(co));
  }
  quad(a, b, c, d, co) {
    co = color(co);
    this.tri(a, b, c, co);
    return this.tri(a, c, d, co);
  }
  quad12(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, co) {
    this.tri9(ax, ay, az, bx, by, bz, cx, cy, cz, co);
    return this.tri9(ax, ay, az, cx, cy, cz, dx, dy, dz, co);
  }
  box(x, y, z, w, h, d, co, rot = 0) {
    co = color(co);
    const c = Math.cos(rot), s = Math.sin(rot), P = corners;
    for (let i = 0; i < 8; i++) {
      const px = (i === 1 || i === 2 || i === 5 || i === 6 ? 0.5 : -0.5) * w;
      const py = (i === 2 || i === 3 || i === 6 || i === 7 ? 0.5 : -0.5) * h;
      const pz = (i >= 4 ? 0.5 : -0.5) * d;
      P[i * 3] = x + px * c + pz * s;
      P[i * 3 + 1] = y + py;
      P[i * 3 + 2] = z - px * s + pz * c;
    }
    for (const f of BOX_FACES) {
      const a = f[0] * 3, b = f[1] * 3, e = f[2] * 3, g = f[3] * 3;
      this.quad12(P[a], P[a + 1], P[a + 2], P[b], P[b + 1], P[b + 2], P[e], P[e + 1], P[e + 2], P[g], P[g + 1], P[g + 2], co);
    }
    return this;
  }
  cylinder(x, y, z, rt, rb, h, n, co, rot = 0) {
    co = color(co);
    const y0 = y - h / 2, y1 = y + h / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rot, b = ((i + 1) / n) * Math.PI * 2 + rot;
      const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
      const px = x + sa * rb, pz = z + ca * rb, qx = x + sb * rb, qz = z + cb * rb;
      const rx = x + sb * rt, rz = z + cb * rt, sx = x + sa * rt, sz = z + ca * rt;
      this.quad12(px, y0, pz, qx, y0, qz, rx, y1, rz, sx, y1, sz, co);
      if (rt) this.tri9(x, y1, z, sx, y1, sz, rx, y1, rz, co);
      if (rb) this.tri9(x, y0, z, qx, y0, qz, px, y0, pz, co);
    }
    return this;
  }
  octa(x, y, z, r, h, co, rot = 0) {
    co = color(co);
    const lo = octaUnder;
    lo[0] = co[0] * 0.85;
    lo[1] = co[1] * 0.85;
    lo[2] = co[2] * 0.85;
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2, b = a + Math.PI / 2;
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, qx = x + Math.sin(b) * r, qz = z + Math.cos(b) * r;
      this.tri9(px, y, pz, qx, y, qz, x, y + h / 2, z, co);
      this.tri9(px, y, pz, x, y - h / 2, z, qx, y, qz, lo);
    }
    return this;
  }
  ring(x, y, z, outer, inner, n, co) {
    co = color(co);
    const t = trig(n);
    for (let i = 0; i < n; i++) {
      const sa = t[i * 2], ca = t[i * 2 + 1], sb = t[i * 2 + 2], cb = t[i * 2 + 3];
      this.quad12(x + sa * inner, y, z + ca * inner, x + sa * outer, y, z + ca * outer, x + sb * outer, y, z + cb * outer, x + sb * inner, y, z + cb * inner, co);
    }
    return this;
  }
  /** A square tube from a to b, radius r (no caps). */
  beam6(ax, ay, az, bx, by, bz, r, co) {
    co = color(co);
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l;
    dy /= l;
    dz /= l;
    // u = normalize(d × (|dy| > .9 ? x : y)), v = d × u
    let ux, uy, uz;
    if (Math.abs(dy) > 0.9) {
      ux = 0; uy = dz; uz = -dy;
    } else {
      ux = -dz; uy = 0; uz = dx;
    }
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = dy * uz - dz * uy, vy = dz * ux - dx * uz, vz = dx * uy - dy * ux;
    // corner offsets at 0, 90, 180, 270 degrees: u, v, -u, -v
    const ox = [ux * r, vx * r, -ux * r, -vx * r], oy = [uy * r, vy * r, -uy * r, -vy * r], oz = [uz * r, vz * r, -uz * r, -vz * r];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      this.quad12(ax + ox[i], ay + oy[i], az + oz[i], bx + ox[i], by + oy[i], bz + oz[i], bx + ox[j], by + oy[j], bz + oz[j], ax + ox[j], ay + oy[j], az + oz[j], co);
    }
    return this;
  }
  beam(a, b, r, co) {
    return this.beam6(a[0], a[1], a[2], b[0], b[1], b[2], r, co);
  }
  /** Append another Geo, turned by rot around y and moved to (x, y, z). */
  merge(src, x = 0, y = 0, z = 0, rot = 0) {
    if (!this.room(src.n)) return this;
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = this.pos, N = this.nor, C = this.col;
    for (let i = 0; i < src.n; i++) {
      const o = (this.n + i) * 3, k = i * 3;
      const px = src.pos[k], pz = src.pos[k + 2], nx = src.nor[k], nz = src.nor[k + 2];
      P[o] = x + px * c + pz * s;
      P[o + 1] = y + src.pos[k + 1];
      P[o + 2] = z - px * s + pz * c;
      N[o] = nx * c + nz * s;
      N[o + 1] = src.nor[k + 1];
      N[o + 2] = -nx * s + nz * c;
      C[o] = src.col[k];
      C[o + 1] = src.col[k + 1];
      C[o + 2] = src.col[k + 2];
    }
    this.n += src.n;
    return this;
  }
}

/* ------------------------------------------------------------------ palette and models */

export const C = { dark: '#273e43', edge: '#3a5356', steel: '#789393', light: '#aebeb2', trim: '#d7cdb0', cyan: [0.4, 1.25, 1.13], blue: '#568c8b', yellow: '#e3ac58', red: '#ba5747', enemy: '#654340', black: '#243739' };

function foundation(g, w, d) {
  g.box(0, 0.2, 0, w + 0.8, 0.4, d + 0.8, C.dark);
  g.box(0, 0.55, 0, w, 0.6, d, C.edge);
}
function panels(g, x, y, z, w, n = 4) {
  for (let i = 0; i < n; i++) g.box(x + (i - (n - 1) / 2) * (w / n), y, z, (w / n) * 0.55, 0.15, 1.2, C.dark);
}

/** Every structure, head, unit and enemy model (the original designs plus the sapper and the juggernaut). */
export function models() {
  const out = {};
  let g = new Geo();
  g.cylinder(0, 0.45, 0, 10.8, 11.5, 0.9, 8, C.dark, Math.PI / 8);
  g.cylinder(0, 1.1, 0, 9.8, 10.6, 0.6, 8, C.light, Math.PI / 8);
  g.cylinder(0, 1.65, 0, 8.2, 8.7, 0.7, 8, C.edge, Math.PI / 8);
  g.box(0, 2.5, 0, 11, 2.2, 11, C.steel);
  g.box(0, 4.2, 0, 8, 1.5, 8, C.light);
  g.box(0, 5.25, 0, 6.6, 0.6, 6.6, C.dark);
  g.cylinder(0, 5.8, 0, 2.9, 3.6, 0.5, 8, C.cyan);
  g.octa(0, 9, 0, 2.7, 7, C.cyan, Math.PI / 4);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2, x = Math.sin(a) * 5.5, z = Math.cos(a) * 5.5;
    g.box(x, 4.5, z, 1.5, 6, 1.5, C.steel);
    g.box(x, 7.55, z, 1.7, 0.4, 1.7, C.trim);
    g.box(Math.sin(a) * 7.3, 1.6, Math.cos(a) * 7.3, 2, 1.6, 2, C.yellow);
  }
  out.core = g;

  g = new Geo();
  g.box(0, 1.9, 0, 7.85, 3.8, 2.5, C.steel);
  g.box(0, 0.5, 0, 8, 1, 3.8, C.dark);
  g.box(0, 3.8, 0, 8, 0.65, 3, C.light);
  g.box(0, 2.6, -1.29, 7.8, 0.28, 0.12, C.edge);
  for (const x of [-3, 0, 3]) g.box(x, 4.5, 0, 1.6, 0.9, 3, C.light);
  out.wall = g;

  g = new Geo();
  for (const x of [-6.3, 6.3]) {
    g.box(x, 2.65, 0, 3.3, 5.3, 5, C.steel);
    g.box(x, 5.4, 0, 3.7, 0.65, 5.4, C.light);
    g.box(x, 5.95, 0, 2.5, 0.5, 3.4, C.edge);
    g.box(x, 4.5, -2.56, 1.1, 0.4, 0.15, C.cyan);
  }
  g.box(0, 2.05, 0, 9.5, 4.1, 0.9, C.dark);
  g.box(0, 4.3, 0, 10.5, 0.65, 1.8, C.edge);
  for (let x = -3.7; x < 4; x += 1.5) {
    g.box(x, 2.1, 0, 0.3, 3.7, 1.1, C.steel);
    g.box(x, 1, -0.6, 0.8, 0.25, 0.15, C.yellow);
  }
  out.gate = g;

  g = new Geo();
  foundation(g, 6, 6);
  g.cylinder(0, 1.4, 0, 2.2, 2.9, 1.2, 8, C.steel);
  g.cylinder(0, 2.4, 0, 1.9, 2.2, 0.7, 8, C.light);
  for (const x of [-2.7, 2.7]) g.box(x, 1, 0, 0.6, 1.2, 4.5, C.dark);
  g.box(0, 1.2, -2.5, 1.5, 0.3, 0.2, C.cyan);
  out.gun = g;

  g = new Geo();
  g.box(0, 3, 0, 2.9, 1.5, 2.6, C.blue);
  g.box(0, 3.9, 0, 3.2, 0.35, 2.5, C.light);
  g.box(0, 3.2, 2.8, 0.75, 0.65, 4.5, C.dark);
  g.box(0, 3.2, 4.7, 1.05, 0.9, 0.9, C.steel);
  g.box(-1.65, 3, 0, 0.5, 0.9, 1.8, C.yellow);
  g.box(1, 3.7, 1.3, 0.8, 0.28, 0.14, C.cyan);
  out.gunHead = g;

  g = new Geo();
  foundation(g, 8, 8);
  g.cylinder(0, 1.3, 0, 3.6, 3.8, 1.2, 8, C.steel);
  g.cylinder(0, 2.05, 0, 2.6, 3.2, 0.5, 8, C.dark);
  for (const x of [-3, 3]) for (const z of [-3, 3]) g.box(x, 1.3, z, 1.1, 2, 1.1, C.light);
  out.mortar = g;

  g = new Geo();
  g.box(0, 2.6, 0, 3.7, 1.4, 3.8, C.blue);
  g.beam([0, 3, 0], [0, 6.5, 3.5], 1.0, C.dark);
  g.beam([0, 5.8, 2.8], [0, 6.8, 3.8], 1.25, C.steel);
  g.box(-2.1, 2.7, 0, 0.5, 1.4, 3.3, C.yellow);
  out.mortarHead = g;

  g = new Geo();
  foundation(g, 6, 6);
  g.cylinder(0, 1.6, 0, 2.4, 2.7, 1.8, 6, C.steel);
  g.cylinder(0, 3.3, 0, 1.1, 1.7, 2, 6, C.dark);
  g.cylinder(0, 4.4, 0, 2.3, 2.3, 0.45, 6, C.light);
  g.cylinder(0, 5.35, 0, 1.1, 1.1, 1.5, 6, C.blue);
  g.cylinder(0, 6.2, 0, 2.1, 2.1, 0.45, 6, C.trim);
  g.octa(0, 7.4, 0, 1.3, 2.4, C.cyan);
  out.arc = g;

  g = new Geo();
  foundation(g, 8, 8);
  g.box(0, 1.7, 0, 6.8, 2.5, 6, C.steel);
  for (const x of [-2, 0, 2]) {
    g.box(x, 3.5, 0, 1.2, 1.4, 4.8, C.dark);
    g.box(x, 4.3, 0, 1, 0.25, 4.6, C.blue);
    for (const z of [-1.5, 0, 1.5]) g.box(x, 4.45, z, 0.9, 0.07, 0.8, C.cyan);
  }
  g.box(0, 2.5, 3.1, 4, 0.6, 0.15, C.yellow);
  g.cylinder(-2.8, 4.5, -2.2, 0.45, 0.65, 3, 6, C.edge);
  out.generator = g;

  g = new Geo();
  foundation(g, 10, 10);
  g.box(0, 2.4, 0, 9.3, 3.7, 8, C.steel);
  g.box(0, 4.5, 0, 10, 0.8, 9, C.light);
  g.box(-1, 5.2, -1, 6, 0.7, 5.5, C.blue);
  panels(g, -1, 5.6, -1, 5, 5);
  g.box(0, 1.9, 4.08, 4.7, 2.7, 0.2, C.dark);
  g.box(0, 3.55, 4.25, 5.5, 0.5, 0.45, C.yellow);
  for (const x of [-3.5, 3.5]) g.box(x, 2.5, 4.15, 0.8, 0.35, 0.2, C.cyan);
  g.box(4, 6.3, -3, 0.2, 3.5, 0.2, C.dark);
  g.box(4.8, 7.3, -3, 1.5, 1.2, 0.1, C.blue);
  out.barracks = g;

  g = new Geo();
  foundation(g, 8, 8);
  g.box(0, 1.7, 0, 5.8, 2.4, 5.8, C.edge);
  for (const x of [-2.7, 2.7]) {
    for (const z of [-2.7, 2.7]) {
      g.box(x, 3.2, z, 0.65, 5.3, 0.65, C.steel);
      g.box(x, 5.9, z, 0.9, 0.35, 0.9, C.yellow);
    }
  }
  g.box(0, 5.9, 0, 6.6, 0.6, 6.6, C.steel);
  g.cylinder(0, 3.2, 0, 1.2, 1.6, 4.8, 6, C.yellow);
  g.box(0, 1.2, 3.7, 6.6, 1.3, 0.6, C.dark);
  g.box(0, 1.4, 4.03, 4, 0.35, 0.12, C.cyan);
  out.mine = g;

  g = new Geo();
  foundation(g, 6, 6);
  g.box(0, 1.8, 0, 5.2, 2.5, 5.2, C.steel);
  g.box(0, 3.2, 0, 5.9, 0.5, 5.9, C.light);
  g.cylinder(0, 4.6, 0, 0.4, 0.6, 2.3, 6, C.dark);
  g.octa(0, 6.4, 0, 1.7, 2.5, C.cyan);
  g.box(0, 2.2, 2.65, 2.4, 0.45, 0.15, C.cyan);
  g.box(0, 2.2, 2.65, 0.45, 1.6, 0.18, C.cyan);
  out.relay = g;

  // Infantry use team tint on their light armor; equipment remains dark.
  g = new Geo();
  g.box(-0.38, 0.65, 0, 0.55, 1.3, 0.7, '#3a4a47');
  g.box(0.38, 0.65, 0, 0.55, 1.3, 0.7, '#3a4a47');
  g.box(0, 1.65, 0, 1.35, 1.15, 0.9, '#a5b5ad');
  g.box(0, 1.65, -0.6, 0.85, 1.05, 0.45, '#4c625e');
  g.cylinder(0, 2.7, 0, 0.72, 0.65, 0.85, 6, '#b3c4b7');
  g.box(0, 2.65, 0.62, 0.9, 0.3, 0.14, '#263e3e');
  g.box(0.75, 1.65, 0.8, 0.4, 0.42, 1.9, '#273d3a');
  g.box(-0.68, 1.65, 0.25, 0.4, 0.75, 0.4, '#9eb7aa');
  out.soldier = g;

  g = new Geo();
  for (const x of [-0.7, 0.7]) {
    g.box(x, 0.7, 0, 0.4, 1.4, 0.5, C.enemy);
    g.box(x, 0.15, 0.25, 0.5, 0.3, 0.95, C.dark);
  }
  g.box(0, 1.55, 0, 1.8, 1.15, 1.3, C.red);
  g.cylinder(0, 2.6, 0, 0.6, 0.75, 0.9, 4, C.dark, Math.PI / 4);
  g.box(0, 2.7, 0.6, 0.9, 0.2, 0.2, [1.35, 0.36, 0.12]);
  for (const x of [-1.15, 1.15]) g.box(x, 1.4, 0.5, 0.45, 0.4, 1.8, C.enemy);
  out.raider = g;

  g = new Geo();
  g.octa(0, 1.1, 0, 1.45, 1.4, C.red, Math.PI / 4);
  for (const x of [-1, 1]) for (const z of [-0.7, 0.7]) g.beam([x * 0.55, 1.2, z * 0.5], [x * 1.55, 0.2, z * 1.4], 0.2, C.dark);
  g.box(0, 1.15, 1.1, 0.8, 0.25, 0.2, [1.3, 0.36, 0.1]);
  out.runner = g;

  g = new Geo();
  for (const x of [-2.2, 2.2]) g.box(x, 0.9, 0, 1.15, 1.8, 5, C.dark);
  g.box(0, 1.4, 0, 3.8, 1.8, 4.6, C.red);
  g.box(0, 2.5, 0, 3.2, 0.65, 3.8, C.enemy);
  g.box(0, 3.35, 0.1, 2.9, 1.2, 2.8, C.red);
  g.box(0, 3.4, 2.5, 1, 0.75, 3.1, C.dark);
  for (const x of [-1.1, 1.1]) g.box(x, 1.6, 2.4, 0.7, 0.45, 0.2, [1.4, 0.44, 0.13]);
  out.brute = g;

  g = new Geo();
  g.cylinder(0, 1.5, 0, 2.1, 2.7, 2, 6, C.enemy);
  g.box(0, 2.65, 0, 3.3, 1.1, 4, C.red);
  g.beam([0, 3.0, 0], [0, 5.1, 4], 0.65, C.dark);
  g.beam([0, 4.85, 3.5], [0, 5.35, 4.45], 0.9, C.red);
  for (const x of [-1, 1]) for (const z of [-1.8, 0, 1.8]) g.beam([x * 1.5, 1.4, z], [x * 3, 0.2, z * 1.25], 0.32, C.dark);
  out.siege = g;

  // New: the sapper — a light runner with a glowing demolition charge on its back.
  g = new Geo();
  for (const x of [-0.45, 0.45]) {
    g.box(x, 0.6, 0.1, 0.35, 1.2, 0.45, C.enemy);
    g.box(x, 0.12, 0.3, 0.45, 0.25, 0.8, C.dark);
  }
  g.box(0, 1.45, 0, 1.3, 0.95, 1.0, C.red);
  g.box(0, 1.6, -0.78, 1.05, 1.05, 0.62, C.dark);
  g.box(0, 2.18, -0.78, 0.7, 0.16, 0.44, [1.5, 0.66, 0.16]);
  for (const x of [-0.38, 0.38]) g.box(x, 1.6, -1.1, 0.22, 0.8, 0.06, [1.35, 0.52, 0.14]);
  g.cylinder(0, 2.3, 0.05, 0.42, 0.55, 0.62, 5, C.dark);
  g.box(0, 2.3, 0.5, 0.62, 0.14, 0.12, [1.35, 0.36, 0.12]);
  out.sapper = g;

  // New: the juggernaut — a heavy tracked assault walker with twin cannons.
  g = new Geo();
  for (const x of [-2.7, 2.7]) {
    g.box(x, 1.15, 0, 1.6, 2.3, 6.4, C.dark);
    g.box(x, 2.42, 0, 1.3, 0.3, 5.8, C.enemy);
    for (const z of [-2.2, 0, 2.2]) g.cylinder(x * 1.03, 1.1, z, 0.9, 0.9, 1.7, 6, C.black, Math.PI / 6);
  }
  g.box(0, 2.3, 0, 4.4, 2.2, 6, C.red);
  g.box(0, 3.75, -0.4, 3.8, 1.2, 4.4, C.enemy);
  g.box(0, 4.85, 0.2, 3, 1.35, 3, C.red);
  g.box(0, 5.62, 0.2, 2.4, 0.3, 2.4, C.dark);
  for (const x of [-0.75, 0.75]) g.beam([x, 4.8, 1.3], [x, 5.05, 5.8], 0.34, C.dark);
  g.box(0, 4.95, 1.74, 2.2, 0.32, 0.16, [1.5, 0.42, 0.14]);
  g.box(0, 2.75, 3.03, 3.8, 0.45, 0.16, [1.3, 0.36, 0.12]);
  for (const x of [-1.5, 1.5]) g.cylinder(x, 6.1, -1.9, 0.32, 0.42, 1.8, 6, C.black);
  for (const x of [-2.1, 2.1]) g.box(x, 3.85, 2.1, 0.4, 0.6, 0.6, C.yellow);
  out.juggernaut = g;
  return out;
}

/** A flat white ring (tinted per instance) for unit markers. */
export function ringModel(outer, inner, n) {
  return new Geo(n * 6 + 6).ring(0, 0, 0, outer, inner, n, [1, 1, 1]);
}

/* ------------------------------------------------------------------ battlefields */

/** The base floor inside the walls: service strips, the core ring and lane dashes (both maps). */
function baseFloor(g) {
  for (const s of [-1, 1]) {
    g.box(s * 39, 0.1, 0, 3, 0.15, 78, '#90917a');
    g.box(0, 0.1, s * 39, 78, 0.15, 3, '#90917a');
  }
  g.ring(0, 0.12, 0, 15.2, 14.5, 8, '#c0b28a');
  for (let i = -4; i <= 4; i++) {
    if (Math.abs(i) < 2) continue;
    g.box(i * 6, 0.14, 10, 2.8, 0.08, 0.35, '#b2ab8a');
    g.box(i * 6, 0.14, -10, 2.8, 0.08, 0.35, '#b2ab8a');
  }
}

/** Supply crates, lights and corner watch posts inside the base (both maps). */
function baseProps() {
  const g = new Geo(8192);
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      const x = s * 46, z = t * 46;
      g.box(x, 3.1, z, 6, 6.2, 6, C.edge);
      g.box(x, 6.3, z, 6.7, 0.6, 6.7, C.light);
      g.box(x, 6.85, z, 4, 0.5, 4, C.dark);
      g.box(x, 8, z, 0.18, 2.6, 0.18, C.dark);
      g.box(x + 0.8, 8.8, z, 1.4, 1, 0.08, C.blue);
      for (let j = 0; j < 3; j++) {
        const q = s * (28 + j * 3);
        g.box(q, 0.9, t * 27, 2.5, 1.8, 2.3, j % 2 ? C.edge : C.trim);
        g.box(q, 1.85, t * 27, 2.6, 0.15, 2.4, C.dark);
      }
    }
  }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    const x = Math.sin(a) * 33, z = Math.cos(a) * 33;
    g.box(x, 2.6, z, 0.35, 5.2, 0.35, C.dark);
    g.box(x, 5.3, z, 1.3, 0.35, 1.3, C.yellow);
    g.box(x, 5.05, z, 1, 0.2, 1, C.cyan);
  }
  return g;
}

function treeModel() {
  const tree = new Geo(512);
  tree.cylinder(0, 2.1, 0, 0.43, 0.6, 4.2, 5, '#555448');
  tree.cylinder(0, 5.4, 0, 0, 3.1, 6.7, 6, '#324f48', 0.3);
  tree.cylinder(0, 8.1, 0, 0, 2.3, 5.1, 6, '#426454');
  return tree;
}
function rockModel() {
  const rock = new Geo(256);
  rock.cylinder(0, 0.4, 0, 0.58, 1, 1, 5, '#777e73', 0.4);
  rock.cylinder(-0.17, 0.9, 0.1, 0.15, 0.63, 0.8, 5, '#90958a', 0.1);
  return rock;
}
function rubbleModel() {
  return new Geo(64).octa(0, 0.5, 0, 1.2, 1.8, '#8b8d78', 0.3);
}

function depositSeams(g, map, R) {
  const H = map.height;
  for (const d of map.deposits) {
    g.cylinder(d.x, H(d.x, d.z) + 0.12, d.z, 6.4, 6.5, 0.25, 8, '#676653');
    g.ring(d.x, H(d.x, d.z) + 0.27, d.z, 7.1, 6.85, 32, '#c4a468');
    for (let j = 0; j < 7; j++) {
      const a = R() * 6.28, rr = R() * 3.5, x = d.x + Math.sin(a) * rr, z = d.z + Math.cos(a) * rr;
      g.octa(x, H(x, z) + 0.7 + R(), z, 0.65 + R() * 0.9, 2 + R() * 3, '#d0a34f', R() * 6.28);
    }
  }
}

function rockInstances(map, R, mainTint, chipTint) {
  const H = map.height, rs = [];
  for (const p of map.rocks) {
    rs.push({ x: p.x, y: H(p.x, p.z) - 1, z: p.z, sx: p.r, sy: p.h, sz: p.r * 0.9, rot: p.seed * 6.28, tint: mainTint });
    for (let j = 0; j < 3; j++) {
      const a = R() * 6.28, r = p.r * 0.8;
      rs.push({ x: p.x + Math.sin(a) * r, y: H(p.x, p.z) - 0.6, z: p.z + Math.cos(a) * r, sx: p.r * 0.5, sy: p.h * (0.22 + R() * 0.4), sz: p.r * 0.48, rot: R() * 6.28, tint: chipTint });
    }
  }
  return rs;
}

/** Blackpine Basin, built exactly as the original (same random sequence, same order). */
function blackpine(map) {
  const H = map.height, R = rng(77061), g = new Geo(40000), step = 8;
  const ground = ['#66735a', '#6b765c', '#727e61', '#68765a', '#77815f', '#6d7859'];
  for (let z = -HALF; z < HALF; z += step) {
    for (let x = -HALF; x < HALF; x += step) {
      const a = [x, H(x, z), z], b = [x + step, H(x + step, z), z], c = [x + step, H(x + step, z + step), z + step], d = [x, H(x, z + step), z + step];
      const base = Math.max(Math.abs(x + 4), Math.abs(z + 4)) < 52;
      const co = base ? ['#787e67', '#7c806c', '#80846d'][Math.floor(R() * 3)] : ground[Math.floor(R() * ground.length)];
      if (R() > 0.5) {
        g.tri(a, d, b, co);
        g.tri(b, d, c, shade(co, 0.97 + R() * 0.05));
      } else {
        g.tri(a, c, b, co);
        g.tri(a, d, c, shade(co, 0.97 + R() * 0.05));
      }
    }
  }
  // Four main roads and the base service grid are baked into one static mesh.
  const road = '#99957b';
  for (let side = 0; side < 2; side++) {
    for (let t = -HALF; t < HALF; t += 4) {
      const w = Math.abs(t) < 52 ? 7 : 5.7;
      const pts = side ? [[t, -w], [t, w], [t + 4, w], [t + 4, -w]] : [[-w, t], [-w, t + 4], [w, t + 4], [w, t]];
      g.quad(...pts.map(([x, z]) => [x, H(x, z) + 0.055, z]), shade(road, 0.96 + R() * 0.09));
    }
  }
  baseFloor(g);
  const terrain = g;

  // Dense but instanced trees: one shared 34-triangle model for the forest.
  const trees = [], treePoints = [];
  for (let i = 0; i < 1650; i++) {
    const x = (R() - 0.5) * 375, z = (R() - 0.5) * 375;
    if (Math.max(Math.abs(x), Math.abs(z)) < 62 || Math.abs(x) < 13 || Math.abs(z) < 13 || map.deposits.some((d) => Math.hypot(d.x - x, d.z - z) < 11) || map.rocks.some((d) => Math.hypot(d.x - x, d.z - z) < d.r + 1)) continue;
    const density = (Math.sin(x * 0.055) * Math.cos(z * 0.071) + 1) * 0.5;
    if (R() > density * 0.7 + 0.22) continue;
    const s = 0.7 + R() * 0.85;
    trees.push({ x, y: H(x, z), z, s, rot: R() * 6.28, tint: [0.84 + R() * 0.23, 0.86 + R() * 0.2, 0.85 + R() * 0.2] });
    treePoints.push({ x, z, s });
  }
  const rocks = rockInstances(map, R, null, [0.8, 0.85, 0.84]);
  const rubble = [];
  for (let i = 0; i < 320; i++) {
    const x = (R() - 0.5) * 375, z = (R() - 0.5) * 375;
    if (Math.max(Math.abs(x), Math.abs(z)) < 56 || Math.abs(x) < 9 || Math.abs(z) < 9) continue;
    rubble.push({ x, y: H(x, z), z, s: 0.4 + R() * 1.5, rot: R() * 6.28 });
  }
  // Amber seams make economy sites visible at both camera scales.
  const deposits = new Geo(8192);
  depositSeams(deposits, map, R);
  const props = baseProps();
  // Flat grass tufts add scale, with no alpha textures or extra render passes.
  const grass = new Geo(8192);
  for (let i = 0; i < 1100; i++) {
    const x = (R() - 0.5) * 380, z = (R() - 0.5) * 380;
    if (Math.max(Math.abs(x), Math.abs(z)) < 54 || Math.abs(x) < 8 || Math.abs(z) < 8) continue;
    const y = H(x, z) + 0.05, h = 0.6 + R();
    grass.tri([x - 0.35, y, z], [x, y + h, z], [x + 0.25, y, z], R() > 0.5 ? '#90936a' : '#4f674e');
    grass.tri([x, y, z - 0.4], [x, y + h * 0.8, z], [x, y, z + 0.3], '#748156');
  }
  return { terrain, deposits, props, grass, trees, rocks, rubble, treePoints, roadColour: '#7e8164', groundColour: [65, 80, 65], baseColour: '#73846a', forest: '#304e43', rockColour: '#8b9180' };
}

/** A straight road strip of half-width w from (ax, az) to (bx, bz), draped on the terrain. */
function roadStrip(g, H, ax, az, bx, bz, w, co, R) {
  const L = Math.hypot(bx - ax, bz - az);
  if (L < 0.01) return;
  const dx = (bx - ax) / L, dz = (bz - az) / L, px = -dz * w, pz = dx * w;
  const n = Math.ceil(L / 4);
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * L, t1 = ((i + 1) / n) * L;
    const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
    const c = shade(co, 0.96 + R() * 0.09);
    g.quad12(
      x0 - px, H(x0 - px, z0 - pz) + 0.07, z0 - pz,
      x0 + px, H(x0 + px, z0 + pz) + 0.07, z0 + pz,
      x1 + px, H(x1 + px, z1 + pz) + 0.07, z1 + pz,
      x1 - px, H(x1 - px, z1 - pz) + 0.07, z1 - pz,
      c
    );
  }
}

/** A rusted excavator left in the quarry (decoration only). */
function excavator() {
  const p = new Geo(1024);
  p.box(0, 0.8, 0, 7.4, 1.6, 4.8, '#394744');
  for (const z of [-1.9, 1.9]) p.box(0, 0.8, z, 7.8, 1.2, 0.9, '#2f3b39');
  p.box(0, 2.45, 0, 5.4, 1.7, 4.1, '#a8834a');
  p.box(-1.5, 4.05, 0.7, 2.3, 1.6, 2.2, '#8d6c43');
  p.box(-1.5, 4.25, 1.82, 1.9, 0.9, 0.1, '#2d3d3f');
  p.box(-2.4, 2.9, 0, 0.8, 0.6, 3.8, '#6d5a3c');
  p.beam([1.4, 3.2, 0], [5.2, 7.8, 0], 0.45, '#9a7443');
  p.beam([5.2, 7.8, 0], [8.4, 3.4, 0], 0.38, '#9a7443');
  p.box(8.6, 2.5, 0, 1.9, 1.5, 2.5, '#5b5a4c');
  p.box(9.3, 1.7, 0, 0.5, 0.3, 2.6, '#6b6a5a');
  return p;
}
/** A gantry that once carried ore out of the pit. */
function gantry() {
  const p = new Geo(1024);
  for (const x of [-9, 9]) {
    for (const z of [-2, 2]) p.box(x, 5, z, 0.6, 10, 0.6, '#5a5147');
    p.box(x, 0.4, 0, 2.6, 0.8, 5.4, '#3a4644');
  }
  p.box(0, 10.3, 0, 21, 0.7, 5, '#8f6f45');
  p.box(0, 10.8, -2.2, 21, 0.35, 0.3, '#6b5638');
  p.box(3, 9, 0, 2.6, 1.8, 2.8, '#a8834a');
  p.beam([3, 8, 0], [3, 3.5, 0], 0.08, '#2f3b39');
  p.box(3, 3, 0, 1.6, 1, 1.6, '#5b5a4c');
  return p;
}

/** Redcliff Quarry: a dusty bowl inside a ring of red cliffs. */
function redcliff(map) {
  const H = map.height, R = rng(90211), g = new Geo(40000), step = 8;
  const ground = ['#7b7159', '#80755b', '#857a5e', '#786f57', '#8a7d5f', '#7d7358'];
  for (let z = -HALF; z < HALF; z += step) {
    for (let x = -HALF; x < HALF; x += step) {
      const a = [x, H(x, z), z], b = [x + step, H(x + step, z), z], c = [x + step, H(x + step, z + step), z + step], d = [x, H(x, z + step), z + step];
      const base = Math.max(Math.abs(x + 4), Math.abs(z + 4)) < 52;
      const r = Math.hypot(x + 4, z + 4);
      // A reddish band under the cliffs, pale dust on the pit floor.
      const co = base ? ['#7e7b69', '#827d6b', '#86806d'][Math.floor(R() * 3)] : r > 100 && r < 128 ? ['#86695a', '#8d6f5d', '#7f6556'][Math.floor(R() * 3)] : ground[Math.floor(R() * ground.length)];
      if (R() > 0.5) {
        g.tri(a, d, b, co);
        g.tri(b, d, c, shade(co, 0.97 + R() * 0.05));
      } else {
        g.tri(a, c, b, co);
        g.tri(a, d, c, shade(co, 0.97 + R() * 0.05));
      }
    }
  }
  const road = '#9a8f74';
  for (const line of map.roads) {
    for (let i = 1; i < line.length; i++) roadStrip(g, H, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1], 5.2, road, R);
    for (let i = 1; i < line.length - 1; i++) {
      const [x, z] = line[i];
      g.ring(x, H(x, z) + 0.075, z, 5.2, 0.01, 10, shade(road, 0.99));
    }
  }
  baseFloor(g);
  const terrain = g;

  const trees = [], treePoints = [];
  const nearRoad = (x, z, m) => map.roads.some((line) => line.some((p, i) => i > 0 && segDist(x, z, line[i - 1], p) < m));
  for (let i = 0; i < 900; i++) {
    const x = (R() - 0.5) * 375, z = (R() - 0.5) * 375;
    if (Math.max(Math.abs(x), Math.abs(z)) < 62 || map.deposits.some((d) => Math.hypot(d.x - x, d.z - z) < 11) || map.rocks.some((d) => Math.hypot(d.x - x, d.z - z) < d.r + 1) || nearRoad(x, z, 9)) continue;
    // Pines cling to the cliff ring and the outer plateau; the pit floor is bare.
    const r = Math.hypot(x, z), density = r < 96 ? 0.12 : r < 132 ? 0.75 : 0.5;
    if (R() > density) continue;
    const s = 0.65 + R() * 0.8;
    trees.push({ x, y: H(x, z), z, s, rot: R() * 6.28, tint: [0.9 + R() * 0.2, 0.86 + R() * 0.16, 0.8 + R() * 0.14] });
    treePoints.push({ x, z, s });
  }
  const rocks = rockInstances(map, R, [1.16, 0.92, 0.84], [1.02, 0.82, 0.76]);
  const rubble = [];
  for (let i = 0; i < 520; i++) {
    const x = (R() - 0.5) * 375, z = (R() - 0.5) * 375;
    if (Math.max(Math.abs(x), Math.abs(z)) < 56 || nearRoad(x, z, 6)) continue;
    rubble.push({ x, y: H(x, z), z, s: 0.4 + R() * 1.7, rot: R() * 6.28, tint: [1.08, 0.94, 0.86] });
  }
  const deposits = new Geo(8192);
  depositSeams(deposits, map, R);
  const props = baseProps();
  // Derelict quarry machines along the outer edge (outside the build area).
  const ex = excavator(), gy = gantry();
  for (const [x, z, rot] of [[-176, -120, 0.7], [178, -108, 2.4], [-128, 178, -0.4], [176, 128, 3.6]]) props.merge(ex, x, H(x, z), z, rot);
  for (const [x, z, rot] of [[-178, 40, Math.PI / 2], [30, -178, 0.1]]) props.merge(gy, x, H(x, z), z, rot);
  // Ore spoil heaps beside the machines.
  for (const [x, z] of [[-168, -150], [160, -140], [-150, 172]]) {
    for (let j = 0; j < 5; j++) {
      const a = R() * 6.28, rr = R() * 5, px = x + Math.sin(a) * rr, pz = z + Math.cos(a) * rr;
      props.octa(px, H(px, pz) + 1, pz, 2 + R() * 2.5, 3 + R() * 4, j % 2 ? '#8c6e55' : '#7a6150', R() * 6.28);
    }
  }
  const grass = new Geo(8192);
  for (let i = 0; i < 800; i++) {
    const x = (R() - 0.5) * 380, z = (R() - 0.5) * 380;
    if (Math.max(Math.abs(x), Math.abs(z)) < 54 || nearRoad(x, z, 6)) continue;
    const y = H(x, z) + 0.05, h = 0.5 + R() * 0.9;
    grass.tri([x - 0.35, y, z], [x, y + h, z], [x + 0.25, y, z], R() > 0.5 ? '#9a8e64' : '#6f6a4c');
    grass.tri([x, y, z - 0.4], [x, y + h * 0.8, z], [x, y, z + 0.3], '#857a55');
  }
  return { terrain, deposits, props, grass, trees, rocks, rubble, treePoints, roadColour: '#96896c', groundColour: [92, 84, 66], baseColour: '#817c67', forest: '#3f5046', rockColour: '#98786a' };
}

function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
  const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

export const MODELS = { tree: treeModel, rock: rockModel, rubble: rubbleModel };

/** Everything static on a battlefield: meshes as Geo plus instance lists. */
export function landscape(map) {
  return map.id === 'redcliff' ? redcliff(map) : blackpine(map);
}
