const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const approach = (v, target, delta) => v < target ? Math.min(v + delta, target) : Math.max(v - delta, target);
const signNonZero = (v, fallback = 1) => Math.abs(v) < 0.0001 ? fallback : Math.sign(v);

export const GAME_TITLE = 'Runeclash: The Hollow Palace';

function makeSolid(id, x, top, w, h = 1, kind = 'stone') {
  return { id, x, y: top - h / 2, top, w, h, kind };
}

function makeStepRun(solids, prefix, startX, count, direction, startTop, stepW = 1, stepH = 0.5) {
  for (let i = 0; i < count; i++) {
    const x = startX + direction * (i + 0.5) * stepW;
    const top = startTop + (i + 1) * stepH;
    solids.push(makeSolid(`${prefix}-${i}`, x, top, stepW + 0.04, Math.max(1, top + 1), 'step'));
  }
}

export function buildLevel() {
  const solids = [];
  solids.push(makeSolid('approach', 10, 0, 20, 1.5, 'ground'));
  makeStepRun(solids, 'rise', 20, 8, 1, 0, 1, 0.5);
  solids.push(makeSolid('upper-gallery', 38, 4, 20, 1.5, 'gallery'));

  // Descending stairs are boxes with lower and lower top surfaces.
  for (let i = 0; i < 8; i++) {
    const x = 48.5 + i;
    const top = 3.5 - i * 0.5;
    solids.push(makeSolid(`fall-${i}`, x, top, 1.04, Math.max(1, top + 1), 'step'));
  }

  solids.push(makeSolid('lower-hall', 77.75, 0, 43.5, 1.5, 'ground'));
  solids.push(makeSolid('gear-step', 70, 2.15, 6.5, 0.28, 'balcony'));
  solids.push(makeSolid('gear-ledge', 78.4, 4.3, 7.5, 0.28, 'balcony'));

  // Long, readable stair climb to the boss catwalk.
  makeStepRun(solids, 'boss-rise', 96, 6, 1, 0, 1, 0.5);
  solids.push(makeSolid('boss-catwalk', 119.5, 3, 35, 1.5, 'boss'));

  // Thin catch floor below the optional ledges prevents frustrating soft falls.
  solids.push(makeSolid('catch-floor', 86, -2.5, 22, 0.8, 'catch'));

  const boundaries = [
    { id: 'left-bound', x: -1.5, y: 5, w: 1, h: 14, kind: 'wall' },
    { id: 'right-bound', x: 138.5, y: 5, w: 1, h: 14, kind: 'wall' }
  ];

  return {
    minX: -1,
    maxX: 138,
    solids,
    boundaries,
    door: { id: 'sun-door', x: 58.3, y: 2.6, w: 1.25, h: 5.2, kind: 'door' },
    bossBarrier: { id: 'boss-barrier', x: 104.4, y: 5.7, w: 0.8, h: 5.4, kind: 'barrier' },
    railings: [
      { x: 30, top: 4, w: 3.5 }, { x: 40, top: 4, w: 4 }, { x: 46, top: 4, w: 2 },
      { x: 69.8, top: 2.15, w: 5 }, { x: 78.5, top: 4.3, w: 6 },
      { x: 111, top: 3, w: 6 }, { x: 127, top: 3, w: 7 }
    ],
    columns: [12, 32, 43, 62, 72, 87, 108, 122, 134],
    torches: [6, 28, 45, 64, 85, 101, 113, 129],
    signs: [
      { id: 'sign-controls', x: 4.2, y: 0.65, text: 'Carved slate: Guard from the front. Jump attacks are safest when a knight commits.' },
      { id: 'sign-gate', x: 62.2, y: 0.65, text: 'Palace warning: The upper side ledge hides an old forge cache. It is optional.' }
    ],
    keyChest: { id: 'key-chest', x: 43.5, y: 4.45 },
    gearChest: { id: 'gear-chest', x: 79.2, y: 4.75 },
    altar: { id: 'altar', x: 133.4, y: 3.8 }
  };
}

function makeEnemy(id, type, x, groundTop, opts = {}) {
  const dims = {
    blob: [0.95, 0.8],
    bone: [0.78, 1.7],
    sentinel: [0.92, 1.95],
    boss: [1.35, 2.65]
  }[type];
  const stats = {
    blob: { hp: 20, damage: 7, speed: 1.7, xp: 18 },
    bone: { hp: 32, damage: 10, speed: 2.15, xp: 26 },
    sentinel: { hp: 48, damage: 12, speed: 1.7, xp: 36 },
    boss: { hp: 138, damage: 14, speed: 2.05, xp: 120 }
  }[type];
  return {
    id, type, x, y: groundTop + dims[1] / 2, vx: 0, vy: 0,
    w: dims[0], h: dims[1], hp: stats.hp, maxHp: stats.hp,
    damage: stats.damage, speed: stats.speed, xp: stats.xp,
    alive: true, grounded: true, facing: -1, hurtTimer: 0, invuln: 0,
    attackTimer: 0, attackCooldown: opts.attackCooldown ?? 0.4,
    attackDidHit: false, aiTimer: opts.aiTimer ?? 0, phase: opts.phase ?? 0,
    spawnX: x, patrolMin: opts.patrolMin ?? x - 2.5, patrolMax: opts.patrolMax ?? x + 2.5,
    patrolDir: opts.patrolDir ?? 1, guarding: false, bossMove: 0,
    drop: opts.drop ?? null, lastHitAttackId: -1
  };
}

function makePlayer() {
  return {
    id: 'player', type: 'player', x: 2.4, y: 0.86, vx: 0, vy: 0,
    w: 0.72, h: 1.72, facing: 1, grounded: true,
    hp: 80, mana: 60, invuln: 0, hurtTimer: 0,
    attackTimer: 0, attackCooldown: 0, spellCooldown: 0,
    coyote: 0.1, jumpBuffer: 0, guarding: false,
    swordTier: 1, attackLevel: 0, vitalityLevel: 0, focusLevel: 0,
    xp: 0, level: 1, attackId: 0, attackHitIds: new Set(),
    deaths: 0
  };
}

export class GameWorld {
  constructor() {
    this.level = buildLevel();
    this.reset();
  }

  reset() {
    this.time = 0;
    this.player = makePlayer();
    this.enemies = [
      makeEnemy('blob-a', 'blob', 8.5, 0, { patrolMin: 6, patrolMax: 12, phase: 0.2 }),
      makeEnemy('blob-b', 'blob', 16.0, 0, { patrolMin: 13, patrolMax: 19, phase: 1.1, drop: 'heal' }),
      makeEnemy('bone-a', 'bone', 34.5, 4, { patrolMin: 30, patrolMax: 39, phase: 0.7, drop: 'mana' }),
      makeEnemy('sentinel-a', 'sentinel', 45.0, 4, { patrolMin: 41, patrolMax: 47, phase: 1.7 }),
      makeEnemy('blob-c', 'blob', 65.0, 0, { patrolMin: 61, patrolMax: 69, phase: 2.1 }),
      makeEnemy('bone-b', 'bone', 84.5, 0, { patrolMin: 81, patrolMax: 89, phase: 2.8 }),
      makeEnemy('sentinel-b', 'sentinel', 92.2, 0, { patrolMin: 89, patrolMax: 95, phase: 3.3, drop: 'heal' }),
      makeEnemy('ash-warden', 'boss', 120.0, 3, { patrolMin: 108, patrolMax: 131, phase: 4.1, attackCooldown: 0.8 })
    ];
    this.projectiles = [];
    this.pickups = [];
    this.nextProjectileId = 1;
    this.nextPickupId = 1;
    this.keyCollected = false;
    this.doorUnlocked = false;
    this.gearCollected = false;
    this.bossFight = false;
    this.bossDefeated = false;
    this.complete = false;
    this.pausedForUpgrade = false;
    this.pendingUpgradeCount = 0;
    this.checkpoint = { x: 2.4, y: 0.86, name: 'Palace Approach' };
    this.events = [];
    this._objective = '';
    this._emitObjective(true);
  }

  get maxHp() { return 80 + this.player.vitalityLevel * 20; }
  get maxMana() { return 60 + this.player.focusLevel * 20; }
  get attackDamage() { return 12 + this.player.attackLevel * 3 + (this.player.swordTier - 1) * 4; }
  get magicDamage() { return 18 + this.player.focusLevel * 5 + (this.player.swordTier - 1) * 1; }
  get xpToNext() { return 100 + (this.player.level - 1) * 80; }

  get boss() { return this.enemies.find(e => e.type === 'boss'); }

  get objective() {
    if (this.complete) return 'Hollow Palace cleared';
    if (!this.keyCollected) return 'Find the Sun Key in the upper gallery';
    if (!this.doorUnlocked) return 'Open the sun-locked gate';
    if (!this.bossFight && !this.bossDefeated) return 'Reach the Ash Warden chamber';
    if (!this.bossDefeated) return 'Defeat the Ash Warden';
    return 'Claim the Ember Sigil at the altar';
  }

  _emitObjective(force = false) {
    const next = this.objective;
    if (force || next !== this._objective) {
      this._objective = next;
      this.events.push({ type: 'objective', text: next });
    }
  }

  get solids() {
    const list = [...this.level.solids, ...this.level.boundaries];
    if (!this.doorUnlocked) list.push(this.level.door);
    if (this.bossFight && !this.bossDefeated) list.push(this.level.bossBarrier);
    return list;
  }

  start() {
    this.events.push({ type: 'toast', text: 'Enter the Hollow Palace. Find the Sun Key.' });
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

    if (input.attackPressed && p.attackCooldown <= 0 && p.hurtTimer <= 0) {
      p.attackTimer = 0.34;
      p.attackCooldown = 0.42;
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
    }

    if (input.interactPressed) this.interact();

    // Active slash window is deliberately generous for touch latency.
    if (p.attackTimer >= 0.10 && p.attackTimer <= 0.25) this._resolvePlayerSlash();

    p.vy -= 22 * dt;
    this._moveBody(p, dt, true);

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
  }

  _damageEnemy(e, damage, knockback = 0) {
    if (!e.alive || e.invuln > 0) return;
    e.hp -= damage;
    e.invuln = e.type === 'boss' ? 0.12 : 0.18;
    e.hurtTimer = 0.2;
    e.vx += knockback;
    this.events.push({ type: 'sound', name: e.type === 'boss' ? 'bossHit' : 'hit' });
    this.events.push({ type: 'burst', x: e.x, y: e.y + e.h * 0.12, color: '#ffcf6e', count: e.type === 'boss' ? 9 : 6 });
    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    e.alive = false;
    e.hp = 0;
    e.vx = 0;
    e.vy = 0;
    this._grantXp(e.xp);
    this.events.push({ type: 'sound', name: e.type === 'boss' ? 'bossDown' : 'enemyDown' });
    this.events.push({ type: 'burst', x: e.x, y: e.y, color: e.type === 'boss' ? '#ff7a4d' : '#b8a7ff', count: e.type === 'boss' ? 24 : 10 });
    if (e.drop) this._spawnDrop(e.drop, e.x, e.y + 0.4);
    if (e.type === 'boss') {
      this.bossDefeated = true;
      this.bossFight = false;
      this.events.push({ type: 'toast', text: 'The Ash Warden falls. The Ember Sigil is awake.' });
      this.events.push({ type: 'checkpoint', text: 'Warden defeated' });
      this._emitObjective();
    }
  }

  _spawnDrop(type, x, y) {
    this.pickups.push({ id: `drop-${this.nextPickupId++}`, type, x, y, baseY: y, age: 0, alive: true });
  }

  _grantXp(amount) {
    const p = this.player;
    p.xp += amount;
    this.events.push({ type: 'xp', amount });
    while (p.xp >= this.xpToNext) {
      p.xp -= this.xpToNext;
      p.level += 1;
      this.pendingUpgradeCount += 1;
      this.pausedForUpgrade = true;
      this.events.push({ type: 'levelup', level: p.level });
      this.events.push({ type: 'sound', name: 'level' });
      break;
    }
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
      if (adx < 9) e.facing = signNonZero(dx, e.facing);

      if (e.type === 'blob') this._updateBlob(e, dt, dx, adx);
      else if (e.type === 'bone') this._updateBone(e, dt, dx, adx);
      else if (e.type === 'sentinel') this._updateSentinel(e, dt, dx, adx);
      else if (e.type === 'boss') this._updateBoss(e, dt, dx, adx);

      e.vy -= 22 * dt;
      this._moveBody(e, dt, false);

      if (e.y < -7 && e.type !== 'boss') {
        e.x = e.spawnX;
        e.y = 2;
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
          this.projectiles.push({
            id: `ash-${this.nextProjectileId++}`, owner: 'enemy', type: 'ash',
            x: e.x + e.facing * 0.9, y: e.y + 0.3, vx: e.facing * 6.8, vy: 0,
            w: 0.42, h: 0.42, damage: 11, life: 2.2, alive: true
          });
          this.events.push({ type: 'sound', name: 'enemyMagic' });
        }
      }
      return;
    }

    if (e.attackCooldown <= 0) {
      e.phase += 1;
      if (adx < 2.0) e.bossMove = 1;
      else if (Math.round(e.phase) % 3 === 0) e.bossMove = 3;
      else e.bossMove = 2;
      e.attackTimer = e.bossMove === 1 ? 0.76 : e.bossMove === 2 ? 0.60 : 0.74;
      e.attackCooldown = e.hp < e.maxHp * 0.5 ? 0.62 : 0.82;
      e.attackDidHit = false;
      return;
    }

    e.vx = approach(e.vx, signNonZero(dx, e.facing) * e.speed, 7.5 * dt);
  }

  _updateProjectiles(dt) {
    for (const pr of this.projectiles) {
      if (!pr.alive) continue;
      pr.life -= dt;
      if (pr.life <= 0) { pr.alive = false; continue; }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (this._overlapsAnySolid(pr)) {
        pr.alive = false;
        this.events.push({ type: 'burst', x: pr.x, y: pr.y, color: pr.owner === 'player' ? '#75f3ff' : '#ff8055', count: 4 });
        continue;
      }

      if (pr.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || !this._overlap(pr, e)) continue;
          this._damageEnemy(e, pr.damage, signNonZero(pr.vx) * 2.2);
          pr.alive = false;
          break;
        }
      } else if (this._overlap(pr, this.player)) {
        this._hurtPlayer(pr.damage, pr.x, signNonZero(pr.vx) * 3.5);
        pr.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
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
  }

  _updateMissionTriggers() {
    const p = this.player;
    if (p.x > 60.5 && this.doorUnlocked && this.checkpoint.name !== 'Lower Hall' && this.checkpoint.name !== 'Warden Gate') {
      this.checkpoint = { x: 62.5, y: 0.86, name: 'Lower Hall' };
      p.hp = Math.min(this.maxHp, p.hp + 18);
      p.mana = Math.min(this.maxMana, p.mana + 14);
      this.events.push({ type: 'checkpoint', text: 'Checkpoint: Lower Hall' });
    }
    if (p.x > 102 && !this.bossDefeated && this.checkpoint.name !== 'Warden Gate') {
      this.checkpoint = { x: 102.2, y: 3.86, name: 'Warden Gate' };
      p.hp = this.maxHp;
      p.mana = this.maxMana;
      this.events.push({ type: 'checkpoint', text: 'Checkpoint: Warden Gate — restored' });
    }
    if (p.x > 106.2 && !this.bossDefeated && !this.bossFight) {
      this.bossFight = true;
      this.events.push({ type: 'toast', text: 'ASH WARDEN — Palace Keeper' });
      this.events.push({ type: 'sound', name: 'bossStart' });
      this._emitObjective();
    }
  }

  _hurtPlayer(amount, sourceX, knockback = 4) {
    const p = this.player;
    if (p.invuln > 0) return;
    const sourceDir = signNonZero(sourceX - p.x, p.facing);
    const frontal = sourceDir === p.facing;
    let finalDamage = amount;
    if (p.guarding && frontal) {
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
    if (p.hp <= 0) this._respawn('The palace rejects you — checkpoint restored.');
  }

  _respawn(message) {
    const p = this.player;
    p.deaths += 1;
    p.hp = this.maxHp;
    p.mana = this.maxMana;
    p.x = this.checkpoint.x;
    p.y = this.checkpoint.y;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.2;
    p.attackTimer = 0;
    p.guarding = false;
    if (this.bossFight && !this.bossDefeated) {
      this.bossFight = false;
      const b = this.boss;
      if (b?.alive) {
        b.x = 120;
        b.y = 4.33;
        b.vx = b.vy = 0;
        b.attackTimer = 0;
        b.attackCooldown = 0.7;
      }
    }
    this.events.push({ type: 'toast', text: message });
    this.events.push({ type: 'sound', name: 'respawn' });
  }

  interactionPrompt() {
    const p = this.player;
    const near = (x, y, radius = 1.45) => Math.abs(p.x - x) <= radius && Math.abs(p.y - y) <= 1.8;
    const l = this.level;
    if (!this.keyCollected && near(l.keyChest.x, l.keyChest.y, 1.5)) return 'Open Sun-Key chest';
    if (!this.doorUnlocked && near(l.door.x, 1.2, 1.6)) return this.keyCollected ? 'Unlock sun gate' : 'Gate needs the Sun Key';
    if (!this.gearCollected && near(l.gearChest.x, l.gearChest.y, 1.55)) return 'Open forge cache';
    for (const sign of l.signs) if (near(sign.x, sign.y, 1.25)) return 'Read carved slate';
    if (near(l.altar.x, l.altar.y, 1.65)) return this.bossDefeated ? 'Claim Ember Sigil' : 'Inspect sealed altar';
    return '';
  }

  interact() {
    const p = this.player;
    const near = (x, y, radius = 1.45) => Math.abs(p.x - x) <= radius && Math.abs(p.y - y) <= 1.8;
    const l = this.level;
    if (!this.keyCollected && near(l.keyChest.x, l.keyChest.y, 1.5)) {
      this.keyCollected = true;
      this._grantXp(12);
      this.events.push({ type: 'toast', text: 'Sun Key acquired. The lower gate can now open.' });
      this.events.push({ type: 'sound', name: 'key' });
      this.events.push({ type: 'burst', x: l.keyChest.x, y: l.keyChest.y + 0.5, color: '#ffe06a', count: 16 });
      this._emitObjective();
      return true;
    }
    if (!this.doorUnlocked && near(l.door.x, 1.2, 1.65)) {
      if (!this.keyCollected) {
        this.events.push({ type: 'toast', text: 'A sun-shaped lock. The key is somewhere above.' });
        return true;
      }
      this.doorUnlocked = true;
      this.events.push({ type: 'toast', text: 'Sun gate opened.' });
      this.events.push({ type: 'sound', name: 'door' });
      this._emitObjective();
      return true;
    }
    if (!this.gearCollected && near(l.gearChest.x, l.gearChest.y, 1.55)) {
      this.gearCollected = true;
      p.swordTier = 2;
      p.mana = this.maxMana;
      this.events.push({ type: 'toast', text: 'Forge cache: Ember Edge equipped. Sword damage increased.' });
      this.events.push({ type: 'sound', name: 'upgrade' });
      this.events.push({ type: 'burst', x: l.gearChest.x, y: l.gearChest.y + 0.5, color: '#ff9d55', count: 18 });
      return true;
    }
    for (const sign of l.signs) {
      if (near(sign.x, sign.y, 1.25)) {
        this.events.push({ type: 'toast', text: sign.text, long: true });
        this.events.push({ type: 'sound', name: 'text' });
        return true;
      }
    }
    if (near(l.altar.x, l.altar.y, 1.65)) {
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

  _moveBody(body, dt, allowStep) {
    body.grounded = false;
    let solids = this.solids;
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
    solids = this.solids;
    for (const s of solids) {
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
    return this.solids.some(s => this._overlap(body, s));
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
}
