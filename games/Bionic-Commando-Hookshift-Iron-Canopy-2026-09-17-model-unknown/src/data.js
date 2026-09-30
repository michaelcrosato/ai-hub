export const BALANCE = {
  gravity: 24,
  groundAccel: 42,
  airAccel: 18,
  maxSpeed: 6.4,
  grappleBaseRange: 10.6,
  grappleRankBonus: 1.0,
  gripGearBonus: 2.0,
  reelSpeed: 4.6,
  reelGearBonus: 2.2,
  playerMaxHp: 5,
  fireCooldown: 0.27,
  pulseFireCooldown: 0.19,
  playerBulletSpeed: 17,
  enemyBulletSpeed: 8.2,
  enemyFireCooldown: 1.55,
  rank2XP: 80,
  rank3XP: 180,
  interactTime: 1.35,
  // Automatic step-up height. 0.74 lets the player walk the relay stairs (0.7 m risers),
  // which the original 0.62 blocked.
  stepUp: 0.74,
};

// ---------------------------------------------------------------- Mission 01: Iron Canopy

export const PLATFORMS = [
  { x: 6, y: -1, w: 16, h: 2, kind: 'earth' },
  { x: 16.5, y: 0.45, w: 2.2, h: 0.9, kind: 'metal' },
  { x: 21, y: -0.55, w: 3.0, h: 1.1, kind: 'earth' },
  { x: 29, y: -1, w: 13, h: 2, kind: 'earth' },
  { x: 36.0, y: -0.72, w: 1.3, h: 2.55, kind: 'metal' },
  { x: 37.2, y: -0.46, w: 1.3, h: 3.05, kind: 'metal' },
  { x: 38.4, y: -0.20, w: 1.3, h: 3.55, kind: 'metal' },
  { x: 47.0, y: -1, w: 17.2, h: 2, kind: 'earth' },
  { x: 46.0, y: 3.55, w: 10, h: 0.9, kind: 'metal' },
  { x: 53.0, y: 6.0, w: 10, h: 0.45, kind: 'metal' },
  { x: 61.0, y: 1.15, w: 3.2, h: 0.55, kind: 'metal' },
  { x: 72.0, y: -1, w: 10, h: 2, kind: 'earth' },
  { x: 72.0, y: 5.0, w: 13, h: 0.45, kind: 'metal' },
  { x: 87.0, y: -1, w: 20, h: 2, kind: 'earth' },
  { x: 93.6, y: -0.7, w: 1.2, h: 2.6, kind: 'metal' },
  { x: 94.7, y: -0.35, w: 1.2, h: 3.3, kind: 'metal' },
  { x: 95.8, y: 0.0, w: 1.2, h: 4.0, kind: 'metal' },
  { x: 102.0, y: -1, w: 10, h: 2, kind: 'earth' },
  { x: 101.0, y: 4.0, w: 7.2, h: 0.55, kind: 'metal' },
  { x: 103.0, y: 8.0, w: 5.2, h: 0.55, kind: 'metal' },
];

export const ANCHORS = [
  { x: 11.5, y: 7.0 }, { x: 18.0, y: 9.2 }, { x: 26.0, y: 8.0 },
  { x: 34.0, y: 10.5 }, { x: 42.0, y: 9.0 }, { x: 50.0, y: 11.2 },
  { x: 57.0, y: 13.0 }, { x: 63.0, y: 10.4 }, { x: 70.0, y: 12.2 },
  { x: 80.0, y: 10.0 }, { x: 89.0, y: 13.4 }, { x: 97.0, y: 13.2 },
  { x: 103.0, y: 15.8 },
];

export const ENEMY_SPECS = [
  { x: 27.5, y: 0, kind: 'guard', patrol: 2.2, xp: 30 },
  { x: 33.0, y: 0, kind: 'guard', patrol: 1.7, xp: 30 },
  { x: 44.5, y: 4.0, kind: 'turret', patrol: 0, xp: 45 },
  { x: 49.0, y: 0, kind: 'guard', patrol: 2.5, xp: 30 },
  { x: 69.5, y: 0, kind: 'guard', patrol: 1.6, xp: 30 },
  { x: 75.0, y: 5.25, kind: 'turret', patrol: 0, xp: 45 },
  { x: 84.5, y: 0, kind: 'guard', patrol: 2.8, xp: 30 },
  { x: 91.0, y: 0, kind: 'guard', patrol: 2.0, xp: 30 },
  { x: 101.5, y: 4.3, kind: 'turret', patrol: 0, xp: 45 },
];

export const PICKUP_SPECS = [
  { x: 31.5, y: 1.1, kind: 'gear', id: 'grip', label: 'MAG-CLAMP: +2m GRAPPLE' },
  { x: 40.5, y: 1.0, kind: 'med', id: 'med1', label: 'FIELD PATCH' },
  { x: 61.0, y: 2.05, kind: 'gear', id: 'reel', label: 'SERVO REEL: FASTER WINCH' },
  { x: 82.0, y: 1.0, kind: 'gear', id: 'pulse', label: 'PULSE CELL: FASTER FIRE' },
  { x: 96.0, y: 2.6, kind: 'med', id: 'med2', label: 'FIELD PATCH' },
];

export const CHECKPOINT_X = 53.5;
export const SPIRE = { x: 103, y: 8.3, consoleX: 104.1, consoleY: 8.55 };

// ---------------------------------------------------------------- Mission 02: Storm Spillway
// A flooded dam valley under a storm. New pieces, all built from the same systems:
// cable-trolley anchors that slide along their lines (`move`), hover drones that drop to
// the player's firing line, lethal water, and two checkpoints. The critical route never
// needs a gear cache: every mandatory swing is inside the 10.6 m base cable range.

const SPILLWAY_PLATFORMS = [
  { x: 6, y: -1, w: 16, h: 2, kind: 'earth' }, // launch bank, top 0
  { x: 21.0, y: -0.9, w: 2.4, h: 2.8, kind: 'metal' }, // pylon island in spillway 1, top 0.5
  { x: 36.0, y: -1, w: 12, h: 2, kind: 'earth' }, // east bank, 30..42
  { x: 38.6, y: 4.6, w: 4.4, h: 0.5, kind: 'metal' }, // cache ledge, top 4.85
  { x: 42.65, y: -0.725, w: 1.3, h: 2.55, kind: 'metal' }, // dam stairs
  { x: 43.95, y: -0.45, w: 1.3, h: 3.1, kind: 'metal' },
  { x: 45.25, y: -0.175, w: 1.3, h: 3.65, kind: 'metal' },
  { x: 53.0, y: -0.075, w: 14.2, h: 3.85, kind: 'concrete' }, // dam walkway 45.9..60.1, top 1.85
  { x: 68.5, y: -0.2, w: 2.6, h: 3.75, kind: 'metal' }, // pylon island in spillway 2, top 1.675
  { x: 85, y: -1, w: 18, h: 2, kind: 'earth' }, // floodgate yard 76..94
  { x: 84.5, y: 5.2, w: 8, h: 0.45, kind: 'metal' }, // gantry 80.5..88.5, top 5.425
  { x: 109, y: -1, w: 16, h: 2, kind: 'earth' }, // tower base 101..117
  { x: 102.0, y: -0.725, w: 1.2, h: 2.55, kind: 'metal' }, // tower stairs
  { x: 103.2, y: -0.45, w: 1.2, h: 3.1, kind: 'metal' },
  { x: 104.4, y: -0.175, w: 1.2, h: 3.65, kind: 'metal' },
  { x: 105.6, y: 0.1, w: 1.2, h: 4.2, kind: 'metal' }, // top 2.2
  { x: 109.5, y: 4.4, w: 6.4, h: 0.55, kind: 'metal' }, // tower mid deck 106.3..112.7, top 4.675
  { x: 111.0, y: 8.4, w: 4.4, h: 0.55, kind: 'metal' }, // uplink deck 108.8..113.2, top 8.675
];

const SPILLWAY_ANCHORS = [
  { x: 11.2, y: 7.4 },
  { x: 20.5, y: 9.8, move: { range: 2.8, speed: 0.8, phase: 0 } },
  { x: 29.4, y: 9.0 },
  { x: 41.4, y: 11.4 },
  { x: 50.0, y: 11.8 },
  { x: 58.6, y: 11.0 },
  { x: 65.2, y: 11.6, move: { range: 2.4, speed: 0.95, phase: 0 } },
  { x: 72.4, y: 11.0, move: { range: 2.4, speed: 0.95, phase: Math.PI } },
  { x: 79.8, y: 11.2 },
  { x: 89.2, y: 12.6 },
  { x: 97.4, y: 9.6, move: { range: 1.8, speed: 1.1, phase: 1.2 } },
  { x: 105.9, y: 13.0 },
  { x: 108.2, y: 16.2 },
];

const SPILLWAY_ENEMIES = [
  { x: 35.0, y: 0, kind: 'guard', patrol: 2.2, xp: 30 },
  { x: 33.0, y: 5.4, kind: 'drone', patrol: 2.0, xp: 35 },
  { x: 46.6, y: 1.85, kind: 'turret', patrol: 0, xp: 45 },
  { x: 50.5, y: 1.85, kind: 'guard', patrol: 2.2, xp: 30 },
  { x: 69.0, y: 6.2, kind: 'drone', patrol: 3.0, xp: 35 },
  { x: 84.0, y: 0, kind: 'guard', patrol: 2.0, xp: 30 },
  { x: 87.2, y: 5.425, kind: 'turret', patrol: 0, xp: 45 },
  { x: 91.0, y: 0, kind: 'guard', patrol: 1.8, xp: 30 },
  { x: 97.5, y: 5.5, kind: 'drone', patrol: 2.0, xp: 35 },
  { x: 110.5, y: 0, kind: 'guard', patrol: 2.5, xp: 30 },
  { x: 111.9, y: 4.675, kind: 'turret', patrol: 0, xp: 45 },
];

const SPILLWAY_PICKUPS = [
  { x: 37.6, y: 5.9, kind: 'gear', id: 'grip', label: 'MAG-CLAMP: +2m GRAPPLE' },
  { x: 54.0, y: 2.9, kind: 'med', id: 'med1', label: 'FIELD PATCH' },
  { x: 68.5, y: 2.75, kind: 'gear', id: 'reel', label: 'SERVO REEL: FASTER WINCH' },
  { x: 82.6, y: 6.5, kind: 'gear', id: 'pulse', label: 'PULSE CELL: FASTER FIRE' },
  { x: 103.2, y: 2.15, kind: 'med', id: 'med2', label: 'FIELD PATCH' },
];

// ---------------------------------------------------------------- missions

export const MISSIONS = [
  {
    id: 'canopy',
    code: '01',
    name: 'IRON CANOPY',
    theme: 'canopy',
    platforms: PLATFORMS,
    anchors: ANCHORS,
    enemies: ENEMY_SPECS,
    pickups: PICKUP_SPECS,
    lips: [36.0, 37.2, 38.4, 93.6, 94.7, 95.8],
    checkpoints: [{ x: CHECKPOINT_X, rx: 51, ry: 0 }],
    spire: { ...SPIRE, beaconY: 15.15 },
    start: { x: 3.5, y: 0 },
    maxX: 108,
    camMaxX: 101,
    killY: -13,
    par: 150,
    objectives: [
      { until: 52, text: 'Cross the gorge • Find Relay Spire 7' },
      { until: 94, text: 'Advance through the relay fortress' },
    ],
    climbText: 'Ascend Relay Spire 7',
    actText: 'Hold ACT to cut the transmitter',
    doneText: 'Relay Spire 7 offline',
    clearEyebrow: 'TRANSMISSION CUT',
  },
  {
    id: 'spillway',
    code: '02',
    name: 'STORM SPILLWAY',
    theme: 'storm',
    platforms: SPILLWAY_PLATFORMS,
    anchors: SPILLWAY_ANCHORS,
    enemies: SPILLWAY_ENEMIES,
    pickups: SPILLWAY_PICKUPS,
    lips: [42.65, 43.95, 45.25, 102.0, 103.2, 104.4, 105.6],
    checkpoints: [
      { x: 56, rx: 56.5, ry: 1.85 },
      { x: 78, rx: 77.5, ry: 0 },
    ],
    spire: { x: 111, y: 8.7, consoleX: 112.1, consoleY: 8.95, beaconY: 15.55 },
    start: { x: 3.5, y: 0 },
    maxX: 116,
    camMaxX: 110,
    killY: -2.4,
    waterY: -1.6,
    par: 200,
    objectives: [
      { until: 42, text: 'Ride the cable trolleys across the spillway' },
      { until: 60.5, text: 'Take the dam walkway' },
      { until: 101, text: 'Cross the floodgate works' },
    ],
    climbText: 'Climb the Floodgate Uplink',
    actText: 'Hold ACT to jam the storm uplink',
    doneText: 'Storm uplink jammed',
    clearEyebrow: 'UPLINK JAMMED',
  },
];
