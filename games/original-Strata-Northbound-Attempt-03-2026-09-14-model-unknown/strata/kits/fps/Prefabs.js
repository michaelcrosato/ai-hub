import { makeID } from '../../core/id.js';
export const palette = {
  stone: '#e5d7bd',
  dark: '#394943',
  grass: '#739b68',
  teal: '#50cbb2',
  orange: '#eaa16b',
  trunk: '#786950',
  leaf: '#63835b',
  pale: '#f2e7ca',
};
const part = (shape, position, scale, color, extra = {}) => ({ shape, position, scale, color, ...extra });
const box = (position, scale, color) => part('box', position, scale, color);
const collider = (position, size, sensor = false) => ({ position, size, sensor });
export class Prefabs {
  items = new Map();
  register(prefab) {
    if (this.items.has(prefab.id)) throw new Error(`Prefab already registered: ${prefab.id}`);
    this.items.set(prefab.id, prefab);
  }
  get(id) {
    const p = this.items.get(id);
    if (!p) throw new Error(`Unknown prefab: ${id}`);
    return p;
  }
  all() {
    return [...this.items.values()];
  }
  get ids() {
    return new Set(this.items.keys());
  }
  create(prefab, position, id = `${prefab}-${makeID().slice(0, 8)}`) {
    const p = this.get(prefab);
    return {
      id,
      prefab,
      name: p.name,
      position: [...position],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      components: structuredClone(p.components),
    };
  }
}
export function createPrefabs() {
  const r = new Prefabs();
  const add = (id, name, group, summary, components, build) => r.register({ id, name, group, summary, components, build });
  add('block', 'Stone block', 'Structure', 'Solid modular block. Scale to make floors and walls.', [], (e) => ({
    body: 'fixed',
    visuals: [box([0, 0.5, 0], [1, 1, 1], e.color ?? palette.stone)],
    colliders: [collider([0, 0.5, 0], [1, 1, 1])],
  }));
  add('column', 'Stone column', 'Structure', 'A solid pillar with a cap and a foot.', [], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.15, 0], [1.2, 0.3, 1.2], palette.dark),
      box([0, 1.6, 0], [0.8, 2.6, 0.8], e.color ?? palette.stone),
      box([0, 3, 0], [1.3, 0.3, 1.3], palette.stone),
    ],
    colliders: [collider([0, 1.6, 0], [1.2, 3.2, 1.2])],
  }));
  add('stairs', 'Stairs', 'Structure', 'Six 0.25 m steps. Tests automatic step climbing.', [], (e) => ({
    body: 'fixed',
    visuals: Array.from({ length: 6 }, (_, i) => box([0, (i + 1) * 0.125, -i * 0.5], [2, (i + 1) * 0.25, 0.5], e.color ?? palette.stone)),
    colliders: Array.from({ length: 6 }, (_, i) => collider([0, (i + 1) * 0.125, -i * 0.5], [2, (i + 1) * 0.25, 0.5])),
  }));
  add('crate', 'Physics crate', 'Gameplay', 'Push, carry, drop, or throw a rigid body.', [], (e) => ({
    body: 'dynamic',
    visuals: [
      box([0, 0.55, 0], [1.1, 1.1, 1.1], e.color ?? palette.orange),
      box([0, 0.55, 0.556], [0.13, 1.05, 0.025], palette.dark),
      box([0, 0.55, -0.556], [0.13, 1.05, 0.025], palette.dark),
      box([0, 1.106, 0], [0.13, 0.025, 1.1], palette.dark),
    ],
    colliders: [collider([0, 0.55, 0], [1.1, 1.1, 1.1])],
  }));
  add(
    'switch',
    'Signal switch',
    'Gameplay',
    'Press E. Sends a true or false channel value.',
    [{ type: 'switch', channel: 'gate', label: 'gate switch' }],
    (e) => ({
      body: 'fixed',
      visuals: [
        box([0, 0.1, 0], [0.9, 0.2, 0.9], palette.dark),
        box([0, 0.65, 0], [0.5, 1, 0.5], palette.stone),
        box([0, 1.25, 0], [0.85, 0.35, 0.65], e.color ?? palette.teal),
        part('sphere', [0, 1.48, 0], [0.18, 0.18, 0.18], palette.pale, { emissive: 0.8 }),
      ],
      colliders: [collider([0, 0.75, 0], [0.9, 1.5, 0.9])],
    }),
  );
  add(
    'door',
    'Signal door',
    'Gameplay',
    'Moves on a local axis when its channel is active.',
    [{ type: 'door', channel: 'gate', distance: 3.6, speed: 2, axis: 'y' }],
    (e) => ({
      body: 'kinematic',
      visuals: [
        box([0, 1.5, 0], [2.7, 3, 0.45], e.color ?? palette.dark),
        box([0, 1.5, 0.24], [0.12, 2.8, 0.025], palette.teal),
        box([0, 2.65, 0.24], [2.4, 0.12, 0.025], palette.teal),
      ],
      colliders: [collider([0, 1.5, 0], [2.7, 3, 0.45])],
    }),
  );
  add(
    'platform',
    'Moving platform',
    'Gameplay',
    'A moving surface. Supports player transport.',
    [{ type: 'mover', axis: 'y', distance: 3, period: 5 }],
    (e) => ({
      body: 'kinematic',
      visuals: [box([0, 0.15, 0], [3, 0.3, 3], e.color ?? palette.dark), box([0, 0.32, 0], [2.8, 0.04, 2.8], palette.teal)],
      colliders: [collider([0, 0.15, 0], [3, 0.3, 3])],
    }),
  );
  add('trigger', 'Trigger volume', 'Gameplay', 'Sends a channel value on entry and exit.', [{ type: 'trigger', channel: 'zone', once: false }], (e) => ({
    body: 'fixed',
    editorOnly: true,
    visuals: [part('box', [0, 1, 0], [2, 2, 2], e.color ?? palette.teal, { opacity: 0.18 })],
    colliders: [collider([0, 1, 0], [2, 2, 2], true)],
  }));
  add(
    'pickup',
    'Signal cell',
    'Gameplay',
    'Collect a cell to send a channel signal.',
    [{ type: 'pickup', channel: 'cell', label: 'Collect signal cell' }],
    (e) => ({
      body: 'fixed',
      visuals: [
        part('rock', [0, 1, 0], [0.33, 0.55, 0.33], e.color ?? palette.teal, { emissive: 0.45 }),
        part('ring', [0, 0.04, 0], [0.55, 0.55, 0.55], palette.dark, { rotation: [90, 0, 0] }),
      ],
      colliders: [collider([0, 1, 0], [0.7, 1.3, 0.7], true)],
    }),
  );
  add('checkpoint', 'Checkpoint', 'Gameplay', 'Sets the player return point on entry.', [{ type: 'checkpoint', message: 'Checkpoint saved' }], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.03, 0], [1.8, 0.06, 1.8], palette.dark),
      part('ring', [0, 0.08, 0], [0.65, 0.65, 0.65], e.color ?? palette.teal, { rotation: [90, 0, 0], emissive: 0.4 }),
    ],
    colliders: [collider([0, 0.06, 0], [1.8, 0.12, 1.8]), collider([0, 0.8, 0], [1.8, 1.4, 1.8], true)],
  }));
  add('pad', 'Jump pad', 'Gameplay', 'Adds a controlled upward launch.', [{ type: 'pad', launchSpeed: 14 }], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.08, 0], [2, 0.16, 2], palette.dark),
      part('cylinder', [0, 0.19, 0], [0.75, 0.12, 0.75], e.color ?? palette.orange),
      part('ring', [0, 0.27, 0], [0.48, 0.48, 0.48], palette.pale, { rotation: [90, 0, 0] }),
    ],
    colliders: [collider([0, 0.08, 0], [2, 0.16, 2]), collider([0, 0.4, 0], [1.8, 0.5, 1.8], true)],
  }));
  add('hazard', 'Hazard field', 'Gameplay', 'Returns the player to the checkpoint.', [{ type: 'hazard' }], (e) => ({
    body: 'fixed',
    visuals: [box([0, 0.025, 0], [2, 0.05, 2], e.color ?? '#ce765e'), part('cone', [0, 0.3, 0], [0.25, 0.5, 0.25], palette.dark)],
    colliders: [collider([0, 0.3, 0], [2, 0.6, 2], true)],
  }));
  add(
    'goal',
    'Exit gate',
    'Gameplay',
    'Completes the test when its channel is active.',
    [{ type: 'goal', channel: 'gate', requiresSignal: true, message: 'Test complete. Build what comes next.' }],
    (e) => ({
      body: 'fixed',
      visuals: [
        box([-1.6, 2, 0], [0.55, 4, 0.7], palette.stone),
        box([1.6, 2, 0], [0.55, 4, 0.7], palette.stone),
        box([0, 4.05, 0], [3.8, 0.5, 0.9], palette.stone),
        part('box', [0, 1.95, 0], [2.7, 3.8, 0.05], e.color ?? palette.teal, { opacity: 0.18, emissive: 0.3 }),
      ],
      colliders: [
        collider([-1.6, 2, 0], [0.55, 4, 0.7]),
        collider([1.6, 2, 0], [0.55, 4, 0.7]),
        collider([0, 4.05, 0], [3.8, 0.5, 0.9]),
        collider([0, 1.5, 0], [2.6, 3, 1.1], true),
      ],
    }),
  );
  add('tree', 'Low-poly tree', 'Nature', 'Faceted foliage and a solid trunk.', [], (e) => ({
    body: 'fixed',
    visuals: [
      part('cylinder', [0, 1, 0], [0.23, 2, 0.23], palette.trunk),
      part('rock', [0, 2.65, 0], [1.6, 1.9, 1.6], e.color ?? palette.leaf),
      part('rock', [0.6, 3.1, 0.3], [1.05, 1.3, 1.05], '#88a374'),
    ],
    colliders: [collider([0, 1, 0], [0.48, 2, 0.48])],
  }));
  add('rock', 'Faceted rock', 'Nature', 'Decorative rock with a simple box collider.', [], (e) => ({
    body: 'fixed',
    visuals: [part('rock', [0, 0.48, 0], [0.9, 0.7, 0.8], e.color ?? '#91a18c')],
    colliders: [collider([0, 0.4, 0], [1.2, 0.8, 1.1])],
  }));
  add('spawn', 'Player start', 'Gameplay', 'Exactly one start is required per level.', [{ type: 'spawn', yaw: 0 }], () => ({
    body: 'fixed',
    editorOnly: true,
    visuals: [
      part('ring', [0, 0.07, 0], [0.65, 0.65, 0.65], palette.teal, { rotation: [90, 0, 0] }),
      part('cone', [0, 0.4, -0.55], [0.2, 0.6, 0.2], palette.teal, { rotation: [-90, 0, 0] }),
    ],
    colliders: [],
  }));
  add(
    'enemy',
    'Sentry',
    'Combat',
    'A guard with sight, pursuit, and a timed attack.',
    [{ type: 'enemy', health: 78, speed: 1.8, range: 22, damage: 8 }],
    (e) => ({
      body: 'kinematic',
      visuals: [
        box([0, 0.87, 0], [0.68, 0.85, 0.42], e.color ?? '#5c7161'),
        box([0, 1.56, 0], [0.5, 0.42, 0.42], '#293a35'),
        box([0, 1.59, -0.219], [0.38, 0.09, 0.03], '#edab70'),
        box([-0.22, 0.27, 0], [0.21, 0.52, 0.26], '#34453e'),
        box([0.22, 0.27, 0], [0.21, 0.52, 0.26], '#34453e'),
        box([-0.48, 0.95, -0.05], [0.19, 0.6, 0.21], '#9a9f7c'),
        box([0.48, 0.95, -0.05], [0.19, 0.6, 0.21], '#9a9f7c'),
        box([0.39, 1, -0.39], [0.13, 0.14, 0.58], '#202e29'),
      ],
      colliders: [collider([0, 0.88, 0], [0.8, 1.76, 0.6])],
    }),
  );
  add('health', 'Health pack', 'Combat', 'Restores 35 health.', [{ type: 'supply', kind: 'health', amount: 35 }], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.2, 0], [0.58, 0.38, 0.42], e.color ?? '#bdd4a6'),
      box([0, 0.2, 0.216], [0.26, 0.07, 0.02], '#e9efdb'),
      box([0, 0.2, 0.216], [0.07, 0.26, 0.02], '#e9efdb'),
    ],
    colliders: [collider([0, 0.4, 0], [1, 0.8, 1], true)],
  }));
  add('ammo', 'Ammunition', 'Combat', 'Adds rifle and pistol ammunition.', [{ type: 'supply', kind: 'ammo', amount: 48 }], (e) => ({
    body: 'fixed',
    visuals: [box([0, 0.2, 0], [0.56, 0.4, 0.42], e.color ?? '#d6a26d'), box([0, 0.405, 0], [0.48, 0.035, 0.32], '#34453e')],
    colliders: [collider([0, 0.4, 0], [1, 0.8, 1], true)],
  }));
  add('key', 'Access card', 'Combat', 'Adds a key to the shared inventory.', [{ type: 'supply', kind: 'key', key: 'access-card', amount: 1 }], (e) => ({
    body: 'fixed',
    visuals: [box([0, 0.7, 0], [0.45, 0.65, 0.07], e.color ?? '#c7e7a5'), box([0, 0.79, -0.045], [0.32, 0.08, 0.02], '#314a3b')],
    colliders: [collider([0, 0.6, 0], [1, 1.2, 1], true)],
  }));
  add('exit', 'Escape vehicle', 'Sequence', 'Use to request the next experience.', [{ type: 'exit', exit: 'escape', requiresClear: true }], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.65, 0], [1.85, 0.65, 3.9], e.color ?? '#b1c98e'),
      box([0, 1.2, 0.2], [1.65, 0.62, 1.8], '#455a4c'),
      box([0, 1.37, -0.72], [1.49, 0.34, 0.06], '#b5d4cd'),
      box([0, 0.67, -1.96], [1.35, 0.12, 0.04], '#e8d8a3'),
      box([0, 0.63, 1.96], [1.35, 0.09, 0.03], '#c28768'),
      part('cylinder', [-0.94, 0.4, -1.2], [0.4, 0.2, 0.4], '#263932', { rotation: [0, 0, 90] }),
      part('cylinder', [0.94, 0.4, -1.2], [0.4, 0.2, 0.4], '#263932', { rotation: [0, 0, 90] }),
      part('cylinder', [-0.94, 0.4, 1.2], [0.4, 0.2, 0.4], '#263932', { rotation: [0, 0, 90] }),
      part('cylinder', [0.94, 0.4, 1.2], [0.4, 0.2, 0.4], '#263932', { rotation: [0, 0, 90] }),
    ],
    colliders: [collider([0, 0.7, 0], [1.9, 1.4, 3.9])],
  }));
  addDepotPrefabs(add);
  return r;
}

/**
 * The rail depot set (Northbound Depot). Parts marked `lamp` are recoloured by a lamp component
 * when its channel changes, so a level can show power, signals and departures.
 */
function addDepotPrefabs(add) {
  const track = (live) => (e) => {
    const visuals = [];
    for (let i = 0; i < 13; i++) visuals.push(box([-4.8 + i * 0.8, 0.06, 0], [0.28, 0.12, 2.6], e.color ?? '#5d5245'));
    for (const z of [-0.72, 0.72]) visuals.push(box([0, 0.19, z], [10, 0.14, 0.12], '#8a8f86'));
    // The live line carries a glowing third rail.
    if (live) visuals.push(part('box', [0, 0.2, 1.18], [10, 0.1, 0.1], '#f0a35e', { emissive: 1 }));
    return { body: 'fixed', visuals, colliders: [collider([0, 0.1, 0], [10, 0.2, 2.6])] };
  };
  add('track', 'Rail track', 'Depot', 'Ten metres of track along X: sleepers and two rails.', [], track(false));
  add('live-track', 'Live track', 'Depot', 'Track with a glowing third rail. Pair it with a live rail bed.', [], track(true));
  add('live-bed', 'Live rail bed', 'Depot', 'An electrified bed. Returns the player to the checkpoint.', [{ type: 'hazard' }], (e) => ({
    body: 'fixed',
    visuals: [part('box', [0, 0.03, 0], [1, 0.02, 1], e.color ?? '#e0875a', { opacity: 0.32 })],
    colliders: [collider([0, 0.3, 0], [1, 0.6, 1], true)],
  }));
  const ribs = (visuals, width, color) => {
    for (let i = 0; i < 5; i++)
      for (const z of [-1, 1]) visuals.push(box([-2.4 + i * 1.2, 1.28, z * (width / 2 + 0.02)], [0.08, 2.36, 0.04], color));
  };
  add('container', 'Freight container', 'Depot', 'A closed six-metre container. Solid cover.', [], (e) => {
    const c = e.color ?? '#a8744e';
    const visuals = [box([0, 1.3, 0], [6, 2.6, 2.4], c), box([0, 2.62, 0], [6.04, 0.06, 2.44], '#3f4a3e')];
    ribs(visuals, 2.4, '#3f4a3e');
    for (const z of [-0.45, 0.45]) visuals.push(box([3.01, 1.25, z], [0.03, 2.3, 0.07], '#3f4a3e'));
    return { body: 'fixed', visuals, colliders: [collider([0, 1.3, 0], [6, 2.6, 2.4])] };
  });
  add('container-open', 'Open container', 'Depot', 'A container open at its +X end. Pair it with a door.', [], (e) => {
    const c = e.color ?? '#6f8a73';
    const visuals = [
      box([0, 2.55, 0], [6, 0.1, 2.4], c),
      box([0, 1.25, -1.15], [6, 2.5, 0.1], c),
      box([0, 1.25, 1.15], [6, 2.5, 0.1], c),
      box([-2.95, 1.25, 0], [0.1, 2.5, 2.4], c),
      box([0, 2.62, 0], [6.04, 0.06, 2.44], '#3f4a3e'),
    ];
    ribs(visuals, 2.4, '#3f4a3e');
    return {
      body: 'fixed',
      visuals,
      colliders: [
        collider([0, 2.55, 0], [6, 0.1, 2.4]),
        collider([0, 1.25, -1.15], [6, 2.5, 0.1]),
        collider([0, 1.25, 1.15], [6, 2.5, 0.1]),
        collider([-2.95, 1.25, 0], [0.1, 2.5, 2.4]),
      ],
    };
  });
  add('cabinet', 'Relay cabinet', 'Depot', 'A trackside cabinet. Holds counter, relay, logic and lamp components.', [], (e) => ({
    body: 'fixed',
    visuals: [
      box([0, 0.7, 0], [0.8, 1.4, 0.5], e.color ?? '#4b5b4e'),
      box([0, 1.42, 0], [0.9, 0.06, 0.6], '#2f3b33'),
      box([0, 0.7, 0.255], [0.04, 1.1, 0.02], '#2f3b33'),
      part('sphere', [0, 1.18, 0.27], [0.08, 0.08, 0.05], '#5e5c50', { emissive: 1, lamp: true }),
    ],
    colliders: [collider([0, 0.7, 0], [0.8, 1.4, 0.5])],
  }));
  add('lamp-post', 'Floodlight', 'Depot', 'A yard floodlight. A lamp component lights it.', [], (e) => ({
    body: 'fixed',
    visuals: [
      part('cylinder', [0, 2.5, 0], [0.12, 5, 0.12], e.color ?? '#3e4a40'),
      box([0, 4.92, -0.42], [0.1, 0.1, 0.9], '#3e4a40'),
      box([0, 4.8, -0.85], [0.62, 0.2, 0.42], '#2f3a31'),
      part('box', [0, 4.69, -0.85], [0.52, 0.03, 0.32], '#5e5c50', { emissive: 1, lamp: true }),
    ],
    colliders: [collider([0, 2.5, 0], [0.3, 5, 0.3])],
  }));
  add('signal-mast', 'Signal mast', 'Depot', 'A line signal. A lamp component turns it from red to green.', [], (e) => ({
    body: 'fixed',
    visuals: [
      part('cylinder', [0, 1.9, 0], [0.12, 3.8, 0.12], e.color ?? '#3e4a40'),
      box([0, 4.15, 0], [0.5, 0.9, 0.36], '#25302a'),
      box([0, 4.62, 0], [0.62, 0.06, 0.46], '#25302a'),
      part('sphere', [0, 4.15, 0.19], [0.14, 0.14, 0.06], '#d8644a', { emissive: 1, lamp: true }),
    ],
    colliders: [collider([0, 2.1, 0], [0.5, 4.2, 0.4])],
  }));
  add(
    'berth',
    'Boarding berth',
    'Depot',
    'The end of a journey: completes the run when its channel is active.',
    [{ type: 'goal', channel: 'departure', requiresSignal: true, message: 'All aboard. Northbound departs.' }],
    (e) => ({
      body: 'fixed',
      visuals: [
        part('ring', [0, 0.03, 0], [0.9, 0.9, 0.9], e.color ?? palette.teal, { rotation: [90, 0, 0], emissive: 1 }),
        box([0, 0.24, -0.95], [1.9, 0.44, 0.5], '#6f6150'),
        box([0, 0.75, -1.15], [1.9, 0.6, 0.12], '#6f6150'),
      ],
      colliders: [collider([0, 1, 0], [2.2, 2, 2.2], true)],
    }),
  );
}
