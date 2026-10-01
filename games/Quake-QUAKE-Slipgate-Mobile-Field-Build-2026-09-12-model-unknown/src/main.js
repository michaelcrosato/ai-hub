// QUAKE / Slipgate — the page shell. Boots the shared 3D kit, runs the title screen and the arena
// picker, the pause / results / settings / engine-room panels and the HUD, reads every control
// through kit.input actions, and steps the game at a fixed 120 Hz.
import { boot } from 'kit/boot.js';
import { World, LEVELS, makeModels } from './world.js';
import { Game, WEAPONS, DIFFICULTY } from './game.js';
import { GameAudio } from './audio.js';
import { View } from './view.js';
import { Metrics, summarize } from './metrics.js';
import { Pak } from './pak.js';
import { BSPWorld } from './bsp.js';
import { clamp } from './math.js';

const $ = (id) => document.getElementById(id);
const show = (id, value = true) => $(id).classList.toggle('hidden', !value);
const STEP = 1 / 120;
const MAX_STEPS = 12;
const SETTINGS_KEY = 'slipgate-settings';
const BEST_KEY = 'slipgate-best';
const PANELS = ['settingsPanel', 'performancePanel', 'helpPanel', 'pakPanel'];
const pad2 = (n) => String(n).padStart(2, '0');

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

function loadConfig() {
  const c = { fov: 78, difficulty: 'normal', aimAssist: true, volume: 0.8, sound: true, retro: 0, level: LEVELS[0].id };
  const raw = store.get(SETTINGS_KEY);
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fov = Number(raw.fov);
    if (fov >= 65 && fov <= 105) c.fov = fov;
    if (DIFFICULTY[raw.difficulty]) c.difficulty = raw.difficulty;
    if (typeof raw.aimAssist === 'boolean') c.aimAssist = raw.aimAssist;
    if (raw.volume !== null && raw.volume !== undefined && Number.isFinite(Number(raw.volume))) c.volume = clamp(Number(raw.volume), 0, 1);
    if (typeof raw.sound === 'boolean') c.sound = raw.sound;
    if ([0, 360, 480].includes(Number(raw.retro))) c.retro = Number(raw.retro);
    if (LEVELS.some((l) => l.id === raw.level)) c.level = raw.level;
  }
  return c;
}
const config = loadConfig();
const saveConfig = () => store.set(SETTINGS_KEY, config);

/**
 * Every control is an action. The first touch button is the big one; Fire leads, as in the
 * original's thumb layout. Menus use nav / confirm / back (D-pad and A / B on a gamepad).
 */
const ACTIONS = {
  fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  dash: { keys: ['KeyQ', 'KeyK'], mouse: [2], gamepad: ['B', 'LT'], touch: 'Dash' },
  swap: { gamepad: ['RB', 'Y'], touch: 'Swap' },
  prevWeapon: { gamepad: ['LB'] },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  weapon1: { keys: ['Digit1', 'Numpad1'] },
  weapon2: { keys: ['Digit2', 'Numpad2'] },
  weapon3: { keys: ['Digit3', 'Numpad3'] },
  fly: { keys: ['KeyN'], gamepad: ['Back'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};

const HINTS = {
  keyboard: [['W A S D', 'MOVE'], ['SPACE', 'JUMP'], ['SHIFT', 'RUN'], ['Q', 'DASH'], ['1–3', 'WEAPON'], ['ESC', 'PAUSE']],
  gamepad: [['LS', 'MOVE'], ['RS', 'AIM'], ['RT', 'FIRE'], ['A', 'JUMP'], ['B', 'DASH'], ['LB RB', 'WEAPON'], ['START', 'PAUSE']],
};

const kit = await boot({
  title: 'QUAKE / Slipgate',
  gear: 'none', // the game's settings panel opens the kit's panel; F9 works too
  touch: { top: 'center', topOffset: 16 },
  accent: '#f19359',
  background: '#12191c',
  input: ACTIONS,
});
const input = kit.input;
kit.canvas.setAttribute('aria-label', 'First-person game view');
kit.loading.progress(0.7, 'Building the vault…');

const audio = new GameAudio();
audio.volume = config.volume;
audio.enabled = config.sound;
const metrics = new Metrics();
const models = makeModels();
const view = new View(kit, models);

let levelIndex = Math.max(0, LEVELS.findIndex((l) => l.id === config.level));
let world = new World(LEVELS[levelIndex]);
let game = null;
let mode = 'menu';
let ready = false;
let accumulator = 0;
let menuElapsed = 0;
let pausedAt = 0;
let hadLock = false;
let toastTimer = 0;
let activePak = null;
let wheelAcc = 0;
let wheelIdle = 0;
let lastHud = 0;
let lastFps = 0;
let dashCooling = false;
const blocked = new Set();
const frameInput = { strafe: 0, forward: 0, fire: false, jump: false, dash: false, sprint: false, aimAssist: false };
const navState = { key: '', t: 0 };
const benchCam = { pos: [0, 0, 0], yaw: 0, pitch: 0.045, roll: 0, fov: 78 };
const textCache = new Map();
const hud = {
  health: $('health'),
  armor: $('armor'),
  ammo: $('ammo'),
  ammoType: $('ammoType'),
  weaponName: $('weaponName'),
  kills: $('killCount'),
  time: $('runTime'),
  secrets: $('secretCount'),
  waveText: $('waveText'),
  waveTotal: $('waveTotal'),
  waveProgress: $('waveProgress'),
  objective: $('objective'),
  mission: $('missionLabel'),
  hit: $('hitmarker'),
  damage: $('damageOverlay'),
  slots: [...document.querySelectorAll('[data-weapon]')],
  fps: $('fps'),
};

/* ------------------------------------------------------------------ small helpers */

function notify(text) {
  $('toast').textContent = text;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2600);
}

function setText(el, text) {
  if (textCache.get(el) === text) return;
  textCache.set(el, text);
  el.textContent = text;
}

function setStyle(el, prop, value) {
  const key = `${prop}`;
  const cache = el._styleCache || (el._styleCache = {});
  if (cache[key] === value) return;
  cache[key] = value;
  el.style[prop] = value;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad2(m)}:${pad2(s)}`;
}

function makeGame(w) {
  const g = new Game(w, audio, notify);
  g.difficulty = config.difficulty;
  g.onEnd = end;
  g.onRumble = (strength, ms) => input.rumble(strength, ms);
  return g;
}

/** Fire, jump and dash stay off until released after a menu: the A that started the run does not jump. */
function holdUntilReleased() {
  for (const name of ['fire', 'jump', 'dash']) blocked.add(name);
  input.settle();
}

function held(name) {
  if (blocked.has(name)) {
    if (input.down(name)) return false;
    blocked.delete(name);
  }
  return input.down(name);
}

function lockMouse() {
  if (input.source === 'keyboard') input.lockPointer();
}

/* ------------------------------------------------------------------ best runs */

function bests() {
  const raw = store.get(BEST_KEY);
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** The fastest clear of an arena at any difficulty: { time, difficulty } or null. */
function bestFor(id) {
  const level = bests()[id];
  let best = null;
  if (level && typeof level === 'object') {
    for (const [difficulty, entry] of Object.entries(level)) {
      if (DIFFICULTY[difficulty] && entry && Number.isFinite(entry.time) && entry.time > 0 && (!best || entry.time < best.time)) best = { time: entry.time, difficulty };
    }
  }
  return best;
}

function recordRun(id, g, won) {
  const all = bests();
  const level = all[id] && typeof all[id] === 'object' ? all[id] : (all[id] = {});
  const entry = level[g.difficulty] && typeof level[g.difficulty] === 'object' ? level[g.difficulty] : (level[g.difficulty] = {});
  const previous = Number.isFinite(entry.time) ? entry.time : null;
  let isBest = false;
  if (won && (previous === null || g.time < previous)) {
    entry.time = Math.round(g.time * 10) / 10;
    isBest = true;
  }
  entry.kills = Math.max(Number(entry.kills) || 0, g.kills);
  entry.secrets = Math.max(Number(entry.secrets) || 0, g.secrets);
  if (won) entry.clears = (Number(entry.clears) || 0) + 1;
  store.set(BEST_KEY, all);
  return { isBest, previous, time: Number.isFinite(entry.time) ? entry.time : null };
}

/* ------------------------------------------------------------------ screens */

function openPanelId() {
  return PANELS.find((id) => !$(id).classList.contains('hidden')) || null;
}

function setScreen() {
  const playing = mode === 'playing';
  show('flightButton', world.imported && playing);
  show('menu', mode === 'menu');
  show('hud', mode !== 'menu');
  show('pauseButton', playing);
  $('shade').classList.toggle('play', mode !== 'menu');
  document.body.classList.toggle('playing', mode !== 'menu');
  kit.touch?.suspend(!playing, 'game');
  audio.ambience(playing);
}

function closeAll() {
  for (const panel of document.querySelectorAll('.modal-layer')) panel.classList.add('hidden');
}

function start() {
  if (!ready || metrics.benchmark) return;
  closeAll();
  audio.unlock();
  game.difficulty = config.difficulty;
  game.start();
  mode = 'playing';
  accumulator = 0;
  holdUntilReleased();
  metrics.reset();
  setScreen();
  renderHint();
  lockMouse();
  document.activeElement?.blur?.();
}

function pause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  pausedAt = performance.now();
  input.unlockPointer();
  const alive = game.enemies.filter((e) => e.health > 0).length;
  $('pauseSummary').textContent = world.imported
    ? `${world.name} · ${formatTime(game.time)} exploring.`
    : `${world.name} · ${formatTime(game.time)} · ${game.gateOpen ? 'the gate is open' : `wave ${game.wave} of ${world.waves.length}, ${alive} left`}.`;
  show('pausePanel');
  setScreen();
  focusDefault();
}

function resume() {
  if (mode !== 'paused') return;
  closeAll();
  mode = 'playing';
  accumulator = 0;
  holdUntilReleased();
  setScreen();
  audio.unlock();
  lockMouse();
  metrics.last = 0;
}

function toMenu() {
  mode = 'menu';
  if (game) game.active = false;
  input.unlockPointer();
  closeAll();
  setScreen();
  metrics.reset();
  updateLevelCard();
  focusDefault();
}

function end(won) {
  mode = 'ended';
  input.unlockPointer();
  const g = game;
  const accuracy = g.pellets ? Math.round((g.pelletHits / g.pellets) * 100) : 0;
  const last = world.name.split(' ').pop();
  $('endKicker').textContent = won ? 'THE GATE IS YOURS' : world.imported ? 'THE MAP CLAIMED ANOTHER' : `THE ${last} CLAIMED ANOTHER`;
  $('endTitle').textContent = won ? 'YOU MADE IT.' : 'RUN ENDED.';
  $('endSummary').textContent = `${world.name} · ${DIFFICULTY[g.difficulty]?.label || 'NORMAL'}. ${won ? 'The other side can wait.' : 'The next run starts here.'}`;
  const stats = $('endStats');
  stats.replaceChildren();
  const rows = [
    ['TIME', formatTime(g.time)],
    ['KILLS', String(g.kills)],
    ['ACCURACY', `${accuracy}%`],
    ['SECRETS', `${g.secrets} / ${world.secretCount}`],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    stats.append(dt, dd);
  }
  const bestLine = $('endBest');
  bestLine.classList.remove('new');
  bestLine.textContent = '';
  if (!world.imported) {
    const r = recordRun(world.id, g, won);
    if (won && r.isBest) {
      bestLine.textContent = r.previous === null ? `FIRST CLEAR · ${formatTime(r.time)}` : `NEW BEST TIME · ${formatTime(r.time)} (WAS ${formatTime(r.previous)})`;
      bestLine.classList.add('new');
    } else if (r.time !== null) bestLine.textContent = `BEST ON ${DIFFICULTY[g.difficulty]?.label || ''} · ${formatTime(r.time)}`;
  }
  const next = won && !world.imported && levelIndex < LEVELS.length - 1 ? LEVELS[levelIndex + 1] : null;
  show('nextButton', !!next);
  if (next) $('nextLabel').textContent = `CONTINUE TO ${next.name}`;
  $('againButton').className = next ? 'secondary wide' : 'primary';
  show('endPanel');
  setScreen();
  focusDefault();
}

function openPanel(id) {
  if (mode === 'playing') pause();
  show('pausePanel', false);
  show('endPanel', false);
  for (const p of PANELS) show(p, p === id);
  if (id === 'performancePanel') updateDiagnostics();
  if (id === 'settingsPanel') syncSettingsForm();
  focusDefault();
}

function closePanel(id) {
  show(id, false);
  if (mode === 'paused') show('pausePanel');
  if (mode === 'ended') show('endPanel');
  focusDefault();
}

/* ------------------------------------------------------------------ arenas */

function setMeta(text) {
  const el = $('levelMeta');
  el.replaceChildren();
  text.split(' · ').forEach((part, i) => {
    if (i) {
      const b = document.createElement('b');
      b.textContent = '·';
      el.append(' ', b, ' ');
    }
    el.append(part);
  });
}

function updateLevelCard() {
  if (world.imported) {
    $('levelNumber').textContent = 'PAK';
    $('levelCount').textContent = '/ LOCAL';
    $('levelName').textContent = world.name;
    setMeta('LOCAL DATA · MAP EXPLORER');
    $('levelBest').textContent = 'FREE ROAM · NO MONSTERS';
    $('startLabel').textContent = `ENTER ${world.name}`;
    $('assetStatus').textContent = 'Local PAK loaded. Files stay on your device.';
  } else {
    const level = LEVELS[levelIndex];
    $('levelNumber').textContent = pad2(level.number);
    $('levelCount').textContent = `/ ${pad2(LEVELS.length)}`;
    $('levelName').textContent = level.name;
    setMeta(level.meta);
    const best = bestFor(level.id);
    $('levelBest').textContent = best ? `BEST ${formatTime(best.time)} · ${DIFFICULTY[best.difficulty].label}` : 'NOT CLEARED YET';
    $('startLabel').textContent = level.start;
    $('assetStatus').textContent = 'Two original arenas included. No download needed.';
  }
  $('startButton').setAttribute('aria-label', $('startLabel').textContent);
}

function loadWorld(next) {
  world = next;
  game = makeGame(world);
  view.setWorld(world);
  toMenu();
}

function selectLevel(i) {
  if (mode !== 'menu' && mode !== 'ended') return;
  levelIndex = (i + LEVELS.length) % LEVELS.length;
  config.level = LEVELS[levelIndex].id;
  saveConfig();
  loadWorld(new World(LEVELS[levelIndex]));
}

function toggleFlight() {
  if (!world.imported || mode !== 'playing') return;
  game.noclip = !game.noclip;
  notify(game.noclip ? 'FREE FLIGHT · JUMP UP / RUN DOWN' : 'WORLD COLLISION ON');
}

/* ------------------------------------------------------------------ menus: keyboard and gamepad */

function topLayer() {
  const panel = openPanelId();
  if (panel) return $(panel);
  if (!$('pausePanel').classList.contains('hidden')) return $('pausePanel');
  if (!$('endPanel').classList.contains('hidden')) return $('endPanel');
  if (mode === 'menu') return $('menu');
  return null;
}

// The file picker stays a mouse and touch control: a gamepad cannot use the dialog it opens.
function focusables(root) {
  const scope = root.id === 'menu' ? [root, document.querySelector('.topbar')] : [root];
  const list = [];
  for (const el of scope) {
    for (const f of el.querySelectorAll('button, select, input:not([type=file])')) {
      if (!f.disabled && f.offsetParent !== null) list.push(f);
    }
  }
  return list;
}

function defaultButton(root) {
  if (!root) return null;
  if (root.id === 'menu') return $('startButton');
  if (root.id === 'pausePanel') return $('resumeButton');
  if (root.id === 'endPanel') return $('nextButton').classList.contains('hidden') ? $('againButton') : $('nextButton');
  const list = focusables(root);
  return list.find((el) => !el.classList.contains('close-button')) || list[0] || null;
}

function focusDefault() {
  if (input.source !== 'gamepad') return;
  const button = defaultButton(topLayer());
  if (!button || button.disabled) return;
  try {
    button.focus({ preventScroll: true });
  } catch {
    button.focus();
  }
}

function moveFocus(root, dir) {
  const list = focusables(root);
  if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  if (i < 0) {
    const fallback = list.indexOf(defaultButton(root));
    if (fallback >= 0) {
      list[fallback].focus();
      return;
    }
    i = dir > 0 ? -1 : 0;
  }
  const next = list[(i + dir + list.length) % list.length];
  next.focus();
  next.scrollIntoView?.({ block: 'nearest' });
  audio.play('ui');
}

function navStep(root, axis, dir, repeat = false) {
  const el = document.activeElement;
  const inside = el && root.contains(el) && el !== root;
  if (axis === 'x') {
    if (inside && el.type === 'range') {
      const min = Number(el.min) || 0;
      const max = Number(el.max) || 1;
      el.value = String(clamp(Number(el.value) + (dir * (max - min)) / 20, min, max));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (inside && el.tagName === 'SELECT') {
      const index = clamp(el.selectedIndex + dir, 0, el.options.length - 1);
      if (index !== el.selectedIndex) {
        el.selectedIndex = index;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return;
    }
    if (root.id === 'menu') {
      // Left and right on the title screen pick the arena (one per press: each pick rebuilds it).
      if (repeat) return;
      selectLevel(levelIndex + dir);
      audio.play('ui');
      return;
    }
  }
  moveFocus(root, dir);
}

function readNav(dt, step) {
  const v = input.vector('nav');
  let axis = '';
  let dir = 0;
  if (Math.abs(v.y) > 0.5) {
    axis = 'y';
    dir = v.y > 0 ? -1 : 1;
  } else if (Math.abs(v.x) > 0.5) {
    axis = 'x';
    dir = v.x > 0 ? 1 : -1;
  }
  const key = axis + dir;
  if (!dir) navState.key = '';
  else if (key !== navState.key) {
    navState.key = key;
    navState.t = 0.38;
    step(axis, dir, false);
  } else {
    navState.t -= dt;
    if (navState.t <= 0) {
      navState.t = 0.13;
      step(axis, dir, true);
    }
  }
}

function menuNav(dt) {
  if (metrics.benchmark) {
    if (input.pressed('pause') || input.pressed('back')) cancelBenchmark('Render test cancelled.');
    return;
  }
  if (input.pressed('pause')) {
    const panel = openPanelId();
    if (panel) closePanel(panel);
    // Esc that just released the mouse arrives here too: only a later press resumes.
    else if (mode === 'paused' && performance.now() - pausedAt > 300) resume();
    else if (mode === 'menu' && input.source === 'gamepad') start();
    return;
  }
  if (input.pressed('back')) {
    const panel = openPanelId();
    if (panel) closePanel(panel);
    else if (mode === 'paused') resume();
    return;
  }
  const root = topLayer();
  if (!root) return;
  readNav(dt, (axis, dir, repeat) => navStep(root, axis, dir, repeat));
  if (input.pressed('confirm')) {
    const el = document.activeElement;
    if (el && el !== root && (root.contains(el) || (root.id === 'menu' && el.closest('.topbar'))) && (el.matches('button') || el.type === 'checkbox')) el.click();
    else defaultButton(root)?.click();
  }
}

function renderHint() {
  const el = $('controlHint');
  el.replaceChildren();
  const list = HINTS[input.source] || [];
  for (const [key, label] of list) {
    const k = document.createElement('kbd');
    k.textContent = key;
    el.append(k, ` ${label} `);
  }
  if (list.length && world.imported) {
    const k = document.createElement('kbd');
    k.textContent = input.source === 'gamepad' ? 'VIEW' : 'N';
    el.append(k, ' FLY');
  }
  $('levelHint').textContent = input.source === 'gamepad' ? 'D-PAD ◀ ▶ · CHANGE ARENA' : input.source === 'touch' ? 'TAP ‹ › · CHANGE ARENA' : '← → · CHANGE ARENA';
}

/* ------------------------------------------------------------------ the frame */

function playFrame(dt) {
  if (input.pressed('pause')) {
    pause();
    return;
  }
  const p = game.player;
  const look = input.look('look');
  p.yaw -= look.x;
  p.pitch = clamp(p.pitch - look.y, -1.38, 1.38);
  for (let i = 0; i < WEAPONS.length; i++) if (input.pressed(`weapon${i + 1}`)) game.selectWeapon(i);
  if (input.pressed('swap')) game.cycleWeapon(1);
  if (input.pressed('prevWeapon')) game.cycleWeapon(-1);
  if (input.source !== 'touch') {
    // The wheel cycles weapons: down is next, as in the original. Trackpads add up small steps.
    const wheel = input.zoom();
    if (wheel) {
      wheelAcc += wheel;
      wheelIdle = 0.35;
    } else if ((wheelIdle -= dt) <= 0) wheelAcc = 0;
    if (Math.abs(wheelAcc) >= 1) {
      game.cycleWeapon(wheelAcc < 0 ? 1 : -1);
      wheelAcc = 0;
    }
  }
  if (input.pressed('fly')) toggleFlight();
  const mv = input.vector('move');
  const touch = input.source === 'touch';
  frameInput.strafe = mv.x;
  frameInput.forward = mv.y;
  frameInput.fire = held('fire');
  frameInput.jump = held('jump');
  frameInput.dash = held('dash');
  // Touch has no run button: pushing the stick to its edge runs.
  frameInput.sprint = input.down('sprint') || (touch && mv.x * mv.x + mv.y * mv.y > 0.94);
  frameInput.aimAssist = config.aimAssist && (touch || input.source === 'gamepad');
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < MAX_STEPS) {
    game.update(STEP, frameInput);
    accumulator -= STEP;
    steps++;
  }
  if (steps >= MAX_STEPS) accumulator = 0;
}

function benchmarkCamera(now) {
  const t = (now - metrics.benchmark.start) / 1000;
  benchCam.pos[0] = Math.sin(t * 0.35) * 3.4;
  benchCam.pos[1] = 2.2 + Math.sin(t * 0.5) * 0.3;
  benchCam.pos[2] = 21 - t * 2.5;
  benchCam.yaw = Math.sin(t * 0.24) * 0.32;
  if (t >= 20) finishBenchmark();
  return benchCam;
}

function frame(dt, t) {
  const begin = performance.now();
  menuElapsed += dt;
  if (mode === 'playing') playFrame(dt);
  else menuNav(dt);
  const bench = !!metrics.benchmark;
  const menu = mode === 'menu' || bench;
  const cam = bench ? benchmarkCamera(begin) : game.camera(menu, menuElapsed, config.fov);
  view.render(cam, game, { menu, elapsed: menuElapsed, weapon: WEAPONS[game.weapon].id, t, hideWeapon: bench });
  metrics.record(begin, performance.now() - begin);
  hudFrame(begin);
}

/* ------------------------------------------------------------------ HUD */

function hudFrame(now) {
  if (mode !== 'menu') {
    setStyle(hud.hit, 'opacity', game.hitTime > 0 || game.killTime > 0 ? '1' : '0');
    const kill = game.killTime > 0;
    if (hud.hit.classList.contains('kill') !== kill) hud.hit.classList.toggle('kill', kill);
    setStyle(hud.damage, 'opacity', String(Math.min(0.85, Math.round(game.damageTime * 32) / 20)));
  }
  const cooling = mode === 'playing' && game.dashCooldown > 0;
  if (cooling !== dashCooling) {
    dashCooling = cooling;
    kit.touch?.button('dash')?.classList.toggle('is-cooling', cooling);
  }
  if (now - lastHud > 120) {
    lastHud = now;
    updateHud();
  }
  if (now - lastFps > 300) {
    lastFps = now;
    const s = metrics.stats();
    setText(hud.fps, s.fps ? String(Math.round(s.fps)) : '—');
    if (!$('performancePanel').classList.contains('hidden')) updateDiagnostics();
  }
}

function aliveCount() {
  let n = 0;
  for (const e of game.enemies) if (e.health > 0) n++;
  return n;
}

function updateHud() {
  if (mode === 'menu') return;
  const p = game.player;
  setText(hud.health, String(Math.ceil(p.health)));
  const low = p.health < 30;
  if (hud.health.classList.contains('low') !== low) hud.health.classList.toggle('low', low);
  setText(hud.armor, String(Math.ceil(p.armor)));
  const w = WEAPONS[game.weapon];
  const ammo = p.ammo[w.ammo];
  setText(hud.ammo, String(ammo));
  if (hud.ammo.classList.contains('empty') !== ammo <= 0) hud.ammo.classList.toggle('empty', ammo <= 0);
  setText(hud.ammoType, w.ammo.toUpperCase());
  setText(hud.weaponName, w.name);
  setText(hud.kills, `${game.kills} KILL${game.kills === 1 ? '' : 'S'}`);
  setText(hud.time, formatTime(game.time));
  setText(hud.mission, world.name);
  if (world.imported) {
    setText(hud.secrets, 'FREE ROAM');
    setText(hud.waveText, 'MAP EXPLORER');
    setText(hud.waveTotal, '');
    setStyle(hud.waveProgress, 'width', '0%');
    const key = input.source === 'gamepad' ? 'View' : input.source === 'touch' ? 'The ↕ button' : 'N';
    setText(hud.objective, game.noclip ? 'Free flight · jump up / run down' : `Explore · ${key} toggles free flight`);
  } else {
    const total = world.waves.length;
    setText(hud.secrets, `${game.secrets} / ${world.secretCount} SECRET${world.secretCount === 1 ? '' : 'S'}`);
    if (game.gateOpen) {
      setText(hud.waveText, 'GATE OPEN');
      setText(hud.waveTotal, '');
    } else {
      setText(hud.waveText, `WAVE ${pad2(game.wave)}`);
      setText(hud.waveTotal, `/ ${pad2(total)}`);
    }
    setStyle(hud.waveProgress, 'width', `${game.gateOpen ? 100 : Math.round((game.wave / Math.max(1, total)) * 100)}%`);
    const alive = aliveCount();
    setText(hud.objective, game.gateOpen ? 'Move to the blue gate.' : alive ? `${alive} hostile${alive === 1 ? '' : 's'} remain${alive === 1 ? 's' : ''}.` : game.wave ? 'The next wave is coming.' : 'Clear the arena. Reach the gate.');
  }
  for (const b of hud.slots) {
    const i = Number(b.dataset.weapon);
    const sel = i === game.weapon;
    const dry = p.ammo[WEAPONS[i].ammo] <= 0;
    if (b.classList.contains('selected') !== sel) b.classList.toggle('selected', sel);
    if (b.classList.contains('dry') !== dry) b.classList.toggle('dry', dry);
  }
}

/* ------------------------------------------------------------------ engine room */

function diagInfo() {
  const k = window.__kit || {};
  return {
    renderer: kit.backendLabel,
    adapter: k.adapter || null,
    fallback: k.fellBack || null,
    three: `r${kit.THREE.REVISION}`,
    tier: kit.tier.name,
    pixelRatio: kit.renderer.getPixelRatio(),
    resolution: { width: kit.canvas.width, height: kit.canvas.height, devicePixelRatio },
    drawCalls: view.calls,
    triangles: view.triangles,
    pipelines: k.pipelines ?? null,
    kitSettings: kit.settings.get(),
    game: { ...config },
  };
}

function updateDiagnostics() {
  const s = metrics.stats();
  $('diagFPS').textContent = s.fps ? s.fps.toFixed(1) : '—';
  $('diagLow').textContent = s.low ? s.low.toFixed(1) : '—';
  $('diagP95').textContent = s.p95 ? s.p95.toFixed(1) : '—';
  const info = diagInfo();
  const cpu = metrics.cpuMean();
  const cap = kit.settings.get().fpsCap;
  const rows = [
    ['API', `${info.renderer}${info.fallback ? ' · WebGPU unavailable here' : ''}`],
    ['ADAPTER', info.adapter?.vendor || 'Browser did not expose adapter details'],
    ['DEVICE', info.adapter?.architecture || 'Not exposed'],
    ['DRIVER', 'Not exposed by the web API'],
    ['THREE.JS', `${info.three} · shared 3D kit`],
    ['QUALITY', `${info.tier.toUpperCase()} · ${info.pixelRatio.toFixed(2)}× pixels${config.retro ? ` · retro ${config.retro} lines` : ''}`],
    ['BUFFER', `${info.resolution.width} × ${info.resolution.height}`],
    ['TARGET', cap ? `${cap} FPS cap` : 'Display refresh rate'],
    ['GEOMETRY', `${info.drawCalls} draws · ${Math.round(info.triangles).toLocaleString()} triangles · ${info.pipelines ?? '—'} pipelines`],
    ['JS SUBMIT', `${cpu === null ? '—' : cpu.toFixed(2)} ms · not GPU time`],
    ['CONTEXT', window.isSecureContext ? 'Secure' : 'Not secure · WebGPU unavailable'],
  ];
  const dl = $('diagnosticDetails');
  dl.replaceChildren();
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value;
    dl.append(dt, dd);
  }
  metrics.graph($('frameGraph'));
}

function finishBenchmark() {
  const b = metrics.benchmark;
  if (!b) return;
  const r = { ...summarize(b.samples), sampleCount: b.samples.length, durationSeconds: 20, renderer: kit.backendLabel, tier: kit.tier.name, resolution: [kit.canvas.width, kit.canvas.height] };
  metrics.lastBenchmark = r;
  metrics.benchmark = null;
  document.body.classList.remove('benchmarking');
  $('benchmarkStatus').textContent = `Render test: ${r.fps.toFixed(1)} FPS mean; ${r.low.toFixed(1)} FPS 1% low; ${r.p95.toFixed(1)} ms P95. ${r.sampleCount} samples.`;
  openPanel('performancePanel');
}

function cancelBenchmark(message) {
  if (!metrics.benchmark) return;
  metrics.benchmark = null;
  document.body.classList.remove('benchmarking');
  $('benchmarkStatus').textContent = message;
  notify(message.toUpperCase());
}

/* ------------------------------------------------------------------ settings */

function syncSettingsForm() {
  $('fovRange').value = config.fov;
  $('fovValue').textContent = `${config.fov}°`;
  $('difficultySelect').value = config.difficulty;
  $('aimAssist').checked = config.aimAssist;
  $('volumeRange').value = config.volume;
  $('volumeValue').textContent = `${Math.round(config.volume * 100)}%`;
  $('retroSelect').value = String(config.retro);
  $('soundButton').setAttribute('aria-pressed', String(config.sound));
}

/* ------------------------------------------------------------------ wiring */

$('startButton').addEventListener('click', start);
$('resumeButton').addEventListener('click', resume);
$('restartButton').addEventListener('click', start);
$('againButton').addEventListener('click', start);
$('nextButton').addEventListener('click', () => {
  if (levelIndex >= LEVELS.length - 1) return;
  selectLevel(levelIndex + 1);
  start();
});
$('menuButton').addEventListener('click', toMenu);
$('endMenuButton').addEventListener('click', toMenu);
$('pauseSettingsButton').addEventListener('click', () => openPanel('settingsPanel'));
$('levelPrev').addEventListener('click', () => selectLevel(levelIndex - 1));
$('levelNext').addEventListener('click', () => selectLevel(levelIndex + 1));
$('brand').addEventListener('click', (e) => {
  e.preventDefault();
  if (mode === 'playing') pause();
  else if (mode === 'menu') notify('SLIPGATE · INDEPENDENT FIELD BUILD');
});
$('pauseButton').addEventListener('click', pause);
$('flightButton').addEventListener('click', toggleFlight);
for (const [button, id] of [
  ['settingsButton', 'settingsPanel'],
  ['performanceButton', 'performancePanel'],
  ['helpButton', 'helpPanel'],
  ['pakButton', 'pakPanel'],
]) {
  $(button).addEventListener('click', () => openPanel(id));
}
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => closePanel(b.dataset.close));
for (const b of hud.slots) {
  b.addEventListener('click', () => {
    if (mode === 'playing') game.selectWeapon(Number(b.dataset.weapon));
  });
}
$('soundButton').addEventListener('click', () => {
  config.sound = !config.sound;
  audio.setEnabled(config.sound);
  audio.ambience(mode === 'playing');
  saveConfig();
  $('soundButton').setAttribute('aria-pressed', String(config.sound));
  notify(config.sound ? 'SOUND ON' : 'SOUND OFF');
});
$('fullscreenButton').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await document.documentElement.requestFullscreen();
      await screen.orientation?.lock?.('landscape')?.catch(() => {});
    }
  } catch {
    notify('Full screen is not available in this browser.');
  }
});
$('fovRange').addEventListener('input', () => {
  config.fov = Number($('fovRange').value);
  $('fovValue').textContent = `${config.fov}°`;
  saveConfig();
});
$('difficultySelect').addEventListener('change', () => {
  if (DIFFICULTY[$('difficultySelect').value]) config.difficulty = $('difficultySelect').value;
  saveConfig();
});
$('aimAssist').addEventListener('change', () => {
  config.aimAssist = $('aimAssist').checked;
  saveConfig();
});
$('volumeRange').addEventListener('input', () => {
  config.volume = clamp(Number($('volumeRange').value), 0, 1);
  $('volumeValue').textContent = `${Math.round(config.volume * 100)}%`;
  audio.setVolume(config.volume);
  saveConfig();
});
$('retroSelect').addEventListener('change', () => {
  config.retro = Number($('retroSelect').value) || 0;
  kit.setPixelHeight(config.retro);
  saveConfig();
});
$('kitSettingsButton').addEventListener('click', () => kit.menu.open());

$('pakInput').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  $('pakStatus').textContent = 'Reading the local archive…';
  try {
    if (file.size > 384 * 1024 * 1024) throw Error('The file is larger than 384 MB.');
    activePak = new Pak(await file.arrayBuffer());
    const maps = activePak.maps();
    if (!maps.length) throw Error('This PAK has no BSP maps.');
    if (!activePak.get('gfx/palette.lmp')) throw Error('The Quake palette is missing. Choose pak0.pak.');
    $('mapSelect').replaceChildren();
    for (const name of maps) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name.replace('maps/', '').replace('.bsp', '').toUpperCase();
      $('mapSelect').append(option);
    }
    if (maps.includes('maps/e1m1.bsp')) $('mapSelect').value = 'maps/e1m1.bsp';
    $('pakStatus').textContent = `${file.name}: ${activePak.files.size} entries, ${maps.length} maps. Nothing was uploaded.`;
    show('mapPicker');
  } catch (error) {
    activePak = null;
    show('mapPicker', false);
    $('pakStatus').textContent = error.message;
  }
});
$('loadMapButton').addEventListener('click', () => {
  if (!activePak) return;
  $('loadMapButton').disabled = true;
  try {
    if (mode !== 'menu' && mode !== 'ended') toMenu();
    const name = $('mapSelect').value;
    loadWorld(new BSPWorld(activePak.get(name), activePak.get('gfx/palette.lmp'), name));
    renderHint();
    notify('MAP READY · World collision enabled. Free flight is on N, View or ↕.');
  } catch (error) {
    $('pakStatus').textContent = error.message;
    console.warn(error);
  } finally {
    $('loadMapButton').disabled = false;
  }
});
$('originalMapButton').addEventListener('click', () => {
  if (mode !== 'menu' && mode !== 'ended') toMenu();
  selectLevel(levelIndex);
  renderHint();
  notify(`${LEVELS[levelIndex].name} IS READY`);
});
$('benchmarkButton').addEventListener('click', () => {
  if (!ready || metrics.benchmark) return;
  toMenu();
  if (world.imported || world.id !== 'vault') selectLevel(0);
  metrics.reset();
  metrics.benchmark = { start: performance.now(), samples: [] };
  document.body.classList.add('benchmarking');
  $('benchmarkStatus').textContent = 'Render test running. The camera follows a fixed route.';
  notify('20-SECOND RENDER TEST · DO NOT SWITCH TABS');
});
$('exportButton').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(metrics.report(diagInfo()), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slipgate-metrics-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Audio can only start from a real gesture; any key, click or tap unlocks it.
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
addEventListener('touchend', unlockAudio, true);

// Clicking the view while playing captures the mouse again (after Esc, or if capture was refused).
kit.canvas.addEventListener('pointerdown', (e) => {
  if (mode === 'playing' && e.pointerType === 'mouse' && !document.pointerLockElement) input.lockPointer();
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === kit.canvas) hadLock = true;
  else if (hadLock) {
    hadLock = false;
    // The browser took the mouse back (Esc): pause, as the original did.
    if (mode === 'playing') pause();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (mode === 'playing') pause();
    cancelBenchmark('Render test cancelled because the page was hidden.');
    audio.hold(true);
  } else {
    metrics.last = 0;
    accumulator = 0;
    audio.hold(kit.paused);
  }
});
addEventListener('blur', () => {
  if (mode === 'playing') pause();
});
kit.onPause((paused) => {
  metrics.last = 0;
  // The shared settings panel opened mid-run: come back to the pause menu, not straight into a fight.
  if (paused && mode === 'playing') pause();
  audio.hold(paused || document.hidden);
});
input.onSourceChange(() => {
  renderHint();
  if (mode === 'playing') return;
  focusDefault();
});

// A small read-only diagnostic hook for reproducible browser tests.
window.slipgate = {
  get state() {
    return {
      mode,
      ready,
      level: world.id,
      backend: kit.backend,
      health: game.player.health,
      armor: game.player.armor,
      position: [...game.player.pos],
      yaw: game.player.yaw,
      pitch: game.player.pitch,
      wave: game.wave,
      waves: world.waves.length,
      kills: game.kills,
      ammo: { ...game.player.ammo },
      weapon: game.weapon,
      enemyCount: aliveCount(),
      secretCount: game.secrets,
      gateOpen: game.gateOpen,
      noclip: game.noclip,
      draws: view.calls,
      triangles: view.triangles,
    };
  },
  report: () => metrics.report(diagInfo()),
};

/* ------------------------------------------------------------------ start */

game = makeGame(world);
view.setWorld(world);
if (config.retro) kit.setPixelHeight(config.retro);
syncSettingsForm();
updateLevelCard();
renderHint();
setScreen();
$('backendLabel').textContent = kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL 2';
kit.loading.progress(0.85, 'Warming up the shaders…');
await view.prewarm(game.camera(true, 0, config.fov));
ready = true;
$('startButton').disabled = false;
kit.start(frame);
focusDefault();
