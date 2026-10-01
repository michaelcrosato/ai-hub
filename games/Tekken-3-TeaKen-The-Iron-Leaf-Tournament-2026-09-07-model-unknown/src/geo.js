// TeaKen geometry builder: faceted, flat-shaded triangles with a colour and a
// glow amount per vertex. The arenas are built once into static buffers; the
// fighters are rebuilt from their poses every frame into one dynamic buffer.
// Everything here is plain math with no allocations in the hot paths, so a
// frame of two fighters does not churn the garbage collector.

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

const hexCache = new Map();
/** '#rrggbb' → [r, g, b, a] in 0..1 (shared and cached for a = 1: never mutate the result). */
export function hex(s, a = 1) {
  if (Array.isArray(s)) return s;
  if (a === 1) {
    const hit = hexCache.get(s);
    if (hit) return hit;
  }
  const n = parseInt(s.replace('#', ''), 16);
  const c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
  if (a === 1) hexCache.set(s, c);
  return c;
}
export function tint(c, s) {
  return [c[0] * s, c[1] * s, c[2] * s, c[3] ?? 1];
}

// The same seeded generator the arena was always built with, so the temple
// keeps its exact tile colours and tree shapes.
let seed = 8812;
export function setSeed(s) {
  seed = s | 0;
}
export function rnd() {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
}
export const rand = (a, b) => a + (b - a) * rnd();

// Scratch points shared by the shape builders (none of them nest).
const POOL = Array.from({ length: 640 }, () => [0, 0, 0]);
const _A = [0, 0, 0];
const _B = [0, 0, 0];
const _C = [0, 0, 0];
const CORNERS = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const FACES = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]];

export class Geo {
  /** @param {number} maxVerts capacity in vertices */
  constructor(maxVerts) {
    this.max = maxVerts;
    this.pos = new Float32Array(maxVerts * 3);
    this.nor = new Float32Array(maxVerts * 3);
    this.col = new Float32Array(maxVerts * 4);
    this.em = new Float32Array(maxVerts);
    this.n = 0;
    /** Optional transform: map(point, out) writes the moved point into out and returns it. */
    this.map = null;
    this.overflow = false;
  }

  reset() {
    this.n = 0;
    this.map = null;
  }

  tri(a, b, c, color, em = 0) {
    if (this.n + 3 > this.max) {
      this.overflow = true;
      return;
    }
    const map = this.map;
    if (map) {
      a = map(a, _A);
      b = map(b, _B);
      c = map(c, _C);
    }
    const C = typeof color === 'string' ? hex(color) : color;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const r = C[0], g = C[1], bl = C[2], al = C[3] ?? 1;
    this.vert(a, nx, ny, nz, r, g, bl, al, em);
    this.vert(b, nx, ny, nz, r, g, bl, al, em);
    this.vert(c, nx, ny, nz, r, g, bl, al, em);
  }

  vert(p, nx, ny, nz, r, g, b, a, em) {
    const n = this.n, i3 = n * 3, i4 = n * 4;
    const pos = this.pos, nor = this.nor, col = this.col;
    pos[i3] = p[0];
    pos[i3 + 1] = p[1];
    pos[i3 + 2] = p[2];
    nor[i3] = nx;
    nor[i3 + 1] = ny;
    nor[i3 + 2] = nz;
    col[i4] = r;
    col[i4 + 1] = g;
    col[i4 + 2] = b;
    col[i4 + 3] = a;
    this.em[n] = em;
    this.n = n + 1;
  }

  quad(a, b, c, d, col, em = 0) {
    this.tri(a, b, c, col, em);
    this.tri(a, c, d, col, em);
  }

  /** An axis-aligned box, optionally turned by ry around its centre. */
  box(p, s, col, em = 0, ry = 0) {
    const x = p[0], y = p[1], z = p[2], w2 = s[0] / 2, h2 = s[1] / 2, d2 = s[2] / 2;
    const cs = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < 8; i++) {
      const k = CORNERS[i], P = POOL[i];
      const ax = k[0] * w2, ay = k[1] * h2, az = k[2] * d2;
      P[0] = x + ax * cs + az * sn;
      P[1] = y + ay;
      P[2] = z - ax * sn + az * cs;
    }
    for (const f of FACES) this.quad(POOL[f[0]], POOL[f[1]], POOL[f[2]], POOL[f[3]], col, em);
  }

  /** A tapered, faceted limb from a (radius r1) to b (radius r2), capped at both ends. */
  bone(a, b, r1, r2, col, sides = 7, em = 0) {
    let ax = b[0] - a[0], ay = b[1] - a[1], az = b[2] - a[2];
    const al = Math.hypot(ax, ay, az) || 1;
    ax /= al;
    ay /= al;
    az /= al;
    const rx = Math.abs(az) > 0.92 ? 1 : 0, rz = rx ? 0 : 1; // ref = [1,0,0] or [0,0,1]
    let ux = ay * rz, uy = az * rx - ax * rz, uz = -ay * rx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
    for (let i = 0; i < sides; i++) {
      const t = (TAU * i) / sides, cs = Math.cos(t), sn = Math.sin(t);
      const qx = ux * cs + vx * sn, qy = uy * cs + vy * sn, qz = uz * cs + vz * sn;
      const A = POOL[i], B = POOL[i + 32];
      A[0] = a[0] + qx * r1;
      A[1] = a[1] + qy * r1;
      A[2] = a[2] + qz * r1;
      B[0] = b[0] + qx * r2;
      B[1] = b[1] + qy * r2;
      B[2] = b[2] + qz * r2;
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      this.quad(POOL[i], POOL[j], POOL[j + 32], POOL[i + 32], col, em);
      this.tri(a, POOL[j], POOL[i], col, em);
      this.tri(b, POOL[i + 32], POOL[j + 32], col, em);
    }
  }

  /** A low-poly ellipsoid centred on p with radii s. */
  sphere(p, s, col, rows = 4, cols = 7, em = 0) {
    const W = cols + 1;
    for (let yy = 0; yy <= rows; yy++) {
      const b = (Math.PI * yy) / rows, sb = Math.sin(b), cb = Math.cos(b);
      for (let xx = 0; xx <= cols; xx++) {
        const a = (TAU * xx) / cols, P = POOL[yy * W + xx];
        P[0] = p[0] + Math.cos(a) * sb * s[0];
        P[1] = p[1] + cb * s[1];
        P[2] = p[2] + Math.sin(a) * sb * s[2];
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const q0 = POOL[y * W + x], q1 = POOL[y * W + x + 1], q2 = POOL[(y + 1) * W + x + 1], q3 = POOL[(y + 1) * W + x];
        if (y === 0) this.tri(q0, q2, q3, col, em);
        else if (y === rows - 1) this.tri(q0, q1, q2, col, em);
        else this.quad(q0, q1, q2, q3, col, em);
      }
    }
  }

  /** A flat ring on the floor (outer radius r, width w). */
  ring(p, r, w, col, steps = 64, em = 0) {
    const A = POOL[0], B = POOL[1], C = POOL[2], D = POOL[3];
    for (let i = 0; i < steps; i++) {
      const a = (i * TAU) / steps, b = ((i + 1) * TAU) / steps;
      A[0] = p[0] + Math.cos(a) * r; A[1] = p[1]; A[2] = p[2] + Math.sin(a) * r;
      B[0] = p[0] + Math.cos(b) * r; B[1] = p[1]; B[2] = p[2] + Math.sin(b) * r;
      C[0] = p[0] + Math.cos(b) * (r - w); C[1] = p[1]; C[2] = p[2] + Math.sin(b) * (r - w);
      D[0] = p[0] + Math.cos(a) * (r - w); D[1] = p[1]; D[2] = p[2] + Math.sin(a) * (r - w);
      this.quad(A, B, C, D, col, em);
    }
  }
}
