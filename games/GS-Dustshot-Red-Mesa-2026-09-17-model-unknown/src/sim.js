export const WORLD = {
  minX: -7.0,
  maxX: 7.0,
  startZ: 38,
  bossGateZ: -86,
  endZ: -104,
  shop: { x: 6.1, z: -38.5 },
  posterCrate: { x: -5.6, z: -12.2 },
};

export const COLLIDERS = [
  { x: -5.2, z: 22.5, w: 2.8, d: 1.35, kind: 'trough' },
  { x: 5.4, z: 11.5, w: 1.35, d: 3.6, kind: 'fence' },
  { x: -7.25, z: 2.2, w: 1.15, d: 3.8, kind: 'fence' },
  { x: 5.0, z: -20.0, w: 2.7, d: 1.25, kind: 'crates' },
  { x: -4.7, z: -32.0, w: 2.3, d: 1.25, kind: 'barrels' },
  { x: 4.5, z: -55.5, w: 2.8, d: 1.2, kind: 'crates' },
  { x: -5.2, z: -69.0, w: 1.3, d: 3.4, kind: 'fence' },
];

const ZONES = [
  { trigger: 33, pack: [['grunt', -4.5, 24], ['grunt', 0, 21], ['grunt', 4.4, 18], ['grunt', -2.2, 15]] },
  { trigger: 18, pack: [['rifle', -5.5, 8], ['grunt', 1.5, 7], ['rifle', 5.7, 4], ['grunt', -1.2, 1], ['grunt', 4.0, -2]] },
  { trigger: 2, pack: [['rider', 5.0, -9], ['grunt', -1.5, -9], ['rifle', -5.5, -12], ['grunt', 2.8, -16]] },
  { trigger: -18, pack: [['grunt', -5.5, -27], ['rifle', -2.0, -31], ['grunt', 3.2, -29], ['rider', 5.3, -34], ['grunt', 0.7, -37]] },
  { trigger: -42, pack: [['rifle', -5.5, -50], ['grunt', -1.5, -52], ['rifle', 4.7, -54], ['rider', 0.5, -58], ['grunt', -4.2, -61], ['grunt', 4.8, -64]] },
  { trigger: -64, pack: [['rider', -5.4, -72], ['rifle', 0, -73], ['rider', 5.3, -76], ['grunt', -3.0, -78], ['rifle', 3.2, -81]] },
];

const ENEMY = {
  grunt: { hp: 34, speed: 2.35, fire: 1.55, damage: 8, bulletSpeed: 8.5, xp: 22, cash: 28, radius: 0.48 },
  rifle: { hp: 48, speed: 1.75, fire: 1.22, damage: 10, bulletSpeed: 10.4, xp: 32, cash: 38, radius: 0.5 },
  rider: { hp: 76, speed: 3.2, fire: 1.9, damage: 12, bulletSpeed: 9.0, xp: 46, cash: 52, radius: 0.68 },
  boss: { hp: 1120, speed: 2.0, fire: 0.82, damage: 10, bulletSpeed: 10.8, xp: 220, cash: 300, radius: 0.82 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const len = (x, z) => Math.hypot(x, z) || 1;

export function createGameState({ renown = 0 } = {}) {
  return {
    time: 0,
    status: 'briefing',
    objective: 'Find the hidden WANTED poster',
    stageProgress: 0,
    nextId: 1,
    player: {
      id: 0,
      kind: 'player',
      x: 0,
      z: WORLD.startZ,
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
      level: 1,
      xp: 0,
      xpNeed: 100,
      cash: 80,
      score: 0,
      kills: 0,
      invuln: 0,
      aimX: 0,
      aimZ: -1,
      equipment: { boots: false, silver: false },
      upgrades: { quickdraw: 0, longbarrel: 0, duster: 0, twinEagle: 0 },
      renown,
    },
    enemies: [],
    bullets: [],
    pickups: [],
    destructibles: [
      { id: 9001, kind: 'posterCrate', x: WORLD.posterCrate.x, z: WORLD.posterCrate.z, hp: 80, radius: 0.72, alive: true },
      { id: 9002, kind: 'lootCrate', x: 5.0, z: -20.0, hp: 60, radius: 0.7, alive: true },
      { id: 9003, kind: 'lootCrate', x: 4.5, z: -55.5, hp: 70, radius: 0.7, alive: true },
    ],
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
  const minX = c.x - c.w / 2;
  const maxX = c.x + c.w / 2;
  const minZ = c.z - c.d / 2;
  const maxZ = c.z + c.d / 2;
  const qx = clamp(x, minX, maxX);
  const qz = clamp(z, minZ, maxZ);
  return (x - qx) ** 2 + (z - qz) ** 2 < radius ** 2;
}

function blocked(x, z, radius) {
  if (x - radius < WORLD.minX || x + radius > WORLD.maxX || z > WORLD.startZ + 2 || z < WORLD.endZ) return true;
  for (const c of COLLIDERS) if (circleHitsAabb(x, z, radius, c)) return true;
  return false;
}

function moveBody(body, dx, dz) {
  const nx = body.x + dx;
  if (!blocked(nx, body.z, body.radius)) body.x = nx;
  const nz = body.z + dz;
  if (!blocked(body.x, nz, body.radius)) body.z = nz;
}

function spawnEnemy(state, kind, x, z) {
  const cfg = ENEMY[kind];
  const e = {
    id: state.nextId++, kind, x, z, radius: cfg.radius,
    hp: cfg.hp, maxHp: cfg.hp, speed: cfg.speed,
    fireTimer: cfg.fire * (0.55 + Math.random() * 0.6),
    strafeSeed: Math.random() * Math.PI * 2,
    chargeTimer: kind === 'rider' ? 1.6 : 0,
    phaseTimer: 0,
    dead: false,
  };
  state.enemies.push(e);
  state.events.push({ type: 'enemySpawn', entity: e });
  return e;
}

function spawnBullet(state, owner, x, z, dx, dz, speed, damage, range, extra = {}) {
  const m = len(dx, dz);
  const b = {
    id: state.nextId++, kind: owner === 'player' ? 'playerBullet' : 'enemyBullet',
    owner, x, z, dx: dx / m, dz: dz / m,
    speed, damage, ttl: range / speed, radius: owner === 'player' ? 0.13 : 0.16,
    ...extra,
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
  const spread = p.projectileCount === 3 ? [-0.34, 0, 0.34] : [-0.2, 0.2];
  for (const s of spread) {
    const dx = ax + sideX * s * 0.12;
    const dz = az + sideZ * s * 0.12;
    spawnBullet(state, 'player', p.x + sideX * s, p.z + sideZ * s, dx, dz, p.bulletSpeed, p.damage, p.bulletRange);
  }
  p.stats = p.stats || {};
  state.stats.shots += spread.length;
  state.events.push({ type: 'playerShot', x: p.x, z: p.z });
}

function fireEnemy(state, e) {
  const cfg = ENEMY[e.kind];
  const p = state.player;
  const dx = p.x - e.x, dz = p.z - e.z;
  const base = Math.atan2(dx, dz);
  const angles = e.kind === 'boss' ? [-0.18, 0, 0.18] : [0];
  for (const a of angles) {
    const s = Math.sin(base + a), c = Math.cos(base + a);
    spawnBullet(state, 'enemy', e.x, e.z, s, c, cfg.bulletSpeed, cfg.damage, 34, { sourceKind: e.kind });
  }
  state.events.push({ type: e.kind === 'boss' ? 'bossShot' : 'enemyShot', x: e.x, z: e.z });
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
}

function defeatEnemy(state, e) {
  if (e.dead) return;
  e.dead = true;
  e.deadAt = state.time;
  const cfg = ENEMY[e.kind];
  const p = state.player;
  p.kills++;
  p.cash += cfg.cash;
  p.score += Math.round(cfg.cash * 10 + cfg.xp * 8);
  gainXP(state, cfg.xp);
  state.events.push({ type: e.kind === 'boss' ? 'bossDown' : 'enemyDown', entity: e });

  if (e.kind === 'boss') {
    state.bossDefeated = true;
    state.status = 'victory';
    state.objective = 'Cinder Creek is clear';
    state.stats.completedAt = state.time;
    return;
  }

  const r = Math.random();
  if (r < 0.11) state.pickups.push({ id: state.nextId++, kind: 'medkit', x: e.x, z: e.z, radius: 0.45 });
  else if (r < 0.24) state.pickups.push({ id: state.nextId++, kind: 'coin', x: e.x, z: e.z, radius: 0.42 });
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

    if (e.kind === 'boss') {
      const targetZ = -91.5;
      const sway = Math.sin(state.time * 0.78) * 5.6;
      const tx = sway;
      const tz = targetZ + Math.cos(state.time * 0.55) * 2.4;
      const mdx = tx - e.x, mdz = tz - e.z;
      const ml = Math.hypot(mdx, mdz) || 1;
      moveBody(e, mdx / ml * e.speed * dt, mdz / ml * e.speed * dt);
      if (e.fireTimer <= 0 && d < 31) {
        fireEnemy(state, e);
        e.fireTimer = cfg.fire * (state.bossEnraged ? 0.72 : 1);
      }
      if (!state.bossEnraged && e.hp < e.maxHp * 0.5) {
        state.bossEnraged = true;
        state.events.push({ type: 'bossEnrage' });
        spawnEnemy(state, 'grunt', -6.2, -82);
        spawnEnemy(state, 'rifle', 6.0, -84);
      }
      continue;
    }

    const preferred = e.kind === 'rifle' ? 9.5 : e.kind === 'rider' ? 5.0 : 6.6;
    let mx = 0, mz = 0;
    if (d > preferred + 1.2) { mx += dx / d; mz += dz / d; }
    if (d < preferred - 1.6) { mx -= dx / d * 0.55; mz -= dz / d * 0.55; }
    if (e.kind === 'rifle') {
      const s = Math.sin(state.time * 1.7 + e.strafeSeed);
      mx += (-dz / d) * s * 0.72;
      mz += (dx / d) * s * 0.72;
    }
    if (e.kind === 'rider' && e.chargeTimer <= 0 && d > 4) {
      mx = dx / d * 1.55; mz = dz / d * 1.55;
      e.chargeTimer = 3.4;
    }
    e.chargeTimer -= dt;
    const ml = Math.hypot(mx, mz) || 1;
    moveBody(e, mx / ml * e.speed * dt, mz / ml * e.speed * dt);

    if (e.fireTimer <= 0 && d < 24) {
      fireEnemy(state, e);
      e.fireTimer = cfg.fire * (0.86 + Math.random() * 0.36);
    }
  }
}

function updateBullets(state, dt) {
  const p = state.player;
  for (const b of state.bullets) {
    if (b.dead) continue;
    b.x += b.dx * b.speed * dt;
    b.z += b.dz * b.speed * dt;
    b.ttl -= dt;
    if (b.ttl <= 0 || b.x < -14 || b.x > 14 || b.z < WORLD.endZ - 8 || b.z > WORLD.startZ + 8) { b.dead = true; continue; }

    if (b.owner === 'player') {
      let hit = false;
      for (const e of state.enemies) {
        if (e.dead) continue;
        const rr = b.radius + e.radius;
        if ((b.x - e.x) ** 2 + (b.z - e.z) ** 2 <= rr * rr) {
          e.hp -= b.damage;
          b.dead = true;
          state.stats.hits++;
          state.events.push({ type: 'hit', x: b.x, z: b.z, boss: e.kind === 'boss' });
          if (e.hp <= 0) defeatEnemy(state, e);
          hit = true;
          break;
        }
      }
      if (hit) continue;
      for (const d of state.destructibles) {
        if (!d.alive) continue;
        const rr = b.radius + d.radius;
        if ((b.x - d.x) ** 2 + (b.z - d.z) ** 2 <= rr * rr) {
          d.hp -= b.damage;
          b.dead = true;
          state.events.push({ type: 'woodHit', x: b.x, z: b.z });
          if (d.hp <= 0) {
            d.alive = false;
            state.events.push({ type: 'crateBreak', entity: d });
            if (d.kind === 'posterCrate') state.pickups.push({ id: state.nextId++, kind: 'poster', x: d.x, z: d.z, radius: 0.52 });
            else state.pickups.push({ id: state.nextId++, kind: Math.random() < 0.5 ? 'medkit' : 'coin', x: d.x, z: d.z, radius: 0.45 });
          }
          break;
        }
      }
    } else if (p.invuln <= 0) {
      const rr = b.radius + p.radius;
      if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 <= rr * rr) {
        b.dead = true;
        p.hp -= b.damage;
        p.invuln = 0.42;
        state.stats.damageTaken += b.damage;
        state.events.push({ type: 'playerHit', amount: b.damage });
        if (p.hp <= 0) {
          p.hp = 0;
          state.status = 'defeat';
          state.objective = 'The trail went cold';
          state.events.push({ type: 'defeat' });
        }
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);
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
      state.objective = 'Ride north to the old stockade';
      p.score += 800;
      state.events.push({ type: 'posterFound' });
    } else if (q.kind === 'medkit') {
      p.hp = Math.min(p.maxHp, p.hp + 28);
      state.events.push({ type: 'pickup', kind: q.kind });
    } else if (q.kind === 'coin') {
      p.cash += 70;
      p.score += 250;
      state.events.push({ type: 'pickup', kind: q.kind });
    } else if (q.kind === 'boots') {
      if (!p.equipment.boots) p.speed *= 1.12;
      p.equipment.boots = true;
      state.events.push({ type: 'equipment', kind: q.kind });
    } else if (q.kind === 'silver') {
      if (!p.equipment.silver) p.damage *= 1.1;
      p.equipment.silver = true;
      state.events.push({ type: 'equipment', kind: q.kind });
    }
  }
  state.pickups = state.pickups.filter(q => !q.dead);
}

function updateSpawns(state) {
  if (!state.fixedPickupsSpawned && state.player.z < 8) {
    state.fixedPickupsSpawned = true;
    state.pickups.push({ id: state.nextId++, kind: 'boots', x: 4.6, z: -24.5, radius: 0.46 });
    state.pickups.push({ id: state.nextId++, kind: 'silver', x: -4.9, z: -48.5, radius: 0.46 });
  }

  ZONES.forEach((zone, i) => {
    if (state.player.z < zone.trigger && !state.zonesSpawned.has(i)) {
      state.zonesSpawned.add(i);
      for (const [kind, x, z] of zone.pack) spawnEnemy(state, kind, x, z);
    }
  });

  if (state.player.z < WORLD.bossGateZ) {
    if (!state.posterFound) {
      state.player.z = WORLD.bossGateZ + 0.6;
      state.objective = 'A WANTED poster is required — search the town';
      if (!state.gateDeniedNotified) { state.gateDeniedNotified = true; state.events.push({ type: 'gateDenied' }); }
    } else if (!state.bossSpawned) {
      state.bossSpawned = true;
      state.objective = 'Defeat Marshal Vex';
      spawnEnemy(state, 'boss', 0, -96);
      state.events.push({ type: 'bossIntro' });
    }
  }
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
  moveBody(p, mx * p.speed * dt, mz * p.speed * dt);

  if (input.aimMagnitude > 0.15) setAim(state, input.aimX, input.aimZ);
  if (input.fire) firePlayer(state);

  updateSpawns(state);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updatePickups(state);

  state.enemies = state.enemies.filter(e => !e.dead || state.time - (e.deadAt || state.time) < 0.1);
  state.stageProgress = clamp((WORLD.startZ - p.z) / (WORLD.startZ - WORLD.endZ), 0, 1);
}

export function canUseShop(state) {
  if (state.status !== 'playing' || state.bossSpawned) return false;
  const dx = state.player.x - WORLD.shop.x;
  const dz = state.player.z - WORLD.shop.z;
  return dx * dx + dz * dz < 3.1 * 3.1;
}

export const UPGRADE_DEFS = {
  quickdraw: { label: 'Quick Hammer', cost: 220, detail: '18% faster fire rate' },
  longbarrel: { label: 'Long Barrel', cost: 210, detail: '25% more bullet speed and range' },
  duster: { label: 'Reinforced Duster', cost: 250, detail: '+30 max health and heal 30' },
  twinEagle: { label: 'Twin Eagle Tune', cost: 290, detail: '25% more bullet damage' },
};

export function buyUpgrade(state, key) {
  const p = state.player;
  const def = UPGRADE_DEFS[key];
  if (!def || p.upgrades[key] >= 1 || p.cash < def.cost) return false;
  p.cash -= def.cost;
  p.upgrades[key] = 1;
  if (key === 'quickdraw') p.fireRate *= 0.82;
  if (key === 'longbarrel') { p.bulletSpeed *= 1.25; p.bulletRange *= 1.25; }
  if (key === 'duster') { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); }
  if (key === 'twinEagle') p.damage *= 1.25;
  state.events.push({ type: 'upgrade', key });
  return true;
}

export function getBoss(state) {
  return state.enemies.find(e => e.kind === 'boss' && !e.dead) || null;
}

export function getMissionSummary(state) {
  const duration = Math.max(1, (state.stats.completedAt || state.time) - state.stats.startedAt);
  const accuracy = state.stats.shots ? Math.round(state.stats.hits / state.stats.shots * 100) : 0;
  return {
    time: duration,
    kills: state.player.kills,
    score: state.player.score,
    cash: state.player.cash,
    level: state.player.level,
    accuracy,
    damageTaken: state.stats.damageTaken,
  };
}
