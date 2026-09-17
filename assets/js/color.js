/**
 * color.js — turning a game's own theme-color into cabinet lighting.
 *
 * The problem: these colours were picked to sit *behind* a game, not to light
 * a dark room. Undertow ships #050c12 (near black), Little Orbit ships #efe2c9
 * (near white). Used raw, half the wall would be invisible and the other half
 * would glare.
 *
 * So each colour is taken into OKLCH, its hue kept, and its lightness and
 * chroma forced into a band that reads as "lit" on a dark wall. Only a game
 * whose colour is a true grey has no hue to keep; that one gets a hue hashed
 * from its slug instead — stable across visits, and distinct from its
 * neighbours. See NEUTRAL_CHROMA below for where that line sits.
 *
 * Ottosson's OKLab transform: https://bottosson.github.io/posts/oklab/
 */

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function oklchFromHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [L, a, b] = linearToOklab(rgb.map(srgbToLinear));
  return { L, C: Math.hypot(a, b), H: (Math.atan2(b, a) * 180) / Math.PI };
}

/** Back to hex, walking chroma down until the colour fits inside sRGB. */
export function hexFromOklch(L, C, H) {
  const rad = (H * Math.PI) / 180;
  for (let chroma = C; chroma >= 0; chroma -= 0.004) {
    const linear = oklabToLinear([L, Math.cos(rad) * chroma, Math.sin(rad) * chroma]);
    if (linear.every((v) => v >= -0.0012 && v <= 1.0012)) {
      return (
        '#' +
        linear
          .map((v) => Math.round(clamp(linearToSrgb(clamp(v, 0, 1)), 0, 1) * 255).toString(16).padStart(2, '0'))
          .join('')
      );
    }
  }
  return '#000000';
}

/** FNV-1a. Deterministic across sessions, which is the whole point: a game's
 *  fallback colour must never change between visits. */
export function fnv1a(seed) {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const hashHue = (seed) => fnv1a(seed) % 360;
export const hashInt = (seed, max) => fnv1a(seed) % max;

/* Dark colours carry very little absolute chroma in OKLab — Void Explorer's
   #080610 measures 0.023 — yet their hue is still perfectly readable as violet.
   The cut-off therefore sits just above 8-bit quantisation noise (a single
   channel step off grey lands around 0.003), so a real colour keeps its hue and
   only a true grey falls back to the hashed one. */
const NEUTRAL_CHROMA = 0.008;

/**
 * The four values every cabinet is dressed with.
 *   light — the backlit marquee face
 *   glow  — the light it throws on the floor
 *   ink   — text printed on the marquee, and the cabinet's own tint
 *   deep  — the screen's unlit ground
 */
export function paletteFor(themeColor, seed) {
  const source = oklchFromHex(themeColor);
  const neutral = !source || source.C < NEUTRAL_CHROMA;

  const H = neutral ? hashHue(seed) : source.H;
  const C = neutral ? 0.15 : clamp(source.C * 1.85, 0.12, 0.21);

  return {
    hue: H,
    light: hexFromOklch(0.815, C, H),
    glow: hexFromOklch(0.63, C * 0.98, H),
    ink: hexFromOklch(0.2, C * 0.4, H),
    deep: hexFromOklch(0.16, C * 0.3, H),
    derived: neutral,
  };
}

/** Cache: the wall re-renders on every keystroke, the palettes never change. */
const cache = new Map();

export function cabinetPalette(game) {
  let palette = cache.get(game.slug);
  if (!palette) {
    palette = paletteFor(game.themeColor, game.slug);
    cache.set(game.slug, palette);
  }
  return palette;
}

export const paletteVars = (palette) => ({
  '--g-light': palette.light,
  '--g-glow': palette.glow,
  '--g-ink': palette.ink,
  '--g-deep': palette.deep,
});
