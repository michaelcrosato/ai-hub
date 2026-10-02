/*
 * Gamepad (and arrow-key) navigation for the page's own DOM menus: the Strata pause and results
 * overlay, dialogs and the workbench. D-pad or stick moves focus, A confirms, B goes
 * back, left and right change sliders and lists. Mouse, touch and Tab keep working as usual.
 */
const FOCUSABLE = 'button, select, input:not([type=hidden]):not([type=file]), a[href], summary, textarea';
const ZERO = { x: 0, y: 0 };

export class MenuNav {
  root = null;
  lastDir = '';
  repeatAt = 0;
  marked = null;
  constructor(kit) {
    this.kit = kit;
    this.k = kit.input;
  }
  items(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => !el.disabled && el.getClientRects().length > 0 && !el.closest('[hidden], [inert]'));
  }
  /**
   * Call once per frame with the menu that is showing (or null).
   * @param {HTMLElement|null} root
   * @param {{ keyboard?: boolean, back?: () => void }} [opts] keyboard: arrow keys navigate too
   */
  update(root, { keyboard = true, back = null } = {}) {
    if (root !== this.root) {
      this.root = root;
      this.mark(null);
      this.lastDir = '';
    }
    if (!root) return;
    const pad = this.k.source === 'gamepad';
    const v = pad ? this.k.vector('move') : keyboard ? this.k.vector('arrows') : ZERO;
    const dir = v.y > 0.5 ? 'up' : v.y < -0.5 ? 'down' : v.x < -0.5 ? 'left' : v.x > 0.5 ? 'right' : '';
    const now = performance.now();
    let step = false;
    if (dir && dir !== this.lastDir) {
      step = true;
      this.repeatAt = now + 380;
    } else if (dir && now >= this.repeatAt) {
      step = true;
      this.repeatAt = now + 130;
    }
    this.lastDir = dir;
    if (step) this.move(root, dir);
    if (pad && this.k.pressed('jump')) this.activate(root);
    else if (pad && this.k.pressed('crouch')) back?.();
  }
  current(root) {
    const el = document.activeElement;
    return el && el !== document.body && root.contains(el) && el.matches(FOCUSABLE) ? el : null;
  }
  move(root, dir) {
    const list = this.items(root);
    if (!list.length) return;
    const cur = this.current(root);
    if (cur && (dir === 'left' || dir === 'right')) {
      const d = dir === 'right' ? 1 : -1;
      if (cur.type === 'range') return this.stepRange(cur, d);
      if (cur.tagName === 'SELECT') return this.stepSelect(cur, d);
    }
    const back = dir === 'up' || dir === 'left';
    let i = cur ? list.indexOf(cur) : back ? list.length : -1;
    i = (i + (back ? -1 : 1) + list.length) % list.length;
    this.focus(list[i]);
  }
  activate(root) {
    const cur = this.current(root);
    if (!cur) {
      const first = this.items(root)[0];
      if (first) this.focus(first);
      return;
    }
    if (cur.tagName === 'SELECT') this.stepSelect(cur, 1);
    else if (cur.type === 'range') this.stepRange(cur, 1);
    else cur.click();
  }
  focus(el) {
    try {
      el.focus({ preventScroll: true, focusVisible: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    this.mark(el);
  }
  mark(el) {
    this.marked?.classList.remove('nav-focus');
    this.marked = el;
    el?.classList.add('nav-focus');
  }
  stepRange(el, d) {
    const min = Number(el.min || 0),
      max = Number(el.max || 100),
      stride = (max - min) / 20;
    el.value = String(Math.min(max, Math.max(min, Number(el.value) + d * stride)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  stepSelect(el, d) {
    const n = el.options.length;
    if (!n) return;
    el.selectedIndex = (el.selectedIndex + d + n) % n;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
