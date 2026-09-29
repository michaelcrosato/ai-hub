/* Good Company — startup on the shared 3D kit: three.js r186 (WebGPU, WebGL2 fallback),
   kit input for keyboard/mouse, controller and touch, and the kit's settings panel (F9). */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { Sound } from './audio.js';
import { createApp } from './app.js';

THREE.ColorManagement.enabled = false;

const kit = await boot({
  title: 'Good Company',
  canvas: document.getElementById('renderCanvas'),
  mount: document.getElementById('world'),
  gear: 'none', // the game's pause menu and Settings have "Graphics & controls" (F9 too)
  accent: '#d49764',
  background: '#375c48',
  touch: { hint: false }, // tap to walk, pinch to zoom: no stick or buttons over the panels
  input: {
    // Walking (keyboard and left stick). Inside dialogs it moves between buttons instead.
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick' },
    // The D-pad moves focus through the interface.
    nav: { type: 'vector', gamepad: 'dpad' },
    // Right stick: zoom, flick to turn, or scroll the panel you are in.
    cam: { type: 'look', mouse: 'none', gamepad: 'rightStick' },
    confirm: { gamepad: ['A'] },
    back: { gamepad: ['B'] },
    interact: { keys: ['KeyF'], gamepad: ['X'] },
    clock: { keys: ['Space'], gamepad: ['Y'] },
    rotL: { keys: ['KeyQ'], gamepad: ['LB'] },
    rotR: { keys: ['KeyE'], gamepad: ['RB'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'] },
    recenter: { keys: ['Home'], gamepad: ['RS'] },
    home: { keys: ['KeyH'], gamepad: ['Back'] },
    tabPrev: { gamepad: ['LT'] },
    tabNext: { gamepad: ['RT'] },
    cancel: { keys: ['Escape'] },
    pause: { keys: ['KeyP'], gamepad: ['Start'] },
    quick1: { keys: ['Digit1', 'Numpad1'] },
    quick2: { keys: ['Digit2', 'Numpad2'] },
    quick3: { keys: ['Digit3', 'Numpad3'] },
    quick4: { keys: ['Digit4', 'Numpad4'] },
    quick5: { keys: ['Digit5', 'Numpad5'] },
  },
});

// Babylon drew this town in gamma space: keep colours unconverted, as they were.
kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.renderer.shadowMap.enabled = true;
kit.renderer.shadowMap.type = THREE.PCFShadowMap;

kit.loading.progress(0.7, 'Building the neighborhood…');
const sound = new Sound();
kit.onPause((paused) => sound.suspend(paused));
const app = createApp({ kit, sound });

kit.loading.progress(0.9, 'Setting the table…');
try {
  await app.town.compile();
} catch (err) {
  console.warn('[good-company] pre-compile skipped:', err);
}
kit.start(app.frame);
app.ready();
