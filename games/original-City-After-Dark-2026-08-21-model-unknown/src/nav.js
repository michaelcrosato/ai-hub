/**
 * nav.js — drive the game's DOM menus (start screen, management panels,
 * dialogs, the pause menu) with a gamepad or the arrow keys, through the
 * kit's input actions: move (stick, D-pad, arrows, WASD) steps between
 * controls, confirm (A, Enter, Space) activates, back (B, Backspace) leaves,
 * and the right stick scrolls long panels.
 *
 * Nothing here runs per frame except reading the actions; the DOM is only
 * measured when the player actually moves the focus.
 */

const FOCUSABLE = [
  'button:not([disabled])',
  '[data-action]:not(button)',
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex="0"]',
].join(',');

const FIRST_REPEAT_MS = 380;
const REPEAT_MS = 120;

/** Styled switches hide their checkbox (0×0); measure the visible label instead. */
function rectOf(el) {
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return (el.closest('label') || el).getBoundingClientRect();
    return r;
  }
  return el.getBoundingClientRect();
}

function isShown(el) {
  if (!el.isConnected || el.closest('[hidden], .hidden')) return false;
  const r = rectOf(el);
  return r.width > 0 && r.height > 0;
}

export function createNav(kit) {
  let current = null;
  let heldDir = null;
  let repeatAt = 0;

  const mark = (el) => {
    if (current && current !== el) current.classList.remove('nav-focus');
    current = el;
    if (!el) return;
    el.classList.add('nav-focus');
    el.focus({ preventScroll: true });
    (el.closest('label.switch') || el).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };

  const list = (roots) => {
    const out = [];
    for (const root of roots) {
      if (!root) continue;
      for (const el of root.querySelectorAll(FOCUSABLE)) if (isShown(el) && !out.includes(el)) out.push(el);
    }
    return out;
  };

  const focusedIn = (roots) => {
    const inRoots = (el) => el && el !== document.body && roots.some((r) => r && r.contains(el));
    const active = document.activeElement;
    if (inRoots(active) && active.matches(FOCUSABLE)) return active;
    if (inRoots(current) && current.isConnected) return current;
    return null;
  };

  const preferred = (els) =>
    els.find((el) => el.matches('.choice-button')) ||
    els.find((el) => el.matches('.modal-footer .primary')) ||
    els.find((el) => el.matches('button.primary')) ||
    els[0];

  /** Nearest control in a direction, preferring ones that line up. */
  const neighbour = (from, els, dir) => {
    const a = rectOf(from);
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of els) {
      if (el === from || el.contains(from) || from.contains(el)) continue;
      const r = rectOf(el);
      const bx = r.left + r.width / 2;
      const by = r.top + r.height / 2;
      let along;
      let across;
      if (dir === 'down' || dir === 'up') {
        if (dir === 'down' ? by <= ay + 2 : by >= ay - 2) continue;
        along = dir === 'down' ? Math.max(0, r.top - a.bottom) : Math.max(0, a.top - r.bottom);
        across = r.right < a.left ? a.left - r.right : r.left > a.right ? r.left - a.right : 0;
      } else {
        if (dir === 'right' ? bx <= ax + 2 : bx >= ax - 2) continue;
        along = dir === 'right' ? Math.max(0, r.left - a.right) : Math.max(0, a.left - r.right);
        across = r.bottom < a.top ? a.top - r.bottom : r.top > a.bottom ? r.top - a.bottom : 0;
      }
      const score =
        along + across * 2.5 + Math.abs(dir === 'down' || dir === 'up' ? bx - ax : by - ay) * 0.02;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  };

  /** Left/right on a slider or a drop-down changes its value instead of moving. */
  const adjust = (el, sign) => {
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const step = Number(el.step) || 1;
      const next = Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + step * sign));
      if (String(next) !== el.value) {
        el.value = String(next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    if (el instanceof HTMLSelectElement) {
      const n = el.options.length;
      if (!n) return true;
      el.selectedIndex = (el.selectedIndex + sign + n) % n;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  };

  const activate = (el) => {
    if (el instanceof HTMLSelectElement) return adjust(el, 1);
    if (el instanceof HTMLInputElement && (el.type === 'text' || el.type === 'range')) return el.focus();
    if (el instanceof HTMLTextAreaElement) return el.focus();
    el.click();
  };

  return {
    /** Forget the highlight (a menu closed). */
    clear() {
      current?.classList.remove('nav-focus');
      current = null;
    },

    /** Put the highlight on the best first control inside roots. */
    focusFirst(roots) {
      const els = list(roots);
      if (els.length) mark(preferred(els));
    },

    /**
     * Read the menu actions for this frame.
     * @param {object} o
     * @param {HTMLElement[]} o.roots   where focus may go (the open menu)
     * @param {() => void} [o.onBack]   B / Backspace
     * @param {HTMLElement} [o.scroll]  what the right stick scrolls
     */
    update({ roots, onBack, scroll }) {
      const input = kit.input;
      const v = input.vector('move');
      let dir = null;
      if (Math.abs(v.x) > Math.abs(v.y)) dir = v.x > 0.5 ? 'right' : v.x < -0.5 ? 'left' : null;
      else dir = v.y > 0.5 ? 'up' : v.y < -0.5 ? 'down' : null;
      const now = performance.now();
      if (dir && (dir !== heldDir || now >= repeatAt)) {
        repeatAt = now + (dir !== heldDir ? FIRST_REPEAT_MS : REPEAT_MS);
        heldDir = dir;
        const from = focusedIn(roots);
        if (!from) {
          this.focusFirst(roots);
        } else if ((dir === 'left' || dir === 'right') && adjust(from, dir === 'right' ? 1 : -1)) {
          // value changed in place
        } else {
          const next = neighbour(from, list(roots), dir);
          if (next) mark(next);
          else if (scroll) scroll.scrollBy({ top: dir === 'down' ? 140 : dir === 'up' ? -140 : 0 });
        }
      } else if (!dir) {
        heldDir = null;
      }

      if (input.pressed('confirm')) {
        const el = focusedIn(roots);
        if (el) activate(el);
        else this.focusFirst(roots);
      }
      if (input.pressed('back')) onBack?.();

      if (scroll && input.source === 'gamepad') {
        const look = input.look('look');
        if (look.y) scroll.scrollTop += look.y * 900;
      }
    },
  };
}
