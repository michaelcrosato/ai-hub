// nav.js — gamepad (and arrow-key) navigation for the game's own menus, read
// from kit.input actions: `move` steps between controls in the pressed direction,
// left/right change sliders and lists, `confirm` activates the focused control.

// The world-map canvas is left out on purpose: a synthetic click has no position, so
// pads and keys travel with the destination list instead.
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])';

const visible = (el) => el.getClientRects().length > 0 && !el.closest('[hidden]');

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.root = null;
    this.heldDir = null;
    this.repeatAt = 0;
  }

  items(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(visible);
  }

  current(root) {
    const a = document.activeElement;
    return a && a !== root && root.contains(a) && visible(a) ? a : null;
  }

  preferred(root) {
    const list = this.items(root);
    return list.find((el) => el.matches('[data-nav-default]')) || list.find((el) => !el.matches('.close-button')) || list[0] || null;
  }

  focus(el) {
    if (!el) return;
    try {
      el.focus({ preventScroll: true, focusVisible: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** Left/right on a slider, list or switch changes it; true when the press was used. */
  adjust(el, dx) {
    if (el.matches('select')) {
      const n = el.options.length;
      if (n) {
        el.selectedIndex = (el.selectedIndex + dx + n) % n;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    if (el.matches('input[type="range"]')) {
      const step = Number(el.dataset.navStep) || Number(el.step) || 1;
      const min = el.min === '' ? 0 : Number(el.min);
      const max = el.max === '' ? 100 : Number(el.max);
      const value = Math.min(max, Math.max(min, (Number(el.value) || 0) + dx * step));
      el.value = String(Math.round(value * 1000) / 1000);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /** Move to the nearest control in a screen direction. */
  move(root, dx, dy) {
    const list = this.items(root);
    if (!list.length) return;
    const cur = this.current(root);
    if (!cur) {
      this.focus(this.preferred(root));
      return;
    }
    if (dx && this.adjust(cur, dx)) return;
    const from = cur.getBoundingClientRect();
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const along = dx ? (ex - cx) * dx : (ey - cy) * dy;
      if (along <= 4) continue;
      const overlap = dx
        ? Math.max(0, Math.min(from.bottom, r.bottom) - Math.max(from.top, r.top))
        : Math.max(0, Math.min(from.right, r.right) - Math.max(from.left, r.left));
      const across = dx ? Math.abs(ey - cy) : Math.abs(ex - cx);
      const score = along + across * (overlap > 0 ? 0.6 : 2.4);
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (!best && dy) {
      const i = list.indexOf(cur);
      best = list[(i + (dy > 0 ? 1 : -1) + list.length) % list.length];
    }
    if (best) this.focus(best);
  }

  activate(root) {
    const cur = this.current(root);
    if (!cur) {
      // The menu's main button answers the first press; elsewhere it only shows the focus.
      const first = this.preferred(root);
      if (first?.matches('[data-nav-default]')) first.click();
      else this.focus(first);
      return;
    }
    if (cur.matches('select')) {
      this.adjust(cur, 1);
      return;
    }
    if (cur.matches('input[type="range"]')) return;
    if (cur.matches('input[type="text"], input:not([type])')) {
      cur.select?.();
      return;
    }
    cur.click();
  }

  /** Every frame with the active menu (or null). Returns true while a menu has the input. */
  update(root) {
    const input = this.input;
    if (root !== this.root) {
      const old = this.root;
      this.root = root;
      this.heldDir = null;
      if (old && !root && old.contains(document.activeElement)) document.activeElement.blur();
      if (root && input.source === 'gamepad') this.focus(this.preferred(root));
    }
    if (!root) return false;
    const v = input.vector('move');
    let dir = null;
    if (Math.abs(v.x) > 0.55 || Math.abs(v.y) > 0.55) {
      dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
    }
    const now = performance.now();
    if (dir) {
      if (dir !== this.heldDir || now >= this.repeatAt) {
        this.repeatAt = now + (dir !== this.heldDir ? 380 : 130);
        this.heldDir = dir;
        this.move(root, dir === 'right' ? 1 : dir === 'left' ? -1 : 0, dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
      }
    } else {
      this.heldDir = null;
    }
    if (input.pressed('confirm')) this.activate(root);
    return true;
  }
}
