/**
 * main.js — GHOSTLINE: VESPER on the shared 3D kit.
 *
 * Boots three.js (WebGPU, WebGL2 fallback) through kit/boot.js, declares every
 * player action once for keyboard/mouse, gamepad and touch, builds the city
 * around the courier and runs the director each frame.
 */

import * as THREE from 'three/webgpu';
import { boot } from 'kit/boot.js';
import { WEAPONS, LANDMARKS, districtAt } from './content.js';
import { Simulation, WorldState, SaveStore, createInitialState } from './sim.js';
import { Materials, LightPool, createBakedMaterials, primitive } from './gfx.js';
import { Environment, LOOK } from './environment.js';
import { Collisions, City } from './world.js';
import { Player, Enemies, Interactions } from './actors.js';
import { Combat, Abilities, Hacking } from './combat.js';
import { Hud } from './hud.js';
import { Sfx } from './audio.js';

const top = (label) => ({ label, slot: 'top' });

const ACTIONS = {
  pause: { keys: ['Escape', 'KeyP'], gamepad: ['Start'], touch: top('II') },
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick', touch: 'stick' },
  look: { type: 'look', mouse: 'locked', gamepad: 'rightStick', touch: 'drag' },
  fire: { mouse: [0], gamepad: ['RT'], touch: 'Fire' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  interact: { keys: ['KeyE'], gamepad: ['X'], touch: 'Use' },
  reload: { keys: ['KeyR'], gamepad: ['X'], touch: 'Reload' },
  crouch: { keys: ['ControlLeft', 'ControlRight'], gamepad: ['B'], touch: 'Crouch' },
  aim: { mouse: [2], gamepad: ['LT'] },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['LS'] },
  scan: { keys: ['KeyQ'], gamepad: ['RB'], touch: top('Scan') },
  blink: { keys: ['KeyZ'], gamepad: ['LB'], touch: top('Blink') },
  overload: { keys: ['KeyX'], gamepad: ['Up'], touch: top('Ovld') },
  cloak: { keys: ['KeyC'], gamepad: ['Right'], touch: top('Cloak') },
  decoy: { keys: ['KeyV'], gamepad: ['Left'], touch: top('Decoy') },
  blackout: { keys: ['KeyB'], gamepad: ['RS'], touch: top('Blkout') },
  medpatch: { keys: ['KeyF'], gamepad: ['Down'], touch: top('Med') },
  weaponNext: { gamepad: ['Y'], touch: top('Wpn') },
  weapon1: { keys: ['Digit1'] },
  weapon2: { keys: ['Digit2'] },
  weapon3: { keys: ['Digit3'] },
  weapon4: { keys: ['Digit4'] },
  weapon5: { keys: ['Digit5'] },
  character: { keys: ['Tab', 'KeyK'] },
  journal: { keys: ['KeyJ'], gamepad: ['Back'] },
  // Menus and the ICE breach.
  confirm: { keys: ['Enter', 'NumpadEnter', 'Space'], gamepad: ['A'] },
  back: { keys: ['Backspace'], gamepad: ['B'] },
  navUp: { keys: ['ArrowUp', 'KeyW'], gamepad: ['Up'] },
  navDown: { keys: ['ArrowDown', 'KeyS'], gamepad: ['Down'] },
  navLeft: { keys: ['ArrowLeft', 'KeyA'], gamepad: ['Left'] },
  navRight: { keys: ['ArrowRight', 'KeyD'], gamepad: ['Right'] },
};

const kit = await boot({ title: 'GHOSTLINE: VESPER', accent: '#55f6ff', background: '#060711', input: ACTIONS });
const scene = new THREE.Scene();
scene.background = new THREE.Color().setRGB(0.015, 0.022, 0.055, THREE.SRGBColorSpace);
const camera = kit.fitCamera(new THREE.PerspectiveCamera(72, 1, 0.05, 420));

class Director {
  autosaveTimer = 0;
  currentDistrict = null;
  resetting = false;
  shown = {};
  hackStick = 0;
  frameStats = { draws: 0, triangles: 0 };

  constructor() {
    this.saves = new SaveStore();
    const state = this.saves.load(createInitialState(WEAPONS));
    const simulation = (this.simulation = new Simulation(state));
    this.worldState = new WorldState(simulation.state, simulation.events);
    this.sfx = new Sfx();
    this.materials = new Materials();
    this.baked = createBakedMaterials();
    this.collisions = new Collisions();
    this.lights = new LightPool(scene, kit.detail(6, 2));
    this.player = new Player(scene, camera, this.collisions, simulation);
    this.enemies = new Enemies({ scene, baked: this.baked, collisions: this.collisions, simulation, player: this.player, lights: this.lights });
    this.environment = new Environment(kit, scene, camera, this.player, simulation, this.materials);

    const root = document.getElementById('ui-root');
    this.hud = new Hud(root, kit, simulation, {
      hasSave: this.saves.hasSave(),
      onStart: () => {
        this.sfx.resume();
        if (!simulation.state.flags.prologueSeen)
          simulation.events.emit('toast', { message: 'Find Sable beside the magenta mask in Mercury Market', tone: 'normal' });
      },
      onNewGame: () => {
        // The old build re-saved on unload, so "New reconstruction" never took.
        this.resetting = true;
        this.saves.clear();
        location.reload();
      },
      onSave: () => this.save(false),
      onRespawn: () => this.respawn(),
      getQuality: () => kit.tier.name,
      getBackend: () => kit.backend,
      getActiveCells: () => this.city?.activeCellCount ?? 0,
      getEnemyCount: () => this.enemies.count,
      getEngagedCount: () => this.enemies.engagedCount,
      getStats: () => this.frameStats,
      openSettings: () => kit.menu.open(),
      onHackPress: (dir) => this.hacking.press(dir),
    });
    this.interactions = new Interactions({ scene, baked: this.baked, simulation, player: this.player, enemies: this.enemies, ui: this.hud });
    this.hacking = new Hacking({ simulation, ui: this.hud, sfx: this.sfx });
    simulation.events.on('player:died', () => this.hacking.cancel());
    this.combat = new Combat({
      simulation,
      collisions: this.collisions,
      enemies: this.enemies,
      player: this.player,
      interactions: this.interactions,
      baked: this.baked,
      sfx: this.sfx,
    });
    this.abilities = new Abilities({
      scene,
      simulation,
      player: this.player,
      enemies: this.enemies,
      interactions: this.interactions,
      materials: this.materials,
      sfx: this.sfx,
    });
    this.hud.setCooldownProvider((id) => this.abilities.cooldown(id));

    this.city = new City({
      scene,
      baked: this.baked,
      collisions: this.collisions,
      simulation,
      lights: this.lights,
      radius: 2,
      sink: {
        spawnEnemy: (def, id, position, cellId) => this.enemies.spawn(def, id, position, cellId),
        spawnLandmark: (def, cellId) => this.interactions.spawn(def, cellId),
        removeCell: (cellId) => {
          this.enemies.removeCell(cellId);
          this.interactions.removeCell(cellId);
        },
      },
    });

    simulation.events.on('player:damaged', () => {
      this.sfx.hurt();
      kit.input.rumble(0.45, 140);
    });
    simulation.events.on('combat:fired', () => kit.input.rumble(0.12, 40));
    kit.onQuality(() => this.lights.resize(kit.detail(6, 2)));
    // Touch pills: centred, or left-aligned (clear of the settings gear) on portrait phones, where the
    // HUD cards move up under them and the idle stick ring has the bottom-left corner to itself.
    kit.onResize((w, h) => {
      const portraitPhone = w <= 720 && h >= w;
      kit.touch?.placeTop(portraitPhone ? 'left' : 'center', 10);
      kit.touch?.setHint(portraitPhone);
      this.hud.touchLayoutDirty = true;
    });
    kit.settings.subscribe(() => (this.hud.touchLayoutDirty = true));
    kit.onPause((paused) => this.sfx.setPaused(paused));

    // A click on the view captures the mouse for looking (pads and touch never need it).
    kit.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && this.hud.gameplayActive) this.hud.lockMouse();
    });
    // Save when the tab hides or closes, once the player has actually entered Vesper.
    const saveOnLeave = () => {
      if (!this.resetting && this.hud.started) this.save(true);
    };
    addEventListener('pagehide', saveOnLeave);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveOnLeave();
    });

    this.city.fill(this.player.position);
    this.detectDistrict();
    this.warmPulse();
  }

  /** Compile the ability-pulse shader up front (hidden under the street) so the first Scan does not hitch. */
  warmPulse() {
    const warm = new THREE.Mesh(primitive('cylinder'), this.abilities.pulseMaterial('#55f6ff'));
    warm.position.set(0, -40, 0);
    warm.frustumCulled = false;
    scene.add(warm);
    setTimeout(() => warm.removeFromParent(), 3000);
  }

  update(dt) {
    const input = kit.input;
    const hud = this.hud;
    const hacking = this.hacking.active;
    this.environment.update(dt);
    this.city.update(this.player.position);
    this.lights.update(dt, this.player.position);
    if (hacking) this.hacking.update(dt, this.hackDirection(input), input.pressed('pause') || input.pressed('back'));
    if (hud.gameplayActive) {
      this.player.update(dt, input);
      this.abilities.update(dt, input);
      this.combat.update(dt, input);
      this.interactions.update(dt, input);
      if (hud.gameplayActive) this.enemies.update(dt);
      if (hud.gameplayActive) {
        this.simulation.tick(dt);
        this.worldState.update(dt);
        if (input.pressed('medpatch')) this.simulation.useMedpatch();
        this.autosaveTimer += dt;
        if (this.autosaveTimer >= 15) {
          this.autosaveTimer = 0;
          this.save(true);
        }
        this.detectDistrict();
      }
    }
    this.syncTouchButtons();
    hud.update(dt);
    if (!hacking) hud.handleInput(input, dt);
  }

  /** One breach direction per press: arrows/WASD, D-pad, or a flick of the left stick. */
  hackDirection(input) {
    if (input.pressed('navUp')) return 'up';
    if (input.pressed('navRight')) return 'right';
    if (input.pressed('navDown')) return 'down';
    if (input.pressed('navLeft')) return 'left';
    if (input.source !== 'gamepad') return null;
    const v = input.vector('move');
    const dir = v.y > 0.6 ? 'up' : v.y < -0.6 ? 'down' : v.x > 0.6 ? 'right' : v.x < -0.6 ? 'left' : null;
    const fresh = dir && dir !== this.hackStick;
    this.hackStick = dir;
    return fresh ? dir : null;
  }

  syncTouchButtons() {
    const touch = kit.touch;
    if (!touch) return;
    const show = (name, on) => {
      if (this.shown[name] === on) return;
      this.shown[name] = on;
      touch.setShown(name, on);
      // A new pill can wrap the top row onto another line.
      if (name === 'blackout') this.hud.touchLayoutDirty = true;
    };
    show('interact', !!this.interactions.focused);
    show('blackout', (this.simulation.state.player.skills['circuit.blackout'] ?? 0) > 0);
  }

  detectDistrict() {
    const p = this.player.position;
    const d = districtAt(p.x, p.z);
    if (d.id === this.currentDistrict) return;
    this.currentDistrict = d.id;
    this.simulation.state.districts[d.id].discovered = true;
    this.simulation.events.emit('district:entered', { district: d });
    this.simulation.events.emit('toast', { message: `${d.name} // ${d.subtitle}`, tone: 'normal' });
  }

  respawn() {
    const s = this.simulation.state;
    s.player.credits = Math.floor(s.player.credits * 0.9);
    s.player.health = s.player.maxHealth;
    s.player.shield = s.player.maxShield;
    s.player.energy = s.player.maxEnergy;
    const loft = LANDMARKS.find((l) => l.id === 'mercury-loft')?.position ?? { x: 0, y: 1.7, z: 8 };
    this.player.teleport({ x: loft.x, y: 1.7, z: loft.z + 3 });
    this.enemies.grantProtection(2.5);
    this.save(true);
  }

  save(automatic) {
    if (this.simulation.state.player.health <= 0) {
      if (!automatic) this.simulation.events.emit('toast', { message: 'Reconstruct before saving', tone: 'bad' });
      return;
    }
    try {
      this.saves.save(this.simulation.state);
      this.simulation.events.emit('save:completed', { automatic });
      if (!automatic) this.simulation.events.emit('toast', { message: 'Ghostline state committed', tone: 'good' });
    } catch {
      if (!automatic) this.simulation.events.emit('toast', { message: 'Unable to write local save', tone: 'bad' });
    }
  }
}

const director = new Director();

window.ghostline = { kit, scene, camera, director };
window.ghostlineDiagnostics = () => ({
  ready: true,
  backend: kit.backend,
  quality: kit.tier.name,
  ambient: LOOK.ambient,
  exposure: LOOK.exposure,
  canvas: { width: kit.canvas.width, height: kit.canvas.height },
  activeCells: director.city.activeCellCount,
  enemyCount: director.enemies.count,
});

// renderer.info resets at the start of each frame; read the whole frame's totals after the post chain.
const info = kit.renderer.info.render;
kit.start((dt) => {
  director.update(dt);
  director.environment.render();
  director.frameStats.draws = info.drawCalls;
  director.frameStats.triangles = info.triangles;
});
