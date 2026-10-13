/**
 * DEAD HORIZON: 1899 - Full Frontier Compendium
 * Comprehensive data on Weapons, Fauna, Fish, Horses, Provisions, Tonics, and Camp Upgrades.
 */

export const WEAPONS = {
  cattleman: {
    id: 'cattleman',
    name: 'Cattleman Revolver',
    category: 'Revolver',
    damage: 32, range: 45, fireRate: 60, reload: 55, accuracy: 55,
    ammoType: 'revolver', ammoMax: 6,
    condition: 100,
    cost: 50,
    description: 'The classic single-action six-shooter of the American West. Dependable, balanced, and timeless.'
  },
  double_action: {
    id: 'double_action',
    name: 'Double-Action Revolver',
    category: 'Revolver',
    damage: 28, range: 40, fireRate: 85, reload: 50, accuracy: 48,
    ammoType: 'revolver', ammoMax: 6,
    condition: 100,
    cost: 65,
    description: 'Rapid-firing double-action cylinder allowing blistering consecutive trigger pulls without manually cocking the hammer.'
  },
  schofield: {
    id: 'schofield',
    name: 'Schofield Revolver',
    category: 'Revolver',
    damage: 42, range: 50, fireRate: 50, reload: 70, accuracy: 68,
    ammoType: 'revolver', ammoMax: 6,
    condition: 100,
    cost: 84,
    description: 'Top-break design allowing lightning-fast cartridge ejection and superior stopping power.'
  },
  volcanic: {
    id: 'volcanic',
    name: 'Volcanic Pistol',
    category: 'Pistol',
    damage: 46, range: 42, fireRate: 40, reload: 45, accuracy: 60,
    ammoType: 'pistol', ammoMax: 8,
    condition: 100,
    cost: 110,
    description: 'Lever-action repeating pistol utilizing self-contained rocket-ball ammunition.'
  },
  mauser: {
    id: 'mauser',
    name: 'Mauser C96 Pistol',
    category: 'Pistol',
    damage: 36, range: 48, fireRate: 90, reload: 65, accuracy: 62,
    ammoType: 'pistol', ammoMax: 10,
    condition: 100,
    cost: 250,
    description: 'Modern European semi-automatic firearm fed by a 10-round stripper clip. Devastating rate of fire.'
  },
  carbine_repeater: {
    id: 'carbine_repeater',
    name: 'Carbine Repeater',
    category: 'Repeater',
    damage: 48, range: 65, fireRate: 50, reload: 60, accuracy: 65,
    ammoType: 'repeater', ammoMax: 7,
    condition: 100,
    cost: 90,
    description: 'Spencer-style tubular magazine carbine loaded through the stock. Reliable frontier saddle gun.'
  },
  lancaster_repeater: {
    id: 'lancaster_repeater',
    name: 'Lancaster Repeater',
    category: 'Repeater',
    damage: 54, range: 75, fireRate: 65, reload: 65, accuracy: 80,
    ammoType: 'repeater', ammoMax: 14,
    condition: 100,
    cost: 135,
    description: 'The quintessential lever-action repeater. High capacity, pinpoint accuracy, and smooth cycling.'
  },
  springfield_rifle: {
    id: 'springfield_rifle',
    name: 'Springfield Trapdoor Rifle',
    category: 'Rifle',
    damage: 82, range: 90, fireRate: 25, reload: 40, accuracy: 85,
    ammoType: 'rifle', ammoMax: 1,
    condition: 100,
    cost: 120,
    description: 'Heavy single-shot breech-loading service rifle capable of dropping big game and distant outlaws in one shot.'
  },
  bolt_action_rifle: {
    id: 'bolt_action_rifle',
    name: 'Bolt-Action Military Rifle',
    category: 'Rifle',
    damage: 78, range: 95, fireRate: 40, reload: 55, accuracy: 90,
    ammoType: 'rifle', ammoMax: 5,
    condition: 100,
    cost: 180,
    description: 'Modern Krag-style 5-round internal magazine military rifle. Lethal stopping power at extreme ranges.'
  },
  varmint_rifle: {
    id: 'varmint_rifle',
    name: 'Varmint Rifle (.22 Caliber)',
    category: 'Rifle',
    damage: 22, range: 60, fireRate: 70, reload: 70, accuracy: 85,
    ammoType: 'varmint', ammoMax: 14,
    condition: 100,
    cost: 72,
    description: 'Pump-action small-caliber rifle designed to preserve pristine pelts when hunting small game like rabbits and foxes.'
  },
  rolling_block: {
    id: 'rolling_block',
    name: 'Rolling Block Sniper Rifle',
    category: 'Sniper Rifle',
    damage: 95, range: 100, fireRate: 20, reload: 35, accuracy: 95,
    ammoType: 'rifle', ammoMax: 1,
    condition: 100,
    cost: 187,
    description: 'High-power single-shot rifle fitted with a long-range telescopic brass sight.'
  },
  double_barrel_shotgun: {
    id: 'double_barrel_shotgun',
    name: 'Double-Barreled Shotgun',
    category: 'Shotgun',
    damage: 90, range: 30, fireRate: 50, reload: 45, accuracy: 40,
    ammoType: 'shotgun', ammoMax: 2,
    condition: 100,
    cost: 95,
    description: 'Break-action two-barrel 12-gauge scattergun unleashing devastating close-quarters blast cones.'
  },
  pump_action_shotgun: {
    id: 'pump_action_shotgun',
    name: 'Pump-Action Shotgun',
    category: 'Shotgun',
    damage: 85, range: 35, fireRate: 55, reload: 60, accuracy: 45,
    ammoType: 'shotgun', ammoMax: 5,
    condition: 100,
    cost: 148,
    description: 'Slide-action 5-shot shotgun providing reliable rapid buckshot barrage in tight quarters.'
  },
  hunting_bow: {
    id: 'hunting_bow',
    name: 'Hunting Bow & Arrows',
    category: 'Bow',
    damage: 65, range: 55, fireRate: 35, reload: 50, accuracy: 80,
    ammoType: 'arrow', ammoMax: 1,
    condition: 100,
    cost: 40,
    description: 'Silent, deadly indigenous recurve bow. Arrow headshots guarantee pristine pelts without alarming nearby camps.'
  },
  hunting_knife: {
    id: 'hunting_knife',
    name: 'Frontier Hunting Knife',
    category: 'Melee',
    damage: 50, range: 10, fireRate: 80, reload: 100, accuracy: 95,
    ammoType: null, ammoMax: null,
    condition: 100,
    cost: 15,
    description: 'Carbon steel Bowie knife used for skinning game, silent stealth assassinations, and close-quarters grapples.'
  },
  dynamite: {
    id: 'dynamite',
    name: 'Dynamite Stick',
    category: 'Thrown',
    damage: 150, range: 30, fireRate: 20, reload: 30, accuracy: 50,
    ammoType: 'explosive', ammoMax: 8,
    condition: 100,
    cost: 4,
    description: 'Nitroglycerin explosive stick with a burning cord fuse. Destroys safes, coaches, and clusters of lawmen.'
  },
  fire_bottle: {
    id: 'fire_bottle',
    name: 'Fire Bottle (Molotov)',
    category: 'Thrown',
    damage: 90, range: 28, fireRate: 25, reload: 35, accuracy: 55,
    ammoType: 'incendiary', ammoMax: 8,
    condition: 100,
    cost: 3,
    description: 'Kerosene-soaked bottle creating an expanding fire pool that ignites enemies, wooden buildings, and crops.'
  },
  lasso: {
    id: 'lasso',
    name: 'Braided Rawhide Lasso',
    category: 'Equipment',
    damage: 0, range: 35, fireRate: 40, reload: 70, accuracy: 80,
    ammoType: null, ammoMax: null,
    condition: 100,
    cost: 10,
    description: 'Heavy rawhide rope used to lasso wild horses, subdue runaway bounty targets, and hogtie captured outlaws.'
  }
};

export const FAUNA = [
  { id: 'whitetail_buck', name: 'Whitetail Buck', category: 'Herbivore', habitat: 'Heartland Meadows & Cumberland Forest', weapon: 'hunting_bow', size: 'large', drops: ['Buck Antlers', 'Venison', 'Pelt'], hp: 45 },
  { id: 'whitetail_deer', name: 'Whitetail Deer', category: 'Herbivore', habitat: 'Frontier Grasslands', weapon: 'hunting_bow', size: 'medium', drops: ['Venison', 'Pelt'], hp: 35 },
  { id: 'american_bison', name: 'American Plains Bison', category: 'Herbivore', habitat: 'Great Plains & Heartland Basin', weapon: 'springfield_rifle', size: 'massive', drops: ['Bison Horn', 'Prime Beef', 'Heavy Fur'], hp: 120 },
  { id: 'pronghorn', name: 'Pronghorn Antelope', category: 'Herbivore', habitat: 'New Austin & West Elizabeth Plains', weapon: 'carbine_repeater', size: 'medium', drops: ['Game Meat', 'Pelt'], hp: 35 },
  { id: 'bighorn_ram', name: 'Rocky Mountain Bighorn Ram', category: 'Herbivore', habitat: 'Grizzly Mountain Crags', weapon: 'hunting_bow', size: 'medium', drops: ['Ram Horn', 'Mutton', 'Wool'], hp: 50 },
  { id: 'elk', name: 'Rocky Mountain Elk', category: 'Herbivore', habitat: 'Ambarino Pines & Tall Trees', weapon: 'springfield_rifle', size: 'large', drops: ['Elk Antler', 'Mature Venison', 'Pelt'], hp: 90 },
  { id: 'grizzly_bear', name: 'North American Grizzly Bear', category: 'Predator', habitat: 'Grizzlies East & Big Valley', weapon: 'springfield_rifle', size: 'massive', drops: ['Bear Claw', 'Big Game Meat', 'Heavy Bear Fur'], hp: 160 },
  { id: 'black_bear', name: 'American Black Bear', category: 'Predator', habitat: 'Roanoke Ridge Forests', weapon: 'bolt_action_rifle', size: 'large', drops: ['Bear Fat', 'Big Game Meat', 'Bear Pelt'], hp: 100 },
  { id: 'gray_wolf', name: 'Timber Wolf', category: 'Predator', habitat: 'Mountain Passes & Snowfields', weapon: 'hunting_bow', size: 'medium', drops: ['Wolf Heart', 'Wolf Meat', 'Wolf Fur'], hp: 45 },
  { id: 'cougar', name: 'Frontier Cougar / Mountain Lion', category: 'Predator', habitat: 'Roanoke Ridge & Gaptooth Ridge', weapon: 'hunting_bow', size: 'medium', drops: ['Cougar Fang', 'Big Game Meat', 'Pristine Cougar Pelt'], hp: 60 },
  { id: 'panther', name: 'Florida Panther', category: 'Predator', habitat: 'Scarlett Meadows & Bayou Nwa', weapon: 'hunting_bow', size: 'medium', drops: ['Panther Eye', 'Big Game Meat', 'Panther Pelt'], hp: 65 },
  { id: 'american_alligator', name: 'American Alligator', category: 'Predator', habitat: 'Bayou Nwa & Bluewater Marsh', weapon: 'springfield_rifle', size: 'large', drops: ['Alligator Tooth', 'Big Game Meat', 'Alligator Leather'], hp: 110 },
  { id: 'wild_boar', name: 'Wild Razorback Boar', category: 'Omnivore', habitat: 'Lemoyne Marshes & Scarlett Woods', weapon: 'carbine_repeater', size: 'medium', drops: ['Boar Tusk', 'Pork', 'Thick Pelt'], hp: 55 },
  { id: 'red_fox', name: 'Red Fox', category: 'Small Game', habitat: 'Woodlands & Grasslands', weapon: 'varmint_rifle', size: 'small', drops: ['Fox Meat', 'Fox Fur'], hp: 20 },
  { id: 'coyote', name: 'Prairie Coyote', category: 'Small Game', habitat: 'Heartlands & Desert Canyons', weapon: 'hunting_bow', size: 'small', drops: ['Stringy Meat', 'Coyote Fur'], hp: 25 },
  { id: 'beaver', name: 'North American Beaver', category: 'Small Game', habitat: 'Owanjila Lake & Dakota River', weapon: 'varmint_rifle', size: 'small', drops: ['Beaver Scent Gland', 'Plump Bird Meat', 'Waterproof Beaver Fur'], hp: 18 },
  { id: 'jackrabbit', name: 'Black-Tailed Jackrabbit', category: 'Small Game', habitat: 'Everywhere in Open Plains', weapon: 'varmint_rifle', size: 'small', drops: ['Game Meat', 'Soft Fur'], hp: 10 },
  { id: 'bald_eagle', name: 'Bald Eagle', category: 'Bird', habitat: 'Mountain Peaks & River Canyons', weapon: 'varmint_rifle', size: 'bird', drops: ['Eagle Feather', 'Flight Feathers'], hp: 12 },
  { id: 'rattlesnake', name: 'Diamondback Rattlesnake', category: 'Reptile', habitat: 'Arid Canyons & Dry Rocks', weapon: 'hunting_bow', size: 'tiny', drops: ['Snake Venom Gland', 'Snake Skin'], hp: 8 },

  // Legendary Beasts
  { id: 'legendary_bharati_grizzly', name: 'Legendary Bharati Grizzly Bear', category: 'Legendary Beast', habitat: 'O\'Creagh\'s Run Ravine', weapon: 'springfield_rifle', size: 'titan', drops: ['Legendary Bear Claw (Bear Claw Talisman)', 'Legendary Bear Fur'], hp: 350 },
  { id: 'legendary_white_bison', name: 'Legendary White Bison', category: 'Legendary Beast', habitat: 'Lake Isabella Snowy Bluffs', weapon: 'springfield_rifle', size: 'titan', drops: ['Legendary Bison Horn (Bison Horn Talisman)', 'Legendary White Bison Pelt'], hp: 300 },
  { id: 'legendary_bull_gator', name: 'Legendary Bull Alligator', category: 'Legendary Beast', habitat: 'Lagras Foggy Swamps', weapon: 'rolling_block', size: 'titan', drops: ['Legendary Alligator Tooth (Alligator Talisman)', 'Legendary Gator Hide'], hp: 400 },
  { id: 'legendary_giaguaro_panther', name: 'Legendary Giaguaro Panther', category: 'Legendary Beast', habitat: 'Bolger Glade Shallows', weapon: 'hunting_bow', size: 'legendary', drops: ['Legendary Panther Eye (Panther Eye Trinket)', 'Legendary Panther Pelt'], hp: 220 },
  { id: 'legendary_buck', name: 'Legendary Buck', category: 'Legendary Beast', habitat: 'Black Bone Forest', weapon: 'springfield_rifle', size: 'legendary', drops: ['Legendary Buck Antler (Buck Antler Trinket: Better Pelt Quality)', 'Legendary Buck Fur'], hp: 180 },
  { id: 'legendary_timber_wolf', name: 'Legendary Timber Wolf', category: 'Legendary Beast', habitat: 'Cotorra Springs Geysers', weapon: 'hunting_bow', size: 'legendary', drops: ['Legendary Wolf Heart (Wolf Heart Trinket: 2x Alcohol Tolerance)', 'Legendary Wolf Pelt'], hp: 200 }
];

export const FISH = [
  { id: 'bluegill', name: 'Bluegill', habitat: 'Rivers & Ponds', bait: 'Bread', weightKg: 0.6 },
  { id: 'sockeye_salmon', name: 'Sockeye Salmon', habitat: 'Fast Mountain Streams', bait: 'River Lure', weightKg: 2.4 },
  { id: 'steelhead_trout', name: 'Steelhead Trout', habitat: 'Dakota River Shallows', bait: 'Worm', weightKg: 3.1 },
  { id: 'smallmouth_bass', name: 'Smallmouth Bass', habitat: 'Lakes & Creek Inlets', bait: 'Crickets', weightKg: 1.8 },
  { id: 'largemouth_bass', name: 'Largemouth Bass', habitat: 'San Luis River & Lakes', bait: 'Lake Lure', weightKg: 4.2 },
  { id: 'lake_sturgeon', name: 'Lake Sturgeon', habitat: 'Deep Lake Waters', bait: 'Special Lake Lure', weightKg: 18.5 },
  { id: 'channel_catfish', name: 'Channel Catfish', habitat: 'Swamp Canals & Muddy Rivers', bait: 'Swamp Lure', weightKg: 8.9 },
  { id: 'legendary_sockeye', name: 'Legendary Sockeye Salmon', habitat: 'Lake Isabella Frozen Inlets', bait: 'Special River Lure', weightKg: 12.5 },
  { id: 'legendary_steelhead', name: 'Legendary Steelhead Trout', habitat: 'Willard\'s Rest Waterfall', bait: 'Special River Lure', weightKg: 16.8 }
];

export const HORSES = [
  { id: 'arabian_white', breed: 'White Arabian', category: 'Elite', speed: 85, accel: 80, health: 70, stamina: 75, handling: 'Elite', color: '#f2f0ec', coatStyle: 'arabian', cost: 1200 },
  { id: 'missouri_fox_trotter', breed: 'Missouri Fox Trotter', category: 'Race / Work', speed: 88, accel: 72, health: 75, stamina: 85, handling: 'Standard', color: '#c2ab95', coatStyle: 'foxtrotter', cost: 950 },
  { id: 'thoroughbred_bay', breed: 'Thoroughbred Dapple', category: 'Race', speed: 82, accel: 75, health: 65, stamina: 70, handling: 'Race', color: '#6e4428', coatStyle: 'thoroughbred', cost: 450 },
  { id: 'ardennes_warhorse', breed: 'Ardennes Warhorse', category: 'War', speed: 60, accel: 55, health: 95, stamina: 80, handling: 'Heavy', color: '#884c3c', coatStyle: 'warhorse', cost: 500 },
  { id: 'mustang_buckskin', breed: 'Tiger-Striped Mustang', category: 'Multi-Class', speed: 70, accel: 65, health: 80, stamina: 90, handling: 'Standard', color: '#bfa058', coatStyle: 'mustang', cost: 350 },
  { id: 'shire_raven', breed: 'Raven Black Shire', category: 'Draft', speed: 52, accel: 45, health: 90, stamina: 85, handling: 'Heavy', color: '#161616', coatStyle: 'shire', cost: 130 },
  { id: 'buell_legendary', breed: 'Buell (Dutch Warmblood)', category: 'War / Work', speed: 85, accel: 78, health: 95, stamina: 95, handling: 'Standard', color: '#eedaa2', coatStyle: 'buell', cost: 2500 }
];

export const PROVISIONS_AND_TONICS = {
  health_tonic: { id: 'health_tonic', name: 'Health Tonic', restores: 'health_ring', value: 100, cost: 5, desc: 'Instantly refills the outer Health ring.' },
  potent_health_tonic: { id: 'potent_health_tonic', name: 'Potent Health Tonic', restores: 'health_gold', value: 100, cost: 12, desc: 'Refills Health ring and grants a fortified Golden Core for 24 game hours.' },
  snake_oil: { id: 'snake_oil', name: 'Snake Oil', restores: 'deadeye_ring', value: 100, cost: 6, desc: 'Restores the entire Dead Eye meter.' },
  potent_snake_oil: { id: 'potent_snake_oil', name: 'Potent Snake Oil', restores: 'deadeye_gold', value: 100, cost: 14, desc: 'Fortifies the Dead Eye bar with gold armor.' },
  miracle_tonic: { id: 'miracle_tonic', name: 'Special Miracle Tonic', restores: 'all_cores', value: 100, cost: 25, desc: 'Instantly restores all Health, Stamina, and Dead Eye cores to maximum.' },
  canned_peaches: { id: 'canned_peaches', name: 'Sweet Canned Peaches', restores: 'health_core', value: 40, cost: 2, desc: 'Delicious canned frontier fruit that restores the inner Health core.' },
  cigar: { id: 'cigar', name: 'Premium Havana Cigar', restores: 'deadeye_core', value: 60, cost: 4, desc: 'Smoking tobacco calms the nerves and sharpens Dead Eye.' },
  seasoned_big_game: { id: 'seasoned_big_game', name: 'Seasoned Big Game Meat', restores: 'gold_cores', value: 100, cost: 0, desc: 'Cooked over campfire with wild thyme. Grants gold status to all three cores.' },
  gun_oil: { id: 'gun_oil', name: 'Gun Cleaning Oil', restores: 'weapon_condition', value: 100, cost: 3, desc: 'Cleans carbon fouling and rust, restoring weapon damage, rate of fire, and reload speed.' },
  horse_reviver: { id: 'horse_reviver', name: 'Special Horse Reviver', restores: 'horse_revive', value: 100, cost: 15, desc: 'Administer to a critically wounded or downed mount to revive them on the spot.' }
};

export const CAMP_UPGRADES = [
  { id: 'ledger', name: 'Camp Donation Ledger', cost: 0, desc: 'Allows gang members to donate cash and valuables to fund camp operations.' },
  { id: 'strauss_medicine', name: 'Herr Richter\'s Medicine Wagon Tier 2', cost: 75, desc: 'Stocks camp with potent health tonics and bitters.' },
  { id: 'pearson_provisions', name: 'Cookie Potts\' Provision Wagon Tier 2', cost: 60, desc: 'Increases camp food variety with canned pineapples, biscuits, and coffee.' },
  { id: 'bill_ammo', name: 'Bear Boone\'s Ammunition Wagon Tier 2', cost: 90, desc: 'Unlocks high-velocity rifle rounds, repeater cartridges, and dynamite.' },
  { id: 'dutch_quarters', name: 'Julian\'s Quarters: First Things First', cost: 220, desc: 'Encourages other gang members to donate more cash to the donation box.' },
  { id: 'arthur_quarters', name: 'Silas\'s Quarters: Fast Travel Map', cost: 320, desc: 'Mounts a regional map on Silas\'s wagon allowing instant stagecoach fast travel to any visited town!' },
  { id: 'leather_tools', name: 'Leather Working Crafting Tools', cost: 180, desc: 'Allows Cookie Potts to craft custom satchels, holsters, and camp skull decorations from pristine pelts.' },
  { id: 'chicken_coop', name: 'Camp Chicken Coop', cost: 175, desc: 'Adds fresh farm eggs to Pearson\'s daily camp stew, granting gold Dead Eye core upon eating!' }
];
