/**
 * missions.js — SIGNAL, the campaign: pieces, missions, placement rules, the
 * recorded test run and saved progress. No DOM, no three.js.
 */

import { Life, transformPoints } from './life.js';

const rows = (lines) => lines.flatMap((row, y) => [...row].flatMap((ch, x) => (ch === 'O' ? [[x, y]] : [])));
const zone = (x, y, w, h, label = 'LAUNCH') => ({ x, y, w, h, label });
const receiver = (id, x, y, w = 3, h = 3, window = null) => ({ id, x, y, w, h, window });

/**
 * Pieces the player can place. `heading` is the direction of travel of the
 * unrotated shape (x right, y down); pieces without one show their angle.
 */
export const PIECES = {
  glider: {
    id: 'glider',
    name: 'Glider',
    detail: 'Five cells. Travels diagonally.',
    points: [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    heading: [1, 1],
  },
  cell: { id: 'cell', name: 'Single cell', detail: 'Add one cell to repair the signal.', points: [[0, 0]], heading: null },
  lwss: {
    id: 'lwss',
    name: 'Lightweight ship',
    detail: 'Nine cells. Travels straight, two cells every four generations.',
    points: rows(['.O..O', 'O....', 'O...O', 'OOOO.']),
    heading: [-1, 0],
  },
  eater: {
    id: 'eater',
    name: 'Eater',
    detail: 'Seven cells that stay still. Absorbs a glider and rebuilds itself.',
    points: rows(['OO..', 'O.O.', '..O.', '..OO']),
    heading: null,
  },
};

/** Pieces that look the same in every orientation cannot be rotated or flipped. */
export const pieceTurns = (id) => (PIECES[id]?.points.length || 0) > 1;

/** The rotate button's label: a compass heading for movers, an angle for still pieces. */
export function orientationLabel(id, rotation, flip) {
  const piece = PIECES[id];
  if (!piece || !pieceTurns(id)) return '1×1';
  if (piece.heading) {
    const [a, b] = transformPoints([[0, 0], piece.heading], rotation, flip);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    return (dy > 0 ? 'S' : dy < 0 ? 'N' : '') + (dx > 0 ? 'E' : dx < 0 ? 'W' : '');
  }
  return `${rotation * 90}°${flip ? ' ⇋' : ''}`;
}

/** A Gosper glider gun facing south-east, as fixed cells at (x, y). */
const gosperGun = (x, y) =>
  rows([
    '........................O...........',
    '......................O.O...........',
    '............OO......OO............OO',
    '...........O...O....OO............OO',
    'OO........O.....O...OO..............',
    'OO........O...O.OO....O.O...........',
    '..........O.....O.......O...........',
    '...........O...O....................',
    '............OO......................',
  ]).map(([px, py]) => [px + x, py + y]);

export const MISSIONS = [
  {
    id: 'first-light',
    name: 'First light',
    chapter: '01',
    kind: 'PLACEMENT',
    size: 32,
    limit: 72,
    brief: 'Restore the first receiver. Place a Glider in the launch zone, then run the field.',
    goal: 'Activate receiver A by generation 72.',
    lesson: 'Place. Test. Improve.',
    zones: [zone(5, 5, 3, 3)],
    receivers: [receiver('A', 19, 19)],
    hazards: [],
    inventory: { glider: 1 },
    fixed: [],
    hints: ['Select the Glider. Confirm its preview in the cyan launch zone.', 'Keep the direction at SE. The receiver detects any live cell inside its ring.'],
    solution: [{ piece: 'glider', x: 5, y: 5, rotation: 0, flip: false }],
    par: 1,
  },
  {
    id: 'change-course',
    name: 'Change course',
    chapter: '02',
    kind: 'ROTATION',
    size: 32,
    limit: 76,
    brief: 'The receiver is in the opposite corner. Rotate the signal before you launch it.',
    goal: 'Activate receiver A by generation 76.',
    lesson: 'Direction changes the result.',
    zones: [zone(23, 5, 3, 3)],
    receivers: [receiver('A', 7, 21)],
    hazards: [],
    inventory: { glider: 1 },
    fixed: [],
    hints: ['Use Rotate or press R. A rotation changes the direction of travel.', 'The receiver is to the southwest. Use SW, which is a 90° rotation.'],
    solution: [{ piece: 'glider', x: 23, y: 5, rotation: 1, flip: false }],
    par: 1,
  },
  {
    id: 'missing-link',
    name: 'Missing link',
    chapter: '03',
    kind: 'REPAIR',
    size: 32,
    limit: 76,
    brief: 'One cell is missing from a prepared Glider. Add one cell to restore the signal. Prepared cells cannot be removed.',
    goal: 'Repair the Glider and activate receiver A.',
    lesson: 'Small changes have large effects.',
    zones: [zone(5, 5, 4, 4, 'REPAIR')],
    receivers: [receiver('A', 20, 20)],
    hazards: [],
    inventory: { cell: 1 },
    fixed: [
      [6, 5],
      [7, 6],
      [5, 7],
      [7, 7],
    ],
    hints: [
      'Use Top View and zoom in on the repair zone. The four solid cells are prepared.',
      'Complete the bottom row: add the cell at column 6, row 7. Coordinates start at zero.',
    ],
    solution: [{ piece: 'cell', x: 6, y: 7, rotation: 0, flip: false }],
    par: 1,
  },
  {
    id: 'right-moment',
    name: 'Right moment',
    chapter: '04',
    kind: 'TIMING',
    size: 48,
    limit: 100,
    brief: 'The receiver opens for a short time. Choose the launch position so the first contact arrives inside that window.',
    goal: 'First contact with A must occur from generation 55 to 59.',
    lesson: 'Position controls arrival time.',
    zones: [zone(5, 5, 9, 9)],
    receivers: [receiver('A', 25, 25, 3, 3, [55, 59])],
    hazards: [],
    inventory: { glider: 1 },
    fixed: [],
    hints: [
      'Moving the Glider closer makes it arrive earlier. A diagonal shift changes its path.',
      'Try SE with the top-left corner at column 9, row 9. First contact counts, not later contact.',
    ],
    solution: [{ piece: 'glider', x: 9, y: 9, rotation: 0, flip: false }],
    par: 1,
  },
  {
    id: 'safe-passage',
    name: 'Safe passage',
    chapter: '05',
    kind: 'CONTAINMENT',
    size: 48,
    limit: 120,
    brief: 'Send two signals around the protected center. Keep all live cells out of the red region for the full test.',
    goal: 'Activate A and B. Keep the forbidden zone empty through generation 120.',
    lesson: 'Success includes what stays empty.',
    zones: [zone(5, 3, 9, 6, 'LAUNCH 1'), zone(3, 29, 6, 9, 'LAUNCH 2')],
    receivers: [receiver('A', 29, 19), receiver('B', 19, 15)],
    hazards: [zone(21, 24, 8, 9, 'FORBIDDEN')],
    inventory: { glider: 2 },
    fixed: [],
    holdToEnd: true,
    hints: ['Use one Glider from each launch zone. Red marks a failure region, not a wall.', 'Use SE at (11,3) and NE at (3,33). Both signals pass clear of the center.'],
    solution: [
      { piece: 'glider', x: 11, y: 3, rotation: 0, flip: false },
      { piece: 'glider', x: 3, y: 33, rotation: 3, flip: false },
    ],
    par: 2,
  },
  {
    id: 'signal-network',
    name: 'Signal network',
    chapter: '06',
    kind: 'SEQUENCE',
    size: 48,
    limit: 144,
    brief: 'Restore three receivers in order. Plan two signals, meet the final time window, and keep the protected region empty.',
    goal: 'Activate A, then B, then C. Reach C from generation 85 to 105. Stay safe through generation 144.',
    lesson: 'Several simple signals. One working system.',
    zones: [zone(4, 4, 7, 7, 'LAUNCH 1'), zone(36, 8, 7, 8, 'LAUNCH 2')],
    receivers: [receiver('A', 15, 15), receiver('B', 27, 21), receiver('C', 29, 29, 3, 3, [85, 105])],
    hazards: [zone(4, 26, 9, 10, 'FORBIDDEN')],
    inventory: { glider: 2 },
    fixed: [],
    order: ['A', 'B', 'C'],
    holdToEnd: true,
    hints: ['One signal can activate more than one receiver. A and C lie along the same diagonal.', 'Start with SE at (5,5) and SW at (40,11). Let the full safety test finish.'],
    solution: [
      { piece: 'glider', x: 5, y: 5, rotation: 0, flip: false },
      { piece: 'glider', x: 40, y: 11, rotation: 1, flip: false },
    ],
    par: 2,
  },
  // Chapter two: ships, a live glider gun, and the eater that tames it.
  {
    id: 'long-haul',
    name: 'Long haul',
    chapter: '07',
    kind: 'SHIPS',
    size: 48,
    limit: 110,
    brief: 'A new piece: the Lightweight ship flies in a straight line, twice as fast as a Glider. Send one signal of each kind.',
    goal: 'Reach A from generation 66 to 72. Activate B by generation 110.',
    lesson: 'Ships fly straight. Gliders fly diagonally.',
    zones: [zone(2, 19, 8, 8, 'LAUNCH 1'), zone(3, 37, 7, 8, 'LAUNCH 2')],
    receivers: [receiver('A', 41, 21, 3, 3, [66, 72]), receiver('B', 30, 12)],
    hazards: [],
    inventory: { lwss: 1, glider: 1 },
    fixed: [],
    hints: [
      'A lies due east of Launch 1, so no Glider can reach it. Rotate the ship twice so it faces E. A ship that starts too far east arrives before the window opens.',
      'Ship E with its corner at (3,20). Glider NE (three rotations) at (5,39) in Launch 2.',
    ],
    solution: [
      { piece: 'lwss', x: 3, y: 20, rotation: 2, flip: false },
      { piece: 'glider', x: 5, y: 39, rotation: 3, flip: false },
    ],
    par: 2,
  },
  {
    id: 'the-eater',
    name: 'The eater',
    chapter: '08',
    kind: 'ABSORB',
    size: 56,
    limit: 150,
    brief: 'A Gosper gun is back online. Its stream carries the signal to A, then keeps on firing. Place an Eater so the stream stops inside the frame.',
    goal: 'Let the stream reach A. Keep every red strip empty through generation 150.',
    lesson: 'A stable shape can absorb what hits it.',
    zones: [zone(38, 27, 8, 8, 'EATER')],
    receivers: [receiver('A', 31, 18)],
    hazards: [zone(46, 25, 2, 12, 'FORBIDDEN'), zone(36, 35, 12, 2, 'FORBIDDEN'), zone(42, 25, 4, 2, 'FORBIDDEN'), zone(36, 31, 2, 4, 'FORBIDDEN')],
    inventory: { eater: 1 },
    fixed: gosperGun(1, 1),
    holdToEnd: true,
    hints: [
      'Most shapes shatter when a Glider hits them, and the debris spills into the red frame. The Eater’s hook must face the incoming stream.',
      'Flip the Eater once (X) and place its corner at (40,29).',
    ],
    solution: [{ piece: 'eater', x: 40, y: 29, rotation: 0, flip: true }],
    par: 1,
  },
  {
    id: 'crossfire',
    name: 'Crossfire',
    chapter: '09',
    kind: 'CROSSING',
    size: 56,
    limit: 150,
    brief: 'Receiver B sits on the far side of a live glider stream. Time one Glider through a gap in the stream, and tame the stream with an Eater.',
    goal: 'Activate B. Keep every red strip empty through generation 150.',
    lesson: 'Timing turns a wall into a door.',
    zones: [zone(38, 27, 8, 8, 'EATER'), zone(8, 30, 9, 9, 'LAUNCH')],
    receivers: [receiver('B', 36, 10)],
    hazards: [zone(46, 25, 2, 12, 'FORBIDDEN'), zone(36, 35, 12, 2, 'FORBIDDEN'), zone(42, 25, 4, 2, 'FORBIDDEN'), zone(36, 31, 2, 4, 'FORBIDDEN')],
    inventory: { eater: 1, glider: 1 },
    fixed: gosperGun(1, 1),
    holdToEnd: true,
    hints: [
      'The gun fires every 30 generations, so the stream has gaps. Moving the launch point one cell changes when your Glider reaches the stream.',
      'Eater flipped at (40,29). Glider NE (three rotations) at (10,30).',
    ],
    solution: [
      { piece: 'eater', x: 40, y: 29, rotation: 0, flip: true },
      { piece: 'glider', x: 10, y: 30, rotation: 3, flip: false },
    ],
    par: 2,
  },
];

export const findMission = (id) => MISSIONS.find((m) => m.id === id) || null;
export const pieceBudget = (mission) => Object.values(mission.inventory).reduce((a, b) => a + b, 0);

const inside = (x, y, r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

/** The board cells a placement covers. */
export function placementCells(p) {
  if (!p || !PIECES[p.piece]) throw new Error('Unknown piece.');
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 3 || typeof p.flip !== 'boolean')
    throw new Error('Invalid piece position or direction.');
  return transformPoints(PIECES[p.piece].points, p.rotation, p.flip).map(([x, y]) => [x + p.x, y + p.y]);
}

/** Throws with a player-facing message if the placements break a rule. */
export function validatePlacements(mission, placements) {
  if (!Array.isArray(placements) || placements.length > 32) throw new Error('Invalid piece list.');
  const used = {};
  const occupied = new Set(mission.fixed.map(([x, y]) => y * mission.size + x));
  for (const p of placements) {
    const cells = placementCells(p);
    used[p.piece] = (used[p.piece] || 0) + 1;
    if (used[p.piece] > (mission.inventory[p.piece] || 0)) throw new Error(`No ${PIECES[p.piece].name} pieces remain.`);
    if (!mission.zones.some((z) => cells.every(([x, y]) => inside(x, y, z)))) throw new Error('Keep the complete piece inside one cyan placement zone.');
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= mission.size || y >= mission.size) throw new Error('The piece is outside the board.');
      if (occupied.has(y * mission.size + x)) throw new Error('The piece overlaps another live cell.');
      if (mission.receivers.some((r) => inside(x, y, r)) || mission.hazards.some((h) => inside(x, y, h))) throw new Error('Do not place cells in a receiver or forbidden zone.');
      occupied.add(y * mission.size + x);
    }
  }
  return true;
}

/** The starting field for a set of placements (bounded, no wrap). */
export function buildField(mission, placements) {
  validatePlacements(mission, placements);
  const life = new Life(mission.size, false);
  life.stamp(mission.fixed, 0, 0);
  for (const p of placements) life.stamp(placementCells(p), 0, 0);
  return life;
}

const clone = (v) => JSON.parse(JSON.stringify(v));

/** A test run: steps the field, checks the mission rules and records every generation for replay. */
export class MissionRun {
  constructor(mission, placements) {
    this.mission = mission;
    this.placements = clone(placements);
    this.life = buildField(mission, placements);
    this.hits = {};
    this.events = [];
    this.result = null;
    this.frames = [];
    this.cursor = 0;
    this.evaluate();
    this.saveFrame();
  }

  fail(code, message, cell = null) {
    this.result = { status: 'failure', code, message, generation: this.life.generation, cell };
    this.events.push({ ...this.result, type: 'failure' });
  }

  evaluate() {
    const m = this.mission;
    const life = this.life;
    const gen = life.generation;
    for (const h of m.hazards) {
      for (let y = h.y; y < h.y + h.h; y++) {
        for (let x = h.x; x < h.x + h.w; x++) {
          if (life.cells[y * life.size + x]) {
            this.fail('hazard', `Forbidden zone reached at generation ${gen}.`, { x, y });
            return;
          }
        }
      }
    }
    for (const r of m.receivers) {
      if (this.hits[r.id] !== undefined) continue;
      let contact = null;
      for (let y = r.y; y < r.y + r.h && !contact; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (life.cells[y * life.size + x]) {
            contact = { x, y };
            break;
          }
        }
      }
      if (contact) {
        if (r.window && (gen < r.window[0] || gen > r.window[1])) {
          this.fail('window', `Receiver ${r.id} reached at generation ${gen}. Required window: ${r.window[0]}–${r.window[1]}.`, contact);
          return;
        }
        if (m.order) {
          const expected = m.order.find((id) => this.hits[id] === undefined);
          if (expected !== r.id) {
            this.fail('order', `Receiver ${r.id} reached before ${expected}.`, contact);
            return;
          }
          const previous = m.order[m.order.indexOf(r.id) - 1];
          if (previous && this.hits[previous] >= gen) {
            this.fail('order', `Receivers ${previous} and ${r.id} need separate generations.`, contact);
            return;
          }
        }
        this.hits[r.id] = gen;
        this.events.push({ type: 'receiver', id: r.id, generation: gen, cell: contact });
      } else if (r.window && gen >= r.window[1]) {
        this.fail('missed-window', `Receiver ${r.id} missed its window (${r.window[0]}–${r.window[1]}).`);
        return;
      }
    }
    const allHit = m.receivers.every((r) => this.hits[r.id] !== undefined);
    if (allHit && (!m.holdToEnd || gen >= m.limit)) {
      this.result = {
        status: 'success',
        generation: gen,
        arrival: m.receivers.length ? Math.max(...Object.values(this.hits)) : gen,
        pieces: this.placements.length,
        message: 'All mission conditions passed.',
      };
      this.events.push({ ...this.result, type: 'success' });
      return;
    }
    if (gen >= m.limit) {
      const missing = m.receivers
        .filter((r) => this.hits[r.id] === undefined)
        .map((r) => r.id)
        .join(', ');
      this.fail('deadline', `Generation limit reached. Missing receiver${missing.includes(',') ? 's' : ''}: ${missing}.`);
      return;
    }
    if (life.population === 0 && !allHit) this.fail('empty', `The field is empty at generation ${gen}. The remaining receivers cannot activate.`);
  }

  saveFrame() {
    this.frames.push({
      life: this.life.snapshot(),
      hits: { ...this.hits },
      events: this.events.map((e) => ({ ...e })),
      result: this.result ? clone(this.result) : null,
    });
    this.cursor = this.frames.length - 1;
  }

  seek(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.frames.length) throw new Error('Replay position is out of range.');
    const f = this.frames[index];
    this.life.restore(f.life);
    this.hits = { ...f.hits };
    this.events = f.events.map((e) => ({ ...e }));
    this.result = f.result ? clone(f.result) : null;
    this.cursor = index;
    return this;
  }

  /** Forward one generation: replay a recorded one, or compute the next. False once finished. */
  step() {
    if (this.cursor < this.frames.length - 1) {
      this.seek(this.cursor + 1);
      return true;
    }
    if (this.result) return false;
    this.life.step();
    this.evaluate();
    this.saveFrame();
    return true;
  }

  finish() {
    let guard = this.mission.limit + 2;
    while (!this.result && guard-- > 0) this.step();
    return this.result;
  }

  export() {
    return { format: 'emergence-signal/replay-v1', missionVersion: 1, mission: this.mission.id, placements: clone(this.placements) };
  }
}

export function importReplay(data) {
  if (!data || data.format !== 'emergence-signal/replay-v1' || data.missionVersion !== 1) throw new Error('This replay uses an unsupported format or mission version.');
  const mission = findMission(data.mission);
  if (!mission) throw new Error('Unknown mission.');
  validatePlacements(mission, data.placements);
  return { mission, placements: clone(data.placements) };
}

export const newProgress = () => ({ format: 'emergence-signal/progress-v1', version: 1, records: {}, drafts: {}, lastMission: 'first-light' });

/** Load a progress object, re-running every saved solution so a record is always real. */
export function importProgress(data) {
  if (!data || data.format !== 'emergence-signal/progress-v1' || data.version !== 1) throw new Error('This progress file uses an unsupported format or mission version.');
  const progress = newProgress();
  if (findMission(data.lastMission)) progress.lastMission = data.lastMission;
  for (const [id, placements] of Object.entries(data.drafts || {})) {
    const mission = findMission(id);
    if (!mission) continue;
    try {
      validatePlacements(mission, placements);
      progress.drafts[id] = clone(placements);
    } catch {
      /* a stale draft is dropped, not fatal */
    }
  }
  for (const [id, record] of Object.entries(data.records || {})) {
    const mission = findMission(id);
    if (!mission) continue;
    const solutions = record.solutions || [record.placements];
    if (!Array.isArray(solutions) || solutions.length > 4) throw new Error('Invalid record data.');
    for (const placements of solutions) {
      const run = new MissionRun(mission, placements);
      if (run.finish()?.status !== 'success') throw new Error(`The saved solution for ${mission.name} does not pass.`);
      recordRun(progress, run);
    }
  }
  return progress;
}

/**
 * Keep the fewest-pieces and the earliest-arrival solutions for a mission.
 * Returns true when this run set a new record.
 */
export function recordRun(progress, run) {
  if (run.result?.status !== 'success') return false;
  const id = run.mission.id;
  const result = run.result;
  const previous = progress.records[id];
  const candidates = [...(previous?.solutions || []), clone(run.placements)].map((p) => ({ p, run: new MissionRun(run.mission, p) }));
  for (const c of candidates) c.r = c.run.finish();
  const fewest = candidates.reduce((a, b) => (a.p.length <= b.p.length ? a : b));
  const fastest = candidates.reduce((a, b) => (a.r.arrival <= b.r.arrival ? a : b));
  const solutions = [fewest.p];
  if (JSON.stringify(fewest.p) !== JSON.stringify(fastest.p)) solutions.push(fastest.p);
  progress.records[id] = { pieces: fewest.p.length, arrival: fastest.r.arrival, solutions };
  return !previous || result.pieces < previous.pieces || result.arrival < previous.arrival;
}
