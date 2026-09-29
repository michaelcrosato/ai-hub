import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { VERSION } from './config.js';
import { ACTIONS } from './controls.js';
import { Game } from './game.js';

function showError(message, error) {
  console.error('Verdant startup:', error);
  document.getElementById('error-panel').classList.remove('hidden');
  document.getElementById('error-message').textContent = message;
  document.getElementById('error-detail').textContent = String(error?.message || error).slice(0, 800);
  document.getElementById('reload').onclick = () => location.reload();
  document.getElementById('recover-balanced').onclick = () => { window.__kitSettings?.set({ quality: 'low' }); location.reload(); };
}

async function start() {
  let kit;
  try {
    kit = await boot({
      title: 'Verdant Frontier',
      canvas: document.getElementById('world'),
      input: ACTIONS,
      // The game's own settings panel opens the kit panel; the HUD uses every corner.
      gear: 'none',
      touch: { top: 'left', topOffset: 10 },
      accent: '#f6bc70',
      background: '#14241f'
    });
  } catch (error) {
    // boot() already shows its own message when neither WebGPU nor WebGL2 starts.
    console.error('Verdant startup:', error);
    return;
  }
  let game;
  try {
    game = new Game(kit);
  } catch (error) {
    showError('The expedition could not start. Try Low graphics, or reload.', error);
    return;
  }
  try { await kit.renderer.compileAsync(game.rendering.scene, game.rendering.camera); } catch { /* pipelines compile on first use instead */ }
  kit.start(dt => game.tick(dt));
  window.Verdant = Object.freeze({
    version: VERSION, THREE, game, events: game.bus,
    registerSystem: (name, system) => game.registerSystem(name, system),
    save: () => game.save(true), diagnostics: () => game.diagnostics(),
    teleport: (x, z) => { if (!game.dev.enabled) throw new Error('Enable developer mode first.'); if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('Coordinates must be finite numbers.'); game.player.teleport(x, z); },
    dispose: () => game.dispose()
  });
}

start();
