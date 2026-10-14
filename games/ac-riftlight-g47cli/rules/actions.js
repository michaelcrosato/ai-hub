// One action set for a couch pad, a keyboard, and touch.
// Gamepad indices are the W3C standard layout:
// 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle, 4 LB, 5 RB, 6 LT, 7 RT, 9 Start, 12-15 d-pad.
// Left stick is move. Right stick is look. The engine already turns those axes into
// moveAxis() and the camera orbit. Buttons press the same key codes the keyboard uses.

export const ACTIONS = Object.freeze(['move', 'look', 'profile', 'jump', 'assassinate', 'counter', 'eagle']);

export const GAMEPAD_MAP = Object.freeze({
  axes: Object.freeze({ 0: 'move', 1: 'move', 2: 'look', 3: 'look' }),
  buttons: Object.freeze({
    0: 'jump',
    1: 'assassinate',
    2: 'counter',
    3: 'eagle',
    4: 'profile',
    6: 'profile',
    7: 'assassinate',
  }),
});

/** Button index → key code pressed on the engine input. */
export const GAMEPAD_KEYS = Object.freeze({
  0: 'Space',
  1: 'KeyF',
  2: 'KeyG',
  3: 'KeyV',
  4: 'ShiftLeft',
  6: 'ShiftLeft',
  7: 'KeyF',
  9: 'Enter',
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight',
});

export const KEY_MAP = Object.freeze({
  KeyW: 'move',
  KeyA: 'move',
  KeyS: 'move',
  KeyD: 'move',
  ArrowUp: 'move',
  ArrowDown: 'move',
  ArrowLeft: 'move',
  ArrowRight: 'move',
  MouseX: 'look',
  MouseY: 'look',
  ShiftLeft: 'profile',
  ShiftRight: 'profile',
  Space: 'jump',
  KeyF: 'assassinate',
  KeyG: 'counter',
  KeyV: 'eagle',
});

export const TOUCH_MAP = Object.freeze({
  stick: 'move',
  drag: 'look',
  ShiftLeft: 'profile',
  Space: 'jump',
  KeyF: 'assassinate',
  KeyG: 'counter',
  KeyV: 'eagle',
});

// Centres measured inward from the bottom-right. Two columns, clear of a
// left-hand stick on a 390-wide phone, and clear of each other at size 64.
export const TOUCH_BUTTONS = Object.freeze([
  { label: 'HIGH', code: 'ShiftLeft', hint: 'run', at: { x: 48, y: 318, size: 74 } },
  { label: 'JUMP', code: 'Space', hint: 'climb', at: { x: 136, y: 318, size: 74 } },
  { label: 'BLADE', code: 'KeyF', hint: 'kill', at: { x: 48, y: 230, size: 74 } },
  { label: 'EAGLE', code: 'KeyV', hint: 'sight', at: { x: 136, y: 230, size: 74 } },
  { label: 'PARRY', code: 'KeyG', hint: 'counter', at: { x: 92, y: 128, size: 86 } },
  { label: 'RESET', code: 'Enter', hint: 'again', at: { x: 40, y: 400, size: 58 } },
]);

export function actionForGamepadButton(index) {
  return GAMEPAD_MAP.buttons[index] ?? null;
}

export function actionForKey(code) {
  return KEY_MAP[code] ?? null;
}

export function actionForTouch(code) {
  return TOUCH_MAP[code] ?? null;
}
