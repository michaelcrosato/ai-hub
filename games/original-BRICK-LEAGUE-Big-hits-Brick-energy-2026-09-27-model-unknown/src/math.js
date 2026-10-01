// Small vector and field helpers. Units: 1 unit ≈ 4.5 ft; y is up, home plate at the origin, center field toward -z.

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/** Ground distance (x/z only). */
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const length = (a) => Math.hypot(a.x, a.y, a.z);
export const normalize = (a) => {
  const l = length(a) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};

/** Move p toward q on the ground by d; true once it arrives. */
export function moveToward(p, q, d) {
  const l = distance(p, q);
  if (l <= d) {
    p.x = q.x;
    p.z = q.z;
    return true;
  }
  p.x += ((q.x - p.x) / l) * d;
  p.z += ((q.z - p.z) / l) * d;
  return false;
}

/** mulberry32: a small seeded generator, so rosters and replays are reproducible. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BASES = [v3(0, 0, 0), v3(18, 0, -18), v3(0, 0, -36), v3(-18, 0, -18), v3(0, 0, 0)];
export const WALL = 74;
export const GRAVITY = 18;
export const FAIR = (p) => p.z < 0 && Math.abs(p.x) <= -p.z + 0.3;
/** Where a ball launched from p with velocity v first reaches the ground. */
export function landing(p, v) {
  const t = (v.y + Math.sqrt(v.y * v.y + 2 * GRAVITY * Math.max(0, p.y))) / GRAVITY;
  return v3(p.x + v.x * t, 0, p.z + v.z * t);
}
/** Feet, as the broadcast graphics show them. */
export const feet = (units) => Math.round(units * 4.5);
