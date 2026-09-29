// Geometric Lightfield — a real-time lighting study in a five-room house after dark.
// Boots on the shared kit (WebGPU with WebGL2 fallback), builds the yard, the house,
// the shed and the lights, and runs free roam or the timed Night Rounds.
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { Materials } from './materials.js';
import { buildWorld } from './world.js';
import { House, HOUSE_LIGHTS, ROOMS } from './house.js';
import { LightDirector } from './director.js';
import { Lighting } from './lighting.js';
import { EnvironmentLight, AutoExposure, DayCycle } from './environment.js';
import { Player } from './player.js';
import { Helicopter } from './helicopter.js';
import { Interactions } from './interactions.js';
import { PostPipeline } from './post.js';
import { HouseAudio } from './audio.js';
import { Hud, MenuNav, FrameStats, KEYS, dayLabel, formatTime } from './ui.js';

const SAVE_KEY = 'geometric-lightfield.v1';
const FIXED_STEP = 1 / 60;
const MAX_STEPS = 5;
const DEFAULT_SETTINGS = {
  timeOfDay: 1,
  autoSun: false,
  helicopterLight: true,
  flashlight: false,
  exposure: 1.05,
  autoExposure: true,
  contactShadows: true,
  sound: true,
};

function readSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function sanitizeSettings(raw) {
  const out = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
  const t = num(raw.timeOfDay, 0, 1);
  if (t !== null) out.timeOfDay = t;
  const e = num(raw.exposure, 0.7, 1.35);
  if (e !== null) out.exposure = e;
  for (const key of ['autoSun', 'helicopterLight', 'flashlight', 'autoExposure', 'contactShadows', 'sound']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  return out;
}

const saved = readSave();
const settings = sanitizeSettings(saved.settings);
let best = typeof saved.best === 'number' && Number.isFinite(saved.best) && saved.best > 0 ? saved.best : null;
let runs = Number.isInteger(saved.runs) && saved.runs > 0 ? saved.runs : 0;
let panelOpen = typeof saved.panelOpen === 'boolean' ? saved.panelOpen : innerWidth >= 1100 && !matchMedia('(pointer: coarse)').matches;

const kit = await boot({
  title: 'Geometric Lightfield',
  gear: 'none',
  accent: '#f3a65d',
  background: '#182126',
  // Top pills (View) on the right under the rail, clear of the rounds checklist on the left.
  touch: { top: 'right', topOffset: 72 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    // Drag works with or without pointer lock, so the mouse can still look if the lock is refused.
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
    interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Switch' },
    carry: { keys: ['KeyG'], gamepad: ['Y'], touch: 'Carry' },
    flashlight: { keys: ['KeyF'], gamepad: ['RT'], touch: 'Light' },
    run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS', 'B'], touch: 'Run' },
    orbit: { mouse: [2], gamepad: ['LT'] },
    zoomIn: { gamepad: ['RB'] },
    zoomOut: { gamepad: ['LB'] },
    view: { keys: ['KeyV'], gamepad: ['RS'], touch: { label: 'View', slot: 'top' } },
    reset: { keys: ['KeyR'], gamepad: ['Back'] },
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { gamepad: ['B'] },
  },
});
const { input, renderer } = kit;

renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = settings.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
kit.canvas.setAttribute('aria-label', 'Geometric Lightfield game');

// ---------------------------------------------------------------- the world
kit.loading.progress(0.65, 'Waking the house…');
const scene = new THREE.Scene();
const materials = new Materials();
const director = new LightDirector();
director.setQuality(kit.tier.name);
const environment = new EnvironmentLight(renderer, scene);
const world = buildWorld(scene, materials);
const house = new House(scene, materials, director);
const lighting = new Lighting(scene, [...world.contactPoints, ...house.contactPoints], director);
const hud = new Hud();
const audio = new HouseAudio();
const autoExposure = new AutoExposure();
const dayCycle = new DayCycle();
const stats = new FrameStats();
const nav = new MenuNav(input);
const tmp = new THREE.Vector3();
const listener = { x: 0, y: 0, z: 0, rightX: 1, rightZ: 0 };
let currentRoom = null;
let liveExposure = settings.exposure;

const player = new Player(scene, [...world.colliders, ...house.colliders], materials, {
  onCameraMode: (mode) => {
    hud.setCameraMode(mode);
    lighting.updateFrustums();
  },
  onStep: (speed) => audio.step(currentRoom !== null, speed),
  onJump: () => audio.burst('bandpass', 700, 0.035, 0.12),
  onLand: (impact) => {
    if (impact < 4.5) return;
    audio.thud(Math.min(1, impact / 12));
    input.rumble(Math.min(0.6, impact / 20), 90);
  },
});
kit.fitCamera(player.camera);
kit.onResize(() => {
  lighting.updateFrustums();
  updateTouchSuspend();
});
const helicopter = new Helicopter(scene, materials, world.houseCenter, director);

const niceLabel = (label) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label);
const roomLabel = (id) => ROOMS.find((r) => r.id === id)?.label ?? 'Yard';

const interactions = new Interactions({
  camera: player.camera,
  player,
  lightControls: [...house.lightControls, helicopter.lightControl],
  carryables: [...world.movableObjects, ...house.carryables],
  occluders: [world.root, house.staticRoot],
  flashlight: lighting.flashlightControl,
  onLightChanged: (control, on) => {
    if (control.id === 'flashlight') {
      settings.flashlight = on;
      audio.flashlightClick(on);
    } else {
      control.root.getWorldPosition(tmp);
      const spot = audio.place(listener, tmp.x, tmp.y, tmp.z, 6, true);
      audio.switchClick(on, 0.45 + 0.55 * spot.gain, spot.pan);
      if (control.id === 'helicopter-light') settings.helicopterLight = on;
    }
    input.rumble(0.15, 50);
    hud.syncSettings(settings, liveExposure);
    lightsChanged();
  },
  onCarryChanged: (picked) => {
    audio.thud(picked ? 0.35 : 0.6);
    input.rumble(0.25, 70);
  },
});

house.events.clockTick = (pos) => {
  if (!audio.ready) return;
  const spot = audio.place(listener, pos.x, pos.y, pos.z, 2.2, currentRoom === 'study');
  audio.tick(spot.gain, spot.pan);
};
house.events.porchTrigger = (pos) => {
  const spot = audio.place(listener, pos.x, pos.y, pos.z, 7, currentRoom === null);
  audio.relay(Math.min(1, spot.gain * 1.6), spot.pan);
};

// The seven lights Night Rounds asks for.
const tracked = HOUSE_LIGHTS.map((l) => ({ ...l, control: house.lightControls.find((c) => c.id === l.id) }));
const rounds = {
  active: false,
  elapsed: 0,
  lastCount: 0,
  items: tracked.map((t) => ({ id: t.id, label: t.label, room: roomLabel(t.room), on: false })),
};
function countLit() {
  let n = 0;
  for (let i = 0; i < tracked.length; i += 1) {
    const on = tracked[i].control.isEnabled();
    rounds.items[i].on = on;
    if (on) n += 1;
  }
  return n;
}

// Restore the last session's switches (free roam carries on where it stopped).
if (saved.lights && typeof saved.lights === 'object') {
  for (const c of house.lightControls) {
    const v = saved.lights[c.id];
    if (typeof v === 'boolean' && c.isEnabled() !== v) c.setEnabled(v);
  }
}

kit.loading.progress(0.8, 'Compiling the real-time lights…');
const post = new PostPipeline(renderer, scene, player.camera);

// ---------------------------------------------------------------- settings, quality, save

function applyQuality() {
  const tier = kit.tier.name;
  director.setQuality(tier);
  lighting.setShadowQuality(tier);
  post.setQuality(tier, settings.contactShadows && tier !== 'low', !(renderer.samples > 0) && tier !== 'low');
  hud.syncQuality(kit.settings.get().quality, tier);
}
kit.onQuality(applyQuality);
kit.settings.subscribe((s, changed) => {
  if (changed.includes('quality')) hud.syncQuality(s.quality, kit.tier.name);
});

function applySettings(patch) {
  Object.assign(settings, patch);
  if ('timeOfDay' in patch) lighting.setDayPhase(settings.timeOfDay, true);
  if ('flashlight' in patch) lighting.setFlashlight(settings.flashlight);
  if ('helicopterLight' in patch) helicopter.setEnabled(settings.helicopterLight);
  if ('contactShadows' in patch) {
    lighting.setContactShadows(settings.contactShadows);
    applyQuality();
  }
  if ('sound' in patch) audio.setMuted(!settings.sound);
  hud.syncSettings(settings, liveExposure);
  scheduleSave();
}

let saveTimer = 0;
function writeSave() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ settings, lights: house.getLightStates(), panelOpen, best, runs }));
  } catch {
    /* private mode: this session only */
  }
}
function scheduleSave(now = false) {
  clearTimeout(saveTimer);
  if (now) writeSave();
  else saveTimer = setTimeout(writeSave, 500);
}
addEventListener('pagehide', writeSave);

function lightsChanged() {
  scheduleSave();
  if (!rounds.active) return;
  const n = countLit();
  if (n > rounds.lastCount) audio.chime();
  rounds.lastCount = n;
  if (n === tracked.length) finishRounds();
}

// ---------------------------------------------------------------- game states: title, playing, paused, results

let state = 'title';
let accumulator = 0;
let hudTimer = 0;
let audioTimer = 0;
let lastPromptVersion = -1;
let lastSource = input.source;

function blurActive() {
  const a = document.activeElement;
  if (a && a !== document.body && a !== kit.canvas) a.blur?.();
}

function updateTouchSuspend() {
  // On phones the light panel is a bottom sheet over the controls.
  kit.touch?.suspend(panelOpen && innerWidth <= 760, 'panel');
}

function setPanel(open) {
  panelOpen = open;
  hud.setPanelOpen(open);
  updateTouchSuspend();
  scheduleSave();
}

function enterPlay() {
  state = 'playing';
  nav.close();
  hud.showCard(null);
  hud.setPlaying(true, true);
  kit.touch?.suspend(false, 'menu');
  audio.setDucked(false);
  if (input.source === 'keyboard') input.lockPointer();
  lastPromptVersion = -1;
  input.settle();
  blurActive();
}

function startFree() {
  audio.unlock();
  if (rounds.active) {
    rounds.active = false;
    hud.setRounds(false);
  }
  enterPlay();
}

function startRounds() {
  audio.unlock();
  // Night falls and every light in the house and yard goes out.
  applySettings({ timeOfDay: 1, autoSun: false, flashlight: true });
  for (const t of tracked) if (t.control.isEnabled()) t.control.setEnabled(false);
  resetPlayer();
  rounds.active = true;
  rounds.elapsed = 0;
  rounds.lastCount = countLit();
  hud.setRounds(true, rounds.items, 0);
  scheduleSave();
  enterPlay();
  kit.toast('Night rounds: switch all seven lights back on.');
}

function finishRounds() {
  const time = rounds.elapsed;
  rounds.active = false;
  runs += 1;
  const previous = best;
  const record = best === null || time < best;
  if (record) best = time;
  scheduleSave(true);
  state = 'results';
  hud.setRounds(false);
  hud.setPlaying(false, false);
  hud.showResults({ time, best, runs, record, previous });
  hud.showCard('results');
  hud.setTitleBest(best, runs);
  kit.touch?.suspend(true, 'menu');
  input.unlockPointer();
  audio.fanfare();
  input.rumble(0.5, 260);
  nav.open(hud.el.results, () => enterPlay());
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  const lit = countLit();
  hud.setPauseSummary(
    rounds.active
      ? `Night rounds · ${lit} of ${tracked.length} lights · ${formatTime(rounds.elapsed)}`
      : `${lit} of ${tracked.length} lights on · ${dayLabel(settings.timeOfDay).toLowerCase()}`,
    rounds.active ? 'Restart night rounds' : 'Start night rounds'
  );
  hud.setPlaying(false, false);
  hud.showCard('pause');
  kit.touch?.suspend(true, 'menu');
  input.unlockPointer();
  audio.setDucked(true);
  nav.open(hud.el.pause, () => resume());
}

function resume() {
  if (state !== 'paused') return;
  enterPlay();
}

function showTitle() {
  state = 'title';
  if (rounds.active) {
    rounds.active = false;
    hud.setRounds(false);
  }
  hud.setPlaying(false, false);
  hud.showCard('title');
  hud.setTitleBest(best, runs);
  kit.touch?.suspend(true, 'menu');
  input.unlockPointer();
  audio.setDucked(true);
  nav.open(hud.el.title, null);
}

function resetPlayer() {
  director.invalidateDynamicCaster(player.getPosition());
  interactions.reset();
  player.reset();
  director.invalidateDynamicCaster(player.getPosition());
  input.rumble(0.2, 60);
}

function openPanelNav() {
  if (!panelOpen) setPanel(true);
  nav.push(hud.el.panel, () => nav.pop());
}

// ---------------------------------------------------------------- DOM wiring

document.addEventListener('click', (e) => {
  const button = e.target.closest?.('[data-action]');
  if (!button) return;
  audio.unlock();
  switch (button.dataset.action) {
    case 'enter':
      startFree();
      break;
    case 'rounds':
      startRounds();
      break;
    case 'resume':
      resume();
      break;
    case 'panel':
      openPanelNav();
      break;
    case 'settings':
      kit.menu.open();
      break;
    case 'reset':
      resetPlayer();
      resume();
      break;
    case 'title':
      showTitle();
      break;
    default:
      break;
  }
});
addEventListener('keydown', () => audio.unlock());
addEventListener('pointerdown', () => audio.unlock());

{
  const e = hud.el;
  e.panelToggle.addEventListener('click', () => setPanel(!panelOpen));
  e.pauseButton.addEventListener('click', () => {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
  });
  e.day.addEventListener('input', () => applySettings({ timeOfDay: Number(e.day.value) }));
  e.exposure.addEventListener('input', () => applySettings({ exposure: Number(e.exposure.value) }));
  e.nightButton.addEventListener('click', () => applySettings({ timeOfDay: 1, autoSun: false }));
  e.qualitySegment.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-quality]');
    if (b) kit.settings.set({ quality: b.dataset.quality });
  });
  const toggles = [
    [e.autoExposure, 'autoExposure'],
    [e.helicopter, 'helicopterLight'],
    [e.flashlight, 'flashlight'],
    [e.autoSun, 'autoSun'],
    [e.contacts, 'contactShadows'],
    [e.sound, 'sound'],
  ];
  for (const [el, key] of toggles) el.addEventListener('change', () => applySettings({ [key]: el.checked }));
  // Hand the keyboard back to the game once a slider or switch has been used with the mouse.
  for (const el of [e.day, e.exposure, ...toggles.map(([t]) => t)]) el.addEventListener('change', () => el.blur());
  e.resetButton.addEventListener('click', () => resetPlayer());
  e.settingsButton.addEventListener('click', () => kit.menu.open());
  // A mouse click on a card item moves the gamepad highlight there too.
  document.addEventListener('pointerdown', (ev) => {
    const item = ev.target.closest?.('[data-nav]');
    if (item) nav.focus(item);
  });
}

kit.canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'mouse') return;
  if (state === 'playing' && !document.pointerLockElement) input.lockPointer();
  else if (state === 'paused' && nav.container === hud.el.pause) resume();
});

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === kit.canvas;
  // Esc releases the mouse: treat it as a pause, like any game.
  if (!locked && state === 'playing' && input.source === 'keyboard' && !kit.menu.isOpen) pause();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'playing') pause();
    audio.setPaused(true);
    writeSave();
  } else if (!kit.paused) {
    audio.setPaused(false);
  }
});

kit.onPause((paused) => {
  audio.setPaused(paused || document.hidden);
  // Back from the settings panel without the mouse captured: offer the pause card.
  if (!paused && state === 'playing' && input.source === 'keyboard' && !document.pointerLockElement) pause();
});

// ---------------------------------------------------------------- first state

lighting.setDayPhase(settings.timeOfDay, true);
lighting.setFlashlight(settings.flashlight);
lighting.setContactShadows(settings.contactShadows);
helicopter.setEnabled(settings.helicopterLight);
audio.setMuted(!settings.sound);
environment.snap(settings.timeOfDay, false);
applyQuality();
hud.setBackend(kit.backendLabel);
hud.setCameraMode(player.cameraMode);
hud.syncSettings(settings, liveExposure);
hud.setPanelOpen(panelOpen);
hud.setSource(input.source);
kit.touch?.setShown('interact', false);
kit.touch?.setShown('carry', false);
updateTouchSuspend();
showTitle();

try {
  await renderer.compileAsync(scene, player.camera);
} catch {
  /* compiling on first render instead is fine */
}

// ---------------------------------------------------------------- per frame

const previousPlayer = new THREE.Vector3();
const previousHeli = new THREE.Vector3();
const houseCtx = { player: player.getPosition(), darkness: 0, heli: helicopter.root.position };
const invalidateCaster = (position, radius) => director.invalidateDynamicCaster(position, radius);

function handleInput() {
  if (nav.active) {
    if (input.source === 'gamepad' && input.pressed('confirm')) audio.unlock();
    nav.update();
    return;
  }
  if (state !== 'playing') return;
  if (input.pressed('pause')) {
    pause();
    return;
  }
  player.setOrbiting(input.down('orbit'));
  const look = input.look('look');
  player.look(look.x, look.y);
  player.zoom(input.zoom());
  if (input.pressed('zoomIn')) player.zoomStep(1);
  if (input.pressed('zoomOut')) player.zoomStep(-1);
  if (input.pressed('view')) player.toggleView();
  if (input.pressed('jump')) player.queueJump();
  if (input.pressed('interact')) interactions.toggleLight();
  if (input.pressed('carry')) interactions.toggleCarry();
  if (input.pressed('flashlight')) interactions.toggleFlashlight();
  if (input.pressed('reset')) resetPlayer();
}

function lightPrompt(key, control) {
  const on = control.isEnabled();
  if (control.id === 'porch-floodlight') return `${key} · ${on ? 'disarm' : 'arm'} the porch floodlight`;
  return `${key} · turn ${niceLabel(control.label)} ${on ? 'off' : 'on'}`;
}

function updatePrompt() {
  const d = interactions.describe();
  const keys = KEYS[input.source] || KEYS.keyboard;
  const touch = input.source === 'touch';
  let text = '';
  if (d.light) text = lightPrompt(keys.light, d.light);
  const carry = d.held
    ? `${touch ? 'Drop' : keys.carry} · put down the ${niceLabel(d.held.label)}`
    : d.carry
      ? `${keys.carry} · pick up the ${niceLabel(d.carry.label)}`
      : '';
  if (carry) text = text ? `${text}   ${carry}` : carry;
  hud.setPrompt(text || null);
  kit.touch?.setShown('interact', !!d.light);
  kit.touch?.setShown('carry', !!(d.carry || d.held));
  kit.touch?.setLabel('carry', d.held ? 'Drop' : 'Carry');
}

function updateHud(dt) {
  if (input.source !== lastSource) {
    lastSource = input.source;
    hud.setSource(lastSource);
    lastPromptVersion = -1;
  }
  if (state === 'playing' && interactions.hudVersion !== lastPromptVersion) {
    lastPromptVersion = interactions.hudVersion;
    updatePrompt();
  }
  hudTimer -= dt;
  if (hudTimer > 0) return;
  hudTimer = 0.1;
  hud.setExposure(settings.exposure, liveExposure);
  if (rounds.active) hud.setRounds(true, rounds.items, rounds.elapsed);
}

function updateAudio(dt) {
  audioTimer -= dt;
  if (audioTimer > 0 || !audio.ready) return;
  audioTimer = 1 / 15;
  const indoors = currentRoom !== null;
  const darkness = 1 - lighting.daylight;
  audio.setVoice('wind', indoors ? 0.012 : 0.035 + 0.05 * darkness);
  audio.setVoice('room', indoors ? 0.05 : 0);
  let spot = audio.place(listener, -20.73, 1.75, -8.55, 3, currentRoom === 'living-room');
  audio.setVoice('tv', house.fixtures.get('tv-static-light').enabled ? 0.08 * spot.gain : 0, spot.pan);
  spot = audio.place(listener, -6.33, 1.3, -10.45, 2.5, currentRoom === 'kitchen');
  audio.setVoice('fridge', (house.fixtures.get('fridge-light').enabled ? 0.1 : 0.04) * spot.gain, spot.pan);
  spot = audio.place(listener, -13, 3.52, -12, 3, currentRoom === 'hallway');
  audio.setVoice('buzz', 0.03 * (house.hallLevel || 0) * spot.gain, spot.pan);
  const h = helicopter.root.position;
  spot = audio.place(listener, h.x, h.y, h.z, 16, !indoors);
  audio.setVoice('heli', 0.35 * spot.gain, spot.pan);
}

function updateListener() {
  const e = player.camera.matrixWorld.elements;
  listener.x = e[12];
  listener.y = e[13];
  listener.z = e[14];
  const len = Math.hypot(e[0], e[2]) || 1;
  listener.rightX = e[0] / len;
  listener.rightZ = e[2] / len;
}

kit.start((dt) => {
  const cpuStart = performance.now();
  handleInput();
  const playing = state === 'playing';

  previousPlayer.copy(player.getPosition());
  let moved = false;
  if (playing) {
    accumulator = Math.min(accumulator + dt, FIXED_STEP * MAX_STEPS);
    const mv = input.vector('move');
    const run = input.down('run');
    while (accumulator >= FIXED_STEP) {
      moved = player.fixedUpdate(FIXED_STEP, mv.x, mv.y, run) || moved;
      interactions.fixedUpdate(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    if (rounds.active) rounds.elapsed += dt;
  } else {
    accumulator = 0;
  }

  const cameraMoved = player.updateCamera(dt);
  updateListener();
  lighting.update(player);
  houseCtx.darkness = 1 - lighting.daylight;
  house.update(dt, houseCtx);
  previousHeli.copy(helicopter.root.position);
  const heliMoved = helicopter.update(dt);
  interactions.updateTarget(dt, playing);
  if (moved) {
    director.invalidateDynamicCaster(previousPlayer);
    director.invalidateDynamicCaster(player.getPosition());
  }
  interactions.consumeCasterChanges(invalidateCaster);
  if (heliMoved) {
    director.invalidateDynamicCaster(previousHeli, 2);
    director.invalidateDynamicCaster(helicopter.root.position, 2);
  }
  if (cameraMoved) director.invalidateCamera();

  const nextTime = dayCycle.update(dt, settings.timeOfDay, settings.autoSun);
  if (nextTime !== null) {
    settings.timeOfDay = nextTime;
    lighting.setDayPhase(nextTime, true);
    hud.syncSettings(settings, liveExposure);
  }
  lighting.updatePlayerContact(player.getPosition(), player.getFloorY(), player.getAirHeight());

  const position = player.getPosition();
  currentRoom = house.getRoomAt(position);
  director.beginFrame(dt, position, currentRoom ?? 'exterior');
  environment.update(dt, settings.timeOfDay, currentRoom !== null);
  liveExposure = autoExposure.update(dt, settings.timeOfDay, currentRoom !== null, director.getLocalLightMeter(position), settings.exposure, settings.autoExposure);
  renderer.toneMappingExposure = liveExposure;

  director.beforeRender();
  post.render();
  director.afterRender();

  updateHud(dt);
  updateAudio(dt);
  if (stats.push(dt, performance.now() - cpuStart)) {
    const info = renderer.info.render;
    hud.setPerf({
      fps: stats.fps,
      frameP95: stats.frameP95,
      cpuP95: stats.cpuP95,
      lights: `${countLit()} / ${tracked.length}`,
      quality: `${kit.tier.name} · ${renderer.getPixelRatio().toFixed(2)}×`,
      calls: info.drawCalls,
      triangles: info.triangles,
      sunUpdates: director.sunShadowUpdates,
      localUpdates: director.localShadowUpdates,
    });
  }
});
