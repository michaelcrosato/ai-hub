/**
 * models.js — materials, shared geometry and every model in Subterra Spark.
 *
 * All art is procedural low-poly geometry. Materials are shared across the
 * whole game (one material per look, never one per object), geometry is
 * cached by shape, and the static world of an area is merged into one mesh
 * per material by StaticBatch.
 */

import * as THREE from 'three/webgpu';
import { color, time, sin, uv, mix, positionWorld } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createMaterials() {
  const std = (p) => new THREE.MeshStandardMaterial(p);
  const mat = {
    soil: std({ color: 0x314a31, roughness: 0.92, metalness: 0.02 }),
    rock: std({ color: 0x334348, roughness: 0.94 }),
    darkRock: std({ color: 0x1c2a2f, roughness: 0.96 }),
    metal: std({ color: 0x455d64, roughness: 0.45, metalness: 0.72 }),
    darkMetal: std({ color: 0x1c2d34, roughness: 0.38, metalness: 0.8 }),
    orange: std({ color: 0xf17a33, roughness: 0.48, metalness: 0.35 }),
    cyan: std({ color: 0x28cbe0, emissive: 0x083f46, emissiveIntensity: 1.7, roughness: 0.35, metalness: 0.35 }),
    lime: std({ color: 0xa8e85c, emissive: 0x1e3e08, emissiveIntensity: 1.1, roughness: 0.5 }),
    magenta: std({ color: 0xe65bc5, emissive: 0x58154c, emissiveIntensity: 1.5, roughness: 0.35 }),
    enemy: std({ color: 0xd5543e, roughness: 0.48, metalness: 0.55 }),
    enemyDark: std({ color: 0x4b2527, roughness: 0.5, metalness: 0.62 }),
    white: std({ color: 0xd9f5f2, roughness: 0.45, metalness: 0.15 }),
    canopy: std({ color: 0x74e4e5, emissive: 0x092f36, emissiveIntensity: 1.2, roughness: 0.15, metalness: 0.25 }),
    water: new THREE.MeshPhysicalMaterial({
      color: 0x0b6d78, emissive: 0x062d34, emissiveIntensity: 1.1, transparent: true, opacity: 0.72,
      roughness: 0.18, metalness: 0.05, clearcoat: 0.7,
    }),
    // Area 02: the Ember Foundry.
    basalt: std({ color: 0x2c2220, roughness: 0.95, metalness: 0.03 }),
    slag: std({ color: 0x48352d, roughness: 0.9, metalness: 0.08 }),
    amber: std({ color: 0xffa340, emissive: 0x6a2a04, emissiveIntensity: 1.6, roughness: 0.4, metalness: 0.3 }),
  };

  // Phase gate (cyan) and heat field (orange): the original animated TSL curtain.
  const curtain = (hex) => {
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const wave = sin(time.mul(4.0).add(uv().y.mul(28.0))).mul(0.14).add(0.74);
    m.colorNode = color(hex).mul(wave);
    m.opacityNode = wave.mul(0.48);
    return m;
  };
  mat.gate = curtain(0x47eaff);
  mat.heatGate = curtain(0xff7a2a);

  // Lava: two crossing sine flows in world space, so every pool and trench lines up.
  const lava = new THREE.MeshBasicNodeMaterial();
  const px = positionWorld.x;
  const pz = positionWorld.z;
  const a = sin(px.mul(0.9).add(time.mul(1.2)).add(sin(pz.mul(0.7).sub(time.mul(0.5))).mul(1.8)));
  const b = sin(pz.mul(1.3).sub(time.mul(0.9)).add(px.mul(0.35)));
  const heat = a.mul(b).mul(0.5).add(0.5);
  lava.colorNode = mix(color(0x5a0c03), color(0xffa040), heat.pow(1.6)).mul(1.4);
  mat.lava = lava;

  // Sparks take their colour per instance; warning rings mark mortar and burrower strikes.
  mat.spark = new THREE.MeshBasicMaterial({ color: 0xffffff });
  mat.warn = new THREE.MeshBasicMaterial({ color: 0xff3b6b, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  return mat;
}

/** A sign board material: the original canvas label, one texture per sign. */
export function signMaterial(text, { fg = '#d9fbff', bg = '#0a1f26', edge = '#48dcec' } = {}) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 8;
  ctx.strokeRect(5, 5, c.width - 10, c.height - 10);
  ctx.font = '900 50px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text, c.width / 2, c.height / 2 + 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: t });
}

const KEEP = new Set(['position', 'normal', 'uv']);

/**
 * Collects static geometry per material and merges it: an area's floor, rocks,
 * walls, bridges and props draw in about a dozen calls instead of hundreds.
 */
export class StaticBatch {
  constructor() {
    this.buckets = new Map();
  }

  add(geometry, material, matrix, cast = true) {
    const key = `${material.id}:${cast ? 1 : 0}`;
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { material, cast, list: [] }));
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!KEEP.has(name)) g.deleteAttribute(name);
    g.morphAttributes = {};
    g.clearGroups();
    g.applyMatrix4(matrix);
    b.list.push(g);
  }

  build(parent) {
    const meshes = [];
    for (const b of this.buckets.values()) {
      const merged = b.list.length === 1 ? b.list[0] : mergeGeometries(b.list, false);
      if (b.list.length > 1) for (const g of b.list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const m = new THREE.Mesh(merged, b.material);
      m.castShadow = b.cast;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      parent.add(m);
      meshes.push(m);
    }
    this.buckets.clear();
    return meshes;
  }
}

export function createModels(mat) {
  const cache = new Map();
  const geo = (key, make) => {
    let g = cache.get(key);
    if (!g) cache.set(key, (g = make()));
    return g;
  };
  const G = {
    box: (w = 1, h = 1, d = 1) => geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
    cyl: (r = 1, h = 1, s = 10) => geo(`cyl:${r}:${h}:${s}`, () => new THREE.CylinderGeometry(r, r, h, s)),
    oct: (r = 1) => geo(`oct:${r}`, () => new THREE.OctahedronGeometry(r, 0)),
    ico: (r = 1) => geo(`ico:${r}`, () => new THREE.IcosahedronGeometry(r, 0)),
    dod: (r = 1) => geo(`dod:${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
    tet: (r = 1) => geo(`tet:${r}`, () => new THREE.TetrahedronGeometry(r, 0)),
    cone: (r, h, s) => geo(`cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s)),
    torus: (R, t, rs, ts) => geo(`tor:${R}:${t}:${rs}:${ts}`, () => new THREE.TorusGeometry(R, t, rs, ts)),
    plane: (w, h) => geo(`plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
    ring: (a, b, s) => geo(`ring:${a}:${b}:${s}`, () => new THREE.RingGeometry(a, b, s)),
  };

  const part = (parent, geometry, material, x = 0, y = 0, z = 0, cast = true) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  function rover() {
    const g = new THREE.Group();
    g.name = 'Crawler';
    const body = new THREE.Group();
    g.add(body);
    part(body, G.box(2.25, 0.62, 3.0), mat.cyan, 0, 0.62, 0);
    part(body, G.box(1.75, 0.45, 2.2), mat.darkMetal, 0, 0.35, 0);
    part(body, G.box(1.35, 0.58, 1.28), mat.canopy, 0, 1.08, -0.15);
    const wheels = [];
    for (const x of [-1.15, 1.15]) {
      for (const z of [-1.02, 1.02]) {
        // Spin about the axle: tilt last (Z), spin first (Y).
        const w = part(g, G.cyl(0.48, 0.42, 10), mat.darkMetal, x, 0.43, z);
        w.rotation.order = 'ZYX';
        w.rotation.z = Math.PI / 2;
        wheels.push(w);
        const hub = part(g, G.cyl(0.19, 0.46, 10), mat.orange, x, 0.43, z);
        hub.rotation.z = Math.PI / 2;
      }
    }
    const turret = new THREE.Group();
    turret.position.y = 1.34;
    body.add(turret);
    part(turret, G.cyl(0.48, 0.25, 10), mat.darkMetal);
    part(turret, G.box(0.24, 0.22, 1.7), mat.orange, 0, 0, 0.85);
    const muzzle = part(turret, G.box(0.36, 0.35, 0.34), mat.cyan, 0, 0, 1.72);
    g.userData = { body, turret, muzzle, wheels };
    return g;
  }

  function pilot() {
    const g = new THREE.Group();
    g.name = 'Pilot';
    const body = new THREE.Group();
    g.add(body);
    part(body, G.box(0.72, 0.85, 0.45), mat.white, 0, 0.92, 0);
    part(body, G.box(0.76, 0.35, 0.5), mat.orange, 0, 1.05, 0);
    part(body, G.box(0.55, 0.5, 0.52), mat.cyan, 0, 1.62, 0);
    part(body, G.box(0.2, 0.2, 0.9), mat.darkMetal, 0.42, 1.05, 0.3);
    part(body, G.box(0.62, 0.65, 0.28), mat.darkMetal, 0, 0.98, -0.36);
    const legs = [];
    for (const x of [-0.18, 0.18]) legs.push(part(g, G.box(0.22, 0.5, 0.26), mat.darkMetal, x, 0.25, 0));
    g.userData = { body, legs };
    return g;
  }

  function skitter() {
    const g = new THREE.Group();
    part(g, G.box(1.05, 0.48, 1.3), mat.enemy, 0, 0.55, 0);
    part(g, G.box(0.38, 0.2, 0.18), mat.magenta, 0, 0.67, 0.72);
    for (const x of [-0.65, 0.65]) {
      for (const z of [-0.42, 0.42]) {
        const leg = part(g, G.box(0.5, 0.16, 0.18), mat.enemyDark, x, 0.25, z);
        leg.rotation.z = x < 0 ? -0.25 : 0.25;
      }
    }
    return g;
  }

  function turret() {
    const g = new THREE.Group();
    part(g, G.cyl(0.65, 0.7, 8), mat.enemyDark, 0, 0.35, 0);
    part(g, G.oct(0.54), mat.enemy, 0, 0.85, 0);
    part(g, G.box(0.2, 0.2, 1.1), mat.orange, 0, 0.85, 0.45);
    return g;
  }

  /** Area 02: a spring-legged drone that crouches, then leaps onto the player. */
  function hopper() {
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    const shell = part(body, G.ico(0.55), mat.enemy, 0, 0.78, 0);
    shell.scale.set(1, 0.82, 1.15);
    part(body, G.box(0.44, 0.16, 0.16), mat.magenta, 0, 0.86, 0.58);
    part(body, G.box(0.9, 0.12, 0.5), mat.orange, 0, 0.5, -0.05);
    for (const x of [-0.48, 0.48]) {
      const leg = part(body, G.box(0.16, 0.72, 0.42), mat.enemyDark, x, 0.36, -0.22);
      leg.rotation.x = 0.5;
    }
    g.userData = { body };
    return g;
  }

  /** Area 02: a squat launcher that lobs shells at a marked spot. */
  function mortar() {
    const g = new THREE.Group();
    part(g, G.cyl(0.78, 0.5, 8), mat.enemyDark, 0, 0.25, 0);
    part(g, G.dod(0.5), mat.enemy, 0, 0.72, 0);
    const tube = part(g, G.cyl(0.22, 1.15, 8), mat.orange, 0, 1.08, 0.24);
    tube.rotation.x = 0.55;
    part(g, G.box(0.32, 0.14, 0.14), mat.magenta, 0, 0.78, 0.5);
    g.userData = { tube };
    return g;
  }

  function enemy(type) {
    if (type === 'turret') return turret();
    if (type === 'hopper') return hopper();
    if (type === 'mortar') return mortar();
    return skitter();
  }

  /** Area 01 boss: the M.O.L.E. excavation engine (the original model). */
  function mole() {
    const g = new THREE.Group();
    g.name = 'MOLE';
    const body = part(g, G.dod(2.3), mat.enemyDark, 0, 1.8, 0);
    body.scale.set(1.25, 0.8, 1.25);
    const ring = part(g, G.torus(2.35, 0.26, 8, 16), mat.orange, 0, 1.8, 0);
    ring.rotation.x = Math.PI / 2;
    const core = part(g, G.oct(0.88), mat.magenta, 0, 1.8, 2.05);
    const drill = part(g, G.cone(0.8, 2.8, 9), mat.metal, 0, 1.5, 3.05);
    drill.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const leg = part(g, G.box(0.42, 0.5, 2.8), mat.enemy, Math.sin(a) * 2.2, 0.65, Math.cos(a) * 2.2);
      leg.rotation.y = a;
    }
    g.userData = { core, ring, drill };
    return g;
  }

  /** Area 02 boss: the T.H.R.E.S.H. burrower, a segmented worm. Parts are placed in world space. */
  function worm() {
    const g = new THREE.Group();
    g.name = 'THRESH';
    const head = new THREE.Group();
    g.add(head);
    const skull = part(head, G.dod(1.35), mat.enemyDark);
    skull.scale.set(1, 0.85, 1.15);
    part(head, G.torus(1.05, 0.2, 8, 16), mat.orange, 0, 0, 0.95);
    const core = part(head, G.oct(0.62), mat.magenta, 0, 0, 0.95);
    for (const s of [-1, 1]) {
      const fang = part(head, G.cone(0.28, 1.3, 6), mat.metal, s * 0.75, -0.2, 1.35);
      fang.rotation.x = Math.PI / 2;
      fang.rotation.z = -s * 0.35;
    }
    const segs = [];
    for (let i = 0; i < 7; i++) {
      const s = part(g, G.ico(1), i % 2 ? mat.enemyDark : mat.enemy);
      s.scale.setScalar(1.15 - i * 0.07);
      segs.push(s);
    }
    const mound = new THREE.Group();
    g.add(mound);
    const heap = part(mound, G.cone(1.7, 0.7, 9), mat.slag, 0, 0.2, 0);
    heap.receiveShadow = true;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const r = part(mound, G.ico(1), mat.darkRock, Math.cos(a) * 1.5, 0.15, Math.sin(a) * 1.5);
      r.scale.setScalar(0.32);
    }
    g.userData = { head, core, segs, mound };
    return g;
  }

  function pickup(type) {
    const g = new THREE.Group();
    const m = type === 'health' ? mat.lime : type === 'item' ? mat.cyan : mat.orange;
    part(g, type === 'item' ? G.oct(0.65) : G.dod(0.35), m, 0, 0.7, 0);
    if (type === 'item') {
      const r = part(g, G.torus(0.85, 0.08, 6, 16), mat.white, 0, 0.7, 0);
      r.rotation.x = Math.PI / 2;
    }
    return g;
  }

  /** The magenta crystal nest of Area 01 (eight crystals, seeded layout). */
  function crystals(rand) {
    const g = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const c = part(g, G.oct(1), mat.magenta);
      c.scale.setScalar(0.65 + rand() * 0.28);
      c.position.set((rand() - 0.5) * 1.4, 0.55 + rand() * 0.5, (rand() - 0.5) * 4.2);
      c.rotation.set(rand(), rand(), rand());
    }
    return g;
  }

  /** Area 02: a slag pylon that feeds the heat field. */
  function pylon() {
    const g = new THREE.Group();
    part(g, G.cyl(0.95, 0.5, 8), mat.darkMetal, 0, 0.25, 0);
    part(g, G.cyl(0.4, 2.6, 8), mat.slag, 0, 1.5, 0);
    for (const y of [1.3, 2.1]) {
      const coil = part(g, G.torus(0.56, 0.12, 6, 12), mat.orange, 0, y, 0);
      coil.rotation.x = Math.PI / 2;
    }
    const core = part(g, G.oct(0.52), mat.amber, 0, 3.15, 0);
    g.userData = { core };
    return g;
  }

  return { G, part, rover, pilot, enemy, mole, worm, pickup, crystals, pylon };
}
