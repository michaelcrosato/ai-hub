// Tables and the deterministic noise the whole world grows from.

export const CONFIG = Object.freeze({
  seed: 831742,
  chunkSize: 96,
  cellSize: 4,
  stepHeight: 2,
  viewRadii: Object.freeze({ low: 9, balanced: 14, ultra: 22 }),
  walkSpeed: 13,
  flySpeed: 44,
  simulationStep: 0.2,
  dayLength: 1200,
  maxAnimals: 48,
  shadowSize: 2048,
  eyeHeight: 3.2,
});

export const BIOMES = {
  plains: { name: 'The Greenreach', type: 'Rolling plains', color: '#79a34b', tree: 'oak', density: 0.19 },
  forest: { name: 'Whispering Woods', type: 'Temperate forest', color: '#497743', tree: 'pine', density: 0.65 },
  mountain: { name: 'The Frostspires', type: 'Alpine mountains', color: '#a2a8a1', tree: 'pine', density: 0.19 },
  canyon: { name: 'Redstone Canyon', type: 'Dry canyon', color: '#c38355', tree: 'cactus', density: 0.12 },
  swamp: { name: 'Stillwater Marsh', type: 'Wetland', color: '#748548', tree: 'willow', density: 0.38 },
  tropical: { name: 'Sunleaf Coast', type: 'Tropical forest', color: '#79ad57', tree: 'palm', density: 0.42 },
  farmland: { name: 'Golden Fields', type: 'Farmland', color: '#a5ad54', tree: 'birch', density: 0.07 },
  city: { name: 'Alderhaven', type: 'River city', color: '#8d996b', tree: 'oak', density: 0 },
};

export const PLACES = [
  { name: 'The Greenreach', detail: 'Rolling hills · river valley', x: 80, z: 160, icon: 'leaf' },
  { name: 'Whispering Woods', detail: 'Pine, oak, and birch forest', x: -330, z: 40, icon: 'tree' },
  { name: 'Alderhaven', detail: 'A city built from the world seed', x: 330, z: -220, icon: 'city' },
  { name: 'The Frostspires', detail: 'Snow peaks · alpine forest', x: -120, z: -670, icon: 'mountain' },
  { name: 'Silverfall', detail: 'Waterfall · upper river', x: -105, z: -280, icon: 'water' },
  { name: 'Hollowstone Cave', detail: 'Stone tunnel · forest edge', x: -265, z: -170, icon: 'mountain' },
  { name: 'Redstone Canyon', detail: 'Layered rock · desert plants', x: -710, z: -70, icon: 'mountain' },
  { name: 'Stillwater Marsh', detail: 'Shallow pools · willow trees', x: 650, z: 260, icon: 'water' },
  { name: 'Golden Fields', detail: 'Crop rows · farmhouses', x: 330, z: 80, icon: 'leaf' },
  { name: 'Sunleaf Coast', detail: 'Palms · tropical woodland', x: 60, z: 810, icon: 'sun' },
  { name: 'The Sunstone Ring', detail: 'Standing stones · woodland clearing', x: -430, z: 470, icon: 'stones' },
];

/** rates: hunger, thirst and fatigue gained per second of simulation. */
export const SPECIES = {
  deer: { name: 'Fallow deer', color: 12355424, size: 1.1, speed: 4, diet: 'grass', rates: [0.0028, 0.0022, 0.0018], habitat: 'Meadows and woodland edges' },
  rabbit: { name: 'Meadow rabbit', color: 13023648, size: 0.45, speed: 4.8, diet: 'grass', rates: [0.004, 0.0024, 0.002], habitat: 'Almost anywhere with grass' },
  boar: { name: 'Wild boar', color: 6902602, size: 0.95, speed: 2.8, diet: 'roots', rates: [0.003, 0.0025, 0.0019], habitat: 'Woods, marsh and coast' },
  fox: { name: 'Red fox', color: 13072952, size: 0.7, speed: 4.3, diet: 'berries', rates: [0.0031, 0.0024, 0.002], habitat: 'Meadows, woods and hills' },
  sheep: { name: 'Field sheep', color: 14868431, size: 1, speed: 2.3, diet: 'grass', rates: [0.0035, 0.0023, 0.0018], habitat: 'The Golden Fields' },
  capybara: { name: 'Capybara', color: 10189145, size: 1, speed: 2.5, diet: 'grass', rates: [0.003, 0.002, 0.0018], habitat: 'Stillwater Marsh and Sunleaf Coast' },
  goat: { name: 'Mountain goat', color: 0xe6e1d3, size: 0.9, speed: 3.4, diet: 'grass', rates: [0.0026, 0.0015, 0.0017], habitat: 'High slopes of the Frostspires' },
  bear: { name: 'Brown bear', color: 0x6e4b31, size: 1.45, speed: 3, diet: 'berries', rates: [0.0024, 0.0018, 0.0022], habitat: 'Deep in Whispering Woods' },
};

export const STATE_LABELS = {
  wander: 'Exploring',
  seekFood: 'Finding food',
  seekWater: 'Finding water',
  eat: 'Eating',
  drink: 'Drinking',
  sleep: 'Sleeping',
};

export const WEATHER_LABELS = { clear: 'Clear skies', overcast: 'Overcast', rain: 'Rain', changing: 'Changing weather' };

/** Integer hash of a lattice point to 0..1. */
export function hash2(x, z, seed = CONFIG.seed) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export const smooth01 = (t) => t * t * (3 - 2 * t);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth01(x - x0);
  const fz = smooth01(z - z0);
  return lerp(lerp(hash2(x0, z0, seed), hash2(x0 + 1, z0, seed), fx), lerp(hash2(x0, z0 + 1, seed), hash2(x0 + 1, z0 + 1, seed), fx), fz);
}

export function fbm(x, z, seed) {
  return valueNoise(x, z, seed) * 0.58 + valueNoise(x * 2, z * 2, seed + 11) * 0.27 + valueNoise(x * 4, z * 4, seed + 29) * 0.15;
}

/** Small seeded generator (0..1). */
export function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 1831565813;
    let e = t;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  };
}

/** A generator seeded from a lattice point. */
export const rngAt = (x, z, seed) => rng(Math.floor(hash2(x, z, seed) * 4294967295));

/** Chunk coordinates packed into one number (Map keys without string garbage). */
export const chunkKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
export const keyX = (key) => Math.floor(key / 65536) - 32768;
export const keyZ = (key) => (key % 65536) - 32768;

export const fmtClock = (hour) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;
