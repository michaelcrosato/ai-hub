/**
 * world.js — the Obsidian Expanse frontier: terrain, biomes, settlements,
 * roads, landmarks data, resource nodes and the streamed 96 m world cells.
 *
 * The terrain, biome and prop generators are the original game's, number for
 * number, so the world looks the same. The streamer now builds cells a few per
 * frame (nearest first) instead of all at once, adds a low-detail terrain ring
 * past the full-detail cells, gives cells shared edges and analytic normals
 * (no lighting seams), and keeps simple colliders for the props.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const CHUNK = 96;
const HALF = CHUNK / 2;
export const WORLD_RADIUS = 47000;

/* ------------------------------------------------------------------ noise */

/** Seeded generator (the original's mulberry-style PRNG). */
export function rng(seed) {
  let e = seed >>> 0;
  return () => {
    e = (e + 1831565813) >>> 0;
    let t = e;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer hash of a lattice point. */
export function hash2(x, z, seed = 11869466) {
  let s = Math.imul(x | 0, 521288629) ^ Math.imul(z | 0, 1597334677) ^ seed;
  s = Math.imul(s ^ (s >>> 16), 73244475);
  s = Math.imul(s ^ (s >>> 16), 73244475);
  return (s ^ (s >>> 16)) >>> 0;
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => n * n * (3 - 2 * n);

function valueNoise(x, z, scale, seed) {
  const fx = x / scale;
  const fz = z / scale;
  const ix = Math.floor(fx);
  const iz = Math.floor(fz);
  const u = smooth(fx - ix);
  const v = smooth(fz - iz);
  const h0 = (hash2(ix, iz, seed) / 4294967295) * (1 - u) + (hash2(ix + 1, iz, seed) / 4294967295) * u;
  const h1 = (hash2(ix, iz + 1, seed) / 4294967295) * (1 - u) + (hash2(ix + 1, iz + 1, seed) / 4294967295) * u;
  return h0 * (1 - v) + h1 * v;
}

function fbm(x, z, scale, seed) {
  return (
    valueNoise(x, z, scale, seed) * 0.57 +
    valueNoise(x, z, scale * 0.46, seed ^ 5370206) * 0.29 +
    valueNoise(x, z, scale * 0.21, seed ^ 10632593) * 0.14
  );
}

/** Distance to the nearest of the three trunk rivers. */
export function riverDistance(x, z) {
  const t = 4200 * Math.sin(x / 11000) + x * 0.08 - 1600;
  const s = -z * 0.18 + 6000 * Math.sin(z / 15000) + 8500;
  const i = -0.32 * x + 8200 + 1500 * Math.sin(x / 6200);
  return Math.min(Math.abs(z - t), Math.abs(x - s), Math.abs(z - i) * 1.25);
}

/** Terrain height in metres. */
export function heightAt(x, z) {
  const t = (fbm(x, z, 7200, 11482662) - 0.48) * 112;
  const s = Math.abs(fbm(x + 19000, z - 7000, 3100, 11887184) - 0.5) * 58;
  const i = Math.abs(Math.sin((x + z) * 0.00125 + fbm(x, z, 1800, 11869466) * 3.2)) * 18;
  const r = Math.sin(x * 0.018) * 2.8 + Math.cos(z * 0.015) * 2.1 + Math.sin(x * 0.091 + Math.cos(z * 0.044) * 2.2) * 0.65;
  const a = Math.max(0, 1 - riverDistance(x, z) / 310) * 16;
  const o = Math.hypot(x, z);
  const l = o < 430 ? -38 * (1 - o / 430) : 0;
  const u = o < 150 ? -11 * (1 - o / 150) : 0;
  const c = o < 25 ? 9 * (1 - o / 25) : 0;
  return t + s + i + r - a + l + u + c;
}

function latitude(x, z) {
  return clamp01(0.72 - Math.abs(z) / (WORLD_RADIUS * 1.2) + (fbm(x, z, 8000, 11873871) - 0.5) * 0.36);
}

function fields(x, z) {
  const t = clamp01(0.2 + fbm(x - 9000, z + 3000, 5200, 11895984) * 0.86);
  const s = latitude(x, z);
  const i = fbm(x + 12000, z - 17000, 2700, 11890435);
  const r = clamp01(Math.exp(-riverDistance(x, z) / 820));
  const a = Math.abs(heightAt(x + 32, z) - heightAt(x - 32, z)) + Math.abs(heightAt(x, z + 32) - heightAt(x, z - 32));
  const o = clamp01(1 - a / 42);
  const l = clamp01(1 - Math.hypot(x, z) / WORLD_RADIUS);
  return {
    water: r,
    arability: clamp01(t * s * o * 1.5),
    minerals: clamp01(i * 0.86 + (1 - o) * 0.42),
    energy: clamp01((1 - t) * s * 0.68 + i * 0.42),
    trade: clamp01(r * 0.62 + l * 0.32 + o * 0.18),
  };
}

export function biomeAt(x, z) {
  if (Math.hypot(x, z) < 470) return 'null-crater';
  const s = fields(x, z);
  const i = heightAt(x, z);
  const r = latitude(x, z);
  if (Math.abs(z) > 31000 || r < 0.23) return 'frost-shelf';
  if (i > 72 || s.minerals > 0.8) return 'iron-highlands';
  if (s.water > 0.72 && i < 18) return 'salt-marsh';
  if (s.arability > 0.67 && s.water > 0.28) return 'glasswood';
  if (s.arability > 0.46) return 'verdant-steppe';
  if (r > 0.68 && s.water < 0.18) return 'ember-waste';
  if (s.minerals > 0.63) return 'fracture';
  if (i < -12 || s.water > 0.48) return 'sunken-array';
  return 'shard-flats';
}

export const BIOME_LABELS = {
  'shard-flats': 'SHARD FLATS',
  fracture: 'FRACTURE CANYONS',
  'sunken-array': 'SUNKEN ARRAY',
  'null-crater': 'NULL CRATER',
  'verdant-steppe': 'VERDANT STEPPE',
  glasswood: 'GLASSWOOD',
  'salt-marsh': 'SALT MARSH',
  'iron-highlands': 'IRON HIGHLANDS',
  'ember-waste': 'EMBER WASTE',
  'frost-shelf': 'FROST SHELF',
};

const BIOME_COLORS = {
  'shard-flats': [1055520, 2373955],
  fracture: [1971481, 4925489],
  'sunken-array': [1119517, 2700104],
  'null-crater': [592658, 2630205],
  'verdant-steppe': [1385246, 3691331],
  glasswood: [1057310, 2643785],
  'salt-marsh': [1319974, 4614239],
  'iron-highlands': [1841952, 5591130],
  'ember-waste': [2758420, 7684395],
  'frost-shelf': [1779504, 7967392],
};

/** Biomes that grow glasswood (trees instead of harvestable rock). */
const WOODED = new Set(['verdant-steppe', 'glasswood', 'salt-marsh']);

/* ------------------------------------------------------------ settlements */

export const SETTLEMENTS = [
  { id: 'nacre-crown', name: 'NACRE CROWN', tier: 'megacity', population: 126e5, industry: 'intercontinental port · fabrication · administration', reason: 'A vertical port arcology where both trunk rivers meet; freshwater, imported food, power and four freight corridors converge.', radius: 3200, color: 7792639, x: 8800, z: 2000 },
  { id: 'helioport', name: 'HELIOPORT', tier: 'city', population: 264e3, industry: 'solar glass · river freight', reason: 'A dry western port with clear skies, a navigable river shelf and direct access to glass sands.', radius: 690, color: 16754780, x: -12000, z: -6300 },
  { id: 'iron-meridian', name: 'IRON MERIDIAN', tier: 'city', population: 318e3, industry: 'ore refining · heavy machinery', reason: 'Occupies the only broad river pass through the northern iron highlands.', radius: 720, color: 16741209, x: 10400, z: 10000 },
  { id: 'mosslight', name: 'MOSSLIGHT', tier: 'city', population: 196e3, industry: 'agriculture · bioceramics', reason: "A warm floodplain city surrounded by the continent's deepest productive soils.", radius: 650, color: 7208882, x: 16000, z: 3850 },
  { id: 'vesper-reach', name: 'VESPER REACH', tier: 'city', population: 227e3, industry: 'salvage yards · ship frames', reason: 'A protected southern bend where wreck fields meet deep-water transport.', radius: 670, color: 12160255, x: 6200, z: -15000 },
  { id: 'cobalt-ford', name: 'COBALT FORD', tier: 'town', population: 34e3, industry: 'cobalt extraction · caravan repair', reason: 'Controls the westernmost reliable river crossing beside exposed cobalt seams.', radius: 340, color: 7246847, x: -22000, z: -7180 },
  { id: 'ashmarket', name: 'ASHMARKET', tier: 'town', population: 41e3, industry: 'grain exchange · kiln works', reason: 'A market town between the central basin and western farms, with clay-rich riverbanks.', radius: 350, color: 16751474, x: -5000, z: -3850 },
  { id: 'prism-quay', name: 'PRISM QUAY', tier: 'town', population: 38e3, industry: 'crystal cutting · barge freight', reason: 'Established on an eastern river terrace below accessible crystal fields.', radius: 340, color: 8187647, x: 23000, z: 3900 },
  { id: 'northglass', name: 'NORTHGLASS', tier: 'town', population: 29e3, industry: 'coldhouse farming · optics', reason: 'Geothermal vents keep a northern river shelf cultivable through long freezes.', radius: 320, color: 12839167, x: 10600, z: 21000 },
  { id: 'red-delta', name: 'RED DELTA', tier: 'town', population: 36e3, industry: 'saltworks · algae fuel', reason: 'A distributary delta supplies brine, biomass and southern river access.', radius: 350, color: 16739686, x: 7000, z: -25000 },
  { id: 'ferrum-gate', name: 'FERRUM GATE', tier: 'town', population: 31e3, industry: 'iron mining · tunnel logistics', reason: 'The safest pass through a western ore belt makes it both mine head and toll town.', radius: 330, color: 13208434, x: -17000, z: 11000 },
  { id: 'ember-hollow', name: 'EMBER HOLLOW', tier: 'town', population: 27e3, industry: 'thermal power · ceramics', reason: 'Dry geothermal fractures provide dependable power beside refractory clays.', radius: 315, color: 16740679, x: 25000, z: -12000 },
  { id: 'pale-confluence', name: 'PALE CONFLUENCE', tier: 'town', population: 33e3, industry: 'timber exchange · milling', reason: 'A tributary junction concentrates timber floated down from two glasswood valleys.', radius: 335, color: 10347201, x: -8000, z: 18000 },
  { id: 'survey-camp', name: 'SURVEY CAMP FOUR', tier: 'village', population: 480, industry: 'salvage · field research', reason: 'A small serviced outpost on the safe rim of the Null Crater.', radius: 115, color: 8186111, x: 620, z: 420 },
  { id: 'drywell', name: 'DRYWELL', tier: 'village', population: 1300, industry: 'herding · condenser repair', reason: 'Atmospheric condensers make an otherwise dry crossroad permanently habitable.', radius: 130, color: 15775865, x: -3000, z: 3200 },
  { id: 'reedwake', name: 'REEDWAKE', tier: 'village', population: 2200, industry: 'reed fiber · fishing', reason: 'Shallow wetlands support fiber crops and reliable protein close to the basin road.', radius: 145, color: 7395735, x: 3000, z: -1150 },
  { id: 'flaxen-post', name: 'FLAXEN POST', tier: 'village', population: 1900, industry: 'fiber farming · waystation', reason: 'A sheltered strip of arable ground serves traffic approaching Helioport.', radius: 140, color: 14275213, x: -15500, z: -6000 },
  { id: 'quarry-nine', name: 'QUARRY NINE', tier: 'village', population: 1600, industry: 'stone · ore sorting', reason: "A low-cost sorting settlement beside Iron Meridian's southern quarry road.", radius: 130, color: 12096128, x: 11000, z: 13000 },
  { id: 'orchard-spine', name: 'ORCHARD SPINE', tier: 'village', population: 2800, industry: 'orchards · seed stock', reason: "Raised ground above Mosslight's floodplain protects orchards and seed vaults.", radius: 150, color: 9431695, x: 15500, z: 5600 },
  { id: 'saltmere', name: 'SALTMERE', tier: 'village', population: 1700, industry: 'salt pans · net making', reason: 'A calm brackish reach supports evaporation ponds and river fisheries.', radius: 135, color: 10410981, x: 6000, z: -17000 },
  { id: 'cinder-farm', name: 'CINDER FARM', tier: 'village', population: 2100, industry: 'heat crops · ceramics', reason: 'Volcanic soil and waste heat support hardy crops in the eastern drylands.', radius: 145, color: 16749930, x: 22000, z: -11000 },
  { id: 'frostline', name: 'FROSTLINE', tier: 'village', population: 1100, industry: 'ice harvesting · cold storage', reason: 'Seasonal ice and persistent wind provide cooling and power for northern trade.', radius: 125, color: 13233663, x: 10000, z: 25000 },
  { id: 'waystone', name: 'WAYSTONE', tier: 'village', population: 1500, industry: 'timber · caravan service', reason: 'A defensible ridge stop links Pale Confluence to the northern city road.', radius: 130, color: 9947555, x: -7000, z: 17000 },
  { id: 'copper-leaf', name: 'COPPER LEAF', tier: 'village', population: 1800, industry: 'copper · charcoal', reason: 'Wooded slopes overlap a shallow copper band, supplying both ore and fuel.', radius: 140, color: 13732706, x: -19000, z: 10000 },
  { id: 'last-water', name: 'LAST WATER', tier: 'village', population: 900, industry: 'well tending · caravan refuge', reason: 'The final perennial spring before the far western cobalt road.', radius: 120, color: 7650792, x: -25000, z: -7500 },
];

const TIER_RANK = { megacity: 3, city: 2, town: 1, village: 0 };
const SETTLEMENT_BY_ID = new Map(SETTLEMENTS.map((s) => [s.id, s]));
/** Every settlement's road runs to the nearest settlement of a higher tier. */
const ROADS = SETTLEMENTS.filter((n) => n.tier !== 'megacity').map((n) => {
  const up = SETTLEMENTS.filter((t) => TIER_RANK[t.tier] > TIER_RANK[n.tier]).sort(
    (t, s) => Math.hypot(t.x - n.x, t.z - n.z) - Math.hypot(s.x - n.x, s.z - n.z)
  )[0];
  return { from: SETTLEMENT_BY_ID.get(n.id), to: SETTLEMENT_BY_ID.get(up.id) };
});

export function nearestSettlement(x, z) {
  let best = SETTLEMENTS[0];
  let dist = Math.hypot(best.x - x, best.z - z);
  for (let i = 1; i < SETTLEMENTS.length; i += 1) {
    const s = SETTLEMENTS[i];
    const d = Math.hypot(s.x - x, s.z - z);
    if (d < dist) {
      best = s;
      dist = d;
    }
  }
  return { settlement: best, distance: dist };
}

export function settlementInfluence(x, z) {
  let out = null;
  for (const s of SETTLEMENTS) {
    const r = clamp01(1 - Math.hypot(x - s.x, z - s.z) / s.radius);
    if (r > (out?.influence ?? 0)) out = { settlement: s, influence: r };
  }
  return out;
}

function segmentDistance(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = dx * dx + dz * dz;
  const t = len ? clamp01(((x - a.x) * dx + (z - a.z) * dz) / len) : 0;
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
}

export function roadDistance(x, z) {
  let d = Number.POSITIVE_INFINITY;
  for (const r of ROADS) d = Math.min(d, segmentDistance(x, z, r.from, r.to));
  return d;
}

export const chunkIndex = (n) => Math.floor((n + HALF) / CHUNK);
const keyOf = (cx, cz) => (cx + 2048) * 4096 + (cz + 2048);

/** Keep a position inside the 47 km frontier (mutates and returns p). */
export function clampToWorld(p) {
  const d = Math.hypot(p.x, p.z);
  if (d > WORLD_RADIUS) {
    const k = WORLD_RADIUS / d;
    p.x *= k;
    p.z *= k;
  }
  return p;
}

/* -------------------------------------------------------------- landmarks */

export const BEACONS = [
  { id: 'Aster', label: 'ASTER SPIRE', frequency: '14.2 THz', x: 72, z: 66, color: 0x52e5ff, tone: 'cyan' },
  { id: 'Cinder', label: 'CINDER SPIRE', frequency: '07.9 THz', x: -82, z: 18, color: 0xff7a45, tone: 'amber' },
  { id: 'Vesper', label: 'VESPER SPIRE', frequency: '22.6 THz', x: 38, z: -86, color: 0xb77bff, tone: 'violet' },
];

/** Directive 02: frontier survey sites that take a relay once the vault is open. */
export const RELAY_SITES = [
  { id: 'glass-terrace', label: 'GLASS TERRACE', x: 300, z: 250 },
  { id: 'salt-gate', label: 'SALT GATE', x: -430, z: 170 },
  { id: 'echo-ridge', label: 'ECHO RIDGE', x: -250, z: -480 },
  { id: 'iron-sill', label: 'IRON SILL', x: 540, z: -280 },
  { id: 'camp-four-ridge', label: 'CAMP FOUR RIDGE', x: 500, z: 330 },
].map((s) => ({ ...s, siteLabel: `${s.label} SITE` }));

export const SENTINELS = [
  { x: -37, z: 76, color: 0xff6a42 },
  { x: 98, z: -28, color: 0x7d75ff },
  { x: -116, z: -72, color: 0x54dfff },
];

export function headingLabel(deg) {
  const e = ((deg % 360) + 360) % 360;
  const t = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return t[Math.round(e / 45) % t.length];
}

export function formatDistance(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)} KM` : `${Math.max(0, Math.round(n))} M`;
}

/* -------------------------------------------------------------- resources */

export const ITEMS = {
  'crystal-shard': { label: 'SHARD', long: 'CRYSTAL SHARD', stackLimit: 999 },
  stone: { label: 'STONE', long: 'STONE', stackLimit: 999 },
  timber: { label: 'TIMBER', long: 'TIMBER', stackLimit: 999 },
  fiber: { label: 'FIBER', long: 'FIBER', stackLimit: 999 },
};

export function sanitizeInventory(n = {}) {
  const v = (k) => Math.max(0, Math.min(ITEMS[k].stackLimit, Math.floor(Number(n?.[k]) || 0)));
  return { 'crystal-shard': v('crystal-shard'), stone: v('stone'), timber: v('timber'), fiber: v('fiber') };
}

export function canAdd(inv, item, qty) {
  return qty >= 0 && inv[item] + qty <= ITEMS[item].stackLimit;
}

const NODE_KINDS = {
  pickup: { item: 'crystal-shard', hitPoints: 1, yield: 1 },
  rock: { item: 'stone', hitPoints: 5, yield: 3 },
  tree: { item: 'timber', hitPoints: 6, yield: 4 },
  reed: { item: 'fiber', hitPoints: 3, yield: 2 },
};

/** Same id scheme as the original, so saved depleted nodes stay depleted. */
export const resourceId = (cx, cz, kind, index) => `oe-world-v2:${cx}:${cz}:${kind}:${index}`;

/* -------------------------------------------------------------- colliders */

/** Push p (x, z) out of a circle. r already includes the player's radius. */
export function pushCircle(p, x, z, r) {
  const dx = p.x - x;
  const dz = p.z - z;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-5) {
    p.x = x + r;
    return true;
  }
  const k = r / d;
  p.x = x + dx * k;
  p.z = z + dz * k;
  return true;
}

/** Push p out of an oriented box (half sizes hw/hd, rotation cos c / sin s about Y). */
export function pushBox(p, x, z, hw, hd, c, s, radius) {
  const wx = p.x - x;
  const wz = p.z - z;
  const lx = c * wx - s * wz;
  const lz = s * wx + c * wz;
  if (Math.abs(lx) > hw + radius || Math.abs(lz) > hd + radius) return false;
  const qx = Math.max(-hw, Math.min(hw, lx));
  const qz = Math.max(-hd, Math.min(hd, lz));
  const dx = lx - qx;
  const dz = lz - qz;
  const d2 = dx * dx + dz * dz;
  let nx;
  let nz;
  if (d2 > 1e-8) {
    if (d2 >= radius * radius) return false;
    const d = Math.sqrt(d2);
    nx = qx + (dx / d) * radius;
    nz = qz + (dz / d) * radius;
  } else if (hw - Math.abs(lx) < hd - Math.abs(lz)) {
    nx = Math.sign(lx || 1) * (hw + radius);
    nz = lz;
  } else {
    nx = lx;
    nz = Math.sign(lz || 1) * (hd + radius);
  }
  p.x = x + c * nx + s * nz;
  p.z = z - s * nx + c * nz;
  return true;
}

/* ---------------------------------------------------------------- terrain */

const ROAD_COLOR = new THREE.Color(592911);
const _low = new THREE.Color();
const _high = new THREE.Color();
const _tint = new THREE.Color();
const _w = new THREE.Color();

/**
 * A terrain cell: shared-edge grid in cell-local space with normals from the
 * height field (so neighbouring cells light identically at their seams) and,
 * for the low-detail ring, skirts that hide cracks against finer neighbours.
 */
function buildTerrain(ox, oz, segs, tint, tintAmount, roadCheck, skirt) {
  const step = CHUNK / segs;
  const n = segs + 1;
  const m = n + 2;
  const H = new Float32Array(m * m);
  for (let j = 0; j < m; j += 1) {
    const z = oz - HALF + (j - 1) * step;
    for (let i = 0; i < m; i += 1) H[j * m + i] = heightAt(ox - HALF + (i - 1) * step, z);
  }
  const edgeVerts = skirt ? 4 * n : 0;
  const total = n * n + edgeVerts;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const v = j * n + i;
      const lx = -HALF + i * step;
      const lz = -HALF + j * step;
      const h = H[(j + 1) * m + i + 1];
      pos[v * 3] = lx;
      pos[v * 3 + 1] = h;
      pos[v * 3 + 2] = lz;
      const dx = H[(j + 1) * m + i + 2] - H[(j + 1) * m + i];
      const dz = H[(j + 2) * m + i + 1] - H[j * m + i + 1];
      const nx = -dx;
      const ny = 2 * step;
      const nz = -dz;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nor[v * 3] = nx * inv;
      nor[v * 3 + 1] = ny * inv;
      nor[v * 3 + 2] = nz * inv;
      const wx = ox + lx;
      const wz = oz + lz;
      _w.copy(_low).lerp(_high, Math.max(0, Math.min(1, (h + 5) / 16)));
      if (tint) _w.lerp(tint, tintAmount);
      if (roadCheck && roadDistance(wx, wz) < 9) _w.lerp(ROAD_COLOR, 0.52);
      const ce = 0.9 + Math.sin(wx * 0.1) * 0.05;
      col[v * 3] = _w.r * ce;
      col[v * 3 + 1] = _w.g * ce;
      col[v * 3 + 2] = _w.b * ce;
    }
  }
  const index = [];
  for (let j = 0; j < segs; j += 1) {
    for (let i = 0; i < segs; i += 1) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  if (skirt) {
    const edges = [];
    const row = (list) => edges.push(list);
    const top = [];
    const right = [];
    const bottom = [];
    const left = [];
    for (let i = 0; i < n; i += 1) {
      top.push(i);
      bottom.push(segs * n + i);
      left.push(i * n);
      right.push(i * n + segs);
    }
    row(top);
    row(right);
    row(bottom);
    row(left);
    let next = n * n;
    for (const list of edges) {
      const lower = [];
      for (const v of list) {
        const o = next++;
        pos[o * 3] = pos[v * 3];
        pos[o * 3 + 1] = pos[v * 3 + 1] - 14;
        pos[o * 3 + 2] = pos[v * 3 + 2];
        nor[o * 3] = nor[v * 3];
        nor[o * 3 + 1] = nor[v * 3 + 1];
        nor[o * 3 + 2] = nor[v * 3 + 2];
        col[o * 3] = col[v * 3] * 0.7;
        col[o * 3 + 1] = col[v * 3 + 1] * 0.7;
        col[o * 3 + 2] = col[v * 3 + 2] * 0.7;
        lower.push(o);
      }
      for (let k = 0; k < list.length - 1; k += 1) {
        const A = list[k];
        const B = list[k + 1];
        const A2 = lower[k];
        const B2 = lower[k + 1];
        const ex = pos[B * 3] - pos[A * 3];
        const ez = pos[B * 3 + 2] - pos[A * 3 + 2];
        const mx = (pos[A * 3] + pos[B * 3]) / 2;
        const mz = (pos[A * 3 + 2] + pos[B * 3 + 2]) / 2;
        // (A, B, B2) faces (ez, 0, -ex); keep the skirt facing away from the cell centre.
        if (ez * mx - ex * mz > 0) index.push(A, B, B2, A, B2, A2);
        else index.push(A, B2, B, A, A2, B2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

function buildReedGeometry() {
  const parts = [];
  const r = rng(0x5eed1);
  for (let i = 0; i < 9; i += 1) {
    const h = 1.5 + r() * 1.5;
    const g = new THREE.ConeGeometry(0.06 + r() * 0.05, h, 4, 1);
    g.translate(0, h / 2, 0);
    g.rotateZ((r() - 0.5) * 0.4);
    g.rotateX((r() - 0.5) * 0.4);
    const a = r() * Math.PI * 2;
    const d = r() * 0.6;
    g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

/* ------------------------------------------------------------------ world */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _pos = new THREE.Vector3();
const _scl = new THREE.Vector3();
const _col = new THREE.Color();
const _off = new THREE.Vector3();

export class World {
  /**
   * @param {THREE.Scene} scene
   * @param {Set<string>} depleted  resource ids already harvested
   */
  constructor(scene, depleted) {
    this.scene = scene;
    this.depleted = depleted;
    this.root = new THREE.Group();
    this.root.name = 'STREAMED_WORLD';
    scene.add(this.root);
    this.chunks = new Map();
    this.nodes = new Map();
    this.queue = [];
    this.near = 1;
    this.far = 2;
    this.cx = null;
    this.cz = null;

    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.materials = {};
    const biomeLook = {
      'shard-flats': [0.74, 0.34],
      fracture: [0.79, 0.28],
      'sunken-array': [0.66, 0.46],
      'null-crater': [0.57, 0.53],
      'verdant-steppe': [0.91, 0.08],
      glasswood: [0.86, 0.12],
      'salt-marsh': [0.78, 0.16],
      'iron-highlands': [0.76, 0.32],
      'ember-waste': [0.82, 0.24],
      'frost-shelf': [0.64, 0.22],
    };
    for (const [id, [roughness, metalness]] of Object.entries(biomeLook)) this.materials[id] = std({ vertexColors: true, roughness, metalness });

    // Instance colours tint the crystals (the octahedron has no colour attribute of its own).
    this.crystalMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x143844,
      emissive: 0x159ac2,
      emissiveIntensity: 2.45,
      roughness: 0.18,
      metalness: 0.46,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      iridescence: 0.72,
      iridescenceIOR: 1.65,
    });
    this.crystalGeometry = new THREE.OctahedronGeometry(1, 0);
    this.rockGeometry = new THREE.DodecahedronGeometry(1, 0);
    this.treeGeometry = new THREE.ConeGeometry(1, 5.2, 6);
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.pickupGeometry = new THREE.OctahedronGeometry(0.55, 1);
    this.harvestRockGeometry = new THREE.DodecahedronGeometry(1.1, 1);
    this.trunkGeometry = new THREE.CylinderGeometry(0.34, 0.52, 4.4, 7);
    this.canopyGeometry = new THREE.DodecahedronGeometry(1.75, 1);
    this.reedGeometry = buildReedGeometry();
    this.rockMaterial = std({ color: 0x151821, roughness: 0.88, metalness: 0.24 });
    this.treeMaterial = std({ color: 0x183b31, roughness: 0.92, metalness: 0.03 });
    this.trunkMaterial = std({ color: 0x302821, roughness: 0.96 });
    this.canopyMaterial = std({ color: 0x1f604c, emissive: 0x09251e, emissiveIntensity: 0.7, roughness: 0.82 });
    this.pickupMaterial = std({ color: 0x81edff, emissive: 0x26bddd, emissiveIntensity: 4.5, roughness: 0.18, metalness: 0.35 });
    this.harvestRockMaterial = std({ color: 0x4f5660, emissive: 0x121820, emissiveIntensity: 0.7, roughness: 0.84, metalness: 0.22 });
    this.reedMaterial = std({ color: 0x8e9c5a, emissive: 0x223014, emissiveIntensity: 0.8, roughness: 0.9, metalness: 0.02 });
    this.monolithMaterial = std({ color: 0x111821, roughness: 0.54, metalness: 0.72 });
    this.waterMaterial = std({
      color: 0x173c4d,
      emissive: 0x08202c,
      emissiveIntensity: 0.9,
      roughness: 0.24,
      metalness: 0.34,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    });
    this.buildingMaterials = {
      megacity: std({ color: 0x17242b, emissive: 0x0b5d69, emissiveIntensity: 1.25, roughness: 0.44, metalness: 0.55 }),
      city: std({ color: 0x1b2428, emissive: 0x17424a, emissiveIntensity: 0.8, roughness: 0.54, metalness: 0.43 }),
      town: std({ color: 0x26272a, emissive: 0x24363b, emissiveIntensity: 0.38, roughness: 0.68, metalness: 0.3 }),
      village: std({ color: 0x2b2a27, emissive: 0x263336, emissiveIntensity: 0.24, roughness: 0.82, metalness: 0.16 }),
    };
  }

  /** Full-detail cells out to `near`, low-detail terrain out to `far` (rings of cells). */
  setRadius(near, far) {
    this.near = near;
    this.far = Math.max(near, far);
    this.cx = null;
  }

  /** Re-plan the cells around (px, pz). Returns true when the player changed cell. */
  update(px, pz) {
    const cx = chunkIndex(px);
    const cz = chunkIndex(pz);
    if (cx === this.cx && cz === this.cz) return false;
    this.cx = cx;
    this.cz = cz;
    const want = new Map();
    for (let dz = -this.far; dz <= this.far; dz += 1) {
      for (let dx = -this.far; dx <= this.far; dx += 1) {
        const ring = Math.max(Math.abs(dx), Math.abs(dz));
        want.set(keyOf(cx + dx, cz + dz), { cx: cx + dx, cz: cz + dz, full: ring <= this.near, d: dx * dx + dz * dz });
      }
    }
    for (const [key, rec] of this.chunks) {
      if (!want.has(key)) {
        this.drop(rec);
        this.chunks.delete(key);
      }
    }
    this.queue.length = 0;
    for (const [key, w] of want) {
      const rec = this.chunks.get(key);
      if (!rec || rec.full !== w.full) this.queue.push(w);
    }
    this.queue.sort((a, b) => a.d - b.d);
    return true;
  }

  /**
   * Build queued cells, nearest first, until the time budget is spent (at
   * least one per call). Returns how many full-detail cells were built.
   */
  pump(budgetMs = 4) {
    const t0 = performance.now();
    let fullBuilt = 0;
    while (this.queue.length) {
      const w = this.queue.shift();
      const key = keyOf(w.cx, w.cz);
      const cur = this.chunks.get(key);
      if (cur && cur.full === w.full) continue;
      const rec = this.build(w.cx, w.cz, w.full);
      if (cur) this.drop(cur);
      this.chunks.set(key, rec);
      this.root.add(rec.group);
      if (rec.full) fullBuilt += 1;
      if (performance.now() - t0 > budgetMs) break;
    }
    return fullBuilt;
  }

  /** Build everything queued right now (start, teleports). */
  flush() {
    return this.pump(Number.POSITIVE_INFINITY);
  }

  get pending() {
    return this.queue.length;
  }

  build(cx, cz, full) {
    const s = cx * CHUNK;
    const i = cz * CHUNK;
    const biome = biomeAt(s, i);
    const settle = settlementInfluence(s, i);
    const nearRoad = roadDistance(s, i) < CHUNK;
    const group = new THREE.Group();
    group.name = `CELL_${cx}_${cz}`;
    group.position.set(s, 0, i);
    const rec = { key: keyOf(cx, cz), cx, cz, full, group, geometries: [], objects: [], resourceIds: [], circles: [], boxes: [] };

    const colors = BIOME_COLORS[biome];
    _low.set(colors[0]);
    _high.set(colors[1]);
    if (settle) _tint.set(settle.settlement.color);
    const terrainGeo = buildTerrain(s, i, full ? 24 : 8, settle ? _tint : null, settle ? settle.influence * 0.13 : 0, nearRoad, !full);
    rec.geometries.push(terrainGeo);
    const terrain = new THREE.Mesh(terrainGeo, this.materials[biome]);
    terrain.receiveShadow = true;
    terrain.static = true;
    group.add(terrain);
    if (!full) return rec;

    const a = rng(hash2(cx, cz));

    // Hydrology ribbons along the rivers.
    if (riverDistance(s, i) < CHUNK * 1.2) {
      const verts = [];
      const K = CHUNK / 12;
      for (let te = 0; te < 12; te += 1) {
        for (let re = 0; re < 12; re += 1) {
          const x0 = -HALF + re * K;
          const z0 = -HALF + te * K;
          const x1 = x0 + K;
          const z1 = z0 + K;
          if (riverDistance(s + (x0 + x1) / 2, i + (z0 + z1) / 2) > 25) continue;
          const h00 = heightAt(s + x0, i + z0) + 0.2;
          const h10 = heightAt(s + x1, i + z0) + 0.2;
          const h01 = heightAt(s + x0, i + z1) + 0.2;
          const h11 = heightAt(s + x1, i + z1) + 0.2;
          verts.push(x0, h00, z0, x1, h10, z0, x1, h11, z1, x0, h00, z0, x1, h11, z1, x0, h01, z1);
        }
      }
      if (verts.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        const water = new THREE.Mesh(g, this.waterMaterial);
        water.name = 'HYDROLOGY_RIBBON';
        water.renderOrder = 2;
        water.static = true;
        rec.geometries.push(g);
        group.add(water);
      }
    }

    // Crystal field.
    const crystalCount = (WOODED.has(biome) ? 5 : 11) + Math.floor(a() * 10);
    const crystals = new THREE.InstancedMesh(this.crystalGeometry, this.crystalMaterial, crystalCount);
    crystals.name = 'CRYSTAL_FIELD';
    crystals.castShadow = true;
    crystals.receiveShadow = true;
    for (let k = 0; k < crystalCount; k += 1) {
      const x = (a() - 0.5) * CHUNK * 0.9;
      const z = (a() - 0.5) * CHUNK * 0.9;
      const h = 1.3 + a() ** 2 * 7.8;
      _pos.set(x, heightAt(s + x, i + z) + h * 0.72, z);
      _eul.set((a() - 0.5) * 0.12, a() * Math.PI, (a() - 0.5) * 0.2);
      _q.setFromEuler(_eul);
      _scl.set(0.52 + a() * 1.25, h, 0);
      _scl.z = 0.52 + a() * 1.25;
      _m4.compose(_pos, _q, _scl);
      crystals.setMatrixAt(k, _m4);
      crystals.setColorAt(k, _col.setHSL(0.49 + a() * 0.16, 0.82, 0.42 + a() * 0.24));
      rec.circles.push(s + x, i + z, Math.max(_scl.x, _scl.z) * 0.45);
    }
    crystals.instanceMatrix.needsUpdate = true;
    if (crystals.instanceColor) crystals.instanceColor.needsUpdate = true;
    crystals.computeBoundingSphere();
    crystals.static = true;
    rec.objects.push(crystals);
    group.add(crystals);

    // Loose rock.
    const rockCount = 15 + Math.floor(a() * 12);
    const rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, rockCount);
    for (let k = 0; k < rockCount; k += 1) {
      const x = (a() - 0.5) * CHUNK;
      const z = (a() - 0.5) * CHUNK;
      const r = 0.25 + a() * 1.65;
      _pos.set(x, heightAt(s + x, i + z) + r * 0.4, z);
      _eul.set(a() * Math.PI, a() * Math.PI, a() * Math.PI);
      _q.setFromEuler(_eul);
      _scl.x = r * (0.7 + a());
      _scl.y = r * (0.35 + a() * 0.5);
      _scl.z = r;
      _m4.compose(_pos, _q, _scl);
      rocks.setMatrixAt(k, _m4);
      if (r > 0.9) rec.circles.push(s + x, i + z, r * 0.7);
    }
    rocks.instanceMatrix.needsUpdate = true;
    rocks.computeBoundingSphere();
    rocks.static = true;
    rec.objects.push(rocks);
    group.add(rocks);

    // Glasswood stands.
    if (WOODED.has(biome)) {
      const treeCount = 12 + Math.floor(a() * 16);
      const trees = new THREE.InstancedMesh(this.treeGeometry, this.treeMaterial, treeCount);
      for (let k = 0; k < treeCount; k += 1) {
        const x = (a() - 0.5) * CHUNK;
        const z = (a() - 0.5) * CHUNK;
        const h = 4.8 + a() * 8.5;
        _pos.set(x, heightAt(s + x, i + z) + h * 0.48, z);
        _eul.set(0, a() * Math.PI, (a() - 0.5) * 0.08);
        _q.setFromEuler(_eul);
        _scl.x = 0.7 + a() * 0.8;
        _scl.y = h / 5.2;
        _scl.z = 0.7 + a() * 0.8;
        _m4.compose(_pos, _q, _scl);
        trees.setMatrixAt(k, _m4);
        rec.circles.push(s + x, i + z, Math.max(_scl.x, _scl.z) * 0.7);
      }
      trees.instanceMatrix.needsUpdate = true;
      trees.computeBoundingSphere();
      trees.static = true;
      rec.objects.push(trees);
      group.add(trees);
    }

    // Settlement blocks.
    if (settle) {
      const tier = settle.settlement.tier;
      const count = Math.max(2, Math.floor({ megacity: 74, city: 44, town: 22, village: 9 }[tier] * (0.32 + settle.influence * 0.68)));
      const blocks = new THREE.InstancedMesh(this.boxGeometry, this.buildingMaterials[tier], count);
      blocks.name = `SETTLEMENT_${settle.settlement.id.toUpperCase()}`;
      const wt = tier === 'megacity' ? 3.4 : tier === 'city' ? 2.2 : tier === 'town' ? 1.35 : 0.8;
      for (let k = 0; k < count; k += 1) {
        const x = (a() - 0.5) * CHUNK * 0.92;
        const z = (a() - 0.5) * CHUNK * 0.92;
        const w = (3.5 + a() * 7.5) * wt;
        const d = (3.5 + a() * 7.5) * wt;
        const h = (4 + a() ** 2 * 22) * wt;
        const turn = (Math.round(a() * 3) * Math.PI) / 2;
        _pos.set(x, heightAt(s + x, i + z) + h / 2, z);
        _eul.set(0, turn, 0);
        _q.setFromEuler(_eul);
        _scl.set(w, h, d);
        _m4.compose(_pos, _q, _scl);
        blocks.setMatrixAt(k, _m4);
        rec.boxes.push(s + x, i + z, w / 2, d / 2, Math.cos(turn), Math.sin(turn));
      }
      blocks.instanceMatrix.needsUpdate = true;
      blocks.computeBoundingSphere();
      blocks.static = true;
      rec.objects.push(blocks);
      group.add(blocks);
    }

    // A lone survey monolith now and then.
    if (a() > 0.72 && Math.hypot(s, i) > 70) {
      const w = 4 + a() * 5;
      const h = 13 + a() * 22;
      const x = (a() - 0.5) * 60;
      const z = (a() - 0.5) * 60;
      const mono = new THREE.Mesh(this.boxGeometry, this.monolithMaterial);
      mono.scale.set(w, h, 2.2);
      mono.position.set(x, heightAt(s + x, i + z) + h / 2, z);
      mono.rotation.y = a() * Math.PI;
      mono.rotation.z = (a() - 0.5) * 0.08;
      mono.castShadow = true;
      mono.receiveShadow = true;
      mono.static = true;
      group.add(mono);
      rec.boxes.push(s + x, i + z, w / 2, 1.1, Math.cos(mono.rotation.y), Math.sin(mono.rotation.y));
    }

    // Interactive resources (the original two per cell, same seeds and ids).
    const kinds = WOODED.has(biome) ? ['pickup', 'tree', 'tree'] : ['pickup', 'rock', 'rock'];
    for (let k = 0; k < 2; k += 1) {
      const kind = kinds[Math.floor(a() * kinds.length)];
      const x = (a() - 0.5) * CHUNK * 0.76;
      const z = (a() - 0.5) * CHUNK * 0.76;
      this.createNode(rec, cx, cz, kind, k, x, z);
    }
    if (cx === 0 && cz === 1) {
      this.createNode(rec, cx, cz, 'pickup', 90, 1, 35);
      this.createNode(rec, cx, cz, 'rock', 91, -4, 30);
      this.createNode(rec, cx, cz, 'tree', 92, 6, 22);
      this.createNode(rec, cx, cz, 'reed', 93, -12, 24);
    }

    // Fiber reeds and withered glasswood (their own seed, so the original layout is untouched).
    const b = rng(hash2(cx, cz, 0x0fb3e5));
    const wet = biome === 'salt-marsh' || biome === 'sunken-array' || WOODED.has(biome) || riverDistance(s, i) < 140;
    const reeds = wet ? 1 + Math.floor(b() * 2) : b() < 0.5 ? 1 : 0;
    for (let k = 0; k < reeds; k += 1) {
      const x = (b() - 0.5) * CHUNK * 0.8;
      const z = (b() - 0.5) * CHUNK * 0.8;
      this.createNode(rec, cx, cz, 'reed', 3 + k, x, z);
    }
    if (!WOODED.has(biome) && b() < 0.3) {
      const x = (b() - 0.5) * CHUNK * 0.7;
      const z = (b() - 0.5) * CHUNK * 0.7;
      this.createNode(rec, cx, cz, 'tree', 6, x, z);
    }
    return rec;
  }

  createNode(rec, cx, cz, kind, index, lx, lz) {
    const id = resourceId(cx, cz, kind, index);
    if (this.depleted.has(id) || this.nodes.has(id)) return;
    const wx = cx * CHUNK + lx;
    const wz = cz * CHUNK + lz;
    const h = heightAt(wx, wz);
    let object;
    if (kind === 'pickup') {
      object = new THREE.Mesh(this.pickupGeometry, this.pickupMaterial);
      object.position.set(lx, h + 0.85, lz);
      object.rotation.z = Math.PI / 4;
    } else if (kind === 'rock') {
      object = new THREE.Mesh(this.harvestRockGeometry, this.harvestRockMaterial);
      object.position.set(lx, h + 0.8, lz);
      object.scale.set(1.45, 0.92, 1.65);
      object.rotation.set(0.1, (hash2(cx + index, cz) / 4294967295) * Math.PI, -0.08);
    } else if (kind === 'reed') {
      object = new THREE.Mesh(this.reedGeometry, this.reedMaterial);
      object.position.set(lx, h - 0.05, lz);
      object.rotation.y = (hash2(cx + index, cz, 77) / 4294967295) * Math.PI * 2;
    } else {
      object = new THREE.Group();
      object.position.set(lx, h, lz);
      const trunk = new THREE.Mesh(this.trunkGeometry, this.trunkMaterial);
      trunk.position.y = 2.2;
      const canopy = new THREE.Mesh(this.canopyGeometry, this.canopyMaterial);
      canopy.position.y = 5.1;
      canopy.scale.set(1.05, 1.5, 1.05);
      object.add(trunk, canopy);
    }
    object.name = `RESOURCE_${kind.toUpperCase()}`;
    object.userData.resourceId = id;
    rec.group.add(object);
    const def = NODE_KINDS[kind];
    const lift = kind === 'tree' ? 2.8 : kind === 'reed' ? 1.1 : 0.9;
    this.nodes.set(id, {
      id,
      kind,
      item: def.item,
      hitPoints: def.hitPoints,
      maxHitPoints: def.hitPoints,
      yield: def.yield,
      object,
      pos: new THREE.Vector3(wx, h + lift, wz),
      base: [object.scale.x, object.scale.y, object.scale.z],
      baseY: object.position.y,
      phase: (hash2(cx * 7 + index, cz) / 4294967295) * Math.PI * 2,
    });
    rec.resourceIds.push(id);
  }

  /** The resource the probe is looking at, as the original picked it. */
  findTarget(origin, dir) {
    let best = null;
    let bestScore = -Infinity;
    for (const node of this.nodes.values()) {
      _off.copy(node.pos).sub(origin);
      const d = _off.length();
      const range = node.kind === 'pickup' ? 4.2 : 10.5;
      if (d > range || d < 0.05) continue;
      const align = _off.multiplyScalar(1 / d).dot(dir);
      if (align < (node.kind === 'pickup' ? 0.91 : 0.955)) continue;
      const score = align - d * 0.006;
      if (!best || score > bestScore) {
        best = node;
        bestScore = score;
      }
    }
    return best;
  }

  /** Nearest live resources to a point (deep scanner). */
  nearestNodes(x, z, count, maxDist) {
    const list = [];
    for (const node of this.nodes.values()) {
      const d = Math.hypot(node.pos.x - x, node.pos.z - z);
      if (d <= maxDist) list.push({ node, d });
    }
    list.sort((p, q) => p.d - q.d);
    return list.slice(0, count).map((e) => e.node);
  }

  /** One hit on a node. Returns what happened, or null if it is gone. */
  damage(id) {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (node.hitPoints <= 0) return null;
    node.hitPoints = Math.max(0, node.hitPoints - 1);
    const depleted = node.hitPoints === 0;
    if (depleted) {
      node.object.parent?.remove(node.object);
      this.nodes.delete(id);
      this.depleted.add(id);
    } else {
      const k = 1 + (1 - node.hitPoints / node.maxHitPoints) * 0.08;
      node.object.scale.set(node.base[0] * k, node.base[1] * k, node.base[2] * k);
    }
    return {
      depleted,
      item: node.item,
      kind: node.kind,
      progress: 1 - node.hitPoints / node.maxHitPoints,
      quantity: depleted ? node.yield : 0,
      pos: node.pos,
    };
  }

  /** Push a point out of props in the cells around it and out of standing nodes. */
  collide(p, radius) {
    const cx = chunkIndex(p.x);
    const cz = chunkIndex(p.z);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const rec = this.chunks.get(keyOf(cx + dx, cz + dz));
        if (!rec || !rec.full) continue;
        const c = rec.circles;
        for (let k = 0; k < c.length; k += 3) pushCircle(p, c[k], c[k + 1], c[k + 2] + radius);
        const b = rec.boxes;
        for (let k = 0; k < b.length; k += 6) pushBox(p, b[k], b[k + 1], b[k + 2], b[k + 3], b[k + 4], b[k + 5], radius);
      }
    }
    for (const node of this.nodes.values()) {
      if (node.kind === 'rock') pushCircle(p, node.pos.x, node.pos.z, 1.25 + radius);
      else if (node.kind === 'tree') pushCircle(p, node.pos.x, node.pos.z, 0.5 + radius);
    }
  }

  /** Loose shards turn and bob so they read as collectable. */
  animate(t) {
    for (const node of this.nodes.values()) {
      if (node.kind !== 'pickup') continue;
      node.object.rotation.y = t * 1.2 + node.phase;
      node.object.position.y = node.baseY + Math.sin(t * 2 + node.phase) * 0.12;
    }
  }

  drop(rec) {
    this.root.remove(rec.group);
    for (const id of rec.resourceIds) this.nodes.delete(id);
    for (const o of rec.objects) o.dispose();
    for (const g of rec.geometries) g.dispose();
  }

  /** Throw every cell away (new survey) and start again around the next update. */
  reset(depleted) {
    for (const rec of this.chunks.values()) this.drop(rec);
    this.chunks.clear();
    this.nodes.clear();
    this.queue.length = 0;
    this.depleted = depleted;
    this.cx = null;
    this.cz = null;
  }
}
