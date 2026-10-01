import * as THREE from 'three/webgpu';
import { float, mix, positionLocal, smoothstep, uv, uniform, materialColor } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { bakeInstances } from 'kit/instancing.js';
import { SHIP } from './content.js';
import { rng, clamp } from './core.js';
import { PORT, SCAN } from './sim.js';
const COLORS = {
  cream: 0xd8d7c0,
  ivory: 0xe6e2cc,
  teal: 0x418e92,
  dark: 0x203944,
  metal: 0x58717b,
  amber: 0xf3bb70,
  orange: 0xe48261,
  cyan: 0x96e3d9,
  purple: 0x9589ab,
  corsair: 0x6d5f82,
  red: 0xd9605a,
};
/** Analytic toy-brick contact shading: darken the recessed lower faces, without smoothing facets. Shared by every brick material. */
const BRICK_SHADE = mix(float(0.68), float(1), smoothstep(float(-0.52), float(0.15), positionLocal.y));
const SHOT_CAP = 128;
const FX_POOL = 20;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/**
 * One scene and one TSL material family for both WebGPU and WebGL2. The kit
 * owns the renderer, its size, pixel ratio, anti-aliasing and shadow-map size;
 * this class owns the scene, the camera and the post chain (bloom).
 */
export class View {
  constructor(kit) {
    this.kit = kit;
    this.renderer = kit.renderer;
    this.backend = kit.backendLabel;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070f19);
    this.camera = new THREE.OrthographicCamera(-60, 60, 40, -40, 0.1, 1600);
    this.camera.up.set(0, 1, 0);
    this.cameraTarget = new THREE.Vector3(-13, 0, -13);
    this.world = new THREE.Group();
    this.actors = new THREE.Group();
    this.scene.add(this.world, this.actors);
    this.meshes = new Map();
    this.owned = [];
    this.materials = new Map();
    this.debrisPool = [];
    this.title = true;
    this.zoom = 1;
    this.frame = 0;
    this.width = 1;
    this.height = 1;
    this.shake = 0;
    this.snap = false;
    this.scanHighlight = false;
    this.box = new THREE.BoxGeometry(1, 1, 1);
    this.cylinder = new THREE.CylinderGeometry(0.25, 0.25, 0.18, 8, 1);
    this.wedge = new THREE.CylinderGeometry(0, 0.75, 1.7, 4, 1);
    this.smallSphere = new THREE.IcosahedronGeometry(1, 0);
    this.torus = new THREE.TorusGeometry(1, 0.035, 4, 48);
    // Scratch objects: nothing is allocated per frame.
    this._v = new THREE.Vector3();
    this._wanted = new THREE.Vector3();
    this._offset = new THREE.Vector3(0, 115, 58);
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._ndc = new THREE.Vector2();
    this._hit = new THREE.Vector3();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._ray = new THREE.Raycaster();
    this._aim = { x: 0, z: 0 };
    this._last = { x: 0, z: 0 };
    this._vel = { x: 0, z: 0 };
    const r = this.renderer;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
  }
  mat(c, emissive = 0, metalness = 0.15) {
    const key = `${c}:${emissive}:${metalness}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const m = new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.54, metalness, flatShading: true });
    // The colour is a uniform, so every brick material compiles to the same shader.
    m.colorNode = materialColor.mul(BRICK_SHADE);
    if (emissive) m.emissiveNode = materialColor.mul(uniform(emissive));
    this.materials.set(key, m);
    return m;
  }
  basic(c, opacity = 1) {
    const key = `basic:${c}:${opacity}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const m = new THREE.MeshBasicNodeMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity === 1 });
    this.materials.set(key, m);
    return m;
  }
  mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  block(parent, x, y, z, sx, sy, sz, c, studs = false) {
    const b = this.mesh(this.box, this.mat(c), parent, x, y, z, sx, sy, sz);
    if (studs) {
      const countX = Math.max(1, Math.min(3, Math.round(sx))),
        countZ = Math.max(1, Math.min(5, Math.round(sz)));
      for (let i = 0; i < countX; i++)
        for (let j = 0; j < countZ; j++) {
          const px = x + (i - (countX - 1) / 2) * 0.65,
            pz = z + (j - (countZ - 1) / 2) * 0.7;
          // A dark, slightly wider base is a cheap, stable contact-shadow cue on both backends.
          this.mesh(this.cylinder, this.mat(c), parent, px, y + sy / 2 + 0.06, pz, 1.13, 0.22, 1.13);
          this.mesh(this.cylinder, this.mat(c), parent, px, y + sy / 2 + 0.16, pz, 0.9, 1, 0.9);
        }
    }
    return b;
  }
  ship(id, team = 'player', boss = false) {
    const info = SHIP[id] || SHIP.shuttle,
      g = new THREE.Group(),
      hull = boss ? COLORS.corsair : team === 'hostile' ? COLORS.purple : info.color,
      accent = boss ? COLORS.red : team === 'hostile' ? COLORS.orange : COLORS.teal;
    const freighter = ['barge', 'mule', 'argosy'].includes(id),
      heavy = ['bastion', 'dreadnought', 'shieldbeetle'].includes(id);
    const engines = [];
    this.block(g, 0, 0, 0.25, 2.2, 0.7, 4.5, hull, true);
    this.block(g, 0, 0.47, -0.9, 1.25, 0.65, 1.55, COLORS.dark);
    this.block(g, 0, 0.85, -1.13, 0.85, 0.18, 0.72, accent);
    this.block(g, 0, 0.15, -2.3, 1.55, 0.55, 0.6, hull);
    const nose = this.mesh(this.wedge, this.mat(hull), g, 0, 0.07, -2.8, 1, 0.95, 0.95);
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    for (const side of [-1, 1]) {
      const wing = this.block(
        g,
        side * (freighter ? 1.6 : 2),
        -0.15,
        0.65,
        freighter ? 1.4 : 2.4,
        0.5,
        freighter ? 3.6 : 1.5,
        hull,
        freighter,
      );
      if (!freighter) wing.rotation.y = -side * 0.25;
      this.block(g, side * (heavy ? 2.55 : 1.65), 0.15, 1.65, 0.65, 0.65, 1.3, COLORS.dark);
      this.block(g, side * 1.65, 0.5, 1.65, 0.5, 0.2, 0.9, accent, true);
      this.block(g, side * (heavy ? 2.5 : 1.2), 0.15, -1.75, 0.22, 0.24, 1.2, COLORS.metal);
      this.block(g, side * (freighter ? 2.2 : 2.65), 0.08, 0.4, 0.14, 0.12, 0.25, side < 0 ? COLORS.orange : COLORS.cyan);
      const engine = this.mesh(
        this.box,
        this.mat(team === 'hostile' ? COLORS.orange : COLORS.cyan, 3),
        g,
        side * 1.65,
        0.03,
        2.7,
        0.45,
        0.3,
        1.15,
      );
      engine.name = 'engine';
      engine.castShadow = false;
      engines.push(engine);
    }
    if (freighter) {
      this.block(g, 0, 0.48, 0.88, 1.35, 0.75, 2.2, accent, true);
    }
    if (heavy) {
      this.block(g, 0, 0.48, 1.4, 1.5, 0.55, 1.9, hull, true);
      for (const side of [-1, 1]) this.block(g, side * 2.4, 0.25, -0.2, 1.25, 0.75, 2.1, accent, true);
    }
    if (boss) {
      // The Corsair's flagship: a raised command tower, twin prow guns and a red running light.
      this.block(g, 0, 1.05, 0.55, 1.1, 0.8, 1.3, COLORS.dark, true);
      this.block(g, 0, 1.55, 0.4, 0.7, 0.25, 0.7, accent);
      for (const side of [-1, 1]) this.block(g, side * 0.9, 0.35, -3.1, 0.28, 0.28, 1.6, COLORS.metal);
      this.mesh(this.box, this.mat(COLORS.red, 2.5), g, 0, 1.75, 0.4, 0.3, 0.12, 0.3).castShadow = false;
    }
    g.scale.setScalar(info.scale * 1.12 * (boss ? 1.3 : 1));
    g.userData.ship = true;
    g.userData.engines = engines;
    this.compactGroup(g);
    return g;
  }
  compactGroup(root) {
    // Batch identical bricks within each moving model. Ships remain independently transformable.
    // The batches never move inside the model, so they are baked into plain meshes: in r186
    // every InstancedMesh compiles its own shaders, and each ship would add a set.
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert(),
      groups = new Map(),
      m4 = new THREE.Matrix4();
    root.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.name === 'engine') return;
      const key = m.geometry.uuid + ':' + m.material.uuid + ':' + m.castShadow + ':' + m.receiveShadow;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });
    for (const items of groups.values()) {
      if (items.length < 2) continue;
      const first = items[0],
        batch = new THREE.InstancedMesh(first.geometry, first.material, items.length);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      items.forEach((mesh, index) => batch.setMatrixAt(index, m4.multiplyMatrices(inverse, mesh.matrixWorld)));
      for (const mesh of items) mesh.removeFromParent();
      root.add(bakeInstances(batch));
    }
  }
  async init() {
    const sky = new THREE.HemisphereLight(0xaedbdc, 0x203148, 1.8);
    this.scene.add(sky);
    this.sun = new THREE.DirectionalLight(0xffe1ba, 3.1);
    this.sun.position.set(-45, 95, -45);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -90;
    this.sun.shadow.camera.right = 90;
    this.sun.shadow.camera.top = 90;
    this.sun.shadow.camera.bottom = -90;
    this.sun.shadow.camera.near = 0.1;
    this.sun.shadow.camera.far = 230;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.1;
    // 2048 on high, scaled for the tier, and kept sized when the player changes quality.
    this.kit.shadow(this.sun, 2048);
    this.scene.add(this.sun, this.sun.target);
    const rim = new THREE.DirectionalLight(0x64aec8, 1.1);
    rim.position.set(45, 24, 55);
    this.scene.add(rim);
    // Procedural HDR radiance environment: floating-point values exceed 1.0. No remote image dependencies.
    const w = 128,
      h = 64,
      values = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / w,
          v = y / h,
          key = Math.exp(-((u - 0.24) ** 2 / 0.002 + (v - 0.28) ** 2 / 0.004)) * 8,
          fill = Math.exp(-((u - 0.72) ** 2 / 0.025 + (v - 0.4) ** 2 / 0.015)) * 2.5,
          idx = (y * w + x) * 4;
        values[idx] = 0.045 + key + fill * 0.3;
        values[idx + 1] = 0.09 + key * 0.84 + fill * 0.65;
        values[idx + 2] = 0.13 + key * 0.65 + fill;
        values[idx + 3] = 1;
      }
    const env = new THREE.DataTexture(values, w, h, THREE.RGBAFormat, THREE.FloatType);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromEquirectangular(env);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.65;
    env.dispose();
    pmrem.dispose();
    this.buildStars();
    this.buildPools();
    // Bloom on the emissive engines, shots and beacons at every tier; the kit sizes it and picks MSAA or FXAA.
    this.post = createPost(this.kit, this.scene, this.camera, { bloom: { strength: 0.25, radius: 0.35, threshold: 1.25 } });
    this.kit.onResize((width, height) => {
      this.width = width;
      this.height = height;
      this.updateCamera();
    });
  }
  buildStars() {
    const random = rng('starlight-starfield'),
      count = 850;
    const stars = new THREE.InstancedMesh(this.box, this.basic(0xc3d7de), count),
      obj = new THREE.Object3D(),
      col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      obj.position.set((random() - 0.5) * 650, -60 - random() * 90, (random() - 0.5) * 650);
      const s = 0.045 + random() * 0.14;
      obj.scale.set(s, s, s);
      obj.updateMatrix();
      stars.setMatrixAt(i, obj.matrix);
      stars.setColorAt(i, col.setRGB(0.35 + random() * 0.5, 0.5 + random() * 0.4, 0.65 + random() * 0.35));
    }
    stars.instanceMatrix.needsUpdate = true;
    stars.frustumCulled = false;
    this.scene.add(stars);
    this.stars = stars;
    for (const [x, z, c, scale] of [
      [80, -110, 0x326275, 350],
      [-120, 40, 0x655280, 280],
    ]) {
      const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, color: c });
      m.opacityNode = uv().sub(0.5).length().mul(2).oneMinus().max(0).pow(3).mul(0.22);
      const fog = this.mesh(new THREE.PlaneGeometry(scale, scale), m, this.scene, x, -80, z);
      fog.rotation.x = -Math.PI / 2;
      fog.castShadow = false;
      fog.receiveShadow = false;
      this.owned.push(fog.geometry, m);
    }
  }
  /** Shots are two instanced batches; hit sparks and blast rings come from a fixed pool with their own fading materials. */
  buildPools() {
    const shotMesh = (c) => {
      const m = new THREE.InstancedMesh(this.box, this.mat(c, 4), SHOT_CAP);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = false;
      m.count = 0;
      this.scene.add(m);
      return m;
    };
    this.shotsFriendly = shotMesh(COLORS.cyan);
    this.shotsHostile = shotMesh(COLORS.orange);
    this.fxPool = { burst: [], spark: [] };
    for (const type of ['burst', 'spark'])
      for (let i = 0; i < FX_POOL; i++) {
        const mat = new THREE.MeshBasicNodeMaterial({ color: COLORS.amber, transparent: true, opacity: 1, depthWrite: false });
        const m = new THREE.Mesh(type === 'spark' ? this.smallSphere : this.torus, mat);
        m.rotation.x = -Math.PI / 2;
        m.visible = false;
        m.frustumCulled = false;
        this.scene.add(m);
        this.fxPool[type].push(m);
        this.owned.push(mat);
      }
  }
  /** Compile every pipeline the game can show (shots, effects, hostile colours) before the first frame. */
  async warm() {
    const pools = [...this.fxPool.burst, ...this.fxPool.spark];
    for (const m of pools) m.visible = true;
    this.shotsFriendly.count = this.shotsHostile.count = 1;
    this._m.makeTranslation(this.cameraTarget.x, 0, this.cameraTarget.z);
    this.shotsFriendly.setMatrixAt(0, this._m);
    this.shotsHostile.setMatrixAt(0, this._m);
    const samples = [this.ship('sparrow', 'hostile'), this.ship('bastion', 'hostile', true)];
    for (const s of samples) {
      s.position.copy(this.cameraTarget);
      this.scene.add(s);
    }
    this.camera.position.copy(this.cameraTarget).add(this._offset);
    this.camera.lookAt(this.cameraTarget);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
      // One real frame through the post chain builds the exact pipelines (render-target format and samples) behind the loading card.
      this.post.render();
    } catch (err) {
      console.warn('Pipeline pre-compile skipped:', err?.message || err);
    }
    for (const s of samples) {
      this.scene.remove(s);
      this.freeInstances(s);
    }
    for (const m of pools) m.visible = false;
    this.shotsFriendly.count = this.shotsHostile.count = 0;
  }
  planet(parent, x, y, z, radius, base, seed, ring = false) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    const geo = new THREE.IcosahedronGeometry(radius, 2);
    this.owned.push(geo);
    this.mesh(geo, this.mat(base, 0, 0.05), group);
    const random = rng(seed),
      count = 65,
      obj = new THREE.Object3D(),
      stud = new THREE.Object3D(),
      up = new THREE.Vector3(0, 1, 0),
      n = new THREE.Vector3(),
      p = new THREE.Vector3(),
      col = new THREE.Color();
    const tiles = new THREE.InstancedMesh(this.box, this.mat(0xa1bda6, 0, 0.06), count);
    tiles.castShadow = true;
    tiles.receiveShadow = true;
    const studs = new THREE.InstancedMesh(this.cylinder, this.mat(0xa1bda6, 0, 0.06), count * 2);
    studs.castShadow = true;
    studs.receiveShadow = true;
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2,
        v = random() * 1.65 - 0.825;
      n.set(Math.cos(a) * Math.sqrt(1 - v * v), v, Math.sin(a) * Math.sqrt(1 - v * v));
      obj.position.copy(n).multiplyScalar(radius + 0.13);
      obj.quaternion.setFromUnitVectors(up, n);
      obj.scale.set(2.8, 0.7, 2);
      obj.updateMatrix();
      tiles.setMatrixAt(i, obj.matrix);
      col.set(i % 9 === 0 ? 0xd6dfd1 : i % 4 === 0 ? 0x65897b : 0x8fab91);
      tiles.setColorAt(i, col);
      for (let j = 0; j < 2; j++) {
        p.set(j ? -0.58 : 0.58, 0.52, 0).applyQuaternion(obj.quaternion).addScaledVector(n, radius + 0.13);
        stud.position.copy(p);
        stud.quaternion.copy(obj.quaternion);
        stud.scale.set(1.6, 1.6, 1.6);
        stud.updateMatrix();
        studs.setMatrixAt(i * 2 + j, stud.matrix);
        studs.setColorAt(i * 2 + j, col);
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    studs.instanceMatrix.needsUpdate = true;
    group.add(tiles, studs);
    if (ring) {
      const rg = new THREE.RingGeometry(radius * 1.4, radius * 1.78, 64);
      this.owned.push(rg);
      const mat = new THREE.MeshStandardNodeMaterial({
        color: 0xa99785,
        roughness: 0.85,
        metalness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      this.owned.push(mat);
      const mesh = this.mesh(rg, mat, group);
      mesh.rotation.x = -Math.PI / 2 + 0.16;
    }
    return group;
  }
  orbit(parent, x, z, r, c, opacity = 0.3) {
    const m = this.mesh(this.torus, this.basic(c, opacity), parent, x, -3, z, r, r, r);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }
  freeInstances(root) {
    root.traverse((m) => {
      if (m.isInstancedMesh) m.dispose();
    });
  }
  buildSystem(sy) {
    this.freeInstances(this.world);
    this.world.clear();
    this.clearActors();
    // Generated geometries are bounded to one system. Shared geometry/materials live for the renderer's lifetime.
    for (const g of this.systemOwned || []) g.dispose?.();
    this.systemOwned = [];
    const before = this.owned.length;
    this.mainPlanet = this.planet(this.world, 43, -9, -42, 18, sy.color, sy.id);
    this.smallPlanet = this.planet(this.world, -64, -18, 38, 9, 0x897b74, sy.id + 'moon', true);
    this.orbit(this.world, 43, -42, 28, 0x4a8999, 0.22);
    this.orbit(this.world, 43, -42, 45, 0x325369, 0.13);
    const station = new THREE.Group();
    station.position.set(PORT.x, 0.15, PORT.z);
    this.world.add(station);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        part = new THREE.Group();
      part.position.set(Math.sin(a) * 5.3, 0, Math.cos(a) * 5.3);
      part.rotation.y = a;
      station.add(part);
      this.block(part, 0, 0, 0, 1.95, 0.65, 1.4, COLORS.metal);
      this.block(part, 0, 0.48, 0, 1.4, 0.35, 1.2, i % 3 === 0 ? COLORS.teal : COLORS.cream, i % 3 === 0);
      this.mesh(this.box, this.mat(COLORS.amber, 1.5), part, 0, 0.13, -0.76, 0.65, 0.1, 0.1);
    }
    for (const side of [-1, 1]) {
      this.block(station, side * 7.5, -0.45, 0, 5, 0.6, 0.65, COLORS.dark);
      this.block(station, side * 10, 0.2, 0, 1.2, 1.6, 3, COLORS.teal, true);
    }
    this.block(station, 0, -0.7, 7, 2.5, 0.45, 5, COLORS.metal);
    this.mesh(this.box, this.mat(COLORS.cyan, 2), station, 0, -0.4, 8, 1.7, 0.05, 2);
    this.orbit(this.world, PORT.x, PORT.z, 9, 0x98cabe, 0.38);
    const beacon = new THREE.Group();
    beacon.position.set(SCAN.x, 0.2, SCAN.z);
    this.world.add(beacon);
    this.block(beacon, 0, 0, 0, 1.2, 1, 1.2, COLORS.metal, true);
    this.mesh(this.box, this.mat(COLORS.amber, 2), beacon, 0, 1, 0, 0.3, 1.2, 0.3);
    this.beaconRing = this.orbit(this.world, SCAN.x, SCAN.z, 4, 0xbba781, 0.27);
    this.compactGroup(station);
    this.compactGroup(beacon);
    this.systemOwned = this.owned.splice(before);
    this.station = station;
  }
  clearActors() {
    this.freeInstances(this.actors);
    this.actors.clear();
    this.meshes.clear();
    this.debrisPool.length = 0;
    this.shotsFriendly && (this.shotsFriendly.count = 0);
    this.shotsHostile && (this.shotsHostile.count = 0);
  }
  actorMesh(e) {
    let m;
    if (e.type === 'player' || e.type === 'ship') m = this.ship(e.ship, e.team, !!e.boss);
    else if (e.type === 'asteroid') {
      m = new THREE.Group();
      this.mesh(this.smallSphere, this.mat(e.ore === 'gems' ? 0x7c8789 : 0x827e78, 0, 0.1), m, 0, 0, 0, e.radius, e.radius * 0.8, e.radius);
      this.block(
        m,
        e.radius * 0.3,
        e.radius * 0.4,
        0,
        e.radius * 0.8,
        e.radius * 0.6,
        e.radius * 0.6,
        e.ore === 'gems' ? 0x88adba : 0xa79980,
        true,
      );
      this.compactGroup(m);
    } else if (e.type === 'pickup') {
      m = new THREE.Group();
      this.mesh(this.smallSphere, this.mat(e.ore === 'gems' ? COLORS.cyan : COLORS.amber, 1), m, 0, 0.4, 0, 0.6, 0.7, 0.6);
      this.orbit(m, 0, 0, 1.3, COLORS.amber, 0.45);
    } else {
      // Debris chips are pooled: a burst reuses meshes instead of creating new ones.
      m = this.debrisPool.pop();
      if (!m) {
        m = new THREE.Mesh(this.box, this.mat(COLORS.metal));
        m.scale.set(0.5, 0.4, 0.5);
        m.castShadow = true;
        m.userData.debris = true;
        this.actors.add(m);
      }
      m.material = this.mat(e.color === 'cyan' ? COLORS.teal : COLORS.metal);
      m.visible = true;
      this.meshes.set(e.id, m);
      return m;
    }
    this.actors.add(m);
    this.meshes.set(e.id, m);
    return m;
  }
  retire(id, m) {
    this.meshes.delete(id);
    if (m.userData.debris) {
      m.visible = false;
      this.debrisPool.push(m);
      return;
    }
    this.freeInstances(m);
    this.actors.remove(m);
  }
  updateCamera() {
    // Portrait screens see a little more of the lane instead of a sliver of it.
    const w = this.width,
      h = this.height,
      half = (46 * this.zoom) / clamp(w / h / 0.8, 0.7, 1);
    this.camera.left = (-half * w) / h;
    this.camera.right = (half * w) / h;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  setZoom(delta) {
    this.zoom = clamp(this.zoom + delta, 0.6, 1.55);
    this.updateCamera();
  }
  /** Step through three zoom levels (a controller button). */
  cycleZoom() {
    this.zoom = this.zoom < 0.9 ? 1 : this.zoom < 1.2 ? 1.4 : 0.7;
    this.updateCamera();
  }
  /** A short camera kick when the ship is hit. */
  kick(amount) {
    this.shake = Math.min(1, this.shake + amount);
  }
  project(x, z, y = 1, out = {}) {
    this._v.set(x, y, z).project(this.camera);
    out.x = (this._v.x * 0.5 + 0.5) * this.width;
    out.y = (-0.5 * this._v.y + 0.5) * this.height;
    out.visible = this._v.z < 1 && Math.abs(this._v.x) < 1.08 && Math.abs(this._v.y) < 1.08;
    return out;
  }
  /** The point on the flight plane under a screen position (CSS pixels). The returned object is reused. */
  unproject(x, y) {
    this._ndc.set((x / this.width) * 2 - 1, (-y / this.height) * 2 + 1);
    this._ray.setFromCamera(this._ndc, this.camera);
    if (this._ray.ray.intersectPlane(this._plane, this._hit)) {
      this._aim.x = this._hit.x;
      this._aim.z = this._hit.z;
    }
    return this._aim;
  }
  render(snapshot, dt = 1 / 60, alpha = 1) {
    this.frame++;
    const frame = this.frame,
      p = snapshot.player,
      follow = 1 - Math.exp(-dt * 3.4);
    if (this.title) this._wanted.set(-13, 0, -13);
    else {
      // Lead the camera a little in the direction of travel so there is more to see ahead.
      const dx = p.x - this._last.x,
        dz = p.z - this._last.z;
      if (dt > 0 && Math.hypot(dx, dz) < 12) {
        const k = Math.min(1, dt * 3);
        this._vel.x += (dx / dt - this._vel.x) * k;
        this._vel.z += (dz / dt - this._vel.z) * k;
      } else this._vel.x = this._vel.z = 0;
      let lx = this._vel.x * 0.22,
        lz = this._vel.z * 0.22;
      const ll = Math.hypot(lx, lz);
      if (ll > 8) {
        lx *= 8 / ll;
        lz *= 8 / ll;
      }
      this._wanted.set(p.x + lx, 0, p.z - 5 + lz);
    }
    this._last.x = p.x;
    this._last.z = p.z;
    if (this.snap && !this.title) {
      this.cameraTarget.copy(this._wanted);
      this._vel.x = this._vel.z = 0;
    } else this.cameraTarget.lerp(this._wanted, follow);
    this.snap = false;
    this.camera.position.copy(this.cameraTarget).add(this._offset);
    if (this.shake > 0.001) {
      const s = this.shake * 0.7;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake *= Math.exp(-dt * 9);
    }
    this.camera.lookAt(this.cameraTarget);
    const time = snapshot.time;
    for (const e of snapshot.entities) {
      const m = this.meshes.get(e.id) || this.actorMesh(e);
      m.userData.seen = frame;
      m.position.set(e.rx, e.type === 'debris' ? 0.25 : 0, e.rz);
      // The simulation's heading turns clockwise on screen; three.js turns counter-clockwise about +Y.
      m.rotation.y = -e.ra;
      if (e.type === 'pickup') {
        m.position.y = 0.6 + Math.sin(time * 2 + e.rx) * 0.3;
        m.rotation.y = time * 0.6;
      }
      if (e.disabled) m.rotation.z = 0.12;
      const engines = m.userData.engines;
      if (engines) {
        const on = !e.disabled && (e.thrust > 0.01 || (this.title && e.id === 'player')),
          len = (e.thrust || 0.5) * (0.9 + Math.sin(time * 22) * 0.1);
        for (const c of engines) {
          c.visible = on;
          c.scale.z = len;
        }
      }
    }
    for (const [id, m] of this.meshes) if (m.userData.seen !== frame) this.retire(id, m);
    // Shots: two instanced batches, interpolated between physics steps.
    let nf = 0,
      nh = 0;
    for (const s of snapshot.shots) {
      const hostile = s.team === 'hostile',
        i = hostile ? nh : nf;
      if (i >= SHOT_CAP) continue;
      this._v.set(s.px + (s.x - s.px) * alpha, 0.15, s.pz + (s.z - s.pz) * alpha);
      this._q.setFromAxisAngle(Y_AXIS, -s.angle);
      this._s.set(s.missile ? 0.38 : 0.16, 0.16, s.missile ? 1.4 : 1.2);
      this._m.compose(this._v, this._q, this._s);
      (hostile ? this.shotsHostile : this.shotsFriendly).setMatrixAt(i, this._m);
      if (hostile) nh++;
      else nf++;
    }
    this.shotsFriendly.count = nf;
    this.shotsHostile.count = nh;
    if (nf) this.shotsFriendly.instanceMatrix.needsUpdate = true;
    if (nh) this.shotsHostile.instanceMatrix.needsUpdate = true;
    // Effects: expanding rings and sparks from the pool.
    let nb = 0,
      ns = 0;
    for (const e of snapshot.effects) {
      const spark = e.type === 'spark',
        list = spark ? this.fxPool.spark : this.fxPool.burst,
        i = spark ? ns++ : nb++;
      if (i >= list.length) continue;
      const m = list[i],
        t = e.age / e.life;
      m.visible = true;
      m.material.color.setHex(e.color === 'cyan' ? COLORS.cyan : COLORS.amber);
      m.material.opacity = (1 - t) * 0.8;
      m.position.set(e.x, 0.4, e.z);
      m.scale.setScalar(spark ? 0.2 + t * 0.8 : 0.8 + t * 5);
    }
    for (let i = nb; i < this.fxPool.burst.length; i++) this.fxPool.burst[i].visible = false;
    for (let i = ns; i < this.fxPool.spark.length; i++) this.fxPool.spark[i].visible = false;
    // The beacon ring brightens and pulses while the ship is close enough to scan it.
    if (this.beaconRing) this.beaconRing.material.opacity = this.scanHighlight ? 0.5 + Math.sin(time * 6) * 0.18 : 0.27;
    if (this.mainPlanet && this.title) this.mainPlanet.rotation.y += dt * 0.009;
    this.post.render();
  }
  dispose() {
    this.clearActors();
    this.freeInstances(this.world);
    this.stars?.dispose();
    this.shotsFriendly?.dispose();
    this.shotsHostile?.dispose();
    for (const g of this.systemOwned || []) g.dispose?.();
    for (const x of this.owned) x.dispose?.();
    this.box.dispose();
    this.cylinder.dispose();
    this.wedge.dispose();
    this.smallSphere.dispose();
    this.torus.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.environment?.dispose();
    this.post?.dispose();
  }
}
