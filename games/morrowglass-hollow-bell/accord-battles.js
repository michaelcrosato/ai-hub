/* The Common Road. Original Level 18 encounters, registered with the public battle API. */
(function (root) {
  'use strict';
  const Battle = root.MorrowBattle;
  if (!Battle) throw new Error('Load battle.js before accord-battles.js.');
  const ids = [];
  const hit = (id, name, power, target = 'single', windup = 1.5, extra = {}) => ({ id, name, power, target, windup, ...extra });
  const counter = (actions, hits, counterHint) => ({ interrupt: { actions, hits }, counterHint });
  const status = (id, duration) => ({ status: { id, duration } });
  const foe = (id, name, kind, maxHp, atk, def, weakness, tint, pattern, extra = {}) => ({
    id, name, kind, visual: kind, maxHp, atk, def, weakness, tint, rate: .215, pattern, ...extra
  });
  function encounter(id, name, boss, crowns, ap, hint, enemies, extra = {}) {
    Battle.registerEncounter(id, { name, level: 18, boss, crowns, ap, xp: 1300 + (boss ? 200 : 0), hint, enemies, ...extra });
    ids.push(id);
  }

  encounter('accord-courier', 'The letter with no road', true, 620, 30,
    'Unpick the courier’s shell. Spark clears the moth. Two weapon hits break Return to Sender. Poison cannot defeat an ally; Clear Song removes it if learned.', [
      foe('sealed-courier', 'Sealed Courier', 'archive', 2850, 164, 35, 'wind', '#bca486', [
        hit('sealed-edge', 'Sealed Edge', 164, 'single', 2.2, status('poison', 12)),
        hit('return-to-sender', 'Return to Sender', 198, 'all', 7.4, counter(['attack', 'cleave', 'pierce', 'threadcut'], 2, 'Two Attack / Cleave / Pierce / Threadcut hits, or Bulwark'))
      ], { shell: true, loot: 'ether' }),
      foe('lost-address', 'Lost Address Moth', 'moth', 1040, 128, 22, 'light', '#d8ba91', [
        hit('letter-dust', 'Letter Dust', 128, 'single', 2.4, status('slow', 9))
      ], { rate: .185, loot: 'tonic' })
    ]);

  encounter('accord-echo', 'A voice beyond the echo', true, 650, 32,
    'The voice changes from frost to fire weakness. Unpick each new ward. Spark can break either song. Clear Song removes Slow and Poison after it is learned.', [
      foe('borrowed-voice', 'Borrowed Voice', 'astral', 4350, 170, 32, 'frost', '#b1c7d4', null, { loot: 'ether', phases: [
        { at: 1, name: 'A Song Repeated', weakness: 'frost', ward: true, shell: false, pattern: [
          hit('borrowed-note', 'Borrowed Note', 140, 'single', 2.2, { magical: true, ...status('slow', 12) }),
          hit('perfect-echo', 'Perfect Echo', 194, 'all', 6.4, { magical: true, heal: 160, ...counter(['spark', 'frost'], 1, 'Spark or Frost once, or Bulwark; the song also restores enemy HP') })
        ] },
        { at: .5, name: 'A Voice of Her Own', weakness: 'fire', ward: true, shell: false, tint: '#d9b2b6', rate: .23, pattern: [
          hit('unspoken-verse', 'Unspoken Verse', 213, 'all', 7.6, { magical: true, ...status('poison', 12), ...counter(['spark', 'flare'], 2, 'Two Spark / Flare casts, or Bulwark') }),
          hit('single-note', 'Single Note', 172, 'single', 1.7, { magical: true })
        ] }
      ] })
    ]);

  encounter('accord-oath', 'A promise made again', true, 680, 32,
    'Unpick the shell. Two weapon hits stop the first charge. Unpick stops the second. Bulwark covers one heavy strike; Interpose later protects against repeated hits.', [
      foe('oathbound-watch', 'Oathbound Watch', 'sentry', 4650, 184, 40, 'light', '#c1b0a5', null, { loot: 'feather', phases: [
        { at: 1, name: 'Stand Alone', weakness: 'light', shell: true, ward: false, pattern: [
          hit('alone-at-the-gate', 'Alone at the Gate', 192, 'single', 2),
          hit('unbroken-order', 'Unbroken Order', 216, 'all', 7.4, counter(['attack', 'cleave', 'pierce', 'threadcut'], 2, 'Two Attack / Cleave / Pierce / Threadcut hits, or Bulwark'))
        ] },
        { at: .5, name: 'Stand Beside', weakness: 'frost', shell: false, ward: true, rate: .235, tint: '#bac8c7', pattern: [
          hit('weight-of-an-oath', 'Weight of an Oath', 238, 'all', 6.4, { magical: true, ...counter(['steal'], 1, 'Unpick once, or Bulwark') }),
          hit('shared-burden', 'Shared Burden', 134, 'all', 2.4)
        ] }
      ] })
    ]);

  encounter('accord-bridge', 'A bridge for both banks', false, 570, 28,
    'These enemies have different weaknesses. Unpick the toll guard, then focus one foe. Cleave breaks Crossed Roots and can help break the toll charge.', [
      foe('toll-watch', 'Old Toll Watch', 'sentry', 1800, 158, 36, 'frost', '#b5afa0', [
        hit('toll-hammer', 'Toll Hammer', 158),
        hit('last-toll', 'The Last Toll', 155, 'all', 7.2, counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark'))
      ], { shell: true, loot: 'ether', rate: .20 }),
      foe('crossed-root', 'Crossed Root', 'root', 1530, 144, 29, 'fire', '#aabc8d', [
        hit('bank-rake', 'Bank Rake', 144), hit('crossed-roots', 'Crossed Roots', 118, 'all', 5.7, counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark'))
      ], { loot: 'tonic', rate: .19 }),
      foe('bridge-moth', 'Bridge Lantern Moth', 'moth', 900, 118, 20, 'light', '#ddce9d', [hit('bridge-dust', 'Bridge Dust', 118)], { loot: 'tonic', rate: .17 })
    ]);

  encounter('accord-tide', 'The harbor that held its breath', true, 730, 34,
    'Unpick the shell. Cleave or Knife Gust breaks Held Breath. At half HP, its weakness changes to frost. Two Spark or Frost casts break Undertow.', [
      foe('harbor-keeper', 'Harbor Keeper', 'leviathan', 4950, 176, 36, 'wind', '#8cc2c7', null, { loot: 'ether', phases: [
        { at: 1, name: 'The Water Waits', weakness: 'wind', shell: true, ward: false, pattern: [
          hit('salt-bite', 'Salt Bite', 176, 'single', 2.1, status('poison', 12)),
          hit('held-breath', 'Held Breath', 232, 'all', 6.7, { magical: true, ...counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark') })
        ] },
        { at: .5, name: 'The Harbor Opens', weakness: 'frost', shell: false, ward: false, tint: '#abd8cf', rate: .23, pattern: [
          hit('common-undertow', 'Undertow', 254, 'all', 8.2, { magical: true, ...status('slow', 10), ...counter(['spark', 'frost'], 2, 'Two Spark / Frost casts, or Bulwark') }),
          hit('open-water', 'Open Water', 146, 'all', 2.5, { magical: true })
        ] }
      ] })
    ]);

  encounter('accord-garden', 'The garden after rain', true, 740, 34,
    'Spark clears the moth. Fire is strong against the root. Spark or Flare stops Bitter Harvest before it heals. Clear Song removes Poison; Clarity shortens it.', [
      foe('rain-root', 'Rain Root', 'root', 3920, 168, 34, 'fire', '#a6b891', [
        hit('bitter-pollen', 'Bitter Pollen', 115, 'all', 3.1, { magical: true, ...status('poison', 12) }),
        hit('bitter-harvest', 'Bitter Harvest', 205, 'all', 6.8, { heal: 220, ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark; the charge also restores enemy HP') }),
        hit('heavy-bough', 'Heavy Bough', 176)
      ], { loot: 'tonic', rate: .21 }),
      foe('rain-moth', 'Rain Lantern Moth', 'moth', 1120, 126, 23, 'light', '#cad6a0', [
        hit('rain-wing', 'Rain Wing', 126, 'single', 2.3, status('slow', 8))
      ], { loot: 'ether', rate: .18 })
    ]);

  encounter('accord-chorus', 'The Unfinished Chorus', true, 1250, 42,
    'Read the current weakness and Unpick each new protection. Each charge has a base-action counter. New party skills help with repeated damage, Poison, and exposed targets. Concord can heal a damaged party.', [
      foe('accord-chorus', 'The Unfinished Chorus', 'astral', 7100, 184, 39, 'light', '#d5c7a5', null, { visual: 'accord-chorus', loot: 'ether', rate: .22, phases: [
        { at: 1, name: 'One Voice for Every Road', weakness: 'light', ward: true, shell: false, pattern: [
          hit('one-true-road', 'One True Road', 241, 'all', 7.8, { magical: true, ...counter(['attack', 'cleave', 'pierce', 'threadcut'], 2, 'Two Attack / Cleave / Pierce / Threadcut hits, or Bulwark') }),
          hit('borrowed-word', 'Borrowed Word', 184, 'single', 2.1, status('slow', 9))
        ] },
        { at: .67, name: 'Every Voice at Once', weakness: 'frost', ward: false, shell: true, tint: '#aec8d6', rate: .23, pattern: [
          hit('names-in-the-rain', 'Names in the Rain', 270, 'all', 8.4, { magical: true, ...status('poison', 12), ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }),
          hit('overlapping-lines', 'Overlapping Lines', 154, 'all', 2.6, { magical: true })
        ] },
        { at: .34, name: 'Room for Another Voice', weakness: 'wind', ward: false, shell: false, tint: '#e5d7b3', rate: .245, pattern: [
          hit('a-road-between', 'A Road Between', 304, 'all', 7.7, { magical: true, ...counter(['steal', 'gust'], 1, 'Unpick or Knife Gust once, or Bulwark') }),
          hit('open-refrain', 'Open Refrain', 171, 'all', 2.6, { magical: true })
        ] }
      ] })
    ]);

  encounter('accord-afterglow', 'The light after the song', true, 1550, 48,
    'An optional hard test. Bring supplies and read each charge. Its weakness changes from fire to wind to light. Poison cannot defeat an ally, but makes the next strike dangerous. Guard, Bulwark, or Interpose can protect the party.', [
      foe('afterglow', 'The Afterglow', 'astral', 8550, 203, 42, 'fire', '#dcadab', null, { loot: 'feather', rate: .235, phases: [
        { at: 1, name: 'The Note That Remained', weakness: 'fire', ward: true, shell: false, pattern: [
          hit('lingering-light', 'Lingering Light', 274, 'all', 7.6, { magical: true, ...counter(['spark', 'flare'], 2, 'Two Spark / Flare casts, or Bulwark') }),
          hit('rose-ember', 'Rose Ember', 203, 'single', 2, { magical: true, ...status('poison', 12) })
        ] },
        { at: .67, name: 'A Silence That Can Listen', weakness: 'wind', ward: false, shell: true, tint: '#bdd0c3', rate: .245, pattern: [
          hit('listening-silence', 'Listening Silence', 308, 'all', 7.5, { magical: true, ...status('slow', 12), ...counter(['steal', 'gust'], 1, 'Unpick or Knife Gust once, or Bulwark') }),
          hit('space-between-notes', 'Space Between Notes', 184, 'all', 2.5, { magical: true })
        ] },
        { at: .34, name: 'Begin Again', weakness: 'light', ward: true, shell: false, tint: '#e7d8ba', rate: .26, pattern: [
          hit('first-light-again', 'First Light Again', 345, 'all', 8.1, { magical: true, ...counter(['attack', 'cleave', 'pierce', 'threadcut'], 2, 'Two Attack / Cleave / Pierce / Threadcut hits, or Bulwark') }),
          hit('warm-horizon', 'Warm Horizon', 190, 'all', 2.6, { magical: true, ...status('poison', 9) })
        ] }
      ] })
    ]);

  encounter('accord-trial-gale', 'Trial of Gale', true, 520, 30,
    'A repeatable test of target choice. Spark clears the moth. Cleave stops Crosswind, and Unpick stops Closed Sky. Wind is strong against the chart keeper.', [
      foe('gale-chart', 'Gale Chart Keeper', 'archive', 2210, 158, 33, 'wind', '#a5c5c0', [
        hit('closed-sky', 'Closed Sky', 172, 'all', 6.8, { magical: true, ...counter(['steal'], 1, 'Unpick once, or Bulwark') }), hit('cutting-margin', 'Cutting Margin', 158)
      ], { ward: true, loot: 'ether', rate: .20 }),
      foe('gale-runner', 'Gale Runner', 'beast', 1860, 152, 31, 'fire', '#c5b697', [
        hit('crosswind', 'Crosswind', 149, 'all', 6, counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark')), hit('wind-fang', 'Wind Fang', 152)
      ], { loot: 'tonic', rate: .195 }),
      foe('gale-moth', 'Gale Lantern Moth', 'moth', 1120, 127, 22, 'light', '#dce0b6', [hit('gale-dust', 'Gale Dust', 127, 'single', 2.4, status('slow', 9))], { loot: 'ether', rate: .175 })
    ], { repeatable: true });

  encounter('accord-trial-tide', 'Trial of Tide', true, 580, 32,
    'A repeatable test of protection. Unpick the maw and clear the small keeper first. Two weapon hits stop Pressure Line. Cleave stops Ink Tide. Clear Song removes Poison if learned.', [
      foe('tide-pressure', 'Pressure Maw', 'leviathan', 4030, 182, 38, 'frost', '#8fbec9', [
        hit('pressure-line', 'Pressure Line', 237, 'all', 7.4, { magical: true, ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') }),
        hit('deep-bite', 'Deep Bite', 182, 'single', 2, status('poison', 12))
      ], { shell: true, loot: 'ether', rate: .215 }),
      foe('tide-ink', 'Tide Ink Keeper', 'archive', 1780, 146, 29, 'wind', '#a9c6c1', [
        hit('ink-tide', 'Ink Tide', 149, 'all', 6.2, { magical: true, ...status('slow', 9), ...counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark') }),
        hit('ink-line', 'Ink Line', 146)
      ], { loot: 'tonic', rate: .19 })
    ], { repeatable: true });

  encounter('accord-trial-root', 'Trial of Root', true, 660, 36,
    'A repeatable three-phase test. Fire, frost, and light are strong in turn. Stop Seed Measure before it heals. Every charge accepts a base action. Crests and party skills help with the long battle.', [
      foe('root-measure', 'Root Measure', 'root', 7600, 191, 40, 'fire', '#b9bb91', null, { loot: 'ether', rate: .225, phases: [
        { at: 1, name: 'Seed', weakness: 'fire', shell: true, ward: false, pattern: [
          hit('seed-measure', 'Seed Measure', 238, 'all', 6.8, { heal: 260, ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark; the charge also restores enemy HP') }),
          hit('measured-root', 'Measured Root', 191, 'single', 2.2, status('poison', 12))
        ] },
        { at: .67, name: 'Shelter', weakness: 'frost', shell: false, ward: true, tint: '#a9c6c2', rate: .235, pattern: [
          hit('shelter-measure', 'Shelter Measure', 275, 'all', 7.8, { magical: true, ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') }),
          hit('slow-growth', 'Slow Growth', 151, 'all', 2.6, { magical: true, ...status('slow', 9) })
        ] },
        { at: .34, name: 'Road', weakness: 'light', shell: false, ward: false, tint: '#d6c694', rate: .25, pattern: [
          hit('road-measure', 'Road Measure', 302, 'all', 6.8, { magical: true, ...counter(['steal'], 1, 'Unpick once, or Bulwark') }),
          hit('shared-ground', 'Shared Ground', 169, 'all', 2.4)
        ] }
      ] })
    ], { repeatable: true });

  const trials = ids.filter(id => id.startsWith('accord-trial-'));
  const api = Object.freeze({ ids: Object.freeze(ids), finite: Object.freeze(ids.filter(id => !trials.includes(id))), trials: Object.freeze(trials) });
  root.MorrowAccordBattles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
