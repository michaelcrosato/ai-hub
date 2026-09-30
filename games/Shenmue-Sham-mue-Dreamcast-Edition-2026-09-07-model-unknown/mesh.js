/* Sham-mue — the game's own procedural modelling kit.
   Every model in the harbour is written with this builder: boxes, rings, beams and smooth
   quads pushed through a matrix stack. A vertex is 13 floats:
   position(3) normal(3) uv(2) colour(3, sRGB) texture index(1) surface flag(1).
   gfx.js turns the arrays into three.js geometry. */

export const PI = Math.PI, TAU = PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t;
export const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, s) => a.map(v => v * s);
export const dot = (a, b) => a.reduce((v, n, i) => v + n * b[i], 0), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = a => mul(a, 1 / (Math.hypot(...a) || 1)), dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), angdiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

let seed = 84171;
export function rand() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

const hexCache = new Map();
export const hex = s => {
  if (Array.isArray(s)) return s;
  let c = hexCache.get(s);
  if (c) return c;
  let t = s.replace('#', '');
  if (t.length === 3) t = t.split('').map(ch => ch + ch).join('');
  c = [parseInt(t.slice(0, 2), 16) / 255, parseInt(t.slice(2, 4), 16) / 255, parseInt(t.slice(4, 6), 16) / 255];
  hexCache.set(s, c);
  return c;
};

export const M = {
  id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  mul: (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; },
  tr: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  sc: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  rx: a => [1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1],
  ry: a => [Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1],
  rz: a => [Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  pt: (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]],
  dir: (m, p) => norm([m[0] * p[0] + m[4] * p[1] + m[8] * p[2], m[1] * p[0] + m[5] * p[1] + m[9] * p[2], m[2] * p[0] + m[6] * p[1] + m[10] * p[2]])
};

export class MeshBuilder {
  constructor() { this.a = []; this.m = M.id(); this.stack = []; }
  push(x = 0, y = 0, z = 0, yaw = 0) { this.stack.push(this.m); this.m = M.mul(this.m, M.mul(M.tr(x, y, z), M.ry(yaw))); return this; }
  pop() { this.m = this.stack.pop(); return this; }
  rotateX(a) { this.m = M.mul(this.m, M.rx(a)); return this; }
  rotateZ(a) { this.m = M.mul(this.m, M.rz(a)); return this; }
  vertex(p, n, uv, c, tx, fx) { p = M.pt(this.m, p); n = M.dir(this.m, n); this.a.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], c[0], c[1], c[2], tx, fx); }
  tri(a, b, c, tx = 0, col = '#ffffff', uv = [[0, 1], [1, 1], [1, 0]], fx = 0) { const n = norm(cross(sub(b, a), sub(c, a))), color = hex(col); this.vertex(a, n, uv[0], color, tx, fx); this.vertex(b, n, uv[1], color, tx, fx); this.vertex(c, n, uv[2], color, tx, fx); }
  quad(a, b, c, d, tx = 0, col = '#ffffff', rx = 1, ry = 1, fx = 0) { this.tri(a, b, c, tx, col, [[0, ry], [rx, ry], [rx, 0]], fx); this.tri(a, c, d, tx, col, [[0, ry], [rx, 0], [0, 0]], fx); }
  box(x, y, z, w, h, d, tx = 0, col = '#ffffff', tile = 0, fx = 0) {
    const l = x - w / 2, r = x + w / 2, b = y - h / 2, t = y + h / 2, f = z + d / 2, k = z - d / 2;
    this.quad([l, b, f], [r, b, f], [r, t, f], [l, t, f], tx, col, tile ? w / tile : 1, tile ? h / tile : 1, fx);
    this.quad([r, b, k], [l, b, k], [l, t, k], [r, t, k], tx, col, tile ? w / tile : 1, tile ? h / tile : 1, fx);
    this.quad([r, b, f], [r, b, k], [r, t, k], [r, t, f], tx, col, tile ? d / tile : 1, tile ? h / tile : 1, fx);
    this.quad([l, b, k], [l, b, f], [l, t, f], [l, t, k], tx, col, tile ? d / tile : 1, tile ? h / tile : 1, fx);
    this.quad([l, t, f], [r, t, f], [r, t, k], [l, t, k], tx, col, tile ? w / tile : 1, tile ? d / tile : 1, fx);
    this.quad([l, b, k], [r, b, k], [r, b, f], [l, b, f], tx, col, tile ? w / tile : 1, tile ? d / tile : 1, fx);
    return this;
  }
  plane(x, y, z, w, h, tx, col = '#ffffff', yaw = 0, fx = 0) { this.push(x, y, z, yaw); this.quad([-w / 2, -h / 2, 0], [w / 2, -h / 2, 0], [w / 2, h / 2, 0], [-w / 2, h / 2, 0], tx, col, .9999, .9999, fx); this.pop(); return this; }
  cylinder(x, y, z, r1, r2, h, tx, col, sides = 10) {
    this.push(x, y, z);
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TAU, b = (i + 1) / sides * TAU, p = [Math.cos(a) * r1, -h / 2, Math.sin(a) * r1], q = [Math.cos(b) * r1, -h / 2, Math.sin(b) * r1], r = [Math.cos(b) * r2, h / 2, Math.sin(b) * r2], s = [Math.cos(a) * r2, h / 2, Math.sin(a) * r2];
      this.quad(q, p, s, r, tx, col); this.tri([0, h / 2, 0], r, s, tx, col); this.tri([0, -h / 2, 0], p, q, tx, col);
    }
    this.pop(); return this;
  }
  sphere(x, y, z, rx, ry, rz, tx, col, rings = 6, sides = 10) {
    this.push(x, y, z);
    const p = (a, b) => [Math.sin(a) * Math.cos(b) * rx, Math.cos(a) * ry, Math.sin(a) * Math.sin(b) * rz];
    for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) { const a = j / rings * PI, b = (j + 1) / rings * PI, c = i / sides * TAU, d = (i + 1) / sides * TAU; this.quad(p(b, d), p(b, c), p(a, c), p(a, d), tx, col); }
    this.pop(); return this;
  }
  beam(a, b, w, tx, col, d = w) {
    const direction = sub(b, a), y = norm(direction), x = norm(cross(y, Math.abs(y[1]) > .9 ? [1, 0, 0] : [0, 1, 0])), z = cross(x, y), mid = mul(add(a, b), .5);
    const mat = [...x, 0, ...y, 0, ...z, 0, ...mid, 1];
    this.stack.push(this.m); this.m = M.mul(this.m, mat); this.box(0, 0, 0, w, Math.hypot(...direction), d, tx, col); this.pop(); return this;
  }
  taper(x, y, z, wb, wt, h, db, dt, tx, col) {
    const l = -wb / 2, r = wb / 2, L = -wt / 2, R = wt / 2, b = -h / 2, t = h / 2;
    this.push(x, y, z);
    this.quad([l, b, db / 2], [r, b, db / 2], [R, t, dt / 2], [L, t, dt / 2], tx, col); this.quad([r, b, -db / 2], [l, b, -db / 2], [L, t, -dt / 2], [R, t, -dt / 2], tx, col);
    this.quad([r, b, db / 2], [r, b, -db / 2], [R, t, -dt / 2], [R, t, dt / 2], tx, col); this.quad([l, b, -db / 2], [l, b, db / 2], [L, t, dt / 2], [L, t, -dt / 2], tx, col);
    this.quad([L, t, dt / 2], [R, t, dt / 2], [R, t, -dt / 2], [L, t, -dt / 2], tx, col); this.quad([l, b, -db / 2], [r, b, -db / 2], [r, b, db / 2], [l, b, db / 2], tx, col);
    this.pop(); return this;
  }
  smoothQuad(points, normals, uvs, tx, col = '#fff', fx = 0) { const c = hex(col); for (const i of [0, 1, 2, 0, 2, 3]) this.vertex(points[i], normals[i], uvs[i], c, tx, fx); return this; }
  ellipsoid(x, y, z, rx, ry, rz, tx, col = '#fff', rings = 8, sides = 16, fx = 0) {
    this.push(x, y, z);
    const p = (a, b) => [Math.sin(a) * Math.sin(b) * rx, Math.cos(a) * ry, -Math.sin(a) * Math.cos(b) * rz], n = (a, b) => norm([Math.sin(a) * Math.sin(b) / rx, Math.cos(a) / ry, -Math.sin(a) * Math.cos(b) / rz]);
    for (let j = 0; j < rings; j++) for (let i = 0; i < sides; i++) {
      const a = j / rings * PI, b = (j + 1) / rings * PI, c = i / sides * TAU, d = (i + 1) / sides * TAU;
      this.smoothQuad([p(b, c), p(b, d), p(a, d), p(a, c)], [n(b, c), n(b, d), n(a, d), n(a, c)], [[i / sides, (j + 1) / rings], [(i + 1) / sides, (j + 1) / rings], [(i + 1) / sides, j / rings], [i / sides, j / rings]], tx, col, fx);
    }
    this.pop(); return this;
  }
  // A ring is [height, half-width, half-depth, forward shift]. UVs can be cylindrical or planar.
  rings(rings, front, back = front, col = '#fff', sides = 16, fx = 0, planar = false) {
    const maxX = Math.max(...rings.map(r => r[1])), minY = rings[0][0], maxY = rings[rings.length - 1][0];
    const point = (j, i) => { const r = rings[j], a = -PI + i / sides * TAU; return [Math.sin(a) * r[1], r[0], -Math.cos(a) * r[2] + (r[3] || 0)]; };
    const normal = (j, i) => { const r = rings[j], a = -PI + i / sides * TAU, lo = rings[Math.max(0, j - 1)], hi = rings[Math.min(rings.length - 1, j + 1)], dy = hi[0] - lo[0] || 1, dx = (hi[1] - lo[1]) / dy, dz = (hi[2] - lo[2]) / dy; return norm([Math.sin(a) / r[1], -(dx * Math.sin(a) ** 2 / r[1] + dz * Math.cos(a) ** 2 / r[2]), -Math.cos(a) / r[2]]); };
    const uv = (p, i, fr) => planar ? [.5 + p[0] / (2 * maxX) * (fr ? 1 : -1) * .97, clamp((maxY - p[1]) / (maxY - minY), .002, .998)] : [clamp(i / sides, .002, .998), clamp((maxY - p[1]) / (maxY - minY), .002, .998)];
    for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < sides; i++) {
      const a = -PI + (i + .5) / sides * TAU, fr = Math.cos(a) > 0, pts = [point(j, i), point(j, i + 1), point(j + 1, i + 1), point(j + 1, i)];
      this.smoothQuad(pts, [normal(j, i), normal(j, i + 1), normal(j + 1, i + 1), normal(j + 1, i)], pts.map((p, k) => uv(p, i + (k === 1 || k === 2 ? 1 : 0), fr)), fr ? front : back, col, fx);
    }
    return this;
  }
  torus(x, y, z, R, r, tx, col = '#fff', segments = 24, sides = 6) {
    this.push(x, y, z);
    const pt = (a, b) => [(R + Math.cos(b) * r) * Math.cos(a), Math.sin(b) * r, (R + Math.cos(b) * r) * Math.sin(a)];
    const no = (a, b) => [Math.cos(b) * Math.cos(a), Math.sin(b), Math.cos(b) * Math.sin(a)];
    for (let i = 0; i < segments; i++) for (let j = 0; j < sides; j++) {
      const a = i / segments * TAU, b = (i + 1) / segments * TAU, c = j / sides * TAU, d = (j + 1) / sides * TAU;
      this.smoothQuad([pt(a, c), pt(b, c), pt(b, d), pt(a, d)], [no(a, c), no(b, c), no(b, d), no(a, d)], [[0, 0], [1, 0], [1, 1], [0, 1]], tx, col);
    }
    this.pop(); return this;
  }
  roundBox(x, y, z, w, h, d, bevel, tx, col = '#fff', fx = 0) {
    this.push(x, y, z);
    const r = bevel, pts = [[-w / 2 + r, -d / 2], [w / 2 - r, -d / 2], [w / 2, -d / 2 + r], [w / 2, d / 2 - r], [w / 2 - r, d / 2], [-w / 2 + r, d / 2], [-w / 2, d / 2 - r], [-w / 2, -d / 2 + r]];
    for (let i = 0; i < 8; i++) {
      const a = pts[i], b = pts[(i + 1) % 8];
      this.quad([a[0], -h / 2, a[1]], [b[0], -h / 2, b[1]], [b[0], h / 2, b[1]], [a[0], h / 2, a[1]], tx, col, 1, 1, fx);
      this.tri([0, h / 2, 0], [a[0], h / 2, a[1]], [b[0], h / 2, b[1]], tx, col);
      this.tri([0, -h / 2, 0], [b[0], -h / 2, b[1]], [a[0], -h / 2, a[1]], tx, col);
    }
    this.pop(); return this;
  }
}
