/**
 * main.js — BITCRASH: Storm Foundry on the shared 3D kit.
 *
 * The kit boots the renderer (WebGPU, WebGL2 fallback), wires keyboard,
 * mouse, gamepad and touch into the actions below, and runs the loop. This
 * file owns the screens (title with mission and difficulty select, pause,
 * service bay, results), saves progress, and steps the run on a fixed clock.
 * Every menu works with a mouse, a controller (D-pad or stick, A to choose,
 * B to go back) and touch.
 */

import { boot } from 'kit/boot.js';
import { createGame, DIFFICULTY, UPGRADES, GALE } from './game.js';
import { LEVELS } from './levels.js';
import { createView } from './view.js';
import { createAudio } from './audio.js';

const kit = await boot({
  title: 'BITCRASH: Storm Foundry',
  canvas: document.getElementById('gameCanvas'),
  holdLoading: true,
  gear: 'none', // Settings sits in the title and pause menus (F9 opens it too)
  accent: '#35e7ff',
  background: '#071425',
  touch: { top: 'right', topOffset: 96 },
  input: {
    // clamp: false keeps a full run speed while up or down is also held
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick', clamp: false },
    fire: { keys: ['KeyJ', 'KeyZ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'FIRE' },
    jump: { keys: ['Space', 'KeyK', 'KeyX'], gamepad: ['A'], touch: 'JUMP' },
    special: { keys: ['ShiftLeft', 'ShiftRight', 'KeyL'], mouse: [2], gamepad: ['B', 'LT'], touch: 'GALE' },
    use: { keys: ['KeyE'], gamepad: ['Y'], touch: 'USE' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    mute: { keys: ['KeyM'] },
  },
});

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const coarse = matchMedia('(pointer: coarse)').matches;

const ui = {
  hpFill: $('hpFill'),
  hpText: $('hpText'),
  xpFill: $('xpFill'),
  levelText: $('levelText'),
  scrapText: $('scrapText'),
  weRow: $('weRow'),
  weFill: $('weFill'),
  galeKey: $('galeKey'),
  missionPanel: $('missionPanel'),
  missionCode: $('mission'),
  missionName: $('missionName'),
  backend: $('backend'),
  bossHud: $('bossHud'),
  bossTitle: $('bossTitle'),
  bossFill: $('bossFill'),
  toast: $('toast'),
  prompt: $('prompt'),
  flash: $('damageFlash'),
  pauseBtn: $('pauseBtn'),
  mute: $('mute'),
  title: $('titleOverlay'),
  missionList: $('missionList'),
  blurb: $('missionBlurb'),
  diffList: $('diffList'),
  galeNote: $('galeNote'),
  start: $('startBtn'),
  pause: $('pauseOverlay'),
  pauseTitle: $('pauseTitle'),
  pauseInfo: $('pauseInfo'),
  resume: $('resumeBtn'),
  restart: $('restartBtn'),
  quit: $('quitBtn'),
  bay: $('upgradeOverlay'),
  bayScrap: $('bayScrap'),
  upgradeGrid: $('upgradeGrid'),
  closeBay: $('closeUpgrade'),
  end: $('endOverlay'),
  endTitle: $('endTitle'),
  rank: $('rank'),
  endStats: $('endStats'),
  endNews: $('endNews'),
  next: $('nextBtn'),
  replay: $('replayBtn'),
  menu: $('menuBtn'),
};

// ------------------------------------------------------------------ save

const SAVE_KEY = 'bitcrash.save.v1';
const RANKS = 'CBAS';

function loadSave() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {};
  } catch {
    raw = {};
  }
  const out = {
    unlocked: clamp(Number(raw.unlocked) || 0, 0, LEVELS.length - 1),
    gale: raw.gale === true,
    difficulty: DIFFICULTY[raw.difficulty] ? raw.difficulty : 'standard',
    muted: raw.muted === true,
    mission: Number(raw.mission) || 0,
    best: raw.best && typeof raw.best === 'object' ? raw.best : {},
    ranks: raw.ranks && typeof raw.ranks === 'object' ? raw.ranks : {},
  };
  // The original kept a single best time for Mission 01.
  try {
    const old = Number(localStorage.getItem('bitcrashBest') || 0);
    if (old > 0 && !out.best['foundry:standard']) out.best['foundry:standard'] = old;
  } catch {
    /* storage blocked */
  }
  return out;
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* storage blocked: progress lasts for this visit */
  }
}

const save = loadSave();
if (new URLSearchParams(location.search).has('unlock')) {
  // For testers: every mission and the Gale Burst.
  save.unlocked = LEVELS.length - 1;
  save.gale = true;
}

// ------------------------------------------------------------------ the pieces

const audio = createAudio();
audio.setMuted(save.muted);
const view = createView(kit, { coarse });
let mode = 'boot'; // boot | title | play | paused | bay | complete
let selected = clamp(save.mission | 0, 0, save.unlocked);
let lastResult = null;
let toastUntil = 0;

const game = createGame({
  beep: audio.beep,
  toast: (text, secs) => showToast(text, secs),
  burst: view.burst,
  shake: view.shake,
  rumble: (strength, ms) => kit.input.rumble(strength, ms),
  hurt: (n) => onHurt(n),
  boss: (on) => ui.bossHud.classList.toggle('show', on),
  near: (t) => onNear(t),
  openBay: () => openBay(),
  complete: (r) => onComplete(r),
});

// ------------------------------------------------------------------ HUD

const hudLast = {};
function setText(el, key, v) {
  if (hudLast[key] === v) return;
  hudLast[key] = v;
  el.textContent = v;
}
function setWidth(el, key, pct) {
  const v = Math.round(clamp(pct, 0, 100) * 10) / 10;
  if (hudLast[key] === v) return;
  hudLast[key] = v;
  el.style.width = `${v}%`;
}
function setFlag(el, key, cls, on) {
  if (hudLast[key] === on) return;
  hudLast[key] = on;
  el.classList.toggle(cls, on);
}

function updateHUD() {
  const st = game.state;
  const p = st.player;
  if (!p) return;
  setText(ui.hpText, 'hp', String(Math.max(0, Math.ceil(p.hp))));
  setWidth(ui.hpFill, 'hpw', (100 * p.hp) / p.maxHp);
  setFlag(ui.hpFill, 'hpLow', 'low', p.hp <= p.maxHp * 0.25);
  setText(ui.scrapText, 'scrap', `${p.scrap} SCRAP`);
  setText(ui.levelText, 'lvl', String(p.level));
  const min = p.level === 1 ? 0 : p.level === 2 ? 20 : 50;
  const max = p.level === 1 ? 20 : p.level === 2 ? 50 : 80;
  setWidth(ui.xpFill, 'xp', ((p.xp - min) / (max - min)) * 100);
  if (st.galeUnlocked) {
    setWidth(ui.weFill, 'we', (100 * p.we) / GALE.max);
    setFlag(ui.weFill, 'weLow', 'dim', p.we < GALE.cost);
  }
  if (st.boss) setWidth(ui.bossFill, 'boss', (100 * st.boss.hp) / st.boss.maxHp);
}

function showToast(text, secs = 1.8) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastUntil = performance.now() / 1000 + secs;
}

function onHurt(n) {
  kit.input.rumble(Math.min(1, 0.35 + n * 0.06), 140);
  view.shake(Math.min(0.5, 0.12 + n * 0.03));
  ui.flash.classList.remove('hit');
  void ui.flash.offsetWidth; // restart the flash animation
  ui.flash.classList.add('hit');
}

function onNear(t) {
  ui.prompt.classList.toggle('promptShow', !!t);
  kit.touch?.setShown('use', !!t);
}

// ------------------------------------------------------------------ prompts per device

const CONTROLS = {
  keys:
    '<div><b>Keyboard</b> — A/D or ←/→ move · Space/K jump · J/Z or click fire · E use · Shift/L or right-click Gale Burst · wheel or +/− zoom · M sound · Esc pause</div>' +
    '<div><b>Controller</b> — stick or D-pad move · A jump · X/RT fire · Y use · B/LT Gale Burst · LB/RB zoom · Start pause</div>',
  pad:
    '<div><b>Controller</b> — left stick or D-pad move · A jump · X or RT fire · Y use · B or LT Gale Burst · LB/RB zoom · Start pause</div>' +
    '<div><b>Menus</b> — D-pad or stick to choose · A to select · B to go back</div>',
  touch:
    '<div><b>Touch</b> — left thumb moves · JUMP · hold FIRE · USE at service bays · GALE fires the Gale Burst once earned · pinch to zoom · II pauses</div>',
};
const USE_KEY = { keys: 'E', pad: 'Y', touch: 'USE' };
const GALE_KEY = { keys: 'SHIFT', pad: 'B', touch: 'GALE' };
let promptMode = '';

function inputMode() {
  if (kit.input.source === 'gamepad') return 'pad';
  if (kit.input.source === 'touch' || kit.touch?.visible) return 'touch';
  return 'keys';
}
function syncPrompts() {
  const m = inputMode();
  if (m === promptMode) return;
  promptMode = m;
  document.body.dataset.input = m;
  for (const el of document.querySelectorAll('.js-controls')) el.innerHTML = CONTROLS[m];
  ui.prompt.textContent = `${USE_KEY[m]} — OPEN UPGRADE BAY`;
  ui.galeKey.textContent = GALE_KEY[m];
}

// ------------------------------------------------------------------ menus: mouse, touch and controller

const nav = { el: null, scope: null, key: '', wait: 0 };
const NAV_SEL = 'button:not([disabled])';

function menuScope() {
  if (kit.menu.isOpen) return null;
  if (mode === 'title') return ui.title;
  if (mode === 'paused') return ui.pause;
  if (mode === 'bay') return ui.bay;
  if (mode === 'complete') return ui.end;
  return null;
}
const navItems = (scope) => [...scope.querySelectorAll(NAV_SEL)].filter((el) => el.offsetParent !== null);
const navDefault = (scope) => scope.querySelector('[data-default]:not([disabled]):not(.hidden)') || navItems(scope)[0] || null;

function navSet(el) {
  if (nav.el && nav.el !== el) nav.el.classList.remove('pad-focus');
  nav.el = el;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.classList.toggle('pad-focus', kit.input.source === 'gamepad');
  el.scrollIntoView?.({ block: 'nearest' });
}

function navMove(scope, dx, dy) {
  const items = navItems(scope);
  if (!items.length) return;
  const active = document.activeElement;
  const cur = items.includes(active) ? active : items.includes(nav.el) ? nav.el : null;
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
  if (best) navSet(best);
  else if (dy) navSet(dy > 0 ? items[0] : items[items.length - 1]); // wrap top/bottom
}

function menuInput(dt) {
  const scope = menuScope();
  if (!scope) return;
  const el = nav.el;
  if (scope !== nav.scope || !el || !el.isConnected || el.disabled || !scope.contains(el) || el.offsetParent === null) {
    nav.scope = scope;
    nav.key = '';
    navSet(navDefault(scope));
  } else if (kit.input.source === 'gamepad' && !el.classList.contains('pad-focus')) el.classList.add('pad-focus');
  const mv = kit.input.vector('move');
  const dx = mv.x > 0.5 ? 1 : mv.x < -0.5 ? -1 : 0;
  const dy = mv.y > 0.5 ? -1 : mv.y < -0.5 ? 1 : 0; // screen y grows downward
  const key = dx || dy ? `${dx},${dy}` : '';
  if (!key) nav.key = '';
  else if (key !== nav.key || (nav.wait -= dt) <= 0) {
    nav.wait = key === nav.key ? 0.14 : 0.38;
    nav.key = key;
    navMove(scope, dy ? 0 : dx, dy);
  }
  if (kit.input.pressed('confirm')) (nav.el || navDefault(scope))?.click();
}

function setMode(next) {
  mode = next;
  ui.title.classList.toggle('hidden', next !== 'title');
  ui.pause.classList.toggle('hidden', next !== 'paused');
  ui.bay.classList.toggle('hidden', next !== 'bay');
  ui.end.classList.toggle('hidden', next !== 'complete');
  document.body.dataset.mode = next;
  kit.touch?.suspend(next !== 'play', 'game');
  const inp = game.input;
  inp.jumpPressed = inp.usePressed = inp.specialPressed = false;
  if (nav.el) nav.el.classList.remove('pad-focus');
  nav.el = null;
  nav.scope = null;
  if (next === 'play') {
    // A menu button keeping focus would swallow Space/Enter (and could restart the run).
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    kit.canvas.focus({ preventScroll: true });
  }
  // The press that closed a menu must not also jump or fire.
  kit.input.settle();
}

// ------------------------------------------------------------------ title

let missionButtons = [];
let diffButtons = [];

function buildTitle() {
  ui.missionList.textContent = '';
  missionButtons = LEVELS.map((L, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.innerHTML = `<b>${L.code}</b><span>${L.name}</span><small></small>`;
    b.addEventListener('click', () => selectMission(i));
    ui.missionList.append(b);
    return b;
  });
  ui.diffList.textContent = '';
  diffButtons = Object.values(DIFFICULTY).map((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.id = d.id;
    b.innerHTML = `<b>${d.label}</b><small>${d.note}</small>`;
    b.addEventListener('click', () => selectDifficulty(d.id));
    ui.diffList.append(b);
    return b;
  });
}

function refreshTitle() {
  LEVELS.forEach((L, i) => {
    const b = missionButtons[i];
    const locked = i > save.unlocked;
    b.disabled = locked;
    b.classList.toggle('is-on', i === selected);
    b.setAttribute('aria-pressed', String(i === selected));
    const key = `${L.id}:${save.difficulty}`;
    const best = save.best[key];
    const rank = save.ranks[key];
    b.querySelector('small').textContent = locked
      ? `LOCKED // CLEAR ${LEVELS[i - 1].code}`
      : best
        ? `BEST ${Number(best).toFixed(1)}s${rank ? ` · RANK ${rank}` : ''}`
        : 'NOT CLEARED';
  });
  for (const b of diffButtons) {
    const on = b.dataset.id === save.difficulty;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', String(on));
  }
  ui.blurb.textContent = LEVELS[selected].blurb;
  ui.galeNote.hidden = !save.gale;
}

function selectMission(i) {
  if (i > save.unlocked) return;
  audio.unlock();
  audio.beep(440, 0.04, 'square', 0.05);
  if (i !== selected) {
    selected = i;
    save.mission = i;
    writeSave();
    loadMission(i); // the stage behind the title follows the pick
  }
  refreshTitle();
}

function selectDifficulty(id) {
  audio.unlock();
  audio.beep(520, 0.04, 'square', 0.05);
  save.difficulty = id;
  writeSave();
  refreshTitle();
}

// ------------------------------------------------------------------ runs

function loadMission(i) {
  game.load(i, { difficulty: save.difficulty, gale: save.gale });
  view.load(game.state);
  const L = LEVELS[i];
  ui.missionCode.textContent = L.code;
  ui.missionName.textContent = L.name;
  ui.bossTitle.textContent = L.boss.name;
  ui.bossHud.classList.remove('show');
  ui.weRow.hidden = !save.gale;
  kit.touch?.setShown('special', save.gale);
  onNear(null);
  for (const k of Object.keys(hudLast)) delete hudLast[k];
  updateHUD();
}

function startMission(i = selected) {
  if (i > save.unlocked || i < 0 || i >= LEVELS.length) i = 0;
  selected = i;
  if (save.mission !== i) {
    save.mission = i;
    writeSave();
  }
  audio.unlock();
  loadMission(i);
  audio.restartMusic();
  setMode('play');
  showToast(LEVELS[i].startToast, 2.2);
}

function toTitle() {
  loadMission(selected);
  refreshTitle();
  setMode('title');
}

function openPause() {
  if (mode !== 'play') return;
  const st = game.state;
  ui.pauseTitle.textContent = st.level.name;
  ui.pauseInfo.innerHTML = `${st.level.code} · ${st.diff.label}<br>TIME <b>${st.runTime.toFixed(1)}s</b> · SCRAP <b>${st.player.scrap}</b> · REBOOTS <b>${st.reboots}</b>`;
  setMode('paused');
  audio.beep(240, 0.05, 'square', 0.05);
}

function resume() {
  if (mode === 'paused') setMode('play');
}

function openBay() {
  if (game.state.complete || mode !== 'play') return;
  renderBay();
  setMode('bay');
  audio.beep(310, 0.06, 'sine', 0.07, 100);
}

function renderBay() {
  const p = game.state.player;
  ui.bayScrap.textContent = `${p.scrap} SCRAP ON HAND`;
  ui.upgradeGrid.textContent = '';
  let firstBuy = null;
  for (const u of UPGRADES) {
    const d = document.createElement('div');
    d.className = 'upgrade';
    const owned = p.upgrades[u.id];
    d.innerHTML = `<h3>${u.name}</h3><p>${u.desc}</p>${owned ? '<div class="owned">INSTALLED</div>' : ''}`;
    if (!owned) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ui';
      b.textContent = `${u.cost} SCRAP`;
      b.disabled = p.scrap < u.cost;
      if (!b.disabled && !firstBuy) {
        firstBuy = b;
        b.dataset.default = '';
      }
      b.addEventListener('click', () => {
        if (!game.buyUpgrade(u.id)) return;
        renderBay();
        nav.scope = null; // pick a sensible button again
        updateHUD();
      });
      d.append(b);
    }
    ui.upgradeGrid.append(d);
  }
  ui.closeBay.toggleAttribute('data-default', !firstBuy);
}

function closeBay() {
  if (mode === 'bay') setMode('play');
}

function onComplete(r) {
  lastResult = r;
  const L = r.level;
  const key = `${L.id}:${r.difficulty}`;
  const prev = Number(save.best[key]) || 0;
  const newBest = !prev || r.time < prev;
  if (newBest) save.best[key] = Math.round(r.time * 10) / 10;
  if (!save.ranks[key] || RANKS.indexOf(r.rank) > RANKS.indexOf(save.ranks[key])) save.ranks[key] = r.rank;
  const news = [];
  if (r.levelIndex === 0 && !save.gale) {
    save.gale = true;
    news.push(`NEW WEAPON // GALE BURST — ${GALE_KEY[inputMode()]} fires a piercing gust in every mission`);
  }
  const nextIndex = r.levelIndex + 1;
  if (nextIndex < LEVELS.length && save.unlocked < nextIndex) {
    save.unlocked = nextIndex;
    news.push(`${LEVELS[nextIndex].code} UNLOCKED // ${LEVELS[nextIndex].name}`);
  }
  writeSave();
  ui.endTitle.textContent = L.endTitle;
  ui.rank.textContent = r.rank;
  ui.rank.dataset.rank = r.rank;
  ui.endStats.innerHTML =
    `TIME <b>${r.time.toFixed(1)}s</b>${newBest ? ' <i class="newbest">NEW BEST</i>' : ''}<br>` +
    `DAMAGE TAKEN <b>${r.damage}</b><br>REBOOTS <b>${r.reboots}</b><br>SYNC LEVEL <b>${r.syncLevel}</b><br>` +
    `MODULES <b>${r.modules}/3</b><br>SCRAP <b>${r.scrap}</b> · KILLS <b>${r.kills}</b><br>` +
    `BEST <b>${Number(save.best[key]).toFixed(1)}s</b> <span class="muted">${DIFFICULTY[r.difficulty].label}</span>`;
  ui.endNews.innerHTML = news.map((n) => `<div>${n}</div>`).join('');
  const hasNext = nextIndex < LEVELS.length && nextIndex <= save.unlocked;
  ui.next.classList.toggle('hidden', !hasNext);
  if (hasNext) ui.next.textContent = `Continue to ${LEVELS[nextIndex].code}`;
  setMode('complete');
  audio.jingle();
}

// ------------------------------------------------------------------ sound

function syncSoundLabels() {
  for (const el of document.querySelectorAll('.js-sound')) el.textContent = save.muted ? 'Sound: Off' : 'Sound: On';
  ui.mute.textContent = save.muted ? '×' : '♪';
  ui.mute.setAttribute('aria-pressed', String(save.muted));
}
function toggleSound() {
  save.muted = !save.muted;
  audio.unlock();
  audio.setMuted(save.muted);
  writeSave();
  syncSoundLabels();
}

// ------------------------------------------------------------------ wiring

ui.start.addEventListener('click', () => startMission(selected));
ui.resume.addEventListener('click', resume);
ui.restart.addEventListener('click', () => startMission(selected));
ui.quit.addEventListener('click', toTitle);
ui.closeBay.addEventListener('click', closeBay);
ui.replay.addEventListener('click', () => startMission(lastResult ? lastResult.levelIndex : selected));
ui.next.addEventListener('click', () => startMission((lastResult ? lastResult.levelIndex : selected) + 1));
ui.menu.addEventListener('click', toTitle);
ui.pauseBtn.addEventListener('click', openPause);
ui.mute.addEventListener('click', toggleSound);
for (const b of document.querySelectorAll('.js-settings')) b.addEventListener('click', () => kit.menu.open());
for (const b of document.querySelectorAll('.js-sound')) b.addEventListener('click', toggleSound);

// Audio may only start from a gesture; any key, click or tap will do.
addEventListener('pointerdown', () => audio.unlock(), true);
addEventListener('keydown', () => audio.unlock(), true);
kit.onPause((paused) => audio.hold(paused));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') openPause();
});

// Keep the touch pause pill under the mission panel, clear of the HUD.
function placeTouchTop() {
  const r = ui.missionPanel.getBoundingClientRect();
  if (r.height) kit.touch?.placeTop('right', Math.round(r.bottom + 8));
}
kit.onResize(() => requestAnimationFrame(placeTouchTop));

window.__BITCRASH__ = {
  get state() {
    return game.state;
  },
  game,
  sim: (dt) => game.step(dt),
  startGame: () => startMission(selected),
  startMission,
  openUpgrades: openBay,
  damagePlayer: (n, x) => game.damagePlayer(n, x),
  completeMission: () => game.completeMission(),
};

// ------------------------------------------------------------------ loop

const FIXED = 1 / 120;
let acc = 0;
let shown = false;

function readInput(dt) {
  const I = kit.input;
  const inp = game.input;
  inp.x = I.vector('move').x;
  inp.jump = I.down('jump');
  inp.fire = I.down('fire');
  if (I.pressed('jump')) inp.jumpPressed = true;
  if (I.pressed('special')) inp.specialPressed = true;
  if (I.pressed('use')) inp.usePressed = true;
  const z = I.zoom() * 0.15 + (I.down('zoomIn') ? 1.2 * dt : 0) - (I.down('zoomOut') ? 1.2 * dt : 0);
  if (z) view.zoom = view.zoom * Math.exp(z);
}

function frame(dt) {
  if (!shown) {
    shown = true;
    kit.loading.done();
    placeTouchTop();
  }
  syncPrompts();
  const I = kit.input;
  if (I.pressed('mute')) toggleSound();
  if (mode === 'play') {
    if (I.pressed('pause')) openPause();
    else {
      readInput(dt);
      acc = Math.min(acc + dt, 0.05);
      let n = 0;
      while (acc >= FIXED && n < 6 && mode === 'play') {
        game.step(FIXED);
        acc -= FIXED;
        n++;
      }
    }
  } else if (mode === 'paused' && (I.pressed('pause') || I.pressed('back'))) resume();
  else if (mode === 'bay' && (I.pressed('pause') || I.pressed('back') || I.pressed('use'))) closeBay();
  else menuInput(dt);

  if (toastUntil && performance.now() / 1000 > toastUntil) {
    ui.toast.classList.remove('show');
    toastUntil = 0;
  }
  const st = game.state;
  updateHUD();
  if (mode === 'play') audio.music(st.level.music, st.bossActive);
  view.sync(st, mode === 'paused' || mode === 'bay' ? 0 : dt);
  view.updateCamera(st, dt);
  view.render();
}

// ------------------------------------------------------------------ start

buildTitle();
syncSoundLabels();
loadMission(selected);
refreshTitle();
ui.backend.textContent = `renderer: ${kit.backend === 'webgpu' ? 'WebGPU' : 'WebGL2'} // three r186`;
kit.loading.progress(0.85, 'Warming up the foundry…');
await view.prewarm(game.state);
setMode('title');
kit.start(frame);
