// Pocket Parade: Lantern Tide. Small math helpers, the seeded random stream and the
// Builder that bakes coloured parts into flat vertex arrays. Every model in the game
// is made here from boxes, spheres, cylinders, rings and stars; render.js turns the
// arrays into three.js geometry. A vertex is 12 floats: position 3, normal 3, rgba 4, uv 2.

export const TAU = Math.PI * 2, PI = Math.PI;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; },
};

// Quaternions are [x, y, z, w]. Q.euler(x, y, z) is Ry * Rx * Rz (three.js order 'YXZ').
export const Q = {
  identity: () => [0, 0, 0, 1],
  axis: (a, r) => { const s = Math.sin(r / 2); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(r / 2)]; },
  mul: (a, b) => [
    a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1],
    a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
    a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],
  inv: (a) => [-a[0], -a[1], -a[2], a[3]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2], a[3]) || 1; return [a[0] / l, a[1] / l, a[2] / l, a[3] / l]; },
  rot: (q, v) => { const t = V.scale(V.cross(q, v), 2); return V.add(v, V.add(V.scale(t, q[3]), V.cross(q, t))); },
  euler: (x = 0, y = 0, z = 0) => Q.mul(Q.mul(Q.axis([0, 1, 0], y), Q.axis([1, 0, 0], x)), Q.axis([0, 0, 1], z)),
  fromTo: (a, b) => { const d = V.dot(a, b); if (d < -0.9999) return Q.axis([1, 0, 0], PI); return Q.norm([...V.cross(a, b), 1 + d]); },
};

/** Write a translation / rotation / scale matrix (column-major) into out at offset o. No allocation. */
export function writeTRS(out, o, x, y, z, qx, qy, qz, qw, sx = 1, sy = sx, sz = sx) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  out[o] = (1 - yy - zz) * sx; out[o + 1] = (xy + wz) * sx; out[o + 2] = (xz - wy) * sx; out[o + 3] = 0;
  out[o + 4] = (xy - wz) * sy; out[o + 5] = (1 - xx - zz) * sy; out[o + 6] = (yz + wx) * sy; out[o + 7] = 0;
  out[o + 8] = (xz + wy) * sz; out[o + 9] = (yz - wx) * sz; out[o + 10] = (1 - xx - yy) * sz; out[o + 11] = 0;
  out[o + 12] = x; out[o + 13] = y; out[o + 14] = z; out[o + 15] = 1;
}

/** Euler (x, y, z) in 'YXZ' order into a reusable quaternion array. */
export function eulerInto(q, x, y, z) {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2), cy = Math.cos(y / 2), sy = Math.sin(y / 2), cz = Math.cos(z / 2), sz = Math.sin(z / 2);
  q[0] = sx * cy * cz + cx * sy * sz;
  q[1] = cx * sy * cz - sx * cy * sz;
  q[2] = cx * cy * sz - sx * sy * cz;
  q[3] = cx * cy * cz + sx * sy * sz;
  return q;
}

// The seeded stream keeps the item layout identical on every run.
let seed = 92841;
export function setSeed(s) { seed = s >>> 0; }
export function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
export const between = (a, b) => a + rnd() * (b - a);

export function rgba(hex, alpha = 1) {
  if (Array.isArray(hex)) return hex.length === 4 ? hex : [...hex, alpha];
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, alpha];
}

let meshID = 0;
export const G = {};

export class Builder {
  constructor() { this.a = []; }
  tri(p1, p2, p3, c, n = null, uv = [[0, 0], [1, 0], [1, 1]]) {
    n = n || V.norm(V.cross(V.sub(p2, p1), V.sub(p3, p1)));
    c = rgba(c);
    [p1, p2, p3].forEach((p, i) => this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c[3], uv[i][0], uv[i][1]));
    return this;
  }
  quad(a, b, c, d, color, n = null, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    this.tri(a, b, c, color, n, [uv[0], uv[1], uv[2]]);
    this.tri(a, c, d, color, n, [uv[0], uv[2], uv[3]]);
    return this;
  }
  part(verts, col, p = [0, 0, 0], s = [1, 1, 1], q = [0, 0, 0, 1]) {
    col = rgba(col);
    for (let i = 0; i < verts.length; i += 8) {
      const v = V.add(Q.rot(q, [verts[i] * s[0], verts[i + 1] * s[1], verts[i + 2] * s[2]]), p);
      const n = V.norm(Q.rot(q, [verts[i + 3] / s[0], verts[i + 4] / s[1], verts[i + 5] / s[2]]));
      this.a.push(v[0], v[1], v[2], n[0], n[1], n[2], col[0], col[1], col[2], col[3], verts[i + 6], verts[i + 7]);
    }
    return this;
  }
  box(c, p, s, r = [0, 0, 0]) { return this.part(G.box, c, p, s, Q.euler(...r)); }
  sphere(c, p, s, r = [0, 0, 0]) { if (typeof s === 'number') s = [s, s, s]; return this.part(G.sphere, c, p, s, Q.euler(...r)); }
  cyl(c, p, rt, rb, h, r = [0, 0, 0], seg = 12) { return this.part(cylinder(rt, rb, h, seg), c, p, [1, 1, 1], Q.euler(...r)); }
  ring(c, p, R, t, r = [0, 0, 0], seg = 16) { return this.part(torus(R, t, seg), c, p, [1, 1, 1], Q.euler(...r)); }
  star(c, p, s = 1, r = [0, 0, 0]) { return this.part(G.star, c, p, [s, s, s], Q.euler(...r)); }
  shift(x, y, z) { for (let i = 0; i < this.a.length; i += 12) { this.a[i] += x; this.a[i + 1] += y; this.a[i + 2] += z; } return this; }
  /** A mesh definition: the raw vertex array plus its look (tex, emission, roughness, unlit…). */
  build(opts = {}) { return { id: ++meshID, raw: this.a, ...opts }; }
}

function primitiveFromBuilder(b) {
  const a = [];
  for (let i = 0; i < b.a.length; i += 12) a.push(...b.a.slice(i, i + 6), ...b.a.slice(i + 10, i + 12));
  return a;
}

export function initGeometry() {
  if (G.box) return;
  let b = new Builder();
  const c = '#ffffff';
  b.quad([-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5], c);
  b.quad([0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], c);
  b.quad([0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], c);
  b.quad([-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5], c);
  b.quad([-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], c);
  b.quad([-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], c);
  G.box = primitiveFromBuilder(b);
  b = new Builder();
  const rings = 8, slices = 12;
  const sph = (t, p) => [Math.sin(t) * Math.cos(p), Math.cos(t), Math.sin(t) * Math.sin(p)];
  for (let j = 0; j < rings; j++) for (let i = 0; i < slices; i++) {
    const a = sph(j / rings * PI, i / slices * TAU), d = sph(j / rings * PI, (i + 1) / slices * TAU);
    const c2 = sph((j + 1) / rings * PI, (i + 1) / slices * TAU), b2 = sph((j + 1) / rings * PI, i / slices * TAU);
    if (j > 0) b.tri(a, d, b2, c);
    if (j < rings - 1) b.tri(d, c2, b2, c);
  }
  G.sphere = primitiveFromBuilder(b);
  b = new Builder();
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = PI / 2 + i * PI / 5, r = i % 2 ? 0.23 : 0.5; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    b.tri([0, 0, 0.09], [...pts[i], 0.09], [...pts[j], 0.09], c);
    b.tri([0, 0, -0.09], [...pts[j], -0.09], [...pts[i], -0.09], c);
    b.quad([...pts[i], 0.09], [...pts[i], -0.09], [...pts[j], -0.09], [...pts[j], 0.09], c);
  }
  G.star = primitiveFromBuilder(b);
}

const cylCache = new Map(), torCache = new Map();
export function cylinder(rt, rb, h, seg = 12) {
  const key = [rt, rb, h, seg].join(',');
  if (cylCache.has(key)) return cylCache.get(key);
  const b = new Builder(), c = '#ffffff';
  for (let i = 0; i < seg; i++) {
    const a = i / seg * TAU, d = (i + 1) / seg * TAU;
    const bt = [Math.cos(a) * rb, -h / 2, Math.sin(a) * rb], bd = [Math.cos(d) * rb, -h / 2, Math.sin(d) * rb];
    const tt = [Math.cos(a) * rt, h / 2, Math.sin(a) * rt], td = [Math.cos(d) * rt, h / 2, Math.sin(d) * rt];
    b.quad(bt, tt, td, bd, c);
    if (rt > 0) b.tri([0, h / 2, 0], td, tt, c, [0, 1, 0]);
    if (rb > 0) b.tri([0, -h / 2, 0], bt, bd, c, [0, -1, 0]);
  }
  const data = primitiveFromBuilder(b);
  cylCache.set(key, data);
  return data;
}
export function torus(R, t, seg = 16) {
  const key = [R, t, seg].join(',');
  if (torCache.has(key)) return torCache.get(key);
  const b = new Builder(), c = '#ffffff', sides = 6;
  const pos = (u, v) => [(R + t * Math.cos(v)) * Math.cos(u), (R + t * Math.cos(v)) * Math.sin(u), t * Math.sin(v)];
  for (let i = 0; i < seg; i++) for (let j = 0; j < sides; j++) {
    const u = i / seg * TAU, u1 = (i + 1) / seg * TAU, v = j / sides * TAU, v1 = (j + 1) / sides * TAU;
    b.quad(pos(u, v), pos(u1, v), pos(u1, v1), pos(u, v1), c);
  }
  const data = primitiveFromBuilder(b);
  torCache.set(key, data);
  return data;
}
/** A thin cylinder from point a to point d. */
export function beam(b, c, a, d, r = 0.05) {
  const delta = V.sub(d, a), mid = V.scale(V.add(a, d), 0.5);
  b.part(cylinder(r, r, V.len(delta), 6), c, mid, [1, 1, 1], Q.fromTo([0, 1, 0], V.norm(delta)));
}
