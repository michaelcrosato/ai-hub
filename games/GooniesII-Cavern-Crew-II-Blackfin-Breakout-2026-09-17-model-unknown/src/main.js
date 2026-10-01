// Cavern Crew II: Blackfin Breakout — startup on the shared 3D kit
// (three.js r186 WebGPURenderer with its WebGL2 fallback, kit input and touch controls).
import { boot } from 'kit/boot.js';
import { startGame, INPUT } from './game.js';

const root = document.getElementById('game-root');

function showFatal(message) {
  const el = document.getElementById('fatal-error');
  el.querySelector('p').textContent = message;
  el.classList.add('show');
  document.getElementById('fatal-reload').addEventListener('click', () => location.reload());
}

const kit = await boot({
  title: 'Cavern Crew II: Blackfin Breakout',
  mount: root,
  input: INPUT,
  // The title and pause menus have their own Settings buttons (F9 still opens the panel).
  gear: 'none',
  // The pause pill sits under the HUD's left panel (re-placed on resize by the game).
  touch: { top: 'left', topOffset: 96 },
  accent: '#de6b31',
  background: '#071117'
});

try {
  await startGame(kit);
} catch (err) {
  console.error(err);
  kit.loading.done();
  showFatal(`Something went wrong while building the caves: ${err?.message || err}`);
}
