import {
  platforms, hazards, coins, gems, relics, enemies, shrine, keyGate, arenaLeftGate, vaultGate, crown, exit, totalTreasureValue
} from './level.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const overlaps = (a, b) => (
  Math.abs(a.x - b.x) * 2 < (a.w + b.w) &&
  Math.abs(a.y - b.y) * 2 < (a.h + b.h)
);

export const XP_THRESHOLDS = [0, 80, 190, 340];
export const DEFAULT_PROFILE = Object.freeze({
  xp: 0,
  level: 1,
  staffLevel: 1,
  coatLevel: 0,
  bestTime: null,
  bestTreasure: 0,
  clears: 0,
});

export function levelFromXP(xp) {
  let level = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  return level;
}

export class GameSimulation {
  constructor({ profile = {}, onEvent = () => {}, seed = 1337 } = {}) {
    this.onEvent = onEvent;
    this.profile = { ...DEFAULT_PROFILE, ...profile };
    this.profile.level = levelFromXP(this.profile.xp);
    this.rngState = seed >>> 0;
    this.time = 0;
    this.resetRun();
  }

  resetRun() {
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
    this.movingRuntime = new Map();
    this.rocks = [];
    this.rockTimer = 1.4;
    this.hasGear = false;
    this.hasCrown = false;
    this.phase = 'gear';
    this.escapeTime = 55;
    this.completed = false;
    this.boss = {
      x: 71.6, y: 0.82, w: 1.8, h: 1.55, vx: -1.35,
      hp: 5, maxHp: 5, alive: true, active: false, invuln: 0,
      mode: 'idle', modeTimer: 1.5, facing: -1,
    };
    this.enemyStates = enemies.map((e, i) => ({ ...e, y: e.y, dir: i % 2 ? -1 : 1, alive: true, w: 0.86, h: 0.62 }));
    const maxHp = this.getMaxHp();
    this.player = {
      x: 2.2, y: 0.68, vx: 0, vy: 0, w: 0.72, h: 1.28,
      hp: maxHp, maxHp, grounded: true, groundId: 'start-floor',
      pogo: false, invuln: 0, facing: 1,
      checkpointX: 2.2, checkpointY: 0.68,
    };
    this.canInteract = false;
    this.emit('objective', {
      kicker: 'Moon-Vault Expedition',
      title: 'Find the Moon Gear',
      sub: 'Take the high road for speed, or drop below for extra treasure.',
    });
  }

  getMaxHp() {
    return 4 + Math.max(0, this.profile.level - 1) + (this.profile.coatLevel || 0);
  }

  getBounceSpeed() {
    return this.profile.staffLevel >= 2 ? 15.1 : 13.2;
  }

  getBossDamage() {
    return this.profile.staffLevel >= 2 ? 2 : 1;
  }

  getMissionText() {
    if (this.completed) return 'Expedition complete';
    if (this.phase === 'gear') return 'Find the Moon Gear';
    if (this.phase === 'guardian') return this.boss.active ? `Bounce the Brassback Sentinel · ${this.boss.hp}/${this.boss.maxHp}` : 'Reach the Sentinel Chamber';
    if (this.phase === 'crown') return 'Claim the Gilded Moon';
    if (this.phase === 'escape') return 'Escape to the entrance';
    return 'Explore the vault';
  }

  getTreasurePercent() {
    return Math.round((this.treasureValue / totalTreasureValue) * 100);
  }

  getSnapshot() {
    return {
      time: this.time,
      profile: this.profile,
      player: this.player,
      boss: this.boss,
      enemies: this.enemyStates,
      rocks: this.rocks,
      phase: this.phase,
      hasGear: this.hasGear,
      hasCrown: this.hasCrown,
      runCoins: this.runCoins,
      treasureValue: this.treasureValue,
      treasurePercent: this.getTreasurePercent(),
      escapeTime: this.escapeTime,
      canInteract: this.canInteract,
      completed: this.completed,
      collected: this.collected,
      broken: this.broken,
      defeated: this.defeated,
      movingRuntime: this.movingRuntime,
      missionText: this.getMissionText(),
      deaths: this.deaths,
    };
  }

  emit(type, detail = {}) {
    this.onEvent({ type, ...detail });
  }

  random() {
    this.rngState = (1664525 * this.rngState + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  getColliders() {
    const out = [];
    for (const p of platforms) {
      if (p.breakable && this.broken.has(p.id)) continue;
      let x = p.x, y = p.y;
      if (p.moving) {
        const wave = Math.sin(this.time * p.moving.speed + p.moving.phase) * p.moving.amp;
        if (p.moving.axis === 'y') y = p.y + wave;
        else x = p.x + wave;
        this.movingRuntime.set(p.id, { x, y });
      }
      out.push({ ...p, x, y });
    }
    if (!this.hasGear) out.push({ id: 'key-gate', x: keyGate.x, y: keyGate.y, w: keyGate.w, h: keyGate.h, barrier: true });
    if (this.boss.active && this.boss.alive) out.push({ id: 'arena-left-gate', x: arenaLeftGate.x, y: arenaLeftGate.y, w: arenaLeftGate.w, h: arenaLeftGate.h, barrier: true });
    if (this.boss.alive) out.push({ id: 'vault-gate', x: vaultGate.x, y: vaultGate.y, w: vaultGate.w, h: vaultGate.h, barrier: true });
    return out;
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
    this.updateCollectibles();
    this.updateHazards();
    this.updateMission(dt);
    this.updateRocks(dt);
    this.canInteract = dist2(this.player, shrine) < shrine.radius ** 2;

    if (input.interactPressed && this.canInteract) this.emit('openUpgrade');
    return this.getSnapshot();
  }

  updatePlayer(dt, input) {
    const p = this.player;
    const move = clamp(input.moveX || 0, -1, 1);
    const accel = p.grounded ? 46 : 29;
    const maxSpeed = 6.15;
    const target = move * maxSpeed;
    p.vx += clamp(target - p.vx, -accel * dt, accel * dt);
    if (Math.abs(move) < 0.05 && p.grounded) p.vx *= Math.pow(0.0008, dt);
    if (Math.abs(move) > 0.08) p.facing = Math.sign(move);

    if (input.jumpPressed && p.grounded) {
      p.vy = 10.8;
      p.grounded = false;
      p.pogo = false;
      this.emit('sfx', { name: 'jump' });
    }

    if ((input.pogoPressed || input.pogoHeld) && p.grounded) {
      p.pogo = true;
      p.vy = this.getBounceSpeed();
      p.grounded = false;
      this.emit('sfx', { name: 'pogo' });
    } else if (input.pogoHeld && !p.grounded && p.vy < 6.5) {
      p.pogo = true;
    } else if (!input.pogoHeld && p.grounded) {
      p.pogo = false;
    }

    p.vy -= 27.5 * dt;
    const colliders = this.getColliders();

    // Horizontal pass.
    p.x += p.vx * dt;
    for (const c of colliders) {
      if (c.oneWay) continue;
      if (!overlaps(p, c)) continue;
      if (p.vx > 0) p.x = c.x - c.w / 2 - p.w / 2 - 0.001;
      else if (p.vx < 0) p.x = c.x + c.w / 2 + p.w / 2 + 0.001;
      p.vx = 0;
    }

    // Vertical pass.
    const prevY = p.y;
    const prevBottom = prevY - p.h / 2;
    const prevTop = prevY + p.h / 2;
    p.y += p.vy * dt;
    p.grounded = false;
    p.groundId = null;
    for (const c of colliders) {
      const horizontal = Math.abs(p.x - c.x) * 2 < (p.w + c.w - 0.04);
      if (!horizontal) continue;
      const cTop = c.y + c.h / 2;
      const cBottom = c.y - c.h / 2;
      const nowBottom = p.y - p.h / 2;
      const nowTop = p.y + p.h / 2;

      if (p.vy <= 0 && prevBottom >= cTop - 0.12 && nowBottom <= cTop) {
        if (c.breakable && p.pogo && p.vy < -2) {
          this.broken.add(c.id);
          p.y -= 0.08;
          p.vy = Math.min(p.vy, -3.5);
          this.awardXP(8);
          this.runCoins += 15;
          this.treasureValue += 15;
          this.emit('toast', { text: 'Cracked cache! +15 coins', tone: 'gold' });
          this.emit('sfx', { name: 'break' });
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

    // Carry on moving platforms after landing.
    if (p.groundId) {
      const base = platforms.find(x => x.id === p.groundId && x.moving);
      if (base) {
        const rt = this.movingRuntime.get(base.id);
        if (rt) {
          const prevWave = Math.sin((this.time - dt) * base.moving.speed + base.moving.phase) * base.moving.amp;
          if (base.moving.axis === 'y') p.y += (rt.y - (base.y + prevWave));
        }
      }
    }

    p.x = clamp(p.x, 0.45, 89.4);
    if (p.y < -7.2) this.fallRespawn();
  }

  updateEnemies(dt) {
    for (const e of this.enemyStates) {
      if (!e.alive) continue;
      e.x += e.dir * e.speed * dt;
      if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
      if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
      if (!overlaps(this.player, e)) continue;
      const p = this.player;
      const enemyTop = e.y + e.h / 2;
      if (p.pogo && p.vy < 0 && p.y > enemyTop + 0.15) {
        e.alive = false;
        this.defeated.add(e.id);
        p.y = enemyTop + p.h / 2 + 0.05;
        p.vy = this.getBounceSpeed() * 0.84;
        this.runCoins += 8;
        this.awardXP(12);
        this.emit('toast', { text: 'Clockbug popped · +8 coins', tone: 'good' });
        this.emit('sfx', { name: 'enemy' });
      } else if (p.invuln <= 0) {
        this.damagePlayer(1, e.x);
      }
    }
  }

  updateBoss(dt) {
    const b = this.boss;
    if (!b.active || !b.alive) return;
    b.modeTimer -= dt;
    if (b.mode === 'idle') {
      b.vx = b.facing * 1.35;
      if (b.modeTimer <= 0) {
        b.mode = 'tell';
        b.modeTimer = 0.55;
        b.vx = 0;
        b.facing = this.player.x < b.x ? -1 : 1;
        this.emit('sfx', { name: 'bossTell' });
      }
    } else if (b.mode === 'tell') {
      b.vx = 0;
      if (b.modeTimer <= 0) {
        b.mode = 'charge';
        b.modeTimer = 0.9;
        b.vx = b.facing * 5.0;
      }
    } else if (b.mode === 'charge') {
      b.vx = b.facing * 5.0;
      if (b.modeTimer <= 0) {
        b.mode = 'idle';
        b.modeTimer = 1.6 + this.random() * 0.8;
        b.facing *= -1;
      }
    }

    b.x += b.vx * dt;
    if (b.x < 67.0) { b.x = 67.0; b.facing = 1; b.mode = 'idle'; b.modeTimer = 1.2; }
    if (b.x > 76.0) { b.x = 76.0; b.facing = -1; b.mode = 'idle'; b.modeTimer = 1.2; }

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
      this.emit('toast', { text: `Sentinel shell cracked · ${b.hp}/${b.maxHp}`, tone: 'gold' });
      if (b.hp <= 0) this.defeatBoss();
    } else if (p.invuln <= 0) {
      this.damagePlayer(1, b.x);
    }
  }

  updateCollectibles() {
    const p = this.player;
    for (const item of [...coins, ...gems]) {
      if (this.collected.has(item.id)) continue;
      if (dist2(p, item) < 1.05 ** 2) {
        this.collected.add(item.id);
        this.runCoins += item.value;
        this.treasureValue += item.value;
        this.awardXP(item.xp);
        this.emit('sfx', { name: item.kind === 'gem' ? 'gem' : 'coin' });
      }
    }

    for (const item of relics) {
      if (this.collected.has(item.id)) continue;
      if (dist2(p, item) < 1.2 ** 2) {
        this.collected.add(item.id);
        this.hasGear = true;
        this.phase = 'guardian';
        this.awardXP(item.xp);
        this.emit('sfx', { name: 'relic' });
        this.emit('toast', { text: 'Moon Gear recovered. The lower gate is open.', tone: 'gold' });
        this.emit('objective', { kicker: 'Gear Acquired', title: 'Reach the Sentinel Chamber', sub: 'Hold BOUNCE to turn the springstaff into a pogo weapon.' });
      }
    }

    if (!this.boss.alive && !this.hasCrown && dist2(p, crown) < 1.35 ** 2) {
      this.hasCrown = true;
      this.phase = 'escape';
      this.escapeTime = 55;
      p.checkpointX = 83.7;
      p.checkpointY = 1.65;
      this.emit('sfx', { name: 'crown' });
      this.emit('objective', { kicker: 'Vault Alarm', title: 'Escape with the Gilded Moon', sub: 'Return to the entrance. Falling masonry now tracks your route.' });
      this.emit('toast', { text: 'The vault is coming down. Move!', tone: 'bad' });
    }
  }

  updateHazards() {
    const p = this.player;
    for (const h of hazards) {
      if (!overlaps(p, h)) continue;
      if (h.type === 'water') {
        this.fallRespawn();
        return;
      }
      if (p.invuln <= 0) this.damagePlayer(1, h.x);
    }
  }

  updateMission(dt) {
    const p = this.player;
    if (!this.hasGear && p.x > 60.7 && !this.objectiveHinted.has('gate')) {
      this.objectiveHinted.add('gate');
      this.emit('toast', { text: 'The gate needs the Moon Gear. Look above the old stairs.', tone: 'bad' });
    }

    if (this.hasGear && this.boss.alive && !this.boss.active && p.x > 65.15) {
      this.boss.active = true;
      this.phase = 'guardian';
      p.checkpointX = 66.2;
      p.checkpointY = 0.68;
      this.emit('objective', { kicker: 'Sentinel Chamber', title: 'Crack the Brassback Sentinel', sub: 'Side hits hurt. Bounce on its shell after its charge.' });
      this.emit('sfx', { name: 'bossStart' });
    }

    if (this.phase === 'escape') {
      this.escapeTime -= dt;
      if (this.escapeTime <= 0) {
        this.escapeFails++;
        this.escapeTime = 55;
        p.x = 83.7; p.y = 1.65; p.vx = 0; p.vy = 0;
        p.hp = p.maxHp; p.invuln = 1.3;
        this.rocks.length = 0;
        this.emit('toast', { text: 'The exit sealed. The vault rewound the chase.', tone: 'bad' });
        this.emit('sfx', { name: 'fail' });
      } else if (p.x < exit.x + exit.radius && p.y < 2.4) {
        this.completeRun();
      }
    }
  }

  updateRocks(dt) {
    if (this.phase !== 'escape') {
      this.rocks.length = 0;
      return;
    }
    this.rockTimer -= dt;
    if (this.rockTimer <= 0 && this.rocks.length < 5) {
      this.rockTimer = 1.35 + this.random() * 1.15;
      const lead = this.player.facing < 0 ? -1.5 : 1.5;
      this.rocks.push({
        id: `rock-${Math.floor(this.time * 1000)}-${this.rocks.length}`,
        x: clamp(this.player.x + lead + (this.random() - 0.5) * 5.0, 3, 87),
        y: 8.5 + this.random() * 2.0,
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
    this.emit('damage');
    this.emit('sfx', { name: 'hurt' });
    if (p.hp <= 0) this.respawn('Pip was rattled back to the last checkpoint.', true);
  }

  fallRespawn() {
    if (this.player.invuln > 0.85) return;
    this.player.hp -= 1;
    this.emit('damage');
    this.emit('sfx', { name: 'hurt' });
    if (this.player.hp <= 0) this.player.hp = this.player.maxHp;
    this.respawn('Watch the ledges. The vault keeps what falls.');
  }

  respawn(message, fullHeal = false) {
    const p = this.player;
    this.deaths++;
    p.x = p.checkpointX;
    p.y = p.checkpointY;
    p.vx = 0; p.vy = 0; p.pogo = false; p.grounded = false;
    p.hp = fullHeal ? p.maxHp : Math.max(1, p.hp);
    p.invuln = 1.3;
    this.emit('toast', { text: message, tone: 'bad' });
  }

  defeatBoss() {
    const b = this.boss;
    b.alive = false;
    b.active = false;
    b.vx = 0;
    this.phase = 'crown';
    this.runCoins += 25;
    this.awardXP(40);
    this.emit('sfx', { name: 'bossDown' });
    this.emit('objective', { kicker: 'Sentinel Defeated', title: 'Claim the Gilded Moon', sub: 'The inner vault is open. The treasure is almost yours.' });
    this.emit('toast', { text: 'Brassback down · +25 coins', tone: 'good' });
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
    this.emit('profile', { profile: { ...this.profile } });
  }

  getUpgradeInfo() {
    return {
      staff: {
        level: this.profile.staffLevel,
        maxed: this.profile.staffLevel >= 2,
        cost: 70,
        name: 'Springstaff Coil',
        description: 'Raises bounce height and cracks the sentinel shell for 2 damage per hit.',
      },
      coat: {
        level: this.profile.coatLevel,
        maxed: this.profile.coatLevel >= 1,
        cost: 60,
        name: 'Riveted Trailcoat',
        description: 'Adds one permanent heart and restores one heart immediately.',
      },
    };
  }

  buyUpgrade(type) {
    const info = this.getUpgradeInfo()[type];
    if (!info || info.maxed) return { ok: false, reason: 'maxed' };
    if (this.runCoins < info.cost) return { ok: false, reason: 'coins' };
    this.runCoins -= info.cost;
    if (type === 'staff') this.profile.staffLevel = 2;
    if (type === 'coat') {
      this.profile.coatLevel = 1;
      const oldMax = this.player.maxHp;
      this.player.maxHp = this.getMaxHp();
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + (this.player.maxHp - oldMax) + 1);
    }
    this.emit('profile', { profile: { ...this.profile } });
    this.emit('toast', { text: `${info.name} installed.`, tone: 'good' });
    this.emit('sfx', { name: 'upgrade' });
    return { ok: true };
  }

  completeRun() {
    if (this.completed) return;
    this.completed = true;
    this.phase = 'complete';
    const time = this.time;
    const treasure = this.getTreasurePercent();
    this.profile.clears += 1;
    this.profile.bestTime = this.profile.bestTime == null ? time : Math.min(this.profile.bestTime, time);
    this.profile.bestTreasure = Math.max(this.profile.bestTreasure || 0, treasure);
    this.emit('profile', { profile: { ...this.profile } });
    this.emit('sfx', { name: 'win' });
    this.emit('complete', {
      stats: {
        time,
        treasure,
        deaths: this.deaths,
        coins: this.runCoins,
        level: this.profile.level,
        escapeFails: this.escapeFails,
      },
    });
  }
}
