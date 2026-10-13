/* Original Nacre progression rules. Pure data, deterministic rolls, no timers,
 * storage, network, payments, or game-control side effects. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NacreProgression = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '1.0.0', SCHEMA = 'nacre-progression', SAVE_VERSION = 1, LEVEL_CAP = 20;
  const MAX_INVENTORY = 40, MAX_XP = 1000000000, MAX_BANK = 1000000000, MAX_RECEIPTS = 4096;
  const SLOTS = ['weapon', 'coat', 'boots', 'charm'];
  const RARITIES = ['common', 'magic', 'rare', 'unique'];
  const AFFIX_COUNT = { common: 0, magic: 1, rare: 2, unique: 3 };
  const SKILLS = {
    quiet_steps: { id: 'quiet_steps', branch: 'Veil', name: 'Quiet Steps', description: 'Reduce the rate at which guards notice you.', maxRank: 3, gate: 0 },
    patient_hand: { id: 'patient_hand', branch: 'Veil', name: 'Patient Hand', description: 'Complete careful interactions faster.', maxRank: 3, gate: 2 },
    ambush: { id: 'ambush', branch: 'Veil', name: 'Ambush', description: 'Increase damage from a hidden approach.', maxRank: 3, gate: 4 },
    ghost: { id: 'ghost', branch: 'Veil', name: 'Ghost', description: 'Smoke lasts two seconds longer.', maxRank: 1, gate: 8, keystone: true },
    edge: { id: 'edge', branch: 'Steel', name: 'Honed Edge', description: 'Increase direct weapon damage.', maxRank: 3, gate: 0 },
    guard: { id: 'guard', branch: 'Steel', name: 'Steady Guard', description: 'Gain health and reduce incoming damage.', maxRank: 3, gate: 2 },
    riposte: { id: 'riposte', branch: 'Steel', name: 'Riposte', description: 'Widen the parry window and strengthen counters.', maxRank: 3, gate: 4 },
    iron: { id: 'iron', branch: 'Steel', name: 'Iron Resolve', description: 'Parries restore health; counters can cleave.', maxRank: 1, gate: 8, keystone: true },
    stride: { id: 'stride', branch: 'Courier', name: 'Long Stride', description: 'Move faster through the city.', maxRank: 3, gate: 0 },
    resourceful: { id: 'resourceful', branch: 'Courier', name: 'Resourceful', description: 'Recover attacks, dodges, and smoke sooner.', maxRank: 3, gate: 2 },
    broker: { id: 'broker', branch: 'Courier', name: 'Harbor Broker', description: 'Earn more job gold and find better loot.', maxRank: 3, gate: 4 },
    flow: { id: 'flow', branch: 'Courier', name: 'Flow', description: 'Dodges restore health and hasten the next interaction.', maxRank: 1, gate: 8, keystone: true }
  };
  const UNIQUES = {
    'whisper-needle': { id: 'whisper-needle', name: 'Whisper Needle', slot: 'weapon', description: 'Stealth damage ×1.8; direct damage ×0.65.' },
    tidebreaker: { id: 'tidebreaker', name: 'Tidebreaker', slot: 'weapon', description: 'Counter damage ×1.8 and counter cleave; attack recovery ×1.2.' },
    'runners-bond': { id: 'runners-bond', name: "Runner's Bond", slot: 'charm', description: 'Job gold ×1.25 and dodge recovery ×0.65; damage ×0.8.' },
    smokeweave: { id: 'smokeweave', name: 'Smokeweave', slot: 'coat', description: 'Smoke lasts two seconds longer; health ×0.8.' },
    'glass-lantern': { id: 'glass-lantern', name: 'Glass Lantern', slot: 'charm', description: 'Critical chance +30 percentage points; health ×0.8.' },
    'anchor-boots': { id: 'anchor-boots', name: 'Anchor Boots', slot: 'boots', description: 'Health ×1.25; movement ×0.88.' }
  };
  const STARTER_CHOICES = ['whisper-needle', 'runners-bond', 'smokeweave'];
  // Multiplier affixes store the complete factor, not a percentage bonus.
  // Additive affixes store seconds, probability, or damage-reduction fractions.
  const AFFIXES = {
    keen: { name: 'Keen', stat: 'damage', mode: 'mul', min: 1.02, max: 1.10, growth: .004, slots: ['weapon'] },
    sturdy: { name: 'Sturdy', stat: 'hpMax', mode: 'mul', min: 1.02, max: 1.08, growth: .003, slots: ['coat', 'boots'] },
    swift: { name: 'Swift', stat: 'moveMul', mode: 'mul', min: 1.01, max: 1.035, growth: .001, slots: ['boots', 'charm'] },
    supple: { name: 'Supple', stat: 'crouchMul', mode: 'mul', min: 1.02, max: 1.06, growth: .001, slots: ['coat', 'boots'] },
    deft: { name: 'Deft', stat: 'interactMul', mode: 'mul', min: .90, max: .97, growth: -.001, slots: ['coat', 'charm'] },
    hushed: { name: 'Hushed', stat: 'detectMul', mode: 'mul', min: .90, max: .97, growth: -.001, slots: ['coat', 'boots'] },
    veiled: { name: 'Veiled', stat: 'stealthMul', mode: 'mul', min: 1.03, max: 1.10, growth: .002, slots: ['weapon', 'charm'] },
    precise: { name: 'Precise', stat: 'critChance', mode: 'add', min: .01, max: .03, growth: .0005, slots: ['weapon', 'charm'] },
    watchful: { name: 'Watchful', stat: 'parryWindow', mode: 'add', min: .005, max: .015, growth: .0003, slots: ['weapon', 'coat'] },
    answering: { name: 'Answering', stat: 'counterMul', mode: 'mul', min: 1.03, max: 1.10, growth: .002, slots: ['weapon', 'charm'] },
    nimble: { name: 'Nimble', stat: 'dodgeCooldown', mode: 'mul', min: .90, max: .97, growth: -.001, slots: ['boots', 'charm'] },
    prepared: { name: 'Prepared', stat: 'smokeCooldown', mode: 'mul', min: .90, max: .97, growth: -.001, slots: ['coat', 'charm'] },
    lingering: { name: 'Lingering', stat: 'smokeDuration', mode: 'add', min: .15, max: .40, growth: .015, slots: ['coat', 'charm'] },
    favored: { name: 'Favored', stat: 'jobGoldMul', mode: 'mul', min: 1.03, max: 1.09, growth: .002, slots: ['coat', 'charm'] },
    learned: { name: 'Learned', stat: 'jobXpMul', mode: 'mul', min: 1.02, max: 1.06, growth: .001, slots: ['weapon', 'charm'] },
    braced: { name: 'Braced', stat: 'damageReduction', mode: 'add', min: .005, max: .015, growth: .0003, slots: ['coat', 'boots'] }
  };
  const BASE_STATS = { hpMax: 100, damage: 18, damageReduction: 0, moveMul: 1, crouchMul: 1, interactMul: 1, detectMul: 1, stealthMul: 1, critChance: .05, critMultiplier: 1.6, attackCooldown: .58, parryWindow: .30, counterMul: 1.7, dodgeCooldown: 2.5, smokeCooldown: 14, smokeDuration: 3.5, jobGoldMul: 1, jobXpMul: 1, qualityBonus: 0, keystone: null, itemEffects: [] };
  const STAT_LIMITS = { hpMax: [50, 240], damage: [5, 60], damageReduction: [0, .45], moveMul: [.65, 1.5], crouchMul: [.7, 1.4], interactMul: [.45, 1.25], detectMul: [.4, 1.2], stealthMul: [1, 4], critChance: [.03, .65], critMultiplier: [1.4, 2.4], attackCooldown: [.25, 1.5], parryWindow: [.2, .5], counterMul: [1.4, 4], dodgeCooldown: [.75, 5], smokeCooldown: [5, 20], smokeDuration: [3, 9], jobGoldMul: [1, 2.4], jobXpMul: [1, 1.6], qualityBonus: [0, .3] };
  const COUNTERS = ['jobsCompleted', 'kills', 'parries', 'dodges', 'deaths', 'lootFound', 'itemsCrafted', 'itemsSalvaged', 'playSeconds', 'rewards'];
  const XP_THRESHOLDS = [0];
  for (let n = 0; n < LEVEL_CAP - 1; n++) XP_THRESHOLDS.push(XP_THRESHOLDS[n] + 100 + 60 * n + 12 * n * n);
  const SAVE_KEYS = ['schema', 'version', 'characterName', 'seed', 'xp', 'gold', 'materials', 'skills', 'inventory', 'equipment', 'rewardSerial', 'rewardReceipts', 'starterClaimed', 'starterChoice', 'stats', 'log', 'feedback'];
  const ITEM_KEYS = ['id', 'name', 'slot', 'level', 'rarity', 'affixes', 'upgradeLevel', 'rerollCount', 'uniqueId'];
  const copy = v => JSON.parse(JSON.stringify(v));
  const owns = (o, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(o, key);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const round = n => Math.round(n * 1000000) / 1000000;
  const fail = reason => ({ ok: false, reason });
  const freeze = v => { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.values(v).forEach(freeze); } return v; };
  function hash(text) { let h = 2166136261; for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); return (h ^ h >>> 16) >>> 0; }
  function random(seed) { let a = hash(seed); return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function requireThat(condition, message) { if (!condition) throw new TypeError(message); }
  function integer(n, min, max, label) { requireThat(Number.isSafeInteger(n) && n >= min && n <= max, label + ' must be an integer from ' + min + ' to ' + max); }
  function finite(n, min, max, label) { requireThat(Number.isFinite(n) && n >= min && n <= max, label + ' is out of range'); }
  function textValue(s, max, label, empty = false) { requireThat(typeof s === 'string' && s.length <= max && (empty || s.trim().length > 0), label + ' must be valid text'); }
  function object(v, label) { requireThat(v && typeof v === 'object' && !Array.isArray(v), label + ' must be an object'); }
  function exactKeys(v, keys, label) { object(v, label); requireThat(Object.keys(v).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(v, k)), label + ' has missing or unknown fields'); }
  function safeTree(value, depth = 0, budget = { n: 0 }) {
    requireThat(depth <= 10 && ++budget.n <= 18000, 'Save data is too large');
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') { requireThat(Number.isFinite(value), 'Nonfinite save value'); return; }
    if (typeof value === 'string') { requireThat(value.length <= 2000, 'Save text is too long'); return; }
    requireThat(value && typeof value === 'object', 'Only plain data can be saved');
    requireThat(Object.getOwnPropertySymbols(value).length === 0, 'Symbol fields are not allowed');
    if (Array.isArray(value)) requireThat(Object.keys(value).length === value.length && Object.keys(value).every((key, i) => key === String(i)), 'Arrays must be dense and contain no extra fields');
    else { const proto = Object.getPrototypeOf(value); requireThat(proto === null || Object.getPrototypeOf(proto) === null, 'Only plain objects can be saved'); }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const [key, d] of Object.entries(descriptors)) {
      if (Array.isArray(value) && key === 'length') continue;
      requireThat(!['__proto__', 'prototype', 'constructor'].includes(key) && !d.get && !d.set, 'Executable or reserved fields are not allowed');
      safeTree(d.value, depth + 1, budget);
    }
  }
  function levelFor(xp) { let level = 1; while (level < LEVEL_CAP && xp >= XP_THRESHOLDS[level]) level++; return level; }
  const rankTotal = skills => Object.values(skills).reduce((a, b) => a + b, 0);
  function branchPoints(skills, branch, exclude) { return Object.keys(SKILLS).reduce((n, id) => n + (SKILLS[id].branch === branch && id !== exclude ? skills[id] : 0), 0); }
  function checkSkills(skills, xp) {
    exactKeys(skills, Object.keys(SKILLS), 'skills');
    for (const [id, skill] of Object.entries(SKILLS)) integer(skills[id], 0, skill.maxRank, 'skill ' + id);
    requireThat(rankTotal(skills) <= levelFor(xp) - 1, 'Skill points exceed the earned level budget');
    requireThat(['ghost', 'iron', 'flow'].reduce((n, id) => n + skills[id], 0) <= 1, 'Only one keystone can be active');
    // A valid final tree must be constructible in order. A skill's own ranks
    // cannot provide the points required to unlock that same skill.
    const placed = Object.fromEntries(Object.keys(SKILLS).map(id => [id, 0]));
    let progress = true;
    while (progress) { progress = false; for (const [id, skill] of Object.entries(SKILLS)) if (placed[id] < skills[id] && branchPoints(placed, skill.branch) >= skill.gate) { placed[id]++; progress = true; } }
    requireThat(Object.keys(SKILLS).every(id => placed[id] === skills[id]), 'Skill allocation does not meet its branch gates');
  }
  function affixRange(id, level) { const a = AFFIXES[id], growth = a.growth * (level - 1); return [round(a.min + growth), round(a.max + growth)]; }
  function checkItem(item) {
    exactKeys(item, ITEM_KEYS, 'item');
    textValue(item.id, 100, 'item ID'); requireThat(/^[a-zA-Z0-9:_-]+$/.test(item.id), 'Invalid item ID');
    textValue(item.name, 80, 'item name'); requireThat(SLOTS.includes(item.slot), 'Unknown equipment slot');
    integer(item.level, 1, LEVEL_CAP, 'item level'); requireThat(RARITIES.includes(item.rarity), 'Unknown item rarity');
    integer(item.upgradeLevel, 0, 3, 'upgrade level'); integer(item.rerollCount, 0, 1, 'reroll count');
    requireThat(Array.isArray(item.affixes) && item.affixes.length === AFFIX_COUNT[item.rarity], 'Incorrect affix count');
    const seen = new Set();
    for (const a of item.affixes) {
      exactKeys(a, ['id', 'value'], 'affix'); requireThat(owns(AFFIXES, a.id) && AFFIXES[a.id].slots.includes(item.slot) && !seen.has(a.id), 'Unsupported or duplicate affix'); seen.add(a.id);
      const [min, max] = affixRange(a.id, item.level); finite(a.value, min - 1e-7, max + 1e-7, 'affix value');
    }
    if (item.rarity === 'unique') requireThat(owns(UNIQUES, item.uniqueId) && UNIQUES[item.uniqueId].slot === item.slot && UNIQUES[item.uniqueId].name === item.name, 'Unique identity does not match its slot and name');
    else requireThat(item.uniqueId === null, 'Only unique items may have a unique identity');
    return item;
  }
  function checkLog(entry) {
    exactKeys(entry, ['type', 'message', 'data'], 'log event'); textValue(entry.type, 40, 'event type'); textValue(entry.message, 240, 'event message', true); object(entry.data, 'event data');
    requireThat(JSON.stringify(entry.data).length <= 1600, 'Event data is too large');
  }
  function checkFeedback(entry) {
    exactKeys(entry, ['id', 'ratings', 'notes'], 'feedback'); textValue(entry.id, 80, 'feedback ID'); object(entry.ratings, 'ratings');
    requireThat(Object.keys(entry.ratings).length > 0 && Object.keys(entry.ratings).every(k => ['combat', 'traversal', 'stealth', 'loot', 'crafting', 'overall'].includes(k)), 'Unknown or empty rating category');
    Object.values(entry.ratings).forEach(v => integer(v, 1, 5, 'rating')); textValue(entry.notes, 1000, 'feedback notes', true);
  }
  function checkSave(data) {
    safeTree(data); exactKeys(data, SAVE_KEYS, 'save'); requireThat(data.schema === SCHEMA && data.version === SAVE_VERSION, 'Unsupported progression save');
    textValue(data.characterName, 40, 'character name'); requireThat(data.characterName === 'Mara', 'This profile belongs to Mara');
    textValue(data.seed, 160, 'seed'); requireThat(data.seed === data.seed.trim(), 'Seed must be trimmed');
    integer(data.xp, 0, MAX_XP, 'XP'); integer(data.gold, 0, MAX_BANK, 'gold'); integer(data.materials, 0, MAX_BANK, 'materials'); integer(data.rewardSerial, 0, MAX_BANK, 'reward serial');
    checkSkills(data.skills, data.xp);
    requireThat(Array.isArray(data.inventory) && data.inventory.length <= MAX_INVENTORY, 'Inventory exceeds its capacity');
    const ids = new Set(); for (const item of data.inventory) { checkItem(item); requireThat(!ids.has(item.id), 'Duplicate inventory ID'); ids.add(item.id); }
    exactKeys(data.equipment, SLOTS, 'equipment');
    for (const slot of SLOTS) { const id = data.equipment[slot]; requireThat(id === null || typeof id === 'string' && data.inventory.some(item => item.id === id && item.slot === slot && item.level <= levelFor(data.xp)), 'Equipment references a missing, wrong-slot, or over-level item'); }
    requireThat(Array.isArray(data.rewardReceipts) && data.rewardReceipts.length <= MAX_RECEIPTS && new Set(data.rewardReceipts).size === data.rewardReceipts.length, 'Invalid reward receipt journal');
    for (const receipt of data.rewardReceipts) {
      textValue(receipt, 205, 'reward receipt'); const at = receipt.indexOf(':'), size = Number(receipt.slice(0, at)); integer(size, 1, 80, 'receipt source length'); requireThat(String(size) === receipt.slice(0, at), 'Malformed reward receipt');
      const source = receipt.slice(at + 1, at + 1 + size), id = receipt.slice(at + 1 + size); textValue(source, 80, 'receipt source'); textValue(id, 120, 'receipt ID'); requireThat(source.length === size && source === source.trim() && id === id.trim(), 'Malformed reward receipt');
    }
    requireThat(typeof data.starterClaimed === 'boolean', 'Invalid starter claim flag');
    requireThat(data.starterClaimed ? STARTER_CHOICES.includes(data.starterChoice) : data.starterChoice === null, 'Invalid starter choice');
    exactKeys(data.stats, COUNTERS, 'profile counters');
    for (const key of COUNTERS) if (key === 'playSeconds') finite(data.stats[key], 0, MAX_BANK, key); else integer(data.stats[key], 0, MAX_BANK, key);
    requireThat(data.rewardReceipts.length <= data.stats.rewards && data.stats.jobsCompleted <= data.stats.rewards && data.stats.rewards <= data.rewardSerial, 'Reward counters are inconsistent');
    requireThat(!data.starterClaimed || data.stats.jobsCompleted >= 1, 'Starter choice requires a completed job');
    requireThat(Array.isArray(data.log) && data.log.length <= 150, 'Event log exceeds 150 entries'); data.log.forEach(checkLog);
    requireThat(Array.isArray(data.feedback) && data.feedback.length <= 20, 'Feedback history exceeds 20 reports'); data.feedback.forEach(checkFeedback);
    return data;
  }
  function freshData(options) {
    object(options, 'options'); requireThat(Object.keys(options).every(k => ['seed', 'characterName'].includes(k)), 'Unknown profile option');
    const seed = options.seed === undefined ? '7421' : options.seed; requireThat(typeof seed === 'string' || Number.isFinite(seed), 'Invalid seed'); textValue(String(seed).trim(), 160, 'seed');
    const characterName = options.characterName === undefined ? 'Mara' : options.characterName; requireThat(characterName === 'Mara', 'This profile belongs to Mara');
    const names = { weapon: 'Quay Knife', coat: 'Harbor Coat', boots: 'Soft Boots', charm: 'Copper Token' };
    const inventory = SLOTS.map(slot => ({ id: 'starter:' + slot, name: names[slot], slot, level: 1, rarity: 'common', affixes: [], upgradeLevel: 0, rerollCount: 0, uniqueId: null }));
    return { schema: SCHEMA, version: SAVE_VERSION, characterName, seed: String(seed).trim(), xp: 0, gold: 0, materials: 0, skills: Object.fromEntries(Object.keys(SKILLS).map(id => [id, 0])), inventory, equipment: Object.fromEntries(inventory.map(i => [i.slot, i.id])), rewardSerial: 0, rewardReceipts: [], starterClaimed: false, starterChoice: null, stats: Object.fromEntries(COUNTERS.map(k => [k, 0])), log: [], feedback: [] };
  }
  function materialValue(item) { return [2, 4, 8, 14][RARITIES.indexOf(item.rarity)] + Math.floor(item.level / 4) + item.upgradeLevel * 3; }
  function costFor(item, mode) { const rarity = RARITIES.indexOf(item.rarity) * 2; return mode === 'upgrade' ? 6 + item.level * 2 + item.upgradeLevel * 8 + rarity : 8 + item.level + item.upgradeLevel * 3 + rarity; }
  function appliedStats(data) {
    integer(data.xp, 0, MAX_XP, 'XP'); checkSkills(data.skills, data.xp); exactKeys(data.equipment, SLOTS, 'equipment');
    requireThat(Array.isArray(data.inventory) && data.inventory.length <= MAX_INVENTORY, 'Invalid inventory'); data.inventory.forEach(checkItem);
    const s = copy(BASE_STATS), r = data.skills;
    s.detectMul *= Math.pow(.90, r.quiet_steps); s.interactMul *= Math.pow(.90, r.patient_hand); s.stealthMul *= Math.pow(1.15, r.ambush);
    s.damage *= Math.pow(1.10, r.edge); s.hpMax *= Math.pow(1.06, r.guard); s.damageReduction += .03 * r.guard;
    s.parryWindow += .025 * r.riposte; s.counterMul *= Math.pow(1.08, r.riposte); s.moveMul *= Math.pow(1.035, r.stride);
    const recovery = Math.pow(.94, r.resourceful); s.attackCooldown *= recovery; s.dodgeCooldown *= recovery; s.smokeCooldown *= recovery;
    s.jobGoldMul *= Math.pow(1.08, r.broker); s.qualityBonus += .035 * r.broker;
    s.keystone = r.ghost ? 'ghost' : r.iron ? 'iron' : r.flow ? 'flow' : null; if (s.keystone === 'ghost') s.smokeDuration += 2;
    for (const slot of SLOTS) {
      const id = data.equipment[slot]; if (id === null) continue;
      const item = data.inventory.find(i => i.id === id && i.slot === slot && i.level <= levelFor(data.xp)); requireThat(item, 'Equipment references a missing, wrong-slot, or over-level item');
      const l = item.level - 1, u = item.upgradeLevel;
      if (slot === 'weapon') s.damage *= 1 + .004 * l + .04 * u;
      if (slot === 'coat') s.hpMax *= 1 + .0035 * l + .025 * u;
      if (slot === 'boots') s.moveMul *= 1 + .001 * l + .008 * u;
      if (slot === 'charm') s.jobXpMul *= 1 + .0015 * l + .015 * u;
      for (const a of item.affixes) { const rule = AFFIXES[a.id], strength = 1 + .15 * u; if (rule.mode === 'mul') s[rule.stat] *= 1 + (a.value - 1) * strength; else s[rule.stat] += a.value * strength; }
      if (item.uniqueId) {
        s.itemEffects.push(item.uniqueId);
        if (item.uniqueId === 'whisper-needle') { s.stealthMul *= 1.8; s.damage *= .65; }
        if (item.uniqueId === 'tidebreaker') { s.counterMul *= 1.8; s.attackCooldown *= 1.2; s.itemEffects.push('counterCleave'); }
        if (item.uniqueId === 'runners-bond') { s.jobGoldMul *= 1.25; s.dodgeCooldown *= .65; s.damage *= .8; }
        if (item.uniqueId === 'smokeweave') { s.smokeDuration += 2; s.hpMax *= .8; }
        if (item.uniqueId === 'glass-lantern') { s.critChance += .3; s.hpMax *= .8; }
        if (item.uniqueId === 'anchor-boots') { s.hpMax *= 1.25; s.moveMul *= .88; }
      }
    }
    for (const [key, [min, max]] of Object.entries(STAT_LIMITS)) { requireThat(Number.isFinite(s[key]), 'Invalid derived stat ' + key); s[key] = round(clamp(s[key], min, max)); }
    return s;
  }

  class Profile {
    constructor(data) { checkSave(data); this.data = copy(data); }
    exportSave() { checkSave(this.data); return copy(this.data); }
    validate() { try { checkSave(this.data); appliedStats(this.data); return { ok: true }; } catch (error) { return fail(error.message); } }
    stats() { return appliedStats(this.data); }
    level() { integer(this.data.xp, 0, MAX_XP, 'XP'); return levelFor(this.data.xp); }
    xpToNext() { const level = this.level(); return level === LEVEL_CAP ? 0 : XP_THRESHOLDS[level] - this.data.xp; }
    availablePoints() { checkSkills(this.data.skills, this.data.xp); return this.level() - 1 - rankTotal(this.data.skills); }
    _log(type, message, data = {}) { this.data.log.push({ type, message, data: copy(data) }); if (this.data.log.length > 150) this.data.log.splice(0, this.data.log.length - 150); }
    _item(id) { return typeof id === 'string' ? this.data.inventory.find(item => item.id === id) : null; }
    allocate(id) {
      const skill = owns(SKILLS, id) ? SKILLS[id] : null; if (!skill) return fail('Unknown skill.');
      if (this.availablePoints() <= 0) return fail('No unspent skill points.');
      if (this.data.skills[id] >= skill.maxRank) return fail('This skill is at its maximum rank.');
      if (branchPoints(this.data.skills, skill.branch) < skill.gate) return fail('Invest ' + skill.gate + ' points in ' + skill.branch + ' first.');
      if (skill.keystone && ['ghost', 'iron', 'flow'].some(key => this.data.skills[key])) return fail('Only one keystone can be active.');
      this.data.skills[id]++; this._log('skill', skill.name + ' gained a rank.', { skillId: id, rank: this.data.skills[id] });
      return { ok: true, skillId: id, rank: this.data.skills[id], availablePoints: this.availablePoints() };
    }
    resetSkills() {
      const points = rankTotal(this.data.skills); if (!points) return fail('No skills are allocated.');
      const cost = 0; for (const id of Object.keys(SKILLS)) this.data.skills[id] = 0;
      this._log('respec', 'Skills reset for this playtest.', { cost, points }); return { ok: true, cost, refundedPoints: points, availablePoints: this.availablePoints() };
    }
    generateLoot(options = {}) {
      try {
        object(options, 'loot options'); requireThat(Object.keys(options).every(k => ['seed', 'level', 'danger', 'rarity', 'uniqueId'].includes(k)), 'Unknown loot option');
        const seed = options.seed === undefined ? 'preview:' + this.data.rewardSerial : options.seed; requireThat(typeof seed === 'string' || Number.isFinite(seed), 'Invalid loot seed'); textValue(String(seed), 200, 'loot seed');
        const level = options.level === undefined ? this.level() : options.level, danger = options.danger === undefined ? 1 : options.danger;
        integer(level, 1, LEVEL_CAP, 'loot level'); integer(danger, 1, 5, 'danger');
        if (options.rarity !== undefined) requireThat(RARITIES.includes(options.rarity), 'Unknown rarity');
        if (options.uniqueId !== undefined) requireThat(owns(UNIQUES, options.uniqueId) && (options.rarity === undefined || options.rarity === 'unique'), 'Invalid unique choice');
        const key = this.data.seed + '|loot|' + String(seed) + '|' + level + '|' + danger + '|' + (options.rarity || '') + '|' + (options.uniqueId || ''), rng = random(key);
        let rarity = options.uniqueId ? 'unique' : options.rarity;
        if (!rarity) {
          const quality = this.stats().qualityBonus, roll = rng(), unique = .008 + danger * .004 + quality * .10, rare = .10 + danger * .025 + quality * .25, magic = .26 + danger * .04 + quality * .35;
          rarity = roll < unique ? 'unique' : roll < unique + rare ? 'rare' : roll < unique + rare + magic ? 'magic' : 'common';
        }
        let uniqueId = null, slot, name;
        if (rarity === 'unique') { const ids = Object.keys(UNIQUES); uniqueId = options.uniqueId || ids[Math.floor(rng() * ids.length)]; slot = UNIQUES[uniqueId].slot; name = UNIQUES[uniqueId].name; }
        else { slot = SLOTS[Math.floor(rng() * SLOTS.length)]; const names = { weapon: ['Quay Blade', 'Ledger Knife', 'Watch Saber'], coat: ['Canvas Coat', 'Dusk Mantle', 'Salt Jacket'], boots: ['Quay Boots', 'Rooftop Shoes', 'Harbor Soles'], charm: ['Tide Token', 'Copper Knot', 'Glass Seal'] }; const prefixes = { common: 'Plain', magic: 'Fine', rare: 'Marked' }; name = prefixes[rarity] + ' ' + names[slot][Math.floor(rng() * names[slot].length)]; }
        const pool = Object.keys(AFFIXES).filter(id => AFFIXES[id].slots.includes(slot)), affixes = [];
        for (let i = 0; i < AFFIX_COUNT[rarity]; i++) { const at = Math.floor(rng() * pool.length), id = pool.splice(at, 1)[0], [min, max] = affixRange(id, level); affixes.push({ id, value: round(min + rng() * (max - min)) }); }
        const item = { id: 'loot:' + hash(key).toString(36) + ':' + hash(key + ':identity').toString(36), name, slot, level, rarity, affixes, upgradeLevel: 0, rerollCount: 0, uniqueId };
        checkItem(item); return { ok: true, item };
      } catch (error) { return fail(error.message); }
    }
    addItem(item) {
      try { safeTree(item); checkItem(item); } catch (error) { return fail(error.message); }
      if (this._item(item.id)) return fail('This item is already in the inventory.');
      if (this.data.inventory.length >= MAX_INVENTORY) return fail('Inventory is full.');
      this.data.inventory.push(copy(item)); this._log('item', item.name + ' added.', { itemId: item.id }); return { ok: true, item: copy(item) };
    }
    equip(id) {
      const item = this._item(id); if (!item) return fail('Item not found.');
      if (item.level > this.level()) return fail('Reach level ' + item.level + ' to equip this item.');
      if (this.data.equipment[item.slot] === id) return fail('This item is already equipped.');
      checkItem(item); const replacedId = this.data.equipment[item.slot]; this.data.equipment[item.slot] = id;
      this._log('equip', item.name + ' equipped.', { itemId: id, slot: item.slot, replacedId }); return { ok: true, item: copy(item), replacedId };
    }
    salvage(id) {
      const item = this._item(id); if (!item) return fail('Item not found.');
      if (Object.values(this.data.equipment).includes(id)) return fail('Equipped items cannot be salvaged.');
      const materials = materialValue(item); if (this.data.materials + materials > MAX_BANK) return fail('Material reserve is full.');
      this.data.inventory.splice(this.data.inventory.indexOf(item), 1); this.data.materials += materials; this.data.stats.itemsSalvaged = Math.min(MAX_BANK, this.data.stats.itemsSalvaged + 1);
      this._log('salvage', item.name + ' salvaged for ' + materials + ' materials.', { itemId: id, materials }); return { ok: true, materials, itemId: id };
    }
    upgrade(id) {
      const item = this._item(id); if (!item) return fail('Item not found.');
      if (item.upgradeLevel >= 3) return fail('This item has all three upgrades.');
      const cost = costFor(item, 'upgrade'); if (this.data.materials < cost) return fail('Upgrade requires ' + cost + ' materials.');
      this.data.materials -= cost; item.upgradeLevel++; this.data.stats.itemsCrafted = Math.min(MAX_BANK, this.data.stats.itemsCrafted + 1);
      this._log('upgrade', item.name + ' upgraded to +' + item.upgradeLevel + '.', { itemId: id, cost }); return { ok: true, cost, item: copy(item) };
    }
    reroll(id) {
      const item = this._item(id); if (!item) return fail('Item not found.');
      if (!item.affixes.length) return fail('This item has no affix to reroll.');
      if (item.rerollCount >= 1) return fail('This item has used its one affix reroll.');
      const cost = costFor(item, 'reroll'); if (this.data.materials < cost) return fail('Reroll requires ' + cost + ' materials.');
      if (this.data.rewardSerial >= MAX_BANK) return fail('The saved roll counter is full.');
      const serial = this.data.rewardSerial + 1, rng = random(this.data.seed + '|reroll|' + id + '|' + serial), index = Math.floor(rng() * item.affixes.length), before = copy(item.affixes[index]);
      const pool = Object.keys(AFFIXES).filter(key => AFFIXES[key].slots.includes(item.slot) && !item.affixes.some((a, i) => i !== index && a.id === key));
      const nextId = pool[Math.floor(rng() * pool.length)], [min, max] = affixRange(nextId, item.level), after = { id: nextId, value: round(min + rng() * (max - min)) };
      this.data.materials -= cost; this.data.rewardSerial = serial; item.affixes[index] = after; item.rerollCount++; this.data.stats.itemsCrafted = Math.min(MAX_BANK, this.data.stats.itemsCrafted + 1);
      this._log('reroll', item.name + ' had one affix rerolled.', { itemId: id, index, cost, before, after }); return { ok: true, cost, index, before, after: copy(after), item: copy(item) };
    }
    reward(options = {}) {
      try {
        object(options, 'reward'); requireThat(Object.keys(options).every(k => ['xp', 'gold', 'seed', 'danger', 'source', 'rewardId', 'loot'].includes(k)), 'Unknown reward field');
        const xp = options.xp === undefined ? 0 : options.xp, gold = options.gold === undefined ? 0 : options.gold, danger = options.danger === undefined ? 1 : options.danger, sourceText = options.source === undefined ? 'activity' : options.source;
        integer(xp, 0, 1000000, 'reward XP'); integer(gold, 0, 1000000, 'reward gold'); integer(danger, 1, 5, 'danger'); textValue(sourceText, 80, 'reward source');
        const source = sourceText.trim(); let receipt = null;
        if (options.rewardId !== undefined) {
          requireThat(typeof options.rewardId === 'string' || Number.isSafeInteger(options.rewardId), 'Invalid reward ID'); const id = String(options.rewardId).trim(); textValue(id, 120, 'reward ID'); receipt = source.length + ':' + source + id;
          if (this.data.rewardReceipts.includes(receipt)) return { ...fail('This reward has already been granted.'), duplicate: true };
          if (this.data.rewardReceipts.length >= MAX_RECEIPTS) return fail('Reward receipt journal is full; reward was not applied.');
        }
        const seed = options.seed === undefined ? source : options.seed; requireThat(typeof seed === 'string' || Number.isFinite(seed), 'Invalid reward seed'); textValue(String(seed), 160, 'reward seed');
        const job = source === 'job' || source.startsWith('job:'), s = this.stats(), earnedXp = Math.round(xp * (job ? s.jobXpMul : 1)), earnedGold = Math.round(gold * (job ? s.jobGoldMul : 1));
        if (this.data.gold + earnedGold > MAX_BANK || this.data.rewardSerial >= MAX_BANK) return fail('The saved reward reserve is full.');
        const serial = this.data.rewardSerial + 1, oldLevel = this.level(), oldXp = this.data.xp, newXp = Math.min(MAX_XP, oldXp + earnedXp), items = [];
        const loot = options.loot === undefined ? true : options.loot;
        if (loot === true) { const rolled = this.generateLoot({ seed: String(seed) + ':reward:' + serial, level: levelFor(newXp), danger }); if (!rolled.ok) return rolled; items.push(rolled.item); }
        else if (loot !== false) { const list = Array.isArray(loot) ? loot : [loot]; requireThat(list.length <= 5, 'At most five reward items are allowed'); for (const item of list) { safeTree(item); checkItem(item); items.push(copy(item)); } }
        const seen = new Set(this.data.inventory.map(i => i.id)); for (const item of items) { requireThat(!seen.has(item.id), 'Duplicate reward item ID'); seen.add(item.id); }
        const space = MAX_INVENTORY - this.data.inventory.length, overflow = items.slice(space), overflowMaterials = overflow.reduce((n, item) => n + materialValue(item), 0);
        if (this.data.materials + overflowMaterials > MAX_BANK) return fail('Material reserve is full; reward was not applied.');
        this.data.xp = newXp; this.data.gold += earnedGold; this.data.rewardSerial = serial; if (receipt) this.data.rewardReceipts.push(receipt); this.data.stats.rewards = Math.min(MAX_BANK, this.data.stats.rewards + 1); if (job) this.data.stats.jobsCompleted = Math.min(MAX_BANK, this.data.stats.jobsCompleted + 1);
        const lootResults = items.map((item, i) => { if (i < space) { this.data.inventory.push(item); return { item: copy(item), added: true, convertedMaterials: 0 }; } const materials = materialValue(item); this.data.materials += materials; return { item: copy(item), added: false, convertedMaterials: materials }; });
        this.data.stats.lootFound = Math.min(MAX_BANK, this.data.stats.lootFound + items.length);
        const level = this.level(), appliedXp = newXp - oldXp;
        const message = 'Earned ' + appliedXp + ' XP and ' + earnedGold + ' gold.' + (overflowMaterials ? ' Full inventory: overflow converted to ' + overflowMaterials + ' materials.' : '');
        this._log('reward', message, { source, xp: appliedXp, gold: earnedGold, serial, lootCount: items.length, overflowMaterials });
        return { ok: true, xp: appliedXp, xpAtReserveCap: earnedXp - appliedXp, gold: earnedGold, level, levelsGained: level - oldLevel, availablePoints: this.availablePoints(), serial, loot: lootResults, overflowMaterials, starterAvailable: !this.data.starterClaimed && this.data.stats.jobsCompleted > 0, message };
      } catch (error) { return fail(error.message); }
    }
    claimStarter(uniqueId) {
      if (this.data.starterClaimed) return fail('The starter unique has already been claimed.');
      if (this.data.stats.jobsCompleted < 1) return fail('Complete a job before choosing a starter unique.');
      if (!STARTER_CHOICES.includes(uniqueId)) return fail('Choose one of the three starter uniques.');
      if (this.data.inventory.length >= MAX_INVENTORY) return fail('Make one inventory space before claiming your unique.');
      if (this.data.rewardSerial >= MAX_BANK) return fail('The saved roll counter is full.');
      const serial = this.data.rewardSerial + 1, result = this.generateLoot({ seed: 'starter-choice:' + serial + ':' + uniqueId, level: this.level(), danger: 1, uniqueId });
      if (!result.ok) return result;
      if (this._item(result.item.id)) return fail('This starter item is already in the inventory.');
      this.data.inventory.push(result.item); this.data.rewardSerial = serial; this.data.starterClaimed = true; this.data.starterChoice = uniqueId; this.data.stats.lootFound = Math.min(MAX_BANK, this.data.stats.lootFound + 1);
      this._log('starter', result.item.name + ' chosen as the first-job reward.', { itemId: result.item.id, uniqueId }); return { ok: true, item: copy(result.item), uniqueId };
    }
    event(type, data = {}) {
      try {
        textValue(type, 40, 'event type'); requireThat(/^[a-zA-Z][a-zA-Z0-9_:-]*$/.test(type), 'Invalid event type'); safeTree(data); object(data, 'event data'); requireThat(JSON.stringify(data).length <= 1600, 'Event data is too large');
        const map = { kill: 'kills', parry: 'parries', dodge: 'dodges', death: 'deaths' }, counter = owns(map, type) ? map[type] : null;
        if (counter && this.data.stats[counter] >= MAX_BANK) return fail('Event counter is full.');
        if (type === 'play') { const seconds = data.seconds; finite(seconds, 0, 3600, 'play seconds'); if (this.data.stats.playSeconds + seconds > MAX_BANK) return fail('Play counter is full.'); this.data.stats.playSeconds = round(this.data.stats.playSeconds + seconds); }
        if (counter) this.data.stats[counter]++;
        this._log(type, typeof data.message === 'string' ? data.message.slice(0, 240) : '', data); return { ok: true };
      } catch (error) { return fail(error.message); }
    }
    feedback(options = {}) {
      try {
        exactKeys(options, ['ratings', 'notes'], 'feedback'); safeTree(options);
        const id = 'feedback:' + this.data.rewardSerial + ':' + hash(JSON.stringify(options) + ':' + this.data.log.length).toString(36), entry = { id, ratings: copy(options.ratings), notes: options.notes }; checkFeedback(entry);
        this.data.feedback.push(entry); if (this.data.feedback.length > 20) this.data.feedback.shift(); this._log('feedback', 'Playtest feedback recorded locally.', { reportId: id }); return { ok: true, report: copy(entry) };
      } catch (error) { return fail(error.message); }
    }
  }
  function fromSave(input) {
    let data = input; if (typeof input === 'string') { requireThat(input.length <= 1500000, 'Save is too large'); try { data = JSON.parse(input); } catch (error) { throw new TypeError('Progression save is not valid JSON'); } }
    checkSave(data); return new Profile(data);
  }
  const create = (options = {}) => new Profile(freshData(options));
  const validate = input => { try { checkSave(input); appliedStats(input); return { ok: true }; } catch (error) { return fail(error.message); } };
  for (const value of [SLOTS, RARITIES, SKILLS, UNIQUES, STARTER_CHOICES, AFFIXES, BASE_STATS, STAT_LIMITS, XP_THRESHOLDS]) freeze(value);
  return { version: VERSION, LEVEL_CAP, MAX_INVENTORY, MAX_RECEIPTS, SLOTS, SKILLS, UNIQUES, STARTER_CHOICES, RARITIES, AFFIXES, BASE_STATS, STAT_LIMITS, XP_THRESHOLDS, Profile, create, fromSave, validate };
});
