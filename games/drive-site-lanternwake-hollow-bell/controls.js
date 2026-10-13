/* Lanternwake: The Hollow Bell — input and mobile game mode.
 * The supplied My3D2dge Game owns input.tick(). Call update() once from scene.update().
 * Pinch/wheel onZoom receives a ratio (1.1 = 10% closer), not an absolute zoom.
 * aimType is "world" for mouseGround() and "direction" for the right pad stick.
 * The game owns automatic melee and all game-state changes.
 */
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const length = p => Math.hypot(p[0] || 0, p[1] || 0);
  const editable = e => e && (e.isContentEditable || e.tagName === 'TEXTAREA' ||
    e.tagName === 'SELECT' || (e.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(e.type)));

  class LanternControls {
    static bindings = {
      up: ['KeyW', 'ArrowUp', 'Pad12', 'PadAxisUp'],
      down: ['KeyS', 'ArrowDown', 'Pad13', 'PadAxisDown'],
      left: ['KeyA', 'ArrowLeft', 'Pad14', 'PadAxisLeft'],
      right: ['KeyD', 'ArrowRight', 'Pad15', 'PadAxisRight'],
      attack: ['KeyJ', 'KeyZ', 'Mouse0', 'Pad0'],
      dash: ['Space', 'KeyK', 'KeyX', 'Pad1', 'Pad5'],
      magic: ['KeyL', 'KeyC', 'Mouse2', 'Pad2', 'Pad7'],
      interact: ['KeyE', 'Enter', 'Pad3'],
      lockFacing: ['ShiftLeft', 'ShiftRight', 'Pad4'],
      pause: ['Escape', 'KeyP', 'Pad9'],
      map: ['KeyM', 'Tab', 'Pad17'],
      confirm: ['Enter', 'Space', 'KeyE', 'Pad0'],
      cancel: ['Escape', 'Backspace', 'Pad1']
    };

    constructor(engine, options = {}) {
      if (!engine || !engine.input || !engine.screen) throw new Error('LanternControls requires a My3D2dge Game.');
      this.engine = engine;
      this.input = engine.input;
      this.canvas = engine.screen.canvas;
      this.options = options;
      this.device = window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
      this.gameMode = false;
      this.modal = null;
      this.contextAvailable = false;
      this.pointers = new Map();
      this.buttonPointers = new Map();
      this.touchMove = [0, 0];
      this.origin = null;
      this.pinch = null;
      this._listeners = [];
      this._buttons = new Map();
      this._lastClock = -1;
      this._quietUntil = -1;
      this._gatePadMove = false;
      this._wakeLock = null;
      this._wakePending = null;
      this._nativeOwned = false;
      this._modeGeneration = 0;
      this._disposed = false;
      this._modalOptions = {};
      this._padFocus = null;

      // Keep engine keyboard/gamepad handling. Its visible, half-screen stick is replaced.
      this.input.touchEnabled = false;
      this.input.touchFilter = () => false;
      this.input._stickEnd({ pointerId: this.input.stickId });
      if (this.input._touchEl) this.input._touchEl.remove();
      if (this.input.stickEl) this.input.stickEl.style.display = 'none';
      if (this.input.knobEl) this.input.knobEl.style.display = 'none';
      this.canvas.style.touchAction = 'none';
      this.canvas.style.overscrollBehavior = 'none';
      this.canvas.style.webkitUserSelect = 'none';
      this.canvas.style.userSelect = 'none';

      this._on(this.canvas, 'pointerdown', e => this._pointerDown(e), { passive: false });
      this._on(this.canvas, 'pointermove', e => this._pointerMove(e), { passive: false });
      this._on(window, 'pointerup', e => this._pointerUp(e), { passive: false });
      this._on(window, 'pointercancel', () => this._cancelTouches(), { passive: false });
      this._on(this.canvas, 'lostpointercapture', e => this._pointerUp(e));
      this._on(this.canvas, 'wheel', e => {
        if (this.modal) return;
        e.preventDefault();
        this._setDevice('mouse');
        if (this.options.onZoom) this.options.onZoom(Math.exp(clamp(-e.deltaY * .0015, -.25, .25)), { source: 'wheel' });
      }, { passive: false });
      this._on(window, 'keydown', e => {
        // Do not let the engine consume browser shortcuts (for example Ctrl+L or Cmd+W).
        if ((e.ctrlKey || e.metaKey || e.altKey) && this.input.codes[e.code]) {
          e.stopImmediatePropagation();
          return;
        }
        if (editable(e.target)) return;
        if (this.input.codes[e.code]) this._setDevice('keyboard');
        if (this.modal && e.code === 'Tab') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this._focusStep(e.shiftKey ? -1 : 1);
          return;
        }
      }, true);
      this._on(window, 'blur', () => this.clear());
      this._on(document, 'visibilitychange', () => {
        this.clear();
        if (document.hidden) this._releaseWakeLock();
        else if (this.gameMode) this._acquireWakeLock();
      });
      this._on(document, 'fullscreenchange', () => this._fullscreenChanged());
      this._on(document, 'webkitfullscreenchange', () => this._fullscreenChanged());
      this._on(window, 'gamepaddisconnected', () => this.clear());
      this._on(window, 'resize', () => this._syncViewport());
      if (window.visualViewport) {
        this._on(window.visualViewport, 'resize', () => this._syncViewport());
        this._on(window.visualViewport, 'scroll', () => this._syncViewport(false));
      }
      this.bindButtons();
      this._syncViewport();
      this._setDevice(this.device, true);
    }

    _on(target, name, fn, options) {
      target.addEventListener(name, fn, options);
      this._listeners.push([target, name, fn, options]);
    }

    _setDevice(device, force = false) {
      if (!force && this.device === device) return;
      this.device = device;
      document.documentElement.dataset.inputDevice = device;
      this._updateFocusStyle();
      if (this.options.onDevice) this.options.onDevice(device);
    }

    _updateFocusStyle(target = document.activeElement) {
      if (this._padFocus) this._padFocus.classList.remove('gamepad-focus');
      this._padFocus = null;
      if (this.device === 'gamepad' && this.modal && target && this.modal.contains(target)) {
        target.classList.add('gamepad-focus');
        this._padFocus = target;
      }
    }

    bindButtons() {
      for (const action of ['dash', 'magic', 'interact']) {
        const b = document.getElementById('touch-' + action);
        if (!b || this._buttons.has(b)) continue;
        this._buttons.set(b, action);
        b.type = 'button';
        b.style.touchAction = 'none';
        b.style.userSelect = 'none';
        this._on(b, 'pointerdown', e => {
          if (this.modal || b.disabled || b.hidden || (action === 'interact' && !this.contextAvailable)) return;
          e.preventDefault();
          e.stopPropagation();
          this._setDevice(e.pointerType === 'mouse' ? 'mouse' : 'touch');
          this.buttonPointers.set(e.pointerId, { button: b, action, pointerType: e.pointerType });
          try { b.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
          b.classList.add('on');
          this.input.press('Act:' + action);
        }, { passive: false });
        const off = e => this._releaseButton(e.pointerId);
        this._on(b, 'pointerup', off);
        this._on(b, 'pointercancel', () => this._cancelTouches());
        this._on(b, 'lostpointercapture', off);
        this._on(b, 'click', e => {
          // Screen-reader activation has no pointerdown. Pointer clicks already ran above.
          if (e.detail !== 0 || this.modal || b.disabled || b.hidden) return;
          this.input.press('Act:' + action);
          this.input.release('Act:' + action);
        });
      }
    }

    _releaseButton(id) {
      const p = this.buttonPointers.get(id);
      if (!p) return;
      this.buttonPointers.delete(id);
      if (![...this.buttonPointers.values()].some(v => v.action === p.action)) this.input.release('Act:' + p.action);
      if (![...this.buttonPointers.values()].some(v => v.button === p.button)) p.button.classList.remove('on');
      try { if (p.button.hasPointerCapture(id)) p.button.releasePointerCapture(id); } catch (_) { /* already released */ }
    }

    _pointerDown(e) {
      if (e.pointerType === 'mouse') { this._setDevice('mouse'); return; }
      if (this.modal) return;
      e.preventDefault();
      this._setDevice('touch');
      this.input.lastDevice = 'touch';
      this.input.aimSource = 'move';
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* window listeners remain */ }
      if (this.pointers.size === 1) {
        this.origin = { id: e.pointerId, x: e.clientX, y: e.clientY };
        this.touchMove = [0, 0];
      } else this._beginPinch();
    }

    _beginPinch() {
      this.touchMove = [0, 0];
      this.origin = null;
      const points = [...this.pointers.entries()].slice(0, 2);
      if (points.length < 2) { this.pinch = null; return; }
      const d = Math.hypot(points[0][1].x - points[1][1].x, points[0][1].y - points[1][1].y);
      this.pinch = { ids: points.map(p => p[0]), distance: Math.max(12, d) };
    }

    _pointerMove(e) {
      if (e.pointerType === 'mouse') {
        if (Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0) > 1) this._setDevice('mouse');
        return;
      }
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch) {
        const a = this.pointers.get(this.pinch.ids[0]);
        const b = this.pointers.get(this.pinch.ids[1]);
        if (!a || !b) { this._beginPinch(); return; }
        const d = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
        const ratio = clamp(d / this.pinch.distance, .8, 1.25);
        this.pinch.distance = d;
        if (Math.abs(1 - ratio) > .002 && this.options.onZoom) this.options.onZoom(ratio, { source: 'pinch' });
        return;
      }
      if (!this.origin || this.origin.id !== e.pointerId) return;
      let x = e.clientX - this.origin.x, y = e.clientY - this.origin.y;
      const distance = Math.hypot(x, y);
      const radius = clamp(this.canvas.getBoundingClientRect().width * .11, 40, 62);
      const deadzone = 6;
      const strength = clamp((distance - deadzone) / (radius - deadzone), 0, 1);
      if (distance > radius * 1.45) {
        // The invisible origin follows a long thumb drag, so reversing does not need a long return path.
        this.origin.x = e.clientX - x / distance * radius * 1.45;
        this.origin.y = e.clientY - y / distance * radius * 1.45;
      }
      this.touchMove = distance > deadzone ? [x / distance * strength, y / distance * strength] : [0, 0];
    }

    _pointerUp(e) {
      this._releaseButton(e.pointerId);
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      try { if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId); } catch (_) { /* no capture */ }
      this.touchMove = [0, 0];
      this.origin = null;
      this.pinch = null;
      if (this.pointers.size >= 2) this._beginPinch();
      else if (this.pointers.size === 1) {
        const [id, p] = this.pointers.entries().next().value;
        this.origin = { id, x: p.x, y: p.y };
      }
    }

    _cancelTouches() {
      for (const id of [...this.buttonPointers.keys()]) this._releaseButton(id);
      const ids = [...this.pointers.keys()];
      this.pointers.clear();
      this.touchMove = [0, 0];
      this.origin = this.pinch = null;
      for (const id of ids) {
        try { if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id); } catch (_) { /* no capture */ }
      }
      for (const action of ['dash', 'magic', 'interact']) {
        this.input.release('Act:' + action);
        if (!this.input.down(action)) {
          this.input.fresh.delete(action);
          this.input.now.delete(action);
          this.input.consume(action);
        }
      }
    }

    clear() {
      this._gatePadMove = this._gatePadMove || length(this.input.padMove || [0, 0]) > .12;
      this._cancelTouches();
      this.input.clear();
      if (this.input.mouse) this.input.mouse.active = false;
      this._quietUntil = this.input.clock + .035;
    }

    setContextAvailable(available) {
      this.contextAvailable = !!available;
      const b = document.getElementById('touch-interact');
      if (!b) return;
      b.hidden = !this.contextAvailable;
      b.disabled = !this.contextAvailable;
      b.setAttribute('aria-hidden', String(!this.contextAvailable));
      if (!this.contextAvailable) {
        for (const [id, p] of this.buttonPointers) if (p.action === 'interact') this._releaseButton(id);
      }
    }

    /** Set a DOM menu to receive arrows, D-pad, stick, Cross/Enter, and Circle/Escape.
     * options.onCancel can close the menu. Without it, update() returns pause:true on cancel.
     * Call setModal(null) after closing the menu. Held actions cannot enter gameplay.
     */
    setModal(element, options = {}) {
      if (typeof element === 'string') element = document.querySelector(element);
      if (this.modal === element) return;
      this.clear();
      this.modal = element || null;
      this._modalOptions = options;
      if (this.modal) {
        const focus = this._focusables();
        const preferred = this.modal.querySelector('[autofocus], [data-default-focus]');
        const target = preferred && focus.includes(preferred) ? preferred : focus[0];
        if (target) target.focus({ preventScroll: true });
      } else if (document.activeElement && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      this._updateFocusStyle();
    }

    _focusables() {
      if (!this.modal) return [];
      return [...this.modal.querySelectorAll('button, input, select, a[href], [tabindex="0"]')].filter(el =>
        !el.disabled && !el.hidden && el.getAttribute('aria-hidden') !== 'true' &&
        !el.closest('[hidden], [inert]') && el.getClientRects().length > 0);
    }

    _focusStep(delta) {
      const items = this._focusables();
      if (!items.length) return;
      let index = items.indexOf(document.activeElement);
      if (index < 0) index = delta > 0 ? -1 : 0;
      const target = items[(index + delta + items.length) % items.length];
      target.focus({ preventScroll: true });
      this._updateFocusStyle(target);
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }

    _updateMenu() {
      const inp = this.input;
      const active = document.activeElement;
      const left = inp.repeat('left', .35, .12), right = inp.repeat('right', .35, .12);
      if (active && this.modal.contains(active) && active.tagName === 'INPUT' && active.type === 'range' && (left || right)) {
        const step = Number(active.step) || 1;
        const value = clamp(Number(active.value) + (right ? step : -step), Number(active.min) || 0, Number(active.max) || 100);
        active.value = String(value);
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (inp.repeat('up', .35, .12) || left) this._focusStep(-1);
      else if (inp.repeat('down', .35, .12) || right) this._focusStep(1);
      const cancel = inp.pressed('cancel') || inp.pressed('pause');
      const map = inp.pressed('map');
      if (cancel && this._modalOptions.onCancel) {
        this._modalOptions.onCancel();
        this.clear();
        return { pause: false, map: false };
      }
      if (inp.pressed('confirm')) {
        let target = document.activeElement;
        if (!target || !this.modal.contains(target) || target.disabled) target = this._focusables()[0];
        this.input.consumeAll();
        if (target && typeof target.click === 'function') target.click();
        this.clear();
      }
      return { pause: cancel, map };
    }

    _empty() {
      return { move: [0, 0], attack: false, attackPressed: false, dash: false, magic: false,
        interact: false, pause: false, map: false, lockFacing: false, aim: null, aimType: null, device: this.device };
    }

    update(dt) {
      const inp = this.input;
      const touching = this.pointers.size > 0 || [...this.buttonPointers.values()].some(pointer => pointer.pointerType !== 'mouse');
      if (touching) this._setDevice('touch');
      else if (inp.lastDevice === 'gamepad' && (length(inp.padMove || [0, 0]) > .08 || inp.padAim || [...inp.now].length)) this._setDevice('gamepad');
      if (this._gatePadMove && length(inp.padMove || [0, 0]) < .08) this._gatePadMove = false;
      const state = this._empty();
      if (this._disposed || document.hidden || this._lastClock === inp.clock) return state;
      this._lastClock = inp.clock;
      if (inp.clock < this._quietUntil) return state;
      if (this.modal) return Object.assign(state, this._updateMenu(), { menu: true });
      const move = this.pointers.size ? this.touchMove.slice() : inp.move();
      state.move = this._gatePadMove && !this.pointers.size ? [0, 0] : move;
      state.attack = inp.down('attack');
      state.attackPressed = inp.pressed('attack');
      state.dash = inp.pressed('dash');
      state.magic = inp.pressed('magic');
      state.interact = inp.pressed('interact');
      state.pause = inp.pressed('pause');
      state.map = inp.pressed('map');
      state.lockFacing = inp.down('lockFacing');
      if (this.device === 'gamepad' && inp.padAim) {
        state.aim = inp.padAim.slice();
        state.aimType = 'direction';
      } else if (this.device === 'mouse' && inp.mouse.active) {
        state.aim = this.engine.mouseGround();
        state.aimType = state.aim ? 'world' : null;
      }
      if (state.pause && this.options.onPause) this.options.onPause();
      if (state.map && this.options.onMap) this.options.onMap();
      if (state.interact && this.options.onInteract) this.options.onInteract();
      return state;
    }

    _syncViewport(resize = true) {
      const viewport = window.visualViewport;
      const root = document.documentElement;
      root.style.setProperty('--viewport-height', Math.round(viewport ? viewport.height : window.innerHeight) + 'px');
      root.style.setProperty('--viewport-width', Math.round(viewport ? viewport.width : window.innerWidth) + 'px');
      root.style.setProperty('--viewport-top', Math.round(viewport ? viewport.offsetTop : 0) + 'px');
      root.style.setProperty('--viewport-left', Math.round(viewport ? viewport.offsetLeft : 0) + 'px');
      if (resize && this.engine.screen.resize) this.engine.screen.resize();
    }

    get fullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
    get wakeLockActive() { return !!this._wakeLock && !this._wakeLock.released; }

    async enterGameMode() {
      if (this._disposed) return { active: false, fullscreen: false, wakeLock: false };
      if (this.gameMode) return { active: true, fullscreen: this.fullscreen, wakeLock: this.wakeLockActive };
      this.gameMode = true;
      const generation = ++this._modeGeneration;
      this._oldStyles = { htmlOverflow: document.documentElement.style.overflow,
        htmlOverscroll: document.documentElement.style.overscrollBehavior,
        bodyOverflow: document.body.style.overflow, bodyOverscroll: document.body.style.overscrollBehavior };
      document.documentElement.classList.add('game-mode');
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      const root = document.documentElement;
      const request = root.requestFullscreen || root.webkitRequestFullscreen;
      // Request synchronously, before any await: fullscreen needs the current user gesture.
      let fullscreenRequest = null;
      if (!this.fullscreen && request) {
        try { fullscreenRequest = Promise.resolve(request.call(root, { navigationUI: 'hide' })); }
        catch (_) { fullscreenRequest = null; }
      }
      const wakeRequest = this._acquireWakeLock();
      if (fullscreenRequest) {
        try {
          await fullscreenRequest;
          if (this.gameMode) this._nativeOwned = this.fullscreen;
          else if (generation !== this._modeGeneration && this.fullscreen) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) await exit.call(document);
          }
        }
        catch (_) { /* Safari/embedded pages retain a full-viewport game surface. */ }
      }
      await wakeRequest;
      if (generation !== this._modeGeneration) return { active: this.gameMode, fullscreen: this.fullscreen, wakeLock: this.wakeLockActive };
      this._syncViewport();
      this._notifyGameMode();
      return { active: this.gameMode, fullscreen: this.fullscreen, wakeLock: this.wakeLockActive };
    }

    async _acquireWakeLock() {
      if (!this.gameMode || document.hidden || !navigator.wakeLock || this.wakeLockActive) return;
      if (this._wakePending) return this._wakePending;
      this._wakePending = (async () => {
        try {
          const lock = await navigator.wakeLock.request('screen');
          if (!this.gameMode || document.hidden || this._disposed) { await lock.release(); return; }
          this._wakeLock = lock;
          lock.addEventListener('release', () => {
            if (this._wakeLock === lock) this._wakeLock = null;
            this._notifyGameMode();
          });
        } catch (_) { /* Power settings, browser policy, or frame policy may reject it. */ }
        finally { this._wakePending = null; }
      })();
      return this._wakePending;
    }

    async _releaseWakeLock() {
      const lock = this._wakeLock;
      this._wakeLock = null;
      if (lock) { try { await lock.release(); } catch (_) { /* system already released it */ } }
    }

    _notifyGameMode() {
      if (this.options.onGameMode) this.options.onGameMode(this.gameMode, { fullscreen: this.fullscreen, wakeLock: this.wakeLockActive });
    }

    _fullscreenChanged() {
      if (this.fullscreen && this.gameMode) this._nativeOwned = true;
      else if (this._nativeOwned && this.gameMode) {
        this._nativeOwned = false;
        this.leaveGameMode(false);
      }
      this._syncViewport();
    }

    async leaveGameMode(exitFullscreen = true) {
      const owned = this._nativeOwned;
      this._nativeOwned = false;
      this.gameMode = false;
      const generation = ++this._modeGeneration;
      this.clear();
      document.documentElement.classList.remove('game-mode');
      if (this._oldStyles) {
        document.documentElement.style.overflow = this._oldStyles.htmlOverflow;
        document.documentElement.style.overscrollBehavior = this._oldStyles.htmlOverscroll;
        document.body.style.overflow = this._oldStyles.bodyOverflow;
        document.body.style.overscrollBehavior = this._oldStyles.bodyOverscroll;
        this._oldStyles = null;
      }
      await this._releaseWakeLock();
      if (exitFullscreen && owned && this.fullscreen && !this.gameMode && generation === this._modeGeneration) {
        try {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) await exit.call(document);
        } catch (_) { /* the browser can leave fullscreen independently */ }
      }
      this._syncViewport();
      this._notifyGameMode();
    }

    dispose() {
      this._disposed = true;
      this.leaveGameMode();
      for (const [target, name, fn, options] of this._listeners) target.removeEventListener(name, fn, options);
      this._listeners.length = 0;
    }
  }

  window.LanternControls = LanternControls;
})();
