import { random } from '../core/numeric.js';
import { defaultMotor } from '../kits/fps/Motor.js';
import { createPrefabs } from '../kits/fps/Prefabs.js';

/**
 * Chapter 04 / Ridge Relay. The last leg of Northbound, built only from the FPS kit's prefabs and its
 * signal components, including the counter, relay and logic nodes no other chapter uses:
 *   three signal cells  -> counter (3)            -> 'power'  (compound door opens, the lift runs)
 *   uplink switch       -> relay (2.5 s delay)    -> 'uplink' (bunker doors open: an ambush)
 *   all four sentries down                        -> 'sentries-clear'
 *   power + uplink + sentries-clear -> logic (all) -> 'relay-online' (the relay gate accepts the player)
 * North is -Z. Every object is an ordinary editable entity in the workbench.
 */
export function relayLevel() {
  const prefabs = createPrefabs(),
    entities = [];
  const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
    const e = Object.assign(prefabs.create(prefab, position, id), { scale }, extra);
    entities.push(e);
    return e;
  };
  const stone = '#c9bf9f',
    wall = '#9aa284',
    dark = '#57654f';

  // Ground: a dry ridge-top plateau.
  add('block', 'ridge', [0, -1.9, 0], [37, 1.8, 44], { name: 'Ridge · foundation', color: '#6c7a66' });
  add('block', 'ridge-floor', [0, -0.16, 0], [36.7, 0.16, 43.7], { name: 'Ridge · floor', color: '#b3ad8c' });
  for (let i = 0; i < 5; i++) add('block', `path-${i}`, [0, 0, 14 - i * 2.35], [2.5, 0.07, 1.95], { name: `Path slab ${i + 1}`, color: '#d8cfb1' });

  // Start.
  add('spawn', 'player-start', [0, 0.05, 19]);
  add('checkpoint', 'start-checkpoint', [0, 0.03, 16.5]);
  add('health', 'health-start', [-3, 0.1, 15]);
  add('ammo', 'ammo-start', [3, 0.1, 15]);

  // Logic nodes: invisible in play, visible (and editable) in the workbench.
  add('trigger', 'cell-counter', [-3.5, 0, 5], [1, 1, 1], {
    name: 'Logic · cell counter',
    components: [{ type: 'counter', channel: 'cell', count: 3, output: 'power', label: 'Cells' }],
  });
  add('trigger', 'uplink-relay', [3.5, 0, 5], [1, 1, 1], {
    name: 'Logic · uplink relay',
    components: [{ type: 'relay', channel: 'uplink-switch', output: 'uplink', delay: 2.5 }],
  });
  add('trigger', 'relay-logic', [0, 0, -21], [1, 1, 1], {
    name: 'Logic · relay online',
    components: [{ type: 'logic', inputs: ['power', 'uplink', 'sentries-clear'], mode: 'all', output: 'relay-online' }],
  });

  // West: cell one across the high-voltage field. Stepping stones stand clear of the charge.
  for (const [col, x] of [-15.6, -12.8, -10].entries())
    for (const [row, z] of [13.2, 10.4, 7.6, 4.8].entries())
      add('hazard', `voltage-${col}-${row}`, [x, 0.02, z], [1.4, 1, 1.4], { name: 'High-voltage field' });
  // The path winds from the south-east corner round to the plinth in the middle of the field.
  [
    [-10, 13.4],
    [-12.2, 12.6],
    [-14.6, 11.6],
    [-15.2, 9.2],
  ].forEach(([x, z], i) => add('block', `stone-${i}`, [x, 0, z], [1.2, 0.65, 1.2], { name: `Stepping stone ${i + 1}`, color: stone }));
  add('block', 'cell-stone', [-12.8, 0, 8.4], [1.6, 0.65, 1.6], { name: 'Cell plinth / west', color: '#ddd3b3' });
  add('pickup', 'cell-west', [-12.8, 0.65, 8.4], [1, 1, 1], { name: 'Cell · voltage field' });
  add('checkpoint', 'west-checkpoint', [-6.5, 0.03, 9]);

  // East: cell two on a ledge, reached from a jump pad.
  add('pad', 'east-pad', [12.5, 0, 11]);
  add('block', 'east-ledge', [12.5, 3, 6.8], [4, 0.3, 3.4], { name: 'East ledge', color: '#a9ae90' });
  add('block', 'ledge-leg-a', [10.8, 0, 6], [0.5, 3, 0.5], { name: 'Ledge support', color: dark });
  add('block', 'ledge-leg-b', [14.2, 0, 6], [0.5, 3, 0.5], { name: 'Ledge support', color: dark });
  add('pickup', 'cell-east', [12.5, 3.3, 6.2], [1, 1, 1], { name: 'Cell · east ledge' });
  add('crate', 'crate-0', [8.8, 0.08, 4], [1, 1, 1], { name: 'Physics crate 1', color: '#b2aa77' });
  add('crate', 'crate-1', [10.1, 0.08, 4.5], [1, 1, 1], { name: 'Physics crate 2', color: '#b2aa77' });

  // The relay compound: the door opens on power; inside, the lift (also on power) reaches the uplink deck.
  add('block', 'compound-sw', [-4.55, 0, 2], [5.6, 5, 0.7], { name: 'Compound wall / south-west', color: wall });
  add('block', 'compound-se', [4.55, 0, 2], [5.6, 5, 0.7], { name: 'Compound wall / south-east', color: wall });
  add('block', 'compound-w', [-7, 0, -4.15], [0.7, 5, 12.3], { name: 'Compound wall / west', color: '#8d977a' });
  add('block', 'compound-e', [7, 0, -4.15], [0.7, 5, 12.3], { name: 'Compound wall / east', color: '#8d977a' });
  add('block', 'compound-n', [0, 0, -10], [14.7, 5, 0.7], { name: 'Compound wall / north', color: '#8d977a' });
  add('door', 'power-door', [0, 0, 2], [1.3, 1.65, 1], {
    name: 'Compound door',
    components: [{ type: 'door', channel: 'power', axis: 'y', distance: 3.6, speed: 2 }],
  });
  add('checkpoint', 'compound-checkpoint', [0, 0.03, 0], [1, 1, 1], { components: [{ type: 'checkpoint', message: 'Checkpoint saved. Ride the lift.' }] });
  add('health', 'health-compound', [-5.5, 0.1, -1]);
  add('ammo', 'ammo-compound', [5.5, 0.1, -1]);
  add('column', 'mast', [-2, 0, -5], [1.4, 2.2, 1.4], { name: 'Relay mast', color: '#c3c7a8' });
  add('block', 'mast-antenna', [-2, 6.93, -5], [0.35, 3, 0.35], { name: 'Mast antenna', color: dark });
  add('block', 'mast-arm', [-2, 8.6, -5], [3.2, 0.18, 0.18], { name: 'Mast cross arm', color: dark });
  add('block', 'uplink-deck', [-2, 3.85, -5], [5, 0.3, 5], { name: 'Uplink deck', color: '#b9bd9c' });
  for (const [i, x, z] of [
    [0, -4.2, -7.2],
    [1, 0.2, -7.2],
    [2, -4.2, -2.8],
    [3, 0.2, -2.8],
  ])
    add('block', `deck-leg-${i}`, [x, 0, z], [0.4, 3.85, 0.4], { name: 'Deck support', color: dark });
  add('platform', 'relay-lift', [2.2, 0, -5], [1, 1, 1], {
    name: 'Relay lift',
    components: [{ type: 'mover', channel: 'power', axis: 'y', distance: 3.85, period: 7 }],
  });
  add('switch', 'uplink-switch', [-3.6, 4.15, -6.6], [1, 1, 1], {
    name: 'Uplink switch',
    color: '#e5a96f',
    components: [{ type: 'switch', channel: 'uplink-switch', label: 'uplink' }],
  });

  // The north yard: two sentries on patrol, the third cell, and the relay gate.
  add('block', 'cover-a', [-5, 0, -13], [2.4, 1.3, 1], { name: 'Cover / north-west', color: '#a5aa8a' });
  add('block', 'cover-b', [5.5, 0, -17.5], [2.4, 1.3, 1], { name: 'Cover / north-east', color: '#a5aa8a' });
  add('block', 'cell-plinth', [0, 0, -13.2], [1.8, 0.5, 1.8], { name: 'Cell plinth / north', color: '#ddd3b3' });
  add('pickup', 'cell-north', [0, 0.5, -13.2], [1, 1, 1], { name: 'Cell · sentry yard' });
  add('goal', 'relay-gate', [0, 0, -19.5], [1, 1, 1], {
    name: 'Relay gate',
    components: [{ type: 'goal', channel: 'relay-online', requiresSignal: true, message: 'Relay online. The north road is signalled.' }],
  });
  const sentry = (id, name, pos) => add('enemy', id, pos, [1, 1, 1], { name, components: [{ type: 'enemy', health: 78, speed: 1.6, range: 20, damage: 7 }] });
  sentry('sentry-1', 'Sentry / yard west', [-4, 0.03, -16]);
  sentry('sentry-2', 'Sentry / yard east', [4.5, 0.03, -14.5]);

  // Bunkers on both flanks of the yard. Their doors open on the delayed uplink signal: an ambush.
  for (const side of [-1, 1]) {
    const x = side * 11,
      tag = side < 0 ? 'west' : 'east';
    add('block', `bunker-${tag}-back`, [x, 0, -18.2], [4.5, 3.2, 0.5], { name: `Bunker ${tag} / back`, color: wall });
    add('block', `bunker-${tag}-side-a`, [x - 2, 0, -16.05], [0.5, 3.2, 4.8], { name: `Bunker ${tag} / side`, color: wall });
    add('block', `bunker-${tag}-side-b`, [x + 2, 0, -16.05], [0.5, 3.2, 4.8], { name: `Bunker ${tag} / side`, color: wall });
    add('block', `bunker-${tag}-post-a`, [x - 1.65, 0, -13.9], [0.6, 3.2, 0.5], { name: `Bunker ${tag} / post`, color: dark });
    add('block', `bunker-${tag}-post-b`, [x + 1.65, 0, -13.9], [0.6, 3.2, 0.5], { name: `Bunker ${tag} / post`, color: dark });
    add('door', `bunker-${tag}-door`, [x, 0, -13.9], [1, 1.07, 1], {
      name: `Bunker ${tag} / door`,
      color: '#4a5747',
      components: [{ type: 'door', channel: 'uplink', axis: 'y', distance: 3.6, speed: 1.6 }],
    });
    sentry(`sentry-${side < 0 ? 3 : 4}`, `Sentry / bunker ${tag}`, [x, 0.03, -16.3]);
  }
  add('health', 'health-north', [15, 0.1, -8]);
  add('ammo', 'ammo-north', [-15, 0.1, -8]);

  // The ridge edge: boundary stones, wind-bent trees and rocks.
  for (let i = 0; i < 9; i++) {
    add('block', `edge-south-${i}`, [-15 + i * 3.75, -0.1, 21.4], [3.55, 0.48, 0.45], { color: '#a8a68e', name: 'Boundary stone' });
    add('block', `edge-north-${i}`, [-15 + i * 3.75, -0.1, -21.4], [3.55, 0.48, 0.45], { color: '#a8a68e', name: 'Boundary stone' });
  }
  const rng = random(71);
  [
    [-16, 0, 18],
    [16, 0, 18],
    [-16.5, 0, -3],
    [16.5, 0, -1.5],
    [-16.5, 0, -19.5],
    [16.5, 0, -19.5],
    [-9, 0, 19.5],
    [8.5, 0, 19],
  ].forEach((pos, i) => {
    const size = 0.8 + rng() * 0.4;
    add('tree', `tree-${i}`, pos, [size, size * 1.1, size], { rotation: [0, rng() * 360, 0], color: i % 2 ? '#6e8257' : '#7d8a5a' });
  });
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? -1 : 1,
      size = 0.4 + rng() * 0.6;
    add('rock', `rock-${i}`, [side * (16.4 + rng() * 1.4), 0, -18 + rng() * 34], [size, size, size], { rotation: [0, rng() * 360, 0], color: '#9a9a84' });
  }

  return {
    version: 1,
    name: 'Ridge Relay',
    description: 'The last leg of Northbound. Power the relay, raise the uplink and clear the ridge.',
    objective: 'Bring the ridge relay online.',
    seed: 71,
    environment: { sky: '#cbc6ad', fog: 0.0095, sun: 2.8, exposure: 1.05, backdrop: true },
    player: { ...defaultMotor, headBob: 0.3 },
    mission: {
      clearSignal: 'sentries-clear',
      clearFlag: 'relaySentriesCleared',
      clearMessage: 'All ridge sentries disabled.',
      detail: 'Power, uplink, and a clear ridge bring the relay online.',
      stages: [
        { signal: 'power', text: 'Recover the signal cells.', detail: 'West: the voltage field. East: the jump-pad ledge. North: the sentry yard.' },
        { signal: 'uplink', text: 'Ride the lift. Throw the uplink.', detail: 'The compound door is open. The lift runs while the relay has power.' },
        { signal: 'sentries-clear', text: 'Disable the sentries.', detail: 'The uplink opened the flank bunkers.' },
        { text: 'Step through the relay gate.', detail: 'The relay is online. The gate is at the north edge of the ridge.' },
      ],
      notices: {
        power: 'Relay powered. The compound door is open and the lift is running.',
        uplink: 'Uplink established. The bunker doors are opening.',
        'relay-online': 'Relay online. Step through the gate.',
      },
    },
    entities,
  };
}
