/**
 * input.js — the walk's controls on top of the kit's actions.
 *
 * The kit wires keyboard, mouse, gamepad and touch into named actions
 * (see ACTIONS). This adapter keeps the small interface the game already
 * used: read() for walking, and yaw / pitch / zoom deltas that the camera
 * code consumes and clears.
 */

/** Every control, for boot({ input }). Keyboard, gamepad and touch for each. */
export const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Hop' },
  run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LT', 'B'], touch: 'Run' },
  recenter: { keys: ['KeyB'], gamepad: ['RS'], touch: 'View' },
  talk: { keys: ['KeyT'], gamepad: ['RT'], touch: 'Talk' },
  back: { gamepad: ['B'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  confirm: { keys: ['Enter', 'NumpadEnter'] },
  wave: { keys: ['KeyQ'], gamepad: ['Y'] },
  journal: { keys: ['KeyJ'], gamepad: ['Back'] },
  globe: { keys: ['KeyM'] },
  courier: { keys: ['KeyC'], gamepad: ['LS'] },
  machine: { keys: ['KeyV'] },
  home: { keys: ['KeyR'] },
  help: { keys: ['KeyH'] },
  zoomPad: { type: 'axis', gamepad: { pos: 'RB', neg: 'LB' } },
  note0: { keys: ['Digit1', 'Numpad1'] },
  note1: { keys: ['Digit2', 'Numpad2'] },
  note2: { keys: ['Digit3', 'Numpad3'] },
  note3: { keys: ['Digit4', 'Numpad4'] },
  note4: { keys: ['Digit5', 'Numpad5'] },
};

// The old controls turned the camera by these amounts; the kit reports radians
// with its own base rates, so each source is scaled back to the original feel.
const MOUSE = { yaw: .005 / .0024, pitch: .0032 / .0024 };
const TOUCH = { yaw: .005 / .0055, pitch: .0032 / .0055 };

class Input {
  constructor(kit) {
    this.kit = kit; this.k = kit.input;
    this.yaw = 0; this.pitch = 0; this.zoom = 0; this.run = false;
    this.onRun = null;
  }
  get source() { return this.k.source; }
  get isTouch() { return this.k.source === 'touch'; }
  get isPad() { return this.k.source === 'gamepad'; }
  pressed(name) { return this.k.pressed(name); }
  down(name) { return this.k.down(name); }
  vector(name = 'move') { return this.k.vector(name); }
  /** Collect this frame's camera turns and zoom. Call once per frame. */
  poll(dt) {
    const look = this.k.look('look'), src = this.k.source;
    const scale = src === 'touch' ? TOUCH : src === 'gamepad' ? { yaw: 1, pitch: .8 } : MOUSE;
    this.yaw += look.x * scale.yaw;
    this.pitch += look.y * scale.pitch;
    const z = this.k.zoom();
    if (z) this.zoom -= z * (src === 'touch' ? 2.5 : .8);
    const pad = this.k.value('zoomPad');
    if (pad) this.zoom -= pad * dt * 7;
    // On touch the Run button is a switch; keys and triggers run while held.
    if (src === 'touch' && this.k.pressed('run')) this.setRun(!this.run);
  }
  setRun(value) {
    this.run = !!value;
    this.onRun?.(this.run);
  }
  /** Stop any camera drift and forget held presses (after a menu or a mode change). */
  reset() {
    this.yaw = 0; this.pitch = 0; this.zoom = 0; this.setRun(false);
    this.k.settle();
  }
  /** Walking input: x right, y back (the old convention), run. */
  read() {
    const v = this.k.vector('move');
    return { x: v.x, y: -v.y, run: this.run || (this.k.source !== 'touch' && this.k.down('run')) };
  }
}

export { Input };
