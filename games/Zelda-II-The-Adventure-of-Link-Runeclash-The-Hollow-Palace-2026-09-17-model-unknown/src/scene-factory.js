const PALETTE = {
  sky: 0x120f27,
  fog: 0x1b1734,
  stone: 0x4d4566,
  stoneDark: 0x2e2946,
  stoneLight: 0x746c8c,
  trim: 0xb58b58,
  gold: 0xf0c45e,
  ember: 0xff7048,
  cyan: 0x63e2dd,
  hero: 0x208e87,
  heroDark: 0x145b5b,
  scarf: 0xf0a24f,
  skin: 0xd69b73,
  steel: 0xb8c4d1,
  shield: 0x2b7181,
  bone: 0xd9d4c2,
  enemy: 0x8d435f,
  enemyDark: 0x382b45,
  boss: 0x553341,
  grass: 0x263f45,
  black: 0x14121c,
  white: 0xf8f0d8
};

function setShadow(mesh, cast = true, receive = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

function meshBox(THREE, parent, mat, sx, sy, sz, x = 0, y = 0, z = 0) {
  const mesh = setShadow(new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function meshCylinder(THREE, parent, mat, rTop, rBottom, h, segments, x = 0, y = 0, z = 0) {
  const mesh = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function makeStandardFactory(THREE, modern) {
  const Standard = modern && THREE.MeshStandardNodeMaterial ? THREE.MeshStandardNodeMaterial : THREE.MeshStandardMaterial;
  const Basic = modern && THREE.MeshBasicNodeMaterial ? THREE.MeshBasicNodeMaterial : THREE.MeshBasicMaterial;
  return {
    standard(color, extra = {}) {
      const params = {
        color,
        roughness: extra.roughness ?? 0.78,
        metalness: extra.metalness ?? 0.04,
        flatShading: extra.flatShading ?? true,
        transparent: Boolean(extra.transparent),
        opacity: extra.opacity ?? 1,
        depthWrite: extra.depthWrite ?? true
      };
      if (extra.emissive != null) {
        params.emissive = extra.emissive;
        params.emissiveIntensity = extra.emissiveIntensity ?? 1;
      }
      const m = new Standard(params);
      m.name = extra.name ?? 'standard';
      return m;
    },
    basic(color, extra = {}) {
      const m = new Basic({
        color,
        transparent: Boolean(extra.transparent),
        opacity: extra.opacity ?? 1,
        depthWrite: extra.depthWrite ?? true
      });
      m.name = extra.name ?? 'basic';
      return m;
    }
  };
}

function createPlayer(THREE, mats) {
  const root = new THREE.Group();
  root.name = 'Runeclash Hero';

  const boot = mats.standard(PALETTE.enemyDark, { roughness: 0.9 });
  const cloth = mats.standard(PALETTE.hero, { roughness: 0.92 });
  const clothDark = mats.standard(PALETTE.heroDark, { roughness: 0.95 });
  const skin = mats.standard(PALETTE.skin, { roughness: 0.9 });
  const scarf = mats.standard(PALETTE.scarf, { roughness: 0.8, emissive: 0x3d1800, emissiveIntensity: 0.2 });
  const steel = mats.standard(PALETTE.steel, { roughness: 0.36, metalness: 0.72 });
  const shieldMat = mats.standard(PALETTE.shield, { roughness: 0.45, metalness: 0.42 });
  const gold = mats.standard(PALETTE.gold, { roughness: 0.35, metalness: 0.55 });

  meshBox(THREE, root, boot, 0.22, 0.5, 0.30, -0.18, -0.60, 0);
  meshBox(THREE, root, boot, 0.22, 0.5, 0.30, 0.18, -0.60, 0);
  meshBox(THREE, root, clothDark, 0.54, 0.24, 0.35, 0, -0.32, 0);
  meshBox(THREE, root, cloth, 0.62, 0.68, 0.36, 0, 0.04, 0);
  meshBox(THREE, root, scarf, 0.66, 0.12, 0.40, 0, 0.38, 0.01);

  const head = setShadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), skin));
  head.position.set(0, 0.67, 0);
  root.add(head);
  meshBox(THREE, root, clothDark, 0.46, 0.15, 0.34, 0, 0.91, -0.02);
  const hood = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.62, 5), cloth));
  hood.rotation.z = -0.35;
  hood.position.set(-0.08, 1.08, -0.03);
  root.add(hood);

  // front arm and sword
  meshBox(THREE, root, cloth, 0.18, 0.48, 0.22, 0.38, 0.05, 0.05);
  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.46, 0.17, 0.14);
  root.add(swordPivot);
  meshBox(THREE, swordPivot, gold, 0.34, 0.09, 0.10, 0, 0, 0);
  meshBox(THREE, swordPivot, steel, 0.13, 0.86, 0.08, 0, 0.47, 0);
  const tip = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 4), steel));
  tip.position.y = 0.99;
  tip.rotation.z = Math.PI;
  swordPivot.add(tip);

  // shield is intentionally angular rather than copying a source shield silhouette.
  const shield = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 8), shieldMat));
  shield.rotation.x = Math.PI / 2;
  shield.position.set(-0.42, 0.08, 0.25);
  root.add(shield);
  const shieldBoss = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.15, 8), gold));
  shieldBoss.rotation.x = Math.PI / 2;
  shieldBoss.position.set(-0.42, 0.08, 0.32);
  root.add(shieldBoss);

  return { root, swordPivot, shield, materials: [boot, cloth, clothDark, skin, scarf, steel, shieldMat, gold] };
}

function createBlob(THREE, mats) {
  const root = new THREE.Group();
  const bodyMat = mats.standard(0x4a9e86, { roughness: 0.88, emissive: 0x06251f, emissiveIntensity: 0.16 });
  const eyeMat = mats.basic(PALETTE.gold);
  const body = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.50, 0), bodyMat));
  body.scale.y = 0.7;
  root.add(body);
  meshBox(THREE, root, eyeMat, 0.09, 0.10, 0.08, 0.19, 0.08, 0.40).castShadow = false;
  meshBox(THREE, root, eyeMat, 0.09, 0.10, 0.08, -0.02, 0.08, 0.43).castShadow = false;
  return { root, materials: [bodyMat, eyeMat] };
}

function createBone(THREE, mats) {
  const root = new THREE.Group();
  const bone = mats.standard(PALETTE.bone, { roughness: 0.92 });
  const wrap = mats.standard(PALETTE.enemy, { roughness: 0.85 });
  const iron = mats.standard(0x8a8e9c, { roughness: 0.48, metalness: 0.55 });
  meshBox(THREE, root, bone, 0.38, 0.42, 0.28, 0, 0.34, 0);
  meshBox(THREE, root, wrap, 0.48, 0.18, 0.31, 0, 0.18, 0);
  meshBox(THREE, root, bone, 0.18, 0.56, 0.18, -0.16, -0.32, 0);
  meshBox(THREE, root, bone, 0.18, 0.56, 0.18, 0.16, -0.32, 0);
  const skull = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 0.35), bone));
  skull.position.y = 0.78;
  root.add(skull);
  meshBox(THREE, root, mats.basic(0x2c1835), 0.08, 0.08, 0.03, 0.11, 0.82, 0.19).castShadow = false;
  meshBox(THREE, root, mats.basic(0x2c1835), 0.08, 0.08, 0.03, -0.11, 0.82, 0.19).castShadow = false;
  const bladePivot = new THREE.Group();
  bladePivot.position.set(0.33, 0.18, 0.03);
  root.add(bladePivot);
  meshBox(THREE, bladePivot, iron, 0.10, 0.72, 0.07, 0, 0.31, 0);
  return { root, bladePivot, materials: [bone, wrap, iron] };
}

function createSentinel(THREE, mats, boss = false) {
  const root = new THREE.Group();
  const armor = mats.standard(boss ? PALETTE.boss : 0x46516d, { roughness: 0.40, metalness: 0.58 });
  const dark = mats.standard(PALETTE.enemyDark, { roughness: 0.75, metalness: 0.20 });
  const trim = mats.standard(boss ? PALETTE.ember : PALETTE.trim, { roughness: 0.35, metalness: 0.58, emissive: boss ? 0x4a0d05 : 0x1b0d02, emissiveIntensity: boss ? 0.45 : 0.12 });
  const visor = mats.basic(boss ? 0xff7b4e : 0x79e9e2);
  const scale = boss ? 1.25 : 1;
  root.scale.setScalar(scale);

  meshBox(THREE, root, dark, 0.24, 0.60, 0.32, -0.19, -0.43, 0);
  meshBox(THREE, root, dark, 0.24, 0.60, 0.32, 0.19, -0.43, 0);
  meshBox(THREE, root, armor, 0.72, 0.76, 0.43, 0, 0.14, 0);
  meshBox(THREE, root, trim, 0.74, 0.12, 0.46, 0, 0.18, 0.02);
  const helmet = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.40, 0.50, 6), armor));
  helmet.position.y = 0.78;
  root.add(helmet);
  meshBox(THREE, root, visor, 0.48, 0.07, 0.04, 0, 0.80, 0.37).castShadow = false;

  const shieldPivot = new THREE.Group();
  shieldPivot.position.set(-0.48, 0.17, 0.14);
  root.add(shieldPivot);
  const shield = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.14, 6), armor));
  shield.rotation.x = Math.PI / 2;
  shield.scale.y = 1.15;
  shieldPivot.add(shield);
  const bossMesh = setShadow(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.17, 6), trim));
  bossMesh.rotation.x = Math.PI / 2;
  bossMesh.position.z = 0.08;
  shieldPivot.add(bossMesh);

  const swordPivot = new THREE.Group();
  swordPivot.position.set(0.48, 0.25, 0.08);
  root.add(swordPivot);
  meshBox(THREE, swordPivot, trim, 0.32, 0.10, 0.10, 0, 0, 0);
  meshBox(THREE, swordPivot, mats.standard(PALETTE.steel, { roughness: 0.30, metalness: 0.8 }), 0.13, boss ? 1.05 : 0.82, 0.08, 0, boss ? 0.54 : 0.43, 0);

  if (boss) {
    // Three uneven crown fins give the Warden a unique silhouette.
    for (let i = -1; i <= 1; i++) {
      const fin = setShadow(new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.48 + (i === 0 ? 0.15 : 0), 4), trim));
      fin.position.set(i * 0.22, 1.23 + (i === 0 ? 0.06 : 0), 0);
      fin.rotation.z = i * -0.16;
      root.add(fin);
    }
  }
  return { root, shieldPivot, swordPivot, materials: [armor, dark, trim, visor] };
}

function createChest(THREE, mats, color) {
  const root = new THREE.Group();
  const wood = mats.standard(color, { roughness: 0.78 });
  const metal = mats.standard(PALETTE.gold, { roughness: 0.38, metalness: 0.58, emissive: 0x281700, emissiveIntensity: 0.16 });
  meshBox(THREE, root, wood, 0.92, 0.48, 0.70, 0, 0, 0);
  meshBox(THREE, root, metal, 0.16, 0.52, 0.74, 0, 0.02, 0.02);
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.24, -0.30);
  root.add(lidPivot);
  meshBox(THREE, lidPivot, wood, 0.96, 0.22, 0.70, 0, 0.10, 0.30);
  meshBox(THREE, lidPivot, metal, 0.16, 0.24, 0.74, 0, 0.10, 0.30);
  return { root, lidPivot, materials: [wood, metal] };
}

function createSign(THREE, mats, x, y) {
  const root = new THREE.Group();
  const stone = mats.standard(PALETTE.stoneLight, { roughness: 0.96 });
  meshBox(THREE, root, stone, 0.16, 0.72, 0.18, 0, -0.18, 0);
  const plate = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), stone));
  plate.scale.set(1.2, 0.82, 0.35);
  plate.position.y = 0.28;
  root.add(plate);
  root.position.set(x, y, 0.65);
  return root;
}

export function createSceneVisuals({ THREE, scene, world, modern = false }) {
  const mats = makeStandardFactory(THREE, modern);
  const root = new THREE.Group();
  root.name = 'Hollow Palace Visuals';
  scene.add(root);

  const stone = mats.standard(PALETTE.stone, { roughness: 0.92 });
  const stoneDark = mats.standard(PALETTE.stoneDark, { roughness: 0.96 });
  const stoneLight = mats.standard(PALETTE.stoneLight, { roughness: 0.90 });
  const trim = mats.standard(PALETTE.trim, { roughness: 0.62, metalness: 0.22 });
  const ember = mats.standard(PALETTE.ember, { roughness: 0.48, metalness: 0.08, emissive: PALETTE.ember, emissiveIntensity: 2.0 });
  const cyanGlow = mats.standard(PALETTE.cyan, { roughness: 0.42, emissive: PALETTE.cyan, emissiveIntensity: 1.8 });

  // Back wall and distant toy-like tower silhouettes.
  meshBox(THREE, root, stoneDark, 146, 15, 0.65, 68.5, 5.4, -3.7).receiveShadow = true;
  for (const x of [7, 24, 51, 74, 100, 126]) {
    const tower = new THREE.Group();
    tower.position.set(x, 4.5 + (x % 3) * 0.45, -5.1);
    meshBox(THREE, tower, mats.standard(0x211d3b, { roughness: 1 }), 5.8, 9.5, 2.1, 0, 0, 0);
    const roof = setShadow(new THREE.Mesh(new THREE.ConeGeometry(3.6, 3.2, 5), mats.standard(0x31264b, { roughness: 1 })), false, true);
    roof.position.y = 6.2;
    tower.add(roof);
    root.add(tower);
  }

  // Platforms and stairs.
  for (const s of world.level.solids) {
    const material = s.kind === 'catch' ? stoneDark : s.kind === 'boss' ? stoneLight : stone;
    const mesh = meshBox(THREE, root, material, s.w, s.h, 4.3, s.x, s.y, 0);
    mesh.receiveShadow = true;
  }

  // Architectural trim strips improve edge readability on a phone.
  for (const s of world.level.solids) {
    if (s.kind === 'catch') continue;
    const strip = meshBox(THREE, root, trim, Math.max(0.5, s.w - 0.05), 0.10, 4.45, s.x, s.top - 0.05, 0);
    strip.castShadow = false;
  }

  // Columns and low-poly arches.
  for (const x of world.level.columns) {
    meshBox(THREE, root, stoneLight, 0.62, 7.5, 0.8, x, 4.0, -2.95);
    meshBox(THREE, root, trim, 0.86, 0.22, 0.92, x, 7.6, -2.92);
    meshBox(THREE, root, trim, 0.86, 0.22, 0.92, x, 0.35, -2.92);
  }

  // Railings are clearly visible but deliberately non-colliding to keep mobile traversal clean.
  for (const r of world.level.railings) {
    const z = 1.72;
    const left = r.x - r.w / 2;
    const right = r.x + r.w / 2;
    const count = Math.max(2, Math.floor(r.w / 1.3));
    for (let i = 0; i <= count; i++) {
      const px = left + (r.w * i / count);
      meshBox(THREE, root, trim, 0.10, 0.72, 0.10, px, r.top + 0.36, z);
    }
    meshBox(THREE, root, trim, r.w + 0.15, 0.11, 0.12, (left + right) / 2, r.top + 0.74, z);
  }

  const torchFlames = [];
  for (const x of world.level.torches) {
    meshBox(THREE, root, trim, 0.14, 0.46, 0.16, x, 2.1 + (x > 24 && x < 50 ? 4 : x > 104 ? 3 : 0), -2.45);
    const flame = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), ember), false, false);
    flame.position.set(x, 2.48 + (x > 24 && x < 50 ? 4 : x > 104 ? 3 : 0), -2.42);
    root.add(flame);
    torchFlames.push({ mesh: flame, phase: x * 0.17 });
  }

  // Keep dynamic point lights limited for mobile performance.
  for (const x of [28, 64, 101, 129]) {
    const light = new THREE.PointLight(PALETTE.ember, modern ? 18 : 2.2, 10, 2);
    light.position.set(x, x === 28 ? 6.4 : x > 104 ? 5.4 : 2.7, 1.8);
    light.castShadow = false;
    scene.add(light);
  }

  const hemi = new THREE.HemisphereLight(0x8fb4ce, 0x271b30, modern ? 1.55 : 1.05);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd2a0, modern ? 3.0 : 1.4);
  key.position.set(20, 18, 16);
  key.castShadow = true;
  key.shadow.mapSize.width = modern ? 1536 : 1024;
  key.shadow.mapSize.height = modern ? 1536 : 1024;
  key.shadow.camera.left = -18;
  key.shadow.camera.right = 18;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  scene.add(key);

  // Signs.
  for (const s of world.level.signs) root.add(createSign(THREE, mats, s.x, s.y));

  // Door.
  const door = new THREE.Group();
  door.position.set(world.level.door.x, world.level.door.y, 0);
  meshBox(THREE, door, stoneLight, 1.10, 5.0, 3.9, 0, 0, 0);
  for (const yy of [-1.5, -0.5, 0.5, 1.5]) meshBox(THREE, door, trim, 1.22, 0.12, 4.05, 0, yy, 0.02);
  const sunMark = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), cyanGlow), false, false);
  sunMark.position.set(0, 0.25, 2.05);
  door.add(sunMark);
  root.add(door);

  // Boss barrier is a set of glowing vertical bars.
  const barrier = new THREE.Group();
  barrier.position.set(world.level.bossBarrier.x, 3.3, 0);
  for (let i = -2; i <= 2; i++) {
    const bar = meshBox(THREE, barrier, ember, 0.12, 5.0, 0.18, 0, i * 0.46, 0.2);
    bar.rotation.z = i * 0.035;
  }
  root.add(barrier);

  // Chests.
  const keyChest = createChest(THREE, mats, 0x665075);
  keyChest.root.position.set(world.level.keyChest.x, world.level.keyChest.y, 0.35);
  root.add(keyChest.root);
  const gearChest = createChest(THREE, mats, 0x6a3e35);
  gearChest.root.position.set(world.level.gearChest.x, world.level.gearChest.y, 0.35);
  root.add(gearChest.root);

  // Floating glyphs above chests.
  const keyGlyph = setShadow(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 5, 10), cyanGlow), false, false);
  keyGlyph.position.set(world.level.keyChest.x, world.level.keyChest.y + 0.85, 0.40);
  root.add(keyGlyph);
  const gearGlyph = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), ember), false, false);
  gearGlyph.position.set(world.level.gearChest.x, world.level.gearChest.y + 0.92, 0.40);
  root.add(gearGlyph);

  // Completion altar.
  const altar = new THREE.Group();
  altar.position.set(world.level.altar.x, world.level.altar.y, 0);
  meshBox(THREE, altar, stoneLight, 1.6, 0.6, 1.4, 0, -0.22, 0);
  meshBox(THREE, altar, trim, 1.2, 0.12, 1.5, 0, 0.10, 0);
  const altarCrystalMat = mats.standard(PALETTE.cyan, { roughness: 0.28, metalness: 0.08, emissive: PALETTE.cyan, emissiveIntensity: 0.25 });
  const altarCrystal = setShadow(new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 0), altarCrystalMat));
  altarCrystal.position.y = 0.75;
  altar.add(altarCrystal);
  root.add(altar);

  const playerVisual = createPlayer(THREE, mats);
  root.add(playerVisual.root);

  const enemies = new Map();
  for (const e of world.enemies) {
    let v;
    if (e.type === 'blob') v = createBlob(THREE, mats);
    else if (e.type === 'bone') v = createBone(THREE, mats);
    else if (e.type === 'sentinel') v = createSentinel(THREE, mats, false);
    else v = createSentinel(THREE, mats, true);
    v.root.name = e.id;
    root.add(v.root);
    enemies.set(e.id, v);
  }

  const projectileVisuals = new Map();
  const pickupVisuals = new Map();
  const particles = [];
  const sparkGeo = new THREE.OctahedronGeometry(0.20, 0);
  const ashGeo = new THREE.OctahedronGeometry(0.24, 0);
  const shardGeo = new THREE.OctahedronGeometry(0.20, 0);
  const sparkMat = mats.basic(PALETTE.cyan);
  const ashMat = mats.basic(PALETTE.ember);
  const healMat = mats.basic(0xff6b77);
  const manaMat = mats.basic(0x7a8cff);

  function getProjectileVisual(pr) {
    let mesh = projectileVisuals.get(pr.id);
    if (!mesh) {
      mesh = setShadow(new THREE.Mesh(pr.type === 'spark' ? sparkGeo : ashGeo, pr.type === 'spark' ? sparkMat : ashMat), false, false);
      root.add(mesh);
      projectileVisuals.set(pr.id, mesh);
    }
    return mesh;
  }

  function getPickupVisual(item) {
    let mesh = pickupVisuals.get(item.id);
    if (!mesh) {
      mesh = setShadow(new THREE.Mesh(shardGeo, item.type === 'heal' ? healMat : manaMat), false, false);
      root.add(mesh);
      pickupVisuals.set(item.id, mesh);
    }
    return mesh;
  }

  function spawnBurst(event) {
    const count = Math.min(event.count ?? 8, modern ? 28 : 14);
    for (let i = 0; i < count; i++) {
      const mat = mats.basic(event.color ?? '#ffffff', { transparent: true, opacity: 0.95, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
      mesh.position.set(event.x, event.y, 0.35 + (i % 3) * 0.08);
      root.add(mesh);
      const a = (i / Math.max(1, count)) * Math.PI * 2 + (event.x * 0.13);
      const speed = 1.8 + (i % 4) * 0.45;
      particles.push({ mesh, mat, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed + 2.0, vz: ((i % 5) - 2) * 0.35, life: 0.52 + (i % 3) * 0.08, maxLife: 0.7 });
    }
  }

  let doorOpen = 0;
  let chestKeyOpen = 0;
  let chestGearOpen = 0;

  function sync(worldState, dt) {
    const t = worldState.time;
    const p = worldState.player;
    playerVisual.root.position.set(p.x, p.y, 0.3);
    playerVisual.root.scale.x = p.facing;
    playerVisual.root.visible = !(p.invuln > 0 && Math.floor(t * 22) % 2 === 0);
    playerVisual.shield.rotation.z += ((p.guarding ? -0.55 : 0) - playerVisual.shield.rotation.z) * Math.min(1, dt * 16);
    if (p.attackTimer > 0) {
      const progress = 1 - p.attackTimer / 0.34;
      playerVisual.swordPivot.rotation.z = -1.2 + Math.sin(Math.min(1, progress) * Math.PI) * 2.15;
    } else {
      playerVisual.swordPivot.rotation.z += (-0.55 - playerVisual.swordPivot.rotation.z) * Math.min(1, dt * 16);
    }
    const runBob = p.grounded ? Math.sin(t * 16) * Math.min(0.055, Math.abs(p.vx) * 0.012) : 0;
    playerVisual.root.position.y += runBob;

    for (const e of worldState.enemies) {
      const v = enemies.get(e.id);
      if (!v) continue;
      v.root.visible = e.alive && !(e.invuln > 0 && Math.floor(t * 26) % 2 === 0);
      if (!e.alive) continue;
      v.root.position.set(e.x, e.y, 0.25);
      v.root.scale.x = Math.abs(v.root.scale.x) * e.facing;
      const bob = e.type === 'blob' ? Math.sin(t * 9 + e.phase) * 0.08 : Math.sin(t * 5 + e.phase) * 0.025;
      v.root.position.y += bob;
      if (v.shieldPivot) v.shieldPivot.rotation.z += ((e.guarding ? -0.45 : 0.10) - v.shieldPivot.rotation.z) * Math.min(1, dt * 12);
      if (v.swordPivot) {
        const swing = e.attackTimer > 0 ? Math.sin((1 - e.attackTimer / (e.type === 'boss' ? 0.76 : 0.68)) * Math.PI) * 1.7 : 0;
        v.swordPivot.rotation.z = -0.4 + swing;
      }
    }

    const activeProjectileIds = new Set();
    for (const pr of worldState.projectiles) {
      const mesh = getProjectileVisual(pr);
      activeProjectileIds.add(pr.id);
      mesh.visible = pr.alive;
      mesh.position.set(pr.x, pr.y, 0.45);
      mesh.rotation.x += dt * 8;
      mesh.rotation.y += dt * 11;
    }
    for (const [id, mesh] of projectileVisuals) {
      if (!activeProjectileIds.has(id)) { root.remove(mesh); projectileVisuals.delete(id); }
    }

    const activePickupIds = new Set();
    for (const item of worldState.pickups) {
      if (!item.alive) continue;
      const mesh = getPickupVisual(item);
      activePickupIds.add(item.id);
      mesh.position.set(item.x, item.y, 0.5);
      mesh.rotation.y += dt * 3.2;
    }
    for (const [id, mesh] of pickupVisuals) {
      if (!activePickupIds.has(id)) { root.remove(mesh); pickupVisuals.delete(id); }
    }

    doorOpen += ((worldState.doorUnlocked ? 1 : 0) - doorOpen) * Math.min(1, dt * 5.2);
    door.position.y = worldState.level.door.y + doorOpen * 6.5;
    sunMark.rotation.z += dt * 1.4;

    barrier.visible = worldState.bossFight && !worldState.bossDefeated;
    barrier.rotation.y = Math.sin(t * 3) * 0.03;

    chestKeyOpen += ((worldState.keyCollected ? 1 : 0) - chestKeyOpen) * Math.min(1, dt * 8);
    keyChest.lidPivot.rotation.x = -chestKeyOpen * 1.10;
    keyGlyph.visible = !worldState.keyCollected;
    keyGlyph.rotation.y += dt * 2.2;
    keyGlyph.position.y = worldState.level.keyChest.y + 0.85 + Math.sin(t * 3) * 0.08;

    chestGearOpen += ((worldState.gearCollected ? 1 : 0) - chestGearOpen) * Math.min(1, dt * 8);
    gearChest.lidPivot.rotation.x = -chestGearOpen * 1.10;
    gearGlyph.visible = !worldState.gearCollected;
    gearGlyph.rotation.y += dt * 2.7;
    gearGlyph.position.y = worldState.level.gearChest.y + 0.92 + Math.sin(t * 3.4 + 1) * 0.08;

    altarCrystal.rotation.y += dt * (worldState.bossDefeated ? 2.8 : 0.6);
    altarCrystal.position.y = 0.75 + Math.sin(t * (worldState.bossDefeated ? 4 : 1.5)) * 0.08;
    if ('emissiveIntensity' in altarCrystalMat) altarCrystalMat.emissiveIntensity = worldState.bossDefeated ? 2.6 : 0.18;

    for (const f of torchFlames) {
      const pulse = 1 + Math.sin(t * 8 + f.phase) * 0.13;
      f.mesh.scale.set(pulse, 1.08 + Math.sin(t * 11 + f.phase) * 0.15, pulse);
      f.mesh.rotation.y += dt * 0.9;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) {
        root.remove(q.mesh);
        q.mesh.geometry.dispose();
        q.mat.dispose?.();
        particles.splice(i, 1);
        continue;
      }
      q.vy -= 8.5 * dt;
      q.mesh.position.x += q.vx * dt;
      q.mesh.position.y += q.vy * dt;
      q.mesh.position.z += q.vz * dt;
      q.mesh.rotation.x += dt * 7;
      q.mesh.rotation.y += dt * 5;
      q.mat.opacity = Math.max(0, q.life / q.maxLife);
    }
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj.geometry?.dispose) obj.geometry.dispose();
      if (obj.material) {
        const arr = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of arr) m?.dispose?.();
      }
    });
    scene.remove(root);
  }

  return { root, sync, spawnBurst, dispose, palette: PALETTE };
}
