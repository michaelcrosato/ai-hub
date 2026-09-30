/* MSG — The Long Aftertaste.
   Original code, art, level, dialogue and synthesized audio. An independent stealth tribute.
   Runs on the wall's shared 3D stack: three.js r186 (WebGPU with a WebGL2 fallback) started by
   kit/boot.js. All play input arrives as kit.input actions (keyboard and mouse, gamepad, touch). */

import * as THREE from 'three/webgpu';
import * as T from 'three/tsl';
import { boot } from 'kit/boot.js';
import { createPoints } from 'kit/points.js';
import { vertexSnap, dither15 } from 'kit/retro.js';
import HISTORY from './history.js';

// ------------------------------------------------------------------ helpers
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
let seed = 42177;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function rr(a, b) { return a + rnd() * (b - a); }
const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));

const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: keep playing */ } },
  remove(key) { try { localStorage.removeItem(key); } catch { /* storage blocked */ } },
};

// ------------------------------------------------------------------ options, difficulty, dog tags
const OPT_KEY = 'msg-options-restored-v1', FIELD_KEY = 'msg-field-v1', CHECK_KEY = 'msg-checkpoint-v2', BEST_KEY = 'msg-best-v2', TAG_KEY = 'msg-dogtags-v1', ARCHIVE_KEY = 'msg-aftertaste-archive-v1';
const opts = { volume: .72, music: true, crt: false, cones: false, shake: true, shadows: true, musicVolume: .72, voiceVolume: 1, voice: 'ask', autoRadio: false, zoom: 0, display: 'modern' };
{
  const o = store.get(OPT_KEY);
  if (o && typeof o === 'object') for (const k in opts) if (typeof o[k] === typeof opts[k]) opts[k] = o[k];
  opts.volume = clamp(opts.volume, 0, 1); opts.musicVolume = clamp(opts.musicVolume, 0, 1); opts.voiceVolume = clamp(opts.voiceVolume, 0, 1);
  opts.zoom = opts.zoom ? 1 : 0;
  // The downloadable AI voices are gone (they needed a CDN and a model host); device voices and text remain.
  if (!['ask', 'system', 'text'].includes(opts.voice)) opts.voice = 'ask';
  if (!['modern', 'clean', 'ps1'].includes(opts.display)) opts.display = 'modern';
}
function storeOpts() { store.set(OPT_KEY, opts); }
// The old build cached a 600 KB copy of three.js in localStorage. Give that space back.
store.remove('msg-engine-r160');

const DIFFICULTY = {
  easy: { label: 'EASY', sight: .85, notice: .7, damage: .65, shotDelay: .45, sleep: 1.35, kits: 3, score: .8, cameras: false, note: 'Guards notice you more slowly and hit less hard. You carry three medical kits.' },
  normal: { label: 'NORMAL', sight: 1, notice: 1, damage: 1, shotDelay: 0, sleep: 1, kits: 2, score: 1, cameras: false, note: 'The operation as it was planned. Two medical kits.' },
  hard: { label: 'HARD', sight: 1.12, notice: 1.3, damage: 1.35, shotDelay: -.2, sleep: .75, kits: 1, score: 1.3, cameras: true, note: 'Sharper eyes, shorter sleep and one medical kit. Two extra cameras watch the office door and the relay gate. Score × 1.3.' },
};
const DIFF_ORDER = ['easy', 'normal', 'hard'];
const field = { difficulty: 'normal', bandana: false };
{
  const f = store.get(FIELD_KEY);
  if (f && DIFFICULTY[f.difficulty]) field.difficulty = f.difficulty;
  if (f && typeof f.bandana === 'boolean') field.bandana = f.bandana;
}
function storeField() { store.set(FIELD_KEY, field); }
let runKey = 'normal', runBandana = false;
const run = () => DIFFICULTY[runKey];

// Every guard carries a dog tag. The collection is kept between operations.
const TAGS = [
  { name: 'PFC. ODA KLEIN', post: 'SOUTH CONTAINER ROW', note: 'Keeps a jar of pickled plums in his locker.' },
  { name: 'PVT. MIRO SANTOS', post: 'EAST CONTAINER ROW', note: 'Trades cigarettes for instant ramen.' },
  { name: 'CPL. ILSE BRANDT', post: 'WEST OFFICE', note: 'Writes the canteen menu. Nobody reads it.' },
  { name: 'PVT. TOMAS REYES', post: 'CENTRAL LANE', note: 'Blames the soup for every headache.' },
  { name: 'SGT. NADIA ORLOV', post: 'RELAY WEST', note: 'Guards the server room and the good kettle.' },
  { name: 'PFC. JONAH PIKE', post: 'RELAY EAST', note: 'Has eaten the same sandwich for nine nights.' },
];
const tagsOwned = new Set((() => { const t = store.get(TAG_KEY); return Array.isArray(t) ? t.filter((i) => Number.isInteger(i) && i >= 0 && i < TAGS.length) : []; })());
const bandanaUnlocked = () => tagsOwned.size >= TAGS.length;

// ------------------------------------------------------------------ boot and input
const KIT_ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  aimDir: { type: 'vector', gamepad: 'rightStick' },
  use: { keys: ['KeyE'], gamepad: ['A'], touch: 'USE' },
  fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'FIRE' },
  aim: { keys: ['Space'], mouse: [2], gamepad: ['LT'], touch: 'AIM' },
  crouch: { keys: ['KeyC'], gamepad: ['B'], touch: 'CROUCH' },
  box: { keys: ['KeyB'], gamepad: ['Y'], touch: 'BOX' },
  walk: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  reload: { keys: ['KeyR'], gamepad: ['X'], touch: { label: 'LOAD', slot: 'top' } },
  knock: { keys: ['KeyF'], gamepad: ['RB'], touch: { label: 'KNOCK', slot: 'top' } },
  heal: { keys: ['KeyH'], gamepad: ['LB'], touch: { label: 'HEAL', slot: 'top' } },
  radio: { keys: ['Tab'], gamepad: ['Back'], touch: { label: 'RADIO', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  map: { keys: ['KeyM'], gamepad: ['RS'] },
  view: { keys: ['KeyV'] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  pagePrev: { keys: ['PageUp'], gamepad: ['LB'] },
  pageNext: { keys: ['PageDown'], gamepad: ['RB'] },
};

const kit = await boot({
  title: 'MSG — The Long Aftertaste',
  canvas: $('view'),
  gear: 'none',
  holdLoading: true,
  accent: '#b4cf91',
  background: '#070c0f',
  touch: { top: 'center', topOffset: 12 },
  // CLEAN and PS1 were designed without anti-aliasing; the choice applies from the next start.
  renderer: opts.display === 'modern' ? undefined : { antialias: false },
  input: KIT_ACTIONS,
});
const input = kit.input;
let screenW = kit.size.width, screenH = kit.size.height;
kit.onResize((w, h) => { screenW = w; screenH = h; placeTouchTop(); });
const TEX = kit.tier.detail >= 1 ? 512 : 256;

const PROMPTS = {
  keyboard: { move: 'WASD', walk: 'SHIFT', crouch: 'C', aim: 'SPACE', fire: 'J', use: 'E', box: 'B', heal: 'H', reload: 'R', knock: 'F', radio: 'TAB', map: 'M', pause: 'ESC', view: 'V', confirm: 'ENTER', back: 'ESC' },
  gamepad: { move: 'L-STICK', walk: 'L3', crouch: 'B', aim: 'LT', fire: 'RT', use: 'A', box: 'Y', heal: 'LB', reload: 'X', knock: 'RB', radio: 'BACK', map: 'R3', pause: 'START', view: 'SETTINGS', confirm: 'A', back: 'B' },
  touch: { move: 'STICK', walk: 'HALF STICK', crouch: 'CROUCH', aim: 'AIM', fire: 'FIRE', use: 'USE', box: 'BOX', heal: 'HEAL', reload: 'LOAD', knock: 'KNOCK', radio: 'RADIO', map: 'RADAR', pause: 'II', view: 'PINCH', confirm: 'TAP', back: 'TAP' },
};
const promptOf = (action) => (PROMPTS[input.source] || PROMPTS.keyboard)[action] || action.toUpperCase();
function applyPrompts() {
  for (const el of document.querySelectorAll('[data-key]')) {
    const t = promptOf(el.dataset.key);
    if (el.textContent !== t) el.textContent = t;
  }
}

// ------------------------------------------------------------------ scene graph
// The world is described as a small node tree (boxes, extrusions, decals, signs). The static part is
// merged into a few large meshes; moving parts become three.js groups that follow their nodes.
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } });
let nodeId = 0;
class Node {
  constructor(type = 'group', data = {}) {
    this.id = nodeId++; this.type = type; this.data = data;
    this.position = v3(); this.rotation = v3(); this.scale = v3(1, 1, 1);
    this.children = []; this.visible = true; this.parent = null; this.object = null;
    this.opacity = data.opacity === undefined ? 1 : data.opacity;
  }
  add(n) { if (n.parent) n.parent.remove(n); this.children.push(n); n.parent = this; return n; }
  remove(n) { this.children = this.children.filter((a) => a !== n); n.parent = null; }
}
const root = new Node();
const colliders = [], labels = [], pickups = [], lamps = [], animated = [], snowflakes = [];
const colors = { floor: 0x637677, snow: 0x9baa9f, wall: 0x647d7e, metal: 0x405c61, green: 0x465d51, red: 0x7d5348, wood: 0x888369, white: 0xc0c9ba, yellow: 0xc7b076 };
const textureCache = {};

function meshNode(type, data, x, y, z, parent = root) { const n = new Node(type, data); n.position.set(x, y, z); parent.add(n); return n; }
function box(x, y, z, w, h, d, color = colors.metal, tex = null, parent = root, extra = {}) { return meshNode('box', { w, h, d, color, tex, ...extra }, x, y, z, parent); }
function cylinder(x, y, z, r, h, color, parent = root, segments = 8) { return meshNode('cylinder', { r, h, color, segments }, x, y, z, parent); }
function plane(x, y, z, w, d, color, opacity = 1, parent = root) { return meshNode('plane', { w, d, color, opacity }, x, y, z, parent); }
function group(x = 0, y = 0, z = 0, parent = root) { const n = new Node(); n.position.set(x, y, z); parent.add(n); return n; }
function solid(x, z, w, d, h, color, tex = 'concrete', name = 'cover') { const n = box(x, h / 2, z, w, h, d, color, tex); const c = { x, z, w, d, h, active: true, name, node: n }; colliders.push(c); n.collider = c; return n; }
function textPlate(text, x, y, z, w = 3, h = .5, color = '#d4d7c1', back = '#263f43', rot = 0) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const q = c.getContext('2d');
  q.fillStyle = back; q.fillRect(0, 0, 256, 64); q.fillStyle = color; q.font = 'bold 30px monospace'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 128, 34, 235);
  const n = meshNode('sign', { w, h, color: 0xffffff, canvas: c, canvasKey: text + '|' + color + '|' + back, unlit: true }, x, y, z); n.rotation.y = rot; return n;
}
function floorText(text, x, z, w = 4, d = .8, color = '#c4cbbb') { const n = textPlate(text, x, .024, z, w, d, color, '#00000000'); n.rotation.x = -Math.PI / 2; return n; }
function addLabel(node, text, kind = 'obj', offset = 1) {
  const el = document.createElement('div'); el.className = 'world-label ' + kind; el.textContent = text; $('world-labels').appendChild(el);
  const l = { node, text, el, kind, offset, visible: true, color: '', shown: false, sx: -1e4, sy: -1e4, cText: text, cKind: kind, cColor: '' };
  labels.push(l); return l;
}
function lamp(x, z, height = 6) {
  const g = group(x, 0, z); cylinder(0, height / 2, 0, .10, height, 0x526567, g); box(0, height - .12, 0, 1.05, .22, .7, 0x324b50, null, g);
  box(0, height - .24, 0, .85, .06, .48, 0xd2dcbd, null, g, { unlit: true }); const glow = plane(0, .025, 0, 5, 5, 0xc9ca8a, .06, g);
  lamps.push({ x, z, height, g, glow });
}
function hatch(x, z, w, d) { plane(x, .023, z, w, d, 0xb1a56e, .7); for (let i = -w / 2; i < w / 2; i += .65) plane(x + i, .026, z, .3, d, 0x253d43, 1); }
function createPickup(x, z, type, amount) {
  const g = group(x, .15, z); const c = type === 'ammo' ? 0x819a72 : 0xc3c7aa; box(0, .28, 0, .8, .5, .55, c, 'crate', g);
  if (type === 'med') { box(0, .54, 0, .35, .02, .11, 0x923b34, null, g); box(0, .55, 0, .11, .02, .35, 0x923b34, null, g); } else box(0, .56, 0, .5, .025, .28, 0x394b3d, null, g);
  meshNode('ring', { r: .65, color: 0xb4d093, opacity: .35 }, 0, -.10, 0, g);
  pickups.push({ x, z, type, amount, node: g, taken: false });
}

// ------------------------------------------------------------------ procedural textures (original art)
function makeTexture(kind, color) {
  const key = kind + color; if (textureCache[key]) return textureCache[key];
  const c = document.createElement('canvas'); c.width = c.height = TEX; const q = c.getContext('2d', { willReadFrequently: kind === 'snowmask' });
  // The art is drawn on a 512 grid and scaled to the tier's texture size.
  const k = TEX / 512; q.setTransform(k, 0, 0, k, 0, 0);
  let s = (color ^ kind.length * 49157) >>> 0; const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const hex = '#' + color.toString(16).padStart(6, '0'); q.fillStyle = hex; q.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 19000; i++) { q.fillStyle = r() > .5 ? 'rgba(255,255,245,.045)' : 'rgba(5,15,18,.055)'; const n = r() * 3 + .5; q.fillRect(r() * 512, r() * 512, n, n); }
  if (kind === 'metal') {
    for (let x = 0; x < 512; x += 32) { const g = q.createLinearGradient(x, 0, x + 32, 0); g.addColorStop(0, '#0006'); g.addColorStop(.13, '#0005'); g.addColorStop(.2, '#ffffff20'); g.addColorStop(.38, '#ffffff0b'); g.addColorStop(.82, '#0000'); g.addColorStop(1, '#0006'); q.fillStyle = g; q.fillRect(x, 0, 32, 512); }
    for (let i = 0; i < 200; i++) { q.fillStyle = r() > .3 ? '#482e2026' : '#c0cab626'; q.fillRect(r() * 512, r() * 512, 1 + r() * 5, 2 + r() * 60); }
    for (const y of [7, 497]) { q.fillStyle = '#17283266'; q.fillRect(0, y, 512, 4); for (let x = 8; x < 512; x += 32) { q.fillStyle = '#080f1288'; q.fillRect(x, y - 2, 4, 4); q.fillStyle = '#e0e3cd66'; q.fillRect(x, y - 2, 3, 1); } }
  } else if (kind === 'crate') {
    for (let y = 0; y < 512; y += 64) { q.fillStyle = '#2b292066'; q.fillRect(0, y, 512, 3); q.fillStyle = '#dac7a233'; q.fillRect(0, y + 4, 512, 2); for (let i = 0; i < 95; i++) { q.fillStyle = r() > .5 ? '#1b211221' : '#efe0b61c'; q.fillRect(r() * 512, y + 5 + r() * 54, r() * 100 + 10, 1); } }
    q.strokeStyle = '#3c453766'; q.lineWidth = 12; q.strokeRect(7, 7, 498, 498);
    for (const x of [24, 480]) for (let y = 22; y < 512; y += 64) { q.fillStyle = '#111d20'; q.fillRect(x, y, 4, 4); }
  } else if (kind === 'concrete' || kind === 'wall') {
    for (const y of [0, 256]) for (const x of [0, 256]) { q.fillStyle = `rgba(16,32,34,${r() * .07})`; q.fillRect(x, y, 256, 256); q.fillStyle = '#1c323866'; q.fillRect(x, y, 256, 2); q.fillRect(x, y, 2, 256); q.fillStyle = '#ccd6cb25'; q.fillRect(x + 3, y + 3, 252, 2); }
    for (let i = 0; i < 38; i++) { let x = r() * 512, y = r() * 512; q.strokeStyle = '#1c262538'; q.lineWidth = .5 + r(); q.beginPath(); q.moveTo(x, y); for (let j = 0; j < 5; j++) { x += r() * 16 - 8; y += r() * 8; q.lineTo(x, y); } q.stroke(); }
    for (const x of [11, 243, 267, 499]) for (const y of [11, 243, 267, 499]) { q.fillStyle = '#14222c80'; q.fillRect(x, y, 4, 4); q.fillStyle = '#d8dfd26a'; q.fillRect(x, y, 3, 1); }
  } else if (kind === 'asphalt') {
    for (let i = 0; i < 140; i++) { q.fillStyle = `rgba(180,195,194,${.02 + r() * .08})`; q.beginPath(); q.ellipse(r() * 512, r() * 512, r() * 50 + 3, r() * 24 + 2, r() * 3, 0, TAU); q.fill(); }
    for (let i = 0; i < 12000; i++) { q.fillStyle = r() > .5 ? '#d9e5dc20' : '#101b241c'; q.fillRect(r() * 512, r() * 512, 1, 1); }
    q.strokeStyle = '#101d2555'; q.lineWidth = 1; for (let i = 0; i < 8; i++) { let x = r() * 512, y = r() * 512; q.beginPath(); q.moveTo(x, y); for (let j = 0; j < 8; j++) { x += r() * 38 - 19; y += r() * 22; q.lineTo(x, y); } q.stroke(); }
    q.strokeStyle = '#1b2c3520'; q.lineWidth = 12; for (let i = 0; i < 2; i++) { q.beginPath(); q.moveTo(130 + i * 130, -10); q.bezierCurveTo(180 + i * 130, 120, 30 + i * 140, 330, 150 + i * 130, 520); q.stroke(); }
  } else if (kind === 'snow') {
    for (let i = 0; i < 1900; i++) { q.fillStyle = r() > .25 ? '#ffffff13' : '#243f4d16'; q.beginPath(); q.ellipse(r() * 512, r() * 512, r() * 18 + 1, r() * 6 + 1, 0, 0, TAU); q.fill(); }
  } else if (kind === 'grate') {
    q.fillStyle = '#101e26'; for (let x = 0; x < 512; x += 16) for (let y = 0; y < 512; y += 16) { q.fillRect(x + 3, y + 3, 10, 10); q.fillStyle = '#9aa7a34a'; q.fillRect(x + 2, y + 2, 11, 2); q.fillStyle = '#101e26'; }
  } else if (kind === 'fabric') {
    for (let i = 0; i < 512; i += 4) { q.fillStyle = '#ced7d90b'; q.fillRect(i, 0, 1, 512); q.fillStyle = '#07131b10'; q.fillRect(0, i, 512, 1); }
    for (let i = 0; i < 38; i++) { q.fillStyle = '#17283318'; q.beginPath(); q.ellipse(r() * 512, r() * 512, 10 + r() * 20, 2 + r() * 12, r() * 4, 0, TAU); q.fill(); }
  } else if (kind === 'net') {
    q.clearRect(0, 0, 512, 512); q.lineWidth = 2; q.strokeStyle = '#8b9b9bbb'; for (let x = -512; x < 1024; x += 32) { q.beginPath(); q.moveTo(x, 0); q.lineTo(x + 512, 512); q.stroke(); q.beginPath(); q.moveTo(x, 0); q.lineTo(x - 512, 512); q.stroke(); }
  } else if (kind === 'glow') {
    q.clearRect(0, 0, 512, 512); const g = q.createRadialGradient(256, 256, 0, 256, 256, 252); g.addColorStop(0, 'rgba(217,214,169,.32)'); g.addColorStop(.45, 'rgba(209,214,177,.12)'); g.addColorStop(1, 'rgba(209,214,177,0)'); q.fillStyle = g; q.fillRect(0, 0, 512, 512);
  } else if (kind === 'snowmask') {
    q.clearRect(0, 0, 512, 512); for (let i = 0; i < 100; i++) { const x = 80 + r() * 350, y = 80 + r() * 350, rad = 10 + r() * 100; const g = q.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, '#bacbcbbc'); g.addColorStop(.7, '#acbfc178'); g.addColorStop(1, '#94aab400'); q.fillStyle = g; q.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  } else if (kind === 'puddle') {
    q.clearRect(0, 0, 512, 512); const g = q.createRadialGradient(250, 250, 40, 256, 256, 244); g.addColorStop(0, '#9cafb66b'); g.addColorStop(.65, '#849aa64c'); g.addColorStop(1, '#55727c00'); q.fillStyle = g; q.fillRect(0, 0, 512, 512);
  }
  if (kind === 'snowmask') { const pixels = q.getImageData(0, 0, TEX, TEX); for (let i = 0; i < pixels.data.length; i += 4) { const grain = .5 + r() * .5; pixels.data[i + 3] = Math.pow(pixels.data[i + 3] / 255, 1.7) * 170 * grain; } q.putImageData(pixels, 0, 0); }
  textureCache[key] = c; return c;
}

// ------------------------------------------------------------------ modelling helpers
function form(x, y, z, rings, color, parent = root, segments = 10, tex = null) {
  const vs = [], fs = [];
  for (let j = 0; j < rings.length; j++) { const [yy, rx, rz, zz = 0] = rings[j]; for (let i = 0; i < segments; i++) { const a = i * TAU / segments; vs.push([Math.sin(a) * rx, yy, Math.cos(a) * rz + zz]); } }
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < segments; i++) { const a = j * segments + i, b = j * segments + (i + 1) % segments; fs.push([a, b, b + segments, a + segments]); }
  fs.push(Array.from({ length: segments }, (_, i) => segments - 1 - i)); fs.push(Array.from({ length: segments }, (_, i) => (rings.length - 1) * segments + i));
  return meshNode('custom', { vs, fs, color, tex }, x, y, z, parent);
}
function ellipsoid(x, y, z, rx, ry, rz, color, parent = root, segments = 12, bands = 7) { const rings = []; for (let j = 0; j <= bands; j++) { const a = j * Math.PI / bands; rings.push([-Math.cos(a) * ry, Math.max(.002, Math.sin(a) * rx), Math.max(.002, Math.sin(a) * rz)]); } return form(x, y, z, rings, color, parent, segments); }
function beam(a, b, width, color, parent = root, depth = width) { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz); const n = box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, width, l, depth, color, null, parent); n.rotation.x = Math.atan2(dz, Math.hypot(dx, dy)); n.rotation.z = -Math.atan2(dx, dy); return n; }
function crate(x, z, w = 2, d = 2, h = 1.8) {
  const n = solid(x, z, w, d, h, 0x827b65, 'crate'); box(x, .08, z, w + .08, .16, d + .08, 0x46504a, 'crate');
  for (const xx of [-1, 1]) for (const zz of [-1, 1]) box(x + xx * (w / 2 - .07), h / 2, z + zz * (d / 2 - .04), .14, h + .08, .12, 0x5e6258, 'metal');
  for (const xx of [-.28, .28]) { box(x + xx * w, h + .015, z, .11, .03, d + .04, 0x3d4d4f); box(x + xx * w, h / 2, z + d / 2 + .025, .11, h, .05, 0x3d4d4f); }
  textPlate('FSL / SUPPLY', x, h * .6, z + d / 2 + .055, w * .52, .28, '#292f2e', '#b4b6a0');
  const snow = plane(x, h + .03, z, w, d, 0xc0cbc8, .65); snow.data.tex = 'snowmask'; return n;
}
function containerCargo(x, z, w, d, color, code) {
  const h = 3.4, n = solid(x, z, w, d, h, color, 'metal', 'container');
  // Corner castings, roof rails, seams, hinges and locking bars are separate geometry.
  for (const xx of [-1, 1]) for (const zz of [-1, 1]) { box(x + xx * (w / 2 - .045), h / 2, z + zz * (d / 2 - .06), .13, h, .14, 0x3d5055); for (const yy of [.11, h - .12]) { box(x + xx * (w / 2 - .04), yy, z + zz * (d / 2 - .04), .23, .2, .22, 0x758683); box(x + xx * (w / 2 + .085), yy, z + zz * (d / 2 - .04), .005, .07, .10, 0x1e3039); } }
  for (const xx of [-1, 1]) { box(x + xx * w / 2, .08, z, .08, .16, d, 0x35464d); box(x + xx * w / 2, h - .06, z, .08, .12, d, 0x86968f); }
  for (let zz = -d / 2 + .25; zz < d / 2; zz += .42) for (const xx of [-1, 1]) box(x + xx * (w / 2 + .018), h / 2, z + zz, .055, h - .25, .055, color);
  for (const zz of [-1, 1]) { box(x, h - .055, z + zz * (d / 2 + .015), w, .11, .08, 0x81918a); box(x, .09, z + zz * (d / 2 + .015), w, .18, .08, 0x43555a); box(x, h / 2, z + zz * (d / 2 + .023), .035, h - .12, .025, 0x152b34); }
  for (const xx of [-.29, -.19, .19, .29]) { cylinder(x + xx * w, 1.68, z + d / 2 + .077, .028, 2.93, 0xb1b7a4, root, 8); for (const yy of [.5, 1.55, 2.9]) box(x + xx * w, yy, z + d / 2 + .105, .13, .08, .08, 0x53636b); box(x + xx * w + .07, 1.45, z + d / 2 + .12, .19, .045, .035, 0xa8b3a8); }
  textPlate(code, x, 2.53, z + d / 2 + .12, w * .73, .35, '#dddac7', '#3b4b50'); textPlate('MAX GROSS  30 480 KG', x, 2.08, z + d / 2 + .11, w * .48, .18, '#b7c0b2', '#00000000');
  textPlate('04', x - w / 2 - .055, 2.4, z, .65, .62, '#dbd9c2', '#283d43', -Math.PI / 2);
  box(x, h + .025, z, w, .05, d, 0x798e97, 'metal'); for (let zz = -d / 2 + .18; zz < d / 2; zz += .45) box(x, h + .065, z + zz, w - .12, .052, .07, 0x91a5aa, 'snow');
  const drift = plane(x + .1, h + .098, z, w - .1, d - .1, 0xc8d3ce, .65); drift.data.tex = 'snowmask';
  return n;
}
function makeActor(isPlayer) {
  const rootA = group(), body = group(0, 0, 0, rootA), suit = isPlayer ? 0x566e82 : 0x819189, dark = isPlayer ? 0x293e50 : 0x465750, webbing = isPlayer ? 0x3b4c58 : 0x58645a, skin = isPlayer ? 0xb5a28a : 0xa9aa97;
  rootA.scale.set(.84, 1.08, .92); const shadow = meshNode('disc', { r: .56, color: 0x091b26, opacity: .32 }, 0, .029, 0, rootA);
  form(0, 1.04, 0, [[0, .24, .16], [.18, .3, .19], [.46, .37, .22], [.62, .35, .21], [.7, .2, .16]], suit, body, 12, 'fabric');
  form(0, .89, 0, [[-.11, .27, .16], [.05, .28, .18], [.18, .25, .17]], dark, body, 10, 'fabric');
  form(0, 1.63, 0, [[0, .19, .17], [.15, .18, .15], [.17, .13, .12]], dark, body, 10);
  form(0, 1.34, -.175, [[-.26, .25, .09], [.15, .31, .115], [.24, .28, .095]], webbing, body, 10, 'fabric');
  for (const side of [-1, 1]) {
    beam([side * .23, 1.7, -.21], [side * .21, 1.13, -.275], .065, 0x809298, body, .028);
    for (const y of [1.45, 1.32, 1.19]) box(side * .20, y, -.278, .18, .035, .035, 0x172c37, null, body);
    box(side * .15, 1.18, -.32, .17, .23, .13, webbing, 'fabric', body); box(side * .15, 1.30, -.325, .175, .035, .135, 0x8c9b99, null, body);
    box(side * .25, .99, -.155, .12, .13, .14, 0x324753, null, body);
  }
  box(0, 1.02, -.18, .51, .07, .08, 0x1c303c, null, body); box(.035, 1.03, -.23, .095, .065, .025, 0xa3afa5, null, body);
  form(0, 1.35, .22, [[-.21, .19, .065], [.20, .24, .11], [.3, .16, .05]], dark, body, 8, 'fabric');
  box(-.19, 1.56, .3, .085, .19, .08, 0x263c45, null, body); cylinder(-.19, 1.82, .3, .009, .38, 0x838e82, body, 5);
  // An angular head with a jaw, nose, brows, ears, hair or helmet, and a headset.
  const head = group(0, 1.93, -.005, body);
  form(0, 0, 0, [[-.23, .095, .085, -.025], [-.15, .145, .13, -.025], [.01, .18, .155], [.15, .175, .135], [.23, .11, .075]], skin, head, 12);
  ellipsoid(-.184, .005, .025, .035, .065, .039, skin, head, 7, 4); ellipsoid(.184, .005, .025, .035, .065, .039, skin, head, 7, 4);
  form(0, -.013, -.155, [[-.055, .046, .025], [.005, .036, .055], [.10, .024, .019]], 0xb0a28b, head, 6);
  for (const side of [-1, 1]) { const brow = box(side * .085, .064, -.153, .09, .026, .027, 0x273538, null, head); brow.rotation.z = side * .12; box(side * .085, .023, -.16, .078, .019, .009, 0x26363a, null, head); box(side * .072, .024, -.167, .018, .012, .005, 0xb9c0b6, null, head); }
  box(0, -.13, -.14, .115, .016, .015, 0x655f53, null, head);
  if (isPlayer) {
    form(0, 0, .026, [[.02, .18, .14], [.11, .193, .164], [.24, .162, .11], [.30, .055, .045]], 0x283236, head, 11);
    for (let i = 0; i < 6; i++) { const tuft = ellipsoid((i - 2.5) * .055, .21, -.08, .047, .092, .09, 0x303b3e, head, 5, 3); tuft.rotation.z = -.2 + i * .06; }
    box(.194, .035, .004, .044, .113, .08, 0x20343d, null, head); beam([.21, -.02, -.02], [.14, -.12, -.22], .015, 0x30434b, head); ellipsoid(.10, -.123, -.219, .06, .025, .022, 0x203139, head, 6, 3);
  } else {
    form(0, .04, .015, [[0, .205, .19], [.16, .21, .18], [.24, .15, .13], [.28, .045, .045]], 0x687e7b, head, 12);
    box(0, .076, -.167, .37, .034, .09, 0x526966, null, head); box(0, -.006, -.174, .31, .066, .025, 0x243f49, null, head); box(-.07, .005, -.19, .085, .014, .008, 0x7a9ba2, null, head);
    form(0, -.11, 0, [[-.14, .1, .07], [-.06, .16, .14], [.02, .165, .151]], 0x697d74, head, 10);
  }
  const legs = [], knees = [], arms = [], elbows = [];
  for (const side of [-1, 1]) {
    const leg = group(side * .17, .97, 0, body); form(0, 0, 0, [[-.46, .107, .12], [-.18, .135, .145], [0, .147, .14]], suit, leg, 10, 'fabric');
    const knee = group(0, -.43, 0, leg); form(0, 0, 0, [[-.35, .081, .09], [-.1, .103, .116], [.02, .11, .12]], suit, knee, 10, 'fabric');
    ellipsoid(0, .015, -.117, .109, .108, .05, dark, knee, 8, 4); box(0, .016, -.16, .13, .11, .025, 0x7a8c8d, null, knee);
    form(0, -.35, -.04, [[-.16, .108, .18, -.04], [-.08, .113, .19, -.05], [.045, .089, .103]], 0x253b48, knee, 10); box(0, -.493, -.086, .225, .035, .365, 0x152733, null, knee);
    box(side * .116, -.23, .015, .06, .21, .17, webbing, 'fabric', leg); legs.push(leg); knees.push(knee);
    const arm = group(side * .37, 1.61, 0, body); ellipsoid(0, -.06, 0, .151, .17, .155, suit, arm, 10, 5);
    form(0, 0, 0, [[-.34, .085, .102], [-.13, .127, .126], [.02, .13, .13]], suit, arm, 10, 'fabric');
    ellipsoid(side * .07, -.07, -.02, .068, .10, .13, webbing, arm, 8, 4);
    const elbow = group(0, -.33, 0, arm); form(0, 0, 0, [[-.27, .064, .074], [-.14, .09, .104], [.02, .096, .10]], suit, elbow, 10, 'fabric');
    box(0, -.21, -.075, .142, .09, .045, dark, null, elbow); ellipsoid(0, -.31, -.018, .074, .102, .083, 0x253940, elbow, 9, 5);
    if (side < 0) { box(-.073, -.21, -.01, .03, .074, .07, 0x96a49a, null, elbow); box(-.09, -.21, -.01, .01, .042, .045, 0x263f48, null, elbow); }
    arms.push(arm); elbows.push(elbow);
  }
  // The weapon is rigged to the right hand rather than floating at the hip.
  const hand = elbows[1]; box(.008, -.29, -.11, .062, .13, .13, 0x132733, null, hand); box(.008, -.26, -.22, .073, .085, .27, 0x304a56, null, hand);
  const suppress = cylinder(.008, -.26, -.405, .035, .16, 0x263f49, hand, 10); suppress.rotation.x = Math.PI / 2; box(.008, -.206, -.26, .01, .018, .016, 0xb2b29b, null, hand);
  if (!isPlayer) { box(0, -.29, -.33, .07, .105, .42, 0x21363e, null, hand); const barrel = cylinder(0, -.255, -.65, .024, .25, 0x526363, hand, 8); barrel.rotation.x = Math.PI / 2; box(0, -.37, -.25, .06, .17, .12, 0x172c34, null, hand); }
  const boxBody = box(0, .73, 0, 1.30, 1.46, 1.18, 0x958b70, 'crate', rootA); boxBody.visible = false; boxBody.own = true; box(0, .746, 0, .11, .025, 1.19, 0xc0b394, null, boxBody);
  return { root: rootA, body, head, legs, knees, arms, elbows, boxBody, shadow, walk: 0, isPlayer };
}
function animateActor(a, moving, dt, crouched = false, aim = false, sleep = false) {
  const b = a.visual; b.walk += moving * dt * (crouched ? 4.9 : 3.3);
  if (sleep) { b.body.rotation.z = Math.PI / 2; b.body.position.y = .29; b.boxBody.visible = false; return; }
  b.body.rotation.z = 0; b.body.scale.y = 1; const phase = b.walk, stride = moving ? Math.sin(phase) * Math.min(.63, moving * .16 + .16) : 0;
  b.body.position.y = crouched ? -.53 : Math.abs(Math.sin(phase)) * Math.min(.045, moving * .014); b.body.rotation.x = crouched ? -.28 : aim ? -.035 : moving > 2 ? -.07 : 0;
  for (let i = 0; i < 2; i++) {
    const dir = i ? 1 : -1;
    b.legs[i].rotation.x = crouched ? -.65 + stride * .45 : stride * dir; b.knees[i].rotation.x = crouched ? 1.15 : Math.max(0, -stride * dir) * .9;
    b.arms[i].rotation.x = aim ? -1.1 : (crouched ? -.36 : 0) - stride * dir * .72; b.arms[i].rotation.z = aim ? (i ? -.08 : .23) : dir * -.09;
    b.elbows[i].rotation.x = aim ? -.47 : -.13 - Math.max(0, stride * dir) * .5;
  }
  b.head.rotation.y = aim ? -.02 : Math.sin(worldTime * .8 + (b.isPlayer ? 0 : 1)) * .035; b.head.rotation.x = crouched ? .2 : 0;
}

// ------------------------------------------------------------------ game state
let state = 'title', overlayReturn = 'title', fieldActive = false, ready = false;
let gameTime = 0, worldTime = 0, frame = 0, shake = 0;
const mainCamera = { x: -9, y: 30, z: 39, tx: -9, ty: 0, tz: 15, span: 33 };
let player, guards = [], security = [], door, card, terminal, extraction, boat, checkpoint = null, stats;
let stage = 0, doorOpen = false, terminalProgress = 0, alertMode = 'normal', alertTimer = 0, lastSeen = -99;
const lastKnown = { x: 0, z: 0 };
let areaTimer = 0, zone = '', noisePulse = 0, radioPending = false, radioData = [], radioIndex = 0, radioChar = 0, radioElapsed = 0, noticeTimer = 0, aimTarget = null, stepTimer = 0;
let officePhoto = null, photoUpright = false, zoomAccum = 0;
const tapped = new Set();
const TAP_ACTIONS = ['use', 'fire', 'crouch', 'box', 'reload', 'knock', 'heal'];

// ------------------------------------------------------------------ the level
function buildWorld() {
  // Dock slab, water, snow and road paint.
  plane(0, -.05, -3, 46, 78, colors.floor, 1); plane(0, -.06, -3, 46, 78, colors.floor, 1).data.tex = 'concrete'; box(0, -.55, -3, 46, 1, 78, 0x354f58, 'concrete'); plane(-39, -.85, -3, 32, 100, 0x15313e, 1); plane(0, -.85, 44, 100, 18, 0x15313e, 1);
  for (let i = 0; i < 65; i++) { const p = plane(rr(-23, 23), .012, rr(-39, 35), rr(.5, 5), rr(.3, 2), 0xb0bdae, rr(.10, .3)); p.rotation.y = rr(0, TAU); }
  for (let i = 0; i < 40; i++) { const p = plane(rr(-53, -24), -.81, rr(-46, 41), rr(1, 5), .05, 0x648a8d, rr(.12, .27)); animated.push({ node: p, kind: 'water', phase: rnd() * TAU }); }
  for (let z = -18; z < 32; z += 4) { plane(2.7, .025, z, .13, 1.7, 0xb7b491, .72); plane(19.5, .025, z, .11, 2.8, 0xb7b491, .45); }
  hatch(0, -18.1, 6, 1.2); hatch(15, 30, 8, 1.3); floorText('DOCK 04', -13, 31, 6, 1.2); floorText('RELAY  →', 7, -16.5, 6, .8); floorText('KEEP CLEAR', 3, 9, 6, .65);
  for (let z = -37; z < 35; z += 5) { box(-22.5, .22, z, 1, .44, 4.7, 0x98a797, 'concrete'); cylinder(-22.3, .58, z, .23, .78, 0x374c50); box(22.5, .3, z, 1, .6, 4.9, 0x7a8d81, 'concrete'); cylinder(22.5, 1.9, z, .06, 3.1, 0x789188); box(22.5, 3, z, .07, .06, 5, 0x889d91); box(22.5, 1.6, z, .06, .05, 5, 0x889d91); }
  // Boundary blockers are also used by the line-of-sight system.
  colliders.push({ x: -23.3, z: -3, w: 1, d: 79, h: 1, active: true, name: 'boundary' }, { x: 23.3, z: -3, w: 1, d: 79, h: 4, active: true, name: 'boundary' }, { x: 0, z: 35.7, w: 48, d: 1, h: 1, active: true, name: 'boundary' }, { x: 0, z: -40, w: 48, d: 1, h: 5, active: true, name: 'boundary' });
  // The container lanes offer several viable stealth routes.
  containerCargo(-13, 20, 5, 8, 0x72594d, 'FSL  ·  08'); containerCargo(-3, 18, 6, 10, 0x465e54, 'NORTH / 14'); containerCargo(10, 22, 5, 9, 0x607678, 'FSL  ·  27'); containerCargo(13, 5, 6, 10, 0x806054, 'COLD / 03'); containerCargo(-3, 3, 6, 7, 0x536963, 'NORTH / 02'); containerCargo(-7, -11, 5, 7, 0x596869, 'FSL  ·  16'); containerCargo(11, -10.5, 6, 6, 0x485f58, 'RELAY / 09');
  crate(-18, 10, 2.4, 2.8, 1.5); crate(-8, 28, 2, 2, 1.5); crate(-6.5, 29, 1.3, 1.3, 2.1); crate(4, 28, 2.2, 2.3, 1.6); crate(18, 13, 2.2, 2, 1.5); crate(18, -1, 2, 2, 2.0); crate(5, -3, 1.8, 2.5, 1.4); crate(-16, -13, 2.5, 2.5, 1.6);
  // Guard office. Its near wall is low so the player can read the space.
  plane(-16.5, .045, .5, 9, 11, 0x879389); solid(-21, .5, .45, 11, 3.1, 0x7d8b83); solid(-16.5, -5, 9, .45, 3.1, 0x8b9485); solid(-16.5, 6, 9, .45, 1.1, 0x738c83); solid(-12, -3, .45, 4, 3.1, 0x6f8781); solid(-12, 4.5, .45, 3, 2.7, 0x6f8781); textPlate('SECURITY', -16.5, 2.4, 6.25, 4, .48, '#d1d3b8', '#304c4a');
  solid(-17, -2.8, 4, 1.4, 1.05, 0x667a6e, 'metal'); box(-17, 1.42, -2.85, 1.1, .7, .48, 0x253f45); box(-17, 1.44, -2.595, .83, .44, .015, 0x88b39b, null, root, { unlit: true }); solid(-19.7, 3.3, 1.3, 2.4, 2.3, 0x5a7168, 'metal'); box(-14.6, .45, -2, .7, .9, .7, 0x3b5557);
  card = group(-17, .06, -1.3); box(0, .68, 0, .67, .045, .43, 0xd3c7a0, null, card).own = true; box(.13, .71, 0, .16, .02, .31, 0xb79e51, null, card); meshNode('ring', { r: .65, color: 0xe4ce8f, opacity: .45 }, 0, .012, 0, card); card.label = addLabel(card, '01 / KEYCARD', 'obj', 1.2);
  // Relay building and access gate.
  plane(0, .04, -28.9, 40, 18, 0x627c78); for (let x = -18; x < 20; x += 4) for (let z = -36; z < -21; z += 4) { plane(x, .046, z, 3.95, .025, 0xa7b49b, .24); plane(x, .047, z, .025, 3.95, 0xa7b49b, .24); }
  solid(0, -38, 41, .6, 4.6, 0x526f70); solid(-20.2, -29, .65, 18, 3.9, 0x577674); solid(20.2, -29, .65, 18, 3.9, 0x577674); const fw1 = solid(-11.4, -20, 17.4, .7, 2.8, 0x607c7b), fw2 = solid(11.4, -20, 17.4, .7, 2.8, 0x607c7b); fw1.data.fadeInside = fw2.data.fadeInside = true; box(0, 4.2, -20, 6.2, .8, .9, 0x415f63); textPlate('01   /   PANTRY RELAY', 0, 4.2, -19.52, 5.6, .48, '#dfdaba', '#2f4a4d');
  door = solid(0, -20, 5.4, .6, 3.8, 0x435e61, 'metal', 'door'); door.baseY = 1.9; box(2.3, 1.8, -19.54, .22, .5, .13, 0xaf754e, null, root, { unlit: true }); door.label = addLabel(door, 'LEVEL 01', 'obj', 2.6);
  for (const p of [[-12, -28], [-5, -29], [10, -28], [17.5, -28]]) { solid(p[0], p[1], 2.4, 3.5, 2.7, 0x314f53, 'grate'); for (let i = 0; i < 5; i++) box(p[0] - .5, 2.4 - i * .4, p[1] + 1.77, .7, .1, .03, i % 2 ? 0x6f9c83 : 0xd0b981, null, root, { unlit: true }); box(p[0], 2.77, p[1], 2.5, .14, 3.6, 0x859b91, 'metal'); }
  solid(12.5, -35.2, 5, 1.3, 1.1, 0x48635f, 'metal'); for (let i = 0; i < 3; i++) { box(10.8 + i * 1.6, 1.65, -35.3, 1.3, .88, .65, 0x243d42); box(10.8 + i * 1.6, 1.68, -34.955, 1.08, .61, .016, 0x8cba91, null, root, { unlit: true }); for (let j = 0; j < 3; j++) box(10.8 + i * 1.6, 1.82 - j * .15, -34.94, .85, .028, .018, 0x3e7463, null, root, { unlit: true }); }
  terminal = group(12.5, .05, -33.5); meshNode('ring', { r: .95, color: 0xbad7a1, opacity: .5 }, 0, .016, 0, terminal); terminal.label = addLabel(terminal, '02 / LEDGER TERMINAL', 'obj', 1.1); textPlate('FROSTLINE  /  UPLINK', 0, 3, -37.65, 7, .64, '#b8c7b3', '#355254'); solid(-16, -35.4, 5, 1.1, 1, 0x61776a, 'metal'); floorText('AUTHORIZED PERSONNEL', 0, -22.1, 6, .6);
  // Pipes, radar dish, dock crane and extraction boat.
  for (const x of [-18.5, -17.8, -17.1]) { const c = cylinder(x, 2.9, -37.2, .18, 7, 0x7e9790); c.rotation.z = Math.PI / 2; }
  const crane = group(-26, 0, 7); box(0, 5, 0, .65, 10, .65, 0x728877, 'metal', crane); box(5.6, 10, 0, 12, .7, .75, 0x889480, 'metal', crane); box(9, 7.2, 0, .05, 5.5, .05, 0x7b9389, null, crane); box(9, 4.4, 0, .45, .4, .5, 0x4b6362, null, crane); box(1, 10.7, 0, 1.9, .5, 1.6, 0x687c6e, null, crane);
  const dish = group(15, 4.3, -39); cylinder(0, 1.8, 0, .15, 3.6, 0x637f7d, dish); const d = meshNode('dish', { r: 2.7, color: 0x829c94 }, 0, 3.4, 0, dish); d.rotation.x = .8; d.rotation.z = .1; d.own = true; animated.push({ node: d, kind: 'dish' });
  plane(16, .02, 32, 9, 5, 0x445e61); extraction = group(16, .04, 32); meshNode('ring', { r: 1.5, color: 0xaccb97, opacity: .6 }, 0, .035, 0, extraction); extraction.label = addLabel(extraction, '03 / EXTRACTION', 'obj', 1.8);
  boat = group(16, -.15, 37.3); box(0, -.1, 0, 3.6, .9, 6.1, 0x243c46, 'metal', boat);
  for (const p of [[-19, 26], [20, 25], [-19, -9], [19, -17], [-18, -33], [1, -34], [7, 8]]) lamp(p[0], p[1], p[1] < -20 ? 5 : 6.8);
  createPickup(-19, 3, 'med', 1); createPickup(-8.5, 11, 'ammo', 8); createPickup(20, 19, 'med', 1); createPickup(18, -17, 'ammo', 8); createPickup(-17, -34, 'ammo', 8); createPickup(4, -35, 'med', 1);
  player = { x: -17, z: 29, angle: 0, speed: 0, health: 100, crouched: false, boxed: false, aiming: false, ammo: 8, reserve: 16, kits: 2, fireCD: 0, reload: 0, invuln: 0, actionCD: 0, visual: makeActor(true) };
  player.visual.root.position.set(player.x, 0, player.z); player.label = addLabel(player.visual.root, 'ROOK', '', 2.45);
  const routes = [[[-7, 26], [-7, 12], [5, 12], [5, 26]], [[18, 27], [18, 9], [7, 9], [7, 27]], [[-9, 8], [-9, -6], [-18, -6], [-18, -10], [-10, -16]], [[1, 6], [1, -15], [17, -15], [17, -5], [7, -5], [7, 6]], [[-15, -24], [-15, -32], [-8, -32], [-8, -24]], [[6, -24], [15, -24], [15, -32], [6, -32]]];
  routes.forEach((route, i) => {
    const g = { id: i, x: route[0][0], z: route[0][1], angle: 0, route, patrolIndex: 1, wait: i * .4, mode: 'patrol', suspicion: 0, sleep: 0, stun: 0, investigate: 0, target: null, path: [], pathTime: 0, pathTarget: null, shotCD: 1.2, bodyCheck: null, bodyWake: 0, remember: 0, visual: makeActor(false), visiblePlayer: false, cone: makeCone(0xd1cf7f, .075) };
    g.visual.root.position.set(g.x, 0, g.z); g.label = addLabel(g.visual.root, '?', 'big', 2.7); g.label.visible = false; guards.push(g);
  });
  // The relay camera, plus two cameras that only switch on for HARD operations.
  const camera = (x, z, base, sweep, hard) => {
    const c = { x, z, angle: base, base, sweep, hard, suspicion: 0, remember: 0, disabled: hard, cone: makeCone(0xd5c887, .06), node: group(x, 3.3, z) };
    box(0, 0, 0, .45, .35, .7, 0x98a99a, null, c.node); box(0, 0, -.38, .22, .17, .05, 0x7aa78d, null, c.node, { unlit: true });
    if (hard) { cylinder(0, -1.75, .1, .06, 3.3, 0x526567, c.node, 8); box(0, .1, .2, .12, .5, .12, 0x526567, null, c.node); box(.12, .12, -.32, .05, .04, .05, 0xe0705a, null, c.node, { unlit: true }); c.node.visible = false; }
    return c;
  };
  security = [camera(-18.8, -34.8, 2.35, .65, false), camera(-11.55, -2.3, 1.9, .6, true), camera(5.6, -19.15, Math.PI + .35, .55, true)];
  for (let i = 0; i < 280; i++) snowflakes.push({ x: rr(-40, 40), y: rr(.5, 15), z: rr(-50, 48), s: rr(.025, .08), v: rr(.8, 2.5) });
  resetStats();
}
function resetStats() { stats = { alerts: 0, shots: 0, takedowns: 0, kits: 0, damage: 0, retries: 0, tags: 0 }; }

function enhanceWorld() {
  // Replace stretched paint with tiled asphalt and soft snow deposits.
  let ground = false;
  for (const n of root.children) {
    if (n.type === 'plane' && n.data.w === 46 && n.data.d === 78) { if (ground) n.visible = false; else { ground = true; n.position.y = -.004; n.data.tex = 'asphalt'; n.data.color = 0x485b66; } }
    if (n.type === 'plane' && n.data.color === 0xb0bdae) n.visible = false;
  }
  for (const l of lamps) { l.glow.data.tex = 'glow'; l.glow.data.w = l.glow.data.d = 14; l.glow.opacity = l.glow.data.opacity = .6; box(l.x, l.height + .08, l.z, 1.1, .07, .75, 0xb5c8c5, 'snow'); }
  for (const [x, z, w, d] of [[-15.8, 25, 1.1, 6], [-9.7, 18, 1, 9], [-6.5, 17, 1, 8], [.6, 18, 1, 10], [6.4, 26, 1.2, 7], [13.6, 18, 1.1, 8], [-19.9, 30, 2, 3], [20.7, 23, 2, 8], [-17, -5.6, 8, 1.3]]) { const p = plane(x, .012, z, w, d, 0xc1ced0, .7); p.data.tex = 'snowmask'; }
  // Wear, drainage channels, cover shadows and reflected pools of light.
  for (let z = -16; z < 33; z += 5) { box(-20.8, .007, z, .48, .018, 3.9, 0x425b64, 'grate'); for (const side of [-1, 1]) { const p = plane(side * 21.7, .018, z, 1.6, 5.2, 0xc4d0cd, .65); p.data.tex = 'snowmask'; } }
  for (const p of [[-10, 30, 5, 2], [3, 19, 3, 7], [17, 27, 5, 3], [-10, 10, 4, 2], [4, -12, 5, 3]]) { const n = plane(p[0], .022, p[1], p[2], p[3], 0xa1bdc5, .42); n.data.tex = 'puddle'; }
  // Chain-link fence with actual alpha cut-outs.
  for (let z = -36; z < 35; z += 5) { const n = meshNode('sign', { w: 4.8, h: 2.6, color: 0x9cadaa, tex: 'net', alphaTest: .3 }, 22.48, 1.78, z); n.rotation.y = -Math.PI / 2; for (const zz of [-1.5, -.5, .5, 1.5]) { beam([22.43, 3.19, z + zz - .12], [22.7, 3.4, z + zz + .12], .018, 0xa2afaa); beam([22.7, 3.19, z + zz - .12], [22.43, 3.4, z + zz + .12], .018, 0xa2afaa); } }
  // A working dock: bollards, cables, pallets and barrel groups.
  for (const z of [-17, -7, 3, 14, 25]) { cylinder(-22.1, .49, z, .28, .9, 0x40535d, root, 12); cylinder(-22.1, .96, z, .37, .12, 0x8b9996, root, 12); for (let k = 0; k < 4; k++) meshNode('ring', { r: .6 + k * .055, color: 0x746f5d, opacity: 1 }, -21, .035 + k * .018, z + 1); }
  const barrel = (x, z) => { form(x, 0, z, [[0, .42, .42], [.13, .46, .46], [1.16, .46, .46], [1.3, .41, .41]], 0x697d80, root, 16, 'metal'); colliders.push({ x, z, w: .95, d: .95, h: 1.3, active: true, name: 'barrel' }); for (const y of [.12, .43, .96, 1.22]) { const r = meshNode('ring', { r: .463, color: 0x2b424a, opacity: 1 }, x, y, z); r.data.width = .035; } cylinder(x, 1.30, z, .42, .025, 0x91a6a6, root, 16); textPlate('FUEL', x, .75, z + .465, .43, .17, '#d4c8a5', '#4b6169'); };
  barrel(-19.9, 13); barrel(-20.8, 14.2); barrel(20.7, -17); barrel(19.7, -17.5);
  for (const [x, z] of [[-18, 22], [20, 29]]) for (let j = 0; j < 3; j++) { for (let i = -2; i <= 2; i++) box(x + i * .27, .10 + j * .17, z, .22, .12, 1.5, 0x798171, 'crate'); box(x, .16 + j * .17, z - .5, 1.4, .06, .14, 0x56675f); box(x, .16 + j * .17, z + .5, 1.4, .06, .14, 0x56675f); }
  // Forklift in the west lane. All solid parts use one collision volume.
  const f = group(-18.2, 0, 17.5); f.rotation.y = -.27; colliders.push({ x: -18.2, z: 17.5, w: 1.9, d: 3.3, h: 2.7, active: true, name: 'forklift' });
  box(0, .63, 0, 1.38, .7, 2.35, 0x9c976c, 'metal', f); form(0, .93, .78, [[-.17, .67, .43], [.26, .6, .4], [.38, .45, .35]], 0x989778, f, 8);
  for (const x of [-.72, .72]) for (const z of [-.7, .75]) { const w = cylinder(x, .35, z, .34, .22, 0x1d303b, f, 12); w.rotation.z = Math.PI / 2; const hub = cylinder(x * 1.06, .35, z, .16, .23, 0x768b8c, f, 10); hub.rotation.z = Math.PI / 2; }
  box(0, 1.05, .2, .63, .13, .57, 0x263d45, null, f); box(0, 1.32, .43, .65, .5, .12, 0x263d45, null, f);
  for (const x of [-.62, .62]) for (const z of [-.9, .66]) box(x, 1.71, z, .07, 1.8, .07, 0x2b4350, null, f); box(0, 2.65, -.1, 1.5, .1, 1.95, 0x677c7c, 'metal', f); box(0, 2.72, -.1, 1.52, .045, 1.99, 0xc0cdca, 'snow', f);
  for (const x of [-.48, .48]) { box(x, 1.58, -1.3, .11, 2.95, .15, 0x334c56, 'metal', f); box(x, .19, -1.92, .16, .12, 1.4, 0x687e80, null, f); } box(0, 1.37, -1.32, 1.05, .18, .17, 0x506974, null, f); box(0, 1.95, -1.32, 1.05, .13, .17, 0x506974, null, f);
  cylinder(.36, 2.81, .45, .10, .18, 0xe5ab65, f, 10); textPlate('FSL 04', -18.2, 1, 18.75, .75, .3, '#e0dcc8', '#344c55');
  // Detailed office and relay building. These are additions to existing cover.
  for (let x = -20; x <= 20; x += 5) { box(x, 2.3, -37.63, .17, 4.6, .16, 0x334e5a, 'metal'); box(x, 4.64, -37.6, .45, .15, .42, 0x9faeaa, 'snow'); }
  for (let z = -36; z < -21; z += 4) for (const x of [-19.83, 19.83]) { box(x, 1.25, z, .045, .14, 3.9, 0x9aab8f); box(x, 2.1, z, .10, .08, 3.85, 0x354f5a); }
  for (const x of [-17.5, -7, 3.5, 14]) { box(x, 3.15, -37.63, 2.8, .65, .07, 0x304b57, 'grate'); box(x, 3.49, -37.51, 3.04, .08, .29, 0xabbcbc, 'metal'); }
  for (const x of [-14, -7, 7, 14]) { box(x, 2.7, -19.55, .12, .11, .8, 0x364d56); box(x, 2.7, -19.10, .9, .3, .12, 0xd7dcbd, null, root, { unlit: true }); }
  // Thick door tracks, warning marks and a separate reader panel.
  for (const x of [-2.88, 2.88]) { box(x, 1.9, -19.61, .18, 3.8, .35, 0x263f4c, 'metal'); for (let y = .25; y < 3.6; y += .38) { const b = box(x, y, -19.4, .14, .17, .025, 0xb4aa78); b.rotation.z = x > 0 ? .5 : -.5; } }
  textPlate('SECURE ACCESS', 0, 3.83, -19.02, 3.5, .25, '#cbd3bf', '#304c57');
  for (const x of [-12, -5, 10, 17.5]) for (let y = .5; y < 2.6; y += .29) { const z = x === -5 ? -27.22 : -26.22; box(x + .57, y, z, .54, .13, .045, 0x152c37); for (let j = 0; j < 3; j++) box(x + .44 + j * .12, y, z + .025, .032, .035, .008, j % 2 ? 0xdda574 : 0x86bdb0, null, root, { unlit: true }); }
  for (const x of [-15, 8]) for (let z = -32; z < -22; z += 1) box(x, .072, z, .15, .10, .78, 0x202f37);
  for (let i = 0; i < 4; i++) { box(-18.7 + i * .64, 1.12, -2.73, .52, .10, .8, 0xaab5ad); box(-18.7 + i * .64, 1.18, -2.73, .43, .02, .68, 0xd1d2b9); }
  box(-19.8, 1.2, -4.67, 1.4, 1.7, .24, 0x576d73, 'metal'); textPlate('230 V', -19.8, 1.46, -4.50, .73, .3, '#d3be7f', '#394e58');
  for (let i = 0; i < 5; i++) box(-19.5 + i * .18, .60, -4.63, .09, .6, .18, 0x728888, 'metal');
  textPlate('NO UNAUTHORIZED ENTRY', -16.5, 2.35, -4.72, 4.1, .29, '#d8d2b7', '#3b5057');
  // East service gantry, overhead pipes and warm industrial lights.
  for (const z of [7, -17]) { for (const x of [-21, 21]) { box(x, 3.9, z, .18, 7.8, .2, 0x657c84, 'metal'); beam([x, 6.1, z], [x - Math.sign(x) * 1.5, 7.8, z], .11, 0x8c9b99); } box(0, 7.85, z, 42.6, .22, .26, 0x7a9193, 'metal'); for (let x = -20; x <= 20; x += 2) beam([x, 7.8, z], [x + 1, 8.45, z], .06, 0x526f7b); box(0, 8.46, z, 42.6, .1, .14, 0x67838b); }
  // Truss crane behind the dock edge.
  for (const z of [-4, 12]) { for (const x of [-27, -24]) box(x, 5.5, z, .28, 11, .35, 0x708991, 'metal'); for (let y = 1; y < 11; y += 2) beam([-27, y, z], [-24, y + 1.8, z], .12, 0x91a3a4); }
  for (const x of [-27, -24]) { box(x, 11.2, 4, .32, .5, 17, 0x8d9f9f, 'metal'); for (let z = -4; z < 12; z += 2) beam([x, 11.2, z], [x, 12.3, z + 2], .09, 0x77919a); box(x, 12.3, 4, .15, .18, 17, 0x9baead); }
  box(-22, 11.2, 10, 12, .4, .6, 0x819a9e, 'metal'); for (let x = -27; x < -17; x += 2) beam([x, 11.2, 10], [x + 1, 12.1, 10], .09, 0x9dafa9); box(-22, 12.12, 10, 12, .1, .13, 0x7e969c); beam([-17.2, 11.1, 10], [-17.2, 7.4, 10], .03, 0x8aa1a5); ellipsoid(-17.2, 7.2, 10, .17, .26, .16, 0x496773, root, 8, 4);
  // Cutaway roof machinery and distant silhouettes establish scale.
  for (let x = -20; x < 24; x += 8) { box(x, 3, -44, 6.5, 6, 9, 0x3c5663, 'wall'); box(x, 6.06, -44, 6.7, .12, 9.2, 0x9aafb1, 'snow'); box(x, 6.5, -44, 2, .85, 3, 0x485f69, 'grate'); }
  for (let i = 0; i < 16; i++) { const x = -68 + i * 9, z = -65 - rnd() * 12, h = 8 + rnd() * 9; form(x, -2, z, [[0, 7, 6], [h * .35, 6, 5], [h * .7, 3, 3], [h, .15, .1]], 0x596e76, root, 6); }
  while (boat.children.length) boat.remove(boat.children[0]);
  form(0, -.2, 0, [[-.50, 1.03, 2.4], [0, 1.66, 3.05], [.25, 1.60, 2.95]], 0x2c424e, boat, 16, 'fabric');
  for (const side of [-1, 1]) { ellipsoid(side * 1.47, .26, .06, .35, .36, 2.56, 0x3b5260, boat, 12, 7); for (let z = -2; z < 2.5; z += .8) { box(side * 1.49, .51, z, .42, .065, .06, 0x1a2f3c, null, boat); box(side * 1.52, .62, z, .07, .13, .09, 0x9aaaab, null, boat); } }
  ellipsoid(0, .25, -2.48, 1.3, .34, .52, 0x3b5260, boat, 14, 6); box(0, .15, .05, 2.45, .1, 4.65, 0x445c65, 'grate', boat);
  for (const z of [-.85, .55, 1.65]) { box(0, .48, z, 2.2, .12, .44, 0x586e77, 'fabric', boat); for (const x of [-.8, .8]) box(x, .29, z, .065, .35, .13, 0x233b48, null, boat); }
  box(.4, .7, -1.45, .85, .82, .74, 0x536d77, 'metal', boat); const wind = box(.4, 1.28, -1.58, .9, .44, .04, 0x8cb6bf, null, boat, { opacity: .42 }); wind.rotation.x = -.24; box(.4, 1.12, -1.15, .76, .16, .25, 0x243e4b, null, boat); box(.4, 1.22, -1.17, .24, .02, .16, 0x94c3ae, null, boat, { unlit: true });
  form(0, .36, 2.87, [[0, .42, .32], [.48, .45, .34], [.63, .30, .25]], 0x344d5a, boat, 10); box(0, -.35, 3, .2, .72, .3, 0x283d47, null, boat); cylinder(0, .3, -2.7, .035, .85, 0x8babad, boat, 8);
  // Actual ledges cast useful shadows at close range.
  for (let z = -35; z < 35; z += 5) box(-22.55, -.03, z, .4, .14, 4.9, 0xa9bcbf, 'concrete');
}
function addFoodProps() {
  // Food is cargo, not a toxin. These are original fictional warehouse labels.
  textPlate('MSG / FOOD GRADE', -8, 2.75, 23.2, 4.1, .55, '#d9e0b8', '#24372e', 0);
  textPlate('PALISADE / FOOD FREIGHT', 11.4, 3, -9.2, 4.8, .45, '#e0d8a8', '#293a36', 0);
  textPlate('PANTRY / RELEASE CONTROL', 12.3, 2.5, -36.4, 5.1, .42, '#bfd4b3', '#192d2d', 0);
  // A soup bowl and a spoon sit beside the transfer terminal.
  const bowl = group(11.65, 1.12, -34.9);
  cylinder(0, .06, 0, .22, .12, 0xd4d4ba, bowl, 12); cylinder(0, .123, 0, .19, .012, 0x405556, bowl, 12);
  box(0, .15, .06, .32, .018, .035, 0xa4b9b0, null, bowl).rotation.y = .45;
  const freight = group(-11.8, 0, 16.5);
  for (let i = 0; i < 5; i++) { const sack = box((i % 2) * .73, .2 + Math.floor(i / 2) * .29, 0, .67, .28, .85, 0xb5b292, 'cloth', freight); sack.rotation.z = i % 2 ? .05 : -.045; }
  textPlate('25 kg / MSG', -11.4, 1.35, 16.7, 1.6, .32, '#283e32', '#d0c6a0', 0);
  makeOfficePhoto();
}
function makeOfficePhoto() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const q = c.getContext('2d');
  q.fillStyle = '#9b9b77'; q.fillRect(0, 0, 128, 160); q.fillStyle = '#344a40'; q.fillRect(7, 7, 114, 146);
  q.fillStyle = '#b6b28a'; q.fillRect(13, 13, 102, 122); q.fillStyle = '#79836c'; q.fillRect(13, 75, 102, 60);
  for (const [x, y, r] of [[43, 49, 13], [83, 56, 11]]) { q.fillStyle = '#434f40'; q.beginPath(); q.arc(x, y, r, 0, TAU); q.fill(); q.fillRect(x - r, y + 10, r * 2, 39); q.fillStyle = '#d3c699'; q.fillRect(x - 7, y - 4, 13, 15); }
  q.fillStyle = '#3b5143'; q.fillRect(17, 110, 94, 9); q.fillStyle = '#e7dcc0'; q.fillRect(9, 138, 110, 14); q.fillStyle = '#3d5141'; q.font = 'bold 10px monospace'; q.textAlign = 'center'; q.fillText('TABLE FOUR', 64, 149);
  officePhoto = group(-18.25, 1.09, -2.65); officePhoto.rotation.x = -Math.PI / 2;
  meshNode('sign', { w: .58, h: .72, color: 0xffffff, canvas: c, canvasKey: 'TABLE FOUR / PHOTO', unlit: true }, 0, .36, 0, officePhoto);
}

// ------------------------------------------------------------------ collision, line of sight, navigation
function blocked(x, z, r = .42) { if (x < -21.85 || x > 21.85 || z < -38.7 || z > 34.3) return true; for (const c of colliders) if (c.active && Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true; return false; }
function segmentBox(a, b, c, pad = 0) {
  let t0 = 0, t1 = 1;
  // x axis
  {
    const size = c.w / 2 + pad, lo = c.x - size, hi = c.x + size, delta = b.x - a.x;
    if (Math.abs(delta) < 1e-7) { if (a.x < lo || a.x > hi) return 1; } else { let near = (lo - a.x) / delta, far = (hi - a.x) / delta; if (near > far) { const t = near; near = far; far = t; } t0 = Math.max(t0, near); t1 = Math.min(t1, far); if (t0 > t1) return 1; }
  }
  // z axis
  {
    const size = c.d / 2 + pad, lo = c.z - size, hi = c.z + size, delta = b.z - a.z;
    if (Math.abs(delta) < 1e-7) { if (a.z < lo || a.z > hi) return 1; } else { let near = (lo - a.z) / delta, far = (hi - a.z) / delta; if (near > far) { const t = near; near = far; far = t; } t0 = Math.max(t0, near); t1 = Math.min(t1, far); if (t0 > t1) return 1; }
  }
  return t0 >= 0 && t0 < 1 ? t0 : 1;
}
function wallFraction(a, b, pad = 0) { let t = 1; for (const c of colliders) if (c.active) t = Math.min(t, segmentBox(a, b, c, pad)); return t; }
function clearLine(a, b, pad = 0) { return wallFraction(a, b, pad) > .997; }
function moveEntity(a, dx, dz, r = .4) { const ox = a.x, oz = a.z; if (!blocked(a.x + dx, a.z, r)) a.x += dx; if (!blocked(a.x, a.z + dz, r)) a.z += dz; return Math.hypot(a.x - ox, a.z - oz); }
const NX = 45, NZ = 74, X0 = -22, Z0 = -39; let navGrid = null;
// A* buffers are reused between searches, so guards do not allocate while they path.
const pfG = new Float32Array(NX * NZ), pfFrom = new Int16Array(NX * NZ), pfClosed = new Uint8Array(NX * NZ);
const HEAP_MAX = 40000, heapI = new Int32Array(HEAP_MAX), heapF = new Float32Array(HEAP_MAX); let heapN = 0;
function rebuildNav() { navGrid = new Uint8Array(NX * NZ); for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) navGrid[z * NX + x] = blocked(X0 + x, Z0 + z, .48) ? 1 : 0; }
function nearestCell(x, z) {
  const cx = clamp(Math.round(x - X0), 0, NX - 1), cz = clamp(Math.round(z - Z0), 0, NZ - 1);
  for (let r = 0; r < 7; r++) { let best = -1, bd = 1e9; for (let zz = Math.max(0, cz - r); zz <= Math.min(NZ - 1, cz + r); zz++) for (let xx = Math.max(0, cx - r); xx <= Math.min(NX - 1, cx + r); xx++) { const i = zz * NX + xx; if (navGrid[i]) continue; const d = (X0 + xx - x) ** 2 + (Z0 + zz - z) ** 2; if (d < bd) { bd = d; best = i; } } if (best >= 0) return best; }
  return -1;
}
function heapPush(i, f) { if (heapN >= HEAP_MAX) return; let j = heapN++; while (j) { const p = (j - 1) >> 1; if (heapF[p] <= f) break; heapI[j] = heapI[p]; heapF[j] = heapF[p]; j = p; } heapI[j] = i; heapF[j] = f; }
function heapPop() {
  const top = heapI[0], endI = heapI[--heapN], endF = heapF[heapN];
  if (heapN) { let j = 0; for (;;) { let c = j * 2 + 1; if (c >= heapN) break; if (c + 1 < heapN && heapF[c + 1] < heapF[c]) c++; if (heapF[c] >= endF) break; heapI[j] = heapI[c]; heapF[j] = heapF[c]; j = c; } heapI[j] = endI; heapF[j] = endF; }
  return top;
}
function findPath(a, b) {
  if (!navGrid) rebuildNav();
  if (clearLine(a, b, .46)) return [{ x: b.x, z: b.z }];
  const start = nearestCell(a.x, a.z), goal = nearestCell(b.x, b.z); if (start < 0 || goal < 0) return [];
  if (start === goal) return [{ x: X0 + goal % NX, z: Z0 + Math.floor(goal / NX) }];
  pfG.fill(Infinity); pfG[start] = 0; pfFrom.fill(-1); pfClosed.fill(0); heapN = 0;
  const gx = goal % NX, gz = Math.floor(goal / NX);
  const heuristic = (i) => Math.hypot(i % NX - gx, Math.floor(i / NX) - gz);
  heapPush(start, heuristic(start)); let count = 0, found = false;
  while (heapN && count++ < 4000) {
    const i = heapPop(); if (pfClosed[i]) continue; if (i === goal) { found = true; break; } pfClosed[i] = 1;
    const x = i % NX, z = (i / NX) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const xx = x + dx, zz = z + dz; if (xx < 0 || xx >= NX || zz < 0 || zz >= NZ) continue;
      const j = zz * NX + xx; if (navGrid[j] || pfClosed[j]) continue; if (dx && dz && (navGrid[z * NX + xx] || navGrid[zz * NX + x])) continue;
      const ng = pfG[i] + (dx && dz ? 1.4142 : 1); if (ng < pfG[j]) { pfG[j] = ng; pfFrom[j] = i; heapPush(j, ng + heuristic(j)); }
    }
  }
  if (!found) return [];
  const path = []; let i = goal; while (i !== start && i >= 0) { path.push({ x: X0 + i % NX, z: Z0 + ((i / NX) | 0) }); i = pfFrom[i]; }
  path.reverse(); return path;
}
function setTarget(g, x, z) { if (!g.target) g.target = { x, z }; else { g.target.x = x; g.target.z = z; } }
function walkGuard(g, target, speed, dt) {
  g.pathTime -= dt; if (!target) return 0;
  if (g.pathTime <= 0 || !g.path.length || !g.pathTarget || dist(g.pathTarget, target) > 2) { g.path = findPath(g, target); g.pathTarget = { x: target.x, z: target.z }; g.pathTime = .75 + g.id * .04; }
  while (g.path.length && dist(g, g.path[0]) < .23) g.path.shift();
  if (!g.path.length) return 0;
  const p = g.path[0], dx = p.x - g.x, dz = p.z - g.z, l = Math.hypot(dx, dz); if (l < .03) return 0;
  const a = Math.atan2(dx, -dz); g.angle += angleDiff(a, g.angle) * Math.min(1, dt * 8);
  const step = Math.min(l, speed * dt); const moved = moveEntity(g, dx / l * step, dz / l * step, .37);
  if (moved < .0005) { g.pathTime = 0; g.wait = Math.max(g.wait, .1); }
  return moved / dt;
}

// ------------------------------------------------------------------ guards and cameras
function hearNoise(x, z, radius, source = 'sound') {
  noisePulse = .8;
  for (const g of guards) {
    if (g.sleep > 0 || g.stun > 0 || alertMode === 'alert') continue;
    const d = Math.hypot(g.x - x, g.z - z), range = clearLine(g, { x, z }) ? radius : radius * .45;
    if (d < range) { g.mode = 'investigate'; g.investigate = 7; setTarget(g, x, z); g.path = []; g.pathTime = 0; g.suspicion = Math.max(g.suspicion, source === 'knock' ? .25 : .1); }
  }
}
function setAlert(g) {
  if (alertMode !== 'alert') { stats.alerts++; sfx('alert'); toast('CONTACT! BREAK LINE OF SIGHT', 2.3); shake = .35; input.rumble(.5, 220); }
  alertMode = 'alert'; alertTimer = 0; lastSeen = gameTime; lastKnown.x = player.x; lastKnown.z = player.z;
  for (const e of guards) if (e.sleep <= 0) { e.mode = 'pursue'; setTarget(e, lastKnown.x, lastKnown.z); e.pathTime = 0; e.remember = 12; if (e !== g) e.suspicion = Math.max(e.suspicion, .45); }
  if (g) g.suspicion = 1;
}
function canSee(g, isCamera = false) {
  const d = dist(g, player); let range = (isCamera ? 10 : (alertMode === 'alert' ? 13 : 10.2)) * run().sight;
  if (player.crouched) range *= .82; if (player.boxed) range *= .85; if (d > range) return false;
  if (d > .95) { const a = Math.atan2(player.x - g.x, -(player.z - g.z)); if (Math.abs(angleDiff(a, g.angle)) > (isCamera ? .48 : .62)) return false; }
  if (!clearLine(g, player)) return false;
  if (player.boxed && player.speed < .08 && g.remember <= 0 && g.suspicion < .65 && d > 1.8) return false;
  return true;
}
// Sight cones write straight into a preallocated fan: 20 points, x and z.
const coneEnd = { x: 0, z: 0 };
function makeCone(color, opacity) { return { pts: new Float32Array(40), color, opacity, visible: false, fresh: false, mesh: null }; }
function conePoints(g, range, half) {
  const pts = g.cone.pts, end = coneEnd; pts[0] = g.x; pts[1] = g.z;
  for (let i = 0; i <= 18; i++) { const a = g.angle - half + i / 18 * half * 2; end.x = g.x + Math.sin(a) * range; end.z = g.z - Math.cos(a) * range; const t = wallFraction(g, end); pts[2 + i * 2] = mix(g.x, end.x, t); pts[3 + i * 2] = mix(g.z, end.z, t); }
  g.cone.fresh = true;
}
function sleepGuard(g, duration, method) {
  if (g.sleep > 0) return;
  g.sleep = duration * run().sleep; g.mode = 'sleep'; g.suspicion = 0; g.investigate = 0; g.path = []; g.stun = 0; g.bodyCheck = null; stats.takedowns++; sfx('sleep'); input.rumble(.35, 90);
  if (method === 'melee') toast('SILENT TAKEDOWN', 1.4);
  g.visual.root.rotation.y = -g.angle;
}
function wakeGuard(g) { g.sleep = 0; g.mode = 'investigate'; g.investigate = 6; setTarget(g, g.x + Math.sin(g.angle) * 2, g.z - Math.cos(g.angle) * 2); g.suspicion = .2; g.bodyCheck = null; g.path = []; if (alertMode === 'normal') { alertMode = 'caution'; alertTimer = 9; } }
function tickGuards(dt) {
  let seen = false; const notice = run().notice;
  for (const g of guards) {
    g.shotCD -= dt; g.remember = Math.max(0, g.remember - dt); let moving = 0; g.visiblePlayer = false;
    if (g.sleep > 0) {
      g.sleep -= dt; if (g.sleep <= 0) wakeGuard(g);
      g.cone.visible = false; animateActor(g, 0, dt, false, false, true);
      const l = g.label; l.visible = true; l.kind = 'sleep'; l.text = tagsOwned.has(g.id) ? 'z Z z' : 'z Z z  ·  TAG'; l.color = '#b3cba0'; l.offset = .9;
      continue;
    }
    if (g.stun > 0) { g.stun -= dt; g.angle += dt * 3; animateActor(g, 0, dt, true, false); g.cone.visible = false; continue; }
    const sees = canSee(g); g.visiblePlayer = sees;
    if (sees) {
      const near = dist(g, player); let factor = player.crouched ? .48 : 1; if (player.boxed) factor = player.speed > .05 ? .72 : .7;
      g.suspicion = Math.min(1, g.suspicion + dt * (near < 2.3 ? 2.1 : near < 5 ? 1.13 : .68) * factor * notice);
      if (g.suspicion >= 1 || alertMode === 'alert' || alertMode === 'evasion') { if (alertMode !== 'alert') setAlert(g); lastSeen = gameTime; lastKnown.x = player.x; lastKnown.z = player.z; seen = true; g.remember = 12; setTarget(g, lastKnown.x, lastKnown.z); g.mode = 'pursue'; }
    } else g.suspicion = Math.max(0, g.suspicion - dt * .23);
    if (alertMode === 'alert' || alertMode === 'evasion') {
      g.mode = 'pursue'; if (alertMode === 'alert' || !g.target) setTarget(g, lastKnown.x, lastKnown.z);
      if (g.visiblePlayer && dist(g, player) < 10) {
        const a = Math.atan2(player.x - g.x, -(player.z - g.z)); g.angle += angleDiff(a, g.angle) * Math.min(1, dt * 10);
        if (dist(g, player) > 5) moving = walkGuard(g, g.target, 2.9, dt);
        if (g.shotCD <= 0) { g.shotCD = Math.max(.6, 1.1 + rr(0, .6) + run().shotDelay); enemyShot(g); }
      } else {
        if (dist(g, g.target) < 1.2 && !g.visiblePlayer) { setTarget(g, clamp(lastKnown.x + rr(-6, 6), -21, 21), clamp(lastKnown.z + rr(-5, 5), -37, 33)); g.pathTime = 0; }
        moving = walkGuard(g, g.target, alertMode === 'alert' ? 3.2 : 2.35, dt);
      }
    } else if (g.suspicion > .22 && sees) {
      const a = Math.atan2(player.x - g.x, -(player.z - g.z)); g.angle += angleDiff(a, g.angle) * Math.min(1, dt * 4);
      if (g.suspicion > .55) { g.mode = 'investigate'; setTarget(g, player.x, player.z); g.investigate = 5; moving = walkGuard(g, g.target, 1.5, dt); }
    } else if (g.mode === 'investigate') {
      g.investigate -= dt;
      if (g.target && dist(g, g.target) > 1) moving = walkGuard(g, g.target, 1.65, dt); else g.angle += Math.sin(gameTime * 1.6 + g.id) * dt * .75;
      if (g.investigate <= 0) { g.mode = 'patrol'; g.path = []; g.wait = .6; }
    } else {
      if (g.wait > 0) { g.wait -= dt; g.angle += Math.sin(gameTime * .9 + g.id) * dt * .12; }
      else { const p = g.route[g.patrolIndex]; if (Math.hypot(g.x - p[0], g.z - p[1]) < .55) { g.patrolIndex = (g.patrolIndex + 1) % g.route.length; g.wait = 1.0 + g.id * .15; g.path = []; } else { routeTarget.x = p[0]; routeTarget.z = p[1]; moving = walkGuard(g, routeTarget, alertMode === 'caution' ? 1.7 : 1.28, dt); } }
    }
    // Nearby bodies are investigated. Guards can wake a sleeping patrol partner.
    // Every 0.4 s per guard, staggered, exactly as the 30 Hz original did.
    if (frame % 24 === g.id * 4 && !sees && alertMode !== 'alert') {
      for (const body of guards) {
        if (body === g || body.sleep < 3 || dist(g, body) > 5 || !clearLine(g, body)) continue;
        const a = Math.atan2(body.x - g.x, -(body.z - g.z));
        if (Math.abs(angleDiff(a, g.angle)) < .85) { g.mode = 'investigate'; setTarget(g, body.x, body.z); g.investigate = 8; g.bodyCheck = body.id; if (alertMode === 'normal') { alertMode = 'caution'; alertTimer = 12; toast('A GUARD FOUND A SLEEPING PATROL', 2.4); } break; }
      }
    }
    if (g.bodyCheck !== null) { const b = guards[g.bodyCheck]; if (b && b.sleep > 0 && dist(g, b) < 1.5) { g.bodyWake += dt; if (g.bodyWake > 2) { wakeGuard(b); g.bodyCheck = null; g.bodyWake = 0; } } else g.bodyWake = 0; }
    g.visual.root.position.set(g.x, 0, g.z); g.visual.root.rotation.y = -g.angle; animateActor(g, moving, dt, false, alertMode === 'alert');
    g.cone.visible = opts.cones && state === 'play'; g.cone.color = alertMode === 'alert' ? 0xeb795d : g.suspicion > .2 ? 0xe8b568 : 0xc4cfa1; g.cone.opacity = alertMode === 'alert' ? .105 : g.suspicion > .2 ? .10 : .045;
    const l = g.label; l.visible = g.suspicion > .18 || alertMode === 'alert' || g.mode === 'investigate'; l.kind = 'big'; l.color = alertMode === 'alert' ? '#ed715c' : '#e5cd84'; l.text = alertMode === 'alert' ? '!' : '?'; l.offset = 2.75;
  }
  for (const c of security) {
    c.angle = c.base + Math.sin(worldTime * .4 + (c.hard ? c.x * .3 : 0)) * c.sweep; c.node.rotation.y = -c.angle;
    c.cone.visible = opts.cones && state === 'play' && !c.disabled; if (c.disabled) continue;
    c.remember = 0; const sees = canSee(c, true); c.suspicion = clamp(c.suspicion + (sees ? dt * .8 * notice : -dt * .25), 0, 1);
    if (c.suspicion >= 1) { if (alertMode !== 'alert') setAlert(null); seen = true; lastSeen = gameTime; lastKnown.x = player.x; lastKnown.z = player.z; }
    c.cone.color = c.suspicion > .3 ? 0xe89060 : 0xd1c591;
  }
  if (alertMode === 'alert' && !seen && gameTime - lastSeen > 3.2) { alertMode = 'evasion'; alertTimer = 12; toast('CONTACT LOST — STAY HIDDEN', 2.2); }
  if (alertMode === 'evasion' || alertMode === 'caution') {
    alertTimer -= dt;
    if (alertTimer <= 0) {
      if (alertMode === 'evasion') { alertMode = 'caution'; alertTimer = 14; for (const g of guards) if (g.sleep <= 0) { g.mode = 'investigate'; g.investigate = 5; setTarget(g, g.x, g.z); g.path = []; } }
      else { alertMode = 'normal'; for (const g of guards) if (g.sleep <= 0) { g.mode = 'patrol'; g.suspicion = 0; g.path = []; } toast('PATROLS RESUME — AREA CLEAR', 2.1); }
    }
  }
}
const routeTarget = { x: 0, z: 0 };

// ------------------------------------------------------------------ shots and effects
function enemyShot(g) {
  const end = { x: player.x, z: player.z }, t = wallFraction(g, end);
  tracer(g, { x: mix(g.x, end.x, t), z: mix(g.z, end.z, t) }, 0xf2ce88); tone(95, .1, 'sawtooth', .14, -50); noise(.1, .1, 1100);
  if (t > .99 && player.invuln <= 0) { const d = dist(g, player), chance = player.speed > 3 ? .55 : .86; if (rnd() < chance || d < 3) damagePlayer((12 + Math.floor(rnd() * 5)) * run().damage); }
}
function damagePlayer(n) {
  if (state !== 'play' || player.invuln > 0) return;
  player.health = Math.max(0, player.health - n); stats.damage += n; player.invuln = .65; shake = .45; sfx('hit'); damageFlash = .45; input.rumble(.7, 200);
  if (player.health <= 0) { setMode('dead'); $('dead-checkpoint').textContent = 'LAST CHECKPOINT / ' + (checkpoint ? checkpoint.name : 'DOCK INSERTION'); tone(110, 1.2, 'sawtooth', .1, -70); input.rumble(1, 500); }
}
function fire() {
  if (player.fireCD > 0 || player.reload > 0 || player.boxed) return;
  if (player.ammo <= 0 && !runBandana) { sfx('empty'); toast('MAGAZINE EMPTY — PRESS ' + promptOf('reload'), 1.5); player.fireCD = .3; return; }
  if (!runBandana) player.ammo--;
  stats.shots++; player.fireCD = .42; sfx('shot'); shake = .08; input.rumble(.15, 50);
  const forward = { x: Math.sin(player.angle), z: -Math.cos(player.angle) }; let end = { x: player.x + forward.x * 16, z: player.z + forward.z * 16 }, best = null, bestD = 16;
  for (const g of guards) { if (g.sleep > 0) continue; const d = dist(player, g), a = Math.atan2(g.x - player.x, -(g.z - player.z)); if (d < bestD && Math.abs(angleDiff(a, player.angle)) < .105 + .34 / Math.max(d, 1) && clearLine(player, g)) { best = g; bestD = d; } }
  if (best) { end = { x: best.x, z: best.z }; sleepGuard(best, 48, 'shot'); sparks(best.x, best.z, 0xd4d5aa); }
  else { const t = wallFraction(player, end); end = { x: mix(player.x, end.x, t), z: mix(player.z, end.z, t) }; if (t < .99) sparks(end.x, end.z, 0xe2c695); }
  tracer(player, end, 0xc3dcb6, player.crouched ? .85 : 1.45); hearNoise(player.x, player.z, 3.1, 'shot');
}
function reload() {
  if (runBandana) { toast('BANDANA — NO RELOAD NEEDED', 1.4); return; }
  if (player.reload > 0 || player.ammo >= 8) return;
  if (player.reserve <= 0) { toast('NO RESERVE AMMUNITION', 1.5); sfx('empty'); return; }
  player.reload = 1.35; sfx('reload');
}
function heal() {
  if (player.kits <= 0) { toast('NO MEDICAL KITS', 1.5); return; }
  if (player.health >= 100) { toast('LIFE IS FULL', 1.4); return; }
  player.kits--; stats.kits++; player.health = Math.min(100, player.health + 45); sfx('pickup'); toast('MEDICAL KIT USED / +45 LIFE', 2);
}
function setBoxed(on) { player.boxed = on; player.visual.body.visible = !on; player.visual.boxBody.visible = on; }
function toggleBox() {
  if (player.reload > 0) return;
  setBoxed(!player.boxed); player.crouched = false;
  if (player.boxed) { for (const g of guards) if (g.visiblePlayer && g.suspicion > .3) g.remember = 12; toast('BOX EQUIPPED — STAY STILL TO HIDE', 2); } else sfx('select');
}
function sleepingTagGuard() {
  for (const g of guards) if (g.sleep > 0 && !tagsOwned.has(g.id) && dist(player, g) < 1.6) return g;
  return null;
}
function takeTag(g) {
  tagsOwned.add(g.id); stats.tags++; store.set(TAG_KEY, [...tagsOwned]);
  const t = TAGS[g.id]; sfx('pickup'); input.rumble(.2, 60);
  toast('DOG TAG ' + tagsOwned.size + ' / ' + TAGS.length + ' — ' + t.name, 3);
  if (bandanaUnlocked()) setTimeout(() => toast('ALL SIX TAGS — THE BANDANA IS IN THE BRIEFING', 4), 3100);
}
function interact() {
  if (player.actionCD > 0) return;
  if (stage === 2 && !photoUpright && dist(player, { x: -18.25, z: -1.4 }) < 1.7) { photoUpright = true; officePhoto.rotation.x = 0; player.actionCD = .4; sfx('select'); toast('PHOTO SET UPRIGHT / TABLE FOUR', 3); saveCheckpoint('TABLE FOUR / PHOTO RESTORED'); return; }
  if (stage === 0 && dist(player, { x: -17, z: -1.3 }) < 2.3) { stage = 1; card.visible = false; sfx('pickup'); toast('LEVEL 01 KEYCARD ACQUIRED', 3); saveCheckpoint('KEYCARD ACQUIRED'); radioPending = true; return; }
  if (!doorOpen && dist(player, { x: 0, z: -19.2 }) < 3.3) { if (stage < 1) { toast('LEVEL 01 KEYCARD REQUIRED', 2); sfx('empty'); } else { doorOpen = true; door.collider.active = false; rebuildNav(); sfx('door'); toast('ACCESS GRANTED', 2); } return; }
  if (stage === 2 && dist(player, { x: 16, z: 32 }) < 2.6) { if (alertMode === 'alert' || alertMode === 'evasion') { toast('LOSE THE GUARDS BEFORE EXTRACTION', 2); return; } finishMission(); return; }
  if (stage === 1 && dist(player, { x: 12.5, z: -33.5 }) < 2.3) return;
  const tagGuard = sleepingTagGuard(); if (tagGuard) { takeTag(tagGuard); player.actionCD = .4; return; }
  let nearest = null, nd = 1.7;
  for (const g of guards) { if (g.sleep > 0) continue; const d = dist(player, g); if (d < nd && clearLine(player, g)) { nd = d; nearest = g; } }
  if (nearest) {
    const g = nearest, a = Math.atan2(player.x - g.x, -(player.z - g.z)), behind = Math.abs(angleDiff(a, g.angle)) > 1.6;
    if ((behind && alertMode !== 'alert') || g.stun > 0) sleepGuard(g, 78, 'melee');
    else { g.stun = 1.3; setAlert(g); sfx('hit'); input.rumble(.4, 80); toast('STRIKE — PRESS ' + promptOf('use') + ' AGAIN TO SUBDUE', 1.4); }
    player.actionCD = .48;
  }
}

// ------------------------------------------------------------------ player
function tickPlayer(dt) {
  player.invuln = Math.max(0, player.invuln - dt); player.fireCD = Math.max(0, player.fireCD - dt); player.actionCD = Math.max(0, player.actionCD - dt);
  if (player.reload > 0) { player.reload -= dt; if (player.reload <= 0) { const n = Math.min(8 - player.ammo, player.reserve); player.ammo += n; player.reserve -= n; sfx('select'); } }
  if (tapped.has('crouch')) { player.crouched = !player.crouched; if (player.boxed) setBoxed(false); sfx('select'); }
  if (tapped.has('box')) toggleBox(); if (tapped.has('reload')) reload(); if (tapped.has('heal')) heal();
  if (tapped.has('knock') && player.actionCD <= 0) { hearNoise(player.x, player.z, 13, 'knock'); sfx('knock'); toast('KNOCK KNOCK…', 1.2); player.actionCD = .7; }
  const mv = input.vector('move'); let dx = mv.x, dz = -mv.y, len = Math.hypot(dx, dz);
  if (len > 1) { dx /= len; dz /= len; } if (len < .12) { dx = dz = 0; len = 0; }
  let aiming = input.down('aim'); if (player.boxed) aiming = false; player.aiming = aiming;
  let speed = player.boxed ? 1.2 : player.crouched ? 1.6 : input.down('walk') ? 2.15 : 4.5; if (aiming) speed *= .48; if (player.reload > 0) speed *= .7;
  const moved = moveEntity(player, dx * speed * dt, dz * speed * dt, .43); player.speed = moved / dt;
  if (len && !aiming) { const a = Math.atan2(dx, -dz); player.angle += angleDiff(a, player.angle) * Math.min(1, dt * 16); }
  aimTarget = null; mouseAim = false;
  if (aiming) {
    const ad = input.vector('aimDir');
    if (input.mouseButtons.held.has(2)) { mouseAim = true; const p = unprojectGround(input.pointer.x, input.pointer.y); player.angle = Math.atan2(p.x - player.x, -(p.z - player.z)); }
    else if (Math.hypot(ad.x, ad.y) > .35) player.angle = Math.atan2(ad.x, ad.y);
    else {
      let best = 1e9;
      for (const g of guards) { const d = dist(player, g); if (g.sleep > 0 || d > 16 || !clearLine(player, g)) continue; const a = Math.atan2(g.x - player.x, -(g.z - player.z)), score = d + Math.abs(angleDiff(a, player.angle)) * 1.8; if (score < best) { best = score; aimTarget = g; } }
      if (aimTarget) { const a = Math.atan2(aimTarget.x - player.x, -(aimTarget.z - player.z)); player.angle += angleDiff(a, player.angle) * Math.min(1, dt * 20); }
    }
  }
  if (tapped.has('fire')) fire(); if (tapped.has('use')) interact();
  if (player.speed > .2) { stepTimer -= dt; if (stepTimer <= 0) { stepTimer = player.crouched ? .55 : player.boxed ? .65 : .34; if (!player.crouched && !player.boxed) sfx('step'); if (player.speed > 2.8) hearNoise(player.x, player.z, 5.2, 'step'); } }
  player.visual.root.position.set(player.x, 0, player.z); player.visual.root.rotation.y = -player.angle; player.visual.root.visible = player.invuln > .15 ? Math.floor(worldTime * 16) % 2 === 0 : true;
  animateActor(player, player.boxed ? 0 : player.speed, dt, player.crouched, aiming);
  for (const p of pickups) {
    if (!p.taken && dist(player, p) < 1.35) {
      if (p.type === 'ammo' && player.reserve >= 40) continue; if (p.type === 'med' && player.kits >= 4) continue;
      p.taken = true; p.node.visible = false;
      if (p.type === 'ammo') { player.reserve = Math.min(40, player.reserve + p.amount); toast('TRANQUILIZER AMMO +' + p.amount, 1.8); } else { player.kits++; toast('MEDICAL KIT +1', 1.8); }
      sfx('pickup'); input.rumble(.1, 40);
    }
  }
  if (stage === 1 && dist(player, { x: 12.5, z: -33.5 }) < 2.35 && input.down('use') && player.speed < .3 && alertMode !== 'alert' && alertMode !== 'evasion') {
    terminalProgress = Math.min(4.2, terminalProgress + dt); if (frame % 36 === 0) tone(390 + terminalProgress * 55, .04, 'sine', .025);
    if (terminalProgress >= 4.2) { stage = 2; for (const c of security) c.disabled = true; alertMode = 'caution'; alertTimer = 12; saveCheckpoint('FOOD HOLDS RELEASED'); sfx('pickup'); input.rumble(.3, 150); toast('LEDGER COPIED / RELEASE COMMAND SENT', 3.5); openHistoryRadio(0, 'play'); }
  } else if (stage === 1) terminalProgress = Math.max(0, terminalProgress - dt * .22);
  if (player.z < -21 && zone !== 'relay') { zone = 'relay'; showArea('PANTRY RELAY', 'RESTRICTED AREA · LEVEL 01'); }
  else if (player.z > -18 && zone !== 'dock') { zone = 'dock'; if (gameTime > 5) showArea('CARGO DOCK', 'FROSTLINE STATION · SECTOR 04'); }
}
let mouseAim = false, damageFlash = 0;

// ------------------------------------------------------------------ mission state and checkpoints
const screenFor = { title: 'title', brief: 'brief', help: 'help', pause: 'pause', settings: 'settings', codec: 'codec', map: 'map-modal', dead: 'dead', win: 'win', archive: 'archive', tags: 'tags' };
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((e) => e.classList.toggle('hidden', e.id !== id));
  $('hud').classList.toggle('hidden', !fieldActive);
  kit.touch?.suspend(state !== 'play', 'game');
  input.settle(); tapped.clear(); navLast = ''; codecNavLast = 0;
  if (state === 'play') { placeTouchTop(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.(); }
  else focusScreen();
}
function setMode(mode) { if (state === 'codec' && mode !== 'codec') { disconnectRadio(mode); return; } state = mode; showScreen(screenFor[mode] || ''); }
function toast(text, duration = 2) { $('notice').textContent = text; noticeTimer = duration; $('notice').style.opacity = '1'; }
function showArea(title, sub) { $('area').querySelector('h2').textContent = title; $('area').querySelector('span').textContent = sub; areaTimer = 4.2; }
function saveCheckpoint(name) {
  checkpoint = { version: 3, name, stage, doorOpen, photoUpright, difficulty: runKey, bandana: runBandana, time: gameTime,
    player: { x: player.x, z: player.z, angle: player.angle, health: player.health, ammo: player.ammo, reserve: player.reserve, kits: player.kits },
    stats: { ...stats }, items: pickups.map((p) => p.taken), guards: guards.map((g) => ({ x: g.x, z: g.z, angle: g.angle, patrolIndex: g.patrolIndex, sleep: g.sleep })) };
  store.set(CHECK_KEY, checkpoint); $('continue-btn').classList.remove('hidden');
}
function readCheckpoint() {
  const c = store.get(CHECK_KEY);
  if (c && (c.version === 2 || c.version === 3) && c.player && Number.isFinite(c.player.x) && Number.isFinite(c.player.z) && [0, 1, 2].includes(c.stage)) {
    if (!DIFFICULTY[c.difficulty]) c.difficulty = 'normal';
    checkpoint = c; $('continue-btn').classList.remove('hidden');
  }
}
function resetWorld() {
  const d = run();
  photoUpright = false; if (officePhoto) officePhoto.rotation.x = -Math.PI / 2; stage = 0; doorOpen = false; terminalProgress = 0; gameTime = 0; lastSeen = -99; alertMode = 'normal'; alertTimer = 0; lastKnown.x = lastKnown.z = 0; radioPending = false; noticeTimer = 0; areaTimer = 0; zone = 'dock'; frame = 0; resetStats();
  Object.assign(player, { x: -17, z: 29, angle: 0, health: 100, crouched: false, boxed: false, aiming: false, ammo: 8, reserve: 16, kits: d.kits, fireCD: 0, reload: 0, invuln: 0, actionCD: 0, speed: 0 });
  setBoxed(false); player.visual.root.visible = true; card.visible = true; door.collider.active = true; door.scale.y = 1; door.position.y = 1.9;
  for (const p of pickups) { p.taken = false; p.node.visible = true; }
  for (const c of security) { c.suspicion = 0; c.disabled = c.hard && !d.cameras; c.node.visible = !c.hard || d.cameras; }
  for (const g of guards) {
    Object.assign(g, { x: g.route[0][0], z: g.route[0][1], angle: 0, patrolIndex: 1, wait: g.id * .4, mode: 'patrol', suspicion: 0, sleep: 0, stun: 0, investigate: 0, target: null, path: [], pathTime: 0, pathTarget: null, shotCD: 1.4, bodyCheck: null, bodyWake: 0, remember: 0, visiblePlayer: false });
    g.visual.root.position.set(g.x, 0, g.z); g.visual.root.rotation.y = 0; g.visual.root.visible = true; g.label.visible = false; animateActor(g, 0, 0);
  }
  clearEffects(); rebuildNav(); tapped.clear(); damageFlash = 0;
}
function newOperation() { if (!ready) return; fieldActive = false; setMode('brief'); syncBrief(); sfx('select'); }
function deploy() {
  startAudio(); runKey = field.difficulty; runBandana = field.bandana && bandanaUnlocked();
  resetWorld(); fieldActive = true; setMode('play');
  mainCamera.tx = cameraX(player.x); mainCamera.tz = 25; mainCamera.x = mainCamera.tx; mainCamera.y = 30; mainCamera.z = 49; mainCamera.span = opts.zoom ? 23 : 17.6;
  saveCheckpoint('DOCK INSERTION'); showArea('CARGO DOCK', 'FROSTLINE STATION · 02:14 AM');
  openRadio([
    ['MARA', 'Rook, this is Control. Frostline is a food depot. Palisade Logistics has stopped its shipments. The labels say MSG: monosodium glutamate. Find the keycard in the west office.'],
    ['ROOK', 'Armed guards around a food additive. Who declared war on soup?'],
    ['MARA', 'Four outside. Two in the relay room. Watch the radar. Crouch near guards. Solid cover blocks their sight.' + (run().cameras ? ' Palisade added two cameras tonight: one on the office door, one on the relay gate.' : '')],
    ['MARA', 'Enter the second room. Hold ' + promptOf('use') + ' at the terminal to copy the ledger and upload a release command. I will call when the transfer finishes. The MSG history is long. The mission clock will stop.'],
    ['ROOK', 'Get the card. Release the food. Return to the boat. How long can a history of seasoning be?']]);
}
function restoreCheckpoint(countRetry = true) {
  const c = checkpoint; if (!c) { deploy(); return; }
  const retries = countRetry ? Math.max(stats?.retries || 0, c.stats?.retries || 0) + 1 : (c.stats?.retries || 0);
  runKey = DIFFICULTY[c.difficulty] ? c.difficulty : 'normal'; runBandana = !!c.bandana && bandanaUnlocked();
  resetWorld(); photoUpright = !!c.photoUpright; if (officePhoto) officePhoto.rotation.x = photoUpright ? 0 : -Math.PI / 2;
  stage = c.stage; doorOpen = !!c.doorOpen || stage === 2; door.collider.active = !doorOpen; door.scale.y = doorOpen ? .04 : 1; door.position.y = 3.8 - 1.9 * door.scale.y;
  for (const k of ['x', 'z', 'angle', 'health', 'ammo', 'reserve', 'kits']) if (Number.isFinite(c.player[k])) player[k] = c.player[k];
  player.x = clamp(player.x, -21, 21); player.z = clamp(player.z, -38, 34); player.health = clamp(player.health, 1, 100); player.ammo = clamp(player.ammo, 0, 8); player.reserve = clamp(player.reserve, 0, 40); player.kits = clamp(player.kits, 0, 4);
  gameTime = clamp(c.time || 0, 0, 99999); Object.assign(stats, c.stats || {}); stats.retries = retries; if (!Number.isFinite(stats.tags)) stats.tags = 0;
  card.visible = stage === 0;
  for (let i = 0; i < pickups.length; i++) { pickups[i].taken = !!c.items?.[i]; pickups[i].node.visible = !pickups[i].taken; }
  if (Array.isArray(c.guards)) for (let i = 0; i < guards.length; i++) { const s = c.guards[i], g = guards[i]; if (s && Number.isFinite(s.x) && Number.isFinite(s.z)) { g.x = s.x; g.z = s.z; g.angle = s.angle || 0; g.patrolIndex = clamp(s.patrolIndex | 0, 0, g.route.length - 1); g.sleep = Math.max(0, s.sleep || 0); g.visual.root.position.set(g.x, 0, g.z); g.visual.root.rotation.y = -g.angle; } }
  for (const cam of security) cam.disabled = stage === 2 || (cam.hard && !run().cameras);
  terminalProgress = stage === 2 ? 4.2 : 0; if (stage === 2) { historyProgress.unlocked = true; saveHistory(); }
  zone = player.z < -20 ? 'relay' : 'dock'; rebuildNav(); fieldActive = true; setMode('play');
  mainCamera.tx = cameraX(player.x); mainCamera.tz = clamp(player.z - 4, -33, 28); mainCamera.x = mainCamera.tx; mainCamera.y = 30; mainCamera.z = mainCamera.tz + 24; mainCamera.span = opts.zoom ? 23 : 17.6;
  toast('CHECKPOINT RESTORED / ' + c.name, 2.5); startAudio();
}
function readBest() {
  let b = store.get(BEST_KEY);
  if (!b || typeof b !== 'object') { b = {}; const old = store.get('msg-best-v1'); if (old && Number.isFinite(old.score)) b.normal = old; }
  return b;
}
function finishMission() {
  setMode('win'); const time = gameTime, d = run();
  const base = 12000 - time * 5 - stats.alerts * 750 - stats.shots * 45 - stats.kits * 200 - stats.retries * 600 + stats.tags * 250;
  const score = Math.max(0, Math.round(base * d.score * (runBandana ? .7 : 1)));
  const rank = stats.alerts === 0 && stats.takedowns === 0 && stats.shots === 0 ? 'GHOST' : stats.alerts === 0 ? 'FOX' : stats.alerts <= 2 ? 'WOLF' : 'ROOK';
  $('rank').textContent = rank; $('rank-desc').textContent = { GHOST: 'NO ALERTS. NO SHOTS. NO TRACE.', FOX: 'UNSEEN. PRECISE. IN CONTROL.', WOLF: 'CONTACT BROKEN. MISSION COMPLETE.', ROOK: 'YOU MADE IT BACK ALIVE.' }[rank];
  $('stat-time').textContent = formatTime(time); $('stat-alerts').textContent = stats.alerts; $('stat-takedowns').textContent = stats.takedowns; $('stat-shots').textContent = stats.shots; $('stat-kits').textContent = stats.kits;
  $('stat-tags').textContent = tagsOwned.size + ' / ' + TAGS.length + (stats.tags ? '  (+' + stats.tags + ')' : '');
  $('stat-difficulty').textContent = d.label + (runBandana ? ' / BANDANA' : ''); $('stat-score').textContent = score.toLocaleString();
  $('win-text').textContent = 'The boat leaves the dock. The full ledger is safe. The blocked food can move. Rook leaves the bowl behind. ' + (photoUpright ? 'The photograph stands upright in the office. ' : '') + (stats.retries ? 'Checkpoint restarts: ' + stats.retries + '.' : 'No checkpoint restarts.');
  sfx('pickup'); setTimeout(() => tone(196, 1.2, 'triangle', .09), 300);
  const best = readBest(), prev = best[runKey] && Number.isFinite(best[runKey].score) ? best[runKey] : null;
  if (!prev || score > prev.score) { best[runKey] = { score, rank, time }; store.set(BEST_KEY, best); $('best-record').textContent = 'NEW PERSONAL BEST / ' + d.label + ' / ' + rank + ' / ' + score.toLocaleString() + ' / ' + formatTime(time); }
  else $('best-record').textContent = 'PERSONAL BEST / ' + d.label + ' / ' + prev.rank + ' / ' + prev.score.toLocaleString() + (Number.isFinite(prev.time) ? ' / ' + formatTime(prev.time) : '');
  store.remove(CHECK_KEY); checkpoint = null; $('continue-btn').classList.add('hidden'); syncTitle();
}
function formatTime(t) { const n = Math.max(0, Math.floor(t)); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
const objectives = [['Find the keycard', 'Search the west guard office. Leave the food intact.'], ['Release the food', 'In the second room, hold USE at the ledger terminal.'], ['Reach extraction', 'The food holds are clear. Return to the southeast boat.']];
function objectivePoint() { return stage === 0 ? { x: -17, z: -1.3 } : stage === 1 ? { x: 12.5, z: -33.5 } : { x: 16, z: 32 }; }
function getContext() {
  const E = promptOf('use');
  if (stage === 2 && !photoUpright && dist(player, { x: -18.25, z: -1.4 }) < 1.7) return E + ' — SET THE PHOTOGRAPH UPRIGHT / OPTIONAL';
  if (stage === 0 && dist(player, { x: -17, z: -1.3 }) < 2.3) return E + ' — TAKE LEVEL 01 KEYCARD';
  if (!doorOpen && dist(player, { x: 0, z: -19.2 }) < 3.3) return stage > 0 ? E + ' — OPEN RELAY GATE' : 'LOCKED — LEVEL 01 KEYCARD';
  if (stage === 1 && dist(player, { x: 12.5, z: -33.5 }) < 2.35) return alertMode === 'alert' || alertMode === 'evasion' ? 'TERMINAL LOCKED — LOSE CONTACT' : 'HOLD ' + E + ' — COPY LEDGER / UPLOAD RELEASE';
  if (stage === 2 && dist(player, { x: 16, z: 32 }) < 2.6) return alertMode === 'alert' || alertMode === 'evasion' ? 'EXTRACTION BLOCKED — LOSE CONTACT' : E + ' — BOARD EXTRACTION BOAT';
  const tagGuard = sleepingTagGuard(); if (tagGuard) return E + ' — TAKE DOG TAG / ' + TAGS[tagGuard.id].name;
  for (const g of guards) { if (g.sleep > 0 || dist(player, g) > 1.7 || !clearLine(player, g)) continue; const a = Math.atan2(player.x - g.x, -(player.z - g.z)); return Math.abs(angleDiff(a, g.angle)) > 1.6 && alertMode !== 'alert' ? E + ' — SILENT TAKEDOWN' : E + ' — STRIKE GUARD'; }
  return '';
}

// ------------------------------------------------------------------ HUD, labels, radar
const hudCache = new Map(), elCache = new Map();
const E = (id) => { let e = elCache.get(id); if (!e) { e = $(id); elCache.set(id, e); } return e; };
function setText(id, v) { v = String(v); if (hudCache.get(id) !== v) { hudCache.set(id, v); E(id).textContent = v; } }
function setStyle(id, prop, v) { const k = id + '.' + prop; if (hudCache.get(k) !== v) { hudCache.set(k, v); E(id).style[prop] = v; } }
function setClass(id, cls, on) { const k = id + '.' + cls; if (hudCache.get(k) !== on) { hudCache.set(k, on); E(id).classList.toggle(cls, on); } }
let radarClock = 0;
function updateHUD(dt) {
  if (!player) return;
  setText('clock', formatTime(gameTime)); setStyle('life', 'width', Math.round(player.health) + '%'); setStyle('life', 'backgroundColor', player.health < 30 ? '#e47661' : '#b4cf91'); setText('life-num', Math.ceil(player.health));
  setText('stance', player.boxed ? 'BOX' : player.crouched ? 'CROUCH' : player.aiming ? 'AIM' : player.speed > 2.8 ? 'RUN' : player.speed > .1 ? 'WALK' : 'STAND');
  setText('ammo', runBandana ? '∞ / BANDANA' : player.reload > 0 ? 'RELOAD' : player.ammo + ' / ' + player.reserve); setText('rations', 'KIT × ' + player.kits);
  setClass('box-equip', 'active', player.boxed); setText('box-text', player.boxed ? 'BOX / ON' : 'BOX');
  let max = 0; for (const g of guards) max = Math.max(max, g.suspicion); for (const c of security) if (!c.disabled) max = Math.max(max, c.suspicion);
  setText('statusline', alertMode === 'alert' ? '! POSITION EXPOSED' : alertMode === 'evasion' ? '◌ CONTACT LOST / HIDE' : max > .2 ? '◉ A GUARD IS WATCHING' : player.boxed && player.speed < .08 ? '■ BOX / KEEP STILL' : player.crouched ? '● LOW PROFILE / QUIET' : stage > 0 ? '● UNDETECTED / CARD LV.01' : '● UNDETECTED');
  setStyle('statusline', 'color', max > .5 || alertMode === 'alert' ? '#e7ae75' : '#aabda9');
  setStyle('suspicion-wrap', 'opacity', max > .05 && alertMode !== 'alert' ? '1' : '0'); setStyle('suspicion-bar', 'width', Math.round(max * 100) + '%');
  setText('obj-index', '0' + (stage + 1) + ' / 03'); setText('obj-title', objectives[stage][0]); setText('obj-desc', objectives[stage][1].replace('USE', promptOf('use')));
  setText('radar-zone', player.z < -20 ? 'RELAY 01' : 'DOCK 04');
  const hot = alertMode !== 'normal'; setStyle('alert-bar', 'opacity', hot ? '1' : '0');
  const ac = alertMode === 'alert' ? '#eb725d' : alertMode === 'evasion' ? '#dfad74' : '#b4c68a';
  setStyle('alert-bar', 'color', ac); setStyle('alert-bar', 'borderColor', ac + '88'); setStyle('alert-bar', 'background', alertMode === 'alert' ? '#321b1be0' : '#1c2926e8');
  setText('alert-title', alertMode.toUpperCase());
  setText('alert-sub', alertMode === 'alert' ? 'BREAK LINE OF SIGHT' : (alertMode === 'evasion' ? 'STAY HIDDEN / ' : 'SEARCH IN PROGRESS / ') + String(Math.max(0, Math.ceil(alertTimer))).padStart(2, '0'));
  setText('radar-state', alertMode === 'alert' ? 'JAMMED' : alertMode === 'evasion' ? 'SEARCH' : 'ONLINE');
  setStyle('radio-toast', 'display', radioPending && alertMode === 'normal' ? 'block' : 'none');
  const ctx = getContext(); setStyle('context', 'display', ctx ? 'block' : 'none'); setText('context-text', ctx);
  const hold = stage === 1 && dist(player, { x: 12.5, z: -33.5 }) < 2.35; setStyle('context-bar', 'display', hold ? 'block' : 'none'); setStyle('context-progress', 'width', (terminalProgress / 4.2 * 100).toFixed(1) + '%');
  setText('map-objective', 'CURRENT ORDER / ' + objectives[stage][0] + '. ' + objectives[stage][1].replace('USE', promptOf('use')));
  if (state === 'play' && (aimTarget || mouseAim)) {
    setStyle('reticle', 'display', 'block');
    let x, y; if (aimTarget) { const p = project(aimTarget.x, 1.2, aimTarget.z); x = p.x; y = p.y; } else { x = input.pointer.x; y = input.pointer.y; }
    E('reticle').style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) translate(-50%,-50%)`;
  } else setStyle('reticle', 'display', 'none');
  updateTouchLabels();
  radarClock -= dt;
  if (radarClock <= 0) { radarClock = 1 / 30; if (fieldActive) drawRadar(E('radar'), false); if (state === 'map') drawRadar(E('fullmap'), true); }
}
const touchLabelCache = {};
function updateTouchLabels() {
  if (!kit.touch || input.source !== 'touch') return;
  const set = (name, text, small) => {
    const key = text + '|' + (small || ''); if (touchLabelCache[name] === key) return; touchLabelCache[name] = key;
    if (!small) { kit.touch.setLabel(name, text); return; }
    const s = document.createElement('span'); s.textContent = text; const m = document.createElement('small'); m.textContent = small; s.appendChild(m); kit.touch.setLabel(name, s);
  };
  set('fire', 'FIRE', runBandana ? '∞' : player.reload > 0 ? '…' : player.ammo + '/' + player.reserve);
  set('heal', 'HEAL ×' + player.kits);
  set('box', player.boxed ? 'BOX ON' : 'BOX');
  set('crouch', player.crouched ? 'STAND' : 'CROUCH');
}
function updateWorldLabels() {
  const show = state === 'play';
  for (const l of labels) {
    const n = l.node, p = n.position;
    let visible = show && l.visible && n.visible;
    if (n === card && stage > 0) visible = false; if (n === terminal && stage !== 1) visible = false; if (n === extraction && stage !== 2) visible = false; if (n === door && doorOpen) visible = false;
    if (n === player.visual.root) visible = show && gameTime < 6;
    let x = 0, y = 0;
    if (visible) { const v = project(p.x, p.y + l.offset, p.z); x = v.x; y = v.y; visible = v.depth > .1 && x > -20 && x < screenW + 20 && y > 30 && y < screenH - 40; if (l.kind === 'obj' && dist(player, { x: p.x, z: p.z }) > 22) visible = false; }
    if (visible !== l.shown) { l.shown = visible; l.el.style.display = visible ? 'block' : 'none'; }
    if (!visible) continue;
    if (l.text !== l.cText) { l.cText = l.text; l.el.textContent = l.text; }
    if (l.kind !== l.cKind) { l.cKind = l.kind; l.el.className = 'world-label' + (l.kind === 'big' ? ' big' : l.kind === 'obj' ? ' obj' : l.kind === 'enemy' ? ' enemy' : ''); }
    if (l.color !== l.cColor) { l.cColor = l.color; l.el.style.color = l.color; }
    if (Math.abs(x - l.sx) > .4 || Math.abs(y - l.sy) > .4) { l.sx = x; l.sy = y; l.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`; }
  }
}
function drawRadar(canvas, full) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0c1c22'; ctx.fillRect(0, 0, w, h);
  const cx = full ? 0 : player.x, cz = full ? -2 : player.z, scale = full ? Math.min((w - 90) / 46, (h - 28) / 77) : w / 33; const ox = w / 2, oy = h / 2;
  const px = (x) => ox + (x - cx) * scale, py = (z) => oy + (z - cz) * scale;
  ctx.strokeStyle = '#77968512'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = -60; i <= 60; i += 5) { ctx.moveTo(px(i), py(-60)); ctx.lineTo(px(i), py(60)); ctx.moveTo(px(-60), py(i)); ctx.lineTo(px(60), py(i)); }
  ctx.stroke();
  ctx.fillStyle = '#35544e35'; ctx.fillRect(px(-23), py(-39), 46 * scale, 74 * scale); ctx.strokeStyle = '#76938966'; ctx.strokeRect(px(-23), py(-39), 46 * scale, 74 * scale);
  ctx.fillStyle = '#69846c19'; ctx.fillRect(px(-20), py(-38), 40 * scale, 18 * scale);
  for (const c of colliders) { if (!c.active || c.name === 'boundary') continue; ctx.fillStyle = c.name === 'door' ? '#bda36a' : '#638a7b'; ctx.globalAlpha = c.h < 1.3 ? .48 : .76; ctx.fillRect(px(c.x - c.w / 2), py(c.z - c.d / 2), c.w * scale, c.d * scale); ctx.globalAlpha = 1; }
  const jam = alertMode === 'alert';
  if (!jam) {
    for (const g of guards) {
      if (g.sleep <= 0 && fieldActive) {
        if (!g.cone.fresh) conePoints(g, 10.2 * run().sight, .62);
        const pts = g.cone.pts; ctx.beginPath(); for (let i = 0; i < 20; i++) { const x = px(pts[i * 2]), y = py(pts[i * 2 + 1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); ctx.fillStyle = g.suspicion > .25 ? '#e5ba6148' : '#b4c27732'; ctx.fill();
      }
      ctx.fillStyle = g.sleep > 0 ? '#739892' : '#e0a672'; ctx.beginPath(); ctx.arc(px(g.x), py(g.z), full ? 2.6 : 3.1, 0, TAU); ctx.fill();
      if (g.sleep > 0 && !tagsOwned.has(g.id)) { ctx.strokeStyle = '#dfc17a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(px(g.x), py(g.z), full ? 5 : 5.5, 0, TAU); ctx.stroke(); }
    }
    for (const c of security) if (!c.disabled) { ctx.fillStyle = '#aea3cd'; ctx.fillRect(px(c.x) - 2, py(c.z) - 2, 4, 4); }
  }
  for (const p of pickups) if (!p.taken) { ctx.fillStyle = p.type === 'med' ? '#a6caa2' : '#849a84'; ctx.fillRect(px(p.x) - 1.5, py(p.z) - 1.5, 3, 3); }
  const obj = objectivePoint(), obx = px(obj.x), oby = py(obj.z), r = 5; ctx.strokeStyle = '#e0c680'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(obx, oby - r); ctx.lineTo(obx + r, oby); ctx.lineTo(obx, oby + r); ctx.lineTo(obx - r, oby); ctx.closePath(); ctx.stroke();
  const ppx = px(player.x), ppy = py(player.z); ctx.save(); ctx.translate(ppx, ppy); ctx.rotate(player.angle); ctx.fillStyle = '#deead0'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 4); ctx.lineTo(0, 2); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill(); ctx.restore();
  if (noisePulse > 0 && !full) { ctx.strokeStyle = '#e9e0bc66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ppx, ppy, (1 - noisePulse) * 33 + 8, 0, TAU); ctx.stroke(); }
  if (jam && !full) { ctx.fillStyle = '#492c2844'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#f0a67e26'; ctx.beginPath(); for (let i = 0; i < 14; i++) { const y = ((i * 18 + worldTime * 80) % h); ctx.moveTo(0, y); ctx.lineTo(w, y + 3); } ctx.stroke(); ctx.fillStyle = '#ebae91'; ctx.textAlign = 'center'; ctx.font = 'bold 15px monospace'; ctx.fillText('NO SIGNAL', w / 2, h / 2 + 36); }
  if (full) {
    ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#a4b9a3';
    for (const label of [['PANTRY RELAY', 0, -38.6], ['WEST OFFICE', -16.5, 8], ['CARGO LANES', 0, 32.5]]) ctx.fillText(label[0], px(label[1]), py(label[2]));
    ctx.textAlign = 'left'; ctx.fillStyle = '#deca8c'; ctx.fillText('0' + (stage + 1), obx + 9, oby + 4); ctx.fillStyle = '#849f91'; ctx.fillText('N ↑', 20, 25); ctx.fillText('SCALE / 10 m', 20, h - 18);
    ctx.strokeStyle = '#a6b897'; ctx.beginPath(); ctx.moveTo(20, h - 32); ctx.lineTo(20 + 10 * scale, h - 32); ctx.stroke();
    if (jam) { ctx.fillStyle = '#e6997f'; ctx.textAlign = 'right'; ctx.fillText('PATROL DATA UNAVAILABLE DURING ALERT', w - 18, h - 18); }
    else if (tagsOwned.size < TAGS.length) { ctx.fillStyle = '#dfc17a'; ctx.textAlign = 'right'; ctx.fillText('○ SLEEPING GUARD WITH A DOG TAG', w - 18, h - 18); }
  }
}

// ------------------------------------------------------------------ camera
let camBasis = { f: [0, 0, -1], r: [1, 0, 0], u: [0, 1, 0] };
function updateBasis() {
  const c = mainCamera, dx = c.tx - c.x, dy = c.ty - c.y, dz = c.tz - c.z, len = Math.hypot(dx, dy, dz);
  const f = [dx / len, dy / len, dz / len], rl = Math.hypot(f[0], f[2]), r = [-f[2] / rl, 0, f[0] / rl], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  camBasis = { f, r, u };
}
function project(x, y, z) {
  const c = mainCamera, b = camBasis, dx = x - c.x, dy = y - c.y, dz = z - c.z, depth = dx * b.f[0] + dy * b.f[1] + dz * b.f[2], distance = Math.hypot(c.tx - c.x, c.ty - c.y, c.tz - c.z);
  const scale = screenH / c.span * distance / Math.max(.1, depth);
  return { x: screenW / 2 + (dx * b.r[0] + dy * b.r[1] + dz * b.r[2]) * scale, y: screenH / 2 - (dx * b.u[0] + dy * b.u[1] + dz * b.u[2]) * scale, depth };
}
function unprojectGround(sx, sy) {
  const c = mainCamera, b = camBasis, d = Math.hypot(c.tx - c.x, c.ty - c.y, c.tz - c.z), rx = (sx - screenW / 2) / screenH * c.span / d, uy = -(sy - screenH / 2) / screenH * c.span / d;
  const ray = [b.f[0] + b.r[0] * rx + b.u[0] * uy, b.f[1] + b.r[1] * rx + b.u[1] * uy, b.f[2] + b.r[2] * rx + b.u[2] * uy], t = -c.y / (ray[1] || -.01);
  return { x: c.x + ray[0] * t, z: c.z + ray[2] * t };
}
function cameraX(x) { const half = (opts.zoom ? 23 : 17.6) / 2 * screenW / screenH, limit = Math.max(0, 24 - half); return clamp(x, -limit, limit); }
function tickCamera(dt) {
  if (!fieldActive) {
    const t = worldTime * .035, k = Math.min(1, dt * 1.8);
    mainCamera.tx = mix(mainCamera.tx, -1 + Math.sin(t) * 2, k); mainCamera.tz = mix(mainCamera.tz, 13 + Math.cos(t) * 2, k);
    mainCamera.x = mix(mainCamera.x, mainCamera.tx + 19, k); mainCamera.y = mix(mainCamera.y, 24, k); mainCamera.z = mix(mainCamera.z, mainCamera.tz + 28, k); mainCamera.span = mix(mainCamera.span, 29, k);
  } else if (state === 'play') {
    const tx = cameraX(player.x), tz = clamp(player.z - 3.5, -33, 28), k = 1 - Math.exp(-dt * 6);
    mainCamera.tx = mix(mainCamera.tx, tx, k); mainCamera.tz = mix(mainCamera.tz, tz, k);
    let zoom = opts.zoom ? 23 : 17.6; if (player.aiming) zoom -= 1.8; mainCamera.span = mix(mainCamera.span, zoom, Math.min(1, dt * 4));
    mainCamera.x = mainCamera.tx; mainCamera.y = 26; mainCamera.z = mainCamera.tz + 22;
    if (opts.shake && shake > .01) { mainCamera.x += (rnd() - .5) * shake * .6; mainCamera.z += (rnd() - .5) * shake * .6; }
  }
}

// ------------------------------------------------------------------ audio: original synthesized sound and adaptive score
const audio = { ctx: null, master: null, musicGain: null, voiceGain: null, started: false, beat: 0, nextBeat: 0, scoreMode: '' };
function startAudio() {
  if (audio.started) { if (audio.ctx.state === 'suspended' && !kit.paused) audio.ctx.resume().catch(() => {}); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = audio.ctx = new C();
    const limit = c.createDynamicsCompressor(); limit.threshold.value = -12; limit.knee.value = 18; limit.ratio.value = 5; limit.attack.value = .003; limit.release.value = .22; limit.connect(c.destination);
    audio.master = c.createGain(); audio.master.gain.value = opts.volume * .82; audio.master.connect(limit);
    audio.musicGain = c.createGain(); audio.musicGain.gain.value = opts.music ? opts.musicVolume * .6 : 0; audio.musicGain.connect(audio.master);
    audio.reverb = c.createConvolver(); const ir = c.createBuffer(2, c.sampleRate * 1.4, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const v = ir.getChannelData(ch); for (let i = 0; i < v.length; i++) v[i] = (Math.random() * 2 - 1) * Math.exp(-i / (c.sampleRate * .24)) * .5; }
    audio.reverb.buffer = ir; const rg = c.createGain(); rg.gain.value = .15; audio.reverb.connect(rg); rg.connect(audio.musicGain);
    audio.drumNoise = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = audio.drumNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audio.started = true; audio.beat = 0; audio.nextBeat = c.currentTime + .12; audio.scoreMode = '';
    if (c.state === 'suspended') c.resume().catch(() => {});
  } catch (e) { console.warn('Audio:', e.message); }
}
function tone(freq, duration = .12, type = 'sine', volume = .1, slide = 0, music = false) {
  if (!audio.started) return; const c = audio.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + duration);
  g.gain.setValueAtTime(.001, c.currentTime); g.gain.linearRampToValueAtTime(volume, c.currentTime + .007); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + duration);
  o.connect(g); g.connect(music ? audio.musicGain : audio.master); o.start(); o.stop(c.currentTime + duration + .03);
}
// Decaying noise bursts are made once per length (three variants each), not on every footstep.
const noiseBank = new Map();
function noise(dur = .08, vol = .12, cutoff = 800) {
  if (!audio.started) return; const c = audio.ctx, key = Math.round(dur * 1000);
  let bank = noiseBank.get(key);
  if (!bank) { bank = { i: 0, list: [] }; for (let v = 0; v < 3; v++) { const b = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); bank.list.push(b); } noiseBank.set(key, bank); }
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = bank.list[bank.i++ % 3]; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(audio.master); s.start();
}
function sfx(type) {
  if (type === 'select') { tone(740, .06, 'square', .055); tone(1100, .09, 'sine', .04); }
  else if (type === 'radio') { tone(880, .13, 'square', .08, 220); setTimeout(() => tone(660, .13, 'square', .07, 330), 160); }
  else if (type === 'alert') { tone(520, .28, 'sawtooth', .16, 700); setTimeout(() => tone(360, .3, 'square', .12, 500), 150); }
  else if (type === 'shot') { noise(.09, .35, 2500); tone(160, .09, 'triangle', .15, -80); }
  else if (type === 'hit') { noise(.2, .35, 800); tone(100, .14, 'sawtooth', .13, -50); }
  else if (type === 'step') noise(.065, .08, 600);
  else if (type === 'knock') { tone(160, .14, 'triangle', .32, -45); noise(.05, .14, 650); setTimeout(() => tone(220, .1, 'triangle', .2, -80), 110); }
  else if (type === 'pickup') { tone(440, .14, 'sine', .14); setTimeout(() => tone(660, .2, 'sine', .12), 80); setTimeout(() => tone(880, .25, 'sine', .09), 160); }
  else if (type === 'sleep') { noise(.1, .12, 400); tone(170, .12, 'sine', .1, -80); }
  else if (type === 'reload') { noise(.1, .1, 1900); setTimeout(() => noise(.08, .14, 2800), 700); }
  else if (type === 'door') { noise(.7, .10, 230); tone(100, .7, 'sawtooth', .04, 20); }
  else if (type === 'empty') tone(210, .035, 'square', .055);
}
function scoreNote(midi, start, duration, level, kind = 'bass') {
  if (!audio.started) return; const c = audio.ctx, freq = 440 * Math.pow(2, (midi - 69) / 12), v = c.createGain(), filter = c.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.setValueAtTime(kind === 'bass' ? 440 : kind === 'brass' ? 1700 : kind === 'pad' ? 850 : 2600, start); filter.Q.value = kind === 'bass' ? 1.5 : .55;
  v.gain.setValueAtTime(.0001, start); v.gain.exponentialRampToValueAtTime(Math.max(.0002, level), start + (kind === 'pad' ? .18 : .013)); v.gain.exponentialRampToValueAtTime(.0001, start + duration);
  filter.connect(v); v.connect(audio.musicGain); if (kind === 'pad' || kind === 'brass') v.connect(audio.reverb);
  for (const det of kind === 'strings' || kind === 'pad' ? [-6, 6] : [0]) { const o = c.createOscillator(); o.type = kind === 'bass' ? 'triangle' : kind === 'pad' ? 'sine' : 'sawtooth'; o.frequency.value = freq; o.detune.value = det; o.connect(filter); o.start(start); o.stop(start + duration + .05); }
}
function scoreDrum(kind, start, level = .2) {
  if (!audio.started) return; const c = audio.ctx, g = c.createGain(); g.connect(audio.musicGain);
  if (kind === 'kick' || kind === 'tom') { const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(kind === 'kick' ? 145 : 220, start); o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 43 : 78, start + .13); g.gain.setValueAtTime(level, start); g.gain.exponentialRampToValueAtTime(.0001, start + .26); o.connect(g); o.start(start); o.stop(start + .3); }
  else { const s = c.createBufferSource(), f = c.createBiquadFilter(); s.buffer = audio.drumNoise; f.type = kind === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 'snare' ? 1900 : 6500; f.Q.value = .55; s.connect(f); f.connect(g); const dur = kind === 'snare' ? .19 : kind === 'crash' ? .75 : .055; g.gain.setValueAtTime(level, start); g.gain.exponentialRampToValueAtTime(.0001, start + dur); s.start(start); s.stop(start + dur); if (kind === 'snare') scoreNote(50, start, .1, level * .4, 'bass'); }
}
function tickAudio() {
  if (!audio.started || audio.ctx.state !== 'running') return; const c = audio.ctx;
  const hot = alertMode === 'alert' || alertMode === 'evasion', mode = state === 'play' ? (hot ? 'alert' : alertMode === 'caution' ? 'search' : 'stealth') : state === 'codec' ? 'radio' : 'menu';
  const target = opts.music ? opts.musicVolume * (mode === 'alert' ? .67 : mode === 'search' ? .53 : mode === 'stealth' ? .50 : mode === 'radio' ? .14 : .13) : 0; audio.musicGain.gain.setTargetAtTime(target, c.currentTime, .2);
  if (mode !== audio.scoreMode) { audio.scoreMode = mode; audio.beat = 0; audio.nextBeat = c.currentTime + .04; if (mode === 'alert') { scoreDrum('crash', audio.nextBeat, .2); scoreDrum('tom', audio.nextBeat + .10, .17); } }
  if (audio.nextBeat < c.currentTime - .5) audio.nextBeat = c.currentTime + .03;
  while (audio.nextBeat < c.currentTime + .12) {
    const t = audio.nextBeat, b = audio.beat++, step = hot ? 60 / 138 / 4 : 60 / 82 / 4; audio.nextBeat += step; if (!opts.music) continue;
    if (mode === 'alert') {
      const bar = Math.floor(b / 16) % 8, rootN = [40, 40, 38, 36, 40, 43, 36, 35][bar], p = b % 16;
      const ost = [0, 7, 12, 7, 0, 7, 10, 7, 0, 7, 12, 15, 12, 7, 10, 7]; scoreNote(rootN + ost[p], t, step * .92, .16, 'bass');
      if (p % 2 === 0) scoreNote(rootN + 12 + [0, 0, 7, 5, 0, 3, 7, 10][Math.floor(p / 2)], t, step * 1.7, .018, 'strings');
      if (p === 0 || p === 8 || p === 11) scoreDrum('kick', t, .29); if (p === 4 || p === 12) scoreDrum('snare', t, .19); scoreDrum('hat', t, p % 2 ? .025 : .044);
      if (bar % 2 === 1 && p >= 13) scoreDrum('tom', t, .1 + (p - 13) * .045);
      if (p === 0) { scoreNote(rootN + 24, t, step * 6, .036, 'brass'); scoreNote(rootN + 31, t, step * 6, .022, 'brass'); }
      if (bar >= 4 && p % 4 === 2) scoreNote(rootN + 24 + [7, 10, 12, 5][Math.floor(p / 4)], t, step * 2.6, .025, 'brass');
    } else if (mode === 'search') {
      const rootN = [40, 38, 36, 35][Math.floor(b / 32) % 4]; if (b % 4 === 0) scoreNote(rootN + (b % 8 === 4 ? 7 : 0), t, .35, .13, 'bass'); if (b % 4 === 2) scoreDrum('hat', t, .018); if (b % 16 === 0) scoreDrum('tom', t, .11); if (b % 32 === 0) { scoreNote(rootN + 19, t, 2.4, .036, 'pad'); scoreNote(rootN + 24, t, 2.5, .025, 'pad'); }
    } else {
      const rootN = [40, 36, 43, 38][Math.floor(b / 64) % 4]; if (b % 16 === 0) scoreNote(rootN, t, 1.8, .075, 'bass'); if (b % 32 === 0) { scoreNote(rootN + 19, t, 3.4, .029, 'pad'); scoreNote(rootN + 24, t, 3.4, .020, 'pad'); } if (mode === 'stealth' && b % 8 === 4) scoreNote(rootN + 31, t, .8, .013, 'strings');
    }
  }
}

// ------------------------------------------------------------------ the radio (codec) and voices
let callSerial = 0, voiceUtterance = null, voiceLineDone = false, voiceBusy = false, voiceSpeaking = false, radioClosing = false, voicePlaybackSerial = 0, callReady = false, voiceMethod = 'text', portraitLast = 0;
let callKind = 'normal', radioReturn = 'play', archiveReturn = 'title', historyAuto = true, radioPaused = false, historyUIIndex = -1;
let historyProgress = { unlocked: false, index: 0, completed: false };
{ const p = store.get(ARCHIVE_KEY); if (p && typeof p === 'object') historyProgress = { unlocked: !!p.unlocked, index: clamp(p.index | 0, 0, HISTORY.lines.length - 1), completed: !!p.completed }; }
function saveHistory() { store.set(ARCHIVE_KEY, historyProgress); }
// Warm up the speech voice list: some browsers fill it in only after a first request.
if ('speechSynthesis' in window) { try { speechSynthesis.getVoices(); speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices()); } catch { /* speech not available */ } }
function voiceStatus(text, progress = null) { $('voice-status').textContent = text; $('voice-progress').style.width = progress === null ? '24%' : clamp(progress, 0, 100) + '%'; $('voice-progress').classList.toggle('indeterminate', progress === null); }
function stopVoice() { voicePlaybackSerial++; voiceSpeaking = false; voiceLineDone = false; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } voiceUtterance = null; }
function disconnectRadio(next = 'play') {
  if (radioClosing) return;
  rememberHistory(radioIndex >= radioData.length); radioClosing = true; callSerial++; stopVoice(); callReady = false; voiceBusy = true;
  $('voice-link').classList.remove('hidden'); $('voice-choice').classList.add('hidden'); voiceStatus('Closing secure channel.', null);
  setTimeout(() => { radioClosing = false; voiceBusy = false; radioPaused = false; state = next; showScreen(screenFor[next] || ''); }, 220);
}
function beginRadioLink() {
  callSerial++; stopVoice(); callReady = false; voiceBusy = true; voiceMethod = opts.voice; radioClosing = false; radioPaused = false;
  $('voice-link').classList.remove('hidden'); $('voice-choice').classList.remove('hidden');
  $('voice-link').querySelector('.link-title').textContent = 'INCOMING TRANSMISSION';
  updateRadio(); const id = callSerial;
  if (opts.voice === 'system') { voiceStatus('Opening channel with device voices.', null); setTimeout(() => { if (id === callSerial && !callReady) useDeviceVoice(); }, 400); }
  else if (opts.voice === 'text') { voiceStatus('Opening text channel.', null); setTimeout(() => { if (id === callSerial && !callReady) useTextVoice(); }, 350); }
  else voiceStatus('Device voices read the call aloud with the speech engine of your browser. Text only shows the words. You can change this in System settings.', 0);
  focusScreen();
}
function useDeviceVoice() { if (state !== 'codec' || radioClosing) return; opts.voice = 'system'; storeOpts(); voiceMethod = 'system'; activateRadio(); }
function useTextVoice() { if (state !== 'codec' || radioClosing) return; opts.voice = 'text'; storeOpts(); voiceMethod = 'text'; activateRadio(); }
function activateRadio() {
  if (state !== 'codec' || radioClosing) return;
  voiceBusy = false; callReady = true; $('voice-link').classList.add('hidden');
  $('voice-engine-state').textContent = voiceMethod === 'system' ? 'DEVICE VOICES / QUALITY DEPENDS ON YOUR BROWSER' : 'TEXT CHANNEL / VOICES OFF';
  radioChar = 0; playRadioLine(); input.settle();
}
function testRadioVoices() {
  if (state === 'codec') return; const back = state; startAudio();
  openRadio([['MARA', 'Voice check. Rook, the channel is open. The food ledger is ready.'], ['ROOK', 'I hear you. The signal is clear. Nobody touches the soup.']]);
  radioReturn = back;
}
function deviceSpeak(line) {
  if (!('speechSynthesis' in window)) { voiceLineDone = true; $('voice-engine-state').textContent = 'No device voice is available. Text remains active.'; return; }
  const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)), male = /david|daniel|mark|george|guy|ryan|james|male/i, female = /zira|samantha|aria|jenny|susan|hazel|emma|female/i;
  const selected = all.find((v) => (line[0] === 'ROOK' ? male : female).test(v.name)) || all[line[0] === 'ROOK' ? 0 : Math.min(1, all.length - 1)];
  const u = new SpeechSynthesisUtterance(line[1]); u.lang = selected?.lang || 'en-US'; if (selected) u.voice = selected; u.rate = line[0] === 'ROOK' ? .9 : .97; u.pitch = line[0] === 'ROOK' ? .8 : 1.04; u.volume = clamp(opts.volume * opts.voiceVolume, 0, 1);
  const serial = voicePlaybackSerial;
  u.onstart = () => { if (serial === voicePlaybackSerial) voiceSpeaking = true; };
  u.onend = () => { if (serial === voicePlaybackSerial) { voiceSpeaking = false; voiceLineDone = true; } };
  u.onerror = () => { if (serial === voicePlaybackSerial) { voiceSpeaking = false; voiceLineDone = true; $('voice-engine-state').textContent = 'Device voice is not available. Text remains active.'; } };
  // Keep a reference: some browsers drop the end event of an utterance that was garbage-collected.
  voiceUtterance = u; voiceLineDone = false; speechSynthesis.speak(u);
  setTimeout(() => { if (serial === voicePlaybackSerial && !voiceSpeaking && !speechSynthesis.speaking) voiceLineDone = true; }, 3000);
}
function playRadioLine() {
  if (!callReady || radioClosing) return; stopVoice(); const line = radioData[radioIndex]; if (!line) return;
  voiceBusy = false; voiceLineDone = false; radioElapsed = 0; updateRadio(); if (radioPaused) return;
  if (voiceMethod === 'system') deviceSpeak(line); else voiceLineDone = true;
}
function codecHint() {
  const last = radioIndex === radioData.length - 1;
  if (input.source === 'gamepad') return (last ? 'A — END CALL' : 'A — NEXT') + '   ◀ ▶ — LINE   ' + (callKind === 'history' ? 'LB / RB — CHAPTER   ' : '') + 'X — PAUSE   Y — AUTO   B — CLOSE';
  if (input.source === 'touch') return (last ? 'TAP THE TEXT — END CALL' : 'TAP THE TEXT — NEXT LINE') + '   ·   CLOSE BELOW';
  return (last ? 'ENTER — END CALL' : 'ENTER — REVEAL / NEXT LINE') + '   ← → — LINE   ' + (callKind === 'history' ? 'PG UP / DN — CHAPTER   ' : '') + 'P — PAUSE   TAB — CLOSE';
}
function updateRadio() {
  const line = radioData[radioIndex]; if (!line) return;
  $('codec-speaker').textContent = line[0] + ' / ' + (line[0] === 'ROOK' ? 'FIELD AGENT' : 'MISSION CONTROL');
  $('codec-text').textContent = line[1].slice(0, Math.floor(radioChar));
  $('codec-hint').textContent = codecHint();
  $('call-page').textContent = String(radioIndex + 1).padStart(3, '0') + ' / ' + String(radioData.length).padStart(3, '0');
  $('rook-portrait').classList.toggle('speaking', line[0] === 'ROOK'); $('mara-portrait').classList.toggle('speaking', line[0] === 'MARA'); updateHistoryUI();
}
function advanceRadio() {
  if (voiceBusy || !callReady || radioClosing) return; const line = radioData[radioIndex]; if (!line) return;
  if (radioChar < line[1].length) { radioChar = line[1].length; updateRadio(); return; }
  stopVoice(); radioIndex++;
  if (radioIndex >= radioData.length) { rememberHistory(true); setMode(radioReturn); sfx('select'); return; }
  radioChar = 0; radioElapsed = 0; historyUIIndex = -1; rememberHistory(); playRadioLine(); tone(440, .025, 'square', .025);
}
const portraits = {};
function loadPortrait(canvas, who) { const img = new Image(); img.decoding = 'async'; img.onload = () => { portraits[who] = img; drawPortrait(canvas, who, 0); }; img.src = 'portraits/' + who + '.jpg'; }
function drawPortrait(canvas, who, level = 0) {
  const img = portraits[who]; if (!img) return; const q = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const active = state === 'codec' && radioData[radioIndex]?.[0] === (who === 'rook' ? 'ROOK' : 'MARA');
  q.clearRect(0, 0, w, h); q.fillStyle = '#061410'; q.fillRect(0, 0, w, h); q.globalAlpha = active ? 1 : .69; q.drawImage(img, 0, 0, w, h); q.globalAlpha = 1;
  // Subtle analogue brightness pulses, not a pretend 3D face animation.
  if (active && voiceSpeaking) { q.fillStyle = `rgba(144,220,167,${Math.min(.09, level * .1 + .012)})`; q.fillRect(0, 0, w, h); }
  q.fillStyle = '#0015081b'; for (let y = 0; y < h; y += 4) q.fillRect(0, y, w, 1); q.strokeStyle = active ? '#a7cd91' : '#385c48'; q.lineWidth = 2; q.strokeRect(1, 1, w - 2, h - 2);
}
function tickRadioFX() {
  if (state !== 'codec') return;
  const level = voiceSpeaking ? .25 + Math.sin(worldTime * 12) * .18 : 0;
  if (worldTime - portraitLast > .065) {
    portraitLast = worldTime; drawPortrait(E('rook-portrait'), 'rook', level); drawPortrait(E('mara-portrait'), 'mara', level);
    const bars = E('radio-bars').children; for (let i = 0; i < bars.length; i++) bars[i].style.height = (4 + (voiceSpeaking ? Math.abs(Math.sin(i * .7 + worldTime * 16)) * level * 80 : Math.sin(i * .65 + worldTime) * 4 + 5)).toFixed(1) + 'px';
  }
  const line = radioData[radioIndex];
  if (autoCall() && callReady && !voiceBusy && !radioClosing && !radioPaused && voiceLineDone && line && radioChar >= line[1].length && radioElapsed > (voiceMethod === 'text' ? Math.max(2, line[1].split(/\s+/).length / 145 * 60) : 1) + .65) advanceRadio();
}
function rememberHistory(complete = false) {
  if (callKind !== 'history') return;
  historyProgress.unlocked = true; historyProgress.index = clamp(radioIndex, 0, HISTORY.lines.length - 1); if (complete) historyProgress.completed = true; saveHistory();
}
function autoCall() { return callKind === 'history' ? historyAuto : opts.autoRadio; }
function openHistoryRadio(index = 0, back = null) {
  if (state === 'codec' || radioClosing) return;
  historyProgress.unlocked = true; callKind = 'history'; historyAuto = true; radioPaused = false;
  radioReturn = back || (['title', 'pause', 'win'].includes(state) ? state : 'play');
  radioData = HISTORY.lines; radioIndex = clamp(index | 0, 0, radioData.length - 1); radioChar = 0; radioElapsed = 0; radioPending = false; historyUIIndex = -1;
  rememberHistory(); setMode('codec'); sfx('radio'); beginRadioLink();
}
function openRadio(data = null) {
  if (state === 'codec' || radioClosing) return;
  callKind = 'normal'; radioReturn = fieldActive ? 'play' : 'title'; radioPaused = false; historyUIIndex = -1;
  if (!data) {
    const E2 = promptOf('use'), F = promptOf('knock'), W = promptOf('walk'), C = promptOf('crouch');
    if (alertMode === 'alert' || alertMode === 'evasion') data = [['MARA', 'Break line of sight. Get behind a container, then change direction. They will search your last position. The cargo is food. Their rifles are not.'], ['MARA', 'Do not use the box in front of a guard. Get clear first. The radar returns when the alert ends.']];
    else if (stage === 0) data = [['MARA', 'The west office holds the keycard. Move north along the west edge. Enter the office from its east side. The freight labels say MSG: monosodium glutamate. Ordinary seasoning. Unusual security.'], ['ROOK', 'A food warehouse with a military budget.'], ['MARA', 'We need the ledger, not the cargo. Hold ' + W + ' to walk. Press ' + C + ' to crouch. Use ' + F + ' to draw a guard away. Every guard carries a dog tag. Put one to sleep and ' + E2 + ' takes it.']];
    else if (stage === 1 && !doorOpen) data = [['MARA', 'Use the card at the north gate. The second room holds the food-allocation server. The terminal is in its northeast corner.'], ['MARA', 'Hold ' + E2 + ' there. First copy the ledger. Then upload the release command. Stay at the terminal until both steps are complete. I will call you when the file arrives.']];
    else if (stage === 1) data = [['MARA', 'Two guards patrol the second room. A camera covers the northwest corner. The server racks block sight.'], ['ROOK', 'I see a terminal and a soup bowl.'], ['MARA', 'Hold ' + E2 + ' at the terminal. Copy the evidence, then release the blocked shipments. You cannot transfer during an active pursuit. Do not damage the food.']];
    else data = [['MARA', 'The evidence is copied. The local food holds are released. Reach the boat at the southeast dock. The full MSG transmission is in the pause-menu archive.'], ['ROOK', 'If the boat has a radio, remove it.'], ['MARA', 'Lose contact with the patrols, then press ' + E2 + ' at the boat. The history can wait. People are waiting for those trucks.']];
  }
  radioData = data; radioIndex = 0; radioChar = 0; radioElapsed = 0; radioPending = false; setMode('codec'); sfx('radio'); beginRadioLink();
}
function jumpRadio(index) { if (radioClosing) return; stopVoice(); radioIndex = clamp(index | 0, 0, radioData.length - 1); radioChar = 0; radioElapsed = 0; historyUIIndex = -1; rememberHistory(); updateRadio(); if (callReady) playRadioLine(); }
function changeChapter(delta) { if (callKind !== 'history') return; const ci = HISTORY.lines[radioIndex][3], c = HISTORY.chapters[clamp(ci + delta, 0, HISTORY.chapters.length - 1)]; jumpRadio(c.start); }
function toggleCallPause() {
  if (!callReady || radioClosing) return;
  radioPaused = !radioPaused; if (radioPaused) stopVoice(); else playRadioLine();
  $('call-pause').textContent = radioPaused ? 'Resume line' : 'Pause';
  $('voice-engine-state').textContent = radioPaused ? 'PLAYBACK PAUSED / RESUME REPLAYS THIS LINE' : voiceMethod === 'system' ? 'DEVICE VOICE' : 'TEXT CHANNEL';
}
function toggleCallAuto() { if (callKind === 'history') historyAuto = !historyAuto; else { opts.autoRadio = !opts.autoRadio; storeOpts(); } historyUIIndex = -1; updateHistoryUI(); }
function sourceLinks(ids) {
  const f = document.createDocumentFragment();
  for (const id of (ids || '').split(' ').filter(Boolean)) { const s = HISTORY.sources[id]; if (!s) continue; const a = document.createElement('a'); a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = id + ' / ' + s.title; a.title = s.note; f.appendChild(a); }
  return f;
}
function updateHistoryUI() {
  const history = callKind === 'history'; $('codec').classList.toggle('long-call', history); $('history-nav').classList.toggle('hidden', !history);
  $('codec-auto').textContent = autoCall() ? 'AUTO ADVANCE: ON' : 'AUTO ADVANCE: OFF'; $('call-pause').textContent = radioPaused ? 'Resume line' : 'Pause'; $('call-previous').disabled = radioIndex === 0;
  if (historyUIIndex === radioIndex) return; historyUIIndex = radioIndex;
  const line = radioData[radioIndex]; if (!line) return; $('call-source').replaceChildren();
  if (history) {
    const ci = line[3], ch = HISTORY.chapters[ci]; $('history-chapter').value = String(ci);
    $('chapter-caption').textContent = ch.subtitle + ' / ' + String(ci + 1).padStart(2, '0') + ' OF 20';
    $('history-prev').disabled = ci === 0; $('history-next').disabled = ci === HISTORY.chapters.length - 1;
    $('history-progress').style.width = ((radioIndex + 1) / radioData.length * 100) + '%';
    $('history-status').textContent = 'THE LONG AFTERTASTE / 8,214 WORDS / ABOUT 57 MIN AT 145 WORDS/MIN';
    if (line[2]) $('call-source').append(sourceLinks(line[2])); else $('call-source').textContent = 'ORIGINAL FICTION / 2037. Real food producers are not the enemy.';
  } else $('call-source').textContent = 'ORIGINAL FICTION / FIELD CHANNEL';
}
function openArchive() {
  const from = state === 'codec' ? radioReturn : state;
  if (!historyProgress.unlocked) { toast('ARCHIVE LOCKED. COMPLETE THE TRANSFER IN THE SECOND ROOM.', 4); return; }
  archiveReturn = from;
  $('archive-chapter').value = String(HISTORY.lines[historyProgress.index][3]); renderArchiveChapter();
  $('archive-resume').textContent = historyProgress.completed ? 'Replay final chapter' : 'Resume saved line ' + (historyProgress.index + 1);
  setMode('archive');
}
function renderArchiveChapter() {
  const ci = clamp(Number($('archive-chapter').value) || 0, 0, HISTORY.chapters.length - 1), ch = HISTORY.chapters[ci];
  $('archive-caption').textContent = ch.subtitle + ' / ' + ch.words + ' words';
  const transcript = $('archive-transcript'); transcript.replaceChildren();
  for (let i = ch.start; i < ch.end; i++) {
    const line = HISTORY.lines[i], p = document.createElement('p'), b = document.createElement('b'); b.textContent = line[0] + ' / '; p.appendChild(b); p.appendChild(document.createTextNode(line[1]));
    if (line[2]) { const refs = document.createElement('span'); refs.className = 'transcript-refs'; refs.appendChild(sourceLinks(line[2])); p.appendChild(refs); }
    transcript.appendChild(p);
  }
  transcript.scrollTop = 0;
}
function downloadTranscript() {
  let text = 'MSG — THE LONG AFTERTASTE\nOriginal fiction plus a sourced history of MSG.\nResearch checked: ' + HISTORY.researchDate + '. Fiction set in 2037.\n\n';
  for (const c of HISTORY.chapters) { text += '\n' + c.title + '\n' + c.subtitle + '\n\n'; for (const line of HISTORY.lines.slice(c.start, c.end)) text += line[0] + ': ' + line[1] + (line[2] ? ' [' + line[2] + ']' : '') + '\n\n'; }
  text += '\nSOURCES\n'; for (const [id, s] of Object.entries(HISTORY.sources)) text += '\n' + id + ' — ' + s.title + '\n' + s.url + '\n' + s.note + '\n';
  const u = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), a = document.createElement('a'); a.href = u; a.download = 'MSG_The_Long_Aftertaste_Transcript.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
}

// ------------------------------------------------------------------ rendering on three.js
const scene = new THREE.Scene();
const camera3 = kit.fitCamera(new THREE.PerspectiveCamera(35, 1, .1, 240));
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const cubeFaces = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [3, 7, 6, 2], [0, 1, 5, 4]];
const geoCache = new Map(), triangleCache = new Map();
function localMatrix(n) {
  const { x: ax, y: ay, z: az } = n.rotation, cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az), s = n.scale;
  return [cy * cz * s.x, -cy * sz * s.y, sy * s.z, n.position.x, (sx * sy * cz + cx * sz) * s.x, (-sx * sy * sz + cx * cz) * s.y, -sx * cy * s.z, n.position.y, (-cx * sy * cz + sx * sz) * s.x, (cx * sy * sz + sx * cz) * s.y, cx * cy * s.z, n.position.z];
}
function mul(a, b) { return [a[0] * b[0] + a[1] * b[4] + a[2] * b[8], a[0] * b[1] + a[1] * b[5] + a[2] * b[9], a[0] * b[2] + a[1] * b[6] + a[2] * b[10], a[0] * b[3] + a[1] * b[7] + a[2] * b[11] + a[3], a[4] * b[0] + a[5] * b[4] + a[6] * b[8], a[4] * b[1] + a[5] * b[5] + a[6] * b[9], a[4] * b[2] + a[5] * b[6] + a[6] * b[10], a[4] * b[3] + a[5] * b[7] + a[6] * b[11] + a[7], a[8] * b[0] + a[9] * b[4] + a[10] * b[8], a[8] * b[1] + a[9] * b[5] + a[10] * b[9], a[8] * b[2] + a[9] * b[6] + a[10] * b[10], a[8] * b[3] + a[9] * b[7] + a[10] * b[11] + a[11]]; }
function geometryData(n) {
  const d = n.data; if (n.type === 'custom') return { vs: d.vs, fs: d.fs };
  const key = n.type + JSON.stringify([d.w, d.h, d.d, d.r, d.segments, d.width]); if (geoCache.has(key)) return geoCache.get(key); let vs = [], fs = [];
  if (n.type === 'box') { const x = d.w / 2, y = d.h / 2, z = d.d / 2; vs = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]; fs = cubeFaces; }
  else if (n.type === 'cylinder') { const s = d.segments || 12; for (const y of [-d.h / 2, d.h / 2]) for (let i = 0; i < s; i++) { const a = i / s * TAU; vs.push([Math.sin(a) * d.r, y, Math.cos(a) * d.r]); } for (let i = 0; i < s; i++) fs.push([i, (i + 1) % s, (i + 1) % s + s, i + s]); fs.push(Array.from({ length: s }, (_, i) => s - 1 - i)); fs.push(Array.from({ length: s }, (_, i) => s + i)); }
  else if (n.type === 'plane') { vs = [[-d.w / 2, 0, d.d / 2], [d.w / 2, 0, d.d / 2], [d.w / 2, 0, -d.d / 2], [-d.w / 2, 0, -d.d / 2]]; fs = [[0, 1, 2, 3]]; }
  else if (n.type === 'sign') { vs = [[-d.w / 2, -d.h / 2, 0], [d.w / 2, -d.h / 2, 0], [d.w / 2, d.h / 2, 0], [-d.w / 2, d.h / 2, 0]]; fs = [[0, 1, 2, 3]]; }
  else if (n.type === 'disc') { for (let i = 0; i < 32; i++) { const a = i / 32 * TAU; vs.push([Math.sin(a) * d.r, 0, Math.cos(a) * d.r]); } fs = [vs.map((_, i) => i)]; }
  else if (n.type === 'ring') { const s = 32; for (const rad of [d.r, Math.max(0, d.r - (d.width || .022))]) for (let i = 0; i < s; i++) { const a = i / s * TAU; vs.push([Math.sin(a) * rad, 0, Math.cos(a) * rad]); } for (let i = 0; i < s; i++) fs.push([i, (i + 1) % s, (i + 1) % s + s, i + s]); }
  else if (n.type === 'dish') { vs = [[0, -.5, 0]]; for (let j = 1; j < 5; j++) for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = j / 4 * d.r; vs.push([Math.sin(a) * r, -.5 + (j / 4) ** 2 * .95, Math.cos(a) * r]); } for (let i = 0; i < 24; i++) fs.push([0, 1 + i, 1 + (i + 1) % 24]); for (let j = 0; j < 3; j++) for (let i = 0; i < 24; i++) { const a = 1 + j * 24 + i, b = 1 + j * 24 + (i + 1) % 24; fs.push([a, b, b + 24, a + 24]); } }
  const out = { vs, fs }; geoCache.set(key, out); return out;
}
// Flat-shaded triangles: position, face normal and a planar UV that repeats on long surfaces.
function triangleData(n) {
  if (triangleCache.has(n.id)) return triangleCache.get(n.id);
  const d = n.data, gd = geometryData(n), out = [];
  for (const face of gd.fs) {
    if (face.length < 3) continue;
    const p = face.map((i) => gd.vs[i]); const a = p[1].map((v, i) => v - p[0][i]), b = p[2].map((v, i) => v - p[0][i]);
    let norm = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...norm) || 1; norm = norm.map((v) => v / l);
    const dominant = Math.abs(norm[0]) > .65 ? 0 : Math.abs(norm[1]) > .65 ? 1 : 2;
    const axes = dominant === 0 ? [2, 1] : dominant === 1 ? [0, 2] : [0, 1]; const lo = axes.map((k) => Math.min(...p.map((v) => v[k]))), hi = axes.map((k) => Math.max(...p.map((v) => v[k])));
    let rep = [1, 1]; if (d.tex && !['net', 'glow', 'snowmask', 'puddle', 'crate'].includes(d.tex)) rep = axes.map((k, i) => Math.max(1, (hi[i] - lo[i]) / (d.tex === 'asphalt' ? 7 : d.tex === 'metal' ? 3 : d.tex === 'snow' ? 5 : 4)));
    for (let i = 1; i < face.length - 1; i++) for (const j of [0, i, i + 1]) { const pos = p[j]; const uv = axes.map((k, ii) => (pos[k] - lo[ii]) / (hi[ii] - lo[ii] || 1) * rep[ii]); if (n.type === 'plane') uv[1] = rep[1] - uv[1]; out.push(pos[0], pos[1], pos[2], norm[0], norm[1], norm[2], uv[0], uv[1]); }
  }
  const f = new Float32Array(out); triangleCache.set(n.id, f); return f;
}
const TRANSPARENT_TEX = ['glow', 'snowmask', 'puddle'];
const isTransparent = (d) => (d.opacity !== undefined && d.opacity < .99) || TRANSPARENT_TEX.includes(d.tex) || !!d.canvas;
// Opaque untextured parts share one vertex-coloured material; everything else is grouped by look.
const tmpColor = new THREE.Color();
function appendNode(sets, n, m) {
  const d = n.data, op = n.opacity, trans = op < .99 || TRANSPARENT_TEX.includes(d.tex) || !!d.canvas;
  const kind = !trans && !d.tex && !d.canvas && !d.alphaTest ? (d.unlit ? 'vcu' : 'vc') : 'key';
  const key = kind === 'key' ? 'k/' + [d.color, d.tex || '', op, d.unlit ? 1 : 0, d.alphaTest || 0, d.canvas ? d.canvasKey : ''].join('/') : kind;
  let s = sets.get(key);
  if (!s) { s = { kind, d: kind === 'key' ? { ...d, opacity: op } : null, pos: [], nor: [], uv: [], col: kind === 'key' ? null : [] }; sets.set(key, s); }
  const src = triangleData(n);
  const sx = Math.hypot(m[0], m[4], m[8]) || 1, sy = Math.hypot(m[1], m[5], m[9]) || 1, sz = Math.hypot(m[2], m[6], m[10]) || 1;
  if (s.col) tmpColor.setHex(d.color ?? 0xffffff);
  for (let i = 0; i < src.length; i += 8) {
    const x = src[i], y = src[i + 1], z = src[i + 2], nx = src[i + 3] / (sx * sx), ny = src[i + 4] / (sy * sy), nz = src[i + 5] / (sz * sz);
    const a = m[0] * nx + m[1] * ny + m[2] * nz, b = m[4] * nx + m[5] * ny + m[6] * nz, c = m[8] * nx + m[9] * ny + m[10] * nz, l = Math.hypot(a, b, c) || 1;
    s.pos.push(m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7], m[8] * x + m[9] * y + m[10] * z + m[11]);
    s.nor.push(a / l, b / l, c / l); s.uv.push(src[i + 6], src[i + 7]);
    if (s.col) s.col.push(tmpColor.r, tmpColor.g, tmpColor.b);
  }
}
function collectTree(n, parent, sets) { if (!n.visible) return; const m = mul(parent, localMatrix(n)); if (n.type !== 'group') appendNode(sets, n, m); for (const child of n.children) collectTree(child, m, sets); }

// Textures and materials. MODERN keeps smooth, lit materials; CLEAN and PS1 use the original
// vertex-lit look (ported to TSL): nearest textures, and for PS1 snapped vertices, affine
// texture mapping and a 15-bit ordered dither at 240 lines.
const modernTex = new Map(), retroTex = new Map(), matCache = new Map();
const snapGrid = T.uniform(new THREE.Vector2(160, 120));
const SUN = new THREE.Vector3(-24, 40, 20).normalize();
function canvasOf(d) { return d.canvas || makeTexture(d.tex, d.color); }
function texKeyOf(d) { return d.canvas ? 'c:' + d.canvasKey : d.tex + ':' + d.color; }
function modernTexture(d) {
  const k = texKeyOf(d); let t = modernTex.get(k); if (t) return t;
  t = new THREE.CanvasTexture(canvasOf(d)); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  modernTex.set(k, t); return t;
}
function retroTexture(d) {
  const k = texKeyOf(d); let t = retroTex.get(k); if (t) return t;
  t = new THREE.CanvasTexture(canvasOf(d)); t.colorSpace = THREE.NoColorSpace; t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  retroTex.set(k, t); return t;
}
function matKeyOf(d) { return [d.color, d.tex || '', d.opacity ?? 1, d.unlit ? 1 : 0, d.alphaTest || 0, d.canvas ? d.canvasKey : ''].join('/'); }
function materialFor(kind, d) {
  const key = opts.display + '|' + kind + '|' + (kind === 'key' ? matKeyOf(d) : '');
  let m = matCache.get(key); if (m) return m;
  m = opts.display === 'modern' ? modernMaterial(kind, d) : retroMaterial(kind, d);
  matCache.set(key, m); return m;
}
function modernMaterial(kind, d) {
  if (kind === 'vc') return new THREE.MeshLambertNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });
  if (kind === 'vcu') return new THREE.MeshBasicNodeMaterial({ vertexColors: true, side: THREE.DoubleSide });
  if (kind === 'water') { const m = new THREE.MeshLambertNodeMaterial({ color: 0x648a8d, transparent: true, depthWrite: false, side: THREE.DoubleSide }); m.opacityNode = T.attribute('aOpacity', 'float'); return m; }
  const trans = isTransparent(d), textured = !!(d.tex || d.canvas);
  const p = { color: textured ? 0xffffff : d.color, side: THREE.DoubleSide, transparent: trans, opacity: d.opacity ?? 1, depthWrite: !trans };
  if (textured || trans || d.alphaTest) p.alphaTest = d.alphaTest || .008;
  if (textured) p.map = modernTexture(d);
  return d.unlit ? new THREE.MeshBasicNodeMaterial(p) : new THREE.MeshLambertNodeMaterial(p);
}
function retroMaterial(kind, d) {
  const ps1 = opts.display === 'ps1';
  const trans = kind === 'water' || (kind === 'key' && isTransparent(d));
  const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, transparent: trans, depthWrite: !trans, fog: false });
  const textured = kind === 'key' && !!(d.tex || d.canvas);
  const tex = textured ? retroTexture(d) : null;
  const unlit = kind === 'vcu' || (kind === 'key' && !!d.unlit);
  const hex = kind === 'key' ? (textured ? 0xffffff : d.color) : kind === 'water' ? 0x648a8d : 0xffffff;
  const base = T.vec3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  const opacity = kind === 'water' ? T.attribute('aOpacity', 'float') : T.float(kind === 'key' ? (d.opacity ?? 1) : 1);
  const cut = kind === 'key' ? Math.max(.008, d.alphaTest || 0) : .008;
  let uvNode = T.uv();
  if (ps1 && tex) {
    // Affine texture mapping: interpolate uv·w and w, then divide per pixel.
    const w = T.varying(T.modelViewProjection.w);
    uvNode = T.varying(T.uv().mul(T.modelViewProjection.w)).div(T.max(w, 1e-5));
  }
  m.colorNode = T.Fn(() => {
    const t = tex ? T.texture(tex, uvNode) : T.vec4(1, 1, 1, 1);
    const a = t.a.mul(opacity);
    T.If(a.lessThan(cut), () => { T.Discard(); });
    let col = t.rgb.mul(base);
    if (kind === 'vc' || kind === 'vcu') col = col.mul(T.sRGBTransferOETF(T.vertexColor().rgb));
    if (!unlit) {
      const n = T.normalWorldGeometry;
      const sun = T.dot(n, T.vec3(SUN.x, SUN.y, SUN.z)).max(0);
      const light = T.mix(T.vec3(.48, .56, .65), T.vec3(.73, .82, .90), T.clamp(n.y.mul(.5).add(.5), 0, 1)).add(T.vec3(.57, .58, .55).mul(sun));
      col = col.mul(light);
    }
    col = T.clamp(col, 0, 1);
    if (ps1) col = dither15(T.vec4(col, 1)).rgb;
    // The original drew these values straight to the screen; linearise so the output transform restores them.
    return T.vec4(T.sRGBTransferEOTF(col), a);
  })();
  if (ps1) vertexSnap(m, { grid: snapGrid });
  return m;
}

const profiled = [], modernOnly = [], dynamicNodes = [], fadeWalls = [], lampLights = [];
let hemi = null, sun = null, fog = null, snow = null, water = null;
const ORDER_DYNAMIC = 500, ORDER_CONE = 600, ORDER_FX = 700, ORDER_SNOW = 800;
function geometryFromSet(s) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
  if (s.col) g.setAttribute('color', new THREE.Float32BufferAttribute(s.col, 3));
  g.computeBoundingSphere(); return g;
}
function meshFromSet(s, order) {
  const mesh = new THREE.Mesh(geometryFromSet(s), materialFor(s.kind, s.d));
  mesh.userData.kind = s.kind; mesh.userData.d = s.d; profiled.push(mesh);
  const trans = s.kind === 'key' && isTransparent(s.d);
  mesh.castShadow = !trans; mesh.receiveShadow = true; if (trans) mesh.renderOrder = order;
  if (s.kind === 'key' && (s.d.tex === 'glow' || s.d.tex === 'puddle')) modernOnly.push(mesh);
  return mesh;
}
// A moving node becomes a group; its rigid mesh children are merged into it, jointed ones nest.
function buildDynamic(n) {
  const holder = new THREE.Group(); n.object = holder; dynamicNodes.push(n);
  const sets = new Map();
  if (n.type !== 'group') appendNode(sets, n, IDENT);
  for (const c of n.children) {
    if (c.type === 'group' || c.own || c.children.length) holder.add(buildDynamic(c));
    else if (c.visible) appendNode(sets, c, localMatrix(c));
  }
  for (const s of sets.values()) holder.add(meshFromSet(s, ORDER_DYNAMIC));
  if (n.data.fadeInside) { const mesh = holder.children[0]; fadeWalls.push({ node: n, mesh, faded: false, solid: mesh.userData.d, glass: { ...mesh.userData.d, opacity: .16 } }); }
  syncNode(n); return holder;
}
function syncNode(n) { const o = n.object; o.visible = n.visible; o.position.set(n.position.x, n.position.y, n.position.z); o.rotation.set(n.rotation.x, n.rotation.y, n.rotation.z); o.scale.set(n.scale.x, n.scale.y, n.scale.z); }
function buildWater(nodes) {
  const pos = [], nor = [], uv = [], op = [], phase = [];
  for (const a of nodes) { const n = a.node, src = triangleData(n); for (let i = 0; i < src.length; i += 8) { pos.push(src[i] + n.position.x, src[i + 1] + n.position.y, src[i + 2] + n.position.z); nor.push(src[i + 3], src[i + 4], src[i + 5]); uv.push(src[i + 6], src[i + 7]); op.push(n.opacity); phase.push(a.phase); } }
  const g = new THREE.BufferGeometry(); const posAttr = new THREE.Float32BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', posAttr); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aOpacity', new THREE.Float32BufferAttribute(op, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(-38, -.81, -2), 60);
  const mesh = new THREE.Mesh(g, materialFor('water', null)); mesh.userData.kind = 'water'; mesh.userData.d = null; mesh.renderOrder = 5; mesh.receiveShadow = true; profiled.push(mesh); scene.add(mesh);
  return { mesh, attr: posAttr, baseX: Float32Array.from(pos.filter((_, i) => i % 3 === 0)), phase: Float32Array.from(phase) };
}
function makeConeMesh(cone) {
  const g = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(new Float32Array(60), 3); attr.setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', attr);
  const idx = []; for (let i = 1; i < 19; i++) idx.push(0, i, i + 1); g.setIndex(idx); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const mat = new THREE.MeshBasicNodeMaterial({ color: cone.color, transparent: true, opacity: cone.opacity, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = ORDER_CONE; mesh.visible = false; mesh.userData.hex = cone.color;
  cone.mesh = mesh; scene.add(mesh);
}
function syncCone(owner, range, half) {
  const cone = owner.cone, mesh = cone.mesh; mesh.visible = cone.visible; if (!cone.visible) return;
  if (!cone.fresh) conePoints(owner, range, half);
  const arr = mesh.geometry.attributes.position.array, pts = cone.pts;
  for (let i = 0; i < 20; i++) { arr[i * 3] = pts[i * 2]; arr[i * 3 + 1] = .065; arr[i * 3 + 2] = pts[i * 2 + 1]; }
  mesh.geometry.attributes.position.needsUpdate = true;
  if (mesh.userData.hex !== cone.color) { mesh.userData.hex = cone.color; mesh.material.color.setHex(cone.color); }
  mesh.material.opacity = cone.opacity;
}
// Short-lived shot tracers and sparks come from small pools.
const tracers = [], sparkPool = [], sparkMats = new Map(); let sparkGeo = null;
function buildEffects() {
  for (let i = 0; i < 10; i++) {
    const g = new THREE.BufferGeometry(); const attr = new THREE.BufferAttribute(new Float32Array(12), 3); attr.setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', attr); g.setIndex([0, 1, 2, 0, 2, 3]); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    const m = new THREE.Mesh(g, new THREE.MeshBasicNodeMaterial({ color: 0xc3dcb6, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = ORDER_FX; scene.add(m); tracers.push({ mesh: m, t: 0 });
  }
  sparkGeo = new THREE.BoxGeometry(.07, .07, .07);
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(sparkGeo, sparkMaterial(0xd4d5aa)); m.visible = false; scene.add(m); sparkPool.push({ mesh: m, t: 0, vx: 0, vy: 0, vz: 0 }); }
}
function sparkMaterial(hex) { let m = sparkMats.get(hex); if (!m) { m = new THREE.MeshBasicNodeMaterial({ color: hex }); sparkMats.set(hex, m); } return m; }
function tracer(a, b, color, y = 1.3) {
  let slot = tracers.find((t) => t.t <= 0); if (!slot) slot = tracers.reduce((o, t) => (t.t < o.t ? t : o), tracers[0]);
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, w = .035, px = -dz / l * w, pz = dx / l * w, arr = slot.mesh.geometry.attributes.position.array;
  arr.set([a.x + px, y, a.z + pz, b.x + px, y, b.z + pz, b.x - px, y, b.z - pz, a.x - px, y, a.z - pz]); slot.mesh.geometry.attributes.position.needsUpdate = true;
  slot.mesh.material.color.setHex(color); slot.t = .13; slot.mesh.visible = true;
}
function sparks(x, z, color) {
  const mat = sparkMaterial(color); let made = 0;
  for (const s of sparkPool) { if (s.t > 0) continue; s.t = .25; s.vx = rr(-2, 2); s.vy = rr(1, 3); s.vz = rr(-2, 2); s.mesh.position.set(x, 1.1, z); s.mesh.material = mat; s.mesh.visible = true; if (++made >= 4) break; }
}
function tickEffects(dt) {
  for (const t of tracers) if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.mesh.visible = false; }
  for (const s of sparkPool) if (s.t > 0) { s.t -= dt; s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt; s.vy -= dt * 9; if (s.t <= 0) s.mesh.visible = false; }
}
function clearEffects() { for (const t of tracers) { t.t = 0; t.mesh.visible = false; } for (const s of sparkPool) { s.t = 0; s.mesh.visible = false; } }

function buildScene() {
  scene.background = new THREE.Color(0x293f4d);
  fog = new THREE.Fog(0x293f4d, 70, 160);
  hemi = new THREE.HemisphereLight(0xc6dfec, 0x3e5463, 2.15); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xcbd9db, 2.3); sun.position.set(-24, 40, 20); sun.castShadow = true; kit.shadow(sun, 2048);
  Object.assign(sun.shadow.camera, { left: -39, right: 39, top: 39, bottom: -39, near: 1, far: 150 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .06; sun.shadow.radius = 2;
  scene.add(sun); scene.add(sun.target);
  kit.renderer.shadowMap.enabled = true; kit.renderer.shadowMap.type = THREE.PCFShadowMap;
  for (const l of lamps) { const light = new THREE.PointLight(l.z < -20 ? 0xb9ddd5 : 0xffdb9b, 9, 14, 1.5); light.position.set(l.x, l.height - .4, l.z); scene.add(light); lampLights.push(light); }

  // Which top-level nodes move, as in the original renderer.
  const moving = [officePhoto, player.visual.root, door, card, boat, terminal, extraction, ...guards.map((g) => g.visual.root), ...security.map((c) => c.node), ...pickups.map((p) => p.node), ...animated.filter((a) => a.kind !== 'water').map((a) => a.node), ...root.children.filter((n) => n.data.fadeInside)];
  const dynamicTop = new Set(); for (let n of moving) { if (!n) continue; while (n.parent && n.parent !== root) n = n.parent; dynamicTop.add(n); }
  const waterNodes = animated.filter((a) => a.kind === 'water'), waterSet = new Set(waterNodes.map((a) => a.node));

  const staticSets = new Map();
  for (const n of root.children) if (!dynamicTop.has(n) && !waterSet.has(n)) collectTree(n, IDENT, staticSets);
  let order = 10;
  for (const s of staticSets.values()) scene.add(meshFromSet(s, order++));
  for (const n of dynamicTop) scene.add(buildDynamic(n));
  water = buildWater(waterNodes);
  for (const g of guards) makeConeMesh(g.cone); for (const c of security) makeConeMesh(c.cone);
  buildEffects();

  const count = snowflakes.length, positions = new Float32Array(count * 3);
  snow = createPoints({ positions, size: 1.5, sizeAttenuation: false, material: { color: 0xd6e3e2, transparent: true, opacity: .65, depthWrite: false } });
  snow.object.renderOrder = ORDER_SNOW; snow.setCount(kit.detail(count)); scene.add(snow.object);
  kit.onQuality(() => snow.setCount(kit.detail(count)));
  applyProfile(false);
}
// Switch every material to the display profile's look. Mission state is untouched.
function applyProfile(announce = true) {
  const modern = opts.display === 'modern';
  for (const mesh of profiled) mesh.material = materialFor(mesh.userData.kind, mesh.userData.d);
  for (const w of fadeWalls) { w.mesh.material = materialFor('key', w.faded ? w.glass : w.solid); }
  for (const mesh of modernOnly) mesh.visible = modern;
  scene.fog = modern ? fog : null;
  sun.castShadow = modern && opts.shadows;
  kit.setPixelHeight(opts.display === 'ps1' ? 240 : 0);
  if (announce) toast(displayName() + ' / MISSION STATE KEPT', 2);
}
let snowSize = 0;
function renderWorld() {
  prepareFrame();
  kit.renderer.render(scene, camera3);
  updateWorldLabels();
}
// Everything a frame needs before drawing: camera, moving parts, cones, water and snow.
function prepareFrame() {
  for (const g of guards) g.cone.fresh = false; for (const cam of security) cam.cone.fresh = false;
  updateBasis();
  const c = mainCamera; camera3.position.set(c.x, c.y, c.z); camera3.lookAt(c.tx, c.ty, c.tz);
  camera3.fov = 2 * Math.atan(c.span / (2 * Math.hypot(c.x - c.tx, c.y - c.ty, c.z - c.tz))) * 180 / Math.PI; camera3.updateProjectionMatrix();
  sun.position.set(c.tx - 24, 40, c.tz + 20); sun.target.position.set(c.tx, 0, c.tz);
  for (const w of fadeWalls) w.node.opacity = fieldActive && player.z < -20 ? .16 : 1;
  for (const w of fadeWalls) {
    const want = w.node.opacity < .99; if (want === w.faded) continue; w.faded = want;
    w.mesh.userData.d = want ? w.glass : w.solid; w.mesh.material = materialFor('key', w.mesh.userData.d); w.mesh.castShadow = !want; w.mesh.renderOrder = want ? ORDER_DYNAMIC : 0;
  }
  for (const n of dynamicNodes) syncNode(n);
  for (const g of guards) syncCone(g, 10.2 * run().sight, .62);
  for (const cam of security) syncCone(cam, 10 * run().sight, .48);
  // Water streaks drift, the snow falls (hidden inside the relay building).
  const wa = water.attr.array; for (let i = 0; i < water.baseX.length; i++) wa[i * 3] = water.baseX[i] + Math.sin(worldTime * .2 + water.phase[i]) * .4; water.attr.needsUpdate = true;
  const sp = snow.positions.array; for (let i = 0; i < snowflakes.length; i++) { const f = snowflakes[i]; sp[i * 3] = f.x; sp[i * 3 + 1] = (f.z < -20 && Math.abs(f.x) < 20) ? -9 : f.y; sp[i * 3 + 2] = f.z; } snow.positions.needsUpdate = true;
  const size = 1.5 * Math.max(1, kit.renderer.getPixelRatio()); if (Math.abs(size - snowSize) > .05) { snowSize = size; snow.material.size = size; }
  if (opts.display === 'ps1') snapGrid.value.set(kit.canvas.width / 2, kit.canvas.height / 2);
}

// ------------------------------------------------------------------ settings, display profiles
function displayName() { return { modern: 'MODERN', clean: 'CLEAN / EFFECTS OFF', ps1: 'PS1 FILTER' }[opts.display]; }
function syncSettings() {
  $('volume').value = Math.round(opts.volume * 100);
  for (const [id, k] of [['music-toggle', 'music'], ['crt-toggle', 'crt'], ['cones-toggle', 'cones'], ['shake-toggle', 'shake']]) $(id).textContent = opts[k] ? 'ON' : 'OFF';
  $('view-toggle').textContent = opts.zoom ? 'WIDE' : 'CLOSE'; $('voice-mode').value = opts.voice; $('voice-volume').value = Math.round(opts.voiceVolume * 100); $('music-volume').value = Math.round(opts.musicVolume * 100); $('radio-auto').textContent = opts.autoRadio ? 'ON' : 'OFF';
  const crt = opts.crt && opts.display !== 'clean'; $('scanlines').style.display = crt ? 'block' : 'none'; $('noise').style.display = crt ? 'block' : 'none';
  if (audio.started) { audio.master.gain.setTargetAtTime(opts.volume * .82, audio.ctx.currentTime, .08); audio.musicGain.gain.setTargetAtTime(opts.music ? opts.musicVolume * .6 : 0, audio.ctx.currentTime, .1); }
  if (sun) sun.castShadow = opts.display === 'modern' && opts.shadows;
  syncDisplay(); storeOpts(); updateReadout();
}
function updateReadout() { $('resolution-readout').textContent = kit.canvas.width + ' × ' + kit.canvas.height + ' / ' + kit.backendLabel.toUpperCase() + ' / ' + kit.tier.name.toUpperCase() + ' QUALITY / ' + displayName(); }
function syncDisplay() {
  document.body.dataset.display = opts.display; $('display-mode').value = opts.display;
  const modern = opts.display === 'modern';
  $('shadows-toggle').disabled = !modern; $('shadows-toggle').textContent = modern ? (opts.shadows ? 'ON' : 'OFF') : 'OFF / PROFILE';
  $('crt-toggle').disabled = opts.display === 'clean';
  $('display-note').textContent = opts.display === 'ps1'
    ? '240-line scene. Nearest textures. Snapped vertices. Affine texture mapping. 5-bit colour and ordered dithering. Vertex lighting, no dynamic shadows or fog. A visual approximation, not a PS1 emulator.'
    : opts.display === 'clean'
      ? 'Full scene resolution. Texture smoothing, mipmaps, dynamic shadows, per-pixel lights, fog and screen filters are off. Detailed meshes and simple vertex lighting remain.'
      : 'Smooth textures, lamps, fog and optional dynamic shadows. No change to models or mission speed.';
  $('profile-badge').textContent = displayName();
}
function applyDisplay(mode) {
  if (!['modern', 'clean', 'ps1'].includes(mode) || mode === opts.display) { syncSettings(); return; }
  opts.display = mode; storeOpts(); applyProfile(true); syncSettings();
}
function syncBrief() {
  const d = DIFFICULTY[field.difficulty]; $('difficulty-btn').textContent = d.label; $('difficulty-note').textContent = d.note;
  const unlocked = bandanaUnlocked(); $('bandana-row').classList.toggle('hidden', !unlocked);
  if (!unlocked && field.bandana) { field.bandana = false; storeField(); }
  $('bandana-btn').textContent = field.bandana ? 'ON / SCORE × 0.7' : 'OFF';
}
function syncTitle() {
  const best = readBest(), parts = [];
  for (const k of DIFF_ORDER) if (best[k] && Number.isFinite(best[k].score)) parts.push(DIFFICULTY[k].label + ' ' + best[k].rank + ' ' + best[k].score.toLocaleString());
  $('title-best').textContent = parts.length ? 'BEST / ' + parts.join(' · ') : '';
  $('title-tags').textContent = 'Dog tags ' + tagsOwned.size + ' / ' + TAGS.length;
}
function openTags() {
  overlayReturn = state === 'tags' ? overlayReturn : state;
  const list = $('tag-list'); list.replaceChildren();
  TAGS.forEach((t, i) => {
    const have = tagsOwned.has(i), div = document.createElement('div'); div.className = 'tag-item' + (have ? ' have' : '');
    const b = document.createElement('b'); b.textContent = have ? t.name : '— — — — —'; div.appendChild(b);
    div.appendChild(document.createTextNode(t.post + (have ? ' / ' + t.note : ' / NOT COLLECTED')));
    list.appendChild(div);
  });
  $('tag-summary').textContent = tagsOwned.size + ' OF ' + TAGS.length + ' COLLECTED' + (bandanaUnlocked() ? ' / THE INFINITE-AMMO BANDANA IS UNLOCKED IN THE BRIEFING.' : '.');
  setMode('tags'); sfx('select');
}

// ------------------------------------------------------------------ help screen
const HELP_ROWS = [['Move', 'move'], ['Walk quietly', 'walk'], ['Crouch / stand', 'crouch'], ['Use / takedown / dog tag', 'use'], ['Aim at a visible guard', 'aim'], ['Fire tranquilizer', 'fire'], ['Reload', 'reload'], ['Hide in box', 'box'], ['Knock / make a sound', 'knock'], ['Use medical kit', 'heal'], ['Radio call', 'radio'], ['Full map', 'map'], ['Pause', 'pause'], ['Camera distance', 'view']];
const HELP_EXTRA = {
  keyboard: [['Fire', 'J / LEFT CLICK'], ['Aim with the mouse', 'HOLD RIGHT CLICK'], ['Camera distance', 'V / MOUSE WHEEL']],
  gamepad: [['Aim direction', 'R-STICK WHILE AIMING'], ['Menus', 'D-PAD · A · B']],
  touch: [['Walk quietly', 'PUSH THE STICK HALFWAY'], ['Open the map', 'TAP THE RADAR'], ['Camera distance', 'PINCH']],
};
let helpDevice = 'keyboard';
function renderHelp(device = helpDevice) {
  helpDevice = device; const P = PROMPTS[device];
  const extra = new Map(HELP_EXTRA[device].map(([a, b]) => [a, b]));
  const rows = HELP_ROWS.map(([label, action]) => [label, extra.get(label) || (label === 'Fire tranquilizer' && device === 'keyboard' ? 'J / LEFT CLICK' : P[action])]);
  for (const [label, value] of HELP_EXTRA[device]) if (!HELP_ROWS.some(([l]) => l === label) && label !== 'Fire') rows.push([label, value]);
  const cols = [document.createElement('div'), document.createElement('div')], half = Math.ceil(rows.length / 2);
  rows.forEach(([label, value], i) => { const row = document.createElement('div'); row.className = 'key-row'; const s = document.createElement('span'); s.textContent = label; const k = document.createElement('kbd'); k.textContent = value; row.append(s, k); cols[i < half ? 0 : 1].appendChild(row); });
  $('help-rows').replaceChildren(...cols);
  for (const b of document.querySelectorAll('.help-tab')) b.classList.toggle('active', b.dataset.device === device);
}
function openHelp() { overlayReturn = state; renderHelp(input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' ? 'touch' : 'keyboard'); setMode('help'); sfx('select'); }
function openSettings() { overlayReturn = state; setMode('settings'); syncSettings(); sfx('select'); }
function pauseGame() { if (state === 'play') { setMode('pause'); sfx('select'); } }
function resumePlay() { if (fieldActive) setMode('play'); }
function quitToTitle() { fieldActive = false; setMode('title'); if (checkpoint) $('continue-btn').classList.remove('hidden'); syncTitle(); }

// ------------------------------------------------------------------ menus with keyboard, gamepad and touch
let padFocus = null, navLast = '', navHold = 0, codecNavLast = 0, mapReturn = 'play';
function openMap(from = 'play') { mapReturn = from; setMode('map'); }
function closeMap() { if (mapReturn === 'pause' && fieldActive) setMode('pause'); else resumePlay(); }
function navScope() {
  if (state === 'play') return null;
  if (state === 'codec') { const vl = $('voice-link'); return vl.classList.contains('hidden') ? null : vl; }
  const id = screenFor[state]; return id ? $(id) : null;
}
function navItems(scope) { return [...scope.querySelectorAll('button, select, input[type=range], summary')].filter((el) => !el.disabled && el.offsetParent !== null); }
function setNavFocus(el, fromPad) {
  if (!el) return; if (padFocus && padFocus !== el) padFocus.classList.remove('pad-focus'); padFocus = el;
  el.focus({ preventScroll: true }); el.scrollIntoView?.({ block: 'nearest' }); el.classList.toggle('pad-focus', !!fromPad);
}
function focusScreen() {
  if (padFocus) { padFocus.classList.remove('pad-focus'); padFocus = null; }
  if (input.source === 'touch') return; const scope = navScope(); if (!scope) return;
  const items = navItems(scope); const first = items.find((e) => e.classList.contains('primary')) || items[0];
  if (first) setNavFocus(first, input.source === 'gamepad');
}
function activate(el) {
  if (!el) return;
  if (el.tagName === 'SELECT') { el.selectedIndex = (el.selectedIndex + 1) % el.options.length; el.dispatchEvent(new Event('change', { bubbles: true })); return; }
  if (el.tagName === 'INPUT') return;
  el.click();
}
function adjust(el, dx) {
  if (el.tagName === 'SELECT') { el.selectedIndex = clamp(el.selectedIndex + dx, 0, el.options.length - 1); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  if (el.tagName === 'INPUT' && el.type === 'range') { el.value = clamp(Number(el.value) + dx * 5, Number(el.min) || 0, Number(el.max) || 100); el.dispatchEvent(new Event('input', { bubbles: true })); return true; }
  return false;
}
function menuNav(dt) {
  const scope = navScope(); if (!scope) return;
  const items = navItems(scope); if (!items.length) return;
  const v = input.vector('move'), dy = v.y > .55 ? -1 : v.y < -.55 ? 1 : 0, dx = v.x > .55 ? 1 : v.x < -.55 ? -1 : 0;
  const code = dy ? 'v' + dy : dx ? 'h' + dx : '';
  let go = false;
  if (!code) { navLast = ''; navHold = 0; } else if (code !== navLast) { navLast = code; navHold = .38; go = true; } else { navHold -= dt; if (navHold <= 0) { navHold = .11; go = true; } }
  const pad = input.source === 'gamepad';
  if (go) {
    const el = document.activeElement, i = items.indexOf(el);
    if (!(dx && !dy && i >= 0 && adjust(el, dx))) { const d = dy || dx; setNavFocus(i < 0 ? items[0] : items[(i + d + items.length) % items.length], pad); sfx('empty'); }
    else if (pad) el.classList.add('pad-focus');
  }
  if (input.pressed('confirm')) {
    startAudio(); const el = document.activeElement;
    if (items.includes(el)) activate(el); else activate(scope.querySelector('.button.primary:not(.hidden)') || items[0]);
  }
}
function menuBack() {
  if (state === 'codec') { setMode(radioReturn); return; }
  if (state === 'map') { closeMap(); return; }
  if (state === 'pause') { resumePlay(); return; }
  if (state === 'help' || state === 'settings' || state === 'tags') { setMode(overlayReturn); return; }
  if (state === 'brief') { quitToTitle(); return; }
  if (state === 'archive') { setMode(archiveReturn); return; }
}
function menuInput(dt) {
  if (state === 'codec' && $('voice-link').classList.contains('hidden')) { codecInput(); return; }
  menuNav(dt);
  // The right stick scrolls long pages (the archive transcript, the field manual on small screens).
  const ad = input.vector('aimDir');
  if (Math.abs(ad.y) > .2) { const scope = navScope(), pane = state === 'archive' ? $('archive-transcript') : scope?.querySelector('.modal'); if (pane) pane.scrollTop -= ad.y * 700 * dt; }
  if (input.pressed('back') || input.pressed('pause')) menuBack();
  else if (state === 'map' && input.pressed('map')) closeMap();
  else if (state === 'codec' && input.pressed('radio')) setMode(radioReturn);
}
function codecInput() {
  if (radioClosing) return;
  if (input.pressed('pause') && input.keys.has('KeyP')) { toggleCallPause(); return; }
  if (input.pressed('pause') || input.pressed('back') || input.pressed('radio')) { setMode(radioReturn); return; }
  if (input.pressed('confirm') || input.pressed('use') || input.pressed('aim')) { startAudio(); advanceRadio(); }
  const v = input.vector('move'), dx = v.x > .6 ? 1 : v.x < -.6 ? -1 : 0;
  if (dx !== codecNavLast) { codecNavLast = dx; if (dx > 0) advanceRadio(); else if (dx < 0) jumpRadio(radioIndex - 1); }
  if (input.pressed('pagePrev')) changeChapter(-1); if (input.pressed('pageNext')) changeChapter(1);
  if (input.pressed('reload')) toggleCallPause();
  if (input.pressed('box')) toggleCallAuto();
  if (input.pressed('map')) openArchive();
}
function playInput() {
  for (const a of TAP_ACTIONS) if (input.pressed(a)) tapped.add(a);
  if (input.pressed('pause')) { pauseGame(); return; }
  if (input.pressed('radio')) { openRadio(); return; }
  if (input.pressed('map')) { openMap('play'); return; }
  if (input.pressed('view')) toggleView();
  zoomAccum += input.zoom();
  if (zoomAccum > .6) { zoomAccum = 0; if (opts.zoom) toggleView(); } else if (zoomAccum < -.6) { zoomAccum = 0; if (!opts.zoom) toggleView(); }
}
function toggleView() { opts.zoom = 1 - opts.zoom; storeOpts(); toast(opts.zoom ? 'CAMERA / WIDE' : 'CAMERA / CLOSE', 1); }

function placeTouchTop() {
  if (!kit.touch) return;
  if (innerWidth >= 700) { kit.touch.placeTop('center', 12); return; }
  const r = $('radar-panel').getBoundingClientRect();
  kit.touch.placeTop('center', Math.round(r.height ? r.bottom + 8 : 176));
}

function bindUI() {
  const bind = (id, fn) => $(id).addEventListener('click', () => { startAudio(); fn(); });
  bind('start-btn', newOperation); bind('continue-btn', () => restoreCheckpoint(false)); bind('deploy-btn', deploy);
  bind('title-help', openHelp); bind('brief-help', openHelp); bind('pause-help', openHelp);
  bind('title-settings', openSettings); bind('pause-settings', openSettings); bind('title-tags', openTags); bind('tags-close', () => setMode(overlayReturn));
  bind('help-close', () => setMode(overlayReturn)); bind('settings-close', () => setMode(overlayReturn));
  bind('resume-btn', resumePlay); bind('retry-btn', () => restoreCheckpoint(true)); bind('dead-retry', () => restoreCheckpoint(true)); bind('dead-new', newOperation);
  bind('win-replay', newOperation); bind('win-title', quitToTitle); bind('quit-btn', quitToTitle);
  bind('hud-pause', pauseGame); bind('hud-radio', () => { if (state === 'play') openRadio(); }); bind('radio-toast', () => { if (state === 'play') openRadio(); });
  bind('hud-map', () => { if (state === 'play') openMap('play'); }); bind('radar-panel', () => { if (state === 'play') openMap('play'); }); bind('pause-map', () => { if (fieldActive && state === 'pause') openMap('pause'); });
  bind('map-close', closeMap); bind('codec-hint', advanceRadio); $('codec-text').addEventListener('click', () => { startAudio(); advanceRadio(); });
  for (const b of document.querySelectorAll('.help-tab')) b.addEventListener('click', () => renderHelp(b.dataset.device));
  $('volume').addEventListener('input', (e) => { opts.volume = Number(e.target.value) / 100; syncSettings(); });
  for (const [id, k] of [['music-toggle', 'music'], ['crt-toggle', 'crt'], ['cones-toggle', 'cones'], ['shake-toggle', 'shake']]) bind(id, () => { opts[k] = !opts[k]; syncSettings(); });
  bind('shadows-toggle', () => { opts.shadows = !opts.shadows; syncSettings(); });
  bind('view-toggle', () => { opts.zoom = 1 - opts.zoom; syncSettings(); });
  bind('radio-auto', () => { opts.autoRadio = !opts.autoRadio; syncSettings(); });
  bind('settings-graphics', () => kit.menu.open());
  bind('fullscreen-btn', () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); else document.documentElement.requestFullscreen?.().catch(() => toast('FULL SCREEN IS NOT AVAILABLE', 2)); });
  $('music-volume').addEventListener('input', (e) => { opts.musicVolume = +e.target.value / 100; syncSettings(); });
  $('voice-volume').addEventListener('input', (e) => { opts.voiceVolume = +e.target.value / 100; syncSettings(); });
  $('voice-mode').addEventListener('change', (e) => { opts.voice = ['ask', 'system', 'text'].includes(e.target.value) ? e.target.value : 'ask'; storeOpts(); });
  bind('voice-test', testRadioVoices);
  $('display-mode').addEventListener('change', (e) => applyDisplay(e.target.value));
  // Radio.
  bind('voice-skip', useDeviceVoice); bind('voice-text-only', useTextVoice); bind('radio-exit', () => setMode(radioReturn));
  bind('codec-auto', toggleCallAuto);
  for (const [i, c] of HISTORY.chapters.entries()) for (const id of ['history-chapter', 'archive-chapter']) { const o = document.createElement('option'); o.value = i; o.textContent = String(i + 1).padStart(2, '0') + ' / ' + c.title; $(id).appendChild(o); }
  $('history-chapter').addEventListener('change', (e) => jumpRadio(HISTORY.chapters[+e.target.value].start));
  bind('history-prev', () => changeChapter(-1)); bind('history-next', () => changeChapter(1));
  bind('call-previous', () => jumpRadio(radioIndex - 1)); bind('call-next', advanceRadio); bind('call-replay', () => jumpRadio(radioIndex)); bind('call-pause', toggleCallPause);
  bind('call-close', () => setMode(radioReturn)); bind('call-archive', openArchive);
  for (const id of ['title-archive', 'pause-archive', 'win-archive']) bind(id, openArchive);
  $('archive-chapter').addEventListener('change', renderArchiveChapter);
  bind('archive-play', () => openHistoryRadio(HISTORY.chapters[+$('archive-chapter').value].start, archiveReturn));
  bind('archive-resume', () => openHistoryRadio(historyProgress.index, archiveReturn));
  bind('archive-close', () => setMode(archiveReturn)); bind('archive-download', downloadTranscript);
  for (const [id, s] of Object.entries(HISTORY.sources)) { const li = document.createElement('p'); li.appendChild(sourceLinks(id)); const small = document.createElement('small'); small.textContent = s.note; li.appendChild(small); $('archive-sources').appendChild(li); }
  // Briefing options.
  bind('difficulty-btn', () => { field.difficulty = DIFF_ORDER[(DIFF_ORDER.indexOf(field.difficulty) + 1) % DIFF_ORDER.length]; storeField(); syncBrief(); });
  bind('bandana-btn', () => { if (!bandanaUnlocked()) return; field.bandana = !field.bandana; storeField(); syncBrief(); });
  // Audio starts on the first gesture anywhere; the loop pauses sound and speech with the kit menu.
  addEventListener('pointerdown', startAudio, { passive: true }); addEventListener('keydown', startAudio);
  kit.onPause((paused) => {
    if (audio.started) { if (paused) audio.ctx.suspend().catch(() => {}); else audio.ctx.resume().catch(() => {}); }
    try { if (paused) window.speechSynthesis?.pause(); else window.speechSynthesis?.resume(); } catch { /* speech not available */ }
    if (!paused) { updateReadout(); input.settle(); }
  });
  addEventListener('blur', () => { if (state === 'play') pauseGame(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (state === 'play') pauseGame();
    if (state === 'codec' && callReady && !radioPaused) { radioPaused = true; stopVoice(); $('call-pause').textContent = 'Resume line'; $('voice-engine-state').textContent = 'PLAYBACK PAUSED WHILE TAB IS HIDDEN'; }
  });
  input.onSourceChange(() => { applyPrompts(); if (state === 'codec') $('codec-hint').textContent = codecHint(); if (state === 'help') renderHelp(input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' ? 'touch' : 'keyboard'); for (const k in touchLabelCache) delete touchLabelCache[k]; });
  kit.onQuality(() => updateReadout());
}

// ------------------------------------------------------------------ per-frame work
function tickVisuals(dt) {
  worldTime += dt; shake = Math.max(0, shake - dt * 1.5); noisePulse = Math.max(0, noisePulse - dt); noticeTimer = Math.max(0, noticeTimer - dt);
  setStyle('notice', 'opacity', noticeTimer > 0 ? '1' : '0');
  if (state === 'play') { areaTimer = Math.max(0, areaTimer - dt); setStyle('area', 'opacity', (areaTimer > 1 ? Math.min(1, (4.2 - areaTimer) * 2) : Math.max(0, areaTimer)).toFixed(2)); } else setStyle('area', 'opacity', '0');
  damageFlash = Math.max(0, damageFlash - dt * 1.7); setStyle('damage', 'opacity', damageFlash.toFixed(2));
  for (const s of snowflakes) { s.y -= dt * s.v; s.x += dt * .25; if (s.y < 0) { s.y = 15; s.x = rr(-30, 30); s.z = rr(-42, 39); } }
  for (const a of animated) if (a.kind === 'dish') a.node.rotation.y = worldTime * .05;
  if (door) { door.scale.y = mix(door.scale.y, doorOpen ? .04 : 1, Math.min(1, dt * 4)); door.position.y = 3.8 - 1.9 * door.scale.y; }
  if (card) card.children[0].rotation.y = Math.sin(worldTime) * .15;
  if (boat) { boat.position.y = -.15 + Math.sin(worldTime * .7) * .055; boat.rotation.z = Math.sin(worldTime * .6) * .012; }
  tickEffects(dt); tickRadioFX();
  if (state === 'codec' && callReady && !voiceBusy && !radioClosing && !radioPaused) {
    radioElapsed += dt; const line = radioData[radioIndex];
    if (line && radioChar < line[1].length) { const prev = Math.floor(radioChar); radioChar = Math.min(line[1].length, radioChar + dt * 47); if (Math.floor(radioChar) !== prev) { updateRadio(); if (voiceMethod === 'text' && prev % 7 === 0) tone(180 + prev % 7 * 26, .012, 'triangle', .007); } }
  }
  if (!fieldActive && guards.length) {
    // The title screen keeps the patrols walking behind the menu.
    for (const g of guards) {
      if (g.sleep > 0) { g.sleep = 0; g.mode = 'patrol'; }
      const p = g.route[g.patrolIndex]; routeTarget.x = p[0]; routeTarget.z = p[1];
      if (dist(g, routeTarget) < .6) { g.patrolIndex = (g.patrolIndex + 1) % g.route.length; g.wait = 1; }
      if (g.wait > 0) g.wait -= dt; const moving = g.wait > 0 ? 0 : walkGuard(g, routeTarget, 1.1, dt);
      g.visual.root.position.set(g.x, 0, g.z); g.visual.root.rotation.y = -g.angle; animateActor(g, moving, dt); g.cone.visible = false; g.label.visible = false;
    }
    for (const c of security) c.cone.visible = false;
  }
}
const STEP = 1 / 60;
let accumulator = 0;
function gameStep(dt) { if (state !== 'play') return; gameTime += dt; frame++; tickPlayer(dt); if (state === 'play') tickGuards(dt); tapped.clear(); }
function frameUpdate(dt) {
  if (state === 'play') playInput(); else menuInput(dt);
  tickVisuals(dt);
  if (state === 'play') {
    accumulator = Math.min(accumulator + dt, STEP * 6);
    while (accumulator >= STEP && state === 'play') { gameStep(STEP); accumulator -= STEP; }
  } else accumulator = 0;
  tickCamera(dt); tickAudio(); renderWorld(); updateHUD(dt);
}

// ------------------------------------------------------------------ start
try {
  kit.loading.progress(.66, 'Building Frostline Station…'); await nextFrame();
  buildWorld(); enhanceWorld(); addFoodProps(); rebuildNav();
  kit.loading.progress(.76, 'Painting textures…'); await nextFrame();
  buildScene();
  bindUI(); syncSettings(); readCheckpoint(); syncTitle(); applyPrompts();
  loadPortrait($('rook-portrait'), 'rook'); loadPortrait($('mara-portrait'), 'mara');
  for (let i = 0; i < 27; i++) { const b = document.createElement('i'); b.style.height = '6px'; $('radio-bars').appendChild(b); }
  $('engine-note').textContent = 'three.js r' + THREE.REVISION + ' / ' + kit.backendLabel + '. Detailed original meshes, painted portraits and an original score.';
  kit.loading.progress(.9, 'Compiling shaders…'); await nextFrame();
  // Compile every pipeline up front, including effects that appear later, so the first shot does not stutter.
  prepareFrame();
  const warm = [tracers[0].mesh, sparkPool[0].mesh, sparkPool[1].mesh, ...guards.map((g) => g.cone.mesh), ...security.map((c) => c.cone.mesh), player.visual.boxBody.object, guards[0].visual.boxBody.object];
  sparkPool[1].mesh.material = sparkMaterial(0xe2c695);
  for (const s of sparkPool.slice(0, 2)) s.mesh.position.set(mainCamera.tx, 1, mainCamera.tz);
  const glassWarm = fadeWalls.length ? new THREE.Mesh(fadeWalls[0].mesh.geometry, materialFor('key', fadeWalls[0].glass)) : null;
  if (glassWarm) { glassWarm.renderOrder = ORDER_DYNAMIC; scene.add(glassWarm); }
  for (const m of warm) m.visible = true;
  try { await kit.renderer.compileAsync(scene, camera3); } catch (err) { console.warn('Pipeline warm-up:', err); }
  for (const m of warm) m.visible = false;
  if (glassWarm) scene.remove(glassWarm);
  ready = true; $('start-btn').disabled = false;
  $('load-label').textContent = kit.backendLabel.toUpperCase() + ' / SYSTEM READY';
  state = 'title'; showScreen('title');
  kit.start(frameUpdate);
  kit.loading.done();
} catch (err) {
  console.error(err);
  kit.loading.done();
  const e = document.createElement('div'); e.className = 'boot-message'; e.textContent = 'MSG could not start: ' + (err?.message || err) + '. Reload the page to try again.'; document.body.appendChild(e);
}
