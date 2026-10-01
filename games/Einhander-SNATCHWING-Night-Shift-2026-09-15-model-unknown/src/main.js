// SNATCHWING: NIGHT SHIFT — boot, scene, input, menus, HUD and the frame loop.
// Original code, art and procedural audio; now on the shared three.js r186 stack.

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { readSave, save } from './util.js';
import { audio } from './audio.js';
import { buildAtlas, makeMaterials, U, MAT, mesh, shipModel, enemyGeo, gunGeo, repairGeo, miniModel, walkerModel, dredgeModel, buildScenery } from './world.js';
import { S, W, FOV, DIFFICULTY, ROUTES } from './state.js';
import { updateGame, updateCity, updateEffects, resetRun, parkShip, grab, flip, pulse, spawn, drop, spawnBoss, hurt, nearestPickup } from './game.js';
import { initDraw, resizeDraw, setView, drawEffects, unproject, batches } from './draw.js';

// The old renderer wrote its colours straight to the screen: no colour management.
THREE.ColorManagement.enabled = false;

const $ = (id) => document.getElementById(id);
const frame = $('frame');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pad7 = (n) => String(Math.max(0, Math.floor(n))).padStart(7, '0');
const RANKS = ['S', 'A', 'B', 'C'];

// ---------------------------------------------------------------- saved choices
S.route = readSave('route', 0) === 1 ? 1 : 0;
S.difficulty = DIFFICULTY[readSave('difficulty', 'arcade')] ? readSave('difficulty', 'arcade') : 'arcade';
let crt = readSave('crt', true) !== false;

// ---------------------------------------------------------------- boot
const kit = await boot({
  title: 'SNATCHWING — Night Shift',
  mount: frame,
  gear: 'none', // the header and the pause menu have a Settings button
  accent: '#91f6d0',
  background: '#080d12',
  touch: { top: 'right', topOffset: 70 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    fire: { keys: ['Space', 'KeyZ', 'KeyJ'], mouse: [0], gamepad: ['A', 'RT'], touch: 'FIRE' },
    grab: { keys: ['KeyE'], mouse: [2], gamepad: ['B'], touch: 'TAKE' },
    flip: { keys: ['KeyX'], gamepad: ['X'], touch: 'FLIP' },
    pulse: { keys: ['KeyC'], gamepad: ['Y'], touch: 'PULSE' },
    focus: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LB', 'LT'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    fly: { mouse: [0] }, // hold the left button: the ship flies to the cursor (and fires)
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
    mute: { keys: ['KeyM'] },
    full: { keys: ['KeyF'] },
    restart: { keys: ['KeyR'] },
  },
});
const { renderer, input } = kit;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// ---------------------------------------------------------------- scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.027, 0.057, 0.084);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 180));
camera.position.set(1.4, 2, 33.5);
scene.add(camera);

kit.loading.progress(0.7, 'Painting the city…');
const { atlas, moon } = buildAtlas();
makeMaterials(atlas.texture, moon);
const scenery = buildScenery(scene);
S.scenery = scenery;
const actors = new THREE.Group();
actors.name = 'actors';
scene.add(actors);
S.actors = actors;
const ship = shipModel();
actors.add(ship);
S.playerNode = ship;
S.player = { x: -11, y: 0, hp: 4, maxHP: 4, lives: 3, inv: 0, respawn: 0, dead: false, upper: false, armAngle: 0, weapon: 'RIVET', ammo: 240, maxAmmo: 300, fireCD: 0, podCD: 0, vx: 0, vy: 0 };
initDraw(camera, $('fx'));

// Compile every pipeline now (both routes, the hit-flash material, the effect layer), so
// the first explosion or the harbor never stutters.
{
  kit.loading.progress(0.85, 'Warming up…');
  const warm = new THREE.Group();
  warm.add(mesh(enemyGeo('dart'), MAT.flash), mesh(repairGeo()), miniModel(), walkerModel(), dredgeModel(), mesh(gunGeo('SCATTER')));
  warm.position.set(0, 0, -30);
  scene.add(warm);
  scenery.city.visible = scenery.harbor.visible = true;
  for (const b of batches) b.mesh.count = 1;
  try {
    await renderer.compileAsync(scene, camera);
  } catch (err) {
    console.warn('pipeline warm-up skipped', err);
  }
  for (const b of batches) b.mesh.count = 0;
  scene.remove(warm);
}

// ---------------------------------------------------------------- sizing
const fxCanvas = $('fx');
const shade = $('shade');
const scan = $('scan');
function layoutOverlays() {
  const r = frame.getBoundingClientRect();
  if (!r.width) return;
  const k = r.width / W; // CSS pixels per logical pixel
  // The old overlay's vignette and scanlines, as static CSS (no per-frame cost).
  const r0 = S.H * 0.17 * k;
  const r1 = W * 0.62 * k;
  const mid = r0 + 0.45 * (r1 - r0);
  shade.style.background = `radial-gradient(circle ${r1.toFixed(1)}px at 50% 48%, rgba(2,7,12,0) ${mid.toFixed(1)}px, rgba(2,7,12,.48) ${r1.toFixed(1)}px)`;
  scan.style.background = `repeating-linear-gradient(to bottom, rgba(0,0,0,.0455) 0, rgba(0,0,0,.0455) ${k.toFixed(2)}px, transparent ${k.toFixed(2)}px, transparent ${(3 * k).toFixed(2)}px)`;
  // The touch pause pill sits under the hull gauge, at the frame's top right.
  kit.touch?.placeTop('right', Math.round(Math.max(10, r.top + 62)));
}
kit.onResize((w, h) => {
  S.aspect = w / Math.max(1, h);
  S.H = Math.max(1, Math.round(W / S.aspect));
  S.camDist = 33.5 * Math.max(1, 16 / 9 / S.aspect);
  if (fxCanvas.width !== W || fxCanvas.height !== S.H) {
    fxCanvas.width = W;
    fxCanvas.height = S.H;
  }
  resizeDraw();
  layoutOverlays();
});
addEventListener('resize', layoutOverlays);
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
  setTimeout(layoutOverlays, 80);
});

// ---------------------------------------------------------------- prompts for the device in hand
const PROMPTS = {
  keyboard: { move: 'WASD', fire: 'SPACE', grab: 'E', flip: 'X', pulse: 'C', pause: 'ESC', focus: 'SHIFT' },
  gamepad: { move: 'L-STICK', fire: 'A', grab: 'B', flip: 'X', pulse: 'Y', pause: 'START', focus: 'LB' },
  touch: { move: 'STICK', fire: 'FIRE', grab: 'TAKE', flip: 'FLIP', pulse: 'PULSE', pause: 'II', focus: '—' },
};
const MANUAL = {
  keyboard: { move: 'WASD / ↑↓←→', fire: 'SPACE / Z', grab: 'E', flip: 'X', pulse: 'C', pause: 'ESC / P', focus: 'SHIFT' },
  gamepad: { move: 'L-STICK / D-PAD', fire: 'A / RT', grab: 'B', flip: 'X', pulse: 'Y', pause: 'START', focus: 'LB / LT' },
  touch: { move: 'STICK', fire: 'FIRE', grab: 'TAKE', flip: 'FLIP', pulse: 'PULSE', pause: 'II', focus: 'the stick part-way' },
};
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;

// ---------------------------------------------------------------- HUD
const els = {};
for (const id of ['score', 'bestScore', 'chain', 'chainFill', 'hull', 'reserve', 'weaponName', 'weaponIcon', 'ammo', 'ammoMax', 'ammoFill', 'armMode', 'pulseCharge', 'pulseHud', 'pulseHint', 'bossPercent', 'bossFill', 'bossPhase']) els[id] = $(id);
const cache = new Map();
const setText = (id, v) => {
  if (cache.get(id) !== v) {
    cache.set(id, v);
    els[id].textContent = v;
  }
};
const setWidth = (id, pct) => {
  const v = Math.max(0, Math.min(100, pct)).toFixed(1) + '%';
  if (cache.get(id) !== v) {
    cache.set(id, v);
    els[id].style.width = v;
  }
};
let bestCache = 0;
function refreshBest() {
  bestCache = Number(readSave(ROUTES[S.route].bestKey, 0)) || 0;
}
refreshBest();
function updateHUD() {
  const pl = S.player;
  setText('score', pad7(S.score));
  setText('bestScore', pad7(S.continues ? bestCache : Math.max(bestCache, S.score)));
  setText('chain', '×' + S.chainLevel);
  setWidth('chainFill', (S.chainTimer / 3.7) * 100);
  const hullKey = pl.hp + '/' + pl.maxHP;
  if (cache.get('hull') !== hullKey) {
    cache.set('hull', hullKey);
    let html = '';
    for (let i = 0; i < pl.maxHP; i++) html += '<i' + (i >= pl.hp ? ' class="empty"' : '') + '></i>';
    els.hull.innerHTML = html;
  }
  setText('reserve', 'RESERVE SHIPS / ' + String(Math.max(0, pl.lives - 1)).padStart(2, '0'));
  const armed = pl.ammo > 0;
  setText('weaponName', armed ? pl.weapon : 'MAIN GUN');
  setText('weaponIcon', armed ? pl.weapon[0] : '∞');
  setText('ammo', armed ? String(pl.ammo).padStart(3, '0') : 'UNLIMITED');
  setText('ammoMax', armed ? '/ ' + pl.maxAmmo : '');
  setWidth('ammoFill', armed ? (pl.ammo / pl.maxAmmo) * 100 : 100);
  setText('armMode', 'ARM / ' + (pl.upper ? 'UPPER' : 'LOWER'));
  const charge = Math.floor(S.energy);
  setText('pulseCharge', String(charge));
  const ready = S.energy >= 100;
  if (cache.get('ready') !== ready) {
    cache.set('ready', ready);
    els.pulseHud.classList.toggle('ready', ready);
  }
  setText('pulseHint', ready ? `[${prompts().pulse}] CLEAR ENEMY FIRE` : 'CHARGE / ' + charge + '%');
  if (kit.touch?.visible) touchFeedback(ready, charge);
  const boss = S.boss;
  if (boss && !boss.dead) {
    const p = Math.max(0, Math.min(100, (boss.hp / boss.maxHP) * 100));
    setText('bossPercent', Math.ceil(p) + '%');
    setWidth('bossFill', p);
    setText('bossPhase', 'PHASE 0' + boss.phase + ' / ' + (boss.phase === 1 ? 'INTERCEPT' : 'WEAPONS OVERDRIVE'));
  }
}

/**
 * On touch the pulse gauge is hidden under the buttons, so the PULSE button carries the
 * charge itself, and TAKE lights up only while a pod is within the arm's reach.
 */
function touchFeedback(ready, charge) {
  const label = ready ? 'PULSE' : charge + '%';
  if (cache.get('touchPulse') !== label) {
    cache.set('touchPulse', label);
    kit.touch.setLabel('pulse', label);
    const b = kit.touch.button('pulse');
    if (b) b.style.opacity = ready ? '' : '0.55';
  }
  const reach = !!nearestPickup() && !S.player.dead;
  if (cache.get('touchTake') !== reach) {
    cache.set('touchTake', reach);
    const b = kit.touch.button('grab');
    if (b) b.style.opacity = reach ? '' : '0.55';
  }
}

function show(id, on) {
  $(id).classList.toggle('visible', !!on);
}
function announcer(text) {
  $('announcer').textContent = text;
}
let radioTime = 0;
let bannerTime = 0;

let takeLabel = '[E] TAKE / ';
function applyPrompts() {
  const P = prompts();
  const Mn = MANUAL[input.source] || MANUAL.keyboard;
  for (const el of document.querySelectorAll('[data-k]')) el.textContent = P[el.dataset.k];
  for (const el of document.querySelectorAll('[data-m]')) el.textContent = Mn[el.dataset.m];
  takeLabel = input.source === 'touch' ? 'TAKE / ' : `[${P.grab}] TAKE / `;
  cache.delete('pulseHint');
  if (S.mode === 'play' || S.mode === 'pause') updateHUD();
}
input.onSourceChange(applyPrompts);

// ---------------------------------------------------------------- hooks the simulation calls
S.ui = {
  radio(text, who = 'CONTROL', time = 4.5) {
    $('radioName').textContent = who;
    $('radioText').textContent = text;
    radioTime = time;
    show('radio', true);
    announcer(text);
  },
  banner(title, small, sub, duration = 3, warning = false) {
    $('bannerTitle').textContent = title;
    $('bannerSmall').textContent = small;
    $('bannerSub').textContent = sub;
    $('bannerTitle').classList.toggle('warning', warning);
    $('bannerSmall').classList.toggle('warning', warning);
    bannerTime = duration;
    show('banner', true);
    announcer(title);
  },
  bossHud(name) {
    if (name) {
      $('bossName').textContent = name;
      cache.delete('bossFill');
      cache.delete('bossPercent');
    }
    show('bossHud', !!name);
  },
  sector(n) {
    $('stageNo').textContent = '0' + (n + 1) + ' /';
    $('routeLabel').textContent = ROUTES[S.route].sectors[n];
  },
  tick(dt) {
    if (radioTime > 0) {
      radioTime -= dt;
      if (radioTime <= 0) show('radio', false);
    }
    if (bannerTime > 0) {
      bannerTime -= dt;
      if (bannerTime <= 0) show('banner', false);
    }
  },
  prompt(action) {
    const P = prompts();
    return input.source === 'touch' ? `Tap ${P[action]}` : `Press ${P[action]}`;
  },
  hud: updateHUD,
  rumble: (strength, ms) => input.rumble(strength, ms),
  finish: (won) => finish(won),
};

// ---------------------------------------------------------------- modes
function focusButton(id) {
  $(id)?.focus({ preventScroll: true });
}
function focusGame() {
  kit.canvas.focus({ preventScroll: true });
}
function statusLive() {
  $('statusLabel').textContent = DIFFICULTY[S.difficulty].label + ' MODE / LIVE';
}
function applyRoute() {
  scenery.city.visible = S.route === 0;
  scenery.harbor.visible = S.route === 1;
}

let continueSector = 0;
function start(sectorIndex = 0) {
  audio.init();
  if (!sectorIndex) S.continues = 0;
  S.mode = 'play';
  applyRoute();
  refreshBest();
  audio.song = S.route;
  audio.step = 0;
  if (audio.ctx) audio.next = audio.ctx.currentTime + 0.07;
  resetRun(sectorIndex);
  for (const id of ['menu', 'manual', 'pause', 'result', 'bossHud', 'radio', 'banner']) show(id, false);
  radioTime = bannerTime = 0;
  show('hud', true);
  frame.classList.add('playing');
  S.ui.sector(sectorIndex);
  statusLive();
  if (!sectorIndex) S.ui.banner(...ROUTES[S.route].intro, 2.6);
  else S.ui.radio('Replacement Magpie on station. Sector ' + (sectorIndex + 1) + '. Score reset.', 'CONTROL', 3.5);
  kit.touch?.suspend(false, 'game');
  input.settle();
  focusGame();
  cache.clear();
  updateHUD();
}

function pause() {
  if (S.mode === 'play') {
    S.mode = 'pause';
    show('pause', true);
    $('statusLabel').textContent = 'FLIGHT ON HOLD';
    kit.touch?.suspend(true, 'game');
    holdNav();
    focusButton('resumeBtn');
  } else if (S.mode === 'pause') resume();
}

function resume() {
  if (S.mode !== 'pause') return;
  S.mode = 'play';
  show('pause', false);
  statusLive();
  kit.touch?.suspend(false, 'game');
  input.settle();
  focusGame();
}

function toMenu() {
  S.mode = 'menu';
  for (const id of ['hud', 'pause', 'result', 'manual', 'bossHud', 'banner', 'radio']) show(id, false);
  show('menu', true);
  frame.classList.remove('playing');
  parkShip();
  S.stage = 0;
  S.ui.sector(0);
  $('statusLabel').textContent = 'FLIGHT SYSTEM READY';
  kit.touch?.suspend(true, 'game');
  updateMenu();
  holdNav();
  focusButton('startBtn');
}

function finish(won) {
  S.mode = 'result';
  frame.classList.remove('playing');
  for (const id of ['hud', 'banner', 'radio', 'bossHud']) show(id, false);
  show('result', true);
  kit.touch?.suspend(true, 'game');
  input.settle();
  holdNav();
  const R = ROUTES[S.route];
  const pl = S.player;
  if (won) S.score += Math.round((pl.lives * 1500 + pl.hp * 250) * DIFFICULTY[S.difficulty].score);
  // A continued run starts from zero at a later sector: it plays out, but sets no records.
  const counts = !S.continues;
  const best = Number(readSave(R.bestKey, 0)) || 0;
  const isNew = counts && S.score > best;
  if (isNew) save(R.bestKey, S.score);
  const rank = won ? (S.hitsTaken <= 2 && S.maxChain >= 4 ? 'S' : S.hitsTaken <= 6 ? 'A' : S.hitsTaken <= 11 ? 'B' : 'C') : '—';
  if (won && counts) {
    const prev = readSave(R.rankKey, '');
    if (!RANKS.includes(prev) || RANKS.indexOf(rank) < RANKS.indexOf(prev)) save(R.rankKey, rank);
  }
  const place = S.route === 1 ? 'harbor' : 'city';
  $('resultEye').textContent = (won ? 'RAID COMPLETE' : 'FLIGHT SIGNAL LOST') + (S.continues ? ' / CONTINUED ×' + S.continues : '');
  $('resultTitle').textContent = won ? R.win[0] : 'ONE MORE RUN?';
  $('resultText').textContent = won ? R.win[1] : `The ${place} kept this ship. You have another chance.`;
  $('rank').textContent = rank;
  $('resultScoreLabel').textContent = isNew ? 'NEW FLIGHT RECORD' : counts ? 'FINAL SCORE' : 'FINAL SCORE / CONTINUED, NOT RECORDED';
  $('resultScore').textContent = pad7(S.score);
  $('resultKills').textContent = String(S.kills).padStart(2, '0');
  $('resultChain').textContent = '×' + S.maxChain;
  $('resultTime').textContent = String(Math.floor(S.elapsed / 60)).padStart(2, '0') + ':' + String(Math.floor(S.elapsed % 60)).padStart(2, '0');
  // Continue: a lost run that got past sector 01 can pick up at the sector it reached.
  continueSector = !won && S.stage > 0 ? S.stage : 0;
  const cont = $('contBtn');
  cont.hidden = !continueSector;
  cont.textContent = 'CONTINUE · SECTOR 0' + (continueSector + 1);
  $('statusLabel').textContent = won ? 'ROUTE CLEAR / FLIGHT COMPLETE' : 'NO FLIGHT SIGNAL';
  if (!won) audio.sfx('lose');
  refreshBest();
  focusButton('againBtn');
  announcer((won ? 'Raid complete. Final score ' : 'Flight lost. Final score ') + S.score);
}

function openManual() {
  S.manualBack = S.mode === 'pause' ? 'pause' : 'menu';
  S.mode = 'manual';
  show(S.manualBack, false);
  show('manual', true);
  holdNav();
  focusButton('manualClose');
}

function closeManual() {
  if (S.mode !== 'manual') return;
  S.mode = S.manualBack;
  show('manual', false);
  show(S.manualBack, true);
  holdNav();
  focusButton(S.manualBack === 'menu' ? 'startBtn' : 'resumeBtn');
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('footerHint').textContent = 'FULL SCREEN IS NOT AVAILABLE IN THIS VIEW.';
  }
}

// ---------------------------------------------------------------- menu choices
function updateSoundButton() {
  const b = $('soundBtn');
  b.classList.toggle('on', audio.enabled);
  b.classList.toggle('off', !audio.enabled);
  b.setAttribute('aria-pressed', String(audio.enabled));
  b.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound');
  $('soundWaves').style.opacity = audio.enabled ? '1' : '.2';
}
audio.onToggle = updateSoundButton;

function pick(ids, selectedId) {
  for (const id of ids) {
    $(id).classList.toggle('selected', id === selectedId);
    $(id).setAttribute('aria-pressed', String(id === selectedId));
  }
}
function setDifficulty(d) {
  S.difficulty = d;
  save('difficulty', d);
  pick(['arcadeBtn', 'storyBtn', 'veteranBtn'], d === 'assist' ? 'storyBtn' : d === 'veteran' ? 'veteranBtn' : 'arcadeBtn');
  audio.sfx('select');
}
function setRoute(i) {
  S.route = i;
  save('route', i);
  pick(['route0Btn', 'route1Btn'], 'route' + i + 'Btn');
  applyRoute();
  updateMenu();
  audio.sfx('select');
}
function updateMenu() {
  const R = ROUTES[S.route];
  refreshBest();
  $('menuRouteNo').textContent = '0' + (S.route + 1);
  $('menuRouteName').textContent = R.name;
  $('routeLabel').textContent = R.sectors[0];
  const rank = readSave(R.rankKey, '');
  $('menuBest').textContent = bestCache ? 'BEST ' + pad7(bestCache) + (RANKS.includes(rank) ? ' / RANK ' + rank : '') : 'ALL WEAPONS ACQUIRED ON SITE.';
}
function setCrt(on) {
  crt = on;
  save('crt', on);
  scan.classList.toggle('disabled', !on);
  $('crtBtn').classList.toggle('on', on);
  $('crtBtn').setAttribute('aria-pressed', String(on));
}

$('startBtn').onclick = () => start(0);
$('againBtn').onclick = () => start(0);
$('restartBtn').onclick = () => start(0);
$('contBtn').onclick = () => {
  if (!continueSector) return;
  S.continues++;
  start(continueSector);
};
$('resumeBtn').onclick = resume;
$('exitBtn').onclick = toMenu;
$('resultMenuBtn').onclick = toMenu;
$('manualBtn').onclick = openManual;
$('pauseManualBtn').onclick = openManual;
$('pauseSetBtn').onclick = () => kit.menu.open();
$('setBtn').onclick = () => kit.menu.open();
$('menuSetBtn').onclick = () => kit.menu.open();
$('manualClose').onclick = closeManual;
$('manualDone').onclick = closeManual;
$('arcadeBtn').onclick = () => setDifficulty('arcade');
$('storyBtn').onclick = () => setDifficulty('assist');
$('veteranBtn').onclick = () => setDifficulty('veteran');
$('route0Btn').onclick = () => setRoute(0);
$('route1Btn').onclick = () => setRoute(1);
$('soundBtn').onclick = () => {
  audio.init();
  audio.toggle();
};
$('fullBtn').onclick = fullscreen;
$('crtBtn').onclick = () => setCrt(!crt);

// Audio starts on the first key, click or tap anywhere (browsers block it before that).
const unlockAudio = () => {
  audio.init();
  removeEventListener('pointerdown', unlockAudio, true);
  removeEventListener('keydown', unlockAudio, true);
};
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

// Leaving the tab or the window pauses the raid; the settings panel holds the audio clock.
addEventListener('blur', () => {
  if (S.mode === 'play') pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'play') pause();
});
kit.onPause((paused) => {
  audio.hold(paused);
  if (paused && S.mode === 'play') pause();
});

// ---------------------------------------------------------------- menus with a gamepad or keys
const DEFAULT_BUTTON = { menu: 'startBtn', manual: 'manualDone', pause: 'resumeBtn', result: 'againBtn' };
const HOLD = 99;
let navDir = 0;
let navRepeat = 0;
/** After a screen change, ignore a stick or key still held until it returns to neutral. */
function holdNav() {
  navDir = HOLD;
}
function menuButtons() {
  const overlay = $(S.mode);
  if (!overlay) return [];
  return [...overlay.querySelectorAll('button')].filter((b) => !b.disabled && !b.hidden && b.offsetParent !== null);
}
function navStep(dir) {
  const list = menuButtons();
  if (!list.length) return;
  let i = list.indexOf(document.activeElement);
  i = i < 0 ? 0 : (i + dir + list.length) % list.length;
  list[i].focus({ preventScroll: true });
  audio.sfx('tick');
}
function navigate(dt) {
  const v = input.vector('move');
  const dir = Math.abs(v.y) >= Math.abs(v.x) ? (v.y > 0.5 ? -1 : v.y < -0.5 ? 1 : 0) : v.x > 0.5 ? 1 : v.x < -0.5 ? -1 : 0;
  if (!dir) {
    navDir = 0;
    return;
  }
  if (navDir === HOLD) return; // a stick still held from the last screen waits for neutral
  if (dir !== navDir) {
    navDir = dir;
    navRepeat = 0.38;
    navStep(dir);
  } else {
    navRepeat -= dt;
    if (navRepeat <= 0) {
      navRepeat = 0.14;
      navStep(dir);
    }
  }
}

// ---------------------------------------------------------------- input, once per frame
const mouseWorld = { x: 0, y: 0 };
function handleInput(dt) {
  if (input.pressed('mute')) {
    audio.init();
    audio.toggle();
  }
  if (input.pressed('full')) fullscreen();
  const mode = S.mode;
  const ctl = S.ctl;
  if (mode === 'play') {
    if (input.pressed('pause')) {
      pause();
      ctl.fire = ctl.mouse = false;
      return;
    }
    if (input.pressed('grab')) grab();
    if (input.pressed('flip')) flip();
    if (input.pressed('pulse')) pulse();
    const v = input.vector('move');
    ctl.x = v.x;
    ctl.y = v.y;
    ctl.fire = input.down('fire');
    ctl.focus = input.down('focus');
    const p = input.pointer;
    ctl.mouse = input.down('fly') && p.type === 'mouse' && p.down;
    if (ctl.mouse) {
      unproject((p.x / kit.size.width) * W, (p.y / kit.size.height) * S.H, mouseWorld);
      ctl.mx = mouseWorld.x;
      ctl.my = mouseWorld.y;
    }
    return;
  }
  ctl.x = ctl.y = 0;
  ctl.fire = ctl.focus = ctl.mouse = false;
  navigate(dt);
  if (input.pressed('confirm')) {
    const list = menuButtons();
    const target = list.includes(document.activeElement) ? document.activeElement : $(DEFAULT_BUTTON[mode]);
    target?.click();
    return;
  }
  if (input.pressed('back')) {
    if (mode === 'manual') closeManual();
    else if (mode === 'pause') resume();
    return;
  }
  if (input.pressed('pause')) {
    if (mode === 'pause') resume();
    else if (mode === 'manual') closeManual();
    else if ((mode === 'menu' || mode === 'result') && input.source === 'gamepad') start(0);
    return;
  }
  if (input.pressed('restart') && (mode === 'pause' || mode === 'result')) start(0);
}

// ---------------------------------------------------------------- the frame
function setFlash(e, on) {
  const mat = on ? MAT.flash : MAT.plain;
  const list = e.n.userData.flash;
  if (list) for (const m of list) m.material = mat;
  else e.n.material = mat;
}

function render() {
  const menuish = S.mode === 'menu' || (S.mode === 'manual' && S.manualBack === 'menu');
  const node = S.playerNode;
  if (menuish) {
    const t = S.menuTime;
    node.visible = true;
    node.position.set(6.6, 1.0 + Math.sin(t * 0.8) * 0.21, 3);
    node.scale.setScalar(2.05);
    node.rotation.set(0.13 + Math.sin(t * 0.26) * 0.07, -0.35 + Math.sin(t * 0.22) * 0.14, -0.035 + Math.sin(t * 0.43) * 0.015);
    node.userData.arm.rotation.x = 0.12;
  }
  const j = !reduced && S.mode === 'play' ? S.shake : 0;
  camera.position.set(1.4 + Math.sin(S.cityClock * 0.09) * 0.25 + (Math.random() - 0.5) * j, 2.0 + (Math.random() - 0.5) * j, S.camDist);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const fog = ROUTES[S.route].fog[menuish ? 0 : S.stage] || ROUTES[S.route].fog[0];
  U.fog.value.setRGB(fog[0], fog[1], fog[2]);
  for (const e of S.enemies) {
    const on = e.flash > 0 && !e.dead;
    if (on !== e.flashing) {
      e.flashing = on;
      setFlash(e, on);
    }
  }
  setView(camera, (kit.size.width * renderer.getPixelRatio()) / W);
  drawEffects(takeLabel);
  renderer.render(scene, camera);
}

let acc = 0;
let hudTick = 0;
const STEP = 1 / 60;
kit.start((dt) => {
  handleInput(dt);
  if (S.mode === 'play') {
    acc += dt;
    let loops = 0;
    while (acc >= STEP && loops++ < 7) {
      updateGame(STEP);
      updateCity(STEP);
      acc -= STEP;
      if (S.mode !== 'play') {
        acc = 0;
        break;
      }
    }
    hudTick -= dt;
    if (hudTick <= 0 && S.mode === 'play') {
      hudTick = 0.08;
      updateHUD();
    }
  } else {
    acc = 0;
    if (S.mode === 'menu' || S.mode === 'result' || (S.mode === 'manual' && S.manualBack === 'menu')) {
      S.menuTime += dt;
      updateCity(dt);
      updateEffects(dt);
    }
  }
  audio.update(S.mode === 'play');
  render();
});

// ---------------------------------------------------------------- first screen
updateSoundButton();
setDifficulty(S.difficulty);
setRoute(S.route);
setCrt(crt);
applyPrompts();
kit.touch?.suspend(true, 'game');
if (matchMedia('(pointer:coarse)').matches) $('footerHint').textContent = 'TURN PHONE SIDEWAYS FOR A WIDER VIEW.';
updateHUD();

// A local test interface, only with ?test=1 in the URL.
if (new URLSearchParams(location.search).has('test')) {
  window.__SWTEST = {
    start, pause, resume, menu: toMenu, finish, grab, flip, pulse, hurt, spawn, drop,
    route: setRoute,
    difficulty: setDifficulty,
    advance(seconds) {
      for (let i = 0; i < Math.ceil(seconds * 60); i++) {
        if (S.mode !== 'play') break;
        updateGame(STEP);
        updateCity(STEP);
      }
    },
    boss(type = 'walker') {
      for (const e of S.enemies) if (!e.isBoss) e.dead = true;
      S.bullets.length = 0;
      S.stage = type === 'mini' ? 0 : 2;
      S.stageTime = type === 'mini' ? 39 : 86;
      S.eventIndex = type === 'mini' ? S.events.findIndex((e) => e[0] === 42) : S.events.length;
      spawnBoss(type);
    },
    god(v) {
      S.testGod = !!v;
    },
    state() {
      const pl = S.player;
      return {
        mode: S.mode, route: S.route, stageTime: S.stageTime, stage: S.stage, score: S.score, kills: S.kills, chainLevel: S.chainLevel,
        energy: S.energy, difficulty: S.difficulty, player: { x: pl.x, y: pl.y, hp: pl.hp, lives: pl.lives, weapon: pl.weapon, ammo: pl.ammo },
        enemies: S.enemies.map((e) => ({ id: e.id, type: e.type, x: e.x, y: e.y, hp: e.hp })),
        pickups: S.pickups.map((p) => ({ type: p.type, x: p.x, y: p.y })),
        bullets: S.bullets.length, shots: S.shots.length,
        boss: S.boss ? { type: S.boss.type, hp: S.boss.hp, phase: S.boss.phase } : null,
      };
    },
  };
}
