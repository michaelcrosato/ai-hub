import { SYSTEMS, SYSTEM, SHIP, OUTFIT, CAMPAIGN, SIDE_QUESTS, COMMODITIES } from './content.js';
export const SAVE_KEY = 'starlight-drifter.save.v1';
export const SETTINGS_KEY = 'starlight-drifter.settings.v1';
export const RECORDS_KEY = 'starlight-drifter.records.v1';
const ORE_NAME = { heavy: 'Heavy Metals', gems: 'Gems' };
/** Finished campaigns on this device, fastest first (minutes of flight time). */
export function readRecords(storage) {
  try {
    const list = JSON.parse(storage?.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((r) => r && Number.isFinite(r.minutes) && typeof r.name === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const money = (n) => Math.round(n).toLocaleString('en-US');
export const hash = (s) => {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};
export function rng(seed) {
  let s = hash(seed);
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function stats(s) {
  const base = SHIP[s.ship] || SHIP.shuttle;
  const r = {
    ...base,
    damage: 10 + base.guns * 3,
    energy: 100,
    regen: 23,
    cooling: 19,
    fuel: 4,
    launcher: 0,
    boost: 0,
    scoop: 0,
    scanner: 0,
    antimissile: 0,
    jump: 0,
    used: 0,
  };
  for (const [id, count] of Object.entries(s.outfits || {})) {
    const o = OUTFIT[id];
    if (!o) continue;
    r[o.stat] = (r[o.stat] || 0) + o.value * count;
    r.used += o.space * count;
  }
  r.speed -= (s.outfits?.hull || 0) * 0.7;
  r.thrust += (s.outfits?.engine || 0) * 4;
  r.heatPerShot = 5 + (s.outfits?.heavyLaser || 0) * 3 + (s.outfits?.plasma || 0) * 5 + (s.outfits?.electron || 0) * 3;
  r.energyPerShot = 5 + (s.outfits?.heavyLaser || 0) * 2 + (s.outfits?.plasma || 0) * 4 + (s.outfits?.electron || 0) * 3;
  return r;
}
export function newState(ship = 'shuttle', name = 'Captain') {
  if (!SHIP[ship]?.starter) ship = 'shuttle';
  return {
    version: 1,
    name: name.trim().slice(0, 24) || 'Captain',
    ship,
    system: 'rutilicus',
    day: 1,
    credits: 3400,
    debt: 12500,
    cargo: {},
    outfits: { laser: 1 },
    ammo: 0,
    crew: 3,
    escorts: [],
    fleetOrder: 'defend',
    hull: SHIP[ship].hull,
    shield: SHIP[ship].shield,
    fuel: 4,
    energy: 100,
    heat: 0,
    story: 0,
    activeStory: false,
    storyProgress: 0,
    jumpVoucher: false,
    choice: 'independent',
    jobs: [],
    side: [],
    sideDone: [],
    visited: ['rutilicus'],
    surveyed: [],
    completedJobs: [],
    reputation: { Republic: 0, 'Free Worlds': 0, Syndicate: 0, Hai: 0, Wanderer: 0 },
    kills: 0,
    boarded: 0,
    mined: 0,
    earned: 0,
    jumps: 0,
    playTime: 0,
    ended: false,
    lastDock: 'rutilicus',
    docked: true,
    log: [],
    achievements: [],
    position: { x: 0, z: 18, angle: 0 },
  };
}
export function cargoUsed(s) {
  return (
    Object.values(s.cargo).reduce((a, b) => a + b, 0) +
    s.jobs.reduce((a, j) => a + (j.cargo || 0), 0) +
    s.side.reduce((a, j) => a + (j.cargo || 0), 0) +
    (s.activeStory ? CAMPAIGN[s.story]?.cargo || 0 : 0)
  );
}
export function bunksUsed(s) {
  return s.jobs.reduce((a, j) => a + (j.passengers || 0), 0) + (s.activeStory ? CAMPAIGN[s.story]?.passengers || 0 : 0);
}
export function price(id, system, day = 1) {
  const c = COMMODITIES.find((c) => c.id === id);
  if (!c) return 0;
  const e = SYSTEM[system]?.economy;
  const mods = {
    agricultural: { food: 0.56, medical: 0.84, equipment: 1.28, electronics: 1.25 },
    industrial: { equipment: 0.68, plastic: 0.72, electronics: 0.76, metal: 1.3, food: 1.13 },
    mining: { metal: 0.62, heavy: 0.66, gems: 0.73, medical: 1.3, equipment: 1.2 },
    capital: { food: 1.45, luxury: 1.38, clothing: 1.32, heavy: 1.14 },
    research: { electronics: 1.35, medical: 0.68, heavy: 1.28, gems: 1.3 },
    outlaw: { luxury: 0.78, medical: 1.4, equipment: 1.3 },
  };
  const wobble = 0.94 + (hash(id + system) % 13) / 100 + Math.sin(day * 0.23 + (hash(system) % 11)) * 0.025;
  return Math.round(c.base * (mods[e]?.[id] || 1) * wobble);
}
export function canAccess(s, id) {
  return !!SYSTEM[id] && (!SYSTEM[id].alien || stats(s).jump > 0);
}
export function route(from, to, s) {
  if (from === to) return [];
  if (!canAccess(s, to)) return null;
  const drive = stats(s).jump > 0;
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const p = queue.shift(),
      current = SYSTEM[p.at(-1)],
      links = [...current.links];
    if (drive)
      for (const candidate of SYSTEMS)
        if (
          candidate.id !== current.id &&
          Math.hypot(candidate.map[0] - current.map[0], candidate.map[1] - current.map[1]) <= 32 &&
          !links.includes(candidate.id)
        )
          links.push(candidate.id);
    for (const next of links) {
      if (seen.has(next) || !canAccess(s, next)) continue;
      const n = [...p, next];
      if (next === to) return n.slice(1);
      seen.add(next);
      queue.push(n);
    }
  }
  return null;
}
export function jobsAt(s) {
  const candidates = SYSTEMS.filter((x) => x.id !== s.system && !x.alien && x.id !== 'epsilon');
  const r = rng(`${s.system}:${Math.floor(s.day / 3)}`);
  const list = Array.from({ length: 5 }, (_, i) => {
    const to = candidates[Math.floor(r() * candidates.length)].id;
    const hops = route(s.system, to, s)?.length || 2;
    const type = ['delivery', 'passengers', 'bounty', 'delivery', 'passengers'][i];
    const id = `${s.system}-${Math.floor(s.day / 3)}-${i}`;
    return {
      id,
      from: s.system,
      to,
      kind: type,
      cargo: type === 'delivery' ? Math.ceil(r() * 8) + 3 : 0,
      passengers: type === 'passengers' ? Math.ceil(r() * 3) : 0,
      reward: Math.round((1000 + hops * 740 + (type === 'bounty' ? 1700 : 0)) / 100) * 100,
      enemies: type === 'bounty' ? 2 : 0,
      progress: 0,
      name: type === 'delivery' ? 'Priority freight' : type === 'passengers' ? 'Passenger passage' : 'Pirate interdiction',
      text:
        type === 'delivery'
          ? 'Deliver a sealed consignment. Keep enough cargo space for your accepted contracts.'
          : type === 'passengers'
            ? 'Safe passage for a small group of travelers. Payment on landing.'
            : 'Disable or destroy two marked raiders at the destination, then land to collect.',
    };
  });
  // A sixth offer: an ore consignment. Every system's asteroid field can be mined for it.
  {
    const to = candidates[Math.floor(r() * candidates.length)].id;
    const gems = r() < 0.35;
    const amount = gems ? 2 + Math.floor(r() * 3) : 6 + Math.floor(r() * 7);
    const hops = route(s.system, to, s)?.length || 2;
    list.push({
      id: `${s.system}-${Math.floor(s.day / 3)}-5`,
      from: s.system,
      to,
      kind: 'ore',
      ore: gems ? 'gems' : 'heavy',
      amount,
      cargo: 0,
      passengers: 0,
      enemies: 0,
      progress: 0,
      reward: Math.round((amount * (gems ? 1900 : 1150) + hops * 450) / 100) * 100,
      name: gems ? 'Gem consignment' : 'Ore consignment',
      text: `Mine ${amount} t of ${gems ? 'gems' : 'heavy metals'} from asteroid fields and land with them at the destination. Shoot rocks apart and fly over the ore to collect it.`,
    });
  }
  return list.filter((j) => !s.jobs.some((a) => a.id === j.id) && !s.completedJobs.includes(j.id));
}
export const oreName = (id) => ORE_NAME[id] || 'Ore';
/** Side expeditions offered at the current port: not started, not finished, unlocked by the campaign or an earlier expedition. */
export function sideOffers(s) {
  return SIDE_QUESTS.filter(
    (q) =>
      q.from === s.system &&
      !s.sideDone.includes(q.id) &&
      !s.side.some((x) => x.id === q.id) &&
      (!q.unlock || s.story >= q.unlock) &&
      (!q.requires || s.sideDone.includes(q.requires)),
  );
}
export function validateState(x) {
  if (!x || x.version !== 1 || !SHIP[x.ship] || !SYSTEM[x.system]) throw new Error('That file is not a compatible captain’s log.');
  const s = { ...newState(x.ship, x.name || 'Captain'), ...x };
  for (const key of [
    'credits',
    'debt',
    'day',
    'story',
    'storyProgress',
    'fuel',
    'hull',
    'shield',
    'energy',
    'heat',
    'ammo',
    'crew',
    'kills',
    'boarded',
    'mined',
    'earned',
    'jumps',
    'playTime',
  ]) {
    if (!Number.isFinite(s[key]) || s[key] < 0) throw new Error(`Invalid saved ${key}.`);
  }
  if (s.story > CAMPAIGN.length || !Number.isInteger(s.story)) throw new Error('Invalid story chapter.');
  if (!Array.isArray(s.jobs) || !Array.isArray(s.side) || !Array.isArray(s.escorts) || !Array.isArray(s.visited))
    throw new Error('Incomplete captain’s log.');
  s.cargo = Object.fromEntries(
    Object.entries(s.cargo || {}).filter(([k, n]) => COMMODITIES.some((c) => c.id === k) && Number.isInteger(n) && n >= 0),
  );
  s.outfits = Object.fromEntries(
    Object.entries(s.outfits || {}).filter(([k, n]) => OUTFIT[k] && Number.isInteger(n) && n >= 0 && n <= OUTFIT[k].max),
  );
  s.escorts = s.escorts.filter((e) => SHIP[e.ship] && Number.isFinite(e.hull) && e.hull > 0).slice(0, 5);
  s.jobs = s.jobs.filter((j) => SYSTEM[j.to] && Number.isFinite(j.reward) && j.reward >= 0).slice(0, 8);
  s.side = s.side.filter((j) => SIDE_QUESTS.some((q) => q.id === j.id));
  s.sideDone = (s.sideDone || []).filter((id) => SIDE_QUESTS.some((q) => q.id === id));
  s.visited = [...new Set(s.visited.filter((id) => SYSTEM[id]))];
  s.log = Array.isArray(s.log) ? s.log.slice(-80) : [];
  s.completedJobs = Array.isArray(s.completedJobs) ? s.completedJobs.slice(-120) : [];
  s.reputation = { ...newState().reputation, ...s.reputation };
  const st = stats(s);
  if (st.used > st.slots) throw new Error('Saved outfits exceed the ship’s capacity.');
  s.hull = clamp(s.hull, 0, st.hull);
  s.shield = clamp(s.shield, 0, st.shield);
  s.fuel = clamp(s.fuel, 0, st.fuel);
  s.position = s.position && Number.isFinite(s.position.x) && Number.isFinite(s.position.z) ? s.position : { x: 0, z: 18, angle: 0 };
  s.name = String(s.name).slice(0, 24);
  s.activeStory = !!s.activeStory && s.story < CAMPAIGN.length;
  s.docked = !!s.docked;
  s.ended = s.story >= CAMPAIGN.length;
  s.jumpVoucher = !!s.jumpVoucher;
  s.convoyLost = !!s.convoyLost;
  if (!SYSTEM[s.lastDock]) s.lastDock = 'rutilicus';
  if (!['defend', 'attack', 'hold'].includes(s.fleetOrder)) s.fleetOrder = 'defend';
  s.achievements = Array.isArray(s.achievements) ? s.achievements.filter((x) => typeof x === 'string').slice(0, 20) : [];
  s.surveyed = Array.isArray(s.surveyed) ? s.surveyed.filter((id) => SYSTEM[id]) : [];
  s.position.angle = Number.isFinite(s.position.angle) ? s.position.angle : 0;
  for (const j of s.jobs) {
    if (!['delivery', 'passengers', 'bounty', 'ore'].includes(j.kind) || !SYSTEM[j.from] || typeof j.id !== 'string')
      throw new Error('Invalid saved contract.');
    if (j.kind === 'ore' && (!ORE_NAME[j.ore] || !Number.isInteger(j.amount) || j.amount <= 0)) throw new Error('Invalid saved ore contract.');
    for (const k of ['cargo', 'passengers', 'enemies', 'progress'])
      if (!Number.isFinite(j[k] ?? 0) || !Number.isInteger(j[k] ?? 0) || (j[k] ?? 0) < 0)
        throw new Error('Invalid saved contract capacity.');
  }
  s.side = s.side.map((q) => {
    const base = SIDE_QUESTS.find((x) => x.id === q.id);
    const cap = base.kind === 'hunt' ? base.enemies : 1;
    return { ...base, progress: clamp(Math.floor(Number(q.progress) || 0), 0, cap) };
  });
  if (cargoUsed(s) > st.cargo || bunksUsed(s) > st.bunks) throw new Error('Saved contracts exceed the ship’s capacity.');
  return s;
}
export class Model {
  constructor(state = newState(), notify = () => {}) {
    this.s = state;
    this.notify = notify;
    this.storage = null;
  }
  get st() {
    return stats(this.s);
  }
  get quest() {
    return CAMPAIGN[this.s.story];
  }
  tell(text, type = 'info') {
    this.s.log.push({ day: this.s.day, text });
    this.s.log = this.s.log.slice(-80);
    this.notify(text, type);
  }
  reward(amount, text) {
    this.s.credits += amount;
    this.s.earned += amount;
    this.tell(`${text} +${money(amount)} credits`, 'reward');
  }
  save() {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.s));
      return true;
    } catch {
      this.notify('Local storage is full or unavailable. Export your save from Options.', 'warn');
      return false;
    }
  }
  trade(id, amount) {
    if (!this.s.docked) return 'Land at a port to trade.';
    if (!COMMODITIES.some((c) => c.id === id) || !Number.isInteger(amount) || !amount) return 'Invalid trade.';
    const p = price(id, this.s.system, this.s.day),
      held = this.s.cargo[id] || 0;
    if (amount > 0) {
      if (this.s.credits < p * amount) return 'Not enough credits.';
      if (cargoUsed(this.s) + amount > this.st.cargo) return 'Your cargo hold is full.';
    } else if (held < -amount) return 'Not enough cargo to sell.';
    this.s.credits -= p * amount;
    this.s.cargo[id] = held + amount;
    if (!this.s.cargo[id]) delete this.s.cargo[id];
    this.save();
    return null;
  }
  buyOutfit(id) {
    const o = OUTFIT[id];
    if (!this.s.docked || !o) return 'Visit an outfitter first.';
    if (o.unlock && this.s.story < o.unlock) return 'This equipment is not yet available.';
    if (o.alien && !SYSTEM[this.s.system].alien) return 'Available from alien outfitters only.';
    if ((this.s.outfits[id] || 0) >= o.max) return 'Maximum installation reached.';
    if (this.st.used + o.space > this.st.slots) return 'Not enough outfit space. Remove equipment or buy a larger ship.';
    const cost = id === 'jump' && this.s.jumpVoucher ? 0 : o.cost;
    if (this.s.credits < cost) return 'Not enough credits.';
    if (id === 'jump' && this.s.jumpVoucher) this.s.jumpVoucher = false;
    this.s.credits -= cost;
    this.s.outfits[id] = (this.s.outfits[id] || 0) + 1;
    this.service(false);
    this.save();
    return null;
  }
  sellOutfit(id) {
    const o = OUTFIT[id];
    if (!this.s.docked || !o || !this.s.outfits[id]) return 'No installed outfit to remove.';
    const copy = structuredClone(this.s);
    copy.outfits[id]--;
    if (stats(copy).cargo < cargoUsed(copy) || stats(copy).bunks < bunksUsed(copy))
      return 'Unload cargo or finish passenger contracts first.';
    this.s.outfits[id]--;
    if (!this.s.outfits[id]) delete this.s.outfits[id];
    this.s.credits += Math.round(o.cost * 0.7);
    this.service(false);
    this.save();
    return null;
  }
  buyShip(id, escort = false) {
    const ship = SHIP[id];
    if (!this.s.docked || !ship || ship.starter) return 'That ship is not for sale here.';
    if (ship.unlock && this.s.story < ship.unlock) return 'Complete more of the campaign to unlock this ship.';
    if (ship.alien && !SYSTEM[this.s.system].alien) return 'This ship is available in alien space only.';
    const tradeIn = escort ? 0 : Math.round((SHIP[this.s.ship].price || 4500) * 0.6);
    const cost = ship.price - tradeIn;
    if (this.s.credits < cost) return 'Not enough credits.';
    if (escort) {
      if (this.s.escorts.length >= 5) return 'Fleet limit: five escorts.';
      this.s.credits -= cost;
      this.s.escorts.push({ id: `escort-${this.s.day}-${this.s.escorts.length}-${hash(id + this.s.credits)}`, ship: id, hull: ship.hull });
    } else {
      const next = { ...this.s, ship: id };
      const st = stats(next);
      if (st.used > st.slots) return 'Remove some outfits before changing ships.';
      if (cargoUsed(next) > st.cargo || bunksUsed(next) > st.bunks) return 'Your active cargo or passengers will not fit.';
      this.s.credits -= cost;
      this.s.ship = id;
      this.service();
    }
    this.tell(`${ship.name} ${escort ? 'added to your fleet' : 'is your new flagship'}.`, 'reward');
    this.save();
    return null;
  }
  buyAmmo() {
    if (!this.s.docked) return 'Land to rearm.';
    if (!this.st.launcher) return 'Install a Meteor Missile Launcher first.';
    if (this.s.credits < 600) return 'Not enough credits.';
    this.s.credits -= 600;
    this.s.ammo += 10;
    this.save();
    return null;
  }
  hire() {
    if (!this.s.docked) return 'Land to hire crew.';
    if (this.s.credits < 350) return 'Not enough credits.';
    if (this.s.crew >= 30) return 'Crew complement full.';
    this.s.credits -= 350;
    this.s.crew++;
    this.save();
    return null;
  }
  payDebt(amount) {
    amount = Math.min(Math.floor(amount), this.s.debt);
    if (!Number.isFinite(amount) || amount <= 0) return 'No payment due.';
    if (amount > this.s.credits) return 'Not enough credits.';
    this.s.credits -= amount;
    this.s.debt -= amount;
    if (this.s.debt === 0) {
      this.tell('Your ship is yours. Mortgage paid in full.', 'reward');
      this.achievement('Free and clear');
    }
    this.save();
    return null;
  }
  borrow() {
    if (this.s.debt >= 22000) return 'The bank cannot extend further credit.';
    this.s.debt += 5000;
    this.s.credits += 5000;
    this.save();
    return null;
  }
  nextDay() {
    this.s.day++;
    const interest = Math.ceil(this.s.debt * 0.0015);
    const due = Math.min(150, this.s.debt + interest);
    if (this.s.debt > 0) {
      this.s.debt += interest;
      if (this.s.credits >= due) {
        this.s.credits -= due;
        this.s.debt -= due;
      }
    }
    const wages = this.s.escorts.length * 25 + Math.max(0, this.s.crew - 3) * 4;
    this.s.credits = Math.max(0, this.s.credits - wages);
  }
  acceptJob(id) {
    const j = jobsAt(this.s).find((x) => x.id === id);
    if (!j || !this.s.docked) return 'This contract is no longer available.';
    if (this.s.jobs.length >= 6) return 'Finish a contract before taking more.';
    if (cargoUsed(this.s) + j.cargo > this.st.cargo) return 'Not enough free cargo space.';
    if (bunksUsed(this.s) + j.passengers > this.st.bunks) return 'Not enough passenger berths.';
    this.s.jobs.push(j);
    this.tell(`Contract accepted: ${j.name} to ${SYSTEM[j.to].name}.`);
    this.save();
    return null;
  }
  abandonJob(id) {
    const i = this.s.jobs.findIndex((j) => j.id === id);
    if (i < 0) return;
    this.s.jobs.splice(i, 1);
    this.tell('Contract released. No cancellation fee.');
    this.save();
  }
  acceptStory(choice) {
    const q = this.quest;
    if (!this.s.docked || !q || this.s.activeStory) return 'No new story contract available.';
    if (this.s.system !== q.from) return `Meet your contact at ${SYSTEM[q.from].name}.`;
    if (cargoUsed(this.s) + (q.cargo || 0) > this.st.cargo) return 'Sell some cargo before accepting this mission.';
    if (bunksUsed(this.s) + (q.passengers || 0) > this.st.bunks) return 'Free passenger berths before accepting.';
    if (q.choice) this.s.choice = choice === 'freeworlds' ? 'freeworlds' : 'independent';
    this.s.activeStory = true;
    this.s.storyProgress = 0;
    this.tell(`Mission accepted: ${q.title}.`);
    this.save();
    return null;
  }
  acceptSide(id) {
    const q = sideOffers(this.s).find((x) => x.id === id);
    if (!q || !this.s.docked) return 'No offer available.';
    if (cargoUsed(this.s) + (q.cargo || 0) > this.st.cargo) return 'Free some cargo space first.';
    this.s.side.push({ ...q, progress: 0 });
    this.tell(`Expedition accepted: ${q.name}.`);
    this.save();
    return null;
  }
  arrive(id) {
    if (!SYSTEM[id]) return;
    this.s.system = id;
    this.s.docked = false;
    this.s.lastDock = this.s.lastDock || id;
    if (!this.s.visited.includes(id)) {
      this.s.visited.push(id);
      this.reward(250 * (this.st.scanner ? 2 : 1), `${SYSTEM[id].name} charted.`);
    }
    this.s.jumps++;
    this.nextDay();
    if (this.s.visited.length >= 7) this.achievement('Seven skies');
  }
  survey() {
    let news = false;
    if (!this.s.surveyed.includes(this.s.system)) {
      this.s.surveyed.push(this.s.system);
      this.reward(this.st.scanner ? 1600 : 800, 'System survey complete.');
      news = true;
    }
    for (const q of this.s.side)
      if (q.to === this.s.system && q.kind === 'survey' && !q.progress) {
        q.progress = 1;
        this.tell(`${q.name}: survey data recorded. Return to ${SYSTEM[q.from].name} and land to report.`, 'reward');
        news = true;
      }
    if (!news) this.tell('This system is already charted. Survey data unchanged.');
    return news;
  }
  kill(mission = false, jobId = null, huntId = null) {
    this.s.kills++;
    if (mission && this.s.activeStory && ['escort', 'battle', 'finale'].includes(this.quest?.kind))
      this.s.storyProgress = Math.min(this.quest.enemies, this.s.storyProgress + 1);
    if (jobId) {
      const j = this.s.jobs.find((x) => x.id === jobId);
      if (j) j.progress = Math.min(j.enemies, j.progress + 1);
    }
    if (huntId) {
      const q = this.s.side.find((x) => x.id === huntId);
      if (q) q.progress = Math.min(q.enemies, (q.progress || 0) + 1);
    }
    this.reward(500 + SYSTEM[this.s.system].danger * 150, 'Threat neutralized.');
    if (this.s.kills >= 10) this.achievement('Guardian of the lanes');
  }
  achievement(name) {
    if (!this.s.achievements.includes(name)) {
      this.s.achievements.push(name);
      this.notify(`Milestone: ${name}`, 'reward');
    }
  }
  completeScan() {
    const q = this.quest;
    if (this.s.activeStory && q?.to === this.s.system) {
      if (q.kind === 'scan') this.s.storyProgress = 1;
      else if (q.kind === 'finale') this.s.storyProgress = 5;
    }
  }
  storyReady() {
    const q = this.quest;
    if (!q || !this.s.activeStory || q.to !== this.s.system) return false;
    if (q.kind === 'scan') return this.s.storyProgress >= 1;
    if (q.kind === 'finale') return this.s.storyProgress >= 5;
    if (q.kind === 'escort' && this.s.convoyLost) return false;
    if (['battle', 'escort'].includes(q.kind)) return this.s.storyProgress >= q.enemies;
    return true;
  }
  service(full = true) {
    const st = this.st;
    this.s.hull = full ? st.hull : Math.min(st.hull, this.s.hull);
    this.s.shield = st.shield;
    this.s.energy = st.energy;
    this.s.fuel = st.fuel;
    this.s.heat = 0;
    for (const e of this.s.escorts) e.hull = SHIP[e.ship].hull;
  }
  land() {
    this.s.docked = true;
    this.s.lastDock = this.s.system;
    this.service();
    if (this.s.convoyLost && this.s.system === 'dschubba') {
      this.s.convoyLost = false;
      this.s.storyProgress = 0;
      this.tell('A replacement relief convoy is ready.');
    }
    const fulfilled = [];
    for (const j of this.s.jobs) {
      if (j.to !== this.s.system) continue;
      if (j.kind === 'bounty' && j.progress < j.enemies) continue;
      if (j.kind === 'ore') {
        const held = this.s.cargo[j.ore] || 0;
        if (held < j.amount) {
          this.tell(`${j.name}: ${held} / ${j.amount} t ${oreName(j.ore)} aboard. Mine the rest, then land here again.`, 'warn');
          continue;
        }
        this.s.cargo[j.ore] = held - j.amount;
        if (!this.s.cargo[j.ore]) delete this.s.cargo[j.ore];
      }
      fulfilled.push(j);
    }
    for (const j of fulfilled) {
      this.reward(j.reward, `${j.name} complete.`);
      this.s.completedJobs.push(j.id);
    }
    this.s.jobs = this.s.jobs.filter((j) => !fulfilled.includes(j));
    const sides = this.s.side.filter((q) =>
      q.kind === 'survey' ? q.from === this.s.system && q.progress : q.kind === 'hunt' ? q.to === this.s.system && q.progress >= q.enemies : q.to === this.s.system,
    );
    for (const q of sides) {
      this.reward(q.reward, `${q.name} complete.`);
      this.s.sideDone.push(q.id);
      if (q.id === 'corsair') this.achievement('Scourge of Farpoint');
    }
    this.s.side = this.s.side.filter((q) => !sides.includes(q));
    let debrief = null;
    if (this.storyReady()) {
      const q = this.quest;
      debrief = { ...q };
      this.reward(q.reward, 'Mission complete.');
      this.s.story++;
      this.s.activeStory = false;
      this.s.storyProgress = 0;
      this.s.reputation['Free Worlds'] += this.s.choice === 'freeworlds' ? 3 : 1;
      this.s.reputation.Republic++;
      if (this.s.story === 8 && !this.s.outfits.jump) {
        this.s.jumpVoucher = true;
        this.tell('Recovered Jump Drive core received. Install it free at an outfitter; it requires 10 outfit tons.', 'reward');
      }
      if (this.s.story >= CAMPAIGN.length) {
        this.s.ended = true;
        this.achievement('An open horizon');
        this.recordVoyage();
      }
    }
    if (fulfilled.length) this.achievement('An honest living');
    this.save();
    return debrief;
  }
  /** Keep the five fastest finished campaigns on this device. */
  recordVoyage() {
    const s = this.s;
    const entry = { name: s.name, minutes: Math.max(1, Math.round(s.playTime / 60)), day: s.day, earned: Math.round(s.earned), kills: s.kills, ship: s.ship };
    this.lastRecord = entry;
    try {
      const list = [...readRecords(this.storage), entry].sort((a, b) => a.minutes - b.minutes || a.day - b.day).slice(0, 5);
      this.storage?.setItem(RECORDS_KEY, JSON.stringify(list));
    } catch {}
  }
  rescue() {
    const cost = Math.min(this.s.credits, Math.round(this.s.credits * 0.12) + 350);
    this.s.credits -= cost;
    this.s.cargo = {};
    this.s.convoyLost = false;
    this.s.system = this.s.lastDock;
    this.s.docked = true;
    this.service();
    if (this.s.activeStory && ['battle', 'escort', 'finale', 'scan'].includes(this.quest.kind)) this.s.storyProgress = 0;
    this.tell(`Rescue and recovery: ${money(cost)} credits. Contracts retained; trade cargo lost.`, 'warn');
    this.save();
  }
  capture(shipName = 'sparrow') {
    if (this.s.escorts.length >= 5) return 'Your fleet is already at its five-escort limit.';
    if (this.s.crew < 5) return 'You need five crew to capture a disabled ship. Hire at a port, or salvage it instead.';
    this.s.crew -= 2;
    this.s.boarded++;
    this.s.escorts.push({ id: `captured-${this.s.boarded}-${this.s.day}`, ship: shipName, hull: SHIP[shipName].hull * 0.6 });
    this.tell('Captured ship added to your fleet. Two crew transferred.', 'reward');
    this.save();
    return null;
  }
  salvage(amount = 1100 + SYSTEM[this.s.system].danger * 350) {
    this.s.boarded++;
    this.reward(amount, 'Ship salvaged.');
    this.save();
  }
  pickOre(id = 'heavy', amount = 1) {
    const free = this.st.cargo - cargoUsed(this.s);
    const n = Math.min(free, amount);
    if (n <= 0) return false;
    this.s.cargo[id] = (this.s.cargo[id] || 0) + n;
    this.s.mined += n;
    this.tell(`${n} t ${COMMODITIES.find((c) => c.id === id).name} recovered.`, 'reward');
    if (this.s.mined >= 10) this.achievement('Rock and a hard place');
    return true;
  }
}
