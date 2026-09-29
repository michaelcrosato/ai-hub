import * as THREE from 'three/webgpu';
import {
  color,
  mix,
  positionWorld,
  positionLocal,
  vec3,
  time,
  sin,
  normalLocal,
} from 'three/tsl';
import { createPost } from 'kit/post.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random, hash, clamp } from './util.js';
export { THREE };
const C = {
  sand: 0x9f916e,
  rock: 0x59615b,
  wood: 0x70533b,
  trim: 0x533b2e,
  plaster: 0xb69a71,
  roof: 0x64766b,
  gold: 0xd5ab64,
  teal: 0x436f69,
  leaf: 0x667e61,
  red: 0x934c39,
  snow: 0xc8d5cd,
};
export function biomeFor(area) {
  const n = area.name.toLowerCase(),
    r = area.region;
  if (n.includes('prison ship')) return 'ship';
  if (r === 'wlk031') return /cavern|barrow|tomb|glacier|lair|castle/.test(n) ? 'ice' : 'snow';
  if (/clockwork|bamz|arkng|dwemer|norenen|kagrenac/.test(n)) return 'dwemer';
  if (/dagoth ur|citadels|kogoruhn|ilunibi|sixth house/.test(n)) return 'volcanic';
  if (/cavern|tomb|cave|sewer|addamas|mine|burial|grotto|satur|ulumm|nissin|missam|ahnabi|aharnabi|pudai/.test(n))
    return 'dungeon';
  if (r === 'wlk030' || r === 'wlk007' || n.includes('ministry')) return 'temple';
  if (['wlk021', 'wlk022', 'wlk023', 'wlk024', 'wlk025', 'wlk028'].includes(r)) return 'telvanni';
  if (['wlk011', 'wlk012', 'wlk013', 'wlk016', 'wlk017', 'wlk027', 'wlk029'].includes(r)) return 'ash';
  return 'coast';
}
/** Static pieces are batched into a single vertex-coloured PBR mesh per cell. */
class Bricks {
  constructor(material) {
    this.geometries = [];
    this.colliders = [];
    this.material = material;
    this.root = new THREE.Group();
  }
  put(geo, x, y, z, sx, sy, sz, col, angle = 0) {
    if (geo.index) geo = geo.toNonIndexed();
    const mat = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle),
      new THREE.Vector3(sx, sy, sz),
    );
    geo.applyMatrix4(mat);
    const c = new THREE.Color(col);
    const ar = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < ar.length; i += 3) {
      ar[i] = c.r;
      ar[i + 1] = c.g;
      ar[i + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(ar, 3));
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    this.geometries.push(geo);
  }
  box(x, y, z, w, h, d, col, collision = false, angle = 0) {
    this.put(new THREE.BoxGeometry(1, 1, 1), x, y, z, w, h, d, col, angle);
    if (collision) this.colliders.push({ x, y, z, w, h, d, angle });
  }
  cylinder(x, y, z, r, h, col, segments = 8, top = 1) {
    this.put(new THREE.CylinderGeometry(r * top, r, h, segments), x, y, z, 1, 1, 1, col);
  }
  sphere(x, y, z, r, col, sx = 1, sy = 1, sz = 1) {
    this.put(new THREE.IcosahedronGeometry(r, 0), x, y, z, sx, sy, sz, col);
  }
  studs(x, y, z, w, d, col) {
    for (let xx = -w / 2 + 0.5; xx < w / 2; xx += 1)
      for (let zz = -d / 2 + 0.5; zz < d / 2; zz += 1) this.cylinder(x + xx, y + 0.065, z + zz, 0.17, 0.13, col, 8);
  }
  finish() {
    if (this.geometries.length) {
      const geo = mergeGeometries(this.geometries);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.root.add(mesh);
      for (const g of this.geometries) g.dispose();
      this.geometries = [];
    }
    return this.root;
  }
}
/** The game's two presets, read from the kit's quality tier (low/medium → Balanced, high/ultra → High). */
export const presetFor = (tier) => (tier.name === 'high' || tier.name === 'ultra' ? 'High' : 'Balanced');
export class View {
  constructor(kit) {
    this.kit = kit;
    this.scene = new THREE.Scene();
    this.camera = kit.fitCamera(new THREE.PerspectiveCamera(70, 1, 0.08, 260));
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.clock = 0;
    this.dynamic = [];
    this.actors = [];
    this.ray = new THREE.Raycaster();
    this.shake = 0;
    this.swing = 0;
    this.mode = 'title';
    this.preset = 'Balanced';
    this.root = null;
    this.water = null;
    this.particlePool = [];
    this.geometryCount = 0;
    // Scratch vectors for aim(), which runs every frame.
    this.aimDir = new THREE.Vector3();
    this.aimPos = new THREE.Vector3();
  }
  init() {
    const kit = this.kit;
    this.renderer = kit.renderer;
    this.backend = kit.backendLabel;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.material = new THREE.MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: true,
    });
    this.actorMaterial = new THREE.MeshStandardNodeMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.08,
      flatShading: true,
    });
    // Shared by every spark, debris brick and lamp, so hits and kills never build new materials mid-fight.
    this.particleGeometry = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    this.debrisGeometry = new THREE.BoxGeometry(0.26, 0.26, 0.26);
    this.debrisMaterials = [0xb89960, 0x8c7654].map((c) => new THREE.MeshStandardNodeMaterial({ color: c, roughness: 0.8 }));
    this.basicMaterials = new Map();
    // A small linear HDR environment, generated rather than downloaded. Half floats are
    // filterable on every WebGPU device (32-bit float filtering is an optional feature).
    const w = 128,
      h = 64,
      data = new Uint16Array(w * h * 4);
    const half = THREE.DataUtils.toHalfFloat;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = y / h,
          hot = Math.exp(-((x / w - 0.23) ** 2 + (t - 0.3) ** 2) / 0.002) * 8;
        const k = (y * w + x) * 4;
        data[k] = half(0.16 + (1 - t) * 0.7 + hot);
        data[k + 1] = half(0.22 + (1 - t) * 0.82 + hot * 0.82);
        data[k + 2] = half(0.24 + (1 - t) * 0.9 + hot * 0.54);
        data[k + 3] = half(1);
      }
    this.env = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
    this.env.mapping = THREE.EquirectangularReflectionMapping;
    this.env.magFilter = this.env.minFilter = THREE.LinearFilter;
    this.env.needsUpdate = true;
    this.scene.environment = this.env;
    this.scene.environmentIntensity = 0.55;
    this.sun = new THREE.DirectionalLight(0xffdcaa, 3.1);
    this.sun.position.set(-25, 40, 20);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -42;
    this.sun.shadow.camera.right = 42;
    this.sun.shadow.camera.top = 42;
    this.sun.shadow.camera.bottom = -42;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 110;
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.HemisphereLight(0xc6e2d8, 0x615439, 1.7);
    this.scene.add(this.fill);
    const skyMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false });
    skyMat.colorNode = mix(color(0xc1c3a6), color(0x416c72), normalLocal.y.mul(0.5).add(0.5));
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 12), skyMat);
    this.sky.renderOrder = -100;
    this.scene.add(this.sky);
    this.waterMaterial = new THREE.MeshStandardNodeMaterial({
      roughness: 0.32,
      metalness: 0.28,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });
    const wave = sin(positionWorld.x.mul(0.6).add(time.mul(0.5))).mul(sin(positionWorld.z.mul(0.35).sub(time.mul(0.3))));
    this.waterMaterial.colorNode = mix(color(0x2c6767), color(0x609a87), wave.mul(0.18).add(0.3));
    this.waterMaterial.positionNode = positionLocal.add(vec3(0, wave.mul(0.07), 0));
    // The kit's post chain: the game's soft node bloom on every tier (smaller on phones),
    // MSAA on high and ultra, FXAA on medium.
    this.post = createPost(kit, this.scene, this.camera, { bloom: { strength: 0.13, radius: 0.35, threshold: 1.3 } });
    this.applyTier(kit.tier);
    kit.onQuality((tier) => this.applyTier(tier));
  }
  /**
   * Shadow size and softness follow the kit's quality tier; resolution and anti-aliasing are the kit's.
   * r186 resizes the shadow map from mapSize on the next frame (never dispose shadow.map to do it).
   */
  applyTier(tier) {
    this.preset = presetFor(tier);
    this.sun.shadow.mapSize.setScalar(this.kit.shadowSize(2048));
    this.sun.shadow.radius = this.preset === 'High' ? 3 : 2;
  }
  /** One unlit material per colour, shared (sparks, the Heart's glow, lamps). */
  basic(col, boost = 1) {
    const key = col + ':' + boost;
    let mat = this.basicMaterials.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicNodeMaterial({ color: col });
      if (boost !== 1) mat.colorNode = color(col).mul(boost);
      this.basicMaterials.set(key, mat);
    }
    return mat;
  }
  clear() {
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => {
        if (!o.userData.shared) o.geometry?.dispose();
        if (o.userData.ownedMaterial) o.material?.dispose();
      });
    }
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.water = null;
    this.actors = [];
    this.dynamic = [];
    this.particlePool = [];
    this.colliders = [];
    if (this.held) {
      this.held.traverse((o) => o.geometry?.dispose());
      this.held.removeFromParent();
    }
    this.held = null;
  }
  loadArea(area) {
    this.clear();
    this.area = area;
    this.biome = biomeFor(area);
    const rng = random(area.id);
    const b = new Bricks(this.material);
    const indoor = ['dungeon', 'ice', 'dwemer', 'volcanic', 'ship'].includes(this.biome);
    this.indoor = indoor;
    this.sky.visible = !indoor || area.name.includes('Ship-Deck');
    this.scene.background = new THREE.Color(indoor ? (this.biome === 'volcanic' ? 0x342623 : 0x252c2d) : 0x93a89b);
    this.scene.fog = new THREE.Fog(this.scene.background, indoor ? 45 : 65, indoor ? 95 : 190);
    this.sun.intensity = indoor ? 1.1 : 3.1;
    this.fill.intensity = indoor ? 2.2 : 1.7;
    this.scene.environmentIntensity = indoor ? 0.8 : 0.55;
    const ground =
      this.biome === 'snow' || this.biome === 'ice'
        ? C.snow
        : this.biome === 'ash' || this.biome === 'volcanic'
          ? 0x756d61
          : indoor
            ? 0x75644e
            : 0x839176;
    if (this.biome === 'coast') {
      b.box(4.5, -0.35, 0, 61, 0.7, 70, ground, true);
      b.box(-30.5, -3.35, 0, 9, 0.7, 70, ground, true);
    } else b.box(0, -0.35, 0, 70, 0.7, 70, ground, true);
    for (const [x, z, w, d] of [
      [-35, 0, 1, 72],
      [35, 0, 1, 72],
      [0, -35, 72, 1],
      [0, 35, 72, 1],
    ])
      this.colliders.push({ x, y: 1, z, w, h: 16, d });
    if (this.biome === 'ship') this.buildShip(b);
    else if (indoor) this.buildDungeon(b, rng);
    else this.buildExterior(b, rng);
    this.root.add(b.finish());
    this.staticMesh = b.root.children[0];
    this.colliders.push(...b.colliders);
    this.geometryCount = this.staticMesh?.geometry.attributes.position.count || 0;
    this.spawn = { x: 0, y: 1.05, z: this.biome === 'ship' ? 7 : 19 };
    this.goal = { x: 0, y: 0, z: this.biome === 'ship' ? -2 : -19 };
    if (!indoor) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(170, 170, 20, 20).rotateX(-Math.PI / 2), this.waterMaterial);
      water.position.set(-111, -0.13, 0);
      water.receiveShadow = true;
      this.root.add(water);
      this.water = water;
    }
    return this.colliders;
  }
  buildShip(b) {
    b.box(0, 0.08, 0, 11, 0.2, 22, C.wood, true);
    for (let z = -10; z <= 10; z += 1) b.box(0, 0.21, z, 10.8, 0.03, 0.92, z % 2 ? 0x806044 : 0x896a4c);
    b.box(-5.5, 2, 0, 0.5, 4, 22, C.trim, true);
    b.box(5.5, 2, 0, 0.5, 4, 22, C.trim, true);
    b.box(0, 2, 10.8, 11, 4, 0.5, C.trim, true);
    if (!this.area.name.includes('Deck')) b.box(0, 3.8, 0, 12, 0.4, 22, C.wood);
    for (let z = -8; z < 10; z += 4) {
      if (!this.area.name.includes('Deck')) b.box(0, 3.3, z, 11, 0.5, 0.4, C.trim);
      this.crate(b, -4, 0, z);
    }
    for (let z = -8; z < 2; z += 3) this.crate(b, 4, 0, z);
    for (let i = 0; i < 6; i++) b.box(0, 0.25 + i * 0.24, -8 - i * 0.38, 2, 0.28, 0.55, 0x9a7a55, true);
  }
  buildDungeon(b, rng) {
    const ice = this.biome === 'ice',
      metal = this.biome === 'dwemer',
      lava = this.biome === 'volcanic';
    const wall = ice ? 0x8ca9ae : metal ? 0x74614c : lava ? 0x51413a : 0x66685d;
    for (const x of [-25, 25]) b.box(x, 4, -3, 2, 8, 57, wall, true);
    b.box(0, 4, -31, 52, 8, 2, wall, true);
    b.box(0, 4, 26, 52, 8, 2, wall, true);
    for (let z = -26; z <= 22; z += 6) {
      for (const x of [-24, 24]) {
        b.box(x, 3, z, 3, 6, 2.3, metal ? C.gold : wall, true);
        b.studs(x, 6, z, 3, 2.3, metal ? C.gold : wall);
      }
      for (const x of [-17, 17]) this.rock(b, x, 1, z, 3, wall);
    }
    // Interconnected side chambers, with a legible central route rather than a dead-end maze.
    for (const z of [-13, 3, 15]) {
      b.box(-16, 2.2, z, 13, 4.4, 1, wall, true);
      b.box(16, 2.2, z, 13, 4.4, 1, wall, true);
      b.box(0, 5.6, z, 20, 1, 1.2, wall);
      b.box(-9, 2.8, z, 1.2, 5.6, 1.2, wall, true);
      b.box(9, 2.8, z, 1.2, 5.6, 1.2, wall, true);
    }
    for (let z = 20; z > -30; z -= 3) {
      b.box(0, 0.04, z, 10, 0.09, 2.9, metal ? 0x8a7860 : ice ? 0xafc3c4 : 0x81715d);
      if (metal) {
        b.box(-4.3, 0.12, z, 0.15, 0.1, 2.8, C.gold);
        b.box(4.3, 0.12, z, 0.15, 0.1, 2.8, C.gold);
      }
    }
    for (const z of [-22, -8, 9, 21])
      for (const x of [-7.5, 7.5]) {
        b.box(x, 1.5, z, 0.3, 3, 0.3, C.trim);
        b.cylinder(x, 3, z, 0.38, 0.2, C.gold);
        this.glow(x, 3.3, z, ice ? 0x8ed8dd : 0xf5b057, 0.17);
      }
    for (let i = 0; i < 8; i++) this.crate(b, (i % 2 ? 1 : -1) * (13 + rng() * 8), 0, 18 - i * 5);
    if (metal) {
      for (let i = 0; i < 5; i++) {
        b.cylinder(18, 1 + i * 0.24, -24, 3.3 - i * 0.4, 0.3, i % 2 ? C.gold : wall, 12);
      }
      b.cylinder(-19, 4, -25, 1, 8, C.gold, 10);
    }
    if (lava) {
      const mat = new THREE.MeshBasicNodeMaterial({ color: 0xe97430 });
      mat.colorNode = color(0xff7426).mul(1.7);
      const pool = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 8), mat);
      pool.position.set(-17, 0.12, -23);
      pool.userData.ownedMaterial = true;
      this.root.add(pool);
    }
  }
  buildExterior(b, rng) {
    const snow = this.biome === 'snow',
      ash = this.biome === 'ash',
      tel = this.biome === 'telvanni',
      temple = this.biome === 'temple';
    // Flat toy paving keeps collision predictable, while studded edges make the construction visible.
    for (let z = -31; z < 34; z += 2) b.box(0, 0.04, z, 6, 0.1, 1.93, snow ? 0xa3b6af : ash ? 0xa5987b : 0xbdab84);
    for (let i = 0; i < 16; i++) {
      const x = i % 2 ? 11 + rng() * 17 : -11 - rng() * 17;
      const z = -30 + rng() * 57;
      if (tel || (!snow && i % 3)) this.mushroom(b, x, 0, z, 2 + rng() * 4);
      else if (snow) this.pine(b, x, 0, z, 4 + rng() * 4);
      else this.rock(b, x, 0.5, z, 2 + rng() * 2, ash ? 0x655e54 : 0x738272);
    }
    if (temple) {
      this.canton(b, -15, 0, -7, 12);
      this.canton(b, 16, 0, -18, 11);
      this.canton(b, 15, 0, 10, 9);
    } else if (tel) {
      this.mushroom(b, -15, 0, -9, 12, true);
      this.mushroom(b, 16, 0, -19, 9, true);
      this.house(b, 14, 0, 9, 6, 5, C.plaster, C.roof);
    } else {
      for (const [x, z, w, d] of [
        [-13, -13, 8, 7],
        [13, -15, 8, 8],
        [15, 5, 7, 6],
        [-13, 12, 7, 7],
      ])
        this.house(b, x, 0, z, w, d, snow ? 0x8e7660 : ash ? 0x9c8566 : C.plaster, snow ? C.snow : C.roof);
    }
    // A Seyda Neen-like lighthouse and wharf, visible from the title camera.
    if (this.area.region === 'wlk002' || this.area.region === 'wlk001') {
      for (let i = 0; i < 6; i++) b.cylinder(-25, 1 + i * 1.4, -11, 2.5 - i * 0.11, 1.4, i % 2 ? 0xb7a47e : 0xc7b58e, 10);
      b.cylinder(-25, 9.2, -11, 2, 1.4, 0x70634b, 10);
      b.cylinder(-25, 10.4, -11, 3, 1, C.roof, 10, 0);
      this.glow(-25, 9.25, -9.5, 0xffcf76, 0.55);
      for (let x = -34; x < -7; x += 2) b.box(x, 0.25, 22, 1.94, 0.5, 4.5, C.wood, true);
      for (let x = -32; x < -8; x += 5) {
        b.box(x, 0.4, 19.7, 0.25, 2.5, 0.25, C.trim);
        b.box(x, 0.4, 24.4, 0.25, 2.5, 0.25, C.trim);
      }
      this.siltStrider(b, 22, 0, -29);
    }
    if (this.area.region === 'wlk017') {
      for (let x = -30; x <= 30; x += 6) {
        b.box(x, 5, -26, 1, 10, 1, C.plaster, true);
        b.sphere(x, 10.5, -26, 0.7, C.gold);
      }
      const fence = new THREE.Mesh(
        new THREE.PlaneGeometry(64, 8),
        new THREE.MeshBasicNodeMaterial({ color: 0x9edce0, transparent: true, opacity: 0.19, side: THREE.DoubleSide }),
      );
      fence.position.set(0, 5, -26);
      fence.userData.ownedMaterial = true;
      this.root.add(fence);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 58 + rng() * 15;
      const x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      this.rock(b, x, 1, z, 8 + rng() * 8, snow ? 0xa6bcb5 : ash ? 0x736b60 : 0x627b70);
    }
    // Red Mountain silhouette: terraced, faceted, untextured.
    b.put(new THREE.ConeGeometry(28, 35, 9), 7, 12, -110, 1, 1, 1, 0x63756e);
    b.put(new THREE.ConeGeometry(9, 13, 7), 7, 30, -110, 1, 1, 1, 0x857967);
    b.cylinder(7, 36, -110, 2, 0.3, 0xb7633c, 8);
    for (const z of [-7, 8, 21])
      for (const x of [-4, 4]) {
        b.box(x, 1.4, z, 0.14, 2.8, 0.14, C.trim);
        b.box(x, 2.9, z, 0.45, 0.55, 0.45, C.gold);
        this.glow(x, 2.9, z, 0xffce82, 0.19);
      }
    if (!snow) {
      for (let i = 0; i < 3; i++) this.netch(b, -32 + i * 20, 12 + i * 3, -47 - i * 11, 3);
    }
  }
  house(b, x, y, z, w, d, col, roof) {
    b.box(x, y + 2.1, z, w, 4.2, d, col, true);
    b.box(x, y + 0.15, z, w + 0.5, 0.3, d + 0.5, 0x817154);
    for (let i = 0; i < 4; i++) b.box(x, y + 4.3 + i * 0.36, z, w + 1 - i * 0.55, 0.38, d + 1 - i * 0.42, roof);
    b.studs(x, y + 5.75, z, w - 1.3, d - 0.7, roof);
    b.box(x, y + 1.15, z + d / 2 + 0.03, 1.5, 2.3, 0.16, C.trim);
    b.box(x, y + 2.48, z + d / 2 + 0.1, 1.9, 0.24, 0.28, C.gold);
    for (const xx of [-w * 0.28, w * 0.28]) {
      b.box(x + xx, y + 2.1, z + d / 2 + 0.02, 1, 1.3, 0.15, 0x4c6560);
      b.box(x + xx, y + 2.1, z + d / 2 + 0.13, 0.09, 1.35, 0.12, C.gold);
      b.box(x + xx, y + 2.1, z + d / 2 + 0.13, 1.05, 0.09, 0.12, C.gold);
    }
    b.box(x + w * 0.23, y + 5, z - d * 0.2, 0.8, 2.4, 0.8, col);
  }
  canton(b, x, y, z, w) {
    for (let i = 0; i < 5; i++) {
      b.box(x, y + 0.65 + i * 1.2, z, w - i * 1.1, 1.2, w - i * 1.1, 0xb7a275, true);
      b.box(x, y + 0.2 + i * 1.2, z, w + 0.3 - i * 1.1, 0.2, w + 0.3 - i * 1.1, C.gold);
    }
    b.box(x, y + 7, z, 3, 2.5, 3, 0xc7b588);
    b.cylinder(x, y + 8.5, z, 2.5, 1, C.teal, 8, 0);
  }
  mushroom(b, x, y, z, h, house = false) {
    b.cylinder(x, y + h * 0.45, z, h * 0.13, h * 0.9, 0xb5a478, 7, 0.55);
    b.sphere(x, y + h, z, h * 0.47, house ? 0x93744d : 0x9f9069, 1, 0.42, 1);
    b.cylinder(x, y + h * 0.88, z, h * 0.48, 0.35, house ? 0xc1a273 : 0xb5a273, 8, 0.85);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      b.sphere(x + Math.cos(a) * h * 0.2, y + h * 1.09, z + Math.sin(a) * h * 0.2, h * 0.055, 0xd6c295, 1, 0.35, 1);
    }
    if (house) {
      b.box(x, y + 1, z + h * 0.14, 1.2, 2, 0.15, C.trim);
      b.box(x, y + h * 0.78, z + h * 0.35, 1, 0.9, 0.2, C.gold);
    }
  }
  rock(b, x, y, z, r, col) {
    b.sphere(x, y + r * 0.4, z, r, col, 1, 0.9, 1);
    b.sphere(x + r * 0.3, y + r * 0.75, z - r * 0.2, r * 0.63, col);
  }
  pine(b, x, y, z, h) {
    b.box(x, y + h * 0.33, z, 0.6, h * 0.65, 0.6, C.trim);
    for (let i = 0; i < 3; i++)
      b.put(
        new THREE.ConeGeometry(h * (0.35 - i * 0.06), h * 0.5, 6),
        x,
        y + h * (0.48 + i * 0.21),
        z,
        1,
        1,
        1,
        i % 2 ? 0x69867e : 0x55736a,
      );
    b.put(new THREE.ConeGeometry(h * 0.22, h * 0.48, 6), x, y + h * 0.94, z, 1, 1, 1, C.snow);
  }
  crate(b, x, y, z) {
    b.box(x, y + 0.55, z, 1.15, 1.1, 1.15, C.wood, true);
    for (const yy of [0.12, 0.97]) b.box(x, y + yy, z, 1.23, 0.12, 1.23, C.gold);
    b.studs(x, y + 1.1, z, 1.15, 1.15, C.wood);
  }
  siltStrider(b, x, y, z) {
    b.sphere(x, y + 8, z, 3.5, 0x7d6850, 1, 1, 0.75);
    b.sphere(x, y + 9.4, z + 1.5, 1.5, 0x8f7655, 1, 0.5, 1);
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        b.box(x + side * (2 + i * 0.55), y + 3.9, z + (i - 1) * 2, 0.35, 8, 0.4, 0x6a5842);
        b.sphere(x + side * (2 + i * 0.55), y + 0.2, z + (i - 1) * 2, 0.4, 0x574b3b);
      }
    b.box(x, y + 10.6, z - 1, 2, 0.6, 2.2, C.trim);
    b.box(x, y + 10.9, z - 1, 1.6, 0.2, 1.8, C.gold);
  }
  netch(b, x, y, z, r) {
    b.sphere(x, y, z, r, 0x9c9274, 1, 0.63, 1);
    for (let i = 0; i < 5; i++) b.box(x + (i - 2) * 0.55, y - 2, z, 0.11, 3 + (i % 2), 0.11, 0xbcb397);
  }
  glow(x, y, z, col, r) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), this.basic(col, 2));
    m.position.set(x, y, z);
    this.root.add(m);
    return m;
  }
  addActor(def) {
    const group = new THREE.Group();
    group.position.set(def.x, def.y || 0, def.z);
    const rng = random(def.name);
    const b = new Bricks(this.actorMaterial);
    const enemy = def.type === 'enemy';
    const big = /Dagoth Ur|Imperfect|Karstaag|Hircine|Almalexia|Udyrfrykte/.test(def.name);
    const skin =
      def.type === 'ally'
        ? 0x8cb5ae
        : enemy
          ? /Ghost/.test(def.name)
            ? 0xa3cab3
            : 0x82766a
          : [0x869b98, 0xa1afa4, 0xafa07c, 0xc2ac86][hash(def.name) % 4];
    const cloth = enemy ? (big ? 0x7b4135 : 0x775749) : [0x626c50, 0x85573d, 0x596e72, 0x9e865d][hash(def.name) % 4];
    if (/rat|mudcrab|grahl|guar/i.test(def.name)) {
      b.box(0, 0.4, 0, 0.85, 0.65, 1.1, cloth);
      b.box(0, 0.7, 0.58, 0.55, 0.4, 0.5, skin);
      for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) b.box(x, 0.17, z, 0.22, 0.35, 0.24, skin);
      b.box(-0.16, 0.74, 0.85, 0.07, 0.07, 0.05, C.red);
      b.box(0.16, 0.74, 0.85, 0.07, 0.07, 0.05, C.red);
    } else {
      b.box(-0.19, 0.34, 0, 0.3, 0.68, 0.4, 0x51463b);
      b.box(0.19, 0.34, 0, 0.3, 0.68, 0.4, 0x51463b);
      b.box(0, 1.03, 0, 0.85, 0.8, 0.48, cloth);
      b.box(0, 0.79, 0, 0.9, 0.12, 0.55, C.gold);
      b.box(0, 1.7, 0, 0.57, 0.57, 0.56, skin);
      b.cylinder(0, 2.03, 0, 0.16, 0.11, skin, 8);
      b.box(-0.51, 1.04, 0, 0.26, 0.79, 0.3, cloth);
      b.box(0.51, 1.04, 0, 0.26, 0.79, 0.3, cloth);
      b.box(-0.51, 0.63, 0, 0.25, 0.25, 0.31, skin);
      b.box(0.51, 0.63, 0, 0.25, 0.25, 0.31, skin);
      for (const x of [-0.14, 0.14]) b.box(x, 1.75, 0.29, 0.075, 0.055, 0.03, enemy ? 0xeaa464 : 0xac4e3a);
      if (enemy) {
        b.box(0.59, 0.83, 0.24, 0.12, 1.4, 0.12, 0xbdbba0);
        b.box(0.59, 0.34, 0.24, 0.4, 0.1, 0.16, C.gold);
        if (big) {
          b.box(-0.42, 1.51, 0, 0.55, 0.24, 0.72, C.gold);
          b.box(0.42, 1.51, 0, 0.55, 0.24, 0.72, C.gold);
          b.box(0, 1.94, 0.18, 0.65, 0.32, 0.35, C.gold);
        }
      }
    }
    if (/Hircine/.test(def.name)) {
      for (const side of [-1, 1]) {
        b.box(side * 0.48, 2.3, 0, 0.13, 0.8, 0.15, C.gold);
        b.box(side * 0.67, 2.6, 0, 0.48, 0.12, 0.13, C.gold);
        b.box(side * 0.86, 2.84, 0, 0.12, 0.5, 0.14, C.gold);
        b.box(side * 0.56, 2.93, 0, 0.12, 0.45, 0.14, C.gold);
      }
    }
    if (/Karstaag/.test(def.name)) {
      b.box(0, 1.24, 0, 1.4, 1.3, 0.78, 0xc3d6cc);
      b.box(0, 1.97, 0, 0.7, 0.72, 0.7, 0xa0b5b0);
      for (const side of [-1, 1]) b.put(new THREE.ConeGeometry(0.18, 0.65, 5), side * 0.47, 2.35, 0, 1, 1, 1, 0xd5d6bb);
    }
    if (/Imperfect|Centurion/.test(def.name)) {
      b.box(0, 1.05, 0, 1.25, 1.15, 0.7, C.gold);
      b.cylinder(0, 1.82, 0, 0.37, 0.7, C.gold, 8);
      b.box(0, 1.89, 0.38, 0.32, 0.1, 0.09, 0xeda96b);
    }
    if (/Dagoth Ur/.test(def.name)) {
      b.box(0, 1.8, 0.29, 0.59, 0.65, 0.15, C.gold);
      b.box(0, 1.55, 0.39, 0.12, 0.46, 0.12, C.gold);
      for (const side of [-1, 1]) b.put(new THREE.ConeGeometry(0.13, 0.5, 4), side * 0.35, 2.15, 0, 1, 1, 1, C.gold);
    }
    group.add(b.finish());
    if (big) group.scale.setScalar(1.35);
    this.root.add(group);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(big ? 0.95 : 0.65, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicNodeMaterial({ color: 0x26372f, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    shadow.position.set(def.x, 0.02, def.z);
    shadow.userData.ownedMaterial = true;
    this.root.add(shadow);
    const actor = { ...def, mesh: group, shadow, baseY: def.y || 0, time: rng() * 10, big };
    this.actors.push(actor);
    return actor;
  }
  addObject(def) {
    let mesh;
    const col = def.type === 'loot' ? C.gold : def.type === 'exit' ? C.teal : def.type === 'heart' ? 0xc55533 : C.wood;
    if (def.type === 'heart') {
      mesh = this.glow(def.x, (def.y || 0) + 1.8, def.z, col, 1.2);
      mesh.scale.set(0.85, 1.2, 0.85);
    } else {
      const b = new Bricks(this.material);
      if (def.type === 'exit') {
        b.box(-1.2, 1.65, 0, 0.4, 3.3, 0.5, 0xad9c74);
        b.box(1.2, 1.65, 0, 0.4, 3.3, 0.5, 0xad9c74);
        b.box(0, 3.45, 0, 2.9, 0.4, 0.7, C.gold);
        b.box(0, 1.6, 0, 2.1, 3.2, 0.15, col);
        b.box(0, 1.7, 0.11, 0.15, 2.6, 0.1, C.gold);
      } else if (def.type === 'travel') {
        b.box(0, 1.3, 0, 0.2, 2.6, 0.2, C.trim);
        b.box(0, 2.6, 0, 2.7, 0.6, 0.18, C.wood);
        b.box(0, 1.9, 0, 2.1, 0.5, 0.18, C.wood);
      } else if (def.type === 'shrine') {
        b.box(0, 0.3, 0, 1.8, 0.6, 1.8, 0xb09c74);
        b.cylinder(0, 1.1, 0, 0.5, 1, C.gold);
        b.sphere(0, 2, 0, 0.45, 0xb7c8a0);
      } else {
        b.box(0, 0.38, 0, 1.1, 0.75, 0.8, col);
        b.box(0, 0.78, 0, 1.18, 0.12, 0.88, 0xc6b17c);
        b.box(0, 0.5, 0.43, 0.19, 0.3, 0.1, 0xf1d08a);
        b.studs(0, 0.86, 0, 1.1, 0.8, C.gold);
      }
      mesh = b.finish();
      mesh.position.set(def.x, def.y || 0, def.z);
      this.root.add(mesh);
    }
    const o = { ...def, mesh, baseY: mesh.position.y };
    this.dynamic.push(o);
    return o;
  }
  addPlatform(x, y, z) {
    const b = new Bricks(this.material);
    b.box(x, y - 0.2, z, 5, 0.4, 5, 0xa69a78, true);
    for (let i = 0; i < 10; i++) b.box(x + 3 + i * 0.42, y - i * 0.45 - 0.22, z, 0.55, 0.45, 2, C.sand, true);
    this.root.add(b.finish());
    this.colliders.push(...b.colliders);
    return b.colliders;
  }
  removeObject(obj) {
    obj.mesh?.removeFromParent();
    obj.shadow?.removeFromParent();
    if (obj.mesh)
      obj.mesh.traverse((o) => {
        o.geometry?.dispose();
        if (o.userData.ownedMaterial) o.material?.dispose();
      });
    if (obj.shadow) {
      obj.shadow.geometry.dispose();
      obj.shadow.material.dispose();
    }
    this.actors = this.actors.filter((a) => a !== obj);
    this.dynamic = this.dynamic.filter((a) => a !== obj);
  }
  buildWeapon(name, skill = 'Long Blade') {
    if (this.held) {
      this.held.traverse((o) => o.geometry?.dispose());
      this.held.removeFromParent();
    }
    const b = new Bricks(this.actorMaterial);
    const magic = /Sunder|Keening|Trueflame|Hopesfire|Bound/.test(name);
    const steel = magic ? 0x91c3ad : 0xb4c1b3;
    b.box(0, -0.28, 0, 0.2, 0.55, 0.2, C.wood);
    b.box(0, -0.05, 0, 0.6, 0.1, 0.25, C.gold);
    if (skill === 'Hand-to-Hand') {
      b.box(-0.35, -0.18, 0.1, 0.3, 0.36, 0.4, 0x819491);
      b.box(0.1, 0.06, -0.08, 0.34, 0.4, 0.42, 0x819491);
    } else if (skill === 'Blunt Weapon') {
      b.box(0, 0.48, 0, 0.15, 1, 0.15, C.wood);
      b.box(0, 0.95, 0, 0.7, 0.5, 0.45, C.gold);
    } else if (skill === 'Spear') {
      b.box(0, 0.1, 0, 0.1, 1.8, 0.1, C.wood);
      b.put(new THREE.ConeGeometry(0.16, 0.6, 4), 0, 1.3, 0, 1, 1, 1, steel);
    } else if (skill === 'Marksman') {
      b.box(-0.1, 0.4, 0, 0.11, 1.6, 0.12, C.wood);
      b.box(0.1, 0.4, 0, 0.018, 1.45, 0.018, C.gold);
      b.box(0, 0.4, -0.4, 0.05, 0.05, 1.1, steel);
    } else {
      b.box(0, 0.59, 0, skill === 'Short Blade' ? 0.19 : 0.24, skill === 'Short Blade' ? 0.7 : 1.3, 0.075, steel);
      b.put(new THREE.ConeGeometry(0.13, 0.35, 4), 0, skill === 'Short Blade' ? 1.1 : 1.4, 0, 1, 1, 0.35, steel);
    }
    b.box(0, -0.48, 0, 0.33, 0.36, 0.4, 0x819491);
    this.held = b.finish();
    this.held.position.set(0.48, -0.58, -0.72);
    this.held.rotation.z = -0.2;
    this.held.scale.setScalar(0.75);
    this.held.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.frustumCulled = false;
      }
    });
    this.camera.add(this.held);
  }
  particle(x, y, z, col = 0xe0be78, count = 9) {
    for (let i = 0; i < count; i++) {
      if (this.particlePool.length > 64) break;
      const mesh = new THREE.Mesh(this.particleGeometry, this.basic(col));
      mesh.position.set(x, y, z);
      mesh.userData.shared = true;
      this.root.add(mesh);
      this.particlePool.push({
        mesh,
        v: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5),
        life: 0.45 + Math.random() * 0.4,
      });
    }
  }
  animate(dt, player = null) {
    this.clock += dt;
    for (const a of this.actors) {
      a.time += dt;
      if (!a.dead) {
        a.mesh.rotation.z = Math.sin(a.time * 1.7) * 0.013;
        if (a.moving) a.mesh.position.y = a.baseY + Math.abs(Math.sin(a.time * 9)) * 0.065;
        a.shadow.position.x = a.mesh.position.x;
        a.shadow.position.z = a.mesh.position.z;
      }
    }
    for (const o of this.dynamic)
      if (o.type === 'heart') {
        o.mesh.rotation.y += dt * 0.4;
        o.mesh.scale.setScalar(1 + Math.sin(this.clock * 3) * 0.06);
      }
    for (let i = this.particlePool.length - 1; i >= 0; i--) {
      const p = this.particlePool[i];
      p.life -= dt;
      p.v.y -= dt * 8;
      p.mesh.position.addScaledVector(p.v, dt);
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        this.particlePool.splice(i, 1);
      }
    }
    this.swing = Math.max(0, this.swing - dt * 3.7);
    this.shake = Math.max(0, this.shake - dt * 4);
    if (this.mode === 'title') {
      this.camera.position.set(27 + Math.sin(this.clock * 0.025) * 3, 12, 31);
      this.camera.lookAt(-1, 3, -7);
      if (this.held) this.held.visible = false;
    } else if (player) {
      this.camera.position.copy(player);
      this.camera.position.y += (player.eye || 0.62) + Math.sin(this.clock * 9) * (player.moving ? 0.025 : 0);
      this.camera.rotation.set(player.pitch || 0, player.yaw || 0, 0, 'YXZ');
      this.camera.rotation.z = Math.sin(this.clock * 47) * this.shake * 0.03;
      if (this.held) {
        this.held.visible = true;
        this.held.rotation.z = -0.2 - Math.sin(this.swing * Math.PI) * 1.5;
        this.held.rotation.x = Math.sin(this.swing * Math.PI) * -0.8;
        this.held.position.y = -0.58 + Math.sin(this.clock * 9) * (player.moving ? 0.02 : 0);
      }
    }
  }
  render() {
    this.post.render();
  }
  aim(objects, range = 4) {
    this.camera.updateMatrixWorld();
    const dir = this.camera.getWorldDirection(this.aimDir);
    let best = null,
      score = -1;
    for (const o of objects) {
      if (o.dead || !o.mesh.parent) continue;
      const pos = this.aimPos.copy(o.mesh.position);
      pos.y +=
        o.type === 'enemy' || o.type === 'npc'
          ? 1.2
          : o.type === 'travel'
            ? 2
            : o.type === 'exit'
              ? 1.7
              : o.type === 'heart'
                ? 0
                : 0.7;
      const delta = pos.sub(this.camera.position);
      const d = delta.length();
      if (d > range || d < 0.1) continue;
      const dot = delta.normalize().dot(dir);
      const tolerance = Math.max(0.86, 1 - 1.1 / (d * d));
      if (dot < tolerance) continue;
      // Static scene occlusion prevents using objects through walls.
      this.ray.set(this.camera.position, delta);
      this.ray.far = d - 0.3;
      const hits = this.staticMesh ? this.ray.intersectObject(this.staticMesh, false) : [];
      if (hits.length) continue;
      const rank = dot - d * 0.008;
      if (rank > score) {
        score = rank;
        best = o;
      }
    }
    return best;
  }
}
