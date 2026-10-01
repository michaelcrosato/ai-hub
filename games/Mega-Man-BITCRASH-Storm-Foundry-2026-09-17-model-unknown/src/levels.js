/**
 * levels.js — the BITCRASH missions as data.
 *
 * Units are robot-sized (BIT is 0.72 wide and 1.5 tall), x runs right, y up,
 * and the whole run plays on the z = 0 plane. Boxes are centre + size, so a
 * platform's walking surface ("top") is y + h / 2.
 *
 * Mission 01 keeps the original Storm Foundry layout number for number.
 * Mission 02, Arc Spire, is new: crushers, hoppers, shielded guards, a
 * sliding rail platform, and the Arc Regent, who is weak to the Gale Burst
 * that the Gale Warden leaves behind.
 */

const walker = (x, y, min, max) => ({ type: 'walker', x, y, min, max });
const turret = (x, y, dir) => ({ type: 'turret', x, y, dir });
const drone = (x, y) => ({ type: 'drone', x, y });
const hopper = (x, y, min, max) => ({ type: 'hopper', x, y, min, max });
const shield = (x, y, dir) => ({ type: 'shield', x, y, dir });
const scrap = (x, y, value = 1) => ({ type: 'scrap', x, y, r: 0.28, value });
const health = (x, y, value = 6) => ({ type: 'health', x, y, r: 0.34, value });
const pit = (x, w) => ({ type: 'pit', x, y: -2, w, h: 5, damage: 6 });

// The original scrap trail: twelve on the lower route, rising in three steps.
const foundryScrap = [5.2, 7.4, 11.0, 15.5, 21.2, 25.4, 28.7, 32.0, 37.2, 41.1, 45.1, 48.1].map((x, i) =>
  scrap(x, i < 3 ? 1.7 : i < 6 ? 2.7 : i < 9 ? 2.0 : 3.0, i >= 8 ? 2 : 1)
);
const foundryUpper = [28.0, 35.2, 42.0, 46.0].map((x, i) => scrap(x, 6.5 + (i % 2) * 0.35, 2));

const FOUNDRY = {
  id: 'foundry',
  code: 'MISSION 01',
  name: 'STORM FOUNDRY',
  blurb: 'Punch through a skyborne turbine works, choose a route, tune your gear, and shut down the Gale Warden.',
  startToast: 'MISSION START // REACH THE PRESSURE CORE',
  endTitle: 'RELAY RESTORED',
  par: 100,
  music: [147, 196, 220, 294, 196, 247, 330, 247, 165, 220, 247, 330, 220, 294, 370, 294],
  theme: {
    sky: 0x071526,
    fog: 0x09192a,
    platform: 0x1d5571,
    platformTop: 0x42a8bd,
    bossFloor: 0x344e67,
    rail: 0x81c9d7,
    tower: 0x0d2940,
    towerCap: 0x214c62,
    cloud: 0x9cc9d6,
    mover: 0x3f91a7,
  },
  start: { x: 2, y: 1.35 },
  spawn: { x: 2, y: 1.7 },
  xMin: 0.4, // the original allowed -1, which let BIT walk off the start of the stage
  xMax: 65,
  bounds: { left: -5, right: 72, bottom: -7, top: 15 },
  platforms: [
    { id: 'p0', x: 6, y: 0, w: 12, h: 1.2 },
    { id: 'p1', x: 16, y: 1.0, w: 6, h: 1.2 },
    { id: 'p2', x: 23, y: 1.0, w: 6, h: 1.2 },
    { id: 'low1', x: 31, y: 0.6, w: 8, h: 1.2 },
    { id: 'low2', x: 40, y: 0.9, w: 8, h: 1.2 },
    { id: 'low3', x: 48, y: 1.1, w: 6, h: 1.2 },
    { id: 'u1', x: 27, y: 4.0, w: 4.5, h: 0.8 },
    { id: 'u2', x: 33, y: 5.2, w: 5, h: 0.8 },
    { id: 'u3', x: 40, y: 5.8, w: 6, h: 0.8 },
    { id: 'u4', x: 46.2, y: 4.7, w: 4.4, h: 0.8 },
    { id: 'boss', x: 58.5, y: 1.0, w: 13, h: 1.2 },
    { id: 'cap', x: 65.7, y: 4, w: 1, h: 10 },
    // Optional raised steps to the upper route; the lower route stays clear underneath.
    { id: 'st0', x: 24.8, y: 3.5, w: 1.3, h: 0.35 },
    { id: 'st1', x: 26.2, y: 4.2, w: 1.3, h: 0.35 },
  ],
  movers: [
    { id: 'm1', x: 13, y: 2.8, w: 2.1, h: 0.45, baseY: 2.8, amp: 2.2, speed: 1.25, phase: 0 },
    { id: 'm2', x: 49.8, y: 3.2, w: 2.4, h: 0.45, baseY: 3.2, amp: 2.1, speed: 1.0, phase: 2.0 },
  ],
  hazards: [
    { type: 'fan', x: 18.7, y: 2.4, w: 1.7, h: 1.8, damage: 1, push: 3.5 },
    { type: 'electric', x: 32.7, y: 1.9, w: 1.1, h: 2.2, damage: 4 },
    { type: 'fan', x: 42.5, y: 2.5, w: 1.9, h: 2.0, damage: 1, push: -3.5 },
    { type: 'pit', x: 12.8, y: -2, w: 1.8, h: 5, damage: 6 },
    { type: 'pit', x: 51.4, y: -2, w: 1.5, h: 5, damage: 6 },
  ],
  terminals: [
    { id: 't1', x: 36.3, y: 2.1 },
    { id: 'tu', x: 40.0, y: 7.2 },
    { id: 't2', x: 49.2, y: 2.25 },
  ],
  enemies: [
    walker(9.5, 1.4, 7.8, 10.8),
    turret(17.0, 2.2, -1),
    drone(20.5, 5.1),
    walker(22.5, 2.4, 20.5, 24.5),
    drone(28.5, 6.8),
    walker(31, 1.8, 28.5, 33.4),
    turret(39.8, 2.15, -1),
    walker(40.3, 6.9, 37.5, 42.5),
    drone(45.0, 7.3),
    walker(47.3, 2.35, 45.3, 49),
    turret(48.4, 5.75, -1),
  ],
  pickups: [...foundryScrap, ...foundryUpper, health(33.0, 6.3), health(49.0, 3.2)],
  checkpoints: [{ at: 36, x: 37, y: 2.4, credit: 6, heal: 0.75, text: 'CHECKPOINT // SERVICE CREDIT: 6 SCRAP' }],
  boss: {
    kind: 'gale',
    name: 'GALE WARDEN // PRESSURE CORE',
    warning: 'WARNING // GALE WARDEN',
    phase2: 'PRESSURE SPIKE // WIND SHEAR',
    defeat: 'GALE WARDEN OFFLINE',
    x: 59.5,
    y: 5.2,
    w: 2.2,
    h: 2.4,
    hp: 34,
    centerX: 59.2,
    trigger: 51.8,
    gateX: 52.1,
    enterX: 53.2,
    respawn: { x: 53, y: 2.4 },
    camX: 58.4,
    camY: 5.0,
    arena: [52, 65],
    floor: 1.6,
  },
  signs: [
    ['MOVE  →', 3.3, 3.2],
    ['JUMP', 11.6, 4.1],
    ['FIRE', 16.2, 4.7],
    ['UPPER: FAST / LOWER: SAFE', 25.5, 8.0],
    ['SERVICE BAY', 36.3, 4.5],
    ['SERVICE BAY', 40.0, 9.3],
    ['PRESSURE CORE', 55.3, 8.0],
  ],
  backdrop: { towers: 18, clouds: 14 },
};

/*
 * Arc Spire, walking surfaces (top = y + h / 2):
 *   a0 0–14 @0.6 · a1 15–22 @1.2 · rail mover over 22–29 · a2 29–37 @1.6
 *   (step s0 and ledge u1 above it) · a3 39–46.6 @1.2 · lift over 46.6–51
 *   a4 51–59 @3.2 · a5 60–68 @2.0 · a6 70–76 @1.6 · arena 77–92 @1.6
 * Every gap is at most a 4-unit hop and every climb under the 2.5 jump apex.
 */
const SPIRE = {
  id: 'spire',
  code: 'MISSION 02',
  name: 'ARC SPIRE',
  blurb: 'Drop into the capacitor works under the foundry: crushers, hoppers and shield guards stand between you and the Arc Regent.',
  startToast: 'MISSION START // REACH THE CAPACITOR CORE',
  endTitle: 'SPIRE GROUNDED',
  par: 140,
  music: [110, 165, 220, 262, 165, 196, 247, 196, 123, 185, 247, 294, 185, 220, 277, 220],
  theme: {
    sky: 0x0a1024,
    fog: 0x0d1530,
    platform: 0x283f66,
    platformTop: 0x7f8cff,
    bossFloor: 0x3a3d6e,
    rail: 0xa3a8e6,
    tower: 0x141f3e,
    towerCap: 0x3b2f6a,
    cloud: 0x7d8fc4,
    mover: 0x5a6fc0,
  },
  start: { x: 2, y: 1.35 },
  spawn: { x: 2, y: 1.7 },
  xMin: 0.4, // the original allowed -1, which let BIT walk off the start of the stage
  xMax: 92,
  bounds: { left: -5, right: 99, bottom: -7, top: 15 },
  platforms: [
    { id: 'a0', x: 7, y: 0, w: 14, h: 1.2 },
    { id: 'a1', x: 18.5, y: 0.6, w: 7, h: 1.2 },
    { id: 'a2', x: 33, y: 1.0, w: 8, h: 1.2 },
    { id: 'a3', x: 42.8, y: 0.6, w: 7.6, h: 1.2 },
    { id: 'a4', x: 55, y: 2.6, w: 8, h: 1.2 },
    { id: 'a5', x: 64, y: 1.4, w: 8, h: 1.2 },
    { id: 'a6', x: 73, y: 1.0, w: 6, h: 1.2 },
    { id: 'boss', x: 84.5, y: 1.0, w: 15, h: 1.2 },
    { id: 'cap', x: 92.7, y: 4, w: 1, h: 10 },
    { id: 's0', x: 30.6, y: 3.4, w: 1.4, h: 0.35 },
    { id: 'u1', x: 34, y: 4.4, w: 4, h: 0.8 },
  ],
  movers: [
    // A rail platform sliding across the 22–29 gap, then a lift up to the service deck.
    { id: 'h1', axis: 'x', x: 25.5, y: 1.7, w: 2.4, h: 0.45, baseX: 25.5, amp: 1.5, speed: 1.0, phase: 0 },
    { id: 'v1', x: 48.5, y: 2.4, w: 2.2, h: 0.45, baseY: 2.4, amp: 1.6, speed: 1.1, phase: 1.2 },
  ],
  hazards: [
    { type: 'crusher', x: 12.0, floor: 0.6, w: 1.6, damage: 5, period: 3.4, phase: 0 },
    { type: 'electric', x: 41.0, y: 1.9, w: 1.1, h: 2.2, damage: 4 },
    { type: 'crusher', x: 62.6, floor: 2.0, w: 1.6, damage: 5, period: 3.4, phase: 1.3 },
    pit(14.5, 1),
    pit(25.5, 7),
    pit(38, 2),
    pit(48.5, 5),
    pit(69, 2),
    pit(76.5, 1),
  ],
  terminals: [
    { id: 't1', x: 52.4, y: 4.15 },
    { id: 't2', x: 70.9, y: 2.55 },
  ],
  enemies: [
    hopper(8, 1.05, 5.5, 10.5),
    shield(20.6, 1.9, -1),
    drone(25.5, 5.6),
    walker(34.6, 2.4, 32.2, 36.4),
    turret(35.4, 5.4, -1),
    hopper(44.6, 1.65, 43.2, 46.0),
    drone(48.5, 7.6),
    walker(56.6, 4.0, 54.6, 58.5),
    hopper(66, 2.45, 64.6, 67.6),
    shield(74.6, 2.3, -1),
    drone(73.0, 6.6),
  ],
  pickups: [
    scrap(4.5, 1.7),
    scrap(8.0, 2.6),
    scrap(16.5, 2.4),
    scrap(19.0, 2.4),
    scrap(25.5, 3.4),
    scrap(30.0, 2.6),
    scrap(36.4, 2.6, 2),
    scrap(43.0, 2.4, 2),
    scrap(48.5, 5.4, 2),
    scrap(53.8, 4.4, 2),
    scrap(57.8, 4.4, 2),
    scrap(61.0, 3.2, 2),
    scrap(65.0, 3.2, 2),
    scrap(73.6, 2.6, 2),
    scrap(32.6, 5.6, 2),
    scrap(34.2, 5.6, 2),
    health(33.4, 5.5),
    health(72.2, 2.4),
  ],
  checkpoints: [{ at: 51.6, x: 52.6, y: 4.1, credit: 6, heal: 0.75, text: 'CHECKPOINT // SERVICE CREDIT: 6 SCRAP' }],
  boss: {
    kind: 'arc',
    name: 'ARC REGENT // CAPACITOR CORE',
    warning: 'WARNING // ARC REGENT',
    phase2: 'OVERCHARGE // RAIL DASH',
    defeat: 'ARC REGENT OFFLINE',
    x: 85,
    y: 5.2,
    w: 2.4,
    h: 2.2,
    hp: 40,
    centerX: 84.5,
    trigger: 76.8,
    gateX: 77.1,
    enterX: 78.2,
    respawn: { x: 78, y: 2.4 },
    camX: 84.4,
    camY: 5.0,
    arena: [77, 92],
    floor: 1.6,
  },
  signs: [
    ['MISSION 02 // ARC SPIRE', 5.0, 3.6],
    ['CRUSHER: WATCH THE SHAKE', 12.0, 7.0],
    ['SHIELDS GUARD THE FRONT', 18.5, 4.8],
    ['SERVICE BAY', 52.4, 6.6],
    ['CAPACITOR CORE', 82.0, 8.0],
  ],
  backdrop: { towers: 26, clouds: 20 },
};

export const LEVELS = [FOUNDRY, SPIRE];
