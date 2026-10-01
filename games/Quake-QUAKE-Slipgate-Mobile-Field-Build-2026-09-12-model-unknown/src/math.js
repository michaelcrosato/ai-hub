// Small vector helpers on plain [x, y, z] arrays, shared by the game, the world builder and the BSP reader.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const length = (v) => Math.hypot(v[0], v[1], v[2]);
export const normalize = (v) => {
  const n = length(v) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
};
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Seeded generator (mulberry32), so the arena and its silhouettes come out the same every time. */
export function random(seed = 1) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Column-major transform for position, YXZ Euler rotation and scale (the same order three.js calls 'YXZ'). */
export function compose(pos = [0, 0, 0], rot = [0, 0, 0], s = [1, 1, 1]) {
  const [x, y, z] = rot;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return new Float32Array([
    (cy * cz + sy * sx * sz) * s[0], cx * sz * s[0], (-sy * cz + cy * sx * sz) * s[0], 0,
    (-cy * sz + sy * sx * cz) * s[1], cx * cz * s[1], (sy * sz + cy * sx * cz) * s[1], 0,
    sy * cx * s[2], -sx * s[2], cy * cx * s[2], 0,
    pos[0], pos[1], pos[2], 1,
  ]);
}

export function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

/** Distance along a ray to an axis-aligned box, or null when it misses within `max`. */
export function rayBox(origin, dir, box, max = Infinity) {
  let near = 0;
  let far = max;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-8) {
      if (origin[i] < box.min[i] || origin[i] > box.max[i]) return null;
      continue;
    }
    let a = (box.min[i] - origin[i]) / dir[i];
    let b = (box.max[i] - origin[i]) / dir[i];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return null;
  }
  return near;
}

/** Distance along a (unit) ray to a sphere, or null when it misses or starts inside. */
export function raySphere(o, d, c, r) {
  const vx = o[0] - c[0], vy = o[1] - c[1], vz = o[2] - c[2];
  const b = vx * d[0] + vy * d[1] + vz * d[2];
  const det = b * b - (vx * vx + vy * vy + vz * vz) + r * r;
  if (det < 0) return null;
  const t = -b - Math.sqrt(det);
  return t >= 0 ? t : null;
}
