const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type=hidden]), summary';

/**
 * Gamepad (and arrow-key) navigation for the lab's own DOM panels, driven by kit.input
 * actions: up/down moves focus, left/right adjusts sliders and lists, A activates, B backs out.
 */
export class PadNav {
  constructor(input) {
    this.input = input; this.root = null; this.onBack = null; this.current = null;
    this.dir = ''; this.repeatAt = 0;
  }
  get active() { return !!this.root; }
  open(root, onBack, first = null) {
    this.root = root; this.onBack = onBack; this.dir = ''; this.repeatAt = 0;
    const items = this.items();
    this.focus(first && items.includes(first) ? first : items[0] || null);
  }
  close() {
    this.current?.classList.remove('pad-focus');
    if (this.root?.contains(document.activeElement)) document.activeElement.blur();
    this.root = null; this.current = null; this.onBack = null;
  }
  items() {
    if (!this.root) return [];
    // Hidden elements (closed <details>, display:none) have no offsetParent.
    return [...this.root.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
  }
  focus(el) {
    this.current?.classList.remove('pad-focus');
    this.current = el;
    if (!el) return;
    el.classList.add('pad-focus');
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest' });
  }
  move(step) {
    const items = this.items(); if (!items.length) return;
    let index = items.indexOf(this.current);
    index = index < 0 ? 0 : (index + step + items.length) % items.length;
    this.focus(items[index]);
  }
  adjust(step) {
    const el = this.current;
    if (!el) return false;
    if (el.tagName === 'INPUT' && el.type === 'range') {
      if (step > 0) el.stepUp(); else el.stepDown();
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.tagName === 'SELECT') {
      const next = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + step));
      if (next !== el.selectedIndex) { el.selectedIndex = next; el.dispatchEvent(new Event('change', { bubbles: true })); }
      return true;
    }
    return false;
  }
  activate() {
    const el = this.current;
    if (!el) return;
    if (el.tagName === 'SELECT') { this.adjust(el.selectedIndex >= el.options.length - 1 ? -el.selectedIndex : 1); return; }
    if (el.tagName === 'INPUT' && el.type === 'range') return;
    el.click();
    // A click can hide the item (a closed <details> summary stays; buttons may close the panel).
    if (this.root && !this.items().includes(this.current)) this.focus(this.items()[0] || null);
  }
  /** Call once per frame while a panel is open. */
  update(now = performance.now()) {
    if (!this.root) return;
    const input = this.input, v = input.vector('move');
    const dir = input.down('navUp') || v.y > 0.55 ? 'up' : input.down('navDown') || v.y < -0.55 ? 'down'
      : input.down('navLeft') || v.x < -0.55 ? 'left' : input.down('navRight') || v.x > 0.55 ? 'right' : '';
    if (dir && (dir !== this.dir || now >= this.repeatAt)) {
      this.repeatAt = now + (dir !== this.dir ? 380 : 110);
      if (dir === 'up') this.move(-1);
      else if (dir === 'down') this.move(1);
      else if (!this.adjust(dir === 'right' ? 1 : -1)) this.move(dir === 'right' ? 1 : -1);
    }
    this.dir = dir;
    if (input.pressed('use')) this.activate();
    if (input.pressed('back')) this.onBack?.();
  }
}
