/* Pointer ownership keeps two thumbs independent and clears every held action. */
(function (root) {
  'use strict';
  class TouchControls {
    constructor(buttons, input, enabled = () => true) {
      this.input = input; this.enabled = enabled; this.active = new Map();
      this.buttons = Array.from(buttons);
      for (const button of this.buttons) {
        button.addEventListener('pointerdown', event => {
          if (event.button > 0 || !this.enabled()) return;
          event.preventDefault();
          this.press(event.pointerId, button);
          try { button.setPointerCapture(event.pointerId); } catch {}
        });
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
          button.addEventListener(name, event => this.release(event.pointerId));
        }
        button.addEventListener('contextmenu', event => event.preventDefault());
        button.addEventListener('keydown', event => {
          if (!['Space', 'Enter'].includes(event.code) || !this.enabled()) return;
          event.preventDefault(); event.stopPropagation();
          this.press('key:' + event.code, button);
        });
        button.addEventListener('keyup', event => {
          if (!['Space', 'Enter'].includes(event.code)) return;
          event.preventDefault(); event.stopPropagation(); this.release('key:' + event.code);
        });
        button.addEventListener('blur', () => {
          for (const [id, held] of this.active) if (held === button && typeof id === 'string') this.release(id);
        });
      }
    }
    press(id, button) {
      if (this.active.has(id)) return;
      const code = button.dataset.code;
      const alreadyHeld = [...this.active.values()].some(b => b.dataset.code === code);
      this.active.set(id, button); button.classList.add('held');
      if (!alreadyHeld) this.input.press(code);
    }
    release(id) {
      const button = this.active.get(id); if (!button) return;
      this.active.delete(id);
      if (typeof id === 'number') try { if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id); } catch {}
      if (![...this.active.values()].some(b => b.dataset.code === button.dataset.code)) {
        this.input.release(button.dataset.code); button.classList.remove('held');
      }
    }
    clear() {
      for (const id of [...this.active.keys()]) this.release(id);
      for (const button of this.buttons) button.classList.remove('held');
    }
  }
  root.BrasslineTouch = TouchControls;
  if (typeof module !== 'undefined' && module.exports) module.exports = TouchControls;
})(globalThis);
