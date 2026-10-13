/* Wayfarer: The Glass Tide — controls and browser game mode.
 * Uses my-3D2dge input for keyboard, mouse, and standard gamepads.
 * Touch movement is an invisible stick that starts at any free canvas point.
 */
(function (root) {
  'use strict';

  const INPUT = Object.freeze({
    up: ['KeyW', 'ArrowUp', 'Pad12', 'PadAxisUp'],
    down: ['KeyS', 'ArrowDown', 'Pad13', 'PadAxisDown'],
    left: ['KeyA', 'ArrowLeft', 'Pad14', 'PadAxisLeft'],
    right: ['KeyD', 'ArrowRight', 'Pad15', 'PadAxisRight'],
    attack: ['KeyJ', 'Space', 'Mouse0', 'Pad0'],
    art: ['KeyK', 'Mouse2', 'Pad2'],
    dodge: ['KeyL', 'ShiftLeft', 'ShiftRight', 'Pad1'],
    interact: ['KeyE', 'Enter', 'NumpadEnter', 'Pad0'],
    switch: ['KeyQ', 'Pad4'],
    link: ['KeyR', 'Pad3'],
    menu: ['Escape', 'Tab', 'Pad9'],
    heal: ['KeyH', 'Pad5'],
    map: ['KeyM'],
    fullscreen: ['KeyF'],
    confirm: ['Enter', 'NumpadEnter', 'Space', 'Pad0'],
    cancel: ['Escape', 'Backspace', 'Pad1'],
    start: ['Enter', 'NumpadEnter', 'Pad9']
  });

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const isElement = node => node && typeof node.closest === 'function';

  class WayfarerControls {
    constructor(game, options = {}) {
      if (!game || !game.input || !game.screen) throw new Error('WayfarerControls needs an E.Game.');
      this.game = game;
      this.input = game.input;
      this.canvas = game.screen.canvas;
      this.options = options;
      this.root = options.root || document;
      this._listeners = [];
      this._pointers = new Map();
      this._buttons = new Map();
      this._sources = new Map();
      this._claims = new Map();
      this._keyboardButtons = new Map();
      this._recentClicks = new WeakMap();
      this._serial = 0;
      this._moveId = null;
      this._pinch = null;
      this._mode = false;
      this._paused = false;
      this._wakeLock = null;
      this._wakePending = null;
      this._savedStyles = null;
      this._destroyed = false;
      this._coarse = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
      this._device = this._coarse ? 'touch' : (this.input.lastDevice || 'keyboard');
      this.input.lastDevice = this._device;

      // The native pointer listeners remain in use for the mouse. Touch is owned
      // here so the engine never creates a visible, half-screen joystick.
      this._wasTouchEnabled = this.input.touchEnabled;
      this.input.touchEnabled = false;
      this.input.stickOn = false;
      this.input.stick = [0, 0];
      if (this.input.stickEl) this.input.stickEl.style.display = 'none';
      if (this.input.knobEl) this.input.knobEl.style.display = 'none';
      this.canvas.style.touchAction = 'none';

      // Record the source of native input without replacing its key or pad logic.
      // A shared Cross press can belong to interaction OR attack until release.
      const owner = this;
      this._nativePress = this.input.press;
      this._pressWrapper = function (code) {
        if (!this.held.has(code)) {
          const source = { code, serial: ++owner._serial };
          owner._claims.delete(code);
          for (const action of this.codes[code] || []) owner._sources.set(action, source);
        }
        return owner._nativePress.call(this, code);
      };
      this.input.press = this._pressWrapper;

      this._listen(this.canvas, 'pointerdown', e => this._canvasDown(e));
      this._listen(this.canvas, 'pointermove', e => this._canvasMove(e));
      this._listen(root, 'pointerup', e => this._pointerEnd(e));
      this._listen(root, 'pointercancel', e => this._pointerEnd(e));
      this._listen(root, 'lostpointercapture', e => this._pointerEnd(e), true);
      this._listen(this.canvas, 'lostpointercapture', e => this._pointerEnd(e));
      this._listen(this.root, 'pointerdown', e => this._buttonDown(e));
      this._listen(this.root, 'click', e => this._buttonClick(e));
      this._listen(this.root, 'keydown', e => this._buttonKeyDown(e), true);
      this._listen(root, 'keyup', e => this._buttonKeyUp(e), true);
      this._listen(root, 'blur', () => this._focusLost('blur'));
      this._listen(document, 'visibilitychange', () => {
        if (document.hidden) this._focusLost('visibility');
        else if (this._mode && !this._paused) this._requestWakeLock();
      });
      const preventGesture = e => {
        if (this._mode && e.cancelable) e.preventDefault();
      };
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
        this._listen(document, type, preventGesture, { passive: false });
      }
      for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
        this._listen(this.canvas, type, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
      }
      this._listen(this.canvas, 'dblclick', e => e.preventDefault());
      this._listen(document, 'fullscreenchange', () => game.screen.resize());
    }

    static get INPUT() { return INPUT; }
    get device() { return this._device; }
    get touch() { return this._device === 'touch'; }
    get gameMode() { return this._mode; }
    get fullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
    get pinching() { return !!this._pinch; }

    _listen(target, name, handler, options) {
      target.addEventListener(name, handler, options);
      this._listeners.push([target, name, handler, options]);
    }

    _setDevice(device) {
      if (!device || device === this._device) return;
      this._device = device;
      if (this.options.onDevice) this.options.onDevice(device);
    }

    /** Call once at the start of each game update, after the engine ticks input. */
    update() {
      this._setDevice(this.input.lastDevice);
      for (const code of this._claims.keys()) if (!this.input.held.has(code)) this._claims.delete(code);
      if (this.options.onPause && this.pressed('menu')) this.options.onPause('input');
    }

    move() { return this._pinch ? [0, 0] : this.input.move(); }

    /** Buffered one-shot. This consumes the physical press, including its aliases. */
    pressed(action, seconds = .18) {
      if (!this.input.map[action] || !this.input.buffered(action, seconds)) return false;
      const source = this._sources.get(action);
      const claimed = source && this._claims.get(source.code);
      if (claimed && claimed !== action) { this.input.consume(action); return false; }
      this.input.consume(action);
      if (source) {
        this._claims.set(source.code, action);
        for (const [alias, other] of this._sources) if (other === source) this.input.consume(alias);
      }
      return true;
    }

    /** Held input respects an earlier claim by a contextual action. */
    down(action) {
      if (!this.input.map[action] || !this.input.down(action)) return false;
      return this.input.map[action].some(code => this.input.held.has(code) &&
        (!this._claims.has(code) || this._claims.get(code) === action));
    }

    _canvasDown(e) {
      if (e.pointerType === 'mouse' || !e.pointerType) return;
      if (e.cancelable) e.preventDefault();
      this.input.lastDevice = 'touch';
      this.input.aimSource = 'move';
      this._setDevice('touch');
      const p = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
      this._pointers.set(e.pointerId, p);
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* Pointer was cancelled. */ }
      if (this._pointers.size === 1) {
        this._moveId = e.pointerId;
        this.input.stickOn = true;
        this.input.stick = [0, 0];
      } else this._beginPinch();
    }

    _beginPinch() {
      const pair = Array.from(this._pointers.values()).slice(0, 2);
      if (pair.length < 2) return;
      this._pinch = {
        ids: pair.map(p => p.id),
        distance: Math.max(12, Math.hypot(pair[1].x - pair[0].x, pair[1].y - pair[0].y)),
        zoom: this.game.zoom || 1
      };
      this.input.stickOn = false;
      this.input.stick = [0, 0];
    }

    _canvasMove(e) {
      const p = this._pointers.get(e.pointerId);
      if (!p) return;
      if (e.cancelable) e.preventDefault();
      p.x = e.clientX; p.y = e.clientY;
      if (this._pinch) {
        const [a, b] = this._pinch.ids.map(id => this._pointers.get(id));
        if (!a || !b) { this._beginPinch(); return; }
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const zoom = clamp(Math.round(this._pinch.zoom * distance / this._pinch.distance * 16) / 16, .75, 1.5);
        if (zoom !== this.game.zoom) {
          this.game.setZoom(zoom);
          if (this.options.onZoom) this.options.onZoom(zoom);
        }
        return;
      }
      if (e.pointerId !== this._moveId) return;
      const rect = this.canvas.getBoundingClientRect();
      const radius = clamp(Math.min(rect.width, rect.height) * .12, 38, 68);
      let dx = p.x - p.ox, dy = p.y - p.oy, length = Math.hypot(dx, dy);
      if (length > radius) {
        p.ox = p.x - dx / length * radius;
        p.oy = p.y - dy / length * radius;
        dx = p.x - p.ox; dy = p.y - p.oy; length = radius;
      }
      const strength = clamp((length - 5) / (radius - 5), 0, 1);
      this.input.stickOn = true;
      this.input.stick = length > 0 ? [dx / length * strength, dy / length * strength] : [0, 0];
    }

    _pointerEnd(e) {
      const button = this._buttons.get(e.pointerId);
      if (button) {
        this._buttons.delete(e.pointerId);
        this._releaseButton(button);
      }
      if (!this._pointers.delete(e.pointerId)) return;
      if (this._pointers.size >= 2) { this._beginPinch(); return; }
      this._pinch = null;
      const remaining = this._pointers.values().next().value;
      this._moveId = remaining ? remaining.id : null;
      this.input.stickOn = !!remaining;
      this.input.stick = [0, 0];
      if (remaining) { remaining.ox = remaining.x; remaining.oy = remaining.y; }
    }

    _buttonFor(e) {
      const el = isElement(e.target) ? e.target.closest('[data-action]') : null;
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
      if (this.root !== document && !this.root.contains(el)) return null;
      return el;
    }

    _activate(el, e, source) {
      const action = el.dataset.action;
      if (!action) return { el, action, native: false };
      const code = 'Act:' + action;
      const native = !!this.input.map[action];
      this.input.lastDevice = source;
      this._setDevice(source);
      // Return true from onAction when the application handles this UI command.
      // Otherwise a mapped action enters the native input queue exactly once.
      const handled = this.options.onAction ? this.options.onAction(action, { source, event: e, element: el }) : false;
      const useNative = native && handled !== true && !(handled && typeof handled.then === 'function');
      if (useNative) this.input.press(code);
      // The engine treats Act: as touch. Preserve the actual source for hints.
      this.input.lastDevice = source;
      el.classList.add('is-pressed');
      el.setAttribute('data-pressed', 'true');
      this._recentClicks.set(el, performance.now());
      return { el, action, native: useNative };
    }

    _buttonDown(e) {
      const el = this._buttonFor(e);
      if (!el || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      const source = e.pointerType && e.pointerType !== 'mouse' ? 'touch' : 'mouse';
      const button = this._activate(el, e, source);
      this._buttons.set(e.pointerId, button);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* Pointer was cancelled. */ }
    }

    _releaseButton(button) {
      const held = Array.from(this._buttons.values()).concat(Array.from(this._keyboardButtons.values()));
      if (button.native && !held.some(b => b.native && b.action === button.action)) this.input.release('Act:' + button.action);
      if (!held.some(b => b.el === button.el)) {
        button.el.classList.remove('is-pressed');
        button.el.removeAttribute('data-pressed');
      }
    }

    _buttonClick(e) {
      const el = this._buttonFor(e);
      if (!el) return;
      // Pointer activation already ran on press. This also handles assistive clicks.
      if (performance.now() - (this._recentClicks.get(el) || -1000) < 600) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (e.cancelable) e.preventDefault();
      const button = this._activate(el, e, 'keyboard');
      this._releaseButton(button);
    }

    _buttonKeyDown(e) {
      const el = this._buttonFor(e);
      if (!el || !['Enter', 'NumpadEnter', 'Space'].includes(e.code)) return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat || this._keyboardButtons.has(e.code)) return;
      this.input.lastDevice = 'keyboard';
      this._setDevice('keyboard');
      this._keyboardButtons.set(e.code, this._activate(el, e, 'keyboard'));
    }

    _buttonKeyUp(e) {
      const button = this._keyboardButtons.get(e.code);
      if (!button) return;
      e.preventDefault(); e.stopPropagation();
      this._keyboardButtons.delete(e.code);
      this._releaseButton(button);
    }

    _focusLost(reason) {
      this.clear();
      this._releaseWakeLock();
      if (this._mode && !this._paused && this.options.onPause) {
        this._paused = true;
        this.options.onPause(reason);
      }
    }

    clear() {
      const buttons = Array.from(this._buttons.values()).concat(Array.from(this._keyboardButtons.values()));
      for (const button of buttons) {
        button.el.classList.remove('is-pressed');
        button.el.removeAttribute('data-pressed');
      }
      this._buttons.clear(); this._keyboardButtons.clear(); this._pointers.clear();
      this._sources.clear(); this._claims.clear();
      this._moveId = null; this._pinch = null;
      this.input.stickOn = false; this.input.stick = [0, 0];
      this.input.clear();
    }

    _containPage(on) {
      const elements = [document.documentElement, document.body].filter(Boolean);
      if (on && !this._savedStyles) {
        this._savedStyles = elements.map(el => [el, el.style.overflow, el.style.overscrollBehavior]);
        for (const el of elements) {
          el.style.overflow = 'hidden'; el.style.overscrollBehavior = 'none';
          el.classList.add('wayfarer-game-mode');
        }
      } else if (!on && this._savedStyles) {
        for (const [el, overflow, overscroll] of this._savedStyles) {
          el.style.overflow = overflow; el.style.overscrollBehavior = overscroll;
          el.classList.remove('wayfarer-game-mode');
        }
        this._savedStyles = null;
      }
    }

    async _requestWakeLock() {
      if (!this._mode || this._paused || document.hidden || !navigator.wakeLock) return false;
      if (this._wakeLock && !this._wakeLock.released) return true;
      if (this._wakePending) return this._wakePending;
      this._wakePending = (async () => {
        try {
          const lock = await navigator.wakeLock.request('screen');
          if (!this._mode || this._paused || document.hidden || this._destroyed) { await lock.release(); return false; }
          this._wakeLock = lock;
          lock.addEventListener('release', () => { if (this._wakeLock === lock) this._wakeLock = null; });
          return true;
        } catch (error) { this.lastWakeLockError = error.name || String(error); return false; }
        finally { this._wakePending = null; }
      })();
      return this._wakePending;
    }

    async _releaseWakeLock() {
      const lock = this._wakeLock; this._wakeLock = null;
      if (lock && !lock.released) try { await lock.release(); } catch (_) { /* Already released. */ }
    }

    /** Call from an explicit Start/Resume button. Failure leaves a full-window game. */
    async enterGameMode({ fullscreen = true } = {}) {
      this._mode = true; this._paused = false;
      this.clear(); this._containPage(true);
      const target = this.options.fullscreenElement || document.documentElement;
      const request = target.requestFullscreen || target.webkitRequestFullscreen;
      let fullscreenTask = Promise.resolve();
      if (fullscreen && !this.fullscreen && request) {
        try {
          // Invoke before any await, while the Start button has user activation.
          fullscreenTask = Promise.resolve(request.call(target, { navigationUI: 'hide' }));
        } catch (error) { this.lastFullscreenError = error.name || String(error); }
      }
      const wakeTask = this._requestWakeLock();
      try { await fullscreenTask; } catch (error) { this.lastFullscreenError = error.name || String(error); }
      await wakeTask;
      this.game.screen.resize();
      return { gameMode: true, fullscreen: this.fullscreen, wakeLock: !!this._wakeLock };
    }

    /** Pause keeps fullscreen active, but releases the screen wake lock. */
    setPaused(paused) {
      this._paused = !!paused;
      this.clear();
      if (this._paused) this._releaseWakeLock();
      else if (this._mode) this._requestWakeLock();
    }

    async toggleFullscreen() {
      if (!this.fullscreen) return this.enterGameMode();
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) try { await exit.call(document); } catch (error) { this.lastFullscreenError = error.name || String(error); }
      this.game.screen.resize();
      return { gameMode: this._mode, fullscreen: this.fullscreen, wakeLock: !!this._wakeLock };
    }

    /** Leave browser game mode. Pass exitFullscreen:true for an explicit Exit command. */
    async leaveGameMode({ exitFullscreen = false } = {}) {
      this._mode = false; this._paused = false;
      this.clear(); this._containPage(false);
      await this._releaseWakeLock();
      if (exitFullscreen && this.fullscreen) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) try { await exit.call(document); } catch (_) { /* Browser refused. */ }
      }
      this.game.screen.resize();
    }

    destroy() {
      this._destroyed = true;
      this.leaveGameMode();
      for (const [target, name, handler, options] of this._listeners) target.removeEventListener(name, handler, options);
      this._listeners.length = 0;
      if (this.input.press === this._pressWrapper) this.input.press = this._nativePress;
      this.input.touchEnabled = this._wasTouchEnabled;
    }
  }

  root.WayfarerControls = WayfarerControls;
})(typeof window !== 'undefined' ? window : globalThis);
