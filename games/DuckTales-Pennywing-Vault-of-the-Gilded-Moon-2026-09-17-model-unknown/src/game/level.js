// Vault I — the Vault of the Gilded Moon. Collision and content data; the
// named exports are the original layout, VAULT_I bundles them with the
// per-level settings the simulation and the scene read.

export const LEVEL_LENGTH = 90;
/** Underside of the cavern ceiling: nothing climbs above it (no pogo over a gate). */
export const CEILING_Y = 9.8;

const P = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
/** A portcullis from its floor up to the ceiling. */
const gate = (x, bottom, w) => ({ x, y: (bottom + CEILING_Y) / 2, w, h: CEILING_Y - bottom });

export const platforms = [
  P('start-floor', 5.5, -0.6, 11, 1.2),
  P('pit-left-lip', 11.5, -1.05, 1.4, 2.1),
  P('secret-floor-a', 14.2, -4.1, 5.4, 1.0),
  P('secret-floor-b', 18.6, -3.4, 3.6, 1.0),
  P('main-floor-1a', 20.75, -0.6, 5.5, 1.2),
  P('main-floor-1b', 26.05, -0.6, 2.0, 1.2),
  P('main-floor-2', 28.7, -0.6, 3.2, 1.2),
  P('stair-1', 31.1, -0.25, 1.7, 1.5),
  P('stair-2', 32.7, 0.20, 1.6, 2.4),
  P('stair-3', 34.2, 0.65, 1.5, 3.3),
  P('upper-landing', 37.2, 1.05, 5.2, 1.0, { oneWay: true }),
  P('shrine-floor', 42.2, 0.0, 7.8, 1.0),
  P('moving-gap-left', 46.0, -0.55, 1.7, 1.1),
  P('moving-a', 48.5, 0.25, 2.4, 0.55, { oneWay: true, moving: { axis: 'y', amp: 1.45, speed: 1.35, phase: 0.0 } }),
  P('moving-b', 51.7, 0.85, 2.4, 0.55, { oneWay: true, moving: { axis: 'y', amp: 1.75, speed: 1.15, phase: 2.2 } }),
  P('gate-approach', 55.8, -0.55, 6.4, 1.1),
  P('pre-arena', 61.2, -0.55, 4.8, 1.1),
  P('arena', 71.0, -0.65, 15.2, 1.3),
  P('vault-step-1', 79.4, -0.25, 1.7, 1.7),
  P('vault-step-2', 80.9, 0.15, 1.5, 2.5),
  P('vault-floor', 85.1, 0.55, 7.0, 1.0),

  // Upper route: safer, quicker, but asks for confident pogo timing.
  P('upper-a', 13.7, 2.35, 3.2, 0.55, { oneWay: true }),
  P('upper-b', 18.3, 3.45, 3.4, 0.55, { oneWay: true }),
  P('upper-c', 23.2, 4.25, 3.4, 0.55, { oneWay: true }),
  P('upper-d', 28.2, 4.85, 3.3, 0.55, { oneWay: true }),
  P('gear-perch', 33.0, 5.1, 3.7, 0.65, { oneWay: true }),

  // Risky treasure route below the first main stretch.
  P('crack-a', 24.3, -0.325, 1.5, 0.65, { breakable: true }),
  P('treasure-floor', 29.5, -4.2, 12.8, 0.8),
  P('treasure-step', 35.0, -2.65, 1.8, 0.55, { oneWay: true }),
  P('treasure-exit', 36.4, -0.85, 1.7, 0.55, { oneWay: true }),
];

export const railings = [
  { x: 39.3, y: 2.05, w: 1.4 },
  { x: 44.1, y: 1.05, w: 1.2 },
  { x: 67.1, y: 0.65, w: 1.4 },
  { x: 75.0, y: 0.65, w: 1.4 },
  { x: 84.2, y: 1.58, w: 2.7 },
];

export const signs = [
  { x: 4.2, y: 0.75, text: 'VAULT →' },
  { x: 10.3, y: 0.55, text: 'HIGH ROAD / LOW GOLD' },
  { x: 40.0, y: 1.1, text: 'SPRINGSMITH' },
  { x: 58.6, y: 0.8, text: 'MOON GEAR REQUIRED' },
  { x: 65.6, y: 0.85, text: 'SENTINEL CHAMBER' },
];

export const hazards = [
  { id: 'pit-water', x: 14.5, y: -5.05, w: 7.0, h: 0.55, type: 'water' },
  { id: 'spikes-a', x: 20.0, y: 0.1, w: 1.4, h: 0.55, type: 'spikes' },
  { id: 'spikes-b', x: 53.7, y: -0.05, w: 1.25, h: 0.55, type: 'spikes' },
  { id: 'treasure-spikes', x: 25.0, y: -3.45, w: 1.0, h: 0.5, type: 'spikes' },
];

export const coins = [
  [2.5, 1.0], [4.0, 1.0], [5.5, 1.0], [7.0, 1.0], [8.5, 1.0],
  [12.8, 3.1], [14.2, 3.25], [17.0, 4.1], [19.0, 4.2], [22.0, 5.0],
  [24.0, 5.0], [27.0, 5.6], [30.0, 5.6], [35.8, 2.0], [38.2, 2.0],
  [40.5, 1.5], [43.4, 1.5], [47.4, 2.4], [50.5, 3.1], [54.8, 1.1],
  [57.0, 1.1], [60.7, 1.1], [66.8, 1.25], [69.4, 1.25], [74.5, 1.25],
  [79.5, 1.65], [82.4, 2.0], [84.0, 2.0], [86.0, 2.0], [87.7, 2.0],
].map(([x, y], i) => ({ id: `coin-${i}`, x, y, value: 5, xp: 1, kind: 'coin' }));

export const gems = [
  { id: 'gem-secret-1', x: 14.0, y: -2.7, value: 20, xp: 10, kind: 'gem' },
  { id: 'gem-secret-2', x: 18.4, y: -2.0, value: 20, xp: 10, kind: 'gem' },
  { id: 'gem-treasure-1', x: 26.1, y: -3.1, value: 25, xp: 12, kind: 'gem' },
  { id: 'gem-treasure-2', x: 28.0, y: -3.1, value: 25, xp: 12, kind: 'gem' },
  { id: 'gem-arena', x: 76.5, y: 1.0, value: 20, xp: 10, kind: 'gem' },
];

export const relics = [
  { id: 'moon-gear', x: 33.0, y: 6.25, kind: 'relic', xp: 20, name: 'Moon Gear' },
];

export const enemies = [
  { id: 'beetle-1', x: 8.0, y: 0.55, minX: 6.8, maxX: 10.1, speed: 1.15 },
  { id: 'beetle-2', x: 28.6, y: 0.55, minX: 27.5, maxX: 29.8, speed: 1.25 },
  { id: 'beetle-3', x: 43.2, y: 1.05, minX: 40.6, maxX: 44.8, speed: 1.35 },
  { id: 'beetle-4', x: 59.5, y: 0.55, minX: 58.1, maxX: 62.4, speed: 1.45 },
];

export const scenery = {
  pillars: [3, 9, 17, 24, 31, 39, 46, 54, 62, 68, 75, 82, 88],
  torches: [6.5, 19.5, 36.5, 44.5, 57.5, 66.2, 77.0, 85.7],
  rings: [],
};

export const shrine = { x: 41.4, y: 1.15, radius: 1.45 };
// The gates reach the ceiling: with the Springstaff Coil a pogo used to clear the
// original 3.8-tall bars and skip the Moon Gear, which stranded the run.
export const keyGate = gate(63.25, -0.7, 0.7);
export const arenaLeftGate = gate(64.7, -0.7, 0.7);
export const vaultGate = gate(78.2, -0.65, 0.8);
export const crown = { id: 'gilded-moon', x: 85.2, y: 2.25, kind: 'crown' };
export const exit = { x: 2.2, y: 1.0, radius: 1.3, maxY: 2.4 };

export const CACHE_VALUE = 15;
export const totalTreasureValue = [...coins, ...gems].reduce((sum, item) => sum + item.value, 0) + CACHE_VALUE; // includes the cracked cache

export const VAULT_I = {
  id: 'vault-1',
  index: 0,
  name: 'Vault of the Gilded Moon',
  short: 'Vault I',
  blurb: 'Clockwork ruin, three routes, the Brassback Sentinel.',
  length: LEVEL_LENGTH,
  start: { x: 2.2, y: 0.68 },
  bounds: { minX: 0.45, maxX: 89.4, killY: -7.2, ceilingY: CEILING_Y },
  platforms, railings, signs, hazards, coins, gems, relics, enemies, scenery, shrine,
  keyGate, arenaLeftGate, vaultGate, crown, exit,
  cacheValue: CACHE_VALUE,
  totalTreasureValue,
  // Touching the named floor makes it the respawn point (first touch shows a toast).
  checkpoints: [
    { id: 'lower-hall', ground: 'main-floor-1a', x: 22.2, y: 0.7, label: 'Lower Hall' },
    { id: 'springsmith', ground: 'shrine-floor', x: 38.9, y: 1.2, label: 'Springsmith' },
    { id: 'gatehouse', ground: 'gate-approach', x: 56.2, y: 0.7, label: 'Gatehouse' },
  ],
  gateHintX: 60.7,
  boss: {
    name: 'Brassback Sentinel',
    model: 'brassback',
    x: 71.6, y: 0.82, w: 1.8, h: 1.55, hp: 5,
    minX: 67.0, maxX: 76.0,
    idleSpeed: 1.35, chargeSpeed: 5.0, tellTime: 0.55, chargeTime: 0.9,
    hop: null,
    trigger: 65.15,
    // Clear of the gate and of the Sentinel's reach at the left end of its patrol.
    checkpoint: { x: 65.6, y: 0.68 },
    focus: { x: 71.2, y: 2.7 },
    arena: { minX: 63.4, maxX: 78.6, floor: 0 },
    reward: { coins: 25, xp: 40 },
  },
  escape: { time: 55, start: { x: 83.7, y: 1.65 }, rockMinX: 3, rockMaxX: 87, rockY: 8.5 },
  camera: { minX: 4.4, maxX: 86.3, minY: 0.7, maxY: 6.4 },
  theme: {
    background: 0x07131e, fog: 0x0b1b27, fogDensity: 0.016,
    stone: 0x35576a, stoneDark: 0x203b4c, stoneLight: 0x557a83,
    water: 0x155f72, waterGlow: 0x2a9fb0, hemiSky: 0x9dd9ea, hemiGround: 0x10212c,
    music: 0,
    wallRows: [0, 6],
  },
  text: {
    relic: 'Moon Gear',
    treasure: 'Gilded Moon',
    findRelic: 'Find the Moon Gear',
    reachBoss: 'Reach the Sentinel Chamber',
    bossVerb: 'Bounce the Brassback Sentinel',
    claim: 'Claim the Gilded Moon',
    intro: { kicker: 'Moon-Vault Expedition', title: 'Find the Moon Gear', sub: 'High road for speed. Low route for enough treasure to buy upgrades early.' },
    relicToast: 'Moon Gear recovered. The lower gate is open.',
    relicObjective: { kicker: 'Gear Acquired', title: 'Reach the Sentinel Chamber', sub: 'Hold BOUNCE to turn the springstaff into a pogo weapon.' },
    gateHint: 'The gate needs the Moon Gear. Look above the old stairs.',
    bossObjective: { kicker: 'Sentinel Chamber', title: 'Crack the Brassback Sentinel', sub: 'Side hits hurt. Bounce on its shell after its charge.' },
    bossHit: 'Sentinel shell cracked',
    bossDown: { toast: 'Brassback down · +25 coins', kicker: 'Sentinel Defeated', title: 'Claim the Gilded Moon', sub: 'The inner vault is open. The treasure is almost yours.' },
    crown: { kicker: 'Vault Alarm', title: 'Escape with the Gilded Moon', sub: 'Return to the entrance. Falling masonry now tracks your route.', toast: 'The vault is coming down. Move!' },
    complete: 'The Gilded Moon is yours.',
  },
};
