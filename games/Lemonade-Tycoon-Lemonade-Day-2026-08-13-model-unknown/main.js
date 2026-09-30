/**
 * main.js — Lemonade Day on the shared 3D stack.
 *
 * boot() starts WebGPU (WebGL2 as fallback) and wires keyboard, mouse,
 * gamepad and touch into kit.input. The campaign state goes through the pure
 * reducer in sim.js; ui.js renders it; town.js draws the town in 3D. One
 * frame loop (kit.start) runs the stand's clock, the menus' gamepad and
 * keyboard navigation, the camera, and re-renders the interface when needed.
 */

import { boot } from 'kit/boot.js';
import * as S from './sim.js';
import { render } from './dom.js';
import { createTown } from './town.js';
import { createAudio } from './audio.js';
import { createNav } from './nav.js';
import * as store from './save.js';
import { titleView, topbarView, worldView, plannerView, overlayView } from './ui.js';

const $ = (id) => document.getElementById(id);
const rootEl = $('root');
const shell = $('game-shell');
const topbarEl = $('topbar');
const stageEl = $('stage');
const sceneMount = $('scene-mount');
const worldUi = $('world-ui');
const plannerEl = $('planner');
const titleRoot = $('title-root');
const overlayRoot = $('overlay-root');

const app = {
  screen: 'title',
  modal: null,
  modalReturn: null,
  specialty: null,
  settings: store.loadSettings(),
  savedGame: store.loadGame(),
  records: store.loadRecords(),
  saveStatus: 'Autosave ready',
  buzz: 'Pick a pitch on the map, then tune today’s plan.',
  speed: 1,
  tutorialStep: 0,
  controlsTab: null,
  source: 'keyboard',
  newBest: null,
  backendLabel: '',
};
let state = S.newCampaign('standard', 1, store.tutorialDone());

const kit = await boot({
  title: 'Lemonade Day',
  mount: sceneMount,
  gear: 'none', // the game's own Settings has a "Graphics & controls" button (F9 works too)
  accent: '#ffd83d',
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad' }, // menu navigation
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' }, // turn the town
    confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    journal: { keys: ['KeyJ'], gamepad: ['Back'] },
    speed: { keys: ['KeyF'], gamepad: ['Y'] },
    recenter: { keys: ['KeyC'], gamepad: ['RS'] },
    zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
    zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  },
});
const { input } = kit;
app.source = input.source;
app.backendLabel = kit.backendLabel;

kit.canvas.classList.add('town-canvas');
kit.canvas.setAttribute('aria-hidden', 'true');
kit.canvas.tabIndex = -1;

const audio = createAudio(() => app.settings);
const nav = createNav({ onMove: () => audio.play('nav') });

kit.loading.progress(0.75, 'Building today’s town…');
const town = createTown(kit);

// ---------------------------------------------------------------- derived values

const soldAt = (o, p) => (o ? Math.min(o.sales, Math.floor(o.sales * Math.min(1, p * 1.08))) : 0);
const rushOpenFor = (s) => s.phase === 'open' && s.progress >= S.RUSH_AT && !s.serviceDecisionMade && S.rushNeeded(s.outcome);
const receiptPaid = (orderId, fallback) => state.orderReceipts.find((r) => r.orderId === orderId)?.paidInvoice ?? fallback;

/** The values that follow the open day's clock (written into `d` in place). */
function deriveClock(d) {
  const s = state;
  const o = s.outcome;
  const p = s.progress;
  const sold = soldAt(o, p);
  d.sold = sold;
  d.visitorsSoFar = o ? Math.min(o.visitors, Math.floor(o.visitors * p)) : 0;
  d.stockLeft = Math.max(0, (o?.prepared ?? s.prepared) - sold);
  d.delightNow = o ? 65 + (o.cx - 65) * p : 0;
  d.clock = p < 0.24 ? '9:00 AM' : p < 0.5 ? '11:30 AM' : p < 0.76 ? '2:00 PM' : '4:30 PM';
  d.clockStatus = p < 0.24 ? 'Morning service has started.' : p < 0.5 ? 'The morning crowd has passed.' : p < 0.76 ? 'The stand is serving the afternoon crowd.' : p < 1 ? 'Last call is approaching.' : 'The stand has closed.';
  return d;
}

function derive() {
  const s = state;
  const weather = S.forecastFor(s.day, s.campaignSeed, s.forecastDeck);
  const plan = S.forecastPlan(S.planInput(s));
  const paid = S.paidBulk(plan.pack, plan.staffShift);
  const bulkSaving = S.round2(plan.pack.bulkInvoice - paid);
  const cornerSaving = S.round2(plan.pack.staffDiscount - bulkSaving);
  return deriveClock({
    weather,
    aligned: !weather.eventLocation || weather.eventLocation === s.location,
    plan,
    pantryNow: S.pantryTotals(s.pantry),
    cornerSaving,
    cornerPaid: S.round2(plan.pack.cornerInvoice - cornerSaving),
    receiptPaid,
    minSpend: S.minimumSpend(s.difficulty),
    showResults: s.phase === 'results' || s.phase === 'week-end',
    rushOpen: rushOpenFor(s),
    specialty: S.SPECIALTIES.find((u) => s.upgrades.includes(u)) ?? null,
    week: S.weekValue(s),
    stranded: S.isStranded(s),
    notes: S.pitchNotes(s.history),
  });
}

// What the town needs each frame (one object, updated in place).
const tv = { key: '', selected: 'park', phase: 'plan', progress: 0, prepared: 30, transport: 'crate', marketing: 'none', staff: null, upgrades: [], reducedMotion: false, weather: 'Sunny', stockLeft: 0, buyRatio: 0, sold: 0 };
function syncTownView() {
  const s = state;
  const o = s.outcome;
  tv.selected = s.phase === 'plan' ? s.location : o?.location ?? s.location;
  tv.phase = s.phase;
  tv.progress = s.progress;
  tv.prepared = o?.prepared ?? s.prepared;
  tv.transport = s.transport;
  tv.marketing = s.marketing;
  tv.staff = o?.staffShift?.id ?? s.scheduledStaff;
  tv.upgrades = s.upgrades;
  tv.reducedMotion = app.settings.reducedMotion;
  tv.weather = S.forecastFor(s.day, s.campaignSeed, s.forecastDeck).label;
  tv.sold = soldAt(o, s.progress);
  tv.stockLeft = Math.max(0, tv.prepared - tv.sold);
  tv.buyRatio = o ? Math.min(0.8, o.buyers / Math.max(1, o.visitors)) : 0;
  tv.key = `${tv.selected}-${tv.prepared}-${tv.transport}-${tv.marketing}-${tv.staff ?? 'solo'}-${tv.upgrades.join('.')}`;
}
/** Only the clock moved: refresh the few fields that follow it. */
function syncClock() {
  tv.progress = state.progress;
  tv.sold = soldAt(state.outcome, state.progress);
  tv.stockLeft = Math.max(0, tv.prepared - tv.sold);
}
syncTownView();
await town.warm(tv);

// ---------------------------------------------------------------- state changes and saving

let dirty = true;
let hudDirty = false;
let saveTimer = 0;
let lastQuarter = -1;

function writeSaveNow() {
  clearTimeout(saveTimer);
  if (app.screen !== 'game') return;
  const ok = store.saveGame(state);
  app.saveStatus = ok ? 'Saved just now' : 'Couldn’t save on this device';
  // Even without storage (private windows), Continue works for the rest of this visit.
  app.savedGame = state;
  dirty = true;
}
function scheduleSave(ms = 220) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeSaveNow, ms);
}

function recordWeek() {
  const w = S.weekValue(state);
  const result = store.recordWeek(app.records, state.difficulty, state.campaignSeed, {
    value: w.value,
    medal: w.medal,
    cups: state.history.reduce((a, x) => a + x.sales, 0),
    contracts: state.history.filter((x) => x.contractMet).length,
    reputation: state.reputation,
  });
  app.records = result.records;
  app.newBest = result.counted ? (result.first ? 'first' : result.isNewBest ? 'best' : null) : null;
}

function onStateChange(prev, next) {
  if (prev.phase === 'open' && (next.phase === 'results' || next.phase === 'week-end') && next.outcome) {
    const o = next.outcome;
    app.buzz = o.contractMet ? `Contract complete — ${S.money(o.contractReward)} bonus earned.` : 'Day closed. The ledger has the full story.';
    app.speed = 1;
    input.rumble(o.contractMet ? 0.5 : 0.3, 160);
    if (next.phase !== 'week-end') audio.play(o.contractMet ? 'goal' : 'sale');
  }
  if (next.phase === 'week-end' && prev.phase !== 'week-end') {
    recordWeek();
    audio.play('fanfare');
  }
  if (!rushOpenFor(prev) && rushOpenFor(next)) {
    app.buzz = 'Noon rush! The line is spilling down the block.';
    audio.play('rush');
    input.rumble(0.45, 220);
  }
  if (next.phase === 'open') {
    const q = Math.floor(next.progress * 4);
    if (q !== lastQuarter && q > 0) scheduleSave(80);
    lastQuarter = q;
  } else {
    lastQuarter = -1;
  }
}

function dispatch(action, { save = true } = {}) {
  const next = S.reducer(state, action);
  if (next === state) return false;
  const prev = state;
  state = next;
  onStateChange(prev, next);
  const phaseChanged = next.phase !== prev.phase;
  const clockOnly = action.type === 'CLOCK_ADVANCED' && !phaseChanged;
  if (clockOnly) syncClock();
  else syncTownView();
  if ((save || phaseChanged) && app.screen === 'game') scheduleSave();
  // The open-day HUD re-renders on its own schedule (see the frame loop).
  if (!clockOnly || rushOpenFor(next) !== rushOpenFor(prev)) dirty = true;
  return true;
}

function applySettings() {
  store.saveSettings(app.settings);
  document.documentElement.classList.toggle('reduce-game-motion', app.settings.reducedMotion);
  rootEl.classList.toggle('game-high-contrast', app.settings.highContrast);
  rootEl.classList.toggle('game-large-text', app.settings.largeText);
  tv.reducedMotion = app.settings.reducedMotion;
}
applySettings();

function randomSeed() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] || 1;
  } catch {
    return Date.now() >>> 0 || 1;
  }
}

// ---------------------------------------------------------------- actions

function openModal(k) {
  app.modalReturn = app.modal === 'pause' ? 'pause' : null;
  app.modal = k;
  if (k === 'tutorial') app.tutorialStep = 0;
  if (k === 'controls') app.controlsTab = null;
  input.settle();
  dirty = true;
}

const act = {
  continueGame() {
    const saved = app.savedGame;
    if (!saved) return;
    state = saved;
    syncTownView();
    app.buzz = saved.phase === 'open' ? 'Your open day was safely restored.' : 'Welcome back. Your stand is just as you left it.';
    app.screen = 'game';
    app.modal = saved.phase === 'open' ? 'pause' : null;
    app.modalReturn = null;
    app.specialty = null;
    app.newBest = null;
    app.speed = 1;
    lastQuarter = saved.phase === 'open' ? Math.floor(saved.progress * 4) : -1;
    input.settle();
    dirty = true;
  },
  newGame() {
    if (app.savedGame && app.modal !== 'newgame') {
      openModal('newgame');
      return;
    }
    act.startNew();
  },
  startNew() {
    const tutorialComplete = state.tutorialComplete || store.tutorialDone();
    dispatch({ type: 'NEW_CAMPAIGN_STARTED', difficulty: state.difficulty, campaignSeed: randomSeed(), tutorialComplete }, { save: false });
    app.buzz = 'Opening day starts here. Read the forecast, then build a plan.';
    app.screen = 'game';
    app.modal = tutorialComplete ? null : 'tutorial';
    app.modalReturn = null;
    app.tutorialStep = 0;
    app.specialty = null;
    app.newBest = null;
    app.speed = 1;
    lastQuarter = -1;
    town.recenter();
    audio.play('open');
    input.settle();
    scheduleSave();
    dirty = true;
  },
  newWeek() {
    app.modal = null;
    act.startNew();
  },
  selectDifficulty(id) {
    dispatch({ type: 'DIFFICULTY_SELECTED', difficulty: id }, { save: false });
    if (app.modal === 'newgame') app.modal = null;
    dirty = true;
  },
  openModal,
  closeModal() {
    app.modal = app.modalReturn;
    app.modalReturn = null;
    input.settle();
    dirty = true;
  },
  openPause() {
    app.modalReturn = null;
    app.modal = 'pause';
    input.settle();
    dirty = true;
  },
  resume() {
    app.modal = null;
    app.modalReturn = null;
    input.settle();
    dirty = true;
  },
  /** Close whatever panel is on top. Returns true when something closed. */
  back() {
    if (app.specialty) {
      act.cancelSpecialty();
      return true;
    }
    if (app.modal === 'pause') {
      act.resume();
      return true;
    }
    if (app.modal) {
      act.closeModal();
      return true;
    }
    return false;
  },
  pauseKey() {
    if (act.back()) return;
    if (app.screen === 'game' && (state.phase === 'plan' || state.phase === 'open') && !rushOpenFor(state)) act.openPause();
  },
  toggleJournal() {
    if (app.modal === 'journal') act.closeModal();
    else if (!app.modal && !app.specialty) openModal('journal');
  },
  saveAndTitle() {
    writeSaveNow();
    app.modal = null;
    app.modalReturn = null;
    app.specialty = null;
    app.screen = 'title';
    input.settle();
    dirty = true;
  },
  toggleSound() {
    act.setSetting('sound', !app.settings.sound);
    audio.play('click');
  },
  setSetting(k, v) {
    app.settings = { ...app.settings, [k]: v };
    applySettings();
    dirty = true;
  },
  openKitMenu() {
    kit.menu.open();
  },
  setSpeed(n) {
    app.speed = n;
    dirty = true;
  },
  skipDay() {
    if (state.outcome && state.phase === 'open') dispatch({ type: 'DAY_SKIPPED' });
  },
  openStand() {
    const plan = S.forecastPlan(S.planInput(state));
    if (!plan.affordable) {
      app.buzz = `You’re ${S.money(plan.expenses - state.cash)} short. Trim the plan before opening.`;
      dirty = true;
      return;
    }
    if (dispatch({ type: 'STAND_OPENED' })) {
      app.speed = 1;
      app.buzz = state.location === 'market' && S.isMarketDay(state.day) ? 'Open on market day! Browsers are already drifting over from the stalls.' : 'Open! Watch the morning crowd roll in.';
      audio.play('open');
      input.rumble(0.25, 80);
    }
  },
  chooseRush(choice) {
    if (!dispatch({ type: 'RUSH_RESOLVED', choice })) return;
    app.buzz =
      choice === 'hustle'
        ? 'The team speeds up the line — fast, but a little less personal.'
        : choice === 'samples'
          ? 'Samples draw curious passers into the line.'
          : 'A calm rhythm keeps the crowd smiling.';
    audio.play(choice === 'steady' ? 'click' : 'sale');
    input.settle();
  },
  setLocation(location, fromMap = false) {
    if (dispatch({ type: 'PLAN_UPDATED', patch: { location } }) && fromMap) audio.play('click');
  },
  setPrepared: (prepared) => dispatch({ type: 'PLAN_UPDATED', patch: { prepared } }),
  setLemon: (lemon) => dispatch({ type: 'PLAN_UPDATED', patch: { lemon } }),
  setSugar: (sugar) => dispatch({ type: 'PLAN_UPDATED', patch: { sugar } }),
  setIce: (ice) => dispatch({ type: 'PLAN_UPDATED', patch: { ice } }),
  setPrice: (price) => dispatch({ type: 'PLAN_UPDATED', patch: { price } }),
  setMarketing: (marketing) => dispatch({ type: 'PLAN_UPDATED', patch: { marketing } }),
  setService: (service) => dispatch({ type: 'PLAN_UPDATED', patch: { service } }),
  setStaff: (staff) => dispatch({ type: 'STAFF_SCHEDULED', staff }),
  setBulk: (preset) => dispatch({ type: 'BULK_PRESET_SELECTED', preset }),
  setTransport: (transport) => dispatch({ type: 'TRANSPORT_SELECTED', transport }),
  buyUpgrade(id) {
    const check = S.upgradeCheck(state.day, state.difficulty, state.cash, state.upgrades, id);
    if (!check.allowed || state.phase !== 'results') return;
    if (S.SPECIALTIES.includes(id)) {
      app.specialty = id;
      input.settle();
      dirty = true;
      return;
    }
    if (dispatch({ type: 'UPGRADE_PURCHASED', upgrade: id })) {
      audio.play('upgrade');
      input.rumble(0.2, 60);
    }
  },
  confirmSpecialty() {
    const id = app.specialty;
    app.specialty = null;
    if (id && S.upgradeCheck(state.day, state.difficulty, state.cash, state.upgrades, id).allowed && dispatch({ type: 'UPGRADE_PURCHASED', upgrade: id })) {
      app.buzz = `${S.UPGRADES[id].name} is now your booth specialty.`;
      audio.play('upgrade');
      input.rumble(0.3, 90);
    }
    input.settle();
    dirty = true;
  },
  cancelSpecialty() {
    app.specialty = null;
    input.settle();
    dirty = true;
  },
  nextDay() {
    const s = state;
    if (s.phase !== 'results' || s.day >= 7) return;
    const pantry = S.advancePantry(s.pantry, s.day + 1);
    const roster = S.unlockRoster(s.staffRoster, s.day + 1, s.history.some((x) => x.contractMet), s.reputation);
    const joined = S.STAFF_IDS.filter((id) => roster[id].unlocked && !s.staffIntroductionsSeen.includes(id));
    if (!dispatch({ type: 'NEXT_DAY_STARTED' })) return;
    const spoiled = Object.values(pantry.lastAdvance.spoiled).reduce((a, b) => a + b, 0);
    let msg = pantry.lastAdvance.arrivedOrderIds.length
      ? 'Bulk Club delivery arrived — the pantry is stocked.'
      : pantry.lastAdvance.delayedOrderIds.length
        ? 'Bulk Club called: today’s delivery is running one day late.'
        : spoiled
          ? `${spoiled} aging pantry units spoiled overnight. Fresh pickup is still available.`
          : 'New forecast, fresh chance. Build tomorrow’s plan.';
    if (S.isMarketDay(state.day)) msg += ' It’s market day at Old Mill Market.';
    app.buzz = joined.length ? `${joined.map((id) => S.STAFF[id].shortName).join(' and ')} joined the Sunshine Crew! ${msg}` : msg;
    audio.play('click');
  },
  emergencyFund() {
    if (dispatch({ type: 'EMERGENCY_FUND_ACCEPTED' })) app.buzz = 'The town’s Sunshine Fund added $15. Reputation dipped by 3, but the week can continue.';
  },
  wrapWeek() {
    if (dispatch({ type: 'WEEK_WRAPPED' })) app.buzz = 'The stand closed up for the week. Time to count the jars.';
  },
  finishTutorial() {
    dispatch({ type: 'TUTORIAL_COMPLETED' }, { save: app.screen === 'game' });
    store.setTutorialDone();
    act.closeModal();
  },
  stepTutorial(delta) {
    app.tutorialStep = Math.max(0, Math.min(4, app.tutorialStep + delta));
    dirty = true;
  },
  setControlsTab(tab) {
    app.controlsTab = tab;
    dirty = true;
  },
};

// ---------------------------------------------------------------- focus management

let lastTop = null;
const restoreTo = new WeakMap();
function manageFocus() {
  const top = nav.top();
  if (top === lastTop) return;
  const prev = lastTop;
  lastTop = top;
  if (!top) return;
  if (prev && !prev.isConnected) {
    // A panel closed: return focus to what had it before the panel opened.
    const r = restoreTo.get(prev);
    if (r && r !== document.body && nav.isVisible(r) && top.contains(r)) {
      r.focus({ preventScroll: true });
      return;
    }
    if (top.dataset.base) {
      const open = top.querySelector('.open-button:not(:disabled)');
      if (open && app.source !== 'touch') open.focus({ preventScroll: true });
      return;
    }
  }
  if (top.dataset.base) return;
  restoreTo.set(top, document.activeElement);
  if (top.dataset.focus === 'first') {
    const first = nav.focusables(top)[0];
    if (first) {
      first.focus({ preventScroll: true });
      return;
    }
  }
  (top.querySelector('[tabindex="-1"]') || top).focus?.({ preventScroll: true });
}

// ---------------------------------------------------------------- rendering

let labelEls = [];
const setBlocked = (el, on) => {
  if (el.inert === on) return;
  el.inert = on;
  if (on) el.setAttribute('aria-hidden', 'true');
  else el.removeAttribute('aria-hidden');
};

let lastD = null;

function renderAll() {
  dirty = false;
  hudDirty = false;
  const d = (lastD = derive());
  const ctx = { state, app, d, act };
  if (app.screen === 'title') {
    shell.hidden = true;
    render(titleRoot, titleView(ctx));
  } else {
    shell.hidden = false;
    render(titleRoot, null);
    const blocked = !!app.modal || !!app.specialty || d.showResults || d.rushOpen;
    setBlocked(topbarEl, blocked);
    setBlocked(stageEl, blocked);
    render(topbarEl, topbarView(ctx));
    render(worldUi, worldView(ctx));
    const plannerClass = `planner ${state.phase !== 'plan' ? 'locked' : ''}`;
    if (plannerEl.className !== plannerClass) plannerEl.className = plannerClass;
    render(plannerEl, plannerView(ctx));
    const sceneClass = `scene-mount weather-${d.weather.label.toLowerCase()}`;
    if (sceneMount.className !== sceneClass) sceneMount.className = sceneClass;
  }
  render(overlayRoot, overlayView(ctx));
  labelEls = [...worldUi.querySelectorAll('.map-label')];
  manageFocus();
}

/**
 * Only the open day's clock moved: refresh the world overlays (sold, stock,
 * visitors, delight, the progress bar) and leave the planner, the top bar and
 * the panels alone, so a running day does not re-diff the whole interface.
 */
function renderHud() {
  hudDirty = false;
  if (!lastD || app.screen !== 'game') return renderAll();
  render(worldUi, worldView({ state, app, d: deriveClock(lastD), act }));
}

input.onSourceChange((src) => {
  app.source = src;
  dirty = true;
});

// ---------------------------------------------------------------- the frame loop

const ZERO = { x: 0, y: 0 };
const labelAt = { x: 0, y: 0, visible: false };
let hudKey = -1;
let hoverId = null;
let downAt = null;
let dragDist = 0;
let prevSold = 0;
let lastCoinSound = 0;

function blockedNow() {
  return !!app.modal || !!app.specialty || state.phase === 'results' || state.phase === 'week-end' || rushOpenFor(state);
}

function handleActions(dt, blocked) {
  nav.update(dt, input.vector('move'));
  if (input.pressed('confirm')) nav.activate();
  if (input.pressed('back')) act.back();
  if (input.pressed('pause')) act.pauseKey();
  if (app.screen !== 'game') return;
  if (input.pressed('journal')) act.toggleJournal();
  if (input.pressed('speed') && state.phase === 'open' && !blocked) act.setSpeed(app.speed === 1 ? 4 : 1);
  if (input.pressed('recenter')) town.recenter();
  if (!blocked && input.pressed('zoomIn')) town.zoomBy(1);
  if (!blocked && input.pressed('zoomOut')) town.zoomBy(-1);
}

function handlePointer(blocked) {
  const p = input.pointer;
  const picking = state.phase === 'plan' && !blocked;
  if (p.justDown) {
    downAt = { x: p.x, y: p.y };
    dragDist = 0;
  }
  if (downAt) dragDist = Math.max(dragDist, Math.hypot(p.x - downAt.x, p.y - downAt.y));
  if (p.justUp && downAt) {
    if (dragDist < 8 && picking) {
      const id = town.pick(p.nx, p.ny);
      if (id) act.setLocation(id, true);
    }
    downAt = null;
  }
  const hover = picking && p.over && p.type === 'mouse' && !p.down ? town.pick(p.nx, p.ny) : null;
  if (hover !== hoverId) {
    hoverId = hover;
    town.setHovered(hover);
    kit.canvas.style.cursor = hover ? 'pointer' : '';
  }
}

function placeLabels() {
  for (const el of labelEls) {
    const id = el.dataset.loc;
    town.project(id, id === tv.selected ? 4.3 : 1.5, labelAt);
    const x = Math.round(labelAt.x);
    const y = Math.round(labelAt.y);
    if (el._x !== x || el._y !== y) {
      el._x = x;
      el._y = y;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
    const placed = labelAt.visible ? 'true' : 'false';
    if (el.dataset.placed !== placed) el.dataset.placed = placed;
  }
}

kit.start((dt, t) => {
  const blocked = blockedNow();
  handleActions(dt, blocked);

  if (app.screen === 'game') {
    // The stand's clock: about 15 seconds a day at 1x, stopped by any panel or the noon rush.
    if (state.phase === 'open' && !blocked) dispatch({ type: 'CLOCK_ADVANCED', amount: 0.065 * app.speed * dt }, { save: false });

    const look = input.look('look');
    if (blocked) nav.scroll(look.y * 420);
    handlePointer(blocked);
    town.update(dt, t, tv, blocked ? ZERO : look, blocked ? 0 : input.zoom());
    placeLabels();
    town.render();

    if (state.phase === 'open' && state.outcome) {
      const o = state.outcome;
      const p = state.progress;
      if (tv.sold > prevSold && t - lastCoinSound > 0.12) {
        audio.play('coin');
        lastCoinSound = t;
      }
      const key = ((tv.sold * 1000 + Math.min(999, Math.floor(o.visitors * p))) * 1000 + Math.round(p * 400)) * 1000 + Math.round(65 + (o.cx - 65) * p);
      if (key !== hudKey) {
        hudKey = key;
        hudDirty = true;
      }
    }
    prevSold = tv.sold;
  }

  if (dirty) renderAll();
  else if (hudDirty) renderHud();
});

// ---------------------------------------------------------------- page lifecycle

kit.onPause((paused) => audio.setPaused(paused || document.hidden));
document.addEventListener('visibilitychange', () => {
  audio.setPaused(document.hidden || kit.paused);
  if (document.hidden && app.screen === 'game') {
    if (state.phase === 'open' && !app.modal) {
      app.modal = 'pause';
      app.modalReturn = null;
      dirty = true;
    }
    writeSaveNow();
  }
});
addEventListener('pagehide', () => {
  if (app.screen === 'game') writeSaveNow();
});

renderAll();
