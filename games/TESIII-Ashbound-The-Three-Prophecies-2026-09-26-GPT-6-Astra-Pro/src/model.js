import { CAMPAIGN, SIDES, ESSENTIAL, activeStep, matchObjective } from './campaign.js';
import { clamp, hash, random, slug } from './util.js';
export const SAVE_VERSION = 3;
export const SIGN_INFO = {
  'The Warrior': 'Fortify attack 10. Straightforward and dependable.',
  'The Mage': 'An extra half-Intelligence of Magicka. No drawback.',
  'The Thief': 'Sanctuary 10: harder to hit with weapons.',
  'The Serpent': 'Star Curse poisons an enemy, but wounds the caster.',
  'The Lady': 'Endurance +25 and Personality +25.',
  'The Steed': 'Speed +25. A long road becomes a shorter one.',
  'The Lord': 'Blood of the North heals you. Fire does double damage.',
  'The Apprentice': 'Magicka +1.5× Intelligence, but weaker to magic.',
  'The Atronach': 'Magicka +2× Intelligence. Absorb half of hostile spells. Rest cannot replenish Magicka.',
  'The Ritual': 'Mara’s Gift: a powerful once-per-rest healing ability.',
  'The Lover': 'Agility +25. Lover’s Kiss paralyzes, but costs Fatigue.',
  'The Shadow': 'Moonshadow makes you invisible until you act.',
  'The Tower': 'Tower Key opens a lock without consuming a pick.',
};
export const START_SPELLS = [
  {
    id: 'embers',
    name: 'Fire Bite',
    school: 'Destruction',
    effect: 'Fire Damage',
    cost: 6,
    magnitude: 22,
    duration: 1,
    target: 'Touch',
  },
  {
    id: 'balm',
    name: 'Balyna’s Soothing Balm',
    school: 'Restoration',
    effect: 'Restore Health',
    cost: 5,
    magnitude: 22,
    duration: 1,
    target: 'Self',
  },
  {
    id: 'lift',
    name: 'Levitate',
    school: 'Alteration',
    effect: 'Levitate',
    cost: 8,
    magnitude: 10,
    duration: 22,
    target: 'Self',
  },
  { id: 'mark', name: 'Mark', school: 'Mysticism', effect: 'Mark', cost: 4, magnitude: 1, duration: 1, target: 'Self' },
  { id: 'recall', name: 'Recall', school: 'Mysticism', effect: 'Recall', cost: 8, magnitude: 1, duration: 1, target: 'Self' },
  {
    id: 'calm',
    name: 'Calm Creature',
    school: 'Illusion',
    effect: 'Calm Creature',
    cost: 7,
    magnitude: 30,
    duration: 10,
    target: 'Target',
  },
  {
    id: 'bound',
    name: 'Bound Longsword',
    school: 'Conjuration',
    effect: 'Bound Longsword',
    cost: 6,
    magnitude: 1,
    duration: 35,
    target: 'Self',
  },
  {
    id: 'soul',
    name: 'Soul Trap',
    school: 'Mysticism',
    effect: 'Soultrap',
    cost: 5,
    magnitude: 1,
    duration: 20,
    target: 'Target',
  },
  {
    id: 'open',
    name: 'Ondusi’s Open Door',
    school: 'Alteration',
    effect: 'Open',
    cost: 15,
    magnitude: 50,
    duration: 1,
    target: 'Touch',
  },
  {
    id: 'water',
    name: 'Water Walking',
    school: 'Alteration',
    effect: 'Water Walking',
    cost: 9,
    magnitude: 1,
    duration: 60,
    target: 'Self',
  },
];
const artifacts = {
  Sunder: { type: 'weapon', skill: 'Blunt Weapon', damage: 43, weight: 12, value: 5000 },
  Keening: { type: 'weapon', skill: 'Short Blade', damage: 37, weight: 4, value: 5000 },
  Wraithguard: { type: 'armor', slot: 'gauntlet', armor: 28, weight: 4, value: 3000 },
  Umbra: { type: 'weapon', skill: 'Long Blade', damage: 42, weight: 18, value: 2000, soultrap: true },
  Trueflame: { type: 'weapon', skill: 'Long Blade', damage: 45, weight: 10, value: 3500, element: 'Fire' },
  Hopesfire: { type: 'weapon', skill: 'Long Blade', damage: 48, weight: 9, value: 4000, element: 'Shock' },
  'Spear of the Hunter': { type: 'weapon', skill: 'Spear', damage: 51, weight: 10, value: 5000 },
  Fireblade: { type: 'weapon', skill: 'Long Blade', damage: 17, weight: 5, value: 160, element: 'Fire' },
  'Engraved Ring of Healing': { type: 'jewelry', slot: 'ring', heal: 18, weight: 0.1, value: 30 },
  'Ring of Azura': { type: 'jewelry', slot: 'ring', armor: 8, heal: 30, weight: 0.1, value: 900 },
  'Moon-and-Star': { type: 'jewelry', slot: 'amulet', armor: 4, weight: 0.1, value: 1000 },
  'Azura’s Star': { type: 'soul', reusable: true, weight: 1, value: 5000 },
  "Azura's Star": { type: 'soul', reusable: true, weight: 1, value: 5000 },
  'Boots of Blinding Speed': { type: 'armor', slot: 'boots', armor: 3, weight: 3, value: 400, speed: 8, blind: true },
  'Hircine’s Ring': { type: 'jewelry', slot: 'ring', wolf: true, weight: 0.1, value: 1500 },
  'Amulet of Slowfall': { type: 'jewelry', slot: 'amulet', slowfall: true, weight: 0.1, value: 150 },
  'Bonebiter Bow of Sul-Senipul': { type: 'weapon', skill: 'Marksman', damage: 26, weight: 6, value: 300 },
  'Iron Saber': { type: 'weapon', skill: 'Long Blade', damage: 15, weight: 6, value: 50 },
};
export function itemInfo(name, catalogue = { ingredients: [] }) {
  if (artifacts[name]) return { name, condition: 100, ...artifacts[name] };
  const n = name.toLowerCase();
  const tier = /daedric|royal guard|stalhrim/.test(n)
    ? 5
    : /glass|ebony|adamantium/.test(n)
      ? 4
      : /dwemer|dwarven|orcish|indoril/.test(n)
        ? 3
        : /silver|bonemold|steel|dark brotherhood/.test(n)
          ? 2
          : 1;
  if (/restore|fortify|cure|potion|flin|sujamma|mazte/.test(n))
    return {
      name,
      type: 'potion',
      weight: 0.3,
      value: 20 * tier,
      effect: /magicka/.test(n)
        ? 'magicka'
        : /fatigue/.test(n)
          ? 'fatigue'
          : /cure/.test(n)
            ? 'cure'
            : /fortify/.test(n)
              ? 'fortify'
              : 'health',
      power: /exclusive/.test(n) ? 100 : /quality/.test(n) ? 60 : 40,
    };
  if (/lockpick|probe|armorer.*hammer|repair.*hammer|prongs|sirollus/.test(n))
    return {
      name,
      type: 'tool',
      weight: 1,
      value: 25,
      uses: 25,
      tool: /pick/.test(n) ? 'pick' : /probe/.test(n) ? 'probe' : 'repair',
    };
  if (/soul gem|azura.?s star/.test(n)) return { name, type: 'soul', weight: 0.3, value: 80 * tier, reusable: /star/.test(n) };
  if (
    catalogue.ingredients?.some((i) => i.name === name) ||
    /mushroom|marshmerrow|saltrice|salts|weeping|meat|hide|pelt|root|diamond/.test(n)
  )
    return {
      name,
      type: 'ingredient',
      weight: 0.2,
      value: 6,
      effects: catalogue.ingredients?.find((i) => i.name === name)?.effects || ['Restore Health'],
    };
  if (
    /sword|blade|katana|saber|sabre|tanto|dagger|wakizashi|spear|halberd|axe|mace|club|staff|hammer|bow|crossbow|dart|arrow|shuriken|crosier/.test(
      n,
    )
  ) {
    const skill = /spear|halberd/.test(n)
      ? 'Spear'
      : /bow|dart|arrow|shuriken/.test(n)
        ? 'Marksman'
        : /axe/.test(n)
          ? 'Axe'
          : /mace|club|staff|hammer|crosier/.test(n)
            ? 'Blunt Weapon'
            : /dagger|tanto|wakizashi|shortsword/.test(n)
              ? 'Short Blade'
              : 'Long Blade';
    return {
      name,
      type: 'weapon',
      skill,
      damage: 9 + tier * 7,
      weight: skill === 'Short Blade' ? 2 : tier * 3 + 2,
      value: 30 * tier * tier,
      condition: 100,
      element: /fire/.test(n) ? 'Fire' : /storm|shock/.test(n) ? 'Shock' : /frost/.test(n) ? 'Frost' : null,
    };
  }
  if (/armor|cuirass|shield|helm|pauldron|gauntlet|bracer|greaves|boots|mail|fist of/.test(n))
    return {
      name,
      type: 'armor',
      slot: /shield/.test(n)
        ? 'shield'
        : /helm|face/.test(n)
          ? 'head'
          : /boots/.test(n)
            ? 'boots'
            : /greaves/.test(n)
              ? 'greaves'
              : /pauldron/.test(n)
                ? /left/.test(n)
                  ? 'leftPauldron'
                  : 'rightPauldron'
                : /gauntlet|bracer|fist/.test(n)
                  ? /left/.test(n)
                    ? 'leftGauntlet'
                    : 'gauntlet'
                  : 'body',
      armor: 4 + tier * 7,
      weight: tier * 5,
      value: 45 * tier * tier,
      condition: 100,
      skill: /glass|leather|chitin|brotherhood/.test(n)
        ? 'Light Armor'
        : /bonemold|orcish|indoril/.test(n)
          ? 'Medium Armor'
          : 'Heavy Armor',
    };
  if (/ring|amulet|belt|robe|shirt|pants|skirt/.test(n))
    return {
      name,
      type: 'jewelry',
      slot: /ring/.test(n)
        ? 'ring'
        : /amulet/.test(n)
          ? 'amulet'
          : /belt/.test(n)
            ? 'belt'
            : /shirt/.test(n)
              ? 'shirt'
              : /pants/.test(n)
                ? 'pants'
                : /skirt/.test(n)
                  ? 'skirt'
                  : 'robe',
      weight: 0.2,
      armor: /exquisite|hortator/.test(n) ? 3 : 0,
      value: /exquisite/.test(n) ? 120 : 35,
    };
  if (/key|box|skull|fragment|cup|contract/.test(n)) return { name, type: 'quest', weight: 0.2, value: 10 };
  return { name, type: 'book', weight: 1, value: 35 };
}
export function newState(catalogue, choice = {}) {
  const race = catalogue.races.find((r) => r.name === choice.race) || catalogue.races.find((r) => r.name === 'Dark Elf');
  const cls =
    choice.class === 'Custom'
      ? {
          name: 'Custom',
          specialization: 'Stealth',
          favored: ['Endurance', 'Luck'],
          major: ['Spear', 'Blunt Weapon', 'Long Blade', 'Block', 'Mercantile'],
          minor: ['Axe', 'Medium Armor', 'Mysticism', 'Restoration', 'Heavy Armor'],
        }
      : catalogue.classes.find((c) => c.name === choice.class) || catalogue.classes.find((c) => c.name === 'Spellsword');
  const attrs = { ...race.attributes[choice.sex || 'Male'] };
  for (const a of cls.favored) attrs[a] += 10;
  const hp = (attrs.Strength + attrs.Endurance) / 2;
  const sign = choice.sign || 'The Lady';
  if (sign === 'The Lady') {
    attrs.Endurance += 25;
    attrs.Personality += 25;
  }
  if (sign === 'The Steed') attrs.Speed += 25;
  if (sign === 'The Lover') attrs.Agility += 25;
  const skills = {};
  for (const sk of catalogue.skills)
    skills[sk.name] =
      5 +
      (cls.major.includes(sk.name) ? 25 : cls.minor.includes(sk.name) ? 10 : 0) +
      (sk.specialization === cls.specialization ? 5 : 0) +
      (race.bonuses[sk.name] || 0);
  const s = {
    version: SAVE_VERSION,
    name: (choice.name || 'Outlander').slice(0, 28),
    race: race.name,
    sex: choice.sex || 'Male',
    class: cls.name,
    sign,
    attrs,
    skills,
    major: cls.major,
    minor: cls.minor,
    skillXP: {},
    attributeGains: {},
    levelGains: 0,
    pendingLevels: [],
    level: 1,
    maxHp: hp,
    hp,
    mp: 0,
    fp: 0,
    gold: 25,
    inventory: {},
    equipment: { weapon: 'Iron Dagger' },
    condition: {},
    enchantments: {},
    containers: {},
    encounters: {},
    knownSpells: START_SPELLS.map((x) => x.id),
    customSpells: [],
    selectedSpell: 'embers',
    chapter: 0,
    flags: {},
    sides: {},
    visited: [],
    looted: [],
    defeated: [],
    read: [],
    dispositions: {},
    factions: {},
    journal: [],
    area: 'wlk001-1',
    position: { x: 0, y: 1.05, z: 8 },
    yaw: 0,
    pitch: 0,
    mark: null,
    buffs: {},
    seconds: 0,
    kills: 0,
    deaths: 0,
    heart: 0,
    puzzle: 0,
    aspect: 'Guile',
    days: 1,
    bounty: 0,
    powerUsed: false,
    seed: 20983,
  };
  for (const [n, q] of [
    ['Iron Dagger', 1],
    ['Standard Restore Health', 5],
    ['Standard Restore Magicka', 4],
    ['Journeyman’s Lockpick', 8],
    ['Apprentice’s Armorer’s Hammer', 3],
    ['Engraved Ring of Healing', 1],
    ['Marshmerrow', 3],
    ['Saltrice', 3],
  ])
    addItem(s, n, q);
  s.mp = maxMagicka(s);
  s.fp = maxFatigue(s);
  return s;
}
export const ATTRIBUTES = ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck'];
export function attribute(s, name) {
  return Math.max(
    0,
    (s.attrs[name] || 0) +
      (s.buffs['Fortify:' + name]?.magnitude || 0) -
      (s.buffs['Drain:' + name]?.magnitude || 0) -
      (s.attributeDamage?.[name] || 0),
  );
}
export function skill(s, name) {
  return Math.max(1, (s.skills[name] || 5) - (s.buffs['DrainSkill:' + name]?.magnitude || 0));
}
export function maxMagicka(s) {
  return Math.max(
    0,
    Math.round(
      attribute(s, 'Intelligence') *
        (1 +
          (s.race === 'High Elf' ? 1.5 : s.race === 'Breton' ? 0.5 : 0) +
          (s.sign === 'The Atronach' ? 2 : s.sign === 'The Apprentice' ? 1.5 : s.sign === 'The Mage' ? 0.5 : 0)),
    ) + (s.buffs['Fortify Magicka']?.magnitude || 0),
  );
}
export const maxHealth = (s) => s.maxHp + (s.buffs['Fortify Health']?.magnitude || 0);
export const maxFatigue = (s) =>
  ['Strength', 'Agility', 'Willpower', 'Endurance'].reduce((t, k) => t + attribute(s, k), 0) +
  (s.buffs['Fortify Fatigue']?.magnitude || 0);
export const capacity = (s) =>
  attribute(s, 'Strength') * 5 + (s.buffs.Feather?.magnitude || 0) - (s.buffs.Burden?.magnitude || 0);
export const weight = (s, c) => Object.entries(s.inventory).reduce((t, [n, q]) => t + itemInfo(n, c).weight * q, 0);
export const hasItem = (s, n) => !!s.inventory[n];
export function addItem(s, n, q = 1) {
  s.inventory[n] = (s.inventory[n] || 0) + q;
}
export function removeItem(s, n, q = 1) {
  if (!Number.isInteger(q) || q < 1 || (s.inventory[n] || 0) < q) return false;
  s.inventory[n] -= q;
  if (s.inventory[n] <= 0) {
    delete s.inventory[n];
    // A quest hand-in can remove a worn item. Never leave an orphaned slot.
    for (const [slot, item] of Object.entries(s.equipment)) if (item === n) delete s.equipment[slot];
    if (s.toolCharges) delete s.toolCharges[n];
  }
  return true;
}
export function armorRating(s, c) {
  return (
    Object.values(s.equipment).reduce((a, n) => {
      const i = itemInfo(n, c);
      return (
        a + ((i.armor || 0) * (i.type === 'armor' ? 0.7 + (s.skills[i.skill] || 20) / 100 : 1) * (s.condition[n] ?? 100)) / 100
      );
    }, 0) +
    (s.buffs.Shield?.magnitude || 0) +
    Object.keys(s.buffs).filter((k) => /^Bound (Cuirass|Shield|Gauntlets|Helm|Boots)$/.test(k)).length * 10
  );
}
export function weapon(s, c) {
  const bound = Object.keys(s.buffs).find((k) => /^Bound (Longsword|Dagger|Battle Axe|Mace|Spear|Longbow)$/.test(k));
  if (bound) {
    const type = bound.replace('Bound ', '');
    return {
      name: bound,
      type: 'weapon',
      skill:
        type === 'Dagger'
          ? 'Short Blade'
          : type === 'Mace'
            ? 'Blunt Weapon'
            : type === 'Spear'
              ? 'Spear'
              : type === 'Longbow'
                ? 'Marksman'
                : type === 'Battle Axe'
                  ? 'Axe'
                  : 'Long Blade',
      damage: 35,
      weight: 0,
      element: 'Magicka',
    };
  }
  return s.equipment.weapon
    ? itemInfo(s.equipment.weapon, c)
    : { name: 'Unarmed', type: 'weapon', skill: 'Hand-to-Hand', damage: 6, weight: 0, value: 0 };
}
export function equip(s, n, c) {
  if (!hasItem(s, n)) return 'That item is not in your pack.';
  const i = itemInfo(n, c);
  if (['Sunder', 'Keening'].includes(n) && s.equipment.gauntlet !== 'Wraithguard')
    return 'Equip Wraithguard before handling Kagrenac’s tools.';
  if (['Argonian', 'Khajiit'].includes(s.race) && i.slot === 'boots') return 'Beastfolk cannot wear these boots.';
  if (!['weapon', 'armor', 'jewelry'].includes(i.type)) return 'This item cannot be equipped.';
  let slot = i.type === 'weapon' ? 'weapon' : i.slot;
  if (slot === 'gauntlet' && n !== 'Wraithguard' && ['Sunder', 'Keening'].includes(s.equipment.weapon))
    return 'Put away Kagrenac’s tool before removing Wraithguard.';
  if (Object.values(s.equipment).includes(n)) return null;
  if (slot === 'ring' && s.equipment.ring && s.equipment.ring !== n) slot = 'ring2';
  s.equipment[slot] = n;
  return null;
}
export function gainSkill(s, name, amount, c) {
  if (!s.skills[name] || s.skills[name] >= 100) return false;
  s.skillXP[name] = (s.skillXP[name] || 0) + amount;
  const threshold = 5 + s.skills[name] * 0.12;
  if (s.skillXP[name] < threshold) return false;
  s.skillXP[name] -= threshold;
  s.skills[name]++;
  const a = c.skills.find((k) => k.name === name)?.attribute;
  if (a) s.attributeGains[a] = (s.attributeGains[a] || 0) + 1;
  if (s.major.includes(name) || s.minor.includes(name)) {
    s.levelGains++;
    if (s.levelGains >= 10) {
      s.levelGains -= 10;
      s.pendingLevels.push({ ...s.attributeGains });
      s.attributeGains = {};
    }
  }
  return true;
}
export const multiplier = (g, a) =>
  a === 'Luck' ? 1 : (g[a] || 0) >= 10 ? 5 : (g[a] || 0) >= 8 ? 4 : (g[a] || 0) >= 5 ? 3 : (g[a] || 0) >= 1 ? 2 : 1;
export function levelUp(s, attrs) {
  if (!s.pendingLevels.length || new Set(attrs).size !== 3 || attrs.some((a) => !(a in s.attrs))) return false;
  const g = s.pendingLevels.shift();
  for (const a of attrs) s.attrs[a] = Math.min(100, s.attrs[a] + multiplier(g, a));
  s.level++;
  s.maxHp += s.attrs.Endurance * 0.1;
  s.hp = s.maxHp;
  s.mp = maxMagicka(s);
  s.fp = maxFatigue(s);
  return true;
}
export function attackChance(s, sk = 'Long Blade', enemy = {}) {
  return (
    clamp(
      (skill(s, sk) + attribute(s, 'Agility') * 0.2 + attribute(s, 'Luck') * 0.1 + (s.sign === 'The Warrior' ? 10 : 0)) *
        (0.75 + (0.5 * s.fp) / Math.max(1, maxFatigue(s))) -
        (enemy.evasion || 10),
      10,
      98,
    ) / 100
  );
}
export function spellChance(s, sp) {
  return (
    clamp(
      (skill(s, sp.school) * 2 + attribute(s, 'Willpower') * 0.2 + attribute(s, 'Luck') * 0.1 - sp.cost * 0.35) *
        (0.75 + (0.5 * s.fp) / Math.max(1, maxFatigue(s))),
      25,
      100,
    ) / 100
  );
}
export function applyReward(s, r, c) {
  s.gold += r.gold || 0;
  for (const n of r.items || []) addItem(s, n);
  if (r.flag) s.flags[r.flag] = true;
  if (r.faction) s.factions[r.faction] = (s.factions[r.faction] || 0) + 1;
  for (let i = 0; i < 4; i++) gainSkill(s, s.major[0], 20, c);
}
export function progress(s, event, c) {
  const q = activeStep(s);
  if (!matchObjective(q, event)) return false;
  applyReward(s, q.reward, c);
  s.journal.push({ title: q.title, act: q.act, day: s.days });
  s.chapter++;
  s.puzzle = 0;
  if (s.flags.cured) delete s.flags.corprus;
  return true;
}
export function advanceSide(s, id, type, target, c) {
  const q = SIDES.find((x) => x.id === id);
  if (!q) return false;
  const status = s.sides[id] || 0;
  if (status === 0 && type === 'talk' && target === q.giver) {
    s.sides[id] = 1;
    return 'accepted';
  }
  if (
    status === 1 &&
    ((q.enemy && type === 'kill' && target === q.enemy) ||
      (q.item && hasItem(s, q.item) && type === 'talk' && target === q.giver))
  ) {
    s.sides[id] = 2;
    applyReward(s, q.reward, c);
    return 'completed';
  }
  return false;
}
export function damagePlayer(s, amount, element, c, difficulty = 1) {
  if (element && Math.random() < ((s.sign === 'The Atronach' ? 50 : 0) + (s.buffs['Spell Absorption']?.magnitude || 0)) / 100) {
    s.mp = Math.min(maxMagicka(s), s.mp + amount);
    return { absorbed: true, amount: 0 };
  }
  if (element === 'Fire') {
    if (s.race === 'Dark Elf') amount *= 0.25;
    if (s.race === 'High Elf') amount *= 1.5;
    if (s.sign === 'The Lord') amount *= 2;
  }
  if (element === 'Frost') {
    if (s.race === 'Nord') amount = 0;
    if (s.race === 'High Elf') amount *= 1.25;
  }
  if (element === 'Shock') {
    if (s.race === 'Nord') amount *= 0.5;
    if (s.race === 'High Elf') amount *= 1.25;
  }
  if (element === 'Poison') {
    if (s.race === 'Argonian') amount = 0;
    if (s.race === 'Redguard') amount *= 0.25;
  }
  if (element === 'Magicka') {
    if (s.race === 'Breton') amount *= 0.5;
    if (s.race === 'Orc') amount *= 0.75;
    if (s.race === 'High Elf' || s.sign === 'The Apprentice') amount *= 1.5;
  }
  if (element) {
    let resist = s.buffs['Resist ' + element]?.magnitude || 0;
    if (element === 'Fire') resist += s.buffs['Fire Shield']?.magnitude || 0;
    if (element === 'Frost') resist += s.buffs['Frost Shield']?.magnitude || 0;
    if (element === 'Shock') resist += s.buffs['Lightning Shield']?.magnitude || 0;
    amount *= Math.max(0, 1 - resist / 100);
  }
  if (!element) amount *= 100 / (100 + armorRating(s, c));
  amount *= difficulty;
  s.hp = Math.max(0, s.hp - amount);
  return { amount };
}
export function usePotion(s, n, c) {
  const it = itemInfo(n, c);
  if (it.type !== 'potion' || !removeItem(s, n)) return false;
  if (it.effect === 'health') s.hp = Math.min(maxHealth(s), s.hp + it.power);
  if (it.effect === 'magicka') s.mp = Math.min(maxMagicka(s), s.mp + it.power);
  if (it.effect === 'fatigue') s.fp = Math.min(maxFatigue(s), s.fp + it.power);
  if (it.effect === 'cure') {
    delete s.buffs.Poison;
    delete s.flags.disease;
  }
  if (it.effect === 'fortify') s.buffs.Shield = { remaining: 40, magnitude: 20 };
  return true;
}
export function rest(s) {
  s.days++;
  s.buffs = {};
  s.hp = s.maxHp;
  s.fp = maxFatigue(s);
  if (s.sign !== 'The Atronach') s.mp = maxMagicka(s);
  else s.mp = Math.min(s.mp, maxMagicka(s));
  s.powerUsed = false;
}
export function repair(s, n, c) {
  const tools = Object.keys(s.inventory).find((x) => itemInfo(x, c).tool === 'repair');
  if (!tools) return false;
  removeItem(s, tools);
  s.condition[n] = 100;
  gainSkill(s, 'Armorer', 12, c);
  return true;
}
export function alchemy(s, a, b, c) {
  if (a === b || !hasItem(s, a) || !hasItem(s, b)) return { ok: false, text: 'Choose two different ingredients in your pack.' };
  const ai = itemInfo(a, c),
    bi = itemInfo(b, c);
  const overlap = (ai.effects || []).filter((x) => (bi.effects || []).includes(x));
  if (!overlap.length && !(['Marshmerrow', 'Saltrice'].includes(a) && ['Marshmerrow', 'Saltrice'].includes(b)))
    return { ok: false, text: 'These ingredients share no known effect.' };
  removeItem(s, a);
  removeItem(s, b);
  let n = /Magicka/.test(overlap[0]) ? 'Quality Restore Magicka' : 'Quality Restore Health';
  addItem(s, n);
  gainSkill(s, 'Alchemy', 15, c);
  return { ok: true, text: `Brewed ${n}.` };
}
/** Reject damaged/untrusted imports before they can reach simulation or HTML. */
export function validateSave(s, c) {
  const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
  const finite = (v, min = 0, max = 1e9) => Number.isFinite(v) && v >= min && v <= max;
  if (
    !object(s) ||
    s.version !== SAVE_VERSION ||
    !c.areas.some((a) => a.id === s.area) ||
    !Number.isInteger(s.chapter) ||
    s.chapter < 0 ||
    s.chapter > CAMPAIGN.length
  )
    return null;
  for (const k of [
    'attrs',
    'skills',
    'inventory',
    'equipment',
    'condition',
    'enchantments',
    'flags',
    'buffs',
    'sides',
    'dispositions',
    'factions',
    'skillXP',
    'attributeGains',
  ])
    if (!object(s[k])) return null;
  const attrs = ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Speed', 'Endurance', 'Personality', 'Luck'];
  if (attrs.some((k) => !finite(s.attrs[k], 1, 10000)) || c.skills.some((k) => !finite(s.skills[k.name], 1, 100))) return null;
  for (const k of ['hp', 'mp', 'fp', 'gold', 'maxHp', 'level', 'seconds', 'kills', 'deaths', 'days', 'bounty', 'heart', 'puzzle'])
    if (!finite(s[k])) return null;
  if (s.maxHp < 1 || s.hp > maxHealth(s) || s.level < 1 || !Number.isInteger(s.level)) return null;
  for (const k of ['visited', 'looted', 'defeated', 'read', 'knownSpells', 'major', 'minor'])
    if (!Array.isArray(s[k]) || s[k].length > 15000 || s[k].some((v) => typeof v !== 'string' || v.length > 250)) return null;
  for (const k of ['pendingLevels', 'journal', 'customSpells']) if (!Array.isArray(s[k]) || s[k].length > 5000) return null;
  if (
    !object(s.position) ||
    !['x', 'y', 'z'].every((k) => finite(s.position[k], -300, 300)) ||
    !finite(s.yaw, -1e9, 1e9) ||
    !finite(s.pitch, -1.6, 1.6)
  )
    return null;
  if (!c.races.some((r) => r.name === s.race) || !SIGN_INFO[s.sign] || typeof s.name !== 'string' || s.name.length > 28)
    return null;
  if (
    Object.entries(s.inventory).some(
      ([k, v]) =>
        ['__proto__', 'constructor', 'prototype'].includes(k) || k.length > 250 || !Number.isInteger(v) || v < 1 || v > 1e6,
    )
  )
    return null;
  if (Object.entries(s.equipment).some(([slot, n]) => typeof n !== 'string' || !s.inventory[n])) return null;
  if (Object.values(s.buffs).some((v) => !object(v) || !finite(v.remaining, 0, 36000) || !finite(v.magnitude, -10000, 10000)))
    return null;
  if (
    s.customSpells.some(
      (v) =>
        !object(v) ||
        typeof v.id !== 'string' ||
        typeof v.name !== 'string' ||
        typeof v.effect !== 'string' ||
        !finite(v.cost, 0, 1e6) ||
        !finite(v.magnitude, 0, 10000) ||
        !finite(v.duration, 0, 36000),
    )
  )
    return null;
  if (s.pendingLevels.some((v) => !object(v) || Object.values(v).some((n) => !finite(n)))) return null;
  if (s.journal.some((v) => !object(v) || typeof v.title !== 'string' || v.title.length > 200)) return null;
  if (
    s.mark !== null &&
    (!object(s.mark) ||
      !c.areas.some((a) => a.id === s.mark.area) ||
      !object(s.mark.position) ||
      !['x', 'y', 'z'].every((k) => finite(s.mark.position[k], -300, 300)))
  )
    return null;
  if (s.containers !== undefined) {
    if (!object(s.containers) || Object.keys(s.containers).length > 15000) return null;
    for (const v of Object.values(s.containers)) {
      if (
        !object(v) ||
        !Array.isArray(v.items) ||
        v.items.length > 2000 ||
        v.items.some((n) => typeof n !== 'string' || n.length > 250) ||
        !finite(v.locked, 0, 10000) ||
        typeof v.trapped !== 'boolean'
      )
        return null;
      if (
        v.extra &&
        (!object(v.extra) ||
          typeof v.extra.id !== 'string' ||
          typeof v.extra.name !== 'string' ||
          v.extra.name.length > 300 ||
          !['x', 'y', 'z'].every((k) => finite(v.extra[k], -300, 300)))
      )
        return null;
    }
  }
  if (s.encounters !== undefined) {
    if (!object(s.encounters) || Object.keys(s.encounters).length > 15000) return null;
    for (const v of Object.values(s.encounters))
      if (!object(v) || !finite(v.hp) || !object(v.position) || !['x', 'y', 'z'].every((k) => finite(v.position[k], -300, 300)))
        return null;
  }
  for (const field of ['condition', 'itemCharge', 'toolCharges', 'attributeDamage']) {
    if (s[field] !== undefined && (!object(s[field]) || Object.values(s[field]).some((n) => !finite(n, 0, 10000)))) return null;
  }
  if (!Number.isInteger(s.levelGains) || s.levelGains < 0 || s.levelGains > 9) return null;
  if (s.major.some((n) => !c.skills.some((k) => k.name === n)) || s.minor.some((n) => !c.skills.some((k) => k.name === n)))
    return null;
  if (Object.values(s.enchantments).some((v) => !object(v) || typeof v.effect !== 'string' || !finite(v.magnitude, 0, 10000)))
    return null;
  s.containers ??= {};
  s.encounters ??= {};
  return s;
}
export function bodyLimits(preset) {
  return preset === 'High' ? { bodies: 36, substeps: 5 } : { bodies: 16, substeps: 3 };
}
export function spellById(s, c, id) {
  return [...START_SPELLS, ...s.customSpells, ...c.spells].find((x) => x.id === id) || START_SPELLS[0];
}
export function createSpell(s, name, effect, school, magnitude, duration, target, c) {
  magnitude = clamp(+magnitude || 1, 1, 80);
  duration = clamp(+duration || 1, 1, 60);
  const base = c.effects.find((e) => e.name === effect)?.baseCost || 2;
  const cost = Math.max(1, Math.ceil(base * magnitude * Math.max(1, duration * 0.1) * 0.12 * (target === 'Target' ? 1.5 : 1)));
  const fee = 30 + cost * 2;
  if (s.gold < fee) return null;
  s.gold -= fee;
  const sp = {
    id: 'custom-' + slug(name) + '-' + s.customSpells.length,
    name: name.slice(0, 40) || 'Nameless spell',
    effect,
    school,
    magnitude,
    duration,
    target,
    cost,
  };
  s.customSpells.push(sp);
  s.knownSpells.push(sp.id);
  return sp;
}

/** Stored settings are user input. Ignore invalid presets and non-finite numbers. */
export function validateOptions(input = {}, defaults = {}) {
  const o = { ...defaults };
  if (!input || typeof input !== 'object') return o;
  for (const k of ['mute', 'diagnostics', 'motion']) if (typeof input[k] === 'boolean') o[k] = input[k];
  for (const [k, lo, hi] of [
    ['volume', 0, 1],
    ['musicVolume', 0, 1],
    ['sfxVolume', 0, 1],
    ['difficulty', 0.65, 1.5],
  ])
    if (Number.isFinite(input[k])) o[k] = clamp(input[k], lo, hi);
  return o;
}
