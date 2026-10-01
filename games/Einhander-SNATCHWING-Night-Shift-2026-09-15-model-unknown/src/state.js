// Shared game state and the tables the simulation, the effects and the menus all read.

import { C } from './util.js';

/** Logical width of the effects and text layers (the old overlay canvas), in pixels. */
export const W = 1280;
/** Vertical field of view, degrees (the old perspective matrix). */
export const FOV = 41;

export const POD = {
  RIVET: { ammo: 300, color: C.amber, note: 'rapid fire' },
  RAIL: { ammo: 90, color: C.cyan, note: 'armor piercing' },
  SWARM: { ammo: 90, color: C.purple, note: 'guided missiles' },
  SCATTER: { ammo: 140, color: C.lime, note: 'short-range spread' },
};

/**
 * Flight modes. Assist is the original's (more hull, slower enemy fire); Veteran is new:
 * less hull, faster and more frequent enemy fire, and a score bonus for the trouble.
 */
export const DIFFICULTY = {
  arcade: { label: 'ARCADE', hull: 4, bullet: 1, cooldown: 1, score: 1 },
  assist: { label: 'ASSIST', hull: 6, bullet: 0.77, cooldown: 1, score: 1 },
  veteran: { label: 'VETERAN', hull: 3, bullet: 1.12, cooldown: 0.85, score: 1.25 },
};

/** The two raids. Each has three sectors that start at fixed points on the stage clock. */
export const ROUTES = [
  {
    id: 'city',
    name: 'THE LOWER CITY',
    short: 'LOWER CITY',
    sectors: ['THE LOWER CITY', 'THE FREIGHT LINE', 'THE LAST CHECKPOINT'],
    sectorTimes: [0, 42, 82],
    intro: ['THE LOWER CITY', 'SECTOR 01', 'GET IN. TAKE WHAT YOU NEED.'],
    fog: [[0.035, 0.066, 0.097], [0.046, 0.071, 0.081], [0.035, 0.066, 0.097]],
    bestKey: 'best',
    rankKey: 'rank',
    win: ['NIGHT SHIFT. OVER.', 'The checkpoint is down. Keep the weapons.'],
  },
  {
    id: 'harbor',
    name: 'THE HARBOR LINE',
    short: 'HARBOR LINE',
    sectors: ['THE HARBOR LINE', 'THE BREAKWATER', 'THE CHANNEL GATE'],
    sectorTimes: [0, 42, 82],
    intro: ['THE HARBOR LINE', 'SECTOR 01', 'LOW AND FAST. NO COVER OVER WATER.'],
    fog: [[0.03, 0.07, 0.086], [0.05, 0.068, 0.074], [0.03, 0.062, 0.088]],
    bestKey: 'best.harbor',
    rankKey: 'rank.harbor',
    win: ['TIDE TURNED.', 'The channel is open. The dredge went down with its toll.'],
  },
];

/** Everything that changes while the game runs. One object, so every module sees the same values. */
export const S = {
  mode: 'menu', // menu | play | pause | manual | result
  manualBack: 'menu',
  route: 0,
  difficulty: 'arcade',
  // view
  H: 720,
  aspect: 16 / 9,
  camDist: 33.5,
  // run
  stageTime: 0,
  elapsed: 0,
  stage: 0,
  score: 0,
  kills: 0,
  chainHits: 0,
  chainLevel: 1,
  maxChain: 1,
  chainTimer: 0,
  energy: 100,
  hitsTaken: 0,
  podsTaken: 0,
  enemyId: 0,
  continues: 0,
  enemies: [],
  shots: [],
  bullets: [],
  pickups: [],
  particles: [],
  rings: [],
  floats: [],
  tethers: [],
  delays: [],
  events: [],
  eventIndex: 0,
  boss: null,
  // feel
  shake: 0,
  flash: 0,
  pulseFlash: 0,
  deathWait: 0,
  winWait: 0,
  cityClock: 0,
  menuTime: 0,
  // scene objects (set by main.js)
  player: null,
  playerNode: null,
  actors: null,
  // this frame's controls (set by main.js from kit.input)
  ctl: { x: 0, y: 0, fire: false, focus: false, mouse: false, mx: 0, my: 0 },
  // menus and HUD hooks (set by main.js)
  ui: null,
  testGod: false,
};
