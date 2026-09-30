import * as THREE from 'three/webgpu';
import { color, float, vec2, uv, texture, attribute, positionWorld, time, sin, smoothstep, length } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { ModelFactory, Bricks } from './models.js';
import { TYPES, domain } from './catalog.js';
import { Random, clamp } from './map.js';

const v3 = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
const right = new THREE.Vector3();
const qTo = new THREE.Quaternion();
const scratch = { x: 0, y: 0, visible: false };
const scratch2 = { x: 0, y: 0, visible: false };

/** Per-biome palette: ground tiles, base slab, water, rocks (side, top, studs), trees (lower, upper), minimap land. */
const BIOMES = {
  temperate: { ground: [0x849875, 0x899d78, 0x92a47e, 0x7e916f], base: 0x637861, water: 0x43867e, rock: [0x8b9275, 0xa2ad8a, 0xb1b991], tree: [0x58765d, 0x789270], mini: '#94a080' },
  coast: { ground: [0xb4b494, 0xbdbb9c, 0xb3b596, 0xc2c0a3], base: 0x637861, water: 0x43867e, rock: [0x8b9275, 0xa2ad8a, 0xb1b991], tree: [0x708c69, 0x789270], mini: '#94a080' },
  snow: { ground: [0xdbe1d9, 0xd0dad6, 0xe3e6dc, 0xd7dfd8], base: 0xa3b4ad, water: 0x719e9c, rock: [0xa5bab5, 0xe4e9df, 0xd3ded5], tree: [0x9aafa1, 0xd3dfd6], mini: '#b0bfba' },
  // Ember Ridge (Operation 04): dry autumn grass, rust and amber trees.
  autumn: { ground: [0x9a9366, 0x928b5f, 0xa39a6b, 0x8d8459], base: 0x6b6446, water: 0x4b7f78, rock: [0x8f8068, 0xa99b80, 0xb8aa8b], tree: [0xb0602f, 0xd48f3d], mini: '#a29a70' },
};
const biome = (sim) => BIOMES[sim.mission.biome] || BIOMES.temperate;

const EFFECT_POOL = 48;
const BLOOM = { strength: 0.14, radius: 0.32, threshold: 1.2 };

export class BattlefieldRenderer {
  /**
   * @param {object} kit        from boot(): renderer, canvas, onResize, shadow…
   * @param {HTMLElement} container  the element the battlefield canvas fills (#world)
   * @param {import('./debris.js').Debris} debris  cosmetic physics
   * @param {object} settings   the game's settings (effects, orders)
   */
  constructor(kit, container, debris, settings) {
    this.renderer = kit.renderer;
    this.debris = debris;
    this.settings = settings;
    this.width = 1;
    this.height = 1;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbec4b2);
    this.camera = new THREE.OrthographicCamera(-40, 40, 30, -30, 0.1, 300);
    this.target = new THREE.Vector3(26, 0, 55);
    this.goal = null;
    this.yaw = this.yawGoal = 0.47;
    this.zoom = this.zoomGoal = 28;
    this.shake = 0;
    this.models = new Map();
    this.selected = new Set();
    this.hover = 0;
    this.frame = 0;
    this.dragRect = null;
    this.bolts = [];
    this.pickList = [];
    this.hits = [];
    this.ringGeometries = new Map();
    this.shadowGeometries = new Map();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.staticGroup = new THREE.Group();
    this.entityGroup = new THREE.Group();
    this.fxGroup = new THREE.Group();
    this.scene.add(this.staticGroup, this.entityGroup, this.fxGroup);

    // Fog of war: one texel per 2 m cell, sampled in world XZ by every battlefield material.
    this.fogData = new Uint8Array(50 * 42 * 4).fill(255);
    this.fogTexture = new THREE.DataTexture(this.fogData, 50, 42, THREE.RGBAFormat);
    this.fogTexture.minFilter = this.fogTexture.magFilter = THREE.LinearFilter;
    this.fogTexture.needsUpdate = true;
    this.fogNode = texture(this.fogTexture, vec2(positionWorld.x.div(100), positionWorld.z.div(84))).r;

    this.modelMaterial = this.foggedMaterial(0xffffff, true);
    this.modelMaterial.roughness = 0.56;
    this.modelMaterial.metalness = 0.12;
    this.factory = new ModelFactory(this.modelMaterial);
    this.contactMaterial = new THREE.MeshBasicNodeMaterial({ color: 0x101e1b, transparent: true, depthWrite: false });
    this.contactMaterial.opacityNode = float(1).sub(smoothstep(0.08, 0.5, length(uv().sub(0.5)))).mul(0.3);
    this.ringMaterial = new THREE.MeshBasicNodeMaterial({ color: 0xd9f291, transparent: true, opacity: 0.95, depthWrite: false });
    this.enemyRingMaterial = new THREE.MeshBasicNodeMaterial({ color: 0xef9a71, depthWrite: false });
    this.bulletGeometry = new THREE.SphereGeometry(0.12, 5, 4);
    this.bulletMaterial = new THREE.MeshStandardNodeMaterial({ color: 0xffe4a6, emissive: 0xffb947, emissiveIntensity: 3, roughness: 0.2 });
    this.debrisGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.debrisMaterial = new THREE.MeshStandardNodeMaterial({ color: 0x627a6c, roughness: 0.8, metalness: 0.15 });
    this.projectilePool = [];
    this.debrisPool = [];

    // Pooled effects: explosions, sparks and order rings reuse meshes and materials instead of
    // building a new material (and a new node graph) for every impact.
    this.ringFx = new THREE.RingGeometry(0.8, 1, 24);
    this.burstFx = new THREE.IcosahedronGeometry(1, 0);
    this.effects = [];
    for (let i = 0; i < EFFECT_POOL; i++) {
      const material = new THREE.MeshBasicNodeMaterial({ color: 0xe5aa60, transparent: true, opacity: 0.85, depthWrite: false });
      const mesh = new THREE.Mesh(this.burstFx, material);
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.effects.push({ mesh, active: false, age: 0, life: 1, size: 1, type: '' });
    }

    this.previewMaterial = new THREE.MeshBasicNodeMaterial({ color: 0xbddf93, transparent: true, opacity: 0.32, depthWrite: false });
    this.preview = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.previewMaterial);
    this.preview.visible = false;
    this.preview.userData.type = null;
    this.scene.add(this.preview);

    this.overlay = document.createElement('canvas');
    this.overlay.className = 'world-overlay';
    this.overlay.setAttribute('aria-hidden', 'true');
    this.ctx = this.overlay.getContext('2d');
    this.overlayDpr = 1;
    this.overlayClear = false;
    container.append(this.overlay);

    const canvas = kit.canvas;
    canvas.classList.add('battlefield');
    canvas.setAttribute('aria-label', '3D real-time strategy battlefield');

    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.scene.add(new THREE.HemisphereLight(0xe0ecdf, 0x78836b, 1.3));
    this.sun = new THREE.DirectionalLight(0xffebc7, 3.2);
    this.sun.position.set(-5, 70, 20);
    this.sun.target.position.set(48, 0, 42);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -75, right: 75, top: 65, bottom: -65, near: 1, far: 170 });
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.bias = -0.00012;
    this.sun.shadow.radius = 3;
    // 2048 at 'high', scaled for the tier and kept in step when the player changes quality.
    kit.shadow(this.sun, 2048);
    this.scene.add(this.sun, this.sun.target);
    this.environment = this.makeEnvironment();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.6;

    // Bloom stays on at every tier (it only renders smaller on 'lite'); the game's
    // "Additional effects" option fades it through the strength uniform.
    this.post = createPost(kit, this.scene, this.camera, { bloom: BLOOM });
    this.setEffects(settings.effects !== false);

    kit.onResize((w, h) => this.resize(w, h));
  }

  /** Procedural HDR radiance (half float, so it filters on every GPU): no LDR skybox standing in for environment light. */
  makeEnvironment() {
    const w = 128, h = 64, data = new Uint16Array(w * h * 4), half = THREE.DataUtils.toHalfFloat;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = y / h, sun = Math.exp(-((x / w - 0.22) ** 2 + (t - 0.27) ** 2) / 0.0015) * 7;
        const sky = t < 0.52 ? 1 - t * 0.6 : 0.35;
        const i = (y * w + x) * 4;
        data[i] = half(sky * 0.88 + sun);
        data[i + 1] = half(sky * 0.98 + sun * 0.83);
        data[i + 2] = half(sky * 1.02 + sun * 0.62);
        data[i + 3] = half(1);
      }
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.magFilter = tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  foggedMaterial(hex, vertices = false) {
    const m = new THREE.MeshStandardNodeMaterial({ color: hex, roughness: 0.9, metalness: 0.03, flatShading: true });
    m.colorNode = (vertices ? attribute('color', 'vec3') : color(hex)).mul(this.fogNode);
    return m;
  }

  setEffects(on) {
    if (this.post.bloom) this.post.bloom.strength.value = on ? BLOOM.strength : 0;
  }

  /** Compile every pipeline the battle uses (pooled effects, bullets, debris, preview) before the first frame. */
  async prewarm() {
    const pooled = [...this.effects.map((f) => f.mesh), this.preview];
    const bullet = this.projectileMesh(0);
    const chunk = this.debrisMesh(0);
    for (const m of [...pooled, bullet, chunk]) {
      m.visible = true;
      m.position.set(50, -5, 42);
    }
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } finally {
      for (const m of [...pooled, bullet, chunk]) m.visible = false;
    }
  }

  resize(w, h) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlayDpr = dpr;
    this.overlay.width = Math.round(this.width * dpr);
    this.overlay.height = Math.round(this.height * dpr);
    this.overlay.style.width = `${this.width}px`;
    this.overlay.style.height = `${this.height}px`;
    this.updateCamera();
  }

  updateCamera() {
    const aspect = this.width / this.height, h = this.zoom;
    const cam = this.camera;
    cam.left = -h * aspect;
    cam.right = h * aspect;
    cam.top = h;
    cam.bottom = -h;
    let tx = this.target.x, tz = this.target.z;
    if (this.shake > 0) {
      tx += (Math.random() - 0.5) * this.shake * 0.7;
      tz += (Math.random() - 0.5) * this.shake * 0.7;
    }
    cam.position.set(tx + Math.sin(this.yaw) * 66, 78, tz + Math.cos(this.yaw) * 66);
    cam.lookAt(tx, 0, tz);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** Centre the view on a point; smooth glides there (base, selection, groups) instead of jumping. */
  focus(x, z, smooth = false) {
    const gx = clamp(x, 5, 95), gz = clamp(z, 5, 79);
    if (smooth) {
      this.goal = { x: gx, z: gz };
      return;
    }
    this.goal = null;
    this.target.x = gx;
    this.target.z = gz;
    this.updateCamera();
  }

  /** Place the camera exactly (a restored checkpoint, a new battlefield). */
  setView({ x, z, zoom, yaw }) {
    this.zoom = this.zoomGoal = clamp(zoom, 12, 48);
    this.yaw = this.yawGoal = yaw;
    this.focus(x, z);
  }

  pan(dx, dy) {
    this.goal = null;
    const scale = (this.zoom * 2) / this.height;
    right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.target.x += -right.x * dx * scale + fx * dy * scale * 1.3;
    this.target.z += -right.z * dx * scale + fz * dy * scale * 1.3;
    this.focus(this.target.x, this.target.z);
  }

  zoomBy(delta) {
    this.zoomGoal = clamp(this.zoomGoal * Math.exp(delta), 12, 48);
  }

  rotate(delta) {
    this.yaw += delta;
    this.yawGoal += delta;
    this.updateCamera();
  }

  /** Turn the camera by an angle with a short glide (the controller's quarter turn). */
  turn(angle) {
    this.yawGoal += angle;
  }

  /** Camera shake for heavy hits; it decays on its own. */
  kick(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  animateCamera(dt) {
    let changed = false;
    if (this.goal) {
      const k = 1 - Math.exp(-9 * dt);
      this.target.x += (this.goal.x - this.target.x) * k;
      this.target.z += (this.goal.z - this.target.z) * k;
      if (Math.abs(this.goal.x - this.target.x) + Math.abs(this.goal.z - this.target.z) < 0.03) this.goal = null;
      changed = true;
    }
    if (this.zoom !== this.zoomGoal) {
      this.zoom += (this.zoomGoal - this.zoom) * (1 - Math.exp(-14 * dt));
      if (Math.abs(this.zoomGoal - this.zoom) < 0.005) this.zoom = this.zoomGoal;
      changed = true;
    }
    if (this.yaw !== this.yawGoal) {
      this.yaw += (this.yawGoal - this.yaw) * (1 - Math.exp(-10 * dt));
      if (Math.abs(this.yawGoal - this.yaw) < 0.0005) this.yaw = this.yawGoal;
      changed = true;
    }
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      changed = true;
    }
    if (changed) this.updateCamera();
  }

  reset(sim, attract = false) {
    this.sim = sim;
    this.debris.reset(sim.map);
    this.staticGroup.traverse((o) => {
      if (!o.userData.disposable) return;
      o.geometry?.dispose();
      if (o.material && o.material !== this.modelMaterial) o.material.dispose();
    });
    this.staticGroup.clear();
    this.entityGroup.clear();
    this.models.clear();
    for (const f of this.effects) {
      f.active = false;
      f.mesh.visible = false;
    }
    for (const m of this.projectilePool) m.visible = false;
    for (const m of this.debrisPool) m.visible = false;
    this.bolts.length = 0;
    this.setPlacement(null);
    this.dragRect = null;
    this.hover = 0;
    this.buildTerrain(sim);
    this.updateFog(sim);
    this.shake = 0;
    this.setView({ x: attract ? 36 : sim.mission.base[0] + 7, z: attract ? 50 : sim.mission.base[1] - 7, zoom: 27, yaw: 0.47 });
    this.selected.clear();
  }

  buildTerrain(sim) {
    const look = biome(sim), palette = look.ground, rng = new Random(225 + sim.missionIndex);
    const groups = palette.map(() => []), water = [], bridges = [];
    for (let i = 0; i < sim.map.cells.length; i++) {
      const p = sim.map.point(i), type = sim.map.cells[i];
      if (type === 1) water.push(p);
      else if (type === 2) bridges.push(p);
      else groups[Math.floor(rng.next() * palette.length)].push(p);
    }
    const addInstances = (points, geometry, mat, y) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, Math.max(1, points.length));
      mesh.count = points.length;
      mesh.receiveShadow = true;
      mesh.userData.disposable = true;
      points.forEach((p, i) => {
        matrix.makeTranslation(p.x, y, p.z);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.staticGroup.add(mesh);
      return mesh;
    };
    const base = new THREE.Mesh(new THREE.BoxGeometry(101, 2.5, 85), this.foggedMaterial(look.base));
    base.position.set(50, -1.63, 42);
    base.receiveShadow = true;
    base.userData.disposable = true;
    this.staticGroup.add(base);
    groups.forEach((points, i) => addInstances(points, new THREE.BoxGeometry(1.976, 0.35, 1.976), this.foggedMaterial(palette[i]), -0.185));
    const waterMat = this.foggedMaterial(look.water);
    waterMat.metalness = 0.22;
    waterMat.roughness = 0.25;
    waterMat.colorNode = color(look.water).mul(sin(positionWorld.x.mul(0.3).add(positionWorld.z.mul(0.22)).add(time.mul(0.7))).mul(0.025).add(1)).mul(this.fogNode);
    addInstances(water, new THREE.BoxGeometry(2.01, 0.12, 2.01), waterMat, -0.13);
    addInstances(bridges, new THREE.BoxGeometry(1.98, 0.45, 1.98), this.foggedMaterial(0xc2b894), 0.055);

    const details = new Bricks();
    // Two clear roads link deployment area, crossings, and enemy positions.
    for (let x = 6; x < 95; x += 2) {
      if (sim.map.cellAt(x, 62) !== 1 && sim.map.cellAt(x, 62) !== 3) {
        details.box(1.98, 0.045, 4, 0xb7af88, x, 0.035, 62);
        if (x % 6 === 0) details.box(0.9, 0.018, 0.1, 0xe8dbb7, x, 0.066, 62);
      }
    }
    const roadX = sim.missionIndex === 1 ? 62 : 80;
    for (let z = 10; z < 64; z += 2) {
      if (!sim.map.blocked(roadX, z)) {
        details.box(4, 0.045, 1.98, 0xb7af88, roadX, 0.035, z);
        if (z % 6 === 0) details.box(0.1, 0.018, 0.9, 0xe8dbb7, roadX, 0.066, z);
      }
    }
    for (const r of sim.map.obstacles) {
      details.box(r.w, 1.45, r.h, look.rock[0], r.x, 0.6, r.z);
      details.box(r.w - 1.2, 1.1, r.h - 1.2, look.rock[1], r.x, 1.65, r.z);
      details.studs(r.w - 1.6, r.h - 1.6, 2.26, look.rock[2], r.x, r.z, 1.6);
    }
    for (let i = 0; i < 210; i++) {
      const x = rng.range(3, 97), z = rng.range(3, 81);
      if (sim.map.blocked(x, z) || sim.entities.some((e) => Math.hypot(e.x - x, e.z - z) < 7) || sim.resources.some((r) => Math.hypot(r.x - x, r.z - z) < 6) || Math.abs(z - 62) < 5 || Math.abs(x - roadX) < 4) continue;
      if (rng.next() < 0.72) {
        const h = rng.range(1.2, 2.7);
        details.box(0.32, h * 0.6, 0.32, 0x756e4e, x, h * 0.3, z);
        details.cone(h * 0.45, h, look.tree[0], x, h * 0.76, z).cone(h * 0.35, h * 0.8, look.tree[1], x, h * 1.12, z);
      } else details.box(0.6, 0.3, 0.7, 0xa7ac8a, x, 0.12, z, rng.range(0, 6));
    }
    for (const r of sim.resources) {
      const col = r.kind === 'gems' ? 0xb999c0 : 0xeac66d;
      for (let i = 0; i < 18; i++) {
        const a = i * 2.4, rad = 0.8 + (i % 5) * 0.53;
        details.box(0.6 + rng.next() * 0.45, 0.28 + rng.next() * 0.45, 0.7, col, r.x + Math.sin(a) * rad, 0.19, r.z + Math.cos(a) * rad, a);
      }
    }
    // Safety-striped perimeter and bridge edge markers.
    for (let x = 2; x < 100; x += 4) details.box(1.5, 0.07, 0.25, 0xcad596, x, 0.02, 1).box(1.5, 0.07, 0.25, 0xcad596, x, 0.02, 83);
    for (const p of bridges) {
      if (sim.map.cellAt(p.x, p.z + 2) === 1 || sim.map.cellAt(p.x, p.z - 2) === 1) details.box(1.8, 0.5, 0.17, 0xe1d3aa, p.x, 0.43, p.z + (sim.map.cellAt(p.x, p.z + 2) === 1 ? 0.9 : -0.9));
    }
    const mesh = new THREE.Mesh(details.finish(), this.modelMaterial);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.disposable = true;
    this.staticGroup.add(mesh);

    this.crateGeometry ??= new Bricks().box(1.3, 0.8, 1.3, 0xd7bb73, 0, 0.5).box(1.38, 0.15, 1.38, 0xe7d29a, 0, 0.95).box(0.15, 0.9, 1.38, 0x556e61, 0, 0.5).finish();
    this.crateModels = [];
    for (const c of sim.crates) {
      const m = new THREE.Mesh(this.crateGeometry, this.modelMaterial);
      m.position.set(c.x, 0, c.z);
      m.castShadow = true;
      this.staticGroup.add(m);
      this.crateModels.push({ id: c.id, mesh: m });
    }

    // Operation 04: evacuation trucks roll west through the southern pass while the tower stands.
    this.convoy = [];
    if (sim.hold > 0) {
      this.truckGeometry ??= new Bricks()
        .box(1.5, 0.45, 3.8, 0x263637, 0, 0.5)
        .box(1.4, 1.05, 1.1, 0xe3dbc1, 0, 1.2, 1.25).box(1.2, 0.35, 0.06, 0x9bd7d1, 0, 1.45, 1.82)
        .box(1.55, 1.45, 2.4, 0xe8bd61, 0, 1.45, -0.6).box(1.6, 0.12, 2.5, 0xe3dbc1, 0, 2.22, -0.6)
        .cyl(0.32, 0.25, 0x283330, -0.78, 0.35, 1.2, 8, Math.PI / 2).cyl(0.32, 0.25, 0x283330, 0.78, 0.35, 1.2, 8, Math.PI / 2)
        .cyl(0.32, 0.25, 0x283330, -0.78, 0.35, -1.2, 8, Math.PI / 2).cyl(0.32, 0.25, 0x283330, 0.78, 0.35, -1.2, 8, Math.PI / 2)
        .finish();
      for (let k = 0; k < 3; k++) {
        const truck = new THREE.Mesh(this.truckGeometry, this.modelMaterial);
        truck.castShadow = true;
        truck.rotation.y = -Math.PI / 2;
        truck.visible = false;
        this.staticGroup.add(truck);
        this.convoy.push(truck);
      }
    }
  }

  updateFog(sim) {
    for (let i = 0; i < sim.map.cells.length; i++) {
      const value = sim.visibility[0][i] ? 255 : sim.explored[0][i] ? 115 : 37;
      this.fogData[i * 4] = this.fogData[i * 4 + 1] = this.fogData[i * 4 + 2] = value;
      this.fogData[i * 4 + 3] = 255;
    }
    this.fogTexture.needsUpdate = true;
  }

  ringGeometry(radius) {
    const key = radius.toFixed(2);
    let g = this.ringGeometries.get(key);
    if (!g) this.ringGeometries.set(key, (g = new THREE.RingGeometry(radius, radius + 0.09, 32)));
    return g;
  }

  shadowGeometry(radius) {
    const key = radius.toFixed(2);
    let g = this.shadowGeometries.get(key);
    if (!g) this.shadowGeometries.set(key, (g = new THREE.PlaneGeometry(radius * 2.4, radius * 2.4)));
    return g;
  }

  syncEntity(e, sim, alpha) {
    let model = this.models.get(e.id);
    if (model && model.userData.owner !== e.owner) {
      this.entityGroup.remove(model);
      this.models.delete(e.id);
      model = null;
    }
    const d = TYPES[e.type];
    if (!model) {
      model = this.factory.make(e.type, e.owner, sim.faction);
      model.userData.owner = e.owner;
      model.userData.entity = e.id;
      model.traverse((o) => {
        if (o.isMesh) o.userData.entity = e.id;
      });
      const radius = d.kind === 'building' ? d.radius + 1 : d.radius + 0.5;
      const ring = new THREE.Mesh(this.ringGeometry(radius), e.owner === 0 ? this.ringMaterial : this.enemyRingMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.09;
      ring.visible = false;
      model.add(ring);
      model.userData.ring = ring;
      const shadow = new THREE.Mesh(this.shadowGeometry(radius), this.contactMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.023;
      model.add(shadow);
      model.userData.shadow = shadow;
      this.entityGroup.add(model);
      this.models.set(e.id, model);
    }
    model.userData.stamp = this.frame;
    model.visible = e.owner === 0 || sim.visibleTo(e) || (d.kind === 'building' && e.seen);
    const x = THREE.MathUtils.lerp(e.px, e.x, alpha), z = THREE.MathUtils.lerp(e.pz, e.z, alpha), air = domain(e) === 'air';
    model.position.set(x, air ? 4.8 + Math.sin(sim.time * 3 + e.id) * 0.12 : 0, z);
    model.rotation.y = d.kind === 'building' ? (e.rot * Math.PI) / 2 : e.prevAngle + Math.atan2(Math.sin(e.angle - e.prevAngle), Math.cos(e.angle - e.prevAngle)) * alpha;
    model.userData.shadow.position.y = air ? -4.76 : 0.023;
    model.userData.ring.position.y = air ? -4.7 : 0.09;
    model.userData.ring.visible = this.selected.has(e.id) || this.hover === e.id;
    const turret = model.userData.turret;
    if (turret) {
      const spinning = e.type === 'radar' || e.type === 'relay' || e.type === 'tower';
      turret.rotation.y = spinning ? sim.time * 0.5 : e.target ? e.turret - model.rotation.y : 0;
      if (!spinning) turret.position.z = -Math.max(0, 0.18 - (sim.time - (e.lastShot || -10)) * 0.8);
    }
    if (model.userData.rotor) model.userData.rotor.rotation.y = sim.time * 38;
    const age = sim.time - e.born;
    model.scale.y = age < 0.4 && d.kind === 'building' ? 0.1 + 0.9 * Math.min(1, age / 0.4) : 1;
  }

  event(event, sim) {
    const visible = event.owner === 0 || (Number.isFinite(event.x) && sim.visibility[0][sim.map.indexAt(event.x, event.z)]);
    if (!visible && ['destroyed', 'impact', 'strike', 'fire'].includes(event.type)) return;
    if (event.type === 'destroyed') {
      this.addEffect(event.x, event.z, 'explosion', event.large ? 2.2 : 1.1);
      this.debris.burst(event.x, event.z, event.large);
      if (event.large) this.kick(0.45);
    } else if (event.type === 'impact' && this.settings.effects !== false) {
      this.addEffect(event.x, event.z, event.weapon === 'rifle' ? 'spark' : 'explosion', event.weapon === 'shell' ? 1.1 : 0.5, event.air ? 4.8 : 0);
    } else if (event.type === 'fire' && event.weapon === 'tesla') {
      // Tesla shots are instant: draw a short-lived arc between the coil and its target.
      if (this.bolts.length < 24) this.bolts.push({ x: event.x, z: event.z, tx: event.tx, tz: event.tz, age: 0, seed: Math.random() * 1000 });
    } else if (event.type === 'strike') {
      this.addEffect(event.x, event.z, 'explosion', 5);
      this.debris.burst(event.x, event.z, true);
      this.kick(1);
    } else if (['order', 'scan', 'pickup', 'constructed', 'capture'].includes(event.type) && Number.isFinite(event.x)) {
      this.addEffect(event.x, event.z, 'order', event.type === 'scan' ? 4 : 1.5);
    }
  }

  addEffect(x, z, type, size, y = 0) {
    let f = null;
    for (const e of this.effects) {
      if (!e.active) {
        f = e;
        break;
      }
      if (!f || e.age / e.life > f.age / f.life) f = e;
    }
    const ring = type === 'order';
    f.active = true;
    f.age = 0;
    f.life = ring ? 0.8 : type === 'spark' ? 0.18 : 0.55;
    f.size = size;
    f.type = type;
    const mesh = f.mesh;
    mesh.geometry = ring ? this.ringFx : this.burstFx;
    mesh.material.color.setHex(ring ? 0xe6f4ad : type === 'spark' ? 0xfff1b8 : 0xe5aa60);
    mesh.material.opacity = 0.85;
    mesh.position.set(x, y + (ring ? 0.16 : 0.9), z);
    mesh.rotation.set(ring ? -Math.PI / 2 : 0, 0, 0);
    mesh.scale.setScalar(size * 0.4);
    mesh.visible = true;
  }

  setPlacement(type, point, valid, rot = 0) {
    const p = this.preview;
    if (!type) {
      p.visible = false;
      p.userData.type = null;
      return;
    }
    if (p.userData.type !== type) {
      const d = TYPES[type];
      p.scale.set(d.size[0], 1, d.size[1]);
      p.userData.type = type;
    }
    if (!point) {
      p.visible = false;
      return;
    }
    p.position.set(Math.round(point.x), 0.55, Math.round(point.z));
    p.rotation.y = (rot * Math.PI) / 2;
    this.previewMaterial.color.setHex(valid ? 0xcce895 : 0xe67c66);
    p.visible = true;
  }

  /** Canvas-local pixels → the ground point under them (or null). */
  pickGround(x, y) {
    ndc.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = this.raycaster.ray.intersectPlane(this.plane, hitPoint);
    return p ? { x: clamp(p.x, 1, 99), z: clamp(p.z, 1, 83) } : null;
  }

  /** World point → canvas-local pixels. Pass `out` to avoid an allocation. */
  screenPoint(x, z, y = 0, out = { x: 0, y: 0, visible: false }) {
    v3.set(x, y, z).project(this.camera);
    out.x = ((v3.x + 1) / 2) * this.width;
    out.y = ((1 - v3.y) / 2) * this.height;
    out.visible = Number.isFinite(v3.x) && v3.x >= -1 && v3.x <= 1 && v3.y >= -1 && v3.y <= 1 && v3.z > -1 && v3.z < 1;
    return out;
  }

  /** The visible entity under canvas-local pixels: a mesh hit first, else the nearest marker within reach. */
  pickEntity(x, y, touch = false) {
    if (!this.sim) return null;
    ndc.set((x / this.width) * 2 - 1, 1 - (y / this.height) * 2);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.pickList.length = 0;
    for (const m of this.models.values()) if (m.visible) this.pickList.push(m);
    this.hits.length = 0;
    this.raycaster.intersectObjects(this.pickList, true, this.hits);
    for (const hit of this.hits) {
      const id = hit.object.userData.entity;
      if (id) {
        const e = this.sim.get(id);
        if (e && this.sim.visibleTo(e)) return e;
      }
    }
    let best = null, score = Infinity;
    for (const e of this.sim.entities) {
      if (!this.sim.visibleTo(e)) continue;
      const p = this.screenPoint(e.x, e.z, domain(e) === 'air' ? 5 : 1, scratch);
      const dist = Math.hypot(x - p.x, y - p.y);
      if (dist < (touch ? 25 : 14) && dist < score) {
        score = dist;
        best = e;
      }
    }
    return best;
  }

  selectRectangle(rect) {
    return this.sim
      .owned(0)
      .filter((e) => {
        if (TYPES[e.type].kind === 'building') return false;
        const p = this.screenPoint(e.x, e.z, domain(e) === 'air' ? 5 : 1, scratch);
        return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
      })
      .map((e) => e.id);
  }

  drawOverlay(sim, dt) {
    const ctx = this.ctx, dpr = this.overlayDpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    this.overlayClear = false;
    for (const e of sim.entities) {
      const selected = this.selected.has(e.id), d = TYPES[e.type];
      if (!sim.visibleTo(e)) continue;
      if (selected || e.hp < d.hp * 0.99 || this.hover === e.id) {
        const y = domain(e) === 'air' ? 6.7 : d.kind === 'building' ? 4.8 : 2.6, p = this.screenPoint(e.x, e.z, y, scratch);
        if (!p.visible) continue;
        const w = d.kind === 'building' ? 50 : 28;
        ctx.fillStyle = '#162b29dd';
        ctx.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
        ctx.fillStyle = e.hp / d.hp < 0.3 ? '#ef9778' : e.owner === 0 ? '#d9eca1' : '#e29471';
        ctx.fillRect(p.x - w / 2, p.y, w * clamp(e.hp / d.hp, 0, 1), 3);
        if (e.veterancy) {
          ctx.fillStyle = '#e4d091';
          ctx.font = '10px monospace';
          ctx.textAlign = 'left';
          ctx.fillText('★'.repeat(e.veterancy), p.x - w / 2, p.y - 4);
        }
        if (this.hover === e.id) {
          ctx.font = '600 11px system-ui';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#102724ed';
          const tw = ctx.measureText(d.name).width + 16;
          ctx.fillRect(p.x - tw / 2, p.y - 25, tw, 18);
          ctx.fillStyle = '#f5f0da';
          ctx.fillText(d.name, p.x, p.y - 12);
          ctx.textAlign = 'left';
        }
      }
      if (selected && e.command?.x && e.path?.length && this.settings.orders !== false) {
        const p = this.screenPoint(e.x, e.z, 0.2, scratch);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (const w of e.path) {
          const q = this.screenPoint(w.x, w.z, 0.2, scratch2);
          ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = '#d9eca17a';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Tesla arcs: a jagged, fading line from coil to target.
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += dt;
      if (b.age > 0.16) {
        this.bolts.splice(i, 1);
        continue;
      }
      const a = this.screenPoint(b.x, b.z, 3.2, scratch), c = this.screenPoint(b.tx, b.tz, 1, scratch2);
      const ax = a.x, ay = a.y, cx = c.x, cy = c.y, len = Math.hypot(cx - ax, cy - ay) || 1;
      const nx = -(cy - ay) / len, ny = (cx - ax) / len;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      for (let k = 1; k < 7; k++) {
        const t = k / 7, jitter = Math.sin(b.seed + k * 12.9898 + b.age * 90) * 9;
        ctx.lineTo(ax + (cx - ax) * t + nx * jitter, ay + (cy - ay) * t + ny * jitter);
      }
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = `rgba(214, 244, 255, ${1 - b.age / 0.16})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.dragRect) {
      ctx.fillStyle = '#ddefa522';
      ctx.strokeStyle = '#ddefa5';
      ctx.lineWidth = 1;
      ctx.fillRect(this.dragRect.x, this.dragRect.y, this.dragRect.w, this.dragRect.h);
      ctx.strokeRect(this.dragRect.x + 0.5, this.dragRect.y + 0.5, this.dragRect.w, this.dragRect.h);
    }
  }

  drawMinimap(canvas, sim) {
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, sx = w / 100, sz = h / 84;
    const land = biome(sim).mini;
    ctx.fillStyle = '#142c28';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < sim.map.cells.length; i++) {
      if (!sim.explored[0][i]) continue;
      const p = sim.map.point(i), t = sim.map.cells[i];
      ctx.fillStyle = t === 1 ? '#497d78' : t === 3 ? '#708270' : land;
      ctx.globalAlpha = sim.visibility[0][i] ? 1 : 0.42;
      ctx.fillRect((p.x - 1) * sx, (p.z - 1) * sz, sx * 2 + 0.5, sz * 2 + 0.5);
    }
    ctx.globalAlpha = 1;
    for (const r of sim.resources) {
      if (sim.explored[0][sim.map.indexAt(r.x, r.z)]) {
        ctx.fillStyle = '#d7bf76';
        ctx.fillRect(r.x * sx - 2, r.z * sz - 2, 4, 4);
      }
    }
    const radar = sim.has('radar') && !sim.lowPower();
    for (const e of sim.entities) {
      if (e.owner === 1 && (!radar || !sim.visibleTo(e))) continue;
      if (e.owner === 2 && !sim.explored[0][sim.map.indexAt(e.x, e.z)] && !e.strategic) continue;
      ctx.fillStyle = e.tag === 'tower' ? '#f1d27a' : e.owner === 0 ? '#cbeaac' : e.owner === 1 ? '#ee9776' : '#e3c077';
      const n = TYPES[e.type].kind === 'building' ? 5 : 3;
      ctx.fillRect(e.x * sx - n / 2, e.z * sz - n / 2, n, n);
    }
    ctx.beginPath();
    const corners = [0, 0, this.width, 0, this.width, this.height, 0, this.height];
    for (let i = 0; i < 4; i++) {
      const p = this.pickGround(corners[i * 2], corners[i * 2 + 1]);
      if (!p) continue;
      if (i) ctx.lineTo(p.x * sx, p.z * sz);
      else ctx.moveTo(p.x * sx, p.z * sz);
    }
    ctx.closePath();
    ctx.strokeStyle = '#f5eed0b0';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  projectileMesh(i) {
    let m = this.projectilePool[i];
    if (!m) {
      m = new THREE.Mesh(this.bulletGeometry, this.bulletMaterial);
      m.visible = false;
      this.fxGroup.add(m);
      this.projectilePool[i] = m;
    }
    return m;
  }

  debrisMesh(i) {
    let m = this.debrisPool[i];
    if (!m) {
      m = new THREE.Mesh(this.debrisGeometry, this.debrisMaterial);
      m.castShadow = true;
      m.visible = false;
      this.fxGroup.add(m);
      this.debrisPool[i] = m;
    }
    return m;
  }

  render(sim, alpha, dt, { attract = false } = {}) {
    this.frame++;
    if (attract) {
      this.yaw = this.yawGoal = 0.47 + Math.sin(performance.now() * 0.00005) * 0.06;
      this.updateCamera();
    }
    this.animateCamera(dt);
    for (const e of sim.entities) this.syncEntity(e, sim, alpha);
    for (const [id, m] of this.models) {
      if (m.userData.stamp !== this.frame) {
        this.entityGroup.remove(m);
        this.models.delete(id);
      }
    }
    for (const c of this.crateModels || []) {
      const state = sim.crates.find((s) => s.id === c.id);
      c.mesh.visible = !!state && !state.taken && !!sim.explored[0][sim.map.indexAt(state.x, state.z)];
    }
    if (this.frame % 10 === 0) this.updateFog(sim);

    let used = 0;
    for (const p of sim.projectiles) {
      if (!sim.visibility[0][sim.map.indexAt(p.x, p.z)] && !sim.visibility[0][sim.map.indexAt(p.tx, p.tz)]) continue;
      const m = this.projectileMesh(used++);
      const t = clamp(p.age / p.duration, 0, 1), target = sim.get(p.target);
      const tx = target?.x ?? p.tx, tz = target?.z ?? p.tz;
      m.position.set(p.x + (tx - p.x) * t, (p.fromAir ? 4.8 : 1.5) * (1 - t) + (p.toAir ? 4.8 : 1.2) * t + (p.weapon === 'shell' ? Math.sin(t * Math.PI) * 6 : 0), p.z + (tz - p.z) * t);
      m.scale.setScalar(p.weapon === 'rifle' ? 0.45 : p.weapon === 'shell' ? 1.6 : 1);
      m.visible = p.weapon !== 'tesla';
    }
    for (let i = used; i < this.projectilePool.length; i++) this.projectilePool[i].visible = false;

    used = 0;
    for (const d of this.debris.debris) {
      const m = this.debrisMesh(used++);
      m.position.set(THREE.MathUtils.lerp(d.prev.x, d.curr.x, alpha), THREE.MathUtils.lerp(d.prev.y, d.curr.y, alpha), THREE.MathUtils.lerp(d.prev.z, d.curr.z, alpha));
      qTo.set(d.rot.x, d.rot.y, d.rot.z, d.rot.w);
      m.quaternion.set(d.prevRot.x, d.prevRot.y, d.prevRot.z, d.prevRot.w).slerp(qTo, alpha);
      m.scale.set(d.size * 2, d.size * 1.3, d.size * 2).multiplyScalar(Math.min(1, d.life));
      m.visible = true;
    }
    for (let i = used; i < this.debrisPool.length; i++) this.debrisPool[i].visible = false;

    for (const f of this.effects) {
      if (!f.active) continue;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        f.active = false;
        f.mesh.visible = false;
        continue;
      }
      f.mesh.scale.setScalar(f.size * (f.type === 'order' ? 0.65 + t * 1.3 : 0.4 + t));
      f.mesh.material.opacity = (1 - t) * (f.type === 'order' ? 0.8 : 0.9);
      if (f.type !== 'order') f.mesh.position.y += dt * 1.1;
    }

    if (this.convoy?.length) {
      const rolling = sim.holdRemaining() > 0 || sim.time < sim.hold + 20;
      this.convoy.forEach((truck, k) => {
        const u = (sim.time * 3.2 + k * 16) % 48;
        const x = 44 - u;
        truck.position.set(x, 0, 60.6);
        truck.visible = rolling && x > 1.5 && x < 43.5 && !!sim.explored[0][sim.map.indexAt(x, 61)];
      });
    }

    this.post.render();
    if (!attract) this.drawOverlay(sim, dt);
    else if (!this.overlayClear) {
      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      this.overlayClear = true;
    }
  }
}
