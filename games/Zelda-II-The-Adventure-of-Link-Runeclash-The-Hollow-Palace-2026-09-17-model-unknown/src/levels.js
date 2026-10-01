// Palace layouts. Pure data (no three.js), so the game logic and its tests run in Node.
// Units: 1 = one stair tread. Solids are boxes described by centre x, top and size.

function makeSolid(id, x, top, w, h = 1, kind = 'stone') {
  return { id, x, y: top - h / 2, top, w, h, kind };
}

function makeStepRun(solids, prefix, startX, count, direction, startTop, stepW = 1, stepH = 0.5) {
  for (let i = 0; i < count; i++) {
    const x = startX + direction * (i + 0.5) * stepW;
    const top = startTop + (i + 1) * stepH;
    solids.push(makeSolid(`${prefix}-${i}`, x, top, stepW + 0.04, Math.max(1, top + 1), 'step'));
  }
}

function makeDescent(solids, prefix, firstX, count, firstTop, stepH = 0.5) {
  for (let i = 0; i < count; i++) {
    const top = firstTop - i * stepH;
    solids.push(makeSolid(`${prefix}-${i}`, firstX + i, top, 1.04, Math.max(1, top + 1), 'step'));
  }
}

const brazier = (id, x, top) => ({ id, x, top, y: top + 0.55, w: 0.7, h: 1.1 });

/** Palace one: the original slice, unchanged in layout and balance. */
export function buildHollowPalace() {
  const solids = [];
  solids.push(makeSolid('approach', 10, 0, 20, 1.5, 'ground'));
  makeStepRun(solids, 'rise', 20, 8, 1, 0, 1, 0.5);
  solids.push(makeSolid('upper-gallery', 38, 4, 20, 1.5, 'gallery'));

  // Descending stairs are boxes with lower and lower top surfaces.
  makeDescent(solids, 'fall', 48.5, 8, 3.5);

  solids.push(makeSolid('lower-hall', 77.75, 0, 43.5, 1.5, 'ground'));
  solids.push(makeSolid('gear-step', 70, 2.15, 6.5, 0.28, 'balcony'));
  solids.push(makeSolid('gear-ledge', 78.4, 4.3, 7.5, 0.28, 'balcony'));

  // Long, readable stair climb to the boss catwalk.
  makeStepRun(solids, 'boss-rise', 96, 6, 1, 0, 1, 0.5);
  solids.push(makeSolid('boss-catwalk', 119.5, 3, 35, 1.5, 'boss'));

  // Thin catch floor below the optional ledges prevents frustrating soft falls.
  solids.push(makeSolid('catch-floor', 86, -2.5, 22, 0.8, 'catch'));

  const torchLift = (x) => (x > 24 && x < 50 ? 4 : x > 104 ? 3 : 0);

  return {
    id: 'hollow',
    name: 'The Hollow Palace',
    relic: 'Ember Sigil',
    minX: -1,
    maxX: 138,
    solids,
    boundaries: [
      { id: 'left-bound', x: -1.5, y: 5, w: 1, h: 14, kind: 'wall' },
      { id: 'right-bound', x: 138.5, y: 5, w: 1, h: 14, kind: 'wall' }
    ],
    lock: 'key',
    door: { id: 'sun-door', x: 58.3, y: 2.6, w: 1.25, h: 5.2, kind: 'door', style: 'sun' },
    bossBarrier: { id: 'boss-barrier', x: 104.4, y: 5.7, w: 0.8, h: 5.4, kind: 'barrier' },
    railings: [
      { x: 30, top: 4, w: 3.5 }, { x: 40, top: 4, w: 4 }, { x: 46, top: 4, w: 2 },
      { x: 69.8, top: 2.15, w: 5 }, { x: 78.5, top: 4.3, w: 6 },
      { x: 111, top: 3, w: 6 }, { x: 127, top: 3, w: 7 }
    ],
    columns: [12, 32, 43, 62, 72, 87, 108, 122, 134],
    torches: [6, 28, 45, 64, 85, 101, 113, 129].map((x) => ({ x, y: torchLift(x) })),
    lights: [{ x: 28, y: 6.4 }, { x: 64, y: 2.7 }, { x: 101, y: 2.7 }, { x: 129, y: 5.4 }],
    backdrop: { wallX: 68.5, wallW: 146, towers: [7, 24, 51, 74, 100, 126] },
    atmosphere: { background: 0x120f27, fog: 0x1b1734 },
    signs: [
      { id: 'sign-controls', x: 4.2, y: 0.65, text: 'Carved slate: Guard from the front. Jump attacks are safest when a knight commits.' },
      { id: 'sign-gate', x: 62.2, y: 0.65, text: 'Palace warning: The upper side ledge hides an old forge cache. It is optional.' }
    ],
    keyChest: { id: 'key-chest', x: 43.5, y: 4.45 },
    gearChest: { id: 'gear-chest', x: 79.2, y: 4.75 },
    vesselChest: null,
    braziers: [],
    hazards: [],
    altar: { id: 'altar', x: 133.4, y: 3.8 },
    start: { x: 2.4, y: 0.86, name: 'Palace Approach' },
    checkpoints: [
      { index: 1, trigger: 60.5, needs: 'door', x: 62.5, y: 0.86, name: 'Lower Hall', hp: 18, mana: 14 },
      { index: 2, trigger: 102, needs: 'bossAlive', x: 102.2, y: 3.86, name: 'Warden Gate', full: true }
    ],
    boss: {
      id: 'ash-warden', trigger: 106.2, x: 120, y: 4.33, name: 'ASH WARDEN',
      title: 'ASH WARDEN — Palace Keeper',
      defeatText: 'The Ash Warden falls. The Ember Sigil is awake.'
    },
    text: {
      intro: 'Enter the Hollow Palace. Find the Sun Key.',
      lock: ['Find the Sun Key in the upper gallery', 'Open the sun-locked gate'],
      approach: 'Reach the Ash Warden chamber',
      fight: 'Defeat the Ash Warden',
      claim: 'Claim the Ember Sigil at the altar',
      cleared: 'Hollow Palace cleared'
    },
    parTime: 300,
    spawns: [
      { id: 'blob-a', type: 'blob', x: 8.5, ground: 0, opts: { patrolMin: 6, patrolMax: 12, phase: 0.2 } },
      { id: 'blob-b', type: 'blob', x: 16.0, ground: 0, opts: { patrolMin: 13, patrolMax: 19, phase: 1.1, drop: 'heal' } },
      { id: 'bone-a', type: 'bone', x: 34.5, ground: 4, opts: { patrolMin: 30, patrolMax: 39, phase: 0.7, drop: 'mana' } },
      { id: 'sentinel-a', type: 'sentinel', x: 45.0, ground: 4, opts: { patrolMin: 41, patrolMax: 47, phase: 1.7 } },
      { id: 'blob-c', type: 'blob', x: 65.0, ground: 0, opts: { patrolMin: 61, patrolMax: 69, phase: 2.1 } },
      { id: 'bone-b', type: 'bone', x: 84.5, ground: 0, opts: { patrolMin: 81, patrolMax: 89, phase: 2.8 } },
      { id: 'sentinel-b', type: 'sentinel', x: 92.2, ground: 0, opts: { patrolMin: 89, patrolMax: 95, phase: 3.3, drop: 'heal' } },
      { id: 'ash-warden', type: 'boss', x: 120.0, ground: 3, opts: { patrolMin: 108, patrolMax: 131, phase: 4.1, attackCooldown: 0.8 } }
    ]
  };
}

/**
 * Palace two: the Ember Undercroft. Lava channels, diving wisps, ash casters,
 * three braziers that seal the gate, an optional Vessel of Embers on the high
 * ledges, and the Cinder Golem in the Furnace Heart.
 */
export function buildUndercroft() {
  const solids = [];
  solids.push(makeSolid('u-entry', 9, 0, 18, 1.5, 'ground'));            // 0 … 18
  solids.push(makeSolid('u-ledge', 25.5, 0, 9, 1.5, 'ground'));          // 21 … 30 (lava pit 18 … 21)
  makeStepRun(solids, 'u-rise', 30, 4, 1, 0, 1, 0.5);                    // up to top 2
  solids.push(makeSolid('u-span', 39, 2, 10, 3, 'gallery'));             // 34 … 44
  solids.push(makeSolid('u-pillar', 46, 2.4, 1.2, 3.4, 'step'));         // stepping stone over the lava
  solids.push(makeSolid('u-cistern-a', 51.5, 2, 7, 3, 'gallery'));       // 48 … 55
  solids.push(makeSolid('u-cistern-b', 60.1, 2, 7.8, 3, 'gallery'));     // 56.2 … 64 (lava channel between)
  makeDescent(solids, 'u-fall', 64.5, 3, 1.5);                           // down to the forge floor
  solids.push(makeSolid('u-forge', 83.5, 0, 33, 1.5, 'ground'));         // 67 … 100
  solids.push(makeSolid('u-brazier-ledge', 74, 2.15, 6.5, 0.28, 'balcony'));
  solids.push(makeSolid('u-vessel-ledge', 82.4, 4.3, 7.5, 0.28, 'balcony'));
  makeStepRun(solids, 'u-furnace-rise', 100, 6, 1, 0, 1, 0.5);           // up to top 3
  solids.push(makeSolid('u-furnace', 123.5, 3, 35, 1.5, 'boss'));        // 106 … 141

  return {
    id: 'undercroft',
    name: 'The Ember Undercroft',
    relic: 'Ember Crown',
    minX: -1,
    maxX: 142,
    solids,
    boundaries: [
      { id: 'left-bound', x: -1.5, y: 5, w: 1, h: 14, kind: 'wall' },
      { id: 'right-bound', x: 142.5, y: 5, w: 1, h: 14, kind: 'wall' }
    ],
    lock: 'braziers',
    door: { id: 'ember-gate', x: 96.5, y: 2.6, w: 1.25, h: 5.2, kind: 'door', style: 'ember' },
    bossBarrier: { id: 'furnace-barrier', x: 108.4, y: 5.7, w: 0.8, h: 5.4, kind: 'barrier' },
    railings: [
      { x: 39, top: 2, w: 6 }, { x: 60.5, top: 2, w: 5 },
      { x: 74, top: 2.15, w: 5 }, { x: 82.4, top: 4.3, w: 6 },
      { x: 116, top: 3, w: 6 }, { x: 131, top: 3, w: 7 }
    ],
    columns: [10, 26, 40, 52, 70, 88, 112, 126, 138],
    torches: [
      { x: 6, y: 0 }, { x: 24, y: 0 }, { x: 41, y: 2 }, { x: 59, y: 2 },
      { x: 80, y: 0 }, { x: 92, y: 0 }, { x: 115, y: 3 }, { x: 133, y: 3 }
    ],
    lights: [{ x: 19.5, y: 1.6 }, { x: 55.6, y: 3.6 }, { x: 84, y: 2.7 }, { x: 124, y: 5.4 }],
    backdrop: { wallX: 70.5, wallW: 150, towers: [8, 30, 54, 78, 104, 130] },
    atmosphere: { background: 0x170d22, fog: 0x2a1530 },
    signs: [
      { id: 'sign-cinder', x: 3.6, y: 0.65, text: 'Cinder slate: Lava sears but will not end you outright. Wisps circle high, then dive. Guard or strike as they fall.' },
      { id: 'sign-braziers', x: 68.6, y: 0.65, text: 'Gatewright slate: Three cinder braziers hold the Ember Gate shut. Strike them with your blade or with Spark.' }
    ],
    keyChest: null,
    gearChest: null,
    vesselChest: { id: 'vessel-chest', x: 83.2, y: 4.75 },
    braziers: [brazier('brazier-span', 37.5, 2), brazier('brazier-cistern', 62.5, 2), brazier('brazier-ledge', 75.6, 2.15)],
    hazards: [
      { id: 'lava-pit', x: 19.5, y: -1.5, w: 3, h: 1.8, returnX: 16.6, returnY: 0.86 },
      { id: 'lava-moat', x: 46, y: -0.5, w: 4, h: 1.4, returnX: 42.6, returnY: 2.86 },
      { id: 'lava-channel', x: 55.6, y: -0.5, w: 1.2, h: 1.4, returnX: 53.8, returnY: 2.86 }
    ],
    altar: { id: 'altar', x: 137.4, y: 3.8 },
    start: { x: 2.4, y: 0.86, name: 'Undercroft Stair' },
    checkpoints: [
      { index: 1, trigger: 48.5, x: 49.6, y: 2.86, name: 'Cistern Walk', hp: 14, mana: 10 },
      { index: 2, trigger: 68, x: 68.2, y: 0.86, name: 'Forge Floor', hp: 18, mana: 14 },
      { index: 3, trigger: 106.2, needs: 'bossAlive', x: 106.6, y: 3.86, name: 'Furnace Gate', full: true }
    ],
    boss: {
      id: 'cinder-golem', trigger: 110.4, x: 124, y: 4.45, name: 'CINDER GOLEM',
      title: 'CINDER GOLEM — Heart of the Furnace',
      defeatText: 'The Cinder Golem cracks apart. The Ember Crown wakes on the altar.'
    },
    text: {
      intro: 'The Ember Undercroft. Light the three braziers to open the Ember Gate.',
      lock: ['Light the cinder braziers (0/3)', 'Light the cinder braziers (1/3)', 'Light the cinder braziers (2/3)', 'Light the cinder braziers (3/3)'],
      approach: 'Descend to the Furnace Heart',
      fight: 'Defeat the Cinder Golem',
      claim: 'Claim the Ember Crown at the altar',
      cleared: 'Ember Undercroft cleared'
    },
    parTime: 360,
    spawns: [
      { id: 'blob-u1', type: 'blob', x: 11, ground: 0, opts: { patrolMin: 6, patrolMax: 15, phase: 0.4 } },
      { id: 'wisp-u1', type: 'wisp', x: 26, ground: 0, opts: { anchorY: 3.2, patrolMin: 21.5, patrolMax: 30, phase: 0.9 } },
      { id: 'caster-u1', type: 'caster', x: 43, ground: 2, opts: { phase: 1.3 } },
      { id: 'wisp-u2', type: 'wisp', x: 51, ground: 2, opts: { anchorY: 4.7, patrolMin: 48.5, patrolMax: 56, phase: 2.2, drop: 'mana' } },
      { id: 'bone-u1', type: 'bone', x: 60, ground: 2, opts: { patrolMin: 57.5, patrolMax: 63, phase: 2.6 } },
      { id: 'wisp-u3', type: 'wisp', x: 73, ground: 0, opts: { anchorY: 3.1, patrolMin: 68.5, patrolMax: 79, phase: 3.1 } },
      { id: 'blob-u2', type: 'blob', x: 86, ground: 0, opts: { patrolMin: 79.5, patrolMax: 90, phase: 3.7, drop: 'heal' } },
      { id: 'sentinel-u1', type: 'sentinel', x: 90.5, ground: 0, opts: { patrolMin: 86, patrolMax: 93.5, phase: 4.4 } },
      { id: 'caster-u2', type: 'caster', x: 94.4, ground: 0, opts: { phase: 0.6, drop: 'heal' } },
      { id: 'cinder-golem', type: 'golem', x: 124, ground: 3, opts: { patrolMin: 109, patrolMax: 140, phase: 0, attackCooldown: 1.1 } }
    ]
  };
}

export const PALACE_ORDER = ['hollow', 'undercroft'];

export function buildLevel(id = 'hollow') {
  return id === 'undercroft' ? buildUndercroft() : buildHollowPalace();
}
