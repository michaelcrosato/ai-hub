/* IRONHOLD — the rules. Pure logic, no DOM and no three.js, so a defense can be
   stepped, saved and restored anywhere. Two operations share one base layout:
   Blackpine Basin (the original map) and Redcliff Quarry. */

export const HALF = 192, CELL = 4, GRID = 96, MAX_UNITS = 100;

export const TYPES = {
  core: { name: 'Command core', cost: 0, hp: 16000, r: 9, w: 18, d: 18, build: 0 },
  wall: { name: 'Wall', cost: 35, hp: 2100, r: 4, w: 8, d: 3, build: 4 },
  gate: { name: 'Armored gate', cost: 100, hp: 2500, r: 6, w: 16, d: 3, build: 6 },
  gun: { name: 'Gun tower', cost: 160, hp: 900, r: 3, w: 6, d: 6, range: 35, damage: 32, rate: 0.7, power: 2, build: 8 },
  mortar: { name: 'Mortar', cost: 280, hp: 800, r: 4, w: 8, d: 8, range: 62, damage: 105, rate: 3.2, splash: 8, power: 4, build: 12 },
  arc: { name: 'Arc tower', cost: 240, hp: 700, r: 3, w: 6, d: 6, range: 26, damage: 30, rate: 0.8, chain: 4, power: 4, build: 10 },
  mine: { name: 'Extractor', cost: 200, hp: 700, r: 4, w: 8, d: 8, income: 5, power: 1, build: 10 },
  generator: { name: 'Generator', cost: 140, hp: 650, r: 4, w: 8, d: 8, supply: 12, build: 8 },
  barracks: { name: 'Barracks', cost: 240, hp: 1300, r: 5, w: 10, d: 10, build: 12, power: 2 },
  relay: { name: 'Field station', cost: 120, hp: 700, r: 3, w: 6, d: 6, build: 7, power: 1, heal: 6 },
};

/* structures: only attacks buildings (walks past troops). blast: detonates on contact.
   boss: one per sixth wave, announced and tracked on the HUD. */
export const ENEMIES = {
  raider: { name: 'Raider', hp: 115, speed: 5.8, damage: 25, range: 1.8, rate: 1, reward: 8, r: 1.2, text: 'Rifle infantry. Attacks whatever is closest.' },
  runner: { name: 'Runner', hp: 65, speed: 9, damage: 16, range: 1.5, rate: 0.8, reward: 6, r: 0.9, text: 'Fast and fragile. Slips through gaps.' },
  brute: { name: 'Brute', hp: 720, speed: 3.3, damage: 95, range: 3, rate: 1.65, reward: 26, r: 2.2, text: 'Heavy armor. Breaks walls and troops.' },
  siege: { name: 'Siege walker', hp: 480, speed: 3.5, damage: 95, range: 32, rate: 3.5, reward: 32, r: 2.1, text: 'Shells structures from 32 m away.' },
  sapper: { name: 'Sapper', hp: 150, speed: 6.4, damage: 360, range: 2.4, rate: 1, reward: 14, r: 1.1, structures: true, blast: 8, text: 'Ignores troops and blows up the first structure it reaches. Stop it early.' },
  juggernaut: { name: 'Juggernaut', hp: 5200, speed: 2.4, damage: 240, range: 4.5, rate: 2.2, reward: 150, r: 3.4, boss: true, text: 'Armored assault walker. Arrives every sixth wave.' },
};

export const TEAM = ['#6fdac5', '#e6b667', '#a29bea', '#76b3e6'];
export const WAVES_TO_WIN = 12;
export const LANE_SETS = [[0], [1], [3], [2, 0], [1, 3], [0, 1, 2, 3], [0, 2], [1, 2, 3], [0, 1, 2, 3]];
export const lanesForWave = (wave) => LANE_SETS[(Math.max(1, wave) - 1) % LANE_SETS.length];
export const isBossWave = (wave) => wave > 0 && wave % 6 === 0;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function waveCount(wave, difficulty) {
  let count = Math.round(17 + wave * 9 + wave * wave * 0.5);
  if (difficulty === 'relaxed') count = Math.round(count * 0.7);
  if (difficulty === 'hard') count = Math.round(count * 1.3);
  return count + (isBossWave(wave) ? 1 : 0);
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------------ maps */

/* Blackpine Basin: the original map, generated exactly as before. */
const BLACKPINE_DEPOSITS = [{ x: 28, z: -72 }, { x: -28, z: 72 }, { x: -72, z: -28 }, { x: 72, z: 28 }, { x: -88, z: 80 }, { x: 88, z: -80 }, { x: 112, z: 40 }, { x: -112, z: -40 }, { x: 32, z: 120 }, { x: -32, z: -120 }, { x: 126, z: 126 }, { x: -126, z: -126 }];

function blackpineRocks() {
  const random = rng(84017), rocks = [];
  for (let i = 0; i < 42; i++) {
    const x = (random() - 0.5) * 344, z = (random() - 0.5) * 344, r = 4 + random() * 8;
    if (Math.abs(x) < 64 || Math.abs(z) < 62 || BLACKPINE_DEPOSITS.some((d) => Math.hypot(d.x - x, d.z - z) < r + 15)) {
      i--;
      continue;
    }
    rocks.push({ x, z, r, h: 7 + random() * 20, seed: random() });
  }
  return rocks;
}

function blackpineHeight(x, z) {
  const f = clamp((Math.max(Math.abs(x), Math.abs(z)) - 55) / 55, 0, 1);
  const road = clamp(Math.min(Math.abs(x), Math.abs(z)) / 20, 0, 1);
  return f * road * (2 + Math.sin(x * 0.044) * Math.cos(z * 0.037) * 2.7 + Math.sin((x + z) * 0.065) * 0.8);
}

/* Redcliff Quarry: a quarry bowl ringed by red cliffs. Three breaches in the ring
   funnel all four approaches, so walls and mortars decide the fight. */
const QUARRY_BREACHES = [21, 129, 255]; // bearings in degrees, clockwise from north (-z)
export const bearingPoint = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
};
const QUARRY_DEPOSITS = [{ x: 26, z: -70 }, { x: 70, z: 30 }, { x: -30, z: 72 }, { x: -72, z: -26 }, { x: -60, z: -62 }, { x: 64, z: -58 }, { x: 58, z: 64 }, { x: -86, z: 26 }, { x: 150, z: -60 }, { x: -120, z: -140 }, { x: 100, z: 150 }, { x: -156, z: 90 }];
const QUARRY_LANES = [
  { name: 'North-east cut', x: 128, z: -160 },
  { name: 'East haul road', x: 174, z: 30 },
  { name: 'South switchback', x: -40, z: 174 },
  { name: 'West gully', x: -174, z: -60 },
];
const Q = (deg, r) => {
  const p = bearingPoint(deg, r);
  return [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10];
};
const QUARRY_ROADS = [
  [[128, -160], Q(21, 150), Q(21, 112), [0, -56]],
  [[174, 30], [140, 80], Q(129, 150), Q(129, 112), [56, 0]],
  [[-40, 174], [70, 160], Q(129, 150)],
  [[-174, -60], Q(255, 150), Q(255, 112), [-56, 0]],
];

function segDistance(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz;
  const t = len2 ? clamp(((x - ax) * dx + (z - az) * dz) / len2, 0, 1) : 0;
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
}
function roadDistance(roads, x, z) {
  let best = Infinity;
  for (const line of roads) for (let i = 1; i < line.length; i++) best = Math.min(best, segDistance(x, z, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]));
  return best;
}

function quarryHeight(x, z) {
  const r = Math.hypot(x, z);
  const bowl = clamp((r - 56) / 110, 0, 1);
  const rim = Math.exp(-((r - 114) * (r - 114)) / 420) * 3.2;
  const n = Math.sin(x * 0.047 + 1.3) * Math.cos(z * 0.039) * 1.5 + Math.sin((x - z) * 0.061) * 0.7;
  const flat = clamp((roadDistance(QUARRY_ROADS, x, z) - 5) / 14, 0, 1);
  return Math.max(0, (bowl * bowl * 7 + rim + n * bowl) * (0.2 + 0.8 * flat));
}

function quarryRocks() {
  const R = rng(51377), rocks = [];
  // The cliff ring, one boulder every 6 degrees, open at the three breaches.
  for (let k = 0; k < 60; k++) {
    const deg = k * 6;
    if (QUARRY_BREACHES.some((b) => Math.abs(((deg - b + 540) % 360) - 180) < 9)) continue;
    const p = bearingPoint(deg, 112 + (R() - 0.5) * 6);
    rocks.push({ x: p.x, z: p.z, r: 9 + R() * 2.5, h: 16 + R() * 16, seed: R() });
  }
  // Scattered boulders inside the bowl and across the outer plateau.
  const clear = (x, z, r) =>
    Math.abs(x) < 170 && Math.abs(z) < 170 &&
    !QUARRY_DEPOSITS.some((d) => Math.hypot(d.x - x, d.z - z) < r + 15) &&
    !QUARRY_LANES.some((l) => Math.hypot(l.x - x, l.z - z) < 30) &&
    roadDistance(QUARRY_ROADS, x, z) > r + 10 &&
    !QUARRY_BREACHES.some((b) => {
      const p = bearingPoint(b, 112);
      return Math.hypot(p.x - x, p.z - z) < 34;
    }) &&
    !rocks.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + 4);
  let placed = 0;
  for (let tries = 0; tries < 900 && placed < 30; tries++) {
    const inner = placed < 8;
    const a = R() * Math.PI * 2, dist = inner ? 70 + R() * 24 : 136 + R() * 40, r = inner ? 3.5 + R() * 3 : 4 + R() * 7;
    const x = Math.sin(a) * dist, z = Math.cos(a) * dist;
    if (Math.max(Math.abs(x), Math.abs(z)) < 62 || !clear(x, z, r)) continue;
    rocks.push({ x, z, r, h: 6 + R() * 16, seed: R() });
    placed++;
  }
  return rocks;
}

export const MAPS = {
  blackpine: {
    id: 'blackpine',
    op: 'OPERATION 01',
    name: 'Blackpine Basin',
    title: 'BLACKPINE BASIN',
    stamp: '384 × 384 m · FOUR APPROACHES',
    eyebrow: 'BLACKPINE BASIN / LAST DEFENSE',
    brief: 'Pine forest on four open approaches. Enemies take the straight roads to your gates.',
    height: blackpineHeight,
    deposits: BLACKPINE_DEPOSITS,
    rocks: blackpineRocks(),
    lanes: [
      { name: 'North pass', x: 0, z: -174 },
      { name: 'East road', x: 174, z: 0 },
      { name: 'South ridge', x: 0, z: 174 },
      { name: 'West pass', x: -174, z: 0 },
    ],
    roads: [[[0, -HALF], [0, HALF]], [[-HALF, 0], [HALF, 0]]],
  },
  redcliff: {
    id: 'redcliff',
    op: 'OPERATION 02',
    name: 'Redcliff Quarry',
    title: 'REDCLIFF QUARRY',
    stamp: '384 × 384 m · THREE BREACHES',
    eyebrow: 'REDCLIFF QUARRY / THE PIT',
    brief: 'A cliff ring with three breaches. Every approach funnels through them. Rich ore lies outside the ring.',
    height: quarryHeight,
    deposits: QUARRY_DEPOSITS,
    rocks: quarryRocks(),
    lanes: QUARRY_LANES,
    roads: QUARRY_ROADS,
    breaches: QUARRY_BREACHES,
  },
};
export const MAP_ORDER = ['blackpine', 'redcliff'];

/* ------------------------------------------------------------------ geometry helpers */

export function bounds(b) {
  const t = TYPES[b.type], w = t.w / 2, d = t.d / 2;
  return b.rot % 2 ? { w: d, d: w } : { w, d };
}
export function distanceTo(b, x, z) {
  const t = TYPES[b.type];
  const hw = (b.rot % 2 ? t.d : t.w) / 2, hd = (b.rot % 2 ? t.w : t.d) / 2;
  const dx = Math.abs(b.x - x) - hw, dz = Math.abs(b.z - z) - hd;
  return Math.hypot(dx > 0 ? dx : 0, dz > 0 ? dz : 0);
}
export function cell(x, z) {
  return [clamp(Math.floor((x + HALF) / CELL), 0, GRID - 1), clamp(Math.floor((z + HALF) / CELL), 0, GRID - 1)];
}
const cellIndex = (x, z) => clamp(Math.floor((z + HALF) / CELL), 0, GRID - 1) * GRID + clamp(Math.floor((x + HALF) / CELL), 0, GRID - 1);
export const center = (i) => -HALF + i * CELL + CELL / 2;

class Heap {
  constructor() {
    this.a = [];
  }
  push(id, v) {
    const a = this.a;
    let i = a.length;
    a.push(null);
    while (i) {
      const p = (i - 1) >> 1;
      if (a[p][1] <= v) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = [id, v];
  }
  pop() {
    const a = this.a, r = a[0], e = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1][1] < a[c][1]) c++;
        if (e[1] <= a[c][1]) break;
        a[i] = a[c];
        i = c;
      }
      a[i] = e;
    }
    return r;
  }
}

const SEP = 6, SEP_N = 66, SEP_OFF = 33; // separation buckets: 6 m cells across the map

/* ------------------------------------------------------------------ the simulation */

export class Sim {
  constructor(opts = {}) {
    this.mapId = MAPS[opts.map] ? opts.map : 'blackpine';
    this.seed = opts.seed || 7851;
    this.rand = rng(this.seed);
    this.t = 0;
    this.wave = 0;
    this.phase = 'build';
    this.timer = 100;
    this.metal = 1300;
    this.income = 6;
    this.power = 24;
    this.used = 0;
    this.id = 1;
    this.eventId = 0;
    this.events = [];
    this.buildings = [];
    this.units = [];
    this.enemies = [];
    this.shots = [];
    this.queue = [];
    this.spawnClock = 0;
    this.aiClock = 0;
    this.upkeepClock = 0;
    this.kills = 0;
    this.score = 0;
    this.lanes = [0];
    this.waveSize = 0;
    this.difficulty = ['relaxed', 'standard', 'hard'].includes(opts.difficulty) ? opts.difficulty : 'standard';
    this.endless = !!opts.endless;
    this.paused = false;
    this.tutorial = { built: 0, mines: 0, trained: 0 };
    this.players = [0, 1, 2, 3].map((i) => ({ id: i, name: i ? 'Guard ' + (i + 1) : 'Commander', active: i === 0, connected: i === 0, ability: 0 }));
    this.addBuilding('core', 0, 0, 0, -1, true);
    for (let side = 0; side < 4; side++) {
      for (let v = -44; v <= 44; v += 8) {
        if (Math.abs(v) < 10) continue;
        this.addBuilding('wall', side % 2 ? 48 * (side === 1 ? 1 : -1) : v, side % 2 ? v : 48 * (side === 0 ? -1 : 1), side % 2, side, true);
      }
      this.addBuilding('gate', side % 2 ? 48 * (side === 1 ? 1 : -1) : 0, side % 2 ? 0 : 48 * (side === 0 ? -1 : 1), side % 2, side, true);
    }
    [[-16, -40], [40, -16], [16, 40], [-40, 16]].forEach((p, i) => this.addBuilding('gun', p[0], p[1], 0, i, true));
    this.addBuilding('generator', -24, 12, 0, 0, true);
    this.addBuilding('barracks', 24, 12, 0, 0, true);
    for (let p = 0; p < 4; p++) {
      for (let i = 0; i < 5; i++) {
        const a = (p * Math.PI) / 2;
        this.addUnit(Math.sin(a) * 34 + ((i % 3) - 1) * 3, Math.cos(a) * 34 + Math.floor(i / 3) * 3, p);
      }
    }
    this.rebuild();
    this.economy();
  }

  get map() {
    return MAPS[this.mapId];
  }

  event(type, data = {}) {
    this.events.push({ id: ++this.eventId, t: this.t, type, ...data });
    if (this.events.length > 100) this.events.splice(0, this.events.length - 100);
  }

  addBuilding(type, x, z, rot = 0, owner = 0, ready = false) {
    const d = TYPES[type];
    const b = { id: this.id++, type, x, z, rot, owner, hp: d.hp, maxHp: d.hp, level: 1, progress: ready ? 1 : 0, cd: 0, angle: 0, queue: 0, train: 0 };
    this.buildings.push(b);
    return b;
  }

  addUnit(x, z, owner) {
    const u = { id: this.id++, x, z, owner, hp: 150, maxHp: 150, cd: 0, angle: 0, order: null, path: [], idle: 0 };
    this.units.push(u);
    return u;
  }

  economy() {
    this.power = 24;
    this.used = 0;
    this.income = 6;
    for (const b of this.buildings) {
      if (b.hp <= 0 || b.progress < 1) continue;
      const d = TYPES[b.type];
      this.power += (d.supply || 0) * b.level;
      this.used += d.power || 0;
    }
    this.powered = this.power >= this.used;
    for (const b of this.buildings) if (b.hp > 0 && b.progress >= 1 && TYPES[b.type].income) this.income += TYPES[b.type].income * b.level * (this.powered ? 1 : 0.4);
  }

  canBuild(type, x, z, rot = 0) {
    if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(TYPES, type) || type === 'core' || type === 'gate') return 'Choose a structure.';
    const d = TYPES[type], map = this.map;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return 'Invalid position.';
    if (Math.abs(x) > 170 || Math.abs(z) > 170) return 'Outside the build area.';
    if (this.buildings.filter((b) => b.type !== 'wall').length >= 100 || this.buildings.length >= 260) return 'Structure limit reached.';
    const bb = bounds({ type, rot });
    if (!this.buildings.some((o) => o.hp > 0 && o.progress >= 1 && ((o.type === 'core' && Math.hypot(x - o.x, z - o.z) < 82) || (o.type === 'relay' && Math.hypot(x - o.x, z - o.z) < 46)))) return 'Build a field station to extend your reach.';
    if (map.rocks.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + Math.max(bb.w, bb.d))) return 'The ground is blocked by rock.';
    if (this.buildings.some((o) => {
      if (o.hp <= 0) return false;
      const ob = bounds(o);
      return Math.abs(x - o.x) < bb.w + ob.w + 0.7 && Math.abs(z - o.z) < bb.d + ob.d + 0.7;
    })) return 'Too close to another structure.';
    if (this.enemies.some((e) => Math.hypot(e.x - x, e.z - z) < d.r + 4)) return 'Enemy troops are too close.';
    if (this.units.some((u) => u.hp > 0 && Math.abs(u.x - x) < bb.w + 1 && Math.abs(u.z - z) < bb.d + 1)) return 'Move allied troops away from this site first.';
    if (type === 'mine' && !map.deposits.some((o) => Math.hypot(x - o.x, z - o.z) < 7)) return 'Place an extractor on an amber deposit.';
    if (type !== 'mine' && map.deposits.some((o) => Math.hypot(x - o.x, z - o.z) < d.r + 4)) return 'Keep the deposit clear for an extractor.';
    if (this.metal < d.cost) return 'Not enough metal.';
    return '';
  }

  upgradeCost(b) {
    return Math.round(TYPES[b.type].cost * (0.7 + b.level * 0.35));
  }
  repairCost(b) {
    return Math.ceil((b.maxHp - b.hp) * 0.07);
  }
  refund(b) {
    // The structure's salvage, plus the full price of any squads still queued in it.
    return Math.floor(TYPES[b.type].cost * 0.55 * b.hp / b.maxHp) + (b.queue || 0) * 180;
  }

  command(pid, c) {
    if (!c || typeof c !== 'object' || !this.players[pid]) return { ok: false, error: 'Invalid command.' };
    const fail = (error) => ({ ok: false, error });
    if (this.phase === 'lost' || this.phase === 'won') return fail('The mission has ended.');
    if (c.type === 'build') {
      const x = Math.round(Number(c.x) / 4) * 4, z = Math.round(Number(c.z) / 4) * 4, rot = c.rot === 1 ? 1 : 0;
      const error = this.canBuild(c.kind, x, z, rot);
      if (error) return fail(error);
      this.metal -= TYPES[c.kind].cost;
      const b = this.addBuilding(c.kind, x, z, rot, pid);
      this.tutorial.built++;
      if (c.kind === 'mine') this.tutorial.mines++;
      this.event('build', { x, z, kind: c.kind, pid });
      this.rebuild();
      return { ok: true, id: b.id };
    }
    if (c.type === 'move' || c.type === 'attack') {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) return fail('Invalid destination.');
      const ids = Array.isArray(c.ids) ? c.ids.slice(0, MAX_UNITS) : [];
      const us = this.units.filter((u) => u.owner === pid && ids.includes(u.id));
      if (!us.length) return fail('Select your troops first.');
      const cx = clamp(c.x, -174, 174), cz = clamp(c.z, -174, 174), cols = Math.ceil(Math.sqrt(us.length));
      us.forEach((u, i) => {
        const x = cx + ((i % cols) - (cols - 1) / 2) * 3, z = cz + (Math.floor(i / cols) - (cols - 1) / 2) * 3;
        u.order = { x, z, attack: c.type === 'attack', target: Number(c.target) || 0 };
        u.path = this.findPath(u.x, u.z, x, z);
        u.idle = 0;
      });
      this.event('move', { x: cx, z: cz, pid, attack: c.type === 'attack' });
      return { ok: true };
    }
    if (c.type === 'hold') {
      for (const u of this.units) {
        if (u.owner === pid && Array.isArray(c.ids) && c.ids.includes(u.id)) {
          u.order = null;
          u.path = [];
          u.idle = 0;
        }
      }
      return { ok: true };
    }
    if (c.type === 'upgrade' || c.type === 'repair' || c.type === 'train' || c.type === 'sell') {
      const b = this.buildings.find((v) => v.id === c.id && v.hp > 0);
      if (!b) return fail('Select a structure.');
      if (b.progress < 1) return fail('Construction is not complete.');
      const d = TYPES[b.type];
      if (c.type === 'upgrade') {
        if (b.type === 'core') return fail('The core cannot be upgraded.');
        if (b.level >= 3) return fail('Maximum level reached.');
        const cost = this.upgradeCost(b);
        if (this.metal < cost) return fail('Not enough metal.');
        this.metal -= cost;
        b.level++;
        const inc = Math.round(d.hp * 0.5);
        b.maxHp += inc;
        b.hp += inc;
        this.economy();
        this.event('upgrade', { x: b.x, z: b.z });
        return { ok: true };
      }
      if (c.type === 'repair') {
        if (b.hp >= b.maxHp - 1) return fail('No repair is needed.');
        const cost = this.repairCost(b);
        if (this.metal < cost) return fail('Not enough metal.');
        this.metal -= cost;
        b.hp = b.maxHp;
        this.event('repair', { x: b.x, z: b.z });
        return { ok: true };
      }
      if (c.type === 'sell') {
        if (b.type === 'core') return fail('The core cannot be removed.');
        if (b.owner !== pid && b.owner !== -1) return fail('Only the builder can remove this structure.');
        this.metal += this.refund(b);
        b.hp = 0;
        this.buildings = this.buildings.filter((v) => v.hp > 0);
        this.rebuild();
        this.economy();
        return { ok: true };
      }
      if (b.type !== 'barracks') return fail('Select a barracks.');
      if (b.queue >= 4) return fail('Training queue is full.');
      const pending = this.buildings.reduce((s, v) => s + v.queue * 4, 0);
      if (this.units.length + pending + 4 > MAX_UNITS) return fail('Troop limit reached.');
      if (this.metal < 180) return fail('A squad costs 180 metal.');
      this.metal -= 180;
      b.queue++;
      b.trainOwners = b.trainOwners || [];
      b.trainOwners.push(pid);
      return { ok: true };
    }
    if (c.type === 'strike') {
      const p = this.players[pid];
      if (p.ability > 0) return fail('Support is not ready.');
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || Math.abs(c.x) > HALF || Math.abs(c.z) > HALF) return fail('Invalid target.');
      p.ability = 55;
      this.shots.push({ x: c.x, z: c.z, t: 1.7, damage: 420, r: 13, kind: 'strike' });
      this.event('strikeMark', { x: c.x, z: c.z, pid });
      return { ok: true };
    }
    if (c.type === 'wave') {
      if (this.phase !== 'build') return fail('Clear the current wave first.');
      this.metal += Math.floor(this.timer * 2);
      this.timer = 0;
      return { ok: true };
    }
    if (c.type === 'ping') {
      if (!Number.isFinite(c.x) || !Number.isFinite(c.z)) return fail('Invalid position.');
      this.event('ping', { x: clamp(c.x, -HALF, HALF), z: clamp(c.z, -HALF, HALF), pid });
      return { ok: true };
    }
    return fail('Unknown command.');
  }

  rebuild() {
    const n = GRID * GRID;
    this.cost = new Float32Array(n).fill(1);
    this.block = new Int32Array(n);
    this.allyBlock = new Uint8Array(n);
    for (const rock of this.map.rocks) {
      const [gx, gz] = cell(rock.x, rock.z), rr = Math.ceil(rock.r / CELL) + 1;
      for (let j = Math.max(0, gz - rr); j <= Math.min(GRID - 1, gz + rr); j++) {
        for (let i = Math.max(0, gx - rr); i <= Math.min(GRID - 1, gx + rr); i++) {
          if (Math.hypot(center(i) - rock.x, center(j) - rock.z) < rock.r) {
            this.cost[j * GRID + i] = 10000;
            this.allyBlock[j * GRID + i] = 1;
          }
        }
      }
    }
    for (const b of this.buildings) {
      if (b.hp <= 0) continue;
      const q = bounds(b), [x0, z0] = cell(b.x - q.w, b.z - q.d), [x1, z1] = cell(b.x + q.w - 0.1, b.z + q.d - 0.1);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const i = z * GRID + x;
          this.block[i] = b.id;
          if (b.type !== 'core') this.cost[i] += b.type === 'gate' ? 5 : b.type === 'wall' ? 24 : 10;
          this.allyBlock[i] = b.type === 'gate' ? 0 : 1;
        }
      }
    }
    this.flow = new Float32Array(n).fill(Infinity);
    const [sx, sz] = cell(0, 0), h = new Heap();
    this.flow[sz * GRID + sx] = 0;
    h.push(sz * GRID + sx, 0);
    const dirs = [[-1, 0, 1], [1, 0, 1], [0, -1, 1], [0, 1, 1], [-1, -1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [1, 1, 1.414]];
    while (h.a.length) {
      const [id, d] = h.pop();
      if (d > this.flow[id] + 0.001) continue;
      const x = id % GRID, z = (id / GRID) | 0;
      for (const [dx, dz, m] of dirs) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
        const ni = nz * GRID + nx;
        if (this.cost[ni] >= 10000) continue;
        const nd = d + (this.cost[ni] + this.cost[id]) * 0.5 * m;
        if (nd < this.flow[ni]) {
          this.flow[ni] = nd;
          h.push(ni, nd);
        }
      }
    }
  }

  findPath(x, z, tx, tz) {
    const [sx, sz] = cell(x, z);
    let [gx, gz] = cell(tx, tz);
    let goal = gz * GRID + gx;
    if (this.allyBlock[goal]) {
      let found = false;
      for (let r = 1; r < 8 && !found; r++) {
        for (let dz = -r; dz <= r && !found; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const xx = gx + dx, zz = gz + dz;
            if (xx < 0 || zz < 0 || xx >= GRID || zz >= GRID) continue;
            const k = zz * GRID + xx;
            if (!this.allyBlock[k]) {
              goal = k;
              gx = xx;
              gz = zz;
              found = true;
              break;
            }
          }
        }
      }
      if (!found) return [];
    }
    // Reused search buffers: a 100-troop order no longer allocates 300 grids.
    const n = GRID * GRID;
    const g = this._g || (Object.defineProperty(this, '_g', { value: new Float32Array(n) }), this._g);
    const prev = this._prev || (Object.defineProperty(this, '_prev', { value: new Int32Array(n) }), this._prev);
    const closed = this._closed || (Object.defineProperty(this, '_closed', { value: new Uint8Array(n) }), this._closed);
    g.fill(Infinity);
    prev.fill(-1);
    closed.fill(0);
    const start = sz * GRID + sx, h = new Heap();
    g[start] = 0;
    h.push(start, 0);
    let tries = 0;
    while (h.a.length && tries++ < 14000) {
      const [cur] = h.pop();
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      const cx = cur % GRID, cz = (cur / GRID) | 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx, nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
          const ni = nz * GRID + nx;
          if (this.allyBlock[ni] || closed[ni]) continue;
          if (dx && dz && (this.allyBlock[cz * GRID + nx] || this.allyBlock[nz * GRID + cx])) continue;
          const ng = g[cur] + (dx && dz ? 1.414 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            prev[ni] = cur;
            h.push(ni, ng + Math.hypot(gx - nx, gz - nz));
          }
        }
      }
    }
    if (start === goal) return [];
    if (prev[goal] < 0) return [];
    const path = [];
    let v = goal;
    while (v !== start && v >= 0 && path.length < 500) {
      path.push({ x: center(v % GRID), z: center((v / GRID) | 0) });
      v = prev[v];
    }
    path.reverse();
    return path;
  }

  startWave() {
    this.wave++;
    this.phase = 'combat';
    this.timer = 0;
    this.lanes = lanesForWave(this.wave);
    const count = waveCount(this.wave, this.difficulty) - (isBossWave(this.wave) ? 1 : 0);
    for (let i = 0; i < count; i++) {
      let type = 'raider';
      if (i % 4 === 0) type = 'runner';
      if (this.wave >= 3 && i % 9 === 0) type = 'brute';
      if (this.wave >= 5 && i % 13 === 0) type = 'siege';
      if (this.wave >= 4 && i % 11 === 6) type = 'sapper';
      this.queue.push({ type, lane: this.lanes[i % this.lanes.length] });
    }
    // Every sixth wave a juggernaut walks in with the first third of the column.
    if (isBossWave(this.wave)) this.queue.splice(Math.floor(count / 3), 0, { type: 'juggernaut', lane: this.lanes[0] });
    this.waveSize = this.queue.length;
    this.spawnClock = 0;
    this.event('wave', { wave: this.wave, lanes: this.lanes, boss: isBossWave(this.wave) });
  }

  spawn() {
    const q = this.queue.shift();
    if (!q) return;
    const lane = this.map.lanes[q.lane] || this.map.lanes[0], d = ENEMIES[q.type];
    // Spread across the approach, jittered along it (the original spread, for any lane direction).
    const len = Math.hypot(lane.x, lane.z) || 1, fx = -lane.x / len, fz = -lane.z / len;
    const spread = (this.rand() - 0.5) * 21, along = (this.rand() - 0.5) * 6;
    const scale = 1 + (this.wave - 1) * 0.11;
    const e = {
      id: this.id++,
      type: q.type,
      x: lane.x - fz * spread + fx * along,
      z: lane.z + fx * spread + fz * along,
      hp: Math.round(d.hp * scale),
      maxHp: Math.round(d.hp * scale),
      angle: Math.atan2(fx, fz),
      cd: this.rand(),
      lane: q.lane,
      seed: this.rand(),
      attack: 0,
    };
    this.enemies.push(e);
    if (d.boss) this.event('boss', { x: e.x, z: e.z, id: e.id, lane: q.lane });
  }

  hurt(e, dmg) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    if (e.hp <= 0) {
      this.kills++;
      this.score += Math.round(ENEMIES[e.type].reward * 10);
      this.metal += ENEMIES[e.type].reward;
      this.event('death', { x: e.x, z: e.z, kind: e.type });
    }
  }

  fire(source, target, kind, damage, splash = 0) {
    source.angle = Math.atan2(target.x - source.x, target.z - source.z);
    this.event('shot', { x: source.x, z: source.z, tx: target.x, tz: target.z, kind });
    if (kind === 'mortar') {
      this.shots.push({ x: target.x, z: target.z, t: 0.85, damage, r: splash, kind });
    } else if (kind === 'arc') {
      const near = this.enemies
        .filter((e) => e.hp > 0 && Math.hypot(e.x - target.x, e.z - target.z) < 10)
        .sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z))
        .slice(0, 4);
      for (const e of near) {
        this.hurt(e, damage);
        if (e.id !== target.id) this.event('shot', { x: target.x, z: target.z, tx: e.x, tz: e.z, kind: 'arc' });
      }
    } else this.hurt(target, damage);
  }

  enemyDamage(d) {
    return d.damage * (1 + (this.wave - 1) * 0.06) * (this.difficulty === 'relaxed' ? 0.8 : this.difficulty === 'hard' ? 1.15 : 1);
  }

  /** A sapper's charge: heavy damage to structures, light damage to troops, no reward. */
  detonate(e, d) {
    const damage = this.enemyDamage(d);
    for (const b of this.buildings) {
      if (b.hp <= 0) continue;
      const dist = distanceTo(b, e.x, e.z);
      if (dist < d.blast) b.hp -= damage * (1 - (dist / d.blast) * 0.5);
    }
    for (const u of this.units) if (u.hp > 0 && Math.hypot(u.x - e.x, u.z - e.z) < d.blast * 0.7) u.hp -= 45;
    e.hp = 0;
    this.event('blast', { x: e.x, z: e.z, r: d.blast, kind: 'sapper' });
  }

  update(dt) {
    if (this.paused || this.phase === 'lost' || this.phase === 'won') return;
    dt = clamp(dt, 0, 0.1);
    this.t += dt;
    this.metal += this.income * dt;
    for (const p of this.players) p.ability = Math.max(0, p.ability - dt);
    if (this.phase === 'build') {
      this.timer -= dt;
      if (this.timer <= 0) this.startWave();
    }
    if (this.phase === 'combat') {
      this.spawnClock -= dt;
      if (this.queue.length && this.spawnClock <= 0 && this.enemies.length < 500) {
        this.spawn();
        this.spawnClock = Math.max(0.11, 0.48 - this.wave * 0.022);
      }
    }
    this.upkeepClock += dt;
    if (this.upkeepClock > 1) {
      this.upkeepClock = 0;
      this.economy();
    }

    for (const b of this.buildings) {
      if (b.hp <= 0) continue;
      const d = TYPES[b.type];
      if (b.progress < 1) {
        b.progress = Math.min(1, b.progress + dt / d.build);
        continue;
      }
      if (b.type === 'barracks' && b.queue > 0) {
        b.train += dt * (this.powered ? 1 : 0.45);
        if (b.train >= 10) {
          b.train = 0;
          b.queue--;
          const owner = (b.trainOwners || []).shift() ?? b.owner;
          for (let i = 0; i < 4; i++) this.addUnit(b.x + (i - 1.5) * 2.4, b.z + 9, owner);
          this.tutorial.trained++;
          this.event('squad', { x: b.x, z: b.z, pid: owner });
        }
      }
      if (b.type === 'relay') for (const u of this.units) if (Math.hypot(u.x - b.x, u.z - b.z) < 18) u.hp = Math.min(u.maxHp, u.hp + dt * d.heal * b.level);
      if (!d.damage) continue;
      b.cd -= dt * (this.powered ? 1 : 0.45);
      if (b.cd > 0) continue;
      const range = d.range + (b.level - 1) * 4;
      let target = null, nearest = range;
      for (const e of this.enemies) {
        if (e.hp <= 0) continue;
        const ex = b.x - e.x, ez = b.z - e.z;
        if (ex > nearest || ex < -nearest || ez > nearest || ez < -nearest) continue;
        const dist = Math.hypot(ex, ez);
        if (dist < nearest) {
          target = e;
          nearest = dist;
        }
      }
      if (target) {
        this.fire(b, target, b.type, d.damage * (1 + (b.level - 1) * 0.55), d.splash || 0);
        b.cd = d.rate;
      }
    }

    // Guard squads for empty commander slots hold their front and react to enemies near the base.
    this.aiClock += dt;
    if (this.aiClock > 3) {
      this.aiClock = 0;
      const near = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x, e.z) < 86);
      for (const u of this.units) {
        if (this.players[u.owner].active || (u.order && u.order.manual)) continue;
        const a = (u.owner * Math.PI) / 2;
        let closest = null, cd = Infinity;
        for (const e of near) {
          const dd = Math.hypot(e.x - u.x, e.z - u.z);
          if (dd < cd) {
            cd = dd;
            closest = e;
          }
        }
        const tx = closest ? clamp(closest.x, -42, 42) : Math.sin(a) * 36, tz = closest ? clamp(closest.z, -42, 42) : Math.cos(a) * 36;
        if (Math.hypot(u.x - tx, u.z - tz) > 10) {
          u.order = { x: tx + ((u.id % 3) - 1) * 3, z: tz, attack: true };
          u.path = this.findPath(u.x, u.z, u.order.x, u.order.z);
        }
      }
    }

    for (const u of this.units) {
      if (u.hp <= 0) continue;
      u.cd -= dt;
      let target = null, nearest = 21;
      if (u.order?.target) {
        const chosen = this.enemies.find((e) => e.id === u.order.target && e.hp > 0);
        if (chosen && Math.hypot(chosen.x - u.x, chosen.z - u.z) < 24) target = chosen;
      }
      if (!target) {
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const ex = e.x - u.x, ez = e.z - u.z;
          if (ex > nearest || ex < -nearest || ez > nearest || ez < -nearest) continue;
          const dist = Math.hypot(ex, ez);
          if (dist < nearest) {
            target = e;
            nearest = dist;
          }
        }
      }
      if (target && u.cd <= 0) {
        this.fire(u, target, 'rifle', 14);
        u.cd = 0.85;
      }
      if (u.path && u.path.length && !(target && u.order?.attack)) {
        const q = u.path[0], dx = q.x - u.x, dz = q.z - u.z, len = Math.hypot(dx, dz), speed = 9.5 * dt;
        if (len < speed + 0.15) {
          u.x = q.x;
          u.z = q.z;
          u.path.shift();
        } else {
          const nx = u.x + (dx / len) * speed, nz = u.z + (dz / len) * speed;
          if (!this.allyBlock[cellIndex(nx, nz)]) {
            u.x = nx;
            u.z = nz;
            u.angle = Math.atan2(dx, dz);
          } else {
            u.idle += dt;
            if (u.idle > 1 && u.order) {
              u.path = this.findPath(u.x, u.z, u.order.x, u.order.z);
              u.idle = 0;
            }
          }
        }
      }
      // An order on a specific enemy keeps chasing it while it lives and stays within 60 m
      // (before, troops stopped where the enemy had been when the order was given).
      if (!u.path?.length && u.order) {
        const chase = u.order.target ? this.enemies.find((e) => e.id === u.order.target && e.hp > 0) : null;
        const dist = chase ? Math.hypot(chase.x - u.x, chase.z - u.z) : Infinity;
        if (dist < 60) {
          u.repath = (u.repath || 0) - dt;
          if (dist > 18 && u.repath <= 0) {
            u.path = this.findPath(u.x, u.z, chase.x, chase.z);
            u.repath = 1.5;
          }
        } else u.order = null;
      }
    }

    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const d = ENEMIES[e.type];
      e.cd -= dt;
      e.attack = 0;
      let target = null, minDist = d.range;
      for (const b of this.buildings) {
        if (b.hp <= 0) continue;
        const bx = b.x - e.x, bz = b.z - e.z;
        if (bx > minDist + 10 || bx < -minDist - 10 || bz > minDist + 10 || bz < -minDist - 10) continue;
        const dist = distanceTo(b, e.x, e.z);
        if (dist < minDist) {
          minDist = dist;
          target = b;
        }
      }
      if (!d.structures) {
        for (const u of this.units) {
          if (u.hp <= 0) continue;
          const dist = Math.hypot(u.x - e.x, u.z - e.z);
          if (dist < Math.min(minDist, d.range + 1)) {
            target = u;
            minDist = dist;
          }
        }
      }
      if (target) {
        e.attack = 1;
        e.angle = Math.atan2(target.x - e.x, target.z - e.z);
        if (e.cd <= 0) {
          if (d.blast) {
            this.detonate(e, d);
            continue;
          }
          target.hp -= this.enemyDamage(d);
          e.cd = d.rate;
          this.event('enemyShot', { x: e.x, z: e.z, tx: target.x, tz: target.z, kind: e.type });
        }
        continue;
      }
      const [gx, gz] = cell(e.x, e.z);
      let best = -1, bestVal = Infinity, bx = 0, bz = 0;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const x = gx + dx, z = gz + dz;
          if (x < 0 || z < 0 || x >= GRID || z >= GRID) continue;
          const ni = z * GRID + x;
          if (this.cost[ni] >= 10000) continue;
          const val = this.flow[ni] + Math.hypot(dx, dz) * 0.15;
          if (val < bestVal) {
            bestVal = val;
            best = ni;
            bx = center(x);
            bz = center(z);
          }
        }
      }
      if (best < 0) continue;
      const dx = bx - e.x, dz = bz - e.z, len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      // Small lateral spread keeps the army readable without a costly all-pairs solve.
      const side = Math.sin(e.id * 1.73) * 0.32, speed = d.speed * dt;
      const nx = e.x + (dx / len - (dz / len) * side) * speed, nz = e.z + (dz / len + (dx / len) * side) * speed;
      let blocking = null;
      for (const b of this.buildings) {
        if (b.hp > 0 && Math.abs(b.x - nx) < 20 && Math.abs(b.z - nz) < 20 && distanceTo(b, nx, nz) < d.r * 0.5) {
          blocking = b;
          break;
        }
      }
      if (blocking) {
        e.angle = Math.atan2(blocking.x - e.x, blocking.z - e.z);
        if (e.cd <= 0) {
          if (d.blast) {
            this.detonate(e, d);
            continue;
          }
          blocking.hp -= d.damage * (1 + (this.wave - 1) * 0.06);
          e.cd = d.rate;
          this.event('enemyShot', { x: e.x, z: e.z, tx: blocking.x, tz: blocking.z, kind: e.type });
        }
      } else {
        e.x = nx;
        e.z = nz;
        e.angle = Math.atan2(dx, dz);
      }
    }

    this.separate(this.units, dt, false);
    this.separate(this.enemies, dt, true);
    for (const s of this.shots) {
      s.t -= dt;
      if (s.t <= 0 && !s.done) {
        s.done = true;
        for (const e of this.enemies) {
          if (e.hp <= 0) continue;
          const distance = Math.hypot(e.x - s.x, e.z - s.z);
          if (distance < s.r) this.hurt(e, s.damage * (0.45 + 0.55 * (1 - distance / s.r)));
        }
        this.event('blast', { x: s.x, z: s.z, r: s.r, kind: s.kind });
      }
    }
    if (this.shots.some((s) => s.done)) this.shots = this.shots.filter((s) => !s.done);
    if (this.enemies.some((e) => e.hp <= 0)) this.enemies = this.enemies.filter((e) => e.hp > 0);
    if (this.units.some((u) => u.hp <= 0)) {
      for (const u of this.units) if (u.hp <= 0) this.event('unitDeath', { x: u.x, z: u.z, pid: u.owner });
      this.units = this.units.filter((u) => u.hp > 0);
    }
    const dead = this.buildings.filter((b) => b.hp <= 0);
    if (dead.length) {
      for (const b of dead) this.event('destroy', { x: b.x, z: b.z, kind: b.type });
      this.buildings = this.buildings.filter((b) => b.hp > 0);
      this.rebuild();
      this.economy();
    }
    if (!this.buildings.some((b) => b.type === 'core')) {
      this.phase = 'lost';
      this.event('lost');
      return;
    }
    if (this.phase === 'combat' && !this.queue.length && !this.enemies.length) {
      if (this.wave >= WAVES_TO_WIN && !this.endless) {
        this.phase = 'won';
        this.score += 10000;
        this.event('won');
      } else {
        this.phase = 'build';
        this.timer = 50;
        this.metal += 250 + this.wave * 40;
        this.event('clear', { wave: this.wave });
      }
    }
  }

  /** Soft push-apart inside 6 m buckets (a linked grid, no per-step allocation). */
  separate(list, dt, hostile) {
    const head = this._sepHead || (Object.defineProperty(this, '_sepHead', { value: new Int32Array(SEP_N * SEP_N) }), this._sepHead);
    if (!this._sepNext || this._sepNext.length < list.length) Object.defineProperty(this, '_sepNext', { value: new Int32Array(Math.max(64, list.length * 2)), configurable: true });
    const next = this._sepNext;
    head.fill(-1);
    const bucket = (x, z) => clamp(Math.floor(z / SEP) + SEP_OFF, 0, SEP_N - 1) * SEP_N + clamp(Math.floor(x / SEP) + SEP_OFF, 0, SEP_N - 1);
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.hp <= 0) continue;
      const c = bucket(u.x, u.z);
      next[i] = head[c];
      head[c] = i;
    }
    const valid = (x, z) => {
      const i = cellIndex(x, z);
      return hostile ? this.cost[i] < 10000 && !this.block[i] : !this.allyBlock[i];
    };
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (u.hp <= 0) continue;
      const gx = clamp(Math.floor(u.x / SEP) + SEP_OFF, 0, SEP_N - 1), gz = clamp(Math.floor(u.z / SEP) + SEP_OFF, 0, SEP_N - 1);
      const ur = hostile ? ENEMIES[u.type].r : 0.85;
      let count = 0;
      for (let dz = -1; dz <= 1; dz++) {
        const zz = gz + dz;
        if (zz < 0 || zz >= SEP_N) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = gx + dx;
          if (xx < 0 || xx >= SEP_N) continue;
          for (let j = head[zz * SEP_N + xx]; j >= 0; j = next[j]) {
            const v = list[j];
            if (v.id <= u.id || v.hp <= 0 || count > 18) continue;
            let vx = u.x - v.x, vz = u.z - v.z, len = Math.hypot(vx, vz);
            const vr = hostile ? ENEMIES[v.type].r : 0.85, need = (ur + vr) * 0.85;
            if (len >= need) continue;
            count++;
            if (len < 0.001) {
              vx = Math.sin(u.id * 2.7 + v.id);
              vz = Math.cos(u.id * 2.7 + v.id);
              len = 1;
            }
            const push = Math.min(need - len, dt * 5) * 0.5, px = (vx / len) * push, pz = (vz / len) * push;
            if (valid(u.x + px, u.z + pz)) {
              u.x += px;
              u.z += pz;
            }
            if (valid(v.x - px, v.z - pz)) {
              v.x -= px;
              v.z -= pz;
            }
          }
        }
      }
    }
  }

  snapshot() {
    return {
      version: 2,
      mapId: this.mapId,
      seed: this.seed,
      t: this.t,
      wave: this.wave,
      phase: this.phase,
      timer: this.timer,
      metal: this.metal,
      income: this.income,
      power: this.power,
      used: this.used,
      powered: this.powered,
      id: this.id,
      eventId: this.eventId,
      events: this.events.slice(-75),
      buildings: this.buildings,
      units: this.units,
      enemies: this.enemies,
      shots: this.shots,
      queue: this.queue,
      spawnClock: this.spawnClock,
      aiClock: this.aiClock,
      kills: this.kills,
      score: this.score,
      lanes: this.lanes,
      waveSize: this.waveSize,
      difficulty: this.difficulty,
      endless: this.endless,
      paused: this.paused,
      players: this.players,
      tutorial: this.tutorial,
    };
  }

  static restore(s) {
    if (!s || (s.version !== 1 && s.version !== 2) || !Array.isArray(s.buildings) || !Array.isArray(s.units)) throw Error('Save file is not valid.');
    const g = new Sim({ seed: s.seed, map: s.mapId || 'blackpine', difficulty: s.difficulty, endless: s.endless });
    const { version, mapId, ...rest } = s;
    Object.assign(g, rest);
    g.rand = rng(s.seed + Math.round(s.t * 100));
    g.upkeepClock = 0;
    g.buildings = g.buildings.filter((b) => TYPES[b.type]);
    g.enemies = (g.enemies || []).filter((e) => ENEMIES[e.type]);
    g.queue = (g.queue || []).filter((q) => ENEMIES[q.type]);
    g.shots = g.shots || [];
    g.events = g.events || [];
    if (!g.waveSize) g.waveSize = g.queue.length + g.enemies.length;
    g.rebuild();
    g.economy();
    return g;
  }
}
