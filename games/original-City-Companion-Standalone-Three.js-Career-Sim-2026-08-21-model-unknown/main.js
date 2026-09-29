// Boots the shared 3D kit (WebGPU with WebGL2 fallback), wires the input
// actions, builds the game and runs the loop.

import { boot } from 'kit/boot.js';
import { Game } from './game.js';
import { Sound } from './audio.js';

function showFatal(err) {
  console.error(err);
  const root = document.querySelector('#three-root');
  document.querySelector('#start-screen')?.classList.add('hidden');
  if (!root) return;
  const box = document.createElement('div');
  box.className = 'fatal-card';
  box.innerHTML = '<div><strong>The game could not start</strong><p>Use a current browser with WebGPU or WebGL2 enabled, then reload.</p><pre></pre></div>';
  box.querySelector('pre').textContent = String(err?.message || err);
  root.append(box);
}

try {
  const kit = await boot({
    title: 'City Companion',
    mount: document.querySelector('#three-root'),
    // The game's own pause menu has a Settings button (kit.menu.open); F9 still works.
    gear: 'none',
    accent: '#4bc7a5',
    background: '#17324a',
    // Bright city: dark touch controls; no stick (tap to walk), so no idle ring.
    touch: { theme: 'light', hint: false },
    input: {
      move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' },
      confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
      interact: { keys: ['KeyE'], gamepad: ['A'], touch: 'Visit' },
      back: { keys: ['Backspace'], gamepad: ['B'] },
      phone: { keys: ['KeyQ'], gamepad: ['Y'] },
      travel: { keys: ['KeyG'], gamepad: ['X'] },
      speed: { keys: ['KeyT'], gamepad: ['Back'] },
      pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
      zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
      zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
      // Only left clicks walk; the pointer itself comes from kit.input.pointer.
      select: { mouse: [0] },
    },
  });

  const sound = new Sound();
  const game = new Game(kit, sound);
  window.cityCompanion = game;

  try {
    // Compile every pipeline up front so the first seconds do not stutter.
    await kit.renderer.compileAsync(game.world.scene, game.world.camera);
  } catch (err) {
    console.warn('Pipeline pre-compile skipped:', err);
  }

  kit.start((dt) => game.frame(dt));
} catch (err) {
  showFatal(err);
}
