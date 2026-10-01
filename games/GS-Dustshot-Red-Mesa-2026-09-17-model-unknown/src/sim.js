/**
 * sim.js — Dustshot's game rules. Deterministic apart from Math.random, with no
 * DOM and no three.js, so the game and the node tests (tests/sim.test.mjs) run
 * exactly the same code.
 *
 * Every stage is a vertical corridor: the player starts at world.startZ and
 * fights north (toward -z) to a gate that only opens once the stage's hidden
 * WANTED poster has been found; the boss waits behind it.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const len = (x, z) => Math.hypot(x, z) || 1;

export const DIFFICULTIES = {
  greenhorn: { label: 'Greenhorn', note: 'Softer hits and slower trigger fingers. Score ×0.8.', enemyDamage: 0.7, enemyFire: 1.2, enemyHp: 0.9, cash: 1.1, score: 0.8 },
  gunslinger: { label: 'Gunslinger', note: 'The intended balance.', enemyDamage: 1, enemyFire: 1, enemyHp: 1, cash: 1, score: 1 },
  desperado: { label: 'Desperado', note: 'Harder hits, faster fire, tougher outlaws. Score ×1.35.', enemyDamage: 1.3, enemyFire: 0.85, enemyHp: 1.15, cash: 0.95, score: 1.35 },
};
export const DIFFICULTY_ORDER = Object.keys(DIFFICULTIES);

const ENEMY = {
  grunt: { hp: 34, speed: 2.35, fire: 1.55, damage: 8, bulletSpeed: 8.5, xp: 22, cash: 28, radius: 0.48, preferred: 6.6 },
  rifle: { hp: 48, speed: 1.75, fire: 1.22, damage: 10, bulletSpeed: 10.4, xp: 32, cash: 38, radius: 0.5, preferred: 9.5 },
  rider: { hp: 76, speed: 3.2, fire: 1.9, damage: 12, bulletSpeed: 9.0, xp: 46, cash: 52, radius: 0.68, preferred: 5.0 },
  // Lobs a stick of dynamite at where the player is heading; it lands after `flight` seconds.
  dynamiter: { hp: 40, speed: 1.9, fire: 2.75, damage: 15, flight: 1.15, blast: 1.75, xp: 36, cash: 44, radius: 0.5, preferred: 8.6 },
  boss: { hp: 1120, speed: 2.0, fire: 0.82, damage: 10, bulletSpeed: 10.8, xp: 220, cash: 300, radius: 0.82, isBoss: true },
  // Iron Mae on her gatling wagon: sweeping bursts, dynamite once she is hurt.
  mae: { hp: 1900, speed: 2.3, fire: 1.35, damage: 10, bulletSpeed: 10.2, xp: 320, cash: 400, radius: 1.15, isBoss: true, sweep: 10, sweepEnraged: 13, sweepGap: 0.08, arc: 1.3 },
};

/** Player volleys (side offsets) and enemy spreads (radians). */
const SPREAD2 = [-0.2, 0.2];
const SPREAD3 = [-0.34, 0, 0.34];
const VEX_ANGLES = [-0.18, 0, 0.18];
const ONE_ANGLE = [0];

/** Powder kegs: shoot one and everything near it (the player too) takes the blast. */
const KEG = { blast: 2.4, enemyDamage: 90, playerDamage: 18 };

export const STAGES = [
  {
    id: 'cinder',
    name: 'Cinder Creek',
    theme: 'town',
    intro: { title: 'THE WARRANT OPENS THE BOSS FIGHT', text: 'Break suspicious crates. Follow the street north. Stop at the gunsmith to buy upgrades.' },
    objective: 'Find the hidden WANTED poster',
    gateObjective: 'Ride north to the old stockade',
    bossObjective: 'Defeat Marshal Vex',
    bossName: 'Marshal Vex',
    bossIntro: 'MARSHAL VEX — $2,500 REWARD',
    bossEnrage: 'VEX CALLS FOR BACKUP',
    clearTitle: 'Cinder Creek is clear',
    lossTitle: 'Marshal Vex keeps the town',
    world: { minX: -7.0, maxX: 7.0, startZ: 38, bossGateZ: -86, endZ: -104, shop: { x: 6.1, z: -38.5 }, posterCrate: { x: -5.6, z: -12.2 }, bossSpawn: { x: 0, z: -96 }, bossZ: -91.5 },
    hpScale: 1,
    colliders: [
      { x: -5.2, z: 22.5, w: 2.8, d: 1.35, kind: 'trough' },
      { x: 5.4, z: 11.5, w: 1.35, d: 3.6, kind: 'fence' },
      { x: -7.25, z: 2.2, w: 1.15, d: 3.8, kind: 'fence' },
      { x: 5.0, z: -20.0, w: 2.7, d: 1.25, kind: 'crates' },
      { x: -4.7, z: -32.0, w: 2.3, d: 1.25, kind: 'barrels' },
      { x: 4.5, z: -55.5, w: 2.8, d: 1.2, kind: 'crates' },
      { x: -5.2, z: -69.0, w: 1.3, d: 3.4, kind: 'fence' },
    ],
    zones: [
      { trigger: 33, pack: [['grunt', -4.5, 24], ['grunt', 0, 21], ['grunt', 4.4, 18], ['grunt', -2.2, 15]] },
      { trigger: 18, pack: [['rifle', -5.5, 8], ['grunt', 1.5, 7], ['rifle', 5.7, 4], ['grunt', -1.2, 1], ['grunt', 4.0, -2]] },
      { trigger: 2, pack: [['rider', 5.0, -9], ['grunt', -1.5, -9], ['rifle', -5.5, -12], ['grunt', 2.8, -16]] },
      { trigger: -18, pack: [['grunt', -5.5, -27], ['rifle', -2.0, -31], ['grunt', 3.2, -29], ['rider', 5.3, -34], ['grunt', 0.7, -37]] },
      { trigger: -42, pack: [['rifle', -5.5, -50], ['grunt', -1.5, -52], ['rifle', 4.7, -54], ['rider', 0.5, -58], ['grunt', -4.2, -61], ['grunt', 4.8, -64]] },
      { trigger: -64, pack: [['rider', -5.4, -72], ['rifle', 0, -73], ['rider', 5.3, -76], ['grunt', -3.0, -78], ['rifle', 3.2, -81]] },
    ],
    // The loot crates sit in front of their crate stacks (the stacks are the colliders), so what
    // they drop can be picked up; they used to sit inside an invisible 2.7 m wall.
    crates: [
      { id: 9001, kind: 'posterCrate', x: -5.6, z: -12.2, hp: 80, radius: 0.72 },
      { id: 9002, kind: 'lootCrate', x: 3.0, z: -20.2, hp: 60, radius: 0.7 },
      { id: 9003, kind: 'lootCrate', x: 2.45, z: -55.5, hp: 70, radius: 0.7 },
    ],
    equipment: { trigger: 8, items: [['boots', 4.6, -24.5], ['silver', -4.9, -48.5]] },
    boss: 'boss',
    adds: [['grunt', -6.2, -89.5], ['rifle', 6.0, -90.5]],
  },
  {
    id: 'mesa',
    name: 'Red Mesa Pass',
    theme: 'canyon',
    intro: { title: 'STAGE 2 — RED MESA PASS', text: 'Iron Mae Calloway holds the pass. Find her warrant, dodge the dynamite, and shoot the powder kegs near her gang.' },
    objective: "Find Iron Mae's WANTED poster",
    gateObjective: 'Ride north to the Calloway claim',
    bossObjective: 'Defeat Iron Mae',
    bossName: 'Iron Mae',
    bossIntro: 'IRON MAE — $4,000 REWARD',
    bossEnrage: 'MAE LIGHTS THE FUSES',
    clearTitle: 'Red Mesa Pass is open',
    lossTitle: 'Iron Mae holds the pass',
    world: { minX: -7.0, maxX: 7.0, startZ: 38, bossGateZ: -86, endZ: -104, shop: { x: -6.0, z: -40.5 }, posterCrate: { x: 6.2, z: -45.5 }, bossSpawn: { x: 0, z: -97 }, bossZ: -95 },
    hpScale: 1.3,
    colliders: [
      { x: -5.0, z: 26.5, w: 2.2, d: 2.0, kind: 'boulder' },
      { x: 5.6, z: 15.5, w: 1.3, d: 2.6, kind: 'minecart' },
      { x: -6.3, z: 4.0, w: 1.4, d: 3.0, kind: 'boulder' },
      { x: 4.8, z: -8.0, w: 2.2, d: 2.2, kind: 'boulder' },
      { x: -4.8, z: -24.0, w: 2.6, d: 1.3, kind: 'wagon' },
      { x: 5.6, z: -36.0, w: 1.3, d: 2.6, kind: 'minecart' },
      { x: -5.4, z: -52.0, w: 2.0, d: 2.0, kind: 'boulder' },
      { x: 4.6, z: -66.0, w: 2.4, d: 1.3, kind: 'crates' },
      { x: -4.4, z: -76.0, w: 1.8, d: 1.8, kind: 'boulder' },
    ],
    zones: [
      { trigger: 33, pack: [['grunt', -3.8, 23], ['rifle', 3.4, 21], ['grunt', 0.6, 18], ['dynamiter', -2.2, 14]] },
      { trigger: 17, pack: [['rider', 2.2, 6], ['rifle', -5.4, 9], ['grunt', 1.0, 3], ['dynamiter', 4.2, 0.5], ['grunt', -2.6, -1]] },
      { trigger: 1, pack: [['dynamiter', -4.4, -12], ['rifle', 5.6, -13.5], ['rider', -0.8, -17], ['grunt', 2.6, -19], ['grunt', -3.0, -20.5]] },
      { trigger: -17, pack: [['grunt', -1.4, -28], ['rifle', -5.5, -31], ['dynamiter', 4.2, -29.5], ['rider', 3.6, -33.5], ['grunt', 1.0, -36]] },
      { trigger: -41, pack: [['rifle', -5.6, -48], ['dynamiter', -1.4, -50], ['grunt', 3.4, -50.5], ['rider', 0.4, -56], ['dynamiter', 4.6, -60], ['grunt', -3.6, -58.5]] },
      { trigger: -63, pack: [['rider', -5.2, -70], ['rifle', 0, -72], ['dynamiter', 3.2, -73.5], ['rider', 5.2, -78], ['grunt', -2.8, -79], ['rifle', 3.0, -82]] },
    ],
    crates: [
      { id: 9101, kind: 'posterCrate', x: 6.2, z: -45.5, hp: 90, radius: 0.72 },
      { id: 9102, kind: 'lootCrate', x: -2.75, z: -24.0, hp: 60, radius: 0.7 },
      { id: 9103, kind: 'lootCrate', x: 2.5, z: -66.0, hp: 70, radius: 0.7 },
      { id: 9111, kind: 'keg', x: -1.6, z: -13.8, hp: 24, radius: 0.5 },
      { id: 9112, kind: 'keg', x: 3.2, z: -31.0, hp: 24, radius: 0.5 },
      { id: 9113, kind: 'keg', x: -2.6, z: -54.0, hp: 24, radius: 0.5 },
      { id: 9114, kind: 'keg', x: 1.4, z: -75.5, hp: 24, radius: 0.5 },
    ],
    equipment: { trigger: 12, items: [['star', -5.7, -29.5], ['bandolier', 5.6, -57.5]] },
    boss: 'mae',
    adds: [['dynamiter', -5.8, -89.5], ['dynamiter', 5.8, -90.5]],
  },
];

/** Stage 1's layout, under the names the first version exported. */
export const WORLD = STAGES[0].world;
export const COLLIDERS = STAGES[0].colliders;

export const EQUIPMENT = {
  boots: { label: 'SPURRED BOOTS', detail: 'movement +12%' },
  silver: { label: 'SILVER ROUNDS', detail: 'damage +10%' },
  star: { label: 'TIN STAR', detail: '15% less damage taken' },
  bandolier: { label: 'BANDOLIER', detail: 'fire rate +10%' },
};

export function createGameState({ renown = 0, stage = 0, difficulty = 'gunslinger', carry = null } = {}) {
  const def = STAGES[clamp(stage | 0, 0, STAGES.length - 1)];
  const diffKey = DIFFICULTIES[difficulty] ? difficulty : 'gunslinger';
  const state = {
    stageIndex: STAGES.indexOf(def),
    stage: def,
    world: def.world,
    difficulty: diffKey,
    diff: DIFFICULTIES[diffKey],
    time: 0,
    status: 'briefing',
    objective: def.objective,
    stageProgress: 0,
    nextId: 1,
    player: {
      id: 0,
      kind: 'player',
      x: 0,
      z: def.world.startZ,
      vx: 0,
      vz: 0,
      radius: 0.54,
      hp: 100,
      maxHp: 100,
      speed: 5.9,
      fireCooldown: 0,
      fireRate: 0.17,
      bulletSpeed: 17.5,
      bulletRange: 31,
      damage: 12,
      projectileCount: 2,
      armor: 1,
      level: 1,
      xp: 0,
      xpNeed: 100,
      cash: 80,
      score: 0,
      kills: 0,
      invuln: 0,
      aimX: 0,
      aimZ: -1,
      equipment: { boots: false, silver: false, star: false, bandolier: false },
      upgrades: { quickdraw: 0, longbarrel: 0, duster: 0, twinEagle: 0, scatter: 0, tonic: 0 },
      renown,
    },
    enemies: [],
    bullets: [],
    bombs: [],
    pickups: [],
    destructibles: def.crates.map((c) => ({ ...c, maxHp: c.hp, alive: true })),
    posterFound: false,
    bossSpawned: false,
    bossDefeated: false,
    bossEnraged: false,
    gateDeniedNotified: false,
    zonesSpawned: new Set(),
    events: [],
    stats: { shots: 0, hits: 0, damageTaken: 0, startedAt: 0, completedAt: 0 },
    fixedPickupsSpawned: false,
  };
  if (carry) applyCarry(state.player, carry);
  return state;
}

const CARRIED = ['level', 'xp', 'xpNeed', 'damage', 'maxHp', 'speed', 'fireRate', 'bulletSpeed', 'bulletRange', 'projectileCount', 'armor', 'cash', 'score', 'kills'];

/** What a player takes into the next stage (and what a checkpoint saves). */
export function snapshotPlayer(p) {
  const out = { equipment: { ...p.equipment }, upgrades: { ...p.upgrades } };
  for (const k of CARRIED) out[k] = p[k];
  return out;
}

function applyCarry(p, carry) {
  for (const k of CARRIED) if (typeof carry[k] === 'number' && Number.isFinite(carry[k])) p[k] = carry[k];
  for (const k of Object.keys(p.equipment)) p.equipment[k] = !!carry.equipment?.[k];
  for (const k of Object.keys(p.upgrades)) p.upgrades[k] = Number(carry.upgrades?.[k]) || 0;
  p.hp = p.maxHp; // a new stage starts at full health
}

export function startMission(state) {
  state.status = 'playing';
  state.stats.startedAt = state.time;
  state.events.push({ type: 'missionStart' });
}

export function setAim(state, x, z) {
  const m = len(x, z);
  state.player.aimX = x / m;
  state.player.aimZ = z / m;
}

function circleHitsAabb(x, z, radius, c) {
  const qx = clamp(x, c.x - c.w / 2, c.x + c.w / 2);
  const qz = clamp(z, c.z - c.d / 2, c.z + c.d / 2);
  return (x - qx) ** 2 + (z - qz) ** 2 < radius ** 2;
}

function blocked(state, body, x, z) {
  const w = state.world;
  const r = body.radius;
  if (x - r < w.minX || x + r > w.maxX || z > w.startZ + 2 || z < w.endZ) return true;
  // Once the boss is out, the gate behind the player is shut.
  if (body === state.player && state.bossSpawned && z > w.bossGateZ + 0.2) return true;
  for (const c of state.stage.colliders) if (circleHitsAabb(x, z, r, c)) return true;
  return false;
}

function moveBody(state, body, dx, dz) {
  const nx = body.x + dx;
  if (!blocked(state, body, nx, body.z)) body.x = nx;
  const nz = body.z + dz;
  if (!blocked(state, body, body.x, nz)) body.z = nz;
}

function spawnEnemy(state, kind, x, z) {
  const cfg = ENEMY[kind];
  const hp = Math.round(cfg.hp * state.diff.enemyHp * (cfg.isBoss ? 1 : state.stage.hpScale || 1));
  const e = {
    id: state.nextId++, kind, x, z, radius: cfg.radius,
    hp, maxHp: hp, speed: cfg.speed, isBoss: !!cfg.isBoss,
    fireTimer: cfg.fire * (0.55 + Math.random() * 0.6),
    strafeSeed: Math.random() * Math.PI * 2,
    chargeTimer: kind === 'rider' ? 1.6 : 0,
    charging: 0, chargeX: 0, chargeZ: 0,
    sweepLeft: 0, sweepCount: 0, sweepTimer: 0, sweepBase: 0, sweepDir: 1, volleys: 0,
    phaseTimer: 0,
    dead: false,
  };
  state.enemies.push(e);
  state.events.push({ type: 'enemySpawn', entity: e });
  return e;
}

function spawnBullet(state, owner, x, z, dx, dz, speed, damage, range, sourceKind = null) {
  const m = len(dx, dz);
  const b = {
    id: state.nextId++, kind: owner === 'player' ? 'playerBullet' : 'enemyBullet',
    owner, x, z, dx: dx / m, dz: dz / m,
    speed, damage, ttl: range / speed, radius: owner === 'player' ? 0.13 : 0.16, sourceKind, dead: false,
  };
  state.bullets.push(b);
  return b;
}

function firePlayer(state) {
  const p = state.player;
  if (p.fireCooldown > 0 || state.status !== 'playing') return;
  p.fireCooldown = p.fireRate;
  const ax = p.aimX, az = p.aimZ;
  const sideX = -az, sideZ = ax;
  const spread = p.projectileCount === 3 ? SPREAD3 : SPREAD2;
  for (const s of spread) {
    const dx = ax + sideX * s * 0.12;
    const dz = az + sideZ * s * 0.12;
    spawnBullet(state, 'player', p.x + sideX * s, p.z + sideZ * s, dx, dz, p.bulletSpeed, p.damage, p.bulletRange);
  }
  state.stats.shots += spread.length;
  state.events.push({ type: 'playerShot', x: p.x, z: p.z, ax, az });
}

function fireEnemy(state, e) {
  const cfg = ENEMY[e.kind];
  const p = state.player;
  const base = Math.atan2(p.x - e.x, p.z - e.z);
  const angles = e.kind === 'boss' ? VEX_ANGLES : ONE_ANGLE;
  for (const a of angles) spawnBullet(state, 'enemy', e.x, e.z, Math.sin(base + a), Math.cos(base + a), cfg.bulletSpeed, cfg.damage, 34, e.kind);
  state.events.push({ type: e.isBoss ? 'bossShot' : 'enemyShot', x: e.x, z: e.z, id: e.id });
}

/** A stick of dynamite from (x, z) that lands at (tx, tz) after `flight` seconds. */
function throwDynamite(state, x, z, tx, tz, damage, flight, radius, owner) {
  const w = state.world;
  const b = {
    id: state.nextId++, kind: 'dynamite', x0: x, z0: z,
    tx: clamp(tx, w.minX + 0.3, w.maxX - 0.3), tz: clamp(tz, w.endZ + 0.5, w.startZ),
    x, z, t: 0, dur: flight, radius, damage, owner, dead: false,
  };
  state.bombs.push(b);
  state.events.push({ type: 'dynamiteThrow', x, z });
  return b;
}

function damagePlayer(state, amount) {
  const p = state.player;
  if (p.invuln > 0 || state.status !== 'playing') return false;
  const dmg = Math.max(1, Math.round(amount * state.diff.enemyDamage * p.armor));
  p.hp -= dmg;
  p.invuln = 0.42;
  state.stats.damageTaken += dmg;
  state.events.push({ type: 'playerHit', amount: dmg });
  if (p.hp <= 0) {
    p.hp = 0;
    state.status = 'defeat';
    state.objective = 'The trail went cold';
    state.stats.completedAt = state.time;
    state.events.push({ type: 'defeat' });
  }
  return true;
}

function damageEnemy(state, e, amount, x, z) {
  if (e.dead) return;
  e.hp -= amount;
  state.events.push({ type: 'hit', x, z, id: e.id, boss: e.isBoss });
  if (e.hp <= 0) defeatEnemy(state, e);
}

function damageDestructible(state, d, amount, x, z) {
  if (!d.alive) return;
  d.hp -= amount;
  state.events.push({ type: 'woodHit', x, z, id: d.id });
  if (d.hp > 0) return;
  d.alive = false;
  state.events.push({ type: 'crateBreak', entity: d, x: d.x, z: d.z });
  if (d.kind === 'posterCrate') state.pickups.push({ id: state.nextId++, kind: 'poster', x: d.x, z: d.z, radius: 0.52 });
  else if (d.kind === 'keg') explode(state, d.x, d.z, KEG.blast, KEG.playerDamage, KEG.enemyDamage, 'keg');
  else state.pickups.push({ id: state.nextId++, kind: Math.random() < 0.5 ? 'medkit' : 'coin', x: d.x, z: d.z, radius: 0.45 });
}

/** A blast hurts the player, outlaws and crates in range; kegs set each other off. */
function explode(state, x, z, radius, playerDamage, enemyDamage, source) {
  state.events.push({ type: 'explosion', x, z, radius, source });
  const p = state.player;
  const pr = radius + p.radius * 0.4;
  if ((p.x - x) ** 2 + (p.z - z) ** 2 <= pr * pr) damagePlayer(state, playerDamage);
  for (const e of state.enemies) {
    if (e.dead) continue;
    const er = radius + e.radius * 0.5;
    if ((e.x - x) ** 2 + (e.z - z) ** 2 <= er * er) damageEnemy(state, e, enemyDamage, e.x, e.z);
  }
  for (const d of state.destructibles) {
    if (!d.alive) continue;
    const dr = radius + d.radius;
    if ((d.x - x) ** 2 + (d.z - z) ** 2 <= dr * dr) damageDestructible(state, d, 40, d.x, d.z);
  }
}

function gainXP(state, amount) {
  const p = state.player;
  p.xp += amount;
  while (p.xp >= p.xpNeed && p.level < 8) {
    p.xp -= p.xpNeed;
    p.level += 1;
    p.xpNeed = Math.round(p.xpNeed * 1.42 + 20);
    p.damage *= 1.07;
    p.maxHp += 5;
    p.hp = Math.min(p.maxHp, p.hp + 16);
    state.events.push({ type: 'levelUp', level: p.level });
  }
  // At the level cap the bar stays full instead of counting past its end.
  if (p.level >= 8) p.xp = Math.min(p.xp, p.xpNeed);
}

function defeatEnemy(state, e) {
  if (e.dead) return;
  e.dead = true;
  e.deadAt = state.time;
  const cfg = ENEMY[e.kind];
  const p = state.player;
  p.kills++;
  p.cash += Math.round(cfg.cash * state.diff.cash);
  p.score += Math.round((cfg.cash * 10 + cfg.xp * 8) * state.diff.score);
  gainXP(state, cfg.xp);
  state.events.push({ type: e.isBoss ? 'bossDown' : 'enemyDown', entity: e, x: e.x, z: e.z, kind: e.kind });

  if (e.isBoss) {
    state.bossDefeated = true;
    state.status = 'victory';
    state.objective = state.stage.clearTitle;
    state.stats.completedAt = state.time;
    return;
  }

  const r = Math.random();
  if (r < 0.11) state.pickups.push({ id: state.nextId++, kind: 'medkit', x: e.x, z: e.z, radius: 0.45 });
  else if (r < 0.24) state.pickups.push({ id: state.nextId++, kind: 'coin', x: e.x, z: e.z, radius: 0.42 });
}

function moveToward(state, e, tx, tz, dt) {
  const mdx = tx - e.x, mdz = tz - e.z;
  const ml = Math.hypot(mdx, mdz);
  if (ml < 0.05) return;
  const step = Math.min(ml, e.speed * dt);
  moveBody(state, e, (mdx / ml) * step, (mdz / ml) * step);
}

function updateVex(state, e, cfg, d, dt) {
  const w = state.world;
  moveToward(state, e, Math.sin(state.time * 0.78) * 5.6, w.bossZ + Math.cos(state.time * 0.55) * 2.4, dt);
  if (e.fireTimer <= 0 && d < 31) {
    fireEnemy(state, e);
    e.fireTimer = cfg.fire * (state.bossEnraged ? 0.72 : 1) * state.diff.enemyFire;
  }
}

function updateMae(state, e, cfg, d, dt) {
  const w = state.world;
  const p = state.player;
  moveToward(state, e, Math.sin(state.time * 0.62) * 5.0, w.bossZ + Math.cos(state.time * 0.47) * 1.6, dt);
  if (e.sweepLeft > 0) {
    // The gatling walks across an arc, one round at a time.
    e.sweepTimer -= dt;
    while (e.sweepTimer <= 0 && e.sweepLeft > 0) {
      const k = e.sweepCount - e.sweepLeft;
      const f = e.sweepCount > 1 ? k / (e.sweepCount - 1) : 0.5;
      const a = e.sweepBase + e.sweepDir * cfg.arc * (f - 0.5);
      spawnBullet(state, 'enemy', e.x, e.z + 0.6, Math.sin(a), Math.cos(a), cfg.bulletSpeed, cfg.damage, 36, e.kind);
      if (k % 3 === 0) state.events.push({ type: 'bossShot', x: e.x, z: e.z, id: e.id, gatling: true });
      e.sweepLeft--;
      e.sweepTimer += cfg.sweepGap;
    }
  } else if (e.fireTimer <= 0 && d < 32) {
    e.sweepCount = state.bossEnraged ? cfg.sweepEnraged : cfg.sweep;
    e.sweepLeft = e.sweepCount;
    e.sweepDir = -e.sweepDir;
    e.sweepBase = Math.atan2(p.x - e.x, p.z - e.z);
    e.sweepTimer = 0.32; // a short spin-up the player can hear
    e.volleys++;
    state.events.push({ type: 'bossWindup', x: e.x, z: e.z, id: e.id });
    const sweepTime = 0.32 + e.sweepCount * cfg.sweepGap;
    e.fireTimer = sweepTime + cfg.fire * (state.bossEnraged ? 0.8 : 1) * state.diff.enemyFire;
    if (state.bossEnraged && e.volleys % 2 === 0) {
      const dyn = ENEMY.dynamiter;
      throwDynamite(state, e.x, e.z, p.x, p.z, dyn.damage, 1.25, dyn.blast, e.id);
      throwDynamite(state, e.x, e.z, p.x + (Math.random() < 0.5 ? -2.6 : 2.6), p.z + 1.2, dyn.damage, 1.4, dyn.blast, e.id);
    }
  }
}

function updateEnemies(state, dt) {
  const p = state.player;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const cfg = ENEMY[e.kind];
    e.fireTimer -= dt;
    e.phaseTimer += dt;
    const dx = p.x - e.x, dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;

    if (e.isBoss) {
      if (e.kind === 'mae') updateMae(state, e, cfg, d, dt);
      else updateVex(state, e, cfg, d, dt);
      if (!state.bossEnraged && e.hp < e.maxHp * 0.5) {
        state.bossEnraged = true;
        state.events.push({ type: 'bossEnrage' });
        for (const [kind, x, z] of state.stage.adds) spawnEnemy(state, kind, x, z);
      }
      continue;
    }

    const preferred = cfg.preferred;
    let mx = 0, mz = 0, pace = 1;
    if (d > preferred + 1.2) { mx += dx / d; mz += dz / d; }
    if (d < preferred - 1.6) { mx -= (dx / d) * 0.55; mz -= (dz / d) * 0.55; }
    if (e.kind === 'rifle' || e.kind === 'dynamiter') {
      const s = Math.sin(state.time * (e.kind === 'rifle' ? 1.7 : 1.1) + e.strafeSeed);
      mx += (-dz / d) * s * 0.72;
      mz += (dx / d) * s * 0.72;
    }
    if (e.kind === 'rider') {
      // A real charge: a short gallop at the player's position (it used to be normalised away).
      if (e.charging > 0) {
        e.charging -= dt;
        mx = e.chargeX; mz = e.chargeZ; pace = 2.0;
      } else if (e.chargeTimer <= 0 && d > 4) {
        e.charging = 0.6;
        e.chargeX = dx / d; e.chargeZ = dz / d;
        mx = e.chargeX; mz = e.chargeZ; pace = 2.0;
        e.chargeTimer = 3.4;
        state.events.push({ type: 'riderCharge', x: e.x, z: e.z, id: e.id });
      }
      e.chargeTimer -= dt;
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 0.001) moveBody(state, e, (mx / ml) * e.speed * pace * dt, (mz / ml) * e.speed * pace * dt);

    if (e.kind === 'dynamiter') {
      if (e.fireTimer <= 0 && d < 15) {
        // Aim where the player will be when it lands, a little short of perfect.
        const lead = cfg.flight * 0.55;
        throwDynamite(state, e.x, e.z, p.x + p.vx * lead, p.z + p.vz * lead, cfg.damage, cfg.flight, cfg.blast, e.id);
        e.fireTimer = cfg.fire * (0.86 + Math.random() * 0.36) * state.diff.enemyFire;
      }
    } else if (e.fireTimer <= 0 && d < 24) {
      fireEnemy(state, e);
      e.fireTimer = cfg.fire * (0.86 + Math.random() * 0.36) * state.diff.enemyFire;
    }
  }
}

/** Keep outlaws from standing inside each other. */
function separateEnemies(state) {
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.isBoss) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.isBoss) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const rr = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) * 0.25;
      moveBody(state, a, (-dx / d) * push, (-dz / d) * push);
      moveBody(state, b, (dx / d) * push, (dz / d) * push);
    }
  }
}

function updateBullets(state, dt) {
  const p = state.player;
  const w = state.world;
  for (const b of state.bullets) {
    if (b.dead) continue;
    b.x += b.dx * b.speed * dt;
    b.z += b.dz * b.speed * dt;
    b.ttl -= dt;
    if (b.ttl <= 0 || b.x < -14 || b.x > 14 || b.z < w.endZ - 8 || b.z > w.startZ + 8) { b.dead = true; continue; }

    if (b.owner === 'player') {
      let hit = false;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const rr = b.radius + e.radius;
        if ((b.x - e.x) ** 2 + (b.z - e.z) ** 2 <= rr * rr) {
          b.dead = true;
          state.stats.hits++;
          damageEnemy(state, e, b.damage, b.x, b.z);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const d of state.destructibles) {
        if (!d.alive) continue;
        const rr = b.radius + d.radius;
        if ((b.x - d.x) ** 2 + (b.z - d.z) ** 2 <= rr * rr) {
          b.dead = true;
          damageDestructible(state, d, b.damage, b.x, b.z);
          break;
        }
      }
    } else if (p.invuln <= 0) {
      const rr = b.radius + p.radius;
      if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 <= rr * rr) {
        b.dead = true;
        damagePlayer(state, b.damage);
      }
    }
  }
  compact(state.bullets);
}

function updateBombs(state, dt) {
  for (const b of state.bombs) {
    if (b.dead) continue;
    b.t += dt;
    const f = Math.min(1, b.t / b.dur);
    b.x = b.x0 + (b.tx - b.x0) * f;
    b.z = b.z0 + (b.tz - b.z0) * f;
    if (b.t >= b.dur) {
      b.dead = true;
      explode(state, b.tx, b.tz, b.radius, b.damage, 25, 'dynamite');
    }
  }
  compact(state.bombs);
}

function updatePickups(state) {
  const p = state.player;
  for (const q of state.pickups) {
    if (q.dead) continue;
    const rr = p.radius + q.radius + 0.18;
    if (dist2(p, q) > rr * rr) continue;
    q.dead = true;
    if (q.kind === 'poster') {
      state.posterFound = true;
      state.objective = state.stage.gateObjective;
      p.score += Math.round(800 * state.diff.score);
      state.events.push({ type: 'posterFound', x: q.x, z: q.z });
    } else if (q.kind === 'medkit') {
      p.hp = Math.min(p.maxHp, p.hp + 28);
      state.events.push({ type: 'pickup', kind: q.kind, x: q.x, z: q.z });
    } else if (q.kind === 'coin') {
      p.cash += 70;
      p.score += Math.round(250 * state.diff.score);
      state.events.push({ type: 'pickup', kind: q.kind, x: q.x, z: q.z });
    } else if (EQUIPMENT[q.kind]) {
      if (!p.equipment[q.kind]) {
        if (q.kind === 'boots') p.speed *= 1.12;
        else if (q.kind === 'silver') p.damage *= 1.1;
        else if (q.kind === 'star') p.armor *= 0.85;
        else if (q.kind === 'bandolier') p.fireRate *= 0.9;
      }
      p.equipment[q.kind] = true;
      state.events.push({ type: 'equipment', kind: q.kind, x: q.x, z: q.z });
    }
  }
  compact(state.pickups);
}

function updateSpawns(state) {
  const p = state.player;
  const def = state.stage;
  const w = state.world;
  if (!state.fixedPickupsSpawned && p.z < def.equipment.trigger) {
    state.fixedPickupsSpawned = true;
    for (const [kind, x, z] of def.equipment.items) {
      // Equipment carried over from the last stage is not offered twice.
      if (!p.equipment[kind]) state.pickups.push({ id: state.nextId++, kind, x, z, radius: 0.46 });
    }
  }

  for (let i = 0; i < def.zones.length; i++) {
    const zone = def.zones[i];
    if (p.z < zone.trigger && !state.zonesSpawned.has(i)) {
      state.zonesSpawned.add(i);
      for (const [kind, x, z] of zone.pack) spawnEnemy(state, kind, x, z);
    }
  }

  if (p.z < w.bossGateZ && !state.bossSpawned) {
    if (!state.posterFound) {
      p.z = w.bossGateZ + 0.6;
      state.objective = 'A WANTED poster is required — search the trail';
      if (!state.gateDeniedNotified) { state.gateDeniedNotified = true; state.events.push({ type: 'gateDenied' }); }
    } else {
      state.bossSpawned = true;
      state.objective = def.bossObjective;
      spawnEnemy(state, def.boss, w.bossSpawn.x, w.bossSpawn.z);
      state.events.push({ type: 'bossIntro' });
    }
  }
  // Walking away from the gate after a denial lets the reminder show again next time.
  if (!state.posterFound && state.gateDeniedNotified && p.z > w.bossGateZ + 6) {
    state.gateDeniedNotified = false;
    state.objective = def.objective;
  }
}

/** Drop dead entries in place (no new array every step). */
function compact(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].dead) list[n++] = list[i];
  list.length = n;
}

export function updateGame(state, input, dt) {
  state.events.length = 0;
  state.time += dt;
  if (state.status !== 'playing') return;
  const p = state.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);

  let mx = input.moveX || 0;
  let mz = input.moveZ || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const px = p.x, pz = p.z;
  moveBody(state, p, mx * p.speed * dt, mz * p.speed * dt);
  p.vx = (p.x - px) / dt;
  p.vz = (p.z - pz) / dt;

  if (input.aimMagnitude > 0.15) setAim(state, input.aimX, input.aimZ);
  if (input.fire) firePlayer(state);

  updateSpawns(state);
  updateEnemies(state, dt);
  separateEnemies(state);
  updateBullets(state, dt);
  updateBombs(state, dt);
  updatePickups(state);

  let n = 0;
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e.dead || state.time - e.deadAt < 0.1) list[n++] = e;
  }
  list.length = n;
  state.stageProgress = clamp((state.world.startZ - p.z) / (state.world.startZ - state.world.endZ), 0, 1);
}

export function canUseShop(state) {
  if (state.status !== 'playing' || state.bossSpawned) return false;
  const dx = state.player.x - state.world.shop.x;
  const dz = state.player.z - state.world.shop.z;
  return dx * dx + dz * dz < 3.1 * 3.1;
}

export const UPGRADE_DEFS = {
  quickdraw: { label: 'Quick Hammer', cost: 220, detail: '18% faster fire rate' },
  longbarrel: { label: 'Long Barrel', cost: 210, detail: '25% more bullet speed and range' },
  duster: { label: 'Reinforced Duster', cost: 250, detail: '+30 max health and heal 30' },
  twinEagle: { label: 'Twin Eagle Tune', cost: 290, detail: '25% more bullet damage' },
  scatter: { label: 'Scattergun Load', cost: 320, detail: 'Three rounds per volley instead of two', minStage: 1 },
  tonic: { label: 'Snake-Oil Tonic', cost: 90, detail: 'Heal 45 health. Buy it as often as you need', minStage: 1, consumable: true },
};

/** The upgrades this stage's shop sells, as [key, def] pairs. */
export function shopItems(state) {
  return Object.entries(UPGRADE_DEFS).filter(([, def]) => (def.minStage || 0) <= state.stageIndex);
}

/** 'ok', 'owned', 'full' (tonic at full health), 'cash' or 'unavailable'. */
export function upgradeStatus(state, key) {
  const p = state.player;
  const def = UPGRADE_DEFS[key];
  if (!def || (def.minStage || 0) > state.stageIndex) return 'unavailable';
  if (!def.consumable && p.upgrades[key] >= 1) return 'owned';
  if (def.consumable && p.hp >= p.maxHp) return 'full';
  if (p.cash < def.cost) return 'cash';
  return 'ok';
}

export function buyUpgrade(state, key) {
  if (upgradeStatus(state, key) !== 'ok') return false;
  const p = state.player;
  const def = UPGRADE_DEFS[key];
  p.cash -= def.cost;
  p.upgrades[key] = (p.upgrades[key] || 0) + 1;
  if (key === 'quickdraw') p.fireRate *= 0.82;
  if (key === 'longbarrel') { p.bulletSpeed *= 1.25; p.bulletRange *= 1.25; }
  if (key === 'duster') { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); }
  if (key === 'twinEagle') p.damage *= 1.25;
  if (key === 'scatter') p.projectileCount = 3;
  if (key === 'tonic') p.hp = Math.min(p.maxHp, p.hp + 45);
  state.events.push({ type: 'upgrade', key });
  return true;
}

export function getBoss(state) {
  for (const e of state.enemies) if (e.isBoss && !e.dead) return e;
  return null;
}

export function getMissionSummary(state) {
  const duration = Math.max(1, (state.stats.completedAt || state.time) - state.stats.startedAt);
  const accuracy = state.stats.shots ? Math.round((state.stats.hits / state.stats.shots) * 100) : 0;
  return {
    stage: state.stage.id,
    stageName: state.stage.name,
    difficulty: state.difficulty,
    time: duration,
    kills: state.player.kills,
    score: state.player.score,
    cash: state.player.cash,
    level: state.player.level,
    accuracy,
    damageTaken: state.stats.damageTaken,
  };
}
