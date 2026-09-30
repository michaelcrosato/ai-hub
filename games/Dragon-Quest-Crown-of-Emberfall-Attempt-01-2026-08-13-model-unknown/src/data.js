// Crown of Emberfall: every map, item, spell, foe, shop, quest and line of story.
// Transcribed from the original build; the Hushed Belfry (map, foes, items, quest)
// is new content added in the 3D-kit upgrade.

// ---- tile helpers -----------------------------------------------------------

const tile = (kind, blocked = false, elevation = 0) => ({ kind, blocked, elevation });
const grid = (w, h, kind) => Array.from({ length: h }, () => Array.from({ length: w }, () => tile(kind)));

/** Fill a w×h rectangle at (x, y). */
function fill(tiles, kind, x, y, w, h, blocked = false, elevation = 0) {
  for (let r = y; r < y + h; r += 1) for (let c = x; c < x + w; c += 1) if (tiles[r]?.[c]) tiles[r][c] = tile(kind, blocked, elevation);
}

/** A raised, blocking ring around the map. */
function border(tiles, kind, blocked = true) {
  const h = tiles.length;
  const w = tiles[0].length;
  fill(tiles, kind, 0, 0, w, 1, blocked, 1);
  fill(tiles, kind, 0, h - 1, w, 1, blocked, 1);
  fill(tiles, kind, 0, 0, 1, h, blocked, 1);
  fill(tiles, kind, w - 1, 0, 1, h, blocked, 1);
}

/** Walk from point to point (x first, then y), laying a walkable path. */
function path(tiles, points, kind = 'road') {
  for (let i = 0; i < points.length - 1; i += 1) {
    let [x, y] = points[i];
    const [tx, ty] = points[i + 1];
    while (x !== tx || y !== ty) {
      if (tiles[y]?.[x]) tiles[y][x] = tile(kind);
      if (x !== tx) x += Math.sign(tx - x);
      else if (y !== ty) y += Math.sign(ty - y);
    }
    if (tiles[ty]?.[tx]) tiles[ty][tx] = tile(kind);
  }
}

const props = (...rows) => rows.map(([id, kind, x, y, color, solid]) => ({ id, kind, x, y, color, solid }));
const npcs = (...rows) => rows.map(([id, name, x, y, color, role, shopId]) => ({ id, name, x, y, color, role, shopId }));
const chests = (...rows) => rows.map(([id, x, y, itemId, amount, gold]) => ({ id, x, y, itemId, amount, gold }));

// ---- maps -------------------------------------------------------------------

function emberfall() {
  const t = grid(28, 22, 'grass');
  border(t, 'water', true);
  fill(t, 'water', 10, 1, 3, 8, true);
  fill(t, 'bridge', 10, 6, 3, 1, false);
  fill(t, 'water', 16, 10, 11, 3, true);
  fill(t, 'bridge', 21, 10, 1, 3, false);
  fill(t, 'sand', 12, 12, 9, 8);
  fill(t, 'marsh', 3, 13, 7, 6);
  fill(t, 'ice', 20, 2, 6, 6);
  path(t, [[4, 6], [10, 6], [14, 9], [14, 14], [21, 14], [22, 6], [25, 6]]);
  path(t, [[14, 14], [9, 17], [5, 17]]);
  path(t, [[21, 14], [24, 18]]);
  // New: the old pilgrim road north to the Hushed Belfry.
  path(t, [[14, 6], [14, 3], [16, 3]]);
  for (const [x, y] of [[2, 2], [3, 2], [4, 2], [6, 3], [7, 3], [8, 3], [18, 3], [19, 3], [25, 10], [24, 10], [2, 18], [3, 18]]) t[y][x] = tile('mountain', true, 2);
  for (const [x, y] of [[2, 8], [3, 8], [4, 8], [5, 8], [3, 9], [4, 9], [6, 10], [7, 10], [8, 10], [7, 11], [17, 6], [18, 6], [18, 7]]) t[y][x] = tile('forest', false, 1);
  return {
    id: 'emberfall',
    name: 'Emberfall',
    subtitle: 'A realm beneath a fading sun',
    type: 'overworld',
    width: 28,
    height: 22,
    tiles: t,
    tint: '#78c66b',
    sky: '#8fd7ff',
    recommendedLevel: 1,
    props: props(
      ['world_hearth', 'castle', 4, 5, '#fff0a8', false],
      ['world_moss', 'shrine', 5, 10, '#79a866', false],
      ['world_tide', 'house', 14, 13, '#69d9df', false],
      ['world_sunken', 'shrine', 6, 17, '#678bc2', false],
      ['world_gale', 'tower', 22, 6, '#e8f4ff', false],
      ['world_spire', 'crystal', 25, 6, '#b0efff', false],
      ['world_citadel', 'castle', 24, 18, '#4c3249', false],
      ['world_belfry', 'belfry', 16, 3, '#6f5f95', false],
      ['tree_a', 'tree', 2, 7],
      ['tree_b', 'tree', 5, 8],
      ['tree_c', 'tree', 8, 9],
      ['tree_d', 'tree', 17, 5],
      ['tree_e', 'pine', 20, 4],
      ['tree_f', 'pine', 23, 3],
      ['rock_a', 'rock', 9, 4],
      ['rock_b', 'rock', 18, 15],
      ['flowers_a', 'flowers', 7, 6],
      ['flowers_b', 'flowers', 13, 8],
    ),
    npcs: [],
    exits: [
      { x: 4, y: 5, to: 'hearthglen', toX: 7, toY: 12, label: 'Hearthglen' },
      { x: 5, y: 10, to: 'mossroot', toX: 1, toY: 12, label: 'Mossroot Hollow', minStage: 1 },
      { x: 14, y: 13, to: 'tidehaven', toX: 7, toY: 12, label: 'Tidehaven', minStage: 3 },
      { x: 6, y: 17, to: 'sunken', toX: 1, toY: 12, label: 'Sunken Shrine', minStage: 3 },
      { x: 22, y: 6, to: 'galecrest', toX: 7, toY: 12, label: 'Galecrest', minStage: 5 },
      { x: 25, y: 6, to: 'skyglass', toX: 1, toY: 12, label: 'Skyglass Spire', minStage: 5 },
      { x: 24, y: 18, to: 'citadel', toX: 1, toY: 13, label: 'Obsidian Citadel', minStage: 7, deniedText: 'Three empty braziers guard the sealed gate.' },
      {
        x: 16,
        y: 3,
        to: 'belfry',
        toX: 7,
        toY: 14,
        label: 'Hushed Belfry',
        minStage: 7,
        deniedText: 'A hush presses against the belfry door. It will not open while the Embers sleep.',
      },
    ],
    chests: chests(['world_cache', 18, 17, 'wayfarer_tonic', 1]),
    bosses: [],
    encounterTier: 'world',
  };
}

function hearthglen() {
  const t = grid(16, 14, 'grass');
  border(t, 'water', true);
  fill(t, 'road', 6, 1, 3, 13);
  fill(t, 'road', 2, 7, 12, 3);
  fill(t, 'floor', 5, 1, 5, 3);
  return {
    id: 'hearthglen',
    name: 'Hearthglen',
    subtitle: 'Village of the First Flame',
    type: 'town',
    width: 16,
    height: 14,
    tiles: t,
    tint: '#89d66f',
    sky: '#95dcff',
    props: props(
      ['keep', 'castle', 7, 1, '#fff0ae', true],
      ['home_1', 'house', 2, 4, '#ef8b55', true],
      ['home_2', 'house', 12, 4, '#7fb9e8', true],
      ['shop_1', 'house', 2, 10, '#ffd05a', true],
      ['inn_1', 'house', 12, 10, '#ef8ec7', true],
      ['well', 'well', 8, 8, '#b7d1dc', true],
      ['tree_1', 'tree', 3, 2],
      ['tree_2', 'tree', 12, 2],
      ['tree_3', 'tree', 4, 11],
      ['flower_1', 'flowers', 10, 6],
    ),
    npcs: npcs(
      ['king_orin', 'King Orin', 7, 3, '#f3c94f', 'story'],
      ['merchant_pip', 'Pip', 3, 9, '#e78a3c', 'shop', 'hearth_shop'],
      ['innkeeper_mae', 'Mae', 11, 9, '#ec7aa9', 'inn'],
      ['healer_ivy', 'Ivy', 4, 6, '#6ecb77', 'quest'],
      ['smith_bram', 'Bram', 11, 6, '#6b7f94', 'quest'],
      ['elder_toma', 'Toma', 7, 10, '#8d6e63', 'quest'],
    ),
    exits: [{ x: 7, y: 13, to: 'emberfall', toX: 4, toY: 6, label: 'Emberfall' }],
    chests: chests(['hearth_chest', 14, 2, 'herb', 2]),
    bosses: [],
  };
}

/** The shared dungeon layout; the theme picks floor, hazards and décor. */
function dungeon(id, name, subtitle, tint, sky, theme) {
  const w = theme === 'fire' ? 20 : 18;
  const h = theme === 'fire' ? 16 : 15;
  const t = grid(w, h, theme === 'ice' ? 'ice' : 'floor');
  border(t, theme === 'moss' ? 'wall' : theme === 'water' ? 'water' : theme === 'fire' ? 'lava' : 'wall', true);
  const hazard = theme === 'moss' ? 'marsh' : theme === 'water' ? 'water' : theme === 'ice' ? 'wall' : 'lava';
  const sink = theme === 'fire' ? -1 : 0;
  fill(t, hazard, 4, 3, 2, 7, true, sink);
  fill(t, hazard, 10, 5, 2, 8, true, sink);
  fill(t, hazard, 14, 2, 2, 5, true, sink);
  path(t, [[1, h - 3], [3, h - 3], [3, 11], [8, 11], [8, 3], [13, 3], [13, 8], [w - 3, 8], [w - 3, 2]], 'bridge');
  path(t, [[8, 11], [13, 11], [13, 8]], 'bridge');
  const decor = theme === 'moss' ? 'tree' : theme === 'ice' ? 'crystal' : theme === 'fire' ? 'torch' : 'column';
  const back = { mossroot: [5, 11], sunken: [6, 18], skyglass: [25, 7] }[id] || [24, 19];
  return {
    id,
    name,
    subtitle,
    type: 'dungeon',
    width: w,
    height: h,
    tiles: t,
    tint,
    sky,
    props: props(
      [`${id}_d1`, decor, 2, 3, tint, true],
      [`${id}_d2`, decor, 7, 7, tint, true],
      [`${id}_d3`, decor, 13, 10, tint, true],
      [`${id}_d4`, theme === 'fire' ? 'gate' : 'rock', w - 4, 3, tint, false],
    ),
    npcs: [],
    exits: [{ x: 1, y: h - 3, to: 'emberfall', toX: back[0], toY: back[1], label: 'Emberfall' }],
    chests: [],
    bosses: [],
    encounterTier: id,
  };
}

const mossroot = dungeon('mossroot', 'Mossroot Hollow', 'Roots remember what crowns forget', '#5dbb63', '#243b36', 'moss');
mossroot.chests = chests(['moss_moondew', 3, 4, 'moondew', 1], ['moss_ring', 13, 11, 'oak_charm', 1], ['moss_gold', 8, 2, undefined, undefined, 90]);
mossroot.bosses = [{ id: 'thornmaw_boss', enemyId: 'thornmaw', x: 15, y: 2, minStage: 1, stageAfter: 2, flag: 'boss_thornmaw' }];
mossroot.recommendedLevel = 3;

const sunken = dungeon('sunken', 'Sunken Shrine', 'A temple dreaming beneath blue stone', '#5bc8d9', '#183c62', 'water');
sunken.chests = chests(['sunken_locket', 3, 4, 'silver_locket', 1], ['sunken_mail', 13, 11, 'tide_mail', 1], ['sunken_seed', 8, 2, 'star_seed', 1]);
sunken.bosses = [{ id: 'oracle_boss', enemyId: 'deep_oracle', x: 15, y: 2, minStage: 3, stageAfter: 4, flag: 'boss_oracle' }];
sunken.recommendedLevel = 7;

const skyglass = dungeon('skyglass', 'Skyglass Spire', 'Where thunder nests in crystal', '#9ae9ff', '#4059a9', 'ice');
skyglass.chests = chests(['sky_seed_a', 3, 4, 'star_seed', 1], ['sky_blade', 13, 11, 'gale_blade', 1], ['sky_seed_b', 8, 2, 'star_seed', 1]);
skyglass.bosses = [{ id: 'roc_boss', enemyId: 'tempest_roc', x: 15, y: 2, minStage: 5, stageAfter: 6, flag: 'boss_roc' }];
skyglass.recommendedLevel = 11;

const citadel = dungeon('citadel', 'Obsidian Citadel', 'The wound at the edge of dawn', '#ff765c', '#251c3a', 'fire');
citadel.chests = chests(['citadel_elixir', 3, 4, 'sun_elixir', 2], ['citadel_armor', 13, 11, 'sunplate', 1], ['citadel_sword', 8, 2, 'dawnbrand', 1]);
citadel.bosses = [{ id: 'regent_boss', enemyId: 'ash_regent', x: 17, y: 2, minStage: 7, stageAfter: 8, flag: 'boss_regent' }];
citadel.recommendedLevel = 14;

function tidehaven() {
  const t = grid(16, 14, 'sand');
  border(t, 'water', true);
  fill(t, 'road', 6, 1, 3, 13);
  fill(t, 'road', 2, 7, 12, 2);
  fill(t, 'grass', 1, 1, 4, 5);
  return {
    id: 'tidehaven',
    name: 'Tidehaven',
    subtitle: 'Harbor of bright sails',
    type: 'town',
    width: 16,
    height: 14,
    tiles: t,
    tint: '#e9c875',
    sky: '#68d7ed',
    props: props(
      ['tide_inn', 'house', 2, 4, '#57b8d3', true],
      ['tide_shop', 'house', 12, 4, '#ffb34e', true],
      ['tide_home', 'house', 2, 10, '#f48b8b', true],
      ['tide_boat', 'boat', 12, 10, '#e6f6ff', true],
      ['tide_well', 'well', 8, 8, '#9bcce0', true],
      ['palm_a', 'tree', 4, 2],
      ['palm_b', 'tree', 11, 2],
    ),
    npcs: npcs(
      ['captain_mira', 'Captain Mira', 4, 9, '#e95267', 'quest'],
      ['tide_vendor', 'Nilo', 11, 6, '#ed9a3f', 'shop', 'tide_shop'],
      ['tide_innkeeper', 'Coral', 4, 6, '#51b8b0', 'inn'],
      ['sailor_fenn', 'Fenn', 8, 10, '#6f8ec7', 'talk'],
    ),
    exits: [{ x: 7, y: 13, to: 'emberfall', toX: 14, toY: 14, label: 'Emberfall' }],
    chests: chests(['tide_chest', 14, 2, 'ether_drop', 2]),
    bosses: [],
  };
}

function galecrest() {
  const t = grid(16, 14, 'grass');
  border(t, 'mountain', true);
  fill(t, 'road', 6, 1, 3, 13);
  fill(t, 'road', 2, 7, 12, 2);
  fill(t, 'ice', 1, 1, 4, 4);
  return {
    id: 'galecrest',
    name: 'Galecrest',
    subtitle: 'Village above the clouds',
    type: 'town',
    width: 16,
    height: 14,
    tiles: t,
    tint: '#a6ddc7',
    sky: '#9bd9ff',
    props: props(
      ['gale_tower', 'tower', 7, 1, '#d5f4ff', true],
      ['gale_shop', 'house', 2, 5, '#82b6e9', true],
      ['gale_inn', 'house', 12, 5, '#a98cdb', true],
      ['gale_home', 'house', 12, 10, '#e3bc68', true],
      ['pine_a', 'pine', 3, 10],
      ['pine_b', 'pine', 4, 2],
      ['crystal_a', 'crystal', 10, 3, '#b9f4ff', true],
    ),
    npcs: npcs(
      ['sage_lyra', 'Lyra', 7, 3, '#b392e6', 'quest'],
      ['gale_vendor', 'Orr', 4, 6, '#698bc8', 'shop', 'gale_shop'],
      ['gale_innkeeper', 'Jun', 11, 7, '#79c3a4', 'inn'],
      ['gale_child', 'Kip', 7, 10, '#e3aa4f', 'talk'],
    ),
    exits: [{ x: 7, y: 13, to: 'emberfall', toX: 22, toY: 7, label: 'Emberfall' }],
    chests: chests(['gale_chest', 14, 2, 'wise_charm', 1]),
    bosses: [],
  };
}

/**
 * New: the Hushed Belfry. Three stone terraces climb toward the back of the
 * tower over a dark chasm, joined by two stairways; the Still Bell hangs on
 * the highest one. It opens once the three Embers are restored.
 */
function belfry() {
  const t = grid(16, 16, 'void');
  for (const row of t) for (let c = 0; c < row.length; c += 1) row[c] = tile('void', true, -1);
  border(t, 'wall', true);
  // The two far walls rise above the bell loft; the near ones stay low so they never
  // hide the floor (the courier enters on the row right behind the front wall).
  for (let i = 0; i < 16; i += 1) {
    t[0][i] = tile('wall', true, 2.6);
    t[i][0] = tile('wall', true, 2.6);
  }
  for (let i = 0; i < 16; i += 1) t[15][i] = tile('wall', true, 0.4);
  for (let i = 1; i < 16; i += 1) t[i][15] = tile('wall', true, 0.4);
  // Nave (ground level), the entrance hall at the front.
  fill(t, 'stone', 1, 11, 14, 4, false, 0);
  // East stair up to the gallery.
  fill(t, 'stair', 12, 10, 2, 1, false, 0.34);
  fill(t, 'stair', 12, 9, 2, 1, false, 0.67);
  // Gallery (first landing).
  fill(t, 'stone', 3, 6, 12, 3, false, 1);
  // West stair up to the bell loft.
  fill(t, 'stair', 2, 5, 2, 1, false, 1.34);
  fill(t, 'stair', 2, 4, 2, 1, false, 1.67);
  // Bell loft (top landing).
  fill(t, 'stone', 1, 1, 11, 3, false, 2);
  // The doorway through the front wall.
  t[15][7] = tile('stone', false, 0);
  return {
    id: 'belfry',
    name: 'Hushed Belfry',
    subtitle: 'Where the Still Bell was rung',
    type: 'dungeon',
    width: 16,
    height: 16,
    tiles: t,
    tint: '#8f7fbf',
    sky: '#2b2446',
    recommendedLevel: 15,
    props: props(
      ['belfry_c1', 'column', 2, 12, '#8f7fbf', true],
      ['belfry_c2', 'column', 12, 12, '#8f7fbf', true],
      ['belfry_c3', 'column', 5, 7, '#8f7fbf', true],
      ['belfry_c4', 'column', 11, 7, '#8f7fbf', true],
      ['belfry_t1', 'torch', 4, 13, '#8f7fbf', true],
      ['belfry_t2', 'torch', 9, 7, '#8f7fbf', true],
      ['belfry_t3', 'torch', 9, 2, '#8f7fbf', true],
      ['belfry_bell', 'bellframe', 2, 1, '#c9a14a', true],
    ),
    npcs: [],
    exits: [{ x: 7, y: 15, to: 'emberfall', toX: 16, toY: 4, label: 'Emberfall' }],
    chests: chests(
      ['belfry_tonics', 1, 13, 'wayfarer_tonic', 2],
      ['belfry_charm', 14, 6, 'tollstone_charm', 1],
      ['belfry_elixir', 10, 1, 'sun_elixir', 1],
    ),
    bosses: [{ id: 'bell_boss', enemyId: 'still_bell', x: 5, y: 2, minStage: 7, flag: 'boss_bell' }],
    encounterTier: 'belfry',
  };
}

export const MAPS = {
  emberfall: emberfall(),
  hearthglen: hearthglen(),
  mossroot,
  tidehaven: tidehaven(),
  sunken,
  galecrest: galecrest(),
  skyglass,
  citadel,
  belfry: belfry(),
};

export const TILE_COLORS = {
  grass: '#68bd5e',
  road: '#e8c77a',
  water: '#3bb9dc',
  sand: '#e9c671',
  forest: '#438b55',
  mountain: '#7d8791',
  floor: '#8e8397',
  wall: '#564f65',
  lava: '#e65b42',
  bridge: '#bd874f',
  marsh: '#598f72',
  ice: '#93d9e9',
  stone: '#7d7299',
  stair: '#a397c2',
  void: '#221c36',
};

// ---- items, spells, foes ----------------------------------------------------

export const ITEMS = {
  herb: { id: 'herb', name: 'Sunleaf', kind: 'consumable', description: 'Restores 30 HP.', price: 12, healHp: 30 },
  wayfarer_tonic: { id: 'wayfarer_tonic', name: 'Wayfarer Tonic', kind: 'consumable', description: 'Restores 75 HP.', price: 45, healHp: 75 },
  ether_drop: { id: 'ether_drop', name: 'Ether Drop', kind: 'consumable', description: 'Restores 20 MP.', price: 55, healMp: 20 },
  sun_elixir: { id: 'sun_elixir', name: 'Sun Elixir', kind: 'consumable', description: 'Fully restores HP and MP.', price: 180, healHp: 999, healMp: 999 },
  smoke_pod: { id: 'smoke_pod', name: 'Smoke Pod', kind: 'consumable', description: 'Guarantees escape from a normal battle.', price: 28, battleOnly: true },
  bronze_sword: { id: 'bronze_sword', name: 'Bronze Sword', kind: 'weapon', description: 'A dependable first blade. ATK +4.', price: 45, power: 4 },
  iron_sword: { id: 'iron_sword', name: 'Iron Sword', kind: 'weapon', description: 'A balanced iron blade. ATK +9.', price: 135, power: 9 },
  coral_saber: { id: 'coral_saber', name: 'Coral Saber', kind: 'weapon', description: 'A sea-tempered edge. ATK +15.', price: 330, power: 15 },
  gale_blade: { id: 'gale_blade', name: 'Gale Blade', kind: 'weapon', description: 'Light as a high wind. ATK +22, AGI +3.', price: 720, power: 22, agility: 3 },
  dawnbrand: { id: 'dawnbrand', name: 'Dawnbrand', kind: 'weapon', description: 'The blade that welcomes morning. ATK +31.', price: 0, power: 31 },
  linen_tunic: { id: 'linen_tunic', name: 'Linen Tunic', kind: 'armor', description: 'Travel clothes. DEF +2.', price: 25, defense: 2 },
  oak_mail: { id: 'oak_mail', name: 'Oak Mail', kind: 'armor', description: 'Layered bark and leather. DEF +7.', price: 110, defense: 7 },
  tide_mail: { id: 'tide_mail', name: 'Tide Mail', kind: 'armor', description: 'Pearl-bright scale. DEF +14, HP +10.', price: 310, defense: 14, maxHp: 10 },
  cloud_plate: { id: 'cloud_plate', name: 'Cloud Plate', kind: 'armor', description: 'Sky-forged armor. DEF +21.', price: 680, defense: 21 },
  sunplate: { id: 'sunplate', name: 'Sunplate', kind: 'armor', description: 'Warm armor of the old guard. DEF +29, HP +25.', price: 0, defense: 29, maxHp: 25 },
  oak_charm: { id: 'oak_charm', name: 'Oakheart Charm', kind: 'charm', description: 'HP +20, DEF +2.', price: 160, maxHp: 20, defense: 2 },
  wise_charm: { id: 'wise_charm', name: 'Skysage Pin', kind: 'charm', description: 'MP +18, AGI +2.', price: 420, maxMp: 18, agility: 2 },
  star_charm: { id: 'star_charm', name: 'Astral Loop', kind: 'charm', description: 'HP +30, MP +15, AGI +4.', price: 0, maxHp: 30, maxMp: 15, agility: 4 },
  tollstone_charm: { id: 'tollstone_charm', name: 'Tollstone Charm', kind: 'charm', description: 'A chip of the belfry wall. HP +25, DEF +6.', price: 0, maxHp: 25, defense: 6 },
  morningbell: { id: 'morningbell', name: 'Morningbell', kind: 'charm', description: 'The Still Bell, recast to ring at dawn. HP +40, MP +25, DEF +5, AGI +6.', price: 0, maxHp: 40, maxMp: 25, defense: 5, agility: 6 },
  moondew: { id: 'moondew', name: 'Moondew', kind: 'key', description: 'A silver drop gathered beneath ancient roots.', price: 0 },
  silver_locket: { id: 'silver_locket', name: 'Silver Locket', kind: 'key', description: "Captain Mira's wave-etched keepsake.", price: 0 },
  star_seed: { id: 'star_seed', name: 'Star Seed', kind: 'key', description: 'A humming shard fallen from the upper dark.', price: 0 },
  verdant_ember: { id: 'verdant_ember', name: 'Verdant Ember', kind: 'key', description: 'The green memory of growing things.', price: 0 },
  tidal_ember: { id: 'tidal_ember', name: 'Tidal Ember', kind: 'key', description: 'The blue memory of returning tides.', price: 0 },
  sky_ember: { id: 'sky_ember', name: 'Sky Ember', kind: 'key', description: 'The white memory of fearless wind.', price: 0 },
};

export const SPELLS = {
  mend: { id: 'mend', name: 'Mend', description: 'Restore a little HP.', mp: 3, level: 2, kind: 'heal', power: 35, target: 'self' },
  spark: { id: 'spark', name: 'Spark', description: 'A dart of living flame.', mp: 4, level: 3, kind: 'damage', power: 22, target: 'enemy' },
  lull: { id: 'lull', name: 'Lull', description: 'May put a foe to sleep.', mp: 5, level: 5, kind: 'status', power: 2, target: 'enemy' },
  waywind: { id: 'waywind', name: 'Waywind', description: 'Escape a normal battle.', mp: 4, level: 6, kind: 'escape', power: 1, target: 'self' },
  greater_mend: { id: 'greater_mend', name: 'Greater Mend', description: 'Restore a great deal of HP.', mp: 8, level: 8, kind: 'heal', power: 95, target: 'self' },
  flare: { id: 'flare', name: 'Flare', description: 'A pillar of sunfire.', mp: 9, level: 10, kind: 'damage', power: 62, target: 'enemy' },
  ward: { id: 'ward', name: 'Ward', description: 'Halve the next two attacks.', mp: 7, level: 12, kind: 'buff', power: 2, target: 'self' },
  sunrise: { id: 'sunrise', name: 'Sunrise', description: "The crown's final radiance.", mp: 15, level: 15, kind: 'damage', power: 120, target: 'enemy' },
};

/**
 * `charge` (new): the foe spends a turn winding up (the warning shows in the
 * log), then strikes for `mult` × damage. Guard halves it. King Orin's advice
 * about Thornmaw rearing back now describes a real move.
 */
export const ENEMIES = {
  dewdrop: { id: 'dewdrop', name: 'Dewdrop', family: 'slime', color: '#63d7d2', accent: '#eaffff', level: 1, maxHp: 12, attack: 6, defense: 2, agility: 4, xp: 5, gold: 4, loot: { itemId: 'herb', chance: 0.08 } },
  spriggan: { id: 'spriggan', name: 'Spriggan', family: 'plant', color: '#70bd55', accent: '#d9ef7e', level: 2, maxHp: 20, attack: 9, defense: 4, agility: 5, xp: 8, gold: 7 },
  emberbee: { id: 'emberbee', name: 'Emberbee', family: 'wing', color: '#f4b63e', accent: '#462f54', level: 2, maxHp: 16, attack: 11, defense: 3, agility: 9, xp: 9, gold: 8 },
  rootling: { id: 'rootling', name: 'Rootling', family: 'plant', color: '#8c6e42', accent: '#79c15c', level: 3, maxHp: 28, attack: 13, defense: 7, agility: 4, xp: 13, gold: 10 },
  capshade: { id: 'capshade', name: 'Capshade', family: 'fungus', color: '#9a62c7', accent: '#f4d2ff', level: 4, maxHp: 32, attack: 15, defense: 7, agility: 6, xp: 17, gold: 13, spell: 'spark', spellChance: 0.15, magic: 12 },
  thornmaw: {
    id: 'thornmaw', name: 'Thornmaw', family: 'plant', color: '#3e8c4e', accent: '#ef5674', level: 5, maxHp: 110, attack: 20, defense: 10, agility: 5, xp: 95, gold: 85, boss: true,
    charge: { every: 3, mult: 1.7, name: 'Thorn Lash', warn: 'Thornmaw rears back, every thorn bristling!' },
  },
  shellback: { id: 'shellback', name: 'Shellback', family: 'beast', color: '#5fc2b8', accent: '#eac77d', level: 5, maxHp: 44, attack: 19, defense: 14, agility: 4, xp: 25, gold: 19 },
  brine_wisp: { id: 'brine_wisp', name: 'Brine Wisp', family: 'wisp', color: '#6ec7ff', accent: '#effcff', level: 6, maxHp: 38, attack: 21, defense: 9, agility: 13, xp: 29, gold: 23, spell: 'spark', spellChance: 0.25, magic: 18 },
  reef_knight: { id: 'reef_knight', name: 'Reef Knight', family: 'knight', color: '#557f9f', accent: '#f0b665', level: 7, maxHp: 56, attack: 26, defense: 16, agility: 7, xp: 38, gold: 31 },
  deep_oracle: { id: 'deep_oracle', name: 'The Deep Oracle', family: 'wisp', color: '#315da8', accent: '#8cf2e0', level: 9, maxHp: 210, attack: 31, defense: 17, agility: 12, xp: 260, gold: 180, boss: true, spell: 'flare', spellChance: 0.25, magic: 30, resistFire: 0.35 },
  cloud_hare: { id: 'cloud_hare', name: 'Cloud Hare', family: 'beast', color: '#d8f0ff', accent: '#7f86d9', level: 8, maxHp: 64, attack: 30, defense: 17, agility: 19, xp: 45, gold: 36 },
  prismite: { id: 'prismite', name: 'Prismite', family: 'slime', color: '#9feaff', accent: '#e9a9ff', level: 9, maxHp: 72, attack: 33, defense: 20, agility: 12, xp: 52, gold: 42, spell: 'spark', spellChance: 0.2, magic: 25 },
  gale_harpy: { id: 'gale_harpy', name: 'Gale Harpy', family: 'wing', color: '#88a4e8', accent: '#f5d878', level: 10, maxHp: 78, attack: 37, defense: 18, agility: 22, xp: 61, gold: 48 },
  tempest_roc: { id: 'tempest_roc', name: 'Tempest Roc', family: 'wing', color: '#4c62b3', accent: '#f5e974', level: 13, maxHp: 340, attack: 44, defense: 25, agility: 24, xp: 520, gold: 320, boss: true, spell: 'flare', spellChance: 0.3, magic: 42, resistFire: 0.2 },
  ashling: { id: 'ashling', name: 'Ashling', family: 'slime', color: '#da614d', accent: '#ffd16a', level: 12, maxHp: 92, attack: 42, defense: 23, agility: 15, xp: 76, gold: 61, resistFire: 0.5 },
  cinder_guard: { id: 'cinder_guard', name: 'Cinder Guard', family: 'knight', color: '#4c4253', accent: '#ff754f', level: 13, maxHp: 112, attack: 48, defense: 31, agility: 14, xp: 92, gold: 74 },
  sun_eater: { id: 'sun_eater', name: 'Sun-Eater', family: 'beast', color: '#643f67', accent: '#ff8a5c', level: 14, maxHp: 128, attack: 53, defense: 29, agility: 21, xp: 110, gold: 86, spell: 'flare', spellChance: 0.2, magic: 46, resistFire: 0.6 },
  ash_regent: { id: 'ash_regent', name: 'The Ash Regent', family: 'regent', color: '#472c5d', accent: '#ff694e', level: 17, maxHp: 620, attack: 61, defense: 35, agility: 25, xp: 1600, gold: 0, boss: true, spell: 'flare', spellChance: 0.35, magic: 58, resistFire: 0.55 },
  // New: the Hushed Belfry.
  clapper_bat: { id: 'clapper_bat', name: 'Clapper Bat', family: 'wing', color: '#3e3552', accent: '#ffcf6a', level: 13, maxHp: 96, attack: 49, defense: 22, agility: 30, xp: 95, gold: 70, loot: { itemId: 'ether_drop', chance: 0.12 } },
  toll_wraith: { id: 'toll_wraith', name: 'Toll Wraith', family: 'wisp', color: '#6d5aa8', accent: '#f2e6ff', level: 14, maxHp: 118, attack: 50, defense: 27, agility: 24, xp: 104, gold: 80, spell: 'spark', spellChance: 0.3, magic: 52 },
  belfry_gargoyle: { id: 'belfry_gargoyle', name: 'Belfry Gargoyle', family: 'knight', color: '#6f6a80', accent: '#b9f0ff', level: 15, maxHp: 150, attack: 55, defense: 38, agility: 12, xp: 120, gold: 92, loot: { itemId: 'wayfarer_tonic', chance: 0.15 } },
  still_bell: {
    id: 'still_bell', name: 'The Still Bell', family: 'bell', color: '#c9a14a', accent: '#5a3d7a', level: 18, maxHp: 820, attack: 60, defense: 36, agility: 18, xp: 2000, gold: 600, boss: true, spell: 'flare', spellChance: 0.25, magic: 60, resistFire: 0.4,
    charge: { every: 3, mult: 2, name: 'Hush Toll', warn: 'The Still Bell swings back, gathering a silent toll…' },
  },
};

export const ENCOUNTERS = {
  world: ['dewdrop', 'dewdrop', 'spriggan', 'emberbee', 'shellback', 'cloud_hare'],
  mossroot: ['spriggan', 'rootling', 'capshade'],
  sunken: ['shellback', 'brine_wisp', 'reef_knight'],
  skyglass: ['cloud_hare', 'prismite', 'gale_harpy'],
  citadel: ['ashling', 'cinder_guard', 'sun_eater'],
  belfry: ['clapper_bat', 'toll_wraith', 'belfry_gargoyle'],
};

export const SHOPS = {
  hearth_shop: { id: 'hearth_shop', name: "Pip's Provisions", stock: ['herb', 'smoke_pod', 'bronze_sword', 'oak_mail'] },
  tide_shop: { id: 'tide_shop', name: "Nilo's Salt & Steel", stock: ['wayfarer_tonic', 'ether_drop', 'iron_sword', 'coral_saber', 'tide_mail'] },
  gale_shop: { id: 'gale_shop', name: "Orr's Skyforge", stock: ['wayfarer_tonic', 'ether_drop', 'smoke_pod', 'gale_blade', 'cloud_plate', 'wise_charm'] },
};

export const INN_PRICES = { innkeeper_mae: 12, tide_innkeeper: 28, gale_innkeeper: 45 };

export const STORY = [
  'Seek audience with King Orin at Hearthglen Keep.',
  'Recover the Verdant Ember from Mossroot Hollow, west of Hearthglen.',
  'Return the Verdant Ember to King Orin.',
  'Find the Tidal Ember in the Sunken Shrine, southwest of Tidehaven.',
  'Return the Tidal Ember to King Orin.',
  'Claim the Sky Ember atop Skyglass Spire, east of Galecrest.',
  'Return the Sky Ember to King Orin.',
  'Enter the Obsidian Citadel in the southeast and confront the Ash Regent.',
  'The dawn is restored. Emberfall remembers your name.',
];

export const QUESTS = {
  moondew: { name: 'A Drop of Moonlight', giver: 'Ivy', description: 'Find Moondew in Mossroot Hollow and bring it to Ivy.', reward: '3 Wayfarer Tonics' },
  shellbacks: { name: "Bram's Better Buckler", giver: 'Bram', description: 'Defeat five Shellbacks or other slimes and report back.', reward: 'Iron Sword' },
  locket: { name: "The Captain's Locket", giver: 'Captain Mira', description: "Recover Mira's silver locket from the Sunken Shrine.", reward: '180 gold' },
  starseeds: { name: 'Seeds Above the Sky', giver: 'Lyra', description: 'Gather three Star Seeds scattered in distant ruins.', reward: 'Astral Loop' },
  lasttoll: {
    name: 'The Last Toll',
    giver: 'Toma',
    description: 'Silence the Still Bell atop the Hushed Belfry, north of the river, then tell Toma.',
    reward: '2 Sun Elixirs and 500 gold',
    unlockHint: 'Speak with Toma once the three Embers burn again.',
  },
};

export const CREDITS = [
  ['CROWN OF EMBERFALL', 'A complete pocket role-playing adventure'],
  ['THE DAWNBEARER', 'You'],
  ['STORY & WORLD', 'An original tale of memory, mercy, and morning'],
  ['ART DIRECTION', 'Bright low-poly isometric geometry'],
  ['MUSIC', 'A tiny generative chiptune orchestra'],
  ['SPECIAL THANKS', 'Every traveler who chooses hope'],
];

/** XP needed to reach a level. */
export const xpForLevel = (level) => Math.round(8 * level * level + 10 * level);

export const BOSS_INTROS = {
  thornmaw: (name) => [
    'Thornmaw',
    ['The stolen flame has fed every thorn in this hollow.', `${name}... if you would carry the Verdant Ember, prove that courage can grow where fear took root!`],
  ],
  deep_oracle: () => [
    'Deep Oracle',
    ['The drowned remember every farewell. Why let the tide carry anything away?', 'Show me, Dawn-bearer: is a memory still precious when it is allowed to change?'],
  ],
  tempest_roc: () => ['Tempest Roc', ['SKYBOUND MORTAL—THE STILL CROWN COMMANDS THE WIND TO KNEEL.', 'But the wind was never made for kneeling.']],
  ash_regent: (name) => [
    'Lucen Veyr, the Ash Regent',
    [
      'You brought every Ember exactly as I hoped. Root. Tide. Sky. Each memory cleansed by a willing hand.',
      'I have counted every goodbye, courier. A perfect evening need never become a grave tomorrow.',
      'The price is only motion. No aging. No leaving. No loss.',
      `${name}: A world that cannot change cannot live.`,
      'Then let the last dawn judge us both.',
    ],
  ],
  still_bell: (name) => [
    'The Still Bell',
    [
      'The bronze does not speak. It remembers the single stroke that stopped the sun, and the silence after.',
      'Every wall of the belfry leans toward you, waiting for the next toll.',
      `${name} grips the rope. If this bell must ring again, let it ring for morning.`,
    ],
  ],
};

export const SAVE_PREFIX = 'crown-of-emberfall.save.';
export const SETTINGS_KEY = 'crown-of-emberfall.settings';
export const SAVE_VERSION = 2;

export const DEFAULT_SETTINGS = {
  music: true,
  sfx: true,
  reducedMotion: false,
  textSpeed: 'normal',
  challenge: 'standard',
  zoom: 1,
};

export const CHALLENGE = {
  gentle: { label: 'Gentle', hint: 'Foes hit softer; fewer random battles', enemyDamage: 0.72, encounter: 0.7 },
  standard: { label: 'Standard', hint: 'The journey as written', enemyDamage: 1, encounter: 1 },
  heroic: { label: 'Heroic', hint: 'Foes hit harder; +25% gold and XP', enemyDamage: 1.25, encounter: 1, reward: 1.25 },
};

export function newGame(name = 'Aster') {
  return {
    version: SAVE_VERSION,
    mode: 'dialogue',
    player: {
      name,
      level: 1,
      xp: 0,
      hp: 34,
      mp: 8,
      gold: 42,
      baseAttack: 7,
      baseDefense: 5,
      baseAgility: 6,
      inventory: { herb: 3, bronze_sword: 1, linen_tunic: 1 },
      equipment: { weapon: 'bronze_sword', armor: 'linen_tunic', charm: null },
    },
    mapId: 'hearthglen',
    x: 7,
    y: 11,
    facing: 'north',
    storyStage: 0,
    flags: [],
    quests: { moondew: 'locked', shellbacks: 'locked', locket: 'locked', starseeds: 'locked', lasttoll: 'locked' },
    counters: { slimes: 0 },
    defeated: {},
    openedChests: [],
    rng: 7531,
    hazard: 0,
    steps: 0,
    playSeconds: 0,
    combat: null,
    dialogue: {
      speaker: 'Storyteller',
      pages: [
        'Long ago, the Crown of Embers taught the sun to rise over Emberfall.',
        'Now its three living flames have gone dark—and from the eastern scar, an Ash Regent gathers the night.',
        'At first light, a young courier arrives in Hearthglen carrying a royal summons...',
      ],
      index: 0,
      portrait: 'sun',
    },
    activeShop: null,
    lastSafe: { mapId: 'hearthglen', x: 7, y: 11 },
  };
}
