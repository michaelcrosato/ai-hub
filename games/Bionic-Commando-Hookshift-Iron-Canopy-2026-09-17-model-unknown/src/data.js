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
};

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
