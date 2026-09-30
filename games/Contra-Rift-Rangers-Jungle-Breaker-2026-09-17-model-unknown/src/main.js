// main.js — startup, screens and menus. The kit boots the renderer (WebGPU with
// a WebGL2 fallback), wires keyboard, mouse, gamepad and touch into actions, and
// runs the loop; this file drives the title, pause and results screens, which
// work with a mouse, a controller (D-pad/stick + A, B to go back) and touch.

import { boot } from 'kit/boot.js';
import { createGame, formatTime } from './game.js';
import { createAudio } from './audio.js';
import { MISSIONS } from './missions.js';
import { DIFFICULTY } from './balance.js';
import { loadSave, writeSave } from './save.js';

const kit = await boot({
  title: 'Rift Rangers: Jungle Breaker',
  holdLoading: true,
  gear: 'none', // Settings sits in the title and pause menus (F9 also opens it)
  accent: '#baff38',
  background: '#07150f',
  touch: { top: 'right', topOffset: 110 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'FIRE' },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'JUMP' },
    grenade: { keys: ['KeyK', 'ShiftLeft', 'ShiftRight'], mouse: [2], gamepad: ['B', 'LT'], touch: 'GREN' },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad6 = (n) => String(Math.max(0, Math.round(n))).padStart(6, '0');

const ui = {
  hud: $('hud'),
  title: $('titleScreen'),
  pause: $('pauseScreen'),
  complete: $('completeScreen'),
  titleCode: $('titleCode'),
  titleBlurb: $('titleBlurb'),
  missionList: $('missionList'),
  diffList: $('difficultyList'),
  deploy: $('deployButton'),
  cont: $('continueButton'),
  status: $('loadStatus'),
  pauseButton: $('pauseButton'),
  pauseTitle: $('pauseTitle'),
  pauseInfo: $('pauseInfo'),
  completeCode: $('completeCode'),
  completeTitle: $('completeTitle'),
  rank: $('rankBadge'),
  stats: $('missionStats'),
  bestLine: $('bestLine'),
  next: $('nextButton'),
  retry: $('restartButton'),
};

const audio = createAudio();
const save = loadSave();
if (new URLSearchParams(location.search).has('unlock')) save.unlocked = MISSIONS.length - 1; // for testers
save.unlocked = clamp(save.unlocked, 0, MISSIONS.length - 1);
if (!DIFFICULTY[save.difficulty]) save.difficulty = 'ranger';
let selected = clamp(save.mission, 0, save.unlocked);
audio.setEnabled(save.sound);
audio.ambience(true);

let mode = 'boot'; // boot | title | loading | play | paused | complete
let busy = false;
let kitPaused = false;
let lastResult = null;

const game = createGame({ kit, audio, events: { onCheckpoint, onComplete } });

kit.loading.progress(0.75, 'Building the jungle…');
game.load(selected, save.difficulty);
await game.warm();

// ------------------------------------------------------------------ title screen
function missionBest(m, diffId) {
  return save.best[`${m.id}:${diffId}`] || null;
}

function renderMissions() {
  const cards = MISSIONS.map((m, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mission-card';
    const locked = i > save.unlocked;
    b.disabled = locked;
    b.setAttribute('aria-pressed', String(i === selected));
    const best = missionBest(m, save.difficulty);
    const line = locked ? `LOCKED · clear ${MISSIONS[i - 1].short}` : best ? `BEST ${pad6(best.score)} · ${best.rank} · ${formatTime(best.time)}` : 'NOT CLEARED';
    b.innerHTML = `<span class="mc-code">${m.code.split(' // ')[0]}</span><b>${m.name}</b><small>${line}</small>`;
    b.addEventListener('click', () => selectMission(i));
    return b;
  });
  ui.missionList.replaceChildren(...cards);
  const m = MISSIONS[selected];
  ui.titleCode.textContent = m.code;
  ui.titleBlurb.textContent = m.blurb;
}

function renderDifficulty() {
  const buttons = Object.values(DIFFICULTY).map((d) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'diff-button';
    b.dataset.id = d.id;
    b.setAttribute('aria-pressed', String(d.id === save.difficulty));
    b.innerHTML = `<b>${d.label}</b><small>${d.note}</small>`;
    b.addEventListener('click', () => selectDifficulty(d.id));
    return b;
  });
  ui.diffList.replaceChildren(...buttons);
}

function validRunIndex(run) {
  if (!run || typeof run !== 'object') return -1;
  const index = MISSIONS.findIndex((m) => m.id === run.mission);
  if (index < 0 || !DIFFICULTY[run.difficulty]) return -1;
  if (!Number.isInteger(run.cp) || run.cp < 0 || run.cp >= MISSIONS[index].checkpoints.length) return -1;
  return index;
}

function renderContinue() {
  const index = validRunIndex(save.run);
  ui.cont.classList.toggle('hidden', index < 0);
  if (index >= 0) {
    const m = MISSIONS[index];
    ui.cont.textContent = `CONTINUE · ${m.short.toUpperCase()} · CP ${save.run.cp + 1} · ${DIFFICULTY[save.run.difficulty].label}`;
  }
}

function renderSound() {
  for (const el of document.querySelectorAll('.js-sound')) el.textContent = `SOUND: ${save.sound ? 'ON' : 'OFF'}`;
}

function selectMission(i) {
  if (i > save.unlocked || busy) return;
  const changed = i !== selected;
  selected = i;
  save.mission = i;
  writeSave(save);
  for (const [k, el] of [...ui.missionList.children].entries()) el.setAttribute('aria-pressed', String(k === i));
  const m = MISSIONS[i];
  ui.titleCode.textContent = m.code;
  ui.titleBlurb.textContent = m.blurb;
  // The backdrop previews the chosen operation.
  if (changed && mode === 'title') game.load(i, save.difficulty);
}

function selectDifficulty(id) {
  if (!DIFFICULTY[id]) return;
  save.difficulty = id;
  writeSave(save);
  for (const el of ui.diffList.children) el.setAttribute('aria-pressed', String(el.dataset.id === id));
  const focusedIndex = [...ui.missionList.children].indexOf(document.activeElement);
  renderMissions();
  if (focusedIndex >= 0) ui.missionList.children[focusedIndex]?.focus({ preventScroll: true });
}

function showTitle() {
  renderMissions();
  renderDifficulty();
  renderContinue();
  renderSound();
  ui.status.textContent = '';
  setMode('title');
}

// ------------------------------------------------------------------ mode changes
function setMode(next) {
  mode = next;
  const playing = next === 'play';
  kit.touch?.suspend(!playing, 'game');
  ui.pauseButton.classList.toggle('hidden', !playing);
  ui.title.classList.toggle('hidden', next !== 'title');
  ui.pause.classList.toggle('hidden', next !== 'paused');
  if (next !== 'complete') ui.complete.classList.add('hidden');
  if (playing) {
    const a = document.activeElement;
    if (a && a !== document.body && a !== kit.canvas) a.blur();
    kit.canvas.focus({ preventScroll: true });
    kit.input.settle();
    placeHudInsets();
  }
  audio.setPaused(kitPaused || next === 'paused');
}

async function startMission(index, diffId, run = null) {
  if (busy) return;
  busy = true;
  mode = 'loading';
  kit.touch?.suspend(true, 'game');
  ui.status.textContent = 'Building the mission…';
  for (const el of document.querySelectorAll('.screen-panel')) el.classList.add('hidden');
  try {
    game.load(index, diffId, run);
    await game.warm();
    selected = index;
    game.begin(!!run);
    setMode('play');
  } catch (err) {
    console.error(err);
    showTitle();
    ui.status.textContent = `Could not start: ${err?.message || err}`;
  } finally {
    busy = false;
  }
}

function openPause() {
  if (mode !== 'play' || game.state.complete) return;
  const s = game.state;
  ui.pauseTitle.textContent = game.mission.name;
  ui.pauseInfo.textContent = `${game.difficulty.label} · ${formatTime(s.elapsed)} · INTEL ${s.intel}/${s.intelTotal} · DEATHS ${s.deaths}`;
  renderSound();
  setMode('paused');
}

function resume() {
  if (mode === 'paused') setMode('play');
}

function quitToTitle() {
  selected = game.missionIndex;
  game.load(game.missionIndex, save.difficulty);
  showTitle();
}

// ------------------------------------------------------------------ saving and results
function onCheckpoint(snap) {
  save.run = snap;
  writeSave(save);
}

function onComplete(r) {
  lastResult = r;
  const key = `${r.id}:${r.difficulty}`;
  const prev = save.best[key];
  const newBest = !prev || r.score > prev.score;
  if (newBest) save.best[key] = { score: r.score, time: Math.round(r.time), rank: r.rank, intel: r.intel };
  else if (r.time < prev.time) prev.time = Math.round(r.time);
  let unlocked = false;
  if (r.index + 1 < MISSIONS.length && save.unlocked < r.index + 1) {
    save.unlocked = r.index + 1;
    unlocked = true;
  }
  if (save.run?.mission === r.id) save.run = null;
  writeSave(save);

  ui.completeCode.textContent = `${MISSIONS[r.index].code.split(' // ')[0]} COMPLETE`;
  ui.completeTitle.textContent = r.title;
  ui.rank.textContent = r.rank;
  ui.rank.dataset.rank = r.rank;
  ui.stats.innerHTML = [
    ['TIME', formatTime(r.time)],
    ['SCORE', pad6(r.score)],
    ['KILLS', `${r.kills}/${r.total}`],
    ['ACCURACY', `${r.accuracy}%`],
    ['INTEL', `${r.intel}/${r.intelTotal}`],
    ['DEATHS', String(r.deaths)],
    ['WEAPON', r.weapon],
    ['MODE', r.difficultyLabel],
  ]
    .map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`)
    .join('');
  const best = save.best[key];
  const lines = [newBest ? 'NEW BEST SCORE' : `BEST ${pad6(best.score)} · ${best.rank}`, `TIME BONUS +${r.bonus}`];
  if (unlocked) lines.push(`${MISSIONS[r.index + 1].code.split(' // ')[0]} UNLOCKED`);
  ui.bestLine.textContent = lines.join(' · ');
  const hasNext = r.index + 1 < MISSIONS.length && r.index + 1 <= save.unlocked;
  ui.next.classList.toggle('hidden', !hasNext);
  ui.retry.className = hasNext ? 'secondary-button' : 'primary-button';
  if (hasNext) {
    ui.next.setAttribute('data-default', '');
    ui.retry.removeAttribute('data-default');
  } else {
    ui.next.removeAttribute('data-default');
    ui.retry.setAttribute('data-default', '');
  }
  ui.complete.classList.remove('hidden');
}

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
  if (mode === 'complete' && !ui.complete.classList.contains('hidden')) return ui.complete;
  return null;
}
const navItems = (scope) => [...scope.querySelectorAll(NAV_SEL)].filter((el) => el.offsetParent !== null);
const navDefault = (scope) => scope.querySelector('[data-default]:not([disabled]):not(.hidden)') || navItems(scope)[0] || null;

function navSet(el) {
  if (navEl && navEl !== el) navEl.classList.remove('pad-focus');
  navEl = el;
  if (!el) return;
  el.focus({ preventScroll: true });
  el.classList.toggle('pad-focus', kit.input.source === 'gamepad');
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
  if (best) navSet(best);
  else if (dy) navSet(dy > 0 ? items[0] : items[items.length - 1]); // wrap top/bottom
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
  if (kit.input.pressed('confirm')) (navEl || navDefault(scope))?.click();
}

// ------------------------------------------------------------------ prompts and layout
const CONTROLS = {
  keys: '<b>Keyboard</b> WASD / arrows move · Space jump · J or click fire · K, Shift or right-click grenade · wheel or +/− zoom · Esc pause',
  pad: '<b>Controller</b> left stick / D-pad move · A jump · X or RT fire · B or LT grenade · LB / RB zoom · Start pause',
  touch: '<b>Touch</b> left thumb moves · hold FIRE · JUMP · GREN throws · pinch to zoom · II pauses',
};
let promptMode = '';
function syncPrompts() {
  const m = kit.touch?.visible ? 'touch' : kit.input.source === 'gamepad' ? 'pad' : kit.input.source === 'touch' ? 'touch' : 'keys';
  if (m === promptMode) return;
  promptMode = m;
  document.body.dataset.input = m;
  for (const el of document.querySelectorAll('.js-controls')) el.innerHTML = CONTROLS[m];
}

// The pause pill sits under the HUD; the mouse pause button follows the HUD height too.
function placeHudInsets() {
  const r = ui.hud.getBoundingClientRect();
  if (!r.height) return;
  document.documentElement.style.setProperty('--hud-bottom', `${Math.round(r.bottom)}px`);
  kit.touch?.placeTop('right', Math.round(r.height + 14));
}
kit.onResize(() => {
  if (mode === 'play' || mode === 'paused') placeHudInsets();
});

// ------------------------------------------------------------------ wiring
ui.deploy.addEventListener('click', () => startMission(selected, save.difficulty, null));
ui.cont.addEventListener('click', () => {
  const index = validRunIndex(save.run);
  if (index >= 0) startMission(index, save.run.difficulty, save.run);
});
ui.pauseButton.addEventListener('click', openPause);
$('resumeButton').addEventListener('click', resume);
$('restartButtonPause').addEventListener('click', () => startMission(game.missionIndex, game.difficulty.id, null));
$('quitButton').addEventListener('click', quitToTitle);
ui.next.addEventListener('click', () => {
  if (lastResult) startMission(lastResult.index + 1, lastResult.difficulty, null);
});
ui.retry.addEventListener('click', () => startMission(game.missionIndex, game.difficulty.id, null));
$('titleButton').addEventListener('click', quitToTitle);
for (const el of document.querySelectorAll('.js-settings')) el.addEventListener('click', () => kit.menu.open());
for (const el of document.querySelectorAll('.js-sound')) {
  el.addEventListener('click', () => {
    save.sound = !save.sound;
    audio.setEnabled(save.sound);
    writeSave(save);
    renderSound();
  });
}

kit.onPause((p) => {
  kitPaused = p;
  audio.setPaused(p || mode === 'paused');
});
addEventListener('blur', () => {
  if (mode === 'play') openPause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'play') openPause();
});

// ------------------------------------------------------------------ loop
function frame(dt, t) {
  dt = Math.min(dt, 0.05);
  syncPrompts();
  switch (mode) {
    case 'play':
      if (kit.input.pressed('pause')) {
        openPause();
        break;
      }
      game.update(dt, t);
      if (game.state.complete) setMode('complete');
      break;
    case 'paused':
      if (kit.input.pressed('pause') || kit.input.pressed('back')) resume();
      else menuInput(dt);
      break;
    case 'complete':
      game.update(dt, t);
      menuInput(dt);
      break;
    case 'title':
      game.idle(dt, t);
      menuInput(dt);
      break;
    default:
      // Loading: warm() briefly shows hidden meshes while it compiles their pipelines,
      // so keep the last frame on screen instead of drawing them.
      return;
  }
  game.render();
}

showTitle();
kit.start(frame);
kit.loading.done();
