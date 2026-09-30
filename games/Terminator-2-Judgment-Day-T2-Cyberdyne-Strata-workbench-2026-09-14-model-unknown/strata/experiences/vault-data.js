import { createPrefabs } from '../kits/fps/Prefabs.js';
import { defaultMotor } from '../kits/fps/Motor.js';

/*
 * Chapter 04 / The Vault. Every object is a normal editable prefab, and the level logic is data:
 *   scanner trigger ─(scan)→ relay, 2 s ─(lab)→ lab door
 *   three signal cells ─(cell)→ counter ×3 ─(power)┐
 *   all sentries disabled ─(gate, sent by the kit)─┴→ logic "all" ─(vault)→ vault door + exit
 *
 * Layout (x east, z south, the player starts at the south end facing north):
 *   z  22 … 9   entry hall, scanner ring, supplies
 *   z   9       lab gate (opens after the scan)
 *   z   9 … -14 lab floor: cover, four sentries, a stair-reached mezzanine behind a laser strip (west),
 *               a jump pad and lift up to a catwalk (east), the third cell by the vault gate
 *   z -14       vault gate (opens on power + all clear)
 *   z -14 … -22 vault room with the exit
 */
export function vaultData() {
  const p = createPrefabs(),
    entities = [];
  const add = (prefab, id, position, scale = [1, 1, 1], extra = {}) => {
    const e = Object.assign(p.create(prefab, position, id), { scale }, extra);
    entities.push(e);
    return e;
  };
  const wall = '#8e9e99',
    dark = '#4b5d59',
    trim = '#657a73';

  // Shell
  add('block', 'foundation', [0, -1.3, 0], [30, 1.2, 46], { name: 'Foundation', color: '#56666b' });
  add('block', 'floor', [0, -0.1, 0], [29.8, 0.12, 45.8], { name: 'Lab floor', color: '#b7c0bc' });
  for (const x of [-14.7, 14.7]) {
    add('block', `side-${x}`, [x, 0, 0], [0.65, 4.2, 46], { name: 'Perimeter wall', color: wall });
    for (const z of [-18, -9, 0, 9, 18]) add('block', `pier-${x}-${z}`, [x - 0.1 * Math.sign(x), 0, z], [1, 4.9, 1], { name: 'Wall pier', color: dark });
  }
  add('block', 'south-wall', [0, 0, 22.8], [30, 4.2, 0.65], { name: 'South wall', color: wall });
  add('block', 'north-wall', [0, 0, -22.8], [30, 4.2, 0.65], { name: 'North wall', color: wall });

  // Entry hall
  add('spawn', 'player-start', [0, 0.07, 19.5]);
  add('checkpoint', 'start-checkpoint', [0, 0.03, 17.5]);
  add('health', 'health-entry', [-11, 0.1, 19]);
  add('ammo', 'ammo-entry', [11, 0.1, 19]);
  add('crate', 'crate-entry-1', [-9, 0.08, 14], [1, 1, 1], { name: 'Supply crate / entry', color: '#a9a57a' });
  add('crate', 'crate-entry-2', [9.5, 0.08, 15], [1, 1, 1], { name: 'Supply crate / entry', color: '#a9a57a' });
  add('checkpoint', 'scan-point', [0, 0.03, 12], [1, 1, 1], {
    name: 'Security scanner',
    components: [{ type: 'checkpoint', message: 'Security scan accepted. The lab gate opens in two seconds.' }],
  });
  add('trigger', 'scan-zone', [0, 0.02, 12], [1.1, 1, 1.1], {
    name: 'Scanner / delayed release',
    components: [
      { type: 'trigger', channel: 'scan', once: true },
      { type: 'relay', channel: 'scan', output: 'lab', delay: 2 },
    ],
  });

  // Lab gate
  add('block', 'gate-a-west', [-8.5, 0, 9], [11.8, 4.2, 0.7], { name: 'Lab gate wall / west', color: trim });
  add('block', 'gate-a-east', [8.5, 0, 9], [11.8, 4.2, 0.7], { name: 'Lab gate wall / east', color: trim });
  add('block', 'lab-lintel', [0, 4.2, 9], [29.5, 0.5, 1], { name: 'Lab gate lintel', color: dark });
  add('door', 'lab-door', [0, 0, 9], [1.95, 1.4, 1], {
    name: 'Lab gate',
    components: [{ type: 'door', channel: 'lab', axis: 'y', distance: 4.2, speed: 2.2 }],
  });

  // Lab floor
  add('checkpoint', 'lab-checkpoint', [0, 0.03, 6.5], [1, 1, 1], {
    name: 'Lab checkpoint',
    components: [{ type: 'checkpoint', message: 'Checkpoint saved. Sentries guard the lab.' }],
  });
  add('health', 'health-lab', [13, 0.1, 7]);
  add('ammo', 'ammo-lab', [-13, 0.1, 7]);
  for (const [i, x, z, w] of [
    [1, -5, 4, 3.4],
    [2, 3.5, 0.5, 3.4],
    [3, -2.5, -5.5, 4],
    [4, 5, -8.5, 3],
  ])
    add('block', `cover-${i}`, [x, 0, z], [w, 1.35, 1.4], { name: `Cover / ${i}`, color: i % 2 ? '#9aa9a0' : '#7f918a' });
  add('crate', 'crate-lab-1', [-7.5, 0.08, -1], [1, 1, 1], { name: 'Supply crate / lab', color: '#b2aa77' });
  add('crate', 'crate-lab-2', [1.5, 0.08, -9.8], [1, 1, 1], { name: 'Supply crate / lab', color: '#b2aa77' });
  add('crate', 'crate-lab-3', [8, 0.08, 6], [1, 1, 1], { name: 'Supply crate / lab', color: '#b2aa77' });

  // West: stairs up to the mezzanine, a laser strip to jump, a cell at the far end.
  add('stairs', 'west-stairs', [-11.5, 0.02, 4.8], [1, 1, 1], { name: 'Mezzanine stairs', color: '#c3c9c2' });
  add('block', 'mezzanine', [-11.5, 1.32, -2.9], [5.2, 0.2, 9.9], { name: 'Mezzanine', color: '#c3c9c2' });
  add('hazard', 'laser-strip', [-11.5, 1.52, -2.2], [2.6, 0.8, 0.8], {
    name: 'Laser strip / jump it',
    color: '#d0654e',
  });
  add('pickup', 'cell-west', [-11.5, 1.52, -6.2], [1, 1, 1], { name: 'Power cell / mezzanine' });

  // East: a jump pad or the lift reaches the catwalk and its cell.
  add('pad', 'lab-pad', [6.2, 0.02, -2]);
  add('block', 'catwalk', [11.4, 2.65, -2.5], [5.6, 0.2, 9], { name: 'Catwalk', color: '#c3c9c2' });
  add('platform', 'lift', [11.4, 0.02, 3.5], [1, 1, 1], {
    name: 'Lift / catwalk',
    components: [{ type: 'mover', axis: 'y', distance: 2.55, period: 6 }],
  });
  add('pickup', 'cell-east', [12.6, 2.85, -5.5], [1, 1, 1], { name: 'Power cell / catwalk' });

  // Centre: the third cell waits in front of the vault gate.
  add('pickup', 'cell-core', [0, 0.02, -10.5], [1, 1, 1], { name: 'Power cell / vault gate' });

  // Guard
  for (const [i, pos] of [
    [1, [-6, 0.03, 1]],
    [2, [6.5, 0.03, -5]],
    [3, [-3, 0.03, -9.5]],
    [4, [-11.5, 1.55, -5]],
  ])
    add('enemy', `sentry-${i}`, pos, [1, 1, 1], {
      name: `Sentry / 0${i}`,
      color: '#566b6f',
      components: [{ type: 'enemy', health: 78, speed: 1.6, range: 20, damage: 7 }],
    });

  // Vault gate: power and an all-clear open it together.
  add('block', 'vault-wall-west', [-8.6, 0, -14], [11.6, 4.2, 0.7], { name: 'Vault wall / west', color: trim });
  add('block', 'vault-wall-east', [8.6, 0, -14], [11.6, 4.2, 0.7], { name: 'Vault wall / east', color: trim });
  add('block', 'vault-lintel', [0, 4.2, -14], [29.5, 0.5, 1], { name: 'Vault lintel', color: dark });
  add('door', 'vault-door', [0, 0, -14], [2.1, 1.4, 1], {
    name: 'Vault door',
    color: '#3f4d4f',
    components: [{ type: 'door', channel: 'vault', axis: 'y', distance: 4.2, speed: 1.4 }],
  });
  add('goal', 'vault-exit', [0, 0.02, -18], [1, 1, 1], {
    name: 'Vault / exit',
    components: [
      { type: 'goal', channel: 'vault', requiresSignal: true, message: 'Northbound complete.' },
      { type: 'counter', channel: 'cell', count: 3, output: 'power', message: 'Vault power restored.' },
      { type: 'logic', inputs: ['power', 'gate'], mode: 'all', output: 'vault', message: 'Security override accepted. The vault is open.' },
    ],
  });
  for (const x of [-6.5, 6.5]) add('column', `vault-column-${x}`, [x, 0.02, -19], [1.1, 1.2, 1.1], { name: 'Vault column', color: '#aab6b3' });

  return {
    version: 1,
    name: 'The Vault',
    description: 'The last chapter of Northbound. Scan in, restore power to the vault, clear the guard and leave through the exit.',
    objective: 'Restore power. Open the vault.',
    detail: 'Stand on the scanner ring. Collect three power cells. Disable the sentries.',
    clearedMessage: 'All sentries disabled. Security override armed.',
    seed: 44,
    environment: { sky: '#a9bcbd', fog: 0.009, sun: 2.8, exposure: 1, backdrop: true },
    player: { ...defaultMotor, walkSpeed: 5.5, sprintSpeed: 8.5, headBob: 0.28 },
    entities,
  };
}
