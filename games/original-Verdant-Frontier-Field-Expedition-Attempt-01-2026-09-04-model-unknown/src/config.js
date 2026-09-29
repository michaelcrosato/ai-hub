export const VERSION = '0.2.0';
export const WORLD = Object.freeze({ seed: 73041, halfSize: 16000, water: 22, chunk: 256, spawn: { x: -180, z: 360 } });

// One preset per kit quality tier. The kit sizes the pixel ratio and shadow maps
// (kit.shadowSize); these are the game's own view ranges and cascade counts.
export const PRESETS = Object.freeze({
  low: { label: 'Low', distance: 4200, cascades: 2, shadowFar: 700, vegetation: 650, ao: false },
  medium: { label: 'Medium', distance: 6000, cascades: 3, shadowFar: 950, vegetation: 850, ao: false },
  high: { label: 'High', distance: 10000, cascades: 3, shadowFar: 1600, vegetation: 1300, ao: true },
  ultra: { label: 'Ultra', distance: 14000, cascades: 4, shadowFar: 2400, vegetation: 1600, ao: true }
});

// Look sensitivity and invert-Y live in the kit's shared settings panel.
export const DEFAULTS = Object.freeze({ fov: 90, time: 8.4, daySpeed: 0.35, sound: true, headBob: true, fog: true });
export const BIOMES = ['Meadow', 'Pine forest', 'Highlands', 'Alpine', 'Canyon', 'Wetland', 'Lake'];
export const PALETTE = ['#7b9659', '#416f4d', '#778269', '#b8bbb0', '#b58155', '#61794b', '#397d86'];

// Landmark cairns stand on dry, level, walkable ground near each named place.
// The sites were chosen once from the fixed world seed, so they never move.
export const LANDMARKS = [
  { id: 'outlook', name: 'Field station', x: -180, z: 360, type: 'station' },
  { id: 'lake', name: 'Mirror Lake', x: 704, z: -440, type: 'water' },
  { id: 'forest', name: 'Pinefall Woods', x: -1552, z: -896, type: 'forest' },
  { id: 'summit', name: 'Crown Ridge', x: 1824, z: -3448, type: 'peak' },
  { id: 'canyon', name: 'Redstone Canyon', x: 3328, z: 800, type: 'canyon' },
  { id: 'swamp', name: 'Stillwater Marsh', x: -2496, z: 2352, type: 'wetland' },
  { id: 'plains', name: 'Windward Plains', x: 1504, z: 2304, type: 'plains' }
];
export const CAIRNS = LANDMARKS.filter(l => l.type !== 'station');

// Every species the field journal can hold. Undiscovered ones show their habitat as a hint.
export const SPECIES = [
  { name: 'Highland pine', category: 'flora', habitat: 'Forests, meadows and highlands' },
  { name: 'Silver birch', category: 'flora', habitat: 'Open meadow, here and there' },
  { name: 'Swamp willow', category: 'flora', habitat: 'Stillwater Marsh' },
  { name: 'Meadow wildflower', category: 'flora', habitat: 'Meadow grass' },
  { name: 'Woodland mushroom', category: 'flora', habitat: 'Pine forest floor' },
  { name: 'Marsh reed', category: 'flora', habitat: 'Wetland shallows' },
  { name: 'Desert sage', category: 'flora', habitat: 'Redstone Canyon' },
  { name: 'Barrel cactus', category: 'flora', habitat: 'Redstone Canyon' },
  { name: 'Edelweiss', category: 'flora', habitat: 'Highland and alpine slopes' },
  { name: 'Red deer', category: 'fauna', habitat: 'Meadows and forest edges' },
  { name: 'Red fox', category: 'fauna', habitat: 'Meadows and forest edges' },
  { name: 'Meadow hare', category: 'fauna', habitat: 'Open ground' },
  { name: 'Grey heron', category: 'fauna', habitat: 'Wetland' },
  { name: 'Lake trout', category: 'fauna', habitat: 'Lakes and the river' },
  { name: 'Raven', category: 'fauna', habitat: 'Above the alpine peaks' },
  { name: 'Mountain goat', category: 'fauna', habitat: 'Highlands and alpine' },
  { name: 'Wild boar', category: 'fauna', habitat: 'Pine forest' },
  { name: 'Collared lizard', category: 'fauna', habitat: 'Redstone Canyon' },
  { name: 'Tawny owl', category: 'fauna', habitat: 'Pine forest, only at night' }
];
export const FLORA_TOTAL = SPECIES.filter(s => s.category === 'flora').length;
export const FAUNA_TOTAL = SPECIES.filter(s => s.category === 'fauna').length;

/** Game-clock hours that count as night (sun below the horizon). */
export const isNightHour = hour => hour >= 20 || hour < 5;
