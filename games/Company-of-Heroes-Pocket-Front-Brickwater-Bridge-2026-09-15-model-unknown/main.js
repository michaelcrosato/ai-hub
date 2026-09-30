/* Pocket Front — the rules, the interface, input and the loop.
   Boots through the shared kit (three.js r186 WebGPURenderer, WebGL2 fallback). Keyboard,
   mouse, touch and controller all arrive as kit.input actions; the HUD and menus are DOM,
   and a controller drives them with an on-screen cursor. view.js draws the diorama,
   models.js holds the toys and the two operations, audio.js makes the sound. */

import { boot } from 'kit/boot.js';
import { MOUSE_LOOK, TOUCH_LOOK } from 'kit/input.js';
import { LEVELS, PAL, clamp, lerp } from './models.js';
import { createView } from './view.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const icon = (id) => `<svg><use href="#i-${id}"/></svg>`;
const DIFF_NAMES = ['Relaxed', 'Regular', 'Veteran'];
const MATCH_TIME = 360;
const TICKETS = 240;

const TYPES = {
  rifle: { name: 'PIP', role: 'Rifle', hp: 120, speed: 3.2, range: 8.1, damage: 7.1, rate: 0.7, suppress: 0.045 },
  gunner: { name: 'BRICK', role: 'Machine gun', hp: 160, speed: 2.55, range: 9.5, damage: 4.4, rate: 0.29, suppress: 0.2 },
  bazooka: { name: 'BOOM', role: 'Bazooka', hp: 110, speed: 2.8, range: 10.5, damage: 25, rate: 2.8, suppress: 0.18 },
  grenadier: { name: 'SPARK', role: 'Grenadier', hp: 115, speed: 3.05, range: 7.8, damage: 16, rate: 1.85, suppress: 0.12 },
  medic: { name: 'PATCH', role: 'Medic', hp: 110, speed: 3.2, range: 6.5, damage: 4.0, rate: 0.95, suppress: 0.02 },
  tank: { name: 'TINNY', role: 'Light tank', hp: 340, speed: 1.9, range: 11, damage: 34, rate: 2.7, suppress: 0.4 },
};
const ABILITIES = {
  grenade: { cost: 25, cd: 11, range: 11, radius: 2.8, name: 'GRENADE' },
  smoke: { cost: 20, cd: 18, range: 15, radius: 3.7, name: 'SMOKE' },
  aid: { cost: 35, cd: 25, range: 100, radius: 3.8, name: 'AID DROP' },
  tank: { cost: 90, cd: 55, name: 'TIN TANK' },
};
const SQUAD_TYPES = ['rifle', 'gunner', 'bazooka', 'grenadier', 'medic'];
const BLUE_SPAWN = [[-17.8, -2.6], [-18.2, -0.1], [-17.2, 2.1], [-19, 3.6], [-20, 1.8]];
const RED_SPAWN = [[17.4, -2.1], [18.4, 1], [17.0, 3.2], [19.5, -3.5], [20, 0]];
const BASE_TENTS = [{ x: -19, z: -0.9 }, { x: 19, z: 0.9 }];

/* ------------------------------------------------------------------ saved settings and records */

function save(key, value) {
  try {
    localStorage.setItem('pocket-front-' + key, JSON.stringify(value));
  } catch {
    /* private mode: nothing is kept */
  }
}
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem('pocket-front-' + key));
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

const settings = { sound: true, effects: true };
{
  const saved = load('settings', {});
  if (saved && typeof saved.sound === 'boolean') settings.sound = saved.sound;
  if (saved && typeof saved.effects === 'boolean') settings.effects = saved.effects;
}
let difficulty = clamp(Math.round(Number(load('difficulty', 1))) || 0, 0, 2);
let levelIndex = clamp(Math.round(Number(load('op', 0))) || 0, 0, LEVELS.length - 1);
let lv = LEVELS[levelIndex];

// Operation 01 keeps the original record keys, so old best scores carry over.
const bestKey = (level, diff) => (level.id === 'brickwater' ? `best-${diff}` : `best-${level.id}-${diff}`);
const bestScore = (level, diff) => Math.max(0, Number(load(bestKey(level, diff), 0)) || 0);
const starsFor = (score) => (score > 160 ? 3 : score > 70 ? 2 : score > 0 ? 1 : 0);

/* ------------------------------------------------------------------ state */

let kit = null, view = null, cam = null;
let game = null, loadedLevel = null;
const selected = new Set();
let armed = null, hover = null, drag = null, camFocus = null;
let previousPhase = 'brief', visualTime = 0, uiClock = 0, uid = 0;
let coachStep = 0, coachHidden = false, lastW = 0, lastH = 0;
const hoverPt = { x: 0, z: 0 }, tapPt = { x: 0, z: 0 }, panA = { x: 0, z: 0 }, panB = { x: 0, z: 0 }, cornerPt = { x: 0, z: 0 };
const audio = new AudioEngine(() => settings.sound);
const overlay = $('overlay'), ctx = overlay.getContext('2d'), mini = $('minimap'), mc = mini.getContext('2d');
const coarse = matchMedia('(pointer: coarse)');

const source = () => (kit ? kit.input.source : 'keyboard');
/** The verb for a pointer order in the current input style. */
const verb = () => (source() === 'gamepad' ? 'Press A on' : source() === 'touch' ? 'Tap' : 'Click');
const rumble = (s, ms) => kit?.input.rumble(s, ms);

function toast(text, type = '') {
  const box = $('toasts'), div = document.createElement('div');
  div.className = 'toast ' + type;
  div.textContent = text;
  box.appendChild(div);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => div.remove(), 3600);
}

/* ------------------------------------------------------------------ units and the match */

function home(team) {
  return team ? { x: 19, z: -1 } : { x: -19, z: 1 };
}
function makeUnit(type, team, x, z) {
  const t = TYPES[type];
  return {
    id: uid++, type, team, name: team ? (type === 'tank' ? 'GRUMBLE' : t.name) : t.name, x, z, hp: t.hp, maxHp: t.hp,
    state: 'alive', downTimer: 0, recoverTimer: 0, angle: team ? -Math.PI / 2 : Math.PI / 2, path: [], order: 'hold',
    attackId: null, pointId: null, suppression: 0, shot: Math.random() * 0.5, flash: 0, moving: false, cover: false,
    retreat: false, think: Math.random() * 2, xp: 0, rank: 0, reviveProgress: 0, lastHit: -100, healSpark: 0, aiWait: 0, slot: 0,
  };
}

function resetGame() {
  uid = 0;
  camFocus = null;
  audio.beat = 0;
  audio.nextBeat = 0;
  selected.clear();
  armed = null;
  hover = null;
  drag = null;
  game = {
    phase: 'brief', t: 0, tickets: [TICKETS, TICKETS], supply: lv.supply,
    points: lv.points.map((p, i) => ({ id: i, name: p.name, letter: p.letter, x: p.x, z: p.z, cap: 0, owner: -1, contested: false, active: 0 })),
    covers: lv.covers.map((c, i) => ({ id: i, x: c[0], z: c[1], w: c[2], d: c[3], hp: 60 })),
    units: [], projectiles: [], tracers: [], particles: [], bursts: [], smokes: [], aids: [], rings: [], floaters: [],
    cooldowns: { grenade: 0, smoke: 0, aid: 0, tank: 0 },
    stats: { captures: 0, losses: 0, kills: 0, revives: 0 },
    tanksWarned: 0, tanksSent: 0, enemyGrenade: 22, shake: 0, endReason: '', sudden: false, aiTime: 0, counts: [0, 0],
  };
  for (let i = 0; i < 5; i++) {
    game.units.push(makeUnit(SQUAD_TYPES[i], 0, BLUE_SPAWN[i][0], BLUE_SPAWN[i][1]));
    game.units.push(makeUnit(SQUAD_TYPES[i], 1, RED_SPAWN[i][0], RED_SPAWN[i][1]));
  }
  buildNav();
  for (const u of game.units) if (u.team === 0) selected.add(u.id);
  coachStep = 0;
  coachHidden = false;
  $('coach').classList.remove('hidden');
  setCoach(0);
  if (view) {
    view.clearUnits();
    if (loadedLevel !== lv) {
      view.loadLevel(lv, game.covers);
      loadedLevel = lv;
    }
    view.syncCovers(game.covers);
  }
  makeCards();
  uiClock = 0;
  updateUI();
}

/* ------------------------------------------------------------------ the walk grid and paths */

const NX = 45, NZ = 33, NCELLS = NX * NZ;
const nav = new Uint8Array(NCELLS);
const pfScore = new Float32Array(NCELLS), pfPrev = new Int16Array(NCELLS), pfClosed = new Uint8Array(NCELLS);
const pfOpen = [];

function buildNav() {
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = i - 22, z = j - 16;
      let ok = Math.abs(x) < 21.7 && Math.abs(z) < 15.7;
      // Water blocks feet (not sight) except where a crossing is built over it.
      if (ok) for (const w of lv.water) if (Math.abs(x - w.x) < w.hw && Math.abs(z - w.z) < w.hd && !lv.crossings.some((c) => Math.abs(x - c.x) < c.hw && Math.abs(z - c.z) < c.hd)) ok = false;
      if (ok) for (const b of lv.buildings) if (Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35) ok = false;
      if (ok) for (const b of BASE_TENTS) if (Math.abs(x - b.x) < 1.5 && Math.abs(z - b.z) < 1.1) ok = false;
      if (ok) for (const b of lv.blockers) if (Math.abs(x - b.x) < b.hw + 0.2 && Math.abs(z - b.z) < b.hd + 0.2) ok = false;
      if (ok) for (const c of game.covers) if (c.hp > 0 && Math.abs(x - c.x) < c.w / 2 + 0.2 && Math.abs(z - c.z) < c.d / 2 + 0.2) ok = false;
      nav[j * NX + i] = ok ? 1 : 0;
    }
  }
}
function cell(x, z) {
  const i = clamp(Math.round(x + 22), 0, NX - 1), j = clamp(Math.round(z + 16), 0, NZ - 1);
  return j * NX + i;
}
function walkable(x, z) {
  return Math.abs(x) < 21.65 && Math.abs(z) < 15.6 && !!nav[cell(x, z)];
}
function nearestCell(x, z) {
  const c = cell(x, z);
  if (nav[c]) return c;
  let best = -1, bd = 1e9;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      if (!nav[j * NX + i]) continue;
      const d = (i - 22 - x) ** 2 + (j - 16 - z) ** 2;
      if (d < bd) {
        bd = d;
        best = j * NX + i;
      }
    }
  }
  return best;
}
function lineWalk(ax, az, bx, bz) {
  const d = Math.hypot(ax - bx, az - bz), n = Math.ceil(d * 3);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (!walkable(lerp(ax, bx, t), lerp(az, bz, t))) return false;
  }
  return true;
}
/** A* over the walk grid, then string-pulled to as few straight legs as possible. */
function findPath(x, z, tx, tz) {
  const s = nearestCell(x, z), end = nearestCell(tx, tz);
  if (s < 0 || end < 0) return [];
  let dst = { x: (end % NX) - 22, z: Math.floor(end / NX) - 16 };
  if (walkable(tx, tz)) dst = { x: tx, z: tz };
  if (lineWalk(x, z, dst.x, dst.z)) return [dst];
  pfScore.fill(Infinity);
  pfPrev.fill(-1);
  pfClosed.fill(0);
  pfScore[s] = 0;
  pfOpen.length = 0;
  pfOpen.push(s);
  const ex = end % NX, ez = Math.floor(end / NX);
  let iter = 0;
  while (pfOpen.length && iter++ < 1900) {
    let bi = 0, bf = Infinity;
    for (let k = 0; k < pfOpen.length; k++) {
      const c = pfOpen[k], f = pfScore[c] + Math.hypot((c % NX) - ex, Math.floor(c / NX) - ez);
      if (f < bf) {
        bf = f;
        bi = k;
      }
    }
    const c = pfOpen[bi];
    pfOpen[bi] = pfOpen[pfOpen.length - 1];
    pfOpen.pop();
    if (c === end) break;
    if (pfClosed[c]) continue;
    pfClosed[c] = 1;
    const cx = c % NX, cz = Math.floor(c / NX);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const xx = cx + dx, zz = cz + dz;
        if (xx < 0 || xx >= NX || zz < 0 || zz >= NZ) continue;
        const n = zz * NX + xx;
        if (!nav[n] || pfClosed[n]) continue;
        if (dx && dz && (!nav[cz * NX + xx] || !nav[zz * NX + cx])) continue;
        const ns = pfScore[c] + (dx && dz ? 1.414 : 1);
        if (ns < pfScore[n]) {
          pfScore[n] = ns;
          pfPrev[n] = c;
          pfOpen.push(n);
        }
      }
    }
  }
  if (pfPrev[end] < 0) return s === end ? [dst] : [];
  const path = [];
  let p = end;
  for (let i = 0; i < 2000 && p !== s; i++) {
    path.push({ x: (p % NX) - 22, z: Math.floor(p / NX) - 16 });
    p = pfPrev[p];
    if (p < 0) break;
  }
  path.reverse();
  path.push(dst);
  const smooth = [];
  let ax = x, az = z;
  for (let i = 0; i < path.length; ) {
    let far = i;
    while (far + 1 < path.length && lineWalk(ax, az, path[far + 1].x, path[far + 1].z)) far++;
    smooth.push(path[far]);
    ax = path[far].x;
    az = path[far].z;
    i = far + 1;
  }
  return smooth;
}

/* ------------------------------------------------------------------ combat rules */

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function squad() {
  return game.units.filter((u) => u.team === 0 && u.state !== 'gone');
}
function selectedUnits() {
  return game.units.filter((u) => selected.has(u.id) && u.team === 0 && u.state === 'alive' && !u.retreat);
}
function setPath(u, x, z, order = 'move') {
  u.path = findPath(u.x, u.z, x, z);
  u.order = order;
  u.dest = { x, z };
  if (order !== 'attack') u.attackId = null;
}
function commandMove(x, z, attack = null, silent = false) {
  if (game.phase !== 'playing') return;
  const list = selectedUnits();
  if (!list.length) {
    toast(`No ready soldiers selected. ${verb()} a blue card.`);
    audio.play('deny');
    return;
  }
  armed = null;
  if (view.width < view.height) camFocus = { x, z };
  const pt = game.points.find((p) => Math.hypot(p.x - x, p.z - z) < 2.9);
  const offsets = [[0, 0], [-1.45, -0.85], [1.45, 0.75], [-1.45, 0.9], [1.2, -0.8], [2.05, 0.9]];
  for (let i = 0; i < list.length; i++) {
    const u = list[i], o = list.length === 1 ? offsets[0] : offsets[i % offsets.length];
    setPath(u, clamp(x + o[0], -21, 21), clamp(z + o[1], -15, 15), attack !== null ? 'attack' : 'move');
    u.attackId = attack;
    u.pointId = pt ? pt.id : null;
  }
  game.rings.push({ x, z, t: 1.1, life: 1.1, col: attack !== null ? PAL.red : '#ffe094' });
  if (!silent) audio.play('order');
  if (coachStep < 1) setCoach(1);
  updateUI();
}
function selectUnit(id, add = false, focus = false) {
  if (!game || game.phase !== 'playing') return;
  const u = game.units.find((v) => v.id === id && v.team === 0);
  if (!u) return;
  if (!add) selected.clear();
  if (add && selected.has(id)) selected.delete(id);
  else selected.add(id);
  armed = null;
  if (focus || view.width < view.height) {
    const q = view.project(u.x, 1, u.z);
    if (focus || q[0] < 55 || q[0] > view.width - 55 || q[1] < 140 || q[1] > view.height - 235) camFocus = { x: u.x, z: u.z };
  }
  audio.play('select');
  updateUI();
}
function selectAll() {
  if (game.phase !== 'playing') return;
  selected.clear();
  for (const u of game.units) if (u.team === 0 && u.state !== 'gone') selected.add(u.id);
  armed = null;
  audio.play('select');
  updateUI();
}
/** Next or previous ready soldier, with the camera following (C, or LT/RT on a controller). */
function cycleUnit(dir) {
  const troops = game.units.filter((u) => u.team === 0 && u.state === 'alive');
  if (!troops.length) return;
  let i = troops.findIndex((u) => selected.has(u.id));
  if (i < 0) i = dir > 0 ? -1 : 0;
  selectUnit(troops[(i + dir + troops.length) % troops.length].id, false, true);
}
function segBox(a, b, c, pad = 0) {
  const minX = c.x - c.w / 2 - pad, maxX = c.x + c.w / 2 + pad, minZ = c.z - c.d / 2 - pad, maxZ = c.z + c.d / 2 + pad;
  const dx = b.x - a.x, dz = b.z - a.z;
  let t0 = 0, t1 = 1;
  const test = (p, q) => {
    if (Math.abs(p) < 1e-7) return q >= 0;
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    return t0 <= t1;
  };
  return test(-dx, a.x - minX) && test(dx, maxX - a.x) && test(-dz, a.z - minZ) && test(dz, maxZ - a.z);
}
function pointSegment(p, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l = dx * dx + dz * dz, t = l ? clamp(((p.x - a.x) * dx + (p.z - a.z) * dz) / l, 0, 1) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
}
/** Houses block direct fire; smoke blocks everything, lobbed shells included. */
function hasLOS(a, b, indirect = false) {
  if (!indirect) for (const o of lv.buildings) if (segBox(a, b, o, -0.15)) return false;
  for (const s of game.smokes) if (s.t > 0 && pointSegment(s, a, b) < s.r * 0.88) return false;
  return true;
}
const coverGap = (u, c) => Math.hypot(Math.max(0, Math.abs(u.x - c.x) - c.w / 2), Math.max(0, Math.abs(u.z - c.z) - c.d / 2));
function coverNear(u) {
  if (u.type === 'tank') return false;
  for (const c of game.covers) if (c.hp > 0 && coverGap(u, c) < 1.05) return true;
  return false;
}
function protection(u, attacker) {
  if (u.type === 'tank') return 1;
  for (const c of game.covers) if (c.hp > 0 && coverGap(u, c) < 1.25 && segBox(attacker, u, c, 0.12)) return 0.4;
  return 1;
}
function floater(x, z, text, col = '#fff0cb') {
  game.floaters.push({ x, z, y: 2.0, text, col, t: 1.2, life: 1.2 });
}
function damageUnit(u, damage, attacker, suppress = 0, blast = false) {
  if (u.state !== 'alive') return;
  let fac = blast ? 1 : protection(u, attacker);
  if (u.retreat) fac *= 0.55;
  if (u.type === 'tank' && !blast && attacker.type !== 'bazooka' && attacker.type !== 'tank') fac *= 0.16;
  if (u.type === 'tank' && attacker.type === 'bazooka') fac *= 2.4;
  if (u.team === 0) fac *= [0.53, 0.78, 1.04][difficulty];
  if (u.team === 1) fac *= [1.15, 1.02, 1][difficulty];
  const amount = damage * fac * (1 + (attacker.rank || 0) * 0.08);
  u.hp -= amount;
  u.suppression = clamp(u.suppression + suppress * (fac < 0.5 ? 0.5 : 1), 0, 1.5);
  u.lastHit = game.t;
  attacker.xp = (attacker.xp || 0) + amount / 23;
  if (attacker.state === 'alive' && attacker.rank < 2 && attacker.xp > 12 + attacker.rank * 15) {
    attacker.rank++;
    attacker.maxHp += 12;
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + 24);
    if (attacker.team === 0) {
      floater(attacker.x, attacker.z, 'VETERAN ★', '#ffe09a');
      audio.play('heal');
    }
  }
  if (u.hp <= 0) downUnit(u, attacker);
}
function downUnit(u) {
  if (u.state !== 'alive') return;
  u.hp = 0;
  u.path = [];
  u.moving = false;
  u.retreat = false;
  u.attackId = null;
  u.suppression = 0;
  game.tickets[u.team] = Math.max(0, game.tickets[u.team] - (u.type === 'tank' ? 18 : 7));
  if (u.team === 0) game.stats.losses++;
  else game.stats.kills++;
  if (u.type === 'tank') {
    u.state = 'gone';
    selected.delete(u.id);
    burst(u.x, u.z, 0.65, 18, u.team ? PAL.red : PAL.blue);
    if (u.team === 0) {
      toast('Tinny is out. You can call another tank when ready.', 'alert');
      makeCards();
      rumble(0.7, 260);
    } else toast('Enemy armor down. Nice work, Boom!', 'good');
  } else {
    u.state = 'down';
    u.downTimer = 14;
    u.reviveProgress = 0;
    if (u.team === 0) {
      floater(u.x, u.z, 'MEDIC!', '#ffe4a1');
      audio.play('down');
      rumble(0.35, 110);
    } else floater(u.x, u.z, 'POP!', '#ffe7c6');
    burst(u.x, u.z, 0.35, 4, u.team ? PAL.red : PAL.blue);
  }
}
function revive(u) {
  if (u.state !== 'down') return;
  u.state = 'alive';
  u.hp = u.maxHp * 0.45;
  u.downTimer = 0;
  u.suppression = 0;
  u.reviveProgress = 0;
  u.order = 'hold';
  u.think = 1;
  if (u.team === 0) {
    game.stats.revives++;
    audio.play('heal');
    floater(u.x, u.z, 'BACK UP!', '#d9ffc0');
  }
}
function burst(x, z, y, count = 12, col = '#d2b586') {
  const cap = kit.detail(170, 40);
  for (let i = 0; i < count && game.particles.length < cap; i++) {
    game.particles.push({ x, z, y: y + 0.4, vx: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 5, t: 0.5 + Math.random(), s: 0.07 + Math.random() * 0.14, col: i % 4 === 0 ? '#ffd384' : col, a: Math.random() * 6 });
  }
}
function explode(x, z, damage, r, attacker) {
  game.bursts.push({ x, z, t: 0.46, life: 0.46, r });
  burst(x, z, 0.4, 14);
  game.shake = Math.max(game.shake, 0.18);
  audio.play('boom');
  for (const u of game.units) {
    if (u.team === 0 && u.state === 'alive' && Math.hypot(u.x - x, u.z - z) < r + 2.5) {
      rumble(0.5, 170);
      break;
    }
  }
  for (const u of game.units) {
    if (u.team === attacker.team || u.state !== 'alive') continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d < r + 0.35) damageUnit(u, damage * (0.4 + 0.6 * (1 - clamp(d / r, 0, 1))), attacker, 0.32, true);
  }
  let changed = false;
  for (const c of game.covers) {
    if (c.hp > 0 && Math.hypot(c.x - x, c.z - z) < r + Math.max(c.w, c.d) * 0.42) {
      c.hp -= damage * 1.6;
      if (c.hp <= 0) {
        changed = true;
        burst(c.x, c.z, 0.5, 8, '#d7bf8e');
      }
    }
  }
  if (changed) {
    buildNav();
    view.syncCovers(game.covers);
  }
}
function shoot(u, target) {
  const t = TYPES[u.type];
  u.shot = t.rate * (u.suppression > 0.85 ? 1.5 : 1);
  u.flash = 0.09;
  u.angle = Math.atan2(target.x - u.x, target.z - u.z);
  const damage = t.damage * (u.moving ? 0.73 : 1) * (u.suppression > 0.85 ? 0.65 : 1);
  if (u.type === 'bazooka' || u.type === 'grenadier' || u.type === 'tank') {
    const isArc = u.type === 'grenadier';
    game.projectiles.push({ x0: u.x, z0: u.z, x: u.x, z: u.z, y: 1.0, tx: target.x, tz: target.z, t: 0, duration: isArc ? 0.8 : Math.max(0.22, dist(u, target) / 21), arc: isArc ? 4 : 0.8, type: isArc ? 'shell' : 'rocket', damage, r: u.type === 'tank' ? 2 : u.type === 'bazooka' ? 1.45 : 1.85, attacker: u });
    if (u.type === 'tank' || u.type === 'bazooka') audio.play('shot');
  } else {
    game.tracers.push({ x: u.x, z: u.z, y: 1.0, tx: target.x, tz: target.z, t: 0.085 });
    damageUnit(target, damage, u, t.suppress);
    audio.play('shot');
  }
}
function chooseTarget(u) {
  const range = TYPES[u.type].range, indirect = u.type === 'grenadier';
  if (u.attackId !== null) {
    for (const v of game.units) {
      if (v.id === u.attackId && v.state === 'alive' && v.team !== u.team) {
        if (dist(u, v) <= range && hasLOS(u, v, indirect)) return v;
        break;
      }
    }
  }
  let best = null, score = 1e6;
  for (const v of game.units) {
    if (v.team === u.team || v.state !== 'alive') continue;
    const d = dist(u, v);
    if (d > range || !hasLOS(u, v, indirect)) continue;
    const s = d + (v.retreat ? 3 : 0) + (v.type === 'tank' ? (u.type === 'bazooka' ? -5 : 3) : 0) + (v.hp / v.maxHp) * 0.5;
    if (s < score) {
      score = s;
      best = v;
    }
  }
  return best;
}
function respawn(u) {
  const h = home(u.team), a = u.id * 2.4;
  const c = nearestCell(h.x + Math.cos(a) * 1.8, h.z + Math.sin(a) * 1.8);
  if (c >= 0) {
    u.x = (c % NX) - 22;
    u.z = Math.floor(c / NX) - 16;
  } else {
    u.x = h.x;
    u.z = h.z;
  }
  u.hp = u.maxHp;
  u.state = 'alive';
  u.retreat = false;
  u.order = 'hold';
  u.path = [];
  u.attackId = null;
  u.suppression = 0;
  u.think = 0;
  u.aiWait = 0;
  if (u.team === 0) {
    floater(u.x, u.z, 'READY!', '#e8ffc5');
    toast(`${u.name} is back at base.`);
  }
}
function updateUnits(dt) {
  for (const u of game.units) {
    u.flash = Math.max(0, u.flash - dt);
    if (u.state === 'gone') continue;
    if (u.state === 'down') {
      u.downTimer -= dt;
      if (u.downTimer <= 0) {
        u.state = 'recover';
        u.recoverTimer = 11;
        u.reviveProgress = 0;
      }
      continue;
    }
    if (u.state === 'recover') {
      u.recoverTimer -= dt;
      if (u.recoverTimer <= 0) respawn(u);
      continue;
    }
    u.shot -= dt;
    u.suppression = Math.max(0, u.suppression - dt * (game.t - u.lastHit > 1 ? 0.28 : 0.1));
    u.cover = coverNear(u);
    u.moving = false;
    // Explicit attack orders chase the named target. Ground orders keep moving under fire.
    if (u.order === 'attack' && u.attackId !== null) {
      let v = null;
      for (const w of game.units) if (w.id === u.attackId && w.state === 'alive') v = w;
      if (!v) {
        u.attackId = null;
        u.order = 'hold';
        u.path = [];
      } else if (dist(u, v) > TYPES[u.type].range * 0.87 || !hasLOS(u, v, u.type === 'grenadier')) {
        u.think -= dt;
        if (u.think <= 0) {
          setPath(u, v.x, v.z, 'attack');
          u.think = 0.75;
        }
      } else u.path = [];
    }
    if (u.path.length) {
      const p = u.path[0], dx = p.x - u.x, dz = p.z - u.z, d = Math.hypot(dx, dz);
      const speed = TYPES[u.type].speed * (u.retreat ? 1.55 : 1) * (u.suppression > 0.9 && u.type !== 'tank' ? 0.42 : 1), step = Math.min(d, speed * dt);
      if (d < 0.13) u.path.shift();
      else {
        const nx = u.x + (dx / d) * step, nz = u.z + (dz / d) * step;
        if (walkable(nx, nz)) {
          u.x = nx;
          u.z = nz;
        } else if (walkable(nx, u.z)) u.x = nx;
        else if (walkable(u.x, nz)) u.z = nz;
        else {
          const c = nearestCell(u.x, u.z);
          u.x = lerp(u.x, (c % NX) - 22, Math.min(1, dt * 6));
          u.z = lerp(u.z, Math.floor(c / NX) - 16, Math.min(1, dt * 6));
        }
        u.angle = Math.atan2(dx, dz);
        u.moving = true;
      }
    }
    // Soft separation keeps the five toys readable at choke points.
    for (const v of game.units) {
      if (v.id === u.id || v.state !== 'alive') continue;
      const d = dist(u, v), sep = u.type === 'tank' || v.type === 'tank' ? 1.2 : 0.91;
      if (d < sep && d > 0.01) {
        const push = (sep - d) * dt * 2, xx = u.x + ((u.x - v.x) / d) * push, zz = u.z + ((u.z - v.z) / d) * push;
        if (walkable(xx, zz)) {
          u.x = xx;
          u.z = zz;
        }
      }
    }
    const h = home(u.team), atHome = dist(u, h) < 3.35;
    if (atHome) {
      u.hp = Math.min(u.maxHp, u.hp + dt * (u.type === 'tank' ? 18 : 14));
      u.suppression = 0;
      if (u.retreat && u.path.length === 0 && u.hp > u.maxHp * 0.93) {
        u.retreat = false;
        u.order = 'hold';
        u.think = 0.1;
        if (u.team === 0) floater(u.x, u.z, 'READY!', '#c9f5c1');
      }
    } else if (u.retreat && u.path.length === 0) {
      // A retreat that lost its way (blocked path) tries again, then gives up, so a soldier
      // is never stuck in "healing" out in the field where it can neither fight nor be ordered.
      u.think -= dt;
      if (u.think <= 0) {
        setPath(u, h.x, h.z, 'retreat');
        u.think = 1.2;
        if (!u.path.length) u.retreat = false;
      }
    }
    if (u.retreat) continue;
    if (u.type === 'medic') {
      let casualty = null, cd = 3.3;
      for (const v of game.units) {
        if (v.team !== u.team || v.state !== 'down') continue;
        const d = dist(u, v);
        if (d < cd) {
          cd = d;
          casualty = v;
        }
      }
      if (casualty) {
        casualty.reviveProgress += dt;
        if (casualty.reviveProgress > 2.8) revive(casualty);
      } else {
        let friend = null, fr = 2;
        for (const v of game.units) {
          if (v.team !== u.team || v.state !== 'alive' || v.type === 'tank' || v.hp >= v.maxHp || dist(u, v) >= 3.9) continue;
          const r = v.hp / v.maxHp;
          if (r < fr) {
            fr = r;
            friend = v;
          }
        }
        if (friend) {
          friend.hp = Math.min(friend.maxHp, friend.hp + dt * 6.5);
          u.healSpark -= dt;
          if (u.healSpark <= 0) {
            u.healSpark = 1.2;
            floater(friend.x, friend.z, '+', '#c4fab4');
          }
        }
      }
    }
    const target = chooseTarget(u);
    if (target) {
      u.angle = Math.atan2(target.x - u.x, target.z - u.z);
      if (u.shot <= 0) shoot(u, target);
    }
  }
}
function enemyAI(dt) {
  game.aiTime -= dt;
  if (game.aiTime > 0) return;
  game.aiTime = 0.6;
  const units = game.units.filter((u) => u.team === 1 && u.state === 'alive');
  for (const u of units) {
    u.aiWait = (u.aiWait || 0) - 0.6;
    if (u.retreat) continue;
    if (u.hp < u.maxHp * 0.24 && u.type !== 'tank' && dist(u, home(1)) > 4) {
      u.retreat = true;
      u.suppression = 0;
      setPath(u, 19, -1, 'retreat');
      continue;
    }
    if (u.aiWait > 0) continue;
    u.aiWait = 3.2 + Math.random() * 2;
    let index;
    if (u.type === 'tank') index = lv.tankPoint;
    else if (game.t < 20) index = lv.aiOpening[u.type] ?? 1;
    else {
      let best = -1e9;
      index = 1;
      for (const p of game.points) {
        let friends = 0, enemies = 0;
        for (const v of units) if (v.id !== u.id && v.pointId === p.id) friends++;
        for (const v of game.units) if (v.team === 0 && v.state === 'alive' && dist(v, p) < 5) enemies++;
        let score = (p.owner === 1 ? 0 : 5.8) + (p.owner === 0 ? 1.6 : 0) - dist(u, p) * 0.15 - friends * 1.65 + Math.min(enemies, 2) * 0.25;
        if (u.type === 'gunner' && p.id === 1) score += 1.0;
        if (u.type === 'medic') score += friends * 0.65;
        if (score > best) {
          best = score;
          index = p.id;
        }
      }
    }
    const p = game.points[index];
    u.pointId = index;
    const target = chooseTarget(u);
    if (target && dist(u, p) < 4.2) {
      u.path = [];
      u.order = 'hold';
      continue;
    }
    if (dist(u, p) < 2.2 && p.owner !== 0) {
      u.path = [];
      continue;
    }
    const ox = u.type === 'tank' ? 1.6 : ((u.id % 3) - 1) * 0.75, oz = (u.id % 2 ? 1 : -1) * 0.65;
    setPath(u, p.x + ox, p.z + oz, 'advance');
  }
  if (game.t > 34 && game.t > game.enemyGrenade) {
    game.enemyGrenade = game.t + [26, 21, 16][difficulty];
    const caster = units.find((u) => u.type === 'grenadier' && !u.retreat);
    if (caster) {
      const v = game.units.find((u) => u.team === 0 && u.state === 'alive' && dist(u, caster) < 9);
      if (v) {
        game.projectiles.push({ x0: caster.x, z0: caster.z, x: caster.x, z: caster.z, y: 1, tx: v.x, tz: v.z, t: 0, duration: 1.5, arc: 5, type: 'grenade', damage: 48, r: 2.8, attacker: caster });
        game.rings.push({ x: v.x, z: v.z, t: 1.5, life: 1.5, col: PAL.red, r: 2.8 });
      }
    }
  }
}
function updatePoints(dt) {
  const counts = game.counts;
  counts[0] = counts[1] = 0;
  for (const p of game.points) {
    let b = 0, r = 0;
    for (const u of game.units) {
      if (u.state === 'alive' && !u.retreat && u.type !== 'tank' && dist(u, p) < 2.9) {
        if (u.team === 0) b++;
        else r++;
      }
    }
    const previous = p.owner;
    p.contested = b > 0 && r > 0;
    p.active = b || r;
    if (b && !r) p.cap = Math.min(1, p.cap + dt * 0.15 * Math.min(2.1, 1 + (b - 1) * 0.35));
    if (r && !b) p.cap = Math.max(-1, p.cap - dt * 0.15 * Math.min(2.1, 1 + (r - 1) * 0.35));
    if (previous === 0 && p.cap <= 0) p.owner = -1;
    if (previous === 1 && p.cap >= 0) p.owner = -1;
    if (p.cap >= 0.999) p.owner = 0;
    if (p.cap <= -0.999) p.owner = 1;
    if (p.owner !== previous && p.owner >= 0) {
      if (p.owner === 0) {
        game.stats.captures++;
        toast(`${p.letter} · ${p.name} secured.`, 'good');
        audio.play('capture');
        rumble(0.25, 90);
        if (coachStep < 2) setCoach(2);
      } else {
        toast(`${p.letter} · The Rascals took ${p.name.toLowerCase()}.`, 'alert');
        audio.play('alert');
      }
    }
    if (p.owner >= 0) counts[p.owner]++;
  }
  const advantage = counts[0] - counts[1];
  if (advantage > 0) game.tickets[1] = Math.max(0, game.tickets[1] - dt * advantage * 0.9);
  if (advantage < 0) game.tickets[0] = Math.max(0, game.tickets[0] + dt * advantage * 0.9);
  game.supply = Math.min(200, game.supply + dt * (1.7 + counts[0] * 0.4));
}
/** Drop finished effects in place (no new arrays every step). */
function prune(list) {
  let n = 0;
  for (let i = 0; i < list.length; i++) if (list[i].t > 0) list[n++] = list[i];
  list.length = n;
}
function updateEffects(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.t += dt;
    const k = clamp(p.t / p.duration, 0, 1);
    p.x = lerp(p.x0, p.tx, k);
    p.z = lerp(p.z0, p.tz, k);
    p.y = lerp(1.2, 0.15, k) + Math.sin(k * Math.PI) * p.arc;
    if (k >= 1) {
      if (p.type === 'smoke') {
        game.smokes.push({ x: p.tx, z: p.tz, r: 3.7, t: 10, life: 10, phase: Math.random() * 6 });
        burst(p.tx, p.tz, 0.3, 5, '#e5e4cf');
      } else explode(p.tx, p.tz, p.damage, p.r, p.attacker);
      game.projectiles.splice(i, 1);
    }
  }
  for (const s of game.smokes) s.t -= dt;
  prune(game.smokes);
  for (const a of game.aids) {
    a.t -= dt;
    if (a.t < a.life - 1) {
      for (const u of game.units) {
        if (u.team !== 0 || dist(u, a) >= 3.8) continue;
        if (u.state === 'down') revive(u);
        if (u.state === 'alive' && u.type !== 'tank') u.hp = Math.min(u.maxHp, u.hp + dt * 15);
      }
      a.spark -= dt;
      if (a.spark < 0) {
        a.spark = 0.8;
        floater(a.x, a.z, '+', '#cdf7b6');
      }
    }
  }
  prune(game.aids);
  for (const p of game.particles) {
    p.t -= dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.y += p.vy * dt;
    p.vy -= 12 * dt;
    p.a += dt * 3;
    if (p.y < 0.13) {
      p.y = 0.13;
      p.vy = Math.abs(p.vy) * 0.3;
      p.vx *= 0.86;
      p.vz *= 0.86;
    }
  }
  prune(game.particles);
  for (const list of [game.tracers, game.bursts, game.rings, game.floaters]) {
    for (const e of list) e.t -= dt;
    prune(list);
  }
  game.shake = Math.max(0, game.shake - dt * 0.8);
}
function updateGame(dt) {
  if (game.phase !== 'playing') return;
  game.t += dt;
  for (const k in game.cooldowns) game.cooldowns[k] = Math.max(0, game.cooldowns[k] - dt);
  enemyAI(dt);
  updateUnits(dt);
  updatePoints(dt);
  updateEffects(dt);
  // Armor waves: a warning, then a red tank rolls in from the Rascals' base.
  const waves = lv.tanks;
  if (game.tanksWarned < waves.length && game.t > waves[game.tanksWarned].warn) {
    toast(waves[game.tanksWarned].warnText, 'alert');
    audio.play('alert');
    game.tanksWarned++;
  }
  if (game.tanksSent < waves.length && game.t > waves[game.tanksSent].at) {
    const w = waves[game.tanksSent], s = lv.enemyTank, u = makeUnit('tank', 1, s.x, s.z);
    if (game.tanksSent) u.name = 'GRUMBLE II';
    game.units.push(u);
    toast(w.text, 'alert');
    setPath(u, s.tx, s.tz, 'advance');
    game.tanksSent++;
    rumble(0.3, 200);
  }
  if (game.t > 40 && coachStep < 3) setCoach(3);
  if (game.t > 70 && !coachHidden) {
    coachHidden = true;
    $('coach').classList.add('hidden');
  }
  if (game.tickets[0] <= 0 || game.tickets[1] <= 0) finish(game.tickets[1] <= 0, 'score');
  else if (game.t >= MATCH_TIME) {
    const diff = game.tickets[0] - game.tickets[1];
    if (Math.abs(diff) > 0.2) finish(diff > 0, 'time');
    else if (!game.sudden) {
      game.sudden = true;
      toast('SUDDEN DEATH · Take the lead to win!', 'alert');
      audio.play('alert');
    }
  }
}

/* ------------------------------------------------------------------ field orders */

function armAbility(name) {
  if (game.phase !== 'playing') return;
  audio.start();
  if (name === 'retreat') {
    retreat();
    return;
  }
  const a = ABILITIES[name];
  if (name === 'tank') {
    callTank();
    return;
  }
  if (armed === name) {
    armed = null;
    updateUI();
    return;
  }
  if (game.cooldowns[name] > 0.1) {
    toast(`${a.name} is ready in ${Math.ceil(game.cooldowns[name])} seconds.`);
    audio.play('deny');
    return;
  }
  if (game.supply < a.cost) {
    toast(`Need ${a.cost} supplies for ${a.name.toLowerCase()}.`);
    audio.play('deny');
    return;
  }
  if (name !== 'aid' && !selectedUnits().some((u) => u.type !== 'tank')) {
    toast('Select a ready soldier first.');
    audio.play('deny');
    return;
  }
  armed = name;
  audio.play('select');
  updateUI();
}
function castAbility(x, z) {
  const name = armed, a = ABILITIES[name];
  if (!a) return;
  const list = selectedUnits().filter((u) => u.type !== 'tank');
  const caster = list.sort((u, v) => Math.hypot(u.x - x, u.z - z) - Math.hypot(v.x - x, v.z - z))[0];
  if (name !== 'aid' && (!caster || Math.hypot(caster.x - x, caster.z - z) > a.range)) {
    toast('Out of range. Move closer, or choose another target.');
    audio.play('deny');
    return;
  }
  if (game.supply < a.cost || game.cooldowns[name] > 0.1) {
    armed = null;
    updateUI();
    return;
  }
  game.supply -= a.cost;
  game.cooldowns[name] = a.cd;
  armed = null;
  if (name === 'aid') {
    game.aids.push({ x, z, t: 8, life: 8, spark: 0 });
    audio.play('heal');
    toast('Aid drop sent. Stay in the green ring.', 'good');
  } else {
    game.projectiles.push({ x0: caster.x, z0: caster.z, x: caster.x, z: caster.z, y: 1.2, tx: x, tz: z, t: 0, duration: name === 'grenade' ? 1.15 : 0.85, arc: 5, type: name, damage: 62, r: a.radius, attacker: caster });
    game.rings.push({ x, z, t: 1.15, life: 1.15, col: name === 'smoke' ? '#eef2d8' : '#ffcf70', r: a.radius });
    audio.play('order');
  }
  updateUI();
}
function retreat() {
  if (game.phase !== 'playing') return;
  const list = selectedUnits();
  if (!list.length) {
    toast('Select a ready soldier to retreat.');
    audio.play('deny');
    return;
  }
  const h = home(0);
  for (const u of list) {
    u.retreat = true;
    u.suppression = 0;
    u.think = 1.2;
    const a = u.id * 2.3;
    setPath(u, h.x + Math.cos(a) * 1.25, h.z + Math.sin(a) * 1.25, 'retreat');
  }
  armed = null;
  audio.play('order');
  toast('Fall back! The base heals and repairs for free.');
  updateUI();
}
function callTank() {
  const a = ABILITIES.tank;
  const mine = game.units.find((u) => u.team === 0 && u.type === 'tank' && u.state === 'alive');
  if (mine) {
    selectUnit(mine.id);
    toast(`Tinny selected. ${verb()} the map to move.`);
    return;
  }
  if (game.cooldowns.tank > 0.1) {
    toast(`Tank support is ready in ${Math.ceil(game.cooldowns.tank)} seconds.`);
    audio.play('deny');
    return;
  }
  if (game.supply < a.cost) {
    toast(`Need ${a.cost} supplies to call a tank.`);
    audio.play('deny');
    return;
  }
  game.supply -= a.cost;
  game.cooldowns.tank = a.cd;
  const u = makeUnit('tank', 0, lv.playerTank.x, lv.playerTank.z);
  game.units.push(u);
  selected.clear();
  selected.add(u.id);
  armed = null;
  makeCards();
  audio.play('capture');
  rumble(0.3, 160);
  toast(`TINNY REPORTING · ${verb()} the map to send your tank.`, 'good');
  updateUI();
}

/* ------------------------------------------------------------------ screens */

function showScreens() {
  const phase = game.phase, brief = phase === 'brief' || (phase === 'paused' && previousPhase === 'brief');
  $('brief').classList.toggle('hidden', !brief);
  $('hud').classList.toggle('hidden', brief);
  $('pause').classList.toggle('hidden', phase !== 'paused');
  $('result').classList.toggle('hidden', phase !== 'ended');
}
function startGame() {
  audio.start();
  resetGame();
  game.phase = 'playing';
  previousPhase = 'playing';
  showScreens();
  $('toasts').innerHTML = '';
  const portrait = view.width < view.height;
  cam.x = portrait ? -12 : 0;
  cam.z = portrait ? 0 : 1;
  cam.zoom = view.height < 580 ? 1.06 : 1.02;
  cam.half = portrait ? 25 : 22;
  view.updateCamera();
  audio.play('order');
  save('difficulty', difficulty);
  save('op', levelIndex);
  updateUI();
  kit.input.settle();
}
function applyBriefCamera() {
  const portrait = view.width < view.height, c = portrait ? lv.briefCamPortrait : lv.briefCam;
  cam.half = portrait ? 30 : 22;
  cam.zoom = portrait ? 0.95 : 0.9;
  cam.x = c.x;
  cam.z = c.z;
  view.updateCamera();
}
function briefing() {
  resetGame();
  game.phase = 'brief';
  previousPhase = 'brief';
  showScreens();
  $('toasts').innerHTML = '';
  applyBriefCamera();
  renderBrief();
  kit.input.settle();
}
function selectOp(i) {
  if (game.phase !== 'brief' || i === levelIndex || !LEVELS[i]) return;
  levelIndex = i;
  lv = LEVELS[i];
  save('op', i);
  audio.start();
  audio.play('select');
  briefing();
}
function setDifficulty(d) {
  difficulty = clamp(d, 0, 2);
  save('difficulty', difficulty);
  audio.start();
  audio.play('select');
  renderBrief();
}
/** The briefing text, the operation picker (with best stars) and the HUD names for this map. */
function renderBrief() {
  $('heroText').innerHTML = lv.tagline;
  $('missionEyebrow').textContent = lv.op;
  $('missionName').textContent = lv.name;
  $('missionText').innerHTML = lv.intro;
  $('missionSteps').innerHTML = lv.steps.map(([ic, label]) => `<span>${icon(ic)}${label}</span>`).join('');
  $('hintTitle').textContent = lv.hint[0];
  $('hintText').textContent = lv.hint[1];
  $('plateTop').textContent = lv.plate[0];
  $('plateName').textContent = lv.plate[1];
  $('plateBottom').textContent = lv.plate[2];
  $('brandOp').textContent = 'OPERATION ' + lv.num;
  $('brandName').textContent = lv.name.toUpperCase();
  for (const b of document.querySelectorAll('[data-op]')) {
    const i = +b.dataset.op, level = LEVELS[i];
    b.classList.toggle('active', i === levelIndex);
    const stars = level ? starsFor(bestScore(level, difficulty)) : 0;
    const el = b.querySelector('.opStars');
    if (el) el.textContent = stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    b.title = stars ? `Best on ${DIFF_NAMES[difficulty]}: ${bestScore(level, difficulty)} score left` : `Not won on ${DIFF_NAMES[difficulty]} yet`;
  }
  for (const b of document.querySelectorAll('[data-diff]')) b.classList.toggle('active', +b.dataset.diff === difficulty);
  for (const el of document.querySelectorAll('[data-flag]')) {
    const p = lv.points[+el.dataset.flag];
    if (!p) continue;
    el.title = `${p.letter} · ${p.name} — move there`;
    el.setAttribute('aria-label', `Move to flag ${p.letter}, ${p.name.toLowerCase()}`);
  }
  miniStaticLevel = null;
}
function pauseGame(help = false) {
  if (game.phase === 'ended') return;
  if (game.phase === 'paused') {
    resumeGame();
    return;
  }
  previousPhase = game.phase;
  game.phase = 'paused';
  armed = null;
  drag = null;
  showScreens();
  $('helpDetails').open = help;
  $('resume').innerHTML = (previousPhase === 'brief' ? 'BACK TO BRIEFING ' : 'BACK TO THE BATTLE ') + icon('play');
  $('restart').textContent = previousPhase === 'brief' ? 'Deploy now' : 'Restart mission';
  $('pauseTitle').textContent = help ? 'Your field manual.' : 'Little war. Big pause.';
  audio.play('select');
  updateSettings();
}
function resumeGame() {
  if (game.phase !== 'paused') return;
  game.phase = previousPhase;
  drag = null;
  showScreens();
  audio.start();
  kit.input.settle();
}
function finish(won, reason) {
  if (game.phase !== 'playing') return;
  game.phase = 'ended';
  game.endReason = reason;
  armed = null;
  drag = null;
  showScreens();
  const [winTitle, winText] = lv.win, [loseTitle, loseText, loseEyebrow] = lv.lose;
  $('resultTitle').textContent = won ? winTitle : loseTitle;
  $('resultEyebrow').textContent = won ? 'OPERATION COMPLETE' : loseEyebrow;
  $('resultText').textContent = won ? winText : loseText;
  const left = Math.ceil(game.tickets[0]), stars = won ? (game.tickets[0] > 160 ? 3 : game.tickets[0] > 70 ? 2 : 1) : 0;
  $('resultStars').textContent = stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '☆ ☆ ☆';
  $('finalScore').textContent = left;
  $('finalCaptures').textContent = game.stats.captures;
  $('finalTime').textContent = formatTime(game.t);
  $('finalKills').textContent = game.stats.kills;
  $('finalRevives').textContent = game.stats.revives;
  $('finalLosses').textContent = game.stats.losses;
  const best = bestScore(lv, difficulty), reasonText = reason === 'time' ? 'Time limit reached.' : 'Battle complete.';
  if (won && game.tickets[0] > best) {
    save(bestKey(lv, difficulty), left);
    $('recordText').textContent = `NEW BEST · ${left} score left on ${DIFF_NAMES[difficulty]}.`;
  } else {
    $('recordText').textContent = `${reasonText}${best ? ` Best on ${DIFF_NAMES[difficulty]}: ${best} score left.` : ''}`;
  }
  const next = LEVELS[levelIndex + 1];
  $('nextOp').classList.toggle('hidden', !(won && next));
  if (next) $('nextOp').textContent = `Next: ${next.name}`;
  audio.play(won ? 'win' : 'lose');
  rumble(won ? 0.4 : 0.6, won ? 220 : 380);
  updateUI();
}
function nextOperation() {
  const next = levelIndex + 1;
  if (!LEVELS[next]) return;
  levelIndex = next;
  lv = LEVELS[next];
  save('op', next);
  briefing();
}
function formatTime(t) {
  t = Math.max(0, Math.floor(t));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
function setCoach(n) {
  coachStep = n;
  const src = source();
  const pick = (touch, keys, pad) => (src === 'gamepad' ? pad : src === 'touch' ? touch : keys);
  const data = [
    ['01 / YOUR FIVE LITTLE HEROES', pick('Tap a card to select a soldier. ALL selects the whole squad.', 'Click a card or press 1–6 to select a soldier. Q or ALL selects the whole squad.', 'LT/RT picks a soldier, X selects the whole squad. The left stick moves your cursor.')],
    ['02 / GET THOSE FLAGS', pick('Tap a flag to move and capture it.', 'Click a flag or the ground to move and capture it.', 'Point at a flag and press A to move and capture it.') + ' Soldiers fire on their own. Split the squad to hold two flags.'],
    ['03 / A LITTLE COVER GOES A LONG WAY', 'Stay behind sandbags. A green arc shows cover. Grenades break cover. ' + lv.flankTip],
    ['04 / KEEP THE SQUAD STANDING', 'Use RETREAT to heal at base. Patch revives nearby soldiers. AID DROP can save a downed soldier.'],
  ][n];
  $('coachTitle').textContent = data[0];
  $('coachText').textContent = data[1];
  [...$('coach').querySelectorAll('.progress i')].forEach((v, i) => v.classList.toggle('on', i === n));
}
function portrait(type) {
  if (type === 'tank') return `<svg class="portrait" viewBox="0 0 50 40" style="fill:none;stroke:#316861;stroke-width:3"><path d="M7 26h36v10H7zM13 24V14h24v10M27 14V8h21"/><path d="M13 31h25" stroke="#eac886"/></svg>`;
  const typeColor = { rifle: '#56877d', gunner: '#376765', bazooka: '#688476', grenadier: '#708d64', medic: '#7ca196' }[type];
  const badge = type === 'medic' ? '<path fill="#f9edcc" d="M22 4h4v10h-4zm-3 3h10v4H19z"/>' : type === 'gunner' ? '<path fill="#f2d080" d="M15 12h18v3H15z"/>' : '<path fill="#dbd4a4" d="m24 6 2 3 3 1-3 2-2 3-1-3-3-2 3-1z"/>';
  return `<svg class="portrait" viewBox="0 0 48 38" style="stroke:none"><path fill="#496d63" d="M8 38v-8l11-6h10l11 6v8z"/><path fill="#f0c880" d="M15 14h18v15l-5 4h-8l-5-4z"/><path fill="${typeColor}" d="M10 19V13a14 12 0 0 1 28 0v6z"/><path fill="#b3bfa0" d="M10 17h28v4H10z"/><path fill="#364d42" d="M19 24h2v3h-2zm8 0h2v3h-2z"/>${badge}</svg>`;
}

/* ------------------------------------------------------------------ HUD */

const ui = {
  blueScore: $('blueScore'), redScore: $('redScore'), blueTrack: $('blueTrack'), redTrack: $('redTrack'), supply: $('supply'),
  incomeRate: $('incomeRate'), matchTime: $('matchTime'), allBtn: $('allBtn'), commandText: $('commandText'),
  objectiveText: $('objectiveText'), objectiveDetail: $('objectiveDetail'),
  flags: [...document.querySelectorAll('[data-flag]')], abilities: [...document.querySelectorAll('[data-ability]')],
};
for (const b of ui.abilities) b.__small = b.querySelector('small');
let cards = [];

// DOM writes only when a value changes.
function setText(el, v) {
  v = String(v);
  if (el.__t !== v) {
    el.__t = v;
    el.textContent = v;
  }
}
function setStyle(el, prop, v) {
  const k = '__s' + prop;
  if (el[k] !== v) {
    el[k] = v;
    el.style[prop] = v;
  }
}
function setClass(el, v) {
  if (el.__c !== v) {
    el.__c = v;
    el.className = v;
  }
}

function makeCards() {
  const troops = squad(), box = $('unitcards');
  box.innerHTML = troops.map((u, i) => `<button class="unitcard" data-unit="${u.id}" aria-label="Select ${u.name}, ${TYPES[u.type].role}"><span class="number">${i + 1}</span><span class="statusdot"></span>${portrait(u.type)}<span class="name">${u.name}</span><span class="role">${TYPES[u.type].role}</span><div class="healthtrack"><i style="width:100%"></i></div></button>`).join('');
  troops.forEach((u, i) => (u.slot = i + 1));
  cards = [];
  for (const el of box.children) {
    const id = +el.dataset.unit;
    el.addEventListener('click', (e) => selectUnit(id, e.shiftKey));
    el.addEventListener('dblclick', () => selectUnit(id, false, true));
    cards.push({ el, unit: game.units.find((v) => v.id === id), bar: el.querySelector('.healthtrack i'), role: el.querySelector('.role'), dot: el.querySelector('.statusdot') });
  }
}
function updateSettings() {
  for (const b of document.querySelectorAll('.soundBtn')) b.innerHTML = icon(settings.sound ? 'sound' : 'mute');
  $('soundSetting').textContent = settings.sound ? 'ON' : 'OFF';
  $('effectsBtn').textContent = settings.effects ? 'ON' : 'OFF';
  $('fullscreenBtn').textContent = document.fullscreenElement ? 'EXIT' : 'EXPAND';
}
function updateUI() {
  if (!game) return;
  setText(ui.blueScore, Math.ceil(game.tickets[0]));
  setText(ui.redScore, Math.ceil(game.tickets[1]));
  setStyle(ui.blueTrack, 'width', (game.tickets[0] / (TICKETS / 100)).toFixed(1) + '%');
  setStyle(ui.redTrack, 'width', (game.tickets[1] / (TICKETS / 100)).toFixed(1) + '%');
  setText(ui.supply, Math.floor(game.supply));
  const counts = game.counts;
  setText(ui.incomeRate, `+${(1.7 + counts[0] * 0.4).toFixed(1)}/s`);
  setText(ui.matchTime, game.sudden ? 'EXTRA' : formatTime(MATCH_TIME - game.t));
  for (const el of ui.flags) {
    const p = game.points[+el.dataset.flag];
    if (p) setClass(el, 'flagchip ' + (p.owner === 0 ? 'blue' : p.owner === 1 ? 'red' : ''));
  }
  for (const c of cards) {
    const u = c.unit;
    if (!u) continue;
    c.el.classList.toggle('selected', selected.has(u.id));
    c.el.classList.toggle('down', u.state !== 'alive');
    const ratio = clamp(u.hp / u.maxHp, 0, 1);
    setStyle(c.bar, 'width', (ratio * 100).toFixed(1) + '%');
    setStyle(c.bar, 'background', ratio < 0.3 ? '#d57053' : '#438974');
    setText(c.role, u.state === 'down' ? `HELP! ${Math.ceil(u.downTimer)}s` : u.state === 'recover' ? `BACK IN ${Math.ceil(u.recoverTimer)}s` : u.retreat ? 'HEALING' : u.suppression > 0.9 ? 'PINNED!' : TYPES[u.type].role);
    setText(c.dot, u.state === 'down' ? '+' : u.cover ? '◆' : u.rank ? '★'.repeat(u.rank) : '');
    setStyle(c.dot, 'color', u.state === 'down' ? '#da6549' : u.cover ? '#438d65' : '#bb943b');
  }
  let all = true;
  for (const u of game.units) if (u.team === 0 && u.state !== 'gone' && !selected.has(u.id)) all = false;
  ui.allBtn.classList.toggle('active', all);
  const tankAlive = game.units.some((u) => u.team === 0 && u.type === 'tank' && u.state === 'alive');
  for (const el of ui.abilities) {
    const name = el.dataset.ability, a = ABILITIES[name];
    el.classList.toggle('armed', armed === name);
    if (!a) continue;
    const live = name === 'tank' && tankAlive, cd = game.cooldowns[name];
    el.classList.toggle('unavailable', !live && (cd > 0.1 || game.supply < a.cost));
    setText(el.__small, live ? 'SELECT' : cd > 0.1 ? Math.ceil(cd) + 's' : a.cost);
  }
  const ready = selectedUnits(), v = verb();
  let line;
  if (armed) {
    const a = ABILITIES[armed], cancel = source() === 'gamepad' ? 'B cancels.' : source() === 'touch' ? 'Tap the order again to cancel.' : 'Esc or the order again cancels.';
    line = `${a.name} · ${v} a target${armed === 'aid' ? '' : ` within ${a.range} m`}. ${cancel}`;
  } else if (ready.length === 1) {
    const u = ready[0];
    line = `${u.name} · ${u.suppression > 0.9 ? 'PINNED! Use smoke or retreat.' : u.cover ? `IN COVER · ${v} a target to focus fire.` : `${v} the ground to move · Fires on its own.`}`;
  } else if (ready.length > 1) line = `${ready.length} TOYS SELECTED · ${v} a flag or the ground to move.`;
  else line = 'Select a blue card. Downed soldiers can be revived or will return to base.';
  setText(ui.commandText, line);
  setText(ui.objectiveText, counts[0] > counts[1] ? 'Your flags are draining the red score.' : counts[0] < counts[1] ? 'Your score is falling. Take another flag!' : 'Hold more flags than the Red Rascals.');
  setText(ui.objectiveDetail, `${counts[0]} blue / ${counts[1]} red · Tanks fight, but cannot capture flags.`);
}
/** Button prompts follow the last device used: keys, controller buttons, or none on touch. */
function applySource(src) {
  const root = document.documentElement;
  root.classList.toggle('src-touch', src === 'touch');
  root.classList.toggle('src-pad', src === 'gamepad');
  for (const el of document.querySelectorAll('[data-key]')) el.textContent = src === 'gamepad' ? el.dataset.pad : el.dataset.key;
  $('orderHint').textContent = src === 'gamepad' ? 'D-PAD → ABILITIES · A: ORDER' : src === 'touch' ? 'SELECT → TAP TO ORDER' : 'SELECT → CLICK TO ORDER';
  if (game) {
    setCoach(coachStep);
    updateUI();
  }
}

/* ------------------------------------------------------------------ overlay labels and the minimap */

function roundRect(c, x, y, w, h, r, fill, stroke) {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.stroke();
  }
}
function outlined(text, x, y, fill, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
function drawOverlay() {
  const W = view.width, H = view.height;
  ctx.clearRect(0, 0, W, H);
  if (game.phase === 'brief' || (game.phase === 'paused' && previousPhase === 'brief')) return;
  const small = H < 550, rad = small ? 10 : 12;
  ctx.textAlign = 'center';
  for (const p of game.points) {
    const q = view.project(p.x, 3.95, p.z), x = q[0], y = q[1];
    const col = p.owner === 0 ? '#258ca9' : p.owner === 1 ? '#d76555' : '#f8edc9';
    ctx.save();
    ctx.shadowColor = '#19352b33';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 2;
    ctx.lineWidth = 3;
    roundRect(ctx, x - rad, y - rad, rad * 2, rad * 2, 6, col, '#fff4');
    ctx.restore();
    ctx.font = `900 ${small ? 10 : 12}px Trebuchet MS,Arial`;
    ctx.fillStyle = p.owner >= 0 ? '#fff5d6' : '#4b6552';
    ctx.fillText(p.letter, x, y + 4);
    if (!small) {
      ctx.font = '800 8px Trebuchet MS,Arial';
      outlined(p.name, x, y + 25, '#355441', '#eff2dc');
    }
    if (p.contested) {
      ctx.font = '900 8px Arial';
      outlined('CONTESTED', x, y - 19, '#fff0bf', '#694935');
    }
    if (p.active && Math.abs(p.cap) < 0.995) {
      ctx.beginPath();
      ctx.strokeStyle = p.cap > 0 ? '#249bba' : '#e37f63';
      ctx.lineWidth = 2.5;
      ctx.arc(x, y, rad + 4, -Math.PI / 2, -Math.PI / 2 + Math.abs(p.cap) * Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const u of game.units) {
    if (u.state === 'recover' || u.state === 'gone') continue;
    const q = view.project(u.x, u.type === 'tank' ? 2.05 : 2.48, u.z), x = q[0], y = q[1];
    if (x < -30 || x > W + 30 || y < -30 || y > H + 30) continue;
    if (u.state === 'down') {
      ctx.font = 'bold 14px Arial';
      outlined('+', x, y + 8, u.team === 0 ? '#fff3ce' : '#d77b5c', '#365047');
      if (u.team === 0) {
        ctx.font = 'bold 8px Arial';
        outlined(Math.ceil(u.downTimer) + 's', x, y + 19, '#fff3d0', '#365047');
      }
      continue;
    }
    const w = u.type === 'tank' ? 36 : small ? 21 : 27, h = 3;
    roundRect(ctx, x - w / 2 - 1, y - 1, w + 2, h + 2, 2, '#1c443dcc');
    ctx.fillStyle = u.team === 0 ? '#bfe8a9' : '#ed9480';
    ctx.fillRect(x - w / 2, y, w * clamp(u.hp / u.maxHp, 0, 1), h);
    if (selected.has(u.id)) {
      ctx.font = `900 ${small ? 7 : 8}px Trebuchet MS,Arial`;
      outlined(selected.size > 1 ? String(u.slot || '') : u.name, x, y - 6, '#fff0b4', '#325046');
    }
    if (u.suppression > 0.9 && u.type !== 'tank') {
      ctx.font = '900 9px Arial';
      ctx.fillStyle = '#fff0ad';
      ctx.fillText('!', x + w / 2 + 5, y + 5);
    }
    if (u.retreat) {
      ctx.font = '900 9px Arial';
      ctx.fillStyle = '#f9dbaa';
      ctx.fillText('↶', x + w / 2 + 5, y + 5);
    }
  }
  ctx.font = '900 11px Trebuchet MS,Arial';
  for (const f of game.floaters) {
    const q = view.project(f.x, f.y + (1 - f.t / f.life) * 1.5, f.z);
    ctx.globalAlpha = Math.min(1, f.t * 3);
    outlined(f.text, q[0], q[1], f.col, '#34584e');
  }
  ctx.globalAlpha = 1;
  if (drag && drag.mode === 'box' && drag.moved) {
    const x = Math.min(drag.sx, drag.x), y = Math.min(drag.sy, drag.y), w = Math.abs(drag.x - drag.sx), h = Math.abs(drag.y - drag.sy);
    ctx.fillStyle = '#ffe1a32b';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fff0a6';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }
}

// The map, roads and houses are drawn once per operation; points, soldiers and the view box on top.
let miniStatic = null, miniStaticLevel = null;
const mpx = (x) => ((x + 22) / 44) * mini.width, mpz = (z) => ((z + 16) / 32) * mini.height;
function drawMinimap() {
  const w = mini.width, h = mini.height;
  if (miniStaticLevel !== lv || !miniStatic) {
    miniStatic = miniStatic || document.createElement('canvas');
    miniStatic.width = w;
    miniStatic.height = h;
    const m = miniStatic.getContext('2d');
    m.clearRect(0, 0, w, h);
    m.fillStyle = '#91b775';
    m.fillRect(0, 0, w, h);
    lv.minimap(m, mpx, mpz, w, h, lv);
    m.fillStyle = '#6a8263';
    for (const b of lv.buildings) m.fillRect(mpx(b.x - b.w / 2), mpz(b.z - b.d / 2), (b.w / 44) * w, (b.d / 32) * h);
    miniStaticLevel = lv;
  }
  mc.clearRect(0, 0, w, h);
  mc.drawImage(miniStatic, 0, 0);
  mc.font = '900 8px Arial';
  mc.textAlign = 'center';
  for (const p of game.points) {
    mc.fillStyle = p.owner === 0 ? '#e8f3db' : p.owner === 1 ? '#ffe0c0' : '#fff0af';
    mc.beginPath();
    mc.arc(mpx(p.x), mpz(p.z), 7, 0, 7);
    mc.fill();
    mc.fillStyle = p.owner === 0 ? '#1684a4' : p.owner === 1 ? '#c25447' : '#546946';
    mc.fillText(p.letter, mpx(p.x), mpz(p.z) + 3);
  }
  for (const u of game.units) {
    if (u.state !== 'alive') continue;
    mc.fillStyle = u.team ? '#d8574c' : selected.has(u.id) ? '#fff0b0' : '#1c85a2';
    mc.beginPath();
    mc.arc(mpx(u.x), mpz(u.z), u.type === 'tank' ? 3.8 : 2.5, 0, 7);
    mc.fill();
  }
  mc.strokeStyle = '#fff5c8aa';
  mc.lineWidth = 1.25;
  mc.beginPath();
  const W = view.width, H = view.height;
  for (let i = 0; i < 4; i++) {
    const q = view.unproject(i === 1 || i === 2 ? W : 0, i >= 2 ? H : 0, cornerPt);
    if (i === 0) mc.moveTo(mpx(q.x), mpz(q.z));
    else mc.lineTo(mpx(q.x), mpz(q.z));
  }
  mc.closePath();
  mc.stroke();
}
function miniJump(clientX, clientY) {
  if (game.phase !== 'playing') return;
  camFocus = null;
  const r = mini.getBoundingClientRect();
  cam.x = clamp(((clientX - r.left) / r.width) * 44 - 22, -22, 22);
  cam.z = clamp(((clientY - r.top) / r.height) * 32 - 16, -16, 16);
  view.updateCamera();
}

/* ------------------------------------------------------------------ the map under the pointer */

function hitTest(x, y) {
  const threshold = coarse.matches || source() === 'gamepad' ? 30 : 22;
  let best = null, bd = 1e9;
  for (const u of game.units) {
    if (u.state !== 'alive' && u.state !== 'down') continue;
    const q = view.project(u.x, 1.35, u.z), d = Math.hypot(q[0] - x, q[1] - y);
    if (d < threshold && d < bd) {
      bd = d;
      best = u;
    }
  }
  if (best) return { unit: best };
  for (const p of game.points) {
    const q = view.project(p.x, 3.95, p.z);
    if (Math.hypot(q[0] - x, q[1] - y) < 25) return { point: p };
  }
  return null;
}
function mapTap(x, y, shift = false, right = false) {
  if (game.phase !== 'playing') return;
  const p = view.unproject(x, y, tapPt), hit = hitTest(x, y);
  if (armed) {
    const target = hit?.unit || hit?.point || p;
    castAbility(clamp(target.x, -21, 21), clamp(target.z, -15, 15));
    return;
  }
  if (hit?.unit && hit.unit.team === 0 && !right) {
    selectUnit(hit.unit.id, shift);
    return;
  }
  if (hit?.unit && hit.unit.team === 1 && hit.unit.state === 'alive') {
    commandMove(hit.unit.x, hit.unit.z, hit.unit.id);
    return;
  }
  if (hit?.point) {
    commandMove(hit.point.x, hit.point.z);
    return;
  }
  if (Math.abs(p.x) > 22 || Math.abs(p.z) > 16) return;
  commandMove(p.x, p.z);
}
function cameraPan(dx, dy) {
  camFocus = null;
  const W = view.width, H = view.height;
  const a = view.unproject(W / 2, H / 2, panA), b = view.unproject(W / 2 + dx, H / 2 + dy, panB);
  cam.x = clamp(cam.x + a.x - b.x, -22, 22);
  cam.z = clamp(cam.z + a.z - b.z, -16, 16);
  view.updateCamera();
}
function zoom(f) {
  cam.zoom = clamp(cam.zoom * f, 0.48, 2.8);
  view.updateCamera();
}
function fitView() {
  camFocus = null;
  cam.x = 0;
  cam.z = 0;
  cam.zoom = Math.min(1, (view.width / view.height) * 0.73);
  view.updateCamera();
}
function releaseDrag(d) {
  if (game.phase !== 'playing') return;
  if (d.moved && d.mode === 'box') {
    const x0 = Math.min(d.sx, d.x), x1 = Math.max(d.sx, d.x), y0 = Math.min(d.sy, d.y), y1 = Math.max(d.sy, d.y);
    if (!d.shift) selected.clear();
    for (const u of game.units) {
      if (u.team !== 0 || u.state !== 'alive') continue;
      const q = view.project(u.x, 1, u.z);
      if (q[0] >= x0 && q[0] <= x1 && q[1] >= y0 && q[1] <= y1) selected.add(u.id);
    }
    armed = null;
    audio.play('select');
    updateUI();
  } else if (!d.moved) mapTap(d.x, d.y, d.shift, d.right);
}

/* ------------------------------------------------------------------ controller cursor
   The left stick moves a cursor over the map and every panel, A clicks what is under it,
   the D-pad jumps between buttons in menus (and fires field orders in battle), and pushing
   the cursor against a screen edge scrolls the map. */

const pad = (() => {
  const el = $('padCursor');
  const CLICKABLE = 'button:not([disabled]),summary';
  const DIRS = ['Up', 'Down', 'Left', 'Right'];
  const spot = { x: 0, y: 0 };
  let x = innerWidth / 2, y = innerHeight / 2, active = false, fresh = false, hot = null, cur = null;
  let drawnX = NaN, drawnY = NaN, repeatAt = 0, repeatDir = null, lastScope = null;
  const hidden = (id) => $(id).classList.contains('hidden');
  const scope = () => (!hidden('pause') ? $('pause') : !hidden('result') ? $('result') : !hidden('brief') ? $('brief') : $('hud'));
  const primary = (sc) => (sc.id === 'pause' ? $('resume') : sc.id === 'result' ? $('replay') : sc.id === 'brief' ? $('deploy') : null);
  const clampXY = () => {
    x = clamp(x, 2, innerWidth - 2);
    y = clamp(y, 2, innerHeight - 2);
  };
  const shown = (b) => {
    if (b.offsetParent === null) return false;
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  function under() {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    if (hit === kit.canvas) return 'map';
    if (hit === mini) return 'minimap';
    const b = hit.closest(CLICKABLE);
    return b && scope().contains(b) ? b : null;
  }
  function setHot(n) {
    if (n === hot) return;
    hot?.classList.remove('padHover');
    hot = n;
    hot?.classList.add('padHover');
    el.classList.toggle('onButton', !!n);
  }
  function draw() {
    if (x !== drawnX || y !== drawnY) {
      drawnX = x;
      drawnY = y;
      el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    }
  }
  function snapTo(b) {
    if (!b || !shown(b)) return;
    b.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
    clampXY();
    draw();
  }
  /** Spatial navigation: the nearest button in that direction, favouring ones in line with the cursor. */
  function jump(dir) {
    const dx = dir === 'Left' ? -1 : dir === 'Right' ? 1 : 0, dy = dir === 'Up' ? -1 : dir === 'Down' ? 1 : 0;
    let best = null, score = Infinity;
    for (const b of scope().querySelectorAll(CLICKABLE)) {
      if (!shown(b)) continue;
      const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const along = (cx - x) * dx + (cy - y) * dy, across = Math.abs((cx - x) * dy) + Math.abs((cy - y) * dx);
      if (along < 6 || across > along * 1.6) continue;
      const s = along + across * 2.5;
      if (s < score) {
        score = s;
        best = b;
      }
    }
    if (best) snapTo(best);
  }
  return {
    get active() {
      return active;
    },
    update(dt) {
      const on = kit.input.source === 'gamepad' && !kit.menu.isOpen;
      if (on !== active) {
        active = on;
        el.hidden = !on;
        fresh = on;
        lastScope = null;
        if (!on) {
          setHot(null);
          cur = null;
        }
      }
      if (!on) return;
      const sc = scope();
      if (sc !== lastScope) {
        lastScope = sc;
        const b = primary(sc);
        if (b) snapTo(b);
      }
      const v = kit.input.vector('cursor'), m = Math.hypot(v.x, v.y);
      if (m > 0) {
        const speed = Math.min(innerWidth, innerHeight) * 1.25 * m;
        x += v.x * speed * dt;
        y -= v.y * speed * dt;
        clampXY();
      }
      if (sc.id !== 'hud') {
        const now = performance.now();
        for (const dir of DIRS) {
          const name = 'nav' + dir;
          if (kit.input.pressed(name)) {
            jump(dir);
            repeatDir = dir;
            repeatAt = now + 380;
          } else if (repeatDir === dir && kit.input.down(name) && now > repeatAt) {
            jump(dir);
            repeatAt = now + 130;
          } else if (repeatDir === dir && !kit.input.down(name)) repeatDir = null;
        }
      } else if (game.phase === 'playing') {
        const e = 36;
        const ex = x < e && v.x < -0.2 ? 1 : x > innerWidth - e && v.x > 0.2 ? -1 : 0;
        const ey = y < e && v.y > 0.2 ? 1 : y > innerHeight - e && v.y < -0.2 ? -1 : 0;
        if (ex || ey) cameraPan(ex * 520 * dt, ey * 520 * dt);
      }
      draw();
      cur = under();
      setHot(cur === 'map' || cur === 'minimap' ? null : cur);
    },
    click() {
      // The press that wakes the cursor only shows it.
      if (!active || fresh) {
        fresh = false;
        return;
      }
      if (cur === 'map') mapTap(x, y, false, false);
      else if (cur === 'minimap') miniJump(x, y);
      else if (cur && cur.isConnected) cur.click();
    },
    /** The cursor's screen point when it is over the battle map, else null. */
    mapPoint() {
      if (!active || cur !== 'map') return null;
      spot.x = x;
      spot.y = y;
      return spot;
    },
    endFrame() {
      fresh = false;
    },
  };
})();

/* ------------------------------------------------------------------ input and the loop */

const UNIT_ACTIONS = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6'];
const ACTIONS = {
  pan: { type: 'vector', keys: 'wasd+arrows', gamepad: 'rightStick' },
  cursor: { type: 'vector', gamepad: 'leftStick' },
  look: { type: 'look', mouse: 'drag', touch: 'drag', gamepad: [] },
  click: { mouse: [0] },
  rclick: { mouse: [2] },
  shift: { keys: ['ShiftLeft', 'ShiftRight'] },
  confirm: { gamepad: ['A'] },
  enter: { keys: ['Enter', 'NumpadEnter'] },
  back: { keys: ['Escape'], gamepad: ['B'] },
  pause: { keys: ['Space', 'KeyP'], gamepad: ['Start'] },
  help: { keys: ['KeyH'], gamepad: ['Back'] },
  mute: { keys: ['KeyM'] },
  all: { keys: ['KeyQ'], gamepad: ['X'] },
  nextUnit: { keys: ['KeyC'], gamepad: ['RT'] },
  prevUnit: { gamepad: ['LT'] },
  grenade: { keys: ['KeyG'], gamepad: ['Up'] },
  smoke: { keys: ['KeyF'], gamepad: ['Left'] },
  aid: { keys: ['KeyE'], gamepad: ['Right'] },
  tank: { keys: ['KeyT'], gamepad: ['Down'] },
  retreat: { keys: ['KeyR'], gamepad: ['Y'] },
  zoomIn: { keys: ['Equal', 'NumpadAdd'], gamepad: ['RB'] },
  zoomOut: { keys: ['Minus', 'NumpadSubtract'], gamepad: ['LB'] },
  fit: { keys: ['KeyV'], gamepad: ['RS'] },
  navUp: { gamepad: ['Up'] },
  navDown: { gamepad: ['Down'] },
  navLeft: { gamepad: ['Left'] },
  navRight: { gamepad: ['Right'] },
};
UNIT_ACTIONS.forEach((name, i) => (ACTIONS[name] = { keys: [`Digit${i + 1}`, `Numpad${i + 1}`] }));

function toggleSound() {
  settings.sound = !settings.sound;
  audio.start();
  audio.applyVolume();
  updateSettings();
  save('settings', settings);
}

function handleInput(dt) {
  const inp = kit.input, p = inp.pointer;
  pad.update(dt);
  const phase = game.phase;

  if (inp.pressed('mute')) toggleSound();
  if (inp.pressed('help')) {
    if (phase === 'paused') $('helpDetails').open = !$('helpDetails').open;
    else if (phase !== 'ended') pauseGame(true);
    return;
  }
  if (inp.pressed('pause')) {
    if (phase === 'paused') resumeGame();
    else if (phase === 'playing') pauseGame();
    return;
  }
  if (inp.pressed('back')) {
    if (phase === 'paused') resumeGame();
    else if (phase === 'playing') {
      if (armed) {
        armed = null;
        updateUI();
      } else if (drag) drag = null;
      else if (inp.source !== 'gamepad') pauseGame();
    }
    return;
  }
  if (inp.pressed('enter')) {
    if (phase === 'brief' || phase === 'ended') startGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (inp.pressed('confirm')) {
    audio.start();
    pad.click();
  }
  if (game.phase !== 'playing') {
    drag = null;
    // The arrows or the right stick scroll a long manual.
    const v = inp.vector('pan'), sc = game.phase === 'paused' ? $('pause') : game.phase === 'ended' ? $('result') : null;
    const modal = sc?.querySelector('.modal');
    if (modal && v.y) modal.scrollTop -= v.y * 700 * dt;
    return;
  }

  // Soldiers and field orders.
  for (let i = 0; i < UNIT_ACTIONS.length; i++) {
    if (!inp.pressed(UNIT_ACTIONS[i])) continue;
    const u = squad()[i];
    if (u) selectUnit(u.id, inp.down('shift'));
  }
  if (inp.pressed('all')) selectAll();
  if (inp.pressed('nextUnit')) cycleUnit(1);
  if (inp.pressed('prevUnit')) cycleUnit(-1);
  if (inp.pressed('grenade')) armAbility('grenade');
  if (inp.pressed('smoke')) armAbility('smoke');
  if (inp.pressed('aid')) armAbility('aid');
  if (inp.pressed('tank')) armAbility('tank');
  if (inp.pressed('retreat')) retreat();

  // The camera: keys or the right stick pan, wheel / pinch / bumpers zoom.
  if (inp.pressed('zoomIn')) zoom(1.15);
  if (inp.pressed('zoomOut')) zoom(0.87);
  if (inp.pressed('fit')) fitView();
  const v = inp.vector('pan');
  if (v.x || v.y) {
    const speed = inp.source === 'gamepad' ? 420 : 300;
    cameraPan(-v.x * dt * speed, v.y * dt * speed);
  }
  const z = inp.zoom();
  if (z) {
    zoom(Math.exp(z * (p.type === 'touch' ? 0.25 : 0.1)));
    if (drag) drag.moved = true;
  }

  // The map: a click or tap orders, a left-drag box-selects, right-drag or a finger pans.
  if (p.justDown) {
    audio.start();
    const touch = p.type === 'touch', left = !touch && inp.down('click');
    drag = { sx: p.x, sy: p.y, x: p.x, y: p.y, mode: touch || !left ? 'pan' : 'box', moved: false, right: !touch && inp.down('rclick'), shift: inp.down('shift') };
  }
  if (drag) {
    drag.x = p.x;
    drag.y = p.y;
    if (!drag.moved && Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 7) drag.moved = true;
    if (drag.mode === 'pan' && drag.moved) {
      const lk = inp.look('look');
      if (lk.x || lk.y) {
        const s = kit.settings.get(), k = (p.type === 'touch' ? TOUCH_LOOK : MOUSE_LOOK) * (s.lookSensitivity || 1), inv = s.invertY ? -1 : 1;
        cameraPan(lk.x / k, lk.y / (k * inv));
      }
    }
    if (!p.down) {
      const d = drag;
      drag = null;
      releaseDrag(d);
    }
  }

  // Where an order would land: under the mouse, the last touch, or the controller cursor.
  const at = pad.mapPoint();
  if (at) hover = view.unproject(at.x, at.y, hoverPt);
  else if (!pad.active && (p.over || p.down)) hover = view.unproject(p.x, p.y, hoverPt);
}

const preview = { x: 0, z: 0, radius: 0, valid: false, caster: null, range: 0 };
function computePreview() {
  if (!armed || !hover || game.phase !== 'playing') return null;
  const a = ABILITIES[armed];
  let caster = null, cd = Infinity;
  for (const u of game.units) {
    if (!selected.has(u.id) || u.team !== 0 || u.state !== 'alive' || u.retreat || u.type === 'tank') continue;
    const d = Math.hypot(u.x - hover.x, u.z - hover.z);
    if (d < cd) {
      cd = d;
      caster = u;
    }
  }
  preview.x = hover.x;
  preview.z = hover.z;
  preview.radius = a.radius;
  preview.range = a.range;
  preview.caster = caster;
  preview.valid = armed === 'aid' || (!!caster && cd <= a.range);
  return preview;
}

const viewState = { game: null, time: 0, selected, preview: null, showSelection: false };
function frame(dt) {
  handleInput(dt);
  pad.endFrame();
  const playing = game.phase === 'playing';
  if (game.phase !== 'paused') visualTime += dt;
  if (playing) {
    let remain = Math.min(dt, 0.05);
    while (remain > 1e-6) {
      const s = Math.min(1 / 30, remain);
      updateGame(s);
      remain -= s;
    }
    audio.music(game.t);
  }
  if (camFocus && game.phase === 'playing') {
    const k = Math.min(1, dt * 5);
    cam.x = lerp(cam.x, camFocus.x, k);
    cam.z = lerp(cam.z, camFocus.z, k);
    if (Math.hypot(cam.x - camFocus.x, cam.z - camFocus.z) < 0.05) camFocus = null;
  }
  view.setShake(settings.effects && game.phase === 'playing' ? game.shake : 0);
  viewState.game = game;
  viewState.time = visualTime;
  viewState.showSelection = game.phase !== 'brief' && !(game.phase === 'paused' && previousPhase === 'brief');
  viewState.preview = computePreview();
  view.update(viewState);
  view.render();
  drawOverlay();
  uiClock += dt;
  if (uiClock > 0.14) {
    uiClock = 0;
    updateUI();
    drawMinimap();
  }
}

/** Canvas size, and the original's portrait / landscape camera framing. */
function onResize(w, h) {
  const d = Math.min(devicePixelRatio || 1, 1.5);
  overlay.width = Math.round(w * d);
  overlay.height = Math.round(h * d);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const wasPortrait = lastW < lastH, portrait = w < h, turned = lastW > 0 && wasPortrait !== portrait;
  lastW = w;
  lastH = h;
  if (!game) return;
  if (game.phase === 'brief' || (game.phase === 'paused' && previousPhase === 'brief')) applyBriefCamera();
  else {
    if (turned && (game.phase === 'playing' || game.phase === 'paused')) {
      camFocus = null;
      const troops = selectedUnits();
      cam.x = portrait && troops.length ? troops.reduce((a, u) => a + u.x, 0) / troops.length : 0;
      cam.z = portrait && troops.length ? troops.reduce((a, u) => a + u.z, 0) / troops.length : 1;
      cam.zoom = 1.02;
    }
    cam.half = portrait ? 25 : 22;
    view.updateCamera();
  }
}

/* ------------------------------------------------------------------ buttons */

function wireButtons() {
  $('deploy').onclick = startGame;
  $('allBtn').onclick = selectAll;
  $('pauseBtn').onclick = () => pauseGame();
  $('resume').onclick = resumeGame;
  $('restart').onclick = startGame;
  $('replay').onclick = startGame;
  $('toBrief').onclick = briefing;
  $('resultBrief').onclick = briefing;
  $('nextOp').onclick = nextOperation;
  for (const b of document.querySelectorAll('.helpBtn')) b.onclick = () => pauseGame(true);
  for (const b of document.querySelectorAll('.soundBtn')) b.onclick = toggleSound;
  $('soundSetting').onclick = toggleSound;
  $('closeCoach').onclick = () => {
    coachHidden = true;
    $('coach').classList.add('hidden');
  };
  for (const b of document.querySelectorAll('[data-op]')) b.onclick = () => selectOp(+b.dataset.op);
  for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => setDifficulty(+b.dataset.diff);
  for (const b of document.querySelectorAll('[data-ability]')) b.onclick = () => armAbility(b.dataset.ability);
  for (const b of document.querySelectorAll('[data-flag]')) {
    b.onclick = () => {
      const p = game.points[+b.dataset.flag];
      if (p) commandMove(p.x, p.z);
    };
  }
  $('zoomIn').onclick = () => zoom(1.18);
  $('zoomOut').onclick = () => zoom(1 / 1.18);
  $('fitView').onclick = fitView;
  $('displayBtn').onclick = () => kit.menu.open();
  $('effectsBtn').onclick = () => {
    settings.effects = !settings.effects;
    view.setEffects(settings.effects);
    updateSettings();
    save('settings', settings);
  };
  $('fullscreenBtn').onclick = async () => {
    try {
      if (!document.fullscreenElement) {
        if (!document.documentElement.requestFullscreen) {
          toast('Full screen is not available in this browser.');
          return;
        }
        await document.documentElement.requestFullscreen();
      } else await document.exitFullscreen();
    } catch {
      toast('The browser did not allow full screen.');
    }
    updateSettings();
  };
  document.addEventListener('fullscreenchange', updateSettings);

  // The minimap moves the camera: tap it, or drag across it.
  let miniDrag = false;
  mini.addEventListener('pointerdown', (e) => {
    if (game.phase !== 'playing') return;
    e.preventDefault();
    miniDrag = true;
    try {
      mini.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic */
    }
    miniJump(e.clientX, e.clientY);
  });
  mini.addEventListener('pointermove', (e) => {
    if (miniDrag) miniJump(e.clientX, e.clientY);
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) mini.addEventListener(t, () => (miniDrag = false));

  // Sound starts on the first tap, click or key anywhere.
  addEventListener('pointerdown', () => audio.start(), { capture: true, passive: true });
  addEventListener('keydown', () => audio.start(), { capture: true });
  // Leaving the game pauses the battle, like the original.
  addEventListener('blur', () => {
    drag = null;
    if (game.phase === 'playing') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.phase === 'playing') pauseGame();
    audio.hold(document.hidden || kit.paused);
  });
}

/* ------------------------------------------------------------------ start */

kit = await boot({
  title: 'Pocket Front',
  canvas: $('world'),
  gear: 'none',
  accent: '#ed733e',
  background: '#183f3b',
  touch: { hint: false },
  input: ACTIONS,
});
kit.loading.progress(0.7, 'Unpacking the toy box…');
view = await createView(kit);
cam = view.cam;
view.setEffects(settings.effects);
$('version').textContent = `POCKET FRONT · ${kit.backendLabel.toUpperCase()}`;
wireButtons();
kit.onResize(onResize);
briefing();
applySource(kit.input.source);
kit.input.onSourceChange(applySource);
kit.onPause((paused) => audio.hold(paused || document.hidden));
updateSettings();
kit.loading.progress(0.85, 'Painting the soldiers…');
viewState.game = game;
view.update(viewState);
await view.warm();
kit.start(frame);

if (new URLSearchParams(location.search).has('test')) {
  window.__test = {
    get game() {
      return game;
    },
    get view() {
      return view;
    },
    get level() {
      return lv.id;
    },
    get selected() {
      return [...selected];
    },
    start: startGame,
    briefing,
    selectOp,
    select: selectUnit,
    all: selectAll,
    move: commandMove,
    ability: armAbility,
    cast: castAbility,
    step: (seconds) => {
      for (let i = 0; i < seconds * 30; i++) updateGame(1 / 30);
      updateUI();
    },
    snapshot: () => ({
      phase: game.phase, level: lv.id, t: game.t, tickets: game.tickets, supply: game.supply,
      points: game.points.map((p) => ({ name: p.name, owner: p.owner, cap: p.cap })),
      units: game.units.map((u) => ({ id: u.id, name: u.name, team: u.team, type: u.type, hp: u.hp, state: u.state, x: u.x, z: u.z, path: u.path, retreat: u.retreat })),
      stats: game.stats,
    }),
    walkable, findPath, protection, damageUnit, revive, finish, enemyAI,
  };
}
