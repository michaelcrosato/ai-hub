/**
 * nav.js — menus for keyboard and controller. SKYSHIELD's menus are DOM
 * buttons, so the D-pad, left stick, WASD or arrows move focus to the nearest
 * control in that direction, A (or Enter) presses it, and left/right on a
 * setting ("cycler") changes its value.
 */

export const FOCUSABLE = 'button:not([disabled])';

function visible(el) {
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
}

export function focusables(scope) {
  return scope ? [...scope.querySelectorAll(FOCUSABLE)].filter(visible) : [];
}

/** The control a screen wants focused first ([data-autofocus]), else its first button. */
export function firstFocus(scope) {
  if (!scope) return null;
  const auto = [...scope.querySelectorAll('[data-autofocus]')].find((el) => !el.disabled && visible(el));
  return auto || focusables(scope)[0] || null;
}

export function focusEl(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** Nearest control from `from` in a screen direction (dx, dy; y down). */
export function neighbour(scope, from, dx, dy) {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of focusables(scope)) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const bx = r.left + r.width / 2;
    const by = r.top + r.height / 2;
    let gap;
    let side;
    if (dx) {
      const sameRow = Math.min(a.bottom, r.bottom) - Math.max(a.top, r.top) > 0;
      const past = dx > 0 ? r.left >= a.right - 4 : r.right <= a.left + 4;
      if (!past && !(sameRow && (bx - ax) * dx > 2)) continue;
      gap = Math.max(0, dx > 0 ? r.left - a.right : a.left - r.right);
      side = Math.max(0, r.top - a.bottom, a.top - r.bottom);
    } else {
      const sameCol = Math.min(a.right, r.right) - Math.max(a.left, r.left) > 0;
      const past = dy > 0 ? r.top >= a.bottom - 4 : r.bottom <= a.top + 4;
      if (!past && !(sameCol && (by - ay) * dy > 2)) continue;
      gap = Math.max(0, dy > 0 ? r.top - a.bottom : a.top - r.bottom);
      side = Math.max(0, r.left - a.right, a.left - r.right);
    }
    const score = gap + side * 2 + Math.hypot(bx - ax, by - ay) * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/**
 * Turns a held direction into discrete steps: one on press, then repeats
 * after a short delay. Returns [dx, dy] (screen, y down) on the frames it fires.
 */
export function createRepeater({ delay = 0.36, rate = 0.12, threshold = 0.5 } = {}) {
  let held = null;
  let timer = 0;
  return (v, dt) => {
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    if (Math.max(ax, ay) < threshold) {
      held = null;
      return null;
    }
    const dir = ax > ay ? [Math.sign(v.x), 0] : [0, -Math.sign(v.y)];
    if (!held || held[0] !== dir[0] || held[1] !== dir[1]) {
      held = dir;
      timer = delay;
      return dir;
    }
    timer -= dt;
    if (timer > 0) return null;
    timer = rate;
    return dir;
  };
}
