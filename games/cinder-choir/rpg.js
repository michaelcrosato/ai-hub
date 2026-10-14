/* Cinder Choir: deterministic RPG rules. No renderer or browser is required.
 * Inspired by the wait-mode battle example in my-3D2dge v0.24.0.
 * The example supplies action timing and rendering patterns, not a campaign model.
 */
(function (root) {
  'use strict';
  const CC = root.CC = root.CC || {};
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const copy = value => JSON.parse(JSON.stringify(value));
  const unique = list => Array.from(new Set(list));
  const integer = (n, fallback, lo = 0, hi = 9999999) => Number.isFinite(Number(n)) ? clamp(Math.floor(Number(n)), lo, hi) : fallback;
  const DIFFICULTIES = {
    story: { name: 'Story', hp: 0.78, damage: 0.68, speed: 0.88 },
    normal: { name: 'Normal', hp: 1, damage: 1, speed: 1 },
    veteran: { name: 'Veteran', hp: 1.18, damage: 1.22, speed: 1.08 }
  };
  const STATUS = {
    poison: { name: 'Poison', description: 'Lose 6% HP at the start of each turn.', harmful: true },
    burn: { name: 'Burn', description: 'Lose 4% HP at the start of each turn.', harmful: true },
    slow: { name: 'Slow', description: 'The ATB gauge fills at half speed.', harmful: true },
    haste: { name: 'Haste', description: 'The ATB gauge fills 50% faster.' },
    silence: { name: 'Silence', description: 'Spells and Echo calls cannot be used.', harmful: true },
    blind: { name: 'Blind', description: 'Physical attacks can miss.', harmful: true },
    stun: { name: 'Stun', description: 'Lose the next turn.', harmful: true },
    ward: { name: 'Ward', description: 'Physical damage is reduced by 35%.' },
    barrier: { name: 'Barrier', description: 'Magic damage is reduced by 35%.' },
    regen: { name: 'Regen', description: 'Restore 9% HP at the start of each turn.' },
    brave: { name: 'Brave', description: 'Physical damage is increased by 30%.' },
    focus: { name: 'Focus', description: 'Magic damage is increased by 30%.' },
    exposed: { name: 'Exposed', description: 'Damage received is increased by 25%.', harmful: true },
    cover: { name: 'Cover', description: 'Protect an ally with low HP from a physical attack.' },
    guard: { name: 'Defend', description: 'Damage is halved until the next action.' }
  };

  const HEROES = {
    iona: { id: 'iona', name: 'Iona', role: 'Voice mage', description: 'A courier who can hear the memories inside Echoes.', hp: 142, mp: 40, atk: 14, mag: 25, def: 10, spd: 32, growth: 27, weapon: 'ashblade', armor: 'travelcoat', spells: ['mend'], unique: ['aria', 'resound'], color: '#db654e', accent: '#f4c982', hair: '#f7dab6' },
    brann: { id: 'brann', name: 'Brann', role: 'Guard', description: 'A former city guard. He takes the blow so others can stand.', hp: 194, mp: 24, atk: 22, mag: 12, def: 18, spd: 25, growth: 34, weapon: 'reedspear', armor: 'ironcoat', spells: [], unique: ['cover', 'shieldbash'], color: '#6484bd', accent: '#d9b876', hair: '#795242' },
    sable: { id: 'sable', name: 'Sable', role: 'Thief', description: 'A roof runner who steals from those who sell silence.', hp: 149, mp: 29, atk: 20, mag: 16, def: 11, spd: 43, growth: 28, weapon: 'glassknife', armor: 'travelcoat', spells: [], unique: ['steal', 'feint'], color: '#b889ce', accent: '#e0bd7e', hair: '#3e3155' },
    oren: { id: 'oren', name: 'Oren', role: 'Mechanist', description: 'A repair worker with tools for almost every problem.', hp: 173, mp: 31, atk: 21, mag: 18, def: 15, spd: 29, growth: 31, weapon: 'handdrill', armor: 'ironcoat', spells: [], unique: ['drill', 'flashbomb'], color: '#d5a34f', accent: '#72b8b0', hair: '#62462b' },
    mira: { id: 'mira', name: 'Mira', role: 'Singer', description: 'A stage singer whose songs keep the party in time.', hp: 144, mp: 43, atk: 12, mag: 24, def: 10, spd: 35, growth: 27, weapon: 'choirbell', armor: 'silkrobe', spells: ['mend'], unique: ['chorusheal', 'tempo'], color: '#c876a2', accent: '#f3d6ac', hair: '#252d49' },
    tern: { id: 'tern', name: 'Tern', role: 'Martial artist', description: 'A mountaineer who shapes each breath into a strike.', hp: 180, mp: 27, atk: 25, mag: 14, def: 14, spd: 38, growth: 32, weapon: 'brassknuckles', armor: 'travelcoat', spells: [], unique: ['threebeat', 'cyclone'], color: '#78b99c', accent: '#edcb75', hair: '#b9543f' },
    vale: { id: 'vale', name: 'Vale', role: 'Healer', description: 'A field doctor who refuses to leave a life behind.', hp: 153, mp: 49, atk: 12, mag: 27, def: 11, spd: 31, growth: 28, weapon: 'moonstaff', armor: 'silkrobe', spells: ['mend', 'raise', 'cleanse'], unique: ['mending', 'sanctuary'], color: '#dedad2', accent: '#62b7b3', hair: '#546273' },
    rook: { id: 'rook', name: 'Rook', role: 'Automaton', description: 'An old machine who is learning to choose its own work.', hp: 216, mp: 32, atk: 25, mag: 17, def: 20, spd: 23, growth: 36, weapon: 'pulsearm', armor: 'ironcoat', spells: [], unique: ['cannon', 'overclock'], color: '#88aab3', accent: '#e8b563', hair: '#71808e' }
  };

  // All weapons fit every hero. Their role still sets their main strengths.
  const EQUIPMENT = {
    ashblade: { name: 'Ash Blade', slot: 'weapon', atk: 4, mag: 2, price: 90, description: 'A light blade with a warm edge.' },
    copperblade: { name: 'Copper Blade', slot: 'weapon', atk: 12, mag: 3, price: 300, description: 'A balanced copper alloy blade.' },
    ironblade: { name: 'Iron Blade', slot: 'weapon', atk: 21, def: 3, price: 720, description: 'A strong blade from the old city.' },
    starblade: { name: 'Star Blade', slot: 'weapon', atk: 38, mag: 15, price: 2100, element: 'light', description: 'A blade that holds a note of dawn.' },
    reedspear: { name: 'Reed Spear', slot: 'weapon', atk: 5, def: 2, price: 100, description: 'A long spear with a flexible shaft.' },
    guardlance: { name: 'Guard Lance', slot: 'weapon', atk: 24, def: 7, price: 950, description: 'A guard lance made to hold a line.' },
    moonstaff: { name: 'Moon Staff', slot: 'weapon', atk: 3, mag: 10, mp: 8, price: 220, description: 'A staff that makes weak songs clear.' },
    cantorstaff: { name: 'Cantor Staff', slot: 'weapon', atk: 13, mag: 30, mp: 18, price: 1800, description: 'A staff that carries a full choir.' },
    glassknife: { name: 'Glass Knife', slot: 'weapon', atk: 7, spd: 3, price: 150, description: 'A small knife with a clear edge.' },
    nightknife: { name: 'Night Knife', slot: 'weapon', atk: 28, spd: 7, price: 1300, description: 'A swift blade with a dark handle.' },
    handdrill: { name: 'Hand Drill', slot: 'weapon', atk: 9, price: 180, description: 'A sturdy tool with a sharp bit.' },
    geardriver: { name: 'Gear Driver', slot: 'weapon', atk: 32, def: 4, price: 1500, description: 'A heavy drill driven by an Echo cell.' },
    brassknuckles: { name: 'Brass Knuckles', slot: 'weapon', atk: 8, spd: 2, price: 160, description: 'Metal guards for close strikes.' },
    sunfists: { name: 'Sun Fists', slot: 'weapon', atk: 30, spd: 5, price: 1500, element: 'fire', description: 'Warm metal guards that burn on impact.' },
    choirbell: { name: 'Choir Bell', slot: 'weapon', atk: 3, mag: 11, price: 230, description: 'A hand bell with a soft clear sound.' },
    heartbell: { name: 'Heart Bell', slot: 'weapon', atk: 12, mag: 27, hp: 45, price: 1600, description: 'A bell that beats in time with its owner.' },
    pulsearm: { name: 'Pulse Arm', slot: 'weapon', atk: 11, mag: 3, price: 260, description: 'A small cannon from an old machine.' },
    starcannon: { name: 'Star Cannon', slot: 'weapon', atk: 37, mag: 12, price: 2000, description: 'A cannon that fires stored starlight.' },
    travelcoat: { name: 'Travel Coat', slot: 'armor', def: 3, hp: 12, price: 90, description: 'A lined coat for the long road.' },
    ironcoat: { name: 'Iron Coat', slot: 'armor', def: 8, hp: 24, price: 250, description: 'A coat with small plates under the cloth.' },
    silkrobe: { name: 'Silk Robe', slot: 'armor', def: 4, mag: 4, mp: 8, price: 230, description: 'A soft robe that holds Echo sound.' },
    choralrobe: { name: 'Choral Robe', slot: 'armor', def: 12, mag: 12, mp: 18, price: 1000, description: 'A robe woven with choir thread.' },
    mirrorplate: { name: 'Mirror Plate', slot: 'armor', def: 23, hp: 75, price: 1500, description: 'Bright plate that breaks an enemy outline.' },
    starweave: { name: 'Star Weave', slot: 'armor', def: 20, mag: 12, hp: 100, mp: 24, price: 2300, description: 'Cloth woven from the last city lights.' },
    amberring: { name: 'Amber Ring', slot: 'relic', hp: 55, price: 320, description: 'Increase maximum HP by 55.' },
    speedpin: { name: 'Speed Pin', slot: 'relic', spd: 12, price: 500, description: 'Fill the ATB gauge faster.' },
    focuslens: { name: 'Focus Lens', slot: 'relic', mag: 12, mp: 12, price: 700, description: 'Increase spell power and maximum MP.' },
    guardseal: { name: 'Guard Seal', slot: 'relic', def: 12, price: 650, description: 'Reduce physical damage.' },
    heartsong: { name: 'Heart Song', slot: 'relic', hp: 80, mag: 6, regen: true, price: 1200, description: 'Restore a little HP on each turn.' },
    nullcharm: { name: 'Null Charm', slot: 'relic', def: 6, immune: ['silence', 'poison', 'blind'], price: 1300, description: 'Prevent Silence, Poison, and Blind.' }
  };
  Object.entries(EQUIPMENT).forEach(([id, item]) => { item.id = id; });
  const ITEMS = {
    tonic: { id: 'tonic', name: 'Tonic', target: 'ally', price: 25, description: 'Restore 45% of maximum HP, plus 50 HP.' },
    ether: { id: 'ether', name: 'Ether', target: 'ally', price: 45, description: 'Restore 35 MP, plus 20% of maximum MP.' },
    revive: { id: 'revive', name: 'Revive', target: 'deadAlly', price: 60, description: 'Revive one ally with 45% HP.' },
    remedy: { id: 'remedy', name: 'Remedy', target: 'ally', price: 30, description: 'Remove all harmful status effects.' }
  };

  const SKILLS = {
    attack: { name: 'Attack', kind: 'physical', target: 'enemy', power: 1, cost: 0, description: 'Strike one enemy. Gain Chorus power.' },
    defend: { name: 'Defend', kind: 'guard', target: 'self', cost: 0, description: 'Halve damage until your next action. Restore 4 MP.' },
    flee: { name: 'Flee', kind: 'flee', target: 'none', cost: 0, description: 'Leave a normal battle. Boss battles cannot be left.' },
    chorus: { name: 'Chorus', kind: 'chorus', target: 'allEnemies', cost: 0, power: 3.2, element: 'light', description: 'Use 100 Chorus power. Strike all enemies and heal the party.' },
    aria: { name: 'Ember Aria', kind: 'magic', target: 'enemy', power: 1.45, element: 'fire', cost: 3, resonance: 14, description: 'Sing a fire note. Gain extra Chorus power.' },
    resound: { name: 'Resound', kind: 'magic', target: 'allEnemies', power: 1.15, element: 'sound', cost: 6, status: 'exposed', duration: 2, chance: 0.85, description: 'Strike all enemies. They take more damage for two turns.' },
    cover: { name: 'Hold the Line', kind: 'buff', target: 'self', cost: 2, status: 'cover', duration: 3, extraStatus: 'ward', description: 'Protect allies with low HP for three turns. Gain Ward.' },
    shieldbash: { name: 'Shield Bash', kind: 'physical', target: 'enemy', power: 1.25, cost: 3, status: 'stun', duration: 1, chance: 0.9, description: 'Strike one enemy. It can lose its next turn.' },
    steal: { name: 'Steal', kind: 'steal', target: 'enemy', power: 0.6, cost: 0, description: 'Take an item and strike one enemy. Each enemy has one item.' },
    feint: { name: 'Feint', kind: 'physical', target: 'enemy', power: 1.5, cost: 3, status: 'blind', duration: 3, chance: 1, description: 'Strike one enemy and reduce its accuracy.' },
    drill: { name: 'Drill', kind: 'physical', target: 'enemy', power: 1.65, cost: 3, pierce: true, description: 'Drive through one enemy armor.' },
    flashbomb: { name: 'Flash Bomb', kind: 'magic', target: 'allEnemies', power: 0.75, element: 'light', cost: 5, status: 'blind', duration: 2, chance: 0.9, description: 'Flash all enemies. Reduce their accuracy for two turns.' },
    chorusheal: { name: 'Resting Song', kind: 'heal', target: 'allAllies', power: 0.95, cost: 6, status: 'regen', duration: 3, description: 'Heal the party and add Regen for three turns.' },
    tempo: { name: 'Quickstep', kind: 'buff', target: 'allAllies', cost: 7, status: 'haste', duration: 3, description: 'Fill all allied ATB gauges faster for three turns.' },
    threebeat: { name: 'Three Beat', kind: 'physical', target: 'enemy', power: 1.85, hits: 3, cost: 3, description: 'Strike one enemy three times.' },
    cyclone: { name: 'Wheel Kick', kind: 'physical', target: 'allEnemies', power: 1.2, cost: 5, description: 'Sweep all enemies with a turning kick.' },
    mending: { name: 'Field Care', kind: 'heal', target: 'ally', power: 2.3, cost: 3, cleanse: true, description: 'Restore HP and remove harmful effects from one ally.' },
    sanctuary: { name: 'Sanctuary', kind: 'heal', target: 'allAllies', power: 1.7, cost: 8, status: 'barrier', duration: 3, description: 'Heal the party and add Barrier for three turns.' },
    cannon: { name: 'Scatter Cannon', kind: 'physical', target: 'allEnemies', power: 1.3, cost: 4, description: 'Fire a wide burst at all enemies.' },
    overclock: { name: 'Overclock', kind: 'buff', target: 'self', cost: 3, status: 'haste', extraStatus: 'brave', duration: 3, description: 'Increase attack power and ATB speed for three turns.' },
    flare: { name: 'Flare', kind: 'magic', target: 'enemy', power: 1.85, element: 'fire', cost: 4, description: 'Burn one enemy with a fire note.' },
    blaze: { name: 'Blaze', kind: 'magic', target: 'allEnemies', power: 1.6, element: 'fire', cost: 10, status: 'burn', duration: 3, chance: 0.7, description: 'Burn all enemies. Flames can last three turns.' },
    frost: { name: 'Frost', kind: 'magic', target: 'enemy', power: 1.85, element: 'ice', cost: 4, description: 'Strike one enemy with ice.' },
    freeze: { name: 'Deep Freeze', kind: 'magic', target: 'allEnemies', power: 1.6, element: 'ice', cost: 10, status: 'slow', duration: 2, chance: 0.75, description: 'Strike all enemies with ice and reduce their speed.' },
    mend: { name: 'Mend', kind: 'heal', target: 'ally', power: 1.9, cost: 4, description: 'Restore HP to one ally.' },
    wave: { name: 'High Tide', kind: 'magic', target: 'allEnemies', power: 1.65, element: 'water', cost: 9, description: 'Wash all enemies with a strong wave.' },
    spark: { name: 'Spark', kind: 'magic', target: 'enemy', power: 1.9, element: 'lightning', cost: 4, description: 'Strike one enemy with lightning.' },
    haste: { name: 'Haste', kind: 'buff', target: 'ally', cost: 5, status: 'haste', duration: 4, description: 'Fill one ally ATB gauge faster for four turns.' },
    stone: { name: 'Stone', kind: 'magic', target: 'enemy', power: 2.0, element: 'earth', cost: 5, description: 'Strike one enemy with sharp stones.' },
    ward: { name: 'Ward', kind: 'buff', target: 'allAllies', cost: 7, status: 'ward', duration: 4, description: 'Reduce physical damage to the party for four turns.' },
    gust: { name: 'Gust', kind: 'magic', target: 'allEnemies', power: 1.2, element: 'wind', cost: 6, description: 'Sweep all enemies with wind.' },
    slow: { name: 'Slow', kind: 'debuff', target: 'enemy', cost: 4, status: 'slow', duration: 4, chance: 1, description: 'Reduce one enemy ATB speed for four turns.' },
    raise: { name: 'Raise', kind: 'revive', target: 'deadAlly', power: 0.55, cost: 9, description: 'Revive one ally with 55% HP.' },
    renew: { name: 'Renew', kind: 'heal', target: 'allAllies', power: 2.6, cost: 14, cleanse: true, description: 'Restore much HP to the party and remove harmful effects.' },
    drain: { name: 'Drain', kind: 'magic', target: 'enemy', power: 1.55, element: 'dark', cost: 5, drain: 0.65, description: 'Take HP from one enemy.' },
    shade: { name: 'Nightfall', kind: 'magic', target: 'allEnemies', power: 1.65, element: 'dark', cost: 9, description: 'Cover all enemies with a dark note.' },
    venom: { name: 'Venom', kind: 'magic', target: 'enemy', power: 1.0, element: 'earth', cost: 4, status: 'poison', duration: 4, chance: 1, description: 'Strike one enemy and poison it for four turns.' },
    cleanse: { name: 'Cleanse', kind: 'cleanse', target: 'allAllies', cost: 5, description: 'Remove all harmful effects from the party.' },
    silence: { name: 'Silence', kind: 'debuff', target: 'allEnemies', cost: 6, status: 'silence', duration: 3, chance: 0.9, description: 'Stop enemy spells for three turns.' },
    echo: { name: 'True Note', kind: 'magic', target: 'enemy', power: 2.5, element: 'sound', cost: 8, pierce: true, description: 'Strike one enemy with a pure note. Ignore defense.' },
    meteor: { name: 'Starfall', kind: 'magic', target: 'allEnemies', power: 2.7, element: 'light', cost: 17, description: 'Call small stars against all enemies.' },
    barrier: { name: 'Barrier', kind: 'buff', target: 'allAllies', cost: 7, status: 'barrier', duration: 4, description: 'Reduce magic damage to the party for four turns.' },
    gravity: { name: 'Gravity', kind: 'magic', target: 'enemy', power: 2.3, element: 'void', cost: 9, status: 'slow', duration: 2, chance: 0.75, description: 'Crush one enemy and reduce its speed.' },
    nova: { name: 'Nova', kind: 'magic', target: 'allEnemies', power: 3.45, element: 'void', cost: 24, pierce: true, description: 'Release a final star note against all enemies.' },
    // Enemy intent uses the same resolver, target rules, and status rules.
    bite: { name: 'Bite', kind: 'physical', target: 'enemy', power: 1.12, cost: 0 },
    rend: { name: 'Rend', kind: 'physical', target: 'enemy', power: 1.5, cost: 0 },
    sweep: { name: 'Sweep', kind: 'physical', target: 'allEnemies', power: 0.9, cost: 0 },
    poisonbite: { name: 'Venom Bite', kind: 'physical', target: 'enemy', power: 0.9, cost: 0, status: 'poison', duration: 3, chance: 0.8 },
    gearcrush: { name: 'Gear Crush', kind: 'physical', target: 'enemy', power: 1.7, cost: 0, status: 'exposed', duration: 2, chance: 0.7 },
    hush: { name: 'Hush', kind: 'debuff', target: 'allEnemies', cost: 0, status: 'silence', duration: 2, chance: 0.72 },
    shriek: { name: 'Shriek', kind: 'magic', target: 'allEnemies', power: 1.1, element: 'sound', cost: 0 },
    darkness: { name: 'Dark Veil', kind: 'debuff', target: 'allEnemies', cost: 0, status: 'blind', duration: 2, chance: 0.8 },
    rupture: { name: 'Rupture', kind: 'magic', target: 'allEnemies', power: 1.75, element: 'void', cost: 0 },
    selfmend: { name: 'Rebuild', kind: 'heal', target: 'self', power: 1.6, cost: 0 },
    charge: { name: 'Gather Power', kind: 'buff', target: 'self', cost: 0, status: 'brave', extraStatus: 'focus', duration: 2 }
  };
  Object.entries(SKILLS).forEach(([id, skill]) => { skill.id = id; skill.label = skill.name; skill.description = skill.description || 'An enemy action.'; });
  const ECHOES = {
    ember: { name: 'Ember', title: 'The First Flame', element: 'fire', spells: ['flare', 'blaze'], mag: 3, color: '#f08b57', description: 'An Echo of warmth kept through a long winter.' },
    rime: { name: 'Rime', title: 'The Silent Lake', element: 'ice', spells: ['frost', 'freeze'], def: 3, color: '#97d5ea', description: 'An Echo of a lake before the ice broke.' },
    tide: { name: 'Tide', title: 'The Patient Sea', element: 'water', spells: ['mend', 'wave'], mp: 8, color: '#64b9d8', summonHeal: true, description: 'An Echo of every boat that came home.' },
    volt: { name: 'Volt', title: 'The Copper Storm', element: 'lightning', spells: ['spark', 'haste'], spd: 4, color: '#e8d967', description: 'An Echo of the first light in a dark street.' },
    stone: { name: 'Stone', title: 'The Deep Foundation', element: 'earth', spells: ['stone', 'ward'], def: 5, color: '#b9a181', summonStatus: 'ward', description: 'An Echo of the hands that built the city.' },
    gale: { name: 'Gale', title: 'The Open Road', element: 'wind', spells: ['gust', 'slow'], spd: 5, color: '#a2d59a', description: 'An Echo of a journey with no map.' },
    dawn: { name: 'Dawn', title: 'The Returning Light', element: 'light', spells: ['raise', 'renew'], hp: 30, color: '#f0d7ac', summonHeal: true, summonRevive: true, description: 'An Echo of a promise kept at sunrise.' },
    shade: { name: 'Shade', title: 'The Last Lantern', element: 'dark', spells: ['drain', 'shade'], mag: 5, color: '#b8a2d6', description: 'An Echo of a light carried through grief.' },
    thorn: { name: 'Thorn', title: 'The Wild Garden', element: 'earth', spells: ['venom', 'cleanse'], hp: 25, color: '#8cc581', summonStatus: 'regen', description: 'An Echo of green life through broken stone.' },
    chime: { name: 'Chime', title: 'The Shared Voice', element: 'sound', spells: ['silence', 'echo'], mag: 6, color: '#d996c7', description: 'An Echo of strangers who sang together.' },
    astral: { name: 'Astral', title: 'The Map of Stars', element: 'light', spells: ['meteor', 'barrier'], mag: 8, color: '#d3c5fa', summonStatus: 'barrier', description: 'An Echo of people who looked beyond the walls.' },
    void: { name: 'Void', title: 'The Space Between', element: 'void', spells: ['gravity', 'nova'], mag: 10, mp: 12, color: '#aa9ae5', description: 'An Echo of silence that chose to listen.' }
  };
  Object.entries(ECHOES).forEach(([id, e]) => { e.id = id; e.learn = e.spells.map((skill, i) => ({ skill, ap: i ? 8 : 4 })); });

  const enemy = (name, hp, atk, mag, def, spd, weak, moves, color, shape, extra = {}) => ({ name, hp, atk, mag, def, spd, weak, moves, color, shape, ...extra });
  const ENEMIES = {
    ashling: enemy('Ashling', 83, 11, 12, 5, 23, ['ice', 'water'], ['attack', 'flare'], '#c87950', 'blob', { resist: ['fire'] }),
    brassmite: enemy('Brass Mite', 79, 12, 7, 12, 21, ['lightning'], ['attack', 'bite'], '#bba45b', 'beetle'),
    hound: enemy('Coal Hound', 98, 15, 8, 7, 29, ['ice'], ['bite', 'rend'], '#ab7065', 'beast'),
    sentry: enemy('Brass Sentry', 113, 14, 9, 13, 18, ['lightning'], ['attack', 'sweep'], '#a89064', 'armor'),
    moth: enemy('Hush Moth', 67, 9, 15, 5, 31, ['fire', 'wind'], ['gust', 'darkness'], '#c3a7ca', 'wing'),
    briarling: enemy('Briarling', 102, 12, 12, 8, 23, ['fire'], ['poisonbite', 'stone'], '#85a477', 'plant', { resist: ['earth'] }),
    marshwisp: enemy('Marsh Wisp', 76, 8, 17, 5, 27, ['light', 'wind'], ['drain', 'slow'], '#7ac0af', 'wisp', { resist: ['dark'] }),
    miretoad: enemy('Mire Toad', 139, 14, 10, 9, 17, ['lightning', 'ice'], ['poisonbite', 'wave'], '#83a188', 'beast'),
    ironhound: enemy('Iron Hound', 128, 17, 10, 15, 30, ['lightning'], ['bite', 'gearcrush'], '#8fa0aa', 'beast'),
    raildrone: enemy('Rail Drone', 118, 12, 17, 15, 26, ['lightning', 'water'], ['spark', 'sweep'], '#b29973', 'machine'),
    chorister: enemy('Lost Chorister', 94, 9, 20, 7, 25, ['sound', 'light'], ['shriek', 'hush'], '#b891bd', 'humanoid'),
    glassling: enemy('Glassling', 108, 14, 16, 13, 26, ['earth', 'sound'], ['frost', 'attack'], '#a5c4d4', 'crystal'),
    frostbat: enemy('Frost Bat', 85, 13, 17, 6, 34, ['fire'], ['frost', 'bite'], '#aad1df', 'wing', { resist: ['ice'] }),
    duneprowler: enemy('Dune Prowler', 125, 19, 9, 11, 31, ['water'], ['rend', 'darkness'], '#c3a782', 'beast'),
    sandworm: enemy('Sand Worm', 171, 18, 12, 13, 15, ['ice', 'water'], ['stone', 'sweep'], '#bda477', 'serpent'),
    shade: enemy('Nameless Shade', 105, 9, 21, 7, 29, ['light', 'fire'], ['drain', 'shade'], '#9083af', 'wisp', { resist: ['dark'] }),
    drowned: enemy('Drowned Guard', 150, 17, 15, 15, 20, ['lightning', 'light'], ['wave', 'rend'], '#79a69d', 'armor'),
    revenant: enemy('Revenant', 143, 19, 15, 12, 25, ['light'], ['rend', 'drain'], '#a98a98', 'humanoid'),
    archivist: enemy('Ink Keeper', 125, 11, 24, 9, 24, ['fire', 'sound'], ['hush', 'echo'], '#a59ab6', 'humanoid'),
    pageswarm: enemy('Page Swarm', 99, 8, 21, 6, 35, ['fire', 'wind'], ['gust', 'darkness'], '#e0ccb0', 'pages'),
    stormkite: enemy('Storm Kite', 111, 15, 22, 8, 36, ['earth', 'ice'], ['spark', 'gust'], '#91b9cc', 'wing'),
    thunderhead: enemy('Thunderhead', 150, 10, 25, 11, 22, ['earth', 'wind'], ['spark', 'wave'], '#9aabc1', 'wisp', { resist: ['lightning'] }),
    clockwork: enemy('Clockwork Guard', 177, 22, 14, 20, 22, ['lightning', 'water'], ['gearcrush', 'selfmend'], '#b5a286', 'machine'),
    cinderknight: enemy('Cinder Knight', 188, 24, 18, 20, 22, ['ice', 'water'], ['rend', 'blaze'], '#b1786f', 'armor', { resist: ['fire'] }),
    nullsinger: enemy('Null Singer', 135, 12, 27, 10, 29, ['sound', 'light'], ['hush', 'gravity'], '#a593b4', 'humanoid'),
    starspawn: enemy('Star Spawn', 195, 20, 24, 15, 26, ['dark', 'sound'], ['meteor', 'sweep'], '#bba4d6', 'star'),
    choirguard: enemy('Choir Guard', 195, 24, 21, 22, 26, ['lightning', 'sound'], ['gearcrush', 'shriek'], '#bba7b3', 'armor'),
    remnant: enemy('Remnant', 153, 16, 24, 13, 28, ['light'], ['shade', 'drain'], '#a695b2', 'wisp'),
    mirrorling: enemy('Mirrorling', 125, 15, 20, 17, 29, ['earth', 'sound'], ['frost', 'echo'], '#a8bfd0', 'crystal'),
    ashbeetle: enemy('Ash Beetle', 115, 17, 10, 17, 19, ['water', 'ice'], ['bite', 'flare'], '#b08367', 'beetle'),
    gatewarden: enemy('Gate Warden', 390, 19, 14, 14, 19, ['lightning'], ['attack', 'sweep', 'charge', 'gearcrush'], '#bc9c72', 'armor', { boss: true, hint: 'Lightning breaks its brass shell. Defend after Gather Power.' }),
    rootmother: enemy('Wire Mother', 530, 18, 22, 12, 21, ['fire'], ['poisonbite', 'stone', 'selfmend', 'sweep'], '#91ab7a', 'plant', { boss: true, hint: 'Use fire. Cleanse Poison or use Remedy.' }),
    railwarden: enemy('Rail Warden', 610, 23, 17, 22, 24, ['lightning', 'water'], ['sweep', 'charge', 'gearcrush', 'spark'], '#b79c6f', 'machine', { boss: true, hint: 'Lightning and water pass through its armor. Read its next attack.' }),
    cantor: enemy('Hollow Cantor', 620, 14, 29, 10, 26, ['sound', 'light'], ['shriek', 'hush', 'shade', 'selfmend'], '#b38dae', 'humanoid', { boss: true, hint: 'Use True Note. Keep Remedy ready for Silence.' }),
    mirror: enemy('Glass Witness', 690, 20, 26, 19, 27, ['earth', 'sound'], ['frost', 'echo', 'darkness', 'freeze'], '#b3c6d9', 'crystal', { boss: true, hint: 'Earth and sound break its glass. Blind affects physical attacks.' }),
    regent: enemy('Regent Vey', 800, 28, 25, 20, 28, ['dark', 'sound'], ['rend', 'charge', 'sweep', 'meteor'], '#bd8997', 'humanoid', { boss: true, hint: 'Ward blocks his blade. Barrier blocks Starfall.' }),
    undertow: enemy('Undertow', 790, 25, 27, 16, 24, ['lightning', 'ice'], ['wave', 'poisonbite', 'sweep', 'drain'], '#75b8b0', 'serpent', { boss: true, hint: 'Use lightning or ice. Remove Poison before it grows costly.' }),
    glasswyrm: enemy('Glass Wyrm', 920, 28, 25, 22, 24, ['earth', 'sound'], ['rend', 'freeze', 'charge', 'sweep'], '#a9cdd2', 'serpent', { boss: true, hint: 'Use earth or sound. Ward helps against its wide attacks.' }),
    archive: enemy('Living Archive', 850, 16, 33, 16, 26, ['fire', 'sound'], ['hush', 'echo', 'selfmend', 'meteor'], '#c1adcb', 'pages', { boss: true, hint: 'Use fire or sound. Cleanse Silence and keep Barrier active.' }),
    stormbird: enemy('Stormbird', 880, 24, 31, 17, 34, ['earth', 'ice'], ['gust', 'spark', 'charge', 'sweep'], '#acc9e2', 'wing', { boss: true, hint: 'Use earth or ice. Slow reduces its speed advantage.' }),
    ironheart: enemy('Iron Heart', 1020, 30, 29, 25, 22, ['lightning', 'water'], ['gearcrush', 'selfmend', 'charge', 'rupture'], '#b78373', 'machine', { boss: true, hint: 'Use lightning or water. Defend when it gathers power.' }),
    nullchoir: enemy('Null Choir', 1110, 18, 35, 20, 27, ['sound', 'light'], ['hush', 'shade', 'shriek', 'rupture'], '#b097c8', 'wisp', { boss: true, hint: 'Keep Barrier active. True Note can reach through the choir.' }),
    conductor: enemy('Last Conductor', 1180, 28, 36, 22, 30, ['dark', 'sound'], ['charge', 'meteor', 'hush', 'rupture'], '#bd99ad', 'humanoid', { boss: true, hint: 'Use dark or sound. Watch for the attack after Gather Power.' }),
    stillstar: enemy('Still Star', 1490, 32, 39, 24, 27, ['sound'], ['echo', 'charge', 'rupture', 'meteor', 'hush'], '#d5b9e3', 'star', { boss: true, final: true, hint: 'Use sound. Save Chorus and Dawn for the final movement.' })
  };
  Object.entries(ENEMIES).forEach(([id, e]) => { e.id = id; e.resist = e.resist || []; e.steal = e.boss ? 'ether' : ['machine', 'armor', 'crystal'].includes(e.shape) ? 'ether' : 'tonic'; });

  function xpForLevel(level) { return Math.floor(80 * Math.pow(Math.max(0, level - 1), 1.85)); }
  function levelForXP(xp) { let level = 1; while (level < 50 && xp >= xpForLevel(level + 1)) level++; return level; }
  function getStats(state, id) {
    const hero = HEROES[id], record = state.roster && state.roster[id];
    if (!hero || !record) return null;
    const level = integer(record.level, 1, 1, 50), d = level - 1;
    const stats = { id, name: hero.name, role: hero.role, level, maxHp: hero.hp + hero.growth * d, maxMp: hero.mp + 4 * d, atk: hero.atk + Math.floor(d * 2.5), mag: hero.mag + Math.floor(d * 2.7), def: hero.def + Math.floor(d * 1.4), spd: hero.spd + Math.floor(d * 0.35), immune: [], resist: [], element: null, regen: false, breakPower: 0, pairDiscount: 0 };
    const gear = [EQUIPMENT[record.weapon], EQUIPMENT[record.armor], EQUIPMENT[record.relic], ECHOES[record.echo]].filter(Boolean);
    gear.forEach(item => {
      for (const key of ['atk', 'mag', 'def', 'spd']) stats[key] += item[key] || 0;
      stats.maxHp += item.hp || 0; stats.maxMp += item.mp || 0;
      if (item.immune) stats.immune.push(...item.immune);
      if (item.resist) stats.resist.push(...item.resist);
      stats.breakPower += item.breakPower || 0; stats.pairDiscount += item.pairDiscount || 0;
      if (item.element) stats.element = item.element;
      if (item.regen) stats.regen = true;
    });
    stats.resist = unique(stats.resist); stats.pairDiscount = Math.min(20, stats.pairDiscount);
    stats.awakened = Boolean(state.flags && state.flags[hero.awakenFlag || (id === 'iona' ? 'q_airship' : 'q_' + id)]);
    if (stats.awakened) { stats.maxHp = Math.round(stats.maxHp * 1.1); stats.atk += 6; stats.mag += 6; }
    stats.questBonus = stats.awakened ? 'Personal quest: +10% HP, +6 attack, +6 magic.' : null;
    stats.hp = clamp(integer(record.hp, stats.maxHp), 0, stats.maxHp);
    stats.mp = clamp(integer(record.mp, stats.maxMp), 0, stats.maxMp);
    stats.xp = integer(record.xp, xpForLevel(level));
    stats.nextXp = xpForLevel(Math.min(50, level + 1));
    stats.xpToNext = Math.max(0, stats.nextXp - stats.xp);
    return stats;
  }
  function makeHero(state, id, level) {
    const template = HEROES[id];
    const record = { id, level, xp: xpForLevel(level), hp: 0, mp: 0, weapon: template.weapon, armor: template.armor, relic: null, echo: null, learned: [], ap: {} };
    state.roster[id] = record;
    const stats = getStats(state, id); record.hp = stats.maxHp; record.mp = stats.maxMp;
    return record;
  }
  function newGame(difficulty = 'normal') {
    const state = { version: 1, difficulty: DIFFICULTIES[difficulty] ? difficulty : 'normal', act: 1, chapter: 0, location: 'bellweather', party: ['iona', 'brann'], roster: {}, bag: { tonic: 6, ether: 3, revive: 2, remedy: 2 }, gold: 150, flags: {}, cleared: [], quests: [], chests: [], echoes: ['ember'], bestiary: {}, playTime: 0, resonance: 0, seed: 12345 };
    makeHero(state, 'iona', 1); makeHero(state, 'brann', 1); state.roster.iona.echo = 'ember';
    const stats = getStats(state, 'iona'); state.roster.iona.hp = stats.maxHp; state.roster.iona.mp = stats.maxMp;
    if (CC.Frontier) CC.Frontier.ensure(state);
    if (CC.Undertide) CC.Undertide.ensure(state);
    if (CC.Journey) CC.Journey.ensure(state);
    return state;
  }
  function recruit(state, id) {
    if (!HEROES[id]) return { ok: false, reason: 'Unknown hero.' };
    if (state.roster[id]) {
      if (state.party.length < 4 && !state.party.includes(id)) state.party.push(id);
      return { ok: true, recruited: false, hero: state.roster[id] };
    }
    const level = Math.max(1, ...Object.values(state.roster).map(h => h.level));
    const hero = makeHero(state, id, level);
    if (state.party.length < 4) state.party.push(id);
    return { ok: true, recruited: true, hero };
  }
  function healParty(state) {
    Object.keys(state.roster).forEach(id => { const stats = getStats(state, id); state.roster[id].hp = stats.maxHp; state.roster[id].mp = stats.maxMp; });
    return state;
  }
  function grantXP(state, amount) {
    amount = integer(amount, 0, 0, 999999);
    const levels = [];
    Object.keys(state.roster).forEach(id => {
      const record = state.roster[id], before = record.level;
      record.xp += amount; record.level = levelForXP(record.xp);
      if (record.level > before) {
        const stats = getStats(state, id); record.hp = stats.maxHp; record.mp = stats.maxMp;
        levels.push({ id, name: HEROES[id].name, from: before, to: record.level, level: record.level });
      }
    });
    return { xp: amount, levels };
  }
  function setParty(state, ids) {
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 4 || unique(ids).length !== ids.length || ids.some(id => !state.roster[id])) return { ok: false, reason: 'Choose one to four different recruited heroes.' };
    state.party = ids.slice(); return { ok: true };
  }
  function equip(state, id, slot, itemId) {
    const h = state.roster[id];
    if (!h || !['weapon', 'armor', 'relic', 'echo'].includes(slot)) return { ok: false, reason: 'Invalid equipment slot.' };
    if (h[slot] === itemId) return { ok: true };
    if (slot === 'echo') {
      if (itemId && (!ECHOES[itemId] || !state.echoes.includes(itemId))) return { ok: false, reason: 'This Echo has not joined you.' };
      if (itemId) Object.values(state.roster).forEach(other => { if (other.echo === itemId) other.echo = null; });
      h.echo = itemId || null;
      Object.keys(state.roster).forEach(heroId => { const s = getStats(state, heroId); state.roster[heroId].hp = s.hp; state.roster[heroId].mp = s.mp; });
      return { ok: true };
    }
    if (itemId && (!EQUIPMENT[itemId] || EQUIPMENT[itemId].slot !== slot || !(state.bag[itemId] > 0))) return { ok: false, reason: 'This item is not in the bag.' };
    if (h[slot]) state.bag[h[slot]] = (state.bag[h[slot]] || 0) + 1;
    if (itemId) state.bag[itemId]--;
    h[slot] = itemId || null;
    const stats = getStats(state, id); h.hp = stats.hp; h.mp = stats.mp;
    return { ok: true };
  }
  function useItem(state, itemId, targetId) {
    const item = ITEMS[itemId], hero = state.roster[targetId];
    if (!item || !hero || !(state.bag[itemId] > 0)) return { ok: false, reason: 'No item or valid target.' };
    const stats = getStats(state, targetId);
    if (itemId === 'revive' && hero.hp > 0) return { ok: false, reason: 'This ally is standing.' };
    if (itemId !== 'revive' && hero.hp <= 0) return { ok: false, reason: 'Use Revive first.' };
    if (itemId === 'tonic' && hero.hp >= stats.maxHp || itemId === 'ether' && hero.mp >= stats.maxMp || itemId === 'remedy') return { ok: false, reason: 'This item is not needed.' };
    state.bag[itemId]--;
    if (itemId === 'tonic') hero.hp = Math.min(stats.maxHp, hero.hp + Math.round(stats.maxHp * 0.45) + 50);
    if (itemId === 'ether') hero.mp = Math.min(stats.maxMp, hero.mp + Math.round(stats.maxMp * 0.2) + 35);
    if (itemId === 'revive') hero.hp = Math.round(stats.maxHp * 0.45);
    return { ok: true };
  }
  function knownSpells(state, id) {
    const h = state.roster[id];
    return h ? unique([...(HEROES[id].spells || []), ...(h.learned || []), ...(ECHOES[h.echo] ? ECHOES[h.echo].spells : [])]) : [];
  }
  function supportHeroes(state) {
    if (!CC.Undertide) return [];
    return (state.available || Object.keys(state.roster)).filter(id => HEROES[id] && state.roster[id] && !state.party.includes(id) && state.roster[id].hp > 0);
  }
  function rand(battle) { battle.seed = (Math.imul(battle.seed, 1664525) + 1013904223) >>> 0; return battle.seed / 4294967296; }
  function actor(battle, id) { return battle.actors.find(unit => unit.id === id); }
  function alive(battle, enemySide) { return battle.actors.filter(unit => unit.enemy === enemySide && unit.alive); }
  function emit(battle, event) { battle.events.push({ type: 'log', source: null, target: null, value: 0, element: null, text: '', ...event }); }
  function refreshReady(battle) {
    if (battle.result) { battle.ready = null; return null; }
    const ready = alive(battle, false).filter(h => h.atb >= 100).sort((a, b) => a.readyOrder - b.readyOrder || a.index - b.index);
    battle.ready = ready.length ? ready[0].id : null;
    return battle.ready;
  }
  function planIntent(battle, unit) {
    const template = ENEMIES[unit.baseId];
    const moves = unit.phaseMoves || template.moves;
    let skillId = moves[(unit.phaseTurn == null ? unit.turn : unit.phaseTurn) % moves.length];
    if (unit.final && unit.phase >= 2 && unit.turn % 3 === 2) skillId = 'rupture';
    if (unit.status.silence && ['magic', 'heal', 'revive', 'debuff'].includes(SKILLS[skillId].kind)) skillId = 'attack';
    const skill = SKILLS[skillId];
    const targets = alive(battle, !unit.enemy);
    const target = targets.length ? targets[Math.floor(rand(battle) * targets.length)].id : null;
    unit.intent = { id: skillId, label: skill.name, name: skill.name, target, targetType: skill.target, element: skill.element || null, dangerous: skill.power >= 1.5 || skillId === 'charge', hint: unit.phaseHint || template.hint || '' };
  }
  function createBattle(state, encounter = {}) {
    const level = integer(encounter.level, Math.max(1, ...state.party.map(id => state.roster[id].level)), 1, 50);
    const enemyIds = (encounter.enemies && encounter.enemies.length ? encounter.enemies : ['ashling']).map(e => typeof e === 'string' ? e : e.id);
    if (enemyIds.some(id => !ENEMIES[id])) throw new Error('Encounter has an unknown enemy: ' + enemyIds.filter(id => !ENEMIES[id]).join(', '));
    if (!state.party.length || state.party.some(id => !state.roster[id] || !HEROES[id])) throw new Error('The party is invalid.');
    if (encounter.matchedLevel === true && !CC.Journey) throw new Error('Load the journey rules before matched-level practice.');
    const profile = CC.Journey ? CC.Journey.battleProfile(state, encounter) : { matchedLevel: false, levelMode: 'current', levelModeLabel: 'Current level', levelCap: null };
    const heroStats = id => CC.Journey ? CC.Journey.battleStats(state, id, profile) : getStats(state, id);
    const battle = { version: 1, id: encounter.id || null, level, boss: Boolean(encounter.boss || enemyIds.some(id => ENEMIES[id].boss)), final: Boolean(encounter.final || enemyIds.includes('stillstar')), difficulty: DIFFICULTIES[state.difficulty] ? state.difficulty : 'normal', actors: [], heroes: [], enemies: [], ready: null, result: null, events: [], time: 0, turns: 0, seed: integer(encounter.seed, state.seed, 0, 4294967295), bag: copy(state.bag), resonance: clamp(state.resonance || 0, 0, 100), summoned: [], stolen: [], seen: enemyIds.slice(), lastElement: null, lastSource: null, readySerial: 0, settled: false, rewards: null, bonds: CC.Frontier ? CC.Frontier.bondIds(state) : [] };
    battle.practice = encounter.practice === true; battle.trialId = encounter.trialId || null;
    Object.assign(battle, profile);
    battle.metrics = { actions: 0, itemsUsed: 0, breaks: 0, weaknessHits: 0, supportUses: 0, enemyActions: 0, knockouts: 0, damageTaken: 0 };
    battle.reserves = supportHeroes(state).map(id => ({ ...heroStats(id), baseId: id, enemy: false, alive: true, status: {} })); battle.supportUsed = null;
    state.party.slice(0, 4).forEach((id, index) => {
      const stats = heroStats(id), record = state.roster[id];
      const unit = { ...stats, id, baseId: id, index, enemy: false, alive: stats.hp > 0, status: {}, atb: stats.hp > 0 ? Math.max(0, 100 - index * 22) : 0, readyOrder: index, turn: 0, intent: null, spells: knownSpells(state, id), unique: HEROES[id].unique.slice(), echo: record.echo || null, phase: 1 };
      if (stats.regen) unit.status.regen = 999;
      battle.actors.push(unit); battle.heroes.push(unit);
    });
    enemyIds.forEach((id, index) => {
      const e = ENEMIES[id], factor = 1 + (level - 1) * (e.boss ? 0.205 : 0.18), mode = DIFFICULTIES[battle.difficulty];
      const hp = Math.round(e.hp * factor * mode.hp * (e.boss ? 1.65 : 1)), d = level - 1;
      const unit = { id: id + ':' + index, baseId: id, name: e.name, index, enemy: true, boss: !!e.boss, final: !!e.final, level, hp, maxHp: hp, mp: 999, maxMp: 999, atk: e.atk + Math.floor(d * 1.7), mag: e.mag + Math.floor(d * 1.75), def: e.def + Math.floor(d * 1.05), spd: e.spd + Math.floor(d * 0.25), weak: e.weak.slice(), resist: e.resist.slice(), immune: e.boss ? ['stun'] : [], status: {}, atb: 10 + rand(battle) * 26, alive: true, turn: 0, phase: 1, readyOrder: 0, color: e.color, shape: e.shape, hint: e.hint || '', stolen: false };
      if (e.breakMax) Object.assign(unit, { break: 0, breakMax: e.breakMax, broken: false, breaks: 0, lastBreakTurn: -1, phaseLabel: e.phaseLabel || 'First movement', phaseHint: e.hint || '', nextPhase: e.phases && e.phases[0] ? copy(e.phases[0]) : null });
      battle.actors.push(unit); battle.enemies.push(unit); planIntent(battle, unit);
    });
    refreshReady(battle);
    if (!alive(battle, false).length) battle.result = 'defeat';
    emit(battle, { text: battle.boss ? 'A powerful voice blocks the way.' : 'The party takes its stand.' });
    return battle;
  }

  function commandSpec(battle, unit, id) {
    if (id.startsWith('support:')) {
      const heroId = id.slice(8), reserve = (battle.reserves || []).find(hero => hero.id === heroId), skill = CC.Undertide?.supports[heroId];
      return reserve && skill ? { ...skill, id, support: heroId, supportCost: 1, cost: 0 } : null;
    }
    if (id.startsWith('item:')) {
      const item = ITEMS[id.slice(5)];
      return item ? { id, name: item.name, label: item.name, kind: 'item', target: item.target, cost: 0, item: item.id, description: item.description } : null;
    }
    if (id.startsWith('summon:')) {
      const echoId = id.slice(7), echo = ECHOES[echoId];
      return echo && unit.echo === echoId ? { id, name: 'Call ' + echo.name, label: 'Call ' + echo.name, kind: 'summon', target: echo.summonHeal ? 'allAllies' : 'allEnemies', cost: 8 + Math.floor(unit.level / 4), echo: echoId, element: echo.element, power: 3.2, description: 'Call ' + echo.title + '. Each Echo can answer once per battle.' } : null;
    }
    const skill = SKILLS[id];
    if (!skill) return null;
    if (skill.bond) {
      const partner = skill.members.find(id => id !== unit.id);
      return { ...skill, partner, chorusCost: Math.max(20, skill.chorusCost - (unit.pairDiscount || 0)) };
    }
    return { ...skill };
  }
  function unavailableReason(battle, unit, spec) {
    if (!unit || unit.enemy || !unit.alive || battle.result) return 'This hero cannot act.';
    if (spec.support) {
      if (battle.supportUsed) return 'The shared Support call was used in this battle.';
      if (!(battle.reserves || []).some(hero => hero.id === spec.support)) return 'This reserve is not available.';
      if (unit.status.stun) return 'This hero is stunned.';
      if (spec.target === 'deadAlly' && !battle.heroes.some(hero => !hero.alive)) return 'No ally needs revival.';
      return null;
    }
    if (unit.mp < spec.cost) return 'Not enough MP.';
    if (unit.status.silence && ['magic', 'heal', 'buff', 'debuff', 'revive', 'cleanse', 'summon'].includes(spec.kind) && !unit.unique.includes(spec.id)) return 'Silence prevents this action.';
    if (spec.bond) {
      const partner = actor(battle, spec.partner);
      if (!battle.bonds.includes(spec.bond)) return 'Complete this companion bond first.';
      if (!partner || !partner.alive) return HEROES[spec.partner].name + ' must be standing in the active party.';
      if (partner.status.stun) return partner.name + ' is stunned.';
      if (partner.status.silence && ['magic', 'heal', 'buff'].includes(spec.kind)) return partner.name + ' is silenced.';
      if (partner.atb < 50) return partner.name + ' needs at least 50 ATB.';
      if (partner.mp < spec.cost) return partner.name + ' needs ' + spec.cost + ' MP.';
      if (battle.resonance < spec.chorusCost) return 'This pair needs ' + spec.chorusCost + ' Chorus.';
    }
    if (spec.kind === 'item' && !(battle.bag[spec.item] > 0)) return 'This item is not in the bag.';
    if (spec.kind === 'flee' && battle.boss) return 'This boss battle cannot be left.';
    if (spec.kind === 'chorus' && battle.resonance < 100) return 'Chorus needs 100 power.';
    if (spec.kind === 'summon' && battle.summoned.includes(spec.echo)) return 'This Echo has already answered.';
    if (spec.target === 'deadAlly' && !battle.heroes.some(h => !h.alive)) return 'No ally needs revival.';
    return null;
  }
  function commands(battle, actorId) {
    const unit = actor(battle, actorId);
    if (!unit || unit.enemy) return [];
    const pairs = Object.values(SKILLS).filter(skill => skill.bond && battle.bonds.includes(skill.bond) && skill.members.includes(unit.id)).map(skill => skill.id);
    const ids = unique(['attack', ...unit.unique, ...pairs, ...unit.spells, ...(unit.echo ? ['summon:' + unit.echo] : []), 'chorus', 'defend', ...(battle.reserves || []).map(hero => 'support:' + hero.id), ...Object.keys(ITEMS).map(id => 'item:' + id), 'flee']);
    return ids.map(id => commandSpec(battle, unit, id)).filter(Boolean).map(spec => { const reason = unavailableReason(battle, unit, spec); return { ...spec, label: spec.name, group: spec.support ? 'support' : spec.bond ? 'bonds' : spec.kind === 'item' ? 'items' : spec.kind === 'summon' ? 'summons' : unit.spells.includes(spec.id) && !unit.unique.includes(spec.id) ? 'spells' : 'actions', enabled: !reason, reason, disabledReason: reason, count: spec.item ? battle.bag[spec.item] || 0 : undefined }; });
  }
  function selectTargets(battle, unit, spec, targetId) {
    const friends = battle.actors.filter(h => h.enemy === unit.enemy), foes = alive(battle, !unit.enemy);
    if (spec.target === 'none') return [];
    if (spec.target === 'self') return unit.alive ? [unit] : [];
    if (spec.target === 'allEnemies') return foes;
    if (spec.target === 'allAllies') return friends.filter(h => h.alive || spec.kind === 'summon' && ECHOES[spec.echo].summonRevive);
    const list = spec.target === 'deadAlly' ? friends.filter(h => !h.alive) : spec.target === 'ally' ? friends.filter(h => h.alive) : foes;
    if (targetId != null) return list.filter(h => h.id === targetId);
    return list.length ? [spec.target === 'ally' ? list.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] : list[0]] : [];
  }
  function applyStatus(battle, source, target, status, duration, chance = 1) {
    if (!target.alive || !STATUS[status] || target.immune.includes(status)) return;
    const rate = target.boss && STATUS[status].harmful ? chance * 0.75 : chance;
    if (rand(battle) > rate) return;
    if (status === 'haste') delete target.status.slow;
    if (status === 'slow') delete target.status.haste;
    target.status[status] = Math.max(target.status[status] || 0, duration);
    emit(battle, { type: 'status', source: source.id, target: target.id, status, value: duration, text: target.name + ': ' + STATUS[status].name + '.' });
  }
  function cleanseTarget(battle, source, target) {
    Object.keys(target.status).forEach(key => { if (STATUS[key] && STATUS[key].harmful) delete target.status[key]; });
    emit(battle, { type: 'status', source: source.id, target: target.id, status: 'cleanse', text: target.name + ' is free of harmful effects.' });
  }
  function heal(battle, source, target, value, mp = false) {
    if (!target.alive) return 0;
    const before = mp ? target.mp : target.hp, max = mp ? target.maxMp : target.maxHp;
    const amount = Math.min(max - before, Math.max(0, Math.round(value)));
    if (mp) target.mp += amount; else target.hp += amount;
    emit(battle, { type: 'heal', source: source.id, target: target.id, value: amount, element: mp ? 'mp' : 'heal', text: target.name + ' restores ' + amount + (mp ? ' MP.' : ' HP.') });
    return amount;
  }
  function harm(battle, source, target, value, detail = {}) {
    if (!target.alive) return 0;
    const amount = Math.min(target.hp, Math.max(1, Math.round(value)));
    target.hp -= amount;
    if (battle.metrics) {
      if (!source.enemy && target.enemy && detail.weak) battle.metrics.weaknessHits++;
      if (!target.enemy) battle.metrics.damageTaken += amount;
    }
    emit(battle, { type: 'hit', source: source.id, target: target.id, value: amount, element: detail.element || 'physical', critical: false, weak: false, ...detail, text: detail.text || target.name + ' takes ' + amount + ' damage.' });
    if (!source.enemy && target.enemy) battle.resonance = clamp(battle.resonance + (detail.weak ? 11 : 5), 0, 100);
    if (source.enemy && !target.enemy) battle.resonance = clamp(battle.resonance + 3, 0, 100);
    if (target.hp <= 0) {
      target.hp = 0; target.alive = false; target.atb = 0; target.status = {};
      if (!target.enemy && battle.metrics) battle.metrics.knockouts++;
      emit(battle, { type: 'ko', source: source.id, target: target.id, text: target.name + ' falls.' });
    } else if (target.enemy && ENEMIES[target.baseId].phases && ENEMIES[target.baseId].phases[target.phase - 1] && target.hp <= target.maxHp * ENEMIES[target.baseId].phases[target.phase - 1].at) {
      const phase = ENEMIES[target.baseId].phases[target.phase - 1];
      target.phase++; target.phaseTurn = 0; target.phaseLabel = phase.name; target.phaseHint = phase.hint;
      target.phaseMoves = phase.moves.slice(); target.weak = phase.weak.slice(); target.resist = (phase.resist || []).slice();
      target.status = {}; target.break = 0; target.broken = false; target.atb = Math.min(target.atb, 35);
      target.atk = Math.round(target.atk * (phase.attack || 1)); target.mag = Math.round(target.mag * (phase.magic || 1)); target.spd += phase.speed || 0;
      target.nextPhase = ENEMIES[target.baseId].phases[target.phase - 1] ? copy(ENEMIES[target.baseId].phases[target.phase - 1]) : null;
      emit(battle, { type: 'phase', source: target.id, target: target.id, value: target.phase, text: target.name + ': ' + phase.name + '. ' + phase.hint });
      planIntent(battle, target);
    } else if (target.final && target.phase === 1 && target.hp <= target.maxHp * 0.5) {
      target.phase = 2; target.status = {}; target.atb = Math.min(target.atb, 55);
      emit(battle, { type: 'phase', source: target.id, target: target.id, value: 2, text: 'Still Star: The Last Movement. Its voice changes.' });
      planIntent(battle, target);
    }
    return amount;
  }
  function pressure(battle, source, target, spec, weak) {
    if (source.enemy || !target.enemy || !target.alive || !target.breakMax || target.broken || target.lastBreakTurn === battle.turns) return;
    target.lastBreakTurn = battle.turns;
    const amount = 1 + (weak ? 2 : 0) + (spec.breakPower || 0) + (source.breakPower || 0);
    target.break = Math.min(target.breakMax, target.break + amount);
    emit(battle, { type: 'pressure', source: source.id, target: target.id, value: amount, total: target.break, max: target.breakMax });
    if (target.break >= target.breakMax) {
      const canceled = target.intent.label;
      target.break = 0; target.broken = true; target.breaks++; target.atb = 0;
      if (battle.metrics) battle.metrics.breaks++;
      target.intent = { ...target.intent, label: 'Recover from Break', name: 'Recover from Break', dangerous: false, canceled };
      emit(battle, { type: 'break', source: source.id, target: target.id, value: target.breaks, text: target.name + ' breaks. ' + canceled + ' is canceled. Damage rises by 25% until it recovers.' });
    }
  }
  function damage(battle, source, target, spec, multiplier = 1) {
    const physical = spec.kind === 'physical' || spec.kind === 'steal';
    const element = spec.element || (physical && source.element) || 'physical';
    const weak = (target.weak || []).includes(element), resist = (target.resist || []).includes(element);
    const critical = physical && rand(battle) < (source.baseId === 'sable' ? 0.16 : 0.08);
    if (physical && source.status.blind && rand(battle) < 0.35) { emit(battle, { type: 'miss', source: source.id, target: target.id, text: source.name + ' misses.' }); return 0; }
    if (physical && !target.enemy && target.hp < target.maxHp * 0.45) {
      const guard = alive(battle, false).find(h => h.id !== target.id && h.status.cover);
      if (guard) { emit(battle, { text: guard.name + ' protects ' + target.name + '.', source: guard.id, target: target.id }); target = guard; }
    }
    const stat = physical ? source.atk : source.mag;
    let amount = (stat * (physical ? 1.48 : 1.36) + source.level * (physical ? 1.0 : 1.25) + 5) * (spec.power || 1) * multiplier;
    if (!spec.pierce) amount -= target.def * (physical ? 0.52 : 0.28) * multiplier;
    amount *= 0.94 + rand(battle) * 0.12;
    if (weak) amount *= 1.65;
    if (resist) amount *= 0.55;
    if (critical) amount *= 1.5;
    if (source.status[physical ? 'brave' : 'focus']) amount *= 1.3;
    if (target.status.guard) amount *= 0.5;
    if (target.status[physical ? 'ward' : 'barrier']) amount *= 0.65;
    if (target.status.exposed) amount *= 1.25;
    if (target.broken) amount *= 1.25;
    if (source.enemy) amount *= DIFFICULTIES[battle.difficulty].damage;
    if (source.final && source.phase === 2) amount *= 1.12;
    const phase = target.phase;
    const dealt = harm(battle, source, target, Math.max(2, amount), { element, weak, resisted: resist, critical });
    if (target.phase === phase) pressure(battle, source, target, spec, weak);
    if (spec.drain && source.alive) heal(battle, source, source, dealt * spec.drain);
    if (spec.status) applyStatus(battle, source, target, spec.status, spec.duration || 3, spec.chance == null ? 1 : spec.chance);
    return dealt;
  }
  function checkResult(battle) {
    if (battle.result) return battle.result;
    if (!alive(battle, true).length) {
      battle.result = 'victory'; battle.ready = null;
      emit(battle, { type: 'victory', text: battle.final ? 'The song is yours again.' : 'Victory. The road is open.' });
    } else if (!alive(battle, false).length) {
      battle.result = 'defeat'; battle.ready = null;
      emit(battle, { type: 'defeat', text: 'The party falls. You can return to the last safe place.' });
    }
    return battle.result;
  }
  function revive(battle, source, target, fraction) {
    if (target.alive) return;
    target.alive = true; target.hp = Math.max(1, Math.round(target.maxHp * fraction)); target.atb = 35; target.status = {};
    if (target.regen) target.status.regen = 999;
    emit(battle, { type: 'heal', source: source.id, target: target.id, value: target.hp, element: 'revive', text: target.name + ' stands again.' });
  }
  function perform(battle, unit, spec, targets) {
    const partner = spec.bond ? actor(battle, spec.partner) : null;
    const reserve = spec.support ? (battle.reserves || []).find(hero => hero.id === spec.support) : null;
    const powerUnit = reserve ? { ...unit, ...reserve, id: unit.id } : partner ? { ...unit, atk: (unit.atk + partner.atk) / 2, mag: (unit.mag + partner.mag) / 2, breakPower: Math.max(unit.breakPower || 0, partner.breakPower || 0) } : unit;
    emit(battle, { type: 'cast', source: unit.id, target: targets[0] ? targets[0].id : unit.id, value: 0, element: spec.element || (spec.kind === 'physical' ? 'physical' : spec.kind), command: spec.id, targets: targets.map(t => t.id), text: unit.name + ' uses ' + spec.name + '.' });
    if (spec.kind === 'flee') {
      battle.result = 'fled'; battle.ready = null; emit(battle, { type: 'fled', source: unit.id, text: 'The party leaves the battle.' }); return;
    }
    if (spec.kind === 'guard') {
      unit.status.guard = 999; heal(battle, unit, unit, 4 + Math.floor(unit.level / 8), true);
      if (!unit.enemy) battle.resonance = clamp(battle.resonance + 5, 0, 100);
    } else if (spec.kind === 'item') {
      const target = targets[0]; battle.bag[spec.item]--;
      if (spec.item === 'tonic') heal(battle, unit, target, target.maxHp * 0.45 + 50);
      if (spec.item === 'ether') heal(battle, unit, target, target.maxMp * 0.2 + 35, true);
      if (spec.item === 'revive') revive(battle, unit, target, 0.45);
      if (spec.item === 'remedy') cleanseTarget(battle, unit, target);
    } else if (spec.kind === 'revive') targets.forEach(target => revive(battle, unit, target, spec.power));
    else if (spec.kind === 'heal') targets.forEach(target => {
      heal(battle, unit, target, (powerUnit.mag * 1.7 + unit.level * 2.2 + 24) * spec.power);
      if (spec.cleanse) cleanseTarget(battle, unit, target);
      if (spec.status) applyStatus(battle, unit, target, spec.status, spec.duration || 3);
    });
    else if (spec.kind === 'cleanse') targets.forEach(target => cleanseTarget(battle, unit, target));
    else if (spec.kind === 'buff' || spec.kind === 'debuff') targets.forEach(target => {
      applyStatus(battle, unit, target, spec.status, spec.duration || 3, spec.chance == null ? 1 : spec.chance);
      if (spec.extraStatus) applyStatus(battle, unit, target, spec.extraStatus, spec.duration || 3);
    });
    else if (spec.kind === 'summon') {
      const echo = ECHOES[spec.echo]; battle.summoned.push(spec.echo);
      if (echo.summonHeal) {
        targets.forEach(target => { if (!target.alive && echo.summonRevive) revive(battle, unit, target, 0.65); else heal(battle, unit, target, target.maxHp * 0.65); cleanseTarget(battle, unit, target); });
      } else targets.forEach(target => damage(battle, unit, target, spec));
      if (echo.summonStatus) alive(battle, false).forEach(target => applyStatus(battle, unit, target, echo.summonStatus, 4));
    } else if (spec.kind === 'chorus') {
      battle.resonance = 0;
      const members = alive(battle, false), mean = members.reduce((n, h) => n + h.mag + h.atk * 0.4, 0) / members.length;
      targets.forEach(target => {
        const weak = (target.weak || []).includes('sound'), phase = target.phase;
        harm(battle, unit, target, (mean * 4 + unit.level * 8) * (target.broken ? 1.25 : 1), { element: 'sound', weak });
        if (target.phase === phase) pressure(battle, unit, target, spec, weak);
      });
      members.forEach(target => { heal(battle, unit, target, target.maxHp * 0.23); cleanseTarget(battle, unit, target); });
      battle.resonance = 0;
    } else {
      if (spec.kind === 'steal') {
        const target = targets[0];
        if (!target.stolen) {
          const item = ENEMIES[target.baseId].steal; target.stolen = true; battle.bag[item] = (battle.bag[item] || 0) + 1; battle.stolen.push(item);
          emit(battle, { type: 'item', source: unit.id, target: target.id, item, value: 1, text: unit.name + ' takes ' + ITEMS[item].name + '.' });
        } else emit(battle, { text: 'There is nothing left to take.', source: unit.id, target: target.id });
      }
      const hits = spec.hits || 1;
      for (let hit = 0; hit < hits; hit++) targets.forEach(target => { if (target.alive) damage(battle, powerUnit, target, spec, 1 / hits); });
    }
    if (spec.delay) targets.forEach(target => { if (target.enemy && target.alive) target.atb = Math.max(0, target.atb - spec.delay); });
    if (spec.partyStatus || spec.partyExtraStatus || spec.partyHeal || spec.partyMp) alive(battle, false).forEach(target => {
      if (spec.partyStatus) applyStatus(battle, unit, target, spec.partyStatus, spec.duration || 3);
      if (spec.partyExtraStatus) applyStatus(battle, unit, target, spec.partyExtraStatus, spec.duration || 3);
      if (spec.partyHeal) heal(battle, unit, target, target.maxHp * spec.partyHeal);
      if (spec.partyMp) heal(battle, unit, target, spec.partyMp, true);
    });
    if (!unit.enemy && spec.kind !== 'chorus') {
      battle.resonance = clamp(battle.resonance + (spec.resonance || 3), 0, 100);
      if (spec.element && battle.lastElement && spec.element !== battle.lastElement && battle.lastSource !== unit.id) {
        battle.resonance = clamp(battle.resonance + 5, 0, 100);
        emit(battle, { type: 'combo', source: unit.id, value: 5, text: 'Different voices join. Chorus +5.' });
      }
      if (spec.element) { battle.lastElement = spec.element; battle.lastSource = unit.id; }
    }
    checkResult(battle);
  }
  function spendTurn(battle, unit, spec, targets) {
    delete unit.status.guard;
    if (battle.metrics) {
      if (unit.enemy) battle.metrics.enemyActions++;
      else { battle.metrics.actions++; if (spec.kind === 'item') battle.metrics.itemsUsed++; }
    }
    if (spec.support) {
      battle.supportUsed = spec.support;
      if (battle.metrics) battle.metrics.supportUses++;
      emit(battle, { type: 'support', hero: spec.support, source: unit.id, target: targets[0]?.id || unit.id, command: spec.id, value: 1, text: HEROES[spec.support].name + ' answers the Support call. The shared call is now used.' });
    }
    if (spec.bond) {
      const partner = actor(battle, spec.partner);
      partner.mp -= spec.cost; partner.atb = Math.max(0, partner.atb - 50); delete partner.status.guard;
      battle.resonance -= spec.chorusCost;
      emit(battle, { type: 'bond', source: unit.id, target: partner.id, value: spec.chorusCost, command: spec.id, text: unit.name + ' and ' + partner.name + ' act together. ' + spec.chorusCost + ' Chorus spent.' });
    }
    unit.mp = Math.max(0, unit.mp - (unit.enemy ? 0 : spec.cost || 0));
    const old = { ...unit.status };
    unit.atb = 0; unit.turn++; battle.turns++; if (unit.phaseTurn != null) unit.phaseTurn++;
    perform(battle, unit, spec, targets);
    Object.keys(old).forEach(key => {
      if (unit.status[key] === old[key] && old[key] < 999 && !['poison', 'burn', 'regen', 'stun'].includes(key)) {
        unit.status[key]--; if (unit.status[key] <= 0) delete unit.status[key];
      }
    });
    if (unit.enemy && unit.alive && !battle.result) planIntent(battle, unit);
    refreshReady(battle);
  }
  function act(battle, actorId, commandId, targetId) {
    const unit = actor(battle, actorId);
    if (!unit || unit.enemy || !unit.alive || unit.atb < 100 || battle.result) return { ok: false, reason: 'This hero is not ready.' };
    const command = commands(battle, actorId).find(c => c.id === commandId);
    if (!command || !command.enabled) return { ok: false, reason: 'This command is not available.' };
    const targets = selectTargets(battle, unit, command, targetId);
    if (!targets.length && !['none'].includes(command.target)) return { ok: false, reason: 'Choose a valid target.' };
    const eventStart = battle.events.length;
    spendTurn(battle, unit, command, targets);
    return { ok: true, command: commandId, source: actorId, targets: targets.map(t => t.id), events: battle.events.slice(eventStart), result: battle.result };
  }
  function beginTurn(battle, unit) {
    for (const key of ['poison', 'burn']) if (unit.status[key]) {
      harm(battle, unit, unit, unit.maxHp * (key === 'poison' ? 0.06 : 0.04), { element: key });
      if (unit.status[key]) { unit.status[key]--; if (unit.status[key] <= 0) delete unit.status[key]; }
      if (!unit.alive) break;
    }
    if (!unit.alive) { checkResult(battle); return false; }
    if (unit.status.regen) {
      heal(battle, unit, unit, unit.maxHp * 0.09);
      if (unit.status.regen < 999) { unit.status.regen--; if (unit.status.regen <= 0) delete unit.status.regen; }
    }
    if (unit.broken) {
      unit.broken = false; unit.atb = 55; unit.turn++; battle.turns++; if (unit.phaseTurn != null) unit.phaseTurn++;
      planIntent(battle, unit);
      emit(battle, { type: 'recover', source: unit.id, target: unit.id, text: unit.name + ' recovers. Its next action is ' + unit.intent.label + '.' });
      return false;
    }
    // A damage-over-time tick can start a new phase and lower the gauge.
    // That phase must wait for its newly shown intent to fill again.
    if (unit.atb < 100) return false;
    if (unit.status.stun) {
      delete unit.status.stun; unit.atb = 0; unit.turn++; battle.turns++;
      emit(battle, { text: unit.name + ' loses a turn to Stun.', source: unit.id });
      if (unit.enemy) planIntent(battle, unit);
      return false;
    }
    return true;
  }
  function updateBattle(battle, dt, options = {}) {
    if (battle.result || !Number.isFinite(dt) || dt <= 0) return battle;
    const wait = options.wait !== false, speed = clamp(Number(options.speed) || 1, 0.25, 4);
    if (wait && refreshReady(battle)) return battle;
    let remaining = Math.min(dt, 60) * speed;
    while (remaining > 0.0000001 && !battle.result) {
      const step = Math.min(remaining, 0.05); remaining -= step; battle.time += step;
      const reached = [];
      for (const unit of battle.actors) {
        if (!unit.alive || unit.atb >= 100) continue;
        let rate = unit.enemy ? 10.8 + unit.spd * 0.22 : 11 + unit.spd * 0.24;
        if (unit.enemy) rate *= DIFFICULTIES[battle.difficulty].speed;
        if (unit.status.haste) rate *= 1.5;
        if (unit.status.slow) rate *= 0.5;
        unit.atb = Math.min(100, unit.atb + rate * step);
        if (unit.atb >= 100) reached.push(unit);
      }
      // A hero who becomes ready pauses time before an enemy action in wait mode.
      reached.sort((a, b) => Number(a.enemy) - Number(b.enemy) || a.index - b.index);
      for (const unit of reached) {
        if (!unit.alive || battle.result) continue;
        if (!beginTurn(battle, unit)) continue;
        unit.readyOrder = ++battle.readySerial;
        if (!unit.enemy) continue;
        if (wait && refreshReady(battle)) continue;
        let spec = SKILLS[unit.intent.id];
        if (unit.status.silence && ['magic', 'heal', 'revive', 'debuff'].includes(spec.kind)) spec = SKILLS.attack;
        let targets = selectTargets(battle, unit, spec, unit.intent.target);
        if (!targets.length) targets = selectTargets(battle, unit, spec, null);
        spendTurn(battle, unit, spec, targets);
      }
      // Enemies held at a full gauge resume when the command menu closes.
      if (!(wait && refreshReady(battle))) for (const unit of battle.enemies) {
        if (!unit.alive || unit.atb < 100 || battle.result) continue;
        let spec = SKILLS[unit.intent.id];
        if (unit.status.silence && ['magic', 'heal', 'revive', 'debuff'].includes(spec.kind)) spec = SKILLS.attack;
        let targets = selectTargets(battle, unit, spec, unit.intent.target);
        if (!targets.length) targets = selectTargets(battle, unit, spec, null);
        spendTurn(battle, unit, spec, targets);
      }
      refreshReady(battle);
      if (wait && battle.ready) break;
    }
    checkResult(battle);
    return battle;
  }

  function settleBattle(state, battle) {
    if (!battle.result) return { ok: false, reason: 'The battle is not over.' };
    if (battle.settled) return { ...copy(battle.rewards), alreadySettled: true };
    battle.settled = true;
    // Practice restores the exact campaign position. It cannot grant stolen items or AP.
    if (battle.practice) {
      const rewards = { ok: true, result: battle.result, practice: true, xp: 0, gold: 0, ap: 0, items: [], materials: [], levels: [], learned: [], stolen: [], time: battle.time };
      battle.rewards = copy(rewards); return rewards;
    }
    battle.heroes.forEach(unit => {
      if (state.roster[unit.id]) { state.roster[unit.id].hp = unit.hp; state.roster[unit.id].mp = unit.mp; }
    });
    state.bag = copy(battle.bag); state.seed = battle.seed; state.resonance = Math.round(battle.resonance);
    state.bestiary = state.bestiary || {};
    unique(battle.seen).forEach(id => {
      const entry = state.bestiary[id] || { seen: 0, defeated: 0 };
      entry.seen += battle.seen.filter(e => e === id).length;
      entry.defeated += battle.enemies.filter(e => e.baseId === id && !e.alive).length;
      state.bestiary[id] = entry;
    });
    const rewards = { ok: true, result: battle.result, xp: 0, gold: 0, ap: 0, items: [], levels: [], learned: [], stolen: battle.stolen.slice(), time: battle.time };
    if (battle.result === 'victory') {
      rewards.xp = battle.enemies.reduce((sum, unit) => sum + (unit.boss ? 110 + battle.level * 28 : 30 + battle.level * 9), 0);
      rewards.gold = battle.enemies.reduce((sum, unit) => sum + (unit.boss ? 100 + battle.level * 20 : 18 + battle.level * 6), 0);
      rewards.ap = battle.boss ? 3 : 1;
      state.gold += rewards.gold;
      Object.keys(state.roster).forEach(id => {
        const h = state.roster[id], oldStats = getStats(state, id), oldLevel = h.level;
        h.xp += rewards.xp; h.level = levelForXP(h.xp);
        const stats = getStats(state, id);
        if (h.level > oldLevel) {
          // Reserves receive full XP. A level gain restores HP and MP for all heroes.
          h.hp = stats.maxHp; h.mp = stats.maxMp;
          rewards.levels.push({ id, name: HEROES[id].name, from: oldLevel, to: h.level, level: h.level });
        } else {
          if (h.hp <= 0) h.hp = Math.max(1, Math.round(stats.maxHp * 0.2));
          else h.hp = Math.min(stats.maxHp, h.hp + Math.round(stats.maxHp * 0.08));
          h.mp = Math.min(stats.maxMp, h.mp + Math.max(2, Math.round(oldStats.maxMp * 0.08)));
        }
        if (ECHOES[h.echo]) ECHOES[h.echo].learn.forEach(lesson => {
          h.ap[lesson.skill] = (h.ap[lesson.skill] || 0) + rewards.ap;
          if (h.ap[lesson.skill] >= lesson.ap && !h.learned.includes(lesson.skill) && !HEROES[id].spells.includes(lesson.skill)) {
            h.learned.push(lesson.skill); rewards.learned.push({ id, name: HEROES[id].name, skill: lesson.skill, label: SKILLS[lesson.skill].name });
          }
        });
      });
      const drop = battle.boss ? 'ether' : rand(battle) < 0.75 ? 'tonic' : 'remedy';
      state.bag[drop] = (state.bag[drop] || 0) + 1; rewards.items.push({ id: drop, count: 1 });
      if (battle.boss) { state.bag.revive = (state.bag.revive || 0) + 1; rewards.items.push({ id: 'revive', count: 1 }); }
      if (CC.Frontier) CC.Frontier.onBattleSettled(state, battle, rewards);
      state.seed = battle.seed;
    }
    battle.rewards = copy(rewards);
    return rewards;
  }
  function buy(state, id, count = 1) {
    const item = ITEMS[id] || EQUIPMENT[id]; count = integer(count, 1, 1, 99);
    if (item && item.craftOnly) return { ok: false, reason: 'Make this equipment at a workshop.' };
    if (!item || state.gold < item.price * count) return { ok: false, reason: 'You need more gold.' };
    state.gold -= item.price * count; state.bag[id] = (state.bag[id] || 0) + count;
    return { ok: true };
  }
  function sell(state, id, count = 1) {
    const item = ITEMS[id] || EQUIPMENT[id]; count = integer(count, 1, 1, 99);
    if (!item || (state.bag[id] || 0) < count) return { ok: false, reason: 'The bag does not have that many items.' };
    state.bag[id] -= count; state.gold += Math.floor(item.price / 2) * count;
    return { ok: true };
  }
  function validateSave(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.version !== 1 || !data.roster || typeof data.roster !== 'object' || !data.roster.iona || !Array.isArray(data.party) || data.party.length < 1 || data.party.length > 4 || unique(data.party).length !== data.party.length || data.party.some(id => !HEROES[id] || !data.roster[id])) return false;
    if (!data.bag || typeof data.bag !== 'object' || Array.isArray(data.bag) || !data.flags || typeof data.flags !== 'object') return false;
    if (!Array.isArray(data.echoes) || data.echoes.some(id => !ECHOES[id]) || !Array.isArray(data.cleared) || !Array.isArray(data.chests)) return false;
    if (!Number.isFinite(data.gold) || data.gold < 0 || data.gold > 99999999 || !Number.isFinite(data.playTime) || data.playTime < 0) return false;
    if (!Object.values(data.bag).every(n => Number.isInteger(n) && n >= 0 && n <= 999999)) return false;
    const assigned = [];
    for (const [id, h] of Object.entries(data.roster)) {
      if (!HEROES[id] || !h || !Number.isInteger(h.level) || h.level < 1 || h.level > 50 || !Number.isFinite(h.xp) || h.xp < 0 || !Number.isFinite(h.hp) || h.hp < 0 || !Number.isFinite(h.mp) || h.mp < 0 || !Array.isArray(h.learned) || h.learned.some(skill => !SKILLS[skill]) || !h.ap || typeof h.ap !== 'object') return false;
      for (const slot of ['weapon', 'armor', 'relic']) if (h[slot] && (!EQUIPMENT[h[slot]] || EQUIPMENT[h[slot]].slot !== slot)) return false;
      if (h.echo && (!ECHOES[h.echo] || !data.echoes.includes(h.echo))) return false;
      if (h.echo) assigned.push(h.echo);
    }
    return unique(assigned).length === assigned.length && (!CC.Frontier || CC.Frontier.validate(data)) && (!CC.Undertide || CC.Undertide.validate(data)) && (!CC.Journey || CC.Journey.validate(data));
  }
  function serialize(state) { if (!validateSave(state)) throw new Error('The save data is invalid.'); return JSON.stringify(state); }
  function deserialize(text) {
    try { if (typeof text !== 'string' && !validateSave(text)) return null; const state = typeof text === 'string' ? JSON.parse(text) : copy(text); if (!validateSave(state)) return null; if (CC.Frontier) CC.Frontier.ensure(state); if (CC.Undertide) CC.Undertide.ensure(state); if (CC.Journey) CC.Journey.ensure(state); return state; }
    catch (_) { return null; }
  }
  // This choice helper is also used by the test suite. It does not change battle state.
  function autoChoice(battle, actorId) {
    const unit = actor(battle, actorId), list = commands(battle, actorId).filter(c => c.enabled);
    if (!unit || !list.length) return null;
    const hurt = battle.heroes.filter(h => h.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp), fallen = battle.heroes.find(h => !h.alive);
    const choose = (id, target) => list.some(c => c.id === id) ? { command: id, target } : null;
    if (fallen) {
      const raiseChoice = choose('raise', fallen.id) || choose('item:revive', fallen.id) || choose('summon:dawn');
      if (raiseChoice) return raiseChoice;
    }
    if (hurt[0] && hurt[0].hp < hurt[0].maxHp * 0.4) {
      const pairHeal = list.find(c => c.bond && c.kind === 'heal');
      const healChoice = pairHeal ? choose(pairHeal.id, hurt[0].id) : choose('sanctuary', hurt[0].id) || choose('chorusheal', hurt[0].id) || choose('mending', hurt[0].id) || choose('mend', hurt[0].id) || choose('item:tonic', hurt[0].id);
      if (healChoice) return healChoice;
    }
    if (battle.resonance >= 100) return choose('chorus');
    const target = alive(battle, true).sort((a, b) => a.hp - b.hp)[0];
    if (!target) return choose('defend');
    const viable = list.filter(c => ['physical', 'magic', 'summon'].includes(c.kind) && (!c.echo || !ECHOES[c.echo].summonHeal));
    viable.sort((a, b) => {
      const score = c => (c.power || 1) * (c.kind === 'physical' ? unit.atk : unit.mag) * ((target.weak || []).includes(c.element) ? 1.65 : (target.resist || []).includes(c.element) ? 0.55 : 1) * (c.target === 'allEnemies' ? alive(battle, true).length : 1) / (1 + c.cost * 0.025) * (target.breakMax && !target.broken && ((target.weak || []).includes(c.element) || c.breakPower) ? 1.12 : 1);
      return score(b) - score(a);
    });
    return viable.length ? { command: viable[0].id, target: target.id } : choose('attack', target.id);
  }

  CC.RPG = { version: '3.0.0', originalHeroIds: Object.freeze(Object.keys(HEROES)), heroes: HEROES, enemies: ENEMIES, skills: SKILLS, echoes: ECHOES, equipment: EQUIPMENT, items: ITEMS, statuses: STATUS, difficulties: DIFFICULTIES, newGame, getStats, healParty, fullHeal: healParty, grantXP, recruit, setParty, equip, useItem, knownSpells, supportHeroes, xpForLevel, levelForXP, createBattle, updateBattle, commands, act, settleBattle, validateSave, serialize, deserialize, buy, sell, autoChoice, actor, copy };
})(globalThis);
