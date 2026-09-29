import { boot } from 'kit/boot.js';
import { fixedStep } from 'kit/physics.js';
import { DIFFICULTY } from './content.js';
import { Model, newState, validateState, SAVE_KEY, SETTINGS_KEY, route, clamp, readRecords } from './core.js';
import { Simulation } from './sim.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { View } from './view.js';
import { Physics } from './physics.js';
import { focusables, focusEl, neighbour, adjust, activate, createRepeater } from './nav.js';

/**
 * Every control is a kit.input action: keyboard and mouse, controller and
 * touch. The keyboard keeps the game's Endless Sky-style keys; the controller
 * steers with the left stick like the touch stick does.
 * The first touch button listed (Fire) is the big one.
 */
const INPUT = {
  fire: { keys: ['Space'], mouse: [0], gamepad: ['RT', 'X'], touch: 'Fire' },
  brake: { keys: ['KeyS', 'ArrowDown', 'KeyK'], gamepad: ['LT', 'B'], touch: 'Brake' },
  scan: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Scan' },
  missile: { keys: ['KeyF'], gamepad: ['RB'], touch: 'Missile' },
  boost: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['A', 'LS'], touch: 'Boost' },
  steer: { type: 'vector', gamepad: 'leftStick', touch: 'stick' },
  face: { type: 'vector', gamepad: 'rightStick' },
  thrust: { keys: ['KeyW', 'ArrowUp'] },
  turn: { type: 'axis', keys: { pos: ['KeyD', 'ArrowRight'], neg: ['KeyA', 'ArrowLeft'] } },
  mouseAim: { mouse: [0, 2] },
  target: { keys: ['KeyT'], gamepad: ['LB'] },
  land: { keys: ['KeyL'], gamepad: ['Down'] },
  jump: { keys: ['KeyJ'], gamepad: ['Up'] },
  board: { keys: ['KeyB'], gamepad: ['Left'] },
  hail: { keys: ['KeyH'], gamepad: ['Right'] },
  map: { keys: ['KeyM'], gamepad: ['Back'] },
  missions: { keys: ['KeyN'] },
  fleet: { keys: ['KeyG'] },
  log: { keys: ['KeyI'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'] },
  zoomCycle: { gamepad: ['RS'] },
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'] },
  // Menus (D-pad / left stick / arrows move focus, A or Enter chooses, B or Backspace goes back).
  nav: { type: 'vector', keys: 'arrows', gamepad: 'leftStick+dpad' },
  confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  tabPrev: { gamepad: ['LB'] },
  tabNext: { gamepad: ['RB'] },
};
const PORT_TABS = ['spaceport', 'trading', 'outfitter', 'shipyard', 'jobs', 'bank'];
const GUARDED = ['fire', 'brake', 'scan', 'missile', 'boost', 'thrust'];

const defaults = {
  volume: 0.6,
  music: 0.35,
  muted: false,
  flightAssist: true,
  aimAssist: true,
  reducedMotion: false,
  diagnostics: true,
  difficulty: 'standard',
};
let storage = null;
try {
  storage = localStorage;
} catch {}
let settings = { ...defaults };
try {
  const x = JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null');
  if (x) settings = { ...defaults, ...x };
} catch {}
// Older saves carried the game's own quality presets and touch toggle; the kit owns those now.
delete settings.quality;
delete settings.touchControls;
if (!(settings.difficulty in DIFFICULTY)) settings.difficulty = 'standard';
settings.volume = clamp(Number(settings.volume) || 0, 0, 1);
settings.music = clamp(Number(settings.music) || 0, 0, 1);

let kit = null,
  view = null,
  physics = null,
  sim = null,
  playing = false,
  hudTimer = 0,
  radarTimer = 0,
  saveTimer = 0,
  diagTimer = 0,
  holdGuard = false,
  navHold = false,
  tabBound = null,
  touchSuspended = null,
  simFailed = false,
  pendingConfirm = null;
const shown = {};
const repeat = createRepeater();
const step = fixedStep(60, 5);
const audio = new AudioEngine(settings);
let ui = null;
const model = new Model(newState(), (text, type) => {
  ui?.toast(text, type);
  if (type === 'reward') audio.play('reward');
});
model.storage = storage;
ui = new UI(document.querySelector('#app'), model, { action, option, panel: panelChanged, playing: () => playing });
ui.settings = settings;
ui.records = readRecords(storage);
try {
  ui.hasSave = !!storage?.getItem(SAVE_KEY);
} catch {}
ui.render();
applySettings();

// Audio starts on the first click, tap or key press anywhere (a controller-only player gets it from the first menu choice).
const unlockAudio = () => audio.unlock().catch(() => {});
addEventListener('pointerdown', unlockAudio, true);
addEventListener('keydown', unlockAudio, true);

const bodyLimit = (tier) => (tier.name === 'low' || tier.name === 'medium' ? 64 : 96);

const hooks = {
  system: (sy) => view.buildSystem(sy),
  refresh: () => ui.refreshHUD(),
  route: (id) => route(model.s.system, id, model.s),
  sound: (id) => audio.play(id, id === 'laser' ? { vary: 0.05 } : undefined),
  hit: (amount, hull) => {
    ui.flash();
    if (!settings.reducedMotion) view.kick(Math.min(0.8, amount / 45));
    kit.input.rumble(hull ? 0.7 : 0.3, hull ? 160 : 80);
    if (hull && model.s.hull < model.st.hull * 0.3) audio.alert();
  },
  rumble: (strength, ms) => kit.input.rumble(strength, ms),
  boss: () => {
    audio.play('jump');
    audio.alert(660, 440, 0.16);
    kit.input.rumble(0.8, 400);
    ui.flash('jump');
    if (!settings.reducedMotion) view.kick(0.6);
  },
  destroyed: () => {
    kit.input.rumble(1, 600);
    ui.show('rescue');
  },
  land: (debrief) => {
    audio.play('dock');
    ui.hasSave = true;
    if (debrief) ui.show('debrief', debrief);
    else {
      ui.portTab = 'spaceport';
      ui.show('port');
    }
  },
  launch: () => ui.close(),
  jump: () => {
    ui.flash('jump');
    audio.play('jump');
    view.snap = true;
    kit.input.rumble(0.45, 260);
  },
  board: (e) => ui.show('board', e),
  map: () => action('map'),
  port: (tab) => {
    ui.portTab = tab;
    ui.show('port');
  },
};

/** The kit boots the renderer (WebGPU, WebGL2 fallback), Rapier 0.20 and input; the game builds its world on top. */
async function initialize() {
  ui.engine('Starting the flight engine…');
  try {
    kit = await boot({
      title: 'Starlight Drifter',
      canvas: ui.canvas,
      physics: true,
      input: INPUT,
      gear: 'none', // the game's own ⚙ Options and pause menu open the kit panel (also F9)
      accent: '#8ad6bf',
      background: '#070f19',
    });
  } catch (error) {
    console.error('Starlight engine initialization failed:', error);
    ui.engine('The 3D engine could not start. Use a WebGPU- or WebGL2-capable browser with hardware acceleration. ' + (error?.message || ''), true);
    return;
  }
  try {
    ui.canvas = kit.canvas;
    kit.loading.progress(0.7, 'Charting the sector…');
    view = new View(kit);
    await view.init();
    physics = new Physics(kit.RAPIER);
    physics.setLimit(bodyLimit(kit.tier));
    sim = new Simulation(model, physics, hooks);
    sim.settings = settings;
    sim.loadSystem();
    sim.paused = true;
    view.title = true;
    kit.loading.progress(0.85, 'Warming the engines…');
    await view.warm();
    kit.onQuality((tier) => {
      physics.setLimit(bodyLimit(tier));
      for (const actor of sim.entities.values()) {
        if (physics.bodies.size <= physics.limit) break;
        if (actor.type === 'debris') sim.remove(actor.id);
      }
      ui.quality = tier.name;
    });
    kit.onPause((paused) => audio.hold('menu', paused));
    kit.input.onSourceChange((source) => ui.setPrompts(source));
    ui.setPrompts(kit.input.source);
    ui.backend = kit.backendLabel;
    ui.quality = kit.tier.name;
    ui.ready = true;
    ui.engine(`Flight systems ready · ${kit.backendLabel}. Your progress stays on this device.`);
    // A diagnostic read-only surface supports smoke checks without shipping any progression cheats.
    window.__STARLIGHT__ = {
      get status() {
        return {
          ready: ui.ready,
          backend: kit.backend,
          tier: kit.tier.name,
          system: model.s.system,
          chapter: model.s.story,
          playing,
          paused: sim.paused,
          panel: ui.panel,
          bodies: physics.bodies.size,
          frames: window.__kit?.frames ?? 0,
          audioFailures: [...audio.failures],
        };
      },
    };
    window.dispatchEvent(new CustomEvent('starlight-ready'));
    kit.start(frame);
  } catch (error) {
    console.error('Starlight world setup failed:', error);
    kit.loading.done();
    ui.engine('The flight engine stopped while building the world: ' + (error?.message || error), true);
  }
}

function panelChanged(panel) {
  if (sim) sim.paused = !!panel || !playing || model.s.docked;
  if (view) view.title = !playing;
  step.reset();
  // A button held to open or close a menu must not also act in the next screen.
  navHold = true;
  kit?.input.settle();
  if (!panel) holdGuard = true;
}
function closePanel() {
  if (ui.panel === 'confirm') {
    answer(false);
    return;
  }
  if (!playing) {
    ui.show('title');
    return;
  }
  if (['debrief', 'results'].includes(ui.panel)) {
    ui.portTab = 'spaceport';
    ui.show('port');
    return;
  }
  if (ui.panel === 'rescue') return;
  if (sim?.destroyed || model.s.hull <= 0) {
    ui.show('rescue');
    return;
  }
  if (model.s.docked) {
    ui.show('port');
    return;
  }
  ui.close();
}
function refreshPanel() {
  ui.render();
  ui.refreshHUD();
}
/** An in-game confirmation (works with a controller, unlike window.confirm). */
function ask(options, onYes) {
  pendingConfirm = { onYes, panel: ui.panel, data: ui.data };
  ui.show('confirm', options);
}
function answer(yes) {
  const c = pendingConfirm;
  pendingConfirm = null;
  if (!c) {
    ui.show(!playing ? 'title' : model.s.docked ? 'port' : null);
    return;
  }
  ui.show(c.panel, c.data);
  if (yes) c.onYes();
}
function checked(result) {
  if (result) {
    ui.toast(result, 'warn');
    audio.play('ui');
    return false;
  }
  audio.play('pickup');
  refreshPanel();
  return true;
}
function acceptModelState(state) {
  simFailed = false;
  model.s = state;
  ui.setModel(model);
  playing = true;
  view.title = false;
  sim.settings = settings;
  sim.route = [];
  sim.loadSystem({ restore: true });
  sim.paused = state.docked;
  if (state.hull <= 0) {
    ui.show('rescue');
  } else if (state.docked) {
    ui.portTab = 'spaceport';
    ui.show('port');
  } else ui.close();
  ui.hasSave = true;
  model.save();
}
function startCaptain() {
  const captain = document.querySelector('#captain-name')?.value || ui.captainName || 'Captain';
  acceptModelState(newState(ui.shipSelection, captain));
  model.tell('Welcome aboard. Visit the spaceport contact to begin your first contract.');
}
function action(name, id) {
  audio.unlock().catch(() => {});
  if (name !== 'selectShip') audio.play('ui');
  const s = model.s;
  switch (name) {
    case 'retry':
      location.reload();
      break;
    case 'new':
      if (ui.ready) ui.show('new');
      break;
    case 'selectShip':
      ui.captainName = document.querySelector('#captain-name')?.value || ui.captainName;
      ui.shipSelection = id;
      ui.render();
      break;
    case 'start': {
      if (!ui.ready) return;
      ui.captainName = document.querySelector('#captain-name')?.value || ui.captainName;
      if (ui.hasSave)
        ask(
          {
            title: 'Replace your captain?',
            eyebrow: 'NEW CAPTAIN',
            text: 'Starting a new captain replaces the save on this device. Export the current log from Options first if you want to keep a backup.',
            yes: 'Start fresh',
            no: 'Keep my captain',
            danger: true,
          },
          startCaptain,
        );
      else startCaptain();
      break;
    }
    case 'continue':
      try {
        const raw = storage?.getItem(SAVE_KEY);
        if (!raw) throw new Error('No local save was found.');
        acceptModelState(validateState(JSON.parse(raw)));
      } catch (err) {
        ui.toast(err.message, 'warn');
      }
      break;
    case 'close':
      closePanel();
      break;
    case 'confirmYes':
      answer(true);
      break;
    case 'confirmNo':
      answer(false);
      break;
    case 'title':
      if (playing) {
        model.save();
        playing = false;
      }
      try {
        ui.hasSave = !!storage?.getItem(SAVE_KEY);
      } catch {}
      ui.records = readRecords(storage);
      if (sim) {
        sim.paused = true;
        sim.loadSystem({ restore: true });
      }
      if (view) view.title = true;
      ui.show('title');
      break;
    case 'kitSettings':
      kit?.menu.open();
      break;
    case 'options':
    case 'controls':
    case 'about':
      ui.show(name);
      break;
    case 'pause':
      if (playing) ui.show('pause');
      break;
    case 'map':
      if (!playing) return;
      ui.mapSelection = sim.route.at(-1) || (model.quest ? (s.activeStory ? model.quest.to : model.quest.from) : s.system);
      ui.show('map');
      break;
    case 'missions':
    case 'fleet':
    case 'log':
      if (playing) ui.show(name);
      break;
    case 'port':
      if (playing && s.docked) {
        ui.portTab = 'spaceport';
        ui.show('port');
      } else closePanel();
      break;
    case 'portTab':
      if (s.docked && playing && PORT_TABS.includes(id)) {
        ui.portTab = id;
        ui.show('port');
      }
      break;
    case 'launch':
      if (playing && s.docked) {
        sim.launch();
        view.title = false;
      }
      break;
    case 'land':
      if (!playing) return;
      if (s.docked) {
        ui.show('port');
        break;
      }
      sim.land();
      break;
    case 'jump':
      if (playing && !s.docked) sim.startJump();
      break;
    case 'board':
      if (playing && !s.docked) sim.board();
      break;
    case 'hail':
      if (playing) sim.hail();
      break;
    case 'target':
      if (playing && !s.docked) sim.cycleTarget();
      break;
    case 'scanHelp':
      if (playing)
        ui.toast(
          kit?.input.source === 'touch'
            ? 'Fly to the SURVEY / SCAN beacon and hold the SCAN button when it appears. The final relay is scanned at the port.'
            : `Fly to the SURVEY / SCAN beacon and hold ${kit?.input.source === 'gamepad' ? 'Y' : 'E'}. The final relay is scanned at the port.`,
        );
      break;
    case 'mapSelect':
      ui.mapSelection = id;
      ui.render();
      break;
    case 'plot':
    case 'routeJob': {
      const r = route(s.system, id, s);
      if (r === null) {
        ui.toast('Install a Jump Drive to travel beyond human space.', 'warn');
        return;
      }
      sim.setRoute(id);
      ui.mapSelection = id;
      const jumpKey = kit?.input.source === 'gamepad' ? 'D-pad ↑' : kit?.input.source === 'touch' ? 'Jump' : 'J';
      if (s.docked) {
        ui.show('port');
        ui.toast(`Course plotted. Depart and press ${jumpKey}${r.length > 1 ? ' once per jump' : ''}.`);
      } else {
        ui.close();
        ui.toast(r.length ? `Course plotted. Press ${jumpKey} to charge your hyperdrive.` : 'You are already in this system.');
      }
      break;
    }
    case 'objective': {
      if (!playing) return;
      const q = model.quest;
      if (!q) {
        action('map');
        break;
      }
      const goal = s.convoyLost && q.kind === 'escort' ? 'dschubba' : s.activeStory ? q.to : q.from;
      if (goal === s.system) {
        if (s.docked) {
          ui.portTab = 'spaceport';
          ui.show('port');
        } else {
          ui.close();
          ui.toast(ui.objectiveText());
        }
      } else {
        ui.mapSelection = goal;
        ui.show('map');
      }
      break;
    }
    case 'acceptStory':
      if (checked(model.acceptStory(id))) ui.toast('Contract aboard. Depart, plot your route, then jump.');
      break;
    case 'acceptSide':
      if (checked(model.acceptSide(id))) ui.toast('Expedition accepted. Track it in Missions.');
      break;
    case 'acceptJob':
      checked(model.acceptJob(id));
      break;
    case 'abandonJob':
      ask(
        { title: 'Cancel this contract?', eyebrow: 'CONTRACTS', text: 'Its cargo or berths are released. There is no cancellation fee.', yes: 'Cancel contract', no: 'Keep it', danger: true },
        () => {
          model.abandonJob(id);
          refreshPanel();
        },
      );
      break;
    case 'buy':
      checked(model.trade(id, 1));
      break;
    case 'buy5':
      checked(model.trade(id, 5));
      break;
    case 'sell':
      checked(model.trade(id, -1));
      break;
    case 'sell5':
      checked(model.trade(id, -Math.min(5, s.cargo[id] || 0)));
      break;
    case 'buyOutfit':
      checked(model.buyOutfit(id));
      break;
    case 'removeOutfit':
      checked(model.sellOutfit(id));
      break;
    case 'buyShip':
      if (checked(model.buyShip(id))) {
        sim.loadSystem();
        sim.paused = true;
      }
      break;
    case 'buyEscort':
      if (checked(model.buyShip(id, true))) {
        sim.loadSystem();
        sim.paused = true;
      }
      break;
    case 'ammo':
      checked(model.buyAmmo());
      break;
    case 'hire':
      checked(model.hire());
      break;
    case 'pay1000':
      checked(model.payDebt(1000));
      break;
    case 'payAll':
      checked(model.payDebt(s.debt));
      break;
    case 'borrow':
      checked(model.borrow());
      break;
    case 'fleetOrder':
      if (['defend', 'attack', 'hold'].includes(id)) {
        s.fleetOrder = id;
        model.save();
        refreshPanel();
      }
      break;
    case 'salvage':
    case 'capture': {
      const error = sim.resolveBoard(name);
      if (error) ui.toast(error, 'warn');
      else {
        audio.play('reward');
        ui.close();
      }
      break;
    }
    case 'rescue':
      model.rescue();
      sim.loadSystem();
      ui.portTab = 'outfitter';
      ui.show('port');
      break;
    case 'results':
      ui.records = readRecords(storage);
      if (s.ended) ui.show('results');
      break;
    case 'fullscreen':
      toggleFullscreen();
      break;
    case 'exportSave':
      exportSave();
      break;
    case 'importSave':
      document.querySelector('#save-file').click();
      break;
  }
}
function option(key, value) {
  if (!(key in defaults)) return;
  const d = defaults[key];
  settings[key] =
    typeof d === 'boolean'
      ? !!value
      : typeof d === 'number'
        ? clamp(Number(value), 0, 1)
        : key === 'difficulty'
          ? value in DIFFICULTY
            ? value
            : 'standard'
          : value;
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
  applySettings();
}
function applySettings() {
  ui.settings = settings;
  audio.apply(settings);
  if (sim) sim.settings = settings;
  document.body.classList.toggle('reduced-motion', settings.reducedMotion);
  document.querySelector('#diagnostics').hidden = !settings.diagnostics;
}

/** Hold-to-act buttons that opened or closed a menu are ignored in flight until they are let go. */
const flightInput = { thrust: false, brake: false, turn: 0, fire: false, missile: false, scan: false, boost: false, aim: null, stick: null, face: null, assistAim: false };
const stickVec = { x: 0, z: 0 },
  faceVec = { x: 0, z: 0 };
function readFlightInput() {
  const i = kit.input,
    f = flightInput;
  if (holdGuard && !GUARDED.some((n) => i.down(n))) holdGuard = false;
  const live = !holdGuard;
  f.thrust = live && i.down('thrust');
  f.brake = live && i.down('brake');
  f.turn = i.value('turn');
  f.fire = live && i.down('fire');
  f.missile = live && i.down('missile');
  f.scan = live && i.down('scan');
  f.boost = live && i.down('boost');
  const st = i.vector('steer');
  if (Math.hypot(st.x, st.y) > 0.12) {
    stickVec.x = st.x;
    stickVec.z = -st.y;
    f.stick = stickVec;
  } else f.stick = null;
  const fc = i.vector('face');
  if (Math.hypot(fc.x, fc.y) > 0.35) {
    faceVec.x = fc.x;
    faceVec.z = -fc.y;
    f.face = faceVec;
  } else f.face = null;
  f.aim = i.down('mouseAim') ? view.unproject(i.pointer.x, i.pointer.y) : null;
  // Touch and controller firing turns toward the selected or nearest hostile (with aim assistance on).
  f.assistAim = f.fire && i.source !== 'keyboard';
  return f;
}
function flightCommands() {
  const i = kit.input;
  if (i.pressed('pause')) {
    action('pause');
    return;
  }
  for (const c of ['map', 'missions', 'fleet', 'log', 'land', 'jump', 'board', 'hail', 'target']) {
    if (!i.pressed(c)) continue;
    action(c);
    if (ui.panel) return;
  }
  const z = i.zoom();
  if (z) view.setZoom(clamp(-z * 0.06, -0.15, 0.15));
  if (i.pressed('zoomIn')) view.setZoom(-0.08);
  if (i.pressed('zoomOut')) view.setZoom(0.08);
  if (i.pressed('zoomCycle')) view.cycleZoom();
}
function setPadNav(on) {
  document.body.classList.toggle('pad-nav', on);
}
document.addEventListener('pointerdown', () => setPadNav(false), true);
function defaultFocus(scope) {
  if (ui.panel === 'title') return scope.querySelector('.title-content button.primary:not([disabled])') || focusables(scope)[0];
  return (
    scope.querySelector('.panel-content button.primary:not([disabled])') ||
    scope.querySelector('.panel-foot button.primary:not([disabled])') ||
    focusables(scope)[0]
  );
}
function moveFocus(scope, [dx, dy]) {
  setPadNav(true);
  const cur = document.activeElement;
  if (!cur || cur === document.body || !scope.contains(cur)) {
    focusEl(defaultFocus(scope));
    return;
  }
  if (dx && kit.input.source === 'gamepad' && adjust(cur, dx)) return;
  const next = neighbour(scope, cur, dx, dy);
  if (next) focusEl(next);
}
/** Controller and arrow-key navigation of the game's own DOM menus. */
function menuInput(dt) {
  const i = kit.input,
    scope = ui.overlay;
  if (i.pressed('pause')) {
    if (ui.panel !== 'title') closePanel();
    return;
  }
  if (i.pressed('back')) {
    if (ui.panel !== 'title') closePanel();
    return;
  }
  if (ui.panel === 'map' && i.pressed('map')) {
    closePanel();
    return;
  }
  if (ui.panel === 'port' && (i.pressed('tabPrev') || i.pressed('tabNext'))) {
    const n = PORT_TABS.length,
      at = Math.max(0, PORT_TABS.indexOf(ui.portTab));
    ui.portTab = PORT_TABS[(at + (i.pressed('tabNext') ? 1 : -1) + n) % n];
    ui.show('port');
    setPadNav(true);
    focusEl(scope.querySelector('.tabs button.active'));
    audio.play('ui');
    return;
  }
  // The right stick scrolls long panels (trading tables, the outfitter).
  const content = scope.querySelector('.panel-content'),
    sc = i.vector('face');
  if (content && Math.abs(sc.y) > 0.25) content.scrollTop -= sc.y * 900 * dt;
  const v = i.vector('nav');
  if (navHold) {
    if (Math.hypot(v.x, v.y) < 0.3) navHold = false;
  } else {
    const dir = repeat(v, dt);
    if (dir) moveFocus(scope, dir);
  }
  if (i.pressed('confirm')) {
    const el = document.activeElement;
    if (el && el !== document.body && scope.contains(el)) activate(el);
    else {
      setPadNav(true);
      focusEl(defaultFocus(scope));
    }
  }
}
/** Tab cycles targets in flight; in menus it is left to the browser for focus. */
function bindTab(on) {
  if (tabBound === on) return;
  tabBound = on;
  kit.input.define({ target: { keys: on ? ['KeyT', 'Tab'] : ['KeyT'], gamepad: ['LB'] } });
}
/** On-screen controls show only in flight; Scan, Missile and Boost only when they can be used. */
function syncTouch(flying) {
  if (!kit.touch) return;
  if (touchSuspended !== !flying) {
    touchSuspended = !flying;
    kit.touch.suspend(!flying, 'game');
  }
  if (!flying) return;
  const st = model.st,
    want = { scan: sim.scanInRange, missile: !!st.launcher && model.s.ammo > 0, boost: !!st.boost };
  for (const [name, on] of Object.entries(want))
    if (shown[name] !== on) {
      shown[name] = on;
      kit.touch.setShown(name, on);
    }
}
function frame(dt, t) {
  const i = kit.input,
    panel = ui.panel,
    flying = playing && !panel && !model.s.docked;
  bindTab(flying);
  if (panel) menuInput(dt);
  else if (playing) flightCommands();
  let alpha = 1;
  if (playing && !ui.panel && !sim.paused && !model.s.docked && !simFailed) {
    const input = readFlightInput();
    try {
      alpha = step.advance(dt, (h) => sim.update(h, input));
      saveTimer += dt;
      if (saveTimer > 12) {
        model.save();
        saveTimer = 0;
      }
    } catch (error) {
      // Keep the last autosave and tell the player, instead of freezing in flight.
      simFailed = true;
      console.error('Flight simulation error:', error);
      playing = false;
      ui.show('title');
      ui.engine('Flight stopped safely: ' + (error?.message || error) + '. Your last autosave is retained.', true);
    }
  } else step.reset();
  const paused = sim.paused || !playing;
  const snapshot = sim.snapshot(paused ? 1 : alpha);
  if (!playing) snapshot.time = t;
  view.scanHighlight = playing && sim.scanInRange;
  view.render(snapshot, dt, paused ? 1 : alpha);
  syncTouch(playing && !ui.panel && !model.s.docked);
  if (playing && !ui.panel) ui.updateLabels(view, sim);
  hudTimer += dt;
  radarTimer += dt;
  diagTimer += dt;
  if (hudTimer > 0.1) {
    hudTimer = 0;
    if (playing) ui.flightHUD(sim);
  }
  if (radarTimer > 0.05) {
    radarTimer = 0;
    if (playing && !ui.panel) ui.drawRadar(snapshot);
  }
  if (diagTimer > 0.5) {
    diagTimer = 0;
    ui.diagnostics(window.__kit?.fps || 0, physics.bodies.size, kit.backendLabel, kit.tier.name);
  }
  if (i.source === 'gamepad' && ui.panel && !ui.overlay.contains(document.activeElement)) {
    // A controller player always has something focused in a menu.
    const el = defaultFocus(ui.overlay);
    if (el) {
      setPadNav(true);
      focusEl(el);
    }
  }
}
function exportSave() {
  try {
    const valid = validateState(playing ? model.s : JSON.parse(storage?.getItem(SAVE_KEY) || 'null'));
    const blob = new Blob([JSON.stringify(valid, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `starlight-drifter-day-${valid.day}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    ui.toast('Captain’s log exported.');
  } catch (error) {
    ui.toast(error.message, 'warn');
  }
}
document.querySelector('#save-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('Save file is too large.');
    const state = validateState(JSON.parse(await file.text()));
    const load = () => {
      if (!ui.ready) {
        storage?.setItem(SAVE_KEY, JSON.stringify(state));
        ui.hasSave = true;
        ui.toast('Save imported. It will be ready once the flight engine starts.');
      } else acceptModelState(state);
    };
    ask(
      { title: 'Load this captain’s log?', eyebrow: 'IMPORT SAVE', text: `Load ${state.name}’s day ${state.day} save and replace the current captain?`, yes: 'Load save', no: 'Cancel', danger: true },
      load,
    );
  } catch (error) {
    ui.toast('Save not loaded: ' + error.message, 'warn');
  } finally {
    event.target.value = '';
  }
});
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else ui.toast('Fullscreen is not supported by this browser. Use its add-to-home-screen feature.');
  } catch {
    ui.toast('The browser declined fullscreen mode.', 'warn');
  }
  if (ui.panel === 'options') refreshPanel();
}
// The kit ignores keys while a form field has focus, so Escape and Enter in the menus' own fields are handled here.
ui.overlay.addEventListener('keydown', (event) => {
  const t = event.target;
  if (!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    closePanel();
  } else if ((event.code === 'Enter' || event.code === 'NumpadEnter') && t.id === 'captain-name') {
    event.preventDefault();
    action('start');
  }
});
addEventListener('blur', () => {
  if (playing) model.save();
  if (playing && !ui.panel) ui.show('pause');
});
document.addEventListener('visibilitychange', () => {
  audio.hold('hidden', document.hidden);
  if (document.hidden) {
    if (playing) model.save();
    if (playing && !ui.panel) ui.show('pause');
  }
});
addEventListener('pagehide', () => {
  if (playing) model.save();
});
initialize();
