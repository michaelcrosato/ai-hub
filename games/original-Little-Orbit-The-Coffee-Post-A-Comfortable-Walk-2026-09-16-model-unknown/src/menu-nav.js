/**
 * menu-nav.js — drive the game's own DOM panels with a gamepad or the arrow keys.
 *
 * Up / left on the stick, D-pad or arrows move to the previous control, down /
 * right to the next one (left and right change a slider). A (or Space when no
 * button has focus) presses the focused control; B goes back. Keyboard users
 * keep Tab, Enter and Space as usual.
 */
const FOCUSABLE = 'button:not(:disabled), summary, input[type=range], a[href]';

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.panel = null; this.dir = 0; this.wait = 0; this.marked = null;
  }
  items(panel) {
    return [...panel.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length && !el.closest('[hidden],[inert]'));
  }
  focus(el) {
    if (!el) return;
    if (this.marked && this.marked !== el) this.marked.classList.remove('nav-focus');
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest' });
    // Programmatic focus after a gamepad press does not always show the ring: mark it ourselves.
    el.classList.add('nav-focus'); this.marked = el;
  }
  clearMark() { if (this.marked) { this.marked.classList.remove('nav-focus'); this.marked = null; } }
  /**
   * Call once per frame with the panel that owns the controls (or null).
   * back() runs when B is pressed. Returns true while a panel is active.
   */
  update(dt, panel, back) {
    const input = this.input;
    if (panel !== this.panel) {
      this.panel = panel; this.dir = 0; this.clearMark();
      // A controller needs a focused control to press; mouse and touch players do not.
      if (panel && input.isPad && !panel.contains(document.activeElement)) this.focus(this.items(panel)[0]);
    }
    if (!panel) return false;
    const v = input.vector('move');
    const dir = Math.abs(v.y) >= Math.abs(v.x) ? (v.y > .55 ? -1 : v.y < -.55 ? 1 : 0) : (v.x > .55 ? 2 : v.x < -.55 ? -2 : 0);
    if (dir !== this.dir) { this.dir = dir; this.wait = .38; if (dir) this.step(panel, dir); }
    else if (dir) { this.wait -= dt; if (this.wait <= 0) { this.wait = .13; this.step(panel, dir); } }
    if (input.pressed('jump')) {
      const el = document.activeElement;
      if (el && panel.contains(el) && el.matches(FOCUSABLE) && el.type !== 'range') el.click();
      else if (!panel.contains(el)) this.focus(this.items(panel)[0]);
    }
    if (input.pressed('back')) back?.();
    return true;
  }
  step(panel, dir) {
    const items = this.items(panel); if (!items.length) return;
    const cur = document.activeElement;
    if (cur && cur.type === 'range' && Math.abs(dir) === 2 && items.includes(cur)) {
      const step = Number(cur.step) || 5;
      cur.value = String(Math.max(Number(cur.min) || 0, Math.min(Number(cur.max) || 100, Number(cur.value) + Math.sign(dir) * Math.max(step, 5))));
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    let i = items.indexOf(cur);
    const next = Math.sign(dir);
    i = i < 0 ? (next > 0 ? 0 : items.length - 1) : Math.max(0, Math.min(items.length - 1, i + next));
    this.focus(items[i]);
  }
}
