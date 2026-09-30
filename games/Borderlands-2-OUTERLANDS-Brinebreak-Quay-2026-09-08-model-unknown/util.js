// OUTERLANDS: small math, colour and procedural-mesh helpers shared by every module.
// The Builder is the game's original mesh maker: flat-shaded triangles with a colour per
// vertex, plus ink edge lines. gfx.js turns its arrays into three.js geometry.

export const $ = (id) => document.getElementById(id);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

// Seeded so the coast is laid out the same way every time (terrain tint, cracks,
// mountains, sign scuffs). Level building must call it in the original order.
let seed = 48153;
export const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
export const rnd = (a, b) => a + rand() * (b - a);
export const pick = (a) => a[Math.floor(rand() * a.length)];

export const color = (h) => {
  if (Array.isArray(h)) return h;
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const C = {
  ink: color('#172d32'),
  snow: color('#d4e4d7'),
  ice: color('#83bbc3'),
  deep: color('#406e7c'),
  rust: color('#b75632'),
  orange: color('#e89448'),
  yellow: color('#f8c544'),
  steel: color('#5f7d7d'),
  dark: color('#2d464b'),
  blue: color('#6fdbed'),
  red: color('#e95943'),
  paper: color('#eee8cd'),
};

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

export function mulMat(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

/** Column-major T · Ry · S · Rx · Rz, exactly as the original renderer composed it. */
export function model(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  let m = new Float32Array([c * sx, 0, -s * sx, 0, 0, sy, 0, 0, s * sz, 0, c * sz, 0, x, y, z, 1]);
  if (rx) {
    const a = identity();
    const v = Math.cos(rx);
    const u = Math.sin(rx);
    a[5] = v;
    a[6] = u;
    a[9] = -u;
    a[10] = v;
    m = mulMat(m, a);
  }
  if (rz) {
    const a = identity();
    const v = Math.cos(rz);
    const u = Math.sin(rz);
    a[0] = v;
    a[1] = u;
    a[4] = -u;
    a[5] = v;
    m = mulMat(m, a);
  }
  return m;
}

export function transform(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/**
 * Procedural mesh builder. v: 9 floats per vertex (position, normal, colour) for
 * triangles; l: 9 floats per vertex for line segments (normal slot unused).
 */
export class Builder {
  constructor() {
    this.v = [];
    this.l = [];
  }
  vertex(p, n, c) {
    this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2]);
  }
  tri(a, b, c, col) {
    const n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
    this.vertex(a, n, col);
    this.vertex(b, n, col);
    this.vertex(c, n, col);
  }
  quad(a, b, c, d, col) {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }
  line(a, b, c = C.ink) {
    this.l.push(a[0], a[1], a[2], 0, 1, 0, c[0], c[1], c[2], b[0], b[1], b[2], 0, 1, 0, c[0], c[1], c[2]);
  }
  box(x, y, z, w, h, d, col, ry = 0, rz = 0, rx = 0, edge = true) {
    const m = model(x, y, z, ry, 1, 1, 1, rx, rz);
    const a = [
      [-w / 2, -h / 2, -d / 2], [w / 2, -h / 2, -d / 2], [w / 2, h / 2, -d / 2], [-w / 2, h / 2, -d / 2],
      [-w / 2, -h / 2, d / 2], [w / 2, -h / 2, d / 2], [w / 2, h / 2, d / 2], [-w / 2, h / 2, d / 2],
    ].map((p) => transform(m, p));
    const faces = [[1, 0, 3, 2], [4, 5, 6, 7], [0, 4, 7, 3], [5, 1, 2, 6], [3, 7, 6, 2], [0, 1, 5, 4]];
    for (const f of faces) this.quad(a[f[0]], a[f[1]], a[f[2]], a[f[3]], col);
    if (edge) for (const e of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) this.line(a[e[0]], a[e[1]]);
    return this;
  }
  cylinder(x, y, z, r1, r2, h, col, n = 8, edge = true) {
    const bot = [];
    const top = [];
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      bot.push([x + Math.cos(a) * r1, y - h / 2, z + Math.sin(a) * r1]);
      top.push([x + Math.cos(a) * r2, y + h / 2, z + Math.sin(a) * r2]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad(bot[j], bot[i], top[i], top[j], col);
      this.tri([x, y + h / 2, z], top[j], top[i], col);
      this.tri([x, y - h / 2, z], bot[i], bot[j], col);
      if (edge) {
        this.line(top[i], top[j]);
        this.line(bot[i], bot[j]);
        if (i % 2 === 0) this.line(bot[i], top[i]);
      }
    }
    return this;
  }
  beam(a, b, r, col, n = 6) {
    const axis = V.norm(V.sub(b, a));
    const side = V.norm(V.cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]));
    const up = V.cross(side, axis);
    const v = [];
    const w = [];
    for (let i = 0; i < n; i++) {
      const ang = (TAU * i) / n;
      const off = V.add(V.mul(side, Math.cos(ang) * r), V.mul(up, Math.sin(ang) * r));
      v.push(V.add(a, off));
      w.push(V.add(b, off));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      this.quad(v[i], v[j], w[j], w[i], col);
      this.tri(a, v[j], v[i], col);
      this.tri(b, w[i], w[j], col);
      this.line(w[i], w[j]);
      if (i % 2 === 0) this.line(v[i], w[i]);
    }
    return this;
  }
  ico(x, y, z, r, col, sx = 1, sy = 1, sz = 1, edge = false) {
    const t = (1 + Math.sqrt(5)) / 2;
    const p = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map((a) => {
      const q = V.mul(V.norm(a), r);
      return [x + q[0] * sx, y + q[1] * sy, z + q[2] * sz];
    });
    const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (const f of faces) {
      this.tri(p[f[0]], p[f[1]], p[f[2]], col);
      if (edge) {
        this.line(p[f[0]], p[f[1]]);
        this.line(p[f[1]], p[f[2]]);
      }
    }
    return this;
  }
  ring(x, y, z, r, col, n = 36) {
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      const b = ((i + 1) * TAU) / n;
      this.line([x + Math.cos(a) * r, y, z + Math.sin(a) * r], [x + Math.cos(b) * r, y, z + Math.sin(b) * r], col);
    }
    return this;
  }
}

export const clone = (o) => JSON.parse(JSON.stringify(o));
