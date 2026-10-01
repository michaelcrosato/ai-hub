// The raid itself: the player ship, enemies, bosses, shots, pickups and both stage scripts.
// Ported from the original single-file game; the numbers (speeds, hit boxes, timings,
// scores) are the original's. New: the harbor route with lancers, minelayers, mines, the
// SCATTER pod and the BREAKWATER dredge; continues from a sector; Veteran mode.

import { TAU, C, clamp, lerp, rand, rr } from './util.js';
import { audio } from './audio.js';
import { U, mesh, gunGeo, repairGeo, enemyGeo, miniModel, walkerModel, dredgeModel } from './world.js';
import { S, POD, DIFFICULTY, ROUTES } from './state.js';

const HP = { dart: 7, interceptor: 9, carrier: 34, turret: 28, sentry: 24, lancer: 12, minelayer: 30, mine: 4 };
const SPEED = { dart: 5.0, interceptor: 8, carrier: 2.9, turret: 4.6, sentry: 3.8, lancer: 4.4, minelayer: 2.4, mine: 1.6 };
const SCORE = { dart: 100, interceptor: 150, carrier: 350, turret: 250, sentry: 300, lancer: 220, minelayer: 320, mine: 60 };
/** Contact hit box (half sizes) and shot hit box per enemy type. */
const BODY = {
  dart: [0.8, 0.52, 1.0, 0.55],
  interceptor: [0.8, 0.52, 1.0, 0.55],
  carrier: [1.65, 0.65, 1.8, 0.7],
  turret: [0.8, 0.52, 0.9, 0.55],
  sentry: [0.8, 0.52, 0.85, 0.85],
  lancer: [1.3, 0.35, 1.5, 0.42],
  minelayer: [1.6, 0.75, 1.7, 0.8],
  mine: [0.5, 0.5, 0.58, 0.58],
  mini: [2.8, 1.3, 3.5, 1.55],
  walker: [2.7, 3.0, 2.9, 3.4],
  dredge: [3.6, 1.45, 3.9, 2.0],
};
const BOSS = {
  mini: { hp: 390, x: 26, y: 2, scale: 1, hold: 39, score: 4500, parts: [[45, -1.75, -1.65, 0], [45, -1.75, 1.65, 1]] },
  walker: { hp: 1120, x: 27, y: -0.7, scale: 1.22, hold: 86, score: 12000, parts: [[100, -2.07, -2.44, 1], [100, -2.07, 3.66, 0]] },
  dredge: { hp: 1300, x: 28, y: -3.4, scale: 1.15, hold: 86, score: 14000, parts: [[110, -3.565, -0.63, 0], [110, -2.185, 1.78, 1]] },
};
export const BOSS_NAMES = {
  mini: ['DEBT COLLECTOR / PATROL CARRIER', 'TOLLKEEPER / PATROL CARRIER'],
  walker: ['CUSTODIAN / MK.09', 'CUSTODIAN / MK.09'],
  dredge: ['BREAKWATER / DREDGE 4', 'BREAKWATER / DREDGE 4'],
};
const FALLBACK_GUN = { x: -2.5, y: 0 };

const diff = () => DIFFICULTY[S.difficulty] || DIFFICULTY.arcade;

// ---------------------------------------------------------------- small helpers
/** Keep the items `keep` accepts, in order, without allocating a new array. */
function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (keep(v)) arr[j++] = v;
  }
  arr.length = j;
}
const aliveFx = (v) => v.life > 0;
const keepShot = (b) => b.life > 0 && b.x < 28 && Math.abs(b.y) < 15;
const keepBullet = (b) => b.life > 0 && Math.abs(b.x) < 28 && Math.abs(b.y) < 15;
const keepPickup = (p) => {
  if (!p.taken) return true;
  S.actors.remove(p.n);
  return false;
};
const keepEnemy = (e) => {
  if (!e.dead) return true;
  S.actors.remove(e.n);
  return false;
};

export function notifyFloat(x, y, text, color = C.mint, size = 16) {
  if (S.floats.length > 40) S.floats.shift();
  S.floats.push({ x, y, text, color, size, life: 1.3, max: 1.3 });
}

// Particles come from a pool: an explosion no longer allocates 18 to 54 objects.
const MAX_PARTICLES = 650;
const pool = [];
let pCursor = 0;
export function addParticles(x, y, count = 16, color = C.amber, power = 1) {
  const list = S.particles;
  for (let i = 0; i < count; i++) {
    let p;
    if (list.length < MAX_PARTICLES) {
      p = pool.pop() || {};
      list.push(p);
    } else {
      // Full: recycle the oldest slots in turn (the original dropped the oldest).
      p = list[pCursor % list.length];
      pCursor = (pCursor + 1) % MAX_PARTICLES;
    }
    const angle = rr(0, TAU);
    const speed = rr(1, 8) * power;
    p.x = x;
    p.y = y;
    p.z = rr(-0.4, 0.8);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.life = rr(0.2, 0.8);
    p.max = 0.8;
    p.color = color;
    p.size = rr(0.035, 0.11) * power;
    p.debris = i % 4 === 0;
  }
}

export function explosion(x, y, size = 1, quiet = false) {
  addParticles(x, y, Math.floor(18 * size), C.amber, size);
  S.rings.push({ x, y, r: 0.05, life: 0.4 + size * 0.12, max: 0.4 + size * 0.12, size, kind: 'blast' });
  if (!quiet) audio.sfx('explode');
  S.shake = Math.max(S.shake, 0.12 * size);
}

export function addScore(amount, x, y, chain = true) {
  if (chain) {
    S.chainHits++;
    S.chainLevel = Math.min(8, 1 + Math.floor(S.chainHits / 3));
    S.maxChain = Math.max(S.maxChain, S.chainLevel);
    S.chainTimer = 3.7;
  }
  const pts = Math.round(amount * S.chainLevel * diff().score);
  S.score += pts;
  if (x !== undefined) notifyFloat(x, y, '+' + pts, S.chainLevel > 2 ? C.mint : '#c3d0cd', 13);
}

// ---------------------------------------------------------------- pods and pickups
export function drop(type, x, y) {
  const n = type === 'REPAIR' ? mesh(repairGeo()) : mesh(gunGeo(type));
  if (type !== 'REPAIR') n.scale.setScalar(0.7);
  n.position.set(x, y, 0.5);
  S.actors.add(n);
  const p = { type, x, y, base: y, t: 0, life: 18, n, taken: false };
  S.pickups.push(p);
  return p;
}

export function setWeapon(type, ammo) {
  const pl = S.player;
  pl.weapon = type;
  pl.ammo = ammo ?? POD[type].ammo;
  pl.maxAmmo = POD[type].ammo;
  const gun = S.playerNode.userData.gun;
  gun.geometry = gunGeo(type);
  gun.visible = true;
  pl.podCD = 0.14;
  S.ui.hud();
}

function podEmpty() {
  S.player.ammo = 0;
  S.playerNode.userData.gun.visible = false;
  S.ui.radio('Pod empty. Main gun active. Take another pod.', 'ARM SYSTEM', 3);
}

export function take(p, remote = false) {
  if (p.taken) return;
  const pl = S.player;
  p.taken = true;
  p.n.visible = false;
  audio.sfx('grab');
  S.ui.rumble(0.25, 80);
  if (remote) S.tethers.push({ x: p.x, y: p.y, life: 0.33, max: 0.33 });
  if (p.type === 'REPAIR') {
    pl.hp = Math.min(pl.maxHP, pl.hp + 2);
    S.energy = Math.min(100, S.energy + 15);
    notifyFloat(pl.x, pl.y + 1.4, 'HULL +2', C.mint);
    S.ui.radio('Hull repaired. Stay sharp.', 'SYSTEM', 2);
  } else {
    S.podsTaken++;
    setWeapon(p.type);
    S.energy = Math.min(100, S.energy + 8);
    notifyFloat(pl.x, pl.y + 1.6, p.type + ' CAPTURED', POD[p.type].color, 17);
    S.ui.radio(p.type + ' linked. Enemy property, new owner.', 'ARM SYSTEM', 2.5);
  }
  addParticles(p.x, p.y, 16, C.mint, 0.6);
  S.ui.hud();
}

/** The pickup within reach of the arm (7.1 units), or null. */
export function nearestPickup() {
  const pl = S.player;
  let nearest = null;
  let dist = 7.1;
  for (const p of S.pickups) {
    const d = Math.hypot(p.x - pl.x, p.y - pl.y);
    if (!p.taken && d < dist) {
      dist = d;
      nearest = p;
    }
  }
  return nearest;
}

export function grab() {
  if (S.mode !== 'play' || S.player.dead) return;
  const nearest = nearestPickup();
  if (nearest) take(nearest, true);
  else {
    S.rings.push({ x: S.player.x, y: S.player.y, r: 0.1, life: 0.35, max: 0.35, size: 3.2, kind: 'scan' });
    audio.sfx('flip');
  }
}

export function flip() {
  if (S.mode !== 'play' || S.player.dead) return;
  S.player.upper = !S.player.upper;
  audio.sfx('flip');
  S.ui.hud();
}

export function pulse() {
  const pl = S.player;
  if (S.mode !== 'play' || S.energy < 99.9 || pl.dead) return;
  S.energy = 0;
  pl.inv = Math.max(pl.inv, 2.2);
  S.pulseFlash = 0.7;
  S.shake = 0.45;
  audio.sfx('pulse');
  S.ui.rumble(0.8, 320);
  for (const b of S.bullets) addParticles(b.x, b.y, 2, C.mint, 0.25);
  S.bullets.length = 0;
  S.rings.push({ x: pl.x, y: pl.y, r: 0.1, life: 1, max: 1, size: 28, kind: 'pulse' });
  const n = S.enemies.length;
  for (let i = 0; i < n; i++) {
    const e = S.enemies[i];
    if (!e.dead) {
      damageEnemy(e, e.isBoss ? 135 : 45, e.x, e.y);
      if (e.beam) e.beam = null;
    }
  }
  notifyFloat(pl.x, pl.y + 2, 'PULSE RELEASED', C.mint, 20);
  S.ui.hud();
}

// ---------------------------------------------------------------- enemies
export function spawn(type, y = 0, x = 24, opt = {}) {
  const n = mesh(enemyGeo(type));
  n.position.set(x, y, 0);
  if (type === 'interceptor') n.scale.setScalar(0.9);
  S.actors.add(n);
  const hp = HP[type];
  const amp = type === 'dart' ? 1.1 : type === 'carrier' ? 0.65 : type === 'minelayer' ? 0.5 : type === 'mine' ? 0.25 : 0;
  const e = {
    id: ++S.enemyId, type, x, y, base: y, n, hp, maxHP: hp, t: 0,
    fire: rr(1.0, 2.2), speed: opt.speed ?? SPEED[type], amp: opt.amp ?? amp, phase: rr(0, TAU),
    weapon: opt.weapon || 'RIVET', flash: 0, dead: false, flashing: false, ...opt,
  };
  if (type === 'carrier') {
    const pod = mesh(gunGeo(e.weapon));
    pod.position.set(-0.1, -1.18, 0.3);
    pod.scale.setScalar(0.82);
    pod.rotation.y = Math.PI;
    n.add(pod);
    e.pod = pod;
  } else if (type === 'lancer') {
    e.state = 'enter';
    e.stopX = opt.stopX ?? 15;
    e.lane = y;
    e.lock = 0;
    e.lockMax = 1;
    e.vx = 0;
  } else if (type === 'minelayer') {
    e.lay = opt.lay ?? 1.4;
  } else if (type === 'mine') {
    e.arm = -1;
    e.armMax = 0.7;
  }
  S.enemies.push(e);
  return e;
}

function wave(type, y, count = 4, spacing = 3, opts = {}) {
  for (let i = 0; i < count; i++) spawn(type, y, 24 + i * spacing, { ...opts, phase: i * 0.6, base: y, amp: opts.amp ?? 1.0 });
}

export function spawnBoss(type) {
  if (S.boss && !S.boss.dead) return;
  const def = BOSS[type];
  const n = type === 'mini' ? miniModel() : type === 'walker' ? walkerModel() : dredgeModel();
  n.position.set(def.x, def.y, 0);
  n.scale.setScalar(def.scale);
  S.actors.add(n);
  const models = n.userData.parts;
  const boss = {
    id: ++S.enemyId, type, isBoss: true, x: def.x, y: def.y, base: def.y, n, hp: def.hp, maxHP: def.hp, t: 0,
    fire: 2.6, ring: 3.8, nextBeam: type === 'mini' ? 7 : 5.5, beam: null, phase: 1, flash: 0, dead: false, flashing: false,
    hold: def.hold,
    parts: def.parts.map(([hp, x, y, i]) => ({ hp, x, y, n: models[i] })),
    hook: n.userData.hook || null, hookT: 0, hookA: 0, tipX: 0, tipY: 0, scatter: 3.2, mines: 3,
  };
  S.boss = boss;
  S.enemies.push(boss);
  S.ui.bossHud(BOSS_NAMES[type][S.route] || BOSS_NAMES[type][0]);
  const lines = {
    mini: 'Heavy carrier ahead. Break its guns, then its hull.',
    walker: 'Checkpoint in sight. Aim for the body. Break the guns.',
    dredge: 'The dredge is sealing the channel. Mind the hook. Break its guns.',
  };
  S.ui.radio(lines[type], 'CONTROL', 5);
}

export function shootEnemy(x, y, vx, vy, r = 0.17, color = C.red) {
  const f = diff().bullet;
  S.bullets.push({ x, y, vx: vx * f, vy: vy * f, r, color, life: 12, grazed: false });
}

function aimed(x, y, speed = 8, count = 1, spread = 0.15) {
  const a = Math.atan2(S.player.y - y, S.player.x - x);
  for (let i = 0; i < count; i++) {
    const b = a + (i - (count - 1) / 2) * spread;
    shootEnemy(x, y, Math.cos(b) * speed, Math.sin(b) * speed);
  }
}

function delay(time, fn) {
  S.delays.push({ time, fn });
}

export function damageEnemy(e, damage, x, y, part = null) {
  if (e.dead) return;
  if (part && part.hp > 0) {
    part.hp -= damage;
    if (part.hp <= 0) {
      part.n.visible = false;
      explosion(e.x + part.x, e.y + part.y, 1.2);
      addScore(750, e.x + part.x, e.y + part.y);
      notifyFloat(e.x + part.x, e.y + part.y + 1, 'GUN DESTROYED', C.amber, 15);
      e.hp -= e.isBoss && e.type !== 'mini' ? 70 : 25;
      S.ui.rumble(0.45, 140);
    }
  } else e.hp -= damage;
  e.flash = 0.06;
  if (e.hp <= 0) killEnemy(e);
}

export function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  S.kills++;
  e.n.visible = false;
  S.energy = Math.min(100, S.energy + (e.isBoss ? 25 : 2.6));
  addScore(e.isBoss ? BOSS[e.type].score : SCORE[e.type], e.x, e.y);
  explosion(e.x, e.y, e.isBoss ? 3 : e.type === 'mine' ? 0.6 : 1.0, e.type === 'mine');
  if (e.type === 'mine') audio.sfx('pop');
  if (e.type === 'carrier') drop(e.weapon, e.x, e.y);
  else if (!e.isBoss && e.type !== 'mine' && rand() < 0.05) drop('REPAIR', e.x, e.y);
  if (!e.isBoss) return;
  S.bullets.length = 0;
  e.beam = null;
  S.ui.bossHud(null);
  S.ui.rumble(1, 600);
  for (let i = 0; i < 6; i++) delay(i * 0.13, () => explosion(e.x + rr(-3, 3), e.y + rr(-2.5, 2.5), rr(0.8, 1.8), i > 1));
  if (e.type === 'mini') {
    drop(S.route === 1 ? 'SCATTER' : 'SWARM', e.x - 2, e.y - 1);
    drop('REPAIR', e.x + 1, e.y + 2);
    S.ui.radio(S.route === 1 ? 'Toll paid in full. Keep moving.' : 'Debt settled. Keep moving.', 'CONTROL', 4);
  } else {
    S.winWait = 3.0;
    S.player.inv = 10;
    if (S.route === 1) S.ui.banner('CHANNEL OPEN', 'CLEARANCE GRANTED', 'THE TIDE GOES OUR WAY.', 2.7);
    else S.ui.banner('CHECKPOINT DOWN', 'CLEARANCE GRANTED', 'THAT COUNTS AS PERMISSION.', 2.7);
    audio.sfx('win');
    // Mines and stragglers go down with their boss.
    for (const o of S.enemies) if (!o.dead && !o.isBoss) killQuietly(o);
  }
  S.boss = null;
}

function killQuietly(e) {
  e.dead = true;
  e.n.visible = false;
  explosion(e.x, e.y, 0.7, true);
}

export function hurt() {
  const pl = S.player;
  if (S.mode !== 'play' || pl.inv > 0 || pl.dead || S.testGod) return;
  pl.hp--;
  S.hitsTaken++;
  S.chainHits = 0;
  S.chainLevel = 1;
  S.chainTimer = 0;
  pl.inv = 1.9;
  S.shake = 0.6;
  S.flash = 0.5;
  audio.sfx('hit');
  S.ui.rumble(0.7, 220);
  addParticles(pl.x, pl.y, 23, C.amber, 0.9);
  if (pl.hp <= 0) {
    explosion(pl.x, pl.y, 2);
    pl.lives--;
    pl.dead = true;
    S.playerNode.visible = false;
    S.ui.rumble(1, 500);
    if (pl.lives > 0) {
      pl.respawn = 1.6;
      S.ui.radio('Ship lost. Sending your next Magpie.', 'CONTROL', 3);
    } else {
      S.deathWait = 2.1;
      S.ui.radio('Flight signal lost.', 'CONTROL', 2);
    }
  }
  S.ui.hud();
}

function shot(x, y, vx, vy, r, life, damage, kind) {
  return { x, y, vx, vy, r, life, damage, kind, hits: kind === 'rail' ? [] : null, trail: kind === 'missile' ? [] : null };
}

function firePlayer(dt) {
  const pl = S.player;
  pl.fireCD -= dt;
  pl.podCD -= dt;
  if (!S.ctl.fire || pl.dead) {
    pl.fireCD = Math.max(0, pl.fireCD);
    pl.podCD = Math.max(0, pl.podCD);
    return;
  }
  if (pl.fireCD <= 0) {
    pl.fireCD += 0.1;
    S.shots.push(shot(pl.x + 1.8, pl.y - 0.11, 62, 0, 0.1, 1, 2, 'main'));
    audio.sfx('fire');
  }
  if (pl.ammo > 0 && pl.podCD <= 0) {
    const x = pl.x + 1.2;
    const y = pl.y + (pl.upper ? 0.88 : -1.24);
    const type = pl.weapon;
    if (type === 'RIVET') {
      pl.podCD += 0.058;
      pl.ammo--;
      S.shots.push(shot(x, y, 66, (pl.upper ? 0 : -3.4) + rr(-1, 1), 0.12, 1, 1.65, 'rivet'));
    } else if (type === 'RAIL') {
      pl.podCD += 0.25;
      pl.ammo--;
      S.shots.push(shot(x, y, 90, pl.upper ? 0 : -3.1, 0.18, 0.8, 10.5, 'rail'));
      audio.sfx('rail');
    } else if (type === 'SCATTER') {
      // Five pellets: a tight fan from the upper arm, a wide downward fan from the lower.
      pl.podCD += 0.2;
      pl.ammo--;
      const base = pl.upper ? 0 : -0.16;
      const spread = pl.upper ? 0.07 : 0.15;
      for (let i = -2; i <= 2; i++) {
        const a = base + i * spread + rr(-0.02, 0.02);
        S.shots.push(shot(x, y, Math.cos(a) * 52, Math.sin(a) * 52, 0.14, 0.32, 2.4, 'scatter'));
      }
      audio.sfx('scatter');
    } else {
      pl.podCD += 0.36;
      const count = Math.min(2, pl.ammo);
      pl.ammo -= count;
      for (let i = 0; i < count; i++) S.shots.push(shot(x, y + (i - 0.5) * 0.24, 16, (pl.upper ? 1 : -1) * (i ? 8 : 3), 0.17, 3, 7, 'missile'));
      audio.sfx('missile');
    }
    addParticles(x + 0.4, y, 2, POD[type].color, 0.15);
    if (pl.ammo <= 0) podEmpty();
  }
}

// ---------------------------------------------------------------- per-type behaviour
function gunVolley(e, p) {
  const fast = e.phase === 2;
  aimed(e.x + p.x - 1.2, e.y + p.y, 8.8, fast ? 5 : 3, 0.16);
  if (fast) delay(0.22, () => {
    if (!e.dead) aimed(e.x + p.x - 1.2, e.y + p.y, 8.2, 3, 0.14);
  });
}

function updateBoss(e, dt) {
  const d = diff();
  const pl = S.player;
  e.t += dt;
  if (e.type === 'dredge') {
    e.x = lerp(e.x, 13.4, dt * 0.55);
    e.y = -3.4 + Math.sin(e.t * 0.5) * 0.45;
  } else {
    e.x = lerp(e.x, e.type === 'mini' ? 12.6 : 12.8, dt * 0.65);
    e.y = e.type === 'mini' ? 1.9 + Math.sin(e.t * 0.6) * 3.0 : -0.7 + Math.sin(e.t * 0.75) * 0.22;
  }
  e.phase = e.hp / e.maxHP < 0.48 ? 2 : 1;
  const legs = e.n.userData.legs;
  if (legs) for (let i = 0; i < 2; i++) legs[i].rotation.z = Math.sin(e.t * 1.3 + i * Math.PI) * 0.065;
  e.fire -= dt;
  e.ring -= dt;
  e.nextBeam -= dt;
  if (e.fire < 0 && e.x < 17) {
    e.fire = (e.phase === 2 ? 1.1 : 1.7) * d.cooldown;
    let live = 0;
    for (const p of e.parts) {
      if (p.hp > 0) {
        live++;
        gunVolley(e, p);
      }
    }
    if (!live) gunVolley(e, FALLBACK_GUN);
  }
  if (e.ring < 0 && e.type === 'walker') {
    e.ring = (e.phase === 2 ? 2.5 : 3.8) * d.cooldown;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.63 + (i * Math.PI * 0.74) / 8;
      shootEnemy(e.x - 2, e.y, Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0.19, C.amber);
    }
  }
  if (e.type !== 'dredge' && e.nextBeam < 0 && !e.beam && e.x < 17) {
    e.nextBeam = e.phase === 2 ? 6.7 : 8.5;
    e.beam = { y: pl.y, t: 0, charge: e.type === 'mini' ? 1.65 : 1.25, duration: e.type === 'mini' ? 0.6 : 0.8 };
    audio.sfx('warning');
    S.ui.radio('Beam charging. Move out of the marked lane.', 'WARNING', 2);
  }
  if (e.beam) {
    const b = e.beam;
    b.t += dt;
    if (b.t > b.charge && b.t < b.charge + b.duration && Math.abs(pl.y - b.y) < 0.52 && pl.x < e.x - 2 && !pl.dead) hurt();
    if (b.t > b.charge + b.duration) e.beam = null;
  }
  if (e.type === 'dredge') updateDredge(e, dt, d);
}

/** BREAKWATER: a swinging crane hook, scatter blasts from its lower gun, and mines once it is hurt. */
function updateDredge(e, dt, d) {
  const pl = S.player;
  const fast = e.phase === 2;
  e.hookT += dt * (fast ? 1.65 : 1.15);
  e.hookA = fast ? -0.6 + 0.95 * Math.sin(e.hookT) : -0.45 + 0.75 * Math.sin(e.hookT);
  e.hook.rotation.z = e.hookA;
  const s = 1.15;
  const L = 4.25 * s;
  e.tipX = e.x - 4.6 * s + Math.sin(e.hookA) * L;
  e.tipY = e.y + 3.2 * s - Math.cos(e.hookA) * L;
  if (!pl.dead && Math.hypot(pl.x - e.tipX, pl.y - e.tipY) < 1.05) hurt();
  e.scatter -= dt;
  const sg = e.parts[0];
  if (e.scatter < 0 && e.x < 17) {
    e.scatter = (fast ? 2.4 : 3.3) * d.cooldown;
    if (sg.hp > 0) {
      const ox = e.x + sg.x - 1.2;
      const oy = e.y + sg.y;
      const a = Math.atan2(pl.y - oy, pl.x - ox);
      for (let i = 0; i < 7; i++) {
        const b = a + (i - 3) * 0.13;
        shootEnemy(ox, oy, Math.cos(b) * 7.6, Math.sin(b) * 7.6, 0.17, C.amber);
      }
      audio.sfx('scatter');
    }
  }
  if (fast) {
    e.mines -= dt;
    if (e.mines < 0) {
      e.mines = 4.6 * d.cooldown;
      spawn('mine', e.y + 0.6, e.x - 2.6, { speed: 2.2, amp: 0.3 });
      spawn('mine', e.y - 1.6, e.x - 1.4, { speed: 2.0, amp: 0.3 });
      audio.sfx('beep');
    }
  }
}

/** Lancer: flies in, locks the player's lane (telegraphed), then charges down it. */
function updateLancer(e, dt) {
  const pl = S.player;
  if (e.state === 'enter') {
    e.x -= e.speed * dt;
    e.y = e.base + Math.sin(e.t * 1.6 + e.phase) * 0.35;
    if (e.x <= e.stopX) {
      e.state = 'lock';
      e.lock = e.lockMax = S.difficulty === 'assist' ? 1.25 : S.difficulty === 'veteran' ? 0.8 : 0.95;
      e.lane = pl.dead ? e.y : clamp(pl.y, -8, 8.2);
      audio.sfx('lock');
    }
  } else if (e.state === 'lock') {
    e.lock -= dt;
    e.y = lerp(e.y, e.lane, Math.min(1, dt * 7));
    if (e.lock <= 0) {
      e.state = 'charge';
      e.vx = 6;
      audio.sfx('lance');
    }
  } else {
    e.vx = Math.min(34, e.vx + dt * 70);
    e.x -= e.vx * dt;
    e.y = lerp(e.y, e.lane, Math.min(1, dt * 7));
    if (rand() < 0.5) addParticles(e.x + 1.4, e.y, 1, C.red, 0.2);
  }
  e.n.rotation.z = e.state === 'lock' ? Math.sin(e.t * 26) * 0.03 : 0;
}

/** Mine: drifts with the scroll; arms when the ship comes close, then bursts into a ring. */
function updateMine(e, dt) {
  const pl = S.player;
  e.n.rotation.z = e.t * 1.2;
  if (e.arm < 0) {
    if (!pl.dead && e.x < 19 && Math.hypot(pl.x - e.x, pl.y - e.y) < 2.7) {
      e.arm = e.armMax = S.difficulty === 'assist' ? 0.9 : 0.7;
      audio.sfx('tick');
    }
  } else {
    e.arm -= dt;
    if (e.arm <= 0) {
      e.dead = true;
      e.n.visible = false;
      explosion(e.x, e.y, 0.7, true);
      audio.sfx('burst');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        shootEnemy(e.x, e.y, Math.cos(a) * 6.2, Math.sin(a) * 6.2, 0.16, C.amber);
      }
    }
  }
}

function updateEnemy(e, dt) {
  if (e.dead) return;
  const pl = S.player;
  e.flash = Math.max(0, e.flash - dt);
  if (e.isBoss) updateBoss(e, dt);
  else {
    e.t += dt;
    if (e.type === 'lancer') updateLancer(e, dt);
    else {
      e.x -= e.speed * dt;
      if (e.type !== 'turret') e.y = e.base + Math.sin(e.t * (e.type === 'interceptor' ? 1.8 : 1.4) + e.phase) * e.amp;
    }
    if (e.type === 'sentry') e.n.rotation.z = e.t * 0.65;
    else if (e.type === 'mine') updateMine(e, dt);
    else if (e.type === 'minelayer') {
      e.lay -= dt;
      if (e.lay <= 0 && e.x < 21 && e.x > -12) {
        e.lay = 2.3 * diff().cooldown;
        spawn('mine', e.y - 1.1, e.x + 0.2, { speed: 1.5, amp: 0.3 });
        audio.sfx('beep');
      }
    }
    e.fire -= dt;
    const shoots = e.type !== 'lancer' && e.type !== 'mine';
    if (shoots && e.fire <= 0 && e.x < 20 && e.x > pl.x + 2) {
      const t = e.type;
      e.fire = (t === 'turret' ? 2.5 : t === 'carrier' ? 1.7 : t === 'minelayer' ? 2.6 : 2.9) * diff().cooldown;
      if (t === 'dart' || t === 'interceptor') aimed(e.x - 1, e.y, 8.8);
      else if (t === 'carrier') aimed(e.x - 1.5, e.y - 0.1, 8.5, 2, 0.11);
      else if (t === 'turret') aimed(e.x - 1, e.y + 0.5, 9, 3, 0.16);
      else if (t === 'minelayer') aimed(e.x - 1.5, e.y, 8, 1);
      else aimed(e.x - 0.5, e.y, 7.5, 5, 0.18);
    }
    if (e.x < -25 && !e.dead) {
      e.dead = true;
      e.n.visible = false;
    }
  }
  e.n.position.x = e.x;
  e.n.position.y = e.y;
  if (!pl.dead && !e.dead) {
    const box = BODY[e.type];
    if (Math.abs(pl.x - e.x) < box[0] + 0.45 && Math.abs(pl.y - e.y) < box[1] + 0.3) {
      hurt();
      if (e.type === 'mine' && e.arm < 0) e.arm = e.armMax = 0.05; // a mine you hit goes off
    }
  }
}

function shotCollision(b, e) {
  if (e.dead || (b.hits && b.hits.includes(e.id))) return false;
  if (e.isBoss) {
    for (const p of e.parts) {
      if (p.hp > 0 && Math.abs(b.x - (e.x + p.x - 1)) < 1.5 + b.r && Math.abs(b.y - (e.y + p.y)) < 0.5 + b.r) {
        damageEnemy(e, b.damage, b.x, b.y, p);
        if (b.hits) b.hits.push(e.id);
        return true;
      }
    }
  }
  const box = BODY[e.type];
  if (Math.abs(b.x - e.x) < box[2] + b.r && Math.abs(b.y - e.y) < box[3] + b.r) {
    damageEnemy(e, b.damage, b.x, b.y);
    if (b.hits) b.hits.push(e.id);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- the step
const due = [];
export function updateGame(dt) {
  const pl = S.player;
  const node = S.playerNode;
  S.elapsed += dt;
  // The stage clock waits while a boss holds the route.
  if (!(S.boss && S.stageTime >= S.boss.hold)) S.stageTime += dt;
  while (S.eventIndex < S.events.length && S.stageTime >= S.events[S.eventIndex][0]) {
    const ev = S.events[S.eventIndex++];
    ev[1]();
  }
  const ds = S.delays;
  let j = 0;
  due.length = 0;
  for (let i = 0; i < ds.length; i++) {
    const d = ds[i];
    d.time -= dt;
    if (d.time <= 0) due.push(d);
    else ds[j++] = d;
  }
  ds.length = j;
  for (const d of due) d.fn();
  S.ui.tick(dt);

  S.chainTimer = Math.max(0, S.chainTimer - dt);
  if (S.chainTimer === 0) {
    S.chainHits = 0;
    S.chainLevel = 1;
  }
  S.energy = Math.min(100, S.energy + dt * 1.0);
  pl.inv = Math.max(0, pl.inv - dt);
  S.shake = Math.max(0, S.shake - dt * 1.6);
  S.flash = Math.max(0, S.flash - dt * 2);
  S.pulseFlash = Math.max(0, S.pulseFlash - dt);

  if (pl.respawn > 0) {
    pl.respawn -= dt;
    if (pl.respawn <= 0) {
      pl.dead = false;
      pl.hp = pl.maxHP;
      pl.x = -12;
      pl.y = 0;
      pl.inv = 3.2;
      pl.ammo = 0;
      node.userData.gun.visible = false;
      drop('RIVET', -7, 1);
      S.energy = Math.min(100, S.energy + 20);
      S.ui.hud();
    }
  }

  if (!pl.dead) {
    let dx = S.ctl.x;
    let dy = S.ctl.y;
    const speed = S.ctl.focus ? 5.8 : 12.7;
    if (S.ctl.mouse) {
      // Mouse flight: head for the point under the cursor.
      const mx = S.ctl.mx - pl.x;
      const my = S.ctl.my - pl.y;
      const md = Math.hypot(mx, my);
      const step = speed * dt;
      if (md > 0.05) {
        dx = mx / md;
        dy = my / md;
        pl.x += dx * Math.min(md, step);
        pl.y += dy * Math.min(md, step);
      } else dx = dy = 0;
    } else {
      pl.x += dx * speed * dt;
      pl.y += dy * speed * dt;
    }
    pl.vx = dx;
    pl.vy = dy;
    pl.x = clamp(pl.x, -18.5, 18);
    pl.y = clamp(pl.y, -8.3, 8.45);
    firePlayer(dt);
    node.visible = !(pl.inv > 0 && Math.floor(pl.inv * 14) % 2 === 0);
    node.position.set(pl.x, pl.y, 0);
    node.scale.setScalar(0.79);
    node.rotation.x = lerp(node.rotation.x, dy * 0.16, dt * 8);
    node.rotation.y = lerp(node.rotation.y, -0.09 + dx * 0.035, dt * 8);
    node.rotation.z = lerp(node.rotation.z, dy * 0.08, dt * 8);
    pl.armAngle = lerp(pl.armAngle, pl.upper ? Math.PI : 0, dt * 12);
    node.userData.arm.rotation.x = pl.armAngle;
  }

  for (const e of S.enemies) updateEnemy(e, dt);

  for (const b of S.shots) {
    if (b.kind === 'missile') {
      let target = null;
      let dist = 1e9;
      for (const e of S.enemies) {
        if (!e.dead && e.x > b.x - 2) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < dist) {
            dist = d;
            target = e;
          }
        }
      }
      if (target) {
        const a = Math.atan2(target.y - b.y, target.x - b.x);
        b.vx = lerp(b.vx, Math.cos(a) * 28, dt * 5);
        b.vy = lerp(b.vy, Math.sin(a) * 28, dt * 5);
      } else b.vx = lerp(b.vx, 37, dt * 3);
      // The trail reuses its points once it is full (no allocation per step).
      const pt = b.trail.length >= 9 ? b.trail.shift() : [0, 0];
      pt[0] = b.x;
      pt[1] = b.y;
      b.trail.push(pt);
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const e of S.enemies) {
      if (shotCollision(b, e)) {
        addParticles(b.x, b.y, 3, b.kind === 'rail' ? C.cyan : b.kind === 'scatter' ? C.lime : C.amber, 0.28);
        if (b.kind !== 'rail') {
          b.life = 0;
          break;
        }
      }
    }
  }
  compact(S.shots, keepShot);

  const podY = pl.y + (pl.upper ? 0.88 : -1.24);
  for (const b of S.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (!pl.dead) {
      const d = Math.hypot(b.x - pl.x, b.y - pl.y);
      if (d < b.r + 0.3) {
        hurt();
        b.life = 0;
      } else if (d < 0.88 && !b.grazed) {
        b.grazed = true;
        S.energy = Math.min(100, S.energy + 0.9);
        S.score += 15;
        addParticles(b.x, b.y, 2, C.cyan, 0.2);
      } else if (pl.ammo > 0 && Math.hypot(b.x - pl.x - 0.45, b.y - podY) < b.r + 0.28) {
        // The captured pod soaks up a round, and pays for it with ammunition.
        b.life = 0;
        pl.ammo = Math.max(0, pl.ammo - 1);
        addParticles(b.x, b.y, 4, C.amber, 0.4);
        if (pl.ammo === 0) podEmpty();
      }
    }
  }
  compact(S.bullets, keepBullet);

  for (const p of S.pickups) {
    p.t += dt;
    p.life -= dt;
    p.x -= 1.0 * dt;
    p.y = p.base + Math.sin(p.t * 2.3) * 0.28;
    p.n.position.set(p.x, p.y, 0.3);
    p.n.rotation.y = Math.sin(p.t * 1.7) * 0.45;
    p.n.rotation.z = Math.sin(p.t) * 0.12;
    if (!p.taken && !pl.dead && Math.hypot(p.x - pl.x, p.y - pl.y) < 1.25) take(p);
    if (p.life <= 0 || p.x < -23) {
      p.taken = true;
      p.n.visible = false;
    }
  }
  if (pl.ammo <= 0) node.userData.gun.visible = false;
  compact(S.pickups, keepPickup);
  compact(S.enemies, keepEnemy);

  updateEffects(dt);

  if (S.deathWait > 0) {
    S.deathWait -= dt;
    // A boss that went down with the last ship still counts as a win.
    if (S.deathWait <= 0 && S.winWait <= 0) {
      S.ui.finish(false);
      return;
    }
  }
  if (S.winWait > 0) {
    S.winWait -= dt;
    if (S.winWait <= 0) S.ui.finish(true);
  }
}

export function updateEffects(dt) {
  const list = S.particles;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-dt * 2);
    p.vy -= dt * 3;
    p.life -= dt;
    if (p.life <= 0) {
      const last = list.pop();
      if (i < list.length) list[i] = last;
      pool.push(p);
    }
  }
  for (const r of S.rings) {
    r.life -= dt;
    r.r += dt * r.size * 5;
  }
  compact(S.rings, aliveFx);
  for (const f of S.floats) {
    f.y += dt * 0.6;
    f.life -= dt;
  }
  compact(S.floats, aliveFx);
  for (const t of S.tethers) t.life -= dt;
  compact(S.tethers, aliveFx);
}

// ---------------------------------------------------------------- the backdrop
/** Scroll the city (or the harbor) and switch each sector's set pieces. */
export function updateCity(dt) {
  const sc = S.scenery;
  S.cityClock += dt;
  const menuish = S.mode === 'menu' || (S.mode === 'manual' && S.manualBack === 'menu');
  const speed = menuish ? 0.52 : S.boss && S.boss.type !== 'mini' ? 0.72 : 2.4;
  for (const s of sc.scroll) {
    s.off = (s.off + s.rate * dt * speed) % s.period;
    s.mesh.position.x = -s.off;
  }
  for (const t of sc.traffic) {
    t.x -= t.speed * dt;
    if (t.x < -60) t.x = 60;
  }
  const run = !menuish;
  sc.freight.visible = S.route === 0 && S.stage === 1 && run;
  sc.gate.visible = S.route === 0 && S.stage === 2 && run;
  sc.wall.visible = S.route === 1 && S.stage === 1 && run;
  sc.gate2.visible = S.route === 1 && S.stage === 2 && run;
  U.water.value += (4.6 / 2.4) * speed * dt;
  U.time.value = S.cityClock;
}

// ---------------------------------------------------------------- stage scripts
function sector(n) {
  S.stage = n;
  S.ui.sector(n);
}

function clearField() {
  for (const e of S.enemies) {
    if (!e.isBoss) {
      e.dead = true;
      e.n.visible = false;
    }
  }
  S.bullets.length = 0;
}

function cityScript() {
  const R = S.ui;
  return [
    [1, () => R.radio('You are over the lower city. Weapons free.')],
    [2, () => wave('dart', 2.2, 4, 3.2)],
    [5.8, () => {
      spawn('carrier', -0.2, 23, { weapon: 'RIVET' });
      R.radio(`Destroy the carrier. ${R.prompt('grab')} near its dropped gunpod.`, 'ARM SYSTEM', 5);
    }],
    [9, () => { wave('dart', -3.5, 4, 3.0); spawn('turret', -8.75, 20); }],
    [13, () => { spawn('carrier', 3, 22, { weapon: 'RAIL' }); wave('interceptor', 5.5, 3, 3.5, { amp: 1.8 }); }],
    [17, () => { spawn('sentry', -2, 22); wave('dart', 0.5, 5, 2.7); drop('REPAIR', 20, -5); }],
    [21, () => { spawn('carrier', -4, 22, { weapon: 'SWARM' }); spawn('turret', -8.75, 23); }],
    [25, () => { wave('interceptor', 4, 4, 3.2, { amp: 2 }); spawn('sentry', -3, 25); }],
    [29, () => { wave('dart', -1, 5, 2.8); spawn('carrier', 3.5, 23, { weapon: 'RIVET' }); }],
    [33, () => { R.banner('HEAVY TRAFFIC', 'THREAT DETECTED', 'PATROL CARRIER INBOUND', 2.6, true); audio.sfx('warning'); }],
    [36, () => spawnBoss('mini')],
    [42, () => {
      sector(1);
      R.banner('THE FREIGHT LINE', 'SECTOR 02', 'FOLLOW THE RAILS. WATCH THE ROOFLINE.', 3.1);
      drop('REPAIR', 14, 1);
      drop('RAIL', 18, 3);
    }],
    [46, () => { wave('dart', 3, 5, 2.8); spawn('turret', -8.75, 20); }],
    [50, () => { spawn('carrier', -2, 23, { weapon: 'SWARM' }); wave('interceptor', -5, 4, 2.9, { amp: 1.4 }); }],
    [54, () => { spawn('sentry', 3, 21); spawn('sentry', -4, 27); spawn('turret', -8.75, 24); }],
    [58, () => { wave('dart', 1, 5, 2.7); spawn('carrier', 5.3, 24, { weapon: 'RIVET' }); }],
    [62, () => { spawn('turret', -8.75, 22); spawn('turret', -8.75, 30); wave('interceptor', -3, 4, 3.4, { amp: 2.2 }); }],
    [66, () => { spawn('carrier', 2.2, 23, { weapon: 'RAIL' }); spawn('sentry', -4, 24); drop('REPAIR', 21, -6); }],
    [70, () => { wave('dart', 4, 5, 2.7); wave('interceptor', -4, 4, 3.5, { amp: 1.2 }); }],
    [74, () => {
      spawn('carrier', -1, 22, { weapon: 'SWARM' });
      spawn('turret', -8.75, 22);
      R.radio('Checkpoint ahead. Save a pulse for its fire.');
    }],
    [78, () => { drop('REPAIR', 16, -1); drop('RIVET', 19, 3); drop('RAIL', 21, -3); }],
    [82, () => {
      sector(2);
      R.banner('NO CLEARANCE', 'SECTOR 03 / LOCKDOWN', 'CUSTODIAN MK.09 HAS ENTERED THE ROUTE', 3.6, true);
      audio.sfx('warning');
      S.energy = Math.min(100, S.energy + 20);
    }],
    [86, () => { clearField(); spawnBoss('walker'); }],
  ];
}

function harborScript() {
  const R = S.ui;
  return [
    [1, () => R.radio('Harbor line. Cranes, open water, no cover. Weapons free.')],
    [2, () => wave('dart', 2.6, 4, 3.2)],
    [5.5, () => {
      spawn('carrier', -0.6, 23, { weapon: 'SCATTER' });
      R.radio('That carrier hauls a SCATTER pod. Short range, wide spread.', 'ARM SYSTEM', 5);
    }],
    [9.5, () => {
      spawn('lancer', 3.5, 25);
      spawn('lancer', -3.5, 29, { stopX: 13 });
      R.radio('Lancers lock a lane, then charge it. Get out of the line.', 'CONTROL', 4.5);
    }],
    [14, () => { spawn('minelayer', 4.6, 23); wave('interceptor', -3.2, 4, 3.3, { amp: 1.6 }); }],
    [18, () => {
      wave('dart', 0.4, 5, 2.7);
      drop('REPAIR', 20, -5);
      R.radio('Mines arm when you get close. Shoot them early.', 'CONTROL', 4);
    }],
    [22, () => { spawn('carrier', 3.2, 22, { weapon: 'RAIL' }); spawn('lancer', -2, 26); spawn('lancer', 5.5, 31, { stopX: 13.5 }); }],
    [26, () => { spawn('minelayer', -4.2, 23); wave('interceptor', 5.2, 3, 3.4, { amp: 1.5 }); }],
    [30, () => { wave('dart', -1.2, 5, 2.8); spawn('carrier', 3.6, 23, { weapon: 'SWARM' }); }],
    [33, () => { R.banner('TOLL BOOTH', 'THREAT DETECTED', 'PATROL CARRIER INBOUND', 2.6, true); audio.sfx('warning'); }],
    [36, () => spawnBoss('mini')],
    [42, () => {
      sector(1);
      R.banner('THE BREAKWATER', 'SECTOR 02', 'STAY HIGH. MIND THE MINES.', 3.1);
      drop('REPAIR', 14, 1);
      drop('SCATTER', 18, 3);
    }],
    [46, () => { spawn('minelayer', 3.4, 23); wave('dart', -3, 5, 2.8); spawn('turret', -8.75, 22); }],
    [50, () => { spawn('lancer', 0, 25); spawn('lancer', 4.2, 28, { stopX: 13 }); spawn('lancer', -5, 31, { stopX: 11 }); }],
    [54, () => { spawn('carrier', -2, 23, { weapon: 'SWARM' }); spawn('sentry', 4, 24); spawn('turret', -8.75, 26); }],
    [58, () => { wave('interceptor', 3, 4, 3.2, { amp: 1.8 }); spawn('minelayer', -3.4, 25); }],
    [62, () => { spawn('sentry', 2, 21); spawn('sentry', -4, 26); spawn('carrier', 5, 24, { weapon: 'SCATTER' }); }],
    [66, () => { wave('dart', 1, 5, 2.7); spawn('lancer', -4, 27); drop('REPAIR', 21, -6); }],
    [70, () => { spawn('minelayer', 4.4, 23); spawn('minelayer', -4.4, 27); wave('interceptor', 0, 4, 3.4, { amp: 1.2 }); }],
    [74, () => {
      spawn('carrier', -1, 22, { weapon: 'RAIL' });
      spawn('turret', -8.75, 23);
      R.radio('Channel gate ahead. Something big is dredging it. Keep a pulse ready.');
    }],
    [78, () => { drop('REPAIR', 16, -1); drop('SCATTER', 19, 3); drop('SWARM', 21, -3); }],
    [82, () => {
      sector(2);
      R.banner('NO PASSAGE', 'SECTOR 03 / LOCKDOWN', 'BREAKWATER HAS SEALED THE CHANNEL', 3.6, true);
      audio.sfx('warning');
      S.energy = Math.min(100, S.energy + 20);
    }],
    [86, () => { clearField(); spawnBoss('dredge'); }],
  ];
}

// ---------------------------------------------------------------- runs
/** Remove everything from the last run (enemies, shots, pickups, effects). */
export function clearRun() {
  for (const e of S.enemies) S.actors.remove(e.n);
  for (const p of S.pickups) S.actors.remove(p.n);
  S.enemies.length = 0;
  S.shots.length = 0;
  S.bullets.length = 0;
  S.pickups.length = 0;
  for (const p of S.particles) pool.push(p);
  S.particles.length = 0;
  S.rings.length = 0;
  S.floats.length = 0;
  S.tethers.length = 0;
  S.delays.length = 0;
  S.boss = null;
}

/** A fresh run on the current route, from the start or (a continue) from a later sector. */
export function resetRun(sectorIndex = 0) {
  clearRun();
  const R = ROUTES[S.route];
  S.events = S.route === 1 ? harborScript() : cityScript();
  const t0 = R.sectorTimes[sectorIndex] || 0;
  S.eventIndex = 0;
  while (S.eventIndex < S.events.length && S.events[S.eventIndex][0] < t0) S.eventIndex++;
  // A continue starts just before its sector's own event (banner, supplies).
  S.stageTime = sectorIndex ? t0 - 0.6 : 0;
  S.stage = sectorIndex;
  S.elapsed = 0;
  S.score = 0;
  S.kills = 0;
  S.chainHits = 0;
  S.chainLevel = 1;
  S.maxChain = 1;
  S.chainTimer = 0;
  S.energy = 100;
  S.hitsTaken = 0;
  S.podsTaken = 0;
  S.deathWait = 0;
  S.winWait = 0;
  S.shake = 0;
  S.flash = 0;
  S.pulseFlash = 0;
  const hull = diff().hull;
  S.player = { x: -12, y: 0.4, hp: hull, maxHP: hull, lives: 3, inv: 2.8, respawn: 0, dead: false, upper: false, armAngle: 0, weapon: 'RIVET', ammo: 240, maxAmmo: 300, fireCD: 0, podCD: 0, vx: 0, vy: 0 };
  const node = S.playerNode;
  node.visible = true;
  node.scale.setScalar(0.79);
  node.position.set(S.player.x, S.player.y, 0);
  node.rotation.set(0, -0.09, 0);
  node.userData.arm.rotation.set(0, 0, 0);
  setWeapon('RIVET', 240);
}

/** Leave the run: clear the field and park the ship for the title screen. */
export function parkShip() {
  clearRun();
  const node = S.playerNode;
  node.visible = true;
  node.userData.gun.visible = true;
  node.userData.gun.geometry = gunGeo('RIVET');
}
