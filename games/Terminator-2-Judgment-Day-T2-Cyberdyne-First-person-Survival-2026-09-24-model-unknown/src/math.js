// Small vector helpers carried over from the Strata engine.
// Coordinates: right-handed, Y up, the camera looks down -Z. Rotations are XYZ Euler in degrees.
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => mul(a, 1 / (length(a) || 1));
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Column-major 4x4 from position, XYZ Euler rotation in degrees and scale, written into `out`. */
export function composeInto(out, p, r, s, o = 0) {
  const x = r[0] * Math.PI / 180, y = r[1] * Math.PI / 180, z = r[2] * Math.PI / 180;
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  out[o] = c * e * s[0]; out[o + 1] = (a * f + b * e * d) * s[0]; out[o + 2] = (b * f - a * e * d) * s[0]; out[o + 3] = 0;
  out[o + 4] = -c * f * s[1]; out[o + 5] = (a * e - b * f * d) * s[1]; out[o + 6] = (b * e + a * f * d) * s[1]; out[o + 7] = 0;
  out[o + 8] = d * s[2]; out[o + 9] = -b * c * s[2]; out[o + 10] = a * c * s[2]; out[o + 11] = 0;
  out[o + 12] = p[0]; out[o + 13] = p[1]; out[o + 14] = p[2]; out[o + 15] = 1;
  return out;
}
export const compose = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => composeInto(new Float32Array(16), p, r, s);

/** out[o..o+15] = a * b (column-major). `out` must not alias `a` or `b`. */
export function multiplyInto(out, o, a, b) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[o + c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[o + c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[o + c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[o + c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}
export const mm = (a, b) => multiplyInto(new Float32Array(16), 0, a, b);

export function point(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
export function cameraDirection(yaw, pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}

const rgbCache = new Map();
/** '#rrggbb' to [r, g, b] in 0..1, cached (the renderer calls this for every instance, every frame). */
export function hex(s) {
  let c = rgbCache.get(s);
  if (!c) {
    c = [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
    rgbCache.set(s, c);
  }
  return c;
}

/** Ray versus axis-aligned box. Null for a miss, including a parallel ray outside a slab. */
export function rayBox(origin, dir, min, max, maxDistance = Infinity) {
  let near = 0, far = maxDistance;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-9) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
      continue;
    }
    let a = (min[i] - origin[i]) / dir[i], b = (max[i] - origin[i]) / dir[i];
    if (a > b) { const t = a; a = b; b = t; }
    if (a > near) near = a;
    if (b < far) far = b;
    if (near > far) return null;
  }
  return near;
}

/** World-space AABB of a unit box of `size` transformed by `matrix`. */
export function bounds(matrix, size = [1, 1, 1]) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
    const px = x * size[0], py = y * size[1], pz = z * size[2];
    for (let i = 0; i < 3; i++) {
      const v = matrix[i] * px + matrix[4 + i] * py + matrix[8 + i] * pz + matrix[12 + i];
      if (v < min[i]) min[i] = v;
      if (v > max[i]) max[i] = v;
    }
  }
  return { min, max };
}

export const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export const moveToward = (current, target, amount) => current + clamp(target - current, -amount, amount);
export const angleWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Deterministic decoration. Do not use Math.random for level generation. */
export function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
