/**
 * main.js — boots the shared 3D kit, builds the flight scene, mounts the
 * React interface and runs the one frame loop.
 */

import { boot } from 'kit/boot.js';
import { createRoot, jsx } from './react.js';
import { Career } from './data.js';
import { FlightController } from './flight.js';
import { ACTIONS, MenuNavigator } from './controls.js';
import { Sfx } from './audio.js';
import { App } from './ui.js';

const canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
canvas.setAttribute('aria-label', 'Voidrunner three-dimensional isometric game world');

const kit = await boot({
  title: 'Voidrunner: Neon Frontier',
  canvas,
  input: ACTIONS,
  // The HUD owns every corner; Settings in the game's menus opens the kit panel.
  gear: 'none',
  // The pills sit under the top HUD row; style.css moves the top-centre HUD below them.
  touch: { top: 'center', topOffset: 84 },
  accent: '#62e8ff',
  background: '#030915',
});

kit.loading.progress(0.7, 'Charting the local grid…');
const model = new Career();
// Synthesized sound: starts on the first gesture, follows the Sound effects setting.
const sfx = new Sfx(() => model.state.settings);
kit.onPause((paused) => sfx.setPaused(paused));
const flight = new FlightController(kit, model);
flight.sfx = sfx;
flight.init();

/**
 * What the React app shares with the loop: the current screen and the
 * transitions the original bound to Escape and M.
 */
const bridge = {
  mode: 'title',
  onPause: () => {},
  onOpenMap: () => {},
  onCloseMap: () => {},
};

const menu = new MenuNavigator(kit.input);

createRoot(document.getElementById('root')).render(jsx(App, { kit, flight, model, canvas, bridge, sfx }));

// Leaving the tab pauses flight, as the original did.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && bridge.mode === 'flight' && model.state.started) bridge.onPause();
});

kit.start((dt) => {
  const input = kit.input;
  if (bridge.mode === 'flight') {
    menu.active = false;
    if (input.pressed('pause')) bridge.onPause();
    else if (input.pressed('map')) bridge.onOpenMap();
    // The original clamped its step at 33 ms: slow frames slow the game rather than let bolts tunnel.
    else if (!flight.paused && model.state.started) flight.update(Math.min(dt, 0.033));
  } else {
    menu.active = true;
    menu.update({
      back: () => bridge.onPause(),
      map: () => bridge.onCloseMap(),
    });
  }
  flight.render(dt);
});
