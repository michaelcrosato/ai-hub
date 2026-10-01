// Cavern Crew II: Blackfin Breakout
// Pure level/gameplay data. Renderer-independent, so tests/validate.mjs can check routes in Node.

export const GAME_TITLE = 'Cavern Crew II: Blackfin Breakout';

const floors = [];
const walls = [];
const rails = [];
const props = [];
const hazards = [];
const enemies = [];
const pickups = [];
const interactables = [];
const signs = [];

const WALL = 0.9;
export const WALL_H = 3.4;

function floor(id, x, z, w, d, y = 0, extra = {}) {
  floors.push({ id, x, z, w, d, y, ...extra });
}

function wall(id, x, z, w, d, h = WALL_H, y = 0, extra = {}) {
  walls.push({ id, x, z, w, d, h, y, ...extra });
}

function room({ id, x, z, w, d, y = 0, openings = [], extra = {} }) {
  floor(id, x, z, w, d, y, { kind: 'room', ...extra });
  const halfW = w / 2;
  const halfD = d / 2;
  const bySide = { N: [], S: [], E: [], W: [] };
  for (const o of openings) bySide[o.side].push(o);

  function segmentedHorizontal(side, edgeZ) {
    const list = bySide[side].slice().sort((a, b) => a.center - b.center);
    let cursor = x - halfW;
    for (const o of list) {
      const left = o.center - o.width / 2;
      const right = o.center + o.width / 2;
      if (left > cursor) wall(`${id}-${side}-${cursor.toFixed(1)}`, (cursor + left) / 2, edgeZ, left - cursor, WALL, WALL_H, y);
      cursor = Math.max(cursor, right);
    }
    if (cursor < x + halfW) wall(`${id}-${side}-end`, (cursor + x + halfW) / 2, edgeZ, x + halfW - cursor, WALL, WALL_H, y);
  }

  function segmentedVertical(side, edgeX) {
    const list = bySide[side].slice().sort((a, b) => a.center - b.center);
    let cursor = z - halfD;
    for (const o of list) {
      const low = o.center - o.width / 2;
      const high = o.center + o.width / 2;
      if (low > cursor) wall(`${id}-${side}-${cursor.toFixed(1)}`, edgeX, (cursor + low) / 2, WALL, low - cursor, WALL_H, y);
      cursor = Math.max(cursor, high);
    }
    if (cursor < z + halfD) wall(`${id}-${side}-end`, edgeX, (cursor + z + halfD) / 2, WALL, z + halfD - cursor, WALL_H, y);
  }

  segmentedHorizontal('N', z - halfD);
  segmentedHorizontal('S', z + halfD);
  segmentedVertical('W', x - halfW);
  segmentedVertical('E', x + halfW);
}

function corridor({ id, x, z, w, d, y = 0, axis = 'x', ramp = null, railsOnly = false, extra = {} }) {
  floor(id, x, z, w, d, y, { kind: ramp ? 'ramp' : 'corridor', ramp, ...extra });
  if (axis === 'x') {
    const zA = z - d / 2;
    const zB = z + d / 2;
    if (railsOnly) {
      rails.push({ id: `${id}-N`, x, z: zA, w, d: 0.18, h: 1.15, y });
      rails.push({ id: `${id}-S`, x, z: zB, w, d: 0.18, h: 1.15, y });
    } else {
      wall(`${id}-N`, x, zA, w, WALL, WALL_H, y);
      wall(`${id}-S`, x, zB, w, WALL, WALL_H, y);
    }
  } else {
    const xA = x - w / 2;
    const xB = x + w / 2;
    if (railsOnly) {
      rails.push({ id: `${id}-W`, x: xA, z, w: 0.18, d, h: 1.15, y });
      rails.push({ id: `${id}-E`, x: xB, z, w: 0.18, d, h: 1.15, y });
    } else {
      wall(`${id}-W`, xA, z, WALL, d, WALL_H, y);
      wall(`${id}-E`, xB, z, WALL, d, WALL_H, y);
    }
  }
}

room({ id: 'boathouse', x: 0, z: 0, w: 18, d: 18, openings: [{ side: 'E', center: 0, width: 5.4 }] });
corridor({ id: 'entry-tunnel', x: 13.5, z: 0, w: 9, d: 5.4, axis: 'x' });
room({
  id: 'hub', x: 26, z: 0, w: 16, d: 18,
  openings: [
    { side: 'W', center: 0, width: 5.4 },
    { side: 'E', center: 0, width: 5.4 },
    { side: 'N', center: 26, width: 6.2 },
    { side: 'S', center: 26, width: 6.2 }
  ]
});

corridor({ id: 'flood-tunnel', x: 26, z: 13.5, w: 6.2, d: 9, axis: 'z' });
// The grotto floor is lower and wet. Its east wall hides a cracked section (see 'cracked-wall').
room({
  id: 'flooded-grotto', x: 26, z: 28, w: 24, d: 20, y: -0.42,
  openings: [{ side: 'N', center: 26, width: 6.2 }, { side: 'E', center: 31, width: 5.4 }],
  extra: { water: true }
});

corridor({ id: 'upper-tunnel', x: 26, z: -13.5, w: 6.2, d: 9, axis: 'z' });
corridor({
  id: 'stone-stairs', x: 26, z: -22, w: 6.2, d: 8, axis: 'z', y: 0,
  ramp: { axis: 'z', from: -18, to: -26, y0: 0, y1: 3 }
});
room({ id: 'lookout', x: 26, z: -34, w: 24, d: 16, y: 3, openings: [{ side: 'S', center: 26, width: 6.2 }] });

corridor({ id: 'gate-run', x: 39, z: 0, w: 10, d: 5.4, axis: 'x' });
// Gate collider starts active and is removed when all three seals are owned.
wall('smuggler-gate', 43.25, 0, 0.85, 5.2, 3.2, 0, { dynamic: 'gate' });

corridor({ id: 'rope-bridge', x: 51.5, z: 0, w: 16.5, d: 4.6, axis: 'x', railsOnly: true });
room({ id: 'vault', x: 68, z: 0, w: 17, d: 18, openings: [{ side: 'W', center: 0, width: 4.8 }] });

// Secret side branch: a cracked section of the grotto's east wall breaks after three sling hits
// and opens the old smugglers' pump room, where Dex (the second lost crew member) is caged.
wall('cracked-wall', 38, 31, 0.9, 5.4, WALL_H, -0.42, { dynamic: 'cracked', hp: 3 });
corridor({ id: 'pump-tunnel', x: 42.5, z: 31, w: 9, d: 5.4, axis: 'x', y: -0.42, extra: { secret: true } });
room({
  id: 'pump-room', x: 55, z: 31, w: 16, d: 14, y: -0.42,
  openings: [{ side: 'W', center: 31, width: 5.4 }],
  // Flooded until the three valves are turned (the game clears `water` at runtime).
  extra: { water: true, drains: true, secret: true }
});

// Decorative and gameplay props.
props.push(
  { type: 'crate', id: 'crate-start-1', x: -5.7, z: 5.7, y: 0, breakable: true, scrap: 2 },
  { type: 'crate', id: 'crate-hub-1', x: 21.5, z: 5.7, y: 0, breakable: true, scrap: 2 },
  { type: 'crate', id: 'crate-grotto-1', x: 18.7, z: 33.2, y: -0.42, breakable: true, scrap: 3 },
  { type: 'crate', id: 'crate-lookout-1', x: 35.0, z: -36.0, y: 3, breakable: true, scrap: 3 },
  { type: 'crate', id: 'crate-pump-1', x: 48.8, z: 36.6, y: -0.42, breakable: true, scrap: 2, optional: true },
  { type: 'barrel', id: 'barrel-start', x: -5.5, z: -5.5, y: 0 },
  { type: 'barrel', id: 'barrel-hub', x: 31.5, z: -6.0, y: 0 },
  { type: 'barrel', id: 'barrel-pump', x: 62.0, z: 36.8, y: -0.42 },
  { type: 'wreck', id: 'wreck-grotto', x: 31.5, z: 31.5, y: -0.42 },
  { type: 'island', id: 'seal-island', x: 26.0, z: 28.0, y: -0.42 },
  { type: 'treasure', id: 'treasure-vault', x: 72.5, z: -5.6, y: 0 },
  { type: 'pump', id: 'pump-machine-prop', x: 56.0, z: 25.4, y: -0.42 },
  { type: 'pipes', id: 'pump-pipes', x: 55.0, z: 31.0, y: -0.42 }
);

// Safe low cover / navigation blocks that also act as obstacles.
wall('hub-cover-a', 22.0, 2.7, 2.4, 1.2, 1.2, 0, { low: true });
wall('hub-cover-b', 30.7, -3.9, 2.0, 1.2, 1.15, 0, { low: true });
wall('lookout-cover-a', 20.0, -35.0, 2.8, 1.4, 1.1, 3, { low: true });
// The old pump: cover against the spitters' globs.
wall('pump-machine', 56.0, 25.4, 3.2, 1.4, 1.4, -0.42, { low: true });

// A swinging trap in the hub, floor spikes in the gate run, steam vents in the pump room.
hazards.push(
  { type: 'pendulum', id: 'hub-pendulum', x: 26, z: 4.2, y: 1.5, axis: 'x', amplitude: 4.1, speed: 1.35, radius: 0.8, damage: 1 },
  { type: 'spikes', id: 'spikes-a', x: 36.8, z: -1.35, w: 1.8, d: 1.35, y: 0, damage: 1, phase: 0 },
  { type: 'spikes', id: 'spikes-b', x: 39.5, z: 1.35, w: 1.8, d: 1.35, y: 0, damage: 1, phase: 1.3 },
  { type: 'steam', id: 'vent-a', x: 52.8, z: 29.4, y: -0.42, radius: 0.85, damage: 1, phase: 0, valve: 'valve-a' },
  { type: 'steam', id: 'vent-b', x: 58.4, z: 31.6, y: -0.42, radius: 0.85, damage: 1, phase: 1.1, valve: 'valve-b' },
  { type: 'steam', id: 'vent-c', x: 55.2, z: 34.6, y: -0.42, radius: 0.85, damage: 1, phase: 2.2, valve: 'valve-c' }
);

// Mission objects. `facing` turns wall-mounted things away from their wall (radians about Y).
interactables.push(
  { type: 'locker', id: 'sling-locker', x: 5.4, z: 5.6, y: 0, label: 'Open orange locker', grants: 'sling' },
  { type: 'seal', id: 'seal-gear', x: 31.2, z: 5.9, y: 0, label: 'Take Gear Seal', seal: 'Gear' },
  { type: 'seal', id: 'seal-tide', x: 26.0, z: 28.0, y: 0.18, label: 'Take Tide Seal', seal: 'Tide' },
  { type: 'seal', id: 'seal-echo', x: 35.4, z: -34.8, y: 3, label: 'Take Echo Seal', seal: 'Echo' },
  { type: 'workbench', id: 'workbench', x: 20.8, z: -5.9, y: 0, label: 'Use upgrade bench' },
  { type: 'gate', id: 'gate-console', x: 42.1, z: 0, y: 0, label: 'Unlock Smuggler Gate' },
  { type: 'rescue', id: 'rescue', x: 72.1, z: 0, y: 0, label: 'Free Mara' },
  { type: 'valve', id: 'valve-a', x: 50.5, z: 25.3, y: -0.42, facing: 0, label: 'Turn rusty valve', vent: 'vent-a' },
  { type: 'valve', id: 'valve-b', x: 61.7, z: 29.0, y: -0.42, facing: -Math.PI / 2, label: 'Turn rusty valve', vent: 'vent-b' },
  { type: 'valve', id: 'valve-c', x: 51.5, z: 36.8, y: -0.42, facing: Math.PI, label: 'Turn rusty valve', vent: 'vent-c' },
  { type: 'crew', id: 'dex-cage', x: 59.6, z: 34.8, y: -0.42, label: 'Free Dex' }
);

pickups.push(
  { type: 'gear', id: 'boots', x: 19.2, z: 24.0, y: -0.1, gear: 'boots', label: 'Grip Sneakers' },
  { type: 'gear', id: 'lamp', x: 18.4, z: -36.0, y: 3.2, gear: 'lamp', label: 'Quartz Headlamp' },
  { type: 'heal', id: 'snack-a', x: 14.9, z: 0.8, y: 0.3, amount: 2, label: 'Snack' },
  { type: 'heal', id: 'snack-b', x: 32.5, z: 28.0, y: -0.1, amount: 2, label: 'Snack' },
  { type: 'scrap', id: 'scrap-a', x: 23.2, z: -30.2, y: 3.2, amount: 2, label: 'Scrap' },
  { type: 'scrap', id: 'scrap-b', x: 49.2, z: 33.8, y: -0.1, amount: 2, label: 'Scrap', optional: true },
  { type: 'heal', id: 'snack-c', x: 61.4, z: 26.2, y: -0.1, amount: 2, label: 'Snack', optional: true }
);

// Enemy placements are intentionally light before the player gets the sling.
enemies.push(
  { id: 'bat-1', type: 'bat', x: 18.7, z: -2.7, y: 1.3, hp: 1, xp: 8, damage: 1 },
  { id: 'bat-2', type: 'bat', x: 23.0, z: 4.9, y: 1.3, hp: 1, xp: 8, damage: 1 },
  { id: 'rat-1', type: 'scout', x: 29.5, z: 4.0, y: 0, hp: 3, xp: 18, damage: 1 },
  { id: 'crab-1', type: 'crab', x: 24.0, z: 22.0, y: -0.35, hp: 2, xp: 12, damage: 1 },
  { id: 'crab-2', type: 'crab', x: 31.0, z: 31.0, y: -0.35, hp: 2, xp: 12, damage: 1 },
  { id: 'bat-3', type: 'bat', x: 20.0, z: 34.0, y: 1.0, hp: 1, xp: 8, damage: 1 },
  { id: 'scout-2', type: 'scout', x: 23.0, z: -31.0, y: 3, hp: 3, xp: 18, damage: 1 },
  { id: 'bat-4', type: 'bat', x: 30.5, z: -36.0, y: 4.1, hp: 1, xp: 8, damage: 1 },
  { id: 'scout-3', type: 'scout', x: 34.0, z: -30.0, y: 3, hp: 3, xp: 18, damage: 1 },
  { id: 'bridge-bat', type: 'bat', x: 52.5, z: 1.4, y: 1.2, hp: 2, xp: 10, damage: 1 },
  { id: 'vault-guard-a', type: 'scout', x: 64.0, z: -4.0, y: 0, hp: 4, xp: 22, damage: 1 },
  { id: 'vault-guard-b', type: 'scout', x: 66.0, z: 4.2, y: 0, hp: 4, xp: 22, damage: 1 },
  { id: 'vault-brute', type: 'brute', x: 70.5, z: -1.5, y: 0, hp: 8, xp: 42, damage: 1 },
  // Pump room (optional): spitters keep their distance and lob slow globs.
  { id: 'spitter-1', type: 'spitter', x: 57.2, z: 28.4, y: -0.42, hp: 3, xp: 20, damage: 1, optional: true },
  { id: 'spitter-2', type: 'spitter', x: 52.6, z: 35.8, y: -0.42, hp: 3, xp: 20, damage: 1, optional: true },
  { id: 'crab-3', type: 'crab', x: 50.4, z: 31.2, y: -0.35, hp: 2, xp: 12, damage: 1, optional: true },
  { id: 'bat-5', type: 'bat', x: 58.5, z: 27.8, y: 1.0, hp: 1, xp: 8, damage: 1, optional: true }
);

signs.push(
  { id: 'sign-start', x: 7.0, z: -4.9, y: 0, text: 'TUNNELS →' },
  { id: 'sign-hub', x: 20.2, z: -7.3, y: 0, text: '↑ LOOKOUT   ↓ GROTTO' },
  { id: 'sign-gate', x: 34.8, z: 2.2, y: 0, text: '3 SEALS → GATE' },
  { id: 'sign-grotto', x: 22.0, z: 20.1, y: -0.42, text: 'WATER = SLOW' },
  { id: 'sign-stairs', x: 29.1, z: -19.2, y: 0.5, text: 'WATCH YOUR STEP' },
  { id: 'sign-hollow', x: 35.6, z: 25.4, y: -0.42, text: 'HOLLOW ROCK? →' }
);

export const LEVEL = {
  spawn: { x: -5.5, z: 0, y: 0 },
  floors,
  walls,
  rails,
  props,
  hazards,
  enemies,
  pickups,
  interactables,
  signs,
  bounds: { minX: -10, maxX: 78, minZ: -43, maxZ: 40 },
  sealIds: ['seal-gear', 'seal-tide', 'seal-echo'],
  gateId: 'smuggler-gate',
  crackedId: 'cracked-wall',
  rescueId: 'rescue',
  crewId: 'dex-cage',
  valveIds: ['valve-a', 'valve-b', 'valve-c']
};

export const BALANCE = {
  player: {
    radius: 0.55,
    baseSpeed: 5.1,
    waterSlow: 0.56,
    bootsWaterSlow: 0.82,
    maxHp: 5,
    invulnSeconds: 0.85,
    shotCooldown: 0.42,
    projectileSpeed: 18,
    baseDamage: 1,
    autoAimRange: 9,
    autoAimAngleDeg: 64,
    dashSpeed: 11.5,
    dashSeconds: 0.18,
    dashCooldown: 2.2
  },
  xpThresholds: [0, 45, 105, 180, 280],
  levelHpBonus: 1,
  levelDamageBonus: 0.15,
  slingUpgradeDamage: 0.7,
  upgradeCosts: { sling: [5, 8], jacket: 7 },
  maxSlingUpgrade: 2,
  maxLevel: 5,
  sealXp: 16,
  // Side quest tuning.
  crackedWallXp: 10,
  drainXp: 12,
  dexXp: 16,
  pouchSpread: 0.2,
  pouchSideDamage: 0.6,
  spitter: { range: 10, keepAway: 4.2, closeIn: 7.5, cooldown: 2.4, windup: 0.45, globSpeed: 7, globLife: 2.4 },
  steam: { period: 3.2, warnAt: 1.5, onAt: 2.1 }
};

/**
 * Difficulty settings, chosen on the title screen and stored with a saved run.
 * Normal is the original tuning. enemyHp scales hit points, enemyCd attack/spit cooldowns,
 * enemySpeed chase speed; hpBonus adds hearts; scrapLoss is what a knockout costs.
 */
export const DIFFICULTY = {
  relaxed: { label: 'Relaxed', note: 'Three extra hearts, slower enemies, knockouts cost no scrap.', hpBonus: 3, enemyHp: 1, enemyCd: 1.3, enemySpeed: 0.85, scrapLoss: 0 },
  normal: { label: 'Normal', note: 'As designed: knockouts cost 2 scrap.', hpBonus: 0, enemyHp: 1, enemyCd: 1, enemySpeed: 1, scrapLoss: 2 },
  tough: { label: 'Tough', note: 'Enemies take 50% more hits and attack faster; knockouts cost 4 scrap.', hpBonus: 0, enemyHp: 1.5, enemyCd: 0.8, enemySpeed: 1.12, scrapLoss: 4 }
};
export const DIFFICULTY_ORDER = ['relaxed', 'normal', 'tough'];

export function floorHeightAt(x, z) {
  let best = null;
  for (const f of floors) {
    if (x >= f.x - f.w / 2 && x <= f.x + f.w / 2 && z >= f.z - f.d / 2 && z <= f.z + f.d / 2) {
      let y = f.y;
      if (f.ramp) y = rampHeight(f.ramp, x, z);
      if (!best || y > best.y) best = { y, floor: f };
    }
  }
  return best;
}

/** Height of a ramp floor at (x, z): y0 at `from`, y1 at `to`, clamped between. */
export function rampHeight(r, x, z) {
  const t = r.axis === 'z'
    ? Math.max(0, Math.min(1, (z - r.from) / (r.to - r.from)))
    : Math.max(0, Math.min(1, (x - r.from) / (r.to - r.from)));
  return r.y0 + (r.y1 - r.y0) * t;
}

export function pointInAabb(x, z, b, pad = 0) {
  return x >= b.x - b.w / 2 - pad && x <= b.x + b.w / 2 + pad && z >= b.z - b.d / 2 - pad && z <= b.z + b.d / 2 + pad;
}

export function circleHitsAabb(x, z, radius, b) {
  const minX = b.x - b.w / 2;
  const maxX = b.x + b.w / 2;
  const minZ = b.z - b.d / 2;
  const maxZ = b.z + b.d / 2;
  const cx = Math.max(minX, Math.min(x, maxX));
  const cz = Math.max(minZ, Math.min(z, maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < radius * radius;
}

export function isWetAt(x, z) {
  const f = floorHeightAt(x, z)?.floor;
  return Boolean(f?.water);
}
