// Everything around the 3D view: HUD, minimap and atlas, the menu and dialogs,
// photo mode, the field journal, control prompts and saving.

import * as THREE from 'three/webgpu';
import { CONFIG, BIOMES, PLACES, SPECIES, STATE_LABELS, WEATHER_LABELS, clamp, fmtClock } from './config.js';
import { CHALLENGES } from './journal.js';
import { MenuNav } from './nav.js';
import { RING } from './world.js';

const SAVE_KEY = 'verdant-save-v1';
const PHOTO_KEY = 'verdant-photo-save';
const DIALOGS = ['menu-dialog', 'map-dialog', 'settings-dialog', 'wildlife-dialog', 'journal-dialog'];
const $ = (id) => document.getElementById(id);
const _mapColor = new THREE.Color();
const _fwd = new THREE.Vector3();

const ICONS = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  mobile: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 5h4m-3 14h2"/>',
  up: '<path d="m5 10 7-7 7 7m-7-7v18"/>',
  down: '<path d="m5 14 7 7 7-7m-7 7V3"/>',
  fast: '<path d="m4 7 6 5-6 5m9-10 6 5-6 5"/>',
  move: '<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',
  look: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  sun: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 9.3 4.4 4.4 0 0 0 7 18Z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.2 5.3 4.4 4.4 0 0 0 7 14Zm1 3-1 3m5-3-1 3m5-3-1 3"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2-1 3 2 3-2 2 1 3-2-1-3 2-2-2-3-3-1-1-3Z"/><circle cx="11.5" cy="11.5" r="3"/>',
  sliders: '<path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  soundOff: '<path d="M11 4 6 8H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6"/>',
  sound: '<path d="M11 4 6 8H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  expand: '<path d="M14 3h7v7m0-7-7 7M10 21H3v-7m0 7 7-7"/>',
  paw: '<ellipse cx="6" cy="8" rx="2" ry="2.8"/><ellipse cx="11" cy="5.5" rx="2" ry="2.8"/><ellipse cx="16.5" cy="7" rx="2" ry="2.8"/><ellipse cx="20" cy="12" rx="1.7" ry="2.5"/><path d="M6 16c0-2 4-6 6-6s6 5 5 8-4 1-6 1-5 1-5-3Z"/>',
  walk: '<circle cx="14" cy="4" r="2"/><path d="m10 10 3-3 3 5 4 1m-7-6-2 8-5 6m5-6 5 2 1 5M9 9l-4 3v4"/>',
  fly: '<path d="m3 12 18-9-6 18-4-7-8-2Zm8 2L21 3"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  refresh: '<path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>',
  book: '<path d="M3 5c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0V5Zm9 0c3-1.5 6-1.5 9 0v15c-3-1.5-6-1.5-9 0"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  leaf: '<path d="M20 3C8 1 1 9 5 16S23 19 20 3ZM4 21 16 8"/>',
  tree: '<path d="m12 2 6 8h-3l6 7H3l6-7H6l6-8Zm0 15v5"/>',
  mountain: '<path d="m2 20 8-16 7 16H2Zm11-8 3-6 6 14h-5M7 10l3 2 3-2"/>',
  water: '<path d="M3 7c3-4 5 4 8 0s5 4 10 0M3 13c3-4 5 4 8 0s5 4 10 0M3 19c3-4 5 4 8 0s5 4 10 0"/>',
  city: '<path d="M3 21V9h7V3h8v8h3v10H3Zm4-9v2m0 3v2m7-12v2m0 3v2m0 3v2m4-4v4"/>',
  stones: '<path d="M3 20h18M5 20V9h3v11m3 0V6h3v14m3 0V9h3v11M4 7h5m6 0h5"/>',
};

export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.leaf}</svg>`;

/** Control help, one list per input device. */
const GUIDES = {
  keyboard: [
    ['W A S D', 'Move'],
    ['DRAG', 'Look around (double-click locks the mouse)'],
    ['SPACE', 'Jump or rise'],
    ['E / Q', 'Fly up or down'],
    ['SHIFT', 'Move faster'],
    ['F · 1 · 2', 'Walk or fly'],
    ['C · J · M', 'Photo, journal, map'],
    ['L · ESC', 'Lantern, menu'],
  ],
  gamepad: [
    ['L STICK', 'Move'],
    ['R STICK', 'Look around'],
    ['A / B', 'Rise or descend (A jumps)'],
    ['RT', 'Move faster'],
    ['Y', 'Walk or fly'],
    ['LB · RB · VIEW', 'Photo, journal, map'],
    ['R3', 'Lantern'],
    ['START', 'Menu'],
  ],
  touch: [
    ['move', 'Left stick to move'],
    ['look', 'Drag the world to look'],
    ['up', 'Tap Jump or hold Rise'],
    ['fast', 'Hold Fast for speed'],
  ],
};

const KEYS = {
  keyboard: { walk: '1', fly: '2', map: 'M', photo: 'C', journal: 'J', capture: 'ENTER', exit: 'ESC', menu: 'ESC' },
  gamepad: { walk: 'Y', fly: 'Y', map: 'VIEW', photo: 'LB', journal: 'RB', capture: 'X', exit: 'START', menu: 'START' },
};

/**
 * First-visit view distance from the kit's tier. Phones and tablets start on
 * medium: they get the game's own Performance distance (under half the chunks
 * of Balanced), desktops Balanced; the choice is the player's after that.
 */
const defaultView = (tier) => (tier.name === 'low' || tier.name === 'medium' ? 'low' : tier.name === 'ultra' ? 'ultra' : 'balanced');

export class UI {
  constructor(game, kit, { ambience, journal }) {
    this.game = game;
    this.kit = kit;
    this.input = kit.input;
    this.ambience = ambience;
    this.journal = journal;
    this.nav = new MenuNav(kit.input);
    this.started = false;
    this.hasSave = false;
    this.photoMode = false;
    this.capturing = false;
    this.stack = [];
    this.ignoreBackUntil = 0;
    this.lastClick = -1e9;
    this.wasLocked = false;
    this.saveTimer = 0;
    this.toastTimer = 0;
    this.selectedAnimal = null;
    this.animalSignature = '';
    this.detailAnimal = null;
    this.miniCenter = null;
    this.miniBounds = null;
    this.miniBase = null;
    this.atlasCache = null;
    this.source = null;
    this.night = null;
    this.icons = new Map();
    this.texts = new Map();
    this.env = { day: 1, rain: 0, cloud: 0, altitude: 0, height: 0, fallsDistance: 1e9 };
    this.savePhotos = true;
    try {
      this.savePhotos = localStorage.getItem(PHOTO_KEY) !== 'off';
    } catch {
      /* private mode */
    }

    document.querySelectorAll('[data-icon]').forEach((n) => (n.innerHTML = icon(n.dataset.icon)));
    this.bind();
    this.loadSave();
    this.populatePlaces();
    this.applySource(this.input.source);
    this.input.onSourceChange((src) => this.applySource(src));
    kit.touch?.setShown('capture', false);

    game.addEventListener('tick', () => this.update());
    game.addEventListener('progress', (e) => kit.loading.progress(0.6 + 0.4 * clamp(e.detail, 0, 1), 'Growing your world…'));
    game.addEventListener('ready', () => this.onReady());
    game.addEventListener('travel', () => {
      this.setModeUI();
      this.miniCenter = null;
      this.update();
    });
    game.controls.onStep = () => ambience.step();
    game.controls.onLand = (strength) => {
      ambience.land(strength);
      this.input.rumble(0.2 + strength * 0.3, 90);
    };

    this.setModeUI();
    this.syncSound();
    this.syncSettingsUI();
    this.updateJournalBadge();
    this.syncInput();
    this.update();
  }

  async onReady() {
    // Build every pipeline the world needs (the first view, the lantern, rain and snow) before the loading card lifts.
    this.kit.loading.progress(1, 'Almost there…');
    await this.game.prepare();
    this.kit.loading.done();
    this.openMenu();
  }

  /* ------------------------------------------------------------ wiring */

  bind() {
    $('walk-btn').onclick = () => this.setMode('walk');
    $('fly-btn').onclick = () => this.setMode('fly');
    for (const id of ['map-btn', 'map-open']) $(id).onclick = () => this.open('map-dialog');
    $('settings-btn').onclick = () => this.open('settings-dialog');
    $('wildlife-btn').onclick = () => this.open('wildlife-dialog');
    $('journal-btn').onclick = () => this.open('journal-dialog');
    $('photo-btn').onclick = () => this.photo(true);
    $('photo-exit').onclick = () => this.photo(false);
    $('capture-btn').onclick = () => this.capture();
    $('sound-btn').onclick = () => this.toggleSound();
    $('menu-btn').onclick = () => this.openMenu();
    $('menu-play').onclick = () => this.resumeGame();
    $('menu-journal').onclick = () => this.open('journal-dialog');
    $('menu-wildlife').onclick = () => this.open('wildlife-dialog');
    $('menu-settings').onclick = () => this.open('settings-dialog');
    $('menu-graphics').onclick = () => this.kit.menu.open();
    for (const d of DIALOGS.map($)) {
      // Escape and the Android back gesture arrive here; the game decides what closes.
      d.addEventListener('cancel', (e) => {
        e.preventDefault();
        if (performance.now() < this.ignoreBackUntil) return;
        this.ignoreBackUntil = performance.now() + 250;
        this.closeDialog(d);
      });
      d.addEventListener('close', () => {
        this.stack = this.stack.filter((x) => x !== d);
        this.syncInput();
      });
      d.addEventListener('click', (e) => {
        if (e.target !== d || d.id === 'menu-dialog') return;
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.hideDialog(d);
      });
    }
    document.querySelectorAll('.close-dialog').forEach((b) => (b.onclick = () => this.hideDialog(b.closest('dialog'))));
    $('quality').onchange = (e) => {
      this.game.setViewDistance(e.target.value);
      this.syncSettingsUI();
      this.toast('View distance updated.');
      this.save();
    };
    $('time-slider').oninput = (e) => {
      this.game.hour = clamp(Number(e.target.value) || 0, 0, 23.99);
      $('time-output').textContent = fmtClock(this.game.hour);
    };
    $('day-cycle').onchange = (e) => (this.game.cycle = e.target.checked);
    $('weather').onchange = (e) => {
      this.game.setWeather(e.target.value);
      this.update();
    };
    $('lantern-toggle').onchange = (e) => this.setLantern(e.target.checked, false);
    $('photo-save').onchange = (e) => {
      this.savePhotos = e.target.checked;
      $('capture-label').textContent = this.savePhotos ? 'Save photo' : 'Take photo';
      try {
        localStorage.setItem(PHOTO_KEY, this.savePhotos ? 'on' : 'off');
      } catch {
        /* private mode */
      }
    };
    $('random-seed').onclick = () => ($('seed').value = String(1 + Math.floor(Math.random() * 2147483646)));
    $('regenerate-btn').onclick = () => {
      const seed = Number($('seed').value);
      if (!Number.isInteger(seed) || seed < 1 || seed > 2147483647) {
        this.toast('Enter a whole number from 1 to 2147483647.');
        return;
      }
      this.game.regenerate(seed);
      this.atlasCache = null;
      this.hideDialog($('settings-dialog'));
      this.toast(`A new world is growing. Seed ${seed}.`);
      this.save();
    };
    $('atlas').onclick = (e) => {
      const r = e.target.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2200 - 1100;
      const z = ((e.clientY - r.top) / r.height) * 2000 - 900;
      let nearest = null;
      let best = Infinity;
      for (const p of PLACES) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      this.travel(best < 110 ? nearest : { x, z, name: 'New ground' });
    };
    // Losing pointer lock (Escape) while exploring opens the menu, as before.
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.game.canvas;
      if (this.wasLocked && !locked && this.started && !this.stack.length && !this.photoMode && !this.kit.menu.isOpen) {
        this.openMenu();
        this.ignoreBackUntil = performance.now() + 300;
      }
      this.wasLocked = locked;
    });
  }

  /** Prompts, help and layout follow the device the player last used. */
  applySource(src) {
    this.source = src;
    const touch = src === 'touch';
    const pad = src === 'gamepad';
    document.body.dataset.controls = touch ? 'mobile' : 'desktop';
    const keys = KEYS[pad ? 'gamepad' : 'keyboard'];
    document.querySelectorAll('[data-key]').forEach((k) => (k.textContent = keys[k.dataset.key] || ''));
    $('capture-key').textContent = keys.capture;
    $('photo-exit-key').textContent = keys.exit;
    $('menu-shortcut').hidden = touch;
    $('menu-shortcut').innerHTML = `<kbd>${keys.menu}</kbd> Menu`;
    $('settings-foot').textContent = touch
      ? 'Stick to move · Drag to look · Rise and Down to fly'
      : pad
        ? 'Left stick move · A jump / rise · B descend · RS lantern'
        : 'WASD move · Space jump / rise · Q descend · L lantern';
    $('lantern-note').textContent = touch ? 'A light that follows your view.' : `A light that follows your view. Press ${pad ? 'the right stick' : 'L'}.`;
    this.game.canvas.setAttribute(
      'aria-label',
      touch ? '3D world. Use the left stick to move. Drag the world to look.' : pad ? '3D world. Left stick to move, right stick to look.' : '3D world. Drag to look. Use W A S D to move.'
    );
    const guide = touch ? 'touch' : pad ? 'gamepad' : 'keyboard';
    $('control-guide').innerHTML = GUIDES[guide].map(([k, text]) => (touch ? `<div>${icon(k)}<span>${text}</span></div>` : `<div><kbd>${k}</kbd><span>${text}</span></div>`)).join('');
    this.renderHints();
  }

  renderHints() {
    const fly = this.game.controls.mode === 'fly';
    const k = (text) => text.split(' ').map((x) => `<kbd>${x}</kbd>`).join('');
    const parts =
      this.source === 'gamepad'
        ? [`${k('LS')} move`, `${k('RS')} look`, `${k('RT')} move faster`, fly ? `${k('A B')} up / down` : `${k('A')} jump`]
        : [`${k('W A S D')} move`, 'Drag to look', `${k('SHIFT')} move faster`, fly ? `${k('E Q')} up / down` : `${k('SPACE')} jump`];
    $('key-hints').innerHTML = parts.map((p) => `<span>${p}</span>`).join('<i></i>');
  }

  /* ------------------------------------------------------------ per frame */

  frame(dt) {
    const input = this.input;
    const top = this.stack[this.stack.length - 1] || null;
    this.nav.update(top);
    if (top) {
      if ((input.pressed('back') || input.pressed('pause')) && performance.now() > this.ignoreBackUntil) this.closeDialog(top);
    } else if (this.started) {
      this.worldInput();
    }
    this.saveTimer += dt;
    if (this.saveTimer > 5) {
      this.saveTimer = 0;
      this.save();
    }
    const g = this.game;
    const p = g.camera.position;
    const env = this.env;
    env.day = g.daylight;
    env.rain = g.rain * (g.snowy ? 0.3 : 1);
    env.cloud = g.cloud;
    env.height = p.y;
    env.altitude = p.y - g.world.groundAt(p.x, p.z);
    env.fallsDistance = Math.hypot(p.x - g.world.riverX(-300), p.y - 28, p.z + 299);
    this.ambience.update(dt, env);
  }

  worldInput() {
    const input = this.input;
    if (input.pressed('pause') && performance.now() > this.ignoreBackUntil) {
      if (this.photoMode) this.photo(false);
      else this.openMenu();
      return;
    }
    // A double-click locks the mouse, so looking no longer needs a drag.
    const ptr = input.pointer;
    if (ptr.justDown && ptr.type === 'mouse') {
      const now = performance.now();
      if (now - this.lastClick < 350) {
        input.lockPointer();
        this.lastClick = -1e9;
      } else {
        this.lastClick = now;
      }
    }
    if (this.photoMode) {
      if (input.pressed('capture')) this.capture();
      if (input.pressed('photo')) this.photo(false);
      return;
    }
    if (input.pressed('walk')) this.setMode('walk');
    if (input.pressed('fly')) this.setMode('fly');
    if (input.pressed('mode')) this.setMode(this.game.controls.mode === 'fly' ? 'walk' : 'fly');
    if (input.pressed('lantern')) this.setLantern(!this.game.lanternOn);
    if (input.pressed('photo')) this.photo(true);
    else if (input.pressed('map')) this.open('map-dialog');
    else if (input.pressed('journal')) this.open('journal-dialog');
  }

  /* ------------------------------------------------------------ menus and dialogs */

  syncInput() {
    const menuOpen = $('menu-dialog').open;
    this.game.setPaused(menuOpen || !this.started);
    const playing = this.started && !this.stack.length;
    this.game.controls.active = playing;
    this.kit.touch?.suspend(!playing, 'dialogs');
    if (playing) {
      // The press that closed a dialog must not also jump, fly or snap a photo.
      this.input.settle();
      this.game.canvas.focus({ preventScroll: true });
    }
  }

  showDialog(d) {
    if (d.open) return;
    d.showModal();
    this.stack = this.stack.filter((x) => x !== d);
    this.stack.push(d);
    this.input.unlockPointer();
    this.syncInput();
  }

  hideDialog(d) {
    if (!d) return;
    if (d.open) d.close();
    this.stack = this.stack.filter((x) => x !== d);
    this.syncInput();
  }

  /** Back / Escape on a dialog: the pause menu resumes (once the game has started), others close. */
  closeDialog(d) {
    if (d.id === 'menu-dialog') {
      if (this.started) this.resumeGame();
      return;
    }
    this.hideDialog(d);
  }

  openMenu() {
    const menu = $('menu-dialog');
    if (!this.game.ready || menu.open) return;
    if (this.photoMode) this.photo(false);
    const back = this.hasSave && !this.started;
    $('menu-title').textContent = this.started ? 'Take a moment.' : back ? 'Welcome back.' : 'Make yourself at home.';
    $('menu-description').textContent = this.started
      ? 'Change how you explore, or return to the world.'
      : back
        ? 'Your world is just as you left it.'
        : 'Choose how to explore, then enter the world.';
    $('menu-status').textContent = this.started
      ? 'WORLD PAUSED'
      : back
        ? `DAY ${String(this.game.day).padStart(2, '0')} · ${fmtClock(this.game.hour)}`
        : 'YOUR WORLD AWAITS';
    $('menu-play').innerHTML = `${this.started ? 'Resume' : back ? 'Continue exploring' : 'Enter world'} ${icon('chevron')}`;
    const mode = this.game.controls.mode;
    document.querySelectorAll('[name="explore-mode"]').forEach((r) => (r.checked = r.value === mode));
    this.showDialog(menu);
  }

  resumeGame() {
    const first = !this.started;
    this.started = true;
    const picked = document.querySelector('[name="explore-mode"]:checked')?.value;
    if (picked && picked !== this.game.controls.mode) {
      this.game.controls.setMode(picked);
      this.setModeUI();
    }
    this.hideDialog($('menu-dialog'));
    this.ambience.start();
    this.toast(
      this.source === 'touch'
        ? 'Use the left stick to move. Drag the world to look.'
        : this.source === 'gamepad'
          ? 'Left stick to move. Right stick to look. Start opens the menu.'
          : 'WASD to move. Drag to look. Escape opens the menu.'
    );
    if (first) this.save();
  }

  open(id) {
    if (!this.game.ready) return;
    if (this.photoMode) this.photo(false);
    if (id === 'map-dialog') {
      this.drawAtlas();
      $('map-seed').textContent = String(this.game.world.seed);
    }
    if (id === 'settings-dialog') this.syncSettingsUI();
    if (id === 'wildlife-dialog') this.updateAnimals(true);
    if (id === 'journal-dialog') this.renderJournal();
    this.showDialog($(id));
  }

  setMode(mode) {
    if (!this.game.ready) return;
    this.game.controls.setMode(mode);
    this.setModeUI();
    const touch = this.source === 'touch';
    const pad = this.source === 'gamepad';
    this.toast(
      mode === 'walk'
        ? touch
          ? 'On foot. Use the stick to move. Tap Jump.'
          : pad
            ? 'On foot. Left stick to walk. A to jump.'
            : 'On foot. WASD to walk. Space to jump.'
        : touch
          ? 'Free flight. Hold Rise or Down to change height.'
          : pad
            ? 'Free flight. A to rise. B to descend.'
            : 'Free flight. E to rise. Q to descend.'
    );
  }

  setModeUI() {
    const walk = this.game.controls.mode === 'walk';
    $('walk-btn').classList.toggle('active', walk);
    $('fly-btn').classList.toggle('active', !walk);
    $('walk-btn').setAttribute('aria-pressed', String(walk));
    $('fly-btn').setAttribute('aria-pressed', String(!walk));
    $('mode-label').textContent = walk ? 'ON FOOT' : 'FREE FLIGHT';
    const t = this.kit.touch;
    t?.setLabel('rise', walk ? 'Jump' : 'Rise');
    t?.setShown('descend', !walk);
    t?.setLabel('mode', walk ? 'Fly' : 'Walk');
    this.renderHints();
  }

  setLantern(on, announce = true) {
    this.game.lanternOn = on;
    $('lantern-toggle').checked = on;
    if (announce) this.toast(on ? 'Lantern on.' : 'Lantern off.');
  }

  syncSettingsUI() {
    const g = this.game;
    const q = $('quality');
    q.value = g.viewDistance;
    const label = q.selectedOptions[0]?.text || 'Balanced';
    $('distance-label').textContent = `${((CONFIG.viewRadii[g.viewDistance] * 96) / 1000).toFixed(1)} km · ${label} detail`;
    $('time-slider').value = String(g.hour);
    $('time-output').textContent = fmtClock(g.hour);
    $('day-cycle').checked = g.cycle;
    $('weather').value = g.weatherSetting;
    $('lantern-toggle').checked = g.lanternOn;
    $('photo-save').checked = this.savePhotos;
    $('capture-label').textContent = this.savePhotos ? 'Save photo' : 'Take photo';
    $('seed').value = String(g.world.seed);
  }

  toast(text) {
    clearTimeout(this.toastTimer);
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
  }

  toggleSound() {
    this.ambience.setEnabled(!this.ambience.enabled);
    this.syncSound();
    this.toast(this.ambience.enabled ? 'Ambient sound on.' : 'Ambient sound off.');
  }

  syncSound() {
    const on = this.ambience.enabled;
    $('sound-btn').innerHTML = icon(on ? 'sound' : 'soundOff');
    $('sound-btn').setAttribute('aria-label', on ? 'Mute ambient sound' : 'Enable ambient sound');
  }

  populatePlaces() {
    $('destinations').innerHTML = PLACES.map(
      (p, i) =>
        `<button class="destination" data-place="${i}"><span class="dest-icon">${icon(p.icon)}</span><span><strong>${p.name}</strong><small>${p.detail}</small></span><span class="dest-num">${String(i + 1).padStart(2, '0')}</span></button>`
    ).join('');
    document.querySelectorAll('[data-place]').forEach((b) => (b.onclick = () => this.travel(PLACES[Number(b.dataset.place)])));
  }

  travel(place) {
    this.hideDialog($('map-dialog'));
    this.hideDialog($('journal-dialog'));
    this.game.travel(place);
    this.toast(`Arrived near ${place.name}.`);
  }

  /* ------------------------------------------------------------ HUD */

  setText(id, value) {
    if (this.texts.get(id) === value) return;
    this.texts.set(id, value);
    $(id).textContent = value;
  }

  setIcon(id, name) {
    if (this.icons.get(id) === name) return;
    this.icons.set(id, name);
    $(id).innerHTML = icon(name);
  }

  update() {
    const g = this.game;
    const p = g.camera.position;
    const biome = BIOMES[g.world.biome(p.x, p.z)];
    let name = biome.name;
    let line = 'Take the long way home.';
    if (Math.hypot(p.x + 265, p.z + 170) < 62) {
      name = 'Hollowstone Cave';
      line = 'A quiet passage through the stone.';
    } else if (Math.hypot(p.x - RING.x, p.z - RING.z) < 70) {
      name = 'The Sunstone Ring';
      line = 'Old stones that remember the sun.';
    } else if (Math.hypot(p.x - g.world.riverX(-300), p.z + 300) < 68) {
      name = 'Silverfall';
      line = 'Follow the sound of the river.';
    } else if (biome.type === 'River city') line = 'Every street starts with a seed.';
    else if (biome.type === 'Alpine mountains') line = 'A little closer to the sky.';
    else if (biome.type === 'Temperate forest') line = 'There is life between the trees.';
    this.setText('location-name', name);
    this.setText('location-description', line);
    this.setText('region-type', biome.type.toUpperCase());
    this.setText('coordinates', `${Math.abs(Math.round(p.x))} ${p.x < 0 ? 'W' : 'E'} · ${Math.abs(Math.round(p.z))} ${p.z < 0 ? 'N' : 'S'}`);
    this.setText('altitude', `${Math.round(p.y)} m`);
    this.setText('clock', fmtClock(g.hour));
    this.setText('day', String(g.day).padStart(2, '0'));
    this.setText('fps', `${g.fps} FPS`);
    this.setText('stream-status', g.chunks.queue.length ? 'Exploring new ground' : 'World is alive');
    const night = g.isNight;
    const snowing = g.snowy && g.rain > 0.3;
    this.setText('weather-label', snowing ? 'Snowfall' : WEATHER_LABELS[g.weather] || 'Clear skies');
    this.setIcon('weather-icon', g.weather === 'rain' ? (snowing ? 'snow' : 'rain') : g.weather === 'overcast' ? 'cloud' : night ? 'moon' : 'sun');
    this.setIcon('time-icon', night ? 'moon' : 'sun');
    if (night !== this.night) {
      // Dark touch controls on the bright day scene, light ones at night.
      this.night = night;
      this.kit.touch?.setTheme(night ? 'dark' : 'light');
    }
    const heading = ((((-g.controls.yaw * 180) / Math.PI) % 360) + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const d = Math.round(heading / 45) % 8;
    this.setText('heading', `${Math.round(heading)}°`);
    this.setText('compass-main', dirs[d]);
    this.setText('compass-left', dirs[(d + 7) % 8]);
    this.setText('compass-right', dirs[(d + 1) % 8]);
    let near = 0;
    for (const a of g.wildlife.animals) if (Math.hypot(a.x - p.x, a.z - p.z) < 200) near++;
    this.setText('animal-count', String(near));
    if ($('wildlife-dialog').open) this.updateAnimals();
    this.drawMinimap();
    this.checkDiscoveries();
  }

  /* ------------------------------------------------------------ maps */

  /** Terrain colours for a map, one pixel per sample, shaded by slope. */
  terrainImage(width, height, bounds) {
    const w = this.game.world;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    const data = img.data;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const x = bounds.x + (col / width) * bounds.w;
        const z = bounds.z + (row / height) * bounds.h;
        const ground = w.groundAt(x, z);
        const wet = ground < w.waterLevel(x, z) - 0.2;
        const hex = wet ? 7052443 : w.color(x, z, ground, _mapColor).getHex();
        const shade = wet ? 1 : clamp(0.8 + (ground - w.groundAt(x - 4, z - 4)) * 0.022, 0.65, 1.15);
        const k = (row * width + col) * 4;
        data[k] = clamp((hex >> 16) * shade, 0, 255);
        data[k + 1] = clamp(((hex >> 8) & 255) * shade, 0, 255);
        data[k + 2] = clamp((hex & 255) * shade, 0, 255);
        data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  paintMap(canvas, base, bounds) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
    const mx = (x) => ((x - bounds.x) / bounds.w) * canvas.width;
    const mz = (z) => ((z - bounds.z) / bounds.h) * canvas.height;
    ctx.fillStyle = '#d5c5a3';
    for (let x = 238; x < 440; x += 30) for (let z = -313; z < -110; z += 30) ctx.fillRect(mx(x) - 2, mz(z) - 2, 4, 4);
    return { ctx, mx, mz };
  }

  playerMarker(ctx, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-this.game.controls.yaw);
    ctx.fillStyle = '#fffde8';
    ctx.shadowColor = '#253e2c';
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(0, -8 * scale);
    ctx.lineTo(5 * scale, 6 * scale);
    ctx.lineTo(0, 3 * scale);
    ctx.lineTo(-5 * scale, 6 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawMinimap() {
    const canvas = $('minimap');
    const ctx = canvas.getContext('2d');
    const p = this.game.camera.position;
    if (!this.miniBase || !this.miniCenter || Math.hypot(p.x - this.miniCenter.x, p.z - this.miniCenter.z) > 16) {
      this.miniCenter = { x: p.x, z: p.z };
      this.miniBounds = { x: p.x - 235, z: p.z - 160, w: 470, h: 320 };
      this.paintMap(canvas, this.terrainImage(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), this.miniBounds), this.miniBounds);
      this.miniBase = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    ctx.putImageData(this.miniBase, 0, 0);
    const b = this.miniBounds;
    ctx.fillStyle = '#f5efc393';
    for (const a of this.game.wildlife.animals) ctx.fillRect(((a.x - b.x) / b.w) * canvas.width - 1, ((a.z - b.z) / b.h) * canvas.height - 1, 2, 2);
    this.playerMarker(ctx, ((p.x - b.x) / b.w) * canvas.width, ((p.z - b.z) / b.h) * canvas.height, 0.9);
  }

  drawAtlas() {
    const canvas = $('atlas');
    const bounds = { x: -1100, z: -900, w: 2200, h: 2000 };
    const seed = this.game.world.seed;
    // The whole-world terrain only changes with the seed: draw it once.
    if (!this.atlasCache || this.atlasCache.seed !== seed) {
      this.atlasCache = { seed, image: this.terrainImage(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), bounds) };
    }
    const { ctx, mx, mz } = this.paintMap(canvas, this.atlasCache.image, bounds);
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    PLACES.forEach((place, i) => {
      const x = mx(place.x);
      const y = mz(place.z);
      const visited = this.journal.has('places', place.name);
      ctx.fillStyle = visited ? '#e3efcf' : '#f6f4dc';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      if (visited) {
        ctx.strokeStyle = '#648849';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.fillStyle = '#425a3c';
      ctx.fillText(String(i + 1), x, y + 4);
    });
    const p = this.game.camera.position;
    this.playerMarker(ctx, mx(p.x), mz(p.z), 1.25);
  }

  /* ------------------------------------------------------------ wildlife dialog */

  updateAnimals(force = false) {
    const pos = this.game.camera.position;
    const list = this.game.wildlife.nearby(pos).slice(0, 12);
    if (!list.length) {
      $('animal-list').textContent = 'No animals are nearby. Try a forest or meadow.';
      $('animal-detail').textContent = 'Life is quieter here.';
      this.animalSignature = '';
      this.detailAnimal = null;
      return;
    }
    if (!list.some((a) => a.id === this.selectedAnimal)) this.selectedAnimal = list[0].id;
    // Rows are rebuilt only when the set of animals changes (not when they swap places),
    // and the row that had the focus gets it back, so a gamepad or keyboard keeps its place.
    const signature = list
      .map((a) => a.id)
      .sort((a, b) => a - b)
      .join(',');
    if (force || this.animalSignature !== signature) {
      this.animalSignature = signature;
      const focused = document.activeElement?.closest?.('[data-animal]')?.dataset.animal;
      $('animal-list').innerHTML = list
        .map((a) => `<button class="animal-row" data-animal="${a.id}"><div><strong>${a.data.name}</strong><span data-state></span></div><small data-distance></small></button>`)
        .join('');
      document.querySelectorAll('[data-animal]').forEach(
        (b) =>
          (b.onclick = () => {
            this.selectedAnimal = Number(b.dataset.animal);
            this.updateAnimals();
          })
      );
      const again = focused !== undefined && document.querySelector(`[data-animal="${focused}"]`);
      if (again && this.source === 'gamepad') this.nav.focus(again);
      else if (again) again.focus({ preventScroll: true });
    }
    for (const a of list) {
      const row = document.querySelector(`[data-animal="${a.id}"]`);
      if (!row) continue;
      row.classList.toggle('active', a.id === this.selectedAnimal);
      row.querySelector('[data-state]').textContent = STATE_LABELS[a.state];
      row.querySelector('[data-distance]').textContent = `${Math.round(Math.hypot(a.x - pos.x, a.z - pos.z))} m`;
    }
    const a = list.find((x) => x.id === this.selectedAnimal);
    const needs = [
      ['Hunger', a.hunger],
      ['Thirst', a.thirst],
      ['Need for rest', a.fatigue],
    ];
    if (this.detailAnimal !== a.id || force) {
      this.detailAnimal = a.id;
      $('animal-detail').innerHTML =
        `<div class="animal-title"><div><h3>${a.data.name}</h3><small id="animal-state"></small></div>${icon('paw')}</div>` +
        needs.map(([label], i) => `<div class="need"><div><span>${label}</span><span id="need-value-${i}"></span></div><div class="need-track"><i id="need-bar-${i}"></i></div></div>`).join('') +
        `<p class="animal-fact">Food: ${a.data.diet}. Lives in: ${a.data.habitat.toLowerCase()}. Finds water at an open bank and sleeps on dry ground.</p><button class="observe-button" id="observe-animal">Observe this animal</button>`;
      $('observe-animal').onclick = () => {
        const target = this.game.wildlife.animals.find((x) => x.id === this.selectedAnimal);
        if (!target) return;
        this.hideDialog($('wildlife-dialog'));
        this.game.observe(target);
        this.toast(`Watching a ${target.data.name.toLowerCase()}.`);
      };
    }
    $('animal-state').textContent = STATE_LABELS[a.state];
    needs.forEach(([, v], i) => {
      $(`need-value-${i}`).textContent = `${Math.round(v * 100)}%`;
      const bar = $(`need-bar-${i}`);
      bar.style.width = `${v * 100}%`;
      bar.style.background = v > 0.8 ? '#b69659' : '#849f60';
    });
  }

  /* ------------------------------------------------------------ photo mode */

  photo(on = !this.photoMode) {
    if (on && (!this.started || this.stack.length)) return;
    this.photoMode = on;
    document.body.classList.toggle('photo-mode', on);
    $('photo-controls').hidden = !on;
    const t = this.kit.touch;
    if (t) {
      t.setShown('capture', on);
      for (const name of ['mode', 'map', 'journal']) t.setShown(name, !on);
      t.setLabel('photo', on ? 'Done' : 'Photo');
    }
    if (on) {
      this.toast(
        this.source === 'touch' ? 'Frame your view, then tap Snap.' : this.source === 'gamepad' ? 'Frame your view. X saves a photo.' : 'Frame your view. Enter saves a photo.'
      );
    }
  }

  async capture() {
    if (this.capturing || !this.photoMode) return;
    this.capturing = true;
    const g = this.game;
    const found = g.animalsInView();
    const p = g.camera.position;
    const ctx = {
      world: g.world,
      night: g.isNight,
      raining: g.rain > 0.5,
      dawn: g.isDawn,
      atRing: Math.hypot(p.x - RING.x, p.z - RING.z) < 60 && p.y < g.world.ringTop() + 60,
    };
    let blob = null;
    let failed = false;
    if (this.savePhotos) {
      try {
        blob = await g.capture();
      } catch {
        failed = true;
      }
    }
    const flash = $('flash');
    flash.classList.add('on');
    setTimeout(() => flash.classList.remove('on'), 40);
    this.ambience.shutter();
    this.input.rumble(0.3, 80);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `verdant-${g.world.seed}-${Date.now()}.png`;
      a.href = url;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    this.journal.countPhoto();
    const news = [];
    for (const e of found) {
      this.journal.add('seen', e.animal.species);
      if (this.journal.add('photographed', e.animal.species)) news.push(`${e.animal.data.name} photographed`);
    }
    for (const c of CHALLENGES) {
      if (this.journal.has('challenges', c.id)) continue;
      const ok = c.group ? c.group(found, ctx) : found.some((e) => c.test(e, ctx));
      if (ok && this.journal.add('challenges', c.id)) news.push(`challenge done: ${c.title}`);
    }
    if (news.length) this.celebrate(`Journal · ${news.join(' · ')}.`);
    else if (failed) this.toast('The photo could not be saved. Try again.');
    else {
      const what = blob ? 'Photo saved' : 'Snap';
      this.toast(found.length ? `${what} · ${found.length} ${found.length === 1 ? 'animal' : 'animals'} in frame.` : `${what}.`);
    }
    this.updateJournalBadge();
    this.capturing = false;
  }

  /* ------------------------------------------------------------ journal */

  checkDiscoveries() {
    if (!this.started) return;
    const g = this.game;
    const p = g.camera.position;
    for (const place of PLACES) {
      if (Math.hypot(place.x - p.x, place.z - p.z) < 70 && this.journal.add('places', place.name)) this.celebrate(`New place in your journal: ${place.name}.`);
    }
    g.camera.getWorldDirection(_fwd);
    for (const a of g.wildlife.animals) {
      if (this.journal.has('seen', a.species)) continue;
      const dx = a.x - p.x;
      const dy = a.y + 1.5 - p.y;
      const dz = a.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > 45 || d < 0.01 || (dx * _fwd.x + dy * _fwd.y + dz * _fwd.z) / d < 0.35) continue;
      if (this.journal.add('seen', a.species)) this.celebrate(`Spotted: ${a.data.name}. Try photographing it.`);
    }
  }

  celebrate(text) {
    this.toast(text);
    this.ambience.chime();
    this.input.rumble(0.2, 120);
    this.updateJournalBadge();
    if ($('journal-dialog').open) this.renderJournal();
    if (this.journal.done === this.journal.total) setTimeout(() => this.toast('Your field journal is complete. Thank you for exploring Verdant.'), 3600);
  }

  updateJournalBadge() {
    this.setText('journal-badge', `${this.journal.done}/${this.journal.total}`);
  }

  renderJournal() {
    const j = this.journal;
    const check = icon('check');
    const placesDone = PLACES.filter((p) => j.has('places', p.name)).length;
    $('journal-places').innerHTML = PLACES.map((p, i) =>
      j.has('places', p.name)
        ? `<li><button class="journal-entry done" data-travel="${i}"><span class="mark">${check}</span><span><strong>${p.name}</strong><small>${p.detail} · travel here</small></span></button></li>`
        : `<li class="journal-entry" data-nav tabindex="-1"><span class="mark">${check}</span><span><strong>${p.name}</strong><small>Not visited yet</small></span></li>`
    ).join('');
    const species = Object.entries(SPECIES);
    let speciesDone = 0;
    $('journal-species').innerHTML = species
      .map(([id, s]) => {
        const seen = j.has('seen', id);
        const shot = j.has('photographed', id);
        speciesDone += (seen ? 1 : 0) + (shot ? 1 : 0);
        return `<li class="journal-entry${seen ? ' done' : ''}" data-nav tabindex="-1"><span class="mark">${check}</span><span><strong>${seen ? s.name : 'Unknown animal'}</strong><small>${s.habitat}</small></span><span class="badges"><i class="${seen ? 'on' : ''}">SEEN</i><i class="${shot ? 'on' : ''}">PHOTO</i></span></li>`;
      })
      .join('');
    let challengesDone = 0;
    $('journal-challenges').innerHTML = CHALLENGES.map((c) => {
      const done = j.has('challenges', c.id);
      if (done) challengesDone++;
      return `<li class="journal-entry${done ? ' done' : ''}" data-nav tabindex="-1"><span class="mark">${check}</span><span><strong>${c.title}</strong><small>${done ? 'In your journal' : c.hint}</small></span></li>`;
    }).join('');
    $('journal-places-count').textContent = `${placesDone}/${PLACES.length}`;
    $('journal-species-count').textContent = `${speciesDone}/${species.length * 2}`;
    $('journal-challenges-count').textContent = `${challengesDone}/${CHALLENGES.length}`;
    $('journal-total').textContent = `${j.done} / ${j.total}`;
    $('journal-photos').textContent = String(j.data.photos);
    document.querySelectorAll('[data-travel]').forEach((b) => (b.onclick = () => this.travel(PLACES[Number(b.dataset.travel)])));
  }

  /* ------------------------------------------------------------ saving */

  loadSave() {
    this.game.setViewDistance(defaultView(this.kit.tier));
    let state = null;
    try {
      state = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    } catch {
      state = null;
    }
    if (state && typeof state === 'object' && state.v === 1) {
      this.game.applyState(state);
      this.hasSave = true;
    }
  }

  save() {
    if (!this.game.ready || !this.started) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.game.getState()));
    } catch {
      /* private mode: nothing to keep */
    }
  }
}
