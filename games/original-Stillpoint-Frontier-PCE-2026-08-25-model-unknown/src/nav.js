/**
 * nav.js — drives the game's own DOM menus (title, pause menu, field tablet,
 * results screen, GRID LAB) from kit.input actions, so every one of them works
 * with a gamepad and the arrow keys as well as the mouse and touch:
 * stick / D-pad / arrows move focus to the nearest control in that direction,
 * `confirm` (A, Enter) activates it, `back` (B) backs out. Left and right on a
 * <select> step through its options.
 */

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"])';
const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FIRST_REPEAT = 0.36;
const NEXT_REPEAT = 0.11;

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.root = null;
    this.onBack = null;
    this.dir = null;
    this.repeat = 0;
    this.marked = null;
  }

  get active() {
    return !!this.root;
  }

  /** Take over a container. `initial` gets focus (else the first control) unless focus is false. */
  attach(root, { initial = null, onBack = null, focus = true } = {}) {
    this.root = root;
    this.onBack = onBack;
    // A stick already held when the menu opens only moves after the repeat delay.
    this.dir = this.direction();
    this.repeat = FIRST_REPEAT;
    if (focus) this.focus(initial && this.visible(initial) ? initial : (this.items()[0] ?? null));
  }

  /** Let go of `root` (or whatever is attached when root is omitted). */
  detach(root = null) {
    if (root && root !== this.root) return;
    this.mark(null);
    this.root = null;
    this.onBack = null;
  }

  /** Call once per frame while a menu is open. */
  update(dt) {
    if (!this.root) return;
    const dir = this.direction();
    if (dir !== this.dir) {
      this.dir = dir;
      this.repeat = FIRST_REPEAT;
      if (dir) this.step(dir);
    } else if (dir) {
      this.repeat -= dt;
      if (this.repeat <= 0) {
        this.repeat = NEXT_REPEAT;
        this.step(dir);
      }
    }
    if (this.input.pressed('confirm')) this.activate();
    else if (this.input.pressed('back')) this.onBack?.();
  }

  direction() {
    const v = this.input.vector('move');
    const ax = Math.abs(v.x);
    const ay = Math.abs(v.y);
    if (Math.max(ax, ay) < 0.5) return null;
    if (ay >= ax) return v.y > 0 ? 'up' : 'down';
    return v.x > 0 ? 'right' : 'left';
  }

  visible(el) {
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  items() {
    if (!this.root) return [];
    return [...this.root.querySelectorAll(FOCUSABLE)].filter((el) => this.visible(el));
  }

  current() {
    const el = document.activeElement;
    return el && el !== this.root && this.root?.contains(el) ? el : null;
  }

  focus(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.mark(el);
  }

  mark(el) {
    if (this.marked && this.marked !== el) this.marked.classList.remove('nav-focus');
    this.marked = el;
    el?.classList.add('nav-focus');
  }

  step(dir) {
    const items = this.items();
    if (!items.length) return;
    const cur = this.current();
    if (!cur) {
      this.focus(items[0]);
      return;
    }
    if (cur.tagName === 'SELECT' && (dir === 'left' || dir === 'right')) {
      const n = cur.options.length;
      if (n) {
        cur.selectedIndex = (cur.selectedIndex + (dir === 'right' ? 1 : -1) + n) % n;
        cur.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    const [dx, dy] = DIRECTIONS[dir];
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const px = r.left + r.width / 2 - ax;
      const py = r.top + r.height / 2 - ay;
      const along = px * dx + py * dy;
      if (along <= 2) continue;
      const across = Math.abs(px * dy - py * dx);
      const score = along + across * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    // Vertical lists wrap around at the ends.
    if (!best && (dir === 'up' || dir === 'down')) {
      const wrap = dir === 'down' ? items[0] : items[items.length - 1];
      if (wrap !== cur) best = wrap;
    }
    if (best) this.focus(best);
  }

  activate() {
    const cur = this.current();
    if (!cur) {
      this.focus(this.items()[0] ?? null);
      return;
    }
    if (cur.tagName === 'SELECT') return;
    if (cur.tagName === 'INPUT' && !['button', 'submit', 'checkbox', 'radio'].includes(cur.type)) return;
    cur.click();
  }
}
