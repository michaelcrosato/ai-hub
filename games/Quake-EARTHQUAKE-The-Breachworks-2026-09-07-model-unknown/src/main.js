/* EARTHQUAKE: The Breachworks. An original old-school first-person shooter.
   Engine logic, models, levels, textures and sound are generated locally; no network requests.
   Movement reference: https://github.com/id-Software/Quake/blob/master/WinQuake/sv_user.c
   This project does not include Quake code, maps, textures, models or sound recordings.

   Rendering runs on the shared kit: three.js r186 WebGPURenderer (WebGL2 fallback). The
   original hand-written shaders are ported to TSL node materials: per-vertex sun and eight
   nearest lamps, atlas tiles with flowing acid/lava/portal, distance fog, grain and 48-level
   quantising, all at a deliberately low line count with hard pixels. */

import * as THREE from 'three/webgpu';
import {
  Fn, If, Discard, uniform, attribute, varying, vec2, vec3, vec4, float, texture, uv,
  positionLocal, normalLocal, modelWorldMatrix, positionWorld, cameraPosition, screenCoordinate, screenUV,
  dot, max, length, distance, mix, floor, fract, mod, clamp as tclamp, sin, cos, exp, smoothstep, select,
} from 'three/tsl';
import { boot } from 'kit/boot.js';
import { TAU, clamp, lerp, V, makeRng, Geo } from './geo.js';
import { C, NX, NZ, wx, wz, LEVELS, HAZARDS, buildLevel, uprightQuad } from './levels.js';
import { createAudio } from './audio.js';

// The original wrote its colours straight to the screen: no colour management, no tone mapping.
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');
const timeText = (t) => {
  t = Math.floor(t);
  return pad2(Math.floor(t / 60)) + ':' + pad2(t % 60);
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------------------------------------
// Options and progress (localStorage, guarded)
// ---------------------------------------------------------------------------------------------
const options = { volume: 0.65, sensitivity: 1, fov: 95, scale: 0.75, brightness: 1.08, invert: false, shake: true, retro: true, muted: false };
try {
  Object.assign(options, JSON.parse(localStorage.getItem('earthquake-options') || '{}'));
} catch (e) {}
{
  const num = (v, d, a, b) => (Number.isFinite(Number(v)) ? clamp(Number(v), a, b) : d);
  options.volume = num(options.volume, 0.65, 0, 1);
  options.sensitivity = num(options.sensitivity, 1, 0.2, 2.5);
  options.fov = num(options.fov, 95, 75, 115);
  options.scale = num(options.scale, 0.75, 0.4, 1);
  options.brightness = num(options.brightness, 1.08, 0.7, 1.5);
  for (const k of ['invert', 'shake', 'retro', 'muted']) options[k] = !!options[k];
}
function storeOptions() {
  try {
    localStorage.setItem('earthquake-options', JSON.stringify(options));
  } catch (e) {}
}
const progress = { unlocked: 1, map: 0 };
try {
  Object.assign(progress, JSON.parse(localStorage.getItem('earthquake-progress') || '{}'));
} catch (e) {}
progress.unlocked = clamp(progress.unlocked | 0, 1, LEVELS.length);
progress.map = clamp(progress.map | 0, 0, progress.unlocked - 1);
function saveProgress() {
  try {
    localStorage.setItem('earthquake-progress', JSON.stringify(progress));
  } catch (e) {}
}

// ---------------------------------------------------------------------------------------------
// Boot: renderer, input for keyboard/mouse, gamepad and touch, loading card
// ---------------------------------------------------------------------------------------------
const ACTIONS = {
  move: { type: 'vector', keys: { up: ['KeyW', 'KeyZ'], down: ['KeyS'], left: ['KeyA', 'KeyQ'], right: ['KeyD'] }, gamepad: 'leftStick+dpad', touch: 'stick' },
  // The original aims with the arrow keys as well as the mouse.
  aim: { type: 'vector', keys: 'arrows', gamepad: [], clamp: false },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  use: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Use' },
  next: { gamepad: ['RB'], touch: 'Gun' },
  prev: { gamepad: ['LB'] },
  walk: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  w1: { keys: ['Digit1', 'Numpad1'] },
  w2: { keys: ['Digit2', 'Numpad2'] },
  w3: { keys: ['Digit3', 'Numpad3'] },
  axe: { keys: ['KeyV', 'Digit4', 'Numpad4'] },
  map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  full: { keys: ['KeyF'] },
  qsave: { keys: ['F5'] },
  qload: { keys: ['F8'] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};
// The original drew min(window × scale, 1500) pixels across (at least 320 × 240), scaled up with hard pixels.
const linesFor = (w, h) => {
  const cw = Math.max(320, Math.round(Math.min(w * options.scale, 1500)));
  return Math.max(240, Math.round((cw * h) / Math.max(1, w)));
};
let renderLines = linesFor(innerWidth, innerHeight);
const kit = await boot({
  title: 'EARTHQUAKE',
  canvas: $('view'),
  gear: 'none',
  pixelHeight: renderLines,
  renderer: { antialias: false },
  background: '#111910',
  accent: '#c2a16c',
  touch: { top: 'center', topOffset: 10 },
  input: ACTIONS,
});
const { input, renderer } = kit;
const canvas = kit.canvas;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.autoClear = false;
kit.onResize((w, h) => {
  renderLines = linesFor(w, h);
  kit.setPixelHeight(renderLines);
});
kit.loading.progress(0.65, 'Building the Breachworks…');

const rand = makeRng((Math.random() * 2 ** 31) | 0);
const rnd = (a, b) => a + (b - a) * rand();

// ---------------------------------------------------------------------------------------------
// The texture atlas: 4 × 8 tiles of 128 px, drawn exactly as the original (same seed)
// ---------------------------------------------------------------------------------------------
const SIGNS = {
  16: ['CRYPT', 'WEST / 01'], 17: ['FOUNDRY', 'EAST / 02'], 18: ['REACTOR', 'POWER / 03'],
  20: ['OSSUARY', 'WEST / 01'], 21: ['BELLOWS', 'EAST / 02'], 22: ['CRUCIBLE', 'NORTH / 03'], 23: ['SMELTERY', 'MAP / 02'],
  24: ['BELLOWS', 'HEAT / 03'],
};
function makeAtlas() {
  const r = makeRng(84721);
  const s = 128, c = document.createElement('canvas');
  c.width = s * 4;
  c.height = s * 8;
  const ctx = c.getContext('2d');
  const bases = [[115, 103, 83], [102, 96, 79], [78, 80, 70], [89, 72, 48], [105, 89, 56], [52, 76, 30], [75, 142, 131], [144, 126, 93], [114, 60, 34], [144, 145, 115], [180, 65, 20], [242, 160, 56], [110, 205, 177], [43, 53, 46], [89, 38, 26], [190, 186, 157]];
  for (let tile = 0; tile < 32; tile++) {
    const ox = (tile % 4) * s, oy = Math.floor(tile / 4) * s;
    const image = ctx.createImageData(s, s), d = image.data;
    const base = bases[tile] || bases[2];
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const k = (y * s + x) * 4;
        let grain = r.range(-14, 14), shade = 1;
        let bx = (x + (Math.floor(y / 32) % 2) * 32) % 64, by = y % 32;
        if (tile === 0 || tile === 1) {
          if (tile === 1) {
            bx = x % 64;
            by = y % 64;
          }
          if (bx < 3 || by < 3) shade = 0.36;
          else if (bx < 5 || by < 5) shade = 1.22;
          else if (bx > 61 || by > (tile === 0 ? 29 : 61)) shade = 0.68;
          shade *= 0.92 + Math.sin(Math.floor((x + (Math.floor(y / 32) % 2) * 32) / 64) * 7 + Math.floor(y / 32) * 3) * 0.1;
        }
        if (tile === 2 || tile === 13) {
          if (x < 4 || y < 4 || x > 124 || y > 124) shade = 0.43;
          else if (x < 6 || y < 6) shade = 1.45;
          shade += Math.sin(x * 0.16) * 0.04;
          grain += Math.sin(x * 1.7 + y * 0.03) * 3;
        }
        if (tile === 3) {
          if (x % 26 < 3) shade = 0.4;
          grain += Math.sin(x * 4 + y * 0.04) * 12;
        }
        if (tile === 5 || tile === 6 || tile === 10) {
          const n = Math.sin(x * 0.11 + Math.cos(y * 0.15) * 3) + Math.cos(y * 0.13 + Math.sin(x * 0.08) * 2) + Math.sin((x + y) * 0.07);
          shade = 0.6 + n * 0.18;
          grain *= 0.4;
        }
        if (tile === 11 || tile === 12) grain *= 0.2;
        for (let a = 0; a < 3; a++) d[k + a] = clamp(base[a] * shade + grain, 0, 255);
        d[k + 3] = 255;
      }
    }
    ctx.putImageData(image, ox, oy);
    ctx.save();
    ctx.translate(ox, oy);
    if (tile === 2 || tile === 13) {
      for (const x of [10, 118]) {
        for (const y of [10, 118]) {
          ctx.fillStyle = '#232b22';
          ctx.fillRect(x - 3, y - 3, 7, 7);
          ctx.fillStyle = '#93927a';
          ctx.fillRect(x - 2, y - 2, 4, 3);
        }
      }
    }
    if (tile === 4 || tile === 14) {
      ctx.strokeStyle = tile === 4 ? '#d9b77a' : '#c5ac72';
      ctx.lineWidth = 5;
      ctx.strokeRect(9, 9, 110, 110);
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(70, 22);
      ctx.lineTo(43, 68);
      ctx.lineTo(66, 68);
      ctx.lineTo(54, 105);
      ctx.lineTo(87, 53);
      ctx.lineTo(64, 53);
      ctx.closePath();
      ctx.stroke();
      if (tile === 14) {
        ctx.fillStyle = '#161f1480';
        for (let i = 0; i < 5; i++) ctx.fillRect(i * 29, 0, 4, 128);
      }
    }
    if (tile === 0) {
      ctx.strokeStyle = '#24301d60';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const x = r.range(3, 125), y = r.range(3, 125);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 7, y + 8);
        ctx.lineTo(x + 3, y + 16);
        ctx.stroke();
      }
    }
    if (tile >= 16) {
      const [text, sub] = SIGNS[tile] || ['BREACH', 'POWER / 03'];
      ctx.fillStyle = '#303b2b';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#9b956c';
      ctx.lineWidth = 3;
      ctx.strokeRect(5, 8, 118, 112);
      ctx.fillStyle = '#d5c491';
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(text, 64, 68);
      ctx.font = '12px monospace';
      ctx.fillText(sub, 64, 93);
    }
    ctx.restore();
  }
  return c;
}
const atlasTex = new THREE.CanvasTexture(makeAtlas());
atlasTex.flipY = false; // canvas row 0 is v = 0, as in the original upload
atlasTex.magFilter = atlasTex.minFilter = THREE.NearestFilter;
atlasTex.generateMipmaps = false;
atlasTex.wrapS = atlasTex.wrapT = THREE.ClampToEdgeWrapping;
atlasTex.colorSpace = THREE.NoColorSpace;

// ---------------------------------------------------------------------------------------------
// The original shaders as TSL node materials (identical maths on WebGPU and WebGL2)
// ---------------------------------------------------------------------------------------------
const U = { time: uniform(0), bright: uniform(options.brightness), retro: uniform(options.retro ? 1 : 0), portalA: uniform(0.12), muzzleA: uniform(0) };
// Eight lamps: xyz + intensity, and a colour. Slot 0 is the player's lantern and muzzle flash.
const LP = Array.from({ length: 8 }, () => uniform(new THREE.Vector4(0, -1000, 0, 0)));
const LC = Array.from({ length: 8 }, () => uniform(new THREE.Vector3(0, 0, 0)));
const SUN = new THREE.Vector3(-0.4, 0.8, 0.3).normalize();
const safeNormalize = (v) => v.div(max(length(v), 1e-6));

// Per-vertex light, as in the original vertex shader: a warm sun plus the eight lamps.
const vertexLight = varying(
  Fn(() => {
    const p = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
    const n = safeNormalize(modelWorldMatrix.mul(vec4(normalLocal, 0)).xyz);
    const sun = max(dot(n, vec3(SUN.x, SUN.y, SUN.z)), 0);
    const light = vec3(0.39, 0.34, 0.28).add(vec3(0.49, 0.42, 0.32).mul(sun)).toVar();
    for (let i = 0; i < 8; i++) {
      const d = LP[i].xyz.sub(p);
      const falloff = LP[i].w.div(dot(d, d).mul(0.12).add(1));
      light.addAssign(LC[i].mul(falloff).mul(max(dot(n, safeNormalize(d)), 0.12)));
    }
    return light;
  })()
);

/** The original fragment shader. weapon: fixed bright light, no fog. alpha: a uniform for additive parts. */
function surfaceColor(weapon, alpha = null) {
  return Fn(() => {
    const tile = floor(attribute('aTile', 'float').add(0.1));
    const tint = attribute('aColor', 'vec3');
    const glow = attribute('aGlow', 'float');
    const uv0 = uv();
    const t = U.time;
    // Acid, the portal and lava flow.
    const flowing = tile.equal(5).or(tile.equal(6)).or(tile.equal(10));
    const wobble = vec2(sin(uv0.y.mul(5).add(t.mul(0.7))).mul(0.035).add(t.mul(0.02)), cos(uv0.x.mul(4).add(t.mul(0.5))).mul(0.045).add(t.mul(0.013)));
    const tuv = select(flowing, uv0.add(wobble), uv0);
    const at = vec2(mod(tile, 4), floor(tile.div(4))).add(tclamp(fract(tuv), 0.004, 0.996)).div(vec2(4, 8));
    const tex = texture(atlasTex, at).rgb;
    const light = weapon ? vec3(1.08) : vertexLight;
    const col = tex.mul(tint).mul(light.add(glow)).toVar();
    if (!weapon) {
      const dist = distance(positionWorld, cameraPosition);
      const fog = float(1).sub(exp(max(dist.sub(15), 0).mul(-0.01)));
      col.assign(mix(col, vec3(0.115, 0.125, 0.1), fog));
    }
    col.mulAssign(U.bright);
    const grain = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5).div(120).mul(U.retro);
    col.addAssign(vec3(grain));
    col.assign(mix(col, floor(col.mul(48).add(0.5)).div(48), U.retro.mul(0.4)));
    return vec4(col, alpha ?? float(1));
  })();
}
// The hand-written renderer never culled faces, so every surface draws from both sides.
const worldMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
worldMat.colorNode = surfaceColor(false);
const portalMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
portalMat.colorNode = surfaceColor(false, U.portalA);
const weaponMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
weaponMat.colorNode = surfaceColor(true);
const muzzleMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
muzzleMat.colorNode = surfaceColor(true, U.muzzleA);
for (const m of [worldMat, portalMat, weaponMat, muzzleMat]) m.fog = false;

// Soft round additive sprites (particles and torch embers), as the original point shader.
const partMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
partMat.fog = false;
partMat.colorNode = Fn(() => {
  const d = length(uv().sub(0.5)).mul(2);
  If(d.greaterThan(1), () => {
    Discard();
  });
  const k = float(1).sub(d);
  const c = attribute('aCol', 'vec4');
  return vec4(c.rgb, c.a.mul(k).mul(k));
})();

// The painted sky: drifting fbm clouds, a pale horizon and a low amber sun.
const skyU = { t: uniform(0), aspect: uniform(1), yaw: uniform(0), pitch: uniform(0) };
const hash2 = (p) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123));
const vnoise = (p) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  return mix(mix(hash2(i), hash2(i.add(vec2(1, 0))), u.x), mix(hash2(i.add(vec2(0, 1))), hash2(i.add(vec2(1, 1))), u.x), u.y);
};
const skyNode = Fn(() => {
  const a = vec2(screenUV.x.mul(2).sub(1), float(1).sub(screenUV.y.mul(2)));
  const p = vec2(a.x.mul(skyU.aspect).add(skyU.yaw), a.y.add(skyU.pitch.mul(1.3))).toVar();
  const q = p.mul(2).add(vec2(skyU.t.mul(0.008), 0));
  const n = vnoise(q).mul(0.5).add(vnoise(q.mul(2.1)).mul(0.25)).add(vnoise(q.mul(4.3)).mul(0.125)).add(vnoise(q.mul(8.1)).mul(0.0625));
  const c = mix(vec3(0.065, 0.09, 0.079), vec3(0.27, 0.28, 0.19), n).toVar();
  const horizon = float(1).sub(smoothstep(-0.3, 1, p.y));
  c.assign(mix(c, vec3(0.2, 0.235, 0.165), horizon.mul(0.35)));
  const d = length(p.sub(vec2(0.95, 0.48)).mul(vec2(1, 1.2)));
  c.addAssign(vec3(0.4, 0.24, 0.085).mul(exp(d.mul(-5))).mul(0.42));
  return vec4(c, 1);
})();

// ---------------------------------------------------------------------------------------------
// Models: the original low-poly builders, plus the Hexer and the Smelter King
// ---------------------------------------------------------------------------------------------
function toGeometry(geo) {
  const d = geo.data();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(d.nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
  g.setAttribute('aTile', new THREE.BufferAttribute(d.tile, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(d.col, 3));
  g.setAttribute('aGlow', new THREE.BufferAttribute(d.glow, 1));
  g.computeBoundingSphere();
  return g;
}

function biped(g, s, armor, { big = false, ogre = false, visorTile = 12, visorCol = [1, 0.59, 0.27], chestCol = [1.2, 0.9, 0.5], hornCol = [1, 0.99, 0.66] } = {}) {
  g.box(0, 1.05 * s, 0, 0.65 * s, 0.65 * s, 0.39 * s, 2, armor, 0, 0.6);
  g.box(0, 0.83 * s, 0.12 * s, 0.48 * s, 0.24 * s, 0.29 * s, 8, armor, 0, 0.5);
  g.box(0, 1.53 * s, 0, 0.4 * s, 0.39 * s, 0.37 * s, 2, armor, 0, 0.5);
  g.box(0, 1.55 * s, 0.2 * s, 0.31 * s, 0.062 * s, 0.035 * s, visorTile, visorCol, 1.8, 0.3);
  g.box(0, 1.4 * s, 0.2 * s, 0.28 * s, 0.11 * s, 0.1 * s, 13, [0.52, 0.65, 0.46], 0, 0.2);
  for (const k of [-1, 1]) {
    g.box(k * 0.42 * s, 1.24 * s, 0, 0.27 * s, 0.33 * s, 0.43 * s, ogre ? 8 : 2, armor, 0, 0.5);
    g.box(k * 0.47 * s, 0.94 * s, 0.1 * s, 0.18 * s, 0.4 * s, 0.22 * s, 7, [0.82, 0.79, 0.59], 0, 0.5);
    g.box(k * 0.36 * s, 0.8 * s, 0.22 * s, 0.18 * s, 0.18 * s, 0.35 * s, 13, [0.66, 0.77, 0.57], 0, 0.4);
  }
  g.cylinder(0.27 * s, 0.84 * s, 0.49 * s, (ogre || big ? 0.15 : 0.075) * s, 0.56 * s, 2, [0.52, 0.62, 0.48], 8, undefined, 0, 'z');
  if (big) {
    g.box(0, 1.12 * s, 0.21 * s, 0.25 * s, 0.32 * s, 0.035, 10, chestCol, 1.5, 0.3);
    for (const k of [-1, 1]) {
      g.cylinder(k * 0.25 * s, 1.92 * s, 0, 0.12 * s, 0.53 * s, 9, hornCol, 6, 0);
      g.cylinder(k * 0.52 * s, 1.56 * s, 0, 0.105 * s, 0.31 * s, 9, hornCol.map((v) => v * 0.99), 6, 0);
    }
  }
}

function makeModels() {
  const M = {};
  const mk = (name, fn) => {
    const g = new Geo();
    fn(g);
    M[name] = g;
  };
  mk('flame', (g) => {
    g.cylinder(0, 0.22, 0, 0.21, 0.54, 11, [1, 0.6, 0.35], 5, 0.015, 1.8);
    g.cylinder(0, 0.08, 0, 0.12, 0.33, 11, [1, 0.92, 0.65], 5, 0.025, 2.2);
  });
  mk('shadow', (g) => g.cylinder(0, 0, 0, 0.48, 0.025, 15, [0.09, 0.13, 0.08], 14));
  // Weapons: a center-mounted double-barrel shotgun, a rotary nailgun, a rocket tube, and an axe.
  for (let w = 0; w < 4; w++) {
    mk('weapon' + w, (g) => {
      g.box(0.17, -0.1, 0.15, 0.18, 0.2, 0.55, 7, [0.9, 0.8, 0.65], 0, 0.45);
      g.box(-0.13, -0.04, -0.02, 0.18, 0.18, 0.31, 7, [0.86, 0.77, 0.64], 0, 0.45);
      g.box(0.14, -0.09, 0.0, 0.21, 0.21, 0.23, 13, [0.83, 0.88, 0.7], 0, 0.35);
      g.box(-0.15, -0.01, -0.05, 0.2, 0.19, 0.23, 13, [0.78, 0.85, 0.66], 0, 0.35);
      if (w === 0) {
        g.box(0, 0, 0.05, 0.35, 0.27, 0.65, 3, [1, 0.85, 0.6], 0, 0.4);
        g.box(0, 0.05, -0.19, 0.36, 0.23, 0.34, 2, [0.85, 0.87, 0.72], 0, 0.4);
        for (const s of [-1, 1]) {
          g.cylinder(s * 0.088, 0.1, -0.68, 0.081, 0.78, 2, [0.7, 0.77, 0.65], 10, 0.081, 0, 'z');
          g.cylinder(s * 0.088, 0.1, -1.08, 0.063, 0.013, 13, [0.18, 0.23, 0.17], 10, 0.063, 0, 'z');
          g.cylinder(s * 0.088, 0.1, -0.47, 0.086, 0.06, 9, [0.9, 0.9, 0.74], 10, 0.086, 0, 'z');
        }
        g.box(0, 0.16, -0.82, 0.032, 0.1, 0.12, 2, [0.8, 0.8, 0.65], 0, 0.2);
        g.box(0, -0.01, -0.57, 0.24, 0.12, 0.35, 3, [1, 0.82, 0.53], 0, 0.3);
      }
      if (w === 1) {
        g.box(0, 0.03, -0.18, 0.39, 0.29, 0.62, 2, [0.7, 0.77, 0.68], 0, 0.45);
        g.cylinder(0, 0.08, -0.7, 0.16, 0.59, 2, [0.71, 0.79, 0.68], 10, 0.16, 0, 'z');
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU;
          g.cylinder(Math.cos(a) * 0.11, 0.08 + Math.sin(a) * 0.11, -0.94, 0.044, 0.5, 9, [0.65, 0.74, 0.66], 6, 0.044, 0, 'z');
        }
        g.box(0.23, 0, -0.25, 0.13, 0.3, 0.4, 8, [1, 0.9, 0.66], 0, 0.3);
        g.box(0, 0.235, -0.23, 0.06, 0.03, 0.18, 12, [0.55, 1, 0.79], 0.9, 0.1);
      }
      if (w === 2) {
        g.cylinder(0, 0.08, -0.45, 0.235, 1.12, 2, [0.84, 0.88, 0.64], 12, 0.235, 0, 'z');
        g.cylinder(0, 0.08, -1.025, 0.237, 0.11, 9, [0.95, 0.89, 0.54], 12, 0.237, 0, 'z');
        g.cylinder(0, 0.08, -1.087, 0.172, 0.014, 13, [0.14, 0.18, 0.13], 12, 0.172, 0, 'z');
        g.cylinder(0, 0.08, 0.15, 0.265, 0.11, 2, [0.65, 0.73, 0.51], 12, 0.265, 0, 'z');
        g.box(0.21, 0.04, -0.23, 0.11, 0.23, 0.35, 3, [0.9, 0.83, 0.6], 0, 0.25);
        g.box(0, 0.33, -0.55, 0.05, 0.15, 0.05, 9, [0.85, 0.85, 0.65], 0, 0.1);
        for (const z of [-0.18, -0.37]) g.cylinder(0, 0.08, z, 0.24, 0.065, 8, [1.5, 1.7, 0.7], 12, 0.24, 0, 'z');
      }
      if (w === 3) {
        g.cylinder(0.02, 0.11, -0.34, 0.045, 1.2, 3, [1, 0.8, 0.57], 8, 0.045, 0, 'z');
        g.box(0, 0.13, -0.91, 0.14, 0.18, 0.26, 2, [0.8, 0.86, 0.69], 0, 0.25);
        g.quad([-0.05, 0.1, -0.8], [0.34, 0.1, -0.72], [0.4, 0.1, -1.18], [-0.05, 0.1, -1.04], 9, [1.2, 1.19, 1], 0.1);
        g.quad([-0.05, 0.16, -1.04], [0.4, 0.16, -1.18], [0.34, 0.16, -0.72], [-0.05, 0.16, -0.8], 9, [1, 1, 0.86], 0.1);
      }
    });
  }
  // Pickups use strong shapes and colors; their meshes are reused throughout the level.
  mk('health', (g) => {
    g.box(0, 0.22, 0, 0.62, 0.44, 0.52, 9, [0.94, 0.96, 0.78], 0, 0.5);
    g.box(0, 0.25, 0.267, 0.36, 0.1, 0.015, 8, [1.8, 0.56, 0.38], 0.2, 0.3);
    g.box(0, 0.25, 0.274, 0.1, 0.34, 0.015, 8, [1.8, 0.56, 0.38], 0.2, 0.3);
    g.box(0, 0.45, 0, 0.18, 0.02, 0.4, 8, [1.8, 0.6, 0.4], 0.1, 0.3);
  });
  mk('armor', (g) => {
    g.box(0, 0.38, 0, 0.64, 0.7, 0.34, 2, [0.62, 1.18, 0.65], 0, 0.6);
    g.box(0, 0.33, 0.21, 0.36, 0.4, 0.14, 9, [0.75, 1.2, 0.74], 0.1, 0.4);
    g.box(-0.36, 0.67, 0, 0.23, 0.17, 0.39, 2, [0.6, 1.1, 0.67], 0, 0.3);
    g.box(0.36, 0.67, 0, 0.23, 0.17, 0.39, 2, [0.6, 1.1, 0.67], 0, 0.3);
  });
  mk('shells', (g) => {
    g.box(0, 0.18, 0, 0.5, 0.36, 0.4, 3, [1.2, 0.9, 0.53], 0, 0.5);
    for (const x of [-0.15, 0, 0.15]) g.cylinder(x, 0.42, 0, 0.058, 0.18, 8, [1.35, 0.8, 0.5], 6);
  });
  mk('nails', (g) => {
    g.box(0, 0.22, 0, 0.52, 0.44, 0.48, 2, [0.65, 1, 0.92], 0, 0.5);
    for (const x of [-0.15, 0, 0.15]) g.box(x, 0.24, 0.245, 0.05, 0.26, 0.02, 9, [1.2, 1.2, 0.95], 0.1, 0.2);
  });
  mk('rockets', (g) => {
    for (const x of [-0.18, 0.18]) {
      g.cylinder(x, 0.32, 0, 0.12, 0.64, 2, [0.85, 0.92, 0.62], 8, 0.12);
      g.cylinder(x, 0.74, 0, 0.12, 0.19, 8, [1.4, 0.87, 0.5], 8, 0);
    }
  });
  mk('key', (g) => {
    g.torus(0, 0.65, 0, 0.24, 0.064, 9, [1.3, 1.06, 0.39], 0.4);
    g.box(0, 0.23, 0, 0.08, 0.7, 0.08, 9, [1.3, 1.05, 0.36], 0.3, 0.3);
    g.box(0.11, -0.01, 0, 0.25, 0.07, 0.09, 9, [1.3, 1.05, 0.36], 0.3, 0.3);
    g.box(0.12, 0.14, 0, 0.24, 0.07, 0.09, 9, [1.3, 1.05, 0.36], 0.3, 0.3);
  });
  mk('quad', (g) => {
    g.sphere(0, 0.42, 0, 0.37, 12, [0.53, 0.82, 1.3], 1);
    g.torus(0, 0.42, 0, 0.48, 0.025, 12, [0.6, 0.85, 1.4], 1.5);
  });
  mk('mega', (g) => {
    g.sphere(0, 0.4, 0, 0.43, 12, [0.4, 0.9, 1.1], 0.5);
    g.box(0, 0.4, 0.36, 0.4, 0.11, 0.05, 9, [1.3, 1.3, 1.1], 0.6, 0.3);
    g.box(0, 0.4, 0.37, 0.11, 0.4, 0.05, 9, [1.3, 1.3, 1.1], 0.6, 0.3);
  });
  mk('nailgun', (g) => {
    g.box(0, 0.05, 0, 0.45, 0.3, 0.6, 2, [0.7, 0.85, 0.7], 0, 0.45);
    g.cylinder(0, 0.1, -0.54, 0.13, 0.7, 2, [0.8, 0.85, 0.7], 8, 0.13, 0, 'z');
    g.box(0.29, 0, 0, 0.16, 0.3, 0.3, 8, [1, 0.9, 0.65], 0, 0.3);
  });
  mk('rocketgun', (g) => {
    g.cylinder(0, 0.1, -0.12, 0.23, 1.05, 2, [0.9, 0.95, 0.62], 10, 0.23, 0, 'z');
    g.cylinder(0, 0.1, -0.68, 0.24, 0.1, 9, [1.1, 1, 0.5], 10, 0.24, 0, 'z');
    g.box(0, -0.22, 0.14, 0.15, 0.37, 0.19, 3, [1, 0.9, 0.7], 0, 0.3);
  });
  // Enemy bodies face local +Z. The legs are separate for a walking cycle.
  const legs = (name, sc, tileA, colA, tileB, colB) => mk(name, (g) => {
    g.box(0, -0.25 * sc, 0, 0.22 * sc, 0.5 * sc, 0.25 * sc, tileA, colA, 0, 0.5);
    g.box(0, -0.48 * sc, 0.11 * sc, 0.25 * sc, 0.14 * sc, 0.43 * sc, tileB, colB, 0, 0.4);
  });
  mk('fiend', (g) => {
    g.sphere(0, 0.91, 0, 0.38, 7, [1.01, 0.81, 0.55], 0, 1, 0.95, 1.25);
    g.sphere(0, 1.34, 0.17, 0.27, 7, [1.13, 0.94, 0.63], 0, 1, 1, 0.98);
    g.box(0, 1.27, 0.4, 0.28, 0.085, 0.08, 13, [0.3, 0.26, 0.17], 0, 0.2);
    for (const s of [-1, 1]) {
      g.box(s * 0.12, 1.42, 0.403, 0.09, 0.045, 0.03, 11, [1, 0.45, 0.18], 2, 0.1);
      g.cylinder(s * 0.2, 1.67, 0.11, 0.085, 0.33, 9, [1.2, 1.13, 0.82], 5, 0);
      g.sphere(s * 0.4, 0.88, 0.03, 0.13, 7, [1.1, 0.87, 0.58], 0, 0.8, 2.5, 0.85);
      g.box(s * 0.47, 0.51, 0.15, 0.14, 0.15, 0.33, 9, [1.1, 1.06, 0.74], 0, 0.25);
    }
  });
  legs('fiendleg', 1, 7, [0.9, 0.76, 0.48], 9, [1, 1, 0.7]);
  const guardArmor = [0.74, 0.89, 0.63], ogreArmor = [1.03, 0.68, 0.4], bossArmor = [0.38, 0.44, 0.32], kingArmor = [0.56, 0.32, 0.24];
  mk('guard', (g) => biped(g, 1, guardArmor));
  legs('guardleg', 1, 2, guardArmor, 13, [0.72, 0.81, 0.59]);
  mk('ogre', (g) => biped(g, 1.35, ogreArmor, { ogre: true }));
  legs('ogreleg', 1.35, 2, ogreArmor, 13, [0.72, 0.81, 0.59]);
  mk('boss', (g) => biped(g, 1.9, bossArmor, { big: true, visorTile: 11, visorCol: [1, 0.59, 0.2] }));
  legs('bossleg', 1.9, 2, bossArmor, 13, [0.72, 0.81, 0.59]);
  // New: the Smelter King, a slag-plated Warden with a molten chest and visor.
  mk('boss2', (g) => {
    biped(g, 2.0, kingArmor, { big: true, visorTile: 10, visorCol: [1.3, 0.75, 0.35], chestCol: [1.4, 0.8, 0.4], hornCol: [0.95, 0.78, 0.6] });
    for (const k of [-1, 1]) g.box(k * 0.62 * 2, 2.6, 0, 0.08 * 2, 0.36 * 2, 0.08 * 2, 10, [1.3, 0.7, 0.35], 1.6, 0.2);
  });
  legs('boss2leg', 2.0, 8, kingArmor, 13, [0.62, 0.5, 0.42]);
  // New: the Hexer, a hovering robed caster with a glowing staff.
  mk('hexer', (g) => {
    g.cylinder(0, 0.75, 0, 0.5, 1.3, 9, [0.55, 0.42, 0.7], 8, 0.27);
    g.cylinder(0, 1.42, 0, 0.36, 0.16, 13, [1.3, 1.05, 1.5], 8, 0.3);
    g.sphere(0, 1.64, 0.03, 0.2, 15, [0.82, 0.78, 0.64], 0, 1, 1.1, 1);
    g.cylinder(0, 1.86, -0.04, 0.25, 0.42, 9, [0.42, 0.31, 0.55], 6, 0.04);
    for (const s of [-1, 1]) {
      g.box(s * 0.075, 1.66, 0.2, 0.06, 0.035, 0.03, 12, [0.6, 1, 0.9], 2, 0.1);
      g.box(s * 0.34, 1.18, 0.08, 0.15, 0.42, 0.17, 9, [0.5, 0.38, 0.64], 0, 0.4);
    }
    g.cylinder(0.42, 0.98, 0.2, 0.035, 1.9, 7, [0.9, 0.75, 0.55], 6);
    g.sphere(0.42, 1.98, 0.2, 0.11, 12, [0.6, 1, 0.9], 2.2);
  });
  mk('rocketshot', (g) => {
    g.cylinder(0, 0, 0, 0.09, 0.5, 2, [1, 0.9, 0.58], 8, 0.09, 0, 'z');
    g.cylinder(0, 0, -0.33, 0.09, 0.16, 8, [1, 0.7, 0.3], 8, 0, 0, 'z');
  });
  mk('orb', (g) => g.sphere(0, 0, 0, 0.13, 11, [1, 0.69, 0.3], 2.5));
  mk('seeker', (g) => g.sphere(0, 0, 0, 0.16, 12, [0.55, 1, 0.85], 2.5));
  mk('nail', (g) => g.cylinder(0, 0, 0, 0.021, 0.4, 9, [1, 1, 0.75], 5, 0.021, 1, 'z'));
  mk('portal', (g) => g.disc(0, 0, 0, 1.91, 40, 6, [0.75, 1.07, 0.92], 1));
  mk('switch', (g) => {
    g.box(0, 0.6, 0, 1.0, 1.2, 0.7, 2, [0.66, 0.74, 0.54], 0, 0.8);
    g.box(0, 1.26, 0, 1.12, 0.16, 0.82, 2, [0.95, 0.95, 0.7], 0, 0.7);
    g.box(0, 1.37, 0, 0.46, 0.11, 0.46, 8, [1.4, 0.75, 0.28], 0.8, 0.4);
  });
  mk('switchOn', (g) => g.box(0, 1.38, 0, 0.47, 0.035, 0.47, 12, [0.6, 1, 0.7], 1.6, 0.4));
  // Gate and the secret panels (their runes read upright now).
  mk('gate', (g) => {
    g.box(0, 3.1, 0, 8.3, 6.2, 0.55, 2, [0.64, 0.69, 0.54]);
    for (let x = -3.8; x <= 4; x += 0.65) g.box(x, 3.1, 0.34, 0.16, 6.2, 0.16, 9, [0.55, 0.62, 0.44]);
    g.box(0, 3.4, 0.38, 8.3, 0.33, 0.14, 2, [0.7, 0.7, 0.5]);
    g.box(0, 1.2, 0.4, 8.3, 0.26, 0.17, 2, [0.7, 0.7, 0.5]);
    uprightQuad(g, [-1, 2.2, 0.49], [1, 2.2, 0.49], [1, 4.4, 0.49], [-1, 4.4, 0.49], 4, [1.2, 1, 0.75], 0.3);
  });
  mk('secret', (g) => {
    g.box(0, 2.4, 0, C, 4.8, 0.56, 0, [0.9, 0.96, 0.77]);
    uprightQuad(g, [-0.5, 1.4, 0.3], [0.5, 1.4, 0.3], [0.5, 2.8, 0.3], [-0.5, 2.8, 0.3], 4, [0.85, 0.9, 0.57], 0.1);
  });
  mk('muzzle', (g) => {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, b = ((i + 1) / 8) * TAU, r = i % 2 ? 0.13 : 0.27;
      g.tri([0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], [Math.cos(b) * 0.17, Math.sin(b) * 0.17, 0], 11, [1, 1, 0.7], 2.5);
    }
  });
  const out = {};
  for (const [name, g] of Object.entries(M)) out[name] = toGeometry(g);
  return out;
}
const geos = makeModels();

// ---------------------------------------------------------------------------------------------
// Scene: the static world mesh, instanced batches for everything that moves, the weapon pass
// ---------------------------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.backgroundNode = skyNode;
const camera = kit.fitCamera(new THREE.PerspectiveCamera(78, 1, 0.05, 190));
camera.rotation.order = 'YXZ';
const weaponScene = new THREE.Scene();
const weaponCam = kit.fitCamera(new THREE.PerspectiveCamera(64, 1, 0.01, 10));

// One batch per model, all sharing the world material and (through kit.instanced) one shader.
const BATCHED = ['flame', 'shadow', 'health', 'armor', 'shells', 'nails', 'rockets', 'key', 'quad', 'mega', 'nailgun', 'rocketgun',
  'guard', 'fiend', 'ogre', 'boss', 'hexer', 'boss2', 'guardleg', 'fiendleg', 'ogreleg', 'bossleg', 'boss2leg',
  'rocketshot', 'orb', 'nail', 'seeker', 'switch', 'switchOn', 'gate', 'secret'];
const batches = {};
const batchList = [];
for (const name of BATCHED) {
  const mesh = kit.instanced(geos[name], worldMat, 256);
  mesh.frustumCulled = false;
  mesh.name = name;
  scene.add(mesh);
  const b = { mesh, arr: mesh.instanceMatrix.array, cap: mesh.instanceMatrix.count, n: 0 };
  batches[name] = b;
  batchList.push(b);
}
/** Add one instance: the original model matrix (translate · rotY · rotX · rotZ · scale). */
function put(name, x, y, z, ry = 0, rx = 0, rz = 0, s = 1) {
  const b = batches[name];
  if (!b || b.n >= b.cap) return;
  const a = b.arr, o = b.n * 16;
  const cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx), cz = Math.cos(rz), sz = Math.sin(rz);
  a[o] = (cy * cz + sy * sx * sz) * s;
  a[o + 1] = cx * sz * s;
  a[o + 2] = (-sy * cz + cy * sx * sz) * s;
  a[o + 3] = 0;
  a[o + 4] = (-cy * sz + sy * sx * cz) * s;
  a[o + 5] = cx * cz * s;
  a[o + 6] = (sy * sz + cy * sx * cz) * s;
  a[o + 7] = 0;
  a[o + 8] = sy * cx * s;
  a[o + 9] = -sx * s;
  a[o + 10] = cy * cx * s;
  a[o + 11] = 0;
  a[o + 12] = x;
  a[o + 13] = y;
  a[o + 14] = z;
  a[o + 15] = 1;
  b.n++;
}
function flushBatches() {
  for (const b of batchList) {
    const m = b.mesh;
    m.count = b.n;
    m.visible = b.n > 0;
    if (b.n) {
      const attr = m.instanceMatrix;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, b.n * 16);
      attr.needsUpdate = true;
    }
    b.n = 0;
  }
}

const portalMesh = new THREE.Mesh(geos.portal, portalMat);
portalMesh.frustumCulled = false;
scene.add(portalMesh);

// Particles and torch embers: camera-facing quads rebuilt each frame into one reused buffer.
const PMAX = kit.detail(600, 200);
const QMAX = PMAX + 400;
const partPos = new Float32Array(QMAX * 18), partCol = new Float32Array(QMAX * 24), partUv = new Float32Array(QMAX * 12);
for (let q = 0; q < QMAX; q++) partUv.set([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], q * 12);
const partGeo = new THREE.BufferGeometry();
const partPosAttr = new THREE.BufferAttribute(partPos, 3).setUsage(THREE.DynamicDrawUsage);
const partColAttr = new THREE.BufferAttribute(partCol, 4).setUsage(THREE.DynamicDrawUsage);
partGeo.setAttribute('position', partPosAttr);
partGeo.setAttribute('uv', new THREE.BufferAttribute(partUv, 2));
partGeo.setAttribute('aCol', partColAttr);
partGeo.setDrawRange(0, 0);
const partMesh = new THREE.Mesh(partGeo, partMat);
partMesh.frustumCulled = false;
partMesh.renderOrder = 5;
scene.add(partMesh);

// The weapon: one rig in its own scene, drawn over a cleared depth buffer with its own camera.
const weaponRig = new THREE.Group();
weaponRig.rotation.order = 'YXZ';
const weaponMeshes = [0, 1, 2, 3].map((w) => {
  const m = new THREE.Mesh(geos['weapon' + w], weaponMat);
  m.frustumCulled = false;
  weaponRig.add(m);
  return m;
});
const muzzle = new THREE.Mesh(geos.muzzle, muzzleMat);
muzzle.position.set(0, 0.11, -1.19);
muzzle.frustumCulled = false;
weaponRig.add(muzzle);
weaponScene.add(weaponRig);

let level = null, worldMesh = null, keyItem = null, flow = null;
function loadLevel(index) {
  index = clamp(index | 0, 0, LEVELS.length - 1);
  if (level && level.index === index) return;
  level = buildLevel(LEVELS[index]);
  if (worldMesh) {
    scene.remove(worldMesh);
    worldMesh.geometry.dispose();
  }
  worldMesh = new THREE.Mesh(toGeometry(level.geo), worldMat);
  level.geo = null;
  scene.add(worldMesh);
  const P = level.def.portal;
  portalMesh.position.set(P.x, P.y, P.z);
  keyItem = level.def.items.find((it) => it[0] === 'key');
  flow = null;
}

// ---------------------------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------------------------
const ENEMY = {
  guard: { hp: 60, scale: 1, r: 0.4, speed: 3.0, cd: 1.35, drop: 'shells' },
  fiend: { hp: 82, scale: 1, r: 0.4, speed: 5.4, cd: 0.85, drop: 'health' },
  ogre: { hp: 175, scale: 1.35, r: 0.65, speed: 2.4, cd: 2.1, drop: 'rockets' },
  boss: { hp: 800, scale: 1.9, r: 1.0, speed: 2.2, cd: 1.25, boss: true },
  hexer: { hp: 70, scale: 1, r: 0.42, speed: 2.6, cd: 2.3, drop: 'nails' },
  boss2: { hp: 1000, scale: 2.0, r: 1.05, speed: 2.3, cd: 1.2, boss: true },
};
const WEAPONS = [{ name: 'SHOTGUN', ammo: 'SHELLS', cooldown: 0.62 }, { name: 'NAILGUN', ammo: 'NAILS', cooldown: 0.105 }, { name: 'ROCKET LAUNCHER', ammo: 'ROCKETS', cooldown: 0.8 }, { name: 'AXE', ammo: 'MELEE', cooldown: 0.48 }];
const DIFFS = ['EASY', 'NORMAL', 'HARD'];

let state = 'menu', difficulty = 1, player = null, totalKills = 0, checkpoint = null, checkpointName = 'THE APPROACH';
let visualTime = 0, mapOpen = false, toastUntil = 0, hitUntil = 0, levelTitleUntil = 0, damageFlash = 0, pickupFlash = 0, quake = 0;
let portalActive = false, bossAwake = false, hudTick = 0, flowTimer = 0, accumulator = 0;
let doors = [], pickups = [], enemies = [], projectiles = [];
const flowGrid = new Int16Array(NX * NZ), flowQueue = new Int16Array(NX * NZ), blockMask = new Uint8Array(NX * NZ);
// Particles: a fixed pool, recycled oldest-first when full.
const parts = Array.from({ length: PMAX }, () => ({ p: [0, 0, 0], v: [0, 0, 0], life: 0, max: 1, size: 0.1, col: [1, 1, 1], gravity: 0 }));
let pCount = 0, pRing = 0;
// What the player is asking for this frame (filled from kit.input, read by the 120 Hz simulation).
const ctl = { fwd: 0, right: 0, mag: 0, aimX: 0, aimY: 0, jump: false, fire: false, walk: false };
let holdGate = false, wheelAcc = 0, wheelIdle = 0;

const audio = createAudio(options, () => (player ? { x: player.x, z: player.z, yaw: player.yaw } : null));
const sfx = (name, pos, vol) => audio.sfx(name, pos, vol);
const rumble = (strength, ms) => input.rumble(strength, ms);

function gateDoor() {
  return doors.find((d) => d.id === 'gate') || null;
}
function bossEnemy() {
  return enemies.find((e) => ENEMY[e.type]?.boss) || null;
}

function freshPlayer() {
  const s = level.def.start;
  return { x: s.x, y: level.floorAt(s.x, s.z), z: s.z, vx: 0, vz: 0, vy: 0, yaw: s.yaw, pitch: 0, grounded: true, health: 100, armor: 25, ammo: [32, 0, 0], owned: [true, false, false, true], weapon: 0, cooldown: 0, quad: 0, key: false, reactor: false, kills: 0, secrets: [], time: 0, bob: 0, step: 0, land: 0, recoil: 0, hazard: 0, shots: 0, hits: 0 };
}
/** The loadout carried from one map into the next. */
function carryFrom(p) {
  return { health: p.health, armor: p.armor, ammo: [...p.ammo], owned: [...p.owned], weapon: p.weapon };
}
function addItem(type, i, j, extra = {}) {
  const x = wx(i), z = wz(j);
  const p = { type, x, z, y: level.floorAt(x, z) + 0.2, active: true, phase: rnd(0, TAU), ...extra };
  p.shadowY = supportAt(p.x, p.z, p.y - 0.2) + 0.02;
  pickups.push(p);
}
function addEnemy(type, i, j) {
  const x = wx(i), z = wz(j), st = ENEMY[type];
  enemies.push({ type, x, z, y: level.floorAt(x, z), hp: st.hp, maxHp: st.hp, scale: st.scale, r: st.r, height: 1.8 * st.scale, yaw: Math.PI, cooldown: rnd(0.5, 1.6), alert: false, dead: false, deathTime: 0, anim: rnd(0, 6), hurt: 0, los: false, losWait: 0, home: [x, z] });
}
function resetEntities() {
  const def = level.def;
  doors = def.doors.map((d) => ({ id: d.id, secret: d.secret, x: d.x, z: d.z, base: d.base, rot: d.rot, blocks: d.blocks, open: 0, target: 0, width: d.id === 'gate' ? 8.3 : C, height: d.id === 'gate' ? 6.2 : 4.8, mesh: d.id === 'gate' ? 'gate' : 'secret' }));
  pickups = [];
  enemies = [];
  projectiles = [];
  pCount = 0;
  for (const [type, i, j, extra] of def.items) addItem(type, i, j, extra);
  for (const [type, i, j] of def.enemies) addEnemy(type, i, j);
  for (const e of enemies) e.hp = e.maxHp = Math.round(e.hp * [0.8, 1, 1.25][difficulty]);
  flowTimer = 0;
  // The door mask belongs to this map now (a Hexer blink in the first tick must not use the last map's).
  refreshBlocks();
}

// ---------------------------------------------------------------------------------------------
// Collision and rays (unchanged maths)
// ---------------------------------------------------------------------------------------------
function boxDoor(d, out = {}) {
  const along = Math.abs(Math.sin(d.rot)) > 0.5;
  out.x1 = d.x - (along ? 0.35 : d.width / 2);
  out.x2 = d.x + (along ? 0.35 : d.width / 2);
  out.z1 = d.z - (along ? d.width / 2 : 0.35);
  out.z2 = d.z + (along ? d.width / 2 : 0.35);
  out.y1 = d.base + d.open * (d.height + 0.5);
  out.y2 = d.base + d.height + d.open * (d.height + 0.5);
  out.door = d;
  return out;
}
const _db = {};
function circleBox(x, z, r, b) {
  const dx = x - clamp(x, b.x1, b.x2), dz = z - clamp(z, b.z1, b.z2);
  return dx * dx + dz * dz < r * r;
}
const PROBES = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
function canMove(x, z, r, y, height = 1.65, self = null) {
  for (const [px, pz] of PROBES) {
    const dx = px * r, dz = pz * r;
    if (!level.cellOf(x + dx, z + dz) || level.floorAt(x + dx, z + dz) > y + 0.46) return false;
  }
  const near = level.solidsIn(x - r, z - r, x + r, z + r);
  for (let n = 0; n < near.length; n++) {
    const b = near[n];
    if (b.y2 <= y + 0.46 || b.y1 >= y + height) continue;
    if (circleBox(x, z, r, b)) return false;
  }
  for (const d of doors) {
    const b = boxDoor(d, _db);
    if (y + height > b.y1 && y < b.y2 && circleBox(x, z, r, b)) return false;
  }
  if (!self) {
    for (const e of enemies) {
      if (e.dead || Math.abs(e.y - y) > 2) continue;
      if (Math.hypot(e.x - x, e.z - z) < e.r + r * 0.8) return false;
    }
  }
  return true;
}
function supportAt(x, z, feet) {
  let y = level.floorAt(x, z);
  const near = level.solidsIn(x - 0.05, z - 0.05, x + 0.05, z + 0.05);
  for (let n = 0; n < near.length; n++) {
    const b = near[n];
    if (b.y2 > feet + 0.46 || b.y2 < y - 0.1) continue;
    if (x > b.x1 - 0.05 && x < b.x2 + 0.05 && z > b.z1 - 0.05 && z < b.z2 + 0.05) y = Math.max(y, b.y2);
  }
  return y;
}
const AXES = [['x1', 'x2'], ['y1', 'y2'], ['z1', 'z2']];
function rayBox(o, d, b, maxT) {
  let lo = 0, hi = maxT;
  for (let k = 0; k < 3; k++) {
    const mn = b[AXES[k][0]], mx = b[AXES[k][1]];
    if (Math.abs(d[k]) < 1e-7) {
      if (o[k] < mn || o[k] > mx) return Infinity;
    } else {
      let a = (mn - o[k]) / d[k], c = (mx - o[k]) / d[k];
      if (a > c) [a, c] = [c, a];
      lo = Math.max(lo, a);
      hi = Math.min(hi, c);
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}
const FLOOR_HIT = { floor: true };
function rayWorld(o, d, maxT = 100) {
  let best = maxT, hit = null;
  // Short rays (projectile steps, blasts) only look at the boxes around them; long sight lines scan all.
  const ex = o[0] + d[0] * maxT, ez = o[2] + d[2] * maxT;
  const list = Math.abs(ex - o[0]) < 6 && Math.abs(ez - o[2]) < 6 ? level.solidsIn(Math.min(o[0], ex), Math.min(o[2], ez), Math.max(o[0], ex), Math.max(o[2], ez)) : level.solids;
  for (let n = 0; n < list.length; n++) {
    const b = list[n];
    const t = rayBox(o, d, b, best);
    if (t < best) {
      best = t;
      hit = b;
    }
  }
  for (const door of doors) {
    const b = boxDoor(door, {});
    const t = rayBox(o, d, b, best);
    if (t < best) {
      best = t;
      hit = b;
    }
  }
  if (d[1] < -0.015) {
    for (let t = 0.2; t < best; t += 0.45) {
      const x = o[0] + d[0] * t, z = o[2] + d[2] * t, y = o[1] + d[1] * t;
      if (y < level.floorAt(x, z) + 0.02) {
        best = t;
        hit = FLOOR_HIT;
        break;
      }
    }
  }
  return { t: best, hit };
}
function rayEnemy(o, d, e, maxT) {
  const r = e.r * 1.15, h = e.height * 0.5, cx = e.x, cy = e.y + h, cz = e.z;
  const ox = (o[0] - cx) / r, oy = (o[1] - cy) / h, oz = (o[2] - cz) / r;
  const dx = d[0] / r, dy = d[1] / h, dz = d[2] / r;
  const a = dx * dx + dy * dy + dz * dz, b = 2 * (ox * dx + oy * dy + oz * dz), c = ox * ox + oy * oy + oz * oz - 1, disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t < maxT ? t : Infinity;
}
function aimDirection(yaw = player.yaw, pitch = player.pitch) {
  return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
}
function eyePos() {
  return [player.x, player.y + 1.65, player.z];
}

// ---------------------------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------------------------
function particle(p, v, life, size, col, gravity = 0) {
  let q;
  if (pCount < PMAX) q = parts[pCount++];
  else {
    q = parts[pRing];
    pRing = (pRing + 1) % PMAX;
  }
  q.p[0] = p[0]; q.p[1] = p[1]; q.p[2] = p[2];
  q.v[0] = v[0]; q.v[1] = v[1]; q.v[2] = v[2];
  q.life = q.max = life;
  q.size = size;
  q.col[0] = col[0]; q.col[1] = col[1]; q.col[2] = col[2];
  q.gravity = gravity;
}
const _pv = [0, 0, 0];
function burst(p, col, count = 14, speed = 3, size = 0.16) {
  for (let i = 0; i < count; i++) {
    _pv[0] = rnd(-speed, speed);
    _pv[1] = rnd(0, speed);
    _pv[2] = rnd(-speed, speed);
    particle(p, _pv, rnd(0.2, 0.65), rnd(size * 0.5, size * 1.5), col, 8);
  }
}
function updateParticles(dt) {
  for (let i = 0; i < pCount; i++) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) {
      // Swap the last live particle in (additive blending does not care about order).
      const last = parts[--pCount];
      parts[pCount] = p;
      parts[i] = last;
      i--;
      continue;
    }
    p.v[1] -= p.gravity * dt;
    p.p[0] += p.v[0] * dt;
    p.p[1] += p.v[1] * dt;
    p.p[2] += p.v[2] * dt;
  }
}

// ---------------------------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------------------------
function hurtPlayer(amount) {
  if (state !== 'playing' || player.health <= 0) return;
  amount *= [0.6, 1, 1.4][difficulty];
  const absorbed = Math.min(player.armor, amount * 0.6);
  player.armor = Math.max(0, player.armor - absorbed);
  player.health -= amount - absorbed;
  damageFlash = Math.min(0.9, damageFlash + 0.28);
  player.land = 0.06;
  rumble(Math.min(1, 0.25 + amount / 40), 160);
  if (player.health < 1) {
    player.health = 0;
    die();
  } else if (player.hurtSoundUntil === undefined || player.time > player.hurtSoundUntil) {
    sfx('hurt');
    player.hurtSoundUntil = player.time + 0.4;
  }
  updateHUD();
}
function wakeBoss(e) {
  bossAwake = true;
  e.alert = true;
  quake = 0.5;
  toast(level.def.text.boss, 4);
  sfx('alert', [e.x, e.y, e.z], 2);
  rumble(0.5, 300);
}
/** byPlayer: Overdrive and the hit marker only count the player's own shots (not an ogre's stray grenade). */
function damageEnemy(e, amount, point, byPlayer = true) {
  if (e.dead) return;
  e.hp -= amount * (byPlayer && player.quad > 0 ? 4 : 1);
  e.hurt = 0.12;
  e.alert = true;
  if (byPlayer) {
    hitUntil = visualTime + 0.12;
    player.hits++;
  }
  if (point) burst(point, [0.61, 0.18, 0.055], 6, 1.8, 0.13);
  const boss = ENEMY[e.type].boss;
  // A shot boss wakes up once its gate is open (before, it could be sniped from the doorway).
  if (boss && !bossAwake && (gateDoor()?.open || 0) > 0.3 && e.hp > 0) wakeBoss(e);
  if (e.hp <= 0) {
    e.dead = true;
    e.deathTime = 0;
    player.kills++;
    sfx('death', [e.x, e.y, e.z], boss ? 1 : 0.7);
    burst([e.x, e.y + e.height * 0.5, e.z], [0.48, 0.16, 0.055], boss ? 60 : 14, 4, 0.18);
    if (boss) {
      portalActive = true;
      quake = 1.8;
      toast(level.def.text.bossDown, 5);
      sfx('portal');
      rumble(1, 600);
    } else if (rand() < 0.38) {
      const type = ENEMY[e.type].drop || 'health';
      const p = { type, x: e.x, z: e.z, y: e.y + 0.15, active: true, phase: rand() * TAU, amount: type === 'health' ? 15 : undefined };
      p.shadowY = supportAt(p.x, p.z, e.y) + 0.02;
      pickups.push(p);
    }
    updateHUD();
  } else if (e.type === 'hexer' && (e.blinkCd || 0) <= 0 && rand() < 0.55) blink(e);
}
/** The Hexer's escape: vanish and reappear a few cells away in the same room. */
function blink(e) {
  const a = level.cellAt(e.x, e.z);
  const area = a.cell?.area;
  for (let k = 0; k < 14; k++) {
    const i = a.i + Math.round(rnd(-5, 5)), j = a.j + Math.round(rnd(-5, 5));
    if (!navPass(i, j) || level.grid[j][i].area !== area) continue;
    const x = wx(i) + rnd(-0.6, 0.6), z = wz(j) + rnd(-0.6, 0.6), y = level.floorAt(x, z);
    if (Math.abs(y - e.y) > 1.2 || Math.hypot(x - player.x, z - player.z) < 5) continue;
    if (!canMove(x, z, e.r, y, e.height, e)) continue;
    if (enemies.some((o) => o !== e && !o.dead && Math.hypot(o.x - x, o.z - z) < o.r + e.r)) continue;
    burst([e.x, e.y + 1, e.z], [0.55, 0.3, 0.9], 16, 2.5, 0.14);
    e.x = x;
    e.z = z;
    e.y = y;
    burst([x, y + 1, z], [0.4, 1, 0.85], 16, 2.5, 0.14);
    sfx('blink', [x, y, z], 0.8);
    e.blinkCd = 2.6;
    e.cooldown = Math.min(e.cooldown, 0.6);
    e.losWait = 0;
    return;
  }
}
function openSecret(d) {
  if (d.target) return;
  d.target = 1;
  player.secrets.push(d.secret);
  toast('YOU FOUND A SECRET AREA', 4);
  sfx('secret', [d.x, d.base + 1, d.z]);
  rumble(0.3, 160);
  flowTimer = 0;
  updateHUD();
}
function hitscan(dir, damage, maxT = 90) {
  const o = eyePos(), r = rayWorld(o, dir, maxT);
  let enemyHit = null;
  for (const e of enemies) {
    if (e.dead) continue;
    const t = rayEnemy(o, dir, e, r.t);
    if (t < r.t) {
      r.t = t;
      enemyHit = e;
    }
  }
  const p = V.add(o, V.scale(dir, r.t));
  if (enemyHit) {
    damageEnemy(enemyHit, damage, p);
    sfx('hit', p, 0.18);
  } else if (r.hit) {
    if (r.hit.door && r.hit.door.id !== 'gate') openSecret(r.hit.door);
    burst(p, [0.85, 0.66, 0.26], 3, 1, 0.08);
  }
  return enemyHit;
}
function switchWeapon(i) {
  if (!player || !player.owned[i] || player.weapon === i) return;
  player.weapon = i;
  player.cooldown = Math.max(player.cooldown, 0.18);
  player.recoil = 0.5;
  sfx('click');
  updateHUD();
}
function cycleWeapon(step) {
  let i = player.weapon;
  for (let n = 0; n < 4; n++) {
    i = (i + step + 4) % 4;
    if (player.owned[i]) {
      switchWeapon(i);
      break;
    }
  }
}
function fire() {
  if (state !== 'playing' || mapOpen || player.cooldown > 0) return;
  const w = player.weapon;
  if (w < 3 && player.ammo[w] <= 0) {
    const next = player.owned.findIndex((v, i) => v && i < 3 && player.ammo[i] > 0);
    switchWeapon(next >= 0 ? next : 3);
    toast('OUT OF AMMO', 1.1);
    return;
  }
  if (w < 3) player.ammo[w]--;
  player.shots++;
  player.cooldown = WEAPONS[w].cooldown;
  player.recoil = 1;
  quake = Math.max(quake, w === 2 ? 0.13 : w === 0 ? 0.06 : 0.02);
  sfx(['shotgun', 'nailgun', 'rocket', 'axe'][w]);
  rumble([0.35, 0.12, 0.5, 0.2][w], [90, 40, 140, 60][w]);
  const dir = aimDirection(), o = eyePos();
  if (w === 0) {
    hitscan(dir, 8);
    for (let i = 0; i < 9; i++) hitscan(aimDirection(player.yaw + rnd(-0.045, 0.045), player.pitch + rnd(-0.033, 0.033)), 7);
  } else if (w === 1) {
    const d = aimDirection(player.yaw + rnd(-0.008, 0.008), player.pitch + rnd(-0.008, 0.008));
    projectiles.push({ type: 'nail', p: V.add(o, V.scale(d, 0.65)), v: V.scale(d, 67), life: 1.6, owner: 'player', damage: 16, gravity: 0 });
  } else if (w === 2) {
    projectiles.push({ type: 'rocket', p: V.add(o, V.scale(dir, 0.72)), v: V.scale(dir, 26), life: 5, owner: 'player', damage: 95, gravity: 0 });
  } else {
    const e = hitscan(dir, 44, 2.6);
    if (!e) sfx('axe', null, 0.3);
  }
  if (w !== 3) for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.z - player.z) < 27) e.alert = true;
  updateHUD();
}
function explosion(p, damage, owner) {
  sfx('explosion', p);
  burst(p, [1, 0.55, 0.13], 35, 7, 0.4);
  burst(p, [0.5, 0.42, 0.23], 18, 4, 0.7);
  const dist = Math.hypot(p[0] - player.x, p[1] - player.y - 1, p[2] - player.z);
  quake = Math.max(quake, Math.max(0, 1 - dist / 25) * 0.45);
  if (dist < 14) rumble(Math.max(0.15, 0.7 - dist / 20), 180);
  for (const e of enemies) {
    if (e.dead) continue;
    const d = Math.hypot(p[0] - e.x, p[1] - e.y - e.height * 0.4, p[2] - e.z);
    if (d < 5) {
      const dir = V.norm([e.x - p[0], e.y + e.height * 0.5 - p[1], e.z - p[2]]);
      if (rayWorld(p, dir, d).t > d - 0.25) damageEnemy(e, damage * (1 - d / 5), [e.x, e.y + 1, e.z], owner === 'player');
    }
  }
  if (dist < 4.7) {
    const dmg = damage * (1 - dist / 4.7) * (owner === 'player' ? 0.5 : 0.65);
    hurtPlayer(dmg);
    const dir = V.norm([player.x - p[0], player.y + 0.7 - p[1], player.z - p[2]]), power = (1 - dist / 4.7) * 12;
    player.vx += dir[0] * power;
    player.vz += dir[2] * power;
    player.vy += Math.max(2, dir[1] * power + 3);
    player.grounded = false;
  }
}
const PLAYER_TARGET = { x: 0, z: 0, y: 0, r: 0.37, height: 1.75 };
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const b = projectiles[i];
    b.life -= dt;
    if (b.type === 'seeker' && player.health > 0) {
      // Hexes turn toward the player at a limited rate: sidestep or break line of sight.
      const tx = player.x - b.p[0], ty = player.y + 1.1 - b.p[1], tz = player.z - b.p[2], tl = Math.hypot(tx, ty, tz) || 1;
      const vl = Math.hypot(b.v[0], b.v[1], b.v[2]) || 1, k = Math.min(1, 2.4 * dt);
      const nx = b.v[0] / vl + (tx / tl - b.v[0] / vl) * k, ny = b.v[1] / vl + (ty / tl - b.v[1] / vl) * k, nz = b.v[2] / vl + (tz / tl - b.v[2] / vl) * k;
      const nl = Math.hypot(nx, ny, nz) || 1;
      b.v[0] = (nx / nl) * b.speed;
      b.v[1] = (ny / nl) * b.speed;
      b.v[2] = (nz / nl) * b.speed;
    }
    const old = b.p;
    b.v[1] -= b.gravity * dt;
    const step = V.scale(b.v, dt), len = V.len(step), dir = V.norm(step), hit = rayWorld(old, dir, len + 0.04);
    let target = null, at = hit.t;
    if (b.owner === 'player') {
      for (const e of enemies) {
        if (e.dead) continue;
        const t = rayEnemy(old, dir, e, at);
        if (t < at) {
          at = t;
          target = e;
        }
      }
    } else {
      PLAYER_TARGET.x = player.x;
      PLAYER_TARGET.z = player.z;
      PLAYER_TARGET.y = player.y;
      const t = rayEnemy(old, dir, PLAYER_TARGET, at);
      if (t < at) {
        at = t;
        target = 'player';
      }
    }
    b.p = V.add(old, V.scale(dir, Math.min(at, len)));
    const wallHit = hit.hit && hit.t <= len + 0.02;
    const collided = !!target || wallHit || b.p[1] < level.floorAt(b.p[0], b.p[2]) + 0.07 || b.life <= 0;
    if (collided) {
      if (hit.hit?.door && hit.hit.door.id !== 'gate' && b.owner === 'player') openSecret(hit.hit.door);
      if (b.type === 'rocket' || b.type === 'grenade') {
        if (wallHit) b.p = V.add(b.p, V.scale(dir, -0.055));
        if (target && target !== 'player') damageEnemy(target, 25, b.p);
        explosion(b.p, b.damage, b.owner);
      } else {
        if (target === 'player') hurtPlayer(b.damage);
        else if (target) damageEnemy(target, b.damage, b.p);
        burst(b.p, b.owner === 'player' ? [0.9, 0.69, 0.22] : b.type === 'seeker' ? [0.45, 1, 0.85] : [1, 0.42, 0.12], b.type === 'nail' ? 3 : 7, 1.4, 0.1);
        if (b.type === 'seeker') sfx('sizzle', b.p, 0.6);
      }
      projectiles.splice(i, 1);
      continue;
    }
    if (b.type === 'rocket') particle(b.p, [rnd(-0.1, 0.1), 0.1, rnd(-0.1, 0.1)], 0.25, 0.22, [1, 0.55, 0.17], 0);
    else if (b.type === 'grenade' || b.type === 'orb') {
      if (rand() < 0.5) particle(b.p, [0, 0, 0], 0.18, 0.15, [1, 0.42, 0.1]);
    } else if (b.type === 'seeker' && rand() < 0.6) particle(b.p, [0, 0, 0], 0.25, 0.15, [0.45, 0.95, 1]);
  }
}
function takeItem(p) {
  if (!p.active) return;
  const t = p.type, amount = p.amount, T = level.def.text;
  if (t === 'health') {
    if (player.health >= 100) return;
    player.health = Math.min(100, player.health + (amount || 25));
    toast('HEALTH +' + (amount || 25), 1.4);
  } else if (t === 'mega') {
    player.health = Math.min(200, player.health + 100);
    toast('MEGA HEALTH +100', 2);
  } else if (t === 'armor') {
    if (player.armor >= 200) return;
    player.armor = Math.min(200, player.armor + (amount || 50));
    toast('ARMOR +' + (amount || 50), 1.5);
  } else if (t === 'shells' || t === 'nails' || t === 'rockets') {
    const idx = ['shells', 'nails', 'rockets'].indexOf(t), a = [12, 50, 5][idx], maxA = [150, 400, 80][idx];
    if (player.ammo[idx] >= maxA) return;
    player.ammo[idx] = Math.min(maxA, player.ammo[idx] + a);
    toast(t.toUpperCase() + ' +' + a, 1.3);
  } else if (t === 'nailgun' || t === 'rocketgun') {
    const idx = t === 'nailgun' ? 1 : 2;
    player.owned[idx] = true;
    player.ammo[idx] = Math.min([150, 400, 80][idx], player.ammo[idx] + (idx === 1 ? 100 : 8));
    switchWeapon(idx);
    toast(idx === 1 ? 'NAILGUN ACQUIRED · [2]' : 'ROCKET LAUNCHER ACQUIRED · [3]', 3);
  } else if (t === 'key') {
    player.key = true;
    toast(T.keyGot, 4);
    sfx('key');
    rumble(0.4, 200);
  } else if (t === 'quad') {
    player.quad = 25;
    toast('OVERDRIVE · 4× DAMAGE FOR 25 SECONDS', 3);
    sfx('secret');
  }
  p.active = false;
  pickupFlash = 0.12;
  sfx('pickup');
  rumble(0.12, 50);
  if (t === 'key') {
    checkpointName = 'THE ' + T.key;
    saveCheckpoint();
    // The original always pointed at the reactor here, even when it was already running.
    toast(`${T.key} ACQUIRED · CHECKPOINT SAVED\n${player.reactor ? T.returnHint : T.swHint}`, 4.5);
  }
  updateHUD();
}
function interactionTarget() {
  if (!player) return null;
  let best = null, dist = 3.25;
  for (const d of doors) {
    if (d.target) continue;
    let dd = Math.hypot(player.x - d.x, player.z - d.z);
    if (d.id === 'gate') dd = Math.hypot(player.x - clamp(player.x, d.x - 3, d.x + 3), player.z - d.z);
    if (dd < dist && Math.abs(player.y - d.base) < 3) {
      dist = dd;
      best = { type: 'door', obj: d };
    }
  }
  const sp = level.def.switchPos;
  if (!player.reactor && Math.hypot(player.x - sp[0], player.z - sp[2]) < 3 && Math.abs(player.y - sp[1]) < 2) best = { type: 'switch' };
  return best;
}
function use() {
  const target = interactionTarget();
  if (!target) return;
  const T = level.def.text, sp = level.def.switchPos;
  if (target.type === 'switch') {
    player.reactor = true;
    quake = 0.4;
    sfx('switch', sp);
    rumble(0.45, 220);
    checkpointName = T.swOn;
    saveCheckpoint();
    toast(T.swOn + ' · CHECKPOINT SAVED\n' + (player.key ? T.returnHint : T.keyHint), 4);
    burst([sp[0], sp[1] + 1.3, sp[2]], [0.3, 1, 0.7], 25, 4, 0.13);
  } else {
    const d = target.obj;
    if (d.id === 'gate') {
      if (!player.key) {
        toast(T.gateNeedsKey, 2);
        sfx('click');
      } else if (!player.reactor) {
        toast(T.gateNoPower, 2.5);
        sfx('click');
      } else {
        d.target = 1;
        quake = 0.45;
        sfx('gate', [d.x, d.base, d.z]);
        rumble(0.5, 400);
        toast(T.gateOpen, 3);
        flowTimer = 0;
      }
    } else openSecret(d);
  }
  updateHUD();
}

// ---------------------------------------------------------------------------------------------
// Enemies: line of sight, a flow field toward the player, and per-type attacks
// ---------------------------------------------------------------------------------------------
function refreshBlocks() {
  blockMask.fill(0);
  for (const d of doors) if (!d.target) for (const [i, j] of d.blocks) blockMask[j * NX + i] = 1;
}
function navPass(i, j) {
  if (i < 0 || i >= NX || j < 0 || j >= NZ) return false;
  const c = level.grid[j][i];
  if (!c || HAZARDS[c.kind]) return false;
  return !blockMask[j * NX + i];
}
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function buildFlow() {
  refreshBlocks();
  flowGrid.fill(-1);
  flow = flowGrid;
  const goal = level.cellAt(player.x, player.z);
  if (!goal.cell) return;
  let head = 0, tail = 0;
  const id = goal.j * NX + goal.i;
  flowGrid[id] = 0;
  flowQueue[tail++] = id;
  while (head < tail) {
    const a = flowQueue[head++], i = a % NX, j = (a / NX) | 0;
    for (const [di, dj] of DIRS4) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || ni >= NX || nj < 0 || nj >= NZ) continue;
      const idx = nj * NX + ni;
      if (flowGrid[idx] >= 0 || !navPass(ni, nj)) continue;
      flowGrid[idx] = flowGrid[a] + 1;
      flowQueue[tail++] = idx;
    }
  }
}
function lob(e, p, d, damage, vol) {
  const t = Math.max(0.3, Math.hypot(d[0], d[2]) / 13);
  const v = [d[0] / t, d[1] / t + 3.5 * t, d[2] / t];
  projectiles.push({ type: 'grenade', p: [...p], v, life: 4, owner: e.type, damage, gravity: 7 });
  sfx('rocket', p, vol);
}
function fan(e, p, d, count, spread, speed, damage) {
  const dir = V.norm(d);
  for (let i = 0; i < count; i++) {
    const a = (i - (count - 1) / 2) * spread, cs = Math.cos(a), sn = Math.sin(a);
    const nd = [dir[0] * cs - dir[2] * sn, dir[1], dir[0] * sn + dir[2] * cs];
    projectiles.push({ type: 'orb', p: V.add(p, V.scale(nd, 0.65)), v: V.scale(nd, speed), life: 3, owner: e.type, damage, gravity: 0 });
  }
}
function enemyAttack(e) {
  const p = [e.x, e.y + e.height * 0.65, e.z], to = [player.x + player.vx * 0.1, player.y + 1.0, player.z + player.vz * 0.1], d = V.sub(to, p);
  const dist = V.len(d);
  if (e.type === 'fiend') {
    if (dist < 2.3) {
      hurtPlayer(16);
      e.leap = 0.22;
      sfx('hit', p);
    }
  } else if (e.type === 'ogre') lob(e, p, d, 52, 0.3);
  else if (e.type === 'hexer') {
    const dir = V.norm(d);
    projectiles.push({ type: 'seeker', p: V.add(p, V.scale(dir, 0.6)), v: V.scale(dir, 8.5), life: 4.5, owner: 'hexer', damage: 14, gravity: 0, speed: 8.5 });
    sfx('hex', p, 0.5);
  } else if (e.type === 'boss2') {
    // The Smelter King alternates a five-orb fan with a pair of slag bombs to either side.
    e.volley = (e.volley || 0) + 1;
    if (e.volley % 3 === 0) {
      const l = Math.hypot(d[0], d[2]) || 1;
      for (const side of [-1, 1]) lob(e, p, [d[0] + (side * d[2] * 2.2) / l, d[1], d[2] - (side * d[0] * 2.2) / l], 40, 0.35);
    } else {
      fan(e, p, d, 5, 0.12, 18, 14);
      sfx('nailgun', p, 0.5);
    }
    if (dist < 5.5) {
      hurtPlayer(22);
      quake = 0.35;
      player.vx += d[0] * 0.5;
      player.vz += d[2] * 0.5;
    }
  } else {
    const boss = e.type === 'boss';
    fan(e, p, d, boss ? 3 : 1, 0.105, boss ? 19 : 22, boss ? 20 : 10);
    sfx('nailgun', p, boss ? 0.5 : 0.25);
    if (boss && dist < 5) {
      hurtPlayer(20);
      quake = 0.3;
      player.vx += d[0] * 0.5;
      player.vz += d[2] * 0.5;
    }
  }
}
const safeCell = (x, z) => {
  const c = level.cellOf(x, z);
  return !!c && !HAZARDS[c.kind];
};
function updateEnemies(dt) {
  flowTimer -= dt;
  if (flowTimer <= 0) {
    buildFlow();
    flowTimer = 0.7;
  }
  const gate = gateDoor();
  const eye = eyePos();
  for (const e of enemies) {
    e.hurt = Math.max(0, e.hurt - dt);
    e.leap = Math.max(0, (e.leap || 0) - dt);
    e.blinkCd = Math.max(0, (e.blinkCd || 0) - dt);
    if (e.dead) {
      e.deathTime += dt;
      continue;
    }
    const st = ENEMY[e.type];
    e.cooldown -= dt;
    e.losWait -= dt;
    const dx = player.x - e.x, dz = player.z - e.z, dist = Math.hypot(dx, dz);
    if (e.losWait <= 0) {
      const o = [e.x, e.y + e.height * 0.65, e.z], d = V.sub(eye, o), len = V.len(d);
      e.los = dist < 37 && rayWorld(o, V.norm(d), len).t >= len - 0.2;
      e.losWait = 0.22 + rand() * 0.13;
    }
    if (!e.alert && e.los && dist < 25) {
      e.alert = true;
      if (dist < 17) sfx('alert', [e.x, e.y, e.z], 0.65);
    }
    if (st.boss && !bossAwake) {
      if (gate && player.z < gate.z - 2 && gate.open > 0.7) wakeBoss(e);
      else continue;
    }
    if (!e.alert) continue;
    e.yaw = Math.atan2(dx, dz);
    let mx = 0, mz = 0;
    const speed = st.speed;
    if (e.los) {
      const advance = e.type === 'fiend' ? dist > 1.28 : dist > (st.boss ? 8.5 : e.type === 'hexer' ? 13 : 10);
      if (advance) {
        mx = dx / (dist || 1);
        mz = dz / (dist || 1);
      } else if ((e.type === 'guard' && dist < 4.5) || (e.type === 'hexer' && dist < 6)) {
        mx = -dx / (dist || 1);
        mz = -dz / (dist || 1);
      } else if (e.type === 'guard' || e.type === 'hexer') {
        const s = Math.sin(player.time * 0.8 + e.anim) * 0.55;
        mx = (dz / (dist || 1)) * s;
        mz = (-dx / (dist || 1)) * s;
      }
    } else if (flow) {
      const a = level.cellAt(e.x, e.z);
      const value = a.i >= 0 && a.i < NX && a.j >= 0 && a.j < NZ ? flow[a.j * NX + a.i] : -1;
      let best = null, bv = value < 0 ? 32000 : value;
      for (const [di, dj] of DIRS4) {
        const ni = a.i + di, nj = a.j + dj;
        if (ni < 0 || ni >= NX || nj < 0 || nj >= NZ) continue;
        const v = flow[nj * NX + ni];
        if (v >= 0 && v < bv && navPass(ni, nj)) {
          bv = v;
          best = [wx(ni), wz(nj)];
        }
      }
      if (best) {
        const tx = best[0] - e.x, tz = best[1] - e.z, l = Math.hypot(tx, tz) || 1;
        mx = tx / l;
        mz = tz / l;
        e.yaw = Math.atan2(mx, mz);
      }
    }
    for (const other of enemies) {
      if (other === e || other.dead) continue;
      const xx = e.x - other.x, zz = e.z - other.z, d = Math.hypot(xx, zz), r = e.r + other.r;
      if (d < r + 0.25 && d > 0.01) {
        mx += (xx / d) * (r + 0.25 - d) * 1.6;
        mz += (zz / d) * (r + 0.25 - d) * 1.6;
      }
    }
    const l = Math.hypot(mx, mz);
    if (l > 1.3) {
      mx /= l;
      mz /= l;
    }
    const nx = e.x + mx * speed * dt, nz = e.z + mz * speed * dt;
    // Enemies no longer wade into acid or slag after the player (they could never climb out).
    if (Math.hypot(nx - player.x, nz - player.z) > 0.75 + e.r) {
      if (safeCell(nx, e.z) && canMove(nx, e.z, e.r, e.y, e.height, e)) e.x = nx;
      if (safeCell(e.x, nz) && canMove(e.x, nz, e.r, e.y, e.height, e)) e.z = nz;
    }
    e.y = lerp(e.y, supportAt(e.x, e.z, e.y), Math.min(1, dt * 16));
    if (l > 0.1) e.anim += dt * speed * 2.5;
    if (e.los && e.cooldown <= 0 && dist < (e.type === 'fiend' ? 1.9 : 27)) {
      enemyAttack(e);
      const enraged = e.type === 'boss2' && e.hp < e.maxHp * 0.4;
      e.cooldown = st.cd * (enraged ? 0.7 : 1) + rnd(0, 0.3);
      e.fire = 0.14;
    }
    e.fire = Math.max(0, (e.fire || 0) - dt);
  }
}

// ---------------------------------------------------------------------------------------------
// The player: Quake-style acceleration, friction, air control and auto-hop
// ---------------------------------------------------------------------------------------------
function updatePlayer(dt) {
  player.time += dt;
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.quad = Math.max(0, player.quad - dt);
  player.recoil = Math.max(0, player.recoil - dt * 4.8);
  player.land = lerp(player.land, 0, Math.min(1, dt * 12));
  const forward = ctl.fwd, right = ctl.right;
  player.yaw -= ctl.aimX * dt * 1.9;
  player.pitch = clamp(player.pitch + ctl.aimY * dt * 1.3, -1.48, 1.48);
  let wx0 = -Math.sin(player.yaw) * forward + Math.cos(player.yaw) * right, wz0 = -Math.cos(player.yaw) * forward - Math.sin(player.yaw) * right;
  const wl = Math.hypot(wx0, wz0);
  if (wl) {
    wx0 /= wl;
    wz0 /= wl;
  }
  // An analog stick walks at part speed; keys are always full speed.
  const speed = 9.6 * (ctl.walk ? 0.5 : 1) * Math.max(0.35, ctl.mag);
  if (player.grounded) {
    if (ctl.jump) {
      player.vy = 8.1;
      player.grounded = false;
      sfx('jump');
    } else {
      const v = Math.hypot(player.vx, player.vz);
      if (v > 0.001) {
        const next = Math.max(0, v - Math.max(v, 3) * 4 * dt);
        player.vx *= next / v;
        player.vz *= next / v;
      }
    }
  }
  if (wl) {
    const projected = player.vx * wx0 + player.vz * wz0, want = player.grounded ? speed : 0.9, add = want - projected;
    if (add > 0) {
      const accel = Math.min(add, 10 * speed * dt);
      player.vx += wx0 * accel;
      player.vz += wz0 * accel;
    }
  }
  const v = Math.hypot(player.vx, player.vz);
  if (v > 23) {
    player.vx *= 23 / v;
    player.vz *= 23 / v;
  }
  const x = player.x + player.vx * dt, z = player.z + player.vz * dt;
  if (canMove(x, player.z, 0.34, player.y)) player.x = x;
  else player.vx = 0;
  if (canMove(player.x, z, 0.34, player.y)) player.z = z;
  else player.vz = 0;
  const ground = supportAt(player.x, player.z, player.y);
  player.vy -= 24 * dt;
  let nextY = player.y + player.vy * dt;
  if (player.vy > 0) {
    const near = level.solidsIn(player.x - 0.31, player.z - 0.31, player.x + 0.31, player.z + 0.31);
    for (let n = 0; n < near.length; n++) {
      const b = near[n];
      if (player.y + 1.65 <= b.y1 + 0.015 && nextY + 1.65 > b.y1 && circleBox(player.x, player.z, 0.31, b)) {
        nextY = Math.min(nextY, b.y1 - 1.652);
        player.vy = 0;
      }
    }
    for (const d of doors) {
      const b = boxDoor(d, _db);
      if (player.y + 1.65 <= b.y1 + 0.015 && nextY + 1.65 > b.y1 && circleBox(player.x, player.z, 0.31, b)) {
        nextY = Math.min(nextY, b.y1 - 1.652);
        player.vy = 0;
      }
    }
  }
  player.y = nextY;
  if (player.y <= ground) {
    if (!player.grounded && player.vy < -4) {
      sfx('land');
      player.land = Math.min(0.15, -player.vy * 0.008);
      if (player.vy < -10) rumble(0.2, 70);
    }
    player.y = ground;
    player.vy = 0;
    player.grounded = true;
  } else player.grounded = false;
  if (v > 1 && player.grounded) {
    player.bob += dt * v * 0.95;
    player.step += dt * v;
    if (player.step > 3.0) {
      player.step = 0;
      sfx('step', null, 0.8);
    }
  }
  const cell = level.cellOf(player.x, player.z), hz = cell && HAZARDS[cell.kind];
  if (hz && player.y < cell.h + 0.43) {
    player.hazard += dt;
    if (player.hazard > hz.every) {
      player.hazard = 0;
      hurtPlayer(hz.damage);
      toast(hz.warn, 1);
      if (cell.kind === 'lava') sfx('sizzle');
    }
  } else player.hazard = 0;
  for (const p of pickups) if (p.active && Math.hypot(p.x - player.x, p.z - player.z) < 1.1 && Math.abs(p.y - player.y) < 2.1) takeItem(p);
  if (ctl.fire) fire();
  const P = level.def.portal;
  if (portalActive && Math.hypot(player.x - P.x, player.z - P.z) < 2.1 && player.z < P.z + 4.2) win();
}
function update(dt) {
  if (state !== 'playing' || mapOpen) return;
  updatePlayer(dt);
  if (state !== 'playing') return;
  updateEnemies(dt);
  updateProjectiles(dt);
  for (const d of doors) if (d.open < d.target) d.open = Math.min(d.target, d.open + dt * 0.46);
  updateParticles(dt);
  damageFlash = Math.max(0, damageFlash - dt * 0.8);
  pickupFlash = Math.max(0, pickupFlash - dt * 0.4);
  quake = Math.max(0, quake - dt * 0.7);
  hudTick -= dt;
  if (hudTick <= 0) {
    updateHUD();
    hudTick = 0.09;
  }
}

// ---------------------------------------------------------------------------------------------
// Saving: checkpoints in memory and in localStorage, keyed to the map
// ---------------------------------------------------------------------------------------------
function snapshot() {
  return { version: 1, level: level.index, difficulty, player: clone(player), enemies: clone(enemies), pickups: clone(pickups), doors: doors.map((d) => ({ id: d.id, open: d.open, target: d.target })), portalActive, bossAwake, checkpointName };
}
function saveCheckpoint(persistent = true) {
  checkpoint = snapshot();
  if (persistent) {
    try {
      localStorage.setItem('earthquake-save', JSON.stringify(checkpoint));
    } catch (e) {}
    toast('CHECKPOINT SAVED · ' + checkpointName, 3);
  }
}
function restoreCheckpoint(data = checkpoint) {
  if (!data || data.version !== 1) return false;
  const li = clamp(data.level | 0, 0, LEVELS.length - 1);
  difficulty = clamp(data.difficulty | 0, 0, 2);
  loadLevel(li);
  player = clone(data.player);
  resetEntities();
  enemies = clone(data.enemies).filter((e) => ENEMY[e.type]);
  pickups = clone(data.pickups);
  for (const p of pickups) if (p.shadowY === undefined) p.shadowY = supportAt(p.x, p.z, p.y - 0.2) + 0.02;
  for (const d of doors) {
    const s = (data.doors || []).find((e) => e.id === d.id);
    if (s) {
      d.open = s.open;
      d.target = s.target;
    }
  }
  refreshBlocks();
  portalActive = !!data.portalActive;
  bossAwake = !!data.bossAwake;
  checkpointName = data.checkpointName || level.def.start.area;
  totalKills = enemies.length;
  player.health = Math.max(player.health, 50);
  player.vx = player.vz = player.vy = 0;
  player.cooldown = 0.3;
  projectiles = [];
  pCount = 0;
  damageFlash = pickupFlash = quake = 0;
  flowTimer = 0;
  if (progress.unlocked < li + 1) progress.unlocked = li + 1;
  progress.map = li;
  saveProgress();
  syncDifficultyButtons();
  enterPlay();
  toast('CHECKPOINT · ' + checkpointName, 3);
  return true;
}
function quickSave() {
  checkpointName = level.cellOf(player.x, player.z)?.area || 'QUICK SAVE';
  saveCheckpoint();
}

// ---------------------------------------------------------------------------------------------
// Flow between screens
// ---------------------------------------------------------------------------------------------
function enterPlay() {
  audio.init();
  state = 'playing';
  mapOpen = false;
  $('mapwrap').style.display = 'none';
  $('menu').style.display = 'none';
  closeModal();
  $('hud').style.display = 'block';
  $('crosshair').style.display = 'block';
  resetControls();
  captureMouse();
  updateHUD();
}
function newGame(index = progress.map, carry = null) {
  difficulty = clamp(difficulty, 0, 2);
  loadLevel(index);
  player = freshPlayer();
  if (carry) {
    player.health = clamp(carry.health, 60, 100);
    player.armor = clamp(carry.armor, 0, 200);
    player.ammo = carry.ammo.slice(0, 3);
    player.owned = carry.owned.slice(0, 4);
    player.weapon = player.owned[carry.weapon] ? carry.weapon : 0;
  }
  resetEntities();
  totalKills = enemies.length;
  portalActive = false;
  bossAwake = false;
  quake = damageFlash = pickupFlash = 0;
  flowTimer = 0;
  checkpointName = level.def.start.area;
  progress.map = level.index;
  saveProgress();
  enterPlay();
  // A run that carries a loadout into the next map is worth a saved checkpoint.
  saveCheckpoint(!!carry);
  levelTitleUntil = visualTime + 4.5;
  $('ltLine').textContent = level.def.line;
  $('ltName').textContent = level.def.name;
  setStyle($('leveltitle'), 'opacity', '1');
  toast(startHint(), 4);
  updateHUD();
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  releaseInput();
  showPause();
}
function showPause() {
  state = 'paused';
  const T = level.def.text;
  showPanel(
    `<div class="eyebrow">${level.def.id} / ${timeText(player.time)}</div><h2>Breath. Then breach.</h2><p>${objective()}</p>` +
      `<button class="primary" id="resumeBtn"><span>RESUME GAME</span><span>↗</span></button>` +
      `<button class="outline" id="pauseSettings">SETTINGS</button><button class="outline" id="pauseManual">FIELD MANUAL</button>` +
      `<button class="outline" id="checkpointBtn">RETURN TO CHECKPOINT</button><button class="outline" id="mainMenuBtn">MAIN MENU</button>` +
      `<p class="fine">Checkpoint: ${checkpointName}<br>${input.source === 'keyboard' ? '[F5] Quick save · [F8] Quick load · ' : ''}${T.key} ${player.key ? 'found' : 'missing'} · ${T.swName} ${player.reactor ? 'on' : 'off'}</p>`,
    { kind: 'pause', back: resumeGame }
  );
  $('resumeBtn').onclick = resumeGame;
  $('pauseSettings').onclick = () => showSettings('pause');
  $('pauseManual').onclick = () => showManual('pause');
  $('checkpointBtn').onclick = () => restoreCheckpoint();
  $('mainMenuBtn').onclick = mainMenu;
}
function resumeGame() {
  if (!player) return;
  enterPlay();
}
function mainMenu() {
  state = 'menu';
  mapOpen = false;
  releaseInput();
  closeModal();
  $('mapwrap').style.display = 'none';
  $('hud').style.display = 'none';
  $('menu').style.display = 'flex';
  setStyle($('damage'), 'opacity', '0');
  showContinue();
  updateTitle();
}
function readSave() {
  try {
    const s = JSON.parse(localStorage.getItem('earthquake-save') || 'null');
    return s && s.version === 1 ? s : null;
  } catch (e) {
    return null;
  }
}
function showContinue() {
  const old = $('continueBtn');
  if (old) old.remove();
  const saved = readSave();
  if (!saved) return;
  const b = document.createElement('button');
  b.id = 'continueBtn';
  b.className = 'quiet';
  b.textContent = 'CONTINUE · ' + (LEVELS[saved.level | 0]?.id || 'E1M1') + ' · ' + saved.checkpointName;
  b.onclick = () => {
    checkpoint = saved;
    restoreCheckpoint(saved);
  };
  $('startBtn').after(b);
}
function syncDifficultyButtons() {
  document.querySelectorAll('[data-difficulty]').forEach((e) => e.classList.toggle('active', Number(e.dataset.difficulty) === difficulty));
}
function bestTime(index, diff) {
  try {
    const v = Number(localStorage.getItem(LEVELS[index].bestKey + diff));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch (e) {
    return null;
  }
}
/** The title screen: map choice (once the Smeltery is unlocked), level card and best time. */
function updateTitle() {
  const row = $('mapRow');
  row.hidden = progress.unlocked < 2;
  row.querySelectorAll('[data-map]').forEach((b) => {
    const i = Number(b.dataset.map);
    b.disabled = i >= progress.unlocked;
    b.classList.toggle('active', i === progress.map);
  });
  const def = LEVELS[progress.map];
  $('cardLine').textContent = `${def.id}  /  CAMPAIGN`;
  $('cardTitle').textContent = def.title;
  $('cardInfo').textContent = def.card;
  const best = bestTime(progress.map, difficulty);
  $('cardBest').textContent = best ? `BEST ${timeText(best)} · ${DIFFS[difficulty]}` : '';
  $('cardBars').querySelectorAll('i').forEach((b, i) => b.classList.toggle('on', i <= progress.map));
}
function selectMap(i) {
  if (i >= progress.unlocked || state !== 'menu') return;
  progress.map = i;
  saveProgress();
  if (level.index !== i) {
    loadLevel(i);
    player = freshPlayer();
    resetEntities();
    totalKills = enemies.length;
    portalActive = bossAwake = false;
  }
  sfx('click');
  updateTitle();
}
function die() {
  state = 'dead';
  releaseInput();
  sfx('death');
  rumble(0.8, 400);
  showPanel(
    `<div class="eyebrow">THE BREACH CLAIMS ANOTHER</div><h2>You are not done.</h2><p>${player.kills} enemies killed. ${player.secrets.length} secrets found.<br>Return to ${checkpointName.toLowerCase()} and try again.</p>` +
      `<button class="primary" id="retryBtn"><span>RETURN TO CHECKPOINT</span><span>↗</span></button><button class="outline" id="restartBtn">RESTART LEVEL</button><button class="outline" id="deathMenuBtn">MAIN MENU</button>` +
      `<p class="fine">Keep moving sideways to avoid enemy fire. Use the map to find supplies.</p>`,
    { kind: 'dead' }
  );
  $('retryBtn').onclick = () => restoreCheckpoint();
  $('restartBtn').onclick = () => newGame(level.index);
  $('deathMenuBtn').onclick = mainMenu;
}
function win() {
  if (state === 'won') return;
  state = 'won';
  releaseInput();
  sfx('portal');
  rumble(0.6, 400);
  const def = level.def, T = def.text;
  let best = null;
  try {
    const key = def.bestKey + difficulty;
    best = Number(localStorage.getItem(key)) || Infinity;
    if (player.time < best) {
      best = player.time;
      localStorage.setItem(key, best);
    }
    localStorage.removeItem('earthquake-save');
  } catch (e) {}
  const next = LEVELS[def.index + 1];
  if (next && progress.unlocked < def.index + 2) {
    progress.unlocked = def.index + 2;
    saveProgress();
  }
  const rank = player.kills === totalKills && player.secrets.length === def.secrets ? 'PERFECT CLEAR' : player.kills >= totalKills * 0.8 ? 'BRUTAL CLEAR' : next ? 'BREACH COMPLETE' : 'EPISODE COMPLETE';
  const carry = carryFrom(player);
  showPanel(
    `<div class="eyebrow">${def.id} / ${rank}</div><h2>${T.winTitle}</h2><p>${T.winText}</p>` +
      `<div class="result-grid"><div><small>TIME</small><strong>${timeText(player.time)}</strong></div><div><small>KILLS</small><strong>${player.kills} <span style="font-size:16px;color:#8b987d">/ ${totalKills}</span></strong></div>` +
      `<div><small>SECRETS</small><strong>${player.secrets.length} <span style="font-size:16px;color:#8b987d">/ ${def.secrets}</span></strong></div><div><small>DIFFICULTY</small><strong style="font-size:23px">${DIFFS[difficulty]}</strong></div></div>` +
      (next ? `<button class="primary" id="nextBtn"><span>CONTINUE TO ${next.id}</span><span>↗</span></button><button class="outline" id="againBtn">RUN IT AGAIN</button>` : `<button class="primary" id="againBtn"><span>RUN IT AGAIN</span><span>↗</span></button>`) +
      `<button class="outline" id="winMenuBtn">MAIN MENU</button>` +
      `<p class="fine">${best && best !== Infinity ? 'Best time on this difficulty: ' + timeText(best) + '. ' : ''}${next ? `${next.id}, ${next.title}, is now open. Your weapons and ammo come with you.` : 'Find all secrets and defeat every enemy for a perfect clear.'}</p>`,
    { kind: 'won' }
  );
  if (next) $('nextBtn').onclick = () => newGame(def.index + 1, carry);
  $('againBtn').onclick = () => newGame(def.index);
  $('winMenuBtn').onclick = mainMenu;
}

// ---------------------------------------------------------------------------------------------
// Panels and menus (mouse, keyboard, gamepad and touch)
// ---------------------------------------------------------------------------------------------
let panel = { kind: null, back: null };
function showPanel(html, opts = {}) {
  panel = { kind: opts.kind || null, back: opts.back || null };
  $('panel').innerHTML = html;
  $('modal').style.display = 'flex';
  setTimeout(() => {
    const b = $('panel').querySelector('button.primary') || $('panel').querySelector('button');
    if (b && isModalOpen()) focusItem(b);
  }, 20);
}
function isModalOpen() {
  return $('modal').style.display === 'flex';
}
function closeModal() {
  $('modal').style.display = 'none';
  panel = { kind: null, back: null };
}
function showSettings(origin = state === 'menu' ? 'menu' : 'pause') {
  if (state === 'playing') {
    state = 'paused';
    releaseInput();
  }
  const done = () => {
    storeOptions();
    if (origin === 'menu') closeModal();
    else showPause();
  };
  const range = (id, label, min, max, step, value, out) => `<label class="setting">${label}<input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}Out">${out}</output></label>`;
  const check = (id, label, on) => `<label class="setting">${label}<input id="${id}" type="checkbox" ${on ? 'checked' : ''}><span></span></label>`;
  showPanel(
    `<button class="close" id="backSettings" aria-label="Close settings">×</button><div class="eyebrow">SYSTEM / CONFIGURATION</div><h2>Settings</h2>` +
      range('volInput', 'Sound volume', 0, 100, 1, Math.round(options.volume * 100), Math.round(options.volume * 100)) +
      range('sensInput', 'Look sensitivity', 20, 250, 5, Math.round(options.sensitivity * 100), options.sensitivity.toFixed(1)) +
      range('fovInput', 'Field of view', 75, 115, 1, options.fov, options.fov + '°') +
      range('resInput', 'Render resolution', 40, 100, 5, Math.round(options.scale * 100), Math.round(options.scale * 100) + '%') +
      range('brightInput', 'Brightness', 70, 150, 5, Math.round(options.brightness * 100), Math.round(options.brightness * 100) + '%') +
      check('invertInput', 'Invert look', options.invert) +
      check('shakeInput', 'Screen shake', options.shake) +
      check('retroInput', 'Retro grain', options.retro) +
      `<button class="outline" id="kitSettings">GRAPHICS · CONTROLLER · TOUCH ↗</button>` +
      `<button class="primary" id="saveSettings"><span>RETURN</span><span>↗</span></button>` +
      `<p class="fine">Settings are saved on this device when local storage is available.<br>Lower the render resolution for a higher frame rate. Quality, controller and touch layout live in the graphics panel (F9).</p>`,
    { kind: 'settings', back: done }
  );
  $('backSettings').onclick = done;
  $('saveSettings').onclick = done;
  $('kitSettings').onclick = () => kit.menu.open();
  for (const [id, key, scale, suffix] of [['volInput', 'volume', 100, ''], ['sensInput', 'sensitivity', 100, ''], ['fovInput', 'fov', 1, '°'], ['resInput', 'scale', 100, '%'], ['brightInput', 'brightness', 100, '%']]) {
    $(id).oninput = (e) => {
      options[key] = Number(e.target.value) / scale;
      $(id + 'Out').textContent = (key === 'sensitivity' ? options[key].toFixed(1) : e.target.value) + suffix;
      if (key === 'volume') audio.setVolume();
      if (key === 'scale') {
        renderLines = linesFor(kit.size.width, kit.size.height);
        kit.setPixelHeight(renderLines);
      }
      if (key === 'brightness') U.bright.value = options.brightness;
      storeOptions();
    };
  }
  for (const [id, key] of [['invertInput', 'invert'], ['shakeInput', 'shake'], ['retroInput', 'retro']]) {
    $(id).onchange = (e) => {
      options[key] = e.target.checked;
      if (key === 'retro') U.retro.value = options.retro ? 1 : 0;
      storeOptions();
    };
  }
}
function controlsFor(src) {
  if (src === 'gamepad') return [['Move', 'LEFT STICK · D-PAD'], ['Aim', 'RIGHT STICK'], ['Fire', 'RT or X'], ['Jump / hop', 'A (HOLD)'], ['Use', 'Y'], ['Weapons', 'LB / RB'], ['Walk', 'L-STICK CLICK'], ['Map', 'BACK'], ['Pause', 'START'], ['Menus', 'D-PAD · A · B']];
  if (src === 'touch') return [['Move', 'LEFT THUMB'], ['Aim', 'DRAG RIGHT SIDE'], ['Fire', 'HOLD FIRE'], ['Jump / hop', 'HOLD JUMP'], ['Use', 'USE (WHEN SHOWN)'], ['Weapons', 'GUN'], ['Map', 'MAP'], ['Pause', 'II']];
  return [['Move', 'W A S D'], ['Aim', 'MOUSE · ARROWS'], ['Fire', 'LEFT CLICK · J'], ['Jump / hop', 'SPACE'], ['Use', 'E'], ['Weapons', '1 2 3 · WHEEL'], ['Axe', 'V'], ['Walk', 'SHIFT'], ['Map', 'M'], ['Pause', 'ESC · P'], ['Quick save / load', 'F5 / F8'], ['Full screen', 'F']];
}
function showManual(origin = state === 'menu' ? 'menu' : 'pause') {
  if (state === 'playing') {
    state = 'paused';
    releaseInput();
  }
  const done = () => (origin === 'menu' ? closeModal() : showPause());
  const def = level.def;
  showPanel(
    `<button class="close" id="closeManual" aria-label="Close field manual">×</button><div class="eyebrow">FIELD MANUAL / ${def.id}</div><h2>Keep moving.</h2>` +
      `<div class="controls">${controlsFor(input.source).map(([n, k]) => `<div class="control"><span>${n}</span><kbd>${k}</kbd></div>`).join('')}</div>` +
      `<p>${def.text.manual}</p>` +
      `<p>There is no reload. Pick up ammo as you move. Hold jump to hop again when you land. Strafe in the air to gain speed. Rockets can hurt you, but their blast can also lift you.</p>` +
      `<p>Inspect or shoot unusual runes. Two secret rooms on every map hold extra supplies. The map pauses the game while you view it.</p>` +
      `<p class="fine">Mouse capture needs a click. When capture is not available, hold a mouse button and drag to look. Arrow keys also aim. Play with keyboard and mouse, a controller, or touch; graphics, controller and touch options are in the graphics panel (F9).<br><br>An original tribute to 1990s shooters. All level geometry, models, textures, and sound are generated by this game. No Quake assets or source code are included. No external services are used.</p>` +
      `<button class="primary" id="manualReturn"><span>RETURN</span><span>↗</span></button>`,
    { kind: 'manual', back: done }
  );
  $('closeManual').onclick = done;
  $('manualReturn').onclick = done;
}
function toggleMap() {
  if (state !== 'playing') return;
  mapOpen = !mapOpen;
  resetControls();
  if (mapOpen) {
    releaseInput();
    drawMap();
    $('mapwrap').style.display = 'flex';
  } else {
    $('mapwrap').style.display = 'none';
    captureMouse();
  }
}
function toggleFull() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  } catch (e) {}
}
const mapCtx = $('mapcanvas').getContext('2d');
function drawMap() {
  const ctx = mapCtx, cw = 420, ch = 500, scale = 10, ox = (cw - NX * scale) / 2, oz = 12, def = level.def;
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0e1c15';
  ctx.fillRect(0, 0, cw, ch);
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const c = level.grid[j][i];
      if (!c) continue;
      if (c.secret !== undefined && !player.secrets.includes(c.secret)) continue;
      ctx.fillStyle = HAZARDS[c.kind]?.map || (c.kind === 'bridge' ? '#b4a471' : c.h > 1 ? '#6c7554' : '#414e39');
      ctx.fillRect(ox + i * scale, oz + j * scale, scale - 0.8, scale - 0.8);
    }
  }
  const dot = (x, z, text, col) => {
    const c = level.cellAt(x, z);
    ctx.fillStyle = col;
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, ox + (c.i + 0.5) * scale, oz + (c.j + 0.5) * scale);
  };
  if (!player.key && keyItem) dot(wx(keyItem[1]), wz(keyItem[2]), '◆', '#eac875');
  if (!player.reactor) dot(def.switchPos[0], def.switchPos[2], '◇', '#c5d3ba');
  dot(def.portal.x, def.portal.z, '○', '#75cec0');
  const gate = gateDoor();
  if (gate && gate.open < 0.9) {
    const c = level.cellAt(gate.x, gate.z);
    ctx.fillStyle = '#b37346';
    ctx.fillRect(ox + (c.i - 1) * scale, oz + c.j * scale, scale * 3, 4);
  }
  const px = ox + (player.x / C + 17.5) * scale, pz = oz + (player.z / C + 30.5) * scale;
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-player.yaw);
  ctx.fillStyle = '#efe4c2';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(-5, 5);
  ctx.lineTo(0, 2);
  ctx.lineTo(5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#b4b391';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const [text, i, j] of def.labels) ctx.fillText(text, ox + i * scale, oz + j * scale);
  ctx.fillText('N', cw / 2, 8);
  $('mapTitle').textContent = def.name;
  $('mapstats').textContent = `KILLS ${pad2(player.kills)} / ${totalKills}   SECRETS ${player.secrets.length} / ${def.secrets}   TIME ${timeText(player.time)}\n${objective()}`;
  $('mapHint').textContent = input.source === 'gamepad' ? '[BACK] CLOSE MAP' : input.source === 'touch' ? 'TAP TO CLOSE' : '[M] CLOSE MAP';
}

// ---------------------------------------------------------------------------------------------
// HUD (DOM writes only when a value changes)
// ---------------------------------------------------------------------------------------------
function setText(el, v) {
  v = String(v);
  if (el._t !== v) {
    el._t = v;
    el.textContent = v;
  }
}
function setHTML(el, v) {
  if (el._h !== v) {
    el._h = v;
    el.innerHTML = v;
  }
}
function setStyle(el, prop, v) {
  const k = '_s' + prop;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
}
function setClass(el, cls, on) {
  on = !!on;
  const k = '_c' + cls;
  if (el[k] !== on) {
    el[k] = on;
    el.classList.toggle(cls, on);
  }
}
const hud = {
  health: $('healthVal'), armor: $('armorVal'), ammo: $('ammoVal'), ammoLabel: $('ammoLabel'), runStats: $('runStats'), timer: $('timer'),
  objective: $('objectiveText'), area: $('areaName'), mapId: $('mapId'), keyStatus: $('keyStatus'), buff: $('buffStatus'),
  slots: [0, 1, 2, 3].map((i) => $('slot' + i)), bossbar: $('bossbar'), bossname: $('bossname'), bossfill: $('bossfill'), prompt: $('prompt'),
  toast: $('toast'), leveltitle: $('leveltitle'), hitmarker: $('hitmarker'), damage: $('damage'), pickupflash: $('pickupflash'), grain: $('grain'), hint: $('hudHint'),
};
const faceCtx = $('face').getContext('2d');
let faceKey = '', touchUse = null;
function toast(text, duration = 2.8) {
  hud.toast.textContent = text;
  hud.toast._t = text;
  toastUntil = visualTime + duration;
  setStyle(hud.toast, 'opacity', '1');
}
function objective() {
  const T = level.def.text;
  if (portalActive) return T.exitHint;
  if (gateDoor()?.target) return T.bossHint;
  if (!player.key) return T.keyHint;
  if (!player.reactor) return T.swHint;
  return T.gateHint;
}
function glyph(action) {
  const src = input.source;
  const table = src === 'gamepad' ? { use: 'Y', map: 'BACK', pause: 'START' } : src === 'touch' ? { use: 'USE', map: 'MAP', pause: 'II' } : { use: 'E', map: 'M', pause: 'ESC' };
  return `[ ${table[action]} ]`;
}
function startHint() {
  if (input.source === 'gamepad') return 'LEFT STICK to move · RIGHT STICK to aim · A to jump · RT to fire';
  if (input.source === 'touch') return 'LEFT THUMB to move · DRAG to aim · hold FIRE and JUMP';
  return 'WASD to move · MOUSE to aim · SPACE to jump';
}
function updateHUD() {
  if (!player) return;
  const T = level.def.text;
  setText(hud.health, Math.max(0, Math.ceil(player.health)));
  setClass(hud.health, 'low', player.health < 30);
  setText(hud.armor, Math.floor(player.armor));
  setText(hud.ammo, player.weapon === 3 ? '∞' : player.ammo[player.weapon]);
  setText(hud.ammoLabel, WEAPONS[player.weapon].ammo);
  setText(hud.runStats, `KILLS ${pad2(player.kills)} / ${totalKills}   SECRETS ${player.secrets.length} / ${level.def.secrets}`);
  setText(hud.timer, timeText(player.time));
  setText(hud.objective, objective());
  setText(hud.mapId, level.def.id);
  setText(hud.area, level.cellOf(player.x, player.z)?.area || level.def.name);
  setHTML(hud.keyStatus, `${T.key} <span class="hud-key">${player.key ? '◆' : '—'}</span>` + (player.reactor ? ` &nbsp; ${T.power} <span class="hud-key">◆</span>` : ''));
  setText(hud.buff, player.quad > 0 ? '4× DAMAGE · ' + Math.ceil(player.quad) + 's' : '');
  for (let i = 0; i < 4; i++) {
    setClass(hud.slots[i], 'active', i === player.weapon);
    setClass(hud.slots[i], 'owned', player.owned[i]);
  }
  const b = bossEnemy();
  setStyle(hud.bossbar, 'display', bossAwake && b && !b.dead ? 'block' : 'none');
  if (b) {
    setText(hud.bossname, T.boss);
    setStyle(hud.bossfill, 'width', Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1) + '%');
  }
  const target = state === 'playing' ? interactionTarget() : null;
  let prompt = '';
  if (target) {
    const u = glyph('use');
    prompt = target.type === 'switch' ? `${u} ${T.swPrompt}` : target.obj.id === 'gate' ? (player.key && player.reactor ? `${u} ${T.gatePrompt}` : !player.key ? T.keyRequired : T.powerRequired) : `${u} INSPECT THE RUNE`;
  }
  setStyle(hud.prompt, 'display', target ? 'block' : 'none');
  setText(hud.prompt, prompt);
  if (touchUse !== !!target) {
    touchUse = !!target;
    kit.touch?.setShown('use', touchUse);
  }
  setText(hud.hint, input.source === 'gamepad' ? '[BACK] MAP   [START] PAUSE' : input.source === 'touch' ? '' : '[M] MAP   [ESC] PAUSE');
  drawFace();
}
function drawFace() {
  const low = player.health < 30, hurt = damageFlash > 0.18, key = `${low}|${hurt}`;
  if (key === faceKey) return;
  faceKey = key;
  const c = faceCtx;
  const R = (col, x, y, w, h) => {
    c.fillStyle = col;
    c.fillRect(x, y, w, h);
  };
  c.clearRect(0, 0, 40, 48);
  R('#182218', 0, 0, 40, 48);
  R('#414b31', 4, 7, 32, 35);
  R('#6f7051', 9, 5, 23, 8);
  R('#a0976b', 8, 12, 25, 22);
  R('#a0976b', 12, 33, 17, 9);
  R('#c0aa79', 12, 13, 17, 21);
  R('#7d7652', 8, 15, 4, 18);
  R('#7d7652', 29, 13, 4, 20);
  R('#7d7652', 10, 30, 5, 8);
  R('#7d7652', 26, 30, 5, 8);
  R('#413f2d', 7, 8, 27, 7);
  R('#413f2d', 10, 6, 21, 5);
  R('#737052', 10, 8, 17, 3);
  R('#413d2b', 11, 20, 8, 3);
  R('#413d2b', 23, 20, 8, 3);
  R(hurt ? '#b94323' : '#d9d3a2', 13, 22, 5, 2);
  R(hurt ? '#b94323' : '#d9d3a2', 24, 22, 5, 2);
  R('#25271e', 15, 22, 2, 2);
  R('#25271e', 25, 22, 2, 2);
  R('#8c7e53', 19, 22, 4, 9);
  R('#d1b982', 20, 23, 2, 7);
  R('#5f5036', 15, 34, 12, 3);
  R('#c5b17b', 17, 34, 9, 1);
  R('#645b3e', 14, 39, 14, 3);
  R('#874a2e', 28, 16, 2, 8);
  R('#874a2e', 26, 25, 2, 5);
  if (low || hurt) {
    R('#802d1a', 10, 26, 3, 10);
    R('#802d1a', 11, 34, 7, 3);
    R('#802d1a', 27, 17, 4, 5);
    R('#ae4325', 12, 28, 2, 7);
  }
  R('#293321', 4, 42, 32, 6);
  R('#293321', 0, 46, 40, 2);
}

// ---------------------------------------------------------------------------------------------
// Input: kit actions each frame, pointer lock for mouse look, menu navigation
// ---------------------------------------------------------------------------------------------
const LOOK_SCALE = 0.0022 / 0.0024; // the original's mouse rate over the kit's
function resetControls() {
  ctl.fwd = ctl.right = ctl.mag = ctl.aimX = ctl.aimY = 0;
  ctl.jump = ctl.fire = ctl.walk = false;
  holdGate = true;
  input.settle();
}
/** Leave play: let go of the mouse and of every held control. */
function releaseInput() {
  resetControls();
  if (document.pointerLockElement) document.exitPointerLock();
}
function captureMouse() {
  if (state !== 'playing' || mapOpen || input.source !== 'keyboard' || document.pointerLockElement === canvas) return;
  const refused = () => {
    if (state === 'playing' && !mapOpen) toast('Click the view to capture the mouse,\nor hold a mouse button and drag to look.', 4);
  };
  try {
    const p = canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (p && p.catch) {
      p.catch(() => {
        try {
          const q = canvas.requestPointerLock?.();
          if (q && q.catch) q.catch(refused);
        } catch (e) {
          refused();
        }
      });
    }
  } catch (e) {
    refused();
  }
}
function aimAssist(dt) {
  // Gentle help for sticks and thumbs; the mouse never gets it.
  if (input.source === 'keyboard') return;
  const eye = eyePos();
  let best = null, bestA = 0.1;
  for (const e of enemies) {
    if (e.dead || !e.los || !e.alert) continue;
    const dx = e.x - eye[0], dy = e.y + e.height * 0.55 - eye[1], dz = e.z - eye[2], d = Math.hypot(dx, dz);
    if (d > 30 || d < 1) continue;
    const dyaw = wrapAngle(Math.atan2(-dx, -dz) - player.yaw), dp = Math.atan2(dy, d) - player.pitch, a = Math.hypot(dyaw, dp);
    if (a < bestA) {
      bestA = a;
      best = e;
      best._dy = dyaw;
      best._dp = dp;
    }
  }
  if (!best) return;
  const k = Math.min(1, dt * 2.5) * (1 - bestA / 0.1);
  player.yaw += best._dy * k;
  player.pitch = clamp(player.pitch + best._dp * k, -1.48, 1.48);
}
function gameInput(dt) {
  if (input.pressed('pause')) {
    pauseGame();
    return;
  }
  if (input.pressed('map')) {
    toggleMap();
    return;
  }
  const mv = input.vector('move'), ak = input.vector('aim');
  ctl.fwd = mv.y;
  ctl.right = mv.x;
  ctl.mag = Math.min(1, Math.hypot(mv.x, mv.y));
  ctl.aimX = ak.x;
  ctl.aimY = ak.y;
  ctl.walk = input.down('walk');
  // After a menu closes, fire and jump wait until they are let go (A or a click must not leak in).
  if (holdGate) {
    if (!input.down('fire') && !input.down('jump')) holdGate = false;
    ctl.fire = ctl.jump = false;
  } else {
    ctl.fire = input.down('fire');
    ctl.jump = input.down('jump');
  }
  const lk = input.look('look'), k = options.sensitivity * LOOK_SCALE;
  player.yaw -= lk.x * k;
  player.pitch = clamp(player.pitch - lk.y * k * (options.invert ? -1 : 1), -1.48, 1.48);
  aimAssist(dt);
  if (input.pressed('use')) use();
  if (input.pressed('w1')) switchWeapon(0);
  if (input.pressed('w2')) switchWeapon(1);
  if (input.pressed('w3')) switchWeapon(2);
  if (input.pressed('axe')) switchWeapon(3);
  if (input.pressed('next')) cycleWeapon(1);
  if (input.pressed('prev')) cycleWeapon(-1);
  // Mouse wheel: one weapon per notch, trackpads accumulate.
  const z = input.source === 'touch' ? 0 : input.zoom();
  if (z) {
    wheelAcc += z;
    wheelIdle = 0;
    if (Math.abs(wheelAcc) >= 0.5) {
      cycleWeapon(wheelAcc < 0 ? 1 : -1);
      wheelAcc = 0;
    }
  } else if ((wheelIdle += dt) > 0.3) wheelAcc = 0;
  if (input.pressed('qsave')) quickSave();
  if (input.pressed('qload') && checkpoint) restoreCheckpoint();
}

const nav = { key: '', t: 0 };
function navItems(root) {
  return [...root.querySelectorAll('button, input')].filter((el) => !el.disabled && el.offsetParent !== null && !el.closest('[hidden]'));
}
function focusItem(el) {
  document.querySelectorAll('.navfocus').forEach((e) => e.classList.remove('navfocus'));
  if (!el) return;
  el.focus({ preventScroll: false });
  if (input.source === 'gamepad') el.classList.add('navfocus');
}
function defaultItem(root) {
  if (root === $('menu')) return $('startBtn');
  return root.querySelector('button.primary') || navItems(root)[0] || null;
}
function moveFocus(root, dir) {
  const items = navItems(root);
  if (!items.length) return;
  const cur = items.indexOf(document.activeElement);
  if (cur < 0) return focusItem(defaultItem(root));
  focusItem(items[(cur + dir + items.length) % items.length]);
  sfx('click', null, 0.4);
}
function sideInput(root, side) {
  const el = document.activeElement;
  if (el && root.contains(el) && el.type === 'range') {
    const step = Number(el.step) || 1;
    el.value = String(clamp(Number(el.value) + step * side, Number(el.min), Number(el.max)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else moveFocus(root, side);
}
function activate(root) {
  const el = document.activeElement;
  if (!el || !root.contains(el)) {
    if (root === $('menu')) $('startBtn').click();
    else focusItem(defaultItem(root));
    return;
  }
  if (el.type === 'range') return;
  el.click();
}
function backOut() {
  if (panel.back) panel.back();
  else if (state === 'menu' && isModalOpen()) closeModal();
}
function menuInput(dt) {
  if (mapOpen) {
    if (input.pressed('map') || input.pressed('pause') || input.pressed('back') || input.pressed('confirm')) toggleMap();
    return;
  }
  if (input.pressed('pause') || input.pressed('back')) {
    backOut();
    return;
  }
  const root = isModalOpen() ? $('panel') : state === 'menu' ? $('menu') : null;
  if (!root) return;
  const mv = input.vector('move'), ak = input.vector('aim');
  const y = mv.y + ak.y, x = mv.x + ak.x;
  const vy = Math.abs(y) > 0.5 ? Math.sign(y) : 0, vx = vy ? 0 : Math.abs(x) > 0.5 ? Math.sign(x) : 0;
  const key = vy ? 'y' + vy : vx ? 'x' + vx : '';
  let fireNav = false;
  if (key !== nav.key) {
    nav.key = key;
    nav.t = 0.38;
    fireNav = !!key;
  } else if (key) {
    nav.t -= dt;
    if (nav.t <= 0) {
      nav.t = 0.12;
      fireNav = true;
    }
  }
  if (fireNav) {
    if (vy) moveFocus(root, -vy);
    else sideInput(root, vx);
  }
  if (input.pressed('confirm')) activate(root);
}

// DOM hooks: title buttons, the map overlay, pointer lock, focus and visibility.
$('startBtn').onclick = () => newGame(progress.map);
$('settingsBtn').onclick = () => showSettings('menu');
$('manualBtn').onclick = () => showManual('menu');
$('audioBtn').onclick = () => {
  audio.init();
  options.muted = !options.muted;
  audio.setVolume();
  storeOptions();
  updateAudioBtn();
};
$('fullscreenBtn').onclick = toggleFull;
document.querySelectorAll('[data-difficulty]').forEach((b) => {
  b.onclick = () => {
    difficulty = Number(b.dataset.difficulty);
    syncDifficultyButtons();
    sfx('click');
    updateTitle();
  };
});
document.querySelectorAll('[data-map]').forEach((b) => (b.onclick = () => selectMap(Number(b.dataset.map))));
$('mapwrap').addEventListener('click', () => {
  if (mapOpen) toggleMap();
});
// The kit leaves keys alone while a form field has focus, so a focused slider or checkbox
// would swallow Escape: close the panel from here instead.
addEventListener('keydown', (e) => {
  if (kit.menu.isOpen || !isModalOpen() || e.repeat) return;
  if (e.target?.tagName === 'INPUT' && (e.code === 'Escape' || e.code === 'Backspace')) {
    e.preventDefault();
    backOut();
  }
});
function updateAudioBtn() {
  $('audioBtn').innerHTML = `<span class="status-dot" style="opacity:${options.muted ? 0.2 : 1}"></span>SOUND ${options.muted ? 'OFF' : 'ON'}`;
}
canvas.addEventListener('pointerdown', (e) => {
  // A click on the view during play takes the mouse (the same click also fires).
  if (e.pointerType === 'mouse' && state === 'playing' && !mapOpen) captureMouse();
});
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && state === 'playing' && !mapOpen) pauseGame();
});
addEventListener('blur', () => {
  if (state === 'playing' && !mapOpen) pauseGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'playing' && !mapOpen) pauseGame();
    audio.suspend();
  } else if (!kit.paused) audio.resume();
});
kit.onPause((p) => (p ? audio.suspend() : !document.hidden && audio.resume()));
// Browsers only start sound after a gesture: any key, click or tap starts or resumes it.
const unlockAudio = () => {
  if (audio.started) audio.resume();
};
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
input.onSourceChange(() => {
  updateTitleHints();
  updateHUD();
  if (input.source === 'gamepad') {
    const root = isModalOpen() ? $('panel') : state === 'menu' ? $('menu') : null;
    if (root && !root.contains(document.activeElement)) focusItem(defaultItem(root));
  } else document.querySelectorAll('.navfocus').forEach((e) => e.classList.remove('navfocus'));
});
function updateTitleHints() {
  $('keyhint').textContent = input.source === 'gamepad' ? '[ A ] TO START' : input.source === 'touch' ? 'TAP ENTER THE BREACH' : '[ ENTER ] TO START';
}

// ---------------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------------
const eyeV = [0, 2, 0];
const lampPool = [];
let lampCount = 0;
function addLamp(x, y, z, w, r, g, b, eye) {
  let L = lampPool[lampCount];
  if (!L) L = lampPool[lampCount] = { x: 0, y: 0, z: 0, w: 0, r: 0, g: 0, b: 0, d: 0, used: false };
  L.x = x; L.y = y; L.z = z; L.w = w; L.r = r; L.g = g; L.b = b;
  L.d = Math.hypot(x - eye[0], z - eye[2]);
  L.used = false;
  lampCount++;
}
function setupLights(eye) {
  lampCount = 0;
  const t = visualTime;
  for (const p of level.torches) addLamp(p[0], p[1], p[2], 1.5 + (Math.sin(t * 9 + p[0] * 3) + Math.cos(t * 13 + p[2])) * 0.12, 1, 0.53, 0.19, eye);
  const def = level.def;
  if (player?.reactor && state !== 'menu') addLamp(def.switchPos[0], def.switchPos[1] + 2, def.switchPos[2], 2, 0.25, 0.85, 0.64, eye);
  if (portalActive) addLamp(def.portal.x, def.portal.y, def.portal.z + 1, 3.5, 0.25, 0.8, 0.7, eye);
  const flash = player && state !== 'menu' && player.weapon < 3 && player.recoil > 0.7 ? player.recoil * 2.6 : 0;
  LP[0].value.set(eye[0], eye[1] - 0.3, eye[2] - 0.7, flash + 0.2);
  if (flash) LC[0].value.set(1, 0.65, 0.25);
  else LC[0].value.set(0.55, 0.64, 0.48);
  for (let k = 1; k < 8; k++) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < lampCount; i++) {
      const L = lampPool[i];
      if (!L.used && L.d < bd) {
        bd = L.d;
        best = i;
      }
    }
    if (best < 0) {
      LP[k].value.set(0, -1000, 0, 0);
      LC[k].value.set(0, 0, 0);
      continue;
    }
    const L = lampPool[best];
    L.used = true;
    LP[k].value.set(L.x, L.y, L.z, L.w);
    LC[k].value.set(L.r, L.g, L.b);
  }
}
const camRight = [0, 0, 0], camUp = [0, 0, 0], camFwd = [0, 0, 0];
let quadCount = 0;
function pushQuad(x, y, z, size, r, g, b, a, eye, tanHalf, H) {
  if (quadCount >= QMAX) return;
  const ex = x - eye[0], ey = y - eye[1], ez = z - eye[2];
  const depth = ex * camFwd[0] + ey * camFwd[1] + ez * camFwd[2];
  if (depth < 0.06) return;
  // The original sized points in pixels: size × lines / distance, clamped to 1..110 px.
  const px = clamp((size * H) / Math.max(1, Math.hypot(ex, ey, ez)), 1, 110);
  const h = (px * depth * tanHalf) / H;
  const rx = camRight[0] * h, ry = camRight[1] * h, rz = camRight[2] * h, ux = camUp[0] * h, uy = camUp[1] * h, uz = camUp[2] * h;
  const P = partPos, o = quadCount * 18;
  // corners: (-,-) (+,-) (+,+) | (-,-) (+,+) (-,+)
  P[o] = x - rx - ux; P[o + 1] = y - ry - uy; P[o + 2] = z - rz - uz;
  P[o + 3] = x + rx - ux; P[o + 4] = y + ry - uy; P[o + 5] = z + rz - uz;
  P[o + 6] = x + rx + ux; P[o + 7] = y + ry + uy; P[o + 8] = z + rz + uz;
  P[o + 9] = x - rx - ux; P[o + 10] = y - ry - uy; P[o + 11] = z - rz - uz;
  P[o + 12] = x + rx + ux; P[o + 13] = y + ry + uy; P[o + 14] = z + rz + uz;
  P[o + 15] = x - rx + ux; P[o + 16] = y - ry + uy; P[o + 17] = z - rz + uz;
  const Cc = partCol, c = quadCount * 24;
  for (let v = 0; v < 6; v++) {
    Cc[c + v * 4] = r;
    Cc[c + v * 4 + 1] = g;
    Cc[c + v * 4 + 2] = b;
    Cc[c + v * 4 + 3] = a;
  }
  quadCount++;
}
function fillParticles(eye) {
  const m = camera.matrixWorld.elements;
  camRight[0] = m[0]; camRight[1] = m[1]; camRight[2] = m[2];
  camUp[0] = m[4]; camUp[1] = m[5]; camUp[2] = m[6];
  camFwd[0] = -m[8]; camFwd[1] = -m[9]; camFwd[2] = -m[10];
  const tanHalf = Math.tan((camera.fov * Math.PI) / 360), H = renderLines, t = visualTime;
  quadCount = 0;
  for (let i = 0; i < pCount; i++) {
    const p = parts[i];
    pushQuad(p.p[0], p.p[1], p.p[2], p.size, p.col[0], p.col[1], p.col[2], p.life / p.max, eye, tanHalf, H);
  }
  // Embers rise from every torch.
  for (const tp of level.torches) {
    if (Math.abs(tp[0] - eye[0]) + Math.abs(tp[2] - eye[2]) > 90) continue;
    for (let j = 0; j < 4; j++) {
      const v = t * (0.43 + j * 0.08) + tp[0] * 0.173 + tp[2] * 0.27 + j * 0.25, phase = v - Math.floor(v);
      pushQuad(tp[0] + Math.sin(t * 3 + j + tp[0]) * 0.11, tp[1] + phase * 1.25, tp[2] + Math.cos(t * 2 + j) * 0.12, 0.16 * (1 - phase) + 0.04, 1, 0.43 + 0.3 * (1 - phase), 0.075, (1 - phase) * 0.9, eye, tanHalf, H);
    }
  }
  partGeo.setDrawRange(0, quadCount * 6);
  partMesh.visible = quadCount > 0;
  if (quadCount) {
    partPosAttr.clearUpdateRanges();
    partPosAttr.addUpdateRange(0, quadCount * 18);
    partPosAttr.needsUpdate = true;
    partColAttr.clearUpdateRanges();
    partColAttr.addUpdateRange(0, quadCount * 24);
    partColAttr.needsUpdate = true;
  }
}
const PROJECTILE_MESH = { rocket: 'rocketshot', nail: 'nail', seeker: 'seeker' };
function render() {
  const eye = eyeV;
  let yaw = 0, pitch = 0;
  if (state === 'menu') {
    const mc = level.def.menuCam, t = visualTime * 0.07;
    eye[0] = mc.x + Math.sin(t) * 1.1;
    eye[1] = mc.y + Math.sin(t * 0.7) * 0.25;
    eye[2] = mc.z + Math.cos(t) * 0.7;
    const dx = mc.tx - eye[0], dy = mc.ty - eye[1], dz = mc.tz - eye[2], l = Math.hypot(dx, dy, dz) || 1;
    yaw = Math.atan2(-dx, -dz);
    pitch = Math.asin(dy / l);
  } else {
    const bob = player.grounded ? Math.sin(player.bob * 2) * Math.min(0.045, Math.hypot(player.vx, player.vz) * 0.005) : 0;
    const shake = options.shake && state === 'playing' ? quake : 0;
    eye[0] = player.x + (Math.random() - 0.5) * shake * 0.12;
    eye[1] = player.y + 1.65 + bob - player.land + (Math.random() - 0.5) * shake * 0.08;
    eye[2] = player.z + (Math.random() - 0.5) * shake * 0.12;
    if (state === 'dead') eye[1] = player.y + 0.52;
    yaw = player.yaw;
    pitch = player.pitch;
  }
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const fov = state === 'menu' ? 78 : (2 * Math.atan(Math.tan((options.fov * Math.PI) / 360) * 0.75) * 180) / Math.PI;
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  skyU.t.value = visualTime;
  skyU.aspect.value = kit.size.width / kit.size.height;
  skyU.yaw.value = yaw;
  skyU.pitch.value = pitch;
  U.time.value = visualTime;
  setupLights(eye);

  // Everything that moves goes into the instanced batches.
  for (const d of doors) put(d.mesh, d.x, d.base + d.open * (d.height + 0.5), d.z, d.rot);
  const sp = level.def.switchPos;
  put('switch', sp[0], sp[1], sp[2]);
  if (player?.reactor && state !== 'menu') put('switchOn', sp[0], sp[1], sp[2]);
  for (const e of enemies) {
    if (Math.hypot(e.x - eye[0], e.z - eye[2]) > 70) continue;
    if (e.dead) {
      const a = Math.min(1, e.deathTime * 3);
      put(e.type, e.x, e.y + 0.12, e.z, e.yaw, (-a * Math.PI) / 2, 0, 1 - a * 0.12);
      continue;
    }
    const hover = e.type === 'hexer';
    const bob = hover ? 0.14 + Math.sin(visualTime * 2.2 + e.anim) * 0.08 : Math.sin(e.anim * 2) * 0.035 + (e.leap || 0) * 2;
    put('shadow', e.x, e.y + 0.025, e.z, 0, 0, 0, e.scale * (hover ? 1.0 : 1.2));
    put(e.type, e.x, e.y + bob, e.z, e.yaw, e.hurt > 0 ? -0.08 : 0);
    if (!hover) {
      for (const side of [-1, 1]) {
        const lx = Math.cos(e.yaw) * side * 0.19 * e.scale, lz = -Math.sin(e.yaw) * side * 0.19 * e.scale;
        put(e.type + 'leg', e.x + lx, e.y + 0.55 * e.scale + bob, e.z + lz, e.yaw, Math.sin(e.anim + side * Math.PI * 0.5) * 0.37);
      }
    }
    if (e.fire > 0) put('flame', e.x + Math.sin(e.yaw) * 0.9, e.y + e.height * 0.58, e.z + Math.cos(e.yaw) * 0.9, 0, Math.PI / 2, 0, 0.5);
  }
  for (const p of pickups) {
    if (!p.active || !batches[p.type] || Math.hypot(p.x - eye[0], p.z - eye[2]) > 58) continue;
    put('shadow', p.x, p.shadowY, p.z, 0, 0, 0, 0.8);
    put(p.type, p.x, p.y + Math.sin(visualTime * 2 + p.phase) * 0.09, p.z, visualTime * 0.9 + p.phase);
  }
  for (const t of level.torches) {
    if (Math.hypot(t[0] - eye[0], t[2] - eye[2]) > 85) continue;
    put('flame', t[0], t[1], t[2], visualTime + t[0], 0, 0, 0.87 + Math.sin(visualTime * 13 + t[0]) * 0.13);
  }
  for (const b of projectiles) {
    const l = Math.hypot(b.v[0], b.v[1], b.v[2]) || 1;
    put(PROJECTILE_MESH[b.type] || 'orb', b.p[0], b.p[1], b.p[2], Math.atan2(-b.v[0], -b.v[2]), Math.asin(clamp(b.v[1] / l, -1, 1)));
  }
  flushBatches();
  portalMesh.rotation.z = visualTime * 0.18;
  U.portalA.value = portalActive ? 0.8 : 0.12;
  fillParticles(eye);

  const showWeapon = !!player && state !== 'menu' && state !== 'won' && state !== 'dead';
  if (showWeapon) {
    const w = player.weapon, bob = Math.sin(player.bob) * Math.min(0.027, Math.hypot(player.vx, player.vz) * 0.003), recoil = player.recoil;
    for (let i = 0; i < 4; i++) weaponMeshes[i].visible = i === w;
    weaponRig.position.set(w === 3 ? 0.16 : 0, -0.5 + Math.abs(bob) * 0.5, -0.64 + recoil * 0.105);
    weaponRig.rotation.set(0.055 + recoil * 0.08, w === 3 ? Math.sin(recoil * Math.PI) * 0.42 : 0, w === 3 ? -0.15 - Math.sin(recoil * Math.PI) * 0.7 : bob * 0.3, 'YXZ');
    muzzle.visible = w < 3 && recoil > 0.76;
    if (muzzle.visible) {
      muzzle.rotation.z = visualTime * 31;
      muzzle.scale.setScalar(w === 1 ? 0.6 : 1);
      U.muzzleA.value = (recoil - 0.76) * 4;
    }
  }
  renderer.clear();
  renderer.render(scene, camera);
  if (showWeapon) {
    renderer.clearDepth();
    renderer.render(weaponScene, weaponCam);
  }

  setStyle(hud.damage, 'opacity', state === 'menu' ? '0' : damageFlash.toFixed(2));
  setStyle(hud.pickupflash, 'opacity', state === 'menu' ? '0' : pickupFlash.toFixed(2));
  setStyle(hud.hitmarker, 'opacity', visualTime < hitUntil ? '1' : '0');
  if (visualTime > toastUntil) setStyle(hud.toast, 'opacity', '0');
  if (visualTime > levelTitleUntil) setStyle(hud.leveltitle, 'opacity', '0');
  setStyle(hud.grain, 'display', options.retro ? 'block' : 'none');
}

// ---------------------------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------------------------
loadLevel(progress.map);
player = freshPlayer();
resetEntities();
totalKills = enemies.length;
syncDifficultyButtons();
updateHUD();
showContinue();
updateTitle();
updateTitleHints();
updateAudioBtn();
kit.loading.progress(0.85, 'Compiling shaders…');
await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(weaponScene, weaponCam)]).catch((e) => console.warn(e));
for (const b of batchList) b.mesh.count = 0;

let touchShown = null;
kit.start((dt) => {
  visualTime += dt;
  if (input.pressed('full')) toggleFull();
  if (state === 'playing' && !mapOpen) gameInput(dt);
  else menuInput(dt);
  const playing = state === 'playing' && !mapOpen;
  if (playing !== touchShown) {
    touchShown = playing;
    kit.touch?.suspend(!playing, 'game');
    $('hud').style.display = state === 'menu' ? 'none' : 'block';
  }
  if (playing) {
    accumulator += dt;
    let count = 0;
    // Fixed 120 Hz simulation keeps movement and collision independent of render rate.
    while (accumulator >= 1 / 120 && count++ < 12) {
      update(1 / 120);
      accumulator -= 1 / 120;
    }
  } else accumulator = 0;
  render();
});

// A small inspection API for local testing. It does not run network calls.
window.Earthquake = {
  start: (i) => newGame(i ?? progress.map),
  get state() { return state; },
  get player() { return player; },
  get enemies() { return enemies; },
  get pickups() { return pickups; },
  get doors() { return doors; },
  get level() { return level.def.id; },
  get fps() { return window.__kit?.fps || 0; },
  get checkpoint() { return checkpoint; },
  get renderInfo() { return { lines: renderLines, particles: pCount, calls: renderer.info.render.calls }; },
  get objective() { return objective(); },
  teleport(x, z, y) {
    player.x = x;
    player.z = z;
    player.y = y === undefined ? level.floorAt(x, z) : y;
    player.vx = player.vz = player.vy = 0;
    player.grounded = true;
    flowTimer = 0;
    updateHUD();
  },
  use, fire,
  step(seconds) {
    for (let i = 0; i < Math.round(seconds * 120); i++) update(1 / 120);
  },
  save: saveCheckpoint, load: restoreCheckpoint, damage: damageEnemy, worldRay: rayWorld, canMove,
  floorAt: (x, z) => level.floorAt(x, z), cellAt: (x, z) => level.cellAt(x, z), settings: options, pause: pauseGame, resume: resumeGame,
};
