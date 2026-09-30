/*
 * T2 / Cyberdyne - First-person Survival, on the shared 3D stack.
 * Boots through the kit (WebGPU with WebGL2 fallback, quality tiers, input,
 * touch controls, settings), runs the Strata game rules on a fixed 60 Hz
 * clock and draws them with three.js (gfx.js).
 */
import { boot } from 'kit/boot.js';
import { fixedStep } from 'kit/physics.js';
import { Gfx } from './gfx.js';
import { Cyberdyne } from './game.js';
import { AudioBus } from './audio.js';
import { HUD } from './ui.js';
import { DIFFICULTIES, DIFFICULTY_ORDER } from './waves.js';

const kit = await boot({
  title: 'T2 / Cyberdyne',
  accent: '#eeb67c',
  background: '#0b1a2c',
  gear: 'none', // the game's own Settings button and pause menu open the kit panel
  touch: { top: 'right', topOffset: 12 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'always', gamepad: 'rightStick', touch: 'drag' },
    fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
    aim: { keys: ['KeyK'], mouse: [2], gamepad: ['LT'], touch: 'Aim' },
    crouch: { keys: ['KeyC'], gamepad: ['B'], touch: 'Cover' },
    gas: { keys: ['KeyG'], gamepad: ['LB'], touch: 'Gas' },
    lock: { keys: ['KeyQ'], gamepad: ['RB'], touch: 'Lock' },
    jump: { keys: ['Space'], gamepad: ['A'] },
    sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
    vision: { keys: ['Tab', 'KeyV'], gamepad: ['Y'], touch: { label: 'Vision', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    restart: { keys: ['KeyR'], gamepad: ['Back'] },
    mute: { keys: ['KeyM'] },
    save: { keys: ['F5'] },
    load: { keys: ['F8'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
  },
});
const { input } = kit;
kit.loading.progress(0.75, 'Building Cyberdyne…');

/* ---------------------------------------------------------------- storage */

const KEYS = { settings: 't2cyberdyne.settings.v1', checkpoint: 't2cyberdyne.checkpoint.v3', best: 't2cyberdyne.best.v1' };
const memory = new Map();
const store = {
  get(key) {
    try {
      const s = localStorage.getItem(key);
      if (s) return JSON.parse(s);
    } catch {
      /* private mode or blocked storage: fall back to this session */
    }
    return memory.has(key) ? structuredClone(memory.get(key)) : null;
  },
  set(key, value) {
    memory.set(key, structuredClone(value));
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
const saved = store.get(KEYS.settings) || {};
const settings = {
  volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.25,
  muted: saved.muted === true,
  mouseLock: saved.mouseLock !== false,
  difficulty: DIFFICULTIES[saved.difficulty] ? saved.difficulty : 'terminator',
};
const saveSettings = () => store.set(KEYS.settings, settings);
function loadBest() {
  const raw = store.get(KEYS.best), out = {};
  if (raw && typeof raw === 'object')
    for (const id of DIFFICULTY_ORDER) {
      const b = raw[id];
      if (b && Number.isFinite(b.score) && Number.isFinite(b.wave)) out[id] = { score: Math.max(0, Math.round(b.score)), wave: Math.max(0, Math.round(b.wave)) };
    }
  return out;
}
let best = loadBest();
function checkpointInfo() {
  const d = store.get(KEYS.checkpoint);
  if (!d || d.version !== 3 || !d.local || !Number.isSafeInteger(d.local.wave)) return null;
  const next = d.local.phase === 'intermission' ? d.local.wave + 1 : d.local.wave;
  return { data: d, label: next ? `Continue / wave ${next}` : 'Continue / scene 01' };
}
let checkpoint = checkpointInfo();

/* ---------------------------------------------------------------- services */

const gfx = new Gfx(kit);
const audio = new AudioBus();
audio.setVolume(settings.volume);
audio.setMuted(settings.muted);
const root = document.getElementById('t2-ui');
const hud = new HUD(root);
hud.setMute(settings.muted);
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
kit.onResize((w, h) => hud.vision.resize(w, h));

const PROMPTS = {
  keyboard: { vision: 'Tab', lock: 'Q', aim: 'right mouse', fire: 'left mouse', gas: 'G', crouch: 'C', pause: 'Esc' },
  gamepad: { vision: 'Y', lock: 'RB', aim: 'LT', fire: 'RT', gas: 'LB', crouch: 'B', pause: 'Start' },
  touch: { vision: 'Vision', lock: 'Lock', aim: 'Aim', fire: 'Fire', gas: 'Gas', crouch: 'Cover', pause: 'II' },
};
const key = (action) => (PROMPTS[input.source] || PROMPTS.keyboard)[action] || action;

/** What the simulation reads each fixed step. Presses are queued once per frame and taken once. */
const ctl = {
  moveX: 0, moveZ: 0, sprint: false, crouch: false, fire: false, aim: false,
  queued: new Set(),
  take(name) {
    return this.queued.delete(name);
  },
  clear() {
    this.moveX = this.moveZ = 0;
    this.sprint = this.crouch = this.fire = this.aim = false;
    this.queued.clear();
  },
};
const QUEUED = ['jump', 'vision', 'lock', 'gas'];

/* ---------------------------------------------------------------- game state */

let scene = null, game = null;
let status = 'title', pauseKind = 'paused', hasBegun = false, newBest = false, pausedAt = 0;
let settingsOpen = false, lockWarned = false, hadLock = false, lastRumble = 0, runBest = 0;
const step = fixedStep(60, 5);

function onGameEvent(type) {
  const now = performance.now();
  if (type === 'shot') {
    if (now - lastRumble > 110) { lastRumble = now; input.rumble(0.22, 80); }
  } else if (type === 'hurt') input.rumble(0.75, 200);
  else if (type === 'disable') input.rumble(0.55, 260);
  else if (type === 'gas') input.rumble(0.4, 110);
  else if (type === 'waveClear' && !game.demo) {
    recordBest();
    saveCheckpoint(true);
  }
}

function newGame(difficulty = settings.difficulty) {
  game?.dispose();
  scene?.dispose();
  scene = gfx.createScene();
  game = new Cyberdyne({ scene, audio, ctl, notify: (t) => hud.toast(t), emit: onGameEvent, key, difficulty, reducedMotion, effectCap: () => kit.detail(260, 120) });
  game.mount();
  hud.vision.reset();
  ctl.clear();
  step.reset();
  newBest = false;
}

function renderMode() {
  hud.setMode({ status, pauseKind, hasBegun, game, checkpoint, best, difficulty: game ? game.ctx.difficulty : settings.difficulty, newBest });
}

function setStatus(next, kind = 'paused') {
  status = next;
  pauseKind = kind;
  const inPlay = next === 'play';
  kit.touch?.suspend(!inPlay, 'game');
  input.settle();
  if (inPlay) {
    if (settingsOpen) openSettings(false);
    ctl.clear();
    step.reset();
    audio.unlock();
  } else {
    input.unlockPointer();
    pausedAt = performance.now();
    game?.quiet();
    if (next !== 'failed') audio.suspend();
  }
  renderMode();
  focusMenu();
}

let unlockedAt = -1e9;
function lockMouse() {
  if (!settings.mouseLock || game?.demo || input.source !== 'keyboard' || document.pointerLockElement === kit.canvas) return;
  // Browsers refuse a new lock for about a second after Esc released it; the next click on the view locks instead.
  if (performance.now() - unlockedAt < 1300) return;
  input.lockPointer();
}

function begin(demo = false) {
  if (!game || game.failed) return;
  audio.unlock();
  game.demo = demo;
  hasBegun = true;
  runBest = best[game.ctx.difficulty]?.score || 0;
  setStatus('play');
  if (!demo) lockMouse();
}
function pause() {
  if (status === 'play') setStatus('paused');
}
function resume() {
  if (status !== 'paused' || game.failed) return;
  setStatus('play');
  lockMouse();
}
function restart(toMenu = false) {
  const demo = !!game?.demo;
  newGame(toMenu ? settings.difficulty : game?.ctx.difficulty || settings.difficulty);
  if (toMenu) {
    hasBegun = false;
    setStatus('title');
  } else begin(demo);
}
function recordBest() {
  const id = game.ctx.difficulty, b = best[id] || { score: 0, wave: 0 };
  const better = game.score > b.score;
  if (better || game.wavesCleared > b.wave) {
    best = { ...best, [id]: { score: Math.max(b.score, game.score), wave: Math.max(b.wave, game.wavesCleared) } };
    store.set(KEYS.best, best);
  }
  return better;
}
function onFail() {
  recordBest();
  // Compared with the best from before this run started (wave clears already record progress).
  newBest = !game.demo && game.score > 0 && game.score > runBest;
  setStatus('failed');
  input.rumble(1, 420);
}

/* ---------------------------------------------------------------- checkpoints (F5 / F8, pause menu, automatic after each wave) */

function saveCheckpoint(auto = false) {
  if (!game || !hasBegun || game.failed || game.demo) {
    if (!auto) hud.toast('Start a run to save a checkpoint.');
    return false;
  }
  try {
    const data = { version: 3, difficulty: game.ctx.difficulty, savedAt: Date.now(), local: game.saveLocal() };
    const persisted = store.set(KEYS.checkpoint, data);
    checkpoint = checkpointInfo();
    hud.toast(auto ? (game.wave ? `Wave ${game.wave} clear / checkpoint saved` : 'Scene 01 complete / checkpoint saved') : persisted ? 'Checkpoint saved in this browser.' : 'Checkpoint kept for this session. Browser storage is unavailable.');
    renderMode();
    return true;
  } catch (err) {
    hud.toast('Checkpoint not saved: ' + err.message);
    return false;
  }
}
function loadCheckpoint(play = false) {
  const info = checkpointInfo();
  if (!info) {
    hud.toast('No saved checkpoint is available.');
    return false;
  }
  const difficulty = DIFFICULTIES[info.data.difficulty] ? info.data.difficulty : 'terminator';
  newGame(difficulty);
  try {
    game.restoreLocal(info.data.local);
    game.updateCars(0);
    game.update(0);
  } catch (err) {
    console.warn('Checkpoint rejected:', err);
    hud.toast('Checkpoint not loaded: ' + err.message);
    store.set(KEYS.checkpoint, null);
    checkpoint = null;
    newGame();
    hasBegun = false;
    setStatus('title');
    return false;
  }
  hud.vision.reset();
  hasBegun = true;
  runBest = best[game.ctx.difficulty]?.score || 0;
  if (play) {
    setStatus('play');
    lockMouse();
  } else setStatus('paused', 'checkpoint');
  return true;
}

/* ---------------------------------------------------------------- menus */

function openSettings(open) {
  settingsOpen = open;
  hud.show(hud.E.settings, open);
  if (open) {
    if (status === 'play') pause();
    hud.id('volume').value = String(settings.muted ? 0 : settings.volume);
    hud.id('lock').checked = settings.mouseLock;
  }
  focusMenu();
}
function currentMenu() {
  if (settingsOpen) return hud.E.settings;
  if (status === 'title') return hud.E.intro;
  if (status === 'paused' || status === 'failed') return hud.E.pauseBox;
  return null;
}
const menuItems = (c) => [...c.querySelectorAll('button, input')].filter((el) => !el.disabled && el.offsetParent !== null);
/** A controller gets the primary button focused, so A works straight away. */
function focusMenu() {
  if (input.source !== 'gamepad') return;
  const c = currentMenu();
  if (!c) return;
  const items = menuItems(c);
  (items.find((b) => b.classList.contains('t2-primary')) || items[0])?.focus();
}
let navDir = 0, navRepeat = 0;
/** Menus by gamepad and keyboard: move steps through buttons (left/right adjusts a slider), confirm clicks, back or pause closes. */
function menuInput(now) {
  const backPressed = input.pressed('back') || (input.pressed('pause') && now - pausedAt > 250);
  if (settingsOpen && backPressed) { openSettings(false); return; }
  if (status === 'paused' && backPressed) { resume(); return; }
  if (status === 'failed' && input.pressed('restart')) { restart(); return; }
  const c = currentMenu();
  if (!c) return;
  const mv = input.vector('move');
  const vertical = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : 0, side = mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  const d = vertical || side;
  const active = document.activeElement, inMenu = !!active && c.contains(active);
  if (d && (d !== navDir || now > navRepeat)) {
    if (side && inMenu && active.type === 'range') {
      const stepSize = Number(active.step) || 0.05;
      active.value = String(Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + side * stepSize)));
      active.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const items = menuItems(c);
      if (items.length) {
        const i = inMenu ? items.indexOf(active) : -1;
        items[i < 0 ? (d > 0 ? 0 : items.length - 1) : (i + d + items.length) % items.length].focus();
      }
    }
    navRepeat = now + (d !== navDir ? 380 : 140);
  }
  navDir = d;
  if (input.pressed('confirm')) {
    if (inMenu && active.matches('button, input[type=checkbox]')) active.click();
    else if (!inMenu) (c.querySelector('.t2-primary:not(.t2-hide)') || menuItems(c)[0])?.click();
  }
}
function cycleDifficulty() {
  if (status !== 'title') return;
  const i = DIFFICULTY_ORDER.indexOf(settings.difficulty);
  settings.difficulty = DIFFICULTY_ORDER[(i + 1) % DIFFICULTY_ORDER.length];
  saveSettings();
  // Nothing has happened in the title-screen run yet, so it can switch in place.
  game.diff = DIFFICULTIES[settings.difficulty];
  game.ctx.difficulty = settings.difficulty;
  renderMode();
}
function toggleMute() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  hud.setMute(settings.muted);
  saveSettings();
}
async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    hud.toast('Full screen is not available in this view.');
  }
}

const on = (name, fn) => hud.id(name).addEventListener('click', fn);
on('begin', () => begin(false));
on('watch', () => begin(true));
on('continue', () => loadCheckpoint(true));
on('difficulty', cycleDifficulty);
on('resume', resume);
on('retry', () => loadCheckpoint(true));
on('restart', () => restart());
on('menu', () => restart(true));
on('save', () => saveCheckpoint());
on('load', () => loadCheckpoint());
on('pause-settings', () => openSettings(true));
on('pause-button', pause);
on('vision-button', () => {
  if (status === 'play') game.toggleVision();
  else hud.toast(`Start or resume play, then press ${key('vision')} for T-800 vision.`);
});
on('mute', toggleMute);
on('full', toggleFullscreen);
on('settings', () => openSettings(!settingsOpen));
on('settings-close', () => openSettings(false));
on('graphics', () => kit.menu.open());
hud.id('volume').addEventListener('input', (ev) => {
  settings.volume = Math.max(0, Math.min(1, Number(ev.target.value) || 0));
  audio.setVolume(settings.volume);
  if (settings.muted) {
    settings.muted = false;
    audio.setMuted(false);
    hud.setMute(false);
  }
  saveSettings();
});
hud.id('lock').addEventListener('change', (ev) => {
  settings.mouseLock = ev.target.checked;
  saveSettings();
  if (!settings.mouseLock) input.unlockPointer();
});

/* ---------------------------------------------------------------- page events */

// Tab is T-800 vision only during play; in menus it keeps moving focus between buttons.
addEventListener('keydown', (e) => { if (e.code === 'Tab' && status !== 'play') e.stopImmediatePropagation(); }, true);
// The first gesture anywhere unlocks audio (a controller-only start cannot).
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio, { capture: true, once: true });
addEventListener('keydown', unlockAudio, { capture: true, once: true });
addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  }
});
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === kit.canvas;
  // Esc releases the mouse in the browser before the page sees it: treat that as pause, like the original.
  // Losing the lock during play means the browser released it (Esc), not the game's own pause.
  if (!locked && hadLock && status === 'play') {
    unlockedAt = performance.now();
    if (settings.mouseLock && !game.demo) pause();
  }
  hadLock = locked;
});
document.addEventListener('pointerlockerror', () => {
  if (lockWarned || status !== 'play') return;
  lockWarned = true;
  hud.toast('Mouse lock is unavailable in this view. Move the mouse to aim, or open the game in its own tab.');
});
kit.canvas.addEventListener('pointerdown', (e) => {
  if (status === 'play' && e.pointerType === 'mouse' && !document.pointerLockElement) lockMouse();
});
kit.onPause((paused) => {
  if (paused) {
    pause();
    audio.suspend();
  } else if (status === 'play') audio.unlock();
});
hud.setSource(input.source);
input.onSourceChange((src) => {
  hud.setSource(src);
  if (src === 'gamepad') focusMenu();
});

/* ---------------------------------------------------------------- start */

newGame();
// Compile every pipeline now (including sparks, smoke, gas and searchlights) so the first shots do not stutter.
await gfx.warm(scene, [
  { shape: 'box', unlit: true, alpha: 1 },
  { shape: 'box', alpha: 1 },
  { shape: 'sphere', unlit: true, alpha: 0.82 },
  { shape: 'sphere', alpha: 0.48 },
  { shape: 'cylinder', alpha: 1 },
]);
kit.touch?.setShown('lock', false);
setStatus('title');
root.classList.remove('t2-hide');
window.t2 = { kit, gfx, get game() { return game; }, get status() { return status; } };

let lastScan = false, lastTouch = null;
kit.start((dt, t) => {
  const now = performance.now();
  if (input.pressed('mute')) toggleMute();
  if (status === 'play') {
    if (input.pressed('pause')) pause();
    else if (input.pressed('restart')) restart();
    else if (input.pressed('save')) saveCheckpoint();
    else if (input.pressed('load')) loadCheckpoint();
  } else menuInput(now);
  if (status === 'play') {
    const mv = input.vector('move');
    ctl.moveX = mv.x;
    ctl.moveZ = -mv.y;
    ctl.sprint = input.down('sprint');
    ctl.crouch = input.down('crouch');
    ctl.fire = input.down('fire');
    ctl.aim = input.down('aim');
    for (const a of QUEUED) if (input.pressed(a)) ctl.queued.add(a);
    const lk = input.look('look');
    game.look(lk.x, lk.y);
    let stepped = false;
    step.advance(dt, (h) => {
      stepped = true;
      game.fixedUpdate(h);
    });
    if (stepped) ctl.queued.clear();
    if (game.failed) onFail();
  }
  game.update(status === 'play' ? dt : 0);
  if (game.scan !== lastScan) {
    lastScan = game.scan;
    kit.touch?.setShown('lock', game.scan);
  }
  const touchOn = !!kit.touch?.visible;
  if (touchOn !== lastTouch) {
    lastTouch = touchOn;
    hud.vision.radarTop = touchOn;
  }
  hud.frame(game, t, key);
  gfx.render(scene);
});
