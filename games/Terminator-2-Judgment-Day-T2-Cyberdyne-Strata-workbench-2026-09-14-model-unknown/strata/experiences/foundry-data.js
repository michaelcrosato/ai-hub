import { createPrefabs } from '../kits/fps/Prefabs.js';
import { defaultMotor } from '../kits/fps/Motor.js';
export function foundryData(alternate = false) {
  const p = createPrefabs(),
    entities = [];
  const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
    const e = Object.assign(p.create(prefab, position, id), { scale }, extra);
    entities.push(e);
    return e;
  };
  add('block', 'foundation', [0, -1.3, 0], [28, 1.2, 36], { name: 'Foundation', color: '#697d67' });
  add('block', 'floor', [0, -0.1, 0], [27.8, 0.12, 35.8], { name: 'Concrete floor', color: '#c5c7a6' });
  for (const x of [-13.6, 13.6]) {
    add('block', `side-${x}`, [x, 0, 0], [0.65, 4, 36], { name: 'Perimeter wall', color: '#a4b190' });
    for (const z of [-14, -7, 0, 7, 14]) {
      add('block', `pier-${x}-${z}`, [x - 0.06 * Math.sign(x), 0, z], [1, 5.1, 1], { name: 'Wall pier', color: '#667e62' });
    }
  }
  add('block', 'rear-left', [-8, 0, -17.5], [11, 4, 0.65], { name: 'North wall / west', color: '#8d9f7d' });
  add('block', 'rear-right', [8, 0, -17.5], [11, 4, 0.65], { name: 'North wall / east', color: '#8d9f7d' });
  add('block', 'rear-lintel', [0, 4, -17.5], [27.5, 0.7, 1], { name: 'North wall / lintel', color: '#61785e' });
  add('block', 'front-wall', [0, 0, 17.5], [27.5, 1.25, 0.65], { name: 'South wall', color: '#adb898' });
  // Cover is an authoring object, not special runtime geometry.
  for (const [i, x, z] of [
    [0, -7, 7],
    [1, 6, 5],
    [2, -5, -3],
    [3, 7, -7],
  ]) {
    add('block', `cover-${i}`, [x, 0, z], [3.8, 1.35, 1.5], { name: `Cover / ${i + 1}`, color: i % 2 ? '#829973' : '#b9bf9c' });
    add('crate', `crate-${i}`, [x + (i % 2 ? -2.6 : 2.6), 0.08, z], [1, 1, 1], { name: `Supply crate / ${i + 1}`, color: '#b2aa77' });
  }
  for (const z of [-12, 1, 12]) add('block', `beam-${z}`, [0, 5.2, z], [27, 0.25, 0.3], { name: 'Overhead support', color: '#5a7259' });
  for (const x of [-9, -6]) {
    add('block', `pump-base-${x}`, [x, 0, -12], [2.4, 0.4, 3], { name: 'Plant plinth', color: '#76876b' });
    add('column', `tank-${x}`, [x, 0.4, -12], [1.3, 1.15, 1.3], { name: 'Pressure column', color: '#bfc3a2' });
  }
  add('door', 'exit-gate', [0, 0, -13.7], [1.65, 1, 1], {
    name: 'North gate',
    components: [{ type: 'door', channel: 'gate', axis: 'y', distance: 3.8, speed: 2 }],
  });
  add('block', 'gate-left', [-5.6, 0, -13.7], [7, 3.2, 0.7], { name: 'Gate wall / west', color: '#91a37e' });
  add('block', 'gate-right', [5.6, 0, -13.7], [7, 3.2, 0.7], { name: 'Gate wall / east', color: '#91a37e' });
  add('exit', 'escape-car', [0, 0.05, -16], [0.85, 0.85, 0.85], { name: 'Escape vehicle' });
  add('spawn', 'player-start', [0, 0.07, 13]);
  add('checkpoint', 'start-checkpoint', [0, 0.03, 11]);
  add('health', 'health-west', [-10, 0.1, 10]);
  add('health', 'health-east', [10, 0.1, -2]);
  add('ammo', 'ammo-near', [3, 0.1, 10]);
  add('ammo', 'ammo-far', [-8, 0.1, -6]);
  add('key', 'access-card', [8, 0.1, -10]);
  const positions = alternate
    ? [
        [-8, 0.03, 2],
        [8, 0.03, -2],
        [0, 0.03, -8],
        [9, 0.03, -10],
      ]
    : [
        [-6, 0.03, 0],
        [6, 0.03, -2],
        [-3, 0.03, -9],
        [8, 0.03, -10],
      ];
  positions.forEach((pos, i) =>
    add('enemy', `sentry-${i + 1}`, pos, [1, 1, 1], {
      name: `Sentry / 0${i + 1}`,
      components: [{ type: 'enemy', health: 78, speed: alternate ? 2.4 : 1.5, range: 20, damage: 7 }],
    }),
  );
  if (alternate) {
    add('block', 'divider-a', [-2, 0, 4], [0.6, 2.6, 9], { name: 'Alternate route / cover', color: '#708c68' });
    add('block', 'divider-b', [3, 0, -4], [0.6, 2.6, 8], { name: 'Alternate route / cover', color: '#708c68' });
  }
  add('stairs', 'steps', [-10, 0, 1]);
  add('block', 'upper-platform', [-10, 1.5, -3], [3.5, 0.2, 5], { name: 'Raised position', color: '#c0c6a4' });
  return {
    version: 1,
    name: alternate ? 'The Foundry / Crossfire' : 'The Foundry',
    description: 'An editable combat cartridge. Clear the sentries and enter the escape vehicle.',
    objective: 'Disable the sentries. Enter the escape vehicle.',
    seed: alternate ? 32 : 17,
    environment: { sky: '#c0cabb', fog: 0.008, sun: 3.1, exposure: 1, backdrop: true },
    player: { ...defaultMotor, walkSpeed: 5.5, sprintSpeed: 8.5, headBob: 0.28 },
    entities,
  };
}
