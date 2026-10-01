// Deterministic gameplay: movement and collision, enemies, the guardian,
// progression, mission state. No DOM and no three.js, so node tests drive it.

import { VAULT_I } from './level.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const overlaps = (a, b) => (
  Math.abs(a.x - b.x) * 2 < (a.w + b.w) &&
  Math.abs(a.y - b.y) * 2 < (a.h + b.h)
);

export const GRAVITY = 27.5;
export const JUMP_SPEED = 10.8;
/** A jump pressed this long before landing still happens on landing. */
export const JUMP_BUFFER = 0.12;
/** A jump pressed this long after walking off a ledge still happens. */
export const COYOTE_TIME = 0.1;

export const XP_THRESHOLDS = [0, 80, 190, 340];
export const DEFAULT_PROFILE = Object.freeze({
  xp: 0,
  level: 1,
  staffLevel: 1,
  coatLevel: 0,
  bestTime: null,
  bestTreasure: 0,
  clears: 0,
  records: null,
});

export const DIFFICULTIES = Object.freeze({
  explorer: Object.freeze({ id: 'explorer', name: 'Explorer', hp: 2, enemySpeed: 0.85, bossSpeed: 0.85, escape: 15, rockRate: 1.3, blurb: '+2 hearts · slower foes · +15 s escape' }),
  normal: Object.freeze({ id: 'normal', name: 'Adventurer', hp: 0, enemySpeed: 1, bossSpeed: 1, escape: 0, rockRate: 1, blurb: 'The vault as it was built' }),
  daredevil: Object.freeze({ id: 'daredevil', name: 'Daredevil', hp: -1, enemySpeed: 1.25, bossSpeed: 1.2, escape: -10, rockRate: 0.75, blurb: '−1 heart · faster foes · −10 s escape' }),
});
export const DIFFICULTY_ORDER = ['explorer', 'normal', 'daredevil'];

export function levelFromXP(xp) {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  return level;
}

/** 0 = off, 1 = sputtering (about to fire), 2 = scalding. Shared with the scene. */
export function ventState(h, t) {
  const period = h.period || 2.4;
  const m = (((t + (h.phase || 0)) % period) + period) % period;
  if (m < (h.on ?? 0.9)) return 2;
  if (m > period - (h.warn ?? 0.45)) return 1;
  return 0;
}

/** Best time / treasure / clears for one expedition at one difficulty. */
export function recordFor(profile, levelId, difficulty) {
  return profile?.records?.[levelId]?.[difficulty] || null;
}

function cloneRecords(records) {
  const out = {};
  if (!records || typeof records !== 'object') return out;
  for (const [lvl, byDiff] of Object.entries(records)) {
    if (!byDiff || typeof byDiff !== 'object') continue;
    out[lvl] = {};
    for (const [d, r] of Object.entries(byDiff)) {
      if (!r || typeof r !== 'object') continue;
      out[lvl][d] = {
        bestTime: Number.isFinite(r.bestTime) ? r.bestTime : null,
        bestTreasure: Number.isFinite(r.bestTreasure) ? r.bestTreasure : 0,
        clears: Number.isFinite(r.clears) ? r.clears : 0,
      };
    }
  }
  return out;
}

export class GameSimulation {
  constructor({ profile = {}, onEvent = () => {}, seed = 1337, level = VAULT_I, difficulty = 'normal' } = {}) {
    this.onEvent = onEvent;
    this.level = level;
    this.diff = DIFFICULTIES[difficulty] || DIFFICULTIES.normal;
    this.profile = { ...DEFAULT_PROFILE, ...profile };
    this.profile.records = cloneRecords(profile.records);
    // Older saves only knew the first vault at one difficulty.
    if (this.profile.bestTime != null && !recordFor(this.profile, VAULT_I.id, 'normal')) {
      this.profile.records[VAULT_I.id] = {
        normal: { bestTime: this.profile.bestTime, bestTreasure: this.profile.bestTreasure || 0, clears: this.profile.clears || 0 },
        ...(this.profile.records[VAULT_I.id] || {}),
      };
    }
    this.profile.level = levelFromXP(this.profile.xp);
    this.rngState = seed >>> 0;
    this.time = 0;

    // Built once per level: stepping never allocates colliders or item lists.
    this.treasures = [...level.coins, ...level.gems];
    this.colliders = level.platforms.map((p) => ({ ...p, baseX: p.x, baseY: p.y, active: true }));
    this.colliderById = new Map(this.colliders.map((c) => [c.id, c]));
    this.gates = {
      key: { id: 'key-gate', ...level.keyGate, barrier: true, active: true },
      arena: { id: 'arena-left-gate', ...level.arenaLeftGate, barrier: true, active: false },
      vault: { id: 'vault-gate', ...level.vaultGate, barrier: true, active: true },
    };
    this.allColliders = [...this.colliders, this.gates.key, this.gates.arena, this.gates.vault];
    this.snapshot = {};
    this.resetRun();
  }

  resetRun() {
    const L = this.level;
    this.time = 0;
    this.runStart = 0;
    this.runCoins = 0;
    this.treasureValue = 0;
    this.deaths = 0;
    this.escapeFails = 0;
    this.collected = new Set();
    this.broken = new Set();
    this.defeated = new Set();
    this.objectiveHinted = new Set();
    this.checkpointsSeen = new Set();
    this.movingRuntime = new Map();
    this.rocks = [];
    this.sparks = [];
    this.rockTimer = 1.4;
    this.hasGear = false;
    this.hasCrown = false;
    this.phase = 'gear';
    this.escapeDuration = Math.max(30, L.escape.time + this.diff.escape);
    this.escapeTime = this.escapeDuration;
    this.completed = false;
    this.jumpBuffer = 0;
    this.checkpointId = 'start';
    const B = L.boss;
    this.boss = {
      x: B.x, y: B.y, baseY: B.y, w: B.w, h: B.h, vx: -B.idleSpeed, vy: 0,
      hp: B.hp, maxHp: B.hp, alive: true, active: false, invuln: 0, airborne: false,
      mode: 'idle', modeTimer: 1.5, facing: -1, name: B.name,
    };
    this.enemyStates = L.enemies.map((e, i) => {
      const bat = e.kind === 'bat';
      return { ...e, kind: e.kind || 'beetle', baseY: e.y, y: e.y, dir: i % 2 ? -1 : 1, alive: true, w: bat ? 0.9 : 0.86, h: bat ? 0.55 : 0.62 };
    });
    for (const c of this.colliders) {
      c.x = c.baseX;
      c.y = c.baseY;
      c.active = true;
    }
    const maxHp = this.getMaxHp();
    this.player = {
      x: L.start.x, y: L.start.y, vx: 0, vy: 0, w: 0.72, h: 1.28,
      hp: maxHp, maxHp, grounded: true, groundId: 'start-floor',
      pogo: false, invuln: 0, facing: 1, coyote: 0,
      checkpointX: L.start.x, checkpointY: L.start.y,
    };
    this.canInteract = false;
    this.updateColliders();
    this.emit('objective', L.text.intro);
  }

  getMaxHp() {
    return Math.max(2, 4 + Math.max(0, this.profile.level - 1) + (this.profile.coatLevel || 0) + this.diff.hp);
  }

  getBounceSpeed() {
    return this.profile.staffLevel >= 2 ? 15.1 : 13.2;
  }

  getBossDamage() {
    return this.profile.staffLevel >= 2 ? 2 : 1;
  }

  getMissionText() {
    const T = this.level.text;
    if (this.completed) return 'Expedition complete';
    if (this.phase === 'gear') return T.findRelic;
    if (this.phase === 'guardian') return this.boss.active ? `${T.bossVerb} · ${this.boss.hp}/${this.boss.maxHp}` : T.reachBoss;
    if (this.phase === 'crown') return T.claim;
    if (this.phase === 'escape') return 'Escape to the entrance';
    return 'Explore the vault';
  }

  getTreasurePercent() {
    return Math.min(100, Math.round((this.treasureValue / this.level.totalTreasureValue) * 100));
  }

  /** One object, refreshed in place: the view and HUD read it every frame. */
  getSnapshot() {
    const s = this.snapshot;
    s.level = this.level;
    s.time = this.time;
    s.profile = this.profile;
    s.player = this.player;
    s.boss = this.boss;
    s.enemies = this.enemyStates;
    s.rocks = this.rocks;
    s.sparks = this.sparks;
    s.phase = this.phase;
    s.hasGear = this.hasGear;
    s.hasCrown = this.hasCrown;
    s.runCoins = this.runCoins;
    s.treasureValue = this.treasureValue;
    s.treasurePercent = this.getTreasurePercent();
    s.escapeTime = this.escapeTime;
    s.canInteract = this.canInteract;
    s.completed = this.completed;
    s.collected = this.collected;
    s.broken = this.broken;
    s.defeated = this.defeated;
    s.movingRuntime = this.movingRuntime;
    s.missionText = this.getMissionText();
    s.deaths = this.deaths;
    return s;
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }

  random() {
    this.rngState = (1664525 * this.rngState + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  /** Move the moving platforms to this.time and switch breakables and gates on or off. */
  updateColliders() {
    for (const c of this.colliders) {
      c.active = !(c.breakable && this.broken.has(c.id));
      if (!c.moving) continue;
      const wave = Math.sin(this.time * c.moving.speed + c.moving.phase) * c.moving.amp;
      if (c.moving.axis === 'y') {
        c.x = c.baseX;
        c.y = c.baseY + wave;
      } else {
        c.x = c.baseX + wave;
        c.y = c.baseY;
      }
      let rt = this.movingRuntime.get(c.id);
      if (!rt) this.movingRuntime.set(c.id, (rt = { x: 0, y: 0 }));
      rt.x = c.x;
      rt.y = c.y;
    }
    this.gates.key.active = !this.hasGear;
    this.gates.arena.active = this.boss.active && this.boss.alive;
    this.gates.vault.active = this.boss.alive;
  }

  step(dt, input = {}) {
    if (this.completed) return this.getSnapshot();
    dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 1 / 20);
    this.time += dt;
    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.boss.invuln = Math.max(0, this.boss.invuln - dt);

    this.updatePlayer(dt, input);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateSparks(dt);
    this.updateCollectibles();
    this.updateHazards();
    this.updateMission(dt);
    this.updateRocks(dt);
    const sh = this.level.shrine;
    this.canInteract = !this.completed && dist2(this.player, sh) < sh.radius ** 2;

    if (input.interactPressed && this.canInteract) this.emit('openUpgrade');
    return this.getSnapshot();
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const L = this.level;
    const move = clamp(input.moveX || 0, -1, 1);
    const accel = p.grounded ? 46 : 29;
    const maxSpeed = 6.15;
    const target = move * maxSpeed;
    p.vx += clamp(target - p.vx, -accel * dt, accel * dt);
    if (Math.abs(move) < 0.05 && p.grounded) p.vx *= Math.pow(0.0008, dt);
    if (Math.abs(move) > 0.08) p.facing = Math.sign(move);

    // Buffered jump and coyote time: a press just before landing or just after
    // stepping off a ledge still jumps (the original needed the exact frame).
    this.jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBuffer - dt);
    p.coyote = p.grounded ? COYOTE_TIME : Math.max(0, p.coyote - dt);
    if (this.jumpBuffer > 0 && (p.grounded || p.coyote > 0) && p.vy <= 0.01) {
      p.vy = JUMP_SPEED;
      p.grounded = false;
      p.coyote = 0;
      p.pogo = false;
      this.jumpBuffer = 0;
      this.emit('sfx', { name: 'jump' });
    }

    if ((input.pogoPressed || input.pogoHeld) && p.grounded) {
      p.pogo = true;
      p.vy = this.getBounceSpeed();
      p.grounded = false;
      p.coyote = 0;
      this.emit('sfx', { name: 'pogo' });
    } else if (input.pogoHeld && !p.grounded && p.vy < 6.5) {
      p.pogo = true;
    } else if (!input.pogoHeld && p.grounded) {
      p.pogo = false;
    }

    p.vy -= GRAVITY * dt;
    this.updateColliders();
    const colliders = this.allColliders;

    // Horizontal pass.
    p.x += p.vx * dt;
    for (const c of colliders) {
      if (!c.active || c.oneWay) continue;
      if (!overlaps(p, c)) continue;
      if (p.vx > 0) p.x = c.x - c.w / 2 - p.w / 2 - 0.001;
      else if (p.vx < 0) p.x = c.x + c.w / 2 + p.w / 2 + 0.001;
      p.vx = 0;
    }

    // Vertical pass.
    const wasGrounded = p.grounded;
    const fallSpeed = p.vy;
    const prevY = p.y;
    const prevBottom = prevY - p.h / 2;
    const prevTop = prevY + p.h / 2;
    p.y += p.vy * dt;
    p.grounded = false;
    p.groundId = null;
    for (const c of colliders) {
      if (!c.active) continue;
      const horizontal = Math.abs(p.x - c.x) * 2 < (p.w + c.w - 0.04);
      if (!horizontal) continue;
      const cTop = c.y + c.h / 2;
      const cBottom = c.y - c.h / 2;
      const nowBottom = p.y - p.h / 2;
      const nowTop = p.y + p.h / 2;

      if (p.vy <= 0 && prevBottom >= cTop - 0.12 && nowBottom <= cTop) {
        if (c.breakable && p.pogo && p.vy < -2) {
          this.broken.add(c.id);
          c.active = false;
          p.y -= 0.08;
          p.vy = Math.min(p.vy, -3.5);
          this.awardXP(8);
          this.runCoins += L.cacheValue;
          this.treasureValue += L.cacheValue;
          this.emit('toast', { text: `Cracked cache! +${L.cacheValue} coins`, tone: 'gold' });
          this.emit('sfx', { name: 'break' });
          this.emit('fx', { kind: 'break', x: c.x, y: cTop });
          continue;
        }
        p.y = cTop + p.h / 2 + 0.001;
        p.grounded = true;
        p.groundId = c.id;
        if (p.pogo && input.pogoHeld !== false) {
          p.vy = this.getBounceSpeed();
          p.grounded = false;
          this.emit('sfx', { name: 'pogo' });
        } else {
          p.vy = 0;
          if (!input.pogoHeld) p.pogo = false;
        }
      } else if (!c.oneWay && p.vy > 0 && prevTop <= cBottom + 0.08 && nowTop >= cBottom) {
        p.y = cBottom - p.h / 2 - 0.001;
        p.vy = 0;
      }
    }
    if (!wasGrounded && p.grounded && fallSpeed < -9) this.emit('fx', { kind: 'land', x: p.x, y: p.y - p.h / 2 });

    // Carry on moving platforms after landing (vertical lifts and sliding carriages).
    if (p.groundId) {
      const base = this.colliderById.get(p.groundId);
      if (base && base.moving) {
        const prevWave = Math.sin((this.time - dt) * base.moving.speed + base.moving.phase) * base.moving.amp;
        if (base.moving.axis === 'y') p.y += base.y - (base.baseY + prevWave);
        else p.x += base.x - (base.baseX + prevWave);
      }
      if (p.grounded) this.touchCheckpoint(p.groundId);
    }

    // The cavern ceiling stops a pogo (no climbing over gates or out of the level).
    const ceiling = L.bounds.ceilingY;
    if (ceiling != null && p.y + p.h / 2 > ceiling) {
      p.y = ceiling - p.h / 2;
      if (p.vy > 0) p.vy = 0;
    }

    p.x = clamp(p.x, L.bounds.minX, L.bounds.maxX);
    if (p.y < L.bounds.killY) this.fallRespawn();
  }

  touchCheckpoint(groundId) {
    for (const cp of this.level.checkpoints) {
      if (cp.ground !== groundId || this.checkpointId === cp.id) continue;
      this.setCheckpoint(cp.id, cp.x, cp.y, cp.label);
    }
  }

  setCheckpoint(id, x, y, label = '') {
    const p = this.player;
    p.checkpointX = x;
    p.checkpointY = y;
    if (this.checkpointId === id) return;
    this.checkpointId = id;
    if (label && !this.checkpointsSeen.has(id)) {
      this.checkpointsSeen.add(id);
      this.emit('toast', { text: `Checkpoint · ${label}`, tone: 'good' });
      this.emit('sfx', { name: 'checkpoint' });
    }
    this.emit('checkpoint', { id });
  }

  updateEnemies(dt) {
    const speedScale = this.diff.enemySpeed;
    for (const e of this.enemyStates) {
      if (!e.alive) continue;
      e.x += e.dir * e.speed * speedScale * dt;
      if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
      if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
      if (e.bob) e.y = e.baseY + Math.sin(this.time * e.bob.speed + e.bob.phase) * e.bob.amp;
      if (!overlaps(this.player, e)) continue;
      const p = this.player;
      const enemyTop = e.y + e.h / 2;
      if (p.pogo && p.vy < 0 && p.y > enemyTop + 0.15) {
        const bat = e.kind === 'bat';
        const reward = bat ? 10 : 8;
        e.alive = false;
        this.defeated.add(e.id);
        p.y = enemyTop + p.h / 2 + 0.05;
        p.vy = this.getBounceSpeed() * 0.84;
        this.runCoins += reward;
        this.awardXP(bat ? 14 : 12);
        this.emit('toast', { text: bat ? `Gearbat grounded · +${reward} coins` : `Clockbug popped · +${reward} coins`, tone: 'good' });
        this.emit('sfx', { name: 'enemy' });
        this.emit('fx', { kind: 'enemy', x: e.x, y: e.y });
      } else if (p.invuln <= 0) {
        this.damagePlayer(1, e.x);
      }
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b.active || !b.alive) return;
    const cfg = this.level.boss;
    const sp = this.diff.bossSpeed;
    b.modeTimer -= dt;
    if (b.mode === 'idle') {
      b.vx = b.facing * cfg.idleSpeed * sp;
      if (b.modeTimer <= 0) {
        b.mode = 'tell';
        b.modeTimer = cfg.tellTime;
        b.vx = 0;
        b.facing = this.player.x < b.x ? -1 : 1;
        this.emit('sfx', { name: 'bossTell' });
      }
    } else if (b.mode === 'tell') {
      b.vx = 0;
      if (b.modeTimer <= 0) {
        b.mode = 'charge';
        b.modeTimer = cfg.chargeTime;
        b.vx = b.facing * cfg.chargeSpeed * sp;
      }
    } else if (b.mode === 'charge') {
      b.vx = b.facing * cfg.chargeSpeed * sp;
      if (b.modeTimer <= 0) {
        if (cfg.hop && !b.airborne) {
          this.startHop(b, cfg);
        } else {
          b.mode = 'idle';
          b.modeTimer = 1.6 + this.random() * 0.8;
          b.facing *= -1;
        }
      }
    } else if (b.mode === 'hop' && !b.airborne) {
      b.mode = 'idle';
      b.modeTimer = 1.4;
    }

    if (b.airborne) {
      b.vy -= GRAVITY * dt;
      b.y += b.vy * dt;
      if (b.y <= b.baseY) {
        b.y = b.baseY;
        b.vy = 0;
        b.airborne = false;
        if (b.mode === 'hop') {
          b.mode = 'idle';
          b.modeTimer = 1.5 + this.random() * 0.7;
          b.vx = 0;
          this.spawnSparks(b);
        }
      }
    }

    b.x += b.vx * dt;
    if (b.x < cfg.minX || b.x > cfg.maxX) {
      b.facing = b.x < cfg.minX ? 1 : -1;
      b.x = clamp(b.x, cfg.minX, cfg.maxX);
      if (b.airborne) b.vx = 0;
      // A hopping guardian that charges into the wall hops straight away; the
      // Brassback (no hop) settles back to idle as it always did.
      else if (cfg.hop && b.mode === 'charge') this.startHop(b, cfg);
      else { b.mode = 'idle'; b.modeTimer = 1.2; }
    }

    if (b.invuln > 0 || !overlaps(this.player, b)) return;
    const p = this.player;
    const bossTop = b.y + b.h / 2;
    if (p.pogo && p.vy < 0 && p.y > bossTop + 0.22) {
      const damage = this.getBossDamage();
      b.hp = Math.max(0, b.hp - damage);
      b.invuln = 0.68;
      p.y = bossTop + p.h / 2 + 0.08;
      p.vy = this.getBounceSpeed() * 0.82;
      b.mode = 'tell';
      b.modeTimer = 0.7;
      b.facing = p.x < b.x ? 1 : -1;
      this.emit('sfx', { name: 'bossHit' });
      this.emit('fx', { kind: 'bossHit', x: p.x, y: bossTop });
      this.emit('toast', { text: `${this.level.text.bossHit} · ${b.hp}/${b.maxHp}`, tone: 'gold' });
      if (b.hp <= 0) this.defeatBoss();
    } else if (p.invuln <= 0) {
      this.damagePlayer(1, b.x);
    }
  }

  /** Hop toward Pennywing; the landing sends sparks along the floor. */
  startHop(b, cfg) {
    b.mode = 'hop';
    b.modeTimer = 3;
    b.airborne = true;
    b.vy = cfg.hop.vy;
    b.facing = this.player.x < b.x ? -1 : 1;
    b.vx = b.facing * cfg.hop.vx * this.diff.bossSpeed;
    this.emit('sfx', { name: 'bossTell' });
  }

  spawnSparks(b) {
    const cfg = this.level.boss.sparks;
    if (!cfg) return;
    const y = this.level.boss.arena.floor + cfg.h / 2 + 0.02;
    for (const dir of [-1, 1]) {
      this.sparks.push({ x: b.x + dir * (b.w / 2), y, vx: dir * cfg.speed * this.diff.bossSpeed, w: cfg.w, h: cfg.h, life: cfg.life });
    }
    this.emit('sfx', { name: 'bossSlam' });
    this.emit('fx', { kind: 'slam', x: b.x, y: this.level.boss.arena.floor });
  }

  updateSparks(dt) {
    if (!this.sparks.length) return;
    const arena = this.level.boss.arena;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.x += s.vx * dt;
      s.life -= dt;
      if (s.life <= 0 || s.x < arena.minX || s.x > arena.maxX) {
        this.sparks.splice(i, 1);
        continue;
      }
      if (this.player.invuln <= 0 && overlaps(this.player, s)) {
        this.sparks.splice(i, 1);
        // A knockout respawn clears the list; one hit per step is all invulnerability allows anyway.
        this.damagePlayer(1, s.x);
        break;
      }
    }
  }

  updateCollectibles() {
    const p = this.player;
    const L = this.level;
    for (const item of this.treasures) {
      if (this.collected.has(item.id)) continue;
      if (dist2(p, item) < 1.05 ** 2) {
        this.collected.add(item.id);
        this.runCoins += item.value;
        this.treasureValue += item.value;
        this.awardXP(item.xp);
        this.emit('sfx', { name: item.kind === 'gem' ? 'gem' : 'coin' });
        this.emit('fx', { kind: item.kind === 'gem' ? 'gem' : 'coin', x: item.x, y: item.y });
      }
    }

    for (const item of L.relics) {
      if (this.collected.has(item.id)) continue;
      if (dist2(p, item) < 1.2 ** 2) {
        this.collected.add(item.id);
        this.hasGear = true;
        if (this.phase === 'gear') this.phase = 'guardian';
        this.awardXP(item.xp);
        this.emit('sfx', { name: 'relic' });
        this.emit('fx', { kind: 'relic', x: item.x, y: item.y });
        this.emit('toast', { text: L.text.relicToast, tone: 'gold' });
        this.emit('objective', L.text.relicObjective);
      }
    }

    if (!this.boss.alive && !this.hasCrown && dist2(p, L.crown) < 1.35 ** 2) {
      this.hasCrown = true;
      this.phase = 'escape';
      this.escapeTime = this.escapeDuration;
      this.rockTimer = 1.4;
      this.setCheckpoint('vault', L.escape.start.x, L.escape.start.y);
      this.emit('sfx', { name: 'crown' });
      this.emit('fx', { kind: 'crown', x: L.crown.x, y: L.crown.y });
      this.emit('objective', L.text.crown);
      this.emit('toast', { text: L.text.crown.toast, tone: 'bad' });
    }
  }

  updateHazards() {
    const p = this.player;
    for (const h of this.level.hazards) {
      if (!overlaps(p, h)) continue;
      if (h.type === 'water') {
        this.fallRespawn();
        return;
      }
      if (h.type === 'vent' && ventState(h, this.time) !== 2) continue;
      if (p.invuln <= 0) this.damagePlayer(1, h.x);
    }
  }

  updateMission(dt) {
    const p = this.player;
    const L = this.level;
    if (!this.hasGear && p.x > L.gateHintX && !this.objectiveHinted.has('gate')) {
      this.objectiveHinted.add('gate');
      this.emit('toast', { text: L.text.gateHint, tone: 'bad' });
    }

    if (this.hasGear && this.boss.alive && !this.boss.active && p.x > L.boss.trigger) {
      this.boss.active = true;
      this.phase = 'guardian';
      this.setCheckpoint('boss', L.boss.checkpoint.x, L.boss.checkpoint.y);
      this.emit('objective', L.text.bossObjective);
      this.emit('sfx', { name: 'bossStart' });
    }

    if (this.phase === 'escape') {
      this.escapeTime -= dt;
      if (this.escapeTime <= 0) {
        this.escapeFails++;
        this.escapeTime = this.escapeDuration;
        this.setCheckpoint('vault', L.escape.start.x, L.escape.start.y);
        p.x = L.escape.start.x; p.y = L.escape.start.y; p.vx = 0; p.vy = 0; p.pogo = false;
        p.hp = p.maxHp; p.invuln = 1.3;
        this.rocks.length = 0;
        this.emit('toast', { text: 'The exit sealed. The vault rewound the chase.', tone: 'bad' });
        this.emit('sfx', { name: 'fail' });
      } else if (p.x < L.exit.x + L.exit.radius && p.y < (L.exit.maxY ?? 2.4)) {
        this.completeRun();
      }
    }
  }

  updateRocks(dt) {
    if (this.phase !== 'escape') {
      this.rocks.length = 0;
      return;
    }
    const E = this.level.escape;
    this.rockTimer -= dt;
    if (this.rockTimer <= 0 && this.rocks.length < 5) {
      this.rockTimer = (1.35 + this.random() * 1.15) * this.diff.rockRate;
      const lead = this.player.facing < 0 ? -1.5 : 1.5;
      this.rocks.push({
        id: `rock-${Math.floor(this.time * 1000)}-${this.rocks.length}`,
        x: clamp(this.player.x + lead + (this.random() - 0.5) * 5.0, E.rockMinX, E.rockMaxX),
        y: E.rockY + this.random() * 2.0,
        vy: -1.0,
        w: 0.72,
        h: 0.72,
        rot: this.random() * Math.PI,
      });
    }
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.vy -= 21 * dt;
      r.y += r.vy * dt;
      r.rot += dt * 4.2;
      if (overlaps(this.player, r) && this.player.invuln <= 0) {
        this.damagePlayer(1, r.x);
        this.emit('fx', { kind: 'rock', x: r.x, y: r.y });
        this.rocks.splice(i, 1);
        continue;
      }
      if (r.y < -5.5) this.rocks.splice(i, 1);
    }
  }

  damagePlayer(amount, sourceX) {
    const p = this.player;
    if (p.invuln > 0) return;
    p.hp -= amount;
    p.invuln = 1.05;
    p.pogo = false;
    p.grounded = false;
    p.vy = 7.5;
    p.vx = (p.x < sourceX ? -1 : 1) * 5.6;
    this.emit('damage', { x: p.x, y: p.y });
    this.emit('sfx', { name: 'hurt' });
    if (p.hp <= 0) this.respawn('Pennywing was rattled back to the last checkpoint.', true);
  }

  fallRespawn() {
    const p = this.player;
    // Just hit: let the knockback play out (unless already below the level).
    if (p.invuln > 0.85 && p.y >= this.level.bounds.killY) return;
    // A fall costs a heart, but not on top of the hit that knocked Pennywing off.
    if (p.invuln <= 0) {
      p.hp -= 1;
      this.emit('damage', { x: p.x, y: p.y, fall: true });
      this.emit('sfx', { name: 'hurt' });
    }
    if (p.hp <= 0) p.hp = p.maxHp;
    this.respawn('Watch the ledges. The vault keeps what falls.');
  }

  respawn(message, fullHeal = false) {
    const p = this.player;
    this.deaths++;
    p.x = p.checkpointX;
    p.y = p.checkpointY;
    p.vx = 0; p.vy = 0; p.pogo = false; p.grounded = false; p.coyote = 0;
    p.hp = fullHeal ? p.maxHp : Math.max(1, p.hp);
    p.invuln = 1.3;
    this.jumpBuffer = 0;
    this.sparks.length = 0;
    this.emit('toast', { text: message, tone: 'bad' });
    this.emit('respawn');
  }

  defeatBoss() {
    const b = this.boss;
    const L = this.level;
    b.alive = false;
    b.active = false;
    b.vx = 0;
    b.vy = 0;
    b.airborne = false;
    b.y = b.baseY;
    this.sparks.length = 0;
    this.phase = 'crown';
    this.runCoins += L.boss.reward.coins;
    this.awardXP(L.boss.reward.xp);
    this.emit('sfx', { name: 'bossDown' });
    this.emit('fx', { kind: 'bossDown', x: b.x, y: b.y });
    this.emit('objective', L.text.bossDown);
    this.emit('toast', { text: L.text.bossDown.toast, tone: 'good' });
  }

  awardXP(amount) {
    if (!amount) return;
    const before = this.profile.level;
    this.profile.xp += amount;
    this.profile.level = levelFromXP(this.profile.xp);
    if (this.profile.level > before) {
      const oldMax = this.player?.maxHp || this.getMaxHp();
      const newMax = this.getMaxHp();
      if (this.player) {
        this.player.maxHp = newMax;
        this.player.hp = Math.min(newMax, this.player.hp + (newMax - oldMax) + 1);
      }
      this.emit('toast', { text: `Explorer level ${this.profile.level}! Max health increased.`, tone: 'good' });
      this.emit('sfx', { name: 'level' });
    }
    this.emit('profile', { profile: this.exportProfile() });
  }

  exportProfile() {
    return { ...this.profile, records: cloneRecords(this.profile.records) };
  }

  getUpgradeInfo() {
    const p = this.player;
    return {
      staff: {
        level: this.profile.staffLevel,
        maxed: this.profile.staffLevel >= 2,
        cost: 70,
        name: 'Springstaff Coil',
        description: 'Raises bounce height and cracks a guardian shell for 2 damage per hit.',
      },
      coat: {
        level: this.profile.coatLevel,
        maxed: this.profile.coatLevel >= 1,
        cost: 60,
        name: 'Riveted Trailcoat',
        description: 'Adds one permanent heart and restores one heart immediately.',
      },
      tonic: {
        level: 0,
        consumable: true,
        maxed: p.hp >= p.maxHp,
        cost: 20,
        name: 'Heart Tonic',
        description: 'Restores two hearts on the spot. Brewed fresh whenever you are hurt.',
        hp: p.hp,
        maxHp: p.maxHp,
      },
    };
  }

  buyUpgrade(type) {
    const info = this.getUpgradeInfo()[type];
    if (!info) return { ok: false, reason: 'unknown' };
    if (info.maxed) return { ok: false, reason: info.consumable ? 'full' : 'maxed' };
    if (this.runCoins < info.cost) return { ok: false, reason: 'coins' };
    this.runCoins -= info.cost;
    const p = this.player;
    if (type === 'staff') this.profile.staffLevel = 2;
    if (type === 'coat') {
      this.profile.coatLevel = 1;
      const oldMax = p.maxHp;
      p.maxHp = this.getMaxHp();
      p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - oldMax) + 1);
    }
    if (type === 'tonic') {
      p.hp = Math.min(p.maxHp, p.hp + 2);
      this.emit('toast', { text: 'Heart Tonic · two hearts restored', tone: 'good' });
      this.emit('sfx', { name: 'tonic' });
      return { ok: true };
    }
    this.emit('profile', { profile: this.exportProfile() });
    this.emit('toast', { text: `${info.name} installed.`, tone: 'good' });
    this.emit('sfx', { name: 'upgrade' });
    return { ok: true };
  }

  completeRun() {
    if (this.completed) return;
    this.completed = true;
    this.phase = 'complete';
    this.canInteract = false;
    const time = this.time;
    const treasure = this.getTreasurePercent();
    const L = this.level;
    const prev = recordFor(this.profile, L.id, this.diff.id);
    const rec = { bestTime: prev?.bestTime ?? null, bestTreasure: prev?.bestTreasure ?? 0, clears: prev?.clears ?? 0 };
    const newBest = rec.bestTime == null || time < rec.bestTime;
    const newTreasure = treasure > rec.bestTreasure;
    rec.clears += 1;
    if (newBest) rec.bestTime = time;
    rec.bestTreasure = Math.max(rec.bestTreasure, treasure);
    if (!this.profile.records[L.id]) this.profile.records[L.id] = {};
    this.profile.records[L.id][this.diff.id] = rec;
    this.profile.clears += 1;
    // The original single record stays the first vault at the standard difficulty.
    if (L.id === VAULT_I.id && this.diff.id === 'normal') {
      this.profile.bestTime = this.profile.bestTime == null ? time : Math.min(this.profile.bestTime, time);
      this.profile.bestTreasure = Math.max(this.profile.bestTreasure || 0, treasure);
    }
    this.emit('profile', { profile: this.exportProfile() });
    this.emit('sfx', { name: 'win' });
    this.emit('complete', {
      stats: {
        time,
        treasure,
        deaths: this.deaths,
        coins: this.runCoins,
        level: this.profile.level,
        escapeFails: this.escapeFails,
        bestTime: rec.bestTime,
        bestTreasure: rec.bestTreasure,
        clears: rec.clears,
        newBest: newBest && prev?.bestTime != null,
        firstClear: prev?.bestTime == null,
        newTreasure: newTreasure && prev != null,
        rank: rankFor(treasure, this.deaths, this.escapeFails),
      },
    });
  }

  /** Everything needed to continue this run later from its last checkpoint. */
  exportRun() {
    const p = this.player;
    return {
      v: 1,
      level: this.level.id,
      difficulty: this.diff.id,
      time: this.time,
      runCoins: this.runCoins,
      treasureValue: this.treasureValue,
      deaths: this.deaths,
      escapeFails: this.escapeFails,
      collected: [...this.collected],
      broken: [...this.broken],
      defeated: [...this.defeated],
      hints: [...this.objectiveHinted],
      seen: [...this.checkpointsSeen],
      hasGear: this.hasGear,
      hasCrown: this.hasCrown,
      phase: this.phase,
      escapeTime: this.escapeTime,
      boss: { alive: this.boss.alive, hp: this.boss.hp },
      checkpoint: { id: this.checkpointId, x: p.checkpointX, y: p.checkpointY },
      hp: p.hp,
    };
  }

  /** Restore a run saved by exportRun(); Pennywing starts at its checkpoint. */
  importRun(d) {
    if (!d || d.v !== 1 || d.level !== this.level.id) return false;
    this.resetRun();
    const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
    const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
    this.time = Math.max(0, num(d.time));
    this.runCoins = Math.max(0, num(d.runCoins));
    this.treasureValue = Math.max(0, num(d.treasureValue));
    this.deaths = Math.max(0, num(d.deaths));
    this.escapeFails = Math.max(0, num(d.escapeFails));
    this.collected = new Set(list(d.collected));
    this.broken = new Set(list(d.broken));
    this.defeated = new Set(list(d.defeated));
    this.objectiveHinted = new Set(list(d.hints));
    this.checkpointsSeen = new Set(list(d.seen));
    this.hasGear = !!d.hasGear;
    this.hasCrown = !!d.hasCrown && this.hasGear;
    const phases = ['gear', 'guardian', 'crown', 'escape'];
    this.phase = phases.includes(d.phase) ? d.phase : 'gear';
    if (this.hasGear && this.phase === 'gear') this.phase = 'guardian';
    for (const e of this.enemyStates) if (this.defeated.has(e.id)) e.alive = false;
    const b = this.boss;
    b.alive = d.boss?.alive !== false;
    b.hp = b.alive ? clamp(Math.round(num(d.boss?.hp, b.maxHp)), 1, b.maxHp) : 0;
    b.active = false;
    if (!b.alive && this.phase === 'guardian') this.phase = 'crown';
    if (this.hasCrown) {
      this.phase = 'escape';
      // A fair restart: at least 20 seconds left on the clock.
      this.escapeTime = clamp(num(d.escapeTime, this.escapeDuration), 20, this.escapeDuration);
    }
    const p = this.player;
    const cp = d.checkpoint || {};
    if (Number.isFinite(cp.x) && Number.isFinite(cp.y)) {
      p.checkpointX = cp.x;
      p.checkpointY = cp.y;
      this.checkpointId = typeof cp.id === 'string' ? cp.id : 'start';
    }
    p.x = p.checkpointX;
    p.y = p.checkpointY;
    p.vx = p.vy = 0;
    p.grounded = false;
    p.invuln = 1.3;
    p.hp = clamp(Math.round(num(d.hp, p.maxHp)), 1, p.maxHp);
    this.updateColliders();
    return true;
  }
}

/** S / A / B / C from treasure found, knockouts and escape resets. */
export function rankFor(treasure, deaths, escapeFails) {
  const score = treasure - deaths * 6 - escapeFails * 10;
  if (score >= 88) return 'S';
  if (score >= 65) return 'A';
  if (score >= 40) return 'B';
  return 'C';
}
