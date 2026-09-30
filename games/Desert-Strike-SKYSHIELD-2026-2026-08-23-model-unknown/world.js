/**
 * world.js — the ground Nightjar flies over.
 *
 * WHITE NOON streams a 15×15 grid of deterministic 92-unit mission tiles
 * (5×5 around the aircraft at a time). Each tile's props are merged into a
 * handful of meshes per material, so a tile costs a few draw calls instead of
 * the fifteen-plus meshes the original mounted. Tiles are built once and kept.
 *
 * The other operations are 128-unit local theaters. They gain landmarks at
 * their objectives and a road for escort columns; LOW TIDE's sea shimmers.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { color as tslColor, mix, sin, time, positionWorld, smoothstep } from 'three/tsl';
import { GEO, std, basic, mesh } from './models.js';
import { BIOMES, isStream, tileData, tilesAround, tileKey, escortPoint, lcg, hashString } from './data.js';

const PI = Math.PI;

/* ------------------------------------------------ materials of the desert tiles */

const M = {
  dune: ['#8f5838', '#9d6540', '#a86d45', '#7d4b35'].map((c) => std(c, { roughness: 0.97, flatShading: true })),
  rock: ['#6d4637', '#80503a', '#5f4037', '#9a6545'].map((c) => std(c, { roughness: 0.9, flatShading: true })),
  struct: ['#594a40', '#716052', '#493d37', '#8b735d'].map((c) => std(c, { roughness: 0.78, metalness: 0.12, flatShading: true })),
  dark: std('#17323a', { roughness: 0.32, metalness: 0.72 }),
  tent: std('#d6b27e', { roughness: 0.86, flatShading: true }),
  water: std('#2f8d91', { roughness: 0.24, metalness: 0.12, transparent: true, opacity: 0.74 }),
  road: std('#543c31', { roughness: 1 }),
  ground: ['#9a633f', '#a66d46', '#8d5739', '#a06843'].map((c) => std(c, { roughness: 1 })),
  salt: std('#b88a61', { roughness: 1 }),
  basalt: std('#744a36', { roughness: 1 }),
  reservoir: std('#8a624b', { roughness: 1 }),
  oasis: std('#93633f', { roughness: 1 }),
  mark: basic('#e7c58f'),
  solarRing: basic('#65c6b4', { transparent: true, opacity: 0.45 }),
  dome: std('#d8c7aa', { transparent: true, opacity: 0.38, wireframe: true }),
  reservoirRing: basic('#563f35'),
};

const TILE_PLANE = new THREE.PlaneGeometry(92.5, 92.5);
const flat = (g) => (g.index ? g.toNonIndexed() : g);
const NI = { box: flat(GEO.box), dodeca: flat(GEO.dodeca), cyl8: flat(GEO.cyl8), cone4: flat(GEO.cone4), sphere: flat(GEO.sphere) };

function groundMaterial(tile) {
  const k = tile.kind;
  return k === 'salt-flat' || k === 'salt-rail-causeway'
    ? M.salt
    : k === 'wadi' || k === 'basalt-canyon-convoy'
      ? M.basalt
      : k === 'dry-reservoir-arena'
        ? M.reservoir
        : k === 'oasis-fringe'
          ? M.oasis
          : M.ground[tile.tone];
}

const propGeometry = (k) =>
  k === 'dune' || k === 'rock' || k === 'mesa' ? NI.dodeca : k === 'tower' || k === 'tank' || k === 'palm' || k === 'pipe' ? NI.cyl8 : k === 'dish' ? NI.sphere : k === 'tent' ? NI.cone4 : NI.box;

const propMaterial = (p) =>
  p.kind === 'panel' || p.kind === 'dish'
    ? M.dark
    : p.kind === 'tent'
      ? M.tent
      : p.kind === 'dune'
        ? M.dune[p.tone]
        : p.kind === 'rock' || p.kind === 'mesa'
          ? M.rock[p.tone]
          : M.struct[p.tone];

/* ------------------------------------------------ merging static props */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** items: { geo (non-indexed), mat, cast, p:[x,y,z], r:[x,y,z], s:[x,y,z] } → a few merged meshes. */
function mergeProps(items) {
  const groups = new Map();
  for (const it of items) {
    const key = `${it.mat.id}:${it.cast ? 1 : 0}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { mat: it.mat, cast: it.cast, geos: [] }));
    _e.set(it.r[0], it.r[1], it.r[2]);
    _q.setFromEuler(_e);
    _m4.compose(_p.set(it.p[0], it.p[1], it.p[2]), _q, _s.set(it.s[0], it.s[1], it.s[2]));
    const geo = it.geo.clone();
    geo.applyMatrix4(_m4);
    g.geos.push(geo);
  }
  const out = [];
  for (const g of groups.values()) {
    const merged = mergeGeometries(g.geos, false);
    for (const geo of g.geos) geo.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, g.mat);
    m.castShadow = g.cast;
    m.receiveShadow = true;
    out.push(m);
  }
  return out;
}

/* ------------------------------------------------ mission set pieces */

function setpiece(kind) {
  const g = new THREE.Group();
  let light = null;
  switch (kind) {
    case 'relief-airstrip': {
      const strip = new THREE.Group();
      strip.position.y = 0.045;
      strip.add(mesh(GEO.plane, M.road, { r: [-PI / 2, 0, 0], s: [16, 68, 1] }));
      for (const t of [-24, -8, 8, 24]) strip.add(mesh(GEO.box, M.mark, { p: [0, 0.025, t], s: [0.35, 0.04, 4] }));
      g.add(strip);
      break;
    }
    case 'solar-wellfield':
      g.add(mesh(GEO.cyl8, M.struct[1], { p: [0, 0.7, 0], s: [3, 0.7, 3] }), mesh(GEO.ring, M.solarRing, { p: [0, 0.08, 0], r: [-PI / 2, 0, 0], s: [9, 9, 1] }));
      break;
    case 'climate-observatory':
      g.add(mesh(GEO.cyl8, M.struct[0], { p: [0, 2.1, 0], s: [3.6, 2.1, 3.6] }), mesh(GEO.sphere, M.dark, { p: [0, 5.1, 0], r: [0.7, 0, 0], s: [3.2, 0.7, 3.2] }));
      break;
    case 'basalt-canyon-convoy':
      g.add(mesh(GEO.plane, M.road, { p: [0, 0.04, 0], r: [-PI / 2, 0, 0], s: [13, 76, 1] }));
      break;
    case 'field-hospital':
      g.add(mesh(GEO.sphere, M.dome, { p: [0, 2.2, 0], s: [8, 2.2, 8] }));
      light = { y: 2, color: '#69d8cd', intensity: 5, distance: 15 };
      break;
    case 'broadcast-bazaar':
    case 'salt-relay-spire':
      g.add(mesh(GEO.cyl8, M.struct[2], { p: [0, 6, 0], s: [1.2, 6, 1.2] }), mesh(GEO.sphere, M.dark, { p: [0, 12.4, 0], s: [2.5, 0.35, 2.5] }));
      break;
    case 'container-dry-port':
    case 'false-flag-armor-yard':
      [-8, 0, 8].forEach((x, n) => [-7, 7].forEach((z, r) => g.add(mesh(GEO.box, M.struct[(n * 2 + r) % 4], { p: [x, 1.1, z], s: [2.2, 2.2, 5.2] }))));
      break;
    case 'salt-rail-causeway':
      for (const x of [-2.2, 2.2]) g.add(mesh(GEO.box, M.struct[2], { p: [x, 0.12, 0], s: [0.22, 0.18, 74] }));
      break;
    case 'grand-weir':
      g.add(mesh(GEO.box, M.struct[0], { p: [0, 2.4, 0], s: [34, 4.8, 5] }));
      for (const x of [-18, 0, 18]) g.add(mesh(GEO.cyl8, M.struct[1], { p: [x, 5.8, 0], s: [2, 6.8, 2] }));
      break;
    case 'treaty-mesa':
      g.add(mesh(GEO.cyl8, M.rock[1], { p: [0, 1.3, 0], s: [13, 1.3, 13] }), mesh(GEO.cone4, M.tent, { p: [0, 3, 0], s: [5, 1.7, 5] }));
      break;
    case 'dry-reservoir-arena':
      g.add(mesh(GEO.ring, M.reservoirRing, { p: [0, 0.08, 0], r: [-PI / 2, 0, 0], s: [25, 25, 1] }));
      break;
    default:
      for (const x of [-8, 8]) for (const z of [-8, 8]) g.add(mesh(GEO.cyl8, M.struct[1], { p: [x, 5, z], s: [2.4, 10, 2.4] }));
      g.add(mesh(GEO.cyl8, M.struct[0], { p: [0, 2.2, 0], s: [8, 4.4, 8] }));
      break;
  }
  return { group: g, light };
}

function buildTile(tile) {
  const g = new THREE.Group();
  g.position.set(tile.centerX, 0, tile.centerZ);
  g.add(mesh(TILE_PLANE, groundMaterial(tile), { r: [-PI / 2, 0, 0], receive: true }));
  if (tile.kind === 'wadi') g.add(mesh(GEO.plane, M.road, { p: [0, 0.025, 0], r: [-PI / 2, 0, 0.35], s: [14, 104, 1] }));
  if (tile.kind === 'oasis-fringe') g.add(mesh(GEO.plane, M.water, { p: [4, 0.04, -6], r: [-PI / 2, 0, 0], s: [18, 12, 1] }));
  const items = tile.props.map((p) => ({
    geo: propGeometry(p.kind),
    mat: propMaterial(p),
    cast: p.kind === 'mesa' || p.kind === 'tower',
    p: [p.x, p.kind === 'dune' ? p.scale[1] * 0.28 : p.scale[1] * 0.5, p.z],
    r: [p.kind === 'panel' ? -0.32 : 0, p.rotation, 0],
    s: p.scale,
  }));
  for (const m of mergeProps(items)) g.add(m);
  let light = null;
  if (tile.setpiece && tile.anchor) {
    const sp = setpiece(tile.setpiece);
    sp.group.position.set(tile.anchor.x - tile.centerX, 0, tile.anchor.z - tile.centerZ);
    sp.group.rotation.y = (-tile.tileRotation * PI) / 2;
    g.add(sp.group);
    if (sp.light) light = { ...sp.light, x: tile.anchor.x, z: tile.anchor.z };
  }
  return { group: g, light };
}

function roadStrip(phase, material, y = 0.035) {
  const a = escortPoint(phase, 0, {});
  const b = escortPoint(phase, 1, {});
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return mesh(GEO.box, material, { p: [(a.x + b.x) / 2, y, (a.z + b.z) / 2], r: [0, Math.atan2(dx, dz), 0], s: [4.6, 0.045, Math.hypot(dx, dz)], receive: true });
}

/* ------------------------------------------------ the continent (WHITE NOON) */

class StreamWorld {
  constructor(scene, mission) {
    this.mission = mission;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.tiles = new Map();
    this.shown = new Set();
    this.center = null;
    this.lights = [];
    for (const phase of mission.phases.filter((p) => p.destination)) this.root.add(roadStrip(phase, M.road));
  }

  tile(tx, tz) {
    const key = tileKey(tx, tz);
    let t = this.tiles.get(key);
    if (!t) {
      t = buildTile(tileData(this.mission, tx, tz));
      this.tiles.set(key, t);
    }
    return t;
  }

  /** Show the 5×5 tiles around the aircraft's tile. Cheap when the tile has not changed. */
  follow(x, z) {
    const around = tilesAround(x, z);
    const c = around.length ? `${Math.round(x / 92)}:${Math.round(z / 92)}` : '';
    if (c === this.center) return false;
    this.center = c;
    const want = new Set();
    this.lights.length = 0;
    for (const { tx, tz } of around) {
      const key = tileKey(tx, tz);
      want.add(key);
      const t = this.tile(tx, tz);
      if (!this.shown.has(key)) this.root.add(t.group);
      if (t.light) this.lights.push(t.light);
    }
    for (const key of this.shown) if (!want.has(key)) this.root.remove(this.tiles.get(key).group);
    this.shown = want;
    return true;
  }

  dispose() {
    this.root.removeFromParent();
    for (const t of this.tiles.values()) t.group.traverse((o) => o.isMesh && o.geometry !== TILE_PLANE && !Object.values(GEO).includes(o.geometry) && o.geometry.dispose());
    this.tiles.clear();
  }
}

/* ------------------------------------------------ local theaters */

const ROAD_COLOR = { desert: '#543c31', steppe: '#4a4430', megacity: '#252c3a', arctic: '#5d7a80', archipelago: '#2c6a68' };

class LocalWorld {
  constructor(scene, mission) {
    this.mission = mission;
    this.root = new THREE.Group();
    this.lights = [];
    this.owned = [];
    scene.add(this.root);
    const n = BIOMES[mission.biome];
    const groundGeo = new THREE.PlaneGeometry(132, 132, 1, 1);
    this.owned.push(groundGeo);
    let groundMat;
    if (mission.biome === 'archipelago') {
      // LOW TIDE: open water with a slow travelling shimmer (same on WebGPU and WebGL2).
      groundMat = new THREE.MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.15 });
      const w = sin(positionWorld.x.mul(0.32).add(time.mul(0.9))).mul(sin(positionWorld.z.mul(0.27).sub(time.mul(0.7))));
      groundMat.colorNode = mix(tslColor(n.ground), tslColor('#2a6b6a'), smoothstep(0.35, 1.0, w));
      this.owned.push(groundMat);
    } else groundMat = std(n.ground, { roughness: 0.94 });
    this.root.add(mesh(groundGeo, groundMat, { r: [-PI / 2, 0, 0], receive: true }));

    const grid = new THREE.GridHelper(128, 32, n.alt, n.alt);
    grid.position.y = 0.025;
    grid.material.opacity = 0.12;
    grid.material.transparent = true;
    this.owned.push(grid.geometry, grid.material);
    this.root.add(grid);

    const r = lcg(hashString(mission.id));
    const count = mission.biome === 'megacity' ? 52 : 34;
    const items = [];
    for (let s = 0; s < count; s++) {
      const x = r() * 116 - 58;
      const z = r() * 116 - 58;
      const h = 0.7 + r() * (mission.biome === 'megacity' ? 8 : 3.6);
      const w = 0.7 + r() * 2.4;
      const kind = s % 5;
      if (mission.biome === 'desert' && kind < 2) items.push({ geo: NI.box, mat: std(n.alt, { roughness: 0.8 }), cast: false, p: [x, 0.14, z], r: [-0.2, s, 0], s: [w * 1.8, 0.08, h * 1.4] });
      else if (mission.biome === 'archipelago' && kind < 2) items.push({ geo: NI.dodeca, mat: std(n.alt, { flatShading: true }), cast: false, p: [x, 0.15, z], r: [0, 0, 0], s: [w * 2.2, 0.3, h * 1.8] });
      // Basalt sea stacks instead of the other theaters' blocks (a box the colour of the sea read as a pillar).
      else if (mission.biome === 'archipelago') items.push({ geo: NI.dodeca, mat: std('#34423c', { roughness: 0.9, flatShading: true }), cast: kind === 2, p: [x, h * 0.35, z], r: [0, s, 0], s: [w, h * 0.7, w] });
      else items.push({ geo: NI.box, mat: std(s % 4 === 0 ? n.alt : n.ground, { roughness: 0.82, flatShading: true }), cast: s % 5 === 0, p: [x, h / 2, z], r: [0, 0, 0], s: [w, h, w] });
    }
    if (mission.biome === 'desert') {
      // Twelve solar panels, tilted -0.28 about X like the original group.
      for (let a = 0; a < 12; a++) items.push({ geo: NI.box, mat: std('#152c38', { metalness: 0.72 }), cast: false, p: [-30 + (a % 6) * 6, 0.6, 25 + Math.floor(a / 6) * 5], r: [-0.28, 0, 0], s: [2.2, 0.08, 1.4] });
    }
    for (const m of mergeProps(items)) {
      this.owned.push(m.geometry);
      this.root.add(m);
    }
    const ring = new THREE.RingGeometry(59, 60, 64);
    this.owned.push(ring);
    this.root.add(mesh(ring, basic('#ff665f', { transparent: true, opacity: 0.38 }), { p: [0, 0.035, 0], r: [-PI / 2, 0, 0] }));

    // Landmarks at each objective and a road for each escort column.
    const island = mission.biome === 'archipelago' ? std(n.alt, { flatShading: true }) : null;
    const road = std(ROAD_COLOR[mission.biome] || '#543c31', { roughness: 1 });
    for (const phase of mission.phases) {
      const [px, pz] = phase.location;
      const g = new THREE.Group();
      g.position.set(px, 0, pz);
      if (island && phase.kind !== 'escort' && phase.kind !== 'boss') g.add(mesh(GEO.dodeca, island, { p: [0, 0.05, 0], s: [9, 0.55, 9], receive: true }));
      if (phase.kind === 'secure') {
        g.add(mesh(GEO.cyl8, M.struct[2], { p: [-5, 4, -5], s: [0.9, 4, 0.9], cast: true }), mesh(GEO.sphere, M.dark, { p: [-5, 8.2, -5], s: [2, 0.3, 2] }));
      } else if (phase.kind === 'survive') {
        g.add(mesh(GEO.sphere, M.dome, { p: [0, 2, 0], s: [7, 2, 7] }));
        this.lights.push({ x: px, z: pz, y: 2, color: '#69d8cd', intensity: 5, distance: 15 });
      } else if (phase.kind === 'extract') {
        const amber = basic('#f2a84a');
        g.add(
          mesh(GEO.padDisc, std('#2b2019', { roughness: 0.9 }), { p: [0, 0.07, 0], r: [-PI / 2, 0, 0], s: 1.1, receive: true }),
          mesh(GEO.padRing, amber, { p: [0, 0.09, 0], r: [-PI / 2, 0, 0], s: 1.1 }),
          mesh(GEO.box, amber, { p: [-1.5, 0.12, 0], s: [0.35, 0.05, 2] }),
          mesh(GEO.box, amber, { p: [1.5, 0.12, 0], s: [0.35, 0.05, 2] }),
          mesh(GEO.box, amber, { p: [0, 0.12, 0], s: [1.5, 0.05, 0.32] })
        );
      } else if (phase.kind === 'escort') {
        this.root.add(roadStrip(phase, road, 0.05));
      }
      if (g.children.length) this.root.add(g);
    }
  }

  follow() {
    return false;
  }

  dispose() {
    this.root.removeFromParent();
    for (const o of this.owned) o.dispose?.();
    this.owned.length = 0;
  }
}

export function createWorld(scene, mission) {
  return isStream(mission) ? new StreamWorld(scene, mission) : new LocalWorld(scene, mission);
}

/** One mesh per tile material, for compiling pipelines before they are first seen. */
export function prewarmGroup() {
  const g = new THREE.Group();
  const mats = [...M.dune, ...M.rock, ...M.struct, M.dark, M.tent, M.water, M.road, ...M.ground, M.salt, M.basalt, M.reservoir, M.oasis, M.mark, M.solarRing, M.dome, M.reservoirRing];
  mats.forEach((m, i) => g.add(mesh(GEO.box, m, { p: [i * 2, 0, 0], s: 0.5 })));
  return g;
}
