/**
 * main.js — Neon Gauntlet on the shared 3D stack.
 *
 * Builds the broadcast shell, boots the kit (WebGPU with the WebGL2
 * fallback, quality tiers, settings, input and touch controls), starts the
 * arena engine, and wires it to Iona (the host) and the DOM overlay. Menus
 * are driven by the same kit.input actions as the game, so they work with a
 * keyboard, a controller and touch.
 */

import { boot } from 'kit/boot.js';
import { NeonEngine, safeStorage } from './engine.js';
import { IonaHost } from './host.js';
import { Sfx } from './audio.js';
import { GameUI } from './ui.js';
import { CONTRACTS } from './data.js';

const storage = safeStorage();
const BROADCAST_KEY = 'neon-gauntlet-broadcast';
const OPTIONS_KEY = 'neon-gauntlet-options';
const HOST_DEFAULTS = { voice: true, captions: true, portrait: true, frequency: 'standard', volume: 0.78 };
const CONTRACT_ORDER = ['rookie', 'standard', 'prime'];

/** Every control goes through these actions (the kit's standard bindings). */
const ACTIONS = {
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  aim: { type: 'vector', gamepad: 'rightStick', touch: 'stick-right' },
  fire: { keys: ['KeyJ'], mouse: [0], gamepad: ['RT', 'X'] },
  dash: { keys: ['Space'], gamepad: ['A', 'LB', 'RB'], touch: 'Dash' },
  bomb: { keys: ['KeyE', 'KeyQ', 'KeyK'], mouse: [2], gamepad: ['B', 'LT', 'Y'], touch: 'Wipe' },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Escape', 'Backspace'], gamepad: ['B'] },
  pick1: { keys: ['Digit1', 'Numpad1'] },
  pick2: { keys: ['Digit2', 'Numpad2'] },
  pick3: { keys: ['Digit3', 'Numpad3'] },
  debugSkip: { keys: ['F8'] },
};

function loadBroadcast() {
  try {
    const raw = JSON.parse(storage.getItem(BROADCAST_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...HOST_DEFAULTS };
    return {
      voice: typeof raw.voice === 'boolean' ? raw.voice : HOST_DEFAULTS.voice,
      captions: typeof raw.captions === 'boolean' ? raw.captions : HOST_DEFAULTS.captions,
      portrait: typeof raw.portrait === 'boolean' ? raw.portrait : HOST_DEFAULTS.portrait,
      frequency: ['minimal', 'standard', 'full'].includes(raw.frequency) ? raw.frequency : HOST_DEFAULTS.frequency,
      volume: Math.max(0, Math.min(1, Number(raw.volume ?? HOST_DEFAULTS.volume) || 0)),
    };
  } catch {
    storage.removeItem(BROADCAST_KEY);
    return { ...HOST_DEFAULTS };
  }
}

function loadOptions() {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallback = { sfx: true, reducedMotion: reduced, contract: 'standard' };
  try {
    const raw = JSON.parse(storage.getItem(OPTIONS_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fallback;
    return {
      sfx: typeof raw.sfx === 'boolean' ? raw.sfx : true,
      reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : reduced,
      contract: CONTRACTS[raw.contract] ? raw.contract : 'standard',
    };
  } catch {
    return fallback;
  }
}

const save = (key, value) => storage.setItem(key, JSON.stringify(value));

const sfx = new Sfx();
const options = loadOptions();
let hostSettings = loadBroadcast();
let selected = 1;
let engine = null;
let host = null;
let kit = null;

const handlers = {
  start() {
    if (!engine || engine.phase !== 'menu') return;
    ui.state.result = null;
    ui.state.upgrades = [];
    ui.state.choices = [];
    if (selected === 'overtime') engine.startOvertime();
    else engine.start(selected);
  },
  select(level) {
    selected = level;
    ui.setSelected(level);
    if (level !== 'overtime') engine?.previewLevel(level);
  },
  pause() {
    engine?.pause();
  },
  resume() {
    engine?.resume();
  },
  restart() {
    if (ui.state.archiveOpen) handlers.closeArchive();
    ui.state.result = null;
    engine?.restart();
  },
  menu() {
    if (ui.state.archiveOpen) handlers.closeArchive();
    engine?.returnToMenu();
  },
  openSettings() {
    kit?.menu.open();
  },
  toggleSfx() {
    options.sfx = !options.sfx;
    sfx.setEnabled(options.sfx);
    save(OPTIONS_KEY, options);
    ui.setOptions({ sfx: options.sfx });
  },
  toggleMotion() {
    options.reducedMotion = !options.reducedMotion;
    engine?.setReducedMotion(options.reducedMotion);
    save(OPTIONS_KEY, options);
    ui.setOptions({ reducedMotion: options.reducedMotion });
  },
  cycleContract() {
    options.contract = CONTRACT_ORDER[(CONTRACT_ORDER.indexOf(options.contract) + 1) % CONTRACT_ORDER.length];
    engine?.setContract(options.contract);
    save(OPTIONS_KEY, options);
    ui.setOptions({ contract: options.contract });
  },
  hearIona() {
    sfx.unlock();
    if (!hostSettings.voice) handlers.hostSetting({ voice: true });
    host?.preview();
  },
  hostSetting(patch, quiet = false) {
    hostSettings = { ...hostSettings, ...patch };
    host?.setSettings(hostSettings);
    save(BROADCAST_KEY, hostSettings);
    if (quiet) ui.setVolumeReadout(hostSettings.volume);
    else ui.setHostSettings(hostSettings);
  },
  openArchive() {
    ui.openArchive();
    updateTouch();
  },
  closeArchive() {
    ui.closeArchive();
    kit?.input.settle();
    updateTouch();
  },
  replayLast() {
    host?.replayLast();
  },
  resetMemory() {
    host?.resetMemory();
  },
  selectUpgrade(id) {
    engine?.selectUpgrade(id);
  },
  assistRoute(id) {
    engine?.assistRoute(id);
  },
};

const ui = new GameUI(document.getElementById('root'), handlers);
ui.setOptions(options);
ui.setHostSettings(hostSettings);

/** Touch controls only during combat and route walking; the aim stick and buttons only in combat. */
function updateTouch() {
  const touch = kit?.touch;
  if (!touch || !engine) return;
  const phase = engine.phase;
  const inGame = (phase === 'playing' || phase === 'route') && !ui.state.archiveOpen;
  touch.suspend(!inGame, 'ui');
  if (inGame) {
    const combat = phase === 'playing';
    touch.setShown('aim', combat);
    touch.setShown('dash', combat);
    touch.setShown('bomb', combat);
  }
}

kit = await boot({
  title: 'Neon Gauntlet',
  canvas: ui.canvas,
  mount: ui.stage,
  gear: 'none',
  holdLoading: true,
  accent: '#23e6ff',
  background: '#03070d',
  input: ACTIONS,
});
ui.canvas = kit.canvas;
kit.loading.progress(0.7, 'Warming the arena…');

sfx.setEnabled(options.sfx);
ui.setBackend(kit.backend);
ui.setTier(kit.tier.name);
ui.setSource(kit.input.source);
kit.onQuality((tier) => ui.setTier(tier.name));
kit.input.onSourceChange((source) => ui.setSource(source));
kit.onPause((paused) => sfx.setSuspended(paused || document.hidden));

host = new IonaHost((snapshot) => ui.setSnapshot(snapshot), hostSettings, (speaking) => engine?.setBroadcastDucking(speaking));

engine = new NeonEngine(kit, sfx, {
  onPhase(phase) {
    ui.setPhase(phase);
    updateTouch();
    // Back in the ready room: the arena wears the selected level's colours.
    if (phase === 'menu' && selected !== 'overtime') engine?.previewLevel(selected);
  },
  onHud: (hud) => ui.setHud(hud),
  onImpact: (impact) => ui.impact(impact),
  onBroadcast: (event) => host.handle(event),
  onUpgrade: (list) => ui.setUpgrades(list),
  onRoomChoices: (list) => ui.setChoices(list),
  onResult: (result) => ui.setResult(result),
  onCampaignProgress(progress) {
    if (!(selected === 'overtime' && (engine?.overtime || engine?.phase === 'menu' || !engine))) selected = progress.lastSelectedLevel;
    ui.setProgress(progress);
    ui.setSelected(selected);
  },
  onTheme: (def) => ui.setTheme(def),
});
engine.setContract(options.contract);
engine.setReducedMotion(options.reducedMotion);

try {
  await engine.init();
} finally {
  kit.loading.done();
}

// Pause the show when the tab is hidden or the window loses focus (the original's behaviour).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) engine.pause();
  sfx.setSuspended(document.hidden || kit.paused);
});
addEventListener('blur', () => engine.pause());

let navHeld = 0;
let navTimer = 0;
let fpsTimer = 0;
let lastPhase = null;
let phaseTime = 0;

/** Pause toggles and menu navigation, from the same actions as the game. */
function handleUiInput(dt) {
  const input = kit.input;
  const phase = engine.phase;
  const archive = ui.state.archiveOpen;
  if (phase !== lastPhase) {
    lastPhase = phase;
    phaseTime = 0;
  }
  phaseTime += dt;
  if (!archive) {
    if ((phase === 'playing' || phase === 'route') && input.pressed('pause')) {
      engine.pause();
      return;
    }
    if (phase === 'paused' && input.pressed('pause')) {
      engine.resume();
      return;
    }
  }
  const root = ui.navRoot();
  if (!root) {
    navHeld = 0;
    return;
  }
  const v = input.vector('move');
  let dx = 0;
  let dy = 0;
  if (Math.abs(v.x) > 0.5 && Math.abs(v.x) >= Math.abs(v.y)) dx = Math.sign(v.x);
  else if (Math.abs(v.y) > 0.5) dy = -Math.sign(v.y);
  const key = dx * 3 + dy;
  if (key === 0) navHeld = 0;
  else if (key !== navHeld) {
    navHeld = key;
    navTimer = 0.38;
    ui.navigate(dx, dy);
  } else {
    navTimer -= dt;
    if (navTimer <= 0) {
      navTimer = 0.12;
      ui.navigate(dx, dy);
    }
  }
  // A beat before the results card takes input, so a Dash (A) pressed at the moment of defeat does not skip it.
  const settled = archive || phase !== 'gameover' || phaseTime > 0.9;
  if (settled && input.pressed('confirm')) ui.confirm();
  else if (settled && input.pressed('back')) ui.back();
  if (phase === 'upgrade' && !archive)
    for (let k = 1; k <= 3; k += 1) if (input.pressed(`pick${k}`)) ui.pickUpgrade(k - 1);
}

kit.start((dt, t) => {
  handleUiInput(dt);
  engine.frame(dt, t);
  fpsTimer -= dt;
  if (fpsTimer <= 0) {
    fpsTimer = 0.5;
    ui.setFps(window.__kit?.fps ?? 0);
  }
});
