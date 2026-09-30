/**
 * data.js — Stillpoint Frontier's content and tuning: the player rig, world
 * constants, relays, settlements, Whisperglass echoes, items, recipes, the
 * field guide and the Meridian contracts, plus small formatting helpers.
 * Pure data; no three.js.
 */

export const PLAYER = {
  eyeHeight: 1.72,
  crouchEyeHeight: 1.12,
  walkSpeed: 6,
  sprintSpeed: 10.5,
  groundAcceleration: 14,
  airAcceleration: 4,
  jumpSpeed: 7.2,
  gravity: 20,
  maxPitch: 87,
  interactionRange: 5.8,
  fov: 78,
};

export const WORLD = {
  seed: 5312912,
  seaLevel: -3.5,
  chunksBuiltPerFrame: 2,
  drawDistanceMultiplier: 10,
  distantTerrainRadius: 1920,
  cameraFarClip: 7000,
  skyRadius: 5200,
  oceanScale: 13000,
};

export const STORAGE = {
  field: 'stillpoint-frontier-pce:field-state:v4',
  sandbox: 'stillpoint-frontier-pce:grid-lab-state:v1',
  relays: 'stillpoint-frontier-pce:relay-state:v1',
  layout: 'stillpoint-frontier-pce:grid-lab-layout:v1',
  options: 'stillpoint-frontier-pce:options:v1',
};

export const RELAYS = [
  { id: 'survey-array', title: 'Survey Array', subtitle: 'Hold the signal on each shard', rule: 'free', position: [-72, 46], color: [0.32, 0.95, 0.78], nodeCount: 3, holdSeconds: 1.25 },
  { id: 'glyph-ring', title: 'Glyph Ring', subtitle: 'Wake the stones in ascending order', rule: 'ordered', position: [77, 42], color: [1, 0.55, 0.28], nodeCount: 4, holdSeconds: 0.15 },
  { id: 'canyon-circuit', title: 'Canyon Circuit', subtitle: 'Close the circuit before it decays', rule: 'timed', position: [18, -94], color: [0.48, 0.64, 1], nodeCount: 3, holdSeconds: 0.15, timeLimit: 24 },
];

export const STAMP_KINDS = ['survey_stake', 'hush_cairn', 'weather_memory_plate', 'route_slab', 'service_cache_shell'];

/** Whisperglass echoes. Each one recorded resolves the bearing to the next. */
export const ECHOES = [
  { id: 'echo-near-silence', entryId: 'guide:echo:near-silence', name: 'Near-Silence Echo', x: 62, z: -38, phase: 0.2, color: [0.32, 0.95, 0.78] },
  { id: 'echo-rain-ledger', entryId: 'guide:echo:rain-ledger', name: 'Rain Ledger Echo', x: 7200, z: -6100, phase: 1.1, color: [0.48, 0.64, 1] },
  { id: 'echo-westward-hush', entryId: 'guide:echo:westward-hush', name: 'Westward Hush Echo', x: -16800, z: 11900, phase: 2.3, color: [1, 0.72, 0.3] },
  { id: 'echo-cinder-index', entryId: 'guide:echo:cinder-index', name: 'Cinder Index Echo', x: 26400, z: 17700, phase: 3.5, color: [1, 0.42, 0.26] },
  { id: 'echo-tideless-bell', entryId: 'guide:echo:tideless-bell', name: 'Tideless Bell Echo', x: -31600, z: -22300, phase: 4.4, color: [0.62, 0.86, 1] },
  { id: 'echo-last-coordinate', entryId: 'guide:echo:last-coordinate', name: 'Last Coordinate Echo', x: 42200, z: -36800, phase: 5.6, color: [0.92, 0.96, 1] },
];

/** An echo's site is on the atlas once the echo before it has been recorded. */
export function echoRevealed(scanned, index) {
  if (index <= 0) return true;
  const previous = ECHOES[index - 1];
  return !!previous && scanned.includes(previous.entryId);
}

export const SETTLEMENTS = [
  { id: 'vesper-crown', name: 'Vesper Crown', tier: 'megacity', x: 5400, z: 7900, economy: 'precision industry / river trade' },
  { id: 'ironvale', name: 'Ironvale', tier: 'city', x: -23850, z: -22875, economy: 'iron / machine works' },
  { id: 'reedwater', name: 'Reedwater', tier: 'city', x: 2950, z: -7650, economy: 'grain / river barges' },
  { id: 'kilnreach', name: 'Kilnreach', tier: 'city', x: 24900, z: 4650, economy: 'glass / ceramics' },
  { id: 'lumenport', name: 'Lumenport', tier: 'city', x: 7100, z: 36375, economy: 'shipping / fisheries' },
  { id: 'timberfall', name: 'Timberfall', tier: 'town', x: -12900, z: -18150, economy: 'timber / resin' },
  { id: 'crosswind', name: 'Crosswind', tier: 'town', x: -27500, z: 1700, economy: 'wool / wind power' },
  { id: 'redhaven', name: 'Redhaven', tier: 'town', x: 15400, z: 18800, economy: 'orchards / clay' },
  { id: 'northwatch', name: 'Northwatch', tier: 'town', x: 2300, z: -37400, economy: 'quarrying / observatory' },
  { id: 'marrow-quay', name: 'Marrow Quay', tier: 'town', x: 12600, z: 31200, economy: 'salt / ship stores' },
  { id: 'ashbarrow', name: 'Ashbarrow', tier: 'town', x: 34200, z: 12500, economy: 'silica / salvage' },
  { id: 'low-reed', name: 'Low Reed', tier: 'village', x: 1100, z: -14400, economy: 'rice / basketry' },
  { id: 'bracken', name: 'Bracken', tier: 'village', x: -17700, z: -9600, economy: 'forestry / herbs' },
  { id: 'warden-post', name: 'Warden Post', tier: 'village', x: -35100, z: 10200, economy: 'ranching / relay service' },
  { id: 'glasswell', name: 'Glasswell', tier: 'village', x: 37000, z: -4600, economy: 'wells / ceramics' },
  { id: 'saltmere', name: 'Saltmere', tier: 'village', x: -6400, z: 41000, economy: 'salt / eels' },
  { id: 'greybank', name: 'Greybank', tier: 'village', x: 3300, z: 20800, economy: 'ferries / grain' },
  { id: 'pine-crossing', name: 'Pine Crossing', tier: 'village', x: -21300, z: 16100, economy: 'lumber / wayhouse' },
  { id: 'crown-step', name: 'Crown Step', tier: 'village', x: -8800, z: -32200, economy: 'goats / slate' },
  { id: 'cinder-gate', name: 'Cinder Gate', tier: 'village', x: 28500, z: -21300, economy: 'ore / caravans' },
  { id: 'estuary-light', name: 'Estuary Light', tier: 'village', x: 15700, z: 43100, economy: 'pilots / lighthouse' },
  { id: 'far-sedge', name: 'Far Sedge', tier: 'village', x: -2900, z: 29700, economy: 'peat / reeds' },
  { id: 'hush-field', name: 'Hush Field', tier: 'village', x: -29600, z: 27500, economy: 'seed grain / weather station' },
  { id: 'sunken-mile', name: 'Sunken Mile', tier: 'village', x: 21800, z: -35000, economy: 'salvage / stone' },
];

export const LOCAL_SITES = [
  { id: 'field-unit', name: 'Field Unit Compound', kind: 'base', x: 0, z: 31 },
  { id: 'stillpoint', name: 'The Stillpoint', kind: 'landmark', x: 0, z: 0 },
  { id: 'survey-array', name: 'Survey Array', kind: 'relay', x: -72, z: 46 },
  { id: 'glyph-ring', name: 'Glyph Ring', kind: 'relay', x: 77, z: 42 },
  { id: 'canyon-circuit', name: 'Canyon Circuit', kind: 'relay', x: 18, z: -94 },
  { id: 'greywater-overlook', name: 'Meridian Survey Tower', kind: 'landmark', x: -118, z: -38 },
];

export const FIELD_UNIT = { id: 'field-unit', name: 'Field Unit Compound', tier: 'village', x: 0, z: 31, economy: 'relay service / field operations' };

/** The sealed vault under the Stillpoint (new content: the "00 / Below" epilogue). */
export const VAULT = { x: 0, z: 0, floorY: WORLD.seaLevel - 36, half: 12.5, height: 9 };

export function nearestLocalSite(x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (const site of LOCAL_SITES) {
    const d = Math.hypot(site.x - x, site.z - z);
    if (d < bestDistance) {
      best = site;
      bestDistance = d;
    }
  }
  return bestDistance <= (best?.kind === 'base' ? 36 : 24) ? best : null;
}

/** Six settlements are linked at the start, six more per restored relay. */
export function revealedSettlementCount(relays) {
  const restored = Number.isFinite(relays) ? Math.max(0, Math.min(3, Math.floor(relays))) : 0;
  return Math.min(SETTLEMENTS.length, 6 + restored * 6);
}

export function travelTargets() {
  return [
    ...LOCAL_SITES.map((s) => ({ id: `local:${s.id}`, label: s.name, group: 'LOCAL SITES', x: s.x, z: s.z, arrivalOffsetZ: s.id === 'field-unit' ? 0 : 5 })),
    ...SETTLEMENTS.map((s) => ({ id: `settlement:${s.id}`, label: s.name, group: 'SETTLEMENTS', x: s.x, z: s.z, arrivalOffsetZ: 22 })),
    ...ECHOES.map((e) => ({ id: `echo:${e.id}`, label: e.name, group: 'WHISPERGLASS ECHOES', x: e.x, z: e.z, arrivalOffsetZ: 6 })),
  ];
}

/* ------------------------------------------------------- compass and format */

export function wrapDegrees(value) {
  return Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0;
}

/** Compass bearing (clockwise from north, north = -Z) from one point to another. */
export function bearingTo(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz) || (dx === 0 && dz === 0)) return 0;
  return wrapDegrees((Math.atan2(dx, -dz) * 180) / Math.PI);
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export function compassLabel(degrees) {
  return COMPASS[Math.round(wrapDegrees(degrees) / 45) % COMPASS.length] ?? 'N';
}

export function formatDistance(metres) {
  if (!Number.isFinite(metres) || metres < 0) return '--';
  if (metres >= 10000) return `${Math.round(metres / 1000)} KM`;
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} KM`;
  return `${Math.round(metres)} M`;
}

export function mapPercent(value, halfExtent) {
  if (!Number.isFinite(value) || !Number.isFinite(halfExtent) || halfExtent <= 0) return 50;
  return Math.min(100, Math.max(0, 50 + (value / (halfExtent * 2)) * 100));
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} H ${String(m).padStart(2, '0')} MIN` : `${m} MIN`;
}

/* ------------------------------------------------------------ items & gear */

export const ITEMS = {
  stone: { name: 'Basalt shard', shortName: 'STONE', category: 'MINERAL', unitWeight: 2.4, stackLimit: 99 },
  wood: { name: 'Resin timber', shortName: 'WOOD', category: 'ORGANIC', unitWeight: 1.8, stackLimit: 99 },
  fiber: { name: 'Conductive lichen', shortName: 'FIBER', category: 'ORGANIC', unitWeight: 0.35, stackLimit: 99 },
  ore: { name: 'Ferric glass', shortName: 'ORE', category: 'MINERAL', unitWeight: 3.1, stackLimit: 99 },
  relic: { name: 'Old-world salvage', shortName: 'RELIC', category: 'SALVAGE', unitWeight: 0.9, stackLimit: 99 },
  first_aid_kit: { name: 'First-aid kit', shortName: 'MEDKIT', category: 'FIELD GEAR', unitWeight: 0.8, stackLimit: 8 },
  bedroll: { name: 'Survey bedroll', shortName: 'BEDROLL', category: 'CAMP', unitWeight: 2.2, stackLimit: 4 },
  campfire_kit: { name: 'Campfire kit', shortName: 'FIRE', category: 'CAMP', unitWeight: 2.8, stackLimit: 4 },
  survey_marker: { name: 'Survey marker', shortName: 'MARKER', category: 'FIELD GEAR', unitWeight: 1.1, stackLimit: 8 },
  weather_shelter: { name: 'Weather shelter', shortName: 'SHELTER', category: 'CAMP', unitWeight: 5.4, stackLimit: 2 },
  field_torch: { name: 'Field torch', shortName: 'TORCH', category: 'FIELD GEAR', unitWeight: 0.7, stackLimit: 8 },
};

export const DEPLOYABLES = ['bedroll', 'campfire_kit', 'survey_marker', 'weather_shelter', 'field_torch'];

export const RECIPES = [
  { id: 'recipe:bedroll:v1', label: 'Survey bedroll', station: 'field', ingredients: { fiber: 2, wood: 1 }, output: { item: 'bedroll', quantity: 1 } },
  { id: 'recipe:campfire:v1', label: 'Campfire kit', station: 'field', ingredients: { wood: 2, stone: 2 }, output: { item: 'campfire_kit', quantity: 1 } },
  { id: 'recipe:marker:v1', label: 'Survey marker', station: 'field', ingredients: { wood: 1, stone: 1 }, output: { item: 'survey_marker', quantity: 1 } },
  { id: 'recipe:medkit:v1', label: 'First-aid kit', station: 'workbench', ingredients: { fiber: 2, relic: 1 }, output: { item: 'first_aid_kit', quantity: 1 } },
  { id: 'recipe:shelter:v1', label: 'Weather shelter', station: 'workbench', ingredients: { wood: 3, fiber: 3 }, output: { item: 'weather_shelter', quantity: 1 } },
  { id: 'recipe:torch:v1', label: 'Field torch', station: 'workbench', ingredients: { wood: 1, fiber: 1, relic: 1 }, output: { item: 'field_torch', quantity: 1 } },
];

export const GUIDE = [
  { id: 'guide:landmark:weather-mast', name: 'Kestrel weather mast', category: 'landmark', note: 'A pre-migration instrument rebuilt around a low-energy Stillpoint core.' },
  { id: 'guide:landmark:stillpoint', name: 'The Stillpoint', category: 'landmark', note: 'A silent relay nexus. Its geometry predates every settlement on the current atlas.' },
  { id: 'guide:landmark:meridian-tower', name: 'Meridian survey tower', category: 'landmark', note: 'A three-deck observation stack built over the oldest intact regional lift.' },
  { id: 'guide:flora:conductive-lichen', name: 'Conductive lichen', category: 'flora', note: 'Silver-green growth that carries a stable charge after rainfall.' },
  { id: 'guide:flora:silver-reed', name: 'Silver reed', category: 'flora', note: 'A riverland reed that leans into charged weather instead of away from it.' },
  { id: 'guide:flora:sable-pine', name: 'Sable pine', category: 'flora', note: 'A resin-rich conifer used for weatherproof field structures.' },
  { id: 'guide:resource:ferric-glass', name: 'Ferric glass', category: 'resource', note: 'A brittle mineral laminate exposed where old signal storms fused the soil.' },
  { id: 'guide:resource:basalt', name: 'Signal basalt', category: 'resource', note: 'Dense stone whose fractures align with the nearest powered relay.' },
  { id: 'guide:resource:old-world-salvage', name: 'Old-world salvage', category: 'resource', note: 'Field-safe mechanisms recovered from sealed Meridian service caches.' },
  { id: 'guide:fauna:pebbleback', name: 'Pebbleback', category: 'fauna', note: 'A rigid-plated grazer that freezes before fleeing along familiar ground routes.' },
  { id: 'guide:fauna:sailwing', name: 'Sailwing', category: 'fauna', note: 'A thermal glider whose broad silhouette makes animation unnecessary at distance.' },
  { id: 'guide:fauna:ridge-stilt', name: 'Ridge stilt', category: 'fauna', note: 'A long-legged steppe browser represented by posture changes and route logic.' },
  { id: 'guide:echo:near-silence', name: 'Near-Silence Echo', category: 'landmark', note: 'Whisperglass tuned to the field compound. It repeats footsteps a few seconds before they happen.' },
  { id: 'guide:echo:rain-ledger', name: 'Rain Ledger Echo', category: 'landmark', note: 'A rigid weather-memory plate recording storms that never crossed this basin.' },
  { id: 'guide:echo:westward-hush', name: 'Westward Hush Echo', category: 'landmark', note: 'The array points below the western horizon and refuses every surveyed correction.' },
  { id: 'guide:echo:cinder-index', name: 'Cinder Index Echo', category: 'landmark', note: 'Heatless ferric glass cataloguing names absent from Meridian settlement rolls.' },
  { id: 'guide:echo:tideless-bell', name: 'Tideless Bell Echo', category: 'landmark', note: 'A coastal signal frame that resonates only when the sea is completely still.' },
  { id: 'guide:echo:last-coordinate', name: 'Last Coordinate Echo', category: 'landmark', note: 'Six impossible bearings converge on a point beneath the atlas: 00 / BELOW / REMEMBER.' },
  { id: 'guide:landmark:below', name: '00 / Below', category: 'landmark', note: 'A sealed survey vault under the Stillpoint. Six bearings meet at the coordinate Meridian cut from every atlas.' },
];

export const GUIDE_BELOW_ID = 'guide:landmark:below';

export const CONTRACTS = [
  {
    id: 'field-calibration',
    code: 'FC-01',
    title: 'Field Calibration',
    summary: 'Prove the compound instruments and field protocol.',
    objectives: [
      { id: 'orders', label: 'Read the standing orders', complete: (s) => s.inspected.includes('standing-orders') },
      { id: 'fiber', label: 'Collect 2 conductive lichen', complete: (s) => s.inventory.fiber >= 2 || s.collected.filter((id) => id.startsWith('lichen')).length >= 2 },
      { id: 'mast', label: 'Scan the weather mast', complete: (s) => s.scanned.includes('guide:landmark:weather-mast') },
      { id: 'mara', label: 'Report to Mara Venn', complete: (s) => s.conversations.includes('mara-venn') },
    ],
  },
  {
    id: 'shelter-protocol',
    code: 'SP-02',
    title: 'Shelter Protocol',
    summary: 'Fabricate and prove a minimal field camp.',
    objectives: [
      { id: 'bedroll', label: 'Craft a survey bedroll', complete: (s) => s.crafted.includes('recipe:bedroll:v1') },
      { id: 'camp', label: 'Deploy field camp equipment', complete: (s) => s.deployments.some((d) => d.item === 'bedroll' || d.item === 'campfire_kit' || d.item === 'weather_shelter') },
      { id: 'rest', label: 'Complete a field rest', complete: (s) => s.restCount > 0 },
    ],
  },
  {
    id: 'meridian-stores',
    code: 'MS-03',
    title: 'Meridian Stores',
    summary: 'Audit the service cache and log regional wildlife.',
    objectives: [
      { id: 'cache', label: 'Recover the service cache', complete: (s) => s.opened.includes('service-cache') },
      { id: 'fauna', label: 'Catalog a regional animal', complete: (s) => s.scanned.some((id) => id.startsWith('guide:fauna:')) },
      { id: 'tower', label: 'Reach the Meridian tower deck', complete: (s) => s.scanned.includes('guide:landmark:meridian-tower') },
    ],
  },
  {
    id: 'whisperglass-survey',
    code: 'EC-04',
    title: 'Whisperglass Survey',
    summary: 'Follow the Whisperglass bearings out across the territory.',
    objectives: [
      { id: 'near', label: 'Record the Near-Silence echo', complete: (s) => s.scanned.includes(ECHOES[0].entryId) },
      { id: 'bearing', label: 'Record an echo beyond the basin', complete: (s) => ECHOES.some((e, i) => i > 0 && s.scanned.includes(e.entryId)) },
      { id: 'all', label: 'Record all six Whisperglass echoes', complete: (s) => ECHOES.every((e) => s.scanned.includes(e.entryId)) },
    ],
  },
];

/** The Stillpoint archive opens once these three are filed (EC-04 is an optional survey). */
export const CORE_CONTRACT_IDS = ['field-calibration', 'shelter-protocol', 'meridian-stores'];

export const RESOURCES = [
  { id: 'lichen-01', item: 'fiber', quantity: 1, x: -8, z: 20, kind: 'lichen' },
  { id: 'lichen-02', item: 'fiber', quantity: 1, x: 8, z: 18, kind: 'lichen' },
  { id: 'lichen-03', item: 'fiber', quantity: 1, x: -22, z: 40, kind: 'lichen' },
  { id: 'lichen-04', item: 'fiber', quantity: 1, x: 25, z: 46, kind: 'lichen' },
  { id: 'stone-01', item: 'stone', quantity: 2, x: 28, z: 15, kind: 'stone' },
  { id: 'stone-02', item: 'stone', quantity: 2, x: -34, z: 6, kind: 'stone' },
  { id: 'wood-01', item: 'wood', quantity: 2, x: -28, z: 58, kind: 'wood' },
  { id: 'wood-02', item: 'wood', quantity: 2, x: 31, z: 69, kind: 'wood' },
  { id: 'ore-01', item: 'ore', quantity: 1, x: 54, z: 29, kind: 'ore' },
  { id: 'relic-01', item: 'relic', quantity: 1, x: -48, z: 31, kind: 'relic' },
];

/** Survival pressure setting (pause menu). Scales how fast wetness, cold and cold damage build. */
export const EXPOSURE_LEVELS = [
  { id: 'standard', label: 'STANDARD', scale: 1 },
  { id: 'gentle', label: 'GENTLE', scale: 0.45 },
  { id: 'off', label: 'OFF', scale: 0 },
];
