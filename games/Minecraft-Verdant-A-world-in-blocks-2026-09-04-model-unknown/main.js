// Verdant — a living voxel world on the shared 3D stack (three.js r186 via kit/boot.js).
//
// The kit starts the renderer (WebGPU, WebGL2 as fallback), sizes the canvas,
// runs the loop and turns keyboard, mouse, gamepad and touch into the actions
// below. The game only ever asks about actions.

import { boot } from 'kit/boot.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Ambience } from './audio.js';
import { Journal } from './journal.js';

const kit = await boot({
  title: 'Verdant',
  canvas: document.getElementById('world'),
  // The game's own menu has a "Graphics & controls" button (and F9 still works);
  // a gear in the top-right corner would sit on the sound, menu and settings buttons.
  gear: 'none',
  // The loading card stays up until the first view has streamed in and compiled.
  holdLoading: true,
  accent: '#86ab5e',
  background: '#273e32',
  // The top pills sit under the brand bar; the day scene is bright, so dark controls.
  touch: { top: 'center', topOffset: 70, theme: 'light' },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    // Cluster buttons: the first one is the big primary button.
    rise: { keys: ['Space', 'KeyE'], gamepad: ['A'], touch: 'Rise' },
    descend: { keys: ['KeyQ'], gamepad: ['B'], touch: 'Down' },
    fast: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RT', 'LS'], touch: 'Fast' },
    capture: { keys: ['Enter', 'NumpadEnter'], gamepad: ['X'], touch: 'Snap' },
    // Top pills.
    mode: { keys: ['KeyF'], gamepad: ['Y'], touch: { label: 'Walk', slot: 'top' } },
    map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
    journal: { keys: ['KeyJ'], gamepad: ['RB'], touch: { label: 'Journal', slot: 'top' } },
    photo: { keys: ['KeyC'], gamepad: ['LB'], touch: { label: 'Photo', slot: 'top' } },
    // Keyboard and gamepad only (touch has the toolbar pills and World settings).
    walk: { keys: ['Digit1', 'Numpad1'] },
    fly: { keys: ['Digit2', 'Numpad2'] },
    lantern: { keys: ['KeyL'], gamepad: ['RS'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    // Menus: move steps between controls, confirm activates, back closes.
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});

const journal = new Journal();
const ambience = new Ambience();
const game = new Game(kit);
const ui = new UI(game, kit, { ambience, journal });

// Audio pauses with the loop (the kit's settings panel) and with a hidden tab.
kit.onPause((paused) => ambience.hold('kit', paused));
document.addEventListener('visibilitychange', () => {
  ambience.hold('hidden', document.hidden);
  if (document.hidden) ui.save();
});
addEventListener('pagehide', () => ui.save());

kit.start((dt) => {
  ui.frame(dt);
  game.step(dt);
});

// A small window for automated checks, as before.
window.verdant = {
  game,
  ui,
  version: '0.3.0',
  snapshot: () => ({
    seed: game.world.seed,
    position: game.camera.position.toArray(),
    mode: game.controls.mode,
    hour: game.hour,
    weather: game.weather,
    paused: game.paused,
    started: ui.started,
    source: kit.input.source,
    journal: `${journal.done}/${journal.total}`,
    animals: game.wildlife.animals.map(({ id, species, state, hunger, thirst, fatigue, x, z }) => ({ id, species, state, hunger, thirst, fatigue, x, z })),
    chunks: game.chunks.chunks.size,
    pending: game.chunks.queue.length,
  }),
};
