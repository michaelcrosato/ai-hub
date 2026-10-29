/**
 * main.js — Stillpoint Frontier PCE on the shared 3D stack.
 *
 * Boots the kit (three.js r186 WebGPU with the WebGL2 fallback), builds the
 * frontier — streamed terrain, sky and weather, the three relays, the Field
 * Unit compound and territory atlas, the Whisperglass echoes, the vault below
 * the Stillpoint, GRID LAB — and runs the title → field loop with the pause
 * menu, the field tablet, the results screens and button prompts that follow
 * the device in use (keyboard and mouse, gamepad, touch).
 */
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { PLAYER, WORLD, STORAGE, ECHOES, EXPOSURE_LEVELS, travelTargets, formatDistance, formatDuration } from './data.js';
import { biomeAt } from './terrain.js';
import { createMaterials } from './primitives.js';
import { WorldStreamer, createTerrainField } from './world.js';
import { RenderSystem } from './render.js';
import { Environment, sampleEnvironment, formatWorldTime } from './sky.js';
import { Collision, Player } from './player.js';
import { Interactions } from './interaction.js';
import { Soundscape } from './audio.js';
import { Hud } from './hud.js';
import { RelayNetwork } from './relays.js';
import { FrontierContent } from './frontier.js';
import { WhisperglassNetwork } from './echoes.js';
import { StillpointBelow } from './below.js';
import { FieldStamps } from './stamps.js';
import { GridLab } from './gridlab.js';
import { MenuNav } from './nav.js';

/* ----------------------------------------------------------- input map */

// Standard bindings: move / look / jump / interact / pause everywhere, plus the
// frontier's field keys. Menus read move + confirm + back through nav.js.
const INPUT = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'], touch: 'Sprint' },
  crouch: { keys: ['KeyC', 'ControlLeft', 'ControlRight'], gamepad: ['B'], touch: 'Crouch' },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
  tablet: { keys: ['Tab', 'KeyM'], gamepad: ['Y', 'Back'], touch: { label: 'Tablet', slot: 'top' } },
  light: { keys: ['KeyL'], gamepad: ['RS'], touch: { label: 'Light', slot: 'top' } },
  waypoint: { keys: ['KeyN'] },
  transit: { keys: ['KeyT'] },
  gear: { keys: ['KeyX'], gamepad: ['LT'] },
  deploy: { keys: ['KeyG'], gamepad: ['RB'] },
  recipe: { keys: ['KeyK'], gamepad: ['RT'] },
  medkit: { keys: ['KeyH'], gamepad: ['LB'] },
  save: { keys: ['KeyR'] },
  quality: { keys: ['KeyQ'] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
};

/** Key hints on the tablet's operation buttons, per device (empty hides the hint). */
const TABLET_KEYS = {
  keyboard: { waypoint: 'N', transit: 'T', recipe: 'K', gear: 'X', deploy: 'G', medkit: 'H', light: 'L', save: 'R' },
  gamepad: { recipe: 'RT', gear: 'LT', deploy: 'RB', medkit: 'LB', light: 'R3' },
  touch: {},
};

const EXPOSURE_NOTES = {
  standard: 'Rain soaks, cold bites, hypothermia hurts',
  gentle: 'Exposure builds at half pace',
  off: 'Weather never harms the survey',
};

const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
const VIEW_RADII = [1, 2, 3, 4, 5, 6];
const BUILD_BUDGETS = [1, 2, 4, 8, 16];

const byId = (id) => document.getElementById(id);
const coarseOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;

/* ---------------------------------------------------------------- boot */

const hud = new Hud();
hud.setBootStatus('Negotiating WebGPU device…');

let kit;
try {
  kit = await boot({
    title: 'Stillpoint Frontier PCE',
    gear: 'none', // the title screen and the pause menu carry a Settings button (F9 works too)
    holdLoading: true,
    accent: '#83f4d7',
    background: '#071013',
    touch: { top: 'center', topOffset: 8 },
    input: INPUT,
  });
} catch (err) {
  hud.showFatal(err);
  throw err;
}

const { input } = kit;
kit.touch?.suspend(true, 'title');
const rendererLabel = kit.backend === 'webgpu' ? 'WEBGPU' : 'WEBGL 2';
hud.setBootStatus(`Starting the shared 3D stack // ${rendererLabel}`);

/* ------------------------------------------------------------- options */

function loadOptions() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE.options) || '{}');
    return { exposure: EXPOSURE_LEVELS.some((l) => l.id === raw?.exposure) ? raw.exposure : 'standard' };
  } catch {
    return { exposure: 'standard' };
  }
}

function saveOptions() {
  try {
    localStorage.setItem(STORAGE.options, JSON.stringify(options));
  } catch {
    /* options last for this session */
  }
}

const options = loadOptions();
const exposureLevel = () => EXPOSURE_LEVELS.find((l) => l.id === options.exposure) ?? EXPOSURE_LEVELS[0];

/* --------------------------------------------------------------- world */

let state = 'loading'; // 'loading' | 'title' | 'play'
let overlay = null; // null | 'pause' | 'tablet' | 'lab' | 'victory'
let environment = null;
let cinematic = false;
let bookmark = null;
let fps = 60;
let telemetryClock = 0;
let slowClock = 0;
let pauseOpenedAt = 0;
let frozenFrameDrawn = false;
let newArmedUntil = 0;
let newTimer = 0;

kit.loading.progress(0.64, 'Calibrating the first-person field rig…');
const scene = new THREE.Scene();
const camera = kit.fitCamera(new THREE.PerspectiveCamera(PLAYER.fov, 1, 0.18, WORLD.cameraFarClip));
const materials = createMaterials();
const terrain = createTerrainField();
const collision = new Collision();
const soundscape = new Soundscape();
const player = new Player(scene, camera, input, terrain, collision, { flashlightShadows: kit.tier.name !== 'low' });
const render = new RenderSystem(kit, scene, camera, materials, { seaLevel: terrain.seaLevel });

kit.loading.progress(0.7, 'Generating the frontier basin…');
const world = new WorldStreamer(scene, terrain, materials, { seed: WORLD.seed, seaLevel: WORLD.seaLevel });
world.setViewRadius(render.quality.worldRadius);
world.setHorizon(WORLD.distantTerrainRadius * kit.tier.drawDistance);
const interactions = new Interactions(camera, input, hud);

const fallbackSample = sampleEnvironment(1058, 'grey_meadow');
const relays = new RelayNetwork({ scene, terrain, interactions, materials, collision, render, hud, soundscape, input, onVictory: () => openFinale() });
const frontier = new FrontierContent({
  scene,
  terrain,
  player,
  collision,
  interactions,
  materials,
  hud,
  soundscape,
  input,
  render,
  environment: () => environment?.sample ?? fallbackSample,
  relayStatus: () => relays.completedIds,
  advanceTime: (minutes) => environment?.advance(minutes),
});
frontier.setExposure(exposureLevel().scale);

environment = new Environment({
  renderer: render,
  hud,
  startMinutes: frontier.worldMinutes,
  biomeAtPlayer: () => biomeAt(player.worldPosition.x, player.worldPosition.z, terrain.seed).biome.id,
  onTimeChanged: (minutes) => frontier.setWorldMinutes(minutes),
});

const isKnown = (id) => frontier.hasGuideEntry(id);
const recordGuide = (id) => frontier.recordGuideEntry(id);
const echoes = new WhisperglassNetwork({ scene, terrain, player, interactions, materials, hud, soundscape, input, isKnown, recordGuide });
const below = new StillpointBelow({
  scene,
  terrain,
  player,
  collision,
  interactions,
  materials,
  hud,
  soundscape,
  input,
  render,
  isKnown,
  recordGuide,
  reward: (items, reputation) => frontier.applyReward(items, reputation),
  onRevelation: (first) => openRevelation(first),
});
frontier.isSheltered = (p) => below.contains(p);
frontier.locationLabel = () => (below.inside ? '00 / BELOW' : null);
const stamps = new FieldStamps({ scene, terrain, player, materials });

player.onStep = (strength) => soundscape.step(strength);
player.onLand = (strength) => {
  soundscape.land(strength);
  input.rumble(0.2 + strength * 0.5, 90 + strength * 120);
};
interactions.onInteract = () => input.rumble(0.25, 60);
interactions.onCandidate = (has) => kit.touch?.setShown('interact', has);
kit.touch?.setShown('interact', false);

/* ----------------------------------------------------------- DOM hooks */

const bootEl = byId('boot');
const enterButton = byId('enter-button');
const pauseEl = byId('pause');
const pauseControls = byId('pause-controls');
const pauseExposure = byId('pause-exposure');
const pauseSaveNote = byId('pause-save-note');
const tabletEl = byId('tablet');
const tabletLog = byId('tablet-log');
const victoryEl = byId('victory');
const gridLabEl = byId('grid-lab');

// Every toast is also written to the tablet's log line, which stays readable while the tablet covers the HUD.
const baseToast = hud.showToast.bind(hud);
hud.showToast = (title, detail, kicker = 'FIELD LOG', ms) => {
  baseToast(title, detail, kicker, ms);
  tabletLog.textContent = `${kicker} // ${title} — ${detail}`;
};

byId('title-settings').addEventListener('click', () => kit.menu.open());
byId('continue-button').addEventListener('click', () => closeVictory());

pauseEl.addEventListener('click', (e) => {
  const action = e.target.closest?.('[data-pause]')?.dataset.pause;
  if (action && overlay === 'pause') pauseAction(action);
});

tabletEl.addEventListener('click', (e) => {
  const op = e.target.closest?.('[data-op]')?.dataset.op;
  if (op && overlay === 'tablet') tabletOp(op);
});

// Mouse look needs pointer lock: a click on the field takes it.
kit.canvas.addEventListener('pointerdown', (e) => {
  if (state === 'play' && overlay === null && e.pointerType === 'mouse' && !input.pointerLocked) lockIfMouse();
});

// Losing the lock mid-field (Esc, alt-tab, the settings panel) opens the pause menu.
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === kit.canvas;
  if (!locked && state === 'play' && overlay === null && input.source === 'keyboard') openPause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'play') {
      if (!frontier.suppressFinalSave) frontier.saveNow(false);
      if (overlay === null) openPause();
    }
    soundscape.setSuspended(true);
  } else {
    soundscape.setSuspended(kit.paused);
  }
});

addEventListener('pagehide', () => {
  if (state === 'play' && !frontier.suppressFinalSave) frontier.saveNow(false);
});

// Audio starts on the Enter click; any later gesture resumes a context the browser suspended.
const wakeAudio = () => {
  if (state === 'play') soundscape.start();
};
addEventListener('pointerdown', wakeAudio, true);
addEventListener('keydown', wakeAudio, true);

kit.onPause((paused) => soundscape.setSuspended(paused || document.hidden));
kit.onResize(() => {
  frozenFrameDrawn = false;
});
kit.onQuality((tier) => applyQuality(tier));
input.onSourceChange((src) => applySource(src));

/* ----------------------------------------------------------- GRID LAB */

const travelList = travelTargets();
const warm = () => world.warmStart(player.worldPosition, 25);
const syncWeatherAudio = () => soundscape.setWeather(environment.sample.precipitation, environment.sample.windKph);
const canOpenLab = () => state === 'play' && overlay !== 'victory';
const nav = new MenuNav(input);

const gridLab = new GridLab({
  canOpen: canOpenLab,
  begin: () => {
    frontier.beginGridLab();
    environment.setMinutes(frontier.worldMinutes);
    world.warmStart(player.worldPosition, 9);
    hud.setGridLab(true);
    interactions.clearPrompt();
  },
  sandboxActive: () => frontier.gridLabActive,
  onPanelChange: (open) => {
    hud.setGridLab(frontier.gridLabActive, open);
    if (open) {
      if (overlay === 'pause') closePause({ relock: false });
      if (overlay === 'tablet') closeTablet({ relock: false });
      overlay = 'lab';
      input.unlockPointer();
      interactions.clearPrompt();
      soundscape.setDimmed(true);
      kit.touch?.suspend(true, 'overlay');
      nav.attach(gridLabEl, { initial: byId('grid-lab-close'), onBack: () => gridLab.setOpen(false), focus: input.source !== 'touch' });
    } else if (overlay === 'lab') {
      overlay = null;
      nav.detach(gridLabEl);
      resumeField(true);
    }
  },
  travelTargets: travelList,
  toggleInvincibility: () => frontier.toggleGridLabInvincibility(),
  toggleInfiniteStamina: () => player.toggleInfiniteStamina(),
  cycleGroundSpeed: () => player.cycleGroundSpeed(),
  toggleFlight: () => player.toggleFieldDrift(),
  cycleFlightSpeed: () => player.cycleFieldDriftSpeed(),
  toggleFlashlight: () => player.toggleFlashlight(),
  adjustFov: (delta) => player.adjustFov(delta),
  resetFov: () => player.resetFov(),
  snapToGround: () => {
    if (player.fieldDriftEnabled) player.toggleFieldDrift();
    player.snapToGround();
    warm();
  },
  travel: (id) => {
    const target = travelList.find((t) => t.id === id);
    if (!target) return 'UNKNOWN TARGET';
    frontier.jumpGridLab(target.x, target.z + target.arrivalOffsetZ);
    warm();
    return target.label;
  },
  nextSettlement: () => {
    const settlement = frontier.cycleGridLabSettlement();
    world.warmStart(player.worldPosition, 9);
    return settlement.name;
  },
  nextEcho: () => {
    const echo = echoes.transitToNext();
    world.warmStart(player.worldPosition, 9);
    frontier.saveNow(false);
    return echo.name;
  },
  bookmark: () => {
    const p = player.worldPosition;
    bookmark = { x: p.x, y: p.y, z: p.z, heading: player.heading };
    return `Bookmark captured // ${Math.round(bookmark.x)}, ${Math.round(bookmark.y)}, ${Math.round(bookmark.z)}`;
  },
  returnBookmark: () => {
    if (!bookmark) return 'No runtime bookmark has been captured';
    frontier.jumpGridLab(bookmark.x, bookmark.z, bookmark.y, bookmark.heading);
    warm();
    return 'Runtime bookmark restored';
  },
  jump: (x, z, y, heading) => {
    const ok = frontier.jumpGridLab(x, z, y, heading);
    if (ok) warm();
    return ok;
  },
  toggleClock: () => environment.toggleFreeze(),
  cycleTimeScale: () => environment.cycleTimeScale(),
  setTimeScale: (scale) => environment.setTimeScale(scale),
  cycleTimeUpdateMode: () => environment.cycleTimeUpdateMode(),
  stepTime: (minutes) => {
    environment.advance(minutes);
    frontier.saveNow(false);
  },
  setTime: (minuteOfDay) => {
    environment.setTimeOfDay(minuteOfDay);
    frontier.saveNow(false);
  },
  cycleWeather: () => {
    const mode = environment.cycleWeatherOverride();
    syncWeatherAudio();
    return mode;
  },
  setWeather: (id) => {
    const mode = environment.setWeatherOverride(id);
    syncWeatherAudio();
    return mode;
  },
  toggleAiFreeze: () => frontier.toggleGridLabAiFreeze(),
  toggleEchoFreeze: () => echoes.toggleMotionFreeze(),
  grantKit: () => frontier.grantGridLabKit(),
  maxInventory: () => frontier.maxGridLabInventory(),
  clearInventory: () => frontier.clearGridLabInventory(),
  resetVitals: () => frontier.resetGridLabVitals(),
  setCondition: (name) => frontier.setGridLabCondition(name),
  revealIntel: () => frontier.revealGridLabIntel(),
  completeContracts: () => frontier.completeGridLabContracts(),
  resetContracts: () => frontier.resetGridLabContracts(),
  respawnResources: () => frontier.respawnGridLabResources(),
  cycleRelaySimulation: () => relays.cycleDevRelaySimulation(),
  cycleQuality: () => cycleQuality({ announce: false }),
  setQuality: (name) => {
    kit.settings.set({ quality: name });
    return render.quality.label;
  },
  toggleRenderFeature: (name) => render.toggleFeature(name),
  cycleViewRadius: () => {
    const next = VIEW_RADII[(VIEW_RADII.indexOf(world.viewRadius) + 1) % VIEW_RADII.length];
    world.setViewRadius(next);
    warm();
    return next;
  },
  cycleBuildBudget: () => {
    const next = BUILD_BUDGETS[(BUILD_BUDGETS.indexOf(world.buildBudget) + 1) % BUILD_BUDGETS.length];
    world.setBuildBudget(next);
    return next;
  },
  reloadChunks: () => world.reloadAround(player.worldPosition),
  toggleCinematic: () => {
    cinematic = !cinematic;
    hud.setCinematic(cinematic);
    return cinematic;
  },
  cycleStamp: () => stamps.cycleKind(),
  placeStamp: () => stamps.place(),
  undoStamp: () => {
    const removed = stamps.undo();
    return removed ? `Stamp removed // ${removed.kind.replaceAll('_', ' ')}` : 'Manifest already empty';
  },
  commit: () => {
    if (player.fieldDriftEnabled) player.toggleFieldDrift();
    player.snapToGround();
    const ok = frontier.commitGridLab();
    if (ok) setTimeout(() => location.reload(), 180);
    return ok;
  },
  discard: () => {
    const ok = frontier.discardGridLab();
    if (ok) setTimeout(() => location.reload(), 180);
    return ok;
  },
  telemetry: () => labTelemetry(),
});

applySource(input.source);

function labTelemetry() {
  const sample = environment.sample;
  const draw = render.drawStats();
  const p = player.worldPosition;
  return {
    renderer: rendererLabel,
    quality: render.quality.label,
    qualityId: render.quality.id,
    fps,
    drawCalls: draw.drawCalls,
    triangles: draw.triangles,
    loadedChunks: world.loadedChunkCount,
    pendingChunks: world.pendingChunkCount,
    worker: world.usingWorker,
    viewRadius: world.viewRadius,
    drawDistance: world.drawDistance,
    buildBudget: world.buildBudget,
    x: p.x,
    y: p.y,
    z: p.z,
    heading: player.heading,
    movement: player.fieldDriftEnabled ? `NOCLIP FLIGHT // ${player.fieldDriftSpeed} M/S` : `${player.groundSpeedLabel} GROUND // ${player.groundSpeedMultiplier}X`,
    groundSpeed: `${player.groundSpeedLabel} // ${player.groundSpeedMultiplier}X`,
    flight: player.fieldDriftEnabled,
    flightSpeed: player.fieldDriftSpeed,
    infiniteStamina: player.infiniteStaminaEnabled,
    flashlight: player.flashlightEnabled,
    fov: player.cameraFov,
    invincible: frontier.invincibilityEnabled,
    health: frontier.health,
    wetness: frontier.wetness,
    cold: frontier.cold,
    worldTime: formatWorldTime(sample),
    weather: `${sample.weatherLabel.toUpperCase()} // ${environment.weatherMode}${environment.isFrozen ? ' // HELD' : ''}`,
    celestial: `MOON ${sample.moonPhase.replaceAll('-', ' ').toUpperCase()} // ${Math.round(sample.moonIllumination * 100)}% // SHADOW ${String(render.shadowSource).toUpperCase()}`,
    weatherMode: environment.weatherMode,
    clockFrozen: environment.isFrozen,
    timeScale: environment.timeScale,
    timeUpdateMode: environment.timeUpdateMode,
    aiFrozen: frontier.aiMotionFrozen,
    echoFrozen: echoes.motionFrozen,
    guideKnown: frontier.knownGuideCount,
    guideTotal: frontier.guideTotal,
    inventoryTotal: frontier.inventoryTotal,
    contractCount: frontier.completedContractCount,
    contractTotal: frontier.contractCount,
    relayState: relays.relaySimulationLabel,
    echoCount: echoes.recordedCount,
    stampCount: stamps.count,
    selectedStamp: stamps.selectedKind,
    cinematic,
    renderFeatures: {
      grade: render.featureEnabled('grade'),
      shadows: render.featureEnabled('shadows'),
      bloom: render.featureEnabled('bloom'),
      atmosphere: render.featureEnabled('atmosphere'),
    },
  };
}

/* ------------------------------------------------------ device prompts */

function applySource(src) {
  hud.setInputSource(src);
  pauseControls.replaceChildren(...[...hud.controlsGrid.children].map((cell) => cell.cloneNode(true)));
  const keys = TABLET_KEYS[src] ?? TABLET_KEYS.keyboard;
  for (const kbd of tabletEl.querySelectorAll('kbd[data-key]')) kbd.textContent = keys[kbd.dataset.key] ?? '';
  if (src !== 'keyboard') hud.setLookHint(false);
}

function applyQuality(tier) {
  const profile = render.applyQuality(tier);
  world.setViewRadius(profile.worldRadius);
  world.setHorizon(WORLD.distantTerrainRadius * tier.drawDistance);
}

function cycleQuality({ announce = true } = {}) {
  const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(kit.tier.name) + 1) % QUALITY_ORDER.length];
  kit.settings.set({ quality: next });
  const profile = render.quality;
  if (announce) {
    hud.showToast(profile.label, `Shadow map ${kit.shadowSize(2048)} px // ${profile.worldRadius}-chunk detail // horizon ${(world.drawDistance / 1000).toFixed(1)} km`, 'QUALITY PROFILE');
  }
  return profile.label;
}

/**
 * Mouse look needs pointer lock. Ask only during a user gesture and catch both
 * attempts: browsers refuse a lock right after Esc released one, and an
 * uncaught refusal would surface as an error.
 */
function lockIfMouse() {
  if (input.source !== 'keyboard' || coarseOnly || document.pointerLockElement === kit.canvas) return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  const plain = () => {
    try {
      kit.canvas.requestPointerLock?.()?.catch?.(() => {});
    } catch {
      /* not allowed here */
    }
  };
  try {
    const request = kit.canvas.requestPointerLock?.({ unadjustedMovement: true });
    if (request?.catch) request.catch(plain);
  } catch {
    plain();
  }
}

/** Back to the field after any overlay: HUD, sound and touch controls return, held buttons do not fire. */
function resumeField(relock) {
  hud.setMenuOpen(false);
  soundscape.setDimmed(false);
  kit.touch?.suspend(false, 'overlay');
  input.settle();
  frozenFrameDrawn = false;
  const focused = document.activeElement;
  if (focused && focused !== document.body) focused.blur?.();
  if (relock) lockIfMouse();
}

/* ------------------------------------------------------------- title */

function showTitle() {
  state = 'title';
  hud.markReady({ hasSave: frontier.saveStore.hasSave(), onEnter: () => enterField(), onNew: () => newExpedition() });
  nav.attach(bootEl, { initial: enterButton, focus: input.source !== 'touch' });
}

function enterField() {
  if (state !== 'title') return;
  state = 'play';
  nav.detach(bootEl);
  hud.enterGame();
  soundscape.start();
  kit.touch?.suspend(false, 'title');
  input.settle();
  const focused = document.activeElement;
  if (focused && focused !== document.body) focused.blur?.();
  updateObjective();
  frontier.refreshHud(true);
  hud.showToast('Field link established', 'Relays may be restored in any order. Follow their sky markers.', 'STILLPOINT ONLINE', 4600);
  lockIfMouse();
}

function newExpedition() {
  const now = performance.now();
  if (now > newArmedUntil) {
    newArmedUntil = now + 4000;
    hud.armNewExpedition(true);
    clearTimeout(newTimer);
    newTimer = setTimeout(() => hud.armNewExpedition(false), 4000);
    return;
  }
  frontier.suppressFinalSave = true;
  frontier.saveStore.clearCampaign();
  location.reload();
}

/* -------------------------------------------------------------- pause */

function refreshPauseMenu() {
  const level = exposureLevel();
  pauseExposure.textContent = `${level.label} // ${EXPOSURE_NOTES[level.id] ?? ''}`;
}

function openPause() {
  if (state !== 'play' || overlay) return;
  overlay = 'pause';
  pauseOpenedAt = performance.now();
  frozenFrameDrawn = false;
  input.unlockPointer();
  interactions.clearPrompt();
  hud.setMenuOpen(true);
  soundscape.setDimmed(true);
  kit.touch?.suspend(true, 'overlay');
  refreshPauseMenu();
  pauseSaveNote.textContent = 'Autosaves every 30 seconds';
  pauseEl.classList.add('pause-card--visible');
  pauseEl.setAttribute('aria-hidden', 'false');
  nav.attach(pauseEl, { initial: pauseEl.querySelector('[data-pause="resume"]'), onBack: () => closePause(), focus: input.source !== 'touch' });
}

function closePause({ relock = true } = {}) {
  if (overlay !== 'pause') return;
  overlay = null;
  pauseEl.classList.remove('pause-card--visible');
  pauseEl.setAttribute('aria-hidden', 'true');
  nav.detach(pauseEl);
  resumeField(relock);
}

function pauseAction(action) {
  switch (action) {
    case 'resume':
      closePause();
      break;
    case 'tablet':
      closePause({ relock: false });
      openTablet();
      break;
    case 'save': {
      const ok = frontier.saveNow(false);
      const sample = environment.sample;
      pauseSaveNote.textContent = ok ? `Saved // field time ${formatWorldTime(sample)}` : 'This browser refused local storage';
      soundscape.ping(1);
      break;
    }
    case 'exposure': {
      const index = EXPOSURE_LEVELS.findIndex((l) => l.id === options.exposure);
      const next = EXPOSURE_LEVELS[(index + 1) % EXPOSURE_LEVELS.length];
      options.exposure = next.id;
      saveOptions();
      frontier.setExposure(next.scale);
      refreshPauseMenu();
      break;
    }
    case 'settings':
      kit.menu.open();
      break;
    case 'lab':
      if (canOpenLab()) gridLab.setOpen(true);
      break;
    case 'title':
      frontier.saveNow(false);
      frontier.suppressFinalSave = true;
      location.reload();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------- tablet */

function openTablet() {
  if (state !== 'play' || overlay) return;
  overlay = 'tablet';
  hud.toggleTablet(true);
  input.unlockPointer();
  interactions.clearPrompt();
  kit.touch?.suspend(true, 'overlay');
  frontier.refreshHud(true);
  nav.attach(tabletEl, { initial: tabletEl.querySelector('[data-op="waypoint"]'), onBack: () => closeTablet(), focus: input.source === 'gamepad' });
}

function closeTablet({ relock = true } = {}) {
  if (overlay !== 'tablet') return;
  overlay = null;
  hud.toggleTablet(false);
  nav.detach(tabletEl);
  resumeField(relock);
}

function tabletOp(op) {
  switch (op) {
    case 'close':
      closeTablet();
      break;
    case 'waypoint':
      frontier.cycleAtlasWaypoint();
      break;
    case 'transit':
      doTransit();
      break;
    case 'recipe':
      frontier.cycleRecipe();
      break;
    case 'gear':
      frontier.cycleDeployable();
      break;
    case 'deploy':
      doDeploy();
      break;
    case 'medkit':
      frontier.useMedkit();
      break;
    case 'light':
      toggleLight();
      break;
    case 'save':
      frontier.saveNow(true);
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------ field actions */

function doTransit() {
  if (!frontier.travelToWaypoint()) return false;
  world.warmStart(player.worldPosition, 9);
  input.rumble(0.4, 180);
  if (overlay === 'tablet') closeTablet();
  return true;
}

function doDeploy() {
  if (frontier.deploySelected() && overlay === 'tablet') closeTablet();
}

function toggleLight() {
  const on = player.toggleFlashlight();
  hud.showToast(on ? 'Field light active' : 'Field light stowed', on ? 'Warm core and cool spill online.' : 'Passive night adaptation restored.', 'EQUIPMENT', 1800);
  frontier.refreshHud(true);
}

/** Keys and buttons that work in the field and with the tablet open. */
function fieldActions() {
  if (input.pressed('light')) toggleLight();
  if (input.pressed('save')) frontier.saveNow(true);
  if (input.pressed('medkit')) frontier.useMedkit();
  if (input.pressed('recipe')) frontier.cycleRecipe();
  if (input.pressed('gear')) frontier.cycleDeployable();
  if (input.pressed('deploy')) doDeploy();
  if (input.pressed('waypoint')) frontier.cycleAtlasWaypoint();
  if (input.pressed('transit')) doTransit();
  if (input.pressed('quality')) cycleQuality();
}

/* ----------------------------------------------------------- results */

function statRows() {
  frontier.flushStats();
  const stats = frontier.stats;
  return [
    ['TIME IN FIELD', formatDuration(stats.seconds)],
    ['DISTANCE WALKED', formatDistance(stats.distance)],
    ['WORLD DAY', String(environment.sample.day).padStart(2, '0')],
    ['MERIDIAN STANDING', String(frontier.state.reputation).padStart(3, '0')],
    ['RELAYS', `${relays.actualCompletedCount} / 3`],
    ['CONTRACTS FILED', `${frontier.completedContractCount} / ${frontier.contractCount}`],
    ['FIELD GUIDE', `${frontier.knownGuideCount} / ${frontier.guideTotal}`],
    ['WHISPERGLASS', `${echoes.recordedCount} / ${ECHOES.length}`],
  ];
}

function showResults({ kicker, title, accent, text, reward = null }) {
  if (state !== 'play' || overlay === 'victory') return;
  if (overlay === 'tablet') closeTablet({ relock: false });
  if (overlay === 'pause') closePause({ relock: false });
  overlay = 'victory';
  frozenFrameDrawn = false;
  input.unlockPointer();
  interactions.clearPrompt();
  hud.setMenuOpen(true);
  soundscape.setDimmed(true);
  kit.touch?.suspend(true, 'overlay');
  byId('victory-kicker').textContent = kicker;
  const span = document.createElement('span');
  span.textContent = accent;
  byId('victory-title').replaceChildren(title, document.createElement('br'), span);
  byId('victory-text').textContent = text;
  const rewardEl = byId('victory-reward');
  rewardEl.hidden = !reward;
  rewardEl.textContent = reward ?? '';
  byId('victory-stats').replaceChildren(
    ...statRows().map(([label, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }),
  );
  victoryEl.classList.add('screen--visible');
  victoryEl.setAttribute('aria-hidden', 'false');
  input.rumble(0.6, 380);
  nav.attach(victoryEl, { initial: byId('continue-button'), onBack: () => closeVictory(), focus: input.source !== 'touch' });
}

function closeVictory() {
  if (overlay !== 'victory') return;
  overlay = null;
  victoryEl.classList.remove('screen--visible');
  victoryEl.setAttribute('aria-hidden', 'true');
  nav.detach(victoryEl);
  resumeField(true);
  updateObjective();
}

function openFinale() {
  if (!frontier.allContractsFiled) {
    hud.showToast(
      'Meridian files outstanding',
      `Mara Venn must sign all three field contracts before the Stillpoint archive will open (${frontier.coreContractsFiled} / 3 filed).`,
      'ARCHIVE LOCKED',
      4500,
    );
    soundscape.reject();
    input.rumble(0.4, 140);
    return;
  }
  frontier.markMilestone('finale');
  AIHub.result({ score: sessionScore() });
  const left = ECHOES.length - echoes.recordedCount;
  const coda = below.revealed
    ? ' You have already read it, beneath the Stillpoint.'
    : left > 0
      ? ` ${left} Whisperglass echo${left === 1 ? '' : 'es'} still hold${left === 1 ? 's' : ''} its bearing; the atlas can take you to each one.`
      : ' All six bearings are recorded. The sealed hatch on the Stillpoint foundation is listening.';
  showResults({
    kicker: 'NETWORK STATUS // RESTORED',
    title: 'THE FRONTIER',
    accent: 'REMEMBERS.',
    text: `All three networks answer the Stillpoint. The atlas is coherent again—and one impossible coordinate remains.${coda}`,
  });
}

function openRevelation(first) {
  frontier.markMilestone('below');
  showResults({
    kicker: '00 / BELOW // REMEMBER',
    title: 'THE LAST',
    accent: 'COORDINATE.',
    text: 'The six bearings do not point at a place. They point at the first survey stake of the atlas, driven here before Meridian drew a single border. The Stillpoint was never a relay: it is the zero the whole frontier was measured from, and it has been waiting for someone to read it back.',
    reward: first ? 'NEW FIELD GUIDE ENTRY: 00 / BELOW // +3 SALVAGE · +2 FIRST-AID KITS · +150 MERIDIAN STANDING' : null,
  });
}

/* ------------------------------------------------------------ objective */

function updateObjective() {
  const remaining = relays.remainingCount;
  let text;
  if (remaining > 0) text = `Restore the frontier relays // ${remaining} remaining`;
  else if (!frontier.allContractsFiled) text = `File the Meridian contracts with Mara Venn // ${frontier.coreContractsFiled} / 3`;
  else if (!frontier.hasMilestone('finale')) text = 'Return to the Stillpoint at the basin center';
  else if (echoes.recordedCount < ECHOES.length) text = `Follow the Whisperglass bearings // ${echoes.recordedCount} / ${ECHOES.length} recorded`;
  else if (!below.revealed) text = 'The hatch on the Stillpoint foundation answers // descend';
  else text = 'The frontier remembers // survey freely';
  hud.setObjective(text);
}

/* --------------------------------------------------------------- loop */

function titleFrame(dt) {
  player.idle(dt);
  relays.update(dt);
  nav.update(dt);
}

function fieldFrame(dt) {
  if (input.pressed('pause')) {
    openPause();
    return;
  }
  if (input.pressed('tablet')) {
    openTablet();
    return;
  }
  fieldActions();
  if (overlay !== null) return;
  player.update(dt);
  if (frontier.gridLabActive) {
    // The sandbox keeps relays and interactions read-only, as in the original build.
    if (interactions.hadCandidate) interactions.clearPrompt();
  } else {
    relays.update(dt);
    interactions.update(dt);
  }
}

function playFrame(dt) {
  switch (overlay) {
    case null:
      fieldFrame(dt);
      break;
    case 'tablet':
      if (input.pressed('tablet') || input.pressed('pause')) closeTablet();
      else {
        fieldActions();
        nav.update(dt);
      }
      break;
    case 'pause':
      // Esc can arrive both as the pointer-lock exit and as the key: ignore the echo.
      if (input.pressed('pause') && performance.now() - pauseOpenedAt > 250) closePause();
      else nav.update(dt);
      break;
    case 'victory':
      if (input.pressed('pause')) closeVictory();
      else nav.update(dt);
      break;
    case 'lab':
      if (input.pressed('pause')) gridLab.setOpen(false);
      else nav.update(dt);
      break;
    default:
      break;
  }
  // The world keeps living while the tablet or GRID LAB is up; the pause menu and results freeze it.
  if (overlay === null || overlay === 'tablet' || overlay === 'lab') {
    frontier.update(dt);
    environment.update(dt);
  }
  if (slowClock >= 0.25) {
    slowClock = 0;
    updateObjective();
    const sheltered = below.inside;
    soundscape.setWeather(sheltered ? 0 : environment.sample.precipitation, sheltered ? 0 : environment.sample.windKph);
    hud.setLookHint(overlay === null && input.source === 'keyboard' && !coarseOnly && !input.pointerLocked);
    AIHub.progress({ score: sessionScore(), label: `${relays.actualCompletedCount}/3 relays · ${frontier.completedContractCount} filed` });
  }
}

function frame(dt) {
  const instant = dt > 0 ? Math.min(240, 1 / dt) : fps;
  fps += (instant - fps) * 0.07;
  telemetryClock += dt;
  slowClock += dt;

  if (state !== 'play') titleFrame(dt);
  else if (sessionLive()) playFrame(dt);

  world.streamAround(player.worldPosition);
  below.update(dt);
  render.sheltered = below.inside;
  echoes.update(dt);
  gridLab.update(dt);
  render.update(dt);

  if (telemetryClock >= 0.15 && state === 'play') {
    telemetryClock = 0;
    const p = player.worldPosition;
    hud.updateTelemetry({ renderer: rendererLabel, quality: render.quality.label, fps, x: p.x, z: p.z, heading: player.heading });
  }

  // Behind the pause menu and the results screen the picture stands still: draw it once, then rest the GPU.
  const frozen = overlay === 'pause' || overlay === 'victory' || sessionEnded;
  if (frozen && frozenFrameDrawn) return;
  frozenFrameDrawn = frozen;
  render.render();
}

/* ------------------------------------------------------------ test hook */

const e2e = new URLSearchParams(location.search).get('e2e') === '1';
Object.defineProperty(window, '__STILLPOINT_TEST__', {
  configurable: true,
  value: {
    snapshot: () => ({
      renderer: rendererLabel,
      state,
      overlay,
      loadedChunks: world.loadedChunkCount,
      pendingChunks: world.pendingChunkCount,
      celestial: render.celestialSnapshot(),
      player: { x: player.worldPosition.x, y: player.worldPosition.y, z: player.worldPosition.z, heading: player.heading, stamina: player.stamina },
      frontier: frontier.testSnapshot(),
      relays: relays.actualCompletedCount,
      echoes: echoes.recordedCount,
      below: { inside: below.inside, unlocked: below.unlocked, revealed: below.revealed },
      gridLab: { active: frontier.gridLabActive, open: gridLab.isOpen, stamps: stamps.count },
    }),
    enter: () => (e2e ? (enterField(), state === 'play') : false),
    teleport: (x, z) => {
      if (!e2e || !Number.isFinite(x) || !Number.isFinite(z)) return false;
      player.teleport(x, z);
      world.warmStart(player.worldPosition, 9);
      return true;
    },
    setTime: (minutes) => (e2e && Number.isFinite(minutes) ? (environment.setMinutes(minutes), true) : false),
    toggleTablet: () => (e2e ? (overlay === 'tablet' ? closeTablet() : openTablet(), overlay === 'tablet') : false),
    save: () => (e2e ? frontier.saveNow(false) : false),
    cycleAtlas: () => (e2e ? (frontier.cycleAtlasWaypoint(), true) : false),
    travel: () => (e2e ? doTransit() : false),
    deploy: () => (e2e ? frontier.deploySelected() : false),
  },
});

/* ------------------------------------------------------------- session */

// Side by side: every copy starts from the same seed on the hub's clock and reports only its own score.
let sessionEnded = false;

/** Relays and contracts 100 each, field guide entries 10, Whisperglass echoes 50. */
const sessionScore = () =>
  relays.actualCompletedCount * 100 + frontier.completedContractCount * 100 + frontier.knownGuideCount * 10 + echoes.recordedCount * 50;

/** Outside a round the field always runs; in one it waits for the hub's clock and stops when the hub ends it. */
const sessionLive = () => !AIHub.active || (AIHub.time() >= 0 && !sessionEnded);

/** A round opens on the field itself: no title screen, and the hub's clock starts play. */
function startSession() {
  AIHub.on('time-up', () => AIHub.result({ score: sessionScore() }));
  AIHub.on('end', () => {
    sessionEnded = true;
    soundscape.setSuspended(true);
  });
  state = 'title'; // enterField is the title's Enter button; the round goes straight to it
  enterField();
  AIHub.ready();
}

/* -------------------------------------------------------------- start */

kit.start(frame);
kit.loading.progress(0.8, 'Streaming the first terrain chunks…');
hud.setBootStatus('Generating the frontier basin…');
await world.whenReady(12000);
kit.loading.progress(1, 'Field systems online');
kit.loading.done();
const session = AIHub.active ? await AIHub.connect({ mode: 'parallel', seats: [1, 4] }) : null;
if (session) startSession();
else showTitle();
