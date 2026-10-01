/**
 * geo.js — the game's own procedural geometry: flat-shaded triangles with a
 * colour per vertex, built on the CPU (no DOM, no three.js) and handed to
 * three.js as BufferGeometry by main.js. This is the original "Tiny Palm"
 * builder, kept so every palm, crate, crab and rascal keeps its exact shape,
 * now writing into growable Float32Arrays instead of plain number arrays.
 *
 * Vertex layout: x y z  nx ny nz  r g b  u v  (11 floats).
 */

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

let seed = 196;
export function setSeed(s) {
  seed = s >>> 0;
}
/** The original LCG, so the island grows exactly as before. */
export function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const range = (a, b) => lerp(a, b, rand());

/** 0xRRGGBB, '#rrggbb' or [r,g,b] → [r,g,b] in 0..1. */
export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string') c = parseInt(c.replace('#', ''), 16);
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
}

/** Column-major TRS matrix, rotation order XYZ (the same as three.js Euler 'XYZ'). */
export function compose(p, r, s, out = new Float64Array(16)) {
  const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
  out[0] = cy * cz * s[0];
  out[1] = (cx * sz + sx * sy * cz) * s[0];
  out[2] = (sx * sz - cx * sy * cz) * s[0];
  out[3] = 0;
  out[4] = -cy * sz * s[1];
  out[5] = (cx * cz - sx * sy * sz) * s[1];
  out[6] = (sx * cz + cx * sy * sz) * s[1];
  out[7] = 0;
  out[8] = sy * s[2];
  out[9] = -sx * cy * s[2];
  out[10] = cx * cy * s[2];
  out[11] = 0;
  out[12] = p[0];
  out[13] = p[1];
  out[14] = p[2];
  out[15] = 1;
  return out;
}

const UV_A = [[0, 0], [1, 0], [1, 1]];
const UV_B = [[0, 0], [1, 1], [0, 1]];
const WHITE = [1, 1, 1];
const ORIGIN = [0, 0, 0];
const _m = new Float64Array(16);

export class Geo {
  constructor(capacity = 96) {
    this.data = new Float32Array(capacity * 11);
    this.n = 0; // floats used
  }
  get count() {
    return this.n / 11;
  }
  reserve(floats) {
    if (this.n + floats <= this.data.length) return;
    let cap = this.data.length * 2;
    while (cap < this.n + floats) cap *= 2;
    const d = new Float32Array(cap);
    d.set(this.data.subarray(0, this.n));
    this.data = d;
  }
  tri(a, b, c, col, uvs = null) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const co = rgb(col);
    this.reserve(33);
    const d = this.data;
    let o = this.n;
    const pts = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      d[o++] = p[0];
      d[o++] = p[1];
      d[o++] = p[2];
      d[o++] = nx;
      d[o++] = ny;
      d[o++] = nz;
      d[o++] = co[0];
      d[o++] = co[1];
      d[o++] = co[2];
      d[o++] = uvs ? uvs[i][0] : 0;
      d[o++] = uvs ? uvs[i][1] : 0;
    }
    this.n = o;
    return this;
  }
  quad(a, b, c, d, col) {
    this.tri(a, b, c, col, UV_A);
    this.tri(a, c, d, col, UV_B);
    return this;
  }
  /** Append another Geo, moved/rotated/scaled and tinted (the original Geo.add). */
  add(geo, p = ORIGIN, r = ORIGIN, s = WHITE, tint = WHITE) {
    const m = compose(p, r, s, _m);
    const src = geo.data;
    const len = geo.n;
    this.reserve(len);
    const d = this.data;
    let o = this.n;
    const s0 = s[0] * s[0], s1 = s[1] * s[1], s2 = s[2] * s[2];
    for (let i = 0; i < len; i += 11) {
      const x = src[i], y = src[i + 1], z = src[i + 2];
      d[o++] = m[0] * x + m[4] * y + m[8] * z + m[12];
      d[o++] = m[1] * x + m[5] * y + m[9] * z + m[13];
      d[o++] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const ax = src[i + 3] / s0, ay = src[i + 4] / s1, az = src[i + 5] / s2;
      let nx = m[0] * ax + m[4] * ay + m[8] * az;
      let ny = m[1] * ax + m[5] * ay + m[9] * az;
      let nz = m[2] * ax + m[6] * ay + m[10] * az;
      const nl = Math.hypot(nx, ny, nz) || 1;
      d[o++] = nx / nl;
      d[o++] = ny / nl;
      d[o++] = nz / nl;
      d[o++] = src[i + 6] * tint[0];
      d[o++] = src[i + 7] * tint[1];
      d[o++] = src[i + 8] * tint[2];
      d[o++] = src[i + 9];
      d[o++] = src[i + 10];
    }
    this.n = o;
    return this;
  }
}

/** The primitive builders, unchanged in shape. */
export const G = {
  box(color = 0xffffff) {
    const g = new Geo(36), h = 0.5;
    g.quad([-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h], color);
    g.quad([h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h], color);
    g.quad([h, -h, h], [h, -h, -h], [h, h, -h], [h, h, h], color);
    g.quad([-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h], color);
    g.quad([-h, h, h], [h, h, h], [h, h, -h], [-h, h, -h], color);
    g.quad([-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h], color);
    return g;
  },
  cone(r1 = 1, r2 = 0, h = 1, n = 8, color = 0xffffff) {
    const g = new Geo(n * 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      const p = [Math.cos(a) * r1, -h / 2, Math.sin(a) * r1], q = [Math.cos(b) * r1, -h / 2, Math.sin(b) * r1];
      const u = [Math.cos(a) * r2, h / 2, Math.sin(a) * r2], v = [Math.cos(b) * r2, h / 2, Math.sin(b) * r2];
      g.quad(q, p, u, v, color);
      g.tri([0, -h / 2, 0], p, q, color);
      g.tri([0, h / 2, 0], v, u, color);
    }
    return g;
  },
  ball(n = 8, rings = 5, color = 0xffffff) {
    const g = new Geo(n * rings * 6);
    const p = (a, b) => [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU, b = ((i + 1) / n) * TAU, c = (j / rings) * Math.PI, d = ((j + 1) / rings) * Math.PI;
        g.quad(p(a, c), p(b, c), p(b, d), p(a, d), color);
      }
    return g;
  },
  disc(n = 24, color = 0xffffff) {
    const g = new Geo(n * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      g.tri([0, 0, 0], [Math.cos(b), 0, Math.sin(b)], [Math.cos(a), 0, Math.sin(a)], color);
    }
    return g;
  },
  ring(inner = 0.9, outer = 1, n = 40, color = 0xffffff) {
    const g = new Geo(n * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
      g.quad(
        [Math.cos(a) * inner, 0, Math.sin(a) * inner],
        [Math.cos(b) * inner, 0, Math.sin(b) * inner],
        [Math.cos(b) * outer, 0, Math.sin(b) * outer],
        [Math.cos(a) * outer, 0, Math.sin(a) * outer],
        color
      );
    }
    return g;
  },
  leaf(col = 0x458c3c) {
    const g = new Geo(12);
    g.tri([0, 0, 0], [0, 0.36, -0.58], [-0.32, 0.27, -0.48], col).tri([0, 0, 0], [0.32, 0.27, -0.48], [0, 0.36, -0.58], col);
    g.tri([-0.32, 0.27, -0.48], [0, 0.36, -0.58], [0, 0.05, -1.45], col);
    g.tri([0, 0.36, -0.58], [0.32, 0.27, -0.48], [0, 0.05, -1.45], col);
    return g;
  },
};

// Shared unit primitives (white, tinted when added).
export const BOX = G.box();
export const BALL = G.ball(8, 5);
export const ROCK = G.ball(7, 3);
export const CONE = G.cone(1, 0, 1, 6);
export const CYL = G.cone(1, 1, 1, 8);
export const DISC = G.disc();
export const LEAF = G.leaf(0xffffff);

export function staticBox(g, p, s, color, r = ORIGIN) {
  g.add(BOX, p, r, s, rgb(color));
}
export function staticRock(g, p, s, color = 0x778b6c, r = ORIGIN) {
  g.add(ROCK, p, r, s, rgb(color));
}
