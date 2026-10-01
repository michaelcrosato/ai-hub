/* world.js — Boulder Bop Hill as data.
 *
 * The level, its terrain function and every scenery shape from the original
 * hand-written WebGL version, kept vertex for vertex: the same seeded random
 * stream, the same flat-shaded triangles and the same per-surface tags (grass,
 * cliff, dirt). Nothing here touches the GPU; main.js turns the arrays into
 * three.js geometry.
 */

export const TAU = Math.PI * 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const hypot = Math.hypot;

// The original's LCG, so the meadow, flowers, hills and clouds come out the same.
let seed = 631996;
export function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const range = (a, b) => a + (b - a) * rand();

export const color = (h) => {
  if (Array.isArray(h)) return h;
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export const C = {
  grass: color('#74b84e'), dirt: color('#daab69'), cliff: color('#aa7249'), wood: color('#93633f'), trunk: color('#885936'),
  leaf: color('#4d9d48'), gold: color('#ffcf3a'), red: color('#f25a4c'), navy: color('#3c6386'), cream: color('#fff5d7'),
  black: color('#263c3d'), white: color('#fffef1'), pink: color('#f0ba84'),
};

/* Surface tags: 0 plain, 1 grass ripple, 2 cliff checker, 3 dirt speckle (water is its own mesh). */
export const SURF = { plain: 0, grass: 1, cliff: 2, dirt: 3 };

/* ------------------------------------------------------------------ matrices
 * Column-major, the same layout as THREE.Matrix4.elements, so a part's
 * matrix can be copied straight into an instance buffer. trs() is the
 * original's rotation order (Y, then X, then Z) with scale.
 */
const _mul = new Float32Array(16);
export const M = {
  id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  trs(out, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    const cx = Math.cos(rx), snx = Math.sin(rx), cy = Math.cos(ry), sny = Math.sin(ry), cz = Math.cos(rz), snz = Math.sin(rz);
    out[0] = (cy * cz + sny * snx * snz) * sx;
    out[1] = cx * snz * sx;
    out[2] = (-sny * cz + cy * snx * snz) * sx;
    out[3] = 0;
    out[4] = (-cy * snz + sny * snx * cz) * sy;
    out[5] = cx * cz * sy;
    out[6] = (sny * snz + cy * snx * cz) * sy;
    out[7] = 0;
    out[8] = sny * cx * sz;
    out[9] = -snx * sz;
    out[10] = cy * cx * sz;
    out[11] = 0;
    out[12] = x;
    out[13] = y;
    out[14] = z;
    out[15] = 1;
    return out;
  },
  /** out = a · b (out may alias a or b). */
  mul(out, a, b) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      for (let r = 0; r < 4; r++) _mul[c * 4 + r] = a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3;
    }
    out.set(_mul);
    return out;
  },
};

/* -------------------------------------------------------------------- shapes
 * Unit shapes as flat-shaded triangle lists: [px, py, pz, nx, ny, nz] per
 * vertex, face normals from the winding, exactly as the original built them.
 */
function faceNormal(a, b, c) {
  const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
  const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
  let nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
  const l = hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
function triP(out, a, b, c) {
  const n = faceNormal(a, b, c);
  for (const p of [a, b, c]) out.push(p[0], p[1], p[2], n[0], n[1], n[2]);
}
function quadP(out, a, b, c, d) {
  triP(out, a, b, c);
  triP(out, a, c, d);
}
function sphere(segs, rings) {
  const o = [];
  const p = (ii, jj) => {
    const t = (ii / segs) * TAU, v = (jj / rings) * Math.PI;
    return [Math.sin(v) * Math.sin(t), Math.cos(v), Math.sin(v) * Math.cos(t)];
  };
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) quadP(o, p(i, j), p(i, j + 1), p(i + 1, j + 1), p(i + 1, j));
  return o;
}
function cylinder(n = 12, top = 1, bottom = 1) {
  const o = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, b = ((i + 1) / n) * TAU;
    const p = [Math.sin(a) * bottom, -0.5, Math.cos(a) * bottom], q = [Math.sin(b) * bottom, -0.5, Math.cos(b) * bottom];
    const r = [Math.sin(b) * top, 0.5, Math.cos(b) * top], s = [Math.sin(a) * top, 0.5, Math.cos(a) * top];
    quadP(o, p, q, r, s);
    triP(o, [0, 0.5, 0], s, r);
    triP(o, [0, -0.5, 0], q, p);
  }
  return o;
}

export const SHAPES = {};
{
  const box = [];
  const p = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]];
  for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) quadP(box, ...f.map((i) => p[i]));
  SHAPES.box = box;
  SHAPES.ball = sphere(12, 8);
  SHAPES.rock = sphere(9, 6);
  SHAPES.cyl = cylinder();
  SHAPES.cone = cylinder(12, 0, 1);
  SHAPES.island = cylinder(32, 1, 0.72);
  SHAPES.disc = cylinder(20, 1, 1);
  const flag = [];
  triP(flag, [0, 0.5, 0], [0, -0.5, 0], [1.25, 0.13, 0]);
  SHAPES.flag = flag;
  const star = [];
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU, r = i % 2 ? 0.45 : 1;
    pts.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  for (let i = 0; i < 10; i++) {
    const j = (i + 1) % 10;
    triP(star, [0, 0, 0.23], [...pts[j], 0.12], [...pts[i], 0.12]);
    triP(star, [0, 0, -0.23], [...pts[i], -0.12], [...pts[j], -0.12]);
    quadP(star, [...pts[i], 0.12], [...pts[j], 0.12], [...pts[j], -0.12], [...pts[i], -0.12]);
  }
  SHAPES.star = star;
  for (const k in SHAPES) SHAPES[k] = new Float32Array(SHAPES[k]);
}

/* ------------------------------------------------------------ static builder
 * Grows typed arrays of position, normal, colour and surface tag; bake()
 * places a unit shape with the original's transform and normal rules.
 */
export class Builder {
  constructor(cap = 1 << 14) {
    this.n = 0;
    this.alloc(cap);
  }
  alloc(cap) {
    const grow = (old, k) => {
      const a = new Float32Array(cap * k);
      if (old) a.set(old.subarray(0, this.n * k));
      return a;
    };
    this.pos = grow(this.pos, 3);
    this.nor = grow(this.nor, 3);
    this.col = grow(this.col, 3);
    this.surf = grow(this.surf, 1);
    this.cap = cap;
  }
  vert(x, y, z, nx, ny, nz, col, type) {
    if (this.n >= this.cap) this.alloc(this.cap * 2);
    const i = this.n++, k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.nor[k] = nx; this.nor[k + 1] = ny; this.nor[k + 2] = nz;
    this.col[k] = col[0]; this.col[k + 1] = col[1]; this.col[k + 2] = col[2];
    this.surf[i] = type;
  }
  tri(a, b, c, col, type = 0) {
    const n = faceNormal(a, b, c);
    for (const p of [a, b, c]) this.vert(p[0], p[1], p[2], n[0], n[1], n[2], col, type);
  }
  quad(a, b, c, d, col, type = 0) {
    this.tri(a, b, c, col, type);
    this.tri(a, c, d, col, type);
  }
  bake(shape, x, y, z, sx, sy, sz, col, rx = 0, ry = 0, rz = 0, type = 0) {
    const m = M.trs(new Float32Array(16), x, y, z, rx, ry, rz, sx, sy, sz);
    const rot = M.trs(new Float32Array(16), 0, 0, 0, rx, ry, rz);
    const r = SHAPES[shape];
    for (let i = 0; i < r.length; i += 6) {
      const px = r[i], py = r[i + 1], pz = r[i + 2];
      const wx = m[0] * px + m[4] * py + m[8] * pz + m[12], wy = m[1] * px + m[5] * py + m[9] * pz + m[13], wz = m[2] * px + m[6] * py + m[10] * pz + m[14];
      const qx = r[i + 3] / sx, qy = r[i + 4] / sy, qz = r[i + 5] / sz;
      let nx = rot[0] * qx + rot[4] * qy + rot[8] * qz, ny = rot[1] * qx + rot[5] * qy + rot[9] * qz, nz = rot[2] * qx + rot[6] * qy + rot[10] * qz;
      const l = hypot(nx, ny, nz) || 1;
      this.vert(wx, wy, wz, nx / l, ny / l, nz / l, col, type);
    }
  }
  arrays() {
    const n = this.n;
    return { count: n, position: this.pos.slice(0, n * 3), normal: this.nor.slice(0, n * 3), color: this.col.slice(0, n * 3), surface: this.surf.slice(0, n) };
  }
}

/* --------------------------------------------------------------------- level
 * The mountain is a cut cone with a smooth spiral road carved into it.
 */
export const hill = { x: 8, z: -18, r: 25, top: 22, inner: 7.2 };
export const island = { x: -34, z: -13, y: 13.5, r: 5.2 };
export const cannon = { x: -34, z: 7, y: 0 };
export const PIP = { x: -15, z: 40 };
export const SIGNS = [{ x: -4, z: 36 }, { x: 4, z: 10 }, { x: -31, z: 7 }];
/** Rollo waits at the foot of the summit path (new: the summit race). */
export const ROLLO_BASE = { x: 12.6, z: 9.6 };
/** The blue coin switch by the creek (new) and the trail of blue coins it raises over the bridge. */
export const BLUE_SWITCH = { x: -20, z: 14.5 };
export const BLUE_COINS = [[-14, 13.6], [-6, 19], [-10, 25.5], [-14, 30.5], [-22, 30.8], [-30, 29.6]];

export function route(t) {
  const a = t * TAU, r = 25 - 17.8 * t;
  return { x: 8 + Math.sin(a) * r, z: -18 + Math.cos(a) * r, y: 22 * t, a, t };
}
export const track = [];
for (let i = 0; i <= 192; i++) track.push(route(i / 192));

export function trackInfo(x, z) {
  const dx = x - 8, dz = z + 18, r = hypot(dx, dz);
  let a = Math.atan2(dx, dz);
  if (a < 0) a += TAU;
  const t = a / TAU, rad = 25 - 17.8 * t;
  return { t, d: Math.abs(r - rad), r, a };
}

export function groundBase(x, z, visual = false) {
  const edge = (x / 55) ** 2 + ((z + 3) / 61) ** 2;
  if (edge > 1) return { h: -99, type: 0, road: false };
  let h = 0, type = 1, road = false;
  const dz = Math.abs(z - 22);
  if (x < 22 && dz < 5.3) {
    h = -2.6 * clamp((5.3 - dz) / 1.6, 0, 1);
    type = 3;
  }
  const q = trackInfo(x, z);
  if (q.r < 25.2) {
    h = 22 * clamp((25 - q.r) / 17.8, 0, 1);
    type = q.r < 7.2 ? 1 : 2;
    if (q.d < 2.65 && q.r > 6.65) {
      h = 22 * q.t;
      type = 3;
      road = true;
    } else if (q.d < 3.55 && q.r > 7.2) {
      const k = (q.d - 2.65) / 0.9;
      h = mix(22 * q.t, h, k);
    }
    if (q.r < 7.2) h = 22;
  }
  if (!visual && Math.abs(x + 8) < 4.0 && z > 11.8 && z < 33) {
    let by = 1.55;
    if (z > 29) by = (1.55 * (33 - z)) / 4;
    if (z < 16) by = (1.55 * (z - 11.8)) / 4.2;
    if (by > h) {
      h = by;
      type = 0;
      road = true;
    }
  }
  return { h, type, road, q };
}

/* ------------------------------------------------------------------ scenery
 * Builds the static hill in the original's order (the random stream depends
 * on it). Returns the merged world (casts and receives shadows), the far
 * backdrop of hills and clouds, the creek water, tree colliders and flags.
 */
export function buildScenery() {
  const world = new Builder(1 << 17);
  const backdrop = new Builder(1 << 15);
  const water = new Builder(16);
  const colliders = [];
  const checkpoints = [];

  // The meadow is a coarse grid. The mountain uses an edge-aligned radial mesh.
  for (let x = -55; x < 55; x += 1.5) {
    for (let z = -64; z < 58; z += 1.5) {
      const ps = [[x, z], [x, z + 1.5], [x + 1.5, z + 1.5], [x + 1.5, z]];
      const gs = ps.map((p) => groundBase(p[0], p[1], true));
      if (gs.some((g) => g.h < -90) || ps.some((p) => hypot(p[0] - 8, p[1] + 18) < 28)) continue;
      const g = groundBase(x + 0.75, z + 0.75, true);
      const base = g.type === 3 ? C.dirt : C.grass;
      const col = base.map((v) => v * (0.975 + rand() * 0.05));
      world.quad(...ps.map((p, i) => [p[0], gs[i].h, p[1]]), col, g.type);
    }
  }
  const mountainSection = (t) => {
    const a = t * TAU, r = 25 - 17.8 * t;
    const rs = [0, 7.2, Math.max(7.201, r - 3.55), Math.max(7.201, r - 2.65), r + 2.65, r + 3.55, Math.max(25, r + 3.55), 30];
    return rs.map((rr, index) => {
      const x = 8 + Math.sin(a) * rr, z = -18 + Math.cos(a) * rr, g = groundBase(x, z, true);
      return [x, index < 2 ? 22 : g.h + (rr > 25.2 ? 0.012 : 0), z];
    });
  };
  for (let i = 0; i < 192; i++) {
    const a = mountainSection(i / 192), b = mountainSection((i + 1) / 192);
    for (let j = 0; j < a.length - 1; j++) {
      const type = j === 0 || j === 6 ? 1 : j === 3 ? 3 : 2;
      const cc = type === 1 ? C.grass : type === 3 ? C.dirt : C.cliff;
      world.quad(a[j], a[j + 1], b[j + 1], b[j], cc, type);
    }
  }
  // Fill the vertical end face where the road completes its turn.
  const seamR = [0, 7.2, 9.85, 10.75, 21.45, 22.35, 25, 27.65, 28.55, 30];
  const hAt = (r, a) => groundBase(8 + Math.sin(a) * r, -18 + Math.cos(a) * r, true).h;
  for (let i = 0; i < seamR.length - 1; i++) {
    const r0 = seamR[i], r1 = seamR[i + 1];
    world.quad([8, hAt(r0, 0.00001), -18 + r0], [8, hAt(r0, TAU - 0.00001), -18 + r0], [8, hAt(r1, TAU - 0.00001), -18 + r1], [8, hAt(r1, 0.00001), -18 + r1], C.cliff, 2);
  }
  // The outer cliff and its lower green shelf.
  for (let i = 0; i < 128; i++) {
    const a = (i / 128) * TAU, b = ((i + 1) / 128) * TAU;
    const pa = [55 * Math.sin(a), 0, -3 + 61 * Math.cos(a)], pb = [55 * Math.sin(b), 0, -3 + 61 * Math.cos(b)];
    pa[1] = Math.max(-2.6, groundBase(pa[0] * 0.998, (pa[2] + 3) * 0.998 - 3).h);
    pb[1] = Math.max(-2.6, groundBase(pb[0] * 0.998, (pb[2] + 3) * 0.998 - 3).h);
    world.quad(pa, pb, [pb[0] * 0.91, -15, (pb[2] + 3) * 0.91 - 3], [pa[0] * 0.91, -15, (pa[2] + 3) * 0.91 - 3], C.cliff, 2);
  }
  // Creek water, drawn see-through after the solid world.
  water.quad([-51, -0.62, 18], [-51, -0.62, 26.3], [21, -0.62, 26.3], [21, -0.62, 18], color('#52b8c5'), 0);
  // A bright bridge with individual planks and low rope rails.
  for (let z = 16; z < 29; z += 0.62) world.bake('box', -8, 1.39, z, 7.65, 0.35, 0.6, rand() > 0.5 ? color('#b98650') : color('#c4945c'));
  for (let z = 29.15; z < 33; z += 0.48) world.bake('box', -8, (1.55 * (33 - z)) / 4 - 0.09, z, 7.65, 0.2, 0.5, color('#bd8b54'), Math.atan(1.55 / 4));
  for (let z = 12; z < 16; z += 0.48) world.bake('box', -8, (1.55 * (z - 11.8)) / 4.2 - 0.09, z, 7.65, 0.2, 0.5, color('#bd8b54'), -Math.atan(1.55 / 4.2));
  for (const x of [-11.65, -4.35]) {
    world.bake('box', x, 0.8, 22.4, 0.3, 0.5, 13.5, C.wood);
    for (const z of [16.3, 20.4, 24.5, 28.6]) {
      world.bake('cyl', x, 2.1, z, 0.12, 2.0, 0.12, C.wood);
      world.bake('ball', x, 3.12, z, 0.19, 0.19, 0.19, C.cream);
    }
    world.bake('box', x, 2.75, 22.4, 0.075, 0.075, 12.4, C.cream);
  }
  // Dirt trails on the meadow, stepping stones and a red-coin shrine.
  for (let z = 32; z < 46; z += 1) world.bake('disc', -8 + Math.sin(z * 0.2) * 0.3, 0.018, z, 2.3, 0.025, 1.35, C.dirt, 0, 0, 0, 3);
  for (let t = 0; t <= 1; t += 0.09) {
    const x = mix(-8, 8, t), z = mix(13, 7, t);
    world.bake('disc', x, 0.026, z, 2, 0.03, 1.9, C.dirt, 0, 0, 0, 3);
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU;
    world.bake('rock', 20 + Math.sin(a) * 3.8, 0.23, 34 + Math.cos(a) * 3.8, 0.6, 0.4, 0.55, color('#d17861'));
  }
  world.bake('disc', 20, 0.045, 34, 3.1, 0.09, 3.1, color('#c1c574'));
  // Mountain guard posts and a summit stone ring.
  for (let i = 8; i < 181; i += 7) {
    const p = route(i / 192), a = p.a, x = p.x + Math.sin(a) * 2.55, z = p.z + Math.cos(a) * 2.55;
    world.bake('cyl', x, p.y + 0.42, z, 0.095, 1.1, 0.095, C.wood);
    world.bake('ball', x, p.y + 1, z, 0.15, 0.15, 0.15, C.cream);
  }
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    world.bake('rock', 8 + Math.sin(a) * 6.75, 22.05, -18 + Math.cos(a) * 6.75, 0.6, 0.24, 0.58, color('#d1bd80'));
  }
  const tree = (x, z, s = 1, y = null) => {
    if (y === null) y = groundBase(x, z).h;
    if (y < -0.1) return;
    world.bake('cyl', x, y + 1.3 * s, z, 0.42 * s, 2.8 * s, 0.42 * s, C.trunk);
    world.bake('ball', x, y + 3.6 * s, z, 1.9 * s, 2.05 * s, 1.8 * s, C.leaf);
    world.bake('ball', x - 0.7 * s, y + 4.2 * s, z + 0.15 * s, 1.35 * s, 1.5 * s, 1.4 * s, color('#66ae49'));
    world.bake('ball', x + 0.8 * s, y + 3.25 * s, z - 0.35 * s, 1.3 * s, 1.45 * s, 1.3 * s, color('#3e9648'));
    colliders.push({ x, z, r: 0.43 * s, y, top: y + 2.6 * s });
  };
  for (const p of [[-22, 43, 1.2], [-29, 32, 1], [-1, 46, 0.9], [13, 42, 1.2], [31, 32, 1.1], [36, 19, 1.3], [23, 10, 1.0], [-24, 10, 1.1], [-42, 1, 1.1], [-37, -29, 1.2], [-17, -39, 1], [-2, -49, 1.5], [26, -47, 1.1], [39, -31, 1.3], [42, -8, 1], [47, 10, 0.9], [-44, 34, 0.9], [-37, 46, 1.2]]) tree(...p);
  for (let i = 0; i < 90; i++) {
    const x = range(-47, 47), z = range(-53, 49), g = groundBase(x, z);
    if (g.h !== 0 || (Math.abs(x + 8) < 4 && z > 10) || hypot(x - 20, z - 34) < 5) continue;
    const cc = [color('#fff0ad'), color('#f6e5e0'), color('#efad9b')][i % 3];
    for (let j = 0; j < 3; j++) {
      const xx = x + range(-0.7, 0.7), zz = z + range(-0.7, 0.7);
      world.bake('cyl', xx, 0.16, zz, 0.025, 0.32, 0.025, C.leaf);
      world.bake('ball', xx, 0.34, zz, 0.15, 0.07, 0.15, cc);
    }
  }
  for (let i = 0; i < 25; i++) {
    const x = range(-47, 47), z = range(-50, 46), g = groundBase(x, z);
    if (g.h !== 0 || Math.abs(x + 8) < 5) continue;
    const s = range(0.3, 0.75);
    world.bake('rock', x, s * 0.35, z, s, s * 0.55, s * 0.8, color('#bdc19b'));
  }
  // Floating island and spring-coloured landing target.
  world.bake('island', island.x, island.y - 2.5, island.z, 5.2, 5, 5.2, C.cliff, 0, 0, 0, 2);
  world.bake('disc', island.x, island.y - 0.03, island.z, 5.22, 0.17, 5.22, C.grass, 0, 0, 0, 1);
  tree(-36, -14, 0.75, island.y);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    world.bake('box', island.x + Math.sin(a) * 1.3, island.y + 0.06, island.z + Math.cos(a) * 1.3, 0.38, 0.07, 0.38, C.cream, 0, a, 0);
  }
  // Distant hills and clouds set the soft, sunny horizon.
  for (let i = 0; i < 23; i++) {
    const a = (i / 23) * TAU, rr = range(109, 147), h = range(17, 43);
    const sx = range(13, 22), sz = range(15, 23);
    backdrop.bake('ball', Math.sin(a) * rr, -9, Math.cos(a) * rr, sx, h, sz, i % 2 ? color('#77bda5') : color('#91cbb5'));
  }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU, rr = range(80, 130), x = Math.sin(a) * rr, z = Math.cos(a) * rr, y = range(35, 56), s = range(2.3, 4.2);
    backdrop.bake('ball', x, y, z, s * 1.8, s * 0.75, s, C.white);
    backdrop.bake('ball', x - s, y + 0.6 * s, z, s, s, s, C.white);
    backdrop.bake('ball', x + s, y + 0.3 * s, z, s, s * 0.9, s * 0.8, C.white);
  }
  // Signs, checkpoints and the cannon. All labels are geometry or HTML.
  for (const s of SIGNS) {
    const y = groundBase(s.x, s.z).h, x = s.x, z = s.z;
    world.bake('cyl', x, y + 0.8, z, 0.1, 1.6, 0.1, C.wood);
    world.bake('box', x, y + 1.65, z, 1.5, 0.85, 0.15, color('#d6a360'));
    world.bake('box', x, y + 1.65, z + 0.095, 0.55, 0.09, 0.04, C.cream);
    world.bake('box', x + 0.24, y + 1.8, z + 0.1, 0.09, 0.35, 0.04, C.cream, 0, 0, -0.65);
  }
  for (const [x, z, y] of [[-13, 37, 0], [10, 9, 0], [10, -12, 22]]) {
    checkpoints.push({ x, z, y, active: false });
    world.bake('cyl', x, y + 1.9, z, 0.09, 3.8, 0.09, C.cream);
    world.bake('ball', x, y + 3.9, z, 0.18, 0.18, 0.18, C.gold);
  }
  world.bake('disc', -34, 0.22, 7, 2.2, 0.45, 2.2, color('#adb7a0'));
  world.bake('box', -34, 0.7, 7, 2.2, 0.8, 2, C.wood);
  world.bake('cyl', -34, 1.8, 6.7, 0.85, 2.9, 0.85, C.navy, -0.98, 0);
  world.bake('cyl', -34, 2.94, 5.92, 0.71, 0.07, 0.71, C.black, -0.98, 0);
  for (const x of [-35.25, -32.75]) world.bake('cyl', x, 0.8, 7, 0.68, 0.28, 0.68, color('#556775'), 0, 0, Math.PI / 2);

  return { world: world.arrays(), backdrop: backdrop.arrays(), water: water.arrays(), colliders, checkpoints };
}
