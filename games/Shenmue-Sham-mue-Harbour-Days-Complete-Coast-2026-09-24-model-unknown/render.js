/* Sham-mue render layer on the shared 3D kit: three.js r186 (WebGPU, WebGL2 fallback).
   The game still builds its world with MeshBuilder (13 floats per vertex: position,
   normal, uv, colour, atlas tile, effect). This file turns those arrays into three.js
   meshes that share one TSL material, and reproduces the original look: the painted
   atlas, hemisphere-style ambient, one sun with a snapped shadow box, the harbour's own
   exponential fog curve, animated sea, the cloudy sky and the slight 0.94 output curve. */
import * as THREE from 'three/webgpu';
import { Fn, attribute, texture, uv, vec2, vec3, vec4, float, floor, mod, fract, mix, clamp, log2, exp2, ceil, max, length, dFdx, dFdy, select, positionWorld, positionView, cameraPosition, normalize, sin, pow, dot, reflect, exp, smoothstep, uniform, fog } from 'three/tsl';
import { createPost } from 'kit/post.js';

// The original engine wrote shader colours straight to the screen: no sRGB step anywhere.
THREE.ColorManagement.enabled = false;

export const STRIDE = 13;
export const ATLAS_COLS = 8, ATLAS_ROWS = 8, TILE = 256; // 64 painted 256 px tiles (the game uses all 64)
const PI = Math.PI, TAU = PI * 2;

const hexCache = new Map();
const WHITE = [1, 1, 1];
/** '#rrggbb' → [r, g, b] in 0..1 (cached; arrays pass through unchanged). */
export function hex(s) {
  if (Array.isArray(s)) return s;
  if (!s) return WHITE;
  let v = hexCache.get(s);
  if (!v) {
    let t = s.replace('#', '');
    if (t.length === 3) t = t.split('').map((c) => c + c).join('');
    v = [parseInt(t.slice(0, 2), 16) / 255, parseInt(t.slice(2, 4), 16) / 255, parseInt(t.slice(4, 6), 16) / 255];
    hexCache.set(s, v);
  }
  return v;
}

/**
 * The game's procedural mesh builder, rewritten to write straight into a growable
 * Float32Array with a preallocated matrix stack: no per-vertex allocations, so the
 * per-frame character and vehicle meshes cost a fraction of what they did.
 * Same API and the same maths as before (column-major matrices, face normals).
 */
export class MeshBuilder {
  constructor(capacity = 1 << 14) {
    this.data = new Float32Array(capacity * STRIDE);
    this.count = 0;
    this.m = new Float64Array(16);
    this.m[0] = this.m[5] = this.m[10] = this.m[15] = 1;
    this.saved = [];
    this.depth = 0;
    this.tmp = new Float64Array(16);
    /** Detail factor for spheres and cylinders (1 = as authored). */
    this.lod = 1;
  }
  /** The vertices written so far (a view, not a copy). */
  get a() {
    return this.data.subarray(0, this.count * STRIDE);
  }
  get vertexCount() {
    return this.count;
  }
  reset() {
    this.count = 0;
    this.depth = 0;
    this.m.fill(0);
    this.m[0] = this.m[5] = this.m[10] = this.m[15] = 1;
    this.lod = 1;
    return this;
  }
  reserve(n) {
    const need = (this.count + n) * STRIDE;
    if (need <= this.data.length) return;
    let size = this.data.length * 2;
    while (size < need) size *= 2;
    const next = new Float32Array(size);
    next.set(this.data.subarray(0, this.count * STRIDE));
    this.data = next;
  }
  /** Append raw vertex data (another builder's `a`). */
  append(a) {
    const n = (a.length / STRIDE) | 0;
    this.reserve(n);
    for (let i = 0, o = this.count * STRIDE; i < n * STRIDE; i++) this.data[o + i] = a[i];
    this.count += n;
    return this;
  }
  save() {
    let s = this.saved[this.depth];
    if (!s) s = this.saved[this.depth] = new Float64Array(16);
    s.set(this.m);
    this.depth++;
    return this;
  }
  push(x = 0, y = 0, z = 0, yaw = 0) {
    this.save();
    this.translate(x, y, z);
    if (yaw) this.rotateY(yaw);
    return this;
  }
  pop() {
    if (this.depth > 0) this.m.set(this.saved[--this.depth]);
    return this;
  }
  translate(x, y, z) {
    const m = this.m;
    m[12] += m[0] * x + m[4] * y + m[8] * z;
    m[13] += m[1] * x + m[5] * y + m[9] * z;
    m[14] += m[2] * x + m[6] * y + m[10] * z;
    m[15] += m[3] * x + m[7] * y + m[11] * z;
    return this;
  }
  rotateY(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a);
    for (let r = 0; r < 4; r++) {
      const a0 = m[r], a2 = m[8 + r];
      m[r] = c * a0 - s * a2;
      m[8 + r] = s * a0 + c * a2;
    }
    return this;
  }
  rotateX(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a);
    for (let r = 0; r < 4; r++) {
      const a1 = m[4 + r], a2 = m[8 + r];
      m[4 + r] = c * a1 + s * a2;
      m[8 + r] = -s * a1 + c * a2;
    }
    return this;
  }
  rotateZ(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a);
    for (let r = 0; r < 4; r++) {
      const a0 = m[r], a1 = m[4 + r];
      m[r] = c * a0 + s * a1;
      m[4 + r] = -s * a0 + c * a1;
    }
    return this;
  }
  scale(x, y = x, z = x) {
    const m = this.m;
    for (let r = 0; r < 4; r++) {
      m[r] *= x;
      m[4 + r] *= y;
      m[8 + r] *= z;
    }
    return this;
  }
  /** this.m = this.m × b (column-major 4×4). */
  multiply(b) {
    const a = this.m, o = this.tmp;
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    a.set(o);
    return this;
  }
  _w(px, py, pz, nx, ny, nz, u, v, c, tx, fx) {
    const m = this.m, d = this.data, o = this.count++ * STRIDE;
    d[o] = m[0] * px + m[4] * py + m[8] * pz + m[12];
    d[o + 1] = m[1] * px + m[5] * py + m[9] * pz + m[13];
    d[o + 2] = m[2] * px + m[6] * py + m[10] * pz + m[14];
    d[o + 3] = nx;
    d[o + 4] = ny;
    d[o + 5] = nz;
    d[o + 6] = u;
    d[o + 7] = v;
    d[o + 8] = c[0];
    d[o + 9] = c[1];
    d[o + 10] = c[2];
    d[o + 11] = tx;
    d[o + 12] = fx;
  }
  _tri(ax, ay, az, bx, by, bz, cx, cy, cz, u0, v0, u1, v1, u2, v2, tx, col, fx) {
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    let l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const m = this.m;
    let wx = m[0] * nx + m[4] * ny + m[8] * nz, wy = m[1] * nx + m[5] * ny + m[9] * nz, wz = m[2] * nx + m[6] * ny + m[10] * nz;
    l = Math.sqrt(wx * wx + wy * wy + wz * wz) || 1;
    wx /= l;
    wy /= l;
    wz /= l;
    const c = hex(col);
    if ((this.count + 3) * STRIDE > this.data.length) this.reserve(3);
    this._w(ax, ay, az, wx, wy, wz, u0, v0, c, tx, fx);
    this._w(bx, by, bz, wx, wy, wz, u1, v1, c, tx, fx);
    this._w(cx, cy, cz, wx, wy, wz, u2, v2, c, tx, fx);
  }
  _quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, tx, col, rx, ry, fx) {
    this._tri(ax, ay, az, bx, by, bz, cx, cy, cz, 0, ry, rx, ry, rx, 0, tx, col, fx);
    this._tri(ax, ay, az, cx, cy, cz, dx, dy, dz, 0, ry, rx, 0, 0, 0, tx, col, fx);
  }
  vertex(p, n, uvs, c, tx, fx) {
    if ((this.count + 1) * STRIDE > this.data.length) this.reserve(1);
    const m = this.m;
    let x = m[0] * n[0] + m[4] * n[1] + m[8] * n[2], y = m[1] * n[0] + m[5] * n[1] + m[9] * n[2], z = m[2] * n[0] + m[6] * n[1] + m[10] * n[2];
    const l = Math.sqrt(x * x + y * y + z * z) || 1;
    this._w(p[0], p[1], p[2], x / l, y / l, z / l, uvs[0], uvs[1], hex(c), tx, fx);
  }
  tri(a, b, c, tx = 0, col = '#ffffff', uvs = null, fx = 0) {
    if (uvs) this._tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1], tx, col, fx);
    else this._tri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], 0, 1, 1, 1, 1, 0, tx, col, fx);
    return this;
  }
  quad(a, b, c, d, tx = 0, col = '#ffffff', rx = 1, ry = 1, fx = 0) {
    this._quad(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2], tx, col, rx, ry, fx);
    return this;
  }
  box(x, y, z, w, h, d, tx = 0, col = '#ffffff', tile = 0, fx = 0) {
    const l = x - w / 2, r = x + w / 2, b = y - h / 2, t = y + h / 2, f = z + d / 2, k = z - d / 2;
    const uw = tile ? w / tile : 1, uh = tile ? h / tile : 1, ud = tile ? d / tile : 1;
    this._quad(l, b, f, r, b, f, r, t, f, l, t, f, tx, col, uw, uh, fx);
    this._quad(r, b, k, l, b, k, l, t, k, r, t, k, tx, col, uw, uh, fx);
    this._quad(r, b, f, r, b, k, r, t, k, r, t, f, tx, col, ud, uh, fx);
    this._quad(l, b, k, l, b, f, l, t, f, l, t, k, tx, col, ud, uh, fx);
    this._quad(l, t, f, r, t, f, r, t, k, l, t, k, tx, col, uw, ud, fx);
    this._quad(l, b, k, r, b, k, r, b, f, l, b, f, tx, col, uw, ud, fx);
    return this;
  }
  plane(x, y, z, w, h, tx, col = '#ffffff', yaw = 0, fx = 0) {
    this.push(x, y, z, yaw);
    this._quad(-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0, tx, col, 0.9999, 0.9999, fx);
    this.pop();
    return this;
  }
  cylinder(x, y, z, r1, r2, h, tx, col, sides = 10) {
    if (this.lod < 1) sides = Math.max(4, Math.round(sides * this.lod));
    this.push(x, y, z);
    const hh = h / 2;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU, b = ((i + 1) / sides) * TAU, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const px = ca * r1, pz = sa * r1, qx = cb * r1, qz = sb * r1, rx = cb * r2, rz = sb * r2, sx = ca * r2, sz = sa * r2;
      this._quad(qx, -hh, qz, px, -hh, pz, sx, hh, sz, rx, hh, rz, tx, col, 1, 1, 0);
      this._tri(0, hh, 0, rx, hh, rz, sx, hh, sz, 0, 1, 1, 1, 1, 0, tx, col, 0);
      this._tri(0, -hh, 0, px, -hh, pz, qx, -hh, qz, 0, 1, 1, 1, 1, 0, tx, col, 0);
    }
    this.pop();
    return this;
  }
  sphere(x, y, z, rx, ry, rz, tx, col, rings = 6, sides = 10) {
    if (this.lod < 1) {
      rings = Math.max(3, Math.round(rings * this.lod));
      sides = Math.max(4, Math.round(sides * this.lod));
    }
    this.push(x, y, z);
    for (let j = 0; j < rings; j++) {
      const a = (j / rings) * PI, b = ((j + 1) / rings) * PI, sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cbb = Math.cos(b);
      for (let i = 0; i < sides; i++) {
        const c = (i / sides) * TAU, d = ((i + 1) / sides) * TAU, cc = Math.cos(c), sc = Math.sin(c), cd = Math.cos(d), sd = Math.sin(d);
        // quad(p(b,d), p(b,c), p(a,c), p(a,d)) with p(u,v) = [sin u cos v rx, cos u ry, sin u sin v rz]
        this._quad(sb * cd * rx, cbb * ry, sb * sd * rz, sb * cc * rx, cbb * ry, sb * sc * rz, sa * cc * rx, ca * ry, sa * sc * rz, sa * cd * rx, ca * ry, sa * sd * rz, tx, col, 1, 1, 0);
      }
    }
    this.pop();
    return this;
  }
  beam(a, b, w, tx, col, d = w) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.sqrt(dx * dx + dy * dy + dz * dz), il = 1 / (len || 1);
    const yx = dx * il, yy = dy * il, yz = dz * il;
    // x = normalize(cross(y, |y.y| > .9 ? [1,0,0] : [0,1,0])), z = cross(x, y)
    let xx, xy, xz;
    if (Math.abs(yy) > 0.9) {
      xx = 0;
      xy = yz;
      xz = -yy;
    } else {
      xx = -yz;
      xy = 0;
      xz = yx;
    }
    const xl = Math.sqrt(xx * xx + xy * xy + xz * xz) || 1;
    xx /= xl;
    xy /= xl;
    xz /= xl;
    const zx = xy * yz - xz * yy, zy = xz * yx - xx * yz, zz = xx * yy - xy * yx;
    const mat = this.tmpBeam || (this.tmpBeam = new Float64Array(16));
    mat[0] = xx; mat[1] = xy; mat[2] = xz; mat[3] = 0;
    mat[4] = yx; mat[5] = yy; mat[6] = yz; mat[7] = 0;
    mat[8] = zx; mat[9] = zy; mat[10] = zz; mat[11] = 0;
    mat[12] = (a[0] + b[0]) / 2; mat[13] = (a[1] + b[1]) / 2; mat[14] = (a[2] + b[2]) / 2; mat[15] = 1;
    this.save();
    this.multiply(mat);
    this.box(0, 0, 0, w, len, d, tx, col);
    this.pop();
    return this;
  }
  taper(x, y, z, wb, wt, h, db, dt, tx, col) {
    const l = -wb / 2, r = wb / 2, L = -wt / 2, R = wt / 2, b = -h / 2, t = h / 2, fb = db / 2, ft = dt / 2;
    this.push(x, y, z);
    this._quad(l, b, fb, r, b, fb, R, t, ft, L, t, ft, tx, col, 1, 1, 0);
    this._quad(r, b, -fb, l, b, -fb, L, t, -ft, R, t, -ft, tx, col, 1, 1, 0);
    this._quad(r, b, fb, r, b, -fb, R, t, -ft, R, t, ft, tx, col, 1, 1, 0);
    this._quad(l, b, -fb, l, b, fb, L, t, ft, L, t, -ft, tx, col, 1, 1, 0);
    this._quad(L, t, ft, R, t, ft, R, t, -ft, L, t, -ft, tx, col, 1, 1, 0);
    this._quad(l, b, -fb, r, b, -fb, r, b, fb, l, b, fb, tx, col, 1, 1, 0);
    this.pop();
    return this;
  }
}

/** Split vertex data into ordinary triangles and the animated-sea triangles (effect 2). */
function splitWater(a) {
  const n = (a.length / STRIDE) | 0;
  let water = 0;
  for (let i = 0; i < n; i += 3) if (a[i * STRIDE + 12] > 1.5 && a[i * STRIDE + 12] < 2.5) water += 3;
  if (!water) return { lit: a, water: null };
  const lit = new Float32Array((n - water) * STRIDE), wet = new Float32Array(water * STRIDE);
  let lo = 0, wo = 0;
  for (let i = 0; i < n; i += 3) {
    const fx = a[i * STRIDE + 12], src = a.subarray(i * STRIDE, (i + 3) * STRIDE);
    if (fx > 1.5 && fx < 2.5) {
      wet.set(src, wo);
      wo += 3 * STRIDE;
    } else {
      lit.set(src, lo);
      lo += 3 * STRIDE;
    }
  }
  return { lit, water: wet };
}

function geometryFor(array) {
  // The streamed buffer keeps the default (static) usage on purpose: in r186 a
  // DynamicDrawUsage buffer is re-uploaded on every render call, and the second
  // call of a frame (shadow pass, then the main pass) would send the whole array
  // after the first one cleared its update range. Bumping the version once per
  // frame uploads just this frame's vertices, once.
  const buffer = new THREE.InterleavedBuffer(array, STRIDE);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  g.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
  g.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 6));
  g.setAttribute('color', new THREE.InterleavedBufferAttribute(buffer, 3, 8));
  g.setAttribute('aTile', new THREE.InterleavedBufferAttribute(buffer, 2, 11));
  return { geometry: g, buffer };
}

const hash21 = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)));
const valueNoise = Fn(([p]) => {
  const i = floor(p), f = fract(p);
  const u = f.mul(f).mul(f.mul(-2).add(3));
  const a = hash21(i), b = hash21(i.add(vec2(1, 0))), c = hash21(i.add(vec2(0, 1))), d = hash21(i.add(vec2(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});

/**
 * @param {object} kit          from boot()
 * @param {HTMLCanvasElement} atlasCanvas  the game's painted 8 × 8 tile atlas
 * @param {MeshBuilder} dynamicBuilder     the builder the game refills every frame
 */
export function createRenderEngine(kit, atlasCanvas, dynamicBuilder) {
  const renderer = kit.renderer;
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(53, 1, 0.045, 2500));

  const uTime = uniform(0), uRain = uniform(0), uIsolated = uniform(0), uTan = uniform(Math.tan((53 * PI) / 360));
  const uFog = uniform(new THREE.Color(0.66, 0.72, 0.69)), uTop = uniform(new THREE.Color(0.27, 0.48, 0.58));
  const uSun = uniform(new THREE.Color(0.79, 0.71, 0.55)), uAmbient = uniform(new THREE.Color(0.52, 0.59, 0.59));

  const atlas = new THREE.CanvasTexture(atlasCanvas);
  atlas.flipY = false;
  atlas.colorSpace = THREE.NoColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  atlas.magFilter = THREE.LinearFilter;
  atlas.wrapS = atlas.wrapT = THREE.ClampToEdgeWrapping;

  // ---- the shared surface material: atlas tile + vertex colour, lit by the three lights below
  const aTile = attribute('aTile', 'vec2');
  const tileId = floor(aTile.x.add(0.5));
  const fxv = aTile.y;
  const vUv = uv();
  const lod = clamp(log2(max(max(length(dFdx(vUv).mul(TILE)), length(dFdy(vUv).mul(TILE))), 1)), 0, 5);
  const pad = exp2(ceil(lod)).mul(0.7 / TILE);
  const cell = vec2(mod(tileId, ATLAS_COLS), floor(tileId.div(ATLAS_COLS)));
  const atlasUv = cell.add(mix(vec2(pad), vec2(pad.oneMinus()), fract(vUv))).div(vec2(ATLAS_COLS, ATLAS_ROWS));
  const texel = texture(atlas, atlasUv).level(lod);
  const albedo = texel.rgb.mul(attribute('color', 'vec3'));
  // Effect 1 is self-lit paint (lamps, lenses, markers), effect 3 is fully unlit.
  const glow = albedo.mul(uAmbient.mul(0.65).add(0.5));

  const surface = new THREE.MeshLambertNodeMaterial({ side: THREE.DoubleSide });
  surface.colorNode = vec4(select(fxv.lessThan(0.5), albedo, vec3(0)), texel.a);
  surface.emissiveNode = select(fxv.greaterThan(2.5), albedo, select(fxv.greaterThan(0.5), glow, vec3(0)));
  surface.alphaTest = 0.28;

  // ---- the open sea (effect 2): swell, ripples, fresnel toward the fog colour, crests and a sun glint
  const sea = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
  sea.colorNode = Fn(() => {
    const vP = positionWorld, t = uTime;
    const distance = vP.sub(cameraPosition).length();
    const swell = sin(vP.x.mul(0.21).add(t.mul(0.51))).mul(0.5).add(sin(vP.z.mul(0.31).sub(t.mul(0.42))).mul(0.35));
    const ripple = sin(vP.x.mul(1.6).add(vP.z.mul(0.9)).add(t.mul(0.75))).mul(sin(vP.z.mul(2.8).sub(vP.x.mul(0.4)).sub(t.mul(0.56))));
    const wn = normalize(vec3(swell.mul(0.08), 1, ripple.mul(0.035)));
    const view = normalize(cameraPosition.sub(vP));
    const fresnel = pow(float(1).sub(max(view.y, 0)), 3);
    const spec = pow(max(dot(reflect(normalize(vec3(0.55, -0.8, -0.3)), wn), view), 0), 68);
    const deep = vec3(0.23, 0.405, 0.405).mul(uAmbient.add(uSun.mul(0.26)));
    const col = mix(deep, uFog.mul(vec3(0.67, 0.82, 0.83)), fresnel.mul(0.28).add(0.27)).toVar();
    const wave = sin(vP.x.mul(0.58).add(sin(vP.z.mul(0.21)).mul(2)).add(t.mul(0.55))).mul(sin(vP.z.mul(0.73).sub(t.mul(0.4))));
    const detail = float(1).div(distance.mul(0.011).add(1));
    const crest = pow(max(0, sin(vP.z.mul(1.85).add(vP.x.mul(0.16)).add(sin(vP.x.mul(0.3)).mul(1.4)).add(t.mul(0.5)))), 8).mul(sin(vP.x.mul(0.7).add(t.mul(0.21))).mul(0.45).add(0.55));
    col.addAssign(vec3(0.024).mul(wave).div(distance.mul(0.003).add(1)));
    col.addAssign(vec3(0.06).mul(crest).mul(detail.mul(0.8).add(0.2)));
    col.addAssign(uSun.mul(spec).mul(0.22));
    return vec4(col, 1);
  })();

  // ---- the harbour's fog: 1 - exp(-(d·k)^1.2), thicker in rain, never quite opaque
  scene.fogNode = fog(
    uFog,
    Fn(() => {
      const d = positionWorld.sub(cameraPosition).length();
      const k = uRain.mul(0.00065).add(0.0018);
      return clamp(float(1).sub(exp(pow(d.mul(k), 1.2).negate())), 0, 0.992);
    })()
  );

  // ---- sky dome: gradient, three layers of drifting value-noise cloud, a soft sun, a darker sea horizon
  const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  skyMat.colorNode = Fn(() => {
    const rd = normalize(positionWorld.sub(cameraPosition)).toVar();
    const top = vec3(uTop), bottom = vec3(uFog);
    const vd = normalize(positionView);
    const sy = vd.y.div(max(vd.z.negate(), 0.001)).div(uTan).mul(0.5).add(0.5);
    const isolated = mix(bottom, top, smoothstep(0, 1, sy));
    const c = mix(bottom, top, smoothstep(0.015, 0.8, max(0, rd.y))).toVar();
    const t = uTime;
    const n = valueNoise(rd.xz.mul(4.2).add(vec2(t.mul(0.0016), 0))).mul(0.55)
      .add(valueNoise(rd.xy.mul(10).add(vec2(t.mul(0.0021), 1.7))).mul(0.28))
      .add(valueNoise(rd.zy.mul(23).add(vec2(t.mul(0.0027), 2.9))).mul(0.12));
    const cloud = smoothstep(0.44, 0.68, n).mul(smoothstep(0.012, 0.13, rd.y));
    c.assign(mix(c, bottom.mul(1.06), cloud.mul(0.72)));
    const sunD = max(0, dot(rd, normalize(vec3(-0.62, 0.36, 0.69))));
    c.addAssign(vec3(0.095, 0.075, 0.04).mul(pow(sunD, 110)).add(vec3(0.24, 0.18, 0.1).mul(pow(sunD, 3800))));
    const below = mix(bottom.mul(vec3(0.63, 0.8, 0.81)), bottom, exp(rd.y.mul(18)));
    const open = select(rd.y.lessThan(0), below, c);
    return vec4(select(uIsolated.greaterThan(0.5), isolated, open), 1);
  })();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
  sky.scale.setScalar(1800);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // ---- light: ambient × (0.7 + 0.3·max(n.y, 0)) is an ambient light plus a straight-down fill
  const ambient = new THREE.AmbientLight(0xffffff, PI);
  const fill = new THREE.DirectionalLight(0xffffff, PI);
  fill.position.set(0, 1, 0);
  fill.target.position.set(0, 0, 0);
  const sun = new THREE.DirectionalLight(0xffffff, PI);
  sun.castShadow = true;
  kit.shadow(sun, 2048);
  Object.assign(sun.shadow.camera, { left: -66, right: 66, top: 62, bottom: -62, near: 1, far: 190 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 1.6;
  sun.shadow.intensity = 0.68; // shade keeps 32% of the sun, as before
  scene.add(ambient, fill, fill.target, sun, sun.target);

  // ---- meshes
  const staticGroup = new THREE.Group();
  const backdrop = new THREE.Group();
  scene.add(staticGroup, backdrop);

  let dynArray = dynamicBuilder.data;
  let dyn = geometryFor(dynArray);
  const dynMesh = new THREE.Mesh(dyn.geometry, surface);
  dynMesh.frustumCulled = false;
  dynMesh.castShadow = dynMesh.receiveShadow = true;
  scene.add(dynMesh);

  const addMeshes = (group, a, { shadows }) => {
    // Own a tight copy (a builder's view would pin its whole growable array).
    const own = a instanceof Float32Array && a.byteOffset === 0 && a.length * 4 === a.buffer.byteLength ? a : Float32Array.from(a);
    const { lit, water } = splitWater(own);
    let vertices = 0;
    if (lit.length) {
      const { geometry } = geometryFor(lit);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, surface);
      mesh.castShadow = mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      vertices += lit.length / STRIDE;
    }
    if (water?.length) {
      const { geometry } = geometryFor(water);
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, sea);
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      vertices += water.length / STRIDE;
    }
    return vertices;
  };

  const post = createPost(kit, scene, camera, {
    // The original engine finished every pixel with pow(colour, 0.94).
    output: (c) => vec4(pow(max(c.rgb, vec3(0)), vec3(0.94)), c.a),
  });

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const vec = new THREE.Vector3();
  let lastFov = 53;

  const engine = {
    scene,
    camera,
    fov: 53,
    settings: { shadows: true },
    static: { count: 0 },
    surroundings: null,
    dynamicCount: 0,
    get canvas() {
      return renderer.domElement;
    },
    setStatic(a) {
      this.static.count = addMeshes(staticGroup, a, { shadows: true });
    },
    /** Background chunks: drawn and culled per chunk, no shadow pass (as the original backdrop). */
    setSurroundings(chunks) {
      let v = 0;
      for (const c of chunks) v += addMeshes(backdrop, c.a, { shadows: false });
      this.surroundings = { chunks: chunks.length, vertices: v };
    },
    async compile() {
      await renderer.compileAsync(scene, camera);
    },
    /** eye/target: camera; dynamicA: this frame's vertices; day: hours (15.7 → 18.75); rain 0..1. */
    render(eye, target, dynamicA, time, day, rain, isolated) {
      // Sky, fog and light colours follow the afternoon, the evening and the rain.
      const evening = clamp01((day - 16.0) / 2.1), night = clamp01((day - 17.1) / 1.8);
      let fr = lerp(0.66, 0.28, night), fg = lerp(0.72, 0.34, night), fb = lerp(0.69, 0.44, night);
      let tr = lerp(0.27, 0.1, night), tg = lerp(0.48, 0.18, night), tb = lerp(0.58, 0.29, night);
      let sr = lerp(0.79, 0.46, evening), sg = lerp(0.71, 0.32, evening), sb = lerp(0.55, 0.29, evening);
      let ar = lerp(0.52, 0.4, night), ag = lerp(0.59, 0.45, night), ab = lerp(0.59, 0.54, night);
      if (rain) {
        const f = 1 - rain * 0.1, s = 1 - rain * 0.2;
        fr *= f; fg *= f; fb *= f;
        sr *= s; sg *= s; sb *= s;
      }
      if (isolated) {
        [fr, fg, fb] = [0.1, 0.16, 0.17];
        [tr, tg, tb] = [0.07, 0.11, 0.13];
        [sr, sg, sb] = [0.89, 0.82, 0.65];
        [ar, ag, ab] = [0.63, 0.67, 0.65];
      }
      uFog.value.setRGB(fr, fg, fb);
      uTop.value.setRGB(tr, tg, tb);
      uSun.value.setRGB(sr, sg, sb);
      uAmbient.value.setRGB(ar, ag, ab);
      ambient.color.setRGB(ar * 0.7, ag * 0.7, ab * 0.7);
      fill.color.setRGB(ar * 0.3, ag * 0.3, ab * 0.3);
      sun.color.setRGB(sr, sg, sb);
      uTime.value = time;
      uRain.value = rain || 0;
      uIsolated.value = isolated ? 1 : 0;

      // The shadow box follows the camera in 8 m steps, so it does not swim.
      const fcx = isolated ? 0 : Math.round(eye[0] / 8) * 8, fcz = isolated ? 0 : Math.round(eye[2] / 8) * 8;
      sun.position.set(fcx - 65, 95, fcz + 45);
      sun.target.position.set(fcx, 0, fcz);
      sun.target.updateMatrixWorld();
      if (sun.castShadow !== !!this.settings.shadows) sun.castShadow = !!this.settings.shadows;

      staticGroup.visible = backdrop.visible = !isolated;

      // This frame's characters, vehicles and props: one streamed vertex buffer.
      const n = (dynamicA.length / STRIDE) | 0;
      if (dynamicBuilder.data !== dynArray) {
        // The builder grew: wrap its new, larger array.
        dynArray = dynamicBuilder.data;
        dyn.geometry.dispose();
        dyn = geometryFor(dynArray);
        dynMesh.geometry = dyn.geometry;
      }
      if (dynamicA.buffer !== dynArray.buffer) {
        // Not the builder's own memory (never expected): copy it in.
        dynamicBuilder.reset();
        dynamicBuilder.append(dynamicA);
        if (dynamicBuilder.data !== dynArray) return this.render(eye, target, dynamicBuilder.a, time, day, rain, isolated);
      }
      dyn.buffer.clearUpdateRanges();
      dyn.buffer.addUpdateRange(0, Math.max(STRIDE, n * STRIDE));
      dyn.buffer.needsUpdate = true;
      dyn.geometry.setDrawRange(0, n);
      dynMesh.visible = n > 0;
      this.dynamicCount = n;

      if (this.fov !== lastFov) {
        lastFov = this.fov;
        camera.fov = this.fov;
        camera.updateProjectionMatrix();
        uTan.value = Math.tan((this.fov * PI) / 360);
      }
      camera.position.set(eye[0], eye[1], eye[2]);
      camera.lookAt(target[0], target[1], target[2]);
      camera.updateMatrixWorld();
      sky.position.copy(camera.position);
      post.render();
    },
    /** World point → [x, y] in 0..1 screen units (y down), or null behind the camera. */
    project(p) {
      vec.set(p[0], p[1], p[2]).applyMatrix4(camera.matrixWorldInverse);
      if (-vec.z < 0.1) return null;
      vec.applyMatrix4(camera.projectionMatrix);
      return [vec.x * 0.5 + 0.5, 0.5 - vec.y * 0.5];
    },
  };
  return engine;
}
