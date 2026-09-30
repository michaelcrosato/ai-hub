/**
 * engine.js — the Neon Gauntlet arena: the three.js scene, the fixed-step
 * simulation (player, weapons, hostiles, hazards, pickups), rooms and
 * physical route doors, bosses, the campaign, and the new Prize Studio bonus
 * round and Overtime mode.
 *
 * It draws with kit.renderer through kit/post.js (bloom on every tier) and
 * reads only kit.input actions. Everything the DOM shows goes out through the
 * callbacks (see main.js); the host (Iona) listens to onBroadcast.
 */

import * as THREE from 'three/webgpu';
import { instanceColor } from 'three/tsl';
import { createPost } from 'kit/post.js';
import {
  ARENA_X,
  ARENA_Z,
  ROOMS_PER_LEVEL,
  DIRECTIONS,
  REINFORCED_MAX_HP,
  REINFORCED_REPAIR,
  LEVELS,
  ENEMIES,
  WEAPONS,
  WEAPON_LABELS,
  SILHOUETTES,
  UPGRADES,
  CONTRACTS,
  OVERTIME_UPGRADE_EVERY,
  PRIZE_ROUND_SECONDS,
  PRIZES,
  isBoss,
  nextLevel,
  enemyColor,
  emptyWeaponKills,
  roomFor,
  openingRoom,
  bossDoor,
  nextLevelDoor,
  campaignExitDoor,
  routeChoices,
  overtimeChoices,
  overtimeTheme,
  oppositeDirection,
  pickPrize,
  loadCampaign,
  saveCampaign,
  saveLegacyBest,
  selectLevel,
  recordLevelClear,
} from './data.js';

const STEP = 1 / 60;
const X = ARENA_X;
const Z = ARENA_Z;
const { clamp, lerp } = THREE.MathUtils;
const pad2 = (n) => String(n).padStart(2, '0');
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

/** Particle budget per quality tier (the original's numbers). */
const PARTICLE_CAP = { low: 120, medium: 260, high: 480, ultra: 800 };
/** Bloom stays on at every tier (the look is neon); only its strength eases off. */
const BLOOM_STRENGTH = { low: 0.45, medium: 0.52, high: 0.82, ultra: 1.05 };
const SHADOW_TIERS = new Set(['high', 'ultra']);

const PICKUP_COLORS = { cash: 0xffc857, health: 0x94ff54, weapon: 0x23e6ff, bomb: 0xff2d87 };
const PRIZE_COLORS = [0x23e6ff, 0xff2d87, 0xff8b2d, 0xffd15c];
const MAX_PRIZES = 12;

/** The camera looks at this point from this offset; narrow screens pull it back so the whole arena fits. */
const CAMERA_TARGET = new THREE.Vector3(0, 0, -1.2);
const CAMERA_OFFSET = new THREE.Vector3(0, 22.8, 19.8);
const CAMERA_FOV = 46;
const FOG_DENSITY = 0.025;

/** Difficulty "room" for an Overtime wave: grows slowly, then keeps growing past the campaign's five. */
const overtimeRoom = (wave) => Math.min(8, 1 + Math.floor((wave - 1) / 2));

const IS_DEV = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

function makeBullet() {
  return {
    x: 0, z: 0, vx: 0, vz: 0, life: 0, radius: 0, damage: 0, owner: 'player', pierce: 0, weapon: 'pulse',
    lastHit: -1, effect: 'standard', age: 0, returning: false, hitIds: [], mode: 0,
  };
}

function makeParticle() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, color: 0xffffff, spin: 0 };
}

export class NeonEngine {
  /**
   * @param {object} kit       from boot()
   * @param {import('./audio.js').Sfx} sfx
   * @param {object} callbacks onPhase, onHud, onImpact, onBroadcast, onUpgrade, onRoomChoices, onResult, onCampaignProgress, onTheme
   */
  constructor(kit, sfx, callbacks) {
    this.kit = kit;
    this.input = kit.input;
    this.sfx = sfx;
    this.callbacks = callbacks;
    this.storage = safeStorage();

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 120);
    this.viewScale = 1;
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 2.7);
    this.post = null;
    this.phase = 'boot';
    this.pausedFrom = 'playing';
    this.reducedMotion = false;
    this.contract = CONTRACTS.standard;

    this.player = new THREE.Group();
    this.playerX = 0;
    this.playerZ = 2.5;
    this.playerVX = 0;
    this.playerVZ = 0;
    this.aimX = 0;
    this.aimZ = -1;
    this.playerHealth = 100;
    this.playerMaxHealth = 100;
    this.playerSpeed = 7.6;
    this.fireRateMod = 1;
    this.damageMod = 1;
    this.bonusShots = 0;
    this.bonusPierce = 0;
    this.pickupRadius = 3.4;
    this.dashBase = 1.05;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashBuffer = 0;
    this.invulnerability = 0;
    this.bombs = 2;
    this.baseWeapon = 'pulse';
    this.weapon = 'pulse';
    this.contradictionMode = 0;
    this.weaponTime = 0;
    this.fireCooldown = 0;
    this.muzzleTime = 0;

    this.enemies = [];
    this.bullets = [];
    this.bulletPool = [];
    this.particles = [];
    this.particlePool = [];
    this.pickups = [];
    this.prizes = [];
    this.enemyMeshes = {};
    this.shockwaves = [];
    this.environmentLights = [];
    this.routeDoors = new Map();
    this.hazardVisuals = [];
    this.hazards = [];

    // Input sampled once per frame (the simulation runs in fixed steps).
    this.moveX = 0;
    this.moveZ = 0;
    this.stickAimX = 0;
    this.stickAimZ = 0;
    this.stickAimLen = 0;
    this.mouseAim = false;
    this.fireHeld = false;
    this.dashRequested = false;
    this.bombRequested = false;
    // Set when combat (re)starts: the press that started it (A is also Dash, B also Wipe) is not replayed.
    this.pressGuard = false;
    this.pointerWorld = new THREE.Vector3(0, 0, -4);
    this.pointerNdc = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Player position history (Hostile Playback and Echoes read it): a ring buffer, no per-step allocation.
    this.historyX = new Float32Array(300);
    this.historyZ = new Float32Array(300);
    this.historyCount = 0;
    this.historyHead = 0;
    this.sample = { x: 0, z: 0, ok: false };

    this.elapsed = 0;
    this.currentLevel = 1;
    this.campaignProgress = loadCampaign(this.storage);
    this.overtime = false;
    this.wave = 0;
    this.encores = 0;
    this.room = 1;
    this.roomsCleared = 0;
    this.currentRoom = openingRoom(1);
    this.backDirection = 'SOUTH';
    this.previousRoomId = undefined;
    this.pendingRoomChoices = [];
    this.roomSpawnTarget = 0;
    this.roomSpawned = 0;
    this.roomKills = 0;
    this.roomCombatTime = 0;
    this.roomClearCommitted = false;
    this.routeGateDelay = 0;
    this.routeGateArmed = false;
    this.routeAssistDirection = null;
    this.bossRoom = false;
    this.earlyBeatEmitted = false;
    this.lateBeatEmitted = false;
    this.kills = 0;
    this.score = 0;
    this.best = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.damageTaken = 0;
    this.bombsUsed = 0;
    this.dashesUsed = 0;
    this.weaponKills = emptyWeaponKills();
    this.spawnTimer = 0.4;
    this.upgradeStage = 0;
    this.pendingUpgradeIds = [];
    this.bossPhase = 1;
    this.criticalHealthActive = false;
    this.victoryCountdown = -1;
    this.nextEntityId = 1;
    this.weaponDropIndex = 0;
    this.rngState = 5370206;
    this.routeRngState = 2654435769 | 0;
    this.nextHazardId = 1;
    this.mechanicTimer = 2.8;
    this.mechanicStatus = 'FORECAST TRAINING // LIVE';
    this.forecastBlindTime = 0;
    this.forecastBlindCooldown = 18;
    this.levelCompleteCommitted = false;

    // Prize Studio.
    this.prizeRound = false;
    this.prizeClock = 0;
    this.prizeSpawnTimer = 0;
    this.prizesClaimed = 0;
    this.prizeTick = 6;
    this.prizeHalfBeat = false;

    this.accumulator = 0;
    this.lastHud = 0;
    this.cameraTrauma = 0;
    this.tempObject = new THREE.Object3D();
    this.tempColor = new THREE.Color();
    this.projectVector = new THREE.Vector3();
    this.silhouetteCounts = Object.fromEntries(SILHOUETTES.map((s) => [s, 0]));
    this.hud = {};
  }

  /* ------------------------------------------------------------------ setup */

  async init() {
    const renderer = this.kit.renderer;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = new THREE.Color(0x03070d);
    this.scene.fog = new THREE.FogExp2(0x071018, FOG_DENSITY);
    this.buildScene();

    this.kit.fitCamera(this.camera);
    this.kit.onResize((w, h) => this.fitView(w, h));

    this.post = createPost(this.kit, this.scene, this.camera, { bloom: { strength: 0.82, radius: 0.38, threshold: 0.72 } });
    this.applyQuality(this.kit.tier);
    this.kit.onQuality((tier) => this.applyQuality(tier));

    this.currentLevel = this.campaignProgress.lastSelectedLevel;
    this.currentRoom = openingRoom(this.currentLevel);
    this.best = this.campaignProgress.bestByLevel[this.currentLevel] ?? 0;
    this.applyLevelTheme();

    await this.prewarm();

    this.phase = 'menu';
    this.callbacks.onCampaignProgress(this.campaignProgress);
    this.callbacks.onBroadcast({ type: 'system_ready', backend: this.kit.backend });
    this.callbacks.onPhase('menu');
    this.pushHud();
  }

  /** Compile every pipeline up front (hidden effects too) so the first explosion does not stutter. */
  async prewarm() {
    const hidden = [];
    this.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const pools = [...Object.values(this.enemyMeshes), this.bulletPlayerMesh, this.bulletEnemyMesh, this.particleMesh, this.pickupMesh, this.telegraphMesh, this.prizeMesh, this.prizeRingMesh];
    for (const m of pools) m.count = 1;
    try {
      await this.kit.renderer.compileAsync(this.scene, this.camera);
    } catch (err) {
      console.warn('[neon] pipeline prewarm skipped:', err);
    }
    for (const m of pools) m.count = 0;
    for (const o of hidden) o.visible = false;
  }

  buildScene() {
    this.hemisphereLight = new THREE.HemisphereLight(0x86eaff, 0x12081f, 1.9);
    this.scene.add(this.hemisphereLight);
    const sun = this.directionalLight;
    sun.position.set(-7, 18, 11);
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 15, bottom: -15, near: 1, far: 48 });
    sun.shadow.bias = -0.00035;
    sun.shadow.radius = 3;
    this.kit.shadow(sun, 1024);
    this.scene.add(sun);

    this.groundMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a141d,
      roughness: 0.32,
      metalness: 0.66,
      clearcoat: 0.48,
      clearcoatRoughness: 0.28,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 26), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(3.55, 0.09, 2.55),
      new THREE.MeshStandardMaterial({ color: 0x101f29, roughness: 0.54, metalness: 0.5 }),
      80,
    );
    let n = 0;
    for (let row = -4; row <= 4; row += 1)
      for (let col = -4; col <= 4 && n < 80; col += 1) {
        this.tempObject.position.set(col * 3.6, -0.015, row * 2.58);
        this.tempObject.rotation.set(0, 0, 0);
        this.tempObject.scale.set(0.96, 1, 0.94);
        this.tempObject.updateMatrix();
        tiles.setMatrixAt(n, this.tempObject.matrix);
        tiles.setColorAt(n, this.tempColor.setHex((col + row) % 2 === 0 ? 0x0e1d27 : 0x132631));
        n += 1;
      }
    tiles.count = n;
    tiles.receiveShadow = true;
    this.scene.add(tiles);

    this.gridHelper = new THREE.GridHelper(36, 24, 0x29d8e6, 0x16404f);
    this.gridHelper.position.y = 0.045;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.opacity = 0.24;
    this.scene.add(this.gridHelper);

    this.centerMaterial = new THREE.MeshBasicMaterial({
      color: 0x23e6ff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const centerRing = new THREE.Mesh(new THREE.RingGeometry(2.15, 2.23, 64), this.centerMaterial);
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.y = 0.06;
    this.scene.add(centerRing);

    this.buildArenaWalls();
    this.buildRouteDoors();
    this.buildPlayer();
    this.buildInstancePools();
    this.buildShockwaves();
    this.buildHazardVisuals();
  }

  buildArenaWalls() {
    const t = this.tempObject;
    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x142632,
      emissive: 0x071923,
      emissiveIntensity: 1.2,
      roughness: 0.44,
      metalness: 0.72,
    });
    const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(2.25, 1.15, 0.72), this.wallMaterial, 52);
    let s = 0;
    for (let d = -14; d <= 14; d += 2.35)
      for (const p of [-11.25, 11.25]) {
        t.position.set(d, 0.47, p);
        t.rotation.set(0, 0, 0);
        t.scale.set(1, 1, 1);
        t.updateMatrix();
        walls.setMatrixAt(s++, t.matrix);
      }
    for (let d = -8.7; d <= 8.7; d += 2.4)
      for (const p of [-16.25, 16.25]) {
        t.position.set(p, 0.47, d);
        t.rotation.set(0, Math.PI / 2, 0);
        t.scale.set(1, 1, 1);
        t.updateMatrix();
        walls.setMatrixAt(s++, t.matrix);
      }
    walls.count = s;
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.scene.add(walls);

    this.trimMaterial = new THREE.MeshBasicMaterial({
      color: 0x23e6ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const trims = new THREE.InstancedMesh(new THREE.BoxGeometry(2.18, 0.07, 0.08), this.trimMaterial, s);
    let a = 0;
    for (let d = -14; d <= 14; d += 2.35)
      for (const p of [-10.87, 10.87]) {
        t.position.set(d, 1.04, p);
        t.rotation.set(0, 0, 0);
        t.updateMatrix();
        trims.setMatrixAt(a++, t.matrix);
      }
    for (let d = -8.7; d <= 8.7; d += 2.4)
      for (const p of [-15.87, 15.87]) {
        t.position.set(p, 1.04, d);
        t.rotation.set(0, Math.PI / 2, 0);
        t.updateMatrix();
        trims.setMatrixAt(a++, t.matrix);
      }
    trims.count = a;
    this.scene.add(trims);

    const pillars = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.48, 2.6, 6),
      new THREE.MeshStandardMaterial({
        color: 0x263746,
        emissive: 0xff2d87,
        emissiveIntensity: 2.8,
        metalness: 0.78,
        roughness: 0.25,
      }),
      12,
    );
    const pillarSpots = [
      [-15.5, -10.4],
      [15.5, -10.4],
      [-15.5, 10.4],
      [15.5, 10.4],
      [-7.8, -10.75],
      [7.8, -10.75],
      [-7.8, 10.75],
      [7.8, 10.75],
    ];
    pillarSpots.forEach(([px, pz], i) => {
      t.position.set(px, 1.15, pz);
      t.rotation.set(0, i * 0.4, 0);
      t.updateMatrix();
      pillars.setMatrixAt(i, t.matrix);
    });
    pillars.count = pillarSpots.length;
    pillars.castShadow = true;
    this.scene.add(pillars);

    for (let d = 0; d < 4; d += 1) {
      const light = new THREE.PointLight(d % 2 === 0 ? 0x23e6ff : 0xff2d87, 9, 15, 2);
      const f = (d / 4) * Math.PI * 2 + Math.PI / 4;
      light.position.set(Math.cos(f) * 12.5, 3.4, Math.sin(f) * 8.2);
      this.environmentLights.push(light);
      this.scene.add(light);
    }

    const props = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.48, 1, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x223541, roughness: 0.8, metalness: 0.2 }),
      96,
    );
    for (let d = 0; d < 96; d += 1) {
      const side = d % 4;
      const m = (Math.floor(d / 4) % 24) / 23;
      const px = side < 2 ? lerp(-15, 15, m) : side === 2 ? -17.2 : 17.2;
      const pz = side >= 2 ? lerp(-10, 10, m) : side === 0 ? -12.6 : 12.6;
      const h = 0.55 + this.rand() * 1.65;
      t.position.set(px, h * 0.5, pz);
      t.scale.set(0.72, h, 0.72);
      t.rotation.set(0, this.rand() * Math.PI, 0);
      t.updateMatrix();
      props.setMatrixAt(d, t.matrix);
      props.setColorAt(d, this.tempColor.setHex(d % 5 === 0 ? 0x684060 : 0x18303d));
    }
    t.scale.set(1, 1, 1);
    this.scene.add(props);
  }

  buildRouteDoors() {
    const portalGeo = new THREE.PlaneGeometry(3.7, 3.15);
    const postGeo = new THREE.BoxGeometry(0.26, 3.7, 0.34);
    const lintelGeo = new THREE.BoxGeometry(4.35, 0.28, 0.34);
    for (const direction of DIRECTIONS) {
      const group = new THREE.Group();
      const frameMaterial = new THREE.MeshStandardMaterial({
        color: 0x23e6ff,
        emissive: 0x23e6ff,
        emissiveIntensity: 3.2,
        metalness: 0.74,
        roughness: 0.22,
      });
      const portal = new THREE.Mesh(
        portalGeo,
        new THREE.MeshBasicMaterial({
          color: 0x23e6ff,
          transparent: true,
          opacity: 0.28,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const left = new THREE.Mesh(postGeo, frameMaterial);
      const right = new THREE.Mesh(postGeo, frameMaterial);
      const lintel = new THREE.Mesh(lintelGeo, frameMaterial);
      left.position.x = -2.05;
      right.position.x = 2.05;
      lintel.position.y = 1.72;
      portal.position.z = 0.05;
      group.add(portal, left, right, lintel);
      if (direction === 'NORTH') group.position.set(0, 1.82, -Z - 0.12);
      if (direction === 'SOUTH') group.position.set(0, 1.82, Z + 0.12);
      if (direction === 'WEST') {
        group.position.set(-X - 0.12, 1.82, 0);
        group.rotation.y = Math.PI / 2;
      }
      if (direction === 'EAST') {
        group.position.set(X + 0.12, 1.82, 0);
        group.rotation.y = Math.PI / 2;
      }
      group.visible = false;
      this.routeDoors.set(direction, { group, portal, frameMaterial });
      this.scene.add(group);
    }
  }

  buildPlayer() {
    this.playerBody = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.72, 0),
      new THREE.MeshStandardMaterial({
        color: 0xb9f8ff,
        emissive: 0x23e6ff,
        emissiveIntensity: 3.1,
        roughness: 0.24,
        metalness: 0.82,
      }),
    );
    this.playerBody.position.y = 0.78;
    this.playerBody.castShadow = true;
    this.player.add(this.playerBody);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: 0xf4f7fb }));
    core.position.y = 0.8;
    this.player.add(core);
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 1.18),
      new THREE.MeshStandardMaterial({
        color: 0x202f3c,
        emissive: 0x23e6ff,
        emissiveIntensity: 1.6,
        metalness: 0.9,
        roughness: 0.22,
      }),
    );
    barrel.position.set(0, 0.72, 0.78);
    this.player.add(barrel);
    this.playerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.045, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0x23e6ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending }),
    );
    this.playerRing.rotation.x = Math.PI / 2;
    this.playerRing.position.y = 0.08;
    this.player.add(this.playerRing);
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xf4f7fb, blending: THREE.AdditiveBlending }),
    );
    this.muzzle.position.set(0, 0.72, 1.45);
    this.muzzle.visible = false;
    this.player.add(this.muzzle);
    this.player.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.player);
  }

  /** An instanced mesh whose instance colours exist from the start (no pipeline rebuild mid-game). */
  coloredPool(geometry, material, capacity) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // Instances roam the whole arena; three.js caches an instanced mesh's bounds once, so skip culling.
    mesh.frustumCulled = false;
    return mesh;
  }

  buildInstancePools() {
    const shapes = {
      rush: new THREE.IcosahedronGeometry(0.58, 0),
      ranged: new THREE.DodecahedronGeometry(0.65, 0),
      charge: new THREE.ConeGeometry(0.68, 1.35, 4),
      heavy: new THREE.BoxGeometry(1.15, 1.15, 1.15, 1, 1, 1),
      boss: new THREE.IcosahedronGeometry(1.9, 1),
    };
    for (const silhouette of SILHOUETTES) {
      const boss = silhouette === 'boss';
      const material = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, metalness: 0.55, roughness: 0.28 });
      // Hostiles glow in their own colour (and flash white when hit): the emissive follows the instance colour.
      material.emissiveNode = instanceColor.mul(boss ? 2.6 : 1.9);
      const mesh = this.coloredPool(shapes[silhouette], material, boss ? 2 : 220);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.enemyMeshes[silhouette] = mesh;
      this.scene.add(mesh);
    }

    this.bulletPlayerMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.16, 0),
      new THREE.MeshBasicMaterial({ color: 0xb9f8ff, blending: THREE.AdditiveBlending }),
      1000,
    );
    this.bulletEnemyMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.18, 0),
      new THREE.MeshBasicMaterial({ color: 0xff4b45, blending: THREE.AdditiveBlending }),
      1000,
    );
    for (const m of [this.bulletPlayerMesh, this.bulletEnemyMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
    }
    this.scene.add(this.bulletPlayerMesh, this.bulletEnemyMesh);

    this.particleMesh = this.coloredPool(
      new THREE.ConeGeometry(0.13, 0.38, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true }),
      900,
    );
    this.scene.add(this.particleMesh);

    const pickupMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, metalness: 0.65, roughness: 0.2 });
    pickupMaterial.emissiveNode = instanceColor.mul(2.4);
    this.pickupMesh = this.coloredPool(new THREE.OctahedronGeometry(0.36, 0), pickupMaterial, 100);
    this.scene.add(this.pickupMesh);

    this.telegraphMesh = new THREE.InstancedMesh(
      new THREE.RingGeometry(0.72, 0.86, 24),
      new THREE.MeshBasicMaterial({
        color: 0xffc857,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
      220,
    );
    this.telegraphMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.telegraphMesh.count = 0;
    this.telegraphMesh.frustumCulled = false;
    this.scene.add(this.telegraphMesh);

    // Prize Studio: gift boxes on a glowing floor ring, one colour per prize tier.
    const prizeMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.3 });
    prizeMaterial.emissiveNode = instanceColor.mul(1.7);
    this.prizeMesh = this.coloredPool(new THREE.BoxGeometry(0.62, 0.62, 0.62), prizeMaterial, MAX_PRIZES);
    this.prizeMesh.castShadow = true;
    this.scene.add(this.prizeMesh);
    this.prizeRingMesh = this.coloredPool(
      new THREE.RingGeometry(0.66, 0.8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_PRIZES,
    );
    this.scene.add(this.prizeRingMesh);
  }

  buildShockwaves() {
    const geometry = new THREE.RingGeometry(0.82, 1, 48);
    for (let e = 0; e < 16; e += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x23e6ff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.scene.add(mesh);
      this.shockwaves.push({ mesh, life: 0, maxLife: 0.4, start: 0.2, end: 4 });
    }
  }

  buildHazardVisuals() {
    const geometry = new THREE.PlaneGeometry(1, 1);
    for (let t = 0; t < 40; t += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffc857,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.07;
      mesh.visible = false;
      this.hazardVisuals.push(mesh);
      this.scene.add(mesh);
    }
  }

  applyLevelTheme() {
    const def = LEVELS[this.currentLevel];
    this.scene.background.set(def.background);
    this.scene.fog.color.set(def.background).lerp(this.tempColor.set(def.accent), 0.12);
    this.baseFogDensity = this.currentLevel === 4 ? 0.034 : FOG_DENSITY;
    this.scene.fog.density = this.baseFogDensity / this.viewScale;
    this.groundMaterial.color.set(def.floor);
    this.wallMaterial.color.set(def.floor).lerp(this.tempColor.set(def.accent), 0.14);
    this.wallMaterial.emissive.set(def.background);
    this.trimMaterial.color.set(def.accent);
    this.centerMaterial.color.set(def.accent);
    this.gridHelper.material.color.set(def.accent);
    this.hemisphereLight.color.set(def.accent);
    this.hemisphereLight.groundColor.set(def.background);
    this.directionalLight.color.set(def.secondary);
    this.environmentLights.forEach((light, i) => light.color.set(i % 2 === 0 ? def.accent : def.secondary));
    this.callbacks.onTheme?.(def);
  }

  /** Keep the whole arena in view on narrow and portrait screens by pulling the camera back. */
  fitView(w, h) {
    const aspect = w / Math.max(1, h);
    const halfTan = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2));
    const visibleHalfWidth = halfTan * aspect * CAMERA_OFFSET.length();
    this.viewScale = Math.max(1, 17 / visibleHalfWidth);
    this.camera.far = 120 * this.viewScale;
    this.camera.updateProjectionMatrix();
    if (this.scene.fog) this.scene.fog.density = (this.baseFogDensity ?? FOG_DENSITY) / this.viewScale;
    this.updateCamera(0, 0);
  }

  applyQuality(tier) {
    const name = tier?.name ?? 'high';
    this.particleCap = PARTICLE_CAP[name] ?? 480;
    if (this.post?.bloom) this.post.bloom.strength.value = BLOOM_STRENGTH[name] ?? 0.82;
    this.directionalLight.castShadow = SHADOW_TIERS.has(name);
    if (this.particles.length > this.particleCap) {
      while (this.particles.length > this.particleCap) this.particlePool.push(this.particles.pop());
    }
  }

  /* ------------------------------------------------------------------ public controls */

  setContract(id) {
    this.contract = CONTRACTS[id] ?? CONTRACTS.standard;
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
    if (on) this.cameraTrauma = 0;
  }

  start(level = this.currentLevel) {
    if (this.phase === 'boot') return;
    this.sfx.unlock();
    const chosen = Math.min(level, this.campaignProgress.highestUnlockedLevel);
    this.campaignProgress = selectLevel(this.campaignProgress, chosen);
    saveCampaign(this.storage, this.campaignProgress);
    this.callbacks.onCampaignProgress(this.campaignProgress);
    this.resetRun(chosen, { overtime: false });
  }

  startOvertime() {
    if (this.phase === 'boot') return;
    this.sfx.unlock();
    this.resetRun(overtimeTheme(1), { overtime: true });
  }

  restart() {
    if (this.overtime) this.startOvertime();
    else this.start(this.currentLevel);
  }

  pause() {
    if (this.phase !== 'playing' && this.phase !== 'route') return;
    this.pausedFrom = this.phase;
    this.phase = 'paused';
    this.accumulator = 0;
    this.callbacks.onPhase('paused');
    this.callbacks.onBroadcast({ type: 'pause' });
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.sfx.unlock();
    this.phase = this.pausedFrom;
    this.accumulator = 0;
    this.dashRequested = false;
    this.bombRequested = false;
    this.pressGuard = true;
    this.input.settle();
    this.callbacks.onPhase(this.phase);
    this.callbacks.onBroadcast({ type: 'resume' });
  }

  returnToMenu() {
    this.phase = 'menu';
    this.accumulator = 0;
    this.enemies.length = 0;
    this.releaseAllBullets();
    this.pickups.length = 0;
    this.prizes.length = 0;
    this.prizeRound = false;
    this.hazards.length = 0;
    this.pendingRoomChoices = [];
    this.routeAssistDirection = null;
    this.hideRouteDoors();
    this.callbacks.onRoomChoices([]);
    this.playerHealth = this.playerMaxHealth;
    this.player.visible = true;
    this.overtime = false;
    this.callbacks.onPhase('menu');
    this.callbacks.onBroadcast({ type: 'return_to_menu' });
    this.pushHud();
  }

  /** Pick a level on the ready-room rail: the arena re-themes behind the menu. */
  previewLevel(level) {
    if (this.phase !== 'menu' && this.phase !== 'gameover') return;
    if (level === this.currentLevel) return;
    this.currentLevel = level;
    this.applyLevelTheme();
  }

  setBroadcastDucking(on) {
    this.sfx.setDucked(on);
  }

  assistRoute(id) {
    if (this.phase !== 'route') return;
    const door = this.pendingRoomChoices.find((c) => c.id === id);
    if (!door) return;
    this.routeAssistDirection = door.direction;
    this.routeGateArmed = true;
    this.routeGateDelay = 0;
    this.mechanicStatus = `ASSISTED WALK // ${door.direction}`;
    this.callbacks.onImpact({ kind: 'wave', text: `WALKING ${door.direction} // ${door.name}`, color: door.accent });
    this.pushHud();
  }

  selectUpgrade(id) {
    if (this.phase !== 'upgrade' || !this.pendingUpgradeIds.includes(id)) return;
    switch (id) {
      case 'overclock':
        this.fireRateMod *= 1.18;
        break;
      case 'heavyRounds':
        this.damageMod *= 1.25;
        break;
      case 'multishot':
        this.bonusShots = Math.min(2, this.bonusShots + 1);
        break;
      case 'pierce':
        this.bonusPierce += 1;
        break;
      case 'thrusters':
        this.playerSpeed *= 1.14;
        break;
      case 'dashCore':
        this.dashBase *= 0.78;
        break;
      case 'magnet':
        this.pickupRadius *= 1.85;
        break;
      case 'reinforced':
        this.playerMaxHealth += REINFORCED_MAX_HP;
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + REINFORCED_REPAIR);
        break;
    }
    this.pendingUpgradeIds.length = 0;
    this.callbacks.onImpact({ kind: 'pickup', text: UPGRADES[id].name.toUpperCase() });
    this.callbacks.onBroadcast({ type: 'upgrade_selected', id, name: UPGRADES[id].name });
    this.checkRecovered();
    this.sfx.play('pickup');
    this.beginRoomCombat();
  }

  /** The upgrades a sponsor break can offer right now (Split Signal drops out once it is maxed). */
  availableUpgrades() {
    return Object.keys(UPGRADES).filter((id) => id !== 'multishot' || this.bonusShots < 2);
  }

  /* ------------------------------------------------------------------ rooms and routes */

  commitRoomChoice(id) {
    if (this.phase !== 'route') return;
    const door = this.pendingRoomChoices.find((c) => c.id === id);
    if (!door) return;
    this.pendingRoomChoices = [];
    this.routeAssistDirection = null;
    this.callbacks.onRoomChoices([]);
    this.previousRoomId = this.currentRoom.id;
    this.backDirection = oppositeDirection(door.direction);
    this.dashRequested = false;
    this.bombRequested = false;
    this.hideRouteDoors();
    this.callbacks.onImpact({ kind: 'wave', text: `${door.direction} GATE // ${door.name}`, color: door.accent });
    if (door.destination === 'campaignExit') {
      this.finishRun(true);
      return;
    }
    if (door.destination === 'nextLevel') {
      this.beginLevel(door.level);
      return;
    }
    if (this.overtime) {
      this.wave = door.depth;
      this.room = overtimeRoom(this.wave);
      if (door.level !== this.currentLevel) this.switchOvertimeTheme(door.level);
      this.currentRoom = door;
      if (door.destination === 'boss') {
        this.beginBossRoom();
        return;
      }
      this.callbacks.onBroadcast({ type: 'room_selected', choice: door });
      this.applyRoomEntryReward(door.kind);
      if ((this.wave - 1) % OVERTIME_UPGRADE_EVERY === 0) this.triggerUpgrade();
      else this.beginRoomCombat();
      return;
    }
    this.currentRoom = door;
    this.room = door.depth;
    if (door.destination === 'boss') {
      this.beginBossRoom();
      return;
    }
    this.callbacks.onBroadcast({ type: 'room_selected', choice: door });
    this.applyRoomEntryReward(door.kind);
    if (door.depth === 3 || door.depth === 5) this.triggerUpgrade();
    else this.beginRoomCombat();
  }

  /** Overtime moved to another floor: its look, hazards, hostiles and signature weapon. */
  switchOvertimeTheme(level) {
    this.currentLevel = level;
    this.baseWeapon = LEVELS[level].signatureWeapon;
    if (this.weaponTime <= 0) this.weapon = this.baseWeapon;
    this.contradictionMode = 0;
    this.applyLevelTheme();
    this.callbacks.onImpact({ kind: 'streak', text: `NEW FLOOR // ${LEVELS[level].name}`, color: LEVELS[level].accent });
  }

  positionPlayerAtEntry() {
    this.playerX = 0;
    this.playerZ = 0;
    this.aimX = 0;
    this.aimZ = -1;
    if (this.backDirection === 'NORTH') {
      this.playerZ = -Z + 2.15;
      this.aimZ = 1;
    } else if (this.backDirection === 'SOUTH') {
      this.playerZ = Z - 2.15;
      this.aimZ = -1;
    } else if (this.backDirection === 'WEST') {
      this.playerX = -X + 2.15;
      this.aimX = 1;
      this.aimZ = 0;
    } else {
      this.playerX = X - 2.15;
      this.aimX = -1;
      this.aimZ = 0;
    }
    this.playerVX = 0;
    this.playerVZ = 0;
    this.player.position.set(this.playerX, 0, this.playerZ);
    this.player.rotation.y = Math.atan2(this.aimX, this.aimZ);
  }

  showRouteDoors(choices) {
    for (const [direction, door] of this.routeDoors) {
      const choice = choices.find((c) => c.direction === direction);
      door.group.visible = !!choice;
      if (!choice) continue;
      this.tempColor.set(choice.accent);
      door.portal.material.color.copy(this.tempColor);
      door.frameMaterial.color.copy(this.tempColor);
      door.frameMaterial.emissive.copy(this.tempColor);
    }
  }

  hideRouteDoors() {
    for (const door of this.routeDoors.values()) door.group.visible = false;
  }

  applyRoomEntryReward(kind) {
    switch (kind) {
      case 'jackpot': {
        const purse = this.scored(750);
        this.score += purse;
        this.callbacks.onImpact({ kind: 'pickup', text: `ENTRY PURSE +${purse.toLocaleString('en-US')}`, color: '#ffc857' });
        break;
      }
      case 'recovery':
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 30);
        this.callbacks.onImpact({ kind: 'pickup', text: 'HELIX REPAIR +30', color: '#94ff54' });
        break;
      case 'demolition':
        this.bombs = Math.min(4, this.bombs + 1);
        this.callbacks.onImpact({ kind: 'pickup', text: 'SCREEN WIPE +1', color: '#ff8b2d' });
        break;
      case 'armory': {
        const weapons = this.getArmoryWeapons();
        this.weapon = weapons[this.weaponDropIndex++ % weapons.length];
        this.weaponTime = 22;
        this.callbacks.onImpact({ kind: 'pickup', text: WEAPON_LABELS[this.weapon], color: '#23e6ff' });
        this.callbacks.onBroadcast({ type: 'weapon_collected', weapon: WEAPON_LABELS[this.weapon] });
        break;
      }
      default:
        break;
    }
    this.checkRecovered();
  }

  checkRecovered() {
    if (this.criticalHealthActive && this.playerHealth / this.playerMaxHealth > 0.5) {
      this.criticalHealthActive = false;
      this.callbacks.onBroadcast({ type: 'health_recovered', healthPercent: this.playerHealth / this.playerMaxHealth });
    }
  }

  getArmoryWeapons() {
    return Array.from(new Set(['scatter', 'rail', 'rocket', ...this.campaignProgress.unlockedWeapons])).filter(
      (w) => w !== this.baseWeapon,
    );
  }

  /** A score gain adjusted for the contract (difficulty). */
  scored(amount) {
    return Math.round(amount * this.contract.score);
  }

  resetRun(level, { continuing = false, back = 'SOUTH', overtime = false } = {}) {
    this.enemies.length = 0;
    this.releaseAllBullets();
    this.releaseAllParticles();
    this.pickups.length = 0;
    this.prizes.length = 0;
    this.prizeRound = false;
    this.hazards.length = 0;
    this.historyCount = 0;
    this.historyHead = 0;
    this.overtime = overtime;
    this.wave = overtime ? 1 : 0;
    this.encores = 0;
    this.currentLevel = level;
    this.currentRoom = overtime
      ? { ...openingRoom(level), id: 'overtime-1-opening', kicker: 'OVERTIME // WAVE 01' }
      : openingRoom(level);
    this.best = overtime ? this.campaignProgress.overtimeBest : (this.campaignProgress.bestByLevel[level] ?? 0);
    this.baseWeapon = LEVELS[level].signatureWeapon;
    this.weapon = this.baseWeapon;
    this.contradictionMode = 0;
    this.applyLevelTheme();
    this.playerX = 0;
    this.playerZ = 2.5;
    this.playerVX = 0;
    this.playerVZ = 0;
    this.playerHealth = 100;
    this.playerMaxHealth = 100;
    this.playerSpeed = 7.6;
    this.fireRateMod = 1;
    this.damageMod = 1;
    this.bonusShots = 0;
    this.bonusPierce = 0;
    this.pickupRadius = 3.4;
    this.dashBase = 1.05;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashBuffer = 0;
    this.invulnerability = 0;
    this.bombs = 2;
    this.weaponTime = 0;
    this.fireCooldown = 0;
    this.elapsed = 0;
    this.room = 1;
    this.roomsCleared = 0;
    this.backDirection = back;
    this.previousRoomId = undefined;
    this.pendingRoomChoices = [];
    this.routeAssistDirection = null;
    this.roomSpawnTarget = 0;
    this.roomSpawned = 0;
    this.roomKills = 0;
    this.roomCombatTime = 0;
    this.roomClearCommitted = false;
    this.bossRoom = false;
    this.earlyBeatEmitted = false;
    this.lateBeatEmitted = false;
    this.kills = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.multiplier = 1;
    this.comboTimer = 0;
    this.damageTaken = 0;
    this.bombsUsed = 0;
    this.dashesUsed = 0;
    this.weaponKills = emptyWeaponKills();
    this.spawnTimer = 0.6;
    this.upgradeStage = 0;
    this.pendingUpgradeIds.length = 0;
    this.bossPhase = 1;
    this.criticalHealthActive = false;
    this.victoryCountdown = -1;
    this.weaponDropIndex = 0;
    this.rngState = (Date.now() ^ 5370206) | 0;
    this.routeRngState = (Date.now() ^ 2654435769) | 0;
    this.nextHazardId = 1;
    this.mechanicTimer = 2.8;
    this.mechanicStatus = `${LEVELS[level].mechanicName} // LIVE`;
    this.forecastBlindTime = 0;
    this.forecastBlindCooldown = 18;
    this.levelCompleteCommitted = false;
    this.callbacks.onRoomChoices([]);
    this.callbacks.onBroadcast(
      continuing
        ? { type: 'level_started', level, levelName: LEVELS[level].name }
        : { type: 'run_start', level, levelName: LEVELS[level].name, overtime },
    );
    this.beginRoomCombat();
  }

  beginLevel(level) {
    this.resetRun(level, { continuing: true, back: this.backDirection });
  }

  beginRoomCombat() {
    const room = roomFor(this.currentLevel, this.currentRoom.kind);
    this.enemies.length = 0;
    this.releaseAllBullets();
    this.pickups.length = 0;
    this.prizes.length = 0;
    this.pendingRoomChoices = [];
    this.hideRouteDoors();
    this.prizeRound = this.currentRoom.kind === 'prize';
    this.roomSpawnTarget = this.prizeRound
      ? 999
      : 7 + this.room * 2 + room.targetBonus + Math.min(3, this.currentLevel - 1);
    this.roomSpawned = 0;
    this.roomKills = 0;
    this.roomCombatTime = 0;
    this.roomClearCommitted = false;
    this.bossRoom = false;
    this.spawnTimer = 0.42;
    this.setupRoomMechanic();
    this.positionPlayerAtEntry();
    this.player.visible = true;
    this.dashRequested = false;
    this.bombRequested = false;
    this.dashBuffer = 0;
    this.invulnerability = Math.max(this.invulnerability, 0.72);
    if (this.prizeRound) {
      this.prizeClock = PRIZE_ROUND_SECONDS;
      this.prizeSpawnTimer = 1.1;
      this.prizesClaimed = 0;
      this.prizeTick = 6;
      this.prizeHalfBeat = false;
      for (let i = 0; i < 5; i += 1) this.spawnPrize();
    }
    this.phase = 'playing';
    this.accumulator = 0;
    this.pressGuard = true;
    this.input.settle();
    this.callbacks.onPhase('playing');
    this.callbacks.onRoomChoices([]);
    this.callbacks.onImpact({
      kind: 'wave',
      text: this.overtime
        ? `OVERTIME ${pad2(this.wave)} // ${this.currentRoom.name}`
        : `LEVEL ${pad2(this.currentLevel)} // ${this.currentRoom.name}`,
      color: this.currentRoom.accent,
    });
    this.callbacks.onBroadcast({ type: 'room_started', room: this.currentRoom, target: this.roomSpawnTarget });
    this.sfx.play('wave');
    const accent = this.tempColor.set(this.currentRoom.accent);
    this.scene.fog.color.copy(accent).lerp(new THREE.Color(0x071018), 0.76);
    this.environmentLights.forEach((light, i) => {
      if (i % 2 === 0) light.color.copy(accent);
      else light.color.setHex(0xff2d87);
    });
    this.pushHud();
  }

  /* ------------------------------------------------------------------ frame */

  /** Called by the kit loop every frame. */
  frame(dt, t) {
    const step = Math.min(0.05, dt);
    if (this.phase === 'playing' || this.phase === 'route') {
      this.sampleInput();
      const phase = this.phase;
      this.accumulator = Math.min(this.accumulator + step, STEP * 4);
      while (this.phase === phase && this.accumulator >= STEP) {
        if (phase === 'playing') this.updateGame(STEP);
        else this.updateRouteTraversal(STEP);
        this.accumulator -= STEP;
      }
    } else if (this.phase === 'menu' || this.phase === 'gameover') {
      this.updateAttractMode(step, t);
    }
    if (this.phase !== 'paused') this.updatePresentation(step, t);
    this.post.render();
    if (t - this.lastHud > 0.09 || t < this.lastHud) {
      this.lastHud = t;
      this.pushHud();
    }
  }

  /** Read the actions once per frame; presses are latched until a fixed step consumes them. */
  sampleInput() {
    const input = this.input;
    const move = input.vector('move');
    this.moveX = move.x;
    this.moveZ = -move.y;
    const aim = input.vector('aim');
    this.stickAimX = aim.x;
    this.stickAimZ = -aim.y;
    this.stickAimLen = Math.hypot(aim.x, aim.y);
    this.mouseAim = input.source === 'keyboard';
    if (this.mouseAim && input.pointer.over) {
      this.pointerNdc.set(input.pointer.nx, input.pointer.ny);
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      this.raycaster.ray.intersectPlane(this.floorPlane, this.pointerWorld);
    }
    // Twin-stick: a deflected right stick (or right thumb) fires on its own.
    const autoFire = this.stickAimLen > (input.source === 'touch' ? 0.2 : 0.67);
    this.fireHeld = input.down('fire') || autoFire;
    if (this.pressGuard) {
      this.pressGuard = false;
      return;
    }
    if (this.phase === 'playing') {
      if (input.pressed('dash')) this.dashRequested = true;
      if (input.pressed('bomb')) this.bombRequested = true;
      if (IS_DEV && input.pressed('debugSkip')) this.debugSkip();
    }
  }

  /** F8 on localhost: finish the room (or hurt the boss) for quick checks. */
  debugSkip() {
    if (this.bossRoom) {
      const boss = this.enemies.find((e) => isBoss(e.type) && !e.dead);
      if (boss) this.damageEnemy(boss, boss.maxHp * 2, 'pulse');
      return;
    }
    if (this.prizeRound) {
      this.prizeClock = 0.01;
      return;
    }
    for (const e of this.enemies) e.dead = true;
    this.roomSpawned = this.roomSpawnTarget;
    this.cleanupEnemies();
    this.checkRoomCompletion();
  }

  updateAttractMode(dt, t) {
    this.player.rotation.y = t * 0.48;
    this.playerBody.rotation.y += dt * 1.6;
    this.playerRing.rotation.z += dt * 0.9;
    this.player.position.y = 0.04 + Math.sin(t * 2.2) * 0.05;
    this.environmentLights.forEach((light, i) => {
      light.intensity = 7.5 + Math.sin(t * 2.1 + i * 1.7) * 2.2;
    });
  }

  updateRouteTraversal(dt) {
    this.routeGateDelay = Math.max(0, this.routeGateDelay - dt);
    let mx = this.moveX;
    let mz = this.moveZ;
    if (!this.routeGateArmed && this.routeGateDelay <= 0 && (this.routeAssistDirection !== null || mx * mx + mz * mz < 0.04))
      this.routeGateArmed = true;
    const assisted = this.routeGateArmed && this.routeAssistDirection !== null;
    if (assisted) {
      const dir = this.routeAssistDirection;
      if (dir === 'NORTH' || dir === 'SOUTH') {
        if (Math.abs(this.playerX) > 0.18) {
          mx = -Math.sign(this.playerX);
          mz = 0;
        } else {
          mx = 0;
          mz = dir === 'NORTH' ? -1 : 1;
        }
      } else if (Math.abs(this.playerZ) > 0.18) {
        mx = 0;
        mz = -Math.sign(this.playerZ);
      } else {
        mx = dir === 'WEST' ? -1 : 1;
        mz = 0;
      }
    }
    if (mx * mx + mz * mz > 0.04) {
      this.aimX = mx;
      this.aimZ = mz;
    }
    const k = 1 - Math.exp(-18 * dt);
    const speed = this.playerSpeed * (assisted ? 2.35 : 1);
    this.playerVX = lerp(this.playerVX, mx * speed, k);
    this.playerVZ = lerp(this.playerVZ, mz * speed, k);
    const has = (d) => this.pendingRoomChoices.some((c) => c.direction === d);
    const lane = 2.25;
    const wall = 0.65;
    const beyond = 1.35;
    let nx = this.playerX + this.playerVX * dt;
    let nz = this.playerZ + this.playerVZ * dt;
    const west = this.routeGateArmed && has('WEST') && Math.abs(nz) <= lane;
    const east = this.routeGateArmed && has('EAST') && Math.abs(nz) <= lane;
    nx = clamp(nx, west ? -X - beyond : -X + wall, east ? X + beyond : X - wall);
    const north = this.routeGateArmed && has('NORTH') && Math.abs(nx) <= lane;
    const south = this.routeGateArmed && has('SOUTH') && Math.abs(nx) <= lane;
    nz = clamp(nz, north ? -Z - beyond : -Z + wall, south ? Z + beyond : Z - wall);
    this.playerX = nx;
    this.playerZ = nz;
    this.player.position.set(this.playerX, 0, this.playerZ);
    if (mx * mx + mz * mz > 0.04) this.player.rotation.y = Math.atan2(this.aimX, this.aimZ);
    if (!this.routeGateArmed) return;
    const through = this.pendingRoomChoices.find((c) =>
      c.direction === 'NORTH'
        ? this.playerZ < -Z - 0.45 && mz < -0.15
        : c.direction === 'SOUTH'
          ? this.playerZ > Z + 0.45 && mz > 0.15
          : c.direction === 'WEST'
            ? this.playerX < -X - 0.45 && mx < -0.15
            : this.playerX > X + 0.45 && mx > 0.15,
    );
    if (through) this.commitRoomChoice(through.id);
  }

  updateGame(dt) {
    this.elapsed += dt;
    this.roomCombatTime += dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.weaponTime = Math.max(0, this.weaponTime - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.combo > 0) {
      this.combo = 0;
      this.multiplier = 1;
    }
    if (this.weaponTime <= 0) this.weapon = this.baseWeapon;
    this.updatePlayer(dt);
    if (this.phase !== 'playing') return;
    this.recordPlayerSample();
    this.updateLevelMechanics(dt);
    if (this.phase !== 'playing') return;
    this.updateEncounter(dt);
    this.updateEnemies(dt);
    if (this.phase !== 'playing') return;
    this.updateBullets(dt);
    if (this.phase !== 'playing') return;
    this.updatePickups(dt);
    if (this.prizeRound) this.updatePrizeRound(dt);
    if (this.phase !== 'playing') return;
    this.cleanupEnemies();
    this.checkRoomCompletion();
    if (this.phase === 'playing' && this.victoryCountdown >= 0) {
      this.victoryCountdown -= dt;
      if (this.victoryCountdown <= 0) this.completeLevel();
    }
  }

  updatePlayer(dt) {
    let ax = 0;
    let az = 0;
    if (this.stickAimLen > 0.18) {
      ax = this.stickAimX;
      az = this.stickAimZ;
    } else if (this.mouseAim) {
      ax = this.pointerWorld.x - this.playerX;
      az = this.pointerWorld.z - this.playerZ;
    }
    if (ax * ax + az * az > 0.05) {
      const l = Math.hypot(ax, az);
      this.aimX = ax / l;
      this.aimZ = az / l;
    }

    // A dash pressed a moment before it recharges still happens (0.15 s buffer).
    if (this.dashRequested) this.dashBuffer = 0.15;
    this.dashRequested = false;
    if (this.dashBuffer > 0 && this.dashCooldown <= 0) {
      this.dashBuffer = 0;
      const ml = Math.hypot(this.moveX, this.moveZ);
      const dx = ml * ml > 0.05 ? this.moveX / ml : this.aimX;
      const dz = ml * ml > 0.05 ? this.moveZ / ml : this.aimZ;
      this.playerVX = dx * 24;
      this.playerVZ = dz * 24;
      this.dashTime = 0.16;
      this.dashCooldown = this.dashBase;
      this.invulnerability = Math.max(this.invulnerability, 0.22);
      this.cameraTrauma = Math.max(this.cameraTrauma, 0.22);
      this.spawnBurst(this.playerX, 0.5, this.playerZ, 0x23e6ff, 14, 5.5);
      this.sfx.play('dash');
      this.input.rumble(0.2, 60);
      this.dashesUsed += 1;
      this.callbacks.onBroadcast({ type: 'dash_used' });
    }
    this.dashBuffer = Math.max(0, this.dashBuffer - dt);

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.playerVX *= 0.96;
      this.playerVZ *= 0.96;
    } else {
      const k = 1 - Math.exp(-18 * dt);
      this.playerVX = lerp(this.playerVX, this.moveX * this.playerSpeed, k);
      this.playerVZ = lerp(this.playerVZ, this.moveZ * this.playerSpeed, k);
    }
    this.playerX = clamp(this.playerX + this.playerVX * dt, -X + 0.65, X - 0.65);
    this.playerZ = clamp(this.playerZ + this.playerVZ * dt, -Z + 0.65, Z - 0.65);
    this.player.position.set(this.playerX, 0, this.playerZ);
    this.player.rotation.y = Math.atan2(this.aimX, this.aimZ);
    this.playerRing.rotation.z += dt * (this.dashCooldown <= 0 ? 2.8 : 0.8);

    if (this.fireHeld && this.fireCooldown <= 0) this.fireWeapon();
    if (this.bombRequested && this.bombs > 0) this.useBomb();
    this.bombRequested = false;
  }

  fireWeapon() {
    const base = WEAPONS[this.weapon];
    const mode = this.weapon === 'contradiction' ? this.contradictionMode : 0;
    const spec =
      this.weapon === 'contradiction'
        ? mode === 0
          ? { ...base, damage: 30, speed: 34, pierce: 2, effect: 'standard' }
          : mode === 1
            ? { ...base, damage: 18, speed: 28, pierce: 0, effect: 'chain' }
            : { ...base, damage: 41, speed: 20, pierce: 0, effect: 'rocket' }
        : base;
    if (this.weapon === 'contradiction') this.contradictionMode = (mode + 1) % 3;
    this.fireCooldown = spec.cooldown / this.fireRateMod;
    const heading = Math.atan2(this.aimZ, this.aimX);
    const count = spec.count + this.bonusShots * 2;
    const spread = spec.spread + (this.bonusShots > 0 ? 0.12 : 0);
    for (let i = 0; i < count; i += 1) {
      const o = count === 1 ? 0 : i / (count - 1) - 0.5;
      const angle = heading + o * spread;
      const cx = Math.cos(angle);
      const cz = Math.sin(angle);
      const b = this.bulletPool.pop() ?? makeBullet();
      b.x = this.playerX + cx * 0.95;
      b.z = this.playerZ + cz * 0.95;
      b.vx = cx * spec.speed;
      b.vz = cz * spec.speed;
      b.life = spec.life;
      b.radius = spec.radius;
      b.damage = spec.damage * this.damageMod;
      b.owner = 'player';
      b.pierce = spec.pierce + this.bonusPierce;
      b.weapon = this.weapon;
      b.lastHit = -1;
      b.effect = spec.effect;
      b.age = 0;
      b.returning = false;
      b.hitIds.length = 0;
      b.mode = mode;
      this.bullets.push(b);
    }
    this.muzzleTime = 0.055;
    this.cameraTrauma = Math.max(this.cameraTrauma, spec.effect === 'rocket' ? 0.16 : 0.04);
    this.sfx.play('shot');
  }

  useBomb() {
    this.bombs -= 1;
    this.bombsUsed += 1;
    this.callbacks.onBroadcast({ type: 'bomb_used', remaining: this.bombs });
    this.invulnerability = Math.max(this.invulnerability, 1);
    this.cameraTrauma = 1;
    this.spawnShockwave(this.playerX, this.playerZ, 0xffc857, 0.7, 18, 0.7);
    this.spawnBurst(this.playerX, 0.8, this.playerZ, 0xffc857, 44, 11);
    for (const e of this.enemies) {
      if (e.dead || e.telegraph > 0) continue;
      const d = Math.hypot(e.x - this.playerX, e.z - this.playerZ);
      if (d < 18) this.damageEnemy(e, isBoss(e.type) ? 180 : 999, 'screenWipe');
    }
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) if (this.bullets[i].owner === 'enemy') this.removeBullet(i);
    this.callbacks.onImpact({ kind: 'bomb', text: 'SCREEN WIPE' });
    this.sfx.play('bomb');
    this.input.rumble(1, 320);
  }

  recordPlayerSample() {
    this.historyX[this.historyHead] = this.playerX;
    this.historyZ[this.historyHead] = this.playerZ;
    this.historyHead = (this.historyHead + 1) % 300;
    this.historyCount = Math.min(300, this.historyCount + 1);
  }

  /** Where the player was `ago` samples back (or the oldest kept sample). */
  historyAgo(ago) {
    const s = this.sample;
    if (this.historyCount === 0) {
      s.ok = false;
      s.x = this.playerX;
      s.z = this.playerZ;
      return s;
    }
    const index = Math.max(0, this.historyCount - ago);
    const slot = (this.historyHead - this.historyCount + index + 600) % 300;
    s.ok = true;
    s.x = this.historyX[slot];
    s.z = this.historyZ[slot];
    return s;
  }

  /* ------------------------------------------------------------------ level mechanics */

  setupRoomMechanic() {
    this.hazards.length = 0;
    this.mechanicTimer = 2.4;
    this.forecastBlindTime = 0;
    this.forecastBlindCooldown = 18;
    const def = LEVELS[this.currentLevel];
    this.mechanicStatus = `${def.mechanicName} // LIVE`;
    if (this.currentLevel === 2) {
      const count = Math.min(3, 1 + Math.floor((this.room - 1) / 2));
      const spots = [
        [-7, -3.8],
        [7, -3.8],
        [0, 4.4],
      ];
      for (let i = 0; i < count; i += 1) {
        const [x, z] = spots[i];
        this.spawnNodeHazard('breaker', x, z, 120 + this.room * 18, 0x27f2ff);
      }
    }
    if (this.currentLevel === 4 && this.room >= 4) this.spawnNodeHazard('memoryStack', 0, 0, 180 + this.room * 20, 0x9d70ff);
  }

  spawnNodeHazard(kind, x, z, hp, color) {
    this.hazards.push({
      id: this.nextHazardId++,
      kind,
      x,
      z,
      width: 1.7,
      length: 1.7,
      radius: 0.9,
      phase: 'node',
      timer: 0,
      activeTime: 0,
      hp,
      maxHp: hp,
      color,
      damage: 0,
      hitPlayer: false,
    });
  }

  spawnHazard(kind, x, z, radius, telegraph, active, damage, color) {
    this.hazards.push({
      id: this.nextHazardId++,
      kind,
      x,
      z,
      width: radius * 2,
      length: radius * 2,
      radius,
      phase: telegraph > 0 ? 'telegraph' : 'field',
      timer: telegraph > 0 ? telegraph : active,
      activeTime: active,
      hp: 0,
      maxHp: 0,
      color,
      damage,
      hitPlayer: false,
    });
  }

  spawnLaneHazard(kind, horizontal, sign, telegraph, active, damage, color) {
    this.hazards.push({
      id: this.nextHazardId++,
      kind,
      x: horizontal ? 0 : sign * 4.8,
      z: horizontal ? sign * 3.5 : 0,
      width: horizontal ? X * 2 : 2.4,
      length: horizontal ? 2.4 : Z * 2,
      radius: 0,
      phase: 'telegraph',
      timer: telegraph,
      activeTime: active,
      hp: 0,
      maxHp: 0,
      color,
      damage,
      hitPlayer: false,
    });
  }

  updateLevelMechanics(dt) {
    this.forecastBlindTime = Math.max(0, this.forecastBlindTime - dt);
    this.forecastBlindCooldown = Math.max(0, this.forecastBlindCooldown - dt);
    for (const h of this.hazards) {
      if (h.phase === 'disabled' || h.phase === 'node') continue;
      h.timer -= dt;
      if (h.phase === 'telegraph' && h.timer <= 0) {
        h.phase = 'active';
        h.timer = h.activeTime;
        h.hitPlayer = false;
      } else if ((h.phase === 'active' || h.phase === 'field') && h.timer <= 0) {
        h.phase = 'disabled';
      }
      if (h.phase !== 'active' || h.hitPlayer || h.damage <= 0) continue;
      const inside =
        h.radius > 0
          ? Math.hypot(this.playerX - h.x, this.playerZ - h.z) <= h.radius + 0.45
          : Math.abs(this.playerX - h.x) <= h.width * 0.5 && Math.abs(this.playerZ - h.z) <= h.length * 0.5;
      if (inside) {
        h.hitPlayer = true;
        this.hurtPlayer(h.damage, this.playerX - h.x, this.playerZ - h.z);
        if (this.phase !== 'playing') return;
      }
    }
    // Drop finished hazards in place (no new array every step).
    let w = 0;
    for (let i = 0; i < this.hazards.length; i += 1) {
      const h = this.hazards[i];
      if (h.phase !== 'disabled') this.hazards[w++] = h;
    }
    this.hazards.length = w;

    this.mechanicTimer -= dt;
    const level = this.currentLevel;
    if (level === 1) {
      this.mechanicStatus = 'FORECAST TRAINING // LIVE';
      return;
    }
    if (level === 2) {
      let breakers = 0;
      for (const h of this.hazards) if (h.kind === 'breaker' && h.phase === 'node') breakers += 1;
      this.mechanicStatus =
        breakers > 0 ? `POWER GRID // ${pad2(breakers)} BREAKERS // WATER LIVE` : 'POWER GRID // GROUNDED';
      if (this.mechanicTimer <= 0 && breakers > 0) {
        this.mechanicTimer = Math.max(3.6, 5.2 - this.room * 0.2);
        this.spawnLaneHazard('electricLane', this.rand() > 0.5, this.rand() > 0.5 ? 1 : -1, 0.9, 0.5, 50, 0x28e7ff);
      }
      return;
    }
    if (level === 3) {
      let remains = 0;
      for (const h of this.hazards) if (h.kind === 'graftRemains' && h.phase === 'field') remains += 1;
      this.mechanicStatus = `RECONSTRUCTION // ${pad2(remains)} REMAINS`;
      if (this.mechanicTimer <= 0) {
        this.mechanicTimer = Math.max(4, 5.8 - this.room * 0.22);
        this.spawnLaneHazard('surgicalSweep', this.rand() > 0.5, this.rand() > 0.5 ? 1 : -1, 0.9, 0.38, 50, 0xff4c9d);
      }
      return;
    }
    if (level === 4) {
      this.mechanicStatus = `PLAYBACK // ECHO IN ${Math.max(0, this.mechanicTimer).toFixed(1)}s`;
      if (this.mechanicTimer <= 0) {
        this.mechanicTimer = Math.max(3.2, 4.8 - this.room * 0.2);
        const past = this.historyAgo(150);
        this.spawnHazard('memoryReplay', past.x, past.z, 1.9, 0.95, 0.42, 50, 0x9d70ff);
      }
      return;
    }
    if (this.bossRoom && this.forecastBlindCooldown <= 0 && this.forecastBlindTime <= 0) {
      this.forecastBlindTime = 9;
      this.forecastBlindCooldown = 27;
      this.callbacks.onImpact({ kind: 'streak', text: 'SIGNAL NINE // FORECAST BLIND' });
    }
    this.mechanicStatus =
      this.forecastBlindTime > 0
        ? `CONTRADICTION WINDOW // ${this.forecastBlindTime.toFixed(1)}s`
        : `PREDICTION // ${Math.min(99, Math.round(62 + this.room * 5))}% // CHANGE VECTOR`;
    if (this.mechanicTimer <= 0 && this.forecastBlindTime <= 0) {
      this.mechanicTimer = Math.max(2.8, 4.2 - this.room * 0.2);
      this.spawnHazard(
        'predictionMark',
        clamp(this.playerX + this.playerVX * 0.9, -X + 1, X - 1),
        clamp(this.playerZ + this.playerVZ * 0.9, -Z + 1, Z - 1),
        1.9,
        1.05,
        0.4,
        50,
        0xff3c9d,
      );
    }
  }

  /* ------------------------------------------------------------------ hostiles */

  updateEncounter(dt) {
    if (this.bossRoom) return;
    if (this.prizeRound && this.prizeClock < 1.5) return;
    this.spawnTimer -= dt;
    let alive = 0;
    for (const e of this.enemies) if (!e.dead && !isBoss(e.type)) alive += 1;
    const cap = this.prizeRound ? Math.min(8, 3 + this.room) : Math.min(14, 5 + this.room * 2);
    if (this.spawnTimer > 0 || alive >= cap || this.roomSpawned >= this.roomSpawnTarget) return;
    const room = roomFor(this.currentLevel, this.currentRoom.kind);
    const interval = Math.max(0.24, (0.72 - this.room * 0.055) * room.spawnFactor);
    this.spawnTimer = interval * lerp(0.72, 1.28, this.rand());
    const burst = this.room >= 4 && this.rand() > 0.68 ? 2 : 1;
    const count = Math.min(burst, this.roomSpawnTarget - this.roomSpawned);
    for (let i = 0; i < count; i += 1) {
      this.spawnEnemy(this.pickEnemyType());
      this.roomSpawned += 1;
    }
  }

  pickEnemyType() {
    const r = this.rand();
    const kind = this.currentRoom.kind;
    if (this.currentLevel > 1) {
      const [a, b, c] = LEVELS[this.currentLevel].enemies;
      if (kind === 'crossfire') return r < 0.62 ? b : r < 0.84 ? c : a;
      if (kind === 'rush' || kind === 'jackpot') return r < 0.66 ? a : r < 0.88 ? b : c;
      if (kind === 'fortress' || kind === 'blackout') return r < 0.5 ? c : r < 0.78 ? b : a;
      if (kind === 'recovery') return r < 0.48 ? a : r < 0.75 ? b : c;
      return r < 0.46 ? a : r < 0.78 ? b : c;
    }
    if (kind === 'opening') return this.roomSpawned < 4 || r < 0.72 ? 'rusher' : 'gunner';
    if (kind === 'jackpot') return r < 0.76 ? 'rusher' : r < 0.92 ? 'charger' : 'gunner';
    if (kind === 'crossfire') return r < 0.62 ? 'gunner' : r < 0.82 ? 'charger' : 'rusher';
    if (kind === 'rush') return r < 0.52 ? 'rusher' : r < 0.9 ? 'charger' : 'tank';
    if (kind === 'recovery') return r < 0.5 ? 'rusher' : r < 0.76 ? 'gunner' : 'tank';
    if (kind === 'demolition') return r < 0.62 ? 'rusher' : r < 0.84 ? 'charger' : 'gunner';
    if (kind === 'fortress') return r < 0.48 ? 'tank' : r < 0.76 ? 'gunner' : 'charger';
    if (kind === 'blackout') return r < 0.32 ? 'rusher' : r < 0.58 ? 'gunner' : r < 0.83 ? 'charger' : 'tank';
    return r < 0.48 ? 'rusher' : r < 0.76 ? 'gunner' : this.room >= 3 && r < 0.92 ? 'charger' : this.room >= 4 ? 'tank' : 'rusher';
  }

  spawnEnemy(type, sx, sz, generation = 0) {
    const def = ENEMIES[type];
    let x = sx ?? 0;
    let z = sz ?? 0;
    if (sx === undefined || sz === undefined) {
      const side = Math.floor(this.rand() * 4);
      if (side < 2) {
        x = lerp(-X + 1, X - 1, this.rand());
        z = side === 0 ? -Z + 0.45 : Z - 0.45;
      } else {
        x = side === 2 ? -X + 0.45 : X - 0.45;
        z = lerp(-Z + 1, Z - 1, this.rand());
      }
      if (Math.hypot(x - this.playerX, z - this.playerZ) < 7) {
        x *= -1;
        z *= -1;
      }
    }
    let hp = def.hp * (def.boss ? 1 : 1 + Math.max(0, this.room - 1) * 0.11) * this.contract.enemyHp;
    if (this.overtime) hp *= def.boss ? 1 + this.encores * 0.2 : 1 + Math.floor((this.wave - 1) / 20) * 0.1;
    const enemy = {
      id: this.nextEntityId++,
      type,
      x,
      z,
      vx: 0,
      vz: 0,
      hp,
      maxHp: hp,
      radius: def.radius,
      speed: def.speed,
      cooldown: def.boss ? 0.9 : 0.5 + this.rand(),
      touchCooldown: 0,
      telegraph: def.warningSeconds,
      hitFlash: 0,
      state: 0,
      stateTime: type === 'charger' || type === 'lamprey' || type === 'adjuster' ? 0.8 + this.rand() : 0,
      targetX: 0,
      targetZ: -1,
      angle: this.rand() * Math.PI * 2,
      dead: false,
      generation,
      seededTime: 0,
      memoryOffset: 75 + Math.floor(this.rand() * 70),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.touchCooldown = Math.max(0, e.touchCooldown - dt);
      e.seededTime = Math.max(0, e.seededTime - dt);
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        continue;
      }
      const dx = this.playerX - e.x;
      const dz = this.playerZ - e.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      const ux = dx / dist;
      const uz = dz / dist;
      e.angle += dt * (isBoss(e.type) ? 0.65 : 1.2);
      switch (e.type) {
        case 'rusher':
        case 'graftling':
          this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 5.8);
          break;
        case 'gunner': {
          const approach = clamp((dist - 7) * 0.6, -1, 1);
          const strafe = Math.sin(this.elapsed * 1.5 + e.id) * 0.72;
          this.steerEnemy(e, (ux * approach - uz * strafe) * e.speed, (uz * approach + ux * strafe) * e.speed, dt, 4.2);
          e.cooldown -= dt;
          if (e.cooldown <= 0 && dist < 14) {
            e.cooldown = lerp(1.15, 1.65, this.rand());
            this.spawnEnemyBullet(e.x, e.z, ux, uz, 9.5, ENEMIES.gunner.projectileDamage);
            this.spawnBurst(e.x, 0.55, e.z, enemyColor('gunner'), 3, 2.5);
          }
          break;
        }
        case 'charger':
          this.updateCharger(e, ux, uz, dt);
          break;
        case 'tank':
          this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 2.2);
          e.cooldown -= dt;
          if (e.cooldown <= 0) {
            e.cooldown = lerp(2.35, 3.1, this.rand());
            for (let i = 0; i < 8; i += 1) {
              const a = (i / 8) * Math.PI * 2 + e.angle;
              this.spawnEnemyBullet(e.x, e.z, Math.cos(a), Math.sin(a), 6.2, ENEMIES.tank.projectileDamage);
            }
            this.spawnShockwave(e.x, e.z, enemyColor('tank'), 0.5, 3.3, 0.45);
          }
          break;
        case 'lamprey':
          this.updatePredatoryCharge(e, ux, uz, dt, 15.5);
          break;
        case 'conductor':
          this.updateConductor(e, ux, uz, dist, dt);
          break;
        case 'bailiff':
          this.updateHeavyCaster(e, ux, uz, dt, 6);
          break;
        case 'stitcher':
          this.updateStitcher(e, ux, uz, dist, dt);
          break;
        case 'orderly':
          this.updateHeavyCaster(e, ux, uz, dt, 4);
          break;
        case 'echo':
          this.updateEcho(e, dt);
          break;
        case 'redactor':
          this.updateRedactor(e, ux, uz, dist, dt);
          break;
        case 'curator':
          this.updateCurator(e, ux, uz, dt);
          break;
        case 'actuary':
          this.updateActuary(e, ux, uz, dist, dt);
          break;
        case 'underwriter':
          this.updateUnderwriter(e, ux, uz, dist, dt);
          break;
        case 'adjuster':
          this.updatePredatoryCharge(e, ux, uz, dt, 14.5, true);
          break;
        case 'executive':
        case 'collector':
        case 'continuityOfficer':
        case 'archivist':
        case 'forecastPrime':
          this.updateBoss(e, ux, uz, dist, dt);
          break;
      }
      e.x = clamp(e.x + e.vx * dt, -X + e.radius, X - e.radius);
      e.z = clamp(e.z + e.vz * dt, -Z + e.radius, Z - e.radius);
      if (dist < e.radius + 0.62 && e.touchCooldown <= 0 && this.invulnerability <= 0) {
        const def = ENEMIES[e.type];
        const charging = (e.type === 'charger' || e.type === 'lamprey' || e.type === 'adjuster') && e.state === 2;
        this.hurtPlayer(charging ? def.heavyDamage : def.contactDamage, ux, uz);
        e.touchCooldown = 0.7;
        e.vx -= ux * 5;
        e.vz -= uz * 5;
        if (this.phase !== 'playing') return;
      }
    }
  }

  steerEnemy(e, tx, tz, dt, rate) {
    const k = 1 - Math.exp(-rate * dt);
    e.vx = lerp(e.vx, tx, k);
    e.vz = lerp(e.vz, tz, k);
  }

  updateCharger(e, ux, uz, dt) {
    if (e.state === 0) {
      this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 3.8);
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 1;
        e.stateTime = 0.58;
        e.targetX = ux;
        e.targetZ = uz;
        e.vx = 0;
        e.vz = 0;
        this.spawnShockwave(e.x, e.z, enemyColor(e.type), 0.45, 1.8, 0.55);
      }
    } else if (e.state === 1) {
      e.stateTime -= dt;
      e.vx *= 0.84;
      e.vz *= 0.84;
      if (e.stateTime <= 0) {
        e.state = 2;
        e.stateTime = 0.48;
        e.vx = e.targetX * 14;
        e.vz = e.targetZ * 14;
      }
    } else {
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 0;
        e.stateTime = lerp(1.8, 2.8, this.rand());
      }
    }
  }

  updatePredatoryCharge(e, ux, uz, dt, speed, leads = false) {
    if (e.state === 0) {
      this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 4.4);
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 1;
        e.stateTime = ENEMIES[e.type].warningSeconds;
        if (leads) {
          const lx = this.playerX + this.playerVX * 0.7 - e.x;
          const lz = this.playerZ + this.playerVZ * 0.7 - e.z;
          const l = Math.max(0.001, Math.hypot(lx, lz));
          e.targetX = lx / l;
          e.targetZ = lz / l;
        } else {
          e.targetX = ux;
          e.targetZ = uz;
        }
        e.vx = 0;
        e.vz = 0;
        this.spawnShockwave(e.x, e.z, enemyColor(e.type), 0.45, 2.1, e.stateTime);
      }
    } else if (e.state === 1) {
      e.stateTime -= dt;
      e.vx *= 0.82;
      e.vz *= 0.82;
      if (e.stateTime <= 0) {
        e.state = 2;
        e.stateTime = 0.5;
        e.vx = e.targetX * speed;
        e.vz = e.targetZ * speed;
      }
    } else {
      e.stateTime -= dt;
      if (e.stateTime <= 0) {
        e.state = 0;
        e.stateTime = lerp(1.8, 2.7, this.rand());
      }
    }
  }

  updateConductor(e, ux, uz, dist, dt) {
    const approach = clamp((dist - 7.5) * 0.5, -1, 1);
    const strafe = Math.sin(this.elapsed * 1.7 + e.id) * 0.68;
    this.steerEnemy(e, (ux * approach - uz * strafe) * e.speed, (uz * approach + ux * strafe) * e.speed, dt, 4);
    e.cooldown -= dt;
    if (e.cooldown <= 0 && dist < 15) {
      e.cooldown = lerp(1.25, 1.65, this.rand());
      for (const spread of [-0.12, 0.12]) {
        const c = Math.cos(spread);
        const s = Math.sin(spread);
        this.spawnEnemyBullet(e.x, e.z, ux * c - uz * s, uz * c + ux * s, 9.2, ENEMIES.conductor.projectileDamage);
      }
      this.spawnShockwave(e.x, e.z, enemyColor(e.type), 0.4, 2.8, 0.42);
    }
  }

  updateHeavyCaster(e, ux, uz, dt, shots) {
    this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 2.2);
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = lerp(2.4, 3.1, this.rand());
      for (let i = 0; i < shots; i += 1) {
        const a = (i / shots) * Math.PI * 2 + e.angle;
        this.spawnEnemyBullet(e.x, e.z, Math.cos(a), Math.sin(a), 6.4, ENEMIES[e.type].projectileDamage);
      }
      this.spawnShockwave(e.x, e.z, enemyColor(e.type), 0.5, 3.4, 0.48);
    }
  }

  updateStitcher(e, ux, uz, dist, dt) {
    const approach = clamp((dist - 8) * 0.55, -1, 1);
    this.steerEnemy(e, ux * approach * e.speed, uz * approach * e.speed, dt, 3.2);
    e.cooldown -= dt;
    if (e.cooldown > 0) return;
    e.cooldown = 2.7;
    const remains = this.hazards.find((h) => h.kind === 'graftRemains' && h.phase === 'field');
    if (remains) {
      remains.phase = 'disabled';
      this.spawnEnemy('graftling', remains.x, remains.z, 1);
      this.spawnShockwave(remains.x, remains.z, enemyColor('stitcher'), 0.35, 2.2, 0.45);
      return;
    }
    for (const other of this.enemies)
      if (!other.dead && other.id !== e.id && !isBoss(other.type) && Math.hypot(other.x - e.x, other.z - e.z) < 5)
        other.hp = Math.min(other.maxHp, other.hp + 22);
    this.spawnEnemyBullet(e.x, e.z, ux, uz, 8.7, ENEMIES.stitcher.projectileDamage);
  }

  updateEcho(e, dt) {
    const past = this.historyAgo(e.memoryOffset);
    const dx = past.x - e.x;
    const dz = past.z - e.z;
    const l = Math.max(0.001, Math.hypot(dx, dz));
    this.steerEnemy(e, (dx / l) * e.speed, (dz / l) * e.speed, dt, 4.6);
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = lerp(1.6, 2.1, this.rand());
      const px = this.playerX - e.x;
      const pz = this.playerZ - e.z;
      const pl = Math.max(0.001, Math.hypot(px, pz));
      this.spawnEnemyBullet(e.x, e.z, px / pl, pz / pl, 9.4, ENEMIES.echo.projectileDamage);
    }
  }

  updateRedactor(e, ux, uz, dist, dt) {
    const approach = clamp((dist - 8.5) * 0.5, -1, 1);
    const strafe = Math.sin(this.elapsed + e.id) * 0.7;
    this.steerEnemy(e, (ux * approach - uz * strafe) * e.speed, (uz * approach + ux * strafe) * e.speed, dt, 3.5);
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = 3.2;
      this.spawnHazard('redactionField', this.playerX, this.playerZ, 3.2, 0, 3.4, 0, 0x6d35a8);
      this.spawnEnemyBullet(e.x, e.z, ux, uz, 8.8, ENEMIES.redactor.projectileDamage);
    }
  }

  updateCurator(e, ux, uz, dt) {
    this.steerEnemy(e, ux * e.speed, uz * e.speed, dt, 2.1);
    e.cooldown -= dt;
    if (e.cooldown > 0) return;
    e.cooldown = lerp(2.1, 2.8, this.rand());
    // The Curator answers the weapon you are holding.
    const shots = this.weapon === 'scatter' ? 5 : this.weapon === 'rail' ? 1 : 3;
    const fan = shots === 1 ? 0 : 0.42;
    for (let i = 0; i < shots; i += 1) {
      const o = shots === 1 ? 0 : i / (shots - 1) - 0.5;
      const a = Math.atan2(uz, ux) + o * fan;
      this.spawnEnemyBullet(
        e.x,
        e.z,
        Math.cos(a),
        Math.sin(a),
        this.weapon === 'rail' ? 12 : 8,
        this.weapon === 'rail' ? ENEMIES.curator.heavyDamage : ENEMIES.curator.projectileDamage,
      );
    }
  }

  updateActuary(e, ux, uz, dist, dt) {
    const approach = clamp((dist - 8) * 0.55, -1, 1);
    this.steerEnemy(e, ux * approach * e.speed, uz * approach * e.speed, dt, 3.6);
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = 2.35;
      this.spawnHazard(
        'predictionMark',
        clamp(this.playerX + this.playerVX, -X + 1, X - 1),
        clamp(this.playerZ + this.playerVZ, -Z + 1, Z - 1),
        1.8,
        0.95,
        0.38,
        ENEMIES.actuary.projectileDamage,
        0xff4caf,
      );
    }
  }

  updateUnderwriter(e, ux, uz, dist, dt) {
    const approach = clamp((dist - 9) * 0.5, -1, 1);
    this.steerEnemy(e, ux * approach * e.speed, uz * approach * e.speed, dt, 3.2);
    e.cooldown -= dt;
    if (e.cooldown <= 0) {
      e.cooldown = 2.15;
      this.spawnEnemyBullet(e.x, e.z, ux, uz, 9, ENEMIES.underwriter.projectileDamage);
      this.spawnShockwave(e.x, e.z, enemyColor('underwriter'), 0.5, 4.5, 0.55);
    }
  }

  updateBoss(e, ux, uz, dist, dt) {
    const health = e.hp / e.maxHp;
    const phase = health <= 0.33 ? 3 : health <= 0.66 ? 2 : 1;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.callbacks.onBroadcast({
        type: 'boss_phase',
        level: this.currentLevel,
        bossName: LEVELS[this.currentLevel].bossName,
        phase,
        healthPercent: health,
      });
      this.input.rumble(0.6, 220);
      if (e.type === 'continuityOfficer') {
        this.spawnEnemy(phase === 2 ? 'stitcher' : 'orderly', e.x + 2.4, e.z, 1);
        this.spawnEnemy('graftling', e.x - 2.4, e.z, 1);
      }
      if (e.type === 'archivist') {
        this.spawnEnemy('echo', e.x + 2.6, e.z, 1);
        if (phase === 3) this.spawnEnemy('curator', e.x - 2.6, e.z, 1);
      }
    }
    const strafe = Math.sin(this.elapsed * 0.8) * 0.5;
    const approach = clamp((dist - 6.5) * 0.28, -1, 1);
    this.steerEnemy(e, (ux * approach - uz * strafe) * e.speed, (uz * approach + ux * strafe) * e.speed, dt, 2.2);
    e.cooldown -= dt;
    if (e.cooldown > 0) return;
    const def = ENEMIES[e.type];
    e.cooldown = Math.max(0.72, 1.22 - this.bossPhase * 0.12);
    const ring =
      e.type === 'collector'
        ? 8
        : e.type === 'continuityOfficer'
          ? 6 + this.bossPhase * 2
          : e.type === 'archivist'
            ? 8 + this.bossPhase * 2
            : 10 + this.bossPhase * 2;
    for (let i = 0; i < ring; i += 1) {
      const a = (i / ring) * Math.PI * 2 + e.angle;
      this.spawnEnemyBullet(e.x, e.z, Math.cos(a), Math.sin(a), e.type === 'collector' ? 6.2 : 6.8, def.projectileDamage);
    }
    this.spawnEnemyBullet(e.x, e.z, ux, uz, 11.5, def.heavyDamage);
    this.spawnShockwave(e.x, e.z, enemyColor(e.type), 0.65, 5.5, 0.5);
    if (e.type === 'collector') {
      const horizontal = this.rand() > 0.5;
      this.spawnLaneHazard('electricLane', horizontal, this.rand() > 0.5 ? -1 : 1, 0.9, 0.5, 50, 0x28e7ff);
    }
    if (e.type === 'continuityOfficer' && this.rand() > 0.56)
      this.spawnEnemy('graftling', e.x + lerp(-3, 3, this.rand()), e.z + lerp(-3, 3, this.rand()), 1);
    if (e.type === 'archivist' && this.rand() > 0.62)
      this.spawnEnemy('echo', e.x + lerp(-3, 3, this.rand()), e.z + lerp(-3, 3, this.rand()), 1);
    if (e.type === 'forecastPrime' && this.forecastBlindTime <= 0)
      this.spawnHazard(
        'predictionMark',
        clamp(this.playerX + this.playerVX * 0.95, -X + 1, X - 1),
        clamp(this.playerZ + this.playerVZ * 0.95, -Z + 1, Z - 1),
        2.2,
        0.9,
        0.42,
        60,
        0xff3c9d,
      );
    if (this.rand() > 0.58 && this.enemies.length < 145) {
      const escorts = LEVELS[this.currentLevel].enemies;
      for (let i = 0; i < Math.min(3, escorts.length); i += 1) {
        const a = (i / 3) * Math.PI * 2 + e.angle;
        this.spawnEnemy(
          escorts[i % escorts.length],
          clamp(e.x + Math.cos(a) * 3.2, -X + 1, X - 1),
          clamp(e.z + Math.sin(a) * 3.2, -Z + 1, Z - 1),
        );
      }
    }
  }

  /* ------------------------------------------------------------------ projectiles */

  spawnEnemyBullet(x, z, dx, dz, speed, damage) {
    if (this.bullets.length > 900) return;
    const b = this.bulletPool.pop() ?? makeBullet();
    const v = speed * this.contract.bulletSpeed;
    b.x = x + dx * 0.7;
    b.z = z + dz * 0.7;
    b.vx = dx * v;
    b.vz = dz * v;
    b.life = 3.3;
    b.radius = 0.22;
    b.damage = damage;
    b.owner = 'enemy';
    b.pierce = 0;
    b.weapon = 'pulse';
    b.lastHit = -1;
    b.effect = 'standard';
    b.age = 0;
    b.returning = false;
    b.hitIds.length = 0;
    b.mode = 0;
    this.bullets.push(b);
  }

  /** Swap-remove: bullet order does not matter, and nothing is allocated. */
  removeBullet(i) {
    const last = this.bullets.pop();
    if (i < this.bullets.length) {
      this.bulletPool.push(this.bullets[i]);
      this.bullets[i] = last;
    } else {
      this.bulletPool.push(last);
    }
  }

  releaseAllBullets() {
    for (const b of this.bullets) this.bulletPool.push(b);
    this.bullets.length = 0;
  }

  releaseAllParticles() {
    for (const p of this.particles) this.particlePool.push(p);
    this.particles.length = 0;
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.life -= dt;
      b.age += dt;
      if (b.owner === 'player' && b.effect === 'disc') {
        if (!b.returning && b.age >= 0.48) {
          b.returning = true;
          b.hitIds.length = 0;
          b.lastHit = -1;
        }
        if (b.returning) {
          const dx = this.playerX - b.x;
          const dz = this.playerZ - b.z;
          const l = Math.max(0.001, Math.hypot(dx, dz));
          b.vx = (dx / l) * WEAPONS.disc.speed;
          b.vz = (dz / l) * WEAPONS.disc.speed;
          if (l < 0.8) {
            this.removeBullet(i);
            continue;
          }
        }
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.life <= 0 || Math.abs(b.x) > X + 2 || Math.abs(b.z) > Z + 2) {
        this.removeBullet(i);
        continue;
      }
      let spent = false;
      if (b.owner === 'player') {
        for (const h of this.hazards) {
          if (h.phase !== 'node' || h.hp <= 0 || Math.hypot(b.x - h.x, b.z - h.z) > b.radius + h.radius) continue;
          this.damageHazard(h, b.damage * (b.effect === 'chain' ? 2 : 1));
          spent = b.effect !== 'disc' && b.pierce <= 0;
          if (b.pierce > 0) b.pierce -= 1;
          break;
        }
      }
      if (spent) {
        this.removeBullet(i);
        continue;
      }
      if (b.owner === 'enemy') {
        if (this.invulnerability <= 0 && Math.hypot(b.x - this.playerX, b.z - this.playerZ) < b.radius + 0.5) {
          const l = Math.max(0.001, Math.hypot(b.vx, b.vz));
          this.hurtPlayer(b.damage, b.vx / l, b.vz / l);
          this.removeBullet(i);
          if (this.phase !== 'playing') return;
        }
        continue;
      }
      let gone = false;
      for (const e of this.enemies) {
        if (e.dead || e.telegraph > 0 || e.id === b.lastHit || b.hitIds.includes(e.id)) continue;
        if (Math.hypot(b.x - e.x, b.z - e.z) >= b.radius + e.radius) continue;
        b.lastHit = e.id;
        b.hitIds.push(e.id);
        if (b.effect === 'rocket') {
          this.explodeRocket(b.x, b.z, b.damage, b.weapon);
          gone = true;
          break;
        }
        if (b.effect === 'seed') e.seededTime = 3.5;
        this.damageEnemy(e, b.damage, b.weapon);
        if (b.effect === 'chain') this.chainDamageFrom(e, b.damage * 0.66, b.weapon);
        this.spawnBurst(b.x, 0.5, b.z, 0xb9f8ff, 3, 2.6);
        this.sfx.play('hit');
        if (b.effect === 'disc') b.lastHit = -1;
        else if (b.pierce > 0) {
          b.pierce -= 1;
          const l = Math.max(0.001, Math.hypot(b.vx, b.vz));
          b.x += (b.vx / l) * (e.radius + 0.3);
          b.z += (b.vz / l) * (e.radius + 0.3);
        } else gone = true;
        break;
      }
      if (gone) this.removeBullet(i);
      if (this.phase !== 'playing') return;
    }
  }

  explodeRocket(x, z, damage, weapon = 'rocket') {
    this.spawnShockwave(x, z, 0xffc857, 0.5, 4.2, 0.48);
    this.spawnBurst(x, 0.8, z, 0xffc857, 28, 8);
    this.cameraTrauma = Math.max(this.cameraTrauma, 0.42);
    for (const e of this.enemies) {
      if (e.dead || e.telegraph > 0) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < 3.4 + e.radius) this.damageEnemy(e, damage * Math.max(0.35, 1 - d / 4.2), weapon);
    }
    this.sfx.play('bomb');
    this.input.rumble(0.35, 90);
  }

  /** Arc: the two nearest live hostiles within 5.4 take a share of the hit. */
  chainDamageFrom(source, damage, weapon) {
    let first = null;
    let firstD = Infinity;
    let second = null;
    let secondD = Infinity;
    for (const e of this.enemies) {
      if (e.id === source.id || e.dead || e.telegraph > 0) continue;
      const d = Math.hypot(e.x - source.x, e.z - source.z);
      if (d > 5.4) continue;
      if (d < firstD) {
        second = first;
        secondD = firstD;
        first = e;
        firstD = d;
      } else if (d < secondD) {
        second = e;
        secondD = d;
      }
    }
    for (const e of [first, second]) {
      if (!e) continue;
      this.damageEnemy(e, damage, weapon);
      this.spawnShockwave(e.x, e.z, 0x27f2ff, 0.2, 1.25, 0.24);
    }
  }

  damageHazard(h, damage) {
    if (h.phase !== 'node' || h.hp <= 0) return;
    h.hp = Math.max(0, h.hp - damage);
    this.spawnBurst(h.x, 0.2, h.z, h.color, 5, 2.4);
    if (h.hp > 0) return;
    h.phase = 'disabled';
    const p = this.projectToScreen(h.x, 0.3, h.z);
    this.callbacks.onImpact({
      kind: 'elite',
      x: p.x,
      y: p.y,
      text: h.kind === 'breaker' ? 'BREAKER DOWN' : 'MEMORY ERASED',
      color: hex(h.color),
    });
    this.input.rumble(0.4, 120);
  }

  damageEnemy(e, damage, weapon) {
    if (e.dead) return;
    let amount = damage;
    if (weapon !== 'screenWipe') {
      const escorted =
        e.type === 'stitcher' &&
        this.enemies.some((c) => !c.dead && c.type === 'orderly' && Math.hypot(c.x - e.x, c.z - e.z) < 4.6);
      const underwritten =
        e.type !== 'underwriter' &&
        this.enemies.some((c) => !c.dead && c.type === 'underwriter' && Math.hypot(c.x - e.x, c.z - e.z) < 5.4);
      const shielded = e.type === 'collector' && this.hazards.some((h) => h.kind === 'breaker' && h.phase === 'node');
      const archived = e.type === 'archivist' && this.hazards.some((h) => h.kind === 'memoryStack' && h.phase === 'node');
      if (escorted || shielded || archived) amount *= 0.35;
      if (underwritten) amount *= 0.5;
      if (e.type === 'forecastPrime' && this.forecastBlindTime > 0) amount *= 1.25;
    }
    e.hp -= amount;
    e.hitFlash = 0.085;
    if (e.hp <= 0) this.killEnemy(e, weapon);
  }

  killEnemy(e, weapon) {
    if (e.dead) return;
    const def = ENEMIES[e.type];
    const seeded = e.seededTime > 0;
    e.dead = true;
    this.kills += 1;
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (weapon !== 'screenWipe') this.weaponKills[weapon] += 1;
    this.comboTimer = 2.6;
    this.multiplier = Math.min(8, 1 + Math.floor(this.combo / 5) * 0.5);
    const gained = this.scored(def.score * this.multiplier);
    this.score += gained;
    const weaponName = weapon === 'screenWipe' ? 'SCREEN WIPE' : WEAPON_LABELS[weapon];
    this.callbacks.onBroadcast({ type: 'enemy_defeated', enemy: e.type, weapon: weaponName, combo: this.combo, kills: this.kills });
    const heavy = def.silhouette === 'heavy';
    this.spawnBurst(e.x, def.boss ? 1.5 : 0.65, e.z, def.color, def.boss ? 72 : heavy ? 24 : 14, def.boss ? 12 : 6);
    this.spawnShockwave(e.x, e.z, def.color, 0.35, def.boss ? 11 : heavy ? 4.4 : 2.5, def.boss ? 0.9 : 0.38);
    this.cameraTrauma = Math.max(this.cameraTrauma, def.boss ? 1 : heavy ? 0.35 : 0.13);
    if (def.boss) this.input.rumble(1, 600);
    else if (heavy) this.input.rumble(0.35, 90);
    const p = this.projectToScreen(e.x, def.boss ? 2 : 0.8, e.z);
    this.callbacks.onImpact({
      kind: def.boss || heavy ? 'elite' : 'kill',
      x: p.x,
      y: p.y,
      text: def.boss ? `${def.label} DOWN` : `+${gained}`,
      color: hex(def.color),
    });
    if (this.combo === 10 || this.combo === 20 || this.combo === 35) {
      this.callbacks.onImpact({ kind: 'streak', text: this.combo >= 35 ? 'PRIME TIME' : this.combo >= 20 ? 'RAMPAGE' : 'HOT STREAK' });
      this.callbacks.onBroadcast({ type: 'combo_milestone', combo: this.combo, weapon: weaponName });
    }
    this.sfx.play('kill');
    if (seeded && !def.boss) {
      // Graftgun seed: the body bursts and hurts its neighbours.
      this.spawnShockwave(e.x, e.z, 0xff4c9d, 0.35, 3.1, 0.42);
      for (const o of this.enemies)
        if (!o.dead && o.id !== e.id && !isBoss(o.type) && Math.hypot(o.x - e.x, o.z - e.z) < 2.8 + o.radius)
          this.damageEnemy(o, 34, 'graft');
    }
    if (e.type === 'graftling') {
      if (!seeded) this.spawnHazard('graftRemains', e.x, e.z, 0.8, 0, 4, 0, 0xff4c9d);
      if (e.generation === 0)
        for (const o of [-0.65, 0.65]) {
          const child = this.spawnEnemy('graftling', e.x + o, e.z - o * 0.4, 1);
          child.hp *= 0.52;
          child.maxHp = child.hp;
          child.radius *= 0.78;
        }
    }
    if (def.boss) {
      this.invulnerability = 99;
      for (const o of this.enemies) if (o.id !== e.id) o.dead = true;
      this.victoryCountdown = 1.35;
      return;
    }
    if (!this.bossRoom && !this.prizeRound) {
      this.roomKills += 1;
      const half = Math.ceil(this.roomSpawnTarget / 2);
      if (this.room === 2 && !this.earlyBeatEmitted && this.roomKills >= half) {
        this.earlyBeatEmitted = true;
        this.emitBroadcastBeat('early');
      }
      if (this.room === 5 && !this.lateBeatEmitted && this.roomKills >= half) {
        this.lateBeatEmitted = true;
        this.emitBroadcastBeat('late');
      }
    } else if (this.prizeRound) {
      this.roomKills += 1;
    }
    if (this.pickups.length < 85 && this.rand() < 0.72) this.spawnPickup('cash', e.x, e.z);
    if (this.rand() < 0.055) this.spawnPickup('health', e.x, e.z);
    if (this.kills === 12 || this.kills === 30 || this.kills === 55 || this.rand() < 0.016) this.spawnPickup('weapon', e.x, e.z);
    if (this.rand() < 0.008) this.spawnPickup('bomb', e.x, e.z);
  }

  cleanupEnemies() {
    let w = 0;
    for (let i = 0; i < this.enemies.length; i += 1) {
      const e = this.enemies[i];
      if (!e.dead) this.enemies[w++] = e;
    }
    this.enemies.length = w;
  }

  checkRoomCompletion() {
    if (this.phase !== 'playing' || this.bossRoom || this.prizeRound || this.roomClearCommitted) return;
    if (this.roomSpawned < this.roomSpawnTarget) return;
    for (const e of this.enemies) if (!e.dead && !isBoss(e.type)) return;
    this.roomClearCommitted = true;
    this.completeRoom();
  }

  /** Stop combat: bank the pickups (after a room), clear the floor, freeze the player. */
  clearFloor(collect = true) {
    if (collect) for (const p of this.pickups) this.collectPickup(p);
    this.pickups.length = 0;
    this.prizes.length = 0;
    this.enemies.length = 0;
    this.releaseAllBullets();
    this.dashRequested = false;
    this.bombRequested = false;
    this.dashBuffer = 0;
    this.playerVX = 0;
    this.playerVZ = 0;
    this.dashTime = 0;
    this.prizeRound = false;
  }

  completeRoom() {
    this.clearFloor();
    this.roomsCleared = this.overtime ? this.wave : this.room;
    const bonus = this.scored(roomFor(this.currentLevel, this.currentRoom.kind).clearBonus + this.roomsCleared * 150);
    this.score += bonus;
    this.callbacks.onImpact({
      kind: 'wave',
      text: this.overtime ? `WAVE ${pad2(this.wave)} CLEARED` : `ROOM ${pad2(this.room)} CLEARED`,
      color: this.currentRoom.accent,
    });
    this.callbacks.onBroadcast({
      type: 'room_cleared',
      room: this.roomsCleared,
      name: this.currentRoom.name,
      kind: this.currentRoom.kind,
      roomsCleared: this.roomsCleared,
      clearBonus: bonus,
    });
    if (this.roomsCleared === 3) this.emitBroadcastBeat('mid');
    let choices;
    if (this.overtime) {
      choices = overtimeChoices({
        wave: this.wave,
        lane: this.currentRoom.lane ?? 0,
        backDirection: this.backDirection,
        currentKind: this.currentRoom.kind,
        random: () => this.routeRand(),
      });
    } else if (this.roomsCleared >= ROOMS_PER_LEVEL) {
      choices = [bossDoor(this.currentLevel, this.currentRoom.lane, oppositeDirection(this.backDirection))];
    } else {
      choices = routeChoices({
        level: this.currentLevel,
        currentDepth: this.room,
        currentLane: this.currentRoom.lane,
        currentKind: this.currentRoom.kind,
        backDirection: this.backDirection,
        previousRoomId: this.previousRoomId,
        random: () => this.routeRand(),
      });
    }
    this.openRoute(choices, 0.35, true);
  }

  openRoute(choices, gateDelay, announce) {
    this.pendingRoomChoices = choices;
    this.routeAssistDirection = null;
    this.routeGateDelay = gateDelay;
    this.routeGateArmed = false;
    this.showRouteDoors(choices);
    this.phase = 'route';
    this.accumulator = 0;
    this.callbacks.onPhase('route');
    this.callbacks.onRoomChoices(choices);
    if (announce)
      this.callbacks.onBroadcast({
        type: 'route_offered',
        fromRoom: this.roomsCleared,
        choices,
        overtime: this.overtime,
      });
    this.pushHud();
  }

  emitBroadcastBeat(moment) {
    this.callbacks.onBroadcast({
      type: 'broadcast_beat',
      moment,
      elapsed: this.elapsed,
      healthPercent: this.playerHealth / Math.max(1, this.playerMaxHealth),
      kills: this.kills,
      combo: this.combo,
      weapon: WEAPON_LABELS[this.weapon],
      bombs: this.bombs,
    });
  }

  beginBossRoom() {
    if (!this.overtime) this.room = ROOMS_PER_LEVEL + 1;
    this.pendingRoomChoices = [];
    this.hideRouteDoors();
    this.enemies.length = 0;
    this.releaseAllBullets();
    this.pickups.length = 0;
    this.prizes.length = 0;
    this.prizeRound = false;
    this.setupRoomMechanic();
    this.dashRequested = false;
    this.bombRequested = false;
    this.dashBuffer = 0;
    this.positionPlayerAtEntry();
    this.player.visible = true;
    this.invulnerability = Math.max(this.invulnerability, 1.1);
    this.roomCombatTime = 0;
    this.roomKills = 0;
    this.roomSpawned = 0;
    this.roomSpawnTarget = 1;
    this.bossRoom = true;
    this.bossPhase = 1;
    this.victoryCountdown = -1;
    this.phase = 'playing';
    this.accumulator = 0;
    this.pressGuard = true;
    this.input.settle();
    this.callbacks.onPhase('playing');
    this.callbacks.onRoomChoices([]);
    const def = LEVELS[this.currentLevel];
    this.spawnEnemy(def.boss);
    this.callbacks.onImpact({
      kind: 'wave',
      text: this.overtime ? `ENCORE // ${def.bossName}` : `BOSS ROOM // ${def.bossName}`,
      color: def.accent,
    });
    this.callbacks.onBroadcast({ type: 'boss_intro', level: this.currentLevel, bossName: def.bossName, overtime: this.overtime });
    this.sfx.play('wave');
    this.input.rumble(0.5, 250);
    this.cameraTrauma = Math.max(this.cameraTrauma, 0.55);
    this.pushHud();
  }

  completeLevel() {
    if (this.phase !== 'playing') return;
    if (this.overtime) {
      this.completeEncore();
      return;
    }
    if (this.levelCompleteCommitted) return;
    this.levelCompleteCommitted = true;
    this.victoryCountdown = -1;
    this.bossRoom = false;
    this.roomsCleared = ROOMS_PER_LEVEL;
    this.clearFloor(false);
    this.hazards.length = 0;
    const def = LEVELS[this.currentLevel];
    this.campaignProgress = recordLevelClear(this.campaignProgress, this.currentLevel, this.score, def.signatureWeapon, this.elapsed);
    saveCampaign(this.storage, this.campaignProgress);
    this.callbacks.onCampaignProgress(this.campaignProgress);
    if (this.currentLevel === 1) saveLegacyBest(this.storage, Math.max(this.best, this.score));
    const next = nextLevel(this.currentLevel);
    const door = next
      ? nextLevelDoor(this.currentLevel, this.currentRoom.lane, oppositeDirection(this.backDirection))
      : campaignExitDoor(this.currentRoom.lane, this.backDirection);
    this.openRoute(door ? [door] : [], 0.45, false);
    this.callbacks.onImpact({
      kind: 'wave',
      text: next ? `LEVEL ${pad2(this.currentLevel)} CLEAR // NEXT GATE OPEN` : 'FORECAST BROKEN // TURN AROUND',
      color: def.accent,
    });
    this.callbacks.onBroadcast({
      type: 'level_complete',
      level: this.currentLevel,
      levelName: def.name,
      bossName: def.bossName,
      nextLevel: next ?? undefined,
    });
    if (!next) this.callbacks.onBroadcast({ type: 'final_exit_open' });
  }

  /** Overtime: an encore boss fell. Bank a bonus and open the next wave's doors. */
  completeEncore() {
    this.victoryCountdown = -1;
    this.bossRoom = false;
    this.invulnerability = 0.6;
    this.clearFloor();
    this.hazards.length = 0;
    this.encores += 1;
    this.roomsCleared = this.wave;
    const bonus = this.scored(2500 + this.encores * 500);
    this.score += bonus;
    this.callbacks.onImpact({ kind: 'wave', text: `ENCORE CLEARED // +${bonus.toLocaleString('en-US')}`, color: LEVELS[this.currentLevel].accent });
    const choices = overtimeChoices({
      wave: this.wave,
      lane: this.currentRoom.lane ?? 0,
      backDirection: this.backDirection,
      currentKind: 'boss',
      random: () => this.routeRand(),
    });
    this.openRoute(choices, 0.45, true);
  }

  hurtPlayer(damage, dx, dz) {
    if (this.invulnerability > 0 || this.phase !== 'playing') return;
    const scaled = damage * this.contract.damageTaken;
    const taken = Math.min(this.playerHealth, scaled);
    this.playerHealth = Math.max(0, this.playerHealth - scaled);
    this.damageTaken += taken;
    const ratio = this.playerHealth / this.playerMaxHealth;
    this.invulnerability = 0.48;
    this.playerVX -= dx * 6.5;
    this.playerVZ -= dz * 6.5;
    this.cameraTrauma = Math.max(this.cameraTrauma, 0.58);
    this.spawnBurst(this.playerX, 0.7, this.playerZ, 0xff4b45, 18, 7);
    this.callbacks.onImpact({ kind: 'hurt', text: `-${Math.round(taken)}` });
    this.callbacks.onBroadcast({ type: 'player_hurt', health: this.playerHealth, maxHealth: this.playerMaxHealth, damage: taken });
    if (!this.criticalHealthActive && ratio <= 0.5 && this.playerHealth > 0) {
      this.criticalHealthActive = true;
      this.callbacks.onBroadcast({ type: 'critical_health', healthPercent: ratio });
    }
    this.sfx.play('hurt');
    this.input.rumble(0.7, 180);
    if (this.playerHealth <= 0) this.finishRun(false);
  }

  /* ------------------------------------------------------------------ pickups and prizes */

  spawnPickup(type, x, z) {
    this.pickups.push({ type, x, z, life: 12, phase: this.rand() * Math.PI * 2 });
  }

  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const p = this.pickups[i];
      p.life -= dt;
      p.phase += dt * 3.2;
      const dx = this.playerX - p.x;
      const dz = this.playerZ - p.z;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      if (d < this.pickupRadius) {
        const pull = (1 - d / this.pickupRadius) * 14 + 2;
        p.x += (dx / d) * pull * dt;
        p.z += (dz / d) * pull * dt;
      }
      if (d < 0.75) {
        this.collectPickup(p);
        this.pickups.splice(i, 1);
      } else if (p.life <= 0) this.pickups.splice(i, 1);
    }
  }

  collectPickup(p) {
    let text = '';
    if (p.type === 'cash') {
      const amount = this.scored(50 * this.multiplier);
      this.score += amount;
      text = `JACKPOT +${amount}`;
    }
    if (p.type === 'health') {
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 24);
      text = 'REPAIR +24';
      this.checkRecovered();
    }
    if (p.type === 'weapon') {
      const weapons = this.getArmoryWeapons();
      this.weapon = weapons[this.weaponDropIndex++ % weapons.length];
      this.weaponTime = 14;
      text = WEAPON_LABELS[this.weapon];
      this.callbacks.onBroadcast({ type: 'weapon_collected', weapon: text });
    }
    if (p.type === 'bomb') {
      this.bombs = Math.min(4, this.bombs + 1);
      text = 'SCREEN WIPE +1';
    }
    if (p.type !== 'weapon') this.callbacks.onBroadcast({ type: 'pickup_collected', pickup: p.type });
    this.spawnBurst(p.x, 0.55, p.z, PICKUP_COLORS[p.type], 8, 3.6);
    const s = this.projectToScreen(p.x, 0.6, p.z);
    this.callbacks.onImpact({ kind: 'pickup', x: s.x, y: s.y, text, color: hex(PICKUP_COLORS[p.type]) });
    this.sfx.play('pickup');
  }

  spawnPrize() {
    if (this.prizes.length >= MAX_PRIZES) return;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 8; tries += 1) {
      x = lerp(-X + 1.8, X - 1.8, this.rand());
      z = lerp(-Z + 1.8, Z - 1.8, this.rand());
      if (Math.hypot(x - this.playerX, z - this.playerZ) > 3.2) break;
    }
    const prize = pickPrize(this.rand());
    this.prizes.push({ x, z, prize, tier: PRIZES.indexOf(prize), phase: this.rand() * Math.PI * 2 });
    this.spawnShockwave(x, z, PRIZE_COLORS[PRIZES.indexOf(prize)] ?? 0xffd15c, 0.2, 1.8, 0.35);
  }

  updatePrizeRound(dt) {
    this.prizeClock -= dt;
    this.prizeSpawnTimer -= dt;
    if (this.prizeSpawnTimer <= 0 && this.prizeClock > 2) {
      this.prizeSpawnTimer = 1.15;
      if (this.prizes.length < 10) this.spawnPrize();
    }
    for (let i = this.prizes.length - 1; i >= 0; i -= 1) {
      const p = this.prizes[i];
      p.phase += dt * 3.2;
      const dx = this.playerX - p.x;
      const dz = this.playerZ - p.z;
      const d = Math.max(0.001, Math.hypot(dx, dz));
      if (d < this.pickupRadius * 0.6) {
        const pull = (1 - d / (this.pickupRadius * 0.6)) * 9 + 1.5;
        p.x += (dx / d) * pull * dt;
        p.z += (dz / d) * pull * dt;
      }
      if (d < 0.95) {
        this.collectPrize(p);
        this.prizes.splice(i, 1);
      }
    }
    const whole = Math.ceil(this.prizeClock);
    if (whole <= 5 && whole >= 1 && whole < this.prizeTick) {
      this.prizeTick = whole;
      this.sfx.play('tick');
    }
    if (!this.prizeHalfBeat && this.prizeClock <= PRIZE_ROUND_SECONDS / 2) {
      this.prizeHalfBeat = true;
      if (!this.overtime && this.room === 2 && !this.earlyBeatEmitted) {
        this.earlyBeatEmitted = true;
        this.emitBroadcastBeat('early');
      }
      if (!this.overtime && this.room === 5 && !this.lateBeatEmitted) {
        this.lateBeatEmitted = true;
        this.emitBroadcastBeat('late');
      }
    }
    if (this.prizeClock <= 0) this.endPrizeRound();
  }

  collectPrize(p) {
    const color = PRIZE_COLORS[p.tier] ?? 0xffd15c;
    const amount = this.scored(p.prize.value);
    this.score += amount;
    this.prizesClaimed += 1;
    this.spawnBurst(p.x, 0.8, p.z, color, 16, 5);
    this.spawnShockwave(p.x, p.z, color, 0.3, 2.4, 0.4);
    const s = this.projectToScreen(p.x, 0.8, p.z);
    this.callbacks.onImpact({ kind: 'pickup', x: s.x, y: s.y, text: `${p.prize.name} +${amount.toLocaleString('en-US')}`, color: hex(color) });
    this.callbacks.onBroadcast({ type: 'pickup_collected', pickup: 'prize' });
    this.sfx.play('prize');
    this.input.rumble(0.25, 60);
  }

  /** The Prize Studio clock ran out: security leaves, unclaimed prizes vanish, the doors open. */
  endPrizeRound() {
    for (const e of this.enemies) {
      if (e.dead || isBoss(e.type)) continue;
      e.dead = true;
      this.spawnBurst(e.x, 0.6, e.z, ENEMIES[e.type].color, 8, 4);
    }
    this.callbacks.onImpact({ kind: 'wave', text: `TIME // ${this.prizesClaimed} PRIZES CLAIMED`, color: '#ffd15c' });
    this.callbacks.onBroadcast({ type: 'prize_round_over', claimed: this.prizesClaimed });
    this.roomClearCommitted = true;
    this.completeRoom();
  }

  triggerUpgrade() {
    this.hideRouteDoors();
    this.upgradeStage += 1;
    const pool = this.availableUpgrades();
    const offers = [];
    while (offers.length < Math.min(3, pool.length)) {
      const id = pool[Math.floor(this.rand() * pool.length)];
      if (!offers.includes(id)) offers.push(id);
    }
    this.pendingUpgradeIds = offers.slice();
    this.phase = 'upgrade';
    this.accumulator = 0;
    this.callbacks.onPhase('upgrade');
    this.callbacks.onUpgrade(offers.map((id) => UPGRADES[id]));
    this.callbacks.onImpact({ kind: 'wave', text: 'SPONSOR BREAK // CHOOSE ONE' });
    this.callbacks.onBroadcast({ type: 'upgrade_break', slot: this.upgradeStage });
    this.pushHud();
  }

  finishRun(victory) {
    if (this.phase === 'gameover') return;
    this.hideRouteDoors();
    const previous = this.best;
    this.best = Math.max(this.best, this.score);
    const newBest = this.score > previous;
    if (this.overtime) {
      this.campaignProgress = {
        ...this.campaignProgress,
        overtimeBest: Math.max(this.campaignProgress.overtimeBest ?? 0, this.score),
        overtimeBestWave: Math.max(this.campaignProgress.overtimeBestWave ?? 0, this.wave),
      };
    } else {
      this.campaignProgress = {
        ...this.campaignProgress,
        bestByLevel: { ...this.campaignProgress.bestByLevel, [this.currentLevel]: this.best },
        lastSelectedLevel: this.currentLevel,
      };
      if (newBest && this.currentLevel === 1) saveLegacyBest(this.storage, this.best);
    }
    saveCampaign(this.storage, this.campaignProgress);
    this.callbacks.onCampaignProgress(this.campaignProgress);
    this.phase = 'gameover';
    this.accumulator = 0;
    this.prizeRound = false;
    this.callbacks.onPhase('gameover');
    let favourite = 'pulse';
    for (const id of Object.keys(this.weaponKills)) if (this.weaponKills[id] > this.weaponKills[favourite]) favourite = id;
    const result = {
      score: this.score,
      kills: this.kills,
      roomsCleared: this.roomsCleared,
      level: this.currentLevel,
      bossName: LEVELS[this.currentLevel].bossName,
      time: this.elapsed,
      bestTime: this.campaignProgress.bestTimeByLevel?.[this.currentLevel] ?? 0,
      best: this.best,
      newBest,
      victory,
      maxCombo: this.maxCombo,
      damageTaken: Math.round(this.damageTaken),
      bombsUsed: this.bombsUsed,
      dashesUsed: this.dashesUsed,
      favoriteWeapon: WEAPON_LABELS[favourite],
      overtime: this.overtime,
      wave: this.wave,
      bestWave: this.campaignProgress.overtimeBestWave ?? 0,
      encores: this.encores,
      contract: this.contract.label,
    };
    this.callbacks.onResult(result);
    this.callbacks.onBroadcast({ type: 'run_result', result });
    this.callbacks.onImpact({ kind: 'wave', text: victory ? 'BROADCAST CLEARED' : this.overtime ? 'OVERTIME OVER' : 'SIGNAL LOST' });
    this.pushHud();
  }

  /* ------------------------------------------------------------------ randomness */

  rand() {
    this.rngState = (this.rngState + 1831565813) | 0;
    let e = this.rngState;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  }

  routeRand() {
    this.routeRngState = (this.routeRngState + 1831565813) | 0;
    let e = this.routeRngState;
    e = Math.imul(e ^ (e >>> 15), e | 1);
    e ^= e + Math.imul(e ^ (e >>> 7), e | 61);
    return ((e ^ (e >>> 14)) >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------ effects */

  spawnBurst(x, y, z, color, count, speed) {
    const room = Math.max(0, (this.particleCap ?? 480) - this.particles.length);
    const n = Math.min(count, room);
    for (let i = 0; i < n; i += 1) {
      const a = this.rand() * Math.PI * 2;
      const v = speed * lerp(0.35, 1, this.rand());
      const life = lerp(0.28, 0.76, this.rand());
      const p = this.particlePool.pop() ?? makeParticle();
      p.x = x;
      p.y = y;
      p.z = z;
      p.vx = Math.cos(a) * v;
      p.vy = lerp(1.4, 5.8, this.rand());
      p.vz = Math.sin(a) * v;
      p.life = life;
      p.maxLife = life;
      p.size = lerp(0.5, 1.65, this.rand());
      p.color = color;
      p.spin = lerp(-8, 8, this.rand());
      this.particles.push(p);
    }
  }

  spawnShockwave(x, z, color, start, end, life) {
    const wave = this.shockwaves.find((w) => w.life <= 0);
    if (!wave) return;
    wave.life = life;
    wave.maxLife = life;
    wave.start = start;
    wave.end = end;
    wave.mesh.position.set(x, 0.1, z);
    wave.mesh.scale.setScalar(start);
    wave.mesh.material.color.setHex(color);
    wave.mesh.material.opacity = 0.9;
    wave.mesh.visible = true;
  }

  updatePresentation(dt, t) {
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    this.muzzle.visible = this.muzzleTime > 0;
    if (this.muzzle.visible) this.muzzle.scale.setScalar(0.7 + (this.muzzleTime / 0.055) * 1.1);
    for (const door of this.routeDoors.values()) {
      if (!door.group.visible) continue;
      const d = Math.hypot(this.playerX - door.group.position.x, this.playerZ - door.group.position.z);
      const near = this.phase === 'route' ? clamp(1 - d / 9, 0, 1) : 0;
      const pulse = 0.5 + Math.sin(t * 6.5) * 0.5;
      door.portal.material.opacity = 0.2 + pulse * 0.11 + near * 0.3;
      door.frameMaterial.emissiveIntensity = 2.6 + pulse * 1.4 + near * 3.2;
      door.group.scale.y = 0.985 + pulse * 0.025;
    }
    for (let i = 0; i < this.hazardVisuals.length; i += 1) {
      const mesh = this.hazardVisuals[i];
      const h = this.hazards[i];
      if (!h || h.phase === 'disabled') {
        mesh.visible = false;
        continue;
      }
      const flicker = 0.82 + Math.sin(t * 7 + h.id) * 0.18;
      const node = h.phase === 'node';
      mesh.visible = true;
      mesh.position.set(h.x, node ? 0.14 : 0.07, h.z);
      mesh.rotation.z = node ? t * 0.45 : 0;
      mesh.scale.set(
        node ? Math.max(0.7, h.radius * 2) : Math.max(0.2, h.width),
        node ? Math.max(0.7, h.radius * 2) : Math.max(0.2, h.length),
        1,
      );
      mesh.material.color.setHex(h.color);
      mesh.material.opacity =
        h.phase === 'telegraph' ? 0.14 + flicker * 0.16 : h.phase === 'field' ? 0.2 + flicker * 0.09 : 0.34 + flicker * 0.2;
    }
    const drag = Math.pow(0.985, dt * 60);
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = this.particles.pop();
        if (i < this.particles.length) this.particles[i] = last;
        this.particlePool.push(p);
        continue;
      }
      p.vy -= 11.5 * dt;
      p.vx *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y = Math.max(0.08, p.y + p.vy * dt);
      p.z += p.vz * dt;
      if (p.y <= 0.081) {
        p.vy *= -0.28;
        p.vx *= 0.72;
        p.vz *= 0.72;
      }
    }
    for (const w of this.shockwaves) {
      if (w.life <= 0) continue;
      w.life -= dt;
      const k = 1 - Math.max(0, w.life) / w.maxLife;
      w.mesh.scale.setScalar(lerp(w.start, w.end, 1 - (1 - k) ** 3));
      w.mesh.material.opacity = (1 - k) * 0.78;
      if (w.life <= 0) w.mesh.visible = false;
    }
    this.playerBody.rotation.y += dt * (this.phase === 'playing' ? 3.2 : 1.4);
    this.playerBody.rotation.z = Math.sin(t * 4) * 0.09;
    this.playerBody.material.emissiveIntensity = this.invulnerability > 0 && Math.floor(t * 22) % 2 === 0 ? 6 : 3.1;
    this.updateInstanceMeshes(t);
    this.updateCamera(dt, t);
  }

  updateInstanceMeshes(t) {
    const obj = this.tempObject;
    const counts = this.silhouetteCounts;
    for (const s of SILHOUETTES) counts[s] = 0;
    let telegraphs = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const def = ENEMIES[e.type];
      if (e.telegraph > 0) {
        const pulse = 0.82 + Math.sin(t * 14 + e.id) * 0.16;
        obj.position.set(e.x, 0.09, e.z);
        obj.rotation.set(-Math.PI / 2, 0, t * 1.8);
        obj.scale.setScalar((e.radius + 0.25) * pulse);
        obj.updateMatrix();
        this.telegraphMesh.setMatrixAt(telegraphs++, obj.matrix);
      }
      const s = def.silhouette;
      const mesh = this.enemyMeshes[s];
      const index = counts[s]++;
      if (index >= mesh.instanceMatrix.count) continue;
      const grow = e.telegraph > 0 ? Math.max(0.03, 1 - e.telegraph / def.warningSeconds) : 1;
      const flash = e.hitFlash > 0 ? 1.18 : 1;
      const height = def.boss ? 1.85 + Math.sin(t * 2.4) * 0.18 : s === 'charge' ? 0.72 : s === 'heavy' ? 0.76 : 0.64;
      const scale = def.boss ? 1 : s === 'heavy' ? 0.92 : 1;
      // Split graftlings are smaller than their parent, and look it.
      const size = e.radius / def.radius;
      obj.position.set(e.x, height, e.z);
      obj.rotation.set(s === 'charge' ? 0 : t * 0.7 + e.id, def.boss ? t * 0.48 : Math.atan2(e.vx, e.vz), def.boss ? Math.sin(t) * 0.12 : 0);
      obj.scale.setScalar(scale * grow * flash * size);
      obj.updateMatrix();
      mesh.setMatrixAt(index, obj.matrix);
      mesh.setColorAt(index, this.tempColor.setHex(e.hitFlash > 0 ? 0xffffff : def.color));
    }
    for (const s of SILHOUETTES) {
      const mesh = this.enemyMeshes[s];
      mesh.count = Math.min(counts[s], mesh.instanceMatrix.count);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }
    this.telegraphMesh.count = telegraphs;
    this.telegraphMesh.instanceMatrix.needsUpdate = true;

    let mine = 0;
    let theirs = 0;
    for (const b of this.bullets) {
      const player = b.owner === 'player';
      const mesh = player ? this.bulletPlayerMesh : this.bulletEnemyMesh;
      const index = player ? mine++ : theirs++;
      if (index >= 1000) continue;
      const speed = Math.hypot(b.vx, b.vz);
      const stretch = b.weapon === 'rail' ? 5.2 : b.weapon === 'rocket' ? 2.2 : 2.7;
      obj.position.set(b.x, player ? 0.72 : 0.65, b.z);
      obj.rotation.set(0, Math.atan2(b.vx, b.vz), 0);
      obj.scale.set(b.weapon === 'rocket' ? 1.8 : 1, b.weapon === 'rocket' ? 1.8 : 1, stretch * clamp(speed / 22, 0.7, 1.4));
      obj.updateMatrix();
      mesh.setMatrixAt(index, obj.matrix);
    }
    this.bulletPlayerMesh.count = Math.min(1000, mine);
    this.bulletEnemyMesh.count = Math.min(1000, theirs);
    this.bulletPlayerMesh.instanceMatrix.needsUpdate = true;
    this.bulletEnemyMesh.instanceMatrix.needsUpdate = true;

    const shown = Math.min(this.particles.length, this.particleCap ?? 480, 900);
    for (let i = 0; i < shown; i += 1) {
      const p = this.particles[i];
      const k = p.life / p.maxLife;
      obj.position.set(p.x, p.y, p.z);
      obj.rotation.set(t * p.spin, p.spin, t * p.spin * 0.4);
      obj.scale.setScalar(p.size * k);
      obj.updateMatrix();
      this.particleMesh.setMatrixAt(i, obj.matrix);
      this.particleMesh.setColorAt(i, this.tempColor.setHex(p.color));
    }
    this.particleMesh.count = shown;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.particleMesh.instanceColor.needsUpdate = true;

    const pickups = Math.min(this.pickups.length, 100);
    for (let i = 0; i < pickups; i += 1) {
      const p = this.pickups[i];
      const bob = 0.88 + Math.sin(p.phase) * 0.13;
      obj.position.set(p.x, 0.62 + Math.sin(p.phase) * 0.18, p.z);
      obj.rotation.set(p.phase * 0.4, p.phase, p.phase * 0.25);
      // Pickups about to expire blink.
      const blink = p.life < 2.5 && Math.floor(t * 10) % 2 === 0 ? 0.55 : 1;
      obj.scale.setScalar((p.type === 'weapon' ? bob * 1.35 : bob) * blink);
      obj.updateMatrix();
      this.pickupMesh.setMatrixAt(i, obj.matrix);
      this.pickupMesh.setColorAt(i, this.tempColor.setHex(PICKUP_COLORS[p.type]));
    }
    this.pickupMesh.count = pickups;
    this.pickupMesh.instanceMatrix.needsUpdate = true;
    this.pickupMesh.instanceColor.needsUpdate = true;

    const prizes = Math.min(this.prizes.length, MAX_PRIZES);
    for (let i = 0; i < prizes; i += 1) {
      const p = this.prizes[i];
      const color = PRIZE_COLORS[p.tier] ?? 0xffd15c;
      const big = 0.85 + p.tier * 0.14;
      obj.position.set(p.x, 0.62 + Math.sin(p.phase) * 0.14, p.z);
      obj.rotation.set(0.35, p.phase * 0.7, 0.2);
      obj.scale.setScalar(big);
      obj.updateMatrix();
      this.prizeMesh.setMatrixAt(i, obj.matrix);
      this.prizeMesh.setColorAt(i, this.tempColor.setHex(color));
      obj.position.set(p.x, 0.08, p.z);
      obj.rotation.set(-Math.PI / 2, 0, t * 1.2);
      obj.scale.setScalar(big * (1 + Math.sin(p.phase * 1.3) * 0.08));
      obj.updateMatrix();
      this.prizeRingMesh.setMatrixAt(i, obj.matrix);
      this.prizeRingMesh.setColorAt(i, this.tempColor);
    }
    this.prizeMesh.count = prizes;
    this.prizeRingMesh.count = prizes;
    for (const m of [this.prizeMesh, this.prizeRingMesh]) {
      m.instanceMatrix.needsUpdate = true;
      m.instanceColor.needsUpdate = true;
    }
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
  }

  updateCamera(dt, t) {
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.45);
    const shake = this.reducedMotion ? 0 : this.cameraTrauma ** 2;
    const sx = Math.sin(t * 71.3) * shake * 0.38;
    const sy = Math.sin(t * 83.7) * shake * 0.2;
    const sz = Math.cos(t * 67.1) * shake * 0.32;
    const k = this.viewScale;
    this.camera.position.set(
      CAMERA_TARGET.x + CAMERA_OFFSET.x * k + sx,
      CAMERA_TARGET.y + CAMERA_OFFSET.y * k + sy,
      CAMERA_TARGET.z + CAMERA_OFFSET.z * k + sz,
    );
    this.camera.lookAt(sx * 0.2, 0, -1.2 + sz * 0.15);
  }

  /** A world point as percentages of the canvas (for the floating score texts). */
  projectToScreen(x, y, z) {
    this.projectVector.set(x, y, z).project(this.camera);
    return {
      x: clamp((this.projectVector.x * 0.5 + 0.5) * 100, 4, 96),
      y: clamp((-this.projectVector.y * 0.5 + 0.5) * 100, 8, 90),
    };
  }

  /* ------------------------------------------------------------------ HUD */

  getObjective() {
    if (this.phase === 'route') {
      const destination = this.pendingRoomChoices[0]?.destination;
      if (destination === 'boss')
        return this.overtime
          ? `WAVE ${pad2(this.roomsCleared)} CLEARED // ENCORE GATE OPEN`
          : `LEVEL ROUTE COMPLETE // CROSS THE ${LEVELS[this.currentLevel].bossName} GATE`;
      if (destination === 'nextLevel')
        return `LEVEL ${pad2(this.currentLevel)} CLEAR // CROSS INTO LEVEL ${pad2(nextLevel(this.currentLevel))}`;
      if (destination === 'campaignExit') return 'FORECAST BROKEN // TURN AROUND AND CROSS THE EXIT';
      const letters = this.pendingRoomChoices.map((c) => c.direction.at(0)).join(' / ');
      return this.overtime
        ? `WAVE ${pad2(this.roomsCleared)} CLEARED // MOVE TO ${letters}`
        : `ROOM ${pad2(this.roomsCleared)} CLEARED // MOVE TO ${letters}`;
    }
    if (this.phase === 'upgrade') return 'SPONSOR BREAK // CHOOSE AN ADVANTAGE';
    if (this.bossRoom) return `TAKE DOWN ${LEVELS[this.currentLevel].bossName}`;
    if (this.prizeRound)
      return `BONUS ROUND // ${Math.max(0, this.prizeClock).toFixed(1)}s // ${this.prizesClaimed} PRIZE${this.prizesClaimed === 1 ? '' : 'S'}`;
    if (!this.overtime && this.room === 1 && this.roomCombatTime < 15) {
      const src = this.input.source;
      if (this.roomCombatTime < 5)
        return src === 'gamepad' ? 'MOVE // LEFT STICK' : src === 'touch' ? 'MOVE // LEFT THUMB' : 'MOVE // WASD · ARROWS';
      if (this.roomCombatTime < 10)
        return src === 'gamepad'
          ? 'AIM + FIRE // RIGHT STICK · RT'
          : src === 'touch'
            ? 'AIM + FIRE // RIGHT THUMB'
            : 'AIM + FIRE // MOUSE · J';
      return src === 'gamepad' ? 'DASH // A · BUMPERS' : src === 'touch' ? 'DASH // DASH BUTTON' : 'DASH // SPACE';
    }
    return `CLEAR ${this.currentRoom.name} // ${this.roomKills}/${this.roomSpawnTarget}`;
  }

  pushHud() {
    const def = LEVELS[this.currentLevel];
    let boss = null;
    for (const e of this.enemies) if (!e.dead && isBoss(e.type)) boss = e;
    const h = this.hud;
    h.level = this.currentLevel;
    h.levelName = def.name;
    h.levelKicker = def.kicker;
    h.themeAccent = def.accent;
    h.bossName = def.bossName;
    h.mechanicLabel = this.mechanicStatus || def.mechanicName;
    h.score = this.score;
    h.best = this.best;
    h.health = this.playerHealth;
    h.maxHealth = this.playerMaxHealth;
    h.dash = clamp(1 - this.dashCooldown / this.dashBase, 0, 1);
    h.bombs = this.bombs;
    h.elapsed = this.elapsed;
    h.room = this.room;
    h.roomsCleared = this.roomsCleared;
    h.roomName = this.bossRoom ? def.roomNames.boss : this.currentRoom.name;
    h.roomKills = this.roomKills;
    h.roomTarget = this.roomSpawnTarget;
    h.backDirection = this.backDirection;
    h.bossRoom = this.bossRoom;
    h.kills = this.kills;
    h.combo = this.combo;
    h.multiplier = this.multiplier;
    h.weapon = WEAPON_LABELS[this.weapon];
    h.weaponTime = this.weaponTime;
    h.objective = this.getObjective();
    h.bossHealth = boss?.hp ?? 0;
    h.bossMaxHealth = boss?.maxHp ?? 0;
    h.overtime = this.overtime;
    h.wave = this.wave;
    h.prizeRound = this.prizeRound;
    h.prizeClock = this.prizeClock;
    h.contract = this.contract.id;
    this.callbacks.onHud(h);
  }
}

/** localStorage can throw (private mode, sandboxed frames): fall back to a memory store. */
function safeStorage() {
  try {
    const s = window.localStorage;
    const probe = '__neon_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
  }
}

export { safeStorage };
