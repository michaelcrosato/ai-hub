// Mission layouts. Plain data: game.js builds the world, collision and spawns from it,
// and test/*.mjs checks the balance under Node.
//
// bridges: stairs up from x0 to x1, a deck from x1 to x2 at height `top`, stairs down to x3.
//   solid: the deck is a cliff block (no walking underneath); rails: railings along the deck.
// creeks: water from x1 to x2; the ranger wades at `slow` speed between slow1 and slow2.
// perches: [x, z, top] stone pillars (sniper nests)   towers: [x, z, height] watchtowers (scenery)
// signs: [text, x, z, rotY]   checkpoints: respawn at x once the ranger passes `at`.
// enemies: [type, x, y, z]   pickups: [type, x, y, z]
// objectives: stage 0 shows first; each later stage starts when the player passes `at`.
//   The boss wakes at bossAt once the last stage is reached; beating it opens the gate.
// par: seconds for an S rank (with no deaths).

export const MISSIONS = [
  {
    id: 'jungle',
    code: 'OPERATION 01 // JUNGLE FRONT',
    name: 'JUNGLE BREAKER',
    short: 'Jungle Front',
    blurb: 'Break through the emerald perimeter, climb the old bridge, crack the bunker core, and reach extraction.',
    completeTitle: 'BUNKER BROKEN',
    env: { sky: 0x07150f, fog: 0.027, hemiSky: 0x8bd6a1, hemiGround: 0x142213, hemi: 1.55, sun: 0xfff0c2, sunI: 3.4, fill: 0x4d8d72, fillI: 0.65 },
    start: 2,
    maxX: 116.2,
    groundFrom: -4,
    groundTo: 120,
    creeks: [{ x1: 54.5, x2: 69.5, slow1: 55, slow2: 68, slow: 0.83, stones: 8, stoneX: 56, flow: false }],
    bridges: [{ x0: 30, x1: 34.1, x2: 54.0, x3: 58, top: 3, z: -2.05, w: 2.35, mat: 'wood', rails: true }],
    outposts: [[20, 1.7], [72, -1.5]],
    perches: [],
    towers: [],
    waterfall: null,
    gate: { x: 101, style: 'bunker' },
    signs: [['UPPER ROUTE', 27.5, -1.9, -0.08], ['CREEK // 40m', 50, 2.35, 0.03], ['BUNKER', 83, -2.3, 0.06], ['EXFIL', 108, 2.25, -0.04]],
    checkpoints: [{ x: 42, at: 43 }, { x: 76, at: 77 }, { x: 90, at: 89 }],
    pad: 113,
    finishAt: 111.2,
    objectives: [
      { text: 'Reach the first outpost' },
      { at: 24, text: 'Choose bridge or ground route', toast: 'ROUTE SPLIT // BRIDGE OR GROUND' },
      { at: 58, text: 'Cross the creek line' },
      { at: 78, text: 'Destroy the bunker core' }
    ],
    extractText: 'Reach extraction',
    startToast: 'MOVE RIGHT // BREAK THE LINE',
    bossAt: 88,
    bossName: 'BUNKER CORE',
    bossToast: 'BUNKER CORE // DESTROY IT',
    bossDownToast: 'CORE DOWN // EXTRACTION OPEN',
    par: 150,
    enemies: [
      ['grunt', 12, 0, 0], ['grunt', 17, 0, -1.5], ['turret', 25, 0, 1.6],
      ['grunt', 37, 3, -2.0], ['grunt', 43, 0, 1.5], ['drone', 50, 3.2, 0.2],
      ['grunt', 61, 0, -1.8], ['grunt', 66, 0, 1.4], ['turret', 72, 0, -1.5],
      ['drone', 79, 3.1, 0], ['grunt', 82, 0, 1.7], ['grunt', 87, 0, -1.3],
      ['turret', 92, 0, 1.4], ['grunt', 95, 0, -1.6], ['boss', 99.7, 1.55, 0]
    ],
    pickups: [
      ['weapon', 38.5, 3.35, -2.0], ['armor', 47, 0.55, 1.7], ['health', 69, 0.55, -1.8], ['grenade', 84, 0.55, 1.5],
      // Intel drives: off the main line, for players who look around.
      ['intel', 46, 0.55, -2.3], ['intel', 66.5, 0.5, -3.0], ['intel', 93.5, 1.75, -2.9]
    ],
    trees: { seed: 17031, count: 72, gap: null }
  },
  {
    id: 'falls',
    code: 'OPERATION 02 // RIFT FALLS',
    name: 'RIFT FALLS',
    short: 'Rift Falls',
    blurb: 'Take the cliff ledge, cross the shelled river under the falls, clear the relay compound and bring down the Rift Walker.',
    completeTitle: 'WALKER DOWN',
    env: { sky: 0x0b1a1c, fog: 0.024, hemiSky: 0x9ad3c4, hemiGround: 0x191a12, hemi: 1.45, sun: 0xffc98a, sunI: 3.1, fill: 0x5a7fa0, fillI: 0.8 },
    start: 2,
    maxX: 138.2,
    groundFrom: -4,
    groundTo: 144,
    creeks: [{ x1: 50, x2: 72, slow1: 51, slow2: 71, slow: 0.8, stones: 10, stoneX: 51.5, flow: true }],
    bridges: [
      { x0: 22, x1: 26, x2: 42, x3: 45.5, top: 2.4, z: -2.1, w: 2.3, mat: 'stone', solid: true },
      { x0: 86, x1: 89, x2: 97, x3: 100, top: 3, z: -2.1, w: 2.3, mat: 'wood', rails: true }
    ],
    outposts: [[16, -1.6], [82, 1.6]],
    perches: [[68, -3.3, 2.2]],
    towers: [[88, -4.6, 7.5], [99, -4.6, 6.5]],
    waterfall: { x: 61, w: 12, h: 13, z: -9.2 },
    gate: { x: 128, style: 'arch' },
    signs: [['RIFT FALLS', 7, -2.3, 0.05], ['CLIFF LEDGE', 20.3, -2.3, -0.06], ['SHELL ZONE', 44.8, 2.35, 0.04], ['RELAY', 79, -2.35, 0.05], ['WALKER PEN', 106.2, 2.3, -0.05], ['EXFIL', 131, 2.25, -0.04]],
    checkpoints: [{ x: 24, at: 25 }, { x: 47, at: 48 }, { x: 78, at: 79 }, { x: 103, at: 104 }],
    pad: 135,
    finishAt: 133.2,
    objectives: [
      { text: 'Secure the landing zone' },
      { at: 20, text: 'Take the cliff ledge or the gully', toast: 'CLIFF LEDGE // SNIPERS ABOVE' },
      { at: 48, text: 'Cross the river under fire', toast: 'SHELL ZONE // KEEP MOVING' },
      { at: 79, text: 'Clear the relay compound' },
      { at: 101, text: 'Bring down the Rift Walker' }
    ],
    extractText: 'Reach extraction',
    startToast: 'NEW GROUND // PUSH TO THE FALLS',
    bossAt: 107,
    bossName: 'RIFT WALKER',
    bossToast: 'RIFT WALKER // WATCH THE STOMP',
    bossDownToast: 'WALKER DOWN // GATE OPEN',
    par: 200,
    enemies: [
      ['grunt', 11, 0, 1.2], ['grunt', 18.5, 0, 1.0], ['turret', 21.5, 0, 1.9],
      ['grunt', 27.5, 0, 1.4], ['grunt', 30.5, 2.4, -2.0], ['drone', 34, 3.4, 0.9],
      ['sniper', 38.5, 2.4, -2.5], ['mortar', 41.5, 0, 2.3],
      ['drone', 56, 3.2, 0.2], ['drone', 65, 3.0, -0.6], ['sniper', 68, 2.2, -3.3],
      ['grunt', 70.5, 0, 1.3], ['mortar', 75, 0, -2.5],
      ['grunt', 84.8, 0, 0.1], ['turret', 90.5, 0, 1.6], ['grunt', 91, 3, -1.9],
      ['sniper', 95.5, 3, -2.4], ['grunt', 97.5, 0, 1.3], ['drone', 101, 3.3, 0],
      ['walker', 119, 0, 0]
    ],
    pickups: [
      ['armor', 29, 0.55, 2.3], ['spread', 40.5, 2.95, -2.1], ['grenade', 60, 0.55, 2.5],
      ['health', 88, 0.55, 2.6], ['weapon', 94, 3.35, -2.0], ['grenade', 105, 0.55, -2.2],
      ['intel', 34.5, 0.55, -0.55], ['intel', 63, 1.75, -2.9], ['intel', 93, 0.55, -2.4]
    ],
    trees: { seed: 90210, count: 84, gap: [53, 69] }
  }
];
