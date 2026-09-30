/* ASHFALL — boot, menus, input, HUD, audio cues and the loop.
   Rules live in sim.js, art in art.js, drawing in view.js. Every control goes through
   kit.input actions: keyboard and mouse as the original, a controller (twin-stick aim),
   and touch (stick, skill buttons, tap to travel, drag and pinch the camera). */

import { boot } from 'kit/boot.js';
import { TOUCH_LOOK } from 'kit/input.js';
import { createView } from './view.js';
import { createAudio } from './audio.js';
import { buildWorld, STYLES, color as parseColor } from './art.js';
import { Simulation, OPERATIONS, opById, classes, clamp, dist, height, ENEMY_SCALE, SAPPER_RADIUS, SAPPER_FUSE } from './sim.js';

/* ------------------------------------------------------------------ storage */

const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode: nothing is kept */
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to remove */
    }
  },
};
const PREFS_KEY = 'ashfall.prefs.v1', SAVE_KEY = 'ashfall.save.v1', RECORDS_KEY = 'ashfall.records.v1';
const prefs = { hero: 0, difficulty: 'normal', op: 'citadel', sound: true };
{
  const saved = store.get(PREFS_KEY, {});
  if (saved && typeof saved === 'object') Object.assign(prefs, saved);
  prefs.hero = clamp(prefs.hero | 0, 0, 2);
  if (!['easy', 'normal', 'hard'].includes(prefs.difficulty)) prefs.difficulty = 'normal';
  prefs.op = opById(prefs.op).id;
  prefs.sound = prefs.sound !== false;
}

/* ------------------------------------------------------------------ boot */

const kit = await boot({
  title: 'ASHFALL — The Long Siege',
  canvas: document.getElementById('game'),
  gear: 'none', // Settings live in the main menu and the pause menu (and F9)
  accent: '#e9bd7b',
  background: '#132327',
  touch: { top: 'right', topOffset: 8 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    aim: { type: 'vector', gamepad: 'rightStick' },
    pan: { type: 'look', mouse: 'locked', gamepad: [], touch: 'drag' },
    skill1: { keys: ['KeyQ'], gamepad: ['X'], touch: 'Skill' },
    skill2: { keys: ['KeyE'], gamepad: ['B'], touch: 'Repair' },
    skill3: { keys: ['KeyR'], gamepad: ['Y'], touch: 'Strike' },
    dash: { keys: ['Space'], gamepad: ['A'], touch: 'Dash' },
    // Touch gets a Fire button only while auto fire is off (see syncFireButton).
    fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT'], touch: 'FIRE' },
    travel: { mouse: [2], gamepad: ['LT'] },
    drag: { mouse: [1] },
    sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    map: { keys: ['KeyM'], gamepad: ['RS'], touch: { label: 'Map', slot: 'top' } },
    hero: { gamepad: ['Back'], touch: { label: 'Hero', slot: 'top' } },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    hero1: { keys: ['Digit1', 'Numpad1'] },
    hero2: { keys: ['Digit2', 'Numpad2'] },
    hero3: { keys: ['Digit3', 'Numpad3'] },
    follow: { keys: ['KeyB'] },
    auto: { keys: ['KeyF'] },
    stop: { keys: ['KeyZ'] },
    help: { keys: ['KeyH'] },
    stats: { keys: ['KeyG'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
  },
});
const { input } = kit;
kit.loading.progress(0.65, 'Building the battlefield…');

const view = createView(kit);
const audio = createAudio(prefs.sound);

/* ------------------------------------------------------------------ DOM */

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const el = {
  menu: $('#menu'),
  hud: $('#hud'),
  modal: $('#modal'),
  modalBox: $('#modal-content'),
  toast: $('#toast'),
  toastB: $('#toast b'),
  toastS: $('#toast small'),
  help: $('#help-strip'),
  mapLabel: $('#map-mode-label'),
  mapHint: $('#map-mode-hint'),
  mapFoot: $('#map-foot'),
  cont: $('#continue'),
};
const overlay = $('#overlay'), octx = overlay.getContext('2d'), mini = $('#minimap'), mctx = mini.getContext('2d');
let dpr = 1;
kit.onResize((w, h) => {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  overlay.width = Math.round(w * dpr);
  overlay.height = Math.round(h * dpr);
});

/* ------------------------------------------------------------------ state */

let mode = 'menu'; // 'menu' | 'game'
let sim = null;
let selected = prefs.hero, difficulty = prefs.difficulty, opId = prefs.op;
let paused = false, modalKind = '', helpReturn = '', ending = null, endShown = false;
let clock = 0, accumulator = 0, hudClock = 0, lastSave = 0;
let zoom = 262, zoomGoal = 262, camX = -100, camZ = 0, camYaw = 0.45, elevation = 0.87, follow = true, overview = false;
let shake = 0, toastUntil = 0, helpUntil = 0, helpFaded = false, lastEvent = 0, showStats = false, waypoint = null;
let padAimT = 0, padSprint = false, mapCursor = null, dragLast = null, touchGesture = null, lastHurt = 0, lastHurtFx = 0, lastShotSound = 0, frameNo = 0;
let navFocused = null, navHeld = null, navRepeat = 0;
const aim = { x: 0, z: 0 };
const visuals = [], particles = [], embers = [], smooth = new Map(), hinted = new Set();
const playerInput = { mx: 0, mz: 0, ax: 0, az: 0, fire: false, sprint: false };
const tmpA = { x: 0, z: 0 }, tmpB = { x: 0, z: 0 }, proj = { x: 0, y: 0, visible: false };
const DIFF_NAMES = { easy: 'RELAXED', normal: 'STANDARD', hard: 'VETERAN' };
const pad = (n) => String(Math.max(0, n | 0)).padStart(2, '0');
const fmt = (t) => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}`;

/* ------------------------------------------------------------------ saves and records */

function savePrefs() {
  store.set(PREFS_KEY, { hero: selected, difficulty, op: opId, sound: audio.enabled });
}
function writeSave() {
  if (mode !== 'game' || !sim || sim.status !== 'active' || ending) return;
  store.set(SAVE_KEY, sim.toSave(selected));
  lastSave = sim.time;
}
function readSave() {
  const d = store.get(SAVE_KEY, null);
  return d && d.v === 1 && OPERATIONS.some((o) => o.id === d.op) ? d : null;
}
function clearSave() {
  store.del(SAVE_KEY);
}
function allRecords() {
  const r = store.get(RECORDS_KEY, {});
  return r && typeof r === 'object' ? r : {};
}
function recordFor(op, diff) {
  return allRecords()[`${op}:${diff}`] || null;
}
function recordResult(win) {
  const all = allRecords(), key = `${sim.op.id}:${sim.difficulty}`;
  const r = { wins: 0, plays: 0, bestTime: 0, bestKills: 0, bestWave: 0, ...(all[key] || {}) };
  let newBest = false;
  r.plays++;
  if (win) {
    r.wins++;
    if (!r.bestTime || sim.time < r.bestTime) {
      r.bestTime = sim.time;
      newBest = true;
    }
  }
  r.bestKills = Math.max(r.bestKills, sim.kills);
  r.bestWave = Math.max(r.bestWave, sim.wave);
  all[key] = r;
  store.set(RECORDS_KEY, all);
  return { record: r, newBest };
}

/* ------------------------------------------------------------------ world */

function loadWorld(id, instance = null) {
  const op = opById(id);
  opId = op.id;
  sim = instance || new Simulation(difficulty, opId);
  if (view.worldId !== opId) {
    view.setWorld(opId, buildWorld(sim.map, op, STYLES[opId]), STYLES[opId]);
    minimapBG = null;
    embers.length = 0;
    document.body.dataset.op = opId;
  }
}

/* ------------------------------------------------------------------ menus */

function buildMenus() {
  $('#op-options').innerHTML = OPERATIONS.map((o) => `<button class="op-option" data-op="${o.id}"><b>${o.num} / ${o.name}</b><span>${o.tagline}</span><small class="op-best"></small></button>`).join('');
  for (const b of $$('.op-option')) b.addEventListener('click', () => selectOp(b.dataset.op));
  for (const b of $$('.hero-option')) {
    b.addEventListener('click', () => {
      selected = +b.dataset.id;
      savePrefs();
      menuUI();
      audio.tick();
    });
  }
  for (const b of $$('[data-diff]')) {
    b.addEventListener('click', () => {
      difficulty = b.dataset.diff;
      savePrefs();
      menuUI();
      audio.tick();
    });
  }
  $('#deploy').addEventListener('click', startSolo);
  el.cont.addEventListener('click', continueGame);
  $('#menu-help').addEventListener('click', () => help());
  $('#menu-settings').addEventListener('click', () => kit.menu.open());

  // HUD
  $('#objective-list').innerHTML = OPERATIONS[0].relays.map((r, i) => `<div class="objective" id="obj-${i}"><div class="node-icon">${r.short}</div><div style="flex:1"><div class="name"></div><small></small><div class="progress"><i></i></div></div></div>`).join('');
  $('#squad-list').innerHTML = classes.map((c, i) => `<button class="squad-card" data-hero="${i}"><span class="key">0${i + 1}</span><div><b style="color:${c.color}">${c.name}</b><small></small><div class="tinybar"><i style="background:${c.color}"></i></div></div></button>`).join('');
  for (const b of $$('[data-hero]')) b.addEventListener('click', () => switchHero(+b.dataset.hero));
  for (const b of $$('.skill')) b.addEventListener('click', () => useSkill(+b.dataset.slot));
  $('#map-button').addEventListener('click', toggleMap);
  $('#follow-button').addEventListener('click', recenter);
  $('#sound-button').addEventListener('click', toggleSound);
  $('#pause-button').addEventListener('click', pauseMenu);
  el.modalBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (b) act(b.dataset.act, b);
  });

  mini.style.touchAction = 'none';
  mini.addEventListener('contextmenu', (e) => e.preventDefault());
  mini.addEventListener('pointerdown', (e) => {
    if (mode !== 'game' || paused || ending) return;
    e.preventDefault();
    const r = mini.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * 960 - 480, z: ((e.clientY - r.top) / r.height) * 960 - 480 };
    if (e.button === 2 || e.pointerType === 'touch') moveCommand(p);
    else {
      follow = false;
      overview = false;
      camX = p.x;
      camZ = p.z;
      zoomGoal = Math.min(zoomGoal, 170);
      el.mapLabel.classList.add('hidden');
    }
  });
}

function selectOp(id) {
  if (mode !== 'menu') return;
  const op = opById(id);
  if (op.id !== opId || !sim) {
    loadWorld(op.id);
    lastEvent = sim.eventId;
    smooth.clear();
    visuals.length = 0;
    particles.length = 0;
  }
  savePrefs();
  menuUI();
  audio.tick();
}

function menuUI() {
  for (const b of $$('.op-option')) {
    b.classList.toggle('selected', b.dataset.op === opId);
    const r = recordFor(b.dataset.op, difficulty);
    b.querySelector('.op-best').textContent = r && r.wins ? `BEST ${fmt(r.bestTime)} · ${DIFF_NAMES[difficulty]}` : r ? `FURTHEST: WAVE ${pad(r.bestWave)}` : '';
  }
  for (const b of $$('.hero-option')) b.classList.toggle('selected', +b.dataset.id === selected);
  for (const b of $$('[data-diff]')) b.classList.toggle('selected', b.dataset.diff === difficulty);
  const op = opById(opId);
  $('#caption-num').textContent = `OPERATION / ${op.num}`;
  $('#caption-name').textContent = op.name;
  $('#caption-text').textContent = op.caption;
  const save = readSave();
  el.cont.classList.toggle('hidden', !save);
  if (save) {
    const so = opById(save.op);
    el.cont.querySelector('small').textContent = `${so.num} ${so.name} · WAVE ${pad(save.wave)} · ${fmt(Number(save.time) || 0)} · ${classes[clamp(save.selected | 0, 0, 2)].name}`;
  }
}

/* ------------------------------------------------------------------ device prompts */

const SKILL_KEYS = { keyboard: ['Q', 'E', 'R', 'SPACE'], gamepad: ['X', 'B', 'Y', 'A'], touch: ['', '', '', ''] };
let fireShown = true;
/** The touch Fire button only shows while this hero's auto fire is off (auto fire needs no button). */
function syncFireButton() {
  const want = mode === 'game' && !!sim && !sim.auto[selected];
  if (want === fireShown) return;
  fireShown = want;
  kit.touch?.setShown('fire', want);
}

const touchSkills = ['skill1', 'skill2', 'skill3', 'dash'].map((name) => {
  const b = kit.touch?.button(name);
  if (!b) return null;
  b.textContent = '';
  const label = document.createElement('span');
  label.className = 'tb-label';
  const cd = document.createElement('b');
  cd.className = 'tb-cd';
  b.append(label, cd);
  return { b, label, cd, last: '' };
});

function prompts() {
  const src = input.source;
  const keys = SKILL_KEYS[src] || SKILL_KEYS.keyboard;
  $$('.skill .key').forEach((k, i) => (k.textContent = keys[i]));
  el.help.innerHTML =
    src === 'gamepad'
      ? '<kbd>L-STICK</kbd> move · <kbd>R-STICK</kbd> aim · <kbd>X B Y</kbd> skills · <kbd>A</kbd> dash · <kbd>VIEW</kbd> hero'
      : src === 'touch'
        ? 'Left thumb moves · push to the edge to run · tap the ground to travel · skills aim themselves'
        : '<kbd>W A S D</kbd> move · <kbd>RIGHT CLICK</kbd> travel · <kbd>Q E R</kbd> skills · <kbd>H</kbd> help';
  el.mapHint.textContent =
    src === 'gamepad' ? 'Left stick moves the marker · A travels there · RS returns' : src === 'touch' ? 'Tap to travel · MAP returns · HERO switches hero' : 'Right click to travel · M to return · 1 / 2 / 3 to switch hero';
  el.mapFoot.textContent = 'CLICK: VIEW · RIGHT CLICK: TRAVEL';
  $('#menu-device').textContent = src === 'gamepad' ? 'CONTROLLER · A SELECT · D-PAD MOVE' : src === 'touch' ? 'TOUCH · TAP TO SELECT' : 'KEYBOARD + MOUSE · CONTROLLER · TOUCH';
  hudClock = 1;
}
input.onSourceChange(prompts);

function setHeroUI() {
  const c = classes[selected];
  document.documentElement.style.setProperty('--cyan', c.color);
  const tips = ['Q: Blast and stun a group. Aim with the pointer.', 'Q: Fire through enemies in a line. Aim with the pointer.', 'Q: Blast a wide group. Aim with the pointer.'];
  $$('.skill').forEach((b, i) => {
    if (i < 3) b.querySelector('.name').textContent = c.ability[i];
    b.title = i === 0 ? tips[selected] : i === 1 ? 'E: Heal nearby heroes for 8 seconds. Also gives brief damage protection.' : i === 2 ? 'R: Strike the pointer position after a short delay.' : 'Space: Dash in your move direction. Brief damage protection.';
  });
  touchSkills.forEach((t, i) => {
    if (t) t.label.textContent = i < 3 ? c.short[i] : 'DASH';
  });
  prompts();
}

function toast(title, body = '', seconds = 4) {
  el.toastB.textContent = title;
  el.toastS.textContent = body;
  el.toast.classList.add('show');
  toastUntil = clock + seconds;
}

/* ------------------------------------------------------------------ menu navigation (keys, controller) */

function activeLayer() {
  if (!el.modal.classList.contains('hidden')) return el.modalBox;
  if (mode === 'menu') return el.menu;
  return null;
}
function navItems(layer) {
  return [...layer.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
}
function setNavFocus(b) {
  if (navFocused) navFocused.classList.remove('nav-focus');
  navFocused = b || null;
  if (!b) return;
  b.classList.add('nav-focus');
  b.focus({ preventScroll: true });
  b.scrollIntoView?.({ block: 'nearest' });
}
addEventListener('pointerdown', () => setNavFocus(null), true);

function navigate(layer, dir) {
  const items = navItems(layer);
  if (!items.length) return;
  const cur = items.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) {
    setNavFocus(layer.querySelector('[data-default]:not([disabled])') || items[0]);
    return;
  }
  const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bestScore = Infinity;
  for (const b of items) {
    if (b === cur) continue;
    const q = b.getBoundingClientRect(), x = q.left + q.width / 2 - cx, y = q.top + q.height / 2 - cy;
    const along = dir === 'left' ? -x : dir === 'right' ? x : dir === 'up' ? -y : y;
    const across = dir === 'left' || dir === 'right' ? Math.abs(y) : Math.abs(x);
    if (along <= 4) continue;
    const score = along + across * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = b;
    }
  }
  if (best) {
    setNavFocus(best);
    audio.tick();
  }
}

function menuInput(layer, dt) {
  const v = input.vector('move'), ax = Math.abs(v.x), ay = Math.abs(v.y);
  const dir = Math.max(ax, ay) < 0.5 ? null : ax > ay ? (v.x > 0 ? 'right' : 'left') : v.y > 0 ? 'up' : 'down';
  if (!dir) navHeld = null;
  else if (dir !== navHeld) {
    navHeld = dir;
    navRepeat = 0.38;
    navigate(layer, dir);
  } else if ((navRepeat -= dt) <= 0) {
    navRepeat = 0.14;
    navigate(layer, dir);
  }
  if (input.pressed('confirm')) {
    const f = navItems(layer).includes(document.activeElement) ? document.activeElement : null;
    if (f) f.click();
    else if (input.source === 'gamepad') navigate(layer, 'down');
    else defaultAction(layer);
  } else if (input.pressed('back')) backAction();
  else if (input.pressed('pause')) backAction();
  else if (input.pressed('help')) {
    if (modalKind === 'help') backAction();
    else if (!modalKind || modalKind === 'pause') help();
  }
}

function defaultAction(layer) {
  if (layer === el.menu) startSolo();
  else layer.querySelector('[data-default]')?.click();
}

function backAction() {
  if (el.modal.classList.contains('hidden')) return;
  if (modalKind === 'help') closeHelp();
  else if (modalKind !== 'end') closeModal();
}

/* ------------------------------------------------------------------ modals */

function modal(html, kind) {
  modalKind = kind;
  el.modalBox.innerHTML = html;
  el.modal.classList.remove('hidden');
  el.modalBox.scrollTop = 0;
  if (mode === 'game') paused = true;
  kit.touch?.suspend(true, 'modal');
  const def = el.modalBox.querySelector('[data-default]') || el.modalBox.querySelector('button');
  setNavFocus(def && input.source !== 'touch' ? def : null);
}

function closeModal() {
  if (modalKind === 'end') return;
  el.modal.classList.add('hidden');
  modalKind = '';
  helpReturn = '';
  if (mode === 'game') paused = false;
  kit.touch?.suspend(false, 'modal');
  setNavFocus(null);
  document.activeElement?.blur?.();
  input.settle();
}

function act(name, button) {
  audio.tick();
  if (name === 'resume') closeModal();
  else if (name === 'guide') help('pause');
  else if (name === 'settings') kit.menu.open();
  else if (name === 'auto') {
    sim.auto[selected] = !sim.auto[selected];
    button.textContent = `AUTO FIRE: ${sim.auto[selected] ? 'ON' : 'OFF'}`;
    hudClock = 1;
  } else if (name === 'sound') {
    toggleSound();
    button.textContent = `SOUND: ${audio.enabled ? 'ON' : 'OFF'}`;
  } else if (name === 'restart') {
    if (button.dataset.armed) {
      clearSave();
      startSolo();
    } else {
      button.dataset.armed = '1';
      button.textContent = 'CONFIRM RESTART';
    }
  } else if (name === 'quit') returnMenu(true);
  else if (name === 'close') closeHelp();
  else if (name === 'again') startSolo();
  else if (name === 'next') {
    const i = OPERATIONS.findIndex((o) => o.id === sim.op.id);
    loadWorld(OPERATIONS[(i + 1) % OPERATIONS.length].id);
    savePrefs();
    startSolo();
  } else if (name === 'menu') returnMenu(false);
}

function help(from = '') {
  helpReturn = from || (modalKind === 'pause' ? 'pause' : '');
  const src = input.source === 'gamepad' || input.source === 'touch' ? input.source : 'keyboard';
  const blocks = {
    keyboard: ['KEYBOARD + MOUSE', [
      ['W A S D / SHIFT', 'Move / run. Movement follows the camera.'],
      ['RIGHT CLICK', 'Travel to a point. Units go around obstacles.'],
      ['LEFT CLICK or J / F', 'Hold to focus fire on the pointer / turn auto fire on or off.'],
      ['Q / E / R', 'Attack skill / repair field / orbital strike.<br>Aim attacks with the pointer.'],
      ['SPACE', 'Dash in the move direction.'],
      ['1 / 2 / 3', 'Switch hero.'],
      ['M / B / WHEEL', 'Full map / follow hero / zoom (also + and −).'],
      ['MIDDLE DRAG', 'Move the camera. Use B to follow again.'],
      ['Z / H / ESC', 'Stop travel / field guide / pause.'],
      ['G / F9', 'Render statistics / settings.'],
    ]],
    gamepad: ['CONTROLLER', [
      ['LEFT STICK / LS', 'Move / click to run.'],
      ['RIGHT STICK', 'Aim. Skills and focus fire go where you aim.'],
      ['RT', 'Hold to focus fire on the aimed point.'],
      ['X / B / Y', 'Attack skill / repair field / orbital strike.'],
      ['A', 'Dash in the move direction.'],
      ['LT', 'Travel to the aimed point.'],
      ['LB / RB', 'Zoom out / in.'],
      ['RS CLICK', 'Full map. Move the marker, A to travel.'],
      ['VIEW', 'Switch hero.'],
      ['START', 'Pause: auto fire, sound, settings, save.'],
    ]],
    touch: ['TOUCH', [
      ['LEFT THUMB', 'Move. Push to the edge to run.'],
      ['TAP THE GROUND', 'Travel there. Units go around obstacles.'],
      ['DRAG / PINCH', 'Look around / zoom. Moving again follows your hero.'],
      ['SKILL BUTTONS', 'Attack, repair, strike and dash. Attacks aim at the nearest group.'],
      ['FIRE', 'Appears when auto fire is off (pause menu). Hold to shoot what is ahead of your hero.'],
      ['MAP / HERO / II', 'Full map / switch hero / pause.'],
    ]],
  };
  const order = [src, ...['keyboard', 'gamepad', 'touch'].filter((k) => k !== src)];
  const sections = order
    .map((k) => `<div class="guide-block${k === src ? ' active' : ''}"><h3>${blocks[k][0]}${k === src ? ' · IN USE' : ''}</h3><div class="controls">${blocks[k][1].map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('')}</div></div>`)
    .join('');
  const ember = opId === 'emberfall'
    ? '<p><b>Emberfall threats.</b> Sappers run at you and arm a charge: leave the red ring before it closes, or dash out. Mortar crews shell you from long range: keep moving when a red ring appears under you.</p>'
    : '';
  const back = helpReturn === 'pause' ? 'BACK' : mode === 'game' ? 'RETURN TO FIELD' : 'CLOSE';
  modal(
    `<div class="eyebrow">FIELD GUIDE</div><h2>Cross the map. Break the core.</h2><p>Stand inside a relay ring to capture it. Remove enemies from the ring first. Your AI allies start on other fronts. They hold their relays until the shield is down.</p>${ember}${sections}<p>To revive a hero, keep a living hero within 15 m for 3 seconds. After 30 seconds, a downed hero uses one reinforcement to return to the landing zone. The mission fails when all heroes are down and no reinforcements remain.</p><div class="modal-actions"><button class="primary" data-act="close" data-default>${back}</button></div>`,
    'help'
  );
}

function closeHelp() {
  if (helpReturn === 'pause' && mode === 'game' && !ending) showPause();
  else closeModal();
}

function pauseMenu() {
  if (mode !== 'game' || ending) return;
  if (!el.modal.classList.contains('hidden')) {
    backAction();
    return;
  }
  showPause();
}

function showPause() {
  writeSave();
  const op = sim.op;
  modal(
    `<div class="eyebrow">OPERATION ${op.num} / ${op.name} · PAUSED</div><h2>The long siege</h2><p>Take a moment. The battlefield will wait. Your progress is saved: CONTINUE on the main menu picks up from here.</p>
    <div class="modal-actions grid">
      <button class="primary" data-act="resume" data-default>RESUME</button>
      <button data-act="guide">FIELD GUIDE</button>
      <button data-act="settings">SETTINGS</button>
      <button data-act="auto">AUTO FIRE: ${sim.auto[selected] ? 'ON' : 'OFF'}</button>
      <button data-act="sound">SOUND: ${audio.enabled ? 'ON' : 'OFF'}</button>
      <button data-act="restart">RESTART OPERATION</button>
      <button data-act="quit">SAVE AND QUIT</button>
    </div>`,
    'pause'
  );
}

function endScreen() {
  if (endShown) return;
  endShown = true;
  const win = sim.status === 'victory', op = sim.op, res = ending.result, r = res.record, diff = DIFF_NAMES[sim.difficulty];
  const best = win ? (res.newBest ? `NEW BEST TIME · ${diff}` : `BEST ${fmt(r.bestTime)} · ${diff}`) : r.wins ? `BEST ${fmt(r.bestTime)} · ${diff}` : `FURTHEST: WAVE ${pad(r.bestWave)} · ${diff}`;
  const idx = OPERATIONS.findIndex((o) => o.id === op.id);
  const next = win && idx < OPERATIONS.length - 1 ? OPERATIONS[idx + 1] : null;
  const headline = win ? (op.id === 'emberfall' ? 'EMBERFALL IS DARK.' : 'THE CITADEL HAS FALLEN.') : 'NO HERO LEFT STANDING.';
  modal(
    `<div class="eyebrow">OPERATION ${op.num} ${win ? 'COMPLETE' : 'LOST'}</div><h2>${headline}</h2><p>${win ? 'The relays are secure. The reactor is destroyed. Your squad has taken the stronghold.' : 'Your squad has no reinforcements left. Use the outer roads, heal before a fight, and revive each other.'}</p><div class="result-numbers"><div><b>${fmt(sim.time)}</b><span>MISSION TIME</span></div><div><b>${sim.kills}</b><span>ENEMIES DOWN</span></div><div><b>${sim.wave}</b><span>WAVE REACHED</span></div></div><div class="result-best${res.newBest ? ' new' : ''}">${best}</div><div class="modal-actions"><button class="primary" data-act="again" data-default>PLAY AGAIN</button>${next ? `<button data-act="next">NEXT: ${next.num} ${next.name}</button>` : ''}<button data-act="menu">MAIN MENU</button></div>`,
    'end'
  );
}

/* ------------------------------------------------------------------ flow */

function startSolo() {
  audio.unlock();
  loadWorld(opId);
  beginGame(false);
}

function continueGame() {
  audio.unlock();
  const d = readSave();
  const s = d && Simulation.fromSave(d);
  if (!s) {
    clearSave();
    menuUI();
    kit.toast('The saved operation could not be read. Start a new one.');
    return;
  }
  difficulty = s.difficulty;
  selected = clamp(d.selected | 0, 0, 2);
  loadWorld(s.op.id, s);
  savePrefs();
  beginGame(true);
}

function beginGame(resumed) {
  const h = sim.heroes[selected];
  h.bot = false;
  mode = 'game';
  paused = false;
  overview = false;
  follow = true;
  endShown = false;
  ending = null;
  modalKind = '';
  helpReturn = '';
  smooth.clear();
  visuals.length = 0;
  particles.length = 0;
  lastEvent = sim.eventId;
  waypoint = null;
  accumulator = 0;
  lastSave = sim.time;
  padSprint = false;
  padAimT = 0;
  mapCursor = null;
  dragLast = null;
  touchGesture = null;
  lastHurt = h.hit || 0;
  camX = h.x;
  camZ = h.z;
  zoom = zoomGoal = 105;
  elevation = 0.87;
  aim.x = h.x;
  aim.z = h.z;
  el.menu.classList.add('hidden');
  el.hud.classList.remove('hidden');
  el.modal.classList.add('hidden');
  el.mapLabel.classList.add('hidden');
  $('#mode-label').textContent = 'SOLO / TWO AI ALLIES';
  $('#map-name').textContent = sim.op.name;
  sim.relays.forEach((r, i) => ($(`#obj-${i} .name`).textContent = r.name));
  kit.touch?.suspend(false, 'title');
  kit.touch?.suspend(false, 'modal');
  view.setCoreCollapse(0);
  setHeroUI();
  helpUntil = clock + 16;
  helpFaded = false;
  el.help.style.opacity = '1';
  if (resumed) toast('OPERATION RESUMED', `${sim.op.num} ${sim.op.name} · wave ${pad(sim.wave)} · ${fmt(sim.time)}`, 5);
  else toast('THREE FRONTS. ONE OBJECTIVE.', 'Capture your relay. Your allies will hold their own fronts.', 6);
  setNavFocus(null);
  document.activeElement?.blur?.();
  input.settle();
  hudClock = 1;
  savePrefs();
}

function returnMenu(save = true) {
  if (save) writeSave();
  mode = 'menu';
  paused = false;
  ending = null;
  endShown = false;
  overview = false;
  follow = true;
  loadWorld(opId);
  lastEvent = sim.eventId;
  smooth.clear();
  visuals.length = 0;
  particles.length = 0;
  waypoint = null;
  zoomGoal = 262;
  camX = -100;
  camZ = 0;
  modalKind = '';
  helpReturn = '';
  el.menu.classList.remove('hidden');
  el.hud.classList.add('hidden');
  el.modal.classList.add('hidden');
  el.mapLabel.classList.add('hidden');
  kit.touch?.suspend(false, 'modal');
  kit.touch?.suspend(true, 'title');
  view.setCoreCollapse(0);
  menuUI();
  input.settle();
  setNavFocus(input.source === 'gamepad' ? $('#deploy') : null);
}

function beginEnding() {
  const win = sim.status === 'victory';
  clearSave();
  ending = { win, t0: clock, n: 0, result: recordResult(win) };
  overview = false;
  follow = false;
  el.mapLabel.classList.add('hidden');
  input.rumble(win ? 0.9 : 0.7, win ? 600 : 420);
  if (!win) audio.defeat();
}

function runEnding() {
  const age = clock - ending.t0;
  if (ending.win) {
    // The reactor goes up in a chain of blasts and sinks into the fortress floor.
    while (ending.n < 9 && age >= ending.n * 0.32) {
      const last = ending.n === 8, a = Math.random() * Math.PI * 2, r = last ? 0 : 6 + Math.random() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      visuals.push({ type: last ? 'orbital' : 'blast', x, z, r: last ? 64 : 22 + Math.random() * 12, born: clock });
      addParticles({ x, z }, last ? 42 : 16);
      shake = last ? 2.6 : 1.2;
      audio.blast();
      if (last) {
        audio.victory();
        input.rumble(1, 700);
      }
      ending.n++;
    }
    view.setCoreCollapse(clamp((age - 0.6) / 2.8, 0, 1));
  }
  if (age > (ending.win ? 4 : 1.8)) endScreen();
}

/* ------------------------------------------------------------------ commands */

const canCommand = () => mode === 'game' && !paused && !ending && sim.status === 'active';

function cmd(command) {
  if (!canCommand()) return false;
  return sim.command(selected, command);
}

function moveCommand(p) {
  if (!p || !canCommand()) return;
  const x = clamp(p.x, -465, 465), z = clamp(p.z, -465, 465);
  cmd({ type: 'move', x, z });
  waypoint = { x, z, t: clock };
  visuals.push({ type: 'order', x, z, born: clock, hero: selected });
  audio.order();
}

function switchHero(i) {
  if (mode !== 'game' || !sim || i === selected || ending) return;
  sim.setInput(selected, { mx: 0, mz: 0, ax: 0, az: 0 });
  sim.heroes[selected].bot = true;
  sim.heroes[i].bot = false;
  // The new hero stops where it stands instead of walking on along its AI route.
  sim.heroes[i].path = [];
  selected = i;
  follow = true;
  overview = false;
  mapCursor = null;
  padSprint = false;
  zoomGoal = Math.min(zoomGoal, 130);
  el.mapLabel.classList.add('hidden');
  setHeroUI();
  waypoint = null;
  lastHurt = sim.heroes[i].hit || 0;
  toast(classes[i].name + ' SELECTED', sim.heroes[i].alive ? 'The previous hero is now under AI control.' : 'This hero is down. Move another hero near them to revive.');
  audio.tick();
  savePrefs();
}

/** Where a skill goes when nothing aims it (touch, or a controller with the right stick idle). */
function smartTarget(h, slot) {
  if (slot === 2 && !sim.core.shield && dist(h, sim.core) < 110) return sim.core;
  let nearest = null, nd = Infinity;
  for (const e of sim.enemies) {
    const d = dist(h, e);
    if (d < 110 && d < nd) {
      nd = d;
      nearest = e;
    }
  }
  if (!nearest) return { x: h.x + Math.sin(h.angle) * 40, z: h.z + Math.cos(h.angle) * 40 };
  if (slot === 0 && h.id === 1) return nearest; // the piercing line opens on the closest threat
  let best = nearest, bestScore = -Infinity;
  for (const e of sim.enemies) {
    const d = dist(h, e);
    if (d > 110) continue;
    let n = 0;
    for (const o of sim.enemies) if (Math.abs(o.x - e.x) < 25 && Math.abs(o.z - e.z) < 25 && dist(o, e) < 25) n++;
    const score = n - d / 200;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

function useSkill(slot) {
  if (!canCommand()) return;
  const h = sim.heroes[selected];
  if (!h.alive) {
    toast('HERO DOWN', 'Skills return when this hero is revived or redeployed.', 1.6);
    return;
  }
  if (h.cd[slot] > 0.01) {
    toast('SKILL NOT READY', `${Math.ceil(h.cd[slot])} seconds remain.`, 1.3);
    audio.deny();
    return;
  }
  let tx = aim.x, tz = aim.z;
  const aimed = input.source === 'keyboard' || (input.source === 'gamepad' && padAimT > 0);
  if (slot < 3 && slot !== 1 && !aimed) {
    const t = smartTarget(h, slot);
    tx = t.x;
    tz = t.z;
  }
  if (cmd({ type: 'ability', slot, x: tx, z: tz })) {
    audio.skill(slot);
    input.rumble(0.25, 70);
  }
}

function toggleMap() {
  if (mode !== 'game' || ending) return;
  overview = !overview;
  follow = !overview;
  zoomGoal = overview ? 465 : 105;
  mapCursor = null;
  el.mapLabel.classList.toggle('hidden', !overview);
}

function recenter() {
  if (mode !== 'game') return;
  follow = true;
  overview = false;
  zoomGoal = Math.min(zoomGoal, 145);
  el.mapLabel.classList.add('hidden');
}

function toggleAuto() {
  if (!canCommand()) return;
  sim.auto[selected] = !sim.auto[selected];
  toast('AUTO FIRE ' + (sim.auto[selected] ? 'ON' : 'OFF'), sim.auto[selected] ? 'Your hero fires at the nearest enemy in range.' : 'Hold fire to shoot. Your hero still aims at the pointer.', 1.6);
  hudClock = 1;
}

function toggleSound() {
  audio.setEnabled(!audio.enabled);
  $('#sound-button').textContent = 'SOUND ' + (audio.enabled ? 'ON' : 'OFF');
  savePrefs();
}

/* ------------------------------------------------------------------ gameplay input */

function gameInput(dt) {
  // While the reactor goes up (or the squad falls) the controls wait for the results screen.
  if (ending) return;
  if (input.pressed('pause')) {
    pauseMenu();
    return;
  }
  if (input.pressed('help')) {
    help();
    return;
  }
  const src = input.source;
  if (input.pressed('hero')) switchHero((selected + 1) % 3);
  else if (input.pressed('hero1')) switchHero(0);
  else if (input.pressed('hero2')) switchHero(1);
  else if (input.pressed('hero3')) switchHero(2);
  const h = sim.heroes[selected];
  if (input.pressed('map')) toggleMap();
  if (input.pressed('follow')) recenter();
  if (input.pressed('auto')) toggleAuto();
  if (input.pressed('stop')) {
    cmd({ type: 'stop' });
    waypoint = null;
  }

  // Zoom: wheel, pinch, bumpers, + and −.
  const zin = input.zoom();
  if (zin) zoomGoal = clamp(zoomGoal * Math.exp(-zin * (src === 'touch' ? 0.25 : 0.1)), 47, 480);
  if (input.down('zoomIn')) zoomGoal = clamp(zoomGoal * Math.exp(-dt * 1.8), 47, 480);
  if (input.down('zoomOut')) zoomGoal = clamp(zoomGoal * Math.exp(dt * 1.8), 47, 480);

  // Camera drag with the middle mouse button, as the original.
  const ptr = input.pointer;
  if (input.down('drag')) {
    if (dragLast) {
      view.ground(dragLast.x, dragLast.y, tmpA);
      view.ground(ptr.x, ptr.y, tmpB);
      camX = clamp(camX + tmpA.x - tmpB.x, -460, 460);
      camZ = clamp(camZ + tmpA.z - tmpB.z, -460, 460);
    } else {
      dragLast = { x: 0, y: 0 };
      follow = false;
    }
    dragLast.x = ptr.x;
    dragLast.y = ptr.y;
  } else dragLast = null;

  // Touch: one finger drags the camera, a short tap travels there, two fingers pinch.
  if (ptr.justDown && ptr.type === 'touch') touchGesture = { t: clock, moved: 0, pinch: false };
  const lk = input.look('pan');
  if (lk.x || lk.y) {
    const st = kit.settings.get(), k = (st.lookSensitivity || 1) * TOUCH_LOOK;
    const px = lk.x / k, py = (lk.y / k) * (st.invertY ? -1 : 1);
    if (touchGesture) touchGesture.moved += Math.abs(px) + Math.abs(py);
    if (!touchGesture || touchGesture.moved > 12) {
      const cx = kit.size.width / 2, cy = kit.size.height / 2;
      view.ground(cx, cy, tmpA);
      view.ground(cx + px, cy + py, tmpB);
      camX = clamp(camX + tmpA.x - tmpB.x, -460, 460);
      camZ = clamp(camZ + tmpA.z - tmpB.z, -460, 460);
      follow = false;
    }
  }
  if (touchGesture && zin) touchGesture.pinch = true;
  if (ptr.justUp && touchGesture) {
    if (touchGesture.moved <= 12 && !touchGesture.pinch && clock - touchGesture.t < 0.5) moveCommand(view.ground(ptr.x, ptr.y, tmpA));
    touchGesture = null;
  }

  // Aim: the mouse pointer on the ground, the right stick around the hero, or ahead of the hero.
  const mv = input.vector('move'), mvMag = Math.hypot(mv.x, mv.y);
  const c = Math.cos(camYaw), s = Math.sin(camYaw);
  const av = input.vector('aim'), amag = Math.hypot(av.x, av.y);
  if (src === 'keyboard') {
    if (ptr.over) view.ground(ptr.x, ptr.y, aim);
  } else if (amag > 0.25) {
    const wx = av.x * c - av.y * s, wz = -av.x * s - av.y * c, l = Math.hypot(wx, wz) || 1, reach = 22 + 68 * Math.min(1, amag);
    aim.x = h.x + (wx / l) * reach;
    aim.z = h.z + (wz / l) * reach;
    padAimT = 1.5;
  } else {
    padAimT = Math.max(0, padAimT - dt);
    if (padAimT <= 0) {
      aim.x = h.x + Math.sin(h.angle) * 30;
      aim.z = h.z + Math.cos(h.angle) * 30;
    }
  }

  // Movement follows the camera (screen up = away from the camera).
  let mx = mv.x * c - mv.y * s, mz = -mv.x * s - mv.y * c;
  let consumed = false;
  if (overview && src === 'gamepad') {
    // Tactical view on a controller: the stick moves a marker, A or LT travels there.
    if (!mapCursor) mapCursor = { x: h.x, z: h.z };
    mapCursor.x = clamp(mapCursor.x + mx * zoom * 1.1 * dt, -465, 465);
    mapCursor.z = clamp(mapCursor.z + mz * zoom * 1.1 * dt, -465, 465);
    aim.x = mapCursor.x;
    aim.z = mapCursor.z;
    if (input.pressed('dash') || input.pressed('travel')) {
      moveCommand(mapCursor);
      toggleMap();
    }
    consumed = true;
    mx = mz = 0;
  } else mapCursor = null;

  if (src === 'gamepad') {
    if (input.pressed('sprint')) padSprint = !padSprint;
    if (mvMag < 0.2) padSprint = false;
  }
  const sprint = src === 'gamepad' ? padSprint : src === 'touch' ? mvMag > 0.95 : input.down('sprint');
  // On a controller or touch, moving the hero brings the camera back to it.
  if ((src === 'gamepad' || src === 'touch') && mvMag > 0.2 && !follow && !overview) follow = true;

  if (!consumed) {
    if (input.pressed('skill1')) useSkill(0);
    if (input.pressed('skill2')) useSkill(1);
    if (input.pressed('skill3')) useSkill(2);
    if (input.pressed('dash')) useSkill(3);
    if (input.pressed('travel')) {
      if (src === 'gamepad' && padAimT <= 0) toast('AIM FIRST', 'Point the right stick where you want to go, then pull LT.', 2);
      else moveCommand(aim);
    }
  }
  playerInput.mx = mx;
  playerInput.mz = mz;
  playerInput.fire = input.down('fire');
  playerInput.sprint = sprint;
}

/* ------------------------------------------------------------------ units and events */

function getPosition(e, dt) {
  let p = smooth.get(e.id);
  if (!p) {
    p = { x: e.x, z: e.z, angle: e.angle || 0, moving: false, seen: 0 };
    smooth.set(e.id, p);
  }
  const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
  const blend = Math.min(1, dt * 24);
  if (d > 60) {
    p.x = e.x;
    p.z = e.z;
  } else {
    p.x += dx * blend;
    p.z += dz * blend;
  }
  const da = ((((e.angle || 0) - p.angle + Math.PI * 3) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  p.angle += da * Math.min(1, dt * 17);
  p.moving = d > 0.06;
  p.seen = frameNo;
  return p;
}

function units(dt) {
  frameNo++;
  for (const h of sim.heroes) {
    const p = getPosition(h, dt), tint = parseColor(classes[h.id].color), a = view.heroes[h.id];
    a.begin();
    a.push(p.x, height(p.x, p.z), p.z, p.angle, tint[0], tint[1], tint[2], h.alive ? 1.1 : 0.4, h.alive && p.moving ? 1 : 0, h.id * 1.73, h.hit && sim.time - h.hit < 0.1 ? 1 : 0);
    a.end();
  }
  const groups = view.enemies;
  for (const k in groups) groups[k].begin();
  for (const e of sim.enemies) {
    const p = getPosition(e, dt);
    const flash = (e.hit && sim.time - e.hit < 0.09) || (e.fuse > 0 && Math.sin(clock * 34) > 0) ? 1 : 0;
    groups[e.type]?.push(p.x, height(p.x, p.z), p.z, p.angle, 1, 1, 1, ENEMY_SCALE[e.type] || 1, p.moving ? 1 : 0, e.id * 0.7, flash);
  }
  for (const k in groups) groups[k].end();
  for (const [key, p] of smooth) if (p.seen !== frameNo) smooth.delete(key);
}

function addParticles(e, count = 15) {
  const max = Math.min(240, kit.detail(200));
  for (let i = 0; i < count && particles.length < max; i++) {
    const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 20;
    particles.push({ x: e.x, y: height(e.x, e.z) + 3, z: e.z, vx: Math.cos(a) * v, vy: 10 + Math.random() * 28, vz: Math.sin(a) * v, life: 0.5 + Math.random() * 0.8, col: i % 3 ? '#ffb56e' : '#fff1b6' });
  }
}

const VISUAL_EVENTS = new Set(['shot', 'enemyShot', 'beam', 'blast', 'orbital', 'enemyBlast', 'death', 'dash', 'warning', 'danger', 'lob']);
const BLAST_EVENTS = new Set(['blast', 'orbital', 'enemyBlast']);

function hint(key, title, body) {
  if (hinted.has(key)) return;
  hinted.add(key);
  toast(title, body, 5);
}

function handleEvents() {
  const me = sim.heroes[selected];
  for (const e of sim.events) {
    if (e.id <= lastEvent) continue;
    lastEvent = e.id;
    const near = e.x === undefined ? true : Math.hypot(e.x - me.x, e.z - me.z) < 150;
    if (VISUAL_EVENTS.has(e.type)) {
      visuals.push({ ...e, born: clock });
      if (BLAST_EVENTS.has(e.type) || e.type === 'death') addParticles(e, e.type === 'orbital' ? 42 : e.type === 'death' ? 5 : 18);
    }
    if (e.type === 'shot' && near && clock - lastShotSound > 0.065) {
      audio.shot(e.hero);
      lastShotSound = clock;
    }
    if (BLAST_EVENTS.has(e.type) && near) {
      audio.blast();
      shake = e.type === 'orbital' ? 1.8 : 0.7;
      input.rumble(e.type === 'orbital' ? 0.6 : 0.3, e.type === 'orbital' ? 260 : 120);
    }
    if (e.type === 'capture') {
      toast('RELAY ' + sim.relays[e.relay].short + ' SECURED', 'Shield power reduced. One reinforcement added.');
      audio.capture();
      input.rumble(0.35, 140);
    }
    if (e.type === 'wave') {
      toast('WAVE ' + pad(e.wave) + ' INBOUND', e.wave % 4 === 0 ? 'Heavy walker detected. Keep your distance.' : sim.op.roster === 'ember' && e.wave === 2 ? 'Sappers are running with this wave. Watch for red rings.' : 'Enemy forces are leaving the fortress gates.');
      audio.wave();
    }
    if (e.type === 'breach') {
      toast('SHIELD DOWN. ASSAULT THE CORE.', 'All orbital strikes are ready. Use any fortress gate.', 7);
      audio.breach();
      input.rumble(0.5, 300);
    }
    if (e.type === 'level') {
      toast('SQUAD LEVEL ' + e.level, 'Weapon power and maximum health increased.', 3);
      audio.level();
    }
    if (e.type === 'down') {
      toast(classes[e.hero].name + ' IS DOWN', 'Stand nearby to revive. Reserve deployment in 30 seconds.', 5);
      if (e.hero === selected) {
        audio.down();
        input.rumble(0.8, 320);
      }
    }
    if (e.type === 'revive' || e.type === 'redeploy') {
      toast(classes[e.hero].name + ' IS BACK', e.type === 'revive' ? 'Revived by a nearby ally.' : 'One reinforcement used.', 3);
      audio.back();
    }
    if (e.type === 'pickup' && e.hero === selected) audio.pickup();
    if (e.type === 'fuse' && near) {
      audio.fuse();
      hint('fuse', 'SAPPER CHARGE ARMED', 'Leave the red ring before it closes. A dash clears it.');
    }
    if (e.type === 'lob' && Math.hypot(e.tx - me.x, e.tz - me.z) < 150) {
      audio.lob();
      hint('lob', 'MORTAR FIRE', 'Shells land where the red ring closes. Keep moving.');
    }
  }
  if (visuals.length > 230) visuals.splice(0, visuals.length - 230);
}

function hurtFeedback() {
  const h = sim.heroes[selected];
  if (h.hit && h.hit !== lastHurt) {
    lastHurt = h.hit;
    if (clock - lastHurtFx > 0.25) {
      lastHurtFx = clock;
      input.rumble(0.3, 90);
    }
  }
}

/* ------------------------------------------------------------------ effects layer */

function effects(dt) {
  const fx = view.fx, t = clock;
  fx.reset();
  for (const r of sim.relays) {
    const y = height(r.x, r.z) + 0.65, col = r.active ? '#8bd9ac' : '#edbd79';
    fx.ring(r.x, y, r.z, 25, 0.45, col, 0.65);
    fx.ring(r.x, y + 0.05, r.z, 23, 1.1, col, 0.9, -Math.PI / 2, Math.max(0.003, r.capture));
    fx.ring(r.x, y + 0.1, r.z, 5, 0.5, col, 0.8);
    if (r.active) fx.beam(r.x, y + 31, r.z, r.x, y + 54, r.z, 1, col, 0.2);
  }
  if (sim.core.shield) {
    fx.dome(0, 3, 0, 45, '#ffc078', 0.095, t * 0.25);
    fx.ring(0, 3, 0, 47, 0.9, '#ffb871', 0.8);
    for (const r of sim.relays) if (!r.active) fx.beam(r.x, height(r.x, r.z) + 34, r.z, 0, 66, 0, 0.2, '#e7b179', 0.2);
  } else if (!ending) {
    fx.ring(0, 3, 0, 35, 1.2, '#ff8454', 0.8);
    if (sim.core.hp > 0) fx.beam(0, 68, 0, 0, 95 + Math.sin(t * 2) * 4, 0, 2, '#ffd99c', 0.45);
  }
  for (const h of sim.heroes) {
    const p = smooth.get(h.id) || h, y = height(p.x, p.z) + 0.6, col = classes[h.id].color;
    if (h.alive) {
      fx.ring(p.x, y, p.z, 5.2, 0.65, col, 0.85);
      if (h.id === selected && mode !== 'menu') {
        fx.ring(p.x, y + 0.02, p.z, 7.5, 0.3, col, 0.65, t * 0.4, 0.78);
        if (h.shield > 0) fx.dome(p.x, y, p.z, 7.7, col, 0.18, t);
      }
    } else {
      fx.ring(p.x, y, p.z, 9, 0.5, '#ff805a', 0.8);
      fx.beam(p.x - 3, y, p.z, p.x + 3, y, p.z, 1.3, col, 0.7);
      fx.beam(p.x, y, p.z - 3, p.x, y, p.z + 3, 1.3, col, 0.7);
    }
  }
  for (const f of sim.effects) {
    const y = height(f.x, f.z) + 0.7;
    if (f.type === 'heal') {
      fx.ring(f.x, y, f.z, f.r, 1, '#95edb1', 0.4);
      fx.ring(f.x, y + 0.1, f.z, (t * 10) % f.r, 0.65, '#95edb1', 0.4);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.2, x = f.x + Math.cos(a) * 20, z = f.z + Math.sin(a) * 20;
        fx.beam(x, y, z, x, y + 6, z, 0.7, '#a8f5bf', 0.25);
      }
    }
    if (f.type === 'strike' || f.type === 'enemyStrike' || f.type === 'grenade') {
      const col = f.type === 'enemyStrike' ? '#ff7450' : f.type === 'grenade' ? '#ffcb78' : '#91ecff';
      fx.ring(f.x, y, f.z, f.r, 0.8, col, 0.8);
      fx.ring(f.x, y + 0.1, f.z, f.r * clamp(f.life / (f.type === 'grenade' ? 0.65 : 1.65), 0, 1), 0.6, col, 0.6);
      fx.beam(f.x - 5, y, f.z, f.x + 5, y, f.z, 0.65, col, 0.7);
      fx.beam(f.x, y, f.z - 5, f.x, y, f.z + 5, 0.65, col, 0.7);
    }
  }
  for (const p of sim.pickups) {
    const y = height(p.x, p.z) + 2 + Math.sin(t * 3) * 0.7;
    fx.beam(p.x - 1.8, y, p.z, p.x + 1.8, y, p.z, 1.2, '#a2ffc8', 1);
    fx.beam(p.x, y - 1.8, p.z, p.x, y + 1.8, p.z, 1.2, '#a2ffc8', 1);
    fx.ring(p.x, y - 1, p.z, 3, 0.4, '#95ddb2', 0.5);
  }
  // Emberfall sappers: the blast ring pulses while the charge burns down.
  for (const e of sim.enemies) {
    if (!(e.fuse > 0)) continue;
    const p = smooth.get(e.id) || e, y = height(p.x, p.z) + 0.7, k = clamp(1 - e.fuse / SAPPER_FUSE, 0, 1);
    fx.ring(p.x, y, p.z, SAPPER_RADIUS, 0.7, '#ff5a3c', 0.55 + 0.35 * Math.sin(t * 30));
    fx.ring(p.x, y + 0.1, p.z, Math.max(0.5, SAPPER_RADIUS * k), 0.6, '#ffb070', 0.75);
  }
  for (let i = visuals.length - 1; i >= 0; i--) {
    const e = visuals[i], age = clock - e.born, y = height(e.x, e.z);
    if (age > 1.7) {
      visuals.splice(i, 1);
      continue;
    }
    if (e.type === 'shot' || e.type === 'enemyShot' || e.type === 'beam') {
      const life = e.type === 'beam' ? 0.3 : 0.14;
      if (age > life) continue;
      const enemy = e.type === 'enemyShot';
      if (enemy && e.kind !== 'gunner' && e.kind !== 'turret') continue;
      const col = enemy ? '#ffad6c' : e.type === 'beam' ? '#fff6be' : classes[e.hero].color;
      fx.beam(e.x, y + 4.5, e.z, e.tx, height(e.tx, e.tz) + 4.5, e.tz, e.type === 'beam' ? 1.3 : 0.38, col, 1 - age / life);
    }
    if (BLAST_EVENTS.has(e.type) && age < 1.05) {
      const col = e.type === 'orbital' ? '#aff2ef' : '#ffb676', r = e.r;
      fx.ring(e.x, y + 0.8, e.z, r * age, 0.9, col, (1 - age) * 0.9);
      if (age < 0.6) {
        fx.dome(e.x, y, e.z, r * 0.5 * age + 4, col, (0.6 - age) * 0.9);
        if (e.type === 'orbital') fx.beam(e.x, y, e.z, e.x, y + 230, e.z, Math.max(0.1, 3 * (0.6 - age)), col, 0.7);
      }
    }
    if (e.type === 'dash' && age < 0.4) fx.ring(e.x, y + 0.6, e.z, 6 + age * 17, 0.9, classes[e.hero].color, (0.4 - age) * 2);
    if (e.type === 'order' && age < 0.5) fx.ring(e.x, y + 0.6, e.z, 3 + age * 14, 0.6, classes[e.hero].color, (0.5 - age) * 1.8);
    if (e.type === 'lob' && age < e.life) {
      // A mortar shell arcing toward its red ring.
      const u0 = Math.max(0, age / e.life - 0.05), u1 = age / e.life;
      const pos = (u) => {
        const x = e.x + (e.tx - e.x) * u, z = e.z + (e.tz - e.z) * u;
        return [x, height(e.x, e.z) + 7 + (height(e.tx, e.tz) - height(e.x, e.z) - 7) * u + Math.sin(u * Math.PI) * 60, z];
      };
      const a = pos(u0), b = pos(u1);
      fx.beam(a[0], a[1], a[2], b[0], b[1], b[2], 0.9, '#ffcf8a', 0.9);
    }
  }
  const pm = view.particles;
  pm.begin();
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy -= dt * 35;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    const c = parseColor(p.col);
    pm.push(p.x, Math.max(height(p.x, p.z) + 0.7, p.y), p.z, t, c[0], c[1], c[2], Math.min(1.25, p.life * 2), 0, 0, 0);
  }
  pm.end();
  if (mode !== 'menu' && waypoint) {
    const h = sim.heroes[selected];
    if (Math.hypot(h.x - waypoint.x, h.z - waypoint.z) < 7 || clock - waypoint.t > 60) waypoint = null;
    else fx.ring(waypoint.x, height(waypoint.x, waypoint.z) + 0.7, waypoint.z, 4 + Math.sin(t * 5) * 0.4, 0.7, classes[selected].color, 0.9);
  }
  if (mode === 'game' && !paused && !ending) {
    const src = input.source;
    if (mapCursor) {
      const y = height(mapCursor.x, mapCursor.z) + 0.8;
      fx.ring(mapCursor.x, y, mapCursor.z, 9 + Math.sin(t * 6), 1.6, '#e1e6bc', 0.8);
      fx.beam(mapCursor.x - 14, y, mapCursor.z, mapCursor.x + 14, y, mapCursor.z, 1.4, '#e1e6bc', 0.7);
      fx.beam(mapCursor.x, y, mapCursor.z - 14, mapCursor.x, y, mapCursor.z + 14, 1.4, '#e1e6bc', 0.7);
    } else if (!overview && (src === 'keyboard' || (src === 'gamepad' && padAimT > 0))) {
      fx.ring(aim.x, height(aim.x, aim.z) + 0.8, aim.z, 2.3, 0.25, '#e1e6bc', 0.5);
    }
  }
  const emberCount = STYLES[opId].embers ? kit.detail(STYLES[opId].embers) : 0;
  if (emberCount) drawEmbers(fx, dt, emberCount);
}

/** Emberfall: sparks drifting up from the ash around the camera. */
function drawEmbers(fx, dt, want) {
  const span = Math.max(180, zoom * 2.2);
  while (embers.length < want) embers.push({ x: camX + (Math.random() - 0.5) * 2 * span, z: camZ + (Math.random() - 0.5) * 2 * span, y: Math.random() * 70, v: 3 + Math.random() * 6, p: Math.random() * 6.28, s: 0.25 + Math.random() * 0.4 });
  if (embers.length > want) embers.length = want;
  for (const e of embers) {
    e.y += e.v * dt;
    e.p += dt;
    if (e.y > 80 || Math.abs(e.x - camX) > span || Math.abs(e.z - camZ) > span) {
      e.x = camX + (Math.random() - 0.5) * 2 * span;
      e.z = camZ + (Math.random() - 0.5) * 2 * span;
      e.y = 0;
    }
    const gy = height(e.x, e.z) + e.y, sx = Math.sin(e.p * 1.7) * 0.6;
    const a = Math.min(1, e.y / 10) * (1 - e.y / 80) * 0.9;
    fx.beam(e.x + sx, gy, e.z, e.x + sx + 0.3, gy + 1.4, e.z, e.s, '#ff9a50', a);
  }
}

/* ------------------------------------------------------------------ overlay labels */

function label(x, y, text, col = '#eee9cd', size = 10, align = 'center') {
  octx.font = `${size}px monospace`;
  octx.textAlign = align;
  octx.fillStyle = 'rgba(10,24,27,.82)';
  const w = octx.measureText(text).width;
  const left = align === 'center' ? x - w / 2 - 5 : x - 5;
  octx.fillRect(left, y - size - 3, w + 10, size + 9);
  octx.fillStyle = col;
  octx.fillText(text, x, y);
}

function paintOverlay() {
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (mode === 'menu') return;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = kit.size.width, H = kit.size.height, me = sim.heroes[selected];
  for (const h of sim.heroes) {
    const p = smooth.get(h.id) || h, col = classes[h.id].color;
    const pos = view.project(p.x, height(p.x, p.z) + 14, p.z, proj);
    if (pos.visible) {
      label(pos.x, pos.y, h.alive ? `${h.id + 1} / ${classes[h.id].name}${h.id === selected ? ' · YOU' : h.bot ? ' · AI' : ''}` : h.down <= 0 ? 'AWAITING REVIVE' : `DOWN / ${Math.ceil(h.down)}s`, col, 9);
      octx.fillStyle = '#163037';
      octx.fillRect(pos.x - 26, pos.y + 9, 52, 4);
      octx.fillStyle = h.alive ? col : '#ea865b';
      octx.fillRect(pos.x - 26, pos.y + 9, 52 * (h.alive ? h.hp / h.maxHp : clamp(h.revive / 3, 0, 1)), 4);
    } else {
      const vx = pos.x - W / 2, vy = pos.y - H / 2;
      const f = Math.min((W / 2 - 55) / Math.max(1, Math.abs(vx)), (H / 2 - 90) / Math.max(1, Math.abs(vy)));
      label(W / 2 + vx * f, H / 2 + vy * f, `${h.id + 1} ${h.bot ? 'AI' : ''} ${Math.round(dist(h, me))}m`, col, 10);
    }
  }
  for (const r of sim.relays) {
    const p = view.project(r.x, height(r.x, r.z) + 42, r.z, proj);
    if (p.visible) label(p.x, p.y, `${r.short} / ${r.active ? 'SECURED' : r.capture > 0 ? 'CAPTURE ' + Math.round(r.capture * 100) + '%' : 'SHIELD RELAY'}`, r.active ? '#b5ecc0' : '#f2c681', overview ? 11 : 9);
  }
  const core = view.project(0, 94, 0, proj);
  if (core.visible && sim.core.hp > 0) {
    label(core.x, core.y, sim.core.shield ? `${sim.op.name} / SHIELDED` : 'REACTOR / ' + Math.ceil((sim.core.hp / sim.core.maxHp) * 100) + '%', '#f3c07c', 11);
    if (!sim.core.shield) {
      octx.fillStyle = '#182d30';
      octx.fillRect(core.x - 42, core.y + 8, 84, 5);
      octx.fillStyle = '#f4b178';
      octx.fillRect(core.x - 42, core.y + 8, (84 * sim.core.hp) / sim.core.maxHp, 5);
    }
  }
  if (!overview) {
    for (const e of sim.enemies) {
      if (e.hp >= e.maxHp) continue;
      const s = e.type === 'boss' ? 2.7 : e.type === 'brute' ? 1.6 : ENEMY_SCALE[e.type] || 1, q = smooth.get(e.id) || e;
      const p = view.project(q.x, height(q.x, q.z) + 8 * s, q.z, proj);
      if (!p.visible) continue;
      const w = e.type === 'boss' ? 48 : 22;
      octx.fillStyle = '#392f27';
      octx.fillRect(p.x - w / 2, p.y, w, 3);
      octx.fillStyle = '#eeb274';
      octx.fillRect(p.x - w / 2, p.y, (w * e.hp) / e.maxHp, 3);
    }
  }
  if (!me.alive && !ending) {
    const sw = input.source === 'gamepad' ? 'VIEW' : input.source === 'touch' ? 'HERO' : '1 / 2 / 3';
    label(W / 2, H * 0.56, `HERO DOWN · ${me.down > 0 ? Math.ceil(me.down) + 's TO RESERVE DEPLOYMENT' : 'NEEDS REVIVAL'} · ${sw} TO SWITCH`, '#ffbb88', 13);
  }
}

/* ------------------------------------------------------------------ minimap */

let minimapBG = null;
const corners = [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }];
const mm = (v) => ((v + 480) / 960) * 420;

function buildMinimap() {
  const c = document.createElement('canvas');
  c.width = c.height = 420;
  const g = c.getContext('2d'), ember = sim.op.id === 'emberfall';
  g.fillStyle = ember ? '#2c2b2c' : '#273d3e';
  g.fillRect(0, 0, 420, 420);
  g.strokeStyle = '#78918022';
  g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath();
    g.moveTo(i * 52.5, 0);
    g.lineTo(i * 52.5, 420);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i * 52.5);
    g.lineTo(420, i * 52.5);
    g.stroke();
  }
  g.strokeStyle = ember ? '#8a7f6c' : '#83917a';
  g.lineWidth = 5;
  for (const [a, b] of sim.map.roads) {
    g.beginPath();
    g.moveTo(mm(a.x), mm(a.z));
    g.lineTo(mm(b.x), mm(b.z));
    g.stroke();
  }
  for (const p of sim.map.props) {
    if (p.kind === 'tree') g.fillStyle = ember ? '#5a5444' : '#517163';
    else if (p.kind === 'rock') g.fillStyle = '#677972';
    else if (p.kind === 'wall' || p.kind === 'tower' || p.kind === 'barrack') g.fillStyle = '#b5a27b';
    else continue;
    const w = p.w || p.r * 2 || 3, d = p.d || p.r * 2 || 3;
    g.fillRect(mm(p.x - w / 2), mm(p.z - d / 2), (w / 960) * 420, (d / 960) * 420);
  }
  minimapBG = c;
}

function minimap() {
  if (!minimapBG) buildMinimap();
  const g = mctx;
  g.clearRect(0, 0, 420, 420);
  g.drawImage(minimapBG, 0, 0);
  for (const e of sim.enemies) {
    g.fillStyle = e.type === 'boss' ? '#fff0b9' : e.type === 'sapper' ? '#ff6a4a' : e.type === 'mortar' ? '#f0d08a' : '#de9768';
    const s = e.type === 'boss' ? 6 : e.type === 'mortar' ? 4 : 2.8;
    g.fillRect(mm(e.x) - s / 2, mm(e.z) - s / 2, s, s);
  }
  g.font = 'bold 12px monospace';
  g.textAlign = 'center';
  for (const r of sim.relays) {
    g.strokeStyle = r.active ? '#89dab0' : '#e9be7b';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(mm(r.x), mm(r.z), 10, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = g.strokeStyle;
    g.fillText(r.short, mm(r.x), mm(r.z) + 4);
  }
  g.fillStyle = sim.core.shield ? '#e7b774' : '#ff8758';
  g.beginPath();
  g.moveTo(210, 201);
  g.lineTo(219, 210);
  g.lineTo(210, 219);
  g.lineTo(201, 210);
  g.closePath();
  g.fill();
  for (const h of sim.heroes) {
    g.fillStyle = h.alive ? classes[h.id].color : '#ff7157';
    g.beginPath();
    g.arc(mm(h.x), mm(h.z), h.id === selected ? 6 : 4, 0, Math.PI * 2);
    g.fill();
    if (h.id === selected) {
      g.strokeStyle = '#f5f2c8';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(mm(h.x), mm(h.z), 10, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (mapCursor) {
    g.strokeStyle = '#f5f2c8';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(mm(mapCursor.x) - 8, mm(mapCursor.z));
    g.lineTo(mm(mapCursor.x) + 8, mm(mapCursor.z));
    g.moveTo(mm(mapCursor.x), mm(mapCursor.z) - 8);
    g.lineTo(mm(mapCursor.x), mm(mapCursor.z) + 8);
    g.stroke();
  }
  const W = kit.size.width, H = kit.size.height;
  view.ground(0, 0, corners[0]);
  view.ground(W, 0, corners[1]);
  view.ground(W, H, corners[2]);
  view.ground(0, H, corners[3]);
  g.strokeStyle = '#d5e4d18c';
  g.lineWidth = 1.3;
  g.beginPath();
  corners.forEach((p, i) => (i ? g.lineTo(mm(p.x), mm(p.z)) : g.moveTo(mm(p.x), mm(p.z))));
  g.closePath();
  g.stroke();
}

/* ------------------------------------------------------------------ HUD (writes only what changed) */

const setText = (node, v) => {
  if (node._t !== v) {
    node._t = v;
    node.textContent = v;
  }
};
const setWidth = (node, pct) => {
  const v = Math.round(clamp(pct, 0, 100) * 10) / 10;
  if (node._w !== v) {
    node._w = v;
    node.style.width = v + '%';
  }
};
let H = null;
function hudRefs() {
  H = {
    clock: $('#clock'), wave: $('#wave'), countdown: $('#wave-countdown'), lives: $('#lives'), relayCount: $('#relay-count'),
    title: $('#mission-title'), detail: $('#mission-detail'), core: $('#core-status'), name: $('#hero-name'), hp: $('#hero-hp'),
    health: $('#hero-health'), energy: $('#hero-energy'), auto: $('#auto-label'), level: $('#level-label'), flash: $('#damage-flash'), stats: $('#stats'),
    skills: $$('.skill').map((b) => b.querySelector('.cooldown')),
    obj: [0, 1, 2].map((i) => ({ row: $(`#obj-${i}`), small: $(`#obj-${i} small`), bar: $(`#obj-${i} .progress i`) })),
    squad: $$('[data-hero]').map((b) => ({ b, small: b.querySelector('small'), bar: b.querySelector('.tinybar i') })),
  };
  H.stats.style.whiteSpace = 'pre';
}

function hud() {
  if (mode === 'menu') return;
  if (!H) hudRefs();
  const h = sim.heroes[selected], c = classes[selected];
  setText(H.clock, fmt(sim.time));
  setText(H.wave, pad(sim.wave));
  setText(H.countdown, 'Next wave: ' + Math.max(0, Math.ceil(sim.nextWave - sim.time)) + ' s');
  setText(H.lives, sim.reinforcements + ' reinforcements');
  let captured = 0;
  for (const r of sim.relays) if (r.active) captured++;
  setText(H.relayCount, captured + ' OF 3');
  setText(H.title, sim.core.shield ? 'CUT THE SHIELD' : 'DESTROY THE REACTOR');
  setText(H.detail, sim.core.shield ? 'Capture the three outer relays.' : 'Enter the stronghold through any gate.');
  for (const r of sim.relays) {
    const o = H.obj[r.id];
    o.row.classList.toggle('active', r.active);
    setText(o.small, r.active ? 'SECURED' : r.capture > 0 ? Math.round(r.capture * 100) + '% captured · ' + Math.round(dist(h, r)) + ' m' : Math.round(dist(h, r)) + ' m · hold the ring');
    setWidth(o.bar, r.capture * 100);
  }
  const coreKey = sim.core.shield ? 'shield' : 'open' + Math.ceil((sim.core.hp / sim.core.maxHp) * 100);
  if (H.core._k !== coreKey) {
    H.core._k = coreKey;
    H.core.innerHTML = sim.core.shield
      ? '◆ REACTOR SHIELD ACTIVE<br><span style="color:#96a79f">Clear a ring. Stand inside to capture.</span>'
      : '◆ REACTOR EXPOSED / ' + Math.ceil((sim.core.hp / sim.core.maxHp) * 100) + '%<br><span style="color:#96a79f">Use orbital strikes inside the walls.</span>';
  }
  for (const s of H.squad) {
    const id = +s.b.dataset.hero, o = sim.heroes[id];
    s.b.classList.toggle('selected', id === selected);
    setText(s.small, !o.alive ? 'DOWN / ' + Math.max(0, Math.ceil(o.down)) + ' s' : id === selected ? 'YOU / ' + (overview ? 'MAP VIEW' : o.order) : `${o.bot ? 'AI' : 'PLAYER'} / ${Math.round(dist(h, o))} m`);
    setWidth(s.bar, (100 * o.hp) / o.maxHp);
  }
  setText(H.name, c.name + (h.alive ? '' : ' / DOWN'));
  setText(H.hp, Math.ceil(h.hp) + ' / ' + Math.round(h.maxHp));
  setWidth(H.health, (100 * h.hp) / h.maxHp);
  setWidth(H.energy, h.energy);
  H.skills.forEach((cd, i) => setText(cd, h.cd[i] > 0.05 ? String(Math.ceil(h.cd[i])) : ''));
  touchSkills.forEach((t, i) => {
    if (!t) return;
    const v = h.cd[i] > 0.05 ? String(Math.ceil(h.cd[i])) : '';
    if (t.last !== v) {
      t.last = v;
      t.cd.textContent = v;
      t.b.classList.toggle('is-cooling', !!v);
    }
  });
  setText(H.auto, 'AUTO FIRE ' + (sim.auto[selected] ? 'ON' : 'OFF') + (input.source === 'gamepad' ? ' / START MENU' : ' / F'));
  syncFireButton();
  setText(H.level, 'LV ' + sim.level + ' · ' + sim.kills + ' KILLS');
  H.flash.classList.toggle('hit', !!(h.hit && sim.time - h.hit < 0.14));
  if (showStats) {
    const info = view.stats();
    setText(H.stats, `${window.__kit?.fps ?? 0} FPS · ${kit.backendLabel} · ${Math.round(info.triangles).toLocaleString()} TRIANGLES\n${info.drawCalls ?? info.calls} DRAW CALLS · ${sim.enemies.length} ENEMIES`);
  } else setText(H.stats, '');
  minimap();
}

/* ------------------------------------------------------------------ the loop */

function updateCamera(dt) {
  if (mode === 'menu') {
    camYaw = 0.46 + Math.sin(clock * 0.055) * 0.055;
    camX += (-100 - camX) * dt * 2;
    camZ += (0 - camZ) * dt * 2;
    elevation += (0.87 - elevation) * dt * 3;
  } else if (ending && ending.win) {
    const k = Math.min(1, dt * 2.5);
    camX += (0 - camX) * k;
    camZ += (0 - camZ) * k;
    zoomGoal = 150;
    elevation += (0.87 - elevation) * Math.min(1, dt * 5);
  } else if (overview) {
    const k = Math.min(1, dt * 5);
    camX += (0 - camX) * k;
    camZ += (0 - camZ) * k;
    elevation += (1.1 - elevation) * k;
  } else {
    elevation += (0.87 - elevation) * Math.min(1, dt * 5);
    if (follow) {
      const h = smooth.get(selected) || sim.heroes[selected], k = Math.min(1, dt * 8);
      camX += (h.x - camX) * k;
      camZ += (h.z - camZ) * k;
    }
  }
  zoom += (zoomGoal - zoom) * Math.min(1, dt * 7);
  shake = Math.max(0, shake - dt * 8);
  view.setCamera(camX + (Math.random() - 0.5) * shake, camZ + (Math.random() - 0.5) * shake, zoom, camYaw, elevation);
}

function frame(rawDt) {
  const dt = Math.min(0.08, rawDt);
  clock += dt;
  if (input.pressed('stats')) showStats = !showStats;
  playerInput.mx = playerInput.mz = 0;
  playerInput.fire = playerInput.sprint = false;
  const layer = activeLayer();
  if (layer) menuInput(layer, dt);
  else if (mode === 'game') gameInput(dt);
  if (mode === 'game') {
    playerInput.ax = aim.x;
    playerInput.az = aim.z;
    sim.setInput(selected, playerInput);
    if (!paused && !ending) {
      accumulator = Math.min(accumulator + dt, 0.2);
      let steps = 0;
      while (accumulator >= 1 / 30 && steps++ < 5) {
        sim.update(1 / 30);
        accumulator -= 1 / 30;
      }
      if (sim.time - lastSave > 15) writeSave();
    }
    handleEvents();
    hurtFeedback();
    if (sim.status !== 'active' && !ending) beginEnding();
    if (ending) runEnding();
  }
  updateCamera(dt);
  units(dt);
  effects(dt);
  view.render(clock);
  paintOverlay();
  hudClock += dt;
  if (hudClock > 0.1) {
    hud();
    hudClock = 0;
  }
  if (clock > toastUntil) el.toast.classList.remove('show');
  if (mode === 'game' && !helpFaded && clock > helpUntil) {
    helpFaded = true;
    el.help.style.opacity = '0';
  }
}

/* ------------------------------------------------------------------ start */

buildMenus();
loadWorld(opId);
menuUI();
prompts();
$('#sound-button').textContent = 'SOUND ' + (audio.enabled ? 'ON' : 'OFF');
kit.touch?.suspend(true, 'title');
syncFireButton();

// Sound starts on the first gesture anywhere, and holds while the kit pauses or the tab hides.
const unlockAudio = () => audio.unlock();
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);
kit.onPause((p) => audio.hold(p || document.hidden));
document.addEventListener('visibilitychange', () => {
  audio.hold(document.hidden || kit.paused);
  if (document.hidden && mode === 'game' && !ending) {
    if (!paused) pauseMenu();
    else writeSave();
  }
});
addEventListener('pagehide', () => writeSave());
// Keep the middle button from starting the browser's auto-scroll over the battlefield.
kit.canvas.addEventListener('mousedown', (e) => {
  if (e.button === 1) e.preventDefault();
});

kit.loading.progress(0.85, 'Preparing shaders…');
updateCamera(0);
units(0);
effects(0);
await view.warm();
kit.start(frame);

// Automated checks and the console: a small handle on the running game.
window.Ashfall = {
  get sim() {
    return sim;
  },
  get mode() {
    return mode;
  },
  get selected() {
    return selected;
  },
  start: startSolo,
  continue: continueGame,
  command: cmd,
  switchHero,
  showMap: toggleMap,
};
