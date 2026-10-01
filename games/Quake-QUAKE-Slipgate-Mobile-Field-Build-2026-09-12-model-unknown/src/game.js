// The rules: movement, weapons, monsters, waves, pickups and the gate. Runs on a fixed 120 Hz step
// and knows nothing about three.js; view.js draws what draws() reports.
import { clamp, normalize, rayBox, raySphere, sub, length, random } from './math.js';

export const WEAPONS = [
  { id: 'shotgun', name: 'DOUBLE-BARREL', ammo: 'shells', rate: 0.58, damage: 13, pellets: 8, spread: 0.07, rumble: 0.3 },
  { id: 'nailgun', name: 'NAILGUN', ammo: 'nails', rate: 0.105, damage: 18, pellets: 1, spread: 0.012, rumble: 0.08 },
  { id: 'launcher', name: 'ROCKET LAUNCHER', ammo: 'rockets', rate: 0.83, damage: 105, pellets: 1, spread: 0, rumble: 0.45 },
];

/**
 * hitY/hitR: the body sphere shots test against (scaled with the monster), from its feet,
 * or from its centre for fliers. melee/missile damage is per difficulty: easy, normal, hard.
 */
export const ENEMIES = {
  grunt: { name: 'GRUNT', hp: 90, speed: 2.8, scale: 1, hitY: 1.05, hitR: 0.66, melee: [9, 12, 19] },
  imp: { name: 'IMP', hp: 68, speed: 2.8, scale: 1, hitY: 1.05, hitR: 0.66, melee: [9, 12, 19], missile: 'fireball' },
  brute: { name: 'BRUTE', hp: 210, speed: 2.15, scale: 1.38, hitY: 1.05, hitR: 0.66, melee: [20, 26, 26] },
  wraith: { name: 'WRAITH', hp: 55, speed: 3.4, scale: 1, hitY: 0.1, hitR: 0.62, fly: true, missile: 'bolt' },
};

export const DIFFICULTY = {
  easy: { index: 0, label: 'EASY', hp: 0.8, speed: 0.9, rate: 1.3 },
  normal: { index: 1, label: 'NORMAL', hp: 1, speed: 1, rate: 1 },
  hard: { index: 2, label: 'HARD', hp: 1.25, speed: 1.2, rate: 1 },
};
const FIREBALL_DAMAGE = [15, 20, 28];
const BOLT_DAMAGE = [8, 11, 15];
const DEATH_TIME = 0.55;
const MAX_PARTICLES = 160;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Game {
  constructor(world, audio, notify = () => {}) {
    this.world = world;
    this.audio = audio;
    this.notify = notify;
    this.rng = random(1307);
    this.difficulty = 'normal';
    this.onEnd = () => {};
    this.onRumble = () => {};
    this.cam = { pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, fov: 78 };
    this.reset();
  }

  get diff() {
    return DIFFICULTY[this.difficulty] || DIFFICULTY.normal;
  }

  reset() {
    const w = this.world;
    this.player = { pos: [...w.spawn], vel: [0, 0, 0], yaw: w.spawnYaw || 0, pitch: 0, health: 100, armor: 50, ammo: { shells: 48, nails: 160, rockets: 12 }, grounded: true };
    this.weapon = 0;
    this.cooldown = 0;
    this.dashCooldown = 0;
    this.time = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.pellets = 0;
    this.pelletHits = 0;
    this.wave = 0;
    this.waveDelay = 1.5;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.pickups = w.pickups.map((p) => ({ ...p, pos: [...p.pos], taken: false }));
    this.hitTime = 0;
    this.killTime = 0;
    this.damageTime = 0;
    this.kick = 0;
    this.gateOpen = false;
    this.secrets = 0;
    this.active = false;
    this.ended = false;
    this.won = false;
    this.noclip = false;
    this.stepTimer = 0;
    this.lastDamage = -10;
    this.bob = 0;
    this.totalSpawned = 0;
    this.shake = 0;
    this.land = 0;
    this.roll = 0;
    this.switchTime = 0;
    this.flash = 0;
    this.blast = { pos: [0, 0, 0], power: 0 };
  }

  start() {
    this.reset();
    this.active = true;
    if (this.world.imported) this.notify('LOCAL MAP · N toggles free flight. Quake scripts are not loaded.');
    else this.notify(`CLEAR ${this.world.waves.length === 3 ? 'THREE' : 'FOUR'} WAVES. REACH THE SLIPGATE.`);
    this.audio.start();
  }

  selectWeapon(index) {
    if (index === this.weapon || !WEAPONS[index]) return;
    this.weapon = index;
    this.switchTime = 0.22;
    this.cooldown = Math.max(this.cooldown, 0.12);
    this.audio.play('swap');
    this.notify(WEAPONS[index].name);
  }

  cycleWeapon(step = 1) {
    this.selectWeapon((this.weapon + step + WEAPONS.length) % WEAPONS.length);
  }

  /** The strongest weapon that still has ammo (rockets are never picked for you). */
  bestLoadedWeapon() {
    const a = this.player.ammo;
    if (a.shells > 0) return 0;
    if (a.nails > 0) return 1;
    if (a.rockets > 0) return 2;
    return this.weapon;
  }

  spawnWave() {
    this.wave++;
    const list = this.world.waves[this.wave - 1] || [];
    const p = this.player.pos;
    const d = this.diff;
    let walk = 0;
    let air = 0;
    for (const type of list) {
      const def = ENEMIES[type];
      const spots = def.fly ? this.world.airSpots : this.world.spots;
      // Take the next spot in turn, skipping any the player is standing on.
      let s = spots[0];
      for (let tries = 0; tries < spots.length; tries++) {
        s = spots[(def.fly ? air++ : walk++) % spots.length];
        if (Math.hypot(s[0] - p[0], s[1] - p[2]) >= 6) break;
      }
      const floor = this.world.floorAt(s[0], s[1], 0.8);
      const hp = def.hp * d.hp;
      this.enemies.push({
        type,
        pos: [s[0], def.fly ? floor + 2.8 : floor, s[1]],
        health: hp,
        max: hp,
        yaw: 0,
        attack: 1 + this.rng(),
        hit: 0,
        phase: this.rng() * 6,
        scale: def.scale,
        dying: 0,
        orbit: this.rng() < 0.5 ? -1 : 1,
        sight: 0,
        clear: false,
        stuck: 0,
        brave: 0,
      });
    }
    this.totalSpawned += list.length;
    this.notify(`WAVE ${String(this.wave).padStart(2, '0')} / ${String(this.world.waves.length).padStart(2, '0')} · ${list.length} HOSTILES`);
    this.audio.play('gate');
  }

  hurt(amount) {
    if (this.ended || amount <= 0) return;
    const p = this.player;
    const absorbed = Math.min(p.armor, amount * 0.65);
    p.armor -= absorbed;
    p.health = Math.max(0, p.health - (amount - absorbed));
    this.damageTime = 0.45;
    this.lastDamage = this.time;
    this.shake = Math.min(1, this.shake + amount / 40);
    this.onRumble(Math.min(1, 0.25 + amount / 40), 140);
    this.audio.play('hurt');
    if (p.health <= 0) {
      this.active = false;
      this.ended = true;
      this.won = false;
      this.audio.play('die');
      this.onEnd(false);
    }
  }

  wallDistance(origin, dir, max = 100) {
    let best = max;
    if (this.world.imported) return best;
    for (const b of this.world.colliders) {
      const d = rayBox(origin, dir, b, best);
      if (d !== null && d < best) best = d;
    }
    return best;
  }

  /** Where shots and splash test a monster: the centre of its body sphere. */
  centerOf(e, out = [0, 0, 0]) {
    const def = ENEMIES[e.type];
    out[0] = e.pos[0];
    out[1] = e.pos[1] + def.hitY * e.scale;
    out[2] = e.pos[2];
    return out;
  }

  emit(pos, n = 8, model = 'spark', speed = 3) {
    for (let i = 0; i < n && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push({
        pos: [pos[0], pos[1], pos[2]],
        vel: [(this.rng() - 0.5) * speed, (this.rng() * 0.8 + 0.2) * speed, (this.rng() - 0.5) * speed],
        life: 0.2 + this.rng() * 0.48,
        model,
      });
    }
  }

  damageEnemy(e, amount) {
    if (e.health <= 0) return;
    e.health -= amount;
    e.hit = 0.15;
    this.hits++;
    this.hitTime = 0.13;
    this.audio.play('hit');
    const c = this.centerOf(e);
    this.emit(c, 4);
    if (e.health <= 0) {
      this.kills++;
      e.dying = DEATH_TIME;
      this.killTime = 0.3;
      this.emit(c, 14, 'spark', 4);
      this.emit(c, 8, e.type === 'wraith' ? 'mote' : 'gib', 3.5);
      this.audio.play(e.type === 'brute' ? 'dieBig' : e.type === 'wraith' ? 'dieWraith' : 'kill');
      this.onRumble(0.18, 60);
      if (this.rng() < 0.35) {
        const floor = this.world.floorAt(e.pos[0], e.pos[2], e.pos[1] + 0.2);
        this.pickups.push({ kind: this.rng() < 0.65 ? 'shells' : 'health', pos: [e.pos[0], floor + 0.5, e.pos[2]], taken: false });
      }
      if (!this.enemies.some((x) => x !== e && x.health > 0)) this.waveDelay = 2.8;
    }
  }

  shoot(aimAssist = false) {
    if (this.cooldown > 0 || !this.active) return;
    const p = this.player;
    let w = WEAPONS[this.weapon];
    if (p.ammo[w.ammo] <= 0) {
      // Out of ammo: change to something loaded, like the original game does.
      const next = this.bestLoadedWeapon();
      if (next !== this.weapon) {
        this.selectWeapon(next);
        return;
      }
      this.cooldown = 0.45;
      this.audio.play('empty');
      this.notify('NO AMMO · FIND A PACK');
      return;
    }
    p.ammo[w.ammo]--;
    this.shots++;
    this.cooldown = w.rate;
    this.kick = 1;
    this.flash = 1;
    this.audio.play(w.id);
    this.onRumble(w.rumble, w.id === 'nailgun' ? 30 : 90);
    if (w.id === 'launcher') this.shake = Math.min(1, this.shake + 0.25);
    let yaw = p.yaw;
    let pitch = p.pitch;
    const origin = [p.pos[0], p.pos[1] + 1.5, p.pos[2]];
    if (aimAssist) {
      // Bend the shot towards the closest monster near the crosshair, once.
      let best = 0.075;
      let by = 0;
      let bp = 0;
      const c = [0, 0, 0];
      for (const e of this.enemies) {
        if (e.health <= 0) continue;
        this.centerOf(e, c);
        c[1] += 0.1;
        const v = sub(c, origin);
        const distance = length(v);
        if (distance > 24) continue;
        const dy = wrapAngle(Math.atan2(-v[0], -v[2]) - yaw);
        const dp = Math.asin(v[1] / distance) - pitch;
        const diff = Math.hypot(dy, dp);
        if (diff < best && this.wallDistance(origin, normalize(v), distance) >= distance - 0.7) {
          best = diff;
          by = dy;
          bp = dp;
        }
      }
      yaw += by * 0.65;
      pitch += bp * 0.65;
    }
    const forward = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    if (w.id === 'launcher') {
      this.pellets++;
      this.projectiles.push({ pos: origin.map((v, i) => v + forward[i] * 0.65), vel: forward.map((v) => v * 22), life: 5, owner: 'player', kind: 'rocket' });
      return;
    }
    const c = [0, 0, 0];
    for (let i = 0; i < w.pellets; i++) {
      const y = yaw + (this.rng() - 0.5) * w.spread;
      const t = pitch + (this.rng() - 0.5) * w.spread;
      const dir = [-Math.sin(y) * Math.cos(t), Math.sin(t), -Math.cos(y) * Math.cos(t)];
      let distance = this.wallDistance(origin, dir, 90);
      let target = null;
      this.pellets++;
      for (const e of this.enemies) {
        if (e.health <= 0) continue;
        const hit = raySphere(origin, dir, this.centerOf(e, c), ENEMIES[e.type].hitR * e.scale);
        if (hit !== null && hit < distance) {
          distance = hit;
          target = e;
        }
      }
      if (target) {
        this.pelletHits++;
        this.damageEnemy(target, w.damage);
      } else if (distance < 89) this.emit(origin.map((v, j) => v + dir[j] * distance), 2, 'spark', 1.8);
    }
  }

  explode(projectile) {
    const p = projectile.pos;
    const pl = this.player;
    const chest = [pl.pos[0], pl.pos[1] + 0.8, pl.pos[2]];
    if (projectile.kind === 'bolt') {
      this.emit(p, 10, 'mote', 3);
      this.audio.play('zap');
      if (length(sub(chest, p)) < 0.9) this.hurt(BOLT_DAMAGE[this.diff.index]);
      return;
    }
    this.emit(p, 27, 'spark', 7);
    this.emit(p, 7, 'smoke', 3);
    this.audio.play('explode');
    this.blast.pos[0] = p[0];
    this.blast.pos[1] = p[1];
    this.blast.pos[2] = p[2];
    this.blast.power = 1;
    const near = length(sub(chest, p));
    if (near < 9) {
      this.shake = Math.min(1, this.shake + (1 - near / 9) * 0.7);
      this.onRumble((1 - near / 9) * 0.7, 200);
    }
    if (projectile.owner === 'player') {
      let landed = false;
      const c = [0, 0, 0];
      for (const e of this.enemies) {
        if (e.health <= 0) continue;
        this.centerOf(e, c);
        const d = length(sub(c, p));
        if (d < 4.5 && this.wallDistance(p, normalize(sub(c, p)), d) >= d - 0.25) {
          landed = true;
          this.damageEnemy(e, Math.max(12, 120 * (1 - d / 4.5)));
        }
      }
      if (landed) this.pelletHits++;
      if (near < 2.8) this.hurt(40 * (1 - near / 2.8));
    } else if (near < 2.3) this.hurt(FIREBALL_DAMAGE[this.diff.index] * (1 - near / 2.8));
  }

  movePlayer(dt, input) {
    const p = this.player;
    let strafe = input.strafe || 0;
    let forward = input.forward || 0;
    const n = Math.hypot(strafe, forward);
    if (n > 1) {
      strafe /= n;
      forward /= n;
    }
    const cy = Math.cos(p.yaw);
    const sy = Math.sin(p.yaw);
    const dx = cy * strafe - sy * forward;
    const dz = -sy * strafe - cy * forward;
    if (this.noclip && this.world.imported) {
      p.pos[0] += dx * dt * 10;
      p.pos[2] += dz * dt * 10;
      p.pos[1] += ((input.jump ? 1 : 0) - (input.sprint || input.dash ? 1 : 0)) * dt * 8;
      return;
    }
    const speed = input.sprint ? 9 : 6.6;
    const friction = p.grounded ? 7.3 : 0.18;
    const horizontal = Math.hypot(p.vel[0], p.vel[2]);
    if (horizontal) {
      const factor = Math.max(0, horizontal - Math.max(horizontal, 2.0) * friction * dt) / horizontal;
      p.vel[0] *= factor;
      p.vel[2] *= factor;
    }
    const current = p.vel[0] * dx + p.vel[2] * dz;
    const accel = Math.min(Math.max(0, speed - current), (p.grounded ? 72 : 20) * dt);
    p.vel[0] += dx * accel;
    p.vel[2] += dz * accel;
    const limit = Math.hypot(p.vel[0], p.vel[2]);
    if (limit > 14) {
      p.vel[0] *= 14 / limit;
      p.vel[2] *= 14 / limit;
    }
    if (input.dash && this.dashCooldown <= 0) {
      // Dash the way you are moving, or straight ahead when standing still.
      const moving = Math.hypot(dx, dz) > 0.05;
      const direction = normalize(moving ? [dx, 0, dz] : [-sy, 0, -cy]);
      p.vel[0] += direction[0] * 7;
      p.vel[2] += direction[2] * 7;
      this.dashCooldown = 1.15;
      this.audio.play('dash');
    }
    if (input.jump && p.grounded) {
      p.vel[1] = 7.8;
      p.grounded = false;
      this.audio.play('jump');
    }
    p.vel[1] -= 22 * dt;
    const world = this.world;
    const moveAxis = (axis) => {
      const next = [p.pos[0], p.pos[1], p.pos[2]];
      next[axis] += p.vel[axis] * dt;
      if (!world.blocked(next[0], next[1], next[2])) {
        p.pos[axis] = next[axis];
        return;
      }
      if (p.grounded && !world.blocked(next[0], next[1] + 0.36, next[2])) {
        p.pos[axis] = next[axis];
        p.pos[1] += 0.36;
      } else p.vel[axis] = 0;
    };
    moveAxis(0);
    moveAxis(2);
    const wasGrounded = p.grounded;
    const fall = p.vel[1];
    const floor = world.floorAt(p.pos[0], p.pos[2], p.pos[1]);
    const nextY = p.pos[1] + p.vel[1] * dt;
    if (nextY <= floor && p.vel[1] <= 0) {
      p.pos[1] = floor;
      p.vel[1] = 0;
      p.grounded = true;
      if (!wasGrounded && fall < -6) {
        this.land = Math.min(1, -fall / 16);
        this.audio.play('land');
      }
    } else if (p.vel[1] > 0 && world.blocked(p.pos[0], nextY, p.pos[2])) p.vel[1] = 0;
    else {
      p.pos[1] = nextY;
      p.grounded = false;
    }
    if (world.clampXZ) {
      p.pos[0] = clamp(p.pos[0], world.clampXZ.min[0], world.clampXZ.max[0]);
      p.pos[2] = clamp(p.pos[2], world.clampXZ.min[1], world.clampXZ.max[1]);
    }
    if (p.pos[1] < world.bounds.min[1] - 15) {
      p.pos = [...world.spawn];
      p.vel = [0, 0, 0];
      this.hurt(20);
    }
    const movement = Math.hypot(p.vel[0], p.vel[2]);
    this.bob += movement * dt * 1.75;
    // Quake's view roll: lean a little into a strafe.
    const side = p.vel[0] * cy - p.vel[2] * sy;
    this.roll += (clamp(-side / 9, -1, 1) * 0.026 - this.roll) * Math.min(1, dt * 10);
    if (movement > 1 && p.grounded) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.36;
        this.audio.play('step');
      }
    }
    if (world.isLava(p.pos) && this.time - this.lastDamage > 0.38) {
      this.hurt(9);
      this.audio.play('sizzle');
    }
  }

  update(dt, input = {}) {
    if (!this.active) return;
    this.time += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.kick = Math.max(0, this.kick - dt * 7);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.killTime = Math.max(0, this.killTime - dt);
    this.damageTime = Math.max(0, this.damageTime - dt);
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.land = Math.max(0, this.land - dt * 4);
    this.switchTime = Math.max(0, this.switchTime - dt);
    this.flash = Math.max(0, this.flash - dt * 14);
    this.blast.power = Math.max(0, this.blast.power - dt * 3.2);
    this.movePlayer(dt, input);
    if (input.fire) this.shoot(input.aimAssist);
    if (!this.world.imported) {
      if (!this.gateOpen && !this.enemies.some((e) => e.health > 0)) {
        this.waveDelay -= dt;
        if (this.waveDelay <= 0) {
          if (this.wave < this.world.waves.length) this.spawnWave();
          else {
            this.gateOpen = true;
            this.notify('THE SLIPGATE IS OPEN. REACH THE BLUE GATE.');
            this.audio.play('open');
          }
        }
      }
      this.updateEnemies(dt);
    }
    this.updateProjectiles(dt);
    this.updateParticles(dt);
    if (this.world.imported) return;
    this.updatePickups();
    const p = this.player;
    if (this.gateOpen && !this.ended && Math.hypot(p.pos[0] - this.world.exit[0], p.pos[2] - this.world.exit[2]) < 2.8) {
      this.active = false;
      this.ended = true;
      this.won = true;
      this.audio.play('win');
      this.onEnd(true);
    }
  }

  updateEnemies(dt) {
    const p = this.player;
    const world = this.world;
    const d = this.diff;
    const origin = [0, 0, 0];
    const target = [p.pos[0], p.pos[1] + 1.05, p.pos[2]];
    let alive = 0;
    for (const e of this.enemies) {
      if (e.health <= 0) {
        e.dying = Math.max(0, e.dying - dt);
        continue;
      }
      alive++;
      const def = ENEMIES[e.type];
      e.hit = Math.max(0, e.hit - dt);
      e.attack -= dt;
      let dx = p.pos[0] - e.pos[0];
      let dz = p.pos[2] - e.pos[2];
      const dist = Math.hypot(dx, dz);
      e.yaw = Math.atan2(-dx, -dz);
      this.centerOf(e, origin);
      if (!def.fly) origin[1] = e.pos[1] + 1.4 * e.scale;
      // Line of sight, refreshed a few times a second rather than every step.
      e.sight -= dt;
      if (e.sight <= 0) {
        e.sight = 0.1 + this.rng() * 0.05;
        const v = sub(target, origin);
        const reach = length(v);
        e.clear = this.wallDistance(origin, normalize(v), reach) > reach - 0.9;
      }
      if (def.fly) {
        this.flyWraith(e, def, dt, dx, dz, dist, origin, target);
        continue;
      }
      if (def.missile && dist < 20 && dist > 3 && e.clear) {
        if (e.attack <= 0) {
          const dir = normalize(sub(target, origin));
          this.projectiles.push({ pos: [...origin], vel: dir.map((v) => v * 8), life: 5, owner: 'enemy', kind: 'fireball' });
          e.attack = (2.1 + this.rng() * 0.6) * d.rate;
          this.audio.play('cast');
        }
      } else if (dist > 1.35 * e.scale) {
        const speed = def.speed * d.speed;
        const step = speed * dt;
        dx /= dist || 1;
        dz /= dist || 1;
        const lavaNow = world.lavaAt?.(e.pos[0], e.pos[2]);
        const safe = (x, z, floor) => e.brave > 0 || lavaNow || floor >= 0.15 || !world.lavaAt?.(x, z);
        let nx = e.pos[0] + dx * step;
        let nz = e.pos[2] + dz * step;
        // The floor under the whole body (0.44 m, the same radius walls use), so a monster steps up
        // onto a low bridge or stair as soon as it touches it instead of being stopped by its edge.
        const floor = world.floorAt(nx, nz, e.pos[1], 0.44);
        let moved = false;
        if (floor < e.pos[1] + 0.4 && !world.blocked(nx, Math.max(e.pos[1], floor), nz, 0.44, 1.8) && safe(nx, nz, floor)) {
          e.pos[0] = nx;
          e.pos[2] = nz;
          e.pos[1] = floor;
          moved = true;
        } else {
          nx = e.pos[0] + dz * step * e.orbit;
          nz = e.pos[2] - dx * step * e.orbit;
          const side = world.floorAt(nx, nz, e.pos[1], 0.44);
          if (side < e.pos[1] + 0.4 && !world.blocked(nx, Math.max(e.pos[1], side), nz, 0.44, 1.8) && safe(nx, nz, side)) {
            e.pos[0] = nx;
            e.pos[2] = nz;
            e.pos[1] = side;
            moved = true;
          } else e.orbit = -e.orbit;
        }
        // A monster that cannot find a way round the lava for a while wades through it.
        e.brave = Math.max(0, e.brave - dt);
        e.stuck = moved ? Math.max(0, e.stuck - dt) : e.stuck + dt;
        if (e.stuck > 2.5) {
          e.stuck = 0;
          e.brave = 3;
        }
      } else if (e.attack <= 0 && e.clear && Math.abs(p.pos[1] - e.pos[1]) < 1.6 * e.scale) {
        this.hurt(def.melee[d.index]);
        e.attack = 0.85;
        this.audio.play(e.type === 'brute' ? 'smash' : 'claw');
      }
    }
    // Keep walkers from standing inside each other.
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i];
      if (a.health <= 0 || ENEMIES[a.type].fly) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j];
        if (b.health <= 0 || ENEMIES[b.type].fly) continue;
        const ox = a.pos[0] - b.pos[0];
        const oz = a.pos[2] - b.pos[2];
        const gap = 0.75 * (a.scale + b.scale);
        const dd = Math.hypot(ox, oz);
        if (dd >= gap || dd < 1e-4) continue;
        const push = (gap - dd) * 0.5;
        const ux = (ox / dd) * push;
        const uz = (oz / dd) * push;
        if (!world.blocked(a.pos[0] + ux, a.pos[1], a.pos[2] + uz, 0.44, 1.8)) {
          a.pos[0] += ux;
          a.pos[2] += uz;
        }
        if (!world.blocked(b.pos[0] - ux, b.pos[1], b.pos[2] - uz, 0.44, 1.8)) {
          b.pos[0] -= ux;
          b.pos[2] -= uz;
        }
      }
    }
    // Forget monsters whose death has played out.
    if (alive < this.enemies.length && this.enemies.some((e) => e.health <= 0 && e.dying <= 0)) {
      this.enemies = this.enemies.filter((e) => e.health > 0 || e.dying > 0);
    }
  }

  /** Wraiths circle at a distance above the floor and spit cyan bolts. */
  flyWraith(e, def, dt, dx, dz, dist, origin, target) {
    const world = this.world;
    const p = this.player;
    const inv = 1 / (dist || 1);
    const ux = dx * inv;
    const uz = dz * inv;
    const want = 7.5;
    const radial = dist > want + 2 ? 1 : dist < want - 2.5 ? -1 : 0;
    let vx = ux * radial + uz * e.orbit * 0.85;
    let vz = uz * radial - ux * e.orbit * 0.85;
    const len = Math.hypot(vx, vz) || 1;
    const step = def.speed * this.diff.speed * dt;
    vx = (vx / len) * step;
    vz = (vz / len) * step;
    const nx = e.pos[0] + vx;
    const nz = e.pos[2] + vz;
    const c = world.clampXZ;
    const outside = c && (nx < c.min[0] + 0.6 || nx > c.max[0] - 0.6 || nz < c.min[1] + 0.6 || nz > c.max[1] - 0.6);
    if (outside || world.blocked(nx, e.pos[1] - 0.7, nz, 0.45, 1.4)) {
      e.orbit = -e.orbit;
      e.stuck += dt;
      if (e.stuck > 1.2) {
        // Boxed in: rise over whatever is in the way.
        e.pos[1] += dt * 2;
      }
    } else {
      e.pos[0] = nx;
      e.pos[2] = nz;
      e.stuck = Math.max(0, e.stuck - dt);
    }
    const ground = world.floorAt(e.pos[0], e.pos[2], e.pos[1]);
    const goal = Math.max(ground + 2.6, p.pos[1] + 1.8) + Math.sin(this.time * 1.6 + e.phase) * 0.35;
    e.pos[1] += (goal - e.pos[1]) * Math.min(1, dt * 1.5);
    if (dist < 22 && e.clear && e.attack <= 0) {
      const dir = normalize(sub(target, origin));
      this.projectiles.push({ pos: [...origin], vel: dir.map((v) => v * 11), life: 4, owner: 'enemy', kind: 'bolt' });
      e.attack = (2.3 + this.rng() * 0.8) * this.diff.rate;
      this.audio.play('shriek');
    }
  }

  updateProjectiles(dt) {
    const p = this.player;
    const c = [0, 0, 0];
    for (const projectile of this.projectiles) {
      projectile.life -= dt;
      const old = projectile.pos;
      const move = [projectile.vel[0] * dt, projectile.vel[1] * dt, projectile.vel[2] * dt];
      const distance = length(move);
      projectile.pos = [old[0] + move[0], old[1] + move[1], old[2] + move[2]];
      let hit;
      if (this.world.imported) hit = this.world.blocked(projectile.pos[0], projectile.pos[1] - 0.75, projectile.pos[2]);
      else hit = this.wallDistance(old, normalize(move), distance) < distance;
      if (projectile.owner === 'player') {
        hit ||= this.enemies.some((e) => e.health > 0 && length(sub(projectile.pos, this.centerOf(e, c))) < 1.3 * ENEMIES[e.type].hitR * e.scale);
      } else hit ||= length(sub(projectile.pos, [p.pos[0], p.pos[1] + 0.8, p.pos[2]])) < 0.65;
      if (hit || projectile.life <= 0) {
        this.explode(projectile);
        projectile.life = -1;
      }
    }
    if (this.projectiles.some((x) => x.life <= 0)) this.projectiles = this.projectiles.filter((x) => x.life > 0);
  }

  updateParticles(dt) {
    const list = this.particles;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const particle = list[i];
      particle.life -= dt;
      if (particle.life <= 0) continue;
      particle.vel[1] -= 9 * dt;
      particle.pos[0] += particle.vel[0] * dt;
      particle.pos[1] += particle.vel[1] * dt;
      particle.pos[2] += particle.vel[2] * dt;
      list[n++] = particle;
    }
    list.length = n;
  }

  updatePickups() {
    const p = this.player;
    for (const item of this.pickups) {
      if (item.taken || Math.hypot(item.pos[0] - p.pos[0], item.pos[2] - p.pos[2]) > 1.1 || Math.abs(item.pos[1] - p.pos[1]) > 1.8) continue;
      // A secret always counts, even at full health, and may top you up past the usual cap.
      const secret = !!item.secret;
      let message = '';
      if (item.kind === 'health') {
        if (!secret && p.health >= 100) continue;
        p.health = Math.min(secret ? 130 : 100, Math.max(p.health, p.health + 30));
        message = secret ? 'SECRET FOUND · HEALTH +30' : 'HEALTH COLLECTED';
      } else if (item.kind === 'armor') {
        if (!secret && p.armor >= 100) continue;
        p.armor = Math.min(secret ? 150 : 100, p.armor + 50);
        message = secret ? 'SECRET FOUND · ARMOR +50' : 'ARMOR COLLECTED';
      } else if (item.kind === 'shells') {
        p.ammo.shells = Math.min(120, p.ammo.shells + 16);
        p.ammo.nails = Math.min(300, p.ammo.nails + 30);
        message = 'AMMO COLLECTED';
      } else if (item.kind === 'rockets') {
        p.ammo.rockets = Math.min(40, p.ammo.rockets + 6);
        message = 'ROCKETS COLLECTED';
      }
      item.taken = true;
      if (secret) {
        this.secrets++;
        this.audio.play('secret');
      } else this.audio.play('pickup');
      this.notify(message);
    }
  }

  /** The camera for this frame (one object, reused). */
  camera(menu = false, elapsed = 0, fov = 78) {
    const cam = this.cam;
    const m = this.world.menuCamera;
    if (menu && !this.world.imported && m) {
      cam.pos[0] = m.pos[0] + Math.sin(elapsed * 0.06) * 0.8;
      cam.pos[1] = m.pos[1];
      cam.pos[2] = m.pos[2];
      cam.yaw = m.yaw + Math.sin(elapsed * 0.07) * 0.025;
      cam.pitch = m.pitch;
      cam.roll = 0;
      cam.fov = m.fov;
      return cam;
    }
    const p = this.player;
    const s = this.shake * this.shake;
    const t = this.time * 60;
    cam.pos[0] = p.pos[0] + Math.sin(t * 1.3) * s * 0.06;
    cam.pos[1] = p.pos[1] + 1.5 + (p.grounded ? Math.sin(this.bob * 2) * 0.025 : 0) - Math.sin(this.land * Math.PI) * 0.12;
    cam.pos[2] = p.pos[2] + Math.cos(t * 1.1) * s * 0.06;
    cam.yaw = p.yaw + Math.sin(t * 0.9) * s * 0.012;
    cam.pitch = p.pitch + this.kick * 0.016 + Math.cos(t * 1.7) * s * 0.014;
    cam.roll = this.roll;
    cam.fov = fov;
    return cam;
  }

  /**
   * Report everything that moves to the view: r.push(model, x, y, z, rx, ry, rz, scale, tintR, tintG, tintB).
   * No allocations: this runs every frame.
   */
  draws(r, menu = false, elapsed = 0) {
    const t = menu ? elapsed : this.time;
    const showcase = menu && !this.world.imported;
    const enemies = showcase ? this.world.menuEnemies || [] : this.enemies;
    for (const e of enemies) {
      const def = ENEMIES[e.type];
      const s = e.scale || def.scale;
      const brute = e.type === 'brute';
      const flash = e.hit > 0 ? e.hit * 8 : 0;
      const tr = (brute ? 1.02 : 1) + flash * 1.1;
      const tg = (brute ? 0.74 : 1) + flash * 0.65;
      const tb = (brute ? 0.62 : 1) + flash * 0.5;
      if (showcase || e.health > 0) {
        if (def.fly) r.push(e.type, e.pos[0], e.pos[1] + (showcase ? Math.sin(t * 1.6) * 0.25 : 0), e.pos[2], Math.sin(t * 2.1 + (e.phase || 0)) * 0.08, e.yaw, Math.sin(t * 1.3 + (e.phase || 0)) * 0.1, s, tr, tg, tb);
        else r.push(e.type, e.pos[0], e.pos[1] + Math.sin(t * 7 + (e.phase || 0)) * 0.025, e.pos[2], 0, e.yaw, 0, s, tr, tg, tb);
      } else if (e.dying > 0) {
        const k = 1 - e.dying / DEATH_TIME;
        if (def.fly) r.push(e.type, e.pos[0], e.pos[1] - k * k * 2.2, e.pos[2], k * 1.1, e.yaw + k * 5, k * 0.6, s * (1 - k * 0.5), 1.6, 1.6, 1.8);
        else r.push(e.type, e.pos[0], e.pos[1] - k * 0.35 * s, e.pos[2], -k * 1.4, e.yaw, k * 0.2, s * (1 - k * 0.15), tr, tg * (1 - k * 0.4), tb * (1 - k * 0.4));
      }
    }
    for (const item of this.pickups) {
      if (!item.taken) r.push(item.kind, item.pos[0], item.pos[1] + Math.sin(t * 2 + item.pos[0]) * 0.13, item.pos[2], 0, t * 0.85, 0, item.secret ? 1.15 : 1, 1, 1, 1);
    }
    if (showcase) return;
    for (const p of this.projectiles) r.push(p.kind === 'bolt' ? 'bolt' : 'fireball', p.pos[0], p.pos[1], p.pos[2], t * 3, t * 5, 0, 1, 1, 1, 1);
    for (const p of this.particles) {
      const s = clamp(p.life / 0.35, 0.15, 1.2);
      r.push(p.model, p.pos[0], p.pos[1], p.pos[2], t * 3, t * 2, 0, s, 1, 1, 1);
    }
  }

  /** The view-model weapon's sway, recoil and the dip while switching. */
  weaponPose(out) {
    const p = this.player;
    const sw = this.switchTime / 0.22;
    out.x = Math.sin(this.bob) * 0.007;
    out.y = -Math.abs(Math.cos(this.bob)) * 0.009 - this.kick * 0.008 - sw * sw * 0.12 - Math.sin(this.land * Math.PI) * 0.02;
    out.z = this.kick * 0.065;
    out.rx = this.kick * 0.045 - sw * 0.5;
    out.rz = this.roll * 0.6;
    out.visible = !this.ended;
    return out;
  }
}
