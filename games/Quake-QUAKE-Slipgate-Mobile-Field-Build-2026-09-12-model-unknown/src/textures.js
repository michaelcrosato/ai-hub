// Procedural 128×128 textures (no image files, no network) and the material table every world uses.
import { random } from './math.js';

export function makeTextures() {
  const rng = random(666);
  const textures = {};
  for (const name of ['stone', 'floor', 'metal', 'lava', 'rune', 'plain']) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d');
    const img = c.createImageData(128, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        let v = 0.83 + rng() * 0.25;
        let rgb = [255, 255, 255];
        if (name === 'stone') {
          const row = Math.floor(y / 32);
          const xx = (x + (row % 2) * 32) % 64;
          v *= y % 32 < 2 || xx < 2 ? 0.34 : 1;
          rgb = [112, 109, 104];
        }
        if (name === 'floor') {
          v *= x % 64 < 2 || y % 64 < 2 ? 0.42 : 1;
          v *= (Math.floor(x / 64) + Math.floor(y / 64)) % 2 ? 0.9 : 1;
          rgb = [112, 116, 117];
        }
        if (name === 'metal') {
          v *= x % 32 < 2 ? 0.4 : 1;
          v *= y % 64 < 2 ? 0.65 : 1;
          rgb = [115, 110, 98];
          if (x % 32 > 25 && x % 32 < 29 && y % 32 > 25 && y % 32 < 29) rgb = [175, 152, 114];
        }
        if (name === 'lava') {
          v = (Math.sin(x * 0.17 + Math.sin(y * 0.1) * 2) + Math.cos(y * 0.16 + Math.cos(x * 0.1) * 2) + 2) / 4;
          rgb = v < 0.38 ? [58, 12, 2] : v < 0.48 ? [165, 32, 0] : v < 0.7 ? [255, 80, 2] : [255, 174, 25];
          v = 0.82 + rng() * 0.18;
        }
        if (name === 'rune') {
          rgb = [15, 116, 135];
          v = (Math.sin(x * 0.08) * Math.cos(y * 0.08) + 1) * 0.45 + rng() * 0.15;
        }
        if (name === 'plain') v = 1;
        const i = (y * 128 + x) * 4;
        for (let j = 0; j < 3; j++) img.data[i + j] = rgb[j] * v;
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    textures[name] = canvas;
  }
  return textures;
}

/**
 * texture: which procedural texture; color: multiplies it (linear); emissive: glow strength.
 * flow: the texture drifts (lava, the slipgate's runes).
 */
export const MATERIALS = {
  stone: { texture: 'stone', color: [0.68, 0.66, 0.61] },
  trim: { texture: 'stone', color: [0.92, 0.84, 0.7] },
  floor: { texture: 'floor', color: [0.7, 0.71, 0.69] },
  metal: { texture: 'metal', color: [0.45, 0.48, 0.46], metalness: 0.32 },
  bronze: { texture: 'metal', color: [0.87, 0.51, 0.23], metalness: 0.32 },
  dark: { texture: 'plain', color: [0.12, 0.15, 0.16] },
  lava: { texture: 'lava', color: [1, 1, 1], emissive: 1, flow: 'lava' },
  orange: { texture: 'plain', color: [1, 0.26, 0.025], emissive: 1.4 },
  cyan: { texture: 'plain', color: [0.06, 0.72, 0.86], emissive: 1.3 },
  portal: { texture: 'rune', color: [0.35, 1, 1], emissive: 1, flow: 'portal' },
  red: { texture: 'plain', color: [0.64, 0.075, 0.045] },
  bone: { texture: 'stone', color: [1, 0.85, 0.62] },
  white: { texture: 'plain', color: [0.8, 0.92, 0.87], emissive: 0.25 },
  // The Ash Cloister: the same stone, burnt darker.
  ash: { texture: 'floor', color: [0.5, 0.47, 0.44] },
  slate: { texture: 'stone', color: [0.47, 0.5, 0.53] },
};
