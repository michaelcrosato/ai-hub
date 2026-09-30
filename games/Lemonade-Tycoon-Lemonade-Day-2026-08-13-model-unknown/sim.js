/**
 * sim.js — the rules of Lemonade Day: data tables, the pantry, the Sunshine
 * Crew, the daily forecast and simulation, and the campaign reducer.
 *
 * Everything here is pure (no DOM, no three.js). The numbers are the ones the
 * original release shipped with; Old Mill Market (the fourth pitch) is new.
 */

// ---------------------------------------------------------------- helpers

export const clamp = (lo, hi, v) => Math.min(hi, Math.max(lo, v));
export const round2 = (v) => Math.round(v * 100) / 100;
/** $12 or $2.50; losses read −$3.50 (they used to print as $-3.50). */
export const money = (v) => {
  const a = Math.abs(v);
  return `${v < 0 ? '−' : ''}$${a.toFixed(a % 1 ? 2 : 0)}`;
};

// ---------------------------------------------------------------- supplies

export const SUPPLIES = ['cups', 'lemons', 'sugar', 'ice'];
export const SUPPLY = {
  cups: { name: 'Cup sleeves', unit: 'cups', packSize: 10, cornerPackCost: 2, shelfDays: null, icon: '◇' },
  lemons: { name: 'Lemon bags', unit: 'lemons', packSize: 10, cornerPackCost: 4, shelfDays: 3, icon: '●' },
  sugar: { name: 'Sugar sacks', unit: 'scoops', packSize: 20, cornerPackCost: 2, shelfDays: null, icon: '◆' },
  ice: { name: 'Ice bags', unit: 'scoops', packSize: 20, cornerPackCost: 1, shelfDays: 1, icon: '■' },
};

export const BULK = {
  none: { name: 'No order', note: 'Use the pantry and today’s pickup', packs: { cups: 0, lemons: 0, sugar: 0, ice: 0 } },
  essentials: { name: 'Essentials case', note: '50 cups \xB7 10 lemons \xB7 40 sugar', packs: { cups: 5, lemons: 1, sugar: 2, ice: 0 } },
  busy: { name: 'Busy-day kit', note: '50 cups \xB7 20 lemons \xB7 40 sugar \xB7 40 ice', packs: { cups: 5, lemons: 2, sugar: 2, ice: 2 } },
  citrus: { name: 'Citrus case', note: '50 lemons for recipe-heavy days', packs: { cups: 0, lemons: 5, sugar: 0, ice: 0 } },
};
export const BULK_IDS = Object.keys(BULK);
export const DEFAULT_PROCUREMENT = { bulkPreset: 'none' };

export const emptySupplies = () => ({ cups: 0, lemons: 0, sugar: 0, ice: 0 });

export function newPantry(day = 1) {
  return {
    lastProcessedDay: day,
    nextLotId: 1,
    nextOrderId: 1,
    lots: [],
    incoming: [],
    cumulativeSpoiled: emptySupplies(),
    lastAdvance: { day, spoiled: emptySupplies(), arrivedOrderIds: [], delayedOrderIds: [] },
  };
}

/** Supplies needed for `prepared` cups at a recipe given per ten cups. */
export function requiredFor(prepared, lemon, sugar, ice) {
  const batches = prepared / 10;
  return { cups: prepared, lemons: batches * lemon, sugar: batches * sugar, ice: batches * ice };
}

export function pantryTotals(pantry) {
  const out = emptySupplies();
  for (const lot of pantry.lots) out[lot.supply] += lot.units;
  return out;
}

/** A Bulk Club case: 30% off corner prices, $16 minimum, scaled by difficulty. */
export function bulkInvoice(preset, costMult) {
  const packs = BULK[preset].packs;
  const corner = SUPPLIES.reduce((sum, s) => sum + packs[s] * SUPPLY[s].cornerPackCost, 0);
  return corner > 0 ? round2(Math.max(16, round2(corner * 0.7)) * costMult) : 0;
}

function lcg(seed) {
  const s = ((seed || 1) * 1664525 + 1013904223) >>> 0;
  return s / 4294967296;
}

/** The day a Bulk Club order really arrives: next morning, one day late 12% of the time. */
export function arrivalDay(seed, orderId, placedDay) {
  const due = placedDay + 1;
  const roll = lcg((seed ^ Math.imul(orderId, 2654435761) ^ 1374496523) >>> 0);
  return Math.min(7, due + (roll >= 0.88 ? 1 : 0));
}

function expiresAfter(supply, day) {
  const shelf = SUPPLY[supply].shelfDays;
  return shelf === null ? null : day + shelf - 1;
}

function addLots(pantry, packs, supplier, day) {
  const lots = [...pantry.lots];
  let nextLotId = pantry.nextLotId;
  for (const s of SUPPLIES) {
    const units = packs[s] * SUPPLY[s].packSize;
    if (units) lots.push({ lotId: nextLotId++, supply: s, units, supplier, receivedDay: day, expiresAfterDay: expiresAfter(s, day) });
  }
  return { ...pantry, lots, nextLotId };
}

/** Corner Market fills whatever the pantry cannot cover today. */
function cornerOrder(pantry, required, costMult, lemonDiscount = 0) {
  const have = pantryTotals(pantry);
  const packs = emptySupplies();
  for (const s of SUPPLIES) packs[s] = Math.ceil(Math.max(0, required[s] - have[s]) / SUPPLY[s].packSize);
  const cost = SUPPLIES.reduce((sum, s) => sum + packs[s] * SUPPLY[s].cornerPackCost * (s === 'lemons' ? 1 - lemonDiscount : 1), 0);
  return { packs, invoice: round2(cost * costMult) };
}

/** Use the oldest lots first; lemons carry a freshness bonus or penalty into quality. */
function packTransaction(pantry, required, firstNewLotId, day) {
  const lots = pantry.lots.map((l) => ({ ...l }));
  const usedFromPantry = emptySupplies();
  let freshness = 0;
  for (const s of SUPPLIES) {
    let need = required[s];
    const pool = lots.filter((l) => l.supply === s && l.units > 0).sort((a, b) => a.receivedDay - b.receivedDay || a.lotId - b.lotId);
    for (const lot of pool) {
      if (need <= 0) break;
      const take = Math.min(need, lot.units);
      lot.units -= take;
      need -= take;
      if (lot.lotId < firstNewLotId) usedFromPantry[s] += take;
      if (s === 'lemons') {
        const age = day - lot.receivedDay + (lot.supplier === 'bulk' ? 1 : 0);
        freshness += take * (age <= 0 ? 2 : age === 1 ? 0 : -3);
      }
    }
    if (need > 0) throw new Error(`Packing ran short of ${s}`);
  }
  return {
    pantry: { ...pantry, lots: lots.filter((l) => l.units > 0) },
    usedFromPantry,
    lemonFreshnessBonus: required.lemons ? freshness / required.lemons : 0,
  };
}

/** Everything that happens when the stand packs up for the day. */
export function packDay(o) {
  const required = requiredFor(o.prepared, o.lemon, o.sugar, o.ice);
  const corner = cornerOrder(o.pantry, required, o.difficultyCost, o.lemonDiscount || 0);
  const firstNewLotId = o.pantry.nextLotId;
  const stocked = addLots(o.pantry, corner.packs, 'corner', o.day);
  const packed = packTransaction(stocked, required, firstNewLotId, o.day);
  const preset = o.day > 1 && o.day < 7 ? o.procurement.bulkPreset : 'none';
  const bulkPacks = { ...BULK[preset].packs };
  const bulk = bulkInvoice(preset, o.difficultyCost);
  let after = packed.pantry;
  let queuedOrderId = null;
  let expectedArrivalDay = null;
  if (preset !== 'none') {
    const orderId = after.nextOrderId;
    const arrival = arrivalDay(o.campaignSeed, orderId, o.day);
    const order = { orderId, placedDay: o.day, dueDay: o.day + 1, arrivalDay: arrival, packs: bulkPacks, invoice: bulk, preset };
    after = { ...after, nextOrderId: orderId + 1, incoming: [...after.incoming, order] };
    queuedOrderId = orderId;
    expectedArrivalDay = arrival;
  }
  return {
    packingVersion: 1,
    pantryBeforePacking: o.pantry,
    required,
    usedFromPantry: packed.usedFromPantry,
    cornerPacks: corner.packs,
    cornerInvoice: corner.invoice,
    staffDiscount: 0,
    bulkPreset: preset,
    bulkPacks,
    bulkInvoice: bulk,
    queuedOrderId,
    expectedArrivalDay,
    lemonFreshnessBonus: packed.lemonFreshnessBonus,
    pantryAfterPacking: after,
  };
}

/** Overnight: perishables spoil, Bulk Club deliveries arrive. */
export function advancePantry(pantry, day) {
  if (day === pantry.lastProcessedDay) return pantry;
  if (day !== pantry.lastProcessedDay + 1) throw new Error('Pantry days must advance exactly once');
  const spoiled = emptySupplies();
  const lots = pantry.lots.filter((l) => {
    const off = l.expiresAfterDay !== null && l.expiresAfterDay < day;
    if (off) spoiled[l.supply] += l.units;
    return !off;
  });
  const arrived = pantry.incoming.filter((o) => o.arrivalDay <= day).sort((a, b) => a.orderId - b.orderId);
  let next = { ...pantry, lots, incoming: pantry.incoming.filter((o) => o.arrivalDay > day) };
  for (const order of arrived) next = addLots(next, order.packs, 'bulk', day);
  const cumulative = { ...pantry.cumulativeSpoiled };
  for (const s of SUPPLIES) cumulative[s] += spoiled[s];
  return {
    ...next,
    lastProcessedDay: day,
    cumulativeSpoiled: cumulative,
    lastAdvance: {
      day,
      spoiled,
      arrivedOrderIds: arrived.map((o) => o.orderId),
      delayedOrderIds: next.incoming.filter((o) => o.dueDay <= day && o.arrivalDay > day).map((o) => o.orderId),
    },
  };
}

// ---------------------------------------------------------------- the Sunshine Crew

export const STAFF_IDS = ['mia', 'priya', 'theo', 'june'];
export const STAFF = {
  mia: { name: 'Mia Flores', shortName: 'Mia', role: 'Counter Captain', portrait: 'M', tone: 'teal', wage: 15, unlock: 'Available now', effect: '+10 service \xB7 +2 delight', resultBark: 'A smooth counter keeps the whole stand sunny.' },
  priya: { name: 'Priya Nair', shortName: 'Priya', role: 'Prep Lead', portrait: 'P', tone: 'coral', wage: 8, unlock: 'Joins day 2', effect: '+10 quality \xB7 40% off stock orders', resultBark: 'Measure twice, pour once — that batch was dialed in.' },
  theo: { name: 'Theo Kim', shortName: 'Theo', role: 'Local Promoter', portrait: 'T', tone: 'blue', wage: 12, unlock: 'Complete a contract or reach day 3', effect: '+12% visitors \xB7 event & marketing boost', resultBark: 'A little local buzz can travel all across town.' },
  june: { name: 'June Bell', shortName: 'June', role: 'Hospitality Star', portrait: 'J', tone: 'purple', wage: 14, unlock: 'Reach 60 reputation or day 5', effect: '+10 delight \xB7 +5% purchase interest', resultBark: 'People remember how a good cup made them feel.' },
};

export function unlockRoster(roster, day, contractMet, reputation) {
  return {
    mia: { ...roster.mia, unlocked: true },
    priya: { ...roster.priya, unlocked: roster.priya.unlocked || day >= 2 },
    theo: { ...roster.theo, unlocked: roster.theo.unlocked || day >= 3 || contractMet },
    june: { ...roster.june, unlocked: roster.june.unlocked || day >= 5 || reputation >= 60 },
  };
}

export function newRoster(day = 1, contractMet = false, reputation = 50) {
  const fresh = (unlocked) => ({ unlocked, fatigue: 0, morale: 0, shifts: 0 });
  return unlockRoster({ mia: fresh(true), priya: fresh(false), theo: fresh(false), june: fresh(false) }, day, contractMet, reputation);
}

const skillScale = (fatigue) => (fatigue === 2 ? 0.75 : 1);
export const fatigueLabel = (f) => (f === 0 ? 'Fresh' : f === 1 ? 'Ready' : 'Tired');
export const moraleLabel = (m) => (m === 1 ? 'Bright' : m === -1 ? 'Wobbly' : 'Steady');

export function shiftFor(id, roster) {
  if (!id || !roster[id]?.unlocked) return null;
  const r = roster[id];
  return { id, wage: STAFF[id].wage, fatigueAtOpen: r.fatigue, moraleAtOpen: r.morale, skillScale: skillScale(r.fatigue) };
}

export function staffModifiers(shift, ctx) {
  const none = { wage: 0, supplyDiscount: 0, qualityBonus: 0, visitorMultiplier: 1, capacityBonus: 0, buyBonus: 0, delightBonus: 0 };
  if (!shift) return none;
  const k = shift.skillScale;
  const m = { ...none, wage: shift.wage, delightBonus: shift.moraleAtOpen * 2 };
  if (shift.id === 'mia') {
    m.capacityBonus = Math.ceil(10 * k);
    m.delightBonus += Math.ceil(2 * k);
  } else if (shift.id === 'priya') {
    m.qualityBonus = Math.ceil(10 * k);
    m.supplyDiscount = 0.4 * k;
  } else if (shift.id === 'theo') {
    m.visitorMultiplier += (0.12 + (ctx.eventAligned ? 0.08 : 0) + (ctx.paidMarketing ? 0.06 : 0)) * k;
  } else {
    m.delightBonus += Math.ceil(10 * k);
    m.buyBonus = (0.05 + (ctx.service === 'chat' ? 0.03 : 0)) * k;
  }
  return m;
}

/** Each teammate's standout moment, which lifts their morale. */
export function roleMoment(id, o) {
  if (id === 'mia') return o.missedQueue === 0 && o.buyers >= 30;
  if (id === 'priya') return o.quality >= 90;
  if (id === 'theo') return o.visitors >= 55;
  return o.cx >= 82;
}

function rosterAfterDay(roster, shift, info) {
  return Object.fromEntries(
    STAFF_IDS.map((id) => {
      const r = roster[id];
      if (!shift || shift.id !== id) return [id, { ...r, fatigue: Math.max(0, r.fatigue - 1), morale: r.morale === -1 ? 0 : r.morale }];
      const rough = info.operatingNet < 0 || info.cx < 60;
      const proud = info.contractMet || info.roleMoment;
      const morale = rough ? clamp(-1, 1, r.morale - 1) : proud ? clamp(-1, 1, r.morale + 1) : r.morale;
      return [id, { ...r, fatigue: Math.min(2, r.fatigue + 1), morale, shifts: r.shifts + 1 }];
    })
  );
}

function rosterAfterOutcome(roster, shift, o) {
  return rosterAfterDay(roster, shift, { operatingNet: o.net, cx: o.cx, contractMet: o.contractMet, roleMoment: shift ? roleMoment(shift.id, o) : false });
}

// ---------------------------------------------------------------- the town

export const DEFAULT_SETTINGS = { sound: true, volume: 0.55, reducedMotion: false, highContrast: false, largeText: false };

export const DIFFICULTY = {
  relaxed: { name: 'Easy Squeezy', note: 'More cash, friendlier crowds', startingCash: 50, demand: 1.08, cost: 0.9, target: 260 },
  standard: { name: 'Fresh Start', note: 'The intended first-week challenge', startingCash: 35, demand: 1, cost: 1, target: 450 },
  tycoon: { name: 'Main Squeeze', note: 'Tighter margins, tougher customers', startingCash: 28, demand: 0.92, cost: 1.12, target: 500 },
};
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY);

export const LOCATIONS = {
  park: { name: 'Maple Park', kicker: 'Families & dog walkers', icon: '♣', fee: 2, passers: 60, wtp: 2.5, lemon: 3, sugar: 6, weather: { Hot: 1.2, Sunny: 1, Cloudy: 0.8, Rain: 0.55 } },
  plaza: { name: 'Civic Plaza', kicker: 'Office lunch crowd', icon: '▦', fee: 7, passers: 48, wtp: 3.25, lemon: 4, sugar: 4, weather: { Hot: 1, Sunny: 1, Cloudy: 0.95, Rain: 0.8 } },
  beach: { name: 'Sunset Beach', kicker: 'Big crowds, big rent', icon: '≈', fee: 14, passers: 62, wtp: 2.9, lemon: 3, sugar: 7, weather: { Hot: 1.4, Sunny: 1.1, Cloudy: 0.65, Rain: 0.25 } },
  // New in this release: the growers' market in the old mill yard.
  market: {
    name: 'Old Mill Market',
    kicker: 'Growers & browsers \xB7 cheap lemons',
    icon: '✿',
    fee: 5,
    passers: 46,
    wtp: 2.75,
    lemon: 4,
    sugar: 5,
    weather: { Hot: 1.05, Sunny: 1.05, Cloudy: 0.95, Rain: 0.6 },
    lemonDiscount: 0.35,
    marketDays: [2, 4, 6],
    marketBoost: 1.4,
  },
};
export const LOCATION_IDS = Object.keys(LOCATIONS);

/** Days 2, 4 and 6 are market days at Old Mill Market. */
export const isMarketDay = (day) => LOCATIONS.market.marketDays.includes(day);
export const marketMultiplier = (location, day) => (location === 'market' && isMarketDay(day) ? LOCATIONS.market.marketBoost : 1);

const BASE_FORECAST = [
  { label: 'Sunny', icon: '☀', temp: 24, event: 'A perfectly ordinary Thursday', eventMultiplier: 1 },
  { label: 'Hot', icon: '☀', temp: 29, event: 'Youth soccer finals at Maple Park', eventLocation: 'park', eventMultiplier: 1.65 },
  { label: 'Cloudy', icon: '◒', temp: 20, event: 'Design conference at Civic Plaza', eventLocation: 'plaza', eventMultiplier: 1.5 },
  { label: 'Rain', icon: '☂', temp: 16, event: 'A soggy afternoon around town', eventMultiplier: 1 },
  { label: 'Hot', icon: '☀', temp: 31, event: 'Sandcastle contest at Sunset Beach', eventLocation: 'beach', eventMultiplier: 1.5 },
  { label: 'Sunny', icon: '☀', temp: 26, event: 'Weekend shoppers fill the plaza', eventLocation: 'plaza', eventMultiplier: 1.7 },
  { label: 'Sunny', icon: '✦', temp: 27, event: "Founders' Day — the whole town is out", eventMultiplier: 1.25 },
];
const FORECAST_DECKS = [
  [BASE_FORECAST[0], { label: 'Cloudy', icon: '◒', temp: 21, event: 'Community garden swap at Maple Park', eventLocation: 'park', eventMultiplier: 1.28 }, { label: 'Sunny', icon: '☀', temp: 25, event: 'A welcome-week lunch spills into Civic Plaza', eventLocation: 'plaza', eventMultiplier: 1.3 }],
  [BASE_FORECAST[1], { label: 'Sunny', icon: '☀', temp: 26, event: 'Food-truck rally at Civic Plaza', eventLocation: 'plaza', eventMultiplier: 1.55 }, { label: 'Hot', icon: '☀', temp: 30, event: 'Junior surf clinic at Sunset Beach', eventLocation: 'beach', eventMultiplier: 1.55 }],
  [BASE_FORECAST[2], { label: 'Sunny', icon: '☀', temp: 25, event: 'Ferry excursion docks by Sunset Beach', eventLocation: 'beach', eventMultiplier: 1.45 }, { label: 'Cloudy', icon: '◒', temp: 22, event: 'Library picnic fills Maple Park', eventLocation: 'park', eventMultiplier: 1.5 }],
  [BASE_FORECAST[3], { label: 'Cloudy', icon: '◒', temp: 19, event: 'A quiet midweek afternoon around town', eventMultiplier: 1 }, { label: 'Rain', icon: '☂', temp: 18, event: 'Umbrella art walk at Civic Plaza', eventLocation: 'plaza', eventMultiplier: 1.38 }],
  [BASE_FORECAST[4], { label: 'Hot', icon: '☀', temp: 29, event: 'Summer games take over Maple Park', eventLocation: 'park', eventMultiplier: 1.55 }, { label: 'Sunny', icon: '☀', temp: 27, event: 'Street musicians gather at Civic Plaza', eventLocation: 'plaza', eventMultiplier: 1.5 }],
  [BASE_FORECAST[5], { label: 'Sunny', icon: '☀', temp: 25, event: 'Sunset concert packs the beach', eventLocation: 'beach', eventMultiplier: 1.65 }, { label: 'Sunny', icon: '☀', temp: 24, event: 'Family reunion day at Maple Park', eventLocation: 'park', eventMultiplier: 1.6 }],
  [BASE_FORECAST[6], { label: 'Hot', icon: '✦', temp: 30, event: "Founders' Day parade crosses the whole town", eventMultiplier: 1.28 }, { label: 'Cloudy', icon: '✦', temp: 22, event: "Founders' Day market opens townwide", eventMultiplier: 1.22 }],
];

/** Today's weather and event. Deck 0 is the fixed first-release week; deck 1 varies by campaign seed. */
export function forecastFor(day, seed, deck = 1) {
  const n = (((Math.max(1, Math.round(day)) - 1) % FORECAST_DECKS.length) + FORECAST_DECKS.length) % FORECAST_DECKS.length;
  if (deck === 0) return BASE_FORECAST[n];
  let h = (seed ^ 246813579) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, (73244475 + n * 668265261) | 1) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  const deckDay = FORECAST_DECKS[n];
  return deckDay[h % deckDay.length];
}

export const TRANSPORT = {
  crate: { name: 'Carry crate', icon: '▣', cost: 0, capacity: 30 },
  bike: { name: 'Bike trailer', icon: '◉', cost: 5, capacity: 50 },
  van: { name: 'Delivery van', icon: '▰', cost: 10, capacity: 90 },
};
export const MARKETING = {
  none: { name: 'Word of mouth', cost: 0, multiplier: 1 },
  chalk: { name: 'Chalkboard', cost: 5, multiplier: 1.14 },
  flyers: { name: 'Color flyers', cost: 12, multiplier: 1.28 },
};
export const SERVICE = {
  quick: { name: 'Quick pours', note: '+8 service \xB7 −7 delight', capacity: 8, cx: -7, buy: 0 },
  chat: { name: 'Sunny chats', note: '+9 delight \xB7 +2% interest', capacity: 0, cx: 9, buy: 0.02 },
  samples: { name: 'Free samples', note: '+7% interest \xB7 +1 delight', capacity: -5, cx: 1, buy: 0.07 },
};

export const BASIC_UPGRADES = ['sign', 'pitcher', 'cooler', 'umbrella', 'facelift'];
export const SPECIALTIES = ['festival', 'rail', 'tasting'];
export const UPGRADES = {
  sign: { name: 'Bright sign', icon: '✦', cost: 30, note: '+12% visitors forever' },
  pitcher: { name: 'Second pitcher', icon: '◒', cost: 55, note: '+12 cups service capacity' },
  cooler: { name: 'Cooler', icon: '❄', cost: 22, note: 'Hot-day quality and conversion boost' },
  umbrella: { name: 'Rain umbrella', icon: '☂', cost: 10, note: 'Keeps rainy-day traffic moving' },
  facelift: { name: 'Booth facelift', icon: '♥', cost: 45, note: '+5% interest and +5 delight' },
  festival: { name: 'Festival bunting', icon: '⚑', cost: 58, note: '+18% visitors when your pitch catches today’s event', requires: 'sign', minResultDay: 3, exclusiveGroup: 'specialty' },
  rail: { name: 'Express rail', icon: '\xBB', cost: 35, note: '+8 capacity \xB7 Quick Pours adds 4 more', requires: 'pitcher', minResultDay: 3, exclusiveGroup: 'specialty' },
  tasting: { name: 'Tasting counter', icon: '◈', cost: 45, note: 'Free Samples gain capacity, interest and delight', requires: 'facelift', minResultDay: 3, exclusiveGroup: 'specialty' },
};

/** Can this upgrade be bought now? The stand always keeps enough cash for a basic day. */
export function upgradeCheck(day, difficulty, cash, owned, id) {
  const u = UPGRADES[id];
  const cashAfter = round2(cash - u.cost);
  let block = null;
  if (owned.includes(id)) block = 'owned';
  else if (u.minResultDay && day < u.minResultDay) block = 'unlocks-later';
  else if (u.exclusiveGroup && owned.some((o) => o !== id && UPGRADES[o].exclusiveGroup === u.exclusiveGroup)) block = 'specialty-chosen';
  else if (u.requires && !owned.includes(u.requires)) block = 'requires';
  else if (cashAfter < minimumSpend(difficulty)) block = 'reserve';
  return { allowed: block === null, block, cashAfter };
}

export const ACHIEVEMENTS = {
  first_day: { name: 'Open for Business', icon: '☀', note: 'Finish your first day' },
  sold_out: { name: 'Last Drop', icon: '◇', note: 'Sell out with neighbors still asking' },
  perfect_batch: { name: 'Golden Recipe', icon: '●', note: 'Reach 100 recipe quality' },
  zero_waste: { name: 'Nothing Wasted', icon: '♻', note: 'End a day with zero waste' },
  town_tour: { name: 'Town Tour', icon: '⌖', note: 'Serve at three different pitches' },
  cash_200: { name: 'Freshly Funded', icon: '$', note: 'Hold $200 in cash' },
  beloved: { name: 'Local Favorite', icon: '♥', note: 'Reach 80 reputation' },
  market_day: { name: 'Market Regular', icon: '✿', note: 'Turn a profit at Old Mill Market on a market day' },
};
export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS);

export const CONTRACTS = [
  { title: 'Opening Day', note: 'Sell at least 18 cups', field: 'sales', target: 18, reward: 8 },
  { title: 'Fresh Reputation', note: 'Serve a quality 85+ batch', field: 'quality', target: 85, reward: 10 },
  { title: 'Crowd Pleaser', note: 'Welcome at least 55 visitors', field: 'visitors', target: 55, reward: 12 },
  { title: 'Waste Watch', note: 'Waste no more than 6 cups', field: 'wasteMax', target: 6, reward: 12 },
  { title: 'Busy Counter', note: 'Sell at least 30 cups', field: 'sales', target: 30, reward: 15 },
  { title: 'A Delightful Day', note: 'Reach 82 customer delight', field: 'cx', target: 82, reward: 16 },
  { title: "Founders' Favorite", note: 'Finish with 65+ reputation', field: 'reputation', target: 65, reward: 20 },
];
export const contractFor = (day) => CONTRACTS[(day - 1) % CONTRACTS.length];

export function contractMet(day, o) {
  const c = contractFor(day);
  if (c.field === 'wasteMax') return o.waste <= c.target;
  if (c.field === 'reputation') return o.repNext >= c.target;
  return o[c.field] >= c.target;
}

/** What a Bulk Club order really cost once Priya's supplier discount is taken off. */
export function paidBulk(pack, shift) {
  const discount = shift?.id === 'priya' ? 0.4 * shift.skillScale : 0;
  return round2(pack.bulkInvoice * (1 - discount));
}

function orderReceipt(outcome, day) {
  if (outcome.pack.bulkPreset === 'none' || outcome.pack.queuedOrderId === null) return null;
  return { orderId: outcome.pack.queuedOrderId, placedDay: day, preset: outcome.pack.bulkPreset, grossInvoice: outcome.pack.bulkInvoice, paidInvoice: paidBulk(outcome.pack, outcome.staffShift) };
}

function seededRandom(seed) {
  let s = seed || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

/** The planner's forecast: costs, recipe quality, expected visitors and sales. */
export function forecastPlan(p) {
  const weather = forecastFor(p.day, p.campaignSeed, p.forecastDeck ?? 1);
  const loc = LOCATIONS[p.location];
  const diff = DIFFICULTY[p.difficulty];
  const batches = p.prepared / 10;
  const shift = shiftFor(p.scheduledStaff, p.staffRoster);
  const aligned = !weather.eventLocation || weather.eventLocation === p.location;
  const staff = staffModifiers(shift, { eventAligned: aligned && weather.eventMultiplier > 1, paidMarketing: p.marketing !== 'none', service: p.service });
  const packed = packDay({
    pantry: p.pantry,
    procurement: p.procurement,
    day: p.day,
    campaignSeed: p.campaignSeed,
    difficultyCost: diff.cost,
    lemonDiscount: loc.lemonDiscount || 0,
    prepared: p.prepared,
    lemon: p.lemon,
    sugar: p.sugar,
    ice: p.ice,
  });
  const gross = round2(packed.cornerInvoice + packed.bulkInvoice);
  const staffDiscount = round2(gross * staff.supplyDiscount);
  const pack = { ...packed, staffDiscount };
  const supplies = round2(gross - staffDiscount);
  const expenseItems = { supplies, pitch: loc.fee, transport: TRANSPORT[p.transport].cost, marketing: MARKETING[p.marketing].cost, staff: staff.wage, service: 0 };
  const expenses = round2(Object.values(expenseItems).reduce((a, b) => a + b, 0));
  const idealIce = clamp(4, 10, Math.round(4 + (weather.temp - 18) / 2) + (p.location === 'beach' ? 1 : 0));
  const coolerBonus = p.upgrades.includes('cooler') && weather.temp > 27 ? 5 : 0;
  const quality = Math.round(
    clamp(35, 100, 98 - 13 * Math.abs(p.lemon - loc.lemon) - 7 * Math.abs(p.sugar - loc.sugar) - 3 * Math.abs(p.ice - idealIce) + pack.lemonFreshnessBonus + coolerBonus + staff.qualityBonus)
  );
  let weatherMult = loc.weather[weather.label] ?? 1;
  if (weather.label === 'Rain' && p.upgrades.includes('umbrella')) weatherMult = Math.min(1, weatherMult + 0.35);
  const eventMult = aligned ? weather.eventMultiplier : 1;
  const bunting = p.upgrades.includes('festival') && aligned && weather.eventMultiplier > 1 ? 1.18 : 1;
  const visitors = Math.round(
    loc.passers *
      weatherMult *
      eventMult *
      bunting *
      marketMultiplier(p.location, p.day) *
      MARKETING[p.marketing].multiplier *
      staff.visitorMultiplier *
      (p.upgrades.includes('sign') ? 1.12 : 1) *
      (0.8 + p.reputation / 250) *
      diff.demand
  );
  const coolHot = weather.label === 'Hot' && p.upgrades.includes('cooler');
  const tasting = p.upgrades.includes('tasting') && p.service === 'samples';
  const pBuy = clamp(
    0.05,
    0.8,
    0.24 + 0.005 * (quality - 60) + 0.2 * (loc.wtp - p.price) + SERVICE[p.service].buy + staff.buyBonus + (p.upgrades.includes('facelift') ? 0.05 : 0) + (coolHot ? 0.04 : 0) + (tasting ? 0.04 : 0)
  );
  const rail = p.upgrades.includes('rail') ? 8 + (p.service === 'quick' ? 4 : 0) : 0;
  const serviceCapacity = 26 + SERVICE[p.service].capacity + staff.capacityBonus + (p.upgrades.includes('pitcher') ? 12 : 0) + rail + (tasting ? 5 : 0);
  const expected = Math.round(Math.min(visitors * pBuy, p.prepared, serviceCapacity));
  return {
    batches,
    supplies,
    expenses,
    expenseItems,
    pack,
    staffShift: shift,
    staff,
    quality,
    visitors,
    pBuy,
    serviceCapacity,
    expected,
    low: Math.max(0, Math.round(expected * 0.85)),
    high: Math.min(p.prepared, serviceCapacity, Math.round(expected * 1.15)),
    affordable: expenses <= p.cash,
    idealIce,
  };
}

/** The cheapest sensible day: 10 cups at Maple Park, walking, solo. */
const minimumCache = {};
export function minimumSpend(difficulty) {
  if (minimumCache[difficulty] !== undefined) return minimumCache[difficulty];
  return (minimumCache[difficulty] = forecastPlan({
    day: 1,
    cash: Number.MAX_SAFE_INTEGER,
    reputation: 50,
    difficulty,
    campaignSeed: 1,
    forecastDeck: 1,
    location: 'park',
    transport: 'crate',
    prepared: 10,
    lemon: 3,
    sugar: 6,
    ice: 7,
    price: 2.5,
    marketing: 'none',
    service: 'chat',
    scheduledStaff: null,
    staffRoster: newRoster(),
    upgrades: [],
    pantry: newPantry(1),
    procurement: DEFAULT_PROCUREMENT,
  }).expenses);
}

/** Run a day: who walked by, who bought, what they said. */
export function simulateDay(p, plan = forecastPlan(p)) {
  const loc = LOCATIONS[p.location];
  const rand = seededRandom((p.campaignSeed ^ Math.imul(p.day, 2654435761)) >>> 0);
  const visitors = Math.max(1, Math.round(plan.visitors * (0.9 + rand() * 0.2)));
  let buyers = 0;
  for (let i = 0; i < visitors; i++) if (rand() < plan.pBuy) buyers++;
  const sales = Math.min(buyers, p.prepared, plan.serviceCapacity);
  const missedStock = Math.max(0, Math.min(buyers, plan.serviceCapacity) - p.prepared);
  const missedQueue = Math.max(0, buyers - plan.serviceCapacity);
  const revenue = round2(sales * p.price);
  const net = round2(revenue - plan.expenses);
  const crowding = 18 * Math.max(0, buyers / Math.max(1, plan.serviceCapacity) - 0.8);
  const disappointed = (25 * (buyers - sales)) / Math.max(1, buyers);
  const cx = Math.round(
    clamp(0, 100, 35 + 0.52 * plan.quality + SERVICE[p.service].cx + plan.staff.delightBonus + (p.upgrades.includes('facelift') ? 5 : 0) + (p.upgrades.includes('tasting') && p.service === 'samples' ? 3 : 0) - crowding - disappointed)
  );
  const repNext = Math.round(0.8 * p.reputation + 0.2 * cx);
  const waste = Math.max(0, p.prepared - sales);
  const comments = [];
  if (Math.abs(p.lemon - loc.lemon) >= 1) comments.push(p.lemon > loc.lemon ? 'Whew — that one had some zing!' : 'I wanted a little more lemon snap.');
  if (Math.abs(p.sugar - loc.sugar) >= 2) comments.push(p.sugar > loc.sugar ? 'Very sweet, but my kid loved it.' : 'A spoonful more sugar would be lovely.');
  if (Math.abs(p.ice - plan.idealIce) >= 2) comments.push(p.ice < plan.idealIce ? 'Cold cups would hit the spot today.' : 'More lemonade, less ice next time.');
  if (p.price > loc.wtp + 0.25) comments.push('Tasty, but that price made me think twice.');
  if (missedStock > 0) comments.push('The sold-out sign showed up too soon.');
  if (missedQueue > 0) comments.push('The line moved like a melting glacier.');
  if (comments.length < 3 && p.location === 'market' && isMarketDay(p.day) && plan.quality >= 80) comments.push('Tastes like it came straight from the growers’ stalls!');
  if (comments.length < 3 && plan.quality >= 82) comments.push('Bright, balanced, and seriously refreshing!');
  if (comments.length < 3 && cx >= 75) comments.push('The friendliest little stand in town.');
  if (comments.length < 3) comments.push('I’d stop by again tomorrow.');
  const outcome = {
    location: p.location,
    supplier: 'corner',
    transport: p.transport,
    lemon: p.lemon,
    sugar: p.sugar,
    ice: p.ice,
    marketing: p.marketing,
    service: p.service,
    upgradesAtOpen: [...p.upgrades],
    price: p.price,
    prepared: p.prepared,
    forecastLow: plan.low,
    forecastHigh: plan.high,
    quality: plan.quality,
    visitors,
    buyers,
    sales,
    serviceCapacity: plan.serviceCapacity,
    revenue,
    expenses: plan.expenses,
    expenseItems: plan.expenseItems,
    pack: plan.pack,
    staffShift: plan.staffShift,
    net,
    cx,
    repNext,
    reputationBefore: p.reputation,
    waste,
    missedStock,
    missedQueue,
    comments: comments.slice(0, 3),
  };
  const met = contractMet(p.day, outcome);
  return { ...outcome, contractMet: met, contractReward: met ? contractFor(p.day).reward : 0 };
}

/** The noon rush: hustle, pass samples, or keep the rhythm. */
export function resolveRush(o, choice, day) {
  let { sales, buyers, cx, expenses, expenseItems, serviceCapacity } = o;
  const { prepared, price, reputationBefore } = o;
  if (choice === 'hustle') {
    const extra = o.staffShift?.id === 'mia' ? 5 : 3;
    serviceCapacity += extra;
    sales += Math.min(extra, Math.max(0, prepared - sales), Math.max(0, buyers - sales));
    cx -= Math.max(0, (o.staffShift?.id === 'mia' ? 3 : 4) - (o.upgradesAtOpen.includes('rail') ? 2 : 0));
  } else if (choice === 'samples') {
    buyers = Math.min(o.visitors, buyers + 5);
    sales += Math.min(2, Math.max(0, prepared - sales), Math.max(0, serviceCapacity - sales), Math.max(0, buyers - sales));
    expenses += 1.5;
    expenseItems = { ...expenseItems, service: expenseItems.service + 1.5 };
    cx += 3;
  } else {
    cx += o.staffShift?.id === 'june' ? 4 : 2;
  }
  cx = Math.round(clamp(0, 100, cx));
  const revenue = round2(sales * price);
  const next = {
    ...o,
    sales,
    buyers,
    serviceCapacity,
    cx,
    expenses,
    expenseItems,
    revenue,
    net: round2(revenue - expenses),
    repNext: Math.round(0.8 * reputationBefore + 0.2 * cx),
    waste: Math.max(0, prepared - sales),
    missedStock: Math.max(0, Math.min(buyers, serviceCapacity) - prepared),
    missedQueue: Math.max(0, buyers - serviceCapacity),
    serviceChoice: choice,
  };
  const met = contractMet(day, next);
  return { ...next, contractMet: met, contractReward: met ? contractFor(day).reward : 0 };
}

export const rushNeeded = (o) => !!(o && (o.missedQueue > 0 || o.buyers >= o.serviceCapacity * 0.82));
export const RUSH_AT = 0.42;

function updateAchievements(history, o, owned, upgrades, cash, day) {
  const set = new Set(owned);
  set.add('first_day');
  if (o.waste === 0) {
    set.add('zero_waste');
    // Last Drop: the batch sold out while neighbors were still asking for more
    // (it used to be the exact same condition as Nothing Wasted).
    if (o.missedStock > 0) set.add('sold_out');
  }
  if (o.quality >= 100) set.add('perfect_batch');
  if (new Set(history.map((h) => h.location)).size >= 3) set.add('town_tour');
  if (cash >= 200 || upgrades.reduce((sum, u) => sum + UPGRADES[u].cost, cash) >= 200) set.add('cash_200');
  if (o.repNext >= 80) set.add('beloved');
  if (o.location === 'market' && isMarketDay(day) && o.net + o.contractReward > 0) set.add('market_day');
  return ACHIEVEMENT_IDS.filter((id) => set.has(id));
}

export function newCampaign(difficulty = 'standard', campaignSeed = 1, tutorialComplete = false) {
  return {
    campaignSeed,
    forecastDeck: 1,
    difficulty,
    day: 1,
    cash: DIFFICULTY[difficulty].startingCash,
    reputation: 50,
    phase: 'plan',
    location: 'park',
    supplier: 'corner',
    transport: 'crate',
    prepared: 30,
    lemon: 3,
    sugar: 6,
    ice: 7,
    price: 2.5,
    marketing: 'none',
    service: 'chat',
    scheduledStaff: null,
    staffRoster: newRoster(),
    staffIntroductionsSeen: ['mia'],
    upgrades: [],
    progress: 0,
    outcome: null,
    history: [],
    achievements: [],
    tutorialComplete,
    serviceDecisionMade: false,
    emergencyUsed: false,
    emergencyAcceptedDay: null,
    pantry: newPantry(1),
    procurement: DEFAULT_PROCUREMENT,
    orderReceipts: [],
    endedEarly: false,
  };
}

/** The plan inputs for the day being planned (or the pantry the open day packed from). */
export function planInput(s) {
  const open = s.phase !== 'plan' && s.outcome;
  return {
    day: s.day,
    cash: s.cash,
    reputation: s.reputation,
    difficulty: s.difficulty,
    campaignSeed: s.campaignSeed,
    forecastDeck: s.forecastDeck,
    location: s.location,
    transport: s.transport,
    prepared: s.prepared,
    lemon: s.lemon,
    sugar: s.sugar,
    ice: s.ice,
    price: s.price,
    marketing: s.marketing,
    service: s.service,
    scheduledStaff: s.scheduledStaff,
    staffRoster: s.staffRoster,
    upgrades: s.upgrades,
    pantry: open ? s.outcome.pack.pantryBeforePacking ?? s.pantry : s.pantry,
    procurement: open ? { bulkPreset: s.outcome.pack.bulkPreset ?? 'none' } : s.procurement,
  };
}

function planPatch(s, patch) {
  const out = {};
  if (patch.location && LOCATION_IDS.includes(patch.location)) out.location = patch.location;
  if (Number.isInteger(patch.prepared) && patch.prepared >= 10 && patch.prepared <= TRANSPORT[s.transport].capacity && patch.prepared % 10 === 0) out.prepared = patch.prepared;
  if (Number.isInteger(patch.lemon) && patch.lemon >= 2 && patch.lemon <= 5) out.lemon = patch.lemon;
  if (Number.isInteger(patch.sugar) && patch.sugar >= 3 && patch.sugar <= 9) out.sugar = patch.sugar;
  if (Number.isInteger(patch.ice) && patch.ice >= 0 && patch.ice <= 10) out.ice = patch.ice;
  if (typeof patch.price === 'number' && Number.isFinite(patch.price) && patch.price >= 1 && patch.price <= 5 && Math.abs(patch.price * 4 - Math.round(patch.price * 4)) < 0.001) out.price = patch.price;
  if (patch.marketing && MARKETING[patch.marketing]) out.marketing = patch.marketing;
  if (patch.service && SERVICE[patch.service]) out.service = patch.service;
  return out;
}

/** Close the books on an open day. */
function settleDay(s) {
  if (s.phase !== 'open' || !s.outcome) return s;
  const o = s.outcome;
  const cash = round2(s.cash + o.net + o.contractReward);
  const entry = {
    day: s.day,
    location: o.location,
    sales: o.sales,
    revenue: o.revenue,
    expenses: o.expenses,
    net: o.net + o.contractReward,
    cx: o.cx,
    reputation: o.repNext,
    quality: o.quality,
    waste: o.waste,
    visitors: o.visitors,
    buyers: o.buyers,
    missedQueue: o.missedQueue,
    contractMet: o.contractMet,
    staffId: o.staffShift?.id ?? null,
    staffShift: o.staffShift,
    staffRoleMoment: o.staffShift ? roleMoment(o.staffShift.id, o) : false,
    pack: o.pack,
    outcome: o,
  };
  const history = [...s.history.filter((h) => h.day !== s.day), entry];
  return {
    ...s,
    cash,
    reputation: o.repNext,
    history,
    achievements: updateAchievements(history, o, s.achievements, s.upgrades, cash, s.day),
    staffRoster: rosterAfterOutcome(s.staffRoster, o.staffShift, o),
    progress: 1,
    phase: s.day >= 7 ? 'week-end' : 'results',
  };
}

/** Is the week stuck? Too little cash for the cheapest day, and the Sunshine Fund is spent. */
export function isStranded(s) {
  if (s.phase !== 'plan' || !s.emergencyUsed) return false;
  if (s.cash >= minimumSpend(s.difficulty)) return false;
  // The pantry may still cover a small batch: check the cheapest plan with today's pantry.
  const cheapest = forecastPlan({ ...planInput(s), location: 'park', transport: 'crate', prepared: 10, lemon: 2, sugar: 3, ice: 0, marketing: 'none', scheduledStaff: null, procurement: DEFAULT_PROCUREMENT });
  return cheapest.expenses > s.cash;
}

export function reducer(s, a) {
  switch (a.type) {
    case 'RESTORED':
      return a.save;
    case 'DIFFICULTY_SELECTED':
      return s.difficulty === a.difficulty || !DIFFICULTY[a.difficulty] ? s : { ...s, difficulty: a.difficulty };
    case 'NEW_CAMPAIGN_STARTED':
      return newCampaign(a.difficulty, a.campaignSeed, a.tutorialComplete);
    case 'PLAN_UPDATED': {
      if (s.phase !== 'plan') return s;
      const patch = planPatch(s, a.patch);
      return Object.keys(patch).length ? { ...s, ...patch } : s;
    }
    case 'BULK_PRESET_SELECTED':
      return s.phase !== 'plan' || s.day <= 1 || s.day >= 7 || !BULK[a.preset] || s.procurement.bulkPreset === a.preset ? s : { ...s, procurement: { bulkPreset: a.preset } };
    case 'STAFF_SCHEDULED':
      return s.phase !== 'plan' || (a.staff !== null && (!STAFF_IDS.includes(a.staff) || !s.staffRoster[a.staff].unlocked)) || s.scheduledStaff === a.staff ? s : { ...s, scheduledStaff: a.staff };
    case 'TRANSPORT_SELECTED': {
      if (s.phase !== 'plan' || !TRANSPORT[a.transport]) return s;
      const prepared = Math.min(s.prepared, TRANSPORT[a.transport].capacity);
      return s.transport === a.transport && s.prepared === prepared ? s : { ...s, transport: a.transport, prepared };
    }
    case 'STAND_OPENED': {
      if (s.phase !== 'plan') return s;
      const input = planInput(s);
      const plan = forecastPlan(input);
      if (!plan.affordable) return s;
      const outcome = simulateDay(input, plan);
      const receipt = orderReceipt(outcome, s.day);
      const orderReceipts = receipt ? [...s.orderReceipts.filter((r) => r.orderId !== receipt.orderId), receipt].sort((x, y) => x.orderId - y.orderId) : s.orderReceipts;
      return { ...s, phase: 'open', progress: 0, outcome, serviceDecisionMade: false, pantry: outcome.pack.pantryAfterPacking, procurement: DEFAULT_PROCUREMENT, orderReceipts };
    }
    case 'CLOCK_ADVANCED': {
      if (s.phase !== 'open' || !Number.isFinite(a.amount) || a.amount <= 0) return s;
      let progress = Math.min(1, s.progress + a.amount);
      if (!s.serviceDecisionMade && rushNeeded(s.outcome)) progress = Math.min(progress, RUSH_AT);
      if (progress === s.progress) return s;
      const next = { ...s, progress };
      return progress >= 1 ? settleDay(next) : next;
    }
    case 'RUSH_RESOLVED':
      if (s.phase !== 'open' || s.progress < RUSH_AT || s.serviceDecisionMade || !rushNeeded(s.outcome) || !['hustle', 'samples', 'steady'].includes(a.choice)) return s;
      return { ...s, outcome: resolveRush(s.outcome, a.choice, s.day), serviceDecisionMade: true };
    case 'DAY_SKIPPED':
      if (s.phase !== 'open') return s;
      if (!s.serviceDecisionMade && rushNeeded(s.outcome)) return s.progress === RUSH_AT ? s : { ...s, progress: RUSH_AT };
      return settleDay({ ...s, progress: 1 });
    case 'UPGRADE_PURCHASED': {
      if (s.phase !== 'results' || !UPGRADES[a.upgrade] || s.upgrades.includes(a.upgrade)) return s;
      const check = upgradeCheck(s.day, s.difficulty, s.cash, s.upgrades, a.upgrade);
      return check.allowed ? { ...s, cash: check.cashAfter, upgrades: [...s.upgrades, a.upgrade] } : s;
    }
    case 'NEXT_DAY_STARTED': {
      if (s.phase !== 'results' || s.day >= 7) return s;
      const day = s.day + 1;
      const roster = unlockRoster(s.staffRoster, day, s.history.some((h) => h.contractMet), s.reputation);
      const joined = STAFF_IDS.filter((id) => roster[id].unlocked && !s.staffIntroductionsSeen.includes(id));
      return {
        ...s,
        day,
        phase: 'plan',
        progress: 0,
        outcome: null,
        serviceDecisionMade: false,
        scheduledStaff: null,
        staffRoster: roster,
        staffIntroductionsSeen: [...s.staffIntroductionsSeen, ...joined],
        pantry: advancePantry(s.pantry, day),
        procurement: DEFAULT_PROCUREMENT,
      };
    }
    case 'EMERGENCY_FUND_ACCEPTED':
      if (s.phase !== 'plan' || s.emergencyUsed || s.cash >= minimumSpend(s.difficulty)) return s;
      return { ...s, cash: round2(s.cash + 15), reputation: Math.max(0, s.reputation - 3), emergencyUsed: true, emergencyAcceptedDay: s.day };
    case 'WEEK_WRAPPED':
      // A stranded stand closes up early and goes straight to the week's finale.
      return isStranded(s) ? { ...s, phase: 'week-end', progress: 1, outcome: null, endedEarly: true } : s;
    case 'TUTORIAL_COMPLETED':
      return s.tutorialComplete ? s : { ...s, tutorialComplete: true };
    default:
      return s;
  }
}

// ---------------------------------------------------------------- the week's score

export function weekValue(s) {
  const pantry = pantryTotals(s.pantry);
  const dryStock = round2(pantry.cups * 0.1 + pantry.sugar * 0.05);
  const value = round2(s.cash + s.upgrades.reduce((sum, u) => sum + UPGRADES[u].cost * 0.6, 0) + dryStock);
  const target = DIFFICULTY[s.difficulty].target;
  const medal = value >= target * 1.15 && s.reputation >= 70 ? 'Gold' : value >= target && s.reputation >= 60 ? 'Silver' : value >= target * 0.75 ? 'Bronze' : 'Growing';
  return { value, dryStock, medal, target };
}

export const MEDAL_RANK = { Growing: 0, Bronze: 1, Silver: 2, Gold: 3 };

/**
 * The journal's pitch notebook: for every pitch, how often the stand worked
 * there this week, its best day, and the best-tasting recipe served there
 * (only what the player has already tried, so nothing is given away).
 */
export function pitchNotes(history) {
  const notes = {};
  for (const id of LOCATION_IDS) notes[id] = { days: 0, cups: 0, bestNet: null, best: null };
  for (const h of history) {
    const n = notes[h.location];
    if (!n) continue;
    n.days += 1;
    n.cups += h.sales;
    if (n.bestNet === null || h.net > n.bestNet) n.bestNet = h.net;
    const o = h.outcome;
    if (o && Number.isInteger(o.lemon) && (!n.best || o.quality > n.best.quality || (o.quality === n.best.quality && h.net > n.best.net))) {
      n.best = { quality: o.quality, lemon: o.lemon, sugar: o.sugar, ice: o.ice, price: o.price, net: h.net, day: h.day };
    }
  }
  return notes;
}

// ---------------------------------------------------------------- save checks

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = (v, list) => typeof v === 'string' && list.includes(v);
const isSupplies = (o) => !!o && typeof o === 'object' && SUPPLIES.every((k) => isNum(o[k]) && o[k] >= 0);

function isPantry(p) {
  return (
    !!p &&
    typeof p === 'object' &&
    isInt(p.lastProcessedDay, 1, 7) &&
    isInt(p.nextLotId, 1, 1e4) &&
    isInt(p.nextOrderId, 1, 1e3) &&
    Array.isArray(p.lots) &&
    p.lots.every((l) => l && oneOf(l.supply, SUPPLIES) && isNum(l.units) && l.units > 0 && isInt(l.receivedDay, 1, 7) && oneOf(l.supplier, ['corner', 'bulk'])) &&
    Array.isArray(p.incoming) &&
    p.incoming.every((o) => o && isInt(o.orderId, 1, 1e3) && isInt(o.arrivalDay, 1, 7) && isInt(o.dueDay, 1, 8) && isSupplies(o.packs) && oneOf(o.preset, BULK_IDS)) &&
    isSupplies(p.cumulativeSpoiled) &&
    !!p.lastAdvance &&
    isSupplies(p.lastAdvance.spoiled) &&
    Array.isArray(p.lastAdvance.arrivedOrderIds) &&
    Array.isArray(p.lastAdvance.delayedOrderIds)
  );
}

function isOutcome(o) {
  return (
    !!o &&
    typeof o === 'object' &&
    oneOf(o.location, LOCATION_IDS) &&
    ['prepared', 'visitors', 'buyers', 'sales', 'serviceCapacity', 'cx', 'repNext', 'reputationBefore', 'waste', 'missedStock', 'missedQueue', 'quality', 'forecastLow', 'forecastHigh'].every((k) => Number.isInteger(o[k]) && o[k] >= 0) &&
    ['revenue', 'expenses', 'net', 'price', 'contractReward'].every((k) => isNum(o[k])) &&
    !!o.expenseItems &&
    ['supplies', 'pitch', 'transport', 'marketing', 'staff', 'service'].every((k) => isNum(o.expenseItems[k])) &&
    !!o.pack &&
    isSupplies(o.pack.required) &&
    oneOf(o.pack.bulkPreset, BULK_IDS) &&
    isNum(o.pack.cornerInvoice) &&
    isNum(o.pack.bulkInvoice) &&
    isNum(o.pack.staffDiscount) &&
    isPantry(o.pack.pantryAfterPacking) &&
    Array.isArray(o.upgradesAtOpen) &&
    Array.isArray(o.comments) &&
    typeof o.contractMet === 'boolean' &&
    (o.staffShift === null || (o.staffShift && oneOf(o.staffShift.id, STAFF_IDS) && isNum(o.staffShift.skillScale)))
  );
}

/** Enough structure to run the game from this save without surprises. */
export function isPlayableSave(s) {
  if (!s || typeof s !== 'object') return false;
  const roster = s.staffRoster;
  const ok =
    s.version === 4 &&
    s.rulesetVersion === 2 &&
    (s.contentVersion === 3 || s.contentVersion === 4) &&
    isInt(s.campaignSeed, 1, 4294967295) &&
    (s.forecastDeck === 0 || s.forecastDeck === 1) &&
    oneOf(s.difficulty, DIFFICULTY_IDS) &&
    isInt(s.day, 1, 7) &&
    isNum(s.cash) &&
    s.cash > -1e4 &&
    s.cash < 1e6 &&
    isInt(s.reputation, 0, 100) &&
    oneOf(s.phase, ['plan', 'open', 'results', 'week-end']) &&
    oneOf(s.location, LOCATION_IDS) &&
    oneOf(s.transport, Object.keys(TRANSPORT)) &&
    isInt(s.prepared, 10, TRANSPORT[s.transport].capacity) &&
    s.prepared % 10 === 0 &&
    isInt(s.lemon, 2, 5) &&
    isInt(s.sugar, 3, 9) &&
    isInt(s.ice, 0, 10) &&
    isNum(s.price) &&
    s.price >= 1 &&
    s.price <= 5 &&
    oneOf(s.marketing, Object.keys(MARKETING)) &&
    oneOf(s.service, Object.keys(SERVICE)) &&
    !!roster &&
    STAFF_IDS.every((id) => roster[id] && typeof roster[id].unlocked === 'boolean' && isInt(roster[id].fatigue, 0, 2) && isInt(roster[id].morale, -1, 1) && isInt(roster[id].shifts, 0, 7)) &&
    (s.scheduledStaff === null || (oneOf(s.scheduledStaff, STAFF_IDS) && roster[s.scheduledStaff].unlocked)) &&
    Array.isArray(s.staffIntroductionsSeen) &&
    Array.isArray(s.upgrades) &&
    s.upgrades.every((u) => UPGRADES[u]) &&
    isNum(s.progress) &&
    s.progress >= 0 &&
    s.progress <= 1 &&
    Array.isArray(s.history) &&
    s.history.every((h) => h && isInt(h.day, 1, 7) && oneOf(h.location, LOCATION_IDS) && isNum(h.net) && Number.isInteger(h.sales) && Number.isInteger(h.cx)) &&
    Array.isArray(s.achievements) &&
    typeof s.tutorialComplete === 'boolean' &&
    typeof s.serviceDecisionMade === 'boolean' &&
    typeof s.emergencyUsed === 'boolean' &&
    isPantry(s.pantry) &&
    s.pantry.lastProcessedDay === s.day &&
    !!s.procurement &&
    oneOf(s.procurement.bulkPreset, BULK_IDS) &&
    Array.isArray(s.orderReceipts);
  if (!ok) return false;
  if (s.phase === 'plan') return s.outcome === null || s.outcome === undefined;
  if (s.phase === 'week-end' && s.endedEarly) return true;
  return isOutcome(s.outcome);
}

/** Strip the save envelope and fill fields newer releases added. */
export function fromSave(save) {
  const { version, rulesetVersion, contentVersion, savedAt, migratedFrom, legacyCutoff, legacyProof, ...rest } = save;
  return {
    ...rest,
    outcome: rest.outcome ?? null,
    endedEarly: !!rest.endedEarly,
    emergencyAcceptedDay: rest.emergencyAcceptedDay ?? null,
    achievements: rest.achievements.filter((a) => ACHIEVEMENTS[a]),
  };
}

export function toSave(state, savedAt = new Date().toISOString()) {
  return { version: 4, rulesetVersion: 2, contentVersion: 4, savedAt, ...state };
}
