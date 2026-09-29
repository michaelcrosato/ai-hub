import * as T from 'three/webgpu';
import { color, float, mix, positionLocal, time, uv } from 'three/tsl';
import { createPost } from 'kit/post.js';
import { PhysicsWorld } from './physics.js';
import { buildMap } from './maps.js';
import { CAMPAIGN } from './content.js';

/** Debris budget per quality tier. Shadow size, resolution and anti-aliasing come from the kit's tier. */
const DEBRIS = {
  high: { bodies: 72, steps: 4, solver: 4 },
  balanced: { bodies: 28, steps: 2, solver: 2 },
};
const colors = {
  C: 0xb4aa8c,
  G: 0x9f7763,
  K: 0x9b8162,
  D: 0x987553,
  H: 0x728b59,
  P: 0xada380,
  W: 0x42838e,
  Q: 0x6d8571,
  L: 0x939988,
  S: 0xc7ac75,
  B: 0xd6deda,
  A: 0xbc5941,
};
const HIGHLIGHT = { move: 0x51abc9, select: 0xf2d18a, area: 0xdb735b };
const ZOOM_MIN = 0.65,
  ZOOM_MAX = 1.75;
/** Orbit speed per look radian: the kit reports mouse, touch and stick turns at different rates. */
const LOOK_GAIN = { keyboard: 0.008 / 0.0024, touch: 0.008 / 0.0055, gamepad: 1 };

export class Stage {
  constructor(kit, db, onTile, onDiagnostics) {
    Object.assign(this, { kit, db, onTile, onDiagnostics });
    this.renderer = kit.renderer;
    this.materials = new Map();
    this.models = new Map();
    this.boxGeo = new T.BoxGeometry(1, 1, 1);
    this.studGeo = new T.CylinderGeometry(0.12, 0.12, 0.07, 10);
    this.geometries = new Map();
    this.shared = new Set([this.boxGeo, this.studGeo]);
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x182838);
    this.scene.fog = new T.FogExp2(0x182838, 0.013);
    this.camera = new T.OrthographicCamera(-12, 12, 9, -9, 0.1, 130);
    this.root = new T.Group();
    this.scene.add(this.root);
    this.angle = Math.PI / 4;
    this.viewAngle = this.angle;
    this.zoom = 1;
    this.frameTime = 0;
    this.samples = 0;
    this.flash = [];
    this.lastSeq = 0;
    this.floaters = [];
    this.press = null;
    this.cursor = null;
    this.frustumKey = '';
    this.camTarget = new T.Vector3();
    this.tmp = new T.Vector3();
    this.ray = new T.Raycaster();
    this.ndc = new T.Vector2();

    const r = this.renderer;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFShadowMap;
    this.physics = new PhysicsWorld(kit.RAPIER);
    this.scene.add(new T.HemisphereLight(0xc6dbe7, 0x72603e, 1.5));
    this.sun = new T.DirectionalLight(0xffe0aa, 3.4);
    this.sun.position.set(-10, 22, 9);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 80 });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun, this.sun.target);
    const rim = new T.DirectionalLight(0x8eacca, 1);
    rim.position.set(9, 12, -12);
    this.scene.add(rim);
    this.environment();
    this.sharedMaterials();
    this.buildCursor();
    // Bloom stays on at every tier (smaller on phones); MSAA or FXAA follows the tier.
    this.post = createPost(kit, this.scene, this.camera, { bloom: { strength: 0.15, radius: 0.25, threshold: 1.25 } });
    this.applyQuality(kit.tier);
    kit.onQuality((tier) => this.applyQuality(tier));
    kit.onResize(() => (this.frustumKey = ''));
  }
  environment() {
    const w = 128,
      h = 64,
      data = new Uint16Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const sky = Math.max(0, 1 - y / h),
          sun = Math.exp(-((x / w - 0.22) ** 2 + (y / h - 0.27) ** 2) * 1800) * 15,
          k = (y * w + x) * 4;
        data[k] = T.DataUtils.toHalfFloat(0.18 + sky * 0.55 + sun);
        data[k + 1] = T.DataUtils.toHalfFloat(0.24 + sky * 0.7 + sun * 0.82);
        data[k + 2] = T.DataUtils.toHalfFloat(0.32 + sky * 0.85 + sun * 0.6);
        data[k + 3] = T.DataUtils.toHalfFloat(1);
      }
    const tex = new T.DataTexture(data, w, h, T.RGBAFormat, T.HalfFloatType);
    tex.mapping = T.EquirectangularReflectionMapping;
    tex.needsUpdate = true;
    this.scene.environment = tex;
    this.scene.environmentIntensity = 0.5;
  }
  /** Materials and geometry every battle reuses, built once instead of per unit, tile or hit. */
  sharedMaterials() {
    this.water = new T.MeshStandardNodeMaterial({ roughness: 0.25, metalness: 0.25 });
    this.water.colorNode = mix(
      color(0x376d80),
      color(0x70a8a6),
      positionLocal.x.add(positionLocal.z).mul(3).add(time.mul(0.8)).sin().mul(0.12).add(0.5),
    );
    this.contact = new T.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, color: 0x10202a });
    this.contact.opacityNode = float(0.35).mul(float(1).sub(uv().sub(0.5).length().mul(2)).max(0).pow(1.5));
    this.hpMats = [new T.MeshBasicNodeMaterial({ color: 0x8ad4c1 }), new T.MeshBasicNodeMaterial({ color: 0xdc977f })];
    this.highlightMats = {};
    for (const [mode, c] of Object.entries(HIGHLIGHT))
      this.highlightMats[mode] = new T.MeshBasicNodeMaterial({ color: c, transparent: true, opacity: 0.35, depthWrite: false, side: T.DoubleSide });
    this.highlightGeo = this.geo('highlight', () => new T.PlaneGeometry(0.93, 0.93));
    this.debrisGeo = this.geo('debris', () => new T.BoxGeometry(0.16, 0.16, 0.16));
    this.spellGeo = this.geo('spell', () => new T.TorusGeometry(0.3, 0.035, 4, 30));
  }
  /** A tile cursor for keyboard and controller play: a gold frame with a bobbing marker above it. */
  buildCursor() {
    this.cursorMat = new T.MeshBasicNodeMaterial({ color: 0xffdc8c, transparent: true, opacity: 0.95, depthWrite: false, side: T.DoubleSide });
    const markerMat = new T.MeshBasicNodeMaterial({ color: 0xffdc8c, depthTest: false, depthWrite: false, transparent: true });
    const frame = new T.Mesh(new T.RingGeometry(0.5, 0.72, 4, 1), this.cursorMat);
    frame.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
    // The marker floats above figures and is drawn over them, so the cursor never hides behind a unit.
    const marker = new T.Mesh(new T.ConeGeometry(0.24, 0.48, 4), markerMat);
    marker.rotation.x = Math.PI;
    marker.renderOrder = 10;
    this.cursorMesh = new T.Group();
    this.cursorMesh.add(frame, marker);
    this.cursorMesh.userData.marker = marker;
    this.cursorMesh.visible = false;
    this.scene.add(this.cursorMesh);
  }
  geo(key, make) {
    let g = this.geometries.get(key);
    if (!g) {
      g = make();
      this.geometries.set(key, g);
      this.shared.add(g);
    }
    return g;
  }
  mat(c, metal = 0.05) {
    const key = c + '-' + metal;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardNodeMaterial({ color: c, metalness: metal, roughness: metal > 0.3 ? 0.38 : 0.68, flatShading: true }),
      );
    return this.materials.get(key);
  }
  block(parent, x, y, z, w, h, d, c, metal = 0.05) {
    const m = new T.Mesh(this.boxGeo, this.mat(c, metal));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  shape(parent, g, c, x, y, z) {
    const m = new T.Mesh(g, this.mat(c));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  clear() {
    this.physics.clear();
    this.root.traverse((o) => {
      if (o.geometry && !this.shared.has(o.geometry)) o.geometry.dispose();
      if (o.userData.ownMat) o.material?.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    this.root.clear();
    this.models.clear();
    this.flash = [];
    this.lastSeq = 0;
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.cursor = null;
  }
  setBattle(b) {
    this.battle = b;
    this.title = false;
    this.build(b.grid);
    this.sync(b);
  }
  showTitle() {
    this.title = true;
    this.battle = null;
    const grid = buildMap(this.db, { id: 'title', theme: 'monastery', name: 'Orbonne' });
    this.build(grid);
    for (const [name, job, x, z, team] of [
      ['Ramza', 'Squire', 6, 8, 0],
      ['Agrias', 'Holy Knight', 4, 6, 0],
      ['Gafgarion', 'Dark Knight', 8, 7, 0],
      ['Wizard', 'Wizard', 7, 9, 0],
      ['Knight', 'Knight', 6, 3, 1],
      ['Guard', 'Archer', 9, 4, 1],
      ['Boco', 'Chocobo', 3, 8, 0],
    ]) {
      const u = {
        id: name,
        name,
        job,
        x,
        z,
        h: grid.tiles.find((t) => t.x === x && t.z === z)?.h || 0,
        team,
        hp: 100,
        maxHp: 100,
        facing: team ? 2 : 0,
        status: {},
      };
      this.addUnit(u);
    }
  }
  showWorld(state) {
    this.title = false;
    this.battle = null;
    const g = { name: 'Ivalice campaign road', theme: 'grass', width: 18, height: 13, tiles: [], switches: [] };
    for (let z = 0; z < g.height; z++) for (let x = 0; x < g.width; x++) g.tiles.push({ x, z, h: 0, t: 'H', blocked: false });
    this.build(g);
    const points = CAMPAIGN.map((e, i) => ({
      x: 1 + (Math.floor(i / 9) % 2 ? 8 - (i % 9) : i % 9) * 1.85,
      z: 1 + Math.floor(i / 9) * 2,
      h: 0,
      encounterId: i <= state.progress ? e.id : null,
    }));
    const d = new T.Object3D();
    const marker = this.geo('road-marker', () => new T.CylinderGeometry(0.28, 0.3, 0.18, 8));
    for (const [list, c] of [
      [points.filter((p, i) => i < state.progress), 0x77a8a6],
      [points.filter((p, i) => i === state.progress), 0xdcae63],
      [points.filter((p, i) => i > state.progress), 0x7b8577],
    ]) {
      if (!list.length) continue;
      const mesh = new T.InstancedMesh(marker, this.mat(c, 0.2), list.length);
      list.forEach((p, i) => {
        d.position.set(p.x, 0.23, p.z);
        d.scale.setScalar(1);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      });
      mesh.userData.tiles = list;
      this.ground.add(mesh);
      this.tiles.unshift(mesh);
    }
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        v = new T.Vector3(b.x - a.x, 0, b.z - a.z),
        road = this.block(
          this.ground,
          (a.x + b.x) / 2,
          0.12,
          (a.z + b.z) / 2,
          0.08,
          0.04,
          v.length(),
          i <= state.progress ? 0xc1b68c : 0x7f9275,
        );
      road.rotation.y = Math.atan2(v.x, v.z);
    }
    const spire = this.geo('spire', () => new T.ConeGeometry(0.36, 0.45, 4));
    for (const [x, z] of [
      [3, -1],
      [14, 13],
    ]) {
      this.block(this.ground, x, 0.6, z, 1.4, 1.2, 1, 0xa9aa98);
      for (const ox of [-0.7, 0.7]) {
        this.block(this.ground, x + ox, 0.8, z, 0.45, 1.7, 0.5, 0x929f9c);
        this.shape(this.ground, spire, 0x506b7a, x + ox, 1.85, z);
      }
    }
  }
  build(grid) {
    this.clear();
    this.grid = grid;
    this.tileIndex = new Map(grid.tiles.map((t) => [t.x + ',' + t.z, t]));
    this.center = new T.Vector3((grid.width - 1) / 2, 1, (grid.height - 1) / 2);
    this.sun.target.position.copy(this.center);
    this.ground = new T.Group();
    this.figures = new T.Group();
    this.effects = new T.Group();
    this.highlights = new T.Group();
    this.root.add(this.ground, this.figures, this.effects, this.highlights);
    this.tiles = [];
    this.physics.setGround(grid);
    this.block(
      this.ground,
      (grid.width - 1) / 2,
      -0.9,
      (grid.height - 1) / 2,
      grid.width + 0.45,
      0.5,
      grid.height + 0.45,
      0x2b3940,
    );
    this.block(
      this.ground,
      (grid.width - 1) / 2,
      -0.64,
      (grid.height - 1) / 2,
      grid.width + 0.2,
      0.06,
      grid.height + 0.2,
      0xa88952,
      0.35,
    );
    // Instance columns and studs. This reduces draw calls on both backends.
    const groups = new Map();
    for (const t of grid.tiles) {
      if (t.blocked) continue;
      const c = colors[t.t] || colors.P;
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c).push(t);
    }
    const d = new T.Object3D();
    for (const [c, tiles] of groups) {
      const material = c === colors.W ? this.water : this.mat(c);
      const inst = new T.InstancedMesh(this.boxGeo, material, tiles.length),
        stud = new T.InstancedMesh(this.studGeo, this.mat(c), tiles.length * 4);
      inst.castShadow = true;
      inst.receiveShadow = true;
      stud.receiveShadow = true;
      tiles.forEach((t, i) => {
        const height = t.h * 0.34 + 0.65;
        d.position.set(t.x, height / 2 - 0.65, t.z);
        d.scale.set(0.98, height, 0.98);
        d.updateMatrix();
        inst.setMatrixAt(i, d.matrix);
        for (let a = 0; a < 4; a++) {
          d.position.set(t.x + (a % 2 ? 0.24 : -0.24), t.h * 0.34 + 0.035, t.z + (a < 2 ? -0.24 : 0.24));
          d.scale.setScalar(1);
          d.updateMatrix();
          stud.setMatrixAt(i * 4 + a, d.matrix);
        }
      });
      inst.userData.tiles = tiles;
      this.tiles.push(inst);
      this.ground.add(inst, stud);
    }
    this.decor(grid);
    this.frustumKey = '';
  }
  decor(g) {
    const h = (x, z) => this.tileIndex.get(x + ',' + z)?.h * 0.34 || 0;
    const end = g.height - 1;
    // Scenic pieces remain outside walkable squares so they do not hide collision rules.
    if (['monastery', 'cathedral', 'crypt', 'ruin', 'library'].includes(g.theme)) {
      const z = -0.7;
      for (const x of [1, 3.4, g.width - 4.4, g.width - 2]) {
        let base = h(Math.round(x), 0);
        this.block(this.ground, x, base + 1.15, z, 0.65, 2.3, 0.8, 0xa9aa99);
        this.block(this.ground, x, base + 2.4, z, 0.88, 0.22, 1, 0xc9bfa1);
        this.block(this.ground, x, base + 2.8, z, 0.48, 0.6, 0.5, 0x879294);
      }
      this.block(this.ground, g.width / 2 - 0.5, 1.25, z, g.width - 2, 1.9, 0.36, 0x999f94);
      this.block(this.ground, g.width / 2 - 0.5, 2.32, z, g.width - 2, 0.23, 0.7, 0xc4bba0);
      for (const x of [2, g.width - 3]) {
        this.block(this.ground, x, 2, -0.94, 0.5, 1.3, 0.08, 0x536f7f);
        this.block(this.ground, x, 2, -1, 0.06, 0.9, 0.04, 0xd5b678);
      }
    }
    if (['forest', 'grass', 'windmill', 'highland'].includes(g.theme))
      for (let i = 0; i < 5; i++) {
        const x = i % 2 ? -1 : g.width,
          z = 1 + i * 2;
        this.block(this.ground, x, 0.5, z, 0.25, 1.3, 0.25, 0x6c5742);
        for (let k = 0; k < 3; k++)
          this.shape(
            this.ground,
            this.geo('tree' + k, () => new T.ConeGeometry(0.9 - k * 0.18, 1.3, 5)),
            0x52694b,
            x,
            1.2 + k * 0.48,
            z,
          );
      }
    for (const [x, z] of [
      [-1, end * 0.7],
      [g.width, end * 0.3],
    ]) {
      this.block(this.ground, x, 1, z, 0.09, 3, 0.09, 0x7a684e, 0.5);
      this.block(this.ground, x + 0.32, 1.95, z, 0.6, 0.8, 0.08, 0x506d84);
      this.block(this.ground, x + 0.32, 1.95, z - 0.05, 0.1, 0.45, 0.025, 0xd5bd7e);
    }
    if (g.theme === 'airship')
      for (const x of [-0.7, g.width - 0.2]) {
        this.block(this.ground, x, 0.7, g.height / 2, 0.4, 3, g.height - 2, 0x665846);
        this.block(this.ground, x, 1, g.height / 2, 0.1, 5, 0.1, 0x998566, 0.4);
      }
    for (const s of g.switches || []) {
      this.block(this.ground, s.x, h(s.x, s.z) + 0.07, s.z, 0.75, 0.1, 0.75, 0x9a7548);
    }
  }
  addUnit(u) {
    const outer = new T.Group(),
      body = new T.Group();
    outer.add(body);
    this.figures.add(outer);
    const ally = u.team === 0,
      cloth = ally ? (u.name === 'Ramza' ? 0x48778e : 0x577a94) : 0x9b5550,
      metal = 0xb3bcc0,
      dark = 0x263640,
      skin = 0xd6b486;
    const monster =
      u.monster ||
      /Chocobo|Goblin|Dragon|Bomb|Demon|Behemoth|Hydra|Hyudra|Lucavi|Plague|Uribo|Skeleton|Revnant|Ghoul|Ochu|Tiamat/.test(u.job);
    if (monster) {
      const choco = /Chocobo/.test(u.job),
        bomb = /Bomb|Grenade|Explosive/.test(u.job),
        c = choco
          ? u.job.includes('Red')
            ? 0xae5742
            : u.job.includes('Black')
              ? 0x505874
              : 0xd7b056
          : bomb
            ? 0xa24c36
            : /Dragon|Hydra/.test(u.job)
              ? 0x6e8e89
              : 0x807e95;
      this.block(body, 0, 0.5, 0, 0.62, 0.58, 0.65, c);
      this.block(body, 0, 0.95, -0.22, 0.48, 0.5, 0.45, c);
      for (const x of [-0.24, 0.24]) {
        this.block(body, x, 0.12, 0, 0.2, 0.28, 0.28, 0xa48757);
        this.block(body, x * 0.75, 1.03, -0.457, 0.07, 0.07, 0.028, 0xe9c767);
      }
      if (choco) {
        this.block(body, 0, 0.94, -0.57, 0.3, 0.19, 0.4, 0xc48b48);
        this.block(body, 0, 1.25, -0.1, 0.15, 0.24, 0.28, c);
        for (const x of [-0.42, 0.42]) {
          const wing = this.block(body, x, 0.64, 0.15, 0.25, 0.2, 0.65, c);
          wing.rotation.z = x;
        }
      } else {
        const horn = this.geo('horn', () => new T.ConeGeometry(0.13, 0.42, 4));
        for (const x of [-0.2, 0.2]) this.shape(body, horn, 0xc3bd9a, x, 1.38, -0.2);
        if (!bomb) this.block(body, 0, 0.5, 0.52, 0.22, 0.25, 0.55, c);
      }
      if (u.boss) outer.scale.setScalar(1.45);
    } else {
      this.block(body, -0.16, 0.16, 0, 0.22, 0.3, 0.28, dark);
      this.block(body, 0.16, 0.16, 0, 0.22, 0.3, 0.28, dark);
      this.block(body, 0, 0.63, 0, 0.52, 0.64, 0.33, cloth);
      this.block(body, 0, 0.61, 0.21, 0.59, 0.67, 0.07, cloth);
      this.block(body, 0, 1.12, 0, 0.4, 0.4, 0.36, skin);
      this.block(body, 0, 1.31, 0.02, 0.43, 0.12, 0.39, u.name === 'Ramza' ? 0xbca66c : 0x715b43);
      for (const x of [-0.095, 0.095]) this.block(body, x, 1.12, -0.187, 0.045, 0.05, 0.025, dark);
      this.block(body, 0, 0.62, -0.18, 0.09, 0.5, 0.045, 0xd6bd7b);
      this.block(body, 0, 0.38, 0, 0.56, 0.11, 0.38, 0x6b5c48);
      for (const x of [-0.38, 0.38]) {
        this.block(body, x, 0.68, 0, 0.2, 0.43, 0.24, cloth);
        this.block(body, x, 0.44, -0.02, 0.18, 0.18, 0.19, skin);
      }
      if (/Wizard|Time Mage|Oracle|Summoner/.test(u.job)) {
        this.shape(body, this.geo('hat', () => new T.ConeGeometry(0.42, 0.6, 4)), u.job === 'Wizard' ? 0x616879 : cloth, 0, 1.63, 0);
        this.block(body, 0, 1.35, 0, 0.7, 0.07, 0.65, 0xb7a575);
        this.block(body, 0.45, 0.78, -0.14, 0.07, 1.1, 0.07, 0x776045);
        this.shape(body, this.geo('orb', () => new T.OctahedronGeometry(0.18)), 0x68acb6, 0.45, 1.4, -0.14);
      } else if (/Priest|Chemist|Cleric/.test(u.job)) {
        this.block(body, 0, 1.34, 0, 0.47, 0.13, 0.42, 0xe7dccc);
        this.block(body, -0.35, 0.53, -0.24, 0.23, 0.32, 0.21, 0x7bb3ad);
      } else {
        const sword = this.block(body, 0.45, 0.57, -0.28, 0.1, 0.85, 0.1, metal, 0.7);
        sword.rotation.x = -0.4;
        this.block(body, 0.45, 0.22, -0.14, 0.3, 0.08, 0.13, 0xd6bd7b, 0.4);
        if (!/Ninja|Monk|Thief/.test(u.job)) {
          this.block(body, -0.44, 0.65, -0.16, 0.13, 0.63, 0.43, cloth);
          this.block(body, -0.52, 0.65, -0.16, 0.025, 0.5, 0.035, 0xd6bd7b, 0.4);
          this.block(body, 0, 1.36, 0, 0.5, 0.15, 0.44, metal, 0.5);
        }
      }
    }
    const shadow = new T.Mesh(this.geo('contact', () => new T.PlaneGeometry(1.3, 1.3)), this.contact);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    outer.add(shadow);
    const ring = this.shape(outer, this.geo('ring', () => new T.TorusGeometry(0.42, 0.018, 4, 20)), ally ? 0x6ac1cc : 0xd98c79, 0, 0.07, 0);
    ring.rotation.x = Math.PI / 2;
    const hp = this.block(outer, 0, 1.66, 0, 0.65, 0.045, 0.035, ally ? 0x8ad4c1 : 0xdc977f);
    hp.material = this.hpMats[ally ? 0 : 1];
    outer.position.set(u.x, u.h * 0.34, u.z);
    outer.userData = { unit: u, body, hp, ring, target: outer.position.clone() };
    body.rotation.y = (-u.facing * Math.PI) / 2;
    this.models.set(u.id, outer);
    return outer;
  }
  sync(b) {
    this.battle = b;
    for (const u of b.units) {
      let m = this.models.get(u.id);
      if (u.removed) {
        if (m) m.visible = false;
        continue;
      }
      m ??= this.addUnit(u);
      m.visible = true;
      m.userData.unit = u;
      m.userData.target.set(u.x, u.h * 0.34 + (u.airborne ? 2 : 0), u.z);
      m.userData.body.rotation.z = u.hp <= 0 ? -Math.PI / 2 : 0;
      m.userData.hp.scale.x = Math.max(0.01, u.hp / u.maxHp) * 0.65;
      m.userData.ring.scale.setScalar(b.activeId === u.id ? 1.25 : 1);
    }
    for (const event of b.events || [])
      if (event.seq > this.lastSeq) {
        this.lastSeq = event.seq;
        this.event(event);
      }
  }
  event(e) {
    const m = this.models.get(e.id);
    if (m && ['hit', 'heal', 'miss', 'status', 'reward'].includes(e.type)) {
      const el = document.createElement('div');
      el.className = 'damage-number ' + (e.type === 'heal' ? 'positive' : '');
      el.textContent = e.amount !== undefined ? (e.type === 'heal' ? '+' : '−') + e.amount : e.text || '';
      document.body.append(el);
      this.floaters.push({ el, pos: m.position.clone().setY(m.position.y + 1.7), t: 0 });
    }
    if (e.type === 'damage' || e.type === 'heal' || e.type === 'hit') {
      if (m) {
        const c = e.type === 'heal' ? 0x7fc7b0 : 0xd7bd82;
        for (let i = 0; i < 6; i++) {
          const mesh = new T.Mesh(this.debrisGeo, this.mat(c, 0.3));
          this.effects.add(mesh);
          this.physics.add(
            mesh,
            { x: m.position.x, y: m.position.y + 1, z: m.position.z },
            { x: (Math.random() - 0.5) * 3, y: 2 + Math.random() * 2, z: (Math.random() - 0.5) * 3 },
          );
        }
        if (e.type !== 'heal' && m.userData.unit?.team === 0) this.kit.input.rumble(0.35, 110);
      }
    }
    if (e.center && e.type === 'spell') {
      const material = new T.MeshBasicNodeMaterial({
        color: e.element === 'Fire' ? 0xe49657 : e.element === 'Ice' ? 0x9be0df : 0xe8cb81,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      });
      const ring = new T.Mesh(this.spellGeo, material);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(e.center.x, e.center.h * 0.34 + 0.17, e.center.z);
      ring.userData.ownMat = true;
      this.effects.add(ring);
      this.flash.push({ mesh: ring, t: 0, r: Math.min(3, (e.area || 0) + 0.7) });
    }
  }
  highlight(tiles, mode = 'move') {
    this.highlights.clear();
    const material = this.highlightMats[mode] || this.highlightMats.area;
    for (const t of tiles || []) {
      const m = new T.Mesh(this.highlightGeo, material);
      m.rotation.x = -Math.PI / 2;
      m.position.set(t.x, t.h * 0.34 + 0.085, t.z);
      this.highlights.add(m);
    }
  }
  /** Show the tile cursor at {x, z}, or hide it with null. */
  setCursor(tile) {
    this.cursor = tile ? { x: tile.x, z: tile.z } : null;
  }
  tileAt(x, z) {
    return this.tileIndex?.get(x + ',' + z) || null;
  }
  /** The grid step for a direction on screen (x right, y up), following the camera's rotation. */
  gridStep(x, y) {
    const a = this.viewAngle;
    // Camera forward on the ground is (-sin a, -cos a); screen right is (cos a, -sin a).
    const wx = -Math.sin(a) * y + Math.cos(a) * x,
      wz = -Math.cos(a) * y - Math.sin(a) * x;
    // Snap to the nearest grid axis; the small bias breaks the 45° tie the same way every time.
    const q = Math.round((Math.atan2(wz, wx) + 0.02) / (Math.PI / 2));
    const dirs = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    return dirs[((q % 4) + 4) % 4];
  }
  applyQuality(tier) {
    this.tierName = tier.name;
    this.physics.configure(tier.name === 'high' || tier.name === 'ultra' ? DEBRIS.high : DEBRIS.balanced);
    // r186 resizes the shadow map from mapSize on the next frame; never dispose shadow.map here.
    this.sun.shadow.mapSize.setScalar(this.kit.shadowSize(2048));
  }
  updateFrustum() {
    const { width: w, height: h } = this.kit.size;
    const key = w + 'x' + h + ':' + this.zoom + ':' + (this.grid?.width || 12) + 'x' + (this.grid?.height || 12);
    if (key === this.frustumKey) return;
    this.frustumKey = key;
    const base = Math.max(this.grid?.width || 12, this.grid?.height || 12) * 0.7;
    const vertical = (w < 760 ? Math.max(base * 0.84, (base / (w / h)) * 1.03) : base * 0.84) / this.zoom;
    this.camera.left = (-vertical * w) / h;
    this.camera.right = (vertical * w) / h;
    this.camera.top = vertical;
    this.camera.bottom = -vertical;
    this.camera.updateProjectionMatrix();
  }
  rotate(steps) {
    this.angle += (steps * Math.PI) / 2;
  }
  zoomBy(factor) {
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom * factor));
  }
  zoomStep(delta) {
    this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + delta));
  }
  /**
   * Pointer, drag, wheel and pinch through kit.input: a tap picks a tile, a
   * horizontal drag (or the right stick) turns the camera, wheel and pinch zoom.
   */
  handleInput(input, allowTap) {
    const p = input.pointer;
    if (p.justDown) this.press = { x: p.x, y: p.y, moved: false };
    const zoom = input.zoom();
    if (zoom) {
      this.zoomBy(Math.exp(zoom * (input.source === 'touch' ? 0.25 : 0.1)));
      if (this.press) this.press.moved = true;
    }
    if (this.press && !this.press.moved && Math.abs(p.x - this.press.x) > 10) this.press.moved = true;
    const look = input.look('look');
    if (look.x && (input.source === 'gamepad' || this.press?.moved)) {
      const turn = look.x * (LOOK_GAIN[input.source] || 1);
      this.angle -= turn;
      this.viewAngle -= turn;
    }
    if (p.justUp && this.press) {
      const tap = !this.press.moved && Math.hypot(p.x - this.press.x, p.y - this.press.y) < 12;
      this.press = null;
      if (tap && allowTap) this.pick(p.nx, p.ny);
    }
  }
  pick(nx, ny) {
    this.ndc.set(nx, ny);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.tiles, false)[0];
    if (hit) this.onTile(hit.object.userData.tiles[hit.instanceId]);
  }
  update(dt, t) {
    const ms = dt * 1000;
    this.frameTime = this.frameTime ? this.frameTime * 0.97 + ms * 0.03 : ms;
    this.samples++;
    this.physics.update(dt);
    // Quarter turns ease into place; drags and the stick turn directly.
    this.viewAngle += (this.angle - this.viewAngle) * (1 - Math.exp(-dt * 12));
    for (const m of this.models.values()) {
      const d = m.userData;
      m.position.lerp(d.target, 1 - Math.exp(-dt * 10));
      const target = (-d.unit.facing * Math.PI) / 2;
      d.body.rotation.y +=
        Math.atan2(Math.sin(target - d.body.rotation.y), Math.cos(target - d.body.rotation.y)) * Math.min(1, dt * 10);
      if (d.unit.hp > 0) d.body.position.y = Math.sin(t * 2 + m.position.x) * 0.012;
      d.hp.quaternion.copy(this.camera.quaternion);
    }
    for (let i = this.flash.length - 1; i >= 0; i--) {
      const f = this.flash[i];
      f.t += dt;
      f.mesh.scale.setScalar(1 + f.t * 4 * f.r);
      f.mesh.material.opacity = Math.max(0, 0.6 - f.t);
      if (f.t > 0.6) {
        f.mesh.removeFromParent();
        f.mesh.material.dispose();
        this.flash.splice(i, 1);
      }
    }
    const tile = this.cursor && this.tileAt(this.cursor.x, this.cursor.z);
    this.cursorMesh.visible = !!tile;
    if (tile) {
      this.cursorMesh.position.set(tile.x, tile.h * 0.34 + 0.1, tile.z);
      this.cursorMesh.userData.marker.position.y = 2.2 + Math.sin(t * 5) * 0.12;
      this.cursorMat.opacity = 0.75 + Math.sin(t * 6) * 0.2;
    }
    const { width, height } = this.kit.size;
    if (this.center) {
      const c = this.camTarget.copy(this.center);
      if (this.title && width > 760) c.x -= 3.5;
      this.camera.position.set(c.x + Math.sin(this.viewAngle) * 23, c.y + 23, c.z + Math.cos(this.viewAngle) * 23);
      this.camera.lookAt(c);
    }
    this.updateFrustum();
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t += dt;
      const p = this.tmp.copy(f.pos);
      p.y += f.t * 0.6;
      p.project(this.camera);
      f.el.style.left = ((p.x + 1) * width) / 2 + 'px';
      f.el.style.top = ((1 - p.y) * height) / 2 + 'px';
      f.el.style.opacity = Math.min(1, (1.5 - f.t) * 2);
      if (f.t > 1.5) {
        f.el.remove();
        this.floaters.splice(i, 1);
      }
    }
    this.post.render();
    if (this.samples % 30 === 0)
      this.onDiagnostics({
        backend: this.kit.backendLabel,
        preset: this.tierName[0].toUpperCase() + this.tierName.slice(1),
        ms: this.frameTime,
        bodies: this.physics.dynamic.length,
      });
  }
}
