/**
 * fill.mjs — does a game use the whole screen?
 *
 * The player hands every game the full window. A game that then draws into a
 * smaller box (a centred frame, a fixed 960×540 stage, a max-width page) wastes
 * it. `scripts/fill.mjs` loads each game in a browser at several landscape
 * window shapes and feeds what it sees through `grade`, which is pure so that
 * `scripts/fill.test.mjs` can pin the rules down.
 *
 * A game *fills* when, at every window shape, either its main drawing surface
 * (canvas, svg, video, image) covers the window, or the things it paints
 * (surfaces, text, anything with a background or border) reach every edge.
 * Flat bars on two opposite edges of the screenshot are reported separately:
 * a canvas can fill the window and still letterbox the picture inside it.
 */

/** Share of the window, per axis, that counts as reaching the edge. */
export const EDGE = 0.97;

/**
 * Runs inside the page (passed to page.evaluate, so it must not close over
 * anything). Returns the window size, the largest visible drawing surface,
 * and the bounding box of everything the page visibly paints.
 */
export function measurePage() {
  const vw = innerWidth;
  const vh = innerHeight;
  const clip = (r) => {
    const left = Math.max(r.left, 0);
    const top = Math.max(r.top, 0);
    const right = Math.min(r.right, vw);
    const bottom = Math.min(r.bottom, vh);
    return right > left && bottom > top ? { left, top, right, bottom } : null;
  };
  const shown = (el) => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
  };
  const SURFACE = new Set(['CANVAS', 'SVG', 'VIDEO', 'IMG', 'IFRAME']);
  let surface = null;
  const paint = { left: vw, top: vh, right: 0, bottom: 0 };
  const grow = (b) => {
    paint.left = Math.min(paint.left, b.left);
    paint.top = Math.min(paint.top, b.top);
    paint.right = Math.max(paint.right, b.right);
    paint.bottom = Math.max(paint.bottom, b.bottom);
  };
  for (const el of document.body ? document.body.querySelectorAll('*') : []) {
    if (!shown(el)) continue;
    const b = clip(el.getBoundingClientRect());
    if (!b) continue;
    const tag = el.tagName.toUpperCase();
    if (SURFACE.has(tag)) {
      const area = (b.right - b.left) * (b.bottom - b.top);
      if (!surface || area > surface.area) surface = { tag: tag.toLowerCase(), area, w: b.right - b.left, h: b.bottom - b.top };
      grow(b);
      continue;
    }
    const cs = getComputedStyle(el);
    const bg = cs.backgroundColor;
    const painted =
      (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) ||
      cs.backgroundImage !== 'none' ||
      parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) > 0 ||
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (painted) grow(b);
  }
  const doc = document.documentElement;
  return {
    vw,
    vh,
    surface: surface && { tag: surface.tag, x: surface.w / vw, y: surface.h / vh },
    paint: paint.right > paint.left ? { x: (paint.right - paint.left) / vw, y: (paint.bottom - paint.top) / vh } : { x: 0, y: 0 },
    scrolls: doc.scrollWidth > vw + 4 || doc.scrollHeight > vh + 4,
  };
}

const reaches = (box) => Boolean(box) && box.x >= EDGE && box.y >= EDGE;

/**
 * One window's verdict: 'fills' (the surface covers it), 'panels' (no single
 * surface does, but the layout reaches every edge — sidebars, HUD panels, DOM
 * games), or 'boxed'.
 */
export function gradeView(m) {
  if (!m || m.error) return 'error';
  if (reaches(m.surface)) return 'fills';
  if (reaches(m.paint)) return 'panels';
  return 'boxed';
}

/** The game's verdict across windows: the worst of them. */
export function grade(views) {
  const order = ['error', 'boxed', 'panels', 'fills'];
  const verdicts = Object.values(views).map(gradeView);
  return verdicts.reduce((worst, v) => (order.indexOf(v) < order.indexOf(worst) ? v : worst), 'fills');
}

/**
 * Edge-strip statistics → are there letterbox bars? `a` and `b` are the two
 * outer strips (left/right or top/bottom), `mid` the middle of the screen;
 * each is { mean: [r, g, b], sd }. Bars are two flat strips of the same
 * colour around a middle that has something in it.
 */
export function hasBars({ a, b, mid }) {
  const flat = (s) => s.sd < 3;
  const same = Math.max(...a.mean.map((v, k) => Math.abs(v - b.mean[k]))) < 6;
  return flat(a) && flat(b) && same && mid.sd > 8;
}
