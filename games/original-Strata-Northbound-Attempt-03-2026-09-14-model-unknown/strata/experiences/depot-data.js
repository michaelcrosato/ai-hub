import { createPrefabs } from '../kits/fps/Prefabs.js';
import { defaultMotor } from '../kits/fps/Motor.js';

/**
 * Chapter 04, Northbound Depot: the end of the line. Two breakers (one behind a card reader, one in a
 * guarded freight shed) power the gantry that carries the player over the electrified rail cutting.
 * Stepping into the platform yard opens two containers (an ambush) after a short relay delay. With
 * every sentry down and the northbound points set, the line logic turns the signal green and opens
 * the train door; the berth in car 03 ends the run.
 *
 * Built only from the FPS kit's prefabs and components (the depot prefabs live in Prefabs.js).
 * Coordinates: metres, Y up, north is -Z. Floors are flush at y = 0.02; the cutting bed is at -1.5.
 */
export function depotData() {
  const p = createPrefabs(),
    entities = [];
  const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
    const e = Object.assign(p.create(prefab, position, id), { scale }, extra);
    entities.push(e);
    return e;
  };
  const block = (id, name, position, scale, color) => add('block', id, position, scale, { name, color });
  const sentry = (id, name, position, tuning) =>
    add('enemy', id, position, [1, 1, 1], { name, components: [{ type: 'enemy', health: 78, speed: 1.6, range: 20, damage: 7, ...tuning }] });

  // ---- Ground: the arrival yard (south), the electrified cutting, the platform yard (north). Each
  // yard has a dock pit at the cutting where the gantry deck parks flush with the floor, so a player
  // standing on the parked deck rides it (a deck that slid over the floor would slip under their feet).
  const gravel = '#bdb697';
  for (const [side, name, main, depth, dock] of [
    ['south', 'Arrival yard', 17.3, 17.4, 6.8], // main floor z 8.6..26, dock strip z 5..8.6
    ['north', 'Platform yard', -17.3, 19.4, -5.8], // main floor z -27..-7.6, dock strip z -7.6..-4
  ]) {
    block(`ground-${side}`, name, [0, -2.1, main], [38, 2.12, depth], gravel);
    block(`ground-${side}-west`, name, [-10.4, -2.1, dock], [17.2, 2.12, 3.6], gravel);
    block(`ground-${side}-east`, name, [10.4, -2.1, dock], [17.2, 2.12, 3.6], gravel);
    block(`dock-pit-${side}`, 'Gantry dock pit', [0, -2.1, dock], [3.6, 1.8, 3.6], '#6d6656');
  }
  block('cutting-bed', 'Rail cutting / ballast', [0, -2.1, 0.5], [38, 0.6, 9], '#5d564a');
  add('live-bed', 'live-rails', [0, -1.5, 0.5], [38, 1, 9], { name: 'Live rail bed' });
  for (const z of [2.6, -1.6])
    [-14.25, -4.75, 4.75, 14.25].forEach((x, i) => add('live-track', `live-track-${z}-${i}`, [x, -1.5, z], [0.95, 1, 1], { name: 'Live track' }));

  // ---- Perimeter.
  block('wall-west', 'Perimeter wall / west', [-18.9, -2.1, -0.5], [0.6, 5.1, 53.4], '#a4ac8c');
  block('wall-east', 'Perimeter wall / east', [18.9, -2.1, -0.5], [0.6, 5.1, 53.4], '#a4ac8c');
  block('wall-south', 'Perimeter wall / south', [0, -2.1, 26.2], [38.4, 5.1, 0.6], '#a4ac8c');
  block('wall-north', 'Perimeter wall / north', [0, -2.1, -27.2], [38.4, 5.1, 0.6], '#8d9f7d');
  for (const x of [-18.8, 18.8]) for (const z of [-21, -11, 12, 21]) block(`pier-${x}-${z}`, 'Wall pier', [x, 0.02, z], [1, 3.6, 1], '#667e62');

  // ---- The cutting: safety rails with a gap where the gantry docks, and the gantry itself.
  for (const [side, z] of [
    ['south', 5.3],
    ['north', -4.3],
  ])
    for (const [k, x] of [
      ['west', -10.45],
      ['east', 10.45],
    ])
      block(`rail-${side}-${k}`, 'Safety rail', [x, 0.02, z], [16.3, 1, 0.18], '#d1c48a');
  for (const x of [-2.6, 2.6]) {
    for (const z of [6.6, -5.6]) block(`gantry-leg-${x}-${z}`, 'Gantry leg', [x, 0.02, z], [0.35, 5, 0.35], '#4f6a55');
    block(`gantry-rail-${x}`, 'Gantry rail', [x, 5.02, 0.5], [0.3, 0.35, 12.6], '#3d5544');
  }
  for (const z of [6.6, -5.6]) block(`gantry-beam-${z}`, 'Gantry beam', [0, 5.02, z], [5.55, 0.35, 0.3], '#3d5544');
  // Parked at the north dock until the power comes on; then it shuttles across every ten seconds.
  add('platform', 'gantry', [0, -0.28, -5.8], [1.2, 1, 1.2], {
    name: 'Gantry deck',
    color: '#34463b',
    components: [{ type: 'mover', channel: 'power', axis: 'z', distance: 12.6, period: 10 }],
  });
  [
    [-6, 6.3, 0],
    [6, 6.3, 0],
    [-6, -5.3, 180],
    [6, -5.3, 180],
  ].forEach(([x, z, yaw], i) =>
    add('lamp-post', `floodlight-${i + 1}`, [x, 0.02, z], [1, 1, 1], { name: 'Floodlight', rotation: [0, yaw, 0], components: [{ type: 'lamp', channel: 'power' }] }),
  );
  add('cabinet', 'power-cabinet', [-3.6, 0.02, 7.4], [1, 1, 1], {
    name: 'Power cabinet',
    components: [
      { type: 'counter', channel: 'breaker', count: 2, output: 'power' },
      { type: 'lamp', channel: 'power', on: '#9ef0b8' },
    ],
  });

  // ---- Arrival yard.
  add('spawn', 'player-start', [0, 0.07, 23.5]);
  add('checkpoint', 'south-checkpoint', [0, 0.03, 21], [1, 1, 1], { name: 'Checkpoint / arrival' });
  add('container', 'container-yard-1', [-4.6, 0.02, 13.4], [1, 1, 1], { name: 'Freight container', color: '#6f8a73' });
  add('container', 'container-yard-2', [-13, 0.02, 20.6], [1, 1, 1], { name: 'Freight container', color: '#b49a63' });
  add('health', 'health-yard', [-6, 0.1, 9]);
  add('ammo', 'ammo-yard', [8.2, 0.1, 10.6]);

  // Lamp room (west): a card reader opens it; the west breaker is inside.
  const hut = '#a9b18f';
  block('lamp-room-north', 'Lamp room / wall', [-13, 0.02, 8.85], [6.6, 3, 0.3], hut);
  block('lamp-room-south', 'Lamp room / wall', [-13, 0.02, 15.15], [6.6, 3, 0.3], hut);
  block('lamp-room-west', 'Lamp room / wall', [-16.15, 0.02, 12], [0.3, 3, 6.6], hut);
  block('lamp-room-east-n', 'Lamp room / wall', [-9.85, 0.02, 9.85], [0.3, 3, 2.3], hut);
  block('lamp-room-east-s', 'Lamp room / wall', [-9.85, 0.02, 14.15], [0.3, 3, 2.3], hut);
  block('lamp-room-lintel', 'Lamp room / lintel', [-9.85, 2.5, 12], [0.3, 0.52, 2], hut);
  block('lamp-room-roof', 'Lamp room / roof', [-13, 3.02, 12], [7, 0.25, 7], '#5f735c');
  add('door', 'lamp-room-door', [-9.5, 0.02, 12], [0.78, 0.82, 0.6], {
    name: 'Lamp room / door',
    rotation: [0, 90, 0],
    color: '#4b5d50',
    components: [{ type: 'door', channel: 'lamp-door', axis: 'z', distance: 2.3, speed: 2 }],
  });
  add('switch', 'card-reader', [-9, 0.02, 9.9], [1, 1, 1], {
    name: 'Lamp room / card reader',
    color: '#c7e7a5',
    components: [{ type: 'switch', channel: 'lamp-door', label: 'card reader', once: true, requiresKey: 'access-card' }],
  });
  add('switch', 'breaker-west', [-15, 0.02, 10.2], [1, 1, 1], {
    name: 'West breaker',
    color: '#e8b46b',
    components: [{ type: 'switch', channel: 'breaker', label: 'west breaker', once: true }],
  });
  add('health', 'health-lamp-room', [-15, 0.1, 14]);
  add('ammo', 'ammo-lamp-room', [-12.4, 0.1, 14.2]);

  // Freight shed (east): two sentries guard the east breaker.
  const shed = '#9fae8c';
  block('shed-north', 'Freight shed / wall', [14.05, 0.02, 8.65], [9.1, 3.6, 0.3], shed);
  block('shed-south', 'Freight shed / wall', [14.05, 0.02, 19.35], [9.1, 3.6, 0.3], shed);
  block('shed-roof', 'Freight shed / roof', [14.05, 3.62, 14], [9.6, 0.3, 11.6], '#5f6f5c');
  block('shed-post', 'Freight shed / post', [9.7, 0.02, 14], [0.4, 3.6, 0.4], '#667e62');
  block('shed-pallets', 'Pallet stack', [12.6, 0.02, 11.4], [1.6, 1.2, 1.6], '#b39d6e');
  block('shed-bench', 'Workbench', [16, 0.02, 10.2], [2.4, 0.95, 0.9], '#7b6a52');
  add('crate', 'shed-crate-1', [15.4, 0.08, 17.4], [1, 1, 1], { name: 'Freight crate', color: '#b2aa77' });
  add('crate', 'shed-crate-2', [12, 0.08, 17.6], [1, 1, 1], { name: 'Freight crate', color: '#c0a46e' });
  sentry('sentry-shed-1', 'Sentry / shed 01', [12.4, 0.03, 15]);
  sentry('sentry-shed-2', 'Sentry / shed 02', [15.6, 0.03, 12.6]);
  add('switch', 'breaker-east', [17.6, 0.02, 14], [1, 1, 1], {
    name: 'East breaker',
    color: '#e8b46b',
    components: [{ type: 'switch', channel: 'breaker', label: 'east breaker', once: true }],
  });

  // A depot access card on the container roof, for anyone who left the Foundry's card behind.
  add('container', 'card-container', [6.5, 0.02, 16.5], [1, 1, 1], { name: 'Freight container', rotation: [0, 90, 0], color: '#a8744e' });
  add('key', 'depot-card', [6.5, 2.62, 16.5], [1, 1, 1], { name: 'Depot access card' });
  add('pad', 'card-pad', [6.5, 0.02, 21.2], [1, 1, 1], { name: 'Freight jump pad' });

  // ---- Platform yard.
  add('checkpoint', 'north-checkpoint', [0, 0.03, -9.4], [1.6, 1, 1.6], { name: 'Checkpoint / platform yard' });
  add('trigger', 'arrival-trigger', [0, 0.02, -11.6], [19, 1, 0.8], {
    name: 'Platform yard / arrival',
    components: [{ type: 'trigger', channel: 'north-arrival', once: true }],
  });
  add('cabinet', 'arrival-relay', [3.6, 0.02, -7.2], [1, 1, 1], {
    name: 'Platform relay',
    components: [
      { type: 'relay', channel: 'north-arrival', delay: 1.2, output: 'ambush' },
      { type: 'lamp', channel: 'ambush', on: '#f0a35e' },
    ],
  });
  add('health', 'health-north', [-6, 0.1, -8.2]);
  add('ammo', 'ammo-north', [6, 0.1, -8.2]);

  // The ambush: two containers whose doors slide open on the relay's signal.
  for (const [side, x, yaw, color] of [
    ['west', -13, 0, '#6f8a73'],
    ['east', 13, 180, '#a8744e'],
  ]) {
    const dir = Math.sign(x);
    add('container-open', `container-${side}`, [x, 0.02, -13.6], [1, 1, 1], { name: `Container / ${side}`, rotation: [0, yaw, 0], color });
    add('door', `container-${side}-door`, [x - dir * 3.18, 0.02, -13.6], [0.9, 0.86, 0.5], {
      name: `Container / ${side} door`,
      rotation: [0, dir < 0 ? 90 : -90, 0],
      color: '#56705b',
      components: [{ type: 'door', channel: 'ambush', axis: 'z', distance: 2.7, speed: 3 }],
    });
    sentry(`sentry-${side}`, `Sentry / container ${side}`, [x + dir * 1.3, 0.03, -13.6], { speed: 1.7, range: 22 });
  }

  // Platform 1.
  block('platform-deck', 'Platform 1', [0, 0.02, -19.4], [30, 1, 5.8], '#cfc7a4');
  block('platform-edge', 'Platform 1 / edge line', [0, 1.02, -22.05], [30, 0.05, 0.4], '#d9c76f');
  for (const x of [-5, 5]) add('stairs', `platform-steps-${x}`, [x, 0.02, -13.75], [1.2, 0.68, 1], { name: 'Platform steps', color: '#cfc7a4' });
  add('health', 'health-platform', [-9, 1.1, -18.5]);
  add('ammo', 'ammo-platform', [2.5, 1.1, -17.4]);
  // A fixed sentry holds the platform and covers the gantry crossing.
  sentry('sentry-platform', 'Sentry / platform', [6.5, 1.05, -19.2], { health: 90, speed: 0, range: 24, damage: 6 });

  // Signal box at the east end: the points lever, the line logic and the departure signal.
  block('signal-box-back', 'Signal box / wall', [13.4, 1.02, -21.95], [3.2, 2.6, 0.2], hut);
  block('signal-box-side', 'Signal box / wall', [14.85, 1.02, -20], [0.3, 2.6, 3.7], hut);
  block('signal-box-roof', 'Signal box / roof', [13.4, 3.62, -20], [3.6, 0.2, 4.4], '#5f735c');
  add('switch', 'points-lever', [13.6, 1.02, -20.6], [1, 1, 1], {
    name: 'Northbound points',
    color: '#e8a35e',
    components: [{ type: 'switch', channel: 'points', label: 'northbound points', once: true }],
  });
  add('cabinet', 'line-logic', [9.2, 1.02, -21.7], [1, 1, 1], {
    name: 'Line logic',
    components: [
      { type: 'logic', inputs: ['points', 'depot-clear'], mode: 'all', output: 'departure' },
      { type: 'lamp', channel: 'departure', on: '#8fe3a0' },
    ],
  });
  add('signal-mast', 'departure-signal', [10.8, 1.02, -21.6], [1, 1, 1], {
    name: 'Departure signal',
    components: [{ type: 'lamp', channel: 'departure', on: '#8fe3a0' }],
  });

  // ---- The northbound train: car 03 (with the berth) and its locomotive, on the north line.
  [-14.25, -4.75, 4.75, 14.25].forEach((x, i) => add('track', `north-line-${i}`, [x, 0.02, -24], [0.95, 1, 1], { name: 'North line' }));
  const car = '#4f6a58';
  block('car-floor', 'Car 03 / floor', [-5, 0.62, -24], [16, 0.4, 3.2], '#33463a');
  block('car-bogie-w', 'Car 03 / bogie', [-10, 0.02, -24], [2.6, 0.6, 2.4], '#2a3530');
  block('car-bogie-e', 'Car 03 / bogie', [0, 0.02, -24], [2.6, 0.6, 2.4], '#2a3530');
  block('car-side-w', 'Car 03 / side', [-9.5, 1.02, -22.55], [7, 2.4, 0.3], car);
  block('car-side-e', 'Car 03 / side', [-0.5, 1.02, -22.55], [7, 2.4, 0.3], car);
  block('car-lintel', 'Car 03 / door frame', [-5, 3, -22.55], [2, 0.42, 0.3], car);
  block('car-side-n', 'Car 03 / side', [-5, 1.02, -25.45], [16, 2.4, 0.3], car);
  block('car-end-w', 'Car 03 / end', [-12.85, 1.02, -24], [0.3, 2.4, 3.2], car);
  block('car-end-e', 'Car 03 / end', [2.85, 1.02, -24], [0.3, 2.4, 3.2], car);
  block('car-roof', 'Car 03 / roof', [-5, 3.42, -24], [16.4, 0.3, 3.6], '#3f4f43');
  for (const x of [-11, -8.4, -1.6, 1]) block(`car-window-${x}`, 'Car 03 / window', [x, 1.95, -22.38], [1.5, 0.6, 0.05], '#b9d3c8');
  add('door', 'car-door', [-5, 1.02, -22.2], [0.74, 0.66, 0.5], {
    name: 'Car 03 / door',
    color: '#35483c',
    components: [{ type: 'door', channel: 'departure', axis: 'x', distance: 2.1, speed: 1.6 }],
  });
  add('berth', 'car-berth', [-5, 1.02, -24], [1, 1, 1], { name: 'Car 03 / berth' });
  block('loco-frame', 'Locomotive / frame', [7.1, 0.62, -24], [8.2, 0.4, 3], '#2f3b33');
  block('loco-body', 'Locomotive / body', [6.4, 1.02, -24], [6.6, 2, 2.6], '#a8653f');
  block('loco-stripe', 'Locomotive / stripe', [6.4, 1.6, -22.69], [6.6, 0.18, 0.05], '#e2c47a');
  block('loco-cab', 'Locomotive / cab', [10.2, 1.02, -24], [2.2, 2.8, 3], '#7d4632');
  block('loco-cab-roof', 'Locomotive / cab roof', [10.2, 3.82, -24], [2.5, 0.2, 3.2], '#3f2e25');
  block('loco-cab-window', 'Locomotive / cab window', [10.2, 2.6, -22.48], [1.6, 0.7, 0.05], '#b9d3c8');
  block('loco-bogie-w', 'Locomotive / bogie', [5, 0.02, -24], [2.6, 0.6, 2.4], '#2a3530');
  block('loco-bogie-e', 'Locomotive / bogie', [9.6, 0.02, -24], [2.6, 0.6, 2.4], '#2a3530');

  // ---- Nature at the corners.
  [
    [-16.6, 24, 0.9],
    [16.4, 23.6, 1.05],
    [-16.8, -24.6, 0.95],
    [16.2, -9, 0.85],
  ].forEach(([x, z, s], i) => add('tree', `tree-${i + 1}`, [x, 0.02, z], [s, s, s], { rotation: [0, i * 77, 0] }));
  [
    [-17.2, 6.6, 0.9],
    [16.9, 6.8, 0.7],
    [-17, -6.4, 0.8],
    [-15.5, -25.8, 0.6],
  ].forEach(([x, z, s], i) => add('rock', `rock-${i + 1}`, [x, 0.02, z], [s, s, s], { rotation: [0, i * 53, 0] }));

  return {
    version: 1,
    name: 'Northbound Depot',
    description: 'The end of the line. Restore the depot power, ride the gantry over the live rails, clear the platform and board the northbound train.',
    objective: 'Restore power. Cross the live rails. Board the northbound train.',
    seed: 41,
    environment: { sky: '#c7c3a9', fog: 0.0095, sun: 2.9, exposure: 1, backdrop: true },
    player: { ...defaultMotor, walkSpeed: 5.5, sprintSpeed: 8.6, headBob: 0.3 },
    entities,
    mission: {
      clearSignal: 'depot-clear',
      clearFlag: 'depotCleared',
      clearMessage: 'Every sentry in the depot is down.',
      detail: 'Power the gantry, cross the live rails and board the northbound train.',
      notices: {
        'lamp-door': { text: 'Card accepted. The lamp room is open.', sound: 'accepted' },
        power: { text: 'Depot power restored. The gantry is running.', sound: 'power' },
        ambush: { text: 'Container doors opening. Sentries on the platform!', sound: 'alarm' },
        points: { text: 'Points set for the northbound line.', sound: 'gate' },
        departure: { text: 'Line clear. The signal is green and the train doors are open.', sound: 'checkpoint' },
      },
      stages: [
        { text: 'Restore depot power.', signal: 'power', detail: 'Throw both breakers: the lamp room takes an access card, the freight shed is guarded.' },
        { text: 'Ride the gantry over the live rails.', signal: 'north-arrival', detail: 'The rail bed is electrified. Stay on the gantry deck.' },
        { text: 'Disable every sentry in the depot.', signal: 'depot-clear', detail: 'Clear the platform yard, and the freight shed if anyone is left there.' },
        { text: 'Set the northbound points.', signal: 'points', detail: 'The lever is in the signal box at the east end of platform 1.' },
        { text: 'Board the northbound train.', detail: 'Car 03 waits at platform 1.' },
      ],
    },
    labels: [
      { text: 'NORTHBOUND DEPOT  /  GANTRY 2', position: [0, 5.195, 6.28], width: 5.2, height: 0.36, color: '#e0e8bf', background: '#3d5544' },
      { text: 'HIGH VOLTAGE', position: [-8, 0.52, 4.92], width: 3.2, height: 0.5, color: '#5a3f33', background: '#e2b48e' },
      { text: 'HIGH VOLTAGE', position: [8, 0.52, 4.92], width: 3.2, height: 0.5, color: '#5a3f33', background: '#e2b48e' },
      { text: 'LAMP ROOM', position: [-10.18, 2.76, 12], width: 1.8, height: 0.4, color: '#d6e6b8', background: '#314a39', rotation: [0, 90, 0] },
      { text: 'FREIGHT SHED 2', position: [9.72, 3.45, 14], width: 4, height: 0.5, color: '#e2e3bf', background: '#3d4a36', rotation: [0, -90, 0] },
      { text: 'PLATFORM 1  /  NORTHBOUND', position: [0, 0.55, -16.98], width: 5, height: 0.5, color: '#2f3b33', background: '#d9c76f' },
      { text: 'NORTHBOUND  /  CAR 03', position: [-9.5, 2.95, -22.88], width: 4.6, height: 0.36, color: '#e0e8bf', background: '#33463a' },
      { text: 'SIGNAL BOX  /  POINTS', position: [13.4, 3.5, -18.28], width: 3.2, height: 0.46, color: '#f0d9a3', background: '#4a3d2c' },
    ],
  };
}
