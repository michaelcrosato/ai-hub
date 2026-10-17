// Original models for Harbor Quiet. Data only; the engine builds the meshes.
import { model } from './pixel-engine.js';

/** Low coupe. Chassis space: origin at the body centre, nose toward +Z. floats so the belly can sit below y = 0. */
export const lark = model({
  id: 'lark-coupe',
  about: 'Low two-door coupe with a long nose and a short cabin, the job car',
  tags: ['vehicle', 'car'],
  floats: true,
  collider: 'none',
  palette: { paint: 'orange', glass: 'navy', trim: 'ink', lamp: 'sand', dark: 'plum' },
  parts: [
    { box: [1.65, 0.38, 3.2], at: [0, -0.02, 0.05], c: 'paint' },
    { box: [1.5, 0.32, 1.15], at: [0, 0.28, -0.45], c: 'paint' },
    { box: [1.35, 0.22, 0.95], at: [0, 0.32, -0.42], c: 'glass' },
    { box: [0.28, 0.1, 0.08], at: [0.55, 0.02, 1.58], c: 'lamp' },
    { box: [0.28, 0.1, 0.08], at: [-0.55, 0.02, 1.58], c: 'lamp' },
    { box: [1.5, 0.1, 0.08], at: [0, 0.02, -1.58], c: 'trim' },
    { box: [0.7, 0.06, 0.4], at: [0, 0.18, 1.15], c: 'dark' },
  ],
});

export const sedan = model({
  id: 'reach-sedan',
  about: 'Plain four-door sedan, taller roof, city traffic and a parked spare',
  tags: ['vehicle', 'car'],
  floats: true,
  collider: 'none',
  palette: { paint: 'slate', glass: 'navy', trim: 'ink', lamp: 'sand', dark: 'mist' },
  parts: [
    { box: [1.62, 0.4, 3.15], at: [0, -0.02, 0], c: 'paint' },
    { box: [1.48, 0.4, 1.55], at: [0, 0.32, -0.15], c: 'paint' },
    { box: [1.32, 0.26, 1.3], at: [0, 0.36, -0.12], c: 'glass' },
    { box: [0.26, 0.1, 0.08], at: [0.52, 0.04, 1.52], c: 'lamp' },
    { box: [0.26, 0.1, 0.08], at: [-0.52, 0.04, 1.52], c: 'lamp' },
    { box: [1.45, 0.1, 0.08], at: [0, 0.04, -1.55], c: 'trim' },
  ],
});

export const van = model({
  id: 'quay-van',
  about: 'Box van with a tall cargo house and a short hood',
  tags: ['vehicle', 'van'],
  floats: true,
  collider: 'none',
  palette: { paint: 'teal', glass: 'navy', trim: 'ink', lamp: 'sand', dark: 'slate' },
  parts: [
    { box: [1.7, 0.42, 3.3], at: [0, 0, 0.1], c: 'paint' },
    { box: [1.62, 0.7, 1.9], at: [0, 0.5, -0.45], c: 'dark' },
    { box: [1.4, 0.28, 0.7], at: [0, 0.48, 0.7], c: 'glass' },
    { box: [0.22, 0.1, 0.08], at: [0.55, 0.08, 1.62], c: 'lamp' },
    { box: [0.22, 0.1, 0.08], at: [-0.55, 0.08, 1.62], c: 'lamp' },
    { box: [1.5, 0.12, 0.08], at: [0, 0.1, -1.6], c: 'trim' },
  ],
});

export const cruiser = model({
  id: 'warden-cruiser',
  about: 'Warden patrol car: dark body, a light bar, and a pale door stripe',
  tags: ['vehicle', 'car', 'police'],
  floats: true,
  collider: 'none',
  palette: { paint: 'navy', glass: 'ink', trim: 'mist', lamp: 'cyan', bar: 'red', stripe: 'white' },
  parts: [
    { box: [1.64, 0.4, 3.2], at: [0, -0.02, 0], c: 'paint' },
    { box: [1.5, 0.38, 1.4], at: [0, 0.3, -0.2], c: 'paint' },
    { box: [1.32, 0.22, 1.15], at: [0, 0.34, -0.18], c: 'glass' },
    { box: [0.7, 0.1, 0.28], at: [0, 0.52, -0.15], c: 'bar' },
    { box: [0.16, 0.08, 0.16], at: [0.18, 0.58, -0.15], c: 'lamp', glow: true },
    { box: [1.55, 0.08, 0.06], at: [0, 0.08, 0.4], c: 'stripe' },
    { box: [0.24, 0.1, 0.08], at: [0.52, 0.04, 1.54], c: 'lamp' },
    { box: [0.24, 0.1, 0.08], at: [-0.52, 0.04, 1.54], c: 'lamp' },
    { box: [1.4, 0.1, 0.08], at: [0, 0.04, -1.56], c: 'trim' },
  ],
});

export const citizen = model({
  id: 'reach-citizen',
  about: 'Chunky coat-and-cap pedestrian, no bones; the game bobs the whole mesh',
  tags: ['character', 'npc'],
  collider: 'none',
  palette: { coat: 'teal', skin: 'sand', hair: 'ink', shoe: 'night', shade: 'plum' },
  parts: [
    { box: [0.46, 0.62, 0.28], at: [0, 0.95, 0], c: 'coat' },
    { box: [0.2, 0.4, 0.18], at: [-0.18, 0.85, 0], c: 'shade' },
    { box: [0.2, 0.4, 0.18], at: [0.18, 0.85, 0], c: 'shade' },
    { box: [0.3, 0.28, 0.26], at: [0, 1.4, 0], c: 'skin' },
    { box: [0.32, 0.14, 0.3], at: [0, 1.58, 0], c: 'hair' },
    { box: [0.16, 0.36, 0.18], at: [-0.12, 0.22, 0], c: 'shoe' },
    { box: [0.16, 0.36, 0.18], at: [0.12, 0.22, 0], c: 'shoe' },
  ],
});

export const sidearm = model({
  id: 'sidearm',
  about: 'Compact pistol, grip down, barrel toward +Z, carried at the hip',
  tags: ['weapon', 'gun'],
  floats: true,
  collider: 'none',
  palette: { body: 'ink', slide: 'mist', grip: 'plum' },
  parts: [
    { box: [0.06, 0.1, 0.22], at: [0, 0.08, 0.04], c: 'slide' },
    { box: [0.05, 0.08, 0.16], at: [0, 0.04, 0], c: 'body' },
    { box: [0.05, 0.1, 0.05], at: [0, -0.04, -0.04], c: 'grip' },
  ],
});
