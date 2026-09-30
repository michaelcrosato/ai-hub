/**
 * main.js — Homefront Hearts on the shared 3D stack.
 *
 * Boots the kit (three.js r186 WebGPURenderer with its WebGL2 fallback) into
 * the world panel, builds the house, restores the auto-save, and routes all
 * input through kit.input actions: keyboard and mouse, controller, and touch
 * (taps on objects, drag to turn the house, pinch to zoom). The ledger and
 * dialogs are ordinary buttons, so a tap or click works on them directly;
 * the controller and arrow keys move through them with padnav.
 */

import { boot } from 'kit/boot.js';
import { METRIC_LABELS } from './data.js';
import { reduce, createGame, actionInfo, actionEffects, finalScore, legacyOf, currentProject, MAX_SLOTS, PROJECT_BY_ID } from './sim.js';
import { loadSave, writeSave, clearSave, recordCompletion } from './storage.js';
import { HouseWorld } from './world.js';
import { GameUI } from './ui.js';
import { createPadNav } from './padnav.js';
import { Sfx } from './audio.js';

/** Pixels of pointer travel that still count as a click or tap. */
const TAP_SLOP = 7;
/** How long the house gets to react before life interrupts the week. */
const WEEK_HOLD_MS = 1350;

const digits = {};
for (let n = 1; n <= 10; n++) digits[`slot${n}`] = { keys: [`Digit${n % 10}`, `Numpad${n % 10}`] };

const kit = await boot({
  title: 'Homefront Hearts',
  mount: document.getElementById('world'),
  gear: 'none', // the game's own menu has "Graphics and controls" (F9 also opens it)
  accent: '#f47c7c',
  // The loading card's text is light, so it sits on the game's ink colour rather than the pale sky.
  background: 'linear-gradient(145deg, #283044, #35546a)',
  input: {
    // Interface navigation: the D-pad or left stick on a controller, the arrow keys on a keyboard.
    nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
    // Turning the house: drag with the mouse or a finger.
    orbit: { type: 'look', mouse: 'drag', gamepad: [], touch: 'drag' },
    // Right stick: turn the house sideways, scroll the ledger or a dialog up and down.
    stick: { type: 'look', mouse: 'none', gamepad: 'rightStick' },
    turn: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
    zoomKeys: { type: 'axis', keys: { pos: ['Equal', 'NumpadAdd'], neg: ['Minus', 'NumpadSubtract'] }, gamepad: { pos: 'RB', neg: 'LB' } },
    recenter: { keys: ['KeyR', 'Home'], gamepad: ['RS'] },
    confirm: { gamepad: ['A'] },
    back: { gamepad: ['B'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    run: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['X'] },
    undo: { keys: ['Backspace', 'Delete'] },
    catalog: { keys: ['KeyC'], gamepad: ['Y'] },
    journal: { keys: ['KeyJ'], gamepad: ['Back'] },
    help: { keys: ['KeyH', 'F1'] },
    prevTab: { keys: ['BracketLeft'], gamepad: ['LT'] },
    nextTab: { keys: ['BracketRight'], gamepad: ['RT'] },
    ...digits,
  },
});

kit.loading.progress(0.7, 'Opening the household ledger…');

const sfx = new Sfx();
kit.onPause((paused) => sfx.setPaused(paused));

const world = new HouseWorld(kit);
let state = loadSave() ?? createGame();
world.sync(state);

const ui = new GameUI({
  kit,
  sfx,
  dispatch,
  hooks: {
    start(payload) {
      dispatch({ type: 'START', payload });
      ui.open('help');
    },
    newGame() {
      clearSave();
      ui.reset();
      world.resetView();
      dispatch({ type: 'RESET' });
    },
    openGraphics: () => kit.menu.open(),
    resetView: () => world.resetView(),
    preview: (id) => world.setPreview(id),
    hasHotspot: (id) => world.hasHotspot(id),
    toggleSound: () => sfx.setEnabled(!sfx.enabled),
  },
});
ui.update(state);

const padnav = createPadNav({ input: kit.input, getRoot: () => ui.navRoot(), getDefault: (root) => ui.navDefault(root) });

try {
  await world.warm();
} catch (err) {
  console.warn('[homefront] pipeline warm-up skipped:', err);
}

// ------------------------------------------------------------------ state changes

function dispatch(action) {
  const prev = state;
  const next = reduce(prev, action);
  if (next === prev) return prev;
  state = next;
  if (action.type === 'DISMISS_NOTICE') {
    ui.noticeChanged(state, prev, action);
    return state;
  }
  writeSave(state);
  const effects = react(prev, next, action);
  world.sync(state);
  ui.update(state, prev, action);
  if (effects.celebrate) world.celebrate(effects.celebrate);
  if (effects.floaters) ui.spawnFloaters(effects.floaters());
  if (effects.record) dispatch({ type: 'MARK_RECORDED', record: effects.record });
  return state;
}

/** Sound, rumble and animation for each change; returns follow-ups that need the updated world. */
function react(prev, next, action) {
  const out = {};
  const input = kit.input;
  switch (action.type) {
    case 'START':
      sfx.play('start');
      break;
    case 'ADD_ACTION':
      if (next.plan.length > prev.plan.length) {
        sfx.play('add');
        input.rumble(0.12, 40);
      } else if (next.notice) sfx.play('deny');
      break;
    case 'REMOVE_ACTION':
    case 'CLEAR_PLAN':
      sfx.play('remove');
      break;
    case 'RUN_WEEK':
      if (next.pendingEvent && !prev.pendingEvent) {
        ui.holdWeek(WEEK_HOLD_MS);
        sfx.play(next.lastProject ? 'project' : 'week');
        input.rumble(next.lastProject ? 0.45 : 0.3, next.lastProject ? 220 : 140);
        out.celebrate = prev.plan;
        out.floaters = () => weekFloaters(prev, next);
      } else if (next.notice) sfx.play('deny');
      break;
    case 'CHOOSE_EVENT':
      sfx.play(next.pendingMilestone ? 'milestone' : 'choice');
      input.rumble(0.2, 80);
      break;
    case 'CHOOSE_MILESTONE':
      if (next.completed) {
        sfx.play('finale');
        input.rumble(0.6, 320);
        if (!next.recorded) out.record = recordCompletion({ score: finalScore(next), pace: next.difficulty, legacy: legacyOf(next).id });
      } else {
        sfx.play('milestone');
        input.rumble(0.5, 220);
      }
      break;
    case 'BUY_ITEM':
      if (next.household.owned.length > prev.household.owned.length) {
        sfx.play('buy');
        input.rumble(0.25, 80);
      } else sfx.play('deny');
      break;
    default:
      break;
  }
  return out;
}

/** One rising label per planned priority, over its object in the house. */
function weekFloaters(prev, next) {
  const counts = new Map();
  for (const id of prev.plan) counts.set(id, (counts.get(id) || 0) + 1);
  const items = [];
  const project = currentProject(prev);
  let i = 0;
  for (const [id, n] of counts) {
    const info = actionInfo(id, prev);
    if (!info) continue;
    let text = '';
    let good = true;
    if (id === 'project') text = n > 1 ? `+${n} steps` : '+1 step';
    else {
      const effects = actionEffects(id, prev);
      const best = Object.entries(effects)
        .filter(([k, v]) => METRIC_LABELS[k] && v)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      if (best) {
        const [k, v] = best;
        const total = v * n;
        text = `${total > 0 ? '+' : ''}${Math.round(total)} ${k === 'mentalLoad' ? 'Load' : METRIC_LABELS[k]}`;
        good = k === 'mentalLoad' || k === 'wear' ? total < 0 : total > 0;
      }
    }
    const at = id === 'project' && project ? world.projectPoint(project.id) : world.screenPoint(id);
    const x = at ? at.x : world.width * (0.3 + 0.13 * i);
    const y = at ? at.y : world.height * 0.45;
    items.push({ x, y, icon: info.icon, text, good });
    i++;
  }
  if (next.lastProject) {
    const p = PROJECT_BY_ID[next.lastProject];
    const at = p ? world.projectPoint(p.id) : null;
    if (p) items.push({ x: at ? at.x : world.width / 2, y: at ? at.y - 34 : world.height * 0.35, icon: p.icon, text: 'Finished!', good: true });
  }
  return items;
}

addEventListener('pagehide', () => writeSave(state));

// ------------------------------------------------------------------ per frame

const press = { x: 0, y: 0, dist: 0, gesture: false, active: false };
const hoverAt = { x: NaN, y: NaN };

function clearHover() {
  if (!world.hovered && !ui.hoverAction) return;
  world.setHover(null);
  ui.setHover(null);
  kit.canvas.style.cursor = '';
  hoverAt.x = NaN;
}

function frame(dt, t) {
  const input = kit.input;
  const modal = ui.hasModal();
  const started = !!state.started;

  // Dialogs and the ledger: D-pad, left stick or arrow keys move focus, A selects.
  padnav.update(input.vector('nav'), input.pressed('confirm'));
  if (input.pressed('pause')) ui.onPauseKey();
  if (input.pressed('back') && !ui.onBack()) padnav.clear();

  if (modal) {
    for (let n = 1; n <= 9; n++) if (input.pressed(`slot${n}`)) ui.chooseByNumber(n);
  } else if (started) {
    const locked = ui.locked();
    if (input.pressed('run') && !locked) dispatch({ type: 'RUN_WEEK' });
    if (input.pressed('undo') && !locked && state.plan.length) dispatch({ type: 'REMOVE_ACTION', index: state.plan.length - 1 });
    if (input.pressed('catalog')) ui.openCatalog();
    if (input.pressed('journal')) ui.open('journal');
    if (input.pressed('help')) ui.open('help');
    if (input.pressed('prevTab')) ui.cycleCategory(-1);
    if (input.pressed('nextTab')) ui.cycleCategory(1);
    if (!locked && state.plan.length < MAX_SLOTS) {
      for (let n = 1; n <= 10; n++) {
        if (!input.pressed(`slot${n}`)) continue;
        const a = ui.shownActions()[n - 1];
        if (a) dispatch({ type: 'ADD_ACTION', actionId: a.id });
      }
    }
  } else {
    // The start card: H opens the briefing, Enter / Space (or X) begins the marriage.
    if (input.pressed('help')) ui.open('help');
    else if (input.pressed('run')) ui.submitStart();
  }

  const worldLive = started && !modal;

  // Camera: Q/E and +/- (or LB/RB) turn and zoom, the wheel or a pinch zooms, R or RS resets.
  const wheel = input.zoom();
  if (worldLive) {
    const turn = input.value('turn');
    if (turn) world.rotateBy(turn * 1.3 * dt);
    const zk = input.value('zoomKeys');
    if (zk) world.zoomBy(zk * 1.4 * dt);
    if (wheel) world.zoomBy(wheel * 0.12);
    if (input.pressed('recenter')) world.resetView();
  }

  // Right stick: scroll whatever panel has the controller's focus (or the ledger); sideways turns the house.
  const stick = input.look('stick');
  if (stick.x || stick.y) {
    let scroller = padnav.scroller() || (modal ? document.querySelector('#modal-layer .modal-backdrop:last-child .modal-body') : document.getElementById('sidebar'));
    // On narrow screens the ledger is not a scroll box of its own: the page scrolls instead.
    if (stick.y && scroller && scroller.scrollHeight <= scroller.clientHeight + 1 && !modal) scroller = document.scrollingElement;
    if (stick.y && scroller) scroller.scrollTop += stick.y * 520;
    if (stick.x && worldLive) world.rotateBy(-stick.x);
  }

  // Mouse and touch on the house: drag turns it, a click or tap adds the object's priority.
  const p = input.pointer;
  if (p.justDown) Object.assign(press, { x: p.x, y: p.y, dist: 0, gesture: false, active: true });
  if (press.active) {
    press.dist = Math.max(press.dist, Math.hypot(p.x - press.x, p.y - press.y));
    if (wheel && p.type === 'touch') press.gesture = true;
    const look = input.look('orbit');
    if (worldLive && press.dist > TAP_SLOP && look.x) world.rotateBy(-look.x);
  }
  if (p.justUp && press.active) {
    press.active = false;
    if (worldLive && press.dist <= TAP_SLOP && !press.gesture) {
      const hit = world.pick(p.nx, p.ny);
      if (hit) dispatch({ type: 'ADD_ACTION', actionId: hit.actionId });
    }
  }

  // Hover (mouse only): lift the object under the pointer and name its priority.
  if (worldLive && p.type === 'mouse' && p.over && !p.down) {
    if (p.x !== hoverAt.x || p.y !== hoverAt.y || world.pickDirty) {
      hoverAt.x = p.x;
      hoverAt.y = p.y;
      world.pickDirty = false;
      const hit = world.pick(p.nx, p.ny);
      world.setHover(hit);
      ui.setHover(hit ? hit.actionId : null);
      kit.canvas.style.cursor = hit ? 'pointer' : '';
    }
  } else clearHover();

  world.update(dt, t);
  world.render();
  ui.tick();
}

kit.start(frame);

// For automated checks and the QA crew.
window.__homefront = {
  get state() {
    return state;
  },
  dispatch,
  world,
  ui,
  kit,
};
