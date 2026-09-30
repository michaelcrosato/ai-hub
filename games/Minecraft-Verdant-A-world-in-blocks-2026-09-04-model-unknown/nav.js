// D-pad / stick / arrow-key navigation for the game's own dialogs, read from
// kit.input actions: `move` steps between controls on screen, `confirm`
// activates, left/right change selects, sliders and number fields.

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [data-nav]';

const visible = (el) => el.getClientRects().length > 0 && !el.closest('[hidden]');
/** What gets the focus ring: a hidden radio shows it on its card. */
const markTarget = (el) => (el.matches('input[type="radio"]') ? el.parentElement?.querySelector('.choice-card') || el : el);

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.root = null;
    this.heldDir = null;
    this.repeatAt = 0;
    this.marked = null;
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
    return list.find((el) => el.matches('[data-nav-default]')) || list.find((el) => !el.matches('.close-dialog')) || list[0] || null;
  }

  mark(el) {
    if (this.marked && this.marked !== el) this.marked.classList.remove('nav-focus');
    this.marked = el;
    el?.classList.add('nav-focus');
  }

  clearMark() {
    this.marked?.classList.remove('nav-focus');
    this.marked = null;
  }

  focus(el) {
    if (!el) return;
    const target = markTarget(el);
    this.mark(target);
    try {
      el.focus({ preventScroll: true, focusVisible: true });
    } catch {
      el.focus();
    }
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  /** Change the value of the focused control with left/right; true when it took the press. */
  adjust(el, dx) {
    if (el.matches('select')) {
      const n = el.options.length;
      if (!n) return true;
      el.selectedIndex = (el.selectedIndex + dx + n) % n;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.matches('input[type="range"], input[type="number"]')) {
      const step = Number(el.dataset.navStep) || Number(el.step) || 1;
      const min = el.min === '' ? -Infinity : Number(el.min);
      const max = el.max === '' ? Infinity : Number(el.max);
      const value = Math.min(max, Math.max(min, (Number(el.value) || 0) + dx * step));
      el.value = String(Math.round(value * 1000) / 1000);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }

  /** Spatial move: the nearest control in the pressed direction (dx, dy in screen space). */
  move(root, dx, dy) {
    const list = this.items(root);
    if (!list.length) return;
    const cur = this.current(root);
    if (!cur) {
      this.focus(this.preferred(root) || list[0]);
      return;
    }
    if (dx && this.adjust(cur, dx)) return;
    const from = markTarget(cur).getBoundingClientRect();
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur || markTarget(el) === markTarget(cur)) continue;
      const r = markTarget(el).getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;
      const along = dx ? (ex - cx) * dx : (ey - cy) * dy;
      if (along <= 4) continue;
      const overlap = dx ? Math.max(0, Math.min(from.bottom, r.bottom) - Math.max(from.top, r.top)) : Math.max(0, Math.min(from.right, r.right) - Math.max(from.left, r.left));
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
      // The main button of a menu (Enter world, Resume) answers the first press;
      // elsewhere the first press only shows where the focus is.
      const first = this.preferred(root);
      if (first?.matches('[data-nav-default]')) first.click();
      else this.focus(first);
      return;
    }
    if (cur.matches('input[type="range"], input[type="number"], select')) return;
    cur.click();
  }

  /** Call every frame with the open dialog (or null). Returns true while a menu has the input. */
  update(root) {
    const input = this.input;
    if (root !== this.root) {
      const old = this.root;
      this.root = root;
      this.heldDir = null;
      this.clearMark();
      if (old && !root && old.contains(document.activeElement)) document.activeElement.blur();
      if (root && input.source === 'gamepad') this.focus(this.preferred(root));
    }
    if (!root) return false;
    const v = input.vector('move');
    let dir = null;
    if (Math.abs(v.x) > 0.55 || Math.abs(v.y) > 0.55) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
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
    const cur = this.current(root);
    if (this.marked && (!cur || markTarget(cur) !== this.marked)) this.clearMark();
    return true;
  }
}
