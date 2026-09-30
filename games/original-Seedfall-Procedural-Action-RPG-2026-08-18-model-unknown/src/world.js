import * as THREE from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  BIOMES,
  DUNGEON_ADJECTIVES,
  DUNGEON_MODIFIERS,
  DUNGEON_NOUNS,
  DUNGEON_THEMES,
  FACTIONS,
  PLACE_PREFIXES,
  SETTLEMENT_SERVICES,
  SETTLEMENT_SUFFIXES,
} from "./data.js";
import { Rng, clamp, deriveSeed, distance2D, distanceToSegment, fbm, hashInts } from "./util.js";

/** Mark a geometry or material as shared, so the dispose helpers leave it alone. */
export function shared(resource) {
  resource.userData.shared = true;
  return resource;
}

const lambert = (color) => shared(new THREE.MeshLambertMaterial({ color, flatShading: true }));

export const MATERIALS = {
  road: lambert(0x765d41),
  trail: lambert(0x8d7755),
  water: shared(
    new THREE.MeshPhongMaterial({
      color: 0x3f87a3,
      transparent: true,
      opacity: 0.72,
      shininess: 60,
      depthWrite: false,
    }),
  ),
  stone: lambert(0x73766f),
  stoneDark: lambert(0x4d514f),
  wood: lambert(0x6f4d32),
  roof: lambert(0x783f35),
  canvas: lambert(0xb69a69),
  glow: shared(new THREE.MeshBasicMaterial({ color: 0xb06ee0, transparent: true, opacity: 0.75 })),
  grass: lambert(0x557d45),
  trunk: lambert(0x5c4330),
  leaves: lambert(0x3e7445),
  leavesAlt: lambert(0x668f4e),
  snowLeaves: lambert(0x7799a0),
  desertPlant: lambert(0x64814f),
  corruptedPlant: lambert(0x69416f),
  terrain: shared(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })),
};

const basicCache = new Map();
/** One MeshBasicMaterial per colour/opacity, shared by every prop that uses it. */
export function sharedBasic(color, opacity = 1) {
  const key = `${color}:${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = shared(new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }));
    basicCache.set(key, m);
  }
  return m;
}

const geometryCache = new Map();
function sharedGeometry(key, make) {
  let g = geometryCache.get(key);
  if (!g) {
    g = shared(make());
    geometryCache.set(key, g);
  }
  return g;
}

export const CHUNK_SIZE = 64;
const POI_CELL_SIZE = 128;
const CHUNK_RADIUS = 2;
const FIXED_SETTLEMENTS = new Map([
  ["0,0", 2],
  ["1,-1", 1],
  ["-2,1", 3],
]);
const ROAD_KINDS = ["settlement", "dungeon", "mine", "ruin", "tower", "portal"];
const ELITE_MODIFIERS = ["Frenzied", "Armored", "Vampiric", "Volatile", "Chilling", "Venomous"];

function cellKey(x, z) {
  return `${x},${z}`;
}

function segmentTouchesBounds(minX, minZ, maxX, maxZ, a, b) {
  const lowX = Math.min(a.x, b.x);
  const highX = Math.max(a.x, b.x);
  const lowZ = Math.min(a.z, b.z);
  const highZ = Math.max(a.z, b.z);
  return !(highX < minX) && !(lowX > maxX) && !(highZ < minZ) && !(lowZ > maxZ);
}

/** A cache that forgets everything once it grows past its limit (the data is deterministic). */
function remember(map, key, limit, make) {
  if (map.has(key)) return map.get(key);
  if (map.size >= limit) map.clear();
  const value = make();
  map.set(key, value);
  return value;
}

/**
 * The deterministic world: biomes, height, water, points of interest, roads
 * and enemy spawns, all derived from the seed. Results that are asked for
 * again and again (POI cells, roads, lakes) are cached; nothing is random.
 */
export class WorldGenerator {
  seed;
  seedText;
  seeds;
  poiCells = new Map();
  roadCache = new Map();
  lakeCache = new Map();

  constructor(seed, seedText) {
    this.seed = seed >>> 0;
    this.seedText = seedText;
    const s = this.seed;
    this.seeds = {
      starterGrove: deriveSeed(s, "starter-grove"),
      temperature: deriveSeed(s, "temperature"),
      moisture: deriveSeed(s, "moisture"),
      wildness: deriveSeed(s, "wildness"),
      corruption: deriveSeed(s, "corruption"),
      heightBroad: deriveSeed(s, "height-broad"),
      heightDetail: deriveSeed(s, "height-detail"),
      danger: deriveSeed(s, "danger"),
      swampWater: deriveSeed(s, "swamp-water"),
      groundColor: deriveSeed(s, "ground-color"),
    };
  }

  getBiomeAt(x, z) {
    const r = Math.hypot(x, z);
    const s = this.seeds;
    if (r < 92) {
      return fbm(s.starterGrove, x, z, 90, 3) > 0.6 ? "forest" : "plains";
    }
    const temperature = fbm(s.temperature, x, z, 290, 4);
    const moisture = fbm(s.moisture, x + 700, z - 300, 230, 4);
    const wildness = fbm(s.wildness, x - 450, z + 900, 170, 3);
    if (fbm(s.corruption, x + 1200, z + 800, 330, 4) + Math.min(0.12, r / 8000) > 0.77 && r > 210) return "corrupted";
    if (temperature < 0.3) return "snow";
    if (temperature > 0.67 && moisture < 0.47) return "desert";
    if (moisture > 0.7) return "swamp";
    if (moisture > 0.52 || wildness > 0.64) return "forest";
    return "plains";
  }

  getHeightAt(x, z) {
    const biome = this.getBiomeAt(x, z);
    const amplitude = biome === "snow" ? 3.2 : biome === "desert" ? 1.8 : biome === "swamp" ? 0.55 : 1.25;
    const broad = fbm(this.seeds.heightBroad, x, z, 180, 4) - 0.5;
    const detail = fbm(this.seeds.heightDetail, x, z, 42, 3) - 0.5;
    return broad * amplitude + detail * 0.55;
  }

  getDangerAt(x, z) {
    const biome = this.getBiomeAt(x, z);
    const distance = Math.hypot(x, z) / 145;
    const noise = fbm(this.seeds.danger, x, z, 210, 3) * 1.6;
    return clamp(Math.floor(1 + distance + noise + BIOMES[biome].dangerBias), 1, 15);
  }

  isWaterAt(x, z) {
    if (
      (this.getBiomeAt(x, z) === "swamp" && fbm(this.seeds.swampWater, x, z, 28, 3) > 0.71) ||
      this.distanceToRiver(x, z) < 2.8
    ) {
      return true;
    }
    return this.isInsideGeneratedLake(x, z);
  }

  getMovementMultiplierAt(x, z) {
    if (this.distanceToRiver(x, z) < 3.5 || this.isInsideGeneratedLake(x, z, 1.2)) return 0.72;
    if (this.getBiomeAt(x, z) === "swamp" && fbm(this.seeds.swampWater, x, z, 28, 3) > 0.69) return 0.78;
    return 1;
  }

  isInsideGeneratedLake(x, z, margin = 0) {
    const lake = this.getLakeForChunk(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
    return !!lake && Math.hypot(x - lake.x, z - lake.z) < lake.radius + margin;
  }

  getLakeForChunk(cx, cz) {
    return remember(this.lakeCache, cellKey(cx, cz), 4096, () => {
      const rng = new Rng(deriveSeed(this.seed, "lake", cx, cz));
      const x = cx * CHUNK_SIZE + rng.range(14, CHUNK_SIZE - 14);
      const z = cz * CHUNK_SIZE + rng.range(14, CHUNK_SIZE - 14);
      const chance = this.getBiomeAt(x, z) === "swamp" ? 0.32 : 0.06;
      if (rng.chance(chance) && !(this.distanceToRiver(x, z) <= 18)) {
        return { x, z, radius: rng.range(5, 9) };
      }
      return undefined;
    });
  }

  riverCenterZ(x) {
    const phase = ((this.seed % 1000) / 1000) * Math.PI * 2;
    return 82 + Math.sin(x / 115 + phase) * 34 + Math.sin(x / 41 - phase * 0.7) * 9;
  }

  distanceToRiver(x, z) {
    const a = { x: x - 4, z: this.riverCenterZ(x - 4) };
    const b = { x: x + 4, z: this.riverCenterZ(x + 4) };
    return distanceToSegment({ x, z }, a, b);
  }

  getWaterFeaturesForChunk(cx, cz) {
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxX = minX + CHUNK_SIZE;
    const maxZ = minZ + CHUNK_SIZE;
    const points = [];
    for (let x = minX - 4; x <= maxX + 4; x += 6) points.push({ x, z: this.riverCenterZ(x) });
    const lowZ = Math.min(...points.map((p) => p.z));
    const highZ = Math.max(...points.map((p) => p.z));
    const features = [];
    if (highZ >= minZ - 5 && lowZ <= maxZ + 5) {
      features.push({ id: `river:${cx}:${cz}`, kind: "river", points, radius: 3.3 });
    }
    const lake = this.getLakeForChunk(cx, cz);
    if (lake) {
      features.push({ id: `lake:${cx}:${cz}`, kind: "lake", points: [{ x: lake.x, z: lake.z }], radius: lake.radius });
    }
    return features;
  }

  getChunkData(cx, cz) {
    const x = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    const z = cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    const biome = this.getBiomeAt(x, z);
    const danger = this.getDangerAt(x, z);
    const poi = this.getPoisInBounds(cx * CHUNK_SIZE, cz * CHUNK_SIZE, (cx + 1) * CHUNK_SIZE, (cz + 1) * CHUNK_SIZE);
    return {
      key: `${cx}:${cz}`,
      cx,
      cz,
      biome,
      danger,
      poi,
      enemySpawns: this.generateEnemySpawns(cx, cz, biome, danger, poi),
      propSeed: deriveSeed(this.seed, "props", cx, cz),
    };
  }

  getPoisInBounds(minX, minZ, maxX, maxZ) {
    const fromX = Math.floor(minX / POI_CELL_SIZE) - 1;
    const toX = Math.floor(maxX / POI_CELL_SIZE) + 1;
    const fromZ = Math.floor(minZ / POI_CELL_SIZE) - 1;
    const toZ = Math.floor(maxZ / POI_CELL_SIZE) + 1;
    const found = [];
    for (let x = fromX; x <= toX; x += 1) {
      for (let z = fromZ; z <= toZ; z += 1) {
        for (const p of this.getPoisForCell(x, z)) {
          if (p.x >= minX && p.x < maxX && p.z >= minZ && p.z < maxZ) found.push(p);
        }
      }
    }
    return found;
  }

  getPoisAround(x, z, radius) {
    return this.getPoisInBounds(x - radius, z - radius, x + radius, z + radius).filter(
      (p) => Math.hypot(p.x - x, p.z - z) <= radius,
    );
  }

  getPoiById(id) {
    const parts = id.split(":");
    if (parts[0] !== "poi" || parts.length < 4) return undefined;
    const cx = Number(parts[1]);
    const cz = Number(parts[2]);
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return undefined;
    return this.getPoisForCell(cx, cz).find((p) => p.id === id);
  }

  getStartingSettlement() {
    return this.getPoisForCell(0, 0).find((p) => p.kind === "settlement");
  }

  getPoisForCell(cx, cz) {
    return remember(this.poiCells, cellKey(cx, cz), 8192, () => this.generatePoisForCell(cx, cz));
  }

  generatePoisForCell(e, t) {
    let n = deriveSeed(this.seed, "poi-cell", e, t);
    let i = new Rng(n);
    let r = [];
    let a = FIXED_SETTLEMENTS.get(cellKey(e, t));
    let o = a !== undefined || this.isSettlementCandidate(e, t);
    if (o) {
      let h = a ?? this.rollSettlementTier(i, e, t);
      let u = this.poiPosition(e, t, i, 0, a !== undefined);
      let d = this.getBiomeAt(u.x, u.z);
      r.push({
        id: `poi:${e}:${t}:0`,
        seed: deriveSeed(n, 0),
        kind: "settlement",
        name: this.generateSettlementName(i, h),
        x: u.x,
        z: u.z,
        biome: d,
        danger: Math.max(1, this.getDangerAt(u.x, u.z) - 1),
        tier: h,
        services: SETTLEMENT_SERVICES[h],
        faction: i.pick(FACTIONS),
      });
    }
    let l = o ? 0.45 : 0.82;
    let c = e === 0 && t === -1;
    if (i.chance(l) || c) {
      let h = r.length;
      let u = this.poiPosition(e, t, i, h, false);
      if (r.every((d) => distance2D(d, u) > 34)) {
        r.push(this.makeSpecialPoi(e, t, h, u, i, c ? "dungeon" : undefined));
      }
    }
    if (!o && i.chance(0.34)) {
      let h = r.length;
      let u = this.poiPosition(e, t, i, h + 3, false);
      if (r.every((d) => distance2D(d, u) > 30)) {
        r.push(this.makeMinorPoi(e, t, h, u, i));
      }
    }
    return r;
  }

  getRoadSegmentsForChunk(cx, cz) {
    return remember(this.roadCache, cellKey(cx, cz), 2048, () => this.generateRoadSegments(cx, cz));
  }

  generateRoadSegments(e, t) {
    let n = e * CHUNK_SIZE - 8;
    let i = t * CHUNK_SIZE - 8;
    let r = (e + 1) * CHUNK_SIZE + 8;
    let a = (t + 1) * CHUNK_SIZE + 8;
    let c = this.getPoisAround(e * CHUNK_SIZE + CHUNK_SIZE / 2, t * CHUNK_SIZE + CHUNK_SIZE / 2, 250);
    let h = c.filter((p) => p.kind === "settlement");
    let u = c.filter((p) => ROAD_KINDS.includes(p.kind));
    let d = new Map();
    for (let p of h) {
      let x = u.filter((y) => y.id !== p.id).sort((y, m) => distance2D(p, y) - distance2D(p, m));
      for (let y of x.slice(0, p.tier === 3 ? 3 : 2)) {
        if (distance2D(p, y) > 230) continue;
        let [m, f] = p.id < y.id ? [p, y] : [y, p];
        let id = `road:${m.id}:${f.id}`;
        if (segmentTouchesBounds(n, i, r, a, m, f)) {
          d.set(id, {
            id,
            from: { x: m.x, z: m.z },
            to: { x: f.x, z: f.z },
            width: y.kind === "settlement" ? 2.6 : 1.6,
          });
        }
      }
    }
    return [...d.values()];
  }

  isSettlementCandidate(e, t) {
    let n = hashInts(this.seed, 991, e, t) / 4294967295;
    if (n > 0.29) return false;
    for (let [r, a] of [
      [-1, 0],
      [0, -1],
      [1, 0],
      [0, 1],
    ]) {
      let o = hashInts(this.seed, 991, e + r, t + a) / 4294967295;
      if (o < n && o <= 0.29) return false;
    }
    return true;
  }

  rollSettlementTier(rng, cx, cz) {
    const danger = this.getDangerAt(cx * POI_CELL_SIZE, cz * POI_CELL_SIZE);
    const roll = rng.next() + Math.min(0.18, danger * 0.012);
    return roll > 0.9 ? 3 : roll > 0.5 ? 2 : 1;
  }

  poiPosition(e, t, n, i, r) {
    let a = r ? 24 : 18;
    let o = n.fork("position", i);
    let best;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let h = 0; h < 18; h += 1) {
      let u = {
        x: e * POI_CELL_SIZE + o.range(a, POI_CELL_SIZE - a),
        z: t * POI_CELL_SIZE + o.range(a, POI_CELL_SIZE - a),
      };
      let d = this.distanceToRiver(u.x, u.z);
      let p = this.getHeightAt(u.x, u.z);
      let slope = Math.max(
        Math.abs(this.getHeightAt(u.x + 3, u.z) - p),
        Math.abs(this.getHeightAt(u.x - 3, u.z) - p),
        Math.abs(this.getHeightAt(u.x, u.z + 3) - p),
        Math.abs(this.getHeightAt(u.x, u.z - 3) - p),
      );
      let wet = this.isWaterAt(u.x, u.z);
      let score = (wet ? -100 : 0) + Math.min(24, d) - slope * 12;
      if (score > bestScore) {
        best = u;
        bestScore = score;
      }
      if (!wet && d >= (r ? 7 : 4) && slope <= 1.15) return u;
    }
    return best;
  }

  generateSettlementName(rng, tier) {
    const suffix =
      tier === 3 && rng.chance(0.45) ? rng.pick(["City", "Citadel", "Crown", "Harbor"]) : rng.pick(SETTLEMENT_SUFFIXES);
    return `${rng.pick(PLACE_PREFIXES)}${suffix}`;
  }

  makeSpecialPoi(e, t, n, i, r, a) {
    let o = this.getBiomeAt(i.x, i.z);
    let l = this.getDangerAt(i.x, i.z);
    let c =
      a ??
      r.weighted([
        { value: "dungeon", weight: 5 },
        { value: "mine", weight: o === "desert" || o === "snow" ? 2.4 : 1.1 },
        { value: "ruin", weight: 2.2 },
        { value: "tower", weight: 1.2 },
        { value: "portal", weight: o === "corrupted" ? 4 : 0.45 },
        { value: "graveyard", weight: o === "swamp" || o === "forest" ? 1.8 : 0.7 },
      ]);
    let h = this.themeFor(o, c, r);
    let u = r.pick(DUNGEON_MODIFIERS);
    let p;
    if (["dungeon", "mine", "ruin", "portal"].includes(c)) {
      p = `${r.pick(DUNGEON_ADJECTIVES)} ${r.pick(DUNGEON_NOUNS[h])}`;
    } else if (c === "tower") {
      p = `${r.pick(DUNGEON_ADJECTIVES)} Watchtower`;
    } else {
      p = `${r.pick(PLACE_PREFIXES)} Graveyard`;
    }
    return {
      id: `poi:${e}:${t}:${n}`,
      seed: deriveSeed(this.seed, "poi", e, t, n),
      kind: c,
      name: p,
      x: i.x,
      z: i.z,
      biome: o,
      danger: l,
      theme: h,
      modifier: u,
      faction: r.pick(FACTIONS),
    };
  }

  makeMinorPoi(e, t, n, i, r) {
    let a = this.getBiomeAt(i.x, i.z);
    let o = r.weighted([
      { value: "camp", weight: 2.5 },
      { value: "shrine", weight: 2 },
      { value: "farm", weight: a === "plains" ? 3 : 0.5 },
      { value: "graveyard", weight: 1 },
      { value: "bridge", weight: this.distanceToRiver(i.x, i.z) < 25 ? 3 : 0.2 },
    ]);
    let names = {
      camp: `${r.pick(PLACE_PREFIXES)}road Camp`,
      shrine: `Shrine of the ${r.pick(["Lantern", "Oak", "Dawn", "Tide", "Traveler"])}`,
      farm: `${r.pick(PLACE_PREFIXES)}field Farm`,
      graveyard: `${r.pick(PLACE_PREFIXES)} Cairns`,
      bridge: `${r.pick(PLACE_PREFIXES)} Bridge`,
    };
    return {
      id: `poi:${e}:${t}:${n}`,
      seed: deriveSeed(this.seed, "poi", e, t, n),
      kind: o,
      name: names[o],
      x: i.x,
      z: i.z,
      biome: a,
      danger: this.getDangerAt(i.x, i.z),
      faction: r.pick(FACTIONS),
    };
  }

  themeFor(biome, kind, rng) {
    if (kind === "mine") return "mine";
    if (kind === "ruin") return "ruins";
    if (kind === "portal" || biome === "corrupted") return "arcane";
    const options = {
      plains: ["cave", "ruins", "crypt"],
      forest: ["cave", "ruins", "crypt"],
      desert: ["ruins", "mine", "cave"],
      swamp: ["crypt", "ruins", "cave"],
      snow: ["cave", "crypt", "mine"],
      corrupted: ["arcane", "ruins", "crypt"],
    };
    return rng.pick(options[biome] ?? DUNGEON_THEMES);
  }

  generateEnemySpawns(e, t, n, i, r) {
    let a = new Rng(deriveSeed(this.seed, "enemy-spawns", e, t));
    let o = e * CHUNK_SIZE;
    let l = t * CHUNK_SIZE;
    let c = this.getStartingSettlement();
    let u = r.find((x) => x.kind === "settlement") ? a.int(0, 2) : a.int(2, 4) + Math.floor(i / 4);
    let d = [];
    let p = 0;
    while (d.length < u && p < u * 12 + 12) {
      p += 1;
      let x = o + a.range(5, CHUNK_SIZE - 5);
      let z = l + a.range(5, CHUNK_SIZE - 5);
      const at = { x, z };
      if (
        distance2D(at, c) < 30 ||
        r.some((s) => s.kind === "settlement" && distance2D(at, s) < 24 + (s.tier ?? 1) * 5) ||
        this.isWaterAt(x, z)
      ) {
        continue;
      }
      let m = a.pick(BIOMES[n].enemyIds);
      let f = clamp(0.025 + i * 0.012, 0.03, 0.22);
      let elite = a.chance(f);
      d.push({
        id: `enemy:${e}:${t}:${d.length}`,
        x,
        z,
        archetypeId: m,
        level: Math.max(1, i + a.int(-1, 1)),
        elite,
        modifiers: elite ? a.shuffle(ELITE_MODIFIERS).slice(0, i > 7 ? 2 : 1) : [],
        guardingPoiId: r.find((s) => distance2D(at, s) < 25 && s.kind !== "settlement")?.id,
      });
    }
    return d;
  }
}

/** Dispose everything under a group except shared geometries and materials. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    if (!o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && !m.userData.shared) m.dispose();
  });
}

function makeBox(width, height, depth, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.y = height / 2;
  return mesh;
}

const _local = new THREE.Matrix4();
const _box = new THREE.Box3();
const _center = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Bake every static mesh under a chunk into one mesh per material. A settlement
 * alone was dozens of draw calls; a whole chunk now costs a handful.
 */
export function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const merged = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep) return;
    const source = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    source.userData = {};
    for (const name of Object.keys(source.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") source.deleteAttribute(name);
    }
    source.clearGroups();
    _local.copy(o.matrixWorld);
    source.applyMatrix4(_local);
    let list = buckets.get(o.material);
    if (!list) buckets.set(o.material, (list = []));
    list.push(source);
    merged.push(o);
  });
  for (const o of merged) {
    o.removeFromParent();
    if (!o.geometry.userData.shared) o.geometry.dispose();
  }
  // Drop the now-empty POI and building groups.
  for (const child of [...group.children]) {
    if (child.isGroup && !hasMesh(child)) child.removeFromParent();
  }
  for (const [material, list] of buckets) {
    const geometry = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (list.length > 1) for (const g of list) g.dispose();
    if (!geometry) continue;
    geometry.computeBoundingBox();
    _box.copy(geometry.boundingBox).getCenter(_center);
    geometry.translate(-_center.x, -_center.y, -_center.z);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(_center);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
}

function hasMesh(root) {
  let found = false;
  root.traverse((o) => {
    if (o.isMesh) found = true;
  });
  return found;
}

/** Streams the 5×5 chunks around the player: terrain, water, roads, props and landmarks. */
export class ChunkManager {
  world;
  root;
  loaded = new Map();
  pending = [];
  centerCx = Number.NaN;
  centerCz = Number.NaN;
  enabled = true;
  /** Tree and rock counts follow the quality tier (kit.tier.detail); the layout stays seeded. */
  detail = 1;

  constructor(world, root) {
    this.world = world;
    this.root = root;
  }

  /** Recentre on (x, z). New chunks are queued (see pump) unless force loads them all now. */
  update(x, z, force = false) {
    if (!this.enabled) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (!force && cx === this.centerCx && cz === this.centerCz) {
      this.pump(1);
      return;
    }
    this.centerCx = cx;
    this.centerCz = cz;
    const wanted = new Set();
    const missing = [];
    for (let dz = -CHUNK_RADIUS; dz <= CHUNK_RADIUS; dz += 1) {
      for (let dx = -CHUNK_RADIUS; dx <= CHUNK_RADIUS; dx += 1) {
        const key = `${cx + dx}:${cz + dz}`;
        wanted.add(key);
        if (!this.loaded.has(key)) missing.push({ key, cx: cx + dx, cz: cz + dz, d: Math.max(Math.abs(dx), Math.abs(dz)) });
      }
    }
    for (const [key, chunk] of this.loaded) {
      if (!wanted.has(key)) {
        this.root.remove(chunk.group);
        disposeTree(chunk.group);
        this.loaded.delete(key);
      }
    }
    missing.sort((a, b) => a.d - b.d);
    this.pending = missing;
    // The ring of chunks around the player's own is always there; the outer ring streams in.
    this.pump(force ? Infinity : 1, force ? Infinity : 1);
  }

  /** Load queued chunks: every chunk within `near` of the centre, plus up to `budget` others. */
  pump(budget = 1, near = 1) {
    while (this.pending.length) {
      const next = this.pending[0];
      if (next.d > near && budget <= 0) break;
      this.pending.shift();
      if (!this.loaded.has(next.key)) {
        this.loadChunk(next.cx, next.cz);
        if (next.d > near) budget -= 1;
      }
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.visible = on;
  }

  clear() {
    for (const chunk of this.loaded.values()) {
      this.root.remove(chunk.group);
      disposeTree(chunk.group);
    }
    this.loaded.clear();
    this.pending = [];
    this.centerCx = Number.NaN;
    this.centerCz = Number.NaN;
  }

  getActiveChunkData() {
    return [...this.loaded.values()].map((c) => c.data);
  }

  getActivePois() {
    const out = [];
    for (const c of this.loaded.values()) for (const p of c.data.poi) out.push(p);
    return out;
  }

  loadChunk(cx, cz) {
    const data = this.world.getChunkData(cx, cz);
    const group = new THREE.Group();
    group.name = `chunk:${data.key}`;
    group.add(this.createTerrain(data));
    this.addWater(group, cx, cz);
    this.addRoads(group, cx, cz);
    this.addProps(group, data);
    for (const poi of data.poi) group.add(this.createPoi(poi));
    mergeStatic(group);
    this.root.add(group);
    this.loaded.set(data.key, { data, group });
  }

  createTerrain(e) {
    let n = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 12, 12);
    n.rotateX(-Math.PI / 2);
    let i = n.getAttribute("position");
    let r = new Float32Array(i.count * 3);
    let a = e.cx * CHUNK_SIZE + CHUNK_SIZE / 2;
    let o = e.cz * CHUNK_SIZE + CHUNK_SIZE / 2;
    let l = new THREE.Color();
    let c = new THREE.Color();
    for (let d = 0; d < i.count; d += 1) {
      let p = a + i.getX(d);
      let x = o + i.getZ(d);
      i.setY(d, this.world.getHeightAt(p, x));
      let y = BIOMES[this.world.getBiomeAt(p, x)];
      l.setHex(y.ground);
      c.setHex(y.groundAlt);
      l.lerp(c, fbm(this.world.seeds.groundColor, p, x, 24, 2) * 0.55);
      r[d * 3] = l.r;
      r[d * 3 + 1] = l.g;
      r[d * 3 + 2] = l.b;
    }
    n.setAttribute("color", new THREE.BufferAttribute(r, 3));
    n.computeVertexNormals();
    let u = new THREE.Mesh(n, MATERIALS.terrain);
    u.position.set(a, 0, o);
    u.name = `terrain:${e.key}`;
    u.userData.keep = true;
    return u;
  }

  addProps(e, t) {
    let n = BIOMES[t.biome];
    let i = new Rng(t.propSeed);
    let r = t.cx * CHUNK_SIZE;
    let a = t.cz * CHUNK_SIZE;
    let o = this.world.getRoadSegmentsForChunk(t.cx, t.cz);
    let l = [];
    let c = Math.round((t.biome === "forest" ? 34 : t.biome === "swamp" ? 28 : 18) * n.propDensity * this.detail);
    let h = 0;
    while (l.length < c && h < c * 6) {
      h += 1;
      let x = r + i.range(2, CHUNK_SIZE - 2);
      let z = a + i.range(2, CHUNK_SIZE - 2);
      const at = { x, z };
      if (
        !t.poi.some((p) => distance2D(at, p) < (p.kind === "settlement" ? 25 + (p.tier ?? 1) * 5 : 11)) &&
        !o.some((s) => distanceToSegment(at, s.from, s.to) < s.width + 1.7) &&
        !this.world.isWaterAt(x, z)
      ) {
        l.push({ x, z, scale: i.range(0.75, 1.35), rotation: i.range(0, Math.PI * 2) });
      }
    }
    const desert = t.biome === "desert";
    const trunkGeometry = desert
      ? sharedGeometry("trunk:desert", () => new THREE.CylinderGeometry(0.22, 0.28, 2.8, 5))
      : sharedGeometry("trunk", () => new THREE.CylinderGeometry(0.18, 0.28, 1.6, 5));
    const crownGeometry = desert
      ? sharedGeometry("crown:desert", () => new THREE.CylinderGeometry(0.6, 0.75, 1.3, 6))
      : t.biome === "corrupted"
        ? sharedGeometry("crown:corrupted", () => new THREE.OctahedronGeometry(0.85, 0))
        : sharedGeometry(`crown:${t.biome}`, () =>
            new THREE.ConeGeometry(t.biome === "forest" ? 1.25 : 0.95, t.biome === "snow" ? 3 : 2.4, 6),
          );
    let crownMaterial =
      t.biome === "snow"
        ? MATERIALS.snowLeaves
        : desert
          ? MATERIALS.desertPlant
          : t.biome === "corrupted"
            ? MATERIALS.corruptedPlant
            : t.biome === "swamp"
              ? MATERIALS.leavesAlt
              : MATERIALS.leaves;
    let m = new THREE.Matrix4();
    let f = new THREE.Quaternion();
    let S = new THREE.Vector3();
    let A = new THREE.Vector3();
    if (l.length > 0) {
      let trunks = new THREE.InstancedMesh(trunkGeometry, MATERIALS.trunk, l.length);
      let crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, l.length);
      for (let k = 0; k < l.length; k += 1) {
        let v = l[k];
        let E = this.world.getHeightAt(v.x, v.z);
        f.setFromAxisAngle(UP, v.rotation);
        S.set(v.scale, v.scale, v.scale);
        A.set(v.x, E + (desert ? 1.4 : 0.8) * v.scale, v.z);
        m.compose(A, f, S);
        trunks.setMatrixAt(k, m);
        A.set(v.x, E + (desert ? 3 : t.biome === "snow" ? 2.4 : 2.25) * v.scale, v.z);
        m.compose(A, f, S);
        crowns.setMatrixAt(k, m);
      }
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      e.add(trunks, crowns);
    }
    let rockCount = Math.max(2, Math.round((desert || t.biome === "snow" || t.biome === "corrupted" ? 12 : 6) * this.detail));
    let rocks = new THREE.InstancedMesh(
      sharedGeometry("rock", () => new THREE.DodecahedronGeometry(0.55, 0)),
      MATERIALS.stone,
      rockCount,
    );
    const euler = new THREE.Euler();
    for (let k = 0; k < rockCount; k += 1) {
      let v = r + i.range(3, CHUNK_SIZE - 3);
      let E = a + i.range(3, CHUNK_SIZE - 3);
      let C = i.range(0.45, t.biome === "snow" ? 2.1 : 1.45);
      f.setFromEuler(euler.set(i.range(0, 0.4), i.range(0, Math.PI * 2), i.range(0, 0.4)));
      S.set(C, C * i.range(0.7, 1.4), C);
      A.set(v, this.world.getHeightAt(v, E) + C * 0.25, E);
      m.compose(A, f, S);
      rocks.setMatrixAt(k, m);
    }
    rocks.instanceMatrix.needsUpdate = true;
    e.add(rocks);
  }

  addRoads(group, cx, cz) {
    for (const road of this.world.getRoadSegmentsForChunk(cx, cz)) {
      const dx = road.to.x - road.from.x;
      const dz = road.to.z - road.from.z;
      const midX = (road.from.x + road.to.x) / 2;
      const midZ = (road.from.z + road.to.z) / 2;
      if (Math.floor(midX / CHUNK_SIZE) !== cx || Math.floor(midZ / CHUNK_SIZE) !== cz) continue;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(road.width, 0.08, Math.hypot(dx, dz)),
        road.width > 2 ? MATERIALS.road : MATERIALS.trail,
      );
      mesh.position.set(midX, this.world.getHeightAt(midX, midZ) + 0.035, midZ);
      mesh.rotation.y = Math.atan2(dx, dz);
      group.add(mesh);
    }
  }

  addWater(group, cx, cz) {
    for (const feature of this.world.getWaterFeaturesForChunk(cx, cz)) {
      if (feature.kind === "lake") {
        const p = feature.points[0];
        const lake = new THREE.Mesh(
          new THREE.CylinderGeometry(feature.radius, feature.radius * 0.9, 0.08, 18),
          MATERIALS.water,
        );
        lake.position.set(p.x, this.world.getHeightAt(p.x, p.z) + 0.12, p.z);
        group.add(lake);
        continue;
      }
      for (let k = 0; k < feature.points.length - 1; k += 1) {
        const a = feature.points[k];
        const b = feature.points[k + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segment = new THREE.Mesh(
          new THREE.BoxGeometry(feature.radius * 2, 0.06, Math.hypot(dx, dz) + 0.5),
          MATERIALS.water,
        );
        const midX = (a.x + b.x) / 2;
        const midZ = (a.z + b.z) / 2;
        segment.position.set(midX, this.world.getHeightAt(midX, midZ) + 0.16, midZ);
        segment.rotation.y = Math.atan2(dx, dz);
        group.add(segment);
      }
    }
  }

  createPoi(poi) {
    const group = new THREE.Group();
    group.name = poi.id;
    group.position.set(poi.x, this.world.getHeightAt(poi.x, poi.z), poi.z);
    const rng = new Rng(poi.seed);
    switch (poi.kind) {
      case "settlement":
        this.buildSettlement(group, poi, rng);
        break;
      case "dungeon":
      case "mine":
      case "portal":
        this.buildEntrance(group, poi, rng);
        break;
      case "ruin":
        this.buildRuin(group, rng);
        break;
      case "tower":
        this.buildTower(group);
        break;
      case "camp":
        this.buildCamp(group, rng);
        break;
      case "shrine":
        this.buildShrine(group);
        break;
      case "graveyard":
        this.buildGraveyard(group, rng);
        break;
      case "farm":
        this.buildFarm(group, rng);
        break;
      case "bridge":
        this.buildBridge(group);
        break;
      default:
        this.buildRuin(group, rng);
    }
    return group;
  }

  buildSettlement(e, t, n) {
    let i = t.tier ?? 1;
    let r = new THREE.Mesh(new THREE.CylinderGeometry(8 + i * 3, 8 + i * 3, 0.16, 20), MATERIALS.road);
    r.position.y = 0.08;
    e.add(r);
    let a = i === 1 ? 4 : i === 2 ? 7 : 12;
    for (let l = 0; l < a; l += 1) {
      let c = (l / a) * Math.PI * 2 + n.range(-0.18, 0.18);
      let h = i === 3 && l >= 8 ? 18 : 10 + i * 2.5;
      let u = n.range(2.6, i === 3 ? 4.5 : 3.7);
      let d = this.makeBuilding(u, n);
      d.position.set(Math.sin(c) * h, 0, Math.cos(c) * h);
      d.rotation.y = c + Math.PI;
      e.add(d);
    }
    let o = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.8, 10), MATERIALS.stone);
    o.position.y = 0.4;
    e.add(o);
    if (i === 3) {
      for (let l = 0; l < 18; l += 1) {
        let c = (l / 18) * Math.PI * 2;
        let h = makeBox(2.6, 1.6, 0.45, MATERIALS.stoneDark);
        h.position.set(Math.sin(c) * 23, 0.8, Math.cos(c) * 23);
        h.rotation.y = c;
        e.add(h);
      }
    }
  }

  makeBuilding(size, rng) {
    const building = new THREE.Group();
    const body = makeBox(size, rng.range(2.4, 3.6), size * rng.range(0.8, 1.2), MATERIALS.wood);
    building.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(size * 0.82, 1.8, 4), MATERIALS.roof);
    roof.position.y = body.position.y * 2 + 0.85;
    roof.rotation.y = Math.PI / 4;
    building.add(roof);
    const door = makeBox(0.7, 1.4, 0.12, MATERIALS.stoneDark);
    door.position.set(0, 0.7, -size * 0.5 - 0.06);
    building.add(door);
    return building;
  }

  buildEntrance(e, t, n) {
    let i = new THREE.Mesh(new THREE.ConeGeometry(7, 4.5, 7), t.theme === "arcane" ? MATERIALS.stoneDark : MATERIALS.stone);
    i.position.y = 1.8;
    i.rotation.y = n.range(0, Math.PI);
    e.add(i);
    let r = makeBox(3.4, 3.6, 0.45, t.kind === "portal" || t.theme === "arcane" ? MATERIALS.glow : MATERIALS.stoneDark);
    r.position.set(0, 1.75, -2.4);
    e.add(r);
    let a = makeBox(4.7, 0.55, 1.1, MATERIALS.stone);
    a.position.set(0, 3.65, -2.4);
    e.add(a);
    for (let l of [-2.1, 2.1]) {
      let c = makeBox(0.7, 3.5, 1.1, MATERIALS.stone);
      c.position.set(l, 1.75, -2.4);
      e.add(c);
    }
    let o = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 6, 18), sharedBasic(t.danger > 5 ? 0xe26c63 : 0xe3c875, 0.75));
    o.rotation.x = Math.PI / 2;
    o.position.y = 0.2;
    e.add(o);
  }

  buildRuin(e, t) {
    let n = makeBox(10, 0.22, 8, MATERIALS.stoneDark);
    n.position.y = 0.11;
    e.add(n);
    for (let i = 0; i < 6; i += 1) {
      let r = makeBox(t.range(2, 5), t.range(1, 3.6), 0.6, MATERIALS.stone);
      r.position.set(t.range(-4, 4), r.position.y, t.range(-3, 3));
      r.rotation.y = t.range(0, Math.PI * 2);
      e.add(r);
    }
  }

  buildTower(e) {
    let t = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 10, 8), MATERIALS.stone);
    t.position.y = 5;
    e.add(t);
    let n = new THREE.Mesh(new THREE.ConeGeometry(4, 3.5, 8), MATERIALS.roof);
    n.position.y = 11.5;
    e.add(n);
  }

  buildCamp(e, t) {
    for (let i = 0; i < 3; i += 1) {
      let r = new THREE.Mesh(new THREE.ConeGeometry(2, 2.5, 4), MATERIALS.canvas);
      let a = (i / 3) * Math.PI * 2;
      r.position.set(Math.sin(a) * 4.5, 1.2, Math.cos(a) * 4.5);
      r.rotation.y = Math.PI / 4 + t.range(-0.3, 0.3);
      e.add(r);
    }
    let n = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 5), sharedBasic(0xff8a3c));
    n.position.y = 0.7;
    e.add(n);
  }

  buildShrine(e) {
    let t = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.8, 0.7, 10), MATERIALS.stone);
    t.position.y = 0.35;
    e.add(t);
    for (let i of [-2, 2]) {
      let r = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 4.5, 8), MATERIALS.stone);
      r.position.set(i, 2.6, 0);
      e.add(r);
    }
    let n = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), MATERIALS.glow);
    n.position.y = 2.1;
    e.add(n);
  }

  buildGraveyard(e, t) {
    for (let n = 0; n < 10; n += 1) {
      let i = makeBox(0.65, t.range(1, 1.8), 0.28, MATERIALS.stone);
      i.position.set(t.range(-5, 5), i.position.y, t.range(-4, 4));
      i.rotation.y = t.range(-0.3, 0.3);
      e.add(i);
    }
  }

  buildFarm(e, t) {
    let n = this.makeBuilding(4.4, t);
    n.position.set(0, 0, -5);
    e.add(n);
    for (let i = 0; i < 6; i += 1) {
      let r = makeBox(1.1, 0.08, 10, MATERIALS.grass);
      r.position.set(-6 + i * 2.2, 0.04, 4);
      e.add(r);
    }
  }

  buildBridge(e) {
    for (let t = -5; t <= 5; t += 1) {
      let n = makeBox(3.8, 0.18, 0.8, MATERIALS.wood);
      n.position.set(0, 0.4, t * 0.75);
      e.add(n);
    }
  }
}
