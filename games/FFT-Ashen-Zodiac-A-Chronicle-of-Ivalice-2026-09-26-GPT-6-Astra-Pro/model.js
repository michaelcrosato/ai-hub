import { SPECIAL_JOBS, CHARACTERS, BOSSES, CAMPAIGN, OPTIONAL, SIGN_NAMES } from './content.js';
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const copy = (o) => JSON.parse(JSON.stringify(o));
export const key = (x, z) => `${x},${z}`;
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const JOB_THRESHOLDS = [0, 100, 200, 350, 550, 800, 1150, 1550];
export const STATUS_NAMES = [
  'Petrify',
  'Darkness',
  'Confusion',
  'Silence',
  'Blood Suck',
  'Oil',
  'Float',
  'Reraise',
  'Transparent',
  'Berserk',
  'Chicken',
  'Frog',
  'Critical',
  'Poison',
  'Regen',
  'Protect',
  'Shell',
  'Haste',
  'Slow',
  'Stop',
  'Wall',
  'Faith',
  'Innocent',
  'Charm',
  'Sleep',
  "Don't Move",
  "Don't Act",
  'Reflect',
  'Death Sentence',
  'Undead',
  'Charging',
  'Jump',
  'Defending',
  'Performing',
  'Dead',
  'Invite',
];
export const BUFFS = ['Haste', 'Protect', 'Shell', 'Regen', 'Reraise', 'Reflect', 'Float', 'Faith', 'Transparent'];
export const DEBUFFS = [
  'Darkness',
  'Confusion',
  'Silence',
  'Berserk',
  'Frog',
  'Poison',
  'Slow',
  'Stop',
  'Sleep',
  "Don't Move",
  "Don't Act",
  'Petrify',
  'Death Sentence',
  'Oil',
  'Charm',
  'Blood Suck',
];
export function makeDB(catalog) {
  const db = {
    ...catalog,
    action: new Map(catalog.actions.map((a) => [a.id, a])),
    item: new Map(catalog.items.map((i) => [i.id, i])),
    job: new Map(catalog.jobs.map((j) => [j.name, j])),
    map: new Map(catalog.maps.map((m) => [m.id, m])),
    monster: new Map(
      catalog.monsters.filter((m) => !m.name.includes('—') && !m.name.includes('notation')).map((m) => [m.name, m]),
    ),
  };
  for (const [name, data] of Object.entries(SPECIAL_JOBS)) db.job.set(name, { name, requirements: {}, ...data, special: true });
  db.itemNamed = (name, preferRare = false) => {
    const norm = (n) =>
      String(n)
        .replace('Eye Drops', 'Eye Drop')
        .split(' — ')[0]
        .replace(/\s*\([^)]*\)/g, '')
        .trim()
        .toLowerCase();
    const exact = catalog.items.find((i) => i.name.toLowerCase() === String(name).toLowerCase());
    if (exact && !preferRare) return exact;
    return catalog.items
      .filter((i) => norm(i.name) === norm(name))
      .sort((a, b) => (preferRare ? b.wp + b.pe - (a.wp + a.pe) : a.wp + a.pe - (b.wp + b.pe)))[0];
  };
  db.actionNamed = (name) => catalog.actions.find((a) => a.name.toLowerCase() === name.toLowerCase());
  db.encounter = new Map([...CAMPAIGN, ...OPTIONAL].map((e) => [e.id, e]));
  return db;
}
export function rngStep(state) {
  let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function levelOf(unit, job) {
  const earned = unit.jp?.[job]?.earned || 0;
  return JOB_THRESHOLDS.reduce((n, t, i) => (earned >= t ? i + 1 : n), 1);
}
export function availableJP(u, job = u.job) {
  const j = u.jp?.[job];
  return j ? j.earned - j.spent : 0;
}
export function awardJP(u, job, amount) {
  u.jp ??= {};
  u.jp[job] ??= { earned: 0, spent: 0 };
  u.jp[job].earned += Math.max(0, Math.floor(amount));
}
export function jobUnlocked(db, u, name) {
  const j = db.job.get(name);
  if (!j) return false;
  if (j.special) return u.baseJob === name;
  if ((name === 'Bard' && u.sex !== 'M') || (name === 'Dancer' && u.sex !== 'F')) return false;
  return Object.entries(j.requirements).every(([job, n]) => levelOf(u, job) >= n);
}
export function jobMembers(db, u, job = u.job) {
  const j = db.job.get(job);
  if (!j) return [];
  let members = j.special
    ? (j.abilities || []).map((id) => ({ id, role: 'A', jp: db.action.get(id)?.jp || 100 }))
    : db.commands[j.command]?.members || [];
  if (j.special) members = [...members, ...(db.commands['command-05']?.members || []).filter((m) => m.role !== 'A')];
  if (job === 'Squire' && u.name === 'Ramza')
    members = [
      ...members,
      ...['ability-096', 'ability-097', 'ability-098', 'ability-099'].map((id) => ({
        id,
        role: 'A',
        jp: db.action.get(id)?.jp || 200,
      })),
    ];
  return members.filter((m, i, a) => db.action.has(m.id) && a.findIndex((n) => n.id === m.id) === i);
}
export function learn(db, u, id, chapter = 4) {
  const m = jobMembers(db, u).find((m) => m.id === id);
  if (!m || u.learned.includes(id)) return { ok: false, reason: 'This ability is not available to learn here.' };
  if (id === 'ability-04b' || id === 'ability-09a')
    return { ok: false, reason: 'This ability is learned by surviving it in battle.' };
  if (id === 'ability-099' && chapter < 4) return { ok: false, reason: 'Scream becomes available in Chapter IV.' };
  if (id === 'ability-097' && chapter < 2) return { ok: false, reason: 'Cheer Up becomes available in Chapter II.' };
  if (availableJP(u) < m.jp) return { ok: false, reason: `Requires ${m.jp} JP in ${u.job}.` };
  u.jp[u.job].spent += m.jp;
  u.learned.push(id);
  return { ok: true };
}
export function hasAbility(db, u, name, kind) {
  if (kind === 'reaction') return (u.reaction || '') === name;
  if (kind === 'support') return (u.support || '') === name;
  if (kind === 'movement') return (u.movement || '') === name;
  return [u.reaction, u.support, u.movement].includes(name) || u.learned.some((id) => db.action.get(id)?.name === name);
}
export const isMonster = (db, u) =>
  !!u.monster ||
  db.monster.has(u.job) ||
  u.job === 'Lucavi' ||
  u.job === 'Archaic Demon' ||
  u.job === 'Ultima Demon' ||
  u.job === 'Apanda';
export function defaultWeapon(db, job, level = 1) {
  const family =
    job === 'Archer'
      ? 'Longbows'
      : job === 'Lancer'
        ? 'Spears'
        : job === 'Ninja'
          ? 'Ninja Swords'
          : job === 'Samurai'
            ? 'Katana'
            : job === 'Chemist' || job === 'Mediator' || job === 'Engineer'
              ? level > 12
                ? 'Guns, Physical'
                : 'Daggers'
              : job === 'Wizard' || job === 'Summoner'
                ? 'Rods'
                : ['Priest', 'Time Mage', 'Cleric', 'Heaven Knight'].includes(job)
                  ? 'Staves'
                  : job === 'Oracle' || job === 'Hell Knight'
                    ? 'Sticks'
                    : job === 'Bard'
                      ? 'Instruments'
                      : job === 'Dancer'
                        ? 'Cloths'
                        : job === 'Calculator'
                          ? 'Dictionaries'
                          : 'Swords';
  if (
    ['Monk', 'Mime', 'Steel Giant', 'Dragoner', 'Lucavi'].includes(job) ||
    db.monster.has(job) ||
    ['Archaic Demon', 'Ultima Demon', 'Apanda'].includes(job)
  )
    return null;
  let pool = db.items.filter((i) => i.slot === 'weapon' && i.family === family && !i.rare && (i.level || 1) <= level);
  if (!pool.length) pool = db.items.filter((i) => i.slot === 'weapon' && i.family === family && !i.rare);
  return pool.sort((a, b) => b.wp - a.wp)[0]?.id || db.itemNamed('Broad Sword')?.id || null;
}
export function createUnit(db, name, job = 'Squire', level = 1, options = {}) {
  const char = CHARACTERS[name] || {},
    data = { ...char, ...options };
  job = data.job || job;
  const u = {
    id: options.id || slug(name) + '-' + Math.random().toString(36).slice(2, 8),
    name,
    job,
    baseJob: job,
    level,
    exp: 0,
    sex: data.sex || 'M',
    sign: data.sign ?? 9,
    brave: data.brave ?? 65,
    faith: data.faith ?? 65,
    jp: {},
    learned: [],
    secondary: 'Item',
    reaction: '',
    support: '',
    movement: '',
    equipment: { weapon: null, shield: null, head: null, body: null, accessory: null },
    generic: !CHARACTERS[name],
    ...data,
  };
  u.monster = isMonster(db, u);
  u.equipment.weapon = data.weapon ? db.itemNamed(data.weapon)?.id : defaultWeapon(db, job, level);
  if (!u.monster && !['Mime', 'Steel Giant', 'Dragoner'].includes(job)) {
    u.equipment.head = db.itemNamed('Leather Hat')?.id;
    u.equipment.body = db.itemNamed('Leather Outfit')?.id;
    if (['Knight', 'Holy Knight', 'Holy Swordsman', 'Divine Knight', 'Dark Knight', 'Lancer', 'Temple Knight'].includes(job))
      u.equipment.shield =
        db.itemNamed('Escutcheon (common)')?.id || db.items.find((i) => i.name.startsWith('Escutcheon') && !i.rare)?.id;
  }
  if (job === 'Ninja') u.equipment.shield = u.equipment.weapon;
  if (data.accessory) u.equipment.accessory = db.itemNamed(data.accessory)?.id;
  awardJP(u, job, 100);
  awardJP(u, 'Squire', job === 'Squire' ? 0 : 100);
  awardJP(u, 'Chemist', 100);
  u.learned = ['ability-direct-potion', 'ability-direct-phoenix-down', 'ability-093', 'ability-094', 'ability-095'];
  if (name === 'Ramza') u.learned.push('ability-096', 'ability-098');
  const first = jobMembers(db, u)
    .filter((m) => m.role === 'A')
    .sort((a, b) => a.jp - b.jp)
    .slice(0, 2)
    .map((m) => m.id);
  u.learned = [...new Set([...u.learned, ...first, ...(data.skills || [])])];
  if (db.job.get(job)?.special)
    u.learned = [...new Set([...u.learned, ...(db.job.get(job).abilities || []).slice(0, Math.max(2, Math.floor(level / 6)))])];
  return u;
}
export function equipped(db, u) {
  return Object.values(u.equipment || {})
    .filter(Boolean)
    .map((id) => db.item.get(id))
    .filter(Boolean);
}
export function equipmentStats(db, u) {
  const result = {
    hp: 0,
    mp: 0,
    pa: 0,
    ma: 0,
    speed: 0,
    move: 0,
    jump: 0,
    pe: 0,
    me: 0,
    block: [],
    auto: [],
    absorb: [],
    half: [],
    weak: [],
    strengthen: [],
    element: '',
    effects: '',
  };
  for (const item of equipped(db, u)) {
    result.hp += item.hp || 0;
    result.mp += item.mp || 0;
    result.pe += item.pe || 0;
    result.me += item.me || 0;
    result.effects += '; ' + item.effects;
    for (const [tag, field] of [
      ['PA', 'pa'],
      ['MA', 'ma'],
      ['Sp', 'speed'],
      ['Move', 'move'],
      ['Jump', 'jump'],
    ]) {
      const m = item.effects.match(new RegExp('\\b' + tag + '\\s*([+-]\\d+)', 'i'));
      if (m) result[field] += +m[1];
    }
    for (const [tag, field] of [
      ['Block', 'block'],
      ['Absorb', 'absorb'],
      ['Half', 'half'],
      ['Weak', 'weak'],
      ['Strengthen', 'strengthen'],
    ]) {
      const m = item.effects.match(
        new RegExp(tag + ':\\s*([^;]+?)(?=;|(?:Block|Absorb|Half|Weak|Strengthen|Auto|Initial)[- :]|$)', 'i'),
      );
      if (m) result[field].push(...m[1].split(',').map((s) => s.trim().replace(/\.$/, '')));
    }
    for (const m of item.effects.matchAll(/Auto[- :]+(Haste|Protect|Shell|Regen|Reraise|Reflect|Float|Transparent)/gi))
      result.auto.push(m[1]);
    if (item.slot === 'weapon') {
      const el = item.effects.match(/(?:Element(?:al)?|Damage)[: ]+(Fire|Ice|Lightning|Earth|Wind|Water|Holy|Dark)/i);
      if (el) result.element = el[1];
    }
  }
  const named = equipped(db, u).map((i) => i.name);
  if (named.includes('Excalibur')) {
    result.auto.push('Haste');
    result.absorb.push('Holy');
    result.strengthen.push('Holy');
  }
  if (named.includes('Chantage')) result.auto.push('Reraise', 'Regen');
  for (const n of named) {
    if (n === 'Ice Brand') result.element = 'Ice';
    if (n === 'Coral Sword' || n === 'Lightning Bow') result.element = 'Lightning';
  }
  return result;
}
export function stats(db, u) {
  const j = db.job.get(u.job) || { move: 4, jump: 4, hpm: 130, mpm: 80, pam: 120, mam: 100, spm: 100, evade: 15 };
  const e = equipmentStats(db, u),
    l = u.level || 1;
  const magicSex = u.sex === 'F' ? 1.1 : 1,
    physicalSex = u.sex === 'M' ? 1.08 : 1;
  const s = {
    maxHp: Math.floor(((43 + l * 4.1) * (j.hpm || 100)) / 100) + e.hp,
    maxMp: Math.floor(((15 + l * 2.5) * (j.mpm ?? 100)) / 100) + e.mp,
    pa: Math.max(1, Math.floor(((4 + l * 0.14) * physicalSex * (j.pam || 100)) / 100) + e.pa),
    ma: Math.max(1, Math.floor(((4 + l * 0.13) * magicSex * (j.mam || 100)) / 100) + e.ma),
    speed: Math.max(1, Math.floor(((6 + Math.floor(l / 18)) * (j.spm || 100)) / 100) + e.speed),
    move: (j.move || 3) + e.move,
    jump: (j.jump || 3) + e.jump,
    evade: j.evade || 5,
    gear: e,
  };
  if (u.name === 'Ramza') {
    s.maxHp += 12;
    s.ma += 1;
    s.pa += 1;
  }
  if (u.movement?.match(/^Move \+([123])/)) s.move += +u.movement.match(/([123])/)[1];
  if (u.movement?.match(/^Jump \+([123])/)) s.jump += +u.movement.match(/([123])/)[1];
  if (u.monster) {
    s.maxHp = Math.floor(s.maxHp * 1.25);
    s.pa += 1;
  }
  if (/Dragon|Behemoth|Hydra|Hyudra|Tiamat/.test(u.job)) s.maxHp += 55;
  if (u.job === 'Lucavi') s.move = 5;
  return s;
}
export function equipAllowed(db, u, item) {
  if (!item || isMonster(db, u) || u.job === 'Mime' || u.job === 'Steel Giant') return false;
  if (['consumable', 'throw'].includes(item.slot)) return false;
  if (item.family.includes('Perfume') || item.family.includes('Female')) if (u.sex !== 'F') return false;
  if (item.slot === 'accessory') return true;
  if (u.name === 'Ramza' && u.job === 'Squire') return !item.family.includes('Axe');
  if (u.job === 'Dragoner') return item.family.includes('Bag') || item.family.includes('Ribbon');
  if (u.job === 'Monk' && item.slot === 'weapon') return false;
  const support = u.support || '';
  if (support === 'Equip Armor' && ['head', 'body'].includes(item.slot)) return true;
  if (support === 'Equip Shield' && item.slot === 'shield') return true;
  if (item.slot === 'weapon' && support.toLowerCase().includes(item.family.toLowerCase().replace(/s$/, ''))) return true;
  const j = db.job.get(u.job);
  if (j?.special) return true;
  const eq = (j?.equipment || '').toLowerCase();
  const families = {
    Daggers: 'knife',
    Longbows: 'bow',
    Crossbows: 'crossbow',
    Katana: 'katana',
    'Guns, Physical': 'gun',
    'Guns, Magical': 'gun',
    Instruments: 'harp',
    Cloths: 'fabric',
    Staves: 'staff',
    Clothes: 'clothes',
  };
  const family =
    families[item.family] || item.family.toLowerCase().replace(/s$/, '').replace('knive', 'knife').replace('clothe', 'clothes');
  if (item.slot === 'head' && eq.includes('hat') && !item.family.includes('Helmet')) return true;
  if (item.slot === 'shield' && eq.includes('shield')) return db.item.get(u.equipment.weapon)?.family !== 'Longbows';
  return eq.includes(family) || (item.slot === 'body' && item.family === 'Clothes' && eq.includes('clothes'));
}
export function equipItem(db, state, u, id, slot) {
  const item = db.item.get(id);
  slot = slot || item?.slot;
  if (!item || !equipAllowed(db, u, item)) return { ok: false, reason: 'This job cannot equip that item.' };
  if (item.slot !== slot && !(slot === 'shield' && item.slot === 'weapon' && (u.job === 'Ninja' || u.support === 'Two Swords')))
    return { ok: false, reason: 'Wrong equipment slot.' };
  if ((state.inventory[id] || 0) < 1) return { ok: false, reason: 'No copy in stock.' };
  if (u.equipment[slot]) state.inventory[u.equipment[slot]] = (state.inventory[u.equipment[slot]] || 0) + 1;
  state.inventory[id]--;
  u.equipment[slot] = id;
  return { ok: true };
}
export function changeJob(db, state, u, job) {
  if (!jobUnlocked(db, u, job) || u.monster) return false;
  u.job = job;
  for (const [slot, id] of Object.entries(u.equipment))
    if (
      id &&
      (!equipAllowed(db, u, db.item.get(id)) ||
        (slot === 'shield' && db.item.get(id)?.slot === 'weapon' && job !== 'Ninja' && u.support !== 'Two Swords'))
    ) {
      state.inventory[id] = (state.inventory[id] || 0) + 1;
      u.equipment[slot] = null;
    }
  if (job === 'Mime') {
    u.secondary = '';
    u.reaction = '';
    u.support = '';
    u.movement = '';
  }
  return true;
}
export function stock(state, db, name, count = 1, rare = false) {
  const item = db.itemNamed(name, rare);
  if (!item) return null;
  state.inventory[item.id] = (state.inventory[item.id] || 0) + count;
  return item;
}
export function createState(db) {
  const party = [
    createUnit(db, 'Ramza'),
    createUnit(db, 'Zach', 'Squire', 1, { sex: 'M', brave: 72, faith: 57 }),
    createUnit(db, 'Annette', 'Chemist', 1, { sex: 'F', brave: 60, faith: 73 }),
    createUnit(db, 'Laura', 'Chemist', 1, { sex: 'F', brave: 58, faith: 70 }),
    createUnit(db, 'Rad', 'Squire', 1, { sex: 'M', brave: 65, faith: 60 }),
    createUnit(db, 'Alicia', 'Squire', 1, { sex: 'F', brave: 64, faith: 65 }),
  ];
  const s = {
    version: 1,
    seed: 0xc001d00d,
    progress: 0,
    chapter: 0,
    day: 1,
    gil: 1800,
    relics: 0,
    party,
    selected: party.slice(0, 5).map((u) => u.id),
    inventory: {},
    completed: [],
    flags: {},
    dispatches: [],
    discoveries: [],
    fur: [],
    battle: null,
    endingSeen: false,
    stats: { victories: 0, defeats: 0, actions: 0, damage: 0, recruits: 0 },
    options: {
      quality: 'Auto',
      difficulty: 'Tactician',
      volume: 0.55,
      music: 0.55,
      sfx: 0.8,
      mute: false,
      speed: 1,
      autoCamera: true,
      permadeath: false,
    },
    journal: [],
    lastSaved: 0,
  };
  for (const [n, c] of [
    ['Potion', 24],
    ['Phoenix Down', 8],
    ['Ether', 5],
    ['Antidote', 5],
    ['Remedy', 3],
    ['Broad Sword', 2],
    ['Rod', 2],
    ['Oak Staff', 2],
    ['Battle Boots', 2],
  ])
    stock(s, db, n, c);
  return s;
}
export function recruit(db, s, name) {
  if (s.party.some((u) => u.name === name)) return null;
  const level = Math.max(1, ...s.party.map((u) => u.level));
  const u = createUnit(db, name, 'Squire', level);
  u.generic = !CHARACTERS[name];
  s.party.push(u);
  s.stats.recruits++;
  s.journal.unshift(`${name} joined the company.`);
  return u;
}
export function exportSave(s) {
  return JSON.stringify({ format: 'ashen-zodiac', version: 1, payload: s });
}
export function importSave(text, db) {
  if (typeof text !== 'string' || text.length > 8000000) throw new Error('Save file is too large.');
  const data = JSON.parse(text),
    s = data.payload;
  const fail = (message) => {
    throw new Error(message);
  };
  const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  let nodes = 0;
  function inspect(v, depth = 0) {
    if (++nodes > 150000 || depth > 40) fail('Save structure is too large.');
    if (typeof v === 'number' && !Number.isFinite(v)) fail('Save contains an invalid number.');
    if (typeof v === 'string' && v.length > 50000) fail('Save contains excessive text.');
    if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (['__proto__', 'constructor', 'prototype'].includes(k)) fail('Save contains an unsafe key.');
        inspect(x, depth + 1);
      }
  }
  inspect(data);
  if (
    data.format !== 'ashen-zodiac' ||
    data.version !== 1 ||
    !record(s) ||
    !Array.isArray(s.party) ||
    !s.party.length ||
    s.party.length > 99 ||
    !Number.isInteger(s.progress) ||
    s.progress < 0 ||
    s.progress > CAMPAIGN.length
  )
    fail('This is not a supported Ashen Zodiac save.');
  const ids = new Set();
  function unit(u, battle = false) {
    if (
      !record(u) ||
      typeof u.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,90}$/.test(u.id) ||
      typeof u.name !== 'string' ||
      u.name.length > 80 ||
      !Number.isInteger(u.level) ||
      u.level < 1 ||
      u.level > 99 ||
      typeof u.job !== 'string' ||
      u.job.length > 80 ||
      !record(u.equipment) ||
      !record(u.jp) ||
      !Array.isArray(u.learned)
    )
      fail('Invalid unit data.');
    for (const [slot, id] of Object.entries(u.equipment))
      if (!['weapon', 'shield', 'head', 'body', 'accessory'].includes(slot) || (id !== null && !db.item.has(id)))
        fail('Invalid equipment data.');
    for (const id of u.learned) if (typeof id !== 'string' || !/^ability-[a-z0-9-]+$/.test(id)) fail('Invalid ability data.');
    for (const x of Object.values(u.jp))
      if (
        !record(x) ||
        !Number.isFinite(x.earned) ||
        !Number.isFinite(x.spent) ||
        x.earned < 0 ||
        x.spent < 0 ||
        x.spent > x.earned
      )
        fail('Invalid job point data.');
    for (const f of ['brave', 'faith', 'sign']) if (!Number.isFinite(u[f])) fail('Invalid unit statistics.');
    if (battle) {
      if (!record(u.status)) fail('Invalid battle status.');
      for (const f of ['x', 'z', 'h', 'hp', 'mp', 'maxHp', 'maxMp', 'ct', 'pa', 'ma', 'speed', 'move', 'jump', 'facing', 'team'])
        if (!Number.isFinite(u[f])) fail('Invalid battle unit.');
      if (u.maxHp <= 0 || u.hp < 0 || u.hp > u.maxHp || u.mp < 0 || u.maxMp < 0) fail('Invalid battle health.');
    }
  }
  for (const u of s.party) {
    unit(u);
    if (ids.has(u.id)) fail('Duplicate unit ID.');
    ids.add(u.id);
  }
  if (!s.party.some((u) => u.name === 'Ramza') || !record(s.inventory) || !record(s.flags) || !record(s.stats))
    fail('The save is missing essential campaign data.');
  for (const [id, n] of Object.entries(s.inventory))
    if (!db.item.has(id) || !Number.isInteger(n) || n < 0 || n > 1000000) fail('Invalid inventory.');
  for (const f of ['seed', 'chapter', 'day', 'gil', 'relics'])
    if (!Number.isFinite(s[f]) || s[f] < 0) fail('Invalid campaign values.');
  for (const f of ['selected', 'completed', 'dispatches', 'discoveries', 'fur', 'journal'])
    if (!Array.isArray(s[f])) fail('Missing campaign list.');
  if (s.selected.length > 5 || s.selected.some((id) => !ids.has(id)) || s.completed.some((id) => !db.encounter.has(id)))
    fail('Invalid campaign progress.');
  for (const d of s.dispatches)
    if (
      !record(d) ||
      typeof d.id !== 'string' ||
      !/^[a-zA-Z0-9_-]+$/.test(d.id) ||
      typeof d.unitId !== 'string' ||
      !Number.isFinite(d.due)
    )
      fail('Invalid dispatch.');
  const defaults = createState(db).options;
  s.options = { ...defaults, ...(record(s.options) ? s.options : {}) };
  if (!['Auto', 'High', 'Balanced'].includes(s.options.quality)) s.options.quality = 'Auto';
  if (!['Story', 'Tactician'].includes(s.options.difficulty)) s.options.difficulty = 'Tactician';
  for (const f of ['volume', 'music', 'sfx'])
    s.options[f] = Number.isFinite(s.options[f]) ? clamp(s.options[f], 0, 1) : defaults[f];
  s.options.speed = Number.isFinite(s.options.speed) ? clamp(s.options.speed, 0.5, 3) : 1;
  for (const f of ['mute', 'autoCamera', 'permadeath']) s.options[f] = s.options[f] === true;
  if (s.battle !== null) {
    const b = s.battle;
    if (
      !record(b) ||
      !db.encounter.has(b.definitionId) ||
      !record(b.grid) ||
      !Array.isArray(b.grid.tiles) ||
      b.grid.tiles.length > 4096 ||
      !Array.isArray(b.units) ||
      b.units.length > 99 ||
      !Array.isArray(b.pending) ||
      !Array.isArray(b.log)
    )
      fail('Invalid battle data.');
    const bid = new Set();
    for (const u of b.units) {
      unit(u, true);
      if (bid.has(u.id)) fail('Duplicate battle unit.');
      bid.add(u.id);
    }
    if (b.activeId !== null && !bid.has(b.activeId)) fail('Invalid active unit.');
    for (const t of b.grid.tiles)
      if (!record(t) || !['x', 'z', 'h'].every((f) => Number.isFinite(t[f])) || typeof t.t !== 'string')
        fail('Invalid battle tile.');
    for (const p of b.pending) if (!record(p) || !bid.has(p.casterId) || !record(p.action)) fail('Invalid queued action.');
  }
  return s;
}
export function saveLocal(s, storage = null) {
  try {
    storage ??= globalThis.localStorage;
    s.lastSaved = Date.now();
    const text = exportSave(s);
    const old = storage.getItem('ashen-zodiac-save');
    if (old) storage.setItem('ashen-zodiac-backup', old);
    storage.setItem('ashen-zodiac-save', text);
    return true;
  } catch {
    return false;
  }
}
export function loadLocal(db, storage = null) {
  for (const k of ['ashen-zodiac-save', 'ashen-zodiac-backup'])
    try {
      storage ??= globalThis.localStorage;
      const text = storage.getItem(k);
      if (text) return importSave(text, db);
    } catch {}
  return null;
}
export function checkpoint(s, storage = null) {
  try {
    storage ??= globalThis.localStorage;
    const c = copy(s);
    c.battle = null;
    storage.setItem('ashen-zodiac-checkpoint', exportSave(c));
    return true;
  } catch {
    return false;
  }
}
