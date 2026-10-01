// config.js — data only. All distances are metres. Y is up. North is -Z.

export const VERSION = '0.2.0';

export const CONFIG = Object.freeze({
  seed: 'WILDLANDS-01', baseTile: 256, rootTile: 4096, segments: 24,
  seaLevel: 18, rebaseDistance: 4096, fixedStep: 1 / 60,
  walkSpeed: 11, runSpeed: 25, flySpeed: 95, flyBoost: 5, flyCeiling: 6000,
  eyeHeight: 1.85, gravity: 24, jumpSpeed: 9,
  start: { x: 230, z: 760, yaw: 0.12, pitch: -0.12 },
  saveKey: 'wildlands.v1', surveyKey: 'wildlands.survey.v1', prefsKey: 'wildlands.prefs.v1',
  daySeconds: 1200, fov: 65, flyFov: 73,
});

/**
 * View distance: terrain range, plant range and density, and how far the sun's
 * shadow cascades reach. Image size and shadow-map detail come from the kit's
 * quality tier (Graphics), so a tier never changes how far the world reaches.
 */
export const VIEWS = Object.freeze({
  low:    { label: 'Low',    distance: 5500,  vegetation: 1500, density: 0.6,  shadowFar: 1200, split: 1.2 },
  medium: { label: 'Medium', distance: 8000,  vegetation: 2300, density: 0.8,  shadowFar: 2000, split: 1.45 },
  high:   { label: 'High',   distance: 11000, vegetation: 3200, density: 1,    shadowFar: 2800, split: 1.6 },
  ultra:  { label: 'Ultra',  distance: 15000, vegetation: 4300, density: 1.15, shadowFar: 3600, split: 1.8 },
});

export const BIOMES = ['Water', 'Grassland', 'Forest', 'Alpine', 'Canyon', 'Wetland', 'Highlands'];

export const DESTINATIONS = Object.freeze([
  { name: 'Lake overlook', biome: 'Highlands', x: 230, z: 760, yaw: 0.12, pitch: -0.12, description: 'The start of your next journey.' },
  { name: 'The great lake', biome: 'Water', x: 220, z: -650, yaw: 0, pitch: -0.18, lift: 220, description: 'Blue water beneath the northern peaks.' },
  { name: 'Pinewood', biome: 'Forest', x: -1450, z: 300, yaw: -0.65, pitch: -0.12, description: 'A quiet valley of pine and broadleaf trees.' },
  { name: 'The crown', biome: 'Alpine', x: -1000, z: -3450, yaw: -0.8, pitch: -0.12, lift: 35, description: 'Snow, stone, and a view across the world.' },
  { name: 'Redstone canyon', biome: 'Canyon', x: 3450, z: -750, yaw: -0.9, pitch: -0.3, lift: 100, description: 'Layered cliffs above a winding river.' },
  { name: 'Stillwater marsh', biome: 'Wetland', x: -2850, z: -1650, yaw: 0.3, pitch: -0.13, lift: 15, description: 'Shallow pools, reeds, and cypress trees.' },
  { name: 'Golden plains', biome: 'Grassland', x: 1800, z: 2400, yaw: 0.4, pitch: -0.1, description: 'Open rolling land beneath a wide sky.' },
]);

/**
 * The survey: 21 posts, three in each landscape. Positions are where the
 * surveyors meant to stand; the game moves each post to the nearest dry, level
 * ground for the current seed. `river` and `canyon` sites start from the
 * channel itself and settle on its bank.
 */
export const SURVEY_SITES = Object.freeze([
  { id: 'ridge', name: 'Overlook ridge', landscape: 'Highlands', x: 560, z: 900, note: 'The ridge that hides the lake until the last step.' },
  { id: 'bluff', name: 'Eastern bluff', landscape: 'Highlands', x: 980, z: 260, note: 'Wind-bent grass above the river valley.' },
  { id: 'downs', name: 'Southern downs', landscape: 'Highlands', x: -260, z: 1560, note: 'Long, soft hills rolling away from the lake.' },
  { id: 'southshore', name: 'South shore', landscape: 'Water', x: -120, z: 470, note: 'Pebbles and still water below the overlook.' },
  { id: 'northshore', name: 'North shore', landscape: 'Water', x: -140, z: -1640, note: 'Where the peaks first show in the lake.' },
  { id: 'ford', name: 'River ford', landscape: 'Water', river: true, x: 0, z: 2150, note: 'A shallow crossing on the long river south.' },
  { id: 'clearing', name: 'Pinewood clearing', landscape: 'Forest', x: -1230, z: 520, note: 'A pocket of light inside the pines.' },
  { id: 'oldgrowth', name: 'Old growth', landscape: 'Forest', x: -1920, z: -260, note: 'The tallest broadleaf trees in the valley.' },
  { id: 'brook', name: 'Mossy hollow', landscape: 'Forest', x: -1580, z: 960, note: 'Damp ground and dense, quiet shade.' },
  { id: 'summit', name: 'Crown summit', landscape: 'Alpine', x: -50, z: -4020, note: 'The highest point of the northern wall.' },
  { id: 'westhorn', name: 'Western horn', landscape: 'Alpine', x: -1700, z: -3200, note: 'A sharp peak above the marsh country.' },
  { id: 'easthorn', name: 'Eastern horn', landscape: 'Alpine', x: 1750, z: -3500, note: 'Snow that lasts the whole year.' },
  { id: 'rim', name: 'Canyon rim', landscape: 'Canyon', x: 3560, z: -480, note: 'The first view down into the red country.' },
  { id: 'narrows', name: 'The narrows', landscape: 'Canyon', canyon: true, x: 0, z: -1400, note: 'Cliffs close in over the water.' },
  { id: 'mesa', name: 'High mesa', landscape: 'Canyon', x: 4760, z: -2380, note: 'A flat table of stone above the channel.' },
  { id: 'cypress', name: 'Cypress hollow', landscape: 'Wetland', x: -3100, z: -1850, note: 'Grey trees standing in black water.' },
  { id: 'reeds', name: 'Reed flats', landscape: 'Wetland', x: -2620, z: -2320, note: 'Reeds as far as the eye can see.' },
  { id: 'heron', name: 'Heron point', landscape: 'Wetland', x: -3520, z: -1300, note: 'A dry tongue of land between pools.' },
  { id: 'loneoak', name: 'Lone rise', landscape: 'Grassland', x: 2300, z: 2900, note: 'One low hill in a sea of grass.' },
  { id: 'horizon', name: 'Wide horizon', landscape: 'Grassland', x: 1180, z: 2720, note: 'Nothing but sky in every direction.' },
  { id: 'grasssea', name: 'Eastern meadows', landscape: 'Grassland', x: 2920, z: 1780, note: 'Gold grass running to the canyon country.' },
]);
