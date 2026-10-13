/**
 * Pointer input for the game pad. Use a distinct synthetic code per action.
 *
 * const pad = new TouchControls({
 *   input: game.input,
 *   canPress: action => canUsePad(action),
 *   onGesture: ({ action, code, event }) => resumeSound(),
 * });
 * pad.bind(button, 'Touchleft', 'left');
 *
 * Normal pointerup preserves a quick tap. Cancel, lost capture, and clear()
 * remove pending touch edges and buffers when no other code holds the action.
 * Call clear() on pause, rotation, mode changes, and other interruptions.
 */
export class TouchControls {
  constructor({ input, onGesture, canPress } = {}) {
    if (!input || typeof input.press !== 'function' || typeof input.release !== 'function') {
      throw new TypeError('TouchControls needs an input with press() and release().');
    }
    this.input = input;
    this.onGesture = typeof onGesture === 'function' ? onGesture : () => {};
    this.canPress = typeof canPress === 'function' ? canPress : () => true;
    this._bindings = new Map();
    this._pointers = new Map();
    this._pending = new Map();
    this._roots = new Map();
    this._destroyed = false;
  }

  get activeCount() { return this._pointers.size; }

  snapshot() {
    return {
      activeCount: this.activeCount,
      pointers: [...this._pointers].map(([pointerId, p]) => ({ pointerId, code: p.code, action: p.action })),
      heldCodes: [...new Set([...this._pointers.values()].map(p => p.code))],
      destroyed: this._destroyed,
    };
  }

  bind(button, code, action) {
    if (this._destroyed) throw new Error('Cannot bind a destroyed TouchControls instance.');
    if (!button?.addEventListener || !button?.removeEventListener || !code || !action) {
      throw new TypeError('bind() needs a button, a code, and an action.');
    }
    const old = this._bindings.get(button);
    if (old?.code === code && old?.action === action) return this;
    if (old) this._unbind(old);
    const binding = { button, code, action };
    binding.handlers = {
      pointerdown: event => this._press(binding, event),
      pointerup: event => this._release(event.pointerId, false),
      pointercancel: event => this._release(event.pointerId, true),
      lostpointercapture: event => this._release(event.pointerId, true),
    };
    for (const [name, handler] of Object.entries(binding.handlers)) button.addEventListener(name, handler);
    this._bindings.set(button, binding);
    this._bindRoot(button.ownerDocument?.defaultView || globalThis.window);
    return this;
  }

  _bindRoot(root) {
    if (!root?.addEventListener || this._roots.has(root)) return;
    // These also receive releases outside the button if capture was refused.
    const handlers = {
      pointerup: event => this._release(event.pointerId, false),
      pointercancel: event => this._release(event.pointerId, true),
      blur: () => this.clear(),
    };
    for (const [name, handler] of Object.entries(handlers)) root.addEventListener(name, handler, true);
    this._roots.set(root, handlers);
  }

  _press(binding, event) {
    if (this._destroyed || binding.button.disabled || this._pointers.has(event.pointerId)) return;
    if ((event.pointerType === 'mouse' || !event.pointerType) && event.button != null && event.button !== 0) return;
    let allowed = false;
    try { allowed = Boolean(this.canPress(binding.action)); } catch (_) { /* The host must explicitly permit the action. */ }
    if (!allowed) return;
    event.preventDefault?.();
    const { button, code, action } = binding;
    const alreadyHeld = [...this._pointers.values()].some(p => p.code === code);
    this._pointers.set(event.pointerId, binding);
    button.classList?.add('pressed');
    try { button.setPointerCapture?.(event.pointerId); } catch (_) { /* Root listeners provide release fallback. */ }
    if (!alreadyHeld) {
      this.input.press(code);
      this._pending.set(action, { stamp: this.input.pt?.[action] });
    }
    try {
      const result = this.onGesture({ action, code, event });
      result?.catch?.(() => {});
    } catch (_) { /* An audio callback must not stop input cleanup. */ }
  }

  _release(pointerId, cancelled) {
    const p = this._pointers.get(pointerId);
    if (!p) return;
    // Remove first. Releasing capture can synchronously emit lost capture.
    this._pointers.delete(pointerId);
    if (![...this._pointers.values()].some(other => other.button === p.button)) p.button.classList?.remove('pressed');
    const codeStillHeld = [...this._pointers.values()].some(other => other.code === p.code);
    if (!codeStillHeld) {
      this.input.release(p.code);
      if (cancelled) this._cancelAction(p.action);
    }
    try {
      if (!p.button.hasPointerCapture || p.button.hasPointerCapture(pointerId)) p.button.releasePointerCapture?.(pointerId);
    } catch (_) { /* The browser may already have released capture. */ }
  }

  _actionHeld(action) {
    if (typeof this.input.down === 'function') return this.input.down(action);
    return (this.input.map?.[action] || []).some(code => this.input.held?.has(code));
  }

  _cancelAction(action) {
    const pending = this._pending.get(action);
    if (!pending || this._actionHeld(action)) return;
    // Preserve a later input from another source after the touch was released.
    if (pending.stamp !== undefined && this.input.pt?.[action] !== pending.stamp) {
      this._pending.delete(action);
      return;
    }
    this.input.consume?.(action);
    for (const name of ['fresh', 'now', 'freshUp', 'nowUp']) this.input[name]?.delete?.(action);
    if (this.input.pt) delete this.input.pt[action];
    if (this.input.rk) delete this.input.rk[action];
    if (this.input.used) this.input.used[action] = true;
    this._pending.delete(action);
  }

  clear() {
    for (const pointerId of [...this._pointers.keys()]) this._release(pointerId, true);
    // Released quick taps can still have a pending edge or buffered punch.
    for (const action of [...this._pending.keys()]) this._cancelAction(action);
    for (const { button } of this._bindings.values()) button.classList?.remove('pressed');
  }

  _unbind(binding) {
    for (const [pointerId, p] of [...this._pointers]) if (p === binding) this._release(pointerId, true);
    this._cancelAction(binding.action);
    for (const [name, handler] of Object.entries(binding.handlers)) binding.button.removeEventListener(name, handler);
    binding.button.classList?.remove('pressed');
    this._bindings.delete(binding.button);
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this.clear();
    for (const binding of [...this._bindings.values()]) this._unbind(binding);
    for (const [root, handlers] of this._roots) {
      for (const [name, handler] of Object.entries(handlers)) root.removeEventListener(name, handler, true);
    }
    this._roots.clear();
    this._pending.clear();
  }
}
