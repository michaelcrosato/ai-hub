/* Controller (and arrow-key) navigation for the game's DOM interface: move focus between
   buttons by direction, adjust sliders and selects, confirm with A, and keep the place when a
   panel re-renders. It reads kit.input actions only and owns no device listeners. */

const FOCUSABLE = 'button, input:not([type="hidden"]):not([type="file"]), select, textarea, a[href], [tabindex]:not([tabindex="-1"])';
const FIRST_REPEAT = 380;
const REPEAT = 130;

const usable = (el) => !el.disabled && el.tagName !== 'CANVAS' && !el.closest('[hidden], .kit-touch, .kit-menu') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** A selector that finds "the same" control again after its panel is re-rendered. */
export function identityOf(el) {
  if (!el || !el.dataset) return null;
  const esc = (v) => (window.CSS?.escape ? CSS.escape(v) : v);
  if (el.id) return `#${esc(el.id)}`;
  const d = el.dataset;
  if (d.action) {
    let sel = `[data-action="${esc(d.action)}"]`;
    for (const k of ['id', 'tab', 'venue', 'value']) if (d[k] != null) sel += `[data-${k}="${esc(d[k])}"]`;
    return sel;
  }
  if (el.name && el.form?.id) return `#${esc(el.form.id)} [name="${esc(el.name)}"]`;
  return null;
}

export function createPadNav({ input }) {
  let node = null;
  let identity = null;
  let lastRect = null;
  let heldDir = null;
  let repeatAt = 0;

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

  const scrollerOf = (el) => el?.closest('.panel-body, .modal') || null;
  const inView = (el, scroller) => {
    if (!scroller) return true;
    const a = el.getBoundingClientRect();
    const b = scroller.getBoundingClientRect();
    return a.bottom > b.top + 2 && a.top < b.bottom - 2;
  };
  const candidates = (root, from) => {
    const fromScroller = scrollerOf(from);
    return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
      if (el === from || !usable(el)) return false;
      if (!root.contains(el)) return false;
      const sc = scrollerOf(el);
      // Controls scrolled out of their panel are reachable only from inside that panel.
      return sc === fromScroller || inView(el, sc);
    });
  };
  const defaultIn = (root, modal) => {
    const list = candidates(root, null);
    if (modal) return list.find((el) => el.matches('.date-choice, .btn.primary')) || list[0] || null;
    return list.find((el) => el.closest('#sidebar') && el.matches('.btn.primary')) || list.find((el) => el.closest('#sidebar')) || list[0] || null;
  };

  /** Nearest control in a direction: distance along it, plus a penalty for sideways offset. */
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
      const s = Number(el.step) || 1;
      el.value = String(Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 100, Number(el.value) + dir * s)));
    } else if (el instanceof HTMLSelectElement) {
      el.selectedIndex = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + dir));
    } else if (el instanceof HTMLInputElement && (el.type === 'time' || el.type === 'number')) {
      const n = el.type === 'number' ? 5 : 1;
      try {
        if (dir > 0) el.stepUp(n);
        else el.stepDown(n);
      } catch {
        return false;
      }
    } else return false;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  /** Keep the place when a re-render replaced the focused control. */
  const restore = (root) => {
    if (!node) return;
    if (node.isConnected && root.contains(node)) return;
    const again = identity ? root.querySelector(identity) : null;
    if (again && usable(again)) {
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

  // Any pointer use hands focus back to the mouse or finger.
  addEventListener(
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
    /** Focus the natural first control of a root (a dialog that just opened). */
    focusDefault(root, modal) {
      focus(defaultIn(root, modal));
    },
    /**
     * @param {object} o
     * @param {HTMLElement} o.root   where navigation stays (the open dialog, or the whole page)
     * @param {boolean} o.modal
     * @param {{x:number,y:number}} o.dir
     * @param {boolean} o.confirm   the confirm button went down this frame
     */
    update({ root, modal, dir, confirm }) {
      if (node && !node.isConnected) restore(root);
      else if (node && (!root.contains(node) || !usable(node))) {
        // The layer changed (a dialog opened, or closed and hid its buttons): start again from
        // what has focus there, and never click a button that is no longer on screen.
        node.classList.remove('pad-focus');
        node = null;
        const active = document.activeElement;
        if (input.source === 'gamepad' && active && root.contains(active) && active.matches(FOCUSABLE) && usable(active)) mark(active);
      }
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
        const current = node && node.isConnected ? node : active && root.contains(active) && active.matches(FOCUSABLE) && usable(active) ? active : null;
        if (!current) focus(defaultIn(root, modal));
        else if ((d === 'left' || d === 'right') && adjust(current, d === 'right' ? 1 : -1)) mark(current);
        else {
          const next = step(root, current, ay ? 0 : ax, ay ? -ay : 0);
          if (next) focus(next);
          else mark(current);
        }
      }
      if (confirm) {
        const current = node && node.isConnected && root.contains(node) && usable(node) ? node : null;
        if (!current) {
          focus(defaultIn(root, modal));
          return true;
        }
        if (current instanceof HTMLSelectElement) adjust(current, current.selectedIndex >= current.options.length - 1 ? -current.selectedIndex : 1);
        else if (current instanceof HTMLInputElement && current.type === 'checkbox') current.click();
        else if (!(current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement)) current.click();
        input.rumble(0.12, 35);
        return true;
      }
      return false;
    },
    /** The scrolling panel the controller is in (right-stick scrolling), if any. */
    scroller(modalEl, modal) {
      if (modal) return modalEl;
      return node?.isConnected && usable(node) ? node.closest('.panel-body') : null;
    },
  };
}
