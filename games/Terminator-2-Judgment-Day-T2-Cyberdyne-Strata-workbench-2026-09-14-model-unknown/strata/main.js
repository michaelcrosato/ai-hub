import './setup.js';
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { mountShell, createApp } from './app.js';
import { allExperiences } from './registry.js';
import { Workbench } from './editor/Workbench.js';
import { installUI } from './experiences/cyberdyne/UI.js';
import { ACTIONS } from './host/Input.js';

mountShell(true);
const kit = await boot({
  title: 'T2 Cyberdyne / Strata',
  canvas: document.getElementById('canvas'),
  mount: document.getElementById('viewport'),
  input: ACTIONS,
  gear: 'none', // the title, pause and workbench menus each open the shared settings
  holdLoading: true,
  touch: { top: 'center', topOffset: 64 },
  accent: '#c7e99d',
  background: '#0b1a2c',
});
kit.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
kit.loading.progress(0.8, 'Loading the Cyberdyne scene…');

let host;
try {
  host = await createApp(kit, allExperiences(), {
    studio: true,
    start: 'cyberdyne',
    createEditor: (h, onChange) => new Workbench(h, onChange),
  });
  installUI(host, { studio: true });
} finally {
  kit.loading.done();
}

// Browsers only start audio after a gesture: the first click, tap or key anywhere unlocks it.
const unlock = () => {
  host.audio.unlock();
  if (host.status !== 'play') host.audio.pause();
  removeEventListener('pointerdown', unlock, true);
  removeEventListener('keydown', unlock, true);
};
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);
