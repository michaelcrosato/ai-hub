/**
 * Gamepad and arrow-key navigation for the game's own DOM menus: the stick or D-pad
 * moves focus to the nearest control in that direction, A presses it, left/right steps
 * a focused <select>, and the caller decides what Back does.
 */
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled])';

function shown(el) {
  if (!el.getClientRects().length) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none';
}

export class MenuNav {
  constructor(input) {
    this.input = input;
    this.lastDir = null;
    this.repeatAt = 0;
    // A ring marks pad focus; using the mouse or a finger clears it.
    addEventListener('pointerdown', () => this.clearMark(), true);
    addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'), true);
  }
  clearMark() {
    document.querySelector('.pad-focus')?.classList.remove('pad-focus');
  }
  controls(roots) {
    const out = [];
    for (const root of roots) if (root) for (const el of root.querySelectorAll(FOCUSABLE)) if (shown(el)) out.push(el);
    return out;
  }
  current(roots) {
    const a = document.activeElement;
    return a && a !== document.body && roots.some((r) => r?.contains(a)) && a.matches(FOCUSABLE) ? a : null;
  }
  focus(el) {
    this.clearMark();
    el.classList.add('pad-focus');
    el.focus({ preventScroll: true, focusVisible: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  /** Focus the preferred control (or the first one) when nothing in the menu has focus. */
  enter(roots, preferred) {
    const list = this.controls(roots);
    if (!list.length) return null;
    const el = (preferred && list.find((e) => e.matches(preferred))) || list[0];
    this.focus(el);
    return el;
  }
  move(roots, dir, preferred) {
    const cur = this.current(roots);
    if (!cur) {
      this.enter(roots, preferred);
      return;
    }
    if (cur.tagName === 'SELECT' && (dir === 'left' || dir === 'right')) {
      this.stepSelect(cur, dir === 'right' ? 1 : -1);
      return;
    }
    const r = cur.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of this.controls(roots)) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect();
      const x = q.left + q.width / 2 - cx;
      const y = q.top + q.height / 2 - cy;
      const along = dir === 'right' ? x : dir === 'left' ? -x : dir === 'down' ? y : -y;
      const across = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) this.focus(best);
  }
  stepSelect(select, step) {
    const n = select.options.length;
    let i = select.selectedIndex;
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (!select.options[i].disabled) break;
    }
    if (i !== select.selectedIndex) {
      select.selectedIndex = i;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  /** Press the focused control. False when nothing in the menu has focus. */
  activate(roots) {
    const cur = this.current(roots);
    if (!cur) return false;
    if (cur.tagName === 'SELECT') this.stepSelect(cur, 1);
    else cur.click();
    return true;
  }
  /**
   * Once per frame while a menu shows. Returns { confirm, back, pause } for presses the
   * menu itself did not use (confirm only when nothing was focused).
   */
  update(roots, now, preferred) {
    const v = this.input.vector('move');
    let dir = null;
    if (Math.max(Math.abs(v.x), Math.abs(v.y)) > 0.55) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
    if (dir && (dir !== this.lastDir || now >= this.repeatAt)) {
      this.repeatAt = now + (dir !== this.lastDir ? 0.42 : 0.15);
      this.move(roots, dir, preferred);
    }
    this.lastDir = dir;
    let confirm = false;
    if (this.input.pressed('main')) confirm = !this.activate(roots);
    return { confirm, back: this.input.pressed('alt'), pause: this.input.pressed('pause') };
  }
}
