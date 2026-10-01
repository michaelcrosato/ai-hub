/** Engine-independent geometry. Metres, Y-up. Planar positions are [east, south]. */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const scale = (a, s) => [a[0] * s, a[1] * s];
export const normalize = (a) => { const n = Math.hypot(a[0], a[1]) || 1; return [a[0] / n, a[1] / n]; };
export const forward = (yaw) => [Math.sin(yaw), -Math.cos(yaw)];
export const right = (yaw) => [Math.cos(yaw), Math.sin(yaw)];
export const heading = (d) => Math.atan2(d[0], -d[1]);

export function rng(seed = 42) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

export class Path {
  constructor(points) {
    if (!Array.isArray(points) || points.length < 2) throw new Error('A route requires at least two points.');
    this.points = points.filter((p, i) => !i || distance(p, points[i - 1]) > 0.02);
    this.cumulative = [0];
    for (let i = 1; i < this.points.length; i++) this.cumulative.push(this.cumulative.at(-1) + distance(this.points[i], this.points[i - 1]));
    this.length = this.cumulative.at(-1);
  }
  sample(s, offset = 0) {
    s = clamp(s, 0, this.length); let lo = 0, hi = this.points.length - 2;
    while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (this.cumulative[m] <= s) lo = m; else hi = m - 1; }
    const a = this.points[lo], b = this.points[lo + 1], length = this.cumulative[lo + 1] - this.cumulative[lo];
    const t = length ? (s - this.cumulative[lo]) / length : 0, dir = normalize(sub(b, a)), yaw = heading(dir), r = right(yaw);
    return { point: [lerp(a[0], b[0], t) + r[0] * offset, lerp(a[1], b[1], t) + r[1] * offset], dir, yaw, index: lo, s };
  }
  /**
   * Nearest point on the path. Traffic calls this hundreds of times per step, so the segment loop allocates
   * nothing; only the result is built. Same answer as projecting segment by segment.
   */
  project(p, hint = null, window = Infinity) {
    const pts = this.points, cum = this.cumulative, px = p[0], pz = p[1];
    let bi = -1, bt = 0, bd2 = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      if (hint !== null && (cum[i + 1] < hint - window || cum[i] > hint + window)) continue;
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], len2 = dx * dx + dz * dz;
      const t = len2 ? clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / len2, 0, 1) : 0;
      const ex = a[0] + t * dx - px, ez = a[1] + t * dz - pz, d2 = ex * ex + ez * ez;
      if (d2 < bd2) { bd2 = d2; bi = i; bt = t; }
    }
    if (bi < 0) {
      // Nothing inside the window: search the whole path. A degenerate one-point path has no segment at all.
      if (hint !== null) return this.project(p);
      return { point: pts[0], t: 0, distance: Infinity, dir: [0, -1], index: 0, s: 0, yaw: heading([0, -1]), lateral: 0 };
    }
    const a = pts[bi], b = pts[bi + 1], dx = b[0] - a[0], dz = b[1] - a[1];
    const point = [a[0] + bt * dx, a[1] + bt * dz], dir = normalize([dx, dz]), yaw = heading(dir);
    return { point, t: bt, distance: Math.sqrt(bd2), dir, index: bi, s: lerp(cum[bi], cum[bi + 1], bt), yaw, lateral: dot(sub(p, point), right(yaw)) };
  }
}

export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function boxCorners(p, yaw, halfWidth, halfLength) {
  const f = forward(yaw), r = right(yaw);
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([x, z]) => [p[0] + r[0] * x * halfWidth + f[0] * z * halfLength, p[1] + r[1] * x * halfWidth + f[1] * z * halfLength]);
}
/** SAT for convex polygons. Building concavities use polygonHit below. */
export function polygonsOverlap(a, b) {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const p0 = poly[i], p1 = poly[(i + 1) % poly.length], nx = -(p1[1] - p0[1]), nz = p1[0] - p0[0];
    let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
    for (const p of a) { const d = p[0] * nx + p[1] * nz; if (d < minA) minA = d; if (d > maxA) maxA = d; }
    for (const p of b) { const d = p[0] * nx + p[1] * nz; if (d < minB) minB = d; if (d > maxB) maxB = d; }
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}
export function segmentsIntersect(a, b, c, d) {
  const cross = (u, v) => u[0] * v[1] - u[1] * v[0], r = sub(b, a), s = sub(d, c), den = cross(r, s);
  if (Math.abs(den) < 1e-9) return false;
  const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
export function polygonHit(a, b, holes = []) {
  if (a.some((p) => pointInPolygon(p, b) && !holes.some((h) => pointInPolygon(p, h)))) return true;
  if (b.some((p) => pointInPolygon(p, a))) return true;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  return false;
}
export class SpatialHash {
  constructor(cell = 70) { this.cell = cell; this.grid = new Map(); }
  key(x, z) { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }
  insert(item, bounds) {
    for (let x = Math.floor(bounds[0] / this.cell); x <= Math.floor(bounds[2] / this.cell); x++)
      for (let z = Math.floor(bounds[1] / this.cell); z <= Math.floor(bounds[3] / this.cell); z++) {
        const key = `${x},${z}`; if (!this.grid.has(key)) this.grid.set(key, []); this.grid.get(key).push(item);
      }
  }
  query(p, radius = 12) {
    const out = new Set();
    for (let x = p[0] - radius; x <= p[0] + radius + this.cell; x += this.cell)
      for (let z = p[1] - radius; z <= p[1] + radius + this.cell; z += this.cell)
        for (const item of this.grid.get(this.key(x, z)) || []) out.add(item);
    return [...out];
  }
}
export const boundsOf = (poly) => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const p of poly) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
  return [a, b, c, d];
};
export function formatTime(seconds) {
  const s = Math.floor(Math.max(0, seconds));
  return `${String(Math.floor(s / 3600) % 24).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
