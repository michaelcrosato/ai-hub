// Original ships and pickups for Vesper Lane. Data only; the engine builds the meshes.
import { model, ModelCatalog } from './pixel-engine.js';

export const lark = model({
  id: 'lark',
  about: 'Two-wing rift skiff with a long nose and a cyan canopy',
  tags: ['ship', 'player'],
  floats: true,
  collider: 'none',
  size: [2.8, 0.85, 2.6],
  palette: { hull: 'sand', wing: 'slate', nose: 'white', glass: 'cyan', hot: 'orange' },
  parts: [
    { box: [0.48, 0.26, 1.3], at: [0, 0.32, -0.05], c: 'hull' },
    { box: [0.2, 0.14, 0.5], at: [0, 0.3, 0.82], c: 'nose' },
    { box: [0.26, 0.1, 0.28], at: [0, 0.48, 0.08], c: 'glass', glow: true },
    { name: 'wingL', pivot: true, at: [-0.62, 0.3, -0.12], group: [
      { box: [0.9, 0.07, 0.5], at: [0, 0, 0], c: 'wing' },
      { box: [0.2, 0.08, 0.18], at: [-0.26, 0.02, 0.18], c: 'hot' },
    ] },
    { name: 'wingR', pivot: true, at: [0.62, 0.3, -0.12], group: [
      { box: [0.9, 0.07, 0.5], at: [0, 0, 0], c: 'wing' },
      { box: [0.2, 0.08, 0.18], at: [0.26, 0.02, 0.18], c: 'hot' },
    ] },
    { box: [0.22, 0.14, 0.26], at: [0, 0.28, -0.78], c: 'hot' },
  ],
});

export const dart = model({
  id: 'dart',
  about: 'Small angular fighter with a red hull and a sand eye',
  tags: ['ship', 'enemy'],
  floats: true,
  collider: 'none',
  size: [1.7, 0.55, 1.5],
  palette: { hull: 'red', wing: 'orange', eye: 'sand' },
  parts: [
    { box: [0.34, 0.18, 0.85], at: [0, 0.24, 0], c: 'hull' },
    { box: [0.85, 0.06, 0.32], at: [0, 0.22, -0.08], c: 'wing' },
    { box: [0.12, 0.08, 0.1], at: [0, 0.36, 0.28], c: 'eye', glow: true },
  ],
});

export const warden = model({
  id: 'hull-warden',
  about: 'Heavy trench warden with a wide jaw and orange eyes',
  tags: ['ship', 'boss'],
  floats: true,
  collider: 'none',
  size: [6.4, 1.8, 3.4],
  palette: { hull: 'plum', plate: 'slate', jaw: 'red', eye: 'orange' },
  parts: [
    { box: [2.1, 0.62, 2.2], at: [0, 0.7, 0], c: 'hull' },
    { box: [5.2, 0.22, 0.9], at: [0, 0.55, 0.15], c: 'plate' },
    { box: [1.3, 0.4, 0.7], at: [0, 0.42, 1.2], c: 'jaw' },
    { box: [0.26, 0.18, 0.1], at: [-0.42, 0.95, 0.95], c: 'eye', glow: true },
    { box: [0.26, 0.18, 0.1], at: [0.42, 0.95, 0.95], c: 'eye', glow: true },
  ],
});

export const waygate = model({
  id: 'waygate',
  about: 'A cyan ring the skiff flies through to mark the trench',
  tags: ['gate', 'checkpoint'],
  floats: true,
  collider: 'none',
  size: [3.6, 3.6, 0.5],
  palette: { ring: 'cyan', tick: 'white' },
  parts: [
    { torus: [3.2, 0.18, 3.2], at: [0, 1.8, 0], rot: [90, 0, 0], c: 'ring' },
    { box: [0.16, 0.28, 0.16], at: [0, 3.3, 0], c: 'tick', glow: true },
  ],
});

export const burst = model({
  id: 'burst',
  about: 'An orange rift charge, a round bomb pickup',
  tags: ['pickup', 'bomb'],
  floats: true,
  collider: 'none',
  size: [0.7, 0.7, 0.7],
  palette: { core: 'orange', band: 'white' },
  parts: [
    { ball: [0.46, 0.46, 0.46], at: [0, 0.34, 0], c: 'core' },
    { box: [0.5, 0.08, 0.08], at: [0, 0.34, 0], c: 'band' },
  ],
});

export const lens = model({
  id: 'lens',
  about: 'Twin-lens weapon pickup, a glowing chevron',
  tags: ['pickup', 'weapon'],
  floats: true,
  collider: 'none',
  size: [0.9, 0.55, 0.4],
  palette: { hull: 'sand', glass: 'cyan', spark: 'white' },
  parts: [
    { box: [0.62, 0.12, 0.18], at: [0, 0.28, 0], c: 'hull' },
    { box: [0.16, 0.26, 0.12], at: [-0.24, 0.3, 0], c: 'glass' },
    { box: [0.16, 0.26, 0.12], at: [0.24, 0.3, 0], c: 'glass' },
    { box: [0.06, 0.06, 0.06], at: [-0.24, 0.3, 0.08], c: 'spark', glow: true },
    { box: [0.06, 0.06, 0.06], at: [0.24, 0.3, 0.08], c: 'spark', glow: true },
  ],
});

export const MODELS = new ModelCatalog([lark, dart, warden, waygate, burst, lens]);
