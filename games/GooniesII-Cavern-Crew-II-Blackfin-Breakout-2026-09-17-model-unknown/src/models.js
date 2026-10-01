// Shared materials, the static-geometry batcher, the sign atlas and the low-poly characters.
import * as THREE from 'three/webgpu';
import { sin, positionLocal, time, vec3, mix, color, float, abs } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** A transform matrix: position, Euler rotation (XYZ, like Object3D) and scale. Load-time helper. */
export function m4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/**
 * Every material the game uses, created once and shared. `tint(hex)` hands out one cached
 * flat-shaded material per colour, so characters never create their own.
 */
export function createMaterials() {
  const mat = (c, extra = {}) => new THREE.MeshStandardMaterial({
    color: c,
    roughness: extra.roughness ?? 0.78,
    metalness: extra.metalness ?? 0.04,
    flatShading: extra.flatShading ?? true,
    transparent: extra.transparent ?? false,
    opacity: extra.opacity ?? 1,
    emissive: extra.emissive ?? 0x000000,
    emissiveIntensity: extra.emissiveIntensity ?? 0,
    side: extra.side ?? THREE.FrontSide
  });

  const m = {
    floor: mat(0x4b4438),
    floorAlt: mat(0x5b4b39),
    wetFloor: mat(0x344b52, { roughness: 0.55 }),
    wall: mat(0x3e3a35),
    wallAlt: mat(0x50473f),
    crackRock: mat(0x6a5d4f),
    rail: mat(0x6a5140, { roughness: 0.65 }),
    wood: mat(0x775033),
    darkWood: mat(0x4a2d20),
    metal: mat(0x7b8587, { metalness: 0.5, roughness: 0.38 }),
    rust: mat(0x8d4c2e, { metalness: 0.25 }),
    orange: mat(0xe1742f),
    gold: mat(0xf2bf49, { metalness: 0.35, roughness: 0.35, emissive: 0x4f2800, emissiveIntensity: 0.35 }),
    cyan: mat(0x49cad6, { emissive: 0x0d4a55, emissiveIntensity: 0.55 }),
    red: mat(0xc64f47),
    alarm: mat(0xd2493f, { emissive: 0x7a1510, emissiveIntensity: 0.9 }),
    green: mat(0x6da45d),
    blue: mat(0x4d79a8),
    cream: mat(0xe3d6b6),
    black: mat(0x15191c),
    skin: mat(0xc98e67),
    cloth: mat(0x365367),
    white: mat(0xe9eadf),
    moss: mat(0x56704a),
    slime: mat(0x9be05a, { emissive: 0x3c7a1a, emissiveIntensity: 0.8, roughness: 0.4 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb13b }),
    steam: new THREE.MeshBasicMaterial({ color: 0xdfe9ea, transparent: true, opacity: 0.34, depthWrite: false })
  };

  // Water ripple in TSL: the same node graph on WebGPU and on the WebGL2 fallback.
  const water = new THREE.MeshStandardNodeMaterial({
    color: 0x2b7485,
    roughness: 0.24,
    metalness: 0.04,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide
  });
  const rippleA = sin(positionLocal.x.mul(1.65).add(time.mul(1.7)));
  const rippleB = sin(positionLocal.y.mul(1.25).sub(time.mul(1.25)));
  const ripple = rippleA.add(rippleB).mul(0.035);
  water.positionNode = positionLocal.add(vec3(0, 0, ripple));
  water.colorNode = mix(color(0x235f70), color(0x54a9ad), ripple.mul(2.4).add(0.5));
  water.roughnessNode = float(0.23).add(abs(ripple).mul(1.6));
  m.water = water;

  const tints = new Map();
  m.tint = (hex) => {
    if (!tints.has(hex)) tints.set(hex, mat(hex, { roughness: 0.8 }));
    return tints.get(hex);
  };
  return m;
}

const KEEP = new Set(['position', 'normal', 'uv']);

/**
 * Collects the level's static pieces and merges them into one mesh per material (and
 * shadow setting). Hundreds of boxes become a dozen draw calls and a dozen shader variants.
 */
export class StaticBatch {
  constructor() {
    this.groups = new Map();
  }

  add(geometry, material, matrix, { cast = true, receive = true } = {}) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.morphAttributes = {};
    g.clearGroups();
    const key = `${material.uuid}|${cast ? 1 : 0}${receive ? 1 : 0}`;
    let entry = this.groups.get(key);
    if (!entry) this.groups.set(key, (entry = { material, cast, receive, parts: [] }));
    entry.parts.push(g);
    return this;
  }

  build(parent) {
    const meshes = [];
    for (const { material, cast, receive, parts } of this.groups.values()) {
      const merged = mergeGeometries(parts, false);
      for (const p of parts) p.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

/** One canvas texture holding every sign's text, one row each; `planeFor(i)` maps a plane onto row i. */
export function makeSignAtlas(texts) {
  let rows = 1;
  while (rows < texts.length) rows *= 2;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128 * rows;
  const ctx = c.getContext('2d');
  texts.forEach((text, i) => {
    const y0 = i * 128;
    ctx.fillStyle = '#56351f';
    ctx.fillRect(0, y0, 512, 128);
    ctx.strokeStyle = '#1d1713';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, y0 + 7, 512 - 14, 128 - 14);
    ctx.fillStyle = '#f5d58a';
    ctx.font = '700 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, y0 + 66);
  });
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  return {
    material,
    planeFor(i, width, height) {
      const geo = new THREE.PlaneGeometry(width, height);
      const uv = geo.attributes.uv;
      for (let v = 0; v < uv.count; v++) uv.setY(v, 1 - (i + 1) / rows + uv.getY(v) / rows);
      return geo;
    }
  };
}

function part(geo, material, x, y, z, parent, shadows = true) {
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = shadows;
  o.receiveShadow = shadows;
  parent.add(o);
  return o;
}

// Shared character geometry (built once; every kid and thug reuses it).
const KID = {
  body: new THREE.BoxGeometry(0.74, 0.78, 0.38),
  head: new THREE.BoxGeometry(0.58, 0.56, 0.54),
  cap: new THREE.BoxGeometry(0.64, 0.18, 0.59),
  brim: new THREE.BoxGeometry(0.52, 0.08, 0.26),
  pack: new THREE.BoxGeometry(0.54, 0.66, 0.22),
  arm: new THREE.BoxGeometry(0.18, 0.68, 0.2),
  leg: new THREE.BoxGeometry(0.22, 0.72, 0.25),
  shoe: new THREE.BoxGeometry(0.28, 0.16, 0.46)
};

export function createKid(m, colors) {
  const g = new THREE.Group();
  const shirt = m.tint(colors.shirt);
  const capMat = m.tint(colors.cap);
  const packMat = m.tint(colors.backpack);
  const body = part(KID.body, shirt, 0, 1.15, 0, g);
  const head = part(KID.head, m.skin, 0, 1.82, 0.02, g);
  const cap = part(KID.cap, capMat, 0, 2.12, 0, g);
  const brim = part(KID.brim, capMat, 0, 2.06, 0.35, g);
  const pack = part(KID.pack, packMat, 0, 1.18, -0.29, g);
  const limb = (x, y, geo, material, ly) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    g.add(pivot);
    part(geo, material, 0, ly, 0, pivot);
    return pivot;
  };
  const armL = limb(-0.48, 1.48, KID.arm, shirt, -0.28);
  const armR = limb(0.48, 1.48, KID.arm, shirt, -0.28);
  const legL = limb(-0.2, 0.78, KID.leg, m.black, -0.31);
  const legR = limb(0.2, 0.78, KID.leg, m.black, -0.31);
  part(KID.shoe, m.orange, -0.2, 0.11, 0.11, g);
  part(KID.shoe, m.orange, 0.2, 0.11, 0.11, g);
  g.scale.setScalar(colors.scale || 1);
  g.userData.parts = { body, head, cap, brim, pack, armL, armR, legL, legR };
  return g;
}

const ENEMY = {
  batBody: new THREE.OctahedronGeometry(0.35, 0),
  batWing: new THREE.BoxGeometry(0.8, 0.08, 0.4),
  batEar: new THREE.ConeGeometry(0.08, 0.26, 4),
  crabShell: new THREE.SphereGeometry(0.48, 8, 5),
  crabLeg: new THREE.BoxGeometry(0.55, 0.1, 0.12),
  eye: new THREE.OctahedronGeometry(0.09, 0),
  spitBody: new THREE.BoxGeometry(0.95, 0.62, 0.9),
  spitHead: new THREE.BoxGeometry(0.72, 0.44, 0.62),
  spitMouth: new THREE.OctahedronGeometry(0.17, 0),
  spitLeg: new THREE.BoxGeometry(0.2, 0.26, 0.24),
  spitBump: new THREE.BoxGeometry(0.3, 0.2, 0.3)
};
const thugGeo = new Map();
function thugGeometry(s) {
  if (!thugGeo.has(s)) {
    thugGeo.set(s, {
      body: new THREE.BoxGeometry(0.82 * s, 0.84 * s, 0.42 * s),
      head: new THREE.BoxGeometry(0.61 * s, 0.58 * s, 0.56 * s),
      hat: new THREE.BoxGeometry(0.66 * s, 0.14 * s, 0.6 * s),
      leg: new THREE.BoxGeometry(0.24 * s, 0.68 * s, 0.27 * s)
    });
  }
  return thugGeo.get(s);
}

export function createEnemy(m, e) {
  const g = new THREE.Group();
  if (e.type === 'bat') {
    const body = part(ENEMY.batBody, m.black, 0, 0, 0, g);
    const left = part(ENEMY.batWing, m.red, -0.48, 0.05, 0, g);
    const right = part(ENEMY.batWing, m.red, 0.48, 0.05, 0, g);
    left.rotation.z = 0.35;
    right.rotation.z = -0.35;
    part(ENEMY.batEar, m.cream, -0.15, 0.28, 0, g);
    part(ENEMY.batEar, m.cream, 0.15, 0.28, 0, g);
    g.userData.parts = { left, right, body };
    return g;
  }
  if (e.type === 'crab') {
    part(ENEMY.crabShell, m.rust, 0, 0.35, 0, g);
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) {
        const leg = part(ENEMY.crabLeg, m.metal, i * 0.47, 0.2, j * 0.28, g);
        leg.rotation.y = j * 0.4;
      }
    }
    part(ENEMY.eye, m.gold, -0.19, 0.56, 0.39, g);
    part(ENEMY.eye, m.gold, 0.19, 0.56, 0.39, g);
    return g;
  }
  if (e.type === 'spitter') {
    const body = part(ENEMY.spitBody, m.moss, 0, 0.44, 0, g);
    const head = new THREE.Group();
    head.position.set(0, 0.86, 0.16);
    g.add(head);
    part(ENEMY.spitHead, m.moss, 0, 0, 0, head);
    const mouth = part(ENEMY.spitMouth, m.slime, 0, -0.06, 0.32, head);
    part(ENEMY.eye, m.gold, -0.2, 0.2, 0.24, head);
    part(ENEMY.eye, m.gold, 0.2, 0.2, 0.24, head);
    part(ENEMY.spitBump, m.green, -0.2, 0.82, -0.25, g);
    part(ENEMY.spitBump, m.green, 0.22, 0.8, -0.05, g);
    for (let i = -1; i <= 1; i += 2) {
      for (let j = -1; j <= 1; j += 2) part(ENEMY.spitLeg, m.black, i * 0.36, 0.13, j * 0.3, g);
    }
    g.userData.parts = { body, head, mouth };
    return g;
  }
  const brute = e.type === 'brute';
  const s = brute ? 1.28 : 1;
  const geo = thugGeometry(s);
  const jacket = m.tint(brute ? 0x6d2b2a : 0x443f4e);
  const shirt = m.tint(brute ? 0xc08b4c : 0x8a3d45);
  const body = part(geo.body, jacket, 0, 1.1 * s, 0, g);
  part(geo.head, m.skin, 0, 1.8 * s, 0.02, g);
  part(geo.hat, shirt, 0, 2.09 * s, 0, g);
  const leg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * s, 0.72 * s, 0);
    g.add(pivot);
    part(geo.leg, m.black, 0, -0.3 * s, 0, pivot);
    return pivot;
  };
  const legL = leg(-0.22);
  const legR = leg(0.22);
  g.userData.parts = { body, legL, legR };
  return g;
}

/** The rescue cage both Mara and Dex sit in: a roof and six bars around a 3×3 floor. */
export function buildCage(m, parent) {
  const pieces = [];
  pieces.push(part(new THREE.BoxGeometry(3.0, 0.18, 3.0), m.metal, 0, 2.6, 0, parent));
  const bar = new THREE.BoxGeometry(0.12, 2.6, 0.12);
  for (let i = -1; i <= 1; i++) {
    pieces.push(part(bar, m.metal, i * 1.0, 1.3, 1.35, parent));
    pieces.push(part(bar, m.metal, i * 1.0, 1.3, -1.35, parent));
  }
  return pieces;
}
