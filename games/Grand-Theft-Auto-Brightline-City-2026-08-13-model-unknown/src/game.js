/**
 * game.js — Brightline City: the living low-poly city, on three.js r186
 * (WebGPU with WebGL2 fallback) through the shared kit.
 *
 * The simulation (traffic, citizens, crime and police, missions, activities,
 * world events, businesses, weather, saving) is the original game's logic.
 * The engine layer — world building, materials, lights and shadows, cameras,
 * particles, post-processing and input — is written for three.js and the kit.
 *
 * Coordinates: the city keeps its original (left-handed) numbers. Everything
 * placed in it hangs off `this.world`, a group mirrored on X (see scene3d.js),
 * so gameplay code never converts anything.
 *
 * Added in the upgrade pass: synthesized cues and controller rumble for
 * pickups, hits, crashes and progress; a results banner with mission best
 * times; traffic that eases past parked cars and wrecks instead of jamming
 * for good; saving when the tab is hidden; and the Relay Routes chapters,
 * two activities and two incidents (all data in data.js).
 */

import * as THREE from 'three/webgpu';
import { uniform, renderGroup } from 'three/tsl';
import { boot } from 'kit/boot.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CITY,
  SPARKS,
  FACTIONS,
  DISTRICTS,
  VEHICLE_TYPES,
  INVESTMENTS,
  BUSINESSES,
  ACTIVITIES,
  WORLD_EVENTS,
  MISSIONS,
  PED_COLORS,
  BUILDING_COLORS,
  DEFAULT_SETTINGS,
} from './data.js';
import { normalizeSettings, readSave, writeSave, clearSave } from './save.js';
import {
  toWorld,
  linearColor,
  shapes,
  makeGlow,
  installFog,
  Particles,
  canvasTexture,
  createCityPost,
} from './scene3d.js';

const Vector3 = THREE.Vector3;
const SETTINGS_KEY = 'brightline-city-settings-v1';
const FIXED_STEP = 1 / 30;
const ROAD_X = [-96, -32, 32, 96];
const ROAD_Z = [-76, -20, 36, 88];
const SIDEWALK_OFFSET = 8.2;
const HALF_WIDTH = CITY.width / 2;
const HALF_DEPTH = CITY.depth / 2;
const DELIVERY_PADS = [
  [-63, 48],
  [-53, 48],
  [-63, 58],
  [-53, 58],
  [-63, 72],
  [-53, 72],
  [-63, 82],
  [-53, 82],
];
const OUTFITS = [
  { jacket: '#ff5e75', trousers: '#364c78', accessory: false },
  { jacket: '#4e9cff', trousers: '#263a54', accessory: true },
  { jacket: '#38c896', trousers: '#5c3f78', accessory: false },
  { jacket: '#ffad45', trousers: '#314f48', accessory: true },
];
/** Mission asset id → its kind (actor, vehicle, object); asked for every car and person each tick. */
const MISSION_ASSET_KINDS = new Map(MISSIONS.flatMap((m) => (m.assets ?? []).map((a) => [a.id, a.kind])));
const UP = new Vector3(0, 1, 0);
const SKY_DAY = new THREE.Color(0.46, 0.79, 0.94);
const SKY_NIGHT = new THREE.Color(0.12, 0.19, 0.34);
const SKY_FOG = new THREE.Color(0.64, 0.73, 0.76);

/**
 * Everything the player can do, on keyboard and mouse, gamepad and touch.
 * The first touch button (Use) is the big one; buttons that only make sense
 * on foot or in a vehicle are shown and hidden as the player gets in and out.
 */
export const INPUT = {
  interact: { keys: ['KeyE'], gamepad: ['Y'], touch: 'Use' },
  jump: { keys: ['Space'], gamepad: ['A'], touch: 'Jump' },
  fire: { keys: ['KeyF'], gamepad: ['X', 'RT'], touch: 'Act' },
  sprint: { keys: ['ShiftLeft', 'ShiftRight'], gamepad: ['B'], touch: 'Run' },
  crouch: { keys: ['ControlLeft', 'ControlRight'], gamepad: ['LT'], touch: 'Duck' },
  horn: { keys: ['KeyQ'], gamepad: ['X'], touch: 'Horn' },
  reset: { keys: ['KeyR'], gamepad: ['LS'], touch: 'Reset' },
  move: { type: 'vector', keys: 'wasd+arrows', gamepad: 'leftStick+dpad', touch: 'stick' },
  drive: { type: 'axis', gamepad: { pos: 'RT', neg: 'LT' } },
  look: { type: 'look', mouse: 'drag', gamepad: 'rightStick', touch: 'drag' },
  camera: { keys: ['KeyC'], gamepad: ['RS'] },
  zoomIn: { gamepad: ['RB'] },
  zoomOut: { gamepad: ['LB'] },
  map: { keys: ['KeyM'], gamepad: ['Back'] },
  journal: { keys: ['KeyJ'] },
  help: { keys: ['KeyH'] },
  options: { keys: ['KeyO'] },
  pause: { keys: ['KeyP'], gamepad: ['Start'] },
  back: { keys: ['Escape'] },
};

function clamp(i, e, t) {
  return Math.max(e, Math.min(t, i));
}
function lerp(i, e, t) {
  return i + (e - i) * t;
}
/** Shortest signed angle from i to e. */
function angleDelta(i, e) {
  let t = ((e - i + Math.PI) % (Math.PI * 2)) - Math.PI;
  return (t < -Math.PI && (t += Math.PI * 2), t);
}
function seededRandom(i) {
  let e = i >>> 0;
  return () => ((e = (e * 1664525 + 1013904223) >>> 0), e / 4294967296);
}
function hashString(i) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t += 1) ((e ^= i.charCodeAt(t)), (e = Math.imul(e, 16777619)));
  return e >>> 0;
}
/** Distance on the ground plane. */
function flatDistance(i, e) {
  let t = i.x - e.x,
    r = i.z - e.z;
  return Math.sqrt(t * t + r * r);
}
function distanceToSegment(i, e, t) {
  let r = t.x - e.x,
    s = t.z - e.z,
    n = r * r + s * s;
  if (n < 1e-6) return flatDistance(i, e);
  let a = clamp(((i.x - e.x) * r + (i.z - e.z) * s) / n, 0, 1);
  return Math.hypot(i.x - (e.x + r * a), i.z - (e.z + s * a));
}
/** Does the ground segment i→e pass through collider box t? */
function segmentCrossesBox(i, e, t, r = 0.12) {
  let s = t.minX - r,
    n = t.maxX + r,
    a = t.minZ - r,
    o = t.maxZ + r,
    l = e.x - i.x,
    c = e.z - i.z,
    f = 0,
    u = 1;
  for (let [h, d, m, _] of [
    [i.x, l, s, n],
    [i.z, c, a, o],
  ]) {
    if (Math.abs(d) < 1e-6) {
      if (h < m || h > _) return false;
      continue;
    }
    let p = (m - h) / d,
      g = (_ - h) / d;
    if (((f = Math.max(f, Math.min(p, g))), (u = Math.min(u, Math.max(p, g))), f > u)) return false;
  }
  return u > 0.02 && f < 0.98;
}
/** 42.3 → "42.3s", 185 → "3:05". */
function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function routeAccent(i) {
  return i === 'deuteranopia' ? '#4fb4ff' : i === 'protanopia' ? '#32d9ff' : i === 'tritanopia' ? '#ff65c6' : '#20c9aa';
}
function positionOf(i) {
  return new Vector3(i.position.x, i.position.y, i.position.z);
}
/** Show or hide an object (a no-op for objects not built yet). */
function setVisible(object, visible) {
  if (object) object.visible = !!visible;
}
/** Is keyboard focus on a control that handles its own keys? */
function focusOnControl() {
  return !!document.activeElement?.closest?.("button, input, select, textarea, [contenteditable='true']");
}

/** Start the kit (renderer, input, touch) on the page's canvas, then build the city. */
export async function startCityGame(canvas, onHud) {
  const kit = await boot({
    title: 'Brightline City',
    canvas,
    mount: canvas.parentElement,
    gear: 'none',
    holdLoading: true,
    accent: '#43f0cc',
    background: '#0f2536',
    input: INPUT,
  });
  const game = new CityGame(kit, onHud);
  try {
    await game.initialize();
    return game;
  } catch (err) {
    game.disposeAfterInitializationFailure();
    throw err;
  }
}

export class CityGame {
  constructor(kit, onHud) {
    this.kit = kit;
    this.input = kit.input;
    this.canvas = kit.canvas;
    this.onHud = onHud;
    this.renderer = kit.backendLabel;
    this.cameraMode = 'isometric';
    this.perspectiveYaw = 0;
    this.perspectivePitch = 0.12;
    this.perspectiveDistance = 9;
    this.perspectiveFov = 0.82;
    this.perspectivePosition = new Vector3(-49, 5.2, -53);
    this.perspectiveLook = new Vector3(-49, 2, -44);
    this.lastCameraInputAt = -100;
    this.lastPerspectiveActorYaw = 0;
    this.cameraSnapPending = true;
    this.smokingVehicleId = null;
    this.sharedMaterials = new Map();
    this.playerMeshes = [];
    this.missionObjects = new Map();
    this.attackFx = 0;
    this.playerVelocity = new Vector3();
    this.playerYVelocity = 0;
    this.playerGrounded = true;
    this.playerCrouched = false;
    this.playerSwimming = false;
    this.activeVehicle = null;
    this.vehicles = [];
    this.pedestrians = [];
    this.collectibles = [];
    this.props = [];
    this.colliders = [];
    this.worldChunks = [];
    this.interiors = [];
    this.activeInterior = null;
    this.route = [];
    this.waypoint = null;
    /** Actions pressed since the last simulation step (the step runs at 30 Hz). */
    this.pressed = new Set();
    this.disposed = false;
    this.overlay = 'none';
    this.overlayReturn = 'none';
    this.settings = { ...DEFAULT_SETTINGS };
    this.hasSave = false;
    this.storeKind = null;
    this.accumulator = 0;
    this.simulationTick = 0;
    this.hudTimer = 0;
    this.elapsed = 0;
    this.uiElapsed = 0;
    this.cameraTarget = new Vector3(-46, 0, -42);
    this.isoTarget = new Vector3(-46, 0.9, -42);
    this.cameraViewHeight = 64;
    this.zoomOffset = 0;
    this.health = 100;
    this.armor = 0;
    this.money = 475;
    this.reputation = 0;
    this.outfitIndex = 0;
    this.factionStanding = { civic: 0, couriers: 0, makers: 0, neighborhoods: 0 };
    this.wanted = 0;
    this.heat = 0;
    this.unseenTime = 0;
    this.lastKnownPosition = new Vector3();
    this.incidentCounter = 0;
    this.crimePressure = 0;
    this.reportedIncidents = new Set();
    this.missionId = null;
    this.objectiveIndex = 0;
    this.objectiveEnteredAt = 0;
    this.objectiveSubgoals = new Set();
    this.objectiveHoldTime = 0;
    this.objectiveFailureToastAt = -100;
    this.escapeArmed = false;
    this.carriedMissionItem = null;
    this.missionOptionalProgress = new Set();
    this.missionOptionalStates = new Map();
    this.missionPassengerId = null;
    this.missionRecords = new Map();
    this.completedMissions = new Set();
    this.collected = new Set();
    this.ownedVehicles = new Set();
    this.ownedBusinesses = new Set();
    this.ownedProperties = new Set();
    this.businessLevels = new Map();
    this.propertyLevels = new Map();
    this.activityRecords = new Map();
    this.discoveredDistricts = new Set();
    this.timeOfDay = 9.25;
    this.weather = 'clear';
    this.weatherTimer = 64;
    this.eventTimer = 18;
    this.activeEvent = null;
    this.gameplayReservations = new Map();
    this.eventCooldowns = new Map();
    this.worldEventCounter = 0;
    this.activeActivity = null;
    this.interaction = null;
    this.toasts = [];
    this.toastCounter = 0;
    this.lastDistrict = '';
    this.attackCooldown = 0;
    this.damageCooldown = 0;
    this.hostileToastCooldown = 0;
    this.autosaveTimer = 0;
    this.lastSaveErrorAt = -100;
    this.lastIncomeSegment = -1;
    this.sidewalkNodes = [];
    this.listenerCleanup = [];
    this.overlayRenderTimer = 0;
    this.pointerPress = null;
    this.skyBlend = new THREE.Color();
    this.menuRepeatAt = 0;
    this.menuHeld = '';
    this.touchMode = '';
    this.inputSource = this.input.source;
    /** When the current mission was accepted (simulation seconds), for best times. */
    this.missionStartedAt = 0;
    /** The results banner shown after a mission or an activity. */
    this.result = null;
    this.resultCounter = 0;
    /** Counts hits on the player; each new value replays the HUD's red edge flash. */
    this.hurtCounter = 0;
    this.hurtAt = -10;
    // Scratch vectors for the per-frame paths (no allocations there).
    this.playerPosScratch = new Vector3();
    this.scratchA = new Vector3();
    this.scratchB = new Vector3();
    this.scratchC = new Vector3();
  }

  async initialize() {
    const kit = this.kit;
    this.restoreSettings();
    kit.loading.progress(0.65, 'Opening streets…');
    const renderer = kit.renderer;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    // The sky is a background node rather than a clear colour so it writes
    // nothing into the glow target.
    this.sky = uniform(SKY_DAY.clone()).setGroup(renderGroup);
    this.scene.backgroundNode = this.sky;
    this.fog = installFog(this.scene);
    this.fog.setColor(SKY_DAY);
    this.world = new THREE.Group();
    this.world.name = 'Brightline';
    this.world.scale.x = -1;
    this.scene.add(this.world);

    this.createCamera();
    this.createLighting();
    this.createEnvironmentTexture();
    this.createMaterials();
    this.createWorld();
    kit.loading.progress(0.75, 'Scheduling citizens…');
    await this.loadGltfLandmark();
    this.freezeStaticWorld();
    this.createPlayer();
    this.createObjectiveEffects();
    this.createActivityEffects();
    this.createVehicles();
    this.createPedestrians();
    this.createCollectibles();
    this.createReactiveProps();
    this.updateWorldStreaming(true);
    this.createRain();
    this.createVehicleSmoke();
    this.configurePostProcessing();
    this.restore();
    this.overlay = this.settings.onboardingComplete ? 'title' : 'onboarding';
    this.updateInteriors(true);
    this.bindInput();
    this.updateObjectiveMarker();
    kit.onResize(() => this.updateOrthoBounds());
    kit.loading.progress(0.9, 'Waking traffic…');
    this.renderUpdate(0);
    await this.prewarm();
    kit.start((dt) => this.frame(dt));
    if (this.settings.tutorialHints && this.settings.onboardingComplete)
      this.pushToast(
        'Welcome back to Brightline',
        this.missionId
          ? 'Your tracked mission and world state are ready.'
          : 'Open the mission journal with J or choose your own route through the city.',
        'good',
        6,
      );
    this.emitHud(true);
    kit.loading.done();
  }

  /**
   * Draw one frame with every hidden effect shown (rings, beams, interiors,
   * mission props…) while the loading card is still up, so their pipelines
   * exist before they first appear and nothing hitches mid-game.
   */
  async prewarm() {
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    // The lit brake-light material is only swapped in while a car brakes.
    const firstCar = this.vehicles[0],
      tailMaterial = firstCar?.brakeLight.material;
    firstCar && (firstCar.brakeLight.material = this.vehicleLightMaterials().brake);
    try {
      this.post.render();
    } catch (err) {
      console.warn('Pipeline pre-warm skipped.', err);
    }
    firstCar && (firstCar.brakeLight.material = tailMaterial);
    for (const o of hidden) o.visible = false;
    this.rain.clear();
    this.vehicleSmoke.clear();
    await new Promise((r) => requestAnimationFrame(r));
  }

  /** One display frame: input, the fixed 30 Hz simulation, then the picture. */
  frame(dt) {
    if (this.disposed) return;
    this.readInput(dt);
    this.uiElapsed += dt;
    const toastCount = this.toasts.length;
    this.toasts = this.toasts.filter((n) => n.expires > this.uiElapsed);
    let hudChanged = this.toasts.length !== toastCount;
    if (this.result && this.result.expires <= this.uiElapsed) {
      this.result = null;
      hudChanged = true;
    }
    if (hudChanged) this.emitHud(true);
    const overlayOpen = this.overlay !== 'none';
    if (overlayOpen) {
      // Menus leave the city visible but frozen: redraw it at 12 fps.
      this.overlayRenderTimer += dt;
      if (this.overlayRenderTimer < 1 / 12) return;
      dt = this.overlayRenderTimer;
      this.overlayRenderTimer = 0;
    } else {
      this.overlayRenderTimer = 0;
      for (this.accumulator = Math.min(this.accumulator + dt, FIXED_STEP * 5); this.accumulator >= FIXED_STEP; )
        (this.fixedUpdate(FIXED_STEP), (this.accumulator -= FIXED_STEP));
    }
    this.renderUpdate(Math.min(dt, 0.1));
    this.rain.update(Math.min(dt, 0.1));
    this.vehicleSmoke.update(Math.min(dt, 0.1));
    this.post.render();
  }

  createCamera() {
    this.isoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.8, 265);
    this.perspectiveCamera = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(this.perspectiveFov), 1, 0.1, 230);
    this.appliedFov = this.perspectiveFov;
    this.kit.fitCamera(this.perspectiveCamera);
    // The original isometric view: an orbit camera at yaw -45°, 32° above the
    // horizon, 105 m out, looking at the target with an orthographic lens.
    const alpha = -Math.PI / 4,
      beta = Math.PI / 2 - (32 * Math.PI) / 180,
      radius = 105;
    this.isoOffset = new Vector3(
      Math.cos(alpha) * Math.sin(beta),
      Math.cos(beta),
      Math.sin(alpha) * Math.sin(beta),
    ).multiplyScalar(radius);
    this.camera = this.isoCamera;
  }

  updateOrthoBounds() {
    const { width, height } = this.kit.size;
    const aspect = width / Math.max(1, height),
      r = (this.cameraViewHeight + this.zoomOffset) / 2;
    const cam = this.isoCamera;
    if (cam.top === r && cam.right === r * aspect) return;
    cam.top = r;
    cam.bottom = -r;
    cam.right = r * aspect;
    cam.left = -r * aspect;
    cam.updateProjectionMatrix();
  }

  /** Where the active camera looks, in game coordinates. */
  cameraForward(out = new Vector3()) {
    if (this.cameraMode === 'isometric') return out.copy(this.isoOffset).negate();
    return out.copy(this.perspectiveLook).sub(this.perspectivePosition);
  }

  /** A world object's position in game coordinates (it may be carried by the player or a vehicle). */
  gamePositionOf(object) {
    const p = object.getWorldPosition(new Vector3());
    return this.world.worldToLocal(p);
  }

  createLighting() {
    this.sunDirection = new Vector3(-0.55, -1, 0.38).normalize();
    this.sun = new THREE.DirectionalLight(new THREE.Color(1, 0.86, 0.66), 3.15);
    this.sun.position.set(35, 92, -55);
    this.sun.castShadow = true;
    this.kit.shadow(this.sun, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -86;
    sc.right = 86;
    sc.top = 86;
    sc.bottom = -86;
    sc.near = 1;
    sc.far = 420;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2;
    // The original let 22 % of the sunlight through its shadows.
    this.sun.shadow.intensity = 0.78;
    this.world.add(this.sun, this.sun.target);
    // A hemisphere fill; the original's hemispheric light skipped the 1/π of
    // a physically based diffuse, so its intensity is scaled by π here.
    this.fill = new THREE.HemisphereLight(
      new THREE.Color(0.48, 0.72, 1),
      new THREE.Color(0.29, 0.4, 0.52),
      0.74 * Math.PI,
    );
    this.scene.add(this.fill);
  }

  /** The original's tiny six-colour sky cube for image-based light, at its low level. */
  createEnvironmentTexture() {
    const e = [142, 209, 238],
      t = [236, 201, 160],
      r = [104, 145, 186];
    // Faces are +x −x +y −y +z −z; the world mirror swaps the two x faces.
    const faces = [t, e, r, e, [104, 122, 120], r].map(([cr, cg, cb]) => {
      const c = document.createElement('canvas');
      c.width = c.height = 4;
      const ctx = c.getContext('2d');
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillRect(0, 0, 4, 4);
      return c;
    });
    const cube = new THREE.CubeTexture(faces);
    cube.colorSpace = THREE.SRGBColorSpace;
    cube.needsUpdate = true;
    this.scene.environment = cube;
    this.scene.environmentIntensity = 0.28 * 0.35;
  }

  makePbr(e, t, r = 0.82, s) {
    if (s) {
      let a = this.sharedMaterials.get(s);
      if (a) return a;
    }
    const n = new THREE.MeshStandardMaterial({ name: e, color: linearColor(t), roughness: r, metalness: 0.02 });
    s && this.sharedMaterials.set(s, n);
    return n;
  }

  /** Make a material see-through (the original's material alpha / mesh visibility). */
  setAlpha(material, alpha) {
    material.transparent = true;
    material.opacity = alpha;
    return material;
  }

  createMaterials() {
    this.roadMaterial = this.makePbr('soft asphalt', '#465564', 0.91);
    this.routeMaterial = this.makePbr('navigation route', '#4ef1d3', 0.45);
    this.routeMaterial.emissive = linearColor(routeAccent(this.settings.colorVision), 0.8);
    this.windowMaterial = this.makePbr('window glow', '#d8e9ff', 0.35);
    this.windowMaterial.emissive = linearColor('#ffd87b', 0.12);
  }

  /** A static mesh in the city. */
  addMesh(
    geometry,
    material,
    x = 0,
    y = 0,
    z = 0,
    { receiveShadow = false, castShadow = false, parent = this.world } = {},
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = castShadow;
    parent.add(mesh);
    return mesh;
  }

  /** Many copies of one shape in one draw call. `items` are {x, y, z, sx, sy, sz, ry}. */
  addInstances(geometry, material, items, { receiveShadow = false, castShadow = false } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const m = new THREE.Matrix4(),
      p = new Vector3(),
      s = new Vector3(),
      q = new THREE.Quaternion();
    items.forEach((it, i) => {
      p.set(it.x, it.y, it.z);
      s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
      q.setFromAxisAngle(UP, it.ry ?? 0);
      mesh.setMatrixAt(i, m.compose(p, q, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = receiveShadow;
    mesh.castShadow = castShadow;
    this.world.add(mesh);
    return mesh;
  }

  /** Boxes that share a material, merged into one mesh. `parts` are {w, h, d, x, y, z}. */
  addMergedBoxes(material, parts, opts = {}) {
    const geometries = parts.map(({ w, h, d, x, y, z }) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    return this.addMesh(merged, material, 0, 0, 0, opts);
  }

  createWorld() {
    const e = this.makePbr('city ground', '#78bd71', 0.92);
    this.addMesh(shapes.ground(CITY.width, CITY.depth), e, 0, 0, 0, { receiveShadow: true });
    this.createRoadNetwork();
    this.createDistrictGroundDetails();
    this.createBuildings();
    this.createStreetFurniture();
    this.createBusinessLandmarks();
  }

  async loadGltfLandmark() {
    try {
      const gltf = await new GLTFLoader().loadAsync(new URL('../assets/brightline-beacon.gltf', import.meta.url).href);
      const root = gltf.scene;
      // The original's loader turned the model 180° about Y (its handedness
      // fix) and then set a uniform 1.45 scale.
      root.position.set(-42, 0.24, -31);
      root.rotation.y = Math.PI;
      root.scale.setScalar(1.45);
      root.traverse((o) => {
        if (o.isMesh) {
          o.receiveShadow = true;
          o.castShadow = true;
        }
      });
      this.world.add(root);
    } catch (e) {
      console.info('The optional glTF landmark could not be streamed.', e);
    }
  }

  /** Everything built so far never moves: compute its matrices once. */
  freezeStaticWorld() {
    this.world.traverse((o) => {
      if (o === this.world || o === this.sun || o === this.sun.target) return;
      o.updateMatrix();
      o.matrixAutoUpdate = false;
    });
    this.world.updateMatrixWorld(true);
  }

  updateWorldStreaming(e = false) {
    if (!e && this.simulationTick % 12 !== 0) return;
    let t = this.getPlayerPosition(),
      r = this.cameraMode === 'isometric' ? 150 : 185;
    for (let n of this.worldChunks) {
      let o = flatDistance(n.center, t) <= r;
      for (let c of n.structures) c.visible !== o && (c.visible = o);
    }
  }

  isInsideInterior(e, t) {
    return e.x >= t.bounds.minX && e.x <= t.bounds.maxX && e.z >= t.bounds.minZ && e.z <= t.bounds.maxZ;
  }

  updateInteriors(e = false) {
    let t = this.activeVehicle ? this.safeVehicleExitPosition(this.activeVehicle) : this.getPlayerPosition(),
      r = this.interiors.find((s) => this.isInsideInterior(t, s)) ?? null;
    if (
      (r !== this.activeInterior && ((this.activeInterior = r), (this.cameraSnapPending = true)),
      (this.cameraViewHeight = this.activeInterior ? 38 : this.activeVehicle ? 77 : 64),
      !(!e && this.simulationTick % 12 !== 0))
    )
      for (let s of this.interiors) {
        let n = flatDistance(t, s.exteriorEntry);
        s.root.visible = s === this.activeInterior || n <= 58;
      }
  }

  toggleInterior(e) {
    if (this.activeInterior === e) {
      let t = e.exteriorEntry.clone().add(new Vector3(0, 0, -0.9));
      (this.activeVehicle
        ? (this.activeVehicle.root.position.set(t.x, 0.62, t.z), (this.activeVehicle.speed = 0))
        : (this.player.position.set(t.x, 0.35, t.z), this.playerVelocity.setScalar(0)),
        (this.activeInterior = null),
        (this.cameraViewHeight = this.activeVehicle ? 77 : 64),
        (this.cameraSnapPending = true),
        this.updateInteriors(true),
        this.pushToast(`Exited ${e.business.name}`, 'The city simulation kept moving outside.', 'neutral', 3));
      return;
    }
    if (this.activeVehicle && e.business.service !== 'repair') {
      this.pushToast(`${e.business.name} is walk-in only`, 'Park nearby and enter on foot.', 'neutral', 3);
      return;
    }
    (this.activeVehicle
      ? (this.activeVehicle.root.position.set(e.interiorEntry.x, 0.62, e.interiorEntry.z),
        (this.activeVehicle.speed = 0))
      : (this.player.position.copy(e.interiorEntry), this.playerVelocity.setScalar(0)),
      (this.activeInterior = e),
      (this.cameraViewHeight = 38),
      (this.cameraSnapPending = true),
      this.updateInteriors(true),
      this.pushToast(
        `Entered ${e.business.name}`,
        'Walk to the lit counter for service. Brightline continues outside.',
        'good',
        4,
      ));
  }

  createRoadNetwork() {
    const sidewalk = this.makePbr('warm sidewalk', '#d9d7ca', 0.9),
      paint = this.makePbr('lane paint', '#f4e7a5', 0.75),
      crosswalkPaint = this.makePbr('crosswalk paint', '#f4f2e8', 0.8);
    const beds = [],
      roads = [],
      dashesV = [],
      dashesH = [],
      crossV = [],
      crossH = [];
    for (let [d, m] of ROAD_X.entries()) {
      let _ = d === 1 || d === 2 ? 13 : 11;
      beds.push({ w: _ + 6, h: 0.18, d: CITY.depth - 3, x: m, y: 0.05, z: 0 });
      roads.push({ w: _, h: 0.12, d: CITY.depth - 2, x: m, y: 0.13, z: 0 });
      for (let v = -97; v < 101; v += 10) dashesV.push({ x: m, y: 0.215, z: v });
      this.sidewalkNodes.push(
        new Vector3(m - SIDEWALK_OFFSET, 0.3, -95),
        new Vector3(m + SIDEWALK_OFFSET, 0.3, -95),
        new Vector3(m - SIDEWALK_OFFSET, 0.3, 98),
        new Vector3(m + SIDEWALK_OFFSET, 0.3, 98),
      );
    }
    for (let [d, m] of ROAD_Z.entries()) {
      let _ = d === 1 || d === 2 ? 13 : 11;
      beds.push({ w: CITY.width - 3, h: 0.18, d: _ + 6, x: 0, y: 0.055, z: m });
      roads.push({ w: CITY.width - 2, h: 0.12, d: _, x: 0, y: 0.14, z: m });
      for (let v = -117; v < 121; v += 10) dashesH.push({ x: v, y: 0.22, z: m });
      this.sidewalkNodes.push(
        new Vector3(-117, 0.3, m - SIDEWALK_OFFSET),
        new Vector3(-117, 0.3, m + SIDEWALK_OFFSET),
        new Vector3(118, 0.3, m - SIDEWALK_OFFSET),
        new Vector3(118, 0.3, m + SIDEWALK_OFFSET),
      );
    }
    for (let d of ROAD_X)
      for (let m of ROAD_Z) {
        for (let _ = -3; _ <= 3; _ += 2) {
          crossV.push({ x: d + _, y: 0.225, z: m + 7.1 });
          crossH.push({ x: d + 7.1, y: 0.226, z: m + _ });
        }
        this.sidewalkNodes.push(
          new Vector3(d - SIDEWALK_OFFSET, 0.3, m - SIDEWALK_OFFSET),
          new Vector3(d + SIDEWALK_OFFSET, 0.3, m - SIDEWALK_OFFSET),
          new Vector3(d - SIDEWALK_OFFSET, 0.3, m + SIDEWALK_OFFSET),
          new Vector3(d + SIDEWALK_OFFSET, 0.3, m + SIDEWALK_OFFSET),
        );
      }
    this.addMergedBoxes(sidewalk, beds, { receiveShadow: true });
    this.addMergedBoxes(this.roadMaterial, roads, { receiveShadow: true });
    this.addInstances(shapes.box(0.22, 0.035, 4.6), paint, dashesV);
    this.addInstances(shapes.box(4.6, 0.035, 0.22), paint, dashesH);
    this.addInstances(shapes.box(0.8, 0.04, 4.6), crosswalkPaint, crossV);
    this.addInstances(shapes.box(4.6, 0.04, 0.8), crosswalkPaint, crossH);
    let h = ['#ffdc59', '#55e2c2', '#b39aff'];
    ACTIVITIES.forEach((d, m) => {
      let _ = this.makePbr(`activity pad ${d.id}`, h[m % h.length], 0.55);
      _.emissive = linearColor(h[m % h.length], 0.28);
      this.addMesh(shapes.cylinder({ diameter: 4.8, height: 0.16, tessellation: 12 }), _, d.x, 0.31, d.z);
      this.addMesh(shapes.box(0.35, 3.4, 0.35), _, d.x, 1.95, d.z);
    });
  }

  createDistrictGroundDetails() {
    let e = this.makePbr('tideglass water', '#2eb4c4', 0.27);
    e.metalness = 0.08;
    this.setAlpha(e, 0.96);
    this.addMesh(shapes.ground(17, 96), e, 115.5, 0.3, -50, { receiveShadow: true });
    this.addMesh(shapes.ground(16, 35), this.makePbr('small beach', '#f2cf8a', 0.96), 107, 0.2, -76);
    this.addMesh(shapes.ground(42, 27), this.makePbr('park lawn', '#65c66c', 0.98), -65, 0.22, 63, {
      receiveShadow: true,
    });
    this.addMesh(shapes.ground(37, 30), this.makePbr('Sunline plaza', '#dce7e6', 0.92), -58, 0.23, -42);
    this.addMesh(shapes.ground(43, 30), this.makePbr('maker yard', '#c5b79d', 0.93), 68, 0.235, 64);
  }

  reservedLot(e, t, r, s) {
    return [
      ...BUSINESSES.map((a) => ({ x: a.x, z: a.z, radius: 10 })),
      { x: -42, z: -38, radius: 15 },
      { x: 69, z: 66, radius: 16 },
      { x: 78, z: -54, radius: 14 },
      { x: -65, z: 63, radius: 25 },
    ].some((a) => Math.abs(e - a.x) < r / 2 + a.radius && Math.abs(t - a.z) < s / 2 + a.radius);
  }

  districtAt(e, t) {
    return (
      DISTRICTS.find((r) => e >= r.bounds.minX && e < r.bounds.maxX && t >= r.bounds.minZ && t < r.bounds.maxZ) ??
      DISTRICTS[0]
    );
  }

  /** Which of the 4×4 map cells a point is in (the original streamed the city by these). */
  chunkFor(x, z) {
    const cw = CITY.width / 4,
      cd = CITY.depth / 4;
    const l = clamp(Math.floor((x + HALF_WIDTH) / cw), 0, 3),
      c = clamp(Math.floor((z + HALF_DEPTH) / cd), 0, 3);
    const id = `${l}:${c}`;
    let chunk = this.chunkMap.get(id);
    if (!chunk) {
      chunk = {
        id,
        center: new Vector3(-HALF_WIDTH + (l + 0.5) * cw, 0, -HALF_DEPTH + (c + 0.5) * cd),
        buildings: [],
        roofs: [],
        structures: [],
      };
      this.chunkMap.set(id, chunk);
    }
    return chunk;
  }

  createBuildings() {
    let e = [
        [-119, -103],
        [-88, -40],
        [-24, 24],
        [40, 88],
        [103, 119],
      ],
      t = [
        [-99, -83],
        [-68, -28],
        [-12, 28],
        [44, 78],
        [95, 99],
      ],
      r = this.makePbr('vertex color architecture', '#ffffff', 0.82),
      s = this.makePbr('graphic rooftops', '#64778c', 0.86),
      n = seededRandom(18371),
      a = 0;
    r.vertexColors = true;
    this.chunkMap = new Map();
    this.windowFronts = [];
    this.windowSides = [];
    for (let [l, c] of e)
      for (let [f, u] of t) {
        if (c - l < 22 || u - f < 22) continue;
        let h = (l + c) / 2,
          d = (f + u) / 2,
          m = this.districtAt(h, d),
          _ = m.id === 'garden-row',
          p = m.id === 'maker-yard',
          g = m.id === 'sunline',
          v = c - l > 44 ? 2 : 1,
          S = u - f > 36 ? 2 : 1;
        for (let A = 0; A < v; A += 1)
          for (let T = 0; T < S; T += 1) {
            let C = (c - l) / v,
              I = (u - f) / S,
              M = Math.max(7, C - (4 + n() * 4)),
              F = Math.max(7, I - (4 + n() * 4)),
              N = l + C * (A + 0.5) + (n() - 0.5) * 2,
              D = f + I * (T + 0.5) + (n() - 0.5) * 2;
            if (this.reservedLot(N, D, M, F)) continue;
            let w = 7 + n() * 8;
            (g && (w = 16 + n() * 24),
              _ && (w = 5 + n() * 4),
              p && (w = 6 + n() * 8),
              m.id === 'old-quay' && (w = 8 + n() * 12));
            let ee = BUILDING_COLORS[(a + Math.floor(n() * 3)) % BUILDING_COLORS.length];
            const body = new THREE.BoxGeometry(M, w, F);
            this.applyBuildingVertexColors(body, ee);
            body.translate(N, w / 2 + 0.24, D);
            this.chunkFor(N, D).buildings.push(body);
            const rw = M * (0.35 + n() * 0.28),
              rd = F * (0.35 + n() * 0.28),
              rh = 0.8 + n() * 1.4,
              rx = N + (n() - 0.5) * M * 0.25;
            this.chunkFor(rx, D).roofs.push(new THREE.BoxGeometry(rw, rh, rd).translate(rx, w + 0.7, D));
            this.addGraphicWindows(N, D, M, F, w, a);
            this.colliders.push({
              minX: N - M / 2 - 0.35,
              maxX: N + M / 2 + 0.35,
              minZ: D - F / 2 - 0.35,
              maxZ: D + F / 2 + 0.35,
              maxY: w + 1.8,
              tag: 'building',
            });
            a += 1;
          }
      }
    for (const chunk of this.chunkMap.values()) {
      if (chunk.buildings.length) {
        const mesh = this.addMesh(mergeGeometries(chunk.buildings), r, 0, 0, 0, {
          receiveShadow: true,
          castShadow: true,
        });
        mesh.name = `buildings ${chunk.id}`;
        chunk.structures.push(mesh);
      }
      if (chunk.roofs.length) {
        const mesh = this.addMesh(mergeGeometries(chunk.roofs), s, 0, 0, 0, { receiveShadow: true, castShadow: true });
        mesh.name = `roofs ${chunk.id}`;
        chunk.structures.push(mesh);
      }
      chunk.buildings.forEach((g) => g.dispose());
      chunk.roofs.forEach((g) => g.dispose());
      chunk.buildings = chunk.roofs = null;
    }
    this.worldChunks = [...this.chunkMap.values()];
    this.addInstances(shapes.box(3.4, 1.05, 0.09), this.windowMaterial, this.windowFronts);
    this.addInstances(shapes.box(0.09, 1.05, 3.4), this.windowMaterial, this.windowSides);
  }

  /**
   * Facade colour with baked face shading, as the original did per vertex.
   * (Its roof accent only ever applied to vertex indices its box layout never
   * produced, so every facade is the base colour.)
   */
  applyBuildingVertexColors(geometry, hex) {
    const n = geometry.attributes.normal.array,
      a = linearColor(hex),
      l = new Float32Array((n.length / 3) * 3);
    for (let c = 0; c < n.length / 3; c += 1) {
      let f = n[c * 3],
        u = n[c * 3 + 1],
        h = n[c * 3 + 2],
        m = 0.76 + (f * -0.45 + h * 0.35) * 0.14 + Math.max(0, u) * 0.16;
      m = clamp(m, 0.64, 1.04);
      l[c * 3] = a.r * m;
      l[c * 3 + 1] = a.g * m;
      l[c * 3 + 2] = a.b * m;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(l, 3));
  }

  addGraphicWindows(e, t, r, s, n, a) {
    if (n < 7) return;
    let o = Math.min(4, Math.max(1, Math.floor(n / 6)));
    for (let l = 0; l < o; l += 1) {
      let c = 2.5 + l * ((n - 3) / o),
        f = Math.min(3.4, r * 0.38);
      this.windowFronts.push({ x: e, y: c, z: t - s / 2 - 0.055, sx: f / 3.4 });
      if (r > 12) {
        let h = Math.min(3.4, s * 0.38);
        this.windowSides.push({ x: e + r / 2 + 0.055, y: c, z: t, sz: h / 3.4 });
      }
    }
  }

  createStreetFurniture() {
    let e = this.makePbr('tree trunks', '#8a6543', 0.95),
      t = ['#52b86b', '#72c85d', '#3fa67a'].map((h, d) => this.makePbr(`leaf shade ${d}`, h, 0.93)),
      r = this.makePbr('lamp poles', '#435566', 0.75),
      s = this.makePbr('street lamps', '#ffe7a1', 0.36);
    s.emissive = linearColor('#ffd66b', 0.18);
    let n = seededRandom(5101);
    const trunks = [],
      crowns = [[], [], []];
    [
      [-80, 52],
      [-68, 52],
      [-56, 52],
      [-44, 53],
      [-82, 65],
      [-47, 69],
      [-82, 76],
      [-69, 76],
      [-55, 76],
      [-43, 76],
      [-108, 18],
      [-109, 3],
      [112, -14],
      [111, -31],
      [110, -48],
      [105, -88],
      [18, -89],
      [-17, -89],
    ].forEach(([h, d], m) => {
      trunks.push({ x: h, y: 1.8, z: d });
      let p = m % t.length,
        g = 1.8 + n() * 0.45;
      crowns[p].push({ x: h, y: 4.25, z: d, sx: g / 2, sz: g / 2, sy: 1.15 + n() * 0.35 });
    });
    this.addInstances(
      shapes.cylinder({ height: 3.2, diameterTop: 0.48, diameterBottom: 0.7, tessellation: 6 }),
      e,
      trunks,
    );
    crowns.forEach((items, p) => this.addInstances(shapes.ico(2), t[p], items, { castShadow: true }));
    const poles = [],
      bulbs = [];
    for (let h of ROAD_Z)
      for (let d = -110; d <= 110; d += 28) {
        poles.push({ x: d, y: 2.25, z: h - 8.3 });
        bulbs.push({ x: d, y: 4.45, z: h - 8.3, sy: 1.35 });
      }
    this.addInstances(shapes.cylinder({ height: 4.2, diameter: 0.18, tessellation: 6 }), r, poles);
    this.addInstances(shapes.octa(0.32), s, bulbs);
  }

  createBusinessLandmarks() {
    let e = {
        'orbit-cafe': '#ff6c83',
        'loop-garage': '#45d1b2',
        'merry-motors': '#ffd253',
        'hush-house': '#8f82ff',
        threadline: '#ff78b4',
      },
      t = this.makePbr('open interior shell', '#e8e2d1', 0.9),
      r = this.makePbr('shop counters', '#6e7f8d', 0.82);
    for (let s of BUSINESSES) {
      let n = this.makePbr(`sign ${s.id}`, e[s.id] ?? '#ffffff', 0.5);
      n.emissive = linearColor(e[s.id] ?? '#ffffff', 0.32);
      this.addMesh(shapes.cylinder({ diameter: 5.4, height: 0.18, tessellation: 12 }), n, s.x, 0.31, s.z);
      this.addMesh(shapes.box(4.2, 1.2, 0.45), n, s.x, 3.4, s.z + 4.7);
      if (!s.enterable) continue;
      const l = new THREE.Group();
      l.name = `interior-${s.id}`;
      this.world.add(l);
      const opts = { parent: l };
      this.addMesh(shapes.box(12, 0.2, 9), t, s.x, 0.25, s.z + 8.5, { parent: l, receiveShadow: true });
      this.addMesh(shapes.box(12, 5, 0.3), t, s.x, 2.7, s.z + 12.8, opts);
      for (let m of [-1, 1]) this.addMesh(shapes.box(0.3, 5, 9), t, s.x + m * 5.85, 2.7, s.z + 8.5, opts);
      this.addMesh(shapes.box(5, 1.25, 1.2), r, s.x + 2.4, 0.95, s.z + 10.3, opts);
      this.addMesh(shapes.box(3.4, 0.24, 0.2), n, s.x + 2.4, 3.7, s.z + 12.55, opts);
      this.addMesh(shapes.box(2.7, 0.55, 0.8), r, s.x - 3.2, 0.55, s.z + 10.5, opts);
      l.visible = false;
      this.interiors.push({
        id: s.id,
        business: s,
        root: l,
        exteriorEntry: new Vector3(s.x, 0.35, s.z + 1.5),
        interiorEntry: new Vector3(s.x, 0.35, s.z + 5.25),
        servicePoint: new Vector3(s.x + 2.4, 0.35, s.z + 8.7),
        bounds: { minX: s.x - 5.55, maxX: s.x + 5.55, minZ: s.z + 4, maxZ: s.z + 12.45 },
      });
      this.colliders.push(
        {
          minX: s.x - 6,
          maxX: s.x - 5.68,
          minZ: s.z + 3.9,
          maxZ: s.z + 12.95,
          maxY: 5.3,
          tag: `${s.id}-interior-left`,
        },
        {
          minX: s.x + 5.68,
          maxX: s.x + 6,
          minZ: s.z + 3.9,
          maxZ: s.z + 12.95,
          maxY: 5.3,
          tag: `${s.id}-interior-right`,
        },
        { minX: s.x - 6, maxX: s.x + 6, minZ: s.z + 12.62, maxZ: s.z + 12.98, maxY: 5.3, tag: `${s.id}-interior-back` },
      );
    }
  }

  createPlayer() {
    this.player = new THREE.Group();
    this.player.name = 'player';
    this.player.position.set(-49, 0.35, -44);
    this.world.add(this.player);
    let e = this.makePbr('player skin', '#8f5f47', 0.88),
      t = this.makePbr('player jacket', '#ff5e75', 0.8),
      r = this.makePbr('player trousers', '#364c78', 0.88);
    ((this.playerJacketMaterial = t), (this.playerTrouserMaterial = r));
    let s = this.makePbr('player shoes', '#f6d65b', 0.72);
    const opts = { parent: this.player, receiveShadow: true, castShadow: true };
    const n = this.addMesh(
      shapes.cylinder({ height: 1.25, diameterTop: 0.78, diameterBottom: 0.9, tessellation: 6 }),
      t,
      0,
      1.48,
      0,
      opts,
    );
    const a = this.addMesh(shapes.ico(0.42), e, 0, 2.42, 0, opts);
    const o = [-0.24, 0.24].map((u) =>
      this.addMesh(shapes.cylinder({ height: 0.9, diameter: 0.3, tessellation: 6 }), r, u, 0.55, 0, opts),
    );
    const l = this.addMesh(shapes.box(0.78, 0.18, 0.45), s, 0, 0.12, -0.08, opts);
    this.playerAccessory = this.addMesh(shapes.box(0.68, 0.85, 0.3), t, 0, 1.48, -0.5, opts);
    this.playerAccessory.visible = false;
    this.playerMeshes = [n, a, ...o, l, this.playerAccessory];
    let c = this.makePbr('player contact', '#31516d', 1);
    this.setAlpha(c, 0.25);
    c.depthWrite = false;
    this.addMesh(shapes.disc(0.72, 20), c, 0, 0.015, 0, { parent: this.player });
    this.applyOutfit();
  }

  applyOutfit() {
    let e = OUTFITS[this.outfitIndex % OUTFITS.length];
    this.playerJacketMaterial.color.copy(linearColor(e.jacket));
    this.playerTrouserMaterial.color.copy(linearColor(e.trousers));
    this.playerAccessory.visible = e.accessory && !this.activeVehicle && this.cameraMode !== 'first-person';
  }

  /** A glowing marker material (the original's glow layer included these meshes). */
  glowPbr(name, hex, roughness, emissiveHex, emissiveScale, alpha = 1) {
    const m = this.makePbr(name, hex, roughness);
    m.emissive = linearColor(emissiveHex, emissiveScale);
    if (alpha < 1) this.setAlpha(m, alpha);
    return makeGlow(m);
  }

  /** The same look at a lower opacity (the original's per-mesh visibility). */
  fadedCopy(material, visibility) {
    const m = makeGlow(material.clone());
    this.setAlpha(m, material.opacity * visibility);
    m.depthWrite = false;
    return m;
  }

  createObjectiveEffects() {
    let e = this.glowPbr('objective gold', '#ffe15b', 0.42, '#ffc83d', 0.85, 0.92);
    this.objectiveRing = this.addMesh(shapes.torus(5.5, 0.28, 32), e, 0, 0.4, 0);
    this.objectiveBeam = this.addMesh(
      shapes.cylinder({ height: 8, diameterTop: 0.2, diameterBottom: 2.4, tessellation: 16 }),
      this.fadedCopy(e, 0.24),
      0,
      4,
      0,
    );
    let t = new Map();
    for (let n of MISSIONS.flatMap((a) => a.assets ?? [])) n.kind === 'object' && t.set(n.id, n);
    for (let n of t.values()) {
      let a =
          n.style === 'clipboard'
            ? [0.78, 0.14, 1.05]
            : n.style === 'tag'
              ? [0.82, 0.18, 0.62]
              : n.style === 'toolbox'
                ? [1.2, 0.72, 0.72]
                : [1.15, 0.72, 0.88],
        o = this.glowPbr(`mission object ${n.id}`, n.color, 0.74, n.color, 0.28);
      const l = this.addMesh(shapes.box(...a), o, n.x, n.style === 'tag' ? 0.54 : 0.78, n.z, {
        receiveShadow: true,
        castShadow: true,
      });
      l.rotation.y = Math.PI / 4;
      l.visible = false;
      this.missionObjects.set(n.id, { definition: n, mesh: l });
    }
    let r = this.glowPbr('event cyan', '#3df0d1', 0.48, '#2bd8ba', 0.8);
    this.eventRing = this.addMesh(shapes.torus(4.3, 0.22, 24), r, 0, 0.37, 0);
    this.eventBeam = this.addMesh(
      shapes.cylinder({ height: 5, diameterTop: 0.15, diameterBottom: 1.5, tessellation: 12 }),
      this.fadedCopy(r, 0.2),
      0,
      2.5,
      0,
    );
    this.eventRing.visible = false;
    this.eventBeam.visible = false;
    let s = this.glowPbr('impact pulse', '#ffffff', 0.5, '#ff826e', 0.9, 0.85);
    s.depthWrite = false;
    this.attackRing = this.addMesh(shapes.torus(1.5, 0.17, 24), s, 0, 0, 0);
    this.attackRing.visible = false;
  }

  createActivityEffects() {
    let e = this.glowPbr('activity checkpoint', '#9b86ff', 0.44, '#8068ef', 0.78);
    this.activityRing = this.addMesh(shapes.torus(6.4, 0.32, 28), e, 0, 0.43, 0);
    this.activityRing.visible = false;
    this.activityBeam = this.addMesh(
      shapes.cylinder({ height: 7, diameterTop: 0.1, diameterBottom: 2.2, tessellation: 14 }),
      this.fadedCopy(e, 0.18),
      0,
      3.5,
      0,
    );
    this.activityBeam.visible = false;
    let t = this.makePbr('activity parcel', '#ffd44f', 0.82);
    this.activityCargo = this.addMesh(shapes.box(1.35, 0.78, 1.2), t, 0, 1.55, -0.65, { receiveShadow: true });
    this.activityCargo.visible = false;
  }

  vehicleRoute(e) {
    let t = e % 2 === 0 ? 2.7 : -2.7;
    return e % 3 === 0
      ? [
          new Vector3(-96 + t, 0.6, -76 + t),
          new Vector3(96 - t, 0.6, -76 + t),
          new Vector3(96 - t, 0.6, 88 - t),
          new Vector3(-96 + t, 0.6, 88 - t),
        ]
      : e % 3 === 1
        ? [
            new Vector3(-32 + t, 0.6, -76 + t),
            new Vector3(32 - t, 0.6, -76 + t),
            new Vector3(32 - t, 0.6, 88 - t),
            new Vector3(-32 + t, 0.6, 88 - t),
          ]
        : [
            new Vector3(-96 + t, 0.6, -20 + t),
            new Vector3(96 - t, 0.6, -20 + t),
            new Vector3(96 - t, 0.6, 36 - t),
            new Vector3(-96 + t, 0.6, 36 - t),
          ];
  }

  createVehicles() {
    let e = VEHICLE_TYPES.filter((a) => a.category !== 'police');
    [
      [-61, -73, 0, 0],
      [-18, -23, 0, 1],
      [18, 32, Math.PI / 2, 2],
      [74, 39, 0, 3],
      [67, -23, 0, 0],
      [-72, 91, Math.PI / 2, 1],
      [101, -54, Math.PI / 2, 7],
      [34, -73, 0, 6],
      [-100, 48, 0, 5],
    ].forEach(([a, o, l, c], f) => {
      this.spawnVehicle(`parked-${f}`, e[c % e.length], new Vector3(a, 0.62, o), l, null, []);
    });
    let r = e.find((a) => a.id === 'rivet') ?? e[0];
    this.spawnVehicle('marked-rivet', r, new Vector3(96, 0.62, 52), 0, null, []);
    let s = new Map();
    for (let a of MISSIONS.flatMap((o) => o.assets ?? [])) a.kind === 'vehicle' && s.set(a.id, a);
    for (let a of s.values()) {
      let o = VEHICLE_TYPES.find((c) => c.id === a.vehicleDefinitionId);
      if (!o || this.vehicles.some((c) => c.id === a.id)) continue;
      let l = this.spawnVehicle(a.id, o, new Vector3(a.x, 0.62, a.z), a.yaw, null, []);
      ((l.health = o.durability * clamp(a.healthRatio ?? 1, 0.1, 1)), (l.root.visible = false));
    }
    // Traffic density follows the quality tier (14 cars at high).
    const trafficCount = this.kit.detail(14, 10);
    for (let a = 0; a < trafficCount; a += 1) {
      let o = this.vehicleRoute(a),
        l = o[a % o.length].clone();
      l.x += (a % 3) * 3;
      let c = this.spawnVehicle(`traffic-${a}`, e[a % e.length], l, a % 2 ? Math.PI / 2 : 0, 'traffic', o);
      ((c.routeIndex = (a + 1) % o.length), (c.speed = 5 + (a % 4)));
    }
    let n = VEHICLE_TYPES.find((a) => a.category === 'police') ?? VEHICLE_TYPES[0];
    for (let a = 0; a < 2; a += 1) {
      let o = this.vehicleRoute(a * 2),
        l = this.spawnVehicle(`civic-patrol-${a}`, n, o[(a + 2) % o.length].clone(), a ? Math.PI : 0, 'traffic', o);
      ((l.routeIndex = (a + 3) % o.length), (l.speed = 8));
    }
  }

  /** Body proportions per vehicle class (length, width, body height). */
  vehicleShape(category) {
    const h =
        category === 'bus'
          ? 7.2
          : category === 'truck'
            ? 5.7
            : category === 'van' || category === 'utility'
              ? 4.7
              : category === 'suv'
                ? 4.35
                : category === 'motorcycle'
                  ? 2.35
                  : category === 'sedan'
                    ? 4.25
                    : 3.8,
      d =
        category === 'bus' || category === 'truck'
          ? 2.22
          : category === 'utility' || category === 'suv'
            ? 2.05
            : category === 'motorcycle'
              ? 0.82
              : 1.82,
      m = category === 'bus' ? 1.45 : category === 'truck' ? 1.05 : category === 'motorcycle' ? 0.48 : 0.75;
    return { h, d, m };
  }

  /** All wheels of a vehicle class as one geometry. */
  wheelGeometry(category) {
    this.wheelGeometries ??= new Map();
    let g = this.wheelGeometries.get(category);
    if (g) return g;
    const { h, d } = this.vehicleShape(category);
    const parts = [];
    for (let I of category === 'motorcycle' ? [0] : [-1, 1])
      for (let M of [-1, 1])
        parts.push(
          new THREE.CylinderGeometry(0.31, 0.31, 0.28, 10, 1, false, Math.PI / 2)
            .rotateZ(Math.PI / 2)
            .translate(
              category === 'motorcycle' ? 0 : I * (d / 2 + 0.08),
              category === 'bus' || category === 'truck' ? 0.58 : 0.48,
              M * h * (category === 'bus' ? 0.38 : 0.31),
            ),
        );
    g = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    this.wheelGeometries.set(category, g);
    return g;
  }

  spawnVehicle(e, t, r, s, n, a, o = false) {
    const l = new THREE.Group();
    l.name = `vehicle ${e}`;
    l.position.copy(r);
    l.rotation.y = s;
    this.world.add(l);
    let c = this.makePbr(`vehicle paint ${t.id}`, t.color, 0.42, `vehicle-paint-${t.id}`);
    c.metalness = t.category === 'sport' ? 0.12 : 0.04;
    let f = this.makePbr('shared vehicle glass', '#bde8f2', 0.23, 'vehicle-glass'),
      u = this.makePbr('shared vehicle tires', '#27323b', 0.95, 'vehicle-tires');
    const { h, d, m } = this.vehicleShape(t.category);
    const _ = this.addMesh(
      shapes.box(d, m, h),
      c,
      0,
      t.category === 'bus' ? 1.02 : t.category === 'motorcycle' ? 0.7 : 0.72,
      0,
      {
        parent: l,
        receiveShadow: true,
        castShadow: true,
      },
    );
    const p = this.addMesh(
      shapes.box(
        d * 0.82,
        t.category === 'bus'
          ? 1.35
          : t.category === 'van' || t.category === 'suv'
            ? 1.05
            : t.category === 'motorcycle'
              ? 0.38
              : 0.82,
        t.category === 'bus'
          ? h * 0.72
          : t.category === 'van' || t.category === 'truck'
            ? h * 0.62
            : t.category === 'motorcycle'
              ? h * 0.32
              : h * 0.48,
      ),
      f,
      0,
      t.category === 'bus' ? 2.18 : t.category === 'motorcycle' ? 1.08 : 1.38,
      t.category === 'sport' ? 0.15 : t.category === 'truck' ? 1.05 : 0.05,
      { parent: l, receiveShadow: true },
    );
    this.addMesh(this.wheelGeometry(t.category), u, 0, 0, 0, { parent: l });
    const lights = this.vehicleLightMaterials();
    const A = this.addMesh(shapes.box(d * 0.66, 0.15, 0.08), lights.head, 0, 0.79, h / 2 + 0.045, {
      parent: l,
    });
    const T = this.addMesh(shapes.box(d * 0.68, 0.16, 0.08), lights.tail, 0, 0.78, -h / 2 - 0.045, {
      parent: l,
    });
    if (t.category === 'police') {
      let I = this.sharedMaterials.get('police-red');
      if (!I) {
        I = makeGlow(this.makePbr('police red', '#ff4b64', 0.32, 'police-red'));
        I.emissive = linearColor('#ff2648');
      }
      let M = this.sharedMaterials.get('police-blue');
      if (!M) {
        M = makeGlow(this.makePbr('police blue', '#4aa8ff', 0.32, 'police-blue'));
        M.emissive = linearColor('#218cff');
      }
      this.addMesh(shapes.box(0.62, 0.18, 0.28), I, -0.36, 1.96, 0, { parent: l });
      this.addMesh(shapes.box(0.62, 0.18, 0.28), M, 0.36, 1.96, 0, { parent: l });
    }
    let C = {
      id: e,
      root: l,
      body: _,
      cabin: p,
      headlight: A,
      brakeLight: T,
      definition: t,
      speed: 0,
      health: t.durability,
      collisionRadius: Math.max(1.05, Math.min(2.75, h * 0.38 + d * 0.12)),
      driver: n,
      route: a,
      routeIndex: 0,
      owned: o,
      stolen: false,
      police: t.category === 'police',
      disabledTimer: 0,
      hornCooldown: 0,
      lastImpact: 0,
      braking: false,
      damageState: 'healthy',
      /** Seconds a traffic car has been held up, and the parked car it is easing past. */
      blockedTime: 0,
      passing: null,
    };
    return (this.vehicles.push(C), C);
  }

  /**
   * Vehicle lamps. Every car used to clone its own headlight and brake-light
   * materials just to fade them; all headlights fade together with the clock
   * and brake lights have two states, so three shared materials do the job.
   */
  vehicleLightMaterials() {
    if (!this.lightMaterials) {
      const head = this.makePbr('shared warm headlights', '#fff2b7', 0.35, 'vehicle-headlights');
      head.emissive = linearColor('#ffe49a', 0.9);
      const tail = this.makePbr('shared brake lights', '#ff4962', 0.4, 'vehicle-brake-lights');
      tail.emissive = linearColor('#ff2949', 0.85);
      this.lightMaterials = {
        head: this.setAlpha(head.clone(), 0.12),
        tail: this.setAlpha(tail.clone(), 0.16),
        brake: this.setAlpha(tail.clone(), 1),
      };
    }
    return this.lightMaterials;
  }

  /** The yellow outline the original drew around the vehicle an objective needs. */
  setVehicleOutline(vehicle, on) {
    if (!on && !vehicle.outline) return;
    if (!vehicle.outline) {
      this.outlineMaterial ??= new THREE.MeshBasicMaterial({
        color: linearColor('#ffd84d'),
        side: THREE.BackSide,
        fog: false,
      });
      const { h, d, m } = this.vehicleShape(vehicle.definition.category);
      const w = 0.045 * 2;
      vehicle.outline = new THREE.Mesh(vehicle.body.geometry, this.outlineMaterial);
      vehicle.outline.scale.set(1 + w / d, 1 + w / m, 1 + w / h);
      vehicle.body.add(vehicle.outline);
    }
    vehicle.outline.visible = on;
  }

  createPedestrians() {
    let e = ['commuter', 'shopper', 'jogger', 'worker', 'tourist', 'vendor'],
      t = seededRandom(9427),
      // Crowd density follows the quality tier (34 people at high).
      crowd = this.kit.detail(34, 20);
    for (let s = 0; s < crowd; s += 1) {
      let a = (this.sidewalkNodes[Math.floor(t() * this.sidewalkNodes.length)] ?? new Vector3()).clone();
      ((a.x += (t() - 0.5) * 18),
        (a.z += (t() - 0.5) * 18),
        this.canOccupy(a, 0.58) || a.copy(this.randomSidewalkTarget(s * 193 + 17)),
        this.spawnPedestrian(`civilian-${s}`, e[s % e.length], a, false, PED_COLORS[s % PED_COLORS.length]));
    }
    (this.spawnPedestrian('mara', 'courier', new Vector3(-42, 0.32, -38), true, '#ffd84d'),
      this.spawnPedestrian('pax', 'mechanic', new Vector3(78, 0.32, 27), true, '#3fe0ba'),
      this.spawnPedestrian('sola', 'signal-keeper', new Vector3(70, 0.32, -65), true, '#b18cff'),
      this.spawnPedestrian('nia', 'civic-organizer', new Vector3(78, 0.32, -54), true, '#66aef5'));
    let r = new Map();
    for (let s of MISSIONS.flatMap((n) => n.assets ?? [])) s.kind === 'actor' && r.set(s.id, s);
    for (let s of r.values()) {
      if (this.pedestrians.some((a) => a.id === s.id)) continue;
      this.spawnPedestrian(
        s.id,
        s.archetype,
        new Vector3(s.x, 0.32, s.z),
        s.special ?? true,
        s.color,
        s.combatant ?? false,
      ).root.visible = false;
    }
    (this.spawnPedestrian('yard-crew-0', 'troublemaker', new Vector3(51, 0.32, 79), false, '#6b5cff', true),
      this.spawnPedestrian('yard-crew-1', 'troublemaker', new Vector3(69, 0.32, 79), false, '#ff6d58', true),
      this.spawnPedestrian('yard-crew-2', 'troublemaker', new Vector3(96, 0.32, 44), false, '#4b607c', true));
  }

  spawnPedestrian(e, t, r, s, n, a = false) {
    let o = hashString(e);
    const l = new THREE.Group();
    l.name = `pedestrian ${e}`;
    l.position.copy(r);
    this.world.add(l);
    let c = this.makePbr(`clothes ${n}`, n, 0.86, `ped-clothes-${n}`),
      f = ['#6b422f', '#8d6048', '#b77d5a', '#d49a73', '#efc29d'],
      u = f[e.length % f.length],
      h = this.makePbr(`skin ${u}`, u, 0.9, `ped-skin-${u}`);
    this.addMesh(
      shapes.cylinder({ height: 1.02, diameterTop: 0.55, diameterBottom: 0.67, tessellation: 5 }),
      c,
      0,
      1.22,
      0,
      {
        parent: l,
        receiveShadow: true,
        castShadow: s,
      },
    );
    this.addMesh(shapes.ico(0.31), h, 0, 1.96, 0, { parent: l, receiveShadow: true });
    this.addMesh(shapes.box(0.48, 0.72, 0.35), c, 0, 0.48, 0, { parent: l });
    let p = {
      id: e,
      root: l,
      archetype: t,
      state: s ? 'idle' : 'walk',
      target: this.randomSidewalkTarget(o * 0.013),
      speed: t === 'jogger' ? 2.45 : 1.18 + (o % 5) * 0.11,
      timer: 1 + (o % 5),
      callerForIncident: null,
      special: s,
      phase: (o % 997) * 0.071,
      lastGreeted: -100,
      homeDistrict: this.districtAt(r.x, r.z).id,
      routineSlot: -1,
      sheltering: false,
      combatant: a,
      health: 100,
      lastSeenAt: -100,
    };
    return (this.pedestrians.push(p), p);
  }

  randomSidewalkTarget(e) {
    for (let t = 0; t < 12; t += 1) {
      let r = Math.abs(Math.floor(e * 47 + this.elapsed * 5 + t * 31)) % this.sidewalkNodes.length,
        s = this.sidewalkNodes[r]?.clone() ?? new Vector3(),
        n = ((e * 13 + t * 2.7) % 9) - 4;
      if ((r % 2 === 0 ? (s.x += n) : (s.z += n), this.canOccupy(s, 0.58))) return s;
    }
    return new Vector3(ROAD_X[1] - SIDEWALK_OFFSET, 0.3, ROAD_Z[1]);
  }

  pedestrianRoutineSlot() {
    return this.timeOfDay < 6 || this.timeOfDay >= 22 ? 0 : this.timeOfDay < 9 ? 1 : this.timeOfDay < 17 ? 2 : 3;
  }

  scheduledDistrictFor(e, t) {
    if (t === 0) return e.homeDistrict;
    switch (e.archetype) {
      case 'commuter':
        return t === 3 ? e.homeDistrict : 'sunline';
      case 'worker':
        return t === 2 ? 'maker-yard' : t === 1 ? 'sunline' : e.homeDistrict;
      case 'shopper':
      case 'vendor':
        return t === 2 ? 'old-quay' : e.homeDistrict;
      case 'tourist':
        return t === 3 ? 'garden-row' : 'old-quay';
      case 'jogger':
        return t === 1 || t === 3 ? 'garden-row' : e.homeDistrict;
      default:
        return e.homeDistrict;
    }
  }

  scheduledTargetFor(e, t) {
    let r = this.scheduledDistrictFor(e, t),
      s = this.sidewalkNodes.filter((a) => this.districtAt(a.x, a.z).id === r && this.canOccupy(a, 0.58));
    if (!s.length) return this.randomSidewalkTarget(e.phase * 577 + t);
    let n = (hashString(e.id) + t * 17 + Math.floor(this.elapsed / 9)) % s.length;
    return s[n].clone();
  }

  nearestShelterTarget(e) {
    let t = BUSINESSES.slice().sort(
      (r, s) => flatDistance(e, new Vector3(r.x, 0, r.z)) - flatDistance(e, new Vector3(s.x, 0, s.z)),
    )[0];
    return t ? new Vector3(t.x, 0.32, t.z) : this.randomSidewalkTarget(e.x * 11 + e.z * 7);
  }

  pedestrianCrossingBlocked(e, t) {
    let r = ROAD_X.find((c) => Math.abs(t.x - c) <= 6.1 && Math.abs(e.x - c) > 6.1),
      s = ROAD_Z.find((c) => Math.abs(t.z - c) <= 6.1 && Math.abs(e.z - c) > 6.1);
    if (r === undefined && s === undefined) return false;
    let n =
        r !== undefined
          ? new Vector3(
              r,
              0,
              ROAD_Z.reduce((c, f) => (Math.abs(f - e.z) < Math.abs(c - e.z) ? f : c)),
            )
          : new Vector3(
              ROAD_X.reduce((c, f) => (Math.abs(f - e.x) < Math.abs(c - e.x) ? f : c)),
              0,
              s ?? ROAD_Z[0],
            ),
      a = r !== undefined ? 0 : Math.PI / 2,
      o = !this.signalIsRed(n, a),
      l = this.vehicles.some((c) => c.root.visible && Math.abs(c.speed) > 2 && flatDistance(c.root.position, n) < 9);
    return o || l;
  }

  createCollectibles() {
    let e = this.glowPbr('city spark collectible', '#b18cff', 0.35, '#925cff', 0.9);
    SPARKS.forEach(({ id: t, x: r, z: s }, n) => {
      const a = this.addMesh(shapes.octa(0.72), e, r, 1.35, s);
      a.scale.y = 1.55;
      this.collectibles.push({ id: t, mesh: a, baseY: 1.35, collected: false, phase: n * 0.7 });
    });
  }

  createReactiveProps() {
    let e = this.makePbr('reactive crates', '#d9964d', 0.94),
      t = this.makePbr('traffic cones', '#ff7951', 0.8);
    [
      [55, 52, 'crate'],
      [59, 52, 'crate'],
      [63, 52, 'crate'],
      [70, 79, 'crate'],
      [74, 79, 'crate'],
      [89, 65, 'cone'],
      [86, 61, 'cone'],
      [-24, -62, 'cone'],
      [-21, -59, 'cone'],
      [104, -13, 'crate'],
      [-107, 81, 'cone'],
      [-111, 78, 'cone'],
    ].forEach(([s, n, a]) => {
      const l = this.addMesh(
        a === 'crate'
          ? shapes.box(1.1, 1.1, 1.1)
          : shapes.cylinder({ height: 1.05, diameterTop: 0.16, diameterBottom: 0.72, tessellation: 8 }),
        a === 'crate' ? e : t,
        s,
        a === 'crate' ? 0.75 : 0.72,
        n,
        { receiveShadow: true },
      );
      this.props.push({ mesh: l, velocity: new Vector3(), angularVelocity: 0, disturbed: false });
    });
  }

  createRain() {
    const map = canvasTexture(8, 32, (t) => {
      t.clearRect(0, 0, 8, 32);
      t.fillStyle = 'rgba(205,238,255,0.9)';
      t.fillRect(3, 1, 2, 30);
    });
    this.rain = new Particles({
      capacity: 850,
      map,
      color1: [0.7, 0.9, 1, 0.65],
      color2: [0.55, 0.8, 1, 0.5],
      minSize: 0.05,
      maxSize: 0.11,
      minLife: 0.42,
      maxLife: 0.72,
      emitRate: this.settings.reducedMotion ? 130 : 620,
      dir1: [-1.2, -35, 0.2],
      dir2: [-0.4, -42, 0.8],
      gravity: [0, -12, 0],
      boxMin: [-38, 0, -38],
      boxMax: [38, 0, 38],
    });
    this.rain.emitter.set(-40, 20, -40);
    this.scene.add(this.rain.object);
  }

  createVehicleSmoke() {
    const map = canvasTexture(24, 24, (t) => {
      t.clearRect(0, 0, 24, 24);
      t.fillStyle = 'rgba(91,105,112,0.72)';
      t.beginPath();
      t.moveTo(12, 1);
      t.lineTo(23, 12);
      t.lineTo(12, 23);
      t.lineTo(1, 12);
      t.closePath();
      t.fill();
    });
    this.vehicleSmoke = new Particles({
      capacity: 220,
      map,
      color1: [0.32, 0.38, 0.4, 0.58],
      color2: [0.55, 0.58, 0.56, 0.32],
      minSize: 0.35,
      maxSize: 0.9,
      minLife: 0.65,
      maxLife: 1.4,
      emitRate: this.settings.reducedMotion ? 18 : 48,
      dir1: [-0.35, 1.8, -0.35],
      dir2: [0.35, 3.2, 0.35],
      gravity: [0, 0.4, 0],
      boxMin: [-0.25, 0, -0.25],
      boxMax: [0.25, 0.15, 0.25],
    });
    this.vehicleSmoke.emitter.set(0, -20, 0);
    this.scene.add(this.vehicleSmoke.object);
  }

  normalizeSettings(e) {
    return normalizeSettings(e);
  }
  restoreSettings() {
    let e = typeof window < 'u' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      t = { ...DEFAULT_SETTINGS, reducedMotion: e };
    if (typeof window > 'u') {
      this.settings = normalizeSettings(t, t);
      return;
    }
    try {
      let r = localStorage.getItem(SETTINGS_KEY);
      this.settings = normalizeSettings(r ? { ...t, ...JSON.parse(r) } : t, t);
    } catch (r) {
      (console.warn('Settings could not be restored; defaults are active.', r),
        (this.settings = normalizeSettings(t, t)));
    }
  }
  persistSettings() {
    if (!(typeof window > 'u'))
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
      } catch (e) {
        (console.warn('Settings could not be saved on this device.', e),
          this.scene &&
            this.pushToast(
              'Settings not saved',
              'Browser storage is blocked or full. Your changes work for this session only.',
              'danger',
              5,
            ));
      }
  }
  updateSettings(e) {
    let r = this.settings.reducedMotion;
    ((this.settings = this.normalizeSettings({ ...this.settings, ...e })),
      this.persistSettings(),
      this.masterGain &&
        this.audioContext &&
        this.masterGain.gain.setTargetAtTime(this.settings.masterVolume, this.audioContext.currentTime, 0.04),
      this.rain && (this.rain.emitRate = this.settings.reducedMotion ? 130 : 620),
      this.vehicleSmoke && (this.vehicleSmoke.emitRate = this.settings.reducedMotion ? 18 : 48),
      this.routeMaterial && this.routeMaterial.emissive.copy(linearColor(routeAccent(this.settings.colorVision), 0.82)),
      this.post && (this.configurePostProcessing(), r !== this.settings.reducedMotion && this.emitHud(true)),
      this.emitHud(true));
  }
  incomingDamageMultiplier() {
    return this.settings.difficulty === 'relaxed' ? 0.62 : this.settings.difficulty === 'challenging' ? 1.28 : 1;
  }
  searchCoolingMultiplier() {
    return this.settings.difficulty === 'relaxed' ? 1.35 : this.settings.difficulty === 'challenging' ? 0.8 : 1;
  }
  activityTimeMultiplier() {
    return this.settings.difficulty === 'relaxed' ? 1.2 : this.settings.difficulty === 'challenging' ? 0.9 : 1;
  }
  /**
   * The finish: neutral tone mapping at exposure 1.05, contrast 1.12 (1.24
   * with high contrast), selective glow on markers, and a faint HDR bloom
   * that reduced motion turns off, as before. Anti-aliasing and bloom
   * resolution follow the kit's quality tier.
   */
  configurePostProcessing() {
    this.post ??= createCityPost(this.kit, this.scene, this.camera);
    this.post.setCamera(this.camera);
    this.post.contrast.value = this.settings.highContrast ? 1.24 : 1.12;
    this.post.hdrGain.value = this.settings.reducedMotion ? 0 : 1;
  }
  /** Open the shared graphics / display / controls panel (quality tiers live there). */
  openDisplaySettings() {
    this.kit.menu.open();
  }
  bindInput() {
    // Audio can only start inside a user gesture.
    const unlock = () => this.ensureAudio();
    const hidden = () => {
      document.hidden && this.persistOnLeave();
      document.hidden &&
        this.overlay === 'none' &&
        ((this.overlay = 'pause'), (this.overlayReturn = 'none'), this.clearHeldInput(), this.emitHud(true));
    };
    const leaving = () => this.persistOnLeave();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pagehide', leaving);
    document.addEventListener('visibilitychange', hidden);
    const offPause = this.kit.onPause((paused) => {
      const ctx = this.audioContext;
      if (!ctx) return;
      paused ? ctx.suspend().catch(() => {}) : ctx.resume().catch(() => {});
    });
    const offSource = this.input.onSourceChange((source) => {
      this.inputSource = source;
      // A controller never sends the pointer or key events that unlock audio;
      // browsers that count its buttons as a gesture start the sound here.
      source === 'gamepad' && this.ensureAudio();
      this.emitHud(true);
    });
    this.listenerCleanup.push(
      () => window.removeEventListener('pointerdown', unlock, true),
      () => window.removeEventListener('keydown', unlock, true),
      () => window.removeEventListener('pagehide', leaving),
      () => document.removeEventListener('visibilitychange', hidden),
      offPause,
      offSource,
    );
    this.updateTouchControls();
  }

  /**
   * Keep progress when the tab is hidden or closed: the autosave only runs
   * every 80 seconds, and phones often discard a hidden tab. Like the
   * autosave it skips a live pursuit, and nothing is written before the
   * player has entered the city.
   */
  persistOnLeave() {
    if (this.disposed || this.wanted > 0) return;
    const beforePlay = (o) => o === 'title' || o === 'onboarding' || o === 'confirm';
    if (beforePlay(this.overlay) || beforePlay(this.overlayReturn)) return;
    this.save(false);
  }

  /** Is `action` the key that closes the overlay that is open now? */
  isOverlayToggle(action) {
    return (
      (this.overlay === 'map' && action === 'map') ||
      (this.overlay === 'help' && action === 'help') ||
      (this.overlay === 'settings' && action === 'options') ||
      (this.overlay === 'journal' && action === 'journal')
    );
  }

  /**
   * Read the kit's actions once per display frame. Menu keys act at once;
   * gameplay presses are latched until the next 30 Hz simulation step, as
   * the original's key handler did.
   */
  readInput(dt) {
    const input = this.input;
    const pad = input.source === 'gamepad';
    // Keyboard focus on a control inside an open menu: only Escape and the key
    // of the open overlay act, so menu keys never leak through a focused
    // button or field. A HUD button clicked during play does not hold the
    // hotkeys hostage.
    const guarded = !pad && this.overlay !== 'none' && focusOnControl();
    const allow = (action) => !guarded || action === 'back' || this.isOverlayToggle(action);
    // Keep offering to start the sound while a controller player presses buttons.
    pad &&
      this.audioContext?.state !== 'running' &&
      (input.pressed('jump') || input.pressed('pause') || input.pressed('interact')) &&
      this.ensureAudio();
    if (input.pressed('back') && allow('back')) return this.closeTopOverlay();
    if (input.pressed('pause') && allow('pause')) return this.togglePause();
    if (input.pressed('map') && allow('map')) return this.toggleMap();
    if (input.pressed('help') && allow('help')) return this.toggleHelp();
    if (input.pressed('options') && allow('options')) return this.toggleSettings();
    if (input.pressed('journal') && allow('journal')) return this.toggleJournal();

    if (this.overlay !== 'none') {
      this.pointerPress = null;
      this.navigateMenu(dt);
      return;
    }
    this.menuHeld = '';
    for (const action of ['jump', 'interact', 'fire', 'horn', 'reset'])
      if (input.pressed(action)) this.pressed.add(action);
    if (input.pressed('camera')) this.cycleCamera();

    // A mouse click that does not drag is a shove, as before.
    const p = input.pointer;
    if (p.justDown)
      this.pointerPress = { x: p.x, y: p.y, moved: 0, mouse: p.type === 'mouse' && input.mouseButtons.has(0) };
    else if (this.pointerPress && p.down) {
      this.pointerPress.moved += Math.abs(p.x - this.pointerPress.x) + Math.abs(p.y - this.pointerPress.y);
      this.pointerPress.x = p.x;
      this.pointerPress.y = p.y;
    }
    if (p.justUp && this.pointerPress) {
      if (this.pointerPress.moved < 5 && this.pointerPress.mouse && !this.activeVehicle) this.pressed.add('fire');
      this.pointerPress = null;
    }

    // Look: mouse / touch drags keep the original's per-pixel speed; the
    // stick already arrives in radians per frame.
    const look = input.look('look');
    if (this.cameraMode !== 'isometric' && (look.x || look.y)) {
      const sens = this.settings.cameraSensitivity;
      const kx = pad ? 1 : 0.006 / 0.0024,
        ky = pad ? 1 : 0.0045 / 0.0024;
      this.perspectiveYaw += look.x * kx * sens;
      this.perspectivePitch = clamp(this.perspectivePitch - look.y * ky * sens, -0.72, 0.68);
      this.lastCameraInputAt = this.elapsed;
    }

    // Zoom: wheel notches and pinch (+ is in), or the shoulder buttons.
    const zoom = input.zoom() + ((input.down('zoomIn') ? 1 : 0) - (input.down('zoomOut') ? 1 : 0)) * dt * 6;
    if (zoom) {
      const out = -zoom;
      this.cameraMode === 'isometric'
        ? (this.zoomOffset = clamp(this.zoomOffset + out * 4, -16, 24))
        : this.cameraMode === 'third-person'
          ? (this.perspectiveDistance = clamp(this.perspectiveDistance + out * 0.9, 5.5, 15))
          : (this.perspectiveFov = clamp(this.perspectiveFov + out * 0.04, 0.58, 0.95));
    }
    this.updateTouchControls();
  }

  /** On-screen buttons follow the situation: on foot or driving, menus open or not. */
  updateTouchControls() {
    const touch = this.kit.touch;
    if (!touch) return;
    // The big button says what it will do right now.
    const useLabel = this.interactionButtonLabel();
    if (useLabel !== this.touchUseLabel) {
      this.touchUseLabel = useLabel;
      touch.setLabel('interact', useLabel);
    }
    const mode = this.overlay !== 'none' ? 'menu' : this.activeVehicle ? 'drive' : 'foot';
    if (mode === this.touchMode) return;
    this.touchMode = mode;
    touch.suspend(mode === 'menu', 'overlay');
    const driving = mode === 'drive';
    touch.setLabel('jump', driving ? 'Brake' : 'Jump');
    for (const name of ['fire', 'sprint', 'crouch']) touch.setShown(name, !driving);
    for (const name of ['horn', 'reset']) touch.setShown(name, driving);
  }

  /** What the interact button does right now: Exit a car, Enter one, or Use anything else. */
  interactionButtonLabel() {
    const kind = this.interaction?.kind;
    return kind === 'exit' ? 'Exit' : kind === 'vehicle' ? 'Enter' : 'Use';
  }

  /**
   * Gamepad control of the HTML menus: stick / D-pad moves between the
   * controls of the open dialog (left / right change a list or slider),
   * A activates, B goes back, Start resumes.
   */
  navigateMenu(dt) {
    const input = this.input;
    if (input.source !== 'gamepad') return;
    const root = document.querySelector('.confirm-dialog, .overlay-screen');
    if (!root) return;
    const items = [
      ...root.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    let current = items.indexOf(document.activeElement);
    const mark = (el) => {
      document.querySelectorAll('.pad-focus').forEach((n) => n !== el && n.classList.remove('pad-focus'));
      el?.classList.add('pad-focus');
    };
    if (current < 0) {
      // Start where the dialog itself would: its main action, else its first control.
      current = Math.max(0, items.findIndex((c) => c.classList.contains('primary-action')));
      items[current].focus({ preventScroll: false });
    }
    const el = items[current];
    mark(el);

    const v = input.vector('move');
    const dir =
      Math.abs(v.y) > 0.5 ? (v.y > 0 ? 'up' : 'down') : Math.abs(v.x) > 0.5 ? (v.x > 0 ? 'right' : 'left') : '';
    const now = performance.now();
    let step = '';
    if (dir && (dir !== this.menuHeld || now >= this.menuRepeatAt)) {
      step = dir;
      this.menuRepeatAt = now + (dir !== this.menuHeld ? 380 : 130);
    }
    this.menuHeld = dir;
    const isMap = el.matches('svg, .city-map');
    const key = (k) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    if (step) {
      if (isMap) key({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }[step]);
      else if ((step === 'left' || step === 'right') && (el.tagName === 'SELECT' || el.type === 'range'))
        this.stepControl(el, step === 'right' ? 1 : -1);
      else {
        const next = items[(current + (step === 'down' || step === 'right' ? 1 : -1) + items.length) % items.length];
        next.focus();
        next.scrollIntoView?.({ block: 'nearest' });
        mark(next);
      }
    }
    if (input.pressed('jump')) {
      if (isMap) key('Enter');
      else el.click();
    } else if (input.pressed('sprint')) {
      this.overlay === 'confirm' ? this.cancelNewGame() : this.closeTopOverlay();
    }
  }

  /** Change a select or slider the way a person would, so React sees the change. */
  stepControl(el, dir) {
    if (el.tagName === 'SELECT') {
      const i = clamp(el.selectedIndex + dir, 0, el.options.length - 1);
      if (i === el.selectedIndex) return;
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      set.call(el, el.options[i].value);
    } else {
      const step = Number(el.step) || 0.05;
      const value = clamp(Number(el.value) + dir * step, Number(el.min), Number(el.max));
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(el, String(Math.round(value / step) * step));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  cycleCamera() {
    let e = ['isometric', 'third-person', 'first-person'],
      t = e[(e.indexOf(this.cameraMode) + 1) % e.length];
    this.setCameraMode(t, true);
  }
  setCameraMode(e, t) {
    if (this.cameraMode === e && !t) {
      (this.cameraTarget.copy(this.getPlayerPosition()),
        (this.cameraSnapPending = true),
        this.applyCameraVisibility(),
        this.updateWorldStreaming(true));
      return;
    }
    if (
      ((this.cameraMode = e),
      this.cameraTarget.copy(this.getPlayerPosition()),
      (this.cameraSnapPending = true),
      e === 'isometric')
    )
      this.camera = this.isoCamera;
    else {
      let r = this.activeVehicle?.root ?? this.player;
      ((this.perspectiveYaw = r.rotation.y),
        (this.lastPerspectiveActorYaw = r.rotation.y),
        (this.perspectivePitch = e === 'first-person' ? 0.04 : 0.16),
        (this.perspectiveFov = e === 'first-person' ? 0.9 : 0.82),
        (this.camera = this.perspectiveCamera));
    }
    this.post?.setCamera(this.camera);
    if ((this.applyCameraVisibility(), this.updateWorldStreaming(true), t)) {
      let r =
        e === 'isometric'
          ? 'Isometric overview'
          : e === 'third-person'
            ? 'Behind-player camera'
            : 'First-person camera';
      (this.pushToast(r, 'Press C or use the camera button to change view.', 'neutral', 3.5), this.emitHud(true));
    }
  }
  applyCameraVisibility() {
    let e = !this.activeVehicle && this.cameraMode !== 'first-person';
    setVisible(this.player, e);
    for (let r of this.playerMeshes) setVisible(r, e);
    let t = OUTFITS[this.outfitIndex % OUTFITS.length];
    setVisible(this.playerAccessory, e && t.accessory);
    for (let r of this.vehicles) r.cabin.visible = !(r === this.activeVehicle && this.cameraMode === 'first-person');
  }
  clearHeldInput() {
    this.pressed.clear();
    this.pointerPress = null;
    this.input.settle();
  }
  openOverlay(e) {
    ((this.storeKind = null),
      this.overlay === e
        ? ((this.overlay = this.overlayReturn), (this.overlayReturn = 'none'))
        : ((this.overlayReturn =
            this.overlay === 'pause' || this.overlay === 'onboarding' || this.overlay === 'title'
              ? this.overlay
              : 'none'),
          (this.overlay = e)),
      this.clearHeldInput(),
      this.emitHud(true));
  }
  closeTopOverlay() {
    if (this.overlay !== 'onboarding' && this.overlay !== 'title') {
      if (this.overlay === 'confirm') {
        this.cancelNewGame();
        return;
      }
      (this.overlay === 'store' && (this.storeKind = null),
        this.overlay === 'pause'
          ? ((this.overlay = 'none'), (this.overlayReturn = 'none'))
          : this.overlay !== 'none'
            ? ((this.overlay = this.overlayReturn), (this.overlayReturn = 'none'))
            : (this.overlay = 'pause'),
        this.clearHeldInput(),
        this.emitHud(true));
    }
  }
  togglePause() {
    this.overlay === 'onboarding' ||
      this.overlay === 'title' ||
      ((this.overlay = this.overlay === 'pause' ? 'none' : 'pause'),
      (this.storeKind = null),
      (this.overlayReturn = 'none'),
      this.clearHeldInput(),
      this.emitHud(true));
  }
  toggleMap() {
    this.overlay === 'onboarding' || this.overlay === 'confirm' || this.openOverlay('map');
  }
  toggleHelp() {
    this.overlay === 'onboarding' || this.overlay === 'confirm' || this.openOverlay('help');
  }
  toggleSettings() {
    this.overlay !== 'confirm' && this.openOverlay('settings');
  }
  toggleJournal() {
    this.overlay === 'onboarding' || this.overlay === 'confirm' || this.openOverlay('journal');
  }
  missionIsAvailable(e) {
    return !e.prerequisiteMission || this.completedMissions.has(e.prerequisiteMission);
  }
  missionScopeId(e) {
    return `mission:${e.id}`;
  }
  missionAsset(e, t) {
    return e.assets?.find((r) => r.id === t);
  }
  activeMissionOwnsAsset(e) {
    return !!this.activeMission()?.assets?.some((t) => t.id === e);
  }
  isMissionAssetKind(e, t) {
    return MISSION_ASSET_KINDS.get(e) === t;
  }
  missionItemIds(e) {
    return new Set(e.objectives.flatMap((t) => [t.grantsItemId, t.requiresItemId].filter((r) => !!r)));
  }
  restoreBoundVehicle(e) {
    if (!e.requiredVehicleId || e.x === undefined || e.z === undefined) return;
    let t = this.vehicles.find((r) => r.id === e.requiredVehicleId);
    t &&
      (this.activeVehicle === t && this.exitVehicle(true),
      t.root.position.set(e.x, 0.62, e.z),
      (t.root.rotation.y = 0),
      setVisible(t.root, true),
      (t.driver = null),
      (t.speed = 0),
      (t.health = t.definition.durability),
      (t.damageState = 'healthy'),
      (t.stolen = false),
      (t.disabledTimer = 0),
      (t.braking = false));
  }
  prepareMissionAssets(e, t = false) {
    for (let n of e.objectives) this.restoreBoundVehicle(n);
    let r = this.missionItemIds(e);
    (!t && this.carriedMissionItem && r.has(this.carriedMissionItem) && (this.carriedMissionItem = null),
      t ||
        (this.missionOptionalProgress.clear(),
        (this.missionOptionalStates = new Map((e.optionalObjectives ?? []).map((n) => [n.id, 'active']))),
        (this.missionPassengerId = null)));
    for (let n of e.assets ?? [])
      if (n.kind === 'actor') {
        let a = this.pedestrians.find((c) => c.id === n.id);
        if (!a) continue;
        let o = this.currentObjective(),
          l = t && o?.requiredActorId === n.id && o.x !== undefined && o.z !== undefined;
        (a.root.position.set(l ? o.x : n.x, 0.32, l ? o.z : n.z),
          a.root.rotation.set(0, 0, 0),
          setVisible(a.root, this.missionPassengerId !== a.id),
          (a.state = 'idle'),
          (a.timer = 1),
          (a.health = 100),
          (a.callerForIncident = null),
          (a.missionRole = this.missionPassengerId === a.id ? 'passenger' : undefined));
      } else if (n.kind === 'vehicle') {
        let a = this.vehicles.find((o) => o.id === n.id);
        if (!a) continue;
        (this.activeVehicle === a && this.exitVehicle(true),
          a.root.position.set(n.x, 0.62, n.z),
          a.root.rotation.set(0, n.yaw, 0),
          setVisible(a.root, true),
          (a.driver = null),
          (a.speed = 0),
          (a.health = a.definition.durability * clamp(n.healthRatio ?? 1, 0.1, 1)),
          (a.damageState = a.health < a.definition.durability * 0.7 ? 'damaged' : 'healthy'),
          (a.stolen = false),
          (a.disabledTimer = 0),
          (a.braking = false));
      } else {
        let a = this.missionObjects.get(n.id);
        if (!a) continue;
        (this.world.add(a.mesh),
          a.mesh.position.set(n.x, n.style === 'tag' ? 0.54 : 0.78, n.z),
          a.mesh.rotation.set(0, Math.PI / 4, 0),
          a.mesh.scale.setScalar(1));
      }
    let s = new Set(e.objectives.flatMap((n) => n.hostileIds ?? []));
    for (let n of s) {
      let a = this.pedestrians.find((o) => o.id === n);
      a &&
        !this.entityIsReserved('pedestrian', a) &&
        this.reserveGameplayEntity(this.missionScopeId(e), 'pedestrian', a);
    }
    (this.activateCurrentMissionObjective(),
      this.suppressCompletedMissionDefenders(e),
      this.updateMissionObjectVisuals());
  }
  releaseMissionAssets(e) {
    let t = this.missionItemIds(e);
    if (
      (this.carriedMissionItem && t.has(this.carriedMissionItem) && (this.carriedMissionItem = null),
      this.missionPassengerId)
    ) {
      let r = this.pedestrians.find((s) => s.id === this.missionPassengerId);
      (r && ((r.missionRole = undefined), setVisible(r.root, false)), (this.missionPassengerId = null));
    }
    for (let r of e.objectives) this.restoreBoundVehicle(r);
    for (let r of e.assets ?? [])
      if (r.kind === 'actor') {
        let s = this.pedestrians.find((n) => n.id === r.id);
        s && ((s.missionRole = undefined), setVisible(s.root, false));
      } else if (r.kind === 'vehicle') {
        let s = this.vehicles.find((n) => n.id === r.id);
        s &&
          (this.activeVehicle === s && this.exitVehicle(true),
          (s.driver = null),
          (s.speed = 0),
          setVisible(s.root, false));
      } else {
        let s = this.missionObjects.get(r.id);
        s && (this.world.add(s.mesh), setVisible(s.mesh, false));
      }
    (this.releaseGameplayScope(this.missionScopeId(e)),
      this.missionOptionalProgress.clear(),
      this.missionOptionalStates.clear(),
      this.updateMissionObjectVisuals());
  }
  activateCurrentMissionObjective() {
    let e = this.currentObjective();
    if (e?.kind !== 'defend' || e.x === undefined || e.z === undefined) return;
    let t = (e.hostileIds ?? []).map((r) => this.pedestrians.find((s) => s.id === r)).filter((r) => !!r);
    for (let [r, s] of t.entries()) {
      let n = (r / Math.max(1, t.length)) * Math.PI * 2 + 0.4,
        a = new Vector3(e.x + Math.cos(n) * 8, 0.32, e.z + Math.sin(n) * 8);
      (this.canOccupy(a, 0.58) && s.root.position.copy(a),
        (s.root.rotation.z = 0),
        setVisible(s.root, true),
        (s.health = 100),
        (s.state = 'idle'),
        (s.timer = 0),
        (s.lastSeenAt = -100));
    }
  }
  suppressCompletedMissionDefenders(e) {
    for (let [t, r] of e.objectives.entries())
      if (!(t >= this.objectiveIndex || r.kind !== 'defend'))
        for (let s of this.defendHostiles(r))
          ((s.health = 0), (s.state = 'down'), (s.timer = 1e6), (s.callerForIncident = null));
  }
  missionJournalEntries() {
    return MISSIONS.map((e) => {
      let t = e.faction ? FACTIONS.find((p) => p.id === e.faction) : undefined,
        r = e.id === this.missionId,
        s = this.completedMissions.has(e.id),
        n = this.missionIsAvailable(e),
        a = r ? 'current' : n ? (s ? 'completed' : 'available') : 'locked',
        o = e.prerequisiteMission ? MISSIONS.find((p) => p.id === e.prerequisiteMission) : undefined,
        l = !!(this.missionId && !r),
        c = !!(this.activeActivity && !r),
        f =
          a === 'locked'
            ? `Complete ${o?.title ?? 'the previous chapter'}`
            : c
              ? 'Finish the current activity first'
              : l
                ? 'Finish or abandon the current mission first'
                : '',
        u = this.missionRecords.get(e.id),
        h = e.optionalObjectives?.length ?? 0,
        d = u?.completedOptionals.length ?? 0,
        m = e.chainId ? MISSIONS.filter((p) => p.chainId === e.chainId).length : 0,
        _ = e.chainTitle && e.chainOrder ? `${e.chainTitle} \xB7 ${e.chainOrder}/${m}` : (t?.name ?? 'Brightline');
      return {
        id: e.id,
        title: e.title,
        giver: e.giver,
        summary: e.summary,
        reward: s ? Math.max(100, Math.round(e.reward * 0.25)) : e.reward,
        faction: _,
        factionColor: t?.color ?? '#ffe05c',
        status: a,
        progress: r
          ? `Objective ${Math.min(this.objectiveIndex + 1, e.objectives.length)} of ${e.objectives.length}${h ? ` \xB7 ${[...this.missionOptionalStates.values()].filter((p) => p === 'completed').length}/${h} optional` : ''}`
          : s
            ? `Chapter completed${h ? ` \xB7 ${d}/${h} optional` : ''} \xB7 replay reward reduced`
            : `${e.objectives.length} objectives`,
        lockedReason: f,
        actionLabel: r ? 'Track current mission' : s ? 'Replay mission' : 'Accept mission',
        best: u?.bestTime ? formatDuration(u.bestTime) : '',
      };
    });
  }
  acceptMission(e) {
    if (this.overlay !== 'journal') return;
    let t = MISSIONS.find((r) => r.id === e);
    if (!(!t || !this.missionIsAvailable(t))) {
      if (this.activeActivity) {
        (this.pushToast('Mission unavailable', 'Finish the current activity first.', 'neutral', 3.5),
          this.emitHud(true));
        return;
      }
      if (this.missionId && this.missionId !== e) {
        (this.pushToast('Mission already active', 'Finish or abandon it from the journal first.', 'neutral', 4),
          this.emitHud(true));
        return;
      }
      if (this.missionId === e) {
        ((this.overlay = this.overlayReturn), (this.overlayReturn = 'none'), this.emitHud(true));
        return;
      }
      ((this.missionId = t.id),
        (this.objectiveIndex = 0),
        (this.objectiveEnteredAt = this.elapsed),
        (this.missionStartedAt = this.elapsed),
        this.objectiveSubgoals.clear(),
        (this.objectiveHoldTime = 0),
        (this.objectiveFailureToastAt = -100),
        (this.escapeArmed = false),
        (this.waypoint = null),
        this.prepareMissionAssets(t),
        (this.overlay = this.overlayReturn),
        (this.overlayReturn = 'none'),
        this.updateObjectiveMarker(),
        this.pushToast(
          this.completedMissions.has(t.id) ? `Replay \xB7 ${t.title}` : `Mission accepted \xB7 ${t.title}`,
          `${t.giver} \xB7 ${t.summary}`,
          'good',
          6,
        ),
        this.save(false),
        this.emitHud(true));
    }
  }
  abandonCurrentMission() {
    if (this.overlay !== 'journal' || !this.missionId) return;
    let e = this.activeMission();
    (e && this.releaseMissionAssets(e),
      (this.missionId = null),
      (this.objectiveIndex = 0),
      (this.objectiveEnteredAt = this.elapsed),
      this.objectiveSubgoals.clear(),
      (this.objectiveHoldTime = 0),
      (this.objectiveFailureToastAt = -100),
      (this.escapeArmed = false),
      (this.waypoint = null),
      this.updateObjectiveMarker(),
      this.pushToast(
        'Mission set aside',
        `${e?.title ?? 'The mission'} can be accepted again from the journal.`,
        'neutral',
        4.5,
      ),
      this.save(false),
      this.emitHud(true));
  }
  completeOnboarding() {
    this.overlay === 'onboarding' &&
      ((this.settings = { ...this.settings, onboardingComplete: true }),
      this.persistSettings(),
      (this.overlay = 'none'),
      (this.overlayReturn = 'none'),
      this.settings.tutorialHints &&
        this.pushToast(
          'Your city, your route',
          'Open the mission journal with J, choose a map destination, or simply explore.',
          'good',
          6,
        ),
      this.emitHud(true));
  }
  startCity() {
    this.overlay === 'title' &&
      ((this.overlay = 'none'),
      (this.overlayReturn = 'none'),
      this.clearHeldInput(),
      this.settings.tutorialHints &&
        this.pushToast(
          this.hasSave ? 'City resumed' : 'Welcome to Brightline',
          this.hasSave
            ? 'Your route, world state, and progression are ready.'
            : "Open the mission journal with J when you want to begin Mara's first chapter.",
          'good',
          4.5,
        ),
      this.emitHud(true));
  }
  requestNewGame() {
    (this.overlay !== 'pause' && this.overlay !== 'title') ||
      ((this.overlayReturn = this.overlay), (this.overlay = 'confirm'), this.clearHeldInput(), this.emitHud(true));
  }
  cancelNewGame() {
    this.overlay === 'confirm' &&
      ((this.overlay = this.overlayReturn === 'title' ? 'title' : 'pause'),
      (this.overlayReturn = 'none'),
      this.emitHud(true));
  }
  confirmNewGame() {
    this.overlay === 'confirm' && this.reset();
  }
  closeStore() {
    this.overlay === 'store' &&
      ((this.storeKind = null),
      (this.overlay = this.overlayReturn),
      (this.overlayReturn = 'none'),
      this.clearHeldInput(),
      this.emitHud(true));
  }
  openStore(e) {
    ((this.storeKind = e),
      (this.overlayReturn = 'none'),
      (this.overlay = 'store'),
      this.clearHeldInput(),
      this.emitHud(true));
  }
  vehiclePurchasePrice(e) {
    let t = this.factionStanding.makers >= 35 ? 0.85 : this.factionStanding.makers >= 15 ? 0.93 : 1;
    return Math.round(e.price * t);
  }
  investmentLockedReason(e) {
    let t = INVESTMENTS.find((r) => r.id === e);
    return t
      ? t.requiredMission && !this.completedMissions.has(t.requiredMission)
        ? `Complete ${MISSIONS.find((s) => s.id === t.requiredMission)?.title ?? 'the required mission'}`
        : t.requiredDistricts && this.discoveredDistricts.size < t.requiredDistricts
          ? `Discover ${t.requiredDistricts} districts`
          : t.requiredReputation && this.reputation < t.requiredReputation
            ? `Requires REP ${t.requiredReputation}`
            : ''
      : 'Unavailable';
  }
  investmentOffer(e) {
    let t = INVESTMENTS.find((o) => o.id === e);
    if (!t) return null;
    let s = (t.kind === 'business' ? this.businessLevels : this.propertyLevels).get(e) ?? 0,
      n = s >= t.prices.length,
      a = n ? 'Fully upgraded' : this.investmentLockedReason(e);
    return {
      id: `investment:${e}`,
      name: t.name,
      tag: `${t.kind.toUpperCase()} \xB7 LEVEL ${s}/${t.prices.length}`,
      description: t.description,
      color: t.kind === 'business' ? '#ff9852' : '#55d29c',
      price: n ? 0 : t.prices[s],
      actionLabel: n ? 'Fully upgraded' : s === 0 ? 'Purchase' : 'Upgrade',
      owned: n,
      lockedReason: a,
      stats: t.benefits.map((o, l) => `${l < s ? '\u2713' : l === s ? 'NEXT' : 'LOCK'} \xB7 ${o}`),
    };
  }
  currentStoreOffers() {
    if (this.storeKind === 'vehicles')
      return VEHICLE_TYPES.filter((e) => e.price > 0).map((e) => {
        let t = `owned-${e.id}`,
          r = this.ownedVehicles.has(t),
          s = e.reputationRequired ?? 0;
        return {
          id: `vehicle:${e.id}`,
          name: e.name,
          tag: e.category.toUpperCase(),
          description: r
            ? 'Owned permanently. Retrieve it to the Merry Motors delivery pad.'
            : `A distinct ${e.category} tuned for Brightline streets.`,
          color: e.color,
          price: r ? 0 : this.vehiclePurchasePrice(e),
          actionLabel: r ? 'Retrieve' : 'Purchase',
          owned: r,
          lockedReason: !r && this.reputation < s ? `Requires REP ${s}` : '',
          stats: [
            `TOP ${Math.round(e.topSpeed * 3.6)} KM/H`,
            `ACCEL ${e.acceleration}`,
            `HANDLING ${e.steering.toFixed(1)}`,
            `DURABILITY ${e.durability}`,
          ],
        };
      });
    if (this.storeKind === 'garage') {
      let e = this.investmentOffer('loop-garage');
      return e ? [e] : [];
    }
    if (this.storeKind === 'hush') {
      let e = this.investmentOffer('hush-house-loft');
      return e ? [e] : [];
    }
    if (this.storeKind === 'cafe') {
      let e = this.factionStanding.neighborhoods >= 15 ? 0.8 : 1;
      return [
        {
          id: 'service:heal',
          name: 'Bright Bite',
          tag: 'RECOVERY',
          description: 'Restore health to full with a colorful Orbit Cafe meal.',
          color: '#ff667e',
          price: Math.round(25 * e),
          actionLabel: 'Restore health',
          owned: false,
          lockedReason: this.health >= 100 ? 'Health already full' : '',
          stats: [`CURRENT HEALTH ${Math.round(this.health)}%`, 'RESTORES TO 100%'],
        },
        {
          id: 'service:armor',
          name: 'City Guard Liner',
          tag: 'ARMOR',
          description: 'A lightweight protective liner that absorbs incoming damage.',
          color: '#4db8e9',
          price: Math.round(180 * e),
          actionLabel: 'Add 50 armor',
          owned: false,
          lockedReason: this.armor >= 100 ? 'Armor already full' : '',
          stats: [`CURRENT ARMOR ${Math.round(this.armor)}%`, 'ADDS 50 ARMOR'],
        },
      ];
    }
    return [];
  }
  storeHeading() {
    return this.storeKind === 'vehicles'
      ? {
          title: 'Merry Motors catalog',
          subtitle: 'Buy, store, and recover every civilian vehicle class.',
        }
      : this.storeKind === 'garage'
        ? {
            title: 'Loop Garage cooperative',
            subtitle: 'Invest in a real city business and improve its services and shift payout.',
          }
        : this.storeKind === 'hush'
          ? {
              title: 'Hush House property desk',
              subtitle: 'Turn a safe stop into a persistent, upgradeable home base.',
            }
          : {
              title: 'Orbit Cafe counter',
              subtitle: 'Useful recovery supplies for the streets ahead.',
            };
  }
  purchaseStoreOffer(e) {
    if (this.overlay !== 'store') return;
    let t = this.currentStoreOffers().find((r) => r.id === e);
    if (t) {
      if (t.lockedReason) {
        (this.pushToast(t.name, t.lockedReason, 'neutral', 3.5), this.emitHud(true));
        return;
      }
      if (e.startsWith('vehicle:')) {
        let r = e.slice(8),
          s = VEHICLE_TYPES.find((a) => a.id === r);
        if (!s || s.price <= 0) return;
        let n = `owned-${s.id}`;
        if (!this.ownedVehicles.has(n)) {
          if (!this.spend(this.vehiclePurchasePrice(s))) {
            this.emitHud(true);
            return;
          }
          this.ownedVehicles.add(n);
        }
        (this.retrieveOwnedVehicle(s),
          this.pushToast(
            this.ownedVehicles.has(n) && t.owned ? `${s.name} recovered` : `${s.name} purchased`,
            'Your owned vehicle is waiting on the Merry Motors delivery pad.',
            'good',
            4.5,
          ));
      } else if (e.startsWith('investment:')) {
        let r = e.slice(11),
          s = INVESTMENTS.find((c) => c.id === r);
        if (!s) return;
        let n = s.kind === 'business' ? this.businessLevels : this.propertyLevels,
          a = n.get(r) ?? 0,
          o = s.prices[a];
        if (o === undefined || !this.spend(o)) {
          this.emitHud(true);
          return;
        }
        let l = a + 1;
        (n.set(r, l),
          s.kind === 'business' ? this.ownedBusinesses.add('loop-garage-share') : this.ownedProperties.add(r),
          this.pushToast(`${s.name} \xB7 level ${l}`, s.benefits[l - 1], 'good', 5));
      } else if (e === 'service:heal') {
        if (!this.spend(t.price)) {
          this.emitHud(true);
          return;
        }
        ((this.health = 100), this.pushToast('Bright bite served', 'Health restored to full.', 'good', 3.5));
      } else if (e === 'service:armor') {
        if (!this.spend(t.price)) {
          this.emitHud(true);
          return;
        }
        ((this.armor = Math.min(100, this.armor + 50)),
          this.pushToast('Armor fitted', `Protective liner now at ${Math.round(this.armor)}%.`, 'good', 3.5));
      }
      (this.sfx('cash'), this.save(false), this.emitHud(true));
    }
  }
  retrieveOwnedVehicle(e) {
    let t = `owned-${e.id}`,
      r = VEHICLE_TYPES.filter((o) => o.price > 0).findIndex((o) => o.id === e.id),
      s = DELIVERY_PADS[Math.max(0, r) % DELIVERY_PADS.length],
      n = new Vector3(s[0], 0.62, s[1]),
      a = this.vehicles.find((o) => o.id === t);
    return (
      a || (a = this.spawnVehicle(t, e, n, Math.PI / 2, null, [], true)),
      this.activeVehicle !== a &&
        (a.root.position.copy(n),
        (a.root.rotation.y = Math.PI / 2),
        setVisible(a.root, true),
        (a.driver = null),
        (a.speed = 0)),
      (a.health = Math.max(a.health, e.durability * 0.65)),
      (a.damageState = a.health < e.durability * 0.7 ? 'damaged' : 'healthy'),
      (a.owned = true),
      (a.stolen = false),
      a
    );
  }
  setWaypoint(e, t) {
    let r = { x: clamp(e, -HALF_WIDTH + 3, HALF_WIDTH - 3), z: clamp(t, -HALF_DEPTH + 3, HALF_DEPTH - 3) },
      s = r,
      n = false;
    if (!this.canOccupy(new Vector3(r.x, 0.35, r.z), 0.7)) {
      let a = ROAD_X.reduce((c, f) => (Math.abs(f - r.x) < Math.abs(c - r.x) ? f : c)),
        o = ROAD_Z.reduce((c, f) => (Math.abs(f - r.z) < Math.abs(c - r.z) ? f : c)),
        l = [
          { x: a, z: r.z },
          { x: r.x, z: o },
          { x: a, z: o },
        ]
          .filter((c) => this.canOccupy(new Vector3(c.x, 0.35, c.z), 0.7))
          .sort((c, f) => Math.hypot(c.x - r.x, c.z - r.z) - Math.hypot(f.x - r.x, f.z - r.z));
      if (!l.length) {
        (this.pushToast('Waypoint unavailable', 'Choose a road, park, or open plaza.', 'danger', 4),
          (this.overlay = this.overlayReturn),
          (this.overlayReturn = 'none'),
          this.emitHud(true));
        return;
      }
      ((s = l[0]), (n = true));
    }
    ((this.waypoint = s),
      this.activeActivity || this.buildRouteTo(this.waypoint.x, this.waypoint.z),
      (this.overlay = this.overlayReturn),
      (this.overlayReturn = 'none'),
      this.pushToast(
        'Waypoint set',
        this.activeActivity
          ? 'Saved for after the current activity.'
          : n
            ? 'Adjusted to the nearest reachable street.'
            : 'The mint route updates as you move.',
        'good',
        3.5,
      ),
      this.emitHud(true));
  }
  ensureAudio() {
    if (this.audioContext) {
      // The kit's settings panel suspends the city's sound; a click inside it must not wake it.
      this.audioContext.state === 'suspended' && !this.kit.paused && this.audioContext.resume().catch(() => {});
      return;
    }
    try {
      let e = new AudioContext(),
        t = e.createGain();
      ((t.gain.value = this.settings.masterVolume), t.connect(e.destination));
      let r = e.createOscillator(),
        s = e.createGain();
      ((r.type = 'triangle'), (r.frequency.value = 54), (s.gain.value = 0), r.connect(s).connect(t), r.start());
      let n = e.createOscillator(),
        a = e.createGain();
      ((n.type = 'sine'), (n.frequency.value = 43), (a.gain.value = 0.004), n.connect(a).connect(t), n.start());
      let o = e.createOscillator(),
        l = e.createGain();
      ((o.type = 'sine'), (o.frequency.value = 520), (l.gain.value = 0), o.connect(l).connect(t), o.start());
      let c = e.createBuffer(1, e.sampleRate * 2, e.sampleRate),
        f = c.getChannelData(0),
        u = seededRandom(18473);
      for (let _ = 0; _ < f.length; _ += 1) f[_] = u() * 2 - 1;
      let h = e.createBufferSource(),
        d = e.createBiquadFilter(),
        m = e.createGain();
      ((h.buffer = c),
        (h.loop = true),
        (d.type = 'lowpass'),
        (d.frequency.value = 1200),
        (m.gain.value = 0),
        h.connect(d).connect(m).connect(t),
        h.start(),
        (this.noiseBuffer = c),
        (this.audioContext = e),
        (this.masterGain = t),
        (this.engineOscillator = r),
        (this.engineGain = s),
        (this.cityOscillator = n),
        (this.cityGain = a),
        (this.sirenOscillator = o),
        (this.sirenGain = l),
        (this.weatherNoise = h),
        (this.weatherGain = m),
        (this.weatherFilter = d));
    } catch (e) {
      console.info('Procedural audio is unavailable.', e);
    }
  }
  playHorn() {
    this.ensureAudio();
    let e = this.audioContext;
    if (!e) return;
    let t = e.createOscillator(),
      r = e.createGain();
    ((t.type = 'square'),
      t.frequency.setValueAtTime(238, e.currentTime),
      t.frequency.linearRampToValueAtTime(205, e.currentTime + 0.16),
      r.gain.setValueAtTime(1e-4, e.currentTime),
      r.gain.exponentialRampToValueAtTime(0.035, e.currentTime + 0.015),
      r.gain.exponentialRampToValueAtTime(1e-4, e.currentTime + 0.2),
      t.connect(r).connect(this.masterGain ?? e.destination),
      t.start(),
      t.stop(e.currentTime + 0.22),
      this.alertNearbyPedestrians('danger', 9));
  }
  /** A traffic car leaning on its horn, quieter with distance. */
  playTrafficHorn(distance) {
    const ctx = this.audioContext;
    if (!ctx || ctx.state !== 'running' || !this.masterGain) return;
    const now = ctx.currentTime,
      peak = 0.022 * clamp(1 - distance / 34, 0.15, 1),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(311, now);
    o.frequency.linearRampToValueAtTime(294, now + 0.3);
    g.gain.setValueAtTime(1e-4, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.02);
    g.gain.setValueAtTime(peak, now + 0.26);
    g.gain.exponentialRampToValueAtTime(1e-4, now + 0.34);
    o.connect(g).connect(this.masterGain);
    o.start(now);
    o.stop(now + 0.36);
  }
  /**
   * Short synthesized cues for pickups, progress, money and knocks, in the
   * same procedural style as the rest of the city's sound.
   */
  sfx(kind, strength = 1) {
    const ctx = this.audioContext;
    if (!ctx || ctx.state !== 'running' || !this.masterGain) return;
    const now = ctx.currentTime,
      out = this.masterGain;
    const tone = (type, f0, f1, start, dur, peak) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain(),
        t0 = now + start;
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(1e-4, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur / 3));
      g.gain.exponentialRampToValueAtTime(1e-4, t0 + dur);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    };
    const thud = (dur, peak, cutoff) => {
      if (!this.noiseBuffer) return;
      const s = ctx.createBufferSource(),
        f = ctx.createBiquadFilter(),
        g = ctx.createGain();
      s.buffer = this.noiseBuffer;
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      g.gain.setValueAtTime(peak, now);
      g.gain.exponentialRampToValueAtTime(1e-4, now + dur);
      s.connect(f).connect(g).connect(out);
      s.start(now, Math.random() * 1.5, dur + 0.05);
    };
    switch (kind) {
      case 'spark':
        tone('sine', 880, 1320, 0, 0.18, 0.05);
        tone('sine', 1320, 1760, 0.09, 0.24, 0.04);
        break;
      case 'objective':
        tone('triangle', 523, 523, 0, 0.14, 0.05);
        tone('triangle', 784, 784, 0.1, 0.22, 0.05);
        break;
      case 'complete':
        [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, i * 0.11, 0.3, 0.055));
        break;
      case 'gate':
        tone('sine', 660, 990, 0, 0.13, 0.045);
        break;
      case 'fail':
        tone('sawtooth', 220, 140, 0, 0.38, 0.03);
        break;
      case 'cash':
        tone('square', 1568, 1568, 0, 0.06, 0.022);
        tone('square', 2093, 2093, 0.07, 0.14, 0.022);
        break;
      case 'hit':
        tone('square', 170, 70, 0, 0.16, 0.05);
        thud(0.18, 0.12, 700);
        break;
      case 'shove':
        tone('triangle', 260, 120, 0, 0.12, 0.04);
        break;
      case 'impact':
        thud(0.22 + strength * 0.2, 0.1 + strength * 0.22, 380 + strength * 520);
        break;
    }
  }
  /** Controller rumble (or phone haptics) with a matching cue. */
  feedback(kind, strength = 0.5, ms = 120) {
    this.sfx(kind, strength);
    this.input.rumble(clamp(strength, 0.05, 1), ms);
    // A hit on the player also flashes the screen edge red (see the HUD).
    kind === 'hit' && ((this.hurtCounter += 1), (this.hurtAt = this.uiElapsed));
  }
  updateAudio() {
    let e = this.audioContext;
    if (!e) return;
    // Menus freeze the city: its engine, siren and rain loops go quiet with it.
    const live = this.overlay === 'none';
    let t = Math.abs(this.activeVehicle?.speed ?? 0);
    (this.engineOscillator?.frequency.setTargetAtTime(52 + t * 4.8, e.currentTime, 0.06),
      this.engineGain?.gain.setTargetAtTime(live && this.activeVehicle ? 0.012 + t * 45e-5 : 0, e.currentTime, 0.08),
      this.cityGain?.gain.setTargetAtTime(live ? (this.weather === 'rain' ? 0.002 : 0.004) : 0.0015, e.currentTime, 0.3));
    let r = this.districtAt(this.getPlayerPosition().x, this.getPlayerPosition().z),
      s = Math.max(
        0,
        DISTRICTS.findIndex((n) => n.id === r.id),
      );
    (this.cityOscillator?.frequency.setTargetAtTime(38 + s * 7 + r.traffic * 8, e.currentTime, 0.8),
      this.weatherGain?.gain.setTargetAtTime(
        !live ? 0 : this.weather === 'rain' ? 0.012 : this.weather === 'fog' ? 0.003 : 0,
        e.currentTime,
        live ? 1.2 : 0.2,
      ),
      this.weatherFilter?.frequency.setTargetAtTime(this.weather === 'rain' ? 1500 : 420, e.currentTime, 0.8),
      this.sirenOscillator?.frequency.setTargetAtTime(510 + Math.sin(this.elapsed * 8.2) * 145, e.currentTime, 0.035),
      this.sirenGain?.gain.setTargetAtTime(live && this.wanted > 0 ? 0.0075 : 0, e.currentTime, 0.12));
  }
  fixedUpdate(e) {
    ((this.simulationTick += 1),
      (this.elapsed += e),
      (this.attackCooldown = Math.max(0, this.attackCooldown - e)),
      (this.damageCooldown = Math.max(0, this.damageCooldown - e)),
      (this.hostileToastCooldown = Math.max(0, this.hostileToastCooldown - e)),
      (this.autosaveTimer += e),
      this.activeVehicle ? this.updatePlayerVehicle(e) : this.updatePlayerOnFoot(e),
      this.updateWorldStreaming(),
      this.updateInteriors(),
      this.updateTraffic(e),
      this.updateVehicleFeedback(e),
      this.updatePedestrians(e),
      this.updateReactiveProps(e),
      this.updateCollectibles(),
      this.updateCrimeAndPolice(e),
      this.updateMission(),
      this.updateActivity(e),
      this.updateWorldEvents(e),
      this.updateInteraction(),
      this.updateWorldClock(e),
      this.pressed.has('interact') && this.performInteraction(),
      this.pressed.has('fire') && !this.activeVehicle && this.performAttack(),
      this.pressed.has('horn') && this.activeVehicle && this.playHorn(),
      this.pressed.has('reset') && this.activeVehicle && (this.activeVehicle.root.rotation.z = 0),
      this.pressed.clear(),
      this.autosaveTimer > 80 && this.wanted === 0 && ((this.autosaveTimer = 0), this.save(false)));
    let t = Math.floor(this.timeOfDay / 8);
    if (this.lastIncomeSegment < 0) this.lastIncomeSegment = t;
    else if (t !== this.lastIncomeSegment) {
      this.lastIncomeSegment = t;
      let r = this.businessLevels.get('loop-garage') ?? 0;
      if (r > 0) {
        let s = [0, 90, 145, 210][r] ?? 210;
        ((this.money += s),
          this.pushToast('Loop Garage shift payout', `Your level ${r} workshop share earned $${s}.`, 'good', 4),
          this.save(false));
      }
    }
    ((this.hudTimer -= e), this.hudTimer <= 0 && ((this.hudTimer = 0.1), this.emitHud()));
  }
  /** Move / steer (x) and forward / throttle (y), analog on a stick. */
  movementInput() {
    return this.input.vector('move');
  }
  updatePlayerOnFoot(e) {
    let t = this.movementInput();
    ((this.playerSwimming = this.isWaterPosition(this.player.position)),
      (this.playerCrouched = !this.playerSwimming && this.input.down('crouch')));
    let r = this.cameraForward(),
      s = new Vector3(r.x, 0, r.z).normalize(),
      n = new Vector3(0, 1, 0).cross(s).normalize(),
      a = s.clone().multiplyScalar(t.y).add(n.clone().multiplyScalar(t.x)),
      o = a.lengthSq() > 0.01,
      // A partly tilted stick walks slower; keys are always full speed.
      k = Math.min(1, a.length());
    o && a.normalize();
    let l = this.input.down('sprint'),
      c = o ? (this.playerSwimming ? 3.25 : this.playerCrouched ? 2.45 : l ? 8.4 : 5.1) : 0,
      f = a.clone().multiplyScalar(c * k),
      u = 1 - Math.exp(-e * (o ? 13 : 18));
    ((this.playerVelocity.x = lerp(this.playerVelocity.x, f.x, u)),
      (this.playerVelocity.z = lerp(this.playerVelocity.z, f.z, u)),
      this.pressed.has('jump') &&
        this.playerGrounded &&
        !this.playerSwimming &&
        ((this.playerYVelocity = 7.2), (this.playerGrounded = false)),
      this.playerSwimming
        ? ((this.playerYVelocity = 0),
          (this.playerGrounded = true),
          (this.player.position.y = 0.08 + Math.sin(this.elapsed * 3.2) * 0.035))
        : this.playerGrounded ||
          ((this.playerYVelocity -= 19 * e),
          (this.player.position.y += this.playerYVelocity * e),
          this.player.position.y <= 0.35 &&
            ((this.player.position.y = 0.35), (this.playerYVelocity = 0), (this.playerGrounded = true))));
    let h = this.player.position.clone().add(this.playerVelocity.clone().multiplyScalar(e));
    if (((h.y = this.player.position.y), this.canPlayerOccupy(h, 0.62)))
      ((this.player.position.x = h.x), (this.player.position.z = h.z));
    else {
      let _ = new Vector3(h.x, h.y, this.player.position.z),
        p = new Vector3(this.player.position.x, h.y, h.z);
      (this.canPlayerOccupy(_, 0.62) ? (this.player.position.x = _.x) : (this.playerVelocity.x = 0),
        this.canPlayerOccupy(p, 0.62) ? (this.player.position.z = p.z) : (this.playerVelocity.z = 0));
    }
    if (o) {
      if (this.cameraMode === 'first-person') this.player.rotation.y = this.perspectiveYaw;
      else {
        let p = Math.atan2(a.x, a.z);
        this.player.rotation.y += angleDelta(this.player.rotation.y, p) * Math.min(1, e * 14);
      }
      let _ = Math.sin(this.elapsed * (l ? 16 : 11)) * 0.12;
      (this.playerMeshes[2] && (this.playerMeshes[2].rotation.x = _),
        this.playerMeshes[3] && (this.playerMeshes[3].rotation.x = -_));
    }
    let d = this.playerSwimming;
    ((this.playerSwimming = this.isWaterPosition(this.player.position)),
      this.playerSwimming
        ? ((this.player.position.y = 0.08 + Math.sin(this.elapsed * 3.2) * 0.035),
          (this.playerGrounded = true),
          (this.playerYVelocity = 0))
        : d && (this.player.position.y = 0.35));
    let m = this.playerSwimming ? 0.64 : this.playerCrouched ? 0.72 : 1;
    this.player.scale.y = lerp(this.player.scale.y, m, Math.min(1, e * 14));
  }
  isWaterPosition(e) {
    return e.x > 106 && e.z < -2 && e.z > -99;
  }
  canPlayerOccupy(e, t) {
    return this.isWaterPosition(e)
      ? e.x < -HALF_WIDTH + t || e.x > HALF_WIDTH - t || e.z < -HALF_DEPTH + t || e.z > HALF_DEPTH - t
        ? false
        : !this.colliders.some((r) => e.x + t > r.minX && e.x - t < r.maxX && e.z + t > r.minZ && e.z - t < r.maxZ)
      : this.canOccupy(e, t);
  }
  canOccupy(e, t) {
    return e.x < -HALF_WIDTH + t ||
      e.x > HALF_WIDTH - t ||
      e.z < -HALF_DEPTH + t ||
      e.z > HALF_DEPTH - t ||
      (e.x > 106 && e.z < 0 && e.z > -99)
      ? false
      : !this.colliders.some((r) => e.x + t > r.minX && e.x - t < r.maxX && e.z + t > r.minZ && e.z - t < r.maxZ);
  }
  updatePlayerVehicle(e) {
    let t = this.activeVehicle;
    if (!t) return;
    let r = this.movementInput(),
      s = clamp(r.y + this.input.value('drive'), -1, 1),
      n = r.x,
      a = this.input.down('jump'),
      o = this.weather === 'rain' ? 0.78 : 1;
    if (((t.braking = a || s < -0.1), t.health <= 0)) {
      t.speed *= Math.max(0, 1 - e * 2.8);
      return;
    }
    (s > 0
      ? (t.speed += t.definition.acceleration * s * e)
      : s < 0
        ? (t.speed += t.definition.braking * 0.62 * s * e)
        : (t.speed *= Math.max(0, 1 - e * 0.72)),
      a && (t.speed *= Math.max(0, 1 - e * 3.5)),
      (t.speed = clamp(t.speed, -t.definition.topSpeed * 0.36, t.definition.topSpeed)));
    let l = clamp(Math.abs(t.speed) / 4.5, 0.2, 1),
      c = t.speed >= 0 ? 1 : -1;
    ((t.root.rotation.y += n * t.definition.steering * l * c * o * e),
      Math.abs(n) > 0.2 && Math.abs(t.speed) > 14 && this.weather === 'rain' && (t.root.rotation.y += n * 0.28 * e));
    let f = new Vector3(Math.sin(t.root.rotation.y), 0, Math.cos(t.root.rotation.y)),
      u = t.root.position.clone().add(f.clone().multiplyScalar(t.speed * e));
    if (this.canOccupy(u, t.collisionRadius)) ((t.root.position.x = u.x), (t.root.position.z = u.z));
    else if (Math.abs(t.speed) > 3) {
      let h = Math.abs(t.speed);
      ((t.speed *= -0.18), (t.health = Math.max(0, t.health - h * 0.55)), this.onVehicleImpact(t, h));
    } else t.speed = 0;
    (this.pressed.has('jump') && Math.abs(t.speed) > 10 && this.alertNearbyPedestrians('danger', 15),
      this.checkVehicleEntityImpacts(t));
  }
  onVehicleImpact(e, t) {
    this.elapsed - e.lastImpact < 0.7 ||
      ((e.lastImpact = this.elapsed),
      this.feedback('impact', clamp(t / 26, 0.2, 1), Math.round(80 + t * 6)),
      this.pushToast(
        t > 14 ? 'Hard collision' : 'Bump',
        t > 14 ? 'The vehicle took damage and nearby people noticed.' : 'Easy does it.',
        t > 14 ? 'danger' : 'neutral',
        2.8,
      ),
      t > 10 && this.createCrime('Reckless driving', 0.65, e.root.position));
  }
  updateVehicleFeedback(e) {
    let t = this.timeOfDay < 6.5 || this.timeOfDay > 19.5 || this.weather === 'rain' || this.weather === 'fog',
      r = this.currentObjective(),
      s = r?.kind === 'enterVehicle' ? r.requiredVehicleId : undefined,
      lights = this.vehicleLightMaterials();
    lights.head.opacity = t ? 1 : 0.12;
    lights.tail.opacity = t ? 0.46 : 0.16;
    for (let a of this.vehicles) {
      let o = !!(s && a.id === s);
      (this.setVehicleOutline(a, o), (a.health = clamp(a.health, 0, a.definition.durability)));
      let l = a.health / Math.max(1, a.definition.durability),
        c = l <= 0 ? 'disabled' : l <= 0.3 ? 'critical' : l <= 0.65 ? 'damaged' : 'healthy';
      (c !== a.damageState &&
        ((a.damageState = c),
        a === this.activeVehicle &&
          c === 'critical' &&
          this.pushToast(
            'Vehicle critical',
            'Smoke is building. Reach Loop Garage before the engine fails.',
            'danger',
            5,
          ),
        a === this.activeVehicle &&
          c === 'disabled' &&
          this.pushToast(
            'Vehicle disabled',
            'The engine has stopped. Exit safely or recover an owned vehicle at Merry Motors.',
            'danger',
            6,
          )),
        (a.brakeLight.material = a.braking ? lights.brake : lights.tail),
        a.damageState === 'disabled' && (a.speed *= Math.max(0, 1 - e * 2.6)));
    }
    let n =
      this.activeVehicle &&
      (this.activeVehicle.damageState === 'critical' || this.activeVehicle.damageState === 'disabled')
        ? this.activeVehicle
        : null;
    n && this.vehicleSmoke
      ? (this.vehicleSmoke.emitter.copy(n.root.position),
        (this.vehicleSmoke.emitter.y += 1.65),
        this.smokingVehicleId !== n.id && (this.vehicleSmoke.start(), (this.smokingVehicleId = n.id)))
      : this.smokingVehicleId && (this.vehicleSmoke?.stop(), (this.smokingVehicleId = null));
  }
  checkVehicleEntityImpacts(e) {
    if (!(Math.abs(e.speed) < 3)) {
      if (this.elapsed - e.lastImpact > 0.55)
        for (let t of this.vehicles) {
          if (
            t === e ||
            !t.root.visible ||
            flatDistance(e.root.position, t.root.position) >= (e.collisionRadius + t.collisionRadius) * 0.88
          )
            continue;
          let s = Math.abs(e.speed) + Math.abs(t.speed) * 0.35,
            n = e.root.position.clone().sub(t.root.position);
          ((n.y = 0),
            n.lengthSq() < 0.01 && n.set(1, 0, 0),
            n.normalize(),
            e.root.position.add(n.clone().multiplyScalar(0.48)),
            t.root.position.add(n.clone().multiplyScalar(-0.32)),
            (e.health = Math.max(0, e.health - s * 0.58)),
            (t.health = Math.max(0, t.health - s * 0.24)),
            (e.speed *= -0.2),
            (t.speed *= 0.45),
            (t.disabledTimer = Math.max(t.disabledTimer, 0.45)),
            this.onVehicleImpact(e, s),
            t.police && this.createCrime('Striking civic response', 1.8, t.root.position));
          break;
        }
      for (let t of this.props)
        if (flatDistance(e.root.position, t.mesh.position) < 1.65 && !t.disturbed) {
          let s = new Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y));
          ((t.disturbed = true),
            t.velocity.copy(s.clone().multiplyScalar(Math.min(12, Math.abs(e.speed) * 0.55))),
            (t.velocity.y = 4),
            (t.angularVelocity = e.speed * 0.12),
            (e.speed *= 0.86),
            this.createCrime('Property damage', 0.35, t.mesh.position));
        }
      for (let t of this.pedestrians) {
        // Hidden people (a rider already aboard, another mission's cast) are not on the street.
        if (t.special || t.state === 'down' || !t.root.visible) continue;
        if (flatDistance(e.root.position, t.root.position) < 1.5) {
          ((t.state = 'down'), (t.callerForIncident = null), (t.timer = 6));
          let s = t.root.position.clone().sub(e.root.position).normalize();
          ((t.target = t.root.position.clone().add(s.clone().multiplyScalar(4))),
            (e.speed *= 0.72),
            this.createCrime('Dangerous collision', 1.6, t.root.position));
        }
      }
    }
  }
  updateTraffic(e) {
    let t = this.getPlayerPosition(),
      r = this.districtAt(t.x, t.z),
      s = this.timeOfDay < 6 || this.timeOfDay > 22 ? -14 : 0,
      n = this.weather === 'rain' || this.weather === 'fog' ? -9 : 0,
      a = 92 + r.traffic * 46 + s + n;
    const next = this.scratchA;
    for (let o = 0; o < this.vehicles.length; o += 1) {
      const l = this.vehicles[o];
      ((l.hornCooldown = Math.max(0, l.hornCooldown - e)), (l.disabledTimer = Math.max(0, l.disabledTimer - e)));
      let c = flatDistance(l.root.position, t);
      if (l === this.activeVehicle) {
        l.root.visible || setVisible(l.root, true);
        continue;
      }
      let f = l.id.startsWith('response-') && l.driver === null,
        u = this.isMissionAssetKind(l.id, 'vehicle') && !this.activeMissionOwnsAsset(l.id),
        h = !f && !u && (c < a || l.driver === 'police');
      if ((l.root.visible !== h && setVisible(l.root, h), l.driver === null || l.driver === 'player')) continue;
      if (l.driver === 'police') {
        this.updatePoliceVehicle(l, e);
        continue;
      }
      let d = c > a ? 15 : c > 72 ? 4 : 1;
      if (this.simulationTick % d !== o % d) continue;
      let m = e * d;
      if (l.health <= 0) {
        if (l.root.visible || this.entityIsReserved('vehicle', l)) {
          ((l.braking = true), (l.speed *= Math.max(0, 1 - m * 2.4)));
          continue;
        }
        // Out of sight, the city's tow crews quietly put a wreck back on the road.
        ((l.health = l.definition.durability), (l.damageState = 'healthy'), (l.braking = false));
      }
      if (!l.route.length || l.disabledTimer > 0) {
        ((l.braking = l.speed > 1), (l.speed *= Math.max(0, 1 - m * 2)));
        continue;
      }
      let _ = l.route[l.routeIndex],
        px = _.x - l.root.position.x,
        pz = _.z - l.root.position.z,
        g = Math.sqrt(px * px + pz * pz),
        v = g < 9 && this.signalIsRed(_, l.root.rotation.y);
      g < 4.4 && !v && (l.routeIndex = (l.routeIndex + 1) % l.route.length);
      let S = l.route[l.routeIndex],
        A = Math.atan2(S.x - l.root.position.x, S.z - l.root.position.z),
        T = angleDelta(l.root.rotation.y, A);
      l.root.rotation.y += clamp(T, -1.75 * m, 1.75 * m);
      let C = Math.min(l.definition.topSpeed * 0.52, 13);
      (Math.abs(T) > 0.65 && (C *= 0.45), v && (C = 0));
      // Queue behind a vehicle close ahead (no allocation: this runs for every
      // pair). A parked, abandoned or wrecked car in the lane is waited behind
      // briefly and then eased past, so a lane never jams for good; a car
      // held up by the player leans on its horn.
      if (l.passing) {
        const qx = l.passing.root.position.x - l.root.position.x,
          qz = l.passing.root.position.z - l.root.position.z;
        if (qx * qx + qz * qz > 100 || (l.passing.driver !== null && l.passing.health > 0)) l.passing = null;
      }
      const fx = Math.sin(l.root.rotation.y),
        fz = Math.cos(l.root.rotation.y);
      let blocker = null;
      for (let F of this.vehicles) {
        if (F === l || !F.root.visible) continue;
        const dx = F.root.position.x - l.root.position.x,
          dy = F.root.position.y - l.root.position.y,
          dz = F.root.position.z - l.root.position.z,
          d2 = dx * dx + dy * dy + dz * dz;
        if (!(d2 < 45 && (dx * fx + dz * fz) / Math.sqrt(d2) > 0.7)) continue;
        if (
          F === l.passing ||
          ((F.driver === null || F.health <= 0) && Math.abs(F.speed) < 0.5 && l.blockedTime > 2.5)
        ) {
          l.passing = F;
          continue;
        }
        const cap = Math.max(0, F.speed - 1.2);
        cap < C && ((C = cap), (blocker = F));
      }
      if (blocker && C < 0.5 && !v) {
        l.blockedTime += m;
        blocker === this.activeVehicle &&
          l.blockedTime > 1.8 &&
          l.hornCooldown <= 0 &&
          c < 34 &&
          ((l.hornCooldown = 4 + (o % 3)), this.playTrafficHorn(c));
      } else if (l.speed > 2) l.blockedTime = 0;
      ((l.braking = C < l.speed - 0.8), (l.speed = lerp(l.speed, C, 1 - Math.exp(-m * 1.7))));
      next.set(
        l.root.position.x + fx * l.speed * m,
        l.root.position.y,
        l.root.position.z + fz * l.speed * m,
      );
      this.canOccupy(next, l.collisionRadius)
        ? ((l.root.position.x = next.x), (l.root.position.z = next.z))
        : ((l.speed = 0), (l.disabledTimer = 1.2));
    }
  }
  signalIsRed(e, t) {
    if (!(ROAD_X.some((a) => Math.abs(e.x - a) < 4) && ROAD_Z.some((a) => Math.abs(e.z - a) < 4))) return false;
    let s = (this.elapsed + Math.abs(e.x * 0.11 + e.z * 0.07)) % 18;
    return Math.abs(Math.cos(t)) > 0.65 ? s > 8 : s < 10;
  }
  alertHostileAllies(e, t) {
    for (let r of this.pedestrians)
      r === e ||
        !r.combatant ||
        r.state === 'down' ||
        flatDistance(r.root.position, e.root.position) > 14 ||
        ((r.state = 'alert'),
        (r.timer = 0.7 + (r.phase % 0.5)),
        r.target.copy(t),
        (r.lastSeenAt = this.elapsed),
        setVisible(r.root, true));
  }
  moveHostileToward(e, t, r, s) {
    let n = t.clone().sub(e.root.position);
    if (((n.y = 0), n.lengthSq() < 0.15)) return;
    n.normalize();
    let a = e.root.position.clone().add(n.clone().multiplyScalar(r * s));
    this.canOccupy(a, 0.38) && e.root.position.copy(a);
    let o = Math.atan2(n.x, n.z);
    e.root.rotation.y += angleDelta(e.root.rotation.y, o) * Math.min(1, s * 10);
  }
  updateHostilePedestrian(e, t, r) {
    if (!e.combatant || e.state === 'down') return false;
    let s = flatDistance(e.root.position, r),
      n = e.state === 'alert' || e.state === 'attack' || e.state === 'search' || e.state === 'retreat';
    if (n && s > 96) return (setVisible(e.root, false), true);
    !e.root.visible && s < 82 && setVisible(e.root, true);
    let a = s < 15 && this.hasWorldLineOfSight(e.root.position, r),
      o = this.currentObjective(),
      l = o?.kind === 'defend' && o.hostileIds?.includes(e.id);
    if (this.activeVehicle && s < 10 && !l) {
      let c = e.root.position.clone().sub(r).normalize();
      ((e.state = 'retreat'), (e.target = e.root.position.clone().add(c.clone().multiplyScalar(20))), (e.timer = 7));
    } else
      !n &&
        a &&
        s < 8.5 &&
        ((e.state = 'alert'),
        (e.timer = 0.65),
        e.target.copy(r),
        (e.lastSeenAt = this.elapsed),
        this.alertHostileAllies(e, r),
        this.hostileToastCooldown <= 0 &&
          ((this.hostileToastCooldown = 8),
          this.pushToast(
            'Trouble nearby',
            'A hostile crew noticed you. Create distance or defend yourself.',
            'danger',
            4,
          )));
    if (e.state === 'alert')
      return (
        (e.timer -= t),
        (e.root.rotation.y +=
          angleDelta(e.root.rotation.y, Math.atan2(r.x - e.root.position.x, r.z - e.root.position.z)) *
          Math.min(1, t * 7)),
        e.timer <= 0 && (e.state = 'attack'),
        true
      );
    if (e.state === 'attack') {
      if (((e.timer -= t), a)) (e.target.copy(r), (e.lastSeenAt = this.elapsed));
      else if (this.elapsed - e.lastSeenAt > 2.4) return ((e.state = 'search'), (e.timer = 5), true);
      if (s > 2.05) this.moveHostileToward(e, e.target, 3.35, t);
      else if (e.timer <= 0 && this.damageCooldown <= 0) {
        ((e.timer = 1.15 + (e.phase % 0.35)), (this.damageCooldown = 0.45));
        let c = 8 * this.incomingDamageMultiplier(),
          f = Math.min(this.armor, c * 0.65);
        ((this.armor -= f), (this.health -= c - f));
        let u = this.player.position.clone().sub(e.root.position).normalize();
        (this.activeVehicle || this.player.position.add(u.clone().multiplyScalar(0.45)),
          this.feedback('hit', 0.6, 140),
          this.pushToast('Hit taken', 'Break away, shove back, or use the streets for cover.', 'danger', 2.2),
          this.health <= 0 && this.handlePlayerDown());
      }
      return true;
    }
    return e.state === 'search'
      ? ((e.timer -= t),
        a
          ? ((e.state = 'alert'), (e.timer = 0.35), e.target.copy(r), (e.lastSeenAt = this.elapsed))
          : e.timer <= 0
            ? ((e.state = 'walk'), (e.target = this.scheduledTargetFor(e, this.pedestrianRoutineSlot())))
            : this.moveHostileToward(e, e.target, 1.8, t),
        true)
      : e.state === 'retreat'
        ? ((e.timer -= t),
          this.moveHostileToward(e, e.target, 3.7, t),
          (e.timer <= 0 || s > 22) &&
            ((e.state = 'walk'),
            (e.health = Math.max(e.health, 45)),
            (e.target = this.scheduledTargetFor(e, this.pedestrianRoutineSlot()))),
          true)
        : false;
  }
  updatePedestrians(e) {
    let t = this.getPlayerPosition(),
      r = this.districtAt(t.x, t.z),
      s = this.pedestrianRoutineSlot(),
      n = s === 0 ? -18 : s === 3 ? -5 : 0,
      a = this.weather === 'rain' ? -14 : this.weather === 'fog' ? -10 : 0,
      o = 66 + r.traffic * 30 + n + a;
    for (let l of this.pedestrians) {
      if (l.missionRole === 'passenger') {
        l.root.visible && setVisible(l.root, false);
        continue;
      }
      if (this.isMissionAssetKind(l.id, 'actor') && !this.activeMissionOwnsAsset(l.id)) {
        l.root.visible && setVisible(l.root, false);
        continue;
      }
      if (l.activityRole) {
        let S = l.activityRole === 'waiting';
        (l.root.visible !== S && setVisible(l.root, S),
          S &&
            (l.root.rotation.y +=
              angleDelta(l.root.rotation.y, Math.atan2(t.x - l.root.position.x, t.z - l.root.position.z)) *
              Math.min(1, e * 2.4)));
        continue;
      }
      if (l.special) {
        (l.root.visible || setVisible(l.root, true),
          (l.root.rotation.y +=
            angleDelta(l.root.rotation.y, Math.atan2(t.x - l.root.position.x, t.z - l.root.position.z)) *
            Math.min(1, e * 2.5)));
        continue;
      }
      if (this.updateHostilePedestrian(l, e, t)) continue;
      let c = l.state === 'call' || l.state === 'flee' || l.state === 'down' || l.state === 'observe';
      (c && l.sheltering && (l.sheltering = false),
        l.routineSlot !== s &&
          !c &&
          ((l.routineSlot = s), l.sheltering || ((l.state = 'walk'), (l.target = this.scheduledTargetFor(l, s)))));
      let f = l.archetype !== 'worker' && l.archetype !== 'vendor' && hashString(l.id) % 3 !== 0;
      this.weather === 'rain' && f && !c && !l.sheltering
        ? ((l.sheltering = true), (l.state = 'walk'), (l.target = this.nearestShelterTarget(l.root.position)))
        : this.weather !== 'rain' &&
          l.sheltering &&
          !c &&
          ((l.sheltering = false), (l.state = 'walk'), (l.target = this.scheduledTargetFor(l, s)));
      let u = flatDistance(l.root.position, t),
        h = l.special || l.state === 'call' || u < o;
      if ((l.root.visible !== h && setVisible(l.root, h), !l.root.visible)) continue;
      if (((l.timer -= e), l.state === 'call')) {
        if (
          ((l.root.rotation.y +=
            angleDelta(l.root.rotation.y, Math.atan2(t.x - l.root.position.x, t.z - l.root.position.z)) *
            Math.min(1, e * 4)),
          l.timer <= 0 && l.callerForIncident !== null)
        ) {
          (this.reportCrime(l.callerForIncident), (l.callerForIncident = null), (l.state = 'flee'));
          let S = l.root.position.clone().sub(t).normalize();
          ((l.target = l.root.position.clone().add(S.clone().multiplyScalar(24))), (l.timer = 9));
        }
        continue;
      }
      if (l.state === 'down') {
        if (((l.root.rotation.z = lerp(l.root.rotation.z, 1.25, Math.min(1, e * 5))), l.timer <= 0)) {
          let S = this.currentObjective();
          if (S?.kind === 'defend' && S.hostileIds?.includes(l.id)) {
            l.timer = 1;
            continue;
          }
          if (((l.root.rotation.z = 0), l.combatant)) {
            ((l.health = 45), (l.state = 'retreat'));
            let A = l.root.position.clone().sub(t).normalize();
            ((l.target = l.root.position.clone().add(A.clone().multiplyScalar(24))), (l.timer = 8));
          } else ((l.state = 'flee'), (l.target = this.randomSidewalkTarget(l.phase * 911)), (l.timer = 8));
        }
        continue;
      }
      if (l.state === 'observe') {
        l.timer <= 0 && ((l.state = 'walk'), (l.target = this.randomSidewalkTarget(l.phase * 713)));
        continue;
      }
      if (l.state === 'shelter') {
        this.weather !== 'rain' &&
          ((l.sheltering = false), (l.state = 'walk'), (l.target = this.scheduledTargetFor(l, s)));
        continue;
      }
      if (l.state === 'phone' || l.state === 'socialize') {
        l.timer <= 0 && ((l.state = 'walk'), (l.target = this.scheduledTargetFor(l, s)));
        continue;
      }
      if (l.state === 'waitCrossing') {
        let S = this.scratchB.copy(l.target).sub(l.root.position);
        if (((S.y = 0), S.lengthSq() < 0.1)) {
          ((l.state = 'idle'), (l.timer = 1));
          continue;
        }
        if (
          (S.normalize(),
          this.pedestrianCrossingBlocked(l.root.position, this.scratchC.copy(l.root.position).addScaledVector(S, 0.9)))
        )
          continue;
        l.state = 'walk';
      }
      if (l.state === 'idle') {
        l.timer <= 0 && ((l.state = 'walk'), (l.target = this.scheduledTargetFor(l, s)));
        continue;
      }
      let d = l.target;
      if (l.state === 'flee' && flatDistance(l.root.position, t) < 15) {
        let S = l.root.position.clone().sub(t).normalize();
        ((d = l.root.position.clone().add(S.clone().multiplyScalar(18))), (l.target = d));
      }
      let m = this.scratchB.copy(d).sub(l.root.position);
      if (((m.y = 0), m.length() < 1.1 || !this.canOccupy(d, 0.35))) {
        if (l.state === 'flee') ((l.state = 'idle'), (l.timer = 2 + (l.phase % 3)));
        else {
          let S = (hashString(l.id) + Math.floor(this.elapsed / 6)) % 7;
          ((l.state = S === 0 ? 'phone' : S === 1 ? 'socialize' : 'idle'), (l.timer = 1.4 + (l.phase % 3.2)));
        }
        ((l.target = l.sheltering ? this.nearestShelterTarget(l.root.position) : this.scheduledTargetFor(l, s)),
          l.sheltering && flatDistance(l.root.position, l.target) < 1.4 && (l.state = 'shelter'));
        continue;
      }
      m.normalize();
      let p =
          l.state === 'flee'
            ? 4.6
            : l.speed * (this.weather === 'rain' && (l.archetype === 'worker' || l.archetype === 'vendor') ? 0.78 : 1),
        g = this.scratchC.copy(l.root.position).addScaledVector(m, p * e);
      if (l.state === 'walk' && this.pedestrianCrossingBlocked(l.root.position, g)) {
        l.state = 'waitCrossing';
        continue;
      }
      this.canOccupy(g, 0.35)
        ? l.root.position.copy(g)
        : (l.target = this.randomSidewalkTarget(l.phase * 379 + this.elapsed));
      let v = Math.atan2(m.x, m.z);
      ((l.root.rotation.y += angleDelta(l.root.rotation.y, v) * Math.min(1, e * 8)),
        (l.root.position.y = 0.32 + Math.abs(Math.sin(this.elapsed * p * 3 + l.phase)) * 0.055));
    }
  }
  updateReactiveProps(e) {
    for (let t of this.props)
      t.disturbed &&
        ((t.velocity.y -= 12 * e),
        t.mesh.position.add(t.velocity.clone().multiplyScalar(e)),
        (t.mesh.rotation.x += t.angularVelocity * e),
        (t.mesh.rotation.z += t.angularVelocity * 0.7 * e),
        t.mesh.position.y < 0.55 &&
          ((t.mesh.position.y = 0.55),
          (t.velocity.y *= -0.25),
          (t.velocity.x *= 0.82),
          (t.velocity.z *= 0.82),
          (t.angularVelocity *= 0.86)));
  }
  updateCollectibles() {
    let e = this.getPlayerPosition();
    for (let t of this.collectibles)
      t.collected ||
        ((t.mesh.rotation.y += FIXED_STEP * 1.6),
        (t.mesh.position.y = t.baseY + Math.sin(this.elapsed * 2.4 + t.phase) * 0.24),
        flatDistance(e, t.mesh.position) < (this.activeVehicle ? 2.4 : 1.7) &&
          ((t.collected = true),
          setVisible(t.mesh, false),
          this.collected.add(t.id),
          (this.money += 60),
          (this.reputation += 2),
          this.feedback('spark', 0.25, 70),
          this.pushToast(
            'City Spark found',
            `Exploration reward +$60 \xB7 ${this.collected.size}/${this.collectibles.length}`,
            'good',
            4,
          ),
          this.save(false)));
  }
  hasWorldLineOfSight(e, t) {
    return !this.colliders.some((r) => (r.maxY ?? 20) > 1.25 && segmentCrossesBox(e, t, r));
  }
  policeCanSeePoint(e, t, r = 36) {
    let s = flatDistance(e.root.position, t),
      n = this.timeOfDay < 6.5 || this.timeOfDay > 20.5,
      a = this.weather === 'fog' ? 0.58 : this.weather === 'rain' ? 0.78 : this.weather === 'cloudy' ? 0.9 : 1,
      o = r * a * (n ? 0.82 : 1);
    if (s > o || !this.hasWorldLineOfSight(e.root.position, t)) return false;
    if (s < 8) return true;
    let l = new Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y)),
      c = t.clone().sub(e.root.position);
    return ((c.y = 0), c.lengthSq() < 0.01 ? true : (c.normalize(), l.dot(c) > 0.12));
  }
  createCrime(e, t, r) {
    let s = ++this.incidentCounter,
      n = this.districtAt(r.x, r.z),
      a = this.pedestrians
        .filter(
          (h) =>
            !h.special &&
            !h.combatant &&
            !this.entityIsReserved('pedestrian', h) &&
            h.state !== 'down' &&
            h.root.visible &&
            flatDistance(h.root.position, r) < 21 &&
            this.hasWorldLineOfSight(h.root.position, r),
        )
        .sort((h, d) => flatDistance(h.root.position, r) - flatDistance(d.root.position, r)),
      o = this.vehicles.find(
        (h) => h.police && h.root.visible && this.policeCanSeePoint(h, r, 27 + (1 - n.crime) * 11),
      );
    if (o) {
      ((o.driver = 'police'), (o.policeRole = 'pursuit'), this.reportCrime(s, t, e, r));
      return;
    }
    if (!a.length) {
      this.pushToast('Unreported incident', `${e} \u2014 no clear witnesses.`, 'neutral', 3);
      return;
    }
    let l = a.find((h, d) => d % 3 === s % 3) ?? a[0],
      c = l.archetype === 'commuter' || l.archetype === 'shopper' ? 0.08 : l.archetype === 'vendor' ? -0.08 : 0,
      f = clamp(0.9 - n.crime * 0.42 + c, 0.42, 0.96);
    if (seededRandom(s * 7919 + Math.floor(r.x * 13 + r.z * 17))() > f) {
      for (let [h, d] of a.entries())
        if (((d.state = h % 3 === 0 ? 'observe' : 'flee'), (d.timer = 4 + (d.phase % 4)), d.state === 'flee')) {
          let m = d.root.position.clone().sub(r).normalize();
          d.target = d.root.position.clone().add(m.clone().multiplyScalar(18));
        }
      this.pushToast('Local reaction', `${e} drew attention, but nobody called it in.`, 'neutral', 3.5);
      return;
    }
    l.state = 'call';
    let u =
      n.id === 'garden-row'
        ? this.factionStanding.neighborhoods >= 15
          ? 1.5
          : this.factionStanding.neighborhoods <= -15
            ? -0.75
            : 0
        : 0;
    ((l.timer = Math.max(1.2, 2.4 + (l.phase % 1.8) + u)), (l.callerForIncident = s));
    for (let [h, d] of a.entries())
      if (
        d !== l &&
        ((d.state = h % 2 === 0 ? 'flee' : 'observe'), (d.timer = 5 + (d.phase % 4)), d.state === 'flee')
      ) {
        let m = d.root.position.clone().sub(r).normalize();
        d.target = d.root.position.clone().add(m.clone().multiplyScalar(20));
      }
    (this.pushToast('Witness reacting', `${e} may be reported.`, 'danger', 3.5),
      (l.root.userData.crimeSeverity = t),
      (l.root.userData.crimeLabel = e),
      (l.root.userData.crimeX = r.x),
      (l.root.userData.crimeZ = r.z));
  }
  reportCrime(e, t, r, s) {
    if (this.reportedIncidents.has(e)) return;
    this.reportedIncidents.add(e);
    let n = t,
      a = r;
    if (n === undefined || a === undefined) {
      let h = this.pedestrians.find((d) => d.callerForIncident === e);
      ((n = Number(h?.root.userData.crimeSeverity ?? 0.7)),
        (a = String(h?.root.userData.crimeLabel ?? 'Reported incident')),
        !s &&
          h?.root.userData &&
          (s = new Vector3(
            Number(h.root.userData.crimeX ?? h.root.position.x),
            0,
            Number(h.root.userData.crimeZ ?? h.root.position.z),
          )));
    }
    let o = this.districtAt(s?.x ?? this.getPlayerPosition().x, s?.z ?? this.getPlayerPosition().z),
      l = Math.max(0.1, Number(n ?? 0.7));
    (this.adjustFaction('civic', -Math.ceil(l * 3)),
      o.id !== 'sunline' && this.adjustFaction('neighborhoods', -Math.ceil(l * 1.5)));
    let c = this.wanted;
    this.crimePressure += l;
    let f =
        this.crimePressure >= 5.5
          ? 5
          : this.crimePressure >= 4
            ? 4
            : this.crimePressure >= 2.6
              ? 3
              : this.crimePressure >= 1.4
                ? 2
                : 1,
      u = this.factionStanding.civic <= -15 ? 1 : 0;
    ((this.wanted = clamp(Math.max(this.wanted, f + u, Math.ceil(l * 1.45) + u), 1, 5)),
      (this.heat = 100),
      (this.unseenTime = 0),
      this.lastKnownPosition.copy(this.getPlayerPosition()),
      this.pushToast(
        this.wanted > c && c > 0 ? `Response escalated \xB7 level ${this.wanted}` : 'City response active',
        `${a} reported \xB7 break observation to escape.`,
        'danger',
        5,
      ),
      this.ensurePoliceResponse());
  }
  ensurePoliceResponse() {
    let e = this.vehicles.filter((n) => n.driver === 'police').length,
      t = Math.min(5, Math.max(1, this.wanted + (this.factionStanding.civic <= -15 ? 1 : 0))),
      r = [
        new Vector3(-96, 0.62, -96),
        new Vector3(96, 0.62, 98),
        new Vector3(-118, 0.62, 36),
        new Vector3(96, 0.62, -20),
        new Vector3(-32, 0.62, 98),
      ].sort((n, a) => flatDistance(a, this.getPlayerPosition()) - flatDistance(n, this.getPlayerPosition()));
    for (let n = e; n < t; n += 1) {
      let a = r[n % r.length].clone(),
        o = this.vehicles.find((c) => c.id.startsWith('response-') && c.driver === null),
        l =
          o ??
          this.spawnVehicle(
            `response-${this.incidentCounter}-${n}`,
            VEHICLE_TYPES.find((c) => c.category === 'police') ?? VEHICLE_TYPES[0],
            a,
            n % 2 ? Math.PI : 0,
            'police',
            [],
          );
      (o &&
        (l.root.position.copy(a),
        (l.root.rotation.y = n % 2 ? Math.PI : 0),
        setVisible(l.root, true),
        (l.driver = 'police'),
        (l.health = l.definition.durability)),
        (l.speed = 7),
        (l.braking = false));
    }
    let s = this.vehicles.filter((n) => n.driver === 'police').sort((n, a) => n.id.localeCompare(a.id));
    for (let n of s) ((n.policeRole = 'pursuit'), (n.policeTarget = undefined), (n.roadblockYaw = undefined));
    if (
      (this.wanted >= 3 && s.length > 1 && (s[s.length - 1].policeRole = 'intercept'), this.wanted >= 4 && s.length > 2)
    ) {
      let n = s[s.length - 2],
        a = this.selectRoadblockPoint();
      a
        ? ((n.policeRole = 'roadblock'), (n.policeTarget = a.point), (n.roadblockYaw = a.yaw))
        : (n.policeRole = 'intercept');
    }
  }
  selectRoadblockPoint() {
    let e = this.getPlayerPosition(),
      r = (this.activeVehicle?.root ?? this.player).rotation.y,
      s = new Vector3(Math.sin(r), 0, Math.cos(r)),
      n = this.activeVehicle ? clamp(Math.abs(this.activeVehicle.speed) * 1.8, 28, 48) : 34,
      a = e.clone().add(s.clone().multiplyScalar(n)),
      l = ROAD_X.flatMap((c) => ROAD_Z.map((f) => new Vector3(c, 0.62, f)))
        .filter((c) => {
          let f = flatDistance(c, e);
          return f >= 26 && f <= 82 && this.canOccupy(c, 1.4);
        })
        .sort((c, f) => flatDistance(c, a) - flatDistance(f, a))[0];
    return l ? { point: l.clone(), yaw: r + Math.PI / 2 } : null;
  }
  releasePoliceVehicle(e) {
    ((e.policeRole = undefined),
      (e.policeTarget = undefined),
      (e.roadblockYaw = undefined),
      (e.braking = false),
      e.id.startsWith('civic-patrol-')
        ? ((e.driver = 'traffic'), (e.speed = 7), setVisible(e.root, true))
        : ((e.driver = null), (e.speed = 0), setVisible(e.root, false)));
  }
  updatePoliceVehicle(e, t) {
    if (this.wanted <= 0) {
      this.releasePoliceVehicle(e);
      return;
    }
    let r = this.getPlayerPosition(),
      s = this.policeCanSeePoint(e, r, 38),
      n = this.activeVehicle?.root ?? this.player,
      a = new Vector3(Math.sin(n.rotation.y), 0, Math.cos(n.rotation.y)),
      o = this.elapsed * 0.42 + e.id.length * 0.83,
      l = 4 + this.wanted * 1.4,
      c = s ? r : this.lastKnownPosition.clone().add(new Vector3(Math.sin(o) * l, 0, Math.cos(o) * l));
    if (e.policeRole === 'intercept' && s) {
      let v = this.activeVehicle ? clamp(Math.abs(this.activeVehicle.speed) * 1.35, 10, 34) : 9;
      c = r.clone().add(a.clone().multiplyScalar(v));
    } else e.policeRole === 'roadblock' && e.policeTarget && (c = e.policeTarget);
    let f = Math.atan2(c.x - e.root.position.x, c.z - e.root.position.z),
      u = angleDelta(e.root.rotation.y, f),
      h = flatDistance(e.root.position, c),
      d = e.policeRole === 'roadblock' && h < 3.2;
    d
      ? (e.root.rotation.y += angleDelta(e.root.rotation.y, e.roadblockYaw ?? f) * Math.min(1, t * 4))
      : (e.root.rotation.y += clamp(u, -e.definition.steering * t, e.definition.steering * t));
    let m = d
      ? 0
      : Math.min(
          e.definition.topSpeed * (e.policeRole === 'intercept' ? 0.9 : 0.78),
          e.policeRole === 'intercept' ? 28 : 24,
        );
    (Math.abs(u) > 0.8 && (m *= 0.48),
      !s && h < 4 && (m = 2),
      d && (m = 0),
      (e.braking = m < e.speed - 0.6),
      (e.speed = lerp(e.speed, m, 1 - Math.exp(-t * 2.4))));
    let _ = new Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y)),
      p = e.root.position.clone().add(_.clone().multiplyScalar(e.speed * t));
    if (
      (this.canOccupy(p, e.collisionRadius)
        ? ((e.root.position.x = p.x), (e.root.position.z = p.z))
        : ((e.root.rotation.y += (e.id.length % 2 ? 1 : -1) * 1.8 * t), (e.speed *= 0.4)),
      flatDistance(e.root.position, r) < 3.4 && this.damageCooldown <= 0)
    ) {
      this.damageCooldown = 1.4;
      let v = this.activeVehicle ? 6 * this.incomingDamageMultiplier() : 13 * this.incomingDamageMultiplier();
      (this.activeVehicle ? (this.activeVehicle.health -= v) : (this.health -= v),
        this.feedback(this.activeVehicle ? 'impact' : 'hit', 0.7, 160),
        this.pushToast('Police contact', 'Find a route out of sight.', 'danger', 2.2),
        (this.health <= 0 || (this.activeVehicle && this.activeVehicle.health <= 0)) && this.handleArrest());
    }
  }
  updateCrimeAndPolice(e) {
    if (this.wanted <= 0) return;
    let t = this.getPlayerPosition();
    if (this.vehicles.some((s) => s.driver === 'police' && s.root.visible && this.policeCanSeePoint(s, t, 38)))
      ((this.unseenTime = 0), (this.heat = Math.min(100, this.heat + e * 10)), this.lastKnownPosition.copy(t));
    else {
      this.unseenTime += e;
      let s = 9 + this.wanted * 3.5,
        n = this.factionStanding.civic >= 15 ? 1.2 : 1;
      (this.unseenTime > 3 && (this.heat = Math.max(0, this.heat - e * (100 / s) * n * this.searchCoolingMultiplier())),
        this.heat <= 0 &&
          ((this.wanted = 0),
          (this.crimePressure = 0),
          (this.unseenTime = 0),
          this.sfx('objective'),
          this.pushToast('Search ended', 'The city has returned to its rhythm.', 'good', 4.5),
          this.save(false)));
    }
  }
  handleArrest() {
    this.recoverAtSafehouse(true);
  }
  handlePlayerDown() {
    this.recoverAtSafehouse(false);
  }
  /**
   * Back on your feet at Hush House after an arrest or a knockout. Both used
   * to share most of this; the arrest path left the player's momentum,
   * crouch and swim state behind and let the camera glide across the city.
   */
  recoverAtSafehouse(arrested) {
    (this.activeEvent && this.finishWorldEvent('failed', false),
      this.activeActivity &&
        (this.cleanupActivity(this.activeActivity, false),
        (this.activeActivity = null),
        setVisible(this.activityRing, false),
        setVisible(this.activityBeam, false)),
      this.activeVehicle && this.exitVehicle(true),
      this.player.position.set(69, 0.35, -60),
      this.player.scale.setScalar(1),
      this.playerVelocity.setScalar(0),
      (this.playerYVelocity = 0),
      (this.playerGrounded = true),
      (this.playerCrouched = false),
      (this.playerSwimming = false),
      this.cameraTarget.copy(this.player.position),
      (this.cameraSnapPending = true),
      (this.health = 100));
    let e = this.propertyLevels.get('hush-house-loft') ?? 0;
    this.armor = e >= 2 ? 30 : 0;
    let t = arrested ? (e >= 2 ? 25 : e >= 1 ? 40 : 120) : e >= 2 ? 10 : e >= 1 ? 20 : 65;
    ((this.money = Math.max(0, this.money - t)),
      (this.wanted = 0),
      (this.crimePressure = 0),
      (this.heat = 0),
      (this.unseenTime = 0),
      this.feedback('fail', 0.8, 260),
      arrested
        ? this.pushToast(
            'Released at Hush House',
            `Recovery fee: $${t}${t < 120 ? ' \xB7 safehouse owner rate' : ''}. Your progress is safe.`,
            'danger',
            6,
          )
        : this.pushToast(
            'Recovered at Hush House',
            `You kept your progress and paid a $${t} recovery fee.`,
            'danger',
            5.5,
          ),
      (this.currentObjective()?.kind === 'transportNpc' || this.currentObjective()?.kind === 'defend') &&
        this.restartCurrentObjective('Recovery restarted the active mission checkpoint.'),
      this.updateInteriors(true),
      this.updateObjectiveMarker());
  }
  alertNearbyPedestrians(e, t) {
    let r = this.getPlayerPosition();
    for (let s of this.pedestrians)
      if (!(s.special || s.combatant || s.state === 'down') && flatDistance(r, s.root.position) < t) {
        let n = s.root.position.clone().sub(r).normalize();
        ((s.state = s.id.length % 3 === 0 ? 'observe' : 'flee'),
          (s.callerForIncident = null),
          (s.timer = 5 + (s.phase % 4)),
          (s.target = s.root.position.clone().add(n.clone().multiplyScalar(18))));
      }
  }
  activeMission() {
    return MISSIONS.find((e) => e.id === this.missionId) ?? null;
  }
  currentObjective() {
    return this.activeMission()?.objectives[this.objectiveIndex] ?? null;
  }
  vehicleMatchesObjective(e, t) {
    return e.kind === 'enterVehicle' && (!e.requiredVehicleId || e.requiredVehicleId === t.id);
  }
  updateMission() {
    let e = this.currentObjective();
    if (!e) return;
    this.updateMissionOptionals();
    let t = this.getPlayerPosition();
    if (e.failOnWanted && this.wanted > 0) {
      ((this.objectiveEnteredAt = this.elapsed),
        (this.objectiveHoldTime = 0),
        this.elapsed - this.objectiveFailureToastAt > 6 &&
          ((this.objectiveFailureToastAt = this.elapsed),
          this.pushToast(
            'Objective paused',
            'Lose the city search, then the timed checkpoint will restart.',
            'danger',
            4,
          )));
      return;
    }
    if (e.timeLimit && this.elapsed - this.objectiveEnteredAt > e.timeLimit) {
      this.feedback('fail', 0.5, 200);
      this.restartCurrentObjective('Time expired \u2014 restarting from this mission checkpoint.');
      return;
    }
    if (e.kind === 'transportNpc' && e.requiredVehicleId) {
      let r = this.vehicles.find((s) => s.id === e.requiredVehicleId);
      if (r && r.health <= 0) {
        this.feedback('fail', 0.5, 200);
        this.restartCurrentObjective('The service vehicle was disabled \u2014 restarting this route.');
        return;
      }
    }
    if (e.kind === 'enterVehicle' && this.activeVehicle && this.vehicleMatchesObjective(e, this.activeVehicle)) {
      let r = e.armEscapeWhenStolen === true && this.activeVehicle.stolen;
      (this.completeObjective(), r && (this.escapeArmed = true));
      return;
    }
    if (e.requiredVehicleId) {
      let r = this.vehicles.find((s) => s.id === e.requiredVehicleId);
      r && flatDistance(this.objectiveRing.position, r.root.position) > 3 && this.updateObjectiveMarker();
    }
    if (
      ((e.kind === 'reach' || e.kind === 'driveTo') &&
        e.x !== undefined &&
        e.z !== undefined &&
        flatDistance(t, new Vector3(e.x, 0, e.z)) <= (e.radius ?? 4) &&
        (e.kind !== 'driveTo' || this.activeVehicle) &&
        this.completeObjective(),
      e.kind === 'multiReach')
    ) {
      for (let r of e.points ?? [])
        this.objectiveSubgoals.has(r.id) ||
          (flatDistance(t, new Vector3(r.x, 0, r.z)) <= (r.radius ?? 5) &&
            (this.objectiveSubgoals.add(r.id),
            this.sfx('gate'),
            this.pushToast(
              e.pointTitle ?? 'Survey point logged',
              `${r.label} \xB7 ${this.objectiveSubgoals.size}/${e.requiredCount ?? e.points?.length ?? 1}`,
              'good',
              3,
            ),
            this.updateObjectiveMarker()));
      this.objectiveSubgoals.size >= (e.requiredCount ?? e.points?.length ?? 1) && this.completeObjective();
    }
    if (
      (e.kind === 'survive' &&
        e.x !== undefined &&
        e.z !== undefined &&
        (flatDistance(t, new Vector3(e.x, 0, e.z)) <= (e.radius ?? 6)
          ? (this.objectiveHoldTime += FIXED_STEP)
          : (this.objectiveHoldTime = Math.max(0, this.objectiveHoldTime - FIXED_STEP * 1.5)),
        this.objectiveHoldTime >= (e.duration ?? 10) && this.completeObjective()),
      e.kind === 'defend' && e.x !== undefined && e.z !== undefined)
    ) {
      let r = new Vector3(e.x, 0, e.z);
      if (flatDistance(t, r) <= (e.radius ?? 10) && (!e.requireOnFoot || !this.activeVehicle)) {
        if (!this.objectiveSubgoals.has('defend-active')) {
          this.objectiveSubgoals.add('defend-active');
          for (let o of this.defendHostiles(e))
            ((o.state = 'alert'), (o.timer = 0.45), o.target.copy(t), (o.lastSeenAt = this.elapsed));
          this.pushToast(
            e.pressureTitle ?? 'Work zone under pressure',
            e.pressureText ?? 'Hold the marked area and keep the bound crew from disrupting the shift.',
            'danger',
            4,
          );
        }
        this.objectiveHoldTime += FIXED_STEP;
      } else this.objectiveHoldTime = Math.max(0, this.objectiveHoldTime - FIXED_STEP * 0.5);
      let a = this.defendHostiles(e).every(
        (o) => o.state === 'down' || o.state === 'retreat' || flatDistance(o.root.position, r) > (e.radius ?? 10) + 10,
      );
      this.objectiveHoldTime >= (e.duration ?? 20) && a && this.completeObjective();
    }
    if (e.kind === 'escape') {
      this.wanted > 0 && (this.escapeArmed = true);
      let r = this.pedestrians.some((s) => s.state === 'call' && s.callerForIncident !== null);
      this.escapeArmed &&
        this.wanted === 0 &&
        !r &&
        this.elapsed - this.objectiveEnteredAt > 5 &&
        this.completeObjective();
    }
    e.kind === 'collect' && this.collected.size >= (e.count ?? 1) && this.completeObjective();
  }
  defendHostiles(e) {
    return (e.hostileIds ?? []).map((t) => this.pedestrians.find((r) => r.id === t)).filter((t) => !!t);
  }
  updateMissionOptionals() {
    let e = this.activeMission();
    if (!e) return;
    let t = false;
    for (let r of e.optionalObjectives ?? [])
      this.missionOptionalStates.get(r.id) === 'active' &&
        (r.kind === 'avoidDetection' &&
          this.wanted > 0 &&
          (this.missionOptionalStates.set(r.id, 'failed'),
          (t = true),
          this.pushToast('Optional objective missed', r.label, 'neutral', 3.5)),
        r.kind === 'inspectAll' &&
          (r.targetIds ?? []).every((s) => this.missionOptionalProgress.has(s)) &&
          (this.missionOptionalStates.set(r.id, 'completed'),
          (t = true),
          this.pushToast('Optional objective complete', r.label, 'good', 4)));
    t && this.save(false);
  }
  restartCurrentObjective(e) {
    let t = this.activeMission(),
      r = this.currentObjective(),
      s = [];
    if (r?.kind === 'transportNpc')
      for (let n of r.points ?? []) {
        if (!this.objectiveSubgoals.has(n.id)) break;
        s.push(n);
      }
    if (t && r?.kind === 'transportNpc') {
      let n = r.requiredActorId ? this.missionAsset(t, r.requiredActorId) : undefined,
        a = r.requiredActorId ? this.pedestrians.find((f) => f.id === r.requiredActorId) : undefined,
        o = s.at(-1);
      (a &&
        n?.kind === 'actor' &&
        (o
          ? ((a.missionRole = 'passenger'), setVisible(a.root, false))
          : ((a.missionRole = undefined), a.root.position.set(n.x, 0.32, n.z), setVisible(a.root, true))),
        (this.missionPassengerId = o ? (r.requiredActorId ?? null) : null));
      let l = r.requiredVehicleId ? this.missionAsset(t, r.requiredVehicleId) : undefined,
        c = r.requiredVehicleId ? this.vehicles.find((f) => f.id === r.requiredVehicleId) : undefined;
      if (c && l?.kind === 'vehicle') {
        (this.activeVehicle === c && this.exitVehicle(true),
          c.root.position.set(o?.x ?? l.x, 0.62, o?.z ?? l.z),
          c.root.rotation.set(0, l.yaw, 0),
          setVisible(c.root, true),
          (c.driver = null),
          (c.speed = 0),
          (c.health = c.definition.durability * clamp(l.healthRatio ?? 1, 0.1, 1)),
          (c.damageState = c.health < c.definition.durability * 0.7 ? 'damaged' : 'healthy'));
        let f = this.safeVehicleExitPosition(c);
        (this.player.position.set(f.x, 0.35, f.z), (this.player.rotation.y = c.root.rotation.y));
      }
    }
    if (r?.kind === 'defend' && r.x !== undefined && r.z !== undefined) {
      let n = new Vector3(r.x, 0.35, r.z),
        o =
          [
            n,
            n.clone().add(new Vector3(3, 0, 0)),
            n.clone().add(new Vector3(-3, 0, 0)),
            n.clone().add(new Vector3(0, 0, 3)),
            n.clone().add(new Vector3(0, 0, -3)),
          ].find((l) => this.canOccupy(l, 0.65)) ?? n;
      (this.player.position.set(o.x, 0.35, o.z),
        this.cameraTarget.copy(this.player.position),
        (this.cameraSnapPending = true));
    }
    ((this.objectiveEnteredAt = this.elapsed),
      (this.objectiveSubgoals = new Set(s.map((n) => n.id))),
      (this.objectiveHoldTime = 0),
      (this.objectiveFailureToastAt = this.elapsed),
      r?.kind === 'defend' && this.activateCurrentMissionObjective(),
      this.pushToast('Checkpoint restarted', e, 'danger', 4.5),
      this.updateObjectiveMarker(),
      this.save(false));
  }
  completeObjective() {
    let e = this.activeMission(),
      t = this.currentObjective();
    if (!(!e || !t)) {
      if (
        ((this.objectiveIndex += 1),
        (this.objectiveEnteredAt = this.elapsed),
        this.objectiveSubgoals.clear(),
        (this.objectiveHoldTime = 0),
        (this.objectiveFailureToastAt = -100),
        (this.escapeArmed = false),
        this.suppressCompletedMissionDefenders(e),
        this.objectiveIndex >= e.objectives.length)
      ) {
        for (let u of e.optionalObjectives ?? [])
          if (this.missionOptionalStates.get(u.id) === 'active')
            if (u.kind === 'vehicleCare') {
              let h = u.requiredVehicleId ? this.vehicles.find((m) => m.id === u.requiredVehicleId) : undefined,
                d = h ? h.health / Math.max(1, h.definition.durability) : 0;
              this.missionOptionalStates.set(u.id, d >= (u.minVehicleHealthRatio ?? 0.65) ? 'completed' : 'failed');
            } else u.kind === 'avoidDetection' && this.missionOptionalStates.set(u.id, 'completed');
        let r = !this.completedMissions.has(e.id),
          s = r ? e.reward : Math.max(100, Math.round(e.reward * 0.25)),
          n = (e.optionalObjectives ?? []).filter((u) => this.missionOptionalStates.get(u.id) === 'completed'),
          a = n.reduce((u, h) => u + (r ? h.bonusReward : Math.round(h.bonusReward * 0.25)), 0),
          o = s + a;
        (this.completedMissions.add(e.id),
          (this.money += o),
          (this.reputation += r ? (e.reputationReward ?? 12) : 0),
          r && e.faction && e.factionReward && this.adjustFaction(e.faction, e.factionReward));
        // Mission time counts simulation seconds from acceptance, so pauses
        // and menus never cost the player a best time.
        let l = this.missionRecords.get(e.id),
          took = Math.max(0.1, this.elapsed - this.missionStartedAt),
          best = l?.bestTime && l.bestTime <= took ? l.bestTime : took;
        (this.missionRecords.set(e.id, {
          completions: (l?.completions ?? 0) + 1,
          completedOptionals: [...new Set([...(l?.completedOptionals ?? []), ...n.map((u) => u.id)])],
          bestTime: best,
        }),
          r &&
            e.id === 'clean-getaway' &&
            !this.ownedBusinesses.has('loop-garage-share') &&
            this.pushToast(
              'Investment unlocked',
              'Pax will now sell you a stake in Loop Garage at the cooperative desk.',
              'good',
              7,
            ),
          this.feedback('complete', 0.5, 220),
          this.showResult({
            kind: 'mission',
            kicker: r ? 'MISSION PASSED' : 'REPLAY COMPLETE',
            title: e.title,
            total: o,
            lines: [
              `${r ? 'Reward' : 'Replay reward'} $${s.toLocaleString()}`,
              ...n.map(
                (u) =>
                  `${u.label.replace(/^Optional · /, '')} +$${(r ? u.bonusReward : Math.round(u.bonusReward * 0.25)).toLocaleString()}`,
              ),
              ...(r ? [`REP +${e.reputationReward ?? 12}`] : []),
            ],
            time: took,
            best,
            record: !!l?.bestTime && took < l.bestTime,
          }));
        // A chapter can end with a vehicle the giver hands over for good.
        if (r && e.rewardVehicle) {
          let u = VEHICLE_TYPES.find((h) => h.id === e.rewardVehicle);
          if (u && u.price > 0 && !this.ownedVehicles.has(`owned-${u.id}`))
            (this.ownedVehicles.add(`owned-${u.id}`),
              this.retrieveOwnedVehicle(u),
              this.pushToast(
                `${u.name} is yours`,
                `${e.giver} signed it over. It is waiting on the Merry Motors delivery pad.`,
                'good',
                9,
              ));
          else if (u)
            ((this.money += 500),
              this.pushToast(
                'Fleet bonus \xB7 +$500',
                `You already run a ${u.name}, so ${e.giver} paid its share in cash.`,
                'good',
                9,
              ));
        }
        let f =
          MISSIONS.find(
            (u) => u.prerequisiteMission === e.id && !this.completedMissions.has(u.id) && this.missionIsAvailable(u),
          ) ?? MISSIONS.find((u) => !this.completedMissions.has(u.id) && this.missionIsAvailable(u));
        (f &&
          this.pushToast(
            `New mission available \xB7 ${f.title}`,
            'Open the mission journal with J when you are ready.',
            'neutral',
            9,
          ),
          this.releaseMissionAssets(e),
          (this.missionId = null),
          (this.objectiveIndex = 0),
          this.save(false));
      } else
        (this.sfx('objective'),
          this.pushToast('Objective complete', t.label, 'good', 3.2),
          this.activateCurrentMissionObjective(),
          this.updateMissionObjectVisuals(),
          this.save(false));
      this.updateObjectiveMarker();
    }
  }
  updateMissionObjectVisuals() {
    let e = this.activeMission(),
      t = this.currentObjective(),
      r = new Set(
        (e?.optionalObjectives ?? [])
          .filter((s) => s.kind === 'inspectAll' && this.missionOptionalStates.get(s.id) === 'active')
          .flatMap((s) => s.targetIds ?? []),
      );
    for (let [s, n] of this.missionObjects) {
      let a = !!e?.assets?.some((h) => h.id === s),
        o = this.carriedMissionItem === s,
        l = this.objectiveSubgoals.has(s) || this.missionOptionalProgress.has(s),
        c = t?.kind === 'searchArea' && (t.targetIds ?? []).includes(s),
        f = t?.kind === 'pickup' && (t.targetId ?? t.grantsItemId) === s,
        u = a && (o || f || ((c || r.has(s)) && !l));
      if (o) {
        let h = this.activeVehicle?.root ?? this.player;
        (n.mesh.parent !== h && h.add(n.mesh),
          n.mesh.position.copy(this.activeVehicle ? new Vector3(0, 2.12, -0.55) : new Vector3(0.58, 1.35, -0.18)),
          n.mesh.rotation.set(0, Math.PI / 4, 0),
          n.mesh.scale.setScalar(0.68));
      } else
        (n.mesh.parent !== this.world && this.world.add(n.mesh),
          n.mesh.position.set(n.definition.x, n.definition.style === 'tag' ? 0.54 : 0.78, n.definition.z),
          n.mesh.scale.setScalar(1));
      setVisible(n.mesh, u);
    }
  }
  missionObjectiveTargetPosition(e = this.currentObjective()) {
    if (!e) return null;
    if (e.kind === 'multiReach' || e.kind === 'searchArea') {
      let t = (e.points ?? [])
        .filter((r) => !this.objectiveSubgoals.has(r.id))
        .sort(
          (r, s) =>
            flatDistance(this.getPlayerPosition(), new Vector3(r.x, 0, r.z)) -
            flatDistance(this.getPlayerPosition(), new Vector3(s.x, 0, s.z)),
        )[0];
      if (t) return new Vector3(t.x, 0.35, t.z);
    }
    if (e.kind === 'transportNpc') {
      if (!this.missionPassengerId && e.requiredActorId) {
        let t = this.pedestrians.find((r) => r.id === e.requiredActorId);
        if (t) return t.root.position.clone();
      }
      if (this.missionPassengerId) {
        let t = e.requiredVehicleId ? this.vehicles.find((s) => s.id === e.requiredVehicleId) : undefined;
        if (t && this.activeVehicle !== t) return t.root.position.clone();
        let r = (e.points ?? []).find((s) => !this.objectiveSubgoals.has(s.id));
        if (r) return new Vector3(r.x, 0.35, r.z);
      }
    }
    if (e.kind === 'pickup') {
      let t = this.missionObjects.get(e.targetId ?? e.grantsItemId ?? '');
      if (t) return this.gamePositionOf(t.mesh).clone();
    }
    if (e.requiredActorId) {
      let t = this.pedestrians.find((r) => r.id === e.requiredActorId);
      if (t) return t.root.position.clone();
    }
    if (e.requiredVehicleId) {
      let t = this.vehicles.find((r) => r.id === e.requiredVehicleId);
      if (t) return t.root.position.clone();
    }
    return e.x !== undefined && e.z !== undefined ? new Vector3(e.x, 0.35, e.z) : null;
  }
  updateObjectiveMarker() {
    let e = this.currentObjective();
    this.updateMissionObjectVisuals();
    let t = this.missionObjectiveTargetPosition(e);
    if (!e || !t) {
      (setVisible(this.objectiveRing, false),
        setVisible(this.objectiveBeam, false),
        this.activeActivity ||
          (this.waypoint ? this.buildRouteTo(this.waypoint.x, this.waypoint.z) : this.clearRoute()));
      return;
    }
    (setVisible(this.objectiveRing, true),
      setVisible(this.objectiveBeam, true),
      (this.objectiveRing.position.x = t.x),
      (this.objectiveRing.position.z = t.z),
      (this.objectiveBeam.position.x = t.x),
      (this.objectiveBeam.position.z = t.z),
      this.activeActivity ||
        (this.waypoint ? this.buildRouteTo(this.waypoint.x, this.waypoint.z) : this.buildRouteTo(t.x, t.z)));
  }
  startActivity(e) {
    if (!this.activeVehicle) {
      this.pushToast(e.title, 'Bring any vehicle onto the activity marker to begin.', 'neutral', 4);
      return;
    }
    if (this.activeActivity) {
      this.pushToast('Activity already active', 'Finish or time out before starting another.', 'neutral', 3);
      return;
    }
    if (this.activeMissionOwnsAsset(this.activeVehicle.id)) {
      this.pushToast(
        'Mission vehicle committed',
        'Finish or abandon the current assignment before using its vehicle in an activity.',
        'neutral',
        4,
      );
      return;
    }
    if (this.activeVehicle.health <= 0) {
      this.pushToast(e.title, 'Repair this vehicle before starting.', 'danger', 3.5);
      return;
    }
    let t = {
      definition: e,
      checkpointIndex: 0,
      remaining:
        e.timeLimit * this.activityTimeMultiplier() +
        (e.faction === 'couriers' && this.factionStanding.couriers >= 15 ? 10 : 0),
      vehicle: this.activeVehicle,
      startedAt: this.elapsed,
      startHealth: this.activeVehicle.health,
      cargoCount: 0,
    };
    if (e.kind === 'taxi') {
      let s = Math.max(1, e.checkpoints.length - 1),
        n = this.pedestrians
          .filter(
            (a) =>
              !a.special &&
              !a.combatant &&
              a.state !== 'call' &&
              a.state !== 'down' &&
              !a.activityRole &&
              !this.entityIsReserved('pedestrian', a),
          )
          .sort((a, o) => a.phase - o.phase)
          .slice(0, s)
          .map((a, o) => {
            let l = e.checkpoints[o],
              c = {
                pedestrian: a,
                originalPosition: a.root.position.clone(),
                originalTarget: a.target.clone(),
                originalState: a.state,
                originalTimer: a.timer,
              },
              f = o % 2 === 0 ? 1 : -1,
              u = new Vector3(l.x + f * 3.8, 0.32, l.z + f * 1.5);
            return (
              a.root.position.copy(this.canOccupy(u, 0.4) ? u : new Vector3(l.x, 0.32, l.z + f * 4)),
              a.target.copy(a.root.position),
              (a.state = 'idle'),
              (a.timer = t.remaining),
              (a.activityRole = 'waiting'),
              setVisible(a.root, true),
              c
            );
          });
      t.passengers = n;
    } else
      e.kind === 'courier' &&
        (t.vehicle.root.add(this.activityCargo),
        this.activityCargo.position.set(0, 1.55, -0.65),
        this.activityCargo.scale.set(0.75, 0.7, 0.75),
        setVisible(this.activityCargo, false));
    ((this.activeActivity = t), this.updateActivityMarker());
    let r =
      e.startHint ??
      (e.kind === 'race'
        ? 'Hit every gate in order. A clean car earns a precision bonus.'
        : e.kind === 'taxi'
          ? 'Collect both waiting riders, then make one safe drop-off.'
          : 'Load three workshop parcels, then return the stack intact.');
    this.pushToast(`${e.title} started`, `${r} \xB7 ${Math.ceil(t.remaining)} seconds`, 'good', 5);
  }
  updateActivity(e) {
    let t = this.activeActivity;
    if (!t) return;
    if (((t.remaining -= e), t.remaining <= 0)) {
      (this.feedback('fail', 0.45, 180),
        this.pushToast(
          `${t.definition.title} ended`,
          'The route stays open \u2014 return to its flag and try again.',
          'danger',
          4,
        ),
        this.cleanupActivity(t, false),
        (this.activeActivity = null),
        setVisible(this.activityRing, false),
        setVisible(this.activityBeam, false),
        this.updateObjectiveMarker());
      return;
    }
    if (t.vehicle.health <= 0) {
      (this.feedback('fail', 0.45, 180),
        this.pushToast(
          `${t.definition.title} ended`,
          'The activity vehicle is disabled. Repair it and try the route again.',
          'danger',
          4.5,
        ),
        this.cleanupActivity(t, false),
        (this.activeActivity = null),
        setVisible(this.activityRing, false),
        setVisible(this.activityBeam, false),
        this.updateObjectiveMarker());
      return;
    }
    let r = t.definition.checkpoints[t.checkpointIndex];
    !r ||
      this.activeVehicle !== t.vehicle ||
      (t.definition.kind === 'race' &&
        (flatDistance(t.vehicle.root.position, new Vector3(r.x, 0, r.z)) > 6.5 || this.advanceActivityStep()));
  }
  advanceActivityStep() {
    let e = this.activeActivity;
    if (!e || this.activeVehicle !== e.vehicle) return;
    let t = e.definition.checkpoints[e.checkpointIndex];
    if (!t || flatDistance(e.vehicle.root.position, new Vector3(t.x, 0, t.z)) > 6.5) return;
    if (e.definition.kind !== 'race' && Math.abs(e.vehicle.speed) > 4.2) {
      this.pushToast('Slow down', 'Stop below 15 km/h to use this activity point.', 'neutral', 2.8);
      return;
    }
    let r = e.checkpointIndex === e.definition.checkpoints.length - 1;
    r || this.feedback(e.definition.kind === 'race' ? 'gate' : 'objective', 0.2, 60);
    if (e.definition.kind === 'taxi' && !r) {
      let s = e.passengers?.[e.checkpointIndex]?.pedestrian;
      (s && ((s.activityRole = 'onboard'), setVisible(s.root, false)),
        this.pushToast(
          'Rider aboard',
          `${e.checkpointIndex + 1}/${Math.max(1, e.definition.checkpoints.length - 1)} riders collected`,
          'good',
          2.4,
        ));
    } else
      e.definition.kind === 'courier' &&
        !r &&
        ((e.cargoCount += 1),
        setVisible(this.activityCargo, true),
        this.activityCargo.scale.set(0.72 + e.cargoCount * 0.08, 0.62 + e.cargoCount * 0.2, 0.72 + e.cargoCount * 0.08),
        (this.activityCargo.position.y = 1.45 + e.cargoCount * 0.12),
        this.pushToast(
          'Parcel loaded',
          `${e.cargoCount}/${Math.max(1, e.definition.checkpoints.length - 1)} workshop parcels secured`,
          'good',
          2.4,
        ));
    if (((e.checkpointIndex += 1), e.checkpointIndex >= e.definition.checkpoints.length)) this.completeActivity(e);
    else {
      if (e.definition.kind === 'race') {
        let s = Math.max(0, this.elapsed - e.startedAt);
        this.pushToast(
          `Gate ${e.checkpointIndex}/${e.definition.checkpoints.length}`,
          `${s.toFixed(1)}s elapsed \xB7 keep the line clean`,
          'good',
          1.8,
        );
      }
      this.updateActivityMarker();
    }
  }
  completeActivity(e) {
    let t = Math.max(0.1, this.elapsed - e.startedAt),
      r = this.activityRecords.get(e.definition.id),
      n = Math.max(0, e.startHealth - e.vehicle.health) / Math.max(1, e.vehicle.definition.durability),
      a = n <= 0.06 ? (e.definition.kind === 'race' ? 140 : e.definition.kind === 'taxi' ? 100 : 80) : 0,
      o = Math.max(0, Math.floor(e.remaining * (e.definition.kind === 'race' ? 2 : 1.35))),
      l = r?.completions ? (r.completions >= 3 ? 0.72 : 0.88) : 1,
      c = Math.round(e.definition.reward * l),
      f = r?.completions ? 0 : Math.round(e.definition.reward * 0.35),
      u = c + o + f,
      h = e.definition.faction && this.factionStanding[e.definition.faction] >= 15 ? Math.round(u * 0.12) : 0;
    this.money += u + h + a;
    let d = r?.completions ?? 0,
      m = d === 0 ? 7 : d < 3 ? 1 : 0;
    if (((this.reputation += m), e.definition.faction && e.definition.factionReward)) {
      let v = d === 0 ? e.definition.factionReward : d < 3 ? 1 : 0;
      v && this.adjustFaction(e.definition.faction, v);
    }
    let _ = e.definition.kind === 'race' ? 'clean-line' : e.definition.kind === 'taxi' ? 'comfort' : 'cargo-care',
      p = Math.round((1 - Math.min(1, n)) * 100),
      g = !r?.bestTime || t < r.bestTime;
    (this.activityRecords.set(e.definition.id, {
      completions: (r?.completions ?? 0) + 1,
      bestTime: g ? t : r.bestTime,
      bestCare: Math.max(r?.bestCare ?? 0, p),
    }),
      this.feedback('complete', 0.45, 200),
      this.showResult({
        kind: 'activity',
        kicker: 'ACTIVITY COMPLETE',
        title: e.definition.title,
        total: u + h + a,
        lines: [
          `Base $${c}`,
          ...(f ? [`First clear +$${f}`] : []),
          `Time bonus +$${o}`,
          ...(a ? [`${_.replace('-', ' ')} +$${a}`] : []),
          ...(h ? [`Network +$${h}`] : []),
          `Care ${p}%`,
        ],
        time: t,
        best: g ? t : r.bestTime,
        record: g && !!r?.bestTime,
      }),
      this.cleanupActivity(e, true),
      (this.activeActivity = null),
      setVisible(this.activityRing, false),
      setVisible(this.activityBeam, false),
      this.updateObjectiveMarker(),
      this.save(false));
  }
  cleanupActivity(e, t) {
    e.definition.kind === 'courier' && (setVisible(this.activityCargo, false), this.world.add(this.activityCargo));
    let r = e.definition.checkpoints.at(-1);
    for (let [s, n] of (e.passengers ?? []).entries()) {
      let a = n.pedestrian;
      ((a.activityRole = undefined),
        setVisible(a.root, true),
        t && r
          ? (a.root.position.set(r.x + (s === 0 ? 3.4 : -3.4), 0.32, r.z + 2.2 + s),
            (a.state = 'idle'),
            (a.timer = 3 + s),
            a.target.copy(a.root.position))
          : (a.root.position.copy(n.originalPosition),
            a.target.copy(n.originalTarget),
            (a.state = n.originalState),
            (a.timer = n.originalTimer)));
    }
  }
  activityProgressLabel(e) {
    let t = e.definition.checkpoints.length;
    if (this.activeVehicle !== e.vehicle) return `Return to the ${e.vehicle.definition.name} used to start`;
    if (e.definition.kind === 'taxi') {
      let s = Math.min(e.checkpointIndex, Math.max(1, t - 1));
      return e.checkpointIndex >= t - 1
        ? `${s}/${t - 1} riders aboard \xB7 drive to drop-off`
        : `${s}/${t - 1} riders aboard \xB7 next pickup`;
    }
    if (e.definition.kind === 'courier')
      return e.checkpointIndex >= t - 1
        ? `${e.cargoCount}/${t - 1} parcels \xB7 ${e.definition.returnLabel ?? 'return to Maker Yard'}`
        : `${e.cargoCount}/${t - 1} parcels loaded`;
    let r = Math.max(0, e.startHealth - e.vehicle.health);
    return `Gate ${e.checkpointIndex}/${t} \xB7 ${r < 4 ? 'clean run' : 'vehicle damaged'}`;
  }
  updateActivityMarker() {
    let e = this.activeActivity;
    if (!e) return;
    let t = e.definition.checkpoints[e.checkpointIndex];
    t &&
      (setVisible(this.activityRing, true),
      setVisible(this.activityBeam, true),
      (this.activityRing.position.x = t.x),
      (this.activityRing.position.z = t.z),
      (this.activityBeam.position.x = t.x),
      (this.activityBeam.position.z = t.z),
      this.buildRouteTo(t.x, t.z));
  }
  reservationKey(e, t) {
    return e === 'vehicle' ? `vehicle:${t.id}` : e === 'pedestrian' ? `pedestrian:${t.id}` : `prop:${t.mesh.id}`;
  }
  entityIsReserved(e, t) {
    return this.gameplayReservations.has(this.reservationKey(e, t));
  }
  reserveGameplayEntity(e, t, r) {
    let s = this.reservationKey(t, r);
    if (this.gameplayReservations.has(s)) return null;
    let n;
    if (t === 'vehicle') {
      let a = r,
        o = {
          position: a.root.position.clone(),
          rotation: a.root.rotation.clone(),
          enabled: a.root.visible,
          driver: a.driver,
          speed: a.speed,
          routeIndex: a.routeIndex,
          disabledTimer: a.disabledTimer,
          braking: a.braking,
          health: a.health,
          damageState: a.damageState,
        };
      n = () => {
        (a.root.position.copy(o.position),
          a.root.rotation.copy(o.rotation),
          setVisible(a.root, o.enabled),
          (a.driver = o.driver),
          (a.speed = o.speed),
          (a.routeIndex = o.routeIndex),
          (a.disabledTimer = o.disabledTimer),
          (a.braking = o.braking),
          (a.health = o.health),
          (a.damageState = o.damageState));
      };
    } else if (t === 'pedestrian') {
      let a = r,
        o = {
          position: a.root.position.clone(),
          rotation: a.root.rotation.clone(),
          target: a.target.clone(),
          enabled: a.root.visible,
          state: a.state,
          timer: a.timer,
          activityRole: a.activityRole,
          missionRole: a.missionRole,
          sheltering: a.sheltering,
          callerForIncident: a.callerForIncident,
          health: a.health,
          lastSeenAt: a.lastSeenAt,
          combatant: a.combatant,
        };
      n = () => {
        (a.root.position.copy(o.position),
          a.root.rotation.copy(o.rotation),
          a.target.copy(o.target),
          setVisible(a.root, o.enabled),
          (a.state = o.state),
          (a.timer = o.timer),
          (a.activityRole = o.activityRole),
          (a.missionRole = o.missionRole),
          (a.sheltering = o.sheltering),
          (a.callerForIncident = o.callerForIncident),
          (a.health = o.health),
          (a.lastSeenAt = o.lastSeenAt),
          (a.combatant = o.combatant));
      };
    } else {
      let a = r,
        o = {
          position: a.mesh.position.clone(),
          rotation: a.mesh.rotation.clone(),
          scaling: a.mesh.scale.clone(),
          enabled: a.mesh.visible,
          velocity: a.velocity.clone(),
          angularVelocity: a.angularVelocity,
          disturbed: a.disturbed,
        };
      n = () => {
        (a.mesh.position.copy(o.position),
          a.mesh.rotation.copy(o.rotation),
          a.mesh.scale.copy(o.scaling),
          setVisible(a.mesh, o.enabled),
          a.velocity.copy(o.velocity),
          (a.angularVelocity = o.angularVelocity),
          (a.disturbed = o.disturbed));
      };
    }
    return (this.gameplayReservations.set(s, { key: s, scopeId: e, restore: n }), s);
  }
  releaseGameplayScope(e) {
    for (let [t, r] of [...this.gameplayReservations])
      r.scopeId === e && (r.restore(), this.gameplayReservations.delete(t));
  }
  currentWorldEventStage() {
    let e = this.activeEvent;
    return e?.definition.stages[e.stageIndex] ?? null;
  }
  eligibleWorldEvents() {
    let e = this.getPlayerPosition(),
      t = this.districtAt(e.x, e.z);
    return WORLD_EVENTS.filter((r) =>
      (this.eventCooldowns.get(r.id) ?? 0) > this.elapsed ||
      (r.districts && !r.districts.includes(t.id)) ||
      (r.weather && !r.weather.includes(this.weather))
        ? false
        : r.anchors.some((s) => {
            let n = new Vector3(s.x, 0.35, s.z),
              a = flatDistance(e, n);
            return (
              a >= r.minDistance &&
              a <= r.maxDistance &&
              this.canOccupy(n, 0.75) &&
              !this.interiors.some((o) => this.isInsideInterior(n, o))
            );
          }),
    );
  }
  worldEventAnchor(e) {
    let t = this.getPlayerPosition(),
      r = e.anchors
        .map((s) => new Vector3(s.x, 0.35, s.z))
        .filter((s) => {
          let n = flatDistance(t, s);
          return (
            n >= e.minDistance &&
            n <= e.maxDistance &&
            this.canOccupy(s, 0.75) &&
            !this.interiors.some((a) => this.isInsideInterior(s, a))
          );
        })
        .sort((s, n) => flatDistance(t, s) - flatDistance(t, n));
    return r.length ? r[this.worldEventCounter % r.length].clone() : null;
  }
  worldEventPlacement(e, t, r, s) {
    let n = [r, r * 0.72, r * 0.45],
      a = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3];
    for (let o of n)
      for (let l of a) {
        let c = new Vector3(e.x + Math.cos(t + l) * o, e.y, e.z + Math.sin(t + l) * o);
        if (this.canOccupy(c, s) && !this.interiors.some((f) => this.isInsideInterior(c, f))) return c;
      }
    return this.canOccupy(e, s) ? e.clone() : null;
  }
  setupWorldEvent(e) {
    let t = this.worldEventAnchor(e);
    if (!t) return null;
    let r = `world-event-${++this.worldEventCounter}-${e.id}`,
      s = {
        id: r,
        definition: e,
        x: t.x,
        z: t.z,
        originX: t.x,
        originZ: t.z,
        remaining: e.timeout,
        stageIndex: 0,
        stageProgress: 0,
        securedIds: new Set(),
        affectedPedestrians: [],
        affectedProps: [],
      };
    if (e.setup === 'breakdown') {
      let n = this.getPlayerPosition(),
        a = this.vehicles
          .filter(
            (o) =>
              o.driver === 'traffic' &&
              !o.police &&
              !o.owned &&
              o !== this.activeVehicle &&
              o !== this.activeActivity?.vehicle &&
              o.id !== 'marked-rivet' &&
              !this.entityIsReserved('vehicle', o) &&
              flatDistance(o.root.position, n) >= e.minDistance &&
              flatDistance(o.root.position, n) <= e.maxDistance,
          )
          .sort((o, l) => flatDistance(o.root.position, t) - flatDistance(l.root.position, t))[0];
      if (!a || !this.reserveGameplayEntity(r, 'vehicle', a)) return null;
      ((a.speed = 0),
        (a.disabledTimer = e.timeout),
        (a.braking = true),
        (s.affectedVehicle = a),
        (s.x = a.root.position.x),
        (s.z = a.root.position.z),
        (s.originX = s.x),
        (s.originZ = s.z));
    } else if (e.setup === 'performance') {
      let n = this.pedestrians
        .filter(
          (a) =>
            !a.special &&
            !a.combatant &&
            !a.activityRole &&
            a.state !== 'call' &&
            a.state !== 'down' &&
            !this.entityIsReserved('pedestrian', a),
        )
        .sort((a, o) => flatDistance(a.root.position, t) - flatDistance(o.root.position, t))
        .slice(0, 6);
      if (n.length < 4) return null;
      for (let [a, o] of n.entries()) {
        if (!this.reserveGameplayEntity(r, 'pedestrian', o)) return (this.releaseGameplayScope(r), null);
        let l = (a / n.length) * Math.PI * 2,
          c = this.worldEventPlacement(t, l, 4.6, 0.58);
        if (!c) return (this.releaseGameplayScope(r), null);
        (o.root.position.set(c.x, 0.32, c.z),
          o.target.copy(t),
          (o.state = 'observe'),
          (o.timer = e.timeout),
          setVisible(o.root, true));
      }
      s.affectedPedestrians = n;
    } else {
      let n = this.props
        .filter((a) => !this.entityIsReserved('prop', a))
        .sort((a, o) => flatDistance(a.mesh.position, t) - flatDistance(o.mesh.position, t))
        .slice(0, 3);
      if (n.length < 3) return null;
      for (let [a, o] of n.entries()) {
        if (!this.reserveGameplayEntity(r, 'prop', o)) return (this.releaseGameplayScope(r), null);
        let l = (a / n.length) * Math.PI * 2 + 0.45,
          c = this.worldEventPlacement(t, l, 3.8 + a * 0.55, 0.5);
        if (!c) return (this.releaseGameplayScope(r), null);
        (o.mesh.position.set(c.x, 0.65, c.z),
          o.mesh.rotation.set(0.2 * a, l, 0.45),
          setVisible(o.mesh, true),
          o.velocity.setScalar(0),
          (o.angularVelocity = 0),
          (o.disturbed = false));
      }
      s.affectedProps = n;
    }
    return s;
  }
  tryStartWorldEvent() {
    let e = this.eligibleWorldEvents();
    if (!e.length) return false;
    let t = e.flatMap((n) => {
        let a = this.weather === 'rain' && n.setup !== 'performance' ? 2 : 0;
        return Array.from({ length: Math.max(1, n.weight + a) }, () => n);
      }),
      r = (Math.floor(this.elapsed / 11) + this.worldEventCounter * 3) % t.length,
      s = new Set();
    for (let n = 0; n < t.length; n += 1) {
      let a = t[(r + n) % t.length];
      if (s.has(a.id)) continue;
      s.add(a.id);
      let o = this.setupWorldEvent(a);
      if (o)
        return (
          (this.activeEvent = o),
          this.syncWorldEventMarker(),
          this.pushToast(
            `Nearby incident \xB7 ${a.title}`,
            `${a.description} You can ignore it or intervene.`,
            'neutral',
            6,
          ),
          true
        );
    }
    return false;
  }
  syncWorldEventMarker() {
    let e = this.activeEvent;
    if (!e) return;
    if (this.currentWorldEventStage()?.kind === 'secureTargets') {
      let r = e.affectedProps.find((s) => !e.securedIds.has(this.reservationKey('prop', s)));
      r && ((e.x = r.mesh.position.x), (e.z = r.mesh.position.z));
    } else
      e.affectedVehicle
        ? ((e.x = e.affectedVehicle.root.position.x), (e.z = e.affectedVehicle.root.position.z))
        : ((e.x = e.originX), (e.z = e.originZ));
    (setVisible(this.eventRing, true),
      setVisible(this.eventBeam, true),
      this.eventRing.position.set(e.x, 0.37, e.z),
      this.eventBeam.position.set(e.x, 2.5, e.z));
  }
  worldEventProgressLabel() {
    let e = this.activeEvent,
      t = this.currentWorldEventStage();
    return !e || !t
      ? ''
      : t.kind === 'hold'
        ? `${Math.min(t.duration ?? 0, e.stageProgress).toFixed(1)}/${t.duration ?? 0}s`
        : t.kind === 'secureTargets'
          ? `${e.securedIds.size}/${t.requiredCount ?? e.affectedProps.length} secured`
          : `Step ${e.stageIndex + 1}/${e.definition.stages.length}`;
  }
  worldEventInteractionLabel() {
    let e = this.currentWorldEventStage();
    return e ? (e.kind === 'secureTargets' ? `${e.label} \xB7 ${this.worldEventProgressLabel()}` : e.label) : '';
  }
  updateWorldEvents(e) {
    this.eventTimer -= e;
    let t = this.activeEvent;
    if (!t) {
      this.eventTimer <= 0 && (this.eventTimer = this.tryStartWorldEvent() ? 0 : 10);
      return;
    }
    if (((t.remaining -= e), t.remaining <= 0)) {
      this.finishWorldEvent('ignored');
      return;
    }
    let r = this.currentWorldEventStage();
    if (r?.kind === 'hold') {
      let n =
        flatDistance(this.getPlayerPosition(), new Vector3(t.x, 0, t.z)) <= r.radius &&
        (!r.requireOnFoot || !this.activeVehicle);
      ((t.stageProgress = n ? t.stageProgress + e : Math.max(0, t.stageProgress - e * 0.5)),
        t.stageProgress >= (r.duration ?? 1) && this.advanceWorldEventStage());
    }
  }
  performWorldEventInteraction() {
    let e = this.activeEvent,
      t = this.currentWorldEventStage();
    if (!e || !t || t.kind === 'hold' || (t.requireOnFoot && this.activeVehicle)) return;
    let r = this.getPlayerPosition();
    if (t.kind === 'interact') {
      if (flatDistance(r, new Vector3(e.x, 0, e.z)) > t.radius) return;
      this.advanceWorldEventStage();
      return;
    }
    let s = e.affectedProps
      .filter((a) => !e.securedIds.has(this.reservationKey('prop', a)))
      .sort((a, o) => flatDistance(a.mesh.position, r) - flatDistance(o.mesh.position, r))[0];
    if (!s || flatDistance(s.mesh.position, r) > t.radius) return;
    let n = this.reservationKey('prop', s);
    (e.securedIds.add(n),
      s.mesh.position.set(e.originX, -10 - e.securedIds.size, e.originZ),
      setVisible(s.mesh, false),
      (e.stageProgress = e.securedIds.size),
      e.securedIds.size >= (t.requiredCount ?? e.affectedProps.length)
        ? this.advanceWorldEventStage()
        : (this.pushToast('Cargo secured', this.worldEventProgressLabel(), 'good', 2.2), this.syncWorldEventMarker()));
  }
  advanceWorldEventStage() {
    let e = this.activeEvent;
    if (e) {
      if (((e.stageIndex += 1), (e.stageProgress = 0), e.stageIndex >= e.definition.stages.length)) {
        this.finishWorldEvent('resolved');
        return;
      }
      (this.syncWorldEventMarker(),
        this.pushToast(
          e.definition.title,
          this.currentWorldEventStage()?.label ?? 'Continue helping nearby.',
          'neutral',
          3.5,
        ));
    }
  }
  finishWorldEvent(e, t = true) {
    let r = this.activeEvent;
    if (r) {
      if (e === 'resolved') {
        let s = this.factionStanding[r.definition.faction] >= 15 ? Math.round(r.definition.reward * 0.2) : 0;
        ((this.money += r.definition.reward + s),
          (this.reputation += 2),
          this.adjustFaction(r.definition.faction, 2),
          t && this.feedback('objective', 0.3, 100),
          t &&
            this.pushToast(
              `Incident resolved \xB7 ${r.definition.title}`,
              `Community reward +$${r.definition.reward + s}`,
              'good',
              4.5,
            ));
      } else
        e === 'ignored' &&
          t &&
          this.pushToast(
            `Incident ended \xB7 ${r.definition.title}`,
            'The city carried on without your intervention.',
            'neutral',
            3.5,
          );
      (this.releaseGameplayScope(r.id),
        this.eventCooldowns.set(r.definition.id, this.elapsed + r.definition.cooldown),
        (this.activeEvent = null),
        setVisible(this.eventRing, false),
        setVisible(this.eventBeam, false),
        (this.eventTimer = e === 'resolved' ? 30 : 22),
        this.updateObjectiveMarker());
    }
  }
  updateWorldClock(e) {
    if (((this.timeOfDay = (this.timeOfDay + e * 0.018) % 24), (this.weatherTimer -= e), this.weatherTimer <= 0)) {
      let t = ['clear', 'cloudy', 'rain', 'fog'];
      ((this.weather = t[(t.indexOf(this.weather) + 1) % t.length]),
        (this.weatherTimer = 58 + (this.elapsed % 28)),
        this.weather === 'rain' ? this.rain?.start() : this.rain?.stop(),
        this.pushToast(
          `Weather \xB7 ${this.weather[0].toUpperCase()}${this.weather.slice(1)}`,
          this.weather === 'rain' ? 'Wet roads reduce vehicle grip and thin the crowds.' : 'The city adjusts its pace.',
          'neutral',
          4,
        ));
    }
  }
  updateInteraction() {
    let e = this.getPlayerPosition(),
      t = this.currentObjective(),
      r = t?.requiredActorId ? this.pedestrians.find((o) => o.id === t.requiredActorId) : undefined;
    if (!this.activeVehicle && t) {
      if (t.kind === 'searchArea') {
        let o = (t.points ?? [])
          .filter((l) => !this.objectiveSubgoals.has(l.id))
          .sort((l, c) => flatDistance(e, new Vector3(l.x, 0, l.z)) - flatDistance(e, new Vector3(c.x, 0, c.z)))[0];
        if (o && flatDistance(e, new Vector3(o.x, 0, o.z)) <= (o.radius ?? 3.2)) {
          this.interaction = {
            kind: 'mission',
            label: `Inspect ${o.label}`,
            missionTargetId: o.id,
          };
          return;
        }
      }
      if (t.kind === 'transportNpc' && !this.missionPassengerId && r && flatDistance(e, r.root.position) <= 3.2) {
        this.interaction = {
          kind: 'mission',
          label: t.inviteLabel ?? `Invite ${r.id === 'tess' ? 'Tess' : r.archetype} into the service vehicle`,
          missionTargetId: r.id,
        };
        return;
      }
      if (t.kind === 'talk' || t.kind === 'interact' || t.kind === 'deliverObject' || t.kind === 'pickup') {
        let o = this.missionObjectiveTargetPosition(t);
        if (o && (!t.requiredActorId || r) && flatDistance(e, o) <= (t.radius ?? 4)) {
          this.interaction = {
            kind: 'mission',
            label: t.label,
            missionTargetId: t.targetId ?? t.requiredActorId ?? t.grantsItemId,
          };
          return;
        }
      }
    }
    if (t?.kind === 'transportNpc' && this.missionPassengerId && this.activeVehicle?.id === t.requiredVehicleId) {
      let o = (t.points ?? []).find((l) => !this.objectiveSubgoals.has(l.id));
      if (o && flatDistance(e, new Vector3(o.x, 0, o.z)) <= (o.radius ?? 6)) {
        this.interaction = {
          kind: 'mission',
          label:
            Math.abs(this.activeVehicle.speed) > (t.maxSpeed ?? 4.2)
              ? 'Slow down to complete this service stop'
              : o.label,
          missionTargetId: o.id,
        };
        return;
      }
    }
    if (!this.activeVehicle) {
      let l = (this.activeMission()?.optionalObjectives ?? [])
        .filter((c) => c.kind === 'inspectAll' && this.missionOptionalStates.get(c.id) === 'active')
        .flatMap((c) => c.targetIds ?? [])
        .filter((c) => !this.missionOptionalProgress.has(c))
        .map((c) => this.missionObjects.get(c))
        .filter((c) => !!c)
        .sort((c, f) => flatDistance(e, this.gamePositionOf(c.mesh)) - flatDistance(e, this.gamePositionOf(f.mesh)))[0];
      if (l && flatDistance(e, this.gamePositionOf(l.mesh)) <= 3.2) {
        this.interaction = {
          kind: 'missionOptional',
          label: 'Inspect optional shipment clue',
          missionTargetId: l.definition.id,
        };
        return;
      }
    }
    if (
      this.activeActivity &&
      this.activeActivity.definition.kind !== 'race' &&
      this.activeVehicle === this.activeActivity.vehicle
    ) {
      let o = this.activeActivity,
        l = o.definition.checkpoints[o.checkpointIndex];
      if (l && flatDistance(e, new Vector3(l.x, 0, l.z)) < 6.5) {
        let c = o.checkpointIndex === o.definition.checkpoints.length - 1,
          f = o.definition.checkpoints.length - 1,
          u =
            Math.abs(o.vehicle.speed) > 4.2
              ? 'Slow below 15 km/h to stop here'
              : o.definition.kind === 'taxi'
                ? c
                  ? `Drop off ${f} riders`
                  : `Pick up rider ${o.checkpointIndex + 1}/${f}`
                : c
                  ? `Deliver ${o.cargoCount} parcels`
                  : `Load parcel ${o.checkpointIndex + 1}/${f}`;
        this.interaction = { kind: 'activityStep', label: u };
        return;
      }
    }
    if (this.activeEvent) {
      let o = this.currentWorldEventStage(),
        l = flatDistance(e, new Vector3(this.activeEvent.x, 0, this.activeEvent.z));
      if (o && o.kind !== 'hold' && (!o.requireOnFoot || !this.activeVehicle) && l < o.radius) {
        this.interaction = {
          kind: 'event',
          label: this.worldEventInteractionLabel(),
        };
        return;
      }
    }
    if (!this.activeActivity) {
      let o = ACTIVITIES.find((l) => flatDistance(e, new Vector3(l.x, 0, l.z)) < 4.8);
      if (o) {
        let l = this.activityRecords.get(o.id);
        this.interaction = {
          kind: 'activity',
          label: `Start ${o.title} \xB7 $${o.reward}+${l?.bestTime ? ` \xB7 PB ${l.bestTime.toFixed(1)}s` : ' \xB7 first-clear bonus'}`,
          activity: o,
        };
        return;
      }
    }
    if (this.activeInterior) {
      let o = this.activeInterior;
      if (flatDistance(e, o.servicePoint) < 3.2) {
        this.interaction = {
          kind: 'business',
          label: this.businessInteractionLabel(o.business),
          business: o.business,
        };
        return;
      }
      if (flatDistance(e, o.interiorEntry) < 2.2) {
        this.interaction = {
          kind: 'interior',
          label: `Exit ${o.business.name}`,
          interior: o,
        };
        return;
      }
    } else {
      let o = this.interiors.find((l) => flatDistance(e, l.exteriorEntry) < 2.8);
      if (o && (!this.activeVehicle || o.business.service === 'repair')) {
        this.interaction = {
          kind: 'interior',
          label: `Enter ${o.business.name}`,
          interior: o,
        };
        return;
      }
    }
    let s = BUSINESSES.find((o) => !o.enterable && flatDistance(e, new Vector3(o.x, 0, o.z)) < 4.4);
    if (s) {
      this.interaction = {
        kind: 'business',
        label: this.businessInteractionLabel(s),
        business: s,
      };
      return;
    }
    if (this.activeVehicle) {
      this.interaction = {
        kind: 'exit',
        label: `Exit ${this.activeVehicle.definition.name}`,
      };
      return;
    }
    // Nearest vehicle and person by a plain scan: this runs every tick. Hidden
    // ones (another mission's vehicle, a rider already aboard) are not there
    // to use; the old sorted search offered them anyway.
    let n = null,
      nd = 3.1;
    for (const o of this.vehicles) {
      if (o.police || !o.root.visible) continue;
      const d = flatDistance(e, o.root.position);
      d < nd && ((n = o), (nd = d));
    }
    if (n) {
      this.interaction = {
        kind: 'vehicle',
        label: `${n.owned ? 'Drive' : n.driver ? 'Take' : 'Enter'} ${n.definition.name}`,
        vehicle: n,
      };
      return;
    }
    let a = null,
      ad = 2.3;
    for (const o of this.pedestrians) {
      if (o.special || o.combatant || o.state === 'flee' || o.state === 'down' || !o.root.visible) continue;
      const d = flatDistance(e, o.root.position);
      d < ad && ((a = o), (ad = d));
    }
    if (a) {
      this.interaction = {
        kind: 'pedestrian',
        label: `Greet ${a.archetype}`,
        pedestrian: a,
      };
      return;
    }
    this.interaction = null;
  }
  performMissionInteraction(e, t = false) {
    let r = this.activeMission(),
      s = this.currentObjective();
    if (!(!r || !s)) {
      if (t) {
        let n = (r.optionalObjectives ?? []).find(
          (o) =>
            o.kind === 'inspectAll' &&
            this.missionOptionalStates.get(o.id) === 'active' &&
            !!(e && o.targetIds?.includes(e)),
        );
        if (!n || !e || this.missionOptionalProgress.has(e)) return;
        let a = this.missionObjects.get(e);
        if (!a || flatDistance(this.getPlayerPosition(), this.gamePositionOf(a.mesh)) > 3.4) return;
        (this.missionOptionalProgress.add(e),
          this.pushToast(
            'Shipment clue inspected',
            `${this.missionOptionalProgress.size}/${n.targetIds?.length ?? 1} clues logged`,
            'good',
            3,
          ),
          this.updateMissionOptionals(),
          this.updateMissionObjectVisuals(),
          this.updateObjectiveMarker(),
          this.save(false));
        return;
      }
      if (s.kind === 'searchArea') {
        let n = (s.points ?? []).find((a) => a.id === e);
        if (
          !n ||
          this.objectiveSubgoals.has(n.id) ||
          flatDistance(this.getPlayerPosition(), new Vector3(n.x, 0, n.z)) > (n.radius ?? 3.2)
        )
          return;
        (this.objectiveSubgoals.add(n.id),
          this.missionOptionalProgress.add(n.id),
          this.pushToast(
            'Shipment clue inspected',
            `${n.label} \xB7 ${this.objectiveSubgoals.size}/${s.requiredCount ?? s.points?.length ?? 1}`,
            'good',
            3,
          ),
          this.updateMissionOptionals(),
          this.updateMissionObjectVisuals(),
          this.objectiveSubgoals.size >= (s.requiredCount ?? s.points?.length ?? 1)
            ? this.completeObjective()
            : (this.updateObjectiveMarker(), this.save(false)));
        return;
      }
      if (s.kind === 'transportNpc') {
        let n = s.requiredActorId ? this.pedestrians.find((f) => f.id === s.requiredActorId) : undefined,
          a = s.requiredVehicleId ? this.vehicles.find((f) => f.id === s.requiredVehicleId) : undefined;
        if (!this.missionPassengerId) {
          if (
            !n ||
            !a ||
            e !== n.id ||
            this.activeVehicle ||
            a.health <= 0 ||
            flatDistance(n.root.position, a.root.position) > 11.5
          ) {
            this.pushToast(
              'Service vehicle required',
              s.vehicleHint ?? "Bring Tess's marked Rivet close and make sure it can still run.",
              'neutral',
              3.5,
            );
            return;
          }
          ((this.missionPassengerId = n.id),
            (n.missionRole = 'passenger'),
            setVisible(n.root, false),
            this.sfx('objective'),
            this.pushToast(
              s.boardedTitle ?? 'Tess is ready',
              s.boardedText ?? 'Use the marked service Rivet and stop at each route call.',
              'good',
              4,
            ),
            this.updateObjectiveMarker(),
            this.save(false));
          return;
        }
        let o = (s.points ?? []).find((f) => f.id === e);
        if (!o || !a || this.activeVehicle !== a) return;
        if (Math.abs(a.speed) > (s.maxSpeed ?? 4.2)) {
          this.pushToast('Slow down', s.slowText ?? 'Stop the service Rivet before completing this call.', 'neutral', 2.5);
          return;
        }
        if ((s.points ?? []).find((f) => !this.objectiveSubgoals.has(f.id))?.id !== o.id) {
          this.pushToast('Route order matters', 'Complete the highlighted service call first.', 'neutral', 3);
          return;
        }
        (this.objectiveSubgoals.add(o.id),
          this.objectiveSubgoals.size >= (s.points?.length ?? 0)
            ? (n &&
                ((n.missionRole = undefined),
                n.root.position.set(o.x + 2.4, 0.32, o.z + 1.6),
                setVisible(n.root, true),
                (n.state = 'idle'),
                (n.timer = 4)),
              (this.missionPassengerId = null),
              this.completeObjective())
            : (this.sfx('gate'),
              this.pushToast(
                'Service call complete',
                `${this.objectiveSubgoals.size}/${s.points?.length ?? 1} stops`,
                'good',
                3,
              ),
              this.updateObjectiveMarker(),
              this.save(false)));
        return;
      }
      if (s.kind === 'pickup') {
        let n = s.targetId ?? s.grantsItemId,
          a = n ? this.missionObjects.get(n) : undefined;
        if (!n || e !== n || !a || !a.mesh.visible) return;
        ((this.carriedMissionItem = s.grantsItemId ?? n), this.completeObjective(), this.updateMissionObjectVisuals());
        return;
      }
      if (s.kind === 'deliverObject' || s.kind === 'interact' || s.kind === 'talk') {
        if (s.requiredActorId && (!e || e !== s.requiredActorId)) return;
        if (s.requiresItemId && this.carriedMissionItem !== s.requiresItemId) {
          this.pushToast(
            'Mission item missing',
            'Return to the pickup point before completing this delivery.',
            'danger',
            4,
          );
          return;
        }
        (s.grantsItemId && (this.carriedMissionItem = s.grantsItemId),
          s.requiresItemId === this.carriedMissionItem && (this.carriedMissionItem = null),
          this.completeObjective(),
          this.updateMissionObjectVisuals());
      }
    }
  }
  performInteraction() {
    let e = this.interaction;
    if (e)
      switch (e.kind) {
        case 'exit':
          this.exitVehicle();
          break;
        case 'vehicle':
          e.vehicle && this.enterVehicle(e.vehicle);
          break;
        case 'business':
          e.business && this.useBusiness(e.business);
          break;
        case 'mission':
          this.performMissionInteraction(e.missionTargetId);
          break;
        case 'missionOptional':
          this.performMissionInteraction(e.missionTargetId, true);
          break;
        case 'event':
          this.performWorldEventInteraction();
          break;
        case 'activity':
          e.activity && this.startActivity(e.activity);
          break;
        case 'activityStep':
          this.advanceActivityStep();
          break;
        case 'pedestrian':
          e.pedestrian && this.greetPedestrian(e.pedestrian);
          break;
        case 'interior':
          e.interior && this.toggleInterior(e.interior);
          break;
      }
  }
  enterVehicle(e) {
    if (this.entityIsReserved('vehicle', e)) {
      this.pushToast(
        'Incident vehicle unavailable',
        'Resolve or leave the nearby incident before using this vehicle.',
        'neutral',
        3.5,
      );
      return;
    }
    if (this.activeActivity && this.activeActivity.vehicle !== e) {
      this.pushToast(
        'Activity vehicle required',
        `Finish ${this.activeActivity.definition.title} in the ${this.activeActivity.vehicle.definition.name} that started it.`,
        'neutral',
        4,
      );
      return;
    }
    if (e.police && this.wanted < 1) {
      this.pushToast('Civic vehicle locked', 'The response fleet is not available for public use.', 'danger', 3);
      return;
    }
    let t = e.driver === 'traffic';
    e.driver = 'player';
    let r = this.activeMissionOwnsAsset(e.id);
    ((e.stolen = !e.owned && !r),
      (this.activeVehicle = e),
      (this.playerCrouched = false),
      (this.playerSwimming = false),
      (this.player.scale.y = 1),
      this.cameraMode !== 'isometric' &&
        ((this.perspectiveYaw = e.root.rotation.y),
        (this.lastPerspectiveActorYaw = e.root.rotation.y),
        (this.lastCameraInputAt = -100),
        (this.cameraSnapPending = true)));
    for (let n of this.playerMeshes) setVisible(n, false);
    (setVisible(this.player, false),
      (this.cameraViewHeight = 77),
      e.stolen && this.createCrime('Vehicle theft', t ? 1.15 : 0.82, e.root.position));
    let s = this.currentObjective();
    if (s && this.vehicleMatchesObjective(s, e)) {
      let n = s.armEscapeWhenStolen === true && e.stolen;
      (this.completeObjective(), n && (this.escapeArmed = true));
    }
    (this.applyCameraVisibility(), this.updateObjectiveMarker());
  }
  safeVehicleExitPosition(e) {
    let t = Math.max(2.2, e.collisionRadius + 0.9),
      r = new Vector3(Math.cos(e.root.rotation.y), 0, -Math.sin(e.root.rotation.y)),
      s = new Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y)),
      n = [
        e.root.position.clone().add(r.clone().multiplyScalar(t)),
        e.root.position.clone().sub(r.clone().multiplyScalar(t)),
        e.root.position.clone().sub(s.clone().multiplyScalar(t + 0.4)),
        e.root.position.clone().add(s.clone().multiplyScalar(t + 0.4)),
      ];
    return n.find((a) => this.canOccupy(a, 0.65)) ?? n[0];
  }
  exitVehicle(e = false) {
    let t = this.activeVehicle;
    if (!t) return;
    if (!e && Math.abs(t.speed) > 5) {
      this.pushToast('Slow down first', 'Exit is available below 5 m/s.', 'neutral', 2.4);
      return;
    }
    let r = this.safeVehicleExitPosition(t);
    (this.player.position.set(r.x, 0.35, r.z),
      (this.playerCrouched = false),
      (this.playerSwimming = false),
      (this.player.scale.y = 1),
      (this.player.rotation.y = t.root.rotation.y),
      setVisible(this.player, true));
    for (let s of this.playerMeshes) setVisible(s, true);
    ((t.driver = null),
      (t.speed *= 0.35),
      (this.activeVehicle = null),
      (this.cameraViewHeight = 64),
      this.cameraMode !== 'isometric' &&
        ((this.perspectiveYaw = this.player.rotation.y),
        (this.lastPerspectiveActorYaw = this.player.rotation.y),
        (this.lastCameraInputAt = -100),
        (this.cameraSnapPending = true)),
      this.applyCameraVisibility(),
      this.updateObjectiveMarker());
  }
  useBusiness(e) {
    let t = this.businessPrice(e);
    if (e.service === 'heal') this.openStore('cafe');
    else if (e.service === 'repair') {
      let r = this.nearestVehicleTo(e.x, e.z, 8);
      if (!r || r.health >= r.definition.durability - 0.5) {
        this.openStore('garage');
        return;
      }
      if (!this.spend(t)) return;
      ((r.health = r.definition.durability),
        (r.damageState = 'healthy'),
        (r.braking = false),
        this.sfx('cash'),
        this.pushToast('Vehicle repaired', `${r.definition.name} is ready \xB7 -$${t}`, 'good', 4));
    } else if (e.service === 'vehicle') this.openStore('vehicles');
    else if (e.service === 'clothing') {
      if (!this.spend(t)) return;
      ((this.outfitIndex = (this.outfitIndex + 1) % OUTFITS.length),
        this.applyOutfit(),
        this.applyCameraVisibility(),
        this.sfx('cash'),
        this.pushToast(
          'Outfit updated',
          `Threadline preset ${this.outfitIndex + 1}/${OUTFITS.length} \xB7 -$${t}`,
          'good',
          4,
        ),
        this.save(false));
    } else if (e.service === 'save') {
      this.wanted === 1 && ((this.wanted = 0), (this.heat = 0));
      let r = this.propertyLevels.get('hush-house-loft') ?? 0;
      ((this.health = r >= 2 ? 100 : Math.max(this.health, r >= 1 ? 85 : 70)), this.save(), this.openStore('hush'));
    }
  }
  businessInteractionLabel(e) {
    if (e.service === 'vehicle') return `Browse ${e.name} vehicle catalog`;
    if (e.service === 'heal') return `Browse ${e.name} recovery counter`;
    if (e.service === 'save') return `Save and use ${e.name} property desk`;
    if (e.service === 'repair') {
      let t = this.nearestVehicleTo(e.x, e.z, 8);
      return t && t.health < t.definition.durability - 0.5
        ? `Repair ${t.definition.name} \xB7 $${this.businessPrice(e)}`
        : `Use ${e.name} cooperative desk`;
    }
    return `${e.name} \xB7 $${this.businessPrice(e)} \xB7 ${e.description}`;
  }
  businessPrice(e) {
    let t = 1;
    if (e.service === 'repair') {
      let r = this.businessLevels.get('loop-garage') ?? 0;
      ((t *= r >= 3 ? 0.6 : r >= 2 ? 0.75 : r >= 1 ? 0.9 : 1), this.factionStanding.makers >= 15 && (t *= 0.9));
    }
    return (
      e.service === 'vehicle' && this.factionStanding.makers >= 35 && (t = 0.85),
      e.service === 'heal' && this.factionStanding.neighborhoods >= 15 && (t = 0.8),
      e.service === 'clothing' && this.factionStanding.neighborhoods >= 15 && (t = 0.8),
      Math.round(e.price * t)
    );
  }
  factionTier(e) {
    return e <= -15 ? 'Wary' : e >= 35 ? 'Allied' : e >= 15 ? 'Trusted' : 'Neutral';
  }
  adjustFaction(e, t) {
    if (!t) return;
    let r = this.factionTier(this.factionStanding[e]);
    this.factionStanding[e] = clamp(this.factionStanding[e] + t, -50, 50);
    let s = this.factionTier(this.factionStanding[e]);
    if (r !== s) {
      let n = FACTIONS.find((a) => a.id === e);
      this.pushToast(
        `${n?.name ?? 'Faction'} \xB7 ${s}`,
        s === 'Trusted' || s === 'Allied'
          ? 'New city benefits are now active.'
          : s === 'Wary'
            ? 'Your choices are changing how this group responds.'
            : 'Standing returned to neutral.',
        s === 'Wary' ? 'danger' : 'good',
        5,
      );
    }
  }
  spend(e) {
    return this.money < e
      ? (this.pushToast('Not enough money', `You need $${e - this.money} more.`, 'danger', 3.5), false)
      : ((this.money -= e), true);
  }
  nearestVehicleTo(e, t, r) {
    let s = new Vector3(e, 0, t);
    return (
      this.vehicles
        .filter((n) => flatDistance(n.root.position, s) <= r)
        .sort((n, a) => flatDistance(n.root.position, s) - flatDistance(a.root.position, s))[0] ?? null
    );
  }
  greetPedestrian(e) {
    let r = {
        commuter: ['Green lights all the way today!', 'Sunline station is humming.'],
        shopper: ['Old Quay has the good fruit today.', 'Merry Motors is running a deal.'],
        jogger: ['Sunpatch Park makes a perfect loop.', 'Mind the wet corners in rain.'],
        worker: ['Maker Yard never really sleeps.', 'Loop Garage can fix almost anything.'],
        tourist: ['The colors here look different every hour.', 'I found a purple City Spark by the water.'],
        vendor: ['A little kindness keeps this block bright.', 'Events pop up when you least expect them.'],
      }[e.archetype] ?? ['Beautiful day for a wander.'],
      s = r[Math.floor(this.elapsed + e.phase) % r.length];
    (this.elapsed - e.lastGreeted > 45 && ((this.reputation += 1), (e.lastGreeted = this.elapsed)),
      (e.state = 'idle'),
      (e.timer = 2),
      this.pushToast(e.archetype[0].toUpperCase() + e.archetype.slice(1), s, 'neutral', 4));
  }
  performAttack() {
    if (this.attackCooldown > 0) return;
    ((this.attackCooldown = 0.55),
      (this.attackFx = 0.48),
      setVisible(this.attackRing, true),
      this.attackRing.position.copy(this.player.position),
      (this.attackRing.position.y = 0.32),
      this.attackRing.scale.setScalar(0.5));
    let e = false,
      t = false;
    for (let r of this.pedestrians)
      if (
        !(r.special || r.state === 'down' || !r.root.visible) &&
        flatDistance(r.root.position, this.player.position) < 2.35
      ) {
        e = true;
        let s = r.root.position.clone().sub(this.player.position).normalize();
        (r.root.position.add(s.clone().multiplyScalar(1.4)),
          (r.callerForIncident = null),
          r.combatant
            ? ((r.health = Math.max(0, r.health - 46)),
              (r.lastSeenAt = this.elapsed),
              r.health <= 0
                ? ((r.state = 'down'), (r.timer = 9))
                : r.health < 36
                  ? ((r.state = 'retreat'),
                    (r.target = r.root.position.clone().add(s.clone().multiplyScalar(24))),
                    (r.timer = 8))
                  : ((r.state = 'alert'),
                    r.target.copy(this.player.position),
                    (r.timer = 0.2),
                    this.alertHostileAllies(r, this.player.position)))
            : ((t = true),
              (r.state = 'flee'),
              (r.target = r.root.position.clone().add(s.clone().multiplyScalar(22))),
              (r.timer = 10)));
      }
    (e ? this.feedback('shove', 0.4, 90) : this.sfx('shove', 0.5),
      t && this.createCrime('Assault', 1.25, this.player.position),
      e && !t && this.pushToast('Shove landed', 'The hostile crew is reacting to your position.', 'neutral', 1.8),
      this.alertNearbyPedestrians('combat', 13));
  }
  /**
   * Where the player (or their vehicle) is. This is called dozens of times a
   * tick, so it fills one shared vector: callers read it or copy it, never
   * keep or change it.
   */
  getPlayerPosition() {
    return this.playerPosScratch.copy((this.activeVehicle?.root ?? this.player).position);
  }
  buildRouteTo(e, t) {
    ((this.route = this.calculateRoadRoute(this.getPlayerPosition(), new Vector3(e, 0.35, t), !!this.activeVehicle)),
      this.refreshRouteMarkers());
  }
  calculateRoadRoute(e, t, r) {
    let s = (g, v) => g.reduce((S, A, T) => (Math.abs(A - v) < Math.abs(g[S] - v) ? T : S), 0),
      n = (g) => {
        let v = s(ROAD_X, g.x),
          S = s(ROAD_Z, g.z),
          A = Math.abs(ROAD_X[v] - g.x),
          T = Math.abs(ROAD_Z[S] - g.z);
        return A <= T
          ? {
              node: {
                id: `${v}:${S}`,
                xIndex: v,
                zIndex: S,
                point: new Vector3(ROAD_X[v], 0.35, ROAD_Z[S]),
              },
              approach: { x: ROAD_X[v], z: g.z },
            }
          : {
              node: {
                id: `${v}:${S}`,
                xIndex: v,
                zIndex: S,
                point: new Vector3(ROAD_X[v], 0.35, ROAD_Z[S]),
              },
              approach: { x: g.x, z: ROAD_Z[S] },
            };
      },
      a = n(e),
      o = n(t),
      l = (g, v) => ({
        id: `${g}:${v}`,
        xIndex: g,
        zIndex: v,
        point: new Vector3(ROAD_X[g], 0.35, ROAD_Z[v]),
      }),
      c = new Set([a.node.id]),
      f = new Map(),
      u = new Map([[a.node.id, 0]]),
      h = new Map([[a.node.id, flatDistance(a.node.point, o.node.point)]]),
      d = new Map([
        [a.node.id, a.node],
        [o.node.id, o.node],
      ]);
    for (; c.size > 0; ) {
      let g = [...c][0];
      for (let A of c) (h.get(A) ?? 1 / 0) < (h.get(g) ?? 1 / 0) && (g = A);
      let v = d.get(g);
      if (g === o.node.id) break;
      c.delete(g);
      let S = [
        [v.xIndex - 1, v.zIndex],
        [v.xIndex + 1, v.zIndex],
        [v.xIndex, v.zIndex - 1],
        [v.xIndex, v.zIndex + 1],
      ].filter(([A, T]) => A >= 0 && A < ROAD_X.length && T >= 0 && T < ROAD_Z.length);
      for (let [A, T] of S) {
        let C = l(A, T);
        d.set(C.id, C);
        let I = flatDistance(v.point, C.point),
          M = 0;
        if (r)
          for (let N of this.vehicles)
            N === this.activeVehicle ||
              !N.root.visible ||
              distanceToSegment(positionOf(N.root), v.point, C.point) > 5.5 ||
              (N.policeRole === 'roadblock'
                ? (M += I * 7)
                : N.damageState === 'disabled'
                  ? (M += I * 4)
                  : (M += I * 0.12));
        let F = (u.get(g) ?? 1 / 0) + I + M;
        F >= (u.get(C.id) ?? 1 / 0) ||
          (f.set(C.id, g), u.set(C.id, F), h.set(C.id, F + flatDistance(C.point, o.node.point)), c.add(C.id));
      }
    }
    let m = [],
      _ = o.node.id;
    for (m.unshift(d.get(_) ?? o.node); _ !== a.node.id && f.has(_); ) ((_ = f.get(_)), m.unshift(d.get(_) ?? a.node));
    m[0]?.id !== a.node.id && m.unshift(a.node);
    let p = [
      { x: e.x, z: e.z },
      a.approach,
      ...m.map((g) => ({ x: g.point.x, z: g.point.z })),
      o.approach,
      { x: t.x, z: t.z },
    ];
    return p.filter((g, v) => v === 0 || Math.hypot(g.x - p[v - 1].x, g.z - p[v - 1].z) > 0.1);
  }
  clearRoute() {
    ((this.route = []), setVisible(this.routeMarkers, false));
  }
  /** The mint route: up to 90 arrow tiles every 5 m along the road path. */
  refreshRouteMarkers() {
    if (!this.routeMarkers) {
      this.routeMarkers = new THREE.InstancedMesh(shapes.box(1.4, 0.08, 1.4), this.routeMaterial, 90);
      this.routeMarkers.name = 'navigation route markers';
      this.routeMarkers.frustumCulled = false;
      this.routeMarkers.count = 0;
      this.world.add(this.routeMarkers);
      this.routeMatrix = new THREE.Matrix4();
      this.routeQuat = new THREE.Quaternion();
      this.routePos = new Vector3();
      this.routeScale = new Vector3(1, 1, 1);
    }
    let t = 0;
    for (let r = 0; r < this.route.length - 1; r += 1) {
      let s = this.route[r],
        n = this.route[r + 1],
        a = n.x - s.x,
        o = n.z - s.z,
        l = Math.sqrt(a * a + o * o),
        c = Math.floor(l / 5);
      for (let f = 1; f <= c; f += 1) {
        let u = f / Math.max(1, c);
        this.routeQuat.setFromAxisAngle(UP, Math.atan2(a, o));
        this.routePos.set(s.x + a * u, 0.34, s.z + o * u);
        this.routeMarkers.setMatrixAt(t, this.routeMatrix.compose(this.routePos, this.routeQuat, this.routeScale));
        if (((t += 1), t >= 90)) break;
      }
      if (t >= 90) break;
    }
    this.routeMarkers.count = t;
    this.routeMarkers.instanceMatrix.needsUpdate = true;
    this.routeMarkers.visible = t > 0;
  }
  resolveCameraCollision(e, t) {
    let s = e.clone();
    for (let n = 1; n <= 24; n += 1) {
      let a = e.clone().lerp(t, n / 24);
      if (
        this.colliders.some(
          (l) =>
            a.x > l.minX - 0.45 &&
            a.x < l.maxX + 0.45 &&
            a.z > l.minZ - 0.45 &&
            a.z < l.maxZ + 0.45 &&
            a.y < (l.maxY ?? 20),
        )
      )
        return s;
      s = a;
    }
    return t;
  }
  updatePerspectiveCamera(e, t) {
    let s = (this.activeVehicle?.root ?? this.player).rotation.y;
    if (
      (this.activeVehicle && (this.perspectiveYaw += angleDelta(this.lastPerspectiveActorYaw, s)),
      (this.lastPerspectiveActorYaw = s),
      (this.cameraMode === 'third-person' || this.activeVehicle) &&
        this.elapsed - this.lastCameraInputAt > 1.2 &&
        ((this.perspectiveYaw += angleDelta(this.perspectiveYaw, s) * Math.min(1, e * 2.8)),
        (this.perspectivePitch = lerp(
          this.perspectivePitch,
          this.cameraMode === 'first-person' ? 0.04 : 0.16,
          Math.min(1, e * 2.2),
        ))),
      this.cameraMode === 'first-person')
    ) {
      let d = new Vector3(Math.sin(s), 0, Math.cos(s)),
        m = t
          .clone()
          .add(
            this.activeVehicle
              ? new Vector3(0, 1.72, 0).add(d.multiplyScalar(0.38))
              : new Vector3(0, this.playerSwimming ? 0.95 : this.playerCrouched ? 1.55 : 2.25, 0),
          ),
        _ = Math.cos(this.perspectivePitch),
        p = new Vector3(
          Math.sin(this.perspectiveYaw) * _,
          Math.sin(this.perspectivePitch),
          Math.cos(this.perspectiveYaw) * _,
        );
      (this.cameraSnapPending || this.settings.reducedMotion
        ? (this.perspectivePosition.copy(m), (this.cameraSnapPending = false))
        : this.perspectivePosition.lerp(m, 1 - Math.exp(-e * 18)),
        this.perspectiveLook.copy(this.perspectivePosition).add(p.multiplyScalar(25)));
      this.placePerspectiveCamera();
      return;
    }
    let n = this.activeVehicle
        ? new Vector3(Math.sin(s), 0, Math.cos(s)).multiplyScalar(
            clamp(Math.abs(this.activeVehicle.speed) * 0.14, 0, 3.5),
          )
        : new Vector3(),
      a = t
        .clone()
        .add(
          new Vector3(0, this.activeVehicle ? 1.35 : this.playerSwimming ? 0.85 : this.playerCrouched ? 1.2 : 1.65, 0),
        )
        .add(n),
      o = this.activeInterior ? Math.min(this.perspectiveDistance, 6.5) : this.perspectiveDistance,
      l = Math.cos(this.perspectivePitch) * o,
      c = new Vector3(
        -Math.sin(this.perspectiveYaw) * l,
        clamp((this.activeVehicle ? 4.2 : 3.5) + Math.sin(this.perspectivePitch) * o, 1.8, 9.5),
        -Math.cos(this.perspectiveYaw) * l,
      ),
      f = a.clone().add(c),
      u = this.resolveCameraCollision(a, f),
      h = f.distanceToSquared(u) > 0.0025;
    (this.cameraSnapPending || h || this.settings.reducedMotion
      ? (this.perspectivePosition.copy(u), (this.cameraSnapPending = false))
      : this.perspectivePosition.lerp(u, 1 - Math.exp(-e * 9)),
      this.perspectiveLook.copy(a));
    this.placePerspectiveCamera();
  }
  /** Put the three.js perspective camera where the game's camera is. */
  placePerspectiveCamera() {
    const cam = this.perspectiveCamera;
    toWorld(this.perspectivePosition, cam.position);
    cam.lookAt(toWorld(this.perspectiveLook, (this.tmpLook ??= new Vector3())));
    if (this.appliedFov !== this.perspectiveFov) {
      this.appliedFov = this.perspectiveFov;
      cam.fov = THREE.MathUtils.radToDeg(this.perspectiveFov);
      cam.updateProjectionMatrix();
    }
  }
  renderUpdate(e) {
    let t = this.getPlayerPosition();
    if (this.cameraMode === 'isometric') {
      // Look ahead of a moving vehicle (no allocations: this runs every frame).
      const u = this.scratchA.copy(t);
      if (this.activeVehicle) {
        const lead = clamp(Math.abs(this.activeVehicle.speed) * 0.35, 0, 8);
        u.x += Math.sin(this.activeVehicle.root.rotation.y) * lead;
        u.z += Math.cos(this.activeVehicle.root.rotation.y) * lead;
      }
      this.settings.reducedMotion || this.cameraSnapPending
        ? this.cameraTarget.copy(u)
        : this.cameraTarget.lerp(u, 1 - Math.exp(-e * 5.5));
      // Snap the target to whole screen pixels so the orthographic view never shimmers.
      let h = Math.max(1, this.kit.size.height * this.kit.renderer.getPixelRatio()),
        d = (this.cameraViewHeight + this.zoomOffset) / h;
      this.isoTarget.set(Math.round(this.cameraTarget.x / d) * d, 0.9, Math.round(this.cameraTarget.z / d) * d);
      const cam = this.isoCamera;
      toWorld(this.scratchB.copy(this.isoTarget).add(this.isoOffset), cam.position);
      cam.lookAt(toWorld(this.isoTarget, (this.tmpLook ??= new Vector3())));
      this.updateOrthoBounds();
      this.cameraSnapPending = false;
    } else this.updatePerspectiveCamera(e, t);

    // Sun, sky and fog follow the clock and the weather.
    let r = ((this.timeOfDay - 6) / 24) * Math.PI * 2,
      s = clamp(Math.sin(r), -0.12, 1),
      n = clamp(s * 1.45 + 0.3, 0.18, 1);
    this.sunDirection.set(-0.5, -Math.max(0.25, s), 0.36).normalize();
    const focus = this.cameraMode === 'isometric' ? this.isoTarget : t;
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDirection, -160);
    this.sun.intensity = lerp(0.85, 3.15, n) * (this.weather === 'cloudy' ? 0.72 : 1);
    this.fill.intensity = lerp(0.42, 0.76, n) * Math.PI;
    const c = this.weather === 'fog' ? SKY_FOG : this.skyBlend.lerpColors(SKY_NIGHT, SKY_DAY, n);
    this.sky.value.copy(c);
    this.fog.setColor(c);
    this.fog.start.value = this.weather === 'fog' ? 55 : this.weather === 'rain' ? 82 : 112;
    this.fog.end.value = this.weather === 'fog' ? 132 : this.weather === 'rain' ? 165 : 205;
    this.windowMaterial.emissive.setHex(0xffd878, THREE.LinearSRGBColorSpace).multiplyScalar(lerp(0.06, 0.72, 1 - n));
    this.roadMaterial.roughness = this.weather === 'rain' ? 0.46 : 0.91;
    this.rain && this.rain.emitter.set(t.x, t.y + 24, t.z);
    if (this.objectiveRing?.visible) {
      let f = this.settings.reducedMotion ? 1 : 1 + Math.sin(this.elapsed * 3.2) * 0.08;
      (this.objectiveRing.scale.setScalar(f), (this.objectiveRing.rotation.y += e * 0.65));
    }
    this.updateMissionObjectVisuals();
    for (let f of this.missionObjects.values())
      if (f.mesh.visible) {
        if (this.carriedMissionItem !== f.definition.id) {
          let u = f.definition.style === 'tag' ? 0.54 : 0.78;
          f.mesh.position.y = this.settings.reducedMotion ? u : u + Math.sin(this.elapsed * 2.8 + f.mesh.id) * 0.12;
        }
        f.mesh.rotation.y += e * 0.45;
      }
    if (this.eventRing?.visible) {
      let f = this.settings.reducedMotion ? 1 : 1 + Math.sin(this.elapsed * 4) * 0.12;
      (this.eventRing.scale.setScalar(f), (this.eventRing.rotation.y -= e * 0.8));
    }
    if (this.activityRing?.visible) {
      let f = this.settings.reducedMotion ? 1 : 1 + Math.sin(this.elapsed * 5.2) * 0.09;
      (this.activityRing.scale.setScalar(f), (this.activityRing.rotation.y += e * 1.15));
    }
    if (this.attackFx > 0) {
      this.attackFx -= e;
      let f = 1 - this.attackFx / 0.48;
      (this.attackRing.scale.setScalar(0.5 + f * 3.2),
        (this.attackRing.material.opacity = 0.85 * (1 - f)),
        this.attackFx <= 0 && ((this.attackRing.visible = false), (this.attackRing.material.opacity = 0.85)));
    }
    if (
      (this.waypoint &&
        !this.activeActivity &&
        flatDistance(t, new Vector3(this.waypoint.x, 0, this.waypoint.z)) < 5 &&
        ((this.waypoint = null),
        this.pushToast('Waypoint reached', 'Navigation returned to your current objective.', 'good', 3),
        this.updateObjectiveMarker()),
      this.route.length && (this.waypoint || this.currentObjective() || this.activeActivity))
    ) {
      let f = this.route[this.route.length - 1];
      if (flatDistance(t, new Vector3(f.x, 0, f.z)) > 10) {
        let u = this.route[0];
        Math.abs(u.x - t.x) + Math.abs(u.z - t.z) > 14 && this.buildRouteTo(f.x, f.z);
      }
    }
    this.updateAudio();
  }
  formatTime() {
    let e = Math.floor(this.timeOfDay),
      t = Math.floor((this.timeOfDay - e) * 60);
    return `${e % 12 || 12}:${t.toString().padStart(2, '0')} ${e >= 12 ? 'PM' : 'AM'}`;
  }
  minimapEntities() {
    let e = this.getPlayerPosition(),
      t = [
        { id: 'player', x: e.x, z: e.z, kind: 'player' },
        ...BUSINESSES.map((s) => ({ id: s.id, x: s.x, z: s.z, kind: 'business' })),
        ...ACTIVITIES.map((s) => ({ id: s.id, x: s.x, z: s.z, kind: 'activity' })),
        ...MISSIONS.filter(
          (s) => s.id !== this.missionId && !this.completedMissions.has(s.id) && this.missionIsAvailable(s),
        ).flatMap((s) => {
          let n = s.objectives[0];
          return n?.x !== undefined && n.z !== undefined
            ? [{ id: `mission-${s.id}`, x: n.x, z: n.z, kind: 'mission' }]
            : [];
        }),
        ...this.vehicles
          .filter((s) => s.driver === 'police' && s.root.visible)
          .map((s) => ({
            id: s.id,
            x: s.root.position.x,
            z: s.root.position.z,
            kind: 'police',
          })),
      ],
      r = this.currentObjective();
    if (r?.kind === 'multiReach' || r?.kind === 'searchArea')
      for (let s of r.points ?? [])
        this.objectiveSubgoals.has(s.id) ||
          t.push({
            id: `objective-${s.id}`,
            x: s.x,
            z: s.z,
            kind: 'objective',
          });
    else if (r) {
      let s = this.missionObjectiveTargetPosition(r);
      s && t.push({ id: 'objective', x: s.x, z: s.z, kind: 'objective' });
    }
    return (
      this.activeEvent &&
        t.push({
          id: this.activeEvent.id,
          x: this.activeEvent.x,
          z: this.activeEvent.z,
          kind: 'event',
        }),
      t
    );
  }
  emitHud(e = false) {
    if (!e && this.disposed) return;
    this.updateTouchControls();
    let t = this.getPlayerPosition(),
      r = this.districtAt(t.x, t.z);
    r.id !== this.lastDistrict &&
      ((this.lastDistrict = r.id),
      this.discoveredDistricts.has(r.id) ||
        (this.discoveredDistricts.add(r.id),
        this.elapsed > 2 && ((this.reputation += 2), this.pushToast(r.name, r.subtitle, 'neutral', 4)),
        this.discoveredDistricts.size === DISTRICTS.length &&
          !this.ownedProperties.has('hush-house-loft') &&
          this.pushToast(
            'Property available \xB7 Hush House Loft',
            'Exploring every district unlocked the Hush House property desk.',
            'good',
            7,
          )));
    let s = this.activeMission(),
      n = this.currentObjective(),
      a =
        n?.kind === 'collect'
          ? `${n.label} \xB7 ${Math.min(this.collected.size, n.count ?? 1)}/${n.count ?? 1}`
          : n?.kind === 'multiReach'
            ? `${n.label} \xB7 ${this.objectiveSubgoals.size}/${n.requiredCount ?? n.points?.length ?? 1}`
            : n?.kind === 'searchArea'
              ? `${n.label} \xB7 ${this.objectiveSubgoals.size}/${n.requiredCount ?? n.points?.length ?? 1}`
              : n?.kind === 'transportNpc'
                ? `${n.label} \xB7 ${this.objectiveSubgoals.size}/${n.points?.length ?? 1} stops`
                : n?.kind === 'defend'
                  ? `${n.label} \xB7 ${Math.floor(this.objectiveHoldTime)}/${n.duration ?? 20}s`
                  : n?.kind === 'survive'
                    ? `${n.label} \xB7 ${Math.floor(this.objectiveHoldTime)}/${n.duration ?? 10}s`
                    : n?.label,
      o = n?.timeLimit
        ? Math.max(0, Math.ceil(n.timeLimit - (this.elapsed - this.objectiveEnteredAt)))
        : n?.kind === 'survive' || n?.kind === 'defend'
          ? Math.max(0, Math.ceil((n.duration ?? 10) - this.objectiveHoldTime))
          : 0,
      l = this.storeHeading(),
      c = (s?.optionalObjectives ?? [])
        .map((h) => {
          let d = this.missionOptionalStates.get(h.id) ?? 'active';
          if (h.kind === 'inspectAll') {
            let m = h.targetIds?.filter((_) => this.missionOptionalProgress.has(_)).length ?? 0;
            return `${h.label.replace(/^Optional · /, '')} \xB7 ${m}/${h.targetIds?.length ?? 0} \xB7 ${d}`;
          }
          if (h.kind === 'vehicleCare' && h.requiredVehicleId) {
            let m = this.vehicles.find((p) => p.id === h.requiredVehicleId),
              _ = m ? Math.round((m.health / Math.max(1, m.definition.durability)) * 100) : 0;
            return `${h.label.replace(/^Optional · /, '')} \xB7 ${_}% condition \xB7 ${d}`;
          }
          return `${h.label.replace(/^Optional · /, '')} \xB7 ${d}`;
        })
        .join('  \u2022  '),
      f = MISSIONS.filter((h) => !this.completedMissions.has(h.id) && this.missionIsAvailable(h)).length,
      u = {
        ready: true,
        renderer: this.renderer,
        inputSource: this.inputSource,
        cameraMode: this.cameraMode,
        money: Math.floor(this.money),
        health: Math.max(0, Math.floor(this.health)),
        armor: Math.max(0, Math.floor(this.armor)),
        wanted: this.wanted,
        heat: this.heat,
        district: this.activeInterior?.business.name ?? r.name,
        districtSubtitle: this.activeInterior ? 'ENTERABLE INTERIOR \xB7 CITY SYSTEMS ACTIVE' : r.subtitle,
        objective:
          a ?? (f > 0 ? `${f} mission${f === 1 ? '' : 's'} available` : 'Explore Brightline on your own terms'),
        objectiveDetail:
          s?.summary ??
          (f > 0
            ? 'Open the mission journal with J when you want another chapter.'
            : 'Businesses, activities and city events remain active.'),
        objectiveTime: o,
        interaction: this.interaction?.label ?? '',
        interactionButton: this.interactionButtonLabel().toUpperCase(),
        // Only right after a hit, so a HUD shown again after a menu does not replay it.
        hurt: this.uiElapsed - this.hurtAt < 0.6 ? this.hurtCounter : 0,
        speed: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 3.6) : 0,
        vehicleName: this.activeVehicle?.definition.name ?? '',
        vehicleHealth: this.activeVehicle
          ? Math.round((this.activeVehicle.health / Math.max(1, this.activeVehicle.definition.durability)) * 100)
          : 0,
        vehicleCondition: this.activeVehicle?.damageState ?? '',
        movementLabel: this.activeVehicle
          ? 'DRIVING'
          : this.playerSwimming
            ? 'SWIMMING'
            : this.playerGrounded
              ? this.playerCrouched
                ? 'CROUCHING'
                : this.input.down('sprint') && this.playerVelocity.lengthSq() > 1
                  ? 'SPRINTING'
                  : 'ON FOOT'
              : 'AIRBORNE',
        timeLabel: this.formatTime(),
        weather: this.weather,
        reputation: this.reputation,
        collectibles: this.collected.size,
        collectibleTotal: this.collectibles.length,
        missionTitle: s?.title ?? (f > 0 ? 'Mission Journal' : 'Free Roam'),
        missionOptional: c,
        factions: FACTIONS.map((h) => ({
          id: h.id,
          name: h.name,
          color: h.color,
          standing: this.factionStanding[h.id],
          tier: this.factionTier(this.factionStanding[h.id]),
        })),
        activityTitle: this.activeActivity?.definition.title ?? '',
        activityProgress: this.activeActivity ? this.activityProgressLabel(this.activeActivity) : '',
        activityTime: this.activeActivity ? Math.max(0, Math.ceil(this.activeActivity.remaining)) : 0,
        eventTitle: this.activeEvent?.definition.title ?? '',
        eventObjective: this.currentWorldEventStage()?.label ?? '',
        eventProgress: this.worldEventProgressLabel(),
        eventTime: this.activeEvent ? Math.max(0, Math.ceil(this.activeEvent.remaining)) : 0,
        isDriving: !!this.activeVehicle,
        titleOpen: this.overlay === 'title',
        paused: this.overlay === 'pause',
        mapOpen: this.overlay === 'map',
        helpOpen: this.overlay === 'help',
        settingsOpen: this.overlay === 'settings',
        onboardingOpen: this.overlay === 'onboarding',
        newGameConfirmOpen: this.overlay === 'confirm',
        storeOpen: this.overlay === 'store',
        journalOpen: this.overlay === 'journal',
        storeTitle: l.title,
        storeSubtitle: l.subtitle,
        // The store and the journal are only built while they are open; the
        // HUD is rebuilt ten times a second.
        storeOffers: this.overlay === 'store' ? this.currentStoreOffers() : [],
        missionJournal: this.overlay === 'journal' ? this.missionJournalEntries() : [],
        result: this.result
          ? {
              id: this.result.id,
              kind: this.result.kind,
              kicker: this.result.kicker,
              title: this.result.title,
              total: this.result.total,
              lines: this.result.lines,
              time: this.result.time ? formatDuration(this.result.time) : '',
              best: this.result.best ? formatDuration(this.result.best) : '',
              record: !!this.result.record,
            }
          : null,
        record: this.overlay === 'pause' ? this.cityRecord() : null,
        settings: { ...this.settings },
        hasSave: this.hasSave,
        minimap: this.minimapEntities(),
        route: [...this.route],
        playerX: t.x,
        playerZ: t.z,
        toasts: this.toasts.map((h) => ({
          id: h.id,
          title: h.title,
          body: h.body,
          tone: h.tone,
        })),
      };
    this.onHud(u);
  }
  /** The results banner after a mission or an activity (it replaces the old completion toast). */
  showResult(result) {
    this.result = { ...result, id: ++this.resultCounter, expires: this.uiElapsed + 6 };
    this.emitHud(true);
  }
  /** Progress at a glance for the pause menu. */
  cityRecord() {
    let cleared = 0;
    for (const r of this.activityRecords.values()) r?.completions > 0 && (cleared += 1);
    return {
      missions: `${MISSIONS.filter((m) => this.completedMissions.has(m.id)).length}/${MISSIONS.length}`,
      sparks: `${this.collected.size}/${this.collectibles.length}`,
      districts: `${this.discoveredDistricts.size}/${DISTRICTS.length}`,
      activities: `${cleared}/${ACTIVITIES.length}`,
      vehicles: String(this.ownedVehicles.size),
    };
  }
  pushToast(e, t, r = 'neutral', s = 4) {
    for (
      this.toasts = this.toasts.filter((n) => n.title !== e || n.body !== t),
        this.toasts.push({
          id: ++this.toastCounter,
          title: e,
          body: t,
          tone: r,
          expires: this.uiElapsed + s,
        });
      this.toasts.length > 3;
    )
      this.toasts.shift();
  }
  save(e = true) {
    if (typeof window > 'u') return;
    if (e && (this.wanted > 0 || this.currentObjective()?.kind === 'escape')) {
      e &&
        (this.pushToast(
          'Save paused during pursuit',
          'Break observation and finish the escape checkpoint before saving.',
          'danger',
          4.5,
        ),
        this.emitHud(true));
      return;
    }
    let t = this.getPlayerPosition(),
      r = this.activeMission()?.assets?.find((a) => a.kind === 'vehicle'),
      s = r ? this.vehicles.find((a) => a.id === r.id) : undefined,
      n = {
        version: 2,
        player: {
          x: t.x,
          y: 0.35,
          z: t.z,
          health: this.health,
          armor: this.armor,
        },
        money: this.money,
        reputation: this.reputation,
        timeOfDay: this.timeOfDay,
        weather: this.weather,
        completedMissions: [...this.completedMissions],
        collected: [...this.collected],
        ownedVehicles: [...this.ownedVehicles],
        ownedVehicleStates: this.vehicles
          .filter((a) => a.owned && this.ownedVehicles.has(a.id))
          .map((a) => ({
            id: a.id,
            x: a.root.position.x,
            z: a.root.position.z,
            yaw: a.root.rotation.y,
            health: a.health,
          })),
        ownedBusinesses: [...this.ownedBusinesses],
        ownedProperties: [...this.ownedProperties],
        businessLevels: Object.fromEntries(this.businessLevels),
        propertyLevels: Object.fromEntries(this.propertyLevels),
        activityRecords: Object.fromEntries(this.activityRecords),
        factionStanding: { ...this.factionStanding },
        cameraMode: this.cameraMode,
        outfitIndex: this.outfitIndex,
        discoveredDistricts: [...this.discoveredDistricts],
        missionId: this.missionId,
        objectiveIndex: this.objectiveIndex,
        objectiveProgress: [...this.objectiveSubgoals],
        objectiveElapsed: Math.max(0, this.elapsed - this.objectiveEnteredAt),
        missionElapsed: this.missionId ? Math.max(0, this.elapsed - this.missionStartedAt) : 0,
        objectiveHoldTime: this.objectiveHoldTime,
        carriedMissionItem: this.carriedMissionItem,
        missionOptionalProgress: [...this.missionOptionalProgress],
        missionOptionalStates: Object.fromEntries(this.missionOptionalStates),
        missionPassengerId: this.missionPassengerId,
        missionVehicleState: s
          ? {
              id: s.id,
              x: s.root.position.x,
              z: s.root.position.z,
              yaw: s.root.rotation.y,
              health: s.health,
            }
          : null,
        lawState: {
          wanted: this.wanted,
          heat: this.heat,
          crimePressure: this.crimePressure,
          unseenTime: this.unseenTime,
          lastKnownX: this.lastKnownPosition.x,
          lastKnownZ: this.lastKnownPosition.z,
        },
        missionRecords: Object.fromEntries(this.missionRecords),
        lastSavedAt: Date.now(),
      };
    try {
      (writeSave(localStorage, n),
        (this.hasSave = true),
        e &&
          (this.pushToast('Progress saved', 'Your city story is safe on this device.', 'good', 3.5),
          this.emitHud(true)));
    } catch (a) {
      (console.warn('Progress could not be saved on this device.', a),
        (e || this.uiElapsed - this.lastSaveErrorAt > 30) &&
          ((this.lastSaveErrorAt = this.uiElapsed),
          this.pushToast(
            e ? 'Save unavailable' : 'Autosave unavailable',
            'Browser storage is blocked or full. Recent progress may not persist after closing the game.',
            'danger',
            7,
          )),
        this.emitHud(true));
    }
  }
  restore() {
    if (!(typeof window > 'u'))
      try {
        let e = readSave(localStorage);
        if (!e.data) {
          e.invalid &&
            this.pushToast(
              'Save recovery unavailable',
              'Unreadable progress was ignored so the city could start safely.',
              'danger',
              6,
            );
          return;
        }
        let t = e.data;
        if (
          ((this.hasSave = true),
          this.player.position.set(t.player.x, 0.35, t.player.z),
          (this.health = t.player.health),
          (this.armor = t.player.armor),
          (this.money = t.money),
          (this.reputation = t.reputation),
          (this.timeOfDay = t.timeOfDay),
          (this.weather = t.weather),
          (this.wanted = t.lawState?.wanted ?? 0),
          (this.heat = t.lawState?.heat ?? 0),
          (this.crimePressure = t.lawState?.crimePressure ?? 0),
          (this.unseenTime = t.lawState?.unseenTime ?? 0),
          this.lastKnownPosition.set(t.lawState?.lastKnownX ?? t.player.x, 0, t.lawState?.lastKnownZ ?? t.player.z),
          (this.outfitIndex = clamp(Math.floor(Number(t.outfitIndex ?? 0)), 0, OUTFITS.length - 1)),
          this.applyOutfit(),
          (this.completedMissions = new Set(t.completedMissions)),
          (this.collected = new Set(t.collected)),
          (this.ownedVehicles = new Set(t.ownedVehicles)),
          (this.ownedBusinesses = new Set(t.ownedBusinesses ?? [])),
          (this.ownedProperties = new Set(t.ownedProperties ?? [])),
          (this.businessLevels = new Map(Object.entries(t.businessLevels ?? {}))),
          (this.propertyLevels = new Map(Object.entries(t.propertyLevels ?? {}))),
          (this.activityRecords = new Map(Object.entries(t.activityRecords ?? {}))),
          (this.missionRecords = new Map(Object.entries(t.missionRecords ?? {}))),
          (this.carriedMissionItem = t.carriedMissionItem ?? null),
          (this.missionOptionalProgress = new Set(t.missionOptionalProgress ?? [])),
          (this.missionOptionalStates = new Map(Object.entries(t.missionOptionalStates ?? {}))),
          (this.missionPassengerId = t.missionPassengerId ?? null),
          (this.discoveredDistricts = new Set(t.discoveredDistricts)),
          (this.factionStanding = {
            civic: 0,
            couriers: 0,
            makers: 0,
            neighborhoods: 0,
          }),
          t.factionStanding)
        )
          for (let f of FACTIONS) this.factionStanding[f.id] = clamp(Number(t.factionStanding[f.id] ?? 0), -50, 50);
        else
          for (let f of MISSIONS)
            this.completedMissions.has(f.id) &&
              f.faction &&
              f.factionReward &&
              (this.factionStanding[f.faction] = clamp(this.factionStanding[f.faction] + f.factionReward, -50, 50));
        let r = MISSIONS.find((f) => f.id === t.missionId && this.missionIsAvailable(f));
        ((this.missionId = r?.id ?? null),
          (this.missionStartedAt = this.elapsed - (r ? Number(t.missionElapsed ?? 0) : 0)),
          (this.objectiveIndex =
            r && t.objectiveIndex >= 0 && t.objectiveIndex < r.objectives.length ? t.objectiveIndex : 0));
        let s = this.currentObjective()?.kind === 'escape';
        s && (this.objectiveIndex = Math.max(0, this.objectiveIndex - 1));
        let n = this.currentObjective();
        if (r) {
          this.prepareMissionAssets(r, true);
          let f = t.missionVehicleState,
            u = f ? this.missionAsset(r, f.id) : undefined,
            h = f ? this.vehicles.find((d) => d.id === f.id) : undefined;
          if (f && h && u?.kind === 'vehicle') {
            let d = new Vector3(f.x, 0.62, f.z);
            (this.canOccupy(d, h.collisionRadius) && h.root.position.copy(d),
              (h.root.rotation.y = f.yaw),
              (h.health = clamp(f.health, 0, h.definition.durability)),
              (h.damageState =
                h.health <= 0
                  ? 'disabled'
                  : h.health < h.definition.durability * 0.35
                    ? 'critical'
                    : h.health < h.definition.durability * 0.7
                      ? 'damaged'
                      : 'healthy'));
          }
          if (this.missionPassengerId && n?.kind === 'transportNpc') {
            let d = this.pedestrians.find((m) => m.id === this.missionPassengerId);
            d && ((d.missionRole = 'passenger'), setVisible(d.root, false));
          } else this.missionPassengerId = null;
        }
        let a = new Set(n?.points?.map((f) => f.id) ?? []);
        this.objectiveSubgoals = new Set((r ? (t.objectiveProgress ?? []) : []).filter((f) => a.has(f)));
        let o = Math.max(0, Number(r && !s && !n?.failOnWanted ? (t.objectiveElapsed ?? 0) : 0));
        ((this.objectiveEnteredAt = this.elapsed - Math.min(o, n?.timeLimit ?? o)),
          (this.objectiveHoldTime = clamp(
            Number(r && n?.kind !== 'defend' ? (t.objectiveHoldTime ?? 0) : 0),
            0,
            n?.duration ?? 0,
          )),
          (this.escapeArmed = false),
          r && s && this.prepareMissionAssets(r));
        for (let f of this.collectibles) ((f.collected = this.collected.has(f.id)), setVisible(f.mesh, !f.collected));
        this.weather === 'rain' && this.rain?.start();
        for (let f of this.ownedVehicles) {
          if (this.vehicles.some((S) => S.id === f)) continue;
          let u = VEHICLE_TYPES.find((S) => `owned-${S.id}` === f);
          if (!u) continue;
          let h = t.ownedVehicleStates?.find((S) => S.id === f),
            d = VEHICLE_TYPES.filter((S) => S.price > 0).findIndex((S) => S.id === u.id),
            m = DELIVERY_PADS[Math.max(0, d) % DELIVERY_PADS.length],
            _ = new Vector3(m[0], 0.62, m[1]),
            p = h ? new Vector3(h.x, 0.62, h.z) : _,
            g = this.canOccupy(p, 1.35) ? p : _,
            v = this.spawnVehicle(f, u, g, h?.yaw ?? Math.PI / 2, null, [], true);
          ((v.health = clamp(h?.health ?? v.definition.durability, 0, v.definition.durability)),
            (v.damageState =
              v.health <= 0
                ? 'disabled'
                : v.health < v.definition.durability * 0.35
                  ? 'critical'
                  : v.health < v.definition.durability * 0.7
                    ? 'damaged'
                    : 'healthy'));
        }
        let l = this.vehicles.find(
          (f) => f.root.visible && flatDistance(f.root.position, this.player.position) < f.collisionRadius + 0.7,
        );
        if (l) {
          let f = this.safeVehicleExitPosition(l);
          this.player.position.set(f.x, 0.35, f.z);
        }
        this.wanted > 0 && this.ensurePoliceResponse();
        let c = t.cameraMode === 'third-person' || t.cameraMode === 'first-person' ? t.cameraMode : 'isometric';
        (this.setCameraMode(c, false),
          this.cameraTarget.copy(this.player.position),
          (this.lastIncomeSegment = Math.floor(this.timeOfDay / 8)),
          this.pushToast(
            e.recovered ? 'Backup save recovered' : e.migrated ? 'Save upgraded' : 'Welcome back',
            e.recovered
              ? 'The primary save was unreadable, so the last-known-good city was restored.'
              : e.migrated
                ? 'Your previous city was safely migrated to the current save format.'
                : 'Your saved city state has been restored.',
            e.recovered ? 'neutral' : 'good',
            5,
          ),
          (e.recovered || e.migrated) && this.save(false));
      } catch (e) {
        (console.warn('Save data could not be restored.', e),
          this.pushToast(
            'Save could not be opened',
            'Stored progress was left untouched. You can start safely or retry after enabling browser storage.',
            'danger',
            7,
          ));
      }
  }
  reset() {
    try {
      clearSave(localStorage);
    } catch (s) {
      (console.warn('Saved progress could not be removed.', s),
        this.pushToast(
          'New game cancelled',
          'Browser storage could not be cleared, so your current city was kept intact.',
          'danger',
          6,
        ),
        this.emitHud(true));
      return;
    }
    ((this.hasSave = false),
      this.activeActivity && this.cleanupActivity(this.activeActivity, false),
      (this.activeActivity = null),
      this.activeVehicle && this.exitVehicle(true),
      this.activeEvent && this.finishWorldEvent('failed', false));
    let e = this.activeMission();
    (e && this.releaseMissionAssets(e),
      this.gameplayReservations.clear(),
      this.eventCooldowns.clear(),
      (this.worldEventCounter = 0),
      setVisible(this.eventRing, false),
      setVisible(this.eventBeam, false),
      (this.eventTimer = 18),
      setVisible(this.activityRing, false),
      setVisible(this.activityBeam, false),
      (this.waypoint = null),
      this.clearRoute());
    let t = this.vehicles.filter((s) => s.owned && s.id.startsWith('owned-'));
    for (let s of t) this.disposeVehicle(s);
    this.vehicles = this.vehicles.filter((s) => !s.owned || !s.id.startsWith('owned-'));
    for (let s of this.vehicles)
      ((s.stolen = false),
        (s.health = s.definition.durability),
        (s.damageState = 'healthy'),
        (s.braking = false),
        (s.disabledTimer = 0),
        (s.policeRole = undefined),
        (s.policeTarget = undefined),
        (s.roadblockYaw = undefined),
        s.id.startsWith('response-')
          ? ((s.driver = null), (s.speed = 0), setVisible(s.root, false))
          : s.route.length && ((s.driver = 'traffic'), (s.speed = 5), setVisible(s.root, true)));
    let r = MISSIONS.find((s) => s.id === 'clean-getaway');
    if (r) for (let s of r.objectives) this.restoreBoundVehicle(s);
    for (let s of this.pedestrians)
      ((s.callerForIncident = null),
        (s.lastGreeted = -100),
        (s.activityRole = undefined),
        (s.sheltering = false),
        (s.routineSlot = -1),
        (s.health = 100),
        (s.lastSeenAt = -100),
        (s.timer = s.special ? 1 : 0),
        (s.state = s.special ? 'idle' : 'walk'),
        s.special || (s.target = this.randomSidewalkTarget(s.phase * 701 + 19)),
        (delete s.root.userData.crimeSeverity, delete s.root.userData.crimeLabel));
    (this.player.position.set(-49, 0.35, -44),
      this.player.rotation.set(0, 0, 0),
      this.playerVelocity.setScalar(0),
      (this.playerYVelocity = 0),
      (this.playerGrounded = true),
      (this.playerCrouched = false),
      (this.playerSwimming = false),
      this.player.scale.setScalar(1),
      this.cameraTarget.copy(this.player.position),
      (this.health = 100),
      (this.armor = 0),
      (this.money = 475),
      (this.reputation = 0),
      (this.outfitIndex = 0),
      this.applyOutfit(),
      (this.factionStanding = {
        civic: 0,
        couriers: 0,
        makers: 0,
        neighborhoods: 0,
      }),
      (this.wanted = 0),
      (this.crimePressure = 0),
      (this.heat = 0),
      (this.unseenTime = 0),
      this.lastKnownPosition.setScalar(0),
      (this.incidentCounter = 0),
      this.reportedIncidents.clear(),
      (this.timeOfDay = 9.25),
      (this.weather = 'clear'),
      (this.weatherTimer = 64),
      this.rain?.stop(),
      this.vehicleSmoke?.stop(),
      (this.smokingVehicleId = null),
      this.completedMissions.clear(),
      this.collected.clear(),
      this.ownedVehicles.clear(),
      this.ownedBusinesses.clear(),
      this.ownedProperties.clear(),
      this.businessLevels.clear(),
      this.propertyLevels.clear(),
      this.activityRecords.clear(),
      this.discoveredDistricts.clear(),
      (this.missionId = null),
      (this.objectiveIndex = 0),
      (this.objectiveEnteredAt = 0),
      (this.missionStartedAt = 0),
      (this.result = null),
      this.objectiveSubgoals.clear(),
      (this.objectiveHoldTime = 0),
      (this.objectiveFailureToastAt = -100),
      (this.escapeArmed = false),
      (this.carriedMissionItem = null),
      this.missionOptionalProgress.clear(),
      this.missionOptionalStates.clear(),
      (this.missionPassengerId = null),
      this.missionRecords.clear(),
      (this.lastIncomeSegment = Math.floor(this.timeOfDay / 8)),
      (this.autosaveTimer = 0),
      (this.attackCooldown = 0),
      (this.damageCooldown = 0),
      (this.hostileToastCooldown = 0),
      this.pressed.clear(),
      (this.interaction = null),
      (this.toasts = []),
      (this.lastDistrict = ''),
      (this.activeInterior = null),
      this.updateInteriors(true),
      this.setCameraMode('isometric', false));
    for (let s of this.collectibles) ((s.collected = false), setVisible(s.mesh, true));
    for (let s of this.missionObjects.values()) (this.world.add(s.mesh), setVisible(s.mesh, false));
    (this.updateObjectiveMarker(),
      (this.overlay = 'none'),
      (this.overlayReturn = 'none'),
      (this.storeKind = null),
      this.pushToast('New city story', 'Everything is ready for a fresh start.', 'good', 4),
      this.emitHud(true));
  }
  /** Remove a vehicle for good (the owned vehicles a new game takes away). Its materials are shared. */
  disposeVehicle(vehicle) {
    vehicle.root.removeFromParent();
  }
  /** Stop the loop, the audio and the listeners. */
  shutdown() {
    this.disposed = true;
    this.pressed.clear();
    this.listenerCleanup.forEach((e) => e());
    this.listenerCleanup = [];
    this.kit.stop();
    try {
      (this.engineOscillator?.stop(),
        this.cityOscillator?.stop(),
        this.sirenOscillator?.stop(),
        this.weatherNoise?.stop());
    } catch {}
    this.audioContext?.close();
    this.post?.dispose();
  }
  disposeAfterInitializationFailure() {
    if (!this.disposed) this.shutdown();
  }
  dispose() {
    if (this.disposed) return;
    (this.activeEvent && this.finishWorldEvent('failed', false), this.save(false));
    let e = this.activeMission();
    e && this.releaseMissionAssets(e);
    for (let t of new Set([...this.gameplayReservations.values()].map((r) => r.scopeId))) this.releaseGameplayScope(t);
    this.shutdown();
  }
}
