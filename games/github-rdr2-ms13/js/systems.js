// RED HARROW — gameplay systems. Pure logic, no engine dependency,
// so Node tests can import this module directly.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const HONOR_MIN = -8;
export const HONOR_MAX = 8;

export class Honor {
  constructor(v = 0) { this.v = clamp(Math.round(v), HONOR_MIN, HONOR_MAX); }
  add(n) { this.v = clamp(this.v + Math.round(n), HONOR_MIN, HONOR_MAX); return this.v; }
  rank() {
    if (this.v >= 6) return 'Saint of the Harrow';
    if (this.v >= 3) return 'Respected';
    if (this.v >= 1) return 'Liked';
    if (this.v === 0) return 'Unknown';
    if (this.v >= -2) return 'Shady';
    if (this.v >= -5) return 'Feared';
    return 'Terror of the Territory';
  }
  discount() { return this.v > 0 ? Math.min(this.v * 2, 25) : 0; } // % off shops
  priceHike() { return this.v < 0 ? Math.min(-this.v * 3, 40) : 0; } // % markup
}

export class Cores {
  constructor() {
    this.core = { health: 100, stamina: 100, focus: 100 };
    this.ring = { health: 100, stamina: 100, focus: 100 };
    this.xp = { health: 0, stamina: 0, focus: 0 };
  }
  drain(kind, amt) {
    let rest = amt;
    const fromRing = Math.min(this.ring[kind], rest);
    this.ring[kind] -= fromRing; rest -= fromRing;
    this.core[kind] = Math.max(0, this.core[kind] - rest);
    return this.core[kind] + this.ring[kind];
  }
  restore(kind, amt, toCore = false) {
    if (toCore) this.core[kind] = Math.min(100, this.core[kind] + amt);
    else this.ring[kind] = Math.min(100, this.ring[kind] + amt);
  }
  rest() {
    for (const k of Object.keys(this.core)) { this.core[k] = 100; this.ring[k] = 100; }
  }
  train(kind, amt) {
    this.xp[kind] += amt;
    while (this.xp[kind] >= 100) { this.xp[kind] -= 100; this.core[kind] = Math.min(125, this.core[kind] + 5); }
  }
  get health() { return this.core.health + this.ring.health; }
  get dead() { return this.core.health <= 0 && this.ring.health <= 0; }
}

export class Wanted {
  constructor() { this.stars = 0; this.bounties = {}; this.searchT = 0; this.county = 'Cinderfield'; }
  crime(county, level = 1) {
    this.county = county;
    this.stars = clamp(this.stars + level, 0, 5);
    this.bounties[county] = (this.bounties[county] || 0) + level * 25;
    this.searchT = 20 + level * 10;
  }
  tick(dt, hidden) {
    if (this.stars === 0) return;
    if (hidden) this.searchT -= dt * 2; else this.searchT -= dt * 0.25;
    if (this.searchT <= 0) { this.stars = 0; this.searchT = 0; }
  }
  pay(county, wallet) {
    const due = this.bounties[county] || 0;
    if (due <= 0 || wallet.cash < due) return false;
    wallet.cash -= due; this.bounties[county] = 0;
    if (this.county === county) this.stars = 0;
    return true;
  }
  get total() { return Object.values(this.bounties).reduce((a, b) => a + b, 0); }
}

export const FOCUS_LEVELS = [null, 'Instinct', 'Marking', 'Sustained', 'Vitals', 'Master'];
export class Focus {
  constructor() { this.level = 1; this.xp = 0; this.meter = 100; this.active = false; }
  gain(n) {
    this.xp += n;
    while (this.xp >= 100 && this.level < 5) { this.xp -= 100; this.level += 1; }
  }
  tagsAllowed() { return this.level >= 2 ? 2 + this.level : 1; } // L1: single auto-mark
  drain(dt) { this.meter = Math.max(0, this.meter - dt * (this.level >= 3 ? 18 : 26)); if (this.meter <= 0) this.active = false; }
  regen(dt) { if (!this.active) this.meter = Math.min(100, this.meter + dt * 8); }
}

export const LEDGER_LINES = ['medicine', 'provisions', 'ammunition', 'lodgings', 'fast travel', 'horse station', 'coop', 'leather tools'];
const LEDGER_COST = [50, 100, 150, 200, 250, 300, 350, 400];
export class CampLedger {
  constructor() { this.funds = 0; this.lines = Object.fromEntries(LEDGER_LINES.map((l) => [l, 0])); }
  donate(n, wallet) {
    const gave = Math.min(n, wallet.cash);
    wallet.cash -= gave; this.funds += gave; return gave;
  }
  cost(line) {
    const idx = LEDGER_LINES.indexOf(line);
    const rank = this.lines[line] || 0;
    if (rank >= 3 || idx < 0) return Infinity;
    return LEDGER_COST[idx] * (rank + 1);
  }
  buy(line) {
    const c = this.cost(line);
    if (!Number.isFinite(c) || this.funds < c) return false;
    this.funds -= c; this.lines[line] += 1; return true;
  }
  morale() {
    const ranks = Object.values(this.lines).reduce((a, b) => a + b, 0);
    return clamp(40 + ranks * 4 + Math.min(this.funds / 20, 20), 0, 100);
  }
}

export const BOND_NAMES = ['Wild-eyed', 'Steady', 'Trusting', 'Blood-bonded'];
export class HorseBond {
  constructor() { this.level = 1; this.xp = 0; }
  gain(n) {
    this.xp += n;
    while (this.xp >= 100 && this.level < 4) { this.xp -= 100; this.level += 1; }
  }
  perks() {
    const all = ['rear', 'skid stop', 'piaffe', 'drift'];
    return all.slice(0, this.level);
  }
  name() { return BOND_NAMES[this.level - 1]; }
}

export class Challenges {
  constructor() { this.rank = {}; }
  advance(setId) { this.rank[setId] = Math.min((this.rank[setId] || 0) + 1, 10); return this.rank[setId]; }
  total() { return Object.values(this.rank).reduce((a, b) => a + b, 0); }
}

// ---- Cards: 5-card draw evaluation (simplified poker) + blackjack ----
const RANKS = '23456789TJQKA';
export function cardRank(card) { return RANKS.indexOf(card[0]); }
export function pokerScore(hand) {
  // Returns [category, tiebreak...]; higher wins. Categories: 0 high .. 8 straight flush.
  const rs = hand.map(cardRank).sort((a, b) => a - b);
  const flush = hand.every((c) => c[1] === hand[0][1]);
  let straightHigh = -1;
  if (rs[4] - rs[0] === 4 && new Set(rs).size === 5) straightHigh = rs[4];
  else if (String(rs) === '0,1,2,3,12') straightHigh = 3; // wheel
  const counts = {};
  for (const r of rs) counts[r] = (counts[r] || 0) + 1;
  const groups = Object.entries(counts).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  if (flush && straightHigh >= 0) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, groups[0][1], groups[1][1]];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, groups[0][1], groups[1][1]];
  if (flush) return [5, ...rs.slice().reverse()];
  if (straightHigh >= 0) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, groups[0][1], ...groups.slice(1).map((g) => g[1]).sort((a, b) => b - a)];
  if (groups[0][0] === 2 && groups[1][0] === 2) {
    const pairs = [groups[0][1], groups[1][1]].sort((a, b) => b - a);
    return [2, ...pairs, groups[2][1]];
  }
  if (groups[0][0] === 2) return [1, groups[0][1], ...groups.slice(1).map((g) => g[1]).sort((a, b) => b - a)];
  return [0, ...rs.slice().reverse()];
}
export function pokerWinner(a, b) {
  const sa = pokerScore(a); const sb = pokerScore(b);
  for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
    if ((sa[i] || 0) !== (sb[i] || 0)) return sa[i] > sb[i] ? 1 : -1;
  }
  return 0;
}
export function newDeck() {
  const d = [];
  for (const r of RANKS) for (const s of 'HDCS') d.push(r + s);
  return d;
}
export function shuffled(deck, rand = Math.random) {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function blackjackValue(cards) {
  let total = 0; let aces = 0;
  for (const c of cards) {
    const r = cardRank(c);
    if (r === 12) { aces += 1; total += 11; }
    else total += Math.min(r + 2, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces -= 1; }
  return total;
}

// ---- Save data ----
export function freshSave() {
  return {
    mission: 0, cash: 60, honor: 0, chapter: 1,
    focusXp: 0, focusLevel: 1, bondXp: 0, bondLevel: 1,
    ledger: { funds: 0, lines: Object.fromEntries(LEDGER_LINES.map((l) => [l, 0])) },
    challenges: {}, relics: 0, strangersDone: [],
    cores: null, // null = full
  };
}
