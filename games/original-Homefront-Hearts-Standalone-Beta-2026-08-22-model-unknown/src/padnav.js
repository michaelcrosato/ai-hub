/**
 * padnav.js — drive the household ledger and every dialog from a controller
 * or the arrow keys: spatial focus movement, confirm, and keeping the place
 * when a panel re-renders. It reads kit.input actions only and owns no
 * device listeners.
 */

const FOCUSABLE = 'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const SCROLLERS = '.sidebar, .modal-body, .start-card, .top-actions, .category-tabs';
const FIRST_REPEAT = 380;
const REPEAT = 130;

const isUsable = (el) =>
  el.tagName !== 'CANVAS' &&
  !el.disabled &&
  !el.closest('[hidden], [inert]') &&
  el.getClientRects().length > 0 &&
  getComputedStyle(el).visibility !== 'hidden';

/** A selector that finds "the same" control again after its panel is re-rendered. */
function identityOf(el) {
  const esc = (v) => (window.CSS?.escape ? CSS.escape(v) : v);
  if (el.dataset?.k) return `[data-k="${esc(el.dataset.k)}"]`;
  if (el.id) return `#${esc(el.id)}`;
  return null;
}

export function createPadNav({ input, getRoot, getDefault }) {
  let node = null;
  let identity = null;
  let lastRect = null;
  let heldDir = null;
  let repeatAt = 0;
  let lastRoot = null;

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
      // Controls scrolled out of a strip (tabs, the top bar) are reachable only from inside it.
      const scroller = el.closest(SCROLLERS);
      if (!scroller || scroller === fromScroller) return true;
      if (scroller.classList.contains('sidebar') || scroller.classList.contains('modal-body') || scroller.classList.contains('start-card')) return true;
      return visibleIn(el, scroller);
    });
  };

  const defaultIn = (root) => {
    const preferred = getDefault?.(root);
    if (preferred && isUsable(preferred)) return preferred;
    return candidates(root, null)[0] || null;
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

  /** Keep the place when a re-render replaced the focused control. */
  const restore = (root) => {
    if (!node) return;
    if (node.isConnected && root.contains(node)) {
      const active = document.activeElement;
      if (active === node || !active || active === document.body) return;
      // Focus moved on its own (a dialog focused its first button): follow it.
      if (root.contains(active) && active.matches(FOCUSABLE) && isUsable(active)) mark(active);
      return;
    }
    const again = identity ? root.querySelector(identity) : null;
    if (again && isUsable(again)) {
      focus(again);
      return;
    }
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

  // Any pointer use hands focus back to the mouse or finger (and stops the controller highlight
  // from following whatever the click focused).
  document.addEventListener(
    'pointerdown',
    () => {
      node?.classList.remove('pad-focus');
      node = null;
      identity = null;
    },
    true
  );

  return {
    get focused() {
      return node && node.isConnected ? node : null;
    },
    clear,
    focus,
    /**
     * @param {{x:number,y:number}} dir  navigation vector (D-pad, left stick, arrow keys)
     * @param {boolean} confirm  the confirm action went down this frame
     * @returns {boolean} whether the confirm press was used here
     */
    update(dir, confirm) {
      const root = getRoot();
      if (!root) return false;
      if (root !== lastRoot) {
        // The layer changed (a dialog opened or closed): start from what that layer focused.
        lastRoot = root;
        if (node) {
          node.classList.remove('pad-focus');
          node = null;
          identity = null;
        }
        const active = document.activeElement;
        if (input.source === 'gamepad') {
          if (active && root.contains(active) && active.matches(FOCUSABLE) && isUsable(active)) mark(active);
          else focus(defaultIn(root));
        }
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
        const active = document.activeElement;
        const current =
          node && node.isConnected && root.contains(node)
            ? node
            : active && active !== document.body && root.contains(active) && active.matches(FOCUSABLE) && isUsable(active)
              ? active
              : null;
        if (!current) focus(defaultIn(root));
        else {
          const next = step(root, current, ay ? 0 : ax, ay ? -ay : 0);
          if (next) focus(next);
          else mark(current);
        }
      }

      if (confirm) {
        const current = node && node.isConnected && root.contains(node) ? node : null;
        if (!current) {
          focus(defaultIn(root));
          return true;
        }
        if (!(current instanceof HTMLInputElement && current.type === 'text')) current.click();
        input.rumble(0.12, 35);
        return true;
      }
      return false;
    },
    /** The scrollable panel the focused control sits in (right-stick scrolling), if any. */
    scroller() {
      const el = node && node.isConnected ? node : document.activeElement;
      return el?.closest?.('.modal-body, .sidebar, .start-card') || null;
    },
  };
}
