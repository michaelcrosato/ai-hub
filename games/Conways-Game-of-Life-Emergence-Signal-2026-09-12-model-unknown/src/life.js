/**
 * life.js — the Game of Life itself: the field, its history, pattern
 * transforms, the pattern library, RLE and session files. No DOM, no three.js.
 */

export const GRID_SIZES = [32, 48, 64, 96, 128, 192, 256];
export const MAX_SIZE = 256;
/** Generations a dead cell keeps a fading trail. */
export const TRAIL_LENGTH = 12;

/** A small seeded generator (mulberry32), so a seed always plants the same field. */
export function seededRandom(seed) {
  let s = Number(seed) >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Life {
  constructor(size = 64, wrap = true) {
    if (!Number.isInteger(size) || size < 3 || size > MAX_SIZE) throw new RangeError('Grid size must be 3–256.');
    this.size = size;
    this.wrap = wrap;
    this.cells = new Uint8Array(size * size);
    this.next = new Uint8Array(size * size);
    this.ages = new Uint16Array(size * size);
    this.trails = new Uint8Array(size * size);
    this.padded = new Uint8Array((size + 2) ** 2);
    this.generation = 0;
    this.population = 0;
    this.births = 0;
    this.deaths = 0;
    this.seed = 62401;
  }

  recount() {
    let n = 0;
    for (let i = 0; i < this.cells.length; i++) n += this.cells[i];
    this.population = n;
    return n;
  }

  set(x, y, alive = 1) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return false;
    const i = y * this.size + x;
    const v = alive ? 1 : 0;
    if (this.cells[i] === v) return false;
    this.population += v - this.cells[i];
    this.cells[i] = v;
    this.ages[i] = v;
    this.trails[i] = 0;
    return true;
  }

  clear() {
    this.cells.fill(0);
    this.next.fill(0);
    this.ages.fill(0);
    this.trails.fill(0);
    this.generation = this.population = this.births = this.deaths = 0;
  }

  randomize(density = 0.28, seed = this.seed) {
    if (!Number.isFinite(density) || density < 0 || density > 1) throw new RangeError('Density must be 0–1.');
    this.clear();
    this.seed = Number(seed) >>> 0;
    const rand = seededRandom(this.seed);
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = +(rand() < density);
      this.ages[i] = this.cells[i];
    }
    this.recount();
  }

  stamp(points, x, y, alive = 1) {
    let changed = false;
    for (const [px, py] of points) changed = this.set(x + px, y + py, alive) || changed;
    return changed;
  }

  neighbors(x, y) {
    const n = this.size;
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        let cx = x + dx;
        let cy = y + dy;
        if (this.wrap) {
          cx = (cx + n) % n;
          cy = (cy + n) % n;
        } else if (cx < 0 || cy < 0 || cx >= n || cy >= n) continue;
        count += this.cells[cy * n + cx];
      }
    }
    return count;
  }

  /** One generation of B3/S23 on a padded copy (wrapped or dead border). */
  step() {
    const n = this.size;
    const w = n + 2;
    const pad = this.padded;
    const { cells, next, ages, trails } = this;
    pad.fill(0);
    for (let y = 0; y < n; y++) pad.set(cells.subarray(y * n, y * n + n), (y + 1) * w + 1);
    if (this.wrap) {
      for (let x = 1; x <= n; x++) {
        pad[x] = pad[n * w + x];
        pad[(n + 1) * w + x] = pad[w + x];
      }
      for (let y = 0; y < n + 2; y++) {
        pad[y * w] = pad[y * w + n];
        pad[y * w + n + 1] = pad[y * w + 1];
      }
    }
    let population = 0;
    let births = 0;
    let deaths = 0;
    for (let y = 0, i = 0; y < n; y++) {
      for (let x = 0; x < n; x++, i++) {
        const p = (y + 1) * w + x + 1;
        const sum = pad[p - w - 1] + pad[p - w] + pad[p - w + 1] + pad[p - 1] + pad[p + 1] + pad[p + w - 1] + pad[p + w] + pad[p + w + 1];
        const alive = +(sum === 3 || (cells[i] === 1 && sum === 2));
        next[i] = alive;
        population += alive;
        if (alive) {
          births += 1 - cells[i];
          ages[i] = cells[i] ? Math.min(65535, ages[i] + 1) : 1;
          trails[i] = 0;
        } else {
          deaths += cells[i];
          ages[i] = 0;
          trails[i] = cells[i] ? TRAIL_LENGTH : Math.max(0, trails[i] - 1);
        }
      }
    }
    this.cells = next;
    this.next = cells;
    this.population = population;
    this.births = births;
    this.deaths = deaths;
    this.generation++;
    return { population, births, deaths, generation: this.generation };
  }

  /**
   * A copy of the field. Pass an old snapshot of the same size as `into` to
   * reuse its arrays (the undo history recycles its oldest entry this way, so
   * a long run at 60 generations per second does not allocate every step).
   */
  snapshot(into = null) {
    const reuse = into && into.size === this.size && into.cells?.length === this.cells.length;
    const snap = reuse ? into : { cells: this.cells.slice(), ages: this.ages.slice(), trails: this.trails.slice() };
    if (reuse) {
      snap.cells.set(this.cells);
      snap.ages.set(this.ages);
      snap.trails.set(this.trails);
    }
    snap.size = this.size;
    snap.wrap = this.wrap;
    snap.seed = this.seed;
    snap.generation = this.generation;
    snap.population = this.population;
    snap.births = this.births;
    snap.deaths = this.deaths;
    return snap;
  }

  restore(snap) {
    if (snap.size !== this.size || snap.cells.length !== this.cells.length) throw new Error('Snapshot size does not match the grid.');
    this.cells.set(snap.cells);
    this.ages.set(snap.ages);
    this.trails.set(snap.trails);
    for (const key of ['wrap', 'seed', 'generation', 'population', 'births', 'deaths']) this[key] = snap[key];
  }
}

/** Undo/redo stacks of field snapshots. */
export class History {
  constructor(limit = 96) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  push(entry) {
    this.past.push(entry);
    if (this.past.length > this.limit) this.past.shift();
    this.future.length = 0;
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(current);
    return this.past.pop();
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(current);
    return this.future.pop();
  }
  clear() {
    this.past.length = 0;
    this.future.length = 0;
  }
}

/** Rotate (quarter turns) and mirror a point list, then move it back to the origin. */
export function transformPoints(points, rotation = 0, flip = false) {
  if (!points.length) return [];
  let out = points.map(([x, y]) => [flip ? -x : x, y]);
  const turns = ((rotation % 4) + 4) % 4;
  for (let r = 0; r < turns; r++) out = out.map(([x, y]) => [-y, x]);
  const minX = Math.min(...out.map((p) => p[0]));
  const minY = Math.min(...out.map((p) => p[1]));
  return out.map(([x, y]) => [x - minX, y - minY]);
}

/** Parse a Life RLE file (B3/S23 only). */
export function parseRLE(text) {
  if (typeof text !== 'string' || text.length > 2e6) throw new Error('The RLE file is too large.');
  const lines = text.replace(/\r/g, '').split('\n');
  const name =
    lines
      .find((l) => /^#N\s/i.test(l))
      ?.replace(/^#N\s*/i, '')
      .slice(0, 80) || 'Imported pattern';
  const body = lines.filter((l) => l.trim() && !l.trim().startsWith('#'));
  const header = body.shift()?.match(/^\s*x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)(?:\s*,\s*rule\s*=\s*(\S+))?\s*$/i);
  if (!header) throw new Error('Missing RLE header: x = width, y = height, rule = B3/S23.');
  const width = Number(header[1]);
  const height = Number(header[2]);
  if (width < 1 || height < 1 || width > MAX_SIZE || height > MAX_SIZE) throw new Error('Pattern dimensions must be 1–256 cells.');
  const rule = (header[3] || 'B3/S23').toUpperCase();
  if (!['B3/S23', '23/3', 'S23/B3'].includes(rule)) throw new Error('This lab supports Conway’s rule B3/S23 only.');
  const data = body.join('').replace(/\s/g, '');
  let x = 0;
  let y = 0;
  let run = '';
  let ended = false;
  const points = [];
  for (const ch of data) {
    if (ended) throw new Error('Unexpected data after the RLE end marker.');
    if (/\d/.test(ch)) {
      run += ch;
      if (run.length > 6) throw new Error('RLE run is too large.');
      continue;
    }
    const count = run ? Number(run) : 1;
    if (count < 1 || count > MAX_SIZE) throw new Error('RLE run is out of range.');
    run = '';
    if (ch === '!') {
      if (count !== 1) throw new Error('Invalid RLE end marker.');
      ended = true;
    } else if (ch === '$') {
      y += count;
      x = 0;
      if (y > height) throw new Error('RLE rows exceed the declared height.');
    } else if (ch === 'b' || ch === 'o') {
      if (x + count > width || y >= height) throw new Error('RLE cells exceed the declared dimensions.');
      if (ch === 'o') for (let k = 0; k < count; k++) points.push([x + k, y]);
      x += count;
    } else throw new Error(`Invalid RLE token: ${ch}.`);
  }
  if (!ended || run) throw new Error('RLE data must end with !.');
  return { name, width, height, points };
}

export function toRLE(life, name = 'Emergence') {
  const n = life.size;
  const rows = [];
  for (let y = 0; y < n; y++) {
    let last = n - 1;
    while (last >= 0 && !life.cells[y * n + last]) last--;
    let row = '';
    let x = 0;
    while (x <= last) {
      const v = life.cells[y * n + x];
      let run = 1;
      while (x + run <= last && life.cells[y * n + x + run] === v) run++;
      row += (run > 1 ? run : '') + (v ? 'o' : 'b');
      x += run;
    }
    rows.push(row);
  }
  while (rows.length > 1 && !rows.at(-1)) rows.pop();
  const tokens = (rows.join('$') + '!').match(/\d*[bo$!]/g) || ['!'];
  let out = '';
  let line = '';
  for (const t of tokens) {
    if (line.length + t.length > 70) {
      out += line + '\n';
      line = '';
    }
    line += t;
  }
  return `#N ${name.replace(/[\r\n]/g, ' ').slice(0, 80)}
#C Exported from Emergence. Generation ${life.generation}.
x = ${n}, y = ${n}, rule = B3/S23
${out}${line}
`;
}

export function toSession(life, name = 'Untitled field') {
  const live = [];
  for (let i = 0; i < life.cells.length; i++) if (life.cells[i]) live.push([i, life.ages[i]]);
  return { format: 'emergence/v1', size: life.size, generation: life.generation, wrap: life.wrap, seed: life.seed, name: String(name).slice(0, 80), live };
}

export function fromSession(data) {
  if (!data || data.format !== 'emergence/v1' || !GRID_SIZES.includes(data.size)) throw new Error('This is not a valid Emergence session.');
  if (!Number.isSafeInteger(data.generation) || data.generation < 0 || data.generation > 1e12 || typeof data.wrap !== 'boolean')
    throw new Error('Invalid session settings.');
  if (!Array.isArray(data.live) || data.live.length > data.size ** 2) throw new Error('Invalid live-cell data.');
  const life = new Life(data.size, data.wrap);
  const seen = new Set();
  for (const entry of data.live) {
    if (!Array.isArray(entry) || entry.length !== 2) throw new Error('Invalid cell entry.');
    const [i, age] = entry;
    if (!Number.isInteger(i) || i < 0 || i >= life.cells.length || !Number.isInteger(age) || age < 1 || age > 65535 || seen.has(i))
      throw new Error('Invalid or duplicate cell.');
    seen.add(i);
    life.cells[i] = 1;
    life.ages[i] = age;
  }
  life.generation = data.generation;
  life.seed = Number(data.seed) >>> 0;
  life.recount();
  return { life, name: typeof data.name === 'string' ? data.name.slice(0, 80) : 'Imported field' };
}

const parseRows = (rows) => rows.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === 'O' ? [[x, y]] : [])));
const pattern = (id, name, kind, detail, rows) => ({
  id,
  name,
  kind,
  detail,
  points: parseRows(rows),
  width: Math.max(...rows.map((r) => r.length)),
  height: rows.length,
});

export const PATTERNS = [
  pattern('glider', 'Glider', 'Movers', 'Five cells. Four phases. A diagonal journey.', ['.O.', '..O', 'OOO']),
  pattern('pulsar', 'Pulsar', 'Oscillators', 'A symmetric oscillator with a three-generation cycle.', [
    '..OOO...OOO..',
    '.............',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '..OOO...OOO..',
    '.............',
    '..OOO...OOO..',
    'O....O.O....O',
    'O....O.O....O',
    'O....O.O....O',
    '.............',
    '..OOO...OOO..',
  ]),
  pattern('gosper', 'Gosper gun', 'Growth', 'A glider leaves the gun every 30 generations.', [
    '........................O...........',
    '......................O.O...........',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO..............',
    'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........',
    '...........O...O....................',
    '............OO......................',
  ]),
  pattern('acorn', 'Acorn', 'Growth', 'Seven cells grow into a long-lived, complex field.', ['.O.....', '...O...', 'OO..OOO']),
  pattern('pentadecathlon', 'Pentadecathlon', 'Oscillators', 'A 15-generation cycle from twelve starting cells.', ['..O....O..', 'OO.OOOO.OO', '..O....O..']),
  pattern('rpentomino', 'R-pentomino', 'Growth', 'A small seed with a surprisingly long story.', ['.OO', 'OO.', '.O.']),
  pattern('lwss', 'Lightweight ship', 'Movers', 'A nine-cell ship that travels across the field.', ['.O..O', 'O....', 'O...O', 'OOOO.']),
  pattern('mwss', 'Middleweight ship', 'Movers', 'A longer hull. Same speed: two cells every four generations.', ['...O..', '.O...O', 'O.....', 'O....O', 'OOOOO.']),
  pattern('hwss', 'Heavyweight ship', 'Movers', 'The largest of the classic ships. Its sparks trail behind.', ['...OO..', '.O....O', 'O......', 'O.....O', 'OOOOOO.']),
  pattern('diehard', 'Diehard', 'Growth', 'A seven-cell seed that vanishes after 130 generations on an unbounded field.', ['......O.', 'OO......', '.O...OOO']),
  pattern('piheptomino', 'Pi-heptomino', 'Growth', 'Seven cells shaped like π. It burns for 173 generations.', ['OOO', 'O.O', 'O.O']),
  pattern('bheptomino', 'B-heptomino', 'Growth', 'A restless seed that throws off a glider on its way.', ['O.OO', 'OOO.', '.O..']),
  pattern('beacon', 'Beacon', 'Oscillators', 'Two blocks exchange a pair of cells.', ['OO..', 'OO..', '..OO', '..OO']),
  pattern('toad', 'Toad', 'Oscillators', 'A six-cell oscillator with a two-generation cycle.', ['.OOO', 'OOO.']),
  pattern('blinker', 'Blinker', 'Oscillators', 'The simplest oscillator. A perfect first experiment.', ['OOO']),
  pattern('galaxy', 'Kok’s galaxy', 'Oscillators', 'Four arms turn through an eight-generation cycle.', [
    'OOOOOO.OO',
    'OOOOOO.OO',
    '.......OO',
    'OO.....OO',
    'OO.....OO',
    'OO.....OO',
    'OO.......',
    'OO.OOOOOO',
    'OO.OOOOOO',
  ]),
  pattern('figure8', 'Figure eight', 'Oscillators', 'Two squares trade corners every eight generations.', ['OOO...', 'OOO...', 'OOO...', '...OOO', '...OOO', '...OOO']),
  pattern('block', 'Block', 'Still life', 'Four cells in balance. This shape does not change.', ['OO', 'OO']),
  pattern('beehive', 'Beehive', 'Still life', 'Six cells around an empty center. A common final shape.', ['.OO.', 'O..O', '.OO.']),
  pattern('eater', 'Eater', 'Still life', 'A fishhook that absorbs a glider and rebuilds itself.', ['OO..', 'O.O.', '..O.', '..OO']),
];

export const findPattern = (id) => PATTERNS.find((p) => p.id === id) || PATTERNS[0];
