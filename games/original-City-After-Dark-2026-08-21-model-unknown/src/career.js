/**
 * career.js — the career model: small helpers, creating a new career and
 * client leads, the journal and ledger, risk scoring, overhead, and saving.
 * Everything takes the career as a parameter; nothing touches the page.
 */

import {
  ARCHETYPES,
  BACKGROUNDS,
  FIRST_NAMES,
  LAST_INITIALS,
  LEAD_MESSAGES,
  LOCATIONS,
  PACKAGES,
  PERSONALITIES,
  POSITIVE_SIGNALS,
  RED_FLAGS,
  REGIONS,
  STAFF,
  STRUCTURES,
} from './data.js';

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function chance(probability) {
  return Math.random() < probability;
}

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function money(amount) {
  const rounded = Math.round(amount);
  return `${rounded < 0 ? '-' : ''}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

export function clock(minutes) {
  const wrapped = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function weekday(day) {
  return ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][(Math.max(1, day) - 1) % 7];
}

export function levelForXp(xp) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 180)) + 1);
}

export function xpForLevel(level) {
  return Math.pow(level, 2) * 180;
}

export function createCareer({ name, pronouns, regionId, backgroundId }) {
  const background = BACKGROUNDS[backgroundId] || BACKGROUNDS.careful;
  const career = {
    version: 1,
    createdAt: Date.now(),
    name: name || 'Alex Parker',
    pronouns: pronouns || 'they',
    regionId: REGIONS[regionId] ? regionId : 'pacific',
    backgroundId: BACKGROUNDS[backgroundId] ? backgroundId : 'careful',
    day: 1,
    minute: 1080,
    speed: 1,
    money: background.money,
    debt: 3200,
    reputation: background.reputation,
    exposure: background.exposure || 4,
    legalHeat: 8,
    level: 1,
    xp: 0,
    skillPoints: 2,
    player: {
      presentation: 50,
      charisma: 50,
      stamina: 50,
      resilience: 50,
      intuition: 50,
      intelligence: 50,
      streetSmarts: 50,
      energy: 82,
      stress: 18,
      hygiene: 90,
      health: 92,
      hunger: 76,
    },
    skills: { negotiation: 0, conversation: 0, screening: 0, branding: 0, composure: 0, safety: 0 },
    business: {
      structure: background.structure || 'independent',
      brand: 'approachable',
      prices: Object.fromEntries(Object.values(PACKAGES).map((pkg) => [pkg.id, pkg.basePrice])),
      staff: { security: false, manager: false, driver: false },
      housing: 1,
      platformTrust: 68,
      privacy: 62,
      weeklyBookings: 0,
      grossLifetime: 0,
      netLifetime: 0,
      expensesLifetime: 0,
    },
    protocols: {
      idCheck: true,
      references: false,
      deposit: true,
      publicFirst: true,
      safeCall: true,
      liveLocation: false,
      codeWord: false,
      noLastMinuteVenueChange: true,
    },
    marketing: { active: [], quality: 35, reach: 22, niche: 'approachable' },
    personal: {
      partnerName: 'Jordan',
      relationship: 62,
      trust: 58,
      secrecy: 24,
      familyPressure: 18,
      peerSupport: 35,
      knows: 'partial',
    },
    health: { lastCheckDay: 0, checkStatus: 'Due', injury: 0, burnout: 8 },
    prospects: [],
    clients: [],
    bookings: [],
    blacklist: [],
    reviews: [],
    journal: [],
    finance: [],
    goals: {
      firstBooking: false,
      safeFive: 0,
      regular: false,
      premium: false,
      emergencyFund: false,
      lowHeatMonth: 0,
    },
    achievements: [],
    storyFlags: {
      tutorialShown: false,
      firstDate: false,
      agencyUnlocked: background.structure === 'agency',
      expansionUnlocked: false,
      endingSeen: false,
    },
    world: {
      x: LOCATIONS.home.x + 4,
      z: LOCATIONS.home.z + 2,
      weather: REGIONS[regionId]?.weather || 'rain',
    },
    settings: {
      graphics: 'high',
      bloom: true,
      shadows: true,
      reducedMotion: false,
      autosave: true,
      audio: false,
    },
    trends: { income: [0, 0, 0, 0, 0, 0, 0], reputation: [background.reputation], risk: [8] },
    daily: { revenue: 0, expenses: 0, dates: 0, safeDates: 0 },
  };
  Object.entries(background.stats || {}).forEach(([stat, bonus]) => {
    career.player[stat] = clamp(career.player[stat] + bonus);
  });
  Object.entries(background.skills || {}).forEach(([skill, bonus]) => {
    career.skills[skill] += bonus;
  });
  career.journal.unshift({
    id: uid('log'),
    day: 1,
    minute: career.minute,
    type: 'career',
    title: 'Career started',
    text: background.note,
  });
  addLeads(career, 6);
  return career;
}

export function createLead(career, overrides = {}) {
  const region = REGIONS[career.regionId];
  const archetype = overrides.archetype || pick(ARCHETYPES);
  const personality = overrides.personality || pick(PERSONALITIES);
  const packageId = overrides.packageId || pick(archetype.packages);
  const pkg = PACKAGES[packageId];
  const listPrice = career.business.prices[packageId] || pkg.basePrice;
  const brandFactor = 1 + career.marketing.quality / 450 + career.skills.branding * 0.03;
  const budget = Math.round(
    listPrice * archetype.budget * region.demand * brandFactor * randRange(0.86, 1.2),
  );
  const positiveCount = randInt(1, 3);
  const positives = [...POSITIVE_SIGNALS].sort(() => Math.random() - 0.5).slice(0, positiveCount);
  const flagCount = chance(0.46) ? randInt(1, chance(0.25) ? 3 : 2) : 0;
  const flags = [...RED_FLAGS].sort(() => Math.random() - 0.5).slice(0, flagCount);
  let risk =
    randInt(12, 34) +
    archetype.risk +
    personality.risk +
    flags.reduce((sum, flag) => sum + flag.risk, 0) -
    positives.length * 4;
  risk += region.legalRisk * 0.08;
  risk = clamp(Math.round(risk), 4, 94);
  const desiredDay = career.day + randInt(0, 3);
  const desiredMinute = pick([1080, 1140, 1200, 1260, 1320]) + pick([0, 15, 30, 45]);
  const firstName = pick(FIRST_NAMES);
  const lastInitial = pick(LAST_INITIALS);
  const hiddenFlag = chance(0.22) ? pick(RED_FLAGS.filter((flag) => !flags.includes(flag))) : null;
  return {
    id: uid('client'),
    name: `${firstName} ${lastInitial}`,
    initials: `${firstName[0]}${lastInitial[0]}`,
    age: randInt(26, 64),
    archetypeId: archetype.id,
    archetype: archetype.name,
    personalityId: personality.id,
    personality: personality.name,
    bestStyle: personality.best,
    interests: [...archetype.interests].sort(() => Math.random() - 0.5),
    desiredPackage: packageId,
    desiredDay,
    desiredMinute,
    budget,
    offer: Math.round((budget * randRange(0.82, 1.02)) / 10) * 10,
    risk,
    flags: flags.map((flag) => flag.text),
    hiddenFlag: hiddenFlag?.text || null,
    positives,
    message: pick(LEAD_MESSAGES),
    status: 'lead',
    trust: randInt(25, 52),
    attachment: 0,
    reliability: clamp(100 - risk + randInt(-8, 12)),
    dates: 0,
    lifetimeValue: 0,
    notes: '',
    screening: {
      idCheck: false,
      references: false,
      deposit: false,
      publicFirst: false,
      safeCall: false,
      security: false,
    },
    createdDay: career.day,
    expiresDay: career.day + randInt(2, 4),
    ...overrides,
  };
}

export function addLeads(career, count = 3) {
  const room = Math.max(0, 14 - career.prospects.length);
  const added = Math.min(count, room);
  for (let index = 0; index < added; index += 1) {
    career.prospects.push(createLead(career));
  }
  return added;
}

export function logJournal(career, title, text, type = 'general') {
  career.journal.unshift({ id: uid('log'), day: career.day, minute: career.minute, type, title, text });
  career.journal = career.journal.slice(0, 120);
}

export function addTransaction(career, amount, label, category = 'general') {
  const rounded = Math.round(amount);
  career.money += rounded;
  if (rounded >= 0) {
    career.daily.revenue += rounded;
    career.business.netLifetime += rounded;
  } else {
    career.daily.expenses += Math.abs(rounded);
    career.business.expensesLifetime += Math.abs(rounded);
  }
  career.finance.unshift({
    id: uid('fin'),
    day: career.day,
    minute: career.minute,
    amount: rounded,
    label,
    category,
  });
  career.finance = career.finance.slice(0, 150);
}

export function riskScore(career, client, options = client.screening) {
  let risk = client.risk;
  const screeningSkill = career.skills.screening;
  if (options.idCheck) {
    risk -= 8 + screeningSkill * 2;
  }
  if (options.references) {
    risk -= 12 + screeningSkill * 3;
  }
  if (options.deposit) {
    risk -= 8;
  }
  if (options.publicFirst && client.dates === 0) {
    risk -= 10;
  }
  if (options.safeCall) {
    risk -= 9 + career.skills.safety * 2;
  }
  if (options.security) {
    risk -= 22;
  }
  if (career.protocols.noLastMinuteVenueChange) {
    risk -= 3;
  }
  const structure = STRUCTURES[career.business.structure];
  risk -= structure.safety;
  if (career.business.staff.security) {
    risk -= STAFF.security.safety;
  }
  if (career.business.staff.driver) {
    risk -= STAFF.driver.safety;
  }
  risk += career.legalHeat * 0.08;
  risk += Math.max(0, career.player.stress - 65) * 0.18;
  return clamp(Math.round(risk), 2, 96);
}

export function dailyOverhead(career) {
  const region = REGIONS[career.regionId];
  let total =
    ([0, 58, 92, 145][career.business.housing] || 58) * region.costs +
    STRUCTURES[career.business.structure].daily;
  Object.entries(career.business.staff).forEach(([role, hired]) => {
    if (hired) {
      total += STAFF[role].daily;
    }
  });
  return Math.round(total);
}

const SAVE_KEY = 'city-after-dark-save-v1';

/** Save to this browser. Storage can be full or blocked (private windows): never throw. */
export function saveCareer(career) {
  career.updatedAt = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(career));
    return true;
  } catch {
    return false;
  }
}

export function loadCareer() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) {
      return null;
    }
    data.level = levelForXp(data.xp || 0);
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage blocked: nothing to clear */
  }
}
