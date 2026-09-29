/**
 * main.js — Datecraft on the shared 3D stack: boots the kit, builds
 * Brightside City, runs onboarding and the management UI, and routes every
 * key, mouse, touch and controller input through kit.input actions.
 */

import { boot } from 'kit/boot.js';
import { MOUSE_LOOK, TOUCH_LOOK, STICK_LOOK } from 'kit/input.js';
import { AudioDirector } from './audio.js';
import { GameSimulation, validateStateInvariants } from './engine.js';
import { createInitialState } from './initial-state.js';
import { loadGame, saveGame } from './persistence.js';
import { GameUI, runOnboarding } from './ui.js';
import { CityWorld } from './world.js';
import { createPadNav } from './padnav.js';

const QUICK_ACTIVITIES = ['rest', 'marketing', 'training', 'social', 'admin'];
/** Pixels of pointer travel that still count as a click or tap. */
const TAP_SLOP = 7;

const diagnostics = { renderer: 'three', backend: null, errors: [], standalone: true };
globalThis.__DATECRAFT_BOOT__ = diagnostics;

const kit = await boot({
  title: 'Datecraft',
  canvas: document.querySelector('#render-canvas'),
  gear: 'none', // the pause menu has a "Graphics & controls" entry (and F9 opens it)
  accent: '#3d3951',
  background: 'radial-gradient(circle at 22% 20%, rgba(255,255,255,.75), transparent 25%), radial-gradient(circle at 78% 80%, rgba(255,220,164,.7), transparent 30%), linear-gradient(145deg, #9edfec, #ffe0a4 52%, #ffa9aa)',
  touch: { top: 'center', topOffset: 92 },
  input: {
    // Camera: keys and left stick pan; inside dialogs they move between buttons instead.
    pan: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick' },
    // Menus: the D-pad moves focus between the interface's buttons.
    nav: { type: 'vector', gamepad: 'dpad' },
    // Drag the city with the mouse or a finger (right-drag turns it).
    drag: { type: 'look', mouse: 'drag', gamepad: [], touch: 'drag' },
    turn: { mouse: [2] },
    // Right stick: turn and zoom the camera, or scroll the focused panel.
    orbit: { type: 'look', mouse: 'none', gamepad: 'rightStick' },
    rotateLeft: { keys: ['KeyQ'], gamepad: ['LB'], touch: { label: '⟲', slot: 'top' } },
    recenter: { keys: ['Home'], gamepad: ['RS'], touch: { label: '⌂', slot: 'top' } },
    rotateRight: { keys: ['KeyE'], gamepad: ['RB'], touch: { label: '⟳', slot: 'top' } },
    confirm: { gamepad: ['A'] },
    back: { gamepad: ['B'] },
    menu: { keys: ['Escape'], gamepad: ['Start'] },
    time: { keys: ['Space'], gamepad: ['Back'] },
    phone: { keys: ['KeyP'], gamepad: ['Y'] },
    nextSlot: { gamepad: ['X'] },
    prevVenue: { gamepad: ['LT'] },
    nextVenue: { gamepad: ['RT'] },
    quick1: { keys: ['Digit1', 'Numpad1'] },
    quick2: { keys: ['Digit2', 'Numpad2'] },
    quick3: { keys: ['Digit3', 'Numpad3'] },
    quick4: { keys: ['Digit4', 'Numpad4'] },
    quick5: { keys: ['Digit5', 'Numpad5'] },
  },
});

diagnostics.backend = kit.backend;
diagnostics.backendLabel = kit.backendLabel;
diagnostics.rendererLabel = `three.js r${kit.THREE.REVISION} 3D`;

const modalLayer = document.querySelector('#modal-layer');
const gameUi = document.querySelector('#game-ui');
const canvas = kit.canvas;
const input = kit.input;

let simulation = null;
let ui = null;
let audio = null;

const world = new CityWorld(kit, { onVenueSelected: (venueId) => simulation?.selectVenue(venueId) });
kit.loading.progress(0.75, 'Building Brightside City…');
await world.init();

const padnav = createPadNav({ input, modalLayer, gameUi });
const press = { dist: 0, gesture: false };
const hover = { x: NaN, y: NaN, on: false };

// Space on a focused checkbox toggles it, as in the original (onboarding and settings). The kit
// leaves form fields alone on keydown but cancels the Space keyup on a checkbox that was
// clicked, and that keyup is when browsers toggle it; so that keyup does not reach the kit
// (which never took the keydown either).
window.addEventListener(
  'keyup',
  (e) => {
    const t = e.target;
    if (e.code !== 'Space' || !(t instanceof HTMLInputElement) || (t.type !== 'checkbox' && t.type !== 'radio')) return;
    e.stopImmediatePropagation();
    input.keys.delete(e.code);
  },
  true
);

// The top row of touch pills (turn, reset, turn) centres in the free band between the side
// panels; where they leave no room (a phone-sized screen with the phone open) the pills step
// aside. Measured only when something that moves the panels changes, never every frame.
const pillRow = kit.touch?.element.querySelector('.kit-touch__top') || null;
const pillBlockers = ['#needs-panel', '#phone-panel', '#venue-card'].map((s) => document.querySelector(s));
const venueCard = pillBlockers[2];
const pillLayout = { modal: null, phone: null, shown: null, menu: null, venue: null, w: 0, h: 0, scale: 0 };

function layoutPills(modalOpen) {
  if (!pillRow) return;
  const L = pillLayout;
  const phone = !!ui?.phoneOpen;
  const shown = kit.touch.visible;
  const menu = kit.menu.isOpen;
  const venue = !venueCard.classList.contains('is-hidden');
  const scale = kit.settings.get().touchScale || 1;
  const { width: w, height: h } = kit.size;
  if (L.modal === modalOpen && L.phone === phone && L.shown === shown && L.menu === menu && L.venue === venue && L.w === w && L.h === h && L.scale === scale) return;
  Object.assign(L, { modal: modalOpen, phone, shown, menu, venue, w, h, scale });
  // Dialogs cover the city: no camera pills while one is up.
  kit.touch.suspend(modalOpen, 'layout');
  if (modalOpen) return;
  const row = pillRow.getBoundingClientRect();
  if (!row.width) return; // not shown now (no touch, or the settings panel is open)
  let left = 0;
  let right = innerWidth;
  for (const el of pillBlockers) {
    if (!el || el.classList.contains('is-hidden')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < row.top - 6 || r.top > row.bottom + 6) continue;
    if (r.left + r.right < innerWidth) left = Math.max(left, r.right);
    else right = Math.min(right, r.left);
  }
  if (right - left - 16 < row.width) {
    kit.touch.suspend(true, 'layout');
    return;
  }
  document.documentElement.style.setProperty('--datecraft-pills-x', `${Math.round((left + right) / 2)}px`);
}

kit.onPause((paused) => {
  if (ui) ui.externalPause = paused;
  const ctx = audio?.context;
  if (ctx) (paused ? ctx.suspend() : ctx.resume()).catch(() => {});
});

function frame(dt, t) {
  const modalOpen = !modalLayer.classList.contains('is-hidden');

  // On-screen camera pills stay out of the way of dialogs and of the side panels.
  layoutPills(modalOpen);

  // Interface navigation (controller, and arrow keys inside dialogs).
  const nav = input.vector('nav');
  if (modalOpen) {
    const pan = input.vector('pan');
    nav.x += pan.x;
    nav.y += pan.y;
  }
  padnav.update({ modalOpen, dir: nav });

  if (input.pressed('menu')) ui?.menuAction();
  if (input.pressed('back')) {
    if (modalOpen) ui?.closeModal();
    else padnav.clear();
  }
  if (ui) {
    if (input.pressed('time')) ui.toggleTime();
    if (input.pressed('phone')) ui.togglePhone();
    if (!modalOpen) {
      QUICK_ACTIVITIES.forEach((id, i) => {
        if (input.pressed(`quick${i + 1}`)) ui.doActivity(id);
      });
      if (input.pressed('nextSlot')) ui.advanceSlot();
    }
  }

  if (!modalOpen) {
    if (input.pressed('prevVenue')) world.cycleVenue(-1);
    if (input.pressed('nextVenue')) world.cycleVenue(1);
    if (input.pressed('rotateLeft')) world.rotateStep(1);
    if (input.pressed('rotateRight')) world.rotateStep(-1);
    if (input.pressed('recenter')) world.resetCamera();
    const pan = input.vector('pan');
    if (pan.x || pan.y) world.panStick(pan.x, pan.y, dt);
    const zoom = input.zoom();
    if (zoom) world.zoomBy(zoom * 1.1);
  }

  // Right stick: scroll the panel the controller is in, otherwise turn and zoom.
  const orbit = input.look('orbit');
  if (orbit.x || orbit.y) {
    const scroller = padnav.scroller(modalOpen);
    if (scroller) scroller.scrollTop += (orbit.y * 900) / STICK_LOOK;
    else if (!modalOpen) {
      world.rotateBy(-orbit.x);
      world.zoomBy((-orbit.y * 8) / STICK_LOOK);
    }
  }

  // Mouse and touch on the city: drag pans (right-drag turns), a click or tap selects.
  const p = input.pointer;
  if (p.justDown) {
    press.dist = 0;
    press.gesture = false;
  }
  if (p.down || p.justUp) {
    const look = input.look('drag');
    if (look.x || look.y) {
      const s = kit.settings.get();
      const perPx = (p.type === 'touch' ? TOUCH_LOOK : MOUSE_LOOK) * (s.lookSensitivity ?? 1);
      const dx = look.x / perPx;
      const dy = (look.y / perPx) * (s.invertY ? -1 : 1);
      press.dist += Math.hypot(dx, dy);
      if (input.down('turn')) world.rotateBy(dx * 0.008);
      else world.panPixels(dx, dy);
    }
    if (input.zoom()) press.gesture = true;
  }
  if (p.justUp && press.dist <= TAP_SLOP && !press.gesture && !modalOpen) world.tap(p.nx, p.ny);

  // Hover (mouse only): light up the venue label under the pointer.
  if (p.type === 'mouse' && p.over && !p.down && !modalOpen) {
    if (p.x !== hover.x || p.y !== hover.y) {
      hover.x = p.x;
      hover.y = p.y;
      hover.on = true;
      canvas.style.cursor = world.hover(p.nx, p.ny) ? 'pointer' : '';
    }
  } else if (hover.on && !p.down) {
    hover.on = false;
    hover.x = NaN;
    world.hover(null);
    canvas.style.cursor = '';
  }

  world.update(dt, t);
  world.render();
}

kit.start(frame);

async function startDatecraft() {
  let state = loadGame();
  if (!state) {
    const preview = createInitialState({ name: 'Alex', region: 'brightwater', adultConfirmed: true, tutorial: true, seed: 'datecraft-preview' });
    world.setState(preview);
    const options = await runOnboarding({ renderer: `${diagnostics.rendererLabel} · ${kit.backendLabel}` });
    state = createInitialState(options);
  }
  simulation = new GameSimulation(state);
  simulation.initialize();
  const invariantErrors = validateStateInvariants(simulation.state);
  if (invariantErrors.length) throw new Error(`Save validation failed: ${invariantErrors.join('; ')}`);
  audio = new AudioDirector(simulation.state.settings);
  ui = new GameUI({
    simulation,
    world,
    audio,
    diagnostics,
    onGraphics: () => kit.menu.open(),
    onNewGame: () => {
      ui?.destroy();
      audio.dispose();
      location.reload();
    },
  });
  ui.externalPause = kit.paused;
  saveGame(simulation.state);
  const saveBeforeExit = () => saveGame(simulation.state);
  window.addEventListener('pagehide', saveBeforeExit);
  window.addEventListener('beforeunload', saveBeforeExit);
  globalThis.__DATECRAFT__ = {
    version: simulation.state.version,
    renderer: diagnostics.renderer,
    diagnostics,
    simulation,
    world,
    ui,
    kit,
    snapshot: () => simulation.snapshot(),
    validate: () => validateStateInvariants(simulation.state),
    dispose: () => {
      window.removeEventListener('pagehide', saveBeforeExit);
      window.removeEventListener('beforeunload', saveBeforeExit);
      ui.destroy();
      audio.dispose();
      world.dispose();
    },
  };
  console.info(`Datecraft ${simulation.state.version} started on ${diagnostics.rendererLabel} (${kit.backendLabel}).`);
}

startDatecraft().catch((error) => {
  console.error(error);
  diagnostics.errors.push(error?.stack || error?.message || String(error));
  kit.toast('Datecraft could not start. Open the browser console for details.', 12000);
});
