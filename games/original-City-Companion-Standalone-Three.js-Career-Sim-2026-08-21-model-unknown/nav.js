// Gamepad (and arrow-key) navigation for the game's own DOM menus: the setup
// screen, dialogs, the pause menu and the business phone. It reads kit.input
// actions only: `move` steps between controls spatially, `confirm` activates.

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])';

const visible = (el) => el.getClientRects().length > 0 && !el.closest('.hidden, [hidden]');
const markTarget = (el) => el.closest('.choice-card') || el;

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.root = null;
    this.layerKey = null;
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

  /** The control a menu opens on: data-nav-default, a primary button, or the first choice. */
  preferred(root) {
    const list = this.items(root);
    return (
      list.find((el) => el.matches('[data-nav-default]')) ||
      list.find((el) => el.matches('.modal-choice, .location-action')) ||
      list.find((el) => el.matches('.phone-tab.active')) ||
      list.find((el) => el.matches('.primary')) ||
      list.find((el) => !el.matches('.modal-close, .phone-close')) ||
      null
    );
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

  /** Spatial navigation: the nearest control in the pressed direction. dx/dy are screen directions. */
  move(root, dx, dy) {
    const list = this.items(root);
    if (!list.length) return;
    const cur = this.current(root);
    if (!cur) {
      this.focus(this.preferred(root) || list[0]);
      return;
    }
    // Sliders take left/right as value changes.
    if (dx && cur.matches('input[type="range"]')) {
      if (dx > 0) cur.stepUp();
      else cur.stepDown();
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      cur.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
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
      // Rows count as aligned when they overlap, so down from a wide button finds the one below.
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
      this.focus(this.preferred(root));
      return;
    }
    if (cur.matches('input[type="text"], input[type="range"]')) return;
    cur.click();
  }

  /**
   * Call every frame. root = the element of the open menu (or null in the world).
   * layerKey changes when a menu's content is replaced (a new dialog).
   */
  update(root, layerKey = null) {
    const input = this.input;
    if (root !== this.root || layerKey !== this.layerKey) {
      const old = this.root;
      this.root = root;
      this.layerKey = layerKey;
      this.heldDir = null;
      this.clearMark();
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
      const fire = dir !== this.heldDir || now >= this.repeatAt;
      if (fire) {
        this.repeatAt = now + (dir !== this.heldDir ? 380 : 130);
        this.heldDir = dir;
        this.move(root, dir === 'right' ? 1 : dir === 'left' ? -1 : 0, dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
      }
    } else {
      this.heldDir = null;
    }
    if (input.pressed('confirm')) this.activate(root);
    // Keep the marker on whatever has focus (mouse users clicking around clear it).
    const cur = this.current(root);
    if (this.marked && (!cur || markTarget(cur) !== this.marked)) this.clearMark();
    return true;
  }
}
