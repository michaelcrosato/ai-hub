// Starfall Meridian — the 3D side: scene, lights, starfield, ships, station, system
// dressing and the instanced pools that draw bolts, debris and salvage.
// Geometry and materials are built once and shared; a system change only recolours.

import * as THREE from 'three/webgpu';
import { instancedBufferAttribute, max, screenDPR, float, clamp } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { createPoints } from 'kit/points.js';

const STAR_MAX = 4000;
const STAR_BASE = 3200;

/** Draws a list of transforms with one InstancedMesh; the game pushes what is alive each frame. */
class Pool {
  constructor(geometry, material, capacity, { life = null, colors = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.capacity = capacity;
    this.n = 0;
    this.life = life;
    this.dummy = new THREE.Object3D();
    if (colors) {
      // Create the colour attribute up front so the pipeline never changes mid-game.
      const white = new THREE.Color(1, 1, 1);
      for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, white);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.count = 0;
  }
  begin() {
    this.n = 0;
  }
  push(x, y, z, rx, ry, rz, sx, sy, sz, life = 1, color = null) {
    if (this.n >= this.capacity) return;
    const d = this.dummy;
    d.position.set(x, y, z);
    d.rotation.set(rx, ry, rz);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    this.mesh.setMatrixAt(this.n, d.matrix);
    if (this.life) this.life.array[this.n] = life;
    if (color && this.mesh.instanceColor) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    if (this.n) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (this.life) this.life.needsUpdate = true;
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

/* ------------------------------------------------------------------ ships */

const shipGeoCache = new Map();
function shipGeometry(enemy) {
  const key = enemy ? 'enemy' : 'player';
  if (shipGeoCache.has(key)) return shipGeoCache.get(key);
  const g = {
    nose: new THREE.ConeGeometry(enemy ? 2.4 : 2.65, enemy ? 8 : 9.5, 5),
    body: new THREE.BoxGeometry(1.45, 1.1, 6.2),
    wing: new THREE.BoxGeometry(enemy ? 4.5 : 5.6, 0.38, enemy ? 3.2 : 3.8),
    engine: new THREE.CylinderGeometry(0.48, 0.7, 2.2, 8),
    glow: new THREE.ConeGeometry(0.52, 3.5, 8, 1, true),
    canopy: new THREE.OctahedronGeometry(enemy ? 0.72 : 0.9, 0),
  };
  shipGeoCache.set(key, g);
  return g;
}

function shipMaterials(hullColor, enemy, canopy = null) {
  return {
    hull: new THREE.MeshStandardMaterial({
      color: hullColor,
      roughness: 0.48,
      metalness: 0.62,
      emissive: enemy ? 0x220605 : 0x061a22,
      emissiveIntensity: 0.35,
      flatShading: true,
    }),
    dark: new THREE.MeshStandardMaterial({ color: enemy ? 0x321518 : 0x102532, roughness: 0.7, metalness: 0.5, flatShading: true }),
    canopy: new THREE.MeshStandardMaterial({
      color: canopy?.color ?? (enemy ? 0xff6f61 : 0x88f5ff),
      emissive: canopy?.emissive ?? (enemy ? 0xff2d20 : 0x2bdff3),
      emissiveIntensity: 2.2,
      roughness: 0.16,
      metalness: 0.22,
    }),
    glow: new THREE.MeshBasicMaterial({
      color: enemy ? 0xff633e : 0x62eaff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  };
}

/** The original low-poly ship: a five-sided nose, swept wings, twin engines and glows. */
function buildShip(mats, enemy) {
  const g = shipGeometry(enemy);
  const group = new THREE.Group();
  const nose = new THREE.Mesh(g.nose, mats.hull);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.5;
  group.add(nose);
  const body = new THREE.Mesh(g.body, mats.dark);
  body.position.z = 1.25;
  group.add(body);
  for (const c of [-1, 1]) {
    const wing = new THREE.Mesh(g.wing, mats.hull);
    wing.position.set(c * (enemy ? 2.2 : 2.7), -0.1, 1.2);
    wing.rotation.y = c * (enemy ? 0.36 : 0.3);
    group.add(wing);
    const engine = new THREE.Mesh(g.engine, mats.dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(c * (enemy ? 1.35 : 1.55), 0, 3.5);
    group.add(engine);
    const glow = new THREE.Mesh(g.glow, mats.glow);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(c * (enemy ? 1.35 : 1.55), 0, 5.8);
    glow.name = 'engineGlow';
    group.add(glow);
  }
  const canopy = new THREE.Mesh(g.canopy, mats.canopy);
  canopy.scale.set(1, 0.65, 1.55);
  canopy.position.set(0, 0.72, -1.3);
  group.add(canopy);
  group.scale.setScalar(enemy ? 0.82 : 1);
  return group;
}

const glowsOf = (group) => group.children.filter((c) => c.name === 'engineGlow');

/* ------------------------------------------------------------------ world */

export function createWorld(kit) {
  const renderer = kit.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02050b);
  scene.fog = new THREE.FogExp2(0x030913, 0.00115);
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(56, 1, 0.1, 2400));
  camera.position.set(0, 62, 54);

  scene.add(new THREE.HemisphereLight(0x8edfff, 0x071018, 1.5));
  const key = new THREE.DirectionalLight(0xd9f8ff, 2.4);
  key.position.set(-90, 120, 70);
  scene.add(key);

  // Starfield: the original 3200 points, now kit sprites (WebGPU draws Points at 1 px).
  const starPos = new Float32Array(STAR_MAX * 3);
  const starCol = new Float32Array(STAR_MAX * 3);
  const starSize = new Float32Array(STAR_MAX);
  for (let i = 0; i < STAR_MAX; i++) {
    const r = 200 + Math.random() * 1500;
    const a = Math.random() * Math.PI * 2;
    starPos[i * 3] = Math.cos(a) * r;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 520;
    starPos[i * 3 + 2] = Math.sin(a) * r;
    const warm = Math.random() > 0.92;
    // Opacity 0.9 of the original baked into the colour, so the field can stay opaque.
    starCol[i * 3] = (warm ? 1 : 0.55) * 0.9;
    starCol[i * 3 + 1] = (warm ? 0.72 : 0.82) * 0.9;
    starCol[i * 3 + 2] = 0.9;
    // Size-attenuated 1.2 in the original: about 2 px near, 1 px far.
    starSize[i] = Math.min(1.9, Math.max(0.8, 300 / r));
  }
  const stars = createPoints({
    positions: starPos,
    colors: starCol,
    sizes: starSize,
    sizeAttenuation: false,
    material: { transparent: false, depthWrite: false },
  });
  // GL points never drew under one device pixel; hold that minimum so far stars do not flicker out.
  stars.material.sizeNode = max(instancedBufferAttribute(stars.sizes).mul(screenDPR), 1).div(screenDPR);
  stars.object.renderOrder = -1;
  scene.add(stars.object);

  const systemRoot = new THREE.Group();
  const shipRoot = new THREE.Group();
  const fxRoot = new THREE.Group();
  scene.add(systemRoot, shipRoot, fxRoot);

  /* ---- player */
  const playerMats = shipMaterials(0x7adff2, false);
  const player = buildShip(playerMats, false);
  player.position.set(0, 0, 30);
  shipRoot.add(player);
  const playerGlows = glowsOf(player);
  const bubble = new THREE.Mesh(
    new THREE.IcosahedronGeometry(6.2, 2),
    new THREE.MeshBasicMaterial({
      color: 0x65eaff,
      transparent: true,
      opacity: 0,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  player.add(bubble);

  /* ---- enemy prototypes (cloned per spawn: geometry and materials stay shared) */
  const corsairMats = shipMaterials(0xc94c47, true);
  const lancerMats = shipMaterials(0xe07b39, true, { color: 0xffc36b, emissive: 0xff8a1e });
  const crownMats = shipMaterials(0x7d2a2e, true, { color: 0xffd18a, emissive: 0xff5a1f });
  const protos = {
    corsair: buildShip(corsairMats, true),
    lancer: buildShip(lancerMats, true),
    crown: buildShip(crownMats, true),
  };
  protos.lancer.scale.setScalar(0.62);
  {
    // The flagship: a burning crown ring and spines over the hull.
    const crown = protos.crown;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.26, 6, 18), crownMats.canopy);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1.5, 1);
    crown.add(ring);
    const spikeGeo = new THREE.ConeGeometry(0.28, 1.5, 4);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(spikeGeo, crownMats.hull);
      spike.position.set(Math.cos(a) * 2.1, 2.2, 1 + Math.sin(a) * 2.1);
      crown.add(spike);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 2.2), crownMats.dark);
    plate.position.set(0, 0.1, 3.2);
    crown.add(plate);
    crown.scale.setScalar(2.5);
  }

  /* ---- station (recoloured per system) */
  const stationHull = new THREE.MeshStandardMaterial({ color: 0x26343c, roughness: 0.72, metalness: 0.62, flatShading: true });
  const stationGlow = new THREE.MeshStandardMaterial({ color: 0x68e6ff, emissive: 0x68e6ff, emissiveIntensity: 2.8, roughness: 0.2 });
  const station = new THREE.Group();
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 1.25, 6, 28), stationHull);
    ring.rotation.x = Math.PI / 2;
    station.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.35, 5, 24), stationGlow);
    inner.rotation.x = Math.PI / 2;
    station.add(inner);
    station.add(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 5.2, 7.5, 8), stationHull));
    const spokeGeo = new THREE.BoxGeometry(1, 1, 25);
    for (let o = 0; o < 2; o++) {
      const spoke = new THREE.Mesh(spokeGeo, stationHull);
      spoke.rotation.y = (o * Math.PI) / 2;
      station.add(spoke);
    }
    const lights = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45), stationGlow, 12);
    const m = new THREE.Matrix4();
    for (let o = 0; o < 12; o++) {
      const c = (o / 12) * Math.PI * 2;
      m.makeTranslation(Math.cos(c) * 15, 0, Math.sin(c) * 15);
      lights.setMatrixAt(o, m);
    }
    lights.computeBoundingSphere();
    station.add(lights);
    station.scale.setScalar(1.3);
    station.position.set(0, 0, -145);
  }
  systemRoot.add(station);

  /* ---- system dressing: sun, light, planet, haze, ring, asteroid belt */
  const sunMat = new THREE.MeshBasicMaterial({ color: 0x68e6ff });
  const sun = new THREE.Mesh(new THREE.IcosahedronGeometry(27, 3), sunMat);
  sun.position.set(-300, -36, -520);
  systemRoot.add(sun);
  const sunLight = new THREE.PointLight(0x68e6ff, 900, 780, 1.1);
  sunLight.position.copy(sun.position);
  systemRoot.add(sunLight);
  const planetMat = new THREE.MeshStandardMaterial({ color: 0x2f7e9a, roughness: 0.85, metalness: 0.05, flatShading: true });
  const planet = new THREE.Mesh(new THREE.IcosahedronGeometry(38, 3), planetMat);
  planet.position.set(170, -42, -410);
  systemRoot.add(planet);
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x68e6ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  });
  const atmo = new THREE.Mesh(new THREE.IcosahedronGeometry(40.5, 3), atmoMat);
  atmo.position.copy(planet.position);
  systemRoot.add(atmo);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x68e6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
  const planetRing = new THREE.Mesh(new THREE.RingGeometry(52, 78, 64), ringMat);
  planetRing.position.copy(planet.position);
  planetRing.rotation.x = Math.PI / 2.35;
  systemRoot.add(planetRing);
  const ROCKS = 54;
  const asteroids = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(2.3, 0),
    new THREE.MeshStandardMaterial({ color: 0x35434b, roughness: 0.92, metalness: 0.08, flatShading: true }),
    ROCKS
  );
  systemRoot.add(asteroids);

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();

  function setSystem(sys, index) {
    sunMat.color.setHex(sys.tint);
    sunLight.color.setHex(sys.tint);
    planetMat.color.setHex(sys.planet);
    atmoMat.color.setHex(sys.tint);
    ringMat.color.setHex(sys.tint);
    planetRing.visible = sys.id === 'cinderwake' || sys.id === 'vesper';
    stationGlow.color.setHex(sys.tint);
    stationGlow.emissive.setHex(sys.tint);
    const seed = index * 0.73;
    for (let o = 0; o < ROCKS; o++) {
      const a = (o * 2.399 + seed) % (Math.PI * 2);
      const r = 120 + ((o * 47) % 170);
      tmpP.set(Math.cos(a) * r, ((o % 7) - 3) * 0.45, Math.sin(a) * r - 130);
      tmpQ.setFromEuler(tmpE.set(o * 0.37, o * 0.71, o * 0.19));
      const s = 0.45 + ((o * 31) % 100) / 82;
      tmpS.set(s, s * (0.6 + (o % 5) * 0.12), s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      asteroids.setMatrixAt(o, tmpM);
    }
    asteroids.instanceMatrix.needsUpdate = true;
    asteroids.computeBoundingSphere();
  }

  /* ---- pools */
  const boltGeo = new THREE.SphereGeometry(0.32, 6, 6);
  const friendly = new Pool(boltGeo, new THREE.MeshBasicMaterial({ color: 0x74f5ff }), 160);
  const hostile = new Pool(boltGeo, new THREE.MeshBasicMaterial({ color: 0xff604d }), 160);
  const debrisLife = new THREE.InstancedBufferAttribute(new Float32Array(420), 1);
  debrisLife.setUsage(THREE.DynamicDrawUsage);
  const debrisMat = new THREE.MeshBasicNodeMaterial({ transparent: true });
  debrisMat.opacityNode = clamp(instancedBufferAttribute(debrisLife), float(0), float(1));
  const debris = new Pool(new THREE.TetrahedronGeometry(0.42, 0), debrisMat, 420, { life: debrisLife, colors: true });
  const canisterMat = new THREE.MeshStandardMaterial({
    color: 0x8a9aa3,
    roughness: 0.5,
    metalness: 0.6,
    emissive: 0xffc36b,
    emissiveIntensity: 0.55,
    flatShading: true,
  });
  const canisters = new Pool(new THREE.BoxGeometry(1.1, 0.8, 1.6), canisterMat, 24);
  for (const p of [friendly, hostile, debris, canisters]) fxRoot.add(p.mesh);

  const post = createPost(kit, scene, camera, { bloom: { strength: 0.72, radius: 0.82, threshold: 0.78 } });

  const applyQuality = () => {
    stars.setCount(Math.min(STAR_MAX, kit.detail(STAR_BASE)));
  };
  applyQuality();
  kit.onQuality(applyQuality);

  return {
    scene,
    camera,
    post,
    stars,
    player,
    playerGlows,
    bubble,
    station,
    shipRoot,
    pools: { friendly, hostile, debris, canisters },
    setSystem,
    /** A new enemy ship of the given type, added to the scene. */
    spawnShip(type) {
      const group = protos[type].clone();
      group.userData.glows = glowsOf(group);
      shipRoot.add(group);
      return group;
    },
    removeShip(group) {
      shipRoot.remove(group);
    },
    /** Compile every pipeline up front (pools included) so the first shot does not stutter. */
    async warm() {
      const warmers = [];
      for (const type of Object.keys(protos)) {
        const g = protos[type].clone();
        g.position.set(0, -40, 0);
        shipRoot.add(g);
        warmers.push(g);
      }
      for (const p of Object.values({ friendly, hostile, debris, canisters })) {
        p.begin();
        p.push(0, -40, 0, 0, 0, 0, 0.001, 0.001, 0.001, 0);
        p.end();
      }
      try {
        await renderer.compileAsync(scene, camera);
      } catch {
        /* compiling up front is an optimisation only */
      }
      for (const g of warmers) shipRoot.remove(g);
      for (const p of Object.values({ friendly, hostile, debris, canisters })) {
        p.begin();
        p.end();
      }
    },
    render() {
      post.render();
    },
  };
}
