/**
 * Game mode uses the available viewport on every device. Native fullscreen is
 * an optional enhancement. The original click starts that request immediately.
 * The controller never locks orientation or disables page zoom.
 */
export class GameDisplay {
  constructor({ onResize, onModeChange, onSuspend, isPlaying } = {}) {
    this._root = document.documentElement;
    this._body = document.body;
    this._onResize = onResize;
    this._onModeChange = onModeChange;
    this._onSuspend = onSuspend;
    this._isPlaying = typeof isPlaying === 'function' ? isPlaying : null;
    this._playing = false;
    this._destroyed = false;
    this._active = this.native;
    this._lastNative = this.native;
    this._nativeRequested = false;
    this._fullscreenPending = null;
    this._listeners = [];
    this._frame = 0;
    this._lastResize = null;
    this._lastMode = null;
    this._orientationPending = false;
    this._orientationKey = this._readOrientationKey();
    this._wake = null;
    this._wakePending = null;
    this._wakeGeneration = 0;
    this._wakeRefused = false;
    this._coarse = window.matchMedia?.('(pointer: coarse)');
    this._oldHeight = this._root.style.getPropertyValue('--app-height');
    this._oldWidth = this._root.style.getPropertyValue('--app-width');
    this._size = this._measure();

    this._listen(window, 'resize', () => this.refresh());
    this._listen(window.visualViewport, 'resize', () => this.refresh());
    this._listen(window.visualViewport, 'scroll', () => this.refresh());
    const orientationChanged = () => {
      this._orientationPending = true;
      this.refresh();
    };
    this._listen(window.screen?.orientation, 'change', orientationChanged);
    this._listen(window, 'orientationchange', orientationChanged);
    this._listen(document, 'fullscreenchange', () => this._fullscreenChanged());
    this._listen(document, 'webkitfullscreenchange', () => this._fullscreenChanged());
    this._listen(document, 'fullscreenerror', () => this.refresh());
    this._listen(document, 'webkitfullscreenerror', () => this.refresh());
    this._listen(document, 'visibilitychange', () => {
      this.refresh();
      this._syncWake(document.visibilityState === 'visible');
    });
    this._listen(window, 'pagehide', () => this._releaseWake());
    this._listen(window, 'pageshow', () => {
      this.refresh();
      this._syncWake(true);
    });
    this._listen(window, 'keydown', event => this._escape(event), true);
    if (this._coarse?.addEventListener) {
      this._listen(this._coarse, 'change', () => this.refresh());
    } else if (this._coarse?.addListener) {
      const changed = () => this.refresh();
      this._coarse.addListener(changed);
      this._listeners.push(() => this._coarse.removeListener(changed));
    }
    this._applyPresentation();
    this.refresh();
  }

  get active() { return this._active; }
  get native() {
    const element = document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement;
    return element === this._root;
  }
  get compact() { return this._size.compact; }
  get portrait() { return this._size.portrait; }

  _listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    this._listeners.push(() => target.removeEventListener(type, handler, options));
  }

  _call(callback, data) {
    if (typeof callback !== 'function') return;
    try { callback(data); } catch (_) { /* Display cleanup must remain available. */ }
  }

  _readOrientationKey() {
    const orientation = window.screen?.orientation;
    if (orientation) return `${orientation.type || ''}:${orientation.angle ?? ''}`;
    // Older Safari supplies only this orientation signal. It is never assigned.
    return typeof window.orientation === 'number' ? String(window.orientation) : '';
  }

  _measure() {
    const viewport = window.visualViewport;
    // Do not resize the layout to counteract a user's pinch zoom.
    const useVisual = viewport && Math.abs((viewport.scale || 1) - 1) < .02;
    const width = Math.max(1, Math.round((useVisual && viewport.width) || window.innerWidth || this._root.clientWidth || 1));
    const height = Math.max(1, Math.round((useVisual && viewport.height) || window.innerHeight || this._root.clientHeight || 1));
    return {
      width,
      height,
      portrait: height > width,
      compact: !!this._coarse?.matches || (width <= 1024 && height <= 1024)
    };
  }

  _snapshot() {
    return { ...this._size, native: this.native, active: this._active };
  }

  _applyPresentation() {
    const { width, height, portrait, compact } = this._size;
    const display = this._active ? (this.native ? 'native' : 'game') : 'page';
    this._body.classList.toggle('game-mode', this._active);
    this._body.classList.toggle('compact-device', compact);
    this._body.dataset.orientation = portrait ? 'portrait' : 'landscape';
    this._body.dataset.display = display;
    const heightValue = `${height}px`, widthValue = `${width}px`;
    if (this._root.style.getPropertyValue('--app-height') !== heightValue) this._root.style.setProperty('--app-height', heightValue);
    if (this._root.style.getPropertyValue('--app-width') !== widthValue) this._root.style.setProperty('--app-width', widthValue);
  }

  refresh() {
    if (this._destroyed || this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = 0;
      if (this._destroyed) return;
      const previous = this._size;
      const orientationKey = this._readOrientationKey();
      this._size = this._measure();
      const changedOrientation = previous.portrait !== this._size.portrait
        || (this._orientationPending && orientationKey !== this._orientationKey);
      this._orientationPending = false;
      this._orientationKey = orientationKey;
      if (changedOrientation) this._suspend('orientation');
      this._applyPresentation();
      const state = this._snapshot();
      const resizeKey = `${state.width}:${state.height}:${state.portrait}:${state.compact}:${state.native}:${state.active}`;
      const modeKey = `${state.active}:${state.native}`;
      if (modeKey !== this._lastMode) {
        this._lastMode = modeKey;
        this._call(this._onModeChange, state);
      }
      if (resizeKey !== this._lastResize) {
        this._lastResize = resizeKey;
        this._call(this._onResize, state);
      }
    });
  }

  enter({ native = true } = {}) {
    if (this._destroyed) return Promise.resolve(this._snapshot());
    this._active = true;
    this._size = this._measure();
    this._applyPresentation(); // Game mode starts even if the API is absent.

    let pending = this._fullscreenPending?.promise;
    if (native && !this.native && !this._fullscreenPending) {
      const standard = typeof this._root.requestFullscreen === 'function';
      const request = standard ? this._root.requestFullscreen : this._root.webkitRequestFullscreen || this._root.webkitRequestFullScreen;
      const enabled = standard ? document.fullscreenEnabled !== false : document.webkitFullscreenEnabled !== false;
      if (typeof request === 'function' && enabled) {
        const token = {};
        this._nativeRequested = true;
        try {
          // Keep this call in the original click stack. Nothing is awaited first.
          const result = standard ? request.call(this._root, { navigationUI: 'hide' }) : request.call(this._root);
          pending = Promise.resolve(result).then(() => {
            if ((!this._active || this._destroyed) && this.native) return this._exitNative();
          }).catch(() => {
            // A refusal retains the in-page game mode. It is not a game error.
          }).finally(() => {
            if (this._fullscreenPending === token) this._fullscreenPending = null;
            if (!this._destroyed) {
              this._fullscreenChanged();
              this.refresh();
            }
          });
          token.promise = pending;
          this._fullscreenPending = token;
        } catch (_) { /* A synchronous refusal also retains game mode. */ }
      }
    }
    this.refresh();
    this._syncWake(true);
    return Promise.resolve(pending).then(() => this._snapshot());
  }

  _suspend(reason) {
    this._playing = false;
    this._call(this._onSuspend, { reason });
    this._releaseWake();
  }

  _leave(reason) {
    const wasActive = this._active || this.native;
    if (wasActive) this._suspend(reason);
    this._active = false;
    this._releaseWake();
    this._applyPresentation();
    this.refresh();
  }

  _exitNative() {
    if (!this.native) return Promise.resolve();
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    if (typeof exit !== 'function') return Promise.resolve();
    try { return Promise.resolve(exit.call(document)).catch(() => {}); }
    catch (_) { return Promise.resolve(); }
  }

  exit() {
    if (this._destroyed) return Promise.resolve(this._snapshot());
    this._leave('exit');
    return this._exitNative().then(() => {
      this._fullscreenChanged();
      return this._snapshot();
    });
  }

  toggle() { return this._active || this.native ? this.exit() : this.enter(); }

  _fullscreenChanged() {
    const nowNative = this.native;
    const wasNative = this._lastNative;
    this._lastNative = nowNative;
    if (nowNative && (!this._active || this._destroyed) && this._nativeRequested) {
      // A late request must not undo a user's exit.
      void this._exitNative();
      return;
    }
    if (this._destroyed) return;
    if (wasNative && !nowNative && this._active) this._leave('native-exit');
    this._applyPresentation();
    this.refresh();
    this._syncWake();
  }

  _escape(event) {
    if (event.key !== 'Escape' || event.defaultPrevented || !this._active) return;
    if (document.querySelector('dialog[open]')) return;
    // Keep Escape out of the engine action map. Native Escape retains its default.
    event.stopImmediatePropagation();
    if (this.native) return;
    event.preventDefault();
    void this.exit();
  }

  setPlaying(playing) {
    if (this._destroyed) return;
    const next = !!playing;
    if (next === this._playing) return;
    this._playing = next;
    this._syncWake(next);
  }

  _canWake() {
    if (this._destroyed || !this._active || !this._playing || document.visibilityState !== 'visible') return false;
    if (this._isPlaying) {
      try { if (!this._isPlaying()) return false; } catch (_) { return false; }
    }
    return globalThis.isSecureContext !== false && typeof navigator.wakeLock?.request === 'function';
  }

  _syncWake(retry = false) {
    if (!this._canWake()) { this._releaseWake(); return; }
    if (retry) this._wakeRefused = false;
    if (this._wake || this._wakePending || this._wakeRefused) return;
    const generation = ++this._wakeGeneration;
    const token = {};
    this._wakePending = token;
    Promise.resolve().then(() => navigator.wakeLock.request('screen')).then(sentinel => {
      if (generation !== this._wakeGeneration || !this._canWake()) {
        try { Promise.resolve(sentinel.release()).catch(() => {}); } catch (_) { /* Already released. */ }
        return;
      }
      this._wake = sentinel;
      sentinel.addEventListener('release', () => {
        if (this._wake === sentinel) this._wake = null;
        // A system release is respected. Retry only on a new relevant event.
      }, { once: true });
    }).catch(() => {
      if (generation === this._wakeGeneration) this._wakeRefused = true;
    }).finally(() => {
      if (this._wakePending === token) this._wakePending = null;
    });
  }

  _releaseWake() {
    ++this._wakeGeneration;
    const sentinel = this._wake;
    this._wake = null;
    this._wakePending = null;
    this._wakeRefused = false;
    if (sentinel) {
      try { Promise.resolve(sentinel.release()).catch(() => {}); } catch (_) { /* Already released. */ }
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._leave('destroy');
    this._destroyed = true;
    if (this._frame) cancelAnimationFrame(this._frame);
    this._frame = 0;
    for (const remove of this._listeners.splice(0)) remove();
    this._body.classList.remove('game-mode', 'compact-device');
    delete this._body.dataset.orientation;
    delete this._body.dataset.display;
    if (this._oldHeight) this._root.style.setProperty('--app-height', this._oldHeight);
    else this._root.style.removeProperty('--app-height');
    if (this._oldWidth) this._root.style.setProperty('--app-width', this._oldWidth);
    else this._root.style.removeProperty('--app-width');
    void this._exitNative();
  }
}

export default GameDisplay;
