import './setup.js';
import { boot } from 'kit/boot.js';
import { mountShell, createApp } from './app.js';
import { allExperiences } from './registry.js';
import { ACTIONS } from './host/Input.js';

// The cartridge player markup goes in first, so the kit's canvas lives in the stage under the top bar.
mountShell();
const kit = await boot({
  title: 'Strata / Northbound',
  canvas: document.getElementById('canvas'),
  mount: document.getElementById('viewport'),
  input: ACTIONS,
  gear: 'none', // the player's Settings dialog and the pause card open the shared settings
  holdLoading: true,
  touch: { top: 'right', topOffset: 72 },
  accent: '#c7e99d',
  background: '#19221c',
});
kit.loading.progress(0.8, 'Loading the Foundry…');

let host;
try {
  host = await createApp(kit, allExperiences());
} finally {
  kit.loading.done();
}

// Browsers only start audio after a gesture: the first click, tap or key anywhere unlocks it.
const unlock = () => {
  host?.audio.unlock();
  if (host && host.status !== 'play') host.audio.pause();
  removeEventListener('pointerdown', unlock, true);
  removeEventListener('keydown', unlock, true);
};
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);
