/* Lessons in the Breaking Hour — optional combat content for The Far Shore.
 * Load after content.js and expansions; Battle consumes these plain data specs.
 */
(() => {
  'use strict';
  const D = globalThis.Dawn;
  if (!D?.Content) throw new Error('Load content.js before combat-content.js.');
  const C = D.Content;
  if (C.combatExpansion) return;
  const add = (target, rows) => rows.forEach(row => { target[row.id] = row; });
  const flag = id => ({ type: 'flag', id, value: true });
  const hit = (name, power = 1, element = 'physical', target = 'enemy', extra = {}) =>
    ({ name, power, type: element === 'physical' ? 'physical' : 'magic', element, target, ...extra });
  const charge = (name, power, element, target = 'allEnemies', extra = {}) =>
    hit(name, power, element, target, { charge: true, telegraph: 2.2, ...extra });
  const support = (name, status, target = 'self', extra = {}) =>
    ({ name, type: 'support', target, status, telegraph: 0.8, ...extra });

  C.combatExpansion = { id: 'breaking-hour', version: '1.0.0', title: 'Lessons in the Breaking Hour',
    summary: 'Six optional trials teach pressure, protection, and recovery. Each awards a new personal technique.' };
  C.masteries = [
    { id: 'mastery_mira', hero: 'mira', skill: 'sever_second', flag: 'mastery_mira',
      name: 'The Unspent Second', description: 'Mira learns to strike an action before it becomes a wound.' },
    { id: 'mastery_brann', hero: 'brann', skill: 'faultbreaker', flag: 'mastery_brann',
      name: 'A Useful Fault', description: 'Brann finds the joint that a stronger wall would hide.' },
    { id: 'mastery_nyx', hero: 'nyx', skill: 'unwrite', flag: 'mastery_nyx',
      name: 'The Empty Margin', description: 'Nyx removes a borrowed protection without erasing its owner.' },
    { id: 'mastery_soren', hero: 'soren', skill: 'harbour_song', flag: 'mastery_soren',
      name: 'Room in the Choir', description: 'Soren leaves a healing note for those who cannot yet answer.' },
    { id: 'mastery_vale', hero: 'vale', skill: 'groundwire', flag: 'mastery_vale',
      name: 'A Way to Ground', description: 'Vale gives a runaway current somewhere safe to end.' },
    { id: 'mastery_ilex', hero: 'ilex', skill: 'shelter_years', flag: 'mastery_ilex',
      name: 'Shelter for the Years', description: 'Ilex grows a shelter that survives by making room for change.' }
  ];
  add(C.skills, [
    { id: 'sever_second', name: 'Sever the Second', cost: 7, type: 'physical', target: 'enemy',
      element: 'wind', power: 1.35, stagger: 42, unlockFlag: 'mastery_mira',
      description: 'A wind cut with 42 pressure. Weakness and a casting target add more pressure.' },
    { id: 'faultbreaker', name: 'Faultbreaker', cost: 8, type: 'physical', target: 'enemy',
      element: 'fire', power: 1.6, stagger: 60, unlockFlag: 'mastery_brann',
      description: 'A heavy fire strike with 60 pressure. Break a charge before it lands.' },
    { id: 'unwrite', name: 'Unwrite', cost: 9, type: 'magic', target: 'enemy',
      element: 'void', power: 1.3, stagger: 28, dispel: true, unlockFlag: 'mastery_nyx',
      description: 'Remove guard, haste, and regeneration before a void strike. Adds 28 pressure.' },
    { id: 'harbour_song', name: 'Harbour Song', cost: 10, type: 'heal', target: 'allAllies',
      element: 'water', power: 1.1, cleanse: true, status: { regen: 8 }, unlockFlag: 'mastery_soren',
      description: 'Heal and cleanse the party, then restore more health for eight seconds.' },
    { id: 'groundwire', name: 'Groundwire', cost: 8, type: 'magic', target: 'enemy',
      element: 'spark', power: 1.7, stagger: 40, status: { slow: 7 }, unlockFlag: 'mastery_vale',
      description: 'A spark strike with 40 pressure. Slow the target to delay its next action.' },
    { id: 'shelter_years', name: 'Shelter for Years', cost: 9, type: 'support', target: 'allAllies',
      element: 'earth', power: 0, status: { guard: 11, regen: 9 }, unlockFlag: 'mastery_ilex',
      description: 'Protect all allies for eleven seconds and restore health for nine seconds.' },
    { id: 'unbound_step', name: 'Unbound Step', combo: ['mira', 'nyx'], costs: { mira: 8, nyx: 8 },
      type: 'physical', target: 'enemy', element: 'void', power: 2.1, stagger: 90, dispel: true,
      unlockFlags: ['mastery_mira', 'mastery_nyx'],
      description: 'Remove one enemy\'s protections, then strike with 90 pressure. Requires both masteries.' },
    { id: 'hearthfault', name: 'Hearthfault', combo: ['brann', 'ilex'], costs: { brann: 8, ilex: 7 },
      type: 'magic', target: 'circle', radius: 68, element: 'earth', power: 1.85, stagger: 65,
      unlockFlags: ['mastery_brann', 'mastery_ilex'],
      description: 'Open a fault beneath a close group. Each target takes 65 pressure. Requires both masteries.' },
    { id: 'clear_current', name: 'Clear Current', combo: ['soren', 'vale'], costs: { soren: 8, vale: 8 },
      type: 'heal', target: 'allAllies', element: 'water', power: 1.1, cleanse: true,
      status: { guard: 7, haste: 8 }, unlockFlags: ['mastery_soren', 'mastery_vale'],
      description: 'Heal, cleanse, protect, and hasten the party. Requires both masteries.' }
  ]);

  add(C.enemies, [
    { id: 'trial_bell_keeper', name: 'Unrung Bell', rigId: 'bell_warden', boss: true,
      maxHp: 5200, atk: 34, mag: 37, def: 16, speed: 10, staggerMax: 145, staggerRecovery: 4,
      weak: ['wind', 'water'], resist: ['spark'],
      description: 'Its large charge is easy to break if the party keeps an action ready.',
      pattern: [charge('The Unspent Chime', 1.65, 'spark', 'allEnemies', { telegraph: 2.6 }),
        hit('Clapper Arm', 1.25), hit('Measured Note', 0.9, 'water')],
      phases: [{ at: 0.5, name: 'The Second Hand', magMult: 1.1, speedMult: 1.05,
        weak: ['wind', 'water'], pattern: [charge('A Bell Before Morning', 1.8, 'spark', 'allEnemies', { telegraph: 2.8 }),
          hit('Hollow Swing', 1.3), charge('The Note Between', 1.3, 'wind', 'line', { telegraph: 2 })] }] },
    { id: 'trial_foundry_wall', name: 'Wall of Good Intentions', rigId: 'furnace_regent', boss: true,
      maxHp: 5800, atk: 43, mag: 40, def: 22, speed: 10, staggerMax: 155, staggerRecovery: 4,
      guardedBy: 'trial_ward_pin', weak: ['fire', 'water'], resist: ['physical'],
      description: 'The Ward Pin halves damage and pressure against this wall while the pin lives.',
      pattern: [hit('Supported Weight', 1.35), charge('A Roof for No One', 1.5, 'earth'),
        hit('Copper Seam', 1.05, 'fire', 'line')],
      phases: [{ at: 0.45, name: 'An Open Door', atkMult: 1.12, weak: ['fire', 'wind'],
        pattern: [charge('Load Bearing', 1.6, 'earth', 'allEnemies', { telegraph: 2.5 }),
          hit('Useful Fracture', 1.4)] }] },
    { id: 'trial_ward_pin', name: 'Ward Pin', rigId: 'archive_guard', maxHp: 1000,
      atk: 24, mag: 26, def: 14, speed: 9, staggerMax: 65, weak: ['water', 'wind'], resist: ['physical'],
      description: 'Defeat this pin to remove the wall\'s ward.',
      pattern: [hit('Stay in Place', 0.9, 'spark', 'enemy', { status: { slow: 5 } }),
        support('Take the Load', { guard: 4 })] },
    { id: 'trial_mirror_self', name: 'The Better Reflection', rigId: 'mirror_mask', boss: true,
      maxHp: 7000, atk: 45, mag: 47, def: 23, speed: 12, staggerMax: 160, staggerRecovery: 4,
      status: { guard: 4, haste: 5 }, weak: ['earth', 'fire'], resist: ['void'],
      description: 'Its copied guard expires. A dispel removes guard and haste at once.',
      pattern: [hit('Copied Edge', 1.25), charge('A Perfect Reply', 1.35, 'void'),
        support('Borrowed Poise', { guard: 4, haste: 6 }, 'self', { telegraph: 1.1 })],
      phases: [{ at: 0.65, name: 'The Missing Margin', weak: ['spark', 'wind'], resist: ['fire'],
        pattern: [charge('Unanswered Question', 1.45, 'spark', 'allEnemies', { telegraph: 2.4 }),
          hit('Silver Edit', 1.25), support('Borrowed Poise', { guard: 4, haste: 6 })] },
      { at: 0.3, name: 'An Unwritten Face', weak: ['void', 'earth'], resist: [], magMult: 1.1,
        pattern: [charge('Room for an Answer', 1.6, 'void', 'allEnemies', { telegraph: 2.6 }),
          hit('Blank Page', 1.2, 'wind')] }] },
    { id: 'trial_choir_keeper', name: 'Choir of One', rigId: 'index_keeper', boss: true,
      maxHp: 5500, atk: 37, mag: 46, def: 22, speed: 10, staggerMax: 140, staggerRecovery: 4,
      weak: ['water', 'wind'], resist: ['void'],
      description: 'Interrupt its healing song or defeat the two voices before the song completes.',
      pattern: [{ name: 'Every Voice Is Mine', type: 'heal', target: 'allAllies', power: 1.1,
        charge: true, telegraph: 2.4 }, hit('Held Note', 1.2, 'water'),
      charge('Closed Harmony', 1.25, 'void', 'allEnemies', { telegraph: 2.2 })],
      phases: [{ at: 0.45, name: 'Room in the Choir', magMult: 1.08, weak: ['water', 'earth'],
        pattern: [charge('The Empty Part', 1.4, 'water'),
          { name: 'A Place to Breathe', type: 'heal', target: 'ally', power: 1.4, charge: true, telegraph: 2.5 }] }] },
    { id: 'trial_high_voice', name: 'The High Voice', rigId: 'memory_moth', maxHp: 1350,
      atk: 35, mag: 38, def: 17, speed: 12, staggerMax: 70, weak: ['fire', 'spark'], resist: ['wind'],
      pattern: [hit('Needle Note', 1.0, 'wind'), charge('Rise Above', 1.2, 'wind', 'line')] },
    { id: 'trial_low_voice', name: 'The Low Voice', rigId: 'rootling', maxHp: 1400,
      atk: 39, mag: 34, def: 20, speed: 8, staggerMax: 75, weak: ['fire', 'water'], resist: ['earth'],
      pattern: [hit('Root Note', 1.05), charge('Hold Below', 1.15, 'earth', 'circle', { status: { poison: 5 } })] },
    { id: 'trial_storm_return', name: 'The Unreturned Signal', rigId: 'horizon_crab', boss: true,
      maxHp: 9400, atk: 53, mag: 57, def: 28, speed: 14, staggerMax: 165, staggerRecovery: 4,
      weak: ['earth', 'water'], resist: ['spark'],
      description: 'It hastens itself before a long charge. Pressure during casting gets a bonus.',
      pattern: [support('Current with No Ground', { haste: 11 }, 'self', { telegraph: 1 }),
        charge('Return Stroke', 1.65, 'spark', 'allEnemies', { telegraph: 2.8 }),
        hit('Loose Arc', 1.2, 'spark', 'line')],
      phases: [{ at: 0.55, name: 'The Open Circuit', magMult: 1.1, weak: ['earth', 'wind'], resist: [],
        pattern: [charge('All Roads Conduct', 1.8, 'spark', 'allEnemies', { telegraph: 3 }),
          hit('Copper Rain', 1.15, 'water', 'circle', { status: { slow: 5 } }),
          support('No End to the Wire', { haste: 9 })] }] },
    { id: 'trial_accord_keeper', name: 'Shelter Without Doors', rigId: 'fourfold_witness', boss: true,
      maxHp: 11200, atk: 61, mag: 64, def: 34, speed: 12, staggerMax: 180, staggerRecovery: 4,
      guardedBy: 'trial_returning_ward', weak: ['fire', 'wind'], resist: ['void'],
      description: 'The ward returns through a long chant. Interrupt the chant to keep the way open.',
      pattern: [hit('The First Wall', 1.2), charge('Keep Every Winter Out', 1.35, 'earth')],
      phases: [{ at: 0.68, name: 'The Door We Closed', weak: ['water', 'earth'], resist: ['fire'],
        pattern: [{ name: 'Raise the Old Wall', type: 'revive', target: 'ally', power: 0.45,
          charge: true, telegraph: 2.8 }, charge('A Safe and Empty House', 1.45, 'void'),
        hit('Borrowed Shelter', 1.3)] },
      { at: 0.32, name: 'Shelter for a Changing Year', weak: ['fire', 'wind', 'earth'], resist: [],
        magMult: 1.1, pattern: [{ name: 'One Last Wall', type: 'revive', target: 'ally', power: 0.35,
          charge: true, telegraph: 3 }, charge('Let the Weather In', 1.6, 'water', 'allEnemies', { telegraph: 2.7 }),
        hit('The Open Door', 1.35, 'wind', 'line')] }] },
    { id: 'trial_returning_ward', name: 'A Wall Remembered', rigId: 'glass_guard', maxHp: 1600,
      atk: 39, mag: 42, def: 23, speed: 9, staggerMax: 75, weak: ['fire', 'wind'], resist: ['void'],
      description: 'The shelter can revive this ward. The ward never protects itself.',
      pattern: [hit('Old Foundation', 1.0), charge('A Narrow View', 1.05, 'earth', 'line')] }
  ]);

  C.eliteTrials = [
    { id: 'trial_bell', name: 'The Unspent Second', hero: 'mira', minLevel: 5,
      requires: { chapterAtLeast: 2 }, suggestedParty: ['mira', 'soren', 'brann'],
      enemies: ['trial_bell_keeper'], xp: 180, gold: 120,
      rule: 'The bell starts with a long charge. Hold a ready action, then strike its wind or water weakness while it casts.',
      lesson: 'A full pressure meter interrupts the current action. During the break, the target takes a quarter more damage.',
      victory: 'Mira waits through a falling second. Her blade reaches the silence before the bell.' },
    { id: 'trial_bulwark', name: 'A Useful Fault', hero: 'brann', minLevel: 7,
      requires: { chapterAtLeast: 3 }, suggestedParty: ['brann', 'soren', 'mira'],
      enemies: ['trial_foundry_wall', 'trial_ward_pin'], xp: 240, gold: 150,
      rule: 'The Ward Pin halves damage and pressure against the wall. Defeat the pin first, then open the wall with fire or water.',
      lesson: 'A ward is an ally, not a status. Dispel cannot remove it; defeating the source can.',
      victory: 'Brann removes one pin. The wall opens around a doorway instead of falling on the people below.' },
    { id: 'trial_mirror', name: 'The Empty Margin', hero: 'nyx', minLevel: 9,
      requires: { chapterAtLeast: 4 }, suggestedParty: ['nyx', 'ilex', 'soren'],
      enemies: ['trial_mirror_self'], xp: 300, gold: 180,
      rule: 'The reflection borrows short guard and haste effects. Use the gaps between them, and follow each new weakness.',
      lesson: 'Nyx earns Unwrite here. Afterward it can remove guard, haste, and regeneration before its own strike.',
      victory: 'Nyx leaves one margin blank. The reflection has room to make its own mistake.' },
    { id: 'trial_choir', name: 'Room in the Choir', hero: 'soren', minLevel: 9,
      requires: { chapterAtLeast: 4 }, suggestedParty: ['soren', 'mira', 'brann'],
      enemies: ['trial_choir_keeper', 'trial_high_voice', 'trial_low_voice'], xp: 300, gold: 180,
      rule: 'Two voices attack while the keeper heals. Group attacks weaken the choir; interrupt the healing song before it restores them.',
      lesson: 'A break cancels support and healing actions as well as attacks. Each enemy keeps a separate pressure meter.',
      victory: 'Soren stops singing over the other voices. A quiet answer reaches him from the back of the room.' },
    { id: 'trial_storm', name: 'A Way to Ground', hero: 'vale', minLevel: 11,
      requires: { chapterAtLeast: 4 }, suggestedParty: ['vale', 'soren', 'ilex'],
      enemies: ['trial_storm_return'], xp: 380, gold: 220,
      rule: 'The signal hastens itself before a heavy charge. Earth and water create pressure; keep healing or guard ready for a charge you cannot stop.',
      lesson: 'A hit during casting adds eight pressure. After a break ends, recovery briefly blocks more pressure.',
      victory: 'Vale connects the return wire. The signal reaches its end and, for once, stops asking to be sent again.' },
    { id: 'trial_accord', name: 'Shelter for the Years', hero: 'ilex', minLevel: 14,
      requires: { chapterAtLeast: 7 }, suggestedParty: ['ilex', 'soren', 'brann'],
      enemies: ['trial_accord_keeper', 'trial_returning_ward'], xp: 500, gold: 300,
      rule: 'Defeat the ward, then watch the shelter change twice. Its long revival chant can return the ward unless you interrupt it.',
      lesson: 'All three phases use the same rules. Follow the visible weakness, plan for recovery, and keep enough power to heal.',
      victory: 'Ilex grows a door in the oldest wall. The shelter can hold people because it can let the next season in.' }
  ].map(trial => {
    const mastery = C.masteries.find(row => row.hero === trial.hero);
    const encounter = 'e_' + trial.id;
    const completeFlag = trial.id + '_done';
    const reward = `${C.heroes[trial.hero].name} learns ${C.skills[mastery.skill].name}.`;
    C.encounters[encounter] = { id: encounter, name: trial.name, trialId: trial.id,
      enemies: [...trial.enemies], boss: true, repeat: false, repeatable: true, scaleToParty: true,
      minLevel: trial.minLevel, recommendedLevel: trial.minLevel, requires: { ...trial.requires },
      xp: trial.xp, gold: trial.gold, loot: [{ id: 'ether', count: 1 }],
      intro: [trial.rule, trial.lesson], victory: [trial.victory, reward],
      effects: [flag(mastery.flag), flag(completeFlag)] };
    return { ...trial, encounter, completeFlag, masteryFlag: mastery.flag, reward };
  });

  // Encounter templates are never modified. Ordinary encounters keep their exact
  // stats; only an explicit scaleToParty encounter scales from its minimum level.
  D.encounterEnemies = function (value, partyLevel) {
    const encounter = typeof value === 'string' ? C.encounters[value] : value;
    if (!encounter) throw new Error(`Unknown encounter: ${String(value)}`);
    const baseLevel = Math.max(1, Math.floor(Number(encounter.minLevel || encounter.recommendedLevel) || 1));
    const supplied = Number(partyLevel);
    const level = Math.max(baseLevel, Number.isFinite(supplied) ? Math.floor(supplied) : baseLevel);
    const delta = encounter.scaleToParty ? level - baseLevel : 0;
    return encounter.enemies.map(value => {
      const source = typeof value === 'string' ? C.enemies[value] : value;
      if (!source) throw new Error(`Unknown enemy in ${encounter.id}: ${String(value)}`);
      const enemy = JSON.parse(JSON.stringify(source));
      if (encounter.scaleToParty) {
        enemy.level = level;
        enemy.maxHp = Math.round(enemy.maxHp * (1 + delta * 0.085));
        if (Number.isFinite(enemy.hp)) enemy.hp = Math.round(enemy.hp * (1 + delta * 0.085));
        enemy.atk = Math.round(enemy.atk + delta * 2.7);
        enemy.mag = Math.round(enemy.mag + delta * 2.7);
        enemy.def = Math.round(enemy.def + delta * 1.35);
      }
      return enemy;
    });
  };

  if (C.refreshCounts) {
    const refresh = C.refreshCounts;
    C.refreshCounts = function () {
      const counts = refresh();
      counts.masteries = C.masteries.length;
      counts.eliteTrials = C.eliteTrials.length;
      return counts;
    };
    C.refreshCounts();
  }
})();
