import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { createGame } from './game.js';

const kit = await boot({
  title: 'Petalwind Meadow',
  accent: '#6dccab',
  background: '#334a79',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    jump: { keys: ['Space', 'Enter', 'NumpadEnter'], gamepad: ['A'], touch: 'Jump' },
    inhale: { keys: ['KeyJ'], mouse: [0], gamepad: ['X', 'RT'], touch: 'Inhale' },
    ability: { keys: ['KeyK', 'ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['B', 'LT'], touch: 'Ability' },
    zoomIn: { gamepad: ['RB'] },
    zoomOut: { gamepad: ['LB'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  },
  // The II pill sits on the right, just under the HUD, clear of the stick and buttons.
  touch: { top: 'right', topOffset: 90 },
});

// The HUD is taller on portrait phones and slimmer on short landscape ones (see style.css),
// so the pill follows it down or up.
const hudLayouts = [
  [matchMedia('(max-width: 720px) and (orientation: portrait)'), 155],
  [matchMedia('(max-height: 500px) and (orientation: landscape)'), 70],
];
const placePausePill = () => kit.touch?.placeTop('right', hudLayouts.find(([mq]) => mq.matches)?.[1] ?? 90);
for (const [mq] of hudLayouts) mq.addEventListener('change', placePausePill);
placePausePill();

const renderer = kit.renderer;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(38, 1, 0.1, 240));
const game = createGame({ kit, scene, camera });

// Soft bloom on the glowing bells, petals and gear (the game's look on every tier).
const post = createPost(kit, scene, camera, { bloom: { strength: 0.3, radius: 0.2, threshold: 0.72 } });

// Compile every material's pipelines up front (the boss and effects appear later).
scene.add(game.prewarm);
try {
  await renderer.compileAsync(scene, camera);
} catch (err) {
  console.warn('Petalwind: shader pre-compile skipped', err);
}
scene.remove(game.prewarm);

kit.start((dt, t) => {
  game.frame(dt, t);
  post.render();
});
