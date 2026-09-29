/**
 * flight.js — the flight plane: the isometric system view, traffic AI, combat,
 * mining, boarding, scanning and the law response.
 *
 * This is the original Babylon.js GameController rebuilt on three.js r186
 * (WebGPURenderer through the shared kit). Game rules, numbers and text are
 * unchanged; only the engine layer is new.
 *
 * Coordinates: the original scene was authored in Babylon's left-handed space.
 * The world here keeps Babylon's x and flips z, so the camera sees the same
 * picture: babylon (x, y, z) → three (x, y, -z). `P()` converts the literal
 * positions from the original; everything else works on three-space vectors.
 *
 * Colours: Babylon's PBR used hex colours as linear values, which is where the
 * game's bright, pale-neon look comes from, so `lin()` does the same.
 */

import * as THREE from 'three/webgpu';
import { mrt, output, float, uniform, fog, positionView, renderOutput, vec3, vec4, mix } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from 'kit/post.js';
import {
  FACTIONS,
  COMMODITIES,
  WEAPONS,
  systemById,
  commodityById,
  shipById,
  systemOwner,
  systemSecurity,
  shipStats,
  activeWeapon,
  cargoMass,
  cargoCapacity,
  heatTier,
  reputationLabel,
  difficultyOf,
} from './data.js';

/** Height of the flight plane every ship moves on. */
const PLANE_Y = 0.5;
/** Camera: Babylon ArcRotateCamera(alpha -π/4, beta 0.98, radius 34), orthographic. */
const CAM_RADIUS = 34;
const CAM_BETA = 0.98;
/**
 * The orthographic camera stands this much farther back along its view line
 * than the original's radius. The picture is identical, but a tall portrait
 * view no longer puts the bottom of the screen behind the near plane (which
 * clipped the floor there). Fog is still measured from the original spot.
 */
const CAM_PULLBACK = 40;
const CAM_OFFSET = new THREE.Vector3(
  Math.SQRT1_2 * (CAM_RADIUS + CAM_PULLBACK) * Math.sin(CAM_BETA),
  (CAM_RADIUS + CAM_PULLBACK) * Math.cos(CAM_BETA),
  Math.SQRT1_2 * (CAM_RADIUS + CAM_PULLBACK) * Math.sin(CAM_BETA)
);
/** Key light direction (Babylon (-0.55, -1, 0.35), z flipped). */
const SUN_DIR = new THREE.Vector3(-0.55, -1, -0.35).normalize();
/** Babylon's PBR lights carry no 1/π; three.js lights do. */
const LIGHT_SCALE = Math.PI;

/** The Quiet Warden (the Signal in the Static finale) and its motes. */
const WARDEN = { hull: 1100, armor: 320, shield: 520, radius: 2.7, speed: 5.2, keep: 13 };
const WARDEN_BOLT = { shieldMultiplier: 1, armorMultiplier: 1, penetration: 0, tracking: 0 };
const WARDEN_LANCE = { shieldMultiplier: 1.2, armorMultiplier: 1, penetration: 0.1, tracking: 0.38 };
const ZERO = new THREE.Vector3();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Distance on the flight plane. */
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** Shortest signed angle from a to b. */
const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Babylon position literal → three space. */
const P = (x, y, z) => new THREE.Vector3(x, y, -z);
/** A hex colour read as linear values (Babylon's convention), optionally scaled. */
function lin(hex, s = 1) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16);
  return new THREE.Color().setRGB((((n >> 16) & 255) / 255) * s, (((n >> 8) & 255) / 255) * s, ((n & 255) / 255) * s, THREE.LinearSRGBColorSpace);
}
/** lin() for hot paths (sparks): one shared Color per hex, never mutated. */
const linCache = new Map();
function linShared(hex) {
  let c = linCache.get(hex);
  if (!c) {
    c = lin(hex);
    linCache.set(hex, c);
  }
  return c;
}
/** Deterministic generator seeded by a string (the original's scene seeding). */
function seeded(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ geometry */

/** Face normals, like Babylon's convertToFlatShadedMesh. */
function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}
/** Babylon CreateCylinder options → three CylinderGeometry (y axis). */
function cylinder({ height = 2, diameter = 1, diameterTop = diameter, diameterBottom = diameter, tessellation = 24 }) {
  return new THREE.CylinderGeometry(diameterTop / 2, diameterBottom / 2, height, tessellation);
}
/** Babylon CreateTorus: a ring lying in the XZ plane. */
function torus({ diameter = 1, thickness = 0.5, tessellation = 16 }) {
  return new THREE.TorusGeometry(diameter / 2, thickness / 2, Math.max(3, Math.min(12, tessellation)), tessellation).rotateX(Math.PI / 2);
}
/** Babylon CreateIcoSphere(subdivisions n) = three IcosahedronGeometry(detail n − 1). */
function icosphere(radius, subdivisions = 1) {
  return new THREE.IcosahedronGeometry(radius, Math.max(0, subdivisions - 1));
}
/** Babylon CreatePolyhedron type 0/1/2 with its vertex scale. */
function polyhedron(type, size) {
  if (type === 0) return new THREE.TetrahedronGeometry(1.732051 * size);
  if (type === 1) return new THREE.OctahedronGeometry(1.414214 * size);
  return new THREE.DodecahedronGeometry(1.070466 * size);
}
/** Babylon CreateDisc: XY plane, facing -z. */
function disc(radius, tessellation) {
  return new THREE.CircleGeometry(radius, tessellation).rotateY(Math.PI);
}
/** Per-vertex colour variation (the original's addVertexVariation). */
function vertexVariation(geo, color, amount) {
  const pos = geo.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const f = clamp(0.72 + ((y + x * 0.17) % 1) * amount, 0.55, 1.1);
    cols[i * 3] = color.r * f;
    cols[i * 3 + 1] = color.g * f;
    cols[i * 3 + 2] = color.b * f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
/** Prepare a part for merging: non-indexed, position + normal only. */
function part(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  return g;
}

const HEAVY = ['trader', 'miner', 'bomber', 'mule', 'prospector', 'bulwark', 'atlas', 'revenant', 'leviathan'];
const SLEEK = ['courier', 'smuggler', 'needle', 'wraith'];
const SPINED = ['bomber', 'bulwark', 'revenant', 'leviathan'];

/* ------------------------------------------------------------ pools */

/** A missile's fading ribbon (the original used a Babylon TrailMesh). */
class Trail {
  constructor(material, points = 12, width = 0.16) {
    this.count = points;
    this.width = width;
    // A fixed ring of points (recycled every frame, so a missile allocates nothing in flight).
    this.history = Array.from({ length: points }, () => new THREE.Vector3());
    this.filled = 0;
    this.positions = new Float32Array(points * 2 * 3);
    const index = [];
    for (let i = 0; i < points - 1; i += 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.attr);
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
  }
  update(head) {
    const h = this.history;
    const newest = h.pop();
    newest.copy(head);
    h.unshift(newest);
    if (this.filled < this.count) this.filled += 1;
    const last = this.filled - 1;
    for (let i = 0; i < this.count; i += 1) {
      const p = h[Math.min(i, last)];
      const q = h[Math.min(i + 1, last)];
      let dx = p.x - q.x;
      let dz = p.z - q.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      const w = this.width * 0.5 * (1 - i / this.count);
      const o = i * 6;
      this.positions[o] = p.x - dz * w;
      this.positions[o + 1] = p.y;
      this.positions[o + 2] = p.z + dx * w;
      this.positions[o + 3] = p.x + dz * w;
      this.positions[o + 4] = p.y;
      this.positions[o + 5] = p.z - dx * w;
    }
    this.attr.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
  }
}

/**
 * Hit sparks and exhaust flecks: one instanced mesh instead of a mesh each,
 * fed from a preallocated pool (live sparks are pool[0 … alive)), so a
 * firefight allocates nothing per spark.
 */
class Sparks {
  constructor(capacity) {
    this.capacity = capacity;
    this.pool = Array.from({ length: capacity }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      spin: new THREE.Vector3(),
      color: new THREE.Color(),
      size: 0,
      life: 0,
      maxLife: 1,
    }));
    this.alive = 0;
    this.cursor = 0;
    this.material = new THREE.MeshBasicNodeMaterial();
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1.732051), this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.dummy = new THREE.Object3D();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.clear();
  }
  spawn(position, color, size, velocity = ZERO) {
    let p;
    if (this.alive < this.capacity) {
      p = this.pool[this.alive];
      this.alive += 1;
    } else {
      // Full: recycle a live spark rather than dropping the new one.
      p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.capacity;
    }
    const life = 0.35 + Math.random() * 0.35;
    p.position.copy(position);
    p.velocity.set(velocity.x + (Math.random() - 0.5) * 2.5, velocity.y + Math.random() * 1.2, velocity.z + (Math.random() - 0.5) * 2.5);
    p.rotation.set(0, 0, 0);
    p.spin.set(Math.random() * 4, Math.random() * 4, Math.random() * 4);
    p.color.copy(color);
    p.size = size;
    p.life = life;
    p.maxLife = life;
  }
  update(dt) {
    const drag = Math.pow(0.45, dt);
    let i = 0;
    while (i < this.alive) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) {
        // Swap the dead spark past the live range.
        this.alive -= 1;
        this.pool[i] = this.pool[this.alive];
        this.pool[this.alive] = p;
        continue;
      }
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(drag);
      p.rotation.x += p.spin.x * dt;
      p.rotation.y += p.spin.y * dt;
      p.rotation.z += p.spin.z * dt;
      i += 1;
    }
    this.render();
  }
  render() {
    const d = this.dummy;
    let i = 0;
    for (let n = 0; n < this.alive; n += 1) {
      const p = this.pool[n];
      d.position.copy(p.position);
      d.rotation.copy(p.rotation);
      d.scale.setScalar(p.size * clamp(p.life / p.maxLife, 0, 1));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, p.color);
      i += 1;
    }
    this.idle(i);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
  /**
   * With nothing alive, one invisible (zero-scale) instance still draws, so the
   * pipelines compile while the title shows rather than on the first shot.
   */
  idle(count) {
    if (count === 0) this.mesh.setMatrixAt(0, this.zero);
    this.mesh.count = Math.max(1, count);
  }
  clear() {
    this.alive = 0;
    this.cursor = 0;
    this.idle(0);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ------------------------------------------------------------ controller */

export class FlightController {
  /**
   * @param {object} kit    from boot()
   * @param {object} model  the Career
   */
  constructor(kit, model) {
    this.kit = kit;
    this.model = model;
    this.callbacks = { onView() {}, onDock() {}, onOpenMap() {}, onPause() {}, onStoryChoice() {} };
    /** Sound effects (src/audio.js), set by main.js. */
    this.sfx = null;
    /** The HUD's radar canvas and damage-flash layer, handed over by React refs. */
    this.radarCanvas = null;
    this.radarCtx = null;
    this.radarTimer = 0;
    this.radarPoint = { x: 0, y: 0, edge: false };
    this.radarRef = (el) => {
      this.radarCanvas = el;
      this.radarCtx = el?.getContext('2d') ?? null;
    };
    this.flashEl = null;
    this.flashRef = (el) => {
      this.flashEl = el;
    };
    this.lastFlash = -100;
    /** After an insurance recovery the ship is untouchable for a moment. */
    this.graceUntil = -100;
    this.warden = null;
    this.storyChoiceTimer = 0;
    this.stats = null;
    this.renderer = kit.backendLabel;
    this.aimAngle = 0;
    this.aimMode = 'pointer';
    this.pointerActive = false;
    this.lastPointer = { x: 0, y: 0 };
    this.playerVelocity = new THREE.Vector3();
    this.pointerWorld = P(4, PLANE_Y, 4);
    this.paused = true;
    this.playerFireCooldown = 0;
    this.secondaryCooldown = 0;
    this.boostGlow = 0;
    this.cameraKick = 0;
    this.lastPlayerHit = -100;
    this.simulationTime = 0;
    this.viewTimer = 0;
    this.autosaveTimer = 0;
    this.eventTimer = 10;
    this.hazardTimer = 12;
    this.eventLabel = 'Civilian traffic is flowing normally';
    this.entityCounter = 0;
    this.pickupCounter = 0;
    this.entities = [];
    this.projectiles = [];
    this.pickups = [];
    this.asteroids = [];
    this.anomalies = [];
    this.spinners = [];
    this.targetId = null;
    this.nearbyAsteroid = null;
    this.nearbyAnomaly = null;
    this.nearbyDisabled = null;
    this.miningCooldown = 0;
    this.scanPulseCooldown = 0;
    this.emergencyRepairCooldown = 0;
    this.wheel = 0;
    this.lastView = null;
    this.touchLabel = '';

    this.materials = new Map();
    this.geometries = new Map();
    this.systemGeometries = [];
    this.pools = { bolt: [], missile: [] };
    this.raycaster = new THREE.Raycaster();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.72);
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.approach = new THREE.Vector3();
    this.want = new THREE.Vector3();
    this.stickAim = new THREE.Vector3();
    this.hasStickAim = false;
    this.ndc = new THREE.Vector2();

    this.setupRenderer();
  }

  /* ---------------------------------------------------------- setup */

  setupRenderer() {
    const { kit } = this;
    const renderer = kit.renderer;
    // Tone mapping, sRGB and contrast happen in the post chain (see below), in
    // Babylon's image-processing order, so the renderer's own output step is a pass-through.
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    // Babylon's ACES has no /0.6 pre-scale; exposure 1.12 there ≈ 0.672 here.
    renderer.toneMappingExposure = 1.12 * 0.6;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-19, 19, 19, -19, 0.5, 150 + CAM_PULLBACK);
    this.cameraTarget = new THREE.Vector3(0, 0.2, 0);
    kit.onResize((w, h) => this.resize(w, h));

    // Fog on the true view distance, linear, like Babylon's FOGMODE_LINEAR.
    this.fogColor = uniform(new THREE.Color());
    this.fogStart = uniform(60);
    this.fogEnd = uniform(100);
    const fogDistance = vec3(positionView.xy, positionView.z.add(CAM_PULLBACK)).length();
    this.scene.fogNode = fog(this.fogColor, fogDistance.sub(this.fogStart).div(this.fogEnd.sub(this.fogStart)).clamp(0, 1));

    this.sun = new THREE.DirectionalLight(0xffffff, 3.1 * LIGHT_SCALE);
    this.sun.castShadow = true;
    if (kit.shadow) kit.shadow(this.sun, 2048);
    else this.sun.shadow.mapSize.setScalar(kit.shadowSize(2048));
    Object.assign(this.sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 160 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2;
    this.sun.shadow.intensity = 0.66; // Babylon shadow darkness 0.34
    this.scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.72 * LIGHT_SCALE);
    this.hemi.position.set(0.15, 1, 0.1);
    this.scene.add(this.hemi);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.sparks = new Sparks(this.kit.detail(900, 200));
    this.scene.add(this.sparks.mesh);

    // Selective glow (Babylon's GlowLayer): materials that glow write a mask
    // into a second render target, and only those pixels feed the bloom.
    let glow = null;
    this.post = createPost(kit, this.scene, this.camera, {
      output: (color, { scenePass, tier }) => {
        if (!glow) {
          scenePass.setMRT(mrt({ output, glow: float(0) }));
          glow = bloom(color.mul(scenePass.getTextureNode('glow')), 1.35, 0.55, 0);
        }
        glow.setResolutionScale(tier.post === 'lite' ? 0.35 : 0.5);
        // Babylon image processing: ACES, then sRGB, then contrast 1.16 (its S-curve mixed in by 16%).
        const shown = renderOutput(color.add(glow), THREE.ACESFilmicToneMapping, THREE.SRGBColorSpace).rgb.clamp(0, 1);
        return vec4(mix(shown, shown.mul(shown).mul(shown.mul(-2).add(3)), 0.16), 1);
      },
    });
    this.glowMask = new Map();
  }

  /**
   * Build the current system and publish the first view. There is no
   * compileAsync here: the scene renders through the post chain's MRT pass, so
   * pipelines compiled for the plain canvas would go unused; the first frame
   * compiles the real ones while the kit's loading card is still up.
   */
  init() {
    this.buildScene();
  }

  resize(w, h) {
    const aspect = w / Math.max(1, h);
    let half = w < 760 ? 22 : 19;
    // Portrait phones: keep at least 15 units either side of the ship so combat stays readable.
    if (half * aspect < 15) half = 15 / aspect;
    Object.assign(this.camera, { top: half, bottom: -half, left: -half * aspect, right: half * aspect });
    this.camera.updateProjectionMatrix();
    this.viewHeight = h;
  }

  /* ---------------------------------------------------------- materials */

  glowNode(strength) {
    let node = this.glowMask.get(strength);
    if (!node) {
      node = mrt({ glow: float(strength) });
      this.glowMask.set(strength, node);
    }
    return node;
  }

  /** Babylon PBR material: albedo, roughness, metallic. */
  pbr(hex, roughness, metallic, { scale = 1, vertexColors = false } = {}) {
    const key = `pbr:${hex}:${scale}:${roughness}:${metallic}:${vertexColors}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardNodeMaterial({ color: lin(hex, scale), roughness, metalness: metallic, vertexColors, envMapIntensity: 0.55 });
      this.materials.set(key, m);
    }
    return m;
  }

  /** Babylon emissive material; `glow` puts it in the selective glow. */
  emissive(hex, intensity, glow = false) {
    const key = `emissive:${hex}:${intensity}:${glow}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshStandardNodeMaterial({
        color: lin(hex, 0.36),
        emissive: lin(hex),
        emissiveIntensity: intensity,
        metalness: 0.05,
        roughness: 0.58,
        envMapIntensity: 0.55,
      });
      if (glow) m.mrtNode = this.glowNode(1);
      this.materials.set(key, m);
    }
    return m;
  }

  /** The target highlight (Babylon's HighlightLayer): a glowing back-face shell. */
  halo(hex) {
    const key = `halo:${hex}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshBasicNodeMaterial({ color: lin(hex), side: THREE.BackSide, transparent: true, opacity: 0.5, depthWrite: false });
      m.mrtNode = this.glowNode(1);
      this.materials.set(key, m);
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

  /** A mesh for this system only (its geometry is freed on the next build). */
  mesh(geo, material, parent = this.world) {
    this.systemGeometries.push(geo);
    const m = new THREE.Mesh(geo, material);
    parent.add(m);
    return m;
  }

  cast(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* ---------------------------------------------------------- scene */

  clearScene() {
    for (const e of this.entities) e.root.removeFromParent();
    for (const p of this.projectiles) this.releaseProjectile(p);
    for (const p of this.pickups) p.mesh.removeFromParent();
    this.world.clear();
    for (const g of this.systemGeometries) g.dispose();
    this.systemGeometries = [];
    // Materials stay cached across rebuilds (keyed by their parameters), so a
    // jump or a new career reuses compiled pipelines instead of stalling on new ones.
    this.pools = { bolt: [], missile: [] };
    this.sparks.clear();
    this.entities = [];
    this.projectiles = [];
    this.pickups = [];
    this.asteroids = [];
    this.anomalies = [];
    this.spinners = [];
    this.targetId = null;
    this.targetHalo = null;
    this.nearbyAsteroid = null;
    this.nearbyAnomaly = null;
    this.nearbyDisabled = null;
    this.warden = null;
  }

  buildScene() {
    this.clearScene();
    const sys = systemById(this.model.state.currentSystem);
    const live = this.model.state.world.systems[sys.id];
    this.buildId = (this.buildId ?? 0) + 1;

    this.scene.background = lin(sys.palette[0]);
    this.fogColor.value.copy(lin(sys.palette[0]));
    this.fogStart.value = Math.max(44, 70 - sys.hazard * 18);
    this.fogEnd.value = Math.max(84, 112 - sys.hazard * 18);

    this.sun.color.copy(lin(sys.palette[2]));
    this.hemi.color.copy(lin(sys.palette[1], 0.55)).add(new THREE.Color(0.25, 0.28, 0.38));
    this.hemi.groundColor.copy(lin(sys.palette[0], 0.45));
    this.createEnvironment(sys.palette);

    this.createBackdrop();
    this.createSystemLandmarks();
    this.createStation();
    this.createGate();
    this.loadGltfBeacon();
    this.createAsteroidFields();
    this.createWreckSite();
    this.createAnomalies();
    this.createPlayer();
    this.createReticle();
    this.seedTraffic();
    if (live.war > 0.5) this.eventLabel = `${FACTIONS[live.owner].short} command reports active fleet operations`;
    this.maybeSpawnWarden();
    this.cameraTarget.set(this.player.position.x, 0.2, this.player.position.z);
    this.updateCamera(0);
    this.emitView(true);
  }

  /** The original lit its PBR with a tiny gradient cube map; this is the same one. */
  createEnvironment(palette) {
    // One cube texture for the whole session, repainted per system: the
    // environment node stays the same, so a jump only refilters it (no recompiles).
    if (!this.envCube) {
      const faces = Array.from({ length: 6 }, () => {
        const c = document.createElement('canvas');
        c.width = c.height = 32;
        return c;
      });
      this.envCube = new THREE.CubeTexture(faces);
      this.envCube.colorSpace = THREE.SRGBColorSpace;
      this.scene.environment = this.envCube;
      this.scene.environmentIntensity = 0.42;
      this.scene.environmentRotation.y = Math.PI / 4;
    }
    const paint = (c, from, to) => {
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 32, 32);
      grad.addColorStop(0, from);
      grad.addColorStop(1, to);
      g.fillStyle = grad;
      g.fillRect(0, 0, 32, 32);
    };
    const [p0, p1, p2] = palette;
    // Babylon's face order px py pz nx ny nz → three's px nx py ny pz nz.
    [p1, p0, p0, p1, p2, p0].forEach((from, i) => paint(this.envCube.images[i], from, p0));
    this.envCube.needsUpdate = true;
    this.envCube.needsPMREMUpdate = true;
  }

  createBackdrop() {
    const sys = systemById(this.model.state.currentSystem);
    const ground = this.mesh(new THREE.PlaneGeometry(190, 190).rotateX(-Math.PI / 2), this.pbr(sys.palette[0], 0.97, 0.02, { scale: 0.7 }));
    ground.position.y = -0.72;
    ground.receiveShadow = true;
    this.ground = ground;

    // The lane decals: flat marks just above the floor.
    const laneMat = this.emissive(sys.palette[1], 0.24);
    laneMat.polygonOffset = true;
    laneMat.polygonOffsetFactor = -2;
    laneMat.polygonOffsetUnits = -2;
    const laneGeo = new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2);
    this.systemGeometries.push(laneGeo);
    for (let o = 0; o < 7; o += 1) {
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.position.copy(P(-8 + o * 5.2, -0.705, -9 + o * 3.6));
      lane.rotation.y = 0.78;
      lane.receiveShadow = true;
      this.world.add(lane);
    }

    // 92 star flecks on the diorama floor, merged into one mesh per material.
    // (Plain merged meshes, not InstancedMesh: three bakes each small instanced
    // mesh's buffer into its shader, which would recompile on every jump.)
    const rnd = seeded(`${sys.id}:backdrop`);
    const groups = new Map();
    const place = new THREE.Matrix4();
    for (let o = 0; o < 92; o += 1) {
      const size = rnd() * 0.08 + 0.035;
      const pos = P((rnd() - 0.5) * 150, -0.66, (rnd() - 0.5) * 150);
      const hex = o % 8 === 0 ? sys.palette[2] : o % 5 === 0 ? sys.palette[1] : '#8ea2c9';
      const key = `${hex}:${o % 8 === 0}`;
      if (!groups.has(key)) groups.set(key, { hex, glow: o % 8 === 0, parts: [] });
      place.makeScale(size, size, size).setPosition(pos);
      groups.get(key).parts.push(part(new THREE.TetrahedronGeometry(1.732051).applyMatrix4(place)));
    }
    for (const g of groups.values()) {
      const merged = mergeGeometries(g.parts);
      g.parts.forEach((geo) => geo.dispose());
      this.mesh(merged, this.emissive(g.hex, g.glow ? 1.3 : 0.55, g.glow));
    }

    for (let o = 0; o < 7; o += 1) {
      const neb = this.mesh(disc(7 + rnd() * 11, 12), this.pbr(o % 2 ? sys.palette[1] : sys.palette[2], 1, 0, { scale: 0.06 + rnd() * 0.04 }));
      neb.rotation.x = Math.PI / 2;
      neb.position.copy(P((rnd() - 0.5) * 120, -0.68, (rnd() - 0.5) * 120));
      neb.scale.x = 1.8;
    }

    const planet = this.mesh(vertexVariation(flat(icosphere(8.5, 2)), lin(sys.palette[1]), 0.42), this.pbr(sys.palette[1], 0.86, 0.03, { vertexColors: true }));
    planet.position.copy(P(-53, -6.5, 42));
    const moon = this.mesh(flat(icosphere(2.2, 1)), this.pbr('#b8c7dc', 0.9, 0));
    moon.position.copy(P(-42, 2.5, 37));
  }

  createStation() {
    const sys = systemById(this.model.state.currentSystem);
    const root = new THREE.Group();
    this.world.add(root);
    this.station = root;
    const faction = FACTIONS[systemOwner(this.model.state.world, sys.id)].color;
    const dark = this.pbr('#25314d', 0.74, 0.24);
    const shell = this.pbr('#7c8cab', 0.68, 0.12);
    const accent = this.pbr(faction, 0.64, 0.1);

    const hub = this.cast(this.mesh(flat(cylinder({ height: 2.2, diameterTop: 2.8, diameterBottom: 3.6, tessellation: 8 })), shell, root));
    hub.position.y = 0.65;
    const tower = this.cast(this.mesh(flat(cylinder({ height: 4.4, diameter: 1.45, tessellation: 6 })), dark, root));
    tower.position.y = 2.7;
    const ring = this.cast(this.mesh(torus({ diameter: 7.6, thickness: 0.72, tessellation: 24 }), shell, root));
    ring.position.y = 1.1;
    const armGeo = new THREE.BoxGeometry(0.85, 0.55, 5.5);
    const beaconGeo = cylinder({ height: 0.42, diameter: 0.45, tessellation: 8 });
    this.systemGeometries.push(armGeo, beaconGeo);
    const beaconMat = this.emissive(faction, 1.2, true);
    for (let h = 0; h < 4; h += 1) {
      const d = h * (Math.PI / 2);
      const arm = this.cast(new THREE.Mesh(armGeo, h % 2 ? dark : shell));
      arm.position.set(Math.sin(d) * 2.5, 0.35, Math.cos(d) * 2.5);
      arm.rotation.y = d;
      root.add(arm);
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(Math.sin(d) * 5.1, 0.32, Math.cos(d) * 5.1);
      root.add(beacon);
    }
    const crown = this.mesh(torus({ diameter: 2.3, thickness: 0.15, tessellation: 18 }), accent, root);
    crown.position.y = 5.05;
    this.spinners.push({ mesh: crown, speed: -0.18 }, { mesh: ring, speed: 0.042 });
  }

  createSystemLandmarks() {
    const sys = systemById(this.model.state.currentSystem);
    const live = this.model.state.world.systems[sys.id];
    const rnd = seeded(`${sys.id}:landmark-geometry`);
    const industrial = sys.industries.some((o) => ['shipbuilding', 'manufacturing', 'logistics', 'refining', 'salvage'].includes(o));
    const strange = sys.hazard > 0.62 || sys.industries.some((o) => ['research', 'surveying', 'relic study', 'unknown'].includes(o));
    const warzone = live.war > 0.36 || sys.industries.includes('military logistics');
    if (industrial) {
      const mat = this.pbr('#3b4b65', 0.9, 0.08);
      for (let l = 0; l < 10; l += 1) {
        const box = this.cast(this.mesh(new THREE.BoxGeometry(1.1 + rnd() * 1.5, 0.5 + rnd() * 1.2, 1.1 + rnd() * 1.8), l % 4 === 0 ? this.pbr(sys.palette[1], 0.76, 0.06) : mat));
        box.position.copy(P(18 + (rnd() - 0.5) * 20, 0.1, -30 + (rnd() - 0.5) * 14));
        box.rotation.y = -rnd() * 0.5;
      }
    }
    if (strange) {
      for (let o = 0; o < 8; o += 1) {
        const glowing = o % 3 === 0;
        const crystal = this.cast(this.mesh(flat(polyhedron(o % 2 ? 1 : 2, 0.6 + rnd() * 1.5)), glowing ? this.emissive(sys.palette[2], 0.62, true) : this.pbr(sys.palette[1], 0.82, 0.04)));
        crystal.position.copy(P(-38 + (rnd() - 0.5) * 18, rnd() * 1.2, -14 + (rnd() - 0.5) * 22));
        crystal.scale.y = 1.5 + rnd() * 2.2;
        crystal.rotation.set(rnd(), rnd() * 3, rnd());
      }
    }
    if (warzone) {
      const hull = this.pbr('#4e4050', 0.93, 0.06);
      const warn = this.emissive('#ff6d73', 1.2, true);
      for (let o = 0; o < 7; o += 1) {
        const debris = this.cast(this.mesh(new THREE.BoxGeometry(0.45 + rnd() * 1.3, 0.3 + rnd() * 0.5, 2 + rnd() * 3.5), hull));
        debris.position.copy(P(-5 + (rnd() - 0.5) * 46, rnd() * 0.7, 38 + (rnd() - 0.5) * 14));
        debris.rotation.set(-rnd() * 0.4, -rnd() * Math.PI, rnd() * 0.4);
        if (o % 2 === 0) {
          const light = this.mesh(polyhedron(0, 0.22), warn);
          light.position.copy(debris.position).add(new THREE.Vector3(0, 0.8, 0));
        }
      }
    }
    if (!industrial && !strange && !warzone) {
      const mat = this.pbr('#71829a', 0.82, 0.08);
      for (let o = 0; o < 5; o += 1) {
        const beacon = this.cast(this.mesh(cylinder({ height: 1.8, diameterTop: 0.18, diameterBottom: 0.48, tessellation: 5 }), mat));
        beacon.position.copy(P(-28 + o * 13, 0.2, 32 - o * 4));
      }
    }
  }

  createGate() {
    const sys = systemById(this.model.state.currentSystem);
    const gate = new THREE.Group();
    gate.position.copy(P(28, 0, -22));
    this.world.add(gate);
    const segGeo = new THREE.BoxGeometry(1.1, 1.3, 4.4);
    this.systemGeometries.push(segGeo);
    const shell = this.pbr('#3b4766', 0.72, 0.2);
    for (let n = 0; n < 5; n += 1) {
      const o = (n / 5) * Math.PI * 2;
      const seg = this.cast(new THREE.Mesh(segGeo, shell));
      seg.position.set(Math.sin(o) * 4.8, 1.2 + Math.cos(o) * 4.8, 0);
      seg.rotation.z = -o;
      gate.add(seg);
    }
    const aperture = this.mesh(torus({ diameter: 8.2, thickness: 0.2, tessellation: 32 }), this.emissive(sys.palette[2], 1.6, true), gate);
    aperture.rotation.x = Math.PI / 2;
    aperture.position.y = 1.2;
  }

  loadGltfBeacon() {
    const build = this.buildId;
    const url = new URL('../assets/nav-beacon.gltf', import.meta.url).href;
    const place = (gltf) => {
      if (build !== this.buildId) return;
      const anchor = gltf.scene.clone(true);
      anchor.position.copy(P(-18, 0.15, -29));
      anchor.scale.setScalar(1.35);
      anchor.traverse((o) => {
        if (!o.isMesh) return;
        const src = o.material;
        const key = `beacon:${src.uuid}`;
        let mat = this.materials.get(key);
        if (!mat) {
          mat = new THREE.MeshStandardNodeMaterial({
            color: src.color,
            vertexColors: !!o.geometry.attributes.color,
            metalness: src.metalness,
            roughness: src.roughness,
            emissive: src.emissive,
            envMapIntensity: 0.55,
          });
          // Its faint emissive relic glow (the original put it in the glow layer).
          mat.mrtNode = this.glowNode(0.35);
          this.materials.set(key, mat);
        }
        o.material = mat;
        this.cast(o);
      });
      this.world.add(anchor);
    };
    if (this.beaconGltf) {
      place(this.beaconGltf);
      return;
    }
    new GLTFLoader().load(
      url,
      (gltf) => {
        this.beaconGltf = gltf;
        place(gltf);
      },
      undefined,
      (err) => console.info('Optional glTF navigation beacon was not loaded.', err)
    );
  }

  createAsteroidFields() {
    const sys = systemById(this.model.state.currentSystem);
    const rnd = seeded(`${sys.id}:asteroids`);
    const fields = [P(-25, 0, -18), P(30, 0, 20), P(-32, 0, 27)];
    const mat = this.pbr(sys.id === 'cinder' ? '#8c594c' : '#56627c', 0.96, 0.02, { vertexColors: true });
    const tint = lin(sys.id === 'cinder' ? '#9f6856' : '#65728c');
    for (let n = 0; n < 38; n += 1) {
      const field = fields[n % fields.length];
      const radius = 0.55 + rnd() * 1.7;
      const pos = new THREE.Vector3(field.x + (rnd() - 0.5) * 24, rnd() * 1.4 - 0.1, field.z - (rnd() - 0.5) * 20);
      const scale = new THREE.Vector3(0.7 + rnd() * 0.65, 0.65 + rnd() * 0.8, 0.7 + rnd() * 0.65);
      const rot = new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3);
      const id = `${sys.id}-deposit-${n}`;
      if (this.model.state.world.depletedDeposits.includes(id)) continue;
      const rock = this.cast(this.mesh(vertexVariation(flat(icosphere(radius, 1)), tint, 0.38), mat));
      rock.position.copy(pos);
      rock.scale.copy(scale);
      rock.rotation.copy(rot);
      this.asteroids.push({ id, mesh: rock, hp: radius * 32, rich: n % 9 === 0 });
    }
  }

  createWreckSite() {
    const site = new THREE.Group();
    site.position.copy(P(18, 0.2, 27));
    site.rotation.y = -0.8;
    this.world.add(site);
    const mat = this.pbr('#3e4a61', 0.92, 0.05);
    for (let i = 0; i < 5; i += 1) {
      const chunk = this.cast(this.mesh(new THREE.BoxGeometry(1.2 + i * 0.15, 0.45, 3 - i * 0.25), mat, site));
      chunk.position.set((i - 2) * 1.15, i % 2 ? 0.45 : 0, -i * 0.7);
      chunk.rotation.set(-i * 0.22, i * 0.35, i * 0.16);
    }
    for (let i = 0; i < 3; i += 1) this.spawnPickup(P(17 + i * 1.5, PLANE_Y, 25 + i), 'salvage', 1);
  }

  createAnomalies() {
    const sys = systemById(this.model.state.currentSystem);
    const spots = [P(-39, 0.4, 7), P(34, 0.4, -31)];
    const labels = sys.hazard > 0.7 ? ['Recursive signal', 'Gravitic fold'] : sys.war > 0.5 ? ['Encrypted battle recorder', 'Unstable jump scar'] : ['Navigation echo', 'Unregistered beacon'];
    for (let s = 0; s < spots.length; s += 1) {
      const id = `${sys.id}-anomaly-${s}`;
      const core = this.mesh(vertexVariation(flat(polyhedron(2, 0.85)), lin(sys.palette[2]), 0.28), this.emissive(sys.palette[2], 1.35, true));
      core.position.copy(spots[s]);
      const ring = this.mesh(torus({ diameter: 2.3, thickness: 0.055, tessellation: 20 }), this.emissive(sys.palette[1], 0.72));
      ring.position.copy(spots[s]);
      ring.position.y = 0.08;
      this.anomalies.push({ id, mesh: core, ring, index: s, label: labels[s], scanned: this.model.state.world.discoveries.includes(id) });
    }
  }

  createPlayer() {
    const ship = shipById(this.model.state.shipId);
    const visual = this.createShipVisual('player', '#eef6ff', '#39e6ff', 1, ship.id);
    visual.root.position.copy(P(-10, PLANE_Y, 9));
    this.player = visual.root;
    this.playerBody = visual.body;
    this.playerHalo = this.addHalo(visual.body, '#61edff');
    this.playerVelocity.set(0, 0, 0);
    const s = ship.id === 'mule' ? 1.18 : ship.id === 'bulwark' ? 1.35 : ship.id === 'atlas' ? 1.42 : ship.id === 'wraith' ? 0.9 : 1;
    this.player.scale.setScalar(s);
  }

  createReticle() {
    this.reticle = this.mesh(torus({ diameter: 0.9, thickness: 0.07, tessellation: 16 }), this.emissive('#9ef7ff', 1.15, true));
    this.reticle.position.copy(P(4, 0.02, 4));
  }

  /** Merged, shared geometry for one hull kind: body, primary, accent, dark and exhaust parts. */
  shipParts(kind) {
    return this.geometry(`ship:${kind}`, () => {
      const heavy = HEAVY.includes(kind);
      const sleek = SLEEK.includes(kind);
      const out = { primary: [], accent: [], dark: [], exhaust: [] };
      const body = flat(
        cylinder({ height: heavy ? 3.75 : sleek ? 3.45 : 3.2, diameterTop: sleek ? 0.08 : 0.2, diameterBottom: heavy ? 1.68 : sleek ? 1.12 : 1.45, tessellation: heavy ? 6 : 5 })
          .rotateX(Math.PI / 2)
          .translate(0, 0.26, 0)
      );
      out.dark.push(part(icosphere(0.55, 1).scale(0.65, 0.42, 1.05).translate(0, 0.62, 0.35)));
      for (const m of [-1, 1]) {
        // The original's right wing is the accent one; three's +x is the ship's left, hence m < 0.
        const wing = part(new THREE.BoxGeometry(sleek ? 1.95 : heavy ? 1.55 : 1.75, heavy ? 0.24 : 0.16, sleek ? 1.05 : heavy ? 1.55 : 1.35).rotateY(m * -0.24).translate(m * (sleek ? 1.05 : heavy ? 0.96 : 1), 0.05, heavy ? -0.55 : -0.4));
        (m < 0 ? out.accent : out.primary).push(wing);
        out.dark.push(part(cylinder({ height: 1.1, diameter: 0.36, tessellation: 8 }).rotateX(Math.PI / 2).translate(m * 1.25, 0.16, -0.72)));
        out.exhaust.push(part(disc(0.15, 8).translate(m * 1.25, 0.16, -1.28)));
        if (heavy) (m < 0 ? out.accent : out.dark).push(part(new THREE.BoxGeometry(0.58, 0.55, 1.55).translate(m * 1.42, 0.12, 0.02)));
      }
      if (SPINED.includes(kind)) out.accent.push(part(new THREE.BoxGeometry(0.42, 0.5, 2.7).translate(0, 0.42, -0.25)));
      const merged = { body };
      for (const [k, list] of Object.entries(out)) {
        merged[k] = list.length ? mergeGeometries(list) : null;
        list.forEach((g) => g.dispose());
      }
      return merged;
    });
  }

  createShipVisual(name, primaryHex, accentHex, scale, kind = 'fighter') {
    const parts = this.shipParts(kind);
    const root = new THREE.Group();
    root.name = `${name}-root`;
    root.scale.setScalar(scale);
    const primary = this.pbr(primaryHex, 0.7, 0.12);
    const accent = this.pbr(accentHex, 0.61, 0.08);
    const dark = this.pbr('#1a2540', 0.78, 0.14);
    const body = this.cast(new THREE.Mesh(parts.body, primary));
    root.add(body);
    if (parts.primary) root.add(this.cast(new THREE.Mesh(parts.primary, primary)));
    if (parts.accent) root.add(this.cast(new THREE.Mesh(parts.accent, accent)));
    if (parts.dark) root.add(this.cast(new THREE.Mesh(parts.dark, dark)));
    if (parts.exhaust) root.add(new THREE.Mesh(parts.exhaust, this.emissive(accentHex, 1.7, true)));
    this.world.add(root);
    return { root, body };
  }

  addHalo(body, hex) {
    const halo = new THREE.Mesh(body.geometry, this.halo(hex));
    halo.scale.setScalar(1.2);
    halo.position.y = 0.26 - 0.26 * 1.2;
    halo.raycast = () => {};
    body.add(halo);
    return halo;
  }

  setTargetHalo(entity) {
    this.targetHalo?.removeFromParent();
    this.targetHalo = entity ? this.addHalo(entity.body, entity.hostileToPlayer ? '#ff657d' : FACTIONS[entity.faction].color) : null;
  }

  /* ---------------------------------------------------------- traffic */

  seedTraffic() {
    const sys = systemById(this.model.state.currentSystem);
    const live = this.model.state.world.systems[sys.id];
    const rnd = seeded(`${sys.id}:${this.model.state.marketTick}:traffic`);
    const spot = (m = 20) => P((rnd() - 0.5) * m * 2, PLANE_Y, (rnd() - 0.5) * m * 2);
    const owner = systemOwner(this.model.state.world, sys.id);
    const civil = owner === 'freewake' ? 'independent' : owner;
    const traffic = Math.max(2, 2 + sys.population);
    for (let m = 0; m < traffic; m += 1) this.spawnEntity(m % 4 === 0 ? 'courier' : m % 5 === 0 ? 'smuggler' : 'trader', civil, spot(31));
    const miners = sys.industries.includes('mining') || sys.industries.includes('salvage') ? 5 : Math.max(1, Math.round(sys.population * 0.55));
    for (let m = 0; m < miners; m += 1) this.spawnEntity('miner', 'independent', spot(35));
    for (let m = 0; m < Math.max(1, Math.round(live.security * 5)); m += 1) this.spawnEntity('security', owner, spot(29));
    const pirates = Math.max(1, Math.round(live.piracy * 7 + live.war * 2));
    for (let m = 0; m < pirates; m += 1) this.spawnEntity('pirate', 'freewake', spot(40));
    if (live.war > 0.35) for (let m = 0; m < Math.ceil(live.war * 5); m += 1) this.spawnEntity(m % 3 === 0 ? 'bomber' : 'mercenary', m % 2 ? 'vanta' : 'concord', spot(36));

    const named = this.model.state.world.targets.find((t) => t.status === 'active' && t.system === sys.id);
    if (named) {
      const boss = this.spawnEntity('bountyHunter', named.faction, spot(38));
      boss.label = named.name;
      boss.bounty = named.bounty;
      boss.namedTargetId = named.id;
      boss.legalTarget = true;
      boss.hostileToPlayer = boss.faction === 'freewake' && this.model.state.reputation.freewake < 25;
      for (let p = 0; p < named.escort; p += 1) this.spawnEntity('escort', named.faction, boss.root.position.clone().add(new THREE.Vector3((p - 1) * 3, 0, -(4 + p * 2))));
    }
    const escortOrder = Object.values(this.model.state.fleetOrders).find((o) => o?.role === 'escort' && o.status === 'active');
    if (escortOrder) {
      const wing = this.spawnEntity('escort', 'independent', this.player ? this.player.position.clone().add(new THREE.Vector3(-5, 0, 5)) : spot(8));
      wing.label = `VR ${shipById(escortOrder.shipId).name}`;
      wing.legalTarget = false;
      wing.friendly = true;
    }
    const drones = (this.model.state.installedModules[this.model.state.shipId] ?? []).filter((m) => m === 'droneBay').length;
    for (let m = 0; m < drones; m += 1) {
      const drone = this.spawnEntity('drone', 'independent', this.player.position.clone().add(new THREE.Vector3(-2 + m * 4, 0, 4)));
      drone.label = `VR Firefly ${m + 1}`;
      drone.legalTarget = false;
      drone.friendly = true;
    }
    const rescue = this.model.state.acceptedMissions.find((m) => m.type === 'rescue' && m.targetSystem === sys.id);
    if (rescue) {
      const wreck = this.spawnEntity('courier', 'independent', spot(24));
      wreck.label = `Distress survivor \xB7 ${rescue.title}`;
      wreck.rescueMissionId = rescue.id;
      wreck.disabled = true;
      wreck.legalTarget = false;
      wreck.hull = Math.max(4, wreck.maxHull * 0.12);
      wreck.armor = 0;
      wreck.shield = 0;
      this.eventLabel = `Mission distress signal located: ${wreck.label}`;
    }
  }

  spawnEntity(role, faction, position) {
    const id = `ship-${++this.entityCounter}`;
    const accent = FACTIONS[faction].color;
    const primary =
      role === 'pirate' || role === 'bountyHunter' ? '#5e385f' : role === 'security' ? '#dcecff' : role === 'miner' ? '#d58c4a' : role === 'trader' ? '#7c91a8' : role === 'bomber' ? '#9b4052' : role === 'smuggler' ? '#483f72' : '#8792b6';
    const scale =
      role === 'trader' ? 1.22 : role === 'security' ? 1.05 : role === 'miner' ? 1.15 : role === 'courier' || role === 'smuggler' ? 0.75 : role === 'bomber' ? 1.28 : role === 'drone' ? 0.48 : 0.92;
    const visual = this.createShipVisual(id, primary, accent, scale, role);
    visual.root.position.copy(position);
    const rnd = seeded(`${id}:${this.model.state.currentSystem}`);
    const hull = role === 'trader' ? 120 : role === 'security' ? 145 : role === 'pirate' ? 92 : role === 'bomber' ? 180 : role === 'miner' ? 110 : role === 'bountyHunter' ? 190 : 100;
    const armor = role === 'bomber' ? 110 : role === 'security' ? 82 : role === 'trader' ? 64 : role === 'pirate' ? 42 : 50;
    const shield = role === 'security' ? 95 : role === 'pirate' ? 58 : role === 'bountyHunter' ? 120 : 62;
    const names =
      role === 'pirate'
        ? ['Razorfin', 'Bad Habit', 'Debt Collector', 'Neon Jackal', 'Last Warning']
        : role === 'security'
          ? ['Civic Spear', 'Watchtower', 'Blue Shield', 'Marshal Wing']
          : role === 'trader'
            ? ['Profit Margin', 'Copper Finch', 'Long Dividend', 'Soft Landing']
            : role === 'miner'
              ? ['Rock Choir', 'Claimant', 'Deep Cut', 'Prospector Nine']
              : role === 'smuggler'
                ? ['False Positive', 'Quiet Ledger', 'Second Passport', 'No Witness']
                : role === 'bomber'
                  ? ['Red Verdict', 'Long Fuse', 'Oathfire']
                  : ['Swift Parcel', 'Wayfarer', 'Lark', 'Nomad'];
    const tactic =
      role === 'security' ? 'kite' : role === 'pirate' ? 'circle' : role === 'bomber' ? 'broadside' : role === 'escort' || role === 'drone' ? 'escort' : ['trader', 'miner', 'courier', 'smuggler'].includes(role) ? 'flee' : 'rush';
    const weapon =
      role === 'security'
        ? 'ion'
        : role === 'pirate'
          ? 'autocannon'
          : role === 'bomber'
            ? 'torpedo'
            : role === 'bountyHunter'
              ? 'rail'
              : role === 'miner'
                ? 'miningLaser'
                : role === 'drone'
                  ? 'flak'
                  : role === 'escort'
                    ? 'pulse'
                    : 'laser';
    const entity = {
      id,
      root: visual.root,
      body: visual.body,
      faction,
      role,
      label: names[Math.floor(rnd() * names.length)],
      velocity: new THREE.Vector3(),
      goal: P((rnd() - 0.5) * 58, PLANE_Y, (rnd() - 0.5) * 58),
      hull,
      maxHull: hull,
      armor,
      maxArmor: armor,
      shield,
      maxShield: shield,
      speed: role === 'drone' ? 13.5 : role === 'courier' ? 12 : role === 'pirate' ? 10.5 : role === 'security' ? 10 : role === 'trader' ? 7 : 6,
      radius: scale * 1.1,
      fireCooldown: rnd(),
      aiCooldown: rnd() * 0.25,
      damagedAt: -100,
      hostileToPlayer: role === 'pirate' && this.model.state.reputation.freewake < 25,
      provoked: false,
      bounty: role === 'pirate' ? Math.round((80 + rnd() * 280) * difficultyOf(this.model.state).bounty) : 0,
      cargo: COMMODITIES[Math.floor(rnd() * Math.min(7, COMMODITIES.length))].id,
      weapon,
      tactic,
      legalTarget: role === 'pirate' || (faction === 'freewake' && !['trader', 'smuggler'].includes(role)),
      disabled: false,
      scanCooldown: 3 + rnd() * 6,
      destroyed: false,
    };
    this.entities.push(entity);
    return entity;
  }

  /* ---------------------------------------------------------- frame */

  setPaused(paused) {
    this.paused = paused;
    // Menus and the station are quiet: the engine loop fades out while flight is suspended.
    if (paused) this.sfx?.setThrust(0, false);
  }

  /** One frame of flight: read input, simulate, then keep the HUD fed. */
  update(dt) {
    const s = this.model.state;
    // Ship stats are derived from the loadout; compute them once per frame, not per projectile.
    this.stats = shipStats(s);
    this.simulationTime += dt;
    s.playSeconds += dt;
    this.playerFireCooldown -= dt;
    this.secondaryCooldown -= dt;
    this.miningCooldown -= dt;
    this.scanPulseCooldown -= dt;
    this.emergencyRepairCooldown -= dt;
    this.eventTimer -= dt;
    this.hazardTimer -= dt;
    this.autosaveTimer += dt;
    this.viewTimer += dt;
    this.readActions();
    this.updateAim();
    this.updatePlayer(dt);
    this.updateEntities(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.updateCamera(dt);
    this.updateLaw(dt);
    if (this.eventTimer <= 0) this.spawnDynamicOpportunity();
    if (this.hazardTimer <= 0) this.applyEnvironmentHazard();
    if (this.autosaveTimer > 120 && !this.isInCombat()) {
      this.autosaveTimer = 0;
      this.model.save(true);
    }
    this.maybeSpawnWarden();
    if (this.storyChoiceTimer > 0) {
      this.storyChoiceTimer -= dt;
      if (this.storyChoiceTimer <= 0) this.callbacks.onStoryChoice();
    }
    // Blink the ship while the post-recovery grace lasts.
    this.player.visible = this.simulationTime >= this.graceUntil || Math.floor(this.simulationTime * 9) % 2 === 0;
    this.radarTimer += dt;
    if (this.radarTimer >= 1 / 30) {
      this.radarTimer = 0;
      this.drawRadar();
    }
    if (this.viewTimer > 0.1) {
      this.viewTimer = 0;
      this.emitView();
      this.model.changed();
    }
  }

  /** Scene animation that runs whether or not flight is paused, then the render. */
  render(dt) {
    if (!this.paused) {
      for (const s of this.spinners) s.mesh.rotation.y += s.speed * dt;
      for (const a of this.anomalies) {
        if (!a.mesh.parent) continue;
        a.mesh.rotation.y -= 0.48 * dt;
        a.mesh.position.y = 0.5 + Math.sin(this.simulationTime * 1.6 + a.index) * 0.14;
        a.ring.rotation.y += 0.24 * dt;
      }
      if (this.warden && !this.warden.destroyed) this.animateWarden(this.warden, dt);
      this.sparks.update(dt);
    }
    this.post.render();
  }

  /** Edge-triggered flight actions (the original handled these on keydown). */
  readActions() {
    const input = this.kit.input;
    // Shift+Tab steps back through the contacts, as in the original.
    if (input.pressed('target')) this.cycleTarget(input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? -1 : 1);
    if (input.pressed('interact')) this.interact();
    if (input.pressed('scan')) this.scanTarget();
    if (input.pressed('repair')) this.emergencyRepair();
    if (input.pressed('ecm')) this.deployCountermeasure();
    if (input.pressed('missile')) this.fireSecondary();
    for (let i = 0; i < 4; i += 1) if (input.pressed(`weapon${i + 1}`)) this.selectWeapon(i);
    if (input.pressed('weapon')) this.model.cycleWeapon(1);
    // Mouse wheel cycles weapons (one step per notch, trackpads accumulate).
    this.wheel = this.wheel * 0.9 + input.zoom();
    if (Math.abs(this.wheel) >= 0.9) {
      this.model.cycleWeapon(this.wheel < 0 ? 1 : -1);
      this.wheel = 0;
    }
  }

  selectWeapon(index) {
    const s = this.model.state;
    const loadout = s.weaponLoadouts[s.shipId] ?? [];
    if (!loadout[index]) return;
    s.activeWeaponIndex = index;
    this.model.notify('info', `Weapon ${index + 1}: ${WEAPONS[loadout[index]].name}`);
    this.model.changed();
  }

  updateAim() {
    const input = this.kit.input;
    const aim = input.vector('aim');
    const pointer = input.pointer;
    if (pointer.x !== this.lastPointer.x || pointer.y !== this.lastPointer.y) {
      this.lastPointer.x = pointer.x;
      this.lastPointer.y = pointer.y;
      this.pointerActive = true;
      this.aimMode = 'pointer';
    }
    if (aim.x * aim.x + aim.y * aim.y > 0.08) {
      this.aimMode = 'stick';
      this.stickAim.set(aim.x, 0, -aim.y).normalize();
      this.hasStickAim = true;
      this.aimAngle = Math.atan2(this.stickAim.x, this.stickAim.z);
    }
    if (this.aimMode === 'stick' && this.hasStickAim) {
      this.pointerWorld.copy(this.player.position).addScaledVector(this.stickAim, 7);
    } else if (this.pointerActive) {
      this.ndc.set(pointer.nx, pointer.ny);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      if (this.raycaster.ray.intersectPlane(this.aimPlane, this.tmp)) this.pointerWorld.copy(this.tmp);
      const dx = this.pointerWorld.x - this.player.position.x;
      const dz = this.pointerWorld.z - this.player.position.z;
      if (Math.abs(dx) + Math.abs(dz) > 0.05) this.aimAngle = Math.atan2(dx, dz);
    }
    this.player.rotation.set(0, this.aimAngle, 0);
    this.pointerWorld.y = 0.03;
    this.reticle.position.copy(this.pointerWorld);
    this.reticle.scale.setScalar(1 + Math.sin(this.simulationTime * 7) * 0.07);
  }

  updatePlayer(dt) {
    const s = this.model.state;
    const input = this.kit.input;
    const stats = this.stats;
    const mv = input.vector('move');
    const dir = this.tmp2.set(mv.x, 0, -mv.y);
    if (dir.lengthSq() > 1) dir.normalize();
    const boosting = input.down('boost') && s.energy > 2 && dir.lengthSq() > 0.05;
    const drain = s.crew.includes('brin') ? 0.8 : 1;
    const speed = stats.speed * (boosting ? stats.boost : 1);
    const accel = stats.acceleration * (boosting ? 1.35 : 1);
    if (dir.lengthSq() > 0.02) {
      const want = this.tmp.copy(dir).normalize().multiplyScalar(speed);
      this.playerVelocity.lerp(want, clamp((accel * dt) / Math.max(1, stats.speed), 0, 1));
    } else {
      const brake = s.settings.autoBrake ? stats.braking : Math.max(0.18, 1 - stats.drift);
      this.playerVelocity.multiplyScalar(Math.pow(clamp(1 - brake, 0.04, 0.82), dt));
    }
    if (boosting) {
      s.energy = Math.max(0, s.energy - 24 * drain * dt);
      this.boostGlow = 1;
      if (Math.random() < dt * 15 && !s.settings.reducedMotion) {
        this.spawnParticle(this.tmp.copy(this.player.position).add(this.want.set(0, 0, 1.2)), '#53e9ff', 0.18, this.approach.copy(this.playerVelocity).multiplyScalar(-0.08));
      }
    } else {
      s.energy = Math.min(stats.energy, s.energy + 14 * dt);
      this.boostGlow = Math.max(0, this.boostGlow - dt * 4);
    }
    const pos = this.player.position;
    pos.addScaledVector(this.playerVelocity, dt);
    pos.x = clamp(pos.x, -72, 72);
    pos.z = clamp(pos.z, -72, 72);
    pos.y = PLANE_Y;
    if (dist(pos, this.station.position) < 4.6) {
      const away = this.tmp.subVectors(pos, this.station.position);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.x = 1;
      away.normalize();
      pos.copy(this.station.position).addScaledVector(away, 4.6);
      pos.y = PLANE_Y;
      this.playerVelocity.multiplyScalar(0.35);
    }

    this.sfx?.setThrust(this.playerVelocity.length() / Math.max(1, stats.speed * stats.boost), boosting);

    s.weaponHeat = Math.max(0, s.weaponHeat - 21 * dt);
    const touchAim = input.touch.vectors.aim;
    const touchFiring = !!touchAim && touchAim.x * touchAim.x + touchAim.y * touchAim.y > 0.16;
    const manual = input.down('fire') || touchFiring;
    // Automatic fire only engages a locked hostile inside the active weapon's range (it used to
    // fire at any lock at all, neutral traders included, and so committed crimes on its own).
    const auto = !manual && s.settings.autoFire ? this.autoFireTarget() : null;
    if ((manual || auto) && s.weaponHeat < 96) this.firePlayerWeapon(auto);

    const crewBoost = s.crew.includes('io') ? 1.18 : 1;
    if (this.simulationTime - this.lastPlayerHit > 3.2) s.shield = Math.min(stats.shield, s.shield + 7.5 * crewBoost * dt);
    if (stats.repairDrones && this.simulationTime - this.lastPlayerHit > 7) {
      s.armor = Math.min(stats.armor, s.armor + 1.25 * dt);
      s.hull = Math.min(stats.hull, s.hull + 0.45 * dt);
    }
  }

  /** The locked target automatic fire may engage, or null. */
  autoFireTarget() {
    if (!this.targetId) return null;
    const t = this.entities.find((e) => e.id === this.targetId && !e.destroyed);
    if (!t || !t.hostileToPlayer || t.disabled || t.friendly) return null;
    return dist(t.root.position, this.player.position) <= activeWeapon(this.model.state).range * 0.95 ? t : null;
  }

  /** @param {object|null} autoTarget  set when automatic fire (not the trigger) is shooting */
  firePlayerWeapon(autoTarget = null) {
    const s = this.model.state;
    const w = activeWeapon(s);
    if (this.playerFireCooldown > 0 || s.energy < w.energy) return;
    this.playerFireCooldown = w.fireRate;
    s.weaponHeat = Math.min(100, s.weaponHeat + w.heat);
    s.energy = Math.max(0, s.energy - w.energy);
    const gunner = s.crew.includes('mara') ? 1.12 : 1;
    const mult = (1 + s.upgrades.weapon * 0.1) * this.stats.damageMultiplier;
    let angle = this.aimAngle;
    this.sfx?.shot(w.id);
    if (autoTarget) {
      angle = Math.atan2(autoTarget.root.position.x - this.player.position.x, autoTarget.root.position.z - this.player.position.z);
    } else if (s.settings.aimAssist && this.targetId) {
      const target = this.entities.find((e) => e.id === this.targetId && !e.destroyed);
      if (target) {
        const want = Math.atan2(target.root.position.x - this.player.position.x, target.root.position.z - this.player.position.z);
        const d = angleDelta(angle, want);
        if (Math.abs(d) < 0.22) angle += d * 0.62;
      }
    }
    for (let n = 0; n < w.bolts; n += 1) {
      const a = angle + (n - (w.bolts - 1) / 2) * w.spread + (Math.random() - 0.5) * w.spread;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      this.spawnProjectile(this.player.position.clone().addScaledVector(dir, 1.45).add(new THREE.Vector3(0, 0.25, 0)), dir.multiplyScalar(w.speed), w.damage * gunner * mult, 'player', 'player', w.color, w.range / w.speed, w.splash, w);
    }
    if (!s.settings.reducedMotion) {
      const muzzle = this.player.position.clone().add(new THREE.Vector3(Math.sin(this.aimAngle) * 1.3, 0.455, Math.cos(this.aimAngle) * 1.3));
      this.spawnParticle(muzzle, w.color, 0.16, new THREE.Vector3());
    }
  }

  fireSecondary() {
    const s = this.model.state;
    if (this.secondaryCooldown > 0 || s.energy < 24 || s.missiles <= 0) {
      if (s.missiles <= 0) this.model.notify('warn', 'Missile racks empty', 'Restock while docked or recover ordnance salvage.');
      this.sfx?.deny();
      return;
    }
    this.secondaryCooldown = 4.5;
    s.energy -= 24;
    s.missiles -= 1;
    const dir = new THREE.Vector3(Math.sin(this.aimAngle), 0, Math.cos(this.aimAngle));
    const rocket = WEAPONS.rocket;
    const p = this.spawnProjectile(this.player.position.clone().addScaledVector(dir, 1.3).add(new THREE.Vector3(0, 0.35, 0)), dir.clone().multiplyScalar(rocket.speed), rocket.damage + s.upgrades.weapon * 4, 'player', 'player', rocket.color, rocket.range / rocket.speed, rocket.splash, rocket);
    p.homingTarget = this.targetId ?? undefined;
    this.sfx?.launch();
    this.kit.input.rumble(0.35, 90);
    this.model.notify('info', 'Starbreaker launched', `${this.targetId ? 'Homing solution acquired' : 'Unguided trajectory'} \xB7 ${s.missiles} remaining`);
  }

  /* ---------------------------------------------------------- projectiles */

  projectileMesh(kind, hex, intensity) {
    const geo =
      kind === 'missile'
        ? this.geometry('missile', () => cylinder({ height: 0.75, diameter: 0.22, tessellation: 6 }).rotateX(Math.PI / 2))
        : this.geometry('bolt', () => new THREE.BoxGeometry(0.11, 0.1, 0.62));
    const mesh = this.pools[kind].pop() ?? new THREE.Mesh(geo, undefined);
    mesh.material = this.emissive(hex, intensity, true);
    mesh.visible = true;
    this.world.add(mesh);
    return mesh;
  }

  releaseProjectile(p) {
    p.trail?.dispose();
    p.mesh.removeFromParent();
    this.pools[p.kind]?.push(p.mesh);
  }

  spawnProjectile(position, velocity, damage, owner, faction, hex, life, splash, weapon = WEAPONS.pulse) {
    const kind = splash > 0 ? 'missile' : 'bolt';
    const mesh = this.projectileMesh(kind, hex, kind === 'missile' ? 1.8 : 1.35);
    mesh.position.copy(position);
    mesh.rotation.set(0, Math.atan2(velocity.x, velocity.z), 0);
    let trail;
    if (kind === 'missile' && this.kit.tier.name !== 'low') {
      trail = new Trail(this.emissive(hex, 0.75));
      this.world.add(trail.mesh);
    }
    const p = {
      kind,
      mesh,
      position: position.clone(),
      velocity: velocity.clone(),
      life,
      damage,
      owner,
      faction,
      splash,
      shieldMultiplier: weapon.shieldMultiplier,
      armorMultiplier: weapon.armorMultiplier,
      penetration: weapon.penetration,
      tracking: weapon.tracking,
      trail,
    };
    this.projectiles.push(p);
    return p;
  }

  updateProjectiles(dt) {
    const stats = this.stats;
    for (const t of this.projectiles) {
      t.life -= dt;
      if (t.homingTarget) {
        const target = t.homingTarget === 'player' ? this.player.position : this.entities.find((e) => e.id === t.homingTarget && !e.destroyed)?.root.position;
        if (target) {
          const want = this.tmp.subVectors(target, t.position).normalize().multiplyScalar(t.velocity.length());
          const stealth = stats.scanSignature < 0.65 && t.owner !== 'player' ? 0.55 : 1;
          t.velocity.lerp(want, clamp(dt * (1.4 + t.tracking * 4) * stealth, 0, 1));
        }
      }
      t.position.addScaledVector(t.velocity, dt);
      t.position.y = t.mesh.position.y;
      t.mesh.position.x = t.position.x;
      t.mesh.position.z = t.position.z;
      t.mesh.rotation.y = Math.atan2(t.velocity.x, t.velocity.z);
      t.trail?.update(t.mesh.position);
      if (t.owner !== 'player' && !t.friendly && t.splash > 0 && !t.interceptChecked && dist(t.position, this.player.position) < 5.5 && stats.pointDefense) {
        t.interceptChecked = true;
        if (Math.random() < 0.45) {
          this.spawnHitParticles(t.position, '#f4f7ff', 7);
          t.life = -1;
          this.model.notify('good', 'Point defense intercept', 'Incoming ordnance destroyed inside the defensive envelope.');
          continue;
        }
      }
      if (t.owner === 'player') {
        for (const e of this.entities) {
          // Your own drones and wing fly through your fire.
          if (e.destroyed || e.friendly || dist(t.position, e.root.position) > e.radius + 0.45) continue;
          this.damageEntity(e, t.damage, true, t.shieldMultiplier, t.armorMultiplier, t.penetration);
          if (t.splash > 0) this.explode(t.position, t.damage * 0.6, t.splash, 'player');
          t.life = -1;
          break;
        }
      } else if (!t.friendly && dist(t.position, this.player.position) < 1.15) {
        this.damagePlayer(t.damage, t.shieldMultiplier, t.armorMultiplier, t.penetration);
        if (t.splash > 0) this.explode(t.position, t.damage * 0.5, t.splash, t.owner);
        t.life = -1;
      } else {
        for (const e of this.entities) {
          if (e.id === t.owner || e.destroyed || e.faction === t.faction || dist(t.position, e.root.position) > e.radius + 0.35) continue;
          this.damageEntity(e, t.damage, false, t.shieldMultiplier, t.armorMultiplier, t.penetration);
          t.life = -1;
          break;
        }
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (this.projectiles[i].life <= 0) {
        this.releaseProjectile(this.projectiles[i]);
        this.projectiles.splice(i, 1);
      }
    }
  }

  /* ---------------------------------------------------------- damage */

  damageEntity(e, amount, byPlayer, shieldMult = 1, armorMult = 1, penetration = 0) {
    if (e.destroyed) return;
    const s = this.model.state;
    if (byPlayer && !e.legalTarget && !e.provoked) {
      e.provoked = true;
      e.hostileToPlayer = true;
      const security = e.role === 'security';
      const witnessed = dist(e.root.position, this.station.position) < 42 || this.entities.some((c) => c.id !== e.id && !c.destroyed && dist(c.root.position, e.root.position) < 20);
      this.commitCrime(security ? 18 : 10, security ? 'Assault on security' : 'Unlawful weapons fire', witnessed, e.faction);
      s.reputation[e.faction] = Math.max(-100, s.reputation[e.faction] - (security ? 8 : 4));
      s.reputation.freewake = Math.min(100, s.reputation.freewake + 1);
    }
    e.damagedAt = this.simulationTime;
    let t = amount;
    let layer = 'hull';
    if (e.shield > 0) {
      const m = Math.max(0.1, shieldMult);
      const absorbed = Math.min(t, e.shield / m);
      e.shield -= absorbed * m;
      t -= absorbed;
      layer = 'shield';
      this.spawnHitParticles(e.root.position, '#65dbff', 3);
    }
    if (t > 0 && penetration > 0) {
      const through = t * penetration;
      e.hull -= through;
      t -= through;
    }
    if (t > 0 && e.armor > 0) {
      const m = Math.max(0.1, armorMult);
      const absorbed = Math.min(t, e.armor / m);
      e.armor -= absorbed * m;
      t -= absorbed;
      if (layer === 'hull') layer = 'armor';
      this.spawnHitParticles(e.root.position, '#ffd077', 4);
    }
    if (t > 0) {
      e.hull -= t;
      this.spawnHitParticles(e.root.position, '#ff9861', 4);
    }
    if (byPlayer) this.sfx?.confirm(layer);
    const boardable = e.role !== 'security' && e.role !== 'drone' && e.role !== 'warden' && e.role !== 'mote';
    if (byPlayer && !e.disabled && e.hull > 0 && e.hull <= e.maxHull * 0.17 && boardable) {
      e.disabled = true;
      e.hostileToPlayer = false;
      e.velocity.multiplyScalar(0.12);
      e.hull = Math.max(1, e.hull);
      this.model.notify('good', `${e.label} disabled`, 'Close within 4 km and press E to board, or keep firing to destroy it.');
      this.eventLabel = `${e.label} has surrendered its drive control`;
      return;
    }
    if (e.hull <= 0) this.destroyEntity(e, byPlayer);
  }

  damagePlayer(amount, shieldMult = 1, armorMult = 1, penetration = 0) {
    const s = this.model.state;
    if (this.simulationTime < this.graceUntil) {
      // Insurance recovery grace: the hit sparks off the recovery field instead.
      this.spawnHitParticles(this.player.position, '#9ef7ff', 2);
      return;
    }
    this.lastPlayerHit = this.simulationTime;
    if (s.settings.cameraShake && !s.settings.reducedMotion) this.cameraKick = Math.min(0.32, this.cameraKick + 0.11);
    this.kit.input.rumble(0.45, 110);
    let t = amount * difficultyOf(s).incoming;
    const hadShield = s.shield > 0;
    let layer = 'shield';
    if (s.shield > 0) {
      const m = Math.max(0.1, shieldMult);
      const absorbed = Math.min(t, s.shield / m);
      s.shield -= absorbed * m;
      t -= absorbed;
      this.spawnHitParticles(this.player.position, '#65dbff', 5);
    }
    if (t > 0 && penetration > 0) {
      const through = t * penetration;
      s.hull -= through;
      t -= through;
      layer = 'hull';
    }
    if (t > 0 && s.armor > 0) {
      const m = Math.max(0.1, armorMult);
      const absorbed = Math.min(t, s.armor / m);
      s.armor -= absorbed * m;
      t -= absorbed;
      if (layer === 'shield') layer = 'armor';
      this.spawnHitParticles(this.player.position, '#ffd077', 5);
    }
    if (t > 0) {
      s.hull -= t;
      layer = 'hull';
      this.spawnHitParticles(this.player.position, '#ff6d73', 6);
    }
    this.sfx?.hit(layer);
    this.flash(layer === 'shield' ? '#46d8ff' : layer === 'armor' ? '#ffc35a' : '#ff3b5c', layer === 'hull' ? 0.8 : 0.45);
    if (hadShield && s.shield <= 0.5) this.sfx?.shieldDown();
    if (s.hull > 0 && s.hull < (this.stats ?? shipStats(s)).hull * 0.25) this.sfx?.alarm();
    if (s.hull <= 0) this.playerDestroyed();
  }

  /** A brief coloured edge on the screen when the ship is hit (Web Animations, no layout work). */
  flash(color, strength) {
    const el = this.flashEl;
    if (!el?.animate || this.simulationTime - this.lastFlash < 0.12) return;
    this.lastFlash = this.simulationTime;
    const a = strength * (this.model.state.settings.reducedMotion ? 0.45 : 1);
    el.style.setProperty('--flash', color);
    el.animate([{ opacity: a }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  }

  explode(at, damage, radius, owner) {
    this.spawnHitParticles(at, '#ffb35a', this.model.state.settings.reducedMotion ? 5 : 14);
    for (const e of this.entities) {
      const d = dist(at, e.root.position);
      if (owner === 'player' && e.friendly) continue;
      if (!e.destroyed && d < radius) this.damageEntity(e, damage * (1 - d / radius), owner === 'player');
    }
    const d = dist(at, this.player.position);
    if (owner !== 'player' && d < radius) this.damagePlayer(damage * (1 - d / radius));
  }

  destroyEntity(e, byPlayer) {
    const s = this.model.state;
    e.destroyed = true;
    this.spawnHitParticles(e.root.position, e.sparkColor ?? FACTIONS[e.faction].color, s.settings.reducedMotion ? 8 : 24);
    this.playAt(e.root.position, (gain, pan) => this.sfx?.explode(e.role === 'warden' ? 3 : e.radius, { gain, pan }), 45);
    if (e.role === 'warden') {
      this.wardenDestroyed(e);
      return;
    }
    if (e.rescueMissionId) {
      this.model.abandonMission(e.rescueMissionId);
      this.model.notify('danger', 'Rescue target lost', 'The distressed crew was destroyed before recovery. The contract has failed.');
    }
    if (byPlayer) {
      this.kit.input.rumble(0.6, 160);
      s.kills += 1;
      if (e.legalTarget) {
        if (!e.namedTargetId) {
          s.credits += e.bounty;
          s.bountiesCollected = (s.bountiesCollected ?? 0) + e.bounty;
        }
        const owner = systemOwner(s.world, s.currentSystem);
        s.reputation[owner] = Math.min(100, s.reputation[owner] + 0.6);
        if (e.bounty > 0 && !e.namedTargetId) this.model.notify('good', 'Bounty confirmed', `+${e.bounty.toLocaleString()} cr \xB7 ${e.label}`);
      } else {
        const witnessed = dist(e.root.position, this.station.position) < 48 || this.entities.some((n) => n.id !== e.id && !n.destroyed && dist(n.root.position, e.root.position) < 24);
        this.commitCrime(e.role === 'security' ? 36 : 24, e.role === 'security' ? 'Security ship destroyed' : 'Civilian vessel destroyed', witnessed, e.faction);
      }
      if (e.namedTargetId) this.model.resolveNamedTarget(e.namedTargetId, false);
      else this.model.recordGameEvent({ kind: 'kill', system: s.currentSystem, targetId: e.id, targetRole: e.role, targetFaction: e.faction, legalTarget: e.legalTarget });
    }
    if (e.role === 'trader' || e.role === 'courier') {
      this.model.applyMarketShock(s.currentSystem, e.cargo, 0.16);
      this.eventLabel = `${commodityById(e.cargo).name} shipments disrupted; regional prices are reacting`;
    } else if (e.role === 'pirate' && byPlayer) {
      this.model.applyMarketShock(s.currentSystem, e.cargo, -0.025);
    }
    const at = e.root.position.clone();
    // Your own drones and wing leave no loot behind (losing one should not pay).
    if (!e.friendly) {
      this.spawnPickup(at.clone().add(new THREE.Vector3(-0.45, 0, -0.2)), 'credits', Math.round(35 + Math.random() * 90));
      if (Math.random() > 0.35) this.spawnPickup(at.clone().add(new THREE.Vector3(0.65, 0, 0.25)), 'cargo', 1, e.cargo, !e.legalTarget);
      if (Math.random() > 0.52) this.spawnPickup(at.clone().add(new THREE.Vector3(0, 0, -0.75)), 'salvage', 1);
    }
    if (this.targetId === e.id) {
      this.targetId = null;
      this.setTargetHalo(null);
    }
    e.root.removeFromParent();
  }

  playerDestroyed() {
    const s = this.model.state;
    this.spawnHitParticles(this.player.position, '#ff6d73', s.settings.reducedMotion ? 10 : 30);
    this.sfx?.explode(1.8);
    const deductible = Math.round(Math.min(650, Math.round(s.credits * 0.08)) * difficultyOf(s).deductible);
    s.credits = Math.max(0, s.credits - deductible);
    for (const k of Object.keys(s.cargo)) s.cargo[k] = Math.floor((s.cargo[k] ?? 0) * 0.75);
    // Stolen tags cannot outnumber the cargo that survived.
    for (const k of Object.keys(s.stolenCargo)) s.stolenCargo[k] = Math.min(s.stolenCargo[k] ?? 0, s.cargo[k] ?? 0);
    const stats = shipStats(s);
    s.hull = stats.hull;
    s.armor = stats.armor;
    s.shield = stats.shield;
    s.energy = stats.energy;
    s.weaponHeat = 0;
    this.player.position.copy(P(-9, PLANE_Y, 8));
    this.playerVelocity.set(0, 0, 0);
    this.cameraTarget.set(this.player.position.x, 0.2, this.player.position.z);
    // The recovery tug drops you beside the station: incoming fire is wiped and you get a
    // few seconds of grace instead of being shot again before the ship has even appeared.
    for (const p of this.projectiles) if (p.owner !== 'player') p.life = -1;
    this.graceUntil = this.simulationTime + 3.5;
    this.lastPlayerHit = this.simulationTime;
    this.kit.input.rumble(1, 400);
    this.sfx?.respawn();
    this.model.notify('danger', 'Insurance recovery complete', `${deductible.toLocaleString()} cr deductible \xB7 some cargo was lost`);
    this.model.save(true);
  }

  /** Play a positional sound: gain falls off with distance, pan follows the screen. */
  playAt(position, play, range = 30) {
    if (!this.sfx) return;
    const dx = position.x - this.player.position.x;
    const dz = position.z - this.player.position.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return;
    // Screen-right on this camera is (1, 0, -1)/√2 on the plane.
    play(1 - d / range, clamp(((dx - dz) * Math.SQRT1_2) / 22, -0.9, 0.9));
  }

  /* ---------------------------------------------------------- AI */

  updateEntities(dt) {
    const s = this.model.state;
    const heat = s.jurisdictionHeat[s.currentSystem] ?? 0;
    const fireScale = difficultyOf(s).enemyFire;
    for (const e of this.entities) {
      if (e.destroyed) continue;
      e.aiCooldown -= dt;
      e.fireCooldown -= dt;
      e.scanCooldown -= dt;
      if (this.simulationTime - e.damagedAt > 4) e.shield = Math.min(e.maxShield, e.shield + 3.2 * dt);
      if (e.role === 'security' && heat >= 18) e.hostileToPlayer = true;
      if (e.role === 'warden') {
        this.updateWarden(e, dt, fireScale);
        continue;
      }
      const pos = e.root.position;
      if (e.disabled) {
        e.velocity.multiplyScalar(Math.pow(0.08, dt));
        pos.addScaledVector(e.velocity, dt);
        continue;
      }
      if (e.role === 'security' && !e.hostileToPlayer && e.scanCooldown <= 0 && dist(pos, this.player.position) < 9.5) {
        e.scanCooldown = 32;
        this.eventLabel = `${e.label} is performing a cargo scan`;
        if (this.model.resolveContrabandScan()) e.hostileToPlayer = true;
      }
      let goal = null;
      let foe = null;
      if ((e.role === 'escort' || e.role === 'drone') && e.label.startsWith('VR ')) {
        foe = this.entities.find((o) => !o.destroyed && o.hostileToPlayer && dist(o.root.position, this.player.position) < 26) ?? null;
        goal = foe?.root.position ?? this.player.position.clone().add(new THREE.Vector3(-4, 0, 4));
      } else if (e.hostileToPlayer) {
        goal = this.player.position;
      } else {
        const enemies = FACTIONS[e.faction].enemies;
        foe =
          this.entities.find((l) =>
            l.destroyed || l.id === e.id || dist(l.root.position, pos) >= 22
              ? false
              : e.role === 'pirate'
                ? l.faction !== 'freewake' && ['trader', 'courier', 'miner', 'security', 'escort'].includes(l.role)
                : ['mercenary', 'bomber'].includes(e.role)
                  ? enemies.includes(l.faction)
                  : l.faction === 'freewake' && l.role === 'pirate'
          ) ?? null;
        if (foe) goal = foe.root.position;
      }
      if (goal) {
        const to = this.tmp.subVectors(goal, pos);
        to.y = 0;
        const d = to.length();
        const dir = d > 0.01 ? to.multiplyScalar(1 / d) : to.set(0, 0, 0);
        const keep = e.tactic === 'flee' ? 22 : e.tactic === 'kite' ? 14 : e.tactic === 'broadside' ? 17 : e.tactic === 'rush' ? 5.5 : e.tactic === 'escort' ? 8 : 9;
        const orbit = e.tactic === 'circle' || e.tactic === 'broadside' ? 0.72 : 0.34;
        // Same orbit handedness as the original (its sideways vector, mirrored with the world).
        const side = this.side.set(-dir.z, 0, dir.x).multiplyScalar(e.id.charCodeAt(e.id.length - 1) % 2 ? orbit : -orbit);
        const approach = this.approach.copy(dir);
        if (e.tactic === 'flee') approach.multiplyScalar(-1);
        else if (d > keep + 2) approach.multiplyScalar(1);
        else if (d < keep - 2) approach.multiplyScalar(e.tactic === 'rush' ? 0.2 : -0.7);
        else approach.set(0, 0, 0);
        const want = approach.add(side);
        if (want.lengthSq() > 0) want.normalize();
        want.multiplyScalar(e.speed * (e.tactic === 'rush' ? 1.15 : 1));
        e.velocity.lerp(want, clamp(dt * 1.9, 0, 1));
        e.root.rotation.set(0, Math.atan2(dir.x, dir.z), 0);
        const w = WEAPONS[e.weapon];
        if (d < w.range * 0.72 && e.fireCooldown <= 0 && !['trader', 'miner', 'courier', 'smuggler'].includes(e.role)) {
          // Difficulty sets how fast anything shooting at you fires.
          e.fireCooldown = w.fireRate * (0.9 + Math.random() * 0.35) * (e.hostileToPlayer ? fireScale : 1);
          const aim = this.want.copy(dir);
          aim.x += (Math.random() - 0.5) * 0.08;
          aim.z += (Math.random() - 0.5) * 0.08;
          aim.normalize();
          const muzzle = this.tmp2.copy(pos).addScaledVector(aim, 1.1);
          muzzle.y += 0.25;
          const shot = this.spawnProjectile(muzzle, aim.multiplyScalar(w.speed), w.damage * (e.role === 'bountyHunter' ? 1.15 : 0.72), e.id, e.faction, w.color, w.range / w.speed, w.splash, w);
          if (e.friendly) shot.friendly = true;
          if (w.tracking > 0) shot.homingTarget = foe?.id ?? (e.hostileToPlayer ? 'player' : undefined);
          this.playAt(pos, (gain, pan) => this.sfx?.shot(w.id, { npc: true, gain, pan }), 28);
        }
      } else {
        if (dist(pos, e.goal) < 3 || e.aiCooldown <= 0) {
          e.aiCooldown = 3 + Math.random() * 4;
          const rnd = seeded(`${e.id}:${Math.floor(this.simulationTime / 4)}`);
          const dest =
            e.role === 'miner' && this.asteroids.length > 0
              ? this.asteroids[Math.floor(rnd() * this.asteroids.length)].mesh.position
              : e.role === 'trader' && rnd() > 0.5
                ? this.station.position.clone().add(new THREE.Vector3(7, PLANE_Y, 0))
                : null;
          e.goal = dest?.clone() ?? P((rnd() - 0.5) * 68, PLANE_Y, (rnd() - 0.5) * 68);
        }
        const to = this.tmp.subVectors(e.goal, pos);
        to.y = 0;
        if (to.lengthSq() > 1) to.normalize();
        const hurt = e.hull < e.maxHull * 0.3 && ['trader', 'miner', 'courier'].includes(e.role);
        if (to.lengthSq() > 0.01) e.root.rotation.set(0, Math.atan2(to.x, to.z), 0);
        e.velocity.lerp(to.multiplyScalar(e.speed * (hurt ? 1.25 : 0.55)), clamp(dt * 0.8, 0, 1));
      }
      pos.addScaledVector(e.velocity, dt);
      pos.y = PLANE_Y;
      if (Math.abs(pos.x) > 78 || Math.abs(pos.z) > 78) {
        pos.x *= -0.82;
        pos.z *= -0.82;
      }
    }
    for (let i = this.entities.length - 1; i >= 0; i -= 1) if (this.entities[i].destroyed) this.entities.splice(i, 1);
  }

  /* ---------------------------------------------------------- pickups & particles */

  spawnPickup(position, kind, amount, commodity, stolen = false) {
    const geo = kind === 'credits' ? this.geometry('pickup-credits', () => polyhedron(1, 0.42)) : this.geometry('pickup-box', () => new THREE.BoxGeometry(0.62, 0.62, 0.62));
    const hex = kind === 'credits' ? '#ffd65b' : kind === 'ore' ? '#ff9e68' : kind === 'salvage' ? '#68e6ff' : commodity && commodityById(commodity).illegal ? '#db74ff' : '#85f5b7';
    const mesh = new THREE.Mesh(geo, this.emissive(hex, 1.15, true));
    mesh.position.copy(position);
    mesh.position.y = 0.48;
    this.world.add(mesh);
    this.pickups.push({
      id: ++this.pickupCounter,
      mesh,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.8, 0, (Math.random() - 0.5) * 1.8),
      kind,
      amount,
      commodity,
      stolen,
      life: 50,
    });
  }

  updatePickups(dt) {
    const drag = Math.pow(0.3, dt);
    for (const t of this.pickups) {
      t.life -= dt;
      t.mesh.rotation.y += dt * 2.4;
      t.mesh.position.addScaledVector(t.velocity, dt);
      t.velocity.multiplyScalar(drag);
      t.mesh.position.y = 0.52 + Math.sin(this.simulationTime * 3 + t.id) * 0.12;
      const d = dist(t.mesh.position, this.player.position);
      if (d < 4) {
        const pull = this.tmp.subVectors(this.player.position, t.mesh.position).normalize().multiplyScalar((4 - d) * 4 * dt);
        t.mesh.position.add(pull);
      }
      if (d < 1.2) this.collectPickup(t);
    }
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      if (this.pickups[i].life <= 0) {
        this.pickups[i].mesh.removeFromParent();
        this.pickups.splice(i, 1);
      }
    }
  }

  collectPickup(p) {
    const s = this.model.state;
    // Ore and salvage (alloys) weigh 2 per unit: check the real mass, not the unit count,
    // or a nearly full hold could be pushed past its capacity.
    const commodity = p.kind === 'ore' ? 'ore' : p.kind === 'salvage' ? 'alloys' : p.commodity;
    const mass = p.kind === 'credits' ? 0 : p.amount * (commodityById(commodity)?.mass ?? 1);
    if (p.kind !== 'credits' && cargoMass(s) + mass > cargoCapacity(s)) {
      if (p.life > 3) this.model.notify('warn', 'Cargo hold full', 'Make room to collect nearby salvage.');
      p.life = Math.min(p.life, 3);
      return;
    }
    if (p.kind === 'credits') s.credits += p.amount;
    if (p.kind === 'ore') {
      s.cargo.ore = (s.cargo.ore ?? 0) + p.amount;
      s.mined += p.amount;
      this.model.advanceMission('mine', p.amount);
    }
    if (p.kind === 'salvage') {
      s.salvaged += p.amount;
      s.cargo.alloys = (s.cargo.alloys ?? 0) + p.amount;
      this.model.advanceMission('salvage', p.amount);
    }
    if (p.kind === 'cargo' && p.commodity) {
      s.cargo[p.commodity] = (s.cargo[p.commodity] ?? 0) + p.amount;
      if (p.stolen) s.stolenCargo[p.commodity] = (s.stolenCargo[p.commodity] ?? 0) + p.amount;
    }
    this.spawnHitParticles(p.mesh.position, p.kind === 'credits' ? '#ffd65b' : '#76f2c2', 5);
    this.sfx?.pickup(p.kind);
    p.life = -1;
  }

  spawnParticle(position, hex, size, velocity) {
    this.sparks.spawn(position, linShared(hex), size, velocity);
  }

  spawnHitParticles(position, hex, count) {
    const color = linShared(hex);
    for (let i = 0; i < count; i += 1) this.sparks.spawn(position, color, 0.08 + Math.random() * 0.17);
  }

  /* ---------------------------------------------------------- camera & law */

  updateCamera(dt) {
    const unit = (this.camera.top - this.camera.bottom) / Math.max(1, this.viewHeight || 720);
    const snap = (v) => Math.round(v / unit) * unit;
    const want = this.tmp.set(this.player.position.x, 0.2, this.player.position.z);
    if (this.cameraKick > 0.001) {
      want.x += (Math.random() - 0.5) * this.cameraKick;
      want.z += (Math.random() - 0.5) * this.cameraKick;
      this.cameraKick *= Math.pow(0.025, dt);
    }
    if (this.model.state.settings.reducedMotion || dt === 0) this.cameraTarget.copy(want);
    else this.cameraTarget.lerp(want, clamp(dt * 5.5, 0, 1));
    const t = this.tmp2.set(snap(this.cameraTarget.x), 0.2, snap(this.cameraTarget.z));
    this.camera.position.copy(t).add(CAM_OFFSET);
    this.camera.lookAt(t);
    this.sun.target.position.copy(t);
    this.sun.position.copy(t).addScaledVector(SUN_DIR, -70);
  }

  updateLaw(dt) {
    const s = this.model.state;
    const here = s.currentSystem;
    const heat = s.jurisdictionHeat[here] ?? 0;
    if (heat > 0 && !this.isInCombat()) s.jurisdictionHeat[here] = Math.max(0, heat - dt * 0.18);
    const tier = heatTier(heat);
    const hunters = this.entities.filter((o) => ['security', 'mercenary', 'bomber'].includes(o.role) && o.hostileToPlayer && !o.destroyed).length;
    const wanted = [0, 0, 1, 3, 5, 7, 10][tier];
    if (hunters < wanted && Math.random() < dt * (0.12 + tier * 0.045)) {
      const a = Math.random() * Math.PI * 2;
      const role = tier >= 6 && hunters % 3 === 0 ? 'bomber' : tier >= 5 && hunters % 2 === 0 ? 'mercenary' : 'security';
      const e = this.spawnEntity(role, systemOwner(s.world, here), this.player.position.clone().add(new THREE.Vector3(Math.sin(a) * 25, 0, Math.cos(a) * 25)));
      e.hostileToPlayer = true;
      e.legalTarget = false;
      e.label = tier >= 6 ? `Military Interdiction ${hunters + 1}` : tier >= 5 ? `Elite Pursuit ${hunters + 1}` : e.label;
      this.eventLabel = tier >= 6 ? 'Military interdiction wings are sealing the local grid' : 'Security reinforcements entering the local grid';
    }
  }

  commitCrime(severity, type, witnessed = true, faction) {
    this.model.registerCrime(type, severity, witnessed, faction);
    this.eventLabel = witnessed ? 'An evidence uplink has alerted local authorities' : 'No surviving witness reached the evidence network';
  }

  /** Offset from the player, given in the original's (x, z) terms. */
  near(x, z, from = this.player.position) {
    return from.clone().add(new THREE.Vector3(x, 0, -z));
  }

  spawnDynamicOpportunity() {
    const sys = systemById(this.model.state.currentSystem);
    const owner = systemOwner(this.model.state.world, sys.id);
    const live = this.model.state.world.systems[sys.id];
    const r = Math.random();
    this.eventTimer = 22 + Math.random() * 18;
    if (r < 0.2) {
      const victim = this.spawnEntity('trader', owner, this.near(22, -16));
      this.spawnEntity('pirate', 'freewake', this.near(5, 7, victim.root.position));
      this.spawnEntity('pirate', 'freewake', this.near(-6, 4, victim.root.position));
      this.eventLabel = `Distress call: ${victim.label} is under attack`;
      this.model.notify('warn', 'Distress signal nearby', 'Intervene, salvage the aftermath, or exploit the confusion.');
    } else if (r < 0.36) {
      for (let n = 0; n < 3; n += 1) this.spawnPickup(this.near(10 + Math.random() * 6, (Math.random() - 0.5) * 9), 'cargo', 1, COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)].id, true);
      this.eventLabel = 'Unclaimed cargo tumbling off the trade lane';
      this.model.notify('info', 'Cargo spill detected', 'Its registry marks it as stolen; fencing it may be profitable or dangerous.');
    } else if (r < 0.5) {
      const boss = this.spawnEntity('pirate', 'freewake', this.near(-21, 15));
      boss.bounty += 360;
      boss.label = ['Brass Comet Varo', 'Auntie Hex', 'Major Sol'][Math.floor(Math.random() * 3)];
      boss.legalTarget = true;
      this.eventLabel = `Named bounty sighted: ${boss.label}`;
      this.model.notify('warn', 'High-value target entered the system', `${boss.label} \xB7 ${boss.bounty.toLocaleString()} cr bounty`);
    } else if (r < 0.65) {
      for (let n = 0; n < 2; n += 1) this.spawnEntity('security', owner, this.near(19 + n * 2, 18 - n * 4));
      for (let n = 0; n < 3; n += 1) this.spawnEntity('pirate', 'freewake', this.near(25 + n * 2, 12 - n * 3));
      this.eventLabel = `${FACTIONS[owner].short} forces are skirmishing with Freewake raiders`;
      this.model.notify('info', 'Faction skirmish', 'Choose a side, take the salvage, or keep moving.');
    } else if (r < 0.76) {
      const smuggler = this.spawnEntity('smuggler', 'freewake', this.near(-16, -17));
      const contraband = COMMODITIES.filter((c) => c.illegal);
      smuggler.cargo = contraband[Math.floor(Math.random() * contraband.length)].id;
      this.eventLabel = `${smuggler.label} is broadcasting a one-time encrypted deal`;
      this.model.notify('info', 'Smuggler rendezvous', 'Scan the contact for cargo intelligence, protect the exchange, or tip off security.');
    } else if (r < 0.87) {
      for (let n = 0; n < (live.hazard > 0.55 ? 3 : 2); n += 1) {
        const rock = this.asteroids[Math.floor(Math.random() * Math.max(1, this.asteroids.length))];
        if (rock) rock.rich = true;
      }
      this.eventLabel = 'Survey telemetry indicates a temporary high-yield resource strike';
      this.model.notify('good', 'Resource strike', 'Rare mineral signatures have surfaced inside the local field.');
    } else if (r < 0.95) {
      const runner = this.spawnEntity('courier', owner, this.near(18, 12));
      const cop = this.spawnEntity('security', owner, this.near(-6, -5, runner.root.position));
      cop.hostileToPlayer = false;
      runner.hostileToPlayer = false;
      this.eventLabel = `Police pursuit: ${runner.label} is fleeing an inspection cordon`;
      this.model.notify('warn', 'Chase crossing your route', 'Intervene, assist the fugitive, or let the jurisdiction handle it.');
    } else {
      const c = COMMODITIES[Math.floor(Math.random() * COMMODITIES.length)].id;
      this.model.applyMarketShock(sys.id, c, -0.22);
      this.eventLabel = 'A short-lived market is broadcasting bargain prices';
      this.model.notify('good', 'Temporary market', `${commodityById(c).name} has briefly flooded the local exchange.`);
    }
  }

  applyEnvironmentHazard() {
    const s = this.model.state;
    const sys = systemById(s.currentSystem);
    const hazard = s.world.systems[sys.id].hazard;
    this.hazardTimer = Math.max(9, 24 - hazard * 12) + Math.random() * 8;
    if (hazard < 0.58 || dist(this.player.position, this.station.position) < 9) return;
    if (['veil', 'echo', 'null'].includes(sys.id)) {
      const lost = 12 + hazard * 14;
      s.energy = Math.max(0, s.energy - lost);
      s.shield = Math.max(0, s.shield - 4 * hazard);
      this.spawnHitParticles(this.player.position, sys.palette[2], s.settings.reducedMotion ? 4 : 11);
      this.eventLabel = 'Anomaly weather is disrupting reactor and shield coherence';
      this.model.notify('warn', 'Anomaly surge', `${Math.round(lost)} reactor energy lost. Stations and survey equipment provide safer cover.`);
    } else {
      this.playerVelocity.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8));
      s.armor = Math.max(0, s.armor - 3 * hazard);
      this.spawnHitParticles(this.player.position, '#ffb166', s.settings.reducedMotion ? 4 : 9);
      this.eventLabel = 'A debris front has crossed the flight plane';
      this.model.notify('warn', 'Environmental hazard', 'Debris impact altered your vector and abraded armor.');
    }
  }

  /* ---------------------------------------------------------- actions */

  cycleTarget(step) {
    // Your own drones and wing are not targets.
    const nearby = this.entities
      .filter((n) => !n.destroyed && !n.friendly && dist(n.root.position, this.player.position) < 45)
      .sort((a, b) => dist(a.root.position, this.player.position) - dist(b.root.position, this.player.position));
    if (nearby.length === 0) {
      this.targetId = null;
      this.setTargetHalo(null);
      this.sfx?.deny();
      return;
    }
    const i = nearby.findIndex((n) => n.id === this.targetId);
    const next = nearby[(i + step + nearby.length) % nearby.length];
    this.targetId = next.id;
    this.setTargetHalo(next);
    this.sfx?.lock();
  }

  scanTarget() {
    const s = this.model.state;
    const anomaly = this.anomalies.filter((a) => !a.scanned).sort((a, b) => dist(a.mesh.position, this.player.position) - dist(b.mesh.position, this.player.position))[0];
    if (anomaly && dist(anomaly.mesh.position, this.player.position) < 7.5) {
      if (this.scanPulseCooldown > 0) return;
      this.scanPulseCooldown = 1.2;
      anomaly.scanned = true;
      anomaly.mesh.material = this.emissive('#8affc7', 0.82, true);
      this.sfx?.scan();
      this.model.discover(anomaly.id, s.currentSystem);
      this.spawnHitParticles(anomaly.mesh.position, '#8affc7', s.settings.reducedMotion ? 5 : 14);
      this.eventLabel = `${anomaly.label} has been resolved and added to your navigation archive`;
      return;
    }
    const t = this.entities.find((e) => e.id === this.targetId && !e.destroyed);
    if (!t) {
      this.model.notify('info', 'No scan subject', 'Lock a contact first, or approach an anomaly within 7.5 km.');
      this.sfx?.deny();
      return;
    }
    this.sfx?.scan();
    this.model.recordGameEvent({ kind: 'scan', system: s.currentSystem, targetId: t.namedTargetId ?? t.id, targetRole: t.role, targetFaction: t.faction, legalTarget: t.legalTarget });
    this.model.notify(
      'info',
      `Scan: ${t.label}`,
      `${t.factionLabel ?? FACTIONS[t.faction].name} \xB7 ${t.role} \xB7 ${t.tactic} doctrine \xB7 ${commodityById(t.cargo).name} cargo${t.bounty ? ` \xB7 ${t.bounty.toLocaleString()} cr bounty` : ''}${t.disabled ? ' \xB7 DRIVE DISABLED' : ''}`
    );
  }

  emergencyRepair() {
    const s = this.model.state;
    const stats = shipStats(s);
    if (!stats.repairDrones && !s.crew.includes('io')) {
      this.model.notify('warn', 'No emergency repair system', 'Install Patchwork Repair Drones or hire Io-7.');
      this.sfx?.deny();
      return;
    }
    if (this.emergencyRepairCooldown > 0 || s.energy < 35) {
      this.model.notify('warn', 'Repair system cycling', s.energy < 35 ? '35 reactor energy required.' : `${Math.ceil(this.emergencyRepairCooldown)} seconds until the drones are ready.`);
      this.sfx?.deny();
      return;
    }
    this.sfx?.repair();
    this.emergencyRepairCooldown = 24;
    s.energy -= 35;
    s.armor = Math.min(stats.armor, s.armor + stats.armor * 0.2);
    s.hull = Math.min(stats.hull, s.hull + stats.hull * 0.12);
    this.spawnHitParticles(this.player.position, '#8affc7', s.settings.reducedMotion ? 5 : 16);
    this.model.notify('good', 'Emergency repair deployed', 'Armor web and hull integrity restored. Drones are recharging.');
  }

  deployCountermeasure() {
    const s = this.model.state;
    const modules = s.installedModules[s.shipId] ?? [];
    if (!modules.includes('ecmSuite') && !modules.includes('pointDefense')) {
      this.model.notify('warn', 'No countermeasure system', 'Install a Veil ECM Suite or Firefly Point Defense.');
      this.sfx?.deny();
      return;
    }
    if (s.energy < 18) {
      this.sfx?.deny();
      return;
    }
    s.energy -= 18;
    this.sfx?.ecm();
    let broken = 0;
    for (const p of this.projectiles) {
      if (p.owner === 'player' || dist(p.position, this.player.position) > 11) continue;
      if (p.homingTarget === 'player' || p.splash > 0) {
        p.homingTarget = undefined;
        p.velocity.applyAxisAngle(THREE.Object3D.DEFAULT_UP, (Math.random() - 0.5) * 1.5);
        broken += 1;
      }
    }
    this.spawnHitParticles(this.player.position, '#8aa8ff', s.settings.reducedMotion ? 4 : 12);
    this.model.notify(broken ? 'good' : 'info', 'Countermeasure burst', broken ? `${broken} guidance solution${broken === 1 ? '' : 's'} broken.` : 'No locked ordnance was inside the disruption field.');
  }

  interact() {
    const s = this.model.state;
    if (dist(this.player.position, this.station.position) < 7.4) {
      if (this.playerVelocity.length() > 8) {
        this.model.notify('warn', 'Approach too fast', 'Reduce speed below 8 to dock safely.');
        this.sfx?.deny();
        return;
      }
      const owner = systemOwner(s.world, s.currentSystem);
      if (owner !== 'freewake' && s.reputation[owner] <= -60) {
        if (s.forgedIdCharges > 0) {
          s.forgedIdCharges -= 1;
          this.model.notify('good', 'Forged docking identity accepted', `${FACTIONS[owner].short} traffic control logged your ship under an alias.`);
        } else {
          this.model.notify('danger', 'Docking rights revoked', `${FACTIONS[owner].name} considers you ${reputationLabel(s.reputation[owner])}. Forge an identity or use another jurisdiction.`);
          return;
        }
      }
      this.playerVelocity.set(0, 0, 0);
      this.model.resolveDockMissions();
      s.hull = Math.min(shipStats(s).hull, s.hull + 12);
      this.model.save(true);
      this.sfx?.dock();
      this.callbacks.onDock();
      return;
    }
    if (this.nearbyDisabled && dist(this.player.position, this.nearbyDisabled.root.position) < 4.5) {
      this.boardEntity(this.nearbyDisabled);
      return;
    }
    if (this.nearbyAnomaly && dist(this.player.position, this.nearbyAnomaly.mesh.position) < 7.5) {
      this.scanTarget();
      return;
    }
    const mark = this.entities.find((e) => e.id === this.targetId && !e.destroyed && !e.disabled && ['trader', 'courier', 'miner', 'smuggler'].includes(e.role) && dist(e.root.position, this.player.position) < 6.2);
    if (mark) {
      this.demandCargo(mark);
      return;
    }
    if (this.nearbyAsteroid && dist(this.player.position, this.nearbyAsteroid.mesh.position) < 5) {
      this.mineAsteroid(this.nearbyAsteroid);
      return;
    }
    const pickup = this.pickups.find((p) => dist(p.mesh.position, this.player.position) < 4);
    if (pickup) this.collectPickup(pickup);
  }

  demandCargo(e) {
    const s = this.model.state;
    const witnessed = dist(e.root.position, this.station.position) < 45 || this.entities.some((a) => a.id !== e.id && !a.destroyed && dist(a.root.position, e.root.position) < 18);
    this.commitCrime(8, 'Piracy and cargo extortion', witnessed, e.faction);
    const stats = shipStats(s);
    const mine = stats.hull + stats.armor + activeWeapon(s).damage * 5;
    const theirs = e.maxHull + e.maxArmor + e.maxShield + (e.role === 'smuggler' ? 80 : 0);
    const odds = clamp(0.42 + (mine - theirs) / 520 + s.reputation.freewake * 0.002, 0.18, 0.9);
    if (Math.random() <= odds) {
      const n = 1 + Math.floor(Math.random() * 3);
      for (let o = 0; o < n; o += 1) this.spawnPickup(this.near((o - 1) * 0.7, 0.6, e.root.position), 'cargo', 1, e.cargo, true);
      e.goal = this.near(8, 8, this.station.position);
      e.tactic = 'flee';
      this.model.applyMarketShock(s.currentSystem, e.cargo, 0.06);
      this.model.notify('warn', `${e.label} surrendered cargo`, `${n} ${commodityById(e.cargo).name} ejected with stolen registry tags.`);
      this.eventLabel = `${e.label} complied; its distress recorder may still draw attention`;
    } else {
      e.provoked = true;
      e.hostileToPlayer = true;
      const guard = this.spawnEntity('mercenary', e.faction, this.near(4, 4, e.root.position));
      guard.hostileToPlayer = true;
      guard.legalTarget = false;
      this.model.notify('danger', `${e.label} refused`, 'An armed escort has answered the distress call.');
      this.eventLabel = 'Cargo demand refused; armed response inbound';
    }
  }

  finishBoarding(e) {
    e.destroyed = true;
    if (this.targetId === e.id) this.targetId = null;
    this.setTargetHalo(null);
    this.spawnHitParticles(e.root.position, '#8affc7', this.model.state.settings.reducedMotion ? 5 : 14);
    e.root.removeFromParent();
    this.nearbyDisabled = null;
  }

  boardEntity(e) {
    const s = this.model.state;
    if (!e.disabled || e.destroyed) return;
    if (e.rescueMissionId) {
      this.model.recordGameEvent({ kind: 'rescue', system: s.currentSystem, targetId: e.rescueMissionId, targetRole: e.role, targetFaction: e.faction, legalTarget: true });
      s.skills.leadership += 2;
      this.model.notify('good', 'Survivors recovered', `${e.label} is secure aboard your ship.`);
      this.finishBoarding(e);
      return;
    }
    const modules = s.installedModules[s.shipId] ?? [];
    const crewBonus = s.crew.includes('tamsin') ? 0.35 : 0;
    const salvageBonus = modules.includes('salvageArray') ? 0.18 : 0;
    const odds = clamp(0.55 + crewBonus + salvageBonus - e.maxHull / 900, 0.38, 0.96);
    const legal = e.legalTarget;
    if (!legal) {
      const witnessed = dist(e.root.position, this.station.position) < 46 || this.entities.some((p) => p.id !== e.id && !p.destroyed && dist(p.root.position, e.root.position) < 22);
      this.commitCrime(22, 'Vessel hijacking', witnessed, e.faction);
    }
    if (Math.random() > odds) {
      e.disabled = false;
      e.hostileToPlayer = true;
      e.hull = Math.max(e.hull, e.maxHull * 0.24);
      s.hull = Math.max(1, s.hull - shipStats(s).hull * 0.08);
      this.model.notify('danger', 'Boarding repelled', `${e.label}'s crew restarted the drive and damaged your hull.`);
      return;
    }
    s.boarded += 1;
    s.skills.leadership += 2;
    const haul = 2 + Math.floor(Math.random() * 4);
    const room = Math.max(0, Math.floor((cargoCapacity(s) - cargoMass(s)) / commodityById(e.cargo).mass));
    const taken = Math.min(haul, room);
    if (taken > 0) {
      s.cargo[e.cargo] = (s.cargo[e.cargo] ?? 0) + taken;
      if (!legal) s.stolenCargo[e.cargo] = (s.stolenCargo[e.cargo] ?? 0) + taken;
    }
    const salvage = Math.round((120 + e.maxHull * 1.5) * shipStats(s).salvageMultiplier);
    s.credits += salvage;
    const hullFor = { courier: 'needle', trader: 'mule', miner: 'prospector', smuggler: 'wraith', pirate: 'corsair', bountyHunter: 'revenant', bomber: 'bulwark' }[e.role];
    const captured = hullFor && !s.ownedShips.includes(hullFor) && Math.random() < 0.22 + salvageBonus;
    if (captured && hullFor) this.model.captureShip(hullFor);
    if (e.namedTargetId) this.model.resolveNamedTarget(e.namedTargetId, true);
    else this.model.recordGameEvent({ kind: 'board', system: s.currentSystem, targetId: e.id, targetRole: e.role, targetFaction: e.faction, legalTarget: legal });
    this.model.notify('good', `${e.label} secured`, `${taken} cargo recovered \xB7 ${salvage.toLocaleString()} cr salvage${captured ? ' \xB7 hull captured' : ''}`);
    this.finishBoarding(e);
  }

  mineAsteroid(rock) {
    if (this.miningCooldown > 0) return;
    this.miningCooldown = 0.36;
    const s = this.model.state;
    const stats = shipStats(s);
    rock.hp -= (12 + s.upgrades.weapon * 2) * stats.miningMultiplier;
    this.spawnHitParticles(rock.mesh.position, rock.rich ? '#d980ff' : '#ff9e68', 6);
    this.sfx?.shot('miningLaser');
    if (rock.hp > 0) return;
    this.sfx?.explode(0.6, { gain: 0.6 });
    const ore = Math.max(1, Math.round((rock.rich ? 3 : 1) * stats.miningMultiplier));
    this.spawnPickup(rock.mesh.position.clone(), 'ore', ore);
    if (rock.rich && Math.random() > 0.45) this.spawnPickup(this.near(0.6, -0.4, rock.mesh.position), 'cargo', 1, 'artifacts');
    s.world.depletedDeposits = Array.from(new Set([...s.world.depletedDeposits, rock.id])).slice(-180);
    if (!s.acceptedMissions.some((m) => m.type === 'mining' && m.targetSystem === s.currentSystem) && systemSecurity(s.world, s.currentSystem) > 0.72) {
      const seen = dist(rock.mesh.position, this.station.position) < 40 || this.entities.some((a) => a.role === 'security' && !a.destroyed && dist(a.root.position, rock.mesh.position) < 20);
      this.commitCrime(4, 'Unlicensed resource extraction', seen);
    }
    rock.mesh.removeFromParent();
    this.asteroids = this.asteroids.filter((a) => a !== rock);
    this.nearbyAsteroid = null;
  }

  /* ---------------------------------------------------------- the Quiet Warden (story finale) */

  /**
   * In Null, once the fifth Signal in the Static scan is done and until it
   * falls, the Quiet Warden is here. Cheap enough to check every frame, so it
   * wakes the moment that scan completes.
   */
  maybeSpawnWarden() {
    const s = this.model.state;
    const story = s.world.story;
    if (this.warden || !this.player || s.currentSystem !== 'null' || (story.chapter ?? 0) < 5 || story.wardenDefeated) return;
    this.spawnWarden();
  }

  spawnWarden() {
    const s = this.model.state;
    const sys = systemById(s.currentSystem);
    const at = P(-30, PLANE_Y, 6);
    if (dist(at, this.player.position) < 18) {
      // Never on top of the ship that just woke it: rise on the far side, away from the station.
      const away = this.tmp.subVectors(this.player.position, this.station.position);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(-1, 0, 0);
      at.copy(this.player.position).addScaledVector(away.normalize(), 20);
      at.x = clamp(at.x, -66, 66);
      at.z = clamp(at.z, -66, 66);
    }
    // Built from the system's own anomaly materials, so it adds no new shaders.
    const root = new THREE.Group();
    root.name = 'quiet-warden';
    const core = this.cast(new THREE.Mesh(this.geometry('warden-core', () => flat(icosphere(1.15, 2))), this.emissive(sys.palette[2], 1.35, true)));
    const ringMat = this.emissive(sys.palette[1], 0.72);
    const ringA = new THREE.Mesh(this.geometry('warden-ring-a', () => torus({ diameter: 4.4, thickness: 0.16, tessellation: 40 })), ringMat);
    const ringB = new THREE.Mesh(this.geometry('warden-ring-b', () => torus({ diameter: 3.3, thickness: 0.12, tessellation: 32 })), ringMat);
    ringB.rotation.x = Math.PI / 2;
    const shards = new THREE.Group();
    const shardGeo = this.geometry('warden-shard', () => flat(polyhedron(1, 0.42)).scale(0.8, 2.2, 0.8));
    const shardMat = this.pbr(sys.palette[1], 0.82, 0.04);
    for (let i = 0; i < 6; i += 1) {
      const shard = this.cast(new THREE.Mesh(shardGeo, shardMat));
      const a = (i / 6) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 2.9, 0, Math.sin(a) * 2.9);
      shard.rotation.z = i % 2 ? 0.35 : -0.35;
      shards.add(shard);
    }
    root.add(core, ringA, ringB, shards);
    root.position.copy(at);
    root.position.y = 1.3;
    this.world.add(root);
    const e = {
      id: `ship-${++this.entityCounter}`,
      root,
      body: core,
      faction: 'choir',
      factionLabel: 'Quiet Star machine',
      sparkColor: sys.palette[2],
      role: 'warden',
      label: 'The Quiet Warden',
      velocity: new THREE.Vector3(),
      goal: at.clone(),
      hull: WARDEN.hull,
      maxHull: WARDEN.hull,
      armor: WARDEN.armor,
      maxArmor: WARDEN.armor,
      shield: WARDEN.shield,
      maxShield: WARDEN.shield,
      speed: WARDEN.speed,
      radius: WARDEN.radius,
      fireCooldown: 2.5,
      aiCooldown: 0,
      damagedAt: -100,
      hostileToPlayer: true,
      provoked: true,
      bounty: 0,
      cargo: 'artifacts',
      weapon: 'plasma',
      tactic: 'warden',
      legalTarget: true,
      disabled: false,
      scanCooldown: 999,
      destroyed: false,
      phase: 1,
      volleyTimer: 3.5,
      moteTimer: 6,
      lanceTimer: 4,
      spiral: 0,
      parts: { core, ringA, ringB, shards },
    };
    this.entities.push(e);
    this.warden = e;
    this.eventLabel = 'The Quiet Star is answering. Something vast is waking in the static.';
    this.model.notify('danger', 'The Quiet Warden has woken', 'An ancient machine guards the impossible route. Break its shield lattice, then destroy the core.');
    this.sfx?.warden('wake');
    this.kit.input.rumble(0.6, 500);
  }

  /** A mote: a small, fast shard the Warden sheds from its second phase on. */
  spawnMote(warden, index) {
    const sys = systemById(this.model.state.currentSystem);
    const root = new THREE.Group();
    const body = this.cast(new THREE.Mesh(this.geometry('mote-body', () => flat(polyhedron(1, 0.36))), this.emissive(sys.palette[2], 1.35, true)));
    const ring = new THREE.Mesh(this.geometry('mote-ring', () => torus({ diameter: 1.2, thickness: 0.08, tessellation: 16 })), this.emissive(sys.palette[1], 0.72));
    root.add(body, ring);
    const a = Math.random() * Math.PI * 2;
    root.position.set(warden.root.position.x + Math.sin(a) * 3.2, PLANE_Y, warden.root.position.z + Math.cos(a) * 3.2);
    this.world.add(root);
    const e = {
      id: `ship-${++this.entityCounter}`,
      root,
      body,
      faction: 'choir',
      factionLabel: 'Quiet Star machine',
      sparkColor: sys.palette[2],
      role: 'mote',
      label: `Warden mote ${index + 1}`,
      velocity: new THREE.Vector3(),
      goal: root.position.clone(),
      hull: 34,
      maxHull: 34,
      armor: 0,
      maxArmor: 0,
      shield: 26,
      maxShield: 26,
      speed: 11,
      radius: 0.7,
      fireCooldown: 1 + Math.random(),
      aiCooldown: 0,
      damagedAt: -100,
      hostileToPlayer: true,
      provoked: true,
      bounty: 0,
      cargo: 'scrap',
      weapon: 'ion',
      tactic: 'rush',
      legalTarget: true,
      disabled: false,
      scanCooldown: 999,
      destroyed: false,
    };
    this.entities.push(e);
    return e;
  }

  /** The Warden's own flight and attack patterns (three phases by remaining hull). */
  updateWarden(e, dt, fireScale) {
    const s = this.model.state;
    const pos = e.root.position;
    const frac = e.hull / e.maxHull;
    const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase > e.phase) {
      e.phase = phase;
      this.sfx?.warden('phase');
      this.kit.input.rumble(0.7, 320);
      if (s.settings.cameraShake && !s.settings.reducedMotion) this.cameraKick = Math.min(0.5, this.cameraKick + 0.3);
      this.spawnHitParticles(pos, e.sparkColor, s.settings.reducedMotion ? 8 : 22);
      if (phase === 2) {
        this.model.notify('warn', 'Warden lattice fracturing', 'It is calling motes out of the static. Keep moving.');
        this.eventLabel = 'The Warden is shedding motes into the local grid';
      } else {
        e.shield = 0;
        e.maxShield = 0;
        this.model.notify('warn', 'Warden core exposed', 'Its shield lattice is gone. The lances track your drive: use ECM or keep sliding.');
        this.eventLabel = 'The Warden core is exposed and unstable';
      }
    }

    // Hover at a stand-off distance and circle the player.
    const to = this.tmp.subVectors(this.player.position, pos);
    to.y = 0;
    const d = to.length();
    const dir = d > 0.01 ? to.multiplyScalar(1 / d) : to.set(0, 0, 1);
    const want = this.want.set(-dir.z, 0, dir.x).multiplyScalar(0.55);
    if (d > WARDEN.keep + 2) want.add(dir);
    else if (d < WARDEN.keep - 3) want.addScaledVector(dir, -0.6);
    if (want.lengthSq() > 0) want.normalize();
    want.multiplyScalar(e.speed * (phase === 3 ? 1.35 : 1));
    e.velocity.lerp(want, clamp(dt * 0.9, 0, 1));
    pos.addScaledVector(e.velocity, dt);
    const fromStation = dist(pos, this.station.position);
    if (fromStation < 7) {
      pos.x = this.station.position.x + ((pos.x - this.station.position.x) / Math.max(0.01, fromStation)) * 7;
      pos.z = this.station.position.z + ((pos.z - this.station.position.z) / Math.max(0.01, fromStation)) * 7;
    }
    pos.x = clamp(pos.x, -68, 68);
    pos.z = clamp(pos.z, -68, 68);
    pos.y = 1.3 + Math.sin(this.simulationTime * 1.3) * 0.18;
    if (d > 34) return;

    // Rings of slow bolts: dodge through the gaps. From phase two the rings turn into a spiral.
    e.volleyTimer -= dt;
    if (e.volleyTimer <= 0) {
      e.volleyTimer = (phase === 1 ? 3.4 : phase === 2 ? 2.8 : 2.2) * fireScale;
      const count = phase === 1 ? 12 : phase === 2 ? 16 : 18;
      if (phase > 1) e.spiral += 0.21;
      for (let i = 0; i < count; i += 1) {
        const a = e.spiral + (i / count) * Math.PI * 2;
        const v = this.approach.set(Math.sin(a), 0, Math.cos(a));
        const from = this.tmp2.copy(pos).addScaledVector(v, 2.4);
        from.y = 0.75;
        this.spawnProjectile(from, v.multiplyScalar(14), 9, e.id, e.faction, e.sparkColor, 40 / 14, 0, WARDEN_BOLT);
      }
      this.playAt(pos, (gain, pan) => this.sfx?.warden('volley', { gain, pan }), 45);
    }

    if (phase >= 2) {
      e.moteTimer -= dt;
      if (e.moteTimer <= 0) {
        e.moteTimer = 11 * fireScale;
        const alive = this.entities.filter((m) => m.role === 'mote' && !m.destroyed).length;
        for (let i = alive; i < Math.min(4, alive + 2); i += 1) this.spawnMote(e, i);
        this.playAt(pos, (gain, pan) => this.sfx?.warden('motes', { gain, pan }), 45);
      }
    }

    // The exposed core throws homing lances.
    if (phase === 3) {
      e.lanceTimer -= dt;
      if (e.lanceTimer <= 0) {
        e.lanceTimer = 4.2 * fireScale;
        const v = this.approach.subVectors(this.player.position, pos);
        v.y = 0;
        v.normalize();
        const from = this.tmp2.copy(pos).addScaledVector(v, 2.6);
        from.y = 0.8;
        const lance = this.spawnProjectile(from, v.multiplyScalar(20), 18, e.id, e.faction, '#ff7ad9', 46 / 20, 1.2, WARDEN_LANCE);
        lance.homingTarget = 'player';
        this.playAt(pos, (gain, pan) => this.sfx?.warden('lance', { gain, pan }), 45);
      }
    }
  }

  animateWarden(e, dt) {
    const p = e.parts;
    p.ringA.rotation.x += dt * 0.7;
    p.ringA.rotation.y += dt * 0.25;
    p.ringB.rotation.z += dt * 0.55;
    p.shards.rotation.y += dt * (e.phase === 3 ? 1.6 : 0.8);
    p.core.scale.setScalar(1 + Math.sin(this.simulationTime * (e.phase === 3 ? 7 : 3)) * 0.05);
  }

  wardenDestroyed(e) {
    const s = this.model.state;
    const at = e.root.position.clone();
    this.warden = null;
    this.spawnHitParticles(at, e.sparkColor, s.settings.reducedMotion ? 16 : 60);
    this.spawnHitParticles(at, '#ffffff', s.settings.reducedMotion ? 6 : 24);
    this.kit.input.rumble(1, 700);
    if (s.settings.cameraShake && !s.settings.reducedMotion) this.cameraKick = 0.6;
    s.kills += 1;
    // Its motes and its fire fall silent with it.
    for (const m of this.entities) {
      if (m.role !== 'mote' || m.destroyed) continue;
      m.destroyed = true;
      this.spawnHitParticles(m.root.position, m.sparkColor, 8);
      if (this.targetId === m.id) this.targetId = null;
      m.root.removeFromParent();
    }
    for (const p of this.projectiles) if (p.owner === e.id) p.life = -1;
    for (let i = 0; i < 4; i += 1) this.spawnPickup(this.near(Math.cos(i * 1.57) * 1.6, Math.sin(i * 1.57) * 1.6, at), 'credits', 300);
    this.spawnPickup(this.near(0.8, 0.8, at), 'cargo', 1, 'artifacts');
    this.spawnPickup(this.near(-0.8, -0.8, at), 'cargo', 1, 'electronics');
    this.spawnPickup(this.near(0, 1.4, at), 'salvage', 1);
    if (this.targetId === e.id || !this.targetId) {
      this.targetId = null;
      this.setTargetHalo(null);
    }
    e.root.removeFromParent();
    this.model.recordGameEvent({ kind: 'kill', system: s.currentSystem, targetId: e.id, targetRole: e.role, targetFaction: e.faction, legalTarget: true });
    this.model.wardenDefeated();
    this.model.notify('good', 'The Quiet Warden is silent', 'Its heart is still warm. Decide who receives the impossible route.');
    this.eventLabel = 'The Quiet Warden is silent. The route is yours to give.';
    // A moment to watch it fall (and sweep up the core) before the decision.
    this.storyChoiceTimer = 3;
  }

  /* ---------------------------------------------------------- radar */

  /** Plot a world position on the radar (the view's isometric orientation); false when out of range. */
  radarPlot(pos, keepAtEdge) {
    const R = 46;
    const k = R / 42;
    const dx = pos.x - this.player.position.x;
    const dz = pos.z - this.player.position.z;
    // Screen right is (1, 0, -1)/√2 on the plane and screen down is (1, 0, 1)/√2.
    let x = (dx - dz) * Math.SQRT1_2 * k;
    let y = (dx + dz) * Math.SQRT1_2 * k;
    const len = Math.hypot(x, y);
    const pt = this.radarPoint;
    pt.edge = len > R;
    if (pt.edge) {
      if (!keepAtEdge) return false;
      x *= R / len;
      y *= R / len;
    }
    pt.x = 51 + x;
    pt.y = 51 + y;
    return true;
  }

  /** The HUD radar: real contacts around the ship (it used to be three painted dots). */
  drawRadar() {
    const ctx = this.radarCtx;
    if (!ctx || !this.player || !this.radarCanvas.isConnected) return;
    const pt = this.radarPoint;
    const scale = this.radarCanvas.width / 102;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, 102, 102);
    // The station, pinned to the rim when it is out of range so you can always find home.
    if (this.radarPlot(this.station.position, true)) {
      ctx.globalAlpha = pt.edge ? 0.55 : 1;
      ctx.fillStyle = '#58e1ff';
      ctx.fillRect(pt.x - 3, pt.y - 3, 6, 6);
    }
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#d980ff';
    for (const a of this.anomalies) {
      if (a.scanned || !this.radarPlot(a.mesh.position, false)) continue;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - 3);
      ctx.lineTo(pt.x + 3, pt.y);
      ctx.lineTo(pt.x, pt.y + 3);
      ctx.lineTo(pt.x - 3, pt.y);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd65b';
    for (const p of this.pickups) if (this.radarPlot(p.mesh.position, false)) ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
    for (const e of this.entities) {
      if (e.destroyed) continue;
      const boss = e.role === 'warden';
      if (!this.radarPlot(e.root.position, boss)) continue;
      ctx.fillStyle = e.friendly ? '#8affc7' : e.disabled ? '#ffd477' : e.hostileToPlayer ? '#ff5c7a' : FACTIONS[e.faction].color;
      ctx.globalAlpha = e.hostileToPlayer || e.friendly || e.disabled ? 1 : 0.65;
      const r = boss ? 4 : e.role === 'mote' || e.role === 'drone' ? 1.4 : 2.1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.id === this.targetId) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------- HUD feed */

  emitView(force = false) {
    if (!this.player || (!force && !this.model.state.started)) return;
    const target = this.entities.find((c) => c.id === this.targetId && !c.destroyed);
    const toStation = dist(this.player.position, this.station.position);
    const closest = (list, range, pos, ok = () => true) => {
      let best = null;
      let bestD = range;
      for (const item of list) {
        if (!ok(item)) continue;
        const d = dist(pos(item), this.player.position);
        if (d <= bestD) {
          best = item;
          bestD = d;
        }
      }
      return best;
    };
    this.nearbyAsteroid = closest(this.asteroids, 5, (a) => a.mesh.position);
    this.nearbyAnomaly = closest(this.anomalies, 7.5, (a) => a.mesh.position, (a) => !a.scanned);
    this.nearbyDisabled = closest(this.entities, 4.5, (e) => e.root.position, (e) => e.disabled && !e.destroyed);
    const pickup = this.pickups.find((p) => dist(p.mesh.position, this.player.position) < 4);
    const mark = target && !target.disabled && ['trader', 'courier', 'miner', 'smuggler'].includes(target.role) && dist(target.root.position, this.player.position) < 6.2 ? target : null;
    let prompt = null;
    let promptKey = null;
    let nearbyLabel = null;
    if (toStation < 7.4) {
      prompt = this.playerVelocity.length() > 8 ? 'Slow down to dock' : `Dock at ${systemById(this.model.state.currentSystem).landmarks[0]}`;
      promptKey = 'E';
      nearbyLabel = 'STATION';
    } else if (this.nearbyDisabled) {
      prompt = `Board disabled ${this.nearbyDisabled.label}`;
      promptKey = 'E';
      nearbyLabel = 'DISABLED VESSEL';
    } else if (this.nearbyAnomaly) {
      prompt = `Scan ${this.nearbyAnomaly.label}`;
      promptKey = 'E / R';
      nearbyLabel = 'ANOMALY';
    } else if (mark) {
      prompt = `Demand cargo from ${mark.label}`;
      promptKey = 'E';
      nearbyLabel = 'PIRACY ACTION';
    } else if (this.nearbyAsteroid) {
      prompt = this.nearbyAsteroid.rich ? 'Mine rare deposit' : 'Mine asteroid';
      promptKey = 'E';
      nearbyLabel = this.nearbyAsteroid.rich ? 'RICH DEPOSIT' : 'ORE NODE';
    } else if (pickup) {
      prompt = 'Collect salvage';
      promptKey = 'E';
      nearbyLabel = 'SALVAGE';
    }
    this.updateTouchLabel(nearbyLabel);
    const view = {
      ready: true,
      renderer: this.renderer,
      fps: window.__kit?.fps ?? 0,
      speed: this.playerVelocity.length(),
      aimAngle: this.aimAngle,
      target: target
        ? {
            id: target.id,
            name: target.label,
            faction: target.factionLabel ?? FACTIONS[target.faction].name,
            relation: target.hostileToPlayer ? 'HOSTILE' : target.provoked ? 'AGGRIEVED' : 'NEUTRAL',
            shield: target.shield,
            maxShield: target.maxShield,
            armor: target.armor,
            maxArmor: target.maxArmor,
            hull: target.hull,
            maxHull: target.maxHull,
            distance: dist(target.root.position, this.player.position),
            bounty: target.bounty,
            role: target.role,
            threat: Math.round((target.maxHull + target.maxArmor + target.maxShield) / 55 + WEAPONS[target.weapon].damage / 9),
            disabled: target.disabled,
          }
        : null,
      prompt,
      promptKey,
      enemies: this.entities.filter((c) => c.hostileToPlayer && !c.destroyed && dist(c.root.position, this.player.position) < 28).length,
      inCombat: this.isInCombat(),
      stationDistance: toStation,
      // Shown in the original's (x, z) terms.
      coordinates: [Math.round(this.player.position.x), Math.round(-this.player.position.z) + 0],
      nearbyLabel,
      eventLabel: this.eventLabel,
      boss:
        this.warden && !this.warden.destroyed && dist(this.warden.root.position, this.player.position) < 60
          ? {
              name: this.warden.label,
              phase: this.warden.phase,
              shield: this.warden.shield,
              maxShield: this.warden.maxShield,
              armor: this.warden.armor,
              maxArmor: this.warden.maxArmor,
              hull: this.warden.hull,
              maxHull: this.warden.maxHull,
            }
          : null,
      grace: this.simulationTime < this.graceUntil,
    };
    this.lastView = view;
    this.callbacks.onView(view);
  }

  /** The touch "Use" button says what it will do. */
  updateTouchLabel(nearby) {
    const label =
      { STATION: 'Dock', 'DISABLED VESSEL': 'Board', ANOMALY: 'Scan', 'PIRACY ACTION': 'Demand', 'ORE NODE': 'Mine', 'RICH DEPOSIT': 'Mine', SALVAGE: 'Collect' }[nearby] ?? 'Use';
    if (label !== this.touchLabel) {
      this.touchLabel = label;
      this.kit.touch?.setLabel('interact', label);
    }
  }

  isInCombat() {
    return this.entities.some((e) => e.hostileToPlayer && !e.destroyed && dist(e.root.position, this.player.position) < 24);
  }

  /* ---------------------------------------------------------- UI hooks */

  targetNearest() {
    this.cycleTarget(1);
  }

  scan() {
    this.scanTarget();
  }

  dockFromUi() {
    this.interact();
  }

  jumpTo(systemId) {
    const s = this.model.state;
    const from = systemById(s.currentSystem);
    const secret = s.world.story.signalDecoded && [['null', 'zenith'], ['zenith', 'null']].some(([a, b]) => from.id === a && systemId === b);
    if (!from.links.includes(systemId) && !secret) {
      this.model.notify('warn', 'Route unavailable', 'Travel through a linked system first.');
      return false;
    }
    if (this.isInCombat()) {
      this.model.notify('warn', 'Jump drive disrupted', 'Break contact before entering the gate corridor.');
      this.sfx?.deny();
      return false;
    }
    this.sfx?.jump();
    const oldOwner = systemOwner(s.world, from.id);
    s.currentSystem = systemId;
    s.knownSystems = Array.from(new Set([...s.knownSystems, systemId, ...systemById(systemId).links]));
    s.visitedSystems = Array.from(new Set([...s.visitedSystems, systemId]));
    for (const [id, heat] of Object.entries(s.jurisdictionHeat)) s.jurisdictionHeat[id] = Math.max(0, heat - (id === systemId ? 0 : 3));
    this.model.tickMarket();
    this.model.advanceMission('visit');
    this.model.notify('good', `Jump complete: ${systemById(systemId).name}`, `${secret ? 'IMPOSSIBLE ROUTE \xB7 ' : ''}${systemById(systemId).economy} \xB7 ${systemById(systemId).danger} risk`);
    const newOwner = systemOwner(s.world, systemId);
    if (oldOwner !== newOwner && s.reputation[newOwner] < -25) this.model.notify('warn', 'Hostile jurisdiction', `${FACTIONS[newOwner].name} recognizes your ship ID.`);
    this.buildScene();
    this.model.save(true);
    this.model.changed();
    return true;
  }

  /** Rebuild after a new career, a loaded save or a ship change, keeping the ship where it was. */
  refreshShipVisual(keepPosition = true) {
    const at = keepPosition && this.player ? this.player.position.clone() : null;
    this.buildScene();
    if (at) {
      this.player.position.copy(at);
      this.cameraTarget.set(at.x, 0.2, at.z);
      this.updateCamera(0);
    }
  }
}
