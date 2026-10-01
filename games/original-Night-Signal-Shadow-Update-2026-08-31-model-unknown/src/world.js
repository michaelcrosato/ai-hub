// The world is made of boxes: { p: centre, s: size, a: rotation in degrees (X, then Y, then Z), c: [r, g, b, emissive] }.
// The same boxes drive collision, sight lines and rendering.

import { add, clamp, cross, distance, normalize, rotateXYZ, scale, sub } from './math.js';

/** Linear colours; the fourth value is self-illumination (1 or more glows and blooms). */
export const PALETTE = {
  wall0: [0.31, 0.38, 0.36, 0], wall1: [0.42, 0.37, 0.31, 0], wall2: [0.28, 0.35, 0.39, 0], wall3: [0.38, 0.33, 0.35, 0],
  concrete: [0.37, 0.4, 0.37, 0], trim: [0.26, 0.3, 0.29, 0], floor: [0.25, 0.28, 0.27, 0], metal: [0.18, 0.23, 0.22, 0],
  wood: [0.27, 0.17, 0.095, 0], glass: [0.13, 0.25, 0.28, 0], emissive: [1, 0.73, 0.34, 2], red: [0.65, 0.075, 0.035, 0.15],
  road: [0.08, 0.115, 0.12, 0], paint: [0.54, 0.55, 0.42, 0], carpet: [0.15, 0.22, 0.19, 0], locker: [0.16, 0.25, 0.25, 0],
  black: [0.045, 0.06, 0.065, 0], fuse: [1, 0.57, 0.12, 2.8], cool: [0.36, 0.7, 0.73, 1.3],
  tape: [0.12, 0.13, 0.13, 0], signal: [0.55, 0.9, 1, 2.2],
};

export function instance(p, s, material = 'concrete', angles = [0, 0, 0]) {
  return { p: [...p], s: [...s], a: [...angles], c: Array.isArray(material) ? material : PALETTE[material] || PALETTE.concrete };
}

const LETTERS = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'], B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01111'], X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'], 2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'], 4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '10000', '11110', '00001', '00001', '11110'], 6: ['01111', '10000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
};

/** A lit sign made of small glowing squares on a dark plate. */
export function signBoxes(text, p, unit = 0.08, color = 'cool') {
  const out = [];
  const w = (text.length * 6 - 1) * unit;
  out.push(instance([p[0], p[1], p[2] + 0.055], [w + 0.3, 7 * unit + 0.22, 0.08], 'black'));
  for (let k = 0; k < text.length; k++) {
    const rows = LETTERS[text[k]];
    if (!rows) continue;
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++)
        if (rows[y][x] === '1') out.push(instance([p[0] + w / 2 - (k * 6 + x + 0.5) * unit, p[1] + (3 - y) * unit, p[2]], [unit * 0.78, unit * 0.78, 0.024], color));
  }
  return out;
}

/** Distance along a ray to a (possibly rotated) box, or Infinity. */
export function rayBox(origin, dir, box, maxDistance) {
  const inv = [-box.a[0], -box.a[1], -box.a[2]];
  const o = rotateXYZ(sub(origin, box.p), inv);
  const d = rotateXYZ(dir, inv);
  let low = 0;
  let high = maxDistance;
  for (let i = 0; i < 3; i++) {
    const h = box.s[i] / 2;
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < -h || o[i] > h) return Infinity;
      continue;
    }
    let a = (-h - o[i]) / d[i];
    let b = (h - o[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    low = Math.max(low, a);
    high = Math.min(high, b);
    if (low > high) return Infinity;
  }
  return low;
}

export function overlapCircle(pos, r, height, b) {
  if (pos[1] + height <= b.p[1] - b.s[1] / 2 + 0.01 || pos[1] >= b.p[1] + b.s[1] / 2 - 0.08) return false;
  const q = rotateXYZ(sub(pos, b.p), [0, -b.a[1], 0]);
  const dx = q[0] - clamp(q[0], -b.s[0] / 2, b.s[0] / 2);
  const dz = q[2] - clamp(q[2], -b.s[2] / 2, b.s[2] / 2);
  return dx * dx + dz * dz < r * r - 0.00001;
}

/** Push a standing cylinder (pos at the feet) out of a box, in place. */
export function pushFromBox(pos, r, height, b) {
  if (pos[1] + height <= b.p[1] - b.s[1] / 2 + 0.015 || pos[1] >= b.p[1] + b.s[1] / 2 - 0.09) return;
  const q = rotateXYZ(sub(pos, b.p), [0, -b.a[1], 0]);
  const hx = b.s[0] / 2;
  const hz = b.s[2] / 2;
  let dx = q[0] - clamp(q[0], -hx, hx);
  let dz = q[2] - clamp(q[2], -hz, hz);
  let len = Math.hypot(dx, dz);
  if (len >= r) return;
  if (len < 1e-7) {
    const a = hx - Math.abs(q[0]);
    const z = hz - Math.abs(q[2]);
    if (a < z) {
      dx = q[0] < 0 ? -1 : 1;
      dz = 0;
      len = 1;
      q[0] = (hx + r) * dx;
    } else {
      dx = 0;
      dz = q[2] < 0 ? -1 : 1;
      len = 1;
      q[2] = (hz + r) * dz;
    }
  } else {
    q[0] += (dx / len) * (r - len + 0.002);
    q[2] += (dz / len) * (r - len + 0.002);
  }
  const moved = rotateXYZ(q, [0, b.a[1], 0]);
  pos[0] = b.p[0] + moved[0];
  pos[2] = b.p[2] + moved[2];
}

// Shared light rules. The beam angle is the full cone angle, not the camera field of view.
export const LIGHTING = Object.freeze({ moon: normalize([-0.43, 0.75, -0.5]), flashRange: 40 });

export function flashlightState(camera, settings) {
  const forward = normalize(camera.forward);
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const origin = camera.flashOrigin || add(camera.eye, add(scale(right, 0.24), add(scale(up, -0.18), scale(forward, 0.17))));
  const direction = normalize(sub(add(camera.eye, scale(forward, 8)), origin));
  const degrees = clamp(Number(settings.beamAngle) || 30, 18, 50);
  return { origin, direction, degrees, range: LIGHTING.flashRange };
}

/**
 * The `count` lamps that get a real light this frame: the closest, with lamps
 * below the eye pushed back (a ceiling light downstairs barely reaches you).
 * Writes into `out` (reused every frame) and returns it.
 */
export function selectLights(lights, eye, count, out) {
  out.length = 0;
  const score = (l) => distance(l.position, eye) + (l.position[1] < eye[1] - 0.5 ? 20 : 0);
  for (const l of lights) {
    const s = score(l);
    l._score = s;
    let i = out.length;
    while (i > 0 && (out[i - 1]._score > s || (out[i - 1]._score === s && String(out[i - 1].id) > String(l.id)))) i--;
    if (i >= count) continue;
    out.splice(i, 0, l);
    if (out.length > count) out.length = count;
  }
  return out;
}

/** Rigid boxes for the player's own shadow. The stance follows the collision body's height. */
export function playerShadowParts(body, out) {
  out.length = 0;
  if (!body) return out;
  const base = body.position;
  const h = clamp(body.height || 1.67, 0.9, 1.8);
  const t = clamp((1.67 - h) / 0.65, 0, 1);
  const angles = [0, -((body.yaw || 0) * 180) / Math.PI, 0];
  const part = (p, size) => out.push({ p: add(base, rotateXYZ(p, angles)), s: size, a: angles });
  part([0, h + 0.015, 0], [0.26, 0.3, 0.25]);
  part([0, h - 0.4, 0.025 + t * 0.07], [0.44, 0.61 - t * 0.07, 0.28]);
  part([0, 0.77 - t * 0.35, 0.04], [0.38, 0.22, 0.29]);
  for (const side of [-1, 1]) {
    const leg = 0.69 - t * 0.34;
    part([side * 0.115, 0.065 + leg / 2, 0.045 + t * 0.05], [0.145, leg, 0.18]);
    part([side * 0.115, 0.055, -0.035], [0.16, 0.11, 0.29]);
    part([side * 0.305, h - 0.52, 0.015], [0.13, 0.61 - t * 0.08, 0.15]);
  }
  return out;
}

