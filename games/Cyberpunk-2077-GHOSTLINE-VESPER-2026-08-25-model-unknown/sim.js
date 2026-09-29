/**
 * sim.js — the game state and the rules that change it: the save format,
 * events, levelling, jobs, dialogue effects, weather and district pressure.
 * No rendering here; the world, actors and HUD listen to the event bus.
 */

import { WEAPONS, ABILITIES, SKILLS, QUESTS, DIALOGUE, DISTRICT_IDS, FACTION_IDS, byId } from './content.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent approach of `from` towards `to` at `rate` per second. */
export const damp = (from, to, rate, dt) => lerp(from, to, 1 - Math.exp(-rate * dt));

/* ------------------------------------------------------------------ seeded random */

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic random numbers: the same seed builds the same city block. */
export class Rng {
  constructor(seed) {
    this.state = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    if (this.state === 0) this.state = 1831565813;
  }
  next() {
    let e = (this.state += 1831565813);
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  }
  range(lo, hi) {
    return lo + (hi - lo) * this.next();
  }
  integer(lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(list) {
    if (list.length === 0) throw Error('Cannot pick from an empty collection.');
    return list[Math.floor(this.next() * list.length)];
  }
}

/* ------------------------------------------------------------------ state + saves */

const freshDistrict = () => ({ discovered: false, power: 60, security: 50, scarcity: 45, unrest: 35, heat: 0 });

export function createInitialState(weapons = WEAPONS, worldSeed = 1369948382) {
  const ammo = Object.fromEntries(weapons.map((w) => [w.id, { magazine: w.magazine, reserve: w.reserve }]));
  const districts = Object.fromEntries(DISTRICT_IDS.map((id) => [id, freshDistrict()]));
  const factions = Object.fromEntries(FACTION_IDS.map((id) => [id, { reputation: 0, favors: 0 }]));
  districts.mercury.discovered = true;
  return {
    version: 2,
    worldSeed,
    playTime: 0,
    timeOfDay: 21.5,
    weather: 'rain',
    player: {
      position: { x: 0, y: 1.7, z: 8 },
      yaw: 180,
      pitch: 0,
      level: 1,
      xp: 0,
      nextLevelXp: 300,
      skillPoints: 1,
      health: 100,
      maxHealth: 100,
      shield: 50,
      maxShield: 50,
      energy: 100,
      maxEnergy: 100,
      credits: 125,
      currentWeapon: 'kestrel',
      unlockedWeapons: ['kestrel', 'arc-talon'],
      ammo,
      skills: {},
      consumables: { medpatch: 3 },
    },
    quests: {},
    factions,
    districts,
    flags: { prologueSeen: false, whiteoutStage: 0 },
    collected: [],
    objectiveFacts: {},
    defeatedAt: {},
  };
}

/** Merge a stored save over a fresh state; anything malformed falls back to the fresh one. */
export function migrateSave(saved, fresh) {
  if (!saved || typeof saved !== 'object') return fresh;
  if (saved.version !== 2 || !saved.player || !saved.quests || !saved.flags) return fresh;
  const player = { ...fresh.player, ...saved.player };
  if (player.health <= 0) {
    player.position = { ...fresh.player.position };
    player.health = player.maxHealth;
    player.shield = player.maxShield;
    player.energy = player.maxEnergy;
  }
  return {
    ...fresh,
    ...saved,
    player,
    quests: { ...fresh.quests, ...saved.quests },
    factions: { ...fresh.factions, ...saved.factions },
    districts: { ...fresh.districts, ...saved.districts },
    flags: { ...fresh.flags, ...saved.flags },
    collected: Array.isArray(saved.collected) ? saved.collected.filter((c) => typeof c === 'string') : [],
    objectiveFacts:
      saved.objectiveFacts && typeof saved.objectiveFacts === 'object'
        ? { ...fresh.objectiveFacts, ...saved.objectiveFacts }
        : fresh.objectiveFacts,
    defeatedAt:
      saved.defeatedAt && typeof saved.defeatedAt === 'object' ? { ...fresh.defeatedAt, ...saved.defeatedAt } : fresh.defeatedAt,
  };
}

const SAVE_KEY = 'ghostline-vesper.save.v2';

/** localStorage saves; private browsing (no storage) just means nothing persists. */
export class SaveStore {
  constructor() {
    try {
      this.storage = window.localStorage;
      this.storage.getItem(SAVE_KEY);
    } catch {
      this.storage = null;
    }
  }
  hasSave() {
    try {
      return !!this.storage && this.storage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }
  save(state) {
    if (!this.storage) throw Error('No storage');
    this.storage.setItem(SAVE_KEY, JSON.stringify(state));
  }
  load(fresh) {
    try {
      const raw = this.storage?.getItem(SAVE_KEY);
      return raw ? migrateSave(JSON.parse(raw), fresh) : fresh;
    } catch {
      return fresh;
    }
  }
  clear() {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch {
      /* nothing stored */
    }
  }
}

/* ------------------------------------------------------------------ events */

export class EventBus {
  listeners = new Map();
  on(type, fn) {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
    return () => set.delete(fn);
  }
  emit(type, payload) {
    const set = this.listeners.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }
  clear() {
    this.listeners.clear();
  }
}

/* ------------------------------------------------------------------ progression */

class Progression {
  constructor(state, events, skills = SKILLS) {
    this.state = state;
    this.events = events;
    this.skills = skills;
  }
  grantXp(amount) {
    const p = this.state.player;
    p.xp += Math.max(0, Math.round(amount));
    while (p.xp >= p.nextLevelXp && p.level < 30) {
      p.xp -= p.nextLevelXp;
      p.level += 1;
      p.skillPoints += 1;
      p.nextLevelXp = Math.round(300 * p.level ** 1.32);
      this.events.emit('player:leveled', { level: p.level });
      this.events.emit('toast', { message: `LEVEL ${p.level} // Insight point gained`, tone: 'good' });
    }
    this.events.emit('state:changed', { reason: 'xp' });
  }
  canPurchase(id) {
    const skill = byId(this.skills, id);
    const p = this.state.player;
    if ((p.skills[id] ?? 0) >= skill.maxRank) return { allowed: false, reason: 'Maximum rank reached' };
    if (p.skillPoints < 1) return { allowed: false, reason: 'No Insight points' };
    if (skill.prerequisite && (p.skills[skill.prerequisite] ?? 0) < 1)
      return { allowed: false, reason: `Requires ${byId(this.skills, skill.prerequisite).name}` };
    return { allowed: true };
  }
  purchase(id) {
    const check = this.canPurchase(id);
    if (!check.allowed) {
      this.events.emit('toast', { message: check.reason ?? 'Skill unavailable', tone: 'bad' });
      return false;
    }
    const skill = byId(this.skills, id);
    const p = this.state.player;
    p.skillPoints -= 1;
    p.skills[id] = (p.skills[id] ?? 0) + 1;
    this.recalculateDerivedStats();
    this.events.emit('toast', { message: `${skill.name} rank ${p.skills[id]} installed`, tone: 'good' });
    this.events.emit('state:changed', { reason: 'skill' });
    return true;
  }
  recalculateDerivedStats() {
    const p = this.state.player;
    const frame = p.skills['chrome.frame'] ?? 0;
    const capacitor = p.skills['chrome.capacitor'] ?? 0;
    const oldHealth = p.maxHealth;
    const oldEnergy = p.maxEnergy;
    p.maxHealth = 100 + frame * 15;
    p.maxEnergy = 100 + capacitor * 15;
    p.health = Math.min(p.maxHealth, p.health + p.maxHealth - oldHealth);
    p.energy = Math.min(p.maxEnergy, p.energy + p.maxEnergy - oldEnergy);
  }
}

/* ------------------------------------------------------------------ jobs */

class QuestLog {
  constructor(state, events, definitions, grantRewards) {
    this.state = state;
    this.events = events;
    this.definitions = definitions;
    this.grantRewards = grantRewards;
    this.unsubscribe = events.on('objective:event', (e) => this.onObjective(e));
  }
  destroy() {
    this.unsubscribe();
  }
  start(id) {
    const quest = byId(this.definitions, id);
    const current = this.state.quests[id];
    if (current?.status === 'active' || current?.status === 'complete') return false;
    this.state.quests[id] = { status: 'active', stage: 0, progress: 0 };
    this.events.emit('quest:started', { quest });
    this.events.emit('quest:advanced', { quest, objective: quest.stages[0] ?? null });
    this.events.emit('toast', { message: `NEW JOB // ${quest.title}`, tone: 'good' });
    this.events.emit('state:changed', { reason: 'quest-started' });
    this.reconcile(quest);
    return true;
  }
  onObjective(e) {
    for (const quest of this.definitions) {
      const q = this.state.quests[quest.id];
      if (!q || q.status !== 'active') continue;
      const stage = quest.stages[q.stage];
      if (!stage || stage.type !== e.type || stage.target !== e.target) continue;
      q.progress = this.factCount(stage);
      if (q.progress >= (stage.required ?? 1)) this.advance(quest, q.stage);
      else this.events.emit('quest:advanced', { quest, objective: stage });
      this.events.emit('state:changed', { reason: 'objective-progress' });
    }
  }
  advance(quest, fromStage) {
    const q = this.state.quests[quest.id];
    if (!q || q.stage !== fromStage) return;
    q.stage += 1;
    q.progress = 0;
    const next = quest.stages[q.stage] ?? null;
    if (next) {
      this.events.emit('quest:advanced', { quest, objective: next });
      this.events.emit('toast', { message: `UPDATED // ${quest.title}`, tone: 'normal' });
      this.reconcile(quest);
      return;
    }
    q.status = 'complete';
    this.grantRewards(quest.reward.xp, quest.reward.credits, quest.reward.skillPoints ?? 0);
    this.events.emit('quest:completed', { quest });
    this.events.emit('toast', { message: `JOB COMPLETE // ${quest.title}`, tone: 'good' });
    if (quest.nextQuest) this.start(quest.nextQuest);
  }
  /** Facts gathered before a stage started still count (e.g. votes breached early). */
  reconcile(quest) {
    const q = this.state.quests[quest.id];
    if (!q || q.status !== 'active') return;
    const stage = quest.stages[q.stage];
    if (!stage) return;
    q.progress = this.factCount(stage);
    if (q.progress >= (stage.required ?? 1)) this.advance(quest, q.stage);
  }
  factCount(stage) {
    return this.state.objectiveFacts[`${stage.type}:${stage.target}`] ?? 0;
  }
  getTracked() {
    const order = { main: 0, faction: 1, gig: 2 };
    const quest = this.definitions
      .filter((d) => this.state.quests[d.id]?.status === 'active')
      .sort((a, b) => order[a.category] - order[b.category])[0];
    if (!quest) return null;
    const q = this.state.quests[quest.id];
    const objective = quest.stages[q.stage];
    return objective ? { quest, objective, progress: q.progress, required: objective.required ?? 1 } : null;
  }
}

/* ------------------------------------------------------------------ the simulation */

export class Simulation {
  events = new EventBus();
  shieldRechargeDelay = 0;
  tickAccumulator = 0;

  constructor(state) {
    this.state = state ?? createInitialState(WEAPONS);
    this.progression = new Progression(this.state, this.events, SKILLS);
    this.quests = new QuestLog(this.state, this.events, QUESTS, (xp, credits, skillPoints) => {
      this.state.player.credits += credits;
      this.state.player.skillPoints += skillPoints;
      this.progression.grantXp(xp);
    });
    this.progression.recalculateDerivedStats();
  }

  tick(dt) {
    const t = Math.min(dt, 0.1);
    const p = this.state.player;
    this.state.playTime += t;
    this.state.timeOfDay = (this.state.timeOfDay + t * 0.012) % 24;
    this.shieldRechargeDelay = Math.max(0, this.shieldRechargeDelay - t);
    const capacitor = p.skills['chrome.capacitor'] ?? 0;
    p.energy = Math.min(p.maxEnergy, p.energy + t * (7 + capacitor * 2));
    if (this.shieldRechargeDelay <= 0) p.shield = Math.min(p.maxShield, p.shield + t * 9);
    this.tickAccumulator += t;
    if (this.tickAccumulator >= 0.25) {
      this.tickAccumulator = 0;
      this.events.emit('state:changed', { reason: 'tick' });
    }
  }

  /** Returns true when the player died from this hit. */
  damagePlayer(amount, source) {
    const p = this.state.player;
    if (p.health <= 0) return true;
    let rest = Math.max(0, amount);
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
    p.health = Math.max(0, p.health - rest);
    this.shieldRechargeDelay = 4;
    this.events.emit('player:damaged', { amount, source });
    this.events.emit('state:changed', { reason: 'damage' });
    if (p.health <= 0) {
      this.events.emit('player:died', undefined);
      return true;
    }
    return false;
  }

  healPlayer(amount) {
    const p = this.state.player;
    if (p.health <= 0 || p.health >= p.maxHealth) return false;
    const healed = Math.min(amount, p.maxHealth - p.health);
    p.health += healed;
    this.events.emit('player:healed', { amount: healed });
    this.events.emit('state:changed', { reason: 'heal' });
    return true;
  }

  useMedpatch() {
    const p = this.state.player;
    const left = p.consumables.medpatch ?? 0;
    if (left <= 0) {
      this.events.emit('toast', { message: 'No medpatches remaining', tone: 'bad' });
      return false;
    }
    if (!this.healPlayer(45)) return false;
    p.consumables.medpatch = left - 1;
    this.events.emit('toast', { message: 'Medpatch deployed', tone: 'good' });
    return true;
  }

  spendEnergy(abilityId) {
    const ability = byId(ABILITIES, abilityId);
    const p = this.state.player;
    if (p.energy < ability.energy) {
      this.events.emit('toast', { message: 'Insufficient implant energy', tone: 'bad' });
      return false;
    }
    p.energy -= ability.energy;
    this.events.emit('ability:used', { abilityId });
    this.events.emit('state:changed', { reason: 'ability' });
    return true;
  }

  objective(e) {
    const key = `${e.type}:${e.target}`;
    this.state.objectiveFacts[key] = (this.state.objectiveFacts[key] ?? 0) + Math.max(1, e.amount ?? 1);
    this.events.emit('objective:event', e);
  }

  applyDialogueChoice(choice) {
    if (choice.onceKey && this.state.flags[`choice:${choice.onceKey}`] === true) return;
    for (const effect of choice.effects ?? []) this.applyEffect(effect);
    if (choice.onceKey) {
      this.state.flags[`choice:${choice.onceKey}`] = true;
      this.events.emit('state:changed', { reason: 'dialogue-choice-consumed' });
    }
  }

  dialogueChoiceAvailable(choice) {
    return !(
      (choice.onceKey && this.state.flags[`choice:${choice.onceKey}`] === true) ||
      (choice.requiresFlag && !this.state.flags[choice.requiresFlag]) ||
      (choice.requiresSkill && (this.state.player.skills[choice.requiresSkill.skillId] ?? 0) < choice.requiresSkill.rank)
    );
  }

  applyEffect(effect) {
    switch (effect.type) {
      case 'setFlag':
        this.state.flags[effect.key] = effect.value;
        break;
      case 'startQuest':
        this.quests.start(effect.questId);
        break;
      case 'reputation':
        this.changeReputation(effect.faction, effect.amount);
        break;
      case 'credits':
        this.state.player.credits = Math.max(0, this.state.player.credits + effect.amount);
        break;
      case 'objective':
        this.objective(
          effect.amount === undefined
            ? { type: effect.objectiveType, target: effect.target }
            : { type: effect.objectiveType, target: effect.target, amount: effect.amount }
        );
        break;
    }
    this.events.emit('state:changed', { reason: 'dialogue-effect' });
  }

  changeReputation(faction, amount) {
    const f = this.state.factions[faction];
    f.reputation = clamp(f.reputation + amount, -100, 100);
    if (amount > 0 && (this.state.player.skills['voice.favors'] ?? 0) > 0) f.favors += 1;
  }

  /** Record a one-off collectible; false if it was already collected. */
  markCollected(key, objective) {
    if (this.state.collected.includes(key)) return false;
    this.state.collected.push(key);
    this.objective(objective);
    this.events.emit('state:changed', { reason: 'collectible' });
    return true;
  }

  addCredits(amount) {
    this.state.player.credits = Math.max(0, this.state.player.credits + Math.round(amount));
    this.objective({ type: 'purchase', target: 'credits.earned', amount });
    this.events.emit('state:changed', { reason: 'credits' });
  }

  unlockWeapon(id, price = 0) {
    const weapon = byId(WEAPONS, id);
    const p = this.state.player;
    if (p.unlockedWeapons.includes(id) || p.credits < price) return false;
    p.credits -= price;
    p.unlockedWeapons.push(id);
    p.ammo[id] = { magazine: weapon.magazine, reserve: weapon.reserve };
    this.events.emit('toast', { message: `${weapon.name} acquired`, tone: 'good' });
    this.events.emit('state:changed', { reason: 'weapon-unlocked' });
    return true;
  }

  getWeapon() {
    return byId(WEAPONS, this.state.player.currentWeapon);
  }

  getDialogueNode(id) {
    return byId(DIALOGUE, id);
  }
}

/* ------------------------------------------------------------------ weather + district pressure */

const WEATHER = ['rain', 'smog', 'gridstorm', 'clear'];

export class WorldState {
  weatherTimer = 150;
  eventTimer = 70;
  epoch = 0;
  currentDistrict = 'mercury';

  constructor(state, events) {
    this.state = state;
    this.events = events;
    this.unsubscribers = [
      events.on('district:entered', ({ district }) => {
        this.currentDistrict = district.id;
      }),
      events.on('quest:completed', ({ quest }) => this.applyQuestConsequences(quest.id)),
    ];
  }

  update(dt) {
    for (const d of Object.values(this.state.districts)) d.heat = Math.max(0, d.heat - dt * 0.035);
    this.weatherTimer -= dt;
    this.eventTimer -= dt;
    if (this.weatherTimer <= 0) this.advanceWeather();
    if (this.eventTimer <= 0) this.worldPulse();
  }

  destroy() {
    for (const off of this.unsubscribers) off();
  }

  advanceWeather() {
    this.epoch += 1;
    const rng = new Rng(`${this.state.worldSeed}:weather:${this.epoch}`);
    const previous = this.state.weather;
    this.state.weather = rng.pick(WEATHER);
    if (this.state.weather === previous) this.state.weather = WEATHER[(WEATHER.indexOf(previous) + 1) % WEATHER.length] ?? 'rain';
    this.weatherTimer = rng.range(125, 210);
    this.events.emit('toast', {
      message: `WEATHER FRONT // ${this.state.weather.toUpperCase()}${this.state.weather === 'gridstorm' ? ' disrupts machine wards' : ''}`,
      tone: 'normal',
    });
    this.events.emit('state:changed', { reason: 'weather' });
  }

  worldPulse() {
    const d = this.state.districts[this.currentDistrict];
    const rng = new Rng(`${this.state.worldSeed}:pulse:${this.epoch}:${Math.floor(this.state.playTime / 60)}`);
    this.eventTimer = rng.range(65, 105);
    const lines =
      d.heat > 45
        ? [`DISTRICT HEAT ${Math.round(d.heat)} // streamed patrol density elevated`, `SECURITY MESH // signature pressure ${Math.round(d.heat)}%`]
        : d.unrest > 55
          ? [`DISTRICT UNREST ${Math.round(d.unrest)} // civic stability deteriorating`, `POWER ${Math.round(d.power)} // UNREST ${Math.round(d.unrest)}`]
          : [`CITY PULSE // SECURITY ${Math.round(d.security)} \xB7 POWER ${Math.round(d.power)}`, `DISTRICT HEAT ${Math.round(d.heat)} // patrol density nominal`];
    this.events.emit('toast', { message: rng.pick(lines), tone: d.heat > 45 ? 'bad' : 'normal' });
  }

  applyQuestConsequences(id) {
    const { districts, factions } = this.state;
    switch (id) {
      case 'dead-delivery':
        districts.mercury.power = Math.min(100, districts.mercury.power + 8);
        districts.mercury.security = Math.max(0, districts.mercury.security - 5);
        break;
      case 'eyes-off':
        districts.ember.security = Math.max(0, districts.ember.security - 10);
        districts.ember.unrest = Math.max(0, districts.ember.unrest - 7);
        factions.patchwork.reputation = Math.min(100, factions.patchwork.reputation + 12);
        break;
      case 'memory-market':
        districts.nullworks.scarcity = Math.max(0, districts.nullworks.scarcity - 6);
        factions.archive.reputation = Math.min(100, factions.archive.reputation + 10);
        break;
      case 'warm-lights':
        districts.rustwater.power = Math.min(100, districts.rustwater.power + 18);
        districts.rustwater.unrest = Math.max(0, districts.rustwater.unrest - 8);
        factions.patchwork.reputation = Math.min(100, factions.patchwork.reputation + 14);
        break;
      case 'ghost-keys':
        for (const d of Object.values(districts)) d.security = Math.min(100, d.security + 4);
        break;
    }
    this.events.emit('state:changed', { reason: 'world-consequence' });
  }
}
