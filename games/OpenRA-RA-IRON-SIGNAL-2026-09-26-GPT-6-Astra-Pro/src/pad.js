/**
 * Controller support for a DOM-heavy RTS. A free cursor (left stick) points at the
 * battlefield, the minimap, or any button of the sidebar and command bar; A clicks what
 * it points at. In menus the D-pad jumps between buttons (and adjusts sliders and
 * selects) and the cursor follows the focus. The actions themselves come from kit.input;
 * this file only owns the cursor and the spatial navigation.
 */

const FOCUSABLE = 'button, select, input, a[href], summary, [data-build]';
/** What A can press: the controls above plus the two canvases the game handles itself. */
const ACTIONABLE = 'button, select, input, a[href], summary, #minimap, .battlefield';

export function focusablesIn(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0);
}

/** The first thing a menu should point at: its primary button, else the first control. */
export function primaryIn(root) {
  const list = focusablesIn(root);
  return list.find((el) => el.classList.contains('primary')) || list[0] || null;
}

const center = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** The nearest control from `from` in a direction; wraps around to the far side when nothing lies that way. */
export function nearestInDirection(from, dir, list) {
  const a = center(from.getBoundingClientRect());
  const horizontal = dir === 'Left' || dir === 'Right';
  const sign = dir === 'Right' || dir === 'Down' ? 1 : -1;
  let best = null, bestScore = Infinity, wrap = null, wrapScore = -Infinity;
  for (const el of list) {
    if (el === from) continue;
    const b = center(el.getBoundingClientRect());
    const main = (horizontal ? b.x - a.x : b.y - a.y) * sign;
    const cross = Math.abs(horizontal ? b.y - a.y : b.x - a.x);
    if (main > 4) {
      const score = main + cross * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    } else {
      // Wrap target: the control farthest back along the axis, preferring the same column/row.
      const score = -main - cross * 2.2;
      if (score > wrapScore) {
        wrapScore = score;
        wrap = el;
      }
    }
  }
  return best || wrap;
}

/** Nudge a select or a range slider; returns false for anything else. */
export function adjust(el, delta) {
  if (el.tagName === 'SELECT') {
    const i = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + delta));
    if (i !== el.selectedIndex) {
      el.selectedIndex = i;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }
  if (el.tagName === 'INPUT' && el.type === 'range') {
    const min = Number(el.min || 0), max = Number(el.max || 100), step = Math.max(Number(el.step) || 1, (max - min) / 20);
    el.value = String(Math.max(min, Math.min(max, Number(el.value) + delta * step)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  return false;
}

/** Press a control the way a click would; a select steps to its next option. */
export function activate(el) {
  if (el.tagName === 'SELECT') {
    el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus({ preventScroll: true });
    return;
  }
  if (el.tagName === 'INPUT' && el.type === 'range') {
    el.focus({ preventScroll: true });
    return;
  }
  el.click();
}

export class PadCursor {
  constructor() {
    const el = document.createElement('div');
    el.id = 'pad-cursor';
    el.hidden = true;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32"><path d="M4 3l20 11-9 2 6 10-4 2-6-10-7 6z" fill="#d9e8a2" stroke="#162b24" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.append(el);
    this.el = el;
    this.x = innerWidth / 2;
    this.y = innerHeight / 2;
    this.active = false;
    this.hot = null;
    /** True for the frame the controller took over: that press only wakes the cursor. */
    this.fresh = false;
    /** Whether the cursor is over the battlefield canvas (not a HUD control). */
    this.overMap = false;
  }
  show(on) {
    this.active = on;
    this.el.hidden = !on;
    if (!on) this.setHot(null);
  }
  /** Stick input: fine near the centre, fast at full tilt. */
  move(vx, vy, dt) {
    const m = Math.hypot(vx, vy);
    if (!m) return false;
    const speed = Math.min(innerWidth, innerHeight) * (0.35 + 0.95 * m);
    this.x = Math.max(2, Math.min(innerWidth - 2, this.x + vx * speed * dt));
    this.y = Math.max(2, Math.min(innerHeight - 2, this.y - vy * speed * dt));
    return true;
  }
  snap(el) {
    const c = center(el.getBoundingClientRect());
    this.x = c.x;
    this.y = c.y;
  }
  /** The actionable element under the cursor (a control, the minimap, or the battlefield), or null. */
  under() {
    const el = document.elementFromPoint(this.x, this.y);
    return el?.closest?.(ACTIONABLE) || null;
  }
  setHot(el) {
    if (this.hot === el) return;
    this.hot?.classList.remove('pad-hot');
    this.hot = el;
    if (el && el.tagName !== 'CANVAS') el.classList.add('pad-hot');
  }
  draw() {
    this.el.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.y)}px)`;
  }
}
