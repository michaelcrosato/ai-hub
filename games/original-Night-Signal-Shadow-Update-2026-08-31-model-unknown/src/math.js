// Small vector helpers. Vectors are plain [x, y, z] arrays.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const flatDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const normalize = (a) => scale(a, 1 / (length(a) || 1));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const radians = (deg) => (deg * Math.PI) / 180;
export const degrees = (rad) => (rad * 180) / Math.PI;
export const finiteV3 = (x) => Array.isArray(x) && x.length === 3 && x.every(Number.isFinite);

/** Rotate p about X, then Y, then Z (angles in degrees). */
export function rotateXYZ(p, angles) {
  const x = radians(angles[0]);
  const y = radians(angles[1]);
  const z = radians(angles[2]);
  let a = p[0];
  const b = p[1] * Math.cos(x) - p[2] * Math.sin(x);
  let c = p[1] * Math.sin(x) + p[2] * Math.cos(x);
  [a, c] = [a * Math.cos(y) + c * Math.sin(y), -a * Math.sin(y) + c * Math.cos(y)];
  return [a * Math.cos(z) - b * Math.sin(z), a * Math.sin(z) + b * Math.cos(z), c];
}
