/**
 * padnav.js — drive the game's DOM interface from a controller (and the
 * arrow keys inside dialogs): spatial focus movement, confirm, sliders and
 * selects, scrolling, and keeping the place when a panel re-renders.
 *
 * It reads kit.input actions only; it owns no device listeners.
 */

const FOCUSABLE = 'button, input:not([type="hidden"]):not([type="file"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const SCROLLERS = '.modal, .phone-content, .ledger-list';
const FIRST_REPEAT = 380;
const REPEAT = 120;

const isUsable = (el) =>
  !el.disabled && el.getClientRects().length > 0 && !el.closest('.is-hidden') && getComputedStyle(el).visibility !== 'hidden';

/** A selector that finds "the same" control again after its panel is re-rendered. */
function identityOf(el) {
  const esc = (v) => (window.CSS?.escape ? CSS.escape(v) : v);
  if (el.id) return `#${esc(el.id)}`;
  const d = el.dataset;
  if (d.onboardGroup) return `[data-onboard-group="${esc(d.onboardGroup)}"][data-id="${esc(d.id || '')}"]`;
  if (d.tab) return `[data-tab="${esc(d.tab)}"]`;
  if (d.action) return `[data-action="${esc(d.action)}"]${d.id ? `[data-id="${esc(d.id)}"]` : ''}`;
  return null;
}

export function createPadNav({ input, modalLayer, gameUi }) {
  let node = null; // the control we focused
  let identity = null;
  let lastRect = null;
  let heldDir = null;
  let repeatAt = 0;

  const rootFor = (modalOpen) => (modalOpen ? modalLayer : gameUi);

  const mark = (el) => {
    if (node && node !== el) node.classList.remove('pad-focus');
    node = el;
    identity = el ? identityOf(el) : null;
    if (el) {
      el.classList.add('pad-focus');
      lastRect = el.getBoundingClientRect();
    }
  };

  const clear = () => {
    node?.classList.remove('pad-focus');
    if (node && document.activeElement === node) node.blur();
    node = null;
    identity = null;
  };

  const focus = (el) => {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    mark(el);
  };

  const visibleIn = (el, scroller) => {
    if (!scroller) return true;
    const a = el.getBoundingClientRect();
    const b = scroller.getBoundingClientRect();
    return a.bottom > b.top + 2 && a.top < b.bottom - 2 && a.right > b.left && a.left < b.right;
  };

  const candidates = (root, from) => {
    const fromScroller = from?.closest(SCROLLERS) || null;
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
      if (el === from || !isUsable(el)) return false;
      // Controls scrolled out of their panel are reachable only from inside that panel.
      const scroller = el.closest(SCROLLERS);
      return scroller === fromScroller || visibleIn(el, scroller);
    });
  };

  const defaultIn = (root, modalOpen) => {
    const list = candidates(root, null);
    if (modalOpen) return list[0] || null;
    return (
      list.find((el) => el.closest('#venue-card')) ||
      list.find((el) => el.dataset.action === 'advance-slot') ||
      list[0] ||
      null
    );
  };

  /** Nearest control in a direction: facing-edge distance plus a penalty for sideways offset. */
  const step = (root, from, dx, dy) => {
    const r = from.getBoundingClientRect();
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of candidates(root, from)) {
      const c = el.getBoundingClientRect();
      const ex = (c.left + c.right) / 2;
      const ey = (c.top + c.bottom) / 2;
      let along;
      let gap;
      let offset;
      if (dy) {
        if (dy > 0 ? ey <= cy + 1 : ey >= cy - 1) continue;
        along = dy > 0 ? c.top - r.bottom : r.top - c.bottom;
        gap = Math.max(0, c.left - r.right, r.left - c.right);
        offset = Math.abs(ex - cx);
      } else {
        if (dx > 0 ? ex <= cx + 1 : ex >= cx - 1) continue;
        along = dx > 0 ? c.left - r.right : r.left - c.right;
        gap = Math.max(0, c.top - r.bottom, r.top - c.bottom);
        offset = Math.abs(ey - cy);
      }
      const score = Math.max(0, along) + gap * 3 + offset * 0.15;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return best;
  };

  const adjust = (el, dir) => {
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const stepSize = Number(el.step) || 1;
      el.value = String(Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 100, Number(el.value) + dir * stepSize)));
    } else if (el instanceof HTMLSelectElement) {
      el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + dir));
    } else return false;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  /** Keep the place when a re-render replaced the focused control. */
  const restore = (root) => {
    if (!node) return;
    if (node.isConnected) {
      const active = document.activeElement;
      if (active === node) return;
      // Focus moved on its own (a dialog opened and focused its first button): follow it.
      if (active && active !== document.body && root.contains(active) && active.matches(FOCUSABLE)) mark(active);
      return;
    }
    const again = identity ? root.querySelector(identity) : null;
    if (again && isUsable(again)) {
      focus(again);
      return;
    }
    // Not found: take the nearest control to where the old one was.
    const list = candidates(root, null);
    if (!list.length || !lastRect) return clear();
    const lx = lastRect.left + lastRect.width / 2;
    const ly = lastRect.top + lastRect.height / 2;
    let best = list[0];
    let bestD = Infinity;
    for (const el of list) {
      const c = el.getBoundingClientRect();
      const d = Math.hypot(c.left + c.width / 2 - lx, c.top + c.height / 2 - ly);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
    }
    focus(best);
  };

  // Any pointer use hands focus back to the mouse or finger.
  document.addEventListener('pointerdown', () => node?.classList.remove('pad-focus'), true);

  return {
    get focused() {
      return node && node.isConnected ? node : null;
    },
    clear,
    /**
     * @param {object} o
     * @param {boolean} o.modalOpen   a dialog is up (navigation stays inside it)
     * @param {{x:number,y:number}} o.dir  navigation vector (D-pad; plus stick and arrows in dialogs)
     * @returns {boolean} whether the confirm press was used here
     */
    update({ modalOpen, dir }) {
      const root = rootFor(modalOpen);
      if (node && !root.contains(node) && node.isConnected) {
        // The layer changed (a dialog opened or closed); start from what that layer focused.
        node.classList.remove('pad-focus');
        node = null;
        const active = document.activeElement;
        if (input.source === 'gamepad' && active && root.contains(active) && active.matches(FOCUSABLE)) mark(active);
      }
      restore(root);

      const ax = Math.abs(dir.x) > 0.5 ? Math.sign(dir.x) : 0;
      const ay = Math.abs(dir.y) > 0.5 ? Math.sign(dir.y) : 0;
      const d = ay ? (ay > 0 ? 'up' : 'down') : ax ? (ax > 0 ? 'right' : 'left') : null;
      const now = performance.now();
      let fire = false;
      if (d && d !== heldDir) {
        fire = true;
        repeatAt = now + FIRST_REPEAT;
      } else if (d && now >= repeatAt) {
        fire = true;
        repeatAt = now + REPEAT;
      }
      heldDir = d;

      if (fire) {
        const current = node && node.isConnected ? node : root.contains(document.activeElement) && document.activeElement.matches(FOCUSABLE) ? document.activeElement : null;
        if (!current) focus(defaultIn(root, modalOpen));
        else if ((d === 'left' || d === 'right') && adjust(current, d === 'right' ? 1 : -1)) mark(current);
        else {
          const next = step(root, current, ay ? 0 : ax, ay ? -ay : 0);
          if (next) focus(next);
        }
      }

      if (input.pressed('confirm')) {
        const current = node && node.isConnected ? node : null;
        if (!current) {
          focus(defaultIn(root, modalOpen));
          return true;
        }
        if (current instanceof HTMLSelectElement) adjust(current, current.selectedIndex >= current.options.length - 1 ? -current.selectedIndex : 1);
        else if (!(current instanceof HTMLInputElement && (current.type === 'range' || current.type === 'text'))) current.click();
        input.rumble(0.15, 40);
        return true;
      }
      return false;
    },
    /** The scrollable panel the focused control sits in (for right-stick scrolling), if any. */
    scroller(modalOpen) {
      if (modalOpen) return modalLayer.querySelector('.modal');
      return node?.isConnected ? node.closest('.phone-content') : null;
    },
  };
}
