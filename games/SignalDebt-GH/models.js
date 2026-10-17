import { model, buildModel, setLookLayer } from './pixel-engine.js';

// Originals, authored in metres. Vehicle physics owns the chassis origin; the
// body is deliberately centred on it and wheel visuals attach separately.
export const CAR_MODEL = model({
  id: 'signal-courier-coupe',
  about: 'Compact coastal courier coupe with a low roof, orange coachwork and split lamps',
  tags: ['vehicle', 'car', 'original', 'courier'],
  floats: true,
  collider: 'none',
  palette: { paint: 'orange', lower: 'red', glass: 'navy', trim: 'ink', metal: 'mist', lamp: 'sand' },
  parts: [
    { box: [1.8, 0.48, 3.9], at: [0, -0.1, 0], c: 'paint', name: 'coachwork' },
    { box: [1.76, 0.14, 3.85], at: [0, -0.35, 0], c: 'lower' },
    { box: [1.7, 0.18, 1.1], at: [0, 0.23, 1.4], c: 'paint' },
    { box: [1.5, 0.58, 1.88], at: [0, 0.43, -0.29], c: 'glass', name: 'cabin' },
    { box: [1.54, 0.11, 1.94], at: [0, 0.765, -0.29], c: 'metal' },
    { box: [0.09, 0.6, 1.86], at: [0, 0.43, -0.29], c: 'trim', name: 'roof-spine' },
    { mirror: [{ box: [0.09, 0.6, 0.14], at: [0.75, 0.43, 0.60], c: 'paint' }], axis: 'x' },
    { mirror: [{ box: [0.09, 0.6, 0.15], at: [0.75, 0.43, -1.17], c: 'paint' }], axis: 'x' },
    { mirror: [{ box: [0.11, 0.07, 0.38], at: [0.925, 0.06, -0.35], c: 'metal' }], axis: 'x' },
    { box: [1.84, 0.16, 0.18], at: [0, -0.19, 2.02], c: 'trim' },
    { box: [1.84, 0.16, 0.18], at: [0, -0.19, -2.02], c: 'trim' },
    { box: [0.65, 0.16, 0.08], at: [0, 0.02, 1.97], c: 'trim' },
    { mirror: [{ box: [0.47, 0.19, 0.08], at: [0.6, 0.02, 1.97], c: 'lamp', glow: true }], axis: 'x' },
    { mirror: [{ box: [0.45, 0.18, 0.08], at: [0.62, 0.02, -1.97], c: 'lower', glow: true }], axis: 'x' },
    { box: [0.42, 0.18, 0.08], at: [0, -0.16, -2.13], c: 'metal' },
  ],
});

export const VAN_MODEL = model({
  id: 'signal-service-van',
  about: 'Teal utility van with pale cargo roof and a striped contractor flank',
  tags: ['vehicle', 'van', 'original', 'utility'],
  floats: true,
  collider: 'none',
  palette: { paint: 'teal', roof: 'mist', glass: 'navy', trim: 'ink', accent: 'sand', lamp: 'white', tail: 'red' },
  parts: [
    { box: [1.9, 0.52, 4.18], at: [0, -0.08, 0], c: 'paint' },
    { box: [1.82, 0.83, 2.55], at: [0, 0.59, -0.66], c: 'paint', name: 'cargo' },
    { box: [1.86, 0.12, 2.59], at: [0, 1.065, -0.66], c: 'roof' },
    { box: [1.66, 0.72, 1.31], at: [0, 0.54, 1.24], c: 'glass', name: 'cab' },
    { box: [1.7, 0.12, 1.35], at: [0, 0.96, 1.24], c: 'paint' },
    { mirror: [{ box: [0.1, 0.73, 0.14], at: [0.82, 0.54, 1.86], c: 'paint' }], axis: 'x' },
    { mirror: [{ box: [0.07, 0.25, 2.36], at: [0.94, 0.65, -0.66], c: 'accent' }], axis: 'x' },
    { mirror: [{ box: [0.08, 0.1, 0.38], at: [0.94, 0.28, -0.18], c: 'trim' }], axis: 'x' },
    { box: [1.92, 0.17, 0.18], at: [0, -0.2, 2.14], c: 'trim' },
    { box: [1.92, 0.17, 0.18], at: [0, -0.2, -2.14], c: 'trim' },
    { box: [0.7, 0.2, 0.08], at: [0, 0.05, 2.12], c: 'trim' },
    { mirror: [{ box: [0.42, 0.23, 0.08], at: [0.65, 0.05, 2.12], c: 'lamp', glow: true }], axis: 'x' },
    { mirror: [{ box: [0.2, 0.45, 0.08], at: [0.8, 0.34, -2], c: 'tail', glow: true }], axis: 'x' },
    { box: [0.08, 0.75, 0.08], at: [0, 0.6, -1.98], c: 'trim' },
  ],
});

export function createVehicleVisual(kind = 'car', color) {
  const def = kind === 'van' ? VAN_MODEL : CAR_MODEL;
  const object = buildModel(def, color == null ? {} : { palette: { paint: color } }).object;
  setLookLayer(object, 'actors');
  object.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
  return object;
}
