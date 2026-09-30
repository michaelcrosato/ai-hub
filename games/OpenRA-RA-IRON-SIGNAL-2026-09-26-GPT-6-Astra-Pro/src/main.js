/*
 * IRON SIGNAL — the game shell: boot on the shared kit, menus, HUD, and input.
 *
 * Every gameplay input arrives as a kit.input action. Mouse and touch on the battlefield
 * come through kit.input.pointer (with the click / rclick / mclick button actions, the
 * one-finger `drag` look action and kit.input.zoom() for wheel and pinch); the keyboard
 * shortcuts and every controller button are named actions below. A controller drives a
 * free cursor (pad.js) that can press any HUD button, so the sidebar, command bar and
 * menus all work without a mouse; in menus the D-pad or the arrow keys jump between
 * buttons. The HUD and menus stay DOM; their buttons are ordinary click targets.
 */
import { boot } from 'kit/boot.js';
import { TOUCH_LOOK } from 'kit/input.js';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';
import { AudioBus } from './audio.js';
import { icon } from './icons.js';
import { TYPES, UPGRADES, CATALOG, CATEGORIES, MISSIONS, FACTIONS, DIFFICULTIES, SPEEDS, TITLE, MODEL, GENERATED, VERSION, STEP, POPULATION } from './catalog.js';
import { clamp } from './map.js';
import { Debris } from './debris.js';
import { BattlefieldRenderer } from './renderer.js';
import { PadCursor, focusablesIn, primaryIn, nearestInDirection, adjust, activate } from './pad.js';

const LAST_MISSION = MISSIONS.length - 1;
/** Operation 03 closes the main campaign; Operation 04 is the epilogue that unlocks after it. */
const FINALE = 2;
const DIRS = ['Up', 'Down', 'Left', 'Right'];

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const text = (s, value) => {
  const n = $(s);
  if (n && n.textContent !== String(value)) n.textContent = value;
};
const timeLabel = (t) => `${String(Math.floor(Math.max(0, t) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, '0')}`;
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* ------------------------------------------------------------------ input actions */

const ACTIONS = {
  // Camera: arrows or the right stick pan, one finger drags, wheel / pinch / bumpers zoom, Q/E turn.
  pan: { type: 'vector', keys: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] }, gamepad: 'rightStick' },
  drag: { type: 'look', mouse: 'none', touch: 'drag', gamepad: [] },
  rotate: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] } },
  turn: { gamepad: ['RS'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  // The controller cursor and its buttons (mouse and touch use kit.input.pointer).
  cursor: { type: 'vector', gamepad: 'leftStick' },
  confirm: { gamepad: ['A'] },
  order: { gamepad: ['X', 'RT'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  // Mouse buttons and modifier keys.
  click: { mouse: [0] },
  rclick: { mouse: [2] },
  mclick: { mouse: [1] },
  shift: { keys: ['ShiftLeft', 'ShiftRight'] },
  ctrl: { keys: ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'] },
  // Orders and shortcuts (the classic Red Alert letters on the keyboard).
  attackMove: { keys: ['KeyA'], gamepad: ['Y'] },
  stop: { keys: ['KeyS'], gamepad: ['Down'] },
  deploy: { keys: ['KeyD'], gamepad: ['Right'] },
  home: { keys: ['KeyH'], gamepad: ['Left'] },
  army: { keys: ['F2'], gamepad: ['Up'] },
  focus: { keys: ['Space'], gamepad: ['LS'] },
  rotateBuilding: { keys: ['KeyR'] },
  build: { keys: ['KeyB'], gamepad: ['Back'] },
  mute: { keys: ['KeyM'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  // Menus: the arrows or the D-pad move between buttons.
  navUp: { keys: ['ArrowUp'], gamepad: ['Up'] },
  navDown: { keys: ['ArrowDown'], gamepad: ['Down'] },
  navLeft: { keys: ['ArrowLeft'], gamepad: ['Left'] },
  navRight: { keys: ['ArrowRight'], gamepad: ['Right'] },
};
for (let i = 1; i <= 9; i++) ACTIONS[`group${i}`] = { keys: [`Digit${i}`, `Numpad${i}`] };

/** Button prompts for the device in use. */
const PROMPTS = {
  move: { label: 'Move without stopping to fight', keys: '', pad: '', touch: '' },
  attackMove: { label: 'Advance and engage', keys: 'A', pad: 'Y', touch: '' },
  stop: { label: 'Stop and guard', keys: 'S', pad: 'D-pad ↓', touch: '' },
  deploy: { label: 'Deploy selected MCV', keys: 'D', pad: 'D-pad →', touch: '' },
  repair: { label: 'Toggle repair on structures; engineers repair a target', keys: '', pad: '', touch: '' },
  sell: { label: 'Sell selected structures', keys: '', pad: '', touch: '' },
  select: { label: 'Drag a selection rectangle', keys: '', pad: '', touch: '' },
  build: { label: 'Open production', keys: 'B', pad: 'View', touch: '' },
  pause: { label: 'Pause', keys: 'Esc', pad: 'Start', touch: '' },
};

/* ------------------------------------------------------------------ state */

let local = null;
try {
  local = window.localStorage;
} catch {
  local = null;
}
const storage = new Storage(local);
const settings = storage.settings();
const audio = new AudioBus(settings);
const selected = new Set();
const hoverAt = { x: -1, y: -1, frame: -100 };
const worldRect = { left: 0, top: 0, width: 1, height: 1 };
const navRepeat = { dir: null, at: 0 };
const panPoint = { x: 0, y: 0, visible: false };
let sim = null;
let inGame = false;
let modalKind = '';
let modalSerial = 0;
let category = 'structures';
let orderMode = '';
let placement = null;
let rotation = 0;
let placementKey = '';
let placementOk = false;
let selectionStamp = '';
let queueStamp = '';
let objectiveStamp = '';
let groups = {};
let lastGroup = { key: null, time: 0 };
let resultShown = false;
let saveElapsed = 0;
let uiElapsed = 0;
let diagElapsed = 0;
let accumulator = 0;
let lastModalFocus = null;
let launching = false;
let drag = null;
let padDrag = null;
let padScopeKey = '';
let lastTap = { id: 0, time: 0 };
let progress = storage.progress();

const demo = new Simulation({ difficulty: 'story' });
function makeDemonstration() {
  demo.deploy(demo.owned(0, 'mcv')[0].id);
  demo.spawn('power', 0, 10, 55);
  demo.spawn('refinery', 0, 23, 45);
  demo.spawn('barracks', 0, 33, 58);
  demo.spawn('factory', 0, 34, 73);
  demo.spawn('radar', 0, 10, 73);
  demo.spawn('harvester', 0, 24, 51);
  demo.spawn('medium', 0, 31, 65);
  demo.spawn('medium', 0, 35, 64);
  demo.spawn('light', 0, 35, 69);
  demo.spawn('longbow', 0, 17, 38);
  demo.explored[0].fill(1);
  demo.visibility[0].fill(1);
  demo.entities = demo.entities.filter((e) => e.owner !== 1);
  demo.map.rebuild(demo.entities);
  demo.events = [];
  demo.time = 10;
}
makeDemonstration();

/* ------------------------------------------------------------------ boot */

const kit = await boot({
  title: 'IRON SIGNAL',
  physics: true,
  mount: $('#world'),
  gear: 'none',
  accent: '#d9e8a2',
  background: '#1c3029',
  touch: { top: 'right', topOffset: 8, hint: false },
  input: ACTIONS,
});
kit.loading.progress(0.7, 'Laying out the battlefield…');
const debris = new Debris(kit.RAPIER, kit.tier.detail);
kit.onQuality((tier) => debris.setDetail(tier.detail));
const view = new BattlefieldRenderer(kit, $('#world'), debris, settings);
view.selected = selected;
view.reset(demo, true);
const pad = new PadCursor();
kit.loading.progress(0.85, 'Compiling shaders…');
try {
  await view.prewarm();
} catch (error) {
  console.warn('Shader prewarm skipped', error);
}

/* ------------------------------------------------------------------ helpers */

function key(name) {
  const p = PROMPTS[name];
  if (!p) return '';
  const src = kit.input.source;
  const v = src === 'gamepad' ? p.pad : src === 'touch' ? p.touch : p.keys;
  return v ? ` [${v}]` : '';
}

function showNotice(message, kind = 'normal') {
  if (!inGame) return;
  const stack = $('#notice-stack'), n = document.createElement('div');
  n.className = `notice ${kind}`;
  n.textContent = message;
  stack.append(n);
  while (stack.children.length > 4) stack.firstElementChild.remove();
  setTimeout(() => n.remove(), 6500);
}

function saveSettings() {
  storage.write('settings', settings);
  audio.update();
  view.setEffects(settings.effects);
  $('#diagnostics').hidden = !settings.diagnostics;
  text('#mute-button', settings.muted ? '♩' : '♪');
  $('#mute-button').setAttribute('aria-label', settings.muted ? 'Unmute audio' : 'Mute audio');
}

function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings();
  audio.unlock().then(() => audio.music('music'));
}

function saveGame(notify = false) {
  if (!inGame || !sim || sim.status !== 'active') return false;
  const ok = storage.save(sim, { x: view.target.x, z: view.target.z, zoom: view.zoomGoal, yaw: view.yawGoal });
  if (notify) showNotice(ok ? 'Checkpoint saved to this browser.' : storage.lastError, ok ? 'reward' : 'warning');
  return ok;
}

function refreshTitle() {
  progress = storage.progress();
  const checkpoint = storage.read('save');
  $('#continue-button').hidden = !checkpoint?.game;
  $('#campaign-button').classList.toggle('primary', !checkpoint?.game);
  $('#campaign-button').classList.toggle('secondary', !!checkpoint?.game);
  $('#campaign-button').innerHTML = `${checkpoint?.game ? 'New campaign' : 'Begin campaign'} <span>↗</span>`;
  $('#operation-cards').innerHTML = MISSIONS.map((m, i) => {
    const locked = i > progress.unlocked, best = storage.best(i);
    const status = progress.completed.includes(i)
      ? `✓ COMPLETED${best ? ` · BEST ${timeLabel(best.time)}` : ''}`
      : !locked
        ? 'VIEW BRIEFING ↗'
        : m.epilogue
          ? 'LOCKED / FINISH OPERATION 03'
          : 'LOCKED / COMPLETE PRIOR OPERATION';
    return `<button class="operation-card ${locked ? 'locked' : ''}" data-operation="${i}" aria-label="${escape(m.name)}${locked ? ', locked' : ''}"><span class="op-num">${m.number}</span><small>${m.region}${m.epilogue ? ' · EPILOGUE' : ''}</small><strong>${m.name}</strong><em>${status}</em></button>`;
  }).join('');
}

function updateWorldRect() {
  const r = $('#world').getBoundingClientRect();
  worldRect.left = r.left;
  worldRect.top = r.top;
  worldRect.width = r.width;
  worldRect.height = r.height;
}

/** The kit's touch pill (pause) only shows during play; game menus and the title use their own buttons. */
function syncTouch() {
  kit.touch?.suspend(!inGame || !!modalKind, 'game');
}

function interactive() {
  return inGame && !!sim && !modalKind && !sim.paused && sim.status === 'active';
}

function menuScope() {
  if (modalKind) return $('#modal');
  if (!inGame) return $('#title-screen');
  return null;
}

/* ------------------------------------------------------------------ orders */

function setSelection(ids, append = false) {
  if (!append) selected.clear();
  for (const id of ids) {
    const e = sim?.get(id);
    if (e?.owner === 0) selected.add(id);
  }
  selectionStamp = '';
  audio.play('select');
  renderUI(true);
}

function cancelOrder() {
  orderMode = '';
  placement = null;
  rotation = 0;
  placementKey = '';
  view.setPlacement(null);
  $('#order-hint').hidden = true;
  $$('[data-command]').forEach((b) => b.classList.remove('active'));
}

function armOrder(mode) {
  if (!inGame || sim?.status !== 'active') return;
  cancelOrder();
  orderMode = mode;
  const cancel = kit.input.source === 'gamepad' ? 'B cancels' : kit.input.source === 'touch' ? 'tap the order again to cancel' : 'Esc cancels';
  const pick = kit.input.source === 'gamepad' ? 'Point and press A or X' : kit.input.source === 'touch' ? 'Tap' : 'Click';
  const hints = {
    move: `${pick} a destination · ${cancel}`,
    attackMove: `${pick} an attack-move destination · ${cancel}`,
    scan: `${pick} an area to reveal · ${cancel}`,
    strike: `${pick} a visible missile target · ${cancel}`,
    select: 'Drag a rectangle around your forces',
    repairUnit: `${pick} a friendly building to repair · ${cancel}`,
  };
  text('#order-hint', hints[mode] || 'Choose a target');
  $('#order-hint').hidden = false;
  $(`[data-command="${mode}"]`)?.classList.add('active');
  audio.play('ui');
}

function startPlacement(type) {
  cancelOrder();
  placement = type;
  orderMode = 'place';
  const rotate = kit.input.source === 'gamepad' ? 'Y rotates · B cancels' : kit.input.source === 'touch' ? 'tap a clear site' : 'R rotates · Esc cancels';
  text('#order-hint', `Place ${TYPES[type].name} near your base · ${rotate}`);
  $('#order-hint').hidden = false;
  document.body.classList.remove('build-open');
  audio.play('ui');
}

function orderAt(point, entity, shift = false) {
  if (!point || !interactive()) return;
  if (placement) {
    const answer = sim.place(placement, point.x, point.z, 0, rotation);
    if (answer.ok) {
      setSelection([answer.id]);
      cancelOrder();
      renderUI(true);
    } else {
      showNotice(answer.reason, 'warning');
      audio.play('denied');
    }
    return;
  }
  if (orderMode === 'scan' || orderMode === 'strike') {
    const result = sim.support(orderMode, point);
    if (result.ok) cancelOrder();
    else {
      showNotice(result.reason, 'warning');
      audio.play('denied');
    }
    return;
  }
  if (!selected.size) {
    showNotice('Select a unit or production building first.');
    return;
  }
  const target = entity ? { x: entity.x, z: entity.z, id: entity.id } : point;
  let action = orderMode === 'attackMove' ? 'attackMove' : orderMode === 'move' ? 'move' : orderMode === 'repairUnit' ? 'repair' : 'context';
  // A selected production building uses context-click ground as its rally point.
  if ([...selected].every((id) => TYPES[sim.get(id)?.type]?.kind === 'building') && action === 'context') action = 'move';
  sim.command([...selected], action, target, 0, shift);
  audio.play(action === 'attack' || action === 'attackMove' || (entity && entity.owner === 1) ? 'attack' : 'order');
  if (!shift) cancelOrder();
}

function deploySelected() {
  const mcv = [...selected].map((id) => sim.get(id)).find((e) => e?.type === 'mcv');
  if (!mcv) {
    showNotice('Select your mobile construction vehicle first.');
    return;
  }
  const r = sim.deploy(mcv.id);
  if (r.ok) {
    setSelection([r.id]);
    category = 'structures';
    renderBuildCards();
  } else {
    showNotice(r.reason, 'warning');
    audio.play('denied');
  }
}

function selectAllArmy() {
  setSelection(sim.owned(0).filter((e) => TYPES[e.type].kind === 'unit' && TYPES[e.type].damage > 0).map((e) => e.id));
}

function home() {
  const b = sim?.owned(0, 'conyard')[0] || sim?.owned(0, 'mcv')[0] || sim?.owned(0)[0];
  if (b) view.focus(b.x, b.z, true);
}

function focusSelection() {
  const es = [...selected].map((id) => sim?.get(id)).filter(Boolean);
  if (es.length) view.focus(es.reduce((n, e) => n + e.x, 0) / es.length, es.reduce((n, e) => n + e.z, 0) / es.length, true);
}

/** B / View: on phones the production drawer slides in; with a controller the cursor jumps to the first build card. */
function toggleBuild() {
  const drawer = innerWidth <= 760;
  if (drawer) {
    document.body.classList.toggle('build-open');
    if (document.body.classList.contains('build-open')) view.drawMinimap($('#minimap'), sim);
  }
  if (!drawer || document.body.classList.contains('build-open')) {
    const card = $$('#build-grid .build-card').find((c) => !c.classList.contains('locked')) || $('#build-grid .build-card');
    if (!card) return;
    const land = () => {
      card.scrollIntoView({ block: 'nearest' });
      card.focus({ preventScroll: true });
      if (pad.active) pad.snap(card);
    };
    if (drawer) setTimeout(land, 230);
    else land();
  }
}

/* ------------------------------------------------------------------ menus */

function modal(html, kind = 'generic', wide = false) {
  if (sim && inGame) sim.paused = true;
  lastModalFocus = document.activeElement;
  modalKind = kind;
  modalSerial++;
  cancelOrder();
  drag = null;
  padDrag = null;
  view.dragRect = null;
  $('#modal').classList.toggle('wide', wide);
  $('#modal-content').innerHTML = html;
  $('#modal-backdrop').hidden = false;
  $('#modal-close').hidden = ['briefing', 'result'].includes(kind);
  $('#modal').scrollTop = 0;
  $('#modal').focus({ preventScroll: true });
  syncTouch();
}

function closeModal() {
  $('#modal-backdrop').hidden = true;
  modalKind = '';
  modalSerial++;
  if (sim && inGame && sim.status === 'active' && !document.hidden) sim.paused = false;
  if (lastModalFocus?.isConnected && lastModalFocus !== document.body) lastModalFocus.focus({ preventScroll: true });
  accumulator = 0;
  kit.input.settle();
  syncTouch();
}

/** B, Esc or the × button: step back out of the open menu. */
function modalBack() {
  if (modalKind === 'result') return;
  if (modalKind === 'briefing') {
    $('#briefing-back')?.click();
    return;
  }
  if (inGame && ['options', 'controls', 'restart'].includes(modalKind)) pauseMenu();
  else closeModal();
}

const modalHeader = (label, title, meta = 'FIELD OPERATIONS') => `<div class="modal-topline"><span class="eyebrow">${label}</span><span>${meta}</span></div><h2 id="modal-title">${title}</h2>`;

function showBriefing(index = 0, mode = 'campaign', carry = {}) {
  const m = MISSIONS[index], skirmish = mode === 'skirmish', best = storage.best(index, mode);
  const objectives = skirmish ? ['Establish a base and protect every construction yard', 'Destroy the enemy construction yard'] : m.primary;
  modal(
    `${modalHeader(skirmish ? 'SKIRMISH / MISSION SETUP' : `OPERATION ${m.number} / BRIEFING${m.epilogue ? ' / EPILOGUE' : ''}`, skirmish ? 'Choose your front.' : m.name, m.region)}
    <p class="briefing-text">${skirmish ? 'Build a base and defeat an enemy commander. Both sides harvest resources, produce units, and fight for control of the map. There is no campaign deadline.' : m.briefing}</p>
    <div class="setup-options">${skirmish ? `<label>Battlefield<select id="setup-map">${MISSIONS.map((s, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>${s.region}</option>`).join('')}</select></label>` : ''}
      <label>Command<select id="setup-faction">${Object.entries(FACTIONS).map(([k, f]) => `<option value="${k}" ${(carry.faction || 'allies') === k ? 'selected' : ''}>${f.name}</option>`).join('')}</select></label>
      <label>Difficulty<select id="setup-difficulty">${Object.entries(DIFFICULTIES).map(([k, d]) => `<option value="${k}" ${(carry.difficulty || 'story') === k ? 'selected' : ''}>${d.label}</option>`).join('')}</select></label></div>
    <div class="modal-objectives"><span class="eyebrow">PRIMARY OBJECTIVES</span>${objectives.map((s) => `<div class="objective"><i></i><span>${s}</span></div>`).join('')}</div>
    <p class="subtle">${skirmish ? 'Allied command favors mobility, medics, commandos, and warships. Soviet command fields heavy armor, grenadiers, Tesla tanks, and submarines.' : m.guidance}</p>
    ${!skirmish && best ? `<p class="subtle">Best time on this operation: <b>${timeLabel(best.time)}</b>${best.score ? ` · best score ${best.score.toLocaleString()}` : ''}.</p>` : ''}
    <p class="subtle">A new operation replaces your automatic checkpoint. Completed campaign operations stay unlocked.</p>
    <div class="button-row"><button id="launch-operation" class="button primary">Deploy to battlefield <span>↗</span></button><button id="briefing-back" class="button secondary">Back</button></div>`,
    'briefing'
  );
  $('#briefing-back').onclick = () => {
    if (inGame && sim?.status !== 'active') returnToTitle();
    else if (inGame) pauseMenu();
    else closeModal();
  };
  $('#launch-operation').onclick = () =>
    launch({ mission: skirmish ? Number($('#setup-map').value) : index, mode, faction: $('#setup-faction').value, difficulty: $('#setup-difficulty').value });
}

async function launch(config = null, checkpoint = null) {
  if (launching) return;
  launching = true;
  $('#loading').hidden = false;
  text('#loading-text', 'ESTABLISHING BATTLEFIELD UPLINK');
  void audio.unlock();
  // Let the loading card paint before the battlefield is built.
  await new Promise((resolve) => setTimeout(resolve, 40));
  try {
    let next;
    try {
      next = checkpoint ? Simulation.restore(checkpoint.game) : new Simulation(config || {});
    } catch (error) {
      closeModal();
      modal(`${modalHeader('CHECKPOINT ERROR', 'The save could not be loaded.')}<p>${escape(error.message)}. Start a new operation; campaign unlocks are unaffected.</p><div class="button-row"><button id="bad-save-new" class="button primary">New operation ↗</button></div>`);
      $('#bad-save-new').onclick = () => showBriefing(0);
      return;
    }
    sim = next;
    // Held until the battlefield is built and compiled; closeModal() below releases it.
    sim.paused = true;
    inGame = true;
    resultShown = false;
    saveElapsed = 0;
    uiElapsed = 0;
    accumulator = 0;
    selected.clear();
    groups = {};
    selectionStamp = '';
    queueStamp = '';
    objectiveStamp = '';
    category = 'structures';
    drag = null;
    padDrag = null;
    document.body.classList.add('in-game');
    document.body.classList.remove('build-open');
    $('#title-screen').hidden = true;
    $('#hud').hidden = false;
    $('#notice-stack').innerHTML = '';
    view.reset(sim);
    view.selected = selected;
    // The new battlefield's terrain materials compile behind the loading card, not on the first frames of play.
    try {
      await kit.renderer.compileAsync(view.scene, view.camera);
    } catch (error) {
      console.warn('Battlefield precompile skipped', error);
    }
    closeModal();
    const c = checkpoint?.camera;
    if (c && [c.x, c.z, c.zoom, c.yaw].every(Number.isFinite)) view.setView(c);
    text('#operation-number', sim.mode === 'skirmish' ? 'SKIRMISH / COMMAND' : `OPERATION ${sim.mission.number}`);
    text('#mission-name', sim.mission.name);
    text('#bonus-objective', sim.mode === 'skirmish' ? 'Side objective: capture the oil derrick.' : `OPTIONAL · ${sim.mission.secondary}`);
    $('#objective-body').hidden = false;
    $('#tutorial-tip').hidden = !settings.tips;
    renderBuildCards();
    setSelection(sim.owned(0, 'mcv').map((e) => e.id));
    audio.music('music');
    renderUI(true);
    saveGame();
    showNotice(checkpoint ? 'Checkpoint restored. All stations ready.' : 'Construction vehicle in position. Establish your base.');
    updateWorldRect();
    syncTouch();
    if (sim.status !== 'active') showResult();
  } finally {
    launching = false;
    $('#loading').hidden = true;
  }
}

function returnToTitle() {
  saveGame();
  inGame = false;
  sim = null;
  selected.clear();
  cancelOrder();
  closeModal();
  $('#hud').hidden = true;
  $('#title-screen').hidden = false;
  document.body.classList.remove('in-game', 'build-open');
  view.reset(demo, true);
  audio.music('music');
  refreshTitle();
  updateWorldRect();
  syncTouch();
}

function pauseMenu() {
  if (!inGame || !sim) return;
  modal(
    `${modalHeader('COMMAND CHANNEL / PAUSED', 'Hold the line.')}
    <p>${sim.mission.region} · ${FACTIONS[sim.faction].name} · ${DIFFICULTIES[sim.difficulty].label} · ${timeLabel(sim.time)}</p>
    <div class="pause-actions"><button id="resume-game" class="button primary">Resume operation <span>↗</span></button><button id="save-game" class="button secondary">Save checkpoint <span>↓</span></button><button id="restart-game" class="button secondary">Restart operation</button><button data-modal="controls" class="button secondary">Field manual</button><button data-modal="options" class="button secondary">Options</button><button data-modal="graphics" class="button secondary">Graphics settings</button><button id="exit-game" class="button secondary">Save and return to title</button></div>`,
    'pause'
  );
  $('#resume-game').onclick = closeModal;
  $('#save-game').onclick = () => {
    saveGame(true);
    text('#save-game', storage.lastError || 'Checkpoint saved ✓');
  };
  $('#restart-game').onclick = restartMenu;
  $('#exit-game').onclick = returnToTitle;
}

function restartMenu() {
  modal(
    `${modalHeader('COMMAND CHANNEL / RESTART', 'Restart the operation?')}<p>The battlefield resets to its opening position with the same command and difficulty. Your automatic checkpoint is replaced.</p><div class="button-row"><button id="confirm-restart" class="button primary">Restart <span>↻</span></button><button id="cancel-restart" class="button secondary">Keep fighting</button></div>`,
    'restart'
  );
  const config = { mission: sim.missionIndex, mode: sim.mode, faction: sim.faction, difficulty: sim.difficulty };
  $('#confirm-restart').onclick = () => launch(config);
  $('#cancel-restart').onclick = pauseMenu;
}

const CONTROLS = {
  keyboard: {
    title: 'Keyboard and mouse',
    rows: [
      ['Select unit', 'Left click'], ['Select multiple', 'Left drag'], ['Add to selection', 'Shift + click'], ['Context order', 'Right click'],
      ['Attack-move', 'A, then destination'], ['Queued waypoints', 'Shift + order'], ['Stop and guard', 'S'], ['Deploy MCV', 'D / double-click MCV'],
      ['Rotate building', 'R while placing'], ['Pan camera', 'Arrow keys / right or middle drag'], ['Zoom', 'Mouse wheel / + −'], ['Rotate camera', 'Q / E'],
      ['Center on base', 'H'], ['Center on selection', 'Space'], ['Select combat forces', 'F2'], ['Store control group', 'Ctrl + 1–9'],
      ['Recall / center group', '1–9 / double press'], ['Production panel', 'B'], ['Save checkpoint', 'Ctrl + S'], ['Pause / cancel order', 'Esc or P'],
      ['Mute', 'M'], ['Graphics settings', 'F9'],
    ],
  },
  gamepad: {
    title: 'Controller',
    rows: [
      ['Move the cursor', 'Left stick'], ['Pan camera', 'Right stick'], ['Select / press a button', 'A'], ['Box-select', 'Hold A and sweep'],
      ['Context order', 'X or RT'], ['Attack-move', 'Y, then X or A'], ['Rotate building', 'Y while placing'], ['Cancel · deselect · back', 'B'],
      ['Zoom', 'LB / RB'], ['Turn camera 90°', 'Right stick click'], ['Center on selection', 'Left stick click'], ['Select combat forces', 'D-pad ↑'],
      ['Stop and guard', 'D-pad ↓'], ['Center on base', 'D-pad ←'], ['Deploy MCV', 'D-pad →'], ['Production panel', 'View'],
      ['Pause', 'Start'], ['Menus', 'D-pad moves · A selects · B returns'],
    ],
  },
  touch: {
    title: 'Touch',
    rows: [
      ['Select unit', 'Tap'], ['Order selected units', 'Tap a destination or an enemy'], ['Attack-move', 'Attack, then tap'], ['Select a group', 'Select, then drag'],
      ['Pan camera', 'Drag with one finger'], ['Zoom', 'Pinch'], ['Deploy MCV', 'Double-tap the MCV / Deploy'], ['Production', 'Build'], ['Pause', 'II (top right)'],
    ],
  },
};

function controlsMenu() {
  const src = kit.input.source === 'gamepad' ? 'gamepad' : kit.input.source === 'touch' ? 'touch' : 'keyboard';
  const table = (k) => `<div class="controls-grid">${CONTROLS[k].rows.map(([a, b]) => `<div class="control-line"><span>${a}</span><kbd>${b}</kbd></div>`).join('')}</div>`;
  const others = Object.keys(CONTROLS).filter((k) => k !== src).map((k) => `<details class="controls-more"><summary>${CONTROLS[k].title}</summary>${table(k)}</details>`).join('');
  modal(
    `${modalHeader('FIELD MANUAL / CONTROLS', 'A commander’s essentials.')}<p>Orders matter. Use <b>Move</b> to disengage, or <b>Attack</b> to advance while fighting. Keep rocket soldiers behind your armor, and protect your harvesters.</p>
    <h3>${CONTROLS[src].title} <small class="controls-now">IN USE</small></h3>${table(src)}${others}
    <h3>Build order</h3><p>Deploy MCV → power plant → ore refinery → barracks → war factory. Choose a production card, wait for <b>READY</b>, then place structures near your base. A refinery includes a harvester. Radar unlocks artillery and air support; the technology center unlocks upgrades, the Allied commando and the Soviet Tesla tank.</p>
    <h3>Keep the front supplied</h3><p>Low power reduces production to 35% speed and disables powered defenses. Engineers are consumed when they capture a building. Medics heal infantry; service depots repair vehicles. Commandos plant charges on enemy structures. Veterans gain stronger weapons. Both sides fight over finite, slowly regrowing ore fields.</p>
    <div class="button-row"><button id="manual-done" class="button primary">Understood <span>↗</span></button></div>`,
    'controls',
    true
  );
  $('#manual-done').onclick = () => (inGame ? pauseMenu() : closeModal());
}

function optionsMenu() {
  modal(
    `${modalHeader('SYSTEMS / OPTIONS', 'Configure your command.')}<p>Resolution, shadows, anti-aliasing and effect budgets live in the shared <b>Graphics settings</b>; nothing there changes battlefield rules.</p>
    <div class="option-row"><label for="game-speed">Game speed<small>How fast the battle runs. Faster suits veterans and long harvesting stretches.</small></label><select id="game-speed">${Object.entries(SPEEDS).map(([v, label]) => `<option value="${v}" ${Number(v) === settings.speed ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="option-row"><label for="master-volume">Master volume<small id="volume-value">${Math.round(settings.volume * 100)}%</small></label><input id="master-volume" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"></div>
    <div class="option-row"><label for="music-volume">Music volume<small>Relative to the master volume</small></label><input id="music-volume" type="range" min="0" max="100" value="${Math.round(settings.music * 100)}"></div>
    ${[
      ['muted', 'Mute all audio', ''],
      ['effects', 'Additional effects', 'Bloom glow and impact particles.'],
      ['orders', 'Show order paths', 'Dashed routes for selected units.'],
      ['edgePan', 'Mouse edge scrolling', 'Off by default; arrows and right-drag always work.'],
      ['tips', 'Field tips', 'Contextual build-order guidance.'],
      ['diagnostics', 'Diagnostics', 'Renderer backend, quality tier, frame rate, and physics body count.'],
    ].map(([id, label, desc]) => `<div class="option-row"><label for="option-${id}">${label}${desc ? `<small>${desc}</small>` : ''}</label><input type="checkbox" id="option-${id}" ${settings[id] ? 'checked' : ''}></div>`).join('')}
    <p class="source-note">Audio in this package is original procedural placeholder audio. Requested Red Alert archival audio could not be retrieved. Every track and effect is listed in audio/manifest.json.</p>
    <div class="button-row"><button id="options-done" class="button primary">Apply and return <span>↗</span></button><button data-modal="graphics" class="button secondary">Graphics settings</button><button id="options-fullscreen" class="button secondary">Toggle fullscreen</button></div>`,
    'options'
  );
  $('#game-speed').onchange = (e) => {
    settings.speed = Number(e.target.value);
    saveSettings();
  };
  $('#master-volume').oninput = (e) => {
    settings.volume = Number(e.target.value) / 100;
    text('#volume-value', `${e.target.value}%`);
    saveSettings();
  };
  $('#music-volume').oninput = (e) => {
    settings.music = Number(e.target.value) / 100;
    saveSettings();
  };
  for (const id of ['muted', 'effects', 'orders', 'edgePan', 'tips', 'diagnostics']) {
    $(`#option-${id}`).onchange = (e) => {
      settings[id] = e.target.checked;
      if (id === 'tips') $('#tutorial-tip').hidden = !settings.tips;
      saveSettings();
    };
  }
  $('#options-done').onclick = () => (inGame ? pauseMenu() : closeModal());
  $('#options-fullscreen').onclick = toggleFullscreen;
}

function aboutMenu() {
  modal(
    `${modalHeader('ABOUT / INDEPENDENT ADAPTATION', TITLE)}<p>A compact, single-player, brick-built RTS inspired by OpenRA’s Red Alert mod. Command a resource economy, construct a base, manage power, and coordinate land, sea, and air forces across three original operations and an epilogue.</p><div class="about-grid"><div><small>GENERATION DATE</small><strong>${GENERATED}</strong></div><div><small>AI MODEL</small><strong>${MODEL}</strong></div><div><small>EDITION</small><strong>${VERSION} · Internal non-commercial test</strong></div><div><small>RENDERING</small><strong>three.js r186 · ${kit.backendLabel} · Rapier 0.20</strong></div></div><p>This is not OpenRA, an official remaster, or a complete port. Tiberian Dawn, Dune 2000, the original campaigns, multiplayer, and several Red Alert systems are not included. All mission stories, maps, brick models, and balance values are original additions.</p><p>OpenRA is developed by the OpenRA contributors. Command &amp; Conquer and Red Alert belong to their respective rights holders. No endorsement or affiliation is implied.</p><p class="source-note">Authoritative source guide: OpenRA / OpenRA on GitHub. This edition runs on the hub’s shared 3D stack and loads nothing from the internet; the game code, its original placeholder audio and the engine are all served with the hub.</p><div class="button-row"><button id="about-close" class="button primary">Return <span>↗</span></button></div>`,
    'about'
  );
  $('#about-close').onclick = closeModal;
}

/** Score for a won operation: fast, efficient, bloodless play on a harder setting scores highest. */
function scoreFor(s) {
  const mult = { story: 0.75, normal: 1, veteran: 1.35 }[s.difficulty] || 1;
  const raw = 4000 + s.stats.kills * 40 + s.stats.captures * 150 + s.stats.income * 0.1 - s.stats.losses * 25 - s.time * 2;
  return Math.max(100, Math.round((raw * mult) / 10) * 10);
}

function showResult() {
  if (resultShown || !sim) return;
  resultShown = true;
  const won = sim.status === 'won', campaign = sim.mode === 'campaign';
  const finale = won && campaign && sim.missionIndex === FINALE, epilogue = won && campaign && sim.missionIndex === LAST_MISSION;
  let record = null, score = 0;
  if (won) {
    score = scoreFor(sim);
    record = storage.record(sim, score);
    storage.remove('save');
  }
  audio.play(won ? 'victory' : 'defeat');
  kit.input.rumble(won ? 0.4 : 0.8, won ? 200 : 400);
  const title = epilogue ? 'Go home, commander.' : finale ? 'The last signal is yours.' : won ? 'Mission accomplished.' : 'Operation failed.';
  const label = epilogue ? 'EPILOGUE COMPLETE' : finale ? 'CAMPAIGN COMPLETE' : won ? 'AFTER-ACTION REPORT / VICTORY' : 'AFTER-ACTION REPORT / DEFEAT';
  const next = won && campaign && sim.missionIndex < LAST_MISSION;
  const recordLine = !won
    ? '<p>Preserve your construction yard, protect the refinery, and use a mixed force. Field training reduces enemy damage and gives you more time to prepare.</p>'
    : record?.isBest
      ? `<p class="record-line"><b>New best time</b>${record.previous ? ` · previous ${timeLabel(record.previous.time)}` : ''}. Your ${campaign ? 'campaign record has' : 'skirmish record has'} been saved in this browser.</p>`
      : `<p class="record-line">Best time for this setup: <b>${timeLabel(record?.previous?.time ?? sim.time)}</b>. Your ${campaign ? 'campaign progress has' : 'result has'} been saved in this browser.</p>`;
  modal(
    `<div class="result-banner" aria-hidden="true">${won ? '↗' : '×'}</div>${modalHeader(label, title)}<p class="briefing-text">${won ? (campaign ? sim.mission.winText : 'The enemy construction network has fallen. Your forces control the battlefield.') : escape(sim.reason)}</p>${finale ? '<div class="campaign-seal">NORTHRIDGE · GREYHARBOR · WHITE PEAK<br><br>ALL STATIONS, STAND DOWN.</div>' : ''}${epilogue ? '<div class="campaign-seal">EMBER RIDGE · THE LAST CONVOY IS HOME<br><br>EVERY CHANNEL IS CLEAR.</div>' : ''}<div class="result-stats"><div><b>${timeLabel(sim.time)}</b><small>OPERATION TIME</small></div><div><b>${sim.stats.kills}</b><small>ENEMIES DESTROYED</small></div><div><b>${sim.stats.losses}</b><small>FORCES LOST</small></div><div><b>${Math.round(sim.stats.income).toLocaleString()}</b><small>RESOURCES HARVESTED</small></div>${won ? `<div><b>${score.toLocaleString()}</b><small>SCORE · ${DIFFICULTIES[sim.difficulty].label.toUpperCase()}</small></div>` : ''}</div>${recordLine}<div class="button-row">${next ? `<button id="next-operation" class="button primary">${sim.missionIndex === FINALE ? 'Epilogue: The long night' : 'Next operation'} <span>↗</span></button>` : ''}${!won ? '<button id="retry-operation" class="button primary">Retry operation <span>↗</span></button>' : '<button id="retry-operation" class="button secondary">Replay operation</button>'}${!won && storage.read('save') ? '<button id="load-checkpoint" class="button secondary">Load checkpoint</button>' : ''}<button id="results-title" class="button secondary">Return to title</button></div>`,
    'result',
    true
  );
  const carry = { faction: sim.faction, difficulty: sim.difficulty };
  $('#next-operation')?.addEventListener('click', () => showBriefing(sim.missionIndex + 1, 'campaign', carry));
  $('#retry-operation')?.addEventListener('click', () => showBriefing(sim.missionIndex, sim.mode, carry));
  $('#load-checkpoint')?.addEventListener('click', () => launch(null, storage.read('save')));
  $('#results-title').onclick = returnToTitle;
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else showNotice('Fullscreen is not supported in this browser.', 'warning');
  } catch {
    showNotice('Fullscreen request was declined by the browser.', 'warning');
  }
}

/* ------------------------------------------------------------------ HUD */

function renderBuildCards() {
  $('#category-tabs').innerHTML = CATEGORIES.map(([k, label]) => `<button data-category="${k}" class="${k === category ? 'active' : ''}">${label}</button>`).join('');
  $('#build-grid').innerHTML = Object.entries(CATALOG)
    .filter(([, d]) => d.category === category && !d.noBuild && (!d.faction || d.faction === sim?.faction))
    .map(([k, d]) => `<button class="build-card" data-build="${k}" aria-label="Produce ${d.name}">${icon(k)}<b>${d.name}</b><small>◈ ${d.cost.toLocaleString()}</small><span class="count" hidden></span><span class="card-progress"></span><span class="lock" hidden>⌑</span></button>`)
    .join('');
  renderUI(true);
}

function inspectType(type) {
  const d = CATALOG[type];
  if (!d) return;
  const reason = sim?.allowed(type);
  $('#build-tooltip').innerHTML = `<span class="eyebrow">${escape(d.name)} · ${d.time}s${d.power ? ` · ${d.power} POWER` : ''}</span><p>${escape(reason ? `${reason}. ${d.tip}` : d.tip)}</p>`;
}

function purchase(type) {
  inspectType(type);
  const ready = sim.queues[0].construction[0];
  if (ready?.type === type && ready.ready) {
    startPlacement(type);
    return;
  }
  const result = sim.enqueue(type);
  if (!result.ok) {
    showNotice(result.reason, 'warning');
    audio.play('denied');
  } else audio.play('ui');
  renderUI(true);
}

function tutorialTip() {
  if (!sim.has('conyard')) return [1, `Select your mobile construction vehicle, then choose <b>Deploy${key('deploy')}</b> to establish your base.`];
  if (!sim.has('power')) return [2, `Choose <b>Power plant</b> in Base production${key('build')}. When it is ready, place it on a clear site near your construction yard.`];
  if (!sim.has('refinery')) return [3, 'Build an <b>Ore refinery</b>. Its free harvester will collect ore and automatically return it for credits.'];
  if (!sim.has('barracks')) return [4, 'Build a <b>Barracks</b>. Train rifle infantry to screen your troops, and engineers to capture neutral buildings.'];
  if (!sim.has('factory')) return [5, 'Build a <b>War factory</b>, then produce armor. Mix tanks with rocket infantry instead of relying on one unit type.'];
  const order = kit.input.source === 'gamepad' ? 'point at it and press <b>X</b>' : kit.input.source === 'touch' ? 'tap the building' : 'right-click the building';
  if (sim.mode === 'campaign' && sim.missionIndex === 0 && !sim.flags.relay) return [6, `Escort an <b>Engineer</b> north to the gold relay. Select the engineer, then ${order} to capture it.`];
  if (sim.mode === 'campaign' && sim.missionIndex === 3 && sim.holdRemaining() > 0) return [6, 'Hold both passes. Every wave goes for the <b>broadcast tower</b>: select it and use <b>Repair</b> when it is damaged, and keep defenses near the southern pass.'];
  return [6, `Select your forces, choose <b>Attack${key('attackMove')}</b>, then a destination. Destroy the enemy objective structures. Keep harvesting.`];
}

function renderUI(force = false) {
  if (!inGame || !sim) return;
  for (const id of selected) if (!sim.get(id)) selected.delete(id);
  text('#credits', Math.floor(sim.credits[0]).toLocaleString());
  text('#power', `${sim.power[0].used} / ${sim.power[0].total}`);
  $('.power-display').classList.toggle('low', sim.lowPower());
  $('#power-meter').style.setProperty('--power-fill', `${Math.min(100, (sim.power[0].used / Math.max(1, sim.power[0].total)) * 100)}%`);
  text('#population', `${sim.pop()} / ${POPULATION}`);
  text('#mission-clock', timeLabel(sim.time));
  text('#production-state', sim.lowPower() ? 'LOW POWER' : 'ONLINE');
  text('#radar-state', sim.has('radar') && !sim.lowPower() ? 'RADAR ONLINE' : 'LOCAL FEED');
  const objectives = sim.objectives(), stamp = JSON.stringify(objectives);
  if (stamp !== objectiveStamp) {
    $('#objectives').innerHTML = objectives.map((o) => `<div class="objective ${o.done ? 'done' : ''}"><i>${o.done ? '✓' : ''}</i><span>${o.text}</span></div>`).join('');
    objectiveStamp = stamp;
  }
  const hold = sim.holdRemaining();
  const launchActive = sim.mode === 'campaign' && sim.deadline > 0 && sim.entities.some((e) => ['siloA', 'siloB'].includes(e.tag) && e.owner === 1);
  const deadline = $('#deadline'), showDeadline = launchActive || hold > 0;
  if (deadline.hidden === showDeadline) deadline.hidden = !showDeadline;
  if (launchActive) text('#deadline', `LAUNCH IN ${timeLabel(sim.deadline - sim.time)}`);
  else if (hold > 0) text('#deadline', `CONVOY CLEAR IN ${timeLabel(hold)}`);

  const qs = Object.entries(sim.queues[0]).flatMap(([lane, list]) => list.map((q, i) => ({ ...q, lane, index: i })));
  const signature = qs.map((q) => `${q.id}-${q.ready}`).join('|');
  if (signature !== queueStamp || (force && (!qs.length || !$('#production-queues').children.length))) {
    $('#production-queues').innerHTML = qs.length
      ? qs.map((q) => `<div class="queue-row" data-queue="${q.id}"><button class="queue-select" data-ready="${q.type}" data-lane="${q.lane}">${CATALOG[q.type].name}</button><small></small><button data-cancel="${q.id}" data-lane="${q.lane}" aria-label="Cancel ${CATALOG[q.type].name}">×</button></div>`).join('')
      : '<div class="queue-empty">No active production</div>';
    queueStamp = signature;
  }
  for (const q of qs) {
    const row = $(`[data-queue="${q.id}"]`);
    if (!row) continue;
    row.style.setProperty('--progress', `${q.progress * 100}%`);
    const label = q.ready ? 'READY ↗' : q.index ? 'QUEUED' : `${Math.ceil(((1 - q.progress) * CATALOG[q.type].time) / (sim.lowPower() ? 0.35 : 1) / (sim.upgrades[0].logistics ? 1.15 : 1))}s`;
    const small = row.querySelector('small');
    if (small.textContent !== label) small.textContent = label;
  }
  for (const card of $$('.build-card')) {
    const type = card.dataset.build, d = CATALOG[type], reason = sim.allowed(type), pending = qs.filter((q) => q.type === type), active = pending.find((q) => q.index === 0), ready = active?.ready;
    card.classList.toggle('locked', !!reason);
    card.classList.toggle('ready', !!ready);
    card.setAttribute('aria-disabled', reason ? 'true' : 'false');
    card.querySelector('.lock').hidden = !reason;
    const count = card.querySelector('.count');
    count.hidden = !pending.length;
    count.textContent = pending.length;
    card.style.setProperty('--progress', `${(active?.progress || 0) * 100}%`);
    const label = ready ? 'READY / PLACE' : sim.upgrades[0][type] ? 'RESEARCHED' : `◈ ${d.cost.toLocaleString()}`;
    const small = card.querySelector('small');
    if (small.textContent !== label) small.textContent = label;
  }
  const es = [...selected].map((id) => sim.get(id)).filter(Boolean), selSig = es.map((e) => e.id).join(',');
  if (selSig !== selectionStamp || force) {
    const same = es.length && es.every((e) => e.type === es[0].type), first = es[0];
    const name = es.length === 1 ? TYPES[first.type].name : same ? `${es.length} × ${TYPES[first.type].name}` : `${es.length} units selected`;
    const orderHint = kit.input.source === 'gamepad' ? 'X to command · Y to attack-move' : kit.input.source === 'touch' ? 'Tap a destination to command' : 'Right-click to command · A to attack-move';
    const detail = es.length === 1
      ? first.type === 'harvester'
        ? `Ore cargo: ${Math.floor(first.cargo)} / ${sim.upgrades[0].logistics ? 600 : 400}`
        : first.type === 'mcv'
          ? `Deploy${key('deploy')} to establish your base.`
          : first.tag === 'tower'
            ? `${Math.ceil(first.hp)} / ${TYPES[first.type].hp} HP · keep it standing until the convoy is clear.`
            : TYPES[first.type].kind === 'building'
              ? 'Order ground while selected to set a rally point.'
              : `${Math.ceil(first.hp)} / ${TYPES[first.type].hp} HP · ${first.veterancy ? '★'.repeat(first.veterancy) : 'Recruit'}`
      : orderHint;
    $('#selection-summary').innerHTML = es.length
      ? `<span class="eyebrow">${es.length === 1 ? (TYPES[first.type].kind === 'building' ? 'STRUCTURE SELECTED' : 'UNIT SELECTED') : 'COMMAND GROUP'}</span><strong>${name}</strong><small>${detail}</small>`
      : `<span class="eyebrow">NO UNITS SELECTED</span><strong>Awaiting orders</strong><small>${kit.input.source === 'gamepad' ? 'A selects · hold A to sweep · X commands' : kit.input.source === 'touch' ? 'Tap a unit · Select + drag for a group' : 'Click a unit · Drag to select · Right-click to command'}</small>`;
    $('#selection-units').innerHTML = es.slice(0, 6).map((e) => `<button class="selection-chip" data-select="${e.id}" aria-label="Select ${TYPES[e.type].name}" style="--health:${(e.hp / TYPES[e.type].hp) * 100}%">${icon(e.type)}<small>${TYPES[e.type].code}</small></button>`).join('');
    selectionStamp = selSig;
  }
  for (const c of $$('.selection-chip')) {
    const e = sim.get(Number(c.dataset.select));
    if (e) c.style.setProperty('--health', `${(e.hp / TYPES[e.type].hp) * 100}%`);
  }
  const hasUnit = es.some((e) => TYPES[e.type].kind === 'unit'), hasBuilding = es.some((e) => TYPES[e.type].kind === 'building');
  const canSell = es.some((e) => TYPES[e.type].kind === 'building' && !TYPES[e.type].noSell), canRepair = hasBuilding || es.some((e) => e.type === 'engineer');
  for (const b of $$('[data-command]')) {
    const c = b.dataset.command;
    const disabled = c === 'select' ? false : c === 'deploy' ? !es.some((e) => e.type === 'mcv') : c === 'repair' ? !canRepair : c === 'sell' ? !canSell : ['stop', 'attackMove'].includes(c) ? !hasUnit : !es.length;
    const hidden = (c === 'deploy' && !es.some((e) => e.type === 'mcv')) || (c === 'repair' && !canRepair) || (c === 'sell' && !canSell);
    if (b.disabled !== disabled) b.disabled = disabled;
    if (b.hidden !== hidden) b.hidden = hidden;
  }
  const scanReady = sim.has('radar') && !sim.lowPower() && sim.time >= sim.scanReady, strikeReady = sim.has('silo') && !sim.lowPower() && sim.strikeCharge >= 100;
  $('#scan-button').disabled = !scanReady;
  $('#strike-button').disabled = !strikeReady;
  text('#scan-time', !sim.has('radar') ? 'RADAR REQUIRED' : sim.lowPower() ? 'LOW POWER' : scanReady ? 'READY' : `${Math.ceil(sim.scanReady - sim.time)}s`);
  text('#strike-time', !sim.has('silo') ? 'SILO REQUIRED' : sim.lowPower() ? 'LOW POWER' : strikeReady ? 'READY' : `${Math.floor(sim.strikeCharge)}% CHARGED`);
  if (settings.tips) {
    const [step, tip] = tutorialTip();
    if ($('#tutorial-text').innerHTML !== tip) $('#tutorial-text').innerHTML = tip;
    text('.tip-number', String(step).padStart(2, '0'));
  }
  if (!document.body.classList.contains('build-open') && window.innerWidth <= 760) return;
  view.drawMinimap($('#minimap'), sim);
}

function processEvents() {
  for (const e of sim.drainEvents()) {
    view.event(e, sim);
    const visible = e.owner === 0 || (Number.isFinite(e.x) && sim.visibility[0][sim.map.indexAt(e.x, e.z)]);
    const pan = Number.isFinite(e.x) ? clamp((view.screenPoint(e.x, e.z, 0, panPoint).x / view.width - 0.5) * 1.4, -1, 1) : 0;
    if (e.type === 'notice') showNotice(e.text);
    if (e.type === 'warning') {
      showNotice(e.text, 'warning');
      audio.play('warning');
      kit.input.rumble(0.35, 140);
    }
    if (e.type === 'ready' && e.owner === 0) {
      showNotice(`${TYPES[e.typeName].name} ready. Select it to place.`, 'reward');
      audio.play('ready');
    }
    if (e.type === 'trained' && e.owner === 0) audio.play('ready', { volume: 0.65 });
    if (e.type === 'deployed') {
      showNotice('Construction yard established. Build power, then a refinery.', 'reward');
      audio.play('construct');
      kit.input.rumble(0.3, 120);
    }
    if (e.type === 'constructed' && e.owner === 0) audio.play('construct');
    if (e.type === 'upgrade' && e.owner === 0) {
      showNotice(`${UPGRADES[e.typeName]?.name || 'Technology'} research complete.`, 'reward');
      audio.play('capture');
    }
    if (e.type === 'capture' && e.owner === 0) {
      showNotice('Structure captured. Intelligence secured. +500 credits.', 'reward');
      audio.play('capture');
      kit.input.rumble(0.3, 100);
    }
    if (e.type === 'demolish' && e.owner === 0) showNotice(`Charges set. ${TYPES[e.typeName]?.name || 'Structure'} demolished.`, 'reward');
    if (e.type === 'convoy') {
      showNotice(e.text, 'reward');
      audio.play('capture');
      kit.input.rumble(0.4, 180);
    }
    if (e.type === 'income' && e.owner === 0) audio.play('credits', { volume: 0.5 });
    if (e.type === 'pickup') {
      showNotice(e.kind === 'credits' ? 'Supply cache recovered. +700 credits.' : 'Repair supplies recovered. Nearby forces restored.', 'reward');
      audio.play('capture');
    }
    if (e.type === 'fire' && visible) audio.play(e.weapon === 'rifle' ? 'rifle' : e.weapon === 'tesla' ? 'tesla' : 'cannon', { pan, volume: 0.55, rate: 0.94 + Math.random() * 0.12 });
    if (e.type === 'destroyed' && visible) audio.play('explosion', { pan, volume: e.large ? 0.85 : 0.55 });
    if (e.type === 'destroyed' && e.owner === 0) kit.input.rumble(e.large ? 0.7 : 0.2, e.large ? 260 : 80);
    if (e.type === 'strike') {
      audio.play('explosion', { pan, volume: 1 });
      kit.input.rumble(0.8, 300);
    }
    if (e.type === 'scan') audio.play('scan');
    if (e.type === 'result') showResult();
  }
}

/* ------------------------------------------------------------------ input */

function miniPoint(clientX, clientY) {
  const r = $('#minimap').getBoundingClientRect();
  return { x: clamp(((clientX - r.left) / r.width) * 100, 1, 99), z: clamp(((clientY - r.top) / r.height) * 84, 1, 83) };
}

/** A minimap press: jump the camera there, or (right button, controller X, armed order) order there. */
function minimapPress(clientX, clientY, order) {
  if (!interactive()) return false;
  const p = miniPoint(clientX, clientY);
  if (order || ['scan', 'strike', 'attackMove', 'move'].includes(orderMode)) {
    orderAt(p, null, kit.input.down('shift'));
    return false;
  }
  view.focus(p.x, p.z);
  return true;
}

/** A left click, a touch tap, or controller A on the battlefield. */
function tapAt(point, entity, touch, shift) {
  if (placement || (orderMode && orderMode !== 'select')) {
    orderAt(point, entity, shift);
    return;
  }
  if (entity?.owner === 0) {
    const now = performance.now(), double = lastTap.id === entity.id && now - lastTap.time < 350;
    lastTap = { id: entity.id, time: now };
    if (double && entity.type === 'mcv') {
      setSelection([entity.id]);
      deploySelected();
      return;
    }
    if (double && TYPES[entity.type].kind === 'unit') {
      setSelection(sim.owned(0, entity.type).filter((u) => view.screenPoint(u.x, u.z, 0, panPoint).visible).map((u) => u.id));
      return;
    }
    if (shift && selected.has(entity.id)) {
      selected.delete(entity.id);
      selectionStamp = '';
      renderUI(true);
    } else setSelection([entity.id], shift);
  } else if (touch && selected.size) orderAt(point, entity, shift);
  else if (!shift && selected.size) {
    selected.clear();
    selectionStamp = '';
    renderUI(true);
  }
}

function releasePointer(d, x, y) {
  if (view.dragRect) {
    setSelection(view.selectRectangle(view.dragRect), d.shift);
    view.dragRect = null;
    cancelOrder();
    return;
  }
  if (d.moved) return;
  const point = view.pickGround(x, y), entity = view.pickEntity(x, y, d.touch);
  if (d.button === 2) {
    if (placement || orderMode) cancelOrder();
    else orderAt(point, entity, kit.input.down('shift'));
    return;
  }
  if (d.button !== 0) return;
  tapAt(point, entity, d.touch, kit.input.down('shift') || d.shift);
}

/** The controller cursor: which scope it is in, where it points, and what is under it. */
function updatePad(dt) {
  const inp = kit.input, on = inp.source === 'gamepad';
  if (on !== pad.active) {
    pad.show(on);
    pad.fresh = on;
    padScopeKey = '';
    padDrag = null;
  }
  if (!on) {
    pad.overMap = false;
    return;
  }
  const scope = menuScope();
  const scopeKey = scope ? `${scope.id}:${modalSerial}` : 'hud';
  if (scopeKey !== padScopeKey) {
    padScopeKey = scopeKey;
    const first = scope && primaryIn(scope);
    if (first) {
      first.focus({ preventScroll: true });
      pad.snap(first);
    }
  }
  const v = inp.vector('cursor');
  pad.move(v.x, v.y, dt);
  pad.draw();
  const under = pad.under();
  pad.setHot(scope && under && !scope.contains(under) ? null : under);
  pad.overMap = !scope && under === kit.canvas;
}

function navigate(scope, dir) {
  const list = focusablesIn(scope);
  if (!list.length) return;
  const activeEl = document.activeElement;
  let current = list.includes(activeEl) ? activeEl : null;
  if (!current && pad.active && pad.hot && list.includes(pad.hot)) current = pad.hot;
  if (current && (dir === 'Left' || dir === 'Right') && kit.input.source === 'gamepad' && adjust(current, dir === 'Right' ? 1 : -1)) {
    audio.play('ui', { volume: 0.4 });
    return;
  }
  const next = current ? nearestInDirection(current, dir, list) : primaryIn(scope);
  if (!next) return;
  next.focus({ preventScroll: true });
  next.scrollIntoView?.({ block: 'nearest' });
  if (pad.active) pad.snap(next);
  audio.play('ui', { volume: 0.3 });
}

function handleMenu(scope, dt) {
  const inp = kit.input, now = performance.now();
  for (const dir of DIRS) {
    const name = `nav${dir}`;
    if (inp.pressed(name)) {
      navigate(scope, dir);
      navRepeat.dir = dir;
      navRepeat.at = now + 380;
    } else if (navRepeat.dir === dir) {
      if (!inp.down(name)) navRepeat.dir = null;
      else if (now > navRepeat.at) {
        navigate(scope, dir);
        navRepeat.at = now + 130;
      }
    }
  }
  // The right stick scrolls long menus such as the field manual.
  if (scope.id === 'modal') {
    const v = inp.vector('pan');
    if (v.y) scope.scrollTop -= v.y * 700 * dt;
  }
  if (inp.pressed('confirm') && !pad.fresh) {
    const focused = focusablesIn(scope).includes(document.activeElement) ? document.activeElement : null;
    const el = pad.hot && scope.contains(pad.hot) ? pad.hot : focused;
    if (el) {
      void audio.unlock();
      activate(el);
    }
  }
}

function onPause() {
  if (placement || orderMode) {
    cancelOrder();
    return;
  }
  if (modalKind) {
    if (modalKind === 'pause') closeModal();
    else modalBack();
    return;
  }
  if (inGame && sim?.status === 'active') pauseMenu();
}

function onBack() {
  if (modalKind) {
    modalBack();
    return;
  }
  if (!inGame) return;
  if (placement || orderMode) {
    cancelOrder();
    return;
  }
  if (document.body.classList.contains('build-open')) {
    document.body.classList.remove('build-open');
    return;
  }
  const activeEl = document.activeElement;
  if (activeEl && activeEl !== document.body && $('#hud').contains(activeEl)) {
    activeEl.blur();
    return;
  }
  if (selected.size) {
    selected.clear();
    selectionStamp = '';
    renderUI(true);
  }
}

function handleCamera(dt) {
  const inp = kit.input, speed = dt * 550;
  const v = inp.vector('pan');
  let dx = -v.x * speed, dy = v.y * speed;
  const p = inp.pointer;
  if (settings.edgePan && !pad.active && p.over && p.type === 'mouse' && !drag && !placement) {
    if (p.x < 9) dx += speed;
    if (view.width - p.x < 9) dx -= speed;
    if (p.y < 9) dy += speed;
    if (view.height - p.y < 9) dy -= speed;
  }
  if (pad.active) {
    // Pushing the cursor against the battlefield's edge scrolls, like a mouse at the screen edge.
    const c = inp.vector('cursor'), lx = pad.x - worldRect.left, ly = pad.y - worldRect.top, e = 28;
    const inside = lx > -4 && ly > -4 && lx < worldRect.width + 4 && ly < worldRect.height + 4;
    if (inside) {
      if (lx < e && c.x < -0.2) dx += speed * 1.2 * -c.x;
      if (lx > worldRect.width - e && c.x > 0.2) dx -= speed * 1.2 * c.x;
      if (ly < e && c.y > 0.2) dy += speed * 1.2 * c.y;
      if (ly > worldRect.height - e && c.y < -0.2) dy -= speed * 1.2 * -c.y;
    }
  }
  if (dx || dy) view.pan(dx, dy);
  const r = inp.value('rotate');
  if (r) view.rotate(r * dt * 0.65);
  if (inp.pressed('turn')) view.turn(Math.PI / 2);
  if (inp.down('zoomIn')) view.zoomBy(-dt * 1.1);
  if (inp.down('zoomOut')) view.zoomBy(dt * 1.1);
  const z = inp.zoom();
  if (z) {
    view.zoomBy(-z * (p.type === 'touch' ? 0.25 : 0.15));
    if (drag) drag.moved = true;
  }
}

function handleMap() {
  const inp = kit.input;
  if (!pad.active) {
    const p = inp.pointer;
    if (p.justDown) {
      void audio.unlock();
      const touch = p.type === 'touch';
      drag = { sx: p.x, sy: p.y, x: p.x, y: p.y, button: touch ? 0 : inp.down('rclick') ? 2 : inp.down('mclick') ? 1 : 0, touch, moved: false, shift: inp.down('shift') };
    }
    if (!drag) return;
    const dx = p.x - drag.x, dy = p.y - drag.y;
    drag.x = p.x;
    drag.y = p.y;
    if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) > 7) drag.moved = true;
    if (drag.moved) {
      if (drag.button === 1 || drag.button === 2) view.pan(dx, dy);
      else if (drag.touch && orderMode !== 'select') {
        // One finger pans. The look action reports the drag in radians; turn it back into pixels.
        const lk = inp.look('drag');
        if (lk.x || lk.y) {
          const s = kit.settings.get(), k = TOUCH_LOOK * (s.lookSensitivity || 1), inv = s.invertY ? -1 : 1;
          view.pan(lk.x / k, lk.y / (k * inv));
        }
      } else if (!placement && (!orderMode || orderMode === 'select')) {
        view.dragRect = { x: Math.min(drag.sx, p.x), y: Math.min(drag.sy, p.y), w: Math.abs(drag.sx - p.x), h: Math.abs(drag.sy - p.y) };
      }
    }
    if (!p.down) {
      const d = drag;
      drag = null;
      releasePointer(d, p.x, p.y);
    }
    return;
  }
  drag = null;
  const lx = pad.x - worldRect.left, ly = pad.y - worldRect.top, under = pad.hot;
  if (inp.pressed('confirm') && !pad.fresh) {
    void audio.unlock();
    if (under === kit.canvas) padDrag = { sx: lx, sy: ly, moved: false };
    else if (under?.id === 'minimap') minimapPress(pad.x, pad.y, false);
    else if (under) activate(under);
  }
  if (padDrag) {
    if (!padDrag.moved && Math.hypot(lx - padDrag.sx, ly - padDrag.sy) > 10) padDrag.moved = true;
    if (padDrag.moved && !placement && (!orderMode || orderMode === 'select')) {
      view.dragRect = { x: Math.min(padDrag.sx, lx), y: Math.min(padDrag.sy, ly), w: Math.abs(padDrag.sx - lx), h: Math.abs(padDrag.sy - ly) };
    }
    if (!inp.down('confirm')) {
      padDrag = null;
      if (view.dragRect) {
        setSelection(view.selectRectangle(view.dragRect));
        view.dragRect = null;
        cancelOrder();
      } else tapAt(view.pickGround(lx, ly), view.pickEntity(lx, ly, true), false, false);
    }
  }
  if (inp.pressed('order') && !pad.fresh) {
    if (under === kit.canvas) orderAt(view.pickGround(lx, ly), view.pickEntity(lx, ly, true), false);
    else if (under?.id === 'minimap') minimapPress(pad.x, pad.y, true);
  }
}

function handleCommands() {
  const inp = kit.input;
  if (inp.pressed('attackMove')) {
    if (placement && inp.source === 'gamepad') {
      rotation = (rotation + 1) % 4;
      audio.play('ui', { volume: 0.5 });
    } else armOrder('attackMove');
  }
  if (inp.pressed('rotateBuilding') && placement) rotation = (rotation + 1) % 4;
  if (inp.pressed('stop')) {
    if (inp.down('ctrl')) saveGame(true);
    else {
      if (selected.size) {
        sim.command([...selected], 'stop');
        audio.play('order');
      }
      cancelOrder();
    }
  }
  if (inp.pressed('deploy')) deploySelected();
  if (inp.pressed('home')) home();
  if (inp.pressed('focus')) focusSelection();
  if (inp.pressed('army')) selectAllArmy();
  if (inp.pressed('build')) toggleBuild();
  for (let i = 1; i <= 9; i++) {
    if (!inp.pressed(`group${i}`)) continue;
    const k = String(i);
    if (inp.down('ctrl')) {
      groups[k] = [...selected];
      showNotice(`Control group ${k} assigned (${selected.size} units).`);
    } else {
      setSelection(groups[k] || []);
      if (lastGroup.key === k && performance.now() - lastGroup.time < 400) focusSelection();
      lastGroup = { key: k, time: performance.now() };
    }
  }
}

/** Hover highlight and the placement preview follow the mouse, a finger, or the controller cursor. */
function updateCursorWorld() {
  if (!interactive()) {
    view.hover = 0;
    if (placement) view.setPlacement(placement, null);
    return;
  }
  let x, y, over, mouse = false;
  if (pad.active) {
    x = pad.x - worldRect.left;
    y = pad.y - worldRect.top;
    over = pad.overMap;
    mouse = true;
  } else {
    const p = kit.input.pointer;
    x = p.x;
    y = p.y;
    mouse = p.type === 'mouse';
    over = mouse ? p.over && !drag?.moved : p.down;
  }
  if (!over) {
    view.hover = 0;
    if (placement) view.setPlacement(placement, null);
    return;
  }
  if (mouse && !drag && (x !== hoverAt.x || y !== hoverAt.y || view.frame - hoverAt.frame > 15)) {
    hoverAt.x = x;
    hoverAt.y = y;
    hoverAt.frame = view.frame;
    view.hover = view.pickEntity(x, y)?.id || 0;
  } else if (!mouse) view.hover = 0;
  if (placement) {
    const g = view.pickGround(x, y);
    if (!g) {
      view.setPlacement(placement, null);
      return;
    }
    const gx = Math.round(g.x), gz = Math.round(g.z), k = `${placement}:${gx}:${gz}:${rotation}`;
    if (k !== placementKey || view.frame % 15 === 0) {
      placementKey = k;
      placementOk = sim.placement(placement, gx, gz, 0, rotation).ok;
    }
    view.setPlacement(placement, g, placementOk, rotation);
  }
}

function handleInput(dt) {
  const inp = kit.input;
  updatePad(dt);
  // Nothing is pressed while a battlefield is being built (the briefing is still on screen).
  if (launching) return;
  if (inp.pressed('mute')) toggleMute();
  if (inp.pressed('pause')) {
    onPause();
    return;
  }
  if (inp.pressed('back')) {
    onBack();
    return;
  }
  const scope = menuScope();
  if (scope) {
    drag = null;
    padDrag = null;
    handleMenu(scope, dt);
    return;
  }
  if (!interactive()) {
    drag = null;
    padDrag = null;
    view.dragRect = null;
    return;
  }
  handleCamera(dt);
  handleMap();
  handleCommands();
}

/* ------------------------------------------------------------------ the loop */

function frame(dt) {
  handleInput(dt);
  if (inGame && sim) {
    if (!sim.paused && sim.status === 'active') {
      accumulator += dt * settings.speed;
      const max = Math.ceil(5 * settings.speed);
      let count = 0;
      while (accumulator >= STEP && count < max) {
        sim.step(STEP);
        debris.step(sim, STEP);
        processEvents();
        accumulator -= STEP;
        count++;
        if (sim.status !== 'active') break;
      }
      if (count === max && accumulator >= STEP) accumulator %= STEP;
      saveElapsed += dt;
      if (saveElapsed >= 30) {
        saveElapsed = 0;
        saveGame();
      }
    } else accumulator = 0;
    updateCursorWorld();
    view.render(sim, sim.paused ? 1 : Math.min(1, accumulator / STEP), dt);
    uiElapsed += dt;
    if (uiElapsed >= 0.25) {
      uiElapsed = 0;
      renderUI();
    }
    if (sim.status !== 'active' && !resultShown) showResult();
  } else {
    demo.time += dt;
    view.render(demo, 1, dt, { attract: true });
  }
  diagElapsed += dt;
  if (settings.diagnostics && diagElapsed >= 0.5) {
    diagElapsed = 0;
    text('#diagnostic-text', `${kit.backendLabel.toUpperCase()} · ${kit.tier.name.toUpperCase()} · ${window.__kit?.fps || 0} FPS · ${debris.bodies} BODIES`);
  }
  pad.fresh = false;
}

/* ------------------------------------------------------------------ DOM wiring */

function applySource(src) {
  const root = document.documentElement;
  root.classList.toggle('src-pad', src === 'gamepad');
  root.classList.toggle('src-touch', src === 'touch');
  for (const b of $$('[data-command]')) {
    const p = PROMPTS[b.dataset.command];
    if (p) b.title = `${p.label}${key(b.dataset.command)}`;
  }
  $('#mobile-build-button').title = `${PROMPTS.build.label}${key('build')}`;
  $('#pause-button').title = `${PROMPTS.pause.label}${key('pause')}`;
  if (inGame) renderUI(true);
}

const mini = $('#minimap');
let minimapDragging = false;
mini.addEventListener('contextmenu', (e) => e.preventDefault());
mini.addEventListener('pointerdown', (e) => {
  if (!interactive()) return;
  e.preventDefault();
  void audio.unlock();
  const order = e.button === 2;
  if (minimapPress(e.clientX, e.clientY, order)) {
    minimapDragging = true;
    mini.setPointerCapture(e.pointerId);
  }
});
mini.addEventListener('pointermove', (e) => {
  if (!minimapDragging || !interactive()) return;
  const p = miniPoint(e.clientX, e.clientY);
  view.focus(p.x, p.z);
});
mini.addEventListener('pointerup', () => (minimapDragging = false));
mini.addEventListener('pointercancel', () => (minimapDragging = false));

$('#campaign-button').onclick = () => showBriefing(0);
$('#skirmish-button').onclick = () => showBriefing(0, 'skirmish');
$('#continue-button').onclick = () => launch(null, storage.read('save'));
$('#operation-cards').onclick = (e) => {
  const b = e.target.closest('[data-operation]');
  if (!b) return;
  const i = Number(b.dataset.operation);
  if (i <= progress.unlocked) showBriefing(i);
  else {
    audio.play('denied');
    b.querySelector('em').textContent = MISSIONS[i].epilogue ? 'FINISH OPERATION 03 FIRST' : 'COMPLETE THE PREVIOUS OPERATION';
  }
};
$('#modal-close').onclick = modalBack;
$('#pause-button').onclick = pauseMenu;
$('#brand-home').onclick = pauseMenu;
$('#mute-button').onclick = toggleMute;
$('#fullscreen-button').onclick = toggleFullscreen;
$('#scan-button').onclick = () => armOrder('scan');
$('#strike-button').onclick = () => armOrder('strike');
$('#camera-home').onclick = home;
$('#zoom-in').onclick = () => view.zoomBy(-0.15);
$('#zoom-out').onclick = () => view.zoomBy(0.15);
$('#camera-turn').onclick = () => view.turn(Math.PI / 2);
$('#objectives-toggle').onclick = () => {
  $('#objective-body').hidden = !$('#objective-body').hidden;
  $('#objectives-toggle span:last-child').textContent = $('#objective-body').hidden ? '+' : '−';
};
$('#dismiss-tip').onclick = () => {
  settings.tips = false;
  saveSettings();
  $('#tutorial-tip').hidden = true;
};
$('#mobile-build-button').onclick = () => {
  document.body.classList.toggle('build-open');
  if (sim) view.drawMinimap($('#minimap'), sim);
};
$('#mobile-build-close').onclick = () => document.body.classList.remove('build-open');
$('#category-tabs').onclick = (e) => {
  const b = e.target.closest('[data-category]');
  if (!b) return;
  category = b.dataset.category;
  renderBuildCards();
  audio.play('ui');
  $(`[data-category="${category}"]`)?.focus({ preventScroll: true });
};
$('#build-grid').onclick = (e) => {
  const b = e.target.closest('[data-build]');
  if (b && interactive()) purchase(b.dataset.build);
};
$('#build-grid').addEventListener('pointerover', (e) => {
  const b = e.target.closest('[data-build]');
  if (b) inspectType(b.dataset.build);
});
$('#build-grid').addEventListener('focusin', (e) => {
  const b = e.target.closest('[data-build]');
  if (b) inspectType(b.dataset.build);
});
$('#production-queues').onclick = (e) => {
  if (!interactive()) return;
  const cancel = e.target.closest('[data-cancel]'), ready = e.target.closest('[data-ready]');
  if (cancel) {
    sim.cancelQueue(cancel.dataset.lane, Number(cancel.dataset.cancel));
    renderUI(true);
  } else if (ready) {
    const q = sim.queues[0][ready.dataset.lane][0];
    if (q?.ready && q.type === ready.dataset.ready) startPlacement(q.type);
  }
};
$('#selection-units').onclick = (e) => {
  const b = e.target.closest('[data-select]');
  if (b && interactive()) setSelection([Number(b.dataset.select)], kit.input.down('shift'));
};
$('#command-buttons').onclick = (e) => {
  const b = e.target.closest('[data-command]');
  if (!b || b.disabled || !interactive()) return;
  const c = b.dataset.command;
  if (c === 'deploy') deploySelected();
  else if (c === 'stop') {
    sim.command([...selected], 'stop');
    cancelOrder();
    audio.play('order');
  } else if (c === 'repair') {
    const buildings = [...selected].map((id) => sim.get(id)).filter((x) => x && TYPES[x.type].kind === 'building');
    if (buildings.length) {
      for (const x of buildings) sim.repairBuilding(x.id);
      showNotice('Repair mode toggled on selected structures.');
      audio.play('ui');
    } else armOrder('repairUnit');
  } else if (c === 'sell') {
    const ids = [...selected].filter((id) => sim.get(id) && TYPES[sim.get(id).type].kind === 'building' && !TYPES[sim.get(id).type].noSell);
    modal(
      `${modalHeader('STRUCTURE MANAGEMENT', 'Sell selected structures?')}<p>Salvage returns half the construction cost, adjusted for remaining health. Your last construction yard cannot be sold without a replacement MCV.</p><div class="button-row"><button id="confirm-sale" class="button primary">Sell ${ids.length} structure${ids.length === 1 ? '' : 's'}</button><button id="cancel-sale" class="button secondary">Keep structures</button></div>`,
      'sell'
    );
    $('#confirm-sale').onclick = () => {
      ids.forEach((id) => sim.sell(id));
      closeModal();
      selectionStamp = '';
    };
    $('#cancel-sale').onclick = closeModal;
  } else if (orderMode === c) cancelOrder();
  else armOrder(c);
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-modal]');
  if (!b) return;
  void audio.unlock().then(() => audio.music('music'));
  audio.play('ui');
  if (b.dataset.modal === 'graphics') kit.menu.open();
  else ({ controls: controlsMenu, options: optionsMenu, about: aboutMenu })[b.dataset.modal]?.();
});
// Keep Tab inside an open dialog (keyboard accessibility; game input goes through kit.input).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !modalKind) return;
  const focusables = focusablesIn($('#modal')), first = focusables[0], last = focusables.at(-1);
  if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#modal'))) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
    audio.hold('hidden', true);
    if (inGame && sim?.status === 'active' && !modalKind) pauseMenu();
  } else {
    audio.hold('hidden', false);
    accumulator = 0;
    // A menu closed while the tab was hidden leaves the battle paused with nothing on screen to resume it.
    if (inGame && sim?.status === 'active' && !modalKind) sim.paused = false;
  }
});
addEventListener('pagehide', () => saveGame());
addEventListener('beforeunload', () => saveGame());
addEventListener('resize', updateWorldRect);
const unlockAudio = () => audio.unlock().then(() => audio.music('music'));
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
document.addEventListener('keydown', unlockAudio, { once: true, capture: true });

kit.onResize(() => updateWorldRect());
kit.onPause((paused) => audio.hold('kit', paused));
kit.input.onSourceChange(applySource);

// Explicit diagnostic hooks expose observations, not hidden win buttons or cheats.
window.ironSignal = {
  version: VERSION,
  getState: () => (sim ? { mission: sim.missionIndex, status: sim.status, time: sim.time, credits: sim.credits[0], units: sim.pop(), objectives: sim.objectives(), selected: [...selected] } : null),
  getDiagnostics: () => ({ backend: kit.backendLabel, tier: kit.tier.name, fps: window.__kit?.fps || 0, bodies: debris.bodies, launching, audio: audio.status, speed: settings.speed }),
  getSave: () => storage.read('save'),
};

refreshTitle();
saveSettings();
applySource(kit.input.source);
updateWorldRect();
syncTouch();
kit.start(frame);
