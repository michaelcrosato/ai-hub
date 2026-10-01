// game.js — Little Lot: a small, fully local home-life game on the shared 3D stack.
// One real second is three game minutes. The lot is a real three.js scene seen
// through an orthographic camera that matches the original isometric view, so
// the HUD, speech bubbles and picking all line up with it.

import * as THREE from 'three/webgpu';
import { vertexColor, normalWorld, vec2, vec3, vec4, float, dot, max, mix, uniform, saturate, length, screenUV, screenSize, sRGBTransferEOTF, uv } from 'three/tsl';
import { boot } from 'kit/boot.js';
import * as B from './build.js';
import { paintPortrait } from './portrait.js';

const { randSeed, ROOM_Y: roomY, OUTFITS } = B;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const ICONS = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9', chair: 'M5 11V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M4 10v7h16v-7M6 17v4m12-4v4M3 10h3v4h12v-4h3', bag: 'M5 7h14l2 14H3ZM8 7V5a4 4 0 0 1 8 0v2',
  smile: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01', sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19',
  moon: 'M20.5 14A9 9 0 0 1 10 3a9 9 0 1 0 10.5 11Z', play: 'm9 5 10 7-10 7Z', pause: 'M8 5v14M16 5v14', food: 'M4 3v6a3 3 0 0 0 6 0V3M7 3v18M17 3v18M17 3c-4 4-4 9 0 9', energy: 'm13 2-9 12h7l-1 8 10-13h-8Z',
  fun: 'M7 7h10c3 0 4 4 4 8s-2 5-5 1H8c-3 4-5 3-5-1s1-8 4-8ZM7 10v4m-2-2h4m6 0h.01m3-2h.01', social: 'M21 11a8 8 0 0 1-8 8H8l-5 3 1-6A8 8 0 1 1 21 11ZM8 10h8m-8 4h5',
  hygiene: 'M12 2S4 11 4 15a8 8 0 0 0 16 0c0-4-8-13-8-13ZM8 15a4 4 0 0 0 4 4', bladder: 'M4 3h7v8H4ZM5 11h15v3a7 7 0 0 1-7 7h-2v-6H5ZM11 7h8v4',
  book: 'M12 5C9 3 5 3 2 4v15c4-1 7-1 10 1m0-15c3-2 7-2 10-1v15c-4-1-7-1-10 1Zm0 0v15', wallet: 'M3 6h17v15H3V6Zm0 0V4l14-2v4m-1 6h6v5h-6Z', close: 'm6 6 12 12M6 18 18 6',
  star: 'm12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', rotate: 'M4 9a8 8 0 1 1 0 7M4 3v6h6',
  volume: 'M3 9h4l5-4v14l-5-4H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16', mute: 'M3 9h4l5-4v14l-5-4H3Zm13 0 6 6m0-6-6 6',
  help: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9 9a3 3 0 0 1 6 0c0 3-3 2-3 5m0 3h.01', settings: 'M4 7h16M4 17h16M8 4v6m8 4v6', diamond: 'm12 2 7 10-7 10-7-10Zm-7 10h14m-7-10v20',
  flag: 'M5 22V3c5-4 9 4 14 0v11c-5 4-9-4-14 0', heart: 'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 4 12 8 16 4-4 13-11 8-16Z', check: 'm5 12 4 4L20 5', arrow: 'M4 12h16m-6-6 6 6-6 6',
  leaf: 'M20 3C6 2 2 7 4 15s12 9 16-12ZM4 21 15 10', plant: 'M7 15h10l-2 7H9ZM12 15V6M12 10C5 10 5 3 5 3c7 0 7 7 7 7Zm0-3c0-6 7-6 7-6s0 6-7 6Z',
  paint: 'M4 21 10 5m10 16L14 5M3 4h18v11H3ZM6 12l4-5 4 4 3-3 2 4', computer: 'M3 3h18v13H3ZM8 21h8m-4-5v5', bed: 'M3 18h18M3 8v14m18-10v10M3 13h18M5 13V8h5v5M11 9h7a3 3 0 0 1 3 3v1',
  mail: 'M3 6h18v14H3ZM3 6l9 8 9-8', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2', music: 'M9 18V5l11-2v13M9 18c0 4-7 4-7 0s7-4 7 0Zm11-2c0 4-7 4-7 0s7-4 7 0ZM9 9l11-2',
  cat: 'm5 9-1-6 6 4h4l6-4-1 6a8 8 0 0 1-7 12A8 8 0 0 1 5 9ZM8 12h.01M16 12h.01m-5 4h2M1 13l5 1m12 0 5-1', gnome: 'm6 11 6-10 6 10ZM6 11c-4 8 1 11 6 11s10-3 6-11ZM9 13h.01M15 13h.01M10 17h4',
  rug: 'M4 4h16v16H4ZM7 7h10v10H7ZM2 4h2M2 8h2m-2 4h2m-2 4h2m-2 4h2M20 4h2m-2 4h2m-2 4h2m-2 4h2m-2 4h2', trophy: 'M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v6m-4 0h8',
  walk: 'M13 4h.01M11 8l-3 5-4 1m7-6 3 5 5 1m-8-6 2 6-5 7m5-7 5 7', spark: 'm12 2 2 7 7 3-7 2-2 8-2-8-7-2 7-3Zm7 0v4m-2-2h4', reset: 'M3 9a9 9 0 1 1 0 7M3 3v6h6', chevron: 'm9 5 7 7-7 7',
  person: 'M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 22v-3a8 8 0 0 1 16 0v3', menu: 'M4 6h16M4 12h16M4 18h16',
  pad: 'M7 8h10a5 5 0 0 1 5 5v1a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2v-1a5 5 0 0 1 5-5ZM8 11v4m-2-2h4m5-1h.01m2 2h.01',
  keyboard: 'M3 6h18v12H3ZM7 10h.01M11 10h.01M15 10h.01M7 14h10', hand: 'M8 13V5a2 2 0 0 1 4 0v6m0-1a2 2 0 0 1 4 0v2m0 0a2 2 0 0 1 4 0v3a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-3-5a2 2 0 0 1 3-2l1 1',
};
function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ICONS.star}"/></svg>`;
}

/* ================================================================ boot */

const kit = await boot({
  title: 'Little Lot',
  canvas: $('world'),
  gear: 'none', // the game's own menu has a Display & controls button (F9 also opens it)
  accent: '#d6ee93',
  background: '#213e3c',
  input: {
    cursor: { type: 'vector', gamepad: 'leftStick' }, // gamepad pointer over the lot
    pan: { type: 'vector', keys: 'wasd+arrows', gamepad: 'rightStick' },
    nav: { type: 'vector', keys: 'arrows', gamepad: 'dpad' }, // move between on-screen buttons
    confirm: { gamepad: ['A'] },
    back: { keys: ['Escape'], gamepad: ['B'] },
    menu: { keys: ['KeyP'], gamepad: ['Start'] },
    help: { keys: ['KeyH', 'Slash', 'F1'], gamepad: ['Back'] },
    playPause: { keys: ['Space'], gamepad: ['X'] },
    speed1: { keys: ['Digit1', 'Numpad1'] },
    speed2: { keys: ['Digit2', 'Numpad2'] },
    speed3: { keys: ['Digit3', 'Numpad3'] },
    buy: { keys: ['KeyB'], gamepad: ['Y'] },
    turnItem: { keys: ['KeyR'] },
    turnLeft: { keys: ['KeyQ'], gamepad: ['LB'] },
    turnRight: { keys: ['KeyE'], gamepad: ['RB'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RT'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LT'] },
    homeView: { keys: ['Home'], gamepad: ['RS'] },
    findMara: { keys: ['KeyF'], gamepad: ['LS'] },
    sell: { keys: ['Delete'] },
    multi: { keys: ['ShiftLeft', 'ShiftRight'] },
    altClick: { mouse: [2] },
  },
});
const input = kit.input;
const renderer = kit.renderer;
const canvas = kit.canvas;

/* ================================================================ view */

let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2);
let yawTarget = Math.PI / 4, viewYaw = yawTarget, zoomTarget = 1, zoom = 1;
let pan = { x: 0, y: 0 };
let baseUnit = 36, unit = 36, centerX = 0, centerY = 0, hudTop = 0, hudHeight = 220, viewTop = 78;
let ca = Math.cos(viewYaw), sa = Math.sin(viewYaw);
const se = 0.56, ce = Math.sqrt(1 - se * se); // the original isometric elevation
const _sp = { x: 0, y: 0 };
const padCursor = { x: 0, y: 0 }; // the gamepad pointer, in CSS pixels
function screenPoint(x, y, z, out = _sp) {
  out.x = centerX + pan.x + (x * ca - z * sa) * unit;
  out.y = centerY + pan.y + ((x * sa + z * ca) * se - y * ce) * unit;
  return out;
}
function groundPoint(sx, sy, y = roomY) {
  const a = (sx - centerX - pan.x) / unit;
  const b = ((sy - centerY - pan.y) / unit + y * ce) / se;
  return { x: a * ca + b * sa, z: -a * sa + b * ca };
}
const isIndoor = (x, z) => Math.abs(x) < 5.5 && z < 4.6 && z > -4.5;
const floorAt = (x, z) => (isIndoor(x, z) ? roomY : 0.02);

/* ================================================================ data */

const SAVE_KEY = 'little-lot-save-v1';
const SOUND_KEY = 'little-lot-sound';
const NEEDS = [['hunger', 'Hunger', 'food'], ['energy', 'Energy', 'energy'], ['fun', 'Fun', 'fun'], ['social', 'Social', 'social'], ['hygiene', 'Hygiene', 'hygiene'], ['bladder', 'Bladder', 'bladder']];
const DEFAULT_OBJECTS = [
  { id: 'fridge', type: 'fridge', name: 'The Cool Keeper', desc: 'A fresh start is in the fridge.', icon: 'food', x: -0.85, z: -3.83, w: 1, d: 1, stand: [-0.85, -2.72] },
  { id: 'stove', type: 'stove', name: 'Little Chef stove', desc: 'Good food. Better company.', icon: 'food', x: 0.48, z: -3.83, w: 1.18, d: 1.05, stand: [0.48, -2.68] },
  { id: 'sink', type: 'sink', name: 'Kitchen sink', desc: 'A small splash of self-care.', icon: 'hygiene', x: 1.74, z: -3.83, w: 1, d: 1.05, stand: [1.65, -2.7] },
  { id: 'bed', type: 'bed', name: 'Cloud Nine bed', desc: 'Dream small. Sleep big.', icon: 'bed', x: -4.12, z: -2.94, w: 1.85, d: 2.62, stand: [-2.87, -1.9] },
  { id: 'toilet', type: 'toilet', name: 'The Porcelain Throne', desc: 'Some needs cannot wait.', icon: 'bladder', x: 4.56, z: -3.78, w: 0.8, d: 1, stand: [4.5, -2.69] },
  { id: 'shower', type: 'shower', name: 'Fresh Start shower', desc: 'A good day starts clean.', icon: 'hygiene', x: 4.67, z: -1.65, w: 1.12, d: 1.2, stand: [3.6, -1.58] },
  { id: 'sofa', type: 'sofa', name: 'Sunday sofa', desc: 'One more episode?', icon: 'chair', x: -3.79, z: 0.9, w: 2.68, d: 1.24, stand: [-2.13, 1.14] },
  { id: 'tv', type: 'tv', name: 'Tiny Vision TV', desc: 'Small screen. Big feelings.', icon: 'fun', x: -3.8, z: 3.84, w: 1.78, d: 0.67, stand: [-2.2, 3.0] },
  { id: 'computer', type: 'computer', name: 'The Side Hustle desk', desc: 'Work a little. Play a little.', icon: 'computer', x: 3.69, z: 2.8, w: 1.77, d: 1.25, stand: [3.7, 4.05] },
  { id: 'radio', type: 'radio', name: 'Good Vibes radio', desc: 'Turn your living room into a dance floor.', icon: 'music', x: -5.02, z: 3.2, w: 0.68, d: 0.62, stand: [-4.92, 2.2] },
  { id: 'plant0', type: 'plant', name: 'Leaf it to me', desc: 'A leafy little roommate.', icon: 'plant', x: 5.02, z: 0.4, w: 0.72, d: 0.75, stand: [4.23, 0.4] },
  { id: 'bookshelf0', type: 'bookshelf', name: 'A good read', desc: 'A whole world on a little shelf.', icon: 'book', x: -1.75, z: 3.85, w: 1.2, d: 0.54, stand: [-1.8, 2.95] },
  { id: 'mailbox', type: 'mailbox', name: '21 Clover Lane', desc: 'Your link to the neighborhood.', icon: 'mail', x: -1.7, z: 8.4, w: 0.65, d: 0.6, outdoor: true, stand: [-0.78, 8.33] },
  { id: 'cat', type: 'cat', name: 'Miso', desc: 'Not your cat. Yet.', icon: 'cat', x: -3.5, z: 6.75, w: 0.65, d: 0.45, outdoor: true, stand: [-2.7, 6.6], nonSolid: true },
  { id: 'dining', type: 'table', name: 'The gathering table', desc: 'There is always room for one more.', icon: 'food', x: 0.6, z: 0.75, w: 1.7, d: 2.7, stand: [1.94, 0.75], virtual: true },
  { id: 'garden', type: 'garden', name: 'The kitchen garden', desc: 'Water it, wait a little, then harvest.', icon: 'leaf', x: -7.55, z: -2.5, w: 2, d: 3.05, outdoor: true, stand: [-6.25, -2.5], virtual: true },
];
const SHOP = [
  { type: 'plant', name: 'Leaf it to me', price: 65, icon: 'plant', w: 0.75, d: 0.75, desc: 'A bit of green. A bit of joy.' },
  { type: 'easel', name: 'Blank canvas', price: 180, icon: 'paint', w: 1.12, d: 0.7, desc: 'Make art. Sell art. Repeat.' },
  { type: 'bookshelf', name: 'Good stories', price: 110, icon: 'book', w: 1.2, d: 0.6, desc: 'Fun and a little inspiration.' },
  { type: 'arcade', name: 'Pixel pal', price: 280, icon: 'fun', w: 0.9, d: 0.8, desc: 'Big fun in a small box.' },
  { type: 'rug', name: 'Warm welcome', price: 45, icon: 'rug', w: 1.8, d: 1.3, desc: 'Tie the room together.' },
  { type: 'gnome', name: 'Gnome sweet gnome', price: 75, icon: 'gnome', w: 0.6, d: 0.5, desc: 'Questionable taste. Great company.' },
  { type: 'lantern', name: 'Garden glow', price: 90, icon: 'sun', w: 0.5, d: 0.5, desc: 'A warm little light for long evenings.' },
  { type: 'catbed', name: 'Cat nap corner', price: 55, icon: 'cat', w: 0.9, d: 0.8, nonSolid: true, desc: 'Every cat deserves a favourite spot.' },
];
const MISO_SPOTS = [[-3.0, -1.2], [-2.3, 3.1], [1.0, 3.0], [3.3, 1.0], [-0.7, -1.6], [1.9, -1.5], [-2.6, -0.3], [-1.2, 1.6], [-0.2, 2.6]];
const LAMPS = [[-2.65, -3.3], [-3.6, 1.4], [1, -2.5]];
// What gamepad and keyboard focus can land on, and where menus put it first.
const FOCUSABLE = 'button:not([disabled]), [role="button"][tabindex], input:not([disabled])';
const MODAL_FOCUS = '.green-btn:not([disabled]), button:not(.modal-close):not([disabled])';
const CONTEXT_FOCUS = '[data-action]:not([disabled]), #move-object, #sell-object, button:not([disabled])';
const CH1 = [['meal', 'Make a home-cooked meal'], ['fresh', 'Freshen up in the shower'], ['friend', 'Make a new friend'], ['decor', 'Make the place your own']];
const CH2 = [['harvest', 'Grow and harvest the garden'], ['miso', 'Welcome Miso home'], ['bestie', 'Become good friends with June'], ['artist', 'Sell three paintings']];

function newState() {
  return {
    version: 1, name: 'Mara Bloom', money: 680, time: 480,
    needs: { hunger: 48, energy: 79, fun: 61, social: 44, hygiene: 65, bladder: 68 },
    skills: { cooking: 0, creativity: 0, gardening: 0 }, friendship: 0,
    flags: { meal: false, fresh: false, friend: false, decor: false, won: false, harvest: false, miso: false, bestie: false, artist: false, won2: false },
    stats: { meals: 0, earned: 0, bought: 0, actions: 0, parties: 0, harvests: 0, paintings: 0 },
    autonomy: false, outfit: 0, floor: 0, started: false, bills: 0, lastBillDay: 1, leftovers: 0, dishes: 0, party: null, nextId: 1,
    accidentCooldown: 0, exhaustionCooldown: 0,
    garden: { growth: 40, water: 0 }, produce: 0, misoBond: 0, misoPos: null,
  };
}
const newActor = () => ({ x: 0.04, z: 3.04, angle: 0.3, path: [], current: null, queue: [], phase: 0, bubble: '', bubbleEnd: 0 });
const newNpc = () => ({ x: 1.5, z: 8.4, angle: Math.PI, visible: true, path: [], idle: 0, bubble: '', bubbleEnd: 0 });
const newGuest = () => ({ x: 2, z: 8.5, angle: 0, visible: false, path: [], leaving: false, bubble: '', bubbleEnd: 0 });

let state = newState(), objects = DEFAULT_OBJECTS.map((o) => ({ ...o })), actor = newActor(), npc = newNpc(), friend2 = newGuest();
let gameSpeed = 0, lastSpeed = 1, mode = 'live', started = false, selection = null, placing = null, placeRotation = 0, ghostPos = null;
let modalOpen = false, modalPause = 0, soundOn = false, simTime = 0, realTime = 0, uiTimer = 0, saveTimer = 0, idleTimer = 0;
let clickMarker = null, confettiPieces = [], floaters = [], storyCollapsed = false, savedLiveSpeed = 1, movingId = null;
let loadedGame = false, frameCount = 0, hoverId = null;

/* ================================================================ save */

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.version !== 1 || !s.state || !s.state.needs) throw Error('This save cannot be read.');
    const base = newState();
    state = {
      ...base, ...s.state,
      needs: { ...base.needs, ...s.state.needs }, flags: { ...base.flags, ...s.state.flags }, stats: { ...base.stats, ...s.state.stats },
      skills: { ...base.skills, ...s.state.skills }, garden: { ...base.garden, ...(s.state.garden || {}) },
    };
    for (const k of Object.keys(state.needs)) state.needs[k] = clamp(Number(state.needs[k]) || 0, 0, 100);
    for (const k of Object.keys(state.skills)) state.skills[k] = clamp(Number(state.skills[k]) || 0, 0, 100);
    state.money = Math.max(0, Number(state.money) || 0);
    state.name = String(state.name || 'Mara Bloom').slice(0, 22);
    state.outfit = clamp(Math.floor(Number(state.outfit) || 0), 0, 2);
    state.floor = clamp(Math.floor(Number(state.floor) || 0), 0, 2);
    state.garden.growth = clamp(Number(state.garden.growth) || 0, 0, 100);
    state.garden.water = Math.max(0, Number(state.garden.water) || 0);
    state.produce = clamp(Math.floor(Number(state.produce) || 0), 0, 99);
    state.misoBond = clamp(Number(state.misoBond) || 0, 0, 100);
    if (state.party && typeof state.party === 'object') state.party.kind = state.party.kind || 'house';
    else state.party = null;
    if (Array.isArray(s.added)) {
      for (const o of s.added) {
        const item = SHOP.find((i) => i.type === o.type);
        if (item && Number.isFinite(o.x) && Number.isFinite(o.z) && Math.abs(o.x) < 9 && Math.abs(o.z) < 10) objects.push({ ...item, ...o, placed: true });
      }
    }
    if (s.actor && Number.isFinite(s.actor.x) && Number.isFinite(s.actor.z)) Object.assign(actor, { x: s.actor.x, z: s.actor.z, angle: s.actor.angle || 0 });
    loadedGame = true;
    state.started = true;
    gameSpeed = 0;
    started = false;
    if (state.party) {
      npc.visible = true;
      friend2.visible = true;
      npc.x = 1.9; npc.z = 2.2;
      friend2.x = -0.5; friend2.z = 2.7;
    }
    if (state.flags.miso) adoptMiso(true);
  } catch (e) {
    console.warn('Local save unavailable:', e.message);
  }
}
function saveGame(manual = false) {
  try {
    const cat = catObj();
    if (state.flags.miso && cat) state.misoPos = { x: cat.x, z: cat.z };
    const added = objects.filter((o) => o.placed).map(({ path, ...o }) => o);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state, added, actor: { x: actor.x, z: actor.z, angle: actor.angle } }));
    put('save-label', 'text', 'Saved locally');
    if (manual) toast('Home, safely saved.', 'Your game is stored in this browser.', 'check');
  } catch {
    put('save-label', 'text', 'Save unavailable');
    if (manual) toast('This browser blocked the save.', 'Keep this tab open to keep playing.', 'mail', true);
  }
}

/* ================================================================ people & things */

const juneObj = { id: 'june', type: 'person', name: 'June Park', desc: '', icon: 'social', x: 0, z: 0, stand: [0, 0] };
const eliObj = { id: 'eli', type: 'guest', name: 'Eli Moss', desc: 'A new face at your little gathering.', icon: 'social', x: 0, z: 0, stand: [0, 0] };
const selfObj = { id: 'self', type: 'self', name: '', desc: 'Creative soul. People person. Work in progress.', icon: 'smile', x: 0, z: 0, stand: [0, 0] };
function objById(id) {
  if (id === 'june') {
    juneObj.desc = state.friendship >= 70 ? 'A good friend. Practically family.' : state.friendship >= 30 ? 'Your first friend in Bramble Bay.' : 'Your friendly next-door neighbor.';
    juneObj.x = npc.x; juneObj.z = npc.z; juneObj.stand[0] = npc.x + 0.8; juneObj.stand[1] = npc.z + 0.3;
    return juneObj;
  }
  if (id === 'eli') {
    eliObj.x = friend2.x; eliObj.z = friend2.z; eliObj.stand[0] = friend2.x + 0.8; eliObj.stand[1] = friend2.z + 0.3;
    return eliObj;
  }
  if (id === 'self') {
    selfObj.name = state.name; selfObj.x = actor.x; selfObj.z = actor.z; selfObj.stand[0] = actor.x; selfObj.stand[1] = actor.z;
    return selfObj;
  }
  return objects.find((o) => o.id === id);
}
function catObj() {
  return objects.find((o) => o.id === 'cat');
}
function gardenObj() {
  return objects.find((o) => o.id === 'garden');
}
function avgNeeds() {
  return NEEDS.reduce((s, [k]) => s + state.needs[k], 0) / 6;
}
function mood() {
  const low = Math.min(...Object.values(state.needs)), avg = avgNeeds();
  if (low < 12) return { label: 'Needs some care', color: '#bd8055', icon: 'heart' };
  if (avg > 76) return { label: 'Living the dream', color: '#699846', icon: 'spark' };
  if (avg > 52) return { label: 'Feeling good', color: '#779850', icon: 'smile' };
  if (avg > 35) return { label: 'Doing okay', color: '#a19c57', icon: 'smile' };
  return { label: 'A little worn out', color: '#b88c56', icon: 'heart' };
}

const ACTIONS = {
  toastie: { name: 'Make a toastie', desc: '+ Hunger · + Cooking', icon: 'food', duration: 26, cost: 12, gain: { hunger: 48, fun: 3 }, skill: ['cooking', 8], meal: true, anim: 'cook' },
  snack: { name: 'Grab a quick snack', desc: '+ Hunger', icon: 'food', duration: 10, cost: 5, gain: { hunger: 23 }, anim: 'eat' },
  pasta: { name: 'Cook garden pasta', desc: '++ Hunger · + Cooking', icon: 'food', duration: 40, cost: 18, gain: { hunger: 67, fun: 6 }, skill: ['cooking', 15], meal: true, anim: 'cook' },
  bites: { name: 'Make party bites', desc: '+ Hunger · Food to share', icon: 'food', duration: 34, cost: 24, gain: { hunger: 38, fun: 4 }, skill: ['cooking', 12], meal: true, anim: 'cook' },
  stew: { name: 'Cook a harvest stew', desc: '+++ Hunger · Uses a basket of veggies', icon: 'food', duration: 36, gain: { hunger: 72, fun: 8 }, skill: ['cooking', 12], meal: true, produce: 1, anim: 'cook' },
  hands: { name: 'Wash your hands', desc: '+ Hygiene', icon: 'hygiene', duration: 7, gain: { hygiene: 18 }, anim: 'wash' },
  shower: { name: 'Take a shower', desc: '+++ Hygiene', icon: 'hygiene', duration: 28, gain: { hygiene: 92, fun: 3 }, fresh: true, anim: 'shower' },
  toilet: { name: 'Use the toilet', desc: '+++ Bladder', icon: 'bladder', duration: 14, gain: { bladder: 100 }, anim: 'toilet' },
  sleep: { name: 'Get some sleep', desc: '+++ Energy', icon: 'bed', duration: 180, gain: { energy: 95 }, anim: 'sleep' },
  nap: { name: 'Take a power nap', desc: '+ Energy', icon: 'energy', duration: 55, gain: { energy: 36 }, anim: 'sleep' },
  tv: { name: 'Watch a little TV', desc: '++ Fun · + Energy', icon: 'fun', duration: 44, gain: { fun: 51, energy: 8, social: 3 }, anim: 'sit' },
  games: { name: 'Play a game', desc: '++ Fun', icon: 'fun', duration: 35, gain: { fun: 49 }, anim: 'type' },
  work: { name: 'Do a freelance job', desc: 'Earn money · + Creativity', icon: 'computer', duration: 80, gain: { fun: -10, energy: -8 }, pay: 110, skill: ['creativity', 8], anim: 'type' },
  read: { name: 'Read a good book', desc: '+ Fun · + Creativity', icon: 'book', duration: 32, gain: { fun: 30, energy: 4 }, skill: ['creativity', 7], anim: 'read' },
  water: { name: 'Give it a little water', desc: '+ Fun · + Creativity', icon: 'plant', duration: 13, gain: { fun: 14 }, skill: ['creativity', 2], anim: 'water' },
  paint: { name: 'Paint and sell a picture', desc: '+ Fun · Earn from your art', icon: 'paint', duration: 65, gain: { fun: 43 }, skill: ['creativity', 16], pay: 55, anim: 'paint' },
  arcade: { name: 'Beat your high score', desc: '+++ Fun', icon: 'fun', duration: 38, gain: { fun: 68 }, anim: 'type' },
  wish: { name: 'Tell it your big plans', desc: '+ Fun · No judgment', icon: 'gnome', duration: 12, gain: { fun: 16, social: 5 }, anim: 'chat' },
  pet: { name: 'Make friends with Miso', desc: '+ Fun · + Social', icon: 'cat', duration: 16, gain: { fun: 19, social: 17 }, anim: 'pet' },
  playcat: { name: 'Play with Miso', desc: '++ Fun · + Social', icon: 'cat', duration: 20, gain: { fun: 30, social: 12 }, anim: 'pet', say: 'Get the string!' },
  dance: { name: 'Dance like nobody is here', desc: '++ Fun · A little exercise', icon: 'music', duration: 30, gain: { fun: 38, energy: -5, hygiene: -4 }, anim: 'dance' },
  hello: { name: 'Chat about the neighborhood', desc: '+ Social · + Friendship', icon: 'social', duration: 20, gain: { social: 28 }, friend: 18, anim: 'chat' },
  joke: { name: 'Tell a terrible joke', desc: '+ Fun · + Friendship', icon: 'smile', duration: 16, gain: { social: 22, fun: 12 }, friend: 17, anim: 'chat' },
  deep: { name: 'Share your big plans', desc: '++ Social · ++ Friendship', icon: 'heart', duration: 28, gain: { social: 38, fun: 8 }, friend: 24, requires: 15, anim: 'chat' },
  welcome: { name: 'Welcome your guest', desc: '+ Social · + Party spirit', icon: 'social', duration: 16, gain: { social: 25, fun: 8 }, guestSocial: true, anim: 'chat' },
  partyjoke: { name: 'Share a terrible joke', desc: '+ Fun · + Party spirit', icon: 'smile', duration: 13, gain: { social: 18, fun: 17 }, guestSocial: true, anim: 'chat' },
  hug: { name: 'Give your friend a hug', desc: '++ Social · + Friendship', icon: 'heart', duration: 11, gain: { social: 31, fun: 8 }, friend: 14, requires: 30, anim: 'chat' },
  invite: { name: 'Invite June over', desc: 'Good company, right to your door', icon: 'mail', duration: 5, anim: 'mail' },
  bills: { name: 'Pay the household bills', desc: 'Keep your little home in good shape', icon: 'wallet', duration: 5, anim: 'mail' },
  sellveg: { name: 'Sell a basket of veggies', desc: 'Earn money · Uses a basket', icon: 'wallet', duration: 6, pay: 28, produce: 1, anim: 'mail' },
  leftovers: { name: 'Eat the leftovers', desc: '++ Hunger · Already paid for', icon: 'food', duration: 15, gain: { hunger: 45 }, anim: 'eat' },
  supper: { name: 'Serve the harvest supper', desc: '++ Hunger · ++ Social · Uses a basket', icon: 'food', duration: 30, gain: { hunger: 55, social: 30, fun: 12 }, produce: 1, anim: 'eat', say: 'Dig in, everyone!' },
  clear: { name: 'Clear the dishes', desc: 'A tidy home feels good', icon: 'spark', duration: 10, gain: { fun: 5 }, anim: 'wash' },
  tidy: { name: 'Tidy up a little', desc: 'Clear the dishes and reset the room', icon: 'spark', duration: 15, gain: { fun: 8, hygiene: -2 }, anim: 'wash' },
  stroll: { name: 'Enjoy a little fresh air', desc: '+ Fun · + Energy', icon: 'leaf', duration: 20, gain: { fun: 17, energy: 5 }, anim: 'idle' },
  tend: { name: 'Tend the garden', desc: '+ Fun · + Gardening · Waters the beds', icon: 'leaf', duration: 28, gain: { fun: 12, hygiene: -3 }, skill: ['gardening', 8], anim: 'water', say: 'Grow, little ones.' },
  harvest: { name: 'Harvest the veggies', desc: '+ Fun · Three baskets of produce', icon: 'plant', duration: 22, gain: { fun: 14 }, skill: ['gardening', 10], anim: 'pet', say: 'Look at these!' },
  evening: { name: 'Enjoy the evening glow', desc: '+ Fun · + Energy · Lovely at night', icon: 'sun', duration: 18, gain: { fun: 16, energy: 4, social: 3 }, anim: 'idle' },
  fluff: { name: 'Fluff the cushion', desc: '+ Fun · A cozy corner', icon: 'cat', duration: 8, gain: { fun: 6 }, anim: 'pet' },
  walk: { name: 'Go here', desc: 'Stretch those little legs', icon: 'walk', duration: 0, gain: {}, anim: 'idle' },
};
const GESTURES = new Set(['chat', 'cook', 'paint', 'water', 'wash', 'pet', 'dance']);

function objectActions(o) {
  switch (o.type) {
    case 'fridge': return ['toastie', 'snack', ...(state.leftovers ? ['leftovers'] : [])];
    case 'stove': return ['pasta', 'bites', ...(state.produce || state.stats.harvests ? ['stew'] : [])];
    case 'sink': return ['hands', ...(state.dishes ? ['clear'] : [])];
    case 'bed': return ['sleep', 'nap'];
    case 'shower': return ['shower'];
    case 'toilet': return ['toilet'];
    case 'sofa': return ['tv', 'nap'];
    case 'tv': return ['tv'];
    case 'computer': return ['work', 'games'];
    case 'bookshelf': return ['read'];
    case 'radio': return ['dance'];
    case 'plant': return ['water'];
    case 'easel': return ['paint'];
    case 'arcade': return ['arcade'];
    case 'rug': return ['stroll'];
    case 'gnome': return ['wish'];
    case 'cat': return state.flags.miso ? ['pet', 'playcat'] : ['pet'];
    case 'person': return ['hello', 'joke', 'deep', 'hug'];
    case 'guest': return ['welcome', 'partyjoke'];
    case 'mailbox': return ['invite', ...(state.bills > 0 ? ['bills'] : []), ...(state.produce ? ['sellveg'] : [])];
    case 'table': return [...(state.party?.kind === 'dinner' ? ['supper'] : []), ...(state.leftovers ? ['leftovers'] : []), ...(state.dishes ? ['clear'] : []), 'tidy'];
    case 'garden': return ['tend', 'harvest'];
    case 'lantern': return ['evening'];
    case 'catbed': return ['fluff'];
    case 'self': return ['tidy', 'stroll'];
    default: return [];
  }
}
function actionCost(id) {
  return id === 'bills' ? state.bills : ACTIONS[id]?.cost || 0;
}
function gardenStatus() {
  const g = state.garden;
  if (g.growth >= 100) return 'Ripe and ready to pick';
  return `Growing · ${Math.floor(g.growth)}% · ${g.water > 0 ? 'watered' : 'needs water'}`;
}
function availableAction(id) {
  const a = ACTIONS[id];
  if (actionCost(id) > state.money) return 'Not enough money';
  if (a.requires && state.friendship < a.requires) return `Reach ${a.requires} friendship first`;
  if (id === 'leftovers' && !state.leftovers) return 'No leftovers right now';
  if (id === 'clear' && !state.dishes) return 'Already nice and tidy';
  if (a.produce && state.produce < a.produce) return 'You need a basket of veggies';
  if (id === 'harvest' && state.garden.growth < 100) return gardenStatus();
  if (id === 'supper' && state.party?.kind !== 'dinner') return 'Save it for the garden dinner';
  return null;
}

/* ================================================================ walking */

// Navigation uses small cells and prevents diagonal corner cutting.
const GRID = 0.38, GRID_X = -8.74, GRID_Z = -6.08, GRID_W = 47, GRID_H = 41;
const staticRects = [[-5.65, 0, 0.28, 9.65], [5.65, 0, 0.28, 9.65], [0, -4.65, 11.55, 0.28], [-3.42, 4.62, 4.65, 0.28], [3.42, 4.62, 4.65, 0.28], [-1.8, -2.85, 0.22, 3.75], [-4.45, -0.55, 2.25, 0.22], [2.65, -2.9, 0.22, 3.5], [4.88, -0.55, 1.5, 0.22], [-2.65, -3.28, 0.7, 0.7], [-3.8, 2.47, 1.75, 1.05], [0.6, 0.75, 1.55, 2.8], [4.94, 3.31, 0.57, 0.9]];
function insideRect(x, z, cx, cz, w, d, pad = 0.08) {
  return Math.abs(x - cx) < w / 2 + pad && Math.abs(z - cz) < d / 2 + pad;
}
function dims(o) {
  const a = o.rot || 0;
  return [Math.abs(Math.cos(a)) * o.w + Math.abs(Math.sin(a)) * o.d, Math.abs(Math.sin(a)) * o.w + Math.abs(Math.cos(a)) * o.d];
}
function walkable(x, z, ignore = null) {
  if (x < -8.6 || x > 8.6 || z < -6 || z > 9.05) return false;
  for (const r of staticRects) if (insideRect(x, z, r[0], r[1], r[2], r[3], 0.17)) return false;
  for (const o of objects) {
    if (o.id === ignore || o.nonSolid || o.type === 'rug' || o.virtual) continue;
    const [w, d] = dims(o);
    if (insideRect(x, z, o.x, o.z, w, d, 0.15)) return false;
  }
  return true;
}
function nearestNode(x, z) {
  const bx = Math.round((x - GRID_X) / GRID), bz = Math.round((z - GRID_Z) / GRID);
  let best = null;
  for (let r = 0; r < 6; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const a = bx + dx, b = bz + dz;
        if (a < 0 || a >= GRID_W || b < 0 || b >= GRID_H) continue;
        const wx = GRID_X + a * GRID, wz = GRID_Z + b * GRID;
        if (walkable(wx, wz)) {
          const ds = (wx - x) ** 2 + (wz - z) ** 2;
          if (!best || ds < best.ds) best = { a, b, ds };
        }
      }
    }
    if (best) return best;
  }
  return null;
}
function findPath(sx, sz, tx, tz) {
  const st = nearestNode(sx, sz), en = nearestNode(tx, tz);
  if (!st || !en) return null;
  const idx = (a, b) => b * GRID_W + a;
  const start = idx(st.a, st.b), end = idx(en.a, en.b);
  const open = [start], inOpen = new Set([start]), scores = new Map([[start, 0]]), parents = new Map(), closed = new Set();
  let limit = 0;
  while (open.length && limit++ < 3500) {
    let bi = 0, best = 1e10;
    for (let k = 0; k < open.length; k++) {
      const n = open[k], a = n % GRID_W, b = Math.floor(n / GRID_W);
      const f = (scores.get(n) || 0) + Math.hypot(a - en.a, b - en.b);
      if (f < best) { best = f; bi = k; }
    }
    const n = open.splice(bi, 1)[0];
    inOpen.delete(n);
    if (n === end) {
      const path = [];
      let curr = n;
      while (curr !== start) {
        path.push({ x: GRID_X + (curr % GRID_W) * GRID, z: GRID_Z + Math.floor(curr / GRID_W) * GRID });
        curr = parents.get(curr);
        if (curr === undefined) break;
      }
      path.reverse();
      if (walkable(tx, tz) && Math.hypot(tx - (GRID_X + en.a * GRID), tz - (GRID_Z + en.b * GRID)) < 0.55) path.push({ x: tx, z: tz });
      return path;
    }
    closed.add(n);
    const a = n % GRID_W, b = Math.floor(n / GRID_W);
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const na = a + da, nb = b + db, j = idx(na, nb);
      if (na < 0 || na >= GRID_W || nb < 0 || nb >= GRID_H || closed.has(j)) continue;
      const x = GRID_X + na * GRID, z = GRID_Z + nb * GRID;
      if (!walkable(x, z)) continue;
      if (da && db && (!walkable(GRID_X + a * GRID, z) || !walkable(x, GRID_Z + b * GRID))) continue;
      const score = scores.get(n) + (da && db ? 1.414 : 1);
      if (!scores.has(j) || score < scores.get(j)) {
        scores.set(j, score);
        parents.set(j, n);
        if (!inOpen.has(j)) { open.push(j); inOpen.add(j); }
      }
    }
  }
  return null;
}
function standFor(o) {
  if (o.id === 'june' || o.id === 'eli') {
    const guest = o.id === 'june' ? npc : friend2;
    const candidates = [[guest.x + 0.9, guest.z + 0.25], [guest.x - 0.9, guest.z], [guest.x, guest.z + 0.9], [guest.x, guest.z - 0.9]];
    return candidates.find((p) => walkable(p[0], p[1])) || [guest.x + 0.9, guest.z];
  }
  if (o.stand) return o.stand;
  const a = o.rot || 0;
  const candidates = [[0, o.d / 2 + 0.5], [o.w / 2 + 0.5, 0], [-o.w / 2 - 0.5, 0], [0, -o.d / 2 - 0.5]];
  for (const p of candidates) {
    const x = o.x + p[0] * Math.cos(a) - p[1] * Math.sin(a), z = o.z + p[0] * Math.sin(a) + p[1] * Math.cos(a);
    if (walkable(x, z)) return [x, z];
  }
  return [o.x + 0.9, o.z + 0.5];
}

/* ================================================================ actions */

function queueAction(objId, actionId, custom = null) {
  if (mode !== 'live') setMode('live');
  if (!started) beginPlay();
  if (actor.queue.length >= 4) {
    toast('One thing at a time.', 'You can queue up to four more actions.', 'clock');
    return false;
  }
  const err = availableAction(actionId);
  if (err) {
    toast('Not just yet.', err, 'heart', true);
    return false;
  }
  actor.queue.push({ objId, actionId, custom });
  closeContext();
  clickSound();
  if (!actor.current) startNext();
  updateUI();
  return true;
}
function startNext() {
  if (actor.current || !actor.queue.length) return;
  const task = actor.queue.shift(), a = ACTIONS[task.actionId], o = task.custom || objById(task.objId);
  if (!a || !o) {
    startNext();
    return;
  }
  if (task.objId === 'june' && !npc.visible) {
    toast('June is out right now.', 'Use the mailbox to invite her over.', 'mail');
    startNext();
    return;
  }
  if (task.objId === 'eli' && (!friend2.visible || friend2.leaving)) {
    toast('Eli has gone home.', 'Invite everyone over again some other day.', 'social');
    startNext();
    return;
  }
  if (task.objId === 'cat') {
    o.path = [];
    if (state.flags.miso) delete o.stand;
  }
  let target = standFor(o);
  if (a.anim === 'sit' || (task.actionId === 'nap' && o.type === 'sofa')) target = objects.find((x) => x.id === 'sofa').stand;
  const path = findPath(actor.x, actor.z, target[0], target[1]);
  if (!path) {
    toast('That spot is hard to reach.', 'Leave a clear path around the furniture.', 'walk', true);
    speak(actor, 'No clear path');
    startNext();
    return;
  }
  actor.current = { ...task, elapsed: 0, duration: a.duration, paid: false, target };
  actor.path = path;
  actor.phase = path.length ? 'walking' : 'working';
  if (task.objId === 'june') npc.path = [];
  if (task.objId === 'eli') friend2.path = [];
  if (!path.length) startWorking();
  idleTimer = 0;
  updateUI();
}
function startWorking() {
  const c = actor.current;
  if (!c) return;
  const a = ACTIONS[c.actionId], o = c.custom || objById(c.objId);
  if (!o) {
    cancelCurrent();
    return;
  }
  const err = availableAction(c.actionId);
  if (err) {
    toast('Plans changed.', err, a.icon, true);
    cancelCurrent();
    return;
  }
  const cost = actionCost(c.actionId);
  if (!c.paid && cost) {
    state.money -= cost;
    c.paid = true;
    floatText(actor.x, actor.z, `−$${cost}`, '#b68653');
  }
  actor.phase = 'working';
  actor.angle = Math.atan2(o.x - actor.x, o.z - actor.z);
  if (c.objId === 'eli') {
    friend2.path = [];
    friend2.angle = Math.atan2(actor.x - friend2.x, actor.z - friend2.z);
  }
  if (c.objId === 'june') {
    npc.angle = Math.atan2(actor.x - npc.x, actor.z - npc.z);
    npc.path = [];
  }
  if (c.actionId === 'walk') {
    completeAction();
    return;
  }
  if (a.say) speak(actor, a.say, 3);
  else if (['cook', 'wash', 'shower', 'sleep', 'chat', 'pet'].includes(a.anim)) speak(actor, { cook: 'A pinch of this…', wash: 'Much better', shower: 'Fresh start!', sleep: 'Z z z', chat: 'So, tell me…', pet: 'Hello, little friend' }[a.anim], 3);
  updateUI();
}
function cancelCurrent() {
  const c = actor.current;
  if (c && c.paid && c.elapsed < c.duration) {
    const refund = Math.floor(actionCost(c.actionId) * (1 - c.elapsed / c.duration));
    if (refund > 0) state.money += refund;
  }
  actor.current = null;
  actor.path = [];
  actor.phase = 0;
  idleTimer = 0;
  startNext();
  updateUI();
}
function completeAction() {
  const c = actor.current;
  if (!c) return;
  const a = ACTIONS[c.actionId];
  if (c.actionId !== 'walk') state.stats.actions++;
  if (a.skill) {
    state.skills[a.skill[0]] = Math.min(100, (state.skills[a.skill[0]] || 0) + a.skill[1]);
    floatText(actor.x, actor.z, `+ ${a.skill[0]}`, '#65946c');
  }
  if (a.meal) {
    state.flags.meal = true;
    state.stats.meals++;
    state.leftovers = Math.min(6, state.leftovers + (c.actionId === 'bites' ? 3 : 1));
    state.dishes++;
    speak(actor, c.actionId === 'stew' ? 'Straight from the garden.' : ['Made with love.', 'Not bad at all!', 'Chef of this house.'][state.stats.meals % 3]);
    toast('Something good is cooking.', 'You ate well. The leftovers are on the table.', 'food');
  }
  if (a.fresh) state.flags.fresh = true;
  if (a.friend) {
    const amount = state.needs.hygiene < 15 ? Math.max(3, a.friend - 10) : a.friend;
    const was = state.friendship;
    state.friendship = clamp(state.friendship + amount, 0, 100);
    floatText(npc.x, npc.z, `+${amount} friendship`, '#7c9761');
    if (was < 30 && state.friendship >= 30) {
      state.flags.friend = true;
      toast('A new friend next door.', 'June thinks this is the start of something good.', 'heart');
      speak(npc, 'We should do this again!');
    } else if (was < 70 && state.friendship >= 70) {
      toast('Good friends, for real.', 'June says your place feels like a second home.', 'heart');
      speak(npc, 'You are the best neighbor.');
    } else speak(npc, c.actionId === 'joke' ? 'That was terrible. I love it.' : 'I like your little place.');
    if (state.party) state.party.chats++;
  }
  if (a.guestSocial) {
    speak(friend2, c.actionId === 'partyjoke' ? 'You two have the same jokes!' : 'Thanks for having me over.');
    if (state.party) state.party.chats++;
  }
  if (a.produce) state.produce = Math.max(0, state.produce - a.produce);
  if (a.pay) {
    let pay = a.pay;
    if (c.actionId === 'sellveg') pay += Math.floor(state.skills.gardening / 20) * 6;
    else pay += Math.floor(state.skills.creativity / 20) * (c.actionId === 'paint' ? 15 : 20);
    state.money += pay;
    state.stats.earned += pay;
    floatText(actor.x, actor.z, `+$${pay}`, '#528b63');
    if (c.actionId === 'sellveg') toast('Fresh from the garden.', `A neighbor paid $${pay} for your veggies.`, 'wallet');
    else toast(c.actionId === 'paint' ? 'Art paid the bills.' : 'A little work paid off.', `You earned $${pay}. Nice work!`, 'wallet');
  }
  if (c.actionId === 'paint') state.stats.paintings++;
  if (c.actionId === 'leftovers') {
    state.leftovers = Math.max(0, state.leftovers - 1);
    state.dishes++;
  }
  if (c.actionId === 'clear' || c.actionId === 'tidy') {
    state.dishes = 0;
    speak(actor, 'Room to breathe.');
  }
  if (c.actionId === 'bills') {
    state.bills = 0;
    toast('All paid up.', 'One less thing on your mind.', 'check');
  }
  if (c.actionId === 'invite') inviteJune();
  if (c.actionId === 'pet') {
    if (!state.flags.miso) {
      state.misoBond = Math.min(100, state.misoBond + 25);
      const cat = catObj();
      if (cat) floatText(cat.x, cat.z, '+25 trust', '#c08a5a');
      if (state.misoBond >= 100) adoptMiso();
      else speak(actor, ['Miso approves.', 'Purr-fect.', 'Almost friends.'][Math.floor(state.misoBond / 25) % 3]);
    } else speak(actor, 'Miso approves.');
  }
  if (c.actionId === 'playcat') speak(actor, 'Who is a good cat?');
  if (c.actionId === 'tend') {
    state.garden.water = 480;
    state.garden.growth = Math.min(100, state.garden.growth + 8);
    const g = gardenObj();
    floatText(g.x, g.z, 'Watered', '#5f8f8a');
    if (state.garden.growth >= 100) toast('The garden is ripe.', 'Click the garden to harvest your veggies.', 'plant');
  }
  if (c.actionId === 'harvest') {
    state.produce = Math.min(99, state.produce + 3);
    state.garden.growth = 0;
    state.stats.harvests++;
    state.flags.harvest = true;
    toast('A basket full of good.', 'Three baskets of veggies. Cook a stew, sell some, or save one for dinner.', 'plant');
    speak(actor, 'Homegrown!');
  }
  if (c.actionId === 'supper' && state.party) {
    state.party.served = true;
    state.party.chats++;
    speak(npc, 'You grew all this?');
    speak(friend2, 'Best dinner in Bramble Bay.');
  }
  if (c.actionId === 'evening') speak(actor, 'What a lovely light.');
  actor.current = null;
  actor.path = [];
  actor.phase = 0;
  checkGoals();
  saveGame();
  startNext();
  updateUI();
  positiveSound();
  if (c.actionId !== 'walk') buzz(c.actionId === 'harvest' ? 0.4 : 0.2, c.actionId === 'harvest' ? 120 : 60);
}
function tickActor(entity, dt, speed = 1.9) {
  if (!entity.path || !entity.path.length) return false;
  let budget = dt * speed;
  while (budget > 0 && entity.path.length) {
    const p = entity.path[0], dx = p.x - entity.x, dz = p.z - entity.z, d = Math.hypot(dx, dz);
    if (d < 0.025) {
      entity.x = p.x;
      entity.z = p.z;
      entity.path.shift();
      continue;
    }
    entity.angle = Math.atan2(dx, dz);
    if (d <= budget) {
      entity.x = p.x;
      entity.z = p.z;
      budget -= d;
      entity.path.shift();
    } else {
      entity.x += (dx / d) * budget;
      entity.z += (dz / d) * budget;
      budget = 0;
    }
  }
  return true;
}
/** A little controller rumble for good moments (only on a gamepad; phones stay quiet). */
function buzz(strength, ms) {
  if (input.source === 'gamepad') input.rumble(strength, ms);
}
function speak(who, text, duration = 3) {
  who.bubble = text;
  who.bubbleEnd = realTime + duration;
}
function floatText(x, z, text, color = '#658654') {
  floaters.push({ x, z, text, color, t: 0 });
}
function inviteJune() {
  npc.visible = true;
  npc.path = findPath(npc.x, npc.z, 1.95, 2.0) || [];
  speak(npc, 'Hey, neighbor!', 4);
  toast('Good company is on the way.', 'June is coming over. Click her to say hello.', 'social');
  updateUI();
}
function adoptMiso(silent = false) {
  state.flags.miso = true;
  state.misoBond = 100;
  const cat = catObj();
  if (!cat) return;
  cat.name = 'Miso';
  cat.desc = 'Your cat. Officially.';
  delete cat.stand;
  cat.outdoor = false;
  cat.mobile = true;
  cat.path = [];
  cat.idle = 0;
  cat.angle = 0;
  if (silent) {
    const p = state.misoPos;
    if (p && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x) < 9 && Math.abs(p.z) < 10) {
      cat.x = p.x;
      cat.z = p.z;
    } else {
      cat.x = -2.6;
      cat.z = -0.3;
    }
    return;
  }
  cat.path = findPath(cat.x, cat.z, -2.3, 3.1) || [];
  toast('Miso has chosen you.', 'Your new roommate is moving in. Find Miso around the house.', 'cat');
  speak(actor, 'Welcome home, Miso!', 4);
  confetti(30);
  buzz(0.5, 160);
}
function sendEliHome() {
  if (!friend2.visible) return;
  actor.queue = actor.queue.filter((q) => q.objId !== 'eli');
  if (actor.current?.objId === 'eli') cancelCurrent();
  friend2.leaving = true;
  friend2.path = findPath(friend2.x, friend2.z, 2.2, 9.0) || [];
  speak(friend2, 'Thanks for having me!', 4);
}
function checkGoals() {
  state.flags.friend = state.friendship >= 30 || state.flags.friend;
  state.flags.bestie = state.friendship >= 70 || state.flags.bestie;
  state.flags.artist = state.stats.paintings >= 3 || state.flags.artist;
  const all1 = CH1.every(([k]) => state.flags[k]);
  if (all1 && !state.flags.readyNotified && !state.flags.won) {
    state.flags.readyNotified = true;
    toast('This place is ready for company.', 'Start your housewarming from the story card.', 'trophy');
    positiveSound();
  }
  const all2 = CH2.every(([k]) => state.flags[k]);
  if (state.flags.won && all2 && !state.flags.readyNotified2 && !state.flags.won2) {
    state.flags.readyNotified2 = true;
    toast('Ready for a garden dinner.', 'Host it from the story card. Keep a basket of veggies to serve.', 'trophy');
    positiveSound();
  }
  updateStory();
}
function beginPlay() {
  if (started) {
    setSpeed(gameSpeed || 1);
    return;
  }
  started = true;
  state.started = true;
  if (W < 621) storyCollapsed = true;
  setSpeed(1);
  put('save-label', 'text', 'Saved locally');
  updateStory();
  if (!loadedGame) {
    toast('Welcome to your little lot.', 'Click the fridge to make your first meal.', 'home');
    setTimeout(() => {
      if (started && !npc.path.length) inviteJune();
    }, 3500);
  } else toast('Welcome back home.', 'Your needs, friends, money, and furniture are saved.', 'home');
  saveGame();
}
function setSpeed(s) {
  if (mode === 'buy' && s > 0) return;
  if (!started && s > 0) {
    beginPlay();
    return;
  }
  gameSpeed = s;
  if (s > 0) lastSpeed = s;
  renderSpeed();
  updateUI();
}
function beginGathering(kind) {
  if (!started) beginPlay();
  if (mode === 'buy') setMode('live');
  if (gameSpeed === 0) setSpeed(1);
  const total = kind === 'dinner' ? 150 : 130;
  state.party = { kind, remaining: total, total, chats: 0, moodTotal: 0, samples: 0, served: false };
  npc.visible = true;
  npc.path = findPath(npc.x, npc.z, 1.9, 2.15) || [];
  friend2.visible = true;
  friend2.leaving = false;
  friend2.x = 0.3;
  friend2.z = 8.5;
  friend2.path = findPath(friend2.x, friend2.z, -0.15, 2.85) || [];
  updateStory();
  updateUI();
  saveGame();
  confetti(50);
}
function startParty() {
  if (state.flags.won || state.party) return;
  if (!CH1.every(([k]) => state.flags[k])) {
    toast('A few little things first.', 'Finish the four goals to get ready for guests.', 'star');
    return;
  }
  beginGathering('house');
  toast('The housewarming is on!', 'Chat with June, play music, and enjoy your home.', 'music');
  speak(actor, 'Come on in!', 4);
}
function startDinner() {
  if (!state.flags.won || state.flags.won2 || state.party) return;
  if (!CH2.every(([k]) => state.flags[k])) {
    toast('A few little things first.', 'Finish the four goals to get ready for dinner.', 'star');
    return;
  }
  beginGathering('dinner');
  toast('The garden dinner is on!', state.produce ? 'Serve the harvest supper at the gathering table.' : 'No veggies left? Harvest more, or just enjoy the company.', 'food');
  speak(actor, 'Dinner is almost ready!', 4);
}
function endParty() {
  if (!state.party) return;
  const p = state.party;
  const avg = p.samples ? p.moodTotal / p.samples : avgNeeds();
  buzz(0.6, 220);
  state.stats.parties++;
  state.party = null;
  sendEliHome();
  if (p.kind === 'dinner') {
    const score = Math.round(clamp(52 + avg * 0.3 + Math.min(3, p.chats) * 5 + (p.served ? 10 : 0) + (state.flags.miso ? 3 : 0), 0, 100));
    state.flags.won2 = true;
    state.money += 250;
    state.stats.earned += 250;
    state.lastDinnerScore = score;
    confetti(130);
    saveGame();
    updateStory();
    showModal(`<div class="eyebrow">${icon('trophy')} CHAPTER 02, COMPLETE</div><h2>Room to grow.</h2><p>A garden, a cat, and a table full of friends. Your garden dinner was ${score >= 85 ? 'a hit' : 'a lovely evening'}${p.served ? ', and everyone asked for seconds' : ''}.</p><div class="modal-stats"><div class="stat"><b>${score}</b><span>DINNER SCORE / 100</span></div><div class="stat"><b>${state.stats.harvests}</b><span>HARVESTS</span></div><div class="stat"><b>+$250</b><span>NEIGHBOR GIFT</span></div></div><div class="note-box">Every chapter is done. Your little life goes on: grow, paint, play with Miso, and make this lot all yours.</div><button class="green-btn" id="keep-playing">${icon('home')} Keep living a little</button>`);
    $('keep-playing').onclick = hideModal;
    positiveSound();
    return;
  }
  const score = Math.round(clamp(55 + avg * 0.32 + Math.min(3, p.chats) * 5 + Math.min(state.leftovers, 3) * 2, 0, 100));
  state.flags.won = true;
  state.money += 150;
  state.stats.earned += 150;
  state.lastPartyScore = score;
  confetti(130);
  saveGame();
  checkGoals();
  showModal(`<div class="eyebrow">${icon('trophy')} YOUR FIRST CHAPTER, COMPLETE</div><h2>Home, sweet little home.</h2><p>You made a meal, made a friend, and made this place your own. Your first housewarming was ${score >= 85 ? 'a hit' : 'a lovely start'}.</p><div class="modal-stats"><div class="stat"><b>${score}</b><span>PARTY SCORE / 100</span></div><div class="stat"><b>${state.friendship}</b><span>FRIENDSHIP / 100</span></div><div class="stat"><b>+$150</b><span>WELCOME GIFT</span></div></div><div class="note-box">The story goal is complete. Your life here is not: chapter two is waiting on the story card. Grow a garden, win over Miso, and gather everyone for dinner.</div><button class="green-btn" id="keep-playing">${icon('home')} Keep living a little</button>`);
  $('keep-playing').onclick = hideModal;
  positiveSound();
}

/* ================================================================ simulation */

function simulation(dt) {
  if (!started || gameSpeed === 0 || modalOpen || mode === 'buy') return;
  const mult = gameSpeed, simDt = dt * mult, gm = simDt * 3;
  simTime += simDt;
  state.time += gm;
  const day = Math.floor(state.time / 1440) + 1;
  if (day > state.lastBillDay) {
    state.bills += 45;
    state.lastBillDay = day;
    toast('A new day on Clover Lane.', '$45 in household bills arrived at the mailbox.', 'mail');
  }
  const rates = { hunger: 0.094, energy: 0.046, fun: 0.06, social: 0.044, hygiene: 0.039, bladder: 0.086 };
  for (const [k] of NEEDS) state.needs[k] = clamp(state.needs[k] - rates[k] * gm, 0, 100);
  if (actor.current) {
    const c = actor.current;
    if (actor.phase === 'walking') {
      tickActor(actor, simDt);
      if (!actor.path.length) startWorking();
    } else if (actor.phase === 'working') {
      const a = ACTIONS[c.actionId], step = Math.min(gm, c.duration - c.elapsed);
      for (const k in a.gain || {}) state.needs[k] = clamp(state.needs[k] + (a.gain[k] * step) / c.duration, 0, 100);
      c.elapsed += step;
      if (c.elapsed >= c.duration - 0.001) completeAction();
    }
  } else {
    idleTimer += gm;
    if (actor.queue.length) startNext();
    else if (state.autonomy && idleTimer > 15) {
      let lowK = 'hunger';
      for (const [k] of NEEDS) if (state.needs[k] < state.needs[lowK]) lowK = k;
      if (state.needs[lowK] < 40) autoNeed(lowK, true);
      idleTimer = 0;
    }
  }
  const busyWithJune = actor.current?.objId === 'june';
  if (npc.visible && !busyWithJune) {
    tickActor(npc, simDt, 1.35);
    npc.idle += gm;
    if (npc.idle > 115 && !npc.path.length) {
      npc.idle = 0;
      const spots = [[1.95, 2.15], [-0.45, 5.7], [2.7, 1.0], [1.9, -0.3]];
      const p = spots[Math.floor(randSeed(state.time) * spots.length)];
      npc.path = findPath(npc.x, npc.z, p[0], p[1]) || [];
    }
  }
  if (friend2.visible && actor.current?.objId !== 'eli') {
    tickActor(friend2, simDt, 1.4);
    if (friend2.leaving && !friend2.path.length) {
      friend2.visible = false;
      friend2.leaving = false;
    }
  }
  // Miso, once adopted, wanders the house (and naps in a cat bed at night).
  const cat = catObj();
  if (state.flags.miso && cat && actor.current?.objId !== 'cat') {
    tickActor(cat, simDt, 1.15);
    cat.idle = (cat.idle || 0) + gm;
    if (cat.idle > 100 && !cat.path.length) {
      cat.idle = 0;
      const tod = state.time % 1440;
      const bed = (tod > 1260 || tod < 360) && objects.find((o) => o.type === 'catbed');
      const spot = bed ? [bed.x, bed.z] : MISO_SPOTS[Math.floor(randSeed(state.time + 7) * MISO_SPOTS.length)];
      cat.path = findPath(cat.x, cat.z, spot[0], spot[1]) || [];
    }
  }
  // The kitchen garden grows while its soil is wet.
  const g = state.garden;
  if (g.water > 0) {
    g.water = Math.max(0, g.water - gm);
    if (g.growth < 100) {
      g.growth = Math.min(100, g.growth + (gm * 100) / 600);
      if (g.growth >= 100) toast('The garden is ripe.', 'Click the garden to harvest your veggies.', 'plant');
    }
  }
  if (state.party) {
    state.party.remaining -= gm;
    state.party.moodTotal += avgNeeds() * gm;
    state.party.samples += gm;
    if (state.party.remaining <= 0) endParty();
  }
  state.accidentCooldown = Math.max(0, state.accidentCooldown - gm);
  state.exhaustionCooldown = Math.max(0, state.exhaustionCooldown - gm);
  if (state.needs.bladder <= 0 && state.accidentCooldown === 0) {
    state.needs.bladder = 42;
    state.needs.hygiene = Math.max(0, state.needs.hygiene - 28);
    state.needs.fun = Math.max(0, state.needs.fun - 8);
    state.accidentCooldown = 120;
    toast('Well, that happened.', 'A shower will help. Click the bladder bar for the toilet.', 'bladder', true);
    speak(actor, 'Oh, no…', 4);
  }
  if (state.needs.energy <= 0 && state.exhaustionCooldown === 0) {
    state.exhaustionCooldown = 150;
    state.needs.energy = 8;
    const pending = actor.queue;
    actor.queue = [];
    if (actor.current) cancelCurrent();
    actor.queue = [{ objId: 'bed', actionId: 'nap' }, ...pending];
    startNext();
    toast('Time for a little rest.', 'Mara is heading to bed for a power nap.', 'bed', true);
  }
  if (state.needs.hunger < 10 && Math.floor(state.time / 60) !== state.lastHungerWarn) {
    state.lastHungerWarn = Math.floor(state.time / 60);
    toast('That little stomach is growling.', 'Make a meal, or eat the leftovers on the table.', 'food', true);
  }
}
function autoNeed(k, automatic = false) {
  const map = {
    hunger: [state.leftovers ? 'dining' : 'fridge', state.leftovers ? 'leftovers' : state.money >= 12 ? 'toastie' : 'snack'],
    energy: ['bed', 'sleep'], fun: ['sofa', 'tv'], social: ['june', 'hello'], hygiene: ['shower', 'shower'], bladder: ['toilet', 'toilet'],
  };
  const [o, a] = map[k];
  if (!automatic) queueAction(o, a);
  else if (!availableAction(a)) {
    actor.queue.push({ objId: o, actionId: a });
    startNext();
  }
}
const _rp = { x: 0, z: 0, y: 0, angle: 0, sit: false, sleep: false };
function residentPosition() {
  let x = actor.x, z = actor.z, y = roomY, angle = actor.angle, sit = false, sleep = false;
  const c = actor.current, a = c && ACTIONS[c.actionId], o = c && (c.custom || objById(c.objId));
  if (actor.phase === 'working' && a && o) {
    if (a.anim === 'sleep' && o.type === 'bed') {
      x = o.x; z = o.z; angle = 0; sleep = true;
    } else if (a.anim === 'sit' || (a.anim === 'sleep' && o.type === 'sofa')) {
      const sofa = objects.find((s) => s.id === 'sofa');
      x = sofa.x; z = sofa.z + 0.14; sit = true; y += 0.28; angle = 0;
    } else if (a.anim === 'type' && o.type === 'computer') {
      x = o.x; z = o.z + 0.83; sit = true; y += 0.25; angle = Math.PI;
    } else if (a.anim === 'shower') {
      x = o.x; z = o.z + 0.1; y += 0.12; angle = Math.PI;
    } else if (a.anim === 'toilet') {
      x = o.x; z = o.z + 0.2; y += 0.03; sit = true; angle = 0;
    } else if (a.anim === 'dance') {
      angle += Math.sin(simTime * 3) * 0.6;
      y += Math.abs(Math.sin(simTime * 6)) * 0.06;
    }
  }
  if (Math.abs(x) > 5.5 || z > 4.65 || z < -4.5) y = 0.02;
  _rp.x = x; _rp.z = z; _rp.y = y; _rp.angle = angle; _rp.sit = sit; _rp.sleep = sleep;
  return _rp;
}

/* ================================================================ the 3D scene */

const scene = new THREE.Scene();
scene.name = 'Little Lot';
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);

// The original lit every face with one fixed light in sRGB space and laid a
// navy veil over the scene at night. The block material does the same per pixel.
const uNight = uniform(0);
const uGlow = uniform(0);
const NIGHT = vec3(38 / 255, 66 / 255, 97 / 255);
const LIGHT = vec3(-0.48, 0.82, 0.3);
function blockMaterial(name, opts = {}, alphaScale = 1) {
  const m = new THREE.MeshBasicNodeMaterial({ name, ...opts });
  const vc = vertexColor();
  const lit = float(0.75).add(max(dot(normalWorld, LIGHT), 0).mul(0.3));
  const srgb = mix(vc.rgb.mul(lit), NIGHT, uNight);
  m.colorNode = vec4(sRGBTransferEOTF(srgb), vc.a.mul(alphaScale));
  return m;
}
const matSolid = blockMaterial('blocks');
const matSoft = blockMaterial('soft', { transparent: true, depthWrite: false });
const matGhost = blockMaterial('ghost', { transparent: true, depthWrite: false }, 0.55);
const matMarker = blockMaterial('marker', { transparent: true, depthWrite: false });
const glowMat = new THREE.MeshBasicNodeMaterial({ name: 'lamp glow', transparent: true, depthWrite: false });
glowMat.colorNode = vec4(sRGBTransferEOTF(vec3(1, 210 / 255, 112 / 255)), saturate(float(1).sub(length(uv().sub(0.5)).mul(2))).pow(1.5).mul(uGlow));
const gridMat = new THREE.LineBasicMaterial({ name: 'build grid', color: 0x5c826b, transparent: true, opacity: 0.2, depthWrite: false });
{
  // The soft radial backdrop the lot floats on.
  const px = screenUV.sub(vec2(0.5, 0.43)).mul(screenSize);
  const t = saturate(length(px).div(max(screenSize.x, screenSize.y).mul(0.7)));
  const bg = mix(mix(vec3(0xe9 / 255, 0xee / 255, 0xdd / 255), vec3(0xd5 / 255, 0xe1 / 255, 0xcd / 255), t), NIGHT, uNight);
  scene.backgroundNode = vec4(sRGBTransferEOTF(bg), 1);
}

const pickables = [];
const staticMeshes = [];
let staticFloor = -1;
const furnitureRoot = new THREE.Group();
furnitureRoot.name = 'furniture';
scene.add(furnitureRoot);
const objGroups = new Map();
const furnitureGeo = new Map();

function geomPair(faces) {
  return { solid: B.toGeometry(faces, 'solid'), soft: B.toGeometry(faces, 'soft') };
}
function pairGroup(pair, pickId, solidMat = matSolid, softMat = matSoft) {
  const grp = new THREE.Group();
  if (pair.solid) {
    const m = new THREE.Mesh(pair.solid, solidMat);
    if (pickId) {
      m.userData.pickId = pickId;
      pickables.push(m);
    }
    grp.add(m);
  }
  if (pair.soft) grp.add(new THREE.Mesh(pair.soft, softMat));
  return grp;
}
function furnitureGeom(type) {
  let g = furnitureGeo.get(type);
  if (!g) {
    g = geomPair(B.furnitureFaces(type));
    furnitureGeo.set(type, g);
  }
  return g;
}

// The gathering table and the garden are part of the lot, but can be clicked.
const dining = pairGroup(geomPair(B.diningFaces()), 'dining');
dining.position.set(0.6, roomY, 0.75);
scene.add(dining);
const fixedPickables = [...pickables];
let gardenGroup = null, gardenPair = null, gardenKey = '', gardenPct = -1;
function updateGardenVisual() {
  const g = state.garden;
  const stage = g.growth >= 100 ? 2 : g.growth >= 35 ? 1 : 0;
  const wet = g.water > 0;
  const key = stage + ':' + wet;
  const pct = Math.floor(g.growth);
  if (pct !== gardenPct || key !== gardenKey) {
    gardenPct = pct;
    const obj = gardenObj();
    if (obj) obj.desc = gardenStatus();
  }
  if (key === gardenKey) return;
  gardenKey = key;
  if (gardenGroup) {
    scene.remove(gardenGroup);
    const i = pickables.indexOf(gardenGroup.children[0]);
    if (i >= 0) pickables.splice(i, 1);
    gardenPair.solid?.dispose();
    gardenPair.soft?.dispose();
  }
  gardenPair = geomPair(B.gardenFaces(stage, wet));
  gardenGroup = pairGroup(gardenPair, 'garden');
  gardenGroup.position.set(-7.55, 0.2, -2.5);
  scene.add(gardenGroup);
}

// Food on the table and a basket of produce.
const foodGroup = new THREE.Group();
foodGroup.position.set(0.6, roomY, 0.75);
scene.add(foodGroup);
const plates = [0, 1, 2].map((i) => {
  const g = pairGroup(geomPair(B.plateFaces(i)));
  foodGroup.add(g);
  return g;
});
const leftoversMesh = pairGroup(geomPair(B.leftoversFaces()));
foodGroup.add(leftoversMesh);
const basketMesh = pairGroup(geomPair(B.basketFaces()));
basketMesh.position.set(-0.45, 0.92, -0.42);
foodGroup.add(basketMesh);
const balloons = [0, 1].map((q) => {
  const g = pairGroup(geomPair(B.balloonFaces(q)));
  g.position.set(q ? 1.55 : -1.55, 0.2, 4.8);
  scene.add(g);
  return g;
});
const gem = new THREE.Mesh(B.toGeometry(B.gemFaces(), 'solid'), matSolid);
gem.name = 'gem';
scene.add(gem);

// People are built in parts so they can walk, sit, gesture and sleep.
class PersonModel {
  constructor(style) {
    this.style = style;
    this.pick = style === 'mara' ? 'self' : style;
    this.group = new THREE.Group();
    this.group.name = style;
    scene.add(this.group);
    this.parts = {};
    this.build();
  }
  build() {
    for (const m of Object.values(this.parts)) {
      this.group.remove(m);
      m.geometry.dispose();
      const i = pickables.indexOf(m);
      if (i >= 0) pickables.splice(i, 1);
    }
    this.parts = {};
    const P = B.personParts(this.style, OUTFITS[state.outfit] || OUTFITS[0]);
    for (const [k, faces] of Object.entries(P)) {
      const soft = k === 'shadow';
      const geo = B.toGeometry(faces, soft ? 'soft' : 'solid');
      if (!geo) continue;
      const m = new THREE.Mesh(geo, soft ? matSoft : matSolid);
      m.name = `${this.style} ${k}`;
      if (!soft) {
        m.userData.pickId = this.pick;
        pickables.push(m);
      }
      this.group.add(m);
      this.parts[k] = m;
    }
  }
  pose(p, anim, swing, work) {
    const P = this.parts;
    this.group.position.set(p.x, p.y, p.z);
    this.group.rotation.y = p.angle;
    const sleep = !!p.sleep, sit = !sleep && !!p.sit, stand = !sleep && !sit;
    P.sleep.visible = sleep;
    P.sitLegs.visible = sit;
    P.legL.visible = P.legR.visible = stand;
    P.upper.visible = P.armUL.visible = P.armUR.visible = P.armLL.visible = P.armLR.visible = !sleep;
    const b = anim === 'pet' ? -0.25 : 0;
    P.upper.position.y = b;
    P.legL.position.z = -swing;
    P.legR.position.z = swing;
    const gesture = work && GESTURES.has(anim);
    const azL = gesture ? 0.13 + Math.sin(simTime * 6 - 1) * 0.08 : swing;
    const azR = gesture ? 0.13 + Math.sin(simTime * 6 + 1) * 0.08 : -swing;
    const dyL = gesture ? 0.1 + Math.sin(simTime * 4 - 1) * 0.045 : 0;
    const dyR = gesture ? 0.1 + Math.sin(simTime * 4 + 1) * 0.045 : 0;
    P.armUL.position.set(0, b, azL);
    P.armUR.position.set(0, b, azR);
    P.armLL.position.set(0, b + dyL, azL);
    P.armLR.position.set(0, b + dyR, azR);
    P.book.visible = !sleep && work && anim === 'read';
    P.can.visible = !sleep && work && anim === 'water';
    P.plate.visible = !sleep && work && anim === 'eat';
  }
}
let maraModel = null, juneModel = null, eliModel = null;

// Floor markers: the ring under Mara, the click ripple, footprints, the build grid.
// Vertex colours hold the palette's sRGB values; the block material converts them.
const srgbOf = (hex) => {
  const v = parseInt(hex.slice(1, 7), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};
function ringGeometry(inner, outer, hex, alpha, segments = 40) {
  const pos = [], nor = [], col = [];
  const rgb = srgbOf(hex);
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
    const o0 = [Math.cos(a0) * outer, 0, Math.sin(a0) * outer], i0 = [Math.cos(a0) * inner, 0, Math.sin(a0) * inner];
    const o1 = [Math.cos(a1) * outer, 0, Math.sin(a1) * outer], i1 = [Math.cos(a1) * inner, 0, Math.sin(a1) * inner];
    for (const p of [o0, i0, i1, o0, i1, o1]) {
      pos.push(...p);
      nor.push(0, 1, 0);
      col.push(rgb[0], rgb[1], rgb[2], alpha);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.computeBoundingSphere();
  return g;
}
const maraRing = new THREE.Mesh(ringGeometry(0.485, 0.535, '#d9ee9e', 0.8), matSoft);
maraRing.name = 'resident ring';
scene.add(maraRing);
const clickRing = new THREE.Mesh(ringGeometry(0.9, 1.0, '#f6f8d2', 1), matMarker);
clickRing.name = 'click ripple';
clickRing.visible = false;
scene.add(clickRing);

class Footprint {
  constructor(name) {
    const n = 5 * 6;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 4);
    const nor = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) nor[i * 3 + 1] = 1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Mesh(g, matSoft);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.key = '';
    scene.add(this.mesh);
  }
  quad(q, x0, z0, x1, z1, rgb, alpha) {
    const P = this.pos, Cc = this.col;
    const corners = [x0, z1, x1, z1, x1, z0, x0, z0];
    const order = [0, 1, 2, 0, 2, 3];
    for (let k = 0; k < 6; k++) {
      const v = q * 6 + k, c = order[k];
      P[v * 3] = corners[c * 2];
      P[v * 3 + 1] = 0;
      P[v * 3 + 2] = corners[c * 2 + 1];
      Cc[v * 4] = rgb[0]; Cc[v * 4 + 1] = rgb[1]; Cc[v * 4 + 2] = rgb[2]; Cc[v * 4 + 3] = alpha;
    }
  }
  show(x, y, z, w, d, hex, fill) {
    const key = `${w.toFixed(3)}:${d.toFixed(3)}:${hex}:${fill}`;
    if (key !== this.key) {
      this.key = key;
      const rgb = srgbOf(hex), t = 0.045, hw = w / 2, hd = d / 2;
      this.quad(0, -hw, -hd, hw, hd, rgb, fill);
      this.quad(1, -hw, -hd, hw, -hd + t, rgb, 0.85);
      this.quad(2, -hw, hd - t, hw, hd, rgb, 0.85);
      this.quad(3, -hw, -hd + t, -hw + t, hd - t, rgb, 0.85);
      this.quad(4, hw - t, -hd + t, hw, hd - t, rgb, 0.85);
      this.mesh.geometry.attributes.position.needsUpdate = true;
      this.mesh.geometry.attributes.color.needsUpdate = true;
    }
    this.mesh.position.set(x, y, z);
    this.mesh.visible = true;
  }
  hide() {
    this.mesh.visible = false;
  }
}
const hoverPrint = new Footprint('hover footprint');
const ghostPrint = new Footprint('placement footprint');
const ghostGroup = new THREE.Group();
ghostGroup.name = 'placement ghost';
ghostGroup.visible = false;
scene.add(ghostGroup);
let ghostType = null;
function setGhostType(type) {
  if (type === ghostType) return;
  ghostType = type;
  ghostGroup.clear();
  if (!type) return;
  const g = furnitureGeom(type);
  if (g.solid) ghostGroup.add(new THREE.Mesh(g.solid, matGhost));
  if (g.soft) ghostGroup.add(new THREE.Mesh(g.soft, matGhost));
}
const grid = (() => {
  const pts = [];
  for (let i = -5; i <= 5; i += 0.5) pts.push(i, 0.262, -4.4, i, 0.262, 4.4);
  for (let i = -4; i <= 4.4; i += 0.5) pts.push(-5.4, 0.262, i, 5.4, 0.262, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(g, gridMat);
  l.name = 'build grid';
  l.visible = false;
  scene.add(l);
  return l;
})();
const glowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const glows = [];
function placeGlows() {
  const spots = [...LAMPS.map(([x, z]) => [x, roomY + 0.045, z, 4.2]), ...objects.filter((o) => o.type === 'lantern').map((o) => [o.x, floorAt(o.x, o.z) + 0.05, o.z, 3.6])];
  while (glows.length < spots.length) {
    const m = new THREE.Mesh(glowGeo, glowMat);
    m.name = 'lamp glow';
    m.renderOrder = 1;
    scene.add(m);
    glows.push(m);
  }
  glows.forEach((m, i) => {
    const s = spots[i];
    m.userData.on = !!s;
    if (!s) return;
    m.position.set(s[0], s[1], s[2]);
    m.scale.set(s[3], 1, s[3]);
  });
}

function buildStaticWorld() {
  if (staticFloor === state.floor) return;
  for (const m of staticMeshes) {
    scene.remove(m);
    m.geometry.dispose();
  }
  staticMeshes.length = 0;
  const faces = B.buildStatic(state.floor);
  for (const [kind, mat] of [['solid', matSolid], ['soft', matSoft]]) {
    const geo = B.toGeometry(faces, kind);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mat);
    m.name = `lot (${kind})`;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    scene.add(m);
    staticMeshes.push(m);
  }
  staticFloor = state.floor;
}
function makeFurniture(o) {
  if (o.virtual) return;
  const grp = pairGroup(furnitureGeom(o.type), o.id);
  grp.name = o.id;
  grp.position.set(o.x, o.outdoor ? 0.02 : roomY, o.z);
  grp.rotation.y = -(o.rot || 0);
  furnitureRoot.add(grp);
  objGroups.set(o.id, grp);
}
function buildWorld() {
  buildStaticWorld();
  furnitureRoot.clear();
  objGroups.clear();
  pickables.length = 0;
  pickables.push(...fixedPickables);
  if (gardenGroup) pickables.push(gardenGroup.children[0]);
  for (const m of [maraModel, juneModel, eliModel]) if (m) for (const [k, p] of Object.entries(m.parts)) if (k !== 'shadow') pickables.push(p);
  for (const o of objects) makeFurniture(o);
  placeGlows();
}

/* ================================================================ per-frame scene */

const lastView = { ox: NaN, oy: NaN, unit: NaN, yaw: NaN };
let hoverStale = true, overlayDirty = true;
function updateView(dt) {
  const k = 1 - Math.exp(-12 * dt);
  viewYaw = Math.abs(yawTarget - viewYaw) < 1e-4 ? yawTarget : viewYaw + (yawTarget - viewYaw) * k;
  zoom = Math.abs(zoomTarget - zoom) < 1e-4 ? zoomTarget : zoom + (zoomTarget - zoom) * k;
  ca = Math.cos(viewYaw);
  sa = Math.sin(viewYaw);
  unit = baseUnit * zoom;
  const ox = centerX + pan.x, oy = centerY + pan.y;
  camera.left = -ox / unit;
  camera.right = (W - ox) / unit;
  camera.top = oy / unit;
  camera.bottom = -(H - oy) / unit;
  camera.position.set(sa * ce * 60, se * 60, ca * ce * 60);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const v = lastView;
  if (Math.abs(ox - v.ox) > 0.05 || Math.abs(oy - v.oy) > 0.05 || Math.abs(unit - v.unit) > 1e-3 || Math.abs(viewYaw - v.yaw) > 1e-4 || v.ox !== v.ox) {
    v.ox = ox;
    v.oy = oy;
    v.unit = unit;
    v.yaw = viewYaw;
    hoverStale = true;
    overlayDirty = true;
  }
}
const _gp = { x: 0, z: 0, y: 0, angle: 0, sit: false, sleep: false };
function poseGuest(model, who) {
  model.group.visible = !!who.visible;
  if (!who.visible) return;
  _gp.x = who.x;
  _gp.z = who.z;
  _gp.y = isIndoor(who.x, who.z) ? roomY : 0.02;
  _gp.angle = who.angle;
  const moving = who.path && who.path.length > 0;
  model.pose(_gp, 'idle', moving ? Math.sin(simTime * 10) * 0.18 : 0, false);
}
let ghostKey = '', ghostOk = true;
const PEOPLE = new Set(['person', 'self', 'guest']);
const _fs = [0, 0];
function footprintSize(w, d, rot = 0) {
  const c = Math.abs(Math.cos(rot || 0)), s = Math.abs(Math.sin(rot || 0));
  _fs[0] = c * w + s * d;
  _fs[1] = s * w + c * d;
  return _fs;
}
function updateScene() {
  const ap = residentPosition();
  const c = actor.current;
  const work = actor.phase === 'working' && !!c;
  const anim = work ? ACTIONS[c.actionId].anim : 'idle';
  maraModel.pose(ap, anim, actor.path.length > 0 ? Math.sin(simTime * 10) * 0.18 : 0, work);
  poseGuest(juneModel, npc);
  poseGuest(eliModel, friend2);
  gem.position.set(ap.x, ap.sleep ? 1.66 : ap.y + 2.06 + Math.sin(realTime * 2) * 0.055, ap.z);
  gem.rotation.y = -realTime * 0.8;
  maraRing.position.set(ap.x, floorAt(ap.x, ap.z) + 0.04, ap.z);
  if (clickMarker) {
    clickRing.visible = true;
    const s = 0.32 + Math.min(0.3, clickMarker.t * 0.2);
    clickRing.position.set(clickMarker.x, floorAt(clickMarker.x, clickMarker.z) + 0.045, clickMarker.z);
    clickRing.scale.set(s, 1, s);
    matMarker.opacity = clamp(1 - clickMarker.t / 1.8, 0, 1);
  } else clickRing.visible = false;

  // Dishes, leftovers, produce and party balloons.
  const dishes = Math.min(state.dishes, 3);
  for (let i = 0; i < 3; i++) plates[i].visible = i < dishes;
  leftoversMesh.visible = state.leftovers > 0;
  basketMesh.visible = state.produce > 0;
  for (let q = 0; q < 2; q++) {
    balloons[q].visible = !!state.party;
    balloons[q].position.y = 0.2 + Math.sin(realTime * 1.6 + q * 2) * 0.04;
  }
  updateGardenVisual();

  // Miso walks once adopted.
  const cat = catObj();
  const catGroup = cat && objGroups.get('cat');
  if (catGroup && cat.mobile) {
    const onBed = objects.some((o) => o.type === 'catbed' && Math.abs(o.x - cat.x) < 0.35 && Math.abs(o.z - cat.z) < 0.3);
    const walking = cat.path && cat.path.length > 0;
    catGroup.position.set(cat.x, (isIndoor(cat.x, cat.z) ? roomY : 0.02) + (onBed ? 0.1 : 0) + (walking ? Math.abs(Math.sin(simTime * 12)) * 0.025 : 0), cat.z);
    catGroup.rotation.y = (cat.angle || 0) - Math.PI / 2;
  }

  // Hover highlight in live mode.
  const hov = hoverId && mode === 'live' && !modalOpen ? objById(hoverId) : null;
  if (hov && !PEOPLE.has(hov.type) && hov.w) {
    const base = hov.virtual && hov.outdoor ? 0.2 : hov.outdoor || !isIndoor(hov.x, hov.z) ? 0.02 : roomY;
    footprintSize(hov.w, hov.d, hov.rot);
    hoverPrint.show(hov.x, base + 0.035, hov.z, _fs[0], _fs[1], '#f1e4ac', 0.3);
  } else hoverPrint.hide();

  // Buy mode: grid, ghost and its footprint.
  grid.visible = mode === 'buy';
  if (mode === 'buy' && placing && ghostPos) {
    const s = SHOP.find((x) => x.type === placing);
    setGhostType(placing);
    const key = `${placing}:${ghostPos.x}:${ghostPos.z}:${placeRotation}:${movingId}:${objects.length}`;
    if (key !== ghostKey) {
      ghostKey = key;
      ghostOk = canPlace(s, ghostPos.x, ghostPos.z, placeRotation);
    }
    const y = Math.abs(ghostPos.x) > 5.5 || ghostPos.z > 4.5 || ghostPos.z < -4.5 ? 0.02 : roomY;
    ghostGroup.visible = true;
    ghostGroup.position.set(ghostPos.x, y + 0.01, ghostPos.z);
    ghostGroup.rotation.y = -placeRotation;
    footprintSize(s.w, s.d, placeRotation);
    ghostPrint.show(ghostPos.x, y + 0.04, ghostPos.z, _fs[0], _fs[1], ghostOk ? '#608d58' : '#c58765', 0.28);
  } else {
    ghostGroup.visible = false;
    ghostPrint.hide();
  }

  // Evening: the veil and the lamp pools.
  const tod = state.time % 1440;
  const dark = tod > 1080 ? clamp((tod - 1080) / 240, 0, 0.24) : tod < 360 ? 0.24 : tod < 480 ? clamp(((480 - tod) / 120) * 0.15, 0, 0.15) : 0;
  uNight.value = dark;
  uGlow.value = dark * 0.7;
  for (const g of glows) g.visible = dark > 0 && g.userData.on;
}

/* ================================================================ overlay (bubbles, floaters, steam) */

const overlay = $('overlay');
const oc = overlay.getContext('2d');
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
const hasBubble = (who) => !!who.bubble && realTime <= who.bubbleEnd;
function drawBubble(who, x, y, z) {
  if (!hasBubble(who)) return;
  const s = screenPoint(x, y + 2.4, z);
  oc.save();
  oc.font = '600 10px "Trebuchet MS", Arial';
  const txt = who.bubble, w = oc.measureText(txt).width + 21, bx = clamp(s.x - w / 2, 10, W - w - 10), by = s.y - 23;
  oc.fillStyle = '#fffdf3f5';
  oc.strokeStyle = '#eff2dd';
  oc.lineWidth = 1;
  roundRect(oc, bx, by, w, 27, 8);
  oc.fill();
  oc.stroke();
  oc.beginPath();
  oc.moveTo(s.x - 4, by + 26);
  oc.lineTo(s.x, by + 31);
  oc.lineTo(s.x + 5, by + 26);
  oc.fill();
  oc.fillStyle = '#67825c';
  oc.textAlign = 'center';
  oc.fillText(txt, bx + w / 2, by + 17);
  oc.restore();
}
function drawOverlay() {
  const c = actor.current;
  const anim = c && actor.phase === 'working' ? ACTIONS[c.actionId].anim : null;
  const busy = anim === 'shower' || anim === 'cook' || floaters.length > 0 || hasBubble(actor) || (npc.visible && hasBubble(npc)) || (friend2.visible && hasBubble(friend2));
  if (!busy && !overlayDirty) return;
  overlayDirty = busy;
  oc.setTransform(DPR, 0, 0, DPR, 0, 0);
  oc.clearRect(0, 0, W, H);
  if (!busy) return;
  const ap = residentPosition();
  if (anim === 'shower') {
    for (let i = 0; i < 9; i++) {
      const v = (simTime * 0.55 + i * 0.13) % 1;
      const p = screenPoint(ap.x + Math.sin(i * 9) * 0.3, ap.y + 0.4 + v * 1.5, ap.z + Math.cos(i * 5) * 0.3);
      oc.fillStyle = `rgba(242,248,227,${0.7 * (1 - v)})`;
      oc.beginPath();
      oc.arc(p.x, p.y, (3 + v * 4) * Math.min(1.4, zoom), 0, Math.PI * 2);
      oc.fill();
    }
  }
  if (anim === 'cook') {
    const stove = objects.find((o) => o.id === 'stove');
    for (let i = 0; i < 3; i++) {
      const v = (simTime * 0.4 + i / 3) % 1;
      const p = screenPoint(stove.x + 0.3 + Math.sin(v * 3) * 0.05, 1.6 + v * 0.7, stove.z - 0.27);
      oc.fillStyle = `rgba(250,247,223,${0.55 * (1 - v)})`;
      oc.beginPath();
      oc.arc(p.x, p.y, (2 + v * 6) * Math.min(1.4, zoom), 0, Math.PI * 2);
      oc.fill();
    }
  }
  drawBubble(actor, ap.x, ap.y, ap.z);
  if (npc.visible) drawBubble(npc, npc.x, floorAt(npc.x, npc.z), npc.z);
  if (friend2.visible) drawBubble(friend2, friend2.x, floorAt(friend2.x, friend2.z), friend2.z);
  for (const f of floaters) {
    const p = screenPoint(f.x, 2.28 + f.t * 0.35, f.z);
    oc.save();
    oc.globalAlpha = clamp(1 - f.t / 2.7, 0, 1);
    oc.font = 'bold 11px "Trebuchet MS",Arial';
    oc.textAlign = 'center';
    oc.lineWidth = 3;
    oc.strokeStyle = '#fbf9e5';
    oc.strokeText(f.text, p.x, p.y);
    oc.fillStyle = f.color;
    oc.fillText(f.text, p.x, p.y);
    oc.restore();
  }
}

/* ================================================================ portraits */

function updatePortraits() {
  const parts = (P) => [P.shadow, P.legL, P.legR, P.upper, P.armUL, P.armUR, P.armLL, P.armLR];
  paintPortrait($('portrait'), parts(B.personParts('mara', OUTFITS[state.outfit] || OUTFITS[0])), { unit: 112 });
  paintPortrait($('neighbor-portrait'), parts(B.personParts('june')), { unit: 47 });
}

/* ================================================================ layout */

function layout() {
  W = Math.max(1, kit.size.width || innerWidth);
  H = Math.max(1, kit.size.height || innerHeight);
  DPR = Math.min(devicePixelRatio || 1, 2);
  const hud = document.querySelector('.hud').getBoundingClientRect();
  hudTop = hud.top;
  hudHeight = hud.height;
  viewTop = document.querySelector('.topbar').getBoundingClientRect().bottom;
  const top = W < 800 ? 60 : 78;
  const avail = Math.max(120, hudTop - top);
  baseUnit = Math.max(6, Math.min((W < 621 ? W * 1.2 : W < 1000 ? W * 0.88 : W * 0.78) / 26, avail / 16.0));
  centerX = W * (W < 800 ? 0.51 : 0.53);
  centerY = top + avail * 0.48;
  overlay.width = Math.round(W * DPR);
  overlay.height = Math.round(H * DPR);
  const cf = $('confetti');
  cf.width = Math.round(W * DPR);
  cf.height = Math.round(H * DPR);
  padCursor.x = clamp(padCursor.x || W / 2, 4, W - 4);
  padCursor.y = clamp(padCursor.y || (viewTop + hudTop) / 2, viewTop + 4, Math.max(viewTop + 8, hudTop - 4));
  hoverStale = true;
  overlayDirty = true;
}

/* ================================================================ HUD */

const uiCache = new Map();
function put(id, prop, value) {
  const key = id + '|' + prop;
  if (uiCache.get(key) === value) return;
  uiCache.set(key, value);
  const el = $(id);
  if (!el) return;
  if (prop === 'text') el.textContent = value;
  else if (prop === 'html') el.innerHTML = value;
  else el.style[prop] = value;
}
function toast(title, text, ic = 'spark', warn = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.innerHTML = icon(ic) + `<div><b>${esc(title)}</b><span>${esc(text)}</span></div>`;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 310);
  }, 4200);
}
function chapter() {
  return !state.flags.won ? 1 : !state.flags.won2 ? 2 : 3;
}
function updateStory() {
  const ch = chapter();
  const tasks = ch === 1 ? CH1 : CH2;
  const done = tasks.filter(([k]) => state.flags[k]).length;
  const party = state.party;
  let eyebrow, title, sub, hostLabel = '', hostIcon = 'music';
  if (ch === 1) {
    eyebrow = 'CHAPTER 01 · A FRESH START';
    title = party ? 'Come on in!' : 'Small home.<br>Big plans.';
    sub = party ? 'The food is out. The music is on. Make your guests feel at home.' : 'Settle in, meet your neighbor, and host your first housewarming.';
    hostLabel = 'Host the housewarming';
  } else if (ch === 2) {
    eyebrow = 'CHAPTER 02 · ROOM TO GROW';
    title = party ? 'Dinner is served.' : 'Room<br>to grow.';
    sub = party ? 'Serve your harvest at the gathering table and enjoy the company.' : 'Grow a garden, win over Miso, and gather everyone for a dinner from your own harvest.';
    hostLabel = 'Host the garden dinner';
    hostIcon = 'food';
  } else {
    eyebrow = 'YOUR LITTLE LIFE';
    title = 'A place to call home.';
    sub = 'A good life is made of little moments. This one is all yours.';
  }
  let html = `<div class="chapter-top"><div class="eyebrow">${eyebrow}</div><button class="medal" id="story-toggle" title="Show or hide the story goals" aria-label="Show or hide the story goals">${icon(storyCollapsed ? 'chevron' : ch === 3 ? 'home' : 'star')}</button></div>`;
  html += storyCollapsed ? `<h1 style="font-size:17px;margin:10px 0 0">${ch === 3 ? 'Home, sweet home.' : party ? 'Welcome, everyone.' : `${done} of 4 little steps`}</h1>` : `<h1>${title}</h1><p>${sub}</p>`;
  if (ch < 3 && !storyCollapsed) {
    html += `<div class="objectives">${tasks.map(([k, t]) => `<div class="objective ${state.flags[k] ? 'done' : ''}"><span class="check-ring">${state.flags[k] ? icon('check') : ''}</span><span class="obj-text">${t}</span></div>`).join('')}</div><div class="story-progress">${tasks.map(([k]) => `<i class="${state.flags[k] ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  if (!started) html += `<button class="green-btn" id="begin-btn">${icon('play')}${loadedGame ? 'Continue where you left off' : 'Begin your first day'}</button>`;
  else if (ch < 3 && !party && (!storyCollapsed || done === 4)) html += `<button class="green-btn" id="host-btn" ${done < 4 ? 'disabled' : ''} title="${done < 4 ? 'Finish the four goals first' : 'Time to invite everyone in'}">${icon(done === 4 ? hostIcon : 'home')}${done === 4 ? hostLabel : `${done} of 4 little steps`}</button>`;
  else if (ch === 3 && !storyCollapsed) html += `<div class="note-box" style="margin:12px 0 0;padding:10px">${icon('heart')} One good friend. Endless little plans.</div>`;
  put('story-card', 'html', html);
  $('story-toggle').onclick = () => {
    storyCollapsed = !storyCollapsed;
    updateStory();
  };
  if ($('begin-btn')) $('begin-btn').onclick = beginPlay;
  if ($('host-btn')) $('host-btn').onclick = ch === 1 ? startParty : startDinner;
  let hint;
  const f = state.flags;
  if (ch === 1) {
    hint = !f.meal ? ['food', 'Start with breakfast.', 'Click the fridge or stove to make something good.']
      : !f.fresh ? ['hygiene', 'A little self-care.', 'Click the shower. Your future guests will thank you.']
      : !f.friend ? ['social', 'Say hello to June.', 'Click your neighbor. Chat and tell a joke to become friends.']
      : !f.decor ? ['plant', 'Add a little you.', 'Open Buy & decorate. Choose an item, then a clear spot.']
      : ['music', 'Your door is open.', 'Host the housewarming. Chat, dance, and enjoy the day.'];
  } else if (ch === 2) {
    hint = !f.harvest ? ['leaf', 'Grow something good.', state.garden.growth >= 100 ? 'The garden is ripe. Click it to harvest.' : 'Click the garden beside the house and give it some water.']
      : !f.miso ? ['cat', 'Win over Miso.', `Pet Miso on the front lawn. Trust: ${state.misoBond}/100.`]
      : !f.bestie ? ['social', 'A friend for keeps.', `Chat, joke, and share plans with June. Friendship: ${state.friendship}/70.`]
      : !f.artist ? ['paint', 'Make some art.', `Buy an easel, then paint and sell pictures. Sold: ${state.stats.paintings}/3.`]
      : ['food', 'Dinner is served.', 'Host the garden dinner. Keep a basket of veggies to serve at the table.'];
  } else hint = ['leaf', 'There is no rush.', 'Try painting, tend the garden, find a new look, or save for something special.'];
  put('hint-card', 'html', icon(hint[0]) + `<div><strong>${hint[1]}</strong><br>${hint[2]}</div>`);
}
function renderSpeed() {
  $('speed-row').querySelectorAll('[data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === gameSpeed));
}
let lastQueueKey = '';
function renderQueue(force = false) {
  const c = actor.current;
  const key = (c ? c.objId + '/' + c.actionId + '/' + actor.phase : '-') + '|' + actor.queue.map((q) => q.actionId).join(',');
  if (force || key !== lastQueueKey) {
    lastQueueKey = key;
    let html = `<div class="section-heading">A LITTLE DIRECTION<span class="small-note">${actor.queue.length ? actor.queue.length + ' queued' : 'Your action queue'}</span></div>`;
    if (!c) html += `<div class="queue-empty">${icon('walk')}<div><strong>What shall we do?</strong><span>${input.source === 'touch' ? 'Tap' : input.source === 'gamepad' ? 'Point and press A on' : 'Click'} an object to get started.</span></div></div>`;
    else {
      const a = ACTIONS[c.actionId];
      html += `<div class="current-action"><div class="current-action-icon">${icon(a.icon)}</div><div class="current-action-info"><div class="action-name">${esc(a.name)}</div><div class="action-state" id="action-state">${actor.phase === 'walking' ? 'On the way…' : 'Taking a little time'}</div><div class="action-progress"><i id="action-progress-fill" style="width:0%"></i></div></div><button class="cancel-action" id="cancel-current" title="Cancel this action" aria-label="Cancel this action">×</button></div>`;
    }
    if (actor.queue.length) html += `<div class="queue-list">${actor.queue.map((q, i) => `<button class="queued" data-queue="${i}" title="Cancel: ${esc(ACTIONS[q.actionId].name)}">${icon(ACTIONS[q.actionId].icon)}${esc(ACTIONS[q.actionId].name)} ×</button>`).join('')}</div>`;
    $('queue-panel').innerHTML = html;
    uiCache.delete('action-progress-fill|width');
    uiCache.delete('action-state|text');
    if ($('cancel-current')) $('cancel-current').onclick = () => {
      cancelCurrent();
      clickSound();
    };
    $('queue-panel').querySelectorAll('[data-queue]').forEach((b) => (b.onclick = () => {
      actor.queue.splice(+b.dataset.queue, 1);
      renderQueue(true);
    }));
  }
  if (c && $('action-progress-fill')) {
    put('action-progress-fill', 'width', (actor.phase === 'walking' ? 7 : clamp((c.elapsed / c.duration) * 100, 0, 100)).toFixed(1) + '%');
    put('action-state', 'text', actor.phase === 'walking' ? 'On the way…' : `${Math.max(1, Math.ceil(c.duration - c.elapsed))} min left${gameSpeed === 0 ? ' · Paused' : ''}`);
  }
}
function updateUI() {
  const n = state.needs;
  for (const [k] of NEEDS) {
    const v = Math.round(n[k]);
    put('need-' + k, 'width', clamp(v, 0, 100) + '%');
    put('need-' + k, 'background', n[k] < 20 ? '#ce8762' : n[k] < 40 ? '#c4ab69' : '#8ab36d');
    put('num-' + k, 'text', String(v));
  }
  const md = mood();
  put('mood-label', 'html', icon(md.icon) + md.label);
  put('mood-label', 'color', md.color);
  put('resident-name', 'text', state.name);
  put('money', 'html', icon('wallet') + '$' + Math.floor(state.money).toLocaleString('en-US'));
  const day = Math.floor(state.time / 1440), m = Math.floor(state.time % 1440), h = Math.floor(m / 60), minutes = m % 60;
  put('clock', 'text', (h % 12 || 12).toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0'));
  put('clock-period', 'text', h < 12 ? 'AM' : 'PM');
  put('day-label', 'text', ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'][day % 7] + ' · DAY ' + (day + 1));
  put('weather-icon', 'html', icon(h >= 19 || h < 6 ? 'moon' : 'sun'));
  put('neighbor-status', 'text', state.friendship >= 70 ? 'Good friends · ' + state.friendship + '/100' : state.friendship >= 30 ? 'Friends · ' + state.friendship + '/100' : state.friendship > 0 ? 'Getting to know you · ' + state.friendship + '/100' : 'A friend in the making');
  $('autonomy-btn').classList.toggle('on', state.autonomy);
  put('autonomy-label', 'text', state.autonomy ? 'on' : 'off');
  put('lot-label-text', 'text', mode === 'buy' ? 'BUY MODE · MAKE IT YOUR OWN' : gameSpeed === 0 ? 'PAUSED · A LITTLE MOMENT TO THINK' : 'LIVE MODE · THE BLOOM HOUSEHOLD');
  renderQueue();
  if (state.party) {
    $('party-banner').classList.remove('hidden');
    const p = state.party;
    put('party-banner', 'html', icon(p.kind === 'dinner' ? 'food' : 'music') + `${p.kind === 'dinner' ? 'Garden dinner' : 'Housewarming'} in progress <div class="party-bar"><i style="width:${Math.round(100 * (1 - p.remaining / p.total))}%"></i></div><span>${Math.ceil(p.remaining)} min left</span>`);
  } else $('party-banner').classList.add('hidden');
}
function hideTooltip() {
  $('tooltip').classList.add('hidden');
}
const contextOpen = () => !$('context').classList.contains('hidden');
function closeContext() {
  $('context').classList.add('hidden');
  selection = null;
}
function openContext(o, x, y) {
  if (!o) return;
  selection = o.id;
  hideTooltip();
  const acts = objectActions(o);
  const isBuy = mode === 'buy';
  let html = `<div class="context-head">${icon(o.icon || 'home')}<div><div class="context-title">${esc(o.name)}</div><div class="context-subtitle">${esc(o.desc || 'A little something for your home.')}</div></div><button class="context-close" id="context-close" aria-label="Close">×</button></div>`;
  if (isBuy) {
    if (o.placed) html += `<button class="context-action" id="move-object">${icon('walk')}Move this item<span class="action-price">FREE</span></button><button class="context-action" id="sell-object">${icon('wallet')}Sell this item<span class="action-price">+$${Math.floor(o.price * 0.75)}</span></button>`;
    else html += `<div class="context-action" style="cursor:default">This is part of your starter home.<br>New items can be moved or sold.</div>`;
  } else {
    if (o.type === 'person') html += `<div style="padding:10px 15px 1px;font-size:9px;color:#839173">${state.friendship >= 70 ? 'GOOD FRIENDS' : state.friendship >= 30 ? 'FRIENDS' : 'GETTING TO KNOW YOU'} · ${state.friendship}/100<div class="rel-meter"><i style="width:${state.friendship}%"></i></div></div>`;
    if (o.type === 'cat' && !state.flags.miso) html += `<div style="padding:10px 15px 1px;font-size:9px;color:#839173">MISO'S TRUST · ${state.misoBond}/100<div class="rel-meter"><i style="width:${state.misoBond}%"></i></div></div>`;
    html += acts.map((id) => {
      const a = ACTIONS[id], reason = availableAction(id), cost = actionCost(id), extra = a.pay ? `+$${a.pay}+` : cost ? '$' + cost : a.duration + 'm';
      return `<button class="context-action" data-action="${id}" ${reason ? 'disabled' : ''} title="${esc(reason || a.desc)}">${icon(a.icon)}<div>${a.name}<span class="action-sub">${esc(reason || a.desc)} · ${a.duration} min</span></div><span class="action-price">${extra}</span></button>`;
    }).join('');
    if (o.type === 'self') html += `<button class="context-action" id="change-look">${icon('person')}Change your look</button>`;
  }
  const el = $('context');
  el.innerHTML = html;
  el.classList.remove('hidden');
  const rect = el.getBoundingClientRect();
  el.style.left = clamp(x + 13, 9, W - rect.width - 9) + 'px';
  el.style.top = clamp(y - 32, 66, H - rect.height - 20) + 'px';
  $('context-close').onclick = closeContext;
  el.querySelectorAll('[data-action]').forEach((b) => (b.onclick = () => queueAction(o.id, b.dataset.action)));
  if ($('change-look')) $('change-look').onclick = () => {
    closeContext();
    showSettings();
  };
  if ($('move-object')) $('move-object').onclick = () => {
    movingId = o.id;
    placing = o.type;
    placeRotation = o.rot || 0;
    ghostPos = { x: o.x, z: o.z };
    closeContext();
    renderCatalog();
    updateBuildStatus();
  };
  if ($('sell-object')) $('sell-object').onclick = () => sellObject(o);
  if (input.source === 'gamepad') focusFirst(el, CONTEXT_FOCUS);
  clickSound();
}
function showModal(content) {
  if (!modalOpen) {
    modalPause = gameSpeed;
    gameSpeed = 0;
    renderSpeed();
  }
  modalOpen = true;
  closeContext();
  hideTooltip();
  $('modal').innerHTML = `<button class="round-btn modal-close" id="modal-close" aria-label="Close">${icon('close')}</button>` + content;
  $('modal-wrap').classList.remove('hidden');
  $('modal-close').onclick = hideModal;
  $('modal').scrollTop = 0;
  if (input.source !== 'touch') focusFirst($('modal'), MODAL_FOCUS);
  updateUI();
}
function hideModal() {
  if (!modalOpen) return;
  $('modal-wrap').classList.add('hidden');
  modalOpen = false;
  if (mode === 'live' && started) gameSpeed = modalPause;
  renderSpeed();
  updateUI();
  if ($('modal').contains(document.activeElement)) document.activeElement.blur();
  input.settle();
}

let helpTab = null;
function showHelp(tab = helpTab || (input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' ? 'touch' : 'keyboard')) {
  helpTab = tab;
  const rows = {
    keyboard: [
      ['Click', 'Select a person or object, then pick an action. Click a clear floor tile to walk.'],
      ['Need bars', 'Click a need to queue the right action. You can queue four more actions.'],
      ['Space · 1–3', 'Pause the game or change its speed.'],
      ['Drag · WASD', 'Move the view. Scroll or + / − to zoom.'],
      ['Q / E', 'Turn the view. Home resets it, F finds Mara.'],
      ['B · R · Del', 'Open the shop, turn the item you are placing, sell the selected item.'],
      ['Esc · P', 'Cancel or close. Esc with nothing open, or P, opens the menu.'],
    ],
    gamepad: [
      ['Left stick · A', 'Move the pointer over the lot. A selects a person or object, or walks.'],
      ['D-pad', 'Jump between the buttons on screen. A presses one, B goes back to the lot.'],
      ['B', 'Back: close a menu, cancel a placement, leave the shop.'],
      ['X · Y', 'Pause or play (X turns the item while placing). Y opens the shop.'],
      ['LB / RB · LT / RT', 'Turn the view. Zoom out and in.'],
      ['Right stick', 'Move the view. Click it to reset; click the left stick to find Mara.'],
      ['Start · View', 'Open the menu. Open this help.'],
    ],
    touch: [
      ['Tap', 'Select a person or object, then pick an action. Tap a clear floor tile to walk.'],
      ['Need bars', 'Tap a need to take care of it.'],
      ['Drag · pinch', 'Move the view. Pinch to zoom.'],
      ['Tools', 'Turn and zoom the view with the buttons on the right of the lot.'],
      ['Buy & decorate', 'Tap an item, tap a spot to preview it, then tap the same spot again to place it.'],
      [icon('menu'), 'The menu button at the top has saving, help, and display settings.'],
    ],
  }[tab];
  const tabs = [['keyboard', 'keyboard', 'Keyboard & mouse'], ['gamepad', 'pad', 'Controller'], ['touch', 'hand', 'Touch']];
  showModal(`<div class="eyebrow">${icon('help')} A LITTLE HELP</div><h2>Life is in the little things.</h2><p>Care for Mara, make a friend, and turn a small house into a home. Finish the story goals on the left, then host a gathering to end each chapter.</p><div class="help-tabs" role="tablist">${tabs.map(([k, ic, label]) => `<button class="help-tab ${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${icon(ic)}${label}</button>`).join('')}</div><div class="help-grid">${rows.map(([k, t]) => `<kbd>${k}</kbd><span>${t}</span>`).join('')}</div><div class="note-box">Your game saves in this browser. Active actions stop when you reopen the game. Sound is optional. The game works offline.</div><p style="font-size:10px">Little Lot is an original home-life game, inspired by classic PC life sims. It is not an official Sims game and is not connected to EA or Maxis. All art, characters, and sound in this game are original.</p><button class="green-btn" id="help-done">${icon('home')} Back to my little lot</button>`);
  $('help-done').onclick = hideModal;
  $('modal').querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    showHelp(b.dataset.tab);
    focusFirst($('modal'), `[data-tab="${b.dataset.tab}"]`);
  }));
}
function showLife() {
  const skills = [['cooking', 'Cooking', 'food'], ['creativity', 'Creativity', 'paint'], ['gardening', 'Gardening', 'leaf']];
  showModal(`<div class="eyebrow">${icon('heart')} A LIFE IN PROGRESS</div><h2>${esc(state.name)}’s little story.</h2><p>Creative soul. People person. ${state.flags.won2 ? 'Gardener, cat person, and host of a very good dinner.' : state.flags.won ? 'Host of a very good housewarming.' : 'New arrival on Clover Lane.'}</p><div class="modal-stats"><div class="stat"><b>${state.stats.meals}</b><span>MEALS MADE</span></div><div class="stat"><b>$${state.stats.earned}</b><span>MONEY EARNED</span></div><div class="stat"><b>${state.stats.bought}</b><span>HOME FINDS</span></div><div class="stat"><b>${state.stats.harvests}</b><span>HARVESTS</span></div><div class="stat"><b>${state.stats.paintings}</b><span>PAINTINGS SOLD</span></div><div class="stat"><b>${state.stats.parties}</b><span>GATHERINGS</span></div></div><div class="section-heading">A LITTLE PRACTICE</div>${skills.map(([k, t, ic]) => `<div style="margin-top:16px;font-size:12px">${icon(ic)} ${t}<span style="float:right;color:#849573;font-size:10px">Level ${Math.min(5, Math.floor(state.skills[k] / 20) + 1)} · ${state.skills[k]}/100</span><div class="rel-meter"><i style="width:${state.skills[k]}%"></i></div></div>`).join('')}<div class="note-box">${icon('social')} June Park · ${state.friendship >= 70 ? 'Good friends' : state.friendship >= 30 ? 'Friends' : 'New neighbors'}<div class="rel-meter"><i style="width:${state.friendship}%"></i></div>${state.friendship}/100 friendship. Better friends make a little home feel bigger.</div><div class="note-box">${icon('cat')} Miso · ${state.flags.miso ? 'Lives here now' : 'Still deciding'}<div class="rel-meter"><i style="width:${state.misoBond}%"></i></div>${state.flags.miso ? 'Your cat, officially. Miso naps in a cat bed at night if you have one.' : `${state.misoBond}/100 trust. Pet Miso a few more times.`}</div><p style="font-size:10px">Freelance jobs and art pay more as your creativity grows; veggies sell for more as your gardening grows. ${state.produce ? `You have ${state.produce} basket${state.produce > 1 ? 's' : ''} of veggies. ` : ''}${state.bills ? 'You have $' + state.bills + ' in bills at the mailbox.' : 'Your household bills are up to date.'}</p><button class="green-btn" id="life-done">${icon('home')} Back to living</button>`);
  $('life-done').onclick = hideModal;
}
function showSettings() {
  showModal(`<div class="eyebrow">${icon('settings')} MAKE IT YOURS</div><h2>A little personal touch.</h2><label class="form-field">Your resident’s name<input id="name-input" maxlength="22" value="${esc(state.name)}"></label><div class="section-heading">TODAY’S LOOK</div><div class="outfits">${OUTFITS.map((o, i) => `<button class="outfit ${state.outfit === i ? 'on' : ''}" data-outfit="${i}"><i style="background:${o.shirt}"></i>${o.name}</button>`).join('')}</div><button class="green-btn" id="apply-settings">${icon('check')} Save these little changes</button><button class="secondary-btn" id="display-settings">Display &amp; controls</button><button class="secondary-btn" id="reset-game">Start a new household</button><p style="font-size:10px">This game keeps one household in local browser storage. A new household replaces your current save.</p>`);
  $('modal').querySelectorAll('[data-outfit]').forEach((b) => (b.onclick = () => {
    state.outfit = +b.dataset.outfit;
    $('modal').querySelectorAll('[data-outfit]').forEach((x) => x.classList.toggle('on', x === b));
    updatePortraits();
    maraModel.build();
  }));
  $('apply-settings').onclick = () => {
    state.name = $('name-input').value.trim() || 'Mara Bloom';
    saveGame();
    updateUI();
    hideModal();
    toast('Looking good, neighbor.', 'A little change can make your day.', 'smile');
  };
  $('display-settings').onclick = openDisplaySettings;
  $('reset-game').onclick = confirmReset;
}
function openDisplaySettings() {
  hideModal();
  kit.menu.open();
}
function confirmReset() {
  showModal(`<div class="eyebrow">${icon('reset')} A FRESH START</div><h2>Start a new household?</h2><p>This will remove your current home changes, friends, and progress. You will return to your first morning on Clover Lane.</p><button class="green-btn" id="confirm-reset">Start fresh</button><button class="secondary-btn" id="cancel-reset">Keep my household</button>`);
  $('confirm-reset').onclick = resetHousehold;
  $('cancel-reset').onclick = hideModal;
  if (input.source !== 'touch') focusFirst($('modal'), '#cancel-reset');
}
function showMenu() {
  showModal(`<div class="eyebrow">${icon('menu')} PAUSED</div><h2>A little breather.</h2><p>Time stands still while this menu is open.</p><div class="menu-list"><button class="green-btn" id="m-resume">${icon('play')} Resume</button><button class="secondary-btn" id="m-save">${icon('check')} Save now</button><button class="secondary-btn" id="m-help">${icon('help')} How to play</button><button class="secondary-btn" id="m-life">${icon('heart')} My little life</button><button class="secondary-btn" id="m-look">${icon('person')} Make it yours</button><button class="secondary-btn" id="m-display">${icon('settings')} Display &amp; controls</button><button class="secondary-btn" id="m-sound">${icon(soundOn ? 'volume' : 'mute')} Sound: ${soundOn ? 'on' : 'off'}</button></div>`);
  $('m-resume').onclick = hideModal;
  $('m-save').onclick = () => {
    saveGame(true);
    hideModal();
  };
  $('m-help').onclick = () => showHelp();
  $('m-life').onclick = showLife;
  $('m-look').onclick = showSettings;
  $('m-display').onclick = openDisplaySettings;
  $('m-sound').onclick = () => {
    toggleSound();
    showMenu();
    focusFirst($('modal'), '#m-sound');
  };
}
function resetHousehold() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage blocked: nothing to remove */
  }
  state = newState();
  objects = DEFAULT_OBJECTS.map((o) => ({ ...o }));
  actor = newActor();
  npc = newNpc();
  friend2 = newGuest();
  started = false;
  loadedGame = false;
  gameSpeed = 0;
  lastSpeed = 1;
  mode = 'live';
  placing = null;
  movingId = null;
  ghostPos = null;
  modalPause = 0;
  storyCollapsed = false;
  floaters = [];
  confettiPieces = [];
  clickMarker = null;
  hoverId = null;
  gardenPct = -1;
  $('toasts').innerHTML = '';
  $('catalog').classList.add('hidden');
  $('build-status').classList.add('hidden');
  $('camera-tools').classList.remove('hidden');
  $('live-btn').classList.add('active');
  $('buy-btn').classList.remove('active');
  hideModal();
  homeView();
  maraModel.build();
  buildWorld();
  updatePortraits();
  updateStory();
  renderQueue(true);
  updateUI();
  renderSpeed();
  saveGame();
}
function setMode(m) {
  if (modalOpen || m === mode) return;
  closeContext();
  hideTooltip();
  hoverId = null;
  if (m === 'buy') {
    savedLiveSpeed = gameSpeed || lastSpeed;
    gameSpeed = 0;
    mode = 'buy';
    $('catalog').classList.remove('hidden');
    $('camera-tools').classList.add('hidden');
    renderCatalog();
    updateBuildStatus();
  } else {
    mode = 'live';
    placing = null;
    ghostPos = null;
    movingId = null;
    $('catalog').classList.add('hidden');
    $('build-status').classList.add('hidden');
    $('camera-tools').classList.remove('hidden');
    if (started) gameSpeed = savedLiveSpeed;
  }
  $('live-btn').classList.toggle('active', mode === 'live');
  $('buy-btn').classList.toggle('active', mode === 'buy');
  renderSpeed();
  updateUI();
}
function cancelPlacing() {
  placing = null;
  movingId = null;
  ghostPos = null;
  renderCatalog();
  updateBuildStatus();
}
function turnPlacement() {
  if (!placing) return;
  placeRotation = (placeRotation + Math.PI / 2) % (Math.PI * 2);
  clickSound();
}
function renderCatalog() {
  const hint = input.source === 'touch' ? (movingId ? 'Tap a new spot twice to move it' : 'Tap an item, then tap a clear spot twice') : `${movingId ? 'Move this item' : 'Choose an item, then a clear spot'} · ${promptText('turnItem')} to turn · ${promptText('back')} to cancel`;
  $('catalog').innerHTML = `<div class="catalog-top"><span>Good things for small spaces.</span><small>${hint}</small>${placing ? `<div class="place-tools"><button class="pill-btn" id="turn-item">${icon('rotate')}Turn</button><button class="pill-btn" id="cancel-item">${icon('close')}Cancel</button></div>` : ''}<div class="floor-swatches" title="Change the floor for $35"><span style="font-size:9px;font-weight:400;color:#8c9a7c">Floor · $35</span>${['#d5af7e', '#bfcead', '#c7a7a2'].map((c, i) => `<button style="background:${c}" data-floor="${i}" aria-label="Floor color ${i + 1}"></button>`).join('')}</div></div><div class="catalog-items">${SHOP.map((s) => `<button class="shop-item ${placing === s.type ? 'selected' : ''}" data-shop="${s.type}" title="${s.desc}">${icon(s.icon)}<div><div class="shop-name">${s.name}</div><div class="shop-price">$${s.price}</div></div></button>`).join('')}</div>`;
  $('catalog').querySelectorAll('[data-shop]').forEach((b) => (b.onclick = () => {
    const s = SHOP.find((x) => x.type === b.dataset.shop);
    if (state.money < s.price) {
      toast('Save a little more.', 'Try a freelance job at your desk to earn money.', 'wallet', true);
      return;
    }
    placing = b.dataset.shop;
    movingId = null;
    placeRotation = 0;
    ghostPos = null;
    if (input.source === 'gamepad') {
      // Start the preview where the pointer is, so A places it.
      const p = groundPoint(padCursor.x, padCursor.y);
      ghostPos = { x: Math.round(p.x * 2) / 2, z: Math.round(p.z * 2) / 2 };
    }
    renderCatalog();
    updateBuildStatus();
    clickSound();
    if (document.activeElement && $('catalog').contains(document.activeElement)) document.activeElement.blur();
  }));
  if ($('turn-item')) $('turn-item').onclick = turnPlacement;
  if ($('cancel-item')) $('cancel-item').onclick = cancelPlacing;
  $('catalog').querySelectorAll('[data-floor]').forEach((b) => (b.onclick = () => {
    const f = +b.dataset.floor;
    if (f === state.floor) return;
    if (state.money < 35) {
      toast('Not enough money.', 'A floor change costs $35.', 'wallet', true);
      return;
    }
    state.money -= 35;
    state.floor = f;
    state.flags.decor = true;
    buildWorld();
    checkGoals();
    saveGame();
    updateUI();
    toast('A fresh look underfoot.', 'Your new floor makes this place your own.', 'rug');
  }));
}
function updateBuildStatus(note = '') {
  if (mode !== 'buy') return;
  $('build-status').classList.remove('hidden');
  const s = SHOP.find((x) => x.type === placing);
  const how = input.source === 'touch' ? 'Tap a spot, then tap it again to place' : `${promptText('turnItem')} to turn · ${promptText('back')} to cancel`;
  $('build-status').textContent = placing ? `${movingId ? 'Move' : 'Place'} ${s.name} · ${note || how}` : 'Time is paused. Make yourself at home.';
}
function canPlace(item, x, z, rot, ignore = movingId) {
  const [w, d] = dims({ ...item, rot });
  if (Math.abs(x) + w / 2 > 8.6 || z - d / 2 < -5.95 || z + d / 2 > 9.1) return false;
  if (insideRect(actor.x, actor.z, x, z, w, d, 0.35) || (npc.visible && insideRect(npc.x, npc.z, x, z, w, d, 0.35))) return false;
  if (item.type === 'rug') {
    if (x - w / 2 < -5.38 || x + w / 2 > 5.38 || z - d / 2 < -4.35 || z + d / 2 > 4.3) return false;
    return !objects.some((o) => o.id !== ignore && o.type === 'rug' && insideRect(x, z, o.x, o.z, w + o.w, d + o.d, 0));
  }
  const rects = [...staticRects, [-7.55, -2.5, 2, 3], [-7.75, -5.5, 2.2, 2.2], [7.7, -5.3, 2.8, 2.8], [7.8, 6.8, 2.5, 2.5], [7.2, -2.1, 1.1, 6]];
  for (const r of rects) if (insideRect(x, z, r[0], r[1], r[2] + w, r[3] + d, 0.07)) return false;
  for (const o of objects) {
    if (o.id === ignore || o.type === 'rug' || o.virtual || o.nonSolid) continue;
    const [ow, od] = dims(o);
    if (insideRect(x, z, o.x, o.z, w + ow, d + od, 0.12)) return false;
  }
  return true;
}
function commitPlacement(x, z, repeat = false) {
  const item = SHOP.find((s) => s.type === placing);
  if (!item || !canPlace(item, x, z, placeRotation)) {
    toast('That spot needs more room.', 'Choose a clear tile and leave a walking path.', 'chair', true);
    return false;
  }
  if (!movingId && state.money < item.price) {
    toast('Not enough money.', 'Earn a little more at your desk.', 'wallet', true);
    return false;
  }
  const current = movingId && objects.find((o) => o.id === movingId);
  const candidate = { ...item, id: movingId || 'added' + state.nextId, x, z, rot: placeRotation, placed: true, outdoor: Math.abs(x) > 5.5 || z > 4.5 || z < -4.5 };
  const old = current ? { ...current } : null;
  if (current) Object.assign(current, candidate);
  else objects.push(candidate);
  let safe = true;
  if (item.type !== 'rug' && !item.nonSolid) {
    for (const id of ['fridge', 'bed', 'toilet', 'shower', 'computer', 'mailbox', 'garden']) {
      const ob = objById(id);
      const st = standFor(ob);
      if (!findPath(actor.x, actor.z, st[0], st[1])) {
        safe = false;
        break;
      }
    }
  }
  if (!safe) {
    if (current) Object.assign(current, old);
    else objects.pop();
    toast('Keep a little path open.', 'That spot blocks an important part of your home.', 'walk', true);
    return false;
  }
  if (!movingId) {
    state.money -= item.price;
    state.stats.bought++;
    state.nextId++;
    state.flags.decor = true;
    toast('A little more you.', 'Your new ' + item.name.toLowerCase() + ' is right at home.', 'bag');
  } else toast('A change of scenery.', 'That looks good right there.', 'chair');
  movingId = null;
  if (!repeat) {
    placing = null;
    ghostPos = null;
  }
  buildWorld();
  refreshRoutes();
  checkGoals();
  saveGame();
  renderCatalog();
  updateBuildStatus();
  updateUI();
  positiveSound();
  return true;
}
function refreshRoutes() {
  if (actor.current && actor.phase === 'walking' && actor.current.target) {
    const path = findPath(actor.x, actor.z, actor.current.target[0], actor.current.target[1]);
    if (path) actor.path = path;
    else {
      toast('Your plans need a new path.', 'Choose another action or make more room.', 'walk', true);
      cancelCurrent();
    }
  }
  for (const guest of [npc, friend2, catObj()]) {
    if (guest?.path?.length) {
      const end = guest.path[guest.path.length - 1];
      guest.path = findPath(guest.x, guest.z, end.x, end.z) || [];
    }
  }
}
function sellObject(o) {
  if (!o?.placed) return;
  state.money += Math.floor(o.price * 0.75);
  objects = objects.filter((x) => x.id !== o.id);
  actor.queue = actor.queue.filter((q) => q.objId !== o.id);
  if (actor.current?.objId === o.id) cancelCurrent();
  closeContext();
  placing = null;
  movingId = null;
  ghostPos = null;
  buildWorld();
  refreshRoutes();
  saveGame();
  renderCatalog();
  updateBuildStatus();
  updateUI();
  toast('Room for something new.', 'You sold the item for $' + Math.floor(o.price * 0.75) + '.', 'wallet');
}

/* ================================================================ pointer, gamepad and keys */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hits = [];
function shown(obj) {
  for (let p = obj; p; p = p.parent) if (!p.visible) return false;
  return true;
}
function pickAt(x, y) {
  ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  hits.length = 0;
  raycaster.intersectObjects(pickables, false, hits);
  for (const h of hits) {
    if (!shown(h.object)) continue;
    const o = objById(h.object.userData.pickId);
    if (o) return o;
  }
  return null;
}
function setGhostAt(x, y) {
  const p = groundPoint(x, y);
  const gx = Math.round(p.x * 2) / 2, gz = Math.round(p.z * 2) / 2;
  if (!ghostPos || ghostPos.x !== gx || ghostPos.z !== gz) ghostPos = { x: gx, z: gz };
}
let cursorStyle = '';
function setCursor(c) {
  if (c !== cursorStyle) {
    cursorStyle = c;
    canvas.style.cursor = c;
  }
}
let tipId = null;
function showTooltip(o, x, y) {
  const verb = input.source === 'gamepad' ? 'Press A' : 'Click';
  const key = o.id + mode + input.source;
  if (tipId !== key) {
    tipId = key;
    $('tooltip').innerHTML = `<strong>${esc(o.name)}</strong><small>${mode === 'buy' ? (o.placed ? `${verb} to move or sell` : 'Your starter home') : `${verb} to choose an action`}</small>`;
  }
  const t = $('tooltip');
  t.classList.remove('hidden');
  t.style.left = clamp(x + 15, 10, W - 185) + 'px';
  t.style.top = clamp(y + 14, 67, H - 85) + 'px';
}
const lastHover = { x: -1, y: -1 };
function hoverAt(x, y) {
  lastHover.x = x;
  lastHover.y = y;
  hoverStale = false;
  if (mode === 'buy' && placing) {
    setGhostAt(x, y);
    setCursor('crosshair');
    return;
  }
  if (modalOpen || contextOpen()) return;
  const o = pickAt(x, y);
  hoverId = o?.id || null;
  setCursor(o ? 'pointer' : 'grab');
  if (o) showTooltip(o, x, y);
  else {
    tipId = null;
    hideTooltip();
  }
}
function clickAt(x, y, { right = false, shift = false, touch = false } = {}) {
  if (modalOpen) return;
  if (right) {
    if (placing) cancelPlacing();
    else closeContext();
    return;
  }
  if (mode === 'buy' && placing) {
    const p = groundPoint(x, y);
    const gx = Math.round(p.x * 2) / 2, gz = Math.round(p.z * 2) / 2;
    if (touch && (!ghostPos || ghostPos.x !== gx || ghostPos.z !== gz)) {
      ghostPos = { x: gx, z: gz };
      updateBuildStatus('Tap the same spot again to place it');
      return;
    }
    commitPlacement(gx, gz, shift);
    return;
  }
  const o = pickAt(x, y);
  if (o) {
    openContext(o, x, y);
    return;
  }
  closeContext();
  if (!started) return;
  if (mode === 'live') {
    const p = groundPoint(x, y);
    if (walkable(p.x, p.z)) {
      clickMarker = { x: p.x, z: p.z, t: 0 };
      queueAction('ground', 'walk', { id: 'ground', x: p.x, z: p.z, stand: [p.x, p.z] });
    }
  }
}
function setZoom(z) {
  zoomTarget = clamp(z, 0.72, 1.75);
  closeContext();
  hideTooltip();
}
function rotateView(dir) {
  yawTarget += (dir * Math.PI) / 2;
  closeContext();
  hideTooltip();
  clickSound();
}
function homeView() {
  zoomTarget = 1;
  // The nearest quarter turn that faces the house the way it starts.
  yawTarget = Math.PI / 4 + Math.round((viewYaw - Math.PI / 4) / (Math.PI * 2)) * Math.PI * 2;
  pan = { x: 0, y: 0 };
  closeContext();
}
function focusActor() {
  const p = residentPosition(), s = screenPoint(p.x, 0.2, p.z);
  pan.x = clamp(pan.x + W * 0.53 - s.x, -W * 0.9, W * 0.9);
  pan.y = clamp(pan.y + (H - hudHeight) * 0.52 - s.y, -H * 0.6, H * 0.6);
  closeContext();
}

// Gamepad pointer and on-screen focus.
const padCursorEl = $('pad-cursor');
let padShown = false, padDrawn = '';
let lastPointerDownAt = -1e9, pointerFocused = null;
addEventListener('pointerdown', () => (lastPointerDownAt = performance.now()), true);
addEventListener('focusin', (e) => (pointerFocused = performance.now() - lastPointerDownAt < 500 ? e.target : null), true);
function visibleEl(el) {
  if (!el.isConnected || el.closest('.hidden')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
}
function uiFocused() {
  const a = document.activeElement;
  return !!a && a !== document.body && a !== canvas && a !== pointerFocused && !!a.matches?.(FOCUSABLE) && !a.closest('.kit-menu') && visibleEl(a);
}
function navScope() {
  if (modalOpen) return $('modal');
  if (contextOpen()) return $('context');
  return document.body;
}
function focusables(scope) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter((el) => el !== canvas && !el.closest('.kit-menu, .kit-touch, .kit-loading, .modal-wrap.hidden') && (scope !== document.body || !el.closest('#modal-wrap, #context')) && visibleEl(el));
}
function focusFirst(scope, selector) {
  // Selectors are tried in the order given, so the first one is the preferred target.
  for (const sel of selector.split(',')) {
    const el = [...scope.querySelectorAll(sel.trim())].find((e) => visibleEl(e));
    if (el) {
      el.focus();
      return;
    }
  }
}
function moveFocus(dx, dy) {
  const scope = navScope();
  const list = focusables(scope);
  if (!list.length) return;
  const cur = document.activeElement;
  let ax, ay;
  if (cur && list.includes(cur)) {
    const r = cur.getBoundingClientRect();
    ax = r.left + r.width / 2;
    ay = r.top + r.height / 2;
  } else if (scope === document.body) {
    ax = padCursor.x;
    ay = padCursor.y;
  } else {
    list[0].focus();
    return;
  }
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 - ax, y = r.top + r.height / 2 - ay;
    const along = x * dx + y * dy;
    if (along <= 2) continue;
    const across = Math.abs(x * dy - y * dx);
    const score = along + across * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  } else if (!cur || !list.includes(cur)) list[0].focus();
}
const navOut = { dx: 0, dy: 0 };
let navCode = -1, navHeld = 0;
function navRepeat(vx, vy, dt) {
  if (Math.hypot(vx, vy) < 0.55) {
    navCode = -1;
    return null;
  }
  const horiz = Math.abs(vx) > Math.abs(vy);
  navOut.dx = horiz ? Math.sign(vx) : 0;
  navOut.dy = horiz ? 0 : -Math.sign(vy);
  const code = (navOut.dx + 1) * 3 + navOut.dy + 1;
  if (code !== navCode) {
    navCode = code;
    navHeld = 0;
    return navOut;
  }
  navHeld += dt;
  if (navHeld > 0.4) {
    navHeld -= 0.13;
    return navOut;
  }
  return null;
}
function handleBack(fromKeyboard) {
  if (modalOpen) return hideModal();
  if (contextOpen()) {
    closeContext();
    return;
  }
  if (placing) return cancelPlacing();
  if (mode === 'buy') return setMode('live');
  if (uiFocused()) {
    document.activeElement.blur();
    return;
  }
  if (fromKeyboard) showMenu();
}

let pointerDown = null;
function readInput(dt) {
  const ptr = input.pointer;
  const src = input.source;
  const uiMode = modalOpen || contextOpen() || uiFocused();

  // Mouse and touch on the lot: click to choose, drag to look around, pinch or wheel to zoom.
  if (ptr.justDown && !modalOpen) {
    pointerDown = { x: ptr.x, y: ptr.y, lx: ptr.x, ly: ptr.y, panx: pan.x, pany: pan.y, dragging: false, gesture: false, right: input.down('altClick'), touch: ptr.type === 'touch' };
    hideTooltip();
  }
  const wheel = input.zoom();
  if (wheel && !modalOpen) setZoom(zoomTarget * Math.pow(1.13, wheel));
  if (pointerDown) {
    const d = pointerDown;
    if (d.touch && (wheel !== 0 || Math.hypot(ptr.x - d.lx, ptr.y - d.ly) > 90)) d.gesture = true;
    d.lx = ptr.x;
    d.ly = ptr.y;
    const dx = ptr.x - d.x, dy = ptr.y - d.y;
    if (!d.gesture && !d.right && (d.dragging || Math.hypot(dx, dy) > (d.touch ? 10 : 6))) {
      if (!d.dragging) {
        d.dragging = true;
        hoverId = null;
        hideTooltip();
      }
      pan.x = clamp(d.panx + dx, -W * 0.9, W * 0.9);
      pan.y = clamp(d.pany + dy, -H * 0.6, H * 0.6);
      setCursor('grabbing');
    }
    if (ptr.justUp || !ptr.down) {
      pointerDown = null;
      setCursor('grab');
      if (!d.dragging && !d.gesture) clickAt(ptr.x, ptr.y, { right: d.right, shift: input.down('multi'), touch: d.touch });
    }
  } else if (ptr.over && ptr.type !== 'touch' && src !== 'gamepad') {
    if (hoverStale || ptr.x !== lastHover.x || ptr.y !== lastHover.y) hoverAt(ptr.x, ptr.y);
  } else if (!ptr.over && src !== 'gamepad' && hoverId) {
    hoverId = null;
    tipId = null;
    hideTooltip();
  }

  // Menus and shortcuts.
  if (input.pressed('back')) handleBack(src !== 'gamepad');
  if (input.pressed('menu')) {
    if (modalOpen) hideModal();
    else showMenu();
  }
  if (input.pressed('help') && !modalOpen) showHelp();
  const nav = input.vector('nav');
  const stick = input.vector('cursor');
  if (uiMode) {
    const dir = navRepeat(nav.x + stick.x, nav.y + stick.y, dt);
    if (dir) moveFocus(dir.dx, dir.dy);
    if (input.pressed('confirm')) {
      if (uiFocused()) document.activeElement.click();
      else focusFirst(navScope(), modalOpen ? MODAL_FOCUS : contextOpen() ? CONTEXT_FOCUS : FOCUSABLE);
    }
  } else if (src === 'gamepad') {
    const dir = navRepeat(nav.x, nav.y, dt);
    if (dir) moveFocus(dir.dx, dir.dy);
  } else navRepeat(0, 0, dt);

  if (!modalOpen) {
    if (input.pressed('playPause')) {
      if (placing && src === 'gamepad') turnPlacement();
      else if (mode === 'live') setSpeed(gameSpeed ? 0 : lastSpeed);
    }
    if (input.pressed('speed1')) setSpeed(1);
    if (input.pressed('speed2')) setSpeed(2);
    if (input.pressed('speed3')) setSpeed(3);
    if (input.pressed('buy')) setMode(mode === 'live' ? 'buy' : 'live');
    if (input.pressed('turnItem')) turnPlacement();
    if (input.pressed('turnLeft')) rotateView(-1);
    if (input.pressed('turnRight')) rotateView(1);
    if (src === 'gamepad') {
      const z = input.value('zoomIn') - input.value('zoomOut');
      if (Math.abs(z) > 0.05) setZoom(zoomTarget * Math.pow(2.2, z * dt));
    } else {
      if (input.pressed('zoomIn')) setZoom(zoomTarget * 1.1);
      if (input.pressed('zoomOut')) setZoom(zoomTarget * 0.9);
    }
    if (input.pressed('homeView')) homeView();
    if (input.pressed('findMara')) focusActor();
    if (input.pressed('sell') && mode === 'buy' && selection) sellObject(objById(selection));
    // Keys and the right stick move the view.
    if (!uiMode) {
      const pv = input.vector('pan');
      if (pv.x || pv.y) {
        pan.x = clamp(pan.x - pv.x * 620 * dt, -W * 0.9, W * 0.9);
        pan.y = clamp(pan.y + pv.y * 620 * dt, -H * 0.6, H * 0.6);
      }
    }
  }

  // The gamepad pointer.
  const showPad = src === 'gamepad' && !uiMode;
  if (showPad !== padShown) {
    padShown = showPad;
    padCursorEl.classList.toggle('hidden', !showPad);
    if (showPad) hoverStale = true;
    else if (src !== 'keyboard') {
      hoverId = null;
      hideTooltip();
    }
  }
  if (showPad) {
    const top = viewTop + 4, bottom = Math.max(top + 8, hudTop - 4);
    const mag = Math.hypot(stick.x, stick.y);
    if (mag > 0) {
      const sp = 240 + 820 * mag;
      padCursor.x = clamp(padCursor.x + stick.x * sp * dt, 4, W - 4);
      padCursor.y = clamp(padCursor.y - stick.y * sp * dt, top, bottom);
      hoverStale = true;
    }
    // Nudge the view when the pointer rests against an edge of the lot.
    const edge = 26;
    if (mag > 0.2) {
      if (padCursor.x <= edge) pan.x = clamp(pan.x + 420 * dt, -W * 0.9, W * 0.9);
      if (padCursor.x >= W - edge) pan.x = clamp(pan.x - 420 * dt, -W * 0.9, W * 0.9);
      if (padCursor.y <= top + edge * 0.5) pan.y = clamp(pan.y + 420 * dt, -H * 0.6, H * 0.6);
      if (padCursor.y >= bottom - edge * 0.5) pan.y = clamp(pan.y - 420 * dt, -H * 0.6, H * 0.6);
    }
    const drawn = Math.round(padCursor.x) + ',' + Math.round(padCursor.y);
    if (drawn !== padDrawn) {
      padDrawn = drawn;
      padCursorEl.style.transform = `translate(${Math.round(padCursor.x)}px, ${Math.round(padCursor.y)}px)`;
    }
    if (hoverStale) hoverAt(padCursor.x, padCursor.y);
    if (input.pressed('confirm')) clickAt(padCursor.x, padCursor.y);
  }
}

/* ================================================================ sound */

// A small original music box score, made with Web Audio. No sound files.
let audioCtx = null, masterGain = null, musicTimer = null, musicStep = 0;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.2;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended' && !kit.paused) audioCtx.resume().catch(() => {});
  return true;
}
function tone(freq, start, duration = 0.35, volume = 0.2, type = 'sine') {
  if (!audioCtx || !soundOn) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  o.connect(g);
  g.connect(masterGain);
  o.start(start);
  o.stop(start + duration + 0.03);
}
function clickSound() {
  if (soundOn && ensureAudio()) tone(720, audioCtx.currentTime, 0.055, 0.07, 'sine');
}
function positiveSound() {
  if (soundOn && ensureAudio()) {
    tone(523.25, audioCtx.currentTime, 0.19, 0.09);
    tone(659.25, audioCtx.currentTime + 0.1, 0.23, 0.085);
    tone(783.99, audioCtx.currentTime + 0.21, 0.28, 0.07);
  }
}
function storeSound() {
  try {
    localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
  } catch (e) {
    /* storage blocked */
  }
}
function setSoundButton() {
  $('sound-btn').innerHTML = icon(soundOn ? 'volume' : 'mute');
  $('sound-btn').title = soundOn ? 'Turn sound off' : 'Turn sound on';
  $('sound-btn').setAttribute('aria-label', $('sound-btn').title);
}
function toggleSound() {
  soundOn = !soundOn;
  if (soundOn && !ensureAudio()) {
    soundOn = false;
    toast('Sound is not available here.', 'The game still works with sound off.', 'mute', true);
  }
  setSoundButton();
  storeSound();
  if (soundOn) {
    clickSound();
    if (!musicTimer) musicTimer = setInterval(musicTick, 340);
  } else {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
function musicTick() {
  if (!soundOn || !audioCtx || document.hidden || kit.paused) return;
  const melody = [64, 67, 71, 74, 71, 67, 64, 62, 60, 64, 67, 72, 67, 64, 60, 62, 62, 65, 69, 72, 69, 65, 62, 60, 59, 62, 67, 71, 67, 62, 59, 62];
  const note = melody[musicStep % melody.length];
  const t = audioCtx.currentTime;
  const freq = (n) => 440 * Math.pow(2, (n - 69) / 12);
  tone(freq(note), t, 0.62, 0.075, 'sine');
  tone(freq(note + 12), t, 0.2, 0.012, 'triangle');
  if (musicStep % 8 === 0) tone(freq([48, 45, 50, 43][Math.floor(musicStep / 8) % 4]), t, 2.2, 0.08, 'sine');
  musicStep++;
}
kit.onPause((paused) => {
  if (!audioCtx) return;
  if (paused) audioCtx.suspend().catch(() => {});
  else if (soundOn) audioCtx.resume().catch(() => {});
});
// Sound stays off until asked for; a player who turned it on gets it back on the first touch or key.
let soundWanted = false;
try {
  soundWanted = localStorage.getItem(SOUND_KEY) === '1';
} catch (e) {
  soundWanted = false;
}
if (soundWanted) {
  const wake = () => {
    removeEventListener('pointerdown', wake, true);
    removeEventListener('keydown', wake, true);
    if (!soundOn) toggleSound();
  };
  addEventListener('pointerdown', wake, true);
  addEventListener('keydown', wake, true);
}

/* ================================================================ confetti */

function confetti(n = 70) {
  for (let i = 0; i < n; i++) {
    confettiPieces.push({ x: W * (0.2 + Math.random() * 0.6), y: H * 0.3 + Math.random() * H * 0.1, vx: (Math.random() - 0.5) * 200, vy: -70 - Math.random() * 160, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8, life: 3 + Math.random() * 2, size: 3 + Math.random() * 5, color: ['#86a66b', '#e3bb6e', '#d59c8a', '#8eafa1', '#e6d3a0'][i % 5] });
  }
}
let confettiDirty = false;
function renderConfetti(dt) {
  if (!confettiPieces.length) {
    if (confettiDirty) {
      const c = $('confetti').getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, $('confetti').width, $('confetti').height);
      confettiDirty = false;
    }
    return;
  }
  confettiDirty = true;
  const c = $('confetti').getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.clearRect(0, 0, W, H);
  for (const p of confettiPieces) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 95 * dt;
    p.r += p.vr * dt;
    p.life -= dt;
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.r);
    c.globalAlpha = Math.min(1, Math.max(0, p.life));
    c.fillStyle = p.color;
    c.fillRect(-p.size / 2, -2, p.size, 4);
    c.restore();
  }
  confettiPieces = confettiPieces.filter((p) => p.life > 0 && p.y < H + 20);
}

/* ================================================================ prompts */

const PROMPTS = {
  keyboard: { turnItem: 'R', back: 'Esc', pause: 'Space' },
  gamepad: { turnItem: 'X', back: 'B', pause: 'X' },
  touch: { turnItem: 'Turn', back: 'Cancel', pause: 'II' },
};
function promptText(action) {
  return (PROMPTS[input.source] || PROMPTS.keyboard)[action] || '';
}
function updatePrompts() {
  const tips = {
    keyboard: '<kbd>Space</kbd> pause &nbsp;·&nbsp; <kbd>1–3</kbd> speed &nbsp;·&nbsp; <kbd>Q</kbd>/<kbd>E</kbd> turn &nbsp;·&nbsp; Drag to explore &nbsp;·&nbsp; <kbd>Esc</kbd> menu',
    gamepad: '<kbd>A</kbd> select &nbsp;·&nbsp; <kbd>X</kbd> pause &nbsp;·&nbsp; <kbd>LB</kbd>/<kbd>RB</kbd> turn &nbsp;·&nbsp; <kbd>D-pad</kbd> buttons &nbsp;·&nbsp; <kbd>Start</kbd> menu',
    touch: 'Tap to choose &nbsp;·&nbsp; Drag to explore &nbsp;·&nbsp; Pinch to zoom',
  };
  put('bottom-tip', 'html', tips[input.source] || tips.keyboard);
  put('needs-note', 'text', input.source === 'touch' ? 'Tap a need for help' : input.source === 'gamepad' ? 'Select a need for help' : 'Click a need for help');
  if (mode === 'buy') {
    renderCatalog();
    updateBuildStatus();
  }
  lastQueueKey = '';
  renderQueue();
  tipId = null;
}
input.onSourceChange(updatePrompts);

/* ================================================================ setup */

function initUI() {
  $('help-btn').innerHTML = icon('help');
  $('settings-btn').innerHTML = icon('settings');
  $('menu-btn').innerHTML = icon('menu');
  setSoundButton();
  $('live-btn').innerHTML = icon('play') + '<span class="full-label">Live mode</span><span class="short-label">Live</span> <span class="key">1</span>';
  $('buy-btn').innerHTML = icon('chair') + '<span class="full-label">Buy & decorate</span><span class="short-label">Buy</span> <span class="key">B</span>';
  $('life-btn').innerHTML = icon('heart') + '<span class="full-label">My little life</span><span class="short-label">My life</span>';
  $('needs').innerHTML = NEEDS.map(([k, t, ic]) => `<div class="need" role="button" tabindex="0" data-need="${k}" title="Take care of ${t.toLowerCase()}"><div class="need-top">${icon(ic)}<span>${t}</span><span class="need-num" id="num-${k}"></span></div><div class="need-track"><div class="need-fill" id="need-${k}"></div></div></div>`).join('');
  $('needs').querySelectorAll('[data-need]').forEach((el) => {
    el.onclick = () => autoNeed(el.dataset.need);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        autoNeed(el.dataset.need);
      }
    };
  });
  const speeds = [[0, 'pause', 'Pause (Space)'], [1, 'play', 'Normal speed (1)'], [2, 'play', 'Fast speed (2)'], [3, 'play', 'Very fast speed (3)']];
  $('speed-row').innerHTML = speeds.map(([s, ic, label]) => `<button class="speed-btn" data-speed="${s}" title="${label}" aria-label="${label}">${icon(ic)}${s > 1 ? `<span>${s}×</span>` : ''}</button>`).join('');
  $('speed-row').querySelectorAll('[data-speed]').forEach((b) => (b.onclick = () => {
    if (modalOpen) return;
    setSpeed(+b.dataset.speed);
    clickSound();
  }));
  $('camera-tools').innerHTML = `<button id="rotate-left" title="Turn left (Q)" aria-label="Turn left">${icon('rotate')}</button><button id="rotate-right" title="Turn right (E)" aria-label="Turn right" style="transform:scaleX(-1)">${icon('rotate')}</button><div class="divider"></div><button id="zoom-out" title="Zoom out (−)" aria-label="Zoom out">${icon('minus')}</button><button id="zoom-in" title="Zoom in (+)" aria-label="Zoom in">${icon('plus')}</button><div class="divider"></div><button id="home-view" title="Reset the view (Home)" aria-label="Reset the view">${icon('home')}</button>`;
  $('rotate-left').onclick = () => rotateView(-1);
  $('rotate-right').onclick = () => rotateView(1);
  $('zoom-in').onclick = () => setZoom(zoomTarget * 1.1);
  $('zoom-out').onclick = () => setZoom(zoomTarget * 0.9);
  $('home-view').onclick = homeView;
  $('help-btn').onclick = () => showHelp();
  $('settings-btn').onclick = showSettings;
  $('menu-btn').onclick = showMenu;
  $('sound-btn').onclick = toggleSound;
  $('save-btn').onclick = () => saveGame(true);
  $('live-btn').onclick = () => setMode('live');
  $('buy-btn').onclick = () => setMode(mode === 'live' ? 'buy' : 'live');
  $('life-btn').onclick = showLife;
  $('autonomy-btn').onclick = () => {
    state.autonomy = !state.autonomy;
    updateUI();
    saveGame();
    toast(state.autonomy ? 'A little free will.' : 'You are in charge.', state.autonomy ? 'Mara will care for low needs when the queue is empty.' : 'Choose the next little thing for Mara to do.', 'smile');
  };
  $('neighbor-btn').onclick = () => {
    const p = screenPoint(npc.x, 1, npc.z);
    openContext(objById('june'), clamp(p.x, 280, W - 290), clamp(p.y, 100, H - 350));
  };
  $('portrait').onclick = focusActor;
  $('modal-wrap').addEventListener('click', (e) => {
    if (e.target === $('modal-wrap')) hideModal();
  });
  updateStory();
  renderSpeed();
  updatePrompts();
  updateUI();
  updatePortraits();
}

loadGame();
maraModel = new PersonModel('mara');
juneModel = new PersonModel('june');
eliModel = new PersonModel('eli');
buildWorld();
updateGardenVisual();
initUI();
kit.onResize(layout);
updateView(1);
updateScene();

// Compile every material once, the hidden ones too, so nothing stutters later.
{
  const warm = [ghostGroup, grid, clickRing, hoverPrint.mesh, ...glows, ...plates, leftoversMesh, basketMesh, ...balloons, ...Object.values(eliModel.parts)];
  const was = warm.map((o) => o.visible);
  setGhostType('plant');
  eliModel.group.visible = true;
  for (const o of warm) o.visible = true;
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    console.warn('Shader warm-up skipped:', e?.message || e);
  }
  warm.forEach((o, i) => (o.visible = was[i]));
  setGhostType(null);
}

addEventListener('beforeunload', () => {
  if (started) saveGame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && started) {
    saveGame();
    if (gameSpeed > 0) {
      lastSpeed = gameSpeed;
      gameSpeed = 0;
      renderSpeed();
      updateUI();
    }
  }
});

kit.start((dt) => {
  realTime += dt;
  frameCount++;
  readInput(dt);
  simulation(dt);
  for (const f of floaters) f.t += dt;
  if (floaters.length && floaters[0].t >= 2.7) floaters = floaters.filter((f) => f.t < 2.7);
  if (clickMarker) {
    clickMarker.t += dt;
    if (clickMarker.t > 1.8) clickMarker = null;
  }
  uiTimer += dt;
  saveTimer += dt;
  if (uiTimer > 0.22) {
    updateUI();
    uiTimer = 0;
  }
  if (saveTimer > 25 && started) {
    saveGame();
    saveTimer = 0;
  }
  updateView(dt);
  updateScene();
  renderer.render(scene, camera);
  drawOverlay();
  renderConfetti(dt);
});

// A small read-only state view helps with browser tests without changing play.
window.LittleLot = {
  get state() {
    return JSON.parse(JSON.stringify(state));
  },
  get actor() {
    return { x: actor.x, z: actor.z, phase: actor.phase, action: actor.current?.actionId, queue: actor.queue.map((x) => x.actionId) };
  },
  get objects() {
    return objects.map(({ path, ...o }) => o);
  },
  get view() {
    return { unit, centerX, centerY, yaw: viewYaw, zoom };
  },
  get frames() {
    return frameCount;
  },
};
