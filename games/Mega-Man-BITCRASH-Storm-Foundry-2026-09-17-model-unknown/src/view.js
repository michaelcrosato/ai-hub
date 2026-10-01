/**
 * view.js — draws a BITCRASH run with three.js r186 on the kit's renderer
 * (WebGPU, or WebGL2 where WebGPU is missing). The look is the original's:
 * low-poly boxes and cylinders, AgX tone mapping, a light bloom, fog and one
 * shadowed sun.
 *
 * Cost notes: every material comes from one cache (a colour/finish pair is one
 * material, shared), every level's scenery is merged into a handful of meshes
 * per material, shots and sparks are instanced batches made with
 * kit.instanced (one shader each, however many are flying), and nothing is
 * allocated per frame.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createPost } from 'kit/post.js';
import { CONFIG } from './game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createView(kit, { coarse = false } = {}) {
  const { renderer } = kit;
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071526);
  scene.fog = new THREE.Fog(0x09192a, 18, 58);
  const camera = kit.fitCamera(new THREE.PerspectiveCamera(38, 1, 0.1, 150));

  scene.add(new THREE.HemisphereLight(0x8ddfff, 0x07111d, 1.65));
  const sun = new THREE.DirectionalLight(0xcfefff, 3.0);
  sun.position.set(-8, 18, 14);
  sun.castShadow = true;
  kit.shadow(sun, 2048); // 2048 at high, 1024 on phones (the original's split), follows quality changes
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 18, bottom: -10 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight(0xffa75d, 1.8);
  rim.position.set(10, 6, -8);
  scene.add(rim);

  const post = createPost(kit, scene, camera, { bloom: { strength: 0.3, radius: 0.28, threshold: 0.88 } });

  // ------------------------------------------------------------------ shared materials and geometry

  const mats = new Map();
  function mat(color, metal = 0.25, rough = 0.65, emissive = 0, ei = 0) {
    const key = `${color}|${metal}|${rough}|${emissive}|${ei}`;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: ei });
      mats.set(key, m);
    }
    return m;
  }
  const geos = new Map();
  const geo = (key, make) => {
    let g = geos.get(key);
    if (!g) geos.set(key, (g = make()));
    return g;
  };
  const boxGeo = (w, h, d) => geo(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cylGeo = (r, depth, seg) => geo(`c${r}|${depth}|${seg}`, () => new THREE.CylinderGeometry(r, r, depth, seg));

  function box(w, h, d, color, metal = 0.2, rough = 0.7, emissive = 0, ei = 0) {
    const m = new THREE.Mesh(boxGeo(w, h, d), mat(color, metal, rough, emissive, ei));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
  function cyl(r, depth, color, segments = 8) {
    const m = new THREE.Mesh(cylGeo(r, depth, segments), mat(color, 0.45, 0.5));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  /** Merge a built group into one mesh per material (and shadow setting). */
  function mergeStatic(root) {
    root.updateMatrixWorld(true);
    const buckets = new Map();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const key = `${o.material.id}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, list: [] }));
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      g.applyMatrix4(o.matrixWorld);
      b.list.push(g);
    });
    const out = new THREE.Group();
    for (const b of buckets.values()) {
      const merged = mergeGeometries(b.list, false);
      for (const g of b.list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      out.add(mesh);
    }
    return out;
  }

  // ------------------------------------------------------------------ signs: one atlas texture, one material

  const SIGN_ROWS = 8;
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 128 * SIGN_ROWS;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  signTex.anisotropy = 4;
  const signMat = new THREE.MeshBasicMaterial({ map: signTex });

  function buildSigns(signs, parent) {
    const g = signCanvas.getContext('2d');
    g.fillStyle = '#08243a';
    g.fillRect(0, 0, signCanvas.width, signCanvas.height);
    const H = signCanvas.height;
    signs.slice(0, SIGN_ROWS).forEach(([text, x, y], i) => {
      const oy = i * 128;
      g.font = 'bold 34px monospace';
      // Long labels get a wider board instead of running off it (the original clipped them).
      const cw = Math.min(1024, Math.max(384, Math.ceil(g.measureText(text).width + 64)));
      g.strokeStyle = '#57eaff';
      g.lineWidth = 8;
      g.strokeRect(8, oy + 8, cw - 16, 112);
      g.fillStyle = '#eaffff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, cw / 2, oy + 64);
      const plane = new THREE.PlaneGeometry((3 * cw) / 384, 1);
      const uv = plane.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * cw) / 1024, (H - oy - 128 + uv.getY(k) * 128) / H);
      const m = new THREE.Mesh(plane, signMat);
      m.position.set(x, y, -2.55);
      parent.add(m);
    });
    signTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ models

  function makePlayerModel() {
    const g = new THREE.Group();
    const blue = 0x1688ff, cyan = 0x63f0ff, dark = 0x0b3e72, skin = 0xe4f8ff;
    const torso = box(0.62, 0.64, 0.48, blue, 0.3, 0.5);
    torso.position.y = 0.78;
    g.add(torso);
    const chest = box(0.24, 0.16, 0.51, cyan, 0.2, 0.35);
    chest.position.set(0.02, 0.82, 0.02);
    g.add(chest);
    const head = box(0.53, 0.48, 0.48, blue, 0.25, 0.48);
    head.position.y = 1.38;
    g.add(head);
    const face = box(0.34, 0.22, 0.05, skin, 0.05, 0.65);
    face.position.set(0.08, 1.35, 0.27);
    g.add(face);
    const helm = cyl(0.31, 0.18, dark, 8);
    helm.rotation.x = Math.PI / 2;
    helm.position.set(0, 1.6, 0);
    g.add(helm);
    const legL = box(0.21, 0.55, 0.25, dark, 0.25, 0.58);
    const legR = legL.clone();
    legL.position.set(-0.18, 0.29, 0);
    legR.position.set(0.18, 0.29, 0);
    g.add(legL, legR);
    const arm = box(0.18, 0.52, 0.2, blue, 0.25, 0.5);
    arm.position.set(-0.43, 0.8, 0);
    g.add(arm);
    const cannon = cyl(0.2, 0.62, cyan, 10);
    cannon.rotation.z = Math.PI / 2;
    cannon.position.set(0.52, 0.82, 0);
    g.add(cannon);
    const muzzle = cyl(0.24, 0.1, 0xd6ffff, 10);
    muzzle.rotation.z = Math.PI / 2;
    muzzle.position.set(0.82, 0.82, 0);
    g.add(muzzle);
    g.userData = { legs: [legL, legR], muzzle };
    return g;
  }

  const dodeca = (r) => geo(`d${r}`, () => new THREE.DodecahedronGeometry(r, 0));

  function makeEnemyModel(type) {
    const g = new THREE.Group();
    if (type === 'walker') {
      const body = box(0.72, 0.62, 0.55, 0xb34b50, 0.45, 0.5);
      body.position.y = 0.55;
      g.add(body);
      for (const x of [-0.23, 0.23]) {
        const l = box(0.18, 0.55, 0.22, 0x6f3544, 0.35, 0.6);
        l.position.set(x, 0.14, 0);
        g.add(l);
      }
      const eye = box(0.14, 0.14, 0.58, 0xffdc68, 0.1, 0.3, 0xffb21d, 2);
      eye.position.set(0.22, 0.65, 0.02);
      g.add(eye);
    } else if (type === 'turret') {
      const base = cyl(0.44, 0.6, 0x86425a, 8);
      base.position.y = 0.3;
      g.add(base);
      const gun = cyl(0.14, 0.8, 0xffb05c, 8);
      gun.rotation.z = Math.PI / 2;
      gun.position.set(0.35, 0.62, 0);
      g.add(gun);
    } else if (type === 'drone') {
      const body = new THREE.Mesh(geo('o48', () => new THREE.OctahedronGeometry(0.48, 0)), mat(0x9d75ff, 0.35, 0.45));
      body.castShadow = true;
      g.add(body);
      g.add(box(1.3, 0.14, 0.28, 0x503c86, 0.35, 0.55));
      const eye = box(0.22, 0.14, 0.5, 0x35eaff, 0.1, 0.2, 0x35eaff, 2.5);
      eye.position.z = 0.18;
      g.add(eye);
    } else if (type === 'hopper') {
      const body = new THREE.Mesh(dodeca(0.42), mat(0xd0643c, 0.4, 0.45));
      body.castShadow = true;
      body.scale.y = 0.72;
      body.position.y = 0.55;
      g.add(body);
      const eye = box(0.18, 0.12, 0.5, 0xffdc68, 0.1, 0.3, 0xffb21d, 2);
      eye.position.set(0.2, 0.6, 0.05);
      g.add(eye);
      for (const x of [-0.18, 0.18]) {
        const spring = cyl(0.07, 0.36, 0x8c9aa4, 6);
        spring.position.set(x, 0.2, 0);
        g.add(spring);
        const foot = box(0.26, 0.08, 0.3, 0x6f3544, 0.35, 0.6);
        foot.position.set(x, 0.04, 0);
        g.add(foot);
      }
    } else if (type === 'shield') {
      for (const x of [-0.16, 0.16]) {
        const leg = box(0.2, 0.5, 0.24, 0x4f3a6b, 0.35, 0.6);
        leg.position.set(x, 0.25, 0);
        g.add(leg);
      }
      const body = box(0.62, 0.56, 0.5, 0x7a4a8c, 0.4, 0.5);
      body.position.y = 0.78;
      g.add(body);
      const head = box(0.44, 0.34, 0.44, 0x7a4a8c, 0.35, 0.5);
      head.position.y = 1.24;
      g.add(head);
      const visor = box(0.3, 0.1, 0.46, 0xff4a58, 0.1, 0.3, 0xff263c, 2.2);
      visor.position.set(0.08, 1.26, 0.02);
      g.add(visor);
      const gun = cyl(0.1, 0.5, 0xffb05c, 8);
      gun.rotation.z = Math.PI / 2;
      gun.position.set(0.38, 0.82, -0.14);
      g.add(gun);
      const shield = new THREE.Group();
      shield.add(box(0.12, 1.1, 0.82, 0x8da9b5, 0.65, 0.34));
      const rimTop = box(0.14, 0.08, 0.86, 0xffdc68, 0.2, 0.3, 0xffad25, 1.2);
      rimTop.position.y = 0.53;
      shield.add(rimTop);
      shield.position.set(0.48, 0.72, 0.08);
      g.add(shield);
      g.userData.shield = shield;
    }
    return g;
  }

  function makeGaleBoss() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(dodeca(0.72), mat(0xff8f46, 0.5, 0.35, 0xff4d24, 1.5));
    core.castShadow = true;
    g.add(core);
    g.add(new THREE.Mesh(geo('t1', () => new THREE.TorusGeometry(1.0, 0.16, 8, 16)), mat(0x8da9b5, 0.65, 0.34)));
    for (let i = 0; i < 5; i++) {
      const blade = box(0.38, 1.7, 0.24, 0xd8eef2, 0.6, 0.32);
      blade.position.y = 1.25;
      const a = new THREE.Group();
      a.rotation.z = (i * Math.PI) / 3;
      a.add(blade);
      g.add(a);
    }
    return g;
  }

  function makeArcBoss() {
    const g = new THREE.Group();
    const spin = new THREE.Group();
    g.add(spin);
    const core = new THREE.Mesh(geo('i78', () => new THREE.IcosahedronGeometry(0.78, 0)), mat(0x9d75ff, 0.5, 0.35, 0x6b3dff, 1.6));
    core.castShadow = true;
    spin.add(core);
    const ringA = new THREE.Mesh(geo('t2', () => new THREE.TorusGeometry(1.12, 0.12, 8, 18)), mat(0x8da9b5, 0.65, 0.34));
    ringA.castShadow = true;
    spin.add(ringA);
    const ringB = new THREE.Mesh(geo('t3', () => new THREE.TorusGeometry(0.92, 0.09, 8, 18)), mat(0xd8eef2, 0.6, 0.32));
    ringB.rotation.x = Math.PI / 2;
    spin.add(ringB);
    const coneGeo = geo('k1', () => new THREE.ConeGeometry(0.16, 0.8, 6));
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const c = new THREE.Mesh(coneGeo, mat(0xd8eef2, 0.6, 0.32));
      c.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0);
      c.rotation.z = a - Math.PI / 2;
      ringA.add(c);
    }
    const eye = box(0.42, 0.16, 0.2, 0x35eaff, 0.1, 0.2, 0x35eaff, 3);
    eye.position.z = 0.72;
    g.add(eye);
    g.userData = { spin, core, ringA, ringB };
    return g;
  }

  function makeGate() {
    const g = new THREE.Group();
    for (let y = 0.8; y < 7; y += 0.65) {
      const b = box(0.55, 0.18, 3.6, 0xff4a58, 0.25, 0.35, 0xff263c, 2);
      b.position.y = y;
      g.add(b);
    }
    g.visible = false;
    return g;
  }

  const player = makePlayerModel();
  scene.add(player);
  const galeBoss = makeGaleBoss();
  const arcBoss = makeArcBoss();
  galeBoss.visible = arcBoss.visible = false;
  scene.add(galeBoss, arcBoss);
  const gate = makeGate();
  scene.add(gate);
  let bossModel = null;

  // ------------------------------------------------------------------ pooled effects

  const _m = new THREE.Matrix4();
  const _c = new THREE.Color();

  // Shots: instanced, so a screen full of bullets is two draw calls and two shaders.
  const shotMesh = kit.instanced(new THREE.SphereGeometry(0.18, 8, 6), mat(0x72f5ff, 0.1, 0.2, 0x35eaff, 4), 64);
  const enemyShotMesh = kit.instanced(new THREE.SphereGeometry(0.19, 8, 6), mat(0xff655f, 0.1, 0.2, 0xff2635, 3), 160);
  for (const m of [shotMesh, enemyShotMesh]) {
    m.frustumCulled = false;
    m.count = 0;
    m.visible = false;
    scene.add(m);
  }
  function writeShots(mesh, list, cap, base) {
    const n = Math.min(list.length, cap);
    for (let i = 0; i < n; i++) {
      const s = list[i];
      const k = s.r / base;
      _m.makeScale(k, k, k);
      _m.setPosition(s.x, s.y, 0);
      mesh.setMatrixAt(i, _m);
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) mesh.instanceMatrix.needsUpdate = true;
  }

  // Sparks: one instanced batch of small cubes with per-spark colour.
  const P_MAX = 240;
  const sparkMesh = kit.instanced(new THREE.BoxGeometry(0.13, 0.13, 0.13), new THREE.MeshBasicMaterial({ color: 0xffffff }), P_MAX);
  sparkMesh.frustumCulled = false;
  _c.setRGB(1, 1, 1);
  for (let i = 0; i < P_MAX; i++) sparkMesh.setColorAt(i, _c);
  sparkMesh.count = 0;
  sparkMesh.visible = false;
  scene.add(sparkMesh);
  const sparks = [];
  for (let i = 0; i < P_MAX; i++) sparks.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, r: 1, g: 1, b: 1, grav: 9 });
  let liveSparks = 0;

  function spark(x, y, color, speed, life, size, grav) {
    if (liveSparks >= P_MAX) return;
    const q = sparks[liveSparks++];
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.65);
    q.x = x;
    q.y = y;
    q.z = (Math.random() - 0.5) * 0.6;
    q.vx = Math.cos(a) * v;
    q.vy = Math.sin(a) * v + speed * 0.25;
    q.vz = (Math.random() - 0.5) * v * 0.5;
    q.life = q.max = life * (0.6 + Math.random() * 0.4);
    q.size = size;
    q.grav = grav;
    _c.setHex(color);
    q.r = _c.r * 2.2;
    q.g = _c.g * 2.2;
    q.b = _c.b * 2.2;
  }
  function burst(x, y, color, n = 8, speed = 4) {
    const count = kit.detail(n);
    for (let i = 0; i < count; i++) spark(x, y, color, speed, 0.55, 1, 9);
  }
  function updateSparks(dt) {
    let i = 0;
    while (i < liveSparks) {
      const q = sparks[i];
      q.life -= dt;
      if (q.life <= 0) {
        // swap with the last live spark (keeps the live ones packed at the front)
        liveSparks--;
        sparks[i] = sparks[liveSparks];
        sparks[liveSparks] = q;
        continue;
      }
      q.vy -= q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      const k = q.size * (0.35 + 0.65 * (q.life / q.max));
      _m.makeScale(k, k, k);
      _m.setPosition(q.x, q.y, q.z);
      sparkMesh.setMatrixAt(i, _m);
      _c.setRGB(q.r, q.g, q.b);
      sparkMesh.setColorAt(i, _c);
      i++;
    }
    sparkMesh.count = liveSparks;
    sparkMesh.visible = liveSparks > 0;
    if (liveSparks) {
      sparkMesh.instanceMatrix.needsUpdate = true;
      sparkMesh.instanceColor.needsUpdate = true;
    }
  }

  // Pickups: one shared mesh per pickup (shared geometry and material), reused across runs.
  const scrapGeo = new THREE.TorusGeometry(0.23, 0.09, 6, 10);
  const healthGeo = new THREE.OctahedronGeometry(0.28, 0);
  const pickupPool = { scrap: [], health: [] };
  function pickupMesh(type, i) {
    const pool = pickupPool[type];
    while (pool.length <= i) {
      const m = type === 'health' ? new THREE.Mesh(healthGeo, mat(0x58e6a4, 0.2, 0.3, 0x42ffad, 2.4)) : new THREE.Mesh(scrapGeo, mat(0xffdc68, 0.55, 0.28, 0xffad25, 1.6));
      m.castShadow = true;
      m.visible = false;
      scene.add(m);
      pool.push(m);
    }
    return pool[i];
  }

  // Gale Burst gusts.
  const gustPool = [];
  for (let i = 0; i < 8; i++) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(geo('g1', () => new THREE.TorusGeometry(0.34, 0.09, 6, 16)), mat(0xd8f8ff, 0.1, 0.2, 0x9ff3ff, 3.2));
    const inner = new THREE.Mesh(geo('g2', () => new THREE.TorusGeometry(0.2, 0.06, 6, 12)), mat(0xd8f8ff, 0.1, 0.2, 0x9ff3ff, 3.2));
    const core = new THREE.Mesh(geo('g3', () => new THREE.SphereGeometry(0.13, 8, 6)), mat(0xffffff, 0.1, 0.2, 0xd8f8ff, 4));
    g.add(ring, inner, core);
    g.userData = { ring, inner };
    g.visible = false;
    scene.add(g);
    gustPool.push(g);
  }

  // Arc Regent lightning: a blinking floor marker, then the column.
  const strikePool = [];
  for (let i = 0; i < 5; i++) {
    const marker = box(1.0, 0.06, 3.0, 0x35eaff, 0, 0.3, 0x35eaff, 2.5);
    const column = box(0.42, 14, 0.42, 0xd8f8ff, 0, 0.2, 0x8fe9ff, 5);
    marker.castShadow = column.castShadow = false;
    marker.visible = column.visible = false;
    scene.add(marker, column);
    strikePool.push({ marker, column });
  }

  // ------------------------------------------------------------------ level build

  let levelStatic = null;
  const levelDyn = new THREE.Group();
  const entityRoot = new THREE.Group();
  scene.add(levelDyn, entityRoot);
  const dyn = { movers: [], fans: [], electric: [], crushers: [] };
  let enemyViews = [];
  let builtVersion = -1;

  function buildLevel(state) {
    const L = state.level;
    const T = L.theme;
    if (levelStatic) {
      scene.remove(levelStatic);
      levelStatic.traverse((o) => o.isMesh && o.geometry.dispose());
      levelStatic = null;
    }
    levelDyn.clear();
    entityRoot.clear();
    dyn.movers.length = dyn.fans.length = dyn.electric.length = dyn.crushers.length = 0;
    scene.background.setHex(T.sky);
    scene.fog.color.setHex(T.fog);

    const root = new THREE.Group();
    // Backdrop towers and clouds
    for (let i = 0; i < L.backdrop.towers; i++) {
      const h = 3 + (i % 5) * 1.5;
      const z = -10 - (i % 3) * 2;
      const t = box(2.2, h, 2.2, T.tower, 0.4, 0.8);
      t.position.set(i * 4 - 4, h / 2 - 1, z);
      root.add(t);
      const cap = cyl(0.75, 0.5, T.towerCap, 8);
      cap.position.set(i * 4 - 4, h - 1, z);
      root.add(cap);
    }
    for (let i = 0; i < L.backdrop.clouds; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        const cloud = new THREE.Mesh(dodeca(0.9 + (j % 2) * 0.35), mat(T.cloud, 0.05, 1));
        cloud.scale.y = 0.55;
        cloud.position.set(j * 0.8, Math.sin(j) * 0.2, 0);
        g.add(cloud);
      }
      g.position.set(i * 5 - 5, 8 + (i % 3) * 2, -14 - (i % 2) * 4);
      root.add(g);
    }
    // Main solids
    for (const p of state.platforms) {
      const b = box(p.w, p.h, 4.2, p.id === 'boss' ? T.bossFloor : T.platform, 0.4, 0.55);
      b.position.set(p.x, p.y, -0.3);
      root.add(b);
      const lip = box(p.w, 0.16, 4.35, T.platformTop, 0.2, 0.45);
      lip.position.set(p.x, p.y + p.h / 2 + 0.08, -0.3);
      root.add(lip);
      if (p.w > 3 && p.id !== 'cap') {
        const railY = p.y + p.h / 2 + 1.25;
        const rail = cyl(0.07, p.w * 0.92, T.rail, 7);
        rail.rotation.z = Math.PI / 2;
        rail.position.set(p.x, railY, -1.65);
        root.add(rail);
        for (let xx = p.x - p.w * 0.42; xx < p.x + p.w * 0.45; xx += 2.4) {
          const postMesh = cyl(0.06, 1.15, T.rail, 7);
          postMesh.position.set(xx, railY - 0.55, -1.65);
          root.add(postMesh);
        }
      }
    }
    // Service bay terminals
    for (const t of state.terminals) {
      const g = new THREE.Group();
      const base = box(1.1, 1.65, 0.9, 0x234d62, 0.5, 0.48);
      base.position.y = 0.15;
      g.add(base);
      const screen = box(0.72, 0.54, 0.08, 0x122b3a, 0.2, 0.4);
      screen.position.set(0, 0.42, 0.49);
      g.add(screen);
      const glow = box(0.58, 0.38, 0.04, 0x35eaff, 0, 0.2, 0x35eaff, 3);
      glow.position.set(0, 0.42, 0.55);
      g.add(glow);
      g.position.set(t.x, t.y - 0.45, -0.1);
      root.add(g);
    }
    buildSigns(L.signs, root);

    // Hazards
    for (const h of state.hazards) {
      if (h.type === 'fan') {
        const g = new THREE.Group();
        const hub = cyl(0.36, 0.55, 0xcfcfd2, 10);
        hub.rotation.x = Math.PI / 2;
        g.add(hub);
        for (let i = 0; i < 4; i++) {
          const blade = box(0.28, 1.35, 0.18, 0xff9a46, 0.25, 0.4);
          blade.position.y = 0.68;
          const arm = new THREE.Group();
          arm.rotation.z = (i * Math.PI) / 2;
          arm.add(blade);
          g.add(arm);
        }
        g.position.set(h.x, h.y, 0);
        levelDyn.add(g);
        dyn.fans.push(g);
      } else if (h.type === 'electric') {
        const g = new THREE.Group();
        for (const sx of [-0.38, 0.38]) {
          const postMesh = cyl(0.1, 2.1, 0x859eaa, 8);
          postMesh.position.x = sx;
          g.add(postMesh);
        }
        const core = box(0.55, 0.25, 0.45, 0x35eaff, 0.1, 0.2);
        core.position.y = 0.1;
        g.add(core);
        g.position.set(h.x, h.y, 0);
        levelDyn.add(g);
        dyn.electric.push(g);
      } else if (h.type === 'crusher') {
        const housing = box(2.0, 0.6, 2.6, 0x23384a, 0.45, 0.5);
        housing.position.set(h.x, h.floor + 4.9, -0.3);
        root.add(housing);
        const head = new THREE.Group();
        head.add(box(h.w, 1.0, 2.2, 0x3b4b5a, 0.5, 0.45));
        for (let k = -2; k <= 2; k++) {
          const stripe = box(0.26, 0.2, 2.24, k % 2 ? 0x1a1d22 : 0xffb04a, 0.3, 0.5);
          stripe.position.set(k * 0.3, -0.42, 0);
          head.add(stripe);
        }
        const shaft = cyl(0.18, 1, 0x5b6f7c, 8);
        levelDyn.add(head, shaft);
        dyn.crushers.push({ h, head, shaft });
      }
    }
    // Moving platforms (rail platforms carry their stripes lengthwise)
    for (const m of state.movers) {
      const g = new THREE.Group();
      g.add(box(m.w, m.h, 3.2, T.mover, 0.4, 0.45));
      for (let i = -1; i <= 1; i++) {
        const s = m.axis === 'x' ? box(m.w * 0.8, 0.08, 0.32, 0xff9b47, 0.2, 0.35) : box(0.32, 0.08, 3.28, 0x36eaff, 0.2, 0.35);
        s.position.y = 0.25;
        if (m.axis === 'x') s.position.z = i * 0.9;
        else s.position.x = i * 0.55;
        g.add(s);
      }
      g.position.set(m.x, m.y, -0.3);
      levelDyn.add(g);
      dyn.movers.push({ m, g });
    }

    levelStatic = mergeStatic(root);
    scene.add(levelStatic);
  }

  function buildEntities(state) {
    entityRoot.clear();
    enemyViews = state.enemies.map((e) => {
      const g = makeEnemyModel(e.type);
      entityRoot.add(g);
      return { e, g };
    });
    galeBoss.visible = arcBoss.visible = false;
    bossModel = state.boss ? (state.boss.kind === 'arc' ? arcBoss : galeBoss) : null;
    if (state.gate) gate.position.set(state.gate.x, 0, -0.1);
    liveSparks = 0;
  }

  // ------------------------------------------------------------------ camera

  const cam = { x: 4, y: 5, zoom: 1, shake: 0 };
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(19));

  /** Called when a run (re)starts: rebuild the level and snap the camera to the start. */
  function load(state) {
    buildLevel(state);
    buildEntities(state);
    builtVersion = state.version;
    cam.x = 4;
    cam.y = 5;
    cam.shake = 0;
  }

  function updateCamera(state, dt) {
    const p = state.player;
    if (!p) return;
    const aspect = kit.size.width / Math.max(1, kit.size.height);
    // Narrow (portrait) screens pull back so enough of the stage stays in view.
    const minHalf = state.bossActive ? 6.2 : 5.2;
    const zFit = Math.max(20, minHalf / (tanHalf * aspect));
    const z = zFit / cam.zoom;
    let tx = p.x + 3.0 * p.facing;
    let ty = clamp(p.y + 2.2, 4.7, 7.2);
    if (state.bossActive) {
      const B = state.level.boss;
      tx = B.camX;
      ty = B.camY;
      const halfW = tanHalf * aspect * z;
      const slack = Math.max(0, (B.arena[1] - B.arena[0]) / 2 + 0.5 - halfW);
      if (slack > 0) tx = clamp(p.x, B.camX - slack, B.camX + slack);
    }
    const kx = 1 - Math.pow(1 - (coarse ? 0.065 : 0.09), dt * 60);
    const ky = 1 - Math.pow(1 - 0.06, dt * 60);
    cam.x += (tx - cam.x) * kx;
    cam.y += (ty - cam.y) * ky;
    cam.shake = Math.max(0, cam.shake - dt * 2.4);
    const s = cam.shake * cam.shake * 0.6;
    const ox = s ? (Math.random() * 2 - 1) * s : 0;
    const oy = s ? (Math.random() * 2 - 1) * s : 0;
    camera.position.set(cam.x + ox, cam.y + 1.2 + oy, z);
    camera.lookAt(cam.x + ox, cam.y + oy, 0);
    scene.fog.near = z - 2;
    scene.fog.far = z + 38;
    sun.position.set(cam.x - 8, 18, 14);
    sun.target.position.set(cam.x, 0, 0);
  }

  // ------------------------------------------------------------------ per frame

  function sync(state, dt) {
    const t = state.time;
    const p = state.player;
    if (!p) return;
    if (state.version !== builtVersion) load(state);

    player.visible = !(p.invuln > 0 && Math.floor(t * 18) % 2);
    player.position.set(p.x, p.y - p.h / 2, 0);
    player.rotation.y = p.facing < 0 ? Math.PI : 0;
    const run = Math.min(1, Math.abs(p.vx) / 6);
    const a = Math.sin(t * 14) * 0.42 * run;
    player.userData.legs[0].rotation.z = a;
    player.userData.legs[1].rotation.z = -a;
    player.userData.muzzle.scale.setScalar(p.fireT > CONFIG.fireRate - 0.06 ? 1.35 : 1);

    for (const { m, g } of dyn.movers) g.position.set(m.x, m.y, -0.3);
    for (const g of dyn.fans) g.rotation.z += 4.8 * dt;
    for (const g of dyn.electric) {
      g.visible = Math.sin(t * 11) > -0.35;
      g.rotation.y = Math.sin(t * 7) * 0.08;
    }
    for (const { h, head, shaft } of dyn.crushers) {
      const jitter = h.stage === 'warn' ? Math.sin(t * 90) * 0.05 : 0;
      head.position.set(h.x + jitter, h.y, -0.3);
      const top = h.floor + 4.6;
      const bottom = h.y + 0.5;
      shaft.scale.y = Math.max(0.05, top - bottom);
      shaft.position.set(h.x, (top + bottom) / 2, -0.3);
    }

    for (const { e, g } of enemyViews) {
      g.visible = e.alive;
      if (!e.alive) continue;
      const pop = e.flash ? 1.12 : 1;
      g.position.set(e.x, e.y - e.h / 2, 0);
      g.scale.setScalar(pop);
      if (e.type === 'turret') g.rotation.y = e.dir < 0 ? Math.PI : 0;
      else if (e.type === 'walker') g.rotation.y = e.vx < 0 ? Math.PI : 0;
      else if (e.type === 'drone') {
        // Centred on its hitbox (the original drew it half a body low).
        g.position.y = e.y;
        g.rotation.z = Math.sin(t * 3 + e.originX) * 0.12;
      } else if (e.type === 'hopper') {
        const sq = e.air ? 1.12 : 1 - e.squash * 1.6;
        g.scale.set(pop / Math.sqrt(sq), pop * sq, pop);
        g.rotation.y = e.vx < 0 ? Math.PI : 0;
      } else if (e.type === 'shield') {
        g.rotation.y = e.dir < 0 ? Math.PI : 0;
        const sh = g.userData.shield;
        const open = e.open > 0;
        sh.position.y = open ? 0.32 : 0.72;
        sh.rotation.z = open ? -0.55 : 0;
      }
    }

    if (bossModel) {
      const b = state.boss;
      bossModel.visible = b.alive;
      if (b.alive) {
        bossModel.position.set(b.x, b.y, 0);
        const pop = b.flash ? 1.08 : 1;
        if (b.kind === 'gale') {
          bossModel.rotation.z += (b.phase === 2 ? 4.2 : 2.4) * dt;
          bossModel.scale.setScalar(pop);
          if (b.wind && Math.random() < dt * 24) {
            // Wind shear streaks across the arena.
            const B = state.level.boss;
            const x = b.wind > 0 ? B.arena[0] + Math.random() * 3 : B.arena[1] - Math.random() * 3;
            if (liveSparks < P_MAX) {
              const q = sparks[liveSparks++];
              q.x = x;
              q.y = B.floor + 0.4 + Math.random() * 6;
              q.z = (Math.random() - 0.5) * 2;
              q.vx = b.wind * (9 + Math.random() * 4);
              q.vy = q.vz = 0;
              q.life = q.max = 0.9;
              q.size = 0.8;
              q.grav = 0;
              q.r = q.g = q.b = 0.9;
            }
          }
        } else {
          const u = bossModel.userData;
          u.core.rotation.y += 1.5 * dt;
          u.ringA.rotation.z += (b.phase === 2 ? 3.2 : 1.6) * dt;
          u.ringB.rotation.y += 2.2 * dt;
          const charge = b.mode === 'windup' ? 1 + Math.sin(t * 40) * 0.08 : 1;
          bossModel.scale.setScalar(pop * charge * (b.mode === 'dash' ? 0.85 : 1));
          const tilt = b.mode === 'dash' ? -b.dashDir * 0.45 : 0;
          bossModel.rotation.z += (tilt - bossModel.rotation.z) * Math.min(1, dt * 10);
        }
      }
    }
    gate.visible = state.bossGate;

    // pickups
    let si = 0;
    let hi = 0;
    const pickups = state.pickups;
    for (let i = 0; i < pickups.length; i++) {
      const it = pickups[i];
      if (it.taken) continue;
      const m = it.type === 'health' ? pickupMesh('health', hi++) : pickupMesh('scrap', si++);
      m.visible = true;
      m.position.set(it.x, it.y + Math.sin(t * 2.2 + i) * 0.06, 0);
      m.rotation.set(0, t * 2.4 + i, t * 1.2);
    }
    for (let k = si; k < pickupPool.scrap.length; k++) pickupPool.scrap[k].visible = false;
    for (let k = hi; k < pickupPool.health.length; k++) pickupPool.health[k].visible = false;

    writeShots(shotMesh, state.shots, 64, 0.16);
    writeShots(enemyShotMesh, state.enemyShots, 160, 0.19);

    for (let i = 0; i < gustPool.length; i++) {
      const g = gustPool[i];
      const s = state.gusts[i];
      g.visible = !!s;
      if (!s) continue;
      g.position.set(s.x, s.y, 0);
      g.userData.ring.rotation.z = s.spin;
      g.userData.inner.rotation.y = s.spin * 0.7;
      if (Math.random() < dt * 30) spark(s.x - Math.sign(s.vx) * 0.3, s.y, 0x9ff3ff, 1.5, 0.3, 0.7, 0);
    }

    const floor = state.level.boss ? state.level.boss.floor : 0;
    for (let i = 0; i < strikePool.length; i++) {
      const v = strikePool[i];
      const s = state.strikes[i];
      const live = !!s && s.live;
      v.marker.visible = live && s.t < 0.85 && Math.floor(s.t * 12) % 2 === 0;
      v.column.visible = live && s.t >= 0.85 && s.t < 1.15;
      if (!live) continue;
      v.marker.position.set(s.x, floor + 0.04, -0.3);
      v.column.position.set(s.x, floor + 7, 0);
      v.column.scale.x = v.column.scale.z = 0.8 + Math.random() * 0.5;
    }

    updateSparks(dt);
  }

  /** Make every material and pooled object draw once while the loading card is up. */
  async function prewarm(state) {
    const hidden = [];
    const show = (o) => {
      if (!o.visible) hidden.push(o);
      o.visible = true;
    };
    pickupMesh('scrap', 0);
    pickupMesh('health', 0);
    [galeBoss, arcBoss, gate, ...gustPool, pickupPool.scrap[0], pickupPool.health[0]].forEach(show);
    for (const v of strikePool) {
      show(v.marker);
      show(v.column);
    }
    const p = state.player;
    const x = p ? p.x + 4 : 6;
    galeBoss.position.set(x, 4, 0);
    arcBoss.position.set(x + 3, 4, 0);
    for (const m of [shotMesh, enemyShotMesh, sparkMesh]) {
      _m.makeTranslation(x, 3, 0);
      m.setMatrixAt(0, _m);
      m.instanceMatrix.needsUpdate = true;
      m.count = 1;
      show(m);
    }
    updateCamera(state, 1);
    try {
      await renderer.compileAsync(scene, camera);
      post.render();
    } catch (err) {
      console.warn('BITCRASH: pre-warm skipped', err);
    }
    for (const o of hidden) o.visible = false;
    for (const m of [shotMesh, enemyShotMesh, sparkMesh]) m.count = 0;
  }

  return {
    scene,
    camera,
    load,
    sync,
    updateCamera,
    prewarm,
    burst,
    shake(amount) {
      cam.shake = Math.min(1, cam.shake + amount);
    },
    get zoom() {
      return cam.zoom;
    },
    set zoom(v) {
      cam.zoom = clamp(v, 0.78, 1.28);
    },
    render() {
      post.render();
    },
  };
}
