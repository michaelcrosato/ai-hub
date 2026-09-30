/* IRONHOLD — the game shell: menus, HUD, input, camera, saves, records and the frame loop.
   The rules live in sim.js, the models in gfx.js and the three.js side in view.js.
   Mouse, keyboard, touch and controller all arrive as kit.input actions. The HUD and the
   menus are DOM on top of the canvas; a controller drives them with an on-screen cursor. */

import { boot } from 'kit/boot.js';
import { TOUCH_LOOK } from 'kit/input.js';
import { Sim, TYPES, ENEMIES, TEAM, MAPS, WAVES_TO_WIN, bounds, clamp, lanesForWave, isBossWave } from './sim.js';
import { createView } from './view.js';
import { createAudio } from './audio.js';

/* ------------------------------------------------------------------ small helpers */

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.max(0, Math.floor(n)).toLocaleString('en-US');
const two = (n) => String(Math.max(0, Math.floor(n))).padStart(2, '0');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const show = (id) => $(id).classList.remove('hidden');
const hide = (id) => $(id).classList.add('hidden');
const isShown = (id) => !$(id).classList.contains('hidden');
/** DOM writes only when the value changes. */
function setText(el, v) {
  const s = String(v);
  if (el._text !== s) {
    el._text = s;
    el.textContent = s;
  }
}
function setHTML(el, html) {
  if (el._html !== html) {
    el._html = html;
    el.innerHTML = html;
  }
}
function setWidth(el, pct) {
  const s = `${clamp(pct, 0, 100).toFixed(1)}%`;
  if (el._width !== s) {
    el._width = s;
    el.style.width = s;
  }
}

const SAVE_KEY = 'ironhold-save-v1';
const RECORD_KEY = 'ironhold-records-v1';
const PREF_KEY = 'ironhold-prefs-v1';
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing stored */
    }
  },
  json(key) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null');
      return v && typeof v === 'object' ? v : null;
    } catch {
      return null;
    }
  },
};

const DIFFICULTIES = ['relaxed', 'standard', 'hard'];
const prefs = Object.assign({ map: 'blackpine', difficulty: 'standard', endless: false }, store.json(PREF_KEY) || {});
if (!MAPS[prefs.map]) prefs.map = 'blackpine';
if (!DIFFICULTIES.includes(prefs.difficulty)) prefs.difficulty = 'standard';
prefs.endless = !!prefs.endless;
const savePrefs = () => store.set(PREF_KEY, JSON.stringify(prefs));
const records = store.json(RECORD_KEY) || {};

/* ------------------------------------------------------------------ content: icons and texts */

const icons = {
  gun: '<path d="M7 27h22l-3-6H10zM12 21v-7h12v7M10 14h16v-5H10zM24 11h9M18 9V5"/><path d="M6 30h24"/>',
  wall: '<path d="M5 29V10h5v5h5v-5h6v5h5v-5h5v19zM5 23h26M12 23v6M23 23v6M18 16v7"/>',
  mortar: '<path d="M6 29h24l-3-6H9zM13 23l-3-6 13-14 6 5-13 15M20 7l6 5M18 19l6 4"/>',
  arc: '<path d="M7 29h22l-4-5H11zM15 24V12M21 24V12M10 21h16M10 15h16M18 3l5 6-5 5-5-5z"/>',
  mine: '<path d="M6 29h24M9 29V6h18v23M6 6h24M18 6v15M14 16l4 6 4-6M5 24l5-4M31 24l-5-4"/>',
  generator: '<path d="M5 29V12h26v17zM9 12V7h18v5M7 22h5M24 22h5M20 14l-6 9h5l-3 6 8-10h-5z"/>',
  barracks: '<path d="M4 29V13l14-8 14 8v16zM4 14h28M13 29V19h10v10M8 18v5M28 18v5M18 5V2M18 2h7"/>',
  relay: '<path d="M6 29V17h24v12M12 17l6-5 6 5M18 12V5M13 8a7 7 0 010-7M23 8a7 7 0 000-7M15 23h6M18 20v6"/>',
  troops: '<path d="M10 13a4 4 0 100-8 4 4 0 000 8zM25 13a4 4 0 100-8 4 4 0 000 8zM5 29V19l5-4 5 4v10M20 29V19l5-4 5 4v10M7 20h6M22 20h6"/>',
  core: '<path d="M4 29h28M8 29V17h20v12M12 17V9h12v8M18 2l5 6-5 6-5-6zM14 22h8"/>',
};
const svg = (type) => `<svg viewBox="0 0 36 34" fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[type] || icons.core}</svg>`;
const BUILD_ORDER = ['gun', 'wall', 'mortar', 'arc', 'mine', 'generator', 'barracks', 'relay'];
const SHORT = { generator: 'Generator', barracks: 'Barracks', relay: 'Station' };
const DESC = {
  gun: 'A steady, long-range defense against ground troops.',
  wall: 'Blocks enemies. Use walls to guide attacks toward your guns.',
  mortar: 'Long-range shells damage groups. Best behind the front line.',
  arc: 'Hits up to four nearby enemies with each discharge.',
  mine: 'Produces metal. Must be built on an amber deposit.',
  generator: 'Adds power. Keep enough power for all defenses and industry.',
  barracks: 'Trains squads of four troops. Each squad costs 180 metal.',
  relay: 'Extends the build area by 46 m and heals troops within 18 m.',
};
const OPENING = {
  blackpine: 'Build extractors and cover the north gate.',
  redcliff: 'Build extractors and cover the north-east breach.',
};

const HINTS = {
  keyboard:
    '<span><kbd>WASD</kbd> MOVE CAMERA</span><span><kbd>Q E</kbd> ROTATE</span><span><kbd>SCROLL</kbd> ZOOM</span><span><kbd>TAB</kbd> SELECT TROOPS</span><span><kbd>SPACE</kbd> HOME</span><span><kbd>ALT + CLICK</kbd> PING</span>',
  gamepad:
    '<span><kbd>L</kbd> CURSOR</span><span><kbd>R</kbd> PAN</span><span><kbd>A</kbd> SELECT / ORDER</span><span><kbd>X</kbd> ATTACK-MOVE</span><span><kbd>Y</kbd> ALL TROOPS</span><span><kbd>LB RB</kbd> ROTATE</span><span><kbd>LT RT</kbd> ZOOM</span><span><kbd>◀ ▶</kbd> BUILD</span>',
  touch: '<span><kbd>DRAG</kbd> PAN</span><span><kbd>PINCH</kbd> ZOOM</span><span><kbd>TAP</kbd> SELECT / ORDER</span><span><kbd>TAP TWICE</kbd> BUILD</span>',
};
const MENU_HINT = {
  keyboard: 'WASD TO MOVE  /  SCROLL TO ZOOM  /  Q + E TO ROTATE',
  gamepad: 'D-PAD OR LEFT STICK TO CHOOSE  /  A TO CONFIRM  /  START PAUSES',
  touch: 'DRAG TO PAN  /  PINCH TO ZOOM  /  TAP TO ORDER',
};
const DOCK_TIP = { keyboard: 'SHIFT: PLACE MORE', gamepad: 'D-PAD ◀ ▶: PICK', touch: 'TAP TWICE TO BUILD' };

/* ------------------------------------------------------------------ input actions (the standard bindings) */

const ACTIONS = {
  pan: { type: 'vector', keys: 'wasd+arrows', gamepad: 'rightStick' },
  cursor: { type: 'vector', gamepad: 'leftStick' },
  // One finger dragging the battlefield pans it. The mouse never drives this (no pointer lock).
  look: { type: 'look', mouse: 'locked', touch: 'drag', gamepad: [] },
  select: { mouse: [0] },
  order: { mouse: [2] },
  drag: { mouse: [1] },
  shift: { keys: ['ShiftLeft', 'ShiftRight'] },
  alt: { keys: ['AltLeft', 'AltRight'] },
  ctrl: { keys: ['ControlLeft', 'ControlRight'] },
  confirm: { gamepad: ['A'] },
  attack: { gamepad: ['X'] },
  troops: { keys: ['Tab'], gamepad: ['Y'] },
  back: { gamepad: ['B'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  enter: { keys: ['Enter', 'NumpadEnter'] },
  rotL: { keys: ['KeyQ'], gamepad: ['LB'] },
  rotR: { keys: ['KeyE'], gamepad: ['RB'] },
  zoom: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RT', neg: 'LT' } },
  home: { keys: ['Space'], gamepad: ['RS'] },
  overview: { keys: ['KeyM'], gamepad: ['Back'] },
  rotate: { keys: ['KeyR'] },
  strike: { keys: ['KeyF'], gamepad: ['Up'] },
  speed: { gamepad: ['Down'] },
  prevBuild: { gamepad: ['Left'] },
  nextBuild: { gamepad: ['Right'] },
  upgrade: { keys: ['KeyU'] },
  repair: { keys: ['KeyH'] },
  train: { keys: ['KeyT'] },
  navUp: { keys: ['ArrowUp'], gamepad: ['Up'] },
  navDown: { keys: ['ArrowDown'], gamepad: ['Down'] },
  navLeft: { keys: ['ArrowLeft'], gamepad: ['Left'] },
  navRight: { keys: ['ArrowRight'], gamepad: ['Right'] },
};
BUILD_ORDER.forEach((_, i) => (ACTIONS[`b${i + 1}`] = { keys: [`Digit${i + 1}`, `Numpad${i + 1}`] }));
const DIRS = ['Up', 'Down', 'Left', 'Right'];

/* ------------------------------------------------------------------ boot */

const audio = createAudio();
// Audio may only start inside a user gesture; these listeners only unlock it.
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => audio.unlock(), { capture: true, passive: true });

const kit = await boot({
  title: 'IRONHOLD — Hold the line',
  canvas: $('scene'),
  gear: 'none', // the pause menu and the main menu open the kit's settings (and F9 does)
  accent: '#e6b66c',
  background: '#162c25',
  touch: { hint: false },
  input: ACTIONS,
});
const input = kit.input;
const canvas = kit.canvas;
const hud = $('hud');
const minimap = $('minimap');
kit.loading.progress(0.72, 'Preparing the field…');
const view = await createView(kit);

/* ------------------------------------------------------------------ game state */

let mode = 'menu';
let started = false;
let pid = 0;
let speed = 1;
let accumulator = 0;
let lastSave = 0;
let mapId = prefs.map;
let difficulty = prefs.difficulty;
let sim = new Sim({ map: mapId });
let state = sim;
let checkpoint = null;
let checkpointWave = 0;
const sel = new Set();
let groups = {};
let buildType = null;
let buildRot = 0;
let strikeAim = false;
let drag = null;
let touchG = null;
let miniHold = false;
const touchAim = { on: false, x: 0, y: 0 };
const aim = { x: innerWidth / 2, y: innerHeight / 2, over: false, world: { x: 0, z: 0 } };
const fx = [];
let eventCursor = 0;
let bannerUntil = 0;
let endShown = false;
let now = 0;
let menuTime = 0;
let hudTimer = 0;
let miniTimer = 0;
let lastCoreHp = null;
let lastAlarm = -99;
let selectionSig = '';
let teamSig = '';
let armedSell = null;
let restartArmed = 0;
let lastPX = 0;
let lastPY = 0;
const cam = { x: -36, z: 34, yaw: 0.76, tyaw: 0.76, zoom: 198, tx: -36, tz: 34, tzoom: 198 };
const strikeFx = { id: 0, type: 'strikeMark', x: 0, z: 0, start: 0, life: 2 };
const preview = { x: 0, z: 0, rot: 0, type: '', valid: false, error: '' };
const tmpPt = { x: 0, z: 0 };
const projOut = { x: 0, y: 0 };

const E = {};
for (const id of ['metal', 'income', 'power', 'population', 'sessionMode', 'speedBtn', 'soundBtn', 'phaseLabel', 'phaseTime', 'waveNumber', 'waveTotal', 'phaseProgress', 'phaseDetail', 'waveBtn', 'task1', 'task2', 'task3', 'coordinates', 'corePercent', 'coreBar', 'coreHealth', 'teamCount', 'teamList', 'bossBar', 'bossHp', 'bossFill', 'buildHint', 'buildHintTitle', 'buildHintText', 'buildStatus', 'dockTip', 'dockKeyTip', 'selectionTag', 'selectionIcon', 'selectionName', 'selectionDesc', 'selectionStats', 'selectionActions', 'strikeBtn', 'strikeStatus', 'fps', 'selectionBox', 'tooltip', 'miniTitle']) E[id] = $(id);

const modalOpen = () => isShown('helpModal') || isShown('pauseModal') || isShown('endModal');

/* ------------------------------------------------------------------ feedback: toasts and sound */

function toast(text, bad = false) {
  const box = $('toasts');
  while (box.children.length >= 4) box.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (bad ? ' bad' : '');
  el.textContent = text;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3900);
}

/** Positional sound: louder near the centre of the view. Returns the volume used. */
function sound(type, x, z) {
  const vol = Math.max(0, 1 - Math.hypot(cam.x - x, cam.z - z) / 180);
  if (vol > 0) audio.play(type, vol);
  return vol;
}

/* ------------------------------------------------------------------ picking */

const pickRay = { a: [0, 0, 0], b: [0, 0, 0] };
const boxMin = [0, 0, 0];
const boxMax = [0, 0, 0];
function rayBox(r) {
  let near = 0, far = 1;
  for (let i = 0; i < 3; i++) {
    const d = r.b[i] - r.a[i];
    if (Math.abs(d) < 1e-8) {
      if (r.a[i] < boxMin[i] || r.a[i] > boxMax[i]) return -1;
    } else {
      let t1 = (boxMin[i] - r.a[i]) / d, t2 = (boxMax[i] - r.a[i]) / d;
      if (t1 > t2) {
        const t = t1;
        t1 = t2;
        t2 = t;
      }
      near = Math.max(near, t1);
      far = Math.min(far, t2);
      if (near > far) return -1;
    }
  }
  return near;
}
function setBox(x0, y0, z0, x1, y1, z1) {
  boxMin[0] = x0;
  boxMin[1] = y0;
  boxMin[2] = z0;
  boxMax[0] = x1;
  boxMax[1] = y1;
  boxMax[2] = z1;
}
/** The unit, structure or enemy under a screen point. slop widens the boxes for fingers. */
function pick(sx, sy, slop = 0) {
  const r = view.ray(sx, sy, pickRay), H = view.map.height;
  let best = null, kind = '', tb = Infinity;
  for (const u of state.units) {
    const y = H(u.x, u.z), s = 1.15 + slop;
    setBox(u.x - s, y, u.z - s, u.x + s, y + 3.4, u.z + s);
    const t = rayBox(r);
    if (t >= 0 && t < tb) {
      tb = t;
      best = u;
      kind = 'unit';
    }
  }
  for (const b of state.buildings) {
    const q = bounds(b), y = H(b.x, b.z), h = b.type === 'core' ? 13 : b.type === 'arc' ? 9 : 6;
    setBox(b.x - q.w, y, b.z - q.d, b.x + q.w, y + h, b.z + q.d);
    const t = rayBox(r);
    if (t >= 0 && t < tb) {
      tb = t;
      best = b;
      kind = 'building';
    }
  }
  for (const e of state.enemies) {
    const d = ENEMIES[e.type], q = d.r + slop * 0.6, y = H(e.x, e.z);
    setBox(e.x - q, y, e.z - q, e.x + q, y + (d.boss ? 7 : 4), e.z + q);
    const t = rayBox(r);
    if (t >= 0 && t < tb) {
      tb = t;
      best = e;
      kind = 'enemy';
    }
  }
  return best ? { kind, item: best } : null;
}

function unitsInBox(x0, y0, x1, y1) {
  const H = view.map.height, ids = [];
  for (const u of state.units) {
    if (u.owner !== pid) continue;
    const p = view.project(u.x, H(u.x, u.z) + 1.5, u.z, projOut);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(u.id);
  }
  return ids;
}

/* ------------------------------------------------------------------ selection and orders */

function choose(ids, add = false) {
  if (!add) sel.clear();
  for (const id of ids) sel.add(id);
  selectionSig = '';
  audio.play('ui', 0.7);
}
const ownSelected = () => {
  const ids = [];
  for (const u of state.units) if (u.owner === pid && sel.has(u.id)) ids.push(u.id);
  return ids;
};
function selectAllTroops() {
  const ids = [];
  for (const u of state.units) if (u.owner === pid) ids.push(u.id);
  choose(ids);
}
function selectSquad(unit) {
  const ids = [];
  for (const u of state.units) if (u.owner === pid && Math.hypot(u.x - unit.x, u.z - unit.z) < 12) ids.push(u.id);
  choose(ids);
}
const selectedBuilding = () => {
  for (const b of state.buildings) if (sel.has(b.id)) return b;
  return null;
};

function send(c) {
  if (mode !== 'play' || modalOpen()) return { ok: false };
  const r = sim.command(pid, c);
  if (!r.ok) {
    toast(r.error, true);
    audio.play('error');
  }
  selectionSig = '';
  return r;
}

function issueOrder(sx, sy, attack, hit = pick(sx, sy)) {
  const ids = ownSelected();
  if (!ids.length) {
    toast('Select your troops before you give a move order.');
    return;
  }
  const enemy = hit?.kind === 'enemy' ? hit.item : null;
  const w = view.ground(sx, sy, tmpPt);
  const r = send({ type: enemy || attack ? 'attack' : 'move', ids, x: enemy ? enemy.x : w.x, z: enemy ? enemy.z : w.z, target: enemy ? enemy.id : 0 });
  if (r.ok) audio.play('ui', 0.5);
}

function buildingAction(type) {
  let b = selectedBuilding();
  if (type === 'train' && b?.type !== 'barracks') b = state.buildings.find((v) => v.type === 'barracks' && v.progress >= 1) || null;
  if (b) {
    const r = send({ type, id: b.id });
    if (r.ok) audio.play(type === 'sell' ? 'destroy' : 'build', type === 'sell' ? 0.4 : 1);
  } else toast(type === 'train' ? 'Build a barracks first.' : 'Select a building first.', true);
}

function saveGroup(n) {
  groups[n] = ownSelected();
  toast(`Control group ${n} saved.`);
}
function recallGroup(n) {
  const alive = (groups[n] || []).filter((id) => state.units.some((u) => u.id === id));
  choose(alive);
  if (!alive.length) toast(`Control group ${n} is empty.`);
}

/* ------------------------------------------------------------------ building and the support strike */

function cancelBuild() {
  buildType = null;
  strikeAim = false;
  touchAim.on = false;
  hide('buildHint');
  canvas.style.cursor = '';
  for (const b of document.querySelectorAll('.build-button')) b.classList.remove('chosen');
  E.strikeBtn.classList.remove('aiming');
}
/** Touch has no hover: a new placement starts in the middle of the view. */
function centreTouchAim() {
  if (input.source !== 'touch') return;
  touchAim.on = true;
  touchAim.x = kit.size.width / 2;
  touchAim.y = kit.size.height * 0.45;
}
function setBuild(type) {
  if (mode !== 'play' || modalOpen() || endShown) return;
  if (buildType === type) {
    cancelBuild();
    return;
  }
  buildType = type;
  strikeAim = false;
  hideTip();
  canvas.style.cursor = 'crosshair';
  for (const b of document.querySelectorAll('.build-button')) b.classList.toggle('chosen', b.dataset.type === type);
  E.strikeBtn.classList.remove('aiming');
  show('buildHint');
  centreTouchAim();
  audio.play('ui', 0.7);
}
function cycleBuild(dir) {
  const i = BUILD_ORDER.indexOf(buildType);
  const next = i < 0 ? (dir > 0 ? 0 : BUILD_ORDER.length - 1) : (i + dir + BUILD_ORDER.length) % BUILD_ORDER.length;
  setBuild(BUILD_ORDER[next]);
}
function rotateBuild() {
  if (!buildType) return;
  buildRot = 1 - buildRot;
  audio.play('ui', 0.6);
}
function aimStrike() {
  if (mode !== 'play' || modalOpen() || endShown) return;
  const ability = state.players[pid].ability;
  if (ability > 0) {
    toast(`Support will be ready in ${Math.ceil(ability)} seconds.`, true);
    return;
  }
  const was = strikeAim;
  cancelBuild();
  strikeAim = !was;
  if (strikeAim) {
    show('buildHint');
    E.strikeBtn.classList.add('aiming');
    canvas.style.cursor = 'crosshair';
    centreTouchAim();
  }
}

/** The structure under the aim point, snapped to the grid (extractors snap onto a deposit). */
function placement() {
  if (!buildType) return null;
  const p = aim.world, type = buildType;
  let x = Math.round(p.x / 4) * 4, z = Math.round(p.z / 4) * 4;
  if (type === 'mine') {
    let best = null, bd = 12;
    for (const d of view.map.deposits) {
      const dd = Math.hypot(d.x - p.x, d.z - p.z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
    }
    if (best) {
      x = best.x;
      z = best.z;
    }
  }
  const error = sim.canBuild(type, x, z, buildRot);
  preview.x = x;
  preview.z = z;
  preview.rot = buildRot;
  preview.type = type;
  preview.valid = !error;
  preview.error = error;
  return preview;
}

function place(keep) {
  updateAim();
  if (strikeAim) {
    const r = send({ type: 'strike', x: aim.world.x, z: aim.world.z });
    if (r.ok) {
      cancelBuild();
      audio.play('build');
      input.rumble(0.3, 90);
    }
    return;
  }
  const p = placement();
  if (!p) return;
  const r = send({ type: 'build', kind: p.type, x: p.x, z: p.z, rot: p.rot });
  if (r.ok) {
    audio.play('build');
    if (!keep && p.type !== 'wall') cancelBuild();
  }
}

let hintSig = '';
function updateBuildHint(p) {
  const src = input.source;
  let title, text;
  if (strikeAim) {
    title = 'SUPPORT STRIKE';
    text = src === 'gamepad' ? 'A marks the target · B cancels' : src === 'touch' ? 'Tap to aim, then tap the same spot again' : 'Left click to mark the target · Esc to cancel';
  } else {
    title = p ? (p.valid ? `PLACE ${TYPES[p.type].name.toUpperCase()}` : p.error) : `PLACE ${TYPES[buildType].name.toUpperCase()}`;
    text = src === 'gamepad' ? 'A to build · Y to rotate · B to cancel' : src === 'touch' ? 'Tap to move the preview, tap it again to build' : 'Left click to build · R to rotate · Shift to place more · Esc to cancel';
  }
  const bad = !!(p && !p.valid);
  const sig = title + '|' + text + '|' + bad + '|' + strikeAim;
  if (sig === hintSig) return;
  hintSig = sig;
  setText(E.buildHintTitle, title);
  setText(E.buildHintText, text);
  E.buildHint.classList.toggle('bad', bad);
  setText($('hintPlace'), strikeAim ? 'CALL STRIKE' : 'BUILD HERE');
  $('hintRotate').classList.toggle('hidden', strikeAim);
}

/* ------------------------------------------------------------------ camera */

function panByPixels(dx, dy, snap) {
  const k = cam.zoom / kit.size.height, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  const ddx = -c * dx * k - s * dy * k * 1.35, ddz = s * dx * k - c * dy * k * 1.35;
  cam.tx = clamp(cam.tx + ddx, -174, 174);
  cam.tz = clamp(cam.tz + ddz, -174, 174);
  if (snap) {
    // Dragging holds the ground under the finger; no easing lag.
    cam.x = clamp(cam.x + ddx, -174, 174);
    cam.z = clamp(cam.z + ddz, -174, 174);
  }
}
function overview() {
  cam.tzoom = cam.tzoom > 280 ? 164 : 410;
  if (cam.tzoom > 280) cam.tx = cam.tz = 0;
}
function updateCam(dt) {
  if (mode === 'menu') {
    menuTime += dt;
    cam.yaw = cam.tyaw = 0.76 + Math.sin(menuTime * 0.055) * 0.09;
  } else if (mode === 'play' && !modalOpen()) {
    const v = input.vector('pan');
    if (v.x || v.y) {
      const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      const pan = cam.zoom * 0.65 * dt * (input.down('shift') ? 1.7 : 1);
      cam.tx = clamp(cam.tx + (-s * v.y + c * v.x) * pan, -170, 170);
      cam.tz = clamp(cam.tz + (-c * v.y - s * v.x) * pan, -170, 170);
    }
    if (input.down('rotL')) cam.tyaw -= dt * 0.85;
    if (input.down('rotR')) cam.tyaw += dt * 0.85;
    const zv = input.value('zoom');
    if (zv) cam.tzoom = clamp(cam.tzoom * Math.exp(-zv * dt * 1.8), 48, 430);
    const wz = input.wheel * 0.1 + input.pinch * 0.25;
    if (wz) cam.tzoom = clamp(cam.tzoom * Math.exp(-wz), 48, 430);
  }
  const k = 1 - Math.exp(-dt * 12);
  cam.x += (cam.tx - cam.x) * k;
  cam.z += (cam.tz - cam.z) * k;
  cam.zoom += (cam.tzoom - cam.zoom) * k;
  cam.yaw += (cam.tyaw - cam.yaw) * (1 - Math.exp(-dt * 14));
}

/* ------------------------------------------------------------------ controller cursor and menu navigation */

const PAD_CLICKABLE = 'button:not([disabled]), label.checkline';
const KEY_FOCUSABLE = 'button:not([disabled]), input[type="checkbox"]:not([disabled])';
function visibleEl(b) {
  if (!b.getClientRects().length) return false;
  const r = b.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
}
/** The nearest control from (ax, ay) in a direction, favouring ones in line. */
function nearestFrom(ax, ay, dir, list, skip) {
  const dx = dir === 'Left' ? -1 : dir === 'Right' ? 1 : 0, dy = dir === 'Up' ? -1 : dir === 'Down' ? 1 : 0;
  let best = null, score = Infinity;
  for (const b of list) {
    if (b === skip || !visibleEl(b)) continue;
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const along = (cx - ax) * dx + (cy - ay) * dy, across = Math.abs((cx - ax) * dy) + Math.abs((cy - ay) * dx);
    if (along < 6 || across > along * 1.6 + 40) continue;
    const s = along + across * 2.5;
    if (s < score) {
      score = s;
      best = b;
    }
  }
  return best;
}
function scopeEl() {
  if (isShown('endModal')) return $('endModal');
  if (isShown('helpModal')) return $('helpModal');
  if (isShown('pauseModal')) return $('pauseModal');
  if (mode === 'menu') return $('menu');
  return hud;
}
function primaryIn(sc) {
  if (sc.id === 'endModal') return isShown('endRetry') ? $('endRetry') : $('endRestart');
  if (sc.id === 'helpModal') return $('helpClose');
  if (sc.id === 'pauseModal') return $('resumeBtn');
  if (sc.id === 'menu') return $('solo');
  return null;
}

let tipFromPad = false;
function showTip(btn) {
  const type = btn.dataset.type, d = TYPES[type], tip = E.tooltip;
  tip.innerHTML = `<strong>${d.name}</strong>${DESC[type]}<span class="tt-stat">${d.hp} HP${d.range ? ` · ${d.range} m range` : ''}${d.power ? ` · ${d.power} power` : ''}${d.supply ? ` · +${d.supply} power` : ''}${d.income ? ` · +${d.income} metal/s` : ''}<br>${d.build} seconds to build</span>`;
  const r = btn.getBoundingClientRect();
  tip.style.left = `${clamp(r.left, 8, innerWidth - 270)}px`;
  tip.style.top = `${Math.max(8, r.top - 156)}px`;
  show('tooltip');
}
function hideTip() {
  tipFromPad = false;
  hide('tooltip');
}

const pad = (() => {
  const el = $('padCursor');
  let x = innerWidth / 2, y = innerHeight / 2, active = false, fresh = false, hot = null, cur = null, scope = null;
  let repeatDir = null, repeatAt = 0, drawnX = NaN, drawnY = NaN;
  function draw() {
    if (x === drawnX && y === drawnY) return;
    drawnX = x;
    drawnY = y;
    el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  }
  function snapTo(b) {
    if (!b || !visibleEl(b)) return;
    b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect();
    x = clamp(r.left + r.width / 2, 2, innerWidth - 2);
    y = clamp(r.top + r.height / 2, 2, innerHeight - 2);
    draw();
  }
  function jump(dir) {
    const next = nearestFrom(x, y, dir, scope.querySelectorAll(PAD_CLICKABLE), hot);
    if (next) snapTo(next);
  }
  function under() {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    if (hit === canvas) return 'map';
    if (hit === minimap) return 'minimap';
    const b = hit.closest(PAD_CLICKABLE);
    return b && scope && scope.contains(b) ? b : null;
  }
  function setHot(n) {
    if (n === hot) return;
    hot?.classList.remove('pad-hot');
    if (tipFromPad) hideTip();
    hot = n;
    if (hot) {
      hot.classList.add('pad-hot');
      if (hot.classList.contains('build-button')) {
        showTip(hot);
        tipFromPad = true;
      }
    }
    el.classList.toggle('on-button', !!hot);
  }
  return {
    get active() {
      return active;
    },
    get x() {
      return x;
    },
    get y() {
      return y;
    },
    get cur() {
      return cur;
    },
    update(dt, sc) {
      const on = input.source === 'gamepad';
      if (on !== active) {
        active = on;
        el.hidden = !on;
        fresh = on;
        scope = null;
        if (!on) {
          setHot(null);
          cur = null;
        }
      }
      if (!on) return;
      if (sc !== scope) {
        scope = sc;
        if (sc !== hud) snapTo(primaryIn(sc));
      }
      const v = input.vector('cursor'), m = Math.hypot(v.x, v.y);
      if (m > 0) {
        const sp = Math.min(innerWidth, innerHeight) * (0.35 + 0.95 * m);
        x = clamp(x + v.x * sp * dt, 2, innerWidth - 2);
        y = clamp(y - v.y * sp * dt, 2, innerHeight - 2);
      }
      if (sc !== hud) {
        const t = performance.now();
        for (const dir of DIRS) {
          const name = 'nav' + dir;
          if (input.pressed(name)) {
            jump(dir);
            repeatDir = dir;
            repeatAt = t + 380;
          } else if (repeatDir === dir && input.down(name) && t > repeatAt) {
            jump(dir);
            repeatAt = t + 130;
          } else if (repeatDir === dir && !input.down(name)) repeatDir = null;
        }
      }
      draw();
      cur = under();
      setHot(cur === 'map' || cur === 'minimap' ? null : cur);
    },
    /** A was pressed: clicks a button under the cursor, or returns 'map' / 'minimap'. The waking press does nothing. */
    press() {
      if (!active) return null;
      if (fresh) {
        fresh = false;
        return null;
      }
      if (cur && cur !== 'map' && cur !== 'minimap') {
        if (cur.isConnected) cur.click();
        return 'button';
      }
      return cur;
    },
    hide(on) {
      el.hidden = on || !active;
    },
    endFrame() {
      fresh = false;
    },
  };
})();

function moveFocus(sc, dir) {
  const list = sc.querySelectorAll(KEY_FOCUSABLE);
  const curEl = sc.contains(document.activeElement) && document.activeElement.matches(KEY_FOCUSABLE) ? document.activeElement : null;
  let next = null;
  if (curEl) {
    const r = curEl.getBoundingClientRect();
    next = nearestFrom(r.left + r.width / 2, r.top + r.height / 2, dir, list, curEl);
  } else next = primaryIn(sc);
  next?.focus();
}
function goBack(sc) {
  if (sc.id === 'helpModal') closeHelp();
  else if (sc.id === 'pauseModal') resume();
}
function menuInput(sc, dt) {
  if (input.pressed('pause') || input.pressed('back')) {
    goBack(sc);
    return;
  }
  if (input.pressed('confirm')) {
    pad.press();
    return;
  }
  if (input.pressed('enter')) {
    // A focused button takes Enter itself; with nothing focused Enter means the main choice.
    const b = primaryIn(sc);
    if (b && !b.disabled && visibleEl(b)) b.click();
    return;
  }
  if (input.source === 'gamepad') {
    // The right stick scrolls a long manual.
    const v = input.vector('pan'), card = sc.querySelector('.modal-card');
    if (card && v.y) card.scrollTop -= v.y * 700 * dt;
  } else {
    for (const dir of DIRS) {
      if (input.pressed('nav' + dir)) {
        moveFocus(sc, dir);
        break;
      }
    }
  }
}

/* ------------------------------------------------------------------ gameplay input */

function hideBox() {
  E.selectionBox.style.display = 'none';
}
function trackDrag(x, y) {
  if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 5) drag.moved = true;
  if (!drag.moved) return;
  const s = E.selectionBox.style;
  s.display = 'block';
  s.left = `${Math.min(drag.x, x)}px`;
  s.top = `${Math.min(drag.y, y)}px`;
  s.width = `${Math.abs(drag.x - x)}px`;
  s.height = `${Math.abs(drag.y - y)}px`;
}
function finishDrag(x, y) {
  const d = drag;
  drag = null;
  hideBox();
  if (d.moved) choose(unitsInBox(Math.min(d.x, x), Math.min(d.y, y), Math.max(d.x, x), Math.max(d.y, y)), d.add);
  else {
    const hit = pick(d.x, d.y);
    choose(hit ? [hit.item.id] : [], d.add && hit?.kind === 'unit');
  }
}

/** A tap on the battlefield: select, order, or (while building) preview then confirm. */
function touchTap(sx, sy) {
  if (buildType || strikeAim) {
    if (touchAim.on && Math.hypot(sx - touchAim.x, sy - touchAim.y) < 36) place(false);
    else {
      touchAim.on = true;
      touchAim.x = sx;
      touchAim.y = sy;
      audio.play('ui', 0.5);
    }
    return;
  }
  const hit = pick(sx, sy, 1.2), own = ownSelected();
  if (hit?.kind === 'unit' && hit.item.owner === pid) {
    if (sel.has(hit.item.id)) selectSquad(hit.item);
    else choose([hit.item.id]);
  } else if (hit?.kind === 'enemy') {
    if (own.length) issueOrder(sx, sy, true, hit);
    else choose([hit.item.id]);
  } else if (hit) choose([hit.item.id]);
  else if (own.length) issueOrder(sx, sy, false, null);
  else if (sel.size) choose([]);
}

/** A on the battlefield with a controller. */
function padMapPress() {
  if (buildType || strikeAim) {
    place(false);
    return;
  }
  const hit = pick(pad.x, pad.y, 0.8), own = ownSelected();
  if (hit?.kind === 'unit' && hit.item.owner === pid) {
    if (sel.has(hit.item.id)) selectSquad(hit.item);
    else choose([hit.item.id]);
    return;
  }
  if (own.length && hit?.kind !== 'building') {
    issueOrder(pad.x, pad.y, false, hit);
    return;
  }
  if (hit) {
    choose([hit.item.id]);
    return;
  }
  drag = { x: pad.x, y: pad.y, add: false, moved: false, pad: true };
}

function miniJump(sx, sy) {
  const r = minimap.getBoundingClientRect();
  if (!r.width) return;
  cam.tx = clamp(((sx - r.left) / r.width) * 384 - 192, -170, 170);
  cam.tz = clamp(((sy - r.top) / r.height) * 384 - 192, -170, 170);
}

function gameInput() {
  const P = input.pointer;
  if (input.pressed('pause')) {
    if (buildType || strikeAim) cancelBuild();
    else openPause();
    return;
  }
  if (input.pressed('back')) {
    if (buildType || strikeAim) cancelBuild();
    else if (drag) {
      drag = null;
      hideBox();
    } else if (sel.size) choose([]);
  }
  const ctrl = input.down('ctrl'), alt = input.down('alt');
  for (let i = 0; i < BUILD_ORDER.length; i++) {
    if (!input.pressed(`b${i + 1}`)) continue;
    if (i < 4 && ctrl) saveGroup(i + 1);
    else if (i < 4 && alt) recallGroup(i + 1);
    else setBuild(BUILD_ORDER[i]);
  }
  if (input.pressed('troops')) {
    if (input.source === 'gamepad' && buildType) rotateBuild();
    else {
      cancelBuild();
      selectAllTroops();
    }
  }
  if (input.pressed('home')) {
    cam.tx = cam.tz = 0;
    cam.tzoom = 164;
  }
  if (input.pressed('overview')) overview();
  if (input.pressed('rotate')) rotateBuild();
  if (input.pressed('strike')) aimStrike();
  if (input.pressed('speed')) toggleSpeed();
  if (input.pressed('prevBuild')) cycleBuild(-1);
  if (input.pressed('nextBuild')) cycleBuild(1);
  if (input.pressed('upgrade')) buildingAction('upgrade');
  if (input.pressed('repair')) buildingAction('repair');
  if (input.pressed('train')) buildingAction('train');

  // Mouse: left selects (drag for a box) or places, right orders or cancels, middle pans.
  if (input.pressed('select')) {
    if (alt) {
      const w = view.ground(P.x, P.y, tmpPt);
      send({ type: 'ping', x: w.x, z: w.z });
    } else if (buildType || strikeAim) place(input.down('shift'));
    else drag = { x: P.x, y: P.y, add: input.down('shift'), moved: false, pad: false };
  }
  if (drag && !drag.pad) {
    if (input.down('select')) trackDrag(P.x, P.y);
    else finishDrag(P.x, P.y);
  }
  if (input.pressed('order')) {
    if (buildType || strikeAim) cancelBuild();
    else issueOrder(P.x, P.y, input.down('shift'));
  }
  if (input.down('drag') && !input.pressed('drag')) panByPixels(P.x - lastPX, P.y - lastPY, true);
  lastPX = P.x;
  lastPY = P.y;

  // Touch: one finger drags the map, two pinch, a short tap acts.
  if (P.justDown && P.type === 'touch') touchG = { x: P.x, y: P.y, ax: 0, ay: 0, dist: 0, pinch: false, pan: false };
  if (touchG) {
    const lk = input.look('look');
    const s = kit.settings.get(), k = TOUCH_LOOK * (s.lookSensitivity || 1), inv = s.invertY ? -1 : 1;
    const px = lk.x / k, py = lk.y / (k * inv);
    if (input.pinch) touchG.pinch = true;
    touchG.dist += Math.abs(px) + Math.abs(py);
    if (touchG.pan) panByPixels(px, py, true);
    else {
      touchG.ax += px;
      touchG.ay += py;
      if (touchG.dist > 12 || touchG.pinch) {
        touchG.pan = true;
        panByPixels(touchG.ax, touchG.ay, true);
      }
    }
    if (P.justUp || !P.down) {
      const g = touchG;
      touchG = null;
      if (!g.pan && !g.pinch) touchTap(g.x, g.y);
    }
  }

  // Controller: A acts on whatever the cursor points at, X attack-moves.
  if (drag?.pad && !pad.active) {
    drag = null;
    hideBox();
  }
  if (pad.active) {
    if (input.pressed('confirm')) {
      const what = pad.press();
      if (what === 'map') padMapPress();
      else if (what === 'minimap') {
        miniJump(pad.x, pad.y);
        miniHold = true;
      }
    }
    if (miniHold) {
      if (input.down('confirm') && pad.cur === 'minimap') miniJump(pad.x, pad.y);
      else miniHold = false;
    }
    if (drag?.pad) {
      if (input.down('confirm')) trackDrag(pad.x, pad.y);
      else finishDrag(pad.x, pad.y);
    }
    if (input.pressed('attack') && pad.cur === 'map') issueOrder(pad.x, pad.y, true);
  }
}

function handleInput(dt) {
  const sc = scopeEl();
  pad.update(dt, sc);
  if (sc !== hud) {
    if (drag) {
      drag = null;
      hideBox();
    }
    touchG = null;
    miniHold = false;
    menuInput(sc, dt);
    return;
  }
  if (mode === 'play') gameInput();
}

/** Where a placement or strike lands: the mouse, the controller cursor, or the last tap. */
function updateAim() {
  if (pad.active) {
    aim.x = pad.x;
    aim.y = pad.y;
    aim.over = pad.cur === 'map';
  } else if (input.source === 'touch') {
    aim.x = touchAim.x;
    aim.y = touchAim.y;
    aim.over = touchAim.on;
  } else {
    aim.x = input.pointer.x;
    aim.y = input.pointer.y;
    aim.over = input.pointer.over;
  }
  view.ground(aim.x, aim.y, aim.world);
}

/* ------------------------------------------------------------------ missions: start, save, load, end */

function beginMission() {
  mode = 'play';
  started = true;
  pid = 0;
  speed = 1;
  accumulator = 0;
  endShown = false;
  eventCursor = sim.eventId;
  fx.length = 0;
  groups = {};
  drag = null;
  touchG = null;
  armedSell = null;
  lastCoreHp = null;
  lastAlarm = -99;
  view.clearSmoothing();
  cancelBuild();
  hideBox();
  hideTip();
  for (const id of ['menu', 'pauseModal', 'endModal', 'helpModal', 'waveBanner', 'bossBar']) hide(id);
  bannerUntil = 0;
  show('hud');
  boundsDirty = true;
  selectionSig = '';
  teamSig = '';
  lastSave = performance.now();
  setText(E.miniTitle, sim.map.title);
  audio.unlock();
  input.settle();
  sel.clear();
  for (const u of sim.units) if (u.owner === pid) sel.add(u.id);
  updateHUD();
  drawMinimap();
}

function newSolo(o) {
  sim = new Sim({ map: o.map, difficulty: o.difficulty, endless: o.endless });
  sim.players[0].name = 'You';
  state = sim;
  if (view.map !== sim.map) view.setMap(sim.map);
  beginMission();
  cam.tx = 0;
  cam.tz = 4;
  cam.tzoom = 164;
  cam.tyaw = 0.76;
  checkpoint = JSON.stringify(sim.snapshot());
  checkpointWave = 0;
  toast(OPENING[sim.mapId] || OPENING.blackpine);
}
const currentSetup = () => ({ map: sim.mapId, difficulty: sim.difficulty, endless: sim.endless });

function loadFrom(raw, message) {
  let next;
  try {
    next = Sim.restore(JSON.parse(raw));
  } catch {
    toast('The saved defense could not be loaded.', true);
    return false;
  }
  if (next.phase === 'won' || next.phase === 'lost') {
    store.remove(SAVE_KEY);
    checkSave();
    toast('That defense has already ended.', true);
    return false;
  }
  sim = next;
  sim.paused = false;
  sim.players[0].name = 'You';
  state = sim;
  if (view.map !== sim.map) view.setMap(sim.map);
  beginMission();
  cam.tx = cam.tz = 0;
  cam.tzoom = 164;
  checkpoint = raw;
  checkpointWave = sim.phase === 'build' ? sim.wave : Math.max(0, sim.wave - 1);
  toast(message);
  return true;
}

function saveGame(quiet = false) {
  if (mode !== 'play' || !started || sim.phase === 'lost' || sim.phase === 'won') {
    if (!quiet) toast('There is no running defense to save.', true);
    return false;
  }
  const s = sim.snapshot();
  s.paused = false;
  const ok = store.set(SAVE_KEY, JSON.stringify(s));
  if (!quiet) toast(ok ? 'Defense saved on this browser.' : 'The browser could not save this defense.', !ok);
  if (ok) checkSave();
  return ok;
}

function checkSave() {
  const raw = store.get(SAVE_KEY);
  let info = '';
  let ok = false;
  if (raw) {
    try {
      const s = JSON.parse(raw);
      if (s && s.phase !== 'won' && s.phase !== 'lost' && Array.isArray(s.buildings)) {
        const m = MAPS[s.mapId] || MAPS.blackpine;
        info = `${m.title} · WAVE ${two(s.phase === 'build' ? s.wave + 1 : s.wave)}`;
        ok = true;
      }
    } catch {
      ok = false;
    }
  }
  $('continue').classList.toggle('hidden', !ok);
  setText($('continueInfo'), info);
}

function toMenu() {
  if (mode === 'play') saveGame(true);
  mode = 'menu';
  started = false;
  hide('hud');
  for (const id of ['pauseModal', 'endModal', 'helpModal', 'waveBanner', 'bossBar']) hide(id);
  show('menu');
  cancelBuild();
  hideBox();
  hideTip();
  sel.clear();
  drag = null;
  touchG = null;
  cam.tx = -36;
  cam.tz = 34;
  cam.tzoom = 198;
  menuTime = 0;
  sim = new Sim({ map: mapId });
  state = sim;
  eventCursor = 0;
  fx.length = 0;
  endShown = false;
  bannerUntil = 0;
  view.clearSmoothing();
  if (view.map !== MAPS[mapId]) view.setMap(MAPS[mapId]);
  checkSave();
  refreshMenu();
  input.settle();
}

/* ------------------------------------------------------------------ records */

const recordKey = (m, d, endless) => `${m}:${d}:${endless ? 'endless' : 'waves'}`;
function recordLabel(r, d, endless) {
  const diff = d.toUpperCase() + (endless ? ' · ENDLESS' : '');
  if (!r) return `NO RECORD YET · ${diff}`;
  if (r.won && !endless) return `CLEARED ON ${diff} · BEST SCORE ${fmt(r.score)}`;
  return `BEST ON ${diff} · ${two(r.held)} WAVES HELD · ${fmt(r.score)} PTS`;
}
function updateRecord(won) {
  const key = recordKey(state.mapId, state.difficulty, state.endless);
  const old = records[key] && typeof records[key] === 'object' ? records[key] : null;
  const held = won ? WAVES_TO_WIN : Math.max(0, state.wave - 1);
  const score = Math.floor(state.score);
  const rec = { held: Math.max(old?.held || 0, held), score: Math.max(old?.score || 0, score), won: !!(old?.won || won) };
  const isNew = !old || held > (old.held || 0) || score > (old.score || 0) || (won && !old.won);
  records[key] = rec;
  store.set(RECORD_KEY, JSON.stringify(records));
  return { isNew, label: recordLabel(rec, state.difficulty, state.endless) };
}

function showEnd() {
  endShown = true;
  cancelBuild();
  drag = null;
  hideBox();
  hideTip();
  hide('bossBar');
  const won = state.phase === 'won';
  const rec = updateRecord(won);
  const m = state.map;
  setText($('endEyebrow'), won ? 'MISSION COMPLETE' : 'DEFENSE LOST');
  setText($('endTitle'), won ? 'The core stands.' : 'The core has fallen.');
  setText(
    $('endText'),
    won
      ? `All ${WAVES_TO_WIN} waves have been stopped at ${m.name}. Your team held the base.`
      : state.endless
        ? `You held ${m.name} for ${Math.max(0, state.wave - 1)} waves. Use more extractors, cover the gates, and keep reserves near the core.`
        : 'Use more extractors, cover the gates, and keep reserves near the core.'
  );
  const secs = Math.floor(state.t);
  $('endStats').innerHTML =
    `<div class="end-stat"><strong>${state.wave}</strong><span>WAVES</span></div>` +
    `<div class="end-stat"><strong>${fmt(state.kills)}</strong><span>ENEMIES STOPPED</span></div>` +
    `<div class="end-stat"><strong>${fmt(state.score)}</strong><span>SCORE</span></div>` +
    `<div class="end-stat"><strong>${two(secs / 60)}:${two(secs % 60)}</strong><span>TIME</span></div>`;
  setText($('endRecord'), (rec.isNew ? 'NEW BEST · ' : '') + rec.label);
  $('endRecord').classList.toggle('new', rec.isNew);
  const retry = !won && !!checkpoint;
  $('endRetry').classList.toggle('hidden', !retry);
  if (retry) setText($('endRetry'), `RETRY FROM WAVE ${two(checkpointWave + 1)}`);
  show('endModal');
  audio.play(won ? 'win' : 'lose');
  input.rumble(won ? 0.4 : 0.9, won ? 300 : 700);
  view.shake(won ? 0 : 1.2);
  // A finished defense is not offered as "continue"; a lost one resumes from its last build phase.
  if (won) store.remove(SAVE_KEY);
  else if (checkpoint) store.set(SAVE_KEY, checkpoint);
  else store.remove(SAVE_KEY);
  input.settle();
}

/* ------------------------------------------------------------------ pause, help, speed, sound */

function openPause() {
  if (mode !== 'play' || endShown) return;
  cancelBuild();
  drag = null;
  hideBox();
  hideTip();
  restartArmed = 0;
  setText($('restartBtn'), 'NEW SOLO DEFENSE');
  setText($('pauseNote'), `${state.map.name} · ${state.difficulty}${state.endless ? ' · endless' : ''}. Solo games save every 20 seconds and at the start of each build phase.`);
  show('pauseModal');
  input.settle();
}
function resume() {
  hide('helpModal');
  hide('pauseModal');
  input.settle();
}
function openHelp() {
  hideTip();
  show('helpModal');
  $('helpModal').querySelector('.modal-card').scrollTop = 0;
  input.settle();
}
function closeHelp() {
  hide('helpModal');
  input.settle();
}
function toggleSpeed() {
  speed = speed === 1 ? 2 : 1;
  setText(E.speedBtn, `${speed}×`);
  audio.play('ui', 0.7);
}
function refreshSoundBtn() {
  setText(E.soundBtn, audio.muted ? 'SOUND OFF' : 'SOUND ON');
}

/* ------------------------------------------------------------------ the main menu */

function refreshMenu() {
  const m = MAPS[mapId];
  for (const b of document.querySelectorAll('#operation button')) b.classList.toggle('active', b.dataset.map === mapId);
  for (const b of document.querySelectorAll('#difficulty button')) b.classList.toggle('active', b.dataset.difficulty === difficulty);
  $('endless').checked = prefs.endless;
  setText($('menuEyebrow'), m.eyebrow);
  setText($('stampOp'), `${m.op} / IRONHOLD`);
  setText($('stampName'), m.title);
  setText($('stampInfo'), m.stamp);
  setText($('menuNote'), `${m.brief} Three allied guard squads fight beside you.`);
  setText($('menuRecord'), recordLabel(records[recordKey(mapId, difficulty, prefs.endless)], difficulty, prefs.endless));
}
function selectMap(id) {
  if (!MAPS[id] || id === mapId) return;
  mapId = id;
  prefs.map = id;
  savePrefs();
  view.setMap(MAPS[id]);
  sim = new Sim({ map: id });
  state = sim;
  view.clearSmoothing();
  refreshMenu();
  audio.play('ui', 0.7);
}

/* ------------------------------------------------------------------ events from the simulation */

function showBanner(eyebrow, title, lanes, t) {
  setText($('bannerEyebrow'), eyebrow);
  setText($('bannerTitle'), title);
  setText($('bannerLanes'), lanes);
  show('waveBanner');
  bannerUntil = t + 4;
}

function onEvent(e, t) {
  switch (e.type) {
    case 'wave':
      showBanner(e.boss ? 'ASSAULT WALKER DETECTED' : 'CONTACT AT THE PERIMETER', `WAVE ${two(e.wave)}`, e.lanes.map((i) => state.map.lanes[i].name.toUpperCase()).join(' / '), t);
      audio.play('wave');
      if (e.boss) input.rumble(0.35, 160);
      break;
    case 'boss':
      showBanner('ASSAULT WALKER', 'JUGGERNAUT', (state.map.lanes[e.lane]?.name || '').toUpperCase(), t);
      audio.play('boss');
      view.shake(1.1);
      input.rumble(0.8, 420);
      toast('A juggernaut leads the column. Focus fire!', true);
      break;
    case 'clear':
      toast(`Wave ${e.wave} cleared. Repair and build.`);
      audio.play('ui');
      checkpoint = JSON.stringify(sim.snapshot());
      checkpointWave = sim.wave;
      saveGame(true);
      lastSave = performance.now();
      break;
    case 'squad':
      if (e.pid === pid) toast('Four troops are ready at the barracks.');
      break;
    case 'ping':
      toast(`${state.players[e.pid]?.name || 'A commander'} marked the map.`);
      break;
    case 'shot':
    case 'death':
    case 'unitDeath':
      sound(e.type, e.x, e.z);
      break;
    case 'blast': {
      const v = sound('blast', e.x, e.z);
      if ((e.kind === 'strike' || e.kind === 'sapper') && v > 0) view.shake(0.9 * v);
      if (e.kind === 'sapper' && v > 0.3) input.rumble(0.45 * v, 150);
      break;
    }
    case 'destroy': {
      const v = sound('destroy', e.x, e.z);
      view.shake(0.5 * Math.max(0.35, v));
      input.rumble(0.45, 180);
      if (e.kind !== 'wall' && TYPES[e.kind]) toast(`${TYPES[e.kind].name} destroyed.`, true);
      break;
    }
    default:
      break;
  }
}

/** Events the view draws (the rest only drive sound and the HUD). */
const FX_TYPES = new Set(['shot', 'enemyShot', 'blast', 'destroy', 'death', 'unitDeath', 'strikeMark', 'boss', 'move', 'ping', 'build', 'repair', 'upgrade']);
function lifeOf(e) {
  switch (e.type) {
    case 'shot':
      return e.kind === 'mortar' ? 0.85 : e.kind === 'arc' ? 0.17 : 0.16;
    case 'strikeMark':
      return 1.7;
    case 'ping':
      return 3;
    case 'move':
      return 0.8;
    case 'death':
    case 'unitDeath':
      return 0.35;
    case 'boss':
      return 2.4;
    default:
      return 1;
  }
}

function processEvents(t) {
  const evs = state.events;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i];
    if (e.id <= eventCursor) continue;
    eventCursor = e.id;
    e.start = t;
    e.life = lifeOf(e);
    if (FX_TYPES.has(e.type) && (e.type !== 'enemyShot' || e.kind === 'siege' || e.kind === 'juggernaut')) fx.push(e);
    onEvent(e, t);
  }
  let n = 0;
  for (let i = 0; i < fx.length; i++) if (t - fx[i].start < fx[i].life) fx[n++] = fx[i];
  fx.length = n;
  if (n > 500) fx.splice(0, n - 500);
  if (bannerUntil && t > bannerUntil) {
    bannerUntil = 0;
    hide('waveBanner');
  }
  if ((state.phase === 'won' || state.phase === 'lost') && !endShown) showEnd();
}

/* ------------------------------------------------------------------ HUD */

const buildButtons = [];
const liveIds = new Set();
let actionShape = '';

function renderSelection() {
  if (sel.size) {
    liveIds.clear();
    for (const b of state.buildings) liveIds.add(b.id);
    for (const u of state.units) liveIds.add(u.id);
    for (const e of state.enemies) liveIds.add(e.id);
    for (const id of sel) if (!liveIds.has(id)) sel.delete(id);
  }
  let b = null, enemy = null, hpSum = 0;
  const units = [];
  if (sel.size) {
    b = selectedBuilding();
    for (const u of state.units) {
      if (!sel.has(u.id)) continue;
      units.push(u);
      hpSum += u.hp;
    }
    for (const e of state.enemies) {
      if (sel.has(e.id)) {
        enemy = e;
        break;
      }
    }
  }
  const src = input.source, key = (k) => (src === 'keyboard' ? ` · ${k}` : '');
  const armed = !!(b && armedSell && armedSell.id === b.id && armedSell.until > now);
  let sig;
  if (b) sig = `b${b.id}:${b.level}:${Math.floor(b.hp)}:${Math.floor(b.progress * 100)}:${b.queue}:${Math.floor(b.train)}`;
  else if (units.length) sig = `u${units.length}:${units[0].id}:${units[units.length - 1].id}:${Math.floor(hpSum)}:${units.every((u) => u.owner === pid)}`;
  else if (enemy) sig = `e${enemy.id}:${Math.floor(enemy.hp)}`;
  else sig = 'none';
  sig += `|${src}|${armed}`;
  if (sig === selectionSig) return;
  selectionSig = sig;

  const actions = [];
  if (b) {
    const d = TYPES[b.type];
    setText(E.selectionTag, b.progress < 1 ? `CONSTRUCTION · ${Math.round(b.progress * 100)}%` : `STRUCTURE · LEVEL ${b.level}`);
    setText(E.selectionName, d.name);
    setHTML(E.selectionIcon, svg(b.type));
    setText(
      E.selectionDesc,
      b.type === 'core' ? 'The enemy objective. Do not let it fall.' : b.type === 'barracks' && b.queue ? `${b.queue} squad${b.queue > 1 ? 's' : ''} queued · ${Math.ceil(10 - b.train)}s` : DESC[b.type] || 'Holds the base perimeter.'
    );
    setHTML(E.selectionStats, `<span>${fmt(b.hp)} / ${fmt(b.maxHp)} HP</span>${d.range ? `<span>${d.range + (b.level - 1) * 4} m</span>` : ''}`);
    if (b.progress >= 1) {
      if (b.type === 'barracks') actions.push(['train', `TRAIN 180${key('T')}`]);
      if (b.type !== 'core' && b.level < 3) actions.push(['upgrade', `UP ${sim.upgradeCost(b)}${key('U')}`]);
      if (b.hp < b.maxHp - 1) actions.push(['repair', `FIX ${sim.repairCost(b)}${key('H')}`]);
      if (b.type !== 'core' && b.owner === pid) actions.push(['sell', armed ? `CONFIRM +${sim.refund(b)}` : 'REMOVE']);
    }
  } else if (units.length) {
    const own = units.every((u) => u.owner === pid);
    setText(E.selectionTag, own ? 'YOUR SQUAD' : 'ALLIED SQUAD');
    setText(E.selectionName, `${units.length} troop${units.length === 1 ? '' : 's'} selected`);
    setHTML(E.selectionIcon, svg('troops'));
    setText(
      E.selectionDesc,
      !own
        ? 'These troops belong to an allied guard squad.'
        : src === 'gamepad'
          ? 'A on the ground to move, on an enemy to attack. X attacks while moving.'
          : src === 'touch'
            ? 'Tap the ground to move, or an enemy to attack.'
            : 'Right click to move. Shift + right click to attack while moving.'
    );
    setHTML(E.selectionStats, `<span>${fmt(hpSum)} HP</span><span>21 m range</span>`);
    if (own) actions.push(['hold', 'HOLD POSITION']);
    actions.push(['clear', 'CLEAR']);
  } else if (enemy) {
    const d = ENEMIES[enemy.type];
    setText(E.selectionTag, d.boss ? 'HOSTILE · ASSAULT WALKER' : 'HOSTILE');
    setText(E.selectionName, d.name);
    setHTML(E.selectionIcon, svg(enemy.type === 'siege' || enemy.type === 'juggernaut' ? 'mortar' : 'troops'));
    setText(E.selectionDesc, d.text || 'Enemy objective: destroy the command core.');
    setHTML(E.selectionStats, `<span>${fmt(enemy.hp)} / ${fmt(enemy.maxHp)} HP</span>`);
    actions.push(['clear', 'CLEAR']);
  } else {
    setText(E.selectionTag, 'COMMAND');
    setText(E.selectionName, 'Choose your troops');
    setHTML(E.selectionIcon, svg('troops'));
    setText(E.selectionDesc, src === 'gamepad' ? 'Press A on a soldier, or Y for all troops.' : src === 'touch' ? 'Tap a soldier or a structure.' : 'Drag to select. Right click to move.');
    setHTML(E.selectionStats, '');
    actions.push(['select', `SELECT TROOPS${src === 'gamepad' ? ' · Y' : key('TAB')}`]);
  }
  // Same buttons as before: relabel them in place, so a click that is under way is not lost
  // to a rebuilt button (a structure under construction or under fire changes every tick).
  const shape = actions.map((a) => a[0]).join(',') + armed;
  const btns = E.selectionActions.children;
  if (shape === actionShape && btns.length === actions.length) {
    for (let i = 0; i < actions.length; i++) setText(btns[i], actions[i][1]);
    return;
  }
  actionShape = shape;
  E.selectionActions.innerHTML = actions.map(([type, text]) => `<button data-action="${type}"${type === 'sell' && armed ? ' class="armed"' : ''}>${esc(text)}</button>`).join('');
}

function updateHUD() {
  if (mode !== 'play') return;
  const s = state, src = input.source;
  setText(E.metal, fmt(s.metal));
  setText(E.income, `+${s.income % 1 ? s.income.toFixed(1) : s.income}/s`);
  setText(E.power, `${s.used} / ${s.power}`);
  E.power.classList.toggle('bad', !s.powered);
  setText(E.population, `${s.units.length} / 100`);
  setText(E.sessionMode, `${s.map.title} · ${s.difficulty.toUpperCase()}`);
  setText(E.speedBtn, `${speed}×`);

  const isBuild = s.phase === 'build', wave = isBuild ? s.wave + 1 : s.wave;
  setText(E.phaseLabel, isBuild ? 'BUILD PHASE' : s.phase === 'won' ? 'VICTORY' : s.phase === 'lost' ? 'DEFENSE LOST' : 'ENEMY ASSAULT');
  const secs = Math.max(0, Math.ceil(s.timer)), remaining = s.enemies.length + s.queue.length;
  setText(E.phaseTime, isBuild ? `${two(secs / 60)}:${two(secs % 60)}` : two(remaining));
  setText(E.waveNumber, two(wave));
  setText(E.waveTotal, s.endless ? 'ENDLESS' : `OF ${WAVES_TO_WIN}`);
  setWidth(E.phaseProgress, isBuild ? (s.timer / (s.wave === 0 ? 100 : 50)) * 100 : (remaining / Math.max(1, s.waveSize || remaining)) * 100);
  E.phaseProgress.classList.toggle('combat', !isBuild);
  setText(
    E.phaseDetail,
    isBuild ? `Next: ${lanesForWave(wave).map((i) => s.map.lanes[i].name).join(' + ')}${isBossWave(wave) ? ' · JUGGERNAUT' : ''}` : `Hostiles remain. ${s.queue.length} still inbound.`
  );
  E.waveBtn.disabled = !isBuild || endShown;

  let core = null;
  for (const b of s.buildings) {
    if (b.type === 'core') {
      core = b;
      break;
    }
  }
  const hp = core ? core.hp / core.maxHp : 0;
  setText(E.corePercent, `${Math.max(0, Math.ceil(hp * 100))}%`);
  setText(E.coreHealth, `${fmt(core?.hp || 0)} / ${fmt(core?.maxHp || TYPES.core.hp)}`);
  setWidth(E.coreBar, hp * 100);
  E.coreBar.classList.toggle('low', hp < 0.3);
  if (core) {
    if (lastCoreHp !== null && core.hp < lastCoreHp - 0.5 && now - lastAlarm > 8) {
      lastAlarm = now;
      audio.play('alarm');
      toast('The command core is under attack!', true);
      input.rumble(0.5, 220);
    }
    lastCoreHp = core.hp;
  }

  E.task1.classList.toggle('done', s.tutorial.mines > 0);
  E.task2.classList.toggle('done', s.tutorial.built >= 2);
  E.task3.classList.toggle('done', s.wave > 1 || (s.wave === 1 && isBuild));
  setText(E.coordinates, `SECTOR ${two((aim.world.x + 192) / 4)} : ${two((aim.world.z + 192) / 4)}`);

  const counts = [0, 0, 0, 0];
  for (const u of s.units) counts[u.owner & 3]++;
  let tsig = `${pid}`;
  for (const p of s.players) tsig += `|${p.active ? 1 : 0}${p.name}${counts[p.id & 3]}`;
  if (tsig !== teamSig) {
    teamSig = tsig;
    E.teamList.innerHTML = s.players
      .map((p) => `<div class="team-row"><div class="team-badge" style="color:${TEAM[p.id & 3]}">${p.id + 1}</div><div class="team-name">${p.id === pid ? 'You' : esc(p.name)}<small>${p.active ? 'COMMANDER' : 'AI GUARD SQUAD'}</small></div><span class="team-count">${counts[p.id & 3]} <small>▥</small></span></div>`)
      .join('');
    setText(E.teamCount, `${s.players.filter((p) => p.active).length} / 4`);
  }

  for (const b of buildButtons) b.classList.toggle('unaffordable', s.metal < TYPES[b.dataset.type].cost);
  setText(E.dockTip, s.powered ? 'Build an extractor on amber ore to increase income.' : 'LOW POWER. Build a generator to restore full output.');
  E.dockTip.classList.toggle('bad', !s.powered);
  setText(E.buildStatus, buildType ? `PLACING · ${TYPES[buildType].name.toUpperCase()}` : strikeAim ? 'AIMING SUPPORT STRIKE' : 'SELECT A STRUCTURE');
  const ability = s.players[pid]?.ability || 0;
  setText(E.strikeStatus, ability > 0 ? `${Math.ceil(ability)}s` : `READY${src === 'keyboard' ? ' · F' : src === 'gamepad' ? ' · ▲' : ''}`);
  E.strikeBtn.disabled = ability > 0 || endShown;
  setText(E.fps, `${window.__kit?.fps || 0} FPS`);

  let boss = null;
  for (const e of s.enemies) {
    if (ENEMIES[e.type].boss) {
      boss = e;
      break;
    }
  }
  if (boss && !endShown) {
    show('bossBar');
    const f = Math.max(0, boss.hp / boss.maxHp);
    setWidth(E.bossFill, f * 100);
    setText(E.bossHp, `${Math.ceil(f * 100)}%`);
  } else hide('bossBar');

  renderSelection();
}

/* ------------------------------------------------------------------ minimap and labels (Canvas 2D overlays) */

const mctx = minimap.getContext('2d');
const frustum = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];
function drawMinimap() {
  if (mode !== 'play' || !view.miniBg) return;
  const ctx = mctx, sz = 400, k = sz / 384, m = view.map, s = state;
  ctx.clearRect(0, 0, sz, sz);
  ctx.drawImage(view.miniBg, 0, 0, sz, sz);
  const dot = (x, z, r, c) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc((x + 192) * k, (z + 192) * k, r, 0, 6.28);
    ctx.fill();
  };
  for (const d of m.deposits) dot(d.x, d.z, 3, '#e3b257');
  // The approaches the current or next wave will use.
  ctx.strokeStyle = '#f18363';
  ctx.lineWidth = 2;
  for (const i of lanesForWave(s.phase === 'build' ? s.wave + 1 : s.wave)) {
    const l = m.lanes[i];
    if (!l) continue;
    ctx.beginPath();
    ctx.arc((l.x + 192) * k, (l.z + 192) * k, 9, 0, 6.28);
    ctx.stroke();
  }
  for (const b of s.buildings) {
    const q = bounds(b);
    ctx.fillStyle = b.type === 'core' ? '#d9eccc' : b.type === 'wall' || b.type === 'gate' ? '#9da58d' : '#7fc7ac';
    ctx.fillRect((b.x - q.w + 192) * k, (b.z - q.d + 192) * k, q.w * 2 * k, q.d * 2 * k);
  }
  for (const e of s.enemies) {
    const d = ENEMIES[e.type];
    dot(e.x, e.z, d.boss ? 5 : e.type === 'brute' || e.type === 'siege' ? 3 : 2, d.boss ? '#ff5a3a' : '#f18363');
  }
  for (const u of s.units) dot(u.x, u.z, 2.3, TEAM[u.owner & 3]);
  const W = kit.size.width, H = kit.size.height;
  view.ground(0, 0, frustum[0]);
  view.ground(W, 0, frustum[1]);
  view.ground(W, H, frustum[2]);
  view.ground(0, H, frustum[3]);
  ctx.strokeStyle = '#f3ebbe';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  frustum.forEach((p, i) => (i ? ctx.lineTo((p.x + 192) * k, (p.z + 192) * k) : ctx.moveTo((p.x + 192) * k, (p.z + 192) * k)));
  ctx.closePath();
  ctx.stroke();
  ctx.strokeStyle = '#e6b66c';
  for (const e of fx) {
    if (e.type === 'ping' || e.type === 'strikeMark' || e.type === 'boss') {
      ctx.beginPath();
      ctx.arc((e.x + 192) * k, (e.z + 192) * k, 8, 0, 6.28);
      ctx.stroke();
    }
  }
}

const overlay = $('overlay');
const octx = overlay.getContext('2d');
let odpr = 1;
let boundsDirty = true;
const LB = { top: 82, bottom: 0, left: 240, right: 0, dockTop: 0 };
kit.onResize((w, h) => {
  odpr = Math.min(devicePixelRatio || 1, 1.5);
  overlay.width = Math.floor(w * odpr);
  overlay.height = Math.floor(h * odpr);
  boundsDirty = true;
});
/** Where the HUD panels sit, so labels stay off them (measured on resize, not every frame). */
function measureBounds() {
  boundsDirty = false;
  const W = kit.size.width, H = kit.size.height;
  const rect = (sel2) => document.querySelector(sel2)?.getBoundingClientRect();
  const tb = rect('.topbar'), strip = rect('#controlStrip'), mini = rect('#minimapPanel'), sp = rect('#selectionPanel'), dock = rect('#buildDock');
  LB.top = tb && tb.height ? tb.bottom + 2 : 8;
  LB.bottom = strip && strip.height ? strip.top - 2 : H - 8;
  LB.left = mini && mini.width ? mini.right : 0;
  LB.right = sp && sp.width ? sp.left : W;
  LB.dockTop = dock && dock.height ? dock.top : H;
}

function drawLabels() {
  const ctx = octx, W = kit.size.width, Hs = kit.size.height;
  ctx.setTransform(odpr, 0, 0, odpr, 0, 0);
  ctx.clearRect(0, 0, W, Hs);
  if (mode !== 'play') return;
  if (boundsDirty) measureBounds();
  const H = view.map.height, scale = clamp(164 / cam.zoom, 0.45, 1.7);
  ctx.font = '9px Arial';
  ctx.textAlign = 'center';
  const bar = (x, y, w, hp, co) => {
    if (x < 0 || y < LB.top || x > W || y > LB.bottom) return false;
    ctx.fillStyle = '#142920dd';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = co;
    ctx.fillRect(x - w / 2, y, w * clamp(hp, 0, 1), 3);
    return true;
  };
  for (const b of state.buildings) {
    if (!(b.hp < b.maxHp * 0.995 || b.progress < 1 || sel.has(b.id) || b.type === 'core')) continue;
    const p = view.project(b.x, H(b.x, b.z) + (b.type === 'core' ? 14 : 7), b.z, projOut);
    const f = b.hp / b.maxHp;
    if (bar(p.x, p.y, Math.max(20, 36 * scale), b.progress < 1 ? b.progress : f, b.progress < 1 ? '#e8b66a' : f < 0.3 ? '#e78564' : '#83d2b0') && b.type === 'core') {
      ctx.fillStyle = '#f0edd2';
      ctx.font = 'bold 8px Arial';
      ctx.fillText('COMMAND CORE', p.x, p.y - 9);
      ctx.font = '9px Arial';
    }
  }
  for (const u of state.units) {
    if (!sel.has(u.id) && u.hp >= u.maxHp * 0.95) continue;
    const p = view.project(u.x, H(u.x, u.z) + 3.8, u.z, projOut);
    bar(p.x, p.y, 18 * scale, u.hp / u.maxHp, TEAM[u.owner & 3]);
  }
  for (const e of state.enemies) {
    const boss = ENEMIES[e.type].boss;
    if (!boss && e.hp >= e.maxHp * 0.96 && !sel.has(e.id)) continue;
    const p = view.project(e.x, H(e.x, e.z) + (boss ? 9 : 5), e.z, projOut);
    if (bar(p.x, p.y, (boss ? 56 : 22) * scale, e.hp / e.maxHp, boss ? '#ff6a45' : '#e57a60') && boss) {
      ctx.fillStyle = '#ffc2ad';
      ctx.font = 'bold 8px Arial';
      ctx.fillText('JUGGERNAUT', p.x, p.y - 5);
      ctx.font = '9px Arial';
    }
  }
  if (cam.zoom < 240) {
    ctx.font = '8px Arial';
    ctx.fillStyle = '#ecce87';
    for (const d of view.map.deposits) {
      let mined = false;
      for (const b of state.buildings) {
        if (b.type === 'mine' && Math.hypot(d.x - b.x, d.z - b.z) < 8) {
          mined = true;
          break;
        }
      }
      if (mined) continue;
      const p = view.project(d.x, H(d.x, d.z) + 4, d.z, projOut);
      if (p.x > LB.left && p.x < LB.right && p.y > LB.top + 40 && p.y < LB.dockTop - 10) ctx.fillText('⬡ AMBER DEPOSIT', p.x, p.y);
    }
  }
}

/* ------------------------------------------------------------------ input source: prompts follow the device */

function updateSourceUI(src) {
  const root = document.documentElement;
  root.classList.toggle('src-touch', src === 'touch');
  root.classList.toggle('src-gamepad', src === 'gamepad');
  root.classList.toggle('src-keyboard', src !== 'touch' && src !== 'gamepad');
  $('controlHints').innerHTML = HINTS[src] || HINTS.keyboard;
  setText($('menuControls'), MENU_HINT[src] || MENU_HINT.keyboard);
  setText(E.dockKeyTip, DOCK_TIP[src] || DOCK_TIP.keyboard);
  selectionSig = '';
  hintSig = '';
  boundsDirty = true;
  if (src !== 'touch') touchAim.on = false;
  else if (buildType || strikeAim) centreTouchAim();
  if (src !== 'keyboard') canvas.style.cursor = '';
  else if (buildType || strikeAim) canvas.style.cursor = 'crosshair';
}

/* ------------------------------------------------------------------ wiring the DOM */

function buildUI() {
  makeBuildButtons();
  // Main menu.
  for (const b of document.querySelectorAll('#operation button')) b.addEventListener('click', () => selectMap(b.dataset.map));
  for (const b of document.querySelectorAll('#difficulty button')) {
    b.addEventListener('click', () => {
      difficulty = b.dataset.difficulty;
      prefs.difficulty = difficulty;
      savePrefs();
      refreshMenu();
      audio.play('ui', 0.7);
    });
  }
  $('endless').addEventListener('change', () => {
    prefs.endless = $('endless').checked;
    savePrefs();
    refreshMenu();
  });
  $('solo').addEventListener('click', () => newSolo({ map: mapId, difficulty, endless: prefs.endless }));
  $('continue').addEventListener('click', () => {
    const raw = store.get(SAVE_KEY);
    if (raw) loadFrom(raw, 'Saved defense loaded.');
  });
  $('menuHelp').addEventListener('click', openHelp);
  $('menuGraphics').addEventListener('click', () => kit.menu.open());

  // HUD.
  $('helpBtn').addEventListener('click', openHelp);
  $('pauseBtn').addEventListener('click', openPause);
  E.speedBtn.addEventListener('click', toggleSpeed);
  E.soundBtn.addEventListener('click', () => {
    audio.unlock();
    audio.setMuted(!audio.muted);
    refreshSoundBtn();
  });
  E.waveBtn.addEventListener('click', () => {
    const bonus = Math.floor(sim.timer * 2);
    if (send({ type: 'wave' }).ok) toast(`+${fmt(bonus)} metal. Here they come.`);
  });
  E.strikeBtn.addEventListener('click', aimStrike);
  $('overviewBtn').addEventListener('click', overview);
  $('rotLeftBtn').addEventListener('click', () => (cam.tyaw -= Math.PI / 8));
  $('rotRightBtn').addEventListener('click', () => (cam.tyaw += Math.PI / 8));
  $('hintRotate').addEventListener('click', rotateBuild);
  $('hintCancel').addEventListener('click', cancelBuild);
  $('hintPlace').addEventListener('click', () => {
    if (buildType || strikeAim) place(false);
  });
  E.selectionActions.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'select') selectAllTroops();
    else if (a === 'hold') {
      if (send({ type: 'hold', ids: ownSelected() }).ok) audio.play('ui', 0.6);
    } else if (a === 'clear') choose([]);
    else if (a === 'sell') {
      const b = selectedBuilding();
      if (!b) return;
      if (armedSell && armedSell.id === b.id && armedSell.until > now) {
        armedSell = null;
        buildingAction('sell');
      } else armedSell = { id: b.id, until: now + 3 };
    } else buildingAction(a);
    selectionSig = '';
    updateHUD();
  });

  // The minimap: click or drag to move the camera.
  let miniDrag = false;
  minimap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    miniDrag = true;
    try {
      minimap.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
    miniJump(e.clientX, e.clientY);
  });
  minimap.addEventListener('pointermove', (e) => {
    if (miniDrag) miniJump(e.clientX, e.clientY);
  });
  const endMini = () => (miniDrag = false);
  minimap.addEventListener('pointerup', endMini);
  minimap.addEventListener('pointercancel', endMini);

  // Help, pause and results.
  for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => (b.dataset.close === 'pauseModal' ? resume() : closeHelp()));
  $('resumeBtn').addEventListener('click', resume);
  $('saveBtn').addEventListener('click', () => saveGame(false));
  $('pauseHelpBtn').addEventListener('click', openHelp);
  $('graphicsBtn').addEventListener('click', () => kit.menu.open());
  $('restartBtn').addEventListener('click', () => {
    if (restartArmed > performance.now()) {
      restartArmed = 0;
      newSolo(currentSetup());
      return;
    }
    restartArmed = performance.now() + 3000;
    setText($('restartBtn'), 'PRESS AGAIN TO START OVER');
    setTimeout(() => {
      if (restartArmed && restartArmed <= performance.now() + 20) {
        restartArmed = 0;
        setText($('restartBtn'), 'NEW SOLO DEFENSE');
      }
    }, 3050);
  });
  $('exitBtn').addEventListener('click', toMenu);
  $('endRetry').addEventListener('click', () => {
    if (checkpoint) loadFrom(checkpoint, `Back to the build phase before wave ${checkpointWave + 1}.`);
  });
  $('endRestart').addEventListener('click', () => newSolo(currentSetup()));
  $('endMenu').addEventListener('click', toMenu);
}

function makeBuildButtons() {
  $('buildButtons').innerHTML = BUILD_ORDER.map(
    (type, i) => `<button class="build-button" data-type="${type}" aria-label="Build ${TYPES[type].name}"><span class="hotkey">${i + 1}</span>${svg(type)}<span class="b-name">${SHORT[type] || TYPES[type].name}</span><span class="b-cost">⬡ ${TYPES[type].cost}</span></button>`
  ).join('');
  for (const b of document.querySelectorAll('.build-button')) {
    buildButtons.push(b);
    b.addEventListener('click', () => setBuild(b.dataset.type));
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') showTip(b);
    });
    b.addEventListener('pointerleave', hideTip);
  }
}

/* ------------------------------------------------------------------ the frame */

function stepSim(dt) {
  sim.paused = modalOpen() || endShown;
  if (sim.paused) return;
  accumulator += dt * speed;
  let steps = 0;
  while (accumulator >= 0.05 && steps < 5) {
    sim.update(0.05);
    accumulator -= 0.05;
    steps++;
  }
  if (steps >= 5) accumulator = Math.min(accumulator, 0.05);
  if (performance.now() - lastSave > 20000) {
    saveGame(true);
    lastSave = performance.now();
  }
}

function frame(dt, t) {
  now = t;
  handleInput(dt);
  if (mode === 'play') stepSim(dt);
  updateCam(dt);
  view.setCamera(cam, dt);
  updateAim();
  if (mode === 'play') processEvents(t);
  const p = mode === 'play' && buildType ? placement() : null;
  if (mode === 'play' && (buildType || strikeAim)) updateBuildHint(p);
  let pushed = false;
  if (mode === 'play' && strikeAim && aim.over) {
    strikeFx.x = aim.world.x;
    strikeFx.z = aim.world.z;
    strikeFx.start = t;
    fx.push(strikeFx);
    pushed = true;
  }
  view.update(state, t, sel, p && aim.over ? p : null, fx);
  if (pushed) fx.pop();
  view.render();
  drawLabels();
  hudTimer += dt;
  miniTimer += dt;
  if (hudTimer > 0.18) {
    hudTimer = 0;
    updateHUD();
  }
  if (miniTimer > 0.14) {
    miniTimer = 0;
    drawMinimap();
  }
  pad.endFrame();
}

/* ------------------------------------------------------------------ start */

buildUI();
refreshSoundBtn();
refreshMenu();
checkSave();
updateSourceUI(input.source);
input.onSourceChange(updateSourceUI);
kit.onPause((p) => {
  audio.hold(p);
  pad.hide(p);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play' && !endShown) {
    if (!modalOpen()) openPause();
    saveGame(true);
  }
});
addEventListener('pagehide', () => saveGame(true));
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 1) e.preventDefault(); // no autoscroll on a middle-button pan
});

view.setMap(MAPS[mapId]);
view.setCamera(cam, 0);
kit.loading.progress(0.88, 'Compiling shaders…');
await view.warm();
show('menu');

window.IRONHOLD = {
  get state() {
    return state;
  },
  get sim() {
    return sim;
  },
  get mode() {
    return mode;
  },
  get camera() {
    return cam;
  },
  get player() {
    return pid;
  },
  get selected() {
    return [...sel];
  },
  start: (o = {}) => newSolo({ map: o.map || mapId, difficulty: o.difficulty || difficulty, endless: o.endless ?? prefs.endless }),
  command: (c) => send(c),
  project: (x, y, z) => view.project(x, y, z, { x: 0, y: 0 }),
  ground: (sx, sy) => view.ground(sx, sy, { x: 0, z: 0 }),
  select: (ids) => choose(ids),
  save: saveGame,
  load: () => {
    const raw = store.get(SAVE_KEY);
    return raw ? loadFrom(raw, 'Saved defense loaded.') : false;
  },
  selectMap,
  toMenu,
};

kit.start(frame);
