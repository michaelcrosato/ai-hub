/* ASHFALL — shared, fixed-step game rules. No DOM, no rendering, no packages.
   The simulation runs at 30 Hz (main.js steps it) and keeps plain data only, so a
   mission can be saved to localStorage and continued later. */

export const HALF = 480, CELL = 12, N = 80, TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Seeded generator used to build maps and art (the same seed always gives the same world). */
export function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function height(x, z) {
  const f = clamp((Math.max(Math.abs(x), Math.abs(z)) - 125) / 60, 0, 1);
  return 2 + f * (Math.sin(x * 0.017) * Math.cos(z * 0.013) * 5 + Math.sin(z * 0.031 + x * 0.006) * 2.3 + Math.cos(x * 0.043 - z * 0.021) * 1.3);
}

export const classes = [
  { name: 'WARDEN', role: 'Heavy assault', color: '#77ddeb', hp: 300, speed: 26, range: 61, damage: 23, rate: 0.4, ability: ['SHOCK GRENADE', 'REPAIR FIELD', 'ORBITAL STRIKE'], short: ['SHOCK', 'REPAIR', 'STRIKE'], cd: [10, 19, 38] },
  { name: 'RANGER', role: 'Long-range fire', color: '#f2c678', hp: 205, speed: 30, range: 87, damage: 64, rate: 1.0, ability: ['PIERCING SHOT', 'REPAIR FIELD', 'ORBITAL STRIKE'], short: ['PIERCE', 'REPAIR', 'STRIKE'], cd: [9, 21, 38] },
  { name: 'ENGINEER', role: 'Field support', color: '#95ddb2', hp: 250, speed: 27, range: 65, damage: 19, rate: 0.35, ability: ['ARC BURST', 'REPAIR FIELD', 'ORBITAL STRIKE'], short: ['ARC', 'REPAIR', 'STRIKE'], cd: [11, 13, 34] },
];

/** The four fortress gates: south, west, north, east. Every operation assaults the same stronghold design. */
export const gates = [{ x: 0, z: 132 }, { x: -132, z: 0 }, { x: 0, z: -132 }, { x: 132, z: 0 }];

/**
 * Operations. 01 is the original mission, unchanged. 02 is a night siege on a new
 * outer ground with its own relays, landing zones and two new enemy types.
 * Each relay leads to one gate (roads run landing zone → relay → gate → core).
 */
export const OPERATIONS = [
  {
    id: 'citadel',
    num: '01',
    name: 'THE CITADEL',
    tagline: 'Four gates · three fronts',
    caption: '960 × 960 m · FOUR GATES · THREE FRONTS',
    starts: [{ x: 174, z: 373 }, { x: -372, z: 100 }, { x: 326, z: -307 }],
    relays: [
      { x: 190, z: 232, name: 'SOUTH / FOUNDRY', short: 'A', gate: 0 },
      { x: -238, z: 66, name: 'WEST / QUARRY', short: 'B', gate: 1 },
      { x: 178, z: -244, name: 'NORTH / RIDGE', short: 'C', gate: 2 },
    ],
    spur: { from: { x: 410, z: 0 }, gate: 3 },
    ruins: [[-185, 284], [-315, -195], [298, 114], [-29, -331], [315, 315], [-116, 343], [48, 231]],
    mapSeed: 7419,
    deadTrees: 0.21,
    coreHp: 9000,
    firstWave: 25,
    waveGap: 38,
    reinforcements: 6,
    roster: 'classic',
  },
  {
    id: 'emberfall',
    num: '02',
    name: 'EMBERFALL',
    tagline: 'Night siege · sappers and mortars',
    caption: '960 × 960 m · ASH FIELDS · NIGHT SIEGE',
    starts: [{ x: -395, z: 300 }, { x: -300, z: -380 }, { x: 398, z: -236 }],
    relays: [
      { x: -232, z: 196, name: 'SOUTHWEST / KILN', short: 'A', gate: 1 },
      { x: -48, z: -270, name: 'NORTH / ASH DAM', short: 'B', gate: 2 },
      { x: 268, z: -62, name: 'EAST / SLAG FIELD', short: 'C', gate: 3 },
    ],
    spur: { from: { x: 0, z: 425 }, gate: 0 },
    ruins: [[-128, 318], [-352, 42], [128, -372], [322, 212], [176, 318], [-372, -176], [58, 392]],
    mapSeed: 5281,
    deadTrees: 0.72,
    coreHp: 10500,
    firstWave: 28,
    waveGap: 36,
    reinforcements: 5,
    roster: 'ember',
  },
];
export const opById = (id) => OPERATIONS.find((o) => o.id === id) || OPERATIONS[0];

/** [hp, speed, range, damage, rate] per enemy type. */
const ENEMY_STATS = {
  trooper: [82, 15, 5, 10, 1.1],
  gunner: [115, 11, 64, 13, 1.65],
  brute: [320, 10, 8, 28, 1.35],
  turret: [540, 0, 79, 16, 1.8],
  boss: [1750, 10, 13, 35, 1.4],
  // Emberfall: a fast charge carrier that arms itself next to a hero, and slow artillery crews.
  sapper: [64, 21, 6, 58, 1],
  mortar: [150, 7, 145, 26, 5.5],
};
export const ENEMY_TYPES = Object.keys(ENEMY_STATS);
export const ENEMY_SCALE = { trooper: 1, gunner: 1, brute: 1.6, turret: 1.3, boss: 2.7, sapper: 0.95, mortar: 1.15 };
const XP = { boss: 70, brute: 16, mortar: 10 };
export const SAPPER_FUSE = 0.75, SAPPER_RADIUS = 13;

export function pointSeg(x, z, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
}

/* ------------------------------------------------------------------ the map */

const SC = 24, SG = Math.ceil((HALF * 2) / SC) + 2;
const solidCell = (v) => clamp(Math.floor((v + HALF) / SC) + 1, 0, SG - 1);

function makeMap(op) {
  const random = rng(op.mapSeed), solids = [], props = [], roads = [];
  const starts = op.starts, relayDefs = op.relays;
  const rect = (x, z, w, d, h, kind) => {
    const o = { x, z, w, d, h, kind };
    solids.push(o);
    props.push(o);
  };
  for (let k = 0; k < 3; k++) {
    const g = gates[relayDefs[k].gate];
    roads.push([starts[k], relayDefs[k]]);
    roads.push([relayDefs[k], g]);
    roads.push([g, { x: 0, z: 0 }]);
  }
  roads.push([op.spur.from, gates[op.spur.gate]], [gates[op.spur.gate], { x: 0, z: 0 }]);
  const zv = (t) => t * 112;
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) {
      rect(s * 69, zv(t), 86, 10, 22, 'wall');
      rect(zv(t), s * 69, 10, 86, 22, 'wall');
    }
  }
  for (const x of [-112, 112]) for (const z of [-112, 112]) rect(x, z, 27, 27, 35, 'tower');
  for (const x of [-56, 56]) for (const z of [-54, 54]) rect(x, z, 25, 29, 12, 'barrack');
  const keep = [...relayDefs, ...starts];
  for (let i = 0; i < 130; i++) {
    const x = (random() * 2 - 1) * 452, z = (random() * 2 - 1) * 452;
    if (Math.max(Math.abs(x), Math.abs(z)) < 149 || roads.some((r) => pointSeg(x, z, r[0], r[1]) < 27) || keep.some((p) => Math.hypot(p.x - x, p.z - z) < 47)) continue;
    const r = 5 + random() * 12, h = 7 + random() * 23;
    const o = { x, z, r, h, kind: 'rock', rot: random() * TAU };
    props.push(o);
    solids.push(o);
  }
  for (let i = 0; i < 490; i++) {
    const x = (random() * 2 - 1) * 470, z = (random() * 2 - 1) * 470;
    if (Math.max(Math.abs(x), Math.abs(z)) < 146 || roads.some((r) => pointSeg(x, z, r[0], r[1]) < 16) || keep.some((p) => Math.hypot(p.x - x, p.z - z) < 38) || solids.some((p) => p.r && Math.hypot(x - p.x, z - p.z) < p.r + 5)) continue;
    if (random() > 0.74 && x > 0) continue;
    props.push({ x, z, r: 3 + random() * 4, h: 11 + random() * 15, kind: random() > op.deadTrees ? 'tree' : 'deadTree', rot: random() * TAU });
  }
  for (const [x, z] of op.ruins) {
    rect(x, z, 28, 7, 10, 'ruin');
    rect(x - 10, z - 11, 7, 17, 7, 'ruin');
    props.push({ x: x + 4, z: z - 7, w: 11, d: 9, h: 4, kind: 'wreck' });
  }
  solids.push({ x: 0, z: 0, r: 23, kind: 'core' });
  for (const r of relayDefs) solids.push({ x: r.x, z: r.z, r: 10, kind: 'relay' });

  // Spatial buckets: hits() is called for every step of every unit, so it only looks at
  // the solids near the query point (each bucket keeps a 5 m margin, more than any query radius).
  const buckets = Array.from({ length: SG * SG }, () => []);
  for (const o of solids) {
    const ex = (o.r ? o.r : o.w / 2) + 5, ez = (o.r ? o.r : o.d / 2) + 5;
    for (let cz = solidCell(o.z - ez); cz <= solidCell(o.z + ez); cz++) for (let cx = solidCell(o.x - ex); cx <= solidCell(o.x + ex); cx++) buckets[cz * SG + cx].push(o);
  }
  function hits(x, z, r = 3) {
    const list = buckets[solidCell(z) * SG + solidCell(x)];
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.r ? Math.hypot(x - o.x, z - o.z) < o.r + r : Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r) return true;
    }
    return false;
  }
  const blocked = new Uint8Array(N * N);
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) blocked[z * N + x] = hits(x * CELL - HALF + CELL / 2, z * CELL - HALF + CELL / 2) ? 1 : 0;
  return { props, solids, roads, blocked, hits, op };
}

const mapCache = new Map();
/** Maps are read-only after they are built, so each operation builds its map once. */
export function getMap(op) {
  let m = mapCache.get(op.id);
  if (!m) {
    m = makeMap(op);
    mapCache.set(op.id, m);
  }
  return m;
}

export function nearestCell(map, x, z) {
  const gx = clamp(Math.floor((x + HALF) / CELL), 0, N - 1), gz = clamp(Math.floor((z + HALF) / CELL), 0, N - 1);
  if (!map.blocked[gz * N + gx]) return gz * N + gx;
  for (let r = 1; r < 9; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const a = gx + dx, b = gz + dz;
        if (a >= 0 && a < N && b >= 0 && b < N && !map.blocked[b * N + a]) return b * N + a;
      }
    }
  }
  return gz * N + gx;
}

// A* buffers are shared between calls (a stamp marks what this call touched), so the
// hundreds of re-paths per second allocate nothing but the returned path.
const NN = N * N;
const pfVisit = new Uint32Array(NN), pfDone = new Uint32Array(NN), pfCost = new Float32Array(NN), pfPrev = new Int32Array(NN);
const HEAP_MAX = 48000, heapN = new Int32Array(HEAP_MAX), heapF = new Float32Array(HEAP_MAX);
const DIRS = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
let pfStamp = 0;

export function pathfind(map, from, to) {
  const start = nearestCell(map, from.x, from.z), end = nearestCell(map, to.x, to.z);
  if (start === end) return [{ x: to.x, z: to.z }];
  if (++pfStamp >= 0xffffffff) {
    pfStamp = 1;
    pfVisit.fill(0);
    pfDone.fill(0);
  }
  const stamp = pfStamp;
  const hx = end % N, hz = (end / N) | 0;
  let size = 0;
  const push = (n, f) => {
    if (size >= HEAP_MAX) return;
    let k = size++;
    while (k) {
      const p = (k - 1) >> 1;
      if (heapF[p] <= f) break;
      heapN[k] = heapN[p];
      heapF[k] = heapF[p];
      k = p;
    }
    heapN[k] = n;
    heapF[k] = f;
  };
  const pop = () => {
    const out = heapN[0];
    size--;
    if (size > 0) {
      const vn = heapN[size], vf = heapF[size];
      let k = 0;
      while (k * 2 + 1 < size) {
        let c = k * 2 + 1;
        if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= vf) break;
        heapN[k] = heapN[c];
        heapF[k] = heapF[c];
        k = c;
      }
      heapN[k] = vn;
      heapF[k] = vf;
    }
    return out;
  };
  pfVisit[start] = stamp;
  pfCost[start] = 0;
  pfPrev[start] = -1;
  push(start, 0);
  let count = 0;
  while (size && count++ < 5000) {
    const cur = pop();
    if (pfDone[cur] === stamp) continue;
    if (cur === end) break;
    pfDone[cur] = stamp;
    const x = cur % N, z = (cur / N) | 0;
    for (let d = 0; d < 16; d += 2) {
      const dx = DIRS[d], dz = DIRS[d + 1], xx = x + dx, zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= N || zz >= N) continue;
      const ni = zz * N + xx;
      if (map.blocked[ni] || pfDone[ni] === stamp) continue;
      if (dx && dz && (map.blocked[z * N + xx] || map.blocked[zz * N + x])) continue;
      const nc = pfCost[cur] + (dx && dz ? 1.414 : 1);
      if (pfVisit[ni] !== stamp || nc < pfCost[ni]) {
        pfVisit[ni] = stamp;
        pfCost[ni] = nc;
        pfPrev[ni] = cur;
        push(ni, nc + Math.hypot(xx - hx, zz - hz));
      }
    }
  }
  if (pfVisit[end] !== stamp) return [];
  const result = [];
  for (let n = end; n !== start; n = pfPrev[n]) {
    if (n < 0) return [];
    result.push({ x: (n % N) * CELL - HALF + CELL / 2, z: Math.floor(n / N) * CELL - HALF + CELL / 2 });
  }
  result.reverse();
  if (!map.hits(to.x, to.z, 4)) result.push({ x: to.x, z: to.z });
  return result;
}

export function lineClear(map, a, b) {
  const d = dist(a, b), stop = b.x === 0 && b.z === 0 ? 26 : 4;
  for (let t = 5; t < d - stop; t += 6) {
    const f = t / d;
    if (map.hits(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, 0.5)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ crowd separation grid */

const SEP_G = 110, SEP_OFF = 55;
const sepHead = new Int32Array(SEP_G * SEP_G);
let sepNext = new Int32Array(512);

/* ------------------------------------------------------------------ the simulation */

export class Simulation {
  /**
   * @param {'easy'|'normal'|'hard'} difficulty
   * @param {string} opId      operation id (see OPERATIONS)
   * @param {boolean} fresh    false when a save will be restored into it (no garrison)
   */
  constructor(difficulty = 'normal', opId = 'citadel', fresh = true) {
    this.op = opById(opId);
    this.map = getMap(this.op);
    this.seed = 81911;
    this.difficulty = ['easy', 'normal', 'hard'].includes(difficulty) ? difficulty : 'normal';
    this.factor = this.difficulty === 'easy' ? 0.7 : this.difficulty === 'hard' ? 1.35 : 1;
    this.time = 0;
    this.wave = 0;
    this.nextWave = this.op.firstWave;
    this.kills = 0;
    this.xp = 0;
    this.level = 1;
    this.reinforcements = this.op.reinforcements;
    this.status = 'active';
    this.nextId = 10;
    this.eventId = 0;
    this.events = [];
    this.heroes = this.op.starts.map((p, i) => ({
      id: i, x: p.x, z: p.z, hp: classes[i].hp, maxHp: classes[i].hp, angle: Math.PI, cd: [0, 0, 0, 0], shot: 0, alive: true, down: 0, revive: 0,
      bot: true, path: [], nav: 0, energy: 100, shield: 0, kills: 0, order: 'ADVANCE', tx: p.x, tz: p.z, moving: false, hit: 0,
    }));
    this.relays = this.op.relays.map((p, i) => ({ x: p.x, z: p.z, name: p.name, short: p.short, id: i, capture: 0, active: false }));
    this.core = { x: 0, z: 0, hp: this.op.coreHp, maxHp: this.op.coreHp, shield: true };
    this.enemies = [];
    this.effects = [];
    this.pickups = [];
    this.inputs = {};
    this.auto = [true, true, true];
    if (fresh) this.garrison();
  }

  /** The simulation's own dice (same sequence as the original generator, but its state can be saved). */
  random() {
    const s = (this.seed = (this.seed + 0x6d2b79f5) | 0);
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  garrison() {
    const ember = this.op.roster === 'ember';
    for (let i = 0; i < 3; i++) {
      const r = this.relays[i];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        this.spawn(r.x + Math.cos(a) * 40, r.z + Math.sin(a) * 40, k === 0 ? 'brute' : ember && k === 3 ? 'mortar' : ember && k === 5 ? 'sapper' : 'trooper');
      }
    }
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      this.spawn(Math.cos(a) * 180, Math.sin(a) * 180, i % 6 === 0 ? 'gunner' : ember && i % 5 === 2 ? 'sapper' : 'trooper');
    }
    for (const x of [-84, 84]) for (const z of [-84, 84]) this.spawn(x, z, 'turret');
    if (ember) for (const z of [-38, 38]) this.spawn(0, z, 'mortar');
  }

  event(type, data = {}) {
    this.events.push({ id: ++this.eventId, type, t: this.time, ...data });
    if (this.events.length > 90) this.events.shift();
  }

  spawn(x, z, type = 'trooper') {
    const stats = ENEMY_STATS[type] || ENEMY_STATS.trooper;
    if (this.map.hits(x, z, 3)) {
      const n = nearestCell(this.map, x, z);
      x = (n % N) * CELL - HALF + 6;
      z = ((n / N) | 0) * CELL - HALF + 6;
    }
    const hp = stats[0] * (1 + this.wave * 0.065) * this.factor;
    this.enemies.push({
      id: this.nextId++, x, z, type, hp, maxHp: hp, speed: stats[1], range: stats[2], damage: stats[3] * this.factor, rate: stats[4],
      angle: 0, shot: this.random() * 2, path: [], nav: this.random() * 1.6, stun: 0, alive: true, hit: 0, fuse: 0,
    });
  }

  setInput(id, input) {
    if (!this.heroes[id] || !input) return;
    const num = (n, lo, hi) => (Number.isFinite(n) ? clamp(n, lo, hi) : 0);
    const cur = this.inputs[id] || (this.inputs[id] = {});
    cur.mx = num(input.mx, -1, 1);
    cur.mz = num(input.mz, -1, 1);
    cur.ax = num(input.ax, -HALF, HALF);
    cur.az = num(input.az, -HALF, HALF);
    cur.fire = !!input.fire;
    cur.sprint = !!input.sprint;
  }

  command(id, cmd) {
    const h = this.heroes[id];
    if (!h || !cmd) return false;
    if (cmd.type === 'move' && Number.isFinite(cmd.x) && Number.isFinite(cmd.z)) {
      h.path = pathfind(this.map, h, { x: clamp(cmd.x, -465, 465), z: clamp(cmd.z, -465, 465) });
      h.order = 'MOVE';
    }
    if (cmd.type === 'stop') {
      h.path = [];
      h.order = 'HOLD';
    }
    if (cmd.type === 'auto') this.auto[id] = !this.auto[id];
    if (cmd.type === 'ability') {
      return this.ability(h, clamp(cmd.slot | 0, 0, 3), { x: Number.isFinite(cmd.x) ? clamp(cmd.x, -480, 480) : h.x, z: Number.isFinite(cmd.z) ? clamp(cmd.z, -480, 480) : h.z });
    }
    return true;
  }

  move(h, dx, dz, dt) {
    const ox = h.x, oz = h.z;
    const x = clamp(ox + dx * dt, -468, 468), z = clamp(oz + dz * dt, -468, 468);
    if (!this.map.hits(x, z, 2.6)) {
      h.x = x;
      h.z = z;
    } else {
      if (!this.map.hits(x, oz, 2.6)) h.x = x;
      if (!this.map.hits(h.x, z, 2.6)) h.z = z;
    }
    return Math.hypot(h.x - ox, h.z - oz);
  }

  follow(h, speed, dt) {
    if (!h.path || !h.path.length) return 0;
    while (h.path.length > 1 && dist(h, h.path[0]) < 5) h.path.shift();
    const p = h.path[0], d = dist(h, p);
    if (d < 2) {
      h.path.shift();
      return 0;
    }
    const dx = (p.x - h.x) / d, dz = (p.z - h.z) / d;
    h.angle = Math.atan2(dx, dz);
    return this.move(h, dx * Math.min(speed, d / dt), dz * Math.min(speed, d / dt), dt);
  }

  damage(target, amount, hero = -1) {
    if (target.hp <= 0) return;
    if (target === this.core && this.core.shield) return;
    const dealt = amount * (target.shield > 0 ? 0.35 : 1);
    target.hp = Math.max(0, target.hp - dealt);
    target.hit = this.time;
    if (target.hp <= 0) {
      if (target === this.core) {
        this.status = 'victory';
        this.event('victory');
        return;
      }
      target.alive = false;
      this.event('death', { x: target.x, z: target.z, enemy: target.id > 3, kind: target.type || 'hero' });
      if (target.id < 3) {
        target.down = 30;
        target.path = [];
        this.event('down', { hero: target.id });
      } else {
        this.kills++;
        this.xp += XP[target.type] ?? 5;
        if (hero >= 0) this.heroes[hero].kills++;
        if (this.random() < 0.1) this.pickups.push({ x: target.x, z: target.z, life: 40 });
      }
    }
  }

  blast(x, z, r, damage, hero, type = 'blast') {
    this.event(type, { x, z, r, hero });
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.x - x, e.z - z) < r) {
        this.damage(e, damage, hero);
        e.stun = 1;
      }
    }
    if (Math.hypot(x, z) < r + 14) this.damage(this.core, damage, hero);
  }

  /** A sapper's charge goes off: heroes nearby take its damage, the sapper is gone (no kill credit). */
  detonate(e) {
    e.alive = false;
    e.hp = 0;
    e.fuse = 0;
    for (const h of this.heroes) if (h.alive && dist(h, e) < SAPPER_RADIUS) this.damage(h, e.damage);
    this.event('enemyBlast', { x: e.x, z: e.z, r: SAPPER_RADIUS });
  }

  ability(h, slot, target) {
    if (!h.alive || h.cd[slot] > 0 || this.status !== 'active') return false;
    const c = classes[h.id];
    const d = dist(h, target), f = d > 110 ? 110 / d : 1;
    target = { x: h.x + (target.x - h.x) * f, z: h.z + (target.z - h.z) * f };
    if (slot === 3) {
      const input = this.inputs[h.id] || {}, m = Math.hypot(input.mx || 0, input.mz || 0);
      const dx = m ? input.mx / m : Math.sin(h.angle), dz = m ? input.mz / m : Math.cos(h.angle);
      for (let i = 0; i < 12; i++) this.move(h, dx * 3.3, dz * 3.3, 1);
      h.cd[3] = 4.5;
      h.shield = 1;
      h.path = [];
      this.event('dash', { x: h.x, z: h.z, hero: h.id });
      return true;
    }
    h.cd[slot] = c.cd[slot];
    if (slot === 0) {
      if (h.id === 1) {
        this.event('beam', { x: h.x, z: h.z, tx: target.x, tz: target.z, hero: h.id });
        const dx = target.x - h.x, dz = target.z - h.z, dd = Math.hypot(dx, dz) || 1;
        const end = { x: h.x + (dx / dd) * 112, z: h.z + (dz / dd) * 112 };
        for (const e of this.enemies) if (e.alive && pointSeg(e.x, e.z, h, end) < 7 && lineClear(this.map, h, e)) this.damage(e, 165, h.id);
        if (pointSeg(0, 0, h, end) < 18 && lineClear(this.map, h, this.core)) this.damage(this.core, 165, h.id);
      } else {
        this.effects.push({ type: 'grenade', x: target.x, z: target.z, life: 0.65, r: h.id === 2 ? 26 : 23, damage: h.id === 2 ? 115 : 140, hero: h.id });
      }
    }
    if (slot === 1) {
      this.effects.push({ type: 'heal', x: h.x, z: h.z, life: 8, r: 29, hero: h.id });
      this.event('heal', { x: h.x, z: h.z, r: 29, hero: h.id });
      h.shield = 3;
    }
    if (slot === 2) {
      this.effects.push({ type: 'strike', x: target.x, z: target.z, life: 1.65, r: 37, damage: 470, hero: h.id });
      this.event('warning', { x: target.x, z: target.z, r: 37, hero: h.id });
    }
    return true;
  }

  waveSpawn() {
    this.wave++;
    this.nextWave = this.time + this.op.waveGap;
    const ember = this.op.roster === 'ember';
    const n = Math.min(90, 24 + this.wave * 7);
    for (let k = 0; k < n && this.enemies.length < 280; k++) {
      const g = gates[k % 4], a = Math.atan2(g.z, g.x);
      const x = g.x + Math.cos(a) * (18 + this.random() * 24) + (this.random() - 0.5) * 24;
      const z = g.z + Math.sin(a) * (18 + this.random() * 24) + (this.random() - 0.5) * 24;
      const type = k % 10 === 0 ? 'brute' : ember && this.wave >= 2 && k % 7 === 3 ? 'sapper' : ember && this.wave >= 3 && k % 12 === 5 ? 'mortar' : k % 3 === 0 ? 'gunner' : 'trooper';
      this.spawn(x, z, type);
    }
    if (this.wave % 4 === 0) this.spawn(0, 148, 'boss');
    this.event('wave', { wave: this.wave });
  }

  bot(h, dt) {
    const r = this.relays[h.id], c = classes[h.id];
    let goal;
    const dying = this.heroes.find((o) => !o.alive && dist(h, o) < 65);
    if (dying) goal = dying;
    else if (!r.active) goal = r;
    else {
      const others = this.relays.some((o) => !o.active);
      goal = others ? r : { x: (h.id - 1) * 23, z: h.id === 2 ? -28 : 28 };
    }
    let near = null, nd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(h, e);
      if (d < nd) {
        nd = d;
        near = e;
      }
    }
    const inCombat = nd < c.range * 0.7;
    h.nav -= dt;
    if (h.nav < 0) {
      h.nav = 1.4 + this.random() * 0.5;
      h.path = pathfind(this.map, h, goal);
      h.order = dying ? 'REVIVE' : this.core.shield ? 'CAPTURE' : 'ASSAULT';
    }
    let moved = 0;
    if (nd < 14 && near) {
      const d = nd || 1;
      moved = this.move(h, ((h.x - near.x) / d) * c.speed * 0.7, ((h.z - near.z) / d) * c.speed * 0.7, dt);
    } else if (!inCombat || dist(h, goal) > 40) moved = this.follow(h, c.speed * 0.86, dt);
    if (near && nd < c.range && h.cd[0] <= 0) this.ability(h, 0, near);
    if (h.hp < h.maxHp * 0.62 && h.cd[1] <= 0) this.ability(h, 1, h);
    if (near && h.cd[2] <= 0) {
      const atCore = !this.core.shield && dist(h, this.core) < 105;
      let crowd = 0;
      if (!atCore) for (const e of this.enemies) if (e.alive && dist(e, near) < 32 && ++crowd >= 5) break;
      if (atCore || crowd >= 5) this.ability(h, 2, atCore ? this.core : near);
    }
    return moved;
  }

  update(dt) {
    if (this.status !== 'active') return;
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    if (this.time >= this.nextWave) this.waveSpawn();
    if (this.xp >= this.level * (this.level + 1) * 45) {
      this.level++;
      for (const h of this.heroes) {
        h.maxHp += 16;
        // A downed hero stays at 0 until revived or redeployed (it used to gain 40 hp while down).
        if (h.alive) h.hp = Math.min(h.maxHp, h.hp + 40);
      }
      this.event('level', { level: this.level });
    }

    for (const h of this.heroes) {
      for (let i = 0; i < 4; i++) h.cd[i] = Math.max(0, h.cd[i] - dt);
      h.shot -= dt;
      h.shield = Math.max(0, h.shield - dt);
      if (!h.alive) {
        h.down -= dt;
        const helper = this.heroes.find((o) => o.alive && dist(o, h) < 15);
        h.revive = helper ? h.revive + dt : Math.max(0, h.revive - dt);
        if (h.revive > 3) {
          h.alive = true;
          h.hp = h.maxHp * 0.65;
          h.revive = 0;
          h.shield = 4;
          this.event('revive', { hero: h.id });
        } else if (h.down <= 0 && this.reinforcements > 0) {
          this.reinforcements--;
          h.alive = true;
          h.hp = h.maxHp;
          h.x = this.op.starts[h.id].x;
          h.z = this.op.starts[h.id].z;
          h.shield = 8;
          h.revive = 0;
          this.event('redeploy', { hero: h.id });
        }
        continue;
      }
      const c = classes[h.id], input = this.inputs[h.id] || { mx: 0, mz: 0, fire: false };
      let moved = 0;
      if (h.bot) moved = this.bot(h, dt);
      else {
        const m = Math.hypot(input.mx, input.mz);
        if (m > 0.01) {
          h.path = [];
          const sprint = input.sprint && h.energy > 0, s = c.speed * (sprint ? 1.5 : 1);
          if (sprint) h.energy = Math.max(0, h.energy - dt * 26);
          moved = this.move(h, (input.mx / m) * s, (input.mz / m) * s, dt);
          h.angle = Math.atan2(input.mx, input.mz);
          h.order = 'MOVE';
        } else moved = this.follow(h, c.speed, dt);
      }
      h.moving = moved > 0.05;
      h.energy = Math.min(100, h.energy + dt * 12);
      if (this.time - (h.hit || 0) > 8) h.hp = Math.min(h.maxHp, h.hp + dt * 3.5);
      let target = null, best = Infinity;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const d = dist(h, e);
        if (d > c.range) continue;
        const score = input.fire && !h.bot ? Math.hypot(e.x - input.ax, e.z - input.az) : d;
        if (score < best && lineClear(this.map, h, e)) {
          target = e;
          best = score;
        }
      }
      if (!this.core.shield && dist(h, this.core) < c.range + 12 && lineClear(this.map, h, this.core) && (!target || (!h.bot && input.fire && Math.hypot(input.ax, input.az) < 25))) target = this.core;
      if (target && (h.bot || this.auto[h.id] || input.fire)) {
        h.angle = Math.atan2(target.x - h.x, target.z - h.z);
        if (h.shot <= 0) {
          h.shot = c.rate;
          this.damage(target, c.damage * (1 + (this.level - 1) * 0.1), h.id);
          this.event('shot', { x: h.x, z: h.z, tx: target.x, tz: target.z, hero: h.id });
        }
      }
    }

    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.shot -= dt;
      e.stun -= dt;
      // A lit fuse always burns down, stunned or not.
      if (e.fuse > 0) {
        e.fuse -= dt;
        if (e.fuse <= 0) this.detonate(e);
        continue;
      }
      if (e.stun > 0) continue;
      let target = null, near = Infinity;
      for (const h of this.heroes) {
        if (!h.alive) continue;
        const d = dist(e, h);
        if (d < near) {
          near = d;
          target = h;
        }
      }
      if (!target) continue;
      e.angle = Math.atan2(target.x - e.x, target.z - e.z);
      const lob = e.type === 'mortar';
      const sight = near <= e.range && (lob || lineClear(this.map, e, target));
      if (sight) {
        if (e.type === 'sapper') {
          e.fuse = SAPPER_FUSE;
          this.event('fuse', { x: e.x, z: e.z });
        } else if (e.shot <= 0) {
          e.shot = e.rate;
          if (e.type === 'boss') {
            this.effects.push({ type: 'enemyStrike', x: target.x, z: target.z, life: 1.4, r: 18, damage: 38 });
            this.event('danger', { x: target.x, z: target.z, r: 18 });
          } else if (lob) {
            const tx = target.x + (this.random() - 0.5) * 10, tz = target.z + (this.random() - 0.5) * 10;
            this.effects.push({ type: 'enemyStrike', x: tx, z: tz, life: 1.6, r: 12, damage: e.damage });
            this.event('lob', { x: e.x, z: e.z, tx, tz, life: 1.6 });
          } else {
            this.damage(target, e.damage);
            this.event('enemyShot', { x: e.x, z: e.z, tx: target.x, tz: target.z, kind: e.type });
          }
        }
      } else if (e.speed > 0) {
        e.nav -= dt;
        if (e.nav < 0) {
          e.nav = 1.6 + this.random() * 0.9;
          const goal = near < 300 ? target : this.relays[e.id % 3];
          e.path = pathfind(this.map, e, goal);
        }
        this.follow(e, e.speed, dt);
      }
    }

    // Local separation keeps large groups readable without an O(n^2) crowd pass.
    const list = this.enemies;
    if (sepNext.length < list.length) sepNext = new Int32Array(list.length * 2);
    sepHead.fill(-1);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || !e.speed || e.fuse > 0) continue;
      const bx = Math.floor(e.x / 9) + SEP_OFF, bz = Math.floor(e.z / 9) + SEP_OFF;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = bx + dx, cz = bz + dz;
          if (cx < 0 || cz < 0 || cx >= SEP_G || cz >= SEP_G) continue;
          for (let j = sepHead[cz * SEP_G + cx]; j >= 0; j = sepNext[j]) {
            const o = list[j];
            const x = e.x - o.x, z = e.z - o.z, d = Math.hypot(x, z);
            if (d < 5 && d > 0.01) {
              const push = (5 - d) * dt * 2;
              this.move(e, (x / d) * push, (z / d) * push, 1);
              this.move(o, (-x / d) * push, (-z / d) * push, 1);
            }
          }
        }
      }
      if (bx >= 0 && bz >= 0 && bx < SEP_G && bz < SEP_G) {
        sepNext[i] = sepHead[bz * SEP_G + bx];
        sepHead[bz * SEP_G + bx] = i;
      }
    }

    for (const r of this.relays) {
      if (r.active) continue;
      let friends = 0;
      for (const h of this.heroes) if (h.alive && dist(h, r) < 25) friends++;
      const foes = this.enemies.some((e) => e.alive && dist(e, r) < 20);
      if (friends && !foes) {
        r.capture = Math.min(1, r.capture + dt / 15);
        if (r.capture >= 1) {
          r.active = true;
          this.event('capture', { relay: r.id });
          this.reinforcements = Math.min(9, this.reinforcements + 1);
          for (const h of this.heroes) if (h.alive && dist(h, r) < 25) h.hp = h.maxHp;
        }
      }
    }
    if (this.core.shield && this.relays.every((r) => r.active)) {
      this.core.shield = false;
      this.event('breach');
      for (const h of this.heroes) h.cd[2] = 0;
    }
    for (const f of this.effects) {
      f.life -= dt;
      if (f.type === 'heal') {
        for (const h of this.heroes) if (h.alive && dist(h, f) < f.r) h.hp = Math.min(h.maxHp, h.hp + dt * 20);
      } else if (f.life <= 0) {
        if (f.type === 'enemyStrike') {
          for (const h of this.heroes) if (h.alive && dist(h, f) < f.r) this.damage(h, f.damage);
          this.event('enemyBlast', { x: f.x, z: f.z, r: f.r });
        } else this.blast(f.x, f.z, f.r, f.damage, f.hero, f.type === 'strike' ? 'orbital' : 'blast');
      }
    }
    compact(this.effects, (f) => f.life > 0);
    compact(this.enemies, (e) => e.alive);
    compact(this.pickups, (p) => {
      p.life -= dt;
      const h = this.heroes.find((o) => o.alive && dist(o, p) < 10);
      if (h) {
        h.hp = Math.min(h.maxHp, h.hp + 55);
        this.event('pickup', { x: p.x, z: p.z, hero: h.id });
        return false;
      }
      return p.life > 0;
    });
    if (this.heroes.every((h) => !h.alive) && this.reinforcements <= 0) {
      this.status = 'defeat';
      this.event('defeat');
    }
  }

  /* ---------------------------------------------------------------- save / continue */

  toSave(selected = 0) {
    const strip = ({ path, ...rest }) => rest;
    return {
      v: 1,
      op: this.op.id,
      difficulty: this.difficulty,
      selected,
      seed: this.seed,
      time: this.time,
      wave: this.wave,
      nextWave: this.nextWave,
      kills: this.kills,
      xp: this.xp,
      level: this.level,
      reinforcements: this.reinforcements,
      nextId: this.nextId,
      eventId: this.eventId,
      auto: this.auto.slice(),
      heroes: this.heroes.map(strip),
      relays: this.relays.map((r) => ({ ...r })),
      core: { ...this.core },
      enemies: this.enemies.map(strip),
      effects: this.effects.map((f) => ({ ...f })),
      pickups: this.pickups.map((p) => ({ ...p })),
    };
  }

  /** Rebuild a running mission from toSave() data; returns null for anything malformed. */
  static fromSave(d) {
    try {
      if (!d || d.v !== 1 || !Array.isArray(d.heroes) || d.heroes.length !== 3 || !Array.isArray(d.enemies) || !Array.isArray(d.relays) || d.relays.length !== 3) return null;
      if (!d.heroes.every((h) => h && Number.isFinite(h.x) && Number.isFinite(h.z) && Number.isFinite(h.hp) && Number.isFinite(h.maxHp) && h.maxHp > 0)) return null;
      const s = new Simulation(d.difficulty, d.op, false);
      const num = (v, fallback) => (Number.isFinite(v) ? v : fallback);
      s.seed = num(d.seed, s.seed) | 0;
      s.time = num(d.time, 0);
      s.wave = num(d.wave, 0);
      s.nextWave = num(d.nextWave, s.op.firstWave);
      s.kills = num(d.kills, 0);
      s.xp = num(d.xp, 0);
      s.level = num(d.level, 1);
      s.reinforcements = num(d.reinforcements, s.op.reinforcements);
      s.nextId = num(d.nextId, 10);
      s.eventId = num(d.eventId, 0);
      if (Array.isArray(d.auto) && d.auto.length === 3) s.auto = d.auto.map(Boolean);
      s.heroes = d.heroes.map((h, i) => ({ ...s.heroes[i], ...h, id: i, cd: Array.isArray(h.cd) && h.cd.length === 4 ? h.cd.map((v) => num(v, 0)) : [0, 0, 0, 0], path: [], nav: 0, bot: true }));
      s.relays = d.relays.map((r, i) => ({ ...s.relays[i], capture: clamp(num(r.capture, 0), 0, 1), active: !!r.active }));
      s.core = { ...s.core, hp: num(d.core?.hp, s.core.maxHp), shield: s.relays.some((r) => !r.active) };
      s.enemies = d.enemies
        .filter((e) => e && ENEMY_STATS[e.type] && Number.isFinite(e.x) && Number.isFinite(e.z) && Number.isFinite(e.hp) && e.hp > 0 && Number.isFinite(e.maxHp) && e.alive !== false)
        .map((e) => ({ ...e, path: [], nav: s.random() * 1.6, fuse: num(e.fuse, 0), stun: num(e.stun, 0), hit: 0 }));
      s.effects = Array.isArray(d.effects) ? d.effects.filter((f) => f && Number.isFinite(f.x) && Number.isFinite(f.life)) : [];
      s.pickups = Array.isArray(d.pickups) ? d.pickups.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.life)) : [];
      for (const h of s.heroes) h.hit = 0;
      return s;
    } catch {
      return null;
    }
  }
}

/** Keep the items that pass, in place (no new array per tick). */
function compact(list, keep) {
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (keep(item)) list[w++] = item;
  }
  list.length = w;
}
