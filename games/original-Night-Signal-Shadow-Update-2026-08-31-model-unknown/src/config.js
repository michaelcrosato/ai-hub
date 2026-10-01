import { clamp } from './math.js';

export const GENERATOR_VERSION = 1;
export const FLOOR_HEIGHT = 3.4;
export const GROUND_Y = 0.12;
export const LOT_SPACING = 34;

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', interact: 'KeyE',
  sprint: 'ShiftLeft', crouch: 'KeyC', flashlight: 'KeyF', throw: 'KeyG',
  crank: 'KeyR', breath: 'Space', journal: 'Tab', hints: 'KeyH',
};

/**
 * How hard a night is. Standard is the original balance. `wake` lists how many
 * fuses must be collected before each listener starts to move.
 */
export const DIFFICULTIES = {
  calm: {
    label: 'Quiet night',
    note: 'One listener. Six bottles, a slower battery drain and a shorter alarm.',
    wake: [0], grace: 12, drain: 0.45, decoys: 6, alarm: 30, speed: 0.9, hearing: 16,
  },
  standard: {
    label: 'Standard',
    note: 'Two listeners. The second wakes when you hold two fuses.',
    wake: [0, 2], grace: 8, drain: 0.65, decoys: 4, alarm: 35, speed: 1, hearing: 13,
  },
  hunted: {
    label: 'Hunted',
    note: 'Three listeners. One is blind and hunts by sound alone, fast. Three bottles, a longer alarm.',
    wake: [0, 1, 2], grace: 6, drain: 0.8, decoys: 3, alarm: 45, speed: 1.06, hearing: 11,
  },
};
export const difficultyOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.standard;
export const MAX_DECOYS = Math.max(...Object.values(DIFFICULTIES).map((d) => d.decoys));
export const MAX_ALARM = Math.max(...Object.values(DIFFICULTIES).map((d) => d.alarm));

export const DEFAULT_SETTINGS = {
  fov: 82, brightness: 1.15, beamAngle: 30, volume: 0.65, range: 'full',
  captions: true, hints: true, hud: true, bloom: true, headBob: false, flicker: false,
  difficulty: 'standard', bindings: { ...DEFAULT_BINDINGS },
};

const BINDABLE = /^(Key[A-Z]|Digit[0-9]|ShiftLeft|ControlLeft|AltLeft|Space|Tab)$/;
/** Keys a player may bind. P (pause), Escape and the arrow keys (turn) are reserved. */
export const bindable = (code) => BINDABLE.test(code) && code !== 'KeyP';

export function validateSettings(input) {
  const out = { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  if (!input || typeof input !== 'object') return out;
  const x = input;
  for (const [key, min, max] of [['fov', 60, 110], ['brightness', 0.7, 2], ['beamAngle', 18, 50], ['volume', 0, 1]]) {
    if (typeof x[key] === 'number' && Number.isFinite(x[key])) out[key] = clamp(x[key], min, max);
  }
  for (const key of ['captions', 'hints', 'hud', 'bloom', 'headBob', 'flicker']) if (typeof x[key] === 'boolean') out[key] = x[key];
  if (x.range === 'night') out.range = 'night';
  if (typeof x.difficulty === 'string' && Object.hasOwn(DIFFICULTIES, x.difficulty)) out.difficulty = x.difficulty;
  if (x.bindings && typeof x.bindings === 'object') {
    const b = x.bindings;
    const used = new Set();
    for (const key of Object.keys(DEFAULT_BINDINGS)) {
      const candidate = b[key];
      if (typeof candidate === 'string' && bindable(candidate) && !used.has(candidate)) {
        out.bindings[key] = candidate;
        used.add(candidate);
      }
    }
    // Reject a conflicting set as a whole. Every action must remain available.
    if (new Set(Object.values(out.bindings)).size !== Object.keys(out.bindings).length) out.bindings = { ...DEFAULT_BINDINGS };
  }
  return out;
}

export const keyLabel = (code) =>
  code.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ControlLeft', 'Ctrl').replace('AltLeft', 'Alt');

/** Button names for prompts, by input device. */
export const PAD_LABEL = {
  interact: 'X', breath: 'A', crouch: 'B', flashlight: 'Y', throw: 'RT', crank: 'LB', sprint: 'L-stick', journal: 'Back', pause: 'Start', hints: '—',
};
export const TOUCH_LABEL = {
  interact: 'Use', breath: 'Breath', crouch: 'Crouch', flashlight: 'Light', throw: 'Bottle', crank: 'Crank', sprint: 'Run', journal: 'Map', pause: 'II', hints: '—',
};

/**
 * Every input the game reads, for kit.input. Keyboard keys follow the
 * player's bindings; arrows turn the view (the original's keyboard look).
 * menuOk / menuBack drive the game's own menus from a gamepad.
 */
export function actionDefs(b) {
  return {
    move: { type: 'vector', keys: { up: [b.forward], down: [b.back], left: [b.left], right: [b.right] }, gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    turn: { type: 'vector', keys: 'arrows', gamepad: [], clamp: false },
    interact: { keys: [b.interact], gamepad: ['X'], touch: 'Use' },
    breath: { keys: [b.breath], gamepad: ['A'], touch: 'Breath' },
    crouch: { keys: [b.crouch], gamepad: ['B', 'RS'], touch: 'Crouch' },
    flashlight: { keys: [b.flashlight], gamepad: ['Y'], touch: 'Light' },
    throw: { keys: [b.throw], gamepad: ['RT', 'RB'], touch: 'Bottle' },
    sprint: { keys: [b.sprint], gamepad: ['LS'], touch: { label: 'Run', slot: 'top' } },
    crank: { keys: [b.crank], gamepad: ['LB', 'LT'], touch: { label: 'Crank', slot: 'top' } },
    journal: { keys: [b.journal], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
    hints: { keys: [b.hints] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    menuOk: { gamepad: ['A'] },
    menuBack: { gamepad: ['B'] },
  };
}
