/**
 * game.js — the rules of a BITCRASH run: BIT's movement and arm cannon, the
 * Gale Burst, enemies, hazards, both bosses, pickups, checkpoints and the
 * service bay. Plain state and rules, no rendering: main.js steps it on a
 * fixed 120 Hz clock and view.js draws whatever it finds in `state`.
 *
 * Mission 01's numbers (movement, damage, enemy timers, the Gale Warden's
 * patterns) are the original game's; the difficulty setting scales them, and
 * Standard is the original balance.
 */

import { LEVELS } from './levels.js';

export const CONFIG = { gravity: -36, move: 8.2, groundAccel: 64, airAccel: 34, jump: 13.4, shotSpeed: 21, fireRate: 0.18, baseHP: 28, damage: 1, coyote: 0.11, jumpBuffer: 0.12 };

/** The Gale Burst: the Gale Warden's weapon, BIT's once Mission 01 is cleared. */
export const GALE = { max: 28, cost: 4, regen: 1, cooldown: 0.35, speed: 15, life: 1.1, damage: 2, r: 0.42 };

export const DIFFICULTY = {
  cadet: { id: 'cadet', label: 'CADET', note: 'Softer hits, slower enemy fire, full repair on reboot', dmg: 0.6, cadence: 1.3, bossHp: 0.85, reboot: 1 },
  standard: { id: 'standard', label: 'STANDARD', note: 'The original balance', dmg: 1, cadence: 1, bossHp: 1, reboot: 0.72 },
  overclock: { id: 'overclock', label: 'OVERCLOCK', note: 'Harder hits, faster enemy fire, tougher bosses', dmg: 1.4, cadence: 0.8, bossHp: 1.2, reboot: 0.6 },
};

export const UPGRADES = [
  { id: 'plating', name: 'CERAMIC PLATING', cost: 6, desc: '+6 max energy. Repairs 8 energy immediately.', apply: (p) => { p.maxHp += 6; p.hp = Math.min(p.maxHp, p.hp + 8); } },
  { id: 'accelerator', name: 'PULSE ACCELERATOR', cost: 6, desc: '+25% arm-cannon damage. No change to fire cadence.', apply: (p) => { p.damageMult *= 1.25; } },
  { id: 'servo', name: 'SERVO OVERDRIVE', cost: 6, desc: '+10% run speed and +7% jump impulse.', apply: (p) => { p.speedMult *= 1.1; p.jumpMult *= 1.07; } },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
const circleRect = (c, r) => Math.abs(c.x - r.x) < r.w / 2 + c.r && Math.abs(c.y - r.y) < r.h / 2 + c.r;
// Solids get a hair of slack: snapping BIT onto a platform can leave him 1e-16 inside it
// (floating point), and the next sideways pass then treated the platform as a wall and
// teleported him to its edge (the thin step platforms did this in the original).
const SKIN = 1e-4;
const solidOverlap = (a, b) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - SKIN && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - SKIN;
const noop = () => {};

/** Drop the entries `keep` rejects, in place (no new array every step). */
function compact(list, keep) {
  let j = 0;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (keep(v)) list[j++] = v;
  }
  list.length = j;
}

function spawnEnemy(d) {
  const { type, x, y } = d;
  switch (type) {
    case 'walker':
      return { type, x, y, w: 1, h: 1.25, hp: 4, maxHp: 4, alive: true, min: d.min, max: d.max, vx: 1.4, flash: 0, drop: 1 };
    case 'turret':
      return { type, x, y, w: 1, h: 1.2, hp: 3, maxHp: 3, alive: true, dir: d.dir, shotT: 0.7 + (x % 3) * 0.2, flash: 0, drop: 1 };
    case 'drone':
      return { type, x, y, w: 1.15, h: 0.9, hp: 3, maxHp: 3, alive: true, baseY: y, originX: x, t: (x * 0.37) % 5, shotT: 1.2 + (x % 2) * 0.35, flash: 0, drop: 1 };
    case 'hopper':
      return { type, x, y, w: 0.9, h: 0.9, hp: 3, maxHp: 3, alive: true, min: d.min, max: d.max, baseY: y, vx: 0, vy: 0, air: false, wait: 0.6 + (x % 3) * 0.3, squash: 0, flash: 0, drop: 1 };
    case 'shield':
      return { type, x, y, w: 0.9, h: 1.4, hp: 6, maxHp: 6, alive: true, dir: d.dir, t: 1.2 + (x % 2) * 0.4, open: 0, shots: 0, shotT: 0, flash: 0, drop: 2 };
    default:
      throw new Error(`unknown enemy ${type}`);
  }
}

/**
 * @param {object} hooks  side effects: beep, toast, burst, shake, rumble, hurt, boss, near, openBay, complete
 */
export function createGame(hooks = {}) {
  const fx = { beep: noop, toast: noop, burst: noop, shake: noop, rumble: noop, hurt: noop, boss: noop, near: noop, openBay: noop, complete: noop, ...hooks };

  /** What the player is doing this step; main.js fills it from kit.input once per frame. */
  const input = { x: 0, jump: false, fire: false, jumpPressed: false, usePressed: false, specialPressed: false };

  const state = {
    version: 0,
    level: null,
    levelIndex: 0,
    diff: DIFFICULTY.standard,
    galeUnlocked: false,
    time: 0,
    runTime: 0,
    damageTaken: 0,
    reboots: 0,
    kills: 0,
    scrapTotal: 0,
    checkpoint: { x: 2, y: 1.7 },
    checkpointIndex: -1,
    bossActive: false,
    bossDefeated: false,
    bossGate: false,
    complete: false,
    completeT: 0,
    weakShown: false,
    nearTerminal: null,
    player: null,
    platforms: [],
    movers: [],
    solids: [],
    gate: null,
    hazards: [],
    fans: [],
    terminals: [],
    enemies: [],
    pickups: [],
    shots: [],
    enemyShots: [],
    gusts: [],
    strikes: [],
    boss: null,
  };

  let bounds = { left: -5, right: 72, bottom: -7, top: 15 };
  const keepShot = (s) => s.life > 0 && s.x > bounds.left && s.x < bounds.right;
  const keepEnemyShot = (s) => s.life > 0 && s.x > bounds.left && s.x < bounds.right && s.y > bounds.bottom && s.y < bounds.top;
  const keepGust = (g) => g.life > 0 && g.x > bounds.left && g.x < bounds.right;
  const dashBox = { x: 0, y: 0, w: 0, h: 0 };

  // ------------------------------------------------------------------ setup

  function placeMover(m) {
    if (m.axis === 'x') m.x = m.baseX + Math.sin(state.time * m.speed + m.phase) * m.amp;
    else m.y = m.baseY + Math.sin(state.time * m.speed + m.phase) * m.amp;
  }

  function makeBoss(B) {
    const hp = Math.round(B.hp * state.diff.bossHp);
    return {
      type: 'boss', kind: B.kind, x: B.x, y: B.y, w: B.w, h: B.h, hp, maxHp: hp, alive: true,
      t: 0, shotT: 1.2, phase: 1, dir: 1, flash: 0, wind: 0,
      mode: 'hover', modeT: 0, strikeT: 1.6, dashT: 2.5, dashFrom: 0, dashTo: 0, dashDir: 1,
    };
  }

  /** Start (or restart) mission `index`. */
  function load(index, { difficulty = 'standard', gale = false } = {}) {
    const L = LEVELS[index] || LEVELS[0];
    state.level = L;
    state.levelIndex = LEVELS.indexOf(L);
    state.diff = DIFFICULTY[difficulty] || DIFFICULTY.standard;
    state.galeUnlocked = !!gale;
    bounds = L.bounds;
    state.time = 0;
    state.runTime = 0;
    state.damageTaken = 0;
    state.reboots = 0;
    state.kills = 0;
    state.scrapTotal = 0;

    state.platforms = L.platforms.map((p) => ({ ...p }));
    state.movers = L.movers.map((m) => {
      const o = { ...m, axis: m.axis || 'y', dx: 0, dy: 0, isMover: true };
      placeMover(o);
      return o;
    });
    state.solids = [...state.platforms, ...state.movers];
    state.hazards = L.hazards.map((h) => (h.type === 'crusher' ? { ...h, y: h.floor + 3.6, h: 1.0, stage: 'rest' } : { ...h }));
    state.fans = state.hazards.filter((h) => h.type === 'fan');
    state.terminals = L.terminals.map((t) => ({ w: 1.2, h: 2.1, active: true, ...t }));
    state.enemies = L.enemies.map(spawnEnemy);
    state.pickups = L.pickups.map((it) => ({ ...it, taken: false }));
    state.gate = L.boss ? { id: 'gate', x: L.boss.gateX, y: 4, w: 0.8, h: 7 } : null;
    state.boss = L.boss ? makeBoss(L.boss) : null;
    state.strikes = [0, 1, 2, 3, 4].map(() => ({ live: false, x: 0, t: 0, fired: false }));
    state.shots = [];
    state.enemyShots = [];
    state.gusts = [];

    state.player = {
      x: L.start.x, y: L.start.y, w: 0.72, h: 1.5, vx: 0, vy: 0, onGround: false, support: null,
      coyote: 0, jumpBuffer: 0, facing: 1, hp: CONFIG.baseHP, maxHp: CONFIG.baseHP, invuln: 0, fireT: 0,
      galeT: 0, we: GALE.max, scrap: 0, xp: 0, level: 1, damageMult: 1, speedMult: 1, jumpMult: 1,
      upgrades: { plating: false, accelerator: false, servo: false }, landed: 0,
    };
    state.checkpoint = { x: L.spawn.x, y: L.spawn.y };
    state.checkpointIndex = -1;
    state.bossActive = false;
    state.bossDefeated = false;
    state.bossGate = false;
    state.complete = false;
    state.completeT = 0;
    state.weakShown = false;
    state.nearTerminal = null;
    input.x = 0;
    input.jump = input.fire = input.jumpPressed = input.usePressed = input.specialPressed = false;
    state.version++;
  }

  // ------------------------------------------------------------------ player

  function gainXP(n) {
    const p = state.player;
    p.xp += n;
    const old = p.level;
    p.level = p.xp >= 50 ? 3 : p.xp >= 20 ? 2 : 1;
    if (p.level > old) {
      p.damageMult *= 1.05;
      p.maxHp += 1;
      p.hp = Math.min(p.maxHp, p.hp + 5);
      fx.toast('SYNC LEVEL ' + p.level + ' // OUTPUT +5%');
      fx.beep(760, 0.13, 'square', 0.12, 260);
    }
  }

  function damagePlayer(n, sourceX) {
    const p = state.player;
    if (p.invuln > 0 || state.complete || state.completeT > 0) return;
    n = Math.max(1, Math.round(n * state.diff.dmg));
    p.hp -= n;
    state.damageTaken += n;
    p.invuln = 1.0;
    p.vx = (p.x < sourceX ? -1 : 1) * 7;
    p.vy = 6;
    fx.beep(120, 0.12, 'sawtooth', 0.15, -50);
    fx.burst(p.x, p.y + 0.2, 0xff4a58, 10, 4);
    fx.hurt(n);
    if (p.hp <= 0) respawn(true);
  }

  /** Back to the last checkpoint. A full reboot (energy ran out) repairs BIT; a fall does not. */
  function respawn(fullDeath) {
    const p = state.player;
    if (fullDeath) p.hp = Math.max(10, Math.floor(p.maxHp * state.diff.reboot));
    state.reboots++;
    p.x = state.checkpoint.x;
    p.y = state.checkpoint.y;
    p.vx = p.vy = 0;
    p.onGround = false;
    p.support = null;
    p.invuln = 1.5;
    // Don't respawn into a volley that was already on its way.
    state.enemyShots.length = 0;
    fx.toast('REBOOT // CHECKPOINT');
    fx.beep(180, 0.2, 'triangle', 0.1, 260);
  }

  /** Falling off the stage costs the pit's damage (the original data said 6 and never applied it). */
  function fallOut() {
    const p = state.player;
    let dmg = 6;
    for (const h of state.hazards) {
      if (h.type === 'pit' && Math.abs(p.x - h.x) < h.w / 2 + 1.5) {
        dmg = h.damage;
        break;
      }
    }
    dmg = Math.max(1, Math.round(dmg * state.diff.dmg));
    p.hp -= dmg;
    state.damageTaken += dmg;
    fx.hurt(dmg);
    respawn(p.hp <= 0);
  }

  function shootPlayer() {
    const p = state.player;
    state.shots.push({ x: p.x + p.facing * 0.62, y: p.y + 0.12, vx: p.facing * CONFIG.shotSpeed, vy: 0, r: 0.16, life: 1.6, damage: CONFIG.damage * p.damageMult });
    fx.beep(520, 0.045, 'square', 0.08, 100);
  }

  function fireGale() {
    const p = state.player;
    if (!state.galeUnlocked || p.galeT > 0) return;
    if (p.we < GALE.cost) {
      fx.beep(140, 0.06, 'square', 0.05);
      return;
    }
    p.we -= GALE.cost;
    p.galeT = GALE.cooldown;
    state.gusts.push({ x: p.x + p.facing * 0.7, y: p.y + 0.12, vx: p.facing * GALE.speed, r: GALE.r, life: GALE.life, damage: GALE.damage * p.damageMult, spin: 0, hits: [] });
    fx.beep(330, 0.16, 'sawtooth', 0.07, 420);
    fx.burst(p.x + p.facing * 0.8, p.y + 0.12, 0xd8f8ff, 8, 3);
    fx.rumble(0.22, 60);
  }

  /** Visit every solid: the platforms, the movers, and the boss gate while it is shut. */
  function solidAt(i) {
    return i < state.solids.length ? state.solids[i] : state.gate;
  }
  const solidCount = () => state.solids.length + (state.bossGate && state.gate ? 1 : 0);

  function updatePlayer(dt) {
    const p = state.player;
    const L = state.level;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireT > 0) p.fireT -= dt;
    if (p.galeT > 0) p.galeT -= dt;
    if (p.landed > 0) p.landed -= dt;
    if (state.galeUnlocked && p.we < GALE.max) p.we = Math.min(GALE.max, p.we + GALE.regen * dt);
    if (p.onGround) p.coyote = CONFIG.coyote;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (input.jumpPressed) {
      p.jumpBuffer = CONFIG.jumpBuffer;
      input.jumpPressed = false;
    } else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);

    const axis = clamp(input.x, -1, 1);
    const target = axis * CONFIG.move * p.speedMult;
    const acc = p.onGround ? CONFIG.groundAccel : CONFIG.airAccel;
    p.vx = lerp(p.vx, target, clamp((acc * dt) / (Math.abs(p.vx - target) + 1), 0, 1));
    if (Math.abs(axis) < 0.05 && p.onGround) p.vx *= Math.pow(0.0008, dt);
    if (Math.abs(axis) > 0.08) p.facing = axis > 0 ? 1 : -1;

    if (p.jumpBuffer > 0 && p.coyote > 0) {
      p.vy = CONFIG.jump * p.jumpMult;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      fx.beep(270, 0.08, 'square', 0.08, 140);
    }
    if (!input.jump && p.vy > 5) p.vy -= 26 * dt;
    // Ride a moving platform: carried by its motion before gravity and collisions.
    if (p.support && p.onGround) {
      p.y += p.support.dy;
      p.x += p.support.dx;
    }
    p.vy += CONFIG.gravity * dt;

    // x collision
    p.x += p.vx * dt;
    const n = solidCount();
    for (let i = 0; i < n; i++) {
      const r = solidAt(i);
      if (solidOverlap(p, r)) {
        if (p.vx > 0) p.x = r.x - r.w / 2 - p.w / 2;
        else if (p.vx < 0) p.x = r.x + r.w / 2 + p.w / 2;
        p.vx = 0;
      }
    }
    // y collision
    const wasGround = p.onGround;
    const fallSpeed = p.vy;
    p.onGround = false;
    p.support = null;
    p.y += p.vy * dt;
    for (let i = 0; i < n; i++) {
      const r = solidAt(i);
      if (solidOverlap(p, r)) {
        if (p.vy <= 0) {
          p.y = r.y + r.h / 2 + p.h / 2;
          p.vy = 0;
          p.onGround = true;
          p.support = r.isMover ? r : null;
        } else {
          p.y = r.y - r.h / 2 - p.h / 2;
          p.vy = 0;
        }
      }
    }
    if (p.onGround && !wasGround && fallSpeed < -12 && p.landed <= 0) {
      p.landed = 0.25;
      fx.burst(p.x, p.y - p.h / 2 + 0.05, 0x9cc9d6, 6, 2);
    }

    if (input.fire && p.fireT <= 0) {
      shootPlayer();
      p.fireT = CONFIG.fireRate;
    }
    if (input.specialPressed) {
      input.specialPressed = false;
      fireGale();
    }
    if (p.y < -6) fallOut();
    p.x = clamp(p.x, L.xMin, L.xMax);

    for (const h of state.hazards) {
      if (h.type === 'pit') continue;
      if (h.type === 'crusher') {
        if (!overlap(p, h)) continue;
        if (h.stage === 'rest' || h.stage === 'warn') {
          // A raised head is a ceiling, not a hazard: bump it from below.
          if (p.vy > 0) {
            p.y = h.y - h.h / 2 - p.h / 2;
            p.vy = 0;
          }
        } else damagePlayer(h.damage, h.x);
        continue;
      }
      if (overlap(p, h)) {
        damagePlayer(h.damage, h.x);
        if (h.push) p.vx += h.push * dt;
      }
    }
    // fan wind fields
    for (const h of state.fans) {
      const dx = p.x - h.x;
      const dy = p.y - h.y;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 2.5) p.vx += (h.push || 5) * 0.55 * dt;
    }
    // pickups
    for (const it of state.pickups) {
      if (it.taken) continue;
      if (Math.abs(p.x - it.x) < 0.75 && Math.abs(p.y - it.y) < 1.0) {
        it.taken = true;
        if (it.type === 'scrap') {
          p.scrap += it.value;
          state.scrapTotal += it.value;
          fx.beep(610, 0.05, 'square', 0.075, 140);
          fx.burst(it.x, it.y, 0xffdc68, 6, 2.5);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + it.value);
          fx.beep(410, 0.08, 'sine', 0.09, 250);
          fx.burst(it.x, it.y, 0x58e6a4, 8, 2.5);
        }
      }
    }
    // terminals and use
    let near = null;
    for (const t of state.terminals) {
      if (Math.abs(p.x - t.x) < 1.4 && Math.abs(p.y - t.y) < 2.0) {
        near = t;
        break;
      }
    }
    if (near !== state.nearTerminal) {
      state.nearTerminal = near;
      fx.near(near);
    }
    if (input.usePressed) {
      input.usePressed = false;
      if (near) fx.openBay(near);
    }
    // checkpoints
    const cps = L.checkpoints;
    for (let i = state.checkpointIndex + 1; i < cps.length; i++) {
      const c = cps[i];
      if (p.x <= c.at || state.bossActive) break;
      state.checkpointIndex = i;
      state.checkpoint.x = c.x;
      state.checkpoint.y = c.y;
      if (p.scrap < c.credit) p.scrap = c.credit;
      p.hp = Math.max(p.hp, Math.ceil(p.maxHp * c.heal));
      fx.toast(c.text);
      fx.beep(360, 0.12, 'square', 0.1, 300);
    }
    const B = L.boss;
    if (B && p.x > B.trigger && !state.bossActive && !state.bossDefeated) startBoss();
  }

  // ------------------------------------------------------------------ enemies

  function enemyBullet(x, y, vx, vy, damage = 3, r = 0.18) {
    state.enemyShots.push({ x, y, vx, vy, r, life: 4, damage });
  }

  function aimBullet(e, speed = 7, damage = 3) {
    const p = state.player;
    const dx = p.x - e.x;
    const dy = p.y + 0.1 - e.y;
    const l = Math.hypot(dx, dy) || 1;
    enemyBullet(e.x, e.y, (dx / l) * speed, (dy / l) * speed, damage, 0.18);
    fx.beep(150, 0.035, 'square', 0.035);
  }

  function aimSpread(e, speed, damage, offset) {
    const p = state.player;
    const ang = Math.atan2(p.y + 0.1 - e.y, p.x - e.x) + offset;
    enemyBullet(e.x, e.y, Math.cos(ang) * speed, Math.sin(ang) * speed, damage, 0.2);
  }

  function updateEnemies(dt) {
    const p = state.player;
    const cad = state.diff.cadence;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (e.type === 'walker') {
        e.x += e.vx * dt;
        if (e.x < e.min) {
          e.x = e.min;
          e.vx = Math.abs(e.vx);
        }
        if (e.x > e.max) {
          e.x = e.max;
          e.vx = -Math.abs(e.vx);
        }
        if (overlap(p, e)) damagePlayer(3, e.x);
      } else if (e.type === 'turret') {
        e.shotT -= dt;
        e.dir = p.x < e.x ? -1 : 1;
        if (e.shotT <= 0 && Math.abs(p.x - e.x) < 10) {
          aimBullet(e, 7.2, 3);
          e.shotT = 1.45 * cad;
        }
      } else if (e.type === 'drone') {
        e.t += dt;
        e.y = e.baseY + Math.sin(e.t * 1.6) * 0.65;
        e.x = e.originX + Math.sin(e.t * 0.8) * 0.8;
        e.shotT -= dt;
        if (e.shotT <= 0 && Math.abs(p.x - e.x) < 11) {
          aimBullet(e, 6.5, 3);
          e.shotT = 1.7 * cad;
        }
        if (overlap(p, e)) damagePlayer(3, e.x);
      } else if (e.type === 'hopper') {
        // Springs toward BIT in short arcs, landing back on its own deck.
        if (e.air) {
          e.vy -= 30 * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.x < e.min) {
            e.x = e.min;
            e.vx = Math.abs(e.vx);
          } else if (e.x > e.max) {
            e.x = e.max;
            e.vx = -Math.abs(e.vx);
          }
          if (e.y <= e.baseY && e.vy < 0) {
            e.y = e.baseY;
            e.vy = 0;
            e.air = false;
            e.squash = 0.18;
            e.wait = (0.75 + Math.random() * 0.5) * cad;
          }
        } else {
          e.squash = Math.max(0, e.squash - dt);
          e.wait -= dt;
          if (e.wait <= 0) {
            if (Math.abs(p.x - e.x) < 9 && Math.abs(p.y - e.y) < 4) {
              e.air = true;
              e.vy = 9.5;
              e.vx = clamp((p.x - e.x) * 0.9, -3.4, 3.4);
              fx.beep(330, 0.05, 'triangle', 0.03, 220);
            } else e.wait = 0.3;
          }
        }
        if (overlap(p, e)) damagePlayer(3, e.x);
      } else if (e.type === 'shield') {
        // Guards behind its shield, then drops it to fire a pair: shoot it while it's open.
        if (e.open > 0) {
          e.open -= dt;
          e.shotT -= dt;
          if (e.shotT <= 0 && e.shots > 0) {
            e.shots--;
            enemyBullet(e.x + e.dir * 0.55, e.y + 0.12, e.dir * 7.5, 0, 3, 0.18);
            fx.beep(150, 0.035, 'square', 0.035);
            e.shotT = 0.3;
          }
          if (e.open <= 0) e.t = 2.2 * cad;
        } else {
          e.dir = p.x < e.x ? -1 : 1;
          if (Math.abs(p.x - e.x) < 11 && Math.abs(p.y - e.y) < 5) {
            e.t -= dt;
            if (e.t <= 0) {
              e.open = 1.0;
              e.shots = 2;
              e.shotT = 0.15;
            }
          }
        }
        if (overlap(p, e)) damagePlayer(3, e.x);
      }
    }
    if (state.bossActive && state.boss.alive) updateBoss(dt);
  }

  function hitEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.08;
    fx.burst(e.x, e.y, 0xffdc68, 4, 3);
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.alive = false;
    gainXP(e.type === 'boss' ? 30 : 5);
    if (e.type !== 'boss') {
      state.kills++;
      state.pickups.push({ type: 'scrap', x: e.x, y: e.y + 0.35, r: 0.28, taken: false, value: e.drop || 1, dynamic: true });
      fx.beep(190, 0.08, 'square', 0.1, 240);
      fx.burst(e.x, e.y, 0xff9b47, 14, 5);
      fx.rumble(0.18, 50);
    } else finishBoss();
  }

  // ------------------------------------------------------------------ bosses

  function startBoss() {
    const B = state.level.boss;
    state.bossActive = true;
    state.bossGate = true;
    state.checkpoint.x = B.respawn.x;
    state.checkpoint.y = B.respawn.y;
    state.player.x = Math.max(state.player.x, B.enterX);
    fx.boss(true);
    fx.toast(B.warning, 2);
    fx.beep(90, 0.4, 'sawtooth', 0.12, 100);
    fx.rumble(0.4, 200);
  }

  function finishBoss() {
    const b = state.boss;
    state.bossDefeated = true;
    state.bossActive = false;
    state.bossGate = false;
    state.enemyShots.length = 0;
    for (const s of state.strikes) s.live = false;
    fx.boss(false);
    fx.toast(state.level.boss.defeat, 2.2);
    fx.beep(220, 0.22, 'square', 0.14, 660);
    fx.burst(b.x, b.y, 0xff9b47, 40, 8);
    fx.burst(b.x, b.y, 0xd8f8ff, 24, 6);
    fx.shake(0.6);
    fx.rumble(0.9, 450);
    state.completeT = 1.2;
  }

  function hitBoss(dmg, weapon) {
    const b = state.boss;
    let mult = 1;
    if (weapon === 'gale') mult = b.kind === 'arc' ? 3 : 0.5;
    b.hp -= dmg * mult;
    b.flash = 0.08;
    fx.burst(b.x, b.y, mult > 1 ? 0xd8f8ff : 0xffdc68, mult > 1 ? 12 : 4, mult > 1 ? 6 : 3);
    if (mult > 1 && !state.weakShown) {
      state.weakShown = true;
      fx.toast('WEAK POINT // GALE BURST ×3', 1.6);
    }
    if (b.hp <= 0) killEnemy(b);
  }

  function phaseCheck(b) {
    const phase = b.hp <= b.maxHp * 0.5 ? 2 : 1;
    if (phase === 2 && b.phase === 1) {
      fx.toast(state.level.boss.phase2, 1.6);
      fx.beep(80, 0.35, 'sawtooth', 0.1, 160);
      fx.shake(0.3);
    }
    b.phase = phase;
  }

  function updateBoss(dt) {
    if (state.boss.kind === 'arc') updateArc(dt);
    else updateGale(dt);
  }

  /** The Gale Warden: the original patterns, with fire cadence scaled by difficulty. */
  function updateGale(dt) {
    const b = state.boss;
    const p = state.player;
    const cad = state.diff.cadence;
    const cx = state.level.boss.centerX;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    phaseCheck(b);
    b.y = 4.2 + Math.sin(b.t * (b.phase === 1 ? 1.1 : 1.8)) * 1.0;
    b.x = cx + Math.sin(b.t * (b.phase === 1 ? 0.55 : 1.05)) * 2.2;
    b.shotT -= dt;
    if (b.shotT <= 0) {
      if (b.phase === 1) {
        for (let a = -1; a <= 1; a++) {
          const ang = Math.atan2(p.y - b.y, p.x - b.x) + a * 0.18;
          enemyBullet(b.x, b.y, Math.cos(ang) * 7.0, Math.sin(ang) * 7.0, 2, 0.22);
        }
        b.shotT = 1.38 * cad;
      } else {
        for (let i = 0; i < 5; i++) {
          const ang = (Math.PI * 2 * i) / 5 + b.t * 0.4;
          enemyBullet(b.x, b.y, Math.cos(ang) * 5.9, Math.sin(ang) * 5.9, 2, 0.2);
        }
        b.shotT = 1.06 * cad;
      }
      fx.beep(110, 0.06, 'sawtooth', 0.05, 60);
    }
    b.wind = 0;
    if (b.phase === 2) {
      b.wind = Math.sin(b.t * 1.7) > 0 ? 1 : -1;
      p.vx += b.wind * 3.2 * dt;
    }
    if (overlap(p, b)) damagePlayer(4, b.x);
  }

  function spawnStrike(x) {
    for (const s of state.strikes) {
      if (s.live) continue;
      s.live = true;
      s.x = x;
      s.t = 0;
      s.fired = false;
      return;
    }
  }

  /**
   * The Arc Regent: hovers and drops telegraphed lightning columns on BIT,
   * fires aimed bolts, and below half energy dashes the length of the arena
   * at jump height. The Gale Burst hits it three times as hard.
   */
  function updateArc(dt) {
    const b = state.boss;
    const B = state.level.boss;
    const p = state.player;
    const cad = state.diff.cadence;
    const k = (rate) => 1 - Math.exp(-rate * dt);
    const left = B.arena[0] + 1.6;
    const right = B.arena[1] - 1.6;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    phaseCheck(b);
    let strikesLive = false;
    for (const s of state.strikes) if (s.live) strikesLive = true;

    if (b.mode === 'hover') {
      b.x += (B.centerX + Math.sin(b.t * 0.5) * 3.0 - b.x) * k(3);
      b.y += (5.0 + Math.sin(b.t * 1.3) * 0.6 - b.y) * k(3);
      b.strikeT -= dt;
      if (b.strikeT <= 0) {
        const lo = left - 0.6;
        const hi = right + 0.6;
        spawnStrike(clamp(p.x, lo, hi));
        if (b.phase === 1) spawnStrike(lerp(lo, hi, Math.random()));
        else {
          spawnStrike(clamp(p.x + 2.6, lo, hi));
          spawnStrike(clamp(p.x - 2.6, lo, hi));
        }
        b.strikeT = (b.phase === 1 ? 2.8 : 2.1) * cad;
        fx.beep(520, 0.1, 'square', 0.04, 300);
      }
      b.shotT -= dt;
      if (b.shotT <= 0) {
        if (b.phase === 1) aimSpread(b, 7.5, 3, 0);
        else {
          aimSpread(b, 7.2, 3, -0.2);
          aimSpread(b, 7.2, 3, 0.2);
        }
        fx.beep(240, 0.06, 'square', 0.05, -80);
        b.shotT = (b.phase === 1 ? 1.7 : 1.3) * cad;
      }
      if (b.phase === 2) {
        b.dashT -= dt;
        if (b.dashT <= 0 && !strikesLive) {
          b.mode = 'windup';
          b.modeT = 0;
          const fromRight = p.x < B.centerX;
          b.dashFrom = fromRight ? right : left;
          b.dashTo = fromRight ? left : right;
          b.dashDir = Math.sign(b.dashTo - b.dashFrom) || 1;
          fx.beep(200, 0.3, 'sawtooth', 0.06, 500);
        }
      }
    } else if (b.mode === 'windup') {
      b.modeT += dt;
      b.x += (b.dashFrom - b.x) * k(5);
      b.y += (B.floor + 0.9 - b.y) * k(5);
      if (b.modeT >= 1.0) {
        b.mode = 'dash';
        b.modeT = 0;
        fx.beep(140, 0.35, 'sawtooth', 0.1, -60);
        fx.rumble(0.3, 120);
      }
    } else if (b.mode === 'dash') {
      b.x += b.dashDir * 13 * dt;
      b.y = B.floor + 0.9;
      if ((b.dashDir > 0 && b.x >= b.dashTo) || (b.dashDir < 0 && b.x <= b.dashTo)) {
        b.x = b.dashTo;
        b.mode = 'recover';
        b.modeT = 0;
        fx.shake(0.35);
        fx.burst(b.x + b.dashDir * 1.2, B.floor + 0.6, 0x8fe9ff, 16, 5);
        fx.beep(70, 0.2, 'square', 0.1, -20);
      }
    } else {
      b.modeT += dt;
      b.y += (5.0 - b.y) * k(3);
      if (b.modeT > 0.7) {
        b.mode = 'hover';
        b.dashT = 4.6 * cad;
      }
    }

    for (const s of state.strikes) {
      if (!s.live) continue;
      s.t += dt;
      if (s.t >= 0.85 && !s.fired) {
        s.fired = true;
        fx.beep(880, 0.12, 'sawtooth', 0.06, -600);
        fx.burst(s.x, B.floor + 0.2, 0x8fe9ff, 10, 4);
        fx.shake(0.12);
      }
      if (s.t >= 0.85 && s.t < 1.15 && Math.abs(p.x - s.x) < 0.5 + p.w / 2) damagePlayer(4, s.x);
      if (s.t >= 1.15) s.live = false;
    }

    let hit = b;
    if (b.mode === 'dash' || b.mode === 'windup') {
      dashBox.x = b.x;
      dashBox.y = b.y;
      dashBox.w = b.w;
      dashBox.h = 1.5;
      hit = dashBox;
    }
    if (overlap(p, hit)) damagePlayer(4, b.x);
  }

  // ------------------------------------------------------------------ projectiles

  function updateProjectiles(dt) {
    const boss = state.boss;
    for (const s of state.shots) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) continue;
      for (const e of state.enemies) {
        if (!e.alive || !circleRect(s, e)) continue;
        s.life = 0;
        if (e.type === 'shield' && e.open <= 0 && Math.sign(s.vx) === -e.dir) {
          // Pinged off the shield.
          fx.burst(s.x, s.y, 0xd8f8ff, 4, 3);
          fx.beep(1250, 0.03, 'square', 0.04, -500);
        } else hitEnemy(e, s.damage);
        break;
      }
      if (s.life > 0 && state.bossActive && boss.alive && circleRect(s, boss)) {
        s.life = 0;
        hitBoss(s.damage, 'buster');
      }
    }
    for (const g of state.gusts) {
      g.life -= dt;
      g.x += g.vx * dt;
      g.spin += dt * 14;
      if (g.life <= 0) continue;
      for (const e of state.enemies) {
        if (!e.alive || g.hits.includes(e) || !circleRect(g, e)) continue;
        g.hits.push(e);
        if (e.type === 'walker' || e.type === 'hopper') e.x = clamp(e.x + Math.sign(g.vx) * 0.5, e.min, e.max);
        hitEnemy(e, g.damage);
      }
      for (const s of state.enemyShots) {
        if (s.life > 0 && Math.abs(s.x - g.x) < g.r + s.r + 0.1 && Math.abs(s.y - g.y) < g.r + s.r + 0.1) {
          s.life = 0;
          fx.burst(s.x, s.y, 0xd8f8ff, 3, 2);
        }
      }
      if (state.bossActive && boss.alive && !g.hits.includes(boss) && circleRect(g, boss)) {
        g.hits.push(boss);
        hitBoss(g.damage, 'gale');
      }
    }
    const p = state.player;
    for (const s of state.enemyShots) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life > 0 && circleRect(s, p)) {
        damagePlayer(s.damage, s.x);
        s.life = 0;
      }
    }
    compact(state.shots, keepShot);
    compact(state.enemyShots, keepEnemyShot);
    compact(state.gusts, keepGust);
  }

  // ------------------------------------------------------------------ hazards

  /** Crushers: rest, shake as a warning, slam, hold, rise. */
  function updateCrusher(h) {
    const T = h.period;
    const u = (((state.time + h.phase) % T) + T) % T;
    const up = h.floor + 3.6;
    const down = h.floor + 0.5;
    let stage;
    if (u < 1.6) {
      stage = 'rest';
      h.y = up;
    } else if (u < 2.0) {
      stage = 'warn';
      h.y = up;
    } else if (u < 2.15) {
      stage = 'slam';
      const t = (u - 2.0) / 0.15;
      h.y = up + (down - up) * t * t;
    } else if (u < 2.65) {
      stage = 'hold';
      h.y = down;
    } else {
      stage = 'rise';
      h.y = down + (up - down) * ((u - 2.65) / (T - 2.65));
    }
    if (stage !== h.stage) {
      const near = Math.abs(state.player.x - h.x) < 9;
      if (stage === 'warn' && near) fx.beep(70, 0.3, 'sawtooth', 0.035, 40);
      if (stage === 'hold') {
        fx.burst(h.x, h.floor + 0.1, 0xffb04a, 10, 4);
        if (near) {
          fx.beep(55, 0.2, 'square', 0.12, -15);
          fx.shake(0.22);
          fx.rumble(0.25, 80);
        }
      }
      h.stage = stage;
    }
  }

  function updateMover(m) {
    if (m.axis === 'x') {
      const prev = m.x;
      placeMover(m);
      m.dx = m.x - prev;
      m.dy = 0;
    } else {
      const prev = m.y;
      placeMover(m);
      m.dy = m.y - prev;
      m.dx = 0;
    }
  }

  // ------------------------------------------------------------------ run

  function results() {
    const p = state.player;
    const L = state.level;
    const modules = Object.values(p.upgrades).filter(Boolean).length;
    const t = state.runTime;
    const dmg = state.damageTaken;
    const r = state.reboots;
    let rank = 'C';
    if (r === 0 && dmg <= 10 && t <= L.par) rank = 'S';
    else if (r <= 1 && dmg <= 24 && t <= L.par * 1.5) rank = 'A';
    else if (r <= 3) rank = 'B';
    return { levelIndex: state.levelIndex, level: L, time: t, damage: dmg, syncLevel: p.level, modules, reboots: r, kills: state.kills, scrap: state.scrapTotal, rank, difficulty: state.diff.id };
  }

  function completeMission() {
    if (state.complete) return;
    state.complete = true;
    fx.complete(results());
  }

  /** One fixed step of the run. */
  function step(dt) {
    if (!state.player || state.complete) return;
    state.time += dt;
    if (!state.bossDefeated) state.runTime += dt;
    for (const m of state.movers) updateMover(m);
    for (const h of state.hazards) if (h.type === 'crusher') updateCrusher(h);
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    if (state.completeT > 0) {
      state.completeT -= dt;
      if (state.completeT <= 0) completeMission();
    }
  }

  function buyUpgrade(id) {
    const u = UPGRADES.find((v) => v.id === id);
    const p = state.player;
    if (!u || !p || p.upgrades[id] || p.scrap < u.cost) return false;
    p.scrap -= u.cost;
    p.upgrades[id] = true;
    u.apply(p);
    fx.beep(680, 0.12, 'square', 0.1, 260);
    return true;
  }

  return { state, input, load, step, buyUpgrade, damagePlayer, completeMission, levels: LEVELS };
}
