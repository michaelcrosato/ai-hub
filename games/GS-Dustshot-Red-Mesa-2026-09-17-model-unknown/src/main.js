/**
 * main.js — Dustshot: Red Mesa on the shared 3D stack.
 *
 * Boots the kit (WebGPU with the WebGL2 fallback, quality tiers, settings,
 * input and touch controls), builds the view, and runs the game flow:
 * title → stage → results → next stage, with a pause menu, the shops, a
 * checkpoint before Red Mesa Pass, difficulty and best records. Every menu is
 * driven by the same kit.input actions as the game, so keyboard, controller
 * and touch all work.
 */

import { boot } from 'kit/boot.js';
import {
  createGameState, startMission, updateGame, canUseShop, buyUpgrade, upgradeStatus, shopItems, UPGRADE_DEFS, EQUIPMENT,
  getBoss, getMissionSummary, snapshotPlayer, STAGES, DIFFICULTIES, DIFFICULTY_ORDER,
} from './sim.js';
import { createRenderSystem } from './render.js';
import { ACTIONS, createControls } from './input.js';
import { createAudioSystem } from './audio.js';

const $ = (s) => document.querySelector(s);
const el = {
  hud: $('#hud'),
  healthFill: $('#health-fill'),
  healthText: $('#health-text'),
  levelText: $('#level-text'),
  xpText: $('#xp-text'),
  xpFill: $('#xp-fill'),
  cash: $('#cash'),
  score: $('#score'),
  objective: $('#objective'),
  bossHud: $('#boss-hud'),
  bossName: $('#boss-name'),
  bossFill: $('#boss-fill'),
  backend: $('#backend'),
  pauseButton: $('#pause-button'),
  tradeButton: $('#trade-button'),
  tradeKey: $('#trade-key'),
  start: $('#start-screen'),
  hints: $('#control-hints'),
  startButton: $('#start-button'),
  continueButton: $('#continue-button'),
  difficultyButton: $('#difficulty-button'),
  difficultyNote: $('#difficulty-note'),
  records: $('#records'),
  settingsButton: $('#settings-button'),
  tutorial: $('#tutorial'),
  tutorialTitle: $('#tutorial-title'),
  tutorialText: $('#tutorial-text'),
  tutorialControls: $('#tutorial-controls'),
  shop: $('#shop-modal'),
  shopKicker: $('#shop-kicker'),
  shopClose: $('#shop-close'),
  upgradeList: $('#upgrade-list'),
  shopCash: $('#shop-cash'),
  pause: $('#pause-modal'),
  pauseStage: $('#pause-stage'),
  pauseHelp: $('#pause-help'),
  soundButton: $('#sound-button'),
  end: $('#end-screen'),
  endKicker: $('#end-kicker'),
  endTitle: $('#end-title'),
  summary: $('#summary'),
  bestLine: $('#best-line'),
  renownLine: $('#renown-line'),
  nextButton: $('#next-button'),
  replayButton: $('#replay-button'),
  toast: $('#toast'),
  damageFlash: $('#damage-flash'),
};

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* private mode: progress lasts for this visit only */
    }
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
  json(k) {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null');
    } catch {
      return null;
    }
  },
};
const KEYS = { difficulty: 'dustshot-difficulty', career: 'dustshot-career-xp', records: 'dustshot-records-v1', checkpoint: 'dustshot-checkpoint-v1', zoom: 'dustshot-zoom' };

// The first version registered a cache-first service worker that could pin players to an old
// build. sw.js is now a worker that removes itself; this unregisters it right away as well.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((list) => {
    for (const r of list) if (/GS-Dustshot-Red-Mesa/i.test(r.scope)) r.unregister();
  }).catch(() => {});
  globalThis.caches?.delete('dustshot-red-mesa-v1').catch(() => {});
}

const kit = await boot({
  title: 'Dustshot: Red Mesa',
  canvas: $('#game'),
  gear: 'none', // Settings lives on the title screen and in the pause menu
  accent: '#e4b95d',
  background: '#1c1410',
  touch: { top: 'left', topOffset: 96 },
  input: ACTIONS,
});
const input = kit.input;

const view = await createRenderSystem(kit, { onProgress: (f, text) => kit.loading.progress(f, text) });
const controls = createControls(kit, view);
const audio = createAudioSystem();
// A controller's A press is not a user gesture, so also unlock sound on the first real key or tap.
for (const type of ['pointerdown', 'keydown']) addEventListener(type, () => audio.unlock(), { capture: true });
const zoomSaved = Number(store.get(KEYS.zoom));
if (zoomSaved) view.setZoom(zoomSaved);

const STEP = 1 / 60;
const CONTROL_LINES = {
  keyboard: 'WASD move · mouse aims · click, Space or J fires · E trades · wheel zooms · Esc pauses',
  gamepad: 'Left stick moves · right stick aims and fires · RT or X fires · Y trades · LB/RB zoom · Start pauses',
  touch: 'Left thumb moves · right thumb aims and fires · TRADE at the shop · pinch zooms · II pauses',
};

let difficulty = DIFFICULTIES[store.get(KEYS.difficulty)] ? store.get(KEYS.difficulty) : 'gunslinger';
let careerXP = Number(store.get(KEYS.career)) || 0;
const rankOf = (xp) => Math.min(6, Math.floor(xp / 1200));
let renown = rankOf(careerXP);
let records = store.json(KEYS.records);
if (!records || typeof records !== 'object') records = {};

let state = createGameState({ difficulty });
let mode = 'title';
let stageCarry = null;
let stageStart = { score: 0, kills: 0 };
let results = null;
let accumulator = 0;
let endTimer = 0;
let tutorialTimer = 0;
let flashTime = 0;
let zoomDirty = false;
let navHeld = 0;
let navTimer = 0;
let shopRows = [];
let hud = {};
const frameEvents = [];

/* ------------------------------------------------------------------ modes and menus */

function setMode(next) {
  if (mode === 'playing' && next !== 'playing' && zoomDirty) {
    zoomDirty = false;
    store.set(KEYS.zoom, view.getZoom().toFixed(3));
  }
  mode = next;
  el.start.classList.toggle('hidden', next !== 'title');
  el.pause.classList.toggle('hidden', next !== 'pause');
  el.shop.classList.toggle('hidden', next !== 'shop');
  el.end.classList.toggle('hidden', next !== 'end');
  el.hud.classList.toggle('hidden', next === 'title');
  el.pauseButton.classList.toggle('hidden', next !== 'playing');
  if (next !== 'playing') el.tradeButton.classList.add('hidden');
  hud.near = undefined;
  kit.touch?.suspend(next !== 'playing', 'ui');
  audio.setSuspended(next === 'pause' || kit.paused || document.hidden);
  navHeld = 0;
  if (next === 'playing') {
    input.settle();
    controls.reset();
    kit.canvas.focus({ preventScroll: true });
    requestAnimationFrame(placeTouchTop);
  }
  const root = menuRoot();
  if (root) focusDefault(root);
}

function menuRoot() {
  if (mode === 'title') return el.start;
  if (mode === 'pause') return el.pause;
  if (mode === 'shop') return el.shop;
  if (mode === 'end') return el.end;
  return null;
}

const visibleButtons = (root) => [...root.querySelectorAll('button')].filter((b) => !b.disabled && !b.closest('.hidden') && !b.classList.contains('hidden'));

function focusButton(button) {
  if (!button) return;
  button.classList.toggle('is-nav', input.source === 'gamepad');
  button.focus({ preventScroll: false });
}

function focusDefault(root) {
  if (input.source === 'touch') return;
  const buttons = visibleButtons(root);
  focusButton(buttons.find((b) => b.hasAttribute('data-default')) || buttons[0]);
}

function moveFocus(root, dir) {
  const buttons = visibleButtons(root);
  if (!buttons.length) return;
  const i = buttons.indexOf(document.activeElement);
  const next = i < 0 ? buttons.find((b) => b.hasAttribute('data-default')) || buttons[0] : buttons[(i + dir + buttons.length) % buttons.length];
  for (const b of buttons) b.classList.remove('is-nav');
  focusButton(next);
  next.classList.add('is-nav');
}

function activate(root) {
  const buttons = visibleButtons(root);
  const focused = buttons.includes(document.activeElement) ? document.activeElement : null;
  (focused || buttons.find((b) => b.hasAttribute('data-default')) || buttons[0])?.click();
}

/** Pause, shop and menu navigation from the same actions as the game. */
function handleUiInput(dt) {
  if (mode === 'playing') {
    if (input.pressed('pause')) openPause();
    return;
  }
  if (mode === 'pause' && (input.pressed('pause') || input.pressed('back'))) {
    closePause();
    return;
  }
  if (mode === 'shop' && (input.pressed('pause') || input.pressed('back') || input.pressed('interact'))) {
    closeShop();
    return;
  }
  const root = menuRoot();
  if (!root) return;
  const v = input.vector('move');
  let dir = 0;
  if (Math.abs(v.y) > 0.5 && Math.abs(v.y) >= Math.abs(v.x)) dir = v.y > 0 ? -1 : 1;
  else if (Math.abs(v.x) > 0.5) dir = v.x > 0 ? 1 : -1;
  if (!dir) navHeld = 0;
  else if (dir !== navHeld) {
    navHeld = dir;
    navTimer = 0.38;
    moveFocus(root, dir);
  } else if ((navTimer -= dt) <= 0) {
    navTimer = 0.12;
    moveFocus(root, dir);
  }
  if (input.pressed('confirm')) activate(root);
}

/* ------------------------------------------------------------------ title */

function loadCheckpoint() {
  const cp = store.json(KEYS.checkpoint);
  if (!cp || cp.v !== 1 || !Number.isInteger(cp.stage) || cp.stage < 1 || cp.stage >= STAGES.length) return null;
  if (!DIFFICULTIES[cp.difficulty] || !cp.carry || typeof cp.carry !== 'object') return null;
  if (!Number.isFinite(cp.carry.level) || !Number.isFinite(cp.carry.maxHp) || !Number.isFinite(cp.carry.damage)) return null;
  return cp;
}

const formatTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const formatScore = (n) => Math.floor(n).toLocaleString('en-US');

function recordsLine(diffKey) {
  const rec = records[diffKey] || {};
  const parts = STAGES.map((s) => {
    const r = rec[s.id];
    return r ? `${s.name} ${formatScore(r.score)} in ${formatTime(r.time)}` : `${s.name} —`;
  });
  if (rec.campaign) parts.push(`Campaign ${formatScore(rec.campaign)}`);
  return `Best on ${DIFFICULTIES[diffKey].label}: ${parts.join(' · ')}`;
}

function refreshTitle() {
  const cp = loadCheckpoint();
  el.continueButton.classList.toggle('hidden', !cp);
  if (cp) el.continueButton.textContent = `CONTINUE — ${STAGES[cp.stage].name.toUpperCase()} (${DIFFICULTIES[cp.difficulty].label.toUpperCase()})`;
  el.difficultyButton.textContent = `DIFFICULTY: ${DIFFICULTIES[difficulty].label.toUpperCase()}`;
  el.difficultyNote.textContent = DIFFICULTIES[difficulty].note;
  el.records.textContent = `${recordsLine(difficulty)}. Renown ${renown}.`;
  showSource(input.source);
}

function showSource(src) {
  for (const row of el.hints.children) row.classList.toggle('is-current', row.dataset.source === src);
  el.tradeKey.textContent = src === 'gamepad' ? 'Y' : 'E';
  el.pauseHelp.textContent = CONTROL_LINES[src] || CONTROL_LINES.keyboard;
  el.tutorialControls.textContent = CONTROL_LINES[src] || CONTROL_LINES.keyboard;
}
input.onSourceChange(showSource);

el.startButton.addEventListener('click', () => beginStage(0, null));
el.continueButton.addEventListener('click', () => {
  const cp = loadCheckpoint();
  if (!cp) return refreshTitle();
  difficulty = cp.difficulty;
  store.set(KEYS.difficulty, difficulty);
  beginStage(cp.stage, cp.carry);
});
el.difficultyButton.addEventListener('click', () => {
  difficulty = DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(difficulty) + 1) % DIFFICULTY_ORDER.length];
  store.set(KEYS.difficulty, difficulty);
  refreshTitle();
});
el.settingsButton.addEventListener('click', () => kit.menu.open());

function toTitle() {
  audio.music(null);
  state = createGameState({ difficulty });
  view.reset();
  hud = {};
  el.tutorial.classList.add('hidden');
  refreshTitle();
  setMode('title');
}

/* ------------------------------------------------------------------ stages */

function beginStage(stageIndex, carry) {
  audio.unlock();
  renown = rankOf(careerXP);
  state = createGameState({ renown, stage: stageIndex, difficulty, carry });
  if (!carry) state.player.cash += renown * 10;
  stageCarry = carry;
  stageStart = { score: state.player.score, kills: state.player.kills };
  startMission(state);
  view.reset();
  results = null;
  accumulator = 0;
  endTimer = 0;
  flashTime = 0;
  hud = {};
  el.bossName.textContent = state.stage.bossName.toUpperCase();
  el.backend.textContent = `${kit.backendLabel} · ${state.diff.label}`;
  showIntro(state.stage);
  audio.music(state.stage.theme);
  setMode('playing');
  if (stageIndex === 0) showToast(`RENOWN ${renown} — starting cash bonus $${renown * 10}`);
  else showToast(`${state.stage.name.toUpperCase()} — ${state.diff.label.toUpperCase()}`);
}

function showIntro(stage) {
  el.tutorialTitle.textContent = stage.intro.title;
  el.tutorialText.textContent = stage.intro.text;
  el.tutorialControls.textContent = CONTROL_LINES[input.source] || CONTROL_LINES.keyboard;
  el.tutorial.classList.remove('hidden');
  el.tutorial.style.animation = 'none';
  void el.tutorial.offsetWidth;
  el.tutorial.style.animation = '';
  tutorialTimer = 6.2;
}

/* ------------------------------------------------------------------ pause */

function openPause() {
  if (mode !== 'playing') return;
  el.pauseStage.textContent = `${state.stage.name} · ${state.diff.label} · ${formatTime(Math.max(0, state.time - state.stats.startedAt))}`;
  el.soundButton.textContent = `SOUND: ${audio.enabled ? 'ON' : 'OFF'}`;
  setMode('pause');
}
function closePause() {
  setMode('playing');
}
el.pauseButton.addEventListener('click', openPause);
$('#resume-button').addEventListener('click', closePause);
$('#restart-button').addEventListener('click', () => beginStage(state.stageIndex, stageCarry));
$('#pause-settings-button').addEventListener('click', () => kit.menu.open());
$('#quit-button').addEventListener('click', toTitle);
el.soundButton.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled);
  el.soundButton.textContent = `SOUND: ${audio.enabled ? 'ON' : 'OFF'}`;
});

addEventListener('blur', () => {
  if (mode === 'playing') openPause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') openPause();
  audio.setSuspended(document.hidden || mode === 'pause' || kit.paused);
});
kit.onPause((paused) => audio.setSuspended(paused || mode === 'pause' || document.hidden));

/* ------------------------------------------------------------------ shop */

function openShop() {
  if (mode !== 'playing' || !canUseShop(state)) return;
  el.shopKicker.textContent = state.stageIndex === 0 ? 'CINDER CREEK GUNSMITH' : 'RED MESA TRADING POST';
  el.upgradeList.textContent = '';
  shopRows = [];
  for (const [key, def] of shopItems(state)) {
    const row = document.createElement('div');
    row.className = 'upgrade';
    const copy = document.createElement('div');
    const title = document.createElement('b');
    title.textContent = def.label;
    const detail = document.createElement('span');
    detail.textContent = def.detail;
    copy.append(title, detail);
    const button = document.createElement('button');
    button.addEventListener('click', () => buy(key, button));
    row.append(copy, button);
    el.upgradeList.append(row);
    shopRows.push({ key, def, button });
  }
  refreshShop();
  setMode('shop');
}

function closeShop() {
  setMode('playing');
}
el.tradeButton.addEventListener('click', openShop);
el.shopClose.addEventListener('click', closeShop);

function refreshShop() {
  let first = null;
  for (const r of shopRows) {
    const status = upgradeStatus(state, r.key);
    r.button.textContent = status === 'owned' ? 'OWNED' : status === 'full' ? 'FULL HEALTH' : `$${r.def.cost}`;
    r.button.disabled = status !== 'ok';
    r.button.removeAttribute('data-default');
    if (!first && status === 'ok') first = r.button;
  }
  el.shopClose.toggleAttribute('data-default', !first);
  first?.setAttribute('data-default', '');
  el.shopCash.textContent = `$${Math.floor(state.player.cash)}`;
}

function buy(key, button) {
  if (!buyUpgrade(state, key)) return;
  const def = UPGRADE_DEFS[key];
  audio.handle([{ type: 'upgrade', key }]);
  input.rumble(0.25, 80);
  showToast(`${def.label.toUpperCase()} ${def.consumable ? '— HEALED' : 'INSTALLED'}`);
  state.events.length = 0;
  refreshShop();
  if (button.disabled && mode === 'shop') focusDefault(el.shop);
  updateHUD();
}

/* ------------------------------------------------------------------ results */

function settleRun() {
  const summary = getMissionSummary(state);
  const stageScore = summary.score - stageStart.score;
  const stageKills = summary.kills - stageStart.kills;
  const earned = Math.max(0, Math.floor(stageScore * 0.08 + stageKills * 12));
  careerXP += earned;
  store.set(KEYS.career, careerXP);
  renown = rankOf(careerXP);
  const victory = state.status === 'victory';
  const last = state.stageIndex === STAGES.length - 1;
  const out = { summary, stageScore, stageKills, earned, victory, last, bestScore: false, bestTime: false, bestCampaign: false };
  if (victory) {
    const rec = (records[difficulty] ||= {});
    const sr = (rec[state.stage.id] ||= {});
    if (!(sr.score >= stageScore)) {
      sr.score = stageScore;
      out.bestScore = true;
    }
    if (!(sr.time <= summary.time)) {
      sr.time = Math.round(summary.time * 10) / 10;
      out.bestTime = true;
    }
    if (last) {
      if (!(rec.campaign >= summary.score)) {
        rec.campaign = summary.score;
        out.bestCampaign = true;
      }
      store.remove(KEYS.checkpoint);
    } else {
      store.set(KEYS.checkpoint, JSON.stringify({ v: 1, stage: state.stageIndex + 1, difficulty, carry: snapshotPlayer(state.player) }));
    }
    store.set(KEYS.records, JSON.stringify(records));
  }
  return out;
}

function beginOutro() {
  results = settleRun();
  endTimer = state.status === 'victory' ? 1.1 : 0.7;
  setMode('outro');
}

function showResults() {
  const r = results;
  const s = r.summary;
  el.endKicker.textContent = r.victory ? (r.last ? 'CAMPAIGN COMPLETE' : 'BOUNTY COMPLETE') : 'TRAIL ENDED';
  el.endTitle.textContent = r.victory ? state.stage.clearTitle : state.stage.lossTitle;
  const tiles = [
    ['SCORE', formatScore(s.score), r.bestScore || r.bestCampaign],
    ['KILLS', r.stageKills, false],
    ['ACCURACY', `${s.accuracy}%`, false],
    ['TIME', formatTime(s.time), r.bestTime],
    ['LEVEL', s.level, false],
    ['DAMAGE TAKEN', s.damageTaken, false],
  ];
  el.summary.textContent = '';
  for (const [label, value, best] of tiles) {
    const tile = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = value;
    const span = document.createElement('span');
    span.textContent = best ? `${label} · NEW BEST` : label;
    if (best) tile.className = 'is-best';
    tile.append(b, span);
    el.summary.append(tile);
  }
  el.bestLine.textContent = `${recordsLine(difficulty)}.`;
  el.renownLine.textContent = `Renown ${renown}. This run earned ${r.earned} career XP. Each Renown rank adds only $10 starting cash, so the combat curve does not require grinding.`;
  const hasNext = r.victory && !r.last;
  el.nextButton.classList.toggle('hidden', !hasNext);
  if (hasNext) el.nextButton.textContent = `CONTINUE — ${STAGES[state.stageIndex + 1].name.toUpperCase()}`;
  el.nextButton.toggleAttribute('data-default', hasNext);
  el.replayButton.toggleAttribute('data-default', !hasNext);
  el.replayButton.textContent = !r.victory ? 'TRY AGAIN' : r.last ? 'RIDE AGAIN' : `REPLAY ${state.stage.name.toUpperCase()}`;
  setMode('end');
}

el.nextButton.addEventListener('click', () => {
  if (results?.victory && !results.last) beginStage(state.stageIndex + 1, snapshotPlayer(state.player));
});
el.replayButton.addEventListener('click', () => {
  if (results?.victory && results.last) beginStage(0, null);
  else beginStage(state.stageIndex, stageCarry);
});
$('#title-button').addEventListener('click', toTitle);

/* ------------------------------------------------------------------ events, HUD, toasts */

function processEvents(events) {
  audio.handle(events);
  const p = state.player;
  for (const ev of events) {
    switch (ev.type) {
      case 'playerHit':
        flashTime = 0.1;
        input.rumble(0.55, 120);
        break;
      case 'posterFound':
        showToast('WARRANT FOUND — the gate is open');
        input.rumble(0.3, 90);
        break;
      case 'gateDenied':
        showToast('LOCKED — search the trail for the WANTED poster');
        break;
      case 'levelUp':
        showToast(`LEVEL ${ev.level} — damage +7%, +5 max health`);
        input.rumble(0.25, 80);
        break;
      case 'equipment':
        showToast(`${EQUIPMENT[ev.kind].label} — ${EQUIPMENT[ev.kind].detail}`);
        break;
      case 'bossIntro':
        showToast(state.stage.bossIntro);
        audio.music('boss');
        input.rumble(0.6, 260);
        break;
      case 'bossEnrage':
        showToast(state.stage.bossEnrage);
        input.rumble(0.5, 200);
        break;
      case 'bossDown':
        audio.music(null);
        input.rumble(1, 450);
        break;
      case 'defeat':
        audio.music(null);
        input.rumble(0.8, 400);
        break;
      case 'explosion': {
        const d = Math.hypot(ev.x - p.x, ev.z - p.z);
        if (d < 9) input.rumble(d < 4 ? 0.8 : 0.4, 200);
        break;
      }
      default:
        break;
    }
  }
}

/** True (and remembered) when a HUD value differs from what is on screen. */
function changed(key, value) {
  if (hud[key] === value) return false;
  hud[key] = value;
  return true;
}

function updateHUD() {
  const p = state.player;
  const hp = Math.max(0, Math.ceil(p.hp));
  const maxHp = Math.round(p.maxHp);
  if (changed('hp', hp) | changed('maxHp', maxHp)) {
    el.healthText.textContent = `${hp} / ${maxHp}`;
    el.healthFill.style.transform = `scaleX(${Math.min(1, hp / maxHp)})`;
  }
  const xp = Math.floor(p.xp);
  if (changed('level', p.level) | changed('xp', xp) | changed('xpNeed', p.xpNeed)) {
    el.levelText.textContent = `LV ${p.level}`;
    el.xpText.textContent = p.level >= 8 ? 'MAX LEVEL' : `${xp} / ${p.xpNeed} XP`;
    el.xpFill.style.transform = `scaleX(${p.level >= 8 ? 1 : Math.max(0, Math.min(1, p.xp / p.xpNeed))})`;
  }
  const cash = Math.floor(p.cash);
  if (changed('cash', cash)) el.cash.textContent = `$${cash}`;
  const score = Math.floor(p.score);
  if (changed('score', score)) el.score.textContent = String(score).padStart(6, '0');
  if (changed('objective', state.objective)) {
    el.objective.textContent = state.objective;
    requestAnimationFrame(placeTouchTop);
  }
  const boss = getBoss(state);
  if (changed('boss', !!boss)) el.bossHud.classList.toggle('hidden', !boss);
  if (boss) {
    const ratio = Math.round(Math.max(0, boss.hp / boss.maxHp) * 400) / 400;
    if (changed('bossRatio', ratio)) el.bossFill.style.transform = `scaleX(${ratio})`;
  }
}

function updateInteraction() {
  const near = mode === 'playing' && canUseShop(state);
  if (changed('near', near)) {
    el.tradeButton.classList.toggle('hidden', !near);
    kit.touch?.setShown('interact', near);
  }
}

let toastTimer = 0;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  el.toast.style.animation = 'none';
  void el.toast.offsetWidth;
  el.toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 1800);
}

/** The touch pills (the pause II) sit just under the HUD, whatever its height. */
function placeTouchTop() {
  if (!kit.touch) return;
  const r = el.hud.getBoundingClientRect();
  kit.touch.placeTop('left', r.height ? Math.round(r.bottom + 8) : 96);
}
kit.onResize(() => requestAnimationFrame(placeTouchTop));

function handleZoom(dt) {
  let z = input.zoom() * 0.1;
  if (input.down('zoomIn')) z += dt * 0.9;
  if (input.down('zoomOut')) z -= dt * 0.9;
  if (z) {
    view.setZoom(view.getZoom() * Math.exp(z));
    zoomDirty = true;
  }
}

/* ------------------------------------------------------------------ the loop */

function frame(dt, t) {
  const modeBefore = mode;
  handleUiInput(dt);
  // A press that just closed a menu (E closing the shop) must not act again in this frame.
  const menuJustClosed = mode !== modeBefore;
  frameEvents.length = 0;
  if (mode === 'playing' && state.status === 'playing') {
    if (!menuJustClosed && input.pressed('interact') && canUseShop(state)) {
      openShop();
    } else {
      const simInput = controls.read(state.player);
      accumulator = Math.min(accumulator + dt, STEP * 4);
      while (accumulator >= STEP) {
        updateGame(state, simInput, STEP);
        for (let i = 0; i < state.events.length; i++) frameEvents.push(state.events[i]);
        accumulator -= STEP;
        if (state.status !== 'playing') break;
      }
      state.events.length = 0;
    }
    handleZoom(dt);
    if (tutorialTimer > 0 && (tutorialTimer -= dt) <= 0) el.tutorial.classList.add('hidden');
  } else {
    accumulator = 0;
  }

  if (frameEvents.length) processEvents(frameEvents);
  const frozen = mode === 'pause' || mode === 'shop';
  view.render(state, frozen ? 0 : dt, frameEvents, t);
  if (mode !== 'title') {
    updateHUD();
    updateInteraction();
  }
  if (flashTime > 0) flashTime -= dt;
  if (changed('flash', flashTime > 0)) el.damageFlash.classList.toggle('active', flashTime > 0);

  if (mode === 'playing' && state.status !== 'playing') beginOutro();
  else if (mode === 'outro' && (endTimer -= dt) <= 0) showResults();
}

kit.touch?.setShown('interact', false);
refreshTitle();
setMode('title');
if (new URLSearchParams(location.search).has('debug')) {
  window.__dustshot = { get state() { return state; }, get mode() { return mode; }, view, beginStage, openShop };
}
kit.start(frame);
