/* Procedural scene assets, built from the Strata scene API (see gfx.js). */
import { random } from './math.js';

export const rad = Math.PI / 180;
export function part(s, g, shape, p, size, color, r = [0, 0, 0], extra = {}) {
  return s.part(g, shape, p, size, color, r, extra);
}
export function box(s, g, p, size, color, r = [0, 0, 0], extra = {}) {
  return part(s, g, 'box', p, size, color, r, extra);
}
/** A box from a to b (its Z axis along the segment), using the engine's XYZ Euler convention. */
export function rod(s, g, a, b, r, color, extra = {}) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]);
  const yaw = Math.asin(d[0] / (l || 1)) / rad, pitch = Math.atan2(-d[1], d[2]) / rad;
  return box(s, g, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [r, r, l], color, [pitch, yaw, 0], extra);
}
export function glowTexture(s) {
  return s.texture('glow', () => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.15, 'rgba(255,255,255,.5)');
    g.addColorStop(0.5, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  });
}
export function textTexture(s, text, fg = '#c7dfec', bg = '#101c28') {
  return s.texture(`text|${text}|${fg}|${bg}`, () => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg;
    x.fillRect(0, 0, 512, 128);
    x.font = 'bold 66px Arial';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = fg;
    x.fillText(text, 256, 67, 490);
    return c;
  });
}
export function person(s, hero = false) {
  const g = s.group(), skin = hero ? '#bb8b6e' : '#a48973', cloth = hero ? '#151c26' : '#1c304b', boot = '#10151d';
  const b = (p, z, c = cloth, r = [0, 0, 0]) => box(s, g, p, z, c, r);
  part(s, g, 'sphere', [0, 1.38, 0.015], [hero ? 0.44 : 0.38, 0.37, 0.245], cloth); b([0, 1.26, 0], [0.64, 0.52, 0.37]); b([0, 1.0, 0.025], [0.57, 0.28, 0.35]);
  // Leather lapels, seams, zipper and belt.
  if (hero) {
    b([-0.22, 1.49, -0.222], [0.2, 0.31, 0.045], '#35404c', [0, 0, -22]); b([0.22, 1.49, -0.222], [0.2, 0.31, 0.045], '#313a49', [0, 0, 22]); b([0, 1.27, -0.217], [0.025, 0.55, 0.023], '#b3b9bd'); b([0.25, 1.14, -0.223], [0.22, 0.025, 0.025], '#8e989f', [0, 0, -12]); b([-0.25, 1.2, -0.223], [0.22, 0.023, 0.025], '#8e989f'); b([0, 0.91, -0.01], [0.61, 0.085, 0.38], '#060b10'); b([0, 0.92, -0.208], [0.12, 0.07, 0.025], '#a5adb2');
    b([0.64, 0.84, 0.1], [0.39, 0.56, 0.35], '#293b37'); b([0, 1.28, 0.224], [0.028, 0.64, 0.015], '#59616a'); b([0, 1.57, 0.224], [0.68, 0.027, 0.02], '#4a545f'); b([0.14, 1.3, 0.244], [0.08, 0.68, 0.04], '#17252e', [0, 0, 22]); for (let i = 0; i < 9; i++) b([0.37, 1.5 - i * 0.06, -0.16], [0.095, 0.04, 0.055], '#9b8250');
  } else { b([0, 1.31, -0.21], [0.49, 0.45, 0.055], '#233c59'); b([-0.15, 1.45, -0.25], [0.08, 0.09, 0.02], '#b6b4a3'); b([0, 0.99, 0], [0.64, 0.06, 0.4], '#0a1320'); }
  b([0, 1.71, 0], [0.19, 0.18, 0.2], skin); part(s, g, 'sphere', [0, 1.94, 0.005], [0.218, 0.245, 0.201], skin); b([0, 1.92, -0.045], [0.34, 0.32, 0.3], skin); b([0, 1.8, -0.065], [0.3, 0.18, 0.29], skin); b([0, 1.92, -0.2], [0.075, 0.12, 0.09], skin);
  if (hero) {
    part(s, g, 'sphere', [0, 2.11, 0.025], [0.22, 0.14, 0.203], '#372f2c'); b([0, 2.2, 0.06], [0.36, 0.095, 0.28], '#292728', [-12, 0, 0]); for (let i = 0; i < 5; i++) b([-0.16 + i * 0.078, 2.22, 0.03], [0.05, 0.045, 0.27], '#48403a', [-12, 0, 0]);
    b([-0.104, 1.997, -0.203], [0.17, 0.094, 0.029], '#03080d'); b([0.104, 1.997, -0.203], [0.17, 0.094, 0.029], '#03080d'); b([0, 1.997, -0.219], [0.05, 0.021, 0.023], '#6c7b80'); b([-0.12, 2.019, -0.222], [0.11, 0.012, 0.008], '#94abb6'); b([0, 1.794, -0.208], [0.17, 0.017, 0.014], '#523e36');
  } else { part(s, g, 'sphere', [0, 2.085, 0.017], [0.245, 0.18, 0.23], '#23374a'); b([0, 2.09, -0.21], [0.46, 0.06, 0.16], '#17283b'); }
  const legs = [];
  for (const side of [-1, 1]) { const leg = b([side * 0.2, 0.55, 0], [0.27, 0.72, 0.29], cloth); const foot = b([side * 0.2, 0.14, -0.09], [0.31, 0.25, 0.48], boot); legs.push({ leg, foot, side }); }
  const arms = [];
  for (const side of [-1, 1]) { const upper = part(s, g, 'cylinder', [side * 0.45, 1.4, -0.1], [0.165, 0.43, 0.175], cloth, [hero ? -24 : 0, 0, side * 12]); part(s, g, 'sphere', [side * 0.4, 1.59, -0.015], [0.2, 0.19, 0.22], cloth); const lower = b([side * 0.44, 1.16, -0.35], [0.25, 0.24, 0.43], cloth, [hero ? -8 : 0, 0, 0]); b([side * 0.44, 1.17, -0.6], [0.2, 0.19, 0.19], skin); arms.push({ upper, lower, side }); }
  if (!hero) { b([0.2, 1.17, -0.68], [0.1, 0.14, 0.63], '#0c1620'); b([0.2, 1.1, -0.38], [0.1, 0.22, 0.09], '#0c1620', [12, 0, 0]); }
  return { root: g, legs, arms };
}
export function minigun(s, glow) {
  const g = s.group(), b = (p, z, c, r = [0, 0, 0]) => box(s, g, p, z, c, r); const metal = '#586877', dark = '#1b2632';
  part(s, g, 'cylinder', [0, 0, 0], [0.29, 0.67, 0.29], dark, [90, 0, 0]);
  for (const z of [-0.32, -0.14, 0.15, 0.3]) part(s, g, 'cylinder', [0, 0, z], [0.312, 0.052, 0.312], metal, [90, 0, 0]);
  b([0.19, 0.15, 0.08], [0.28, 0.22, 0.45], '#293a47'); b([0.34, -0.04, 0.12], [0.31, 0.18, 0.24], '#465459');
  b([0, 0.43, 0.02], [0.1, 0.12, 0.56], '#495a66'); for (const z of [-0.24, 0.26]) b([0, 0.3, z], [0.1, 0.3, 0.09], dark);
  b([0, -0.33, 0.23], [0.13, 0.43, 0.16], dark, [-14, 0, 0]); b([0.3, -0.16, -0.16], [0.3, 0.1, 0.11], metal);
  const barrels = [];
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; const m = part(s, g, 'cylinder', [Math.cos(a) * 0.168, Math.sin(a) * 0.168, -1.06], [0.06, 1.5, 0.06], '#4e616f', [90, 0, 0]); const tip = part(s, g, 'cylinder', [Math.cos(a) * 0.168, Math.sin(a) * 0.168, -1.824], [0.036, 0.01, 0.036], '#060b10', [90, 0, 0], { unlit: true }); barrels.push({ m, tip, a }); }
  for (const z of [-0.52, -1.42, -1.74]) { part(s, g, 'cylinder', [0, 0, z], [0.245, 0.11, 0.245], metal, [90, 0, 0]); part(s, g, 'cylinder', [0, 0, z - 0.061], [0.19, 0.009, 0.19], dark, [90, 0, 0]); }
  // The feed belt is visual only; no firearm construction data is used.
  for (let i = 0; i < 15; i++) b([0.37 + i * 0.054, -0.1 - Math.sin(i * 0.11) * 0.3, 0.1 + i * 0.012], [0.046, 0.09, 0.16], i % 2 ? '#89794f' : '#aa9159', [0, i * 3, -i * 2]);
  const flash = part(s, g, 'sphere', [0, 0, -2.0], [0.28, 0.28, 0.52], '#ffe3a0', [0, 0, 0], { unlit: true, castShadow: false }); const core = part(s, g, 'sphere', [0, 0, -1.89], [0.15, 0.15, 0.34], '#ffffff', [0, 0, 0], { unlit: true, castShadow: false }); const spikes = [];
  for (let i = 0; i < 5; i++) spikes.push(b([0, 0, -2.03], [0.08, 0.5, 0.09], '#ffb345', [0, 0, i * 72]));
  spikes.push(part(s, g, 'plane', [0, 0, -2.15], [1.0, 1.0, 0.02], '#ffb76a', [0, 0, 0], { texture: glow, alpha: 0.65, unlit: true, castShadow: false }));
  for (const m of [flash, core, ...spikes]) { m.unlit = true; m.castShadow = false; m.visible = false; }
  return { root: g, barrels, flash, core, spikes, arms: [] };
}
export function policeCar(s, texture, glow) {
  const g = s.group(), glass = [], panels = [], lamps = []; const b = (p, z, c, r = [0, 0, 0], ex = {}) => box(s, g, p, z, c, r, ex);
  const body = b([0, 0.76, 0], [2.18, 0.59, 4.75], '#d6d9d8'); panels.push(body);
  panels.push(b([0, 1.055, -1.6], [2.14, 0.21, 1.57], '#182632'), b([0, 1.08, 1.78], [2.14, 0.16, 1.15], '#1a2733'));
  b([0, 1.31, 0.22], [1.82, 0.54, 2.23], '#436479'); b([0, 1.64, 0.27], [1.83, 0.13, 1.93], '#1c2b36');
  glass.push(b([0, 1.35, -0.85], [1.77, 0.48, 0.045], '#7095a7', [24, 0, 0])); glass.push(b([0, 1.35, 1.33], [1.74, 0.45, 0.045], '#4c697d', [-26, 0, 0]));
  for (const side of [-1, 1]) {
    for (const z of [-0.34, 0.64]) glass.push(b([side * 0.926, 1.35, z], [0.018, 0.4, 0.8], '#536f80')); b([side * 0.94, 1.35, 0.12], [0.065, 0.51, 0.09], '#d2d4ce');
    b([side * 1.113, 0.89, 0.21], [0.03, 0.39, 1.78], '#e7e6dd'); part(s, g, 'plane', [side * 1.135, 0.93, 0.22], [1.2, 0.3, 1], '#172d44', [0, side * 90, 0], { texture, unlit: true, castShadow: false });
    b([side * 1.02, 1.28, -0.9], [0.3, 0.14, 0.2], '#1c2b36');
    for (const z of [-1.47, 1.47]) { part(s, g, 'cylinder', [side * 1.08, 0.48, z], [0.46, 0.21, 0.46], '#101a23', [0, 0, 90]); part(s, g, 'cylinder', [side * 1.2, 0.48, z], [0.24, 0.02, 0.24], '#71858e', [0, 0, 90]); part(s, g, 'cylinder', [side * 1.215, 0.48, z], [0.11, 0.026, 0.11], '#36434e', [0, 0, 90]); }
    for (const x of [side * 0.7, side * 0.92]) lamps.push(b([x, 0.88, -2.393], [0.18, 0.23, 0.026], '#fce8ba', [0, 0, 0], { unlit: true })); b([side * 0.83, 0.94, 2.389], [0.48, 0.19, 0.029], '#bf303b', [0, 0, 0], { unlit: true });
  }
  for (const z of [-2.42, 2.43]) b([0, 0.63, z], [2.28, 0.12, 0.14], '#7b8e96'); b([0, 0.91, -2.401], [0.83, 0.25, 0.025], '#122132'); for (let i = 0; i < 7; i++) b([-0.35 + i * 0.12, 0.9, -2.42], [0.025, 0.21, 0.012], '#73878d');
  b([0, 1.8, 0.24], [1.52, 0.1, 0.32], '#101b25'); const red = b([-0.48, 1.9, 0.24], [0.53, 0.19, 0.29], '#e83c4b', [0, 0, 0], { unlit: true }); const blue = b([0.48, 1.9, 0.24], [0.53, 0.19, 0.29], '#3e9bf7', [0, 0, 0], { unlit: true });
  for (const x of [-0.48, 0.48]) part(s, g, 'plane', [x, 1.91, 0.05], [1.5, 0.72, 1], x < 0 ? '#ff2547' : '#2688ff', [0, 0, 0], { texture: glow, unlit: true, alpha: 0.72, castShadow: false });
  const reflection = part(s, g, 'plane', [0, 0.019, 0], [6, 9, 0.01], '#206bbc', [-90, 0, 0], { texture: glow, alpha: 0.32, unlit: true, castShadow: false });
  const door = b([1.73, 0.89, 0.0], [1.35, 0.64, 0.055], '#cfdbde', [0, -42, 0]); b([1.73, 1.38, 0.0], [1.32, 0.43, 0.035], '#628b9b', [0, -42, 0]);
  return { root: g, red, blue, body, panels, glass, lamps, reflection, door };
}
export function buildSet(s, glow) {
  const rng = random(1984), g = s.group(), b = (p, z, c, r = [0, 0, 0], ex = {}) => box(s, g, p, z, c, r, ex);
  b([0, -0.34, -25], [150, 0.6, 160], '#1e2f40');
  b([0, 0.01, -31], [49, 0.1, 69], '#25394b');
  for (let i = 0; i < 120; i++) { const x = (rng() - 0.5) * 48, z = -rng() * 65; b([x, 0.073, z], [0.015 + rng() * 0.07, 0.006, 0.4 + rng() * 2.8], '#334959', [0, rng() * 7, 0], { castShadow: false }); }
  for (const x of [-24.5, 24.5]) { b([x, 0.12, -30], [0.4, 0.24, 69], '#758697'); b([x + Math.sign(x) * 3, 0.04, -29], [5.5, 0.16, 72], '#4b5f72'); }
  for (let z = -9; z > -65; z -= 8) { b([-0.15, 0.084, z], [0.13, 0.02, 4], '#a8a078'); b([0.15, 0.084, z], [0.13, 0.02, 4], '#a8a078'); }
  for (let x = -20; x <= 20; x += 5) { b([x, 0.085, -12], [0.1, 0.025, 7], '#9faeb5'); b([x, 0.085, -41], [0.1, 0.025, 9], '#82939e'); }
  for (let i = 0; i < 10; i++) b([-21 + i * 4.7, 0.085, -5], [2.6, 0.022, 0.75], '#b4bec1');
  // Office floor, open frontage, steel mullions and high-rise wings.
  b([0, 7.67, 5.2], [31, 0.65, 14.2], '#5b6d7d'); b([0, 7.26, -1.82], [32, 0.33, 0.52], '#b5c2c6');
  for (const x of [-11.5, 11.5]) { b([x, 8.23, -1.8], [8, 0.45, 0.39], '#596c7c'); b([x, 8.5, -1.8], [8, 0.1, 0.51], '#8fa5b4'); }
  b([-15.1, 9.5, 4], [0.46, 4, 12], '#657989'); b([15.1, 9.5, 4], [0.46, 4, 12], '#657989');
  b([0, 13.2, 8], [31, 0.42, 8], '#53697d'); b([0, 9.77, 12], [31, 4, 0.35], '#2f485c');
  for (let x = -13; x <= 13; x += 3.25) { b([x, 9.4, 11.75], [2.7, 2.45, 0.025], '#41627a', [0, 0, 0], { unlit: true }); b([x, 10.76, 11.72], [2.75, 0.07, 0.1], '#c9e6ea', [0, 0, 0], { unlit: true }); }
  for (let x = -14; x <= 14; x += 3.5) { if (Math.abs(x) < 7) continue; b([x, 9.7, 1.1], [0.095, 3.7, 0.18], '#96afc1'); b([x, 11.5, 1.1], [3.5, 0.1, 0.15], '#94afc4'); if (Math.abs(x) > 5) b([x + 1.75, 9.83, 1.1], [3.34, 3.16, 0.045], '#35566d', [0, 0, 0], { alpha: 0.36, castShadow: false }); }
  for (const side of [-1, 1]) { const x = side * 23; b([x, 13, 9], [14, 26, 18], '#2e475b'); for (let floor = 0; floor < 7; floor++) { const y = 1.9 + floor * 3.55; b([x, y - 1.4, -0.1], [14, 0.18, 0.24], '#5d758b'); for (let j = 0; j < 5; j++) { const xx = x - 5.4 + j * 2.7; const lit = rng() > 0.3; b([xx, y, -0.17], [2.3, 2.55, 0.05], lit ? '#55758b' : '#22394c', [0, 0, 0], { unlit: lit }); b([xx, y + 1.35, -0.2], [2.3, 0.055, 0.075], '#7897ac'); } } }
  for (let i = 0; i < 35; i++) { const x = (rng() - 0.5) * 13, z = -0.8 + rng() * 2.6; part(s, g, 'shard', [x, 8.03, z], [0.07 + rng() * 0.2, 0.07 + rng() * 0.24, 0.035], '#85acbd', [-90, rng() * 360, 0], { alpha: 0.55, castShadow: false }); }
  const labels = [];
  const sign = s.label('CYBERDYNE SYSTEMS', [0, 11.05, 11.5], 12, 0.65, '#bddfeb', '#1a3246');
  labels.push(sign, s.label('RESEARCH & DEVELOPMENT', [0, 10.3, 11.49], 8, 0.4, '#8ba5b7', '#233e52'));
  // Desk and terminals inside, visible when the camera turns back.
  for (const x of [-10, -6, 6, 10]) { b([x, 8.85, 8], [2.2, 0.1, 0.9], '#627481'); for (const sx of [-0.9, 0.9]) b([x + sx, 8.4, 8], [0.07, 0.85, 0.65], '#2c3e4e'); b([x, 9.2, 8], [0.65, 0.54, 0.2], '#182c3b'); b([x, 9.2, 7.887], [0.5, 0.35, 0.016], '#7cc9bf', [0, 0, 0], { unlit: true }); }
  // Exterior towers and illuminated windows make the skyline.
  for (let i = 0; i < 25; i++) { const x = (rng() - 0.5) * 140, z = -80 - rng() * 55, h = 8 + rng() * 37, w = 5 + rng() * 9; b([x, h / 2, z], [w, h, 6 + rng() * 5], '#1b3045'); for (let y = 3; y < h; y += 3.8) for (let xx = x - w / 2 + 1; xx < x + w / 2; xx += 2.5) if (rng() > 0.5) b([xx, y, z + 5.3], [0.65, 1, 0.035], rng() > 0.3 ? '#6b8c9d' : '#b9a78b', [0, 0, 0], { unlit: true, castShadow: false }); }
  for (const x of [-26, 26]) for (const z of [-9, -28, -48]) { b([x, 4, z], [0.12, 8, 0.12], '#526779'); b([x - Math.sign(x) * 1, 7.95, z], [2.1, 0.1, 0.12], '#748c9d'); b([x - Math.sign(x) * 2, 7.88, z], [0.5, 0.1, 0.7], '#d0e7e9', [0, 0, 0], { unlit: true }); part(s, g, 'plane', [x - Math.sign(x) * 2, 0.1, z], [11, 16, 0.01], '#7c9fbc', [-90, 0, 0], { texture: glow, alpha: 0.16, unlit: true, castShadow: false }); }
  // Distant trees, barricades, and a command truck.
  for (const side of [-1, 1]) for (let j = 0; j < 6; j++) { const x = side * (30 + rng() * 5), z = -6 - j * 10; b([x, 1.3, z], [0.34, 2.6, 0.34], '#1d2a31'); for (let q = 0; q < 3; q++) part(s, g, 'sphere', [x + (rng() - 0.5) * 1.5, 3.0 + q * 0.9, z], [2.0 - q * 0.35, 1.6, 1.8 - q * 0.3], '#253e43'); }
  for (let x = -19; x < 23; x += 7) { b([x, 0.75, -51], [4, 0.95, 0.18], '#9d9c88'); for (const xx of [-1.5, 1.5]) b([x + xx, 0.44, -51], [0.12, 0.85, 0.6], '#627482'); for (let j = -1; j <= 1; j++) b([x + j, 0.8, -50.89], [0.2, 1, 0.03], '#263c4c', [0, 0, -28]); }
  b([-18, 1.33, -34], [3, 2.6, 6.2], '#3c5164'); b([-18, 1.5, -37.2], [2.85, 2.35, 2.5], '#293e50'); b([-18, 2.1, -38.46], [2.3, 0.7, 0.03], '#6695a7'); for (const x of [-19.5, -16.5]) for (const z of [-32, -37]) part(s, g, 'cylinder', [x, 0.6, z], [0.6, 0.2, 0.6], '#0f1924', [0, 0, 90]);
  labels.push(s.label('POLICE', [-18, 2.2, -38.49], 2.2, 0.4, '#dae5e6', '#213c51', [0, 180, 0]));
  return { root: g, sign, labels };
}
export function helicopter(s) {
  const g = s.group(); part(s, g, 'sphere', [0, 0, 0], [1.55, 1.1, 2.65], '#243b4e'); box(s, g, [0, 0.15, -1.6], [1.9, 1.05, 1.4], '#476e83', [-15, 0, 0]); box(s, g, [0, 0.2, 3.8], [0.42, 0.45, 5.0], '#294659', [-6, 0, 0]); box(s, g, [0, 1.0, 5.8], [0.16, 2, 1.2], '#3a5366', [-20, 0, 0]);
  for (const x of [-1.25, 1.25]) { box(s, g, [x, -1.4, 0.1], [0.12, 0.13, 4], '#7391a0'); for (const z of [-1, 1]) rod(s, g, [x, -1.3, z], [x * 0.6, -0.7, z], 0.09, '#678595'); }
  box(s, g, [0, 1.25, 0], [0.14, 0.8, 0.14], '#76919c'); const rotor = box(s, g, [0, 1.66, 0], [11, 0.045, 0.22], '#809aa9'); const rotor2 = box(s, g, [0, 1.67, 0], [0.22, 0.045, 11], '#607b8d'); part(s, g, 'sphere', [-1.6, 0.1, 0], [0.12, 0.12, 0.12], '#ff313c', [0, 0, 0], { unlit: true }); part(s, g, 'sphere', [1.6, 0.1, 0], [0.12, 0.12, 0.12], '#76bbdf', [0, 0, 0], { unlit: true });
  const lamp = part(s, g, 'sphere', [0, -0.83, -1.3], [0.25, 0.15, 0.3], '#e4f2e8', [0, 0, 0], { unlit: true });
  return { root: g, rotor, rotor2, lamp };
}

/* ---------------------------------------------------------------- units (from Units.js) */

export function makeOfficer(scene, type = 'patrol') {
  const model = person(scene, false), g = model.root;
  if (type === 'patrol') return model;
  for (const m of g.children) if (['#1c304b', '#233c59', '#23374a'].includes(m.color)) m.color = type === 'marksman' ? '#344840' : '#14232b';
  box(scene, g, [0, 1.35, -0.25], [0.65, 0.55, 0.12], '#405362');
  box(scene, g, [0, 2.02, -0.25], [0.41, 0.14, 0.05], '#4f7987');
  for (const x of [-0.17, 0.03, 0.23]) box(scene, g, [x, 1.21, -0.34], [0.13, 0.22, 0.1], '#19292e');
  if (type === 'shield') {
    model.shield = box(scene, g, [-0.18, 1.07, -0.92], [1.08, 1.48, 0.12], '#4a6170');
    box(scene, g, [-0.18, 1.58, -1.0], [0.62, 0.2, 0.04], '#96b5bf');
    box(scene, g, [-0.18, 0.8, -1.0], [0.72, 0.12, 0.04], '#d0dae0');
  } else if (type === 'marksman') {
    box(scene, g, [0.2, 1.25, -0.94], [0.09, 0.1, 1.42], '#10191b');
    part(scene, g, 'cylinder', [0.2, 1.38, -0.7], [0.045, 0.37, 0.045], '#789293', [90, 0, 0]);
    box(scene, g, [0, 1.67, 0.15], [0.83, 0.65, 0.22], '#37473c');
  }
  return model;
}
export function makeVehicle(scene, type, texture, glow) {
  if (type === 'cruiser') return policeCar(scene, texture, glow);
  if (type === 'helicopter') {
    const m = helicopter(scene), g = m.root;
    m.body = g.children[0]; m.panels = [m.body]; m.glass = []; m.lamps = [m.lamp];
    m.red = box(scene, g, [-1.2, 0.5, 0.3], [0.15, 0.15, 0.2], '#ef3c4e', [0, 0, 0], { unlit: true });
    m.blue = box(scene, g, [1.2, 0.5, 0.3], [0.15, 0.15, 0.2], '#62b3ff', [0, 0, 0], { unlit: true });
    m.reflection = m.lamp;
    m.module = box(scene, g, [0, 0.8, 0.65], [0.95, 0.5, 1.0], '#86999c');
    return m;
  }
  const g = scene.group(), panels = [], glass = [], lamps = [];
  const isSUV = type === 'suv', isArmor = type === 'armored';
  const width = isArmor ? 2.9 : isSUV ? 2.38 : 2.7;
  const length = isArmor ? 6.25 : isSUV ? 5.1 : 5.9;
  const top = isArmor ? 3.0 : isSUV ? 2.3 : 2.85;
  const paint = isSUV ? '#ced6d8' : isArmor ? '#374f53' : '#233947';
  const b = (p, z, c = paint, r = [0, 0, 0], ex = {}) => box(scene, g, p, z, c, r, ex);
  const body = b([0, 0.85, 0], [width, 0.8, length]); panels.push(body);
  panels.push(b([0, top * 0.68, 0.68], [width * 0.93, top * 0.56, length * 0.64]));
  const hood = b([0, isArmor ? 1.5 : 1.23, -length * 0.34], [width * 0.92, 0.36, length * 0.29], isSUV ? '#253641' : '#465f67'); panels.push(hood);
  panels.push(b([0, top, -0.0], [width * 0.96, 0.15, length * 0.7]));
  glass.push(b([0, top * 0.8, -length * 0.22], [width * 0.81, top * 0.23, 0.05], '#618b9d', [12, 0, 0]));
  for (const side of [-1, 1]) {
    for (const z of [-0.43, 0.77]) glass.push(b([side * width * 0.475, top * 0.81, z], [0.035, top * 0.24, 0.92], '#476f81'));
    b([side * width * 0.504, 1.18, 0.6], [0.04, 0.35, 1.9], isSUV ? '#1f3d52' : '#506c79');
    part(scene, g, 'plane', [side * width * 0.511, 1.2, 0.6], [1.75, 0.3, 1], '#ffffff', [0, side * 90, 0], { texture, unlit: true, castShadow: false });
    for (const z of [-length * 0.31, length * 0.32]) {
      part(scene, g, 'cylinder', [side * width * 0.47, 0.57, z], [0.58, 0.28, 0.58], '#0b1620', [0, 0, 90]);
      part(scene, g, 'cylinder', [side * width * 0.53, 0.57, z], [0.3, 0.035, 0.3], '#7b9299', [0, 0, 90]);
    }
    lamps.push(b([side * width * 0.34, 1.0, -length * 0.505], [0.38, 0.22, 0.05], '#f3e8c2', [0, 0, 0], { unlit: true }));
    b([side * width * 0.4, 1.0, length * 0.505], [0.25, 0.23, 0.05], '#af3e42');
  }
  b([0, 0.67, -length * 0.53], [width * 1.05, 0.25, 0.3], '#81959a');
  if (isArmor) {
    for (const x of [-width * 0.49, width * 0.49]) b([x, 1.35, 0], [0.16, 1.2, length * 0.72], '#60747b', [0, 0, x > 0 ? -7 : 7]);
    b([0, 1.2, -length * 0.58], [width * 0.88, 0.8, 0.23], '#24363a');
    for (const x of [-0.7, 0, 0.7]) b([x, 1.2, -length * 0.6], [0.07, 0.82, 0.08], '#8ea2a3');
  }
  b([0, top + 0.13, 0.0], [1.65, 0.1, 0.38], '#111e2c');
  const red = b([-0.52, top + 0.25, 0], [0.54, 0.2, 0.33], '#f33f51', [0, 0, 0], { unlit: true });
  const blue = b([0.52, top + 0.25, 0], [0.54, 0.2, 0.33], '#379af9', [0, 0, 0], { unlit: true });
  const reflection = part(scene, g, 'plane', [0, 0.015, 0], [7, 10, 1], '#337ebc', [-90, 0, 0], { texture: glow, alpha: 0.27, unlit: true, castShadow: false });
  return { root: g, body, panels, glass, lamps, red, blue, reflection };
}

/** A helicopter searchlight: a faint cone from the lamp and a pool of light where it lands. */
export function searchlight(s, glow) {
  const g = s.group();
  g.visible = false;
  const cone = s.part(g, 'cone', [0, 0, 0], [1, 1, 1], '#cfe4f6', [90, 0, 0], { unlit: true, alpha: 0.09, castShadow: false });
  const pool = s.mesh('plane', [0, 0, 0], [6.5, 6.5, 0.01], '#e2f0ff', [-90, 0, 0], { texture: glow, unlit: true, alpha: 0.62, castShadow: false, visible: false });
  return { root: g, cone, pool, spot: [0, 0.1, -25], lit: false };
}
