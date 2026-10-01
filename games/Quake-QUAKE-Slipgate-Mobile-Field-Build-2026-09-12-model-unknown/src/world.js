// The arenas (built from boxes, cylinders and rings into one merged batch per material) and the
// models that move: monsters, pickups, projectiles, particles and the three weapons.
import { geometry, appendGeometry, boxGeometry, cylinderGeometry, ringGeometry, octahedronGeometry, mergeParts } from './geometry.js';
import { random } from './math.js';

export class World {
  constructor(level) {
    this.level = level;
    this.id = level.id;
    this.name = level.name;
    this.subtitle = level.subtitle;
    this.meta = level.meta;
    this.batches = new Map();
    this.colliders = [];
    this.lights = [];
    this.lava = [];
    this.pickups = [];
    this.decor = [];
    this.imported = false;
    this.spawn = [0, 0, 0];
    this.spawnYaw = 0;
    this.gateLight = -1;
    level.build(this);
    this.waves = level.waves;
    this.spots = level.spots;
    this.airSpots = level.airSpots || level.spots;
    this.secretCount = this.pickups.filter((p) => p.secret).length;
    this.menuCamera = level.menuCamera;
    this.menuEnemies = level.menuEnemies;
  }

  batch(mat, g, pos, rot, color) {
    if (!this.batches.has(mat)) this.batches.set(mat, geometry());
    appendGeometry(this.batches.get(mat), g, pos, rot, color);
  }

  box(pos, size, mat = 'stone', solid = false, rot = [0, 0, 0], color = [1, 1, 1]) {
    this.batch(mat, boxGeometry(size), pos, rot, color);
    if (solid) this.colliders.push({ min: pos.map((v, i) => v - size[i] / 2), max: pos.map((v, i) => v + size[i] / 2) });
  }

  cylinder(pos, r, h, mat = 'stone', n = 12, rot = [0, 0, 0], r2 = r) {
    this.batch(mat, cylinderGeometry(r, h, n, r2), pos, rot);
  }

  arch(z, r = 5.1, mat = 'stone') {
    for (const x of [-r - 0.45, r + 0.45]) {
      this.box([x, 2.7, z], [1.2, 5.4, 1.3], mat, true);
      this.box([x, 0.28, z], [1.75, 0.55, 1.9], 'trim', true);
      this.box([x, 5.35, z], [1.65, 0.38, 1.7], 'trim');
      this.box([x, 2.8, z + 0.72], [0.24, 4.7, 0.13], 'bronze');
    }
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) / n) * Math.PI;
      this.box([Math.cos(a) * (r + 0.1), 5.4 + Math.sin(a) * (r + 0.1), z], [1.38, 0.9, 1.5], 'trim', false, [0, 0, a + Math.PI / 2], [(i % 2) * 0.1 + 0.9, 0.95, 1]);
    }
    this.box([0, 11, z], [1.1, 0.65, 1.75], 'bronze');
  }

  torch(x, z) {
    this.box([x, 2.2, z], [0.45, 0.65, 0.45], 'bronze');
    this.cylinder([x, 2.66, z], 0.3, 0.18, 'metal', 8);
    this.cylinder([x, 2.98, z], 0.19, 0.64, 'orange', 7, [0, 0, 0], 0.015);
    this.cylinder([x, 2.94, z], 0.1, 0.46, 'white', 5, [0, 0, 0], 0.01);
    this.lights.push({ pos: [x, 3.1, z], color: [1, 0.37, 0.095], power: 28, range: 12, flicker: true });
    this.decor.push({ kind: 'flame', pos: [x, 3, z] });
  }

  /** The slipgate: a bronze ring around a rune disc set in a dark recess, with its own light. */
  gate(z, lightZ) {
    this.box([0, 5, z - 0.43], [9, 7.6, 0.6], 'dark');
    this.batch('bronze', ringGeometry(3, 0.22, 48), [0, 4.8, z]);
    this.batch('cyan', ringGeometry(2.73, 0.035, 48), [0, 4.8, z + 0.03]);
    this.batch('portal', cylinderGeometry(2.64, 0.045, 48), [0, 4.8, z - 0.06], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.box([Math.sin(a) * 3.25, 4.8 + Math.cos(a) * 3.25, z + 0.04], [0.09, 0.34, 0.09], 'cyan', false, [0, 0, -a]);
    }
    this.gateLight = this.lights.length;
    this.lights.push({ pos: [0, 4, lightZ], color: [0.04, 0.68, 1], power: 85, range: 19 });
    this.decor.push({ kind: 'gate', pos: [0, 4.8, z + 0.13] });
  }

  /** The highest walkable top under (x, z) within a 0.36 m step of y. `margin` is the footprint around the point. */
  floorAt(x, z, y = 100, margin = 0.15) {
    let floor = 0;
    for (const b of this.colliders) {
      if (x > b.min[0] - margin && x < b.max[0] + margin && z > b.min[2] - margin && z < b.max[2] + margin && b.max[1] <= y + 0.36) floor = Math.max(floor, b.max[1]);
    }
    return floor;
  }

  blocked(x, y, z, r = 0.32, height = 1.65) {
    for (const b of this.colliders) {
      if (y >= b.max[1] - 0.025 || y + height <= b.min[1] + 0.025) continue;
      if (x + r > b.min[0] && x - r < b.max[0] && z + r > b.min[2] && z - r < b.max[2]) return true;
    }
    return false;
  }

  isLava(p) {
    return p[1] < 0.15 && this.lavaAt(p[0], p[2]);
  }

  lavaAt(x, z) {
    for (const b of this.lava) if (x > b.min[0] && x < b.max[0] && z > b.min[2] && z < b.max[2]) return true;
    return false;
  }
}

/* ------------------------------------------------------------------ level 01: the original arena */

function buildVault(w) {
  w.spawn = [0, 0, 24];
  w.spawnYaw = 0;
  w.bounds = { min: [-17, -5, -39], max: [17, 24, 30] };
  w.exit = [0, 1.2, -33];
  w.clampXZ = { min: [-16.2, -38], max: [16.2, 29.4] };
  w.box([0, -0.45, -4], [35, 0.9, 70], 'floor', true);
  for (const s of [-1, 1]) {
    w.box([s * 17.2, 4.4, -4], [1.4, 9, 70], 'stone', true);
    for (let z = 24; z >= -36; z -= 10) {
      w.box([s * 16.2, 4.5, z], [1.1, 10.2, 1.7], 'trim', true);
      w.box([s * 15.55, 1, z], [0.4, 2.0, 2.3], 'metal');
      w.box([s * 16.2, 9.6, z], [2, 1.0, 2.6], 'bronze');
      w.box([s * 16.45, 6.3, z - 4], [0.15, 3.1, 2.4], 'dark');
      w.box([s * 16.34, 6.3, z - 4], [0.1, 2.5, 0.15], 'orange');
      w.box([s * 16.34, 6.3, z - 4], [0.1, 0.15, 1.7], 'orange');
    }
    w.box([s * 10, -0.01, -5.3], [9, 0.1, 26.5], 'lava');
    w.lava.push({ min: [s < 0 ? -14.5 : 5.5, 0, -18.55], max: [s < 0 ? -5.5 : 14.5, 0.1, 7.95] });
    w.box([s * 5.3, 0.14, -5.4], [0.45, 0.4, 27], 'bronze');
    w.box([s * 14.7, 0.14, -5.4], [0.45, 0.4, 27], 'bronze');
    for (const z of [-15, -3, 9]) {
      w.box([s * 10, 0.4, z], [9.5, 0.8, 2.2], 'floor', true);
      for (const x of [s * 6, s * 14]) {
        w.box([x, 1.05, z], [0.7, 1.3, 0.7], 'trim', true);
        w.cylinder([x, 1.8, z], 0.16, 0.55, 'cyan', 6);
      }
    }
    for (const z of [19, -7, -23]) w.torch(s * 5.8, z);
    for (const z of [11, -18]) {
      w.box([s * 11, 2.2, z], [2.7, 4.4, 2.7], 'stone', true);
      w.box([s * 11, 4.65, z], [3.2, 0.5, 3.2], 'trim');
      w.box([s * 11, 1, z], [2.9, 0.5, 2.9], 'bronze');
    }
  }
  w.box([0, 4.5, 30.4], [35, 9, 1.1], 'stone', true);
  w.box([0, 7.5, -39], [35, 15, 1.1], 'stone', true);
  for (const z of [15, -5, -26]) w.arch(z);
  for (const z of [27, 20, 11, 5, -2, -10, -19, -24]) {
    w.box([0, 0.015, z], [10, 0.04, 0.13], 'bronze');
    w.box([0, 0.018, z + 0.32], [9.8, 0.03, 0.045], 'trim');
  }
  // A stepped altar with a gate; each riser is below the player's step limit.
  for (let i = 0; i < 5; i++) w.box([0, (i + 1) * 0.12, -27.2 - i * 0.9], [9, (i + 1) * 0.24, 0.92], 'trim', true);
  w.box([0, 0.6, -34], [12, 1.2, 8], 'floor', true);
  w.gate(-36.68, -33);
  // Pillar recesses and an accessible secret alcove.
  w.box([-14.8, 1.7, 23], [2.5, 3.4, 4.8], 'dark');
  w.box([-14.6, 3.8, 23], [2.8, 0.5, 5.4], 'trim');
  w.box([13.5, 0.75, 23], [3.7, 1.5, 3.7], 'metal', true);
  w.pickups = [
    { kind: 'health', pos: [-14.3, 0.65, 23], secret: true },
    { kind: 'armor', pos: [12.7, 0.65, 9] },
    { kind: 'shells', pos: [-10, 0.95, -3] },
    { kind: 'rockets', pos: [10, 0.95, -15] },
    { kind: 'health', pos: [-12, 0.65, -24] },
    { kind: 'shells', pos: [3, 0.65, -21] },
  ];
  // Distant silhouettes are outside the playable bounds.
  const r = random(31);
  for (let i = 0; i < 18; i++) {
    const x = (i - 9) * 9;
    w.cylinder([x, 9 + r() * 5, -61 - r() * 20], 8 + r() * 7, 23 + r() * 15, 'dark', 4, [0, r() * 3, 0], 0.1);
  }
  w.cylinder([-19, 24, -78], 4, 0.08, 'white', 40, [Math.PI / 2, 0, 0]);
}

/* ------------------------------------------------------------------ level 02: the Ash Cloister */

function buildCloister(w) {
  w.spawn = [0, 0, 19.5];
  w.spawnYaw = 0;
  w.bounds = { min: [-21, -5, -23], max: [21, 24, 23] };
  w.exit = [0, 0.48, -19.6];
  w.clampXZ = { min: [-19.6, -21.6], max: [19.6, 21.6] };

  w.box([0, -0.45, 0], [40, 0.9, 44], 'ash', true);
  w.box([-20.6, 5, 0], [1.2, 10, 46], 'slate', true);
  w.box([20.6, 5, 0], [1.2, 10, 46], 'slate', true);
  w.box([0, 5, 22.6], [42.4, 10, 1.2], 'slate', true);
  w.box([0, 7.5, -22.6], [42.4, 15, 1.2], 'slate', true);
  for (const s of [-1, 1]) {
    for (const z of [18, 9, 0, -9, -18]) {
      w.box([s * 19.55, 4.5, z], [1.1, 10.2, 1.7], 'trim', true);
      w.box([s * 18.85, 1, z], [0.4, 2.0, 2.3], 'metal');
      w.box([s * 19.5, 9.6, z], [2, 1.0, 2.6], 'bronze');
      if (z > -18) {
        w.box([s * 19.8, 6.3, z - 4.5], [0.15, 3.1, 2.4], 'dark');
        w.box([s * 19.68, 6.3, z - 4.5], [0.1, 2.5, 0.15], 'orange');
        w.box([s * 19.68, 6.3, z - 4.5], [0.1, 0.15, 1.7], 'orange');
      }
    }
    // Low cover walls on the flanks.
    w.box([s * 13.5, 0.55, 0], [1, 1.1, 5], 'trim', true);
    w.box([s * 13.5, 1.16, 0], [1.2, 0.12, 5.2], 'bronze');
  }

  // The moat: a ring of lava around the reliquary, crossed by four low bridges.
  w.box([0, -0.01, -8], [20, 0.1, 4], 'lava');
  w.box([0, -0.01, 8], [20, 0.1, 4], 'lava');
  w.box([-8, -0.01, 0], [4, 0.1, 12], 'lava');
  w.box([8, -0.01, 0], [4, 0.1, 12], 'lava');
  w.lava.push(
    { min: [-10, 0, -10], max: [10, 0.1, -6] },
    { min: [-10, 0, 6], max: [10, 0.1, 10] },
    { min: [-10, 0, -6], max: [-6, 0.1, 6] },
    { min: [6, 0, -6], max: [10, 0.1, 6] }
  );
  for (const s of [-1, 1]) {
    w.box([0, 0.14, s * 10.2], [20.85, 0.4, 0.45], 'bronze');
    w.box([s * 10.2, 0.14, 0], [0.45, 0.4, 20], 'bronze');
  }
  w.box([0, 0.1, -8], [3.2, 0.2, 4.6], 'floor', true);
  w.box([0, 0.1, 8], [3.2, 0.2, 4.6], 'floor', true);
  w.box([-8, 0.1, 0], [4.6, 0.2, 3.2], 'floor', true);
  w.box([8, 0.1, 0], [4.6, 0.2, 3.2], 'floor', true);
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      w.box([s * 2.1, 0.6, t * 10.75], [0.6, 1.2, 0.6], 'trim', true);
      w.cylinder([s * 2.1, 1.45, t * 10.75], 0.14, 0.5, 'cyan', 6);
      w.box([t * 10.75, 0.6, s * 2.1], [0.6, 1.2, 0.6], 'trim', true);
      w.cylinder([t * 10.75, 1.45, s * 2.1], 0.14, 0.5, 'cyan', 6);
    }
  }

  // The reliquary: a stepped dais, four obelisks and a brazier on the altar.
  w.box([0, 0.12, 0], [12, 0.24, 12], 'trim', true);
  w.box([0, 0.36, 0], [8.4, 0.24, 8.4], 'floor', true);
  w.box([0, 0.9, 0], [2.2, 0.84, 2.2], 'trim', true);
  w.box([0, 1.36, 0], [2.5, 0.1, 2.5], 'bronze');
  w.cylinder([0, 1.6, 0], 0.55, 0.46, 'bronze', 10, [0, 0, 0], 0.95);
  w.cylinder([0, 2.05, 0], 0.6, 0.9, 'orange', 7, [0, 0, 0], 0.02);
  w.cylinder([0, 1.98, 0], 0.3, 0.6, 'white', 5, [0, 0, 0], 0.01);
  w.lights.push({ pos: [0, 2.7, 0], color: [1, 0.42, 0.12], power: 60, range: 16, flicker: true });
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      w.box([s * 3.4, 1.7, t * 3.4], [0.7, 2.5, 0.7], 'slate', true);
      w.box([s * 3.4, 3.05, t * 3.4], [0.95, 0.2, 0.95], 'bronze');
      w.batch('cyan', octahedronGeometry(0.28), [s * 3.4, 3.45, t * 3.4]);
    }
  }

  // Four squat corner towers. The north-east one can be climbed from a crate stack: that is the secret.
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      w.box([s * 15, 1.35, t * 15], [4, 2.7, 4], 'slate', true);
      w.box([s * 15, 2.6, t * 15], [4.3, 0.18, 4.3], 'trim');
      w.box([s * 15, 1.2, t * 15], [4.15, 0.3, 4.15], 'bronze');
      w.box([s * 15, 0.25, t * 15], [4.4, 0.5, 4.4], 'trim');
    }
  }
  w.box([15.75, 0.45, -12.0], [1, 0.9, 1], 'metal', true);
  w.box([14.6, 0.9, -12.45], [1.1, 1.8, 1.1], 'metal', true);
  w.box([13.4, 0.35, -11.6], [0.7, 0.7, 0.7], 'bronze', true);
  w.batch('cyan', octahedronGeometry(0.22), [15, 4.3, -15]);
  w.lights.push({ pos: [15, 3.9, -15], color: [0.1, 0.75, 1], power: 12, range: 6 });

  w.arch(14, 5.1, 'slate');
  w.arch(-14, 5.1, 'slate');
  for (const s of [-1, 1]) {
    w.torch(s * 7.2, 14);
    w.torch(s * 7.2, -14);
  }

  // The north gate on a raised platform.
  w.box([0, 0.12, -16.4], [10, 0.24, 1.2], 'trim', true);
  w.box([0, 0.24, -19.5], [11, 0.48, 5], 'floor', true);
  for (const s of [-1, 1]) w.box([s * 5.2, 0.62, -19.5], [0.5, 0.3, 4.8], 'bronze');
  w.gate(-21.28, -18.5);

  // Floor inlays leading to the gate.
  for (const z of [20, 17, -11.5]) {
    w.box([0, 0.015, z], [8, 0.04, 0.13], 'bronze');
    w.box([0, 0.018, z + 0.32], [7.8, 0.03, 0.045], 'trim');
  }

  w.pickups = [
    { kind: 'armor', pos: [15, 3.35, -15], secret: true },
    { kind: 'armor', pos: [0, 1.13, 3.0] },
    { kind: 'health', pos: [-13, 0.65, 6] },
    { kind: 'health', pos: [12, 0.65, 12] },
    { kind: 'health', pos: [0, 0.65, -12.5] },
    { kind: 'shells', pos: [-15, 0.65, 8] },
    { kind: 'shells', pos: [15, 0.65, 8] },
    { kind: 'rockets', pos: [-16, 0.65, -6] },
    { kind: 'rockets', pos: [16, 0.65, -6] },
  ];

  const r = random(77);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = 46 + r() * 16;
    w.cylinder([Math.sin(a) * d, 8 + r() * 6, Math.cos(a) * d], 7 + r() * 6, 20 + r() * 14, 'dark', 4, [0, r() * 3, 0], 0.1);
  }
  w.cylinder([16, 26, -60], 3.2, 0.08, 'white', 40, [Math.PI / 2, 0, 0]);
}

/**
 * Every arena: its waves (one monster type per entry, spawned at `spots` in turn, wraiths at
 * `airSpots`), the title-screen camera and the monsters posed for it.
 */
export const LEVELS = [
  {
    id: 'vault',
    number: 1,
    name: 'THE CINDER VAULT',
    subtitle: '01 / THE SLIPGATE',
    meta: '3 WAVES · 1 SECRET · NO MERCY',
    start: 'ENTER THE VAULT',
    build: buildVault,
    // [2, -28.6] was [2, -29], which put a monster's body inside the next altar step.
    spots: [[-3, 6], [3, -11], [-2, -21], [2, -28.6], [-3, 17], [3, -3], [-11, 9], [11, -3]],
    waves: [
      ['grunt', 'imp', 'grunt', 'grunt'],
      ['grunt', 'imp', 'grunt', 'grunt', 'imp', 'grunt'],
      ['grunt', 'imp', 'grunt', 'grunt', 'imp', 'grunt', 'brute', 'brute'],
    ],
    menuCamera: { pos: [-7.3, 3.0, 22.5], yaw: -0.21, pitch: 0.08, fov: 74 },
    menuEnemies: [
      { type: 'grunt', pos: [2, 0, -1], yaw: -0.3 },
      { type: 'imp', pos: [-2, 0, -16], yaw: 0 },
    ],
  },
  {
    id: 'cloister',
    number: 2,
    name: 'THE ASH CLOISTER',
    subtitle: '02 / THE RELIQUARY',
    meta: '4 WAVES · 1 SECRET · WRAITHS ABOVE',
    start: 'ENTER THE CLOISTER',
    build: buildCloister,
    // Walkers spawn clear of the arch pillars, towers and the moat.
    spots: [[-15, 8], [15, -8], [-7.5, -12], [7.5, -12], [-16, -4], [16, 4], [0, -17.5], [-12, -18], [12, 18], [-12, 18]],
    airSpots: [[-8, 0], [8, 0], [0, -8], [-14, -10], [14, 10], [0, 8]],
    waves: [
      ['grunt', 'imp', 'grunt', 'grunt', 'imp', 'grunt'],
      ['wraith', 'grunt', 'imp', 'wraith', 'grunt', 'imp', 'grunt'],
      ['brute', 'wraith', 'imp', 'grunt', 'wraith', 'imp', 'brute', 'grunt'],
      ['brute', 'wraith', 'imp', 'brute', 'wraith', 'imp', 'wraith', 'grunt', 'brute'],
    ],
    menuCamera: { pos: [-6.5, 3.1, 19.5], yaw: -0.3, pitch: 0.02, fov: 74 },
    menuEnemies: [
      { type: 'brute', pos: [1.6, 0.2, 8.6], yaw: -2.9, scale: 1.38 },
      { type: 'wraith', pos: [4.5, 3.4, 2], yaw: -2.6 },
      { type: 'imp', pos: [-2.6, 0.48, -2.6], yaw: 2.8 },
    ],
  },
];

export function makeModels() {
  const models = {};
  const add = (name, parts) => (models[name] = parts.map((p) => ({ mat: p.mat, g: mergeParts(p.parts) })));
  const part = (g, pos = [0, 0, 0], rot = [0, 0, 0], color = [1, 1, 1]) => ({ g, pos, rot, color });
  const b = (s, p, r, c) => part(boxGeometry(s), p, r, c);
  const c = (radius, h, p, r, n = 10, r2 = radius) => part(cylinderGeometry(radius, h, n, r2), p, r);
  add('grunt', [
    { mat: 'metal', parts: [b([0.85, 0.95, 0.45], [0, 1.04, 0]), b([0.27, 0.65, 0.33], [-0.28, 0.34, 0]), b([0.27, 0.65, 0.33], [0.28, 0.34, 0]), b([0.28, 0.65, 0.3], [-0.63, 1.0, 0], [0, 0, -0.15]), b([0.28, 0.65, 0.3], [0.63, 1.0, 0], [0, 0, 0.15])] },
    { mat: 'bone', parts: [b([0.5, 0.48, 0.47], [0, 1.76, 0]), b([0.31, 0.19, 0.16], [0, 1.55, -0.22])] },
    { mat: 'orange', parts: [b([0.35, 0.065, 0.06], [0, 1.79, -0.25]), b([0.32, 0.25, 0.05], [0, 1.12, -0.25])] },
    { mat: 'bronze', parts: [c(0.13, 0.7, [0.5, 0.98, -0.31], [Math.PI / 2, 0, 0]), b([1.05, 0.2, 0.58], [0, 1.42, 0])] },
  ]);
  add('imp', [
    { mat: 'red', parts: [part(octahedronGeometry(0.66), [0, 1.28, 0]), b([0.18, 0.85, 0.24], [-0.29, 0.45, 0], [0, 0, 0.18]), b([0.18, 0.85, 0.24], [0.29, 0.45, 0], [0, 0, -0.18]), b([0.2, 0.75, 0.25], [-0.58, 1.2, 0], [0, 0, -0.38]), b([0.2, 0.75, 0.25], [0.58, 1.2, 0], [0, 0, 0.38])] },
    { mat: 'bone', parts: [part(octahedronGeometry(0.39), [0, 1.96, 0]), c(0.13, 0.52, [-0.29, 2.2, 0], [0, 0, 0.45], 5, 0), c(0.13, 0.52, [0.29, 2.2, 0], [0, 0, -0.45], 5, 0)] },
    { mat: 'orange', parts: [b([0.28, 0.075, 0.08], [0, 2, -0.3]), part(octahedronGeometry(0.16), [-0.7, 0.8, -0.1]), part(octahedronGeometry(0.16), [0.7, 0.8, -0.1])] },
  ]);
  // The wraith: a hooded skull on a tattered robe, wing blades, a cyan heart. It flies; its origin is its centre.
  add('wraith', [
    { mat: 'dark', parts: [c(0.05, 1.25, [0, -0.5, 0], [0, 0, 0], 7, 0.48), c(0.5, 0.42, [0, 0.3, 0.02], [0, 0, 0], 7, 0.3)] },
    { mat: 'bone', parts: [part(octahedronGeometry(0.31), [0, 0.62, -0.06]), c(0.07, 0.42, [-0.19, 0.9, 0.02], [0, 0, 0.55], 5, 0), c(0.07, 0.42, [0.19, 0.9, 0.02], [0, 0, -0.55], 5, 0), b([0.08, 0.55, 0.08], [-0.42, -0.08, -0.12], [0.3, 0, 0.35]), b([0.08, 0.55, 0.08], [0.42, -0.08, -0.12], [0.3, 0, -0.35])] },
    { mat: 'cyan', parts: [b([0.26, 0.05, 0.05], [0, 0.66, -0.33]), part(octahedronGeometry(0.13), [0, 0.05, -0.36])] },
    { mat: 'metal', parts: [b([1.15, 0.05, 0.42], [-0.75, 0.38, 0.12], [0.1, 0.2, 0.42]), b([1.15, 0.05, 0.42], [0.75, 0.38, 0.12], [0.1, -0.2, -0.42])] },
  ]);
  add('health', [
    { mat: 'white', parts: [b([0.56, 0.56, 0.56])] },
    { mat: 'red', parts: [b([0.12, 0.4, 0.015], [0, 0, 0.29]), b([0.4, 0.12, 0.015], [0, 0, 0.29]), b([0.12, 0.4, 0.015], [0, 0, -0.29]), b([0.4, 0.12, 0.015], [0, 0, -0.29])] },
  ]);
  add('armor', [{ mat: 'cyan', parts: [part(octahedronGeometry(0.47))] }, { mat: 'metal', parts: [b([0.45, 0.54, 0.2])] }]);
  for (const [name, mat] of [['shells', 'bronze'], ['rockets', 'orange']]) {
    add(name, [{ mat: 'metal', parts: [b([0.65, 0.4, 0.5])] }, { mat, parts: [c(0.09, 0.48, [-0.19, 0.22, 0]), c(0.09, 0.48, [0, 0.22, 0]), c(0.09, 0.48, [0.19, 0.22, 0])] }]);
  }
  add('shotgun', [
    { mat: 'metal', parts: [b([0.22, 0.17, 0.5], [0.19, -0.22, -0.48]), c(0.071, 0.57, [0.125, -0.17, -0.73], [Math.PI / 2, 0, 0]), c(0.071, 0.57, [0.26, -0.17, -0.73], [Math.PI / 2, 0, 0]), b([0.3, 0.15, 0.11], [0.19, -0.15, -0.45])] },
    { mat: 'bronze', parts: [b([0.24, 0.13, 0.2], [0.19, -0.245, -0.62]), b([0.14, 0.24, 0.12], [0.19, -0.36, -0.29], [0.25, 0, 0]), b([0.29, 0.03, 0.12], [0.19, -0.255, -0.65])] },
    { mat: 'bone', parts: [b([0.15, 0.15, 0.32], [0.36, -0.37, -0.31], [-0.15, -0.3, -0.4]), b([0.14, 0.12, 0.2], [0.01, -0.35, -0.55], [0.5, 0, 0.3])] },
    { mat: 'cyan', parts: [b([0.02, 0.025, 0.05], [0.19, -0.055, -0.48])] },
  ]);
  add('nailgun', [
    { mat: 'metal', parts: [b([0.32, 0.24, 0.43], [0.19, -0.25, -0.5]), c(0.115, 0.58, [0.19, -0.19, -0.71], [Math.PI / 2, 0, 0])] },
    { mat: 'bronze', parts: [b([0.12, 0.23, 0.1], [0.2, -0.37, -0.29]), c(0.14, 0.08, [0.19, -0.19, -0.54], [Math.PI / 2, 0, 0]), c(0.14, 0.08, [0.19, -0.19, -0.67], [Math.PI / 2, 0, 0]), c(0.14, 0.08, [0.19, -0.19, -0.8], [Math.PI / 2, 0, 0])] },
    { mat: 'cyan', parts: [b([0.27, 0.025, 0.07], [0.19, -0.105, -0.52])] },
  ]);
  add('launcher', [
    { mat: 'metal', parts: [c(0.19, 0.78, [0.18, -0.22, -0.55], [Math.PI / 2, 0, 0]), b([0.15, 0.24, 0.1], [0.18, -0.4, -0.3])] },
    { mat: 'bronze', parts: [c(0.22, 0.12, [0.18, -0.22, -0.8], [Math.PI / 2, 0, 0]), b([0.25, 0.07, 0.32], [0.18, -0.06, -0.47])] },
    { mat: 'orange', parts: [c(0.15, 0.012, [0.18, -0.22, -0.868], [Math.PI / 2, 0, 0])] },
  ]);
  models.spark = [{ mat: 'orange', g: octahedronGeometry(0.09) }];
  models.fireball = [{ mat: 'orange', g: octahedronGeometry(0.22) }];
  models.smoke = [{ mat: 'dark', g: octahedronGeometry(0.15) }];
  models.flash = [{ mat: 'orange', g: octahedronGeometry(0.2) }];
  models.bolt = [{ mat: 'cyan', g: octahedronGeometry(0.17) }];
  models.mote = [{ mat: 'cyan', g: octahedronGeometry(0.075) }];
  models.gib = [{ mat: 'red', g: octahedronGeometry(0.1) }];
  return models;
}

/** Models drawn with another model's batches (a brute is a big grunt). */
export const MODEL_ALIAS = { brute: 'grunt' };
/** The view-model weapons: drawn attached to the camera, not instanced. */
export const WEAPON_MODELS = ['shotgun', 'nailgun', 'launcher'];
