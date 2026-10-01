// Small shared helpers: maths, the seeded random stream, colours and saves.
// The random stream is shared on purpose: the city is generated from it first (in the
// original order, so the skyline is the same as ever) and gameplay keeps drawing from it.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

let seed = 90210;
export const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
  return (seed >>> 0) / 4294967296;
};
export const rr = (a, b) => a + rand() * (b - a);
export const choice = (a) => a[(rand() * a.length) | 0];

/** Palette shared by the HUD, the effects and the text overlay. */
export const C = {
  mint: '#91f6d0',
  cyan: '#71e7fc',
  white: '#ecf7f6',
  red: '#ff7359',
  amber: '#ffc07d',
  purple: '#adadff',
  lime: '#c9f27a',
};

const colorCache = new Map();
/** '#rrggbb' (or an [r, g, b] array) → [r, g, b] in 0..1, cached. */
export function rgb(s) {
  if (Array.isArray(s)) return s;
  let c = colorCache.get(s);
  if (c) return c;
  const h = parseInt(s.replace('#', ''), 16);
  c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  colorCache.set(s, c);
  return c;
}
export function shade(c, s) {
  c = rgb(c);
  return [c[0] * s, c[1] * s, c[2] * s];
}

export function readSave(key, fallback) {
  try {
    const v = localStorage.getItem('snatchwing.' + key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function save(key, val) {
  try {
    localStorage.setItem('snatchwing.' + key, JSON.stringify(val));
  } catch {
    /* private mode or storage full: progress just isn't kept */
  }
}
