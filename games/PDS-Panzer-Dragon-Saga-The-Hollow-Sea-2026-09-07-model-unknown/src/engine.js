/*
 * engine.js — the Hollow engine's building blocks, now on three.js r186.
 *
 * The original chapter drew flat-shaded, vertex-tinted low-poly meshes with a
 * hand-written WebGL 1 renderer. The same builders now produce THREE meshes:
 *   - Geo collects triangles (position, face normal, tint) and becomes a BufferGeometry.
 *   - Mat is the game's material record (tint, shading style, alpha, additive). Every
 *     Mat of one style shares one TSL node material; tint and alpha are per-object
 *     uniforms, so effects never create GPU materials mid-game.
 *   - mergeStatic() and bake() fold static props into one mesh per Mat.
 *   - skyColor() is the old fullscreen sky shader as a background node.
 * The retro look keeps the original's recipe: low-resolution lines through the kit's
 * pixelHeight, PS1 vertex snapping through kit/retro.js, and the old 2×2 colour dither
 * (retroOn) inside the materials and the sky.
 */
import * as THREE from 'three/webgpu';
import * as T from 'three/tsl';
import { vertexSnap } from 'kit/retro.js';

// The original renderer wrote its colours straight to the canvas, with no sRGB step.
THREE.ColorManagement.enabled = false;

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------ seeded random */

// The world, the dragon's wing tints and the rock shading all come from this
// sequence, so the call order matters: it keeps the chapter looking as it always did.
let seed = 63127;
export function reseed(s) {
  seed = s >>> 0;
}
export function rand() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
export const random = (a, b) => mix(a, b, rand());

export function hex(s) {
  if (Array.isArray(s)) return s;
  const n = parseInt(String(s).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/* ------------------------------------------------------------ materials */

/**
 * Shading styles (the old uType):
 *   0 solid, lit and grained   1 sand dunes   2 wing membrane
 *   3 glow (unlit, bright, fades into the haze instead of fogging)
 *   4 soft blob shadow
 */
export class Mat {
  constructor(color, type = 0, alpha = 1, add = false, fx = false) {
    this.hex = typeof color === 'string' ? color : null;
    this.color = hex(color);
    this.type = type;
    this.alpha = alpha;
    this.add = add;
    // Materials whose alpha animates (effects) are blended from the start.
    this.blend = add ? 'add' : alpha < 1 || fx ? 'alpha' : 'opaque';
  }
  /** Change the tint to a hex string; cheap enough to call every frame. */
  set(h) {
    if (h !== this.hex) {
      this.hex = h;
      this.color = hex(h);
    }
  }
}
export const material = (color, type = 0, alpha = 1, add = false, fx = false) => new Mat(color, type, alpha, add, fx);

const L1 = new THREE.Vector3(-0.6, 0.85, -0.45).normalize();
const L2 = new THREE.Vector3(-0.6, 0.8, -0.4).normalize();
const FOG = [0.71, 0.645, 0.535];

// Per-object tint and alpha, read from mesh.userData.mat when the mesh is drawn.
const uTint = T.uniform(new THREE.Color(1, 1, 1)).onObjectUpdate(({ object }, self) => {
  const m = object.userData.mat;
  if (m) self.value.setRGB(m.color[0], m.color[1], m.color[2]);
});
const uAlpha = T.uniform(1).onObjectUpdate(({ object }) => (object.userData.mat ? object.userData.mat.alpha : 1));

/** The retro vertex grid (half the internal resolution); huge when the retro look is off. */
export const snapGrid = T.uniform(new THREE.Vector2(1e5, 1e5));
/** 1 while the classic low-resolution look is on: the old 2×2 ordered dither to 31 levels. */
export const retroOn = T.uniform(1);

const hash3 = (p) => T.fract(T.sin(T.dot(p, T.vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
const hash2 = (p) => T.fract(T.sin(T.dot(p, T.vec2(12.9898, 78.233))).mul(43758.5453));

/** The original fragment dither: floor(c * 31 + d) / 31 with a 2×2 screen pattern. */
function retroDither(c) {
  const d = T.mod(T.screenCoordinate.x, 2).mul(0.5).add(T.mod(T.screenCoordinate.y, 2).mul(0.25));
  return T.mix(c, T.floor(c.mul(31).add(d)).div(31), retroOn);
}

/** The original fragment shader, one branch per style, as TSL. */
function shade(type) {
  const n = T.normalWorldGeometry;
  const wp = T.positionWorld;
  const pl = T.positionLocal;
  const grain = hash3(T.floor(wp.mul(2)));
  let light = T.float(0.57)
    .add(T.max(T.dot(n, T.vec3(L1.x, L1.y, L1.z)), 0).mul(0.47))
    .add(n.y.mul(0.09));
  let c = uTint.mul(T.attribute('color', 'vec3'));
  let a = uAlpha;
  if (type === 0) {
    c = c.mul(grain.mul(0.12).add(0.91));
  } else if (type === 1) {
    const wave = T.sin(
      wp.x.mul(0.5).add(wp.z.mul(0.34)).add(T.sin(wp.z.mul(0.015)).mul(8)).add(T.sin(wp.x.mul(0.024)).mul(4))
    );
    c = c.mul(T.float(0.92).add(wave.mul(0.095)).add(grain.mul(0.07)));
    const salt = T.sin(wp.x.mul(0.007).add(wp.z.mul(0.013))).add(T.sin(wp.x.mul(0.019).sub(wp.z.mul(0.006))));
    c = T.mix(c, T.vec3(0.73, 0.72, 0.58), T.smoothstep(1.32, 1.8, salt).mul(0.22));
  } else if (type === 2) {
    c = c.mul(T.float(0.87).add(T.abs(T.sin(pl.x.mul(4).add(pl.z.mul(0.8)))).mul(0.16)).add(grain.mul(0.04)));
    light = T.float(0.75).add(T.max(T.dot(n, T.vec3(L2.x, L2.y, L2.z)), 0).mul(0.38));
  } else if (type === 3) {
    light = T.float(1.35);
  } else if (type === 4) {
    const r = T.length(pl.xz);
    a = a.mul(T.max(T.float(1).sub(r.mul(r)), 0));
    light = T.float(1);
  }
  c = c.mul(light);
  const fog = T.smoothstep(120, 1200, T.length(wp.sub(T.cameraPosition)));
  if (type >= 3) a = a.mul(T.float(1).sub(fog.mul(0.75)));
  else c = T.mix(c, T.vec3(FOG[0], FOG[1], FOG[2]), fog);
  return { c: retroDither(c), a };
}

const materials = new Map();
/** The shared node material for a Mat's style and blending (seven exist in all). */
export function materialFor(m) {
  const key = `${m.type}|${m.blend}`;
  let out = materials.get(key);
  if (out) return out;
  // The old renderer never culled faces, and many of its meshes rely on that.
  out = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, fog: false });
  if (m.blend !== 'opaque') {
    out.transparent = true;
    out.depthWrite = false;
    if (m.blend === 'add') out.blending = THREE.AdditiveBlending;
  }
  const { c, a } = shade(m.type);
  out.colorNode = c;
  out.opacityNode = a;
  vertexSnap(out, { grid: snapGrid });
  out.name = `hollow-${key}`;
  materials.set(key, out);
  return out;
}

/* ------------------------------------------------------------ geometry */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const WHITE = [1, 1, 1];
const toV = (out, p) => (Array.isArray(p) ? out.set(p[0], p[1], p[2]) : out.copy(p));

/** Flat-shaded, vertex-tinted triangles; buffer() turns them into a BufferGeometry once. */
export class Geo {
  constructor() {
    this.data = [];
    this.buf = null;
  }
  tri(a, b, c, col = WHITE) {
    toV(_a, a);
    toV(_b, b);
    toV(_c, c);
    _e1.subVectors(_b, _a);
    _e2.subVectors(_c, _a);
    _e1.cross(_e2).normalize();
    const d = this.data;
    d.push(_a.x, _a.y, _a.z, _e1.x, _e1.y, _e1.z, col[0], col[1], col[2]);
    d.push(_b.x, _b.y, _b.z, _e1.x, _e1.y, _e1.z, col[0], col[1], col[2]);
    d.push(_c.x, _c.y, _c.z, _e1.x, _e1.y, _e1.z, col[0], col[1], col[2]);
    return this;
  }
  quad(a, b, c, d, col) {
    return this.tri(a, b, c, col).tri(a, c, d, col);
  }
  buffer() {
    if (this.buf) return this.buf;
    const d = this.data;
    const n = d.length / 9;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0, j = 0; i < d.length; i += 9, j += 3) {
      pos[j] = d[i];
      pos[j + 1] = d[i + 1];
      pos[j + 2] = d[i + 2];
      nor[j] = d[i + 3];
      nor[j + 1] = d[i + 4];
      nor[j + 2] = d[i + 5];
      col[j] = d[i + 6];
      col[j + 1] = d[i + 7];
      col[j + 2] = d[i + 8];
    }
    this.buf = geometryFrom(pos, nor, col);
    this.data = null;
    return this.buf;
  }
}

function geometryFrom(pos, nor, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export function sphereGeo(seg = 10, rings = 6) {
  const g = new Geo();
  const p = (ii, jj) => {
    const a = (ii / seg) * TAU;
    const b = (jj / rings) * Math.PI;
    return [Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)];
  };
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const v = 0.89 + rand() * 0.14;
      g.quad(p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1), [v, v, v]);
    }
  }
  return g;
}

export function boxGeo() {
  const g = new Geo();
  const p = [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]];
  for (const q of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]) g.quad(p[q[0]], p[q[1]], p[q[2]], p[q[3]]);
  return g;
}

export function tubeGeo(a, b, r1 = 1, r2 = r1, sides = 6) {
  const A = toV(new THREE.Vector3(), a);
  const B = toV(new THREE.Vector3(), b);
  const g = new Geo();
  const axis = new THREE.Vector3().subVectors(B, A).normalize();
  const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  const ring = (p, r, i) => {
    const t = (i / sides) * TAU;
    return p.clone().addScaledVector(u, Math.cos(t) * r).addScaledVector(v, Math.sin(t) * r);
  };
  for (let i = 0; i < sides; i++) {
    const aa = ring(A, r1, i);
    const bb = ring(A, r1, i + 1);
    const cc = ring(B, r2, i + 1);
    const dd = ring(B, r2, i);
    g.quad(aa, bb, cc, dd);
    g.tri(A, bb, aa);
    g.tri(B, dd, cc);
  }
  return g;
}

export function ringGeo(radius, width, segments = 64, from = 0, to = TAU) {
  const g = new Geo();
  const p = (r, t) => [Math.sin(t) * r, 0, Math.cos(t) * r];
  for (let i = 0; i < segments; i++) {
    const a = mix(from, to, i / segments);
    const b = mix(from, to, (i + 1) / segments);
    g.quad(p(radius, a), p(radius + width, a), p(radius + width, b), p(radius, b));
  }
  return g;
}

const shared = (geo) => {
  geo.buffer().userData.shared = true;
  return geo;
};
// Built in this order at load (the seeded sequence depends on it).
export const G_SPH = shared(sphereGeo());
export const G_ROCK = shared(sphereGeo(7, 4));
export const G_BOX = shared(boxGeo());
export const G_PULSE = shared(ringGeo(1, 0.026, 48));

/* ------------------------------------------------------------ scene helpers */

/** A transform node. The old engine composed rotations in Y·X·Z order. */
export function node() {
  const o = new THREE.Group();
  o.rotation.order = 'YXZ';
  return o;
}

export function mesh(geo, m) {
  const o = new THREE.Mesh(geo instanceof Geo ? geo.buffer() : geo, materialFor(m));
  o.rotation.order = 'YXZ';
  o.userData.mat = m;
  return o;
}

export function setMat(o, m) {
  o.userData.mat = m;
  o.material = materialFor(m);
}

/** Keep this node's own transform when the model is baked (it animates, toggles or is aimed at). */
export function dyn(o) {
  o.userData.dyn = true;
  return o;
}

export function ellipsoid(parent, x, y, z, sx, sy, sz, m, geo = G_SPH) {
  const o = mesh(geo, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  parent.add(o);
  return o;
}

export function block(parent, x, y, z, sx, sy, sz, m) {
  return ellipsoid(parent, x, y, z, sx, sy, sz, m, G_BOX);
}

export function rod(parent, a, b, r1, r2, m, sides = 6) {
  const o = mesh(tubeGeo(a, b, r1, r2, sides), m);
  parent.add(o);
  return o;
}

export function worldPoint(o, local = null, out = new THREE.Vector3()) {
  o.updateWorldMatrix(true, false);
  return local ? out.copy(local).applyMatrix4(o.matrixWorld) : out.setFromMatrixPosition(o.matrixWorld);
}

/** Free the geometries under a node that belong to it alone. */
export function disposeTree(o) {
  o.traverse((c) => {
    if (c.isMesh && !c.geometry.userData.shared) c.geometry.dispose();
  });
}

/* ------------------------------------------------------------ merging */

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _nm = new THREE.Matrix3();
const _inv = new THREE.Matrix4();

function hasDyn(o) {
  if (o.userData.dyn) return true;
  for (const c of o.children) if (hasDyn(c)) return true;
  return false;
}

function collect(o, inv, out) {
  if (!o.visible) return;
  if (o.isMesh) out.push([o, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)]);
  for (const c of o.children) collect(c, inv, out);
}

function mergeEntries(entries) {
  const byMat = new Map();
  for (const e of entries) {
    const m = e[0].userData.mat;
    if (!byMat.has(m)) byMat.set(m, []);
    byMat.get(m).push(e);
  }
  const meshes = [];
  for (const [m, list] of byMat) {
    let count = 0;
    for (const [o] of list) count += o.geometry.attributes.position.count;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    let k = 0;
    for (const [o, mat4] of list) {
      const g = o.geometry;
      const P = g.attributes.position.array;
      const N = g.attributes.normal.array;
      const C = g.attributes.color.array;
      _nm.getNormalMatrix(mat4);
      for (let i = 0; i < P.length; i += 3, k += 3) {
        _v.set(P[i], P[i + 1], P[i + 2]).applyMatrix4(mat4);
        pos[k] = _v.x;
        pos[k + 1] = _v.y;
        pos[k + 2] = _v.z;
        _n.set(N[i], N[i + 1], N[i + 2]).applyMatrix3(_nm).normalize();
        nor[k] = _n.x;
        nor[k + 1] = _n.y;
        nor[k + 2] = _n.z;
        col[k] = C[i];
        col[k + 1] = C[i + 1];
        col[k + 2] = C[i + 2];
      }
    }
    meshes.push(mesh(geometryFrom(pos, nor, col), m));
  }
  for (const [o] of entries) if (!o.geometry.userData.shared) o.geometry.dispose();
  return meshes;
}

/** Merge everything under a detached root into one mesh per Mat (in the root's parent frame). */
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const entries = [];
  collect(root, new THREE.Matrix4(), entries);
  const out = node();
  for (const m of mergeEntries(entries)) out.add(m);
  return out;
}

/**
 * Fold the static parts of a model into its animated nodes: every node marked
 * dyn() keeps its transform, and everything else merges into one mesh per Mat
 * under the nearest animated parent. The dragon drops from about 90 draw calls to 30.
 */
export function bake(root) {
  root.updateMatrixWorld(true);
  bakeNode(root);
  return root;
}

function bakeNode(o) {
  const still = [];
  for (const c of o.children) {
    if (hasDyn(c)) bakeNode(c);
    else still.push(c);
  }
  if (!still.length || (still.length === 1 && still[0].isMesh && !still[0].children.length)) return;
  _inv.copy(o.matrixWorld).invert();
  const entries = [];
  for (const c of still) collect(c, _inv, entries);
  for (const c of still) o.remove(c);
  for (const m of mergeEntries(entries)) o.add(m);
}

/* ------------------------------------------------------------ sky */

export const skyTime = T.uniform(0);

/** The old sky shader (desert haze, faint cloud bands, sun disk) as a background node. */
export function skyColor() {
  const ray = T.normalWorldGeometry;
  const h = ray.y.clamp(0, 1);
  const base = T.mix(T.vec3(0.71, 0.645, 0.535), T.vec3(0.285, 0.385, 0.435), T.max(h, 0.0001).pow(0.48));
  const cloud = T.sin(ray.x.mul(8).add(ray.z.mul(12)).add(skyTime.mul(0.004)))
    .mul(T.sin(ray.z.mul(26).sub(ray.x.mul(13))))
    .add(T.sin(ray.x.mul(38).add(ray.z.mul(32))).mul(0.22));
  const band = T.smoothstep(0.18, 1.1, cloud).mul(T.smoothstep(0, 0.22, h)).mul(T.float(1).sub(T.smoothstep(0.08, 0.7, h)));
  let c = base.add(T.vec3(0.075, 0.063, 0.047).mul(band));
  const sun = new THREE.Vector3(-0.48, 0.24, -0.82).normalize();
  const d = T.length(ray.sub(T.vec3(sun.x, sun.y, sun.z)));
  c = c.add(T.vec3(0.24, 0.18, 0.085).mul(T.exp(d.mul(-10))));
  const disk = T.float(1).sub(T.smoothstep(0.039, 0.041, d));
  c = T.mix(c, T.vec3(0.99, 0.91, 0.67), disk.mul(0.91));
  const haze = T.exp(T.abs(ray.y).mul(-17));
  c = T.mix(c, T.vec3(0.75, 0.67, 0.55), haze.mul(0.25));
  // The sky's own retro noise: 63 levels with a per-pixel hash.
  const n = hash2(T.floor(T.screenCoordinate.xy));
  return T.mix(c, T.floor(c.mul(63).add(n.mul(0.7))).div(63), retroOn);
}
