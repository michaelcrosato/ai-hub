import * as THREE from 'three/webgpu';
import { rng } from './math.js';
import { canvasTexture } from './mesh.js';

/**
 * Colours as the original engine used them. three.js r140 kept hex colours as linear values ("legacy" colour
 * management) while still encoding the picture to sRGB; r186 decodes hex as sRGB first, which made roofs, lawns,
 * kerbs and the bus livery two to four times darker than the original. setLegacy stores the r140 value.
 */
export const setLegacy = (color, hex) => color.setHex(hex, THREE.LinearSRGBColorSpace);
const toLegacy = (color) => color.convertLinearToSRGB();

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function noiseSurface(type, seed) {
  const size = 512, c = canvas(size), ctx = c.getContext('2d'), im = ctx.createImageData(size, size), random = rng(seed); const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, n = random(), wide = Math.sin(x * 0.045 + Math.sin(y * 0.029)) * Math.cos(y * 0.038) * 0.5;
    let value = type === 'asphalt' ? 49 + n * 22 + wide * 8 : type === 'grass' ? 80 + n * 30 : type === 'stone' ? 132 + n * 23 + wide * 10 : 67 + n * 30;
    if (type === 'stone' && (x % 128 < 3 || y % 96 < 3)) value -= 33;
    if (type === 'roof' && x % 45 < 3) value += 40;
    const k = i * 4; im.data[k] = type === 'grass' ? value * 0.55 : value; im.data[k + 1] = type === 'grass' ? value * 0.67 : value * 0.985; im.data[k + 2] = type === 'grass' ? value * 0.3 : value * 0.94; im.data[k + 3] = 255;
    heights[i] = n * 0.4 + wide * 0.2 + (type === 'stone' && (x % 128 < 3 || y % 96 < 3) ? -0.35 : 0);
  }
  ctx.putImageData(im, 0, 0);
  if (type === 'asphalt') {
    ctx.globalAlpha = 0.12; ctx.strokeStyle = '#15191a'; ctx.lineWidth = 1;
    for (let j = 0; j < 12; j++) { ctx.beginPath(); let x = random() * size, y = random() * size; ctx.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (random() - 0.5) * 18; y += random() * 20; ctx.lineTo(x, y); } ctx.stroke(); }
  }
  const normal = canvas(size), nctx = normal.getContext('2d'), ni = nctx.createImageData(size, size);
  const rough = canvas(size), rctx = rough.getContext('2d'), ri = rctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4, dx = heights[y * size + ((x + 1) % size)] - heights[y * size + ((x + size - 1) % size)], dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
    ni.data[k] = 128 - dx * 60; ni.data[k + 1] = 128 - dy * 60; ni.data[k + 2] = 250; ni.data[k + 3] = 255;
    const rv = type === 'roof' ? 120 + heights[i] * 90 : 195 + heights[i] * 50; ri.data[k] = ri.data[k + 1] = ri.data[k + 2] = rv; ri.data[k + 3] = 255;
  }
  nctx.putImageData(ni, 0, 0); rctx.putImageData(ri, 0, 0);
  return { map: canvasTexture(c), normalMap: canvasTexture(normal, true, false), roughnessMap: canvasTexture(rough, true, false) };
}

// Window grid shared by every façade texture (four columns, three storeys per repeat).
const windowAt = (row, col) => ({ x: col * 256 + 66, y: row * (1024 / 3) + 76, w: 124, h: 183 });

function facade(palette, seed) {
  const c = canvas(1024), ctx = c.getContext('2d'), r = rng(seed); ctx.fillStyle = palette; ctx.fillRect(0, 0, 1024, 1024);
  // Subtle plaster grain and water marks, not baked sunlight.
  for (let k = 0; k < 38000; k++) { const shade = r() > 0.5 ? '255,255,248' : '28,31,24'; ctx.fillStyle = `rgba(${shade},${r() * 0.045})`; ctx.fillRect(r() * 1024, r() * 1024, 1 + r() * 3, 1 + r() * 5); }
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const { x, y, w, h } = windowAt(row, col);
    ctx.fillStyle = 'rgba(38,33,29,.38)'; ctx.fillRect(x - 14, y - 11, w + 28, h + 25);
    ctx.fillStyle = '#d7d2c7'; ctx.fillRect(x - 11, y - 9, w + 22, h + 21);
    ctx.fillStyle = '#6e726e'; ctx.fillRect(x - 3, y - 2, w + 6, h + 6);
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#476071'); g.addColorStop(0.43, '#8a989b'); g.addColorStop(0.48, '#5b6565'); g.addColorStop(1, r() > 0.8 ? '#827260' : '#283b43'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // Slightly different curtains and rooms; no people in textures.
    if (r() > 0.38) { ctx.fillStyle = `rgba(220,215,198,${0.15 + r() * 0.45})`; ctx.fillRect(x + 3, y + 3, 14 + r() * 20, h - 7); ctx.fillRect(x + w - 22, y + 3, 18, h - 7); }
    if (r() > 0.55) { ctx.fillStyle = 'rgba(201,204,200,.4)'; ctx.fillRect(x + 1, y, w - 2, 22 + r() * 45); }
    ctx.fillStyle = 'rgba(202,218,222,.10)'; ctx.beginPath(); ctx.moveTo(x, y + 15); ctx.lineTo(x + w, y + 44); ctx.lineTo(x + w, y + 90); ctx.lineTo(x, y + 48); ctx.fill();
    ctx.fillStyle = '#dcdcd2'; ctx.fillRect(x + w * 0.49 - 3, y, 6, h); ctx.fillRect(x, y + h * 0.35, w, 5);
    ctx.fillStyle = '#aaa89e'; ctx.fillRect(x - 13, y + h + 9, w + 26, 8); ctx.fillStyle = '#e1ddd1'; ctx.fillRect(x - 16, y + h + 6, w + 32, 5);
    ctx.fillStyle = 'rgba(31,25,19,.09)'; ctx.fillRect(col * 256, row * (1024 / 3) + 327, 256, 11); ctx.fillStyle = 'rgba(255,254,240,.17)'; ctx.fillRect(col * 256, row * (1024 / 3) + 326, 256, 2);
  }
  return canvasTexture(c);
}

/** Lit rooms for the evening: one emissive map shared by every façade (same window grid). */
function litWindows() {
  const c = canvas(512), ctx = c.getContext('2d'), r = rng(5150); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    if (r() < 0.42) continue;
    const { x, y, w, h } = windowAt(row, col), warm = r();
    const g = ctx.createLinearGradient(0, y / 2, 0, (y + h) / 2);
    g.addColorStop(0, warm > 0.3 ? '#a8783f' : '#7f8b96'); g.addColorStop(1, warm > 0.3 ? '#e9b56c' : '#b6c4cf');
    ctx.fillStyle = g; ctx.fillRect(x / 2 + 1, y / 2 + 1, w / 2 - 2, h / 2 - 2);
    ctx.fillStyle = '#000'; ctx.fillRect((x + w * 0.49 - 3) / 2, y / 2, 3, h / 2); ctx.fillRect(x / 2, (y + h * 0.35) / 2, w / 2, 3);
  }
  return canvasTexture(c);
}

function leafTexture() {
  const c = canvas(512), ctx = c.getContext('2d'), r = rng(9067);
  for (let k = 0; k < 1700; k++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()), x = 256 + Math.cos(a) * rad * 231, y = 263 + Math.sin(a) * rad * 230;
    if ((Math.sin(a * 7) + 1) * 0.04 + rad > 1) continue;
    const v = Math.floor(35 + r() * 45); ctx.fillStyle = `rgb(${Math.floor(v * 0.85)},${v + 25},${Math.floor(v * 0.39)})`; ctx.beginPath(); ctx.ellipse(x, y, 5 + r() * 9, 3 + r() * 6, r() * 6, 0, Math.PI * 2); ctx.fill();
  }
  return canvasTexture(c, false);
}

/** Equirectangular sky for background and image-based light; drawn once per weather and cached. */
const skies = new Map();
export function skyTexture(weather = 'dry') {
  const key = weather === 'damp' ? 'dry' : weather;
  if (skies.has(key)) return skies.get(key);
  const c = canvas(2048, 1024), ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 1024);
  if (key === 'rain') { g.addColorStop(0, '#697e91'); g.addColorStop(0.43, '#b8c5ce'); g.addColorStop(0.54, '#d7d8d2'); g.addColorStop(1, '#596c78'); }
  else if (key === 'evening') { g.addColorStop(0, '#1d2b4a'); g.addColorStop(0.25, '#465d86'); g.addColorStop(0.42, '#b98478'); g.addColorStop(0.49, '#f0a86a'); g.addColorStop(0.53, '#f6c487'); g.addColorStop(0.56, '#5d5560'); g.addColorStop(1, '#262a33'); }
  else { g.addColorStop(0, '#3b6c97'); g.addColorStop(0.28, '#729eb8'); g.addColorStop(0.47, '#cfdbdc'); g.addColorStop(0.55, '#e8e1cb'); g.addColorStop(1, '#546471'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
  const r = rng(146); if ('filter' in ctx) ctx.filter = 'blur(9px)';
  const cloud = key === 'evening' ? '255,196,160' : '255,251,235', alpha = key === 'evening' ? 0.3 : 0.36;
  for (let k = 0; k < 125; k++) {
    const x = r() * 2048, y = 110 + r() * 305, w = 60 + r() * 210, h = 7 + r() * 22;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, w / 2); cg.addColorStop(0, `rgba(${cloud},${alpha})`); cg.addColorStop(1, `rgba(${cloud},0)`); ctx.fillStyle = cg;
    ctx.save(); ctx.translate(x, y); ctx.scale(1, h / (w / 2)); ctx.beginPath(); ctx.arc(0, 0, w / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  if ('filter' in ctx) ctx.filter = 'none';
  const tex = canvasTexture(c, false); tex.mapping = THREE.EquirectangularReflectionMapping; tex.anisotropy = 1;
  skies.set(key, tex); return tex;
}

export function createMaterials() {
  const mats = {}; const road = noiseSurface('asphalt', 120), stone = noiseSurface('stone', 34), roof = noiseSurface('roof', 65), grass = noiseSurface('grass', 78);
  mats.road = new THREE.MeshStandardMaterial({ ...road, roughness: 1, metalness: 0.035, normalScale: new THREE.Vector2(0.24, 0.24) });
  mats.pavement = new THREE.MeshStandardMaterial({ ...stone, roughness: 0.98, normalScale: new THREE.Vector2(0.28, 0.28) });
  mats.roof = new THREE.MeshStandardMaterial({ ...roof, color: 0x51585b, metalness: 0.5, roughness: 0.72, normalScale: new THREE.Vector2(0.2, 0.2) });
  mats.grass = new THREE.MeshStandardMaterial({ ...grass, roughness: 1, color: 0x909274 });
  mats.ground = new THREE.MeshStandardMaterial({ ...stone, color: 0xb6b8ae, roughness: 1 });
  mats.kerb = new THREE.MeshStandardMaterial({ color: 0xb3b5b1, roughness: 0.91 });
  mats.paint = new THREE.MeshStandardMaterial({ color: 0xd9ddd8, roughness: 0.92 });
  mats.yellow = new THREE.MeshStandardMaterial({ color: 0xe6bc42, roughness: 0.8 });
  mats.metal = new THREE.MeshStandardMaterial({ color: 0x6d7779, roughness: 0.34, metalness: 0.83 });
  mats.dark = new THREE.MeshStandardMaterial({ color: 0x242c2f, roughness: 0.63, metalness: 0.35 });
  mats.black = new THREE.MeshStandardMaterial({ color: 0x10181b, roughness: 0.88 });
  mats.green = new THREE.MeshStandardMaterial({ color: 0x284843, roughness: 0.6, metalness: 0.38 });
  mats.glass = new THREE.MeshPhysicalMaterial({ color: 0xb6d0d3, transparent: true, opacity: 0.17, roughness: 0.1, metalness: 0.12, envMapIntensity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  mats.window = new THREE.MeshStandardMaterial({ color: 0x62808b, roughness: 0.19, metalness: 0.58, envMapIntensity: 0.6, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
  mats.wood = new THREE.MeshStandardMaterial({ color: 0x777057, roughness: 0.94 });
  mats.bark = new THREE.MeshStandardMaterial({ color: 0x574e3e, roughness: 1 });
  mats.leaves = new THREE.MeshStandardMaterial({ map: leafTexture(), roughness: 1, alphaTest: 0.42, side: THREE.DoubleSide, color: 0xbbc89d });
  mats.water = new THREE.MeshStandardMaterial({ color: 0x6b8f99, roughness: 0.21, metalness: 0.4, normalMap: road.normalMap, normalScale: new THREE.Vector2(0.32, 0.25), envMapIntensity: 1.05 });
  const palettes = ['#c6bdab', '#d5cbb6', '#bfaaa0', '#bac1b8', '#c5b7a1', '#b2b7b8'];
  const lit = litWindows();
  // The emissive map is always bound, so the evening only changes a uniform (no shader rebuild).
  mats.facades = palettes.map((p, i) => new THREE.MeshStandardMaterial({ map: facade(p, 420 + i), roughness: 0.94, side: THREE.DoubleSide, emissive: 0xffc98a, emissiveMap: lit, emissiveIntensity: 0 }));
  mats.busBlue = new THREE.MeshPhysicalMaterial({ color: 0x0079b5, roughness: 0.29, metalness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.22 });
  mats.busWhite = new THREE.MeshPhysicalMaterial({ color: 0xebf0ee, roughness: 0.26, metalness: 0.1, clearcoat: 0.75, clearcoatRoughness: 0.23 });
  mats.sideGlass = new THREE.MeshPhysicalMaterial({ color: 0x46616b, roughness: 0.16, metalness: 0.35, transparent: true, opacity: 0.78, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  // Driver-side glass stays clear enough to observe the adjacent lane.
  mats.driverGlass = mats.sideGlass.clone(); mats.driverGlass.opacity = 0.12; mats.driverGlass.metalness = 0.06;
  mats.rubber = new THREE.MeshStandardMaterial({ color: 0x171b1d, roughness: 0.97, normalMap: road.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  mats.dash = new THREE.MeshStandardMaterial({ color: 0x242c2e, roughness: 0.93, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.09, 0.09) });
  mats.seat = new THREE.MeshStandardMaterial({ color: 0x3b6073, roughness: 1, normalMap: stone.normalMap, normalScale: new THREE.Vector2(0.17, 0.17) });
  mats.rail = new THREE.MeshStandardMaterial({ color: 0xd5c467, roughness: 0.42, metalness: 0.42 });
  mats.interior = new THREE.MeshStandardMaterial({ color: 0xcccfca, roughness: 0.78 });
  mats.lights = new THREE.MeshBasicMaterial({ color: 0xfdf9d8, toneMapped: false });
  mats.redLights = new THREE.MeshBasicMaterial({ color: 0xc43125, toneMapped: false });
  // Street-lamp heads: dark by day, warm in the evening (a uniform, not a material swap).
  mats.lampHead = new THREE.MeshStandardMaterial({ color: 0x242c2f, roughness: 0.63, metalness: 0.35, emissive: 0xffd49a, emissiveIntensity: 0 });
  mats.stopSign = new THREE.MeshStandardMaterial({ color: 0xc0261d, roughness: 0.55 });
  // Shared parked/traffic car paints (one shader, six colours).
  mats.carBodies = [0xb7bec1, 0x4d6571, 0x717774, 0xe0dfd7, 0x444a50, 0x704942].map((color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.4, clearcoat: 0.7 }));
  // People: a small shared palette instead of three new materials per person.
  mats.coats = [0x364b5c, 0x8b7363, 0x797d69, 0x9b8170, 0x35383e, 0x58656a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  mats.skins = [0xc9a081, 0xad7f60, 0x76503b, 0xe0b79b].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  mats.pants = new THREE.MeshStandardMaterial({ color: 0x30383b, roughness: 1, flatShading: true });
  for (const m of new Set(Object.values(mats).flat())) { toLegacy(m.color); if (m.emissive) toLegacy(m.emissive); }
  return mats;
}

/** Road surface and night lighting for the chosen weather: uniforms only. */
export function applyWeatherToMaterials(mats, weather) {
  const wet = weather === 'rain' || weather === 'damp', evening = weather === 'evening';
  mats.road.roughness = weather === 'rain' ? 0.43 : weather === 'damp' ? 0.65 : 1;
  setLegacy(mats.road.color, wet ? 0x808c90 : 0xffffff);
  mats.road.metalness = wet ? 0.09 : 0.035;
  for (const m of mats.facades) m.emissiveIntensity = evening ? 0.75 : 0;
  mats.lampHead.emissiveIntensity = evening ? 3.2 : 0;
}
