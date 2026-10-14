/* Cinder Choir: Undertide rules. This module is optional and has no renderer. */
(function (root) {
  'use strict';
  const CC = root.CC, R = CC.RPG, F = CC.Frontier;
  if (!R || !F) throw new Error('Load the RPG and Far Reach rules before Undertide.');
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const whole = (value, max = 99999999) => Number.isInteger(value) && value >= 0 && value <= max;

  const HEROES = {
    nera: { id: 'nera', name: 'Nera', role: 'Diver', description: 'A rescue diver. She checks each line before the descent.', hp: 188, mp: 35, atk: 24, mag: 18, def: 17, spd: 29, growth: 33, weapon: 'reedspear', armor: 'ironcoat', spells: [], unique: ['depth_tidalthrust', 'depth_anchorline'], color: '#5dafa7', accent: '#edbd72', hair: '#354b5f', awakenFlag: 'u_bond_nera' },
    pax: { id: 'pax', name: 'Pax', role: 'Cartographer', description: 'A map maker. He marks safe routes and weak seams.', hp: 157, mp: 44, atk: 17, mag: 25, def: 12, spd: 37, growth: 29, weapon: 'choirbell', armor: 'travelcoat', spells: ['stone'], unique: ['depth_surveymark', 'depth_groundmeasure'], color: '#c69b62', accent: '#83c9ce', hair: '#e5d6b4', awakenFlag: 'u_bond_pax' }
  };
  Object.assign(R.heroes, HEROES);

  const spells = {
    depth_siltstrike: { name: 'Silt Strike', kind: 'magic', target: 'enemy', power: 2.25, element: 'earth', cost: 7, status: 'slow', duration: 2, chance: .85, breakPower: 1, description: 'Strike one foe with earth. Add one Break pressure. The hit can cause Slow for two turns.' },
    depth_foundation: { name: 'Living Foundation', kind: 'buff', target: 'allAllies', cost: 11, status: 'ward', extraStatus: 'regen', duration: 3, description: 'Give the party Ward and Regen for three turns.' },
    depth_beacon: { name: 'Beacon', kind: 'magic', target: 'allEnemies', power: 1.9, element: 'light', cost: 12, status: 'blind', duration: 3, chance: .85, description: 'Strike all foes with light. The flash can cause Blind for three turns.' },
    depth_clearline: { name: 'Clear Line', kind: 'heal', target: 'allAllies', power: 1.9, cost: 11, cleanse: true, description: 'Restore party HP. Remove all harmful effects.' },
    depth_riptide: { name: 'Riptide', kind: 'magic', target: 'enemy', power: 2.6, element: 'water', cost: 9, delay: 25, description: 'Strike one foe with water. Remove 25 ATB from its gauge.' },
    depth_returnflow: { name: 'Return Flow', kind: 'heal', target: 'ally', power: 2.7, cost: 8, status: 'haste', duration: 2, description: 'Restore one ally HP. Give that ally Haste for two turns.' },
    depth_soundings: { name: 'Soundings', kind: 'magic', target: 'allEnemies', power: 2.3, element: 'sound', cost: 15, breakPower: 1, description: 'Strike all foes with sound. Add one Break pressure to each hit.' },
    depth_farstep: { name: 'Far Step', kind: 'buff', target: 'allAllies', cost: 13, status: 'focus', extraStatus: 'haste', duration: 3, description: 'Give the party Focus and Haste for three turns.' }
  };
  const unique = {
    depth_tidalthrust: { name: 'Tidal Thrust', kind: 'physical', target: 'enemy', power: 1.85, element: 'water', cost: 4, breakPower: 1, description: 'Strike one foe with water. Add one Break pressure.' },
    depth_anchorline: { name: 'Anchor Line', kind: 'buff', target: 'ally', cost: 5, status: 'ward', extraStatus: 'barrier', duration: 3, description: 'Give one ally Ward and Barrier for three turns.' },
    depth_surveymark: { name: 'Survey Mark', kind: 'magic', target: 'enemy', power: 1.55, element: 'sound', cost: 4, status: 'exposed', duration: 3, chance: 1, description: 'Strike one foe with sound. Exposed can increase damage to it for three turns.' },
    depth_groundmeasure: { name: 'Ground Measure', kind: 'magic', target: 'enemy', power: 1.8, element: 'earth', cost: 5, delay: 20, description: 'Strike one foe with earth. Remove 20 ATB from its gauge.' }
  };
  for (const [id, skill] of Object.entries({ ...spells, ...unique })) R.skills[id] = { id, label: skill.name, ...skill };
  const ECHOES = {
    undertide_silt: { name: 'Silt', title: 'The Living Bed', element: 'earth', spells: ['depth_siltstrike', 'depth_foundation'], hp: 40, def: 6, color: '#b6ab81', summonStatus: 'ward', description: 'An Echo of roots that hold when the tide turns.' },
    undertide_lantern: { name: 'Lantern', title: 'The Patient Light', element: 'light', spells: ['depth_beacon', 'depth_clearline'], mp: 20, mag: 7, color: '#efd29a', summonHeal: true, description: 'An Echo of a lamp left on for a late return.' },
    undertide_current: { name: 'Current', title: 'The Return Route', element: 'water', spells: ['depth_riptide', 'depth_returnflow'], spd: 7, hp: 30, color: '#70c8cc', summonStatus: 'haste', description: 'An Echo of water that carries a boat home.' },
    undertide_horizon: { name: 'Horizon', title: 'The Open Distance', element: 'sound', spells: ['depth_soundings', 'depth_farstep'], mag: 10, mp: 14, color: '#b9b6e6', summonStatus: 'focus', description: 'An Echo of a route beyond the edge of a chart.' }
  };
  for (const [id, echo] of Object.entries(ECHOES)) R.echoes[id] = { id, ...echo, learn: echo.spells.map((skill, i) => ({ skill, ap: i ? 8 : 4 })) };

  const BONDS = {
    nera: { id: 'nera', hero: 'nera', flag: 'u_bond_nera', name: 'The Relief Line', members: ['nera', 'vale'], skill: 'pair_lifeline', description: 'Nera and Vale share the return line. Heal the party, remove harmful effects, and add Ward and Barrier.' },
    pax: { id: 'pax', hero: 'pax', flag: 'u_bond_pax', name: 'A Map for Everyone', members: ['pax', 'sable'], skill: 'pair_openchart', description: 'Pax and Sable reveal a route through the foe. Strike all foes with sound, apply Exposed, and add Break pressure.' }
  };
  Object.assign(F.bonds, BONDS);
  const pairs = {
    pair_lifeline: { name: 'Lifeline', bond: 'nera', kind: 'heal', target: 'allAllies', power: 2.6, cleanse: true, status: 'ward', partyStatus: 'barrier' },
    pair_openchart: { name: 'Open Chart', bond: 'pax', kind: 'magic', target: 'allEnemies', element: 'sound', power: 2.8, status: 'exposed', chance: 1, breakPower: 2 }
  };
  for (const [id, skill] of Object.entries(pairs)) R.skills[id] = { id, ...skill, label: skill.name, members: BONDS[skill.bond].members.slice(), cost: 6, chorusCost: 40, duration: 3, description: BONDS[skill.bond].description + ' Both allies need 6 MP. The partner needs 50 ATB. Spend 40 Chorus.' };

  const SUPPORTS = {
    iona: { name: 'Ember Signal', kind: 'magic', target: 'allEnemies', element: 'fire', power: 1.65, resonance: 20, description: 'Iona strikes all foes with fire. Gain 20 extra Chorus.' },
    brann: { name: 'Rear Guard', kind: 'buff', target: 'allAllies', status: 'ward', duration: 4, partyHeal: .12, description: 'Brann gives the party Ward for four turns. Restore 12% of each ally maximum HP.' },
    sable: { name: 'Cut the Wire', kind: 'physical', target: 'enemy', power: 2.1, pierce: true, delay: 50, status: 'blind', duration: 2, chance: 1, description: 'Sable pierces one foe. Remove 50 ATB. The hit can cause Blind for two turns.' },
    oren: { name: 'Supply Coil', kind: 'buff', target: 'allAllies', status: 'focus', duration: 2, partyMp: 18, description: 'Oren restores 18 MP to each ally. Give the party Focus for two turns.' },
    mira: { name: 'Travelling Beat', kind: 'buff', target: 'allAllies', status: 'haste', duration: 3, partyHeal: .15, description: 'Mira gives the party Haste for three turns. Restore 15% of each ally maximum HP.' },
    tern: { name: 'Falling Step', kind: 'physical', target: 'allEnemies', element: 'wind', power: 1.65, breakPower: 3, description: 'Tern strikes all foes with wind. Add three Break pressure to each hit.' },
    vale: { name: 'Field Pickup', kind: 'revive', target: 'deadAlly', power: .65, description: 'Vale revives one fallen ally with 65% HP.' },
    rook: { name: 'Reserve Battery', kind: 'buff', target: 'allAllies', status: 'barrier', duration: 3, resonance: 30, description: 'Rook gives the party Barrier for three turns. Gain 30 Chorus.' },
    nera: { name: 'Return Line', kind: 'heal', target: 'allAllies', power: 2.1, cleanse: true, description: 'Nera restores party HP and removes all harmful effects.' },
    pax: { name: 'Route Mark', kind: 'debuff', target: 'allEnemies', status: 'exposed', duration: 3, chance: 1, delay: 25, description: 'Pax removes 25 ATB from all foes. Exposed can increase damage to them for three turns.' }
  };
  for (const [id, skill] of Object.entries(SUPPORTS)) Object.assign(skill, { id: 'support:' + id, hero: id, label: skill.name, cost: 0, supportCost: 1, description: skill.description + ' Use the active hero turn. The company shares one Support call per battle. No reserve MP is spent.' });

  const gear = {
    depth_tidefork: { name: 'Return Tide Fork', slot: 'weapon', atk: 46, def: 9, hp: 60, element: 'water', breakPower: 1, description: 'A diver fork with a safe return line. Water strikes add one Break pressure.' },
    depth_chartrod: { name: 'Open Chart Rod', slot: 'weapon', atk: 27, mag: 41, mp: 20, element: 'sound', description: 'A survey rod with a clear tone. Physical strikes use sound.' },
    depth_pressurecoat: { name: 'Pressure Coat', slot: 'armor', def: 32, hp: 150, resist: ['water', 'earth'], description: 'A strong diving coat. Reduce water and earth damage by 45%.' },
    depth_lanternrobe: { name: 'Lantern Robe', slot: 'armor', def: 24, mag: 18, mp: 35, immune: ['silence', 'blind'], description: 'A robe with a steady light. Prevent Silence and Blind.' },
    depth_surveyor: { name: 'Survey Dial', slot: 'relic', mag: 9, spd: 8, breakPower: 1, description: 'A clear reading of a weak seam. Add one Break pressure to each damaging action.' },
    depth_rescueseal: { name: 'Rescue Seal', slot: 'relic', def: 12, hp: 100, pairDiscount: 10, immune: ['poison'], description: 'A seal for a rescue crew. Prevent Poison. The wearer leads pair skills for 10 less Chorus.' }
  };
  const recipes = {
    depth_tidefork: { costs: { brass: 5, glass: 3, stariron: 3 }, gold: 400, requires: ['u_bond_nera'], unlockText: 'Complete Nera’s Undertide bond.' },
    depth_chartrod: { costs: { glass: 5, thread: 3, stariron: 3 }, gold: 400, requires: ['u_bond_pax'], unlockText: 'Complete Pax’s Undertide bond.' },
    depth_pressurecoat: { costs: { brass: 5, sap: 3, stariron: 3 }, gold: 350, requires: ['u_depth_04'], unlockText: 'Complete the fourth Undertide mission.' },
    depth_lanternrobe: { costs: { thread: 5, glass: 3, stariron: 3 }, gold: 350, requires: ['u_depth_04'], unlockText: 'Complete the fourth Undertide mission.' },
    depth_surveyor: { costs: { glass: 4, frost: 3, stariron: 3 }, gold: 350, requires: ['u_depth_08'], unlockText: 'Complete the eighth Undertide mission.' },
    depth_rescueseal: { costs: { sap: 5, brass: 2, stariron: 3 }, gold: 350, requires: ['u_depth_08'], unlockText: 'Complete the eighth Undertide mission.' }
  };
  for (const [id, item] of Object.entries(gear)) {
    const recipe = recipes[id], main = Object.keys(recipe.costs)[0];
    R.equipment[id] = { id, ...item, price: 2200, craftOnly: true, salvage: { [main]: 1, stariron: 1 } };
    F.recipes[id] = { id, gear: id, ...recipe, description: item.description };
  }

  const enemy = (name, hp, atk, mag, def, spd, weak, moves, color, shape, material, extra = {}) => ({ name, hp, atk, mag, def, spd, weak, moves, color, shape, breakMax: 5, drops: { [material]: 1 }, ...extra });
  const foes = {
    siltcrawler: enemy('Silt Crawler', 270, 29, 24, 24, 26, ['fire', 'wind'], ['poisonbite', 'stone', 'sweep'], '#99ad83', 'beetle', 'sap', { resist: ['earth'], hint: 'Use fire or wind. Remove Poison before the next turn.' }),
    lamprey: enemy('Wire Lamprey', 260, 28, 30, 20, 33, ['lightning', 'earth'], ['wave', 'drain', 'poisonbite'], '#72b3b9', 'serpent', 'glass', { resist: ['water'], hint: 'Use lightning or earth. Water meets strong resistance.' }),
    brineguard: enemy('Brine Guard', 315, 33, 24, 29, 24, ['lightning', 'sound'], ['charge', 'gearcrush', 'sweep'], '#b6a786', 'machine', 'brass', { breakMax: 6, resist: ['water'], hint: 'Use lightning or sound. Defend after Gather Power.' }),
    bellmedusa: enemy('Bell Medusa', 265, 23, 34, 21, 34, ['earth', 'dark'], ['hush', 'echo', 'spark'], '#c1a8d3', 'wisp', 'glass', { resist: ['light'], hint: 'Use earth or dark. Bring a way to remove Silence.' }),
    siltwisp: enemy('Silt Wisp', 252, 21, 35, 20, 30, ['light', 'wind'], ['shade', 'gravity', 'darkness'], '#a4b8aa', 'wisp', 'sap', { resist: ['dark', 'earth'], hint: 'Use light or wind. Cleanse removes Blind and Slow.' }),
    pressurecrab: enemy('Pressure Crab', 340, 36, 22, 34, 23, ['ice', 'lightning'], ['charge', 'rend', 'sweep'], '#b99079', 'beetle', 'brass', { breakMax: 6, resist: ['water'], hint: 'Use ice or lightning. Ward reduces its physical attacks.' }),
    trenchkite: enemy('Trench Kite', 275, 30, 33, 21, 39, ['earth', 'fire'], ['gust', 'spark', 'shriek'], '#8fb5ce', 'wing', 'thread', { resist: ['wind'], hint: 'Use earth or fire. Barrier reduces its magic attacks.' }),
    chartshade: enemy('Chart Shade', 282, 25, 36, 23, 33, ['fire', 'sound'], ['echo', 'darkness', 'shade'], '#b0a2c1', 'crystal', 'frost', { resist: ['dark'], hint: 'Use fire or sound. Blind can make physical attacks miss.' }),
    bellengine: enemy('Bell Engine', 1210, 37, 34, 29, 27, ['water', 'sound'], ['charge', 'gearcrush', 'echo', 'hush'], '#c5ab7e', 'machine', 'brass', { boss: true, breakMax: 8, resist: ['earth'], phaseLabel: 'Closed bell', drops: { brass: 3, stariron: 2 }, hint: 'Use water or sound. Ward reduces Gear Crush. Keep a Remedy ready for Silence.', phases: [{ at: .5, name: 'Open Bell', weak: ['ice', 'lightning'], resist: ['water'], moves: ['charge', 'meteor', 'sweep', 'echo'], magic: 1.06, hint: 'The bell is open. Use ice or lightning. Barrier reduces Starfall.' }] }),
    pearlwarden: enemy('Pearl Warden', 1280, 32, 39, 28, 29, ['earth', 'dark'], ['charge', 'freeze', 'darkness', 'wave'], '#c6c8db', 'crystal', 'glass', { boss: true, breakMax: 9, resist: ['water', 'light'], phaseLabel: 'Bright pearl', drops: { glass: 3, frost: 2, stariron: 2 }, hint: 'Use earth or dark. Cleanse removes Slow and Blind.', phases: [{ at: .5, name: 'Dark Pearl', weak: ['fire', 'sound'], resist: ['dark', 'water'], moves: ['charge', 'shade', 'hush', 'rupture'], magic: 1.06, hint: 'The pearl is dark. Use fire or sound. Remove Silence. Barrier reduces Rupture.' }] }),
    trenchheart: enemy('Trench Heart', 1410, 38, 35, 30, 25, ['fire', 'wind'], ['venom', 'stone', 'selfmend', 'sweep'], '#8da78c', 'plant', 'sap', { boss: true, breakMax: 9, resist: ['earth', 'water'], phaseLabel: 'Firm bed', drops: { sap: 3, brass: 2, stariron: 3 }, hint: 'Use fire or wind. Remove Poison. Break Rebuild to stop its repair.', phases: [{ at: .5, name: 'Loose Stone', weak: ['ice', 'lightning'], resist: ['fire', 'earth'], moves: ['charge', 'gearcrush', 'gravity', 'sweep'], attack: 1.07, hint: 'The stone is loose. Use ice or lightning. Ward reduces its heavy strikes.' }] }),
    horizonmouth: enemy('Horizon Mouth', 1520, 38, 42, 30, 30, ['light', 'sound'], ['echo', 'darkness', 'charge', 'meteor'], '#b8badf', 'star', 'frost', { boss: true, breakMax: 10, resist: ['dark', 'void'], phaseLabel: 'Distant voice', drops: { frost: 3, glass: 2, stariron: 3 }, hint: 'Use light or sound. Barrier reduces Starfall. Remove Blind before physical attacks.', phases: [{ at: .5, name: 'Open Horizon', weak: ['earth', 'water'], resist: ['light', 'lightning'], moves: ['charge', 'rupture', 'wave', 'gearcrush'], attack: 1.07, magic: 1.07, hint: 'The route is open. Use earth or water. Barrier reduces Rupture. Ward reduces Gear Crush.' }] })
  };
  for (const [id, foe] of Object.entries(foes)) R.enemies[id] = { id, ...foe, resist: foe.resist || [], steal: foe.boss || ['machine', 'crystal'].includes(foe.shape) ? 'ether' : 'tonic' };

  const atLeast = (key, min, label) => ({ key, min, label });
  const atMost = (key, max, label) => ({ key, max, label });
  const noItems = () => atMost('itemsUsed', 0, 'Use no items.');
  const TRIALS = {
    t_depth_01: { name: 'Weak Seams', encounter: { enemies: ['siltcrawler', 'lamprey'], level: 26, boss: false }, goals: [atLeast('weaknessHits', 4, 'Hit a weakness at least 4 times.'), atMost('actions', 18, 'Use at most 18 hero actions.')], reward: { gold: 200, materials: { glass: 3, sap: 2 } } },
    t_depth_02: { name: 'Held Pressure', encounter: { enemies: ['pressurecrab', 'brineguard'], level: 28, boss: false }, goals: [atLeast('breaks', 2, 'Cause at least 2 Breaks.'), noItems()], reward: { gold: 250, materials: { brass: 3, frost: 2 } } },
    t_depth_03: { name: 'Clear Signal', encounter: { enemies: ['bellmedusa', 'siltwisp', 'trenchkite'], level: 30, boss: false }, goals: [atLeast('weaknessHits', 6, 'Hit a weakness at least 6 times.'), atLeast('supportUses', 1, 'Use a reserve Support call.')], reward: { gold: 300, materials: { thread: 3, glass: 2 } } },
    t_depth_04: { name: 'Bell Cycle', encounter: { enemies: ['bellengine'], level: 31, boss: true }, goals: [atLeast('breaks', 2, 'Cause at least 2 Breaks.'), atMost('actions', 24, 'Use at most 24 hero actions.')], reward: { gold: 350, materials: { brass: 3, stariron: 2 } } },
    t_depth_05: { name: 'A Clear Reflection', encounter: { enemies: ['pearlwarden', 'chartshade'], level: 34, boss: true }, goals: [atLeast('weaknessHits', 8, 'Hit a weakness at least 8 times.'), noItems()], reward: { gold: 400, materials: { frost: 3, stariron: 2 } } },
    t_depth_06: { name: 'Beyond the Chart', encounter: { enemies: ['horizonmouth', 'trenchkite'], level: 38, boss: true }, goals: [atLeast('breaks', 3, 'Cause at least 3 Breaks.'), noItems(), atMost('actions', 38, 'Use at most 38 hero actions.')], reward: { gold: 600, materials: { stariron: 4, glass: 3 } } }
  };
  Object.entries(TRIALS).forEach(([id, trial], index) => Object.assign(trial, { id, description: 'Win for Bronze. Meet some goals for Silver. Meet all goals for Gold.', requires: index ? ['t_depth_' + String(index).padStart(2, '0'), ...(index === 5 ? ['u_depth_11'] : [])] : ['u_depth_03', 'u_depth_05'], encounter: { ...trial.encounter, seed: 52101 + index * 997 } }));
  const METRICS = ['actions', 'itemsUsed', 'breaks', 'weaknessHits', 'supportUses', 'enemyActions', 'knockouts', 'damageTaken'];
  const MEDALS = ['No medal', 'Bronze', 'Silver', 'Gold'];
  const LEVEL_MODES = { current: 'Current level', matched: 'Matched level' };
  const SCORE_KEYS = ['grade', 'lastGrade', 'attempts', 'wins', 'best', 'last', 'difficulty'];
  function modeRecords(trial) {
    if (!trial) return {};
    return trial.modeRecords ? R.copy(trial.modeRecords) : { [trial.levelMode || 'current']: Object.fromEntries(SCORE_KEYS.map(key => [key, R.copy(trial[key])])) };
  }
  function ensure(state) {
    if (!state.undertide) state.undertide = { version: 1, trials: {} };
    for (const trial of Object.values(state.undertide.trials)) { trial.modeRecords = modeRecords(trial); trial.levelMode ||= 'current'; trial.lastLevelMode ||= 'current'; }
    return state.undertide;
  }
  function validMetrics(metrics) { return record(metrics) && Object.keys(metrics).length === METRICS.length && METRICS.every(key => whole(metrics[key])) && metrics.supportUses <= 1 && metrics.itemsUsed <= metrics.actions && metrics.supportUses <= metrics.actions; }
  function validScore(trial) {
    return record(trial) && whole(trial.grade, 3) && whole(trial.lastGrade, trial.grade) && whole(trial.attempts, 999999) && trial.attempts > 0 && whole(trial.wins, trial.attempts) && (trial.grade === 0 ? trial.best === null && trial.wins === 0 : validMetrics(trial.best) && trial.wins > 0) && validMetrics(trial.last) && own(R.difficulties, trial.difficulty);
  }
  function validate(state) {
    if (state.undertide === undefined) return true;
    const value = state.undertide;
    if (!record(value) || value.version !== 1 || !record(value.trials) || Object.keys(value.trials).length > 6) return false;
    return Object.entries(value.trials).every(([id, trial]) => {
      if (!own(TRIALS, id) || !validScore(trial) || typeof trial.claimed !== 'boolean' || trial.claimed !== (trial.wins > 0) || trial.levelMode !== undefined && !own(LEVEL_MODES, trial.levelMode) || trial.lastLevelMode !== undefined && !own(LEVEL_MODES, trial.lastLevelMode)) return false;
      if (trial.modeRecords === undefined) return true;
      if (!record(trial.modeRecords) || !Object.keys(trial.modeRecords).length || Object.keys(trial.modeRecords).length > 2 || Object.entries(trial.modeRecords).some(([mode, score]) => !own(LEVEL_MODES, mode) || !validScore(score))) return false;
      const best = trial.modeRecords[trial.levelMode || 'current'], last = trial.modeRecords[trial.lastLevelMode || 'current'];
      if (!best || !last || best.grade !== trial.grade || best.difficulty !== trial.difficulty || METRICS.some(key => best.best?.[key] !== trial.best?.[key] || last.last[key] !== trial.last[key]) || last.lastGrade !== trial.lastGrade) return false;
      const modes = Object.values(trial.modeRecords);
      return modes.reduce((sum, score) => sum + score.attempts, 0) === trial.attempts && modes.reduce((sum, score) => sum + score.wins, 0) === trial.wins && Math.max(...modes.map(score => score.grade)) === trial.grade && own(trial.modeRecords, trial.levelMode || 'current') && own(trial.modeRecords, trial.lastLevelMode || 'current');
    });
  }
  function trialStatus(state, id) {
    const trial = TRIALS[id];
    if (!trial) return { ok: false, unlocked: false, reason: 'This trial is unknown.', reasons: ['This trial is unknown.'] };
    const reasons = trial.requires.filter(flag => !state.flags?.[flag]).map(flag => 'Complete ' + (TRIALS[flag]?.name || flag.replace('u_depth_', 'Undertide mission ')) + ' first.');
    const saved = state.undertide?.trials?.[id];
    const modes = Object.fromEntries(Object.entries(modeRecords(saved)).map(([mode, score]) => [mode, { ...score, medal: MEDALS[score.grade], levelMode: mode, levelModeLabel: LEVEL_MODES[mode] }]));
    return { ...trial, ok: true, unlocked: !reasons.length, practiceReady: !reasons.length && Boolean(state.flags?.[id]), reasons, reason: reasons[0] || '', grade: saved?.grade || 0, medal: MEDALS[saved?.grade || 0], best: saved?.best ? R.copy(saved.best) : null, bestDifficulty: saved?.difficulty || null, attempts: saved?.attempts || 0, claimed: saved?.claimed || false, bestLevelMode: saved?.levelMode || 'current', lastLevelMode: saved?.lastLevelMode || 'current', levelMode: saved?.levelMode || 'current', levelModeLabel: LEVEL_MODES[saved?.levelMode || 'current'], matchedLevel: saved?.levelMode === 'matched', modeRecords: modes };
  }
  function trialSpec(id, practice = true, options = {}) {
    if (!own(TRIALS, id)) return null;
    return { ...R.copy(TRIALS[id].encounter), id: 'battle_' + id, trialId: id, practice: practice === true, ...(options?.matchedLevel === true ? { matchedLevel: true } : {}) };
  }
  function evaluateTrial(battle, id = battle?.trialId) {
    const trial = TRIALS[id];
    if (!trial || !battle || battle.trialId !== id || !['victory', 'defeat', 'fled'].includes(battle.result) || !validMetrics(battle.metrics)) return { ok: false, reason: 'This trial has no valid finished battle.' };
    const expected = trial.encounter.enemies.slice().sort(), actual = battle.enemies.map(foe => foe.baseId).sort();
    if (battle.level !== trial.encounter.level || Boolean(battle.boss) !== trial.encounter.boss || expected.length !== actual.length || expected.some((foe, i) => foe !== actual[i])) return { ok: false, reason: 'This battle does not match the trial formation.' };
    const levelMode = battle.matchedLevel === true ? 'matched' : 'current';
    if (battle.levelMode && battle.levelMode !== levelMode || levelMode === 'matched' && (!battle.practice || battle.levelCap !== trial.encounter.level || [...battle.heroes, ...(battle.reserves || [])].some(hero => !Number.isInteger(hero.campaignLevel) || hero.level !== Math.min(hero.campaignLevel, battle.levelCap)))) return { ok: false, reason: 'This battle has an invalid practice level mode.' };
    const victory = battle.result === 'victory', metrics = R.copy(battle.metrics);
    const goals = trial.goals.map(goal => ({ ...goal, actual: metrics[goal.key], achieved: victory && (goal.min == null || metrics[goal.key] >= goal.min) && (goal.max == null || metrics[goal.key] <= goal.max) }));
    const met = goals.filter(goal => goal.achieved).length, grade = victory ? met === goals.length ? 3 : met ? 2 : 1 : 0;
    return { ok: true, id, trialId: id, name: trial.name, victory, grade, medal: MEDALS[grade], goals, met, total: goals.length, metrics, difficulty: battle.difficulty, time: battle.time, practice: battle.practice === true, levelMode, levelModeLabel: LEVEL_MODES[levelMode], matchedLevel: levelMode === 'matched', levelCap: battle.levelCap || null };
  }
  function scoreResult(before, result) {
    const previousGrade = before?.grade || 0;
    const improved = result.grade > previousGrade || result.grade === previousGrade && result.victory && (!before?.best || result.metrics.actions < before.best.actions || result.metrics.actions === before.best.actions && result.metrics.damageTaken < before.best.damageTaken);
    return { improved, score: { grade: Math.max(previousGrade, result.grade), lastGrade: result.grade, attempts: (before?.attempts || 0) + 1, wins: (before?.wins || 0) + Number(result.victory), best: improved ? R.copy(result.metrics) : before?.best ? R.copy(before.best) : null, last: R.copy(result.metrics), difficulty: improved ? result.difficulty : before?.difficulty || result.difficulty } };
  }
  function recordTrial(state, battle) {
    if (battle?.trialRecorded) return { ...R.copy(battle.trialRecorded), alreadyRecorded: true };
    const result = evaluateTrial(battle);
    if (!result.ok) return result;
    if (!validate(state)) return { ok: false, reason: 'The saved trial record is invalid.' };
    const unlocked = trialStatus(state, result.id);
    if (!unlocked.unlocked) return { ok: false, reason: unlocked.reason };
    const before = state.undertide?.trials[result.id], previousGrade = before?.grade || 0;
    if ((before?.attempts || 0) >= 999999) return { ok: false, reason: 'The trial record is full.' };
    const reward = TRIALS[result.id].reward, firstPrize = result.victory && !before?.claimed;
    if (firstPrize) {
      if (state.gold + reward.gold > 99999999) return { ok: false, reason: 'The gold store is full.' };
      const grant = F.grantMaterials(state, reward.materials);
      if (!grant.ok) return grant;
      state.gold += reward.gold;
    }
    const { improved, score } = scoreResult(before, result), modes = modeRecords(before), modeResult = scoreResult(modes[result.levelMode], result);
    modes[result.levelMode] = modeResult.score;
    const store = ensure(state).trials;
    store[result.id] = { ...score, claimed: Boolean(before?.claimed || firstPrize), levelMode: improved ? result.levelMode : before ? before.levelMode || 'current' : result.levelMode, lastLevelMode: result.levelMode, modeRecords: modes };
    const receipt = { ...result, previousGrade, bestGrade: store[result.id].grade, bestMedal: MEDALS[store[result.id].grade], bestLevelMode: store[result.id].levelMode, modeBestGrade: modeResult.score.grade, modeBestMedal: MEDALS[modeResult.score.grade], modeImproved: modeResult.improved, improved, firstPrize, gold: firstPrize ? reward.gold : 0, materials: firstPrize ? Object.entries(reward.materials).map(([id, count]) => ({ id, count })) : [], message: result.name + ': ' + result.medal + ' (' + result.levelModeLabel + '). ' + result.met + ' of ' + result.total + ' goals met.' + (firstPrize ? ' First medal prize received.' : result.victory ? ' The first medal prize was already received.' : ' Win the trial to earn a medal.') };
    battle.trialRecorded = R.copy(receipt);
    return receipt;
  }
  CC.Undertide = { version: '1.0.0', heroIds: Object.keys(HEROES), enemyIds: Object.keys(foes), echoIds: Object.keys(ECHOES), spellIds: Object.keys(spells), gearIds: Object.keys(gear), bondIds: Object.keys(BONDS), supports: SUPPORTS, trials: TRIALS, ensure, validate, trialStatus, trialSpec, evaluateTrial, recordTrial };
})(globalThis);
