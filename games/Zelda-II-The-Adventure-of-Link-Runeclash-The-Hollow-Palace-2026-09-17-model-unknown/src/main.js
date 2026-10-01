import { boot } from 'kit/boot.js';
import { GameWorld, DIFFICULTIES, GAME_TITLE } from './game.js';
import { AudioManager } from './audio.js';
import { createView } from './view.js';
import { load, store, formatTime } from './save.js';

const kit = await boot({
  title: GAME_TITLE,
  canvas: document.getElementById('game'),
  gear: 'none', // Settings sits in the title and pause menus (F9 opens it too)
  accent: '#f0c45e',
  background: '#120f27',
  touch: { top: 'right', topOffset: 6 },
  input: {
    // clamp: false so holding W / ↑ to jump while running keeps full run speed.
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    jump: { keys: ['Space', 'KeyW', 'ArrowUp'], gamepad: ['A'], touch: 'Jump' },
    attack: { keys: ['KeyJ', 'KeyX'], mouse: [0], gamepad: ['X', 'RT'], touch: 'Slash' },
    guard: { keys: ['KeyK', 'ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['B', 'LT'], touch: 'Guard' },
    magic: { keys: ['KeyQ', 'KeyC'], gamepad: ['RB'], touch: 'Spark' },
    interact: { keys: ['KeyE', 'Enter'], gamepad: ['Y'], touch: 'Action' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoom: { keys: ['KeyZ'], gamepad: ['LB', 'RS'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] }
  }
});
const { input } = kit;

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ui = {
  badge: $('backend-badge'),
  pauseButton: $('pause-button'),
  hud: $('hud'),
  hpFill: $('hp-fill'),
  mpFill: $('mp-fill'),
  xpFill: $('xp-fill'),
  hpText: $('hp-text'),
  mpText: $('mp-text'),
  levelText: $('level-text'),
  palaceName: $('palace-name'),
  gearText: $('gear-text'),
  objective: $('objective'),
  runTime: $('run-time'),
  bossHud: $('boss-hud'),
  bossName: $('boss-name'),
  bossFill: $('boss-fill'),
  flash: $('hurt-flash'),
  toast: $('toast'),
  prompt: $('interact-prompt'),
  start: $('start-overlay'),
  startButton: $('start-button'),
  continueButton: $('continue-button'),
  undercroftButton: $('undercroft-button'),
  records: $('records'),
  pause: $('pause-overlay'),
  pausePalace: $('pause-palace'),
  pauseStats: $('pause-stats'),
  level: $('level-overlay'),
  levelNumber: $('level-number'),
  complete: $('complete-overlay'),
  completeEyebrow: $('complete-eyebrow'),
  completeTitle: $('complete-heading'),
  completeStats: $('complete-stats'),
  completeRecord: $('complete-record'),
  nextPalace: $('next-palace')
};

const PALACE_NAMES = { hollow: 'The Hollow Palace', undercroft: 'The Ember Undercroft' };

// ------------------------------------------------------------------ saved state
const prefs = Object.assign({ difficulty: 'normal', sound: true }, load('prefs', {}));
if (!DIFFICULTIES[prefs.difficulty]) prefs.difficulty = 'normal';
const savePrefs = () => store('prefs', prefs);

const loadedProgress = load('progress', {});
const progress = {
  cleared: { ...(loadedProgress.cleared || {}) },
  best: { ...(loadedProgress.best || {}) },
  carry: loadedProgress.carry && typeof loadedProgress.carry === 'object' ? loadedProgress.carry : null
};

const audio = new AudioManager();
audio.setEnabled(prefs.sound !== false);

// ------------------------------------------------------------------ world and view
const view = createView(kit);
let world = new GameWorld({ palace: 'hollow', difficulty: prefs.difficulty }); // the title backdrop
view.setWorld(world);
let runActive = false;
let mode = 'title';

ui.badge.textContent = kit.backendLabel;
ui.badge.classList.add('ready');
kit.touch?.setShown('interact', false);

const FIXED = 1 / 60;
let accumulator = 0;
let hitStop = 0;
let toastUntil = 0;
const pending = { jump: false, attack: false, magic: false, interact: false };
const state = { moveX: 0, guardHeld: false, jumpPressed: false, attackPressed: false, magicPressed: false, interactPressed: false };
const clearPending = () => {
  pending.jump = pending.attack = pending.magic = pending.interact = false;
};
// HUD cache and menu-navigation state, declared before any function that touches them runs.
let hudCache = Object.create(null);
let navEl = null;
let navScope = null;
let navKey = '';
let navWait = 0;
let menuOpenedAt = 0;
let saveQueued = false;
let controlsMode = '';

function saveRun() {
  if (!runActive || world.complete) return;
  store('run', world.snapshot());
}

function beginRun(next, continued = false) {
  world = next;
  view.setWorld(world);
  runActive = true;
  accumulator = 0;
  hitStop = 0;
  clearPending();
  hudCache = Object.create(null);
  audio.resume();
  audio.setTheme(world.level.id);
  world.start(continued);
  processEvents();
  if (world.pausedForUpgrade) showLevelUp(world.player.level);
  else setMode('play');
  saveRun();
}

function newRun(palace) {
  const carry = palace === 'undercroft' ? progress.carry : null;
  beginRun(new GameWorld({ palace, difficulty: prefs.difficulty, carry }));
}

function continueRun() {
  const restored = GameWorld.fromSnapshot(load('run', null));
  if (restored) beginRun(restored, true);
  else {
    store('run', null);
    refreshTitle();
  }
}

// ------------------------------------------------------------------ modes and menus

function setMode(next) {
  mode = next;
  ui.start.classList.toggle('hidden', next !== 'title');
  ui.pause.classList.toggle('hidden', next !== 'paused');
  ui.level.classList.toggle('hidden', next !== 'levelup');
  ui.complete.classList.toggle('hidden', next !== 'complete');
  ui.hud.classList.toggle('hidden', next === 'title');
  ui.pauseButton.classList.toggle('hidden', next !== 'play');
  if (next === 'title') {
    ui.bossHud.classList.remove('show');
    ui.prompt.classList.remove('show');
  }
  kit.touch?.suspend(next !== 'play', 'game');
  audio.setPaused(next === 'paused' || kit.menu.isOpen);
  menuOpenedAt = performance.now();
  if (navEl) navEl.classList.remove('pad-focus');
  navEl = null;
  navScope = null;
  input.settle();
  if (next === 'play') {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
    kit.canvas.focus?.({ preventScroll: true });
  }
}

function openPause() {
  if (mode !== 'play') return;
  const p = world.player;
  ui.pausePalace.textContent = world.level.name.toUpperCase();
  ui.pauseStats.textContent = `${world.objective} · ${formatTime(world.time)} · Level ${p.level} · ${p.deaths} restore${p.deaths === 1 ? '' : 's'} · ${world.diff.label}`;
  setMode('paused');
  audio.play('menu');
  saveRun();
}

function resume() {
  if (mode === 'paused') setMode('play');
}

function goTitle() {
  saveRun();
  runActive = false;
  refreshTitle();
  setMode('title');
}

function refreshTitle() {
  const snap = load('run', null);
  const ok = snap && snap.v === 1 && PALACE_NAMES[snap.palace];
  ui.continueButton.classList.toggle('hidden', !ok);
  if (ok) {
    const where = snap.checkpoint?.name ? ` · ${snap.checkpoint.name}` : '';
    ui.continueButton.textContent = `Continue — ${PALACE_NAMES[snap.palace]}${where}`;
  }
  ui.continueButton.toggleAttribute('data-default', !!ok);
  ui.startButton.toggleAttribute('data-default', !ok);
  ui.undercroftButton.classList.toggle('hidden', !progress.cleared.hollow);
  for (const b of document.querySelectorAll('[data-difficulty]')) {
    const on = b.dataset.difficulty === prefs.difficulty;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('is-on', on);
  }
  const diff = DIFFICULTIES[prefs.difficulty];
  const best = (id) => {
    const t = progress.best[`${id}:${diff.id}`];
    return Number.isFinite(t) ? formatTime(t) : '—';
  };
  const lines = [`Best on ${diff.label}: Hollow Palace ${best('hollow')}`];
  if (progress.cleared.hollow) lines.push(`Ember Undercroft ${best('undercroft')}`);
  ui.records.textContent = lines.join(' · ');
}

function syncSoundButtons() {
  for (const b of document.querySelectorAll('.js-sound')) b.textContent = `Sound: ${audio.enabled ? 'On' : 'Off'}`;
}

// ------------------------------------------------------------------ level-up and results
function showLevelUp(level) {
  ui.levelNumber.textContent = level;
  $('upgrade-attack-value').textContent = `Sword ${world.attackDamage} → ${world.attackDamage + 3}`;
  $('upgrade-vitality-value').textContent = `Max HP ${world.maxHp} → ${world.maxHp + 20}`;
  $('upgrade-focus-value').textContent = `Max energy ${world.maxMana} → ${world.maxMana + 20}`;
  setMode('levelup');
}

function chooseUpgrade(stat) {
  if (mode !== 'levelup') return;
  if (!world.chooseUpgrade(stat)) return;
  processEvents(); // a second banked level re-opens this screen with fresh numbers
  if (!world.pausedForUpgrade && mode === 'levelup') setMode('play');
}

function rankFor(w) {
  const d = w.player.deaths;
  const par = w.level.parTime;
  if (d === 0 && w.time <= par) return 'S';
  if (d <= 1 && w.time <= par * 1.5) return 'A';
  if (d <= 3) return 'B';
  return 'C';
}

function showComplete() {
  const p = world.player;
  const id = world.level.id;
  const diff = world.diff;
  const key = `${id}:${diff.id}`;
  const prev = progress.best[key];
  const record = !Number.isFinite(prev) || world.time < prev;
  if (record) progress.best[key] = world.time;
  progress.cleared[id] = true;
  if (id === 'hollow') progress.carry = world.carryStats();
  store('progress', progress);
  store('run', null);
  runActive = false;

  const extra = id === 'hollow'
    ? (world.gearCollected ? 'Ember Edge found' : 'base blade clear')
    : (world.vesselCollected ? 'Vessel of Embers found' : 'vessel left behind');
  ui.completeEyebrow.textContent = id === 'undercroft' ? 'BOTH PALACES RESTORED' : 'PALACE CLEARED';
  ui.completeTitle.textContent = `${world.level.relic} claimed`;
  ui.completeStats.textContent = `Time ${formatTime(world.time)} · Level ${p.level} · ${p.deaths} checkpoint restore${p.deaths === 1 ? '' : 's'} · ${extra} · Rank ${rankFor(world)}`;
  ui.completeRecord.textContent = record ? `New best time on ${diff.label}!` : `Best on ${diff.label}: ${formatTime(prev)}`;
  ui.nextPalace.classList.toggle('hidden', id !== 'hollow');
  ui.nextPalace.toggleAttribute('data-default', id === 'hollow');
  $('complete-restart').toggleAttribute('data-default', id !== 'hollow');
  setMode('complete');
}

// ------------------------------------------------------------------ events and feedback

function processEvents() {
  for (const ev of world.drainEvents()) {
    switch (ev.type) {
      case 'sound': audio.play(ev.name); break;
      case 'burst': view.spawnBurst(ev); break;
      case 'toast': showToast(ev.text, ev.long ? 4.8 : 2.8); break;
      case 'checkpoint': showToast(ev.text, 2.4); break;
      case 'levelup': showLevelUp(ev.level); break;
      case 'complete': showComplete(); break;
      case 'impact': impact(ev); break;
      case 'shake':
        view.shake(ev.power);
        input.rumble(Math.min(1, 0.4 + ev.power * 0.5), 150);
        break;
      case 'save': saveQueued = true; break;
      default: break;
    }
  }
  if (saveQueued) {
    saveQueued = false;
    saveRun();
  }
}

function impact(ev) {
  if (ev.kind === 'hit') {
    // A few frames of hit-stop sell the sword connecting.
    hitStop = Math.max(hitStop, ev.power > 0.5 ? 0.07 : 0.045);
    view.shake(ev.power * 0.6);
    input.rumble(0.3 + ev.power * 0.4, 70);
  } else if (ev.kind === 'hurt') {
    view.shake(ev.power);
    input.rumble(0.85, 170);
    ui.flash.animate?.([{ opacity: 0.55 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
  } else {
    view.shake(ev.power * 0.5);
    input.rumble(0.3, 60);
  }
}

function showToast(text, seconds = 2.8) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() / 1000 + seconds;
}

// ------------------------------------------------------------------ HUD (DOM writes only on change)
const changed = (key, value) => {
  if (hudCache[key] === value) return false;
  hudCache[key] = value;
  return true;
};
const setText = (key, el, value) => {
  if (changed(key, value)) el.textContent = value;
};
const setBar = (key, el, frac) => {
  const v = Math.round(clamp(frac, 0, 1) * 1000) / 10;
  if (changed(key, v)) el.style.width = `${v}%`;
};

function actionLabel() {
  if (input.source === 'gamepad') return 'Y';
  if (input.source === 'touch' || kit.touch?.visible) return 'ACTION';
  return 'E';
}

function updateUi() {
  if (toastUntil && performance.now() / 1000 > toastUntil) {
    ui.toast.classList.remove('show');
    toastUntil = 0;
  }
  if (mode === 'title') return;
  const p = world.player;
  setBar('hp', ui.hpFill, p.hp / world.maxHp);
  setBar('mp', ui.mpFill, p.mana / world.maxMana);
  setBar('xp', ui.xpFill, p.xp / world.xpToNext);
  // Compare numbers first; strings are only built when something changed.
  const hp = Math.max(0, Math.ceil(p.hp));
  const maxHp = world.maxHp;
  if (changed('hpN', hp * 10000 + maxHp)) ui.hpText.textContent = `${hp}/${maxHp}`;
  const mp = Math.ceil(p.mana);
  const maxMp = world.maxMana;
  if (changed('mpN', mp * 10000 + maxMp)) ui.mpText.textContent = `${mp}/${maxMp}`;
  if (changed('lv', p.level)) ui.levelText.textContent = `LV ${p.level}`;
  setText('palace', ui.palaceName, world.level.name);
  setText('objective', ui.objective, world.objective);
  if (changed('gear', p.swordTier * 10 + p.vessels)) ui.gearText.textContent = `${p.swordTier > 1 ? 'Ember Edge' : 'Palace Blade'}${p.vessels ? ' · Vessel of Embers' : ''}`;
  if (changed('time', Math.floor(world.time))) ui.runTime.textContent = formatTime(world.time);

  const prompt = mode === 'play' ? world.interactionPrompt() : '';
  const label = prompt ? `${actionLabel()} · ${prompt}` : '';
  if (changed('prompt', label)) {
    ui.prompt.textContent = label;
    ui.prompt.classList.toggle('show', Boolean(label));
  }
  if (changed('promptShown', Boolean(prompt))) kit.touch?.setShown('interact', Boolean(prompt));

  const boss = world.boss;
  const showBoss = Boolean(boss?.alive && world.bossFight);
  if (changed('bossShow', showBoss)) ui.bossHud.classList.toggle('show', showBoss);
  setText('bossName', ui.bossName, world.level.boss.name);
  if (showBoss) setBar('boss', ui.bossFill, boss.hp / boss.maxHp);
}

// ------------------------------------------------------------------ controls help
const CONTROLS = {
  keyboard: '<b>Keyboard</b> A/D or ←/→ move · Space, W or ↑ jump · J/X or click slash · hold K/Shift or right-click guard · Q/C spark · E/Enter action · wheel or Z zoom · Esc/P pause',
  gamepad: '<b>Controller</b> stick or D-pad move · A jump · X/RT slash · hold B/LT guard · RB spark · Y action · LB zoom · Start pause',
  touch: '<b>Touch</b> left thumb moves · JUMP · SLASH · hold GUARD · SPARK · ACTION appears near chests, gates and slates · pinch to zoom · II pauses'
};
function syncControls() {
  const m = input.source === 'gamepad' ? 'gamepad' : input.source === 'touch' || kit.touch?.visible ? 'touch' : 'keyboard';
  if (m === controlsMode) return;
  controlsMode = m;
  document.body.dataset.input = m;
  for (const el of document.querySelectorAll('.js-controls')) el.innerHTML = CONTROLS[m];
  hudCache.prompt = undefined; // re-label the action prompt
}
input.onSourceChange(syncControls);
syncControls();

// ------------------------------------------------------------------ gamepad / keyboard menu navigation
// D-pad, stick or arrows move a highlight, A or Enter picks, B / Esc goes back. A button
// focused this way keeps Enter and Space for itself (a native click), so nothing fires twice.
const NAV_SEL = 'button:not([disabled])';

function menuScope() {
  if (kit.menu.isOpen) return null;
  if (mode === 'title') return ui.start;
  if (mode === 'paused') return ui.pause;
  if (mode === 'levelup') return ui.level;
  if (mode === 'complete') return ui.complete;
  return null;
}
const usable = (el) => el && el.isConnected && !el.disabled && !el.closest('.hidden');
const navItems = (scope) => [...scope.querySelectorAll(NAV_SEL)].filter(usable);
const navDefault = (scope) => [...scope.querySelectorAll('[data-default]')].find(usable) || navItems(scope)[0] || null;

function navSet(el) {
  if (navEl && navEl !== el) navEl.classList.remove('pad-focus');
  navEl = el;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.classList.toggle('pad-focus', input.source === 'gamepad');
  el.scrollIntoView?.({ block: 'nearest' });
}

function navMove(scope, dx, dy) {
  const items = navItems(scope);
  if (!items.length) return;
  const cur = items.includes(document.activeElement) ? document.activeElement : items.includes(navEl) ? navEl : null;
  if (!cur) {
    navSet(navDefault(scope));
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
    navSet(best);
    audio.play('menu');
  } else if (dy) navSet(dy > 0 ? items[0] : items[items.length - 1]); // wrap top/bottom
}

function menuInput(dt) {
  const scope = menuScope();
  if (!scope) return;
  if (scope !== navScope || !usable(navEl)) {
    navScope = scope;
    navKey = '';
    navSet(navDefault(scope));
  } else if (input.source === 'gamepad' && !navEl.classList.contains('pad-focus')) navEl.classList.add('pad-focus');
  const mv = input.vector('move');
  const dx = mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  const dy = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : 0; // screen y grows downward
  const keyDir = dx || dy ? `${dx},${dy}` : '';
  if (!keyDir) navKey = '';
  else if (keyDir !== navKey || (navWait -= dt) <= 0) {
    navWait = keyDir === navKey ? 0.14 : 0.38;
    navKey = keyDir;
    navMove(scope, dy ? 0 : dx, dy);
  }
  if (input.pressed('confirm') && performance.now() - menuOpenedAt > 180) (navEl || navDefault(scope))?.click();
}

// ------------------------------------------------------------------ the loop
function playFrame(dt) {
  if (input.pressed('pause')) {
    openPause();
    return;
  }
  if (input.pressed('jump')) pending.jump = true;
  if (input.pressed('attack')) pending.attack = true;
  if (input.pressed('magic')) pending.magic = true;
  if (input.pressed('interact')) pending.interact = true;
  if (input.pressed('zoom')) view.cycleZoom();
  const z = input.zoom();
  if (z) view.adjustZoom(z);
  state.moveX = input.vector('move').x;
  state.guardHeld = input.down('guard');

  if (hitStop > 0) {
    hitStop -= dt;
    return;
  }
  // Fixed 60 Hz simulation. Presses wait in `pending` until a step consumes them, so a tap
  // on a 144 Hz display (frames with no step) is never lost.
  accumulator = Math.min(accumulator + dt, 0.12);
  while (accumulator >= FIXED) {
    state.jumpPressed = pending.jump;
    state.attackPressed = pending.attack;
    state.magicPressed = pending.magic;
    state.interactPressed = pending.interact;
    world.update(FIXED, state);
    clearPending();
    accumulator -= FIXED;
    if (world.pausedForUpgrade || world.complete) {
      accumulator = 0;
      break;
    }
  }
  processEvents();
}

kit.start((dt, t) => {
  if (mode === 'play') playFrame(dt);
  else {
    if (mode === 'paused' && (input.pressed('pause') || input.pressed('back'))) resume();
    else menuInput(dt);
  }
  audio.setTheme(world.bossFight && !world.bossDefeated ? 'boss' : world.level.id);
  if (mode !== 'title') audio.update();
  view.render(world, dt, t);
  updateUi();
});

// ------------------------------------------------------------------ DOM wiring
ui.startButton.addEventListener('click', () => newRun('hollow'));
ui.continueButton.addEventListener('click', continueRun);
ui.undercroftButton.addEventListener('click', () => newRun('undercroft'));
ui.pauseButton.addEventListener('click', openPause);
$('resume-button').addEventListener('click', resume);
$('retry-button').addEventListener('click', () => {
  world.restartFromCheckpoint();
  processEvents();
  setMode('play');
});
$('quit-button').addEventListener('click', goTitle);
$('title-settings').addEventListener('click', () => kit.menu.open());
$('pause-settings').addEventListener('click', () => kit.menu.open());
ui.nextPalace.addEventListener('click', () => newRun('undercroft'));
$('complete-restart').addEventListener('click', () => newRun(world.level.id));
$('complete-to-title').addEventListener('click', goTitle);
for (const b of document.querySelectorAll('.js-sound')) {
  b.addEventListener('click', () => {
    audio.toggle();
    prefs.sound = audio.enabled;
    savePrefs();
    syncSoundButtons();
  });
}
for (const b of document.querySelectorAll('[data-difficulty]')) {
  b.addEventListener('click', () => {
    prefs.difficulty = b.dataset.difficulty;
    savePrefs();
    refreshTitle();
    audio.play('menu');
  });
}
for (const b of document.querySelectorAll('[data-upgrade]')) {
  b.addEventListener('click', () => chooseUpgrade(b.dataset.upgrade));
}

// Pause when the window loses focus or the tab hides; keep the run saved.
addEventListener('blur', () => {
  if (mode === 'play') openPause();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (mode === 'play') openPause();
  saveRun();
});
addEventListener('pagehide', saveRun);
kit.onPause((paused) => audio.setPaused(paused || mode === 'paused'));
// Browsers may start audio suspended (or suspend it later): any gesture during a run wakes it.
const wakeAudio = () => {
  if (mode !== 'title' && !audio.paused) audio.resume();
};
addEventListener('pointerdown', wakeAudio, true);
addEventListener('keydown', wakeAudio, true);

$('game-title').textContent = GAME_TITLE;
syncSoundButtons();
refreshTitle();
setMode('title');
