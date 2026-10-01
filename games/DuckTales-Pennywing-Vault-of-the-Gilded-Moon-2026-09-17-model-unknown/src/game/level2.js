// Vault II — the Sunken Orrery. A flooded clockwork observatory: stepping-stone
// pillars over the overflow, a drained cistern that hides the Star Key, a
// sliding carriage and a piston lift, scalding steam vents, Gearbats, and the
// Orrery Warden, which hops and sends sparks along the floor when it lands.
//
// Physics budget (from core.js): jump clears 2.1 up / 4.8 across, a stock pogo
// 3.1 up / 5.9 across. Every required step below stays inside the jump budget
// unless noted; tests/vault2.test.mjs walks the routes in the simulation.

import { CEILING_Y } from './level.js';

const P = (id, x, y, w, h, extra = {}) => ({ id, x, y, w, h, ...extra });
const gate = (x, bottom, w) => ({ x, y: (bottom + CEILING_Y) / 2, w, h: CEILING_Y - bottom });

export const platforms = [
  // Entry gallery.
  P('start-floor', 5.5, -0.6, 11, 1.2), //                     0 .. 11,    top 0
  // Flooded colonnade: stepping stones over the overflow.
  P('pillar-1', 13.5, -2.2, 1.8, 4.4), //                     12.6 .. 14.4, top 0
  P('pillar-2', 17.2, -2.0, 1.8, 4.4), //                     16.3 .. 18.1, top 0.2
  P('pillar-3', 21.0, -2.2, 1.6, 4.4), //                     20.2 .. 21.8, top 0
  P('pillar-4', 25.0, -1.8, 2.2, 4.4), //                     23.9 .. 26.1, top 0.4
  P('pillar-5', 29.0, -2.2, 1.8, 4.4), //                     28.1 .. 29.9, top 0
  P('colonnade-exit', 34.5, -2.2, 8.6, 4.4), //               30.2 .. 38.8, top 0
  // Aqueduct over the drained cistern (the gap before it drops into the cistern).
  P('aqueduct', 46.25, -0.5, 9.5, 1.0), //                    41.5 .. 51.0, top 0
  P('aqueduct-ledge', 53.2, -0.2, 1.6, 0.4, { oneWay: true }), // 52.4 .. 54.0, top 0
  // Springsmith hall.
  P('shrine-floor', 59.4, -2.2, 8.0, 4.4), //                 55.4 .. 63.4, top 0
  // Orrery lift over the flood: a sliding carriage, then a rising piston.
  P('carriage', 67.6, 0.0, 2.4, 0.55, { oneWay: true, moving: { axis: 'x', amp: 2.0, speed: 0.9, phase: 0.0 } }),
  P('piston', 72.6, 0.6, 2.4, 0.55, { oneWay: true, moving: { axis: 'y', amp: 1.4, speed: 1.2, phase: 1.1 } }),
  P('gate-approach', 79.6, -0.55, 8.0, 1.1), //               75.6 .. 83.6, top 0
  P('arena', 92.0, -0.65, 16.8, 1.3), //                      83.6 .. 100.4, top 0
  P('vault-step-1', 101.2, -0.25, 1.7, 1.7), //               top 0.6
  P('vault-step-2', 102.7, 0.15, 1.5, 2.5), //                top 1.4
  P('vault-floor', 106.9, 0.55, 7.0, 1.0), //                 103.4 .. 110.4, top 1.05

  // High arches over the colonnade: optional, two gems (pogo between them).
  P('high-a', 12.0, 2.6, 2.6, 0.55, { oneWay: true }), //     top 2.875
  P('high-b', 16.8, 3.7, 2.8, 0.55, { oneWay: true }), //     top 3.975
  P('high-c', 21.6, 4.5, 2.8, 0.55, { oneWay: true }), //     top 4.775
  P('high-d', 26.4, 4.9, 3.0, 0.55, { oneWay: true }), //     top 5.175
  P('high-e', 31.4, 4.3, 3.2, 0.55, { oneWay: true }), //     top 4.575

  // The drained cistern under the aqueduct: the Star Key rests on its plinth.
  P('cistern-floor', 47.1, -4.4, 16.6, 0.8), //               38.8 .. 55.4, top -4
  P('cistern-cache', 40.6, -3.6, 1.3, 0.8, { breakable: true }), // top -3.2: drop onto it with BOUNCE held
  P('key-plinth', 49.6, -3.6, 1.4, 0.8), //                   top -3.2
  P('cistern-step-1', 52.4, -2.9, 1.6, 0.55, { oneWay: true }), // top -2.625
  P('cistern-step-2', 54.3, -1.5, 1.6, 0.55, { oneWay: true }), // top -1.225
];

export const railings = [
  { x: 32.4, y: 0.62, w: 1.4 },
  { x: 44.0, y: 0.62, w: 2.2 },
  { x: 61.8, y: 0.62, w: 1.4 },
  { x: 87.6, y: 0.65, w: 1.4 },
  { x: 97.2, y: 0.65, w: 1.4 },
  { x: 106.0, y: 1.58, w: 2.7 },
];

export const signs = [
  { x: 4.2, y: 0.75, text: 'ORRERY →' },
  { x: 9.6, y: 0.55, text: 'MIND THE FLOOD' },
  { x: 37.0, y: 0.6, text: 'CISTERN ↓' },
  { x: 59.0, y: 0.6, text: 'SPRINGSMITH' },
  { x: 80.8, y: 0.8, text: 'STAR KEY REQUIRED' },
  { x: 86.6, y: 0.85, text: 'WARDEN’S DOME' },
];

// Vents: a column of steam from `base` up 1.2 that scalds while on. Wait for it to
// stop, or clear it with a jump (about a quarter-second window at a run) or a pogo.
const vent = (id, x, base, period, on, phase) => ({ id, type: 'vent', x, y: base + 0.6, w: 0.8, h: 1.2, base, period, on, warn: 0.5, phase });

export const hazards = [
  { id: 'colonnade-water', x: 20.6, y: -4.6, w: 19.2, h: 0.55, type: 'water' },
  { id: 'flood-water', x: 69.5, y: -5.0, w: 12.2, h: 0.55, type: 'water' },
  { id: 'spikes-aqueduct', x: 47.8, y: 0.1, w: 1.3, h: 0.55, type: 'spikes' },
  vent('vent-colonnade', 34.2, 0, 2.6, 1.0, 0.0),
  vent('vent-cistern', 47.2, -4.0, 2.4, 0.9, 0.8),
  vent('vent-gate', 78.0, 0, 2.2, 0.8, 1.4),
];

export const coins = [
  // entry gallery
  [2.5, 1.0], [4.0, 1.0], [5.5, 1.0], [7.0, 1.0], [8.5, 1.0],
  // stepping stones
  [13.5, 1.1], [17.2, 1.3], [21.0, 1.1], [25.0, 1.5], [29.0, 1.1],
  // high arches
  [14.4, 4.2], [16.8, 5.0], [19.2, 5.8], [24.0, 6.4], [26.4, 6.2], [28.8, 6.0],
  // colonnade exit
  [31.5, 1.1], [35.5, 1.1], [37.5, 1.1],
  // cistern
  [41.8, -2.9], [43.2, -2.9], [46.0, -2.9], [51.0, -2.9],
  // aqueduct
  [43.5, 1.1], [46.0, 1.1], [50.0, 1.1], [53.2, 1.3],
  // springsmith hall
  [59.6, 1.1], [61.6, 1.1],
  // lift
  [67.6, 1.6], [72.6, 3.2],
  // gate approach
  [77.0, 1.1], [80.6, 1.1],
  // dome
  [86.8, 1.25], [90.0, 1.25], [95.0, 1.25],
  // vault
  [101.2, 1.65], [103.6, 2.0], [105.2, 2.0], [108.4, 2.0],
].map(([x, y], i) => ({ id: `coin-${i}`, x, y, value: 5, xp: 1, kind: 'coin' }));

export const gems = [
  { id: 'gem-arch-1', x: 21.6, y: 6.1, value: 20, xp: 10, kind: 'gem' },
  { id: 'gem-arch-2', x: 31.4, y: 5.9, value: 20, xp: 10, kind: 'gem' },
  { id: 'gem-cistern-1', x: 44.2, y: -2.3, value: 25, xp: 12, kind: 'gem' },
  { id: 'gem-cistern-2', x: 52.4, y: -1.7, value: 25, xp: 12, kind: 'gem' },
  { id: 'gem-dome', x: 99.4, y: 1.0, value: 20, xp: 10, kind: 'gem' },
];

export const relics = [
  { id: 'star-key', x: 49.6, y: -2.2, kind: 'relic', xp: 20, name: 'Star Key' },
];

export const enemies = [
  { id: 'beetle-1', x: 8.0, y: 0.55, minX: 6.6, maxX: 10.2, speed: 1.15 },
  // Gearbats patrol over solid floor, so a hit never knocks Pennywing into the flood.
  { id: 'bat-1', kind: 'bat', x: 34.0, y: 2.5, minX: 30.9, maxX: 37.4, speed: 1.3, bob: { amp: 0.35, speed: 2.4, phase: 0 } },
  { id: 'beetle-2', x: 44.0, y: -3.45, minX: 42.4, maxX: 46.0, speed: 1.2 },
  { id: 'bat-2', kind: 'bat', x: 46.0, y: 2.6, minX: 42.6, maxX: 49.4, speed: 1.4, bob: { amp: 0.3, speed: 2.0, phase: 1.3 } },
  { id: 'beetle-3', x: 61.5, y: 0.55, minX: 60.2, maxX: 63.0, speed: 1.35 },
  { id: 'beetle-4', x: 81.0, y: 0.55, minX: 79.4, maxX: 82.2, speed: 1.45 },
];

export const scenery = {
  pillars: [3, 9, 15.2, 19.1, 23, 27.1, 33, 40, 47, 54, 61, 69, 76, 83, 90, 97, 104, 110],
  torches: [6.5, 19.0, 35.5, 46.5, 58.5, 70.0, 79.0, 92.0, 106.0],
  // Slowly turning orrery rings behind the play plane.
  rings: [
    { x: 25.5, y: 5.6, r: 3.0, tilt: 0.5, speed: 0.18 },
    { x: 69.5, y: 5.8, r: 3.6, tilt: -0.4, speed: -0.14 },
    { x: 92.0, y: 5.9, r: 4.4, tilt: 0.3, speed: 0.11 },
  ],
};

export const shrine = { x: 57.6, y: 0.65, radius: 1.45 };
export const keyGate = gate(83.25, -0.7, 0.7);
export const arenaLeftGate = gate(84.7, -0.7, 0.7);
export const vaultGate = gate(100.0, -0.65, 0.8);
export const crown = { id: 'orrery-star', x: 107.0, y: 2.25, kind: 'crown' };
export const exit = { x: 2.2, y: 1.0, radius: 1.3, maxY: 2.4 };

export const CACHE_VALUE = 15;
export const totalTreasureValue = [...coins, ...gems].reduce((sum, item) => sum + item.value, 0) + CACHE_VALUE;

export const VAULT_II = {
  id: 'vault-2',
  index: 1,
  name: 'The Sunken Orrery',
  short: 'Vault II',
  blurb: 'Flooded observatory, steam vents, Gearbats and the Orrery Warden.',
  length: 111,
  start: { x: 2.2, y: 0.68 },
  bounds: { minX: 0.45, maxX: 109.8, killY: -7.2, ceilingY: CEILING_Y },
  platforms, railings, signs, hazards, coins, gems, relics, enemies, scenery, shrine,
  keyGate, arenaLeftGate, vaultGate, crown, exit,
  cacheValue: CACHE_VALUE,
  totalTreasureValue,
  checkpoints: [
    { id: 'colonnade', ground: 'colonnade-exit', x: 31.4, y: 0.7, label: 'Colonnade' },
    { id: 'springsmith', ground: 'shrine-floor', x: 56.4, y: 0.7, label: 'Springsmith' },
    { id: 'gatehouse', ground: 'gate-approach', x: 76.4, y: 0.7, label: 'Orrery Gate' },
  ],
  gateHintX: 79.6,
  boss: {
    name: 'Orrery Warden',
    model: 'warden',
    x: 93.5, y: 0.9, w: 2.0, h: 1.7, hp: 6,
    minX: 88.0, maxX: 97.0,
    idleSpeed: 1.5, chargeSpeed: 5.4, tellTime: 0.6, chargeTime: 0.85,
    // After each charge it hops toward Pennywing; the landing sends a spark each way.
    hop: { vy: 10.5, vx: 3.4 },
    sparks: { speed: 6.2, life: 1.8, w: 0.55, h: 0.5 },
    trigger: 85.15,
    checkpoint: { x: 85.6, y: 0.68 },
    focus: { x: 92.4, y: 2.9 },
    arena: { minX: 83.6, maxX: 100.4, floor: 0 },
    reward: { coins: 30, xp: 50 },
  },
  escape: { time: 70, start: { x: 105.5, y: 1.75 }, rockMinX: 3, rockMaxX: 108, rockY: 8.5 },
  camera: { minX: 4.4, maxX: 107.6, minY: -1.0, maxY: 6.4 },
  theme: {
    background: 0x05161a, fog: 0x0a2124, fogDensity: 0.016,
    stone: 0x2f6062, stoneDark: 0x17383b, stoneLight: 0x4e8a84,
    water: 0x177a74, waterGlow: 0x3fd6c4, hemiSky: 0x9de8dc, hemiGround: 0x0e2422,
    music: 1,
    wallRows: [-2, 6], // two extra block courses down the cistern
  },
  text: {
    relic: 'Star Key',
    treasure: 'Orrery Star',
    findRelic: 'Find the Star Key',
    reachBoss: 'Reach the Warden’s Dome',
    bossVerb: 'Bounce the Orrery Warden',
    claim: 'Claim the Orrery Star',
    intro: { kicker: 'Sunken Orrery Expedition', title: 'Find the Star Key', sub: 'Cross the flooded colonnade. The key rests in the drained cistern below the aqueduct.' },
    relicToast: 'Star Key recovered. The orrery gate will open.',
    relicObjective: { kicker: 'Key Acquired', title: 'Reach the Warden’s Dome', sub: 'Climb out east, ride the carriage and the piston across the flood.' },
    gateHint: 'The gate needs the Star Key. It rests in the cistern under the aqueduct.',
    bossObjective: { kicker: 'Warden’s Dome', title: 'Topple the Orrery Warden', sub: 'It hops after charging. Jump the sparks, then bounce on its dome.' },
    bossHit: 'Warden casing dented',
    bossDown: { toast: 'Warden down · +30 coins', kicker: 'Warden Defeated', title: 'Claim the Orrery Star', sub: 'The star vault is open.' },
    crown: { kicker: 'Flood Alarm', title: 'Escape with the Orrery Star', sub: 'Back to the entrance before the dome seals. Masonry is falling.', toast: 'The orrery is collapsing. Run!' },
    complete: 'The Orrery Star is yours.',
  },
};
