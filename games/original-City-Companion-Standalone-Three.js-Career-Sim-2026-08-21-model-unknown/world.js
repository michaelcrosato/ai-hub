// The low-poly city: buildings, streets, traffic, pedestrians, the player
// character, click-to-walk pathfinding and the isometric camera. Rendered by
// the kit's WebGPURenderer (WebGL2 fallback), so only built-in materials are used.

import * as THREE from 'three/webgpu';
import { LOCATIONS, FILLER_BUILDINGS, REGIONS, MAP_MIN, MAP_MAX } from './data.js';
import { clamp, lerp, roundRect, seededRandom, smoothstep } from './util.js';

const WALK_MIN = MAP_MIN + 0.65;
const WALK_MAX = MAP_MAX - 0.65;
const STAND_MIN = MAP_MIN + 1;
const STAND_MAX = MAP_MAX - 1;
const WALK_SPEED = 5.1;
const PLAYER_Y = 0.04;

const PLAYER_LOOK = { body: 0x2f97d1, accent: 0xf2c35e, skin: 0xb87754, hair: 0x3f2c28 };
const PEDESTRIAN_LOOKS = [
  { body: 0xe66f7a, accent: 0xf3cc65, skin: 0xc68761, hair: 0x49322c },
  { body: 0x5dbb9b, accent: 0x7e78d8, skin: 0x8b5d45, hair: 0x2e292b },
  { body: 0x8c7edb, accent: 0xf09260, skin: 0xe0ad83, hair: 0x7a543b },
  { body: 0xf1b85d, accent: 0x4ea5c5, skin: 0xa66b50, hair: 0x352a2a },
  { body: 0x65a8d1, accent: 0xea7aa7, skin: 0x6e4637, hair: 0x191919 },
];
const PEDESTRIAN_ROUTES = [
  [{ x: -27, z: -9 }, { x: 27, z: -9 }],
  [{ x: 27, z: 11 }, { x: -27, z: 11 }],
  [{ x: -10, z: -28 }, { x: -10, z: 27 }],
  [{ x: 10, z: 27 }, { x: 10, z: -28 }],
  [{ x: -27, z: 3.9 }, { x: 27, z: 3.9 }],
  [{ x: 4.3, z: -27 }, { x: 4.3, z: 27 }],
  [{ x: -18, z: 1 }, { x: -18, z: 10 }],
  [{ x: 17, z: -9 }, { x: 17, z: 9 }],
];
const CAR_SPECS = [
  { axis: 'x', lane: -1.2, direction: 1, speed: 3.4, color: 0xef766f, phase: 0.12 },
  { axis: 'x', lane: 1.25, direction: -1, speed: 2.8, color: 0x55b9d7, phase: 0.64 },
  { axis: 'z', lane: -1.25, direction: 1, speed: 3.1, color: 0xf3c65e, phase: 0.35 },
  { axis: 'z', lane: 1.25, direction: -1, speed: 3.6, color: 0x8d7fdc, phase: 0.82 },
  { axis: 'x', lane: -13.2, direction: 1, speed: 2.5, color: 0x5fc398, phase: 0.5 },
  { axis: 'z', lane: 14.2, direction: -1, speed: 2.4, color: 0xee9b63, phase: 0.18 },
];
const TREE_SPOTS = [
  [-28, -25], [-25, -25], [-16, -25], [-5, -25], [15, -25], [28, -25], [-28, 27], [-12, 27], [2, 27], [20, 27],
  [28, 13], [28, 2], [28, -8], [-27, 15], [-25, 2], [-24, 9], [-18, 9], [-21, 0], [-18, 0], [-11, 11], [11, 11],
  [-10, -10], [10, -10], [4, 24],
];
const LAMP_SPOTS = [
  [-5, -4], [5, -4], [-5, 4], [5, 4], [-18, -10], [-9, -10], [9, -10], [18, -10], [-18, 12], [-9, 12], [9, 12],
  [18, 12], [-12, -4], [-12, 5], [12, -4], [12, 5],
];
const ROADS = [
  [0, 0, 64, 5.8, 'horizontal'],
  [0, 0, 5.8, 64, 'vertical'],
  [0, -12, 64, 3.6, 'horizontal'],
  [0, 14, 64, 3.6, 'horizontal'],
  [-14, 0, 3.6, 64, 'vertical'],
  [14, 0, 3.6, 64, 'vertical'],
];

const NIGHT_SKY = new THREE.Color(0x1d2c4f);
const NIGHT_FOG = new THREE.Color(0x2b3c60);
const DUSK_TINT = new THREE.Color(0xf6c0a0);
const SUN_DAY = new THREE.Color(0xfff6d8);
const SUN_GOLD = new THREE.Color(0xffc285);
const MOON = new THREE.Color(0xa9bdf5);

/** Binary min-heap on `priority` (A* open set). */
class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= item.priority) break;
      items[i] = items[parent];
      i = parent;
    }
    items[i] = item;
  }
  pop() {
    const items = this.items;
    if (!items.length) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= items.length) break;
        const r = l + 1;
        const c = r < items.length && items[r].priority < items[l].priority ? r : l;
        if (items[c].priority >= last.priority) break;
        items[i] = items[c];
        i = c;
      }
      items[i] = last;
    }
    return top;
  }
}

const shortestAngle = (from, to) => {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class CityWorld {
  /**
   * @param {object} kit  from boot()
   * @param {object} callbacks  onLocationArrival(id), onProximityChange(id|null), onPathBlocked(),
   *                            onMoveCommand(id|null), onDistanceMoved(distance)
   */
  constructor(kit, callbacks = {}) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.callbacks = callbacks;

    const renderer = this.renderer;
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap is WebGL-only; PCF with a small radius gives the same soft edge.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.regionSky = new THREE.Color(REGIONS.sunharbor.sky);
    this.regionFog = new THREE.Color(REGIONS.sunharbor.fog);
    this.scene.background = this.regionSky.clone();
    this.scene.fog = new THREE.Fog(REGIONS.sunharbor.fog, 52, 98);

    // Isometric orthographic camera, as in the original.
    this.camera = new THREE.OrthographicCamera(-25, 25, 25, -25, 0.1, 180);
    this.cameraOffset = new THREE.Vector3(38, 42, 38);
    this.cameraFocus = new THREE.Vector3();
    this.focusGoal = new THREE.Vector3();
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(this.cameraFocus);
    this.camera.updateMatrixWorld();
    // Screen axes projected onto the ground: stick/WASD movement is screen-relative, and the
    // camera uses them to keep the player inside the view at any aspect ratio or zoom.
    const camRight = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const camUp = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.groundRight = new THREE.Vector3(camRight.x, 0, camRight.z).normalize();
    this.groundUp = new THREE.Vector3(camUp.x, 0, camUp.z).normalize();
    this.rightScale = this.groundRight.dot(camRight);
    this.upScale = this.groundUp.dot(camUp);
    this.zoom = 1;
    this.zoomTarget = 1;
    this.aspect = 1;
    this.viewHalf = { w: 25, h: 25 };

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.hitPoint = new THREE.Vector3();

    this.interactables = [];
    this.markers = [];
    this.obstacles = [];
    this.path = [];
    this.pathTargetLocation = null;
    this.cars = [];
    this.pedestrians = [];
    this.elapsed = 0;
    this.lastProximity = null;
    this.controlsEnabled = false;
    this.speedFactor = 1;
    this.pressStart = null;
    this.hoverAt = 0;
    this.lastHover = { x: -1, y: -1 };
    this.locationEntries = Object.entries(LOCATIONS).map(([id, loc]) => ({ id, entry: loc.entry }));
    this.minuteShown = -1;
    this.playerYaw = 0;

    this.geometries = new Map();
    this.colorMaterials = new Map();
    this.materials = this.createMaterials();
    this.windowFront = [];
    this.windowSide = [];

    this.buildWorld();

    this.player = this.createPerson(PLAYER_LOOK, true);
    this.player.position.set(LOCATIONS.home.entry.x, PLAYER_Y, LOCATIONS.home.entry.z);
    this.scene.add(this.player);

    this.objectiveMarker = this.createObjectiveMarker();
    this.scene.add(this.objectiveMarker);

    kit.onResize((w, h) => {
      this.aspect = w / Math.max(1, h);
      this.updateFrustum();
    });
    this.setTimeOfDay(480, true);
  }

  /* ------------------------------------------------------------ materials */

  standard(color, { roughness = 0.82, metalness = 0, flat = true, transparent = false, opacity = 1, emissive, emissiveIntensity } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: flat, transparent, opacity });
    if (emissive !== undefined) m.emissive.setHex(emissive);
    if (emissiveIntensity !== undefined) m.emissiveIntensity = emissiveIntensity;
    return m;
  }

  /** One material per colour (buildings, people and cars share them). */
  colorMaterial(color, roughness = 0.84) {
    const key = `${color}:${roughness}`;
    let m = this.colorMaterials.get(key);
    if (!m) {
      m = this.standard(color, { roughness });
      this.colorMaterials.set(key, m);
    }
    return m;
  }

  geometry(key, make) {
    let g = this.geometries.get(key);
    if (!g) {
      g = make();
      this.geometries.set(key, g);
    }
    return g;
  }

  createMaterials() {
    return {
      grass: this.standard(0x9ed37f),
      grassDark: this.standard(0x82bd6c),
      road: this.standard(0x62737c, { roughness: 0.96 }),
      roadDark: this.standard(0x4f616a, { roughness: 0.96 }),
      sidewalk: this.standard(0xe8e5d4),
      stripe: this.standard(0xf4e8a8),
      white: this.standard(0xf7f8f3),
      // Windows glow warm at night; the emissive colour is set up front so only uniforms change later.
      window: this.standard(0xbce8ef, { roughness: 0.35, metalness: 0.08, emissive: 0xffd28a, emissiveIntensity: 0 }),
      windowDark: this.standard(0x70b7c5, { roughness: 0.42, emissive: 0xffc97a, emissiveIntensity: 0 }),
      trunk: this.standard(0x8e6847),
      leaf: this.standard(0x58af6b),
      leafLight: this.standard(0x77c77f),
      water: this.standard(0x70cce2, { roughness: 0.2, transparent: true, opacity: 0.82 }),
      ground: this.standard(0x86b86e, { roughness: 1 }),
      skirt: this.standard(0x6d9d60, { roughness: 1 }),
      path: this.standard(0xe6d5b1, { roughness: 1 }),
      plinth: this.standard(0xe6e0cd, { roughness: 1 }),
      door: this.standard(0x496878, { roughness: 0.72 }),
      glass: this.standard(0xa6e0ec, { roughness: 0.25, flat: false, transparent: true, opacity: 0.72 }),
      lampPole: this.standard(0x445d68, { roughness: 0.7, metalness: 0.12 }),
      lampHead: this.standard(0xffe7a6, { roughness: 0.5, flat: false, emissive: 0xffd36b, emissiveIntensity: 0.28 }),
      wheel: this.standard(0x273841, { roughness: 0.95 }),
    };
  }

  /* ------------------------------------------------------------ world */

  buildWorld() {
    this.hemi = new THREE.HemisphereLight(0xe7f9ff, 0x6a9462, 2.1);
    this.scene.add(this.hemi);

    const sun = new THREE.DirectionalLight(0xfff6d8, 3.15);
    sun.position.set(-28, 46, 24);
    sun.castShadow = true;
    this.kit.shadow(sun, 2048);
    Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 110 });
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 2.5;
    this.scene.add(sun);
    this.sun = sun;

    this.buildGround();
    this.buildRoads();
    this.buildPark();

    for (const [id, loc] of Object.entries(LOCATIONS)) {
      this.buildLocation(id, loc);
      if (loc.footprint) {
        this.obstacles.push({ x: loc.x, z: loc.z, w: loc.footprint.w, d: loc.footprint.d, padding: loc.padding ?? 0.78 });
      }
    }
    for (const b of FILLER_BUILDINGS) {
      this.createBuilding(b, false);
      this.obstacles.push({ ...b, padding: 0.65 });
    }
    this.buildWindows();
    this.addCollectiveGarden();
    this.addStreetFurniture();
    this.addTrees();
    this.addCars();
    this.addPedestrians();
    this.buildWalkGrid();
  }

  buildGround() {
    const base = new THREE.Mesh(new THREE.BoxGeometry(66, 1.2, 66), this.materials.ground);
    base.position.y = -0.64;
    base.receiveShadow = true;
    base.renderOrder = -2;
    this.scene.add(base);

    const grass = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), this.materials.grass);
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.scene.add(grass);

    const skirt = new THREE.Mesh(new THREE.BoxGeometry(66.4, 0.3, 66.4), this.materials.skirt);
    skirt.position.y = -0.23;
    skirt.renderOrder = -3;
    this.scene.add(skirt);
  }

  buildRoads() {
    const stripesH = [];
    const stripesV = [];
    const sidewalkWidth = 1.05;
    for (const [x, z, w, d, dir] of ROADS) {
      const road = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, d), this.materials.road);
      road.position.set(x, 0.045, z);
      road.receiveShadow = true;
      this.scene.add(road);
      for (const side of [-1, 1]) {
        const walk =
          dir === 'horizontal'
            ? new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, sidewalkWidth), this.materials.sidewalk)
            : new THREE.Mesh(new THREE.BoxGeometry(sidewalkWidth, 0.15, d), this.materials.sidewalk);
        if (dir === 'horizontal') walk.position.set(x, 0.085, z + side * (d / 2 + sidewalkWidth / 2));
        else walk.position.set(x + side * (w / 2 + sidewalkWidth / 2), 0.085, z);
        walk.receiveShadow = true;
        this.scene.add(walk);
      }
      for (let l = -28; l <= 28; l += 4.2) {
        if (dir === 'horizontal') stripesH.push([l, 0.105, z]);
        else stripesV.push([x, 0.105, l]);
      }
    }
    // Lane stripes: two instanced meshes instead of ~90 separate ones.
    this.scene.add(this.instanced(new THREE.BoxGeometry(2, 0.03, 0.13), this.materials.stripe, stripesH));
    this.scene.add(this.instanced(new THREE.BoxGeometry(0.13, 0.03, 2), this.materials.stripe, stripesV));

    // Central fountain.
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.13, 8), this.materials.sidewalk);
    plaza.position.y = 0.12;
    plaza.receiveShadow = true;
    this.scene.add(plaza);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.25, 0.45, 10), this.materials.white);
    basin.position.y = 0.28;
    basin.castShadow = basin.receiveShadow = true;
    this.scene.add(basin);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.08, 16), this.materials.water);
    pool.position.y = 0.53;
    this.scene.add(pool);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.38, 1.35, 8), this.materials.white);
    column.position.y = 1.1;
    column.castShadow = true;
    this.scene.add(column);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 6), this.materials.water);
    top.position.y = 1.9;
    this.scene.add(top);
    this.fountainTop = top;
  }

  buildPark() {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 12), this.materials.grassDark);
    lawn.position.set(-21.5, 0.07, 4.5);
    lawn.receiveShadow = true;
    this.scene.add(lawn);
    const path = new THREE.Mesh(new THREE.BoxGeometry(9, 0.04, 1.3), this.materials.path);
    path.position.set(-20.5, 0.15, 4);
    this.scene.add(path);
    const pond = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.12, 12), this.materials.water);
    pond.scale.z = 0.68;
    pond.position.set(-23, 0.2, 7.2);
    this.scene.add(pond);
    this.obstacles.push({ x: -23, z: 7.2, w: 4.3, d: 2.8, padding: 0.35 });
    for (const z of [1, 7]) this.scene.add(this.createBench(-18.5, z, z === 1 ? Math.PI : 0));
  }

  createBench(x, z, rotation) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(this.geometry('bench-seat', () => new THREE.BoxGeometry(2.2, 0.18, 0.55)), this.materials.trunk);
    seat.position.y = 0.62;
    seat.castShadow = true;
    bench.add(seat);
    const back = new THREE.Mesh(this.geometry('bench-back', () => new THREE.BoxGeometry(2.2, 0.65, 0.14)), this.materials.trunk);
    back.position.set(0, 0.92, 0.25);
    back.castShadow = true;
    bench.add(back);
    for (const lx of [-0.8, 0.8]) {
      const leg = new THREE.Mesh(this.geometry('bench-leg', () => new THREE.BoxGeometry(0.14, 0.6, 0.14)), this.materials.roadDark);
      leg.position.set(lx, 0.3, 0);
      bench.add(leg);
    }
    bench.position.set(x, 0, z);
    bench.rotation.y = rotation;
    return bench;
  }

  /** A small garden in front of the new Harborlight Collective. */
  addCollectiveGarden() {
    const loc = LOCATIONS.collective;
    this.scene.add(this.createBench(loc.x + 2.35, loc.z - 3.75, 0));
    const planterGeo = this.geometry('planter', () => new THREE.BoxGeometry(0.9, 0.42, 0.9));
    const shrubGeo = this.geometry('shrub', () => new THREE.IcosahedronGeometry(0.46, 0));
    for (const dx of [-2.2, -1.3]) {
      const planter = new THREE.Mesh(planterGeo, this.materials.plinth);
      planter.position.set(loc.x + dx, 0.21, loc.z - 3.6);
      planter.castShadow = planter.receiveShadow = true;
      this.scene.add(planter);
      const shrub = new THREE.Mesh(shrubGeo, this.materials.leafLight);
      shrub.position.set(loc.x + dx, 0.72, loc.z - 3.6);
      shrub.castShadow = true;
      this.scene.add(shrub);
    }
  }

  buildLocation(id, loc) {
    if (loc.footprint) {
      this.createBuilding({ x: loc.x, z: loc.z, w: loc.footprint.w, d: loc.footprint.d, h: loc.height, color: loc.color, roof: loc.roof, entry: loc.entry }, true);
    } else if (id === 'transit') {
      this.createTransitStop(loc);
    } else {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 0.45, 8), this.standard(loc.color, { roughness: 0.8 }));
      post.position.set(loc.x, 0.25, loc.z);
      post.castShadow = true;
      this.scene.add(post);
    }
    this.scene.add(this.createLocationMarker(id, loc));
    const label = this.createLabelSprite(loc.name, loc.color);
    label.position.set(loc.x, loc.footprint ? loc.height + 2.2 : 3.1, loc.z);
    label.userData.locationId = id;
    this.scene.add(label);
    this.interactables.push(label);
  }

  createBuilding(b, isLocation) {
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.z);
    const wallMat = this.colorMaterial(b.color, 0.84);
    const roofMat = this.colorMaterial(b.roof, 0.9);

    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
    body.position.y = b.h / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.35, 0.35, b.d + 0.35), this.materials.plinth);
    plinth.position.y = 0.18;
    plinth.castShadow = plinth.receiveShadow = true;
    group.add(plinth);

    const pitched = isLocation && b.h < 7;
    const roofH = pitched ? 1.45 : 0.48;
    let roof;
    if (pitched) {
      roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.66, roofH, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
    } else {
      roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.45, roofH, b.d + 0.45), roofMat);
    }
    roof.position.y = b.h + roofH / 2;
    roof.castShadow = true;
    group.add(roof);

    // Windows are collected here and drawn as two instanced meshes for the whole city.
    const floors = Math.max(1, Math.floor(b.h / 2.45));
    const front = b.d / 2 + 0.018;
    const cols = Math.max(2, Math.floor(b.w / 2.15));
    for (let f = 0; f < floors; f += 1) {
      const y = Math.min(b.h - 0.75, 1.45 + f * 2.25);
      for (let c = 0; c < cols; c += 1) {
        const x = -b.w / 2 + 1.05 + c * ((b.w - 2.1) / Math.max(1, cols - 1));
        this.windowFront.push([b.x + x, y, b.z + front], [b.x + x, y, b.z - front]);
      }
    }
    const sideCols = Math.max(1, Math.floor(b.d / 2.4));
    for (let f = 0; f < floors; f += 1) {
      const y = Math.min(b.h - 0.75, 1.45 + f * 2.25);
      for (let c = 0; c < sideCols; c += 1) {
        const z = -b.d / 2 + 1.05 + c * ((b.d - 2.1) / Math.max(1, sideCols - 1));
        this.windowSide.push([b.x - b.w / 2 - 0.018, y, b.z + z], [b.x + b.w / 2 + 0.018, y, b.z + z]);
      }
    }

    if (b.entry) {
      const toEntry = { x: b.entry.x - b.x, z: b.entry.z - b.z };
      const sideways = Math.abs(toEntry.x) > Math.abs(toEntry.z);
      const door = new THREE.Mesh(new THREE.BoxGeometry(sideways ? 0.14 : 1.1, 1.8, sideways ? 1.1 : 0.14), this.materials.door);
      if (sideways) door.position.set(Math.sign(toEntry.x) * (b.w / 2 + 0.07), 0.95, clamp(toEntry.z, -b.d / 2 + 0.8, b.d / 2 - 0.8));
      else door.position.set(clamp(toEntry.x, -b.w / 2 + 0.8, b.w / 2 - 0.8), 0.95, Math.sign(toEntry.z) * (b.d / 2 + 0.07));
      group.add(door);
      const awning = new THREE.Mesh(new THREE.BoxGeometry(sideways ? 0.8 : 1.6, 0.18, sideways ? 1.6 : 0.8), roofMat);
      awning.position.copy(door.position);
      awning.position.y = 2.05;
      awning.castShadow = true;
      group.add(awning);
    }
    this.scene.add(group);
    return group;
  }

  buildWindows() {
    this.scene.add(this.instanced(new THREE.BoxGeometry(0.85, 0.78, 0.07), this.materials.window, this.windowFront));
    this.scene.add(this.instanced(new THREE.BoxGeometry(0.07, 0.78, 0.85), this.materials.windowDark, this.windowSide));
    this.windowFront = this.windowSide = null;
  }

  /** An InstancedMesh with one instance per [x, y, z] (and optional uniform scale). */
  instanced(geometry, material, positions, { scales = null, castShadow = false } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, positions.length));
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    positions.forEach((pos, i) => {
      const k = scales ? scales[i] : 1;
      m.compose(p.set(pos[0], pos[1], pos[2]), q, s.set(k, k, k));
      mesh.setMatrixAt(i, m);
    });
    mesh.count = positions.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = castShadow;
    mesh.computeBoundingSphere();
    return mesh;
  }

  createTransitStop(loc) {
    const group = new THREE.Group();
    const roofMat = this.colorMaterial(loc.roof, 0.78);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 2.4), roofMat);
    canopy.position.set(loc.x, 2.7, loc.z);
    canopy.castShadow = true;
    group.add(canopy);
    for (const dx of [-2.1, 2.1]) {
      const post = new THREE.Mesh(this.geometry('transit-post', () => new THREE.BoxGeometry(0.2, 2.6, 0.2)), this.materials.roadDark);
      post.position.set(loc.x + dx, 1.3, loc.z);
      group.add(post);
    }
    const glass = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.7, 0.08), this.materials.glass);
    glass.position.set(loc.x, 1.45, loc.z + 1.05);
    group.add(glass);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 0.6), this.materials.trunk);
    bench.position.set(loc.x, 0.65, loc.z + 0.4);
    bench.castShadow = true;
    group.add(bench);
    this.scene.add(group);
  }

  createLocationMarker(id, loc) {
    const group = new THREE.Group();
    group.position.set(loc.entry.x, 0.08, loc.entry.z);
    group.userData.locationId = id;
    const mat = this.standard(loc.color, { roughness: 0.65, emissive: new THREE.Color(loc.color).multiplyScalar(0.08).getHex() });
    const ring = new THREE.Mesh(this.geometry('marker-ring', () => new THREE.TorusGeometry(0.72, 0.12, 7, 20)), mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.11;
    ring.userData.locationId = id;
    group.add(ring);
    const post = new THREE.Mesh(this.geometry('marker-post', () => new THREE.CylinderGeometry(0.18, 0.25, 0.72, 7)), mat);
    post.position.y = 0.54;
    post.userData.locationId = id;
    post.castShadow = true;
    group.add(post);
    this.interactables.push(group);
    this.markers.push({ ring, post, phase: id.length });
    return group;
  }

  createLabelSprite(text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 420;
    canvas.height = 116;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = 'rgba(39,83,108,0.18)';
    ctx.lineWidth = 4;
    roundRect(ctx, 8, 8, canvas.width - 16, canvas.height - 16, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    roundRect(ctx, 24, 27, 16, 62, 8);
    ctx.fill();
    ctx.fillStyle = '#17324a';
    ctx.font = '800 35px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2 + 8, canvas.height / 2 + 1, canvas.width - 76);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, fog: false }));
    sprite.scale.set(6.3, 1.74, 1);
    sprite.renderOrder = 20;
    return sprite;
  }

  createObjectiveMarker() {
    const group = new THREE.Group();
    group.visible = false;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.15, 28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.12, 2.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false })
    );
    beam.position.y = 1.4;
    group.add(beam);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.8, 6),
      this.standard(0xffffff, { roughness: 1, emissive: 0x557788, emissiveIntensity: 0.25 })
    );
    arrow.position.y = 3.15;
    arrow.rotation.x = Math.PI;
    arrow.castShadow = true;
    group.add(arrow);
    group.userData.ring = ring;
    group.userData.arrow = arrow;
    return group;
  }

  addTrees() {
    const rng = seededRandom('city-companion-trees');
    const trunk = new THREE.CylinderGeometry(0.16, 0.22, 1.25, 6).translate(0, 0.62, 0);
    const crown = new THREE.IcosahedronGeometry(0.83, 0).scale(1, 1.18, 1).translate(0, 1.65, 0);
    const spots = [];
    const scales = [];
    const light = [];
    const lightScales = [];
    const dark = [];
    const darkScales = [];
    TREE_SPOTS.forEach(([x, z], i) => {
      const s = 0.82 + (i % 4) * 0.08;
      spots.push([x, 0, z]);
      scales.push(s);
      if (rng() < 0.45) {
        light.push([x, 0, z]);
        lightScales.push(s);
      } else {
        dark.push([x, 0, z]);
        darkScales.push(s);
      }
    });
    this.scene.add(this.instanced(trunk, this.materials.trunk, spots, { scales, castShadow: true }));
    this.scene.add(this.instanced(crown, this.materials.leafLight, light, { scales: lightScales, castShadow: true }));
    this.scene.add(this.instanced(crown, this.materials.leaf, dark, { scales: darkScales, castShadow: true }));
  }

  addStreetFurniture() {
    const pole = new THREE.CylinderGeometry(0.07, 0.1, 2.4, 6).translate(0, 1.2, 0);
    const head = new THREE.CylinderGeometry(0.26, 0.18, 0.32, 7).translate(0, 2.47, 0);
    const spots = LAMP_SPOTS.map(([x, z]) => [x, 0, z]);
    this.scene.add(this.instanced(pole, this.materials.lampPole, spots, { castShadow: true }));
    this.scene.add(this.instanced(head, this.materials.lampHead, spots));
  }

  createCar(color) {
    const car = new THREE.Group();
    const body = new THREE.Mesh(this.geometry('car-body', () => new THREE.BoxGeometry(2.3, 0.62, 1.15)), this.colorMaterial(color, 0.72));
    body.position.y = 0.55;
    body.castShadow = true;
    car.add(body);
    const cabin = new THREE.Mesh(this.geometry('car-cabin', () => new THREE.BoxGeometry(1.25, 0.52, 0.98)), this.materials.windowDark);
    cabin.position.set(-0.05, 1.05, 0);
    cabin.castShadow = true;
    car.add(cabin);
    const wheelGeo = this.geometry('car-wheel', () => new THREE.CylinderGeometry(0.25, 0.25, 0.16, 8).rotateX(Math.PI / 2));
    for (const x of [-0.72, 0.72]) {
      for (const z of [-0.62, 0.62]) {
        const wheel = new THREE.Mesh(wheelGeo, this.materials.wheel);
        wheel.position.set(x, 0.32, z);
        car.add(wheel);
      }
    }
    return car;
  }

  addCars() {
    for (const spec of CAR_SPECS) {
      const car = this.createCar(spec.color);
      car.userData.spec = { ...spec, progress: spec.phase * 60, current: spec.speed };
      this.cars.push(car);
      this.scene.add(car);
    }
  }

  createPerson(look, isPlayer = false) {
    const person = new THREE.Group();
    const bodyMat = this.colorMaterial(look.body, 0.82);
    const skinMat = this.colorMaterial(look.skin, 0.86);
    const hairMat = this.colorMaterial(look.hair, 0.9);
    const torso = new THREE.Mesh(this.geometry('torso', () => new THREE.CylinderGeometry(0.36, 0.46, 1.15, 7)), bodyMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    person.add(torso);
    const head = new THREE.Mesh(this.geometry('head', () => new THREE.SphereGeometry(0.35, 8, 6).scale(1, 1.06, 1)), skinMat);
    head.position.y = 2.25;
    head.castShadow = true;
    person.add(head);
    const hair = new THREE.Mesh(this.geometry('hair', () => new THREE.SphereGeometry(0.36, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.56)), hairMat);
    hair.position.y = 2.38;
    hair.castShadow = true;
    person.add(hair);
    const legGeo = this.geometry('leg', () => new THREE.BoxGeometry(0.22, 0.82, 0.25));
    const leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.2, 0.48, 0);
    leftLeg.castShadow = true;
    person.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, bodyMat);
    rightLeg.position.set(0.2, 0.48, 0);
    rightLeg.castShadow = true;
    person.add(rightLeg);
    const armGeo = this.geometry('arm', () => new THREE.BoxGeometry(0.18, 0.9, 0.2));
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-0.48, 1.42, 0);
    leftArm.rotation.z = -0.12;
    leftArm.castShadow = true;
    person.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(0.48, 1.42, 0);
    rightArm.rotation.z = 0.12;
    rightArm.castShadow = true;
    person.add(rightArm);
    if (isPlayer) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.22), this.colorMaterial(look.accent, 0.8));
      bag.position.set(0.49, 1.08, 0.14);
      bag.rotation.z = 0.08;
      bag.castShadow = true;
      person.add(bag);
      const phone = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.27, 0.05), this.materials.roadDark);
      phone.position.set(-0.5, 1.1, 0.05);
      person.add(phone);
    }
    Object.assign(person.userData, { leftLeg, rightLeg, leftArm, rightArm, torso, isPlayer });
    return person;
  }

  addPedestrians() {
    PEDESTRIAN_ROUTES.forEach((route, i) => {
      const walker = this.createPerson(PEDESTRIAN_LOOKS[i % PEDESTRIAN_LOOKS.length]);
      walker.scale.setScalar(0.72 + (i % 3) * 0.04);
      Object.assign(walker.userData, {
        route,
        progress: (i * 0.17) % 1,
        direction: i % 2 === 0 ? 1 : -1,
        speed: 0.035 + (i % 4) * 0.006,
        phase: i * 0.8,
      });
      this.pedestrians.push(walker);
      this.scene.add(walker);
    });
  }

  /* ------------------------------------------------------------ walkability and paths */

  isWalkable(x, z) {
    if (x < WALK_MIN || x > WALK_MAX || z < WALK_MIN || z > WALK_MAX) return false;
    for (const o of this.obstacles) {
      const pad = o.padding ?? 0.55;
      if (x > o.x - o.w / 2 - pad && x < o.x + o.w / 2 + pad && z > o.z - o.d / 2 - pad && z < o.z + o.d / 2 + pad) return false;
    }
    return true;
  }

  /** The A* grid (1-unit cells) never changes, so it is computed once. */
  buildWalkGrid() {
    this.gridOrigin = MAP_MIN + 1;
    this.gridSize = Math.round(MAP_MAX - 1 - this.gridOrigin) + 1;
    const n = this.gridSize;
    this.walkGrid = new Uint8Array(n * n);
    for (let gx = 0; gx < n; gx += 1) {
      for (let gz = 0; gz < n; gz += 1) this.walkGrid[gx * n + gz] = this.isWalkable(this.gridOrigin + gx, this.gridOrigin + gz) ? 1 : 0;
    }
    this.gScore = new Float32Array(n * n);
    this.cameFrom = new Int32Array(n * n);
    this.closed = new Uint8Array(n * n);
  }

  nearestWalkable(x, z) {
    if (this.isWalkable(x, z)) return { x, z };
    for (let r = 0.5; r <= 8; r += 0.5) {
      const steps = Math.max(12, Math.ceil(r * 10));
      for (let i = 0; i < steps; i += 1) {
        const a = (i / steps) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (this.isWalkable(px, pz)) return { x: px, z: pz };
      }
    }
    return { x: 0, z: 0 };
  }

  findPath(sx, sz, tx, tz) {
    const n = this.gridSize;
    const origin = this.gridOrigin;
    const toCell = (v) => clamp(Math.round(v - origin), 0, n - 1);
    const start = toCell(sx) * n + toCell(sz);
    let goalX = toCell(tx);
    let goalZ = toCell(tz);
    if (!this.walkGrid[goalX * n + goalZ]) {
      const w = this.nearestWalkable(tx, tz);
      goalX = toCell(w.x);
      goalZ = toCell(w.z);
    }
    const goal = goalX * n + goalZ;
    // Already in the target's cell: walk straight there (the original reported "Route unavailable").
    if (start === goal) return [new THREE.Vector3(tx, PLAYER_Y, tz)];

    const g = this.gScore;
    const came = this.cameFrom;
    const closed = this.closed;
    g.fill(Infinity);
    came.fill(-1);
    closed.fill(0);
    const h = (idx) => {
      const dx = Math.abs(Math.floor(idx / n) - goalX);
      const dz = Math.abs((idx % n) - goalZ);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };
    const walk = (x, z) => x >= 0 && z >= 0 && x < n && z < n && this.walkGrid[x * n + z] === 1;
    const open = new MinHeap();
    g[start] = 0;
    open.push({ idx: start, priority: h(start) });
    const dirs = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
    ];
    let found = false;
    let guard = 0;
    while (open.size && guard < 16000) {
      guard += 1;
      const { idx } = open.pop();
      if (closed[idx]) continue;
      closed[idx] = 1;
      if (idx === goal) {
        found = true;
        break;
      }
      const cx = Math.floor(idx / n);
      const cz = idx % n;
      for (const [dx, dz, cost] of dirs) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (!walk(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (!walk(cx + dx, cz) || !walk(cx, cz + dz))) continue;
        const next = nx * n + nz;
        if (closed[next]) continue;
        const score = g[idx] + cost;
        if (score < g[next]) {
          g[next] = score;
          came[next] = idx;
          open.push({ idx: next, priority: score + h(next) });
        }
      }
    }
    if (!found) return [];
    const cells = [];
    for (let at = goal; at !== start && at !== -1; at = came[at]) cells.push(at);
    cells.reverse();
    const points = cells.map((idx) => new THREE.Vector3(origin + Math.floor(idx / n), PLAYER_Y, origin + (idx % n)));
    if (points.length) points[points.length - 1].set(tx, PLAYER_Y, tz);
    return this.smoothPath(points);
  }

  smoothPath(points) {
    if (points.length < 3) return points;
    const out = [];
    let from = new THREE.Vector3(this.player.position.x, PLAYER_Y, this.player.position.z);
    let i = 0;
    while (i < points.length) {
      let furthest = i;
      for (let j = points.length - 1; j >= i; j -= 1) {
        if (this.hasLineOfSight(from, points[j])) {
          furthest = j;
          break;
        }
      }
      out.push(points[furthest]);
      from = points[furthest];
      i = furthest + 1;
    }
    return out;
  }

  hasLineOfSight(a, b) {
    const steps = Math.max(2, Math.ceil(a.distanceTo(b) / 0.35));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      if (!this.isWalkable(lerp(a.x, b.x, t), lerp(a.z, b.z, t))) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ public API */

  applyRegion(id) {
    const region = REGIONS[id] || REGIONS.sunharbor;
    this.regionSky.setHex(region.sky);
    this.regionFog.setHex(region.fog);
    this.setTimeOfDay(this.minuteShown < 0 ? 480 : this.minuteShown, true);
  }

  setControlsEnabled(on) {
    this.controlsEnabled = !!on;
  }

  setPlayerPosition(x, z) {
    const p = this.nearestWalkable(x, z);
    this.player.position.set(p.x, PLAYER_Y, p.z);
    this.clearPath();
    this.snapCamera();
  }

  getPlayerPosition() {
    return { x: this.player.position.x, z: this.player.position.z };
  }

  getDistanceToLocation(id) {
    const loc = LOCATIONS[id];
    if (!loc) return Infinity;
    return Math.hypot(this.player.position.x - loc.entry.x, this.player.position.z - loc.entry.z);
  }

  isNearLocation(id, radius = 2.3) {
    return this.getDistanceToLocation(id) <= radius;
  }

  moveToLocation(id) {
    const loc = LOCATIONS[id];
    if (loc) this.setDestination(loc.entry.x, loc.entry.z, id);
  }

  clearPath() {
    this.path = [];
    this.pathTargetLocation = null;
  }

  get hasRoute() {
    return this.path.length > 0;
  }

  setDestination(x, z, locationId = null) {
    const target = this.nearestWalkable(x, z);
    const path = this.findPath(this.player.position.x, this.player.position.z, target.x, target.z);
    if (!path.length) {
      this.callbacks.onPathBlocked?.();
      return false;
    }
    this.path = path;
    this.pathTargetLocation = locationId;
    return true;
  }

  setObjectiveLocation(id) {
    const loc = id ? LOCATIONS[id] : null;
    if (!loc) {
      this.objectiveMarker.visible = false;
      return;
    }
    this.objectiveMarker.position.set(loc.entry.x, 0, loc.entry.z);
    this.objectiveMarker.visible = true;
  }

  /** Camera zoom from wheel, pinch or bumpers: + zooms in. */
  addZoom(delta) {
    if (!delta) return;
    this.zoomTarget = clamp(this.zoomTarget * Math.exp(delta * 0.08), 0.72, 1.6);
  }

  updateFrustum() {
    // Portrait screens get a taller view so at least ~34 units of the city fit across.
    const base = Math.max(50, 34 / this.aspect);
    const height = base / this.zoom;
    this.viewHalf.h = height / 2;
    this.viewHalf.w = (height * this.aspect) / 2;
    const cam = this.camera;
    cam.left = -this.viewHalf.w;
    cam.right = this.viewHalf.w;
    cam.top = this.viewHalf.h;
    cam.bottom = -this.viewHalf.h;
    cam.updateProjectionMatrix();
  }

  /**
   * Lighting follows the in-game clock: day, golden hour, and a blue night with lit
   * windows and street lamps. Only uniforms change, so no pipelines are rebuilt.
   */
  setTimeOfDay(minutes, force = false) {
    const m = ((minutes % 1440) + 1440) % 1440;
    if (!force && Math.abs(m - this.minuteShown) < 1) return;
    this.minuteShown = m;
    const day = smoothstep(330, 450, m) * (1 - smoothstep(1110, 1230, m));
    const golden = 4 * day * (1 - day);
    const night = 1 - day;
    const bg = this.scene.background;
    bg.lerpColors(NIGHT_SKY, this.regionSky, day).lerp(DUSK_TINT, golden * 0.3);
    this.scene.fog.color.lerpColors(NIGHT_FOG, this.regionFog, day).lerp(DUSK_TINT, golden * 0.22);
    this.hemi.intensity = 2.1 * (0.34 + 0.66 * day);
    this.sun.intensity = 3.15 * (0.2 + 0.8 * day);
    this.sun.color.lerpColors(MOON, SUN_DAY, day).lerp(SUN_GOLD, golden * 0.55);
    this.materials.window.emissiveIntensity = night * 0.85;
    this.materials.windowDark.emissiveIntensity = night * 0.5;
    this.materials.lampHead.emissiveIntensity = 0.28 + night * 2.1;
    this.isNight = night > 0.5;
  }

  /* ------------------------------------------------------------ per frame */

  /**
   * @param {number} dt
   * @param {{x:number,y:number}} move  screen-relative movement (-1..1), y is up the screen
   * @param {object} [opts] { frozen: true } holds everything still (the game's pause menu)
   */
  update(dt, move, opts = {}) {
    this.elapsed += dt;
    if (opts.frozen) return;
    const moved = this.updatePlayer(dt, move);
    this.updateTraffic(dt);
    this.updatePedestrians(dt);
    this.updateMarkers(dt);
    this.updateCamera(dt);
    this.updateProximity();
    if (moved > 0) this.callbacks.onDistanceMoved?.(moved);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayer(dt, move) {
    const p = this.player.position;
    if (!this.controlsEnabled) {
      this.animatePerson(this.player, false);
      return 0;
    }
    let dirX = 0;
    let dirZ = 0;
    let speed = WALK_SPEED * this.speedFactor;
    const mag = move ? Math.hypot(move.x, move.y) : 0;
    if (mag > 0.08) {
      // Manual movement overrides a click route.
      if (this.path.length) this.clearPath();
      dirX = this.groundRight.x * move.x + this.groundUp.x * move.y;
      dirZ = this.groundRight.z * move.x + this.groundUp.z * move.y;
      const len = Math.hypot(dirX, dirZ) || 1;
      dirX /= len;
      dirZ /= len;
      speed *= clamp(mag, 0.35, 1);
    } else if (this.path.length) {
      let target = this.path[0];
      let dist = Math.hypot(target.x - p.x, target.z - p.z);
      while (dist < 0.16) {
        this.path.shift();
        if (!this.path.length) {
          const arrived = this.pathTargetLocation;
          this.pathTargetLocation = null;
          this.animatePerson(this.player, false);
          if (arrived && this.isNearLocation(arrived, 2.65)) this.callbacks.onLocationArrival?.(arrived);
          return 0;
        }
        target = this.path[0];
        dist = Math.hypot(target.x - p.x, target.z - p.z);
      }
      dirX = (target.x - p.x) / dist;
      dirZ = (target.z - p.z) / dist;
      speed = Math.min(speed, dist / Math.max(dt, 0.001));
    }
    if (!dirX && !dirZ) {
      this.animatePerson(this.player, false);
      return 0;
    }
    const ox = p.x;
    const oz = p.z;
    const nx = ox + dirX * speed * dt;
    const nz = oz + dirZ * speed * dt;
    // Slide along walls: try each axis on its own.
    if (this.isWalkable(nx, oz)) p.x = nx;
    if (this.isWalkable(p.x, nz)) p.z = nz;
    p.x = clamp(p.x, STAND_MIN, STAND_MAX);
    p.z = clamp(p.z, STAND_MIN, STAND_MAX);
    const targetYaw = Math.atan2(dirX, dirZ);
    this.playerYaw += shortestAngle(this.playerYaw, targetYaw) * (1 - Math.exp(-14 * dt));
    this.player.rotation.y = this.playerYaw;
    this.animatePerson(this.player, true);
    const moved = Math.hypot(p.x - ox, p.z - oz);
    // Walking into a wall with an active route: give up instead of pacing in place.
    if (moved < 0.0005 && this.path.length && mag <= 0.08) this.clearPath();
    return moved;
  }

  animatePerson(person, walking) {
    const u = person.userData;
    const t = this.elapsed * (walking ? 8.5 : 2.2) + (u.phase ?? 0);
    const swing = walking ? 0.48 : 0.03;
    const s = Math.sin(t);
    u.leftLeg.rotation.x = s * swing;
    u.rightLeg.rotation.x = -s * swing;
    u.leftArm.rotation.x = -s * swing * 0.7;
    u.rightArm.rotation.x = s * swing * 0.7;
    u.torso.position.y = 1.35 + (walking ? Math.abs(Math.sin(t * 2)) * 0.035 : s * 0.01);
  }

  updateTraffic(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    for (const car of this.cars) {
      const s = car.userData.spec;
      // Cars ease to a stop for the player standing in their lane just ahead.
      const along = s.axis === 'x' ? px - s.progress : pz - s.progress;
      const across = s.axis === 'x' ? pz - s.lane : px - s.lane;
      const ahead = along * s.direction;
      const blocked = Math.abs(across) < 1.1 && ahead > 0.4 && ahead < 3.2;
      s.current = lerp(s.current, blocked ? 0 : s.speed, 1 - Math.exp(-(blocked ? 7 : 2.2) * dt));
      s.progress += dt * s.current * s.direction;
      while (s.progress > 32) s.progress -= 64;
      while (s.progress < -32) s.progress += 64;
      // The car model's length runs along its local X axis (the original turned it a quarter
      // too far, so every car drove sideways).
      if (s.axis === 'x') {
        car.position.set(s.progress, 0.08, s.lane);
        car.rotation.y = s.direction > 0 ? 0 : Math.PI;
      } else {
        car.position.set(s.lane, 0.08, s.progress);
        car.rotation.y = s.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
  }

  updatePedestrians(dt) {
    for (const walker of this.pedestrians) {
      const u = walker.userData;
      u.progress += u.speed * u.direction * dt;
      if (u.progress >= 1) {
        u.progress = 1;
        u.direction = -1;
      } else if (u.progress <= 0) {
        u.progress = 0;
        u.direction = 1;
      }
      const [a, b] = u.route;
      walker.position.set(lerp(a.x, b.x, u.progress), PLAYER_Y, lerp(a.z, b.z, u.progress));
      walker.rotation.y = Math.atan2((b.x - a.x) * u.direction, (b.z - a.z) * u.direction);
      this.animatePerson(walker, true);
    }
  }

  updateMarkers(dt) {
    for (const m of this.markers) {
      m.post.position.y = 0.54 + Math.sin(this.elapsed * 2.2 + m.phase) * 0.08;
      m.ring.rotation.z += 0.18 * dt;
    }
    this.fountainTop.position.y = 1.9 + Math.sin(this.elapsed * 3) * 0.05;
    const marker = this.objectiveMarker;
    if (marker.visible) {
      marker.userData.ring.scale.setScalar(1 + Math.sin(this.elapsed * 3.4) * 0.12);
      marker.userData.arrow.position.y = 3.15 + Math.sin(this.elapsed * 3.1) * 0.24;
      marker.rotation.y += 0.36 * dt;
    }
  }

  /** Where the camera wants to look: a gentle lean toward the player, never letting them leave the view. */
  computeFocusGoal(out) {
    const p = this.player.position;
    const lean = 0.16 + clamp((this.zoom - 1) / 0.6, 0, 1) * 0.5;
    out.set(p.x * lean, 0, p.z * lean);
    const dx = p.x - out.x;
    const dz = p.z - out.z;
    const sx = (dx * this.groundRight.x + dz * this.groundRight.z) * this.rightScale;
    const sy = (dx * this.groundUp.x + dz * this.groundUp.z) * this.upScale;
    const limX = this.viewHalf.w * 0.62;
    const limY = this.viewHalf.h * 0.55;
    const ex = sx - clamp(sx, -limX, limX);
    const ey = sy - clamp(sy, -limY, limY);
    if (ex) out.addScaledVector(this.groundRight, ex / this.rightScale);
    if (ey) out.addScaledVector(this.groundUp, ey / this.upScale);
    return out;
  }

  updateCamera(dt) {
    if (Math.abs(this.zoom - this.zoomTarget) > 0.0005) {
      this.zoom = lerp(this.zoom, this.zoomTarget, 1 - Math.exp(-10 * dt));
      this.updateFrustum();
    }
    this.computeFocusGoal(this.focusGoal);
    const rate = 0.65 + clamp((this.zoom - 1) / 0.6, 0, 1) * 2;
    this.cameraFocus.lerp(this.focusGoal, 1 - Math.exp(-dt * rate));
    // Catch up fast if the player is close to the edge of the view.
    const edge = this.focusGoal.distanceTo(this.cameraFocus);
    if (edge > 6) this.cameraFocus.lerp(this.focusGoal, 1 - Math.exp(-dt * 4));
    this.camera.position.copy(this.cameraOffset).add(this.cameraFocus);
    this.camera.lookAt(this.cameraFocus);
  }

  snapCamera() {
    this.computeFocusGoal(this.cameraFocus);
    this.camera.position.copy(this.cameraOffset).add(this.cameraFocus);
    this.camera.lookAt(this.cameraFocus);
  }

  updateProximity() {
    const p = this.player.position;
    let best = null;
    let bestDist = Infinity;
    for (const { id, entry } of this.locationEntries) {
      const d = Math.hypot(p.x - entry.x, p.z - entry.z);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }
    const near = bestDist <= 2.4 ? best : null;
    if (near !== this.lastProximity) {
      this.lastProximity = near;
      this.callbacks.onProximityChange?.(near);
    }
  }

  /* ------------------------------------------------------------ pointer */

  setNdc(nx, ny) {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, this.camera);
  }

  hitLocation(nx, ny) {
    this.setNdc(nx, ny);
    const hits = this.raycaster.intersectObjects(this.interactables, true);
    for (const hit of hits) {
      for (let o = hit.object; o; o = o.parent) if (o.userData?.locationId) return o.userData.locationId;
    }
    return null;
  }

  /**
   * Taps and left clicks on the canvas walk the character (kit.input.pointer). A drag,
   * a right click or a pinch is not a tap.
   */
  handlePointer(input, zoomDelta) {
    const p = input.pointer;
    if (p.justDown) this.pressStart = { x: p.x, y: p.y, valid: p.type !== 'mouse' || input.down('select'), zoomed: false };
    if (this.pressStart && zoomDelta) this.pressStart.zoomed = true;
    if (p.justUp && this.pressStart) {
      const start = this.pressStart;
      this.pressStart = null;
      const moved = Math.hypot(p.x - start.x, p.y - start.y);
      if (start.valid && !start.zoomed && moved <= (p.type === 'touch' ? 14 : 6) && this.controlsEnabled) this.pointerCommand(p.nx, p.ny);
    }
    // Hover cursor for mice, at most ten raycasts a second.
    const canvas = this.renderer.domElement;
    if (p.type === 'mouse' && p.over && (p.x !== this.lastHover.x || p.y !== this.lastHover.y) && this.elapsed - this.hoverAt > 0.1) {
      this.hoverAt = this.elapsed;
      this.lastHover.x = p.x;
      this.lastHover.y = p.y;
      const cursor = !this.controlsEnabled ? 'default' : this.hitLocation(p.nx, p.ny) ? 'pointer' : 'crosshair';
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    }
  }

  pointerCommand(nx, ny) {
    const id = this.hitLocation(nx, ny);
    if (id) {
      this.moveToLocation(id);
      this.callbacks.onMoveCommand?.(id);
      return;
    }
    this.setNdc(nx, ny);
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      const target = this.nearestWalkable(clamp(this.hitPoint.x, STAND_MIN, STAND_MAX), clamp(this.hitPoint.z, STAND_MIN, STAND_MAX));
      if (this.setDestination(target.x, target.z, null)) this.callbacks.onMoveCommand?.(null);
    }
  }
}
