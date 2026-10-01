// geo.js: small vector helpers and the original low-poly geometry builder.
// Pure JavaScript (no DOM, no three.js), so the level code can be checked under node.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

/** The original column-major model matrix: translate · rotY · rotX · rotZ · scale. */
export function modelMatrix(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1, out = new Float32Array(16), o = 0) {
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  out[o] = (cy * cz + sy * sx * sz) * s;
  out[o + 1] = cx * sz * s;
  out[o + 2] = (-sy * cz + cy * sx * sz) * s;
  out[o + 3] = 0;
  out[o + 4] = (-cy * sz + sy * sx * cz) * s;
  out[o + 5] = cx * cz * s;
  out[o + 6] = (sy * sz + cy * sx * cz) * s;
  out[o + 7] = 0;
  out[o + 8] = sy * cx * s;
  out[o + 9] = -sx * s;
  out[o + 10] = cy * cx * s;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
  return out;
}

const point = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
];

/** The original seeded generator (LCG), one per use so levels build the same every time. */
export function makeRng(seed) {
  let s = seed | 0;
  const r = () => {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  return r;
}

/**
 * The original builder: flat-shaded triangles with position, normal, uv, atlas tile,
 * tint colour and glow per vertex (13 floats). data() hands the arrays to three.js.
 */
export class Geo {
  constructor() {
    this.v = [];
    this.transform = null;
  }
  tri(a, b, c, tile = 0, col = [1, 1, 1], glow = 0, uvs = [[0, 0], [1, 0], [1, 1]]) {
    if (this.transform) {
      a = point(this.transform, a);
      b = point(this.transform, b);
      c = point(this.transform, c);
    }
    const n = V.norm(V.cross(V.sub(b, a), V.sub(c, a)));
    const pts = [a, b, c];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], uvs[i][0], uvs[i][1], tile, col[0], col[1], col[2], glow);
    }
  }
  quad(a, b, c, d, tile = 0, col = [1, 1, 1], glow = 0, u = 1, v = 1) {
    this.tri(a, b, c, tile, col, glow, [[0, 0], [u, 0], [u, v]]);
    this.tri(a, c, d, tile, col, glow, [[0, 0], [u, v], [0, v]]);
  }
  box(x, y, z, w, h, d, t = 0, col = [1, 1, 1], glow = 0, uvScale = 2.8) {
    const a = x - w / 2, b = x + w / 2, c = y - h / 2, e = y + h / 2, f = z - d / 2, g = z + d / 2;
    this.quad([a, c, g], [b, c, g], [b, e, g], [a, e, g], t, col, glow, w / uvScale, h / uvScale);
    this.quad([b, c, f], [a, c, f], [a, e, f], [b, e, f], t, col, glow, w / uvScale, h / uvScale);
    this.quad([b, c, g], [b, c, f], [b, e, f], [b, e, g], t, col, glow, d / uvScale, h / uvScale);
    this.quad([a, c, f], [a, c, g], [a, e, g], [a, e, f], t, col, glow, d / uvScale, h / uvScale);
    this.quad([a, e, g], [b, e, g], [b, e, f], [a, e, f], t, col, glow, w / uvScale, d / uvScale);
    this.quad([a, c, f], [b, c, f], [b, c, g], [a, c, g], t, col, glow, w / uvScale, d / uvScale);
  }
  cylinder(x, y, z, r, h, t = 2, col = [1, 1, 1], segments = 10, r2 = r, glow = 0, axis = 'y') {
    const map = (a, b, c) => (axis === 'z' ? [a, c, -b] : axis === 'x' ? [b, a, c] : [a, b, c]);
    const tr = (p) => {
      const q = map(p[0], p[1], p[2]);
      return [q[0] + x, q[1] + y, q[2] + z];
    };
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU, b = ((i + 1) / segments) * TAU;
      const p = [Math.cos(a) * r, -h / 2, Math.sin(a) * r], q = [Math.cos(b) * r, -h / 2, Math.sin(b) * r];
      const rA = [Math.cos(a) * r2, h / 2, Math.sin(a) * r2], rB = [Math.cos(b) * r2, h / 2, Math.sin(b) * r2];
      this.quad(tr(q), tr(p), tr(rA), tr(rB), t, col, glow, 0.3, h / 2);
      this.tri(tr([0, h / 2, 0]), tr(rB), tr(rA), t, col, glow);
      this.tri(tr([0, -h / 2, 0]), tr(p), tr(q), t, col, glow);
    }
  }
  sphere(x, y, z, r, t = 15, col = [1, 1, 1], glow = 0, sx = 1, sy = 1, sz = 1) {
    const seg = 10, rings = 6;
    const p = (i, j) => {
      const a = (i / seg) * TAU, b = (j / rings) * Math.PI;
      return [x + Math.sin(b) * Math.cos(a) * r * sx, y + Math.cos(b) * r * sy, z + Math.sin(b) * Math.sin(a) * r * sz];
    };
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) this.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), t, col, glow, 0.3, 0.3);
  }
  torus(x, y, z, r, tube, t = 2, col = [1, 1, 1], glow = 0) {
    const p = (i, j) => {
      const a = (i / 32) * TAU, b = (j / 6) * TAU;
      return [x + (r + Math.cos(b) * tube) * Math.cos(a), y + (r + Math.cos(b) * tube) * Math.sin(a), z + Math.sin(b) * tube];
    };
    for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) this.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), t, col, glow, 0.25, 0.25);
  }
  /** A flat disc of triangles facing +z (used for portals). */
  disc(x, y, z, r, segments, t, col, glow) {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * TAU, b = ((i + 1) / segments) * TAU;
      this.tri(
        [x, y, z],
        [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
        [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
        t, col, glow,
        [[0.5, 0.5], [0.5 + Math.cos(a) * 0.49, 0.5 + Math.sin(a) * 0.49], [0.5 + Math.cos(b) * 0.49, 0.5 + Math.sin(b) * 0.49]]
      );
    }
  }
  get count() {
    return this.v.length / 13;
  }
  /** Separate typed arrays per attribute (position, normal, uv, tile, colour, glow). */
  data() {
    const v = this.v, n = v.length / 13;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
    const tile = new Float32Array(n), col = new Float32Array(n * 3), glow = new Float32Array(n);
    for (let i = 0, o = 0; i < n; i++, o += 13) {
      pos[i * 3] = v[o]; pos[i * 3 + 1] = v[o + 1]; pos[i * 3 + 2] = v[o + 2];
      nor[i * 3] = v[o + 3]; nor[i * 3 + 1] = v[o + 4]; nor[i * 3 + 2] = v[o + 5];
      uv[i * 2] = v[o + 6]; uv[i * 2 + 1] = v[o + 7];
      tile[i] = v[o + 8];
      col[i * 3] = v[o + 9]; col[i * 3 + 1] = v[o + 10]; col[i * 3 + 2] = v[o + 11];
      glow[i] = v[o + 12];
    }
    return { count: n, pos, nor, uv, tile, col, glow };
  }
}
