/**
 * actors.js — the courier, the machines hunting them, and the landmarks they
 * talk to, breach and rest at.
 *
 * Angles follow the original: yaw and pitch in degrees, yaw 0 looking down −Z.
 * Enemy and landmark bodies are baked once per kind into a single mesh.
 */

import * as THREE from 'three/webgpu';
import { districtAt } from './content.js';
import { clamp, damp } from './sim.js';
import { MeshBuilder, DEG } from './gfx.js';
import { raySphere } from './world.js';

const STAND_HEIGHT = 1.7;
const CROUCH_HEIGHT = 1.08;
// The original turned 0.095°/px (yaw) and 0.085°/px (pitch) of mouse travel; the
// kit's look is 0.0024 rad/px at 1×, so degrees per kit radian keep that feel.
const YAW_PER_RAD = 0.095 / 0.0024;
const PITCH_PER_RAD = 0.085 / 0.0024;

/* ------------------------------------------------------------------ player */

export class Player {
  velocity = new THREE.Vector3();
  verticalVelocity = 0;
  jumpOffset = 0;
  eyeHeight = STAND_HEIGHT;
  bobPhase = 0;
  moving = false;
  crouching = false;
  sprinting = false;
  crouchLatch = false;
  _forward = new THREE.Vector3();
  _right = new THREE.Vector3();
  _up = new THREE.Vector3();

  constructor(scene, camera, collisions, simulation) {
    this.collisions = collisions;
    this.simulation = simulation;
    const p = simulation.state.player;
    this.yaw = p.yaw;
    this.pitch = p.pitch;
    this.entity = new THREE.Object3D();
    this.entity.name = 'Player';
    this.entity.position.set(p.position.x, p.position.y, p.position.z);
    this.camera = camera;
    camera.position.set(0, 0, 0);
    this.entity.add(camera);
    this.weaponMount = new THREE.Group();
    this.weaponMount.position.set(0.34, -0.32, -0.58);
    camera.add(this.weaponMount);
    scene.add(this.entity);
    this.applyLook();
  }

  /** input: kit.input. Only called while gameplay is live. */
  update(dt, input) {
    const t = Math.min(dt, 0.05);
    const look = input.look('look');
    this.yaw -= look.x * YAW_PER_RAD;
    this.pitch = clamp(this.pitch - look.y * PITCH_PER_RAD, -86, 86);

    const mv = input.vector('move');
    const forward = mv.y;
    const strafe = mv.x;
    const touch = input.source === 'touch';
    // Touch has no held Ctrl or Shift: Crouch toggles, and a stick pushed to the rim sprints.
    if (touch) {
      if (input.pressed('crouch')) this.crouchLatch = !this.crouchLatch;
    } else this.crouchLatch = false;
    const crouch = touch ? this.crouchLatch : input.down('crouch');
    const sprintHeld = touch ? Math.hypot(mv.x, mv.y) > 0.92 && forward > 0.7 : input.down('sprint');
    const sprint = !crouch && forward > 0 && sprintHeld;
    this.crouching = crouch;
    this.sprinting = sprint;

    const skills = this.simulation.state.player.skills;
    const softstep = skills['ghost.softstep'] ?? 0;
    const overclock = (skills['chrome.overclock'] ?? 0) > 0 && this.simulation.state.player.shield <= 0;
    const speed = crouch ? 2.55 + softstep * 0.28 : sprint ? 8.2 * (overclock ? 1.18 : 1) : 4.8;
    const r = this.yaw * DEG;
    const fx = -Math.sin(r);
    const fz = -Math.cos(r);
    const rx = Math.cos(r);
    const rz = -Math.sin(r);
    const tx = (fx * forward + rx * strafe) * speed;
    const tz = (fz * forward + rz * strafe) * speed;
    this.velocity.x = damp(this.velocity.x, tx, 15, t);
    this.velocity.z = damp(this.velocity.z, tz, 15, t);
    this.moving = Math.abs(tx) + Math.abs(tz) > 0.1;

    if (input.pressed('jump') && this.jumpOffset <= 0.001) {
      this.verticalVelocity = 6.2;
      this.jumpOffset = 0.01;
    }
    this.verticalVelocity -= 17 * t;
    this.jumpOffset = Math.max(0, this.jumpOffset + this.verticalVelocity * t);
    if (this.jumpOffset <= 0) this.verticalVelocity = 0;
    this.eyeHeight = damp(this.eyeHeight, crouch ? CROUCH_HEIGHT : STAND_HEIGHT, 14, t);

    const pos = this.entity.position;
    const next = this.collisions.resolveCircle(pos, { x: this.velocity.x * t, y: 0, z: this.velocity.z * t }, crouch ? 0.38 : 0.44);
    pos.set(next.x, this.eyeHeight + this.jumpOffset, next.z);
    this.applyLook();
    this.updateBob(t, sprint);
    this.copyToState();
  }

  dash(distance = 7) {
    const r = this.yaw * DEG;
    const pos = this.entity.position;
    const next = this.collisions.resolveCircle(pos, { x: -Math.sin(r) * distance, y: 0, z: -Math.cos(r) * distance }, 0.42);
    pos.set(next.x, pos.y, next.z);
    this.copyToState();
  }

  teleport(p) {
    this.entity.position.set(p.x, p.y, p.z);
    this.verticalVelocity = 0;
    this.jumpOffset = 0;
    this.copyToState();
  }

  get position() {
    return this.entity.position;
  }

  /** Camera axes, from yaw and pitch (no matrix update needed). */
  get forward() {
    const y = this.yaw * DEG;
    const p = this.pitch * DEG;
    return this._forward.set(-Math.cos(p) * Math.sin(y), Math.sin(p), -Math.cos(p) * Math.cos(y));
  }

  get right() {
    const y = this.yaw * DEG;
    return this._right.set(Math.cos(y), 0, -Math.sin(y));
  }

  get up() {
    const y = this.yaw * DEG;
    const p = this.pitch * DEG;
    return this._up.set(Math.sin(p) * Math.sin(y), Math.cos(p), Math.sin(p) * Math.cos(y));
  }

  /** How visible the courier is to patrols. */
  get signature() {
    return this.moving ? (this.crouching ? 0.58 : this.sprinting ? 1.35 : 1) : 0.42;
  }

  applyLook() {
    this.entity.rotation.set(0, this.yaw * DEG, 0);
    this.camera.rotation.set(this.pitch * DEG, 0, 0);
  }

  updateBob(dt, sprint) {
    const grounded = this.jumpOffset <= 0.01;
    if (this.moving && grounded) this.bobPhase += dt * (sprint ? 12 : 8);
    const amount = this.moving && grounded ? (sprint ? 0.035 : 0.022) : 0;
    const bobY = Math.sin(this.bobPhase * 2) * amount;
    const bobX = Math.cos(this.bobPhase) * amount * 0.6;
    const m = this.weaponMount.position;
    m.set(damp(m.x, 0.34 + bobX, 12, dt), damp(m.y, -0.32 + bobY, 12, dt), -0.58);
  }

  copyToState() {
    const e = this.entity.position;
    const s = this.simulation.state.player;
    s.position = { x: e.x, y: e.y, z: e.z };
    s.yaw = this.yaw;
    s.pitch = this.pitch;
  }

  destroy() {
    this.entity.removeFromParent();
  }
}

/* ------------------------------------------------------------------ enemies */

const ENEMY_BODY = { color: '#151729', metalness: 0.8, gloss: 0.86 };
const enemyGeometry = new Map();

function buildEnemyGeometry(def) {
  let g = enemyGeometry.get(def.id);
  if (g) return g;
  const b = new MeshBuilder(true);
  const glow = { color: def.color, emissive: def.color, emissiveIntensity: 7, metalness: 0.25, gloss: 0.75 };
  const part = (type, position, scale, lit = false) => b.add(type, position, scale, null, lit ? glow : ENEMY_BODY);
  switch (def.shape) {
    case 'drone':
      part('sphere', [0, 0, 0], [0.75, 0.42, 0.68]);
      part('box', [-0.7, 0, 0], [0.8, 0.09, 0.38]);
      part('box', [0.7, 0, 0], [0.8, 0.09, 0.38]);
      part('sphere', [0, 0.08, -0.55], [0.23, 0.14, 0.09], true);
      break;
    case 'turret':
      part('cylinder', [0, -0.55, 0], [0.85, 0.55, 0.85]);
      part('box', [0, 0.05, 0], [0.95, 0.42, 0.7]);
      part('box', [0, 0.06, -0.62], [0.22, 0.16, 0.65], true);
      break;
    case 'hound':
      part('box', [0, 0, 0.1], [0.75, 0.55, 1.25]);
      part('cone', [0, 0.05, -0.78], [0.55, 0.55, 0.55]);
      part('box', [0, 0.38, 0.15], [0.12, 0.1, 0.9], true);
      break;
    case 'boss':
      part('sphere', [0, 0, 0], [2.1, 2.1, 2.1]);
      part('box', [0, 0, 0], [5, 0.22, 0.22], true);
      part('box', [0, 0, 0], [0.22, 5, 0.22], true);
      part('box', [0, 0, 0], [0.22, 0.22, 5], true);
      part('cone', [0, 2.3, 0], [1.2, 1.5, 1.2]);
      break;
    case 'obelisk':
      part('cone', [0, 0.1, 0], [0.9, 1.8, 0.9]);
      part('box', [0, 0.38, -0.47], [0.48, 0.2, 0.05], true);
      part('cylinder', [0, 0.15, 0], [1.3, 0.06, 1.3], true);
      break;
  }
  g = b.build();
  enemyGeometry.set(def.id, g);
  return g;
}

const _spin = new THREE.Quaternion();
const _spinEuler = new THREE.Euler(0, 0, 0, 'ZYX');

export class Enemies {
  actors = new Map();
  elapsed = 0;
  cloaked = false;
  protectionTimer = 0;
  decoy = null;

  constructor({ scene, baked, collisions, simulation, player, lights }) {
    this.scene = scene;
    this.baked = baked;
    this.collisions = collisions;
    this.simulation = simulation;
    this.player = player;
    this.lights = lights;
  }

  spawn(def, id, position, cellId) {
    const defeated = this.simulation.state.defeatedAt[id];
    if (
      this.actors.has(id) ||
      (id === 'boss:whiteout' && this.simulation.state.flags.whiteoutDefeated === true) ||
      (defeated !== undefined && this.simulation.state.playTime - defeated < 300)
    )
      return;
    const entity = new THREE.Group();
    entity.name = def.name;
    entity.position.copy(position);
    const visual = new THREE.Mesh(buildEnemyGeometry(def), this.baked.lit);
    visual.castShadow = true;
    visual.receiveShadow = true;
    entity.add(visual);
    this.scene.add(entity);
    const light = def.shape === 'boss' ? this.lights.add({ position: entity.position, color: new THREE.Color().setRGB(0.6, 0.8, 1, THREE.SRGBColorSpace), intensity: 4, range: 28 }) : null;
    this.actors.set(id, {
      id,
      cellId,
      definition: def,
      entity,
      visual,
      light,
      health: def.health,
      shield: def.shield,
      attackTimer: Math.random(),
      thinkTimer: Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      engaged: false,
      dead: false,
      deathTimer: 0,
      stunTimer: 0,
      scanTimer: 0,
      fractureTimer: 0,
      hitTimer: 0,
      bossStage: 0,
      bossPulseTimer: 4.5,
      decoyEngaged: false,
    });
  }

  update(dt) {
    const t = Math.min(dt, 0.1);
    this.elapsed += t;
    this.protectionTimer = Math.max(0, this.protectionTimer - t);
    if (this.decoy) {
      this.decoy.timer -= t;
      if (this.decoy.timer <= 0) {
        this.decoy = null;
        for (const a of this.actors.values())
          if (a.decoyEngaged) {
            a.engaged = false;
            a.decoyEngaged = false;
          }
      }
    }
    const playerPos = this.player.position;
    for (const a of [...this.actors.values()]) {
      if (a.dead) {
        a.deathTimer -= t;
        const k = Math.max(0.01, a.deathTimer / 0.48);
        a.visual.scale.set(k * 1.15, k, k * 1.15);
        a.visual.quaternion.multiply(_spin.setFromEuler(_spinEuler.set(0, t * 540 * DEG, t * 260 * DEG, 'ZYX')));
        if (a.deathTimer <= 0) this.removeActor(a);
        continue;
      }
      a.scanTimer = Math.max(0, a.scanTimer - t);
      a.stunTimer = Math.max(0, a.stunTimer - t);
      a.fractureTimer = Math.max(0, a.fractureTimer - t);
      a.bossPulseTimer = Math.max(0, a.bossPulseTimer - t);
      a.attackTimer = Math.max(0, a.attackTimer - t);
      a.hitTimer = Math.max(0, a.hitTimer - t);
      a.thinkTimer -= t;
      const bob = Math.sin(this.elapsed * 2.3 + a.phase) * (a.definition.shape === 'hound' ? 0.035 : 0.16);
      const pulse = a.scanTimer > 0 ? 1.08 + Math.sin(this.elapsed * 14) * 0.03 : 1;
      // A short squash when hit (the original set it, then overwrote it the same frame).
      const squash = a.hitTimer / 0.12;
      a.visual.position.set(0, bob, 0);
      a.visual.scale.set(pulse * (1 + 0.18 * squash), pulse * (1 - 0.18 * squash), pulse * (1 + 0.18 * squash));
      a.visual.rotateY(t * (a.definition.shape === 'turret' ? 20 : 38) * DEG);
      if (a.stunTimer > 0 || a.thinkTimer > 0) continue;

      a.thinkTimer = 0.08 + Math.random() * 0.12;
      const target = this.decoy?.position ?? playerPos;
      const o = a.entity.position;
      const dx = target.x - o.x;
      const dz = target.z - o.z;
      const dist = Math.hypot(dx, dz);
      if (a.definition.shape === 'boss') this.updateBossPhase(a, o.distanceTo(playerPos));
      const weather = this.simulation.state.weather;
      const visibility = weather === 'smog' ? 0.72 : weather === 'rain' ? 0.9 : 1;
      const hidden = this.cloaked || this.protectionTimer > 0;
      if (!hidden && dist < (34 + a.definition.attackRange * 0.25) * this.player.signature * visibility) a.engaged = true;
      if (hidden && !this.decoy) a.engaged = false;
      if (!a.engaged) continue;

      const inv = 1 / Math.max(dist, 0.001);
      const blocked = this.collisions.raycast({ x: o.x, y: o.y + 0.3, z: o.z }, { x: dx * inv, y: 0, z: dz * inv }, dist);
      const clear = blocked === null || blocked >= dist - 0.6;
      const keepAway = a.definition.attackRange * 0.72;
      if (a.definition.speed > 0 && (dist > keepAway || !clear)) {
        const step = a.definition.speed * (1 + a.bossStage * 0.32) * a.thinkTimer;
        const next = this.collisions.resolveCircle(o, { x: dx * inv * step, y: 0, z: dz * inv * step }, a.definition.shape === 'boss' ? 1.25 : 0.55);
        o.set(next.x, o.y, next.z);
        // Face the target with −Z (PlayCanvas lookAt).
        const fx = target.x - o.x;
        const fz = target.z - o.z;
        if (fx * fx + fz * fz > 1e-6) a.entity.rotation.set(0, Math.atan2(-fx, -fz), 0);
      }
      if (dist <= a.definition.attackRange && clear && a.attackTimer <= 0 && !this.decoy) {
        a.attackTimer = a.definition.attackInterval * (a.bossStage === 2 ? 0.65 : a.bossStage === 1 ? 0.82 : 1);
        this.simulation.damagePlayer(a.definition.damage, a.definition.name);
      }
    }
  }

  /** Nearest living enemy along a ray: { id, distance, critical } or null. */
  raycast(origin, dir, maxDistance) {
    let best = null;
    for (const a of this.actors.values()) {
      if (a.dead) continue;
      const p = a.entity.position;
      const shape = a.definition.shape;
      const radius = shape === 'boss' ? 2.2 : shape === 'hound' ? 0.75 : 0.9;
      const d = raySphere(origin, dir, { x: p.x, y: p.y + 0.25, z: p.z }, radius);
      if (d === null || d > maxDistance || (best && best.distance <= d)) continue;
      const head = raySphere(origin, dir, { x: p.x, y: p.y + (shape === 'boss' ? 1.4 : 0.75), z: p.z }, radius * 0.28);
      best = { id: a.id, distance: d, critical: head !== null && head <= d + radius };
    }
    return best;
  }

  damage(id, amount, type, critical = false) {
    const a = this.actors.get(id);
    if (!a || a.dead) return { killed: false, applied: 0 };
    const skills = this.simulation.state.player.skills;
    const weather = this.simulation.state.weather;
    let rest = amount * (critical ? 1.65 + (skills['edge.deadeye'] ?? 0) * 0.12 : 1);
    let applied = 0;
    if (a.shield > 0) {
      const storm = type === 'ion' && (weather === 'rain' || weather === 'gridstorm') ? 1.18 : 1;
      const mult = (type === 'ion' ? 1.5 : type === 'thermal' ? 0.7 : 1) * storm;
      const absorbed = Math.min(a.shield, rest * mult);
      a.shield -= absorbed;
      rest = Math.max(0, rest - absorbed / mult);
      applied += absorbed;
    }
    if (rest > 0) {
      const fracture = skills['edge.fracture'] ?? 0;
      const exposed = a.fractureTimer > 0 ? 1 + fracture * 0.1 : 1;
      const mult = (type === 'thermal' ? 1.2 : type === 'ion' ? 0.8 : 1) * exposed;
      const dealt = Math.min(a.health, rest * mult);
      a.health -= dealt;
      applied += dealt;
    }
    if (type === 'kinetic' && (skills['edge.fracture'] ?? 0) > 0) a.fractureTimer = 4;
    a.engaged = true;
    a.decoyEngaged = false;
    a.hitTimer = 0.12;
    if (a.health <= 0) this.kill(a);
    return { killed: a.dead, applied: Math.round(applied) };
  }

  damageRadius(center, radius, amount, type, stun = 0) {
    let hits = 0;
    for (const a of this.actors.values()) {
      if (a.dead || a.entity.position.distanceTo(center) > radius) continue;
      this.damage(a.id, amount, type, false);
      a.stunTimer = Math.max(a.stunTimer, stun);
      hits += 1;
    }
    return hits;
  }

  scan(duration, range = 55) {
    const p = this.player.position;
    for (const a of this.actors.values()) if (a.entity.position.distanceTo(p) <= range) a.scanTimer = duration;
  }

  setCloaked(on) {
    this.cloaked = on;
  }

  grantProtection(seconds) {
    this.protectionTimer = Math.max(this.protectionTimer, seconds);
  }

  createDecoy(position, seconds = 6) {
    this.decoy = { position: position.clone(), timer: seconds };
    for (const a of this.actors.values())
      if (a.entity.position.distanceTo(position) < 45) {
        a.decoyEngaged ||= !a.engaged;
        a.engaged = true;
      }
  }

  alert(position, radius) {
    for (const a of this.actors.values())
      if (!a.dead && a.entity.position.distanceTo(position) <= radius) {
        a.engaged = true;
        a.decoyEngaged = false;
      }
  }

  removeCell(cellId) {
    for (const a of [...this.actors.values()]) if (a.cellId === cellId) this.removeActor(a);
  }

  removeActor(a) {
    a.entity.removeFromParent();
    if (a.light) this.lights.remove(a.light);
    this.actors.delete(a.id);
  }

  has(id) {
    return this.actors.has(id);
  }

  get count() {
    return this.actors.size;
  }

  get engagedCount() {
    let n = 0;
    for (const a of this.actors.values()) if (a.engaged && !a.dead) n += 1;
    return n;
  }

  destroy() {
    for (const a of [...this.actors.values()]) this.removeActor(a);
  }

  kill(a) {
    const sim = this.simulation;
    const state = sim.state;
    a.dead = true;
    a.deathTimer = 0.48;
    sim.progression.grantXp(a.definition.xp);
    sim.addCredits(8 + Math.floor(Math.random() * 14));
    sim.objective({ type: 'kill', target: `enemy.${a.definition.id}` });
    const shardsWanted = state.quests['memory-market']?.status === 'active' && (state.objectiveFacts['collect:memory.shard'] ?? 0) < 3;
    if (a.definition.id === 'wraith' && (shardsWanted || Math.random() < 0.72)) {
      sim.objective({ type: 'collect', target: 'memory.shard' });
      sim.events.emit('toast', { message: 'Memory shard recovered', tone: 'good' });
    }
    if (a.id === 'boss:whiteout') state.flags.whiteoutDefeated = true;
    else state.defeatedAt[a.id] = state.playTime;
    if ((state.player.skills['edge.channel'] ?? 0) > 0) {
      state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 20);
      this.scan(4.5, 32);
      sim.events.emit('toast', { message: 'DEAD CHANNEL // energy reclaimed; threats exposed', tone: 'good' });
      sim.events.emit('state:changed', { reason: 'dead-channel' });
    }
    const district = districtAt(a.entity.position.x, a.entity.position.z);
    state.districts[district.id].heat = Math.min(100, state.districts[district.id].heat + 1.5);
    sim.events.emit('state:changed', { reason: 'enemy-defeated' });
    if (a.light) {
      this.lights.remove(a.light);
      a.light = null;
    }
  }

  updateBossPhase(a, distance) {
    const stage = a.shield > 0 ? 0 : a.health > a.definition.health * 0.5 ? 1 : 2;
    if (stage > a.bossStage) {
      a.bossStage = stage;
      a.bossPulseTimer = stage === 1 ? 2.5 : 1.5;
      this.simulation.events.emit('toast', {
        message: stage === 1 ? 'WHITEOUT PHASE II // firewall shed; EMP geometry active' : 'WHITEOUT PHASE III // civic core overclocked',
        tone: 'bad',
      });
    }
    if (!a.engaged || stage === 0 || a.bossPulseTimer > 0) return;
    a.bossPulseTimer = stage === 2 ? 3.2 : 5;
    if (distance > (stage === 2 ? 18 : 12)) return;
    this.simulation.damagePlayer(stage === 2 ? 16 : 10, 'Whiteout EMP lattice');
    if (stage === 2) {
      this.simulation.state.player.energy = Math.max(0, this.simulation.state.player.energy - 14);
      this.simulation.events.emit('state:changed', { reason: 'whiteout-emp' });
    }
  }
}

/* ------------------------------------------------------------------ landmarks */

const LANDMARK_BODY = { color: '#14182a', metalness: 0.75, gloss: 0.82 };
const landmarkGeometry = new Map();

function buildLandmarkGeometry(def) {
  let g = landmarkGeometry.get(def.id);
  if (g) return g;
  const b = new MeshBuilder(true);
  const glow = { color: def.color, emissive: def.color, emissiveIntensity: 7, metalness: 0.25, gloss: 0.8 };
  const part = (type, position, scale, lit = false, euler = null) => b.add(type, position, scale, euler, lit ? glow : LANDMARK_BODY);
  if (def.kind === 'contact') {
    part('cylinder', [0, 0.5, 0], [0.52, 1.25, 0.52]);
    part('sphere', [0, 1.45, 0], [0.48, 0.58, 0.38]);
    part('box', [0, 1.48, -0.34], [0.32, 0.09, 0.045], true);
    part('box', [-0.55, 0.72, 0], [0.5, 0.18, 0.55], true);
    part('box', [0.55, 0.72, 0], [0.5, 0.18, 0.55], true);
  } else if (def.kind === 'terminal' || def.kind === 'vendor') {
    part('cylinder', [0, -0.35, 0], [0.65, 0.45, 0.65]);
    part('box', [0, 0.35, 0], [0.8, 1.15, 0.42]);
    part('box', [0, 0.52, -0.235], [0.56, 0.42, 0.035], true, [-8, 0, 0]);
  } else if (def.kind === 'safehouse') {
    part('cylinder', [0, 0.4, 0], [0.45, 1.7, 0.45], true);
    part('cone', [0, 1.6, 0], [0.85, 0.7, 0.85]);
  } else {
    part('sphere', [0, 1.2, 0], [1.5, 1.5, 1.5], true);
    part('cylinder', [0, -0.1, 0], [1.8, 0.35, 1.8]);
    part('cone', [0, 3, 0], [1.2, 1.7, 1.2]);
  }
  g = b.build();
  landmarkGeometry.set(def.id, g);
  return g;
}

export class Interactions {
  interactables = new Map();
  focused = null;

  constructor({ scene, baked, simulation, player, enemies, ui }) {
    this.scene = scene;
    this.baked = baked;
    this.simulation = simulation;
    this.player = player;
    this.enemies = enemies;
    this.ui = ui;
    this.unsubscribe = simulation.events.on('hack:result', (r) => {
      if (r.success) this.completeHack(r.target);
    });
  }

  spawn(def, cellId) {
    if (this.interactables.has(def.id)) return;
    const entity = new THREE.Group();
    entity.name = def.name;
    entity.position.set(def.position.x, def.position.y, def.position.z);
    const visual = new THREE.Mesh(buildLandmarkGeometry(def), this.baked.lit);
    visual.castShadow = true;
    visual.receiveShadow = true;
    entity.add(visual);
    this.scene.add(entity);
    this.interactables.set(def.id, { definition: def, entity, visual, cellId, scanTimer: 0 });
  }

  /** Finds what the courier is facing; `input` may be null while gameplay is paused. */
  update(dt, input) {
    const p = this.player.position;
    const f = this.player.forward;
    let best = null;
    const now = performance.now();
    for (const item of this.interactables.values()) {
      item.scanTimer = Math.max(0, item.scanTimer - dt);
      // Echo Scan pulses every scanned landmark (the original only showed it within 5 m).
      item.visual.scale.setScalar(item.scanTimer > 0 ? 1 + Math.sin(now * 0.015) * 0.06 : 1);
      const e = item.entity.position;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dz = e.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 5.2) continue;
      const facing = (dx * f.x + dy * f.y + dz * f.z) / Math.max(dist, 0.001);
      const score = dist - facing * 1.8;
      if (facing > 0.3 && (!best || score < best.score)) best = { item, score };
      if (dist < 2.15 && item.definition.kind === 'safehouse') this.reachSafehouse(item);
      if (dist < 3.2 && item.definition.kind === 'core' && this.simulation.state.quests['city-vote']?.status === 'active' && !this.enemies.has('boss:whiteout'))
        this.simulation.markCollected(`reached:${item.definition.id}`, { type: 'reach', target: item.definition.objectiveTarget ?? 'core.whiteout' });
    }
    this.focused = best?.item ?? null;
    this.ui.setPrompt(this.focused ? this.promptFor(this.focused) : null);
    if (this.focused && input?.pressed('interact')) this.interact(this.focused);
  }

  scan(duration, range = 60) {
    const p = this.player.position;
    for (const item of this.interactables.values()) if (item.entity.position.distanceTo(p) <= range) item.scanTimer = duration;
  }

  removeCell(cellId) {
    for (const [id, item] of this.interactables)
      if (item.cellId === cellId) {
        item.entity.removeFromParent();
        this.interactables.delete(id);
      }
    if (this.focused?.cellId === cellId) this.focused = null;
  }

  destroy() {
    this.unsubscribe();
    for (const item of this.interactables.values()) item.entity.removeFromParent();
    this.interactables.clear();
  }

  promptFor(item) {
    const d = item.definition;
    const quest = this.simulation.state.quests['city-vote']?.status;
    if (d.kind === 'terminal' && this.simulation.state.collected.includes(`landmark:${d.id}`)) return `${d.name} // ACCESS LOGGED`;
    if (d.kind === 'core' && this.enemies.has('boss:whiteout')) return `${d.name} // FIREWALL ENTITY ACTIVE`;
    if (d.kind === 'core' && quest === 'complete') return `${d.name} // CIVIC VOTE RESOLVED`;
    if (d.kind === 'core' && quest !== 'active') return `${d.name} // CIVIC QUORUM INCOMPLETE`;
    const verb = d.kind === 'contact' ? 'TALK' : d.kind === 'terminal' ? 'BREACH' : d.kind === 'vendor' ? 'TRADE' : d.kind === 'core' ? 'ENTER' : 'USE';
    return `<span class="key">${this.ui.keyLabel('interact')}</span> ${verb} // ${d.name}`;
  }

  interact(item) {
    const d = item.definition;
    const sim = this.simulation;
    if (d.kind === 'contact') {
      if (d.objectiveTarget) sim.objective({ type: 'talk', target: d.objectiveTarget });
      if (d.dialogueId) sim.events.emit('dialogue:open', { nodeId: d.dialogueId });
      return;
    }
    if (d.kind === 'terminal') {
      if (sim.state.collected.includes(`landmark:${d.id}`)) {
        sim.events.emit('toast', { message: `${d.name}: already breached`, tone: 'normal' });
        return;
      }
      sim.events.emit('hack:request', { target: d.id, difficulty: d.hackDifficulty ?? 1 });
      return;
    }
    if (d.kind === 'vendor') {
      sim.events.emit('vendor:open', undefined);
      return;
    }
    if (d.kind === 'safehouse') {
      this.reachSafehouse(item);
      sim.state.player.health = sim.state.player.maxHealth;
      sim.state.player.shield = sim.state.player.maxShield;
      sim.events.emit('toast', { message: 'Safehouse services restored', tone: 'good' });
      return;
    }
    if (d.kind === 'core') {
      const status = sim.state.quests['city-vote']?.status;
      if (status === 'complete') {
        sim.events.emit('toast', { message: 'The civic outcome is already committed', tone: 'normal' });
        return;
      }
      if (status !== 'active') {
        sim.events.emit('toast', { message: 'Three civic vote fragments are required', tone: 'bad' });
        return;
      }
      if (this.enemies.has('boss:whiteout')) {
        sim.events.emit('toast', { message: 'Whiteout firewall entity blocks the civic channel', tone: 'bad' });
        return;
      }
      // Talking to the core counts as reaching it (the prompt shows from 5 m, "reached" needed 3 m,
      // so a vote cast from the prompt's edge used to be ignored).
      sim.markCollected(`reached:${d.id}`, { type: 'reach', target: d.objectiveTarget ?? 'core.whiteout' });
      if (d.dialogueId) sim.events.emit('dialogue:open', { nodeId: d.dialogueId });
    }
  }

  reachSafehouse(item) {
    const target = item.definition.objectiveTarget;
    if (target) this.simulation.markCollected(`reached:${item.definition.id}`, { type: 'reach', target });
  }

  completeHack(id) {
    const item = this.interactables.get(id);
    if (!item) return;
    const target = item.definition.objectiveTarget;
    if (!target) return;
    if (!this.simulation.markCollected(`landmark:${id}`, { type: target === 'vote.key' ? 'collect' : 'hack', target })) return;
    if (item.definition.faction) this.simulation.changeReputation(item.definition.faction, -4);
    this.simulation.events.emit('toast', { message: `${item.definition.name} breached`, tone: 'good' });
  }
}

