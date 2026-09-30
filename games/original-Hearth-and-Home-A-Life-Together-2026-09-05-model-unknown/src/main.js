/**
 * Hearth & Home — startup.
 *
 * The kit boots the renderer (WebGPU, WebGL2 fallback), input and the loading
 * card; the 3D stage is built; then React renders the game around it. The
 * canvas lives in a host element that the app places inside its scene panel.
 */
import { boot } from 'kit/boot.js';
import { h, createRoot } from './react.js';
import { INPUT } from './controls.js';
import { createStage } from './scene.js';
import { unlockAudio } from './audio.js';
import App from './app.js';

const host = document.createElement('div');
host.className = 'scene-host';

const kit = await boot({
    title: 'Hearth & Home',
    mount: host,
    holdLoading: true,
    gear: 'none', // the game's own settings dialog has a "Graphics & controls" button (and F9 works)
    renderer: { alpha: true },
    touch: { hint: false },
    input: INPUT,
    accent: '#d9b35e',
    background: '#f6f4e9',
});

// Audio starts on the first gesture, never before (see audio.js).
for (const type of ['pointerdown', 'keydown'])
    addEventListener(type, unlockAudio, { capture: true, passive: true });

const stage = createStage(kit);
window.__HEARTH_VERSION__ = '0.10.0';
createRoot(document.getElementById('root')).render(h(App, { kit, stage, host }));
kit.start((dt, t) => stage.frame(dt, t));
