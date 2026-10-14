/* The Unwritten Tide: original encounter data registered through the public battle API. */
(function (root) {
  'use strict';
  const Battle = root.MorrowBattle;
  if (!Battle) throw new Error('Load battle.js before tide-battles.js.');
  const ids = [];
  const hit = (id, name, power, target = 'single', windup = 1.3, extra = {}) => ({ id, name, power, target, windup, ...extra });
  const counter = (actions, hits, counterHint) => ({ interrupt: { actions, hits }, counterHint });
  const foe = (id, name, kind, maxHp, atk, def, weakness, tint, pattern, extra = {}) => ({
    id, name, kind, visual: kind, maxHp, atk, def, weakness, tint, rate: .195, pattern, ...extra
  });
  function encounter(id, name, level, boss, crowns, ap, hint, enemies) {
    Battle.registerEncounter(id, { name, level, boss, crowns, ap, xp: level * 60 + (boss ? 100 : 0), hint, enemies });
    ids.push(id);
  }

  encounter('rainweald-pack', 'The families in the rain', 9, false, 210, 14,
    'Spark clears the rain moth. Frost slows the Mire Hound. Cleave breaks its broad attack.', [
      foe('mire-hound', 'Mire Hound', 'beast', 470, 74, 18, 'frost', '#769c91', [
        hit('reed-fang', 'Reed Fang', 74),
        hit('rain-shake', 'Rain Shake', 60, 'all', 4.8, counter(['cleave'], 1, 'Cleave once, or Bulwark'))
      ], { loot: 'tonic' }),
      foe('rain-moth', 'Rain Lantern Moth', 'moth', 350, 61, 13, 'light', '#a9cace', [
        hit('wet-wing', 'Wet Wing', 61), hit('mist-scatter', 'Mist Scatter', 38, 'all', 3.4, { magical: true })
      ], { rate: .18, loot: 'ether' })
    ]);

  encounter('lockjaw-engine', 'The gate that forgot the river', 9, true, 310, 18,
    'Unpick the shell. Frost is strong here. Two Attack or Cleave hits stop Sluice Surge. Bulwark also protects the party.', [
      foe('lockjaw-engine', 'Lockjaw Engine', 'leviathan', 1550, 89, 24, 'frost', '#b6a775', [
        hit('chain-bite', 'Chain Bite', 89),
        hit('sluice-surge', 'Sluice Surge', 115, 'all', 6.6, { magical: true,
          ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') })
      ], { shell: true, rate: .2, loot: 'ether' })
    ]);

  encounter('palewind-roost', 'The stolen messages', 9, false, 235, 16,
    'Unpick the kite’s ward. Knife Gust strikes both foes. Spark is strong against the paper moth.', [
      foe('palewind-kite', 'Palewind Kite', 'astral', 550, 76, 16, 'wind', '#c5b9d8', [
        hit('envelope-cut', 'Envelope Cut', 76),
        hit('lost-post', 'Lost Post', 65, 'all', 5.3, { magical: true,
          ...counter(['steal'], 1, 'Unpick once, or Bulwark') })
      ], { ward: true, loot: 'ether' }),
      foe('paper-moth', 'Paper Moth', 'moth', 390, 65, 12, 'light', '#e2d5b2', [
        hit('folded-wing', 'Folded Wing', 65), hit('loose-pages', 'Loose Pages', 40, 'all', 3.8)
      ], { rate: .18, loot: 'tonic' })
    ]);

  encounter('stormloom-gate', 'The watch above the cloud', 10, false, 290, 20,
    'The clerk is weak to frost. The sentry is weak to light. Read their separate charge hints and focus on one foe.', [
      foe('forecast-clerk', 'Forecast Clerk', 'archive', 680, 83, 20, 'frost', '#9fc3cd', [
        hit('forecast-cut', 'Forecast Cut', 83),
        hit('sealed-forecast', 'Sealed Forecast', 78, 'all', 5.6, { magical: true,
          ...counter(['spark', 'frost'], 1, 'Spark or Frost once, or Bulwark') })
      ], { ward: true, rate: .2, loot: 'ether' }),
      foe('loom-sentry', 'Loom Sentry', 'sentry', 720, 86, 22, 'light', '#c6ae84', [
        hit('loom-hammer', 'Loom Hammer', 86),
        hit('shuttle-sweep', 'Shuttle Sweep', 80, 'all', 5.8,
          counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark'))
      ], { shell: true, rate: .185, loot: 'tonic' })
    ]);

  encounter('weather-heart', 'The Weather Heart', 11, true, 650, 32,
    'Each phase has a new charge. Unpick its protection. Every charge has a base action counter. Guard and Bulwark reduce the hit.', [
      foe('weather-heart', 'The Weather Heart', 'archive', 2400, 104, 24, 'light', '#d0c6a5', null, {
        visual: 'weather-heart', rate: .2, loot: 'ether', phases: [
          { at: 1, name: 'The Held Sky', weakness: 'light', ward: true, shell: false,
            pattern: [
              hit('close-the-sky', 'Close the Sky', 118, 'all', 6.8, { magical: true,
                ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }),
              hit('pressure-hand', 'Pressure Hand', 103)
            ] },
          { at: .67, name: 'The Rain Debt', weakness: 'frost', ward: false, shell: true, tint: '#8fbdcd',
            pattern: [
              hit('borrowed-storm', 'Borrowed Storm', 158, 'all', 8.4, { magical: true,
                ...counter(['spark', 'frost'], 2, 'Two Spark / Frost casts, or Bulwark') }),
              hit('drought-clamp', 'Drought Clamp', 115)
            ] },
          { at: .34, name: 'The Open Window', weakness: 'wind', ward: false, shell: false, tint: '#e5c894', rate: .225,
            pattern: [
              hit('endless-forecast', 'Endless Forecast', 184, 'all', 8, { magical: true,
                ...counter(['attack', 'gust', 'cleave', 'pierce'], 2, 'Two Attack / Knife Gust / Cleave / Silver Pierce hits, or Bulwark') }),
              hit('rain-hammer', 'Rain Hammer', 105, 'all', 2.1, { magical: true })
            ] }
        ]
      })
    ]);

  encounter('returning-letter', 'The letter that would not land', 9, false, 225, 16,
    'The moths shelter a lost address. Spark and broad attacks clear them. Bulwark stops most of the paper cuts.', [
      foe('address-moth', 'Address Moth', 'moth', 340, 59, 12, 'light', '#d4c597', [
        hit('address-dart', 'Address Dart', 59)
      ], { rate: .18, loot: 'tonic' }),
      foe('postmark-moth', 'Postmark Moth', 'moth', 365, 64, 13, 'light', '#a7cbbd', [
        hit('postmark-cut', 'Postmark Cut', 64),
        hit('paper-rain', 'Paper Rain', 41, 'all', 4.8,
          counter(['cleave'], 1, 'Cleave once, or Bulwark'))
      ], { rate: .19, loot: 'ether' }),
      foe('return-moth', 'Return Moth', 'moth', 390, 66, 14, 'light', '#c6b7d1', [
        hit('return-to-sender', 'Return to Sender', 66)
      ], { rate: .16, loot: 'feather' })
    ]);

  encounter('glassback', 'The Glassback below the sluice', 10, true, 380, 24,
    'Unpick its shell and the ward in phase two. Its weakness changes from light to frost. Two weapon hits break Glass Flood.', [
      foe('glassback', 'Glassback', 'leviathan', 1920, 96, 28, 'light', '#7fc6c5', null, {
        rate: .205, loot: 'feather', phases: [
          { at: 1, name: 'The Glass Shell', weakness: 'light', shell: true, ward: false,
            pattern: [hit('glass-bite', 'Glass Bite', 96),
              hit('glass-flood', 'Glass Flood', 122, 'all', 7, { magical: true,
                ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') })] },
          { at: .5, name: 'The River Within', weakness: 'frost', shell: false, ward: true, tint: '#aacbdd', rate: .22,
            pattern: [hit('river-memory', 'River Memory', 137, 'all', 6.5, { magical: true,
              ...counter(['steal'], 1, 'Unpick once, or Bulwark') }), hit('current-fang', 'Current Fang', 102)] }
        ]
      })
    ]);

  encounter('lastlight-warden', 'The Lastlight Warden', 12, true, 720, 36,
    'Unpick each new protection. The warden tests three answers: Unpick, two weapon hits, then two spells. Use Bulwark if the charge cannot be stopped.', [
      foe('lastlight-warden', 'Lastlight Warden', 'astral', 2860, 114, 26, 'frost', '#c8b3de', null, {
        rate: .215, loot: 'ether', phases: [
          { at: 1, name: 'The Lamp at Dusk', weakness: 'frost', ward: true, shell: false,
            pattern: [hit('last-light', 'Last Light', 142, 'all', 6.4, { magical: true,
              ...counter(['steal', 'pierce'], 1, 'Unpick or Silver Pierce once, or Bulwark') }), hit('dusk-lance', 'Dusk Lance', 109)] },
          { at: .67, name: 'The Measure of Night', weakness: 'fire', ward: false, shell: true, tint: '#8e9fc8',
            pattern: [hit('measure-of-night', 'Measure of Night', 169, 'all', 7.6, { magical: true,
              ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }), hit('night-lance', 'Night Lance', 121)] },
          { at: .34, name: 'The First Horizon', weakness: 'light', ward: false, shell: false, tint: '#e7ce98', rate: .24,
            pattern: [hit('horizon-break', 'Horizon Break', 205, 'all', 8.8, { magical: true,
              ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }),
              hit('afterglow', 'Afterglow', 116, 'all', 2.2, { magical: true })] }
        ]
      })
    ]);

  encounter('trial-squall', 'Weather Trial I · Squall', 10, true, 110, 10,
    'Three foes test target choice. Unpick the kite. Spark clears the moth. Cleave reaches every foe.', [
      foe('trial-root', 'Squall Root', 'root', 480, 78, 18, 'fire', '#adc894', [
        hit('trial-root-rake', 'Rainroot Rake', 78), hit('trial-pollen', 'Pollen Squall', 48, 'all', 4.4,
          counter(['spark', 'cleave'], 1, 'Spark or Cleave once, or Bulwark'))
      ], { loot: 'tonic' }),
      foe('trial-kite', 'Squall Kite', 'astral', 490, 75, 17, 'wind', '#bda7d6', [hit('trial-kite-cut', 'Wind Cut', 75)],
        { ward: true, rate: .18, loot: 'ether' }),
      foe('trial-rain-moth', 'Squall Moth', 'moth', 350, 64, 13, 'light', '#d3d0a4', [hit('trial-wing-cut', 'Wing Cut', 64)],
        { rate: .17, loot: 'tonic' })
    ]);

  encounter('trial-downpour', 'Weather Trial II · Downpour', 11, true, 150, 12,
    'Two guards have different defenses. Unpick both. Frost slows the engine. Spark breaks the diver’s broad charge.', [
      foe('trial-diver', 'Downpour Diver', 'leviathan', 1020, 90, 22, 'light', '#8dbcc2', [
        hit('trial-current-bite', 'Current Bite', 90),
        hit('trial-river-rise', 'River Rise', 106, 'all', 6, { magical: true,
          ...counter(['spark'], 1, 'Spark once, or Bulwark') })
      ], { shell: true, rate: .205, loot: 'feather' }),
      foe('trial-engine', 'Downpour Engine', 'sentry', 940, 96, 24, 'frost', '#bfac83', [
        hit('trial-flood-hammer', 'Flood Hammer', 96),
        hit('trial-sluice-cut', 'Sluice Cut', 88, 'all', 5.8,
          counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark'))
      ], { ward: true, rate: .185, loot: 'ether' })
    ]);

  encounter('trial-horizon', 'Weather Trial III · Horizon', 12, true, 210, 16,
    'The last trial changes at half health. Unpick its ward. Two base actions can break either broad charge.', [
      foe('trial-horizon', 'Horizon Echo', 'astral', 2500, 110, 24, 'frost', '#bba8d5', null, {
        rate: .21, loot: 'ether', phases: [
          { at: 1, name: 'The Closed Horizon', weakness: 'frost', ward: true, shell: false,
            pattern: [hit('trial-distant-thunder', 'Distant Thunder', 150, 'all', 8, { magical: true,
              ...counter(['spark', 'frost'], 2, 'Two Spark / Frost casts, or Bulwark') }), hit('trial-night-cut', 'Night Cut', 108)] },
          { at: .5, name: 'The Open Horizon', weakness: 'wind', ward: false, shell: false, tint: '#e4ce9e', rate: .235,
            pattern: [hit('trial-first-rain', 'First Rain', 180, 'all', 7.8, { magical: true,
              ...counter(['attack', 'gust', 'cleave'], 2, 'Two Attack / Knife Gust / Cleave hits, or Bulwark') }),
              hit('trial-daybreak', 'Daybreak', 110, 'all', 2.2, { magical: true })] }
        ]
      })
    ]);

  const api = Object.freeze({ ids: Object.freeze(ids) });
  root.MorrowTideBattles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
