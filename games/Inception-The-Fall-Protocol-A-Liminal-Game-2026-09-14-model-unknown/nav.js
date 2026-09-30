/**
 * nav.js — controller and keyboard navigation for the game's own DOM menus
 * (title, briefing, pause, field manual, mission plan, results).
 *
 * The D-pad, left stick, arrow keys and WASD move focus to the nearest
 * control in that direction; left/right steps a slider or a select; A (or
 * Enter) presses the focused control.
 */

const FOCUSABLE = 'button:not([disabled]), input:not([type=hidden]):not([disabled]), select:not([disabled]), a[href]';

function shown(el) {
  if (el.closest('.hidden, [hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
}

export function focusables(scope) {
  return scope ? [...scope.querySelectorAll(FOCUSABLE)].filter(shown) : [];
}

/** The main button of a screen: its primary button, else the first control. */
export function primaryOf(scope) {
  const list = focusables(scope);
  return list.find((el) => el.classList.contains('primary')) || list[0] || null;
}

/**
 * The nearest control from `from` in a screen direction (dx, dy with y down),
 * scored by the gap along the direction plus twice the sideways offset.
 */
export function neighbour(scope, from, dx, dy) {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of focusables(scope)) {
    if (el === from || el.contains(from) || from.contains(el)) continue;
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
      const sameColumn = Math.min(a.right, r.right) - Math.max(a.left, r.left) > 0;
      const past = dy > 0 ? r.top >= a.bottom - 4 : r.bottom <= a.top + 4;
      if (!past && !(sameColumn && (by - ay) * dy > 2)) continue;
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

/** Left/right on a slider or a select changes its value; returns true when it did. */
export function adjust(el, dir) {
  if (el?.tagName === 'SELECT') {
    const n = el.options.length;
    if (!n) return true;
    el.selectedIndex = (el.selectedIndex + dir + n) % n;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (el?.tagName === 'INPUT' && el.type === 'range') {
    const min = +el.min || 0;
    const max = el.max === '' ? 100 : +el.max;
    const step = +el.step || 1;
    const jump = Math.max(step, Math.round((max - min) / 20 / step) * step);
    const v = Math.min(max, Math.max(min, +el.value + dir * jump));
    el.value = String(Math.round(v / step) * step);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/** A controller press on the focused control: click buttons, links and checkboxes, step selects. */
export function press(el) {
  if (!el) return;
  if (el.tagName === 'SELECT') adjust(el, 1);
  else if (el.tagName === 'INPUT' && el.type === 'range') adjust(el, 1);
  else el.click();
}

/** Focus a control from the keyboard or a controller, with a visible ring. */
export function markFocus(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.classList.add('nav-focus');
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

if (typeof document !== 'undefined') {
  document.addEventListener('focusout', (e) => e.target?.classList?.remove('nav-focus'));
  // A mouse or finger takes over from the controller: drop the ring.
  document.addEventListener('pointerdown', () => document.querySelectorAll('.nav-focus').forEach((el) => el.classList.remove('nav-focus')), true);
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
