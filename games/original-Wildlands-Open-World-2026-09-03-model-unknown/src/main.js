// Wildlands — an open world of forests, mountains, rivers and plains, on the
// shared 3D stack (three.js r186 via kit/boot.js: WebGPU, WebGL2 as fallback).
//
// The kit starts the renderer, sizes the canvas, runs the loop and turns
// keyboard, mouse, gamepad and touch into the actions below; the game only
// asks about actions.
import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { CONFIG, VIEW, LOCATIONS, VERSION, TerrainField, clamp } from './terrain.js';
import { World, terrainMaterial, propMaterial } from './world.js';
import { Lighting } from './sky.js';
import { Water } from './water.js';
import { Player } from './player.js';
import { Quests } from './quests.js';
import { UI } from './ui.js';
import { MenuNav } from './nav.js';
import { Sound } from './audio.js';

const kit = await boot({
  title: 'Wildlands',
  // The HUD has its own settings button (top right), and World settings and the
  // pause menu both open the kit's graphics panel; F9 still works.
  gear: 'none',
  // The loading card stays up until the land around the start has streamed in.
  holdLoading: true,
  accent: '#e5efb3',
  background: '#172f30',
  // Top pills sit under the clock and settings button, clear of the compass.
  touch: { top: 'right', topOffset: 76 },
  input: {
    move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
    look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
    // Cluster buttons; the first is the big primary one.
    up: { keys: ['Space', 'KeyE'], gamepad: ['A', 'RT'], touch: 'Up' },
    down: { keys: ['KeyQ', 'KeyC'], gamepad: ['B', 'LT'], touch: 'Down' },
    fast: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS', 'RB'], touch: 'Fast' },
    mode: { keys: ['KeyF'], gamepad: ['Y'], touch: 'Walk' },
    // Top pills.
    pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: { label: 'II', slot: 'top' } },
    map: { keys: ['KeyM'], gamepad: ['Back'], touch: { label: 'Map', slot: 'top' } },
    lantern: { keys: ['KeyL'], gamepad: ['X'], touch: { label: 'Lamp', slot: 'top' } },
    // Keyboard and gamepad only (touch reaches these from the pause menu).
    journal: { keys: ['KeyJ'], gamepad: ['LB'] },
    settings: { keys: ['KeyO'] },
    photo: { keys: ['KeyV'] },
    hud: { keys: ['KeyH'] },
    // Menus: move steps between controls, confirm activates, back closes.
    confirm: { keys: ['Enter', 'NumpadEnter'], gamepad: ['A'] },
    back: { keys: ['Backspace'], gamepad: ['B'] },
  },
});

class Events {
  constructor() {
    this.listeners = new Map();
  }
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.listeners.get(name)?.delete(fn);
  }
  emit(name, value) {
    for (const fn of this.listeners.get(name) || []) fn(value);
  }
  clear() {
    this.listeners.clear();
  }
}

/** The saved position and preferences, validated (anything odd falls back to defaults). */
function readSave() {
  try {
    const r = JSON.parse(localStorage.getItem(CONFIG.saveKey));
    if (!r || r.version !== 1) return null;
    const p = r.position;
    if (!p || ![p.x, p.y, p.z, r.yaw, r.pitch].every(Number.isFinite)) return null;
    if (Math.abs(p.x) > CONFIG.maxCoordinate || Math.abs(p.z) > CONFIG.maxCoordinate || p.y < -100 || p.y > 14000) return null;
    if (typeof r.seed !== 'string' || !r.seed.trim() || r.seed.length > 64) return null;
    return {
      version: 1,
      seed: r.seed,
      position: { x: p.x, y: p.y, z: p.z },
      yaw: r.yaw % (2 * Math.PI),
      pitch: clamp(r.pitch, -1.49, 1.49),
      mode: r.mode === 'walk' ? 'walk' : 'fly',
      quality: Object.hasOwn(VIEW, r.quality) ? r.quality : null,
      hours: Number.isFinite(r.hours) ? ((r.hours % 24) + 24) % 24 : 16.8,
      cycle: r.cycle === true,
      haze: r.haze !== false,
      speed: Number.isFinite(r.speed) ? clamp(r.speed, 0.25, 4) : 1,
      sound: r.sound !== false,
      showStats: r.showStats === true,
    };
  } catch {
    return null;
  }
}

const UNDERWATER_FOG = new THREE.Color('#216768');

class Game {
  constructor(kit) {
    this.kit = kit;
    this.events = new Events();
    this.systems = new Map();
    this.started = false;
    this.ready = false;
    this.failed = false;
    this.playing = false;
    this.origin = new THREE.Vector3();
    this.haze = true;
    this.fps = 60;
    this.accumulator = 0;
    this.streamingPaused = false;
    this.underwater = false;
    this.loadTime = 0;
    this.uiTimer = 0;
    this.saveTimer = 0;
    this.autoResume = false;
    this.holdRise = false;
    this.arrival = null;
    this.pausedAt = 0;
    this.cascadeFov = 66;

    const saved = readSave();
    // A saved position means the title screen offers to resume (and shows the journal so far).
    this.returning = !!saved;
    const tier = kit.tier.name;
    this.viewName = saved?.quality || (tier === 'low' || tier === 'medium' ? 'performance' : tier === 'ultra' ? 'high' : 'balanced');
    this.view = VIEW[this.viewName];
    this.showStats = saved?.showStats ?? false;
    this.sound = new Sound();
    if (saved && !saved.sound) this.sound.setEnabled(false);
    this.field = new TerrainField(saved?.seed || CONFIG.seed);

    const r = kit.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.13;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    kit.canvas.setAttribute('aria-label', 'Open world. Select Enter world to begin.');

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#c6d8cd', 3000, this.view.distance);
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(66, 1, 0.25, this.view.distance * 1.5));
    this.lighting = new Lighting(this);
    this.water = new Water(this);
    this.world = new World(this);
    this.player = new Player(this);
    this.quests = new Quests(this);
    if (saved) {
      this.player.position.set(saved.position.x, Math.max(saved.position.y, this.field.ground(saved.position.x, saved.position.z) + CONFIG.eyeHeight), saved.position.z);
      this.player.yaw = saved.yaw;
      this.player.pitch = saved.pitch;
      this.player.mode = saved.mode;
      this.player.speedMultiplier = saved.speed;
      this.lighting.hours = saved.hours;
      this.lighting.cycle = saved.cycle;
      this.haze = saved.haze;
    }
    this.quests.knowStart();
    this.player.syncCamera();
    this.world.plan(this.player.position, true);
    this.ui = new UI(this);
    this.nav = new MenuNav(kit.input);
    this.ctl = { x: 0, y: 0, rise: 0, fast: false, jump: false };
    this.prev = new THREE.Vector3();

    kit.onResize(() => this.lighting.refreshCascades());
    // The prop distance follows the quality tier's draw distance.
    kit.onQuality(() => this.world.plan(this.player.position, true));
    kit.onPause((paused) => this.sound.hold('kit', paused));
    this.events.on('error', (e) => console.error(`Wildlands ${e.system}: ${e.message}`));

    let locked = false;
    document.addEventListener('pointerlockchange', () => {
      const now = document.pointerLockElement === kit.canvas;
      // Esc while the mouse is captured goes to the browser: treat losing the lock as pause.
      if (locked && !now && this.playing) this.pause();
      locked = now;
    });
    // The kit retries a refused lock without raw input, so only speak up if no lock arrived at all.
    let lockHint = 0;
    document.addEventListener('pointerlockerror', () => {
      clearTimeout(lockHint);
      lockHint = setTimeout(() => {
        if (this.playing && !document.pointerLockElement) this.ui.notice('Hold a mouse button and drag to look around.');
      }, 400);
    });
    kit.canvas.addEventListener('pointerdown', (e) => {
      if (this.playing && e.pointerType === 'mouse' && !document.pointerLockElement) kit.input.lockPointer();
    });
    addEventListener('blur', () => {
      if (this.playing) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      this.sound.hold('hidden', document.hidden);
      if (document.hidden) {
        if (this.playing) this.pause();
        this.save(false);
      }
    });
    addEventListener('pagehide', () => this.save(false));
    this.ui.state(false);
    this.sound.hold('pause', true);
  }

  /** Tree and rock distance: the view preset, scaled by the kit's draw distance for the tier. */
  get treeDistance() {
    return this.view.trees * this.kit.tier.drawDistance;
  }

  /** Build the pipelines for tiles and props before the first ones stream in, so they do not hitch. */
  async prepare() {
    const warm = new THREE.Group();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 0, 1, 1, 0, 0]), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(0.5), 3));
    const tile = new THREE.Mesh(g, terrainMaterial);
    const prop = new THREE.InstancedMesh(this.world.vegetation.geometries.pine, propMaterial, 1);
    prop.setMatrixAt(0, new THREE.Matrix4());
    prop.setColorAt(0, new THREE.Color(1, 1, 1));
    for (const o of [tile, prop]) {
      o.castShadow = o.receiveShadow = true;
      o.frustumCulled = false;
      warm.add(o);
    }
    this.camera.getWorldDirection(this.prev);
    warm.position.copy(this.camera.position).addScaledVector(this.prev, 30);
    this.scene.add(warm);
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* only an optimisation */
    }
    this.scene.remove(warm);
    g.dispose();
    prop.dispose();
  }

  resume(gesture = false) {
    if (!this.ready || this.failed) return;
    this.ui.closeAll();
    this.started = true;
    this.playing = true;
    this.autoResume = false;
    this.accumulator = 0;
    this.player.wasJump = true;
    this.holdRise = true;
    this.kit.input.settle();
    this.sound.hold('pause', false);
    this.ui.state(true);
    document.activeElement?.blur?.();
    try {
      this.kit.canvas.focus({ preventScroll: true });
    } catch {
      /* focus is a nicety */
    }
    if (this.kit.input.source === 'keyboard') {
      if (gesture) this.kit.input.lockPointer();
      else if (!document.pointerLockElement) this.ui.notice('Click the world to look around with the mouse.');
    }
  }

  pause() {
    if (this.playing) {
      this.playing = false;
      this.pausedAt = performance.now();
      this.accumulator = 0;
      Object.assign(this.ctl, { x: 0, y: 0, rise: 0, fast: false, jump: false });
      this.kit.input.settle();
      this.kit.input.unlockPointer();
      this.sound.hold('pause', true);
      this.save(false);
    }
    this.ui.state(false);
  }

  toggleMode() {
    const player = this.player;
    const toFly = player.mode !== 'fly';
    // Trials are flown: landing ends one.
    const abandoned = !toFly && this.quests.trialActive;
    if (abandoned) this.quests.abortTrial(null);
    player.setMode(toFly ? 'fly' : 'walk');
    this.sound.play('toggle');
    const src = this.kit.input.source;
    const hints = {
      keyboard: ['Flight mode. E goes up, Q goes down.', 'Walk mode. Space to jump.'],
      gamepad: ['Flight mode. A or RT goes up, B or LT goes down.', 'Walk mode. A to jump.'],
      touch: ['Flight mode. Up and Down are on the right.', 'Walk mode. Up to jump.'],
    }[src] || ['Flight mode.', 'Walk mode.'];
    this.ui.notice(toFly ? hints[0] : abandoned ? `${hints[1]} Sky trial abandoned.` : hints[1]);
  }

  toggleLantern() {
    const on = !this.lighting.lanternEnabled;
    this.lighting.lanternEnabled = on;
    this.ui.lanternChanged(on);
    this.sound.play('toggle');
  }

  /** Go somewhere: pause while the land streams in, then carry on automatically. */
  travel(t) {
    if (!t.keepTrial && this.quests.trialActive) this.quests.abortTrial('Trial abandoned.');
    this.pause();
    this.player.teleport(t.x, t.z, {
      altitude: t.altitude ?? 90,
      yaw: Number.isFinite(t.yaw) ? t.yaw : this.player.yaw,
      pitch: Number.isFinite(t.pitch) ? t.pitch : -0.14,
      y: Number.isFinite(t.y) ? t.y : null,
    });
    this.ready = false;
    this.loadTime = 0;
    this.autoResume = this.started;
    this.arrival = t.keepTrial ? null : t.name || null;
    this.ui.update();
    this.ui.state(false);
  }

  resetSeed(seed) {
    if (typeof seed !== 'string' || !seed.trim() || seed.length > 64) throw new Error('Use a seed with 1 to 64 characters.');
    this.quests.abortTrial(null);
    this.pause();
    this.world.dispose();
    this.field = new TerrainField(seed.trim());
    this.world = new World(this);
    this.quests.rebuild(this.field);
    this.quests.knowStart();
    if (this.player.mode !== 'fly') this.player.setMode('fly');
    this.travel({ ...LOCATIONS[0] });
    this.events.emit('world:reset', { seed: this.field.seed });
  }

  setView(name) {
    if (!Object.hasOwn(VIEW, name)) return;
    this.viewName = name;
    this.view = VIEW[name];
    this.camera.far = this.view.distance * 1.5;
    this.camera.updateProjectionMatrix();
    this.lighting.setView(this.view);
    this.world.plan(this.player.position, true);
    this.ui.syncSettings();
  }

  /** Read this frame's controls and route menu keys. */
  handleInput() {
    const input = this.kit.input;
    const ui = this.ui;
    const dialog = ui.topDialog();
    if (dialog) {
      this.nav.update(dialog);
      const id = dialog.id;
      if (
        input.pressed('back') ||
        input.pressed('pause') ||
        (input.pressed('map') && id === 'map-dialog') ||
        (input.pressed('journal') && id === 'journal-dialog') ||
        (input.pressed('settings') && id === 'settings')
      ) {
        dialog.close();
      }
      return;
    }
    if (!this.playing) {
      const entry = document.getElementById('entry');
      this.nav.update(entry.hidden ? null : entry);
      // A lost pointer lock pauses; the Esc that caused it must not resume at once.
      const settled = performance.now() - this.pausedAt > 350;
      if ((input.pressed('pause') || input.pressed('back')) && settled) {
        if (this.started) this.resume(false);
      } else if (this.started) {
        if (input.pressed('map')) ui.open('map-dialog');
        else if (input.pressed('journal')) ui.open('journal-dialog');
        else if (input.pressed('settings')) ui.open('settings');
      }
      return;
    }
    this.nav.update(null);
    if (input.pressed('pause')) return this.pause();
    if (input.pressed('map')) return ui.open('map-dialog');
    if (input.pressed('journal')) return ui.open('journal-dialog');
    if (input.pressed('settings')) return ui.open('settings');
    if (input.pressed('mode')) this.toggleMode();
    if (input.pressed('lantern')) this.toggleLantern();
    if (input.pressed('photo')) this.capture();
    if (input.pressed('hud')) document.body.classList.toggle('hud-hidden');

    const look = input.look('look');
    this.player.yaw -= look.x;
    this.player.pitch = clamp(this.player.pitch - look.y, -1.49, 1.49);
    const mv = input.vector('move');
    const ctl = this.ctl;
    ctl.x = mv.x;
    ctl.y = mv.y;
    let rise = input.value('up') - input.value('down');
    // The A / Enter press that closed a menu is still held for a moment: do not climb on it.
    if (this.holdRise) {
      if (input.down('up') || input.down('down')) rise = 0;
      else this.holdRise = false;
    }
    ctl.rise = rise;
    ctl.fast = input.down('fast');
    ctl.jump = input.down('up');
  }

  frame(dt) {
    if (this.failed) return;
    const player = this.player;
    this.fps += (Math.min(180, 1 / Math.max(dt, 1e-3)) - this.fps) * 0.05;
    this.handleInput();

    if (this.playing) {
      const step = CONFIG.fixedStep;
      this.accumulator = Math.min(this.accumulator + dt, step * CONFIG.maxSubsteps);
      while (this.accumulator >= step) {
        this.prev.copy(player.position);
        player.update(step, this.ctl);
        this.quests.step(this.prev, player.position);
        this.accumulator -= step;
      }
      if (player.impact > 0) {
        const hard = Math.min(1, player.impact / 25);
        this.kit.input.rumble(hard, 110);
        this.sound.play('land', hard);
        player.impact = 0;
      }
    }
    player.syncCamera();
    this.world.update(player.position);

    if (!this.ready) {
      this.loadTime += dt;
      if ((this.ui.firstReady || this.world.stats.queued === 0) && this.world.isReady(player.position)) {
        this.ready = true;
        this.ui.ready();
        if (this.autoResume && !this.ui.topDialog() && !this.kit.menu.isOpen) {
          this.resume(false);
          if (this.arrival) this.ui.notice(`Arrived at ${this.arrival}.`);
        }
        this.autoResume = false;
      } else if (this.loadTime > 60) {
        this.fail('Terrain could not finish loading. Select Try again to restart the world.');
        return;
      }
    }

    this.underwater = player.position.y < CONFIG.waterLevel - 0.25;
    if (this.underwater) {
      this.scene.fog.color.copy(UNDERWATER_FOG);
      this.scene.fog.near = 1;
      this.scene.fog.far = 100;
    }
    this.lighting.update(this.playing ? dt : 0);
    this.water.update(dt);
    this.quests.update(dt, this.playing);
    if (this.playing) {
      for (const [name, system] of this.systems) {
        try {
          system.update?.(dt, this);
        } catch (err) {
          console.error(`Wildlands extension ${name}:`, err);
          this.removeSystem(name);
          this.ui.notice(`The ${name} system stopped after an error.`);
        }
      }
    }

    // A wider view while boosting in flight.
    const boosting = this.playing && player.mode === 'fly' && this.ctl.fast && player.moving > 150;
    const fov = 66 + (boosting ? 8 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-dt * 4));
      this.camera.updateProjectionMatrix();
      if (Math.abs(this.camera.fov - this.cascadeFov) > 1 || Math.abs(this.camera.fov - fov) <= 0.01) {
        this.cascadeFov = this.camera.fov;
        this.lighting.refreshCascades();
      }
    }

    const fly = player.mode === 'fly';
    const level = this.underwater
      ? 0.05
      : fly
        ? Math.min(1, player.moving / 400) * 0.8 + Math.min(1, Math.max(0, player.position.y - 200) / 1500) * 0.2
        : 0.1 + Math.min(1, player.moving / CONFIG.runSpeed) * 0.2;
    this.sound.wind(this.playing ? level : level * 0.5, this.underwater ? 0 : fly ? 0.3 + Math.min(1, player.moving / 450) * 0.6 : 0.2);

    this.kit.renderer.render(this.scene, this.camera);
    this.ui.frame(dt);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.2;
      this.ui.update();
    }
    if (this.playing) {
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        this.save(false);
      }
    }
  }

  serialize() {
    const p = this.player.position;
    return {
      version: 1,
      seed: this.field.seed,
      position: { x: p.x, y: p.y, z: p.z },
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      mode: this.player.mode,
      quality: this.viewName,
      hours: this.lighting.hours,
      cycle: this.lighting.cycle,
      haze: this.haze,
      speed: this.player.speedMultiplier,
      sound: this.sound.enabled,
      showStats: this.showStats,
    };
  }

  save(announce = false) {
    if (!this.ready || this.failed) {
      if (announce) this.ui.notice('The world is still loading. Try again in a moment.');
      return false;
    }
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(this.serialize()));
      if (announce) this.ui.notice('Position saved on this device.');
      return true;
    } catch {
      if (announce) this.ui.notice('This browser cannot save the position. The world still works.');
      return false;
    }
  }

  /** Save the current view as a PNG (the canvas only, without the HUD). */
  capture() {
    if (!this.ready) return;
    try {
      this.kit.renderer.render(this.scene, this.camera);
      this.kit.renderer.domElement.toBlob((blob) => {
        if (!blob) {
          this.ui.notice('The picture could not be saved.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wildlands-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.ui.notice('Picture ready. Check your downloads.');
      }, 'image/png');
    } catch {
      this.ui.notice('The picture could not be saved.');
    }
  }

  addSystem(name, system) {
    if (typeof name !== 'string' || !name || !system || typeof system !== 'object') throw new TypeError('A system needs a name and an object.');
    if (this.systems.has(name)) throw new Error(`System already exists: ${name}`);
    system.init?.(this);
    this.systems.set(name, system);
    return () => this.removeSystem(name);
  }

  removeSystem(name) {
    const system = this.systems.get(name);
    if (!system) return;
    this.systems.delete(name);
    system.dispose?.(this);
  }

  /** Extensions: add a model to the world (world coordinates; it casts and receives shadows). */
  addMesh(object) {
    object.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.world.root.add(object);
    return object;
  }

  addPointLight({ color = '#ffbd76', intensity = 600, x = 0, y = 5, z = 0, distance = 60 } = {}) {
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.set(x, y, z);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = distance;
    light.shadow.normalBias = 0.08;
    this.world.root.add(light);
    return light;
  }

  showError(title, message) {
    document.getElementById('error-screen').hidden = false;
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
  }

  fail(message) {
    this.pause();
    this.failed = true;
    this.kit.loading.done();
    this.showError('The world could not continue', message);
  }
}

try {
  const game = new Game(kit);
  await game.prepare();
  kit.start((dt) => game.frame(dt));
  window.Wildlands = Object.freeze({
    version: VERSION,
    THREE,
    game,
    config: CONFIG,
    locations: LOCATIONS,
    addSystem: (name, system) => game.addSystem(name, system),
    teleport: (x, z, options = {}) => game.travel({ ...options, x, z }),
    sample: (x, z) => game.field.sample(x, z),
    save: () => game.save(true),
  });
} catch (err) {
  console.error('Wildlands startup:', err);
  kit.loading.done();
  document.getElementById('error-screen').hidden = false;
  document.getElementById('error-message').textContent = err?.message || 'The world could not start. Try another browser.';
}
