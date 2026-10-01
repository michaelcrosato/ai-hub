// worldgen.js — pure generation code. This exact module runs on the main thread
// and in the tile workers. Do not import three.js, DOM code or mutable globals here.
// Seed + world coordinate -> the same surface and object placement.

export function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text).length; i++) { h ^= String(text).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function hash2(x, z, seed = 1) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a + (b - a) * t;
export function smooth(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
function noise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return mix(mix(hash2(ix, iz, seed), hash2(ix + 1, iz, seed), u), mix(hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed), u), v) * 2 - 1;
}
function fbm(x, z, seed, octaves = 4) {
  let result = 0, amp = 0.5, sum = 0;
  for (let i = 0; i < octaves; i++) { result += noise2(x, z, seed + i * 1013) * amp; sum += amp; x = x * 2.03 + 17.1; z = z * 2.03 - 9.2; amp *= 0.49; }
  return result / sum;
}
const gauss = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2));

// Base colours per biome; snow, sand and canyon strata are mixed in by color().
const BIOME_COLORS = [
  [0.23, 0.36, 0.28], [0.48, 0.56, 0.26], [0.26, 0.40, 0.22], [0.44, 0.47, 0.46],
  [0.62, 0.36, 0.22], [0.28, 0.37, 0.21], [0.44, 0.49, 0.27],
];
const SNOW = [0.87, 0.90, 0.85];
const SAND = [0.68, 0.62, 0.40];

export class WorldGenerator {
  constructor(seed = 'WILDLANDS-01') { this.seed = hashString(seed); this.seedText = String(seed); }
  /** Centre line of the long river at a given z. */
  riverX(z) { return 170 + Math.sin(z / 920) * 330 + Math.sin(z / 350) * 75 + noise2(z / 1450, 6, this.seed + 61) * 170; }
  /** Centre line of the canyon channel at a given z. */
  canyonX(z) { return 4190 + Math.sin(z / 410) * 245 + Math.sin(z / 1300) * 350; }
  /** Continuous surface. Water is a shared elevation, not a water-flow simulation. */
  sample(x, z) {
    const s = this.seed;
    const broad = fbm(x / 3100, z / 3100, s, 3);
    const hills = fbm(x / 530, z / 530, s + 23, 4);
    const detail = noise2(x / 72, z / 72, s + 451);
    const moisture = fbm(x / 1700 + 9, z / 1700 - 17, s + 117, 3) * 0.5 + 0.5;
    const warm = fbm(x / 3400 - 22, z / 3400 + 8, s + 711, 3) * 0.5 + 0.5;
    let mountain = smooth(0.1, 0.64, fbm(x / 3800 - 6, z / 3800 - 9, s + 332, 3));
    mountain = Math.max(mountain, gauss(x, z, -500, -3450, 2400, 1150) * 0.95);
    let canyon = smooth(0.57, 0.84, warm) * (1 - smooth(0.30, 0.52, moisture));
    canyon = Math.max(canyon, gauss(x, z, 4100, -1000, 1750, 2000));
    let swamp = smooth(0.60, 0.83, moisture) * (1 - mountain);
    swamp = Math.max(swamp, gauss(x, z, -3100, -1850, 1400, 1100));
    const plains = gauss(x, z, 1850, 2400, 2200, 1550);
    const ridges = 1 - Math.abs(fbm(x / 610, z / 610, s + 443, 4));
    let h = 85 + broad * 120 + hills * 68 + detail * 2.8;
    h = mix(h, 61 + hills * 26, plains * 0.88);
    h += mountain * (180 + Math.pow(ridges, 2.7) * 1080);
    // Several distinct peaks create a strong silhouette instead of one rounded mound.
    h += gauss(x, z, -1700, -3200, 700, 690) * 580;
    h += gauss(x, z, -50, -4020, 730, 660) * 700;
    h += gauss(x, z, 1750, -3500, 710, 640) * 680;
    const riverDistance = Math.abs(x - this.riverX(z));
    const mainValley = 1 - smooth(60, 470, riverDistance);
    const riverCut = 1 - smooth(29, 76, riverDistance);
    // The river cuts a continuous channel. Floodplains blend gently into the banks.
    h = mix(h, 27 + hills * 13, mainValley * 0.9);
    h = mix(h, 7 + noise2(x / 105, z / 105, s + 19) * 2, riverCut);
    const lakeShape = Math.sqrt(((x + 100) / 790) ** 2 + ((z + 540) / 1020) ** 2);
    const lakeEdge = lakeShape + noise2(x / 240, z / 240, s + 412) * 0.075;
    const lakeCut = 1 - smooth(0.72, 1.15, lakeEdge);
    h = mix(h, -11 + lakeShape * 17, lakeCut);
    // Canyon plateau and a sinuous deep channel; blend into the surrounding country.
    const cd = Math.abs(x - this.canyonX(z));
    const cliff = smooth(78, 245, cd);
    let canyonH = 15 + cliff * (210 + hills * 50);
    canyonH += Math.sin(canyonH * 0.07) * 4 * cliff;
    h = mix(h, canyonH, canyon * 0.96);
    // Soft, broken wetland banks. Some patches remain above the common water level.
    const marshH = 19 + fbm(x / 150, z / 150, s + 791, 3) * 12;
    h = mix(h, marshH, smooth(0.35, 0.85, swamp) * 0.99);
    // A low ridge at the entry point gives an immediate open view over the lake.
    h += gauss(x, z, 240, 820, 460, 210) * 104 * (1 - lakeCut);
    const water = h < 18.2;
    let biome = 1;
    if (water) biome = 0;
    else if (h > 660 || (mountain > 0.5 && h > 420)) biome = 3;
    else if (canyon > 0.45) biome = 4;
    else if (swamp > 0.45) biome = 5;
    else if (plains > 0.45) biome = 1;
    else if (moisture > 0.47 || gauss(x, z, -1650, 0, 1250, 1300) > 0.42) biome = 2;
    else if (h > 205) biome = 6;
    return { height: h, biome, moisture, mountain, canyon, swamp, plains, riverDistance, water };
  }
  height(x, z) { return this.sample(x, z).height; }
  /** Height on the finest rendered triangle. Used for stable feet-to-ground contact. */
  groundHeight(x, z, step = 256 / 24) {
    const ax = Math.floor(x / step) * step, az = Math.floor(z / step) * step;
    const u = (x - ax) / step, v = (z - az) / step;
    const a = this.height(ax, az), b = this.height(ax + step, az), c = this.height(ax, az + step);
    if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
    const d = this.height(ax + step, az + step);
    return d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
  /** Linear RGB for a point. Writes into `out` (an array of 3) to avoid allocations. */
  color(x, z, sample = null, out = [0, 0, 0]) {
    const t = sample || this.sample(x, z), h = t.height;
    const n = noise2(x / 185, z / 185, this.seed + 98) * 0.065;
    const base = BIOME_COLORS[t.biome] || BIOME_COLORS[6];
    out[0] = base[0]; out[1] = base[1]; out[2] = base[2];
    if (h > 820) {
      const snow = smooth(820, 1070, h + noise2(x / 115, z / 115, this.seed + 551) * 80);
      for (let i = 0; i < 3; i++) out[i] = mix(out[i], SNOW[i], snow);
    }
    if (h > 18 && h < 28 && t.biome !== 5) {
      const bank = 1 - smooth(19, 28, h);
      for (let i = 0; i < 3; i++) out[i] = mix(out[i], SAND[i], bank * 0.9);
    }
    if (t.biome === 4) { const strata = 0.93 + Math.sin(h * 0.12) * 0.08; for (let i = 0; i < 3; i++) out[i] *= strata; }
    for (let i = 0; i < 3; i++) out[i] = clamp01(out[i] + n);
    return out;
  }
}

/**
 * How each kind of plant or stone is drawn from the object records: which
 * template shape, which base colour, the lift along its height and the scale.
 * Matches the old per-tile instanced batches exactly, in the same order.
 */
function propParts(size, rec) {
  const full = size <= 1024;
  const parts = [];
  if (full) {
    parts.push({ shape: 'trunk', color: 'bark', records: rec.pines, offset: 4.3, sx: 1, sy: 1, sz: 1, tint: 1 });
    parts.push({ shape: 'trunk', color: 'bark', records: rec.trees, offset: 4, sx: 1.15, sy: 1, sz: 1.15, tint: 1 });
  }
  parts.push({ shape: 'cone', color: 'pine', records: rec.pines, offset: 12, sx: 1, sy: 1, sz: 1, tint: 1 });
  if (size <= 512) parts.push({ shape: 'cone', color: 'pine', records: rec.pines, offset: 17.2, sx: 0.72, sy: 0.75, sz: 0.72, tint: 1.07 });
  parts.push({ shape: 'leaf', color: 'leaf', records: rec.trees, offset: 12, sx: 1.1, sy: 1, sz: 1.05, tint: 1 });
  if (full) {
    parts.push({ shape: 'trunk', color: 'bark', records: rec.dead, offset: 6, sx: 0.9, sy: 1.5, sz: 0.9, tint: 1 });
    parts.push({ shape: 'leaf', color: 'pine', records: rec.dead, offset: 16, sx: 0.7, sy: 0.48, sz: 0.7, tint: 0.88 });
    parts.push({ shape: 'rock', color: 'stone', records: rec.rocks, offset: 0.7, sx: 1.5, sy: 0.9, sz: 1.1, tint: 1 });
    parts.push({ shape: 'reed', color: 'reed', records: rec.reeds, offset: 1.5, sx: 1, sy: 1, sz: 1, tint: 1 });
  }
  return parts;
}

/** Flat face normals for a non-indexed triangle list (what computeVertexNormals gives). */
function faceNormals(P, N, from, to) {
  for (let i = from; i < to; i += 9) {
    const ax = P[i], ay = P[i + 1], az = P[i + 2];
    const ux = P[i + 3] - ax, uy = P[i + 4] - ay, uz = P[i + 5] - az;
    const wx = P[i + 6] - ax, wy = P[i + 7] - ay, wz = P[i + 8] - az;
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    N[i] = N[i + 3] = N[i + 6] = nx;
    N[i + 1] = N[i + 4] = N[i + 7] = ny;
    N[i + 2] = N[i + 5] = N[i + 8] = nz;
  }
}

/**
 * Build one tile: terrain with seam-covering skirts plus every tree, rock and reed
 * on it, baked into a single vertex-coloured triangle list (one draw call and one
 * shared shader per tile). `templates` holds the prop shapes as non-indexed
 * positions and the linear base colours; the main thread sends them once.
 * Transferable arrays only.
 */
export function generateTile(job, templates) {
  const gen = new WorldGenerator(job.seed), n = job.segments || 24, size = job.size, step = size / n;
  const stride = n + 1, pts = new Float32Array(stride * stride * 3), cols = new Float32Array(stride * stride * 3);
  const col = [0, 0, 0];
  let minH = Infinity;
  for (let iz = 0; iz <= n; iz++) for (let ix = 0; ix <= n; ix++) {
    const i = (iz * stride + ix) * 3, wx = job.x + ix * step, wz = job.z + iz * step, s = gen.sample(wx, wz);
    gen.color(wx, wz, s, col);
    pts[i] = ix * step; pts[i + 1] = s.height; pts[i + 2] = iz * step;
    cols[i] = col[0]; cols[i + 1] = col[1]; cols[i + 2] = col[2]; minH = Math.min(minH, s.height);
  }

  // Object records: x,y,z,scale,rotation,tint. Placement uses a world-space grid.
  // All detail levels use the same grid so plants do not move during an LOD change.
  const trees = [], pines = [], dead = [], rocks = [], reeds = [];
  const spacing = 34, lodThin = size >= 2048 ? 0.12 : size >= 1024 ? 0.45 : 1;
  if (job.vegetation) {
    for (let gz = Math.floor(job.z / spacing); gz <= Math.floor((job.z + size) / spacing); gz++) for (let gx = Math.floor(job.x / spacing); gx <= Math.floor((job.x + size) / spacing); gx++) {
      const rnd = hash2(gx, gz, gen.seed + 1), r2 = hash2(gx, gz, gen.seed + 2), r3 = hash2(gx, gz, gen.seed + 3);
      const wx = (gx + 0.15 + rnd * 0.7) * spacing, wz = (gz + 0.15 + r2 * 0.7) * spacing;
      if (wx < job.x || wx >= job.x + size || wz < job.z || wz >= job.z + size) continue;
      if (hash2(gx, gz, gen.seed + 55) > lodThin) continue;
      const t = gen.sample(wx, wz), h = t.height;
      const record = [wx - job.x, h - 0.3, wz - job.z, 0.65 + r2 * 0.85, r3 * Math.PI * 2, rnd];
      if (h < 18.5) { if (t.swamp > 0.45 && h > 15 && rnd < 0.2) reeds.push(...record); continue; }
      if (h > 1060) { if (rnd < 0.08) rocks.push(...record); continue; }
      const slope = Math.abs(gen.height(wx + 7, wz) - h) + Math.abs(gen.height(wx, wz + 7) - h);
      if (slope > 17) { if (rnd < 0.24) rocks.push(...record); continue; }
      // Keep the landing clear; retain a few framing trees to the sides.
      const spawnClear = Math.hypot(wx - 230, wz - 760) < 42;
      let chance = t.biome === 2 ? 0.78 : t.biome === 5 ? 0.43 : t.biome === 1 ? 0.12 : t.biome === 3 ? 0.16 : t.biome === 4 ? 0.015 : 0.27;
      chance *= job.density || 1;
      if (!spawnClear && rnd < chance && h > 24) {
        if (t.biome === 5) dead.push(...record);
        else if (t.biome === 3 || h > 330 || r3 > 0.26) pines.push(...record);
        else trees.push(...record);
      } else if (r3 < 0.09) rocks.push(...record);
      else if (t.biome === 5 && rnd < 0.7) reeds.push(...record);
    }
  }
  const rec = { trees: new Float32Array(trees), pines: new Float32Array(pines), dead: new Float32Array(dead), rocks: new Float32Array(rocks), reeds: new Float32Array(reeds) };

  const parts = templates ? propParts(size, rec) : [];
  const terrainVerts = n * n * 6 + n * 4 * 6;
  let total = terrainVerts;
  for (const part of parts) total += (part.records.length / 6) * (templates.shapes[part.shape].length / 3);
  const positions = new Float32Array(total * 3), colors = new Float32Array(total * 3), normals = new Float32Array(total * 3);

  const skirt = Math.max(18, size * 0.09);
  let p = 0;
  const push = (id, drop = 0, shade = 1) => {
    positions[p] = pts[id * 3]; positions[p + 1] = pts[id * 3 + 1] - drop; positions[p + 2] = pts[id * 3 + 2];
    colors[p] = cols[id * 3] * shade; colors[p + 1] = cols[id * 3 + 1] * shade; colors[p + 2] = cols[id * 3 + 2] * shade; p += 3;
  };
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const a = z * stride + x, b = a + 1, c = a + stride, d = c + 1;
    const shade = 0.97 + hash2(Math.floor((job.x + x * step) / step), Math.floor((job.z + z * step) / step), gen.seed + 881) * 0.06;
    // Counter-clockwise as viewed from above; the split matches groundHeight().
    push(a, 0, shade); push(c, 0, shade); push(b, 0, shade);
    push(b, 0, shade); push(c, 0, shade); push(d, 0, shade);
  }
  const edge = (a, b) => { push(a); push(b, skirt); push(b); push(a); push(a, skirt); push(b, skirt); };
  for (let i = 0; i < n; i++) { edge(i, i + 1); edge(n * stride + i + 1, n * stride + i); edge((i + 1) * stride, i * stride); edge(i * stride + n, (i + 1) * stride + n); }

  // Props: each record places a copy of a template (scale, turn about Y, lift, move),
  // tinted the way the old instance colours tinted the material colour.
  for (const part of parts) {
    const shape = templates.shapes[part.shape], base = templates.colors[part.color], list = part.records;
    for (let k = 0; k < list.length; k += 6) {
      const s = list[k + 3], cos = Math.cos(list[k + 4]), sin = Math.sin(list[k + 4]), t = list[k + 5];
      const ox = list[k], oy = list[k + 1] + part.offset * s, oz = list[k + 2];
      const sx = s * part.sx, sy = s * part.sy, sz = s * part.sz;
      const r = (0.82 + t * 0.3) * part.tint * base[0], g = (0.86 + t * 0.2) * part.tint * base[1], b = (0.78 + t * 0.24) * part.tint * base[2];
      for (let v = 0; v < shape.length; v += 3) {
        const x = shape[v] * sx, y = shape[v + 1] * sy, z = shape[v + 2] * sz;
        positions[p] = ox + cos * x + sin * z; positions[p + 1] = oy + y; positions[p + 2] = oz - sin * x + cos * z;
        colors[p] = r; colors[p + 1] = g; colors[p + 2] = b; p += 3;
      }
    }
  }
  faceNormals(positions, normals, 0, p);

  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < p; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const objects = (trees.length + pines.length + dead.length + rocks.length + reeds.length) / 6;
  return { id: job.id, x: job.x, z: job.z, size, minH, bounds: [x0, y0, z0, x1, y1, z1], objects, positions, normals, colors, ...rec };
}

/** The buffers a tile result can hand over without copying. */
export const TILE_BUFFERS = ['positions', 'normals', 'colors', 'trees', 'pines', 'dead', 'rocks', 'reeds'];
