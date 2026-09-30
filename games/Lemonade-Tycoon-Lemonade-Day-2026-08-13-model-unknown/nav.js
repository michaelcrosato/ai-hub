/**
 * nav.js — drive the game's DOM menus from kit.input actions, so every panel
 * works with a gamepad (D-pad or stick to move, A to press) and with the
 * arrow keys. Focus moves spatially inside the top-most open layer; a focused
 * slider takes left and right as value changes.
 */

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"])';
const FIRST_DELAY = 0.38;
const REPEAT = 0.11;

const isVisible = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert]');

export function createNav({ onMove } = {}) {
  let held = null;
  let holdTime = 0;
  let repeatAt = 0;
  let lastFocused = null;

  addEventListener('focusin', (e) => {
    if (e.target instanceof HTMLElement && e.target.matches(FOCUSABLE)) lastFocused = e.target;
  });
  addEventListener('focusout', (e) => e.target?.classList?.remove('pad-focus'));

  function layers() {
    return [...document.querySelectorAll('[data-layer]')].filter(isVisible);
  }
  function top() {
    const list = layers();
    return list[list.length - 1] || null;
  }
  function focusables(layer) {
    return [...layer.querySelectorAll(FOCUSABLE)].filter(isVisible);
  }
  function focus(el) {
    try {
      el.focus({ preventScroll: true, focusVisible: true });
    } catch {
      el.focus();
    }
    el.classList.add('pad-focus');
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function move(dir) {
    const layer = top();
    if (!layer) return;
    const list = focusables(layer);
    if (!list.length) return;
    let cur = document.activeElement;
    const valid = cur && cur !== document.body && layer.contains(cur) && list.includes(cur);
    if (valid && cur.type === 'range' && (dir === 'left' || dir === 'right')) {
      if (dir === 'left') cur.stepDown();
      else cur.stepUp();
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      cur.dispatchEvent(new Event('change', { bubbles: true }));
      onMove?.();
      return;
    }
    // A button that just became disabled loses focus: continue from where it was.
    if (!valid) cur = lastFocused && lastFocused.isConnected && layer.contains(lastFocused) && lastFocused.getClientRects().length ? lastFocused : null;
    if (!cur) {
      focus(list[0]);
      onMove?.();
      return;
    }
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect();
      const dx = b.left + b.width / 2 - ax;
      const dy = b.top + b.height / 2 - ay;
      let primary;
      let secondary;
      if (dir === 'right' || dir === 'left') {
        const ahead = dir === 'right' ? b.left >= a.right - 4 || dx > a.width / 2 : b.right <= a.left + 4 || -dx > a.width / 2;
        if (!ahead) continue;
        primary = Math.abs(dx);
        const overlap = b.top < a.bottom && b.bottom > a.top;
        secondary = overlap ? 0 : Math.abs(dy);
      } else {
        const ahead = dir === 'down' ? b.top >= a.bottom - 4 || dy > a.height / 2 : b.bottom <= a.top + 4 || -dy > a.height / 2;
        if (!ahead) continue;
        primary = Math.abs(dy);
        const overlap = b.left < a.right && b.right > a.left;
        secondary = overlap ? Math.abs(dx) * 0.2 : Math.abs(dx);
      }
      const score = primary + secondary * 3;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    if (best) {
      focus(best);
      onMove?.();
    }
  }

  /**
   * Press the focused control (gamepad A). With nothing focused, pick up where
   * the player last was in this panel (Enter after a mouse click lands back on
   * that control), or on the panel's first control.
   */
  function activate() {
    const layer = top();
    if (!layer) return;
    const cur = document.activeElement;
    if (cur && cur !== document.body && layer.contains(cur) && cur.matches(FOCUSABLE)) {
      if (cur.type !== 'range') cur.click();
      return;
    }
    if (lastFocused && layer.contains(lastFocused) && lastFocused.matches(FOCUSABLE) && isVisible(lastFocused)) {
      focus(lastFocused);
      return;
    }
    const list = focusables(layer);
    if (list.length) focus(list[0]);
  }

  /** Call every frame with the menu direction vector ({x, y}, y up). */
  function update(dt, v) {
    let dir = null;
    if (Math.abs(v.x) > 0.5 || Math.abs(v.y) > 0.5) dir = Math.abs(v.x) > Math.abs(v.y) ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
    if (dir !== held) {
      held = dir;
      holdTime = 0;
      repeatAt = FIRST_DELAY;
      if (dir) move(dir);
      return;
    }
    if (!dir) return;
    holdTime += dt;
    if (holdTime >= repeatAt) {
      repeatAt += REPEAT;
      move(dir);
    }
  }

  /** Scroll the top layer's scrolling panel (right stick in menus). */
  function scroll(px) {
    if (!px) return;
    const layer = top();
    if (!layer) return;
    const box = [layer, ...layer.querySelectorAll('.utility-modal, .result-modal, .tutorial-modal, .planner-scroll')].find((el) => el.scrollHeight > el.clientHeight + 2 && isVisible(el));
    if (box) box.scrollTop += px;
  }

  return { top, focusables, focus, move, activate, update, scroll, isVisible };
}
