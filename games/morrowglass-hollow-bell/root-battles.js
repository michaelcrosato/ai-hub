/* The Rootbound Atlas. Original encounter data, registered through the public battle API. */
(function (root) {
  'use strict';
  const Battle = root.MorrowBattle;
  if (!Battle) throw new Error('Load battle.js before root-battles.js.');
  const ids = [];
  const hit = (id, name, power, target = 'single', windup = 1.4, extra = {}) => ({ id, name, power, target, windup, ...extra });
  const counter = (actions, hits, counterHint) => ({ interrupt: { actions, hits }, counterHint });
  const slow = duration => ({ status: { id: 'slow', duration } });
  const foe = (id, name, kind, maxHp, atk, def, weakness, tint, pattern, extra = {}) => ({
    id, name, kind, visual: kind, maxHp, atk, def, weakness, tint, rate: .205, pattern, ...extra
  });
  const anchor = {
    copper: { id: 'copper-drain', hp: .85, damage: .85, shell: false, text: 'The repaired drain removes the shell. Copper Warden HP and damage fall 15%.' },
    archive: { id: 'archive-index', hp: .88, damage: .92, ward: false, text: 'The restored index removes the ward. Archive Keeper HP falls 12%; damage falls 8%.' },
    west: { id: 'crown-west', hp: .88, text: 'The west anchor is secure. Enemy maximum HP falls 12%.' },
    east: { id: 'crown-east', damage: .85, text: 'The east anchor is secure. Enemy damage falls 15%.' }
  };
  function encounter(id, name, level, boss, crowns, ap, hint, enemies, extra = {}) {
    Battle.registerEncounter(id, { name, level, boss, crowns, ap, xp: level * 65 + (boss ? 120 : 0), hint, enemies, ...extra });
    ids.push(id);
  }

  encounter('root-vermin', 'The roots across the road', 13, false, 290, 20,
    'Clear the moth with Spark. Fire is strong against the roots. Cleave reaches all three foes. Clear the roots. Concord becomes available after this mission.', [
      foe('root-gnawer', 'Root Gnawer', 'beast', 650, 108, 24, 'fire', '#baa676', [hit('root-fang', 'Root Fang', 108)], { loot: 'tonic', rate: .195 }),
      foe('root-vine', 'Road Vine', 'root', 740, 113, 25, 'fire', '#9cb283', [hit('road-rake', 'Road Rake', 113),
        hit('bramble-roll', 'Bramble Roll', 80, 'all', 5, counter(['cleave'], 1, 'Cleave once, or Bulwark'))], { loot: 'ether' }),
      foe('root-lamp', 'Root Lantern Moth', 'moth', 510, 91, 17, 'light', '#d9c992', [hit('root-lamp-cut', 'Lamp Cut', 91)], { rate: .175, loot: 'tonic' })
    ]);

  encounter('copper-sluice', 'The stopped aqueduct', 13, false, 320, 22,
    'Unpick the worker’s shell. Frost is strong against both sentries. Two weapon hits stop a Pipe Burst.', [
      foe('copper-worker', 'Copper Worker', 'sentry', 1040, 122, 29, 'frost', '#c6986d', [hit('pipe-hammer', 'Pipe Hammer', 122),
        hit('pipe-burst', 'Pipe Burst', 110, 'all', 6.6, counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark'))], { shell: true, loot: 'ether' }),
      foe('sluice-clerk', 'Sluice Clerk', 'archive', 900, 112, 25, 'frost', '#a8bbb0', [hit('water-debit', 'Water Debit', 112),
        hit('silt-seal', 'Silt Seal', 74, 'all', 4.2, { magical: true, ...slow(8) })], { rate: .19, loot: 'tonic' })
    ]);

  encounter('copper-warden', 'The Copper Warden', 14, true, 530, 28,
    'Repair the drain to weaken this fight. Unpick the shell. Its weak element changes from frost to light. Spark stops the second phase charge.', [
      foe('copper-warden', 'Copper Warden', 'sentry', 3400, 137, 34, 'frost', '#d4aa77', null, { rate: .21, loot: 'ether', phases: [
        { at: 1, name: 'The Full Reservoir', weakness: 'frost', shell: true, ward: false,
          pattern: [hit('reservoir-blow', 'Reservoir Blow', 137), hit('overflow-order', 'Overflow Order', 170, 'all', 7,
            { magical: true, ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') })] },
        { at: .5, name: 'The Dry Measure', weakness: 'light', shell: true, ward: false, tint: '#d4c192', rate: .23,
          pattern: [hit('dry-measure', 'Dry Measure', 185, 'all', 6.2,
            { magical: true, ...counter(['spark'], 1, 'Spark once, or Bulwark') }), hit('copper-grip', 'Copper Grip', 151)] }
      ] })
    ], { anchorEffects: [anchor.copper] });

  encounter('archive-ink', 'The names in the ink', 14, false, 345, 24,
    'Ink Seal slows a target. Clarity cuts the duration. Spark clears the moth. Focus the two keepers one at a time.', [
      foe('ink-novice', 'Ink Novice', 'archive', 850, 115, 28, 'wind', '#92a8c2', [hit('name-cut', 'Name Cut', 115),
        hit('wet-ink', 'Wet Ink', 112, 'single', 2.6, { magical: true, ...slow(10) })], { ward: true, loot: 'ether' }),
      foe('ink-binder', 'Ink Binder', 'archive', 970, 123, 29, 'frost', '#b5b4cd', [hit('spine-blow', 'Spine Blow', 123),
        hit('closed-book', 'Closed Book', 102, 'all', 5.2,
          { magical: true, ...counter(['steal'], 1, 'Unpick once, or Bulwark') })], { rate: .19, loot: 'tonic' }),
      foe('ink-moth', 'Blotted Moth', 'moth', 520, 93, 19, 'light', '#c1a9b8', [hit('ink-wing', 'Ink Wing', 93)], { rate: .17, loot: 'ether' })
    ]);

  encounter('archive-keeper', 'The Keeper of Unsent Names', 15, true, 590, 30,
    'Restore the index to remove the wards. Two spells break Redaction. In phase two, Unpick breaks its slow attack.', [
      foe('archive-keeper', 'Keeper of Unsent Names', 'archive', 3800, 145, 32, 'light', '#a4bfc2', null, { rate: .21, loot: 'ether', phases: [
        { at: 1, name: 'Every Name Is Kept', weakness: 'light', ward: true, shell: false,
          pattern: [hit('redaction', 'Redaction', 180, 'all', 7.8, { magical: true,
            ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }), hit('margin-hook', 'Margin Hook', 145)] },
        { at: .5, name: 'A Name May Leave', weakness: 'wind', ward: true, shell: false, tint: '#cebbaa', rate: .23,
          pattern: [hit('last-redaction', 'Last Redaction', 198, 'all', 6.4, { magical: true, ...slow(10),
            ...counter(['steal'], 1, 'Unpick once, or Bulwark') }), hit('binding-line', 'Binding Line', 143)] }
      ] })
    ], { anchorEffects: [anchor.archive] });

  encounter('stair-watch', 'The watch on the moving stair', 15, false, 370, 26,
    'One guard fears fire; the other fears light. Unpick their protection. Guard or Bulwark covers attacks that you cannot break.', [
      foe('stair-cold', 'Cold Step Guard', 'sentry', 1300, 131, 32, 'fire', '#a8c1d4', [hit('cold-step', 'Cold Step', 131),
        hit('missing-step', 'Missing Step', 135, 'all', 5.6,
          counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark'))], { shell: true, loot: 'tonic' }),
      foe('stair-bright', 'Bright Step Guard', 'astral', 1170, 127, 27, 'light', '#d5bd91', [hit('bright-step', 'Bright Step', 127),
        hit('false-landing', 'False Landing', 117, 'single', 3.3, { magical: true, ...slow(8) })], { ward: true, rate: .195, loot: 'ether' })
    ]);

  encounter('stair-mirror', 'The Mirror at the Last Step', 15, true, 570, 30,
    'The mirror changes its weakness and protection at half HP. Two base weapon hits break Reflected Fall. Save Concord for its open phase.', [
      foe('stair-mirror', 'Last Step Mirror', 'astral', 3700, 142, 31, 'frost', '#b9b0d5', null, { rate: .215, loot: 'feather', phases: [
        { at: 1, name: 'The Step You Took', weakness: 'frost', ward: true, shell: false,
          pattern: [hit('reflected-fall', 'Reflected Fall', 186, 'all', 7.2, { magical: true,
            ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }), hit('silver-edge', 'Silver Edge', 142)] },
        { at: .5, name: 'The Step You Choose', weakness: 'fire', ward: false, shell: true, tint: '#d9b294', rate: .235,
          pattern: [hit('unmade-path', 'Unmade Path', 199, 'all', 6.7, { magical: true,
            ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark') }), hit('mirror-lance', 'Mirror Lance', 155)] }
      ] })
    ]);

  encounter('crown-thorns', 'The crown of thorns', 16, false, 390, 28,
    'Fire burns the great thorn. Cleave stops its roots. Spark is strong against the moths, whose cuts can slow the party.', [
      foe('crown-root', 'Crown Thorn', 'root', 1430, 136, 33, 'fire', '#a7b786', [hit('crown-rake', 'Crown Rake', 136),
        hit('root-braid', 'Root Braid', 132, 'all', 5.8,
          counter(['cleave'], 1, 'Cleave once, or Bulwark'))], { loot: 'tonic', rate: .21 }),
      foe('crown-moth-a', 'Gold Dust Moth', 'moth', 720, 107, 20, 'light', '#d7c18a', [hit('gold-dust', 'Gold Dust', 107, 'single', 2, slow(8))], { rate: .18, loot: 'ether' }),
      foe('crown-moth-b', 'Pale Dust Moth', 'moth', 670, 103, 19, 'light', '#c4cbb3', [hit('pale-dust', 'Pale Dust', 103)], { rate: .17, loot: 'tonic' })
    ]);

  encounter('crown-sentinel', 'The Sentinel of the Crown', 16, true, 630, 32,
    'Release the west crown anchor before this battle. Unpick the shell. Two weapon hits stop Bridge of Thorns. Spark deals extra damage.', [
      foe('crown-sentinel', 'Crown Sentinel', 'root', 4020, 153, 36, 'light', '#bcbb89', [hit('living-pillar', 'Living Pillar', 153),
        hit('bridge-of-thorns', 'Bridge of Thorns', 217, 'all', 7.6, { magical: true,
          ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') }),
        hit('weight-of-roots', 'Weight of Roots', 120, 'all', 2.5)], { shell: true, rate: .225, loot: 'ether' })
    ], { anchorEffects: [anchor.west, anchor.east] });

  encounter('atlas-heart', 'The Rootbound Atlas', 17, true, 940, 42,
    'Secure both crown anchors. Read each phase and Unpick each new protection. All charges have base counters. Concord can turn a hard phase.', [
      foe('atlas-heart', 'The Rootbound Atlas', 'root', 5200, 164, 38, 'light', '#cabd8a', null, { visual: 'atlas-heart', rate: .22, loot: 'ether', phases: [
        { at: 1, name: 'Every Road Is Written', weakness: 'light', ward: true, shell: false,
          pattern: [hit('fixed-horizon', 'Fixed Horizon', 216, 'all', 7.8, { magical: true,
            ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') }), hit('mapped-fist', 'Mapped Fist', 164)] },
        { at: .67, name: 'The Weight of Every Choice', weakness: 'frost', ward: false, shell: true, tint: '#9ebfc3',
          pattern: [hit('rootbound-decree', 'Rootbound Decree', 247, 'all', 8.4, { magical: true, ...slow(8),
            ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }), hit('branch-clamp', 'Branch Clamp', 174)] },
        { at: .34, name: 'A Road Beyond the Map', weakness: 'wind', ward: false, shell: false, tint: '#e0c995', rate: .24,
          pattern: [hit('final-border', 'Final Border', 278, 'all', 8, { magical: true,
            ...counter(['steal', 'gust'], 1, 'Unpick or Knife Gust once, or Bulwark') }), hit('unwritten-dawn', 'Unwritten Dawn', 156, 'all', 2.6, { magical: true })] }
      ] })
    ], { anchorEffects: [anchor.west, anchor.east] });

  encounter('furnace-debt', 'The debt in the furnace', 14, true, 490, 28,
    'Frost deals extra damage and slows the engine. Spark or Frost breaks its heat charge. The last phase has no shell.', [
      foe('furnace-debt', 'Ledger Furnace', 'sentry', 3320, 139, 35, 'frost', '#d79e76', null, { rate: .21, loot: 'ether', phases: [
        { at: 1, name: 'The Unpaid Heat', weakness: 'frost', shell: true, ward: false,
          pattern: [hit('ledger-hammer', 'Ledger Hammer', 139), hit('interest-fire', 'Interest Fire', 174, 'all', 6.2, { magical: true,
            ...counter(['spark', 'frost'], 1, 'Spark or Frost once, or Bulwark') })] },
        { at: .5, name: 'The Last Account', weakness: 'frost', shell: false, ward: false, tint: '#dfa688', rate: .23,
          pattern: [hit('account-closed', 'Account Closed', 206, 'all', 7.4, { magical: true,
            ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }), hit('last-coal', 'Last Coal', 146)] }
      ] })
    ]);

  encounter('orchard-hunger', 'The orchard that kept its fruit', 16, true, 660, 34,
    'Fire is strong here. Spark or Flare stops Seed Feast before it heals the enemy. In phase two, Cleave breaks the roots.', [
      foe('orchard-hunger', 'The Hollow Orchard', 'root', 4200, 151, 32, 'fire', '#a6ad79', null, { rate: .21, loot: 'tonic', phases: [
        { at: 1, name: 'Nothing May Leave', weakness: 'fire', shell: false, ward: false,
          pattern: [hit('hungry-bough', 'Hungry Bough', 151), hit('seed-feast', 'Seed Feast', 168, 'all', 6.6, { heal: 180,
            ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark; the charge also restores enemy HP') })] },
        { at: .5, name: 'A Seed Is Given', weakness: 'light', shell: true, ward: false, tint: '#c4b787', rate: .225,
          pattern: [hit('orchard-cage', 'Orchard Cage', 221, 'all', 6.9,
            counter(['cleave', 'gust'], 1, 'Cleave or Knife Gust once, or Bulwark')), hit('root-hunger', 'Root Hunger', 156)] }
      ] })
    ]);

  encounter('unbound-star', 'The star beyond the roots', 18, true, 1100, 48,
    'A final test of all three roles. Bring finite supplies and useful crests. Two spells break Collapse; two weapon hits break its last charge.', [
      foe('unbound-star', 'The Unbound Star', 'astral', 6500, 184, 40, 'frost', '#b5a8d9', null, { rate: .23, loot: 'feather', phases: [
        { at: 1, name: 'The First Distance', weakness: 'frost', ward: true, shell: false,
          pattern: [hit('first-distance', 'First Distance', 244, 'all', 6.8, { magical: true,
            ...counter(['steal'], 1, 'Unpick once, or Bulwark') }), hit('star-shear', 'Star Shear', 184)] },
        { at: .67, name: 'Nothing Holds the Sky', weakness: 'fire', ward: false, shell: true, tint: '#d4aaa3', rate: .235,
          pattern: [hit('unbound-collapse', 'Collapse', 282, 'all', 8.5, { magical: true, ...slow(10),
            ...counter(['spark', 'frost', 'flare'], 2, 'Two Spark / Frost / Flare casts, or Bulwark') }), hit('orbit-break', 'Orbit Break', 177, 'all', 2.6, { magical: true })] },
        { at: .34, name: 'The Space to Begin', weakness: 'light', ward: true, shell: false, tint: '#e4d3ac', rate: .255,
          pattern: [hit('space-to-begin', 'Space to Begin', 315, 'all', 8.2, { magical: true,
            ...counter(['attack', 'cleave', 'pierce'], 2, 'Two Attack / Cleave / Silver Pierce hits, or Bulwark') }), hit('free-orbit', 'Free Orbit', 185, 'all', 2.4, { magical: true })] }
      ] })
    ]);

  encounter('hunt-bramble', 'Hunt · The Bramble Courier', 13, true, 290, 20,
    'Fire deals extra damage. Cleave breaks the broad charge. This hunt can be repeated for its posted material reward.', [
      foe('hunt-bramble', 'Bramble Courier', 'beast', 2610, 126, 29, 'fire', '#9caf7c', [hit('courier-fang', 'Courier Fang', 126),
        hit('bramble-delivery', 'Bramble Delivery', 151, 'all', 5.8,
          counter(['cleave'], 1, 'Cleave once, or Bulwark'))], { rate: .215, loot: 'tonic' })
    ], { repeatable: true });

  encounter('hunt-copper', 'Hunt · The Copper Maw', 14, true, 340, 24,
    'Unpick the shell. Frost slows the maw. Two weapon hits stop its pressure burst. This hunt can be repeated.', [
      foe('hunt-copper', 'Copper Maw', 'leviathan', 3150, 140, 35, 'frost', '#baa276', [hit('copper-bite', 'Copper Bite', 140),
        hit('pressure-burst', 'Pressure Burst', 188, 'all', 7.1, { magical: true,
          ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') })], { shell: true, rate: .22, loot: 'ether' })
    ], { repeatable: true });

  encounter('hunt-ink', 'Hunt · The Errant Index', 15, true, 390, 26,
    'Unpick the ward. Wind is strong here. The second phase slows the party unless you interrupt it. This hunt can be repeated.', [
      foe('hunt-ink', 'Errant Index', 'archive', 3500, 145, 31, 'wind', '#a2b7c8', null, { rate: .215, loot: 'ether', phases: [
        { at: 1, name: 'An Entry Without a Name', weakness: 'wind', ward: true, shell: false,
          pattern: [hit('errant-line', 'Errant Line', 145), hit('index-fall', 'Index Fall', 183, 'all', 6,
            counter(['steal'], 1, 'Unpick once, or Bulwark'))] },
        { at: .5, name: 'A Name Without an Entry', weakness: 'light', ward: false, shell: false, tint: '#c4b7a8',
          pattern: [hit('ink-hour', 'Ink Hour', 199, 'all', 7.2, { magical: true, ...slow(10),
            ...counter(['spark', 'frost'], 2, 'Two Spark / Frost casts, or Bulwark') }), hit('lost-entry', 'Lost Entry', 151)] }
      ] })
    ], { repeatable: true });

  encounter('hunt-mirror', 'Hunt · The Two-Faced Dawn', 16, true, 440, 28,
    'The mirror changes from frost to fire weakness. Unpick each protection and watch its charge. This hunt can be repeated.', [
      foe('hunt-mirror', 'Two-Faced Dawn', 'astral', 4050, 158, 33, 'frost', '#c2b0d5', null, { rate: .22, loot: 'feather', phases: [
        { at: 1, name: 'The Dawn Behind You', weakness: 'frost', ward: true, shell: false,
          pattern: [hit('backward-light', 'Backward Light', 201, 'all', 7,
            { magical: true, ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }), hit('dawn-shard', 'Dawn Shard', 158)] },
        { at: .5, name: 'The Dawn Ahead', weakness: 'fire', ward: false, shell: true, tint: '#dbba95', rate: .24,
          pattern: [hit('forward-light', 'Forward Light', 231, 'all', 6.4,
            { magical: true, ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark') }), hit('glass-horizon', 'Glass Horizon', 166)] }
      ] })
    ], { repeatable: true });

  encounter('hunt-crown', 'Hunt · The Crown Without a King', 17, true, 500, 32,
    'This hunt tests the party without anchor aid. Fire and light weaknesses alternate. Stop Seed Crown or use Bulwark. This hunt can be repeated.', [
      foe('hunt-crown', 'The Unclaimed Crown', 'root', 4600, 167, 37, 'fire', '#b9b383', null, { rate: .225, loot: 'ether', phases: [
        { at: 1, name: 'The Empty Throne', weakness: 'fire', shell: true, ward: false,
          pattern: [hit('empty-throne', 'Empty Throne', 167), hit('seed-crown', 'Seed Crown', 227, 'all', 7,
            { magical: true, ...counter(['spark', 'flare'], 1, 'Spark or Flare once, or Bulwark') })] },
        { at: .5, name: 'Room for Everyone', weakness: 'light', shell: false, ward: true, tint: '#d9c893', rate: .245,
          pattern: [hit('open-crown', 'Open Crown', 252, 'all', 7.8,
            { magical: true, ...counter(['attack', 'cleave'], 2, 'Two Attack / Cleave hits, or Bulwark') }), hit('last-branch', 'Last Branch', 157, 'all', 2.6)] }
      ] })
    ], { repeatable: true });

  const api = Object.freeze({ ids: Object.freeze(ids), hunts: Object.freeze(ids.filter(id => id.startsWith('hunt-'))) });
  root.MorrowRootBattles = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
