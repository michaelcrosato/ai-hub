/**
 * terrain.js — the procedural frontier: hashing, value noise, biomes, the
 * height field and the flat-shaded chunk meshes.
 *
 * Plain JavaScript with no three.js import, so the terrain worker and the page
 * share one copy of the rules and generate identical land. Mesh builders return
 * typed arrays (positions, flat normals, linear vertex colours) that the page
 * turns into BufferGeometry.
 */

export const CHUNK_SIZE = 64;
export const ATLAS_HALF_EXTENT = 48000;
export const DEFAULT_SEED = 5312912;
const INV_U32 = 1 / 4294967296;

/* ------------------------------------------------------------------ hashing */

export function mix32(value) {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  h = Math.imul(h, 2221713035);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash2(x, z, seed = 0) {
  const ix = Math.floor(x) | 0;
  const iz = Math.floor(z) | 0;
  return mix32((seed >>> 0) ^ Math.imul(ix, 521288629) ^ Math.imul(iz, 1597334677) ^ Math.imul(ix ^ iz, 747796405));
}

export function random2(x, z, seed = 0) {
  return hash2(x, z, seed) * INV_U32;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth value noise in -1..1. */
export function valueNoise(x, z, seed = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const a = random2(x0, z0, seed);
  const b = random2(x0 + 1, z0, seed);
  const c = random2(x0, z0 + 1, seed);
  const d = random2(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), tz) * 2 - 1;
}

/** Fractal sum of value noise, normalised to -1..1. */
export function fbm(x, z, seed = 0, opts = {}) {
  const octaves = Math.max(1, Math.min(8, Math.floor(opts.octaves ?? 5)));
  const lacunarity = Math.max(1.01, opts.lacunarity ?? 2);
  const persistence = Math.max(0, Math.min(1, opts.persistence ?? 0.5));
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    const octaveSeed = mix32((seed >>> 0) + Math.imul(i, 2654435769));
    sum += valueNoise(x * frequency, z * frequency, octaveSeed) * amplitude;
    norm += amplitude;
    frequency *= lacunarity;
    amplitude *= persistence;
  }
  return norm > 0 ? sum / norm : 0;
}

export function ridged(x, z, seed = 0, opts = {}) {
  const r = 1 - Math.abs(fbm(x, z, seed, opts));
  return r * r;
}

/** Deterministic small PRNG for per-chunk prop placement. */
export class Rng {
  constructor(seed) {
    this.state = mix32(seed >>> 0) || 1831565813;
  }
  next() {
    this.state = (this.state + 1831565813) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) * INV_U32;
  }
  range(min, max) {
    return min + (max - min) * this.next();
  }
}

/* ------------------------------------------------------------------- biomes */

export const BIOMES = {
  riverlands: { id: 'riverlands', name: 'Greywater Riverlands', region: 'Greywater Basin', primaryResource: 'fiber', low: [0.14, 0.27, 0.2, 1], high: [0.29, 0.42, 0.25, 1] },
  pine_forest: { id: 'pine_forest', name: 'Sable Pine Forest', region: 'Sablewood', primaryResource: 'wood', low: [0.09, 0.2, 0.16, 1], high: [0.2, 0.34, 0.2, 1] },
  crown_highlands: { id: 'crown_highlands', name: 'Crown Highlands', region: 'Crown Highlands', primaryResource: 'ore', low: [0.27, 0.29, 0.28, 1], high: [0.48, 0.5, 0.49, 1] },
  warden_steppe: { id: 'warden_steppe', name: 'Warden Steppe', region: 'Warden Steppe', primaryResource: 'fiber', low: [0.33, 0.3, 0.19, 1], high: [0.55, 0.47, 0.28, 1] },
  glass_badlands: { id: 'glass_badlands', name: 'Glass Barrens', region: 'Glass Barrens', primaryResource: 'stone', low: [0.37, 0.19, 0.13, 1], high: [0.65, 0.37, 0.21, 1] },
  salt_coast: { id: 'salt_coast', name: 'Salt Coast', region: 'The Salt Reach', primaryResource: 'relic', low: [0.39, 0.4, 0.35, 1], high: [0.68, 0.65, 0.5, 1] },
  grey_meadow: { id: 'grey_meadow', name: 'Grey Meadow', region: 'Red Basin Marches', primaryResource: 'fiber', low: [0.23, 0.3, 0.18, 1], high: [0.48, 0.45, 0.26, 1] },
};

export function biomeAt(x, z, seed = DEFAULT_SEED) {
  const nx = x / ATLAS_HALF_EXTENT;
  const nz = z / ATLAS_HALF_EXTENT;
  const moisture = Math.max(0, Math.min(1, 0.5 - nx * 0.24 + valueNoise(x / 5200, z / 5200, seed + 19) * 0.28));
  const temperature = Math.max(0, Math.min(1, 0.55 + nz * 0.22 + valueNoise(x / 7200, z / 7200, seed + 41) * 0.16));
  const riverX = 2800 + Math.sin(z / 5900) * 3700;
  const riverDistance = Math.abs(x - riverX);
  let id = 'grey_meadow';
  if (z > 39000) id = 'salt_coast';
  else if (riverDistance < 2200) id = 'riverlands';
  else if (z < -31000) id = 'crown_highlands';
  else if (x > 25000 && moisture < 0.48) id = 'glass_badlands';
  else if (moisture > 0.62 && temperature < 0.7) id = 'pine_forest';
  else if (x < -19000 && moisture < 0.53) id = 'warden_steppe';
  return { biome: BIOMES[id], moisture, temperature };
}

/* ------------------------------------------------------------- height field */

const SEA_FLOOR = [0.055, 0.12, 0.13, 1];
const SHALLOWS = [0.38, 0.39, 0.29, 1];
const SAND = [0.64, 0.58, 0.39, 1];
const CLIFF = [0.34, 0.35, 0.34, 1];
const SNOW = [0.78, 0.82, 0.8, 1];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
function smoothstep(edge0, edge1, value) {
  const s = clamp01((value - edge0) / (edge1 - edge0));
  return s * s * (3 - 2 * s);
}
function mixColor(a, b, t) {
  const s = clamp01(t);
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
}

export class TerrainField {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 1374772829) >>> 0;
    this.seaLevel = opts.seaLevel ?? 2;
    this.heightScale = Math.max(0.01, opts.heightScale ?? 1);
  }

  heightAt(x, z) {
    const continent = fbm(x / 540, z / 540, this.seed + 11, { octaves: 5, persistence: 0.54 });
    const mountainMask = smoothstep(-0.2, 0.38, continent);
    const hills = fbm(x / 145, z / 145, this.seed + 97, { octaves: 5, persistence: 0.5 });
    const ridges = ridged(x / 270, z / 270, this.seed + 193, { octaves: 4, persistence: 0.56 });
    const detail = fbm(x / 52, z / 52, this.seed + 389, { octaves: 3, persistence: 0.43 });
    const base = this.seaLevel - 3 + continent * 17;
    const basinRise = (1 - smoothstep(105, 260, Math.hypot(x, z))) * 17;
    const relief = hills * 7 + ridges ** 1.55 * mountainMask * 31 + detail * 2.8 + basinRise;
    return this.seaLevel + (base + relief - this.seaLevel) * this.heightScale;
  }

  normalAt(x, z, step = 1) {
    const s = Math.max(0.05, step);
    const dx = this.heightAt(x - s, z) - this.heightAt(x + s, z);
    const dz = this.heightAt(x, z - s) - this.heightAt(x, z + s);
    const inv = 1 / Math.hypot(dx, s * 2, dz);
    return [dx * inv, s * 2 * inv, dz * inv];
  }

  slopeAt(x, z, step = 2) {
    const n = this.normalAt(x, z, step);
    return Math.hypot(n[0], n[2]) / Math.max(0.001, n[1]);
  }

  /** sRGB colour (0..1, alpha last) for a point on the ground. */
  colorAt(x, y, z) {
    const above = y - this.seaLevel;
    const slope = this.slopeAt(x, z, 2.5);
    let color;
    if (above < -1.5) color = mixColor(SEA_FLOOR, SHALLOWS, smoothstep(-7, -1.5, above));
    else if (above < 2.2) color = mixColor(SHALLOWS, SAND, smoothstep(-1.5, 2.2, above));
    else {
      const altitude = smoothstep(7, 28, above);
      const biome = biomeAt(x, z, this.seed).biome;
      color = mixColor(biome.low, biome.high, altitude);
      const rock = Math.max(smoothstep(0.62, 1.25, slope), smoothstep(22, 42, above));
      color = mixColor(color, CLIFF, rock);
      color = mixColor(color, SNOW, smoothstep(43, 56, above));
    }
    const grain = valueNoise(x / 28, z / 28, this.seed + 701) * 0.055;
    return [clamp01(color[0] + grain), clamp01(color[1] + grain), clamp01(color[2] + grain * 0.7), color[3]];
  }
}

/* ------------------------------------------------------------ mesh building */

export function srgbToLinear(c) {
  const v = clamp01(c);
  return v <= 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4);
}

/** Non-indexed triangles with flat normals and optional linear vertex colours. */
export class FlatMeshBuilder {
  constructor(withColors) {
    this.positions = [];
    this.normals = [];
    this.colors = withColors ? [] : null;
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  addTriangle(a, b, c, color) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const inv = 1 / Math.max(1e-8, Math.hypot(nx, ny, nz));
    nx *= inv;
    ny *= inv;
    nz *= inv;
    this.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    if (this.colors) {
      const src = color ?? [1, 1, 1, 1];
      const r = srgbToLinear(src[0]);
      const g = srgbToLinear(src[1]);
      const bl = srgbToLinear(src[2]);
      this.colors.push(r, g, bl, r, g, bl, r, g, bl);
    }
  }

  build() {
    if (this.vertexCount === 0) return null;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      colors: this.colors ? new Float32Array(this.colors) : null,
    };
  }
}

function addShadedTriangle(builder, field, originX, originZ, a, b, c) {
  const cx = (a[0] + b[0] + c[0]) / 3;
  const cy = (a[1] + b[1] + c[1]) / 3;
  const cz = (a[2] + b[2] + c[2]) / 3;
  builder.addTriangle(a, b, c, field.colorAt(originX + cx, cy, originZ + cz));
}

/**
 * One 64 m chunk of ground: cells x cells quads split along an alternating
 * diagonal, coloured per triangle. Positions are local to the chunk corner.
 */
export function buildChunkTerrain(field, chunkX, chunkZ, cells = 16) {
  const n = Math.max(2, Math.min(64, Math.floor(cells)));
  const step = CHUNK_SIZE / n;
  const originX = chunkX * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;
  const stride = n + 1;
  const heights = new Float64Array(stride * stride);
  for (let row = 0; row <= n; row += 1) {
    for (let col = 0; col <= n; col += 1) heights[row * stride + col] = field.heightAt(originX + col * step, originZ + row * step);
  }
  const vertex = (col, row) => [col * step, heights[row * stride + col], row * step];
  const builder = new FlatMeshBuilder(true);
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const a = vertex(col, row);
      const b = vertex(col + 1, row);
      const c = vertex(col, row + 1);
      const d = vertex(col + 1, row + 1);
      if ((chunkX * n + col + chunkZ * n + row) & 1) {
        addShadedTriangle(builder, field, originX, originZ, a, c, d);
        addShadedTriangle(builder, field, originX, originZ, a, d, b);
      } else {
        addShadedTriangle(builder, field, originX, originZ, a, c, b);
        addShadedTriangle(builder, field, originX, originZ, b, c, d);
      }
    }
  }
  return builder.build();
}

function squareRingPoint(field, centerX, centerZ, half, index, count) {
  const perSide = count / 4;
  const side = Math.floor(index / perSide);
  const t = (index % perSide) / perSide;
  let x;
  let z;
  if (side === 0) {
    x = half;
    z = -half + t * half * 2;
  } else if (side === 1) {
    x = half - t * half * 2;
    z = half;
  } else if (side === 2) {
    x = -half;
    z = half - t * half * 2;
  } else {
    x = -half + t * half * 2;
    z = -half;
  }
  return [x, field.heightAt(centerX + x, centerZ + z), z];
}

/**
 * The horizon: square rings growing geometrically from the edge of the
 * detailed chunk window out to `outer` metres. Positions are local to the centre.
 */
export function buildDistantTerrain(field, centerX, centerZ, inner, outer, rings = 6, segments = 256) {
  if (![centerX, centerZ, inner, outer].every(Number.isFinite)) throw new RangeError('Distant terrain coordinates and extents must be finite.');
  if (inner < 64 || outer <= inner) throw new RangeError('Distant terrain must extend beyond a positive detailed terrain window.');
  const ringCount = Math.max(2, Math.min(12, Math.floor(rings)));
  const segmentCount = Math.max(32, Math.min(512, Math.floor(segments / 4) * 4));
  const ratio = outer / inner;
  const ringPoints = [];
  for (let r = 0; r <= ringCount; r += 1) {
    const half = inner * ratio ** (r / ringCount);
    const points = new Array(segmentCount);
    for (let s = 0; s < segmentCount; s += 1) points[s] = squareRingPoint(field, centerX, centerZ, half, s, segmentCount);
    ringPoints.push(points);
  }
  const builder = new FlatMeshBuilder(true);
  for (let r = 0; r < ringCount; r += 1) {
    const innerRing = ringPoints[r];
    const outerRing = ringPoints[r + 1];
    for (let s = 0; s < segmentCount; s += 1) {
      const next = (s + 1) % segmentCount;
      const a = innerRing[s];
      const b = innerRing[next];
      const c = outerRing[s];
      const d = outerRing[next];
      if ((r + s) & 1) {
        addShadedTriangle(builder, field, centerX, centerZ, a, b, d);
        addShadedTriangle(builder, field, centerX, centerZ, a, d, c);
      } else {
        addShadedTriangle(builder, field, centerX, centerZ, a, b, c);
        addShadedTriangle(builder, field, centerX, centerZ, b, d, c);
      }
    }
  }
  const mesh = builder.build();
  if (!mesh) throw new Error('Distant terrain generation produced an empty mesh.');
  return mesh;
}

function addRock(builder, rng, x, groundY, z, radius, height, angle) {
  const rim = [];
  const rimY = groundY + height * rng.range(0.28, 0.45);
  for (let i = 0; i < 6; i += 1) {
    const a = angle + (i / 6) * Math.PI * 2;
    const r = radius * rng.range(0.72, 1.18);
    rim.push([x + Math.cos(a) * r, rimY + rng.range(-0.12, 0.12) * height, z + Math.sin(a) * r]);
  }
  const peak = [x + Math.cos(angle + 1.3) * radius * 0.16, groundY + height, z + Math.sin(angle + 1.3) * radius * 0.16];
  const base = [x, groundY - 0.08, z];
  for (let i = 0; i < 6; i += 1) {
    const a = rim[i];
    const b = rim[(i + 1) % 6];
    builder.addTriangle(peak, b, a);
    builder.addTriangle(base, a, b);
  }
}

function addCone(builder, x, baseY, z, radius, apexY, angle) {
  const apex = [x, apexY, z];
  for (let i = 0; i < 5; i += 1) {
    const a0 = angle + (i / 5) * Math.PI * 2;
    const a1 = angle + ((i + 1) / 5) * Math.PI * 2;
    const p0 = [x + Math.cos(a0) * radius, baseY, z + Math.sin(a0) * radius];
    const p1 = [x + Math.cos(a1) * radius, baseY, z + Math.sin(a1) * radius];
    builder.addTriangle(apex, p1, p0);
  }
}

function addPine(builder, x, groundY, z, radius, height, angle) {
  addCone(builder, x, groundY + height * 0.08, z, radius, groundY + height * 0.72, angle);
  addCone(builder, x, groundY + height * 0.34, z, radius * 0.7, groundY + height, angle + 0.28);
}

/** Rocks and low conifers scattered deterministically over one chunk (local coordinates). */
export function buildChunkProps(field, chunkX, chunkZ) {
  const originX = chunkX * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;
  const rng = new Rng(hash2(chunkX, chunkZ, field.seed ^ 2738958700));
  const rocks = new FlatMeshBuilder(false);
  const foliage = new FlatMeshBuilder(false);
  for (let i = 0; i < 11; i += 1) {
    const lx = rng.range(2, 62);
    const lz = rng.range(2, 62);
    const wx = originX + lx;
    const wz = originZ + lz;
    const ground = field.heightAt(wx, wz);
    const slope = field.slopeAt(wx, wz, 2);
    const radius = rng.range(0.65, 1.8);
    const height = radius * rng.range(0.7, 1.65);
    const angle = rng.range(0, Math.PI * 2);
    if (ground > field.seaLevel - 0.7 && slope < 1.75) addRock(rocks, rng, lx, ground, lz, radius, height, angle);
  }
  for (let i = 0; i < 23; i += 1) {
    const lx = rng.range(2.5, 61.5);
    const lz = rng.range(2.5, 61.5);
    const wx = originX + lx;
    const wz = originZ + lz;
    const ground = field.heightAt(wx, wz);
    const above = ground - field.seaLevel;
    const slope = field.slopeAt(wx, wz, 2.5);
    const radius = rng.range(0.75, 1.6);
    const height = rng.range(2.2, 5.8);
    const angle = rng.range(0, Math.PI * 2);
    if (above > 2.5 && above < 34 && slope < 0.72) addPine(foliage, lx, ground, lz, radius, height, angle);
  }
  return { rocks: rocks.build(), foliage: foliage.build() };
}
