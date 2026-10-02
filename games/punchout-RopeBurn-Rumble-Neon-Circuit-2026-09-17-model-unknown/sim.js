/**
 * sim.js — RopeBurn Rumble's fight rules. No DOM and no three.js, so the same
 * code runs in the game and in tests/smoke.mjs under node.
 *
 * createFight() is one bout. The game calls its verbs from input (punch, rush,
 * slip, duck, setGuard, getUpTap, takeCorner) and update(dt) once per frame
 * while the bout is not paused. Everything that happens comes back through
 * onEvent(type, data), so the ring, the HUD and the sound can react. Every
 * delay (the rush wind-up, knockdown counts, the referee) runs on the fight's
 * own clock, so pausing the game pauses them too.
 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ROUND_TIME = 60;
export const ROUNDS = 3;
export const STORAGE_KEY = 'ropeburn-meta';

/** The four tells from the first bout, plus the champion's haymaker. */
export const ATTACKS = {
  jab: { tell: 0.48, active: 0.12, recover: 0.42, damage: 10, kind: 'straight', side: 1 },
  cross: { tell: 0.66, active: 0.13, recover: 0.54, damage: 15, kind: 'straight', side: -1 },
  hook: { tell: 0.76, active: 0.15, recover: 0.64, damage: 20, kind: 'hook', side: 0 },
  upper: { tell: 0.92, active: 0.14, recover: 0.72, damage: 25, kind: 'upper', side: 0 },
  // Too wide to slip: duck it. A short, late counter window, but a big payoff.
  haymaker: { tell: 1.25, active: 0.18, recover: 1.2, damage: 34, kind: 'haymaker', side: 0, counterFrac: 0.3, counterMul: 2.3 },
};

/**
 * The Neon Circuit. Gus is the original bout, unchanged. Each mix is the move
 * table for phases 1-3 (a phase rises with knockdowns and rounds). Moves are
 * attacks plus two specials: 'feint' (a jab tell that pulls back, then a real
 * jab) and 'onetwo' (a jab chained into a fast cross).
 */
export const OPPONENTS = [
  {
    id: 'gus',
    name: 'GUS GRANITE',
    tag: 'Southside Breaker',
    bout: 'BOUT 01',
    record: '14-6',
    hp: 100,
    dmg: 1,
    tempo: 1,
    pressure: 1,
    block: 1,
    reward: 1,
    southpaw: false,
    mix: [
      { jab: 0.58, cross: 0.24, hook: 0.18 },
      { jab: 0.3, cross: 0.27, hook: 0.27, upper: 0.16 },
      { jab: 0.18, cross: 0.24, hook: 0.3, upper: 0.28 },
    ],
    look: { skin: 0x8c573f, kit: 0x4b2439, trim: 0xffcb3f, glove: 0x7428c4, shoe: 0x18131d, scale: 1.12, extra: 'none' },
    arena: { rim: 0x8b4cff, sign: 0x49e5ff, rope: 0xff3e59 },
    talk: 'Gus loads his hook with a shoulder dip. Duck it, then dig to the body while he resets.',
  },
  {
    id: 'vera',
    name: 'VERA VOLTAGE',
    tag: 'Neon Southpaw',
    bout: 'BOUT 02',
    record: '19-2',
    hp: 100,
    dmg: 1.1,
    tempo: 0.88,
    pressure: 0.75,
    block: 1,
    reward: 1.3,
    southpaw: true,
    mix: [
      { jab: 0.36, cross: 0.22, hook: 0.08, feint: 0.18, onetwo: 0.16 },
      { jab: 0.26, cross: 0.18, hook: 0.16, feint: 0.18, onetwo: 0.22 },
      { jab: 0.18, cross: 0.16, hook: 0.18, upper: 0.12, feint: 0.14, onetwo: 0.22 },
    ],
    look: { skin: 0xd9a074, kit: 0x0f6b63, trim: 0xff4fd8, glove: 0x19e0c0, shoe: 0xf3f0ff, scale: 1.0, extra: 'mohawk' },
    arena: { rim: 0xff4fd8, sign: 0x19e0c0, rope: 0x19e0c0 },
    talk: 'Vera fakes the jab: if the glove never flashes, it is a fake and she blocks your swing. Slip the real one, then the fast 1-2 behind it.',
  },
  {
    id: 'duke',
    name: 'DUKE DYNAMO',
    tag: 'Circuit Champion',
    bout: 'TITLE BOUT',
    record: '31-0',
    hp: 118,
    dmg: 1.08,
    tempo: 1.04,
    pressure: 1,
    block: 1.25,
    reward: 1.7,
    southpaw: false,
    mix: [
      { jab: 0.4, cross: 0.28, hook: 0.22, haymaker: 0.1 },
      { jab: 0.24, cross: 0.24, hook: 0.2, upper: 0.16, haymaker: 0.16 },
      { jab: 0.16, cross: 0.2, hook: 0.22, upper: 0.2, haymaker: 0.22 },
    ],
    look: { skin: 0x5e3a2a, kit: 0x1b1b24, trim: 0xffd24a, glove: 0xd11a2a, shoe: 0xffd24a, scale: 1.22, extra: 'belt' },
    arena: { rim: 0xffb02e, sign: 0xffd24a, rope: 0xffd24a },
    talk: 'The champ shells up tight. When the whole arm winds back, that is the haymaker: duck it and he is wide open.',
  },
];

export const opponentById = (id) => OPPONENTS.find((o) => o.id === id) || OPPONENTS[0];

export const DIFFICULTY = {
  sparring: { id: 'sparring', label: 'SPARRING', tell: 1.2, dmg: 0.8, hp: 0.92, getup: 6, reward: 0.8, desc: 'Slower tells, softer punches, an easier get-up.' },
  pro: { id: 'pro', label: 'PRO', tell: 1, dmg: 1, hp: 1, getup: 7, reward: 1, desc: 'The circuit as it was meant to be fought.' },
  brutal: { id: 'brutal', label: 'BRUTAL', tell: 0.88, dmg: 1.15, hp: 1.1, getup: 8, reward: 1.35, desc: 'Faster tells, heavier hands, more credits.' },
};

export const GEAR = {
  balanced: { slot: 'gloves', name: 'Circuit Reds', desc: '+4% punch power', cost: 0, power: 1.04 },
  hammers: { slot: 'gloves', name: 'Brick Hammers', desc: '+10% power, -6% stamina recovery', cost: 120, power: 1.1, stamRegen: 0.94 },
  wraps: { slot: 'gloves', name: 'Voltage Wraps', desc: '+6% power, +6% momentum gain', cost: 180, power: 1.06, momentum: 1.06, req: 'gus' },
  quick: { slot: 'boots', name: 'Slip Soles', desc: '+8% dodge window', cost: 0, dodge: 1.08 },
  anchors: { slot: 'boots', name: 'Anchor High-Tops', desc: '+8% guard, -4% dodge window', cost: 100, guard: 1.08, dodge: 0.96 },
  laces: { slot: 'boots', name: 'Dynamo Laces', desc: '+6% dodge window, +4% guard', cost: 220, dodge: 1.06, guard: 1.04, req: 'vera' },
  classic: { slot: 'guard', name: 'Blue Mouthguard', desc: '+5 max stamina', cost: 0, maxStamina: 5 },
  focus: { slot: 'guard', name: 'Focus Guard', desc: '+12% momentum gain', cost: 140, momentum: 1.12 },
};

export const CORNER_BOOSTS = [
  { id: 'power', title: 'SNAP JABS', desc: '+8% punch power for the rest of the bout' },
  { id: 'stam', title: 'DEEP BREATHS', desc: '+18% stamina recovery' },
  { id: 'guard', title: 'TIGHT SHELL', desc: '+12% guard efficiency' },
];

export const DEFAULT_META = {
  xp: 0,
  level: 1,
  credits: 0,
  wins: 0,
  gear: { gloves: 'balanced', boots: 'quick', guard: 'classic' },
  owned: ['balanced', 'quick', 'classic'],
  beaten: [],
  best: {},
  opponent: 'gus',
  difficulty: 'pro',
  sound: true,
  talkSeen: false,
};

/** Coerce a saved profile (any age, any damage) into a valid one. Old saves keep their progress. */
export function sanitizeMeta(raw) {
  const m = structuredClone(DEFAULT_META);
  if (!raw || typeof raw !== 'object') return m;
  for (const k of ['xp', 'credits', 'wins']) if (Number.isFinite(+raw[k]) && +raw[k] >= 0) m[k] = Math.floor(+raw[k]);
  m.level = 1 + Math.floor(m.xp / 180);
  if (Array.isArray(raw.owned)) for (const id of raw.owned) if (GEAR[id] && !m.owned.includes(id)) m.owned.push(id);
  if (raw.gear && typeof raw.gear === 'object') {
    for (const [slot, id] of Object.entries(raw.gear)) if (GEAR[id]?.slot === slot && m.owned.includes(id)) m.gear[slot] = id;
  }
  if (Array.isArray(raw.beaten)) m.beaten = OPPONENTS.map((o) => o.id).filter((id) => raw.beaten.includes(id));
  // Saves from before the circuit only knew Gus: a win there means he was beaten.
  if (!m.beaten.length && m.wins > 0) m.beaten = ['gus'];
  if (raw.best && typeof raw.best === 'object') {
    for (const o of OPPONENTS) {
      const b = raw.best[o.id];
      if (b && typeof b === 'object') {
        m.best[o.id] = {
          score: Math.max(0, Math.floor(+b.score || 0)),
          ko: Number.isFinite(+b.ko) && +b.ko > 0 ? +b.ko : 0,
          wins: Math.max(0, Math.floor(+b.wins || 0)),
        };
      }
    }
  }
  if (isUnlocked(m, raw.opponent)) m.opponent = raw.opponent;
  if (DIFFICULTY[raw.difficulty]) m.difficulty = raw.difficulty;
  if (typeof raw.sound === 'boolean') m.sound = raw.sound;
  if (typeof raw.talkSeen === 'boolean') m.talkSeen = raw.talkSeen;
  return m;
}

/** An opponent is open once the one before it on the circuit has been beaten. */
export function isUnlocked(meta, id) {
  const i = OPPONENTS.findIndex((o) => o.id === id);
  if (i < 0) return false;
  return i === 0 || meta.beaten.includes(OPPONENTS[i - 1].id);
}

export function gearMods(meta) {
  const out = { power: 1, dodge: 1, guard: 1, maxStamina: 0, stamRegen: 1, momentum: 1 };
  for (const id of Object.values(meta.gear)) {
    const g = GEAR[id];
    if (!g) continue;
    for (const k of ['power', 'dodge', 'guard', 'stamRegen', 'momentum']) if (g[k] != null) out[k] *= g[k];
    out.maxStamina += g.maxStamina || 0;
  }
  return out;
}

/** Buy (if needed) and equip a piece of gear. Returns 'equipped' | 'bought' | 'locked' | 'poor' | 'unknown'. */
export function buyOrEquip(meta, id) {
  const g = GEAR[id];
  if (!g) return 'unknown';
  if (!meta.owned.includes(id)) {
    if (g.req && !meta.beaten.includes(g.req)) return 'locked';
    if (meta.credits < g.cost) return 'poor';
    meta.credits -= g.cost;
    meta.owned.push(id);
    meta.gear[g.slot] = id;
    return 'bought';
  }
  meta.gear[g.slot] = id;
  return 'equipped';
}

/** Bank a finished bout into the profile. Returns what to tell the player. */
export function applyResult(meta, r) {
  const op = opponentById(r.opponent);
  const diff = DIFFICULTY[r.difficulty] || DIFFICULTY.pro;
  const mult = op.reward * diff.reward;
  let xpGain;
  let creditGain;
  if (r.win) {
    xpGain = Math.round((55 + r.foeKD * 15 + r.counters * 3) * mult);
    creditGain = Math.round((85 + r.counters * 4) * mult);
    meta.wins += 1;
  } else {
    xpGain = Math.floor((20 + r.landed) * 0.65);
    creditGain = 20;
  }
  meta.xp += xpGain;
  meta.credits += creditGain;
  const oldLevel = meta.level;
  meta.level = 1 + Math.floor(meta.xp / 180);

  let unlocked = null;
  if (r.win && !meta.beaten.includes(op.id)) {
    meta.beaten.push(op.id);
    const next = OPPONENTS[OPPONENTS.indexOf(op) + 1];
    if (next) unlocked = next;
  }
  const best = (meta.best[op.id] ||= { score: 0, ko: 0, wins: 0 });
  const newScore = r.score > best.score;
  if (newScore) best.score = r.score;
  let newKO = false;
  if (r.win && r.ko) {
    newKO = !best.ko || r.time < best.ko;
    if (newKO) best.ko = Math.round(r.time * 10) / 10;
  }
  if (r.win) best.wins += 1;
  return { xpGain, creditGain, levelUp: meta.level > oldLevel, level: meta.level, unlocked, newScore, newKO, champion: r.win && op.id === OPPONENTS[OPPONENTS.length - 1].id };
}

/** 10-point must: the busier, cleaner round wins 10-9, each knockdown costs a point. */
export function scoreCards(rounds) {
  let player = 0;
  let foe = 0;
  for (const r of rounds) {
    const d = r.dealt - r.taken;
    let p = 10;
    let f = 10;
    if (Math.abs(d) >= 4) {
      if (d > 0) f = 9;
      else p = 9;
    }
    player += Math.max(7, p - r.pKD);
    foe += Math.max(7, f - r.fKD);
  }
  return { player, foe };
}

/**
 * One bout.
 * @param {object} o
 * @param {object} o.opponent     an entry of OPPONENTS
 * @param {object} [o.difficulty] an entry of DIFFICULTY
 * @param {object} o.meta         the profile (gear, level)
 * @param {() => number} [o.rng]  random source (seeded in tests)
 * @param {(type: string, data: object) => void} [o.onEvent]
 */
export function createFight({ opponent, difficulty = DIFFICULTY.pro, meta, rng = Math.random, onEvent = () => {} }) {
  const op = opponent;
  const diff = difficulty;
  const mods = gearMods(meta);
  const level = meta.level || 1;
  const staminaMax = 100 + mods.maxStamina;
  const foeMax = Math.round(op.hp * diff.hp);
  const emit = (type, data = {}) => onEvent(type, data);
  const rand = (a, b) => a + rng() * (b - a);

  const s = {
    mode: 'ready', // ready → fight ⇄ foeDown | playerDown | corner → result
    round: 1,
    time: ROUND_TIME,
    fightTime: 0,
    playerHp: 100,
    foeHp: foeMax,
    foeMax,
    stamina: staminaMax,
    staminaMax,
    rush: 0,
    playerKD: 0,
    foeKD: 0,
    score: 0,
    landed: 0,
    thrown: 0,
    dodges: 0,
    counters: 0,
    actionCd: 0,
    dodgeT: 0,
    dodgeDir: 1,
    duckT: 0,
    guard: false,
    guardBlocked: false, // set when a punch, slip or guard break drops the guard: re-press to raise it
    playerHitT: 0,
    foeHitT: 0,
    foeStun: 0,
    cornerPower: 1,
    cornerStam: 1,
    cornerGuard: 1,
    foe: { mode: 'idle', t: 0, next: 1.15, attack: null, side: 0, blockT: 0, phase: 1, queued: null },
    getupT: 0,
    getupNeed: diff.getup,
    getupCount: 0,
    getupOpen: false,
    downFinal: false,
    rounds: [{ dealt: 0, taken: 0, pKD: 0, fKD: 0 }],
    result: null,
  };
  const cur = () => s.rounds[s.round - 1];

  // The fight's own clock for every delay.
  let timers = [];
  const later = (t, fn) => timers.push({ t, fn });
  const tickTimers = (dt) => {
    if (!timers.length) return;
    const due = [];
    timers = timers.filter((k) => {
      k.t -= dt;
      if (k.t <= 0) {
        due.push(k);
        return false;
      }
      return true;
    });
    for (const k of due) k.fn();
  };

  function counterWindow(a) {
    return Math.max(0.2, a.tell * (a.counterFrac ?? 0.48));
  }

  function makeAttack(move, tellMul = 1) {
    const phase = s.foe.phase;
    const key = move === 'feint' || move === 'onetwo' ? 'jab' : move;
    const base = ATTACKS[key];
    const speed = (1 - (phase - 1) * 0.085) * op.tempo;
    let side = base.side || (rng() < 0.5 ? -1 : 1);
    if (op.southpaw && base.side) side = -side;
    return {
      ...base,
      key,
      move,
      tell: base.tell * speed * diff.tell * tellMul,
      recover: base.recover * speed,
      side,
      feint: move === 'feint',
      chain: move === 'onetwo' ? 'cross' : null,
    };
  }

  function chooseMove() {
    const table = op.mix[clamp(s.foe.phase, 1, 3) - 1];
    let r = rng();
    let last = 'jab';
    for (const [move, w] of Object.entries(table)) {
      last = move;
      if (r < w) return move;
      r -= w;
    }
    return last;
  }

  function startEnemyAttack(move = null, tellMul = 1) {
    if (s.foeStun > 0) return;
    const f = s.foe;
    const pick = move || f.queued || chooseMove();
    f.queued = null;
    const a = makeAttack(pick, tellMul);
    f.attack = a;
    f.mode = 'tell';
    f.t = a.tell;
    f.side = a.side;
    // A feint has no counter window: swing at the fake and it is blocked (and its glove never flashes).
    a.window = a.feint ? 0 : counterWindow(a);
    emit('tell', { attack: a });
  }

  function foeIdle(next) {
    const f = s.foe;
    f.mode = 'idle';
    f.t = 0;
    f.next = next;
    f.attack = null;
    f.queued = null;
  }

  function resolveEnemyHit(a) {
    let avoided;
    if (a.kind === 'haymaker') avoided = s.duckT > 0.05;
    else if (a.kind === 'hook') avoided = s.duckT > 0.05 || s.dodgeT > 0.05;
    else avoided = s.dodgeT > 0.05;
    if (avoided) {
      s.dodges++;
      s.score += a.kind === 'haymaker' ? 240 : 90;
      s.rush = clamp(s.rush + 12 * mods.momentum, 0, 100);
      emit('slip', { attack: a });
      return;
    }
    let dmg = a.damage * (1 + 0.08 * (s.foe.phase - 1)) * op.dmg * diff.dmg;
    let guarded = false;
    let broke = false;
    if (s.guard) {
      guarded = true;
      dmg *= 0.3 / (mods.guard * s.cornerGuard);
      s.stamina = Math.max(0, s.stamina - a.damage * 0.72);
      if (s.stamina <= 0) {
        s.guard = false;
        s.guardBlocked = true;
        broke = true;
        dmg *= 1.6;
      }
    }
    s.playerHp = Math.max(0, s.playerHp - dmg);
    cur().taken += dmg;
    s.playerHitT = 0.26;
    s.rush = Math.max(0, s.rush - 9);
    emit('hit', { attack: a, dmg, guarded, broke });
    if (s.playerHp <= 0) playerKnockdown();
  }

  function dropGuard() {
    s.guard = false;
    s.guardBlocked = true;
  }

  // ---- player verbs ---------------------------------------------------------------

  function punch(hand, body = false) {
    if (s.mode !== 'fight' || s.actionCd > 0 || s.stamina < 7) return false;
    dropGuard();
    const f = s.foe;
    s.stamina = Math.max(0, s.stamina - (body ? 9 : 7));
    s.actionCd = body ? 0.38 : 0.29;
    s.thrown++;
    const inCounter = f.mode === 'tell' && f.t < f.attack.window;
    const open = f.mode === 'recover' || inCounter || s.foeStun > 0;
    const landed = open && f.blockT <= 0;
    emit('punch', { hand, body, landed });
    if (!landed) {
      emit('blocked', { hand, body });
      return true;
    }
    const levelBonus = 1 + Math.min(0.12, (level - 1) * 0.012);
    let dmg = (body ? 7.2 : 6.0) * mods.power * s.cornerPower * levelBonus;
    if (inCounter) {
      dmg *= f.attack.counterMul ?? 1.9;
      s.counters++;
      s.foeStun = f.attack.kind === 'haymaker' ? 0.9 : 0.52;
      s.rush = clamp(s.rush + 22 * mods.momentum, 0, 100);
    } else {
      s.rush = clamp(s.rush + (body ? 7 : 6) * mods.momentum, 0, 100);
    }
    if (body && f.mode === 'recover') dmg *= 1.16;
    s.foeHp = Math.max(0, s.foeHp - dmg);
    cur().dealt += dmg;
    s.landed++;
    s.score += Math.round(dmg * 24) + (inCounter ? 250 : 0);
    s.foeHitT = 0.18;
    emit('land', { hand, body, dmg, counter: inCounter, attack: inCounter ? f.attack : null });
    if (s.foeHp <= 0) foeKnockdown();
    else if (!inCounter) f.blockT = 0.52 * op.block;
    return true;
  }

  function rush() {
    if (s.mode !== 'fight' || s.rush < 100 || s.actionCd > 0) return false;
    s.rush = 0;
    s.actionCd = 0.75;
    dropGuard();
    emit('rush', {});
    later(0.24, () => {
      if (s.mode !== 'fight') return;
      const dmg = 24 * mods.power * s.cornerPower;
      s.foeHp = Math.max(0, s.foeHp - dmg);
      cur().dealt += dmg;
      s.foeStun = 0.9;
      s.score += 900;
      s.landed += 3;
      s.thrown += 3;
      s.foeHitT = 0.18;
      emit('land', { hand: 1, body: false, dmg, counter: true, rush: true });
      if (s.foeHp <= 0) foeKnockdown();
    });
    return true;
  }

  function slip(dir) {
    if (s.mode !== 'fight' || s.dodgeT > 0) return false;
    dropGuard();
    s.dodgeT = 0.3 * mods.dodge;
    s.dodgeDir = dir < 0 ? -1 : 1;
    s.actionCd = Math.max(s.actionCd, 0.08);
    s.rush = clamp(s.rush + 1, 0, 100);
    emit('dodge', { dir: s.dodgeDir });
    return true;
  }

  function duck() {
    if (s.mode !== 'fight' || s.duckT > 0) return false;
    dropGuard();
    s.duckT = 0.34 * mods.dodge;
    emit('duck', {});
    return true;
  }

  /** Call every frame with whether guard is held. A dropped guard needs a fresh press. */
  function setGuard(held) {
    if (!held) {
      s.guard = false;
      s.guardBlocked = false;
      return;
    }
    s.guard = s.mode === 'fight' && !s.guardBlocked;
  }

  // ---- knockdowns, rounds, the end ------------------------------------------------

  function foeKnockdown() {
    if (s.mode !== 'fight') return;
    s.foeKD++;
    cur().fKD++;
    s.mode = 'foeDown';
    s.foe.mode = 'down';
    s.foe.queued = null;
    s.score += 1200;
    const final = s.foeKD >= 3;
    emit('foeDown', { kd: s.foeKD, final });
    if (final) {
      later(1.2, () => s.mode === 'foeDown' && finish(true, 'TKO — THREE KNOCKDOWNS', { ko: true }));
      return;
    }
    // The referee's count while he climbs back up.
    for (let n = 1; n <= 4; n++) later(n * 0.5 - 0.05, () => s.mode === 'foeDown' && emit('foeCount', { n }));
    later(2.1, () => {
      if (s.mode !== 'foeDown') return;
      s.foeHp = Math.round(foeMax * (s.foeKD === 1 ? 0.58 : 0.42));
      s.foe.phase = Math.min(3, s.foeKD + 1);
      foeIdle(0.8);
      s.foeStun = 0;
      s.mode = 'fight';
      emit('foeRise', {});
    });
  }

  function playerKnockdown() {
    if (s.mode !== 'fight') return;
    s.playerKD++;
    cur().pKD++;
    s.mode = 'playerDown';
    s.guard = false;
    s.dodgeT = s.duckT = 0;
    foeIdle(1.1);
    s.downFinal = s.playerKD >= 2;
    emit('playerDown', { kd: s.playerKD, final: s.downFinal });
    if (s.downFinal) {
      later(0.9, () => finish(false, 'REFEREE STOPPAGE'));
      return;
    }
    s.getupT = 5;
    s.getupCount = 0;
    s.getupOpen = false;
    later(0.65, () => {
      if (s.mode !== 'playerDown') return;
      s.getupOpen = true;
      emit('getupShow', { need: s.getupNeed });
    });
  }

  function getUpTap() {
    if (s.mode !== 'playerDown' || s.downFinal || !s.getupOpen) return false;
    s.getupCount++;
    emit('getupTap', { count: s.getupCount, need: s.getupNeed });
    if (s.getupCount >= s.getupNeed) {
      s.getupOpen = false;
      s.playerHp = 47;
      s.stamina = Math.min(staminaMax, 72);
      s.mode = 'fight';
      foeIdle(1.1);
      emit('playerRise', {});
    }
    return true;
  }

  function roundEnd() {
    if (s.mode !== 'fight') return;
    s.mode = 'corner';
    s.guard = false;
    s.dodgeT = s.duckT = s.actionCd = 0;
    foeIdle(0.9);
    emit('bell', {});
    if (s.round >= ROUNDS) {
      const cards = scoreCards(s.rounds);
      if (cards.player === cards.foe) finish(false, 'DRAW — THE JUDGES SPLIT', { cards, draw: true });
      else finish(cards.player > cards.foe, 'JUDGES DECISION', { cards });
      return;
    }
    emit('corner', { round: s.round });
  }

  function takeCorner(id) {
    if (s.mode !== 'corner') return false;
    if (id === 'power') s.cornerPower *= 1.08;
    if (id === 'stam') s.cornerStam *= 1.18;
    if (id === 'guard') s.cornerGuard *= 1.12;
    s.playerHp = Math.min(100, s.playerHp + 18);
    s.foeHp = Math.min(foeMax, s.foeHp + 10);
    s.stamina = staminaMax;
    s.round += 1;
    s.rounds.push({ dealt: 0, taken: 0, pKD: 0, fKD: 0 });
    s.time = ROUND_TIME;
    s.foe.phase = Math.max(s.foe.phase, s.round);
    s.foe.blockT = 0;
    s.foeStun = 0;
    foeIdle(0.9);
    s.mode = 'fight';
    emit('round', { round: s.round });
    return true;
  }

  function finish(win, reason, extra = {}) {
    if (s.mode === 'result') return;
    s.mode = 'result';
    s.guard = false;
    if (win && extra.ko) s.score += 1500;
    s.result = {
      win: !!win,
      draw: !!extra.draw,
      ko: !!extra.ko,
      reason,
      cards: extra.cards || null,
      opponent: op.id,
      difficulty: diff.id,
      landed: s.landed,
      thrown: s.thrown,
      counters: s.counters,
      dodges: s.dodges,
      score: s.score,
      foeKD: s.foeKD,
      playerKD: s.playerKD,
      time: s.fightTime,
      round: s.round,
    };
    timers = [];
    emit('end', { result: s.result });
  }

  function begin() {
    if (s.mode !== 'ready') return;
    s.mode = 'fight';
    s.time = ROUND_TIME;
    s.foe.next = 1.15;
    emit('round', { round: 1 });
  }

  /** Throw in the towel (quit from the pause menu): a loss, nothing banked. */
  function abandon() {
    timers = [];
    s.mode = 'result';
  }

  function update(dt) {
    if (s.mode === 'result' || s.mode === 'ready') return;
    tickTimers(dt);
    s.playerHitT = Math.max(0, s.playerHitT - dt);
    s.foeHitT = Math.max(0, s.foeHitT - dt);
    if (s.mode === 'playerDown') {
      if (!s.downFinal) {
        s.getupT -= dt;
        if (s.getupT <= 0 && s.getupCount < s.getupNeed) finish(false, 'TEN COUNT');
      }
      return;
    }
    if (s.mode !== 'fight') return;
    s.fightTime += dt;
    s.time -= dt;
    if (s.time <= 0) {
      s.time = 0;
      roundEnd();
      return;
    }
    s.actionCd = Math.max(0, s.actionCd - dt);
    s.dodgeT = Math.max(0, s.dodgeT - dt);
    s.duckT = Math.max(0, s.duckT - dt);
    s.foeStun = Math.max(0, s.foeStun - dt);
    s.foe.blockT = Math.max(0, s.foe.blockT - dt);
    const regen = (s.guard ? 8 : 20) * mods.stamRegen * s.cornerStam;
    s.stamina = Math.min(staminaMax, s.stamina + regen * dt);

    const f = s.foe;
    if (s.foeStun > 0) {
      if (f.mode !== 'stun') {
        f.mode = 'stun';
        f.queued = null;
        emit('stun', {});
      }
    } else if (f.mode === 'stun') {
      foeIdle(0.7);
    } else if (f.mode === 'idle') {
      f.next -= dt;
      if (f.next <= 0) startEnemyAttack();
    } else if (f.mode === 'tell') {
      f.t -= dt;
      if (f.t <= 0) {
        const a = f.attack;
        if (a.feint) {
          // The pull-back: a beat of nothing, then the real jab.
          f.mode = 'idle';
          f.next = 0.22;
          f.queued = 'jab';
          emit('feint', { attack: a });
        } else {
          f.mode = 'active';
          f.t = a.active;
          emit('attack', { attack: a });
          resolveEnemyHit(a);
        }
      }
    } else if (f.mode === 'active') {
      f.t -= dt;
      if (f.t <= 0) {
        if (f.attack.chain) startEnemyAttack(f.attack.chain, 0.5);
        else {
          f.mode = 'recover';
          f.t = f.attack.recover;
        }
      }
    } else if (f.mode === 'recover') {
      f.t -= dt;
      if (f.t <= 0) {
        const pressure = Math.max(0.52, 1.25 - 0.13 * s.round - 0.12 * (f.phase - 1)) * op.pressure;
        foeIdle(rand(pressure, pressure + 0.55));
      }
    }
  }

  return { state: s, opponent: op, difficulty: diff, mods, begin, update, punch, rush, slip, duck, setGuard, getUpTap, takeCorner, abandon };
}
