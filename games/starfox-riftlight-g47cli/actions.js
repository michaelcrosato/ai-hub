// One action set for the keyboard, a PS5-compatible (W3C standard) gamepad,
// the mouse, and touch. Every device maps through mapActions.

export const IDLE = Object.freeze({
  steerX: 0,
  steerY: 0,
  fire: false,
  bomb: false,
  roll: false,
  boost: false,
  brake: false,
  pause: false,
});

const KEY = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  fire: ['KeyJ', 'KeyZ'],
  bomb: ['KeyK', 'KeyX'],
  roll: ['KeyL', 'KeyC'],
  boost: ['ShiftLeft', 'ShiftRight'],
  brake: ['ControlLeft', 'ControlRight'],
  pause: ['Escape', 'KeyP'],
};

export const KEY_CODES = [...new Set(Object.values(KEY).flat())];

// Standard gamepad: 0 Cross, 1 Circle, 2 Square, 4 L1, 5 R1, 6 L2, 7 R2,
// 9 Options, 12–15 d-pad. Axes are the W3C stick: x right, y down.
const PAD = { fire: 0, roll: [1, 4, 5], bomb: 2, brake: 6, boost: 7, pause: 9, left: 12, down: 13, right: 14, up: 15 };

const DEAD = 0.18;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function keyDown(keys, codes) {
  if (!keys) return false;
  for (const code of codes) if (keys[code]) return true;
  return false;
}

function padButton(buttons, index) {
  if (!buttons) return false;
  const v = buttons[index];
  if (v == null || v === false) return false;
  if (v === true) return true;
  if (typeof v === 'number') return v > 0.45;
  return !!(v.pressed || (typeof v.value === 'number' && v.value > 0.45));
}

function anyPad(buttons, indices) {
  for (const index of indices) if (padButton(buttons, index)) return true;
  return false;
}

function stick(axes) {
  const x = axes?.[0] ?? 0;
  const y = axes?.[1] ?? 0;
  const mag = Math.hypot(x, y);
  if (mag <= DEAD) return { x: 0, y: 0 };
  const scale = Math.min(1, (mag - DEAD) / (1 - DEAD)) / mag;
  return { x: x * scale, y: y * scale };
}

/**
 * @param {{ keyboard?: Record<string, boolean>, gamepad?: { axes?: number[], buttons?: unknown }, mouse?: { x?: number, y?: number, buttons?: number, active?: boolean }, touch?: { stick?: { x?: number, y?: number }, fire?: boolean, bomb?: boolean, roll?: boolean, boost?: boolean, brake?: boolean, pause?: boolean } }} sample
 */
export function mapActions(sample = {}) {
  const keys = sample.keyboard;
  const buttons = sample.gamepad?.buttons;
  let steerX = 0;
  let steerY = 0;
  if (keyDown(keys, KEY.left)) steerX -= 1;
  if (keyDown(keys, KEY.right)) steerX += 1;
  if (keyDown(keys, KEY.up)) steerY += 1;
  if (keyDown(keys, KEY.down)) steerY -= 1;
  if (padButton(buttons, PAD.left)) steerX -= 1;
  if (padButton(buttons, PAD.right)) steerX += 1;
  if (padButton(buttons, PAD.up)) steerY += 1;
  if (padButton(buttons, PAD.down)) steerY -= 1;
  const analog = stick(sample.gamepad?.axes);
  // W3C axis y is positive down. Steer y is positive up.
  steerX += analog.x;
  steerY -= analog.y;
  const mouse = sample.mouse;
  if (mouse && mouse.active !== false && (mouse.x || mouse.y)) {
    steerX += clamp(mouse.x ?? 0, -1, 1);
    steerY += clamp(mouse.y ?? 0, -1, 1);
  }
  const touch = sample.touch;
  if (touch?.stick) {
    steerX += touch.stick.x ?? 0;
    steerY += touch.stick.y ?? 0;
  }
  const mouseButtons = mouse?.buttons ?? 0;
  const wheel = mouse?.wheel ?? 0;
  return {
    steerX: clamp(steerX, -1, 1),
    steerY: clamp(steerY, -1, 1),
    fire: keyDown(keys, KEY.fire) || padButton(buttons, PAD.fire) || !!(mouseButtons & 1) || !!touch?.fire,
    bomb: keyDown(keys, KEY.bomb) || padButton(buttons, PAD.bomb) || !!(mouseButtons & 2) || !!touch?.bomb,
    roll: keyDown(keys, KEY.roll) || anyPad(buttons, PAD.roll) || !!(mouseButtons & 4) || !!touch?.roll,
    // Wheel up boosts. Wheel down, or the 5th mouse button, brakes.
    boost: keyDown(keys, KEY.boost) || padButton(buttons, PAD.boost) || wheel < 0 || !!touch?.boost,
    brake: keyDown(keys, KEY.brake) || padButton(buttons, PAD.brake) || wheel > 0 || !!(mouseButtons & 16) || !!touch?.brake,
    // 4th mouse button (browser Back, bit 8) pauses. Middle click stays the roll.
    pause: keyDown(keys, KEY.pause) || padButton(buttons, PAD.pause) || !!(mouseButtons & 8) || !!touch?.pause,
  };
}

/**
 * Build a mapActions sample from a Pixel Engine Input (or a lookalike).
 * Gamepad buttons are not passed here: the engine already turns them into
 * key codes through input.gamepadButtons, and those codes are the KEY list.
 * Sticks are read from padAxis (y forward / up) and touch analog (same sign).
 */
export function sampleFromEngine(input) {
  const keyboard = {};
  for (const code of KEY_CODES) if (input.isDown(code)) keyboard[code] = true;
  const over = !!input.pointer?.over;
  return {
    keyboard,
    mouse: {
      x: input.pointer?.x ?? 0,
      y: input.pointer?.y ?? 0,
      buttons: input.mouseButtons ?? 0,
      wheel: input.wheel ?? 0,
      active: over,
    },
    touch: {
      stick: { x: input.analog?.x ?? 0, y: input.analog?.y ?? 0 },
    },
    gamepad: {
      axes: [input.padAxis?.x ?? 0, -(input.padAxis?.y ?? 0)],
      buttons: [],
    },
  };
}

/** Remap a standard gamepad onto the same key codes mapActions reads. */
export const GAMEPAD_TO_KEYS = {
  0: 'KeyJ',
  1: 'KeyL',
  2: 'KeyK',
  4: 'KeyL',
  5: 'KeyL',
  6: 'ControlLeft',
  7: 'ShiftLeft',
  9: 'Escape',
  12: 'ArrowLeft',
  13: 'ArrowDown',
  14: 'ArrowRight',
  15: 'ArrowUp',
};
