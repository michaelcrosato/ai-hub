import { buildLevel, PALACE_ORDER } from './levels.js';

export { buildLevel, PALACE_ORDER };

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
const signNonZero = (v, fallback = 1) => Math.abs(v) < 0.0001 ? fallback : Math.sign(v);

export const GAME_TITLE = 'Runeclash: The Hollow Palace';

export const DIFFICULTIES = {
  story: { id: 'story', label: 'Story', damageTaken: 0.6, enemyHp: 0.85 },
  normal: { id: 'normal', label: 'Normal', damageTaken: 1, enemyHp: 1 },
  hard: { id: 'hard', label: 'Hard', damageTaken: 1.4, enemyHp: 1.2 }
};

const DIMS = {
  blob: [0.95, 0.8],
  bone: [0.78, 1.7],
  sentinel: [0.92, 1.95],
  boss: [1.35, 2.65],
  wisp: [0.8, 0.8],
  caster: [0.8, 1.6],
  golem: [1.6, 2.9]
};

const STATS = {
  blob: { hp: 20, damage: 7, speed: 1.7, xp: 18 },
  bone: { hp: 32, damage: 10, speed: 2.15, xp: 26 },
  sentinel: { hp: 48, damage: 12, speed: 1.7, xp: 36 },
  boss: { hp: 138, damage: 14, speed: 2.05, xp: 120 },
  wisp: { hp: 16, damage: 8, speed: 2.6, xp: 22 },
  caster: { hp: 26, damage: 9, speed: 0, xp: 30 },
  golem: { hp: 210, damage: 15, speed: 1.6, xp: 160 }
};

function makeEnemy(id, type, x, groundTop, opts = {}, hpScale = 1) {
  const dims = DIMS[type];
  const stats = STATS[type];
  const hp = Math.max(1, Math.round(stats.hp * hpScale));
  const flying = type === 'wisp';
  const y = flying ? (opts.anchorY ?? groundTop + 2.6) : groundTop + dims[1] / 2;
  return {
    id, type, x, y, vx: 0, vy: 0,
    w: dims[0], h: dims[1], hp, maxHp: hp,
    damage: stats.damage, speed: stats.speed, xp: stats.xp,
    alive: true, grounded: !flying, facing: -1, hurtTimer: 0, invuln: 0,
    attackTimer: 0, attackCooldown: opts.attackCooldown ?? 0.4,
    attackDidHit: false, aiTimer: opts.aiTimer ?? 0, phase: opts.phase ?? 0,
    pattern: Math.round(opts.phase ?? 0),
    spawnX: x, spawnY: y, patrolMin: opts.patrolMin ?? x - 2.5, patrolMax: opts.patrolMax ?? x + 2.5,
    patrolDir: opts.patrolDir ?? 1, guarding: false, bossMove: 0,
    isBoss: type === 'boss' || type === 'golem', flying,
    anchorY: y, mode: 'hover', diveTime: 0, leaping: false, airTime: 0,
    drop: opts.drop ?? null, lastHitAttackId: -1
  };
}

function makePlayer(start) {
  return {
    id: 'player', type: 'player', x: start.x, y: start.y, vx: 0, vy: 0,
    w: 0.72, h: 1.72, facing: 1, grounded: true,
    hp: 80, mana: 60, invuln: 0, hurtTimer: 0,
    attackTimer: 0, attackCooldown: 0, spellCooldown: 0, attackBuffer: 0,
    coyote: 0.1, jumpBuffer: 0, guarding: false,
    swordTier: 1, attackLevel: 0, vitalityLevel: 0, focusLevel: 0, vessels: 0,
    xp: 0, level: 1, attackId: 0, attackHitIds: new Set(),
    deaths: 0
  };
}

const CARRY_KEYS = ['level', 'xp', 'attackLevel', 'vitalityLevel', 'focusLevel', 'swordTier', 'vessels'];

export class GameWorld {
  /**
   * @param {object} [opts]
   * @param {'hollow'|'undercroft'} [opts.palace]
   * @param {'story'|'normal'|'hard'} [opts.difficulty]
   * @param {object} [opts.carry]  player stats carried over from an earlier palace
   */
  constructor({ palace = 'hollow', difficulty = 'normal', carry = null } = {}) {
    this.level = buildLevel(palace);
    this.diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    this.carry = carry;
    this.reset();
  }

  reset() {
    const l = this.level;
    this.time = 0;
    this.player = makePlayer(l.start);
    if (this.carry) {
      for (const k of CARRY_KEYS) if (Number.isFinite(this.carry[k])) this.player[k] = this.carry[k];
      this.player.hp = this.maxHp;
      this.player.mana = this.maxMana;
    }
    this.enemies = l.spawns.map((s) => makeEnemy(s.id, s.type, s.x, s.ground, s.opts, this.diff.enemyHp));
    this.projectiles = [];
    this.pickups = [];
    this.nextProjectileId = 1;
    this.nextPickupId = 1;
    this.keyCollected = false;
    this.doorUnlocked = false;
    this.gearCollected = false;
    this.vesselCollected = false;
    this.braziersLit = new Set();
    this.bossFight = false;
    this.bossDefeated = false;
    this.complete = false;
    this.pausedForUpgrade = false;
    this.pendingUpgradeCount = 0;
    this.checkpoint = { x: l.start.x, y: l.start.y, name: l.start.name };
    this.checkpointIndex = 0;
    this.events = [];
    this._solidsKey = -1;
    this._solidsList = null;
    this._objective = '';
    this._emitObjective(true);
  }

  get maxHp() { return 80 + this.player.vitalityLevel * 20 + this.player.vessels * 20; }
  get maxMana() { return 60 + this.player.focusLevel * 20; }
  get attackDamage() { return 12 + this.player.attackLevel * 3 + (this.player.swordTier - 1) * 4; }
  get magicDamage() { return 18 + this.player.focusLevel * 5 + (this.player.swordTier - 1) * 1; }
  get xpToNext() { return 100 + (this.player.level - 1) * 80; }

  get boss() { return this.enemies.find(e => e.isBoss); }

  get lockProgress() {
    return this.level.lock === 'braziers' ? this.braziersLit.size : this.keyCollected ? 1 : 0;
  }

  get objective() {
    const t = this.level.text;
    if (this.complete) return t.cleared;
    if (!this.doorUnlocked) return t.lock[Math.min(t.lock.length - 1, this.lockProgress)];
    if (!this.bossFight && !this.bossDefeated) return t.approach;
    if (!this.bossDefeated) return t.fight;
    return t.claim;
  }

  _emitObjective(force = false) {
    const next = this.objective;
    if (force || next !== this._objective) {
      this._objective = next;
      this.events.push({ type: 'objective', text: next });
    }
  }

  /** The solid boxes right now. Cached: rebuilt only when the gate or the boss barrier changes. */
  get solids() {
    const barrier = this.bossFight && !this.bossDefeated;
    const key = (this.doorUnlocked ? 1 : 0) | (barrier ? 2 : 0);
    if (key !== this._solidsKey || !this._solidsList) {
      const list = [...this.level.solids, ...this.level.boundaries];
      if (!this.doorUnlocked) list.push(this.level.door);
      if (barrier) list.push(this.level.bossBarrier);
      this._solidsList = list;
      this._solidsKey = key;
    }
    return this._solidsList;
  }

  start(continued = false) {
    this.events.push({ type: 'toast', text: continued ? `${this.level.name} — continuing at ${this.checkpoint.name}.` : this.level.text.intro });
    this.events.push({ type: 'sound', name: 'start' });
  }

  update(dt, input = {}) {
    if (this.complete || this.pausedForUpgrade) return;
    dt = clamp(dt, 0, 1 / 20);
    this.time += dt;

    this._updatePlayer(dt, input);
    this._updateEnemies(dt);
    this._updateProjectiles(dt);
    this._updatePickups(dt);
    this._updateMissionTriggers();
    this._emitObjective();
  }

  _updatePlayer(dt, input) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.attackCooldown = Math.max(0, p.attackCooldown - dt);
    p.spellCooldown = Math.max(0, p.spellCooldown - dt);
    if (p.attackTimer > 0) p.attackTimer = Math.max(0, p.attackTimer - dt);

    p.guarding = Boolean(input.guardHeld) && p.attackTimer <= 0 && p.hurtTimer <= 0;

    if (input.jumpPressed) p.jumpBuffer = 0.12;
    else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? 0.11 : Math.max(0, p.coyote - dt);
    // A slash pressed a moment before the last one ends still comes out (input buffering).
    if (input.attackPressed) p.attackBuffer = 0.14;
    else p.attackBuffer = Math.max(0, p.attackBuffer - dt);

    const move = clamp(input.moveX ?? 0, -1, 1);
    const maxSpeed = p.guarding ? 2.35 : 5.1;
    const target = move * maxSpeed;
    const accel = p.grounded ? 36 : 19;
    p.vx = approach(p.vx, target, accel * dt);
    if (Math.abs(move) > 0.12 && p.attackTimer <= 0) p.facing = signNonZero(move, p.facing);

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = 10.2;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.events.push({ type: 'sound', name: 'jump' });
    }

    if (p.attackBuffer > 0 && p.attackCooldown <= 0 && p.hurtTimer <= 0) {
      p.attackTimer = 0.34;
      p.attackCooldown = 0.42;
      p.attackBuffer = 0;
      p.attackId += 1;
      p.attackHitIds.clear();
      p.guarding = false;
      this.events.push({ type: 'sound', name: 'slash' });
    }

    if (input.magicPressed && p.spellCooldown <= 0 && p.mana >= 12 && p.hurtTimer <= 0) {
      p.mana -= 12;
      p.spellCooldown = 0.52;
      this.projectiles.push({
        id: `spark-${this.nextProjectileId++}`, owner: 'player', type: 'spark',
        x: p.x + p.facing * 0.75, y: p.y + 0.18, vx: p.facing * 9.2, vy: 0,
        w: 0.34, h: 0.34, damage: this.magicDamage, life: 1.6, alive: true
      });
      this.events.push({ type: 'sound', name: 'magic' });
      this.events.push({ type: 'burst', x: p.x + p.facing * 0.65, y: p.y + 0.2, color: '#73f3ff', count: 7 });
    } else if (input.magicPressed && p.mana < 12) {
      this.events.push({ type: 'toast', text: 'Not enough focus energy.' });
      this.events.push({ type: 'sound', name: 'empty' });
    }

    if (input.interactPressed) this.interact();

    // Active slash window is deliberately generous for touch latency.
    if (p.attackTimer >= 0.10 && p.attackTimer <= 0.25) this._resolvePlayerSlash();

    p.vy -= 22 * dt;
    this._moveBody(p, dt, true);

    for (const hz of this.level.hazards) {
      if (this._overlap(p, hz)) {
        this._burnPlayer(hz);
        break;
      }
    }

    if (p.y < -6) this._respawn('You fell beneath the palace.');
  }

  _resolvePlayerSlash() {
    const p = this.player;
    const hitCenterX = p.x + p.facing * 0.92;
    for (const e of this.enemies) {
      if (!e.alive || p.attackHitIds.has(e.id)) continue;
      const xReach = 0.82 + e.w / 2;
      const yReach = 0.72 + e.h / 2;
      if (Math.abs(e.x - hitCenterX) <= xReach && Math.abs(e.y - p.y) <= yReach) {
        let damage = this.attackDamage;
        const frontHit = signNonZero(p.x - e.x, -e.facing) === e.facing;
        if (e.guarding && frontHit && e.type === 'sentinel') {
          damage = Math.max(2, Math.round(damage * 0.38));
          this.events.push({ type: 'sound', name: 'block' });
          this.events.push({ type: 'burst', x: e.x + e.facing * 0.4, y: e.y + 0.2, color: '#ffd477', count: 5 });
        }
        this._damageEnemy(e, damage, p.facing * 3.2);
        p.attackHitIds.add(e.id);
      }
    }
    for (const b of this.level.braziers) {
      if (this.braziersLit.has(b.id)) continue;
      if (Math.abs(b.x - hitCenterX) <= 0.82 + b.w / 2 && Math.abs(b.y - p.y) <= 0.72 + b.h / 2) this._lightBrazier(b);
    }
  }

  _damageEnemy(e, damage, knockback = 0) {
    if (!e.alive || e.invuln > 0) return;
    e.hp -= damage;
    e.invuln = e.isBoss ? 0.12 : 0.18;
    e.hurtTimer = 0.2;
    e.vx += knockback;
    if (e.type === 'wisp' && e.mode === 'dive') {
      e.mode = 'rise';
      e.aiTimer = 1.2;
    }
    this.events.push({ type: 'sound', name: e.isBoss ? 'bossHit' : 'hit' });
    this.events.push({ type: 'burst', x: e.x, y: e.y + e.h * 0.12, color: '#ffcf6e', count: e.isBoss ? 9 : 6 });
    this.events.push({ type: 'impact', kind: 'hit', power: e.isBoss ? 0.55 : 0.35 });
    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    e.alive = false;
    e.hp = 0;
    e.vx = 0;
    e.vy = 0;
    this._grantXp(e.xp);
    this.events.push({ type: 'sound', name: e.isBoss ? 'bossDown' : 'enemyDown' });
    this.events.push({ type: 'burst', x: e.x, y: e.y, color: e.isBoss ? '#ff7a4d' : '#b8a7ff', count: e.isBoss ? 24 : 10 });
    if (e.drop) this._spawnDrop(e.drop, e.x, e.y + 0.4);
    if (e.isBoss) {
      this.bossDefeated = true;
      this.bossFight = false;
      this.projectiles.length = 0;
      this.events.push({ type: 'toast', text: this.level.boss.defeatText });
      this.events.push({ type: 'checkpoint', text: `${this.level.boss.name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())} defeated` });
      this.events.push({ type: 'shake', power: 0.9 });
      this.events.push({ type: 'save' });
      this._emitObjective();
    }
  }

  _spawnDrop(type, x, y) {
    this.pickups.push({ id: `drop-${this.nextPickupId++}`, type, x, y, baseY: y, age: 0, alive: true });
  }

  _grantXp(amount) {
    this.player.xp += amount;
    this.events.push({ type: 'xp', amount });
    this._checkLevelUp();
  }

  _checkLevelUp() {
    const p = this.player;
    if (this.pendingUpgradeCount > 0 || p.xp < this.xpToNext) return;
    p.xp -= this.xpToNext;
    p.level += 1;
    this.pendingUpgradeCount += 1;
    this.pausedForUpgrade = true;
    this.events.push({ type: 'levelup', level: p.level });
    this.events.push({ type: 'sound', name: 'level' });
  }

  chooseUpgrade(stat) {
    if (!this.pausedForUpgrade || this.pendingUpgradeCount <= 0) return false;
    const p = this.player;
    if (stat === 'attack') p.attackLevel += 1;
    else if (stat === 'vitality') {
      p.vitalityLevel += 1;
      p.hp = Math.min(this.maxHp, p.hp + 28);
    } else if (stat === 'focus') {
      p.focusLevel += 1;
      p.mana = Math.min(this.maxMana, p.mana + 28);
    } else return false;

    this.pendingUpgradeCount -= 1;
    this.pausedForUpgrade = this.pendingUpgradeCount > 0;
    this.events.push({ type: 'toast', text: `${stat[0].toUpperCase() + stat.slice(1)} improved.` });
    this.events.push({ type: 'sound', name: 'upgrade' });
    // Enough experience banked for another level (a boss kill) offers the next choice right away.
    this._checkLevelUp();
    this.events.push({ type: 'save' });
    return true;
  }

  _updateEnemies(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.invuln = Math.max(0, e.invuln - dt);
      e.hurtTimer = Math.max(0, e.hurtTimer - dt);
      e.attackCooldown = Math.max(0, e.attackCooldown - dt);
      e.aiTimer -= dt;
      const dx = p.x - e.x;
      const adx = Math.abs(dx);
      if (adx < 9 && !(e.type === 'golem' && e.leaping)) e.facing = signNonZero(dx, e.facing);

      if (e.type === 'wisp') {
        this._updateWisp(e, dt, dx, adx);
        continue; // flies: no gravity, no floor collision
      }
      if (e.type === 'blob') this._updateBlob(e, dt, dx, adx);
      else if (e.type === 'bone') this._updateBone(e, dt, dx, adx);
      else if (e.type === 'sentinel') this._updateSentinel(e, dt, dx, adx);
      else if (e.type === 'boss') this._updateBoss(e, dt, dx, adx);
      else if (e.type === 'caster') this._updateCaster(e, dt, dx, adx);
      else if (e.type === 'golem') this._updateGolem(e, dt, dx, adx);

      e.vy -= 22 * dt;
      this._moveBody(e, dt, false);

      let lost = e.y < -7;
      if (!lost && !e.isBoss) {
        for (const hz of this.level.hazards) if (this._overlap(e, hz)) { lost = true; break; }
      }
      if (lost && !e.isBoss) {
        e.x = e.spawnX;
        e.y = e.spawnY;
        e.vx = 0;
        e.vy = 0;
      }
    }
  }

  _updateBlob(e, dt, dx, adx) {
    if (e.grounded && e.aiTimer <= 0) {
      let dir = e.patrolDir;
      if (adx < 5.5) dir = signNonZero(dx, dir);
      else if (e.x < e.patrolMin) dir = 1;
      else if (e.x > e.patrolMax) dir = -1;
      e.patrolDir = dir;
      e.vx = dir * (adx < 5.5 ? 2.2 : 1.35);
      e.vy = adx < 3 ? 6.4 : 5.2;
      e.aiTimer = adx < 5.5 ? 0.72 : 1.0;
    }
    if (adx < 0.82 && Math.abs(this.player.y - e.y) < 0.9 && e.attackCooldown <= 0) {
      e.attackCooldown = 0.95;
      this._hurtPlayer(e.damage, e.x, 3.0);
    }
  }

  _updateBone(e, dt, dx, adx) {
    if (e.attackTimer > 0) {
      const prev = e.attackTimer;
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      e.vx = approach(e.vx, 0, 18 * dt);
      if (!e.attackDidHit && prev > 0.22 && e.attackTimer <= 0.22 && adx < 1.38 && Math.abs(this.player.y - e.y) < 1.2) {
        e.attackDidHit = true;
        this._hurtPlayer(e.damage, e.x, 4.3);
      }
      return;
    }
    if (adx < 1.45 && e.attackCooldown <= 0) {
      e.attackTimer = 0.52;
      e.attackCooldown = 0.95;
      e.attackDidHit = false;
      return;
    }
    let dir = e.patrolDir;
    if (adx < 6.5) dir = signNonZero(dx, dir);
    else if (e.x < e.patrolMin) dir = 1;
    else if (e.x > e.patrolMax) dir = -1;
    e.patrolDir = dir;
    e.vx = approach(e.vx, dir * (adx < 6.5 ? e.speed : 1.2), 9 * dt);
  }

  _updateSentinel(e, dt, dx, adx) {
    if (e.attackTimer > 0) {
      const prev = e.attackTimer;
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      e.guarding = false;
      e.vx = approach(e.vx, 0, 20 * dt);
      if (!e.attackDidHit && prev > 0.23 && e.attackTimer <= 0.23 && adx < 1.62 && Math.abs(this.player.y - e.y) < 1.25) {
        e.attackDidHit = true;
        this._hurtPlayer(e.damage, e.x, 5.2);
      }
      return;
    }
    e.guarding = adx < 2.7 && ((Math.floor((this.time + e.phase) * 2.2) % 4) !== 0);
    if (adx < 1.6 && e.attackCooldown <= 0) {
      e.attackTimer = 0.68;
      e.attackCooldown = 1.12;
      e.attackDidHit = false;
      e.guarding = false;
      return;
    }
    const desired = adx < 5.2 ? signNonZero(dx, e.patrolDir) * e.speed : e.patrolDir * 0.7;
    if (e.x < e.patrolMin) e.patrolDir = 1;
    if (e.x > e.patrolMax) e.patrolDir = -1;
    e.vx = approach(e.vx, e.guarding ? desired * 0.35 : desired, 8 * dt);
  }

  _updateBoss(e, dt, dx, adx) {
    if (!this.bossFight) {
      e.vx = 0;
      e.guarding = false;
      return;
    }
    if (e.attackTimer > 0) {
      const prev = e.attackTimer;
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      if (e.bossMove === 1) { // heavy slash
        e.vx = approach(e.vx, 0, 24 * dt);
        if (!e.attackDidHit && prev > 0.26 && e.attackTimer <= 0.26 && adx < 1.95 && Math.abs(this.player.y - e.y) < 1.6) {
          e.attackDidHit = true;
          this._hurtPlayer(e.damage + 2, e.x, 6.4);
        }
      } else if (e.bossMove === 2) { // dash
        e.vx = e.facing * 5.7;
        if (!e.attackDidHit && adx < 1.25 && Math.abs(this.player.y - e.y) < 1.6) {
          e.attackDidHit = true;
          this._hurtPlayer(e.damage, e.x, 7.2);
        }
      } else if (e.bossMove === 3) { // bolt windup
        e.vx = 0;
        if (!e.attackDidHit && prev > 0.30 && e.attackTimer <= 0.30) {
          e.attackDidHit = true;
          this._spawnBolt(e, 6.8, 0, 11, 2.2);
        }
      }
      return;
    }

    if (e.attackCooldown <= 0) {
      e.pattern += 1;
      if (adx < 2.0) e.bossMove = 1;
      else if (e.pattern % 3 === 0) e.bossMove = 3;
      else e.bossMove = 2;
      e.attackTimer = e.bossMove === 1 ? 0.76 : e.bossMove === 2 ? 0.60 : 0.74;
      e.attackCooldown = e.hp < e.maxHp * 0.5 ? 0.62 : 0.82;
      e.attackDidHit = false;
      return;
    }

    e.vx = approach(e.vx, signNonZero(dx, e.facing) * e.speed, 7.5 * dt);
  }

  _spawnBolt(e, speed, vy, damage, life = 2.4) {
    this.projectiles.push({
      id: `ash-${this.nextProjectileId++}`, owner: 'enemy', type: 'ash',
      x: e.x + e.facing * (e.w / 2 + 0.25), y: e.y + 0.3, vx: e.facing * speed, vy,
      w: 0.42, h: 0.42, damage, life, alive: true
    });
    this.events.push({ type: 'sound', name: 'enemyMagic' });
  }

  /** Ember wisp: hovers above its post, shadows the player, then dives at them. */
  _updateWisp(e, dt, dx, adx) {
    const p = this.player;
    const near = adx < 8 && Math.abs(p.y - e.anchorY) < 4.6;
    if (e.mode === 'dive') {
      e.diveTime -= dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (this._overlapsAnySolid(e)) {
        e.x -= e.vx * dt;
        e.y -= e.vy * dt;
        e.diveTime = 0;
      }
      if (e.diveTime <= 0) {
        e.mode = 'rise';
        e.aiTimer = 1.5 + (e.phase % 1) * 0.6;
      }
    } else if (e.mode === 'windup') {
      e.diveTime -= dt;
      e.vx = approach(e.vx, 0, 10 * dt);
      e.vy = approach(e.vy, 1.2, 10 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.diveTime <= 0) {
        const tx = p.x - e.x;
        const ty = p.y + 0.1 - e.y;
        const len = Math.hypot(tx, ty) || 1;
        e.vx = (tx / len) * 7.2;
        e.vy = (ty / len) * 7.2;
        e.mode = 'dive';
        e.diveTime = 0.55;
      }
    } else {
      const sway = Math.sin(this.time * 0.8 + e.phase);
      const tx = near ? p.x + sway * 2.4 : clamp(e.spawnX + sway * (e.patrolMax - e.patrolMin) * 0.4, e.patrolMin, e.patrolMax);
      const ty = e.anchorY + Math.sin(this.time * 2.1 + e.phase) * 0.3;
      e.vx = approach(e.vx, clamp((tx - e.x) * 2.2, -e.speed, e.speed), 8 * dt);
      e.vy = approach(e.vy, clamp((ty - e.y) * 2.6, -3, 3), 10 * dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.mode === 'rise' && Math.abs(e.y - e.anchorY) < 0.35) e.mode = 'hover';
      if (e.mode === 'hover' && near && adx < 4.2 && e.aiTimer <= 0 && p.y < e.y) {
        e.mode = 'windup';
        e.diveTime = 0.38;
        this.events.push({ type: 'sound', name: 'wisp' });
      }
    }
    e.x = clamp(e.x, e.patrolMin - 4, e.patrolMax + 4);

    if (e.attackCooldown <= 0 && this._overlap(e, p)) {
      e.attackCooldown = 1.0;
      this._hurtPlayer(e.damage, e.x, 3.4);
      if (e.mode === 'dive') {
        e.mode = 'rise';
        e.aiTimer = 1.6;
      }
    }
  }

  /** Ash caster: holds its ground and lobs ash bolts along its floor. */
  _updateCaster(e, dt, dx, adx) {
    e.vx = approach(e.vx, 0, 12 * dt);
    if (e.attackTimer > 0) {
      const prev = e.attackTimer;
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      if (!e.attackDidHit && prev > 0.12 && e.attackTimer <= 0.12) {
        e.attackDidHit = true;
        this._spawnBolt(e, 5.6, 0, e.damage);
      }
      return;
    }
    if (e.attackCooldown <= 0 && adx < 9.5 && Math.abs(this.player.y - e.y) < 2.6) {
      e.attackTimer = 0.62;
      e.attackCooldown = 2.3;
      e.attackDidHit = false;
      this.events.push({ type: 'sound', name: 'cast' });
    }
  }

  /** Cinder Golem: slams (shockwaves both ways), leaps onto the player, sprays ash. */
  _updateGolem(e, dt, dx, adx) {
    if (!this.bossFight) {
      e.vx = 0;
      return;
    }
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.leaping) {
      e.airTime += dt;
      if (e.airTime > 0.15 && e.grounded) {
        e.leaping = false;
        e.vx = 0;
        e.attackCooldown = enraged ? 0.75 : 1.05;
        if (adx < 1.7 && Math.abs(this.player.y - e.y) < 1.9) this._hurtPlayer(e.damage + 2, e.x, 6.8);
        this._spawnShockwaves(e, enraged);
      }
      return;
    }
    if (e.attackTimer > 0) {
      const prev = e.attackTimer;
      e.attackTimer = Math.max(0, e.attackTimer - dt);
      e.vx = approach(e.vx, 0, 24 * dt);
      if (e.bossMove === 1) { // overhead slam
        if (!e.attackDidHit && prev > 0.3 && e.attackTimer <= 0.3) {
          e.attackDidHit = true;
          if (adx < 2.3 && Math.abs(this.player.y - e.y) < 1.9) this._hurtPlayer(e.damage + 3, e.x, 6.6);
          this._spawnShockwaves(e, enraged);
        }
      } else if (e.bossMove === 2) { // crouch, then leap
        if (e.attackTimer <= 0) {
          e.leaping = true;
          e.airTime = 0;
          e.vy = 9.6;
          e.vx = clamp(dx / 0.87, -7.5, 7.5);
          e.grounded = false;
          this.events.push({ type: 'sound', name: 'leap' });
        }
      } else if (e.bossMove === 3) { // cinder spray
        if (!e.attackDidHit && prev > 0.3 && e.attackTimer <= 0.3) {
          e.attackDidHit = true;
          this._spawnBolt(e, 6.4, 0, 11);
          this._spawnBolt(e, 6.0, 1.5, 9);
          this._spawnBolt(e, 6.0, -1.3, 9);
        }
      }
      return;
    }
    if (e.attackCooldown <= 0) {
      e.pattern += 1;
      if (adx < 2.4) e.bossMove = 1;
      else if (e.pattern % 3 === 0) e.bossMove = 3;
      else e.bossMove = 2;
      e.attackTimer = e.bossMove === 1 ? 0.85 : e.bossMove === 2 ? 0.45 : 0.7;
      // Slam and spray: the gap after the move counts from its start. A leap sets its own on landing.
      e.attackCooldown = e.bossMove === 2 ? 99 : e.attackTimer + (enraged ? 0.55 : 0.85);
      e.attackDidHit = false;
      if (e.bossMove !== 2) this.events.push({ type: 'sound', name: e.bossMove === 1 ? 'windup' : 'cast' });
      return;
    }
    e.vx = approach(e.vx, signNonZero(dx, e.facing) * e.speed, 6 * dt);
  }

  _spawnShockwaves(e, enraged) {
    const floor = e.y - e.h / 2;
    const speed = enraged ? 7 : 6.1;
    for (const dir of [-1, 1]) {
      this.projectiles.push({
        id: `wave-${this.nextProjectileId++}`, owner: 'enemy', type: 'wave',
        x: e.x + dir * (e.w / 2 + 0.3), y: floor + 0.34, vx: dir * speed, vy: 0,
        w: 0.55, h: 0.62, damage: 12, life: 2.6, alive: true
      });
    }
    this.events.push({ type: 'sound', name: 'slam' });
    this.events.push({ type: 'shake', power: 0.6 });
    this.events.push({ type: 'burst', x: e.x, y: floor + 0.2, color: '#ff8a4d', count: 14 });
  }

  _updateProjectiles(dt) {
    // Compacted in place (no new array per step). A hit can clear the list mid-loop
    // (boss down, player respawn): stop there instead of writing stale entries back.
    let keep = 0;
    const list = this.projectiles;
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      if (pr.alive) this._stepProjectile(pr, dt);
      if (list.length === 0) return;
      if (pr.alive) list[keep++] = pr;
    }
    list.length = keep;
  }

  _stepProjectile(pr, dt) {
    pr.life -= dt;
    if (pr.life <= 0) { pr.alive = false; return; }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (this._overlapsAnySolid(pr)) {
      pr.alive = false;
      this.events.push({ type: 'burst', x: pr.x, y: pr.y, color: pr.owner === 'player' ? '#75f3ff' : '#ff8055', count: 4 });
      return;
    }

    if (pr.owner === 'player') {
      for (const e of this.enemies) {
        if (!e.alive || !this._overlap(pr, e)) continue;
        this._damageEnemy(e, pr.damage, signNonZero(pr.vx) * 2.2);
        pr.alive = false;
        return;
      }
      for (const b of this.level.braziers) {
        if (this.braziersLit.has(b.id) || !this._overlap(pr, b)) continue;
        this._lightBrazier(b);
        pr.alive = false;
        return;
      }
    } else if (this._overlap(pr, this.player)) {
      this._hurtPlayer(pr.damage, pr.x, signNonZero(pr.vx) * 3.5);
      pr.alive = false;
    }
  }

  _updatePickups(dt) {
    const p = this.player;
    for (const item of this.pickups) {
      if (!item.alive) continue;
      item.age += dt;
      item.y = item.baseY + Math.sin(item.age * 4) * 0.12;
      if (Math.abs(item.x - p.x) < 0.75 && Math.abs(item.y - p.y) < 1.05) {
        if (item.type === 'heal') {
          p.hp = Math.min(this.maxHp, p.hp + 22);
          this.events.push({ type: 'toast', text: 'Vital shard: +22 health.' });
        } else {
          p.mana = Math.min(this.maxMana, p.mana + 24);
          this.events.push({ type: 'toast', text: 'Focus shard: +24 energy.' });
        }
        item.alive = false;
        this.events.push({ type: 'sound', name: 'pickup' });
      }
    }
    if (this.pickups.length > 8) this.pickups = this.pickups.filter((item) => item.alive);
  }

  _updateMissionTriggers() {
    const p = this.player;
    const l = this.level;
    for (const cp of l.checkpoints) {
      if (cp.index <= this.checkpointIndex || p.x <= cp.trigger) continue;
      if (cp.needs === 'door' && !this.doorUnlocked) continue;
      if (cp.needs === 'bossAlive' && this.bossDefeated) continue;
      this.checkpointIndex = cp.index;
      this.checkpoint = { x: cp.x, y: cp.y, name: cp.name };
      if (cp.full) {
        p.hp = this.maxHp;
        p.mana = this.maxMana;
      } else {
        p.hp = Math.min(this.maxHp, p.hp + cp.hp);
        p.mana = Math.min(this.maxMana, p.mana + cp.mana);
      }
      this.events.push({ type: 'checkpoint', text: cp.full ? `Checkpoint: ${cp.name} — restored` : `Checkpoint: ${cp.name}` });
      this.events.push({ type: 'sound', name: 'checkpoint' });
      this.events.push({ type: 'save' });
    }
    if (p.x > l.boss.trigger && !this.bossDefeated && !this.bossFight) {
      this.bossFight = true;
      this.events.push({ type: 'toast', text: l.boss.title });
      this.events.push({ type: 'sound', name: 'bossStart' });
      this._emitObjective();
    }
  }

  _hurtPlayer(amount, sourceX, knockback = 4) {
    const p = this.player;
    if (p.invuln > 0) return;
    amount = Math.max(1, Math.round(amount * this.diff.damageTaken));
    const sourceDir = signNonZero(sourceX - p.x, p.facing);
    const frontal = sourceDir === p.facing;
    let finalDamage = amount;
    const guarded = p.guarding && frontal;
    if (guarded) {
      finalDamage = Math.max(1, Math.round(amount * 0.28));
      knockback *= 0.32;
      this.events.push({ type: 'sound', name: 'block' });
      this.events.push({ type: 'burst', x: p.x + p.facing * 0.42, y: p.y + 0.18, color: '#f8d875', count: 5 });
    } else {
      this.events.push({ type: 'sound', name: 'hurt' });
    }
    p.hp -= finalDamage;
    p.invuln = 0.72;
    p.hurtTimer = 0.28;
    p.vx = -sourceDir * knockback;
    p.vy = Math.max(p.vy, 3.2);
    this.events.push({ type: 'playerDamage', amount: finalDamage });
    this.events.push({ type: 'impact', kind: guarded ? 'block' : 'hurt', power: guarded ? 0.25 : 0.7 });
    if (p.hp <= 0) this._respawn('The palace rejects you — checkpoint restored.');
  }

  /** Lava: always burns (invulnerability does not help), then sets the player back on the near bank. */
  _burnPlayer(hz) {
    const p = this.player;
    const damage = Math.max(1, Math.round(14 * this.diff.damageTaken));
    p.hp -= damage;
    this.events.push({ type: 'sound', name: 'burn' });
    this.events.push({ type: 'burst', x: p.x, y: p.y - 0.4, color: '#ff6a2a', count: 12 });
    this.events.push({ type: 'impact', kind: 'hurt', power: 0.7 });
    this.events.push({ type: 'playerDamage', amount: damage });
    if (p.hp <= 0) {
      this._respawn('The lava claims you — checkpoint restored.');
      return;
    }
    p.x = hz.returnX;
    p.y = hz.returnY;
    p.vx = 0;
    p.vy = 0;
    p.invuln = Math.max(p.invuln, 1.0);
    p.attackTimer = 0;
    this.events.push({ type: 'toast', text: `Scorched! −${damage} health.` });
  }

  _respawn(message, countDeath = true) {
    const p = this.player;
    if (countDeath) p.deaths += 1;
    p.hp = this.maxHp;
    p.mana = this.maxMana;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.2;
    p.hurtTimer = 0;
    p.attackTimer = 0;
    p.attackBuffer = 0;
    p.jumpBuffer = 0;
    p.guarding = false;
    // Bolts and shockwaves in flight would otherwise reach the checkpoint.
    this.projectiles.length = 0;
    if (this.bossFight && !this.bossDefeated) {
      this.bossFight = false;
      const b = this.boss;
      if (b?.alive) {
        b.x = this.level.boss.x;
        b.y = this.level.boss.y;
        b.vx = b.vy = 0;
        b.attackTimer = 0;
        b.attackCooldown = 0.7;
        b.leaping = false;
        b.airTime = 0;
        b.guarding = false;
      }
    }
    this.events.push({ type: 'toast', text: message });
    this.events.push({ type: 'sound', name: 'respawn' });
  }

  /** Pause-menu retry: back to the last checkpoint without counting a death. */
  restartFromCheckpoint() {
    this._respawn(`Back at ${this.checkpoint.name}.`, false);
  }

  _near(x, y, radius = 1.45) {
    const p = this.player;
    return Math.abs(p.x - x) <= radius && Math.abs(p.y - y) <= 1.8;
  }

  _doorY() {
    const d = this.level.door;
    return d.y - d.h / 2 + 1.2;
  }

  interactionPrompt() {
    const l = this.level;
    if (l.keyChest && !this.keyCollected && this._near(l.keyChest.x, l.keyChest.y, 1.5)) return 'Open Sun-Key chest';
    if (!this.doorUnlocked && this._near(l.door.x, this._doorY(), 1.6)) {
      if (l.lock === 'braziers') return `Ember Gate · ${this.braziersLit.size}/${l.braziers.length} braziers`;
      return this.keyCollected ? 'Unlock sun gate' : 'Gate needs the Sun Key';
    }
    if (l.gearChest && !this.gearCollected && this._near(l.gearChest.x, l.gearChest.y, 1.55)) return 'Open forge cache';
    if (l.vesselChest && !this.vesselCollected && this._near(l.vesselChest.x, l.vesselChest.y, 1.55)) return 'Open ember vessel chest';
    for (const b of l.braziers) if (!this.braziersLit.has(b.id) && this._near(b.x, b.y, 1.3)) return 'Kindle brazier';
    for (const sign of l.signs) if (this._near(sign.x, sign.y, 1.25)) return 'Read carved slate';
    if (this._near(l.altar.x, l.altar.y, 1.65)) return this.bossDefeated ? `Claim ${l.relic}` : 'Inspect sealed altar';
    return '';
  }

  interact() {
    const p = this.player;
    const l = this.level;
    if (l.keyChest && !this.keyCollected && this._near(l.keyChest.x, l.keyChest.y, 1.5)) {
      this.keyCollected = true;
      this._grantXp(12);
      this.events.push({ type: 'toast', text: 'Sun Key acquired. The lower gate can now open.' });
      this.events.push({ type: 'sound', name: 'key' });
      this.events.push({ type: 'burst', x: l.keyChest.x, y: l.keyChest.y + 0.5, color: '#ffe06a', count: 16 });
      this.events.push({ type: 'save' });
      this._emitObjective();
      return true;
    }
    if (!this.doorUnlocked && this._near(l.door.x, this._doorY(), 1.65)) {
      if (l.lock === 'braziers') {
        this.events.push({ type: 'toast', text: `Three cinder braziers hold this gate. ${this.braziersLit.size} of ${l.braziers.length} burn.` });
        return true;
      }
      if (!this.keyCollected) {
        this.events.push({ type: 'toast', text: 'A sun-shaped lock. The key is somewhere above.' });
        return true;
      }
      this._openDoor('Sun gate opened.');
      return true;
    }
    if (l.gearChest && !this.gearCollected && this._near(l.gearChest.x, l.gearChest.y, 1.55)) {
      this.gearCollected = true;
      p.swordTier = Math.max(p.swordTier, 2);
      p.mana = this.maxMana;
      this.events.push({ type: 'toast', text: 'Forge cache: Ember Edge equipped. Sword damage increased.' });
      this.events.push({ type: 'sound', name: 'upgrade' });
      this.events.push({ type: 'burst', x: l.gearChest.x, y: l.gearChest.y + 0.5, color: '#ff9d55', count: 18 });
      this.events.push({ type: 'save' });
      return true;
    }
    if (l.vesselChest && !this.vesselCollected && this._near(l.vesselChest.x, l.vesselChest.y, 1.55)) {
      this.vesselCollected = true;
      p.vessels += 1;
      p.hp = this.maxHp;
      this.events.push({ type: 'toast', text: 'Vessel of Embers: maximum health +20, fully restored.' });
      this.events.push({ type: 'sound', name: 'upgrade' });
      this.events.push({ type: 'burst', x: l.vesselChest.x, y: l.vesselChest.y + 0.5, color: '#ff6b77', count: 18 });
      this.events.push({ type: 'save' });
      return true;
    }
    for (const b of l.braziers) {
      if (!this.braziersLit.has(b.id) && this._near(b.x, b.y, 1.3)) {
        this._lightBrazier(b);
        return true;
      }
    }
    for (const sign of l.signs) {
      if (this._near(sign.x, sign.y, 1.25)) {
        this.events.push({ type: 'toast', text: sign.text, long: true });
        this.events.push({ type: 'sound', name: 'text' });
        return true;
      }
    }
    if (this._near(l.altar.x, l.altar.y, 1.65)) {
      if (!this.bossDefeated) {
        this.events.push({ type: 'toast', text: 'The altar is cold. A stronger presence still binds the palace.' });
        return true;
      }
      if (!this.complete) {
        this.complete = true;
        this.events.push({ type: 'complete' });
        this.events.push({ type: 'sound', name: 'complete' });
        this._emitObjective();
      }
      return true;
    }
    return false;
  }

  _openDoor(text) {
    this.doorUnlocked = true;
    this.events.push({ type: 'toast', text });
    this.events.push({ type: 'sound', name: 'door' });
    this.events.push({ type: 'shake', power: 0.35 });
    this.events.push({ type: 'save' });
    this._emitObjective();
  }

  _lightBrazier(b) {
    if (this.braziersLit.has(b.id)) return;
    this.braziersLit.add(b.id);
    const lit = this.braziersLit.size;
    const total = this.level.braziers.length;
    this.events.push({ type: 'sound', name: 'brazier' });
    this.events.push({ type: 'burst', x: b.x, y: b.top + 1.0, color: '#ff9a4d', count: 14 });
    if (lit >= total && !this.doorUnlocked) this._openDoor('All three braziers burn. The Ember Gate grinds open.');
    else {
      this.events.push({ type: 'toast', text: `Brazier kindled (${lit}/${total}).` });
      this.events.push({ type: 'save' });
      this._emitObjective();
    }
  }

  _moveBody(body, dt, allowStep) {
    body.grounded = false;
    const solids = this.solids;
    const oldX = body.x;
    body.x += body.vx * dt;
    for (const s of solids) {
      if (!this._overlap(body, s)) continue;
      const bodyBottom = body.y - body.h / 2;
      const stepHeight = s.top - bodyBottom;
      if (allowStep && stepHeight > -0.05 && stepHeight <= 0.58 && body.vy <= 0.5) {
        body.y += stepHeight + 0.003;
        body.grounded = true;
        continue;
      }
      if (body.vx > 0) body.x = s.x - s.w / 2 - body.w / 2 - 0.001;
      else if (body.vx < 0) body.x = s.x + s.w / 2 + body.w / 2 + 0.001;
      else body.x = oldX;
      body.vx = 0;
    }

    const oldY = body.y;
    body.y += body.vy * dt;
    for (const s of this.solids) {
      if (!this._overlap(body, s)) continue;
      if (body.vy <= 0) {
        body.y = s.y + s.h / 2 + body.h / 2 + 0.001;
        body.vy = 0;
        body.grounded = true;
      } else {
        body.y = s.y - s.h / 2 - body.h / 2 - 0.001;
        body.vy = 0;
      }
    }
    if (!Number.isFinite(body.y)) body.y = oldY;
  }

  _overlapsAnySolid(body) {
    const solids = this.solids;
    for (let i = 0; i < solids.length; i++) if (this._overlap(body, solids[i])) return true;
    return false;
  }

  _overlap(a, b) {
    return Math.abs(a.x - b.x) * 2 < (a.w + b.w) && Math.abs(a.y - b.y) * 2 < (a.h + b.h);
  }

  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  debugSetPlayer(x, y) {
    this.player.x = x;
    this.player.y = y;
    this.player.vx = this.player.vy = 0;
  }

  /** Player stats that carry into the next palace. */
  carryStats() {
    const out = {};
    for (const k of CARRY_KEYS) out[k] = this.player[k];
    return out;
  }

  /** Everything needed to continue this run later (checkpoint granularity). */
  snapshot() {
    const p = this.player;
    return {
      v: 1,
      palace: this.level.id,
      difficulty: this.diff.id,
      time: this.time,
      carry: this.carry,
      player: { ...this.carryStats(), deaths: p.deaths },
      pending: this.pendingUpgradeCount,
      flags: {
        keyCollected: this.keyCollected,
        doorUnlocked: this.doorUnlocked,
        gearCollected: this.gearCollected,
        vesselCollected: this.vesselCollected,
        bossDefeated: this.bossDefeated
      },
      braziers: [...this.braziersLit],
      checkpoint: { ...this.checkpoint },
      checkpointIndex: this.checkpointIndex,
      dead: this.enemies.filter((e) => !e.alive).map((e) => e.id)
    };
  }

  /** Rebuild a run from snapshot(); null when the data is unusable. */
  static fromSnapshot(s) {
    if (!s || s.v !== 1 || !PALACE_ORDER.includes(s.palace)) return null;
    const world = new GameWorld({ palace: s.palace, difficulty: s.difficulty, carry: s.carry || null });
    const p = world.player;
    for (const k of CARRY_KEYS) if (Number.isFinite(s.player?.[k])) p[k] = s.player[k];
    p.deaths = Number.isFinite(s.player?.deaths) ? s.player.deaths : 0;
    const f = s.flags || {};
    world.keyCollected = !!f.keyCollected;
    world.doorUnlocked = !!f.doorUnlocked;
    world.gearCollected = !!f.gearCollected;
    world.vesselCollected = !!f.vesselCollected;
    world.bossDefeated = !!f.bossDefeated;
    const valid = new Set(world.level.braziers.map((b) => b.id));
    for (const id of s.braziers || []) if (valid.has(id)) world.braziersLit.add(id);
    if (s.checkpoint && Number.isFinite(s.checkpoint.x) && Number.isFinite(s.checkpoint.y)) {
      world.checkpoint = { x: s.checkpoint.x, y: s.checkpoint.y, name: String(s.checkpoint.name || 'Checkpoint') };
      world.checkpointIndex = Number.isFinite(s.checkpointIndex) ? s.checkpointIndex : 0;
    }
    const dead = new Set(s.dead || []);
    for (const e of world.enemies) {
      if (dead.has(e.id) || (e.isBoss && world.bossDefeated)) {
        e.alive = false;
        e.hp = 0;
      }
    }
    world.time = Number.isFinite(s.time) ? s.time : 0;
    p.x = world.checkpoint.x;
    p.y = world.checkpoint.y;
    p.hp = world.maxHp;
    p.mana = world.maxMana;
    const pending = Math.max(0, Math.min(3, s.pending | 0));
    world.pendingUpgradeCount = pending;
    world.pausedForUpgrade = pending > 0;
    world.events = [];
    world._emitObjective(true);
    return world;
  }
}
