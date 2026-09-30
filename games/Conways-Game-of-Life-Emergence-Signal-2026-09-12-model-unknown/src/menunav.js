/**
 * menunav.js — the game's own DOM menus (dialogs, the mobile drawer) with a
 * gamepad or the arrow keys: up/down (and left/right on plain buttons) move
 * focus, left/right change a slider or a list, A presses the focused control.
 * Keyboard Enter/Space on a focused control stay native; the kit leaves them
 * to the button, so nothing fires twice.
 */

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled]):not([type="hidden"]):not([type="file"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const REPEAT_DELAY = 380;
const REPEAT_RATE = 110;

export function createMenuNav(input) {
  let heldDir = null;
  let repeatAt = 0;

  const visible = (el) => !el.closest('[hidden]') && el.getClientRects().length > 0;
  const items = (root) => [...root.querySelectorAll(FOCUSABLE)].filter(visible);

  const focus = (el) => {
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const move = (root, step) => {
    const list = items(root);
    if (!list.length) return;
    let i = list.indexOf(document.activeElement);
    i = i < 0 ? (step > 0 ? 0 : list.length - 1) : (i + step + list.length) % list.length;
    focus(list[i]);
  };

  const adjust = (el, step) => {
    if (el.tagName === 'INPUT' && el.type === 'range') {
      const min = Number(el.min || 0);
      const max = Number(el.max || 100);
      const inc = Number(el.step) || 1;
      const next = Math.min(max, Math.max(min, Number(el.value) + inc * step));
      if (next === Number(el.value)) return true;
      el.value = String(next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.tagName === 'SELECT') {
      const next = Math.min(el.options.length - 1, Math.max(0, el.selectedIndex + step));
      if (next !== el.selectedIndex) {
        el.selectedIndex = next;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    }
    return false;
  };

  const direction = () => {
    const d = input.vector('nudge');
    const s = input.vector('cursor');
    const x = d.x || (Math.abs(s.x) > 0.55 ? Math.sign(s.x) : 0);
    const y = d.y || (Math.abs(s.y) > 0.55 ? Math.sign(s.y) : 0);
    if (!x && !y) return null;
    // Vertical wins a diagonal: menus are columns.
    return y ? (y > 0 ? 'up' : 'down') : x > 0 ? 'right' : 'left';
  };

  return {
    /** Run one frame of menu navigation inside root. */
    update(root, now = performance.now()) {
      if (!root) {
        heldDir = null;
        return;
      }
      const dir = direction();
      let fire = false;
      if (dir !== heldDir) {
        heldDir = dir;
        fire = !!dir;
        repeatAt = now + REPEAT_DELAY;
      } else if (dir && now >= repeatAt) {
        fire = true;
        repeatAt = now + REPEAT_RATE;
      }
      if (fire) {
        const el = document.activeElement;
        const inside = el && root.contains(el) && el !== root;
        if ((dir === 'left' || dir === 'right') && inside && adjust(el, dir === 'right' ? 1 : -1)) {
          /* a slider or list changed */
        } else {
          move(root, dir === 'up' || dir === 'left' ? -1 : 1);
        }
      }
      if (input.source === 'gamepad' && input.pressed('act')) {
        const el = document.activeElement;
        if (el && root.contains(el) && el !== root) el.click();
        else move(root, 1);
      }
    },
    /** Put focus on the first control of a menu that just opened (gamepad players need a starting point). */
    enter(root) {
      const list = items(root);
      const pick = list.find((el) => !el.classList.contains('dialog-close') && !el.matches('[data-close]')) || list[0];
      if (pick) focus(pick);
    },
  };
}
