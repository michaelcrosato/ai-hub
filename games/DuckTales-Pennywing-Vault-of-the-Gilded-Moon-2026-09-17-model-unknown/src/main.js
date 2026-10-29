// main.js — startup, screens and the game loop. The kit boots the renderer
// (WebGPU with a WebGL2 fallback), wires keyboard, mouse, gamepad and touch into
// actions and runs the loop; this file drives the title (vault and difficulty
// select, continue), the pause menu, the Springsmith, the results screen, the
// camera and the HUD. Every menu works with a mouse, a controller (D-pad/stick
// + A, B to go back) and touch.

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { createPost } from 'kit/post.js';
import { GameSimulation, XP_THRESHOLDS, DIFFICULTIES, DIFFICULTY_ORDER, recordFor } from './game/core.js';
import { LEVELS, levelById } from './game/levels.js';
import { createGameScene } from './game/sceneFactory.js';
import { AudioEngine } from './game/audio.js';

const PROFILE_KEY = 'pennywing-vault-profile-v1';
const RUN_KEY = 'pennywing-vault-run-v1';
const PREFS_KEY = 'pennywing-vault-prefs-v1';
/** The simulation runs in substeps no longer than this, so jumps are the same at any frame rate. */
const SIM_STEP = 1 / 120;
const AUTOSAVE_EVERY = 4;

const kit = await boot({
  title: 'Pennywing: Vault of the Gilded Moon',
  holdLoading: true,
  gear: 'none', // Settings sits in the title and pause menus (F9 also opens it)
  accent: '#ffd85a',
  background: '#07121c',
  touch: { top: 'right', topOffset: 64 },
  input: {
    // clamp: false keeps a held jump key (W / ↑) from slowing the run to a diagonal.
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    jump: { keys: ['Space', 'KeyW', 'ArrowUp', 'KeyZ'], gamepad: ['A'], touch: 'Jump' },
    pogo: { keys: ['KeyX', 'KeyK', 'KeyJ', 'ShiftLeft', 'ShiftRight'], mouse: [0], gamepad: ['X', 'B', 'RT'], touch: 'Bounce' },
    interact: { keys: ['KeyE', 'Enter'], gamepad: ['Y'], touch: 'Use' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});
kit.loading.progress(0.7, 'Building the vault…');

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ui = {
  shell: $('gameShell'),
  hud: $('hud'),
  health: $('health'),
  coins: $('coins'),
  level: $('level'),
  mission: $('mission'),
  badge: $('rendererBadge'),
  xpBar: $('xpBar'),
  bossBar: $('bossBar'),
  bossName: $('bossName'),
  bossFill: $('bossFill'),
  escape: $('escapeTimer'),
  toasts: $('toasts'),
  objective: $('objectiveCard'),
  objKicker: $('objectiveKicker'),
  objTitle: $('objectiveTitle'),
  objSub: $('objectiveSub'),
  flash: $('damageFlash'),
  hint: $('controlsHint'),
  title: $('titleScreen'),
  vaultList: $('vaultList'),
  diffList: $('diffList'),
  recordLine: $('recordLine'),
  cont: $('continueButton'),
  start: $('startButton'),
  pause: $('pauseScreen'),
  pauseHeading: $('pauseHeading'),
  pauseStats: $('pauseStats'),
  shop: $('upgradeModal'),
  shopGrid: $('upgradeGrid'),
  shopCoins: $('shopCoins'),
  complete: $('completeModal'),
  completeTitle: $('completeTitle'),
  completeNote: $('completeNote'),
  completeStats: $('completeStats'),
  completeRecord: $('completeRecord'),
  rank: $('rankBadge'),
  next: $('nextButton'),
  replay: $('replayButton'),
};

// ------------------------------------------------------------------ saves
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      const v = raw ? JSON.parse(raw) : null;
      return v && typeof v === 'object' ? v : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: the run still works, it just is not kept */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

let profile = store.get(PROFILE_KEY, {});
const prefs = { level: LEVELS[0].id, difficulty: 'normal', muted: false, ...store.get(PREFS_KEY, {}) };
if (levelById(prefs.level).id !== prefs.level) prefs.level = LEVELS[0].id;
const isDifficulty = (id) => typeof id === 'string' && Object.hasOwn(DIFFICULTIES, id);
if (!isDifficulty(prefs.difficulty)) prefs.difficulty = 'normal';
const savePrefs = () => store.set(PREFS_KEY, { level: prefs.level, difficulty: prefs.difficulty, muted: !!prefs.muted });

function savedRun() {
  const r = store.get(RUN_KEY, null);
  if (!r || r.v !== 1 || levelById(r.level).id !== r.level || !isDifficulty(r.difficulty)) return null;
  return r;
}

// ------------------------------------------------------------------ audio
const audio = new AudioEngine();
audio.setMuted(prefs.muted);
// The first gesture anywhere unlocks audio (a controller-only player gets it on Start).
const unlockAudio = () => audio.start();
addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
addEventListener('keydown', unlockAudio, { once: true, capture: true });

// ------------------------------------------------------------------ renderer and world
const renderer = kit.renderer;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(43, 1, 0.1, 180));
const world = createGameScene(kit, scene);
const coarse = matchMedia('(pointer: coarse)').matches;
const post = createPost(kit, scene, camera, { bloom: { strength: coarse ? 0.22 : 0.3, radius: 0.45, threshold: 0.72 } });
ui.badge.textContent = kit.backendLabel;

// ------------------------------------------------------------------ state
/** 'title' | 'play' | 'paused' | 'shop' | 'complete' */
let mode = 'title';
let level = levelById(prefs.level);
let builtLevelId = null;
let sim = null; // the run being played
let session = false; // side by side in an AI Hub round
let sessionEnded = false;
let attract = null; // the title screen's idle vault
let completeDelay = 0;
let autosave = 0;
let lastTick = 0;
let lastPhase = '';
let menuReadyAt = 0;
const pending = { jump: false, pogo: false, interact: false };
const simInput = { moveX: 0, jumpPressed: false, jumpHeld: false, pogoPressed: false, pogoHeld: false, interactPressed: false };
const IDLE = Object.freeze({ moveX: 0, jumpPressed: false, jumpHeld: false, pogoPressed: false, pogoHeld: false, interactPressed: false });

function showLevel(lv) {
  level = lv;
  if (builtLevelId !== lv.id) {
    world.buildLevel(lv);
    builtLevelId = lv.id;
  }
  audio.setMusic(lv.theme.music || 0, false);
}

function makeAttract() {
  attract = new GameSimulation({ profile, level, difficulty: prefs.difficulty, onEvent: () => {} });
}

// ------------------------------------------------------------------ feedback
function showToast(text, tone = '') {
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = text;
  ui.toasts.appendChild(el);
  while (ui.toasts.children.length > 3) ui.toasts.firstElementChild.remove();
  setTimeout(() => el.remove(), 2600);
}

let objectiveTimer = 0;
function showObjective({ kicker = '', title = '', sub = '' }) {
  ui.objKicker.textContent = kicker;
  ui.objTitle.textContent = title;
  ui.objSub.textContent = sub;
  ui.objective.classList.remove('hidden');
  clearTimeout(objectiveTimer);
  objectiveTimer = setTimeout(() => ui.objective.classList.add('hidden'), 3900);
}

let flashTimer = 0;
function flashDamage() {
  ui.flash.classList.add('on');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ui.flash.classList.remove('on'), 120);
}

let shake = 0;
const SHAKE = { bossHit: 0.22, slam: 0.32, bossDown: 0.4, break: 0.14, rock: 0.24, relic: 0.08, crown: 0.2 };
const RUMBLE = { bossHit: [0.6, 140], slam: [0.5, 160], bossDown: [0.9, 320], break: [0.35, 90], rock: [0.5, 140], enemy: [0.25, 60], relic: [0.3, 120], crown: [0.5, 220] };

function onSimEvent(e) {
  switch (e.type) {
    case 'profile':
      profile = e.profile;
      store.set(PROFILE_KEY, profile);
      break;
    case 'toast':
      showToast(e.text, e.tone || '');
      break;
    case 'objective':
      showObjective(e);
      break;
    case 'sfx':
      audio.sfx(e.name);
      break;
    case 'damage':
      flashDamage();
      shake = Math.max(shake, 0.26);
      kit.input.rumble(0.6, 150);
      if (Number.isFinite(e.x)) world.burst('hurt', e.x, e.y);
      break;
    case 'fx':
      world.burst(e.kind, e.x, e.y);
      if (e.kind === 'land') world.squash();
      if (SHAKE[e.kind]) shake = Math.max(shake, SHAKE[e.kind]);
      if (RUMBLE[e.kind]) kit.input.rumble(...RUMBLE[e.kind]);
      break;
    case 'checkpoint':
      saveRun();
      break;
    case 'openUpgrade':
      openShop();
      break;
    case 'complete':
      onComplete(e.stats);
      break;
  }
}

// ------------------------------------------------------------------ modes
function setMode(m) {
  mode = m;
  const playing = m === 'play';
  ui.title.classList.toggle('hidden', m !== 'title');
  ui.pause.classList.toggle('hidden', m !== 'paused');
  ui.shop.classList.toggle('hidden', m !== 'shop');
  ui.complete.classList.toggle('hidden', m !== 'complete');
  ui.hud.classList.toggle('hidden', m === 'title');
  ui.hint.classList.toggle('hidden', !playing);
  if (m === 'title') {
    ui.bossBar.classList.add('hidden');
    ui.escape.classList.remove('visible');
    ui.objective.classList.add('hidden');
  }
  ui.shell.dataset.mode = m;
  kit.touch?.suspend(!playing, 'game');
  menuReadyAt = performance.now() + 450;
  if (playing) {
    document.activeElement?.blur?.();
    kit.input.settle();
    pending.jump = pending.pogo = pending.interact = false;
    placeHudInsets();
  }
  audio.setPaused(m === 'paused' || kit.paused);
}

function startRun(lv, difficulty, saved = null) {
  prefs.level = lv.id;
  prefs.difficulty = isDifficulty(difficulty) ? difficulty : 'normal';
  savePrefs();
  showLevel(lv);
  ui.toasts.textContent = '';
  sim = new GameSimulation({ profile, level: lv, difficulty: prefs.difficulty, onEvent: onSimEvent, seed: (Math.random() * 4294967296) >>> 0 });
  if (saved && sim.importRun(saved)) {
    showObjective({ kicker: `${lv.short} · resumed`, title: sim.getMissionText(), sub: 'Back at your last checkpoint with everything you found.' });
  }
  completeDelay = 0.9;
  pendingStats = null;
  autosave = 0;
  lastTick = 0;
  lastPhase = sim.phase;
  resetHud();
  snapCamera = true;
  setMode('play');
  audio.start();
  audio.setMusic(lv.theme.music || 0, sim.phase === 'escape');
  saveRun();
}

function saveRun() {
  if (!sim || sim.completed) return;
  store.set(RUN_KEY, sim.exportRun());
}

function openPause() {
  if (mode !== 'play' || !sim || sim.completed) return;
  saveRun();
  renderPause();
  setMode('paused');
}

function resume() {
  if (mode === 'paused') setMode('play');
}

function quitToTitle() {
  saveRun();
  sim = null;
  makeAttract();
  renderTitle();
  setMode('title');
}

function openShop() {
  if (mode !== 'play' || !sim || sim.completed) return;
  renderShop();
  setMode('shop');
}

function closeShop() {
  if (mode !== 'shop') return;
  saveRun();
  setMode('play');
}

function onComplete(stats) {
  store.remove(RUN_KEY);
  renderComplete(stats);
  if (session) {
    AIHub.result({ time: AIHub.time() });
    for (const el of [ui.next, ui.replay, $('titleButton')]) el.classList.add('hidden');
  }
  // The results card follows a beat later (see the loop), so the finish lands first.
}

// ------------------------------------------------------------------ title
const vaultButtons = new Map();
for (const lv of LEVELS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'choice';
  b.innerHTML = `<strong></strong><span></span><em></em>`;
  b.querySelector('strong').textContent = `${lv.short} · ${lv.name}`;
  b.querySelector('span').textContent = lv.blurb;
  b.addEventListener('click', () => {
    if (prefs.level === lv.id) return;
    prefs.level = lv.id;
    savePrefs();
    showLevel(lv);
    makeAttract();
    snapCamera = true;
    audio.sfx('menu');
    renderTitle();
  });
  ui.vaultList.append(b);
  vaultButtons.set(lv.id, b);
}
const diffButtons = new Map();
for (const id of DIFFICULTY_ORDER) {
  const d = DIFFICULTIES[id];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'choice';
  b.innerHTML = `<strong></strong><span></span>`;
  b.querySelector('strong').textContent = d.name;
  b.querySelector('span').textContent = d.blurb;
  b.addEventListener('click', () => {
    prefs.difficulty = id;
    savePrefs();
    audio.sfx('menu');
    renderTitle();
  });
  ui.diffList.append(b);
  diffButtons.set(id, b);
}

function renderTitle() {
  for (const [id, b] of vaultButtons) {
    b.setAttribute('aria-pressed', String(id === prefs.level));
    const cleared = Object.values(profile.records?.[id] || {}).some((r) => r?.clears > 0);
    b.querySelector('em').textContent = cleared ? 'CLEARED' : '';
  }
  for (const [id, b] of diffButtons) b.setAttribute('aria-pressed', String(id === prefs.difficulty));
  const lv = levelById(prefs.level);
  const d = DIFFICULTIES[prefs.difficulty];
  const rec = recordFor(profile, lv.id, d.id);
  const gear = [];
  if ((profile.staffLevel || 1) >= 2) gear.push('Springstaff Coil');
  if ((profile.coatLevel || 0) >= 1) gear.push('Riveted Trailcoat');
  const lvlNow = profile.level || 1;
  let line = rec?.bestTime != null
    ? `${lv.short} on ${d.name}: best ${formatTime(rec.bestTime)} · best treasure ${rec.bestTreasure}% · cleared ${rec.clears}×`
    : `${lv.short} on ${d.name}: not cleared yet`;
  line += ` · Explorer LV ${lvlNow}${gear.length ? ` · ${gear.join(', ')}` : ''}`;
  const run = savedRun();
  ui.cont.classList.toggle('hidden', !run);
  if (run) {
    const rl = levelById(run.level);
    ui.cont.textContent = `Continue expedition · ${rl.short} · ${DIFFICULTIES[run.difficulty].name} · ${formatTime(run.time || 0)}`;
    line += ' · Starting fresh replaces the saved run.';
  }
  ui.recordLine.textContent = line;
}

// ------------------------------------------------------------------ pause, shop, results
function statCard(label, value) {
  return `<div class="stat"><small>${label}</small><strong>${value}</strong></div>`;
}

function renderPause() {
  const s = sim.getSnapshot();
  ui.pauseHeading.textContent = `${level.short} · ${level.name}`;
  ui.pauseStats.innerHTML =
    statCard('Time', formatTime(s.time)) +
    statCard('Treasure found', `${s.treasurePercent}%`) +
    statCard('Coins', s.runCoins) +
    statCard('Difficulty', sim.diff.name);
}

function renderShop(focusKey = null) {
  const info = sim.getUpgradeInfo();
  const card = (key, item) => {
    const label = item.consumable ? (item.maxed ? 'HEARTS FULL' : 'BREW') : item.maxed ? 'INSTALLED' : 'INSTALL';
    const meta = item.consumable ? `Hearts ${item.hp}/${item.maxHp}` : `Gear level ${item.level}`;
    const price = item.maxed && !item.consumable ? 'MAX' : `${item.cost} coins`;
    const disabled = item.maxed || sim.runCoins < item.cost;
    return `
    <article class="upgrade-card">
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="upgrade-meta"><span>${meta}</span><span>${price}</span></div>
      <button class="upgrade-btn" type="button" data-upgrade="${key}" ${disabled ? 'disabled' : ''}>${label}</button>
    </article>`;
  };
  ui.shopGrid.innerHTML = card('staff', info.staff) + card('coat', info.coat) + card('tonic', info.tonic);
  ui.shopCoins.textContent = `You carry ${sim.runCoins} coins.`;
  if (focusKey) {
    const again = ui.shopGrid.querySelector(`[data-upgrade="${focusKey}"]:not([disabled])`);
    navSet(again || ui.shop.querySelector('[data-default]'));
  }
}

ui.shopGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-upgrade]');
  if (!btn || btn.disabled || mode !== 'shop') return;
  const key = btn.dataset.upgrade;
  const result = sim.buyUpgrade(key);
  if (!result.ok && result.reason === 'coins') showToast('Not enough coins for that.', 'bad');
  if (result.ok) kit.input.rumble(0.3, 80);
  renderShop(key);
  updateHud(sim.getSnapshot());
  saveRun();
});

let pendingStats = null;
function renderComplete(stats) {
  pendingStats = stats;
  const idx = LEVELS.findIndex((l) => l.id === level.id);
  const next = LEVELS[idx + 1] || null;
  ui.completeTitle.textContent = level.text.complete;
  ui.completeNote.textContent = next
    ? `${next.short}, ${next.name}, is open. Permanent gear and explorer XP carry forward.`
    : 'Every vault is cleared. Permanent gear and explorer XP carry forward; chase a better rank or a harder difficulty.';
  ui.rank.textContent = stats.rank;
  ui.rank.dataset.rank = stats.rank;
  ui.completeStats.innerHTML =
    statCard('Time', formatTime(stats.time)) +
    statCard('Treasure found', `${stats.treasure}%`) +
    statCard('Explorer level', stats.level) +
    statCard('Falls / knockouts', stats.deaths) +
    statCard('Coins carried', stats.coins) +
    statCard('Escape resets', stats.escapeFails);
  const notes = [];
  if (stats.firstClear) notes.push(`First clear on ${sim.diff.name}!`);
  else if (stats.newBest) notes.push('New best time!');
  if (stats.newTreasure) notes.push('New treasure record!');
  notes.push(`Best ${formatTime(stats.bestTime)} · best treasure ${stats.bestTreasure}% · cleared ${stats.clears}× on ${sim.diff.name}`);
  ui.completeRecord.textContent = notes.join(' · ');
  ui.next.classList.toggle('hidden', !next);
  ui.next.dataset.target = next ? next.id : '';
  ui.next.toggleAttribute('data-default', !!next);
  ui.replay.toggleAttribute('data-default', !next);
}

const menuReady = () => performance.now() >= menuReadyAt;

ui.start.addEventListener('click', () => {
  if (mode !== 'title') return;
  startRun(levelById(prefs.level), prefs.difficulty, null);
});
ui.cont.addEventListener('click', () => {
  const run = savedRun();
  if (mode !== 'title' || !run) return;
  startRun(levelById(run.level), run.difficulty, run);
});
$('pauseButton').addEventListener('click', openPause);
$('resumeButton').addEventListener('click', resume);
$('restartButton').addEventListener('click', () => {
  if (mode === 'paused' && sim && !session) startRun(level, sim.diff.id, null);
});
$('quitButton').addEventListener('click', () => {
  if (mode === 'paused' && !session) quitToTitle();
});
$('closeUpgrade').addEventListener('click', closeShop);
ui.next.addEventListener('click', () => {
  if (mode !== 'complete' || !menuReady()) return;
  const lv = levelById(ui.next.dataset.target);
  if (lv) startRun(lv, sim?.diff.id || prefs.difficulty, null);
});
ui.replay.addEventListener('click', () => {
  if (mode !== 'complete' || !menuReady()) return;
  startRun(level, sim?.diff.id || prefs.difficulty, null);
});
$('titleButton').addEventListener('click', () => {
  if (mode === 'complete' && menuReady()) quitToTitle();
});
for (const el of document.querySelectorAll('.js-settings')) el.addEventListener('click', () => kit.menu.open());
function renderSound() {
  for (const el of document.querySelectorAll('.js-sound')) {
    el.textContent = el.classList.contains('icon-btn') ? (prefs.muted ? 'MUTE' : 'SND') : `Sound: ${prefs.muted ? 'off' : 'on'}`;
    el.setAttribute('aria-pressed', String(!prefs.muted));
  }
}
for (const el of document.querySelectorAll('.js-sound')) {
  el.addEventListener('click', async () => {
    await audio.start();
    prefs.muted = !prefs.muted;
    audio.setMuted(prefs.muted);
    savePrefs();
    renderSound();
    if (mode === 'play') showToast(prefs.muted ? 'Sound muted' : 'Sound on');
  });
}

kit.onPause((p) => audio.setPaused(p || mode === 'paused'));
addEventListener('blur', () => {
  if (mode === 'play') openPause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') openPause();
  if (document.hidden) saveRun();
});
addEventListener('pagehide', saveRun);

// ------------------------------------------------------------------ menu navigation
// D-pad, stick or arrows move a highlight, A or Enter picks, B / Esc goes back.
// A button focused this way keeps Enter and Space for itself (a native click), so
// nothing fires twice; a controller's A clicks it from here.
const NAV_SEL = 'button:not([disabled])';
let navEl = null;
let navScope = null;
let navKey = '';
let navWait = 0;

function menuScope() {
  if (kit.menu.isOpen) return null;
  if (mode === 'title') return ui.title;
  if (mode === 'paused') return ui.pause;
  if (mode === 'shop') return ui.shop;
  if (mode === 'complete') return ui.complete;
  return null;
}
const navItems = (scope) => [...scope.querySelectorAll(NAV_SEL)].filter((el) => el.offsetParent !== null);
const navDefault = (scope) => scope.querySelector('[data-default]:not([disabled]):not(.hidden)') || navItems(scope)[0] || null;

function navSet(el, scroll = false) {
  if (navEl && navEl !== el) navEl.classList.remove('pad-focus');
  navEl = el;
  if (!el) return;
  el.focus({ preventScroll: true });
  const pad = kit.input.source === 'gamepad';
  el.classList.toggle('pad-focus', pad);
  // Only a moving highlight scrolls the panel; a phone opening the title keeps its header in view.
  if (scroll || pad) el.scrollIntoView?.({ block: 'nearest' });
}

function navMove(scope, dx, dy) {
  const items = navItems(scope);
  if (!items.length) return;
  const cur = items.includes(document.activeElement) ? document.activeElement : items.includes(navEl) ? navEl : null;
  if (!cur) {
    navSet(navDefault(scope), true);
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const vx = b.left + b.width / 2 - ax;
    const vy = b.top + b.height / 2 - ay;
    const along = vx * dx + vy * dy;
    if (along <= 4) continue;
    const score = along + Math.abs(vx * dy - vy * dx) * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) {
    navSet(best, true);
    audio.sfx('menu');
  } else if (dy) navSet(dy > 0 ? items[0] : items[items.length - 1], true); // wrap top/bottom
}

function menuInput(dt) {
  const scope = menuScope();
  if (!scope) {
    if (navEl) navEl.classList.remove('pad-focus');
    navEl = null;
    navScope = null;
    return;
  }
  if (scope !== navScope || !navEl || !navEl.isConnected || navEl.offsetParent === null || navEl.disabled) {
    navScope = scope;
    navKey = '';
    navSet(navDefault(scope));
  } else if (kit.input.source === 'gamepad' && !navEl.classList.contains('pad-focus')) navEl.classList.add('pad-focus');
  const mv = kit.input.vector('move');
  const dx = mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  const dy = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : 0; // screen y grows downward
  const key = dx || dy ? `${dx},${dy}` : '';
  if (!key) navKey = '';
  else if (key !== navKey || (navWait -= dt) <= 0) {
    navWait = key === navKey ? 0.14 : 0.38;
    navKey = key;
    navMove(scope, dy ? 0 : dx, dy);
  }
  if (kit.input.pressed('confirm') && menuReady()) (navEl || navDefault(scope))?.click();
}

// ------------------------------------------------------------------ prompts and layout
const CONTROLS = {
  keys: '<b>Keyboard</b> A/D or ←/→ move · Space, W or ↑ jump · hold X, K, Shift or click to bounce · E use · wheel or +/− zoom · Esc pause',
  pad: '<b>Controller</b> stick or D-pad move · A jump · hold X, B or RT to bounce · Y use · LB / RB zoom · Start pause',
  touch: '<b>Touch</b> left thumb moves · JUMP · hold BOUNCE to pogo · USE at the Springsmith · pinch to zoom · II pauses',
};
let promptMode = '';
function syncPrompts() {
  const m = kit.touch?.visible ? 'touch' : kit.input.source === 'gamepad' ? 'pad' : kit.input.source === 'touch' ? 'touch' : 'keys';
  if (m === promptMode) return;
  promptMode = m;
  document.body.dataset.input = m;
  for (const el of document.querySelectorAll('.js-controls')) el.innerHTML = CONTROLS[m];
}

// The touch pause pill sits under the HUD, wherever the HUD wraps to.
function placeHudInsets() {
  const r = ui.hud.getBoundingClientRect();
  if (!r.height) return;
  document.documentElement.style.setProperty('--hud-bottom', `${Math.round(r.bottom)}px`);
  kit.touch?.placeTop('right', Math.round(r.bottom + 8));
}
kit.onResize((w, h) => {
  ui.shell.classList.toggle('portrait', h > w);
  if (mode !== 'title') placeHudInsets();
});

// ------------------------------------------------------------------ HUD
const hud = {};
function resetHud() {
  for (const k of Object.keys(hud)) delete hud[k];
}
function setText(el, key, value) {
  if (hud[key] === value) return false;
  hud[key] = value;
  el.textContent = value;
  return true;
}

function updateHud(s) {
  const p = s.player;
  const hearts = `${p.hp}/${p.maxHp}`;
  if (hud.hearts !== hearts) {
    hud.hearts = hearts;
    const full = '♥'.repeat(Math.max(0, p.hp));
    const empty = '♥'.repeat(Math.max(0, p.maxHp - p.hp));
    ui.health.innerHTML = `${full}<span class="empty">${empty}</span>`;
    ui.health.setAttribute('aria-label', `Health ${hearts}`);
  }
  setText(ui.coins, 'coins', String(s.runCoins));
  setText(ui.level, 'lvl', String(s.profile.level));
  if (setText(ui.mission, 'mission', s.missionText)) placeHudInsets();
  const lvl = s.profile.level;
  const base = XP_THRESHOLDS[Math.min(lvl - 1, XP_THRESHOLDS.length - 1)] || 0;
  const next = XP_THRESHOLDS[lvl] ?? base + 160;
  const xp = Math.round(Math.max(0, Math.min(1, (s.profile.xp - base) / Math.max(1, next - base))) * 200) / 200;
  if (hud.xp !== xp) {
    hud.xp = xp;
    ui.xpBar.style.transform = `scaleX(${xp})`;
  }
  const escaping = s.phase === 'escape';
  if (hud.escaping !== escaping) {
    hud.escaping = escaping;
    ui.escape.classList.toggle('visible', escaping);
  }
  if (escaping) {
    setText(ui.escape, 'escape', `EXIT ${Math.max(0, s.escapeTime).toFixed(1)}`);
    const urgent = s.escapeTime <= 10;
    if (hud.urgent !== urgent) {
      hud.urgent = urgent;
      ui.escape.classList.toggle('urgent', urgent);
    }
  }
  const fighting = s.boss.active && s.boss.alive;
  if (hud.fighting !== fighting) {
    hud.fighting = fighting;
    ui.bossBar.classList.toggle('hidden', !fighting);
    ui.bossName.textContent = level.boss.name;
  }
  if (fighting) {
    const f = s.boss.hp / s.boss.maxHp;
    if (hud.bossHp !== f) {
      hud.bossHp = f;
      ui.bossFill.style.transform = `scaleX(${f})`;
    }
  }
  if (hud.interact !== s.canInteract) {
    hud.interact = s.canInteract;
    kit.touch?.setShown('interact', s.canInteract);
  }
}

// ------------------------------------------------------------------ camera
const cam = { x: 4, y: 2.4, zoom: 0 };
let snapCamera = true;
const _tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

function cameraDistance() {
  const portrait = kit.size.height > kit.size.width;
  const base = portrait ? 22.5 : coarse ? 17.3 : 16.2;
  return clamp(base + cam.zoom, 11.5, portrait ? 27 : 23);
}

function zoomInput(dt) {
  const inp = kit.input;
  let z = -inp.zoom() * 0.7;
  if (inp.down('zoomIn')) z -= 8 * dt;
  if (inp.down('zoomOut')) z += 8 * dt;
  if (z) cam.zoom = clamp(cam.zoom + z, -12, 12);
}

function placeCamera(dx, dy, dt) {
  const k = snapCamera ? 1 : 1 - Math.exp(-4.7 * dt);
  snapCamera = false;
  cam.x += (dx - cam.x) * k;
  cam.y += (dy - cam.y) * k;
  const dist = cameraDistance();
  shake = Math.max(0, shake - dt * 1.8);
  const sx = shake ? (Math.random() - 0.5) * shake * 0.6 : 0;
  const sy = shake ? (Math.random() - 0.5) * shake * 0.6 : 0;
  camera.position.set(cam.x + sx, cam.y + 0.8 + sy, dist);
  camera.lookAt(cam.x + sx, cam.y - 0.2 + sy, 0);
  // The shadow window follows the view, so the long level stays sharp without a huge map.
  world.key.position.set(cam.x + 11, cam.y + 18, 10);
  world.key.target.position.set(cam.x, cam.y, 0);
  world.key.target.updateMatrixWorld();
}

function followCamera(s, dt) {
  const C = level.camera;
  const B = level.boss;
  const p = s.player;
  const dist = cameraDistance();
  const lead = s.phase === 'escape' ? -2.1 : (p.facing || 1) * 1.7;
  let dx = clamp(p.x + lead, C.minX, C.maxX);
  let dy = clamp(p.y + 2.35, C.minY, C.maxY);
  if (s.boss.active && s.boss.alive) {
    // Frame the whole arena when it fits; on a narrow (portrait) view, follow Pennywing inside it.
    const margin = _tanHalf * dist * camera.aspect * 0.8;
    const A = B.arena;
    dx = A.maxX - A.minX > 2 * margin ? clamp(p.x, A.minX + margin, A.maxX - margin) : B.focus.x;
    dy = B.focus.y;
  }
  placeCamera(dx, dy, dt);
}

function titleCamera(t, dt) {
  const C = level.camera;
  const u = 0.5 - 0.5 * Math.cos(t * 0.055);
  placeCamera(C.minX + (C.maxX - C.minX) * u, 2.6, dt);
}

// ------------------------------------------------------------------ loop
function stepSim(dt) {
  const inp = kit.input;
  if (inp.pressed('jump')) pending.jump = true;
  if (inp.pressed('pogo')) pending.pogo = true;
  if (inp.pressed('interact')) pending.interact = true;
  const mv = inp.vector('move');
  simInput.moveX = mv.x;
  simInput.jumpHeld = inp.down('jump');
  simInput.pogoHeld = inp.down('pogo');
  const n = Math.max(1, Math.ceil(dt / SIM_STEP - 1e-6));
  const h = dt / n;
  for (let i = 0; i < n && mode === 'play' && !sim.completed; i++) {
    simInput.jumpPressed = pending.jump;
    simInput.pogoPressed = pending.pogo;
    simInput.interactPressed = pending.interact;
    pending.jump = pending.pogo = pending.interact = false;
    sim.step(h, simInput);
  }
  if (sim.phase !== lastPhase) {
    lastPhase = sim.phase;
    audio.setMusic(level.theme.music || 0, sim.phase === 'escape');
  }
  if (sim.phase === 'escape' && !sim.completed) {
    const sec = Math.ceil(sim.escapeTime);
    if (sec !== lastTick && sec <= 10) audio.sfx('tick');
    lastTick = sec;
  }
  if (session) AIHub.progress({ score: sessionScore(), label: SESSION_LABELS[sim.phase] || 'Vault' });
  autosave += dt;
  if (autosave >= AUTOSAVE_EVERY) {
    autosave = 0;
    saveRun();
  }
}

const SESSION_PHASES = ['gear', 'guardian', 'crown', 'escape', 'complete'];
const SESSION_LABELS = { gear: 'Finding the relic', guardian: 'Facing the guardian', crown: 'Claiming the prize', escape: 'Escaping!', complete: 'Escaped' };
/** How far along the vault the run is: the phase reached, then treasure found. */
const sessionScore = () => SESSION_PHASES.indexOf(sim.phase) * 100 + sim.getTreasurePercent();

let frames = 0;
function frame(dt, t) {
  frames += 1;
  syncPrompts();
  const m0 = mode;
  const inp = kit.input;

  if (m0 === 'play' && sim) {
    if (inp.pressed('pause')) openPause();
    else if (session && (sessionEnded || AIHub.time() < 0)) {
      // waiting for the hub's start, or the round is over
    } else {
      zoomInput(dt);
      stepSim(dt);
      if (sim.completed && mode === 'play') {
        completeDelay -= dt;
        if (completeDelay <= 0 && pendingStats) setMode('complete');
      }
    }
  } else if (m0 === 'paused') {
    if (inp.pressed('pause') || inp.pressed('back')) resume();
  } else if (m0 === 'shop') {
    if (inp.pressed('pause') || inp.pressed('back')) closeShop();
  } else if (m0 === 'title') {
    attract.step(Math.min(dt, 0.05), IDLE);
  }
  if (mode === m0) menuInput(dt);

  const active = mode === 'title' || !sim ? attract : sim;
  const s = active.getSnapshot();
  if (mode === 'title') titleCamera(t, dt);
  else followCamera(s, dt);
  world.update(s, t, dt, active.time);
  if (sim && mode !== 'title') updateHud(s);
  post.render();

  if (frames === 2) kit.loading.done();
}

// ------------------------------------------------------------------ boot
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

showLevel(level);
makeAttract();
world.prewarm();
kit.touch?.setShown('interact', false);
renderSound();
renderTitle();
setMode('title');
if (AIHub.active) {
  session = !!(await AIHub.connect({ mode: 'parallel', seats: [1, 4] }));
  if (session) {
    AIHub.on('time-up', () => {
      if (sim && !sim.completed) AIHub.result({ score: sessionScore() });
    });
    AIHub.on('end', () => {
      sessionEnded = true;
      audio.setPaused(true);
    });
    startRun(levelById(prefs.level), prefs.difficulty, null);
    AIHub.ready();
  }
}
kit.start(frame);
