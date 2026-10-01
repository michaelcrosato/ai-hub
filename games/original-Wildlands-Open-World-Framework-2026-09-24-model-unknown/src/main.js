// Wildlands — an open-world framework: a seeded, streaming landscape of lakes,
// forests, peaks, canyon and marsh to walk and fly across, with a survey to complete.
// Runs on the shared 3D stack: kit/boot.js starts three.js r186 (WebGPU, WebGL2 as
// fallback), sizes the canvas, runs the loop and turns keyboard, mouse, gamepad and
// touch into the actions below. The game only asks about actions.
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { CONFIG, VIEWS, VERSION, DESTINATIONS } from './config.js';
import { WorldGenerator } from './worldgen.js';
import { TerrainSystem, renderOriginFor } from './terrain.js';
import { EnvironmentSystem, WaterSystem, CampSystem } from './environment.js';
import { PlayerSystem } from './player.js';
import { SaveSystem } from './save.js';
import { SurveySystem } from './survey.js';
import { UISystem } from './ui.js';
import { MenuNav } from './nav.js';
import { Sound } from './audio.js';

const kit = await boot({
  title: 'Wildlands',
  // The HUD has its own SETTINGS button; its pause panel opens the kit's graphics panel (F9 too).
  gear: 'none',
  accent: '#ead0a0',
  background: '#1b302f',
  // Fly and Torch pills sit under the WILDLANDS mark, clear of the compass and top-right buttons.
  touch: { top: 'left', topOffset: 78 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    // Bottom-right cluster; the first is the big primary button.
    rise: { keys: ['Space', 'KeyE'], gamepad: ['A', 'RT'], touch: 'Jump' },
    run: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['RB', 'LS'], touch: 'Run' },
    sink: { keys: ['KeyQ', 'KeyC'], gamepad: ['B', 'LT'], touch: 'Down' },
    // Top pills.
    fly: { keys: ['KeyF'], gamepad: ['Y'], touch: { label: 'Fly', slot: 'top' } },
    torch: { keys: ['KeyL'], gamepad: ['X'], touch: { label: 'Torch', slot: 'top' } },
    // Keyboard and gamepad; touch reaches these from the WORLD MAP and SETTINGS buttons.
    map: { keys: ['Tab', 'KeyM'], gamepad: ['Back'] },
    journal: { keys: ['KeyJ'], gamepad: ['LB'] },
    pause: { keys: ['Escape', 'KeyP', 'KeyO'], gamepad: ['Start'] },
    photo: { keys: ['KeyV'] },
    save: { keys: ['KeyK'] },
    home: { keys: ['KeyR'] },
    cycle: { keys: ['KeyT'] },
    // Menus: move steps between controls, confirm activates, back closes.
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});

class EventBus {
  constructor() { this.listeners = new Map(); }
  on(name, fn) {
    if (typeof fn !== 'function') throw new TypeError('The event handler must be a function.');
    const list = this.listeners.get(name) || new Set();
    list.add(fn); this.listeners.set(name, list);
    return () => { list.delete(fn); if (!list.size) this.listeners.delete(name); };
  }
  emit(name, data) {
    for (const fn of [...(this.listeners.get(name) || [])]) {
      try { fn(data); } catch (error) { console.error(`Event handler failed: ${name}`, error); }
    }
  }
  clear() { this.listeners.clear(); }
}

/** The view distance that matches a kit quality tier. */
const viewForTier = (tier) => (VIEWS[tier.name] ? tier.name : 'high');

class WorldApp {
  constructor() {
    this.kit = kit;
    this.events = new EventBus(); this.save = new SaveSystem(this.events); this.saved = this.save.read(); this.returning = !!this.saved;
    this.started = false; this.disposed = false; this.plugins = new Map(); this.origin = { x: 0, z: 0 };
    this.elapsed = 0; this.accumulator = 0; this.lastSave = 0; this.fps = 60; this.hudClock = 0;
    this.arriving = 0; this.suppressRise = false; this.wasLocked = false;
    const prefs = this.save.readPrefs();
    this.viewChosen = !!(this.saved?.quality || VIEWS[prefs.view]);
    this.viewName = this.saved?.quality || (VIEWS[prefs.view] ? prefs.view : viewForTier(kit.tier));
    this.view = VIEWS[this.viewName];
    this.mouseScale = Number.isFinite(prefs.mouseScale) ? Math.max(0.2, Math.min(1.7, prefs.mouseScale)) : 0.0019 / 0.0024;
    this.sound = new Sound();
    if (prefs.sound === false) this.sound.setEnabled(false);
    if (Number.isFinite(prefs.volume)) this.sound.setVolume(prefs.volume);
    this.generator = new WorldGenerator(this.saved?.seed || CONFIG.seed);

    const r = kit.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    kit.canvas.setAttribute('aria-label', 'Wildlands 3D world');

    this.scene = new THREE.Scene();
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(CONFIG.fov, 1, 0.2, this.view.distance * 1.3 + 2500));
    this.environment = new EnvironmentSystem(kit, this.scene, this.camera, this.view);
    this.terrain = new TerrainSystem(this.scene, this.generator, this.view, this.events);
    this.water = new WaterSystem(this.scene);
    this.camp = new CampSystem(kit, this.scene, this.generator, this.terrain.material);
    this.player = new PlayerSystem(this.camera, this.terrain, this.generator, this.events, CONFIG);
    if (Number.isFinite(prefs.speed)) this.player.speedScale = Math.max(0.5, Math.min(3, prefs.speed));
    this.survey = new SurveySystem(this, this.terrain.material);
    // The per-seed survey store is written on every discovery, so it is the freshest copy.
    this.survey.load(this.save.readSurvey(this.generator.seedText) || this.saved?.survey || null);
    if (this.saved) {
      this.player.teleport(this.saved.player); this.player.mode = this.saved.player.mode; this.player.travelled = this.saved.player.travelled || 0;
      this.environment.hours = this.saved.hours; this.environment.cycle = !!this.saved.cycle;
    }
    this.here = this.generator.sample(this.player.position.x, this.player.position.z);
    this.rebase(true);
    this.nav = new MenuNav(kit.input);
    // The title screen has its own buttons; the on-screen stick and buttons wait for play.
    kit.touch?.suspend(true, 'title');
    this.ui = new UISystem(this);
    this.ctl = { x: 0, y: 0, rise: false, sink: false, run: false };
    this.wireEvents();
    this.terrain.plan(this.player.position.x, this.player.position.z, true);

    // Extension contract: a plugin can implement init(context), update(dt, context), dispose().
    // World coordinates are absolute. Listen for world:origin when you add scene objects.
    window.Wildlands = Object.freeze({
      version: VERSION, app: this, THREE, kit, config: CONFIG, events: this.events,
      systems: { terrain: this.terrain, environment: this.environment, water: this.water, camp: this.camp, player: this.player, survey: this.survey },
      addSystem: (name, system) => this.addSystem(name, system), removeSystem: (name) => this.removeSystem(name),
      sampleTerrain: (x, z) => this.generator.sample(x, z), teleport: (target) => this.teleport(target),
      setTime: (hours) => { if (!Number.isFinite(hours)) throw new TypeError('Time must be a number.'); this.environment.hours = ((hours % 24) + 24) % 24; },
      setSeed: (seed) => this.setSeed(seed), setQuality: (name) => this.setView(name, true), setView: (name) => this.setView(name, true),
      getStatus: () => ({ version: VERSION, seed: this.generator.seedText, position: this.player.snapshot(), origin: { ...this.origin }, view: this.viewName, ...this.terrain.stats, survey: this.survey.toJSON(), drawCalls: kit.renderer.info.render.calls, triangles: kit.renderer.info.render.triangles, fps: this.fps, backend: kit.backend }),
      dispose: () => this.dispose(),
    });
    this.events.emit('world:ready', { seed: this.generator.seedText });
  }
  get playing() { return this.started && !this.ui.menu; }
  wireEvents() {
    const kit = this.kit, ev = this.events;
    this.abort = new AbortController(); const opts = { signal: this.abort.signal };
    kit.onResize(() => this.environment.refreshCascades());
    kit.onQuality((tier) => {
      // The view distance follows the tier until the player picks one.
      if (!this.viewChosen && viewForTier(tier) !== this.viewName) this.setView(viewForTier(tier), false);
    });
    kit.onPause((paused) => this.sound.hold('kit', paused));
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === kit.canvas;
      // Esc while the mouse is captured goes to the browser: losing the capture pauses.
      if (this.wasLocked && !locked && this.playing) this.ui.open('settings');
      this.wasLocked = locked;
      this.ui.updateResumeHint();
    }, opts);
    let lockHint = 0;
    document.addEventListener('pointerlockerror', () => {
      clearTimeout(lockHint);
      // The kit retries a refused capture without raw input; only speak up if none arrived.
      lockHint = setTimeout(() => { if (this.playing && !document.pointerLockElement) this.ui.notice('Mouse capture is blocked. Hold a mouse button and drag to look.'); }, 400);
    }, opts);
    kit.canvas.addEventListener('pointerdown', (e) => { if (this.playing && e.pointerType === 'mouse' && !document.pointerLockElement) kit.input.lockPointer(); }, opts);
    document.addEventListener('visibilitychange', () => {
      this.sound.hold('hidden', document.hidden);
      if (document.hidden) { this.accumulator = 0; if (this.playing) this.ui.open('settings'); if (this.started) this.saveAll(); }
    }, opts);
    window.addEventListener('pagehide', () => { if (this.started) this.saveAll(); }, opts);
    ev.on('player:land', (s) => { this.sound.thump(s); kit.input.rumble(0.25 + s * 0.4, 90); });
    ev.on('player:step', (swim) => this.sound.step(swim ? 'water' : this.player.position.y > 820 ? 'snow' : 'ground'));
    ev.on('player:jump', (swim) => { if (swim) this.sound.step('water'); });
    ev.on('survey:found', ({ site, count, total }) => {
      this.ui.notice(`Survey post recorded: ${site.def.name}. ${count} of ${total}.`, 5000);
      this.sound.chime([660, 880, 1320]); kit.input.rumble(0.5, 200);
      this.saveSurvey();
    });
    ev.on('survey:biome', ({ name, count, total }) => {
      if (count > 1) { this.ui.notice(`New landscape: ${name}. ${count} of ${total} explored.`); this.sound.chime([523, 784], 0.14, 0.06); }
      this.saveSurvey();
    });
    ev.on('survey:complete', () => {
      this.sound.chime([523, 659, 784, 1046], 0.16, 0.1); kit.input.rumble(0.7, 400);
      this.saveSurvey();
      // The results: the journal opens on its completion banner once the chime has played.
      setTimeout(() => { if (this.playing) this.ui.open('journal'); }, 1400);
    });
  }
  /** Ask for mouse capture (mouse players only; a gamepad or touch never needs it). */
  capture() {
    if (!this.playing || this.kit.input.source !== 'keyboard' || document.pointerLockElement) return;
    this.kit.input.lockPointer();
  }
  /** After any menu closes: the press that closed it must not also jump or climb. */
  afterMenu() {
    this.kit.input.settle();
    this.player.jumpHeld = true;
    this.suppressRise = true;
  }
  start(destination = null) {
    if (this.started || !this.terrain.readyNear) return;
    if (destination) this.teleport(destination, false);
    this.started = true;
    document.getElementById('welcome').classList.add('hide');
    this.kit.touch?.suspend(false, 'title');
    this.afterMenu();
    this.capture();
    this.sound.start();
    this.ui.updateResumeHint();
    this.terrain.budget = { count: 4, ms: 4 };
    this.events.emit('player:start', this.player.snapshot());
  }
  toggleFlight() {
    this.player.toggleFlight(); this.ui.modeNotice(); this.sound.click(); this.kit.input.rumble(0.15, 40);
  }
  toggleTorch() {
    this.environment.torchOn = !this.environment.torchOn; this.ui.updateTorch(); this.sound.click();
    this.ui.notice(this.environment.torchOn ? 'Torch on.' : 'Torch off.');
  }
  rebase(force = false) {
    const p = this.player.position;
    if (!force && Math.hypot(p.x - this.origin.x, p.z - this.origin.z) < CONFIG.rebaseDistance) return;
    const old = { ...this.origin }; this.origin = renderOriginFor(p.x, p.z);
    this.terrain.setOrigin(this.origin.x, this.origin.z); this.camp.setOrigin(this.origin); this.survey.setOrigin(this.origin);
    this.player.renderCamera(this.origin); this.environment.updateClouds(this.origin);
    this.events.emit('world:origin', { origin: { ...this.origin }, delta: { x: this.origin.x - old.x, z: this.origin.z - old.z } });
  }
  /** Change the view distance. chosen: the player picked it (remembered, and no longer follows the tier). */
  setView(name, chosen) {
    if (!VIEWS[name]) throw new Error('Unknown view distance.');
    if (chosen) this.viewChosen = true;
    this.viewName = name; this.view = VIEWS[name];
    this.camera.far = this.view.distance * 1.3 + 2500; this.camera.updateProjectionMatrix();
    this.environment.setView(this.view); this.terrain.setView(this.view); this.terrain.plan(this.player.position.x, this.player.position.z, true);
    if (this.ui) { this.ui.$('view').value = name; if (chosen) this.ui.notice(`${this.view.label} view distance: ${this.view.distance / 1000} km.`); }
    if (chosen) this.savePrefs();
    this.events.emit('world:quality', name);
  }
  setSeed(seed) {
    if (typeof seed !== 'string' || !seed.trim() || seed.length > 64) throw new TypeError('Use a world seed from 1 to 64 characters.');
    this.saveSurvey();
    this.generator = new WorldGenerator(seed.trim()); this.terrain.reset(this.generator); this.player.generator = this.generator; this.camp.reset(this.generator);
    this.survey.reset(this.generator, this.save.readSurvey(this.generator.seedText));
    this.player.mode = 'walk'; this.player.travelled = 0; this.player.teleport(CONFIG.start); this.rebase(true); this.terrain.plan(this.player.position.x, this.player.position.z, true);
    this.arriving = Math.max(this.elapsed, 0.001);
    this.ui?.resetMaps(); this.events.emit('world:seed', { seed: this.generator.seedText }); this.ui?.notice('New world loaded.');
  }
  teleport(target, announce = true) {
    if (typeof target === 'string') { const d = DESTINATIONS.find((dd) => dd.name.toLowerCase() === target.toLowerCase()); if (!d) throw new Error('Unknown travel point.'); target = d; }
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.z)) throw new TypeError('Travel needs finite x and z coordinates.');
    if (Math.abs(target.x) > 1e9 || Math.abs(target.z) > 1e9) throw new RangeError('Use coordinates between -1 billion and +1 billion metres.');
    this.player.teleport(target); this.rebase(true); this.terrain.initial = true; this.terrain.plan(target.x, target.z, true);
    // Hold still until the ground around the arrival point has streamed in.
    this.arriving = Math.max(this.elapsed, 0.001);
    if (announce) this.ui?.notice(target.name ? `Now exploring: ${target.name}.` : 'Position updated.');
  }
  restore(data) {
    const s = this.save.validate(data);
    if (s.quality && s.quality !== this.viewName) this.setView(s.quality, true);
    if (s.seed !== this.generator.seedText) this.setSeed(s.seed);
    if (s.survey) this.survey.load(s.survey);
    this.player.teleport(s.player); this.player.mode = s.player.mode; this.player.travelled = s.player.travelled || 0;
    this.environment.hours = s.hours; this.environment.cycle = !!s.cycle;
    this.rebase(true); this.terrain.initial = true; this.terrain.plan(s.player.x, s.player.z, true); this.arriving = Math.max(this.elapsed, 0.001);
    this.ui.updateMode(); this.saveAll();
  }
  saveSurvey() { this.save.writeSurvey(this.generator.seedText, this.survey.toJSON()); }
  saveAll() { this.save.write(this, true); }
  savePrefs() {
    this.save.writePrefs({ view: this.viewChosen ? this.viewName : undefined, mouseScale: this.mouseScale, speed: this.player.speedScale, sound: this.sound.enabled, volume: this.sound.volume });
  }
  addSystem(name, system) {
    if (typeof name !== 'string' || !name || !system || typeof system !== 'object') throw new TypeError('A system needs a name and an object.');
    if (this.plugins.has(name)) throw new Error(`A system named ${name} already exists.`);
    const context = { app: this, THREE, kit: this.kit, events: this.events, scene: this.scene, camera: this.camera, origin: this.origin };
    system.init?.(context); this.plugins.set(name, system); return () => this.removeSystem(name);
  }
  removeSystem(name) { const s = this.plugins.get(name); if (!s) return; try { s.dispose?.(); } finally { this.plugins.delete(name); } }
  /** Read the actions: menus first, then the toggles, then movement for the fixed steps. */
  handleInput() {
    const input = this.kit.input, ui = this.ui;
    if (!this.started) { this.nav.update(document.getElementById('welcome')); return false; }
    if (ui.menu) {
      if (input.pressed('pause') || input.pressed('back')) ui.close(false);
      else if (input.pressed('journal')) { if (ui.menu === 'journal') ui.close(false); else ui.open('journal'); }
      else if (input.pressed('map') && !input.keys.has('Tab')) { if (ui.menu === 'map') ui.close(false); else ui.open('map'); }
      else this.nav.update(ui.root);
      return false;
    }
    this.nav.update(null);
    if (ui.hidden && (input.pressed('photo') || input.pressed('pause') || (input.pointer.justDown && input.pointer.type === 'touch'))) { ui.togglePhoto(); return true; }
    if (input.pressed('pause')) { ui.open('settings'); return false; }
    if (input.pressed('map')) { ui.open('map'); return false; }
    if (input.pressed('journal')) { ui.open('journal'); return false; }
    if (input.pressed('photo')) ui.togglePhoto();
    if (input.pressed('fly')) this.toggleFlight();
    if (input.pressed('torch')) this.toggleTorch();
    if (input.pressed('save')) this.save.write(this);
    if (input.pressed('home')) this.teleport(DESTINATIONS[0]);
    if (input.pressed('cycle')) { this.environment.cycle = !this.environment.cycle; this.ui.notice(this.environment.cycle ? 'Day and night cycle on.' : 'Time of day is fixed.'); }
    return true;
  }
  frame(dt) {
    if (this.disposed) return;
    const input = this.kit.input;
    this.elapsed += dt;
    if (dt > 0) this.fps += ((1 / dt) - this.fps) * 0.05;
    const playing = this.handleInput() && this.playing;
    // After travel, wait for the land under the arrival point (at most eight seconds).
    if (this.arriving && (this.terrain.readyNear || this.elapsed - this.arriving > 8)) this.arriving = 0;
    this.player.active = playing && !document.hidden && !this.arriving;
    if (this.player.active) {
      // The game's own sensitivity slider is for the mouse; sticks and touch use the kit's.
      this.player.lookScale = input.source === 'keyboard' ? this.mouseScale : 1;
      const look = input.look('look');
      this.player.look(look.x, look.y);
      const mv = input.vector('move');
      if (this.suppressRise && !input.down('rise')) this.suppressRise = false;
      const ctl = this.ctl;
      ctl.x = mv.x; ctl.y = mv.y; ctl.rise = input.down('rise') && !this.suppressRise; ctl.sink = input.down('sink'); ctl.run = input.down('run');
    }
    this.accumulator += this.player.active ? dt : 0; let steps = 0;
    while (this.accumulator >= CONFIG.fixedStep && steps < 5) { this.player.step(CONFIG.fixedStep, this.ctl); this.accumulator -= CONFIG.fixedStep; steps++; }
    if (steps === 5) this.accumulator = 0;
    // Flight widens the view a little at full speed.
    const fovTarget = this.player.mode === 'fly' && this.player.active && this.ctl.run && (this.ctl.x || this.ctl.y) ? CONFIG.flyFov : CONFIG.fov;
    const fov = this.camera.fov + (fovTarget - this.camera.fov) * (1 - Math.exp(-3 * dt));
    if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); this.environment.refreshCascades(); }

    this.rebase(); this.player.renderCamera(this.origin);
    this.terrain.plan(this.player.position.x, this.player.position.z); this.terrain.update();
    this.environment.update(dt, this.origin); this.water.update(dt, this.camera, this.origin); this.camp.update(dt, this.player.position);
    this.survey.update(dt, this.player.active);
    this.hudClock += dt;
    if (this.hudClock > 0.12) {
      this.hudClock = 0;
      const p = this.player.position;
      this.here = this.generator.sample(p.x, p.z);
      if (this.player.active) this.survey.noteBiome(this.here.biome);
    }
    for (const [name, system] of this.plugins) {
      try { system.update?.(dt, { app: this, THREE, origin: this.origin }); }
      catch (error) { console.error(`System ${name} stopped.`, error); this.removeSystem(name); this.events.emit('error', { message: `The ${name} extension stopped after an error.` }); }
    }
    this.kit.renderer.render(this.scene, this.camera);
    this.ui.update(this.elapsed, this.fps);
    const v = this.player.velocity;
    this.sound.update(dt, {
      speed: this.player.active ? Math.hypot(v.x, v.y, v.z) : 0,
      height: this.player.position.y - this.terrain.groundHeight(this.player.position.x, this.player.position.z),
      swimming: this.player.swimming, campDistance: this.camp.distanceTo(this.player.position), paused: !playing,
    });
    if (this.started && this.elapsed - this.lastSave > 25) { this.lastSave = this.elapsed; this.saveAll(); }
  }
  dispose() {
    if (this.disposed) return; this.disposed = true; this.kit.stop();
    if (this.started) this.saveAll();
    this.abort.abort(); for (const name of [...this.plugins.keys()]) this.removeSystem(name);
    this.ui.dispose(); this.terrain.dispose(); this.camp.dispose(); this.water.dispose(); this.environment.dispose(); this.survey.dispose(); this.events.clear();
  }
}

function fatal(title, detail) {
  try { document.exitPointerLock?.(); } catch { /* not locked */ }
  document.getElementById('fatal-title').textContent = title;
  document.getElementById('fatal-detail').textContent = String(detail || '');
  document.getElementById('fatal').hidden = false;
}
document.getElementById('fatal-retry').addEventListener('click', () => location.reload());

try {
  const app = new WorldApp();
  kit.start((dt) => app.frame(dt));
} catch (error) {
  console.error(error);
  fatal('The world could not start.', `${error.message}\n${error.stack || ''}`);
}
