// terrain.js — the shape of the world: seeds, noise, biomes, terrain tiles and props.
//
// Pure JavaScript with no three.js, so the terrain worker and the main thread
// run exactly the same code (the world is identical wherever a tile is built).

export const VERSION = '0.2.0';

export const CONFIG = Object.freeze({
  seed: 'WILDLANDS-1048',
  chunkSize: 768,
  waterLevel: 34,
  eyeHeight: 1.85,
  walkSpeed: 7.5,
  runSpeed: 19,
  flySpeed: 110,
  gravity: 23,
  jumpSpeed: 9,
  fixedStep: 1 / 60,
  maxSubsteps: 6,
  originStep: 768,
  maxCoordinate: 1e7,
  saveKey: 'wildlands.foundation.v1',
});

/** View distance presets. Pixel ratio and shadow-map size follow the kit's quality tier. */
export const VIEW = Object.freeze({
  performance: { label: 'Performance', distance: 6144, trees: 1700, shadowFar: 1100 },
  balanced: { label: 'Balanced', distance: 9216, trees: 2500, shadowFar: 2200 },
  high: { label: 'High', distance: 13824, trees: 3300, shadowFar: 3300 },
});

export const LOCATIONS = Object.freeze([
  { id: 'reach', name: 'The Green Reach', biome: 'Rolling hills', x: -580, z: 1150, yaw: -0.48, color: '#b9cf71' },
  { id: 'lake', name: 'Stillwater Lake', biome: 'Lake', x: 1450, z: 1020, yaw: 1.3, color: '#63c9c4' },
  { id: 'forest', name: 'Whispering Pines', biome: 'Forest', x: -2550, z: -1200, yaw: -0.8, color: '#598e69' },
  { id: 'alpine', name: 'Frostline Peaks', biome: 'Mountains', x: 1200, z: -5900, yaw: 0.2, color: '#e3edf1' },
  { id: 'canyon', name: 'Redstone Canyon', biome: 'Canyon', x: 5450, z: 2650, yaw: 1.25, color: '#d99a70' },
  { id: 'swamp', name: 'Mosswater Marsh', biome: 'Swamp', x: -2400, z: 4500, yaw: -0.6, color: '#97a877' },
  { id: 'plains', name: 'Golden Plains', biome: 'Plains', x: -5100, z: 1600, yaw: -0.75, color: '#d8ce82' },
  { id: 'desert', name: 'Sunfall Dunes', biome: 'Desert', x: 7000, z: 6100, yaw: 1.1, color: '#d9b08a' },
]);

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** FNV-1a over the seed text. */
export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable 0..1 value for an integer lattice point. */
export function hash2(x, z, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** A small seeded generator (mulberry32). */
export function seededRandom(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 1831565813) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise {
  constructor(seed) {
    this.seed = hashString(String(seed));
  }

  /** Smooth value noise in -1..1. */
  sample(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);
    const s = this.seed;
    return lerp(lerp(hash2(ix, iz, s), hash2(ix + 1, iz, s), u), lerp(hash2(ix, iz + 1, s), hash2(ix + 1, iz + 1, s), u), v) * 2 - 1;
  }

  fbm(x, z, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x, z) * amp;
      norm += amp;
      x = x * 2.03 + 31.7;
      z = z * 2.03 - 12.9;
      amp *= 0.5;
    }
    return sum / norm;
  }
}

/** 1 inside `inner` metres of a point, fading to 0 at `outer`. */
const falloff = (x, z, cx, cz, inner, outer) => 1 - smoothstep(inner, outer, Math.hypot(x - cx, z - cz));

export const BIOME_COLORS = Object.freeze({
  hills: [0.4, 0.55, 0.29],
  plains: [0.6, 0.63, 0.32],
  forest: [0.25, 0.43, 0.27],
  mountain: [0.47, 0.5, 0.45],
  snow: [0.83, 0.89, 0.89],
  canyon: [0.68, 0.37, 0.23],
  swamp: [0.34, 0.43, 0.24],
  desert: [0.76, 0.59, 0.37],
  sand: [0.65, 0.65, 0.43],
});

export class TerrainField {
  constructor(seed = CONFIG.seed) {
    this.seed = seed;
    this.noise = new Noise(seed);
  }

  riverX(z) {
    return 120 + Math.sin(z * 34e-5) * 1050 + Math.sin(z * 93e-5 + 0.5) * 220;
  }

  canyonX(z) {
    return 4400 + Math.sin(z * 29e-5) * 700 + Math.sin(z * 92e-5) * 150;
  }

  sample(x, z) {
    const n = this.noise;
    const broad = n.fbm(x * 4e-4, z * 4e-4, 3);
    const detail = n.fbm(x * 0.003, z * 0.003, 3);
    const forest = Math.max(falloff(x, z, -2550, -1200, 750, 2700), smoothstep(-0.08, 0.47, n.sample(x * 3e-4 + 45, z * 3e-4)));
    const plains = falloff(x, z, -5100, 1600, 1000, 2700);
    const swamp = falloff(x, z, -2400, 4500, 1050, 2250);
    const canyon = falloff(x, z, 4800, 2500, 1200, 3300);
    const desert = falloff(x, z, 7000, 6100, 1800, 3700);
    const mountain = Math.max(falloff(x, z, 1200, -5900, 450, 4300), smoothstep(0.28, 0.64, n.sample(x * 13e-5 + 150, z * 13e-5 - 200)));

    let h = 115 + broad * 105 + detail * 25 + Math.sin(x * 0.001 + z * 7e-4) * 17;
    h = lerp(h, 86 + broad * 38 + detail * 12, plains);
    const ridge = 1 - Math.abs(n.fbm(x * 74e-5 + 7, z * 74e-5, 4));
    h += mountain * (250 + Math.pow(ridge, 2.6) * 1550 + n.fbm(x * 0.0032, z * 0.0032, 3) * 105);

    const canyonDistance = Math.abs(x - this.canyonX(z));
    const terrace = Math.floor((330 + broad * 115) / 34) * 34;
    const canyonHeight = lerp(5 + detail * 4, terrace + detail * 17, smoothstep(110, 470, canyonDistance));
    h = lerp(h, canyonHeight, canyon);
    h = lerp(h, 145 + Math.sin(x * 0.0022 + n.sample(x * 8e-4, z * 8e-4) * 3) * 35 + broad * 52, desert);
    h = lerp(h, 35 + n.fbm(x * 0.008, z * 0.008, 3) * 13 + n.sample(x * 0.001, z * 0.001) * 5, swamp);

    const riverDistance = Math.abs(x - this.riverX(z));
    const riverWidth = 75 + (Math.sin(z * 43e-5) + 1) * 23;
    const river = 1 - smoothstep(riverWidth * 0.5, riverWidth * 3.5, riverDistance);
    h = lerp(h, 10 + detail * 3, river);

    const lake = Math.hypot((x - 720) / 870, (z - 620) / 1280) + n.sample(x * 0.0023, z * 0.0023) * 0.08;
    h = lerp(h, 7 + detail * 2, 1 - smoothstep(0.68, 1.15, lake));
    const tarn = Math.hypot((x + 6100) / 460, (z + 4700) / 730);
    h = lerp(h, 13, 1 - smoothstep(0.65, 1.15, tarn));

    let biome = 'hills';
    if (forest > 0.48) biome = 'forest';
    if (plains > 0.5) biome = 'plains';
    if (mountain > 0.35) biome = 'mountain';
    if (canyon > 0.48) biome = 'canyon';
    if (desert > 0.5) biome = 'desert';
    if (swamp > 0.5) biome = 'swamp';
    if (h > 1010 + detail * 140) biome = 'snow';
    return { height: h, biome, forest, detail, water: h < CONFIG.waterLevel, riverDistance };
  }

  height(x, z) {
    return this.sample(x, z).height;
  }

  /** The height of the rendered surface: the same two triangles per cell the tile mesh uses. */
  ground(x, z, step = CONFIG.chunkSize / 64) {
    const x0 = Math.floor(x / step) * step;
    const z0 = Math.floor(z / step) * step;
    const fx = (x - x0) / step;
    const fz = (z - z0) / step;
    const h00 = this.height(x0, z0);
    const h10 = this.height(x0 + step, z0);
    const h01 = this.height(x0, z0 + step);
    if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
    const h11 = this.height(x0 + step, z0 + step);
    return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  }

  /** Ground colour (sRGB 0..1) for a sample; steep ground fades toward bare rock. */
  color(s, slope = 0) {
    let base = BIOME_COLORS[s.biome];
    if (s.height < CONFIG.waterLevel + 6 && s.biome !== 'swamp' && s.biome !== 'canyon') base = BIOME_COLORS.sand;
    const rock = smoothstep(0.53, 1.45, slope) * (s.biome === 'snow' ? 0.25 : 0.52);
    const shade = 0.91 + s.detail * 0.14;
    const out = [0, 0, 0];
    for (let i = 0; i < 3; i++) out[i] = clamp(lerp(base[i], BIOME_COLORS.mountain[i], rock) * shade, 0, 1);
    return out;
  }
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/**
 * One terrain tile: flat-shaded triangles with per-face colours (linear), face
 * normals, skirts that hide cracks between tiles of different detail, the
 * tile's height range and (near the player) its props.
 */
export function buildChunk(field, cx, cz, segments, withProps = false) {
  const size = CONFIG.chunkSize;
  const step = size / segments;
  const row = segments + 1;
  const heights = new Float64Array(row * row);
  const samples = new Array(row * row);
  for (let r = 0; r <= segments; r++) {
    for (let c = 0; c <= segments; c++) {
      const i = r * row + c;
      const s = field.sample(cx * size + c * step, cz * size + r * step);
      samples[i] = s;
      heights[i] = s.height;
    }
  }

  const vertexCount = segments * segments * 6 + segments * 4 * 6;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  let f = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  const push = (x, y, z, col) => {
    positions[f] = x;
    colors[f++] = toLinear(col[0]);
    positions[f] = y;
    colors[f++] = toLinear(col[1]);
    positions[f] = z;
    colors[f++] = toLinear(col[2]);
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const tri = (a, b, c) => {
    const slope = (Math.max(heights[a], heights[b], heights[c]) - Math.min(heights[a], heights[b], heights[c])) / step;
    const col = field.color(samples[a], slope);
    push((a % row) * step, heights[a], Math.floor(a / row) * step, col);
    push((b % row) * step, heights[b], Math.floor(b / row) * step, col);
    push((c % row) * step, heights[c], Math.floor(c / row) * step, col);
  };
  for (let r = 0; r < segments; r++) {
    for (let c = 0; c < segments; c++) {
      const i = r * row + c;
      const right = i + 1;
      const below = i + row;
      const diag = below + 1;
      tri(i, below, right);
      tri(right, below, diag);
    }
  }
  const skirtDepth = Math.max(110, step * 5);
  const skirt = (a, b) => {
    const ax = (a % row) * step;
    const az = Math.floor(a / row) * step;
    const bx = (b % row) * step;
    const bz = Math.floor(b / row) * step;
    const ha = heights[a];
    const hb = heights[b];
    const col = field.color(samples[a], 0.3).map((v) => v * 0.92);
    push(ax, ha, az, col);
    push(ax, ha - skirtDepth, az, col);
    push(bx, hb, bz, col);
    push(bx, hb, bz, col);
    push(ax, ha - skirtDepth, az, col);
    push(bx, hb - skirtDepth, bz, col);
  };
  for (let i = 0; i < segments; i++) {
    skirt(i + 1, i);
    skirt(segments * row + i, segments * row + i + 1);
    skirt(i * row, (i + 1) * row);
    skirt((i + 1) * row + segments, i * row + segments);
  }

  // Face normals (what computeVertexNormals gives a non-indexed mesh), built here so
  // the main thread only uploads the tile.
  const normals = new Float32Array(vertexCount * 3);
  for (let i = 0; i < positions.length; i += 9) {
    const ux = positions[i + 3] - positions[i];
    const uy = positions[i + 4] - positions[i + 1];
    const uz = positions[i + 5] - positions[i + 2];
    const vx = positions[i + 6] - positions[i];
    const vy = positions[i + 7] - positions[i + 1];
    const vz = positions[i + 8] - positions[i + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 9; k += 3) {
      normals[i + k] = nx;
      normals[i + k + 1] = ny;
      normals[i + k + 2] = nz;
    }
  }

  return {
    positions,
    colors,
    normals,
    minY: Number.isFinite(minY) ? minY : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0,
    props: withProps ? placeProps(field, cx, cz, step) : [],
    cx,
    cz,
    segments,
  };
}

/** Trees, rocks, reeds, grass and cacti for one tile, one chance per 32 m cell. */
export function placeProps(field, cx, cz, step = CONFIG.chunkSize / 64) {
  const size = CONFIG.chunkSize;
  const cell = 32;
  const cells = size / cell;
  const out = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const gx = (cx * size) / cell + c;
      const gz = (cz * size) / cell + r;
      const rnd = seededRandom(Math.floor(hash2(gx, gz, field.noise.seed) * 4294967295));
      const x = cx * size + (c + 0.15 + rnd() * 0.7) * cell;
      const z = cz * size + (r + 0.15 + rnd() * 0.7) * cell;
      const s = field.sample(x, z);
      const roll = rnd();
      const slope = Math.abs(field.height(x + 9, z) - field.height(x - 9, z)) / 18;
      let kind = null;
      if (s.water) {
        if (s.biome === 'swamp' && s.height > 24 && roll < 0.13) kind = 'reed';
      } else if (s.height > CONFIG.waterLevel + 3 && slope < 0.95) {
        const density =
          s.biome === 'forest' ? 0.68 : s.biome === 'hills' ? 0.16 : s.biome === 'mountain' ? 0.13 : s.biome === 'swamp' ? 0.28 : 0.015;
        if (s.biome !== 'snow' && s.biome !== 'desert' && s.biome !== 'canyon' && roll < density) {
          kind = s.biome === 'swamp' ? 'willow' : s.biome === 'hills' && rnd() < 0.35 ? 'oak' : 'pine';
        } else if (roll > 0.93) kind = 'rock';
        else if (s.biome === 'plains' && roll < 0.15) kind = 'grass';
        else if (s.biome === 'desert' && roll < 0.035) kind = 'cactus';
      }
      if (!kind) continue;
      const scale = kind === 'rock' ? 2 + rnd() * 6 : 0.72 + rnd() * 0.7;
      const y = kind === 'reed' ? CONFIG.waterLevel - 0.3 : field.ground(x, z, step) - 0.25;
      out.push({ kind, x: x - cx * size, z: z - cz * size, y, scale, rotation: rnd() * Math.PI * 2, tint: rnd() });
    }
  }
  return out;
}
