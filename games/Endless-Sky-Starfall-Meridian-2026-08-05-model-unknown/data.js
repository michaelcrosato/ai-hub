// Starfall Meridian — game data: systems, goods, outfits, enemies, story and the save shape.
// Balance numbers for the original content are unchanged from the first release.

// Same key as the original build, so existing captains carry over.
export const SAVE_KEY = 'starfall-meridian-save-v1';

export const SYSTEMS = [
  {
    id: 'helion',
    name: 'Helion Reach',
    station: 'Meridian Gate',
    faction: 'Accord Transit Authority',
    danger: 'GUARDED',
    tint: 0x68e6ff,
    planet: 0x2f7e9a,
    mapX: 19,
    mapY: 55,
    prices: { medicine: 420, alloy: 260, cores: 1120, luxuries: 880 },
  },
  {
    id: 'cinderwake',
    name: 'Cinderwake',
    station: 'Ember Relay',
    faction: 'Independent Prospectors',
    danger: 'HIGH',
    tint: 0xff9b62,
    planet: 0x9f4636,
    mapX: 43,
    mapY: 38,
    prices: { medicine: 760, alloy: 150, cores: 1340, luxuries: 640 },
  },
  {
    id: 'vesper',
    name: 'Vesper Loom',
    station: 'Lattice Nine',
    faction: 'Orison Combine',
    danger: 'LOW',
    tint: 0xa595ff,
    planet: 0x5d4d91,
    mapX: 70,
    mapY: 24,
    prices: { medicine: 530, alloy: 320, cores: 740, luxuries: 1180 },
  },
  {
    id: 'morrow',
    name: 'Morrow Drift',
    station: 'Coldwater Anchorage',
    faction: "Free Captains' Compact",
    danger: 'UNKNOWN',
    tint: 0x77ffc8,
    planet: 0x417c66,
    mapX: 76,
    mapY: 72,
    prices: { medicine: 680, alloy: 210, cores: 980, luxuries: 1460 },
  },
  {
    id: 'chorus',
    name: 'Chorus Line',
    station: 'Canticle Port',
    faction: 'Accord Navy',
    danger: 'GUARDED',
    tint: 0xffd279,
    planet: 0x9d824c,
    mapX: 51,
    mapY: 79,
    prices: { medicine: 390, alloy: 440, cores: 890, luxuries: 910 },
  },
];

/** The lanes drawn on the sector map. Jumps may go anywhere; lanes set job distances. */
export const LANES = [
  ['helion', 'cinderwake'],
  ['cinderwake', 'vesper'],
  ['cinderwake', 'morrow'],
  ['helion', 'chorus'],
  ['chorus', 'morrow'],
];

export function systemById(id) {
  return SYSTEMS.find((s) => s.id === id) ?? SYSTEMS[0];
}

/** Lane hops between two systems (1 when adjacent), for job pay. */
export function hops(a, b) {
  if (a === b) return 0;
  const seen = new Set([a]);
  let frontier = [a];
  for (let d = 1; d <= SYSTEMS.length; d++) {
    const next = [];
    for (const s of frontier) {
      for (const [x, y] of LANES) {
        const n = x === s ? y : y === s ? x : null;
        if (!n || seen.has(n)) continue;
        if (n === b) return d;
        seen.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return 3;
}

export const COMMODITIES = [
  { id: 'medicine', name: 'Field medicine', note: 'Frontier shortage' },
  { id: 'alloy', name: 'Refined alloy', note: 'Industrial feedstock' },
  { id: 'cores', name: 'Quantum cores', note: 'High-value tech' },
  { id: 'luxuries', name: 'Earth luxuries', note: 'Volatile demand' },
];

/** Local news rolled on arrival: one commodity runs short (dearer) or floods in (cheaper). */
export const NEWS = {
  medicine: { short: 'Fever outbreak on the lower decks', glut: 'Relief convoy docked early' },
  alloy: { short: 'Refinery fire halts the smelters', glut: 'Ore haulers flood the yards' },
  cores: { short: 'The Navy requisitions every core', glut: 'Salvagers crack a derelict core bay' },
  luxuries: { short: 'Festival week drains the lounges', glut: 'Customs auction clears seized goods' },
};

export const UPGRADES = [
  { id: 'thrusters', name: 'Raptor ion vanes', description: '+18% thrust and tighter turn response', price: 5200 },
  { id: 'shield', name: 'Warden shield lattice', description: '+25 shield capacity and faster recovery', price: 6400 },
  { id: 'weapons', name: 'Twin pulse repeater', description: '+35% bolt damage, +12% heat generation', price: 7800 },
  { id: 'cargo', name: 'Foldspace cargo rack', description: '+12 tonnes of cargo capacity', price: 4600 },
  { id: 'hull', name: 'Ashforged hull plating', description: '+30 hull integrity for the long fights', price: 6900 },
  { id: 'capacitor', name: 'Lumen translation capacitor', description: 'Charges jumps 40% faster, even at cruise speed', price: 5600 },
];

/**
 * Enemy classes. Corsair numbers are the original ones; the Lancer and the
 * Ember Crown flagship are new. far/near: approach and back-off ranges,
 * orbit: sideways speed when close, cap: top speed.
 */
export const ENEMY_TYPES = {
  corsair: {
    name: 'Ember Corsair',
    hp: 3,
    hpCinder: 3.5,
    bounty: 480,
    scale: 0.82,
    hitR2: 22,
    far: 76,
    approach: 18,
    near: 44,
    retreat: 8,
    drift: 3,
    orbit: 11,
    cap: 26,
    agility: 0.85,
    range: 175,
    cooldown: [1.25, 0.85],
    shots: 1,
    spread: 0,
    boltSpeed: 72,
    damage: [9, 5],
  },
  lancer: {
    name: 'Ember Lancer',
    hp: 2,
    hpCinder: 2.4,
    bounty: 360,
    scale: 0.62,
    hitR2: 16,
    far: 60,
    approach: 26,
    near: 30,
    retreat: 12,
    drift: 4,
    orbit: 18,
    cap: 38,
    agility: 1.3,
    range: 150,
    cooldown: [1.7, 0.8],
    shots: 2,
    burstGap: 0.12,
    spread: 0,
    boltSpeed: 84,
    damage: [6, 3],
  },
  crown: {
    name: 'Ember Crown',
    hp: 45,
    hpCinder: 45,
    bounty: 0,
    scale: 2.5,
    hitR2: 120,
    far: 110,
    approach: 10,
    near: 70,
    retreat: 6,
    drift: 2,
    orbit: 5,
    cap: 14,
    agility: 0.5,
    range: 220,
    cooldown: [2.3, 0.6],
    shots: 5,
    spread: 0.36,
    boltSpeed: 66,
    damage: [8, 3],
  },
};

/** How many raiders a system keeps in the field, and how many are there on arrival. */
export const DANGER = {
  LOW: { cap: 3, initial: 2, lancer: 0.15, pay: 0.9 },
  GUARDED: { cap: 3, initial: 2, lancer: 0.15, pay: 1 },
  HIGH: { cap: 5, initial: 5, lancer: 0.35, pay: 1.35 },
  UNKNOWN: { cap: 3, initial: 4, lancer: 0.35, pay: 1.5 },
};

export const DIFFICULTIES = [
  { id: 'relaxed', name: 'Relaxed', damage: 0.6, cooldown: 1.3, hp: 0.85, capDelta: -1 },
  { id: 'standard', name: 'Standard', damage: 1, cooldown: 1, hp: 1, capDelta: 0 },
  { id: 'veteran', name: 'Veteran', damage: 1.35, cooldown: 0.8, hp: 1.25, capDelta: 0 },
];

export const RANKS = [
  [0, 'Unlisted'],
  [12, 'Freelancer'],
  [30, 'Wingrunner'],
  [60, 'Corridor Ace'],
  [100, 'Meridian Legend'],
];

export const JOB_CARGO = ['relief kits', 'survey drones', 'sealed ledgers', 'reactor seals', 'seed vaults', 'medical cold-chain'];

export const STORY_REWARD = { run: 6500, screen: 4800, morrow: 12000 };

export function freshState() {
  return {
    version: 2,
    credits: 18200,
    shield: 100,
    hull: 100,
    energy: 100,
    heat: 0,
    cargo: { medicine: 4, alloy: 0, cores: 0, luxuries: 0 },
    cargoCap: 24,
    system: 'helion',
    route: 'cinderwake',
    kills: 0,
    missionDelivered: false,
    bountyClaimed: false,
    upgrades: [],
    sound: true,
    flightMinutes: 0,
    // Added in the kit upgrade.
    difficulty: 1,
    morrow: 0, // 0 locked · 1 hunting the Ember Crown · 2 report to Coldwater · 3 reported
    allegiance: null, // 'accord' | 'compact'
    market: {}, // system → commodity → price factor (0.7..1.35)
    news: null, // { system, com, mult, text } for the current visit
    visits: 0,
    board: null, // { system, visit, offers: [] }
    jobs: [],
    jobsDone: 0,
    salvage: 0,
  };
}

/** Merge a stored save over fresh defaults, dropping anything malformed. */
export function loadState(raw) {
  const base = freshState();
  if (!raw || typeof raw !== 'object') return base;
  const out = { ...base, ...raw };
  out.cargo = { ...base.cargo };
  for (const c of COMMODITIES) out.cargo[c.id] = Math.max(0, Math.floor(Number(raw.cargo?.[c.id]) || 0));
  out.upgrades = Array.isArray(raw.upgrades) ? raw.upgrades.filter((u) => UPGRADES.some((x) => x.id === u)) : [];
  const validJob = (j) =>
    j &&
    typeof j.id === 'string' &&
    Number.isFinite(+j.reward) &&
    ((j.type === 'courier' && SYSTEMS.some((s) => s.id === j.dest) && Number.isFinite(+j.tons)) ||
      (j.type === 'bounty' && SYSTEMS.some((s) => s.id === j.target) && Number.isFinite(+j.count)));
  out.jobs = Array.isArray(raw.jobs) ? raw.jobs.filter(validJob).slice(0, 3) : [];
  for (const j of out.jobs) if (j.type === 'bounty') j.progress = Math.max(0, Math.floor(+j.progress || 0));
  out.board =
    raw.board && typeof raw.board === 'object' && Array.isArray(raw.board.offers)
      ? { system: raw.board.system, visit: raw.board.visit, offers: raw.board.offers.filter(validJob) }
      : null;
  out.market = {};
  if (raw.market && typeof raw.market === 'object') {
    for (const s of SYSTEMS) {
      const m = raw.market[s.id];
      if (!m || typeof m !== 'object') continue;
      for (const c of COMMODITIES) {
        const f = +m[c.id];
        if (Number.isFinite(f)) (out.market[s.id] ??= {})[c.id] = Math.min(1.35, Math.max(0.7, f));
      }
    }
  }
  const n = raw.news;
  out.news =
    n && typeof n.text === 'string' && COMMODITIES.some((c) => c.id === n.com) && Number.isFinite(+n.mult)
      ? { system: n.system, com: n.com, mult: +n.mult, text: n.text }
      : null;
  if (!SYSTEMS.some((s) => s.id === out.system)) out.system = base.system;
  if (!SYSTEMS.some((s) => s.id === out.route)) out.route = out.system;
  for (const k of ['credits', 'shield', 'hull', 'energy', 'heat', 'kills', 'flightMinutes', 'cargoCap', 'jobsDone', 'salvage', 'visits', 'morrow', 'difficulty']) {
    out[k] = Number.isFinite(+out[k]) ? +out[k] : base[k];
  }
  out.difficulty = Math.max(0, Math.min(DIFFICULTIES.length - 1, Math.round(out.difficulty)));
  out.morrow = Math.max(0, Math.min(3, Math.round(out.morrow)));
  if (out.allegiance !== 'accord' && out.allegiance !== 'compact') out.allegiance = null;
  if (out.hull <= 0) out.hull = 100;
  out.version = 2;
  return out;
}

/** Small seeded generator for the job board (same offers for the same visit). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
