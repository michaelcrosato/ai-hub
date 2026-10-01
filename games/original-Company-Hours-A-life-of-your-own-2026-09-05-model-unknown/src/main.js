/* Company Hours — startup on the shared 3D kit: three.js r186 (WebGPU, WebGL2 fallback),
   kit.input for keyboard and mouse, controller and touch, and the kit's settings panel (F9,
   or Graphics & controls in the game's pause menu and settings). */

import { boot } from 'kit/boot.js';
import { VERSION, newGame } from './sim.js';
import { Interface } from './ui.js';
import { Town } from './town.js';

const quick = (n) => ({ keys: [`Digit${n}`, `Numpad${n}`] });

// The town behind the title screen is a fresh, seeded career until the player starts or continues.
const state = newGame({ name: 'Rowan', seed: 826061, shirt: '#739780' });
const ui = new Interface(document.getElementById('app'), state);

const kit = await boot({
  title: 'Company Hours',
  canvas: document.getElementById('world'),
  mount: document.getElementById('app'),
  gear: 'none', // the game's menu and settings open the kit panel ("Graphics & controls"), F9 too
  accent: '#d8ed9d',
  background: '#3d7057',
  // Pointer-driven: tap to walk or visit, drag to pan, pinch to zoom. No stick or buttons.
  touch: { hint: false },
  input: {
    // Walking: keys and the left stick (in menus the stick moves between buttons).
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick' },
    // The D-pad, and the arrow keys in menus, move focus through the interface.
    nav: { type: 'vector', keys: 'arrows', gamepad: 'dpad' },
    // Right stick: turn and zoom the camera in town, scroll in panels and dialogs.
    stick: { type: 'vector', gamepad: 'rightStick' },
    // Dragging the view pans it (mouse button held, or one finger).
    drag: { type: 'look', mouse: 'drag', gamepad: [], touch: 'drag' },
    confirm: { gamepad: ['A'] },
    back: { keys: ['Escape'], gamepad: ['B'] },
    pause: { keys: ['KeyP'], gamepad: ['Start'] },
    interact: { keys: ['Enter', 'NumpadEnter'], gamepad: ['X'] },
    clock: { keys: ['Space'], gamepad: ['Y'] },
    speed: { keys: ['KeyT'] },
    rotL: { keys: ['KeyQ'], gamepad: ['LB'] },
    rotR: { keys: ['KeyE'], gamepad: ['RB'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'] },
    recenter: { keys: ['KeyF'], gamepad: ['RS'] },
    home: { keys: ['KeyH'], gamepad: ['Back'] },
    tabPrev: { gamepad: ['LT'] },
    tabNext: { gamepad: ['RT'] },
    quick1: quick(1),
    quick2: quick(2),
    quick3: quick(3),
    quick4: quick(4),
    quick5: quick(5),
    quick6: quick(6),
  },
});

kit.loading.progress(0.7, 'Building the waterfront…');
const world = new Town({ kit, state, labels: document.getElementById('world-labels') });
ui.attach(world, kit);

kit.loading.progress(0.9, 'Making a little room for possibility…');
try {
  await world.compile();
} catch (err) {
  console.warn('[company-hours] pre-compile skipped:', err);
}
kit.start((dt) => ui.frame(dt));

window.CompanyHours = Object.freeze({
  version: VERSION,
  getState: () => structuredClone(ui.s),
  metrics: () => world.getMetrics(),
});
if (new URLSearchParams(location.search).has('test') || window.__GC_TEST) window.__GC = { ui, world, kit };
