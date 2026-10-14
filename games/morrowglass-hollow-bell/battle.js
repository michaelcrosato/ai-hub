/* Morrowglass battle rules. Original game code; no engine dependencies. */
(function (root) {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const live = u => u.hp > 0;
  const ACTIONS = {
    attack: { name: 'Attack', target: 'enemy', description: 'Strike one enemy with your weapon.' },
    steal: { name: 'Unpick', target: 'enemy', role: 'ivo', description: 'Take an item once per enemy. Remove shells and wards. Can break a marked charge.' },
    gust: { name: 'Knife Gust', target: 'allEnemies', role: 'ivo', mp: 3, ability: 'gust', element: 'wind', description: 'Strike all enemies with wind. Bronze Thread teaches this skill.' },
    spark: { name: 'Spark', target: 'enemy', role: 'mina', mp: 3, element: 'light', description: 'Deal light damage. Two Sparks stop Doom Chime while it charges.' },
    mend: { name: 'Mend', target: 'ally', role: 'mina', mp: 4, description: 'Restore 76 HP to one living ally. Power rises after Level 2.' },
    frost: { name: 'Frost', target: 'enemy', role: 'mina', mp: 4, ability: 'frost', element: 'frost', description: 'Deal cold damage and slow the enemy for 12 seconds.' },
    flare: { name: 'Flare', target: 'enemy', role: 'mina', mp: 5, ability: 'flare', element: 'fire', description: 'Deal 66 fire damage before weaknesses. Power rises after Level 2.' },
    renew: { name: 'Renew', target: 'allAllies', role: 'mina', mp: 7, ability: 'renew', description: 'Restore 58 HP to each living ally. Power rises after Level 2.' },
    pierce: { name: 'Silver Pierce', target: 'enemy', role: 'ivo', mp: 4, ability: 'pierce', description: 'Strike for 155% Attack. Ignore armor and shells. Wards still reduce damage.' },
    quickstep: { name: 'Quickstep', target: 'allAllies', role: 'ivo', mp: 4, ability: 'quickstep', description: 'Add 35% ATB to each other living ally. Ivo gains 12 Resolve. His own ATB stays empty.' },
    rekindle: { name: 'Rekindle', target: 'deadAlly', role: 'mina', mp: 9, ability: 'rekindle', description: 'Revive one fallen ally. Healing power rises with Mina’s level.' },
    threadcut: { name: 'Threadcut', target: 'enemy', role: 'ivo', mp: 6, ability: 'threadcut', description: 'Strike for 120% Attack. Expose the enemy for 12 active battle seconds. The next two hits against it deal 20% more damage.' },
    clearsong: { name: 'Clear Song', target: 'allAllies', role: 'mina', mp: 6, ability: 'clearsong', description: 'Restore some HP to each living ally. Clear Slow and Poison.' },
    interpose: { name: 'Interpose', target: 'allAllies', role: 'orrin', mp: 7, ability: 'interpose', description: 'For 12 active battle seconds, all living allies take 25% less damage and recover 5% maximum HP every 3 seconds. No cover. Can combine with Bulwark.' },
    cleave: { name: 'Cleave', target: 'allEnemies', role: 'orrin', mp: 3, description: 'Strike all enemies with a broad sword cut.' },
    bulwark: { name: 'Bulwark', target: 'allAllies', role: 'orrin', mp: 3, description: 'Reduce the next hit on each ally by 60%. Orrin covers two single attacks.' },
    rally: { name: 'Rally', target: 'allAllies', role: 'orrin', mp: 4, ability: 'rally', description: 'Restore 3 MP to each other living ally. All living allies gain 12 Resolve.' },
    guard: { name: 'Guard', target: 'self', description: 'Reduce incoming damage by half until your next action. Gain 8 Resolve.' },
    tonic: { name: 'Tonic', target: 'ally', item: 'tonic', description: 'Restore 80 HP, plus 18 per target level above 2, to one living ally.' },
    ether: { name: 'Ether', target: 'ally', item: 'ether', description: 'Restore 12 MP, plus 2 per target level above 2, to one living ally.' },
    feather: { name: 'Feather', target: 'deadAlly', item: 'feather', description: 'Revive one fallen ally with 60 HP, plus 14 per target level above 2.' },
    limit: { name: 'Resonance', target: 'enemy', resolve: 100, description: 'Spend 100 Resolve for your strongest signature skill.' },
    concord: { name: 'Concord', target: 'allEnemies', concord: 100, description: 'Spend 100 Concord. Strike all enemies and restore HP to each living ally. The shared gauge rises when the party acts and strikes a weakness.' },
    flee: { name: 'Withdraw', target: 'self', description: 'Leave this encounter. Gain no rewards. Boss encounters cannot be left.' }
  };
  const ABILITIES = {
    gust: { name: 'Knife Gust', role: 'ivo', gear: 'bronze-thread', ap: 12, aliases: ['gust', 'knife-gust', 'knife gust', 'knifegust', 'bronze-thread', 'bronze thread'] },
    frost: { name: 'Frost', role: 'mina', gear: 'frost-thread', ap: 8, aliases: ['frost', 'frost-thread', 'frost thread', 'frost-glass', 'frost glass', 'frost-charm', 'frost charm', 'rime-lens', 'rime lens', 'rime-glass', 'rime glass'] },
    flare: { name: 'Flare', role: 'mina', gear: 'ember-prism', ap: 22, aliases: ['flare', 'ember-prism', 'ember prism'] },
    renew: { name: 'Renew', role: 'mina', gear: 'dawn-prism', ap: 26, aliases: ['renew', 'dawn-prism', 'dawn prism'] },
    pierce: { name: 'Silver Pierce', role: 'ivo', gear: 'silver-thread', ap: 20, aliases: ['pierce', 'silver-pierce', 'silver pierce', 'silver-thread', 'silver thread'] },
    rally: { name: 'Rally', role: 'orrin', gear: 'herald-knot', ap: 20, aliases: ['rally', 'herald-knot', 'herald knot'] },
    quickstep: { name: 'Quickstep', role: 'ivo', gear: 'courier-knot', ap: 24, aliases: ['quickstep', 'courier-knot', 'courier knot'] },
    rekindle: { name: 'Rekindle', role: 'mina', gear: 'rain-prism', ap: 24, aliases: ['rekindle', 'rain-prism', 'rain prism'] },
    threadcut: { name: 'Threadcut', role: 'ivo', gear: 'courier-thread', ap: 28, aliases: ['threadcut', 'courier-thread', 'courier thread'] },
    clearsong: { name: 'Clear Song', role: 'mina', gear: 'clear-prism', ap: 28, aliases: ['clearsong', 'clear-song', 'clear song', 'clear-prism', 'clear prism'] },
    interpose: { name: 'Interpose', role: 'orrin', gear: 'promise-oath', ap: 28, aliases: ['interpose', 'promise-oath', 'promise oath'] }
  };
  const STATUSES = Object.freeze({
    slow: Object.freeze({ name: 'Slow', harmful: true, description: 'ATB fills more slowly. Enemy charges also take longer.' }),
    poison: Object.freeze({ name: 'Poison', harmful: true, description: 'Lose 4% maximum HP every 3 active battle seconds. HP cannot fall below 1.' }),
    exposed: Object.freeze({ name: 'Exposed', harmful: true, description: 'The next two hits deal 20% more damage.' }),
    regen: Object.freeze({ name: 'Regen', harmful: false, description: 'Recover 5% maximum HP every 3 active battle seconds.' }),
    protect: Object.freeze({ name: 'Protection', harmful: false, description: 'Take 25% less damage. Can combine with Guard and Bulwark.' }),
    guard: Object.freeze({ name: 'Guard', harmful: false, description: 'Take half damage until the next action or expiry.' }),
    ward: Object.freeze({ name: 'Ward', harmful: false, description: 'The next hit deals 60% less damage.' }),
    cover: Object.freeze({ name: 'Cover', harmful: false, description: 'Cover the next two single attacks aimed at another ally.' })
  });
  const CRESTS = Object.freeze({
    vigor: Object.freeze({ name: 'Vigor', cost: 2, description: 'Deal 15% more damage.' }),
    shelter: Object.freeze({ name: 'Shelter', cost: 2, description: 'Take 15% less damage.' }),
    current: Object.freeze({ name: 'Current', cost: 2, description: 'Fill ATB 15% faster.' }),
    thrift: Object.freeze({ name: 'Thrift', cost: 2, description: 'Skills cost 2 less MP, to a minimum of 1 MP.' }),
    clarity: Object.freeze({ name: 'Clarity', cost: 1, description: 'Harmful status lasts half as long.' }),
    renewal: Object.freeze({ name: 'Renewal', cost: 2, description: 'After each action, restore up to 8% of maximum HP.' })
  });
  function normalizeCrests(value) {
    const result = []; let points = 0;
    for (const id of Array.isArray(value) ? value : []) {
      if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(CRESTS, id) || result.includes(id) || result.length >= 2 || points + CRESTS[id].cost > 4) continue;
      result.push(id); points += CRESTS[id].cost;
    }
    return result;
  }
  const crestCost = value => normalizeCrests(value).reduce((sum, id) => sum + CRESTS[id].cost, 0);
  const levelExtra = h => Math.max(0, Math.min(18, Math.floor(Number(h.level) || 1)) - 2);
  const powerAt = (h, base) => Math.round(base * (1 + levelExtra(h) * .18));
  const itemPower = (id, h) => ({ tonic: 80, ether: 12, feather: 60 }[id] || 0) + levelExtra(h) * ({ tonic: 18, ether: 2, feather: 14 }[id] || 0);
  const copy = value => JSON.parse(JSON.stringify(value));
  const LIMIT_NAMES = { ivo: 'Thousand Threads', mina: 'Dawn Chorus', orrin: 'Last Bastion' };
  const ENCOUNTERS = {
    thorns: { crowns: 42, ap: 6, enemies: [
      { id: 'moth-a', name: 'Lantern Moth', kind: 'moth', maxHp: 106, atk: 20, def: 3, rate: .175 },
      { id: 'moth-b', name: 'Cinder Moth', kind: 'moth', maxHp: 94, atk: 21, def: 3, rate: .16 }
    ] },
    sentry: { crowns: 76, ap: 8, enemies: [
      { id: 'sentry', name: 'Kiln Sentry', kind: 'sentry', maxHp: 280, atk: 35, def: 8, rate: .175 },
      { id: 'sentry-moth', name: 'Lantern Moth', kind: 'moth', maxHp: 96, atk: 22, def: 3, rate: .17 }
    ] },
    boss: { crowns: 180, ap: 14, enemies: [
      { id: 'bellkeeper', name: 'Hollow Bellkeeper', kind: 'boss', maxHp: 780, atk: 40, def: 9, rate: .18, shell: true }
    ] }
  };

  // Encounter definitions are reusable data. Runtime HP, intent, and phase state are separate.
  Object.assign(ENCOUNTERS.thorns, { name: 'Lamps in the dark', boss: false, level: 1, hint: 'Spark is strong against the lantern moths.' });
  Object.assign(ENCOUNTERS.sentry, { name: 'The forgotten guard', boss: false, level: 1, hint: 'Frost slows the sentry. Bulwark covers its hammer.' });
  Object.assign(ENCOUNTERS.boss, { name: 'Hollow Bellkeeper', boss: true, level: 2, hint: 'Unpick its shell. Two Sparks interrupt Doom Chime.' });
  const attack = (id, name, power, target = 'single', windup = 1.2, extra = {}) => ({ id, name, power, target, windup, ...extra });
  const counter = (actions, hits, label) => ({ interrupt: { actions, hits }, counterHint: label });
  const enemy = (id, name, kind, hp, atk, def, weakness, tint, pattern, extra = {}) => ({
    id, name, kind, visual: kind, maxHp: hp, atk, def, rate: .18, weakness, tint, pattern, ...extra
  });
  function registerEncounter(id, definition, { replace = false } = {}) {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !definition || typeof definition !== 'object') throw new Error('Encounter needs a valid id and definition.');
    if (ENCOUNTERS[id] && !replace) throw new Error('Encounter already exists: ' + id);
    if (!Array.isArray(definition.enemies) || !definition.enemies.length || definition.enemies.length > 3) throw new Error('An encounter needs one to three enemies.');
    const data = copy(definition), ids = new Set();
    data.name = String(data.name || id); data.boss = Boolean(data.boss); data.hint = String(data.hint || 'Read the next attack and protect the party.');
    for (const key of ['crowns', 'ap', 'xp']) if (data[key] !== undefined && (!Number.isFinite(data[key]) || data[key] < 0)) throw new Error('Invalid encounter reward: ' + key);
    data.crowns ??= 0; data.ap ??= 0;
    for (const e of data.enemies) {
      if (!e.id || ids.has(e.id) || !Number.isFinite(e.maxHp) || e.maxHp < 1 || !Number.isFinite(e.atk) || e.atk < 0) throw new Error('Invalid enemy or duplicate enemy id.');
      ids.add(e.id); e.name = String(e.name || e.id); e.kind ||= 'beast'; e.visual ||= e.kind; e.tint ||= '#a9c9b7';
      e.boss ??= data.boss; e.def ??= 0; e.rate ??= .18;
      if (!Number.isFinite(e.def) || e.def < 0 || !Number.isFinite(e.rate) || e.rate <= 0 || e.rate > 1) throw new Error('Invalid enemy defense or rate.');
      if (e.phases && (!Array.isArray(e.phases) || e.phases.length < 2 || e.phases[0].at !== 1 || e.phases.some((p, i, all) => !Number.isFinite(p.at) || p.at <= 0 || p.at > 1 || i > 0 && p.at >= all[i - 1].at))) throw new Error('Phase thresholds must decrease from 1 to above 0.');
      const patterns = [e.pattern, ...(e.phases || []).map(p => p.pattern)].filter(Boolean);
      if (e.phases?.some(p => !Array.isArray(p.pattern) || !p.pattern.length)) throw new Error('Each phase needs an attack pattern.');
      for (const pattern of patterns) {
        if (!Array.isArray(pattern) || !pattern.length) throw new Error('An attack pattern cannot be empty.');
        for (const a of pattern) {
          if (!a.id || !a.name || !['single', 'all'].includes(a.target) || !Number.isFinite(a.power) || a.power < 0 || !Number.isFinite(a.windup) || a.windup < .3 || a.windup > 30) throw new Error('Invalid attack pattern.');
          if (a.interrupt && (!Array.isArray(a.interrupt.actions) || !a.interrupt.actions.length || a.interrupt.actions.some(k => !ACTIONS[k]) || !Number.isInteger(a.interrupt.hits) || a.interrupt.hits < 1 || a.interrupt.hits > 3)) throw new Error('Invalid interrupt rule.');
          if (a.status && (!['slow', 'poison', 'exposed'].includes(a.status.id) || !Number.isFinite(a.status.duration) || a.status.duration <= 0 || a.status.duration > 60)) throw new Error('Invalid attack status.');
        }
      }
    }
    ENCOUNTERS[id] = data;
    return data;
  }
  const campaign = (id, name, level, boss, crowns, ap, hint, enemies) => registerEncounter(id, {
    name, level, boss, crowns, ap, xp: level * 55 + (boss ? 80 : 0), hint, enemies
  });
  campaign('reed-rescue', 'A courier in the reeds', 2, false, 72, 8, 'Spark clears the moth. Guard or Bulwark softens Mud Splash.', [
    enemy('reed-moth', 'Reed Lantern Moth', 'moth', 148, 26, 4, 'light', '#a5c885', [attack('reed-dart', 'Reed Dart', 26)]),
    enemy('bog-skipper', 'Bog Skipper', 'beast', 176, 30, 6, 'fire', '#7fab92', [attack('bog-bite', 'Bog Bite', 30), attack('mud-splash', 'Mud Splash', 19, 'all', 2.4)])
  ]);
  campaign('bridge-warden', 'The sleeping span', 3, true, 115, 10, 'Unpick loosens the armor. Knife Gust stops Bridge Sweep. Bulwark also protects the party.', [
    enemy('span-warden', 'Span Warden', 'sentry', 520, 47, 15, 'wind', '#c0a477', [
      attack('chain-hook', 'Chain Hook', 47), attack('bridge-sweep', 'Bridge Sweep', 48, 'all', 5, counter(['gust'], 1, 'Knife Gust once, or Bulwark'))
    ], { shell: true, loot: 'ether', rate: .19 })
  ]);
  campaign('forge-heart', 'The forge that would not sleep', 3, true, 140, 12, 'Frost deals extra damage and stops Furnace Bloom. Bulwark can absorb the heat.', [
    enemy('cinder-heart', 'Cinder Heart', 'sentry', 610, 49, 13, 'frost', '#e5a079', [
      attack('furnace-fist', 'Furnace Fist', 49), attack('furnace-bloom', 'Furnace Bloom', 76, 'all', 6.2, { magical: true, ...counter(['frost'], 1, 'Frost once, or Bulwark') })
    ], { loot: 'ether', rate: .195 })
  ]);
  campaign('grove-keeper', 'The name beneath the roots', 4, true, 155, 14, 'Spark deals extra damage. Spark or Flare breaks Sap Bloom before the roots recover.', [
    enemy('willow-keeper', 'Willow Keeper', 'root', 670, 49, 11, 'light', '#aac28a', [
      attack('root-clasp', 'Root Clasp', 49), attack('sap-bloom', 'Sap Bloom', 43, 'all', 5.8, { heal: 60, ...counter(['spark', 'flare'], 1, 'Spark or Flare once; Bulwark reduces the hit') })
    ], { loot: 'tonic', rate: .19 })
  ]);
  campaign('tide-warden', 'The tide beneath the glass', 4, true, 170, 14, 'Knife Gust breaks Rising Tide. Guard and Bulwark protect against its broad attacks.', [
    enemy('glassfin', 'Glassfin Matriarch', 'leviathan', 730, 53, 10, 'wind', '#75c4cf', [
      attack('foam-bite', 'Foam Bite', 53), attack('rising-tide', 'Rising Tide', 75, 'all', 6, { magical: true, ...counter(['gust'], 1, 'Knife Gust once, or Guard / Bulwark') })
    ], { loot: 'feather', rate: .19 })
  ]);
  campaign('frost-choir', 'The choir of ice', 4, false, 180, 16, 'Flare deals extra damage and interrupts either singer. Focus on one singer at a time.', [
    enemy('choir-east', 'East Choir Sentry', 'sentry', 320, 42, 12, 'fire', '#a0d6e7', [attack('ice-cut', 'Ice Cut', 42), attack('hail-note', 'Hail Note', 28, 'all', 3.8, { magical: true, ...counter(['flare'], 1, 'Flare once, or Bulwark') })]),
    enemy('choir-west', 'West Choir Sentry', 'sentry', 300, 41, 12, 'fire', '#bfcee8', [attack('crystal-cut', 'Crystal Cut', 41), attack('glass-note', 'Glass Note', 27, 'all', 4.1, { magical: true, ...counter(['flare'], 1, 'Flare once, or Bulwark') })], { rate: .165 })
  ]);
  campaign('sky-sentinel', 'A guardian among the stars', 6, true, 235, 18, 'Unpick removes the star ward and can stop Starfall. Light is its weak element.', [
    enemy('sky-sentinel', 'Sky Sentinel', 'astral', 900, 65, 15, 'light', '#c2b2ef', [
      attack('prism-lance', 'Prism Lance', 65), attack('starfall', 'Starfall', 87, 'all', 5.7, { magical: true, ...counter(['steal'], 1, 'Unpick once, or Bulwark') })
    ], { ward: true, loot: 'ether', rate: .205 })
  ]);
  campaign('vault-watch', 'The watch between the pages', 7, false, 270, 20, 'Silver Pierce opens Ink Seal. Cleave can stop Cross Reference. Their weaknesses differ.', [
    enemy('archive-warden', 'Archive Warden', 'archive', 465, 61, 15, 'frost', '#92bcb9', [attack('margin-cut', 'Margin Cut', 61), attack('ink-seal', 'Ink Seal', 46, 'all', 4.4, { magical: true, ...counter(['pierce'], 1, 'Silver Pierce once, or Bulwark') })], { loot: 'ether' }),
    enemy('index-keeper', 'Index Keeper', 'archive', 430, 58, 13, 'wind', '#cab88b', [attack('page-shear', 'Page Shear', 58), attack('cross-reference', 'Cross Reference', 51, 'all', 5.1, counter(['cleave'], 1, 'Cleave once, or Bulwark'))], { rate: .17 })
  ]);
  campaign('hush-engine', 'The Hush Engine', 8, true, 480, 28, 'Read each new phase. Unpick its wards. Break charges or use Bulwark. Renew and Rally sustain the party.', [
    enemy('hush-engine', 'The Hush Engine', 'archive', 1440, 72, 16, 'light', '#d6c2a4', null, { visual: 'hush-engine', ward: true, loot: 'ether', rate: .205, phases: [
      { at: 1, name: 'The Borrowed Light', weakness: 'light', ward: true, pattern: [attack('silencing-pulse', 'Silencing Pulse', 61, 'all', 5.5, { magical: true, ...counter(['steal', 'pierce'], 1, 'Unpick or Silver Pierce once; Bulwark also protects') }), attack('hinge-crush', 'Hinge Crush', 68)] },
      { at: .66, name: 'The Drowned Chorus', weakness: 'frost', ward: true, shell: false, tint: '#9cccd8', pattern: [attack('hush-wave', 'Hush Wave', 108, 'all', 8.4, { magical: true, ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }), attack('cold-verse', 'Cold Verse', 67, 'all', 1.8, { magical: true })] },
      { at: .33, name: 'The Last Spark', weakness: 'wind', ward: false, shell: true, tint: '#e2a585', rate: .23, pattern: [attack('final-stillness', 'Final Stillness', 132, 'all', 7.6, { magical: true, ...counter(['gust', 'cleave', 'pierce'], 2, 'Two Knife Gust / Cleave / Silver Pierce hits, or Bulwark') }), attack('last-engine', 'Last Engine', 77, 'all', 2.1, { magical: true })] }
    ] })
  ]);
  campaign('orchard-blight', 'The bitter orchard', 3, false, 100, 10, 'Fire clears the blight. Spark quickly removes the moth that shelters beside it.', [
    enemy('orchard-root', 'Orchard Blight', 'root', 340, 37, 8, 'fire', '#b5af78', [attack('thorn-rake', 'Thorn Rake', 37), attack('pollen-cloud', 'Pollen Cloud', 23, 'all', 3)]),
    enemy('pollen-moth', 'Pollen Moth', 'moth', 135, 27, 4, 'light', '#d6c991', [attack('pollen-dart', 'Pollen Dart', 27)], { rate: .15 })
  ]);
  campaign('wreck-diver', 'The collector below', 4, true, 165, 14, 'Knife Gust breaks Salvage Swell. Unpick removes the shell and takes a Feather. Spark deals extra damage.', [
    enemy('wreck-diver', 'Copper Wreck Diver', 'leviathan', 700, 52, 13, 'light', '#88b9aa', [attack('mooring-bite', 'Mooring Bite', 52), attack('salvage-swell', 'Salvage Swell', 72, 'all', 6.1, { magical: true, ...counter(['gust'], 1, 'Knife Gust once, or Bulwark') })], { shell: true, loot: 'feather', rate: .19 })
  ]);
  campaign('star-eater', 'The star that went hungry', 6, true, 255, 20, 'Unpick its ward. Two Sparks or Frost casts stop Extinguish. Bulwark provides another answer.', [
    enemy('star-eater', 'Star Eater', 'astral', 1010, 68, 14, 'frost', '#b29cd5', [attack('night-bite', 'Night Bite', 68), attack('extinguish', 'Extinguish', 112, 'all', 7.8, { magical: true, ...counter(['spark', 'frost'], 2, 'Two Spark / Frost casts, or Bulwark') })], { ward: true, loot: 'ether', rate: .205 })
  ]);

  class MorrowBattle {
    constructor(party, inventory, encounterId, options = {}) {
      if (!Array.isArray(party) || !party.length) throw new Error('Battle needs a party.');
      if (!ENCOUNTERS[encounterId]) throw new Error('Unknown encounter: ' + encounterId);
      this.party = this.heroes = party;
      this.inventory = inventory || {};
      this.encounterId = encounterId;
      this.encounter = ENCOUNTERS[encounterId];
      this.isBoss = Boolean(this.encounter.boss);
      this.hint = this.encounter.hint;
      this.difficulty = options.difficulty === 'story' ? 'story' : 'normal';
      this.waitMode = options.waitMode !== false;
      this.rng = options.rng || Math.random;
      this.onEvent = options.onEvent || (() => {});
      this.onWin = options.onWin || (() => {});
      this.onLose = options.onLose || (() => {});
      this.time = 0;
      this.busy = 0;
      this.pending = null;
      this.activeId = null;
      this.menuOpen = false;
      this.outcome = null;
      this.lastError = '';
      this.log = [];
      this.events = [];
      this.observedMoves = Object.create(null);
      this.turns = 0;
      this.concord = 0;
      this.concordEnabled = options.state?.campaign?.flags?.root_arrival === true;
      this.anchors = [...new Set(Array.isArray(options.state?.campaign?.root?.anchors) ? options.state.campaign.root.anchors : [])];
      this.actionWeakness = false;
      this.rewards = { crowns: this.encounter.crowns, ap: this.encounter.ap };
      if (Number.isFinite(this.encounter.xp)) this.rewards.xp = this.encounter.xp;
      const ids = new Set();
      party.forEach((h, i) => {
        if (!h.id || ids.has(h.id)) throw new Error('Each hero needs a unique id.');
        ids.add(h.id);
        h.maxHp = Math.max(1, Number(h.maxHp) || 160);
        h.maxMp = Math.max(0, Number(h.maxMp) || 24);
        h.hp = clamp(Number.isFinite(h.hp) ? h.hp : h.maxHp, 0, h.maxHp);
        h.mp = clamp(Number.isFinite(h.mp) ? h.mp : h.maxMp, 0, h.maxMp);
        h.atk = Number(h.atk) || [29, 22, 35][i % 3];
        h.def = Number(h.def) || [7, 5, 12][i % 3];
        h.spd = Number(h.spd) || [17, 14, 10][i % 3];
        h.resolve = clamp(Number(h.resolve) || 0, 0, 100);
        h.atb = live(h) ? [.84, .65, .48][i % 3] : 0;
        h.statuses = {};
        h.crests = normalizeCrests(h.crests);
      });
      this.enemies = this.encounter.enemies.map((e, i) => Object.assign(copy(e), {
        hp: e.maxHp, atb: .12 + i * .12, statuses: {}, intent: null,
        nextIntent: e.pattern?.[0]?.name || (e.kind === 'boss' ? 'Bell Sweep' : e.kind === 'sentry' ? 'Kiln Hammer' : 'Ash Dart'),
        turn: 0, stolen: false, boss: e.boss ?? this.isBoss, phase: 1, phaseCount: e.phases?.length || 1, phaseName: ''
      }));
      this.enemies.forEach(e => { if (e.phases) this._applyPhase(e, 0, false); });
      this._applyAnchors();
      for (const h of this.heroes) if (this._hasCrest(h, 'current')) this._emit({ type: 'crest', crest: 'current', actor: h.id, target: h.id, amount: 15, text: h.name + ': Current fills ATB 15% faster.', color: '#ace0d6' });
      this._refreshReady();
      this._checkOutcome();
    }

    get state() {
      return { activeId: this.activeId, menuOpen: this.menuOpen, busy: this.busy,
        outcome: this.outcome, waitMode: this.waitMode, paused: this.isWaiting,
        heroes: this.heroes, enemies: this.enemies, time: this.time, log: this.log,
        concord: this.concord, concordEnabled: this.concordEnabled };
    }
    get isWaiting() { return !this.outcome && !this.busy && this.waitMode && this.heroes.some(h => live(h) && h.atb >= 1); }
    get readyHeroes() { return this.heroes.filter(h => live(h) && h.atb >= 1); }
    unit(id) { return this.heroes.find(h => h.id === id) || this.enemies.find(e => e.id === id) || null; }
    inspectUnit(id) {
      const u = this.unit(id); if (!u) return null;
      const hero = this.heroes.includes(u), intent = u.intent;
      return { id: u.id, name: u.name, side: hero ? 'hero' : 'enemy', alive: live(u), hp: u.hp, maxHp: u.maxHp,
        mp: hero ? u.mp : null, maxMp: hero ? u.maxMp : null, weakness: u.weakness || null, shell: !!u.shell, ward: !!u.ward,
        phase: u.phase || 1, phaseCount: u.phaseCount || 1, phaseName: u.phaseName || '',
        statuses: Object.entries(u.statuses).map(([id, s]) => ({ id, ...STATUSES[id],
          ...(Number.isFinite(s.remaining) ? { remaining: Math.max(0, s.remaining) } : {}),
          ...(Number.isFinite(s.charges) ? { charges: s.charges } : {}),
          ...(Number.isFinite(s.nextTick) ? { nextTick: Math.max(0, s.nextTick) } : {}) })),
        intent: intent ? { id: intent.id, name: intent.name, target: intent.target || null,
          targetName: intent.target === 'all' ? 'All living allies' : this.unit(intent.target)?.name || null,
          remaining: intent.remaining, total: intent.total, interrupts: intent.interrupts || 0,
          required: intent.required || 0, actions: [...(intent.interruptActions || [])], counterHint: intent.counterHint || '' } : null,
        nextIntent: u.nextIntent || null, observedMoves: [...(this.observedMoves[u.id] || [])] };
    }
    setWait(on) { this.waitMode = !!on; return this.waitMode; }
    selectActor(id) {
      const h = this.heroes.find(u => u.id === id);
      if (!h || !live(h) || h.atb < 1 || this.busy || this.outcome) return false;
      this.activeId = h.id;
      this.menuOpen = true;
      return true;
    }
    _role(h) {
      const value = String(h.role || h.id || h.name).toLowerCase();
      if (/mina|glowwright|mage/.test(value)) return 'mina';
      if (/orrin|guard|knight/.test(value)) return 'orrin';
      return 'ivo';
    }
    _hasAbility(h, ability) {
      const tokens = [];
      const scan = x => {
        if (typeof x === 'string') tokens.push(x.toLowerCase());
        else if (Array.isArray(x)) x.forEach(scan);
        else if (x && typeof x === 'object') Object.entries(x).forEach(([k, v]) => {
          if (v === true || typeof v === 'number' && v > 0) tokens.push(k.toLowerCase());
          else if (v && (k === 'id' || k === 'name' || k === 'ability' || k === 'skill' || typeof v === 'object')) scan(v);
          else if (typeof v === 'string') scan(v);
        });
      };
      scan(h.gear); scan(h.learned);
      const aliases = ABILITIES[ability]?.aliases || [];
      return tokens.some(t => aliases.some(alias => alias.replace(/[- ]/g, '') === t.replace(/[- ]/g, '')));
    }
    _hasCrest(h, id) { return this.heroes.includes(h) && normalizeCrests(h.crests).includes(id); }
    _mpCost(h, action) { return action.mp ? Math.max(1, action.mp - (this._hasCrest(h, 'thrift') ? 2 : 0)) : 0; }
    actions(id = this.activeId) {
      const h = this.heroes.find(u => u.id === id);
      if (!h) return [];
      const role = this._role(h);
      return Object.entries(ACTIONS).filter(([, a]) => (!a.role || a.role === role) && (!a.concord || this.concordEnabled)).map(([id, a]) => {
        const mp = this._mpCost(h, a);
        let reason = '';
        if (this.outcome) reason = 'Battle has ended.';
        else if (!live(h)) reason = 'This ally has fallen.';
        else if (this.busy) reason = 'An action is in progress.';
        else if (h.atb < 1) reason = 'Wait for the ATB gauge.';
        else if (a.ability && !this._hasAbility(h, a.ability)) reason = 'Equip or master the required gear skill.';
        else if (mp && h.mp < mp) reason = 'Not enough MP.';
        else if (a.resolve && h.resolve < a.resolve) reason = 'Requires 100 Resolve.';
        else if (a.concord && this.concord < a.concord) reason = 'Requires 100 Concord.';
        else if (a.item && !(this.inventory[a.item] > 0)) reason = 'No ' + a.name + ' remains.';
        else if (id === 'flee' && this.isBoss) reason = this.encounter.name + ' blocks the exit.';
        else if (a.target === 'deadAlly' && !this.heroes.some(u => !live(u))) reason = 'No ally needs revival.';
        const cost = mp ? { mp } : a.item ? { item: a.item, quantity: 1 } : a.resolve ? { resolve: a.resolve } : a.concord ? { concord: a.concord } : {};
        const description = id === 'mend' ? `Restore ${powerAt(h, 76)} HP to one living ally.`
          : id === 'renew' ? `Restore ${powerAt(h, 58)} HP to each living ally.`
          : id === 'rekindle' ? `Revive one fallen ally with up to ${powerAt(h, 90)} HP.`
          : id === 'clearsong' ? `Restore ${powerAt(h, 32)} HP to each living ally. Clear Slow and Poison.`
          : id === 'flare' ? `Deal ${powerAt(h, 66)} fire damage before weaknesses.` : a.description;
        return Object.assign({ id }, a, { ...(a.mp ? { mp } : {}), name: id === 'limit' ? LIMIT_NAMES[role] : a.name, description,
          enabled: !reason, disabled: !!reason, reason, cost,
          costText: mp ? mp + ' MP' : a.resolve ? '100 Resolve' : a.concord ? '100 Concord' : a.item ? 'x' + (this.inventory[a.item] || 0) : 'Free' });
      });
    }
    targets(actionId) {
      const a = ACTIONS[actionId];
      if (!a) return [];
      if (a.target === 'enemy' || a.target === 'allEnemies') return this.enemies.filter(live);
      if (a.target === 'ally' || a.target === 'allAllies') return this.heroes.filter(live);
      if (a.target === 'deadAlly') return this.heroes.filter(h => !live(h));
      const h = this.unit(this.activeId);
      return h ? [h] : [];
    }
    command(actionId, targetId) {
      this.lastError = '';
      const h = this.heroes.find(u => u.id === this.activeId);
      const a = h && this.actions(h.id).find(v => v.id === actionId);
      if (!a || !a.enabled) return this._invalid(a ? a.reason : 'Select a ready ally and a valid action.');
      const needsTarget = ['enemy', 'ally', 'deadAlly'].includes(a.target);
      const targets = this.targets(actionId);
      const target = needsTarget ? targets.find(u => u.id === targetId) : targets[0];
      if (needsTarget && !target) return this._invalid('Select a valid target.');
      if (!targets.length) return this._invalid('There is no valid target.');
      if (a.mp) h.mp -= a.mp;
      if (a.resolve) h.resolve -= a.resolve;
      if (a.concord) this.concord = 0;
      if (a.item) this.inventory[a.item] -= 1;
      delete h.statuses.guard;
      h.atb = 0;
      this.turns++;
      this.activeId = null;
      this.menuOpen = false;
      this.busy = actionId === 'limit' || actionId === 'concord' ? 1.1 : actionId === 'flee' ? .7 : .78;
      this.pending = { remaining: actionId === 'limit' || actionId === 'concord' ? .5 : .32,
        run: () => this._resolveAction(h, actionId, target) };
      this._emit({ type: 'action', actor: h.id, target: target && target.id, action: actionId,
        name: a.name, text: h.name + ' — ' + a.name, duration: this.busy,
        targets: ['allEnemies', 'allAllies'].includes(a.target) ? targets.map(u => u.id) : undefined });
      if (a.mp && a.mp < ACTIONS[actionId].mp) this._emit({ type: 'crest', crest: 'thrift', actor: h.id, target: h.id,
        amount: ACTIONS[actionId].mp - a.mp, text: h.name + ': Thrift saves ' + (ACTIONS[actionId].mp - a.mp) + ' MP.', color: '#a6c9ff' });
      return true;
    }
    _invalid(reason) { this.lastError = reason; return false; }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || this.outcome) return;
      let left = dt;
      while (left > .000001 && !this.outcome) {
        const step = Math.min(.05, left);
        this._tick(step);
        left -= step;
      }
    }
    _tick(dt) {
      this._refreshReady();
      if (this.busy > 0) {
        this.time += dt;
        this.busy = Math.max(0, this.busy - dt);
        if (this.pending) {
          this.pending.remaining -= dt;
          if (this.pending.remaining <= 0) {
            const fn = this.pending.run;
            this.pending = null;
            fn();
            this._checkOutcome();
          }
        }
        if (!this.busy) this._refreshReady();
        return;
      }
      if (this.isWaiting) return;
      this.time += dt;
      for (const u of [...this.heroes, ...this.enemies]) {
        for (const [key, s] of Object.entries(u.statuses)) {
          if (Number.isFinite(s.remaining)) {
            if ((key === 'poison' || key === 'regen') && live(u)) {
              s.nextTick -= Math.min(dt, Math.max(0, s.remaining));
              while (s.nextTick <= .000001) { this._statusPulse(u, key, s); s.nextTick += 3; }
            }
            s.remaining -= dt;
            if (s.remaining <= 0) delete u.statuses[key];
          }
        }
      }
      for (const h of this.heroes) {
        if (!live(h)) { h.atb = 0; continue; }
        h.atb = Math.min(1, h.atb + dt * clamp(.2 + h.spd * .004, .2, .32) * (this._hasCrest(h, 'current') ? 1.15 : 1) * (h.statuses.slow ? .7 : 1));
      }
      for (const e of this.enemies) {
        if (!live(e)) continue;
        const slow = e.statuses.slow ? .58 : 1;
        if (e.intent) {
          e.intent.remaining = Math.max(0, e.intent.remaining - dt * slow);
          if (e.intent.remaining <= 0 && !this.busy) {
            if (e.intent.id === 'stagger') { e.intent = null; e.atb = 0; }
            else this._enemyAction(e);
          }
        } else {
          e.atb = Math.min(1, e.atb + dt * e.rate * slow);
          if (e.atb >= 1) this._planEnemy(e);
        }
      }
      this._refreshReady();
      this._checkOutcome();
    }
    _refreshReady() {
      if (this.outcome || this.busy) { this.activeId = null; this.menuOpen = false; return; }
      const ready = this.readyHeroes;
      if (!ready.some(h => h.id === this.activeId)) this.activeId = ready.length ? ready[0].id : null;
      this.menuOpen = !!this.activeId;
    }
    _applyAnchors() {
      const lines = [];
      for (const effect of this.encounter.anchorEffects || []) {
        if (!this.anchors.includes(effect.id)) continue;
        for (const e of this.enemies) {
          if (effect.enemy && effect.enemy !== e.id) continue;
          if (effect.hp) e.hp = e.maxHp = Math.max(1, Math.round(e.maxHp * effect.hp));
          if (effect.damage) {
            e.atk = Math.max(1, Math.round(e.atk * effect.damage));
            for (const pattern of [e.pattern, ...(e.phases || []).map(p => p.pattern)].filter(Boolean))
              for (const a of pattern) a.power = Math.max(1, Math.round(a.power * effect.damage));
          }
          for (const key of ['shell', 'ward']) if (effect[key] === false) {
            e[key] = false;
            for (const phase of e.phases || []) phase[key] = false;
          }
        }
        const text = effect.text || 'A repaired anchor weakens the enemy.';
        lines.push(text); this._emit({ type: 'anchor', anchor: effect.id, text, color: '#b8e0a1' });
      }
      if (lines.length) this.hint = lines.join(' ') + ' ' + this.hint;
    }
    applyStatus(actor, target, id, duration) {
      actor = typeof actor === 'string' ? this.unit(actor) : actor;
      target = typeof target === 'string' ? this.unit(target) : target;
      if (!actor || this.unit(actor.id) !== actor || !target || this.unit(target.id) !== target || !live(target) || !['slow', 'poison', 'exposed', 'regen', 'protect'].includes(id) || !Number.isFinite(duration) || duration <= 0) return false;
      const clarity = STATUSES[id].harmful && this._hasCrest(target, 'clarity');
      const remaining = Math.min(60, duration) * (clarity ? .5 : 1);
      target.statuses[id] = { remaining, ...(id === 'exposed' ? { charges: 2 } : {}),
        ...(id === 'poison' || id === 'regen' ? { nextTick: 3, source: actor.id } : {}) };
      this._emit({ type: 'status', actor: actor.id, target: target.id, status: id, amount: remaining, duration: remaining,
        crest: clarity ? 'clarity' : undefined, text: (id === 'slow' ? target.name + ' is slowed for ' : target.name + ': ' + STATUSES[id].name + ' for ') + remaining + ' seconds.' + (clarity ? ' Clarity halves the duration.' : ''), color: STATUSES[id].harmful ? '#a6c9ff' : '#adf1c6' });
      return true;
    }
    _statusPulse(target, id, status) {
      const actor = this.unit(status.source) || target;
      if (id === 'regen') this._heal(actor, target, Math.max(1, Math.round(target.maxHp * .05)), { status: id });
      else {
        const amount = Math.max(0, Math.min(target.hp - 1, Math.max(1, Math.round(target.maxHp * .04))));
        if (!amount) return;
        target.hp -= amount;
        this._emit({ type: 'damage', actor: actor.id, target: target.id, amount, action: 'poison', status: id, magical: true,
          text: target.name + ' loses ' + amount + ' HP to Poison.', color: '#c7abd8' });
      }
    }
    _applyPhase(e, index, announce = true) {
      const phase = e.phases[index];
      e.phase = index + 1; e.phaseCount = e.phases.length; e.phaseName = phase.name;
      e.pattern = copy(phase.pattern); e.turn = 0; e.intent = null;
      for (const key of ['weakness', 'ward', 'shell', 'tint', 'rate']) if (phase[key] !== undefined) e[key] = phase[key];
      e.nextIntent = e.pattern[0].name;
      if (announce) {
        e.atb = .85;
        this._emit({ type: 'phase', actor: e.id, target: e.id, phase: e.phase, phaseCount: e.phaseCount,
          name: e.phaseName, weakness: e.weakness, text: `Phase ${e.phase}: ${e.phaseName}. Weak to ${e.weakness}.`, color: e.tint });
      }
    }
    _checkPhase(e) {
      if (!live(e) || !e.phases) return;
      while (e.phase < e.phases.length && e.hp / e.maxHp <= e.phases[e.phase].at) this._applyPhase(e, e.phase);
    }
    _tryInterrupt(h, e, action) {
      const intent = e && live(e) && e.intent;
      if (!intent || intent.id === 'stagger') return;
      const actions = intent.interruptActions || intent.interrupt?.actions || (intent.id === 'doom' ? ['spark'] : []);
      if (!actions.includes(action)) return;
      const required = intent.required || intent.interrupt?.hits || (intent.id === 'doom' ? 2 : 1);
      intent.interrupts = (intent.interrupts || 0) + 1;
      if (intent.interrupts >= required) {
        const name = intent.name || 'Charge';
        e.intent = { id: 'stagger', name: 'Charge Broken', text: name + ' broken · staggered',
          remaining: 1.8, total: 1.8, interrupts: required, required, counterHint: 'The attack was stopped.' };
        e.atb = 0; e.turn++;
        this._emit({ type: 'interrupt', actor: h.id, target: e.id, action, text: name + ' broken!', color: '#9feacc' });
      } else {
        this._emit({ type: 'chargeHit', actor: h.id, target: e.id, amount: intent.interrupts, action,
          text: `${required - intent.interrupts} more matching hit will break ${intent.name}.`, color: '#a6dfff' });
      }
    }
    _planEnemy(e) {
      const alive = this.heroes.filter(live);
      if (!alive.length) return;
      const target = alive[Math.min(alive.length - 1, Math.floor(this.rng() * alive.length))];
      if (e.pattern) {
        const move = e.pattern[e.turn % e.pattern.length];
        e.intent = { ...copy(move), target: move.target === 'all' ? 'all' : target.id,
          total: move.windup, remaining: move.windup, interrupts: 0,
          required: move.interrupt?.hits || 0, interruptActions: move.interrupt?.actions || [],
          counterHint: move.counterHint || (move.target === 'all' ? 'Guard or Bulwark reduces this attack.' : 'Guard or Bulwark protects the target.'),
          text: move.name + ' · ' + (move.counterHint || (move.target === 'all' ? 'all allies' : 'Targets ' + target.name)) };
        e.nextIntent = e.pattern[(e.turn + 1) % e.pattern.length].name;
        const observed = this.observedMoves[e.id] ||= []; if (!observed.includes(e.intent.name)) observed.push(e.intent.name);
        this._emit({ type: 'intent', actor: e.id, target: e.intent.target, action: move.id,
          text: e.name + ': ' + e.intent.text, duration: move.windup, counterHint: e.intent.counterHint, color: e.tint });
        return;
      }
      const doom = e.kind === 'boss' && e.turn % 2 === 1;
      const sweep = e.kind === 'boss' && !doom;
      const id = doom ? 'doom' : sweep ? 'sweep' : e.kind === 'sentry' ? 'hammer' : 'dart';
      const total = doom ? 9 : 1.2;
      e.intent = { id, name: doom ? 'Doom Chime' : sweep ? 'Bell Sweep' : e.kind === 'sentry' ? 'Kiln Hammer' : 'Ash Dart',
        target: sweep || doom ? 'all' : target.id, remaining: total, total, interrupts: 0, required: doom ? 2 : 0,
        interruptActions: doom ? ['spark'] : [], counterHint: doom ? 'Two Sparks, or Bulwark' : 'Guard or Bulwark reduces this attack.',
        text: doom ? 'DOOM CHIME · Use Spark twice or Bulwark' : sweep ? 'Bell Sweep · all allies' : 'Targets ' + target.name };
      e.nextIntent = doom ? 'Bell Sweep' : e.kind === 'boss' ? 'Doom Chime' : e.intent.name;
      const observed = this.observedMoves[e.id] ||= []; if (!observed.includes(e.intent.name)) observed.push(e.intent.name);
      this._emit({ type: 'intent', actor: e.id, target: e.intent.target, action: id,
        text: e.name + ': ' + e.intent.text, duration: total, color: doom ? '#f99fbd' : '#e8c97e' });
    }
    _enemyAction(e) {
      const intent = e.intent;
      e.intent = null;
      e.atb = 0;
      e.turn++;
      this.busy = intent.id === 'doom' ? 1.05 : .72;
      this.activeId = null;
      this.menuOpen = false;
      this._emit({ type: 'action', actor: e.id, target: intent.target, action: intent.id,
        name: intent.name, text: e.name + ' — ' + intent.name, duration: this.busy });
      this.pending = { remaining: .33, run: () => {
        if (!live(e)) return;
        const living = this.heroes.filter(live);
        if (intent.target === 'all') {
          living.forEach(h => this._damage(e, h, intent.power ?? (intent.id === 'doom' ? 86 : 27), { magical: intent.magical || intent.id === 'doom', enemy: true, action: intent.id, status: intent.status }));
        } else {
          let h = this.heroes.find(u => u.id === intent.target && live(u)) || living[0];
          const cover = living.find(u => u.statuses.cover && u.id !== (h && h.id));
          if (cover) {
            cover.statuses.cover.charges--;
            if (cover.statuses.cover.charges <= 0) delete cover.statuses.cover;
            this._emit({ type: 'cover', actor: cover.id, target: h.id, text: cover.name + ' covers ' + h.name + '.' });
            h = cover;
          }
          if (h) this._damage(e, h, intent.power ?? e.atk, { magical: !!intent.magical, enemy: true, action: intent.id, status: intent.status });
        }
        if (intent.heal && live(e)) this._heal(e, e, intent.heal);
      } };
    }

    _resolveAction(h, id, target) {
      if (!live(h) || this.outcome) return;
      const enemies = this.enemies.filter(live);
      const allies = this.heroes.filter(live);
      this.actionWeakness = false;
      if (id === 'attack') this._damage(h, target, h.atk, { action: id });
      else if (id === 'gust' || id === 'cleave') enemies.forEach(e => this._damage(h, e, h.atk * (id === 'gust' ? 1.15 : 1.25), { action: id, element: id === 'gust' ? 'wind' : undefined }));
      else if (id === 'spark') {
        this._damage(h, target, powerAt(h, target.kind === 'moth' ? 60 : 45), { magical: true, exact: true, action: id, element: 'light' });
      } else if (id === 'frost') {
        this._damage(h, target, powerAt(h, target.kind === 'sentry' ? 64 : 42), { magical: true, exact: true, action: id, element: 'frost' });
        if (live(target)) this.applyStatus(h, target, 'slow', 12);
      } else if (id === 'flare') this._damage(h, target, powerAt(h, 66), { magical: true, exact: true, action: id, element: 'fire' });
      else if (id === 'pierce') this._damage(h, target, h.atk * 1.55, { pierce: true, action: id });
      else if (id === 'threadcut') {
        this._damage(h, target, h.atk * 1.2, { action: id });
        if (live(target)) this.applyStatus(h, target, 'exposed', 12);
      }
      else if (id === 'clearsong') {
        for (const a of allies) {
          const cleared = ['slow', 'poison'].filter(key => a.statuses[key]);
          for (const key of cleared) delete a.statuses[key];
          if (cleared.length) this._emit({ type: 'cleanse', actor: h.id, target: a.id, statuses: cleared,
            text: a.name + ': ' + cleared.map(key => STATUSES[key].name).join(' and ') + ' cleared.', color: '#adf1c6' });
          this._heal(h, a, powerAt(h, 32));
        }
      }
      else if (id === 'interpose') for (const a of allies) {
        this.applyStatus(h, a, 'protect', 12); this.applyStatus(h, a, 'regen', 12);
      }
      else if (id === 'renew') allies.forEach(a => this._heal(h, a, powerAt(h, 58)));
      else if (id === 'mend') this._heal(h, target, powerAt(h, 76));
      else if (id === 'tonic') this._heal(h, target, itemPower(id, target));
      else if (id === 'ether') {
        const amount = Math.min(itemPower(id, target), target.maxMp - target.mp);
        target.mp += amount;
        this._emit({ type: 'restoreMp', actor: h.id, target: target.id, amount, text: target.name + ' restores ' + amount + ' MP.', color: '#a6c9ff' });
      } else if (id === 'feather' || id === 'rekindle') {
        target.hp = Math.min(id === 'rekindle' ? powerAt(h, 90) : itemPower(id, target), target.maxHp);
        target.atb = .3;
        target.statuses = {};
        this._emit({ type: 'revive', actor: h.id, target: target.id, amount: target.hp, text: target.name + ' returns!', color: '#b4f2d6' });
      } else if (id === 'guard') {
        h.statuses.guard = { remaining: 30 };
        h.resolve = Math.min(100, h.resolve + 8);
        this._emit({ type: 'guard', actor: h.id, target: h.id, text: h.name + ' guards.', color: '#b1d1ef' });
      } else if (id === 'bulwark') this._ward(h, allies);
      else if (id === 'rally') {
        allies.forEach(a => {
          a.resolve = Math.min(100, a.resolve + 12);
          if (a !== h) {
            const amount = Math.min(3, a.maxMp - a.mp); a.mp += amount;
            this._emit({ type: 'restoreMp', actor: h.id, target: a.id, amount, text: a.name + ' restores ' + amount + ' MP.', color: '#a6c9ff' });
          }
        });
        this._emit({ type: 'rally', actor: h.id, targets: allies.map(a => a.id), text: 'The party gains 12 Resolve.', color: '#e6cea0' });
      }
      else if (id === 'quickstep') {
        const others = allies.filter(a => a !== h);
        for (const a of others) {
          const before = a.atb; a.atb = Math.min(1, a.atb + .35);
          const amount = Math.round((a.atb - before) * 100);
          if (amount > 0) this._emit({ type: 'haste', actor: h.id, target: a.id, amount,
            text: a.name + ' gains ' + amount + '% ATB.', color: '#b8eddf' });
        }
        h.resolve = Math.min(100, h.resolve + 12);
        this._emit({ type: 'quickstep', actor: h.id, targets: others.map(a => a.id),
          text: 'Ivo speeds the party and gains 12 Resolve.', color: '#b8eddf' });
      }
      else if (id === 'steal') this._steal(h, target);
      else if (id === 'concord') {
        const damage = powerAt(h, 94), healing = powerAt(h, 42);
        const damageDone = enemies.reduce((sum, e) => sum + this._damage(h, e, damage, { magical: true, exact: true, pierce: true, action: id, noResolve: true }), 0);
        const healed = allies.reduce((sum, a) => sum + this._heal(h, a, healing), 0);
        this._emit({ type: 'concord', actor: h.id, targets: [...enemies, ...allies].map(u => u.id), amount: damageDone, healed,
          text: 'Concord deals ' + damageDone + ' total damage and restores ' + healed + ' party HP.', color: '#f3d7a5' });
      }
      else if (id === 'limit') {
        const role = this._role(h);
        if (role === 'mina') {
          allies.forEach(a => this._heal(h, a, powerAt(h, 92)));
          enemies.forEach(e => this._damage(h, e, powerAt(h, 74), { magical: true, exact: true, action: id, noResolve: true, element: 'light' }));
        } else {
          this._damage(h, target, powerAt(h, role === 'ivo' ? 148 : 126), { exact: true, pierce: true, action: id, noResolve: true, hits: role === 'ivo' ? 3 : 1 });
          if (role === 'orrin') this._ward(h, allies);
        }
      } else if (id === 'flee') {
        this.outcome = 'fled';
        this.menuOpen = false;
        this._emit({ type: 'flee', actor: h.id, text: 'The party withdraws safely.' });
        this.onWin({ fled: true, encounterId: this.encounterId, rewards: { crowns: 0, ap: 0 }, turns: this.turns });
      }
      if (['attack', 'spark', 'frost', 'flare', 'pierce', 'steal', 'limit', 'threadcut'].includes(id)) this._tryInterrupt(h, target, id);
      if (id === 'gust' || id === 'cleave') enemies.forEach(e => this._tryInterrupt(h, e, id));
      if (id !== 'flee') {
        if (this._hasCrest(h, 'renewal')) this._heal(h, h, Math.round(h.maxHp * .08), { crest: 'renewal' });
        if (this.concordEnabled && id !== 'concord') {
          const before = this.concord; this.concord = Math.min(100, this.concord + 8 + (this.actionWeakness ? 8 : 0));
          const amount = this.concord - before;
          if (amount) this._emit({ type: 'concordGain', actor: h.id, amount, total: this.concord, weak: this.actionWeakness,
            text: 'Concord +' + amount + (this.actionWeakness ? ' · weakness' : '') + ' (' + this.concord + '/100).', color: '#f3d7a5' });
        }
      }
    }
    _ward(h, allies) {
      allies.forEach(a => { a.statuses.ward = { remaining: 20, charges: 1, reduction: .6 }; });
      h.statuses.cover = { remaining: 20, charges: 2 };
      this._emit({ type: 'ward', actor: h.id, targets: allies.map(a => a.id), text: 'Bulwark shields the party.', color: '#bfd9ff' });
    }
    _steal(h, e) {
      const shield = e.shell || e.ward;
      e.shell = false; e.ward = false;
      if (e.stolen) {
        if (shield) {
          h.resolve = Math.min(100, h.resolve + 12);
          this._emit({ type: 'shieldBreak', actor: h.id, target: e.id, text: e.name + "'s protection falls away.", color: '#efcf87' });
        } else this._emit({ type: 'miss', actor: h.id, target: e.id, text: 'Nothing remains to take.' });
        return;
      }
      e.stolen = true;
      const item = e.loot || (e.kind === 'boss' ? 'bronze-thread' : e.kind === 'sentry' ? 'ether' : 'tonic');
      this.inventory[item] = (Number(this.inventory[item]) || 0) + 1;
      h.resolve = Math.min(100, h.resolve + 12);
      this._emit({ type: 'loot', actor: h.id, target: e.id, item, amount: 1,
        text: e.kind === 'boss' ? 'Bronze Thread taken. The shell falls away!' : h.name + ' takes a ' + item + '.' + (shield ? ' The protection falls away.' : ''), color: '#efcf87' });
    }
    _damage(actor, target, raw, options = {}) {
      if (!target || !live(target)) return 0;
      let amount = options.exact ? raw : raw * (.92 + this.rng() * .16) - (options.magical || options.pierce ? 0 : target.def * .48);
      if (target.shell && !options.magical && !options.pierce) amount *= .58;
      const weak = !!options.element && options.element === target.weakness;
      if (weak) amount *= 1.45;
      if (target.ward) amount *= .65;
      const exposed = !!target.statuses.exposed;
      if (exposed) { amount *= 1.2; if (--target.statuses.exposed.charges <= 0) delete target.statuses.exposed; }
      const protectedHit = !!target.statuses.protect;
      if (protectedHit) amount *= .75;
      if (options.enemy && this.difficulty === 'story') amount *= .65;
      const vigor = this._hasCrest(actor, 'vigor'), shelter = this._hasCrest(target, 'shelter');
      if (vigor) amount *= 1.15;
      if (shelter) amount *= .85;
      let blocked = false;
      if (target.statuses.guard) { amount *= .5; blocked = true; }
      if (target.statuses.ward) {
        amount *= 1 - target.statuses.ward.reduction;
        target.statuses.ward.charges--;
        if (target.statuses.ward.charges <= 0) delete target.statuses.ward;
        blocked = true;
      }
      amount = Math.min(target.hp, Math.max(1, Math.round(amount)));
      target.hp -= amount;
      if (weak && this.heroes.includes(actor)) this.actionWeakness = true;
      if (this.heroes.includes(actor) && !options.noResolve) actor.resolve = Math.min(100, actor.resolve + clamp(Math.round(amount * .2), 6, 18));
      if (this.heroes.includes(target)) target.resolve = Math.min(100, target.resolve + clamp(Math.round(amount * .4), 7, 25));
      this._emit({ type: 'damage', actor: actor.id, target: target.id, amount,
        action: options.action, magical: !!options.magical, element: options.element, weak, warded: !!target.ward, blocked, hits: options.hits || 1,
        ...(vigor ? { vigor: 15 } : {}), ...(shelter ? { shelter: 15 } : {}),
        ...(exposed ? { exposed: 20 } : {}), ...(protectedHit ? { protection: 25 } : {}),
        text: target.name + ' takes ' + amount + (blocked ? ' guarded' : '') + ' damage.' + (weak ? ' Weakness!' : ''), color: options.enemy ? '#f7b5b2' : '#f4deb6' });
      if (!live(target)) {
        target.atb = 0; target.intent = null; target.statuses = {};
        this._emit({ type: 'defeat', actor: actor.id, target: target.id, text: target.name + ' falls.' });
      } else {
        if (options.status) this.applyStatus(actor, target, options.status.id, options.status.duration);
        this._checkPhase(target);
      }
      return amount;
    }
    _heal(actor, target, power, options = {}) {
      if (!target || !live(target)) return 0;
      const amount = Math.min(power, target.maxHp - target.hp);
      target.hp += amount;
      this._emit({ type: 'heal', actor: actor.id, target: target.id, amount, ...options, text: target.name + ' recovers ' + amount + ' HP.' + (options.crest === 'renewal' ? ' Renewal.' : '') + (options.status === 'regen' ? ' Regen.' : ''), color: '#adf1c6' });
      return amount;
    }
    _checkOutcome() {
      if (this.outcome) return;
      if (!this.heroes.some(live)) {
        this.outcome = 'lose'; this.activeId = null; this.menuOpen = false; this.pending = null;
        this._emit({ type: 'lose', text: 'The party falls. Retry from the encounter start.' });
        this.onLose({ encounterId: this.encounterId, turns: this.turns });
      } else if (!this.enemies.some(live)) {
        this.outcome = 'win'; this.activeId = null; this.menuOpen = false; this.pending = null;
        this._emit({ type: 'win', text: 'Victory! The road is clear.', rewards: this.rewards });
        this.onWin({ fled: false, encounterId: this.encounterId, rewards: Object.assign({}, this.rewards), turns: this.turns });
      }
    }
    _emit(event) {
      event.time = this.time;
      this.events.push(event);
      if (this.events.length > 100) this.events.shift();
      if (event.text) { this.log.push(event.text); if (this.log.length > 12) this.log.shift(); }
      this.onEvent(event);
    }
    drainEvents() { return this.events.splice(0); }
  }
  MorrowBattle.ACTIONS = MorrowBattle.actions = ACTIONS;
  MorrowBattle.ENCOUNTERS = MorrowBattle.encounters = ENCOUNTERS;
  MorrowBattle.abilities = ABILITIES;
  MorrowBattle.statuses = STATUSES;
  MorrowBattle.crests = CRESTS;
  MorrowBattle.normalizeCrests = normalizeCrests;
  MorrowBattle.crestCost = crestCost;
  MorrowBattle.registerEncounter = registerEncounter;
  MorrowBattle.powerAt = powerAt;
  MorrowBattle.itemPower = itemPower;
  root.MorrowBattle = MorrowBattle;
  if (typeof module !== 'undefined' && module.exports) module.exports = MorrowBattle;
})(typeof window !== 'undefined' ? window : globalThis);
