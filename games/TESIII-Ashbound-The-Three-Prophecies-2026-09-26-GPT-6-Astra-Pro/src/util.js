export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function random(seed) {
  let a = typeof seed === 'string' ? hash(seed) : seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const escapeHTML = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
/** Shortest-path quaternion interpolation for fixed-step debris rendering. */
export function slerpQuaternion(a, b, t) {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  if (dot < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    dot = -dot;
  }
  let u = 1 - t,
    v = t;
  if (dot < 0.9995) {
    const angle = Math.acos(clamp(dot, -1, 1)),
      den = Math.sin(angle);
    u = Math.sin((1 - t) * angle) / den;
    v = Math.sin(t * angle) / den;
  }
  const q = { x: a.x * u + b.x * v, y: a.y * u + b.y * v, z: a.z * u + b.z * v, w: a.w * u + b.w * v };
  const length = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / length, y: q.y / length, z: q.z / length, w: q.w / length };
}
