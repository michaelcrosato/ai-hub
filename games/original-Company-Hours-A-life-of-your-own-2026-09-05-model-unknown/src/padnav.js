/* Company Hours — controller (D-pad) and arrow-key navigation for the game's DOM interface.
   Moves focus between controls by direction, adjusts selects, ranges and number fields with
   left/right, presses with A, follows ARIA tabs, and keeps its place when a panel re-renders.
   It reads kit.input actions only and owns no device listeners of its own. */

const FOCUSABLE = 'button, input:not([type="hidden"]):not([type="file"]), select, textarea, a[href]';
const FIRST_REPEAT = 380;
const REPEAT = 130;

const usable = (el) =>
  !el.disabled &&
  el.tagName !== 'CANVAS' &&
  !el.closest('[hidden], [inert], .kit-touch, .kit-menu') &&
  el.getClientRects().length > 0 &&
  getComputedStyle(el).visibility !== 'hidden';

/** A selector that finds "the same" control again after its panel is re-rendered. */
function identityOf(el) {
  if (!el || !el.dataset) return null;
  const esc = (v) => (window.CSS?.escape ? CSS.escape(v) : String(v).replace(/"/g, '\\"'));
  if (el.id) return `#${esc(el.id)}`;
  const d = el.dataset;
  if (d.act) {
    let sel = `[data-act="${esc(d.act)}"]`;
    for (const k of ['id', 'panel', 'section', 'tab', 'speed', 'dir', 'dev', 'field', 'color']) if (d[k] != null) sel += `[data-${k}="${esc(d[k])}"]`;
    return sel;
  }
  if (d.setting) return `[data-setting="${esc(d.setting)}"]`;
  if (d.support) return `[data-support="${esc(d.support)}"]`;
  if (el.name && el.form?.dataset?.form) return `[data-form="${esc(el.form.dataset.form)}"] [name="${esc(el.name)}"]`;
  return null;
}

export function createPadNav({ input, onMove }) {
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

  const scrollerOf = (el) => el?.closest('.panel-body, .modal, .date-panel, .setup-content') || null;
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
      const sc = scrollerOf(el);
      // Controls scrolled out of their panel are reachable only from inside that panel.
      return sc === fromScroller || inView(el, sc);
    });
  };
  const defaultIn = (root, prefer) => {
    const list = candidates(root, null);
    if (prefer) {
      const hit = list.find((el) => el.matches(prefer));
      if (hit) return hit;
    }
    return list[0] || null;
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

  /** Left/right changes the value of sliders, selects and number fields. */
  const adjust = (el, dir) => {
    if (el instanceof HTMLInputElement && el.type === 'range') {
      const s = Number(el.step) || 1;
      el.value = String(Math.max(Number(el.min) || 0, Math.min(Number(el.max) || 100, Number(el.value) + dir * s)));
    } else if (el instanceof HTMLSelectElement) {
      let i = el.selectedIndex;
      do i += dir;
      while (i >= 0 && i < el.options.length && el.options[i].disabled);
      if (i < 0 || i >= el.options.length) return true;
      el.selectedIndex = i;
    } else if (el instanceof HTMLInputElement && el.type === 'number') {
      try {
        if (dir > 0) el.stepUp(Number(el.step) >= 5 ? 1 : 5);
        else el.stepDown(Number(el.step) >= 5 ? 1 : 5);
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
    restore,
    /** Focus the natural first control of a root (a dialog that just opened). */
    focusDefault(root, prefer) {
      focus(defaultIn(root, prefer));
    },
    /**
     * One frame of navigation.
     * @param {object} o
     * @param {HTMLElement} o.root   where navigation stays (the open dialog, or the whole game)
     * @param {string} [o.prefer]    selector for the first control to land on
     * @param {{x:number,y:number}} o.dir   D-pad / arrows / stick, y up
     * @param {boolean} o.confirm    A went down this frame
     * @returns {boolean} whether it used the input
     */
    update({ root, prefer, dir, confirm }) {
      if (node && !node.isConnected) restore(root);
      else if (node && (!root.contains(node) || !usable(node))) {
        // The layer changed (a dialog opened or closed): start again from what has focus there.
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
      let used = false;
      if (fire) {
        used = true;
        const active = document.activeElement;
        const current = node && node.isConnected ? node : active && active !== document.body && root.contains(active) && active.matches(FOCUSABLE) && usable(active) ? active : null;
        if (!current) focus(defaultIn(root, prefer));
        else if ((d === 'left' || d === 'right') && current.getAttribute('role') === 'tab') {
          // ARIA tabs: left/right moves to the neighbouring tab and shows it.
          const tabs = [...current.parentElement.querySelectorAll('[role="tab"]')];
          const next = tabs[(tabs.indexOf(current) + (d === 'right' ? 1 : tabs.length - 1)) % tabs.length];
          identity = identityOf(next);
          next.click();
          const again = identity && root.querySelector(identity);
          if (again) focus(again);
        } else if ((d === 'left' || d === 'right') && adjust(current, d === 'right' ? 1 : -1)) mark(current);
        else {
          const next = step(root, current, ay ? 0 : ax, ay ? -ay : 0);
          if (next) focus(next);
          else mark(current);
        }
        onMove?.();
      }
      if (confirm) {
        used = true;
        const current = node && node.isConnected && root.contains(node) && usable(node) ? node : null;
        if (!current) {
          focus(defaultIn(root, prefer));
          return true;
        }
        if (current instanceof HTMLSelectElement) {
          // A cycles through the enabled options, wrapping round.
          const n = current.options.length;
          for (let k = 1; k <= n; k++) {
            const i = (current.selectedIndex + k) % n;
            if (!current.options[i].disabled) {
              current.selectedIndex = i;
              current.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }
        else if (current instanceof HTMLInputElement && current.type === 'checkbox') current.click();
        else if (!(current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement)) current.click();
        input.rumble(0.12, 35);
      }
      return used;
    },
  };
}
