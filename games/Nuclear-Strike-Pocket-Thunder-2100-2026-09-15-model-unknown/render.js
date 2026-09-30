/* Pocket Thunder 2100 — render layer.
   The game keeps its own light scene graph (Node: position, YXZ rotation, scale,
   colour, alpha, emission, roughness). This module draws it with three.js:
   one InstancedMesh per primitive shape (static props are uploaded once, moving
   things are re-packed every frame, transparent ones sorted back to front), a
   custom lighting model that reproduces the original toy shading (hemisphere
   fill, warm sun with PCF shadows, a small Blinn highlight, a teal rim), range
   fog, the animated ocean in TSL, and the original filmic tone curve in the
   kit's post chain. */

import * as THREE from 'three/webgpu';
import {
  attribute, float, vec2, vec3, vec4, mix, sin, cos, normalize, smoothstep, distance, saturate,
  positionWorld, cameraPosition, cameraViewMatrix, normalView, positionViewDirection, diffuseColor, fog, uniform,
} from 'three/tsl';
import { createPost } from 'kit/post.js';

export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const hypot = Math.hypot;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => {
  const d = hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / d, a[1] / d, a[2] / d];
};

export function identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
const IDENT = identity();

export function multiply(a, b, out) {
  for (let c = 0; c < 4; c++) {
    const i = c * 4;
    for (let r = 0; r < 4; r++) out[i + r] = a[r] * b[i] + a[4 + r] * b[i + 1] + a[8 + r] * b[i + 2] + a[12 + r] * b[i + 3];
  }
  return out;
}

/** Local matrix: translation · Ry · Rx · Rz · scale (column-major, like three.js). */
export function model(n) {
  const cy = Math.cos(n.ry), sy = Math.sin(n.ry), cx = Math.cos(n.rx), sx = Math.sin(n.rx), cz = Math.cos(n.rz), sz = Math.sin(n.rz);
  const o = n.local;
  o[0] = (cy * cz + sy * sx * sz) * n.sx;
  o[1] = cx * sz * n.sx;
  o[2] = (-sy * cz + cy * sx * sz) * n.sx;
  o[3] = 0;
  o[4] = (-cy * sz + sy * sx * cz) * n.sy;
  o[5] = cx * cz * n.sy;
  o[6] = (sy * sz + cy * sx * cz) * n.sy;
  o[7] = 0;
  o[8] = sy * cx * n.sz;
  o[9] = -sx * n.sz;
  o[10] = cy * cx * n.sz;
  o[11] = 0;
  o[12] = n.x;
  o[13] = n.y;
  o[14] = n.z;
  o[15] = 1;
  return o;
}

const WHITE = [1, 1, 1];

export class Node {
  constructor(parent = null, x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.rx = 0;
    this.ry = 0;
    this.rz = 0;
    this.sx = 1;
    this.sy = 1;
    this.sz = 1;
    this.visible = true;
    this.children = [];
    this.local = identity();
    this.world = identity();
    this.geo = null;
    this.col = WHITE;
    this.alpha = 1;
    this.emission = 0;
    this.rough = 0.8;
    this.cast = true;
    this.depth = 0;
    this.parent = parent;
    if (parent) parent.children.push(this);
  }
}

/* ---------------------------------------------------------------- geometry */

// Vertex data is a flat list of [x, y, z, nx, ny, nz, shade] per vertex, flat-shaded
// (every triangle carries its own face normal), exactly as the original built it.
export function triangle(data, a, b, c, shade = 1, normal = null) {
  const n = normal || norm(cross(sub(b, a), sub(c, a)));
  for (const p of [a, b, c]) data.push(p[0], p[1], p[2], n[0], n[1], n[2], shade);
}
export function quad(data, a, b, c, d, shade = 1) {
  triangle(data, a, b, c, shade);
  triangle(data, a, c, d, shade);
}
/** A convex polygon around the origin, wound so its face points away from the centre. */
export function outward(data, pts, shade = 1) {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  const ct = [0, 0, 0];
  for (const p of pts) {
    ct[0] += p[0];
    ct[1] += p[1];
    ct[2] += p[2];
  }
  if (dot(n, ct) < 0) pts.reverse();
  for (let i = 1; i < pts.length - 1; i++) triangle(data, pts[0], pts[i], pts[i + 1], shade);
}

let geoId = 0;
/** Turn vertex data into a shared BufferGeometry. `double` marks open shapes drawn from both sides. */
export function geometry(data, name, double = false) {
  const count = data.length / 7;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = data[i * 7];
    pos[i * 3 + 1] = data[i * 7 + 1];
    pos[i * 3 + 2] = data[i * 7 + 2];
    nor[i * 3] = data[i * 7 + 3];
    nor[i * 3 + 1] = data[i * 7 + 4];
    nor[i * 3 + 2] = data[i * 7 + 5];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return { id: geoId++, name, geometry: g, double, dyn: null };
}

function makeBox(bevel = 0.08) {
  const d = [];
  const h = 0.5;
  const k = h - bevel;
  for (let axis = 0; axis < 3; axis++)
    for (const s of [-1, 1]) {
      const other = [0, 1, 2].filter((i) => i !== axis);
      const p = [];
      for (const ab of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const v = [0, 0, 0];
        v[axis] = s * h;
        v[other[0]] = ab[0] * k;
        v[other[1]] = ab[1] * k;
        p.push(v);
      }
      outward(d, p);
    }
  for (let axis = 0; axis < 3; axis++) {
    const [a, b] = [0, 1, 2].filter((i) => i !== axis);
    for (const s of [-1, 1])
      for (const t of [-1, 1]) {
        const p = [];
        for (const q of [[h, k, -k], [k, h, -k], [k, h, k], [h, k, k]]) {
          const v = [0, 0, 0];
          v[a] = s * q[0];
          v[b] = t * q[1];
          v[axis] = q[2];
          p.push(v);
        }
        outward(d, p);
      }
  }
  for (const a of [-1, 1])
    for (const b of [-1, 1])
      for (const c of [-1, 1])
        outward(d, [
          [a * h, b * k, c * k],
          [a * k, b * h, c * k],
          [a * k, b * k, c * h],
        ]);
  return geometry(d, 'box');
}

function makeCylinder(n = 10, rt = 1, rb = 1, name = 'cylinder') {
  const d = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const b = ((i + 1) / n) * TAU;
    const p = [Math.cos(a) * rb, -0.5, Math.sin(a) * rb];
    const q = [Math.cos(b) * rb, -0.5, Math.sin(b) * rb];
    const r = [Math.cos(b) * rt, 0.5, Math.sin(b) * rt];
    const s = [Math.cos(a) * rt, 0.5, Math.sin(a) * rt];
    quad(d, p, s, r, q);
    triangle(d, [0, 0.5, 0], r, s);
    triangle(d, [0, -0.5, 0], p, q);
  }
  return geometry(d, name);
}

function makeSphere(seg = 8, rings = 5) {
  const d = [];
  const f = (a, b) => [Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b)];
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rings; j++) {
      const a = (i / seg) * TAU;
      const b = ((i + 1) / seg) * TAU;
      const u = (j / rings) * PI;
      const v = ((j + 1) / rings) * PI;
      outward(d, [f(a, u), f(a, v), f(b, v), f(b, u)]);
    }
  return geometry(d, 'sphere');
}

// A flat ring facing up (the original faced down and relied on culling being off).
function makeRing(n = 48, inner = 0.9) {
  const d = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const b = ((i + 1) / n) * TAU;
    quad(
      d,
      [Math.cos(a) * inner, 0, Math.sin(a) * inner],
      [Math.cos(b) * inner, 0, Math.sin(b) * inner],
      [Math.cos(b), 0, Math.sin(b)],
      [Math.cos(a), 0, Math.sin(a)]
    );
  }
  return geometry(d, 'ring');
}

export const boxGeo = makeBox();
export const cylGeo = makeCylinder();
export const coneGeo = makeCylinder(7, 0.02, 1, 'cone');
export const sphereGeo = makeSphere();
export const ringGeo = makeRing();
export const planeGeo = geometry(
  [-0.5, 0, -0.5, 0, 1, 0, 1, -0.5, 0, 0.5, 0, 1, 0, 1, 0.5, 0, 0.5, 0, 1, 0, 1, -0.5, 0, -0.5, 0, 1, 0, 1, 0.5, 0, 0.5, 0, 1, 0, 1, 0.5, 0, -0.5, 0, 1, 0, 1],
  'plane'
);
export const leafGeo = (() => {
  const d = [];
  quad(d, [0, 0, 0], [0.42, 0.16, -0.16], [1, -0.19, 0], [0.44, 0.16, 0.16]);
  triangle(d, [0, 0, 0], [0.44, 0.16, 0.16], [1, -0.19, 0]);
  return geometry(d, 'leaf', true);
})();

/* ---------------------------------------------------------------- lighting */

const LINEAR = THREE.LinearSRGBColorSpace;
// The original sun colour; the highlight is tinted relative to it.
const SUN_BASE = [1.4, 1.27, 1.06];
const SPEC_TINT = vec3(1 / SUN_BASE[0], 0.95 / SUN_BASE[1], 0.76 / SUN_BASE[2]);
const RIM = vec3(0.12, 0.22, 0.24);

/** The original shading: diffuse × sun without the 1/π of three.js, a Blinn highlight
 *  whose size and strength follow the per-object roughness. Hemisphere fill uses Phong's
 *  indirect term (the light carries π so the numbers match). */
class ToyLighting extends THREE.PhongLightingModel {
  constructor(rough) {
    super(false);
    this.rough = rough;
  }
  direct({ lightDirection, lightColor, reflectedLight }) {
    const n = normalView;
    const ndl = n.dot(lightDirection).clamp();
    reflectedLight.directDiffuse.addAssign(ndl.mul(lightColor).mul(diffuseColor.rgb));
    const h = positionViewDirection.add(lightDirection).normalize();
    const r = this.rough;
    const spec = n.dot(h).max(0).pow(mix(float(85), float(13), r)).mul(float(1).sub(r)).mul(0.38);
    reflectedLight.directSpecular.addAssign(lightColor.mul(SPEC_TINT).mul(spec));
  }
}

class ToyMaterial extends THREE.MeshPhongNodeMaterial {
  constructor(rough) {
    super();
    this.toyRough = rough;
  }
  setupLightingModel() {
    return new ToyLighting(this.toyRough);
  }
}

/** Colour and extras come from per-instance attributes (instances) or vertex colour (islands). */
function toyMaterial(vertexColour, transparent, double) {
  const col = vertexColour ? attribute('color', 'vec4') : attribute('iColor', 'vec4');
  const extra = vertexColour ? vec2(0, 0.8) : attribute('iExtra', 'vec2'); // emission, roughness
  const rough = extra.y;
  const m = new ToyMaterial(rough);
  m.colorNode = col;
  const facing = normalView.dot(positionViewDirection).max(0);
  const rim = float(1).sub(facing).pow(4).mul(float(1).sub(rough)).mul(0.3);
  m.emissiveNode = col.rgb.mul(extra.x).add(RIM.mul(rim));
  m.side = double ? THREE.DoubleSide : THREE.FrontSide;
  if (transparent) {
    m.transparent = true;
    m.depthWrite = false;
  }
  return m;
}

/* ---------------------------------------------------------------- the view */

// Draw order inside the transparent pass: ground decals first, then puffs, then sparks.
const TRANS_ORDER = { ring: 2, sphere: 3, box: 4 };

export function createView(kit) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.NoToneMapping; // the post chain applies the original film curve
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const uFog = uniform(new THREE.Color().setRGB(0.13, 0.25, 0.26, LINEAR));
  scene.background = new THREE.Color().setRGB(0.13, 0.25, 0.26, LINEAR);
  scene.fogNode = fog(uFog, smoothstep(145, 340, distance(positionWorld, cameraPosition)).mul(0.67));

  const hemi = new THREE.HemisphereLight();
  hemi.intensity = Math.PI;
  const sun = new THREE.DirectionalLight();
  sun.intensity = 1;
  const SUN = norm([-45, 85, -35]);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -75;
  sc.right = 75;
  sc.top = 75;
  sc.bottom = -75;
  sc.near = 1;
  sc.far = 220;
  sc.updateProjectionMatrix();
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.intensity = 0.82; // shadowed ground keeps 18 % of the sun, like the original
  kit.shadow(sun, 2048); // 512 low, 1024 medium, 2048 high — the original's three settings
  scene.add(hemi, sun, sun.target);

  function setAtmosphere(sky, ground, sunCol, fogCol) {
    hemi.color.setRGB(sky[0] * 0.74, sky[1] * 0.74, sky[2] * 0.74, LINEAR);
    hemi.groundColor.setRGB(ground[0] * 0.74, ground[1] * 0.74, ground[2] * 0.74, LINEAR);
    sun.color.setRGB(sunCol[0], sunCol[1], sunCol[2], LINEAR);
    uFog.value.setRGB(fogCol[0], fogCol[1], fogCol[2], LINEAR);
    scene.background.setRGB(fogCol[0], fogCol[1], fogCol[2], LINEAR);
  }
  setAtmosphere([0.72, 0.86, 0.84], [0.21, 0.25, 0.21], SUN_BASE, [0.13, 0.25, 0.26]);

  /* ---- materials */
  const mats = {};
  const materialFor = (geo, kind) => {
    const key = (kind === 2 ? 't' : 'o') + (geo.double ? 'd' : 'f');
    return mats[key] || (mats[key] = toyMaterial(false, kind === 2, geo.double));
  };
  const surfaceSolid = toyMaterial(true, false, true);
  const surfaceClear = toyMaterial(true, true, true);

  // The ocean: slow cross-waves bend the normal, drifting darker patches and sharp glints.
  const uTime = uniform(0);
  const wp = positionWorld;
  const wa = sin(wp.x.mul(0.24).add(wp.z.mul(0.11)).add(uTime.mul(0.58)));
  const wb = cos(wp.z.mul(0.31).sub(wp.x.mul(0.12)).sub(uTime.mul(0.39)));
  const waterNormal = normalize(vec3(wa.mul(0.09), 1, wb.mul(0.07)));
  const patches = sin(wp.x.mul(0.036).add(sin(wp.z.mul(0.042)).mul(1.5))).mul(0.5).add(0.5);
  const ripple = sin(wp.x.mul(0.95).add(wp.z.mul(0.29)).add(uTime.mul(0.56)))
    .mul(cos(wp.z.mul(0.72).sub(wp.x.mul(0.24)).sub(uTime.mul(0.34))))
    .max(0)
    .pow(28);
  const oceanLinear = [0x34, 0x7f, 0x87].map((v) => Math.pow(v / 255, 2.2));
  const waterBase = mix(vec3(...oceanLinear), vec3(0.037, 0.205, 0.205), patches.mul(0.3)).add(vec3(0.17, 0.23, 0.21).mul(ripple.mul(0.35)));
  const water = new ToyMaterial(float(0.23));
  water.colorNode = vec4(waterBase, 1);
  water.normalNode = cameraViewMatrix.mul(vec4(waterNormal, 0)).xyz.normalize();
  const toEye = cameraPosition.sub(wp).normalize();
  water.emissiveNode = RIM.mul(float(1).sub(waterNormal.dot(toEye).max(0)).pow(4).mul(0.77 * 0.3));
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), water);
  ocean.position.y = -0.17;
  ocean.receiveShadow = true;
  scene.add(ocean);

  /* ---- instanced batches */
  const mark = (attr, n) => {
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, n);
    attr.needsUpdate = true;
  };

  class Batch {
    constructor(geo, kind, cap) {
      this.geo = geo;
      this.kind = kind; // 0 opaque + shadow, 1 opaque, 2 transparent
      this.count = 0;
      this.cap = 0;
      this.mesh = null;
      this.alloc(Math.max(1, cap));
    }
    alloc(cap) {
      const old = this.mesh;
      const base = this.geo.geometry;
      const g = new THREE.BufferGeometry();
      // Own copies, so a batch that grows can dispose its old geometry safely.
      g.setAttribute('position', base.attributes.position.clone());
      g.setAttribute('normal', base.attributes.normal.clone());
      const col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
      const ext = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
      col.setUsage(THREE.DynamicDrawUsage);
      ext.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('iColor', col);
      g.setAttribute('iExtra', ext);
      const mesh = new THREE.InstancedMesh(g, materialFor(this.geo, this.kind), cap);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = this.kind === 0;
      mesh.receiveShadow = true;
      mesh.renderOrder = this.kind === 2 ? TRANS_ORDER[this.geo.name] || 5 : 0;
      mesh.count = 0;
      mesh.visible = false;
      if (old) {
        mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
        col.array.set(this.col.array.subarray(0, this.count * 4));
        ext.array.set(this.ext.array.subarray(0, this.count * 2));
        scene.remove(old);
        old.geometry.dispose();
        old.dispose();
      }
      this.mesh = mesh;
      this.col = col;
      this.ext = ext;
      this.cap = cap;
      scene.add(mesh);
    }
    push(n) {
      if (this.count >= this.cap) this.alloc(this.cap * 2);
      const i = this.count++;
      this.mesh.instanceMatrix.array.set(n.world, i * 16);
      const c = this.col.array;
      const k = i * 4;
      c[k] = n.col[0];
      c[k + 1] = n.col[1];
      c[k + 2] = n.col[2];
      c[k + 3] = n.alpha;
      const e = this.ext.array;
      e[i * 2] = n.emission;
      e[i * 2 + 1] = n.rough;
    }
    commit() {
      const m = this.mesh;
      const n = this.count;
      m.count = n;
      m.visible = n > 0;
      if (n) {
        mark(m.instanceMatrix, n * 16);
        mark(this.col, n * 4);
        mark(this.ext, n * 2);
      }
    }
  }

  /** Static props: grouped by shape and shadow flag, uploaded once. */
  function buildStatic(nodes) {
    const groups = new Map();
    for (const n of nodes) {
      const kind = n.alpha < 1 ? 2 : n.cast ? 0 : 1;
      const key = n.geo.id * 3 + kind;
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { geo: n.geo, kind, list: [] }));
      g.list.push(n);
    }
    for (const { geo, kind, list } of groups.values()) {
      const b = new Batch(geo, kind, list.length);
      for (const n of list) b.push(n);
      b.commit();
    }
  }

  /** Island slabs and shore bands: one merged mesh each, colour per vertex. */
  const surfaces = { solid: [], clear: [] };
  function addSurface(data, col, alpha) {
    const list = alpha < 1 ? surfaces.clear : surfaces.solid;
    for (let i = 0; i < data.length; i += 7) {
      const s = data[i + 6];
      list.push(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4], data[i + 5], col[0] * s, col[1] * s, col[2] * s, alpha);
    }
  }
  function buildSurfaces() {
    for (const [list, transparent] of [
      [surfaces.solid, false],
      [surfaces.clear, true],
    ]) {
      if (!list.length) continue;
      const count = list.length / 10;
      const pos = new Float32Array(count * 3);
      const nor = new Float32Array(count * 3);
      const col = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        const o = i * 10;
        for (let k = 0; k < 3; k++) {
          pos[i * 3 + k] = list[o + k];
          nor[i * 3 + k] = list[o + 3 + k];
        }
        for (let k = 0; k < 4; k++) col[i * 4 + k] = list[o + 6 + k];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 4));
      const m = new THREE.Mesh(g, transparent ? surfaceClear : surfaceSolid);
      m.castShadow = !transparent;
      m.receiveShadow = true;
      m.renderOrder = transparent ? 1 : 0;
      scene.add(m);
      list.length = 0;
    }
  }

  /* ---- dynamic scene: re-packed every frame */
  const dynBatches = [];
  const dynBatch = (geo, kind) => {
    const set = geo.dyn || (geo.dyn = [null, null, null]);
    let b = set[kind];
    if (!b) {
      b = set[kind] = new Batch(geo, kind, 32);
      dynBatches.push(b);
    }
    return b;
  };
  const trans = [];
  let fx = -0.533, fy = -0.659, fz = -0.533;
  const collect = (n, parent) => {
    if (!n.visible) return;
    multiply(parent, model(n), n.world);
    if (n.geo && n.alpha > 0.005) {
      if (n.alpha < 1) {
        n.depth = n.world[12] * fx + n.world[13] * fy + n.world[14] * fz;
        trans.push(n);
      } else dynBatch(n.geo, n.cast ? 0 : 1).push(n);
    }
    const ch = n.children;
    for (let i = 0; i < ch.length; i++) collect(ch[i], n.world);
  };
  const byDepth = (a, b) => b.depth - a.depth;

  // Pre-warm: one hidden instance (under the sea) per shape and pass for the first frames,
  // so the pipelines for sparks, smoke and fading rings compile while the loading card is up.
  const warm = [];
  for (const [geo, kinds] of [
    [boxGeo, [0, 1, 2]],
    [sphereGeo, [0, 1, 2]],
    [cylGeo, [0, 1]],
    [coneGeo, [0]],
    [ringGeo, [0, 1, 2]],
  ])
    for (const kind of kinds) {
      const n = new Node(null, 0, -80, 0);
      n.geo = geo;
      n.sx = n.sy = n.sz = 0.01;
      n.alpha = kind === 2 ? 0.5 : 1;
      n.cast = kind === 0;
      multiply(IDENT, model(n), n.world);
      warm.push({ n, kind });
    }
  let warmFrames = 3;

  function update(roots, time) {
    uTime.value = time;
    for (const b of dynBatches) b.count = 0;
    trans.length = 0;
    for (let i = 0; i < roots.length; i++) collect(roots[i], IDENT);
    if (warmFrames > 0) {
      warmFrames--;
      for (const w of warm) dynBatch(w.n.geo, w.kind).push(w.n);
    }
    trans.sort(byDepth);
    for (let i = 0; i < trans.length; i++) dynBatch(trans[i].geo, 2).push(trans[i]);
    for (const b of dynBatches) b.commit();
  }

  /* ---- camera: the original fixed isometric orthographic view */
  const camera = new THREE.OrthographicCamera(-50, 50, 30, -30, 0.1, 430);
  let lastW = 0, lastH = 0;
  function setView(eye, at, halfW, halfH, shadowX, shadowZ) {
    if (halfW !== lastW || halfH !== lastH) {
      lastW = halfW;
      lastH = halfH;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    }
    camera.position.set(eye[0], eye[1], eye[2]);
    camera.lookAt(at[0], at[1], at[2]);
    camera.updateMatrixWorld();
    const dx = at[0] - eye[0], dy = at[1] - eye[1], dz = at[2] - eye[2];
    const dl = hypot(dx, dy, dz) || 1;
    fx = dx / dl;
    fy = dy / dl;
    fz = dz / dl;
    // The shadow box follows the view, snapped to 1/8 unit so it does not shimmer.
    const cx = Math.round(shadowX * 8) / 8;
    const cz = Math.round(shadowZ * 8) / 8;
    sun.position.set(cx + SUN[0] * 120, SUN[1] * 120, cz + SUN[2] * 120);
    sun.target.position.set(cx, 0, cz);
  }

  const pv = new THREE.Vector3();
  const projected = { x: 0, y: 0, z: 0 };
  /** World point → CSS pixels on the canvas. Returns a shared object; read it before the next call. */
  function project(x, y, z) {
    pv.set(x, y, z).project(camera);
    projected.x = (pv.x * 0.5 + 0.5) * kit.size.width;
    projected.y = (-0.5 * pv.y + 0.5) * kit.size.height;
    projected.z = pv.z;
    return projected;
  }

  // The original tone curve (a fitted ACES filmic) with its 1.1 exposure; sRGB output follows.
  const film = (x) => saturate(x.mul(x.mul(2.51).add(0.03)).div(x.mul(x.mul(2.43).add(0.59)).add(0.14)));
  const post = createPost(kit, scene, camera, { output: (c) => vec4(film(c.rgb.mul(1.1)), 1) });

  return {
    scene,
    camera,
    sun,
    buildStatic,
    addSurface,
    buildSurfaces,
    update,
    setView,
    project,
    setAtmosphere,
    draw() {
      post.render();
    },
    async compile() {
      try {
        await renderer.compileAsync(scene, camera);
      } catch (err) {
        console.warn('Pipeline pre-compile skipped.', err);
      }
    },
    get calls() {
      return renderer.info.render.calls;
    },
  };
}
