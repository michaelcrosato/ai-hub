/**
 * City After Dark — startup. Boots the shared kit (WebGPU with a WebGL2
 * fallback, quality tiers, input, touch controls, settings), builds the
 * city once, warms its shaders, then hands over to the game.
 */

import { boot } from 'kit/boot.js';
import { City } from './world.js';
import { initGame } from './game.js';
import { loadCareer } from './career.js';

const kit = await boot({
  title: 'City After Dark',
  canvas: document.getElementById('game-canvas'),
  // The top bar owns the top-right corner: its ⚙ button (and F9) opens the kit settings.
  gear: 'none',
  accent: '#f19ac2',
  background: '#080a10',
  input: {
    // First touch button is the big one: "Enter" only shows beside a location.
    interact: { keys: ['KeyE'], gamepad: ['A', 'X'], touch: 'Enter' },
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['B', 'LT'] },
    manage: { keys: ['Tab', 'KeyM'], gamepad: ['Y'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    speed: { keys: ['KeyT'], gamepad: ['Back'] },
    confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    prevTab: { keys: ['KeyQ'], gamepad: ['LB'] },
    nextTab: { keys: ['KeyR'], gamepad: ['RB'] },
  },
});

kit.loading.progress(0.75, 'Building the city…');
const city = new City(kit);
// Build the district of the saved career (if any) so Continue is instant.
const saved = loadCareer();
city.buildRegion(saved?.regionId || 'pacific', { compile: false });
kit.loading.progress(0.9, 'Preparing shaders…');
try {
  await kit.renderer.compileAsync(city.scene, city.camera);
} catch {
  // Compiling ahead is only an optimisation; the first frames compile anything left.
}
initGame(kit, city);
