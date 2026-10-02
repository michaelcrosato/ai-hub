// Column-major matrices. Coordinates: right-handed, Y up, camera looks down -Z.
export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map((v) => v * s);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a) => Math.hypot(...a);
export const norm = (a) => mul(a, 1 / (length(a) || 1));
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
export function mm(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
export function compose(p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const [x, y, z] = r.map((v) => (v * Math.PI) / 180),
    a = Math.cos(x),
    b = Math.sin(x),
    c = Math.cos(y),
    d = Math.sin(y),
    e = Math.cos(z),
    f = Math.sin(z);
  return new Float32Array([
    c * e * s[0],
    (a * f + b * e * d) * s[0],
    (b * f - a * e * d) * s[0],
    0,
    -c * f * s[1],
    (a * e - b * f * d) * s[1],
    (b * e + a * f * d) * s[1],
    0,
    d * s[2],
    -b * c * s[2],
    a * c * s[2],
    0,
    ...p,
    1,
  ]);
}
export function perspective(fov, aspect, near = 0.05, far = 600) {
  const f = 1 / Math.tan((fov * Math.PI) / 360),
    nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
export function ortho(l, r, b, t, n, f) {
  return new Float32Array([2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, -2 / (f - n), 0, -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
}
export function lookAt(eye, target, up = [0, 1, 0]) {
  const z = norm(sub(eye, target)),
    x = norm(cross(up, z)),
    y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
export function point(m, p) {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}
export function cameraDirection(yaw, pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}
export function cameraRay(camera, nx, ny, aspect) {
  const f = norm(sub(camera.target, camera.position)),
    right = norm(cross(f, [0, 1, 0])),
    up = cross(right, f),
    t = Math.tan((camera.fov * Math.PI) / 360);
  return norm(add(f, add(mul(right, nx * t * aspect), mul(up, ny * t))));
}
export function hex(s) {
  return [parseInt(s.slice(1, 3), 16) / 255, parseInt(s.slice(3, 5), 16) / 255, parseInt(s.slice(5, 7), 16) / 255];
}
// Ray versus axis-aligned box. Return null for a miss, including a parallel ray outside a slab.
export function rayBox(origin, dir, min, max, maxDistance = Infinity) {
  let near = 0,
    far = maxDistance;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(dir[i]) < 1e-9) {
      if (origin[i] < min[i] || origin[i] > max[i]) return null;
      continue;
    }
    let a = (min[i] - origin[i]) / dir[i],
      b = (max[i] - origin[i]) / dir[i];
    if (a > b) [a, b] = [b, a];
    near = Math.max(near, a);
    far = Math.min(far, b);
    if (near > far) return null;
  }
  return near;
}
export function bounds(matrix, size = [1, 1, 1]) {
  const ps = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) ps.push(point(matrix, [x * size[0], y * size[1], z * size[2]]));
  return { min: [0, 1, 2].map((i) => Math.min(...ps.map((p) => p[i]))), max: [0, 1, 2].map((i) => Math.max(...ps.map((p) => p[i]))) };
}
