/**
 * combat.js — guns, implant abilities and the ICE breach minigame.
 * All input arrives as kit actions, so mouse, gamepad and touch behave alike.
 */

import * as THREE from 'three/webgpu';
import { WEAPONS, ABILITIES, byId } from './content.js';
import { Rng, damp } from './sim.js';
import { MeshBuilder, DEG, primitive } from './gfx.js';

const _euler = new THREE.Euler(0, 0, 0, 'ZYX');

/* ------------------------------------------------------------------ weapons */

export class Combat {
  cooldown = 0;
  reloadTimer = 0;
  recoil = 0;
  muzzleTimer = 0;
  wheel = 0;
  weaponRoot = null;
  muzzle = null;

  constructor({ simulation, collisions, enemies, player, interactions, baked, sfx }) {
    this.simulation = simulation;
    this.collisions = collisions;
    this.enemies = enemies;
    this.player = player;
    this.interactions = interactions;
    this.baked = baked;
    this.sfx = sfx;
    this.rebuildWeapon();
  }

  update(dt, input) {
    const t = Math.min(dt, 0.1);
    this.cooldown = Math.max(0, this.cooldown - t);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - t);
    if (this.muzzle) this.muzzle.visible = this.muzzleTimer > 0;
    this.recoil = damp(this.recoil, 0, 18, t);
    this.setWeaponAngles(-this.recoil * 16, this.recoil * 4, this.recoil * 6);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= t;
      this.setWeaponAngles(35 + Math.sin(this.reloadTimer * 8) * 6, 0, 22);
      if (this.reloadTimer <= 0) this.finishReload();
      return;
    }
    this.handleWeaponSelection(input);
    // One button (X on a pad) both uses what you face and reloads; using wins.
    if (input.pressed('reload') && !(this.interactions.focused && input.pressed('interact'))) this.startReload();

    const weapon = this.simulation.getWeapon();
    // A mouse click without pointer lock only captures the mouse; it does not shoot.
    const mouseOnly = input.source === 'keyboard' && !input.pointerLocked;
    const trigger = weapon.fireInterval < 0.2 ? input.down('fire') : input.pressed('fire');
    if (trigger && !mouseOnly) this.fire(weapon);

    const cam = this.player.camera;
    const fov = damp(cam.fov, input.down('aim') ? 59 : 72, 12, t);
    if (Math.abs(fov - cam.fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  setWeaponAngles(x, y, z) {
    this.weaponRoot?.quaternion.setFromEuler(_euler.set(x * DEG, y * DEG, z * DEG, 'ZYX'));
  }

  cancelReload() {
    this.reloadTimer = 0;
  }

  get reloading() {
    return this.reloadTimer > 0;
  }

  fire(weapon) {
    if (this.cooldown > 0 || this.reloadTimer > 0) return;
    const state = this.simulation.state;
    const ammo = state.player.ammo[weapon.id];
    if (!ammo || ammo.magazine <= 0) {
      this.startReload();
      return;
    }
    ammo.magazine -= 1;
    this.cooldown = weapon.fireInterval;
    this.recoil = Math.min(1.5, this.recoil + (weapon.id === 'maw' ? 1.15 : weapon.id === 'needleline' ? 0.9 : 0.34));
    this.muzzleTimer = 0.045;
    const origin = this.player.position.clone();
    this.sfx.shot(weapon.damageType);
    this.enemies.alert(origin, weapon.id === 'needleline' || weapon.id === 'maw' ? 52 : 38);
    this.simulation.events.emit('combat:fired', { weaponId: weapon.id });
    let hitAny = false;
    let crit = false;
    const forward = this.player.forward.clone();
    const right = this.player.right.clone();
    const up = this.player.up.clone();
    const dir = new THREE.Vector3();
    for (let i = 0; i < weapon.projectiles; i++) {
      const sx = (Math.random() - 0.5) * weapon.spread;
      const sy = (Math.random() - 0.5) * weapon.spread;
      dir.copy(forward).addScaledVector(right, sx).addScaledVector(up, sy).normalize();
      const wall = this.collisions.raycast(origin, dir, weapon.range);
      const hit = this.enemies.raycast(origin, dir, wall ?? weapon.range);
      if (!hit) continue;
      const result = this.enemies.damage(hit.id, weapon.damage, weapon.damageType, hit.critical);
      hitAny = true;
      crit ||= hit.critical;
      this.simulation.events.emit('combat:hit', { targetId: hit.id, damage: result.applied, critical: hit.critical, killed: result.killed });
    }
    if (hitAny) this.sfx.hit(crit);
    this.simulation.events.emit('state:changed', { reason: 'ammo' });
    if (ammo.magazine <= 0 && ammo.reserve > 0) this.startReload();
  }

  startReload() {
    const weapon = this.simulation.getWeapon();
    const p = this.simulation.state.player;
    const ammo = p.ammo[weapon.id];
    if (!ammo || ammo.magazine >= weapon.magazine || ammo.reserve <= 0 || this.reloadTimer > 0) return;
    const fast = p.skills['chrome.overclock'] && p.shield <= 0 ? 0.7 : 1;
    this.reloadTimer = weapon.reloadTime * fast;
    this.sfx.reload();
    this.simulation.events.emit('combat:reload', { weaponId: weapon.id, duration: this.reloadTimer });
  }

  finishReload() {
    const weapon = this.simulation.getWeapon();
    const ammo = this.simulation.state.player.ammo[weapon.id];
    if (!ammo) return;
    const moved = Math.min(weapon.magazine - ammo.magazine, ammo.reserve);
    ammo.magazine += moved;
    ammo.reserve -= moved;
    this.simulation.events.emit('state:changed', { reason: 'reload' });
  }

  handleWeaponSelection(input) {
    const p = this.simulation.state.player;
    const owned = p.unlockedWeapons;
    let pick = -1;
    for (let i = 0; i < Math.min(5, owned.length); i++) if (input.pressed(`weapon${i + 1}`)) pick = i;
    // Mouse wheel: one notch per weapon (touch pinch is left alone).
    if (input.source !== 'touch') {
      const z = input.zoom();
      this.wheel = z === 0 ? this.wheel * 0.9 : this.wheel + z;
    }
    let step = 0;
    if (this.wheel >= 0.9) step = -1;
    else if (this.wheel <= -0.9) step = 1;
    if (input.pressed('weaponNext')) step = 1;
    if (step !== 0) this.wheel = 0;
    if (step !== 0 && owned.length > 1) pick = (owned.indexOf(p.currentWeapon) + step + owned.length) % owned.length;
    const id = owned[pick];
    if (!id || id === p.currentWeapon) return;
    p.currentWeapon = id;
    this.cooldown = 0.18;
    this.rebuildWeapon();
    this.simulation.events.emit('toast', { message: byId(WEAPONS, id).name, tone: 'normal' });
    this.simulation.events.emit('state:changed', { reason: 'weapon-switch' });
  }

  rebuildWeapon() {
    if (this.weaponRoot) {
      this.weaponRoot.removeFromParent();
      this.weaponRoot.traverse((o) => o.geometry?.dispose());
    }
    const weapon = this.simulation.getWeapon();
    const body = { color: '#151a2b', metalness: 0.9, gloss: 0.9 };
    const glow = { color: weapon.color, emissive: weapon.color, emissiveIntensity: 8, metalness: 0.35, gloss: 0.86 };
    const len = weapon.id === 'needleline' ? 1.3 : weapon.id === 'maw' ? 1.05 : 0.82;
    const b = new MeshBuilder(true);
    b.add('box', [0, 0, -len * 0.35], [0.24, 0.2, len], null, body);
    b.add('box', [0, 0.1, -len * 0.35], [0.08, 0.05, len * 0.88], null, glow);
    b.add('box', [0, -0.21, -0.08], [0.17, 0.36, 0.19], null, body);
    b.add('cylinder', [0, 0, -len * 0.88], [0.19, 0.18, 0.19], [90, 0, 0], glow);
    const root = new THREE.Group();
    root.name = `View Weapon: ${weapon.name}`;
    const gun = new THREE.Mesh(b.build(), this.baked.lit);
    root.add(gun);
    const flash = new MeshBuilder(true).add('sphere', [0, 0, 0], [1, 1, 1], null, glow).build();
    const muzzle = new THREE.Mesh(flash, this.baked.lit);
    muzzle.position.set(0, 0, -len * 1.02);
    muzzle.scale.set(0.18, 0.18, 0.34);
    muzzle.visible = false;
    root.add(muzzle);
    this.player.weaponMount.add(root);
    this.weaponRoot = root;
    this.muzzle = muzzle;
  }
}

/* ------------------------------------------------------------------ implant abilities */

const ABILITY_ACTIONS = ['scan', 'blink', 'overload', 'cloak', 'decoy', 'blackout'];

export class Abilities {
  cooldowns = new Map();
  pulses = [];
  cloakTimer = 0;

  constructor({ scene, simulation, player, enemies, interactions, materials, sfx }) {
    this.scene = scene;
    this.simulation = simulation;
    this.player = player;
    this.enemies = enemies;
    this.interactions = interactions;
    this.materials = materials;
    this.sfx = sfx;
    this.unsubscribe = simulation.events.on('combat:fired', () => {
      if (this.cloakTimer > 0) {
        this.cloakTimer = 0;
        this.enemies.setCloaked(false);
      }
    });
  }

  /** `input` is null while gameplay is paused (pulses still finish). */
  update(dt, input) {
    for (const [id, left] of this.cooldowns) this.cooldowns.set(id, Math.max(0, left - dt));
    this.cloakTimer = Math.max(0, this.cloakTimer - dt);
    this.enemies.setCloaked(this.cloakTimer > 0);
    this.updatePulses(dt);
    if (!input) return;
    for (const id of ABILITY_ACTIONS) if (input.pressed(id)) this.use(id);
  }

  use(id) {
    const ability = byId(ABILITIES, id);
    const sim = this.simulation;
    if ((this.cooldowns.get(id) ?? 0) > 0) return false;
    if (id === 'blackout' && (sim.state.player.skills['circuit.blackout'] ?? 0) < 1) {
      sim.events.emit('toast', { message: 'Local Blackout requires its Circuit capstone', tone: 'bad' });
      return false;
    }
    if (!sim.spendEnergy(id)) return false;
    this.cooldowns.set(id, ability.cooldown);
    const at = this.player.position.clone();
    const skills = sim.state.player.skills;
    switch (id) {
      case 'scan':
        this.enemies.scan(4.5);
        this.interactions.scan(4.5);
        this.pulse(at, ability.color, 38, 0.55);
        this.sfx.ability(510);
        break;
      case 'blink': {
        const after = skills['ghost.afterimage'] ?? 0;
        this.player.dash(7.5 + after);
        if (after > 0) {
          this.enemies.createDecoy(at, 2.5 + after * 1.5);
          this.pulse(at, '#8aff80', 4 + after, 0.5);
        }
        this.pulse(at, ability.color, 6, 0.26);
        this.sfx.ability(260);
        break;
      }
      case 'overload': {
        const relay = skills['circuit.relay'] ?? 0;
        const hits = this.enemies.damageRadius(at, 9 + relay * 2, 34 + relay * 10, 'ion', 2.6);
        this.pulse(at, ability.color, 12 + relay * 2, 0.42);
        this.sfx.ability(720);
        sim.events.emit('toast', { message: `OVERLOAD // ${hits} signatures interrupted`, tone: hits ? 'good' : 'normal' });
        break;
      }
      case 'cloak':
        this.cloakTimer = 5.5 + (skills['ghost.vanish'] ?? 0) * 2.5;
        this.sfx.ability(390);
        sim.events.emit('toast', { message: 'VANISH PROTOCOL // signature suppressed', tone: 'good' });
        break;
      case 'decoy': {
        const spot = at.clone().addScaledVector(this.player.forward, 7);
        this.enemies.createDecoy(spot, 7);
        this.pulse(spot, ability.color, 4, 0.8);
        this.sfx.ability(620);
        break;
      }
      case 'blackout': {
        const hits = this.enemies.damageRadius(at, 34, 95, 'ion', 8);
        this.pulse(at, ability.color, 40, 1.1);
        this.sfx.ability(110);
        sim.events.emit('toast', { message: `LOCAL BLACKOUT // ${hits} nodes seized`, tone: 'good' });
        break;
      }
    }
    return true;
  }

  cooldown(id) {
    return this.cooldowns.get(id) ?? 0;
  }

  get cloaked() {
    return this.cloakTimer > 0;
  }

  pulseMaterial(color) {
    return this.materials.get({ color, emissive: color, emissiveIntensity: 8, opacity: 0.32, unlit: true });
  }

  pulse(at, color, maxScale, duration) {
    const mesh = new THREE.Mesh(primitive('cylinder'), this.pulseMaterial(color));
    mesh.position.set(at.x, 0.18, at.z);
    mesh.scale.set(0.1, 0.025, 0.1);
    this.scene.add(mesh);
    this.pulses.push({ mesh, age: 0, duration, maxScale });
  }

  updatePulses(dt) {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age += dt;
      const k = Math.min(1, p.age / p.duration);
      const s = 0.1 + p.maxScale * k;
      p.mesh.scale.set(s, Math.max(0.008, 0.04 * (1 - k)), s);
      p.mesh.rotateY(dt * 110 * DEG);
      if (k >= 1) {
        p.mesh.removeFromParent();
        this.pulses.splice(i, 1);
      }
    }
  }

  destroy() {
    this.unsubscribe();
    for (const p of this.pulses) p.mesh.removeFromParent();
    this.pulses.length = 0;
  }
}

/* ------------------------------------------------------------------ ICE breach */

export const HACK_GLYPHS = [
  { code: 'up', glyph: '▲' },
  { code: 'right', glyph: '▶' },
  { code: 'down', glyph: '▼' },
  { code: 'left', glyph: '◀' },
];

export class Hacking {
  target = null;
  sequence = [];
  progress = 0;
  integrity = 3;
  timer = 0;

  constructor({ simulation, ui, sfx }) {
    this.simulation = simulation;
    this.ui = ui;
    this.sfx = sfx;
    this.unsubscribe = simulation.events.on('hack:request', ({ target, difficulty }) => this.start(target, difficulty));
  }

  get active() {
    return this.target !== null;
  }

  /** dirs: the direction entered this frame ('up' | 'right' | 'down' | 'left'), or null; cancel: abort. */
  update(dt, entered, cancel) {
    if (!this.target) return;
    if (cancel) {
      this.finish(false);
      return;
    }
    if (entered) this.press(entered);
    if (!this.target) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.finish(false);
      return;
    }
    this.render();
  }

  /** One direction from keys, pad, stick or the on-screen arrows. */
  press(code) {
    if (!this.target) return;
    if (this.sequence[this.progress]?.code === code) {
      this.progress += 1;
      this.sfx.ability(330 + this.progress * 55);
      if (this.progress >= this.sequence.length) {
        this.finish(true);
        return;
      }
    } else {
      this.integrity -= 1;
      this.timer -= 0.7;
      if (this.integrity <= 0) {
        this.finish(false);
        return;
      }
    }
    this.render();
  }

  cancel() {
    if (!this.target) return;
    this.target = null;
    this.ui.showHack(null);
  }

  destroy() {
    this.unsubscribe();
  }

  start(target, difficulty) {
    if (this.target) return;
    const breach = this.simulation.state.player.skills['circuit.breach'] ?? 0;
    const length = Math.max(3, 3 + difficulty - Math.floor(breach / 2));
    const rng = new Rng(`${this.simulation.state.worldSeed}:hack:${target}:${this.simulation.state.collected.length}`);
    this.sequence = Array.from({ length }, () => rng.pick(HACK_GLYPHS));
    this.target = target;
    this.progress = 0;
    this.integrity = 3;
    this.timer = 5.5 + breach * 0.8;
    this.render();
  }

  finish(success) {
    const target = this.target;
    if (!target) return;
    this.target = null;
    this.ui.showHack(null);
    this.sfx.hack(success);
    this.simulation.events.emit('hack:result', { target, success });
    if (!success) this.simulation.events.emit('toast', { message: 'ICE trace rejected the breach', tone: 'bad' });
  }

  render() {
    if (!this.target) return;
    this.ui.showHack({
      name: this.target.replaceAll('-', ' ').toUpperCase(),
      glyphs: this.sequence.map((g) => g.glyph),
      progress: this.progress,
      integrity: this.integrity,
      timeRemaining: this.timer,
    });
  }
}
