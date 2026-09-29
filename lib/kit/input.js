/**
 * input.js — keyboard, mouse, gamepad and touch behind one set of actions.
 *
 * A game names what the player can do (move, look, jump, fire…) and which
 * keys, buttons and touch controls trigger it. It then asks about actions,
 * never devices:
 *
 *   input.vector('move')   {x, y}, length ≤ 1, y is up / forward
 *   input.down('fire')     held
 *   input.pressed('jump')  went down this frame
 *   input.released('jump') came up this frame
 *   input.value('gas')     0..1 for buttons (analog triggers), -1..1 for axes
 *   input.look('look')     {x, y} this frame, in radians of camera turn
 *   input.zoom()           wheel / pinch this frame, + is zoom in
 *   input.pointer          {x, y, nx, ny, down, justDown, justUp, type} over the canvas
 *   input.source           'keyboard' | 'gamepad' | 'touch' (last used)
 *
 * Action definitions (every field optional):
 *
 *   move: { type: 'vector', keys: 'wasd' | 'arrows' | 'wasd+arrows' | {up,down,left,right},
 *           gamepad: 'leftStick' | 'rightStick' | 'dpad' | 'leftStick+dpad', touch: 'stick' }
 *   look: { type: 'look', mouse: 'locked' | 'drag' | 'always', gamepad: 'rightStick', touch: 'drag' }
 *   gas:  { type: 'axis', keys: { pos: ['KeyW'], neg: ['KeyS'] }, gamepad: { pos: 'RT', neg: 'LT' } }
 *   jump: { keys: ['Space'], mouse: [0], gamepad: ['A'], touch: 'Jump' | { label, slot } }
 *
 * Button names follow the standard gamepad mapping: A B X Y LB RB LT RT
 * Back Start LS RS Up Down Left Right Home. Keys are KeyboardEvent.code.
 */

export const GAMEPAD_BUTTONS = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'LS', 'RS', 'Up', 'Down', 'Left', 'Right', 'Home'];

const KEY_PRESETS = {
  wasd: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
  arrows: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
};
KEY_PRESETS['wasd+arrows'] = mergeDirs(KEY_PRESETS.wasd, KEY_PRESETS.arrows);

function mergeDirs(a, b) {
  return { up: [...a.up, ...b.up], down: [...a.down, ...b.down], left: [...a.left, ...b.left], right: [...a.right, ...b.right] };
}

const STICK_DEADZONE = 0.16;
const TRIGGER_THRESHOLD = 0.35;
/** Radians of turn per pixel of mouse travel at sensitivity 1. */
export const MOUSE_LOOK = 0.0024;
/** Radians per second at full stick deflection. */
export const STICK_LOOK = 2.6;
/** Radians per pixel of touch drag. */
export const TOUCH_LOOK = 0.0055;

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Radial deadzone, rescaled so motion starts smoothly at the edge of it. */
export function deadzone(x, y, dz = STICK_DEADZONE) {
  const len = Math.hypot(x, y);
  if (len < dz) return { x: 0, y: 0 };
  const scaled = Math.min(1, (len - dz) / (1 - dz));
  return { x: (x / len) * scaled, y: (y / len) * scaled };
}

/** Clamp a vector to unit length (so diagonals on a keyboard are not faster). */
export function clampUnit(x, y) {
  const len = Math.hypot(x, y);
  return len > 1 ? { x: x / len, y: y / len } : { x, y };
}

/** Normalise one action definition. Exported for tests. */
export function normalizeAction(name, def = {}) {
  const type = def.type || 'button';
  const out = { name, type, keys: null, mouse: [], gamepad: [], touch: def.touch ?? null, stick: null, mouseLook: null };
  if (type === 'vector') {
    out.keys = typeof def.keys === 'string' ? KEY_PRESETS[def.keys] || null : def.keys || null;
    const pads = asList(def.gamepad ?? 'leftStick').flatMap((g) => String(g).split('+'));
    out.gamepad = pads;
  } else if (type === 'axis') {
    out.keys = def.keys ? { pos: asList(def.keys.pos), neg: asList(def.keys.neg) } : null;
    out.gamepad = def.gamepad ?? null;
  } else if (type === 'look') {
    out.mouseLook = def.mouse ?? 'locked';
    out.gamepad = asList(def.gamepad ?? 'rightStick');
  } else {
    out.keys = asList(def.keys);
    out.mouse = asList(def.mouse);
    out.gamepad = asList(def.gamepad);
  }
  return out;
}

const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export class Input {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.element     the canvas (pointer + gestures)
   * @param {object} opts.actions          action definitions (see top of file)
   * @param {() => object} [opts.settings] current kit settings
   */
  constructor({ element, actions = {}, settings = () => ({}) } = {}) {
    this.element = element;
    this.settings = settings;
    this.enabled = true;
    this.source = 'keyboard';
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.wheel = 0;
    this.pinch = 0;
    this.pointer = { x: 0, y: 0, nx: 0, ny: 0, down: false, justDown: false, justUp: false, type: 'mouse' };
    this.pointerLocked = false;
    this.pad = null;
    this.padButtons = new Array(GAMEPAD_BUTTONS.length).fill(0);
    this.padAxes = [0, 0, 0, 0];
    /** Virtual controls write here: { vectors: {name:{x,y}}, buttons: Set, look: {x,y} } */
    this.touch = { vectors: {}, buttons: new Set(), look: { x: 0, y: 0 } };
    this.actions = new Map();
    this.state = new Map();
    this.prev = new Map();
    this.listeners = new Set();
    this.define(actions);
    this.#bind();
  }

  /** Add or replace actions. */
  define(actions) {
    for (const [name, def] of Object.entries(actions || {})) this.actions.set(name, normalizeAction(name, def));
    this.mappedKeys = new Set();
    for (const a of this.actions.values()) {
      if (Array.isArray(a.keys)) a.keys.forEach((k) => this.mappedKeys.add(k));
      else if (a.keys) Object.values(a.keys).forEach((list) => list.forEach((k) => this.mappedKeys.add(k)));
    }
    return this;
  }

  /** Subscribe to 'source' changes: fn('touch' | 'keyboard' | 'gamepad'). */
  onSourceChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  #setSource(src) {
    if (this.source === src) return;
    this.source = src;
    for (const fn of this.listeners) fn(src);
  }

  #bind() {
    const el = this.element;
    const off = [];
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      off.push(() => target.removeEventListener(type, fn, opts));
    };
    this.dispose = () => off.forEach((f) => f());

    on(window, 'keydown', (e) => {
      if (!this.enabled || isTyping(e.target)) return;
      this.keys.add(e.code);
      this.#setSource('keyboard');
      // Keep Space and the arrows from scrolling the page (or the hub around the frame).
      if (this.mappedKeys.has(e.code) || /^(Space|Arrow)/.test(e.code)) e.preventDefault();
    });
    on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
    });
    on(window, 'blur', () => {
      this.keys.clear();
      this.mouseButtons.clear();
      this.touch.buttons.clear();
    });

    if (!el) return;
    el.style.touchAction = 'none';
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    const setPointer = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.nx = r.width ? (this.pointer.x / r.width) * 2 - 1 : 0;
      this.pointer.ny = r.height ? -((this.pointer.y / r.height) * 2 - 1) : 0;
      this.pointer.type = e.pointerType || 'mouse';
    };

    const touches = new Map();
    let pinchStart = 0;
    const pinchDistance = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };

    on(el, 'pointerdown', (e) => {
      if (!this.enabled) return;
      setPointer(e);
      if (e.pointerType === 'touch') {
        this.#setSource('touch');
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) pinchStart = pinchDistance();
        if (touches.size > 1) return; // a second finger is a gesture, not a click
      } else {
        this.mouseButtons.add(e.button);
        if (this.source === 'touch') this.#setSource('keyboard');
      }
      this.pointer.down = true;
      this.pointer.justDown = true;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic events cannot be captured */
      }
    });
    on(el, 'pointermove', (e) => {
      setPointer(e);
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        const t = touches.get(e.pointerId);
        const dx = e.clientX - t.x;
        const dy = e.clientY - t.y;
        t.x = e.clientX;
        t.y = e.clientY;
        if (touches.size === 2) {
          const d = pinchDistance();
          if (pinchStart > 0 && d > 0) this.pinch += Math.log(d / pinchStart) * 4;
          pinchStart = d;
        } else if (touches.size === 1) {
          this.touch.look.x += dx;
          this.touch.look.y += dy;
        }
        return;
      }
      if (this.pointerLocked || this.mouseButtons.size || this.#lookMode() === 'always') {
        this.mouseDelta.x += e.movementX || 0;
        this.mouseDelta.y += e.movementY || 0;
      }
    });
    const up = (e) => {
      if (e.pointerType === 'touch') {
        touches.delete(e.pointerId);
        if (touches.size < 2) pinchStart = 0;
        if (touches.size > 0) return;
      } else {
        this.mouseButtons.delete(e.button);
      }
      if (this.pointer.down) this.pointer.justUp = true;
      this.pointer.down = false;
    };
    on(el, 'pointerup', up);
    on(el, 'pointercancel', up);
    on(
      el,
      'wheel',
      (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        this.wheel += (-e.deltaY * unit) / 100;
      },
      { passive: false }
    );

    on(document, 'pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === el;
    });
    // Movement while locked arrives on the document, not the element.
    on(document, 'mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDelta.x += e.movementX || 0;
        this.mouseDelta.y += e.movementY || 0;
      }
    });
  }

  #lookMode() {
    for (const a of this.actions.values()) if (a.type === 'look') return a.mouseLook;
    return null;
  }

  /** Ask for pointer lock (call from a click handler). Mouse look then works without holding a button. */
  lockPointer() {
    if (!this.element || this.source === 'touch') return;
    try {
      const p = this.element.requestPointerLock?.({ unadjustedMovement: true });
      p?.catch?.(() => this.element.requestPointerLock?.());
    } catch {
      /* not allowed here */
    }
  }

  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  #pollGamepad() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    const pad = pads.find((p) => p.connected && p.mapping === 'standard') || pads.find((p) => p.connected) || null;
    this.pad = pad;
    if (!pad) {
      this.padButtons.fill(0);
      this.padAxes.fill(0);
      return;
    }
    let active = false;
    for (let i = 0; i < GAMEPAD_BUTTONS.length; i++) {
      const b = pad.buttons[i];
      const v = b ? (typeof b === 'object' ? b.value || (b.pressed ? 1 : 0) : b) : 0;
      this.padButtons[i] = v;
      if (v > 0.5) active = true;
    }
    for (let i = 0; i < 4; i++) {
      const v = pad.axes[i] || 0;
      this.padAxes[i] = v;
      if (Math.abs(v) > 0.5) active = true;
    }
    if (active) this.#setSource('gamepad');
  }

  #padButton(name) {
    const i = GAMEPAD_BUTTONS.indexOf(name);
    return i < 0 ? 0 : this.padButtons[i];
  }

  #stick(which) {
    if (which === 'leftStick') return deadzone(this.padAxes[0], -this.padAxes[1]);
    if (which === 'rightStick') return deadzone(this.padAxes[2], -this.padAxes[3]);
    if (which === 'dpad') return { x: this.#padButton('Right') - this.#padButton('Left'), y: this.#padButton('Up') - this.#padButton('Down') };
    return { x: 0, y: 0 };
  }

  #analog(spec) {
    if (!spec) return 0;
    if (spec === 'leftStickX') return this.#stick('leftStick').x;
    if (spec === 'leftStickY') return this.#stick('leftStick').y;
    if (spec === 'rightStickX') return this.#stick('rightStick').x;
    if (spec === 'rightStickY') return this.#stick('rightStick').y;
    return this.#padButton(spec);
  }

  #keysDown(list) {
    for (const k of list) if (this.keys.has(k)) return true;
    return false;
  }

  /** Called once per frame by the kit loop, before the game's update. */
  update(dt = 1 / 60) {
    this.#pollGamepad();
    const s = this.settings() || {};
    const sens = s.lookSensitivity ?? 1;
    const invert = s.invertY ? -1 : 1;
    [this.prev, this.state] = [this.state, this.prev];
    this.state.clear();

    for (const a of this.actions.values()) {
      if (a.type === 'vector') {
        let x = 0;
        let y = 0;
        if (a.keys) {
          x += (this.#keysDown(a.keys.right) ? 1 : 0) - (this.#keysDown(a.keys.left) ? 1 : 0);
          y += (this.#keysDown(a.keys.up) ? 1 : 0) - (this.#keysDown(a.keys.down) ? 1 : 0);
        }
        for (const g of a.gamepad) {
          const v = this.#stick(g);
          x += v.x;
          y += v.y;
        }
        const t = this.touch.vectors[a.name];
        if (t) {
          x += t.x;
          y += t.y;
        }
        const v = clampUnit(x, y);
        this.state.set(a.name, { x: v.x, y: v.y, down: Math.hypot(v.x, v.y) > 0.3 });
      } else if (a.type === 'axis') {
        let v = 0;
        if (a.keys) v += (this.#keysDown(a.keys.pos) ? 1 : 0) - (this.#keysDown(a.keys.neg) ? 1 : 0);
        const g = a.gamepad;
        if (g && typeof g === 'object') v += this.#analog(g.pos) - this.#analog(g.neg);
        else if (g) v += this.#analog(g);
        const t = this.touch.vectors[a.name];
        if (t) v += t.x;
        v = Math.max(-1, Math.min(1, v));
        this.state.set(a.name, { value: v, down: Math.abs(v) > 0.3 });
      } else if (a.type === 'look') {
        let x = 0;
        let y = 0;
        const mouseOk = a.mouseLook === 'always' || (a.mouseLook === 'locked' && this.pointerLocked) || (a.mouseLook === 'drag' && (this.pointerLocked || this.mouseButtons.size > 0));
        if (mouseOk) {
          x += this.mouseDelta.x * MOUSE_LOOK;
          y += this.mouseDelta.y * MOUSE_LOOK;
        }
        for (const g of a.gamepad) {
          const v = this.#stick(g);
          // Squared response: fine aim near the centre, fast turns at the edge.
          x += v.x * Math.abs(v.x) * STICK_LOOK * dt;
          y -= v.y * Math.abs(v.y) * STICK_LOOK * dt;
        }
        if (a.touch) {
          x += this.touch.look.x * TOUCH_LOOK;
          y += this.touch.look.y * TOUCH_LOOK;
        }
        this.state.set(a.name, { x: x * sens, y: y * sens * invert });
      } else {
        let v = 0;
        if (this.#keysDown(a.keys)) v = 1;
        for (const m of a.mouse) if (this.mouseButtons.has(m)) v = 1;
        for (const g of a.gamepad) {
          const pv = this.#padButton(g);
          const isTrigger = g === 'LT' || g === 'RT';
          if (isTrigger ? pv > TRIGGER_THRESHOLD : pv > 0.5) v = Math.max(v, pv);
        }
        if (this.touch.buttons.has(a.name)) v = 1;
        this.state.set(a.name, { value: v, down: v > 0 });
      }
    }
  }

  /** Called by the kit loop after the game's update: clears per-frame deltas. */
  endFrame() {
    this.mouseDelta.x = this.mouseDelta.y = 0;
    this.touch.look.x = this.touch.look.y = 0;
    this.wheel = 0;
    this.pinch = 0;
    this.pointer.justDown = this.pointer.justUp = false;
  }

  down(name) {
    return !!this.state.get(name)?.down;
  }

  pressed(name) {
    return !!this.state.get(name)?.down && !this.prev.get(name)?.down;
  }

  released(name) {
    return !this.state.get(name)?.down && !!this.prev.get(name)?.down;
  }

  value(name) {
    return this.state.get(name)?.value ?? 0;
  }

  vector(name = 'move') {
    const s = this.state.get(name);
    return s ? { x: s.x, y: s.y } : { x: 0, y: 0 };
  }

  look(name = 'look') {
    const s = this.state.get(name);
    return s ? { x: s.x, y: s.y } : { x: 0, y: 0 };
  }

  zoom() {
    return this.wheel + this.pinch;
  }

  /** Controller rumble and phone haptics, if the player has vibration on. */
  rumble(strength = 0.5, ms = 120) {
    if (this.settings()?.vibration === false) return;
    const act = this.pad?.vibrationActuator;
    if (act?.playEffect) {
      act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: Math.min(1, strength * 1.2) }).catch(() => {});
    } else if (this.source === 'touch' && navigator.vibrate) {
      navigator.vibrate(Math.max(8, Math.round(ms * strength * 0.5)));
    }
  }
}
