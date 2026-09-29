/**
 * Menu navigation for keyboard and controller: the game's menus are DOM
 * buttons, selects and sliders, so the D-pad / left stick / arrow keys move
 * focus to the nearest control in that direction, and A activates it.
 */

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([type=hidden]):not([disabled]), summary, a[href]';

function visible(el) {
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 1 && r.height >= 1;
}

export function focusables(scope) {
  return scope ? [...scope.querySelectorAll(FOCUSABLE)].filter(visible) : [];
}

/** A stable name for a control, so focus can come back to it after the menu re-renders. */
export function focusKey(el) {
  if (!el) return '';
  const d = el.dataset || {};
  return [el.tagName, el.id, d.action, d.id, d.step, d.face, d.tab, d.x, d.z, d.option, d.slot, d.equip].join('|');
}

export function findByKey(scope, key) {
  if (!key) return null;
  return focusables(scope).find((el) => focusKey(el) === key) || null;
}

export function focus(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/**
 * The nearest control from `from` in a screen direction (dx, dy with y down),
 * scored by the gap along the direction plus twice the sideways offset.
 */
export function neighbour(scope, from, dx, dy) {
  const a = from.getBoundingClientRect();
  const ax = a.left + a.width / 2,
    ay = a.top + a.height / 2;
  let best = null,
    bestScore = Infinity;
  for (const el of focusables(scope)) {
    if (el === from) continue;
    const r = el.getBoundingClientRect();
    const bx = r.left + r.width / 2,
      by = r.top + r.height / 2;
    // A candidate lies wholly past the edge in that direction, or shares the row (column) and sits further along it.
    let gap, side;
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

/** Left/right on a select or slider changes its value; returns true when it did. */
export function adjust(el, dir) {
  if (el?.tagName === 'SELECT') {
    const n = el.options.length;
    if (!n) return true;
    el.selectedIndex = (el.selectedIndex + dir + n) % n;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  if (el?.tagName === 'INPUT' && el.type === 'range') {
    const step = +el.step || 1,
      v = Math.min(+el.max, Math.max(+el.min, +el.value + dir * step));
    el.value = String(Math.round(v / step) * step);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
}

/** A controller press on a focused control: click buttons and checkboxes, step selects. */
export function activate(el) {
  if (!el) return;
  if (el.tagName === 'SELECT') adjust(el, 1);
  else if (el.tagName === 'INPUT' && (el.type === 'range' || el.type === 'search' || el.type === 'text')) el.focus();
  else el.click();
}

/**
 * Turns a held direction into discrete steps: one on press, then a repeat
 * after a short delay. Returns [dx, dy] (screen, y down) on the frames it fires.
 */
export function createRepeater({ delay = 0.34, rate = 0.11, threshold = 0.5 } = {}) {
  let held = null,
    timer = 0;
  return (v, dt) => {
    const ax = Math.abs(v.x),
      ay = Math.abs(v.y);
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
