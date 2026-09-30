/* BOUNDLESS — shared world math and procedural geometry. World units: kilometres.
   World positions remain in JS double precision. GPU positions are camera-relative. */
export const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(...a), norm: (a) => { const n = Math.hypot(...a) || 1; return a.map((x) => x / n); },
  mix: (a, b, t) => a.map((v, i) => v + (b[i] - v) * t), dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
};
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const Q = {
  mul: (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]],
  norm: (q) => { const n = Math.hypot(...q); return q.map((x) => x / n); }, axis: (a, t) => [...V.mul(a, Math.sin(t / 2)), Math.cos(t / 2)],
  rot: (v, q) => { const u = q.slice(0, 3), t = V.mul(V.cross(u, v), 2); return V.add(v, V.add(V.mul(t, q[3]), V.cross(u, t))); },
  slerp: (a, b, t) => { let d = a.reduce((s, x, i) => s + x * b[i], 0); if (d < 0) { b = b.map((v) => -v); d = -d; } if (d > 0.9995) return Q.norm(a.map((v, i) => mix(v, b[i], t))); const z = Math.acos(clamp(d, -1, 1)), s = Math.sin(z); return a.map((v, i) => (v * Math.sin((1 - t) * z) + b[i] * Math.sin(t * z)) / s); },
  look: (f, u = [0, 1, 0]) => {
    f = V.norm(f); const z = V.mul(f, -1); let x = V.norm(V.cross(u, z)); if (V.len(x) < 0.01) x = V.norm(V.cross([0, 0, 1], z)); const y = V.cross(z, x);
    const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2], t = m00 + m11 + m22; let q;
    if (t > 0) { const s = Math.sqrt(t + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
    return Q.norm(q);
  },
};
export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash3(x, y, z, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ s; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295 * 2 - 1; }
export function noise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z); let fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  return mix(mix(mix(hash3(ix, iy, iz, s), hash3(ix + 1, iy, iz, s), fx), mix(hash3(ix, iy + 1, iz, s), hash3(ix + 1, iy + 1, iz, s), fx), fy), mix(mix(hash3(ix, iy, iz + 1, s), hash3(ix + 1, iy, iz + 1, s), fx), mix(hash3(ix, iy + 1, iz + 1, s), hash3(ix + 1, iy + 1, iz + 1, s), fx), fy), fz);
}
export function rawHeight(n, p) { const a = noise(n[0] * 3.2 + 5, n[1] * 3.2, n[2] * 3.2, p.seed), b = noise(n[0] * 10, n[1] * 10, n[2] * 10, p.seed + 7), c = noise(n[0] * 27, n[1] * 27, n[2] * 27, p.seed + 13); return p.radius * (a * 0.09 + b * 0.032 + c * 0.01 - 0.006); }
export function heightAt(n, p) { return Math.max(0, rawHeight(n, p)); }
export function terrainColor(n, p, h) {
  const water = p.palette.water, land = p.palette.land, peak = p.palette.peak;
  if (h <= 0) { const d = clamp(1 + rawHeight(n, p) / p.radius * 18, 0, 1); return V.mix(V.mul(water, 0.3), water, 0.35 + d * 0.65); }
  const t = clamp(h / p.radius * 20, 0, 1); return V.mix(land, peak, t);
}
/** Flat-shaded triangle soup: position, normal, colour (9 floats per vertex). */
export class MeshBuilder {
  constructor() { this.data = []; }
  tri(a, b, c, color, normal) { const n = normal || V.norm(V.cross(V.sub(b, a), V.sub(c, a))); for (const p of [a, b, c]) this.data.push(...p, ...n, ...color); return this; }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); return this; }
  box(center, size, color) {
    const [x, y, z] = center, [w, h, d] = size.map((v) => v / 2);
    const v = [[x - w, y - h, z - d], [x + w, y - h, z - d], [x + w, y + h, z - d], [x - w, y + h, z - d], [x - w, y - h, z + d], [x + w, y - h, z + d], [x + w, y + h, z + d], [x - w, y + h, z + d]];
    for (const f of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) this.quad(...f.map((i) => v[i]), color);
    return this;
  }
}
export function cubeDirection(face, u, v) { return V.norm(face === 0 ? [1, v, -u] : face === 1 ? [-1, v, u] : face === 2 ? [u, 1, -v] : face === 3 ? [u, -1, v] : face === 4 ? [u, v, 1] : [-u, v, -1]); }
export function sphereGeometry(p, res = 32, shell = false) {
  const b = new MeshBuilder();
  for (let f = 0; f < 6; f++) {
    const grid = [];
    for (let y = 0; y <= res; y++) for (let x = 0; x <= res; x++) { const n = cubeDirection(f, x / res * 2 - 1, y / res * 2 - 1), h = shell ? 0 : heightAt(n, p); grid.push({ n, h, v: V.mul(n, p.radius + h) }); }
    for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
      const a = grid[y * (res + 1) + x], d = grid[(y + 1) * (res + 1) + x], c = grid[(y + 1) * (res + 1) + x + 1], bb = grid[y * (res + 1) + x + 1];
      for (const t of [[a, bb, c], [a, c, d]]) {
        const n = V.norm(V.add(V.add(t[0].n, t[1].n), t[2].n)), h = (t[0].h + t[1].h + t[2].h) / 3;
        let normal = V.norm(V.cross(V.sub(t[1].v, t[0].v), V.sub(t[2].v, t[0].v))); if (V.dot(n, normal) < 0) normal = V.mul(normal, -1);
        b.tri(t[0].v, t[1].v, t[2].v, shell ? [1, 1, 1] : terrainColor(n, p, h), shell ? n : normal);
      }
    }
  }
  return b.data;
}
export function ringGeometry(radius, seed) {
  const r = rng(seed), b = new MeshBuilder();
  for (let k = 0; k < 7; k++) {
    const inner = radius * (1.35 + k * 0.115), outer = inner + radius * (0.04 + r() * 0.055), col = k % 2 ? [0.33, 0.19, 0.51] : [0.52, 0.34, 0.53];
    for (let i = 0; i < 128; i++) { const a = i / 128 * Math.PI * 2, c = (i + 1) / 128 * Math.PI * 2; const p = (s, t) => [Math.cos(t) * s, Math.sin(t) * s * 0.38, Math.sin(t) * s * 0.93]; b.quad(p(inner, a), p(outer, a), p(outer, c), p(inner, c), col); }
  }
  return b.data;
}
/* Whole-planet terrain with its parent (coarser) triangles for geomorphing.
   Layout per vertex (20 floats): position, normal, colour, parent position/normal/colour,
   elevation pair. Parent triangles use the SAME heightAt function as collision.
   Written straight into one typed array: no per-vertex arrays (a 128 grid is 1.2M vertices). */
export function terrainRenderGeometry(p, res) {
  const N = res + 1, out = new Float32Array(6 * res * res * 6 * 20), R = p.radius;
  const gn = new Float64Array(N * N * 3), gp = new Float64Array(N * N * 3), gh = new Float64Array(N * N);
  const fine = { n: [0, 0, 0], color: null }, parent = { n: [0, 0, 0], color: null };
  const sum = [0, 0, 0];
  let c = 0;
  // Face normal (oriented outward) and colour of the triangle through grid points i0, i1, i2.
  const info = (i0, i1, i2, dst) => {
    const ax = gp[i1 * 3] - gp[i0 * 3], ay = gp[i1 * 3 + 1] - gp[i0 * 3 + 1], az = gp[i1 * 3 + 2] - gp[i0 * 3 + 2];
    const bx = gp[i2 * 3] - gp[i0 * 3], by = gp[i2 * 3 + 1] - gp[i0 * 3 + 1], bz = gp[i2 * 3 + 2] - gp[i0 * 3 + 2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    sum[0] = gn[i0 * 3] + gn[i1 * 3] + gn[i2 * 3]; sum[1] = gn[i0 * 3 + 1] + gn[i1 * 3 + 1] + gn[i2 * 3 + 1]; sum[2] = gn[i0 * 3 + 2] + gn[i1 * 3 + 2] + gn[i2 * 3 + 2];
    const sl = Math.hypot(sum[0], sum[1], sum[2]) || 1; const rad = [sum[0] / sl, sum[1] / sl, sum[2] / sl];
    if (nx * rad[0] + ny * rad[1] + nz * rad[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    dst.n[0] = nx; dst.n[1] = ny; dst.n[2] = nz;
    dst.color = terrainColor(rad, p, (gh[i0] + gh[i1] + gh[i2]) / 3);
  };
  for (let f = 0; f < 6; f++) {
    for (let y = 0; y <= res; y++) for (let x = 0; x <= res; x++) {
      const n = cubeDirection(f, x / res * 2 - 1, y / res * 2 - 1), h = heightAt(n, p), i = y * N + x, r = R + h;
      gn[i * 3] = n[0]; gn[i * 3 + 1] = n[1]; gn[i * 3 + 2] = n[2]; gp[i * 3] = n[0] * r; gp[i * 3 + 1] = n[1] * r; gp[i * 3 + 2] = n[2] * r; gh[i] = h;
    }
    for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) for (let upper = 0; upper < 2; upper++) {
      const xy = upper ? [[x, y], [x + 1, y + 1], [x, y + 1]] : [[x, y], [x + 1, y], [x + 1, y + 1]];
      const vs = xy.map(([a, b]) => b * N + a);
      info(vs[0], vs[1], vs[2], fine);
      const cx = Math.floor(x / 2) * 2, cy = Math.floor(y / 2) * 2;
      const cenX = (xy[0][0] + xy[1][0] + xy[2][0]) / 3, cenY = (xy[0][1] + xy[1][1] + xy[2][1]) / 3;
      const upperParent = cenY - cy > cenX - cx;
      const pv = upperParent ? [cy * N + cx, (cy + 2) * N + cx + 2, (cy + 2) * N + cx] : [cy * N + cx, cy * N + cx + 2, (cy + 2) * N + cx + 2];
      info(pv[0], pv[1], pv[2], parent);
      for (let i = 0; i < 3; i++) {
        const u = (xy[i][0] - cx) / 2, v = (xy[i][1] - cy) / 2;
        const w0 = upperParent ? 1 - v : 1 - u, w1 = upperParent ? u : u - v, w2 = upperParent ? v - u : v;
        const k = vs[i];
        out[c] = gp[k * 3]; out[c + 1] = gp[k * 3 + 1]; out[c + 2] = gp[k * 3 + 2];
        out[c + 3] = fine.n[0]; out[c + 4] = fine.n[1]; out[c + 5] = fine.n[2];
        out[c + 6] = fine.color[0]; out[c + 7] = fine.color[1]; out[c + 8] = fine.color[2];
        for (let j = 0; j < 3; j++) out[c + 9 + j] = gp[pv[0] * 3 + j] * w0 + gp[pv[1] * 3 + j] * w1 + gp[pv[2] * 3 + j] * w2;
        out[c + 12] = parent.n[0]; out[c + 13] = parent.n[1]; out[c + 14] = parent.n[2];
        out[c + 15] = parent.color[0]; out[c + 16] = parent.color[1]; out[c + 17] = parent.color[2];
        out[c + 18] = gh[k] / R; out[c + 19] = (gh[pv[0]] * w0 + gh[pv[1]] * w1 + gh[pv[2]] * w2) / R;
        c += 20;
      }
    }
  }
  return out;
}

/* AURORA / one asset for the ship bay and flight. aurora.glb is the download.
   The import reads glTF triangle meshes, transforms, normals, and named sockets.
   There is no second procedural approximation of the model. */
export function parseAurora(buffer) {
  const bytes = new Uint8Array(buffer), dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67 || dv.getUint32(4, true) !== 2 || dv.getUint32(8, true) !== bytes.length) throw Error('AURORA: invalid GLB header');
  const jsonLength = dv.getUint32(12, true), gltf = JSON.parse(new TextDecoder().decode(bytes.slice(20, 20 + jsonLength)));
  const binOffset = 20 + jsonLength + 8; let triangles = 0;
  const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const multiply = (a, b) => Array.from({ length: 16 }, (_, i) => { const row = i % 4, col = Math.floor(i / 4); let t = 0; for (let k = 0; k < 4; k++) t += a[k * 4 + row] * b[col * 4 + k]; return t; });
  const matrix = (n) => { if (n.matrix) return n.matrix; const q = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1], t = n.translation || [0, 0, 0]; return [...Q.rot([s[0], 0, 0], q), 0, ...Q.rot([0, s[1], 0], q), 0, ...Q.rot([0, 0, s[2]], q), 0, ...t, 1]; };
  const transform = (p, m) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  const normalMatrix = (m) => { const a = m.slice(0, 3), b = m.slice(4, 7), c = m.slice(8, 11), x = V.cross(b, c), y = V.cross(c, a), z = V.cross(a, b), det = V.dot(a, x); if (Math.abs(det) < 1e-10) throw Error('AURORA: singular node transform'); return [...V.mul(x, 1 / det), ...V.mul(y, 1 / det), ...V.mul(z, 1 / det)]; };
  function read(index) {
    const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView]; if (a.sparse || v.buffer !== 0) throw Error('AURORA: unsupported accessor');
    const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }, n = widths[a.type], size = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 }[a.componentType], stride = v.byteStride || n * size; const out = [];
    if (!n || !size) throw Error('AURORA: unsupported component type');
    for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) { const p = binOffset + (v.byteOffset || 0) + (a.byteOffset || 0) + i * stride + k * size; out.push(a.componentType === 5126 ? dv.getFloat32(p, true) : a.componentType === 5125 ? dv.getUint32(p, true) : a.componentType === 5123 ? dv.getUint16(p, true) : dv.getUint8(p)); }
    return out;
  }
  const materials = gltf.materials.map((m) => { const p = m.pbrMetallicRoughness || {}, h = m.extras?.srgbHex, linear = p.baseColorFactor || [1, 1, 1, 1]; return { name: m.name, color: h ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) : linear.slice(0, 3).map((c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)), roughness: p.roughnessFactor ?? 0.5, metallic: p.metallicFactor ?? 0.2, emission: m.extras?.emissionStrength || m.extensions?.KHR_materials_emissive_strength?.emissiveStrength || 0, canopy: !!m.extras?.canopy || /canopy/i.test(m.name) }; });
  const groups = materials.map((material) => ({ material, data: [] })), sockets = [], tips = [], parts = [], wire = [];
  function walk(index, parent) {
    const node = gltf.nodes[index], m = multiply(parent, matrix(node));
    if (node.name?.startsWith('SOCKET_Engine')) sockets.push({ name: node.name, position: transform([0, 0, 0], m), radius: node.extras?.exhaustRadius || 0.48 });
    if (node.name?.startsWith('LIGHT_')) tips.push({ name: node.name, position: transform([0, 0, 0], m) });
    if (node.mesh !== undefined) {
      const nm = normalMatrix(m), mesh = gltf.meshes[node.mesh]; let count = 0;
      for (const p of mesh.primitives) {
        if ((p.mode ?? 4) !== 4) throw Error('AURORA: triangle meshes are required');
        const pos = read(p.attributes.POSITION), norm = p.attributes.NORMAL !== undefined ? read(p.attributes.NORMAL) : null, ix = p.indices !== undefined ? read(p.indices) : Array.from({ length: pos.length / 3 }, (_, i) => i);
        if (ix.length % 3) throw Error('AURORA: incomplete triangle');
        const group = groups[p.material || 0], col = group.material.color, seen = new Set();
        for (let k = 0; k < ix.length; k += 3) {
          const pp = ix.slice(k, k + 3).map((i) => transform(pos.slice(i * 3, i * 3 + 3), m));
          const flat = V.norm(V.cross(V.sub(pp[1], pp[0]), V.sub(pp[2], pp[0])));
          for (let j = 0; j < 3; j++) { let nn = flat; if (norm) { const i = ix[k + j] * 3, n = norm.slice(i, i + 3); nn = V.norm([nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2], nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2], nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]]); } group.data.push(...pp[j], ...nn, ...col); }
          for (let j = 0; j < 3; j++) { const a = pp[j], b = pp[(j + 1) % 3], as = a.map((x) => x.toFixed(4)).join(','), bs = b.map((x) => x.toFixed(4)).join(','), key = as < bs ? as + '|' + bs : bs + '|' + as; if (!seen.has(key)) { seen.add(key); wire.push(...a, 0.19, 0.8, 0.77, ...b, 0.19, 0.8, 0.77); } }
          count++; triangles++;
        }
      }
      parts.push({ name: node.name, triangles: count, group: node.extras?.group, mirrorPair: !!node.extras?.mirrorPair });
    }
    for (const c of node.children || []) walk(c, m);
  }
  for (const n of gltf.scenes[gltf.scene || 0].nodes) walk(n, identity());
  if (sockets.length !== 2 || tips.length !== 4) throw Error('AURORA: two engine sockets and four wing lights are required');
  const groupsUsed = groups.filter((g) => g.data.length); for (const g of groupsUsed) g.data = new Float32Array(g.data);
  const boundsMin = [Infinity, Infinity, Infinity], boundsMax = [-Infinity, -Infinity, -Infinity];
  for (const g of groupsUsed) for (let i = 0; i < g.data.length; i += 9) for (let k = 0; k < 3; k++) { boundsMin[k] = Math.min(boundsMin[k], g.data[i + k]); boundsMax[k] = Math.max(boundsMax[k], g.data[i + k]); }
  const dimensions = [boundsMax[0] - boundsMin[0], boundsMax[2] - boundsMin[2], boundsMax[1] - boundsMin[1]];
  const report = { name: 'AURORA', assetVersion: '1.0.0', triangles, meshNodes: parts.length, drawBatches: groupsUsed.length, dimensions, units: 'metres', source: 'Approved top view', wingShells: parts.filter((p) => /^Wing\.(Fore|Aft)\.[RL]$/.test(p.name)).reduce((n, p) => n + (p.mirrorPair ? 2 : 1), 0), engines: sockets.map((s) => ({ ...s, position: s.position.slice() })), lights: tips.map((s) => ({ ...s, position: s.position.slice() })), bytes: bytes.length };
  return { groups: groupsUsed, sockets, tips, wire: new Float32Array(wire), parts, report, bytes };
}
