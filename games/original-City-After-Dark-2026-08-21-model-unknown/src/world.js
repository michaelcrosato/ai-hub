/**
 * world.js — the procedural 3D city: districts, buildings, traffic, crowds,
 * weather, the player's avatar and the third-person camera.
 *
 * Built on the shared kit (WebGPU with a WebGL2 fallback). Repeated props are
 * instanced or merged: the whole city draws in well under a hundred calls.
 * The layout comes from a seeded generator per region, so every region keeps
 * the same streets it always had.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPoints } from 'kit/points.js';
import { createPost } from 'kit/post.js';
import { LOCATIONS, REGIONS } from './data.js';
import { clamp } from './career.js';

const UP = new THREE.Vector3(0, 1, 0);
const ROADS = [-70, 0, 70];
const CITY_LIMIT = 139;

// Scratch objects so the frame loop never allocates.
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _target = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _m3 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

/** Park–Miller generator: the same seed always builds the same city. */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** FNV-1a string hash, used to seed each region. */
function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** A floating name plate for a city location. */
function makeLabel(text, color = '#f19ac2', compact = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = compact ? 128 : 180;
  const ctx = canvas.getContext('2d');
  ctx.font = `800 ${compact ? 44 : 38}px Inter, system-ui, sans-serif`;
  const width = Math.min(480, ctx.measureText(text.toUpperCase()).width + 70);
  const x = (512 - width) / 2;
  const y = compact ? 20 : 42;
  const h = compact ? 80 : 90;
  ctx.fillStyle = 'rgba(8,10,16,.84)';
  ctx.strokeStyle = 'rgba(255,255,255,.23)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, width, h, 22);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillText(text.toUpperCase(), 256, y + h / 2 + 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(compact ? 8 : 10, compact ? 2 : 3.5, 1);
  return sprite;
}

/* ------------------------------------------------------------------ people */

// One set of body-part geometries shared by the player and the whole crowd.
const PERSON = {
  torso: new THREE.CapsuleGeometry(0.43, 0.98, 5, 10),
  head: new THREE.SphereGeometry(0.33, 18, 12),
  hair: new THREE.SphereGeometry(0.345, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
  arm: new THREE.CapsuleGeometry(0.115, 0.72, 4, 8),
  leg: new THREE.CapsuleGeometry(0.15, 0.78, 4, 8),
  shoe: new THREE.BoxGeometry(0.28, 0.16, 0.46),
};
const SKIN = 0xc98f78;
const SHOE = 0x11131a;

/** The player's avatar: a group of named parts that animate. */
function buildPerson(outfit, accent, scale = 1) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72 });
  const body = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.56, metalness: 0.08 });
  const trim = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.45, metalness: 0.12 });
  const shoes = new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.7 });
  const part = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const torso = part(PERSON.torso, body, 0, 1.55, 0);
  const head = part(PERSON.head, skin, 0, 2.66, 0);
  part(PERSON.hair, trim, 0, 2.76, 0);
  const leftArm = part(PERSON.arm, body, -0.56, 1.58, 0);
  const rightArm = part(PERSON.arm, body, 0.56, 1.58, 0);
  const leftLeg = part(PERSON.leg, trim, -0.22, 0.56, 0);
  const rightLeg = part(PERSON.leg, trim, 0.22, 0.56, 0);
  part(PERSON.shoe, shoes, -0.22, 0.1, 0.09);
  part(PERSON.shoe, shoes, 0.22, 0.1, 0.09);
  group.userData.parts = { torso, head, leftArm, rightArm, leftLeg, rightLeg };
  group.scale.setScalar(scale);
  return group;
}

const CROWD_OUTFITS = [0x38445c, 0x6f4c67, 0x35564c, 0x5b4d3a, 0x4f415e, 0x3f5162];
const CROWD_ACCENTS = [0xe7a3c5, 0x94b5e8, 0xd8b074, 0x82c7a7, 0x9c8cdc];
const CAR_COLORS = [0x252934, 0x5b253e, 0x263d55, 0x53472f, 0x4e4c56, 0x213c36];
const BUILDING_COLORS = [0x222632, 0x292834, 0x1d2530, 0x302735, 0x263039, 0x25252c];

export class City {
  /**
   * @param {object} kit  from boot()
   */
  constructor(kit) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171a2a);
    this.scene.fog = new THREE.FogExp2(0x202536, 0.007);
    this.daySkyColor = new THREE.Color(0x71859d);
    this.nightSkyColor = new THREE.Color(0x171a2a);
    this.nightFogColor = new THREE.Color(0x202536);
    this.skyMixColor = new THREE.Color();
    this.fogMixColor = new THREE.Color();
    this.fogDensity = 0.007;
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(56, 1, 0.1, 500));

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.post = createPost(kit, this.scene, this.camera, {
      bloom: { strength: 0.52, radius: 0.72, threshold: 0.72 },
    });

    this.state = null;
    this.regionId = null;
    this.environment = null;
    this.disposables = [];
    this.colliders = [];
    this.buildings = [];
    this.markers = new Map();
    this.streetLights = [];
    this.crowd = null;
    this.traffic = null;
    this.rain = null;
    this.activeTarget = null;
    this.nearby = null;
    this.onMove = null;
    this.onNearbyChange = null;
    this.blocked = true;
    this.bloomOn = true;

    this.yaw = Math.PI * 0.22;
    this.pitch = 0.45;
    this.distance = 9;
    this.walkPhase = 0;
    this.isMoving = false;
    this.isRunning = false;
    this.facing = Math.PI;
    this.dragging = false;
    this.slabIn = 0; // camera-clip scratch (see slab())
    this.slabOut = 1;
    this.idleAngle = 0.6; // title-screen orbit

    this.setupLights();
    this.setupSky();
    this.createPlayer();
    // Rain density follows the quality tier live; shadow size follows via kit.shadow().
    kit.onQuality(() => this.rain?.setCount(kit.detail(1700, 300)));
  }

  /* ------------------------------------------------------------ setup */

  setupLights() {
    this.hemi = new THREE.HemisphereLight(0x9bb8ff, 0x1c1824, 0.55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffd7b4, 1.5);
    this.sun.position.set(-70, 90, 30);
    this.sun.castShadow = true;
    this.kit.shadow(this.sun, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -110,
      right: 110,
      top: 110,
      bottom: -110,
      near: 1,
      far: 260,
    });
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 2.5; // the old PCFSoftShadowMap softness
    this.scene.add(this.sun);
    this.moonLight = new THREE.DirectionalLight(0x86a2ff, 0.42);
    this.moonLight.position.set(60, 80, -50);
    this.scene.add(this.moonLight);
  }

  setupSky() {
    const random = seededRandom(94857);
    const positions = new Float32Array(750 * 3);
    for (let i = 0; i < 750; i += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 130 + random() * 130;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 45 + random() * 130;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    // A background starfield stays opaque and draws first (kit README, points): it fades
    // into the sky colour by day instead of through opacity.
    this.starColor = new THREE.Color(0xcbd8ff).multiplyScalar(0.8);
    this.stars = createPoints({
      positions,
      size: 0.62,
      material: { color: 0xcbd8ff, transparent: false, depthWrite: false, toneMapped: false },
    });
    this.stars.object.renderOrder = -1;
    this.scene.add(this.stars.object);
    const moonMaterial = new THREE.MeshBasicMaterial({
      color: 0xdde7ff,
      transparent: true,
      toneMapped: false,
    });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 16), moonMaterial);
    this.moon.position.set(95, 105, -125);
    this.scene.add(this.moon);
  }

  createPlayer() {
    this.player = buildPerson(0x2a2b42, 0xf19ac2, 1.04);
    this.playerParts = this.player.userData.parts;
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    const auraMaterial = new THREE.MeshBasicMaterial({
      color: 0xf19ac2,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.playerAura = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), auraMaterial);
    this.playerAura.rotation.x = -Math.PI / 2;
    this.playerAura.position.y = 0.035;
    this.player.add(this.playerAura);
  }

  /* ------------------------------------------------------------ region */

  /** Show a career: build its region if needed and place the avatar. */
  load(state) {
    this.state = state;
    if (this.regionId !== state.regionId || !this.environment) this.buildRegion(state.regionId);
    this.player.visible = true;
    this.player.position.set(state.world.x, 0, state.world.z);
    this.facing = this.player.rotation.y;
    this.nearby = null;
    this.applySettings(state.settings);
    this.updateCamera(0.016, true);
  }

  setRegion(regionId, state) {
    this.state = state;
    this.buildRegion(regionId);
    this.applySettings(state.settings);
  }

  /** Track a GPU resource that belongs to the current region. */
  own(resource) {
    this.disposables.push(resource);
    return resource;
  }

  buildRegion(regionId, { compile = true } = {}) {
    if (this.environment) {
      this.scene.remove(this.environment);
      this.environment.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
      for (const r of this.disposables) r.dispose?.();
      this.disposables = [];
    }
    this.environment = new THREE.Group();
    this.environment.name = 'Procedural city';
    this.scene.add(this.environment);
    this.colliders = [];
    this.buildings = [];
    this.markers.clear();
    this.streetLights = [];

    const region = REGIONS[regionId] || REGIONS.pacific;
    this.region = region;
    this.regionId = region.id;
    this.nightSkyColor.setHex(region.palette.sky);
    this.nightFogColor.setHex(region.palette.fog);
    this.scene.background.copy(this.nightSkyColor);
    this.scene.fog.color.copy(this.nightFogColor);

    const random = seededRandom(hashString(regionId));
    this.createGround(region);
    this.createRoads(region);
    this.createBuildings(region, random);
    this.createPark(region, random);
    this.createStreetFurniture(region);
    this.createLocationMarkers(region);
    this.createCrowd(region, random);
    this.createTraffic(region, random);
    this.createWeather(region, random);
    this.setTarget(this.activeTarget);
    // Pipelines for the new district compile in the background.
    if (compile) this.renderer.compileAsync?.(this.scene, this.camera).catch(() => {});
  }

  createGround(region) {
    const geometry = this.own(new THREE.PlaneGeometry(320, 320));
    const material = this.own(
      new THREE.MeshStandardMaterial({ color: region.palette.ground, roughness: 0.82, metalness: 0.08 }),
    );
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    this.environment.add(ground);
  }

  /** Merge many translated boxes into one geometry (one draw call). */
  mergedBoxes(boxes) {
    const parts = boxes.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    const merged = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    return this.own(merged);
  }

  createRoads(region) {
    const wet = region.weather === 'rain';
    const asphalt = this.own(
      new THREE.MeshPhysicalMaterial({
        color: 0x0e1119,
        roughness: wet ? 0.28 : 0.62,
        metalness: wet ? 0.5 : 0.12,
        clearcoat: wet ? 0.45 : 0.08,
        clearcoatRoughness: 0.38,
      }),
    );
    const pavement = this.own(
      new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.9, metalness: 0.05 }),
    );

    const roads = [];
    for (const c of ROADS) {
      roads.push([300, 0.08, 16, 0, 0.02, c]);
      roads.push([16, 0.08, 300, c, 0.021, 0]);
    }
    const roadMesh = new THREE.Mesh(this.mergedBoxes(roads), asphalt);
    roadMesh.receiveShadow = true;
    this.environment.add(roadMesh);

    const spans = [
      { min: -140, max: -78 },
      { min: -62, max: -8 },
      { min: 8, max: 62 },
      { min: 78, max: 140 },
    ];
    const blocks = [];
    for (const a of spans) {
      for (const b of spans) {
        blocks.push([a.max - a.min, 0.22, b.max - b.min, (a.min + a.max) / 2, 0.08, (b.min + b.max) / 2]);
      }
    }
    const blockMesh = new THREE.Mesh(this.mergedBoxes(blocks), pavement);
    blockMesh.receiveShadow = true;
    this.environment.add(blockMesh);

    const laneMaterial = this.own(
      new THREE.MeshBasicMaterial({ color: 0xd6c87b, transparent: true, opacity: 0.4, toneMapped: false }),
    );
    const dashes = [];
    for (const c of ROADS) {
      for (let d = -138; d <= 138; d += 11) {
        dashes.push([4.2, 0.012, 0.16, d, 0.075, c]);
        dashes.push([0.16, 0.012, 4.2, c, 0.076, d]);
      }
    }
    this.environment.add(new THREE.Mesh(this.mergedBoxes(dashes), laneMaterial));

    const crossingMaterial = this.own(
      new THREE.MeshBasicMaterial({ color: 0xdde1ec, transparent: true, opacity: 0.36, toneMapped: false }),
    );
    const stripes = [];
    for (const x of ROADS) {
      for (const z of ROADS) {
        for (let f = -4; f <= 4; f += 1) {
          stripes.push([0.7, 0.015, 5, x + f * 1.25, 0.08, z - 10.5]);
          stripes.push([5, 0.015, 0.7, x - 10.5, 0.081, z + f * 1.25]);
        }
      }
    }
    this.environment.add(new THREE.Mesh(this.mergedBoxes(stripes), crossingMaterial));
  }

  createBuildings(region, random) {
    const centres = [-109, -35, 35, 109];
    const windows = [];
    const towers = [];
    const roofs = [];
    const antennas = [];
    centres.forEach((x, ix) => {
      centres.forEach((z, iz) => {
        if (ix === 1 && iz === 2) return; // Glasshouse Park
        // The draw order of random() is the original's, so each region keeps its skyline.
        const width = 36 + random() * 10;
        const depth = 36 + random() * 10;
        const height = 20 + random() * 49;
        const color = BUILDING_COLORS[Math.floor(random() * BUILDING_COLORS.length)];
        random(); // clearcoat variation (one shared glass finish now)
        towers.push({ x, z, width, depth, height, color });
        this.colliders.push({
          minX: x - width / 2 - 0.6,
          maxX: x + width / 2 + 0.6,
          minZ: z - depth / 2 - 0.6,
          maxZ: z + depth / 2 + 0.6,
        });
        const roofHeight = 1.5 + random() * 2.5;
        roofs.push({ x, y: height + 1, z, width: width * 0.55, height: roofHeight, depth: depth * 0.55 });
        this.buildings.push({
          minX: x - width / 2,
          maxX: x + width / 2,
          minZ: z - depth / 2,
          maxZ: z + depth / 2,
          maxY: height + 1 + roofHeight / 2,
        });
        if (height > 48 && random() > 0.45)
          antennas.push({ x: x + width * 0.18, z: z - depth * 0.12, height });
        const floorStep = 3.25;
        const columnStep = 3.1;
        for (let y = 3; y < height - 1.6; y += floorStep) {
          for (let d = -width / 2 + 2.1; d < width / 2 - 1.2; d += columnStep) {
            if (random() > 0.22) {
              windows.push({ x: x + d, y, z: z + depth / 2 + 0.035, ry: 0, lit: random() });
              windows.push({ x: x + d, y, z: z - depth / 2 - 0.035, ry: Math.PI, lit: random() });
            }
          }
          for (let d = -depth / 2 + 2.1; d < depth / 2 - 1.2; d += columnStep) {
            if (random() > 0.22) {
              windows.push({ x: x + width / 2 + 0.035, y, z: z + d, ry: Math.PI / 2, lit: random() });
              windows.push({ x: x - width / 2 - 0.035, y, z: z + d, ry: -Math.PI / 2, lit: random() });
            }
          }
        }
      });
    });

    const unitBox = this.own(new THREE.BoxGeometry(1, 1, 1));
    const glass = this.own(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.58,
        metalness: 0.33,
        clearcoat: 0.12,
        clearcoatRoughness: 0.5,
      }),
    );
    const towerMesh = new THREE.InstancedMesh(unitBox, glass, towers.length);
    const colour = new THREE.Color();
    towers.forEach((b, i) => {
      _m1.compose(_v1.set(b.x, b.height / 2 + 0.22, b.z), _q.identity(), _s.set(b.width, b.height, b.depth));
      towerMesh.setMatrixAt(i, _m1);
      towerMesh.setColorAt(i, colour.setHex(b.color));
    });
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    this.environment.add(towerMesh);

    const roofMaterial = this.own(
      new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.42, metalness: 0.65 }),
    );
    const roofMesh = new THREE.InstancedMesh(unitBox, roofMaterial, roofs.length);
    roofs.forEach((r, i) => {
      _m1.compose(_v1.set(r.x, r.y, r.z), _q.identity(), _s.set(r.width, r.height, r.depth));
      roofMesh.setMatrixAt(i, _m1);
    });
    roofMesh.castShadow = true;
    this.environment.add(roofMesh);

    if (antennas.length) {
      const mastGeometry = this.own(new THREE.CylinderGeometry(0.16, 0.22, 9, 8));
      const mastMaterial = this.own(
        new THREE.MeshStandardMaterial({ color: 0x343945, roughness: 0.35, metalness: 0.75 }),
      );
      const masts = new THREE.InstancedMesh(mastGeometry, mastMaterial, antennas.length);
      const beaconGeometry = this.own(new THREE.SphereGeometry(0.28, 10, 8));
      const beaconMaterial = this.own(new THREE.MeshBasicMaterial({ color: 0xff526a, toneMapped: false }));
      const beacons = new THREE.InstancedMesh(beaconGeometry, beaconMaterial, antennas.length);
      antennas.forEach((a, i) => {
        masts.setMatrixAt(i, _m1.makeTranslation(a.x, a.height + 5, a.z));
        beacons.setMatrixAt(i, _m1.makeTranslation(a.x, a.height + 9.4, a.z));
      });
      masts.castShadow = true;
      this.environment.add(masts, beacons);
    }

    const pane = this.own(new THREE.PlaneGeometry(1.45, 0.95));
    const paneMaterial = this.own(
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false }),
    );
    const panes = new THREE.InstancedMesh(pane, paneMaterial, Math.max(1, windows.length));
    const warm = new THREE.Color(0xffd9a5);
    const cool = new THREE.Color(0x9bbcff);
    const dark = new THREE.Color(0x182234);
    windows.forEach((w, i) => {
      _q.setFromAxisAngle(UP, w.ry);
      _m1.compose(_v1.set(w.x, w.y, w.z), _q, _s.set(1, 1, 1));
      panes.setMatrixAt(i, _m1);
      panes.setColorAt(i, w.lit > 0.58 ? warm : w.lit > 0.31 ? cool : dark);
    });
    panes.count = windows.length;
    this.environment.add(panes);
  }

  createPark(region, random) {
    const park = new THREE.Group();
    const lawn = new THREE.Mesh(
      this.own(new THREE.BoxGeometry(47, 0.3, 47)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x193329, roughness: 0.96 })),
    );
    lawn.position.set(-35, 0.28, 35);
    lawn.receiveShadow = true;
    park.add(lawn);
    const pathMaterial = this.own(new THREE.MeshStandardMaterial({ color: 0x6a665c, roughness: 0.95 }));
    const paths = new THREE.Mesh(
      this.mergedBoxes([
        [5, 0.08, 43, -35, 0.48, 35],
        [43, 0.08, 5, -35, 0.49, 35],
      ]),
      pathMaterial,
    );
    park.add(paths);

    const spots = [
      [-51, 20],
      [-20, 20],
      [-51, 51],
      [-20, 51],
      [-49, 35],
      [-21, 35],
      [-35, 21],
      [-35, 50],
    ];
    const trunks = new THREE.InstancedMesh(
      this.own(new THREE.CylinderGeometry(0.36, 0.48, 4, 8)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x4f3a2f, roughness: 0.95 })),
      spots.length,
    );
    const crowns = new THREE.InstancedMesh(
      this.own(new THREE.IcosahedronGeometry(2.2, 1)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x23543a, roughness: 0.88 })),
      spots.length,
    );
    spots.forEach(([x, z], i) => {
      trunks.setMatrixAt(i, _m1.makeTranslation(x, 2.2, z));
      const y = 5.1 + random() * 0.8;
      const scale = 0.9 + random() * 0.4;
      const turn = i % 2 === 0 ? random() * Math.PI : 0;
      _q.setFromAxisAngle(UP, turn);
      crowns.setMatrixAt(i, _m1.compose(_v1.set(x, y, z), _q, _s.setScalar(scale)));
    });
    trunks.castShadow = true;
    crowns.castShadow = true;
    park.add(trunks, crowns);

    const sculptureMaterial = this.own(
      new THREE.MeshPhysicalMaterial({
        color: region.palette.accent2,
        emissive: region.palette.accent2,
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.82,
      }),
    );
    const sculpture = new THREE.Mesh(
      this.own(new THREE.TorusKnotGeometry(2.6, 0.38, 96, 14)),
      sculptureMaterial,
    );
    sculpture.position.set(-35, 3.4, 35);
    sculpture.rotation.x = Math.PI / 2;
    sculpture.castShadow = true;
    park.add(sculpture);
    this.environment.add(park);
  }

  createStreetFurniture() {
    const spots = [];
    for (const road of ROADS) {
      for (let h = -125; h <= 125; h += 25)
        spots.push([h, road - 10], [h, road + 10], [road - 10, h], [road + 10, h]);
    }
    const lamps = spots.filter(([x, z]) => Math.abs(x) <= 137 && Math.abs(z) <= 137);
    const poles = new THREE.InstancedMesh(
      this.own(new THREE.CylinderGeometry(0.09, 0.14, 5.4, 8)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x313744, roughness: 0.42, metalness: 0.78 })),
      lamps.length,
    );
    const bulbs = new THREE.InstancedMesh(
      this.own(new THREE.SphereGeometry(0.24, 12, 8)),
      this.own(new THREE.MeshBasicMaterial({ color: 0xffd9ab, toneMapped: false })),
      lamps.length,
    );
    lamps.forEach(([x, z], i) => {
      poles.setMatrixAt(i, _m1.makeTranslation(x, 2.8, z));
      bulbs.setMatrixAt(i, _m1.makeTranslation(x, 5.55, z));
    });
    poles.castShadow = true;
    this.environment.add(poles, bulbs);

    // Real light from a spread of lamps; fewer on lighter quality tiers.
    const candidates = lamps.filter((_, i) => i % 13 === 0).slice(0, 12);
    const budget = Math.min(candidates.length, this.kit.detail(candidates.length, 4));
    const stride = candidates.length / budget;
    for (let k = 0; k < budget; k += 1) {
      const [x, z] = candidates[Math.floor(k * stride)];
      const light = new THREE.PointLight(0xffc98a, 1.15, 24, 2.2);
      light.position.set(x, 5.3, z);
      this.streetLights.push(light);
      this.environment.add(light);
    }

    const benches = [
      [-8, 32],
      [-8, 40],
      [-62, 32],
      [-62, 40],
    ];
    const seats = new THREE.InstancedMesh(
      this.own(new THREE.BoxGeometry(3.1, 0.22, 0.85)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x4e3b35, roughness: 0.76 })),
      benches.length,
    );
    const frames = new THREE.InstancedMesh(
      this.own(new THREE.BoxGeometry(2.4, 0.65, 0.12)),
      this.own(new THREE.MeshStandardMaterial({ color: 0x252a34, roughness: 0.4, metalness: 0.75 })),
      benches.length,
    );
    benches.forEach(([x, z], i) => {
      seats.setMatrixAt(i, _m1.makeTranslation(x, 0.72, z));
      frames.setMatrixAt(i, _m1.makeTranslation(x, 0.39, z));
    });
    seats.castShadow = true;
    frames.castShadow = true;
    this.environment.add(seats, frames);
  }

  createLocationMarkers() {
    const ring = this.own(new THREE.RingGeometry(1.45, 1.82, 48));
    const beam = this.own(new THREE.CylinderGeometry(0.42, 1.2, 7, 24, 1, true));
    const beacon = this.own(new THREE.OctahedronGeometry(0.32));
    for (const loc of Object.values(LOCATIONS)) {
      const group = new THREE.Group();
      group.position.set(loc.x, 0.12, loc.z);
      const ringMesh = new THREE.Mesh(
        ring,
        this.own(
          new THREE.MeshBasicMaterial({
            color: loc.color,
            transparent: true,
            opacity: 0.64,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        ),
      );
      ringMesh.rotation.x = -Math.PI / 2;
      const beamMesh = new THREE.Mesh(
        beam,
        this.own(
          new THREE.MeshBasicMaterial({
            color: loc.color,
            transparent: true,
            opacity: 0.09,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
        ),
      );
      beamMesh.position.y = 3.5;
      const beaconMesh = new THREE.Mesh(
        beacon,
        this.own(new THREE.MeshBasicMaterial({ color: loc.color, toneMapped: false })),
      );
      beaconMesh.position.y = 2.1;
      const label = makeLabel(loc.name, `#${new THREE.Color(loc.color).getHexString()}`, true);
      this.own(label.material.map);
      this.own(label.material);
      label.position.y = 3.25;
      group.add(ringMesh, beamMesh, beaconMesh, label);
      group.userData = {
        location: loc,
        ring: ringMesh,
        beam: beamMesh,
        beacon: beaconMesh,
        label,
        baseY: group.position.y,
      };
      this.markers.set(loc.id, group);
      this.environment.add(group);
    }
  }

  /**
   * Pedestrians: every body part of every walker is one instance, so the
   * whole crowd is six draw calls however many people walk the streets.
   */
  createCrowd(region, random) {
    const count = 28;
    const people = [];
    for (let i = 0; i < count; i += 1) {
      const outfit = CROWD_OUTFITS[Math.floor(random() * CROWD_OUTFITS.length)];
      const accent = CROWD_ACCENTS[Math.floor(random() * CROWD_ACCENTS.length)];
      const scale = 0.82 + random() * 0.16;
      const axis = random() > 0.5 ? 'x' : 'z';
      const road = ROADS[Math.floor(random() * ROADS.length)];
      const side = random() > 0.5 ? 1 : -1;
      const position = new THREE.Vector3();
      if (axis === 'x') position.set(-130 + random() * 260, 0, road + side * 10.5);
      else position.set(road + side * 10.5, 0, -130 + random() * 260);
      const direction = random() > 0.5 ? 1 : -1;
      const speed = 1.5 + random() * 1.35;
      const phase = random() * Math.PI * 2;
      people.push({ outfit, accent, scale, axis, direction, speed, phase, position, rotation: 0 });
    }
    const outfitMaterial = this.own(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.56, metalness: 0.08 }),
    );
    const accentMaterial = this.own(
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.12 }),
    );
    const skinMaterial = this.own(new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.72 }));
    const shoeMaterial = this.own(new THREE.MeshStandardMaterial({ color: SHOE, roughness: 0.7 }));
    const make = (geometry, material, n) => {
      const mesh = new THREE.InstancedMesh(geometry, material, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.frustumCulled = false; // walkers roam the whole city
      this.environment.add(mesh);
      return mesh;
    };
    const parts = {
      torso: make(PERSON.torso, outfitMaterial, count),
      head: make(PERSON.head, skinMaterial, count),
      hair: make(PERSON.hair, accentMaterial, count),
      arms: make(PERSON.arm, outfitMaterial, count * 2),
      legs: make(PERSON.leg, accentMaterial, count * 2),
      shoes: make(PERSON.shoe, shoeMaterial, count * 2),
    };
    const colour = new THREE.Color();
    people.forEach((p, i) => {
      parts.torso.setColorAt(i, colour.setHex(p.outfit));
      parts.arms.setColorAt(i * 2, colour);
      parts.arms.setColorAt(i * 2 + 1, colour);
      parts.hair.setColorAt(i, colour.setHex(p.accent));
      parts.legs.setColorAt(i * 2, colour);
      parts.legs.setColorAt(i * 2 + 1, colour);
      p.rotation =
        p.axis === 'x' ? (p.direction > 0 ? Math.PI / 2 : -Math.PI / 2) : p.direction > 0 ? 0 : Math.PI;
    });
    this.crowd = { people, parts };
    this.updateCrowd(0);
  }

  /** Write one limb's matrix: root × offset × swing about X. */
  limb(root, mesh, index, x, y, z, swing) {
    _m2.makeRotationX(swing);
    _m2.setPosition(x, y, z);
    _m3.multiplyMatrices(root, _m2);
    mesh.setMatrixAt(index, _m3);
  }

  updateCrowd(dt) {
    if (!this.crowd) return;
    const { people, parts } = this.crowd;
    for (let i = 0; i < people.length; i += 1) {
      const p = people[i];
      if (dt > 0) {
        p.position[p.axis] += p.speed * p.direction * dt;
        if (p.position[p.axis] > 138) p.position[p.axis] = -138;
        if (p.position[p.axis] < -138) p.position[p.axis] = 138;
        p.phase += dt * p.speed * 4;
      }
      const swing = Math.sin(p.phase) * 0.36;
      p.position.y = Math.abs(Math.sin(p.phase * 2)) * 0.02;
      _q.setFromAxisAngle(UP, p.rotation);
      _m1.compose(p.position, _q, _s.setScalar(p.scale));
      this.limb(_m1, parts.torso, i, 0, 1.55, 0, 0);
      this.limb(_m1, parts.head, i, 0, 2.66, 0, 0);
      this.limb(_m1, parts.hair, i, 0, 2.76, 0, 0);
      this.limb(_m1, parts.arms, i * 2, -0.56, 1.58, 0, -swing * 0.65);
      this.limb(_m1, parts.arms, i * 2 + 1, 0.56, 1.58, 0, swing * 0.65);
      this.limb(_m1, parts.legs, i * 2, -0.22, 0.56, 0, swing);
      this.limb(_m1, parts.legs, i * 2 + 1, 0.22, 0.56, 0, -swing);
      this.limb(_m1, parts.shoes, i * 2, -0.22, 0.1, 0.09, 0);
      this.limb(_m1, parts.shoes, i * 2 + 1, 0.22, 0.1, 0.09, 0);
    }
    for (const mesh of Object.values(parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  createTraffic(region, random) {
    const count = 16;
    const cars = [];
    for (let i = 0; i < count; i += 1) {
      const color = CAR_COLORS[Math.floor(random() * CAR_COLORS.length)];
      const axis = random() > 0.5 ? 'x' : 'z';
      const road = ROADS[Math.floor(random() * ROADS.length)];
      const lane = random() > 0.5 ? 3.8 : -3.8;
      const position = new THREE.Vector3();
      let rotation;
      if (axis === 'x') {
        position.set(-150 + random() * 300, 0, road + lane);
        rotation = lane > 0 ? Math.PI : 0;
      } else {
        position.set(road + lane, 0, -150 + random() * 300);
        // Headlights (local +X) face the way the car drives.
        rotation = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      cars.push({
        color,
        axis,
        position,
        rotation,
        direction: lane > 0 ? -1 : 1,
        speed: 7.5 + random() * 5.5,
      });
    }
    const wet = region.weather === 'rain';
    const paint = this.own(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: wet ? 0.25 : 0.42,
        metalness: 0.62,
        clearcoat: 0.68,
        clearcoatRoughness: 0.24,
      }),
    );
    const glass = this.own(
      new THREE.MeshPhysicalMaterial({
        color: 0x111a24,
        roughness: 0.12,
        metalness: 0.35,
        transparent: true,
        opacity: 0.88,
      }),
    );
    const make = (geometry, material, n, shadow) => {
      const mesh = new THREE.InstancedMesh(this.own(geometry), material, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = shadow;
      mesh.frustumCulled = false;
      this.environment.add(mesh);
      return mesh;
    };
    const parts = {
      body: make(new THREE.BoxGeometry(3.7, 0.75, 1.75), paint, count, true),
      cabin: make(new THREE.BoxGeometry(1.9, 0.72, 1.48), glass, count, true),
      heads: make(
        new THREE.BoxGeometry(0.18, 0.18, 0.35),
        this.own(new THREE.MeshBasicMaterial({ color: 0xcfe4ff, toneMapped: false })),
        count * 2,
        false,
      ),
      tails: make(
        new THREE.BoxGeometry(0.18, 0.18, 0.35),
        this.own(new THREE.MeshBasicMaterial({ color: 0xff4a66, toneMapped: false })),
        count * 2,
        false,
      ),
    };
    const colour = new THREE.Color();
    cars.forEach((c, i) => parts.body.setColorAt(i, colour.setHex(c.color)));
    this.traffic = { cars, parts };
    this.updateTraffic(0);
  }

  updateTraffic(dt) {
    if (!this.traffic) return;
    const { cars, parts } = this.traffic;
    for (let i = 0; i < cars.length; i += 1) {
      const c = cars[i];
      if (dt > 0) {
        c.position[c.axis] += c.direction * c.speed * dt;
        if (c.position[c.axis] > 155) c.position[c.axis] = -155;
        if (c.position[c.axis] < -155) c.position[c.axis] = 155;
      }
      _q.setFromAxisAngle(UP, c.rotation);
      _m1.compose(c.position, _q, _s.set(1, 1, 1));
      this.limb(_m1, parts.body, i, 0, 0.7, 0, 0);
      this.limb(_m1, parts.cabin, i, -0.1, 1.32, 0, 0);
      this.limb(_m1, parts.heads, i * 2, 1.88, 0.72, -0.55, 0);
      this.limb(_m1, parts.heads, i * 2 + 1, 1.88, 0.72, 0.55, 0);
      this.limb(_m1, parts.tails, i * 2, -1.88, 0.72, -0.55, 0);
      this.limb(_m1, parts.tails, i * 2 + 1, -1.88, 0.72, 0.55, 0);
    }
    for (const mesh of Object.values(parts)) mesh.instanceMatrix.needsUpdate = true;
  }

  createWeather(region, random) {
    // The generator always runs the full sequence; the tier decides how many drops draw.
    const total = 1700;
    const positions = new Float32Array(total * 3);
    for (let i = 0; i < total; i += 1) {
      positions[i * 3] = -150 + random() * 300;
      positions[i * 3 + 1] = random() * 90;
      positions[i * 3 + 2] = -150 + random() * 300;
    }
    const rain = createPoints({
      positions,
      size: 0.14,
      material: {
        color: 0xb9d7ff,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      },
    });
    this.own(rain.material); // (a Sprite's geometry is shared by every sprite: never dispose it)
    rain.setCount(this.kit.detail(total, 300));
    rain.object.visible = region.weather === 'rain';
    this.rain = rain;
    this.environment.add(rain.object);
  }

  /* ------------------------------------------------------------ settings */

  applySettings(settings) {
    if (!settings) return;
    this.renderer.shadowMap.enabled = settings.shadows !== false;
    this.bloomOn = settings.bloom !== false;
    if (this.post.bloom) this.post.bloom.strength.value = this.bloomOn ? 0.52 : 0;
    if (settings.reducedMotion) this.distance = Math.max(this.distance, 8.5);
  }

  setBlocked(blocked) {
    this.blocked = blocked;
  }

  setTarget(id) {
    this.activeTarget = id || null;
    this.markers.forEach((marker, key) => {
      const on = key === this.activeTarget;
      const u = marker.userData;
      u.ring.material.opacity = on ? 0.95 : 0.52;
      u.beam.material.opacity = on ? 0.2 : 0.065;
      u.label.material.opacity = on ? 1 : 0.82;
      u.beacon.scale.setScalar(on ? 1.35 : 1);
    });
  }

  teleport(id, offset = 3) {
    const loc = LOCATIONS[id];
    if (!loc) return;
    this.player.position.set(loc.x + offset, 0, loc.z + offset * 0.45);
    this.updateCamera(0.016, true);
    this.syncPosition();
  }

  syncPosition() {
    if (!this.state?.world) return;
    this.state.world.x = Number(this.player.position.x.toFixed(3));
    this.state.world.z = Number(this.player.position.z.toFixed(3));
    this.onMove?.(this.state.world.x, this.state.world.z);
  }

  collides(x, z) {
    if (x < -CITY_LIMIT || x > CITY_LIMIT || z < -CITY_LIMIT || z > CITY_LIMIT) return true;
    for (const c of this.colliders) if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true;
    return false;
  }

  /* ------------------------------------------------------------ frame */

  updatePlayer(dt) {
    const input = this.kit.input;
    const parts = this.playerParts;
    const mv = this.blocked ? null : input.vector('move');
    const amount = mv ? Math.min(1, Math.hypot(mv.x, mv.y)) : 0;
    this.isMoving = amount > 0.08;
    if (this.isMoving) {
      const energy = this.state?.player?.energy ?? 70;
      // Run with Shift / B / LT, or by pushing the touch stick all the way.
      const wantsRun = input.down('run') || (input.source === 'touch' && amount > 0.94);
      this.isRunning = wantsRun && energy > 12;
      const forward = _v1.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const right = _v2.crossVectors(forward, UP).normalize();
      const dir = _v3.set(0, 0, 0).addScaledVector(forward, mv.y).addScaledVector(right, mv.x);
      if (dir.lengthSq() > 1) dir.normalize();
      const pace = 0.72 + clamp(energy) / 250;
      const step = (this.isRunning ? 9.7 : 5.8) * pace * dt;
      const x0 = this.player.position.x;
      const z0 = this.player.position.z;
      const x1 = x0 + dir.x * step;
      const z1 = z0 + dir.z * step;
      if (!this.collides(x1, z0)) this.player.position.x = x1;
      if (!this.collides(this.player.position.x, z1)) this.player.position.z = z1;
      // Turn smoothly toward the direction of travel.
      const want = Math.atan2(dir.x, dir.z);
      let delta = want - this.facing;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.facing += delta * Math.min(1, dt * 14);
      this.player.rotation.y = this.facing;
      this.walkPhase += dt * (this.isRunning ? 12 : 8) * Math.max(0.5, amount);
      const swing = Math.sin(this.walkPhase) * (this.isRunning ? 0.65 : 0.43) * Math.max(0.5, amount);
      parts.leftLeg.rotation.x = swing;
      parts.rightLeg.rotation.x = -swing;
      parts.leftArm.rotation.x = -swing * 0.72;
      parts.rightArm.rotation.x = swing * 0.72;
      parts.torso.position.y = 1.55 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.035;
      this.syncPosition();
    } else {
      this.isRunning = false;
      const k = Math.min(1, dt * 8);
      parts.leftLeg.rotation.x *= 1 - k;
      parts.rightLeg.rotation.x *= 1 - k;
      parts.leftArm.rotation.x *= 1 - k;
      parts.rightArm.rotation.x *= 1 - k;
      parts.torso.position.y += (1.55 - parts.torso.position.y) * k;
    }
  }

  updateCameraInput(dt) {
    if (this.blocked) return;
    const input = this.kit.input;
    const look = input.look('look');
    // The kit's look is radians of turn; the original orbit turned about twice as fast
    // per mouse pixel. A stick or a thumb already turns briskly, so they get less.
    const source = input.source;
    const yawRate = source === 'gamepad' ? 1.2 : source === 'touch' ? 1 : 2;
    const pitchRate = source === 'keyboard' ? 1.45 : 0.7;
    this.yaw -= look.x * yawRate;
    this.pitch = clamp(this.pitch + look.y * pitchRate, 0.12, 1.03);
    let zoom = -input.zoom() * 0.8;
    if (input.down('zoomIn')) zoom -= dt * 6;
    if (input.down('zoomOut')) zoom += dt * 6;
    if (zoom) this.distance = clamp(this.distance + zoom, 5.2, 14.5);
    const dragging = input.pointer.down && input.pointer.type === 'mouse';
    if (dragging !== this.dragging) {
      this.dragging = dragging;
      this.kit.canvas.classList.toggle('dragging', dragging);
    }
  }

  /**
   * Clip the segment against one axis slab, narrowing [slabIn, slabOut].
   * Returns false once the segment misses the box.
   */
  slab(origin, delta, min, max) {
    if (Math.abs(delta) < 1e-6) return origin >= min && origin <= max;
    let a = (min - origin) / delta;
    let b = (max - origin) / delta;
    if (a > b) {
      const swap = a;
      a = b;
      b = swap;
    }
    if (a > this.slabIn) this.slabIn = a;
    if (b < this.slabOut) this.slabOut = b;
    return this.slabIn <= this.slabOut;
  }

  /** Pull the camera in front of any building between it and the avatar. */
  clipCamera(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    let hit = 1;
    for (const b of this.buildings) {
      this.slabIn = 0;
      this.slabOut = 1;
      if (
        this.slab(from.x, dx, b.minX - 0.4, b.maxX + 0.4) &&
        this.slab(from.y, dy, -1, b.maxY) &&
        this.slab(from.z, dz, b.minZ - 0.4, b.maxZ + 0.4)
      ) {
        hit = Math.min(hit, this.slabIn);
      }
    }
    if (hit < 1) {
      const k = Math.max(0.12, hit - 0.03);
      to.set(from.x + dx * k, from.y + dy * k, from.z + dz * k);
    }
    return to;
  }

  updateCamera(dt, snap = false) {
    const focus = _target.set(this.player.position.x, 1.7, this.player.position.z);
    const flat = Math.cos(this.pitch) * this.distance;
    const desired = _v1.set(
      focus.x + Math.sin(this.yaw) * flat,
      focus.y + Math.sin(this.pitch) * this.distance + 1,
      focus.z + Math.cos(this.yaw) * flat,
    );
    this.clipCamera(focus, desired);
    const k = snap ? 1 : 1 - Math.pow(0.0006, dt);
    this.camera.position.lerp(desired, k);
    this.camera.lookAt(focus);
  }

  updateLighting(state, dt) {
    const dayFraction = state.minute / 1440;
    const angle = (dayFraction - 0.25) * Math.PI * 2;
    const daylight = clamp(Math.sin(angle) * 0.72 + 0.28, 0, 1);
    const golden =
      clamp(1 - Math.abs(dayFraction - 0.75) * 8, 0, 1) + clamp(1 - Math.abs(dayFraction - 0.25) * 8, 0, 1);
    this.sun.position.set(
      Math.cos(angle) * 100,
      Math.max(12, Math.sin(angle) * 105),
      Math.sin(angle * 0.86) * 75,
    );
    this.sun.intensity = 0.12 + daylight * 2 + golden * 0.25;
    this.sun.color.setHex(daylight > 0.15 ? 0xffdfc4 : 0x8da7ff);
    this.hemi.intensity = 0.28 + daylight * 0.85;
    this.moonLight.intensity = 0.1 + (1 - daylight) * 0.46;
    this.skyMixColor.copy(this.nightSkyColor).lerp(this.daySkyColor, daylight * 0.86);
    this.fogMixColor.copy(this.nightFogColor).lerp(this.daySkyColor, daylight * 0.55);
    this.scene.background.copy(this.skyMixColor);
    this.scene.fog.color.copy(this.fogMixColor);
    // Mist and rain thicken the air; the change eases in.
    const weather = state.world?.weather;
    const wantFog = weather === 'mist' ? 0.0125 : weather === 'rain' ? 0.0085 : 0.007;
    this.fogDensity += (wantFog - this.fogDensity) * Math.min(1, dt * 0.8);
    this.scene.fog.density = this.fogDensity;
    this.stars.material.color.copy(this.starColor).lerp(this.skyMixColor, clamp(daylight * 1.15, 0, 1));
    this.stars.object.visible = daylight < 0.86;
    this.moon.material.opacity = 1 - daylight;
    for (const light of this.streetLights) light.intensity = 0.2 + (1 - daylight) * 1.15;
    this.renderer.toneMappingExposure = 0.92 + daylight * 0.24;
    if (this.post.bloom) this.post.bloom.strength.value = this.bloomOn ? 0.38 + (1 - daylight) * 0.34 : 0;
  }

  updateWeather(dt, state) {
    if (!this.rain) return;
    const raining = state.world.weather === 'rain';
    this.rain.object.visible = raining;
    if (!raining) return;
    const array = this.rain.positions.array;
    const n = this.rain.object.count * 3;
    for (let i = 0; i < n; i += 3) {
      array[i] -= dt * 4.5;
      array[i + 1] -= dt * 34;
      if (array[i + 1] < 0) array[i + 1] = 85;
      if (array[i] < -155) array[i] = 155;
    }
    this.rain.positions.needsUpdate = true;
  }

  updateMarkers(time, detect = true) {
    let closest = null;
    let best = Infinity;
    this.markers.forEach((marker, id) => {
      const on = id === this.activeTarget;
      const u = marker.userData;
      u.ring.scale.setScalar(1 + Math.sin(time * (on ? 4.8 : 2.4) + marker.position.x) * (on ? 0.18 : 0.08));
      u.beacon.rotation.y += on ? 0.035 : 0.016;
      u.beacon.position.y = 2.1 + Math.sin(time * 2.4 + marker.position.z) * 0.15;
      u.label.position.y = 3.25 + Math.sin(time * 1.5 + marker.position.x) * 0.08;
      if (!detect) return;
      const d = this.player.position.distanceTo(marker.position);
      if (d < best) {
        closest = u.location;
        best = d;
      }
    });
    if (!detect) return;
    const near = best <= 5.2 ? closest : null;
    if (near?.id !== this.nearby?.id) {
      this.nearby = near;
      this.onNearbyChange?.(near, best);
    }
  }

  getNearbyLocation() {
    return this.nearby;
  }

  /**
   * One frame of the city.
   * @param {number} dt       seconds
   * @param {object} state    the career
   * @param {boolean} blocked a menu, panel or dialog has the player's attention
   */
  tick(dt, state, blocked = false) {
    this.state = state;
    this.setBlocked(blocked);
    const step = Math.min(dt, 0.05);
    const time = performance.now() / 1000;
    this.updateCameraInput(step);
    this.updatePlayer(step);
    this.updateCamera(step);
    this.updateLighting(state, step);
    if (!state.settings.reducedMotion) {
      this.updateCrowd(step);
      this.updateTraffic(step);
      this.updateWeather(step, state);
    } else if (this.rain) {
      this.rain.object.visible = false;
    }
    this.updateMarkers(time);
    this.playerAura.material.opacity = 0.12 + Math.sin(time * 4) * 0.035;
  }

  /**
   * The title screen: a slow night-time orbit high over the district behind
   * the start card. No avatar, no input; crowds, traffic and rain keep moving.
   */
  idle(dt) {
    const step = Math.min(dt, 0.05);
    const time = performance.now() / 1000;
    this.player.visible = false;
    this.idleAngle += step * 0.04;
    this.camera.position.set(Math.sin(this.idleAngle) * 100, 72, Math.cos(this.idleAngle) * 100);
    this.camera.lookAt(0, 6, 0);
    IDLE_STATE.world.weather = this.region?.weather || 'clear';
    this.updateLighting(IDLE_STATE, step);
    // Thinner air than at street level, so the far blocks read from up here.
    this.scene.fog.density = 0.0042;
    this.updateCrowd(step);
    this.updateTraffic(step);
    this.updateWeather(step, IDLE_STATE);
    this.updateMarkers(time, false);
  }

  render() {
    this.post.render();
  }
}

/** The clock and weather the title-screen flyover is lit by (half past nine at night). */
const IDLE_STATE = { minute: 1290, world: { weather: 'clear' } };
