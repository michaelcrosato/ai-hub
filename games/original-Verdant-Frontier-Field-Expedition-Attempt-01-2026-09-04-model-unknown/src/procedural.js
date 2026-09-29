// Pure deterministic terrain kernel. This same function runs on the main thread
// and in the terrain worker. Keep it free of imports and external state.
export function createTerrainKernel(seed = 73041) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (x, z, s = 0) => {
    let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul((seed + s) | 0, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, z, s = 0) => {
    const ix = Math.floor(x), iz = Math.floor(z), tx = x - ix, tz = z - iz;
    const u = tx * tx * (3 - 2 * tx), v = tz * tz * (3 - 2 * tz);
    return mix(mix(hash(ix, iz, s), hash(ix + 1, iz, s), u), mix(hash(ix, iz + 1, s), hash(ix + 1, iz + 1, s), u), v);
  };
  const fbm = (x, z, octaves = 4, salt = 0) => {
    let value = 0, amplitude = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) { value += noise(x, z, i * 71 + salt) * amplitude; norm += amplitude; amplitude *= 0.5; x = x * 2.03 + 17.2; z = z * 2.03 - 11.7; }
    return value / norm;
  };
  const riverX = z => 130 + Math.sin(z * 0.00072) * 580 + Math.sin(z * 0.0021 + 1.3) * 125;
  const features = (x, z) => {
    const lake = Math.hypot((x - 250) / 530, (z + 510) / 700);
    const river = Math.abs(x - riverX(z));
    const swamp = Math.exp(-((x + 2500) ** 2 + (z - 2350) ** 2) / 1800000);
    const canyon = Math.exp(-((x - 3600) ** 2 + (z - 600) ** 2) / 5300000);
    const canyonLine = Math.abs(x - (3300 + Math.sin(z * 0.0012) * 400));
    return { lake, river, swamp, canyon, canyonLine };
  };
  const height = (x, z) => {
    const f = features(x, z);
    const broad = fbm(x * 0.0005, z * 0.0005, 4);
    const hills = fbm(x * 0.0022, z * 0.0022, 4, 90);
    let h = 50 + broad * 95 + (hills - 0.5) * 78;
    const north = smooth(900, 3600, -z) * (0.45 + 0.55 * noise(x * 0.00035, z * 0.0004, 93));
    const ridge = 1 - Math.abs(fbm(x * 0.00085, z * 0.00085, 4, 812) * 2 - 1);
    h += north * (190 + ridge ** 3 * 1050 + (hills - 0.5) * 300);
    h += Math.exp(-((x - 1500) ** 2 + (z + 3500) ** 2) / 2300000) * (310 + ridge * 410);
    h += f.canyon * (95 + Math.floor(hills * 7) * 12);
    const cut = (1 - smooth(80, 290, f.canyonLine)) * f.canyon;
    h = mix(h, 34 + hills * 18, cut);
    h = mix(h, 23 + (hills - 0.47) * 22, smooth(0.15, 0.78, f.swamp));
    const lakeCut = 1 - smooth(0.72, 1.25, f.lake + (noise(x * 0.004, z * 0.004) - 0.5) * 0.1);
    h = mix(h, 5 + hills * 7, lakeCut);
    const riverWidth = 23 + noise(z * 0.001, 12, 8) * 23;
    const riverCut = (1 - smooth(riverWidth, riverWidth + 120, f.river)) * (1 - smooth(900, 2400, -z));
    h = mix(h, 10 + hills * 4, riverCut);
    // A dry, gentle station clearing, without a flat artificial platform.
    const clearing = 1 - smooth(18, 75, Math.hypot(x + 180, z - 360));
    h = mix(h, 78, clearing);
    return h;
  };
  // Match the two rendered triangles of the nearest terrain grid exactly.
  const ground = (x, z) => {
    const step = 8, ix = Math.floor(x / step) * step, iz = Math.floor(z / step) * step;
    const u = (x - ix) / step, v = (z - iz) / step;
    const a = height(ix, iz), b = height(ix + step, iz), c = height(ix, iz + step), d = height(ix + step, iz + step);
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  };
  const biome = (x, z, h = height(x, z)) => {
    if (h < 22) return 6;
    if (h > 710) return 3;
    if (h > 340) return 2;
    const f = features(x, z);
    if (f.canyon > 0.48) return 4;
    if (f.swamp > 0.38) return 5;
    const forest = noise(x * 0.00065 - 9, z * 0.00065 + 3, 112);
    if (forest > 0.53 || Math.hypot(x + 1550, z + 900) < 750) return 1;
    return 0;
  };
  const colors = [[0.29,0.40,0.15],[0.17,0.30,0.14],[0.30,0.34,0.24],[0.66,0.70,0.67],[0.48,0.27,0.13],[0.20,0.27,0.12],[0.21,0.28,0.22]];
  const color = (x, z, h, b = biome(x, z, h)) => {
    const c = colors[b], variation = 0.82 + noise(x * 0.02, z * 0.02, 618) * 0.30;
    const steep = Math.abs(height(x + 8, z) - h) + Math.abs(height(x, z + 8) - h);
    let r = c[0], g = c[1], blue = c[2];
    if (h > 810) { const snow = smooth(790, 1050, h) * (1 - smooth(20, 90, steep)); r = mix(r, 0.83, snow); g = mix(g, 0.88, snow); blue = mix(blue, 0.91, snow); }
    if (h > 22 && h < 28) { r = 0.48; g = 0.44; blue = 0.27; }
    if (b === 4) { const band = Math.sin(h * 0.12) * 0.08; r += band; g += band * 0.6; }
    return [r * variation, g * variation, blue * variation];
  };
  return { hash, noise, fbm, smooth, height, ground, biome, color, riverX, features };
}

export function createChunkData(kernel, spec) {
  const { x, z, size, segments } = spec, row = segments + 1;
  const edge = segments * 4, vertexCount = row * row + edge * 2;
  const positions = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
  const indices = [];
  for (let j = 0; j <= segments; j++) for (let i = 0; i <= segments; i++) {
    const px = x + i / segments * size, pz = z + j / segments * size, h = kernel.height(px, pz);
    const n = (j * row + i) * 3;
    positions.set([px - x, h, pz - z], n); colors.set(kernel.color(px, pz, h), n);
  }
  for (let j = 0; j < segments; j++) for (let i = 0; i < segments; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const border = [];
  for (let i = 0; i < segments; i++) border.push(i);
  for (let i = 0; i < segments; i++) border.push(i * row + segments);
  for (let i = segments; i > 0; i--) border.push(segments * row + i);
  for (let i = segments; i > 0; i--) border.push(i * row);
  for (let i = 0; i < edge; i++) {
    const n = row * row + i * 2, src = border[i] * 3;
    positions.set(positions.subarray(src, src + 3), n * 3);
    positions.set([positions[src], positions[src + 1] - Math.max(35, size * 0.16), positions[src + 2]], (n + 1) * 3);
    colors.set(colors.subarray(src, src + 3), n * 3); colors.set(colors.subarray(src, src + 3), (n + 1) * 3);
    const next = row * row + ((i + 1) % edge) * 2;
    indices.push(n, next, n + 1, next, next + 1, n + 1);
  }
  return { positions, colors, indices: new Uint32Array(indices) };
}
