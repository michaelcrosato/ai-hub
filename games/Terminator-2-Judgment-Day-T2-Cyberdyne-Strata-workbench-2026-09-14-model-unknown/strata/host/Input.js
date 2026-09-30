/*
 * Strata's action queries (down, consume, axis, look) answered by the shared kit input, so every
 * cartridge plays with keyboard and mouse, a gamepad or touch without device code of its own.
 *
 * The kit actions below are defined once at boot and follow the wall's standard bindings. Each
 * cartridge names a control scheme ('fps', 'driving' or 'cyberdyne') in its controls profile; the
 * scheme decides how Strata's action names map onto kit actions and which touch buttons show.
 */

/** Radians of kit look that equal one unit of Strata look (experiences multiply by this sensitivity). */
export const LOOK_UNIT = 0.002;

/** Kit action definitions. The first cluster button defined (Fire) is the big touch button. */
export const ACTIONS = {
  fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'Fire' },
  move: { type: 'vector', keys: 'wasd', gamepad: 'leftStick+dpad', touch: 'stick' },
  arrows: { type: 'vector', keys: 'arrows', gamepad: [] },
  look: { type: 'look', mouse: 'always', gamepad: 'rightStick', touch: 'drag' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  aim: { keys: ['KeyK'], mouse: [2], gamepad: ['LT'], touch: 'Aim' },
  crouch: { keys: ['KeyC', 'ControlLeft'], gamepad: ['B'], touch: 'Crouch' },
  use: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  lock: { keys: ['KeyQ'], gamepad: ['X'], touch: 'Lock' },
  reload: { keys: ['KeyR'], gamepad: ['Y'], touch: 'Reload' },
  gas: { type: 'axis', gamepad: { pos: 'RT', neg: 'LT' }, touch: { pos: 'Gas', neg: 'Rev' } },
  brake: { keys: ['Space'], gamepad: ['B'], touch: 'Brake' },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  scan: { keys: ['KeyV'], gamepad: ['Y'], touch: { label: 'Vision', slot: 'top' } },
  swap: { gamepad: ['RB'], touch: { label: 'Swap', slot: 'top' } },
  weapon1: { keys: ['Digit1'] },
  weapon2: { keys: ['Digit2'] },
  throw: { keys: ['KeyG'], gamepad: ['LB'], touch: { label: 'Throw', slot: 'top' } },
  camera: { keys: ['KeyC'], gamepad: ['RB'], touch: { label: 'View', slot: 'top' } },
  reset: { keys: ['KeyR'], gamepad: ['Y'], touch: { label: 'Reset', slot: 'top' } },
  respawn: { keys: ['Backspace'], gamepad: ['Back'] },
  restart: { keys: ['KeyR'] },
  mute: { keys: ['KeyM'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
};

/** Touch buttons each scheme shows (the stick and the look drag are always on during play). */
const TOUCH = {
  none: [],
  fps: ['fire', 'jump', 'aim', 'crouch', 'reload', 'swap', 'pause'],
  cyberdyne: ['fire', 'jump', 'aim', 'crouch', 'lock', 'scan', 'pause'],
  driving: ['gas', 'brake', 'camera', 'reset', 'pause'],
};
const TOUCH_BUTTONS = ['fire', 'jump', 'aim', 'crouch', 'use', 'lock', 'reload', 'gas', 'brake', 'scan', 'swap', 'throw', 'camera', 'reset', 'pause'];

/** Strata action name → kit action name. Directions are answered from the move and arrow vectors. */
const MAP = {
  fire: 'fire',
  aim: 'aim',
  jump: 'jump',
  sprint: 'sprint',
  crouch: 'crouch',
  interact: 'use',
  reload: 'reload',
  weapon1: 'weapon1',
  weapon2: 'weapon2',
  swap: 'swap',
  throw: 'throw',
  respawn: 'respawn',
  scan: 'scan',
  lock: 'lock',
  brake: 'brake',
  reset: 'reset',
  camera: 'camera',
};

/** Button prompts per input device. */
const LABELS = {
  keyboard: {
    fire: 'CLICK',
    aim: 'RIGHT MOUSE',
    jump: 'SPACE',
    sprint: 'SHIFT',
    crouch: 'C',
    interact: 'E',
    reload: 'R',
    swap: '1 / 2',
    throw: 'G',
    respawn: 'BACKSPACE',
    scan: 'TAB',
    lock: 'Q',
    brake: 'SPACE',
    reset: 'R',
    camera: 'C',
    pause: 'ESC',
    restart: 'R',
    move: 'W A S D',
    look: 'MOUSE',
  },
  gamepad: {
    fire: 'RT',
    aim: 'LT',
    jump: 'A',
    sprint: 'L3',
    crouch: 'B',
    interact: 'X',
    reload: 'Y',
    swap: 'RB',
    throw: 'LB',
    respawn: 'BACK',
    scan: 'Y',
    lock: 'X',
    brake: 'B',
    reset: 'Y',
    camera: 'RB',
    pause: 'START',
    restart: 'MENU',
    move: 'L STICK',
    look: 'R STICK',
  },
  touch: {
    fire: 'FIRE',
    aim: 'AIM',
    jump: 'JUMP',
    sprint: 'PUSH STICK',
    crouch: 'CROUCH',
    interact: 'USE',
    reload: 'RELOAD',
    swap: 'SWAP',
    throw: 'THROW',
    respawn: 'MENU',
    scan: 'VISION',
    lock: 'LOCK',
    brake: 'BRAKE',
    reset: 'RESET',
    camera: 'VIEW',
    pause: 'II',
    restart: 'MENU',
    move: 'STICK',
    look: 'DRAG',
  },
};

const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const KEY_NAMES = { KeyE: 'E', KeyF: 'F', KeyQ: 'Q', KeyR: 'R', KeyC: 'C', KeyV: 'V', KeyX: 'X' };

export class Input {
  enabled = false;
  scheme = 'none';
  captureMouse = false;
  pending = new Set();
  dx = 0;
  dy = 0;
  shown = new Map();
  keyLabels = {};
  constructor(kit) {
    this.kit = kit;
    this.k = kit.input;
    this.canvas = kit.canvas;
    this.names = [...this.k.actions.keys()];
    // Tab turns on T-800 vision. It is not a kit binding, so Tab still moves focus in every menu.
    this.onKey = (e) => {
      if (e.code !== 'Tab' || e.repeat || !this.enabled || this.scheme !== 'cyberdyne' || typing(e.target)) return;
      e.preventDefault();
      this.pending.add('scan');
    };
    addEventListener('keydown', this.onKey);
  }
  get source() {
    return this.k.source;
  }
  bind(profile = {}) {
    this.captureMouse = !!profile.captureMouse;
    this.scheme = profile.scheme || 'none';
    this.clear();
    this.refreshTouch();
  }
  /** Rebind the three remappable keys (Settings / Input preferences). */
  applyBindings(bindings = {}) {
    const keyOf = (name, fallback) => (KEY_NAMES[bindings[name]] ? bindings[name] : fallback);
    const interact = keyOf('interact', 'KeyE'),
      reload = keyOf('reload', 'KeyR'),
      crouch = keyOf('crouch', 'KeyC');
    this.k.define({
      use: { ...ACTIONS.use, keys: [interact] },
      reload: { ...ACTIONS.reload, keys: [reload] },
      crouch: { ...ACTIONS.crouch, keys: [crouch, 'ControlLeft'] },
    });
    this.keyLabels = { interact: KEY_NAMES[interact], reload: KEY_NAMES[reload], crouch: KEY_NAMES[crouch] };
  }
  /** Show one touch button (e.g. Use only while something can be used). Writes only on change. */
  setShown(name, on) {
    if (this.shown.get(name) === on) return;
    this.shown.set(name, on);
    const touch = this.kit.touch;
    if (!touch) return;
    // Axis actions get one button per direction ('gas+' and 'gas-').
    if (ACTIONS[name]?.type === 'axis') {
      touch.setShown(`${name}+`, on);
      touch.setShown(`${name}-`, on);
    } else touch.setShown(name, on);
  }
  refreshTouch() {
    const set = TOUCH[this.scheme] || TOUCH.none;
    for (const name of TOUCH_BUTTONS) this.setShown(name, set.includes(name));
  }
  /** Once per rendered frame: latch fresh presses for consume() and collect look movement. */
  poll() {
    if (!this.enabled) {
      this.dx = this.dy = 0;
      return;
    }
    for (const name of this.names) if (this.k.pressed(name)) this.pending.add(name);
    const l = this.k.look('look');
    this.dx += l.x / LOOK_UNIT;
    this.dy += l.y / LOOK_UNIT;
  }
  moveVector() {
    const m = this.k.vector('move');
    if (this.scheme === 'cyberdyne') return m;
    // Arrows move in the FPS and driving kits; in the T2 scene they turn the camera.
    const a = this.k.vector('arrows');
    let x = m.x + a.x,
      y = m.y + a.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }
  down(action) {
    if (!this.enabled) return false;
    switch (action) {
      case 'forward':
        return this.axis('forward', 'back') > 0.3;
      case 'back':
        return this.axis('forward', 'back') < -0.3;
      case 'left':
        return this.moveVector().x < -0.3;
      case 'right':
        return this.moveVector().x > 0.3;
      case 'lookLeft':
        return this.k.vector('arrows').x < -0.3;
      case 'lookRight':
        return this.k.vector('arrows').x > 0.3;
      case 'lookUp':
        return this.k.vector('arrows').y > 0.3;
      case 'lookDown':
        return this.k.vector('arrows').y < -0.3;
      case 'sprint':
        // On touch, pushing the stick to its rim sprints.
        return this.k.down('sprint') || (this.k.source === 'touch' && Math.hypot(this.k.vector('move').x, this.k.vector('move').y) > 0.95);
      default: {
        const name = MAP[action];
        return !!name && this.k.down(name);
      }
    }
  }
  consume(action) {
    if (!this.enabled) return false;
    const name = MAP[action];
    return !!name && this.pending.delete(name);
  }
  axis(positive, negative) {
    if (!this.enabled) return 0;
    if (positive === 'right' && negative === 'left') return this.moveVector().x;
    if (positive === 'back' && negative === 'forward') return -this.moveVector().y;
    if (positive === 'forward' && negative === 'back') {
      const v = this.moveVector().y + (this.scheme === 'driving' ? this.k.value('gas') : 0);
      return Math.max(-1, Math.min(1, v));
    }
    if (positive === 'lookLeft' && negative === 'lookRight') return -this.k.vector('arrows').x;
    if (positive === 'lookUp' && negative === 'lookDown') return this.k.vector('arrows').y;
    return Number(this.down(positive)) - Number(this.down(negative));
  }
  look() {
    const v = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return v;
  }
  clear() {
    this.pending.clear();
    this.dx = this.dy = 0;
  }
  /** The prompt for an action on the device the player is using right now. */
  label(action) {
    const src = LABELS[this.k.source] ? this.k.source : 'keyboard';
    if (src === 'keyboard' && this.keyLabels[action]) return this.keyLabels[action];
    return LABELS[src][action] || action.toUpperCase();
  }
  dispose() {
    this.enabled = false;
    removeEventListener('keydown', this.onKey);
    this.clear();
  }
}
