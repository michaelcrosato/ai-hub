// Original townsfolk for the Ochre Ward. Recolour with buildModel's palette.
import { model } from './pixel-engine.js';

export const townsfolk = model({
  id: 'townsfolk',
  about: 'Sun-bleached townsfolk in a robe and a short headcloth',
  tags: ['person', 'crowd'],
  palette: { cloth: 'sand', band: 'red', skin: 'orange', wrap: 'white' },
  size: [0.8, 1.8, 0.55],
  collider: 'none',
  parts: [
    { cyl: [0.46, 1.08, 0.4], at: [0, 0.54, 0], c: 'cloth', seg: 8 },
    { box: [0.5, 0.1, 0.22], at: [0, 0.92, 0.02], c: 'band' },
    { ball: [0.24, 0.26, 0.24], at: [0, 1.26, 0], c: 'skin' },
    { box: [0.34, 0.1, 0.32], at: [0, 1.4, 0], c: 'wrap' },
    { box: [0.1, 0.32, 0.1], at: [0.24, 0.82, 0], c: 'skin' },
    { box: [0.1, 0.32, 0.1], at: [-0.24, 0.82, 0], c: 'skin' },
  ],
});

export const wardGuard = model({
  id: 'ward-guard',
  about: 'Ward guard in a dark coat with a short staff',
  tags: ['person', 'guard'],
  palette: { cloth: 'navy', band: 'red', skin: 'orange', wrap: 'slate', staff: 'night' },
  size: [0.95, 1.9, 0.55],
  collider: 'none',
  parts: [
    { cyl: [0.48, 1.1, 0.42], at: [0, 0.55, 0], c: 'cloth', seg: 8 },
    { box: [0.52, 0.1, 0.24], at: [0, 0.96, 0.02], c: 'band' },
    { ball: [0.24, 0.26, 0.24], at: [0, 1.28, 0], c: 'skin' },
    { box: [0.36, 0.12, 0.34], at: [0, 1.44, 0], c: 'wrap' },
    { box: [0.08, 1.35, 0.08], at: [0.38, 0.72, 0], c: 'staff' },
  ],
});
