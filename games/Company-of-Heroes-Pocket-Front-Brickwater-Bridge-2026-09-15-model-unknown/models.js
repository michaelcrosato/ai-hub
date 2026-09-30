/* Pocket Front — toy models, the palette and the two battle maps.
   Everything here is plain vertex data built from boxes, cylinders and spheres.
   view.js turns it into three.js meshes; main.js reads the map data for the rules. */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;

export const PAL = {
  blue: '#328fa4', blueDark: '#205569', red: '#db705a', redDark: '#8e403a', skin: '#f4d088', boot: '#344641',
  grass: '#95bb69', gold: '#f9d47a', cream: '#efe8ce', leaf: '#66a55a',
};

/* ------------------------------------------------------------------ colour */

// The original shader decoded vertex colours with pow(c, 2.2). The vertex data is stored already decoded.
const linearCache = new Map();
/** '#rrggbb' → linear Float32Array(3), cached. A Float32Array passes through (already linear). */
export function lin(h) {
  if (typeof h !== 'string') return h;
  let c = linearCache.get(h);
  if (!c) {
    const n = parseInt(h.slice(1), 16);
    c = new Float32Array([Math.pow(((n >> 16) & 255) / 255, 2.2), Math.pow(((n >> 8) & 255) / 255, 2.2), Math.pow((n & 255) / 255, 2.2)]);
    linearCache.set(h, c);
  }
  return c;
}
/** The original shade(): scale the display colour, clamp, then decode. */
export function shade(h, f) {
  let d;
  if (typeof h === 'string') {
    const n = parseInt(h.slice(1), 16);
    d = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  } else {
    d = [Math.pow(h[0], 1 / 2.2), Math.pow(h[1], 1 / 2.2), Math.pow(h[2], 1 / 2.2)];
  }
  return new Float32Array(d.map((v) => Math.pow(clamp(v * f, 0, 1), 2.2)));
}

/* ------------------------------------------------------------------ seeded random (the map's scatter) */

let seed = 731;
export function reseed(s) {
  seed = s >>> 0;
}
export function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const rand = (a, b) => lerp(a, b, random());

/* ------------------------------------------------------------------ Geo: a flat-shaded triangle builder */

/**
 * Writes non-indexed triangles (position, normal, linear colour, emit) into typed arrays.
 * The builder transform (set) places, turns (about Y) and scales everything drawn after it,
 * exactly like the original renderer's Geo. `emit` 0..1 blends toward a glow; 2 marks water.
 * A fixed-capacity Geo (growable = false) never reallocates, so view.js can bind its arrays
 * straight to GPU buffers and rebuild them every frame without garbage.
 */
export class Geo {
  constructor(capacity = 4096, growable = true) {
    this.cap = capacity;
    this.growable = growable;
    this.pos = new Float32Array(capacity * 3);
    this.nor = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.emi = new Float32Array(capacity);
    this.n = 0;
    this.k = new Float32Array(3 * 8); // corner scratch
    this.set();
  }
  reset() {
    this.n = 0;
    return this.set();
  }
  set(x = 0, y = 0, z = 0, a = 0, s = 1) {
    this.tx = x;
    this.ty = y;
    this.tz = z;
    this.s = s;
    this.cs = Math.cos(a);
    this.sn = Math.sin(a);
    return this;
  }
  room(count) {
    if (this.n + count <= this.cap) return true;
    if (!this.growable) return false;
    let cap = this.cap;
    while (cap < this.n + count) cap *= 2;
    const grow = (a, k) => {
      const b = new Float32Array(cap * k);
      b.set(a);
      return b;
    };
    this.pos = grow(this.pos, 3);
    this.nor = grow(this.nor, 3);
    this.col = grow(this.col, 3);
    this.emi = grow(this.emi, 1);
    this.cap = cap;
    return true;
  }
  /** Corner i of the scratch list. */
  c(i, x, y, z) {
    const k = this.k;
    k[i * 3] = x;
    k[i * 3 + 1] = y;
    k[i * 3 + 2] = z;
  }
  /**
   * Triangle from scratch corners i, j, l, flat normal from that winding.
   * flip emits i, l, j instead: the face turns around but keeps the original normal.
   * The original drew lines and rings facing down (it never culled faces); flipped, they
   * face the camera and shade exactly as before.
   */
  t(i, j, l, rgb, e, flip) {
    if (!this.room(3)) return;
    const k = this.k;
    const ax = k[i * 3], ay = k[i * 3 + 1], az = k[i * 3 + 2];
    const ux = k[j * 3] - ax, uy = k[j * 3 + 1] - ay, uz = k[j * 3 + 2] - az;
    const vx = k[l * 3] - ax, vy = k[l * 3 + 1] - ay, vz = k[l * 3 + 2] - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const d = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (d > 1e-12) {
      nx /= d;
      ny /= d;
      nz /= d;
    } else {
      nx = 0;
      ny = 1;
      nz = 0;
    }
    this.v(i, nx, ny, nz, rgb, e);
    if (flip) {
      this.v(l, nx, ny, nz, rgb, e);
      this.v(j, nx, ny, nz, rgb, e);
    } else {
      this.v(j, nx, ny, nz, rgb, e);
      this.v(l, nx, ny, nz, rgb, e);
    }
  }
  v(i, nx, ny, nz, rgb, e) {
    const k = this.k, n = this.n, s = this.s, cs = this.cs, sn = this.sn;
    const px = k[i * 3], py = k[i * 3 + 1], pz = k[i * 3 + 2];
    const o = n * 3;
    this.pos[o] = this.tx + (cs * px + sn * pz) * s;
    this.pos[o + 1] = this.ty + py * s;
    this.pos[o + 2] = this.tz + (-sn * px + cs * pz) * s;
    this.nor[o] = cs * nx + sn * nz;
    this.nor[o + 1] = ny;
    this.nor[o + 2] = -sn * nx + cs * nz;
    this.col[o] = rgb[0];
    this.col[o + 1] = rgb[1];
    this.col[o + 2] = rgb[2];
    this.emi[n] = e;
    this.n = n + 1;
  }
  q(i, j, l, m, rgb, e, flip) {
    this.t(i, j, l, rgb, e, flip);
    this.t(i, l, m, rgb, e, flip);
  }

  box(x, y, z, w, h, d, cl, ang = 0, e = 0) {
    const rgb = lin(cl), co = Math.cos(ang), si = Math.sin(ang), hh = h / 2;
    // Corner (±w/2, ±h/2, ±d/2) turned by ang about Y: x + sx·ax + sz·bx, z − sx·az + sz·bz.
    const ax = (w / 2) * co, az = (w / 2) * si, bx = (d / 2) * si, bz = (d / 2) * co;
    this.c(0, x - ax - bx, y - hh, z + az - bz);
    this.c(1, x + ax - bx, y - hh, z - az - bz);
    this.c(2, x + ax - bx, y + hh, z - az - bz);
    this.c(3, x - ax - bx, y + hh, z + az - bz);
    this.c(4, x - ax + bx, y - hh, z + az + bz);
    this.c(5, x + ax + bx, y - hh, z - az + bz);
    this.c(6, x + ax + bx, y + hh, z - az + bz);
    this.c(7, x - ax + bx, y + hh, z + az + bz);
    this.q(4, 5, 6, 7, rgb, e);
    this.q(1, 0, 3, 2, rgb, e);
    this.q(0, 4, 7, 3, rgb, e);
    this.q(5, 1, 2, 6, rgb, e);
    this.q(3, 7, 6, 2, rgb, e);
    this.q(0, 1, 5, 4, rgb, e);
  }
  cyl(x, y, z, r, h, cl, n = 10, r2 = r, e = 0) {
    const rgb = lin(cl);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      this.c(0, x + ca * r, y - h / 2, z + sa * r);
      this.c(1, x + cb * r, y - h / 2, z + sb * r);
      this.c(2, x + ca * r2, y + h / 2, z + sa * r2);
      this.c(3, x + cb * r2, y + h / 2, z + sb * r2);
      this.c(4, x, y + h / 2, z);
      this.c(5, x, y - h / 2, z);
      this.q(0, 2, 3, 1, rgb, e);
      this.t(4, 3, 2, rgb, e);
      this.t(5, 0, 1, rgb, e);
    }
  }
  sphere(x, y, z, r, cl, n = 8, rings = 5, ys = 1, e = 0) {
    const rgb = lin(cl);
    for (let j = 0; j < rings; j++) {
      const b0 = (j / rings) * Math.PI, b1 = ((j + 1) / rings) * Math.PI;
      const s0 = Math.sin(b0) * r, s1 = Math.sin(b1) * r, y0 = y + Math.cos(b0) * r * ys, y1 = y + Math.cos(b1) * r * ys;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        const c0 = Math.cos(a0), n0 = Math.sin(a0), c1 = Math.cos(a1), n1 = Math.sin(a1);
        this.c(0, x + c0 * s0, y0, z + n0 * s0);
        this.c(1, x + c1 * s0, y0, z + n1 * s0);
        this.c(2, x + c1 * s1, y1, z + n1 * s1);
        this.c(3, x + c0 * s1, y1, z + n0 * s1);
        this.q(0, 1, 2, 3, rgb, e);
      }
    }
  }
  ring(x, y, z, r, w, cl, e = 0, n = 36, start = 0, end = TAU) {
    const rgb = lin(cl), ri = r - w;
    for (let i = 0; i < n; i++) {
      const a = lerp(start, end, i / n), b = lerp(start, end, (i + 1) / n);
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      this.c(0, x + ca * ri, y, z + sa * ri);
      this.c(1, x + ca * r, y, z + sa * r);
      this.c(2, x + cb * r, y, z + sb * r);
      this.c(3, x + cb * ri, y, z + sb * ri);
      this.q(0, 1, 2, 3, rgb, e, true);
    }
  }
  line(ax, ay, az, bx, by, bz, w, cl, e = 0) {
    const dx = bx - ax, dz = bz - az, d = Math.hypot(dx, dz) || 1;
    const ox = (dz / d) * w, oz = (dx / d) * w;
    this.c(0, ax - ox, ay, az + oz);
    this.c(1, ax + ox, ay, az - oz);
    this.c(2, bx + ox, by, bz - oz);
    this.c(3, bx - ox, by, bz + oz);
    this.q(0, 1, 2, 3, lin(cl), e, true);
  }
  roof(x, y, z, w, h, d, cl) {
    const rgb = lin(cl);
    this.c(0, x - w / 2, y, z - d / 2); this.c(1, x - w / 2, y, z + d / 2); this.c(2, x, y + h, z + d / 2); this.c(3, x, y + h, z - d / 2);
    this.q(0, 1, 2, 3, rgb, 0);
    this.c(0, x, y + h, z - d / 2); this.c(1, x, y + h, z + d / 2); this.c(2, x + w / 2, y, z + d / 2); this.c(3, x + w / 2, y, z - d / 2);
    this.q(0, 1, 2, 3, shade(cl, 0.9), 0);
    this.c(0, x - w / 2, y, z - d / 2); this.c(1, x, y + h, z - d / 2); this.c(2, x + w / 2, y, z - d / 2);
    this.t(0, 1, 2, rgb, 0);
    this.c(0, x + w / 2, y, z + d / 2); this.c(1, x, y + h, z + d / 2); this.c(2, x - w / 2, y, z + d / 2);
    this.t(0, 1, 2, rgb, 0);
  }
  /** Four-sided spire: base centred at (x, y, z), apex h above. */
  pyramid(x, y, z, w, h, d, cl) {
    const rgb = lin(cl);
    this.c(0, x - w / 2, y, z - d / 2);
    this.c(1, x + w / 2, y, z - d / 2);
    this.c(2, x + w / 2, y, z + d / 2);
    this.c(3, x - w / 2, y, z + d / 2);
    this.c(4, x, y + h, z);
    this.t(3, 2, 4, rgb, 0);
    this.t(2, 1, 4, shade(cl, 0.92), 0);
    this.t(1, 0, 4, rgb, 0);
    this.t(0, 3, 4, shade(cl, 0.92), 0);
  }
}

/* ------------------------------------------------------------------ scenery pieces (from the original) */

export function house(g, b) {
  const { x, z, w, d, h, color, roof, type } = b;
  g.box(x, 0.2, z, w + 0.35, 0.35, d + 0.35, '#bcc1a3');
  g.box(x, h / 2 + 0.3, z, w, h, d, color);
  g.box(x, 0.6, z, w + 0.08, 0.28, d + 0.08, '#d0bc91');
  g.box(x, h + 0.27, z, w + 0.2, 0.2, d + 0.2, '#e5cda3');
  g.roof(x, h + 0.35, z, w + 0.7, 1.6, d + 0.65, roof);
  g.box(x + 0.95, h + 1.6, z - 0.75, 0.58, 1.45, 0.62, '#dbc59e');
  g.box(x + 0.95, h + 2.35, z - 0.75, 0.72, 0.16, 0.74, '#af8c74');
  // Roof tiles form a clear low-poly rhythm.
  const tile = shade(roof, 0.82);
  for (let zz = z - d / 2; zz <= z + d / 2; zz += 0.65) {
    g.line(x - w / 2 - 0.35, h + 0.4, zz, x, h + 1.98, zz, 0.035, tile);
    g.line(x, h + 1.98, zz, x + w / 2 + 0.35, h + 0.4, zz, 0.035, tile);
  }
  const front = z + d / 2 + 0.025;
  g.box(x, 0.95, front, 0.8, 1.8, 0.12, '#667c6d');
  g.box(x, 1, front + 0.08, 0.59, 1.62, 0.08, '#52685d');
  g.cyl(x + 0.19, 0.98, front + 0.14, 0.045, 0.07, '#d5bd73', 6);
  g.box(x, 0.17, front + 0.38, 1.2, 0.25, 0.76, '#d9c7a1');
  for (const xx of [x - w * 0.3, x + w * 0.3]) {
    g.box(xx, 2.13, front, 0.93, 1.03, 0.12, '#f7ebce');
    g.box(xx, 2.13, front + 0.075, 0.7, 0.8, 0.05, '#558b93');
    g.box(xx, 2.13, front + 0.11, 0.065, 0.86, 0.06, '#e1ddba');
    g.box(xx, 2.13, front + 0.11, 0.75, 0.065, 0.06, '#e1ddba');
    g.box(xx, 1.5, front + 0.18, 1.03, 0.2, 0.3, '#d29461');
    for (let i = 0; i < 3; i++) g.sphere(xx - 0.27 + i * 0.27, 1.68, front + 0.18, 0.15, i % 2 ? '#f4d382' : '#70985e', 6, 3, 0.65);
  }
  const side = x + w / 2 + 0.025;
  for (const zz of [z - d * 0.27, z + d * 0.27]) {
    g.box(side, 2.0, zz, 0.1, 1.0, 0.85, '#eddfb7');
    g.box(side + 0.06, 2.0, zz, 0.07, 0.78, 0.64, '#5d8d91');
    g.box(side + 0.1, 2, zz, 0.04, 0.83, 0.06, '#d9d4b3');
  }
  if (type === 'cafe') {
    g.box(x, 2.2, front + 0.48, w * 0.9, 0.12, 1.05, '#eed8ac');
    for (let xx = x - w * 0.42; xx < x + w * 0.42; xx += 0.42) g.box(xx, 2.22, front + 0.48, 0.21, 0.14, 1.09, b.awning || '#d07859');
    for (const xx of [x - 1.7, x + 1.7]) g.box(xx, 1.05, front + 0.88, 0.06, 2.1, 0.06, '#567668');
  }
  if (type === 'barn') {
    g.box(x, 1.1, front + 0.12, 2.1, 2.05, 0.1, '#758976');
    g.line(x - 1, 0.2, front + 0.19, x + 1, 2.0, front + 0.19, 0.06, '#d4d5b6');
    g.line(x + 1, 0.2, front + 0.19, x - 1, 2.0, front + 0.19, 0.06, '#d4d5b6');
  }
}

export function tree(g, x, z, s = 1) {
  g.set(x, 0, z, rand(0, 6), s);
  g.cyl(0, 1.0, 0, 0.2, 2.0, '#947650', 7, 0.15);
  g.box(0.3, 1.55, 0, 0.16, 0.9, 0.18, '#8a734e', -0.5);
  g.sphere(0, 2.9, 0, 1.16, '#6b9f55', 7, 4, 1.12);
  g.sphere(-0.65, 2.55, 0.3, 0.75, '#80ad5c', 7, 4);
  g.sphere(0.55, 3.13, -0.1, 0.78, '#88b461', 7, 4);
  g.sphere(0.25, 2.38, 0.65, 0.77, '#75a25a', 7, 4);
  for (let i = 0; i < 5; i++) g.box(rand(-0.85, 0.85), rand(2.2, 3.7), rand(-0.6, 0.8), 0.2, 0.2, 0.2, '#e7b571');
  g.set();
}

export function fence(g, x, z, l, a) {
  g.set(x, 0, z, a);
  for (let xx = -l / 2; xx <= l / 2; xx += 0.57) {
    g.box(xx, 0.54, 0, 0.17, 1.08, 0.15, '#e6dbb2');
    g.roof(xx, 1.08, 0, 0.17, 0.12, 0.15, '#e6dbb2');
  }
  for (const y of [0.38, 0.8]) g.box(0, y, 0, l, 0.1, 0.1, '#cec7a0');
  g.set();
}

export function crate(g, x, y, z, s) {
  g.box(x, y + s / 2, z, s, s, s, '#b89562');
  g.box(x, y + s * 0.92, z, s * 1.06, s * 0.12, s * 1.04, '#d2b17b');
  for (const xx of [-0.3, 0.3]) g.box(x + xx * s, y + s * 0.51, z, s * 0.1, s * 0.85, s * 1.03, '#9b8760');
}

export function base(g, x, z, team) {
  const c = team ? PAL.red : PAL.blue;
  g.cyl(x, 0.08, z, 2.25, 0.2, '#b6b997', 24);
  g.ring(x, 0.2, z, 2.28, 0.1, c, 0.15, 40);
  g.set(x, 0.2, z, team ? Math.PI : 0);
  g.box(0, 0.7, -1.9, 2.6, 1.4, 2.0, shade(c, 0.8));
  g.roof(0, 1.4, -1.9, 3.0, 0.9, 2.35, c);
  g.box(0, 0.64, -0.87, 0.85, 1.25, 0.04, '#314f43');
  g.box(0.8, 1.0, -0.86, 0.35, 0.35, 0.07, '#f0dfb2');
  g.box(0.8, 1, -0.82, 0.1, 0.34, 0.04, '#e17256');
  g.box(0.8, 1, -0.82, 0.33, 0.1, 0.04, '#e17256');
  g.set();
}

function lamp(g, x, z) {
  g.box(x, 1.6, z, 0.1, 3.2, 0.1, '#4f6d66');
  g.box(x, 3.23, z, 0.4, 0.18, 0.4, '#445e58');
  g.box(x, 2.98, z, 0.25, 0.35, 0.25, '#ffe9a9', 0, 0.8);
}

/** Sandbags: two staggered rows along the long side, or three lumps once broken. */
export function coverModel(g, c, broken) {
  if (broken) {
    for (let i = 0; i < 3; i++) g.box(c.x + (i - 1) * 0.45, 0.1, c.z, 0.4, 0.2, 0.32, '#bdad7f', i * 0.7);
    return;
  }
  const alongX = c.w > c.d, len = alongX ? c.w : c.d, n = Math.floor(len / 0.62);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n; i++) {
      const p = (i - (n - 1) / 2) * 0.62 + (row ? 0.15 : 0);
      g.box(c.x + (alongX ? p : 0), 0.25 + row * 0.34, c.z + (alongX ? 0 : p), 0.67, 0.36, 0.67, row ? '#d6c295' : '#c5b387', alongX ? 0 : Math.PI / 2);
      g.box(c.x + (alongX ? p : 0), 0.45 + row * 0.34, c.z + (alongX ? 0 : p), alongX ? 0.43 : 0.44, 0.045, alongX ? 0.44 : 0.43, '#dccba2');
    }
  }
}

/** The parts of a capture flag that never move (base, pole, finial, emblem). */
function flagStatic(g, p) {
  g.cyl(p.x, 0.17, p.z, 0.7, 0.28, '#bcc2a0', 10);
  g.cyl(p.x, 0.38, p.z, 0.46, 0.16, '#dce0bc', 10);
  g.box(p.x, 1.8, p.z, 0.1, 3.1, 0.1, '#ede2b8');
  g.sphere(p.x, 3.44, p.z, 0.12, '#edcd7b', 8, 3);
  const yy = 3.12;
  g.box(p.x + 0.5, yy - 0.31, p.z + 0.085, 0.12, 0.29, 0.03, '#fff1c7');
  g.box(p.x + 0.5, yy - 0.31, p.z + 0.085, 0.31, 0.09, 0.03, '#fff1c7');
}

/** The waving cloth, the owner's dashed circle and the capture arc. Rebuilt every frame. */
export function flagDynamic(g, p, time) {
  const colour = p.owner === 0 ? PAL.blue : p.owner === 1 ? PAL.red : '#e4c370';
  const rgb = lin(colour);
  const yy = 3.12, flow = Math.sin(time * 2.8 + p.x) * 0.1;
  g.c(0, p.x + 0.08, yy, p.z);
  g.c(1, p.x + 1.2, yy + flow, p.z + 0.13);
  g.c(2, p.x + 1.2, yy - 0.64 + flow, p.z + 0.13);
  g.c(3, p.x + 0.08, yy - 0.66, p.z);
  // Both faces, each with the original normal (the original drew it without culling).
  g.q(0, 1, 2, 3, rgb, 0);
  g.q(0, 1, 2, 3, rgb, 0, true);
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    g.ring(p.x, 0.13, p.z, 2.65, 0.055, colour, 0.35, 2, a, a + 0.2);
  }
  if (Math.abs(p.cap) > 0.02) g.ring(p.x, 0.14, p.z, 0.95, 0.1, p.cap > 0 ? PAL.blue : PAL.red, 0.6, 40, -Math.PI / 2, -Math.PI / 2 + TAU * Math.abs(p.cap));
}

/* ------------------------------------------------------------------ soldiers and tanks (built once, posed by view.js) */

export const INFANTRY = ['rifle', 'gunner', 'bazooka', 'grenadier', 'medic'];

/** One leg and boot, centred on x = 0 (the view places it at ±0.19). */
export function legModel(g, team) {
  const dark = team ? PAL.redDark : PAL.blueDark;
  g.box(0, 0.22, 0, 0.24, 0.42, 0.27, dark);
  g.box(0, 0.08, 0.085, 0.26, 0.16, 0.38, PAL.boot);
}

/** Torso, head, helmet, face, arms and the weapon parts that do not recoil. */
export function upperModel(g, type, team) {
  const c = team ? PAL.red : PAL.blue, dark = team ? PAL.redDark : PAL.blueDark;
  g.box(0, 0.79, 0, 0.65, 0.63, 0.43, c);
  g.box(0, 0.52, 0, 0.69, 0.14, 0.46, dark);
  g.box(-0.13, 0.8, 0.229, 0.09, 0.62, 0.04, '#b2be99');
  g.box(0.21, 0.6, 0.27, 0.23, 0.25, 0.15, '#b4af7b');
  g.box(0, 0.85, -0.31, 0.46, 0.48, 0.22, dark);
  g.box(0, 1.3, 0.015, 0.49, 0.45, 0.43, PAL.skin);
  g.cyl(0, 1.51, 0.005, 0.37, 0.16, c, 10);
  g.cyl(0, 1.63, -0.025, 0.325, 0.23, c, 10, 0.24);
  g.box(0, 1.46, 0.28, 0.48, 0.07, 0.11, dark);
  // A friendly, visible face.
  g.box(-0.105, 1.3, 0.238, 0.052, 0.065, 0.015, '#354740');
  g.box(0.105, 1.3, 0.238, 0.052, 0.065, 0.015, '#354740');
  g.box(0, 1.16, 0.237, 0.12, 0.03, 0.02, '#ad8055');
  for (const side of [-1, 1]) {
    g.box(side * 0.4, 0.79, 0.14, 0.2, 0.48, 0.25, c);
    g.box(side * 0.4, 0.6, 0.29, 0.21, 0.19, 0.23, PAL.skin);
  }
  if (type === 'gunner') {
    g.box(0.17, 0.73, 0.43, 0.28, 0.24, 0.29, '#b8ab73');
    g.box(0.31, 1.68, 0.07, 0.27, 0.06, 0.3, '#b8bd88');
  } else if (type === 'medic') {
    g.box(0, 1.7, 0.09, 0.1, 0.02, 0.26, '#f7edd2');
    g.box(0, 1.7, 0.09, 0.27, 0.02, 0.09, '#f7edd2');
    g.box(-0.49, 0.61, 0.12, 0.28, 0.33, 0.27, '#ebe4ba');
    g.box(-0.5, 0.62, 0.26, 0.2, 0.065, 0.035, '#e7745d');
    g.box(-0.5, 0.62, 0.26, 0.065, 0.2, 0.035, '#e7745d');
    g.box(0.34, 0.73, 0.48, 0.12, 0.13, 0.5, '#3f5e55');
  } else if (type === 'grenadier') {
    g.box(0.31, 0.77, 0.47, 0.21, 0.23, 0.64, '#58715a');
    for (const xx of [-0.15, 0.05, 0.25]) g.box(xx, 0.92, 0.25, 0.1, 0.17, 0.08, '#e3bc70');
  }
}

/** The weapon parts that kick back when firing. Returns false for types without any. */
export function gunModel(g, type) {
  if (type === 'bazooka') {
    g.box(0.39, 1.12, 0.17, 0.26, 0.27, 1.35, '#546b51');
    g.box(0.39, 1.12, 0.83, 0.37, 0.37, 0.19, '#77915e');
    g.box(0.39, 1.12, 0.94, 0.22, 0.22, 0.035, '#304e3c');
  } else if (type === 'gunner') {
    g.box(0.3, 0.79, 0.49, 0.28, 0.25, 0.9, '#385452');
    g.box(0.3, 0.81, 1.02, 0.12, 0.13, 0.35, '#294744');
  } else if (type === 'rifle') {
    g.box(0.31, 0.77, 0.49, 0.15, 0.17, 0.79, '#456357');
    g.box(0.31, 0.79, 0.9, 0.08, 0.08, 0.22, '#304b43');
  } else return false;
  return true;
}

/** A downed toy lying on its back (the view lifts it 0.14). */
export function downModel(g, team) {
  const c = team ? PAL.red : PAL.blue;
  g.box(0, 0.15, 0, 0.67, 0.28, 1.4, c);
  g.box(0, 0.22, 0.72, 0.47, 0.4, 0.45, PAL.skin);
  g.box(0, 0.47, 0.63, 0.58, 0.22, 0.58, c);
}

/** The light tank (the view lifts it 0.13). */
export function tankModel(g, team) {
  const c = team ? '#bd6b53' : '#5c9790', d = team ? '#814d42' : '#416862';
  for (const x of [-0.8, 0.8]) {
    g.box(x, 0.35, 0, 0.42, 0.6, 2.45, '#3c5550');
    for (const z of [-0.9, -0.45, 0, 0.45, 0.9]) {
      g.cyl(x, 0.39, z, 0.22, 0.38, '#526658', 8);
      g.box(x, 0.07, z, 0.46, 0.13, 0.25, '#5f6b59');
      g.box(x, 0.66, z, 0.46, 0.09, 0.26, '#677460');
    }
  }
  g.box(0, 0.71, 0, 1.75, 0.68, 2.08, c);
  g.box(0, 1.04, 0.12, 1.43, 0.18, 1.55, shade(c, 1.1));
  g.cyl(0, 1.27, -0.15, 0.65, 0.47, c, 8, 0.54);
  g.box(0, 1.38, 0.81, 0.2, 0.22, 1.9, d);
  g.box(0, 1.4, 1.68, 0.34, 0.34, 0.25, d);
  g.box(0, 1.4, 1.82, 0.18, 0.19, 0.04, '#283d34');
  g.cyl(0, 1.55, -0.23, 0.25, 0.12, shade(c, 0.86), 8);
  g.box(-0.49, 1.16, 0.49, 0.07, 0.06, 0.41, '#f0d598');
  g.box(-0.49, 1.16, 0.49, 0.4, 0.06, 0.07, '#f0d598');
  g.box(0.5, 1.08, -0.7, 0.06, 1.5, 0.06, '#415e52');
}

/** One windmill sail pointing up from the hub (four of them turn in view.js). */
export function sailModel(g) {
  g.box(0, 1.35, 0, 0.12, 2.7, 0.08, '#8a6a4a');
  g.box(0.24, 1.6, 0.03, 0.36, 2.1, 0.03, '#f5ecd2');
  for (let k = 0; k < 5; k++) g.box(0.2, 0.7 + k * 0.45, -0.03, 0.52, 0.04, 0.05, '#9b7b55');
}

/* ------------------------------------------------------------------ the board every map sits on */

function board(g, river) {
  // A raised toy board with warm, visible brick sides.
  g.box(0, -2.0, 0, 220, 0.6, 200, '#b5c7af');
  g.box(0, -1.02, 0, 44.7, 1.85, 32.7, '#b29467');
  g.box(0, -0.25, 0, 44.8, 0.22, 32.8, '#d2bd83');
  for (let x = -21; x <= 21; x += 2) {
    g.box(x, -0.98, 16.41, 1.92, 0.88, 0.04, shade('#ad9165', rand(0.9, 1.07)));
    g.box(x, -0.98, -16.41, 1.92, 0.88, 0.04, '#b59a6e');
  }
  for (let z = -15; z <= 15; z += 2) {
    g.box(-22.41, -0.98, z, 0.04, 0.88, 1.92, '#bea471');
    g.box(22.41, -0.98, z, 0.04, 0.88, 1.92, '#a88d61');
  }
  // Grass tiles.
  const greens = ['#95bd6c', '#99bf70', '#9dc473', '#96bd69', '#90b966'];
  for (let x = -21; x <= 21; x += 2) {
    for (let z = -15; z <= 15; z += 2) {
      if (river && Math.abs(x) < 3) continue;
      g.box(x, -0.09, z, 2, 0.22, 2, greens[Math.floor(random() * greens.length)]);
    }
  }
}

function studs(g, river) {
  for (let x = -21.1; x < 22; x += 1.15) for (const z of [-15.15, 15.15]) if (!river || Math.abs(x) > 3.7) g.cyl(x, 0.12, z, 0.22, 0.13, '#88ab5f', 8);
  for (let z = -13.5; z < 14; z += 1.15) for (const x of [-21.1, 21.1]) g.cyl(x, 0.12, z, 0.22, 0.13, '#88ab5f', 8);
}

function cobbles(g, gap) {
  for (let x = -21.4; x < 22; x += 0.95) {
    if (Math.abs(x) < gap) continue;
    for (const z of [-1.08, -0.25, 0.6]) {
      const cc = ['#c5be9e', '#ded3af', '#d1c8a7'][Math.floor(random() * 3)];
      g.box(x + rand(-0.12, 0.12), 0.102, z + rand(-0.12, 0.12), rand(0.55, 0.8), 0.07, rand(0.42, 0.63), cc, rand(-0.08, 0.08));
    }
  }
}

/* ------------------------------------------------------------------ Operation 01: Brickwater Bridge */

const BRICKWATER_BUILDINGS = [
  { x: -12, z: 4.7, w: 4.5, d: 3.6, h: 3.6, color: '#f1dbad', roof: '#cf684c', type: 'house' },
  { x: -16, z: -5.4, w: 3.5, d: 3.2, h: 3.0, color: '#e9e1be', roof: '#538984', type: 'house' },
  { x: 11, z: -5.0, w: 4.8, d: 3.8, h: 4.0, color: '#eed3a4', roof: '#b95e48', type: 'cafe' },
  { x: 16.8, z: 6.7, w: 4.1, d: 4.0, h: 3.1, color: '#df9c78', roof: '#567e71', type: 'barn' },
  { x: -18.9, z: 10.3, w: 3.1, d: 3.0, h: 2.5, color: '#e4d5a8', roof: '#cf754e', type: 'shed' },
  { x: 16.6, z: -11.6, w: 3.6, d: 3.3, h: 3.0, color: '#e5dab9', roof: '#687f84', type: 'house' },
];

function buildBrickwater(g, lv) {
  reseed(731);
  board(g, true);
  g.box(-2.91, -0.065, 0, 0.6, 0.23, 32, '#d6cb96');
  g.box(2.91, -0.065, 0, 0.6, 0.23, 32, '#d6cb96');
  // The river (emit 2 marks water: it gets the animated water material).
  g.box(0, -0.075, 0, 5.25, 0.11, 32.05, '#4ca7b7', 0, 2);
  g.box(0, -0.63, 16.13, 5.2, 0.55, 0.23, '#53999d', 0, 2);
  // Main road and the two side routes.
  g.box(-12.8, 0.04, 0, 18.6, 0.1, 3.2, '#d8c798');
  g.box(12.8, 0.04, 0, 18.6, 0.1, 3.2, '#d8c798');
  for (const [x, z, xx, zz] of [[-15, 0, -8, -10], [-8, -10, 8, -10], [8, -10, 17, -4], [-16, 5, -8, 10], [-8, 10, 11, 10], [11, 10, 16, 1]]) g.line(x, 0.07, z, xx, 0.07, zz, 0.85, '#cfc398');
  cobbles(g, 4);
  // The main stone bridge.
  g.box(0, 0.13, 0, 7.8, 0.3, 3.55, '#cec5a9');
  g.box(0, -0.1, 0, 7.8, 0.2, 3.8, '#aaad9d');
  for (let x = -3.4; x < 3.8; x += 0.72) for (const z of [-1.08, -0.35, 0.38, 1.1]) g.box(x, 0.306, z, 0.66, 0.08, 0.64, random() > 0.5 ? '#e4d8b6' : '#d8ceb2');
  for (const z of [-1.98, 1.98]) {
    g.box(0, 0.66, z, 7.8, 0.55, 0.38, '#d9cfb0');
    g.box(0, 0.99, z, 7.98, 0.16, 0.56, '#f1e4bf');
    for (const x of [-3.6, -1.2, 1.2, 3.6]) {
      g.box(x, 0.51, z, 0.53, 1.22, 0.6, '#cbc6ac');
      g.box(x, 1.16, z, 0.73, 0.18, 0.76, '#eee3c5');
      g.cyl(x, 1.29, z, 0.19, 0.09, '#d9d0b4', 8);
    }
  }
  for (const x of [-2.1, 2.1]) g.box(x, -0.42, 0, 0.7, 1.15, 3.8, '#9caea2');
  // Side bridges, lighter timber construction.
  for (const bz of [-10, 10]) {
    g.box(0, -0.06, bz, 7.3, 0.34, 2.1, '#86744c');
    for (let x = -3.4; x <= 3.4; x += 0.45) g.box(x, 0.16, bz, 0.4, 0.21, 2.18, random() > 0.45 ? '#c6a66e' : '#b49665');
    for (const zz of [bz - 1.13, bz + 1.13]) {
      g.box(0, 0.76, zz, 7.3, 0.13, 0.14, '#b39562');
      for (const x of [-3.5, -1.7, 1.7, 3.5]) {
        g.box(x, 0.4, zz, 0.18, 1.25, 0.18, '#96804f');
        g.cyl(x, 1.08, zz, 0.15, 0.12, '#c4a774', 8);
      }
    }
  }
  // Edge studs and toy-plate details.
  studs(g, true);
  // Orchard, village and scenery are part of the map rather than a flat backdrop.
  for (const b of lv.buildings) house(g, b);
  for (const [x, z, s] of [[-12, -11.4, 1], [-16, -11.3, 1.15], [-19, -13.2, 0.85], [-9.7, -14.0, 1], [-18, 3, 0.78], [-16, 13.9, 0.9], [-10, 12.9, 0.8], [-6, 14.1, 0.8], [7, -14, 1.0], [11, -12.8, 0.8], [19, -5.5, 0.8], [12.8, 14.1, 0.95], [18.7, 12.6, 1.0], [20.4, -15, 0.7], [5, 14.4, 0.65], [-19, -1.8, 0.65]]) tree(g, x, z, s);
  // A small allotment with rows of block plants.
  g.box(-12, 0.045, -8.4, 5.0, 0.12, 2.5, '#a79564');
  for (let x = -14; x <= -10; x += 0.6) {
    for (const z of [-9.1, -8.4, -7.7]) {
      g.cyl(x, 0.15, z, 0.15, 0.22, '#c58542', 6);
      g.box(x, 0.31, z, 0.38, 0.13, 0.15, '#4a8b54', 0.4);
      g.box(x, 0.33, z, 0.15, 0.12, 0.35, '#60944e', -0.3);
    }
  }
  // Wooden picket fences and flowering hedges.
  for (const [x, z, l, angle] of [[-11, -13.5, 5.5, 0], [-19, 5.0, 3.6, 0], [-7, 5.8, 3.5, Math.PI / 2], [14, 12.4, 4.4, 0], [8, -7.8, 3.3, Math.PI / 2]]) fence(g, x, z, l, angle);
  for (let i = 0; i < 95; i++) {
    const x = rand(-21, 21), z = rand(-15, 15);
    if (Math.abs(x) < 4 || Math.abs(z) < 2 || lv.buildings.some((b) => Math.abs(x - b.x) < b.w * 0.6 && Math.abs(z - b.z) < b.d * 0.65)) continue;
    g.box(x, 0.14, z, 0.22, 0.25, 0.15, '#78a255', rand(0, 3));
    if (i % 3 === 0) g.box(x, 0.33, z, 0.16, 0.11, 0.16, i % 2 ? '#f4db91' : '#eea48c');
  }
  // River-bank stones and reeds.
  for (let z = -14.4; z <= 15; z += 2.1) {
    if ([-10, 0, 10].some((b) => Math.abs(z - b) < 2.5)) continue;
    for (const side of [-1, 1]) {
      const x = side * rand(2.8, 3.25);
      g.sphere(x, -0.02, z, rand(0.25, 0.45), '#a3b69a', 6, 3, 0.65);
      if (random() > 0.5) {
        g.box(x, 0.5, z, 0.06, 1, 0.06, '#8b9b5b', 0.1);
        g.box(x, 0.97, z, 0.14, 0.23, 0.14, '#8b7048');
      }
    }
  }
  // Base pads and little field tents.
  base(g, -19, 1, 0);
  base(g, 19, -1, 1);
  // Crates, lamp posts, road signs, and a picnic worth fighting for.
  for (const [x, z] of [[-15, 7.4], [-9, 4.3], [13, -7.2], [14, 4], [18, 3.4], [-17, -7.8], [10, 11.8]]) {
    crate(g, x, 0.1, z, 0.65);
    crate(g, x + 0.55, 0.1, z + 0.32, 0.45);
  }
  for (const [x, z] of [[-8.7, 1.9], [8.7, -1.9], [-3.8, -3.1], [3.8, 3.1]]) lamp(g, x, z);
  g.box(-9.2, 1.05, -5.0, 0.12, 2.1, 0.12, '#957347');
  g.box(-9.2, 1.8, -5.0, 1.5, 0.36, 0.14, '#e6d6ad');
  g.box(-9.2, 1.35, -5.0, 1.25, 0.32, 0.14, '#e6d6ad');
  g.box(-18, 0.65, 13, 2.6, 0.2, 1.2, '#c9a779');
  for (const x of [-18.9, -17.1]) g.box(x, 0.35, 13, 0.13, 0.7, 0.9, '#8c8057');
  g.box(-18, 0.76, 13, 1.7, 0.04, 1.18, '#f5e8cb');
  for (let x = -18.7; x < -17.2; x += 0.35) for (let z = 12.57; z < 13.5; z += 0.35) if (Math.round(x * 3 + z * 3) % 2 === 0) g.box(x, 0.79, z, 0.3, 0.02, 0.3, '#da7f67');
  g.cyl(-18, 0.93, 13, 0.27, 0.2, '#b18454', 10);
  g.sphere(-18, 1.07, 13, 0.23, '#e7ba78', 8, 3, 0.4);
  for (const p of lv.points) flagStatic(g, p);
}

function minimapBrickwater(mc, px, pz, w, h) {
  mc.fillStyle = '#70abba';
  mc.fillRect(px(-2.6), 0, (w * 5.2) / 44, h);
  mc.strokeStyle = '#d3c797';
  mc.lineWidth = 8;
  mc.beginPath();
  mc.moveTo(0, pz(0));
  mc.lineTo(w, pz(0));
  mc.stroke();
  for (const z of [-10, 10]) {
    mc.strokeStyle = '#c3b184';
    mc.lineWidth = 5;
    mc.beginPath();
    mc.moveTo(px(-10), pz(z));
    mc.lineTo(px(11), pz(z));
    mc.stroke();
  }
}

/* ------------------------------------------------------------------ Operation 02: Sugarloaf Square (new) */

const SUGARLOAF_BUILDINGS = [
  { x: -11.5, z: -4.6, w: 4.4, d: 3.4, h: 3.4, color: '#f1dbad', roof: '#cf684c', type: 'house' },
  { x: 11.5, z: 4.6, w: 4.4, d: 3.4, h: 3.2, color: '#e9e1be', roof: '#538984', type: 'house' },
  { x: -3.6, z: -6.8, w: 4.2, d: 3.3, h: 3.7, color: '#eed3a4', roof: '#b95e48', type: 'cafe' },
  { x: 3.6, z: 6.8, w: 4.2, d: 3.3, h: 3.5, color: '#f3dcc8', roof: '#c9707f', type: 'cafe', awning: '#e59bb0' },
  { x: -14, z: 11.2, w: 2.8, d: 2.8, h: 4.4, color: '#efe6cf', roof: '#8a6a4a', type: 'mill' },
  { x: 13.8, z: -11.2, w: 3.4, d: 4.4, h: 3.2, color: '#e7e0c9', roof: '#6f8a8c', type: 'chapel' },
  { x: -4.8, z: 12.6, w: 4.4, d: 3.2, h: 3.0, color: '#df9c78', roof: '#567e71', type: 'barn' },
  { x: 4.8, z: -12.6, w: 4.4, d: 3.2, h: 3.0, color: '#e2c79a', roof: '#8c5a4a', type: 'barn' },
  { x: -17.5, z: -11.6, w: 3.1, d: 3.0, h: 2.5, color: '#e4d5a8', roof: '#cf754e', type: 'shed' },
  { x: 17.5, z: 11.6, w: 3.1, d: 3.0, h: 2.5, color: '#e2d2b0', roof: '#7a8f6a', type: 'shed' },
];

/** A windmill tower with a cap; the four sails are a separate turning mesh (see view.js). */
function mill(g, b) {
  const { x, z, h } = b;
  g.box(x, 0.2, z, b.w + 0.3, 0.35, b.d + 0.3, '#bcc1a3');
  g.cyl(x, h / 2 + 0.35, z, 1.25, h, b.color, 12, 0.95);
  g.cyl(x, 0.62, z, 1.28, 0.28, '#d0bc91', 12, 1.26);
  g.cyl(x, h + 0.5, z, 1.08, 0.3, '#e5cda3', 12);
  g.cyl(x, h + 1.1, z, 1.1, 0.9, b.roof, 12, 0.14);
  g.box(x, 0.98, z + 1.2, 0.72, 1.4, 0.14, '#667c6d');
  g.box(x, 1.02, z + 1.27, 0.52, 1.24, 0.06, '#52685d');
  g.box(x, 2.45, z + 1.1, 0.46, 0.56, 0.1, '#f7ebce');
  g.box(x, 2.45, z + 1.15, 0.32, 0.42, 0.05, '#558b93');
  g.box(x + 1.02, 3.2, z, 0.1, 0.52, 0.42, '#f7ebce');
  g.box(x + 1.06, 3.2, z, 0.05, 0.38, 0.3, '#558b93');
  g.box(x, h + 0.62, z + 1.05, 0.36, 0.36, 0.6, '#8a6a4a');
  // Flour sacks by the door.
  for (const [dx, dz] of [[0.75, 1.55], [1.05, 1.3], [0.9, 1.45]]) g.sphere(x + dx, 0.32, z + dz, 0.22, '#efe6cf', 6, 3, 0.8);
}

/** A small chapel: nave, bell tower with a spire, and a door facing the square. */
function chapel(g, b) {
  const { x, z, w, d, h, color, roof } = b;
  g.box(x, 0.2, z, w + 0.35, 0.35, d + 0.35, '#bcc1a3');
  g.box(x, h / 2 + 0.3, z, w, h, d, color);
  g.box(x, 0.6, z, w + 0.08, 0.28, d + 0.08, '#d0bc91');
  g.roof(x, h + 0.3, z, w + 0.5, 1.5, d + 0.4, roof);
  const tz = z + d / 2 - 0.4, th = h + 2.2;
  g.box(x, th / 2 + 0.3, tz, 1.6, th, 1.6, shade(color, 0.96));
  g.box(x, th + 0.36, tz, 1.8, 0.16, 1.8, '#e5cda3');
  g.box(x, th - 0.45, tz + 0.81, 0.62, 0.8, 0.05, '#3f4f4a');
  g.box(x + 0.81, th - 0.45, tz, 0.05, 0.8, 0.62, '#3f4f4a');
  g.pyramid(x, th + 0.44, tz, 1.7, 1.7, 1.7, roof);
  g.sphere(x, th + 2.2, tz, 0.11, '#edcd7b', 6, 3);
  g.box(x, 0.98, tz + 0.82, 0.74, 1.36, 0.1, '#667c6d');
  g.box(x, 1.02, tz + 0.88, 0.54, 1.2, 0.06, '#52685d');
  g.box(x, 2.35, tz + 0.82, 0.46, 0.46, 0.06, '#e59bb0');
  g.box(x, 2.35, tz + 0.855, 0.3, 0.3, 0.04, '#5d8d91');
  const side = x + w / 2 + 0.025;
  for (const zz of [z - d * 0.3, z]) {
    g.box(side, 2.1, zz, 0.1, 1.2, 0.6, '#eddfb7');
    g.box(side + 0.06, 2.1, zz, 0.07, 1.0, 0.42, '#5d8d91');
  }
  // A little graveyard of toy headstones behind the chapel.
  for (let i = 0; i < 4; i++) g.box(x - 1.1 + i * 0.75, 0.32, z - d / 2 - 1.1, 0.42, 0.55, 0.14, '#c9c7b5');
}

/** A market stall: table, goods and a striped awning. */
function stall(g, x, z, a, awning, cake) {
  g.set(x, 0, z, a);
  for (const sx of [-0.72, 0.72]) for (const sz of [-0.4, 0.4]) g.box(sx, 0.62, sz, 0.07, 1.24, 0.07, '#a0825a');
  g.box(0, 0.62, 0, 1.6, 0.1, 0.9, '#d9c7a1');
  g.box(0, 0.37, 0.44, 1.6, 0.46, 0.04, '#c9a779');
  for (let i = 0; i < 6; i++) g.box(-0.75 + i * 0.3, 1.3, 0, 0.3, 0.06, 1.12, i % 2 ? awning : '#f7edd2');
  if (cake) {
    g.cyl(0, 0.76, 0, 0.34, 0.18, '#f7e3c4', 10);
    g.cyl(0, 0.91, 0, 0.25, 0.13, '#e9a6b4', 10);
    g.sphere(0, 1.02, 0, 0.07, '#d9453c', 6, 3);
    for (const sx of [-0.55, 0.55]) g.cyl(sx, 0.73, 0.05, 0.13, 0.1, '#e7ba78', 8);
  } else {
    for (let i = 0; i < 4; i++) g.sphere(-0.56 + i * 0.37, 0.76, 0.05, 0.13, ['#e7745d', '#f4d382', '#88b461', '#e59bb0'][i], 6, 3, 0.8);
  }
  g.set();
}

function buildSugarloaf(g, lv) {
  reseed(912);
  board(g, false);
  // The market square and the main street.
  g.box(0, 0.035, 0, 11, 0.1, 9, '#dcd0a6');
  for (let x = -5; x <= 5.05; x += 1.1) {
    for (let z = -4.1; z <= 4.15; z += 1.1) {
      if (random() > 0.55) continue;
      g.box(x + rand(-0.08, 0.08), 0.092, z + rand(-0.08, 0.08), rand(0.7, 0.95), 0.03, rand(0.7, 0.95), ['#e6dbb8', '#d6caa2', '#cfc49c'][Math.floor(random() * 3)], rand(-0.06, 0.06));
    }
  }
  g.box(-13.3, 0.04, 0, 16.6, 0.1, 3.0, '#d8c798');
  g.box(13.3, 0.04, 0, 16.6, 0.1, 3.0, '#d8c798');
  cobbles(g, 5.6);
  // Lanes round the back of the village.
  for (const [x, z, xx, zz] of lv.lanes) g.line(x, 0.07, z, xx, 0.07, zz, 0.85, '#cfc398');
  studs(g, false);
  for (const b of lv.buildings) {
    if (b.type === 'mill') mill(g, b);
    else if (b.type === 'chapel') chapel(g, b);
    else house(g, b);
  }
  for (const [x, z, s] of [[-20, -14, 0.9], [-15, -14.6, 1], [-11, -13.8, 0.85], [-8.5, -14.6, 0.8], [9.2, -14.9, 0.85], [19.6, -14.2, 0.8], [20.3, -7.5, 0.75], [-20.3, 7.5, 0.75], [-19.6, 14.2, 0.8], [-10, 14.5, 0.9], [8.5, 14.6, 0.8], [11, 13.8, 0.85], [15, 14.6, 1], [20.1, 14.2, 0.9], [-19.8, -5.8, 0.7], [19.8, 5.8, 0.7]]) tree(g, x, z, s);
  // Market day around the square.
  stall(g, -4.6, 3.4, 0.25, '#e7745d', false);
  stall(g, 4.6, -3.4, 0.25 + Math.PI, '#6fa8b8', false);
  stall(g, 4.7, 3.4, -0.3, '#f0c05a', true);
  stall(g, -4.7, -3.4, -0.3 + Math.PI, '#8fbf6a', false);
  for (const [x, z] of [[-5.9, -4.8], [5.9, 4.8], [-5.9, 4.8], [5.9, -4.8]]) lamp(g, x, z);
  // Benches and flower tubs.
  for (const [x, z, a] of [[-2.2, -4.35, 0], [2.2, 4.35, 0], [-5.4, 0.9, Math.PI / 2], [5.4, -0.9, Math.PI / 2]]) {
    g.set(x, 0, z, a);
    g.box(0, 0.42, 0, 1.4, 0.08, 0.42, '#b8895a');
    g.box(0, 0.66, -0.2, 1.4, 0.32, 0.06, '#b8895a');
    for (const sx of [-0.6, 0.6]) g.box(sx, 0.21, 0, 0.08, 0.42, 0.38, '#6d6a58');
    g.set();
  }
  for (const [x, z] of [[-9.1, 1.9], [9.1, -1.9], [-1.7, 5.4], [1.7, -5.4]]) {
    g.cyl(x, 0.28, z, 0.42, 0.5, '#c58542', 8, 0.5);
    for (let i = 0; i < 5; i++) g.sphere(x + rand(-0.25, 0.25), 0.62, z + rand(-0.25, 0.25), 0.16, i % 2 ? '#f4d382' : '#eea48c', 6, 3, 0.8);
  }
  // Hay bales by the barns, a well by the chapel, crates by the houses.
  for (const [x, z] of [[-8.2, 13.6], [-8.6, 12.4], [8.2, -13.6], [8.6, -12.4]]) {
    g.box(x, 0.36, z, 1.0, 0.62, 0.7, '#e3c577');
    g.box(x, 0.36, z, 1.02, 0.08, 0.72, '#c9a651');
  }
  g.cyl(10.6, 0.36, -14.2, 0.62, 0.62, '#b8b4a0', 10);
  g.cyl(10.6, 0.66, -14.2, 0.5, 0.04, '#4ca7b7', 10, 0.5, 2);
  for (const sx of [-0.55, 0.55]) g.box(10.6 + sx, 1.1, -14.2, 0.08, 1.2, 0.08, '#8c6d4a');
  g.roof(10.6, 1.62, -14.2, 1.5, 0.5, 0.9, '#8c5a4a');
  for (const [x, z] of [[-15.5, -2.2], [15.5, 2.2], [-7.4, -8.6], [7.4, 8.6], [-17.8, 7.2]]) {
    crate(g, x, 0.1, z, 0.65);
    crate(g, x + 0.55, 0.1, z + 0.32, 0.45);
  }
  // Fences and flowers.
  for (const [x, z, l, angle] of [[-16.5, 6.2, 3.4, 0], [16.5, -6.2, 3.4, 0], [-1.6, 14.9, 4.4, 0], [1.6, -14.9, 4.4, 0], [-20.4, -9, 3.2, Math.PI / 2], [20.4, 9, 3.2, Math.PI / 2]]) fence(g, x, z, l, angle);
  for (let i = 0; i < 90; i++) {
    const x = rand(-21, 21), z = rand(-15, 15);
    if ((Math.abs(x) < 6 && Math.abs(z) < 5) || Math.abs(z) < 2 || lv.buildings.some((b) => Math.abs(x - b.x) < b.w * 0.6 + 0.4 && Math.abs(z - b.z) < b.d * 0.65 + 0.4)) continue;
    g.box(x, 0.14, z, 0.22, 0.25, 0.15, '#78a255', rand(0, 3));
    if (i % 3 === 0) g.box(x, 0.33, z, 0.16, 0.11, 0.16, i % 2 ? '#f4db91' : '#eea48c');
  }
  base(g, -19, 1, 0);
  base(g, 19, -1, 1);
  for (const p of lv.points) flagStatic(g, p);
}

function minimapSugarloaf(mc, px, pz, w, h, lv) {
  mc.fillStyle = '#d6cb9c';
  mc.fillRect(px(-5.5), pz(-4.5), (11 / 44) * w, (9 / 32) * h);
  mc.strokeStyle = '#d3c797';
  mc.lineWidth = 7;
  mc.beginPath();
  mc.moveTo(0, pz(0));
  mc.lineTo(w, pz(0));
  mc.stroke();
  mc.strokeStyle = '#c3b184';
  mc.lineWidth = 3;
  for (const [x, z, xx, zz] of lv.lanes) {
    mc.beginPath();
    mc.moveTo(px(x), pz(z));
    mc.lineTo(px(xx), pz(zz));
    mc.stroke();
  }
}

/* ------------------------------------------------------------------ the operations */

export const LEVELS = [
  {
    id: 'brickwater',
    num: '01',
    title: 'BRICKWATER',
    name: 'Brickwater Bridge',
    tagline: 'Five toy soldiers.<br>One very important bridge.',
    op: 'OPERATION 01 · RIVER CROSSING',
    intro: 'The Red Rascals want our picnic route.<br>Capture the flags. Keep the bridge. Save lunch.',
    steps: [['flag', 'CAPTURE'], ['shield', 'TAKE COVER'], ['boot', 'FLANK']],
    hint: ['THREE FLAGS. ONE PLAN.', 'Probably best to have a plan.'],
    plate: ['48° NORTH · SOMEWHERE SMALL', 'BRICKWATER', '06:30 · SUNNY WITH A CHANCE OF CHAOS'],
    win: ['Bridge secured!', 'The picnic route is safe. Lunch is back on. Your little squad did a very big job.'],
    lose: ['A small setback.', 'The Red Rascals took this one. Try a side crossing, use cover, and bring your squad home to heal.', 'THE PICNIC CAN WAIT'],
    flankTip: 'Side routes let you flank.',
    buildings: BRICKWATER_BUILDINGS,
    covers: [[-7.2, -8.8, 0.72, 3.4], [-4.6, -11.2, 2.8, 0.7], [3.9, -8.8, 0.72, 3.0], [-5.5, -0.8, 0.7, 2.6], [-6.6, 2.8, 3.5, 0.72], [5.4, 0.8, 0.7, 2.7], [6.5, -2.8, 3.3, 0.72], [-4.0, 9.3, 0.7, 3.0], [7.5, 9.2, 0.7, 3.5], [4.8, 11.6, 3, 0.7], [-11.2, -11.5, 2.5, 0.7], [12, 10.4, 0.7, 2.8], [-15, 1.8, 2.4, 0.65], [15, -1.8, 2.4, 0.65]],
    points: [{ name: 'ORCHARD', letter: 'A', x: -7.9, z: -9.8 }, { name: 'BRIDGE', letter: 'B', x: 0, z: 0 }, { name: 'DEPOT', letter: 'C', x: 7.3, z: 9.8 }],
    // Water blocks movement (not sight); crossings cut walkways through it.
    water: [{ x: 0, z: 0, hw: 3.1, hd: 40 }],
    crossings: [{ x: 0, z: 0, hw: 3.3, hd: 1.5 }, { x: 0, z: -10, hw: 3.3, hd: 0.8 }, { x: 0, z: 10, hw: 3.3, hd: 0.8 }],
    blockers: [],
    supply: 60,
    tanks: [{ warn: 58, at: 73, warnText: 'ARMOR INBOUND · Keep Boom near the bridge.', text: 'A red tank has arrived. Bazookas beat armor.' }],
    enemyTank: { x: 19, z: -2.8, tx: 2, tz: 0 },
    playerTank: { x: -20, z: 4 },
    aiOpening: { rifle: 2, gunner: 1, bazooka: 1, grenadier: 0, medic: 1 },
    tankPoint: 1,
    briefCam: { x: -5, z: -3 },
    briefCamPortrait: { x: -5, z: 12 },
    build: buildBrickwater,
    minimap: minimapBrickwater,
    sails: null,
  },
  {
    id: 'sugarloaf',
    num: '02',
    title: 'SUGARLOAF',
    name: 'Sugarloaf Square',
    tagline: 'Five toy soldiers.<br>One very important cake.',
    op: 'OPERATION 02 · MARKET DAY',
    intro: 'The Rascals crashed market day. Two tanks, tight streets.<br>Take the square. Hold the mill. Save the cake.',
    steps: [['flag', 'CAPTURE'], ['boot', 'USE THE LANES'], ['tank', 'STOP TANKS']],
    hint: ['NARROW STREETS. TWO TANKS.', 'Houses block shots. Flank through the lanes.'],
    plate: ['51° NORTH · A VERY SMALL TOWN', 'SUGARLOAF', '11:00 · CAKE-SCENTED BREEZE'],
    win: ['Market day saved!', 'The square is ours and the cake stall reopens. Everybody gets a slice, even the tank.'],
    lose: ['The cake got away.', 'The Red Rascals held the square. Flank through the back lanes, keep Boom for the tanks, and heal at base.', 'MARKET DAY IS OVER'],
    flankTip: 'The back lanes let you flank.',
    buildings: SUGARLOAF_BUILDINGS,
    covers: [[-4.3, -1.3, 0.7, 2.6], [4.3, 1.3, 0.7, 2.6], [-1.4, 3.5, 2.8, 0.7], [1.4, -3.5, 2.8, 0.7], [-9.6, 5.6, 2.6, 0.7], [9.6, -5.6, 2.6, 0.7], [-11.4, 8.2, 0.7, 2.6], [11.4, -8.2, 0.7, 2.6], [-7.2, -1.6, 2.6, 0.7], [7.2, 1.6, 2.6, 0.7], [-15, 4.4, 2.4, 0.65], [15, -4.4, 2.4, 0.65], [-1.6, -11.6, 2.6, 0.7], [1.6, 11.6, 2.6, 0.7]],
    points: [{ name: 'MILL', letter: 'A', x: -8, z: 8.5 }, { name: 'MARKET', letter: 'B', x: 0, z: 0 }, { name: 'CHAPEL', letter: 'C', x: 8, z: -8.5 }],
    lanes: [[-16, -6, -9.5, -9.6], [-9.5, -9.6, 3, -9.6], [3, -9.6, 8, -8.5], [8, -8.5, 13, -6], [13, -6, 17, -3], [16, 6, 9.5, 9.6], [9.5, 9.6, -3, 9.6], [-3, 9.6, -8, 8.5], [-8, 8.5, -13, 6], [-13, 6, -17, 3], [-3, 4.2, -8, 8.5], [3, -4.2, 8, -8.5]],
    water: [],
    crossings: [],
    // Market stalls and the chapel well: small props soldiers walk around (they do not block shots).
    blockers: [{ x: -4.6, z: 3.4, hw: 0.8, hd: 0.45 }, { x: 4.6, z: -3.4, hw: 0.8, hd: 0.45 }, { x: 4.7, z: 3.4, hw: 0.8, hd: 0.45 }, { x: -4.7, z: -3.4, hw: 0.8, hd: 0.45 }, { x: 10.6, z: -14.2, hw: 0.62, hd: 0.62 }],
    supply: 75,
    tanks: [
      { warn: 48, at: 62, warnText: 'ARMOR INBOUND · Rattling down the main street.', text: 'A red tank rolled into town. Bazookas beat armor.' },
      { warn: 186, at: 200, warnText: 'MORE ARMOR · A second tank is coming. Keep Boom ready.', text: 'The second red tank is here. Grenades and Boom, together!' },
    ],
    enemyTank: { x: 19, z: -3, tx: 3, tz: 0 },
    playerTank: { x: -20, z: 4 },
    aiOpening: { rifle: 2, gunner: 1, bazooka: 1, grenadier: 0, medic: 1 },
    tankPoint: 1,
    briefCam: { x: -4, z: -2 },
    briefCamPortrait: { x: -6, z: 10 },
    build: buildSugarloaf,
    minimap: minimapSugarloaf,
    // Windmill sails turn slowly on the mill's hub.
    sails: { x: -14, y: 5.02, z: 11.2 + 1.4 },
  },
];
