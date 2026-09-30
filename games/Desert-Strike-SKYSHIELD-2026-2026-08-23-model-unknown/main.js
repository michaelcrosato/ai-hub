/**
 * SKYSHIELD: 2026 — entry point. Boots the shared 3D kit, owns the campaign
 * state and the menu screens, and hands each sortie to flight.js.
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { MISSIONS, FINALE_ID, gradeFor, GRADE_RANK } from './data.js';
import { loadSettings, saveSettings, loadCampaign, saveCampaign, freshCampaign } from './save.js';
import * as audio from './audio.js';
import { createDiorama } from './diorama.js';
import { Sortie } from './flight.js';
import * as menus from './menus.js';
import { esc } from './hud.js';
import { firstFocus, focusEl, neighbour, createRepeater, FOCUSABLE } from './nav.js';

/* ------------------------------------------------------------ input */

const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  aim: { type: 'vector', gamepad: 'rightStick' },
  fire: { keys: ['Space', 'KeyJ'], mouse: [0], gamepad: ['RT', 'X'], touch: 'FIRE' },
  rocket: { keys: ['KeyR', 'KeyK'], mouse: [2], gamepad: ['LT'], touch: 'RKT' },
  flare: { keys: ['KeyF'], gamepad: ['B'], touch: 'FLR' },
  boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'], touch: 'BOOST' },
  service: { keys: ['KeyX'], gamepad: ['A', 'Y'], touch: 'SERV' },
  altitude: { type: 'axis', keys: { pos: ['KeyE'], neg: ['KeyQ'] }, gamepad: { pos: 'RB', neg: 'LB' }, touch: { pos: 'UP', neg: 'DN', slot: 'top' } },
  camera: { keys: ['KeyC'], gamepad: ['RS'], touch: { label: 'CAM', slot: 'top' } },
  map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'MAP', slot: 'top' } },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};
// Tab toggles the camera in flight (the original binding) but stays a focus key in menus.
const CAMERA_FLIGHT = { ...ACTIONS.camera, keys: ['KeyC', 'Tab'] };

const PROMPTS = {
  keyboard: { move: 'WASD', alt: 'Q/E', fire: 'SPACE / LMB', rocket: 'R / RMB', flare: 'F', service: 'X', boost: 'SHIFT', camera: 'TAB', map: 'M', pause: 'ESC', confirm: 'ENTER / SPACE' },
  gamepad: { move: 'L-STICK', alt: 'LB/RB', fire: 'RT', rocket: 'LT', flare: 'B', service: 'A', boost: 'L3', camera: 'R3', map: 'VIEW', pause: 'START', confirm: 'A' },
  touch: { move: 'STICK', alt: 'UP/DN', fire: 'FIRE', rocket: 'RKT', flare: 'FLR', service: 'SERV', boost: 'BOOST', camera: 'CAM', map: 'MAP', pause: 'II', confirm: 'TAP' },
};

const kit = await boot({
  title: 'SKYSHIELD: 2026',
  gear: 'none',
  accent: '#f2a84a',
  background: '#170e09',
  touch: { top: 'center', topOffset: 8 },
  input: ACTIONS,
});
const input = kit.input;
const prompts = () => PROMPTS[input.source] || PROMPTS.keyboard;

// The original rendered through React Three Fiber's defaults: ACES tone mapping, sRGB output, soft shadows.
kit.renderer.toneMapping = THREE.ACESFilmicToneMapping;
kit.renderer.shadowMap.enabled = true;
kit.renderer.shadowMap.type = THREE.PCFShadowMap;

/* ------------------------------------------------------------ state */

const state = {
  screen: 'title',
  missionIndex: 0,
  settings: loadSettings(),
  save: loadCampaign(),
  hangarReturn: 'title',
  debrief: null,
  modal: null,
};
{
  const last = MISSIONS.findIndex((m) => m.id === state.save.lastMissionId);
  if (last >= 0 && last < state.save.unlocked) state.missionIndex = last;
}

const app = document.getElementById('app');
app.innerHTML = `<div class="diorama-shade" aria-hidden="true"></div><div class="scanlines" aria-hidden="true"></div>
  <div id="mast"></div><div id="screen"></div><div id="flight"></div><div id="foot"></div><div id="modal"></div>`;
const mastEl = app.querySelector('#mast');
const screenEl = app.querySelector('#screen');
const flightEl = app.querySelector('#flight');
const footEl = app.querySelector('#foot');
const modalEl = app.querySelector('#modal');

const diorama = createDiorama(kit);
let dioramaDirty = true;
const flightCamera = kit.fitCamera(new THREE.PerspectiveCamera(48, 1, 0.1, 300));
flightCamera.position.set(16, 28, 24);
let sortie = null;

const persistSettings = () => saveSettings(state.settings);
const persistSave = () => saveCampaign(state.save);

function applySettings() {
  const s = state.settings;
  app.className = `game-shell color-${s.colorMode}${s.reducedMotion ? ' reduce-motion' : ''}${state.screen === 'playing' ? ' is-flying' : ''}`;
  app.style.setProperty('--hud-scale', String(s.hudScale));
  audio.setVolumes(s);
  sortie?.settingsChanged();
  dioramaDirty = true;
}

/* ------------------------------------------------------------ rendering the menus */

const focusKey = (el) => (el && el !== document.body ? `${el.dataset?.action || ''}|${el.dataset?.arg || ''}|${el.dataset?.cycle || ''}` : '');

function restoreFocus(scope, key) {
  if (!scope) return;
  let el = null;
  if (key && key !== '||') el = [...scope.querySelectorAll(FOCUSABLE)].find((b) => focusKey(b) === key) || null;
  focusEl(el || firstFocus(scope));
}

function screenHtml() {
  switch (state.screen) {
    case 'title':
      return menus.titleScreen(state);
    case 'operations':
      return menus.operationsScreen(state);
    case 'briefing':
      return menus.briefingScreen(state);
    case 'debrief':
      return menus.debriefScreen(state);
    case 'hangar':
      return menus.hangarScreen(state);
    case 'credits':
      return menus.creditsScreen(state);
    default:
      return '';
  }
}

function render(keepFocus = true) {
  const key = keepFocus ? focusKey(document.activeElement) : '';
  const playing = state.screen === 'playing';
  applySettings();
  mastEl.innerHTML = playing ? '' : menus.masthead();
  footEl.innerHTML = playing ? '' : menus.footer();
  screenEl.innerHTML = playing ? '' : screenHtml();
  input.define({ camera: playing ? CAMERA_FLIGHT : ACTIONS.camera });
  kit.touch?.suspend(!playing, 'screen');
  kit.canvas.style.cursor = playing ? 'crosshair' : '';
  diorama.setAccent(MISSIONS[state.missionIndex].accent);
  renderModal(false);
  if (!state.modal && !playing) restoreFocus(screenEl.firstElementChild ? app : null, key);
}

function renderModal(focus = true) {
  const t = state.modal;
  modalEl.innerHTML =
    t === 'manual' ? menus.manualModal(input.source) : t === 'settings' ? menus.settingsModal(state.settings, !!sortie) : t === 'confirm' ? menus.confirmModal() : '';
  if (t && focus) focusEl(firstFocus(modalEl));
}

function openModal(type) {
  state.modalReturn = focusKey(document.activeElement);
  state.modal = type;
  renderModal();
  input.settle();
}

function closeModal() {
  state.modal = null;
  renderModal(false);
  input.settle();
  const scope = sortie ? (sortie.ui.overlayOpen ? sortie.ui.h.overlay : null) : app;
  restoreFocus(scope, state.modalReturn);
}

function go(screen) {
  state.screen = screen;
  state.modal = null;
  render(false);
  if (screen !== 'playing') audio.playMusic('menu');
}

/** Update a setting's button in place (focus stays where it is). */
function refreshCycler(key) {
  const c = menus.CYCLERS[key];
  const v = state.settings[key];
  for (const b of app.querySelectorAll(`[data-cycle="${key}"]`)) {
    b.querySelector('b').innerHTML = `<i data-dir="-1" aria-hidden="true">‹</i>${esc(c.format(v))}<i data-dir="1" aria-hidden="true">›</i>`;
    if (c.toggle) b.setAttribute('aria-checked', String(!!v));
  }
}

function changeSetting(key, dir) {
  state.settings = { ...state.settings, [key]: menus.cycleValue(key, state.settings[key], dir) };
  persistSettings();
  applySettings();
  refreshCycler(key);
  audio.sfx('ui');
}

/* ------------------------------------------------------------ campaign flow */

function checkpointFor(m, phaseIndex, score, stage, phaseScore, elapsed) {
  return {
    missionId: m.id,
    missionRevision: m.revision || 1,
    phaseId: m.phases[phaseIndex].id,
    phaseIndex,
    score,
    stage,
    phaseScore,
    elapsed,
  };
}

const env = {
  kit,
  camera: flightCamera,
  host: flightEl,
  getSettings: () => state.settings,
  prompts,
  isModalOpen: () => !!state.modal || kit.menu.isOpen,
  onCheckpoint(phaseIndex, score, stage, phaseScore, elapsed) {
    const m = MISSIONS[state.missionIndex];
    state.save = { ...state.save, checkpoint: checkpointFor(m, phaseIndex, score, stage, phaseScore, elapsed), lastMissionId: m.id };
    persistSave();
  },
  onComplete(score, elapsed) {
    const n = state.missionIndex;
    const m = MISSIONS[n];
    const s = state.save;
    const first = !s.completed.includes(m.id);
    const base = 1500 + Math.floor(score / 20);
    const reward = first ? base : Math.max(250, Math.floor(base * 0.25));
    const grade = gradeFor(score);
    const rec = s.records[m.id] || { bestScore: 0, bestGrade: null, bestTime: null, clears: 0 };
    const newBestScore = rec.clears > 0 && score > rec.bestScore;
    const newBestTime = rec.clears > 0 && elapsed > 0 && (!rec.bestTime || elapsed < rec.bestTime);
    const record = {
      bestScore: Math.max(rec.bestScore, score),
      bestGrade: !rec.bestGrade || GRADE_RANK[grade] > GRADE_RANK[rec.bestGrade] ? grade : rec.bestGrade,
      bestTime: elapsed > 0 && (!rec.bestTime || elapsed < rec.bestTime) ? elapsed : rec.bestTime,
      clears: rec.clears + 1,
    };
    state.save = {
      ...s,
      completed: first ? [...s.completed, m.id] : s.completed,
      credits: s.credits + reward,
      unlocked: Math.max(s.unlocked, Math.min(MISSIONS.length, n + 2)),
      checkpoint: undefined,
      lastMissionId: m.id,
      records: { ...s.records, [m.id]: record },
    };
    persistSave();
    state.debrief = { score, reward, grade, time: elapsed, newBestScore, newBestTime };
    endSortie();
    go('debrief');
  },
  onAbort() {
    endSortie();
    go('briefing');
  },
  onCameraMode(mode) {
    state.settings = { ...state.settings, camera: mode };
    persistSettings();
  },
};

function startSortie({ startPhase = 0, startStage = 'briefing', initialScore = 0, initialPhaseScore = 0, initialElapsed = 0 } = {}) {
  const mission = MISSIONS[state.missionIndex];
  endSortie();
  state.screen = 'playing';
  state.modal = null;
  render(false);
  audio.unlockAudio();
  sortie = new Sortie(env, { mission, startPhase, startStage, initialScore, initialPhaseScore, initialElapsed, upgrades: { ...state.save.upgrades } });
  audio.playMusic(mission.biome);
}

function endSortie() {
  if (!sortie) return;
  sortie.dispose();
  sortie = null;
  audio.holdAudio(false);
  dioramaDirty = true;
}

function resumeCheckpoint() {
  const cp = state.save.checkpoint;
  if (!cp) return;
  const i = MISSIONS.findIndex((m) => m.id === cp.missionId);
  state.missionIndex = Math.max(0, i);
  startSortie({ startPhase: cp.phaseIndex, startStage: cp.stage, initialScore: cp.score, initialPhaseScore: cp.phaseScore || 0, initialElapsed: cp.elapsed || 0 });
}

function launch() {
  const m = MISSIONS[state.missionIndex];
  if (state.missionIndex >= state.save.unlocked) return;
  state.save = { ...state.save, checkpoint: checkpointFor(m, 0, 0, 'briefing', 0, 0), lastMissionId: m.id };
  persistSave();
  startSortie({ startPhase: 0, startStage: 'briefing' });
}

function newCampaign() {
  const s = state.save;
  if (s.completed.length > 0 || s.checkpoint) openModal('confirm');
  else startNewCampaign();
}

function startNewCampaign() {
  state.save = { ...freshCampaign(), records: state.save.records };
  persistSave();
  state.missionIndex = 0;
  go('briefing');
}

function debriefNext() {
  const n = state.missionIndex;
  const m = MISSIONS[n];
  if (m.id === FINALE_ID) go('credits');
  else if (n + 1 < MISSIONS.length) {
    state.missionIndex = n + 1;
    go('briefing');
  } else go('operations');
}

function buy(id) {
  const s = state.save;
  const tier = s.upgrades[id] || 0;
  const cost = menus.upgradeCost(tier);
  if (tier >= 3 || s.credits < cost) return;
  state.save = { ...s, credits: s.credits - cost, upgrades: { ...s.upgrades, [id]: tier + 1 } };
  persistSave();
  audio.sfx('service');
  render();
}

/* ------------------------------------------------------------ actions */

function handle(action, arg) {
  switch (action) {
    case 'go-title':
      go('title');
      break;
    case 'go-operations':
      go('operations');
      break;
    case 'go-briefing':
      if (state.missionIndex < state.save.unlocked) go('briefing');
      break;
    case 'go-hangar':
      state.hangarReturn = 'title';
      go('hangar');
      break;
    case 'hangar-back':
      go(state.hangarReturn);
      break;
    case 'select-op': {
      const i = Number(arg);
      if (Number.isInteger(i) && i < state.save.unlocked) {
        state.missionIndex = i;
        render();
      }
      break;
    }
    case 'continue':
      resumeCheckpoint();
      break;
    case 'resume-op':
      resumeCheckpoint();
      break;
    case 'new-campaign':
      newCampaign();
      break;
    case 'confirm-new':
      state.modal = null;
      startNewCampaign();
      break;
    case 'launch':
      launch();
      break;
    case 'debrief-hangar':
      state.hangarReturn = 'debrief';
      go('hangar');
      break;
    case 'debrief-next':
      debriefNext();
      break;
    case 'buy':
      buy(arg);
      break;
    case 'open-manual':
      openModal('manual');
      break;
    case 'open-settings':
      openModal('settings');
      break;
    case 'open-kit':
      kit.menu.open();
      break;
    case 'close-modal':
      closeModal();
      break;
    default:
      sortie?.action(action);
      return;
  }
  audio.sfx('ui');
}

app.addEventListener('click', (e) => {
  const cyc = e.target.closest('[data-cycle]');
  if (cyc && !cyc.disabled) {
    const dir = Number(e.target.closest('[data-dir]')?.dataset.dir || 1);
    changeSetting(cyc.dataset.cycle, dir);
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  handle(el.dataset.action, el.dataset.arg);
});

/* ------------------------------------------------------------ menu navigation (pad, keys) */

const repeat = createRepeater();

function activeScope() {
  if (kit.menu.isOpen) return null;
  if (state.modal) return modalEl;
  if (sortie) return sortie.ui.overlayOpen ? sortie.ui.h.overlay : null;
  return app;
}

function goBack() {
  if (state.modal) {
    closeModal();
    return;
  }
  if (sortie) {
    sortie.back();
    return;
  }
  switch (state.screen) {
    case 'operations':
    case 'credits':
      go('title');
      break;
    case 'briefing':
      go('operations');
      break;
    case 'hangar':
      go(state.hangarReturn);
      break;
    default:
      break;
  }
}

function navFrame(dt) {
  const scope = activeScope();
  const v = input.vector('move');
  if (!scope) {
    repeat({ x: 0, y: 0 }, dt);
    return;
  }
  const cur = document.activeElement;
  const inScope = !!cur && cur !== document.body && scope.contains(cur) && cur.matches(FOCUSABLE);
  const dir = repeat(v, dt);
  if (dir) {
    if (!inScope) focusEl(firstFocus(scope));
    else if (dir[0] && cur.dataset.cycle) changeSetting(cur.dataset.cycle, dir[0]);
    else {
      const n = neighbour(scope, cur, dir[0], dir[1]);
      if (n) {
        focusEl(n);
        audio.sfx('ui', 0.6);
      }
    }
  }
  if (input.pressed('confirm')) {
    if (inScope) cur.click();
    else focusEl(firstFocus(scope));
  }
  // Escape / P / Start step back in menus; in flight they are the pause key (handled by the sortie).
  if (input.pressed('back') || (input.pressed('pause') && (!sortie || state.modal))) goBack();
}

/* ------------------------------------------------------------ system events */

const unlock = () => {
  audio.unlockAudio();
  audio.setVolumes(state.settings);
};
addEventListener('pointerdown', unlock, true);
addEventListener('keydown', unlock, true);

document.documentElement.dataset.input = input.source;
input.onSourceChange((src) => {
  document.documentElement.dataset.input = src;
  // A controller press may count as a gesture in this browser; try to start sound then too.
  if (src === 'gamepad') unlock();
  sortie?.ui.applyPrompts();
  if (state.modal === 'manual') {
    const key = focusKey(document.activeElement);
    renderModal(false);
    restoreFocus(modalEl, key);
  }
});

const gameHolds = () => !!sortie && (sortie.paused || sortie.mapOpen);
kit.onPause((p) => {
  if (p) {
    sortie?.autoPause();
    audio.holdAudio(true);
  } else if (!gameHolds() && !document.hidden) audio.holdAudio(false);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sortie?.autoPause();
    audio.holdAudio(true);
  } else if (!gameHolds() && !kit.menu.isOpen) audio.holdAudio(false);
});
addEventListener('gamepaddisconnected', () => sortie?.autoPause());
kit.onResize(() => {
  dioramaDirty = true;
  if (sortie) sortie.dirty = true;
});
kit.onQuality(() => {
  dioramaDirty = true;
  if (sortie) sortie.dirty = true;
});

/* ------------------------------------------------------------ go */

render(false);
audio.setVolumes(state.settings);
audio.playMusic('menu');

// Frames are only drawn when something changed (menus with reduced motion, pause screens).
// A new drawing-buffer size (dynamic resolution, quality) clears the canvas, so redraw then.
const view = kit.renderer.domElement;
let bufferW = 0;
let bufferH = 0;

kit.start((dt, t) => {
  if (view.width !== bufferW || view.height !== bufferH) {
    bufferW = view.width;
    bufferH = view.height;
    dioramaDirty = true;
    if (sortie) sortie.dirty = true;
  }
  if (sortie) sortie.frame(dt, t);
  else {
    const moved = diorama.update(dt, state.settings.reducedMotion);
    if (moved || dioramaDirty) {
      dioramaDirty = false;
      kit.renderer.render(diorama.scene, diorama.camera);
    }
  }
  navFrame(dt);
});
