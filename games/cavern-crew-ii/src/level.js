// Cavern Crew II: Blackfin Breakout
// Pure level/gameplay data. Kept renderer-independent for validation and legacy support.

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
const WALL_H = 3.4;

function floor(id, x, z, w, d, y = 0, extra = {}) {
  floors.push({ id, x, z, w, d, y, ...extra });
}

function wall(id, x, z, w, d, h = WALL_H, y = 0, extra = {}) {
  walls.push({ id, x, z, w, d, h, y, ...extra });
}

function room({ id, x, z, w, d, y = 0, openings = [] }) {
  floor(id, x, z, w, d, y, { kind: 'room' });
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

function corridor({ id, x, z, w, d, y = 0, axis = 'x', ramp = null, railsOnly = false }) {
  floor(id, x, z, w, d, y, { kind: ramp ? 'ramp' : 'corridor', ramp });
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
room({ id: 'flooded-grotto', x: 26, z: 28, w: 24, d: 20, y: -0.42, openings: [{ side: 'N', center: 26, width: 6.2 }] });
// The grotto floor is lower and wet.
floors[floors.length - 1].water = true;

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

// Decorative and gameplay props.
props.push(
  { type: 'crate', id: 'crate-start-1', x: -5.7, z: 5.7, y: 0, breakable: true, scrap: 2 },
  { type: 'crate', id: 'crate-hub-1', x: 21.5, z: 5.7, y: 0, breakable: true, scrap: 2 },
  { type: 'crate', id: 'crate-grotto-1', x: 18.7, z: 33.2, y: -0.42, breakable: true, scrap: 3 },
  { type: 'crate', id: 'crate-lookout-1', x: 35.0, z: -36.0, y: 3, breakable: true, scrap: 3 },
  { type: 'barrel', id: 'barrel-start', x: -5.5, z: -5.5, y: 0 },
  { type: 'barrel', id: 'barrel-hub', x: 31.5, z: -6.0, y: 0 },
  { type: 'wreck', id: 'wreck-grotto', x: 31.5, z: 31.5, y: -0.42 },
  { type: 'island', id: 'seal-island', x: 26.0, z: 28.0, y: -0.42 },
  { type: 'treasure', id: 'treasure-vault', x: 72.5, z: -5.6, y: 0 }
);

// Safe low cover / navigation blocks that also act as obstacles.
wall('hub-cover-a', 22.0, 2.7, 2.4, 1.2, 1.2, 0, { low: true });
wall('hub-cover-b', 30.7, -3.9, 2.0, 1.2, 1.15, 0, { low: true });
wall('lookout-cover-a', 20.0, -35.0, 2.8, 1.4, 1.1, 3, { low: true });

// A rotating/swinging trap in the hub and floor spikes in the gate run.
hazards.push(
  { type: 'pendulum', id: 'hub-pendulum', x: 26, z: 4.2, y: 1.5, axis: 'x', amplitude: 4.1, speed: 1.35, radius: 0.8, damage: 1 },
  { type: 'spikes', id: 'spikes-a', x: 36.8, z: -1.35, w: 1.8, d: 1.35, y: 0, damage: 1, phase: 0 },
  { type: 'spikes', id: 'spikes-b', x: 39.5, z: 1.35, w: 1.8, d: 1.35, y: 0, damage: 1, phase: 1.3 }
);

// Mission objects.
interactables.push(
  { type: 'locker', id: 'sling-locker', x: 5.4, z: 5.6, y: 0, label: 'Open orange locker', grants: 'sling' },
  { type: 'seal', id: 'seal-gear', x: 31.2, z: 5.9, y: 0, label: 'Take Gear Seal', seal: 'Gear' },
  { type: 'seal', id: 'seal-tide', x: 26.0, z: 28.0, y: 0.18, label: 'Take Tide Seal', seal: 'Tide' },
  { type: 'seal', id: 'seal-echo', x: 35.4, z: -34.8, y: 3, label: 'Take Echo Seal', seal: 'Echo' },
  { type: 'workbench', id: 'workbench', x: 20.8, z: -5.9, y: 0, label: 'Use upgrade bench' },
  { type: 'gate', id: 'gate-console', x: 42.1, z: 0, y: 0, label: 'Unlock Smuggler Gate' },
  { type: 'rescue', id: 'rescue', x: 72.1, z: 0, y: 0, label: 'Free Mara' }
);

pickups.push(
  { type: 'gear', id: 'boots', x: 19.2, z: 24.0, y: -0.1, gear: 'boots', label: 'Grip Sneakers' },
  { type: 'gear', id: 'lamp', x: 18.4, z: -36.0, y: 3.2, gear: 'lamp', label: 'Quartz Headlamp' },
  { type: 'heal', id: 'snack-a', x: 14.9, z: 0.8, y: 0.3, amount: 2, label: 'Snack' },
  { type: 'heal', id: 'snack-b', x: 32.5, z: 28.0, y: -0.1, amount: 2, label: 'Snack' },
  { type: 'scrap', id: 'scrap-a', x: 23.2, z: -30.2, y: 3.2, amount: 2, label: 'Scrap' }
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
  { id: 'vault-brute', type: 'brute', x: 70.5, z: -1.5, y: 0, hp: 8, xp: 42, damage: 1 }
);

signs.push(
  { id: 'sign-start', x: 7.0, z: -4.9, y: 0, text: 'TUNNELS →' },
  { id: 'sign-hub', x: 20.2, z: -7.3, y: 0, text: '↑ LOOKOUT   ↓ GROTTO' },
  { id: 'sign-gate', x: 34.8, z: 2.2, y: 0, text: '3 SEALS → GATE' },
  { id: 'sign-grotto', x: 22.0, z: 20.1, y: -0.42, text: 'WATER = SLOW' },
  { id: 'sign-stairs', x: 29.1, z: -19.2, y: 0.5, text: 'WATCH YOUR STEP' }
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
  rescueId: 'rescue'
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
  maxLevel: 5
};

export function floorHeightAt(x, z) {
  let best = null;
  for (const f of floors) {
    if (x >= f.x - f.w / 2 && x <= f.x + f.w / 2 && z >= f.z - f.d / 2 && z <= f.z + f.d / 2) {
      let y = f.y;
      if (f.ramp) {
        const r = f.ramp;
        const t = r.axis === 'z'
          ? Math.max(0, Math.min(1, (z - r.from) / (r.to - r.from)))
          : Math.max(0, Math.min(1, (x - r.from) / (r.to - r.from)));
        y = r.y0 + (r.y1 - r.y0) * t;
      }
      if (!best || y > best.y) best = { y, floor: f };
    }
  }
  return best;
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
