// Every control goes through kit.input actions (keyboard + mouse, gamepad, touch),
// following the wall's standard bindings. The first touch button is the big one.
export const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  record: { keys: ['KeyE'], gamepad: ['X'], touch: 'Record' },
  pulse: { keys: ['KeyQ'], gamepad: ['RT'], touch: 'Pulse' },
  crouch: { keys: ['ControlLeft', 'ControlRight', 'KeyC'], gamepad: ['B'], touch: 'Crouch' },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'], touch: 'Run' },
  aim: { mouse: [2], gamepad: ['LT'] },
  beacon: { keys: ['KeyB'], gamepad: ['Y'], touch: { label: 'Beacon', slot: 'top' } },
  light: { keys: ['KeyF'], gamepad: ['LB'], touch: { label: 'Light', slot: 'top' } },
  journal: { keys: ['Tab'], gamepad: ['RB'], touch: { label: 'Log', slot: 'top' } },
  map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  dev: { keys: ['F3'] },
  fly: { keys: ['F6'] }
};

// Button prompts for each input source (kit.input.source).
export const PROMPTS = {
  move: { keyboard: 'W A S D', gamepad: 'Left stick', touch: 'Left thumb' },
  look: { keyboard: 'Mouse', gamepad: 'Right stick', touch: 'Drag right side' },
  jump: { keyboard: 'Space', gamepad: 'A', touch: 'Jump' },
  sprint: { keyboard: 'Shift', gamepad: 'L3 (toggle)', touch: 'Run (toggle)' },
  crouch: { keyboard: 'Ctrl / C', gamepad: 'B', touch: 'Crouch' },
  slide: { keyboard: 'Sprint + crouch', gamepad: 'Sprint + B', touch: 'Run + Crouch' },
  aim: { keyboard: 'Hold right mouse', gamepad: 'LT', touch: 'Pinch out / in' },
  pulse: { keyboard: 'Q', gamepad: 'RT', touch: 'Pulse' },
  record: { keyboard: 'E', gamepad: 'X', touch: 'Record' },
  beacon: { keyboard: 'B', gamepad: 'Y', touch: 'Beacon' },
  light: { keyboard: 'F', gamepad: 'LB', touch: 'Light' },
  map: { keyboard: 'M', gamepad: 'View', touch: 'Map' },
  journal: { keyboard: 'Tab', gamepad: 'RB', touch: 'Log' },
  pause: { keyboard: 'Esc', gamepad: 'Start', touch: 'II' },
  dev: { keyboard: 'F3', gamepad: 'Menu', touch: 'Menu' }
};

export const prompt = (action, source) => (PROMPTS[action] || {})[source === 'gamepad' || source === 'touch' ? source : 'keyboard'] || '';
